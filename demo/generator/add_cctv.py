import os
import sys
import json
import uuid
import asyncio
import hashlib
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "services", "api"))

from app.config import get_settings
from app.database import engine, async_session
from app.models.models import (
    User, Case, EvidenceFile, Import, SourceRecord,
)
from app.auth.auth import hash_password


async def add_cctv():
    settings = get_settings()
    async with async_session() as db:
        # Get existing users and cases
        from sqlalchemy import select
        
        admin_result = await db.execute(select(User).where(User.email == "admin@spydee.example"))
        admin = admin_result.scalar_one_or_none()
        
        case_a_result = await db.execute(select(Case).where(Case.case_code == "BRK-2026-001"))
        case_a = case_a_result.scalar_one_or_none()
        
        case_b_result = await db.execute(select(Case).where(Case.case_code == "HBR-2026-002"))
        case_b = case_b_result.scalar_one_or_none()
        
        if not admin or not case_a or not case_b:
            print("Required users/cases not found")
            return
        
        print(f"Found admin: {admin.id}")
        print(f"Found case_a: {case_a.id}")
        print(f"Found case_b: {case_b.id}")
        
        batches_dir = os.path.join(os.path.dirname(__file__), "..", "import-batches")
        
        cctv_files = {
            case_a.id: [
                ("case_a_batch5_cctv.json", "CCTV", "CCTV camera observations"),
            ],
            case_b.id: [
                ("case_b_cctv.json", "CCTV", "Harbor area CCTV observations"),
            ],
        }
        
        for case_id, files in cctv_files.items():
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
                
                print(f"Added {len(records)} CCTV records to case {case_id}")
        
        await db.commit()
        print("CCTV data added successfully!")


asyncio.run(add_cctv())