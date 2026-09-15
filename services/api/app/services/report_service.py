import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import (
    Case, Hypothesis, Signal, Entity, Relationship,
    ReviewAction, AnalysisRun, Contradiction, Lead, InformationGap,
    InvestigationAction, EvidenceFile, SourceRecord,
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

    run_query = select(AnalysisRun).where(AnalysisRun.case_id == case_id).order_by(AnalysisRun.created_at.desc())
    runs = (await db.execute(run_query)).scalars().all()
    run = None
    if analysis_run_id:
        run = (await db.execute(select(AnalysisRun).where(AnalysisRun.id == analysis_run_id))).scalar_one_or_none()
    if run is None and runs:
        run = runs[0]
    selected_run_id = analysis_run_id or (run.id if run else None)

    hyp_query = select(Hypothesis).where(Hypothesis.case_id == case_id)
    if include_hypotheses:
        hyp_query = hyp_query.where(Hypothesis.id.in_(include_hypotheses))
    hyp_query = hyp_query.order_by(Hypothesis.numeric_value.desc())
    hypotheses = (await db.execute(hyp_query)).scalars().all()

    entities = (await db.execute(select(Entity).where(Entity.case_id == case_id))).scalars().all()
    relationships = (await db.execute(select(Relationship).where(Relationship.case_id == case_id))).scalars().all()
    reviews = (await db.execute(
        select(ReviewAction).where(ReviewAction.case_id == case_id).order_by(ReviewAction.created_at)
    )).scalars().all()

    contradict_rows = (await db.execute(
        select(Contradiction).where(Contradiction.case_id == case_id).order_by(Contradiction.created_at.desc())
    )).scalars().all()
    leads = (await db.execute(
        select(Lead).where(Lead.case_id == case_id).order_by(Lead.created_at.desc())
    )).scalars().all()
    gaps = (await db.execute(
        select(InformationGap).where(InformationGap.case_id == case_id).order_by(InformationGap.created_at.desc())
    )).scalars().all()
    actions = (await db.execute(
        select(InvestigationAction).where(InvestigationAction.case_id == case_id).order_by(InvestigationAction.created_at.desc())
    )).scalars().all()
    evidence_files = (await db.execute(
        select(EvidenceFile).where(EvidenceFile.case_id == case_id).order_by(EvidenceFile.created_at.desc())
    )).scalars().all()
    source_records = (await db.execute(
        select(SourceRecord).where(SourceRecord.case_id == case_id)
    )).scalars().all()

    signal_rows = (await db.execute(
        select(Signal).where(Signal.case_id == case_id)
    )).scalars().all()

    review_decisions = []
    for r in reviews:
        review_decisions.append({
            "action": r.action,
            "note": r.note,
            "reviewer_id": str(r.reviewer_id),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    report_content = {
        "case": {
            "title": case.title,
            "code": case.case_code,
            "id": str(case.id),
            "is_synthetic": case.is_synthetic,
            "status": case.status.value if case.status else None,
        },
        "title": title,
        "generated_at": datetime.utcnow().isoformat(),
        "analysis_version": run.version if run else None,
        "analysis_run_id": str(selected_run_id) if selected_run_id else None,
        "summary": {
            "total_entities": len(entities),
            "total_relationships": len(relationships),
            "total_hypotheses": len(hypotheses),
            "total_evidence_files": len(evidence_files),
            "total_source_records": len(source_records),
            "total_signals": len(signal_rows),
            "open_contradictions": sum(1 for c in contradict_rows if str(c.status.value) in ("open", "needs_clarification")),
            "open_leads": sum(1 for l in leads if str(l.status.value) in ("open", "in_progress")),
            "open_gaps": sum(1 for g in gaps if str(g.status.value) == "open"),
            "open_actions": sum(1 for a in actions if str(a.status.value) in ("proposed", "in_progress")),
        },
        "evidence": [
            {
                "id": str(e.id),
                "filename": e.original_filename,
                "source_type": e.source_type,
                "status": e.status,
                "sha256": e.sha256,
                "accepted_count": e.accepted_count,
                "rejected_count": e.rejected_count,
                "uploaded_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in evidence_files
        ],
        "hypotheses": [],
        "contradictions": [],
        "leads": [],
        "information_gaps": [],
        "actions": [],
        "review_decisions": review_decisions,
        "limitations": [
            "This is an AI-assisted analysis report. Findings are evidence-strength indices, not proof of guilt or identity.",
            "All relationships and hypotheses require human review before any investigative action.",
            "Analysis was performed on available evidence only; missing data limits conclusions.",
            "A 'supported by reviewer' decision records investigator acceptance; it does not establish objective proof.",
            "Synthetic demonstration data is clearly marked; do not treat demo cases as real investigations.",
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
            "analysis_run_id": str(h.analysis_run_id) if h.analysis_run_id else None,
        }
        report_content["hypotheses"].append(hyp_data)

    for c in contradict_rows:
        report_content["contradictions"].append({
            "id": str(c.id),
            "title": c.title,
            "statements": c.statements or [],
            "entity_ids": c.entity_ids or [],
            "time_context": c.time_context,
            "detection_method": c.detection_method,
            "explanation": c.explanation,
            "status": c.status.value if c.status else None,
            "resolution_note": c.resolution_note,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    for l in leads:
        report_content["leads"].append({
            "id": str(l.id),
            "title": l.title,
            "description": l.description,
            "origin_type": l.origin_type,
            "origin_id": str(l.origin_id) if l.origin_id else None,
            "entity_ids": l.entity_ids or [],
            "supporting_evidence_refs": l.supporting_evidence_refs or [],
            "conflicting_evidence_refs": l.conflicting_evidence_refs or [],
            "priority": l.priority.value if l.priority else "medium",
            "priority_rationale": l.priority_rationale,
            "status": l.status.value if l.status else "open",
        })

    for g in gaps:
        report_content["information_gaps"].append({
            "id": str(g.id),
            "lead_id": str(g.lead_id) if g.lead_id else None,
            "title": g.title,
            "description": g.description,
            "related_entity_ids": g.related_entity_ids or [],
            "related_evidence_refs": g.related_evidence_refs or [],
            "status": g.status.value if g.status else "open",
            "resolution_note": g.resolution_note,
        })

    for a in actions:
        report_content["actions"].append({
            "id": str(a.id),
            "gap_id": str(a.gap_id) if a.gap_id else None,
            "lead_id": str(a.lead_id) if a.lead_id else None,
            "title": a.title,
            "proposed_step": a.proposed_step,
            "expected_information": a.expected_information,
            "source_refs": a.source_refs or [],
            "status": a.status.value if a.status else "proposed",
            "outcome_notes": a.outcome_notes,
        })

    return report_content