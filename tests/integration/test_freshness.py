"""Findings freshness / staleness flag.

When evidence arrives after the latest completed analysis run, findings no
longer reflect all data — the workspace summary must surface that so
investigators can re-run analysis instead of relying on stale hypotheses.
"""
import uuid
from datetime import datetime, timedelta

import httpx
import pytest
from httpx import ASGITransport

from app.main import app
from app.models.models import (
    CaseMembership, UserRole, EvidenceFile, Import, SourceRecord, AnalysisRun,
)
from tests.conftest import _create_user, _create_case

BASE_URL = "http://test"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url=BASE_URL) as c:
        yield c


async def _login(client, username, password="password123"):
    resp = await client.post("/api/v1/auth/login", json={
        "username": username, "password": password,
    })
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


async def _seed(db_session, evidence_created_at, run_completed_at):
    user = await _create_user(db_session, username=f"fr_{uuid.uuid4().hex[:8]}")
    case = await _create_case(db_session)
    db_session.add(CaseMembership(case_id=case.id, user_id=user.id,
                                  role=UserRole.INVESTIGATOR, granted_by=user.id))
    ev = EvidenceFile(case_id=case.id, original_filename="cdr.json",
                      media_type="application/json", byte_size=10,
                      sha256="0" * 32, storage_path="cdr.json",
                      source_type="cdr", uploaded_by=user.id, status="ready")
    db_session.add(ev)
    await db_session.flush()
    imp = Import(evidence_file_id=ev.id, case_id=case.id, status="completed")
    db_session.add(imp)
    await db_session.flush()
    db_session.add(SourceRecord(
        case_id=case.id, import_id=imp.id, evidence_file_id=ev.id,
        original_content={}, normalized_content={"caller_id": "+919000001111"},
        normalized_hash="h1", created_at=evidence_created_at,
    ))
    db_session.add(AnalysisRun(
        case_id=case.id, input_hash="h", status="completed",
        completed_at=run_completed_at,
    ))
    await db_session.commit()
    return user, case


async def test_summary_fresh_when_no_new_evidence(client, db_session):
    now = datetime.utcnow()
    user, case = await _seed(db_session,
                             evidence_created_at=now - timedelta(minutes=30),
                             run_completed_at=now - timedelta(minutes=1))
    token = await _login(client, user.username)
    resp = await client.get(f"/api/v1/workspace/{case.id}/summary",
                            headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["analysis_stale"] is False
    assert body["latest_run"] is not None


async def test_summary_stale_after_new_evidence(client, db_session):
    from sqlalchemy import select
    now = datetime.utcnow()
    user, case = await _seed(db_session,
                             evidence_created_at=now - timedelta(minutes=30),
                             run_completed_at=now - timedelta(minutes=10))
    # evidence added AFTER the run completed
    imp_id = (await db_session.execute(
        select(Import).where(Import.case_id == case.id)))\
        .scalars().first().id
    ev_id = (await db_session.execute(
        select(EvidenceFile).where(EvidenceFile.case_id == case.id)))\
        .scalars().first().id
    db_session.add(SourceRecord(
        case_id=case.id, import_id=imp_id, evidence_file_id=ev_id,
        original_content={}, normalized_content={"caller_id": "+919000002222"},
        normalized_hash="h2", created_at=now + timedelta(seconds=5),
    ))
    await db_session.commit()

    token = await _login(client, user.username)
    resp = await client.get(f"/api/v1/workspace/{case.id}/summary",
                            headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["analysis_stale"] is True
    assert body["analysis_stale_reason"] and "re-run" in body["analysis_stale_reason"]