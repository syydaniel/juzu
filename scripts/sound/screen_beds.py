"""给配乐候选打客观分，只做初筛，定下来靠用户的耳朵。  juzu.py screen_beds [文件 …]   不写就看 music/cands/ 里的全部
文件名是 <段名>_<种子>.wav。cues.json 里 role 是 open 的那段（开场）多看三样「起伏、高潮在、循环感5秒」。

铺底看这些（数是 64 期挑出来的，后面括号是淘汰的例子）：
  拍子感    见 pulse.py，越低越平缓；0.4 以上提醒（close 第三版 0.44 没用）
  频宽kHz   85% 的能量在这个频率以下，太低就闷（旧的 turbo 开场 85% 的能量在 100 Hz 以下）
  人声带    1 到 4 kHz 的能量占比（%），铺底在这里越少越不抢人声；30 以上提醒（close_3102 是 37）
  高频毛刺  8 kHz 以上能量逐帧抖动的程度，低步数常见的沙沙声会让它偏高；0.8 以上提醒（now_3101 是 1.08，turbo 开场 1.51）
  断掉秒    中途响度掉到 -50 dB 以下的总秒数（结尾 3 秒和结尾连着的淡出不算）；4 秒以上提醒（开场 B1 是 7.7，第 22 秒断掉；
            选中的铺底也有 1 到 3 秒，安静的长音本来就会掉下去）
  突变次数  1 秒内响度跳 9 dB 以上的次数；循环感：响度包络在 4 到 20 秒间隔上的最大自相关。这两个只在同一段的候选之间比，
            不做提醒：64 期选中的 toy_4101 突变 185 次，比淘汰的 toy_3101（138）还多，安静、有呼吸的铺底这个数天然就大
  最亮dB    15 秒一窗，6 到 12 kHz 比 100 Hz 到 2 kHz 低几 dB，取最亮的一窗，最亮在 = 那一窗从第几秒起；-15 以上提醒
            （65 期 crew_b_6601 最后 45 秒冒出沙锤一类的声音，-11，作者说过配乐刺耳；64 期用上的铺底做完母带都在 -18.8 以下）。
            被提醒但别的都好，可以不换：在 cues.json 这一段写 "eq": "highshelf=f=5000:g=-6"，master_beds 会压下去
开场另看：
  起伏      前 6 秒和最响 10 秒的响度差（dB），越大越有「从安静到展开」的感觉（选中的 A3 是 27）
  高潮在    最响的 2 秒落在第几秒
  循环感5秒 相隔 5 秒的两段响度包络有多像（旧的 turbo 开场 0.75，原地打转）

这几条提醒线是拿 64 期的候选对出来的：淘汰的都会被提醒（拍子感 0.53 到 0.89、人声带 37、毛刺 1.08、断掉 4.4 到 7.7 秒），
选中的都不会（拍子感 0.28 以下，断掉 3.1 秒以下）。

停点：每段铺底挑 2 到 3 个机器没提醒的候选给用户听，用户定。"""
import json, sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _snd import read_mono, cues  # noqa: E402
from pulse import pulse, files_from_args  # noqa: E402

LIMITS = {'拍子感': (0.4, '拍子感偏强'), '人声带': (30, '抢人声'), '高频毛刺': (0.8, '有沙沙声'), '断掉秒': (4, '中间断了'), '最亮dB': (-15, '有一段偏亮')}


def bed_metrics(f):
    x, sr = read_mono(f, 24000); hop = sr // 10
    db = 20 * np.log10(np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) + 1e-9 for i in range(0, len(x) - hop, hop)]))
    n = 2048; win = np.hanning(n)
    S = np.array([np.abs(np.fft.rfft(x[i:i + n] * win)) for i in range(0, len(x) - n, n)]); fr = np.fft.rfftfreq(n, 1 / sr)
    e = (S ** 2).sum(0); c = np.cumsum(e) / e.sum(); roll = fr[np.searchsorted(c, .85)] / 1000
    voice = e[(fr > 1000) & (fr < 4000)].sum() / e.sum() * 100
    hf = S[:, fr > 8000].sum(1); jitter = float(np.mean(np.abs(np.diff(hf))) / (np.mean(hf) + 1e-9))
    hi = (S[:, (fr > 6000) & (fr < 12000)] ** 2).sum(1); lo = (S[:, (fr > 100) & (fr < 2000)] ** 2).sum(1) + 1e-12
    w = max(1, int(15 * sr / n)); st = max(1, w // 3)
    br = [10 * np.log10(hi[i:i + w].sum() / lo[i:i + w].sum() + 1e-12) for i in range(0, max(1, len(hi) - w), st)]; kb = int(np.argmax(br))
    body = db[: max(1, len(db) - 30)]; sm = np.convolve(body, np.ones(5) / 5, 'same')
    jumps = int(sum(1 for i in range(len(sm) - 10) if sm[i + 10] - sm[i] > 9))
    run, cut = 0, len(db)   # 从后往前找最后一段连着 1 秒有声的地方，那以后算淡出，不算断（65 期三条候选因此被误报）
    for i in range(len(db) - 1, -1, -1):
        run = run + 1 if db[i] >= -50 else 0
        if run >= 10:
            cut = i + 10; break
    gap = float(np.sum(db[30: min(cut, len(db) - 30)] < -50) / 10)
    env = sm - sm.mean()
    lags = range(40, min(200, len(env) // 2), 5)
    ac = max((float(np.corrcoef(env[:-l], env[l:])[0, 1]) for l in lags), default=0.0)
    return dict(时长=round(len(x) / sr), 频宽kHz=round(float(roll), 2), 人声带=round(float(voice), 1), 高频毛刺=round(jitter, 2),
                突变次数=jumps, 断掉秒=gap, 循环感=round(ac, 2), 平均dB=round(float(np.mean(body)), 1),
                最亮dB=round(float(br[kb]), 1), 最亮在=int(kb * st * n / sr)), db


def open_metrics(db):
    L = min(len(db), 340); db = db[:L]
    if L < 120:
        return {}
    loud10 = max(np.mean(db[i:i + 100]) for i in range(0, L - 100)); quiet = np.mean(db[:60])
    peak_at = int(np.argmax([np.mean(db[i:i + 20]) for i in range(0, L - 20)])) / 10 + 1
    lag = 50; a, b = db[60:L - lag], db[60 + lag:L]; loop = float(np.corrcoef(a, b)[0, 1]) if len(a) > 20 else 0
    return dict(起伏=round(float(loud10 - quiet), 1), 高潮在=peak_at, 循环感5秒=round(loop, 2))


if __name__ == '__main__':
    files = files_from_args(sys.argv[1:])
    try:
        from _snd import ep
        beds = cues(ep()).get('beds', {})
    except SystemExit:
        beds = {}
    for f in files:
        name = f.stem.rsplit('_', 1)[0]
        m, db = bed_metrics(f); p = pulse(f)
        row = dict(文件=f.name, 拍子感=p['拍子感'], **m)
        if beds.get(name, {}).get('role') == 'open':
            row.update(open_metrics(db))
        flags = [why for k, (lim, why) in LIMITS.items() if row.get(k, 0) > lim]
        row['提醒'] = '、'.join(flags) or '没有'
        print(json.dumps(row, ensure_ascii=False))
