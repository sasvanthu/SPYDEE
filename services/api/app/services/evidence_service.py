"""
SPYDEE Evidence Ingestion Pipeline.

Stream-based, chunked parsers for telecom CDR/IPDR, tower dumps, financial
ledgers and chat forensics exports. Every row gets a deterministic SHA-256
fingerprint, a ``row_locator`` for court-ready traceability, and is linked to
entities/events/relationships through the Entity Resolution Engine.
"""
import uuid
import os
import json
import hashlib
import logging
from datetime import datetime
from typing import Iterator, Optional

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import get_settings
from app.models.models import EvidenceFile, Import, SourceRecord, JobStatus
from app.services.entity_service import (
    normalize_identifier, canonical_hash, persist_derived_structure,
    _load_identifier_map,
)

logger = logging.getLogger("spydee.ingest")
settings = get_settings()

BATCH_SIZE = 2000
MAX_JSON_ARRAY_DEPTH = 200_000_000  # safety guard for streaming decoder bytes read

# ─── Canonical aliases per evidence family ───────────────────────────────────

CDR_FOLD = {
    "record_id": "record_id", "call_id": "record_id", "cdr_id": "record_id",
    "calling_number": "caller_id", "a_number": "caller_id", "caller": "caller_id",
    "msisdn": "caller_id", "caller_msisdn": "caller_id", "calling_party": "caller_id",
    "called_number": "callee_id", "b_number": "callee_id", "callee": "callee_id",
    "called_msisdn": "callee_id", "called_party": "callee_id",
    "start_time": "start_time", "call_start_time": "start_time", "datetime": "start_time",
    "call_date": "start_time", "timestamp": "start_time", "time": "start_time",
    "duration_seconds": "duration_seconds", "duration": "duration_seconds",
    "call_duration": "duration_seconds", "duration_s": "duration_seconds",
    "call_type": "call_type", "type": "call_type",
    "direction": "direction", "call_direction": "direction",
    "caller_imei": "caller_imei", "calling_imei": "caller_imei",
    "callee_imei": "callee_imei", "called_imei": "callee_imei",
    "caller_imsi": "caller_imsi", "calling_imsi": "caller_imsi",
    "callee_imsi": "callee_imsi", "called_imsi": "callee_imsi",
    "cell_id": "tower_id", "cell_tower_id": "tower_id", "tower_id": "tower_id",
    "caller_tower_id": "tower_id", "callee_tower_id": "tower_id",
    "lac": "lac", "azimuth": "azimuth", "call_type_code": "call_type",
    "first_octet_ip": "first_octet_ip", "last_octet_ip": "last_octet_ip",
    "source_ip": "source_ip", "destination_ip": "destination_ip",
    "device_id": "device_id", "caller_device_id": "device_id", "equipment_id": "device_id",
}

TOWER_FOLD = {
    "timestamp": "timestamp", "observed_at": "timestamp", "time": "timestamp",
    "date_time": "timestamp", "recorded_at": "timestamp",
    "tower_id": "tower_id", "cell_id": "tower_id", "site_id": "tower_id",
    "lat": "lat", "latitude": "lat", "lon": "lon", "longitude": "lon",
    "imsi": "imsi", "imei": "imei", "msisdn": "msisdn", "phone": "msisdn",
    "lac": "lac", "cell": "cell", "sector": "sector", "azimuth": "azimuth",
    "device_id": "device_id", "location_precision": "accuracy", "accuracy": "accuracy",
}

FIN_FOLD = {
    "transaction_id": "transaction_id", "txn_id": "transaction_id",
    "reference": "reference", "txn_ref": "reference", "transaction_reference": "reference",
    "from_account_id": "from_account_id", "sender_account": "from_account_id",
    "source_account": "from_account_id", "account_from": "from_account_id",
    "debit_account": "from_account_id", "from_acct": "from_account_id",
    "to_account_id": "to_account_id", "receiver_account": "to_account_id",
    "destination_account": "to_account_id", "account_to": "to_account_id",
    "credit_account": "to_account_id", "to_acct": "to_account_id",
    "amount": "amount", "transaction_amount": "amount", "value": "amount", "amt": "amount",
    "currency": "currency", "ccy": "currency",
    "timestamp": "timestamp", "transaction_time": "timestamp", "datetime": "timestamp",
    "narration": "narration", "description": "narration", "remarks": "narration",
    "from_upi": "from_upi", "to_upi": "to_upi", "upi": "upi_id",
    "account_holder": "account_holder", "customer_name": "account_holder", "name": "account_holder",
}

CHAT_FOLD = {
    "sender": "sender_alias", "sender_alias": "sender_alias", "alias": "alias_id",
    "alias_id": "alias_id", "from_alias": "alias_id", "handle": "handle",
    "recipient": "target_alias", "receiver": "target_alias", "to_alias": "target_alias",
    "target_alias": "target_alias",
    "timestamp": "timestamp", "time": "timestamp", "message_time": "timestamp",
    "text": "text", "message": "text", "body": "text", "content": "text",
    "conversation_id": "conversation_id", "chat_id": "conversation_id",
    "language": "language", "message_type": "message_type", "media_type": "media_type",
    "platform": "platform", "source": "platform", "phone": "phone_id",
}

DEVICE_FOLD = {
    "device_id": "device_id", "equipment_id": "device_id",
    "phone_id": "phone_id", "msisdn": "phone_id", "number": "phone_id",
    "sim_id": "sim_id", "iccid": "sim_id",
    "device_imei": "imei", "imei": "imei", "phone_imei": "imei",
    "imsi": "imsi",
    "event_time": "event_time", "timestamp": "event_time", "time": "event_time",
    "event_type": "event_type", "type": "event_type",
    "tower_id": "tower_id", "cell_id": "tower_id",
}

FAMILY_FOR_SOURCE = {
    "cdr": "communication", "ipdr": "communication", "voice": "communication",
    "tower_dump": "spatial_temporal", "financial": "financial", "bank": "financial",
    "ledger": "financial", "chat": "writing_style", "messages": "writing_style",
    "device_sim": "device_sim", "device": "device_sim",
}

FOLD_MAP = {
    "cdr": CDR_FOLD, "ipdr": CDR_FOLD, "voice": CDR_FOLD,
    "tower_dump": TOWER_FOLD, "financial": FIN_FOLD, "bank": FIN_FOLD,
    "ledger": FIN_FOLD, "chat": CHAT_FOLD, "messages": CHAT_FOLD,
    "device_sim": DEVICE_FOLD, "device": DEVICE_FOLD,
}

IDENTIFIER_KEYS = (
    "caller_id", "callee_id", "caller_imei", "callee_imei", "caller_imsi",
    "callee_imsi", "tower_id", "from_account_id", "to_account_id", "from_upi",
    "to_upi", "upi_id", "ip_address", "source_ip", "destination_ip",
    "first_octet_ip", "last_octet_ip", "email", "alias_id", "sender_alias",
    "target_alias", "handle", "device_id", "sim_id", "phone_id", "imei", "imsi",
    "msisdn", "vehicle_registration", "domain", "mac_address", "account_id",
    "bank_account", "account_holder",
)

IDENT_TYPE_BY_KEY = {
    "caller_id": "phone", "callee_id": "phone", "phone_id": "phone", "msisdn": "phone",
    "caller_imei": "imei", "callee_imei": "imei", "imei": "imei",
    "caller_imsi": "imsi", "callee_imsi": "imsi", "imsi": "imsi",
    "tower_id": "tower", "from_account_id": "account", "to_account_id": "account",
    "account_id": "account", "bank_account": "account", "upi_id": "upi",
    "from_upi": "upi", "to_upi": "upi", "ip_address": "ip", "source_ip": "ip",
    "destination_ip": "ip", "first_octet_ip": "ip", "last_octet_ip": "ip",
    "email": "email", "alias_id": "alias", "sender_alias": "alias",
    "target_alias": "alias", "handle": "handle", "device_id": "device",
    "sim_id": "sim", "vehicle_registration": "vehicle", "domain": "domain",
    "mac_address": "mac", "account_holder": "name",
}

REQUIRED_FIELDS = {
    "cdr": ("caller_id", "callee_id", "start_time"),
    "ipdr": ("caller_id", "callee_id", "start_time"),
    "voice": ("caller_id", "callee_id", "start_time"),
    "tower_dump": ("timestamp", "imsi", "tower_id"),
    "financial": ("from_account_id", "to_account_id", "timestamp", "amount"),
    "bank": ("from_account_id", "to_account_id", "timestamp", "amount"),
    "ledger": ("from_account_id", "to_account_id", "timestamp", "amount"),
    "chat": ("sender_alias", "timestamp", "text"),
    "messages": ("sender_alias", "timestamp", "text"),
    "device_sim": ("device_id", "event_time", "event_type"),
    "device": ("device_id", "event_time", "event_type"),
}


# ─── Streaming readers ───────────────────────────────────────────────────────

def iter_json_objects(path: str) -> Iterator[dict]:
    """Stream objects from a JSON array or NDJSON file without loading all of it."""
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        chunk = f.read(1)
        while chunk and chunk in " \t\r\n":
            chunk = f.read(1)
        if chunk == "[":
            decoder = json.JSONDecoder()
            buffer = chunk
            idx = 1
            while True:
                buf_len = len(buffer)
                while idx < buf_len and buffer[idx] in " \t\r\n":
                    idx += 1
                if idx >= buf_len:
                    more = f.read(1 << 20)
                    if not more:
                        break
                    buffer += more
                    buf_len = len(buffer)
                    continue
                if buffer[idx] == "]":
                    break
                try:
                    obj, end = decoder.raw_decode(buffer, idx)
                except json.JSONDecodeError:
                    more = f.read(1 << 20)
                    if not more:
                        break
                    buffer += more
                    continue
                if isinstance(obj, dict):
                    yield obj
                idx = end
                while idx < len(buffer) and buffer[idx] in " \t\r\n,":
                    idx += 1
        else:
            line = chunk
            while line:
                cleaned = line.strip()
                if cleaned and cleaned != ",":
                    try:
                        obj = json.loads(cleaned)
                        if isinstance(obj, dict):
                            yield obj
                        elif isinstance(obj, list):
                            for item in obj:
                                if isinstance(item, dict):
                                    yield item
                    except json.JSONDecodeError:
                        logger.warning("Skipping malformed JSON line: %.80s", line)
                line = f.readline()


def iter_records(full_path: str, source_type: str) -> Iterator[tuple[dict, str]]:
    """Yield (raw_record, row_locator) pairs for any supported file."""
    ext = full_path.rsplit(".", 1)[-1].lower() if "." in full_path else ""

    if ext == "csv":
        n = 0
        seen_headers = False
        for chunk in pd.read_csv(full_path, chunksize=5000, dtype=str,
                                 keep_default_na=False, encoding="utf-8-sig",
                                 on_bad_lines="warn"):
            for _, row in chunk.iterrows():
                n += 1
                yield row.to_dict(), f"row:{n}"
        return

    if ext != "json":
        raise ValueError(f"Unsupported evidence file extension: .{ext}")

    n = 0
    for obj in iter_json_objects(full_path):
        n += 1
        yield obj, f"index:{n - 1}"


def detect_source_type(filename: str, declared: str = None) -> str:
    if declared and declared in FAMILY_FOR_SOURCE:
        return declared
    name = (filename or "").lower()
    for token, stype in (
        ("tower", "tower_dump"), ("dump", "tower_dump"), ("cell", "tower_dump"),
        ("bank", "financial"), ("fin", "financial"), ("txn", "financial"),
        ("transaction", "financial"), ("ledger", "financial"), ("upi", "financial"),
        ("whatsapp", "chat"), ("telegram", "chat"), ("chat", "chat"),
        ("cellebrite", "chat"), ("ufed", "chat"), ("message", "chat"),
        ("device", "device_sim"), ("sim", "device_sim"),
        ("ipdr", "ipdr"), ("cdr", "cdr"), ("call", "cdr"),
    ):
        if token in name:
            return stype
    return "cdr"


def family_for_source(source_type: str) -> str:
    return FAMILY_FOR_SOURCE.get(source_type, "communication")


def _fold(record: dict, fold_map: dict) -> dict:
    out = {}
    for k, v in record.items():
        if v is None:
            continue
        if isinstance(v, str):
            v = v.strip()
        if v == "":
            continue
        canon = fold_map.get(k)
        if canon:
            out.setdefault(canon, v)
        else:
            out.setdefault(k, v)
    return out


def normalize_record(raw: dict, source_type: str) -> tuple[dict, dict]:
    """Canonicalize a raw row into the SPYDEE normalized schema.

    Returns (normalized_content, validation_flags). Raises ValueError for rows
    that cannot be processed at all.
    """
    if not isinstance(raw, dict):
        raise ValueError("Row is not an object")
    fold_map = FOLD_MAP.get(source_type, {})
    folded = _fold(raw, fold_map)
    folded["record_kind"] = source_type
    folded["source_family"] = family_for_source(source_type)

    for key in folded.keys():
        if key in IDENT_TYPE_BY_KEY and key not in ("account_holder",):
            id_type = IDENT_TYPE_BY_KEY[key]
            folded[key] = normalize_identifier(id_type, folded[key])

    # Consistent timestamp key for engines
    ts = folded.get("start_time") or folded.get("timestamp") or folded.get("event_time")
    if ts:
        folded["_observed_at"] = str(ts).strip()

    flags = []
    required = REQUIRED_FIELDS.get(source_type, ())
    for req in required:
        if req not in folded or folded.get(req) in (None, ""):
            flags.append(f"missing_required:{req}")
    if "amount" in folded:
        try:
            folded["amount"] = float(str(folded["amount"]).replace(",", "").strip())
        except (TypeError, ValueError):
            flags.append("invalid_numeric:amount")
    for dur_key in ("duration_seconds",):
        if dur_key in folded:
            try:
                folded[dur_key] = int(float(str(folded[dur_key]).strip() or 0))
            except (TypeError, ValueError):
                flags.append(f"invalid_numeric:{dur_key}")

    return folded, {"flags": flags, "required_ok": not any(
        f.startswith("missing_required") for f in flags)}


def compute_row_hash(normalized: dict) -> str:
    return canonical_hash(normalized)


# ─── Upload ──────────────────────────────────────────────────────────────────

async def save_uploaded_file(
    db: AsyncSession,
    case_id: uuid.UUID,
    file,
    user_id: uuid.UUID,
    source_type: str,
    source_description: str = None,
) -> EvidenceFile:
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_BYTES:
        raise ValueError(f"File exceeds {settings.MAX_UPLOAD_BYTES} byte upload limit")

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

    os.makedirs(os.path.join(settings.UPLOAD_DIR, str(case_id)), exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1] or ".dat"
    storage_name = f"{sha256[:16]}{ext}"
    storage_path = os.path.join(str(case_id), storage_name)

    full_path = os.path.join(settings.UPLOAD_DIR, storage_path)
    with open(full_path, "wb") as f:
        f.write(content)

    ev = EvidenceFile(
        case_id=case_id,
        original_filename=file.filename or "unknown",
        media_type=file.content_type or "application/octet-stream",
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


# ─── Streaming import ────────────────────────────────────────────────────────

async def process_evidence_file(
    db: AsyncSession,
    evidence_file: EvidenceFile,
    case_id: uuid.UUID,
    import_obj: Import,
    batch_size: int = BATCH_SIZE,
) -> Import:
    """Stream a file into SourceRecords + derived structure in bounded batches.
    Deterministic hash-based deduplication is case-scoped."""
    full_path = os.path.join(settings.UPLOAD_DIR, evidence_file.storage_path)
    source_type = evidence_file.source_type or detect_source_type(evidence_file.original_filename)
    parser_version = f"{source_type}_importer_v2"
    evidence_file.parser_version = parser_version

    import_obj.status = "running"
    import_obj.import_config = {
        "source_type": source_type,
        "parser_version": parser_version,
        "batch_size": batch_size,
    }
    await db.flush()

    existing = await db.execute(
        select(SourceRecord.normalized_hash).where(SourceRecord.case_id == case_id)
    )
    seen_hashes = set(existing.scalars().all())
    ident_cache = await _load_identifier_map(db, case_id)
    rel_cache = {}

    accepted = 0
    rejected = 0
    errors = []
    pending: list[SourceRecord] = []

    for raw, locator in iter_records(full_path, source_type):
        try:
            normalized, flags = normalize_record(raw, source_type)
            record_hash = compute_row_hash(normalized)
            is_dup = record_hash in seen_hashes
            seen_hashes.add(record_hash)

            sr = SourceRecord(
                case_id=case_id,
                import_id=import_obj.id,
                evidence_file_id=evidence_file.id,
                row_locator=locator,
                original_content=_json_sane(raw),
                normalized_content=normalized,
                normalized_hash=record_hash,
                parser_version=parser_version,
                validation_flags=flags.get("flags") or None,
                is_duplicate=is_dup,
            )
            db.add(sr)
            pending.append(sr)
            if is_dup:
                rejected += 1
            else:
                accepted += 1
        except ValueError as exc:
            rejected += 1
            errors.append({"row": locator, "error": str(exc)[:300]})

        if len(pending) >= batch_size:
            await db.flush()
            unique = [p for p in pending if not p.is_duplicate]
            if unique:
                await persist_derived_structure(db, case_id, unique, ident_cache, rel_cache)
            await db.commit()
            pending.clear()

    if pending:
        await db.flush()
        unique = [p for p in pending if not p.is_duplicate]
        if unique:
            await persist_derived_structure(db, case_id, unique, ident_cache, rel_cache)

    import_obj.accepted_count = accepted
    import_obj.rejected_count = rejected
    import_obj.status = "completed"
    import_obj.completed_at = datetime.utcnow()
    if errors:
        import_obj.error_details = errors[:200]

    evidence_file.status = "imported"
    evidence_file.accepted_count = accepted
    evidence_file.rejected_count = rejected

    await db.flush()
    return import_obj


def _json_sane(value):
    """Serialize scalars so JSON columns never reject a row."""
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    return {"value": str(value)}


async def create_import_job(
    db: AsyncSession, case_id: uuid.UUID, evidence_file_id: uuid.UUID, user_id: uuid.UUID
) -> tuple[Import, "Job"]:
    from app.models.models import Job
    import_obj = Import(
        evidence_file_id=evidence_file_id,
        case_id=case_id,
        status=JobStatus.QUEUED,
        import_config={"source_type": "auto"},
    )
    db.add(import_obj)
    await db.flush()
    job = Job(
        case_id=case_id,
        job_type="import",
        status=JobStatus.QUEUED,
        payload={"import_id": str(import_obj.id), "evidence_file_id": str(evidence_file_id)},
    )
    db.add(job)
    return import_obj, job


# ─── Compatibility wrappers (synchronous API path) ──────────────────────────

async def parse_and_import_csv(
    db: AsyncSession,
    evidence_file: EvidenceFile,
    case_id: uuid.UUID,
    field_mapping: dict = None,
) -> Import:
    return await _run_sync_import(db, evidence_file, case_id, field_mapping)


async def parse_and_import_json(
    db: AsyncSession,
    evidence_file: EvidenceFile,
    case_id: uuid.UUID,
    field_mapping: dict = None,
) -> Import:
    return await _run_sync_import(db, evidence_file, case_id, field_mapping)


async def _run_sync_import(db, evidence_file, case_id, field_mapping):
    import_obj = Import(
        evidence_file_id=evidence_file.id,
        case_id=case_id,
        status=JobStatus.QUEUED,
        import_config={"field_mapping": field_mapping or {}, "mode": "sync"},
    )
    db.add(import_obj)
    await db.flush()
    return await process_evidence_file(db, evidence_file, case_id, import_obj)