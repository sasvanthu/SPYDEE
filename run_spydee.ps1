# SPYDEE Services Launcher
# Launches all 5 required services in visible, dedicated PowerShell terminal windows.

$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Starting SPYDEE Services in 5 Terminals " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. PostgreSQL Database Server
Write-Host "[1/5] Launching PostgreSQL 16..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'SPYDEE [1/5] - PostgreSQL Server'; Write-Host '=== PostgreSQL Server (Port 5432) ===' -ForegroundColor Cyan; & 'C:\Users\SRISAYEE\pgsql\pgsql\bin\postgres.exe' -D 'C:\Users\SRISAYEE\pgsql\data'"

# Short delay to allow PostgreSQL socket to initialize
Start-Sleep -Seconds 3

# 2. FastAPI Backend Server
Write-Host "[2/5] Launching FastAPI Backend (Port 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'SPYDEE [2/5] - FastAPI Backend'; Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; Set-Location '$root\services\api'; . '$root\services\worker\venv\Scripts\Activate.ps1'; Write-Host '=== FastAPI Backend (http://localhost:8000) ===' -ForegroundColor Cyan; uvicorn app.main:app --reload --port 8000"

# 3. Pipeline & Analysis Worker
Write-Host "[3/5] Launching Background Worker..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'SPYDEE [3/5] - Background Worker'; Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; Set-Location '$root\services\worker'; . '$root\services\worker\venv\Scripts\Activate.ps1'; Write-Host '=== Pipeline & Analysis Worker ===' -ForegroundColor Cyan; python -m app.main"

# 4. Vite React Web App
Write-Host "[4/5] Launching Web Frontend (Port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'SPYDEE [4/5] - Web Frontend'; Set-Location '$root\apps\web'; Write-Host '=== Web UI (http://localhost:5173) ===' -ForegroundColor Cyan; npm run dev"

# 5. Interactive Workspace Terminal (VENV active)
Write-Host "[5/5] Launching Interactive Terminal (VENV Active)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'SPYDEE [5/5] - Interactive Terminal (VENV Active)'; Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; Set-Location '$root'; . '$root\services\worker\venv\Scripts\Activate.ps1'; Write-Host '=== SPYDEE Interactive Terminal ===' -ForegroundColor Green; Write-Host 'Virtual environment activated. You can run pytest or debug commands here.' -ForegroundColor Yellow"

Write-Host "=========================================" -ForegroundColor Green
Write-Host " All 5 services have been launched!     " -ForegroundColor Green
Write-Host " Web UI:    http://localhost:5173        " -ForegroundColor Green
Write-Host " API Docs:  http://localhost:8000/api/docs" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
