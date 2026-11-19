"""重配一句以后保住它在时间线上的位置，画面不用重渲：  juzu.py keep_slot <键> [--end]
什么时候用：成片已经渲好，作者听出某一句念错了一个字（66 期：「三五行」的行要念 háng），只想重配这一句。
顺序：改稿（多音字在 SAY 里写成同音字，字幕不变）→ juzu tts <键> → juzu keep_slot <键> → juzu timeline → juzu tl → 混音和分轨 → 达芬奇出片。
做的事：读现在的 app/src/timeline.json 里这一句原来占多长（这时候还没重排时间线），把新的那一遍补上静音，
  默认平均分到句子中间那几处停顿里（逗号、句号附近找到的静音），--end 全放在句尾；新的一遍比原来长，就剪句尾的静音。
  补完按 timeline 的算法再加一遍逗号停顿，差多少再补多少，直到这一句排进时间线以后和原来一样长，后面的句子一帧都不动。
新的一遍比原来长、句尾又没有那么多静音可剪：会报错，多念几遍（tts <键> 会接着往后念），挑一遍短一点的写进 episode.json 的 voice.force。
画面上这一句的字幕和关键词按字数比例排，会挪几十毫秒；小卡在镜头里的话，嘴型跟着新配音变了，补渲这一句覆盖的那几块（film.mjs 跳过已经渲好的块，删掉那几块再跑）。"""
import json, sys
from pathlib import Path
import numpy as np, soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
from common import ep, load_lines, log
from pauses import params, widen, SR

E = ep(); args = [a for a in sys.argv[1:] if not a.startswith('--')]
if len(args) != 1:
    sys.exit(__doc__)
k = args[0]; END = '--end' in sys.argv
LINES, _ = load_lines(E)
TL = json.load(open(E / 'app/src/timeline.json'))
if k not in TL['lines'] or k not in LINES:
    sys.exit(f'时间线或口播稿里没有 {k}')
old = TL['lines'][k]; target = round(old['end'] - old['start'], 3); goal = int(round(target * SR))
choice = json.load(open(E / 'vo/me/choice.json'))
f = E / choice[k]['file']; tts = LINES[k][1]
_, _, _, P_IN, P_CM = params(E)
a, sr = sf.read(f); assert sr == SR, sr
if a.ndim > 1: a = a.mean(1)
picked = abs(len(a) / SR - choice[k]['dur']) < .002
if not picked:
    print(f'提醒：{f.name} 和 choice.json 里记的长度（{choice[k]["dur"]} 秒）对不上，可能已经对齐过一次了；照现在的文件接着对')
w, ins = widen(a, tts, P_IN, P_CM)
if abs(len(w) - goal) < SR * .001:
    sys.exit(f'{k} 现在排进去就是 {target} 秒，不用改（要是已经跑过 timeline，这里读到的就是新长度：先把 app/src/timeline.json 换回重配之前的）')
need = goal - int(round(sum(d for _, d in ins) * SR))
print(f'{k}：时间线上原来 {target:.3f} 秒；新的这一遍 {len(a) / SR:.3f} 秒，逗号处会加 {sum(d for _, d in ins):.2f} 秒，差 {(need - len(a)) / SR:+.3f} 秒')

spread = need > len(a) and bool(ins) and not END
if spread:                                         # 多出来的分到句中的停顿里
    per = (need - len(a)) // len(ins); out, last = [], 0
    for at, _ in ins:
        j = int(at * SR); out += [a[last:j], np.zeros(per, a.dtype)]; last = j
    out.append(a[last:]); a = np.concatenate(out)
    print(f'  分到 {len(ins)} 处停顿里，每处多 {per / SR:.3f} 秒')


def fit(n):
    if n >= len(a):
        return np.concatenate([a, np.zeros(n - len(a), a.dtype)])
    cut = a[n:]; lvl = 20 * np.log10(np.sqrt(np.mean(cut ** 2)) + 1e-9)
    if lvl > -45:
        sys.exit(f'新的这一遍太长：要剪掉句尾 {len(cut) / SR:.2f} 秒，但那里有声音（{lvl:.0f} dB）。多念几遍（tts {k}），挑短一点的写进 voice.force')
    b = a[:n].copy(); r = min(len(b), int(.02 * SR)); b[-r:] *= np.linspace(1, 0, r); return b


n = len(a) if spread else need
for _ in range(8):                                   # 补了静音以后，逗号按比例找到的位置会挪，加停顿的地方可能变：差多少再补多少
    b = fit(n); wb, _i = widen(b, tts, P_IN, P_CM); err = len(wb) - goal
    if abs(err) < SR * .001:
        break
    n -= err
else:
    sys.exit(f'对不上：差 {err / SR:+.3f} 秒，换一遍再试')
sf.write(f, b, SR)
msg = f'keep_slot {k}：新的一遍 {choice[k]["dur"]} 秒 → {len(b) / SR:.3f} 秒，排进时间线 {len(wb) / SR:.3f} 秒（原来 {target:.3f}）'
print(msg + '。接着跑 timeline、tl、混音和分轨；小卡在镜头里的话补渲这一句覆盖的几块画面')
log(E, '2-配音', msg)
