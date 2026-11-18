@echo off
TITLE SVC Smart Move — Central On-Premise Server
COLOR 0A

echo ======================================================================
echo           SRI VENKATESWARA COMPANY — SMART MOVE MANUFACTURING
echo                  Phase 1: RM Inward and RM Issue
echo ======================================================================
echo.

cd /d "%~dp0"

:: 1. Check for Python 3 (Canonical Production Server)
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Python 3 detected. Launching canonical Python 3 SQLite production server...
    python server\server.py
    goto end
)

:: 2. Fallback to Node.js
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Node.js detected. Launching alternative Node.js server...
    node server\server.js
    goto end
)

echo [ERROR] Neither Node.js nor Python 3 was found on this system.
echo Please install either Node.js (v16+) or Python 3 (3.8+) on Windows Server 2012.
echo.
pause

:end

