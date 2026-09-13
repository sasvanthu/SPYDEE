import uuid
import re
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import Entity, Identifier, EntityIdentifierLink, EntityType, ReviewState


PHONE_RE = re.compile(r'[\d\-\+\(\)\s]{7,15}')
DEVICE_RE = re.compile(r'[A-Fa-f0-9]{8,16}')


def normalize_identifier(id_type: str, value: str) -> str:
    v = value.strip()
    if id_type in ("phone", "sim"):
        digits = re.sub(r'[\D]', '', v)
        if digits.startswith("91") and len(digits) == 12:
            digits = digits[2:]
        return digits
    if id_type == "device":
        return v.upper().replace(":", "").replace("-", "")
    if id_type == "account":
        return v.lower()
    if id_type in ("domain", "ip"):
        return v.lower()
    return v.lower().strip()


async def resolve_identifier(
    db: AsyncSession,
    case_id: uuid.UUID,
    id_type: str,
    id_value: str,
    source_record_id: uuid.UUID = None,
) -> tuple[Identifier, Entity]:
    norm = normalize_identifier(id_type, id_value)
    result = await db.execute(
        select(Identifier).where(
            Identifier.case_id == case_id,
            Identifier.id_type == id_type,
            Identifier.normalized_value == norm,
        )
    )
    identifier = result.scalar_one_or_none()
    if identifier:
        link_result = await db.execute(
            select(EntityIdentifierLink).where(
                EntityIdentifierLink.identifier_id == identifier.id
            ).limit(1)
        )
        link = link_result.scalar_one_or_none()
        if link:
            entity_result = await db.execute(select(Entity).where(Entity.id == link.entity_id))
            entity = entity_result.scalar_one_or_none()
            if entity:
                return identifier, entity

    entity = Entity(
        case_id=case_id,
        entity_type=_type_for_identifier(id_type),
        label=id_value,
        review_state=ReviewState.NEW,
    )
    db.add(entity)
    await db.flush()

    identifier = Identifier(
        case_id=case_id,
        id_type=id_type,
        id_value=id_value,
        normalized_value=norm,
        source_record_id=source_record_id,
    )
    db.add(identifier)
    await db.flush()

    link = EntityIdentifierLink(
        entity_id=entity.id,
        identifier_id=identifier.id,
        source_record_id=source_record_id,
        confidence=1.0,
    )
    db.add(link)
    await db.flush()

    return identifier, entity


def _type_for_identifier(id_type: str) -> EntityType:
    mapping = {
        "phone": EntityType.PHONE_SIM,
        "sim": EntityType.PHONE_SIM,
        "device": EntityType.DEVICE,
        "account": EntityType.ACCOUNT,
        "domain": EntityType.DOMAIN_IP,
        "ip": EntityType.DOMAIN_IP,
        "alias": EntityType.ALIAS,
        "name": EntityType.PERSON,
    }
    return mapping.get(id_type, EntityType.PERSON)


async def get_entity_profile(db: AsyncSession, entity_id: uuid.UUID):
    result = await db.execute(select(Entity).where(Entity.id == entity_id))
    entity = result.scalar_one_or_none()
    if not entity:
        return None

    links = await db.execute(
        select(EntityIdentifierLink)
        .join(Identifier)
        .where(EntityIdentifierLink.entity_id == entity_id)
    )
    identifiers = []
    for link in links.scalars():
        id_result = await db.execute(select(Identifier).where(Identifier.id == link.identifier_id))
        ident = id_result.scalar_one_or_none()
        if ident:
            identifiers.append({
                "id": str(ident.id),
                "id_type": ident.id_type,
                "id_value": ident.id_value,
                "normalized_value": ident.normalized_value,
                "review_state": link.review_state.value if link.review_state else "new",
            })

    return {
        "entity": entity,
        "identifiers": identifiers,
    }
