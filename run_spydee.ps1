# SPYDEE Services Launcher
# Launches all 5 required services in visible, dedicated PowerShell terminal windows.

$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Starting SPYDEE Services in 5 Terminals " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Database Connection Check
$isRemoteDb = $false
if (Test-Path "$root\.env") {
    $dbLine = Get-Content "$root\.env" | Where-Object { $_ -match "^DATABASE_URL=" } | Select-Object -First 1
    if ($dbLine -and ($dbLine -notmatch "localhost") -and ($dbLine -notmatch "127\.0\.0\.1")) {
        $isRemoteDb = $true
    }
}

if ($isRemoteDb) {
    Write-Host "[1/5] Using Cloud Database (Supabase) - Local PostgreSQL not required." -ForegroundColor Green
} else {
    $pgReady = $false
    try {
        $tcp = Test-NetConnection -Port 5432 -ComputerName localhost -WarningAction SilentlyContinue
        if ($tcp.TcpTestSucceeded) {
            $pgReady = $true
        }
    } catch {}

    if ($pgReady) {
        Write-Host "[1/5] PostgreSQL is already active on port 5432." -ForegroundColor Green
    } else {
        Write-Host "[1/5] Starting PostgreSQL..." -ForegroundColor Yellow
        $svc = Get-Service -Name "*postgres*" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($svc) {
            Start-Service $svc.Name
            Write-Host "Started PostgreSQL service: $($svc.DisplayName)" -ForegroundColor Green
        } else {
            $pgBin = $null
            foreach ($p in @("C:\Program Files\PostgreSQL\18\bin\postgres.exe", "C:\Program Files\PostgreSQL\17\bin\postgres.exe", "C:\Program Files\PostgreSQL\16\bin\postgres.exe")) {
                if (Test-Path $p) { $pgBin = $p; break }
            }
            if ($pgBin) {
                Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'SPYDEE [1/5] - PostgreSQL Server'; Write-Host '=== PostgreSQL Server (Port 5432) ===' -ForegroundColor Cyan; & '$pgBin'"
            } else {
                Write-Host "Warning: PostgreSQL binary or service not found automatically." -ForegroundColor Red
            }
        }
    }
}

# Short delay to allow services to initialize
Start-Sleep -Seconds 2

# 2. FastAPI Backend Server
Write-Host "[2/5] Launching FastAPI Backend (Port 8000)..." -ForegroundColor Yellow
$apiCmd = "`$host.UI.RawUI.WindowTitle = 'SPYDEE [2/5] - FastAPI Backend'; if (Test-Path '$root\services\worker\venv\Scripts\Activate.ps1') { . '$root\services\worker\venv\Scripts\Activate.ps1' }; Write-Host '=== FastAPI Backend (http://localhost:8000) ===' -ForegroundColor Cyan; python -m uvicorn app.main:app --reload --port 8000"
Start-Process powershell.exe -WorkingDirectory "$root\services\api" -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $apiCmd

# 3. Pipeline & Analysis Worker
Write-Host "[3/5] Launching Background Worker..." -ForegroundColor Yellow
$workerCmd = "`$host.UI.RawUI.WindowTitle = 'SPYDEE [3/5] - Background Worker'; if (Test-Path '$root\services\worker\venv\Scripts\Activate.ps1') { . '$root\services\worker\venv\Scripts\Activate.ps1' }; Write-Host '=== Pipeline & Analysis Worker ===' -ForegroundColor Cyan; python -m app.main"
Start-Process powershell.exe -WorkingDirectory "$root\services\worker" -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $workerCmd

# 4. Vite React Web App
Write-Host "[4/5] Launching Web Frontend (Port 5173)..." -ForegroundColor Yellow
$webCmd = "`$host.UI.RawUI.WindowTitle = 'SPYDEE [4/5] - Web Frontend'; Write-Host '=== Web UI (http://localhost:5173) ===' -ForegroundColor Cyan; npm run dev -- --host"
Start-Process powershell.exe -WorkingDirectory "$root\apps\web" -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $webCmd

# 5. Interactive Workspace Terminal
Write-Host "[5/5] Launching Interactive Terminal..." -ForegroundColor Yellow
$termCmd = "`$host.UI.RawUI.WindowTitle = 'SPYDEE [5/5] - Interactive Terminal'; if (Test-Path '$root\services\worker\venv\Scripts\Activate.ps1') { . '$root\services\worker\venv\Scripts\Activate.ps1' }; Write-Host '=== SPYDEE Interactive Terminal ===' -ForegroundColor Green; Write-Host 'Ready for testing or debug commands.' -ForegroundColor Yellow"
Start-Process powershell.exe -WorkingDirectory "$root" -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $termCmd

Write-Host "=========================================" -ForegroundColor Green
Write-Host " All services have been launched!       " -ForegroundColor Green
Write-Host " Web UI:        http://localhost:5173    " -ForegroundColor Green
Write-Host " Datasets Hub:  http://localhost:5173/datasets" -ForegroundColor Cyan
Write-Host " API Docs:      http://localhost:8000/api/docs" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
