"""配乐铺底拼接：  juzu.py mix   → out/bed.wav
全部照这一集的 cues.json 来（时间写法见 common.Clock）：
  plan  配乐分段：[{"from": "0", "to": "b01-0.2", "bed": "groove", "offset": 0, "gain": 0}, …]；两段之间留空就是"停乐"
音效不在这里做：片场动作的音效、章节气声、环境声见 scripts/sound/。"""
import json, sys
from pathlib import Path
import numpy as np, soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
from common import cfg, ep, Clock, log

C, E = cfg(), ep()
CK = Clock(E); TL = CK.tl
CUES = json.load(open(E / 'cues.json'))
SR = 48000
DUR = TL['duration']; N = int(DUR * SR) + SR

def load(p):
    a, sr = sf.read(p, always_2d=True)
    assert sr == SR, f'{p} 的采样率是 {sr}，需要 48000（用 ffmpeg -ar 48000 转一下）'
    return (a if a.shape[1] == 2 else np.repeat(a, 2, 1)).astype(np.float32)
def rms_db(a): return 20 * np.log10(np.sqrt(np.mean(a ** 2)) + 1e-9)

# ---- 配乐：各段先拉到同一音量，按 plan 拼，交界处交叉淡化
names = sorted({p['bed'] for p in CUES.get('plan', [])})
beds = {n: load(E / f'music/{n}.wav') for n in names}
for n, a in beds.items(): beds[n] = a * 10 ** ((-20 - rms_db(a)) / 20)
bed = np.zeros((N, 2), np.float32); X = 0.5
for p in CUES.get('plan', []):
    a, b = CK.at(p['from']), min(DUR, CK.at(p['to']))
    if b <= a: continue
    i0, i1 = int(max(0, a - X / 2) * SR), int(min(DUR, b + X / 2) * SR)
    src = beds[p['bed']]; j0 = int(p.get('offset', 0) * SR)
    seg = np.take(src, np.arange(j0, j0 + i1 - i0) % len(src), axis=0) * 10 ** (p.get('gain', 0) / 20)
    f = int(X * SR); env = np.ones(len(seg), np.float32)
    if a > 0: env[:f] = np.linspace(0, 1, f) ** 0.5
    env[-f:] = np.linspace(1, 0, f) ** 0.5
    bed[i0:i1] += seg * env[:, None]
fo = int(4 * SR); e0 = int(DUR * SR) - fo; bed[e0:e0 + fo] *= np.linspace(1, 0, fo)[:, None]; bed[e0 + fo:] = 0
sf.write(E / 'out/bed.wav', bed, SR)

msg = f"配乐 {len(CUES.get('plan', []))} 段（{'、'.join(names)}）"
print(msg, '｜bed', round(rms_db(bed), 1), 'dB'); log(E, '3-作曲', '铺底拼接：' + msg)
