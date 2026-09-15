"""Investigation workspace features end-to-end.

Exercises the new workspace (contradictions / leads / gaps / actions),
evidence detail & text extraction, manual timeline events, merge suggestions,
copilot workspace awareness, enriched reports, and cross-case isolation —
all through the real FastAPI app over ASGI.
"""
import uuid

import httpx
import pytest
from httpx import ASGITransport
from sqlalchemy import select

from app.main import app
from app.models.models import (
    CaseMembership, UserRole, EvidenceFile, Entity, MergeSuggestion,
    ReviewState, Contradiction, Lead, InformationGap, InvestigationAction,
    Import, SourceRecord, Event, EventParticipant, Identifier,
    EntityIdentifierLink,
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


async def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _seed_member(db_session, role=UserRole.INVESTIGATOR, username=None, case=None):
    """Create a user, case (if needed) and membership; return (user, case)."""
    from tests.conftest import _create_case as mk_case
    user = await _create_user(db_session, role=role, username=username or f"ws_{uuid.uuid4().hex[:8]}")
    case = case or await mk_case(db_session)
    db_session.add(CaseMembership(
        case_id=case.id, user_id=user.id, role=role, granted_by=user.id,
    ))
    await db_session.commit()
    return user, case


async def test_workspace_summary_counts(client, db_session):
    user, case = await _seed_member(db_session)
    token = await _login(client, user.username)

    ev = EvidenceFile(case_id=case.id, original_filename="a.txt", media_type="text/plain",
                      byte_size=10, sha256="0" * 32, storage_path="x/a.txt",
                      source_type="document", uploaded_by=user.id, status="ready",
                      extracted_text="hello world")
    con = Contradiction(case_id=case.id, title="C1", statements=[{"text": "A"}, {"text": "B"}])
    lead = Lead(case_id=case.id, title="L1", priority="high", created_by=user.id)
    gap = InformationGap(case_id=case.id, title="G1")
    action = InvestigationAction(case_id=case.id, title="A1")
    db_session.add_all([ev, con, lead, gap, action])
    await db_session.commit()

    resp = await client.get(f"/api/v1/workspace/{case.id}/summary", headers=await _auth(token))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["case"]["id"] == str(case.id)
    assert body["open_contradictions"] == 1
    assert body["open_leads"] == 1
    assert body["open_gaps"] == 1
    assert body["open_actions"] == 1
    assert body["entity_count"] == 0
    assert body["evidence_processing"]["ready"] == 1
    assert body["latest_run"] is None


async def test_contradiction_create_list_detail_review(client, db_session):
    user, case = await _seed_member(db_session)
    token = await _login(client, user.username)

    # non-member isolation
    outsider, other_case = await _seed_member(db_session)
    outsider_token = await _login(client, outsider.username)
    resp = await client.post(f"/api/v1/workspace/{case.id}/contradictions",
                             headers=await _auth(outsider_token),
                             json={"title": "X",
                                   "statements": [{"text": "A"}, {"text": "B"}]})
    assert resp.status_code == 403

    resp = await client.post(f"/api/v1/workspace/{case.id}/contradictions",
                             headers=await _auth(token),
                             json={"title": "Impossible Travel",
                                   "statements": [
                                       {"text": "Subject at Delhi tower", "source_ref": {"locator": "cdr:1"}},
                                       {"text": "Subject at Mumbai tower", "source_ref": {"locator": "cdr:2"}},
                                   ],
                                   "time_context": "2026-02-01 10:00",
                                   "detection_method": "infrastructure.spatial_temporal"})
    assert resp.status_code == 200, resp.text
    created = resp.json()
    assert created["status"] == "open"
    con_id = created["id"]

    # invalid: single statement
    resp = await client.post(f"/api/v1/workspace/{case.id}/contradictions",
                             headers=await _auth(token),
                             json={"title": "Bad", "statements": [{"text": "only one"}]})
    assert resp.status_code == 400

    resp = await client.get(f"/api/v1/workspace/{case.id}/contradictions", headers=await _auth(token))
    assert resp.status_code == 200
    ids = [c["id"] for c in resp.json()]
    assert con_id in ids

    resp = await client.get(f"/api/v1/workspace/{case.id}/contradictions?status=open",
                            headers=await _auth(token))
    assert resp.status_code == 200
    assert con_id in [c["id"] for c in resp.json()]

    resp = await client.get(f"/api/v1/workspace/{case.id}/contradictions?status=resolved",
                            headers=await _auth(token))
    assert con_id not in [c["id"] for c in resp.json()]

    # detail + review
    resp = await client.get(f"/api/v1/workspace/{case.id}/contradictions/{con_id}",
                            headers=await _auth(token))
    assert resp.status_code == 200
    detail = resp.json()
    assert len(detail["contradiction"]["statements"]) == 2
    assert detail["review_history"] == []

    resp = await client.post(f"/api/v1/workspace/{case.id}/contradictions/{con_id}/review",
                             headers=await _auth(token),
                             json={"decision": "resolved", "note": "tower fix invalid"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "resolved"

    resp = await client.get(f"/api/v1/workspace/{case.id}/contradictions/{con_id}",
                            headers=await _auth(token))
    detail = resp.json()
    assert detail["contradiction"]["status"] == "resolved"
    assert detail["review_history"][0]["decision"] == "resolved"


async def test_lead_gap_action_workflow(client, db_session):
    user, case = await _seed_member(db_session)
    token = await _login(client, user.username)

    resp = await client.post(f"/api/v1/workspace/{case.id}/leads",
                             headers=await _auth(token),
                             json={"title": "Lead A", "description": "follow the money",
                                   "priority": "critical",
                                   "origin_type": "hypothesis",
                                   "supporting_evidence_refs": [
                                       {"locator": "txn:1", "excerpt": "transfer 2M"}
                                   ]})
    assert resp.status_code == 200, resp.text
    lead = resp.json()
    assert lead["priority"] == "critical" and lead["status"] == "open"
    lead_id = lead["id"]

    # priority re-triage
    resp = await client.patch(f"/api/v1/workspace/{case.id}/leads/{lead_id}",
                              headers=await _auth(token),
                              json={"priority": "high"})
    assert resp.status_code == 200
    assert resp.json()["priority"] == "high"

    # gap linked to lead
    resp = await client.post(f"/api/v1/workspace/{case.id}/gaps",
                             headers=await _auth(token),
                             json={"title": "Who owns ACCT-5?", "lead_id": lead_id,
                                   "description": "missing beneficial owner"})
    assert resp.status_code == 200, resp.text
    gap_id = resp.json()["id"]

    # action linked to gap
    resp = await client.post(f"/api/v1/workspace/{case.id}/actions",
                             headers=await _auth(token),
                             json={"title": "Request bank records", "gap_id": gap_id,
                                   "lead_id": lead_id,
                                   "proposed_step": "Legal notice to bank",
                                   "expected_information": "KYC documents"})
    assert resp.status_code == 200, resp.text
    action = resp.json()
    assert action["status"] == "proposed"
    action_id = action["id"]

    # lead detail shows linked gaps + actions
    resp = await client.get(f"/api/v1/workspace/{case.id}/leads/{lead_id}",
                            headers=await _auth(token))
    assert resp.status_code == 200
    detail = resp.json()
    assert [g["id"] for g in detail["gaps"]] == [gap_id]
    assert [a["id"] for a in detail["actions"]] == [action_id]

    # gap detail shows the action
    resp = await client.get(f"/api/v1/workspace/{case.id}/gaps/{gap_id}",
                            headers=await _auth(token))
    assert resp.status_code == 200
    assert [a["id"] for a in resp.json()["actions"]] == [action_id]

    # advance action + gap + lead states
    resp = await client.patch(f"/api/v1/workspace/{case.id}/actions/{action_id}",
                              headers=await _auth(token),
                              json={"status": "completed", "outcome_notes": "records received"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"

    resp = await client.patch(f"/api/v1/workspace/{case.id}/gaps/{gap_id}",
                              headers=await _auth(token),
                              json={"status": "addressed", "resolution_note": "owner identified"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "addressed"

    resp = await client.post(f"/api/v1/workspace/{case.id}/leads/{lead_id}/review",
                             headers=await _auth(token),
                             json={"decision": "resolved", "note": "confirmed"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "resolved"

    # invalid status rejected
    resp = await client.patch(f"/api/v1/workspace/{case.id}/leads/{lead_id}",
                              headers=await _auth(token),
                              json={"status": "bogus"})
    assert resp.status_code == 400


async def test_manual_event_recorded_and_labeled(client, db_session):
    user, case = await _seed_member(db_session)
    token = await _login(client, user.username)

    # an evidence-derived event for contrast
    ev = EvidenceFile(case_id=case.id, original_filename="batch.json",
                      media_type="application/json", byte_size=5, sha256="a" * 32,
                      storage_path="x/b.json", source_type="cdr", uploaded_by=user.id,
                      status="imported")
    db_session.add(ev)
    await db_session.flush()
    imp = Import(evidence_file_id=ev.id, case_id=case.id, status="completed")
    db_session.add(imp)
    await db_session.flush()
    sr = SourceRecord(case_id=case.id, import_id=imp.id, evidence_file_id=ev.id,
                      row_locator="r1", original_content={"a": 1},
                      normalized_content={"a": 1},
                      normalized_hash="h1", parser_version="v", is_duplicate=False)
    db_session.add(sr)
    await db_session.flush()
    deriv = Event(case_id=case.id, event_type="call", start_time=None,
                  source_record_id=sr.id, details={"text": "derived"})
    db_session.add(deriv)
    await db_session.commit()

    resp = await client.post(f"/api/v1/timeline/{case.id}/events",
                             headers=await _auth(token),
                             json={"event_type": "observation",
                                   "label": "Investigator met source",
                                   "start_time": None,
                                   "details": {"text": "face-to-face interview"}})
    assert resp.status_code == 200, resp.text
    manual = resp.json()
    assert manual["is_manual"] is True
    assert manual["start_time"] is None  # no timestamp fabricated
    assert manual["time_precision"] == "unknown"

    resp = await client.get(f"/api/v1/timeline/{case.id}", headers=await _auth(token))
    assert resp.status_code == 200
    items = resp.json()["items"]
    manual_item = next(e for e in items if e["id"] == manual["id"])
    assert manual_item["is_manual"] is True
    assert manual_item["start_time"] is None
    derived = next(e for e in items if e["id"] == str(deriv.id))
    assert derived["is_manual"] is False
    assert isinstance(resp.json()["total"], int)


async def test_evidence_text_extraction_and_detail(client, db_session, tmp_path):
    settings = __import__("app.config", fromlist=["get_settings"]).get_settings()
    user, case = await _seed_member(db_session)
    token = await _login(client, user.username)

    upload_dir = settings.UPLOAD_DIR
    import os
    os.makedirs(upload_dir, exist_ok=True)

    # Corrupt document first: extraction-error state -> retry -> success
    bad_path = os.path.join(upload_dir, f"corrupt_{case.id.hex[:8]}.txt")
    with open(bad_path, "w", encoding="utf-8") as f:
        f.write("partial extracted content that now exists")
    ev = EvidenceFile(case_id=case.id, original_filename="corrupt_batch.txt",
                      media_type="text/plain", byte_size=os.path.getsize(bad_path),
                      sha256="b" * 32, storage_path=os.path.basename(bad_path),
                      source_type="document", uploaded_by=user.id, status="failed",
                      extraction_error="previous failure mocked")
    db_session.add(ev)
    await db_session.commit()

    resp = await client.get(f"/api/v1/evidence/{case.id}/files/{ev.id}",
                            headers=await _auth(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["extraction_error"] == "previous failure mocked"

    resp = await client.post(f"/api/v1/evidence/{case.id}/files/{ev.id}/retry-extract",
                             headers=await _auth(token))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "ready"
    assert body["extraction_error"] is None
    assert body["retry_count"] == 1
    assert "partial extracted content" in (body["extracted_text"] or "")

    # a JSON file (non-document) cannot be text-extracted
    json_ev = EvidenceFile(case_id=case.id, original_filename="batch.json",
                           media_type="application/json", byte_size=5, sha256="c" * 32,
                           storage_path="x/c.json", source_type="cdr", uploaded_by=user.id,
                           status="imported")
    db_session.add(json_ev)
    await db_session.commit()
    resp = await client.post(
        f"/api/v1/evidence/{case.id}/files/{json_ev.id}/retry-extract",
        headers=await _auth(token))
    assert resp.status_code == 400
    assert "only available" in resp.json()["detail"]


async def test_merge_suggestion_list_apply_dismiss(client, db_session):
    user, case = await _seed_member(db_session)
    token = await _login(client, user.username)

    prim = Entity(case_id=case.id, entity_type="phone_sim", label="+919000000001")
    secn = Entity(case_id=case.id, entity_type="phone_sim", label="+919000000001b")
    db_session.add_all([prim, secn])
    await db_session.flush()
    ident = Identifier(case_id=case.id, id_type="msisdn", id_value="919000000001b",
                       normalized_value="919000000001b")
    db_session.add(ident)
    await db_session.flush()
    db_session.add(EntityIdentifierLink(identifier_id=ident.id, entity_id=secn.id))
    sug = MergeSuggestion(case_id=case.id, primary_entity_id=prim.id,
                          secondary_entity_id=secn.id, basis="same_identifier",
                          confidence=0.97, reason="exact msisdn match",
                          review_state=ReviewState.NEW)
    db_session.add(sug)
    await db_session.commit()

    resp = await client.get(f"/api/v1/entities/{case.id}/merge-suggestions",
                            headers=await _auth(token))
    assert resp.status_code == 200
    suggestions = resp.json()
    assert len(suggestions) == 1
    assert suggestions[0]["review_state"] == "new"

    # apply
    resp = await client.post(
        f"/api/v1/entities/{case.id}/merge-suggestions/{sug.id}/apply",
        headers=await _auth(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["primary_entity_id"] == str(prim.id)

    # identifier relinked to primary, secondary archived
    link_row = (await db_session.execute(
        select(EntityIdentifierLink).where(EntityIdentifierLink.identifier_id == ident.id)
    )).scalar_one()
    assert link_row.entity_id == prim.id
    await db_session.refresh(secn)
    assert secn.review_state.value == "archived"

    # double-apply rejected
    resp = await client.post(
        f"/api/v1/entities/{case.id}/merge-suggestions/{sug.id}/apply",
        headers=await _auth(token))
    assert resp.status_code == 409

    # dismiss flow on a fresh suggestion
    secn2 = Entity(case_id=case.id, entity_type="person", label="Dee Ewe")
    db_session.add(secn2)
    await db_session.flush()
    sug2 = MergeSuggestion(case_id=case.id, primary_entity_id=prim.id,
                           secondary_entity_id=secn2.id, basis="name_collision",
                           confidence=0.6, review_state=ReviewState.NEW)
    db_session.add(sug2)
    await db_session.commit()
    resp = await client.post(
        f"/api/v1/entities/{case.id}/merge-suggestions/{sug2.id}/dismiss",
        headers=await _auth(token))
    assert resp.status_code == 200
    await db_session.refresh(sug2)
    assert sug2.review_state.value == "rejected"


async def test_copilot_workspace_awareness(client, db_session):
    from app.services.copilot_service import answer_copilot_query
    user, case = await _seed_member(db_session)

    con = Contradiction(case_id=case.id, title="Conflicting timestamps",
                        statements=[{"text": "A"}, {"text": "B"}], status="open")
    gap = InformationGap(case_id=case.id, title="Unknown owner of account",
                         status="open")
    lead = Lead(case_id=case.id, title="High-value transfer", status="open",
                priority="high", created_by=user.id)
    db_session.add_all([con, gap, lead])
    await db_session.commit()

    # contradictions tool
    result = await answer_copilot_query(db_session, case.id,
                                        "What contradicts the strongest lead?")
    assert result["answer"]
    types = {c.get("type") for c in result["citations"]}
    assert "contradiction" in types

    # info gaps tool
    result = await answer_copilot_query(db_session, case.id,
                                        "What information gaps remain?")
    assert result["answer"]
    types = {c.get("type") for c in result["citations"]}
    assert "information_gap" in types


async def test_report_includes_workspace_sections(client, db_session):
    user, case = await _seed_member(db_session)
    token = await _login(client, user.username)

    db_session.add_all([
        Contradiction(case_id=case.id, title="C", statements=[{"text": "A"}, {"text": "B"}],
                      status="open"),
        Lead(case_id=case.id, title="L", status="open", priority="high", created_by=user.id),
        InformationGap(case_id=case.id, title="G", status="open"),
        InvestigationAction(case_id=case.id, title="A", status="proposed"),
    ])
    await db_session.commit()

    resp = await client.post(f"/api/v1/reports/{case.id}",
                             headers=await _auth(token),
                             json={"title": "R", "include_unresolved": True})
    assert resp.status_code == 200, resp.text
    content = resp.json().get("content") or resp.json()
    assert len(content["contradictions"]) == 1
    assert len(content["leads"]) == 1
    assert len(content["information_gaps"]) == 1
    assert len(content["actions"]) == 1
    assert content["summary"]["open_contradictions"] == 1
    assert content["summary"]["open_leads"] == 1
    assert content["summary"]["open_gaps"] == 1
    assert content["summary"]["open_actions"] == 1


async def test_archived_case_is_read_only_for_workspace(client, db_session):
    user, case = await _seed_member(db_session)
    case.status = "archived"
    await db_session.commit()
    token = await _login(client, user.username)

    resp = await client.post(f"/api/v1/workspace/{case.id}/contradictions",
                             headers=await _auth(token),
                             json={"title": "X", "statements": [{"text": "A"}, {"text": "B"}]})
    assert resp.status_code == 403
    assert "archived" in resp.json()["detail"].lower()

    resp = await client.post(f"/api/v1/timeline/{case.id}/events",
                             headers=await _auth(token),
                             json={"event_type": "observation", "label": "manual"})
    assert resp.status_code == 403

    # read stays allowed
    resp = await client.get(f"/api/v1/workspace/{case.id}/summary",
                            headers=await _auth(token))
    assert resp.status_code == 200