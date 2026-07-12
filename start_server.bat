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
echo from tafsir.server import mcp > run_tafsir.py
echo if __name__ == "__main__": >> run_tafsir.py
echo     print("Starting Tafsir MCP on http://localhost:8000/sse") >> run_tafsir.py
echo     mcp.settings.host = "127.0.0.1" >> run_tafsir.py
echo     mcp.settings.port = 8000 >> run_tafsir.py
echo     mcp.run(transport="sse") >> run_tafsir.py

echo [3/3] Starting the server! (Keep this window open)
echo Note: The Quran database (~214MB) is only downloaded ONCE on the very first run.
echo It will be saved securely and loaded instantly in the future.
py run_tafsir.py
pause
