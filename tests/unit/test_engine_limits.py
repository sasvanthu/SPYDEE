"""Honest-threshold behaviour for the specialist engines.

- StyloLink abstains (emits no signal) when authors have fewer than two
  messages / a tiny corpus, and discloses its limitation on every signal.
- GhostTower applies a background-activity penalty: co-location at a busy
  tower (many distinct identities) scores lower than the same pattern at a
  quiet tower.
- Device/SIM detects IMEI reuse across distinct handsets (device hopping)
  and no longer duplicates contributing record ids.
- Hypothesis fusion notes state the combination method and that scores are
  uncalibrated evidence scores, not probabilities.
"""
import uuid
from types import SimpleNamespace

from sqlalchemy import select

from app.models.models import (
    Entity, Identifier, EntityIdentifierLink, EntityType, Signal,
    ReviewState,
)
from analysis.engines.stylo_engine import analyze_stylometry
from analysis.engines.infra_engine import analyze_infrastructure
from analysis.engines.device_engine import analyze_device_continuity
from analysis.scoring.hypothesis_engine import generate_hypotheses


def _record(record_id, content):
    return SimpleNamespace(id=record_id, normalized_content=content)


async def _entity(db, case_id, etype, label):
    e = Entity(case_id=case_id, entity_type=etype, label=label,
               review_state=ReviewState.NEW)
    db.add(e)
    await db.flush()
    return e


async def _identifier(db, case_id, eid, id_type, value):
    from app.services.entity_service import normalize_identifier
    ident = Identifier(case_id=case_id, id_type=id_type, id_value=value,
                       normalized_value=normalize_identifier(id_type, value))
    db.add(ident)
    await db.flush()
    db.add(EntityIdentifierLink(entity_id=eid, identifier_id=ident.id,
                                review_state=ReviewState.NEW))
    await db.flush()


async def _phone(db, case_id, phone, label):
    e = await _entity(db, case_id, EntityType.PHONE_SIM, label)
    await _identifier(db, case_id, e.id, "phone", phone)
    return e


async def test_stylometry_abstains_on_single_message_and_discloses_limit(db_session, make_case):
    case = await make_case()
    a = await _entity(db_session, case.id, EntityType.PERSON, "Agent A")
    b = await _entity(db_session, case.id, EntityType.PERSON, "Agent B")
    await _identifier(db_session, case.id, a.id, "alias", "author-a")
    await _identifier(db_session, case.id, b.id, "alias", "author-b")

    # One short message each → below the two-message minimum → abstain.
    lone = [
        _record(uuid.uuid4(), {"alias_id": "author-a",
                               "text": "drop the consignment near the gate"}),
        _record(uuid.uuid4(), {"alias_id": "author-b",
                               "text": "ok got it, will confirm tomorrow"}),
        _record(uuid.uuid4(), {"alias_id": "author-a",
                               "text": "send the final list"}),
    ]
    signals = await analyze_stylometry(db_session, case.id, uuid.uuid4(), lone)
    assert signals == [], "authors with under two messages each must abstain"

    # Enough corpus from both authors → signal with limitation disclosure.
    corpus = [
        _record(uuid.uuid4(), {"alias_id": "author-a",
                               "text": "bhai kya status hai on the new delivery route, "
                                       "we need the full inventory list before the van departs tonight, "
                                       "confirm the warehouse timings and please send the manifest copy"}),
        _record(uuid.uuid4(), {"alias_id": "author-a",
                               "text": "okay okay thek hai, keep it quiet and send me the exact "
                                       "count, also check the driver details again"}),
        _record(uuid.uuid4(), {"alias_id": "author-b",
                               "text": "madam the goods have left the godown now, i will update "
                                       "the system once the truck reaches the border check post, "
                                       "i have the delivery challan with me"}),
        _record(uuid.uuid4(), {"alias_id": "author-b",
                               "text": "pls verify the consignment number and the names on the "
                                       "challan, i am at the yard, will wait for ur call"}),
    ]
    sigs = await analyze_stylometry(db_session, case.id, uuid.uuid4(), corpus)
    assert len(sigs) >= 1, "sufficient corpus should produce a signal"
    sig = sigs[0]
    assert sig.family == "writing_style"
    assert "limitation" in (sig.feature_details or {}), "must disclose stylometry limitation"
    assert "not authorship identification" in sig.explanation


async def test_ghosttower_penalises_background_busy_towers(db_session, make_case):
    case = await make_case()
    # Pair (a, b) co-locate at a QUIET tower used by no one else.
    a = await _phone(db_session, case.id, "+919000000001", "A")
    b = await _phone(db_session, case.id, "+919000000002", "B")
    # Pair (c, d) co-locate at a BUSY tower also used by 40 other identities.
    c = await _phone(db_session, case.id, "+919000000003", "C")
    d = await _phone(db_session, case.id, "+919000000004", "D")
    others = []
    for i in range(40):
        others.append(await _phone(db_session, case.id, f"+9191000000{i:02d}", f"BG{i}"))
    await db_session.commit()

    records = []
    # quiet tower: a then b, 10 min apart
    records.append(_record(uuid.uuid4(), {
        "caller_id": "+919000000001", "caller_tower_id": "TOW-QUIET",
        "start_time": "2026-02-01T10:00:00"}))
    records.append(_record(uuid.uuid4(), {
        "caller_id": "+919000000002", "caller_tower_id": "TOW-QUIET",
        "start_time": "2026-02-01T10:10:00"}))
    # busy tower: c then d, 10 min apart, plus 40 backgrounds throughout the day
    records.append(_record(uuid.uuid4(), {
        "caller_id": "+919000000003", "caller_tower_id": "TOW-BUSY",
        "start_time": "2026-02-01T11:00:00"}))
    records.append(_record(uuid.uuid4(), {
        "caller_id": "+919000000004", "caller_tower_id": "TOW-BUSY",
        "start_time": "2026-02-01T11:10:00"}))
    for i, ent in enumerate(others):
        records.append(_record(uuid.uuid4(), {
            "caller_id": f"+9191000000{i:02d}", "caller_tower_id": "TOW-BUSY",
            "start_time": f"2026-02-01T{i % 23:02d}:{i % 60:02d}:00"}))

    signals = await analyze_infrastructure(db_session, case.id, uuid.uuid4(), records)
    co_loc = [s for s in signals if s.family == "spatial_temporal"]

    def _pair_signal(x, y):
        found = [s for s in co_loc
                 if s.entity_pair and {str(x), str(y)} ==
                 {s.entity_pair.get("source"), s.entity_pair.get("target")}]
        return found[0] if found else None

    quiet_sig = _pair_signal(a.id, b.id)
    busy_sig = _pair_signal(c.id, d.id)
    assert quiet_sig is not None, "clean-pair co-location expected at quiet tower"
    assert busy_sig is not None, "co-location expected at busy tower"
    assert busy_sig.feature_details["tower_busyness_max"] >= 40
    assert quiet_sig.feature_details["tower_busyness_max"] <= 2
    assert busy_sig.numeric_value < quiet_sig.numeric_value, (
        "busy-tower co-location should be penalised below background"
    )
    assert busy_sig.feature_details["background_multiplier"] < 1.0
    assert busy_sig.numeric_value < 0.25, "misleading overlap must not produce a strong link"


async def test_device_imei_reuse_across_handsets(db_session, make_case):
    case = await make_case()
    dev_x = await _entity(db_session, case.id, EntityType.DEVICE, "Handset X")
    dev_y = await _entity(db_session, case.id, EntityType.DEVICE, "Handset Y")
    await _identifier(db_session, case.id, dev_x.id, "device", "HANDSET-X-9001")
    await _identifier(db_session, case.id, dev_y.id, "device", "HANDSET-Y-9002")
    await db_session.commit()

    imei = "356789000123456"
    records = [
        _record(uuid.uuid4(), {"device_id": "HANDSET-X-9001", "imei": imei,
                               "event_time": "2026-03-01T08:00:00"}),
        _record(uuid.uuid4(), {"device_id": "HANDSET-Y-9002", "imei": imei,
                               "event_time": "2026-03-01T09:30:00"}),
    ]
    signals = await analyze_device_continuity(db_session, case.id, uuid.uuid4(), records)
    hop = [s for s in signals if (s.feature_details or {}).get("pattern") == "imei_reuse"]
    assert len(hop) == 1, "same IMEI on two handsets should surface a device-hop signal"
    assert hop[0].family == "device_sim"
    assert "356789000123456" in (hop[0].feature_details or {}).get("shared_imei", "")
    # contributing records should not contain duplicates
    assert len(hop[0].contributing_record_ids) == len(set(hop[0].contributing_record_ids))


async def test_fusion_notes_explain_method_and_are_not_probabilities(db_session, make_case):
    case = await make_case()
    signals = [
        Signal(family="communication", entity_pair={"source": "a", "target": "b"},
               numeric_value=0.9, quality_factor=0.8,
               explanation="probe", feature_details={}),
        Signal(family="device_sim", entity_pair={"source": "a", "target": "b"},
               numeric_value=0.8, quality_factor=0.9,
               explanation="probe", feature_details={}),
    ]
    hyps, _, _ = await generate_hypotheses(db_session, case.id, uuid.uuid4(), signals)
    assert len(hyps) > 0
    for h in hyps:
        assert "Fusion:" in h.notes
        assert "w=" in h.notes
        assert "not probabilities" in h.notes
        assert (h.numeric_value or 0) <= 100