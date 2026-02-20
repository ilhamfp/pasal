FROM python:3.12.8-slim

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

# Create non-root user
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# Create data dir for temporary PDF downloads (owned by appuser)
RUN mkdir -p /app/data/raw/pdfs && chown -R appuser:appgroup /app/data

# Configurable via Railway env vars per service:
#   WORKER_BATCH_SIZE=100         (jobs per batch)
#   WORKER_SLEEP=3                (seconds between batches)
#   WORKER_DISCOVER=true|false    (set false for process-only workers)
#   WORKER_DISCOVER_INTERVAL=5    (discover every N batches)
#   WORKER_TYPES=uu,pp,...        (default: all 12 central gov types)
#   WORKER_DISCOVERY_FIRST=true   (first iteration: full discovery, skip processing)
#   WORKER_FRESHNESS_HOURS=24     (skip types discovered within N hours)
#
# Deploy in Southeast Asia region for lowest latency to peraturan.go.id.
# Recommended: 20 workers
#   Worker 1:    WORKER_DISCOVER=true  WORKER_DISCOVERY_FIRST=true
#   Worker 2-20: WORKER_DISCOVER=false
#
# Job claiming is atomic (FOR UPDATE SKIP LOCKED) — workers never duplicate work.
COPY scripts/worker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
USER appuser
CMD ["/app/entrypoint.sh"]
