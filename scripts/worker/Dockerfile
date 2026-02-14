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
# Disable output buffering for real-time logs on Railway
ENV PYTHONUNBUFFERED=1

# Create data dir for temporary PDF downloads
RUN mkdir -p /app/data/raw/pdfs

# Run as continuous long-running service: 100 jobs per batch, discover every 5 batches
CMD ["python", "-m", "worker.run", "continuous", "--types", "uu,pp,perpres", "--batch-size", "100", "--sleep", "10", "--discover-interval", "5"]
