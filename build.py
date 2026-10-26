#!/usr/bin/env python3
"""Bundle src/ into one self-contained HTML page.
   python3 build.py            -> dist/dust-creek.html (Three.js from cdnjs)
   python3 build.py --local    -> dist/test.html (Three.js from a local copy, for headless tests)"""
import sys, pathlib
root = pathlib.Path(__file__).parent
src = root / 'src'
order = ['a_util.js', 'b_world.js', 'c_town.js', 'c3_rooms.js', 'd_nature.js', 'e_assets.js', 'e2_rig.js', 'f_shaders.js',
         'f_render.js', 'h_play.js', 'h2_audio.js','h3b_snd.js','h3c_fx.js','h3_gun.js','h3d_fist.js', 'h3e_interact.js', 'h4_ambient.js', 'i_hud.js', 'j_main.js']
head = (src / 'head.html').read_text()
js = '\n'.join((src / f).read_text() for f in order)
local = '--local' in sys.argv
three = ('../vendor/three.min.js' if local else 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js')
fallback = '' if local else '<script>if (!window.THREE) document.write(\'<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"><\\/script>\');</script>\n'
html = f'{head}\n<script src="{three}"></script>\n{fallback}<script>\n{js}\n</script>\n'
out = root / 'dist' / ('test.html' if local else 'dust-creek.html')
out.parent.mkdir(exist_ok=True)
if local:
    html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + html + '</body></html>'
out.write_text(html)
print(out, len(html), 'bytes')
