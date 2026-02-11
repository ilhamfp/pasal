import os
from dotenv import load_dotenv
from fastmcp import FastMCP

load_dotenv()

mcp = FastMCP("Pasal.id")


@mcp.tool
def ping() -> str:
    """Health check."""
    return "Pasal.id MCP server is running"


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    mcp.run(transport="streamable-http", host="0.0.0.0", port=port)
