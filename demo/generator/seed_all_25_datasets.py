"""
SPYDEE: Unified Master Seeder for 13 National Intelligence Cases & All 25 Datasets
Operationalizes all 25 datasets from SPYDEE_India_Dataset_Links.xlsx across 13 specialized cases:
1.  IND-2026-004: Operation Trishul (Bengaluru SafeCity, UPI Mule Network, TRAI Mobility, FIR)
2.  IND-2026-005: Operation DarkEscrow (Hawala & P2P Crypto Laundering Syndicate)
3.  IND-2026-006: Operation Netra (Bengaluru SafeCity Surveillance & Forensic Biometrics)
4.  IND-2026-007: Operation Nyaya-Setu (National Cybercrime FIR Registry & Legal Intelligence)
5.  IND-2026-008: Operation Golden Kuber (Illegal Instant Loan App Extortion Syndicate)
6.  IND-2026-009: Operation Chhal-Dhan (Fake Algorithmic Trading & Stock Advisory Scam)
7.  IND-2026-010: Operation GhostTower (Telecom SIM-Box & Cross-Circle Border Routing)
8.  IND-2026-011: Operation Jamtara 2.0 (High-Velocity Vishing & OTP Mule Rings)
9.  IND-2026-012: Operation Chhaya (Disguised Fugitive Hunt & Composite Biometrics)
10. IND-2026-013: Operation Vahan-Chor (Interstate Stolen Vehicle & Cargo Tracking Racket)
11. IND-2026-014: Operation Maya-Jaal (Aadhaar & PAN Synthetic Identity Factory)
12. IND-2026-015: Operation Mukti-Bhang (Remand & Pre-Trial Bail Opposition Precedents)
13. IND-2026-ALL: Operation Chakra-Vyuh // National Cyber-Physical Intelligence Grid (Grand Unified Mega-Case)
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

from sqlalchemy import select, delete
from app.config import get_settings
from app.database import Base, engine, async_session
from app.models.models import (
    User, Case, CaseMembership, EvidenceFile, Import, SourceRecord,
    Entity, Identifier, EntityIdentifierLink, Relationship, RelationshipEvidence,
    Event, EventParticipant, AnalysisRun, JobStatus, EntityType, ReviewState,
    Hypothesis, HypothesisSignal, HypothesisRecommendation, Signal,
    Lead, InformationGap, Contradiction, ReviewAction, MergeSuggestion,
)
from app.services.analysis_service import run_analysis
from app.services.entity_service import normalize_identifier
from app.services.national_datasets_service import DATASETS_CATALOG

BATCHES_DIR = os.path.join(os.path.dirname(__file__), "..", "import-batches")

CASE_DEFINITIONS = [
    {
        "case_code": "IND-2026-004",
        "title": "Operation Trishul - Bangalore SafeCity & UPI Mule Network",
        "description": "Multi-modal investigation fusing IISc Bengaluru UVH-26 Safe-City CCTV surveillance, NPCI UPI multi-tier money mule structuring, InLegalNER legal FIR filings, and Karnataka TRAI telecom CDR mobility.",
        "batches": [
            ("case_ind_batch1_upi.json", "transactions", "NPCI UPI 2024 & UPI Fraud Structuring Network (Datasets 13, 14, 15)"),
            ("case_ind_batch2_uvh26_cctv.json", "CCTV", "Bengaluru Safe-City Camera Surveillance & IMFDB Face Detections (Datasets 9, 10)"),
            ("case_ind_batch3_trai_cdr.json", "cdr", "Karnataka LSA Cellular CDR & Bangalore City Traffic Mobility (Datasets 16, 17, 18)"),
            ("case_ind_batch4_inlegal_fir.json", "messages", "Cyber Crime PS FIR No 142/2026 & Legal Provisions (Datasets 1, 3, 8)")
        ]
    },
    {
        "case_code": "IND-2026-005",
        "title": "Operation DarkEscrow - Hawala & P2P Crypto Laundering Syndicate",
        "description": "Cross-border financial crime investigation benchmarked on IBM AML, Elliptic Bitcoin Graph, and NPCI UPI fraud datasets, tracking multi-hop laundering, shell firms, and OTC crypto escrow exits.",
        "batches": [
            ("case_ind_batch5_aml_crypto.json", "transactions", "IBM AML & Elliptic Bitcoin Labeled Graph Transactions (Datasets 14, 21, 22)")
        ]
    },
    {
        "case_code": "IND-2026-006",
        "title": "Operation Netra - Bengaluru SafeCity Surveillance & Biometrics",
        "description": "Urban video surveillance intelligence powered by IISc UVH-26 SafeCity CCTV camera network, IIIT-Delhi forensic sketch-photo matching, and IMFDB facial recognition across Bengaluru transit corridors.",
        "batches": [
            ("case_ind_batch6_safecity_surveillance.json", "CCTV", "IISc Bengaluru UVH-26 CCTV & IIIT-Delhi Forensic Sketches (Datasets 9, 10, 12)"),
            ("case_ind_batch9_biometric_fusion.json", "CCTV", "IMFDB Indian Face Embeddings, IIITM Face Attributes & IIIT-Delhi Sketch Match (Datasets 10, 11, 12)")
        ]
    },
    {
        "case_code": "IND-2026-007",
        "title": "Operation Nyaya-Setu - National Cybercrime FIR Registry & Legal Intelligence",
        "description": "Multi-jurisdictional legal document intelligence processing state police FIRs in Hindi and English using InLegalNER, Naamapadam multilingual extraction, IndianBailJudgments legal precedents, and NCRB crime statistics.",
        "batches": [
            ("case_ind_batch7_fir_legal_nlp.json", "messages", "InLegalNER, Naamapadam, IndianBailJudgments & NCRB Statistics (Datasets 1, 2, 7, 8, 19, 20)"),
            ("case_ind_batch8_court_precedents.json", "messages", "ILDC Precedent Predictor, NyayaAnumana 2.28M Proceedings & AWS Open Data Judgments (Datasets 3, 4, 5, 6, 7)")
        ]
    },
    {
        "case_code": "IND-2026-008",
        "title": "Operation Golden Kuber - Illegal Instant Loan App Extortion Syndicate",
        "description": "Cross-border predatory lending apps operating through forged NBFC gateway accounts in Pune and Bengaluru, harassing borrowers in vernacular languages with rapid fund draining.",
        "batches": [
            ("case_ind_batch11_loan_apps.json", "transactions", "Instant Loan App Harassment & Shell Inflow Sweeps (Datasets 2, 13, 14, 21)")
        ]
    },
    {
        "case_code": "IND-2026-009",
        "title": "Operation Chhal-Dhan - Fake Algorithmic Trading & Stock Advisory Scam",
        "description": "Bogus WhatsApp/Telegram investment groups promising 400% daily returns, funneling ₹14 Crores via 18 layered mule VPAs into shell fintech merchants in Mumbai BKC.",
        "batches": [
            ("case_ind_batch12_algo_trading.json", "transactions", "Bogus Pre-IPO Algorithmic Allocation & Bitcoin OTC Off-Ramp (Datasets 14, 15, 21, 22)")
        ]
    },
    {
        "case_code": "IND-2026-010",
        "title": "Operation GhostTower - Telecom SIM-Box & Cross-Circle Border Routing",
        "description": "Illegal VoIP/SIM-box gateway operating in border circles with 128 burner SIM cards; impossible transit speeds between towers (Ghost Tower anomaly) exposing automated spoofing.",
        "batches": [
            ("case_ind_batch13_simbox_telecom.json", "cdr", "SIM-Box CDR Collision & Ghost Tower Traversal Anomaly (Datasets 16, 17, 18)")
        ]
    },
    {
        "case_code": "IND-2026-011",
        "title": "Operation Jamtara 2.0 - High-Velocity Vishing & OTP Mule Rings",
        "description": "Deoghar/Nuh cyber hub impersonating electricity boards and bank KYC officers, deploying rapid fan-out UPI layering to unbanked rural accounts within 180 seconds.",
        "batches": [
            ("case_ind_batch14_jamtara_vishing.json", "messages", "Bescom/Power Bill Vishing & Rapid Tri-Partition Smurfing (Datasets 1, 2, 14, 21)")
        ]
    },
    {
        "case_code": "IND-2026-012",
        "title": "Operation Chhaya - Disguised Fugitive Hunt & Composite Biometrics",
        "description": "High-profile economic offender evading arrest under disguise (dyed hair, spectacles, false plates) tracked through Bengaluru transit hubs using forensic sketch matching and facial attribute classification.",
        "batches": [
            ("case_ind_batch15_disguised_fugitive.json", "CCTV", "Majestic Bus Terminus Sighting & Disguise Invariance Match (Datasets 9, 10, 11, 12, 18)")
        ]
    },
    {
        "case_code": "IND-2026-013",
        "title": "Operation Vahan-Chor - Interstate Stolen Vehicle & Cargo Tracking Racket",
        "description": "Interstate commercial truck/tempo syndicate stealing high-value electronics and transporting them via NH-44 using cloned HSRP number plates and toll plaza chokepoint evasion.",
        "batches": [
            ("case_ind_batch16_stolen_vehicles.json", "CCTV", "Peenya Logistics ANPR & NH-44 Border Chokepoint Transit (Datasets 9, 18, 19)")
        ]
    },
    {
        "case_code": "IND-2026-014",
        "title": "Operation Maya-Jaal - Aadhaar & PAN Synthetic Identity Factory",
        "description": "Forgery syndicate creating thousands of synthetic Indian identities with mismatched demographic parameters, exposed by Fellegi-Sunter probabilistic deduplication and SDV covariance anomalies.",
        "batches": [
            ("case_ind_batch17_synthetic_identities.json", "transactions", "Synthetic Identity Cluster & SDV Demographics Covariance Test (Datasets 23, 24, 25)")
        ]
    },
    {
        "case_code": "IND-2026-015",
        "title": "Operation Mukti-Bhang - Remand & Pre-Trial Bail Opposition Precedents",
        "description": "Prosecutorial strategy against syndicate kingpins applying for regular/anticipatory bail, leveraging 1,200 structured bail orders, ILDC Supreme Court CJPE precedents, and Section 65B electronic evidence admissibility.",
        "batches": [
            ("case_ind_batch18_bail_opposition.json", "messages", "Special PMLA Court Bail Opposition Memo & Flight Risk Citations (Datasets 3, 4, 5, 6, 8)")
        ]
    },
    {
        "case_code": "IND-2026-ALL",
        "title": "Operation Chakra-Vyuh // National Cyber-Physical Intelligence Grid",
        "description": "Grand unified national security case integrating all 25 National and Cross-Validation datasets into a singular multi-vector graph spanning Legal NLP, CCTV ANPR & Biometrics, UPI & Crypto Laundering, Telecom Mobility, NCRB Priors, and SDV Synthetic Continuity.",
        "batches": [
            ("case_ind_batch1_upi.json", "transactions", "NPCI UPI 2024 & Fraud Transactions (Datasets 13, 14, 15)"),
            ("case_ind_batch2_uvh26_cctv.json", "CCTV", "UVH-26 Bengaluru SafeCity Vehicle Tracking (Dataset 9)"),
            ("case_ind_batch3_trai_cdr.json", "cdr", "TRAI Karnataka LSA CDR & Bangalore Traffic Speed Anomaly (Datasets 16, 17, 18)"),
            ("case_ind_batch4_inlegal_fir.json", "messages", "Cyber Crime PS FIR No 142/2026 & Legal Provisions (Datasets 1, 3, 8)"),
            ("case_ind_batch5_aml_crypto.json", "transactions", "IBM AML Laundering & Elliptic Bitcoin Escrow (Datasets 21, 22)"),
            ("case_ind_batch6_safecity_surveillance.json", "CCTV", "SafeCity Surveillance Corridors (Datasets 9, 10, 12)"),
            ("case_ind_batch7_fir_legal_nlp.json", "messages", "InLegalNER & Naamapadam Multilingual FIRs with NCRB Priors (Datasets 1, 2, 7, 8, 19, 20)"),
            ("case_ind_batch8_court_precedents.json", "messages", "ILDC Precedent Predictor, NyayaAnumana 2.28M Cases & AWS Open Data (Datasets 3, 4, 5, 6)"),
            ("case_ind_batch9_biometric_fusion.json", "CCTV", "IMFDB Indian Face Embeddings, IIITM Attributes & IIIT-Delhi Forensic Sketches (Datasets 10, 11, 12)"),
            ("case_ind_batch10_synthetic_sdv_febrl.json", "transactions", "FEBRL Entity Resolution, Faker en_IN Personas & SDV Relational Vault (Datasets 23, 24, 25)"),
            ("case_ind_batch11_loan_apps.json", "transactions", "Predatory Loan Apps & NBFC Mule Routing (Datasets 2, 13, 14)"),
            ("case_ind_batch12_algo_trading.json", "transactions", "Bogus Algo-Trading Liquidity Drain (Datasets 15, 21, 22)"),
            ("case_ind_batch13_simbox_telecom.json", "cdr", "SIM-Box IMEI Reuse & Ghost Tower Mobility (Datasets 16, 17, 18)"),
            ("case_ind_batch14_jamtara_vishing.json", "messages", "High-Speed Vishing & OTP Smurfing (Datasets 1, 2, 14)"),
            ("case_ind_batch15_disguised_fugitive.json", "CCTV", "Fugitive Disguise Invariance & Highway Intercept (Datasets 9, 10, 11, 12)"),
            ("case_ind_batch16_stolen_vehicles.json", "CCTV", "Commercial Cargo Theft ANPR (Datasets 9, 18, 19)"),
            ("case_ind_batch17_synthetic_identities.json", "transactions", "Synthetic Identity Factory Deduplication (Datasets 23, 24, 25)"),
            ("case_ind_batch18_bail_opposition.json", "messages", "PMLA Custodial Remand & Flight Risk Precedents (Datasets 3, 4, 5, 8)")
        ]
    }
]

# Mapping field names -> (Identifier id_type string, EntityType enum)
FIELD_ENTITY_SPEC = [
    # Phones
    ("caller_id", "phone", EntityType.PHONE_SIM),
    ("callee_id", "phone", EntityType.PHONE_SIM),
    ("calling_number", "phone", EntityType.PHONE_SIM),
    ("called_number", "phone", EntityType.PHONE_SIM),
    ("caller_number", "phone", EntityType.PHONE_SIM),
    ("target_victim_number", "phone", EntityType.PHONE_SIM),
    ("victim_phone", "phone", EntityType.PHONE_SIM),
    ("phone_id", "phone", EntityType.PHONE_SIM),
    ("phone", "phone", EntityType.PHONE_SIM),
    # Accounts & UPI
    ("from_upi", "account", EntityType.ACCOUNT),
    ("to_upi", "account", EntityType.ACCOUNT),
    ("from_vpa", "account", EntityType.ACCOUNT),
    ("to_vpa", "account", EntityType.ACCOUNT),
    ("victim_vpa", "account", EntityType.ACCOUNT),
    ("extortion_vpa", "account", EntityType.ACCOUNT),
    ("from_account_id", "account", EntityType.ACCOUNT),
    ("to_account_id", "account", EntityType.ACCOUNT),
    ("beneficiary_mule_account", "account", EntityType.ACCOUNT),
    ("btc_address", "account", EntityType.ACCOUNT),
    ("crypto_tx_hash", "account", EntityType.ACCOUNT),
    # Persons
    ("primary_accused", "name", EntityType.PERSON),
    ("identified_person", "name", EntityType.PERSON),
    ("fugitive_target", "name", EntityType.PERSON),
    ("accused_applicant", "name", EntityType.PERSON),
    ("full_name", "name", EntityType.PERSON),
    ("witness_person", "name", EntityType.PERSON),
    # Aliases
    ("accused_alias", "alias", EntityType.ALIAS),
    ("alias", "alias", EntityType.ALIAS),
    ("alias_id", "alias", EntityType.ALIAS),
    ("sender_alias", "alias", EntityType.ALIAS),
    ("target_alias", "alias", EntityType.ALIAS),
    ("synthetic_alias", "alias", EntityType.ALIAS),
    # Hardware & Devices
    ("device_id", "device", EntityType.DEVICE),
    ("equipment_id", "device", EntityType.DEVICE),
    ("imei", "device", EntityType.DEVICE),
    ("device_imei", "device", EntityType.DEVICE),
    ("camera_id", "device", EntityType.DEVICE),
    ("sighting_camera_id", "device", EntityType.DEVICE),
    ("entity_or_device_id", "device", EntityType.DEVICE),
    # Towers / Locations
    ("tower_id", "tower", EntityType.LOCATION),
    ("cell_tower_id", "tower", EntityType.LOCATION),
    # Vehicles
    ("vehicle_plate", "vehicle", EntityType.VEHICLE),
    ("vehicle_plate_scanned", "vehicle", EntityType.VEHICLE),
    ("linked_convoy_plate", "vehicle", EntityType.VEHICLE),
    # Organizations
    ("police_station", "organization", EntityType.ORGANIZATION),
    ("court", "organization", EntityType.ORGANIZATION),
    ("petitioner", "organization", EntityType.ORGANIZATION),
    ("respondent", "organization", EntityType.ORGANIZATION),
    ("syndicate_entity", "organization", EntityType.ORGANIZATION),
    ("app_name", "organization", EntityType.ORGANIZATION),
    # Documents
    ("pan_card", "document", EntityType.DOCUMENT),
]


async def clear_case_data(db, case_id):
    """Cleanly purge all derived and ingested records for a case before re-seeding."""
    await db.execute(delete(ReviewAction).where(ReviewAction.case_id == case_id))
    await db.execute(delete(Contradiction).where(Contradiction.case_id == case_id))
    await db.execute(delete(InformationGap).where(InformationGap.case_id == case_id))
    await db.execute(delete(Lead).where(Lead.case_id == case_id))

    prior_hyp = select(Hypothesis.id).where(Hypothesis.case_id == case_id)
    prior_ids = [row for row in (await db.execute(prior_hyp)).scalars().all()]
    if prior_ids:
        await db.execute(delete(HypothesisRecommendation).where(HypothesisRecommendation.hypothesis_id.in_(prior_ids)))
        await db.execute(delete(HypothesisSignal).where(HypothesisSignal.hypothesis_id.in_(prior_ids)))
        await db.execute(delete(Hypothesis).where(Hypothesis.id.in_(prior_ids)))

    await db.execute(delete(Signal).where(Signal.case_id == case_id))
    await db.execute(delete(AnalysisRun).where(AnalysisRun.case_id == case_id))

    prior_rels = select(Relationship.id).where(Relationship.case_id == case_id)
    rel_ids = [row for row in (await db.execute(prior_rels)).scalars().all()]
    if rel_ids:
        await db.execute(delete(RelationshipEvidence).where(RelationshipEvidence.relationship_id.in_(rel_ids)))
    await db.execute(delete(Relationship).where(Relationship.case_id == case_id))

    prior_evs = select(Event.id).where(Event.case_id == case_id)
    ev_ids = [row for row in (await db.execute(prior_evs)).scalars().all()]
    if ev_ids:
        await db.execute(delete(EventParticipant).where(EventParticipant.event_id.in_(ev_ids)))
    await db.execute(delete(Event).where(Event.case_id == case_id))

    prior_ents = select(Entity.id).where(Entity.case_id == case_id)
    ent_ids = [row for row in (await db.execute(prior_ents)).scalars().all()]
    if ent_ids:
        await db.execute(delete(EntityIdentifierLink).where(EntityIdentifierLink.entity_id.in_(ent_ids)))
    await db.execute(delete(MergeSuggestion).where(MergeSuggestion.case_id == case_id))
    await db.execute(delete(Identifier).where(Identifier.case_id == case_id))
    await db.execute(delete(Entity).where(Entity.case_id == case_id))

    await db.execute(delete(SourceRecord).where(SourceRecord.case_id == case_id))
    await db.execute(delete(Import).where(Import.case_id == case_id))
    await db.execute(delete(EvidenceFile).where(EvidenceFile.case_id == case_id))
    await db.flush()


async def seed_all_25():
    settings = get_settings()
    print("=" * 85)
    print(" SPYDEE: MASTER SEEDER FOR 13 NATIONAL CASES & ALL 25 DATASETS")
    print("=" * 85)

    async with async_session() as db:
        res_admin = await db.execute(select(User).where(User.username == "admin"))
        admin = res_admin.scalar_one_or_none()
        if not admin:
            print("  [ERROR] Admin user not found. Please run seed_db.py first.")
            return

        res_inv = await db.execute(select(User).where(User.username == "investigator"))
        inv = res_inv.scalar_one_or_none()

        res_sup = await db.execute(select(User).where(User.username == "supervisor"))
        sup = res_sup.scalar_one_or_none()

        users_list = [u for u in [admin, inv, sup] if u]

        for case_info in CASE_DEFINITIONS:
            code = case_info["case_code"]
            ex = await db.execute(select(Case).where(Case.case_code == code))
            existing = ex.scalar_one_or_none()

            if existing:
                print(f"\n  [INFO] Case {code} exists (ID: {existing.id}). Purging prior records to re-seed cleanly...")
                case_obj = existing
                await clear_case_data(db, case_obj.id)
            else:
                case_obj = Case(
                    title=case_info["title"],
                    case_code=code,
                    description=case_info["description"],
                    status="active",
                    is_synthetic=False,
                    created_by=admin.id,
                )
                db.add(case_obj)
                await db.flush()
                print(f"\n  [OK] Created Case {code}: {case_info['title']} (ID: {case_obj.id})")

                for u in users_list:
                    role = "administrator" if u == admin else ("case_supervisor" if u == sup else "investigator")
                    db.add(CaseMembership(
                        case_id=case_obj.id,
                        user_id=u.id,
                        role=role,
                        granted_by=admin.id
                    ))
                await db.flush()

            entity_cache = {}  # val_str -> Entity
            entity_count = 0
            event_count = 0
            rel_count = 0
            all_source_records = []

            # Ingest batches
            for filename, source_type, desc in case_info["batches"]:
                filepath = os.path.join(BATCHES_DIR, filename)
                if not os.path.exists(filepath):
                    print(f"    [WARN] Batch file not found: {filepath}")
                    continue

                with open(filepath, "r", encoding="utf-8") as f:
                    records = json.load(f)

                content_bytes = json.dumps(records, ensure_ascii=False).encode("utf-8")
                sha = hashlib.sha256(content_bytes).hexdigest()

                upload_dir = os.path.join(settings.UPLOAD_DIR, str(case_obj.id))
                os.makedirs(upload_dir, exist_ok=True)
                storage_name = f"{sha[:16]}.json"
                with open(os.path.join(upload_dir, storage_name), "w", encoding="utf-8") as f:
                    json.dump(records, f, ensure_ascii=False)

                ev = EvidenceFile(
                    case_id=case_obj.id,
                    original_filename=filename,
                    media_type="application/json",
                    byte_size=len(content_bytes),
                    sha256=sha,
                    storage_path=os.path.join(str(case_obj.id), storage_name),
                    source_type=source_type,
                    source_description=desc,
                    uploaded_by=admin.id,
                    parser_version="national_datasets_importer_v3",
                    status="imported",
                    accepted_count=len(records),
                    rejected_count=0,
                )
                db.add(ev)
                await db.flush()

                imp = Import(
                    evidence_file_id=ev.id,
                    case_id=case_obj.id,
                    import_config={"source_type": source_type, "count": len(records), "dataset": desc},
                    status="completed",
                    accepted_count=len(records),
                    rejected_count=0,
                    completed_at=datetime.utcnow(),
                )
                db.add(imp)
                await db.flush()

                for idx, rec in enumerate(records):
                    rec_hash = hashlib.sha256(json.dumps(rec, sort_keys=True).encode()).hexdigest()
                    sr = SourceRecord(
                        case_id=case_obj.id,
                        import_id=imp.id,
                        evidence_file_id=ev.id,
                        row_locator=f"row:{idx + 1}",
                        original_content=rec,
                        normalized_content=rec,
                        normalized_hash=rec_hash,
                        parser_version="national_datasets_importer_v3",
                        is_duplicate=False,
                    )
                    db.add(sr)
                    await db.flush()
                    all_source_records.append(sr)

                    # Extract Entities & Identifiers
                    participants = []
                    for field, id_type, etype in FIELD_ENTITY_SPEC:
                        val = rec.get(field)
                        if val and str(val).strip():
                            val_str = str(val).strip()
                            if val_str not in entity_cache:
                                ent = Entity(
                                    case_id=case_obj.id,
                                    entity_type=etype,
                                    label=val_str,
                                    review_state=ReviewState.NEW,
                                )
                                db.add(ent)
                                await db.flush()
                                entity_cache[val_str] = ent
                                entity_count += 1

                                norm_val = normalize_identifier(id_type, val_str) or val_str.lower().strip()
                                ident = Identifier(
                                    case_id=case_obj.id,
                                    id_type=id_type,
                                    id_value=val_str,
                                    normalized_value=norm_val,
                                )
                                db.add(ident)
                                await db.flush()

                                db.add(EntityIdentifierLink(
                                    entity_id=ent.id,
                                    identifier_id=ident.id,
                                    confidence=1.0,
                                    review_state=ReviewState.NEW,
                                ))

                            participants.append(entity_cache[val_str])

                    # Co-accused list extraction
                    for co in rec.get("co_accused", []):
                        if co and str(co).strip():
                            co_str = str(co).strip()
                            if co_str not in entity_cache:
                                ent = Entity(
                                    case_id=case_obj.id,
                                    entity_type=EntityType.PERSON,
                                    label=co_str,
                                    review_state=ReviewState.NEW,
                                )
                                db.add(ent)
                                await db.flush()
                                entity_cache[co_str] = ent
                                entity_count += 1
                                norm_val = normalize_identifier("name", co_str) or co_str.lower().strip()
                                ident = Identifier(
                                    case_id=case_obj.id,
                                    id_type="name",
                                    id_value=co_str,
                                    normalized_value=norm_val,
                                )
                                db.add(ident)
                                await db.flush()
                                db.add(EntityIdentifierLink(
                                    entity_id=ent.id,
                                    identifier_id=ident.id,
                                    confidence=1.0,
                                    review_state=ReviewState.NEW,
                                ))

                    # Event extraction
                    ts = rec.get("timestamp") or rec.get("start_time") or rec.get("date_filed") or rec.get("order_date")
                    dt = None
                    if ts:
                        try:
                            clean_ts = ts.replace("Z", "+00:00").split("+")[0]
                            dt = datetime.fromisoformat(clean_ts)
                        except Exception:
                            dt = datetime.utcnow()

                    if dt:
                        etype = "transaction" if ("amount" in rec or "amount_inr" in rec or "disbursed_amount" in rec) else (
                            "cctv_sighting" if ("camera_id" in rec or "sighting_camera_id" in rec) else (
                                "call" if ("caller_id" in rec or "caller_number" in rec) else "legal_document"
                            )
                        )
                        event = Event(
                            case_id=case_obj.id,
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

                    # ── Comprehensive Relationship Extraction ────────────────
                    # 1. Financial transfers
                    from_acct = rec.get("from_upi") or rec.get("from_vpa") or rec.get("from_account_id") or rec.get("victim_vpa")
                    to_acct = rec.get("to_upi") or rec.get("to_vpa") or rec.get("to_account_id") or rec.get("extortion_vpa")
                    if from_acct and to_acct and from_acct in entity_cache and to_acct in entity_cache:
                        s_ent, t_ent = entity_cache[from_acct], entity_cache[to_acct]
                        if s_ent.id != t_ent.id:
                            db.add(Relationship(
                                case_id=case_obj.id,
                                source_entity_id=s_ent.id,
                                target_entity_id=t_ent.id,
                                relationship_type="TRANSFERRED",
                                direction="directed",
                                classification="observed",
                                review_state="new",
                                evidence_count=1,
                            ))
                            rel_count += 1

                    # 2. Telecom calls
                    caller = rec.get("caller_id") or rec.get("calling_number") or rec.get("caller_number")
                    callee = rec.get("callee_id") or rec.get("called_number") or rec.get("target_victim_number")
                    if caller and callee and caller in entity_cache and callee in entity_cache:
                        s_ent, t_ent = entity_cache[caller], entity_cache[callee]
                        if s_ent.id != t_ent.id:
                            db.add(Relationship(
                                case_id=case_obj.id,
                                source_entity_id=s_ent.id,
                                target_entity_id=t_ent.id,
                                relationship_type="CALLED",
                                direction="directed",
                                classification="observed",
                                review_state="new",
                                evidence_count=1,
                            ))
                            rel_count += 1

                    # 3. Messages / Chats
                    sender = rec.get("alias_id") or rec.get("sender_alias") or rec.get("source_alias")
                    target = rec.get("target_alias")
                    if sender and target and sender in entity_cache and target in entity_cache:
                        s_ent, t_ent = entity_cache[sender], entity_cache[target]
                        if s_ent.id != t_ent.id:
                            db.add(Relationship(
                                case_id=case_obj.id,
                                source_entity_id=s_ent.id,
                                target_entity_id=t_ent.id,
                                relationship_type="MESSAGED",
                                direction="directed",
                                classification="observed",
                                review_state="new",
                                evidence_count=1,
                            ))
                            rel_count += 1

                    # 4. Accused & Alias
                    accused = rec.get("primary_accused") or rec.get("fugitive_target") or rec.get("accused_applicant")
                    alias = rec.get("accused_alias") or rec.get("alias")
                    if accused and alias and accused in entity_cache and alias in entity_cache:
                        s_ent, t_ent = entity_cache[accused], entity_cache[alias]
                        if s_ent.id != t_ent.id:
                            db.add(Relationship(
                                case_id=case_obj.id,
                                source_entity_id=s_ent.id,
                                target_entity_id=t_ent.id,
                                relationship_type="USES_ALIAS",
                                direction="directed",
                                classification="observed",
                                review_state="new",
                                evidence_count=1,
                            ))
                            rel_count += 1

                    # 5. Accused & Co-accused
                    if accused and accused in entity_cache:
                        for co in rec.get("co_accused", []):
                            if co and str(co).strip() in entity_cache:
                                c_ent = entity_cache[str(co).strip()]
                                if entity_cache[accused].id != c_ent.id:
                                    db.add(Relationship(
                                        case_id=case_obj.id,
                                        source_entity_id=entity_cache[accused].id,
                                        target_entity_id=c_ent.id,
                                        relationship_type="CO_CONSPIRATOR",
                                        direction="undirected",
                                        classification="inferred",
                                        review_state="new",
                                        evidence_count=1,
                                    ))
                                    rel_count += 1

                    # 6. Vehicle sightings at cameras
                    veh = rec.get("vehicle_plate") or rec.get("vehicle_plate_scanned")
                    cam = rec.get("camera_id") or rec.get("sighting_camera_id")
                    if veh and cam and veh in entity_cache and cam in entity_cache:
                        s_ent, t_ent = entity_cache[veh], entity_cache[cam]
                        if s_ent.id != t_ent.id:
                            db.add(Relationship(
                                case_id=case_obj.id,
                                source_entity_id=s_ent.id,
                                target_entity_id=t_ent.id,
                                relationship_type="SIGHTED_AT",
                                direction="directed",
                                classification="observed",
                                review_state="new",
                                evidence_count=1,
                            ))
                            rel_count += 1

                    # 7. Person operates vehicle
                    if accused and veh and accused in entity_cache and veh in entity_cache:
                        s_ent, t_ent = entity_cache[accused], entity_cache[veh]
                        if s_ent.id != t_ent.id:
                            db.add(Relationship(
                                case_id=case_obj.id,
                                source_entity_id=s_ent.id,
                                target_entity_id=t_ent.id,
                                relationship_type="OPERATES_VEHICLE",
                                direction="directed",
                                classification="inferred",
                                review_state="new",
                                evidence_count=1,
                            ))
                            rel_count += 1

                print(f"    [OK] Ingested {filename} ({len(records)} records)")

            await db.flush()

            # Trigger Native Analysis Pipeline
            analysis_run = AnalysisRun(
                case_id=case_obj.id,
                version=1,
                input_hash=hashlib.sha256(str(entity_count).encode()).hexdigest(),
                configuration={"auto_workspace": True},
                status=JobStatus.QUEUED,
            )
            db.add(analysis_run)
            await db.flush()

            print(f"  [INFO] Running intelligence engines for {code} ({len(all_source_records)} records, {entity_count} entities, {rel_count} relationships)...")
            res_summary = await run_analysis(db, analysis_run, all_source_records)
            print(f"  [SUCCESS] {code}: {res_summary['signals']} signals, {res_summary['hypotheses']} hypotheses, {res_summary['recommendations']} recommendations.")

        await db.commit()

        print("\n" + "=" * 85)
        print(" [COMPLETED] ALL 13 NATIONAL CASES FULLY SEEDED WITH ACTIVE HYPOTHESES & SIGNALS!")
        print("=" * 85)


if __name__ == "__main__":
    asyncio.run(seed_all_25())
