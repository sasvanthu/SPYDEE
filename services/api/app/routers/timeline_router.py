import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from datetime import datetime
from app.database import get_db
from app.models.models import Event, EventParticipant, Entity, User
from app.auth.auth import get_current_user
from app.services.case_service import check_case_membership, check_case_write_access, log_audit_event
from app.schemas.schemas import ManualEventCreate

router = APIRouter(prefix="/api/v1/timeline", tags=["timeline"])


@router.get("/{case_id}")
async def get_timeline(
    case_id: uuid.UUID,
    event_type: str = None,
    date_from: datetime = None,
    date_to: datetime = None,
    entity_id: uuid.UUID = None,
    entity_label: str = None,
    source: str = None,
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
        query = query.where(or_(Event.start_time >= date_from, Event.start_time.is_(None)))
    if date_to:
        query = query.where(or_(Event.start_time <= date_to, Event.start_time.is_(None)))
    if entity_id:
        query = query.where(
            Event.id.in_(
                select(EventParticipant.event_id).where(EventParticipant.entity_id == entity_id)
            )
        )
    if entity_label:
        query = query.where(
            Event.id.in_(
                select(EventParticipant.event_id)
                .join(Entity, Entity.id == EventParticipant.entity_id)
                .where(Entity.label.ilike(f"%{entity_label}%"))
            )
        )
    if source:
        query = query.where(Event.event_type.ilike(f"%{source}%"))

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0

    query = query.order_by(Event.start_time.is_(None), Event.start_time.asc(), Event.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    events = result.scalars().all()

    timeline = []
    for ev in events:
        part_result = await db.execute(
            select(EventParticipant).where(EventParticipant.event_id == ev.id)
        )
        participants = []
        participant_ids = []
        for p in part_result.scalars():
            ent_result = await db.execute(select(Entity).where(Entity.id == p.entity_id))
            ent = ent_result.scalar_one_or_none()
            if ent:
                participants.append(ent.label)
                participant_ids.append(str(ent.id))

        loc_label = None
        loc_id = None
        if ev.location_id:
            loc_result = await db.execute(select(Entity).where(Entity.id == ev.location_id))
            loc = loc_result.scalar_one_or_none()
            if loc:
                loc_label = loc.label
                loc_id = str(loc.id)

        timeline.append({
            "id": str(ev.id),
            "event_type": ev.event_type,
            "start_time": ev.start_time.isoformat() if ev.start_time else None,
            "end_time": ev.end_time.isoformat() if ev.end_time else None,
            "original_timestamp": ev.original_timestamp,
            "source_timezone": ev.source_timezone,
            "time_precision": ev.time_precision,
            "is_manual": ev.is_manual,
            "participants": participants,
            "participant_ids": participant_ids,
            "location": loc_label,
            "location_id": loc_id,
            "details": ev.details,
            "source_record_id": str(ev.source_record_id) if ev.source_record_id else None,
        })

    return {"items": timeline, "total": total, "page": page, "page_size": page_size}


@router.post("/{case_id}/events")
async def create_manual_event(
    case_id: uuid.UUID,
    body: ManualEventCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Record an investigator-added timeline event. Manual events are clearly
    labelled and do not fabricate a timestamp when none is supplied."""
    await check_case_write_access(db, user, case_id)

    def _parse(v):
        if not v:
            return None
        try:
            return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid timestamp: {v}")

    start_time = _parse(body.start_time)
    end_time = _parse(body.end_time)

    ev = Event(
        case_id=case_id,
        event_type=body.event_type,
        start_time=start_time,
        end_time=end_time,
        time_precision=body.time_precision or ("full" if start_time else "unknown"),
        is_manual=True,
        details=body.details or {},
    )
    db.add(ev)
    await db.flush()

    participant_ids = []
    for entity_id in (body.participant_entity_ids or []):
        try:
            eid = uuid.UUID(str(entity_id))
        except Exception:
            continue
        ent = await db.get(Entity, eid)
        if ent and str(ent.case_id) == str(case_id):
            db.add(EventParticipant(event_id=ev.id, entity_id=eid, role="manual"))
            participant_ids.append(str(eid))

    await log_audit_event(db, case_id, user.id, "event_created_manual", "event", ev.id,
                          {"event_type": body.event_type, "label": body.label})
    await db.commit()
    await db.refresh(ev)
    return {
        "id": str(ev.id),
        "event_type": ev.event_type,
        "label": body.label,
        "start_time": ev.start_time.isoformat() if ev.start_time else None,
        "end_time": ev.end_time.isoformat() if ev.end_time else None,
        "time_precision": ev.time_precision,
        "is_manual": True,
        "participant_ids": participant_ids,
        "created_at": ev.created_at.isoformat() if ev.created_at else None,
        "note": "Manual event recorded. Marked as investigator-added, not derived from evidence.",
    }