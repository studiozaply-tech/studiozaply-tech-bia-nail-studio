#!/usr/bin/env bash
# Aplica as migrations num PostgreSQL LOCAL descartável e roda os testes de regra.
# Uso: PGURL=postgres://postgres@localhost:5432/postgres npm run test:db
set -euo pipefail
cd "$(dirname "$0")/.."
PGURL="${PGURL:-postgres://postgres@localhost:5432/postgres}"
DB="bia_test_$$"
psql "$PGURL" -qc "create database $DB" >/dev/null
trap 'psql "$PGURL" -qc "drop database if exists $DB" >/dev/null' EXIT
TEST_URL="${PGURL%/*}/$DB"
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$f"; done
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/01_booking_rules.sql >/dev/null
node scripts/test-concurrency.mjs "$TEST_URL"
