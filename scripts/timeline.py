"""把配音排成时间线：  juzu.py timeline
输出 app/src/timeline.json（画面、混音、字幕都只认这一个时钟）和 out/vo.wav（整条配音）。
  juzu.py timeline --draft   还没配音时，按字数估每句的时长，先把画面做起来（不出 vo.wav）。配完音必须再跑一遍正式的。"""
import json, re, sys
from pathlib import Path
import numpy as np, soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
from common import cfg, ep, load_lines, wlen, log

E = ep()
LINES, CHAPTERS = load_lines(E)
DRAFT = '--draft' in sys.argv
if not DRAFT:
    choice = json.load(open(E / 'vo/me/choice.json'))
    miss = [k for k in LINES if k not in choice or choice[k].get('text') != LINES[k][1]]
    assert not miss, f'这些句子还没配音或者文本改过了，先跑 tts：{miss}'
FPS, LEAD, TAIL, SR = 30, 0.35, 7.0, 24000   # 片头留白、片尾卡时长
# 气口（65 期作者：「文字和文字之间的气口可以稍微再长一点，显得没有那么仓促」）。episode.json 里 "pause" 可以改：
#   scale / min：句与句之间停 max(min, 句后停顿 × scale)；section：换章节时至少停这么久；
#   inner：一句里面有句号、问号、感叹号的地方，在那附近找一段静音，再多停这么久（找不到够长的静音就不加，免得切到字）
PZ = json.load(open(E / 'episode.json')).get('pause', {}) if (E / 'episode.json').exists() else {}
P_SCALE, P_MIN, P_SEC, P_IN = PZ.get('scale', .72), PZ.get('min', .18), PZ.get('section', 0), PZ.get('inner', 0)


def widen(a, tts):
    """一句里的句号处多停 P_IN 秒。返回新音频和插进去的位置 [(原来的秒, 加了几秒)]。"""
    if not P_IN or DRAFT:
        return a, []
    dur = len(a) / SR; total = wlen(tts); ins = []
    hop = int(.01 * SR); fr = np.sqrt(np.convolve(a ** 2, np.ones(hop) / hop, 'same')[::hop] + 1e-12); db = 20 * np.log10(fr / (fr.max() + 1e-9))
    for m in re.finditer(r'[。？！?!]', tts):
        if m.end() >= len(tts.rstrip()):
            continue
        te = dur * wlen(tts[:m.end()]) / total; lo, hi = int(max(0, te - .7) * 100), int(min(dur, te + .7) * 100)
        best, run, b0 = (0, 0), 0, 0
        for i in range(lo, hi):
            if db[i] < -38: run += 1
            else:
                if run > best[0]: best = (run, i - run)
                run = 0
        if run > best[0]: best = (run, hi - run)
        if best[0] >= 8:   # 至少 80 毫秒的静音
            ins.append(((best[1] + best[0] / 2) / 100, P_IN))
    if not ins:
        return a, []
    out, last = [], 0
    for at, d in ins:
        j = int(at * SR); out += [a[last:j], np.zeros(int(d * SR), a.dtype)]; last = j
    out.append(a[last:])
    return np.concatenate(out), ins


def shift(x, ins):
    return x + sum(d for at, d in ins if at < x)
SUB_MAX = 20                                 # 字幕一页最多多少字

t = LEAD
lines, subs, audio = {}, [], []
for k, (sec, tts, pause, sub) in LINES.items():
    if DRAFT:
        a = np.zeros(int(wlen(tts) / float(cfg()['voice_rate']) * SR), np.float32)
    else:
        a, sr = sf.read(E / choice[k]['file']); assert sr == SR, sr
        if a.ndim > 1: a = a.mean(1)
    dur0 = len(a) / SR; a, ins = widen(a, tts); dur = len(a) / SR
    # 分句：按标点切，时间按字数比例分（按原来的音频分，再把加进去的停顿算上）。画面用它把动作对到关键词上
    parts = [p for p in re.split(r'(?<=[，。？！、：；,.?!:;])', tts) if p.strip()]
    total = sum(wlen(p) for p in parts); c0 = t; clauses = []
    for p in parts:
        d = dur0 * wlen(p) / total
        clauses.append({'text': p.strip(), 'start': round(t + shift(c0 - t, ins), 3), 'end': round(t + shift(c0 - t + d - 1e-6, ins), 3)}); c0 += d
    lines[k] = {'sec': sec, 'start': round(t, 3), 'end': round(t + dur, 3), 'tts': tts, 'sub': sub or tts, 'clauses': clauses}
    stext = sub or tts
    pages, cur = [], ''
    for p in [p for p in re.split(r'(?<=[，。？！：；,.?!:;])', stext) if p.strip()]:
        if cur and wlen(cur) + wlen(p) > SUB_MAX:
            pages.append(cur); cur = p
        else:
            cur += p
    if cur: pages.append(cur)
    tot = sum(wlen(p) for p in pages); s0 = t
    for p in pages:
        d = dur0 * wlen(p) / tot
        subs.append({'text': re.sub(r'[，。：；,.:;]$', '', p.strip()), 'start': round(t + shift(s0 - t, ins), 3), 'end': round(t + shift(s0 - t + d - 1e-6, ins) + (0.12 if p is pages[-1] else 0), 3)}); s0 += d
    audio.append((t, a))
    keys = list(LINES); nxt = keys[keys.index(k) + 1] if keys.index(k) + 1 < len(keys) else None
    t += dur + max(P_MIN, pause * P_SCALE, P_SEC if nxt and LINES[nxt][0] != sec else 0)
duration = round(t + TAIL, 2)
chapters = [{'sec': sec, 'num': num, 'name': name, 'en': en, 'start': min(l['start'] for l in lines.values() if l['sec'] == sec)} for sec, num, name, en in CHAPTERS if any(l['sec'] == sec for l in lines.values())]
# 这一集自己的账单：画面里要报"多少句、念了多少遍、多少帧"时从这里读，不用写进旁白
facts = {'lines': len(lines), 'chars': sum(wlen(v[1]) for v in LINES.values()), 'takes': 0 if DRAFT else sum(c.get('tries', 1) for k, c in choice.items() if k in LINES),
         'frames': int(duration * FPS), 'seconds': round(duration, 1), 'vo_seconds': round(sum(len(a) for _, a in audio) / SR, 1)}
json.dump({'fps': FPS, 'draft': DRAFT, 'facts': facts, 'duration': duration, 'end_card': round(t, 3), 'lines': lines, 'subs': subs, 'chapters': chapters},
          open(E / 'app/src/timeline.json', 'w'), ensure_ascii=False, indent=1)
mix = np.zeros(int(duration * SR) + SR, dtype=np.float32)
for start, a in audio:
    i = int(start * SR); mix[i:i + len(a)] += a.astype(np.float32)
(E / 'out').mkdir(exist_ok=True)
if not DRAFT: sf.write(E / 'out/vo.wav', mix, SR)
msg = ('（草稿，按字数估的）' if DRAFT else '') + f"全片 {duration} 秒，{int(duration * FPS)} 帧；配音 {round(sum(len(a) for _, a in audio) / SR, 1)} 秒；片尾卡从 {round(t, 2)} 秒开始；字幕 {len(subs)} 页"
print(msg); log(E, '2-配音', '时间线：' + msg)
