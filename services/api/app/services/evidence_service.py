import uuid
import hashlib
import os
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import UploadFile
from app.config import get_settings
from app.models.models import EvidenceFile, Import, SourceRecord

settings = get_settings()


async def save_uploaded_file(
    db: AsyncSession,
    case_id: uuid.UUID,
    file: UploadFile,
    user_id: uuid.UUID,
    source_type: str,
    source_description: str = None,
) -> EvidenceFile:
    os.makedirs(os.path.join(settings.UPLOAD_DIR, str(case_id)), exist_ok=True)

    content = await file.read()
    sha256 = hashlib.sha256(content).hexdigest()
    byte_size = len(content)

    existing = await db.execute(
        select(EvidenceFile).where(
            EvidenceFile.case_id == case_id,
            EvidenceFile.sha256 == sha256,
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("Duplicate file (same SHA-256 already imported)")

    ext = os.path.splitext(file.filename or "")[1] or ".dat"
    storage_name = f"{sha256[:16]}{ext}"
    storage_path = os.path.join(str(case_id), storage_name)

    full_path = os.path.join(settings.UPLOAD_DIR, storage_path)
    with open(full_path, "wb") as f:
        f.write(content)

    media_type = file.content_type or "application/octet-stream"
    ev = EvidenceFile(
        case_id=case_id,
        original_filename=file.filename or "unknown",
        media_type=media_type,
        byte_size=byte_size,
        sha256=sha256,
        storage_path=storage_path,
        source_type=source_type,
        source_description=source_description,
        uploaded_by=user_id,
        status="uploaded",
    )
    db.add(ev)
    await db.flush()
    return ev


async def parse_and_import_csv(
    db: AsyncSession,
    evidence_file: EvidenceFile,
    case_id: uuid.UUID,
    field_mapping: dict = None,
) -> Import:
    import pandas as pd

    full_path = os.path.join(settings.UPLOAD_DIR, evidence_file.storage_path)
    df = pd.read_csv(full_path)

    imp = Import(
        evidence_file_id=evidence_file.id,
        case_id=case_id,
        import_config={"field_mapping": field_mapping, "columns": list(df.columns)},
        status="running",
    )
    db.add(imp)
    await db.flush()

    accepted = 0
    rejected = 0
    errors = []

    for idx, row in df.iterrows():
        record_hash = hashlib.sha256(
            str(row.to_dict()).encode()
        ).hexdigest()

        dup_check = await db.execute(
            select(SourceRecord).where(
                SourceRecord.case_id == case_id,
                SourceRecord.normalized_hash == record_hash,
            )
        )
        is_dup = dup_check.scalar_one_or_none() is not None

        original = row.to_dict()
        normalized = _normalize_record(original, field_mapping)

        sr = SourceRecord(
            case_id=case_id,
            import_id=imp.id,
            evidence_file_id=evidence_file.id,
            row_locator=f"row:{idx + 1}",
            original_content=original,
            normalized_content=normalized,
            normalized_hash=record_hash,
            parser_version="csv_importer_v1",
            is_duplicate=is_dup,
        )
        db.add(sr)

        if is_dup:
            rejected += 1
        else:
            accepted += 1

    imp.accepted_count = accepted
    imp.rejected_count = rejected
    imp.status = "completed"
    imp.completed_at = datetime.utcnow()

    evidence_file.status = "imported"
    evidence_file.accepted_count = accepted
    evidence_file.rejected_count = rejected
    evidence_file.parser_version = "csv_importer_v1"

    await db.flush()
    return imp


async def parse_and_import_json(
    db: AsyncSession,
    evidence_file: EvidenceFile,
    case_id: uuid.UUID,
    field_mapping: dict = None,
) -> Import:
    import json

    full_path = os.path.join(settings.UPLOAD_DIR, evidence_file.storage_path)
    with open(full_path, "r") as f:
        data = json.load(f)

    if isinstance(data, dict):
        data = [data]

    imp = Import(
        evidence_file_id=evidence_file.id,
        case_id=case_id,
        import_config={"field_mapping": field_mapping, "count": len(data)},
        status="running",
    )
    db.add(imp)
    await db.flush()

    accepted = 0
    rejected = 0

    for idx, record in enumerate(data):
        record_hash = hashlib.sha256(str(record).encode()).hexdigest()

        dup_check = await db.execute(
            select(SourceRecord).where(
                SourceRecord.case_id == case_id,
                SourceRecord.normalized_hash == record_hash,
            )
        )
        is_dup = dup_check.scalar_one_or_none() is not None

        normalized = _normalize_record(record, field_mapping)

        sr = SourceRecord(
            case_id=case_id,
            import_id=imp.id,
            evidence_file_id=evidence_file.id,
            row_locator=f"index:{idx}",
            original_content=record,
            normalized_content=normalized,
            normalized_hash=record_hash,
            parser_version="json_importer_v1",
            is_duplicate=is_dup,
        )
        db.add(sr)

        if is_dup:
            rejected += 1
        else:
            accepted += 1

    imp.accepted_count = accepted
    imp.rejected_count = rejected
    imp.status = "completed"
    imp.completed_at = datetime.utcnow()

    evidence_file.status = "imported"
    evidence_file.accepted_count = accepted
    evidence_file.rejected_count = rejected

    await db.flush()
    return imp


def _normalize_record(record: dict, field_mapping: dict = None) -> dict:
    normalized = {}
    for k, v in record.items():
        if isinstance(v, str):
            normalized[k] = v.strip()
        else:
            normalized[k] = v
    if field_mapping:
        for src, dst in field_mapping.items():
            if src in normalized:
                normalized[dst] = normalized.pop(src)
    return normalized
