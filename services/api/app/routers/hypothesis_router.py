import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import Hypothesis, Signal, HypothesisSignal, ReviewAction, User
from app.auth.auth import get_current_user
from app.schemas.schemas import HypothesisResponse, HypothesisReviewRequest, SignalResponse
from app.services.case_service import check_case_membership, log_audit_event

router = APIRouter(prefix="/api/v1/hypotheses", tags=["hypotheses"])


@router.get("/{case_id}", response_model=list[HypothesisResponse])
async def list_hypotheses(
    case_id: uuid.UUID,
    review_state: str = None,
    min_strength: int = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    query = select(Hypothesis).where(Hypothesis.case_id == case_id)
    if review_state:
        query = query.where(Hypothesis.review_state == review_state)
    if min_strength is not None:
        query = query.where(Hypothesis.strength_index >= min_strength)
    query = query.order_by(Hypothesis.strength_index.desc())
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
        select(HypothesisSignal)
        .join(Signal)
        .where(HypothesisSignal.hypothesis_id == hyp.id)
    )
    signals = []
    for hs in sig_result.scalars():
        sig_result2 = await db.execute(select(Signal).where(Signal.id == hs.signal_id))
        sig = sig_result2.scalar_one_or_none()
        if sig:
            signals.append({
                "signal": SignalResponse.model_validate(sig),
                "weight": hs.weight,
                "contribution": hs.contribution,
            })

    return {
        "hypothesis": HypothesisResponse.model_validate(hyp),
        "signals": signals,
    }


@router.post("/{case_id}/{hypothesis_id}/review")
async def review_hypothesis(
    case_id: uuid.UUID,
    hypothesis_id: uuid.UUID,
    req: HypothesisReviewRequest,
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

    hyp.review_state = req.decision
    action = ReviewAction(
        case_id=case_id,
        hypothesis_id=hyp.id,
        reviewer_id=user.id,
        action=req.decision,
        note=req.note,
    )
    db.add(action)
    await log_audit_event(db, case_id, user.id, "hypothesis_reviewed", "hypothesis", hyp.id, {"decision": req.decision, "note": req.note})
    await db.commit()
    return {"message": "Review recorded", "new_state": req.decision}
