import asyncio
import logging
import uuid
import os
from datetime import datetime, timedelta
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("spydee-worker")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://spydee:spydee_dev_pass@localhost:5432/spydee")

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

CLAIM_TIMEOUT_MINUTES = 10
POLL_INTERVAL_SECONDS = 5


async def process_job(job_id: uuid.UUID):
    from app.models.models import Job, AnalysisRun, EvidenceFile, Import, SourceRecord

    async with async_session() as db:
        result = await db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if not job:
            return

        job.status = "running"
        job.started_at = datetime.utcnow()
        job.claimed_by = f"worker-{uuid.uuid4().hex[:8]}"
        job.claim_expires_at = datetime.utcnow() + timedelta(minutes=CLAIM_TIMEOUT_MINUTES)
        await db.commit()

        try:
            if job.job_type == "analysis":
                await process_analysis_job(db, job)
            elif job.job_type == "import":
                await process_import_job(db, job)
            else:
                job.status = "failed"
                job.error_message = f"Unknown job type: {job.job_type}"

            job.status = "completed"
            job.completed_at = datetime.utcnow()
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}")
            job.status = "failed"
            job.error_message = str(e)
            if job.retry_count < job.max_retries:
                job.retry_count += 1
                job.status = "queued"

        await db.commit()


async def process_analysis_job(db, job):
    from app.models.models import AnalysisRun, SourceRecord
    from analysis.engines.communication_engine import analyze_communication
    from analysis.engines.graph_engine import analyze_graph_structure
    from analysis.scoring.hypothesis_engine import generate_hypotheses

    run_id = job.payload.get("analysis_run_id")
    if not run_id:
        raise ValueError("No analysis_run_id in job payload")

    result = await db.execute(select(AnalysisRun).where(AnalysisRun.id == uuid.UUID(run_id)))
    run = result.scalar_one_or_none()
    if not run:
        raise ValueError("Analysis run not found")

    records_result = await db.execute(
        select(SourceRecord).where(
            SourceRecord.case_id == run.case_id,
            SourceRecord.is_duplicate == False,
        )
    )
    records = records_result.scalars().all()

    signals = []
    signals.extend(await analyze_communication(db, run.case_id, run.id, records))
    signals.extend(await analyze_graph_structure(db, run.case_id, run.id, records))

    for sig in signals:
        db.add(sig)
    await db.flush()

    hypotheses = await generate_hypotheses(db, run.case_id, run.id, signals)
    for hyp in hypotheses:
        db.add(hyp)
    await db.flush()

    run.status = "completed"
    run.completed_at = datetime.utcnow()


async def process_import_job(db, job):
    pass


async def poll_for_jobs():
    from app.models.models import Job

    logger.info("Worker started, polling for jobs...")
    while True:
        try:
            async with async_session() as db:
                result = await db.execute(
                    select(Job).where(
                        Job.status == "queued",
                        Job.claim_expires_at.is_(None) | (Job.claim_expires_at < datetime.utcnow()),
                    ).order_by(Job.created_at).limit(1)
                )
                job = result.scalar_one_or_none()
                if job:
                    logger.info(f"Processing job {job.id} ({job.job_type})")
                    await process_job(job.id)
        except Exception as e:
            logger.error(f"Poll cycle error: {e}")

        await asyncio.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    asyncio.run(poll_for_jobs())
