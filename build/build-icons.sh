#!/usr/bin/env bash
# Build the final EPUB Shelf icon asset set from the two source SVGs.
#   icon.svg       master artwork, used at 32px and above
#   icon-micro.svg optical variant, used at 16px
#
# Chrome does the rasterising: ImageMagick's internal SVG renderer mishandles
# clip-paths and gradients. Transparency needs BOTH a transparent page background
# and --default-background-color=00000000, otherwise Chrome flattens onto white
# and the PNGs come out RGB with no alpha channel.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT

render() { # render <svg> <size> -> $W/out.png (RGBA)
  printf '<html><body style="margin:0;background:transparent"><img src="file://%s/%s" width="%s" height="%s"></body></html>' \
    "$DIR" "$1" "$2" "$2" > "$W/r.html"
  google-chrome --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --default-background-color=00000000 \
    --screenshot="$W/out.png" --window-size="$2,$2" "$W/r.html" 2>/dev/null
}

for s in 32 48 64 128 256 512 1024; do
  render icon.svg "$s"; cp "$W/out.png" "$DIR/icon-$s.png"
done
cp "$W/out.png" "$DIR/icon.png"
for s in 16 20 24; do
  render icon-micro.svg "$s"; cp "$W/out.png" "$DIR/icon-$s.png"
done

# Multi-size .ico. 16px comes from the micro variant, the rest from the master.
rm -f "$DIR/icon.ico"
convert "$DIR"/icon-16.png "$DIR"/icon-32.png "$DIR"/icon-48.png \
        "$DIR"/icon-64.png "$DIR"/icon-128.png "$DIR"/icon-256.png "$DIR/icon.ico"

# Verify: every PNG must carry an alpha channel (colour type 6, RGBA).
python3 - "$DIR" <<'PY'
import struct, sys, glob, os
d = sys.argv[1]
bad = []
for f in sorted(glob.glob(os.path.join(d, "icon*.png"))):
    ct = struct.unpack(">B", open(f, "rb").read()[25:26])[0]
    if ct not in (4, 6):
        bad.append((os.path.basename(f), ct))
print("alpha: " + ("OK on all PNGs" if not bad else f"MISSING -> {bad}"))
PY
identify "$DIR"/icon.png "$DIR"/icon-{16,32,48,64,128,256}.png 2>/dev/null | sed 's/.*\///'