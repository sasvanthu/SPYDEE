import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from app.database import get_db
from app.models.models import Event, EventParticipant, Entity, User
from app.auth.auth import get_current_user
from app.services.case_service import check_case_membership

router = APIRouter(prefix="/api/v1/timeline", tags=["timeline"])


@router.get("/{case_id}")
async def get_timeline(
    case_id: uuid.UUID,
    event_type: str = None,
    date_from: datetime = None,
    date_to: datetime = None,
    entity_id: uuid.UUID = None,
    page: int = 1,
    page_size: int = 100,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    query = select(Event).where(Event.case_id == case_id)
    if event_type:
        query = query.where(Event.event_type == event_type)
    if date_from:
        query = query.where(Event.start_time >= date_from)
    if date_to:
        query = query.where(Event.start_time <= date_to)
    query = query.order_by(Event.start_time).offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    events = result.scalars().all()

    timeline = []
    for ev in events:
        part_result = await db.execute(
            select(EventParticipant).where(EventParticipant.event_id == ev.id)
        )
        participants = []
        for p in part_result.scalars():
            ent_result = await db.execute(select(Entity).where(Entity.id == p.entity_id))
            ent = ent_result.scalar_one_or_none()
            if ent:
                participants.append(ent.label)

        loc_label = None
        if ev.location_id:
            loc_result = await db.execute(select(Entity).where(Entity.id == ev.location_id))
            loc = loc_result.scalar_one_or_none()
            if loc:
                loc_label = loc.label

        timeline.append({
            "id": str(ev.id),
            "event_type": ev.event_type,
            "start_time": ev.start_time.isoformat() if ev.start_time else None,
            "end_time": ev.end_time.isoformat() if ev.end_time else None,
            "participants": participants,
            "location": loc_label,
            "details": ev.details,
        })

    return timeline
