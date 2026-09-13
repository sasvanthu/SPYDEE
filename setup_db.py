import subprocess
import sys

psql = r"C:\Program Files\PostgreSQL\18\bin\psql.exe"

def run_sql(sql):
    r = subprocess.run([psql, "-U", "postgres", "-h", "127.0.0.1", "-d", "postgres", "-c", sql],
                       capture_output=True, text=True, timeout=10)
    if r.stdout.strip():
        print(f"  OK: {r.stdout.strip()}")
    if r.stderr.strip():
        print(f"  ERR: {r.stderr.strip()[:200]}")
    return r.returncode

print("Creating user...")
run_sql("CREATE USER spydee WITH PASSWORD 'spydee_dev_pass' CREATEDB;")

print("Creating database...")
run_sql("CREATE DATABASE spydee OWNER spydee;")

print("Granting privileges...")
run_sql("GRANT ALL PRIVILEGES ON DATABASE spydee TO spydee;")

print("Done.")
