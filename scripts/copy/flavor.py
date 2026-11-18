"""AI 套话检查：逐句找模板句式、空词和套话，有问题退出码是 1。

用法：
  python3 scripts/copy/flavor.py vo/草稿.txt [更多文件…] [--strict]

输入可以是「键|文本」一行一句的稿子、vo/lines.py，或者纯文本。【…】里的备注不查。
有问题的句子打出键、问题和原句，末尾一行是总数。一处都没有，退出码是 0；有，就是 1。

规则照搬原来的检查器 ai_flavor.py（MIT 协议），一条没放宽：
  空词         赋能、极致、震撼、沉浸、打造……（BUZZ）
  套话         让我们、值得一提的是、在这个、时代、首先、其次、最后、真正的……（STOCK）
  句式         「不是A，是B」「不仅…更…」「既…又…」「一X，一Y，一Z」、破折号、连着两个以上的感叹号
  四字词扎堆   一句里有三个以上前后都是标点的四字短语
  冒号铺垫     不到 60 个字的句子里用了中文冒号
  表情符号
  整篇太整齐   五句以上，句子长度的变异系数低于 0.25
另加一条：config.json 的 banned_words 里写了的字词，出现就报。

和原版的不同只有三处：【】备注先去掉再查；原版只打印「太整齐」不计数，这里也算一处；多了 banned_words。

一个要知道的细节：原版查「键|文本」的稿子时，是连着「a01|」一起查的。所以一句话开头的那个四字短语
不算进「四字词扎堆」，「冒号铺垫」的 60 字也连键一起数。这里默认照原版这么查，保证结果和原版一样。
加 --strict 就去掉键再查，句首的四字短语也算，会多报几处。lines.py 和纯文本两种算法本来就一样。
"""
import re
import statistics
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(1, str(HERE.parent))
from _draft import load

BUZZ = ['赋能', '极致', '震撼', '沉浸', '打造', '助力', '深度', '全方位', '一站式', '重磅', '硬核', '颠覆', '天花板', '绝绝子', 'yyds',
        '干货满满', '建议收藏', '宝藏', '神器', '炸裂', '封神', '无与伦比', '匠心', '初心', '温度', '质感满满', '高能', '燃爆', '史诗级',
        '独具匠心', '别具一格', '美轮美奂', '令人惊叹', '叹为观止', '完美呈现', '全新升级', '焕然一新', '精彩纷呈', '不容错过', '满满的']
STOCK = ['让我们', '值得一提的是', '总而言之', '综上所述', '不难发现', '毋庸置疑', '在这个', '时代', '一起来看看', '话不多说', '接下来',
         '首先', '其次', '最后', '总的来说', '可以说', '真正的', '更是', '不仅仅是', '而是一种', '见证', '旅程', '探索', '魅力', '灵魂']
PATTERNS = [
    (r'不是[^，。！？]{1,14}[，,]\s*(?:而)?是', '「不是A，是B」对立句'),
    (r'不仅[^，。]{1,16}[，,]\s*(?:更|还|也)', '「不仅…更…」递进句'),
    (r'既[^，。]{1,10}[，,]?\s*又', '「既…又…」'),
    (r'(?:一[^，。、]{1,3}[，、]){2,}一[^，。、]{1,3}', '「一X，一Y，一Z」排比'),
    (r'[\u2014\u2013]', '破折号'),
    (r'[!！]{2,}', '连续感叹号'),
]
FOUR = re.compile(r'(?:^|(?<=[，。、！？；：\s]))[一-鿿]{4}(?=[，。、！？；：]|$)')
EMOJI = re.compile('[\U0001F300-\U0001FAFF☀-➿]')


def banned_words():
    """config.json 里的 banned_words。读不到配置就当没有。"""
    try:
        from common import cfg
        return [w for w in cfg().get('banned_words', []) if w]
    except Exception:
        return []


def lint(text, banned=()):
    flags = []
    for w in BUZZ:
        if w in text:
            flags.append(f'空词「{w}」')
    for w in STOCK:
        if w in text:
            flags.append(f'套话「{w}」')
    for pat, name in PATTERNS:
        if re.search(pat, text):
            flags.append(name)
    four = FOUR.findall(text)
    if len(four) >= 3:
        flags.append(f'四字词扎堆×{len(four)}')
    if text.count('：') >= 1 and len(text) < 60:
        flags.append('冒号铺垫')
    if EMOJI.search(text):
        flags.append('表情符号')
    for w in banned:
        if w in text:
            flags.append(f'禁用词「{w}」')
    return flags


def main(paths, strict=False):
    banned = banned_words()
    total = n = 0
    for path in paths:
        kind, items = load(path)
        items = [(k, t.strip()) for k, t in items if t.strip()]
        # 原版看到的是整行「a01|文本」，默认照它查；--strict 只查文本
        seen = [(k, t, t if strict or kind != 'keyed' else f'{k}|{t}') for k, t in items]
        for k, t, view in seen:
            fl = lint(view, banned)
            n += 1
            total += len(fl)
            if fl:
                print(f'{k:10s} {"；".join(fl)}\n           {t}')
        lens = [len(view) for _, _, view in seen]
        if len(lens) > 4:
            cv = statistics.pstdev(lens) / max(1, statistics.mean(lens))
            if cv < 0.25:
                total += 1
                print(f'{path}：句子长度太整齐（变异系数 {cv:.2f}），像套模板')
    print(f'\n共 {total} 处 / {n} 句，平均每句 {total / max(1, n):.2f}')
    return 1 if total else 0


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a != '--strict']
    if not args:
        sys.exit(__doc__)
    sys.exit(main(args, strict='--strict' in sys.argv[1:]))
