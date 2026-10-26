#!/usr/bin/env python3
"""Bundle src/ into one self-contained HTML page (the Claude artifact).
   python3 build.py            -> dist/poly-west.html (Three.js from the CDN)
   python3 build.py --local    -> dist/test.html (Three.js from vendor/, for the headless tests)
   The script files and their order come from src/manifest.txt; they share one scope (plain globals)."""
import sys, pathlib, re
root = pathlib.Path(__file__).parent
src = root / 'src'
order = [l.strip() for l in (src / 'manifest.txt').read_text().splitlines() if l.strip() and not l.startswith('#')]
on_disk = {str(p.relative_to(src)) for p in src.rglob('*.js')}
missing, unlisted = [f for f in order if f not in on_disk], sorted(on_disk - set(order))
if missing or unlisted:
    sys.exit(f'manifest out of date. missing: {missing} not listed: {unlisted}')
head = (src / 'ui' / 'page.html').read_text()
js = '\n'.join(f'// ==== {f} ====\n' + (src / f).read_text() for f in order)
local = '--local' in sys.argv
THREE_VER = next((a.split('=')[1] for a in sys.argv if a.startswith('--three=')), '159')   # r159: last release with a plain three.min.js
three = f'../vendor/three-r{THREE_VER}.min.js' if local else f'https://cdn.jsdelivr.net/npm/three@0.{THREE_VER}.0/build/three.min.js'
fallback = '' if local else f'<script>if (!window.THREE) document.write(\'<script src="https://unpkg.com/three@0.{THREE_VER}.0/build/three.min.js"><\\/script>\');</script>\n'
html = f'{head}\n<script src="{three}"></script>\n{fallback}<script>\n{js}\n</script>\n'
out = root / 'dist' / ('test.html' if local else 'poly-west.html')
out.parent.mkdir(exist_ok=True)
if local:
    html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + html + '</body></html>'
out.write_text(html)
print(out, len(html), 'bytes,', len(order), 'scripts')
