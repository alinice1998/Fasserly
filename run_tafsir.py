from tafsir.server import mcp 
if __name__ == "__main__": 
    print("Starting Tafsir MCP on http://localhost:8000/sse") 
    mcp.settings.host = "127.0.0.1" 
    mcp.settings.port = 8000 
    mcp.run(transport="sse") 
