#!/bin/sh
# Deprecated: the OG image is owned by Diseño. Single source: design/render-og.sh
set -e
cd "$(dirname "$0")/../.."
exec sh design/render-og.sh "$@"
