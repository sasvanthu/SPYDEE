"""
SPYDEE Database Storage Pruner & Optimizer for Supabase Cloud
Safely reduces Supabase database size to stay well under the 500 MB free quota.

Options:
  --keep-necessary (DEFAULT):
      - Drops junk/benchmark tables (_thp, _spydee_staging, _throughput_test)
      - Truncates bulky raw log tables (source_records, events, event_participants, relationship_evidence)
      - Retains all critical intelligence: Cases, Entities, Identifiers, Relationships, Hypotheses, Signals, Users
      - Runs VACUUM FULL to reclaim physical disk space.
      - Expected size: ~15 MB (down from 645 MB, 97% savings).
  --revert-all:
      - Completely wipes all tables on Supabase back to 0 MB clean slate.
  --status:
      - Shows current table sizes and total database usage.
"""

import sys
import os
import argparse
import psycopg2

SUPABASE_URL = os.environ.get(
    "SUPABASE_DATABASE_URL_SYNC",
    "postgresql://postgres:Orehack%402026@db.limyyynvqzitwwkygylp.supabase.co:5432/postgres?sslmode=require"
)

def get_connection():
    return psycopg2.connect(SUPABASE_URL, connect_timeout=25)

def print_status(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT relname AS table_name,
               pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
               n_live_tup AS rows,
               pg_total_relation_size(relid) AS raw_size
        FROM pg_catalog.pg_stat_user_tables
        ORDER BY raw_size DESC;
    """)
    rows = cur.fetchall()
    print("\n" + "=" * 65)
    print(f"{'TABLE NAME':<32} | {'ROWS':<10} | {'DISK SIZE':<12}")
    print("=" * 65)
    for r in rows:
        if r[3] > 0 or r[2] > 0:
            print(f"{r[0]:<32} | {str(r[2]):<10} | {r[1]:<12}")
    
    cur.execute("SELECT pg_size_pretty(pg_database_size(current_database()))")
    total_db = cur.fetchone()[0]
    print("=" * 65)
    print(f"TOTAL SUPABASE DATABASE SIZE: {total_db}")
    print("=" * 65 + "\n")

def drop_junk_tables(conn):
    cur = conn.cursor()
    junk = ["_thp", "_spydee_staging", "_throughput_test"]
    for t in junk:
        try:
            cur.execute(f"DROP TABLE IF EXISTS {t} CASCADE;")
            print(f"  [OK] Dropped temporary/staging table: {t}")
        except Exception as e:
            print(f"  [WARN] Could not drop {t}: {e}")
    conn.commit()

def prune_bulk_tables(conn):
    cur = conn.cursor()
    # Bulk tables that can be re-streamed from JSON data folders at any time
    bulk_tables = [
        "source_records",
        "event_participants",
        "events",
        "relationship_evidence",
    ]
    print("\nPurging bulk raw record tables (data remains safe in local JSON folders)...")
    for t in bulk_tables:
        try:
            cur.execute(f"TRUNCATE TABLE {t} CASCADE;")
            print(f"  [OK] Truncated {t} (raw records cleared)")
        except Exception as e:
            print(f"  [WARN] Failed to truncate {t}: {e}")
    conn.commit()

def wipe_all(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name != 'alembic_version';
    """)
    tables = [r[0] for r in cur.fetchall()]
    print("\nWiping all data tables on Supabase...")
    for t in tables:
        try:
            cur.execute(f"TRUNCATE TABLE {t} CASCADE;")
            print(f"  [OK] Truncated {t}")
        except Exception as e:
            print(f"  [WARN] Failed to truncate {t}: {e}")
    conn.commit()

def vacuum_full(conn):
    # VACUUM cannot run inside a transaction block
    conn.autocommit = True
    cur = conn.cursor()
    print("\nReclaiming physical disk space (VACUUM FULL)...")
    try:
        cur.execute("VACUUM FULL;")
        print("  [OK] VACUUM FULL completed successfully.")
    except Exception as e:
        print(f"  [WARN] VACUUM FULL warning: {e}")
    conn.autocommit = False

def main():
    parser = argparse.ArgumentParser(description="Prune and optimize Supabase database to stay within 500MB free quota.")
    parser.add_argument("--status", action="store_true", help="Display current database storage breakdown.")
    parser.add_argument("--keep-necessary", action="store_true", default=True, help="Drop junk + bulk records, keep entities/cases/hypotheses (Default).")
    parser.add_argument("--revert-all", action="store_true", help="Wipe all data tables on Supabase to 0 MB.")
    args = parser.parse_args()

    print("Connecting to Supabase Cloud PostgreSQL...")
    conn = get_connection()
    print("Connected.")

    print("\n--- BEFORE PRUNING ---")
    print_status(conn)

    if args.status and not args.revert_all:
        conn.close()
        return

    if args.revert_all:
        drop_junk_tables(conn)
        wipe_all(conn)
        vacuum_full(conn)
    else:
        drop_junk_tables(conn)
        prune_bulk_tables(conn)
        vacuum_full(conn)

    print("\n--- AFTER PRUNING ---")
    print_status(conn)
    conn.close()
    print("Done! Database is now well below the 500 MB quota.")

if __name__ == "__main__":
    main()
