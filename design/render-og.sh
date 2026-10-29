#!/bin/sh
# Regenerates public/og.png from design/og.html (1200x630). Run from the repo root.
# Needs: google-chrome, node >= 22, python3 with Pillow, imagequant, pyoxipng
#   pip install --break-system-packages imagequant pyoxipng
set -e
PORT=${PORT:-18731}
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV' EXIT
sleep 1
node design/render.mjs "http://127.0.0.1:$PORT/design/og.html" /tmp/og-raw.png 1200 630
python3 - <<'PY'
import imagequant, oxipng
from PIL import Image
q = imagequant.quantize_pil_image(Image.open('/tmp/og-raw.png').convert('RGBA'), dithering_level=0.6, max_quality=95, min_quality=70)
q.save('public/og.png'); oxipng.optimize('public/og.png', level=4)
PY
ls -l public/og.png
