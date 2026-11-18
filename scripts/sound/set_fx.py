"""片场动作的声音：桌上掉字块、软木板上的纸展开、贴截图、立体卡翻出来、牌子升起来、图钉、小机器人跳进跳出屏幕。
  juzu.py events    → sfx/events.json（从导演表 set/shots.js 读出每个动作的时刻）
  juzu.py set_fx    → music/sfx_soft/<名字>.wav、out/sfx_set.wav（整片长度）和试听条 music/sfx_soft/_试听_set_fx.wav

规矩和 softfx.py 一样：起音不短于 8 毫秒、3 kHz 以上几乎没有能量、不做重低音。
这些动作比章节气声多得多（64 期 59 处），所以基准再低 4 dB：每个文件的最大瞬时响度校到 -34 LUFS。
同一种动作轮着用几个变体，音高和长短略有不同，免得像复制粘贴。
纸和胶带用录音（默认在达芬奇的 Fairlight 音效库里找，低通到 3 kHz）；找不到就用滤过的噪声代替，并且提醒你。

cues.json 里可以写（都可以不写）：
  "set_fx": {
    "gain":  {"tok": 0, "unroll": -2},                      每种动作在基准上再加减几 dB
    "extra": [{"at": "c05:关键词", "kind": "tok"}],          导演表以外想加的动作
    "off":   ["pin"]                                       这几种动作不出声
  }"""
import json, sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _snd import SR, ep, cues, Clock, write, find_lib, audition, log  # noqa: E402
from softfx import env, lp, bp, stereo, finish  # noqa: E402

REF = -34.0
rng = np.random.default_rng(17)
LIB = {   # 录音的文件名（Fairlight 音效库里的），找不到就合成
    'paper': 'Paper Movement on a Roll.M.wav',
    'tape': 'Tape Handling Misc.M.wav',
    'card': 'Handling Post Cards.M.wav',
}
MISSING = []


def lib(key, rank, d, e):
    """从库里的长录音里挑第 rank 响的一段（d 秒，互不重叠）。随便截一段容易截到安静处，校准时会把底噪放大。"""
    import soundfile as sf
    from scipy.signal import resample_poly
    try:
        x, sr = sf.read(find_lib(LIB[key], e), always_2d=True)
    except FileNotFoundError:
        MISSING.append(LIB[key]); return None
    x = x.mean(1)
    if sr != SR:
        x = resample_poly(x, SR, sr)
    h = int(.05 * SR); w = int(d * SR); en = np.convolve(x ** 2, np.ones(w), 'valid')[::h]; picks = []
    for i in np.argsort(en)[::-1]:
        if all(abs(i - j) * h >= w for j in picks):
            picks.append(i)
        if len(picks) > rank:
            break
    a0 = picks[rank] * h; x = x[a0: a0 + w]; n = len(x)
    return x * env(n, .012, d * .55, hold=d * .25, shape=1.5)


def rustle(d, lo=500, hi=2600):
    """没有录音时的代替品：带通噪声加一点不规则的起伏，像纸或胶带。"""
    n = int(d * SR); w = bp(rng.standard_normal(n), lo, hi)
    am = np.interp(np.arange(n), np.linspace(0, n, 12), rng.uniform(.3, 1, 12))
    return w * am * env(n, .015, d * .5, hold=d * .2, shape=1.5)


def tok(f=230):
    """木字块落在桌垫上：几个木头的共振很快衰减，起音 8 毫秒，整体发闷。"""
    n = int(.32 * SR); t = np.arange(n) / SR; x = np.zeros(n)
    for k, a, dc in ((1, 1, .07), (2.43, .5, .05), (4.9, .22, .03)):
        x += a * np.sin(2 * np.pi * f * k * t + rng.uniform(0, 6)) * env(n, .008, dc * 3)
    x += bp(rng.standard_normal(n), 300, 1400) * env(n, .008, .03) * .4
    return stereo(lp(x, 2400), rng.uniform(-.2, .2))


def swish(up=True, d=.42):
    """立体卡翻出来：一小口气，带通噪声慢起慢收。"""
    n = int(d * SR); w = bp(rng.standard_normal(n), 300, 1500); pos = np.linspace(0, 1, n)
    x = lp(w * np.sin(np.pi * pos ** (.7 if up else 1.3)) ** 2, 2200)
    return stereo(x, rng.uniform(-.3, .3))


def hop(up=True):
    """小机器人跳进 / 跳出屏幕：一声软的「啵」，音高往上（进）或往下（出）滑，后面跟一下很轻的落地。"""
    n = int(.36 * SR); t = np.arange(n) / SR
    f = np.where(t < .2, np.interp(t, [0, .2], [330, 523] if up else [523, 330]), 0)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(ph) + .15 * np.sin(2 * ph)) * env(n, .012, .16, hold=.06) * (t < .26)
    k = int(.24 * SR); x[k:] += tok(196)[: n - k, 0] * .5
    return stereo(lp(x, 2600))


def rise():
    """桌上的牌子升起来：木头擦过的一声，低频噪声慢慢起来再收住。"""
    n = int(.9 * SR); w = bp(rng.standard_normal(n), 120, 700)
    return stereo(lp(w * env(n, .35, .4, hold=.15, shape=1.2), 900))


def pin():
    """图钉按进软木：很短很闷的一下。"""
    n = int(.12 * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * 410 * t) * env(n, .008, .05) + bp(rng.standard_normal(n), 400, 1800) * env(n, .008, .02) * .5
    return stereo(lp(x, 2200), rng.uniform(-.15, .15))


def rec(key, rank, d, cut, pan, e, alt):
    x = lib(key, rank, d, e)
    return stereo(lp(x if x is not None else alt(), cut), pan)


def build(e, out):
    fx = {'tok1': tok(220), 'tok2': tok(247), 'tok3': tok(262), 'tok4': tok(196),
          'paper1': rec('paper', 0, .9, 3000, -.15, e, lambda: rustle(.9)),
          'paper2': rec('paper', 1, .9, 3000, .15, e, lambda: rustle(.9)),
          'tape1': rec('tape', 2, .45, 2200, -.2, e, lambda: rustle(.45, 700, 2200)),
          'tape2': rec('card', 0, .45, 3000, .2, e, lambda: rustle(.45, 600, 2800)),
          'swish1': swish(True), 'swish2': swish(True, .36), 'swish3': swish(False, .4),
          'hopin': hop(True), 'hopout': hop(False), 'rise': rise(), 'pin': pin()}
    return finish(fx, out, REF)


PICK = {'tok': ['tok1', 'tok2', 'tok3', 'tok4'], 'unroll': ['paper1', 'paper2'], 'stick': ['tape1', 'tape2'],
        'card': ['swish1', 'swish2', 'swish3'], 'hopin': ['hopin'], 'hopout': ['hopout'], 'rise': ['rise'], 'pin': ['pin']}
GAIN = {'tok': 0, 'unroll': -2, 'stick': -2, 'card': -3, 'hopin': 0, 'hopout': -2, 'rise': -2, 'pin': -3}

if __name__ == '__main__':
    E = ep(); C = cues(E).get('set_fx', {}); OUT = E / 'music/sfx_soft'
    done = build(E, OUT)
    if MISSING:
        print('没找到这些录音，用噪声代替了（音色会差一点）：', sorted(set(MISSING)))
    audition(list(done.items()), OUT / '_试听_set_fx.wav')
    ck = Clock(E); N = int((ck.tl['duration'] + 1) * SR); out = np.zeros((N, 2), np.float32); last = {}; cnt = {}
    evp = E / 'sfx/events.json'
    ev = json.load(open(evp)) if evp.exists() else []
    if not evp.exists():
        print('没有 sfx/events.json（先跑 juzu.py events）；只摆 cues.json 里 set_fx.extra 的动作')
    ev += [{'t': ck.at(x['at']), 'kind': x['kind'], 'text': x.get('text', '')} for x in C.get('extra', [])]
    gain = {**GAIN, **C.get('gain', {})}; off = set(C.get('off', []))
    for x in sorted(ev, key=lambda x: x['t']):
        if x['kind'] in off or x['kind'] not in PICK:
            continue
        names = PICK[x['kind']]; k = last.get(x['kind'], -1) + 1; last[x['kind']] = k
        a = done[names[k % len(names)]] * 10 ** (gain[x['kind']] / 20)
        j = int(x['t'] * SR)
        if j >= N:
            continue
        out[j:j + len(a)] += a[: N - j].astype(np.float32); cnt[x['kind']] = cnt.get(x['kind'], 0) + 1
    write(E / 'out/sfx_set.wav', out, SR, 'PCM_24')
    pk = round(float(20 * np.log10(np.abs(out).max() + 1e-9)), 1)
    msg = f'片场动作声 {sum(cnt.values())} 处 {cnt} → out/sfx_set.wav，峰值 {pk} dB；基准 {REF} LUFS 瞬时'
    print(msg); print('试听条 music/sfx_soft/_试听_set_fx.wav。新加的声音先单独听过再混。')
    log(E, '5-拟音', msg + (f'；缺录音 {sorted(set(MISSING))}，用噪声代替' if MISSING else ''))
