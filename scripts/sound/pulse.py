"""量配乐的「拍子感」：越低越平缓。  juzu.py pulse [文件 …]   不写文件就量 music/cands/ 里的全部候选
拍子感：起音强度包络在 0.3 到 1.5 秒间隔上的自相关峰值（0 到 1）。有规律的鼓点、拨弦、八分音符钢琴会让它变高。
另外给出：拍长（自相关峰值落在几秒），起音每秒（明显起音的个数），LRA（响度范围），I（整体响度）。

64 期的数（作者嫌第二版「节奏感太强」以后重做）：explain 0.85 → 0.31，toy 0.65 → 0.21，now 0.73 → 0.23；
close 的第三版 0.44 反而比第二版 0.28 强，就留了第二版。所以铺底大约 0.35 以下算平缓，0.4 以上要先听一下再说。"""
import json, sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _snd import read_mono, loudness  # noqa: E402


def pulse(f):
    x, sr = read_mono(f, 22050); n = 1024; hop = 220; win = np.hanning(n)
    S = np.array([np.abs(np.fft.rfft(x[i:i + n] * win)) for i in range(0, len(x) - n, hop)]); L = np.log1p(S * 10)
    flux = np.maximum(np.diff(L, axis=0), 0).sum(1)
    flux = np.maximum(flux - np.convolve(flux, np.ones(100) / 100, 'same'), 0)
    fps = sr / hop; f0 = flux - flux.mean(); ac = np.correlate(f0, f0, 'full')[len(f0) - 1:]; ac /= ac[0]
    lo, hi = int(.3 * fps), int(1.5 * fps); k = lo + int(np.argmax(ac[lo:hi]))
    thr = flux.mean() + 2.5 * flux.std()
    peaks = np.sum((flux[1:-1] > thr) & (flux[1:-1] > flux[:-2]) & (flux[1:-1] >= flux[2:]))
    I, _, lra = loudness(f)
    return dict(拍子感=round(float(ac[k]), 2), 拍长秒=round(k / fps, 2), 起音每秒=round(float(peaks) / (len(x) / sr), 2), LRA=lra, I=I)


def files_from_args(args):
    if args:
        return [Path(f) for f in args]
    from _snd import ep
    return sorted((ep() / 'music/cands').glob('*.wav'))


if __name__ == '__main__':
    for f in files_from_args(sys.argv[1:]):
        print(json.dumps(dict(文件=f.name, **pulse(f)), ensure_ascii=False))
