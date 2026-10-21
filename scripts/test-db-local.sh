#!/bin/bash
# Runs the database tests (supabase/tests/database) without Docker: on a plain local PostgreSQL with
# pgTAP (apt install postgresql-16-pgtap), against a stand-in for the parts of Supabase the
# migrations use (scripts/supabase-stub.sql). For when `supabase test db` cannot run, as in a cloud
# session; CI runs the real thing. Each run starts from an empty database named fc_test.
# Usage: scripts/test-db-local.sh [test files]   (run as root: psql runs as the postgres user)
set -e
cd "$(dirname "$0")/.."
pg_ctlcluster 16 main start 2>/dev/null || true
q() { su postgres -c "psql -X -q -v ON_ERROR_STOP=1 -d fc_test $*"; }
su postgres -c "dropdb --if-exists fc_test" 2>/dev/null
su postgres -c "createdb fc_test"
q "-c 'alter database fc_test set search_path = \"\$user\", public, extensions'" >/dev/null
# files go in on stdin: the postgres user may not be able to read the checkout
q < scripts/supabase-stub.sql >/dev/null
for f in supabase/migrations/*.sql; do
  q < "$f" >/dev/null || { echo "migration failed: $f"; exit 1; }
done
fail=0
for t in ${@:-supabase/tests/database/*.test.sql}; do
  out=$(su postgres -c "psql -X -q -t -A -d fc_test" < "$t" 2>&1)
  echo "$t: $(grep -c '^ok ' <<< "$out") passed"
  if grep -qE '^not ok|^# Looks like|ERROR' <<< "$out"; then grep -E '^not ok|^#|ERROR' <<< "$out"; fail=1; fi
done
exit $fail
