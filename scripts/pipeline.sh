#!/usr/bin/env bash
# Full pipeline: scrape → rank → enrich
# Usage: ./scripts/pipeline.sh

set -e
cd "$(dirname "$0")/.."

echo "=== Tech Intelligence Digest Pipeline ==="
echo ""

echo "--- Stage 1: Scrape ---"
node src/scraper.js
echo ""

echo "--- Stage 2: Rank ---"
node src/ranker.js --latest
echo ""

echo "--- Stage 3: Enrich ---"
node src/summarizer.js --latest
echo ""

echo "=== Pipeline Complete ==="
