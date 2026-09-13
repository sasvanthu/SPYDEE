import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import User, Relationship, RelationshipEvidence, SourceRecord
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
    await check_case_membership(db, user.id, case_id)
    rel_result = await db.execute(
        select(Relationship).where(Relationship.id == rel_id, Relationship.case_id == case_id)
    )
    rel = rel_result.scalar_one_or_none()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")

    ev_result = await db.execute(
        select(RelationshipEvidence)
        .join(SourceRecord)
        .where(RelationshipEvidence.relationship_id == rel_id)
    )
    evidence = []
    for ev in ev_result.scalars():
        sr_result = await db.execute(
            select(SourceRecord).where(SourceRecord.id == ev.source_record_id)
        )
        sr = sr_result.scalar_one_or_none()
        evidence.append({
            "id": str(ev.id),
            "source_record_id": str(ev.source_record_id),
            "weight": ev.weight,
            "record_data": sr.original_content if sr else None,
        })

    return {
        "relationship_id": str(rel.id),
        "relationship_type": rel.relationship_type,
        "classification": rel.classification,
        "evidence": evidence,
    }
