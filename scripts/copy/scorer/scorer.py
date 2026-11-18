"""给一篇口播稿打 AI 概率，再按真人稿的常见范围指出具体问题。

依据全是聚合数据，放在 data/ 里，来自一项对比真人和 AI 口播稿的研究：
  model.json        逻辑回归（真人稿对 Opus 裸写稿，72 对训练），134 个指标的均值、标准差、系数
  targets.json      每项指标在 63 篇备稿真人稿里的第 10 到第 90 百分位
  ai_overused.json  AI 稿明显多用的词和起句方式，带两边的频率
没有任何原文、句子或片段。词表打包前查过：超过 6 个汉字的、像半句话的条目都要删（实际一条也没有），
打分器用不到的「分句开头」整类没带。

算法和研究里的打分脚本一字不差，只改了三处：数据从 data/ 读，不再现算；标点模型默认跑 CPU；
多算了每项指标对分数的贡献，用来列「往像 AI 推得最多的几项」。
"""
import contextlib
import json
import logging
import os
import re
import sys
from collections import Counter
from pathlib import Path

import jieba
import numpy as np

from . import features as F
from . import features_adv as A

DATA = Path(__file__).resolve().parent / "data"
_PUNC = None
_CACHE = {}

# 指标 →（太少时怎么说，太多时怎么说，单位）
ADVICE = {
    "语气词": ("句尾的语气词太少，在问句、转折、感叹的地方加上呢、吧、啊、吗", "语气词太多，去掉一些", "每千字"),
    "口头连接词": ("句子之间缺连接词，用但是、所以、因为、然后、而且、如果把话接起来", "连接词太密，不要每句都以但是、所以、因为开头", "每千字"),
    "口头话语标记": ("口头的小词太少，可以加几个其实、然后、的话、对吧", "口头的小词太多，删掉一些其实、然后、的话", "每千字"),
    "这个那个": ("可以多用几次这个、那个来指前面说过的东西", "这个、那个太多", "每千字"),
    "第一人称": ("很少说我、我们，讲步骤和看法的时候用上", "我、我们太多", "每千字"),
    "人称_我": ("几乎没有\"我\"，说看法和判断的时候用\"我\"", "\"我\"太多", "每千字"),
    "人称_我们": ("很少说\"我们\"，带着观众往下看的时候说\"我们来看\"", "\"我们\"太多", "每千字"),
    "称呼观众": ("很少对观众说话，用上你、大家", "对观众喊话太多，少用你、大家", "每千字"),
    "四字词": ("四字词偏少，可以正常用几个", "四字词太多，换成平常的说法", "每千字"),
    "成语": ("成语偏少", "成语太多，换成平常的说法", "每千字"),
    "限定词": ("", "\"可能、往往、几乎、大约、似乎\"这类限定词太多，直接说", "每千字"),
    "意外转折副词": ("", "\"居然、竟然、到底、究竟、毕竟、原来、反而、恰恰\"这类词太多", "每千字"),
    "动词带补语或趋向": ("", "动词后面挂\"起来、下来、出去、出来\"太多，直接说动作", "每千字"),
    "把字句": ("", "\"把\"字句太多，换成直接的说法", "每百句"),
    "因果句": ("很少用因为、所以把原因讲出来", "因为、所以太多，有些因果不用明说", "每百句"),
    "目的句": ("可以用\"为了……\"说明目的", "", "每百句"),
    "让步句": ("可以用\"虽然……但是……\"\"尽管……\"\"即使……\"", "", "每百句"),
    "文言虚词": ("书面的小词太少，正常用上将、之、而、与、以、其、所、则", "书面虚词太多", "每千字"),
    "的字链": ("名词前面的修饰太单薄，\"……的……的……\"这种两层修饰可以有", "\"的\"字套得太多", "每千字"),
    "分句均长": ("分句太短，把相邻的短分句并成完整的一句话", "分句太长，适当断开", "字"),
    "长分句占比": ("缺少 20 个字以上的长分句，有些话要一口气说完", "长分句太多", "占比"),
    "分句相邻起伏": ("分句长度太整齐，长短要错开", "", ""),
    "词汇丰富度MATTR": ("同一句话重复得太多", "换词太勤，同一个东西从头到尾用同一个词，关键的词可以重复", ""),
    "四字串重复率": ("没有任何重复的说法，关键的词和短语可以再出现", "重复的说法太多", ""),
    "句式模板合计": ("", "\"不是…而是…\"\"既…又…\"\"正是…\"\"这背后…\"\"换句话说\"这类句式太多", "每千字"),
    "疑问标记": ("几乎没有提问，可以问观众一两个问题", "问句太多", "每千字"),
    "口语俗词": ("可以用一两个口语词：搞、弄、啥、咱、挺、压根", "口语俗词太多", "每千字"),
    "碎分句占比": ("", "四个字以内的碎分句太多，并到前后的句子里", "占比"),
}


def _json(name):
    if name not in _CACHE:
        _CACHE[name] = json.loads((DATA / name).read_text(encoding="utf-8"))
    return _CACHE[name]


def model():
    return _json("model.json")


def targets():
    return _json("targets.json")


def overused():
    return _json("ai_overused.json")


def punc():
    """FunASR 的 ct-punc 标点模型。第一次用会下载约 1 GB。
    默认从 HuggingFace 下，设 JUZU_PUNC_HUB=ms 改从 ModelScope 下。
    默认跑 CPU，五千字要半分钟左右；Apple 芯片上设 JUZU_PUNC_DEVICE=mps 会快一些，测试稿上两种算出来的分数一模一样。"""
    global _PUNC
    if _PUNC is None:
        try:
            from funasr import AutoModel
        except ImportError:
            raise SystemExit("缺 funasr（还要 torch）。装法见 scripts/copy/requirements.txt")
        hub = os.environ.get("JUZU_PUNC_HUB", "hf")
        logging.disable(logging.WARNING)
        try:
            with open(os.devnull, "w") as null, contextlib.redirect_stdout(null), contextlib.redirect_stderr(null):
                _PUNC = AutoModel(model="ct-punc", hub=hub, device=os.environ.get("JUZU_PUNC_DEVICE", "cpu"), disable_update=True, disable_pbar=True)
        except Exception as e:
            raise SystemExit(f"标点模型 ct-punc 加载失败（{type(e).__name__}: {e}）。"
                             f"第一次要联网下载约 1 GB；下不动可以试试 JUZU_PUNC_HUB=ms")
        finally:
            logging.disable(logging.NOTSET)
    return _PUNC


def ruled_text(plain):
    with open(os.devnull, "w") as null, contextlib.redirect_stdout(null):
        return punc().generate(input=plain)[0]["text"]


def score(text, ruled=None):
    own = text.strip()
    plain = F.strip_punct(own)
    if ruled is None:
        ruled = ruled_text(plain)
    f = F.extract(plain, ruled, own=own)
    f.update(A.extract(ruled))
    m = model()
    x = np.array([f.get(k, 0.0) or 0.0 for k in m["features"]], float)
    z = (x - np.array(m["mean"])) / np.array(m["scale"])
    prob = float(1 / (1 + np.exp(-(z @ np.array(m["coef"]) + m["intercept"]))))
    c = z * np.array(m["coef"])
    contrib = lambda idx: [{"指标": m["features"][i], "现在": round(float(x[i]), 3), "均值": round(m["mean"][i], 3), "贡献": round(float(c[i]), 3)} for i in idx]
    T = targets()
    issues = []
    for k, (low, high, unit) in ADVICE.items():
        if k not in f or k not in T:
            continue
        v, t = f[k], T[k]
        spread = max(t["p75"] - t["p25"], 1e-6)
        if v < t["p10"] and low:
            issues.append({"指标": k, "方向": "太少", "现在": round(v, 2), "真人常见": f"{t['p25']:.2f} 到 {t['p75']:.2f}", "单位": unit, "建议": low, "严重": round((t["p25"] - v) / spread, 2)})
        elif v > t["p90"] and high:
            issues.append({"指标": k, "方向": "太多", "现在": round(v, 2), "真人常见": f"{t['p25']:.2f} 到 {t['p75']:.2f}", "单位": unit, "建议": high, "严重": round((v - t["p75"]) / spread, 2)})
    issues.sort(key=lambda r: -r["严重"])
    # 具体的词
    O = overused()
    n = F.han(plain)
    words = Counter(jieba.cut(plain))
    starts = Counter()
    for s in re.split(F.PUNCT_END, own):
        ws = [w for w in jieba.cut(s) if F.han(w) > 0]
        if len(ws) >= 2:
            starts[ws[0]] += 1
    hits = []
    for w, (ra, rh) in {**O.get("结巴词", {}), **O.get("副词", {}), **O.get("动词", {})}.items():
        cnt = words.get(w, 0)
        if cnt and cnt / n * 1000 > max(1.0, 3 * rh):
            hits.append((w, cnt))
    start_hits = [(w, cnt) for w, cnt in starts.items() if w in O.get("整句开头", {}) and cnt >= 2]
    # 句子层面的定位
    spots = []
    for s in re.findall(r"[^。？！?!\n]+[。？！?!]?", own):
        st = s.strip()
        if re.search(F.TEMPLATES["不是A而是B"], st) or re.search(r"既[^，。]{1,10}[，,]?又|正是|恰恰是|这背后|真正的", st):
            spots.append(("对比或强调句式", st[:40]))
        cl = [F.han(part) for part in re.split(r"[，,；;：:]+", st) if F.han(part) > 0]  # 顿号列举不算
        if any(all(y <= 5 for y in cl[i:i + 3]) for i in range(len(cl) - 2)):
            spots.append(("连着三个很短的分句", st[:40]))
    return {"字数": n, "AI概率": round(prob, 3), "AI概率_原值": prob, "问题": issues, "用得偏多的词": sorted(hits, key=lambda x: -x[1])[:15],
            "偏多的起句": sorted(start_hits, key=lambda x: -x[1]), "要看的句子": spots[:12],
            "推向AI": contrib(np.argsort(-c)[:10]), "拉向真人": contrib(np.argsort(c)[:6]), "指标": f}


def feedback(res, top=10):
    """把打分结果写成修改意见，一条一行。"""
    L = []
    for r in res["问题"][:top]:
        L.append(f"- {r['建议']}（现在 {r['现在']}{'' if not r['单位'] else ' ' + r['单位']}，真人常见 {r['真人常见']}）")
    if res["用得偏多的词"]:
        L.append("- 这些词用得比真人多，各留一处或者换掉：" + "、".join(f"{w}（{c} 次）" for w, c in res["用得偏多的词"]))
    if res["偏多的起句"]:
        L.append("- 这些词拿来起句的次数太多：" + "、".join(f"{w}（{c} 句）" for w, c in res["偏多的起句"]))
    for kind, s in res["要看的句子"][:6]:
        L.append(f"- {kind}：「{s}…」")
    return "\n".join(L)
