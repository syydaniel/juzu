"""从 vo/草稿.txt（字幕写法，一行一句：键|文字）生成 vo/lines.py。配音文本里把数字换成汉字、把不好念的英文换成好念的写法。
改稿就改 草稿.txt，然后重跑：python3 vo/mk_lines.py（或 juzu.py lines）。下面三处每一期按需要改：SAY、PAUSE、CH。"""
import re, pathlib
here = pathlib.Path(__file__).resolve().parent
# 字幕里的写法 → 配音里的写法（按顺序替换，长的写在前面）。配音文本里不许留阿拉伯数字，留了会报错
SAY = [('Claude Code', 'Claude Code'), ('skill', 'skill'), ('4K', '四 K'), ('3D', '三 D')]
# 某一句后面要多停一会儿（秒）。比如后面接一段只有配乐的画面。时间线脚本会把停顿乘 0.72
PAUSE = {'e02': 1.6}   # 示范：悬浮段在 e02 结束后 1.4 秒才收完，这里多停一会儿，片尾那句不抢它
PAUSE_END = 0.9      # 每章最后一句后面的停顿
# 章节：(章节字母, 序号, 中文名, 英文名)。名字留空的章节不显示章节卡
CH = [('a', '', '', ''), ('b', '01', '屏幕', 'SCREEN'), ('c', '02', '桌面和小机器人', 'DESK'), ('d', '03', '软木板', 'BOARD'), ('e', '04', '床角', 'BED')]

rows = [l.split('|', 1) for l in (here / '草稿.txt').read_text().strip().split('\n') if l.strip() and not l.startswith('#')]
bad = [k for k, _ in rows if not re.fullmatch(r'[a-z]\d\d', k)]
assert not bad, f'这些键的写法不对（要像 a01、b03）：{bad}'
out = ['# 口播稿。由 vo/mk_lines.py 从 vo/草稿.txt 生成，不要直接改这个文件。',
       '# 格式：键: (章节, 配音文本, 句后停顿秒, 字幕文本或 None 表示同配音文本)。', 'LINES = {']
for i, (k, sub) in enumerate(rows):
    sub = sub.strip(); tts = sub
    for a, b in SAY: tts = tts.replace(a, b)
    tts = re.sub(r'(?<=[一-鿿，。、？]) (?=[一-鿿])', '', tts)   # 数字换成汉字以后，两边多出来的空格去掉
    assert not re.search(r'\d', tts), f'{k} 的配音文本里还有阿拉伯数字：{tts}（在 SAY 里写好念法）'
    last = i + 1 == len(rows) or rows[i + 1][0][0] != k[0]
    pause = PAUSE.get(k, PAUSE_END if last else (0.45 if len(sub) > 60 else 0.38))
    out.append(f"    {k!r}: ({k[0]!r}, {tts!r}, {pause}, {None if tts == sub else repr(sub)}),")
out += ['}', '# (章节字母, 序号, 中文名, 英文名)。名字留空的章节不显示章节卡。', f'CHAPTERS = {CH!r}']
(here / 'lines.py').write_text('\n'.join(out) + '\n')
print(len(rows), '句，字幕', sum(len(re.sub(r'\s', '', s)) for _, s in rows), '字')
