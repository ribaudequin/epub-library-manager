#!/bin/bash
set -euo pipefail
# Zypak wrapper handles the sandbox bridge for Chromium.
#
# The executable inside dist/linux-unpacked/ is named after package.json's
# "name" (epub-shelf), not after "productName" (EPUBShelf) — and the module
# below copies the unpacked build to /app/lib/epub-shelf. This path must match
# both; the previous value (/app/lib/bibliotecaepub/electron) pointed at a
# directory and a binary that the build never produced.
exec zypak-wrapper.sh /app/lib/epub-shelf/epub-shelf "$@"
