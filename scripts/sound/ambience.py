"""环境声：用现成的真实录音，分层、按距离处理、跟着画面硬切。  juzu.py ambience   → music/amb/<名字>.wav
  juzu.py ambience --find train steam     在音效库里按文件名找录音（英文词，可以写几个）
  juzu.py ambience --only montage         只做其中一段

作者的话：环境音效可以去网上找现成的，或者在达芬奇里面找，但是都要做好混音。不要用代码合成风声、火车声，听得出来。

录音放哪：
- 自己下载的放进这一集的 sfx/lib/，旁边写一份 来源.md（网址、许可）。很多免费音效站允许商用，但不许把原文件单独再分发，
  所以 sfx/lib 不能进任何公开仓库，skill 里也不带任何声音文件。
- 达芬奇自带的 Fairlight 音效库（config 里 ambience_dirs 的默认值）。64 期查过：那里没有火车、风、发动机，这些要去网上找。

cues.json 的写法（一段画面一个 clip，时间是这段画面里的秒数，0 是 clip 开头）：
  "ambience": {
    "montage": {
      "at": "a03$+0.4",       这段环境声在片子里从哪开始（时间写法），stems.py 按它摆
      "dur": 30,
      "segments": [            每段对应一个画面镜头，to 是下一个切点
        {"from": 0, "to": 7.6, "fade_in": 1.2, "layers": [
          {"role": "bed", "file": "wind_mountain_top.wav", "start": 2.0, "level": -23}]},
        {"from": 7.6, "to": 15.1, "layers": [
          {"role": "main",   "file": "old_train_departure.wav", "start": 59.5, "level": -21},
          {"role": "detail", "file": "train_passing_rattle.wav", "start": 7.0, "level": -26, "highpass": 80}]}
      ]
    }
  }
每层：file 录音文件名；start 从录音的第几秒开始读（预卷的 pre 秒也算在里面）；level 这一层在这段里的 RMS（dB），用来对齐各层；
  role 只是给人看的：bed 底子（风、沙漠），main 主体（火车喷气、发动机），detail 点缀（铁轨咔哒、悬挂响）；
  可选 highpass / lowpass（Hz）、semitones（变调，正数升、负数降，长度不变）、
  distance [[秒, 米], …]（秒是相对这段切点的时间；主体到镜头的距离，按它做音量和高频：远处闷、近了亮）、
  hits [{"at": 相对切点的秒, "src": 录音里的第几秒, "len": 0.7, "gain": 0.5}]（一下一下的点缀，不是连续铺）。
dur、from、to 也可以写时间写法（"d01"、"f03-0.2"、"DUR"），按片子里的绝对时刻换算成这段里的秒数（减去 at）；数字照旧是段内秒数。
切点处跟画面一起硬切（40 毫秒交叉），下一段提前 pre 秒（默认 0.2）开始淡入；第一段 pre 是 0，不然开头会空一下。
整段最后 fade_out 秒（默认 2）淡出，统一到 lufs（默认 -24 LUFS）。在分轨里再摆到比配乐低 under_music 个 LU（默认 7），见 stems.py。"""
import json, subprocess, sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _snd import SR, ep, cues, write, find_lib, search_lib, lib_dirs, log, Clock  # noqa: E402

PRE, TAIL = 0.2, 0.04
NEAR, FAR = (9.0, 9000.0), (140.0, 1100.0)   # 距离 → 高频截止：9 米 9 kHz，140 米 1.1 kHz（64 期按沙漠里冲过来的车调的）
REF_M = 12.0                                 # 距离 12 米时音量不变，更远按 12/距离 衰减


def _f():
    from scipy.signal import butter, sosfilt, resample_poly
    return butter, sosfilt, resample_poly


def lp(x, f, o=2):
    butter, sosfilt, _ = _f(); return sosfilt(butter(o, f, 'lowpass', fs=SR, output='sos'), x, axis=0)


def hp(x, f, o=2):
    butter, sosfilt, _ = _f(); return sosfilt(butter(o, f, 'highpass', fs=SR, output='sos'), x, axis=0)


def norm_rms(x, db):
    return x / (np.sqrt(np.mean(x ** 2)) + 1e-12) * 10 ** (db / 20)


def tvlp(x, fc):
    """随时间变化的一阶低通（逐样本）：远处的声音高频被空气吃掉。fc 是每个样本的截止频率。"""
    a = np.exp(-2 * np.pi * fc / SR); y = np.zeros_like(x); z = np.zeros(x.shape[1])
    for i in range(len(x)):
        z = (1 - a[i]) * x[i] + a[i] * z; y[i] = z
    return y


def load(path, a0, d, semis=0.0):
    """读录音 a0 秒起的 d 秒，转成 48 kHz 立体声，低切 35 Hz。semis 变调（用重采样，长度不变；正数升，负数降）。"""
    import soundfile as sf
    _, _, resample_poly = _f()
    x, sr = sf.read(path, always_2d=True)
    if x.shape[1] == 1:
        x = np.repeat(x, 2, 1)
    x = x[:, :2]
    k = 2 ** (-semis / 12)                         # 升调：读更长一段（d/k 秒）再压回 d 秒
    seg = x[int(a0 * sr): int((a0 + d / k) * sr) + 2]
    up, down = (160, 147) if sr == 44100 else (SR, sr)
    y = resample_poly(seg, up, down, axis=0)
    if semis:
        y = resample_poly(y, 1000, int(round(1000 / k)), axis=0)
    n = int(d * SR); y = y[:n]
    if len(y) < n:
        print(f'  提醒：{Path(path).name} 从 {a0} 秒起不够 {d:.1f} 秒，后面补了静音')
        y = np.pad(y, ((0, n - len(y)), (0, 0)))
    return hp(y, 35)


def layer(L, d, t0, e):
    """做一层，长 d 秒；t0 是这层第一个样本对应的「段内时间」（切点是 0，预卷是负数）。"""
    path = find_lib(L['file'], e)
    if L.get('hits'):                              # 一下一下的点缀
        n = int(d * SR); out = np.zeros((n, 2))
        for h in L['hits']:
            ln = h.get('len', 0.7)
            seg = load(path, h.get('src', 0), ln) * np.hanning(int(ln * SR))[:, None] ** .3
            if L.get('lowpass'):
                seg = lp(seg, L['lowpass'])
            seg = norm_rms(seg, L.get('level', -27)) * h.get('gain', 1.0)
            i = int((h['at'] - t0) * SR); j = min(n, i + len(seg))
            if 0 <= i < n:
                out[i:j] += seg[: j - i]
        return out
    x = load(path, L.get('start', 0), d, L.get('semitones', 0))
    if L.get('highpass'):
        x = hp(x, L['highpass'])
    if L.get('lowpass'):
        x = lp(x, L['lowpass'])
    if L.get('distance'):
        k = np.array(L['distance'], float); tc = np.arange(len(x)) / SR + t0
        dist = np.interp(tc, k[:, 0], k[:, 1])
        x = tvlp(x * (REF_M / dist)[:, None], np.interp(dist, [NEAR[0], FAR[0]], [NEAR[1], FAR[1]]))
    return norm_rms(x, L.get('level', -24))


def place(dst, src, at, fin=PRE, fout=TAIL, pre=None):
    """把一段贴到 at 秒：提前 pre 秒（默认等于 fin）开始，fin 秒淡入，结尾 fout 秒淡出。"""
    pre = fin if pre is None else pre
    i = int(round((at - pre) * SR)); m = len(src); w = np.ones(m); a = int(fin * SR); b = int(fout * SR)
    if a:
        w[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    if b:
        w[-b:] = np.cos(np.linspace(0, np.pi / 2, b)) ** 2
    s = max(0, i); dst[s:i + m] += (src * w[:, None])[s - i: len(dst) - i]


def clip(name, A, e):
    END = float(A['dur']); N = int(END * SR); out = np.zeros((N, 2)); segs = A['segments']
    for k, sg in enumerate(segs):
        first, last = k == 0, k == len(segs) - 1
        pre = sg.get('pre', 0.0 if first else A.get('pre', PRE))
        fin = sg.get('fade_in', pre if not first else 0.0)
        fout = sg.get('fade_out', A.get('fade_out', 2.0) if last else TAIL)
        to = min(float(sg['to']), END) if 'to' in sg else END
        d = to - float(sg['from']) + pre + (0 if last else TAIL)
        seg = np.zeros((int(d * SR), 2))
        for L in sg['layers']:
            seg += layer(L, d, -pre, e)
        place(out, seg, float(sg['from']), fin=fin, fout=fout, pre=pre)
        names = ' + '.join(L.get('role', '') + ':' + Path(L['file']).stem for L in sg['layers'])
        print(f"  {sg['from']:>6} → {to:<6} {names}")
    fo = int(A.get('fade_out', 2.0) * SR)
    if fo:
        out[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2
    target = A.get('lufs', -24)
    tmp = e / f'music/amb/_{name}_raw.wav'; write(tmp, out.astype(np.float32), SR, 'FLOAT')
    m = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(tmp), '-af', f'loudnorm=I={target}:TP=-6:LRA=20:print_format=json',
                        '-f', 'null', '-'], capture_output=True, text=True).stderr
    j = json.loads(m[m.rindex('{'):m.rindex('}') + 1]); g = target - float(j['input_i']); tmp.unlink()
    write(e / f'music/amb/{name}.wav', (out * 10 ** (g / 20)).astype(np.float32), SR, 'PCM_24')
    return float(j['input_i']), g


if __name__ == '__main__':
    E = ep(); a = sys.argv[1:]
    if a and a[0] == '--find':
        hits = search_lib(a[1:], E)
        print(f'在 {[str(d) for d in lib_dirs(E)]} 里找「{" ".join(a[1:])}」：{len(hits)} 个')
        for q in hits[:80]:
            print(' ', q.name)
        sys.exit(0)
    only = a[a.index('--only') + 1] if '--only' in a else None
    AMB = cues(E).get('ambience', {})
    AMB = {k: v for k, v in AMB.items() if isinstance(v, dict) and 'segments' in v and (only is None or k == only)}
    if not AMB:
        sys.exit('cues.json 里没有 ambience（写法见这个脚本开头的说明）')
    CK = None
    for name, A in AMB.items():
        if any(isinstance(v, str) for v in [A.get('dur')] + [sg.get(k) for sg in A['segments'] for k in ('from', 'to')]):   # 66 号：时间写法
            CK = CK or Clock(E); t0 = CK.at(A.get('at', 0)); rel = lambda v: CK.at(v) - t0 if isinstance(v, str) else v
            A = {**A, 'dur': rel(A['dur']), 'segments': [{**sg, **{k: round(rel(sg[k]), 3) for k in ('from', 'to') if k in sg}} for sg in A['segments']]}
        print(f'{name}：{A["dur"]} 秒，放在片子的 {A.get("at", "0")}')
        try:
            I, g = clip(name, A, E)
        except FileNotFoundError as err:
            sys.exit(str(err))
        msg = f'环境声 music/amb/{name}.wav：{len(A["segments"])} 段，原响度 {I:.1f} LUFS → {A.get("lufs", -24)}，增益 {g:+.1f} dB'
        print(msg); log(E, '5-拟音', msg)
    print('先单独听 music/amb/ 里的文件，再跑 stems.py 摆进分轨（比配乐低 under_music 个 LU）。')
