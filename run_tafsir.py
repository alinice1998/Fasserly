import os 
import uvicorn
from pathlib import Path 
from starlette.middleware.cors import CORSMiddleware
db_path = Path(__file__).parent.resolve() / "quran.db" 
os.environ["TAFSIR_DB_PATH"] = str(db_path) 
from tafsir.server import mcp 
if __name__ == "__main__": 
    print("Starting Tafsir MCP on http://localhost:8000/sse with CORS") 
    mcp.settings.transport_security = None
    app = mcp.sse_app()
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
    uvicorn.run(app, host="127.0.0.1", port=8000)
