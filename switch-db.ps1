# SPYDEE Database Switcher & Local Seeder (PowerShell)
# Allows switching active configuration between Local PostgreSQL and Supabase Cloud,
# and generates/seeds all datasets locally on any machine.
param (
    [ValidateSet("local", "supabase", "seed", "generate", "status", "prune", "revert", "menu", "")]
    [string]$Target = ""
)

$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

# Standard local environment configuration
$LocalEnvContent = @"
DATABASE_URL=postgresql+asyncpg://spydee:spydee_dev_pass@localhost:5432/spydee
DATABASE_URL_SYNC=postgresql://spydee:spydee_dev_pass@localhost:5432/spydee
SECRET_KEY=prototype-dev-secret-key-do-not-use-in-production
UPLOAD_DIR=./data/uploads
DEMO_MODE=true
CORS_ORIGINS=http://localhost:5173
"@

# Standard Supabase cloud environment configuration
$SupabaseEnvContent = @"
DATABASE_URL=postgresql+asyncpg://postgres:Orehack%402026@db.limyyynvqzitwwkygylp.supabase.co:5432/postgres
DATABASE_URL_SYNC=postgresql://postgres:Orehack%402026@db.limyyynvqzitwwkygylp.supabase.co:5432/postgres?sslmode=require
SECRET_KEY=prototype-dev-secret-key-do-not-use-in-production
UPLOAD_DIR=./data/uploads
DEMO_MODE=true
CORS_ORIGINS=http://localhost:5173
SUPABASE_URL=https://limyyynvqzitwwkygylp.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpbXl5eW52cXppdHd3a3lneWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NTI5MTYsImV4cCI6MjEwNTIyODkxNn0.pTqQZAFbsvTkJeTvOAz0r5Y9NDCMyISzKfn3w4VzHjM
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpbXl5eW52cXppdHd3a3lneWxwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTY1MjkxNiwiZXhwIjoyMTA1MjI4OTE2fQ.auvZO9UTOrOzsCAqKKUDFkSZ3T3vz_ORcrCYxuSaFLc
"@

function Ensure-ConfigFiles {
    if (-not (Test-Path "$root\.env.local")) {
        Write-Host "Creating default .env.local configuration..." -ForegroundColor Gray
        Set-Content -Path "$root\.env.local" -Value $LocalEnvContent -Encoding UTF8
    }
    if (-not (Test-Path "$root\.env.supabase")) {
        Write-Host "Creating default .env.supabase configuration..." -ForegroundColor Gray
        Set-Content -Path "$root\.env.supabase" -Value $SupabaseEnvContent -Encoding UTF8
    }
}

function Get-CurrentDb {
    if (Test-Path "$root\.env") {
        $dbLine = Get-Content "$root\.env" | Where-Object { $_ -match "^DATABASE_URL=" } | Select-Object -First 1
        if ($dbLine -and ($dbLine -notmatch "localhost") -and ($dbLine -notmatch "127\.0\.0\.1")) {
            return "Supabase Cloud Database"
        } elseif ($dbLine) {
            return "Local PostgreSQL (localhost:5432/spydee)"
        }
    }
    return "Not Configured (.env missing)"
}

function Show-Status {
    $current = Get-CurrentDb
    Write-Host "`nCurrent Active Configuration: " -NoNewline
    if ($current -match "Supabase") {
        Write-Host $current -ForegroundColor Magenta
    } elseif ($current -match "Local") {
        Write-Host $current -ForegroundColor Green
    } else {
        Write-Host $current -ForegroundColor Yellow
    }

    # Test count if Python and DB reachable
    Write-Host "Checking database statistics..." -ForegroundColor Gray
    try {
        $stats = python -c "
import sys; sys.path.insert(0, 'services/api')
from app.config import get_settings
from sqlalchemy import create_engine, text
try:
    engine = create_engine(get_settings().DATABASE_URL_SYNC, connect_args={'connect_timeout': 5})
    with engine.connect() as conn:
        users = conn.execute(text('SELECT count(*) FROM users')).scalar()
        cases = conn.execute(text('SELECT count(*) FROM cases')).scalar()
        ents = conn.execute(text('SELECT count(*) FROM entities')).scalar()
        rels = conn.execute(text('SELECT count(*) FROM relationships')).scalar()
        print(f'Cases: {cases} | Entities: {ents} | Relationships: {rels} | Users: {users}')
except Exception as e:
    err = str(e)
    if 'does not exist' in err or 'no such table' in err:
        print('CONNECTED (Empty schema - run Seed to generate tables)')
    else:
        print('UNREACHABLE (' + err.split('\n')[0][:80] + ')')
" 2>$null
        if ($stats) {
            Write-Host "DB Status: $stats" -ForegroundColor Cyan
        }
    } catch {}
}

function Switch-ToLocal {
    Ensure-ConfigFiles
    Copy-Item "$root\.env.local" "$root\.env" -Force
    if (Test-Path "$root\services\api") {
        Copy-Item "$root\.env.local" "$root\services\api\.env" -Force
    }
    Write-Host "`n[OK] Switched active configuration to: " -NoNewline
    Write-Host "Local PostgreSQL" -ForegroundColor Green
    Write-Host "DATABASE_URL -> localhost:5432/spydee" -ForegroundColor Gray
}

function Switch-ToSupabase {
    Ensure-ConfigFiles
    Copy-Item "$root\.env.supabase" "$root\.env" -Force
    if (Test-Path "$root\services\api") {
        Copy-Item "$root\.env.supabase" "$root\services\api\.env" -Force
    }
    Write-Host "`n[OK] Switched active configuration to: " -NoNewline
    Write-Host "Supabase Cloud Database" -ForegroundColor Magenta
    Write-Host "DATABASE_URL -> db.limyyynvqzitwwkygylp.supabase.co" -ForegroundColor Gray
}

function Seed-LocalData {
    Ensure-ConfigFiles
    Switch-ToLocal

    Write-Host "`n========================================================" -ForegroundColor Cyan
    Write-Host "  Step 1/3: Initializing Local Database & User          " -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
    python "$root\setup_db.py"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n[WARNING] setup_db.py reported an issue. Ensuring PostgreSQL is running on port 5432..." -ForegroundColor Yellow
    }

    Write-Host "`n========================================================" -ForegroundColor Cyan
    Write-Host "  Step 2/3: Creating Tables & Core Demo Cases           " -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
    python "$root\demo\generator\seed_db.py"

    Write-Host "`n========================================================" -ForegroundColor Cyan
    Write-Host "  Step 3/3: Ingesting All 25 Datasets Across 13 Cases   " -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
    python "$root\demo\generator\seed_all_25_datasets.py"

    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host "  ALL DATA GENERATION COMPLETED SUCCESSFULLY!           " -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green
    Write-Host "You can now run 'run_spydee.bat' to launch all services." -ForegroundColor Yellow
}

function Show-Header {
    Clear-Host
    Write-Host "=======================================================" -ForegroundColor Cyan
    Write-Host "       SPYDEE Database Switcher & Data Generator       " -ForegroundColor Cyan
    Write-Host "=======================================================" -ForegroundColor Cyan
    Show-Status
}

# Ensure .env.local and .env.supabase exist
Ensure-ConfigFiles

# Handle explicit CLI arguments
if ($Target -eq "local") {
    Switch-ToLocal
    exit 0
} elseif ($Target -eq "supabase") {
    Switch-ToSupabase
    exit 0
} elseif ($Target -eq "seed" -or $Target -eq "generate") {
    Seed-LocalData
    exit 0
} elseif ($Target -eq "status") {
    Show-Status
    exit 0
} elseif ($Target -eq "prune") {
    Write-Host "Pruning Supabase database storage (dropping bulk raw logs)..." -ForegroundColor Yellow
    python "$root\scripts\prune_supabase_storage.py"
    exit 0
} elseif ($Target -eq "revert") {
    Write-Host "1. Switching active configuration back to Local PostgreSQL..." -ForegroundColor Yellow
    Switch-ToLocal
    Write-Host "2. Wiping Supabase Cloud tables back to clean slate..." -ForegroundColor Yellow
    python "$root\scripts\prune_supabase_storage.py" --revert-all
    exit 0
}

# Interactive Menu Loop (if run without arguments)
while ($true) {
    Show-Header
    Write-Host "`nMenu Options:" -ForegroundColor Yellow
    Write-Host "  [1] Switch to Local PostgreSQL (.env.local)"
    Write-Host "  [2] Switch to Supabase Cloud (.env.supabase)"
    Write-Host "  [3] Generate / Seed All Data in Local DB (Setup DB + 13 Cases + 25 Datasets)"
    Write-Host "  [4] Refresh Status & Database Statistics"
    Write-Host "  [5] Prune Supabase Storage (~15MB compact mode)"
    Write-Host "  [6] Revert / Wipe Supabase Data"
    Write-Host "  [7] Exit"
    
    $choice = Read-Host "`nEnter selection (1-7)"
    switch ($choice) {
        "1" { Switch-ToLocal; Write-Host "`nPress any key to continue..."; [void][System.Console]::ReadKey() }
        "2" { Switch-ToSupabase; Write-Host "`nPress any key to continue..."; [void][System.Console]::ReadKey() }
        "3" { Seed-LocalData; Write-Host "`nPress any key to continue..."; [void][System.Console]::ReadKey() }
        "4" { # Loop refreshes header
            }
        "5" { 
            Write-Host "Pruning Supabase database storage..." -ForegroundColor Yellow
            python "$root\scripts\prune_supabase_storage.py"
            Write-Host "`nPress any key to continue..."; [void][System.Console]::ReadKey()
        }
        "6" { 
            Write-Host "Reverting Supabase..." -ForegroundColor Yellow
            Switch-ToLocal
            python "$root\scripts\prune_supabase_storage.py" --revert-all
            Write-Host "`nPress any key to continue..."; [void][System.Console]::ReadKey()
        }
        "7" { exit 0 }
        default { Write-Host "Invalid option. Please enter 1-7." -ForegroundColor Red; Start-Sleep -Seconds 1 }
    }
}
