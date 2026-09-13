import uuid
from collections import defaultdict
from datetime import datetime
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.models import (
    SourceRecord, Entity, EntityIdentifierLink, Identifier,
    Signal, Event, EventParticipant
)


async def analyze_communication(
    db: AsyncSession,
    case_id: uuid.UUID,
    analysis_run_id: uuid.UUID,
    records: List[SourceRecord],
) -> List[Signal]:
    signals = []

    cdr_records = []
    for r in records:
        content = r.normalized_content
        if "caller_id" in content or "callee_id" in content:
            cdr_records.append(r)

    if not cdr_records:
        return signals

    pairwise = defaultdict(lambda: {"count": 0, "total_duration": 0, "records": [], "first": None, "last": None})

    for r in cdr_records:
        c = r.normalized_content
        caller = c.get("caller_id", "")
        callee = c.get("callee_id", "")
        if not caller or not callee:
            continue

        caller_norm = caller.strip().lower().replace("+", "").replace("-", "").replace(" ", "")
        callee_norm = callee.strip().lower().replace("+", "").replace("-", "").replace(" ", "")

        key = tuple(sorted([caller_norm, callee_norm]))
        duration = c.get("duration_seconds", 0) or 0

        pairwise[key]["count"] += 1
        pairwise[key]["total_duration"] += float(duration)
        pairwise[key]["records"].append(str(r.id))

        ts = c.get("start_time", "")
        if ts:
            if pairwise[key]["first"] is None or ts < pairwise[key]["first"]:
                pairwise[key]["first"] = ts
            if pairwise[key]["last"] is None or ts > pairwise[key]["last"]:
                pairwise[key]["last"] = ts

    entity_map = await _build_entity_identifier_map(db, case_id)

    for (a, b), data in pairwise.items():
        if data["count"] < 2:
            continue

        ea = entity_map.get(a)
        eb = entity_map.get(b)
        if not ea or not eb or ea == eb:
            continue

        count_score = min(data["count"] / 20.0, 1.0)
        duration_score = min(data["total_duration"] / 3600.0, 1.0) if data["total_duration"] > 0 else 0
        s_f = 0.6 * count_score + 0.4 * duration_score

        quality = min(1.0, 0.5 + data["count"] * 0.05)

        signals.append(Signal(
            case_id=case_id,
            analysis_run_id=analysis_run_id,
            engine_name="communication",
            engine_version="v1",
            entity_pair={"source": str(ea), "target": str(eb)},
            family="communication",
            contributing_record_ids=data["records"][:20],
            time_window_start=_parse_time(data["first"]),
            time_window_end=_parse_time(data["last"]),
            numeric_value=round(s_f, 4),
            quality_factor=round(quality, 4),
            feature_details={
                "call_count": data["count"],
                "total_duration_seconds": data["total_duration"],
                "avg_duration": round(data["total_duration"] / data["count"], 1) if data["count"] else 0,
            },
            explanation=f"Pair communicated {data['count']} times with total {data['total_duration']:.0f}s duration.",
        ))

    return signals


async def _build_entity_identifier_map(db, case_id):
    result = await db.execute(
        select(EntityIdentifierLink)
        .join(Identifier)
        .where(EntityIdentifierLink.entity_id.isnot(None))
    )
    links = result.scalars().all()
    entity_map = {}
    for link in links:
        id_result = await db.execute(select(Identifier).where(Identifier.id == link.identifier_id))
        ident = id_result.scalar_one_or_none()
        if ident and ident.case_id == case_id:
            norm = ident.normalized_value.strip().lower().replace("+", "").replace("-", "").replace(" ", "")
            entity_map[norm] = link.entity_id
    return entity_map


def _parse_time(ts):
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00").split("+")[0])
    except (ValueError, AttributeError):
        return None
