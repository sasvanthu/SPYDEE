"""End-to-end integration: 5k-record ingest, dedup, and full-analysis
determinism across two identical runs on the same case.

These tests run against the configured local PostgreSQL (same DB the API uses)
inside throwaway cases, so they are self-contained and repeatable.
"""
from sqlalchemy import select, func

from app.models.models import SourceRecord, Signal, Hypothesis
from app.services.analysis_service import run_analysis
from tests.conftest import synthetic_5k_records, write_and_import


async def test_ingest_5k_records_and_dedup(db_session, make_user, make_case):
    user = await make_user()
    case = await make_case()
    await db_session.commit()

    records = synthetic_5k_records()
    assert len(records) >= 5000

    ev1, imp1 = await write_and_import(
        db_session, case.id, user.id, records,
        filename=f"int_{case.id.hex[:8]}_batch1.json",
    )
    assert imp1.accepted_count == len(records)
    assert imp1.rejected_count == 0
    assert imp1.status == "completed"

    # Re-importing the same payload must be flagged 100% duplicate.
    ev2, imp2 = await write_and_import(
        db_session, case.id, user.id, records,
        filename=f"int_{case.id.hex[:8]}_batch2.json",
    )
    assert imp2.accepted_count == 0
    assert imp2.rejected_count == len(records)

    all_records = (await db_session.execute(
        select(SourceRecord).where(SourceRecord.case_id == case.id)
    )).scalars().all()
    assert len(all_records) == 2 * len(records)

    dup_records = (await db_session.execute(
        select(SourceRecord).where(
            SourceRecord.case_id == case.id,
            SourceRecord.evidence_file_id == ev2.id,
        )
    )).scalars().all()
    assert dup_records and all(r.is_duplicate for r in dup_records)

    uniq = (await db_session.execute(
        select(func.count()).select_from(SourceRecord)
        .where(SourceRecord.case_id == case.id, SourceRecord.is_duplicate == False)  # noqa: E712
    )).scalar()
    assert uniq == len(records)


async def test_full_analysis_is_deterministic_across_two_runs(db_session, make_user, make_case):
    from app.models.models import AnalysisRun, Entity

    records = synthetic_5k_records(seed_phone=9120000000)
    assert len(records) >= 5000

    async def run_snapshot():
        user = await make_user()
        case = await make_case()
        await db_session.commit()

        _, imp = await write_and_import(
            db_session, case.id, user.id, records,
            filename=f"det_{case.id.hex[:8]}_batch.json",
        )
        assert imp.accepted_count == len(records)

        run = AnalysisRun(case_id=case.id, version=1, input_hash="test", configuration={})
        db_session.add(run)
        await db_session.flush()
        recs = (await db_session.execute(
            select(SourceRecord)
            .where(SourceRecord.case_id == case.id, SourceRecord.is_duplicate == False)  # noqa: E712
        )).scalars().all()
        stats = await run_analysis(db_session, run, recs)
        await db_session.commit()

        sig_rows = (await db_session.execute(
            select(Signal).where(Signal.case_id == case.id, Signal.analysis_run_id == run.id)
        )).scalars().all()
        hyp_rows = (await db_session.execute(
            select(Hypothesis).where(Hypothesis.case_id == case.id, Hypothesis.analysis_run_id == run.id)
        )).scalars().all()

        ids = set()
        for s in sig_rows:
            ep = s.entity_pair or {}
            ids.update(str(v) for v in ep.values() if isinstance(v, str))
        for h in hyp_rows:
            ep = h.entity_pair or {}
            ids.update(str(v) for v in ep.values() if isinstance(v, str))
        ents = (await db_session.execute(
            select(Entity.id, Entity.label).where(Entity.case_id == case.id)
        )).all()
        labels = {str(row[0]): row[1] for row in ents}

        # Entity ids are case-scoped, so fingerprints normalise to labels.
        def pair_key(ep):
            ep = ep or {}
            src = labels.get(str(ep.get("source", "")), str(ep.get("source", "")))
            tgt = labels.get(str(ep.get("target", "")), str(ep.get("target", "")))
            return tuple(sorted((src, tgt)))

        sig_fp = sorted(
            (s.engine_name, s.family, pair_key(s.entity_pair),
             s.numeric_value, s.quality_factor)
            for s in sig_rows
        )
        hyp_fp = sorted(
            (h.hypothesis_type, pair_key(h.entity_pair), h.numeric_value, h.quality_factor)
            for h in hyp_rows
        )
        return stats, sig_fp, hyp_fp

    stats1, sigs1, hyps1 = await run_snapshot()
    stats2, sigs2, hyps2 = await run_snapshot()

    assert stats1["signals"] == stats2["signals"]
    assert sigs1 == sigs2, "signals differ between identical runs"
    assert hyps1 == hyps2, "hypotheses differ between identical runs"
    assert len(hyps1) == stats1["hypotheses"]
    assert stats1["hypotheses"] > 0, "no hypotheses generated"

    for _, _, _, num, _ in sigs1:
        assert 0.0 <= num <= 100.0