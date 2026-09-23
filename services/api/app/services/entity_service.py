"""
SPYDEE Entity Resolution Engine.

Deterministically resolves identifiers into entities, persists derived
events/relationships for imported evidence, and generates review-gated merge
suggestions when physical hardware or financial rails are shared.
"""
import re
import uuid
import json
import hashlib
from datetime import datetime
from typing import Iterable, List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.models import (
    Entity, Identifier, EntityIdentifierLink, EntityType, ReviewState,
    Event, EventParticipant, Relationship, RelationshipEvidence,
    SourceRecord, MergeSuggestion, RelationshipDirection, EntityReviewDecision,
)

# ─── Identifier type → Entity type ───────────────────────────────────────────

IDENT_TYPE_TO_ENTITY = {
    "phone": EntityType.PHONE_SIM,
    "sim": EntityType.PHONE_SIM,
    "msisdn": EntityType.PHONE_SIM,
    "imsi": EntityType.PHONE_SIM,
    "imei": EntityType.DEVICE,
    "device": EntityType.DEVICE,
    "account": EntityType.ACCOUNT,
    "upi": EntityType.ACCOUNT,
    "bank_account": EntityType.ACCOUNT,
    "credit_card": EntityType.ACCOUNT,
    "ip": EntityType.DOMAIN_IP,
    "mac": EntityType.DOMAIN_IP,
    "domain": EntityType.DOMAIN_IP,
    "email": EntityType.PERSON,
    "alias": EntityType.ALIAS,
    "handle": EntityType.ALIAS,
    "name": EntityType.PERSON,
    "tower": EntityType.LOCATION,
    "cell": EntityType.LOCATION,
    "vehicle": EntityType.VEHICLE,
    "vehicle_reg": EntityType.VEHICLE,
    "bank": EntityType.ORGANIZATION,
    "organization": EntityType.ORGANIZATION,
}

# Canonical field names → (id_type, kind) where kind ∈ {single, caller, callee, src, dst}
FIELD_TO_IDENTIFIER = [
    # telecom CDR / IPDR
    ("caller_id", "phone", "caller"), ("callee_id", "phone", "callee"),
    ("calling_number", "phone", "caller"), ("called_number", "phone", "callee"),
    ("a_number", "phone", "caller"), ("b_number", "phone", "callee"),
    ("msisdn", "phone", "single"), ("phone_number", "phone", "single"),
    ("phone_id", "phone", "single"), ("mobile", "phone", "single"),
    ("calling_imsi", "imsi", "caller"), ("called_imsi", "imsi", "callee"),
    ("imsi", "imsi", "single"),
    ("calling_imei", "imei", "caller"), ("called_imei", "imei", "callee"),
    ("imei", "imei", "single"),
    ("first_octet_ip", "ip", "caller"), ("last_octet_ip", "ip", "callee"),
    ("source_ip", "ip", "caller"), ("destination_ip", "ip", "callee"),
    ("ip_address", "ip", "single"),
    # device / SIM events
    ("device_id", "device", "single"), ("equipment_id", "device", "single"),
    ("device_imei", "imei", "single"), ("sim_id", "sim", "sim"),
    ("mac_address", "mac", "single"),
    # financial
    ("from_account_id", "account", "src"), ("to_account_id", "account", "dst"),
    ("sender_account", "account", "src"), ("receiver_account", "account", "dst"),
    ("account_id", "account", "single"), ("bank_account", "account", "single"),
    ("from_upi", "upi", "src"), ("to_upi", "upi", "dst"),
    ("sender_upi", "upi", "src"), ("receiver_upi", "upi", "dst"),
    ("upi_id", "upi", "single"),
    ("sender_card", "credit_card", "src"), ("receiver_card", "credit_card", "dst"),
    # chat / forensics
    ("alias_id", "alias", "single"), ("sender_alias", "alias", "single"),
    ("target_alias", "alias", "callee"), ("source_alias", "alias", "caller"),
    ("handle", "handle", "single"),
    ("email", "email", "single"), ("email_address", "email", "single"),
    # location / infra
    ("tower_id", "tower", "single"), ("cell_tower_id", "tower", "single"),
    ("cell_id", "tower", "single"), ("lac", "tower", "single"),
    ("location_id", "tower", "single"),
    ("domain", "domain", "single"),
    # vehicle / org
    ("vehicle_registration", "vehicle", "single"), ("vehicle", "vehicle", "single"),
    ("organization", "organization", "single"), ("bank_name", "bank", "single"),
]

# Field names that carry human-readable names
NAME_FIELDS = {"name", "person_name", "customer_name", "account_holder",
               "sender_name", "receiver_name", "record_owner"}

_PHONE_DIGITS = re.compile(r"\D+")


def e164_normalize(value: str) -> str:
    """Normalize an Indian MSISDN to canonical 10-digit form (E.164-context).
    Handles ``+91`` prefixes, ``0`` local prefixes and stray formatting."""
    if value is None:
        return ""
    digits = _PHONE_DIGITS.sub("", str(value).strip())
    if not digits:
        return ""
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("091"):
        digits = digits[3:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    elif len(digits) == 13 and digits.startswith("910"):
        digits = digits[3:]
    if len(digits) < 10:
        return ""
    return digits


def normalize_identifier(id_type: str, value: str) -> str:
    v = str(value).strip() if value is not None else ""
    if not v:
        return v
    if id_type in ("phone", "sim", "msisdn"):
        return e164_normalize(v)
    if id_type == "imsi":
        return _PHONE_DIGITS.sub("", v)
    if id_type == "imei":
        return _PHONE_DIGITS.sub("", v)[:17]
    if id_type in ("device", "mac"):
        return re.sub(r"[^0-9A-Fa-f]", "", v).upper()
    if id_type in ("account", "upi", "bank_account", "credit_card", "email", "domain", "alias", "handle", "name"):
        return v.lower().strip()
    if id_type == "ip":
        return v.strip().lower()
    if id_type in ("tower", "cell", "vehicle", "vehicle_reg", "bank", "organization"):
        return v.strip().upper()
    return v.strip().lower()


def entity_type_for_identifier(id_type: str) -> EntityType:
    return IDENT_TYPE_TO_ENTITY.get(id_type, EntityType.PERSON)


def extract_identifiers(record: dict) -> List[Tuple[str, str]]:
    """Extract (id_type, raw_value) pairs from a normalized record, deduplicated
    by canonical (id_type, normalized_value)."""
    if not isinstance(record, dict):
        return []
    out: dict = {}
    for field, id_type, _kind in FIELD_TO_IDENTIFIER:
        val = record.get(field)
        if val is None or str(val) == "":
            continue
        norm = normalize_identifier(id_type, val)
        if not norm:
            continue
        key = (id_type, norm)
        if key not in out:
            out[key] = (id_type, str(val))
    for field in NAME_FIELDS:
        val = record.get(field)
        if val and str(val).strip():
            out[("name", normalize_identifier("name", val))] = ("name", str(val))
    # Reverse-ordered to keep deterministic (sorted by key)
    return [out[k] for k in sorted(out.keys())]


def event_type_for_record(record: dict) -> str:
    if record.get("event_type"):
        return str(record["event_type"]).lower()
    if "caller_id" in record or "callee_id" in record:
        return "call"
    if "text" in record or "message_text" in record:
        return "message"
    if "amount" in record:
        return "transaction"
    if record.get("observation_type"):
        return str(record["observation_type"]).lower()
    if "tower_id" in record or "cell_tower_id" in record:
        return "tower_observation"
    return "observation"


def parse_datetime(value) -> Optional[datetime]:
    """Deterministic datetime parser for ingested strings / datetimes."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    text = str(value).strip().replace("Z", "+00:00")
    if "." in text and "+" in text:
        # Normalize fractional seconds before offset (e.g. 2026-08-01T08:00:00.123+00:00)
        head, _, tail = text.partition("+")
        if head.count(":") == 2 and "." in head:
            try:
                return datetime.fromisoformat(head).replace(tzinfo=None)
            except ValueError:
                pass
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S%z",
                "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%d %H:%M:%S.%f",
                "%Y/%m/%d %H:%M:%S", "%d-%m-%Y %H:%M:%S",
                "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %I:%M:%S %p",
                "%d-%m-%Y %I:%M:%S %p", "%Y-%m-%d %I:%M:%S %p",
                "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=None)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text).replace(tzinfo=None)
    except ValueError:
        return None


def canonical_hash(record: dict) -> str:
    """Deterministic SHA-256 over the canonical normalized record."""
    payload = json.dumps(record, sort_keys=True, default=str, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


# ─── Resolution primitives ───────────────────────────────────────────────────

async def _load_identifier_map(db: AsyncSession, case_id: uuid.UUID):
    """Load {id_type: {normalized_value: (identifier_id, entity_id)}} for a case."""
    rows = await db.execute(
        select(Identifier, EntityIdentifierLink)
        .join(EntityIdentifierLink, EntityIdentifierLink.identifier_id == Identifier.id)
        .where(Identifier.case_id == case_id)
    )
    mapping: dict = {}
    for identifier, link in rows.all():
        mapping.setdefault(identifier.id_type, {})[identifier.normalized_value] = (
            identifier.id, link.entity_id)
    return mapping


async def resolve_identifier(
    db: AsyncSession,
    case_id: uuid.UUID,
    id_type: str,
    id_value: str,
    source_record_id: uuid.UUID = None,
    cache: dict = None,
) -> Tuple[Identifier, Entity]:
    norm = normalize_identifier(id_type, id_value)
    if cache is None:
        cache = await _load_identifier_map(db, case_id)
    bucket = cache.setdefault(id_type, {})
    if norm in bucket:
        ident_id, entity_id = bucket[norm]
        ident = await db.get(Identifier, ident_id)
        entity = await db.get(Entity, entity_id)
        if ident and entity:
            return ident, entity

    entity = Entity(
        case_id=case_id,
        entity_type=entity_type_for_identifier(id_type),
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

    bucket[norm] = (identifier.id, entity.id)
    return identifier, entity


async def upsert_relationship(
    db: AsyncSession,
    case_id: uuid.UUID,
    source_entity_id: uuid.UUID,
    target_entity_id: uuid.UUID,
    relationship_type: str,
    record_id: uuid.UUID,
    event_id: uuid.UUID = None,
    valid_from: datetime = None,
    valid_to: datetime = None,
    by_evidence_count: int = 1,
    cache: dict = None,
) -> Relationship:
    if cache is None:
        cache = {}
    key = (str(source_entity_id), str(target_entity_id), relationship_type)
    rel = cache.get(key)
    if rel is None:
        result = await db.execute(
            select(Relationship).where(
                Relationship.case_id == case_id,
                Relationship.source_entity_id == source_entity_id,
                Relationship.target_entity_id == target_entity_id,
                Relationship.relationship_type == relationship_type,
            )
        )
        rel = result.scalars().first()
    if rel is None:
        rel = Relationship(
            case_id=case_id,
            source_entity_id=source_entity_id,
            target_entity_id=target_entity_id,
            relationship_type=relationship_type,
            classification="observed",
            evidence_count=by_evidence_count,
            valid_from=valid_from,
            valid_to=valid_to,
        )
        db.add(rel)
        await db.flush()
    else:
        rel.evidence_count += by_evidence_count
        if valid_from and (rel.valid_from is None or valid_from < rel.valid_from):
            rel.valid_from = valid_from
        if valid_to and (rel.valid_to is None or valid_to > rel.valid_to):
            rel.valid_to = valid_to
    cache[key] = rel

    db.add(RelationshipEvidence(
        relationship_id=rel.id,
        source_record_id=record_id,
        event_id=event_id,
        weight=1.0,
    ))
    return rel


async def link_record_entities(
    db: AsyncSession,
    case_id: uuid.UUID,
    source_record: SourceRecord,
    ident_cache: dict = None,
    rel_cache: dict = None,
) -> Tuple[int, int, int]:
    """Link identifiers of one SourceRecord, create its Event, EventParticipants
    and any Relationship rows. Returns (events_created, relationships_created,
    identifiers_created)."""
    record = source_record.normalized_content or {}
    if not isinstance(record, dict) or not record:
        return 0, 0, 0

    events_created = 0
    relationships_created = 0
    identifiers_created = 0

    extracted = extract_identifiers(record)
    resolved = []
    for id_type, raw in extracted:
        identifier, entity = await resolve_identifier(
            db, case_id, id_type, raw, source_record.id, cache=ident_cache)
        resolved.append((identifier, entity))
        identifiers_created += 1

    # Tower entity with coordinates
    tower_entity = None
    tower_norm = None
    for field in ("tower_id", "cell_tower_id", "cell_id", "location_id",
                  "caller_tower_id", "callee_tower_id"):
        raw = record.get(field)
        if raw:
            tower_entity = await _resolve_tower(db, case_id, field, raw, record, source_record.id, ident_cache)
            tower_norm = raw
            break

    ts = parse_datetime(record.get("start_time") or record.get("event_time")
                        or record.get("timestamp") or record.get("first_seen"))
    event_type = event_type_for_record(record)

    # Direction-aware participant ordering for directed observations
    ordered = resolved[:]
    if any(k in record for k in ("caller_id", "calling_number", "a_number", "from_account_id",
                                 "sender_account", "from_upi", "sender_alias")):
        pass  # rely on extraction order (caller/src first)
    if ordered or tower_entity or (ts is not None and event_type):
        event = Event(
            case_id=case_id,
            event_type=event_type,
            start_time=ts,
            end_time=parse_datetime(record.get("end_time") or record.get("last_seen")),
            original_timestamp=record.get("timestamp") or record.get("start_time"),
            source_timezone=record.get("timezone") or record.get("source_timezone"),
            location_id=tower_entity.id if tower_entity else None,
            source_record_id=source_record.id,
            details=record,
        )
        db.add(event)
        await db.flush()
        events_created += 1

        seen_participants = set()
        for i, (_ident, ent) in enumerate(ordered):
            if ent.id in seen_participants:
                continue
            seen_participants.add(ent.id)
            db.add(EventParticipant(
                event_id=event.id, entity_id=ent.id,
                role="source" if i == 0 else ("target" if i == 1 else "other"),
            ))
    else:
        event = None

    # Communications / transactions create directed relationships
    if len(ordered) >= 2:
        if any(k in record for k in ("caller_id", "calling_number", "a_number")):
            rel_type = "CALLED"
        elif any(k in record for k in ("from_account_id", "sender_account", "from_upi", "sender_card")):
            rel_type = "TRANSFERRED"
        elif any(k in record for k in ("alias_id", "sender_alias", "source_alias", "handle")):
            rel_type = "MESSAGED"
        else:
            rel_type = None
        if rel_type:
            src = ordered[0][1]
            tgt = ordered[1][1]
            if src.id != tgt.id:
                await upsert_relationship(
                    db, case_id, src.id, tgt.id, rel_type,
                    source_record.id,
                    event_id=event.id if event else None,
                    valid_from=ts, valid_to=ts,
                    cache=rel_cache,
                )
                relationships_created += 1

    # SIM/phone participation for device continuity records
    if record.get("device_id") or record.get("sim_id") or record.get("phone_id"):
        pass  # handled by device_engine reading normalized_content

    return events_created, relationships_created, identifiers_created


async def _resolve_tower(db, case_id, field, raw, record, source_record_id, ident_cache):
    ident, entity = await resolve_identifier(db, case_id, "tower", raw, source_record_id, cache=ident_cache)
    lat = _num(record.get("lat") or record.get("latitude"))
    lon = _num(record.get("lon") or record.get("longitude"))
    attrs = dict(entity.attributes or {})
    if lat is not None and lon is not None:
        attrs["lat"] = lat
        attrs["lon"] = lon
    for k in ("accuracy", "radius", "azimuth"):
        v = _num(record.get(k))
        if v is not None:
            attrs[k] = v
    if attrs and (attrs != entity.attributes):
        entity.attributes = attrs
    return entity


def _num(v):
    try:
        if v is None or v == "":
            return None
        return float(str(v).strip())
    except (TypeError, ValueError):
        return None


async def persist_derived_structure(
    db: AsyncSession,
    case_id: uuid.UUID,
    source_records: Iterable[SourceRecord],
    ident_cache: dict = None,
    rel_cache: dict = None,
) -> dict:
    """Process a batch of SourceRecords into Entities/Identifiers/Events/
    Relationships. Fully deterministic given stable input ordering."""
    if ident_cache is None:
        ident_cache = await _load_identifier_map(db, case_id)
    if rel_cache is None:
        rel_cache = {}
    totals = {"events": 0, "relationships": 0, "identifiers": 0}
    for sr in source_records:
        e, r, i = await link_record_entities(db, case_id, sr, ident_cache, rel_cache)
        totals["events"] += e
        totals["relationships"] += r
        totals["identifiers"] += i
    return totals


async def generate_merge_suggestions(db: AsyncSession, case_id: uuid.UUID) -> List[MergeSuggestion]:
    """Create MergeSuggestion rows when distinct entities share physical
    hardware (device/IMEI) or financial rails (bank account)."""
    result = await db.execute(
        select(SourceRecord)
        .where(SourceRecord.case_id == case_id, SourceRecord.is_duplicate == False)  # noqa: E712
    )
    records = result.scalars().all()

    # device_id → [(link_type, entity_id)] from identifier map
    ident_map = await _load_identifier_map(db, case_id)
    ent_by_id = {}
    ent_result = await db.execute(select(Entity).where(Entity.case_id == case_id))
    for ent in ent_result.scalars().all():
        ent_by_id[str(ent.id)] = ent

    def entity_for(etype, norm):
        bucket = ident_map.get(etype, {})
        hit = bucket.get(norm)
        if hit:
            return ent_by_id.get(str(hit[1]))
        return None

    hardware_groups = {}
    for rec in records:
        c = rec.normalized_content or {}
        device_val = c.get("device_id") or c.get("equipment_id") or c.get("device_imei")
        if not device_val:
            continue
        dev_norm = normalize_identifier("device", device_val) if not c.get("device_imei") else normalize_identifier("imei", device_val)
        key = dev_norm or str(device_val)
        group = hardware_groups.setdefault(key, {"record_ids": [], "phone_sim": set()})
        group["record_ids"].append(str(rec.id))
        phone_ent = entity_for("phone", normalize_identifier("phone", c.get("phone_id") or c.get("caller_id") or ""))
        sim_ent = entity_for("sim", normalize_identifier("sim", c.get("sim_id") or ""))
        for ent in (phone_ent, sim_ent):
            if ent is not None:
                group["phone_sim"].add(str(ent.id))

    suggestions = []
    seen = set()
    for dev_key, group in hardware_groups.items():
        members = list(group["phone_sim"])
        record_ids = group["record_ids"]
        if len(members) < 2:
            continue
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                pair = tuple(sorted((members[i], members[j])))
                if pair in seen:
                    continue
                seen.add(pair)
                confidence = min(1.0, len(record_ids) / 5.0)
                suggestions.append(MergeSuggestion(
                    case_id=case_id,
                    primary_entity_id=uuid.UUID(pair[0]),
                    secondary_entity_id=uuid.UUID(pair[1]),
                    basis="shared_device",
                    confidence=round(confidence, 4),
                    evidence_record_ids=record_ids[:20],
                    reason=(
                        f"Entities {pair[0][:8]} and {pair[1][:8]} were both observed "
                        f"registering on the same physical device across "
                        f"{len(record_ids)} device records."
                    ),
                ))

    # Unduplicated financial rails: same account, distinct counterpart names
    account_holders = {}
    for rec in records:
        c = rec.normalized_content or {}
        acct = c.get("account_id") or c.get("bank_account")
        holder = c.get("account_holder") or c.get("customer_name") or c.get("name")
        if acct and holder:
            norm = normalize_identifier("account", acct)
            account_holders.setdefault(norm, set()).add(str(holder).strip().lower())

    ident_map2 = await _load_identifier_map(db, case_id)
    for acct_norm, holders in account_holders.items():
        if len(holders) < 2:
            continue
        acc = ident_map2.get("account", {}).get(acct_norm)
        holders_sorted = sorted(holders)
        # Enrich via name identifiers
        name_ids = []
        for h in holders_sorted:
            ent = entity_for("name", h)
            if ent:
                name_ids.append(ent.id)
        if acc is None or len(name_ids) < 2:
            continue
        for i in range(len(name_ids)):
            for j in range(i + 1, len(name_ids)):
                pair = tuple(sorted((str(name_ids[i]), str(name_ids[j]))))
                if pair in seen or name_ids[i] == name_ids[j]:
                    continue
                seen.add(pair)
                suggestions.append(MergeSuggestion(
                    case_id=case_id,
                    primary_entity_id=uuid.UUID(pair[0]),
                    secondary_entity_id=uuid.UUID(pair[1]),
                    basis="shared_account",
                    confidence=0.7,
                    evidence_record_ids=[],
                    reason=(
                        f"Two distinct names ({holders_sorted[i]}, {holders_sorted[j]}) are "
                        f"recorded against the same bank account {acct_norm}."
                    ),
                ))

    if suggestions:
        db.add_all(suggestions)
        await db.flush()
    return suggestions


async def get_merge_suggestions(db: AsyncSession, case_id: uuid.UUID) -> List[dict]:
    result = await db.execute(
        select(MergeSuggestion).where(MergeSuggestion.case_id == case_id)
        .order_by(MergeSuggestion.confidence.desc())
    )
    out = []
    for m in result.scalars().all():
        out.append({
            "id": str(m.id),
            "primary_entity_id": str(m.primary_entity_id),
            "secondary_entity_id": str(m.secondary_entity_id),
            "basis": m.basis,
            "confidence": m.confidence,
            "evidence_record_ids": m.evidence_record_ids or [],
            "reason": m.reason,
            "review_state": m.review_state.value if m.review_state else "new",
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })
    return out


async def apply_merge_suggestion(
    db: AsyncSession, case_id: uuid.UUID, suggestion_id: uuid.UUID, reviewer_id: uuid.UUID
) -> Entity:
    """Merge secondary entity into primary entity deterministically."""
    result = await db.execute(
        select(MergeSuggestion).where(MergeSuggestion.id == suggestion_id,
                                      MergeSuggestion.case_id == case_id)
    )
    sug = result.scalar_one_or_none()
    if not sug:
        raise ValueError("Merge suggestion not found")

    primary = await db.get(Entity, sug.primary_entity_id)
    secondary = await db.get(Entity, sug.secondary_entity_id)
    if not primary or not secondary:
        raise ValueError("Entity not found")

    # Record exactly what moves onto the primary so the merge can be reverted.
    manifest = {"identifier_links": [], "event_participants": [], "relationships": []}

    link_result = await db.execute(
        select(EntityIdentifierLink).where(EntityIdentifierLink.entity_id == secondary.id)
    )
    for link in link_result.scalars().all():
        manifest["identifier_links"].append(str(link.id))
        link.entity_id = primary.id
    await db.flush()

    rows = await db.execute(select(EventParticipant).where(EventParticipant.entity_id == secondary.id))
    for row in rows.scalars().all():
        manifest["event_participants"].append(str(row.id))
        row.entity_id = primary.id
    await db.flush()

    rel_result = await db.execute(
        select(Relationship).where(
            (Relationship.source_entity_id == secondary.id) |
            (Relationship.target_entity_id == secondary.id)
        )
    )
    for rel in rel_result.scalars().all():
        ends = []
        if rel.source_entity_id == secondary.id:
            ends.append("source")
            rel.source_entity_id = primary.id
        if rel.target_entity_id == secondary.id:
            ends.append("target")
            rel.target_entity_id = primary.id
        manifest["relationships"].append({"id": str(rel.id), "ends": ends})
    await db.flush()

    secondary.review_state = ReviewState.ARCHIVED
    sug.review_state = ReviewState.SUPPORTED
    sug.resolved_at = datetime.utcnow()
    sug.merge_manifest = manifest
    await db.flush()
    return primary


async def revert_merge_suggestion(
    db: AsyncSession, case_id: uuid.UUID, suggestion_id: uuid.UUID, reviewer_id: uuid.UUID
) -> Entity:
    """Reverse an investigator-approved merge using the stored manifest.

    Identifier links, event participants and relationship endpoints recorded
    as moved on to the primary entity are restored to the secondary entity, and
    the archived entity is reactivated. The suggestion returns to NEW so it can
    be re-evaluated and re-applied if warranted.
    """
    from app.services.case_service import log_audit_event

    result = await db.execute(
        select(MergeSuggestion).where(MergeSuggestion.id == suggestion_id,
                                      MergeSuggestion.case_id == case_id)
    )
    sug = result.scalar_one_or_none()
    if not sug:
        raise ValueError("Merge suggestion not found")
    if sug.review_state != ReviewState.SUPPORTED or sug.resolved_at is None:
        raise ValueError("Merge suggestion is not currently applied")

    primary = await db.get(Entity, sug.primary_entity_id)
    secondary = await db.get(Entity, sug.secondary_entity_id)
    if not primary or not secondary:
        raise ValueError("Entity not found")

    manifest = sug.merge_manifest or {
        "identifier_links": [], "event_participants": [], "relationships": []
    }

    link_ids = [uuid.UUID(x) for x in manifest.get("identifier_links", [])]
    if link_ids:
        links = (await db.execute(
            select(EntityIdentifierLink).where(EntityIdentifierLink.id.in_(link_ids))
        )).scalars().all()
        for link in links:
            link.entity_id = secondary.id
    await db.flush()

    participant_ids = [uuid.UUID(x) for x in manifest.get("event_participants", [])]
    if participant_ids:
        participants = (await db.execute(
            select(EventParticipant).where(EventParticipant.id.in_(participant_ids))
        )).scalars().all()
        for p in participants:
            p.entity_id = secondary.id
    await db.flush()

    rel_ids = [uuid.UUID(x["id"]) for x in manifest.get("relationships", [])]
    if rel_ids:
        rels = (await db.execute(
            select(Relationship).where(Relationship.id.in_(rel_ids))
        )).scalars().all()
        by_id = {str(r.id): r for r in rels}
        for move in manifest.get("relationships", []):
            rel = by_id.get(move["id"])
            if rel is None:
                continue
            ends = move.get("ends", [])
            if "source" in ends:
                rel.source_entity_id = secondary.id
            if "target" in ends:
                rel.target_entity_id = secondary.id
    await db.flush()

    secondary.review_state = ReviewState.NEW
    sug.review_state = ReviewState.NEW
    sug.resolved_at = None
    sug.merge_manifest = None
    await log_audit_event(db, case_id, reviewer_id, "merge_reverted", "entity", secondary.id,
                          {"primary": str(primary.id), "secondary": str(secondary.id)})
    await db.flush()
    return secondary


async def get_entity_review_history(db: AsyncSession, entity_id: uuid.UUID) -> List[dict]:
    """Return the recorded EntityReviewDecision rows for an entity."""
    result = await db.execute(
        select(EntityReviewDecision)
        .where(EntityReviewDecision.entity_id == entity_id)
        .order_by(EntityReviewDecision.created_at.desc())
    )
    return [
        {
            "id": str(d.id),
            "reviewer_id": str(d.reviewer_id),
            "decision": d.decision,
            "note": d.note,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in result.scalars().all()
    ]


async def get_entity_profile(db: AsyncSession, entity_id: uuid.UUID) -> Optional[dict]:
    """Return an entity together with its identifier links for the API surface."""
    result = await db.execute(select(Entity).where(Entity.id == entity_id))
    entity = result.scalar_one_or_none()
    if not entity:
        return None

    link_result = await db.execute(
        select(EntityIdentifierLink).where(EntityIdentifierLink.entity_id == entity_id)
    )
    identifiers = []
    for link in link_result.scalars().all():
        ident_result = await db.execute(select(Identifier).where(Identifier.id == link.identifier_id))
        ident = ident_result.scalar_one_or_none()
        if ident:
            identifiers.append({
                "id": ident.id,
                "id_type": ident.id_type,
                "id_value": ident.id_value,
                "normalized_value": ident.normalized_value,
                "review_state": link.review_state.value if link.review_state else "new",
            })
    return {"entity": entity, "identifiers": identifiers}