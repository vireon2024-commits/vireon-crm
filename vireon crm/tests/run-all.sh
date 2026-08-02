#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== JavaScript syntax =="
node --check site/app.js
node --check site/sw.js
node --check netlify/functions/public-config.mjs
node --check netlify/functions/google-sheets-sync.mjs
node --check netlify/functions/admin-users.mjs

echo "== Automated tests =="
node tests/functions.test.mjs
node tests/app-render.test.mjs
node tests/logic.test.mjs
node tests/apps-script.test.mjs
python3 tests/static.test.py

echo "All Vireon Lead Hub checks passed."
