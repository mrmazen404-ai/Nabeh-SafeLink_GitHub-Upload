@echo off
title Nabeh SafeLink - Delete Admin Tool
echo ===================================================
echo Nabeh SafeLink - Delete Admin Tool
echo ===================================================
"%~dp0.venv\Scripts\python.exe" "%~dp0delete_admin_user.py" %*
pause
