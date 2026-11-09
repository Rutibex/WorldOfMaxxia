#!/usr/bin/env sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/engine/world-of-maxxia"
exec node server.mjs
