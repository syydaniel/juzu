"""四层背景声（78 期作者听过 A/B 选定：「用新的四层」）。片场是剧组的书房（窗在 x = 0 的墙上），环境声一条做完，摆进音效轨。

  juzu amb4 [--to 秒] [--name room] [--seed 78]
    → music/amb/<name>.wav       四层合起来（cues.json 的 ambience 里写一条带 "script": "amb4" 的，stems 原样摆进去，不再自己拼）
    → out/amb4_events.json       第 3、4 层每一下放在哪、用的哪段录音（给人查）

先自动跑 amb4_dump.mjs 读导演表（换光、小卡落地、台词起止、章节 → out/amb4_shots.json），
再读 out/campath.json（cd set && node tools/campath.mjs --fps 24：逐帧机位和看向点；没有的话当镜头一直在 duo 机位）。
导演表改过、或者镜头改过，两样都要重跑，再跑这个，再跑 stems。

要的录音（按文件名找：先这一集的 sfx/lib，再 config 的 ambience_dirs，默认达芬奇 Fairlight 音效库）：
  amb_day_city.wav、amb_day_birds.wav、amb_night_city.wav（先拼好放进 sfx/lib，做法见 stages/5-拟音.md「四层背景声」；做过一次就从上一集连 来源.md 一起拷过来）；
  Fairlight：Exhaust Fan On Run Off、Magnolia Night Traffic Car Bus B、Bike By 1.M / 2.M、Rustling Branches and Leaves.M、
  Leaves Bush Rustling.M、Car Door Close x4.M、Plastic Flashlight Switch.M、BF Thunk On Wood.M，以及 EXT 和鸟群那两条（见 EVENTS）。

四层：
 1 屋里的底噪：Fairlight「Exhaust Fan On Run Off」中间平稳的 2–29 秒，低通 1.5 kHz，随机取块交叉拼长。
   几乎居中，夜里比白天清楚一点（外面安静了）。不跟镜头、不跟话。
 2 窗外的底子：白天 amb_day_city 加很轻的鸟叫 amb_day_birds，黄昏鸟叫再低 3 dB、城市声更闷一点，夜里 amb_night_city
   （城市和夜里两条拼自 Fairlight 录音，鸟叫拼自 freesound 的 CC0 录音，来源写在 sfx/lib/来源.md）。换光的那一刀跟画面一起切。
 3 窗外的事：车开过、自行车过去、一阵风吹树叶、一群鸟飞走、远处关车门。每分钟一两个，最响的那一下落在台词的空当里；
   同一种至少隔 180 秒；音高、远近、左右每次略不同，左右还会慢慢移过去。
 4 屋里的细节：换光时台灯开关轻响一下，小卡落地时桌面闷闷地响一下。
三条规则：
 跟镜头走：窗在 x = 0 的墙上，中心 (0, 1.55, 1.25)（set/desk.js DIM.win）。逐帧算镜头离窗多远、窗在镜头哪边：
   近了第 2、3 层响一点、亮一点，远了闷一点；窗在左边声音就偏左，背对窗更闷。第 4 层按台灯、小卡的位置摆左右。
 跟话走：台词空当超过 1.5 秒、章节换段、片尾，第 2、3 层慢慢抬 3.5 dB，起落都 0.6 秒以上，不「泵」。
 每次都不一样：随机数种子固定（78），重跑结果一样；换种子就是另一套。
第 3、4 层都压在 3 kHz 以下（作者嫌 61 期音效刺耳），喇叭、狗叫、人声都不放。
录音不进任何公开仓库。"""
import json, subprocess, sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, resample_poly

from _snd import ep, find_lib  # noqa: E402

E = ep()
SR = 48000
a = sys.argv[1:]
opt = lambda k, d: a[a.index('--' + k) + 1] if '--' + k in a else d
NAME = opt('name', 'room')
subprocess.run(['node', str(Path(__file__).with_name('amb4_dump.mjs'))], check=True, env={**__import__('os').environ, 'JUZU_EP': str(E)})
SH = json.loads((E / 'out/amb4_shots.json').read_text())
DUR = float(a[a.index('--to') + 1]) if '--to' in a else SH['dur']
DUR = min(DUR, SH['dur'])
N = int(round(DUR * SR))
rng = np.random.default_rng(int(opt('seed', 78)))

WIN = np.array([0.0, 1.55, 1.25])          # 窗的中心
LAMP = np.array([0.90, 1.12, 0.22])        # 台灯（desk.js DIM.lamp，灯泡高度）
KAKA = np.array([1.65, 0.98, 0.26])        # 小卡站的地方（duo 机位看向点附近）


def db(x):
    return 10 ** (x / 20)


def lp(x, f, o=2):
    return sosfilt(butter(o, f, 'lowpass', fs=SR, output='sos'), x, axis=0)


def hp(x, f, o=2):
    return sosfilt(butter(o, f, 'highpass', fs=SR, output='sos'), x, axis=0)


def load(path, t0=0.0, t1=None, mono=False):
    path = find_lib(path, E) or path                 # 只写文件名就行
    x, sr = sf.read(str(path), dtype='float32', always_2d=True)
    if sr != SR:
        x = resample_poly(x, SR, sr, axis=0).astype(np.float32)
    x = x[int(t0 * SR):] if t1 is None else x[int(t0 * SR):int(t1 * SR)]
    if mono:
        return x.mean(axis=1)
    return x if x.shape[1] == 2 else np.repeat(x, 2, axis=1)


def rms(x):
    return 20 * np.log10(np.sqrt(np.mean(np.square(x, dtype=np.float64))) + 1e-12)


def ramp(n, kind='in'):
    r = np.sin(np.linspace(0, np.pi / 2, n)) ** 2
    return r if kind == 'in' else r[::-1]


# ---------- 时刻 ----------
lines = sorted(SH['lines'], key=lambda l: l[1])
LIGHT = SH['light']


def light_at(t):
    p = LIGHT[0]['p']
    for k in LIGHT:
        if k['t'] <= t:
            p = k['p']
    return 'night' if p.startswith('night') else 'dusk' if p.startswith('dusk') else 'day'   # nightB、nightDim 都算夜里


def segs():
    """换光切成几段：[(t0, t1, 'day'|'dusk'|'night')]，另给每段开头的交叉时长（秒）。
    同一类光连着换（b25 白天换低太阳、b26 夜里补光调暗再调亮）不算换段，窗外的录音接着放；
    慢慢换的光（d 一两秒）窗外的底子也跟着慢慢交叉，硬切的还是 0.12 秒"""
    b = [(0.0, light_at(0.0), .12)]
    for k in LIGHT[1:]:
        if k['t'] >= DUR:
            continue
        kind = light_at(k['t'] + 1e-3)
        if kind == b[-1][1]:
            continue
        d = float(k.get('d', 4))
        b.append((k['t'], kind, d if d > .05 else .12))
    return ([(b[i][0], b[i + 1][0] if i + 1 < len(b) else DUR, b[i][1]) for i in range(len(b))], [x[2] for x in b])


SEGS, XIN = segs()
LAMP_ON = {'night', 'nightB', 'nightDim', 'dusk', 'duskB'}      # desk.js 里台灯亮着的几种光（lamp > 0）
gaps = [(lines[i][2], lines[i + 1][1]) for i in range(len(lines) - 1)]
gaps = [(g0, g1) for g0, g1 in gaps if g1 - g0 > 0]
END_LINE = lines[-1][2]

# ---------- 机位 ----------
cp = E / 'out/campath.json'
if cp.exists():
    R = np.array(json.loads(cp.read_text())['R'], dtype=np.float64)
    CT, CP, CL = R[:, 0], R[:, 1:4], R[:, 7:10]
    CAMSRC = 'out/campath.json'
else:
    CT = np.array([0.0, SH['dur']]); CP = np.array([[1.82, 1.17, 1.50]] * 2); CL = np.array([[1.65, .98, .26]] * 2)
    CAMSRC = '没有 campath.json，当镜头一直在 duo 机位'


def view(target):
    """逐帧：目标到镜头的距离、左右（-1 左 … 1 右）、在镜头后面多少（侧面及以前 0 … 正后 1）。"""
    fwd = CL - CP; fwd /= np.linalg.norm(fwd, axis=1, keepdims=True)
    up = np.array([0, 1.0, 0]); right = np.cross(fwd, up); right /= np.linalg.norm(right, axis=1, keepdims=True)
    d = target - CP; dist = np.linalg.norm(d, axis=1); dn = d / dist[:, None]
    x = (dn * right).sum(1); z = (dn * fwd).sum(1)
    return dist, np.clip(x, -1, 1), np.clip(-z, 0, 1)            # 在侧面算 0，只有转到身后才算


def at_samples(v, t0=0.0, n=N):
    """逐帧的控制量插值到每个采样（帧和帧之间线性，硬切处是 1/24 秒的斜坡）。"""
    ts = t0 + np.arange(n) / SR
    return np.interp(ts, CT, v).astype(np.float32)


def pan_gains(p):
    th = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return (np.cos(th) * np.sqrt(2)).astype(np.float32), (np.sin(th) * np.sqrt(2)).astype(np.float32)


wd, wx, wb = view(WIN)
# 跟镜头走：离窗 2 米时不变，近了响、远了轻（每翻一倍 3.5 dB；这期机位离窗 1.9–3.6 米，差不到 3 dB，夹在 ±4 dB）；左右最多偏到 0.4；背对窗再轻 3 dB、更闷
W_GAIN = np.clip(-3.5 * np.log2(wd / 2.0), -4, 4) - 3 * wb
W_PAN = np.clip(wx * .45, -.4, .4)          # 偏左不全左：最多左右差 6 dB（试过 0.6，差 9.6 dB，安静的底子一边耳朵太空）
W_BRIGHT = np.clip(1 - (wd - 1.4) / 2.2, 0, 1) * (1 - wb)       # 1 亮（离窗 1.4 米以内、正对）… 0 闷


# ---------- 跟话走：第 2、3 层的「透口气」 ----------
def breath_curve():
    """每个采样上第 2、3 层要抬几 dB：空当超过 1.5 秒、章节换段、片尾抬 3.5 dB，起落 0.6–0.9 秒。"""
    t = np.arange(N) / SR; g = np.zeros(N, np.float32)
    wins = [(g0 + .15, g1 - .1) for g0, g1 in gaps if g1 - g0 > 1.5]
    wins += [(END_LINE + .2, DUR + 5)]
    if lines[0][1] > 1.5:
        wins.append((0, lines[0][1] - .1))
    for w0, w1 in wins:
        if w0 >= DUR:
            continue
        up, dn = .7, .6
        s = np.clip((t - w0) / up, 0, 1) * np.clip((w1 - t) / dn, 0, 1)
        s = np.sin(s * np.pi / 2) ** 2
        g = np.maximum(g, 3.5 * s.astype(np.float32))
    return g, wins


BREATH, BREATH_WINS = breath_curve()


# ---------- 第 1 层：屋里的底噪 ----------
def room_tone():
    src = load('Exhaust Fan On Run Off.wav', 2.0, 29.0, mono=True)
    src = hp(lp(src, 1500, 4), 60).astype(np.float32)
    out = np.zeros(N + SR * 12, np.float32); pos = 0; xf = int(1.5 * SR)
    while pos < N:
        L = int(rng.uniform(6, 10) * SR); s = int(rng.uniform(0, len(src) / SR - L / SR - .1) * SR)
        c = src[s:s + L].copy(); c[:xf] *= np.sqrt(ramp(xf)); c[-xf:] *= np.sqrt(ramp(xf, 'out'))
        out[pos:pos + L] += c; pos += L - xf
    m = out[:N]; m /= np.sqrt(np.mean(m.astype(np.float64) ** 2)) + 1e-12
    # 一点点宽度：另一条错开 3.7 秒的同一段混 15%，左右不完全一样
    w = np.roll(m, int(3.7 * SR)); st = np.stack([m + .15 * w, m - .15 * w], 1) / 1.01
    t = np.arange(N) / SR; lv = np.zeros(N, np.float32)
    for t0, t1, k in SEGS:
        lv[(t >= t0) & (t < t1)] = {'day': -41, 'dusk': -39, 'night': -36}[k]
    lv = np.convolve(lv, np.ones(int(.3 * SR)) / int(.3 * SR), mode='same').astype(np.float32)   # 换光处 0.3 秒过渡
    return st * db(lv)[:, None]


# ---------- 第 2 层：窗外的底子 ----------
# 每段从录音的哪儿读（10 分钟的拼接录音；白天三段加起来超过 10 分钟，黄昏和第二段白天跟第一段白天错开 5 分钟以上）
OFFS = {'day': [0.0, 60.0], 'dusk': [272.0], 'night': [0.0, 200.0]}
BED = {  # 75 期 window 段的电平和滤波（作者听过的），旧版照搬；新版在这之上跟镜头、跟话
    'day':   [('amb_day_city.wav', -26, 80, 3200), ('amb_day_birds.wav', -35, 1200, 6500)],
    'dusk':  [('amb_day_city.wav', -27, 80, 2600), ('amb_day_birds.wav', -38, 1200, 6500)],
    'night': [('amb_night_city.wav', -27, 80, 2800)],
}


def bed(new=True):
    out = np.zeros((N, 2), np.float32); used = {k: 0 for k in OFFS}; xf = int(.12 * SR)
    t = np.arange(N) / SR
    for i, (t0, t1, k) in enumerate(SEGS):
        off = OFFS[k][used[k] % len(OFFS[k])]; used[k] += 1
        xi, xo = int(XIN[i] * SR), int(XIN[i + 1] * SR) if i + 1 < len(SEGS) else xf
        n0, n1 = int(t0 * SR), min(N, int(t1 * SR) + xo)
        seg = np.zeros((n1 - n0, 2), np.float32)
        for f, lv, h, l in BED[k]:
            x = load(f, off, off + (n1 - n0) / SR + .01)[:n1 - n0]
            x = hp(x, h)
            if new and f != 'amb_day_birds.wav':
                # 亮、闷两个版本，按离窗远近逐帧交叉：亮的截止高 1.3 倍，闷的低到 0.55 倍
                xb, xd = lp(x, min(l * 1.3, 4200), 2), lp(x, l * .55, 2)
                br = at_samples(W_BRIGHT, t0, len(x))[:, None]
                x = xb * br + xd * (1 - br)
            else:
                x = lp(x, l, 2)
            x = x.astype(np.float32)
            x *= db(lv - rms(x[: min(len(x), 60 * SR)]))
            seg[:len(x)] += x
        if n0 > 0:                                   # 两段不相干的录音交叉：等功率
            seg[:xi] *= np.sqrt(ramp(xi))[:, None]
        if n1 < N:
            seg[-xo:] *= np.sqrt(ramp(xo, 'out'))[:, None]
        if n0 == 0:                                  # 片头 2 秒淡入（第一个镜头是夜里慢慢亮起来的）
            seg[:2 * SR] *= ramp(2 * SR)[:, None]
        out[n0:n1] += seg
    if new:
        g = db(at_samples(W_GAIN) + BREATH)
        gl, gr = pan_gains(at_samples(W_PAN))
        out[:, 0] *= g * gl; out[:, 1] *= g * gr
    return out


# ---------- 第 3 层：窗外的事 ----------
def peak_at(x, lo, hi):
    """录音里 lo..hi 秒之间最响的 0.3 秒的中心。"""
    w = int(.3 * SR); e = np.convolve(np.square(x.astype(np.float64)), np.ones(w) / w, mode='same')
    a0, a1 = int(lo * SR), int(hi * SR)
    return (a0 + int(np.argmax(e[a0:a1]))) / SR


EXT = 'Ext City Ambience, Car Drive-Bys, Pedestrian, Air.wav'
SRC = {  # 种类：[(文件, 找峰的范围, 峰前几秒, 峰后几秒)]，light 是哪种光下会有
    'car':    dict(light=('day', 'dusk'), w=3, pool=[(EXT, (17, 24), 4.0, 4.0), (EXT, (59, 67), 4.0, 4.0)]),
    'carN':   dict(light=('night',), w=3, pool=[('Magnolia Night Traffic Car Bus B.wav', (50, 63), 5.0, 4.5)]),
    'bike':   dict(light=('day', 'dusk'), w=2, pool=[('Bike By 1.M.wav', (0, 3.6), 1.6, 1.8), ('Bike By 2.M.wav', (0, 3.8), 1.6, 1.9)]),
    'leaves': dict(light=('day', 'dusk', 'night'), w=2, pool=[('Rustling Branches and Leaves.M.wav', (0, 4), 1.8, 2.2), ('Leaves Bush Rustling.M.wav', (15, 20), 1.8, 2.2)]),
    'wings':  dict(light=('day',), w=1, pool=[('Wing Flaps Multiple Birds Fly Away.wav', (0, 2.5), .8, 2.4)]),
    'door':   dict(light=('day', 'dusk', 'night'), w=1, pool=[('Car Door Close x4.M.wav', (0, 1.6), .25, 1.0)]),
}
GAP_MIN, SAME_MIN = .6, 180.0   # 台词段之间的空当大多是 0.65 秒（时间线默认），段与段之间就是「停顿」


def plan_events():
    cands = [((g0 + g1) / 2, g1 - g0) for g0, g1 in gaps if g1 - g0 >= GAP_MIN]
    chap = [c for c in SH['chapters']]
    ev, last, t = [], {k: -1e9 for k in SRC}, 6.0
    while True:
        target = t + rng.uniform(26, 44)
        if target > DUR - 4:
            break
        near = [(m, L) for m, L in cands if abs(m - target) < 14 and m > t + 16 and m < DUR - 3]
        if not near:
            t = target; continue
        # 越长的空当越优先，章节换段的空当最优先；再按离目标近
        m, L = max(near, key=lambda c: c[1] + (3 if any(abs(c[0] - x) < 4 for x in chap) else 0) - abs(c[0] - target) / 10)
        lt = light_at(m)
        ok = [k for k, s in SRC.items() if lt in s['light'] and m - last[k] >= SAME_MIN]
        if not ok:
            t = m; continue
        w = np.array([SRC[k]['w'] for k in ok], float); k = ok[int(rng.choice(len(ok), p=w / w.sum()))]
        f, rngT, pre, post = SRC[k]['pool'][int(rng.integers(len(SRC[k]['pool'])))]
        ev.append(dict(t=round(m, 3), gap=round(L, 2), kind=k, light=lt, file=f, find=rngT, pre=pre, post=post,
                       semis=round(float(rng.uniform(-1.5, 1.2)), 2), far=round(float(rng.uniform(0, 1)), 2),
                       sweep=round(float(rng.choice([-1, 1]) * rng.uniform(.25, .5)), 2), lift=round(float(rng.uniform(4, 7)), 1)))
        last[k] = m; t = m
    return ev


def seg_end(t):
    for t0, t1, _ in SEGS:
        if t0 <= t < t1:
            return t1
    return DUR


def render_events(ev):
    out = np.zeros((N + SR * 10, 2), np.float32)
    for e in ev:
        x = load(e['file'], mono=True); pk = peak_at(x, *e['find'])
        c = x[max(0, int((pk - e['pre']) * SR)):int((pk + e['post']) * SR)].astype(np.float64)
        r = 2 ** (e['semis'] / 12); up, dn = int(round(1000 / r)), 1000          # 变调（时长跟着变一点）
        c = resample_poly(c, up, dn)
        cut = 3000 - 1300 * e['far']                                              # 远的更闷：3 kHz → 1.7 kHz
        c = hp(lp(c, cut, 4), 120)
        n = len(c); fi, fo = min(int(.6 * SR), n // 3), min(int(.9 * SR), n // 3)
        c[:fi] *= ramp(fi); c[-fo:] *= ramp(fo, 'out')
        w = int(.3 * SR); pk_rms = 10 * np.log10(np.max(np.convolve(c * c, np.ones(w) / w, mode='valid')) + 1e-12)
        # 峰值比那一段底子高 lift dB；远的再低 4 dB
        base = {'day': -26, 'dusk': -27, 'night': -27}[e['light']]
        c *= db(base + e['lift'] - 4 * e['far'] - pk_rms)
        t0 = e['t'] - e['pre'] / r; n0 = int(t0 * SR)
        if n0 < 0:
            c = c[-n0:]; n0 = 0
        end = int(seg_end(e['t']) * SR)                                           # 换光那一刀之后不再响（跟画面一起切）
        c = c[:max(0, min(len(c), end - n0))]
        if len(c) > 600:
            c[-600:] *= ramp(600, 'out')
        n = len(c); tt = np.arange(n) / n
        # 左右：从窗那边（逐帧算）出发，整个过程挪 sweep
        pw = at_samples(W_PAN, n0 / SR, n); p = np.clip(pw + e['sweep'] * (tt - .5) * 2, -.85, .85)
        br = BREATH[n0:n0 + n]; br = np.pad(br, (0, n - len(br)), mode='edge') if 0 < len(br) < n else (br if len(br) else np.zeros(n, np.float32))
        gl, gr = pan_gains(p); g = db(at_samples(W_GAIN, n0 / SR, n) + br)
        out[n0:n0 + n, 0] += (c * gl * g).astype(np.float32); out[n0:n0 + n, 1] += (c * gr * g).astype(np.float32)
    return out[:N]


# ---------- 第 4 层：屋里的细节 ----------
def details():
    out = np.zeros((N + SR * 4, 2), np.float32); ev = []
    _, lxp, lbk = view(LAMP); _, kxp, _ = view(KAKA)
    sw = load('Plastic Flashlight Switch.M.wav', mono=True)
    th = load('BF Thunk On Wood.M.wav', mono=True)
    # 台灯真的开了或者关了才响一下（白天换低太阳、夜里补光调亮调暗都不响）
    clicks, on = [], LIGHT[0]['p'] in LAMP_ON
    for k in LIGHT[1:]:
        o = k['p'] in LAMP_ON
        if o != on and k['t'] < DUR:
            clicks.append(k['t'])
        on = o

    def place(c, t, pan, lv):
        c = c.astype(np.float64); w = int(.05 * SR)
        pk = 10 * np.log10(np.max(np.convolve(c * c, np.ones(w) / w, mode='valid')) + 1e-12); c *= db(lv - pk)
        n0 = int(t * SR); n = len(c); gl, gr = pan_gains(np.full(n, pan, np.float32))
        out[n0:n0 + n, 0] += (c * gl).astype(np.float32); out[n0:n0 + n, 1] += (c * gr).astype(np.float32)

    # 开关录音里有好几下：找出每一下，每次换光用不同的一下；低通 2.8 kHz，只留「嗒」的身子，不要尖
    e2 = np.convolve(np.square(sw.astype(np.float64)), np.ones(int(.03 * SR)), mode='same')
    idx = np.where(e2 > np.percentile(e2, 99.5))[0]
    grp = np.split(idx, np.where(np.diff(idx) > int(.25 * SR))[0] + 1) if len(idx) else []
    hits = [g[np.argmax(e2[g])] / SR for g in grp if len(g)] or [peak_at(sw, 0, len(sw) / SR - .3)]
    print(f'  开关录音里找到 {len(hits)} 下：' + ' '.join(f'{h:.2f}' for h in hits))
    for i, t in enumerate(clicks):
        h = hits[(i * 2 + 1) % len(hits)]
        c = sw[max(0, int((h - .04) * SR)):int((h + .35) * SR)]
        c = hp(lp(c, 2800, 4), 200); c[-int(.1 * SR):] *= ramp(int(.1 * SR), 'out')
        tt = t + .3; fi = int(tt * 24)
        place(c, tt, float(np.clip(lxp[min(fi, len(lxp) - 1)] if len(CT) > 2 else -.2, -.7, .7)), -31)
        ev.append(dict(t=round(tt, 2), kind='lamp_click', src='Plastic Flashlight Switch.M.wav', at=round(h, 2)))
    for t in SH['hops']:
        if t >= DUR:
            continue
        pk = peak_at(th, 0, len(th) / SR - .2)
        c = th[max(0, int((pk - .03) * SR)):int((pk + .5) * SR)]
        c = hp(lp(c, 1400, 4), 70); c[-int(.15 * SR):] *= ramp(int(.15 * SR), 'out')
        fi = int(t * 24)
        place(c, t, float(np.clip(kxp[min(fi, len(kxp) - 1)] if len(CT) > 2 else 0, -.5, .5)), -29)
        ev.append(dict(t=round(t, 2), kind='desk_thump', src='BF Thunk On Wood.M.wav', at=round(pk, 2)))
    return out[:N], ev


def write(path, x):
    path.parent.mkdir(parents=True, exist_ok=True)
    pk = np.max(np.abs(x))
    if pk > .7:
        x = x * (.7 / pk)
    sf.write(str(path), x.astype(np.float32), SR, subtype='FLOAT')


if __name__ == '__main__':
    print(f'机位：{CAMSRC}；长度 {DUR:.1f} 秒；换光 {len(SEGS)} 段；透口气 {len([w for w in BREATH_WINS if w[0] < DUR])} 处')
    tail = int(min(3.0, DUR / 4) * SR)
    L1 = room_tone(); L2 = bed(new=True)
    EV = plan_events(); L3 = render_events(EV); L4, DET = details()
    mix = L1 + L2 + L3 + L4; mix[-tail:] *= ramp(tail, 'out')[:, None]
    write(E / f'music/amb/{NAME}.wav', mix)
    for name, x in (('1 屋里底噪', L1), ('2 窗外底子', L2), ('3 窗外的事', L3), ('4 屋里细节', L4), ('合起来', mix)):
        print(f'  {name}: {rms(x):.1f} dB RMS')
    (E / 'out/amb4_events.json').write_text(json.dumps(dict(cam=CAMSRC, breath=[[round(a, 2), round(b, 2)] for a, b in BREATH_WINS if a < DUR],
                                                         events=EV, details=DET), ensure_ascii=False, indent=1))
    print(f'第 3 层 {len(EV)} 个：' + '，'.join(f"{e['t']:.0f}s {e['kind']}" for e in EV))
    print(f'第 4 层 {len(DET)} 下 → out/amb4_events.json；合起来 → music/amb/{NAME}.wav')
