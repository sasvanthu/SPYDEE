import subprocess
import sys
import os
import shutil

def find_psql():
    if os.environ.get("PSQL_PATH") and os.path.exists(os.environ["PSQL_PATH"]):
        return os.environ["PSQL_PATH"]
    
    which_psql = shutil.which("psql")
    if which_psql:
        return which_psql

    for ver in ["18", "17", "16", "15", "14"]:
        candidate = rf"C:\Program Files\PostgreSQL\{ver}\bin\psql.exe"
        if os.path.exists(candidate):
            return candidate
        candidate_x86 = rf"C:\Program Files (x86)\PostgreSQL\{ver}\bin\psql.exe"
        if os.path.exists(candidate_x86):
            return candidate_x86

    return None

def run_via_psql(psql_path):
    print(f"Using PostgreSQL CLI: {psql_path}")
    
    def exec_sql(sql):
        env = os.environ.copy()
        r = subprocess.run(
            [psql_path, "-U", "postgres", "-h", "127.0.0.1", "-d", "postgres", "-t", "-A", "-c", sql],
            capture_output=True, text=True, timeout=15, env=env
        )
        return r.returncode, r.stdout.strip(), r.stderr.strip()

    # 1. Create or update user spydee
    print("Checking / Creating user 'spydee'...")
    rc, out, err = exec_sql("SELECT 1 FROM pg_roles WHERE rolname='spydee';")
    if rc != 0 and "password authentication failed" in err.lower():
        print(f"  [ERROR] PostgreSQL password authentication failed for user 'postgres'.")
        print("  Please set the PGPASSWORD environment variable and try again:")
        print("    $env:PGPASSWORD='your_postgres_password'; python setup_db.py")
        return False
    elif rc != 0:
        print(f"  [WARN] Could not check role ({err[:120]}), attempting create...")
        exec_sql("CREATE USER spydee WITH PASSWORD 'spydee_dev_pass' CREATEDB;")
    elif out == "1":
        print("  User 'spydee' already exists.")
        exec_sql("ALTER USER spydee WITH PASSWORD 'spydee_dev_pass';")
    else:
        rc, out, err = exec_sql("CREATE USER spydee WITH PASSWORD 'spydee_dev_pass' CREATEDB;")
        if rc == 0:
            print("  Created user 'spydee' successfully.")
        else:
            print(f"  Note: {err}")

    # 2. Create database spydee if it doesn't exist
    print("Checking / Creating database 'spydee'...")
    rc, out, err = exec_sql("SELECT 1 FROM pg_database WHERE datname='spydee';")
    if out == "1":
        print("  Database 'spydee' already exists.")
    else:
        rc, out, err = exec_sql("CREATE DATABASE spydee OWNER spydee;")
        if rc == 0:
            print("  Created database 'spydee' successfully.")
        else:
            print(f"  Note: {err}")

    # 3. Grant privileges
    print("Granting database privileges...")
    rc, out, err = exec_sql("GRANT ALL PRIVILEGES ON DATABASE spydee TO spydee;")
    if rc == 0:
        print("  Privileges granted.")
    else:
        print(f"  Note: {err}")

    return True

def run_via_psycopg2():
    try:
        import psycopg2
        from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
    except ImportError:
        return False

    print("Attempting database setup via Python psycopg2 driver...")
    pg_pass = os.environ.get("PGPASSWORD", "postgres")
    try:
        conn = psycopg2.connect(
            host="127.0.0.1",
            user="postgres",
            password=pg_pass,
            database="postgres"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        # User check / create
        cur.execute("SELECT 1 FROM pg_roles WHERE rolname='spydee';")
        if cur.fetchone():
            print("  User 'spydee' already exists.")
            cur.execute("ALTER USER spydee WITH PASSWORD 'spydee_dev_pass';")
        else:
            cur.execute("CREATE USER spydee WITH PASSWORD 'spydee_dev_pass' CREATEDB;")
            print("  Created user 'spydee'.")

        # DB check / create
        cur.execute("SELECT 1 FROM pg_database WHERE datname='spydee';")
        if cur.fetchone():
            print("  Database 'spydee' already exists.")
        else:
            cur.execute("CREATE DATABASE spydee OWNER spydee;")
            print("  Created database 'spydee'.")

        cur.execute("GRANT ALL PRIVILEGES ON DATABASE spydee TO spydee;")
        print("  Privileges granted.")
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"  psycopg2 setup error: {e}")
        return False

def main():
    print("=" * 60)
    print(" SPYDEE Local PostgreSQL Database Initializer")
    print("=" * 60)

    psql_path = find_psql()
    if psql_path:
        success = run_via_psql(psql_path)
        if success:
            print("\n[SUCCESS] Local PostgreSQL database 'spydee' is ready!")
            return 0

    # Fallback to psycopg2
    if run_via_psycopg2():
        print("\n[SUCCESS] Local PostgreSQL database 'spydee' is ready via psycopg2!")
        return 0

    print("\n[ERROR] Unable to configure PostgreSQL automatically.")
    print("Please ensure PostgreSQL is installed and running on localhost:5432.")
    print("You can manually run in pgAdmin or psql:")
    print("  CREATE USER spydee WITH PASSWORD 'spydee_dev_pass' CREATEDB;")
    print("  CREATE DATABASE spydee OWNER spydee;")
    print("  GRANT ALL PRIVILEGES ON DATABASE spydee TO spydee;")
    return 1

if __name__ == "__main__":
    sys.exit(main())
