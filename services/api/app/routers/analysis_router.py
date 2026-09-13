import uuid
import hashlib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import (
    AnalysisRun, Signal, Hypothesis, HypothesisSignal,
    Entity, Relationship, SourceRecord, Event, User, Job, JobStatus
)
from app.auth.auth import get_current_user
from app.schemas.schemas import AnalysisRunResponse
from app.services.case_service import check_case_membership, log_audit_event

router = APIRouter(prefix="/api/v1/analysis", tags=["analysis"])


@router.post("/{case_id}/run", response_model=AnalysisRunResponse)
async def start_analysis(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)

    records_result = await db.execute(
        select(SourceRecord).where(SourceRecord.case_id == case_id, SourceRecord.is_duplicate == False)
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
        configuration={"weights": {"communication": 0.20, "device_sim": 0.25, "spatial_temporal": 0.15, "writing_style": 0.15, "financial": 0.15, "infrastructure": 0.10}},
        status="queued",
    )
    db.add(run)

    job = Job(
        case_id=case_id,
        job_type="analysis",
        status=JobStatus.QUEUED,
        payload={"analysis_run_id": None},
    )
    db.add(job)
    await db.flush()
    job.payload = {"analysis_run_id": str(run.id)}

    run.status = "running"
    run.started_at = __import__("datetime").datetime.utcnow()

    await _run_analysis_logic(db, case_id, run, records)

    run.status = "completed"
    run.completed_at = __import__("datetime").datetime.utcnow()
    job.status = JobStatus.COMPLETED
    job.completed_at = run.completed_at

    await log_audit_event(db, case_id, user.id, "analysis_run", "analysis_run", run.id, {"version": version})
    await db.commit()
    await db.refresh(run)
    return AnalysisRunResponse.model_validate(run)


async def _run_analysis_logic(db, case_id, run, records):
    from analysis.engines.communication_engine import analyze_communication
    from analysis.engines.graph_engine import analyze_graph_structure
    from analysis.scoring.hypothesis_engine import generate_hypotheses

    signals = []
    signals.extend(await analyze_communication(db, case_id, run.id, records))
    signals.extend(await analyze_graph_structure(db, case_id, run.id, records))

    for sig in signals:
        db.add(sig)
    await db.flush()

    hypotheses = await generate_hypotheses(db, case_id, run.id, signals)
    for hyp in hypotheses:
        db.add(hyp)
    await db.flush()

    for hyp in hypotheses:
        for sig in signals:
            if _signal_contributes_to_hypothesis(sig, hyp):
                hs = HypothesisSignal(
                    hypothesis_id=hyp.id,
                    signal_id=sig.id,
                    weight=1.0,
                    contribution=sig.numeric_value * sig.quality_factor,
                )
                db.add(hs)
    await db.flush()


def _signal_contributes_to_hypothesis(signal, hypothesis):
    sp = signal.entity_pair or {}
    if sp.get("source") == str(hypothesis.source_entity_id) and sp.get("target") == str(hypothesis.target_entity_id):
        return True
    if sp.get("source") == str(hypothesis.target_entity_id) and sp.get("target") == str(hypothesis.source_entity_id):
        return True
    return False


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
