#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$PROJECT_ROOT"
npx @insforge/cli db import database/schema.sql
python3 database/seed_from_web.py --apply
