"""
SPYDEE Database Synchronization: Local PostgreSQL -> Supabase Cloud
Streams table data using PostgreSQL binary COPY protocol with
session_replication_role='replica' for fast, constraint-free loading.

Features:
  - Chunked uploads with per-chunk commits and live progress output.
  - Per-table atomic load via a staging table (swap on completion).
  - Resumable: completed tables are skipped on re-run unless
    --force is given (state kept in .sync_state.json next to this script).
  - Per-table retry with reconnect on connection failures.
"""

import sys
import os
import io
import json
import time
import argparse
from datetime import datetime
import psycopg2

LOCAL_URL = os.environ.get(
    "LOCAL_DATABASE_URL_SYNC",
    "postgresql://spydee:spydee_dev_pass@localhost:5432/spydee"
)
SUPABASE_URL = os.environ.get(
    "SUPABASE_DATABASE_URL_SYNC",
    "postgresql://postgres:Orehack%402026@db.limyyynvqzitwwkygylp.supabase.co:5432/postgres?sslmode=require"
)
STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".sync_state.json")

DEFAULT_CHUNK_ROWS = 50_000
MAX_ATTEMPTS = 3

# Preferred migration order (dependencies first, though replica mode handles any order)
ORDERED_TABLES = [
    "users",
    "cases",
    "case_memberships",
    "sessions",
    "evidence_files",
    "imports",
    "source_records",
    "document_chunks",
    "entities",
    "identifiers",
    "entity_identifier_links",
    "events",
    "event_participants",
    "relationships",
    "relationship_evidence",
    "analysis_runs",
    "signals",
    "hypotheses",
    "hypothesis_signals",
    "hypothesis_recommendations",
    "contradictions",
    "contradiction_reviews",
    "leads",
    "lead_reviews",
    "information_gaps",
    "investigation_actions",
    "merge_suggestions",
    "entity_review_decisions",
    "copilot_messages",
    "reports",
    "saved_views",
    "audit_events",
    "jobs",
    "review_actions"
]


def log(msg):
    print(msg, flush=True)


def load_state():
    try:
        with open(STATE_FILE, "r") as f:
            return set(json.load(f).get("completed", []))
    except (FileNotFoundError, json.JSONDecodeError):
        return set()


def save_state(completed):
    with open(STATE_FILE, "w") as f:
        json.dump({"completed": sorted(completed)}, f, indent=2)


def local_tables(cur):
    cur.execute(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name != 'alembic_version';"
    )
    return set(r[0] for r in cur.fetchall())


def table_count(cur, table):
    cur.execute(f'SELECT count(*) FROM "{table}";')
    return cur.fetchone()[0]


def configure_session(cur):
    cur.execute("SET statement_timeout = 0;")
    cur.execute("SET session_replication_role = 'replica';")


def connect_supabase():
    conn = psycopg2.connect(SUPABASE_URL, connect_timeout=20)
    cur = conn.cursor()
    configure_session(cur)
    conn.commit()
    return conn, cur


def reset_sequence(cur, table):
    """Advance serial/identity sequence for tables with an integer PK named 'id'."""
    try:
        cur.execute(
            f"SELECT data_type FROM information_schema.columns "
            f"WHERE table_schema = 'public' AND table_name = '{table}' AND column_name = 'id';"
        )
        row = cur.fetchone()
        if row and row[0] in ("integer", "bigint", "smallint"):
            cur.execute(f'SELECT setval(pg_get_serial_sequence(\'{table}\', \'id\'), '
                        f'COALESCE((SELECT max(id) FROM "{table}"), 1), true);')
    except Exception:
        pass


def load_table(local_conn, supa_conn, table, chunk_rows):
    """Load one table into Supabase. Returns (rows, bytes). Raises on failure."""
    lc = local_conn.cursor()
    sc = supa_conn.cursor()

    local_count = table_count(lc, table)
    if local_count == 0:
        print(f"  [SKIP] {table:<30} 0 local rows (no data to sync)")
        return 0, 0

    staging = f"_spydee_staging"

    def cleanup():
        try:
            sc.execute(f"DROP TABLE IF EXISTS {staging} CASCADE;")
            supa_conn.commit()
        except Exception:
            supa_conn.rollback()

    try:
        sc.execute(f"DROP TABLE IF EXISTS {staging} CASCADE;")
        sc.execute(f"CREATE TABLE {staging} (LIKE \"{table}\" INCLUDING ALL);")
        supa_conn.commit()
    except Exception as e:
        supa_conn.rollback()
        raise RuntimeError(f"failed to create staging table: {e}")

    total_bytes = 0
    offset = 0
    batch = 0
    while True:
        select_sql = (f"SELECT * FROM \"{table}\" ORDER BY ctid "
                      f"LIMIT {chunk_rows} OFFSET {offset}")
        lc.execute(f"SELECT count(*) FROM ({select_sql}) q;")
        cnt = lc.fetchone()[0]
        if cnt == 0:
            break

        buf = io.BytesIO()
        lc.copy_expert(f"COPY ({select_sql}) TO STDOUT WITH BINARY", buf)
        nbytes = buf.getbuffer().nbytes
        buf.seek(0)

        sc.execute("SET statement_timeout = 0;")
        sc.copy_expert(f"COPY {staging} FROM STDIN WITH BINARY", buf)
        supa_conn.commit()
        total_bytes += nbytes
        offset += cnt
        batch += 1

        pct = 100.0 * offset / max(local_count, 1)
        print(f"         {table:<30} {offset:>9,}/{local_count:,} ({pct:5.1f}%) "
              f"| {nbytes/1048576:6.1f} MB | batch {batch}")

    if offset != local_count:
        cleanup()
        raise RuntimeError(
            f"row mismatch after copy: got {offset}, expected {local_count}")

    try:
        sc.execute(f"TRUNCATE TABLE \"{table}\" CASCADE;")
        sc.execute(f"INSERT INTO \"{table}\" SELECT * FROM {staging};")
        sc.execute(f"DROP TABLE {staging};")
        reset_sequence(sc, table)
        supa_conn.commit()
    except Exception as e:
        supa_conn.rollback()
        cleanup()
        raise RuntimeError(f"table swap failed: {e}")

    return local_count, total_bytes


def main():
    ap = argparse.ArgumentParser(description="Sync local PostgreSQL to Supabase.")
    ap.add_argument("--force", action="store_true",
                    help="Truncate ALL Supabase tables and reload from scratch.")
    ap.add_argument("--table", help="Sync only the given table.")
    ap.add_argument("--reset", action="store_true",
                    help="Forget which tables already completed.")
    ap.add_argument("--chunk-rows", type=int, default=int(os.environ.get("SYNC_CHUNK_ROWS", DEFAULT_CHUNK_ROWS)))
    args = ap.parse_args()

    print("=" * 65)
    print(" SPYDEE Database Sync: Local PostgreSQL -> Supabase Cloud")
    print(f" Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 65)

    if args.reset:
        if os.path.exists(STATE_FILE):
            os.remove(STATE_FILE)
            print("[STATE] Progress state reset.\n")

    print("\n[1/5] Connecting to databases...")
    try:
        local_conn = psycopg2.connect(LOCAL_URL)
        print("  [OK] Connected to Local PostgreSQL (spydee)")
    except Exception as e:
        print(f"  [ERROR] Failed to connect to Local PostgreSQL: {e}")
        sys.exit(1)

    try:
        supa_conn, sc = connect_supabase()
        print("  [OK] Connected to Supabase Cloud PostgreSQL")
    except Exception as e:
        print(f"  [ERROR] Failed to connect to Supabase Cloud PostgreSQL: {e}")
        sys.exit(1)

    lc = local_conn.cursor()

    all_tables = local_tables(lc)
    tables_to_sync = [t for t in ORDERED_TABLES if t in all_tables]
    remaining = sorted(all_tables - set(tables_to_sync))
    tables_to_sync.extend(remaining)

    if args.table:
        if args.table not in tables_to_sync:
            print(f"  [ERROR] Table '{args.table}' not found in public schema.")
            sys.exit(1)
        tables_to_sync = [args.table]

    print(f"  [OK] Found {len(tables_to_sync)} application table(s) to consider.")

    # [2/5] Prepare Supabase session & clean slate
    print("\n[2/5] Configuring Supabase session / clearing data...")
    completed = load_state() if not args.force else set()

    if args.force:
        try:
            tables_quoted = ", ".join(f'"{t}"' for t in tables_to_sync)
            sc.execute(f"TRUNCATE TABLE {tables_quoted} CASCADE;")
            supa_conn.commit()
            print("  [OK] All selected tables truncated (force mode).")
        except Exception as e:
            supa_conn.rollback()
            print(f"  [ERROR] Failed to truncate Supabase tables: {e}")
            sys.exit(1)
    else:
        print(f"  [OK] Resume state: {len(completed)} of {len(all_tables)} tables previously completed.")

    # [3/5] Stream data table by table
    print("\n[3/5] Migrating tables via binary streaming...")
    total_start = time.time()
    total_rows = 0
    total_bytes = 0
    failures = []

    for idx, table in enumerate(tables_to_sync, 1):
        if not args.force and table in completed:
            print(f"  [{idx:02d}/{len(tables_to_sync)}] {table:<30} already synced (skipped)")
            continue

        lc.execute(f'SELECT count(*) FROM "{table}";')
        local_count = lc.fetchone()[0]
        if local_count == 0:
            print(f"  [{idx:02d}/{len(tables_to_sync)}] {table:<30} 0 rows (skipped)")
            if not args.force:
                completed.add(table)
            continue

        t0 = time.time()
        success = False
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                rows, nbytes = load_table(local_conn, supa_conn, table, args.chunk_rows)
                supa_conn.commit()
                total_rows += rows
                total_bytes += nbytes
                dt = time.time() - t0
                print(f"  [{idx:02d}/{len(tables_to_sync)}] {table:<30} {rows:>9,} rows "
                      f"| {nbytes/1048576:6.1f} MB | {dt:>6.1f}s")
                success = True
                if not args.force:
                    completed.add(table)
                    save_state(sorted(completed))
                break
            except (psycopg2.OperationalError, psycopg2.InterfaceError, RuntimeError, IOError) as e:
                print(f"         {table:<30} attempt {attempt}/{MAX_ATTEMPTS} failed: {e}")
                supa_conn.close()
                try:
                    supa_conn, sc = connect_supabase()
                except Exception as ce:
                    print(f"         {table:<30} reconnect failed: {ce}")
                    time.sleep(5)
                    try:
                        supa_conn, sc = connect_supabase()
                    except Exception as ce2:
                        print(f"         {table:<30} second reconnect failed: {ce2}")
                        break
                time.sleep(3)

        if not success:
            failures.append(table)
            print(f"  [ERROR] Table {table} failed after {MAX_ATTEMPTS} attempts. Continuing...")
            continue

    sc.execute("SET session_replication_role = 'origin';")
    supa_conn.commit()

    total_time = time.time() - total_start
    print(f"\n  [OK] Migration run finished in {total_time:.1f}s.")
    print(f"       Rows synced this run: {total_rows:,}")
    print(f"       Data copied this run: {total_bytes / (1024*1024):.2f} MB")
    if failures:
        print(f"       FAILED tables: {', '.join(failures)}")

    # [4/5] Analyze Supabase tables for optimal query plans
    print("\n[4/5] Running ANALYZE on Supabase tables...")
    supa_conn.autocommit = True
    sc_auto = supa_conn.cursor()
    try:
        sc_auto.execute("ANALYZE;")
        print("  [OK] ANALYZE complete.")
    except Exception as e:
        print(f"  [WARN] Warning: ANALYZE non-fatal error: {e}")

    # [5/5] Verification
    print("\n[5/5] Verifying row parity between Local and Supabase...")
    print(f"\n{'Table Name':<32} | {'Local Count':>12} | {'Supabase Count':>14} | {'Status':>8}")
    print("-" * 74)

    supa_conn.autocommit = False
    all_matched = True
    for table in tables_to_sync:
        lc.execute(f'SELECT count(*) FROM "{table}";')
        local_c = lc.fetchone()[0]

        try:
            sc.execute(f'SELECT count(*) FROM "{table}";')
            supa_c = sc.fetchone()[0]
        except psycopg2.Error as e:
            print(f"{table:<32} | {local_c:>12,} | {'ERR':>14} | {'ERROR':>8}")
            all_matched = False
            supa_conn.rollback()
            continue

        match = (local_c == supa_c)
        status = "MATCH" if match else "MISMATCH"
        if not match:
            all_matched = False
        print(f"{table:<32} | {local_c:>12,} | {supa_c:>14,} | {status:>8}")

    print("-" * 74)
    if all_matched:
        print("SUCCESS: 100% row count parity achieved across all tables!\n")
    else:
        print("WARNING: Some table row counts did not match. Please inspect above.\n")

    local_conn.close()
    supa_conn.close()


if __name__ == "__main__":
    main()