import uuid
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.models import (
    Case, CaseMembership, User, AuditEvent, UserRole, CaseStatus
)

SUPERVISOR_ROLES = (UserRole.CASE_SUPERVISOR, UserRole.ADMINISTRATOR)


async def check_case_membership(db: AsyncSession, user_id: uuid.UUID, case_id: uuid.UUID) -> CaseMembership:
    result = await db.execute(
        select(CaseMembership).where(
            CaseMembership.case_id == case_id,
            CaseMembership.user_id == user_id,
            CaseMembership.revoked_at.is_(None),
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this case")
    return membership


async def check_case_write_access(db: AsyncSession, user: User, case_id: uuid.UUID) -> CaseMembership:
    """Membership check that also blocks edits on archived cases for investigators."""
    membership = await check_case_membership(db, user.id, case_id)
    if membership.role == UserRole.INVESTIGATOR:
        result = await db.execute(select(Case).where(Case.id == case_id))
        case = result.scalar_one_or_none()
        if case and case.status.value == CaseStatus.ARCHIVED.value:
            raise HTTPException(status_code=403, detail="Case is archived and read-only")
    return membership


async def check_supervisor_access(db: AsyncSession, user: User, case_id: uuid.UUID) -> CaseMembership:
    """Membership check restricted to case supervisors and administrators for
    membership management and case lifecycle transitions."""
    membership = await check_case_membership(db, user.id, case_id)
    if membership.role not in SUPERVISOR_ROLES:
        raise HTTPException(status_code=403, detail="Requires case supervisor or administrator role")
    return membership


async def log_audit_event(
    db: AsyncSession,
    case_id: uuid.UUID,
    user_id: uuid.UUID,
    action: str,
    resource_type: str = None,
    resource_id: uuid.UUID = None,
    details: dict = None,
):
    event = AuditEvent(
        case_id=case_id,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
    )
    db.add(event)
    await db.flush()
    return event
