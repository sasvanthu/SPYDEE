"""Entity review history + reversible merges end-to-end.

Covers the prompt's acceptance criteria that entity decisions preserve source
mentions, are reversible, and keep an audit trail: review history is readable,
an approved merge can be reverted without data loss, and the affected rows are
restored to the secondary entity.
"""
import uuid

import httpx
import pytest
from httpx import ASGITransport
from sqlalchemy import select

from app.main import app
from app.models.models import (
    CaseMembership, UserRole, Entity, Identifier, EntityIdentifierLink,
    EntityReviewDecision, MergeSuggestion, ReviewState, EventParticipant,
    Event, Relationship, RelationshipEvidence,
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
    user = await _create_user(db_session, role=role,
                              username=username or f"er_{uuid.uuid4().hex[:8]}")
    case = case or await _create_case(db_session)
    db_session.add(CaseMembership(case_id=case.id, user_id=user.id, role=role, granted_by=user.id))
    await db_session.commit()
    return user, case


async def _phone_entity(db_session, case_id, phone, label):
    e = Entity(case_id=case_id, entity_type="phone_sim", label=label, review_state=ReviewState.NEW)
    db_session.add(e)
    await db_session.flush()
    ident = Identifier(case_id=case_id, id_type="phone", id_value=phone,
                       normalized_value=phone, source_record_id=None)
    db_session.add(ident)
    await db_session.flush()
    db_session.add(EntityIdentifierLink(entity_id=e.id, identifier_id=ident.id, review_state=ReviewState.NEW))
    await db_session.flush()
    return e, ident


async def _device_entity(db_session, case_id, device, label, owner_entity, owner_ident):
    e = Entity(case_id=case_id, entity_type="device", label=label, review_state=ReviewState.NEW)
    db_session.add(e)
    await db_session.flush()
    # the device identifier is linked to the person entity so merge/revert moves it
    dev_ident = Identifier(case_id=case_id, id_type="device", id_value=device,
                           normalized_value=device, source_record_id=None)
    db_session.add(dev_ident)
    await db_session.flush()
    db_session.add(EntityIdentifierLink(entity_id=owner_entity.id, identifier_id=dev_ident.id,
                                        review_state=ReviewState.NEW))
    await db_session.flush()
    return e


async def test_review_entity_records_history(client, db_session):
    user, case = await _seed_member(db_session)
    token = await _login(client, user.username)
    entity, _ = await _phone_entity(db_session, case.id, "+919999999901", "Suspect A")
    await db_session.commit()

    resp = await client.post(
        f"/api/v1/entities/{case.id}/{entity.id}/review",
        json={"decision": "supported", "note": "matched subscriber records"},
        headers=await _auth(token),
    )
    assert resp.status_code == 200, resp.text

    resp = await client.get(
        f"/api/v1/entities/{case.id}/{entity.id}/review-history",
        headers=await _auth(token),
    )
    assert resp.status_code == 200, resp.text
    history = resp.json()
    assert len(history) == 1
    assert history[0]["decision"] == "supported"
    assert history[0]["note"] == "matched subscriber records"
    assert history[0]["reviewer_id"] == str(user.id)


async def test_merge_and_revert_restores_records(client, db_session):
    user, case = await _seed_member(db_session)
    token = await _login(client, user.username)
    case_id = case.id

    prim, prim_ident = await _phone_entity(db_session, case.id, "+919999999910", "Primary")
    sec, sec_ident = await _phone_entity(db_session, case.id, "+919999999911", "Secondary")
    dev = await _device_entity(db_session, case.id, "DEV-REV-001", "Shared Handset",
                               sec, sec_ident)
    # event participant + relationship pointing at the secondary entity
    evnt = Event(case_id=case.id, event_type="cdr", start_time=None)
    db_session.add(evnt)
    await db_session.flush()
    ev = EventParticipant(event_id=evnt.id, entity_id=sec.id)
    rel = Relationship(case_id=case.id, source_entity_id=sec.id, target_entity_id=prim.id,
                       relationship_type="CALLED", classification="observed", review_state=ReviewState.NEW)
    db_session.add_all([ev, rel])
    await db_session.flush()

    sug = MergeSuggestion(
        case_id=case.id, primary_entity_id=prim.id, secondary_entity_id=sec.id,
        basis="shared_phone", confidence=0.9,
        reason="same subscriber identity",
        review_state=ReviewState.NEW,
    )
    db_session.add(sug)
    await db_session.commit()

    # stash ids so statements don't touch expired ORM instances after expire_all
    prim_id, sec_id, sug_id, ev_id, rel_id = prim.id, sec.id, sug.id, ev.id, rel.id

    # Apply via API (simulates investigator approval)
    resp = await client.post(
        f"/api/v1/entities/{case_id}/merge-suggestions/{sug_id}/apply",
        headers=await _auth(token),
    )
    assert resp.status_code == 200, resp.text
    db_session.expire_all()

    sec_after = (await db_session.execute(
        select(Entity).where(Entity.id == sec_id))).scalar_one()
    assert sec_after.review_state == ReviewState.ARCHIVED
    assert (await db_session.execute(
        select(EntityIdentifierLink).where(EntityIdentifierLink.entity_id == prim_id)
    )).scalars().all()  # identifiers moved to primary
    part = (await db_session.execute(
        select(EventParticipant).where(EventParticipant.entity_id == prim_id))).scalars().all()
    assert len(part) == 1
    rel_after = (await db_session.execute(
        select(Relationship).where(Relationship.id == rel_id))).scalar_one()
    assert rel_after.source_entity_id == prim_id
    assert rel_after.target_entity_id == prim_id

    # Revert via API
    resp = await client.post(
        f"/api/v1/entities/{case_id}/merge-suggestions/{sug_id}/revert",
        headers=await _auth(token),
    )
    assert resp.status_code == 200, resp.text
    db_session.expire_all()

    sec_restored = (await db_session.execute(
        select(Entity).where(Entity.id == sec_id))).scalar_one()
    assert sec_restored.review_state == ReviewState.NEW, "archived entity reactivated"
    # identifiers restored to secondary (phone identifier + device identifier)
    sec_links = (await db_session.execute(
        select(EntityIdentifierLink).where(EntityIdentifierLink.entity_id == sec_id))).scalars().all()
    assert len(sec_links) == 2, "both moved identifiers must come back on revert"
    participants = (await db_session.execute(
        select(EventParticipant).where(EventParticipant.entity_id == sec_id))).scalars().all()
    assert len(participants) == 1
    rel_restored = (await db_session.execute(
        select(Relationship).where(Relationship.id == rel_id))).scalar_one()
    assert rel_restored.source_entity_id == sec_id
    assert rel_restored.target_entity_id == prim_id

    # suggestion is reusable (back to NEW, resolved cleared)
    sug_after = (await db_session.execute(
        select(MergeSuggestion).where(MergeSuggestion.id == sug_id))).scalar_one()
    assert sug_after.review_state == ReviewState.NEW
    assert sug_after.resolved_at is None
    assert sug_after.merge_manifest is None

    # an audit trail exists for the revert
    from app.models.models import AuditEvent
    audits = (await db_session.execute(
        select(AuditEvent).where(AuditEvent.case_id == case_id,
                                 AuditEvent.action == "merge_reverted"))).scalars().all()
    assert len(audits) == 1


async def test_apply_twice_and_revert_unapplied_conflict(client, db_session):
    user, case = await _seed_member(db_session)
    token = await _login(client, user.username)
    prim, _ = await _phone_entity(db_session, case.id, "+919999999920", "P")
    sec, _ = await _phone_entity(db_session, case.id, "+919999999921", "S")
    sug = MergeSuggestion(case_id=case.id, primary_entity_id=prim.id,
                          secondary_entity_id=sec.id, basis="test", confidence=0.8)
    db_session.add(sug)
    await db_session.commit()

    resp = await client.post(
        f"/api/v1/entities/{case.id}/merge-suggestions/{sug.id}/apply",
        headers=await _auth(token))
    assert resp.status_code == 200, resp.text

    # second apply → already applied
    resp = await client.post(
        f"/api/v1/entities/{case.id}/merge-suggestions/{sug.id}/apply",
        headers=await _auth(token))
    assert resp.status_code == 409, resp.text

    # revert twice → second revert is a conflict (not applied anymore)
    resp = await client.post(
        f"/api/v1/entities/{case.id}/merge-suggestions/{sug.id}/revert",
        headers=await _auth(token))
    assert resp.status_code == 200, resp.text
    resp = await client.post(
        f"/api/v1/entities/{case.id}/merge-suggestions/{sug.id}/revert",
        headers=await _auth(token))
    assert resp.status_code == 409, resp.text