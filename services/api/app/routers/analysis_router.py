import uuid
import hashlib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import (
    AnalysisRun, SourceRecord, User, Job, JobStatus
)
from app.auth.auth import get_current_user
from app.schemas.schemas import AnalysisRunResponse
from app.services.case_service import check_case_membership, check_case_write_access, log_audit_event
from app.services.analysis_service import run_analysis

router = APIRouter(prefix="/api/v1/analysis", tags=["analysis"])


@router.post("/{case_id}/run", response_model=AnalysisRunResponse)
async def start_analysis(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_write_access(db, user, case_id)

    records_result = await db.execute(
        select(SourceRecord).where(SourceRecord.case_id == case_id, SourceRecord.is_duplicate == False)  # noqa: E712
    )
    records = records_result.scalars().all()
    input_hash = hashlib.sha256(str([r.normalized_hash for r in records]).encode()).hexdigest()

    version_result = await db.execute(
        select(AnalysisRun).where(AnalysisRun.case_id == case_id).order_by(AnalysisRun.version.desc())
    )
    last_run = version_result.scalars().first()
    version = (last_run.version + 1) if last_run else 1

    run = AnalysisRun(
        case_id=case_id,
        version=version,
        input_hash=input_hash,
        configuration={
            "weights": {
                "communication": 0.20, "device_sim": 0.20, "spatial_temporal": 0.15,
                "writing_style": 0.15, "financial": 0.10, "infrastructure": 0.10,
                "network_topology": 0.10,
            }
        },
        status=JobStatus.QUEUED,
    )
    db.add(run)
    await db.flush()

    job = Job(
        case_id=case_id,
        job_type="analysis",
        status=JobStatus.QUEUED,
        payload={"analysis_run_id": str(run.id)},
    )
    db.add(job)
    await db.flush()

    stats = await run_analysis(db, run, records)
    job.status = JobStatus.COMPLETED
    job.completed_at = run.completed_at

    await log_audit_event(
        db, case_id, user.id, "analysis_run", "analysis_run", run.id,
        {"version": version, **stats},
    )
    await db.commit()
    await db.refresh(run)
    return AnalysisRunResponse.model_validate(run)


@router.get("/{case_id}", response_model=list[AnalysisRunResponse])
async def list_runs(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    result = await db.execute(
        select(AnalysisRun).where(AnalysisRun.case_id == case_id).order_by(AnalysisRun.created_at.desc())
    )
    return [AnalysisRunResponse.model_validate(r) for r in result.scalars().all()]


@router.get("/{case_id}/{run_id}", response_model=AnalysisRunResponse)
async def get_run(
    case_id: uuid.UUID,
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    result = await db.execute(
        select(AnalysisRun).where(AnalysisRun.id == run_id, AnalysisRun.case_id == case_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Analysis run not found")
    return AnalysisRunResponse.model_validate(run)