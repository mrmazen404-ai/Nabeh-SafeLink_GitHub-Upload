@echo off
title Nabeh SafeLink - Backend API (8000)
"%~dp0.venv\Scripts\python.exe" -m uvicorn main:app --reload --port 8000
pause
