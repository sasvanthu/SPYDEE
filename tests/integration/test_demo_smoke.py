"""End-to-end demo smoke test.

Walks the exact demo workflow from docs/DEMO.md against the real pipeline:
import the case_a import batches -> run full analysis -> hypotheses,
recommendations -> copilot tools. Confirms the demo data flows cleanly
through the canonical fold schemas and the whole loop is deterministic.
"""
import json
import os

import pytest
from sqlalchemy import select

from app.models.models import (
    Case, Entity, EvidenceFile, Hypothesis, HypothesisRecommendation, Import,
    Signal, SourceRecord,
)

BATCHES_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "demo", "import-batches"
)
BATCHES = [
    ("case_a_batch1_cdr.json", "cdr"),
    ("case_a_batch2_messages.json", "messages"),
    ("case_a_batch3_devices_locs.json", "device_sim"),
    ("case_a_batch4_transactions.json", "transactions"),
    ("case_a_batch5_contradiction.json", "cdr"),
]


def _load_batch(name):
    with open(os.path.join(BATCHES_DIR, name), encoding="utf-8") as f:
        return json.load(f)


@pytest.mark.asyncio
async def test_demo_workflow_end_to_end(db_session, make_case, make_user):
    from tests.conftest import write_and_import
    from app.models.models import AnalysisRun
    from app.services.analysis_service import run_analysis
    from app.services.copilot_service import answer_copilot_query

    owner = await make_user()
    case = await make_case(user_id=owner.id)

    for filename, source_type in BATCHES:
        records = _load_batch(filename)
        ev, import_obj = await write_and_import(
            db_session, case.id, owner.id, records,
            filename=filename, source_type=source_type,
        )
        assert import_obj.accepted_count == len(records), (
            f"{filename}: accepted {import_obj.accepted_count}/{len(records)}, "
            f"rejected {import_obj.rejected_count}"
        )

    total = sum(len(_load_batch(name)) for name, _ in BATCHES)
    all_records = (
        (await db_session.execute(
            select(SourceRecord).where(SourceRecord.case_id == case.id)
        )).scalars().all()
    )
    assert len(all_records) == total

    run = AnalysisRun(case_id=case.id, version=1, input_hash="demo_smoke", configuration={})
    db_session.add(run)
    await db_session.flush()
    recs = (await db_session.execute(
        select(SourceRecord).where(
            SourceRecord.case_id == case.id, SourceRecord.is_duplicate == False  # noqa: E712
        )
    )).scalars().all()
    stats = await run_analysis(db_session, run, recs)
    await db_session.flush()
    assert run.status == "completed"
    assert stats["signals"] > 0 and stats["hypotheses"] > 0 and stats["recommendations"] > 0

    signals = (
        (await db_session.execute(
            select(Signal).where(
                Signal.case_id == case.id, Signal.analysis_run_id == run.id
            )
        )).scalars().all()
    )
    assert len(signals) > 0
    families = {s.family for s in signals}
    assert "engine_error" not in families, [
        s.explanation for s in signals if s.family == "engine_error"
    ]
    assert families >= {"communication", "writing_style"}, list(families)
    assert "device_sim" in families, list(families)
    assert "network_topology" in families, list(families)
    assert all(0 <= s.numeric_value <= 1 for s in signals)

    hypotheses = (
        (await db_session.execute(
            select(Hypothesis).where(
                Hypothesis.case_id == case.id, Hypothesis.analysis_run_id == run.id
            )
        )).scalars().all()
    )
    assert len(hypotheses) > 0
    assert all(h.numeric_value is not None and 0 <= h.numeric_value <= 100 for h in hypotheses)

    recommendations = (
        (await db_session.execute(
            select(HypothesisRecommendation)
            .join(Hypothesis, Hypothesis.id == HypothesisRecommendation.hypothesis_id)
            .where(
                Hypothesis.case_id == case.id,
                Hypothesis.analysis_run_id == run.id,
            )
        )).scalars().all()
    )
    assert len(recommendations) > 0

    entities = (
        (await db_session.execute(
            select(Entity).where(Entity.case_id == case.id)
        )).scalars().all()
    )
    assert len(entities) > 0
    target = next(
        e for e in entities
        if e.entity_type.value == "phone_sim" and len(e.label) == 10
    )

    # Copilot: read-only tools + envelope dict, all deterministic offline.
    dossier = await answer_copilot_query(db_session, case.id, f"explain {target.label}")
    assert dossier["answer"]
    assert target.label in dossier["answer"]
    assert isinstance(dossier["citations"], list)

    gaps = await answer_copilot_query(
        db_session, case.id, "What information gaps remain for the highest-score lead?"
    )
    assert gaps["answer"]
    assert any("gap" in str(f).lower() for f in gaps["follow_ups"]) or "gap" in gaps["answer"].lower()

    contras = await answer_copilot_query(
        db_session, case.id, "Is there any evidence that contradicts the strongest communication lead?"
    )
    assert contras["answer"]
    assert isinstance(contras["citations"], list) and isinstance(contras["links"], list)

    hyps = await answer_copilot_query(db_session, case.id, "Show the top hypotheses.")
    assert "hypothes" in hyps["answer"].lower() or "hypothes" in str(hyps["citations"]).lower()