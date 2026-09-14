"""Contradiction detection end-to-end.

A pair that is co-located at a Delhi tower has its co-location claim
invalidated when one of them is impossibly observed in Mumbai minutes later.
The infrastructure engine must flag the co-location signal as contradictory,
and the pairing's terror_link hypothesis score must be lower than the same
case without the impossible-travel evidence.
"""
from datetime import timedelta
import uuid

from sqlalchemy import select

from app.models.models import Signal, Hypothesis, SourceRecord, Entity
from app.services.analysis_service import run_analysis
from tests.conftest import write_and_import, tower_fixture

DELHI_X, DELHI_Y, DELHI_ACC = 28.6139, 77.2090, 500
MUM_X, MUM_Y = 19.0760, 72.8777  # ~1135 km from Delhi


def _scenario(with_mumbai_hop: bool):
    day0 = __import__("datetime").datetime(2026, 2, 1, 10, 0, 0)
    p1, p2, p9, p8 = 9200000001, 9200000002, 9200000009, 9200000008

    rows = [
        # P1 establishes presence at Delhi tower (ties into communication too).
        tower_fixture(p1, "TOW-DEL", DELHI_X, DELHI_Y, day0),
        # P2 co-locates at the same Delhi tower 1 minute later; no direct call.
        tower_fixture(p2, "TOW-DEL", DELHI_X, DELHI_Y, day0 + timedelta(minutes=1)),
        # Second Delhi fix for P1 extends the co-location window.
        tower_fixture(p1, "TOW-DEL", DELHI_X, DELHI_Y, day0 + timedelta(minutes=3)),
        # P9 ties up P2's call graph so P1/P2 really have no direct call.
        tower_fixture(p9, "TOW-DEL", DELHI_X, DELHI_Y, day0 + timedelta(minutes=2)),
    ]
    if with_mumbai_hop:
        # Impossible: P1 1135 km away 5 minutes later (>13500 km/h).
        rows.append(
            tower_fixture(p1, "TOW-BOM", MUM_X, MUM_Y, day0 + timedelta(minutes=5))
        )
    return rows


async def _run_case(db_session, case_id):
    from app.models.models import AnalysisRun
    run = AnalysisRun(case_id=case_id, version=1, input_hash="contra", configuration={})
    db_session.add(run)
    await db_session.flush()
    records = (await db_session.execute(
        select(SourceRecord).where(SourceRecord.case_id == case_id)
    )).scalars().all()
    await run_analysis(db_session, run, records)
    await db_session.commit()

    signals = (await db_session.execute(
        select(Signal).where(Signal.analysis_run_id == run.id)
    )).scalars().all()
    hyps = (await db_session.execute(
        select(Hypothesis).where(Hypothesis.analysis_run_id == run.id)
    )).scalars().all()
    return signals, hyps


async def test_impossible_travel_creates_contradiction_signal(db_session, make_user, make_case):
    user = await make_user()
    case = await make_case()
    await db_session.commit()

    rows = _scenario(with_mumbai_hop=True)
    _, imp = await write_and_import(
        db_session, case.id, user.id, rows,
        filename=f"con_{case.id.hex[:8]}_batch.json",
    )
    assert imp.accepted_count == len(rows)

    signals, _ = await _run_case(db_session, case.id)

    travel = [s for s in signals if s.contradiction]
    assert travel, "expected at least one impossible-travel contradiction signal"
    assert all("Impossible travel" in (s.contradiction_reason or "") for s in travel)
    assert any(s.family == "spatial_temporal" for s in signals), "no co-location signal"

    co_loc = [s for s in signals if s.family == "spatial_temporal"]
    contradicted = [s for s in co_loc if s.contradiction]
    assert contradicted, "co-location signal should be marked contradiction=True"


async def test_contradiction_downgrades_pair_hypothesis(db_session, make_user, make_case):
    user = await make_user()
    clean_case = await make_case()
    contra_case = await make_case()
    await db_session.commit()

    clean_rows = _scenario(with_mumbai_hop=False)
    contra_rows = _scenario(with_mumbai_hop=True)

    _, imp_a = await write_and_import(db_session, clean_case.id, user.id, clean_rows,
                                      filename=f"ca_{clean_case.id.hex[:8]}.json")
    _, imp_b = await write_and_import(db_session, contra_case.id, user.id, contra_rows,
                                      filename=f"cb_{contra_case.id.hex[:8]}.json")

    clean_sigs, clean_hyps = await _run_case(db_session, clean_case.id)
    contra_sigs, contra_hyps = await _run_case(db_session, contra_case.id)

    async def _labels():
        ids = set()
        for h in clean_hyps + contra_hyps:
            ep = h.entity_pair or {}
            for k in ("source", "target"):
                if ep.get(k):
                    ids.add(uuid.UUID(str(ep[k])))
        ents = (await db_session.execute(
            select(Entity).where(Entity.id.in_(ids))
        )).scalars().all()
        return {str(e.id): e.label for e in ents}

    labels = await _labels()

    def pair_key(h):
        ep = h.entity_pair or {}
        return tuple(sorted((labels.get(str(ep.get("source", "")), "?"),
                             labels.get(str(ep.get("target", "")), "?"))))

    def by_pair(hyps):
        out = {}
        for h in hyps:
            out.setdefault(pair_key(h), []).append(h)
        return out

    clean_map = by_pair(clean_hyps)
    contra_map = by_pair(contra_hyps)

    pairs = set(clean_map) & set(contra_map)
    assert pairs, "both cases must surface the same ordered entity pairs"

    downgraded = False
    for pk in pairs:
        for hc in clean_map[pk]:
            for hb in contra_map[pk]:
                if hc.hypothesis_type == hb.hypothesis_type == "terror_link":
                    assert hb.numeric_value <= hc.numeric_value, \
                        "contradicted pair must not score higher"
                    if hc.numeric_value > hb.numeric_value:
                        downgraded = True
    assert downgraded, "contradiction must downgrade the terror_link score"