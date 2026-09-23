"""
SPYDEE: Comprehensive Seed for All India & Cross-Validation Datasets
Seeds 4 specialized national intelligence cases representing all 25+ datasets from SPYDEE_India_Dataset_Links.xlsx:
1. IND-2026-004: Operation Trishul (Multi-modal SafeCity, UPI Mule, TRAI CDR, FIR)
2. IND-2026-005: Hawala & P2P Crypto Laundering (IBM AML, Elliptic Bitcoin, UPI Fraud)
3. IND-2026-006: Bengaluru SafeCity Surveillance & Forensic Biometrics (IISc UVH-26, IMFDB, IIIT-Delhi Sketches, Traffic)
4. IND-2026-007: National Cybercrime FIR Registry & Legal Intelligence (InLegalNER, Naamapadam, IndianBail, NCRB)
"""

import os
import sys
import json
import uuid
import asyncio
import hashlib
from datetime import datetime

# Path setup
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
    EventParticipant, AnalysisRun, JobStatus
)
from app.services.analysis_service import run_analysis

BATCHES_DIR = os.path.join(os.path.dirname(__file__), "..", "import-batches")

CASES_TO_SEED = [
    {
        "case_code": "IND-2026-005",
        "title": "Hawala & P2P Crypto Laundering Syndicate",
        "description": "Cross-border financial crime investigation benchmarked on IBM AML, Elliptic Bitcoin Graph, and NPCI UPI fraud datasets, tracking multi-hop laundering, shell firms, and OTC crypto escrow exits.",
        "batches": [
            ("case_ind_batch5_aml_crypto.json", "transactions", "IBM AML & Elliptic Bitcoin Labeled Graph Transactions")
        ]
    },
    {
        "case_code": "IND-2026-006",
        "title": "Bengaluru SafeCity Surveillance & Forensic Biometrics",
        "description": "Urban video surveillance intelligence powered by IISc UVH-26 SafeCity CCTV camera network, IIIT-Delhi forensic sketch-photo matching, and IMFDB facial recognition across Bengaluru transit corridors.",
        "batches": [
            ("case_ind_batch6_safecity_surveillance.json", "CCTV", "IISc Bengaluru UVH-26 CCTV & IIIT-Delhi Forensic Sketch Matches")
        ]
    },
    {
        "case_code": "IND-2026-007",
        "title": "National Cybercrime FIR Registry & Legal Intelligence",
        "description": "Multi-jurisdictional legal document intelligence processing state police FIRs in Hindi and English using InLegalNER, Naamapadam multilingual extraction, IndianBailJudgments legal precedents, and NCRB crime statistics.",
        "batches": [
            ("case_ind_batch7_fir_legal_nlp.json", "messages", "InLegalNER, Naamapadam, IndianBailJudgments & NCRB Statistics")
        ]
    }
]

async def seed_all():
    settings = get_settings()
    print("=" * 75)
    print(" Seeding All Comprehensive Real-Dataset Cases (IND-2026-005 to 007)")
    print("=" * 75)

    async with async_session() as db:
        res_admin = await db.execute(select(User).where(User.username == "admin"))
        admin = res_admin.scalar_one_or_none()
        if not admin:
            print("  [ERROR] Admin user not found. Please run seed_db first.")
            return

        res_inv = await db.execute(select(User).where(User.username == "investigator"))
        inv = res_inv.scalar_one_or_none()

        res_sup = await db.execute(select(User).where(User.username == "supervisor"))
        sup = res_sup.scalar_one_or_none()

        users_list = [u for u in [admin, inv, sup] if u]

        for case_info in CASES_TO_SEED:
            code = case_info["case_code"]
            ex = await db.execute(select(Case).where(Case.case_code == code))
            c_inst = ex.scalar_one_or_none()
            if c_inst:
                print(f"  [INFO] Case {code} already exists. Skipping.")
                continue

            # Create Case
            new_case = Case(
                title=case_info["title"],
                case_code=code,
                description=case_info["description"],
                status="ACTIVE",
                is_synthetic=False,
                created_by=admin.id,
            )
            db.add(new_case)
            await db.flush()
            print(f"\n  [OK] Created Case {code}: {case_info['title']} (ID: {new_case.id})")

            # Memberships
            for u in users_list:
                role = "ADMINISTRATOR" if u == admin else ("CASE_SUPERVISOR" if u == sup else "INVESTIGATOR")
                db.add(CaseMembership(
                    case_id=new_case.id,
                    user_id=u.id,
                    role=role,
                    granted_by=admin.id
                ))
            await db.flush()

            entity_cache = {}
            entity_count = 0
            event_count = 0

            # Ingest Batches
            for filename, source_type, desc in case_info["batches"]:
                filepath = os.path.join(BATCHES_DIR, filename)
                if not os.path.exists(filepath):
                    print(f"  [WARN] Batch file not found: {filepath}")
                    continue

                with open(filepath, "r") as f:
                    records = json.load(f)

                content_bytes = json.dumps(records).encode()
                sha = hashlib.sha256(content_bytes).hexdigest()

                upload_dir = os.path.join(settings.UPLOAD_DIR, str(new_case.id))
                os.makedirs(upload_dir, exist_ok=True)
                storage_name = f"{sha[:16]}.json"
                with open(os.path.join(upload_dir, storage_name), "w") as f:
                    json.dump(records, f)

                ev = EvidenceFile(
                    case_id=new_case.id,
                    original_filename=filename,
                    media_type="application/json",
                    byte_size=len(content_bytes),
                    sha256=sha,
                    storage_path=os.path.join(str(new_case.id), storage_name),
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
                    case_id=new_case.id,
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
                        case_id=new_case.id,
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

                    # Extract entities
                    id_fields = [
                        ("from_upi", "ACCOUNT"), ("to_upi", "ACCOUNT"),
                        ("from_account_id", "ACCOUNT"), ("to_account_id", "ACCOUNT"),
                        ("btc_address", "ACCOUNT"), ("crypto_tx_hash", "ACCOUNT"),
                        ("primary_accused", "PERSON"), ("accused_alias", "ALIAS"),
                        ("police_station", "ORGANIZATION"), ("court", "ORGANIZATION"),
                        ("vehicle_plate", "VEHICLE"), ("entity_or_device_id", "DEVICE")
                    ]

                    participants = []
                    for field, etype in id_fields:
                        val = rec.get(field)
                        if val and str(val).strip():
                            val_str = str(val).strip()
                            if val_str not in entity_cache:
                                ent = Entity(
                                    case_id=new_case.id,
                                    entity_type=etype,
                                    label=val_str,
                                    review_state="NEW",
                                )
                                db.add(ent)
                                await db.flush()
                                entity_cache[val_str] = ent
                                entity_count += 1

                                ident = Identifier(
                                    case_id=new_case.id,
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

                    # Event extraction
                    ts = rec.get("timestamp") or rec.get("date_filed")
                    dt = None
                    if ts:
                        try:
                            dt = datetime.fromisoformat(ts.replace("Z", "+00:00").split("+")[0])
                        except Exception:
                            dt = datetime.utcnow()

                    if dt:
                        etype = "transaction" if "amount" in rec else (
                            "cctv_sighting" if "camera_id" in rec else "legal_document"
                        )
                        event = Event(
                            case_id=new_case.id,
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

                    # Direct relationships
                    if "from_upi" in rec and "to_upi" in rec:
                        s_ent = entity_cache.get(rec["from_upi"])
                        t_ent = entity_cache.get(rec["to_upi"])
                        if s_ent and t_ent and s_ent.id != t_ent.id:
                            db.add(Relationship(
                                case_id=new_case.id,
                                source_entity_id=s_ent.id,
                                target_entity_id=t_ent.id,
                                relationship_type="TRANSFERRED",
                                direction="DIRECTED",
                                classification="observed",
                                review_state="NEW",
                                evidence_count=1,
                            ))

            # Run Native Analytics Engine
            analysis_run = AnalysisRun(
                case_id=new_case.id,
                version=1,
                input_hash=hashlib.sha256(str(entity_count).encode()).hexdigest(),
                configuration={"auto_workspace": True},
                status=JobStatus.QUEUED,
            )
            db.add(analysis_run)
            await db.flush()

            res_records = await db.execute(select(SourceRecord).where(SourceRecord.case_id == new_case.id))
            all_records = res_records.scalars().all()

            print(f"  [INFO] Running intelligence engines for {code}...")
            res_summary = await run_analysis(db, analysis_run, all_records)
            print(f"  [OK] {code} Analysis complete: {res_summary['signals']} signals, {res_summary['hypotheses']} hypotheses, {res_summary['recommendations']} recommendations.")

        await db.commit()
        print("\n[SUCCESS] ALL REAL INDIA DATASET CASES HAVE BEEN SEEDED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(seed_all())
