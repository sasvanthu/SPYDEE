import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.models import (
    EvidenceFile, Import, SourceRecord, User, Entity, Event, EventParticipant
)
from app.auth.auth import get_current_user
from app.schemas.schemas import (
    EvidenceUploadResponse, ImportResponse, SourceRecordResponse, EvidenceDetailResponse
)
from app.services.case_service import check_case_membership, check_case_write_access, log_audit_event
from app.services.evidence_service import (
    save_uploaded_file, parse_and_import_csv, parse_and_import_json, create_import_job
)
from app.config import get_settings

router = APIRouter(prefix="/api/v1/evidence", tags=["evidence"])


@router.post("/{case_id}/upload", response_model=EvidenceUploadResponse)
async def upload_evidence(
    case_id: uuid.UUID,
    file: UploadFile = File(...),
    source_type: str = Form("csv"),
    source_description: str = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_write_access(db, user, case_id)

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ("csv", "json", "txt", "pdf"):
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    try:
        ev = await save_uploaded_file(db, case_id, file, user.id, source_type, source_description)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    await log_audit_event(db, case_id, user.id, "evidence_uploaded", "evidence_file", ev.id, {"filename": file.filename})
    await db.commit()
    await db.refresh(ev)
    return EvidenceUploadResponse.model_validate(ev)


@router.post("/{case_id}/upload/{file_id}/import", response_model=ImportResponse)
async def import_evidence(
    case_id: uuid.UUID,
    file_id: uuid.UUID,
    sync: bool = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Queue an import job for the worker, or run synchronously for the demo
    (single-node) deployment. `?sync=true` forces in-process processing;
    `?sync=false` always enqueues. When `sync` is omitted, DEMO_MODE decides."""
    await check_case_write_access(db, user, case_id)

    result = await db.execute(
        select(EvidenceFile).where(
            EvidenceFile.id == file_id,
            EvidenceFile.case_id == case_id,
        )
    )
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence file not found")

    ext = ev.original_filename.rsplit(".", 1)[-1].lower() if "." in ev.original_filename else ""
    if ext not in ("csv", "json"):
        raise HTTPException(status_code=400, detail=f"Import not supported for type: {ext}")

    if sync is None:
        sync = get_settings().DEMO_MODE

    if sync:
        try:
            if ext == "csv":
                imp = await parse_and_import_csv(db, ev, case_id)
            else:
                imp = await parse_and_import_json(db, ev, case_id)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

        await log_audit_event(db, case_id, user.id, "evidence_imported", "import", imp.id, {
            "accepted": imp.accepted_count,
            "rejected": imp.rejected_count,
        })
    else:
        imp, job = await create_import_job(db, case_id, file_id, user.id)
        await log_audit_event(db, case_id, user.id, "evidence_import_queued", "import", imp.id, {
            "job_id": str(job.id),
        })

    await db.commit()
    await db.refresh(imp)
    return ImportResponse.model_validate(imp)


@router.get("/{case_id}/files", response_model=list[EvidenceUploadResponse])
async def list_files(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    result = await db.execute(
        select(EvidenceFile).where(EvidenceFile.case_id == case_id).order_by(EvidenceFile.created_at.desc())
    )
    return [EvidenceUploadResponse.model_validate(f) for f in result.scalars().all()]


@router.get("/{case_id}/imports", response_model=list[ImportResponse])
async def list_imports(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    result = await db.execute(
        select(Import).where(Import.case_id == case_id).order_by(Import.created_at.desc())
    )
    return [ImportResponse.model_validate(i) for i in result.scalars().all()]


@router.get("/{case_id}/records", response_model=list[SourceRecordResponse])
async def list_records(
    case_id: uuid.UUID,
    import_id: uuid.UUID = None,
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)
    query = select(SourceRecord).where(SourceRecord.case_id == case_id)
    if import_id:
        query = query.where(SourceRecord.import_id == import_id)
    query = query.order_by(SourceRecord.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return [SourceRecordResponse.model_validate(r) for r in result.scalars().all()]


@router.get("/{case_id}/files/{file_id}", response_model=EvidenceDetailResponse)
async def get_evidence_detail(
    case_id: uuid.UUID,
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Detailed view of one evidence item: metadata, extracted text, import
    history, parsed record count and links to derived entities/events/signals."""
    await check_case_membership(db, user.id, case_id)
    result = await db.execute(
        select(EvidenceFile).where(EvidenceFile.id == file_id, EvidenceFile.case_id == case_id)
    )
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence file not found")

    imports = (await db.execute(
        select(Import).where(Import.evidence_file_id == ev.id).order_by(Import.created_at.desc())
    )).scalars().all()

    record_count = (await db.execute(
        select(func.count()).select_from(SourceRecord).where(SourceRecord.evidence_file_id == ev.id)
    )).scalar() or 0

    file_record_ids = select(SourceRecord.id).where(SourceRecord.evidence_file_id == ev.id)

    entity_count = (await db.execute(
        select(func.count()).select_from(Entity)
        .join(EventParticipant, EventParticipant.entity_id == Entity.id)
        .join(Event, Event.id == EventParticipant.event_id)
        .where(Event.case_id == case_id, Event.source_record_id.in_(file_record_ids))
    )).scalar() or 0

    event_count = (await db.execute(
        select(func.count()).select_from(Event).where(
            Event.case_id == case_id,
            Event.source_record_id.in_(select(SourceRecord.id).where(SourceRecord.evidence_file_id == ev.id)),
        )
    )).scalar() or 0

    return EvidenceDetailResponse(
        id=str(ev.id), case_id=str(ev.case_id), original_filename=ev.original_filename,
        media_type=ev.media_type, byte_size=ev.byte_size, sha256=ev.sha256,
        source_type=ev.source_type, source_description=ev.source_description,
        uploaded_by=str(ev.uploaded_by), parser_version=ev.parser_version,
        status=ev.status, extracted_text=ev.extracted_text,
        extraction_error=ev.extraction_error, retry_count=ev.retry_count,
        accepted_count=ev.accepted_count, rejected_count=ev.rejected_count,
        created_at=ev.created_at, record_count=record_count,
        import_history=[
            {
                "id": str(i.id), "status": str(i.status.value) if hasattr(i.status, "value") else str(i.status),
                "accepted_count": i.accepted_count, "rejected_count": i.rejected_count,
                "error_details": i.error_details, "created_at": i.created_at,
                "completed_at": i.completed_at,
            }
            for i in imports
        ],
        derived_links={
            "entity_count": entity_count,
            "event_count": event_count,
            "record_count": record_count,
        },
    )


@router.post("/{case_id}/files/{file_id}/retry-extract", response_model=EvidenceDetailResponse)
async def retry_extract(
    case_id: uuid.UUID,
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Re-run text extraction for a failed/corrupt text or PDF document."""
    await check_case_write_access(db, user, case_id)
    result = await db.execute(
        select(EvidenceFile).where(EvidenceFile.id == file_id, EvidenceFile.case_id == case_id)
    )
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence file not found")
    ext = ev.original_filename.rsplit(".", 1)[-1].lower() if "." in ev.original_filename else ""
    if ext not in ("txt", "pdf"):
        raise HTTPException(status_code=400, detail="Text extraction is only available for TXT/PDF documents")

    from app.services.evidence_service import extract_document_text, chunk_document_text
    from app.models.models import DocumentChunk
    try:
        extracted = extract_document_text(ev.storage_path, ev.media_type)
        ev.extracted_text = extracted
        ev.extraction_error = None
        ev.retry_count = (ev.retry_count or 0) + 1
        ev.status = "ready"
        await db.flush()
        chunk_result = await db.execute(
            select(DocumentChunk).where(DocumentChunk.evidence_file_id == ev.id)
        )
        for old in chunk_result.scalars().all():
            await db.delete(old)
        await db.flush()
        chunk_count = chunk_document_text(db, case_id, ev)
        ev.parser_version = f"text_extractor_v1/{chunk_count}chunks"
    except ValueError as exc:
        ev.extraction_error = str(exc)
        ev.status = "failed"
        await db.commit()
        raise HTTPException(status_code=422, detail=str(exc))

    await log_audit_event(db, case_id, user.id, "evidence_extraction_retried", "evidence_file", ev.id,
                          {"retry_count": ev.retry_count})
    await db.commit()
    return await get_evidence_detail(case_id, file_id, db, user)
