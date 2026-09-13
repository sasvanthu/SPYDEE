import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import (
    EvidenceFile, Import, SourceRecord, User
)
from app.auth.auth import get_current_user
from app.schemas.schemas import (
    EvidenceUploadResponse, ImportResponse, SourceRecordResponse
)
from app.services.case_service import check_case_membership, log_audit_event
from app.services.evidence_service import (
    save_uploaded_file, parse_and_import_csv, parse_and_import_json
)

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
    await check_case_membership(db, user.id, case_id)

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
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await check_case_membership(db, user.id, case_id)

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

    try:
        if ext == "csv":
            imp = await parse_and_import_csv(db, ev, case_id)
        elif ext == "json":
            imp = await parse_and_import_json(db, ev, case_id)
        else:
            raise HTTPException(status_code=400, detail=f"Import not supported for type: {ext}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

    await log_audit_event(db, case_id, user.id, "evidence_imported", "import", imp.id, {
        "accepted": imp.accepted_count,
        "rejected": imp.rejected_count,
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
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return [SourceRecordResponse.model_validate(r) for r in result.scalars().all()]
