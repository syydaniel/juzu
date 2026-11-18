"""按 cues.json 的 sfx_soft 摆柔和音效（章节气声、点赞的小铃、评论引导的轻敲、片尾的低音）。
  juzu.py softfx    先做出 music/sfx_soft/*.wav
  juzu.py cue_fx    → out/sfx_cues.wav（整片长度）

cues.json 的写法：
  "sfx_soft": [
    {"at": "c01", "name": "air1", "pre": 0.45},     章节开头的一口气，提前 0.45 秒慢慢起来
    {"at": "b08:点个赞", "name": "chime"},          说到「点个赞」响一声小铃
    {"at": "END", "name": "thud", "gain": -2}       片尾卡落下；gain 是在文件原有音量上再加减几 dB
  ]
文件原样放，不再按峰值拉响：每个文件已经校到 -30 LUFS 瞬时，比人声低约 10 LU。"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _snd import SR, ep, cues, Clock, write, log, mmss  # noqa: E402

if __name__ == '__main__':
    import soundfile as sf
    E = ep(); ck = Clock(E); N = int(ck.tl['duration'] * SR) + SR
    items = cues(E).get('sfx_soft', [])
    out = np.zeros((N, 2), np.float32); n = 0; cache = {}
    for s in sorted(items, key=lambda s: ck.at(s['at'])):
        p = E / f"music/sfx_soft/{s['name']}.wav"
        if s['name'] not in cache:
            if not p.exists():
                sys.exit(f'没有 {p.relative_to(E)}：先跑 juzu.py softfx（或 set_fx），或者改 cues.json 里的名字')
            a, sr = sf.read(p, always_2d=True)
            assert sr == SR, f'{p.name} 的采样率是 {sr}，需要 {SR}'
            cache[s['name']] = (a if a.shape[1] == 2 else np.repeat(a, 2, 1)).astype(np.float32)
        a = cache[s['name']] * 10 ** (s.get('gain', 0) / 20)
        t = ck.at(s['at']) - s.get('pre', 0); i = int(max(0, t) * SR)
        out[i:i + len(a)] += a[:max(0, N - i)]; n += 1
        print(f"{mmss(t):>6} {t:8.2f}  {s['name']:7s} {s['at']}")
    write(E / 'out/sfx_cues.wav', out, SR, 'FLOAT')
    pk = float(20 * np.log10(np.abs(out).max() + 1e-9))
    msg = f'柔和音效 {n} 处 → out/sfx_cues.wav，峰值 {pk:.1f} dB'
    print(msg); log(E, '5-拟音', msg)
