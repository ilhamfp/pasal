FROM python:3.12-slim

WORKDIR /app

# Install system deps (git for potential future OTF corpus clone)
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY scripts/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY scripts/ ./scripts/
COPY packages/ ./packages/

# Default: full run with UU and PP, 20 jobs per batch
CMD ["python", "-m", "scripts.worker.run", "full", "--types", "uu,pp", "--batch-size", "20", "--max-runtime", "1500"]
