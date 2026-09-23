import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import AuditEvent, User
from app.auth.auth import get_current_user
from app.schemas.schemas import AuditEventResponse
from app.services.case_service import check_case_membership

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


@router.get("/{case_id}", response_model=list[AuditEventResponse])
async def get_audit_log(
    case_id: uuid.UUID,
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    result = await db.execute(
        select(AuditEvent)
        .where(AuditEvent.case_id == case_id)
        .order_by(AuditEvent.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return [AuditEventResponse.model_validate(e) for e in result.scalars().all()]
