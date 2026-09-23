"""Three synthetic demo scenarios mapped to the prompt's acceptance cases.

1. Supported connection  — suspects with direct calls, a shared handset and
   quiet-tower co-location → strong fused hypothesis, auto-generated lead.
2. Misleading overlap    — coincidental co-location at one busy public tower
   with no other overlap → GhostTower applies a background penalty and NO
   strong link hypothesis is asserted.
3. Conflicting/insufficient evidence — support + impossible-travel
   contradiction → contradiction record, penalised fusion, and stylometry
   abstains on a sub-second corpus (no fabricated authorship link).
"""
import uuid
from types import SimpleNamespace
from datetime import timedelta

from sqlalchemy import select

from app.models.models import (
    Entity, EntityType, Identifier, EntityIdentifierLink,
    ReviewState, AnalysisRun, Signal, Hypothesis, Contradiction, Lead,
)
from app.services.analysis_service import run_analysis
from app.services.entity_service import normalize_identifier
from analysis.scoring.hypothesis_engine import generate_hypotheses

T0 = "2026-01-05T"


def _record(rid, content):
    return SimpleNamespace(id=rid, normalized_content=content)


async def _entity(db, case_id, etype, label, attributes=None):
    e = Entity(case_id=case_id, entity_type=etype, label=label,
               description=None, review_state=ReviewState.NEW,
               attributes=attributes)
    db.add(e)
    await db.flush()
    return e


async def _ident(db, case_id, eid, id_type, value):
    i = Identifier(case_id=case_id, id_type=id_type, id_value=value,
                   normalized_value=normalize_identifier(id_type, value))
    db.add(i)
    await db.flush()
    db.add(EntityIdentifierLink(entity_id=eid, identifier_id=i.id,
                                review_state=ReviewState.NEW))
    await db.flush()
    return i


async def _phone(db, case_id, phone, label):
    e = await _entity(db, case_id, EntityType.PHONE_SIM, label)
    await _ident(db, case_id, e.id, "phone", phone)
    return e


def _cell(phone, tower, dt, minutes=1):
    return _record(uuid.uuid4(), {
        "caller_id": phone, "callee_id": f"+91{(int(phone[3:]) + 99999) % 10**10:010d}",
        "start_time": f"{T0}{dt}", "duration_seconds": minutes * 60,
        "caller_tower_id": tower})


async def _run(db, case_id):
    run = AnalysisRun(case_id=case_id, input_hash="demo", configuration={"auto_workspace": True})
    db.add(run)
    await db.flush()
    return run


async def test_scenario1_supported_connection(db_session, make_case):
    case = await make_case()
    a = await _phone(db_session, case.id, "+919876000001", "Suspect A")
    b = await _phone(db_session, case.id, "+919876000002", "Suspect B")
    await db_session.commit()

    records = []
    # 20 direct calls within 2 days (strong communication)
    for i in range(20):
        day = f"0{i // 8}" if i // 8 > 0 else "0"
        records.append(_record(uuid.uuid4(), {
            "caller_id": "+919876000001", "callee_id": "+919876000002",
            "start_time": f"{T0}{day}:{10 + i % 4}:{10 + i % 50:02d}",
            "duration_seconds": 200, "caller_tower_id": "QUIET-TOW"}))
    # shared handset: subscriber identities A and B register on the same device
    for i in range(8):
        phone = "+919876000001" if i % 2 else "+919876000002"
        records.append(_record(uuid.uuid4(), {
            "device_id": "HANDSET-777", "event_time": f"{T0}{'1'}{i % 8}:05:00",
            "caller_id": phone, "imsi": "40400000000000"}))

    run = await _run(db_session, case.id)
    stats = await run_analysis(db_session, run, records)
    await db_session.flush()
    await db_session.commit()

    assert stats["signals"] > 0 and stats["hypotheses"] > 0
    hyps = (await db_session.execute(
        select(Hypothesis).where(Hypothesis.case_id == case.id))).scalars().all()
    best = max(hyps, key=lambda h: h.numeric_value or 0)
    print(f"[S1] signals={stats['signals']} hyps={stats['hypotheses']} best={best.numeric_value} "
          f"({best.hypothesis_type}) workspace={stats['workspace']}")
    assert best.numeric_value >= 80, "supported connection must produce a high-plausibility link"
    leads = (await db_session.execute(
        select(Lead).where(Lead.case_id == case.id))).scalars().all()
    assert any("high" in (l.title or "").lower() for l in leads), "auto-generated lead expected"


async def test_scenario2_misleading_overlap(db_session, make_case):
    case = await make_case()
    a = await _phone(db_session, case.id, "+919876000010", "Stranger A")
    b = await _phone(db_session, case.id, "+919876000011", "Stranger B")
    grounds = [await _phone(db_session, case.id, f"+9198760001{i:02d}", f"BG{i}")
               for i in range(40)]
    await db_session.commit()

    records = []
    records.append(_cell("+919876000010", "TOW-BUSY", "00:10:00"))
    records.append(_cell("+919876000011", "TOW-BUSY", "00:20:00"))
    for i, g in enumerate(grounds):
        records.append(_cell(f"+9198760001{i:02d}", "TOW-BUSY",
                             f"{i % 24:02d}:{i % 60:02d}:00"))

    run = await _run(db_session, case.id)
    stats = await run_analysis(db_session, run, records)
    await db_session.commit()

    sigs = (await db_session.execute(
        select(Signal).where(Signal.case_id == case.id,
                             Signal.family == "spatial_temporal"))).scalars().all()
    ab = [s for s in sigs if s.entity_pair and
          {str(a.id), str(b.id)} == {s.entity_pair.get("source"), s.entity_pair.get("target")}]
    assert ab, "co-location signal expected for the overlapping pair"
    print(f"[S2] spatial sig score={ab[0].numeric_value} busy={ab[0].feature_details.get('busy_tower')} "
          f"(tower busyness {ab[0].feature_details.get('tower_busyness_max')})")
    assert ab[0].feature_details.get("busy_tower") is True
    hyps = (await db_session.execute(
        select(Hypothesis).where(Hypothesis.case_id == case.id))).scalars().all()
    pair_hyps = [h for h in hyps if h.entity_pair and
                 {str(a.id), str(b.id)} ==
                 {h.entity_pair.get("source"), h.entity_pair.get("target")}]
    print(f"[S2] pair hyps: {[(h.hypothesis_type, h.numeric_value) for h in pair_hyps]}")
    assert all((h.numeric_value or 0) < 50 for h in pair_hyps), \
        "coincidental busy-tower overlap must NOT produce a strong link"


async def test_scenario3_conflicting_and_insufficient(db_session, make_case):
    case = await make_case()
    a = await _phone(db_session, case.id, "+919876000020", "Subject A")
    b = await _phone(db_session, case.id, "+919876000021", "Subject B")
    # location entities for impossible-travel check
    await _entity(db_session, case.id, EntityType.LOCATION, "DELHI-TOW",
                  attributes={"lat": 28.6139, "lon": 77.2090})
    await _entity(db_session, case.id, EntityType.LOCATION, "MUMBAI-TOW",
                  attributes={"lat": 19.0760, "lon": 72.8777})
    # single-message authors (insufficient corpus → stylometry must abstain)
    await db_session.commit()

    records = [
        # supporting: A and B co-locate at a quiet tower
        _cell("+919876000020", "DELHI-TOW", "09:58:00"),
        _cell("+919876000021", "DELHI-TOW", "10:02:00"),
        # conflicting: A impossibly travels Delhi→Mumbai in 6 minutes
        _record(uuid.uuid4(), {"caller_id": "+919876000020",
                               "caller_tower_id": "MUMBAI-TOW",
                               "start_time": f"{T0}10:04:00"}),
        # insufficient: one short message each (below stylometry minimum)
        _record(uuid.uuid4(), {"alias_id": "solo-a", "text": "send it now"}),
        _record(uuid.uuid4(), {"alias_id": "solo-b", "text": "ok sure"}),
    ]

    run = await _run(db_session, case.id)
    stats = await run_analysis(db_session, run, records)
    await db_session.commit()

    sigs = (await db_session.execute(
        select(Signal).where(Signal.case_id == case.id))).scalars().all()
    contested = [s for s in sigs if s.family == "spatial_temporal"
                 and (s.feature_details or {}).get("contradicted")]
    print(f"[S3] signals={stats['signals']} contested_co_loc={len(contested)} "
          f"contradictions={stats['workspace']['created']['contradictions']}")
    assert any(s.contradiction for s in sigs), "impossible-travel contradiction signal expected"
    contras = (await db_session.execute(
        select(Contradiction).where(Contradiction.case_id == case.id))).scalars().all()
    assert contras, "contradiction record must be auto-created for the workspace"
    assert contras[0].status.value == "open"
    # stylometry abstains — insufficient corpus
    assert not [s for s in sigs if s.family == "writing_style"], \
        "single short messages must NOT produce an authorship signal"