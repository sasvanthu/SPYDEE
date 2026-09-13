import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.models import (
    Case, CaseMembership, User, AuditEvent, UserRole
)


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
        raise ValueError("Not a member of this case")
    return membership


async def check_case_write_access(db: AsyncSession, user: User, case_id: uuid.UUID):
    membership = await check_case_membership(db, user.id, case_id)
    if membership.role == UserRole.INVESTIGATOR:
        result = await db.execute(select(Case).where(Case.id == case_id))
        case = result.scalar_one_or_none()
        if case and case.status.value == "archived":
            raise ValueError("Case is archived and read-only")
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
