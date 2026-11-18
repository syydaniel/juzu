"""把 ../app/src/timeline.json 变成 set/tl.js（window.TL），页面用 <script> 直接加载。每次重排时间线之后跑一遍：python3 set/mk_tl.py
字幕在这里重新分页：只在中文标点处断，不在小数点处断（时间线脚本会把「5.48 美元」断成两页），一页最多 20 字。同时写出 ../out/字幕.srt。"""
import json, pathlib, re
here = pathlib.Path(__file__).resolve().parent
t = json.load(open(here.parent / 'app/src/timeline.json'))
wlen = lambda s: len(re.sub(r'[\s，。？！、：；]', '', s))
subs = []
for k, L in t['lines'].items():
    parts = [p for p in re.split(r'(?<=[，。？！：；、])', L['sub']) if p.strip()]; pages = []; cur = ''
    for p in parts:
        if cur and wlen(cur) + wlen(p) > 20: pages.append(cur); cur = p
        else: cur += p
    if cur: pages.append(cur)
    tot = sum(wlen(p) for p in pages); s0 = L['start']; dur = L['end'] - L['start']
    for i, p in enumerate(pages):
        d = dur * wlen(p) / tot
        subs.append({'text': re.sub(r'[，。：；、]$', '', p.strip()), 'start': round(s0, 3), 'end': round(s0 + d + (0.12 if i == len(pages) - 1 else 0), 3)}); s0 += d
t['subs'] = subs
open(here / 'tl.js', 'w').write('window.TL = ' + json.dumps(t, ensure_ascii=False) + ';\n')
ts = lambda x: '%02d:%02d:%02d,%03d' % (x // 3600, x % 3600 // 60, x % 60, round(x % 1 * 1000) % 1000)
(here.parent / 'out').mkdir(exist_ok=True)
open(here.parent / 'out/字幕.srt', 'w').write('\n'.join(f"{i + 1}\n{ts(s['start'])} --> {ts(s['end'])}\n{s['text']}\n" for i, s in enumerate(subs)))
print('tl.js：', len(t['lines']), '句，', len(subs), '页字幕，全片', t['duration'], '秒', '（草稿）' if t.get('draft') else '', '最长一页', max(wlen(s['text']) for s in subs), '字')
