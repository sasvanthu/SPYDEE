import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.models import (
    Case, CaseMembership, User, Entity, Relationship,
    Hypothesis, EvidenceFile, AuditEvent, UserRole, CaseStatus
)
from app.auth.auth import get_current_user
from app.schemas.schemas import (
    CaseCreate, CaseResponse, CaseUpdate, MembershipGrant
)
from app.services.case_service import (
    check_case_membership, check_supervisor_access, check_case_write_access, log_audit_event
)

router = APIRouter(prefix="/api/v1/cases", tags=["cases"])


@router.post("", response_model=CaseResponse)
async def create_case(
    req: CaseCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    existing = await db.execute(select(Case).where(Case.case_code == req.case_code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Case code already exists")

    case = Case(
        title=req.title,
        case_code=req.case_code,
        description=req.description,
        created_by=user.id,
    )
    db.add(case)
    await db.flush()

    membership = CaseMembership(
        case_id=case.id,
        user_id=user.id,
        role=user.role,
        granted_by=user.id,
    )
    db.add(membership)
    await log_audit_event(db, case.id, user.id, "case_created", "case", case.id)
    await db.commit()
    await db.refresh(case)
    return CaseResponse.model_validate(case)


@router.get("", response_model=list[CaseResponse])
async def list_cases(
    status: str = None,
    search: str = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = (
        select(Case)
        .join(CaseMembership)
        .where(
            CaseMembership.user_id == user.id,
            CaseMembership.revoked_at.is_(None),
        )
    )
    if status:
        query = query.where(Case.status == status)
    if search:
        query = query.where(Case.title.ilike(f"%{search}%"))

    result = await db.execute(query)
    cases = result.scalars().all()

    responses = []
    for case in cases:
        resp = CaseResponse.model_validate(case)
        ent_count = await db.execute(
            select(func.count()).where(Entity.case_id == case.id)
        )
        resp.entity_count = ent_count.scalar()
        rel_count = await db.execute(
            select(func.count()).where(Relationship.case_id == case.id)
        )
        resp.event_count = rel_count.scalar()
        ev_count = await db.execute(
            select(func.count()).where(EvidenceFile.case_id == case.id)
        )
        resp.evidence_count = ev_count.scalar()
        hyp_count = await db.execute(
            select(func.count()).where(Hypothesis.case_id == case.id)
        )
        resp.hypothesis_count = hyp_count.scalar()
        responses.append(resp)

    return responses


@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    resp = CaseResponse.model_validate(case)
    ent_count = await db.execute(select(func.count()).where(Entity.case_id == case.id))
    resp.entity_count = ent_count.scalar()
    rel_count = await db.execute(select(func.count()).where(Relationship.case_id == case.id))
    resp.event_count = rel_count.scalar()
    ev_count = await db.execute(select(func.count()).where(EvidenceFile.case_id == case.id))
    resp.evidence_count = ev_count.scalar()
    hyp_count = await db.execute(select(func.count()).where(Hypothesis.case_id == case.id))
    resp.hypothesis_count = hyp_count.scalar()
    return resp


@router.patch("/{case_id}", response_model=CaseResponse)
async def update_case(
    case_id: uuid.UUID,
    req: CaseUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_write_access(db, user, case_id)
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if req.status and req.status == CaseStatus.ARCHIVED.value:
        await check_supervisor_access(db, user, case_id)

    if req.title:
        case.title = req.title
    if req.description is not None:
        case.description = req.description
    if req.status:
        case.status = req.status

    await log_audit_event(db, case.id, user.id, "case_updated", "case", case.id, {"updates": req.model_dump(exclude_unset=True)})
    await db.commit()
    await db.refresh(case)
    return CaseResponse.model_validate(case)


@router.post("/{case_id}/members", response_model=dict)
async def add_member(
    case_id: uuid.UUID,
    req: MembershipGrant,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_supervisor_access(db, user, case_id)

    target_result = await db.execute(select(User).where(User.id == req.user_id))
    if not target_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    grant_role = UserRole(req.role)
    if grant_role == UserRole.CASE_SUPERVISOR and user.role != UserRole.ADMINISTRATOR:
        raise HTTPException(status_code=403, detail="Only administrators can grant case supervisor role")

    existing = await db.execute(
        select(CaseMembership).where(
            CaseMembership.case_id == case_id,
            CaseMembership.user_id == req.user_id,
            CaseMembership.revoked_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already a member")

    membership = CaseMembership(
        case_id=case_id,
        user_id=req.user_id,
        role=req.role,
        granted_by=user.id,
    )
    db.add(membership)
    await log_audit_event(db, case_id, user.id, "member_added", "membership", user_id=req.user_id)
    await db.commit()
    return {"message": "Member added"}
