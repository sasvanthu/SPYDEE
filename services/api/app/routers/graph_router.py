import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import (
    User, Relationship, RelationshipEvidence, SourceRecord, Event, EventParticipant,
)
from app.auth.auth import get_current_user
from app.schemas.schemas import GraphFilter, GraphResponse, SavedViewCreate, SavedViewResponse
from app.services.case_service import check_case_membership
from app.services.graph_service import build_case_graph, find_shortest_path, get_neighbourhood

router = APIRouter(prefix="/api/v1/graph", tags=["graph"])


@router.post("/{case_id}", response_model=GraphResponse)
async def get_graph(
    case_id: uuid.UUID,
    filters: GraphFilter = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    f = filters or GraphFilter()
    data = await build_case_graph(
        db, case_id,
        entity_types=f.entity_types,
        relationship_types=f.relationship_types,
        date_from=f.date_from,
        date_to=f.date_to,
        include_inferred=f.include_inferred,
        max_nodes=f.max_nodes,
        max_edges=f.max_edges,
    )
    return GraphResponse(**data)


@router.get("/{case_id}/neighbourhood/{entity_id}")
async def get_entity_neighbourhood(
    case_id: uuid.UUID,
    entity_id: uuid.UUID,
    hops: int = 1,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    data = await get_neighbourhood(db, case_id, entity_id, hops=min(hops, 3))
    return data


@router.get("/{case_id}/path")
async def get_path(
    case_id: uuid.UUID,
    source_id: uuid.UUID,
    target_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    result = await find_shortest_path(db, case_id, source_id, target_id)
    if not result:
        return {"path": None, "message": "No path found"}
    return result


@router.get("/{case_id}/relationship/{rel_id}/evidence")
async def get_relationship_evidence(
    case_id: uuid.UUID,
    rel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return supporting evidence for a (possibly aggregated) relationship.

    The graph aggregates multiple relationship rows per (source, target) pair.
    Evidence is looked up across every row of that pair. When no explicit
    ``RelationshipEvidence`` links exist (e.g. demo-seeded cases), fall back to
    events whose participants match both endpoints.
    """
    await check_case_membership(db, user.id, case_id)
    rel_result = await db.execute(
        select(Relationship).where(Relationship.id == rel_id, Relationship.case_id == case_id)
    )
    rel = rel_result.scalar_one_or_none()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")

    pair_result = await db.execute(
        select(Relationship).where(
            Relationship.case_id == case_id,
            Relationship.source_entity_id == rel.source_entity_id,
            Relationship.target_entity_id == rel.target_entity_id,
            Relationship.relationship_type == rel.relationship_type,
        )
    )
    pair_rels = pair_result.scalars().all()
    pair_ids = [r.id for r in pair_rels]
    evidence_count = sum(r.evidence_count or 1 for r in pair_rels)

    evidence = []
    if pair_ids:
        ev_result = await db.execute(
            select(RelationshipEvidence, SourceRecord)
            .join(SourceRecord, SourceRecord.id == RelationshipEvidence.source_record_id)
            .where(RelationshipEvidence.relationship_id.in_(pair_ids))
        )
        for ev, sr in ev_result.all():
            evidence.append({
                "id": str(ev.id),
                "source_record_id": str(sr.id),
                "weight": ev.weight,
                "record_data": sr.original_content,
            })

    if not evidence:
        evsrc_result = await db.execute(
            select(Event, SourceRecord, EventParticipant)
            .join(EventParticipant, EventParticipant.event_id == Event.id)
            .outerjoin(SourceRecord, Event.source_record_id == SourceRecord.id)
            .where(
                Event.case_id == case_id,
                EventParticipant.entity_id.in_([rel.source_entity_id, rel.target_entity_id]),
            )
        )
        src_id = str(rel.source_entity_id)
        tgt_id = str(rel.target_entity_id)
        per_event: dict = {}
        for event, sr, participant in evsrc_result.all():
            pid = str(participant.entity_id)
            if pid not in (src_id, tgt_id):
                continue
            entry = per_event.get(event.id)
            if entry is None:
                entry = per_event[event.id] = {
                    "id": str(event.id),
                    "source_record_id": str(sr.id) if sr else None,
                    "event_type": event.event_type,
                    "start_time": event.start_time.isoformat() if event.start_time else None,
                    "record_data": sr.original_content if sr else {},
                    "participants": set(),
                }
            entry["participants"].add(pid)
        evidence = [
            {
                "id": f"event-{e['id']}",
                "source_record_id": e["source_record_id"],
                "weight": 1.0,
                "event_type": e["event_type"],
                "start_time": e["start_time"],
                "record_data": e["record_data"],
                "participants": sorted(p for p in e["participants"]),
            }
            for e in per_event.values()
            if {src_id, tgt_id} <= e["participants"]
        ]

    return {
        "relationship_id": str(rel.id),
        "relationship_type": rel.relationship_type,
        "classification": rel.classification,
        "evidence_count": evidence_count,
        "evidence": evidence,
    }
