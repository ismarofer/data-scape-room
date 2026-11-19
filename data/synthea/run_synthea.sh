#!/bin/bash
# Pinned: Synthea master-branch-latest build bd8a52b (2026-10-21), jar sha256 prefix 20098ec70c24c715. Java 17+.
# Usage: run_synthea.sh <jobs> <pop_per_job>
cd "$(dirname "$0")"
JOBS=${1:-4}; POP=${2:-7500}; SEED=${SEED:-20261117}
for k in $(seq 1 $JOBS); do
  java -Xmx2g -jar synthea.jar -s $((SEED+k)) -cs $((SEED+k)) -p $POP -r 20231231 -e 20231231 \
    --exporter.csv.export=true --exporter.fhir.export=false --exporter.ccda.export=false \
    --exporter.baseDirectory=./out_$k Massachusetts > log_$k.txt 2>&1 &
done
wait
