import os
import sys
import json
import uuid
import hashlib
import random
from datetime import datetime, timedelta

random.seed(42)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "import-batches")
GROUND_DIR = os.path.join(os.path.dirname(__file__), "..", "ground-truth")
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(GROUND_DIR, exist_ok=True)


def gen_id(prefix):
    return f"{prefix}-{random.randint(1000, 9999)}"


def gen_phone():
    return f"+91{random.randint(7000000000, 9999999999)}"


def gen_device():
    return f"DEV-{uuid.uuid4().hex[:8].upper()}"


def gen_sim():
    return f"SIM-{uuid.uuid4().hex[:12].upper()}"


def gen_account():
    return f"ACCT-{random.randint(10000, 99999)}"


def gen_domain():
    services = ["mail", "cloud", "store", "pay", "chat", "net", "hub", "link"]
    return f"{random.choice(services)}-{random.randint(100,999)}.example.com"


def gen_ip():
    return f"10.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"


LOCATIONS = [
    {"id": str(uuid.uuid4()), "label": f"Tower-{chr(65+i)}", "lat": 28.6 + random.uniform(-0.5, 0.5), "lon": 77.2 + random.uniform(-0.5, 0.5), "accuracy": random.choice([100, 200, 500, 1000])}
    for i in range(8)
]

NAMES = [
    "Ravi Sharma", "Priya Patel", "Amit Singh", "Neha Gupta", "Vikram Rao",
    "Anjali Desai", "Suresh Kumar", "Pooja Nair", "Raj Malhotra", "Kavita Joshi",
    "Deepak Verma", "Meera Reddy", "Arjun Mehta", "Sneha Iyer", "Sanjay Bhat",
    "Divya Menon", "Rohan Das", "Aisha Khan", "Vivek Pandey", "Nisha Agarwal",
    "Karan Kapoor", "Tanya Saxena", "Manish Tiwari", "Ritu Chandra",
]

ALIASES = [f"Alias-{i:02d}" for i in range(1, 25)]


def generate_case_a():
    records = []
    ground_truth = {
        "case": "Broken Chain",
        "real_groups": [],
        "alias_to_person": {},
        "device_assignments": {},
        "control_users": [],
    }

    core_aliases = ALIASES[:8]
    core_phones = [gen_phone() for _ in range(8)]
    core_devices = [gen_device() for _ in range(6)]
    core_sims = [gen_sim() for _ in range(7)]

    person_groups = [
        {"person": NAMES[0], "aliases": core_aliases[:3], "phones": core_phones[:3], "devices": core_devices[:2], "sims": core_sims[:2]},
        {"person": NAMES[1], "aliases": core_aliases[3:6], "phones": core_phones[3:6], "devices": core_devices[2:4], "sims": core_sims[2:4]},
        {"person": NAMES[2], "aliases": core_aliases[6:8], "phones": core_phones[6:8], "devices": core_devices[4:6], "sims": core_sims[4:6]},
    ]

    for pg in person_groups:
        for alias in pg["aliases"]:
            ground_truth["alias_to_person"][alias] = pg["person"]
        for dev in pg["devices"]:
            ground_truth["device_assignments"][dev] = pg["person"]
        ground_truth["real_groups"].append(pg)

    base_time = datetime(2026, 8, 1, 8, 0, 0)

    for day in range(21):
        current_day = base_time + timedelta(days=day)
        for pg in person_groups:
            for i, alias in enumerate(pg["aliases"]):
                phone = pg["phones"][i % len(pg["phones"])]
                device = pg["devices"][i % len(pg["devices"])]
                sim = pg["sims"][i % len(pg["sims"])]

                for _ in range(random.randint(2, 8)):
                    callee_pg = random.choice(person_groups)
                    callee_idx = random.randint(0, len(callee_pg["aliases"]) - 1)
                    callee = callee_pg["aliases"][callee_idx]
                    callee_phone = callee_pg["phones"][callee_idx % len(callee_pg["phones"])]

                    call_time = current_day + timedelta(hours=random.randint(7, 23), minutes=random.randint(0, 59))
                    duration = random.randint(10, 600)
                    loc = random.choice(LOCATIONS[:4])

                    records.append({
                        "record_id": gen_id("CDR"),
                        "caller_id": phone,
                        "callee_id": callee_phone,
                        "start_time": call_time.strftime("%Y-%m-%dT%H:%M:%S"),
                        "duration_seconds": duration,
                        "direction": random.choice(["outgoing", "incoming"]),
                        "caller_device_id": device,
                        "caller_tower_id": loc["id"],
                        "lat": loc["lat"],
                        "lon": loc["lon"],
                    })

                if random.random() < 0.4:
                    loc = random.choice(LOCATIONS[:4])
                    obs_time = current_day + timedelta(hours=random.randint(7, 22))
                    records.append({
                        "record_id": gen_id("DEV"),
                        "device_id": device,
                        "phone_id": phone,
                        "sim_id": sim,
                        "event_time": obs_time.strftime("%Y-%m-%dT%H:%M:%S"),
                        "event_type": random.choice(["sim_insert", "device_boot", "sim_swap"]),
                        "tower_id": loc["id"],
                        "lat": loc["lat"],
                        "lon": loc["lon"],
                    })

                if random.random() < 0.3:
                    loc = random.choice(LOCATIONS[:4])
                    records.append({
                        "record_id": gen_id("DEV"),
                        "phone_id": phone,
                        "sim_id": sim,
                        "device_id": device,
                        "event_time": (current_day + timedelta(hours=random.randint(7, 22))).strftime("%Y-%m-%dT%H:%M:%S"),
                        "event_type": random.choice(["sim_insert", "device_boot", "sim_swap"]),
                        "tower_id": loc["id"],
                        "lat": loc["lat"],
                        "lon": loc["lon"],
                    })

    messages = [
        "The meeting is confirmed for tomorrow at the usual place.",
        "I will send the documents by evening. Please review them carefully.",
        "Can we reschedule? Something urgent came up.",
        "Payment has been transferred. Check your account.",
        "Location changed. Use the backup route.",
        "I have received the package. Thank you.",
        "Let us meet near the tower area after 6 PM.",
        "The report is ready. I will share it now.",
        "Need to discuss the project timeline. Free this afternoon?",
        "All clear on my end. Proceed as planned.",
        "The contact has been verified. Moving forward.",
        "Please confirm the address before visiting.",
        "Meeting notes are attached. Review and confirm.",
        "Running a bit late. Will be there in 20 minutes.",
        "The analysis is complete. Results look promising.",
        "I have updated the records. Please cross-check.",
        "Got it. Will follow up with the team.",
        "No issues on my side. Ready when you are.",
        "The meeting point has been changed to the north side.",
        "Acknowledged. Proceeding with the next step.",
        "Found something interesting in the data. Will explain later.",
        "Everything is on track. No delays expected.",
        "Let me know if you need any additional information.",
        "The final review is scheduled for next week.",
    ]

    for pg in person_groups:
        for i, alias in enumerate(pg["aliases"]):
            phone = pg["phones"][i % len(pg["phones"])]
            if random.random() < 0.7:
                msg_count = random.randint(10, 25)
                for _ in range(msg_count):
                    target_pg = random.choice(person_groups)
                    target_idx = random.randint(0, len(target_pg["aliases"]) - 1)
                    target_alias = target_pg["aliases"][target_idx]
                    msg_time = base_time + timedelta(days=random.randint(0, 20), hours=random.randint(7, 23))
                    records.append({
                        "record_id": gen_id("MSG"),
                        "alias_id": alias,
                        "conversation_id": f"conv-{alias}-{target_alias}",
                        "timestamp": msg_time.strftime("%Y-%m-%dT%H:%M:%S"),
                        "language": "en",
                        "text": random.choice(messages),
                    })

    accounts = [gen_account() for _ in range(6)]
    for day in range(21):
        current_day = base_time + timedelta(days=day)
        for _ in range(random.randint(1, 4)):
            src = random.choice(accounts)
            dst = random.choice([a for a in accounts if a != src])
            tx_time = current_day + timedelta(hours=random.randint(9, 18))
            records.append({
                "record_id": gen_id("TXN"),
                "from_account_id": src,
                "to_account_id": dst,
                "timestamp": tx_time.strftime("%Y-%m-%dT%H:%M:%S"),
                "amount": round(random.uniform(500, 50000), 2),
                "currency": "INR",
                "reference": f"REF-{random.randint(10000, 99999)}",
            })

    for alias in ALIASES[8:16]:
        phone = gen_phone()
        device = gen_device()
        for _ in range(random.randint(5, 15)):
            target = random.choice(ALIASES[8:16])
            if target == alias:
                continue
            msg_time = base_time + timedelta(days=random.randint(0, 20), hours=random.randint(7, 23))
            records.append({
                "record_id": gen_id("MSG"),
                "alias_id": alias,
                "conversation_id": f"ctrl-{alias}-{target}",
                "timestamp": msg_time.strftime("%Y-%m-%dT%H:%M:%S"),
                "language": "en",
                "text": random.choice([
                    "Hello, how are you?",
                    "The weather is nice today.",
                    "Let us catch up sometime.",
                    "Thanks for the update.",
                    "I will call you later.",
                ]),
            })
        for _ in range(random.randint(2, 6)):
            loc = random.choice(LOCATIONS)
            obs_time = base_time + timedelta(days=random.randint(0, 20), hours=random.randint(7, 22))
            records.append({
                "record_id": gen_id("DEV"),
                "device_id": device,
                "event_time": obs_time.strftime("%Y-%m-%dT%H:%M:%S"),
                "event_type": random.choice(["sim_insert", "device_boot", "sim_swap"]),
                "tower_id": loc["id"],
                "lat": loc["lat"],
                "lon": loc["lon"],
            })

    for r in records:
        if "record_id" not in r:
            r["record_id"] = gen_id("UNK")

    with open(os.path.join(OUTPUT_DIR, "case_a_batch1_cdr.json"), "w") as f:
        cdr_records = [r for r in records if "caller_id" in r]
        json.dump(cdr_records, f, indent=2)

    with open(os.path.join(OUTPUT_DIR, "case_a_batch2_messages.json"), "w") as f:
        msg_records = [r for r in records if "text" in r]
        json.dump(msg_records, f, indent=2)

    with open(os.path.join(OUTPUT_DIR, "case_a_batch3_devices_locs.json"), "w") as f:
        dev_loc_records = [r for r in records if "device_id" in r or "entity_or_device_id" in r]
        json.dump(dev_loc_records, f, indent=2)

    with open(os.path.join(OUTPUT_DIR, "case_a_batch4_transactions.json"), "w") as f:
        txn_records = [r for r in records if "amount" in r]
        json.dump(txn_records, f, indent=2)

    contradiction_phone = core_phones[0]
    contradiction_records = []
    for _ in range(3):
        target_phone = random.choice(core_phones[3:6])
        t = base_time + timedelta(days=random.randint(15, 20), hours=random.randint(7, 22))
        loc = random.choice(LOCATIONS[4:8])
        contradiction_records.append({
            "record_id": gen_id("CDR-CONTRA"),
            "caller_id": contradiction_phone,
            "callee_id": target_phone,
            "start_time": t.strftime("%Y-%m-%dT%H:%M:%S"),
            "duration_seconds": random.randint(30, 300),
            "direction": "outgoing",
            "caller_device_id": gen_device(),
            "caller_tower_id": loc["id"],
            "lat": loc["lat"],
            "lon": loc["lon"],
        })

    with open(os.path.join(OUTPUT_DIR, "case_a_batch5_contradiction.json"), "w") as f:
        json.dump(contradiction_records, f, indent=2)

    ground_truth["total_records"] = len(records) + len(contradiction_records)
    with open(os.path.join(GROUND_DIR, "case_a_truth.json"), "w") as f:
        json.dump(ground_truth, f, indent=2)

    return len(records), len(contradiction_records)


def generate_case_b():
    records = []
    base_time = datetime(2026, 8, 1, 8, 0, 0)
    accounts = [gen_account() for _ in range(8)]
    domains = [gen_domain() for _ in range(6)]

    for day in range(21):
        current_day = base_time + timedelta(days=day)
        for _ in range(random.randint(3, 8)):
            src = random.choice(accounts[:4])
            dst = random.choice(accounts[4:])
            records.append({
                "record_id": gen_id("TXN"),
                "from_account_id": src,
                "to_account_id": dst,
                "timestamp": (current_day + timedelta(hours=random.randint(9, 18))).strftime("%Y-%m-%dT%H:%M:%S"),
                "amount": round(random.uniform(1000, 100000), 2),
                "currency": "INR",
                "reference": f"REF-{random.randint(10000, 99999)}",
            })

    for domain in domains:
        ip = gen_ip()
        for _ in range(random.randint(1, 3)):
            records.append({
                "record_id": gen_id("INFRA"),
                "subject_id": random.choice(accounts[:4]),
                "domain": domain,
                "ip_address": ip,
                "tls_fingerprint": hashlib.sha256(domain.encode()).hexdigest()[:32],
                "first_seen": base_time.strftime("%Y-%m-%dT%H:%M:%S"),
                "last_seen": (base_time + timedelta(days=20)).strftime("%Y-%m-%dT%H:%M:%S"),
                "source_description": "imported infrastructure record",
            })

    with open(os.path.join(OUTPUT_DIR, "case_b_harbor_ledger.json"), "w") as f:
        json.dump(records, f, indent=2)

    return len(records)


def generate_case_c():
    records = []
    base_time = datetime(2026, 8, 1, 8, 0, 0)
    aliases = [f"Quiet-{i:02d}" for i in range(1, 9)]
    phones = [gen_phone() for _ in range(8)]

    for i, alias in enumerate(aliases):
        phone = phones[i]
        for _ in range(random.randint(1, 3)):
            target_idx = random.randint(0, len(aliases) - 1)
            if target_idx == i:
                continue
            t = base_time + timedelta(days=random.randint(0, 20), hours=random.randint(7, 23))
            records.append({
                "record_id": gen_id("CDR-Q"),
                "caller_id": phone,
                "callee_id": phones[target_idx],
                "start_time": t.strftime("%Y-%m-%dT%H:%M:%S"),
                "duration_seconds": random.randint(10, 120),
                "direction": "outgoing",
                "caller_device_id": gen_device(),
                "caller_tower_id": random.choice(LOCATIONS)["id"],
            })

    with open(os.path.join(OUTPUT_DIR, "case_c_quiet_market.json"), "w") as f:
        json.dump(records, f, indent=2)

    return len(records)


def generate_templates():
    templates = {
        "cdr": {
            "fields": ["record_id", "caller_id", "callee_id", "start_time", "duration_seconds", "direction", "caller_device_id", "caller_tower_id"],
            "required": ["record_id", "caller_id", "callee_id", "start_time"],
            "optional": ["duration_seconds", "direction", "caller_device_id", "caller_tower_id"],
        },
        "device_sim": {
            "fields": ["record_id", "phone_id", "sim_id", "device_id", "event_time", "event_type", "tower_id"],
            "required": ["record_id", "device_id", "event_time", "event_type"],
            "optional": ["phone_id", "sim_id", "tower_id"],
        },
        "messages": {
            "fields": ["record_id", "alias_id", "conversation_id", "timestamp", "language", "text"],
            "required": ["record_id", "alias_id", "timestamp", "text"],
            "optional": ["conversation_id", "language"],
        },
        "transactions": {
            "fields": ["record_id", "from_account_id", "to_account_id", "timestamp", "amount", "currency", "reference"],
            "required": ["record_id", "from_account_id", "to_account_id", "timestamp", "amount"],
            "optional": ["currency", "reference"],
        },
    }

    with open(os.path.join(OUTPUT_DIR, "templates.json"), "w") as f:
        json.dump(templates, f, indent=2)


if __name__ == "__main__":
    print("Generating synthetic demo data...")
    n_a1, n_a2 = generate_case_a()
    print(f"  Case A (Broken Chain): {n_a1} + {n_a2} contradiction records")
    n_b = generate_case_b()
    print(f"  Case B (Harbor Ledger): {n_b} records")
    n_c = generate_case_c()
    print(f"  Case C (Quiet Market): {n_c} records")
    generate_templates()
    print("  Templates generated")
    print("Done.")
