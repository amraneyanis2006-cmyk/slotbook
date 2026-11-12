#!/usr/bin/env bash
# Offline regression checks: every gcloud and openssl call is a local stub.
# ==============================================================================
# WHAT THIS TEST DOES (no real GCP calls, no cost)
#   Puts fake `gcloud` / `openssl` first on PATH and runs deploy/deploy.sh in
#   these scenarios, asserting on the recorded commands:
#     first_run : nothing exists      -> everything is created
#     rerun     : everything exists   -> nothing replaced (credentials kept)
#     partial   : DB secret missing   -> DB user password reset + secret created
#     job-fail  : migration fails     -> script exits 1, service NOT deployed
#     demo      : --demo flag         -> migration job seeds with SEED_DEMO_DATA=true
#   It also checks: Cloud SQL POSTGRES_16 / db-f1-micro / `--edition=enterprise` /
#   storage auto-increase off, no project-wide secretAccessor role, DB password ==
#   password inside DATABASE_URL, a 48-character session secret, the service gets
#   DATABASE_URL + SESSION_SECRET only (never SEED_PASSWORD), the migration job gets
#   DATABASE_URL + SEED_PASSWORD and runs migrate deploy + db:seed, port 3000,
#   min 0 / max 2 instances, and that no secret value leaks into the output.
#   Finally DRY_RUN=1 must make zero gcloud calls.
#
# HOW TO RUN (repo root, needs bash):  bash deploy/tests/test_deploy_stub.sh
#   Prints `PASS: <scenario>` per scenario; any `FAIL ...` exits non-zero.
#   CI runs it too (.github/workflows/ci-docker.yml).
#
# SlotBook names (RULES 5): secrets slotbook-database-url, slotbook-session-secret,
# slotbook-seed-password; DB user slotbook; service slotbook; job slotbook-migrate.
# ==============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="${SCRIPT_DIR}/../deploy.sh"
export TEST_STATE_DIR
TEST_STATE_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_STATE_DIR"' EXIT
mkdir -p "$TEST_STATE_DIR/bin"

# --- Fake `openssl` (deterministic "random" values) ---------------------------
cat > "$TEST_STATE_DIR/bin/openssl" <<'STUB'
#!/usr/bin/env bash
# `rand -hex N` returns 2N hex characters, like the real openssl.
if [ "$2" = "-hex" ]; then
  printf '%s\n' "$(printf '0123456789abcdef%.0s' $(seq 1 8) | cut -c1-$(( $3 * 2 )))"
else
  printf '%s\n' 'TESTONLYGENERATEDPASSWORD'
fi
STUB

# --- Fake `gcloud`: logs each call (password redacted), answers per $STUB_MODE
cat > "$TEST_STATE_DIR/bin/gcloud" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
redacted=()
for arg in "$@"; do
  case "$arg" in
    --password=*)
      printf '%s' "${arg#--password=}" > "$TEST_STATE_DIR/sql-pass"
      redacted+=("--password=<REDACTED>") ;;
    *) redacted+=("$arg") ;;
  esac
done
printf '%s\n' "${redacted[*]}" >> "$GCLOUD_LOG"
if [ "${1:-} ${2:-}" = 'config get-value' ]; then
  echo stub-gcp-project
  exit 0
fi
if [ "${1:-} ${2:-} ${3:-}" = 'run services describe' ]; then
  echo https://slotbook-stub.example.invalid
  exit 0
fi
if [ "${1:-} ${2:-} ${3:-}" = 'run jobs execute' ]; then
  [ "$STUB_MODE" != job-fail ]
  exit $?
fi
if [ "${1:-} ${2:-} ${3:-}" = 'secrets versions add' ]; then
  cat > "$TEST_STATE_DIR/payload-${4}"
  exit 0
fi
if [ "${1:-} ${2:-} ${3:-}" = 'sql users list' ]; then
  if [ "$STUB_MODE" = first_run ]; then
    echo postgres
  else
    printf 'postgres\nslotbook\n'
  fi
  exit 0
fi
for word in "$@"; do
  if [ "$word" = describe ]; then
    case "$STUB_MODE" in
      first_run) exit 1 ;;
      partial)
        if [ "${1:-} ${3:-}" = 'secrets slotbook-database-url' ]; then
          exit 1
        fi ;;
    esac
  fi
done
STUB
chmod +x "$TEST_STATE_DIR/bin/openssl" "$TEST_STATE_DIR/bin/gcloud"
export PATH="$TEST_STATE_DIR/bin:$PATH"
export PROJECT_ID=stub-gcp-project
export REGION=asia-southeast1
export DRY_RUN=0

# --- Run every scenario and assert on what deploy.sh did ------------------------
for MODE in first_run rerun partial job-fail demo; do
  export STUB_MODE="$MODE"
  [ "$MODE" != demo ] || export STUB_MODE=first_run
  export GCLOUD_LOG="$TEST_STATE_DIR/gcloud-$MODE.log"
  rm -f "$TEST_STATE_DIR/sql-pass" "$TEST_STATE_DIR"/payload-*
  args=()
  if [ "$MODE" = demo ]; then args+=(--demo); fi
  result=0
  bash "$DEPLOY_SCRIPT" ${args[@]+"${args[@]}"} > "$TEST_STATE_DIR/output" 2>&1 || result=$?
  expected=0
  if [ "$MODE" = job-fail ]; then expected=1; fi
  if [ "$result" -ne "$expected" ]; then
    echo "FAIL $MODE: unexpected exit $result (wanted $expected)"
    exit 1
  fi
  if [ "$MODE" = job-fail ]; then
    if grep -q '^run deploy ' "$GCLOUD_LOG"; then
      echo 'FAIL: service deployed after migration failure'; exit 1
    fi
  else
    grep -q '^run deploy ' "$GCLOUD_LOG"
  fi
  if grep -q '^projects add-iam-policy-binding .*roles/secretmanager.secretAccessor' "$GCLOUD_LOG"; then
    echo 'FAIL: runtime has project-wide secret access'; exit 1
  fi
  for secret in slotbook-database-url slotbook-session-secret slotbook-seed-password; do
    grep -q "^secrets add-iam-policy-binding $secret .*serviceAccount:slotbook-runner@.*roles/secretmanager.secretAccessor" "$GCLOUD_LOG"
  done
  # Migration job: migrate + seed from the same image, DATABASE_URL + SEED_PASSWORD, seed only with --demo.
  job="$(grep '^run jobs deploy slotbook-migrate ' "$GCLOUD_LOG")"
  case "$job" in *'--args -c,npx prisma migrate deploy && npm run db:seed'*) ;; *) echo 'FAIL: job command'; exit 1 ;; esac
  case "$job" in *'DATABASE_URL=slotbook-database-url:latest'*'SEED_PASSWORD=slotbook-seed-password:latest'*) ;; *) echo 'FAIL: job secrets'; exit 1 ;; esac
  want_seed=false; [ "$MODE" != demo ] || want_seed=true
  case "$job" in *"SEED_DEMO_DATA=${want_seed}"*) ;; *) echo "FAIL: job SEED_DEMO_DATA is not ${want_seed}"; exit 1 ;; esac
  grep -q '^run jobs execute slotbook-migrate .*--wait' "$GCLOUD_LOG" || { echo 'FAIL: migration job not awaited'; exit 1; }
  # Service: DATABASE_URL + SESSION_SECRET only; port 3000, min 0, max 2.
  if [ "$MODE" != job-fail ]; then
    svc="$(grep '^run deploy slotbook ' "$GCLOUD_LOG")"
    case "$svc" in *'--set-secrets DATABASE_URL=slotbook-database-url:latest,SESSION_SECRET=slotbook-session-secret:latest '*) ;; *) echo 'FAIL: service secrets'; exit 1 ;; esac
    case "$svc" in *SEED_PASSWORD*) echo 'FAIL: service can read the seed password'; exit 1 ;; esac
    case "$svc" in *'--min-instances 0 --max-instances 2 '*'--port 3000 '*) ;; *) echo 'FAIL: service scaling/port'; exit 1 ;; esac
  fi
  case "$MODE" in
    first_run)
      grep -q -- '^sql instances create slotbook-pg --database-version=POSTGRES_16 --edition=enterprise --tier=db-f1-micro .*--no-storage-auto-increase' "$GCLOUD_LOG"
      grep -q '^artifacts repositories create slotbook ' "$GCLOUD_LOG"
      grep -q '^sql users create slotbook ' "$GCLOUD_LOG"
      [ "$(wc -c < "$TEST_STATE_DIR/payload-slotbook-session-secret" | tr -d ' ')" -eq 48 ] || { echo 'FAIL: session secret is not 48 characters'; exit 1; }
      [ -s "$TEST_STATE_DIR/payload-slotbook-seed-password" ] || { echo 'FAIL: seed password not created'; exit 1; } ;;
    partial) grep -q '^sql users set-password ' "$GCLOUD_LOG" ;;
    rerun)
      if grep -Eq '^(secrets create|secrets versions add|sql users (create|set-password)) ' "$GCLOUD_LOG"; then
        echo 'FAIL: rerun replaced existing credentials'; exit 1
      fi ;;
  esac
  if [ -f "$TEST_STATE_DIR/sql-pass" ]; then
    db_pass="$(cat "$TEST_STATE_DIR/sql-pass")"
    db_url="$(cat "$TEST_STATE_DIR/payload-slotbook-database-url")"
    case "$db_url" in
      "postgresql://slotbook:${db_pass}@localhost/slotbook?host=/cloudsql/stub-gcp-project:asia-southeast1:slotbook-pg"*) ;;
      *) echo 'FAIL: DB password differs from secret'; exit 1 ;;
    esac
    if grep -Fq "$db_pass" "$TEST_STATE_DIR/output"; then
      echo 'FAIL: DB password leaked to output'; exit 1
    fi
  fi
  for secret_file in "$TEST_STATE_DIR"/payload-*; do
    [ -f "$secret_file" ] || continue
    secret_value="$(cat "$secret_file")"
    if [ -n "$secret_value" ] && grep -Fq "$secret_value" "$TEST_STATE_DIR/output"; then
      echo 'FAIL: secret payload leaked to output'; exit 1
    fi
  done
  echo "PASS: $MODE (exit, migration gate, credential handling, secret redaction)"
done
# --- Dry run must not call gcloud at all ------------------------------------------
export GCLOUD_LOG="$TEST_STATE_DIR/dry-run-calls"
DRY_RUN=1 bash "$DEPLOY_SCRIPT" --demo > "$TEST_STATE_DIR/dry-run-output"
if [ -f "$GCLOUD_LOG" ]; then
  echo 'FAIL: dry run called gcloud'; exit 1
fi
echo 'PASS: dry run makes no gcloud calls'

# --- Teardown dry run: no gcloud call, every SlotBook resource listed, IAM binding removed before the SA ---
export GCLOUD_LOG="$TEST_STATE_DIR/teardown-calls"
DRY_RUN=1 bash "${SCRIPT_DIR}/../teardown.sh" > "$TEST_STATE_DIR/teardown-output"
if [ -f "$GCLOUD_LOG" ]; then echo 'FAIL: teardown dry run called gcloud'; exit 1; fi
for secret in slotbook-database-url slotbook-session-secret slotbook-seed-password; do
  grep -q "secrets delete $secret " "$TEST_STATE_DIR/teardown-output" || { echo "FAIL: teardown keeps $secret"; exit 1; }
done
binding=$(grep -n 'remove-iam-policy-binding .*roles/cloudsql.client' "$TEST_STATE_DIR/teardown-output" | cut -d: -f1 || true)
sa=$(grep -n 'service-accounts delete slotbook-runner@' "$TEST_STATE_DIR/teardown-output" | cut -d: -f1 || true)
if [ -z "$binding" ] || [ -z "$sa" ] || [ "$binding" -gt "$sa" ]; then
  echo 'FAIL: teardown must remove the cloudsql.client binding before deleting the service account'; exit 1
fi
echo 'PASS: teardown dry run (no gcloud calls, all resources, binding removed before the service account)'
