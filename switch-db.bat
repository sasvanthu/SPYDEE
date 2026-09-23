@echo off
title SPYDEE Database Switcher and Data Generator
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch-db.ps1" %*
if "%~1"=="" pause
