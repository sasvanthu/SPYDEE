import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import CopilotMessage, User
from app.auth.auth import get_current_user
from app.schemas.schemas import CopilotQuery, CopilotResponse
from app.services.case_service import check_case_membership
from app.services.copilot_service import answer_copilot_query

router = APIRouter(prefix="/api/v1/copilot", tags=["copilot"])


@router.post("/{case_id}/query", response_model=CopilotResponse)
async def ask_copilot(
    case_id: uuid.UUID,
    req: CopilotQuery,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    result = await answer_copilot_query(db, case_id, req.query)

    msg = CopilotMessage(
        case_id=case_id,
        user_id=user.id,
        query=req.query,
        response=result["answer"],
        citations=result.get("citations", []),
    )
    db.add(msg)
    await db.commit()

    return CopilotResponse(**result)


@router.get("/{case_id}/history")
async def copilot_history(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    result = await db.execute(
        select(CopilotMessage)
        .where(CopilotMessage.case_id == case_id, CopilotMessage.user_id == user.id)
        .order_by(CopilotMessage.created_at.desc())
        .limit(20)
    )
    messages = result.scalars().all()
    return [
        {
            "id": str(m.id),
            "query": m.query,
            "response": m.response,
            "citations": m.citations,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]
