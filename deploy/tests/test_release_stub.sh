#!/usr/bin/env bash
# ==============================================================================
# Offline test for deploy/release.sh (fake `gcloud`, no GCP access, no cost)
# ==============================================================================
# WHAT THIS TEST CHECKS
#   1. normal release : image resolved to @sha256 digest, migration awaited
#                       (`--wait`), service updated, SERVICE_URL exported
#   2. rollback       : service updated, migration job NOT touched
#   3. image missing / migration fails : service is NOT updated
#   4. invalid tag    : rejected before any gcloud call
#   5. APP_COMMIT     : the service gets APP_COMMIT=<image tag> (shown by /api/version)
#   6. `latest`       : accepted only for a rollback (the Release 1 image has no SHA tag)
# HOW TO RUN (repo root, needs bash):  bash deploy/tests/test_release_stub.sh
#   Prints `PASS ...` lines; any failure exits non-zero. CI runs it too.
# SlotBook names (RULES 5): image path slotbook/slotbook, job slotbook-migrate,
#    service slotbook.
# ==============================================================================
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TASK_TMP="$(mktemp -d)"
trap 'rm -rf "$TASK_TMP"' EXIT
export PROJECT_ID=release-test REGION=asia-southeast1
export IMAGE_TAG=1111111111111111111111111111111111111111
export CALL_LOG="$TASK_TMP/calls" GITHUB_ENV="$TASK_TMP/env"
export PATH="$TASK_TMP:$PATH"
cat > "$TASK_TMP/gcloud" <<'STUB'
#!/usr/bin/env bash
echo "$*" >> "$CALL_LOG"
case "$*" in
  'artifacts docker images describe '*)
    [[ "${FAIL_AT:-}" != image ]] || exit 1
    echo 'asia-southeast1-docker.pkg.dev/release-test/slotbook/slotbook@sha256:abcdef' ;;
  'run jobs execute '*) [[ "${FAIL_AT:-}" != migration ]] || exit 1 ;;
  'run services describe '*) echo 'https://demo.example.test' ;;
esac
STUB
chmod +x "$TASK_TMP/gcloud"
export ROLLBACK=false
bash "$ROOT/deploy/release.sh"
grep -q 'run jobs update slotbook-migrate --image=asia-southeast1-docker.pkg.dev/release-test/slotbook/slotbook@sha256:abcdef' "$CALL_LOG"
grep -q 'run jobs execute slotbook-migrate .*--wait' "$CALL_LOG"
grep -q 'run services update slotbook .*@sha256:abcdef' "$CALL_LOG"
grep -q "run services update slotbook .*--update-env-vars=APP_COMMIT=$IMAGE_TAG" "$CALL_LOG"
if grep -q 'run jobs update .*APP_COMMIT' "$CALL_LOG"; then echo 'Migration job got APP_COMMIT' >&2; exit 1; fi
grep -q 'SERVICE_URL=https://demo.example.test' "$GITHUB_ENV"
echo 'PASS normal release uses digest, waits for migration and sets APP_COMMIT'

: > "$CALL_LOG"
export ROLLBACK=true
bash "$ROOT/deploy/release.sh"
if grep -q 'run jobs' "$CALL_LOG"; then echo 'Rollback ran migration' >&2; exit 1; fi
grep -q 'run services update ' "$CALL_LOG"
echo 'PASS rollback reuses image without touching migration job'

for failure in image migration; do
  : > "$CALL_LOG"
  if ROLLBACK=false FAIL_AT="$failure" bash "$ROOT/deploy/release.sh"; then
    echo "Expected $failure failure" >&2; exit 1
  fi
  if grep -q 'run services update' "$CALL_LOG"; then
    echo "Service changed after $failure failure" >&2; exit 1
  fi
  echo "PASS $failure failure blocks service update"
done

: > "$CALL_LOG"
if IMAGE_TAG='invalid;tag' bash "$ROOT/deploy/release.sh"; then exit 1; fi
test ! -s "$CALL_LOG"
echo 'PASS invalid tag rejected before GCP calls'

: > "$CALL_LOG"
IMAGE_TAG=latest ROLLBACK=true bash "$ROOT/deploy/release.sh"
grep -q 'artifacts docker images describe asia-southeast1-docker.pkg.dev/release-test/slotbook/slotbook:latest ' "$CALL_LOG"
grep -q 'run services update slotbook .*@sha256:abcdef.*--update-env-vars=APP_COMMIT=latest' "$CALL_LOG"
if grep -q 'run jobs' "$CALL_LOG"; then echo 'latest rollback ran migration' >&2; exit 1; fi
echo 'PASS rollback to latest is resolved by digest without migration'

: > "$CALL_LOG"
if IMAGE_TAG=latest ROLLBACK=false bash "$ROOT/deploy/release.sh"; then exit 1; fi
test ! -s "$CALL_LOG"
echo 'PASS latest rejected for a normal release before GCP calls'
