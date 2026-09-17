@echo off
title SPYDEE Services Launcher
echo ===================================================
echo  Starting SPYDEE Services (PowerShell Launcher)
echo ===================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_spydee.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo An error occurred while launching. Press any key to exit.
    pause >nul
)
