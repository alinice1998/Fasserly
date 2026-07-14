import os 
from pathlib import Path 
db_path = Path(__file__).parent.resolve() / "quran.db" 
os.environ["TAFSIR_DB_PATH"] = str(db_path) 
from tafsir.server import mcp 
if __name__ == "__main__": 
    print("Starting Tafsir MCP on http://localhost:8000/sse") 
    mcp.settings.host = "127.0.0.1" 
    mcp.settings.port = 8000 
    mcp.run(transport="sse") 
