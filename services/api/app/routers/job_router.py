import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import Job, User
from app.auth.auth import get_current_user
from app.schemas.schemas import JobResponse
from app.services.case_service import check_case_membership

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])


@router.get("/{case_id}", response_model=list[JobResponse])
async def list_jobs(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    result = await db.execute(
        select(Job).where(Job.case_id == case_id).order_by(Job.created_at.desc())
    )
    return [JobResponse.model_validate(j) for j in result.scalars().all()]


@router.get("/{case_id}/{job_id}", response_model=JobResponse)
async def get_job(
    case_id: uuid.UUID,
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.case_id == case_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse.model_validate(job)
