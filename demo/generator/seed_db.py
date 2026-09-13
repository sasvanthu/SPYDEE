import os
import sys
import json
import uuid
import asyncio
import hashlib
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "services", "api"))

from app.config import get_settings
from app.database import Base, engine, async_session
from app.models.models import (
    User, Case, CaseMembership, EvidenceFile, Import, SourceRecord,
    Entity, Identifier, EntityIdentifierLink, Relationship, Event,
    EventParticipant, RelationshipEvidence, AnalysisRun, Signal,
    Hypothesis, HypothesisSignal, ReviewAction, AuditEvent, Job
)
from app.auth.auth import hash_password


async def seed():
    settings = get_settings()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        admin = User(
            username="admin",
            email="admin@spydee.example",
            hashed_password=hash_password("admin123"),
            display_name="System Administrator",
            role="administrator",
        )
        db.add(admin)

        inv1 = User(
            username="investigator",
            email="investigator@spydee.example",
            hashed_password=hash_password("invest123"),
            display_name="Senior Investigator",
            role="investigator",
        )
        db.add(inv1)

        sup = User(
            username="supervisor",
            email="supervisor@spydee.example",
            hashed_password=hash_password("super123"),
            display_name="Case Supervisor",
            role="case_supervisor",
        )
        db.add(sup)
        await db.flush()

        case_a = Case(
            title="Broken Chain - Network Continuity Analysis",
            case_code="BRK-2026-001",
            description="Analysis of alias continuity across devices, locations and communication patterns. Synthetic demonstration case.",
            status="active",
            is_synthetic=True,
            created_by=admin.id,
        )
        case_b = Case(
            title="Harbor Ledger - Financial Network Analysis",
            case_code="HBR-2026-002",
            description="Transaction paths and infrastructure relationships. Synthetic demonstration case.",
            status="active",
            is_synthetic=True,
            created_by=admin.id,
        )
        case_c = Case(
            title="Quiet Market - Negative Control Case",
            case_code="QTM-2026-003",
            description="Mostly unrelated records with insufficient writing samples. Should not produce strong leads. Synthetic demonstration case.",
            status="active",
            is_synthetic=True,
            created_by=admin.id,
        )
        db.add_all([case_a, case_b, case_c])
        await db.flush()

        for case in [case_a, case_b, case_c]:
            for user in [admin, inv1, sup]:
                role = "administrator" if user == admin else ("case_supervisor" if user == sup else "investigator")
                membership = CaseMembership(
                    case_id=case.id,
                    user_id=user.id,
                    role=role,
                    granted_by=admin.id,
                )
                db.add(membership)

        await db.flush()

        batches_dir = os.path.join(os.path.dirname(__file__), "..", "import-batches")
        ground_dir = os.path.join(os.path.dirname(__file__), "..", "ground-truth")

        case_files = {
            case_a.id: [
                ("case_a_batch1_cdr.json", "cdr", "Call detail records"),
                ("case_a_batch2_messages.json", "messages", "Message records"),
                ("case_a_batch3_devices_locs.json", "device_sim", "Device and location observations"),
                ("case_a_batch4_transactions.json", "transactions", "Financial transactions"),
            ],
            case_b.id: [
                ("case_b_harbor_ledger.json", "transactions", "Financial and infrastructure records"),
            ],
            case_c.id: [
                ("case_c_quiet_market.json", "cdr", "Limited call records"),
            ],
        }

        entity_counter = 0
        identifier_counter = 0
        event_counter = 0

        for case_id, files in case_files.items():
            for filename, source_type, desc in files:
                filepath = os.path.join(batches_dir, filename)
                if not os.path.exists(filepath):
                    print(f"  Warning: {filepath} not found, skipping")
                    continue

                with open(filepath, "r") as f:
                    records = json.load(f)

                file_content = json.dumps(records).encode()
                sha256 = hashlib.sha256(file_content).hexdigest()

                ext = filename.rsplit(".", 1)[-1]
                storage_name = f"{sha256[:16]}.{ext}"
                storage_path = os.path.join(str(case_id), storage_name)
                upload_dir = os.path.join(settings.UPLOAD_DIR, str(case_id))
                os.makedirs(upload_dir, exist_ok=True)
                full_path = os.path.join(upload_dir, storage_name)
                with open(full_path, "w") as f:
                    json.dump(records, f)

                ev = EvidenceFile(
                    case_id=case_id,
                    original_filename=filename,
                    media_type="application/json",
                    byte_size=len(file_content),
                    sha256=sha256,
                    storage_path=storage_path,
                    source_type=source_type,
                    source_description=desc,
                    uploaded_by=admin.id,
                    parser_version="json_importer_v1",
                    status="imported",
                    accepted_count=len(records),
                    rejected_count=0,
                )
                db.add(ev)
                await db.flush()

                imp = Import(
                    evidence_file_id=ev.id,
                    case_id=case_id,
                    import_config={"source_type": source_type, "count": len(records)},
                    status="completed",
                    accepted_count=len(records),
                    rejected_count=0,
                    completed_at=datetime.utcnow(),
                )
                db.add(imp)
                await db.flush()

                entity_cache = {}
                for idx, rec in enumerate(records):
                    rec_hash = hashlib.sha256(json.dumps(rec, sort_keys=True).encode()).hexdigest()
                    sr = SourceRecord(
                        case_id=case_id,
                        import_id=imp.id,
                        evidence_file_id=ev.id,
                        row_locator=f"row:{idx + 1}",
                        original_content=rec,
                        normalized_content=rec,
                        normalized_hash=rec_hash,
                        parser_version="json_importer_v1",
                        is_duplicate=False,
                    )
                    db.add(sr)
                    await db.flush()

                    participants = []
                    for field in ["caller_id", "callee_id", "alias_id", "from_account_id", "to_account_id", "entity_or_device_id"]:
                        val = rec.get(field)
                        if val and val not in entity_cache:
                            etype = "phone_sim" if "phone" in field or "caller" in field or "callee" in field else (
                                "alias" if "alias" in field else (
                                    "account" if "account" in field else "device"
                                )
                            )
                            entity = Entity(
                                case_id=case_id,
                                entity_type=etype,
                                label=val,
                            )
                            db.add(entity)
                            await db.flush()
                            entity_cache[val] = entity

                            ident = Identifier(
                                case_id=case_id,
                                id_type=etype,
                                id_value=val,
                                normalized_value=val.lower().strip(),
                            )
                            db.add(ident)
                            await db.flush()

                            link = EntityIdentifierLink(
                                entity_id=entity.id,
                                identifier_id=ident.id,
                                confidence=1.0,
                            )
                            db.add(link)
                            entity_counter += 1
                            identifier_counter += 1

                        if val and val in entity_cache:
                            participants.append(entity_cache[val])

                    if "start_time" in rec or "event_time" in rec or "timestamp" in rec:
                        ts = rec.get("start_time") or rec.get("event_time") or rec.get("timestamp")
                        try:
                            dt = datetime.fromisoformat(ts.replace("Z", "+00:00").split("+")[0])
                        except:
                            dt = None

                        if dt:
                            etype = "call" if "caller_id" in rec else (
                                "message" if "text" in rec else (
                                    "transaction" if "amount" in rec else (
                                        "device_event" if "event_type" in rec else "observation"
                                    )
                                )
                            )
                            event = Event(
                                case_id=case_id,
                                event_type=etype,
                                start_time=dt,
                                original_timestamp=ts,
                                source_record_id=sr.id,
                                details=rec,
                            )
                            db.add(event)
                            await db.flush()
                            event_counter += 1

                            for p in participants[:2]:
                                ep = EventParticipant(event_id=event.id, entity_id=p.id)
                                db.add(ep)

                    if "caller_id" in rec and "callee_id" in rec:
                        caller_ent = entity_cache.get(rec["caller_id"])
                        callee_ent = entity_cache.get(rec["callee_id"])
                        if caller_ent and callee_ent and caller_ent.id != callee_ent.id:
                            rel = Relationship(
                                case_id=case_id,
                                source_entity_id=caller_ent.id,
                                target_entity_id=callee_ent.id,
                                relationship_type="CALLED",
                                classification="observed",
                                evidence_count=1,
                            )
                            db.add(rel)
                            await db.flush()

        await db.commit()
        print(f"Seeded: {entity_counter} entities, {identifier_counter} identifiers, {event_counter} events")
        print("Database seeded successfully.")


if __name__ == "__main__":
    asyncio.run(seed())
