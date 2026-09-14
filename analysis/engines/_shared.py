"""Shared deterministic helpers for SPYDEE analysis engines."""
import math
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Entity, Identifier, EntityIdentifierLink
from app.services.entity_service import (
    normalize_identifier,
    parse_datetime,
    canonical_hash,
)


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def score_round(value: float, ndigits: int = 4) -> float:
    return round(clamp01(value), ndigits)


async def load_id_entity_map(db: AsyncSession, case_id):
    """Return ``{(id_type, normalized_value): entity_id}`` for a case."""
    rows = await db.execute(
        select(Identifier.id_type, Identifier.normalized_value,
               EntityIdentifierLink.entity_id)
        .join(EntityIdentifierLink,
              EntityIdentifierLink.identifier_id == Identifier.id)
        .where(Identifier.case_id == case_id)
    )
    mapping = {}
    for id_type, norm, entity_id in rows.all():
        mapping[(id_type, norm)] = entity_id
    return mapping


async def load_entities(db: AsyncSession, case_id):
    rows = await db.execute(select(Entity).where(Entity.case_id == case_id))
    return rows.scalars().all()


def entity_matches(id_map, id_type: str, raw_value) -> Optional[str]:
    """Resolve a raw identifier value to an entity id, case-safely."""
    if raw_value is None or str(raw_value) == "":
        return None
    norm = normalize_identifier(id_type, str(raw_value))
    return id_map.get((id_type, norm))


def pair_key(src: str, tgt: str) -> tuple:
    return tuple(sorted([str(src), str(tgt)]))


def entity_pair_json(src: str, tgt: str) -> dict:
    a, b = pair_key(src, tgt)
    return {"source": a, "target": b}


def percentage(part: float, total: float) -> float:
    if total <= 0:
        return 0.0
    return min(1.0, part / total)


def simple_cycles_deterministic(graph) -> list:
    """Return simple cycles of length 3..5 in deterministic order."""
    cycles = []
    try:
        for c in graph.simple_cycles():
            if 3 <= len(c) <= 5:
                cycles.append(c)
    except Exception:
        return []
    seen = set()
    unique = []
    for c in cycles:
        canon = tuple(sorted(c))
        if canon not in seen:
            seen.add(canon)
            unique.append(c)
    return sorted(unique, key=lambda c: (len(c), c))