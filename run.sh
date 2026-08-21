#!/bin/bash
set -euo pipefail
APP_NAME="bibliotecaepub"
# Zypak wrapper handles sandbox bridge for Chromium
exec zypak-wrapper.sh /app/lib/bibliotecaepub/electron $APP_NAME "$@"
