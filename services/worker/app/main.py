import asyncio
import logging
import uuid
import os
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("spydee-worker")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://spydee:spydee_dev_pass@localhost:5432/spydee")

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

CLAIM_TIMEOUT_MINUTES = 10
POLL_INTERVAL_SECONDS = 5


async def claim_next_job(db: AsyncSession):
    """Atomically claim the oldest queueable job using FOR UPDATE SKIP LOCKED."""
    from app.models.models import Job, JobStatus
    result = await db.execute(
        select(Job)
        .where(
            Job.status == JobStatus.QUEUED,
            (Job.claim_expires_at.is_(None)) | (Job.claim_expires_at < datetime.utcnow()),
        )
        .order_by(Job.created_at)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    job = result.scalar_one_or_none()
    if job:
        job.status = JobStatus.RUNNING
        job.started_at = datetime.utcnow()
        job.claimed_by = f"worker-{uuid.uuid4().hex[:8]}"
        job.claim_expires_at = datetime.utcnow() + timedelta(minutes=CLAIM_TIMEOUT_MINUTES)
    return job


async def process_job(job_id: uuid.UUID):
    from app.models.models import Job, JobStatus
    async with async_session() as db:
        result = await db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if not job:
            return

        try:
            if job.job_type == "analysis":
                await process_analysis_job(db, job)
            elif job.job_type == "import":
                await process_import_job(db, job)
            else:
                raise ValueError(f"Unknown job type: {job.job_type}")

            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.utcnow()
        except Exception as e:
            logger.error(f"Job {job_id} ({job.job_type}) failed: {e}", exc_info=True)
            job.error_message = str(e)
            if job.retry_count < job.max_retries:
                job.retry_count += 1
                job.status = JobStatus.QUEUED
                job.claim_expires_at = None
            else:
                job.status = JobStatus.FAILED

        await db.commit()


async def process_analysis_job(db: AsyncSession, job):
    from app.models.models import AnalysisRun, SourceRecord
    from app.services.analysis_service import run_analysis

    run_id = (job.payload or {}).get("analysis_run_id")
    if not run_id:
        raise ValueError("No analysis_run_id in job payload")

    result = await db.execute(select(AnalysisRun).where(AnalysisRun.id == uuid.UUID(run_id)))
    run = result.scalar_one_or_none()
    if not run:
        raise ValueError("Analysis run not found")

    records_result = await db.execute(
        select(SourceRecord).where(
            SourceRecord.case_id == run.case_id,
            SourceRecord.is_duplicate == False,  # noqa: E712
        )
    )
    records = records_result.scalars().all()

    stats = await run_analysis(db, run, records)
    job.result = stats
    logger.info(
        f"Analysis run {run.id} completed: {stats.get('signals')} signals, "
        f"{stats.get('hypotheses')} hypotheses"
    )


async def process_import_job(db: AsyncSession, job):
    from app.models.models import Import, EvidenceFile, JobStatus
    from app.services.evidence_service import process_evidence_file

    payload = job.payload or {}
    import_id = payload.get("import_id")
    evidence_file_id = payload.get("evidence_file_id")
    if not import_id:
        raise ValueError("No import_id in job payload")

    import_result = await db.execute(select(Import).where(Import.id == uuid.UUID(import_id)))
    import_obj = import_result.scalar_one_or_none()
    if not import_obj:
        raise ValueError("Import not found")

    evidence_result = await db.execute(select(EvidenceFile).where(EvidenceFile.id == import_obj.evidence_file_id))
    evidence_file = evidence_result.scalar_one_or_none()
    if not evidence_file:
        raise ValueError("Evidence file not found")

    await process_evidence_file(db, evidence_file, import_obj.case_id, import_obj)

    job.result = {
        "accepted_count": import_obj.accepted_count,
        "rejected_count": import_obj.rejected_count,
    }
    logger.info(
        f"Import {import_obj.id} completed: {import_obj.accepted_count} accepted, "
        f"{import_obj.rejected_count} rejected"
    )


async def poll_for_jobs():
    from app.models.models import Job
    logger.info("Worker started, polling for jobs...")
    while True:
        try:
            async with async_session() as db:
                job = await claim_next_job(db)
                if job:
                    await db.commit()
                    job_id = job.id
                    logger.info(f"Processing job {job_id} ({job.job_type})")
                    await process_job(job_id)
        except Exception as e:
            logger.error(f"Poll cycle error: {e}")

        await asyncio.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    asyncio.run(poll_for_jobs())