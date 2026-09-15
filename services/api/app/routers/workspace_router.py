from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
from typing import Optional

from app.database import get_db
from app.auth.auth import get_current_user
from app.models.models import (
    User, Case, Contradiction, ContradictionReview, Lead, LeadReview,
    InformationGap, InvestigationAction, EvidenceFile, AnalysisRun,
    Hypothesis, Signal, Entity, Relationship, Event, Job, AuditEvent,
    ContradictionStatus, LeadStatus, GapStatus, ActionStatus,
)
from app.services.case_service import check_case_membership, check_case_write_access, log_audit_event
from app.schemas.schemas import (
    ContradictionCreate, ContradictionResponse, ContradictionReview as ContradictionReviewSchema,
    ContradictionReviewHistory, ContradictionDetail, LeadCreate, LeadUpdate,
    LeadResponse, LeadReview as LeadReviewSchema, LeadDetail, GapCreate, GapUpdate, GapResponse,
    GapDetail, ActionCreate, ActionUpdate, ActionResponse,
    CaseWorkspaceSummary, CaseResponse,
)

router = APIRouter(prefix="/api/v1/workspace", tags=["workspace"])


def _uuid(value) -> UUID:
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid UUID: {value}")


def _contradiction_response(c: Contradiction) -> ContradictionResponse:
    return ContradictionResponse(
        id=str(c.id), case_id=str(c.case_id), title=c.title,
        statements=c.statements or [], entity_ids=c.entity_ids or [],
        time_context=c.time_context, detection_method=c.detection_method,
        explanation=c.explanation, status=str(c.status.value) if c.status else "open",
        resolution_note=c.resolution_note,
        resolved_by=str(c.resolved_by) if c.resolved_by else None,
        analysis_run_id=str(c.analysis_run_id) if c.analysis_run_id else None,
        created_at=c.created_at, updated_at=c.updated_at,
    )


def _lead_response(l: Lead) -> LeadResponse:
    return LeadResponse(
        id=str(l.id), case_id=str(l.case_id), title=l.title,
        description=l.description, origin_type=l.origin_type,
        origin_id=str(l.origin_id) if l.origin_id else None,
        entity_ids=l.entity_ids or [], supporting_evidence_refs=l.supporting_evidence_refs or [],
        conflicting_evidence_refs=l.conflicting_evidence_refs or [],
        priority=str(l.priority.value) if l.priority else "medium",
        priority_rationale=l.priority_rationale, status=str(l.status.value) if l.status else "open",
        created_by=str(l.created_by) if l.created_by else None,
        created_at=l.created_at, updated_at=l.updated_at,
    )


def _gap_response(g: InformationGap) -> GapResponse:
    return GapResponse(
        id=str(g.id), case_id=str(g.case_id),
        lead_id=str(g.lead_id) if g.lead_id else None, title=g.title,
        description=g.description, related_entity_ids=g.related_entity_ids or [],
        related_evidence_refs=g.related_evidence_refs or [],
        status=str(g.status.value) if g.status else "open",
        resolution_note=g.resolution_note, created_at=g.created_at, updated_at=g.updated_at,
    )


def _action_response(a: InvestigationAction) -> ActionResponse:
    return ActionResponse(
        id=str(a.id), case_id=str(a.case_id),
        gap_id=str(a.gap_id) if a.gap_id else None,
        lead_id=str(a.lead_id) if a.lead_id else None,
        title=a.title, description=a.description, proposed_step=a.proposed_step,
        expected_information=a.expected_information, source_refs=a.source_refs or [],
        status=str(a.status.value) if a.status else "proposed",
        outcome_notes=a.outcome_notes, created_at=a.created_at, updated_at=a.updated_at,
    )


# ─── Case workspace summary ─────────────────────────────────────────

@router.get("/{case_id}/summary", response_model=CaseWorkspaceSummary)
async def case_workspace_summary(case_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cid = _uuid(case_id)
    await check_case_membership(db, user.id, cid)

    case_res = await db.get(Case, cid)
    if case_res is None:
        raise HTTPException(status_code=404, detail="Case not found")

    case = CaseResponse(
        id=case_res.id, title=case_res.title, case_code=case_res.case_code,
        description=case_res.description, status=str(case_res.status.value) if case_res.status else "draft",
        is_synthetic=case_res.is_synthetic, created_by=case_res.created_by,
        created_at=case_res.created_at, updated_at=case_res.updated_at,
    )

    async def _count(model) -> int:
        return (await db.execute(select(func.count()).select_from(model).where(model.case_id == cid))).scalar() or 0

    entity_count = await _count(Entity)
    relationship_count = await _count(Relationship)
    event_count = await _count(Event)
    signal_count = await _count(Signal)
    hypothesis_count = await _count(Hypothesis)

    evidence_rows = (await db.execute(
        select(EvidenceFile).where(EvidenceFile.case_id == cid).order_by(EvidenceFile.created_at.desc()).limit(6)
    )).scalars().all()
    evidence_processing = {
        "total_files": len(evidence_rows),
        "awaiting_upload_status": sum(1 for e in evidence_rows if e.status in ("pending", "uploaded")),
        "ready": sum(1 for e in evidence_rows if e.status in ("ready", "imported", "completed")),
        "failed": sum(1 for e in evidence_rows if e.status == "failed"),
    }
    recent_evidence = [
        {
            "id": str(e.id), "original_filename": e.original_filename, "source_type": e.source_type,
            "status": e.status, "byte_size": e.byte_size, "created_at": e.created_at,
            "accepted_count": e.accepted_count, "rejected_count": e.rejected_count,
        }
        for e in evidence_rows
    ]

    jobs = (await db.execute(
        select(Job).where(Job.case_id == cid).order_by(Job.created_at.desc()).limit(8)
    )).scalars().all()
    audits = (await db.execute(
        select(AuditEvent).where(AuditEvent.case_id == cid).order_by(AuditEvent.created_at.desc()).limit(8)
    )).scalars().all()

    activity: list = []
    for j in jobs:
        activity.append({
            "id": str(j.id), "kind": "job", "action": j.job_type,
            "status": str(j.status.value) if j.status else "queued",
            "error_message": j.error_message, "created_at": j.created_at,
        })
    for a in audits:
        activity.append({
            "id": str(a.id), "kind": "audit", "action": a.action,
            "resource_type": a.resource_type, "created_at": a.created_at,
        })
    activity.sort(key=lambda x: x["created_at"] or datetime_now(), reverse=True)
    activity = activity[:8]

    open_contradictions = (await db.execute(
        select(func.count()).select_from(Contradiction)
        .where(Contradiction.case_id == cid, Contradiction.status.in_([ContradictionStatus.OPEN, ContradictionStatus.NEEDS_CLARIFICATION]))
    )).scalar() or 0
    open_leads = (await db.execute(
        select(func.count()).select_from(Lead)
        .where(Lead.case_id == cid, Lead.status.in_([LeadStatus.OPEN, LeadStatus.IN_PROGRESS]))
    )).scalar() or 0
    open_gaps = (await db.execute(
        select(func.count()).select_from(InformationGap).where(InformationGap.case_id == cid, InformationGap.status == GapStatus.OPEN)
    )).scalar() or 0
    open_actions = (await db.execute(
        select(func.count()).select_from(InvestigationAction)
        .where(InvestigationAction.case_id == cid, InvestigationAction.status.in_([ActionStatus.PROPOSED, ActionStatus.IN_PROGRESS]))
    )).scalar() or 0
    pending_hypotheses = (await db.execute(
        select(func.count()).select_from(Hypothesis).where(
            Hypothesis.case_id == cid, Hypothesis.review_state.in_(["new", "needs_verification"])
        )
    )).scalar() or 0

    runs = (await db.execute(
        select(AnalysisRun).where(AnalysisRun.case_id == cid).order_by(AnalysisRun.created_at.desc()).limit(3)
    )).scalars().all()
    latest_run = None
    if runs:
        r = runs[0]
        latest_run = {
            "id": str(r.id), "version": r.version, "status": str(r.status.value) if r.status else "queued",
            "started_at": r.started_at, "completed_at": r.completed_at,
            "failure_details": r.failure_details,
            "signal_count": await _count_by_run(db, Signal, r.id),
            "hypothesis_count": await _count_by_run(db, Hypothesis, r.id),
        }

    case_final = CaseResponse(
        id=case_res.id, title=case_res.title, case_code=case_res.case_code,
        description=case_res.description, status=str(case_res.status.value) if case_res.status else "draft",
        is_synthetic=case_res.is_synthetic, created_by=case_res.created_by,
        created_at=case_res.created_at, updated_at=case_res.updated_at,
        entity_count=entity_count, event_count=event_count, evidence_count=len(evidence_rows),
        hypothesis_count=hypothesis_count, relationship_count=relationship_count,
    )

    return CaseWorkspaceSummary(
        case=case_final,
        evidence_processing=evidence_processing,
        entity_count=entity_count, relationship_count=relationship_count,
        event_count=event_count, signal_count=signal_count, hypothesis_count=hypothesis_count,
        open_contradictions=open_contradictions, open_leads=open_leads,
        open_gaps=open_gaps, open_actions=open_actions,
        findings_awaiting_review=pending_hypotheses,
        recent_evidence=recent_evidence, recent_activity=activity,
        latest_run=latest_run,
    )


async def _count_by_run(db, model, run_id: str) -> int:
    q = select(func.count()).select_from(model).where(model.analysis_run_id == run_id)
    return (await db.execute(q)).scalar() or 0


def datetime_now():
    from datetime import datetime
    return datetime.utcnow()


# ─── Contradictions ─────────────────────────────────────────────────

@router.get("/{case_id}/contradictions", response_model=list[ContradictionResponse])
async def list_contradictions(case_id: str, status: Optional[str] = None,
                              user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cid = _uuid(case_id)
    await check_case_membership(db, user.id, cid)
    q = select(Contradiction).where(Contradiction.case_id == cid)
    if status:
        allowed = {s.value for s in ContradictionStatus}
        if status not in allowed:
            raise HTTPException(status_code=400, detail=f"Invalid status. Use one of: {', '.join(sorted(allowed))}")
        q = q.where(Contradiction.status == status)
    q = q.order_by(Contradiction.created_at.desc())
    rows = (await db.execute(q)).scalars().all()
    return [_contradiction_response(c) for c in rows]


@router.get("/{case_id}/contradictions/{contradiction_id}", response_model=ContradictionDetail)
async def get_contradiction(case_id: str, contradiction_id: str,
                            user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cid, cid2 = _uuid(case_id), _uuid(contradiction_id)
    await check_case_membership(db, user.id, cid)
    c = await db.get(Contradiction, cid2)
    if c is None or str(c.case_id) != case_id:
        raise HTTPException(status_code=404, detail="Contradiction not found")
    history = (await db.execute(
        select(ContradictionReview).where(ContradictionReview.contradiction_id == cid2)
        .order_by(ContradictionReview.created_at.desc())
    )).scalars().all()
    return ContradictionDetail(
        contradiction=_contradiction_response(c),
        review_history=[
            ContradictionReviewHistory(
                id=str(h.id), reviewer_id=str(h.reviewer_id), decision=h.decision,
                note=h.note, created_at=h.created_at,
            )
            for h in history
        ],
    )


@router.post("/{case_id}/contradictions", response_model=ContradictionResponse)
async def create_contradiction(case_id: str, body: ContradictionCreate,
                               user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cid = _uuid(case_id)
    await check_case_write_access(db, user, cid)
    try:
        decoded = [s.model_dump() for s in body.statements]
    except AttributeError:
        decoded = [dict(s) for s in body.statements]
    if not decoded:
        raise HTTPException(status_code=400, detail="At least one conflicting statement is required")
    if len(decoded) < 2:
        raise HTTPException(status_code=400, detail="A contradiction requires at least two statements")
    c = Contradiction(
        case_id=cid, title=body.title, statements=decoded,
        entity_ids=body.entity_ids or [], time_context=body.time_context,
        detection_method=body.detection_method, explanation=body.explanation,
        analysis_run_id=_uuid(body.analysis_run_id) if body.analysis_run_id else None,
    )
    db.add(c)
    await db.flush()
    await log_audit_event(db, cid, user.id, "contradiction_created", "contradiction", c.id,
                          {"title": body.title})
    await db.commit()
    return _contradiction_response(c)


@router.post("/{case_id}/contradictions/{contradiction_id}/review", response_model=ContradictionResponse)
async def review_contradiction(case_id: str, contradiction_id: str, body: ContradictionReviewSchema,
                               user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cid, cid2 = _uuid(case_id), _uuid(contradiction_id)
    await check_case_write_access(db, user, cid)
    c = await db.get(Contradiction, cid2)
    if c is None or str(c.case_id) != case_id:
        raise HTTPException(status_code=404, detail="Contradiction not found")
    decision = body.decision
    allowed = {"open", "needs_clarification", "resolved", "dismissed"}
    if decision not in allowed:
        raise HTTPException(status_code=400, detail="Invalid decision. Use one of: " + ", ".join(sorted(allowed)))
    c.status = {"open": ContradictionStatus.OPEN,
                "needs_clarification": ContradictionStatus.NEEDS_CLARIFICATION,
                "resolved": ContradictionStatus.RESOLVED,
                "dismissed": ContradictionStatus.DISMISSED}[decision]
    c.resolution_note = body.note or c.resolution_note
    c.resolved_by = user.id
    db.add(ContradictionReview(contradiction_id=cid2, reviewer_id=user.id, decision=decision, note=body.note))
    await db.flush()
    await log_audit_event(db, cid, user.id, "contradiction_reviewed", "contradiction", c.id,
                          {"decision": decision, "note": body.note})
    await db.commit()
    await db.refresh(c)
    return _contradiction_response(c)


# ─── Leads ──────────────────────────────────────────────────────────

@router.get("/{case_id}/leads", response_model=list[LeadResponse])
async def list_leads(case_id: str, status: Optional[str] = None,
                     user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cid = _uuid(case_id)
    await check_case_membership(db, user.id, cid)
    q = select(Lead).where(Lead.case_id == cid)
    if status:
        allowed = {s.value for s in LeadStatus}
        if status not in allowed:
            raise HTTPException(status_code=400, detail=f"Invalid status. Use one of: {', '.join(sorted(allowed))}")
        q = q.where(Lead.status == status)
    q = q.order_by(Lead.updated_at.desc())
    rows = (await db.execute(q)).scalars().all()
    return [_lead_response(l) for l in rows]


@router.get("/{case_id}/leads/{lead_id}", response_model=LeadDetail)
async def get_lead(case_id: str, lead_id: str,
                   user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cid, l_id = _uuid(case_id), _uuid(lead_id)
    await check_case_membership(db, user.id, cid)
    l = await db.get(Lead, l_id)
    if l is None or str(l.case_id) != case_id:
        raise HTTPException(status_code=404, detail="Lead not found")
    gaps = _gap_response_or_none_list((await db.execute(
        select(InformationGap).where(InformationGap.lead_id == l_id).order_by(InformationGap.created_at)
    )).scalars().all())
    actions = _action_response_or_none_list((await db.execute(
        select(InvestigationAction).where(InvestigationAction.lead_id == l_id).order_by(InvestigationAction.created_at)
    )).scalars().all())
    history = (await db.execute(
        select(LeadReview).where(LeadReview.lead_id == l_id).order_by(LeadReview.created_at.desc())
    )).scalars().all()
    return LeadDetail(
        lead=_lead_response(l), gaps=gaps, actions=actions,
        review_history=[
            {"id": str(h.id), "reviewer_id": str(h.reviewer_id), "decision": h.decision,
             "note": h.note, "created_at": h.created_at}
            for h in history
        ],
    )


def _gap_response_or_none_list(gaps) -> list:
    return [_gap_response(g) for g in gaps]


def _action_response_or_none_list(actions) -> list:
    return [_action_response(a) for a in actions]


@router.post("/{case_id}/leads", response_model=LeadResponse)
async def create_lead(case_id: str, body: LeadCreate,
                      user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cid = _uuid(case_id)
    await check_case_write_access(db, user, cid)
    priority = body.priority.lower()
    if priority not in {"low", "medium", "high", "critical"}:
        raise HTTPException(status_code=400, detail="Invalid priority")
    l = Lead(
        case_id=cid, title=body.title, description=body.description,
        origin_type=body.origin_type,
        origin_id=_uuid(body.origin_id) if body.origin_id else None,
        entity_ids=body.entity_ids or [],
        supporting_evidence_refs=[s.model_dump() for s in (body.supporting_evidence_refs or [])],
        conflicting_evidence_refs=[s.model_dump() for s in (body.conflicting_evidence_refs or [])],
        priority=priority, priority_rationale=body.priority_rationale,
        created_by=user.id,
    )
    db.add(l)
    await db.flush()
    await log_audit_event(db, cid, user.id, "lead_created", "lead", l.id, {"title": body.title})
    await db.commit()
    await db.refresh(l)
    return _lead_response(l)


@router.patch("/{case_id}/leads/{lead_id}", response_model=LeadResponse)
async def update_lead(case_id: str, lead_id: str, body: LeadUpdate,
                      user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cid, l_id = _uuid(case_id), _uuid(lead_id)
    await check_case_write_access(db, user, cid)
    l = await db.get(Lead, l_id)
    if l is None or str(l.case_id) != case_id:
        raise HTTPException(status_code=404, detail="Lead not found")
    if body.status is not None:
        if body.status not in {s.value for s in LeadStatus}:
            raise HTTPException(status_code=400, detail="Invalid status")
        l.status = body.status
    if body.priority is not None:
        if body.priority not in {"low", "medium", "high", "critical"}:
            raise HTTPException(status_code=400, detail="Invalid priority")
        l.priority = body.priority
    if body.priority_rationale is not None:
        l.priority_rationale = body.priority_rationale
    if body.description is not None:
        l.description = body.description
    await db.flush()
    await log_audit_event(db, cid, user.id, "lead_updated", "lead", l.id,
                          {"status": body.status, "priority": body.priority})
    await db.commit()
    await db.refresh(l)
    return _lead_response(l)


@router.post("/{case_id}/leads/{lead_id}/review", response_model=LeadResponse)
async def review_lead(case_id: str, lead_id: str, body: LeadReviewSchema,
                      user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cid, l_id = _uuid(case_id), _uuid(lead_id)
    await check_case_write_access(db, user, cid)
    l = await db.get(Lead, l_id)
    if l is None or str(l.case_id) != case_id:
        raise HTTPException(status_code=404, detail="Lead not found")
    decision = body.decision.lower()
    if decision not in {"open", "in_progress", "resolved", "dismissed"}:
        raise HTTPException(status_code=400, detail="Invalid decision")
    l.status = decision
    db.add(LeadReview(lead_id=l_id, reviewer_id=user.id, decision=decision, note=body.note))
    await db.flush()
    await log_audit_event(db, cid, user.id, "lead_reviewed", "lead", l.id,
                          {"decision": decision, "note": body.note})
    await db.commit()
    await db.refresh(l)
    return _lead_response(l)


# ─── Information gaps ───────────────────────────────────────────────

@router.get("/{case_id}/gaps", response_model=list[GapResponse])
async def list_gaps(case_id: str, status: Optional[str] = None, lead_id: Optional[str] = None,
                    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cid = _uuid(case_id)
    await check_case_membership(db, user.id, cid)
    q = select(InformationGap).where(InformationGap.case_id == cid)
    if status:
        if status not in {s.value for s in GapStatus}:
            raise HTTPException(status_code=400, detail="Invalid status")
        q = q.where(InformationGap.status == status)
    if lead_id:
        q = q.where(InformationGap.lead_id == _uuid(lead_id))
    q = q.order_by(InformationGap.created_at.desc())
    rows = (await db.execute(q)).scalars().all()
    return [_gap_response(g) for g in rows]


@router.get("/{case_id}/gaps/{gap_id}", response_model=GapDetail)
async def get_gap(case_id: str, gap_id: str,
                  user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cid, g_id = _uuid(case_id), _uuid(gap_id)
    await check_case_membership(db, user.id, cid)
    g = await db.get(InformationGap, g_id)
    if g is None or str(g.case_id) != case_id:
        raise HTTPException(status_code=404, detail="Gap not found")
    actions = (await db.execute(
        select(InvestigationAction).where(InvestigationAction.gap_id == g_id).order_by(InvestigationAction.created_at)
    )).scalars().all()
    return GapDetail(gap=_gap_response(g), actions=[_action_response(a) for a in actions])


@router.post("/{case_id}/gaps", response_model=GapResponse)
async def create_gap(case_id: str, body: GapCreate,
                     user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cid = _uuid(case_id)
    await check_case_write_access(db, user, cid)
    g = InformationGap(
        case_id=cid, lead_id=_uuid(body.lead_id) if body.lead_id else None,
        title=body.title, description=body.description,
        related_entity_ids=body.related_entity_ids or [],
        related_evidence_refs=[s.model_dump() for s in (body.related_evidence_refs or [])],
    )
    db.add(g)
    await db.flush()
    await log_audit_event(db, cid, user.id, "gap_created", "information_gap", g.id, {"title": body.title})
    await db.commit()
    await db.refresh(g)
    return _gap_response(g)


@router.patch("/{case_id}/gaps/{gap_id}", response_model=GapResponse)
async def update_gap(case_id: str, gap_id: str, body: GapUpdate,
                     user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cid, g_id = _uuid(case_id), _uuid(gap_id)
    await check_case_write_access(db, user, cid)
    g = await db.get(InformationGap, g_id)
    if g is None or str(g.case_id) != case_id:
        raise HTTPException(status_code=404, detail="Gap not found")
    if body.status is not None:
        if body.status not in {s.value for s in GapStatus}:
            raise HTTPException(status_code=400, detail="Invalid status")
        g.status = body.status
    if body.resolution_note is not None:
        g.resolution_note = body.resolution_note
    await db.flush()
    await log_audit_event(db, cid, user.id, "gap_updated", "information_gap", g.id, {"status": body.status})
    await db.commit()
    await db.refresh(g)
    return _gap_response(g)


# ─── Actions ────────────────────────────────────────────────────────

@router.get("/{case_id}/actions", response_model=list[ActionResponse])
async def list_actions(case_id: str, status: Optional[str] = None,
                       user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cid = _uuid(case_id)
    await check_case_membership(db, user.id, cid)
    q = select(InvestigationAction).where(InvestigationAction.case_id == cid)
    if status:
        if status not in {s.value for s in ActionStatus}:
            raise HTTPException(status_code=400, detail="Invalid status")
        q = q.where(InvestigationAction.status == status)
    q = q.order_by(InvestigationAction.created_at.desc())
    rows = (await db.execute(q)).scalars().all()
    return [_action_response(a) for a in rows]


@router.post("/{case_id}/actions", response_model=ActionResponse)
async def create_action(case_id: str, body: ActionCreate,
                        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cid = _uuid(case_id)
    await check_case_write_access(db, user, cid)
    a = InvestigationAction(
        case_id=cid, gap_id=_uuid(body.gap_id) if body.gap_id else None,
        lead_id=_uuid(body.lead_id) if body.lead_id else None,
        title=body.title, description=body.description, proposed_step=body.proposed_step,
        expected_information=body.expected_information,
        source_refs=[s.model_dump() for s in (body.source_refs or [])],
    )
    db.add(a)
    await db.flush()
    await log_audit_event(db, cid, user.id, "action_created", "investigation_action", a.id, {"title": body.title})
    await db.commit()
    await db.refresh(a)
    return _action_response(a)


@router.patch("/{case_id}/actions/{action_id}", response_model=ActionResponse)
async def update_action(case_id: str, action_id: str, body: ActionUpdate,
                        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cid, a_id = _uuid(case_id), _uuid(action_id)
    await check_case_write_access(db, user, cid)
    a = await db.get(InvestigationAction, a_id)
    if a is None or str(a.case_id) != case_id:
        raise HTTPException(status_code=404, detail="Action not found")
    if body.status is not None:
        if body.status not in {s.value for s in ActionStatus}:
            raise HTTPException(status_code=400, detail="Invalid status")
        a.status = body.status
    if body.outcome_notes is not None:
        a.outcome_notes = body.outcome_notes
    await db.flush()
    await log_audit_event(db, cid, user.id, "action_updated", "investigation_action", a.id,
                          {"status": body.status})
    await db.commit()
    await db.refresh(a)
    return _action_response(a)