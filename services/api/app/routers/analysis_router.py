import uuid
import hashlib
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from app.database import get_db
from app.models.models import (
    AnalysisRun, SourceRecord, User, Job, JobStatus, Signal, Hypothesis
)
from app.auth.auth import get_current_user
from app.schemas.schemas import AnalysisRunResponse, SignalsResponse, SignalLite
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
    runs = result.scalars().all()

    counts: dict[uuid.UUID, dict] = {}
    if runs:
        run_ids = [r.id for r in runs]
        sig_result = await db.execute(
            select(
                Signal.analysis_run_id,
                func.count(Signal.id),
                func.sum(case((Signal.contradiction.is_(True), 1), else_=0)),
                func.sum(case((Signal.family == "engine_error", 1), else_=0)),
            )
            .where(Signal.analysis_run_id.in_(run_ids))
            .group_by(Signal.analysis_run_id)
        )
        for rid, total, contrad, engine_err in sig_result.all():
            counts[rid] = {
                "signal_count": total,
                "contradiction_count": contrad,
                "engine_error_count": engine_err,
            }
        hyp_result = await db.execute(
            select(Hypothesis.analysis_run_id, func.count(Hypothesis.id))
            .where(Hypothesis.analysis_run_id.in_(run_ids))
            .group_by(Hypothesis.analysis_run_id)
        )
        for rid, total in hyp_result.all():
            counts.setdefault(rid, {})["hypothesis_count"] = total

    resp = []
    for r in runs:
        c = counts.get(r.id, {})
        resp.append(
            AnalysisRunResponse(
                id=r.id,
                case_id=r.case_id,
                version=r.version,
                status=r.status.value if hasattr(r.status, "value") else r.status,
                started_at=r.started_at,
                completed_at=r.completed_at,
                configuration=r.configuration,
                created_at=r.created_at,
                signal_count=c.get("signal_count", 0),
                contradiction_count=c.get("contradiction_count", 0),
                hypothesis_count=c.get("hypothesis_count", 0),
                engine_error_count=c.get("engine_error_count", 0),
            )
        )
    return resp


@router.get("/{case_id}/signals", response_model=SignalsResponse)
async def list_signals(
    case_id: uuid.UUID,
    family: str = Query(None, description="Filter by signal family"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return signals from the latest analysis run for the case."""
    await check_case_membership(db, user.id, case_id)
    run_result = await db.execute(
        select(AnalysisRun).where(AnalysisRun.case_id == case_id).order_by(AnalysisRun.version.desc())
    )
    run = run_result.scalars().first()
    if not run:
        counts = {}
        if family:
            counts[family] = 0
        return SignalsResponse(
            run_id=uuid.uuid4(), run_version=0, status="none",
            counts_by_family=counts, signals=[],
        )

    query = select(Signal).where(Signal.case_id == case_id, Signal.analysis_run_id == run.id)
    if family:
        query = query.where(Signal.family == family)
    query = query.order_by(Signal.numeric_value.desc(), Signal.created_at.desc())
    sig_result = await db.execute(query)
    signals = sig_result.scalars().all()

    count_result = await db.execute(
        select(Signal.family, func.count(Signal.id))
        .where(Signal.case_id == case_id, Signal.analysis_run_id == run.id)
        .group_by(Signal.family)
    )
    counts = {f: c for f, c in count_result.all()}

    return SignalsResponse(
        run_id=run.id,
        run_version=run.version,
        status=run.status.value if hasattr(run.status, "value") else run.status,
        counts_by_family=counts,
        signals=[
            SignalLite(
                id=s.id,
                engine_name=s.engine_name,
                engine_version=s.engine_version,
                family=s.family,
                entity_pair=s.entity_pair or {},
                numeric_value=s.numeric_value,
                quality_factor=s.quality_factor,
                explanation=s.explanation,
                contributing_record_count=len(s.contributing_record_ids or []),
                feature_details=s.feature_details,
                contradiction=s.contradiction,
                contradiction_reason=s.contradiction_reason,
            )
            for s in signals
        ],
    )


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