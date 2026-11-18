"""去掉 ACE-Step 解码器留下的「哨音」：2.5 到 18 kHz 里几条一直不变的细线（65 期作者说配乐刺耳，查出来的根子之一）。
做法：整段铺底做一次 STFT，每个频点取全曲 20% 分位的「底」，比左右 ±240 Hz 的中位数高出 6 dB 以上的尖峰当作哨音，
在这几个频点上做固定的陷波（最多压 24 dB，两边各带两格渐变）。只动这些细线，音乐本身的高频跟着旋律走，不受影响。
  python despur.py in.wav out.wav       单独跑；master_beds.py 会自动先过这一步"""
import sys
import numpy as np
import soundfile as sf
from scipy.ndimage import median_filter
from scipy.signal import find_peaks

from scipy.ndimage import median_filter
from scipy.signal import find_peaks

NF, HOPS = 4096, 1024
LO, HI, THR, CAP = 2500, 18000, 6.0, 24.0


def stft(x):
    w = np.hanning(NF)
    pad = np.pad(x, (NF, NF))
    n = 1 + (len(pad) - NF) // HOPS
    idx = (np.arange(n) * HOPS)[:, None] + np.arange(NF)[None]
    return np.fft.rfft(pad[idx] * w, axis=1), len(x)


def istft(Z, L):
    w = np.hanning(NF)
    fr = np.fft.irfft(Z, NF, axis=1) * w
    n = Z.shape[0]; out = np.zeros((n - 1) * HOPS + NF); wsum = np.zeros_like(out)
    for i in range(n):
        out[i * HOPS:i * HOPS + NF] += fr[i]; wsum[i * HOPS:i * HOPS + NF] += w ** 2
    out /= np.maximum(wsum, 1e-8)
    return out[NF:NF + L]


def mask_for(x, sr):
    fr = np.fft.rfftfreq(NF, 1 / sr)
    P = sum(np.abs(stft(x[:, c])[0]) ** 2 for c in range(x.shape[1])) / x.shape[1]
    L = 10 * np.log10(P + 1e-12)
    floor = np.percentile(L, 20, axis=0)                 # stationary floor per bin over the whole bed
    ex = floor - median_filter(floor, 41)               # excess over +-240 Hz neighbourhood
    g = np.zeros_like(ex)
    band = (fr > LO) & (fr < HI)
    pk, _ = find_peaks(np.where(band, ex, 0), height=THR, distance=2)
    for i in pk:
        cut = min(CAP, ex[i] - 2.0)
        for j, k in ((i, 1.0), (i - 1, 0.7), (i + 1, 0.7), (i - 2, 0.3), (i + 2, 0.3)):
            g[j] = min(g[j], -cut * k)
    return 10 ** (g / 20), fr, pk, ex


def despur(src, dst):
    """读 src，去哨音，写 32 位浮点到 dst；返回 (去掉几条, 最强几条的说明)。"""
    x, sr = sf.read(str(src), always_2d=True, dtype='float64')
    m, fr, pk, ex = mask_for(x, sr)
    y = np.stack([istft(stft(x[:, c])[0] * m[None], len(x)) for c in range(x.shape[1])], 1)
    sf.write(str(dst), y.astype(np.float32), sr, subtype='FLOAT')
    top = ', '.join(f'{fr[i] / 1000:.2f}k -{min(CAP, ex[i] - 2):.0f}dB' for i in sorted(pk, key=lambda i: -ex[i])[:4])
    return len(pk), top


if __name__ == '__main__':
    n, top = despur(sys.argv[1], sys.argv[2]); print(f'去掉 {n} 条哨音；最强：{top}')
