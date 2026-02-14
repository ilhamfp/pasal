#!/bin/sh
# Worker entrypoint — configurable via environment variables.
# Job claiming is atomic (FOR UPDATE SKIP LOCKED) — workers never duplicate work.
#
# Recommended Railway setup (5 workers):
#   Worker 1: WORKER_DISCOVER=true   (discovers new regulations + processes)
#   Worker 2-5: WORKER_DISCOVER=false (process-only, no duplicate listing crawls)

DISCOVER_FLAG="--discover"
if [ "$WORKER_DISCOVER" = "false" ]; then
    DISCOVER_FLAG="--no-discover"
fi

exec python -m worker.run continuous \
    --types "${WORKER_TYPES:-uu,pp,perpres,perppu}" \
    --batch-size "${WORKER_BATCH_SIZE:-100}" \
    --sleep "${WORKER_SLEEP:-3}" \
    --discover-interval "${WORKER_DISCOVER_INTERVAL:-5}" \
    $DISCOVER_FLAG
