"""柔和音效库：章节气声、轻敲、小铃、片尾的低音。  juzu.py softfx   → music/sfx_soft/*.wav 和一条试听 _试听_softfx.wav
全部用正弦和滤过的噪声合成，不用甩动、冲击、故障、亮晶晶那一类（作者嫌它们刺耳以后换成了这套）。

规矩（作者说旧音效刺耳以后定的，片场动作声 set_fx.py 也照这个）：
- 起音不短于 8 毫秒，没有「啪」的一下；3 kHz 以上几乎没有能量；不做很重的低频。
- 每个文件按「最大瞬时响度」校到同一个基准：这里是 -30 LUFS。摆的时候不再按峰值拉响。
- 新做的音效先听试听条，再往片子里放。

音高：轻敲和小铃用配乐调里都有的音，免得和铺底打架。cues.json 里写 "sfx_notes": ["C4", "F4", "G4", "C5"] 就用写的；
不写就从 plan 里找每个音效落在哪段铺底，取这些铺底的调（beds.<名字>.key，比如 "F major"、"A minor"）共有的音。
64 期的四段铺底是 F 大调、A 小调、C 大调、降 E 大调，共有 C、D、F、G，挑出来是 C4、F4、G4、C5。"""
import re, sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _snd import SR, ep, cues, Clock, write, momentary_max, attack_ms, band_share, audition, log  # noqa: E402

REF = -30.0   # 每个文件的最大瞬时响度（LUFS）


def _sig():
    from scipy.signal import butter, sosfiltfilt
    return butter, sosfiltfilt


def env(n, a, r, hold=0.0, shape=2.0):
    """升余弦起音 a 秒，保持 hold 秒，指数收尾（r 秒降到约 -60 dB），最后 20 毫秒淡出。"""
    t = np.arange(n) / SR
    e = np.exp(-np.clip(t - a - hold, 0, None) * 6.9 / r)
    k = t < a
    e[k] = (0.5 - 0.5 * np.cos(np.pi * t[k] / a)) ** shape
    f = int(0.02 * SR); e[-f:] *= np.linspace(1, 0, f)
    return e


def lp(x, hz, order=4):
    butter, sosfiltfilt = _sig()
    return sosfiltfilt(butter(order, hz, 'low', fs=SR, output='sos'), x, axis=0)


def bp(x, lo, hi):
    butter, sosfiltfilt = _sig()
    return sosfiltfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x, axis=0)


def stereo(m, pan=0.0):
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    return np.stack([m * l, m * r], 1)


def tap(freq, dur=0.55):
    """木琴一样的一下：基音，加一点二倍和四倍泛音。给数字、按钮、评论引导用。"""
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t) * env(n, 0.010, 0.42)
    x += 0.10 * np.sin(2 * np.pi * freq * 4 * t) * env(n, 0.008, 0.10)
    x += 0.25 * np.sin(2 * np.pi * freq * 2 * t) * env(n, 0.012, 0.22)
    return stereo(lp(x, 2600))


def air(seed, up=True, dur=0.9):
    """换章节时的一口气：带通噪声，中心频率在 380 到 950 Hz 之间慢慢滑，慢起慢收，左右轻轻移一下。"""
    n = int(dur * SR); rng = np.random.default_rng(seed)
    w = rng.standard_normal(n + SR)
    cs = np.geomspace(380, 950, 8) if up else np.geomspace(950, 380, 8)
    x = np.zeros(n); pos = np.linspace(0, 1, n)
    for i, c in enumerate(cs):                      # 分 8 段带通交叉叠起来，听着像中心频率在滑
        g = np.clip(1 - np.abs(pos * 7 - i), 0, 1)
        x += bp(w, c / 1.5, c * 1.5)[:n] * g
    x = lp(x * np.sin(np.pi * pos) ** 2.2, 2200)
    pan = np.linspace(-0.35, 0.35, n) * (1 if up else -1)
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    return np.stack([x * l, x * r], 1)


def bloom(freqs, dur=2.6):
    """全片最重的那一下：一个慢慢亮起来的和弦，底下垫一声很软的低音。代替倒放镲片加重击。"""
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.zeros(n)
    for i, f in enumerate(freqs):
        d = 1 + 0.0015 * (i - 1.5)
        x += (np.sin(2 * np.pi * f * d * t) + 0.5 * np.sin(2 * np.pi * f * t + 0.3)) * (0.9 ** i)
    x *= env(n, 0.45, 1.9, hold=0.15, shape=1.5)
    k = t - 0.45
    low = np.where(k > 0, np.sin(2 * np.pi * (freqs[0] / 2) * np.clip(k, 0, None)) * np.exp(-np.clip(k, 0, None) * 6.9 / 0.9) * np.clip(k / 0.03, 0, 1), 0)
    return stereo(lp(x + 0.9 * low, 2400))


def chime(f1, f2, dur=1.5):
    """两个音的小铃：给点赞、好消息。比常见的亮晶晶低两个八度多。"""
    n = int(dur * SR); t = np.arange(n) / SR
    a = np.sin(2 * np.pi * f1 * t) * env(n, 0.012, 1.1)
    d = int(0.11 * SR)
    b = np.zeros(n); b[d:] = (np.sin(2 * np.pi * f2 * t) * env(n, 0.012, 1.2))[:n - d]
    return stereo(lp(a + 0.8 * b, 3000))


def thud(freq=82, dur=0.7):
    """片尾卡落下来的一声：很软的低音，带一点二倍泛音，手机外放也听得到。"""
    n = int(dur * SR); t = np.arange(n) / SR
    f = freq * (1 + 0.25 * np.exp(-t * 18))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(ph) + 0.35 * np.sin(2 * ph)) * env(n, 0.018, 0.5)
    return stereo(lp(x, 900))


# ---------- 音高 ----------
PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
MAJOR = (0, 2, 4, 5, 7, 9, 11)


def _root(s):
    s = s.strip(); m = re.match(r'([A-Ga-g])\s*(#|♯|b|♭|-?\s*sharp|-?\s*flat)?', s)
    if not m:
        raise ValueError(f'认不出调名：{s}')
    acc = (m.group(2) or '').replace(' ', '').replace('-', '')
    return (PC[m.group(1).upper()] + (1 if acc in ('#', '♯', 'sharp') else -1 if acc in ('b', '♭', 'flat') else 0)) % 12, s[m.end():]


def scale(key):
    """'F major' / 'A minor' / 'E-flat major' → 这个调里的 7 个音级（0 是 C）。小调按自然小调。"""
    r, rest = _root(key)
    base = (r + 3) % 12 if 'min' in rest.lower() else r
    return {(base + i) % 12 for i in MAJOR}


def note_hz(s):
    """'C4' → 261.63；也可以直接写数字（Hz）。"""
    if isinstance(s, (int, float)):
        return float(s)
    r, rest = _root(s)
    octave = int(re.search(r'-?\d+', rest).group(0)) if re.search(r'-?\d+', rest) else 4
    return 440.0 * 2 ** ((r - 9) / 12 + (octave - 4))


def pick_notes(C, e):
    """返回 {'lo','mid','hi','top'} 四个频率和一句说明。"""
    if C.get('sfx_notes'):
        n = [note_hz(x) for x in C['sfx_notes']]
        n += [n[0] * 2] * (4 - len(n))
        return dict(zip(('lo', 'mid', 'hi', 'top'), n[:4])), f"cues.json 写的 {C['sfx_notes']}"
    beds, plan = C.get('beds', {}), C.get('plan', [])
    used = set()
    try:
        ck = Clock(e)
        for s in C.get('sfx_soft', []):
            t = ck.at(s['at'])
            for p in plan:
                if ck.at(p['from']) <= t < ck.at(p['to']):
                    used.add(p['bed'])
    except Exception:
        pass
    used = used or {p['bed'] for p in plan}
    keys = [beds[b]['key'] for b in sorted(used) if b in beds and beds[b].get('key')]
    common = set(range(12))
    for k in keys:
        common &= scale(k)
    if len(common) < 2 or not keys:
        return {'lo': 261.63, 'mid': 349.23, 'hi': 392.0, 'top': 523.25}, f'铺底的调 {keys} 共有的音不够，用 C4 F4 G4 C5；不合适就在 cues.json 写 sfx_notes'
    best = max(sorted(common), key=lambda p: (((p + 5) % 12 in common) + ((p + 7) % 12 in common), -p))
    if (best + 5) % 12 in common and (best + 7) % 12 in common:
        iv = [5, 7]
    else:
        iv = sorted(((p - best) % 12 for p in common if p != best))[:2]
        iv += [12] * (2 - len(iv))
    lo = 261.63 * 2 ** (best / 12)
    names = 'C C# D D# E F F# G G# A A# B'.split()
    return ({'lo': lo, 'mid': lo * 2 ** (iv[0] / 12), 'hi': lo * 2 ** (iv[1] / 12), 'top': lo * 2},
            f'铺底的调 {keys} 共有 {[names[p] for p in sorted(common)]}，用 {names[best]}4 和它上面 {iv[0]}、{iv[1]} 个半音，再加高八度')


def finish(fx, out, ref):
    """每个文件先归一，再按最大瞬时响度校到 ref；打印时长、峰值、起音、3 kHz 以上占比。返回校好的数组。
    提醒线：起音量出来低于 7 毫秒；3 kHz 以上超过 10%（64 期纸的录音低通到 3 kHz 以后约 9%，作者听过没问题，合成的都是 0.00%）。"""
    out.mkdir(parents=True, exist_ok=True); done = {}
    for name, a in fx.items():
        a = a / (np.abs(a).max() + 1e-9) * 0.5
        p = out / f'{name}.wav'; write(p, a, SR)
        a = a * 10 ** ((ref - momentary_max(p)) / 20); write(p, a, SR); done[name] = a
        hi, atk = band_share(a, 3000), attack_ms(a)
        warn = ('  ← 起音太快' if atk < 7 else '') + ('  ← 高频偏多' if hi > 10 else '')
        print(f'{name:7s} {len(a) / SR:.2f}s 峰值 {20 * np.log10(np.abs(a).max()):6.1f} dB  起音 {atk:5.1f} ms  '
              f'3kHz 以上 {hi:.2f}%  瞬时响度 {momentary_max(p):.1f}{warn}')
    return done


def build(notes, out):
    lo, mid, hi, top = notes['lo'], notes['mid'], notes['hi'], notes['top']
    fx = {'tap1': tap(lo), 'tap2': tap(mid), 'tap3': tap(hi), 'tap4': tap(top),
          'air1': air(1, True), 'air2': air(2, False), 'air3': air(3, True, 1.1),
          'bloom': bloom([lo / 2, mid / 2, lo, mid]), 'chime': chime(hi * 2, top * 2),
          'thud': thud(lo / 2 if lo / 2 > 70 else lo / 2 * 1.5)}
    return finish(fx, out, REF)


if __name__ == '__main__':
    E = ep(); C = cues(E); OUT = E / 'music/sfx_soft'
    notes, why = pick_notes(C, E)
    print('音高：', why, {k: round(v, 2) for k, v in notes.items()})
    done = build(notes, OUT)
    rows = audition(list(done.items()), OUT / '_试听_softfx.wav')
    print('试听条 music/sfx_soft/_试听_softfx.wav（时间表在同名 .txt）。先听，再往片子里放。')
    log(E, '5-拟音', f'柔和音效 {len(done)} 个 → music/sfx_soft，基准 {REF} LUFS 瞬时；{why}')
