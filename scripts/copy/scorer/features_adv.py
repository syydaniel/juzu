"""进阶指标：词性构成、搭配、句式、句法复杂度、用词常见度。都在重新断句后的文本上算，句法分析用 spaCy 的中文模型 zh_core_web_md。

  词性     名词、动词、形容词、副词、代词、数词、专名各占多少；名动比
  搭配     动宾搭配的密度和多样性；宾语前的动词里「虚化动词」（进行、做出、实现、带来…）占多少；
           名词前面挂几个修饰语；「的」字链；副词修饰动词的密度；单字动词占比
  句式     把字句、被字句、是…的、连…都、比较句、条件句、让步句、因果句、目的句、祈使、存现、感叹、无主语的分句
  复杂度   依存距离（一个词离它的中心词平均隔几个词）、从句占比、每句的词数
  用词     实词的常见度（Zipf 词频，越大越常见）、生僻词占比、动词的常见度、抽象名词占比
这 47 项进了打分模型。不装 spaCy 的话，在测试稿上 AI 概率会差 0.07 左右，所以没有把它做成可选。
"""
import re
import statistics
from collections import Counter

import spacy
from wordfreq import zipf_frequency

_NLP = None
LIGHT_VERBS = {"进行", "做出", "作出", "加以", "予以", "给予", "实现", "提供", "带来", "产生", "造成", "形成", "成为", "得到", "获得", "具有", "拥有", "存在",
               "发挥", "起到", "开展", "展开", "实施", "采取", "保持", "呈现", "体现", "展现", "引发", "导致", "促进", "推动", "提升", "打造", "构建"}
ABSTRACT_END = re.compile(r".+(?:性|化|度|力|感|率|观|论|主义|意识|机制|体系|模式|格局|层面|维度|领域|价值|意义|本质|逻辑|趋势)$")
PATTERNS = {
    "被字句": r"被[^，。？！]{1,12}",
    "是…的": r"是[^，。？！]{2,14}的[，。？！]",
    "连…都": r"连[^，。？！]{1,10}(?:都|也)",
    "比较句": r"比[^，。？！]{1,10}(?:更|还|要|多|少|高|低|大|小|强|快|慢)|没有[^，。？！]{1,8}那么|不如",
    "条件句": r"如果|要是|假如|假设|只要|一旦|万一|除非|的话",
    "让步句": r"虽然|尽管|即使|即便|哪怕|就算|固然",
    "因果句": r"因为|由于|所以|因此|之所以|于是|以至于|导致",
    "目的句": r"为了|以便|好让|免得|省得",
    "祈使": r"(?:^|[，。？！])(?:请|别|不要|千万|一定要|记得|记住|试试|想想|看看|注意|来|去)[^，。？！]{1,14}",
    "存现": r"(?:^|[，。？！])(?:有|有个|有一|有些|还有|没有)[^，。？！]{2,}",
    "感叹": r"多么|太[^，。？！]{1,6}了|真[^，。？！]{1,6}啊|好[^，。？！]{1,4}啊|简直",
    "判断句": r"[^，。？！]{1,10}(?:就是|才是|便是|即是|乃是|算是)[^，。？！]{1,12}",
    "引语": r"(?:说|讲|表示|写道|回应|问|喊|称|认为)[：:，]?[“「]",
    "数量铺陈": r"\d+[^，。？！]{0,4}[，、]\d+[^，。？！]{0,4}[，、]\d+",
}


def nlp():
    global _NLP
    if _NLP is None:
        try:
            _NLP = spacy.load("zh_core_web_md", disable=["ner"])
        except OSError:
            raise SystemExit("缺 spaCy 的中文模型 zh_core_web_md。装法：python -m spacy download zh_core_web_md（下载约 78 MB）")
        _NLP.max_length = 50000
    return _NLP


def han(s):
    return len(re.findall(r"[一-鿿A-Za-z0-9]", s))


def extract(ruled):
    doc = nlp()(ruled)
    toks = [t for t in doc if not t.is_punct and not t.is_space and han(t.text) > 0]
    n = han(ruled)
    nt = len(toks)
    if nt < 50:
        return {}
    per_k = lambda c: round(c / n * 1000, 3)
    f = {}
    pos = Counter(t.pos_ for t in toks)
    for k, name in {"NOUN": "名词", "VERB": "动词", "ADJ": "形容词", "ADV": "副词", "PRON": "代词", "NUM": "数词", "PROPN": "专名词", "PART": "助词", "ADP": "介词"}.items():
        f[f"词性_{name}占比"] = round(pos[k] / nt, 4)
    f["名动比"] = round((pos["NOUN"] + pos["PROPN"]) / max(1, pos["VERB"]), 3)
    f["修饰词占比"] = round((pos["ADJ"] + pos["ADV"]) / nt, 4)

    # ---- 搭配
    vo = [(t.head.text, t.text) for t in toks if t.dep_ == "dobj" and t.head.pos_ == "VERB"]
    adv_v = [(t.text, t.head.text) for t in toks if t.dep_ == "advmod" and t.head.pos_ == "VERB" and t.pos_ == "ADV"]
    mod_n = [(t.text, t.head.text) for t in toks if t.dep_ in ("amod", "nmod:assmod", "compound:nn", "nmod") and t.head.pos_ in ("NOUN", "PROPN")]
    f["动宾搭配"] = per_k(len(vo))
    f["动宾搭配多样性"] = round(len(set(vo)) / len(vo), 3) if vo else 0.0
    f["虚化动词占动宾"] = round(sum(1 for v, _ in vo if v in LIGHT_VERBS) / len(vo), 3) if vo else 0.0
    f["虚化动词"] = per_k(sum(1 for t in toks if t.text in LIGHT_VERBS))
    f["副词修饰动词"] = per_k(len(adv_v))
    nouns = [t for t in toks if t.pos_ in ("NOUN", "PROPN")]
    nmods = [sum(1 for c in t.children if c.dep_ in ("amod", "nmod:assmod", "compound:nn", "nmod", "acl", "nummod", "det", "clf")) for t in nouns]
    f["名词平均修饰语数"] = round(statistics.mean(nmods), 3) if nmods else 0.0
    f["重修饰名词占比"] = round(sum(1 for x in nmods if x >= 2) / len(nmods), 3) if nmods else 0.0
    f["的字"] = per_k(sum(1 for t in toks if t.text == "的"))
    f["的字链"] = per_k(len(re.findall(r"[^，。？！的]{1,8}的[^，。？！的]{1,8}的[^，。？！的]{1,8}", ruled)))
    verbs = [t for t in toks if t.pos_ == "VERB"]
    f["单字动词占比"] = round(sum(1 for t in verbs if len(t.text) == 1) / len(verbs), 3) if verbs else 0.0
    f["动词带补语或趋向"] = per_k(len(re.findall(r"[一-鿿](?:出来|起来|下去|下来|上去|上来|过来|过去|回来|进去|出去|掉了|完了|好了|到了|成了|住了|开了|上了|下了)", ruled)))
    f["动词重叠"] = per_k(len(re.findall(r"([一-鿿])[一了]?\1(?=[，。？！]|[^一-鿿])", ruled)))

    # ---- 句式
    sents = [s for s in re.split(r"[。？！?!]+", ruled) if han(s) > 1]
    ns = max(1, len(sents))
    f["把字句"] = round(sum(1 for t in toks if t.dep_ == "aux:ba" or t.text == "把") / ns * 100, 2)
    for name, pat in PATTERNS.items():
        f[name] = round(len(re.findall(pat, ruled)) / ns * 100, 2)
    clauses = [c for c in re.split(r"[，。？！、：；,.?!:;]+", ruled) if han(c) > 1]
    # 无主语分句：分句里没有主语依存
    subj_idx = {t.i for t in doc if t.dep_ in ("nsubj", "nsubjpass", "top")}
    start, no_subj, total = 0, 0, 0
    for t in doc:
        if t.is_punct and t.text in "，。？！、：；,.?!:;":
            if t.i - start >= 2:
                total += 1
                if not any(start <= i < t.i for i in subj_idx):
                    no_subj += 1
            start = t.i + 1
    f["无主语分句占比"] = round(no_subj / total, 3) if total else 0.0

    # ---- 复杂度
    dd = [abs(t.i - t.head.i) for t in toks if t.head.i != t.i]
    f["依存距离"] = round(statistics.mean(dd), 3) if dd else 0.0
    f["从句标记"] = per_k(sum(1 for t in toks if t.dep_ in ("acl", "ccomp", "advcl", "xcomp", "advcl:loc")))
    f["每句词数"] = round(nt / ns, 2)

    # ---- 用词常见度
    content = [t for t in toks if t.pos_ in ("NOUN", "VERB", "ADJ", "ADV") and re.fullmatch(r"[一-鿿]+", t.text)]
    z = [zipf_frequency(t.text, "zh") for t in content]
    z = [x for x in z if x > 0]
    if z:
        f["实词常见度"] = round(statistics.mean(z), 3)
        f["实词常见度_波动"] = round(statistics.pstdev(z), 3)
        f["生僻实词占比"] = round(sum(1 for x in z if x < 3.5) / len(z), 3)
        f["高频实词占比"] = round(sum(1 for x in z if x >= 5.5) / len(z), 3)
    zv = [zipf_frequency(t.text, "zh") for t in verbs if re.fullmatch(r"[一-鿿]+", t.text)]
    zv = [x for x in zv if x > 0]
    f["动词常见度"] = round(statistics.mean(zv), 3) if zv else 0.0
    f["抽象名词占比"] = round(sum(1 for t in nouns if ABSTRACT_END.match(t.text)) / max(1, len(nouns)), 3)
    f["未登录实词占比"] = round(sum(1 for t in content if zipf_frequency(t.text, "zh") == 0) / max(1, len(content)), 3)
    return f
