#!/usr/bin/env python3
"""Build the files for the real voices (Piper TTS in the browser) into vendor/voice/ (not in git; build.py copies
   them to dist/voice/, and they are published next to the page as artifact files).
     python3 tools/voices.py                 -> runtime + the voices in VOICES
   What comes from where (all free to use):
   - onnxruntime-web 1.18.0 (npm, MIT): ort.wasm.min.js + ort-wasm-simd.wasm (single thread, no SharedArrayBuffer needed)
   - @diffusionstudio/piper-wasm 1.0.0 (npm, MIT; espeak-ng data GPL-3): piper_phonemize.js/.wasm/.data,
     the espeak data cut down to German (18 MB -> 0.8 MB)
   - Piper voices from github.com/rhasspy/piper releases v0.0.2 (MIT code; voice licences in each MODEL_CARD)
   Each voice: <name>.tmpl (the .onnx with its float32 weights cut out), <name>.w16.N (those weights as float16 in
   parts under 15 MB, the artifact's file limit), <name>.voice.json (where the weights go, the voice settings).
   The browser puts the model back together (float16 -> float32): same sound, half the download."""
import json, pathlib, re, shutil, subprocess, sys, tarfile, tempfile, urllib.request
import numpy as np
root = pathlib.Path(__file__).resolve().parent.parent
out = root / 'vendor' / 'voice'
VOICES = {'thorsten': 'voice-de-thorsten-low', 'karlsson': 'voice-de-karlsson-low', 'kerstin': 'voice-de-kerstin-low'}
want = [a for a in sys.argv[1:] if not a.startswith('-')] or ['thorsten']
CHUNK = 14_000_000

def npm(pkg, tmp):
    subprocess.run(['npm', 'pack', pkg, '--silent'], cwd=tmp, check=True, capture_output=True)
    tgz = next(pathlib.Path(tmp).glob('*.tgz')); d = pathlib.Path(tmp) / 'x'; d.mkdir()
    with tarfile.open(tgz) as t: t.extractall(d)
    tgz.unlink(); return d / 'package'

def runtime():
    with tempfile.TemporaryDirectory() as tmp:
        p = npm('onnxruntime-web@1.18.0', tmp)
        for f in ('ort.wasm.min.js', 'ort-wasm-simd.wasm'): shutil.copy(p / 'dist' / f, out / f)
    with tempfile.TemporaryDirectory() as tmp:
        b = npm('@diffusionstudio/piper-wasm@1.0.0', tmp) / 'build'
        s = (b / 'piper_phonemize.js').read_text(); data = (b / 'piper_phonemize.data').read_bytes()
        m = re.search(r'loadPackage\((\{"files":.*?"remote_package_size":\d+\})\)', s); d = json.loads(m.group(1))
        keep, blob = [], bytearray()
        for f in d['files']:
            fn = f['filename']
            if (fn.endswith('_dict') and not fn.endswith('/de_dict')) or '/mbrola_ph/' in fn: continue
            seg = data[f['start']:f['end']]; keep.append({'filename': fn, 'start': len(blob), 'end': len(blob) + len(seg)}); blob += seg
        d['files'] = keep; d['remote_package_size'] = len(blob)
        (out / 'piper_phonemize.js').write_text(s[:m.start(1)] + json.dumps(d, separators=(',', ':')) + s[m.end(1):])
        (out / 'piper_phonemize.data').write_bytes(blob); shutil.copy(b / 'piper_phonemize.wasm', out)

def voice(name, rel):
    import onnx
    with tempfile.TemporaryDirectory() as tmp:
        tgz = pathlib.Path(tmp) / 'v.tgz'
        urllib.request.urlretrieve(f'https://github.com/rhasspy/piper/releases/download/v0.0.2/{rel}.tar.gz', tgz)
        with tarfile.open(tgz) as t: t.extractall(tmp)
        onx = next(pathlib.Path(tmp).glob('*.onnx')); cfg = json.loads(next(pathlib.Path(tmp).glob('*.onnx.json')).read_text())
        card = next(pathlib.Path(tmp).glob('MODEL_CARD'), None); card = card.read_text() if card else ''
        B = onx.read_bytes(); mdl = onnx.load_from_string(B)
    ranges, pos = [], 0
    for t in mdl.graph.initializer:
        if t.data_type != onnx.TensorProto.FLOAT or len(t.raw_data) < 256: continue
        i = B.find(t.raw_data, pos); i = i if i >= 0 else B.find(t.raw_data); assert i >= 0; ranges.append((i, len(t.raw_data)))
    ranges.sort(); tmpl, half, segs, last = bytearray(), bytearray(), [], 0
    for i, n in ranges:
        tmpl += B[last:i]; segs.append([i, n]); half += np.frombuffer(B[i:i + n], np.float32).astype(np.float16).tobytes(); last = i + n
    tmpl += B[last:]
    (out / f'{name}.tmpl').write_bytes(tmpl)
    parts = []
    for k in range(0, len(half), CHUNK):
        pn = f'{name}.w16.{k // CHUNK}'; (out / pn).write_bytes(half[k:k + CHUNK]); parts.append(pn)
    for k in ('phoneme_map',): cfg.pop(k, None)
    json.dump({'size': len(B), 'segs': segs, 'parts': parts, 'voice': cfg, 'card': card}, open(out / f'{name}.voice.json', 'w'))
    print(name, 'model', round(len(B) / 1e6, 1), 'MB -> download', round((len(tmpl) + len(half)) / 1e6, 1), 'MB')

out.mkdir(parents=True, exist_ok=True)
if not (out / 'ort.wasm.min.js').exists() or '--runtime' in sys.argv: runtime()
for v in want: voice(v, VOICES[v])
print('total', round(sum(f.stat().st_size for f in out.iterdir()) / 1e6, 1), 'MB in', out)
