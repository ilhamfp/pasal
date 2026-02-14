FROM python:3.12-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY scripts/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY scripts/ ./scripts/

# Set PYTHONPATH so imports (crawler.db, loader.load_to_supabase, etc.) resolve
ENV PYTHONPATH=/app/scripts

# Create data dir for temporary PDF downloads
RUN mkdir -p /app/data/raw/pdfs

# Default: full run with UU and PP, 50 jobs per batch, 25 min max
CMD ["python", "-m", "worker.run", "full", "--types", "uu,pp", "--batch-size", "50", "--max-runtime", "1500"]
