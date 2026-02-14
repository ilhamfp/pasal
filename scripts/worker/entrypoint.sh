#!/bin/sh
# Worker entrypoint — configurable via environment variables.
# Job claiming is atomic (FOR UPDATE SKIP LOCKED) — workers never duplicate work.
#
# Recommended Railway setup (20 workers, region: Southeast Asia):
#   Worker 1:    WORKER_DISCOVER=true  WORKER_DISCOVERY_FIRST=true  (discovers ALL types, then processes)
#   Worker 2-20: WORKER_DISCOVER=false                               (process-only, no duplicate listing crawls)
#
# All 12 central government regulation types are discovered by default:
#   uu, pp, perpres, perppu, keppres, inpres, penpres, uudrt, tapmpr, permen, perban, perda

DISCOVER_FLAG="--discover"
if [ "$WORKER_DISCOVER" = "false" ]; then
    DISCOVER_FLAG="--no-discover"
fi

DISCOVERY_FIRST_FLAG=""
if [ "$WORKER_DISCOVERY_FIRST" = "true" ]; then
    DISCOVERY_FIRST_FLAG="--discovery-first"
fi

exec python -m worker.run continuous \
    --types "${WORKER_TYPES:-uu,pp,perpres,perppu,keppres,inpres,penpres,uudrt,tapmpr,permen,perban,perda}" \
    --batch-size "${WORKER_BATCH_SIZE:-100}" \
    --sleep "${WORKER_SLEEP:-3}" \
    --discover-interval "${WORKER_DISCOVER_INTERVAL:-5}" \
    --freshness-hours "${WORKER_FRESHNESS_HOURS:-24}" \
    $DISCOVER_FLAG \
    $DISCOVERY_FIRST_FLAG
