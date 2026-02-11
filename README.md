# Pasal.id

**Democratizing Indonesian Law — The First Open, AI-Native Legal Platform**

Give Claude grounded access to Indonesian legislation through MCP. No hallucinations, real citations.

## Quick Start

```bash
claude mcp add pasal-id --transport http --url https://mcp.pasal.id/mcp/
```

## Tech Stack

- **Frontend:** Next.js 14+ (App Router), Tailwind CSS, Vercel
- **Database:** Supabase (PostgreSQL full-text search with Indonesian stemmer)
- **MCP Server:** Python + FastMCP (Streamable HTTP)
- **Data Pipeline:** Python (httpx, BeautifulSoup, pdfplumber)

## License

MIT
