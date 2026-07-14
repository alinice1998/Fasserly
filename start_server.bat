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

echo [2/3] Creating server script...
echo import os ^> run_tafsir.py
echo import uvicorn ^>^> run_tafsir.py
echo from pathlib import Path ^>^> run_tafsir.py
echo from starlette.middleware.cors import CORSMiddleware ^>^> run_tafsir.py
echo db_path = Path(__file__).parent.resolve() / "quran.db" ^>^> run_tafsir.py
echo os.environ["TAFSIR_DB_PATH"] = str(db_path) ^>^> run_tafsir.py
echo from tafsir.server import mcp ^>^> run_tafsir.py
echo if __name__ == "__main__": ^>^> run_tafsir.py
echo     print("Starting Tafsir MCP on http://localhost:8000/sse with CORS") ^>^> run_tafsir.py
echo     mcp.settings.transport_security = None ^>^> run_tafsir.py
echo     app = mcp.sse_app() ^>^> run_tafsir.py
echo     app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"]) ^>^> run_tafsir.py
echo     uvicorn.run(app, host="127.0.0.1", port=8000) ^>^> run_tafsir.py

echo [3/3] Starting the server! (Keep this window open)
echo Note: Database is loaded locally from the project directory: %~dp0quran.db
set TAFSIR_DB_PATH=%~dp0quran.db
py run_tafsir.py
pause

