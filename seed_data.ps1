# SPYDEE Data Seeding & Generation Pipeline
# Executes and orchestrates all synthetic generation and seeding routines.
# Usage:
#   .\seed_data.ps1                   (Interactive Menu)
#   .\seed_data.ps1 -Status           (Check current database counts & CCTV status)
#   .\seed_data.ps1 -All              (Run complete end-to-end pipeline)
#   .\seed_data.ps1 -Core             (Seed core cases & base users)
#   .\seed_data.ps1 -CCTV             (Add CCTV surveillance observations)
#   .\seed_data.ps1 -Datasets25       (Seed all 25 intelligence datasets)
#   .\seed_data.ps1 -Generate         (Regenerate demo JSON batches)

param (
    [ValidateSet("all", "generate", "core", "cctv", "datasets25", "india", "status", "menu", "")]
    [string]$Action = "",
    [switch]$All,
    [switch]$Generate,
    [switch]$Core,
    [switch]$CCTV,
    [switch]$Datasets25,
    [switch]$India,
    [switch]$Status
)

$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

# Set environment
$env:PYTHONPATH = "$root\services\api;$root"

# Activate virtual environment if present
if (Test-Path "$root\services\worker\venv\Scripts\Activate.ps1") {
    . "$root\services\worker\venv\Scripts\Activate.ps1"
}

function Show-Banner {
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "       SPYDEE Intelligence Seeding & Generator         " -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
}

function Test-Python {
    try {
        $ver = python --version 2>&1
        if ($LASTEXITCODE -eq 0 -or $ver -match "Python") {
            return $true
        }
    } catch {}
    Write-Host "[ERROR] Python was not found in PATH." -ForegroundColor Red
    return $false
}

function Show-Status {
    Show-Banner
    Write-Host "`n[DATABASE STATUS CHECK]" -ForegroundColor Yellow
    
    $checkScript = @"
import asyncio, sys, os
sys.path.insert(0, os.path.abspath('services/api'))
from app.database import async_session
from app.models.models import Case, EvidenceFile, Entity, Relationship, Hypothesis, User
from sqlalchemy import select, func

async def get_stats():
    async with async_session() as db:
        user_cnt = (await db.execute(select(func.count(User.id)))).scalar() or 0
        case_cnt = (await db.execute(select(func.count(Case.id)))).scalar() or 0
        ev_cnt = (await db.execute(select(func.count(EvidenceFile.id)))).scalar() or 0
        cctv_cnt = (await db.execute(select(func.count(EvidenceFile.id)).where(EvidenceFile.source_type == 'CCTV'))).scalar() or 0
        ent_cnt = (await db.execute(select(func.count(Entity.id)))).scalar() or 0
        rel_cnt = (await db.execute(select(func.count(Relationship.id)))).scalar() or 0
        hyp_cnt = (await db.execute(select(func.count(Hypothesis.id)))).scalar() or 0
        
        cctv_batch_res = await db.execute(
            select(EvidenceFile.original_filename, EvidenceFile.case_id)
            .where(EvidenceFile.original_filename.in_(['case_a_batch5_cctv.json', 'case_b_cctv.json']))
        )
        cctv_batches = cctv_batch_res.fetchall()
        
        print(f"Users: {user_cnt}")
        print(f"Cases: {case_cnt}")
        print(f"Evidence Files: {ev_cnt}")
        print(f"CCTV Evidence Files: {cctv_cnt}")
        print(f"Entities: {ent_cnt}")
        print(f"Relationships: {rel_cnt}")
        print(f"Hypotheses: {hyp_cnt}")
        print(f"CCTV Batches (case_a/b): {len(cctv_batches)}")
        for b in cctv_batches:
            print(f"  - {b[0]} (case: {b[1]})")

if __name__ == '__main__':
    try:
        asyncio.run(get_stats())
    except Exception as e:
        print(f"ERR: {e}")
"@

    $tmp = "$root\.status_tmp.py"
    Set-Content -Path $tmp -Value $checkScript -Encoding UTF8
    
    try {
        $out = python $tmp 2>&1
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        
        $cctvExecuted = $false
        foreach ($line in $out) {
            if ($line -match "^Cases: (\d+)") {
                Write-Host "  * Total Active Cases: " -NoNewline; Write-Host $Matches[1] -ForegroundColor Green
            } elseif ($line -match "^Evidence Files: (\d+)") {
                Write-Host "  * Evidence Files: " -NoNewline; Write-Host $Matches[1] -ForegroundColor Green
            } elseif ($line -match "^CCTV Evidence Files: (\d+)") {
                Write-Host "  * CCTV Evidence Files: " -NoNewline; Write-Host $Matches[1] -ForegroundColor Cyan
            } elseif ($line -match "^Entities: (\d+)") {
                Write-Host "  * Entities in Knowledge Graph: " -NoNewline; Write-Host $Matches[1] -ForegroundColor Green
            } elseif ($line -match "^Relationships: (\d+)") {
                Write-Host "  * Relationships in Graph: " -NoNewline; Write-Host $Matches[1] -ForegroundColor Green
            } elseif ($line -match "^Hypotheses: (\d+)") {
                Write-Host "  * Hypotheses Generated: " -NoNewline; Write-Host $Matches[1] -ForegroundColor Green
            } elseif ($line -match "^CCTV Batches \(case_a/b\): (\d+)") {
                if ([int]$Matches[1] -gt 0) {
                    $cctvExecuted = $true
                }
            } elseif ($line -match "^\s+-\s+(case_\w+)") {
                Write-Host "    $line" -ForegroundColor DarkCyan
            } elseif ($line -match "^ERR:") {
                Write-Host "  [Database error]: $line" -ForegroundColor Red
            }
        }
        
        Write-Host ""
        if ($cctvExecuted) {
            Write-Host ">> add_cctv.py Status: ALREADY EXECUTED in this database." -ForegroundColor Green
        } else {
            Write-Host ">> add_cctv.py Status: NOT YET EXECUTED in this database." -ForegroundColor Yellow
        }
    } catch {
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        Write-Host "Failed to query database status: $_" -ForegroundColor Red
    }
}

function Run-Generate {
    Write-Host "`n>> [1] Generating Demo Batch Files (demo/generator/generate.py)..." -ForegroundColor Yellow
    python "$root\demo\generator\generate.py"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Demo batches generated successfully." -ForegroundColor Green
    } else {
        Write-Host "[FAIL] generate.py failed with exit code $LASTEXITCODE." -ForegroundColor Red
    }
}

function Run-SetupDb {
    Write-Host "`n>> Checking database setup (setup_db.py)..." -ForegroundColor Yellow
    python "$root\setup_db.py"
}

function Run-SeedCore {
    Write-Host "`n>> [2] Seeding Core Database & Base Cases (demo/generator/seed_db.py)..." -ForegroundColor Yellow
    python "$root\demo\generator\seed_db.py"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Core cases (Broken Chain, Harbor Ledger, Quiet Market) seeded." -ForegroundColor Green
    } else {
        Write-Host "[FAIL] seed_db.py failed with exit code $LASTEXITCODE." -ForegroundColor Red
    }
}

function Run-AddCCTV {
    Write-Host "`n>> [3] Injecting CCTV Surveillance Observations (demo/generator/add_cctv.py)..." -ForegroundColor Yellow
    python "$root\demo\generator\add_cctv.py"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] CCTV surveillance observations added successfully." -ForegroundColor Green
    } else {
        Write-Host "[FAIL] add_cctv.py failed with exit code $LASTEXITCODE." -ForegroundColor Red
    }
}

function Run-Seed25 {
    Write-Host "`n>> [4] Seeding All 25 Datasets Across 16 Cases (demo/generator/seed_all_25_datasets.py)..." -ForegroundColor Yellow
    python "$root\demo\generator\seed_all_25_datasets.py"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] All 25 datasets ingested across cases." -ForegroundColor Green
    } else {
        Write-Host "[FAIL] seed_all_25_datasets.py failed with exit code $LASTEXITCODE." -ForegroundColor Red
    }
}

function Run-SeedIndia {
    Write-Host "`n>> Seeding India-Specific Cases (demo/generator/seed_all_india_datasets.py)..." -ForegroundColor Yellow
    if (Test-Path "$root\demo\generator\seed_all_india_datasets.py") {
        python "$root\demo\generator\seed_all_india_datasets.py"
    } elseif (Test-Path "$root\demo\generator\seed_india_case.py") {
        python "$root\demo\generator\seed_india_case.py"
    }
}

function Run-AllPipeline {
    Show-Banner
    Write-Host "`nStarting Complete SPYDEE Data Generation & Seeding Pipeline..." -ForegroundColor Cyan
    Run-SetupDb
    Run-Generate
    Run-SeedCore
    Run-AddCCTV
    Run-Seed25
    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host "  FULL PIPELINE COMPLETED SUCCESSFULLY!                 " -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green
    Show-Status
}

# Process command-line switches
if ($All -or $Action -eq "all") {
    if (Test-Python) { Run-AllPipeline }
    exit 0
}
if ($Status -or $Action -eq "status") {
    if (Test-Python) { Show-Status }
    exit 0
}
if ($Generate -or $Action -eq "generate") {
    if (Test-Python) { Run-Generate }
    exit 0
}
if ($Core -or $Action -eq "core") {
    if (Test-Python) { Run-SeedCore }
    exit 0
}
if ($CCTV -or $Action -eq "cctv") {
    if (Test-Python) { Run-AddCCTV }
    exit 0
}
if ($Datasets25 -or $Action -eq "datasets25") {
    if (Test-Python) { Run-Seed25 }
    exit 0
}
if ($India -or $Action -eq "india") {
    if (Test-Python) { Run-SeedIndia }
    exit 0
}

# Interactive Menu when no flags provided
if (Test-Python) {
    while ($true) {
        Show-Banner
        Show-Status
        Write-Host "`nChoose an execution task:" -ForegroundColor Yellow
        Write-Host "  [1] Run Full Pipeline (Generate + Seed Core + Add CCTV + Seed 25 Datasets)" -ForegroundColor Cyan
        Write-Host "  [2] Seed Core Database Only (seed_db.py)" -ForegroundColor White
        Write-Host "  [3] Add CCTV Surveillance Data Only (add_cctv.py)" -ForegroundColor White
        Write-Host "  [4] Seed All 25 Datasets Across 16 Cases (seed_all_25_datasets.py)" -ForegroundColor White
        Write-Host "  [5] Generate Demo Batch Files (generate.py)" -ForegroundColor White
        Write-Host "  [6] Seed India SafeCity Cases (seed_all_india_datasets.py)" -ForegroundColor White
        Write-Host "  [7] Refresh Status Only" -ForegroundColor White
        Write-Host "  [Q] Exit" -ForegroundColor Gray
        
        $choice = Read-Host "`nEnter selection (1-7 or Q)"
        switch ($choice.Trim().ToUpper()) {
            "1" { Run-AllPipeline; break }
            "2" { Run-SeedCore }
            "3" { Run-AddCCTV }
            "4" { Run-Seed25 }
            "5" { Run-Generate }
            "6" { Run-SeedIndia }
            "7" { Clear-Host }
            "Q" { exit 0 }
            default { Write-Host "Invalid choice, try again." -ForegroundColor Red }
        }
        Write-Host "`nPress Enter to return to menu..." -ForegroundColor Gray
        Read-Host
        Clear-Host
    }
}
