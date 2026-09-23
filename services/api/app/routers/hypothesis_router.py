import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import (
    Hypothesis, HypothesisSignal, HypothesisRecommendation,
    ReviewAction, User, HypothesisState, ReviewState,
)
from app.auth.auth import get_current_user
from app.schemas.schemas import (
    HypothesisResponse, HypothesisSignalResponse, HypothesisReviewRequest,
    SignalResponse,
)
from app.services.case_service import check_case_membership, check_case_write_access, log_audit_event

router = APIRouter(prefix="/api/v1/hypotheses", tags=["hypotheses"])


@router.get("/{case_id}", response_model=list[HypothesisResponse])
async def list_hypotheses(
    case_id: uuid.UUID,
    review_state: str = None,
    min_strength: float = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    query = select(Hypothesis).where(Hypothesis.case_id == case_id)
    if review_state:
        _state_alias = {
            "supported_by_reviewer": "supported",
        }
        mapped_state = _state_alias.get(review_state, review_state)
        query = query.where(Hypothesis.review_state == mapped_state)
    if min_strength is not None:
        query = query.where(Hypothesis.numeric_value >= min_strength)
    query = query.order_by(Hypothesis.numeric_value.desc())
    result = await db.execute(query)
    return [HypothesisResponse.model_validate(h) for h in result.scalars().all()]


@router.get("/{case_id}/{hypothesis_id}", response_model=dict)
async def get_hypothesis(
    case_id: uuid.UUID,
    hypothesis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    result = await db.execute(
        select(Hypothesis).where(Hypothesis.id == hypothesis_id, Hypothesis.case_id == case_id)
    )
    hyp = result.scalar_one_or_none()
    if not hyp:
        raise HTTPException(status_code=404, detail="Hypothesis not found")

    sig_result = await db.execute(
        select(HypothesisSignal).where(HypothesisSignal.hypothesis_id == hyp.id)
    )
    signals = []
    signal_ids = []
    for hs in sig_result.scalars():
        signal_ids.append(hs.signal_id)
        signals.append({
            "signal": hs.feature_details or {},
            "signal_id": str(hs.signal_id) if hs.signal_id else None,
            "family": hs.family,
            "weight": hs.weight,
            "contribution": hs.contribution,
            "quality_factor": hs.quality_factor,
            "contradiction": hs.contradiction,
        })
    if signal_ids:
        from app.models.models import Signal
        sig_rows = (await db.execute(
            select(Signal).where(Signal.id.in_([s for s in signal_ids if s is not None]))
        )).scalars().all()
        by_id = {str(s.id): SignalResponse.model_validate(s) for s in sig_rows}
        for entry in signals:
            if entry.get("signal_id"):
                entry["signal"] = by_id.get(entry["signal_id"], entry["signal"])

    rec_result = await db.execute(
        select(HypothesisRecommendation).where(HypothesisRecommendation.hypothesis_id == hyp.id)
    )
    recommendations = [{
        "id": str(r.id),
        "type": r.type.value if r.type else None,
        "status": r.status.value if r.status else None,
        "estimated_completion_days": r.estimated_completion_days,
        "rationale": r.rationale,
    } for r in rec_result.scalars().all()]

    # Defensive serialization - handle potential null values
    hyp_dict = {
        "id": str(hyp.id),
        "case_id": str(hyp.case_id),
        "analysis_run_id": str(hyp.analysis_run_id) if hyp.analysis_run_id else None,
        "stable_key": hyp.stable_key,
        "entity_pair": hyp.entity_pair,
        "notes": hyp.notes,
        "timestamp_hypothesis_generated": hyp.timestamp_hypothesis_generated.isoformat() if hyp.timestamp_hypothesis_generated else None,
        "contributing_signal_highlights": hyp.contributing_signal_highlights,
        "state": hyp.state.value if hyp.state else None,
        "review_state": hyp.review_state.value if hyp.review_state else None,
        "numeric_value": float(hyp.numeric_value) if hyp.numeric_value is not None else 0.0,
        "quality_factor": float(hyp.quality_factor) if hyp.quality_factor is not None else 1.0,
        "engine_version": hyp.engine_version,
        "hypothesis_type": hyp.hypothesis_type,
        "created_at": hyp.created_at.isoformat() if hyp.created_at else None,
        "updated_at": hyp.updated_at.isoformat() if hyp.updated_at else None,
    }

    return {
        "hypothesis": hyp_dict,
        "signals": signals,
        "recommendations": recommendations,
    }


@router.post("/{case_id}/{hypothesis_id}/review")
async def review_hypothesis(
    case_id: uuid.UUID,
    hypothesis_id: uuid.UUID,
    req: HypothesisReviewRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_write_access(db, user, case_id)
    result = await db.execute(
        select(Hypothesis).where(Hypothesis.id == hypothesis_id, Hypothesis.case_id == case_id)
    )
    hyp = result.scalar_one_or_none()
    if not hyp:
        raise HTTPException(status_code=404, detail="Hypothesis not found")

    try:
        review_state_map = {
            "supported_by_reviewer": ReviewState.SUPPORTED,
            "supported": ReviewState.SUPPORTED,
            "rejected": ReviewState.REJECTED,
            "needs_verification": ReviewState.NEEDS_VERIFICATION,
        }
        if req.decision in review_state_map:
            hyp.review_state = review_state_map[req.decision]
        decision_map = {
            "supported_by_reviewer": HypothesisState.SUPPORTED,
            "supported": HypothesisState.SUPPORTED,
            "rejected": HypothesisState.REJECTED,
            "needs_verification": HypothesisState.NEEDS_VERIFICATION,
        }
        if req.decision in decision_map:
            hyp.state = decision_map[req.decision]

        action = ReviewAction(
            case_id=case_id,
            hypothesis_id=hyp.id,
            reviewer_id=user.id,
            action=req.decision,
            note=req.note,
        )
        db.add(action)
        await log_audit_event(
            db, case_id, user.id, "hypothesis_reviewed", "hypothesis", hyp.id,
            {"decision": req.decision, "note": req.note},
        )
        await db.commit()
        return {"message": "Review recorded", "new_state": req.decision}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        import traceback
        raise HTTPException(status_code=422, detail=f"Review failed: {str(e)} | {traceback.format_exc()}")