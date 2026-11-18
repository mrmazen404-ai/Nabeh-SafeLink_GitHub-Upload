@echo off
title Nabeh SafeLink - Master Launcher
echo ===================================================
echo Nabeh SafeLink - Starting All Services...
echo ===================================================

echo [1/3] Starting Backend API (Port 8000)...
start "Nabeh - Backend API (8000)" /min cmd /k ""%~dp0.venv\Scripts\python.exe" -m uvicorn main:app --reload --port 8000"

echo [2/3] Starting Main User Frontend (Port 5173)...
start "Nabeh - Main Frontend (5173)" /min cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo [3/3] Starting Admin Control Panel (Port 5174)...
start "Nabeh - Admin Frontend (5174)" /min cmd /k "cd /d "%~dp0admin_frontend" && npm run dev"

echo ===================================================
echo Waiting for services to initialize...
timeout /t 4 /nobreak > nul

echo Opening browser windows...
start http://localhost:5173
start http://localhost:5174

echo ===================================================
echo All services launched successfully!
echo Main Frontend:  http://localhost:5173
echo Admin Frontend: http://localhost:5174
echo Backend API:    http://localhost:8000
echo ===================================================
pause
