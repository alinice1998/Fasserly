import os
import sys
import urllib.request
import uvicorn
from pathlib import Path
from starlette.middleware.cors import CORSMiddleware

default_db = Path(__file__).parent.resolve() / "quran.db"
db_path = Path(os.environ.get("TAFSIR_DB_PATH", default_db))
DB_URL = "https://github.com/alinice1998/Fasserly/releases/download/v1.0.0/quran.db"

if not db_path.exists():
    db_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"\n[INFO] Database not found locally.")
    print(f"Downloading from: {DB_URL}")
    print("This may take a few minutes depending on your internet connection...\n")
    
    def report_progress(block_num, block_size, total_size):
        downloaded = block_num * block_size
        if total_size > 0:
            percent = min(100.0, downloaded * 100 / total_size)
            sys.stdout.write(f"\rDownloading: {percent:.1f}% ({downloaded / (1024*1024):.1f} MB / {total_size / (1024*1024):.1f} MB)")
            sys.stdout.flush()
            
    try:
        urllib.request.urlretrieve(DB_URL, str(db_path), reporthook=report_progress)
        print("\n\n[SUCCESS] Download completed successfully!")
    except Exception as e:
        print(f"\n\n[ERROR] Failed to download the database: {e}")
        print("Please check your internet connection or download it manually.")
        sys.exit(1)

os.environ["TAFSIR_DB_PATH"] = str(db_path)
from tafsir.server import mcp

if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    print(f"\nStarting Tafsir MCP on http://{host}:{port}/sse with CORS")
    mcp.settings.transport_security = None
    app = mcp.sse_app()
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
    uvicorn.run(app, host=host, port=port)
