"""各脚本共用：读配置、找到当前这一集的目录、读口播稿、记运行记录、把「时间写法」换成秒。只用标准库。"""
import json, os, re, sys, time
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent


def cfg():
    """config.example.json 打底，config.json 覆盖。以 ~ 开头的路径展开成绝对路径。"""
    c = json.load(open(SKILL / 'config.example.json'))
    p = SKILL / 'config.json'
    if p.exists():
        c.update(json.load(open(p)))
    if os.environ.get('JUZU_PRODUCTIONS'):      # 临时换一个放片子的目录（试跑时用）
        c['productions_dir'] = os.environ['JUZU_PRODUCTIONS']
    def ex(v):
        if isinstance(v, str) and v.startswith('~'): return os.path.expanduser(v)
        if isinstance(v, list): return [ex(x) for x in v]
        return v
    return {k: ex(v) for k, v in c.items()}


def ep():
    """当前这一集的目录：环境变量 JUZU_EP，或者从当前目录往上找 episode.json。"""
    d = Path(os.environ.get('JUZU_EP') or os.getcwd()).resolve()
    for x in [d, *d.parents]:
        if (x / 'episode.json').exists():
            return x
    sys.exit('找不到 episode.json：请在某一集的目录里运行，或者设 JUZU_EP=那一集的目录')


def state(e):
    return json.load(open(e / 'episode.json'))


def save_state(e, s):
    json.dump(s, open(e / 'episode.json', 'w'), ensure_ascii=False, indent=1)


def log(e, stage, msg):
    """往 运行记录.md 追加一行。每个工种做了什么、花了多久、卡在哪，都记在这里；片子里说的数字从这里取。"""
    with open(e / '运行记录.md', 'a') as f:
        f.write(f"- {time.strftime('%m-%d %H:%M')} 【{stage}】{msg}\n")


def load_lines(e):
    """读 vo/lines.py：LINES = {键: (章节, 配音文本, 句后停顿秒, 字幕文本或 None)}，CHAPTERS = {章节字母: 名字}。"""
    import importlib.util
    spec = importlib.util.spec_from_file_location('lines', e / 'vo/lines.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.LINES, getattr(mod, 'CHAPTERS', {})


def wlen(s):
    return max(1, len(re.sub(r'[^\w]', '', s)))


def timeline(e):
    return json.load(open(e / 'app/src/timeline.json'))


class Clock:
    """读 app/src/timeline.json，把「时间写法」换成秒。片场的导演表（set/kit.js 的 TX）用的是同一套写法。
    写法：12.5 | a01（句子开始）| a01$（句子结束）| a01:关键词 | END（片尾卡）| DUR（全片结束），后面可以跟 +0.3 / -0.2。"""

    def __init__(self, e):
        self.tl = timeline(e)

    def at(self, expr):
        if isinstance(expr, (int, float)):
            return float(expr)
        s = str(expr).strip()
        try:
            return float(s)
        except ValueError:
            pass
        m = re.match(r'^(?P<base>.+?)(?P<off>[+-]\d+(?:\.\d+)?)?$', s)
        base, off = m.group('base'), float(m.group('off') or 0)
        L = self.tl['lines']
        if base == 'END':
            return self.tl['end_card'] + off
        if base == 'DUR':
            return self.tl['duration'] + off
        if base.endswith('$'):
            return L[base[:-1]]['end'] + off
        if ':' in base:
            k, w = base.split(':', 1)
            for c in L[k]['clauses']:
                i = c['text'].find(w)
                if i >= 0:
                    return c['start'] + (c['end'] - c['start']) * i / max(1, len(c['text'])) + off
            raise KeyError(f'{k} 这句里没有「{w}」（按配音文本找，数字要写成汉字）')
        return L[base]['start'] + off
