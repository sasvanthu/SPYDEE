"""SPYDEE Infrastructure & Geospatial Engine.

Combines geospatial co-location (identities at shared towers without direct
calls), shared-IP/subnet infrastructure signals, and impossible-travel velocity
violations (delta distance / delta time > 1000 km/h → contradiction flag).
"""
import math
from collections import defaultdict
from datetime import timedelta
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Entity, Signal, EntityType, Relationship
from analysis.engines._shared import (
    clamp01, score_round, entity_matches, entity_pair_json,
    load_id_entity_map, parse_datetime,
)

CO_LOCATION_WINDOW_MIN = 60
SPEED_LIMIT_KMH = 1000.0
ANTENNA_LIMIT_KM = 30.0
WINDOW_OVERLAP_BUFFER_MIN = 30


def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


async def analyze_infrastructure(db, case_id, analysis_run_id, records):
    signals: List[Signal] = []
    id_map = await load_id_entity_map(db, case_id)

    record_by_id = {r.id: r for r in records}

    # ── 1. Co-location (spatial_temporal) ───────────────────────────────────
    tower_observations = defaultdict(list)
    for r in records:
        c = r.normalized_content
        if not isinstance(c, dict):
            continue
        tower = c.get("tower_id") or c.get("cell_tower_id") or c.get("caller_tower_id")
        caller = c.get("caller_id") or c.get("calling_number")
        callee = c.get("callee_id") or c.get("called_number")
        if not tower:
            continue
        ts = parse_datetime(c.get("start_time") or c.get("timestamp") or c.get("_observed_at"))
        if ts is None:
            continue
        eids = set()
        e = entity_matches(id_map, "phone", caller)
        if e:
            eids.add(e)
        e = entity_matches(id_map, "phone", callee)
        if e:
            eids.add(e)
        if not eids:
            continue
        tower_observations[str(tower).strip().upper()].append((ts, eids, str(r.id)))

    direct_calls = await _load_direct_call_pairs(db, case_id)
    seen = set()
    for tower, events in tower_observations.items():
        events.sort(key=lambda x: x[0])
        for i in range(len(events)):
            for j in range(i + 1, len(events)):
                t1, ids1, rid1 = events[i]
                t2, ids2, rid2 = events[j]
                if (t2 - t1) > timedelta(minutes=CO_LOCATION_WINDOW_MIN):
                    break
                for a in ids1:
                    for b in ids2:
                        if a == b:
                            continue
                        pair = frozenset((a, b))
                        if pair in direct_calls or pair in seen:
                            continue
                        seen.add(pair)
                        score = clamp01(0.35 + len(ids1 & ids2) * 0.1)
                        signals.append(Signal(
                            case_id=case_id,
                            analysis_run_id=analysis_run_id,
                            engine_name="infrastructure",
                            engine_version="v2.0",
                            entity_pair=entity_pair_json(a, b),
                            family="spatial_temporal",
                            contributing_record_ids=[rid1, rid2],
                            time_window_start=t1,
                            time_window_end=t2,
                            numeric_value=score_round(score),
                            quality_factor=0.5,
                            feature_details={
                                "pattern": "co_location",
                                "tower": tower,
                                "minutes_apart": round((t2 - t1).total_seconds() / 60, 1),
                                "no_direct_calls": True,
                            },
                            explanation=(
                                f"Identities observed at tower {tower} within "
                                f"{round((t2-t1).total_seconds()/60,1)} min despite "
                                "no direct call records."
                            ),
                        ))

    # ── 2. Shared IP / subnet (infrastructure) ──────────────────────────────
    entity_ips = defaultdict(set)
    entity_records = defaultdict(list)
    ip_entities = defaultdict(list)
    for r in records:
        c = r.normalized_content
        if not isinstance(c, dict):
            continue
        ip = c.get("src_ip") or c.get("source_ip") or c.get("ip_address")
        if not ip:
            continue
        eids = set()
        for field, id_type in (("alias_id", "alias"), ("sender_alias", "alias"),
                               ("handle", "handle"), ("device_id", "device"),
                               ("user_id", "alias")):
            val = c.get(field)
            e = entity_matches(id_map, id_type, val)
            if e:
                eids.add(e)
        if not eids:
            continue
        ip = str(ip).strip()
        for e in eids:
            entity_ips[e].add(ip)
            entity_records[e].append(str(r.id))
            ip_entities[ip].append((e, str(r.id)))

    subnet_groups = defaultdict(set)
    ip_nodes = set()
    for ip, holders in ip_entities.items():
        ip_nodes.add(ip)
        if "." in ip and len(ip.split(".")) >= 3:
            subnet_groups[".".join(ip.split(".")[:3])].add(ip)
        if ":" in ip:
            subnet_groups["v6_" + ip.split(":")[0]].add(ip)

    seen_pairs = set()
    for subnet, ips in subnet_groups.items():
        members = []
        for ip in sorted(ips):
            members.extend(ip_entities.get(ip, []))
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                (a, ra), (b, rb) = members[i], members[j]
                if a == b:
                    continue
                key = frozenset((a, b))
                if key in seen_pairs:
                    continue
                seen_pairs.add(key)
                shared_ips = entity_ips[a] & entity_ips[b]
                score = clamp01(len(shared_ips) / 3.0)
                signals.append(Signal(
                    case_id=case_id,
                    analysis_run_id=analysis_run_id,
                    engine_name="infrastructure",
                    engine_version="v2.0",
                    entity_pair=entity_pair_json(a, b),
                    family="infrastructure",
                    contributing_record_ids=[ra, rb],
                    numeric_value=score_round(min(1.0, score * 0.7 + 0.3)),
                    quality_factor=round(clamp01(0.3 + len(shared_ips) * 0.2), 4),
                    feature_details={
                        "pattern": "shared_ip",
                        "shared_ips": sorted(shared_ips),
                        "subnet": subnet,
                        "vpn_egress": len(shared_ips) >= 2,
                    },
                    explanation=(
                        f"Identities used shared network endpoints in subnet {subnet} "
                        f"({', '.join(sorted(shared_ips))})."
                    ),
                ))

    # ── 3. Impossible travel (contradiction flag) ───────────────────────────
    tower_coords = {}
    result = await db.execute(
        select(Entity).where(Entity.case_id == case_id, Entity.entity_type == EntityType.LOCATION)
    )
    for e in result.scalars():
        attrs = e.attributes or {}
        if attrs.get("lat") is not None and attrs.get("lon") is not None:
            label = e.label or str(e.id)
            for ident_value in [label]:
                tower_coords[str(ident_value).strip().upper()] = (attrs["lat"], attrs["lon"])

    per_entity = defaultdict(list)
    impossible_windows = defaultdict(list)
    for r in records:
        c = r.normalized_content
        if not isinstance(c, dict):
            continue
        tower = (c.get("tower_id") or c.get("cell_tower_id") or c.get("caller_tower_id"))
        if not tower:
            continue
        tower_norm = str(tower).strip().upper()
        if tower_norm not in tower_coords:
            continue
        ts = parse_datetime(c.get("start_time") or c.get("timestamp") or c.get("_observed_at"))
        if ts is None:
            continue
        caller = c.get("caller_id") or c.get("calling_number")
        e = entity_matches(id_map, "phone", caller)
        if not e:
            continue
        per_entity[e].append((ts, tower_norm))

    for e, obs in per_entity.items():
        obs.sort(key=lambda x: x[0])
        for i in range(1, len(obs)):
            t_prev, t_prev_norm = obs[i - 1]
            t_cur, t_cur_norm = obs[i]
            dt_hours = (t_cur - t_prev).total_seconds() / 3600.0
            if dt_hours <= 0:
                continue
            lat1, lon1 = tower_coords[t_prev_norm]
            lat2, lon2 = tower_coords[t_cur_norm]
            dist = _haversine_km(lat1, lon1, lat2, lon2)
            if dist > ANTENNA_LIMIT_KM and (dist / dt_hours) > SPEED_LIMIT_KMH:
                reason = (
                    f"Impossible travel: {round(dist,0)} km between towers "
                    f"in {round(dt_hours,2)} h (~{round(dist/dt_hours,0)} km/h)."
                )
                impossible_windows[str(e)].append((t_prev, t_cur, reason))
                signals.append(Signal(
                    case_id=case_id,
                    analysis_run_id=analysis_run_id,
                    engine_name="infrastructure",
                    engine_version="v2.0",
                    entity_pair=entity_pair_json(e, e),
                    family="infrastructure",
                    time_window_start=t_prev,
                    time_window_end=t_cur,
                    numeric_value=0.0,
                    quality_factor=1.0,
                    contradiction=True,
                    contradiction_reason=reason,
                    feature_details={
                        "pattern": "impossible_travel",
                        "distance_km": round(dist, 1),
                        "dt_hours": round(dt_hours, 3),
                        "speed_kmh": round(dist / dt_hours, 1),
                        "tower_from": t_prev_norm,
                        "tower_to": t_cur_norm,
                    },
                    explanation=(
                        f"Entity apparently traversed {round(dist,0)} km in "
                        f"{round(dt_hours,2)} h — above {SPEED_LIMIT_KMH:.0f} km/h physical limit. "
                        "Indicates SIM relocation/roaming or spoofed telemetry."
                    ),
                ))

    # ── 3.5 Propagate contradiction onto affected co-location pair signals ──
    # An impossible-travel window for either entity invalidates the "same place
    # at the same time" co-location claim for that pair, so the fused hypothesis
    # score for the pair is penalised rather than inflated.
    overlap = timedelta(minutes=WINDOW_OVERLAP_BUFFER_MIN)
    for sig in signals:
        if sig.family != "spatial_temporal":
            continue
        ep = sig.entity_pair or {}
        for e in (ep.get("source"), ep.get("target")):
            if not e or e not in impossible_windows:
                continue
            if any(ist <= (sig.time_window_end + overlap)
                   and ien >= (sig.time_window_start - overlap)
                   for ist, ien, _ in impossible_windows[e]):
                sig.contradiction = True
                sig.contradiction_reason = impossible_windows[e][0][2]
                if sig.feature_details:
                    sig.feature_details = dict(sig.feature_details) | {"contradicted": True}
                sig.explanation = (sig.explanation or "") + " CONTRADICTED by impossible travel."
                break

    # Attach impossible-travel evidence to the co-location-style aggregation
    return signals


async def _load_direct_call_pairs(db: AsyncSession, case_id) -> set:
    result = await db.execute(
        select(Relationship).where(
            Relationship.case_id == case_id,
            Relationship.relationship_type.in_(["CALLED", "MESSAGED"]),
        )
    )
    pairs = set()
    for rel in result.scalars():
        pairs.add(frozenset((str(rel.source_entity_id), str(rel.target_entity_id))))
    return pairs