#!/bin/sh
# Rebuild public/fonts/*.woff2 from the original .ttf files (variable axes are kept).
# Requires: pip install fonttools brotli
# Ranges: Basic Latin + Latin-1 (all Spanish accents, ñ, ¿ ¡, ·, ×), general punctuation
# (– — ’ “ ” …), arrows ← ↑ → ↓ ↗ and the symbols used in copy/game (▶ ◆ ✦ ♛ ♜ Ⅱ ─).
# If new non-Latin-1 characters appear in src/ or dist/, add them here.
set -e
cd "$(dirname "$0")/../../public/fonts"
U="U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2122,U+2161,U+2190-2193,U+2197,U+2212,U+2500,U+25B6,U+25C6,U+265B,U+265C,U+2726"
for f in Inter JBMono Pixelify; do
  pyftsubset "$f.ttf" --unicodes="$U" --flavor=woff2 --layout-features='*' --output-file="$f.woff2"
done
ls -l *.woff2
