"""RBAC enforcement across the API.

Admin-only user management, supervisor-gated membership grants, and
write-access (archived case) enforcement — all exercised through the real
FastAPI app over ASGI.
"""
import uuid

import httpx
import pytest
from httpx import ASGITransport

from app.main import app
from app.models.models import CaseMembership, UserRole
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


async def _seed_user(db_session, role, username=None):
    user = await _create_user(db_session, role=role, username=username or f"rbac_{uuid.uuid4().hex[:8]}")
    await db_session.commit()
    return user


async def test_users_management_is_admin_only(client, db_session):
    admin = await _seed_user(db_session, UserRole.ADMINISTRATOR)
    inv = await _seed_user(db_session, UserRole.INVESTIGATOR)

    inv_token = await _login(client, inv.username)
    admin_token = await _login(client, admin.username)

    # non-admin cannot list users
    resp = await client.get("/api/v1/users", headers=await _auth(inv_token))
    assert resp.status_code == 403

    # admin can list
    resp = await client.get("/api/v1/users", headers=await _auth(admin_token))
    assert resp.status_code == 200
    usernames = [u["username"] for u in resp.json()]
    assert admin.username in usernames and inv.username in usernames

    # non-admin cannot create users
    resp = await client.post("/api/v1/users", headers=await _auth(inv_token),
                             json={"username": "hacker", "email": "h@x.io",
                                   "display_name": "H", "password": "password123"},
                             )
    assert resp.status_code == 403

    # admin can create
    email = f"newbie_{uuid.uuid4().hex[:6]}@x.io"
    resp = await client.post("/api/v1/users", headers=await _auth(admin_token),
                             json={"username": f"newbie_{uuid.uuid4().hex[:6]}",
                                   "email": email, "display_name": "N",
                                   "password": "password123", "role": "case_supervisor"},
                             )
    assert resp.status_code == 201

    # admin cannot deactivate self
    resp = await client.patch(f"/api/v1/users/{admin.id}", headers=await _auth(admin_token),
                              json={"is_active": False})
    assert resp.status_code == 400


async def test_non_member_cannot_access_case(client, db_session):
    case = await _create_case(db_session)
    inv = await _seed_user(db_session, UserRole.INVESTIGATOR)
    await db_session.commit()
    token = await _login(client, inv.username)

    resp = await client.post(f"/api/v1/entities/{case.id}", headers=await _auth(token),
                             json={"entity_type": "person", "label": "John Doe"})
    assert resp.status_code == 403
    assert "member" in resp.json()["detail"].lower()


async def test_archived_case_is_read_only_for_investigator(client, db_session):
    inv_user = await _seed_user(db_session, UserRole.INVESTIGATOR)
    case = await _create_case(db_session, status="archived")
    db_session.add(CaseMembership(
        case_id=case.id, user_id=inv_user.id, role=UserRole.INVESTIGATOR, granted_by=inv_user.id,
    ))
    await db_session.commit()
    token = await _login(client, inv_user.username)

    resp = await client.post(f"/api/v1/entities/{case.id}", headers=await _auth(token),
                             json={"entity_type": "person", "label": "Jane Roe"})
    assert resp.status_code == 403
    assert "archived" in resp.json()["detail"].lower()


async def test_member_grant_requires_supervisor(client, db_session):
    inv_user = await _seed_user(db_session, UserRole.INVESTIGATOR)
    target = await _seed_user(db_session, UserRole.INVESTIGATOR)
    case = await _create_case(db_session)
    db_session.add(CaseMembership(
        case_id=case.id, user_id=inv_user.id, role=UserRole.INVESTIGATOR, granted_by=inv_user.id,
    ))
    await db_session.commit()

    token = await _login(client, inv_user.username)

    resp = await client.post(f"/api/v1/cases/{case.id}/members",
                             headers=await _auth(token),
                             json={"user_id": str(target.id), "role": "investigator"})
    assert resp.status_code == 403

    # investigative memberships stay viewable
    resp = await client.get(f"/api/v1/cases/{case.id}", headers=await _auth(token))
    assert resp.status_code == 200