import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import (
    Case, Hypothesis, Signal, Entity, Relationship,
    ReviewAction, AnalysisRun, AuditEvent
)


async def generate_report(
    db: AsyncSession,
    case_id: uuid.UUID,
    title: str,
    include_hypotheses: List[uuid.UUID] = None,
    include_unresolved: bool = True,
    analysis_run_id: uuid.UUID = None,
    generated_by: uuid.UUID = None,
) -> dict:
    case_result = await db.execute(select(Case).where(Case.id == case_id))
    case = case_result.scalar_one_or_none()
    if not case:
        raise ValueError("Case not found")

    case_result2 = await db.execute(
        select(AnalysisRun).where(AnalysisRun.case_id == case_id).order_by(AnalysisRun.created_at.desc())
    )
    runs = case_result2.scalars().all()
    run = runs[0] if runs else None

    hyp_query = select(Hypothesis).where(Hypothesis.case_id == case_id)
    if include_hypotheses:
        hyp_query = hyp_query.where(Hypothesis.id.in_(include_hypotheses))
    hyp_result = await db.execute(hyp_query)
    hypotheses = hyp_result.scalars().all()

    entity_result = await db.execute(
        select(Entity).where(Entity.case_id == case_id)
    )
    entities = entity_result.scalars().all()

    rel_result = await db.execute(
        select(Relationship).where(Relationship.case_id == case_id)
    )
    relationships = rel_result.scalars().all()

    review_result = await db.execute(
        select(ReviewAction).where(ReviewAction.case_id == case_id).order_by(ReviewAction.created_at)
    )
    reviews = review_result.scalars().all()

    report_content = {
        "case": {
            "title": case.title,
            "code": case.case_code,
            "is_synthetic": case.is_synthetic,
            "status": case.status.value,
        },
        "generated_at": datetime.utcnow().isoformat(),
        "analysis_version": run.version if run else None,
        "summary": {
            "total_entities": len(entities),
            "total_relationships": len(relationships),
            "total_hypotheses": len(hypotheses),
        },
        "hypotheses": [],
        "review_decisions": [],
        "limitations": [
            "This is an AI-assisted analysis report. Findings are evidence-strength indices, not proof of guilt or identity.",
            "All relationships and hypotheses require human review before any investigative action.",
            "Analysis was performed on available evidence only; missing data limits conclusions.",
        ],
    }

    for h in hypotheses:
        hyp_data = {
            "id": str(h.id),
            "stable_key": h.stable_key,
            "hypothesis_type": h.hypothesis_type,
            "entity_pair": h.entity_pair,
            "notes": h.notes,
            "numeric_value": h.numeric_value,
            "quality_factor": h.quality_factor,
            "state": h.state.value if h.state else None,
            "review_state": h.review_state.value if h.review_state else None,
            "contributing_signal_highlights": h.contributing_signal_highlights or [],
            "timestamp_hypothesis_generated": h.timestamp_hypothesis_generated.isoformat()
            if h.timestamp_hypothesis_generated else None,
        }
        report_content["hypotheses"].append(hyp_data)

    for r in reviews:
        report_content["review_decisions"].append({
            "action": r.action,
            "note": r.note,
            "reviewer_id": str(r.reviewer_id),
            "created_at": r.created_at.isoformat(),
        })

    return report_content
