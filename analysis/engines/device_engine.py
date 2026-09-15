"""SPYDEE Device / SIM Continuity Engine (Ghost SIM).

Detects IMEI-IMSI swapping (handsets hopping SIMs and SIMs hopping handsets),
and co-traveling SIMs that register together at towers without direct
communication records.
"""
import uuid
from collections import defaultdict
from datetime import timedelta
from typing import List

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Signal
from analysis.engines._shared import (
    clamp01, score_round, entity_matches, entity_pair_json,
    load_id_entity_map, parse_datetime,
)

CO_TRAVEL_WINDOW_MIN = 30


async def analyze_device_continuity(db, case_id, analysis_run_id, records):
    signals: List[Signal] = []
    id_map = await load_id_entity_map(db, case_id)

    # device → set of (phonenorm, sim/imsi) from device events + CDR rows
    device_bindings = defaultdict(lambda: {"phones": set(), "sims": set(), "imeis": set(),
                                           "records": [], "times": [], "entity": None})
    # Pairwise co-location registry: (entity_a, entity_b) -> list of (tower, time)
    co_travel = defaultdict(list)

    for r in records:
        c = r.normalized_content
        if not isinstance(c, dict):
            continue

        device_raw = c.get("device_id") or c.get("equipment_id")
        phone_raw = c.get("phone_id") or c.get("caller_id") or c.get("msisdn")
        sim_raw = c.get("sim_id")
        imsi_raw = c.get("imsi") or c.get("caller_imsi")
        imei_raw = c.get("imei") or c.get("caller_imei")
        tower_raw = c.get("tower_id") or c.get("cell_tower_id")

        if device_raw:
            dev_norm = device_raw.strip().upper()
            binding = device_bindings[dev_norm]
            binding["records"].append(str(r.id))
            if binding["entity"] is None:
                binding["entity"] = entity_matches(id_map, "device", device_raw)
            if phone_raw:
                binding["phones"].add((entity_matches(id_map, "phone", phone_raw), str(phone_raw)))
            if sim_raw:
                binding["sims"].add((entity_matches(id_map, "sim", sim_raw), str(sim_raw)))
            if imsi_raw and not sim_raw:
                binding["sims"].add((entity_matches(id_map, "imsi", imsi_raw), str(imsi_raw)))
            if imei_raw:
                binding["imeis"].add(str(imei_raw).strip().upper())
            ts = parse_datetime(c.get("event_time") or c.get("_observed_at") or c.get("start_time"))
            if ts:
                binding["times"].append(ts)

        # Co-travel: require a tower + two distinct identifiers registered near-in-time
        if tower_raw and (phone_raw or sim_raw):
            ts = parse_datetime(c.get("event_time") or c.get("_observed_at") or c.get("start_time") or c.get("timestamp"))
            if ts is None:
                continue
            phones_here = []
            if phone_raw:
                eid = entity_matches(id_map, "phone", phone_raw)
                if eid:
                    phones_here.append(eid)
            if sim_raw:
                eid = entity_matches(id_map, "sim", sim_raw)
                if eid:
                    phones_here.append(eid)
            if imsi_raw:
                eid = entity_matches(id_map, "imsi", imsi_raw)
                if eid:
                    phones_here.append(eid)

            # Match against other identifiers observed at the same tower close in time
            for other in records:
                if other.id == r.id:
                    continue
                oc = other.normalized_content
                if not isinstance(oc, dict):
                    continue
                other_tower = oc.get("tower_id") or oc.get("cell_tower_id")
                if not other_tower or str(other_tower).strip().upper() != str(tower_raw).strip().upper():
                    continue
                other_ts = parse_datetime(oc.get("event_time") or oc.get("_observed_at")
                                          or oc.get("start_time") or oc.get("timestamp"))
                if other_ts is None:
                    continue
                if abs((other_ts - ts).total_seconds()) / 60 > CO_TRAVEL_WINDOW_MIN:
                    continue
                peers = []
                for field, id_type in (("phone_id", "phone"), ("caller_id", "phone"),
                                       ("sim_id", "sim"), ("imsi", "imsi")):
                    val = oc.get(field)
                    eid = entity_matches(id_map, id_type, val)
                    if eid:
                        peers.append(eid)
                for p in phones_here:
                    for q in peers:
                        if p != q:
                            key = tuple(sorted((p, q)))
                            co_travel[key].append({
                                "tower": str(tower_raw).strip().upper(),
                                "time": ts, "record": str(r.id),
                                "peer_record": str(other.id),
                            })

    for dev_norm, binding in device_bindings.items():
        phone_entities = {e for e, _ in binding["phones"] if e}
        sim_entities = {e for e, _ in binding["sims"] if e}
        all_id_entities = phone_entities | sim_entities
        if len(all_id_entities) < 2:
            continue

        # SIM hopping: multiple subscriber identities on one device
        ids = sorted(all_id_entities, key=lambda x: str(x))
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                a, b = ids[i], ids[j]
                shared = (a in phone_entities and b in phone_entities) or \
                         (a in sim_entities and b in sim_entities) or \
                         (a in phone_entities and b in sim_entities) or \
                         (a in sim_entities and b in phone_entities)
                if not shared:
                    continue
                base = clamp01(len(binding["records"]) / 8.0)
                swap_score = clamp01(base * 0.7 + (0.3 if len(binding["times"]) >= 3 else 0.0))
                signals.append(Signal(
                    case_id=case_id,
                    analysis_run_id=analysis_run_id,
                    engine_name="device_sim",
                    engine_version="v2.0",
                    entity_pair=entity_pair_json(a, b),
                    family="device_sim",
                    contributing_record_ids=binding["records"][:25],
                    time_window_start=min(binding["times"]) if binding["times"] else None,
                    time_window_end=max(binding["times"]) if binding["times"] else None,
                    numeric_value=score_round(swap_score),
                    quality_factor=round(clamp01(0.4 + len(binding["records"]) * 0.08), 4),
                    feature_details={
                        "shared_device": dev_norm,
                        "device_record_count": len(binding["records"]),
                        "device_event_count": len(binding["times"]),
                        "swap_kind": "sim_hop" if (a in sim_entities or b in sim_entities) else "multi_sim_handset",
                    },
                    explanation=(
                        f"Two subscriber identities share physical device {dev_norm} "
                        f"across {len(binding['records'])} records ({len(binding['times'])} events)."
                    ),
                ))

    # ── Device hopping: the same IMEI used across two distinct handsets ─────
    # A SIM swapped between devices, or a shared handset, appears as one IMEI
    # registered against two different device identifiers. Pair the device
    # entities that share an IMEI so investigators see the handover.
    imei_to_devices = defaultdict(list)
    for dev_norm, binding in device_bindings.items():
        for imei in binding["imeis"]:
            dev_entity = binding["entity"]
            if dev_entity is not None:
                imei_to_devices[imei].append((dev_norm, dev_entity))
    seen_imei_pairs = set()
    for imei, holders in imei_to_devices.items():
        distinct = sorted({e for _, e in holders}, key=str)
        if len(distinct) < 2:
            continue
        for i in range(len(distinct)):
            for j in range(i + 1, len(distinct)):
                a, b = distinct[i], distinct[j]
                key = tuple(sorted((str(a), str(b))))
                if key in seen_imei_pairs:
                    continue
                seen_imei_pairs.add(key)
                dev_names = sorted({n for n, _ in holders if _ in (a, b)})
                hop_records = [r for n, _ in holders for r in device_bindings[n]["records"]][:25]
                signals.append(Signal(
                    case_id=case_id,
                    analysis_run_id=analysis_run_id,
                    engine_name="device_sim",
                    engine_version="v2.1",
                    entity_pair=entity_pair_json(a, b),
                    family="device_sim",
                    contributing_record_ids=hop_records,
                    numeric_value=score_round(clamp01(0.35 + len(holders) * 0.08)),
                    quality_factor=round(clamp01(0.4 + len(holders) * 0.1), 4),
                    feature_details={
                        "pattern": "imei_reuse",
                        "shared_imei": imei,
                        "devices": dev_names,
                        "holder_count": len(holders),
                        "swap_kind": "device_hop",
                    },
                    explanation=(
                        f"The same IMEI {imei} was registered against {len(holders)} distinct "
                        f"handset(s) ({', '.join(dev_names)}) — handset hopping or shared device. "
                        "Indicates SIM relocation between devices."
                    ),
                ))

    for (a, b), occurrences in co_travel.items():
        if len(occurrences) < 2:
            continue
        score = clamp01(len(occurrences) / 8.0)
        towers = {o["tower"] for o in occurrences}
        signals.append(Signal(
            case_id=case_id,
            analysis_run_id=analysis_run_id,
            engine_name="device_sim",
            engine_version="v2.0",
            entity_pair=entity_pair_json(a, b),
            family="device_sim",
            contributing_record_ids=[o["record"] for o in occurrences][:25],
            time_window_start=min(o["time"] for o in occurrences),
            time_window_end=max(o["time"] for o in occurrences),
            numeric_value=score_round(min(1.0, score + 0.1)),
            quality_factor=round(clamp01(0.4 + len(occurrences) * 0.1), 4),
            feature_details={
                "co_travel_events": len(occurrences),
                "towers": sorted(towers),
                "no_direct_calls": True,
            },
            explanation=(
                f"Identities co-registered at the same towers {len(occurrences)} times "
                f"({', '.join(sorted(towers))}) with no direct communication records."
            ),
        ))

    return signals