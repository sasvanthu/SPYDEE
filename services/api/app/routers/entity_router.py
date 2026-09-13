import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import Entity, Identifier, EntityIdentifierLink, EntityReviewDecision, User
from app.auth.auth import get_current_user
from app.schemas.schemas import EntityCreate, EntityResponse, EntityReviewRequest, IdentifierResponse
from app.services.case_service import check_case_membership, log_audit_event
from app.services.entity_service import get_entity_profile

router = APIRouter(prefix="/api/v1/entities", tags=["entities"])


@router.get("/{case_id}", response_model=list[EntityResponse])
async def list_entities(
    case_id: uuid.UUID,
    entity_type: str = None,
    search: str = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    query = select(Entity).where(Entity.case_id == case_id)
    if entity_type:
        query = query.where(Entity.entity_type == entity_type)
    if search:
        query = query.where(Entity.label.ilike(f"%{search}%"))
    result = await db.execute(query)
    entities = result.scalars().all()

    responses = []
    for e in entities:
        resp = EntityResponse.model_validate(e)
        link_result = await db.execute(
            select(EntityIdentifierLink)
            .join(Identifier)
            .where(EntityIdentifierLink.entity_id == e.id)
        )
        ids = []
        for link in link_result.scalars():
            id_result = await db.execute(select(Identifier).where(Identifier.id == link.identifier_id))
            ident = id_result.scalar_one_or_none()
            if ident:
                ids.append(IdentifierResponse(
                    id=ident.id,
                    id_type=ident.id_type,
                    id_value=ident.id_value,
                    normalized_value=ident.normalized_value,
                    review_state=link.review_state.value if link.review_state else "new",
                ))
        resp.identifiers = ids
        responses.append(resp)
    return responses


@router.get("/{case_id}/{entity_id}", response_model=dict)
async def get_entity(
    case_id: uuid.UUID,
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    profile = await get_entity_profile(db, entity_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Entity not found")
    return {
        "entity": EntityResponse.model_validate(profile["entity"]),
        "identifiers": profile["identifiers"],
    }


@router.post("/{case_id}", response_model=EntityResponse)
async def create_entity(
    case_id: uuid.UUID,
    req: EntityCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    entity = Entity(
        case_id=case_id,
        entity_type=req.entity_type,
        label=req.label,
        description=req.description,
    )
    db.add(entity)
    await log_audit_event(db, case_id, user.id, "entity_created", "entity", None)
    await db.commit()
    await db.refresh(entity)
    return EntityResponse.model_validate(entity)


@router.post("/{case_id}/{entity_id}/review")
async def review_entity(
    case_id: uuid.UUID,
    entity_id: uuid.UUID,
    req: EntityReviewRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    result = await db.execute(select(Entity).where(Entity.id == entity_id, Entity.case_id == case_id))
    entity = result.scalar_one_or_none()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    entity.review_state = req.decision
    decision = EntityReviewDecision(
        entity_id=entity_id,
        reviewer_id=user.id,
        decision=req.decision,
        note=req.note,
    )
    db.add(decision)
    await log_audit_event(db, case_id, user.id, "entity_reviewed", "entity", entity_id, {"decision": req.decision, "note": req.note})
    await db.commit()
    return {"message": "Review recorded"}
