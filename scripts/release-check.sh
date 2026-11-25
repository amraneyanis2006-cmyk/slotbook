#!/usr/bin/env bash
# MAN-03 (F-18, AC-87): 0 skipped/focused tests and every AC of docs/traceability.md §6 has a test ID found in its files.
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/release-check.mjs
