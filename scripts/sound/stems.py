"""给达芬奇的三条分轨。  juzu.py stems   → out/stems/{vo,music,fx}.wav（48 kHz 24 bit 立体声，整片长度）和 out/mix_ref.wav
在 ffmpeg 里把电平、均衡、压缩、侧链都做好，达芬奇里三条原样相加就是成片的声音，不用再动推子。

  vo     人声 out/vo.wav：有声部分拉到 voice_rms（-20 dB RMS），高通 70 Hz，3 kHz 加 2 dB，2.5:1 轻压缩
  music  配乐 out/bed.wav（mix.py 按 plan 拼好的）：让出 2.5 kHz（-3.5 dB），整体 bed_db（-13 dB），人声出现时侧链压低（5:1）
  fx     音效：out/sfx_cues.wav（cue_fx.py）+ out/sfx_set.wav（set_fx.py）+ cues.json 里每段 ambience（ambience.py），
         环境声按各自的 at 摆好，再调到比同一时段的配乐低 under_music 个 LU（默认 7）

三条再乘同一个增益，相加正好 -16 LUFS。限幅放在增益之后（之前放在前面，总峰值冒过 0 dB）：
人声 -2 dB 起，真峰值超过 -1 dB 就一次压 1 dB，最多到 -5；配乐 -4；音效 -9（柔和音效本来就不该有尖峰）。
64 期的结果：相加 -16.2 LUFS；达芬奇出片和三条直接相加一致。

cues.json 的 levels 可以改这些数：voice_rms、bed_db、duck_ratio、sfx_db、target（-16）、tp（-1）。
用法：juzu.py stems [--to 秒]   --to 只出前面一段（比如样片的 180 秒），省时间。"""
import json, re, subprocess, sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _snd import ep, cues, Clock, ff, loudness, log  # noqa: E402

E = ep(); O = E / 'out'; S = O / 'stems'; S.mkdir(parents=True, exist_ok=True)
CK = Clock(E); C = cues(E)
LV = {'voice_rms': -20, 'bed_db': -13, 'sfx_db': 0, 'duck_ratio': 5, 'target': -16.0, 'tp': -1.0, **C.get('levels', {})}
a = sys.argv[1:]
DUR = float(a[a.index('--to') + 1]) if '--to' in a else CK.tl['duration']
DUR = min(DUR, CK.tl['duration'])

for need in ('vo.wav', 'bed.wav'):
    if not (O / need).exists():
        sys.exit(f'没有 out/{need}：人声来自配音（juzu.py tts、timeline），配乐来自 juzu.py mix')
FX = [O / n for n in ('sfx_cues.wav', 'sfx_set.wav') if (O / n).exists()]
AMB = []
for name, A in C.get('ambience', {}).items():
    if not isinstance(A, dict) or 'segments' not in A:
        continue
    p = E / f'music/amb/{name}.wav'
    if not p.exists():
        sys.exit(f'cues.json 里有环境声 {name}，但没有 music/amb/{name}.wav：先跑 juzu.py ambience')
    t0 = CK.at(A.get('at', 0)); d = float(A['dur'])
    if t0 >= DUR:
        continue
    # 量响度时去掉头尾的淡入淡出：头 1.5 秒、尾 2 秒
    AMB.append(dict(name=name, path=p, t0=t0, w0=1.5, w1=max(2.0, d - 2.0), under=float(A.get('under_music', 7))))


def voice_gain():
    import soundfile as sf
    x, _ = sf.read(O / 'vo.wav'); act = x[np.abs(x) > 0.01]
    return LV['voice_rms'] - 20 * np.log10(np.sqrt(np.mean(act ** 2)) + 1e-9)


VG = voice_gain()


def build(amb_db, vlim, gain):
    """出一遍三条分轨和它们的和，返回和的（响度，真峰值）。amb_db：每段环境声的增益。"""
    ins = ['-i', O / 'vo.wav', '-i', O / 'bed.wav', '-f', 'lavfi', '-t', f'{DUR:.3f}', '-i', 'anullsrc=r=48000:cl=stereo']
    for p in FX:
        ins += ['-i', p]
    for x in AMB:
        ins += ['-i', x['path']]
    fx_in = ['[2:a]'] + [f'[{3 + i}:a]' for i in range(len(FX))]
    chains = []
    for i in range(len(FX)):
        chains.append(f'[{3 + i}:a]aresample=48000,aformat=channel_layouts=stereo[f{i}]'); fx_in[1 + i] = f'[f{i}]'
    for k, x in enumerate(AMB):
        d = int(round(x['t0'] * 1000)); j = 3 + len(FX) + k
        chains.append(f'[{j}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={d}|{d},volume={amb_db[k]:.2f}dB[am{k}]'); fx_in.append(f'[am{k}]')
    fc = ';'.join([
        f"[0:a]aresample=48000,highpass=f=70,equalizer=f=3000:t=q:w=1:g=2,volume={VG:.2f}dB,acompressor=threshold=-18dB:ratio=2.5:attack=8:release=150,aformat=channel_layouts=stereo,asplit=2[v0][sc]",
        f"[v0]volume={gain:.3f}dB,alimiter=limit={vlim}dB:attack=3:release=60:level=false[vo]",
        f"[1:a]aresample=48000,aformat=channel_layouts=stereo,highpass=f=50,equalizer=f=2500:t=q:w=1.2:g=-3.5,volume={LV['bed_db']}dB[bq]",
        f"[bq][sc]sidechaincompress=threshold=0.02:ratio={LV['duck_ratio']}:attack=20:release=400,volume={gain:.3f}dB,alimiter=limit=-4dB:attack=5:release=80:level=false[mu]",
        *chains,
        f"{''.join(fx_in)}amix=inputs={len(fx_in)}:normalize=0:duration=first,volume={LV['sfx_db'] + gain:.3f}dB,alimiter=limit=-9dB:attack=2:release=60:level=false[fx]"])
    outs = sum((['-map', f'[{k}]', '-t', f'{DUR:.3f}', '-c:a', 'pcm_s24le', '-ar', '48000', S / f'{k2}.wav']
                for k, k2 in (('vo', 'vo'), ('mu', 'music'), ('fx', 'fx'))), [])
    r = ff('-y', *ins, '-filter_complex', fc, *outs)
    assert r.returncode == 0, r.stderr[-1500:]
    r = ff('-y', '-i', S / 'vo.wav', '-i', S / 'music.wav', '-i', S / 'fx.wav', '-filter_complex',
           '[0:a][1:a][2:a]amix=inputs=3:normalize=0:duration=longest', '-c:a', 'pcm_s24le', S / '_sum.wav')
    assert r.returncode == 0, r.stderr[-800:]
    I, TP, _ = loudness(S / '_sum.wav')
    return I, TP


# 1) 有环境声的话，先按 0 dB 出一遍，量每段环境声那里的配乐有多响，定环境声的电平
amb_db = [0.0] * len(AMB)
if AMB:
    build(amb_db, -2.0, 0.0)
    for k, x in enumerate(AMB):
        mus, _, _ = loudness(S / 'music.wav', x['t0'] + x['w0'], x['w1'] - x['w0'])
        amb, _, _ = loudness(x['path'], x['w0'], x['w1'] - x['w0'])
        amb_db[k] = (mus - x['under']) - amb
        print(f"  环境声 {x['name']}：那一段配乐 {mus} LUFS，环境声原文件 {amb} LUFS → 增益 {amb_db[k]:+.1f} dB（低 {x['under']} LU）")
# 2) 再出一遍量总响度，三条一起乘增益到目标；真峰值超了就把人声的限幅线压低重来
T, TPmax = LV['target'], LV['tp']
I, TP = build(amb_db, -2.0, 0.0); gain = T - I; vlim = -2.0
for _ in range(6):
    I, TP = build(amb_db, vlim, gain)
    print(f'  试：增益 {gain:+.2f} dB、人声限幅 {vlim} dB → {I} LUFS，真峰值 {TP} dB')
    if TP <= TPmax and abs(I - T) < .3:
        break
    if TP > TPmax and vlim > -5.0:
        vlim -= 1.0          # 压到 -5 还超，多半是配乐太响：回去调 cues.json 的 plan gain 或 levels.bed_db
    gain += T - I
(S / '_sum.wav').replace(O / 'mix_ref.wav')
per = {k: loudness(S / f'{k}.wav')[0] for k in ('vo', 'music', 'fx')}
msg = (f'分轨 out/stems：三条相加 {I} LUFS，真峰值 {TP} dB；总增益 {gain:+.2f} dB，人声限幅线 {vlim} dB，人声增益 {VG:+.1f} dB；'
       f'各条 人声 {per["vo"]}、配乐 {per["music"]}、音效 {per["fx"]} LUFS' + (f'；只出了前 {DUR:.0f} 秒' if DUR < CK.tl['duration'] else ''))
for k, x in enumerate(AMB):
    mi, _, _ = loudness(S / 'music.wav', x['t0'] + x['w0'], x['w1'] - x['w0']); fi, _, _ = loudness(S / 'fx.wav', x['t0'] + x['w0'], x['w1'] - x['w0'])
    msg += f'；{x["name"]} 段配乐 {mi}、音效轨 {fi} LUFS'
print(msg); log(E, '6-剪辑出片', msg)
if TP > TPmax:
    print(f'真峰值还是超过 {TPmax} dB。多半是配乐某段太响（比如开场那段 plan gain 给大了），回去改 cues.json 再跑。')
    sys.exit(1)
