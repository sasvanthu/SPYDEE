import os
import sys
import uuid

_API_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "api"))
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
for _p in (_API_DIR, _REPO_ROOT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import hashlib
import json
import pytest
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.database as dbmod
from app.config import get_settings
from app.models.models import (
    Case, CaseMembership, User, UserRole, EvidenceFile, Import, SourceRecord,
)
from app.auth.auth import hash_password


@pytest.fixture(scope="session", autouse=True)
def _test_engine():
    # pytest-asyncio 0.24 runs each test and its fixtures on a fresh function
    # loop, so no pooled connection may survive past the loop that created it.
    # A NullPool engine guarantees every connection is opened and closed on the
    # same loop, avoiding "Event loop is closed" cross-loop teardown crashes.
    dbmod.engine = create_async_engine(
        get_settings().DATABASE_URL, poolclass=NullPool, echo=False
    )
    dbmod.async_session = async_sessionmaker(
        dbmod.engine, class_=AsyncSession, expire_on_commit=False
    )
    yield


@pytest.fixture
async def db_session():
    async with dbmod.async_session() as session:
        yield session


async def _create_user(db, username=None, role=UserRole.INVESTIGATOR):
    user = User(
        username=username or f"u_{uuid.uuid4().hex[:12]}",
        email=f"{uuid.uuid4().hex[:10]}@test.local",
        display_name="Test User",
        hashed_password=hash_password("password123"),
        role=role,
    )
    db.add(user)
    await db.flush()
    return user


async def _create_case(db, status="ACTIVE", title=None, case_code=None, user_id=None):
    if user_id is None:
        user_id = (await _create_user(db, username=f"owner_{uuid.uuid4().hex[:8]}")).id
    if isinstance(status, str):
        status = status.upper()
    case = Case(
        title=title or f"test-case-{uuid.uuid4().hex[:8]}",
        case_code=case_code or f"TC{uuid.uuid4().hex[:10].upper()}",
        description="integration test case",
        created_by=user_id,
        status=status,
        is_synthetic=True,
    )
    db.add(case)
    await db.flush()
    return case


@pytest.fixture
async def make_user(db_session):
    async def _make(role=UserRole.INVESTIGATOR, username=None):
        return await _create_user(db_session, username=username, role=role)
    return _make


@pytest.fixture
async def make_case(db_session):
    async def _make(status="active", **kw):
        return await _create_case(db_session, status=status, **kw)
    return _make


# ─── Synthetic evidence fixtures ─────────────────────────────────────────────

TELCO_DAY0 = datetime(2026, 1, 5, 0, 0, 0)


def _cdr(record_id, caller, callee, dt, duration=60, tower="TOW-A",
         lat=None, lon=None, direction="OUT"):
    row = {
        "record_id": record_id, "caller_id": f"+91{caller:010d}",
        "callee_id": f"+91{callee:010d}", "start_time": dt.isoformat(),
        "duration_seconds": duration, "direction": direction,
        "caller_tower_id": tower,
    }
    if lat is not None and lon is not None:
        row["lat"] = lat
        row["lon"] = lon
    return row


def _txn(record_id, src_acct, dst_acct, dt, amount):
    return {
        "record_id": record_id,
        "from_account_id": f"ACCT-{src_acct:05d}",
        "to_account_id": f"ACCT-{dst_acct:05d}",
        "timestamp": dt.isoformat(),
        "amount": amount,
        "currency": "INR",
        "reference": f"REF{record_id}",
    }


def _msg(record_id, alias, dt, text):
    return {
        "record_id": record_id,
        "alias_id": f"Alias-{alias:02d}",
        "conversation_id": f"CONV-{(alias % 3) + 1}",
        "timestamp": dt.isoformat(),
        "language": "hinglish",
        "text": text,
    }


def synthetic_5k_records(seed_phone=9000000000):
    """Deterministic ~5000-row blended telco payload."""
    import random
    rng = random.Random(20260914)
    records = []
    towers = ["TOW-A", "TOW-B", "TOW-C", "TOW-D"]
    for i in range(4000):
        caller = seed_phone + rng.randint(0, 39)
        callee = seed_phone + rng.randint(0, 39)
        if callee == caller:
            callee += 1
        dt = TELCO_DAY0 + timedelta(minutes=rng.randint(0, 1400))
        records.append(_cdr(f"cdr{i:06d}", caller, callee, dt,
                            duration=rng.randint(5, 900),
                            tower=towers[rng.randint(0, 3)]))
    for i in range(600):
        dt = TELCO_DAY0 + timedelta(minutes=rng.randint(0, 1400))
        records.append(_txn(f"tx{i:05d}", rng.randint(10000, 10009),
                            rng.randint(10000, 10009), dt,
                            amount=round(rng.uniform(500, 250000), 2)))
    for i in range(400):
        dt = TELCO_DAY0 + timedelta(minutes=rng.randint(0, 1400))
        records.append(_msg(f"ms{i:05d}", rng.randint(1, 24), dt,
                            f"update on the delivery batch {rng.randint(1, 99)}"))
    return records


def tower_fixture(phone, tower, lat, lon, dt):
    return {
        "record_id": f"fix_{phone}_{tower}",
        "caller_id": f"+91{phone:010d}",
        "callee_id": f"+91{(phone % 9999990000) + 1111:010d}",
        "start_time": dt.isoformat(),
        "caller_tower_id": tower,
        "lat": lat,
        "lon": lon,
    }


async def write_and_import(db, case_id, user_id, records, filename="batch.json", source_type="cdr"):
    """Write records to UPLOAD_DIR and run the synchronous import pipeline."""
    from app.config import get_settings
    from app.services.evidence_service import process_evidence_file
    settings = get_settings()
    upload_dir = os.path.abspath(settings.UPLOAD_DIR)
    os.makedirs(upload_dir, exist_ok=True)
    path = os.path.join(upload_dir, filename)
    with open(path, "w", encoding="utf-8") as f:
        f.write(json.dumps(records))

    ev = EvidenceFile(
        case_id=case_id,
        original_filename=filename,
        media_type="application/json",
        byte_size=os.path.getsize(path),
        sha256=hashlib.sha256(json.dumps(records).encode()).hexdigest(),
        storage_path=filename,
        source_type=source_type,
        uploaded_by=user_id,
        status="pending",
    )
    db.add(ev)
    await db.flush()

    import_obj = Import(
        evidence_file_id=ev.id,
        case_id=case_id,
        status="queued",
        import_config={"mode": "test"},
    )
    db.add(import_obj)
    await db.flush()

    await process_evidence_file(db, ev, case_id, import_obj)
    await db.commit()
    await db.refresh(import_obj)
    return ev, import_obj