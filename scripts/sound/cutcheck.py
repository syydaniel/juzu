"""切音检查（75 期作者：「最后要去检查一下，有没有突然间截断的音」）。  juzu.py cutcheck [音频 …]
不写文件就查这一集：
  1. vo/me 里每一句的句尾：去掉末尾的数字静音，最后 5 毫秒还高于 -45 dBFS，就是被截断又没淡出（tts 存成品时尾巴会淡 30 毫秒）
  2. out/vo.wav（整条配音）：每段完全为零的静音（句间停顿、逗号处插的停顿），前后 10 毫秒高于 -50 dBFS 算硬切
  3. 成片的混音（out/mix_ref.wav，或者给的文件，比如从成片里抽出来的音轨）：10 毫秒之内从 -35 dBFS 以上掉到 -65 以下的地方
     （配乐、环境声、人声被剪断都会这样；片尾最后 3 秒的淡出不算）
有问题的列出秒数，最后一行是总数；没问题退出码 0，有问题 1。"""
import sys, json
from pathlib import Path
import numpy as np, soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _snd import ep  # noqa: E402


def mono(p):
    x, sr = sf.read(p, always_2d=True)
    return x.mean(1), sr


def db(seg):
    return 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-12) if len(seg) else -200.0


def line_ends(E, lim=-45):
    bad = []
    for p in sorted((E / 'vo/me').glob('*.wav')):
        x, sr = mono(p); nz = np.where(np.abs(x) > 1e-4)[0]
        if not len(nz):
            continue
        # 成品句尾已经淡过 30 毫秒，只看最后 5 毫秒：淡过的在 -60 以下，没淡、被截断的还在 -45 以上
        e = nz[-1] + 1; lv = db(x[max(0, e - int(.005 * sr)):e])
        if lv > lim:
            bad.append(f'{p.stem} 句尾 {lv:.0f} dBFS')
    return bad


def zero_edges(p, lim=-50):
    x, sr = mono(p); z = (np.abs(x) < 1e-6).astype(np.int8)
    d = np.diff(np.concatenate([[0], z, [0]])); s, e = np.where(d == 1)[0], np.where(d == -1)[0]
    n = int(.01 * sr); bad = []
    for a, b in zip(s, e):
        if b - a < .02 * sr:
            continue
        pre, post = db(x[max(0, a - n):a]), db(x[b:b + n])
        if b < len(x) and (pre > lim or post > lim):
            bad.append(f'{a / sr:7.2f} 秒  静音前 {pre:.0f} / 后 {post:.0f} dBFS')
    return bad


def drops(p, hi=-35, lo=-65, tail=3.0):
    x, sr = mono(p); h = int(.005 * sr); n = len(x) // h
    lv = 20 * np.log10(np.sqrt((x[:n * h].reshape(n, h) ** 2).mean(1)) + 1e-12)
    bad, last = [], -1
    for i in range(4, n - 2):
        t = i * h / sr
        if t > n * h / sr - tail:
            break
        if lv[i - 4:i - 1].mean() > hi and lv[i:i + 2].max() < lo and t - last > .2:
            bad.append(f'{t:7.2f} 秒  {lv[i - 4:i - 1].mean():.0f} → {lv[i:i + 2].max():.0f} dBFS'); last = t
    return bad


if __name__ == '__main__':
    files = [a for a in sys.argv[1:] if not a.startswith('--')]
    total = 0
    if files:
        for f in files:
            b = drops(f); total += len(b); print(f'{f}：急停 {len(b)} 处'); print('\n'.join('  ' + x for x in b[:40]))
    else:
        E = ep()
        b = line_ends(E); total += len(b); print(f'句尾截断 {len(b)} 句'); print('\n'.join('  ' + x for x in b))
        if (E / 'out/vo.wav').exists():
            b = zero_edges(E / 'out/vo.wav'); total += len(b); print(f'整条配音里静音两边硬切 {len(b)} 处'); print('\n'.join('  ' + x for x in b))
        if (E / 'out/mix_ref.wav').exists():
            b = drops(E / 'out/mix_ref.wav'); total += len(b); print(f'混音急停 {len(b)} 处'); print('\n'.join('  ' + x for x in b[:40]))
    print('切音检查：', '没有问题' if not total else f'{total} 处要听一下')
    sys.exit(1 if total else 0)
