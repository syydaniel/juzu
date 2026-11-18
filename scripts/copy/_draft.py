"""读口播稿。flavor.py 和 score.py 共用，只用标准库。

认三种文件：
  键|文本     一行一句，比如 a01|这段时间呢，我做了挺多 AI 视频的。
  lines.py   LINES = {键: (章节, 配音文本, 句后停顿, 字幕)}，取配音文本
  纯文本     没有键的 .txt 或 .md，一行算一句，键记成 L行号
【…】里是写给自己的备注，读进来时就去掉。
"""
import importlib.util
import re
from pathlib import Path

KEYED = re.compile(r'^\s*([A-Za-z0-9_.\-]+)\s*\|(.*)$')
NOTE = re.compile(r'【.*?】')


def drop_notes(s):
    return NOTE.sub('', s)


def load(path):
    """返回 (格式, [(键, 文本)…])。格式是 py、keyed 或 plain。文本去掉了备注，可能是空串。"""
    p = Path(path)
    if p.suffix == '.py':
        spec = importlib.util.spec_from_file_location('lines', p)
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        return 'py', [(str(k), drop_notes(v[1])) for k, v in m.LINES.items()]
    raw = p.read_text(encoding='utf-8')
    hits = [KEYED.match(l) for l in raw.strip().split('\n')]
    if any(hits):
        # 有键的稿子只认带键的行，别的行（空行、注释）不算
        return 'keyed', [(m.group(1), drop_notes(m.group(2))) for m in hits if m]
    out = []
    for i, line in enumerate(raw.splitlines()):
        s = drop_notes(line).strip()
        # 和原来的检查器一样，跳过 Markdown 的标题、表格、代码块和整行加粗
        if not s or s.startswith(('#', '|', '```', '- `', '`')) or s.startswith('**') and s.endswith('**'):
            continue
        out.append((f'L{i + 1}', s))
    return 'plain', out


def full_text(path):
    """打分用的整篇文本。有键的稿子把每句用换行接起来；纯文本整篇拿来，只去掉备注。"""
    kind, items = load(path)
    if kind == 'plain':
        return drop_notes(Path(path).read_text(encoding='utf-8'))
    return '\n'.join(t for _, t in items)
