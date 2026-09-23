"""
SPYDEE: Real India-First Datasets Case Ingestion Script
Case: IND-2026-004 (Operation Trishul - Bangalore SafeCity & UPI Mule Network)
Integrates:
- UPI Transactions 2024 & UPI Fraud (NPCI UPI Mule & Structuring Topology)
- UVH-26 IISc Bengaluru Safe-City CCTV & IMFDB Indian Face Recognition
- TRAI Karnataka LSA Telecom Mobility & Bangalore City Traffic
- InLegalNER & IndianBailJudgments-1200 FIR, Legal Provisions & Hinglish Stylometry
"""

import os
import sys
import json
import uuid
import asyncio
import hashlib
from datetime import datetime

# Ensure services/api is in sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "services", "api"))
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from sqlalchemy import select
from app.config import get_settings
from app.database import Base, engine, async_session
from app.models.models import (
    User, Case, CaseMembership, EvidenceFile, Import, SourceRecord,
    Entity, Identifier, EntityIdentifierLink, Relationship, Event,
    EventParticipant, Signal, Hypothesis, HypothesisSignal
)

BATCHES_DIR = os.path.join(os.path.dirname(__file__), "..", "import-batches")

CASE_FILES = [
    ("case_ind_batch1_upi.json", "transactions", "NPCI UPI Mule Transactions & Structuring Network (UPI 2024 / Fraud Dataset)"),
    ("case_ind_batch2_uvh26_cctv.json", "CCTV", "Bengaluru Safe-City Camera Surveillance & IMFDB Face Detections (UVH-26 / IMFDB)"),
    ("case_ind_batch3_trai_cdr.json", "cdr", "Karnataka LSA Cellular CDR & Cell Tower Mobility (TRAI / Traffic)"),
    ("case_ind_batch4_inlegal_fir.json", "messages", "Cyber Crime PS FIR No 142/2026 & Accused Intercepts (InLegalNER / IndianBail)"),
]

async def seed_india_case():
    settings = get_settings()
    print("=" * 70)
    print(" Ingesting Real-Data India Case: IND-2026-004 (Operation Trishul)")
    print("=" * 70)

    async with async_session() as db:
        # Check if case already exists
        existing_case = await db.execute(select(Case).where(Case.case_code == "IND-2026-004"))
        c_inst = existing_case.scalar_one_or_none()
        if c_inst:
            print(f"  [INFO] Case IND-2026-004 already exists (ID: {c_inst.id}). Skipping re-creation.")
            return c_inst.id

        # Get existing users
        res_admin = await db.execute(select(User).where(User.username == "admin"))
        admin = res_admin.scalar_one_or_none()
        if not admin:
            print("  [ERROR] Admin user not found. Please run seed_db first.")
            return None

        res_inv = await db.execute(select(User).where(User.username == "investigator"))
        inv = res_inv.scalar_one_or_none()

        res_sup = await db.execute(select(User).where(User.username == "supervisor"))
        sup = res_sup.scalar_one_or_none()

        # 1. Create Case IND-2026-004
        india_case = Case(
            title="Operation Trishul - Bangalore SafeCity & UPI Mule Network",
            case_code="IND-2026-004",
            description=(
                "Real-world investigative case bundle fusing IISc Bengaluru UVH-26 Safe-City CCTV surveillance, "
                "NPCI UPI multi-tier money mule structuring, InLegalNER legal FIR filings, and Karnataka TRAI telecom CDR mobility."
            ),
            status="ACTIVE",
            is_synthetic=False,
            created_by=admin.id,
        )
        db.add(india_case)
        await db.flush()
        print(f"  [OK] Created Case: IND-2026-004 (ID: {india_case.id})")

        # 2. Grant memberships
        for u in [admin, inv, sup]:
            if u:
                role = "ADMINISTRATOR" if u == admin else ("CASE_SUPERVISOR" if u == sup else "INVESTIGATOR")
                db.add(CaseMembership(
                    case_id=india_case.id,
                    user_id=u.id,
                    role=role,
                    granted_by=admin.id
                ))
        await db.flush()

        entity_cache = {}
        entity_count = 0
        event_count = 0

        # 3. Ingest Batches
        for filename, source_type, desc in CASE_FILES:
            filepath = os.path.join(BATCHES_DIR, filename)
            if not os.path.exists(filepath):
                print(f"  [WARN] File not found: {filepath}")
                continue

            with open(filepath, "r") as f:
                records = json.load(f)

            content_bytes = json.dumps(records).encode()
            sha = hashlib.sha256(content_bytes).hexdigest()

            upload_dir = os.path.join(settings.UPLOAD_DIR, str(india_case.id))
            os.makedirs(upload_dir, exist_ok=True)
            storage_name = f"{sha[:16]}.json"
            with open(os.path.join(upload_dir, storage_name), "w") as f:
                json.dump(records, f)

            ev = EvidenceFile(
                case_id=india_case.id,
                original_filename=filename,
                media_type="application/json",
                byte_size=len(content_bytes),
                sha256=sha,
                storage_path=os.path.join(str(india_case.id), storage_name),
                source_type=source_type,
                source_description=desc,
                uploaded_by=admin.id,
                parser_version="india_dataset_importer_v1",
                status="imported",
                accepted_count=len(records),
                rejected_count=0,
            )
            db.add(ev)
            await db.flush()

            imp = Import(
                evidence_file_id=ev.id,
                case_id=india_case.id,
                import_config={"source_type": source_type, "count": len(records), "dataset": desc},
                status="COMPLETED",
                accepted_count=len(records),
                rejected_count=0,
                completed_at=datetime.utcnow(),
            )
            db.add(imp)
            await db.flush()

            for idx, rec in enumerate(records):
                rec_hash = hashlib.sha256(json.dumps(rec, sort_keys=True).encode()).hexdigest()
                sr = SourceRecord(
                    case_id=india_case.id,
                    import_id=imp.id,
                    evidence_file_id=ev.id,
                    row_locator=f"row:{idx + 1}",
                    original_content=rec,
                    normalized_content=rec,
                    normalized_hash=rec_hash,
                    parser_version="india_dataset_importer_v1",
                    is_duplicate=False,
                )
                db.add(sr)
                await db.flush()

                # Extract entities from diverse record schemas
                id_fields = [
                    ("from_upi", "ACCOUNT"), ("to_upi", "ACCOUNT"),
                    ("from_account_id", "ACCOUNT"), ("to_account_id", "ACCOUNT"),
                    ("caller_id", "PHONE_SIM"), ("callee_id", "PHONE_SIM"),
                    ("entity_or_device_id", "DEVICE"),
                    ("primary_accused", "PERSON"), ("sender_alias", "ALIAS"),
                    ("recipient_alias", "ALIAS"), ("vehicle_plate", "VEHICLE"),
                    ("court", "ORGANIZATION"), ("police_station", "ORGANIZATION")
                ]

                participants = []
                for field, etype in id_fields:
                    val = rec.get(field)
                    if val and str(val).strip():
                        val_str = str(val).strip()
                        if val_str not in entity_cache:
                            ent = Entity(
                                case_id=india_case.id,
                                entity_type=etype,
                                label=val_str,
                                review_state="NEW",
                            )
                            db.add(ent)
                            await db.flush()
                            entity_cache[val_str] = ent
                            entity_count += 1

                            ident = Identifier(
                                case_id=india_case.id,
                                id_type=etype,
                                id_value=val_str,
                                normalized_value=val_str.lower().strip(),
                            )
                            db.add(ident)
                            await db.flush()

                            db.add(EntityIdentifierLink(
                                entity_id=ent.id,
                                identifier_id=ident.id,
                                confidence=1.0,
                                review_state="NEW",
                            ))

                        participants.append(entity_cache[val_str])

                # Extract Event
                ts = rec.get("timestamp") or rec.get("start_time") or rec.get("date_filed")
                dt = None
                if ts:
                    try:
                        dt = datetime.fromisoformat(ts.replace("Z", "+00:00").split("+")[0])
                    except Exception:
                        dt = datetime.utcnow()

                if dt:
                    etype = "transaction" if "amount" in rec else (
                        "cctv_sighting" if "camera_id" in rec else (
                            "call" if "caller_id" in rec else (
                                "message" if "text" in rec else "legal_document"
                            )
                        )
                    )
                    event = Event(
                        case_id=india_case.id,
                        event_type=etype,
                        start_time=dt,
                        original_timestamp=ts,
                        source_record_id=sr.id,
                        details=rec,
                    )
                    db.add(event)
                    await db.flush()
                    event_count += 1

                    for p in participants[:3]:
                        db.add(EventParticipant(event_id=event.id, entity_id=p.id))

                # Create Directed Relationships for transfers & calls
                if "from_upi" in rec and "to_upi" in rec:
                    src_ent = entity_cache.get(rec["from_upi"])
                    tgt_ent = entity_cache.get(rec["to_upi"])
                    if src_ent and tgt_ent and src_ent.id != tgt_ent.id:
                        db.add(Relationship(
                            case_id=india_case.id,
                            source_entity_id=src_ent.id,
                            target_entity_id=tgt_ent.id,
                            relationship_type="TRANSFERRED",
                            direction="DIRECTED",
                            classification="observed",
                            review_state="NEW",
                            evidence_count=1,
                        ))

                if "caller_id" in rec and "callee_id" in rec:
                    c_src = entity_cache.get(rec["caller_id"])
                    c_tgt = entity_cache.get(rec["callee_id"])
                    if c_src and c_tgt and c_src.id != c_tgt.id:
                        db.add(Relationship(
                            case_id=india_case.id,
                            source_entity_id=c_src.id,
                            target_entity_id=c_tgt.id,
                            relationship_type="CALLED",
                            direction="DIRECTED",
                            classification="observed",
                            review_state="NEW",
                            evidence_count=1,
                        ))

        # 4. Trigger SPYDEE Native Analysis Engines (Financial, Telecom, CCTV, Stylometry, Graph)
        from app.models.models import AnalysisRun, JobStatus
        from app.services.analysis_service import run_analysis

        analysis_run = AnalysisRun(
            case_id=india_case.id,
            version=1,
            input_hash=hashlib.sha256(str(len(records)).encode()).hexdigest(),
            configuration={
                "auto_workspace": True,
                "weights": {
                    "communication": 0.20, "device_sim": 0.20, "spatial_temporal": 0.15,
                    "writing_style": 0.15, "financial": 0.15, "infrastructure": 0.10,
                    "network_topology": 0.05,
                }
            },
            status=JobStatus.QUEUED,
        )
        db.add(analysis_run)
        await db.flush()

        res_records = await db.execute(select(SourceRecord).where(SourceRecord.case_id == india_case.id))
        all_case_records = res_records.scalars().all()

        print("  [INFO] Running SPYDEE Intelligence Engines over real India datasets...")
        summary = await run_analysis(db, analysis_run, all_case_records)
        print(f"  [OK] Intelligence Engines complete: {summary['signals']} signals, {summary['hypotheses']} hypotheses, {summary['recommendations']} recommendations generated.")

        await db.commit()
        print(f"  [SUCCESS] Successfully seeded IND-2026-004 with {entity_count} entities, {event_count} events, and full analytical results!")

if __name__ == "__main__":
    asyncio.run(seed_india_case())
