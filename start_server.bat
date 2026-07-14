@echo off
cd /d "%~dp0"
echo ===================================================
echo   Tafsir MCP Local Server Setup
echo ===================================================

py --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please download and install Python from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b
)

echo [1/3] Installing Tafsir MCP and dependencies...
py -m pip install tafsir-mcp uvicorn >nul

echo [2/3] Checking server script...
if not exist run_tafsir.py (
    echo [ERROR] run_tafsir.py is missing! Please make sure you downloaded the full project.
    pause
    exit /b
)

echo [3/3] Starting the server! (Keep this window open)
echo Note: Database is loaded locally from the project directory: %~dp0quran.db
set TAFSIR_DB_PATH=%~dp0quran.db
py run_tafsir.py
pause

