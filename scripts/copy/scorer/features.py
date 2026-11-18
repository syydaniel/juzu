"""口播稿的特征提取。打分模型训练时用的就是这份代码，这里原样搬过来，保证尺子相同。

一篇稿子进来时有三种形态：
  plain   去掉全部标点的纯文本，算不靠标点的指标（词、语气、人称、数字、套话）
  ruled   用标点模型（FunASR ct-punc）重新断句的文本，算句长、起伏、排比这类靠断句的指标
  own     作者自己打的标点，另算一套「原标点_」开头的指标，只供对照，不进模型

频率类指标的单位，除特别说明，都是「每千字出现几次」。字数只数汉字、字母和数字。
"""
import math
import re
import statistics
import zlib
from collections import Counter

import jieba
import jieba.posseg as pseg

jieba.setLogLevel(60)

# ---------------------------------------------------------------- 词表
PARTICLES = set("啊呀哇哦噢喔嘛呢吧呗啦咯喽哈嘞诶欸哎嘿嗯呃哟呐哒嘞")
ORAL_MARK = ["其实", "然后", "的话", "对吧", "是吧", "对不对", "你知道", "我跟你说", "说实话", "讲真", "反正", "就是说", "怎么说呢",
             "你看", "你想", "好吧", "没错", "当然了", "比如说", "所以说", "也就是说", "话说回来", "说回来", "不过呢", "这样子", "就这样",
             "说白了", "你猜", "讲道理", "老实说", "坦白说", "不瞒你说", "你懂的", "懂吧", "明白吧", "知道吧", "是不是", "对不对"]
WRITTEN_CONN = ["然而", "因此", "此外", "与此同时", "总之", "综上", "首先", "其次", "值得注意的是", "值得一提的是", "事实上", "换言之",
                "由此可见", "不仅如此", "更重要的是", "正因如此", "从而", "进而", "以及", "并且", "尽管", "即便", "无论", "倘若", "乃至",
                "总而言之", "总的来说", "不难发现", "毋庸置疑", "显而易见", "可以说", "某种程度上", "一定程度上", "在这个过程中", "与此相对"]
ORAL_CONN = ["但是", "可是", "不过", "所以", "因为", "结果", "而且", "要是", "于是", "然后", "那么", "况且", "再说", "偏偏", "好在", "索性", "倒是", "谁知", "没想到"]
CLASSICAL = set("之其于以而与及将所则便即亦乃且若故此该")
NOMINAL = ["进行", "实现", "提供", "具有", "作为", "通过", "对于", "基于", "关于", "针对", "使得", "促进", "推动", "提升", "构建", "打造", "赋予", "呈现", "体现", "彰显", "引发", "带来"]
COLLOQ = ["啥", "咋", "咱", "干嘛", "玩意", "家伙", "搞", "弄", "好家伙", "离谱", "牛", "哥们", "兄弟", "老铁", "整活", "破防", "绝了", "逆天", "麻了", "寄", "蚌埠住", "扯", "瞎", "贼", "巨", "倍儿", "忒", "老", "压根", "愣是", "硬是", "活活"]
STANCE_ORAL = ["真的", "特别", "超级", "挺", "蛮", "太", "简直", "根本", "完全", "绝对", "老", "贼", "巨", "可", "多"]
STANCE_WRITTEN = ["十分", "极其", "格外", "相当", "颇为", "极为", "尤为", "日益", "愈发", "显著", "深刻", "深远", "至关重要", "不可或缺"]
SURPRISE = ["居然", "竟然", "果然", "偏偏", "恰恰", "到底", "究竟", "毕竟", "原来", "没想到", "谁知道", "结果", "反而", "反倒", "其实"]
HEDGE = ["可能", "或许", "也许", "大概", "似乎", "一定程度", "某种程度", "往往", "通常", "大约", "差不多", "估计", "恐怕", "好像"]
EXAMPLE = ["比如", "比方", "例如", "举个例子", "举例", "打个比方", "就像", "好比", "就好像", "譬如", "拿", "相当于", "类似于"]
ELEVATE = ["标志着", "见证", "彰显", "体现了", "反映了", "意味着", "诠释", "折射", "揭示", "象征", "承载", "塑造", "重塑", "定义了", "改写", "颠覆", "开启", "引领"]
VAGUE_SRC = ["专家", "研究表明", "研究发现", "研究显示", "有研究", "有人说", "据说", "数据显示", "科学家们", "学者", "业内人士", "有观点认为", "普遍认为"]
PREACH = ["你应该", "你需要", "你必须", "你要记住", "请记住", "记住", "我们应该", "我们需要", "我们必须", "不妨", "要学会", "学会", "值得我们", "提醒我们", "告诉我们", "让我们明白"]
# 空词和套话：和 flavor.py 的两张表基本一样，多了几个词
BUZZ = ["赋能", "极致", "震撼", "沉浸", "打造", "助力", "深度", "全方位", "一站式", "重磅", "硬核", "颠覆", "天花板", "绝绝子", "yyds", "干货满满", "建议收藏",
        "宝藏", "神器", "炸裂", "封神", "无与伦比", "匠心", "初心", "温度", "质感满满", "高能", "燃爆", "史诗级", "独具匠心", "别具一格", "美轮美奂", "令人惊叹",
        "叹为观止", "完美呈现", "全新升级", "焕然一新", "精彩纷呈", "不容错过", "满满的", "见证", "旅程", "探索", "加持", "完美诠释"]
STOCK = ["让我们", "值得一提的是", "总而言之", "综上所述", "不难发现", "毋庸置疑", "在这个", "时代", "一起来看看", "话不多说", "接下来", "首先", "其次", "最后",
         "总的来说", "可以说", "真正的", "更是", "不仅仅是", "而是一种", "魅力", "灵魂", "说白了", "你猜怎么着", "那问题就来了"]
GREET = re.compile(r"大家好|哈喽|hello|Hello|嗨|各位好|朋友们好|同学们好|你好|我是|这里是|欢迎来到|欢迎回到")
CTA = re.compile(r"点赞|关注|收藏|投币|三连|转发|订阅|评论区|弹幕")
BYE = re.compile(r"再见|拜拜|下期见|下次见|我们下期|下期再|下个视频|下次再")
UPLIFT = re.compile(r"希望|愿|未来|让我们|每一个|或许|也许|真正|值得|意义|相信|永远|时代|世界")

TEMPLATES = {
    "不是A而是B": r"不是[^，。！？]{1,16}[，,]?而是|不是[^，。！？]{1,14}[，,]是(?!不是)",
    "不仅…更": r"不[仅只光](?:仅|是)?[^。！？]{1,22}(?:更|还|也|而且)",
    "既…又": r"既[^，。]{1,10}[，,]?(?:又|也)",
    "无论…都": r"(?:无论|不管)[^。！？]{1,20}都",
    "这意味着": r"这(?:就)?意味着|也就意味着",
    "换句话说": r"换句话说|换言之|也就是说",
    "简单来说": r"简单来说|简单说|简而言之|一句话|说白了|通俗地说|通俗来讲",
    "想象一下": r"想象一下|试想|设想一下|假设你|假如你",
    "你有没有想过": r"你有没有想过|你是否想过|你可能不知道|你可能会问|你可能觉得|你也许|你可能以为|你或许|你一定",
    "答案是": r"答案是|答案很简单|答案可能|答案就|答案其实",
    "事实上": r"事实上|实际上|其实不然",
    "真正的": r"真正的|真正让|真正值得",
    "让我们": r"让我们|我们一起来|一起来看",
    "这背后": r"这背后|背后的|背后是|背后其实",
    "本质上": r"本质上|归根结底|说到底|归根到底|究其原因",
    "只做一步": r"只(?:做|需|需要|用|要|有)(?:了)?一[件步个招点句条]",
    "正是恰恰是": r"正是(?:因为|这|由于)|恰恰是|恰恰相反",
    "从…到…": r"从[^，。]{1,8}到[^，。]{1,8}[，,]从",
    "序数": r"第[一二三四五六七八九十]|[一二三四五]是|其[一二三]",
    "问题来了": r"问题来了|那么问题|问题是[，,]|那为什么|这是为什么|为什么会这样|凭什么",
}
QUESTION = re.compile(r"为什么|为啥|凭啥|是不是|有没有|能不能|会不会|对不对|好不好|要不要|难道|怎么办|怎么回事|何必|岂|吗|呢[？?]|什么意思|怎么可能")
NUM = re.compile(r"\d+(?:\.\d+)?%?|百分之[零一二两三四五六七八九十百点]+|"
                 r"(?:[二两三四五六七八九十百千万亿零][零一二两三四五六七八九十百千万亿点多几余]*|一[零一二两三四五六七八九十百千万亿点]+)"
                 r"(?=[个年月日天号岁次倍元块人条种位名家台部米吨度分秒成届代期级层颗只张句篇块钱公里])")
PUNCT_ANY = r"[，。？！、：；,.?!:;…\u2014\s]+"
PUNCT_END = r"[。？！?!\n]+"


def han(s):
    return len(re.findall(r"[一-鿿A-Za-z0-9]", s))


def strip_punct(s):
    return re.sub(r"[\s，。？！、：；,.?!:;…\u2014\-~～·\"'“”‘’（）()《》〈〉【】\[\]「」『』<>*#]+", "", s)


def _per_k(n, chars):
    return round(n / chars * 1000, 3) if chars else 0.0


def _count(words, text):
    return sum(text.count(w) for w in words)


def _lens(text, pat):
    return [han(c) for c in re.split(pat, text) if han(c) > 0]


def _cv(xs):
    return round(statistics.pstdev(xs) / statistics.mean(xs), 3) if len(xs) > 1 and statistics.mean(xs) else 0.0


def _adj(xs):
    """相邻两段长度差的平均值，除以平均长度。一长一短交替时高，整齐划一时低。"""
    if len(xs) < 2:
        return 0.0
    return round(statistics.mean(abs(a - b) for a, b in zip(xs, xs[1:])) / statistics.mean(xs), 3)


def _mattr(tokens, win=100):
    if len(tokens) < win:
        return round(len(set(tokens)) / max(1, len(tokens)), 3)
    c = Counter(tokens[:win])
    total = len(c)
    for i in range(win, len(tokens)):
        out = tokens[i - win]
        c[out] -= 1
        if not c[out]:
            del c[out]
        c[tokens[i]] += 1
        total += len(c)
    return round(total / (len(tokens) - win + 1) / win, 3)


def _entropy(seq):
    c = Counter(seq)
    n = sum(c.values())
    return round(-sum(v / n * math.log2(v / n) for v in c.values()), 3) if n else 0.0


def rhythm(text, prefix=""):
    cl = _lens(text, PUNCT_ANY)
    sl = [x for x in _lens(text, PUNCT_END) if x > 1]
    if not cl or not sl:
        return {}
    sd, mu = statistics.pstdev(sl), statistics.mean(sl)
    return {
        f"{prefix}分句均长": round(statistics.mean(cl), 2), f"{prefix}分句中位": statistics.median(cl),
        f"{prefix}分句长度变异": _cv(cl), f"{prefix}分句相邻起伏": _adj(cl),
        f"{prefix}碎分句占比": round(sum(1 for c in cl if c <= 4) / len(cl), 3),
        f"{prefix}长分句占比": round(sum(1 for c in cl if c >= 20) / len(cl), 3),
        f"{prefix}整句均长": round(mu, 2), f"{prefix}整句长度变异": _cv(sl), f"{prefix}整句相邻起伏": _adj(sl),
        f"{prefix}句长突发度": round((sd - mu) / (sd + mu), 3) if sd + mu else 0.0,
        f"{prefix}每句分句数": round(len(cl) / len(sl), 2),
    }


def parallel(ruled):
    """排比和对仗，在统一断句后的文本上数。"""
    clauses = [c for c in re.split(PUNCT_ANY, ruled) if han(c) >= 2]
    ana3 = ana2 = iso = 0
    run = 1
    for a, b in zip(clauses, clauses[1:]):
        same = a[:2] == b[:2]
        run = run + 1 if same else 1
        if same:
            ana2 += 1
        if run == 3:
            ana3 += 1
        if same or (4 <= han(a) == han(b) <= 12 and a[-1] == b[-1]):
            if 4 <= han(a) == han(b):
                iso += 1
    tri = len(re.findall(r"[^，。、？！]{1,8}、[^，。、？！]{1,8}(?:、|和|以及|与|还有)[^，。、？！]{1,8}", ruled))
    pair = len(re.findall(r"(?<![、])[^，。、？！]{1,8}(?:和|与|以及)[^，。、？！]{1,8}", ruled))
    return ana2, ana3, iso, tri, pair


def extract(plain, ruled, own=None, pause_groups=None, seconds=None):
    plain = strip_punct(plain)
    n = han(plain)
    if n < 100:
        return {"字数": n}
    f = {"字数": n}
    pairs = [(w, fl) for w, fl in pseg.cut(ruled) if han(w) > 0]
    toks = [w for w, _ in pairs]
    nt = len(toks)
    tc = Counter(toks)

    # ---- 节奏
    f.update(rhythm(ruled))
    if own:
        f.update(rhythm(own, "原标点_"))
        f["原标点_破折号"] = _per_k(len(re.findall(r"\u2014\u2014|\u2014", own)), n)
        f["原标点_冒号"] = _per_k(len(re.findall(r"[：:]", own)), n)
        f["原标点_问号"] = _per_k(len(re.findall(r"[？?]", own)), n)
        f["原标点_叹号"] = _per_k(len(re.findall(r"[！!]", own)), n)
        f["原标点_引号"] = _per_k(len(re.findall(r"[“「『]", own)), n)
        f["原标点_省略号"] = _per_k(len(re.findall(r"……|\.\.\.", own)), n)
        paras = [p for p in re.split(r"\n\s*\n|\n", own) if han(p) > 0]
        f["原标点_段落均长"] = round(statistics.mean(han(p) for p in paras), 1) if paras else 0
        f["原标点_段落数"] = len(paras)
    if pause_groups:
        pl = [han(g) for g in pause_groups if han(g) > 0]
        f["气口均长"] = round(statistics.mean(pl), 2)
        f["气口长度变异"] = _cv(pl)
        f["气口相邻起伏"] = _adj(pl)
    if seconds:
        f["语速_字每秒"] = round(n / seconds, 2)

    # ---- 词汇
    f["词汇丰富度MATTR"] = _mattr(toks)
    f["平均词长"] = round(sum(len(t) for t in toks) / nt, 3)
    f["四字词"] = _per_k(sum(1 for t in toks if len(t) == 4 and re.fullmatch(r"[一-鿿]{4}", t)), n)
    f["成语"] = _per_k(sum(1 for _, fl in pairs if fl == "i"), n)
    f["文言虚词"] = _per_k(sum(tc[c] for c in CLASSICAL), n)
    f["名词化动词"] = _per_k(sum(tc[w] for w in NOMINAL), n)
    f["性化结尾抽象词"] = _per_k(sum(v for t, v in tc.items() if len(t) >= 3 and t[-1] in "性化"), n)
    f["口语俗词"] = _per_k(sum(tc[w] for w in COLLOQ), n)
    f["实词占比"] = round(sum(1 for _, fl in pairs if fl[:1] in "nva") / nt, 3)
    f["叠词"] = _per_k(sum(v for t, v in tc.items() if re.fullmatch(r"(.)\1", t) and t not in ("谢谢", "爸爸", "妈妈", "哈哈", "嗯嗯"))
                      + len(re.findall(r"([一-鿿])[了一]\1", plain)) + len(re.findall(r"([一-鿿])\1([一-鿿])\2", plain)), n)
    f["儿化"] = _per_k(sum(v for t, v in tc.items() if len(t) >= 2 and t.endswith("儿") and t not in ("儿儿", "女儿", "婴儿", "幼儿", "孤儿")), n)
    f["英文词"] = _per_k(sum(1 for t in toks if re.fullmatch(r"[A-Za-z][A-Za-z0-9\-]+", t)), n)

    # ---- 语气
    f["语气词"] = _per_k(sum(v for t, v in tc.items() if len(t) == 1 and t in PARTICLES) + sum(1 for w, fl in pairs if fl in ("y", "e") and not (len(w) == 1 and w in PARTICLES) and w not in ("了", "的", "吗")), n)
    for p in "啊呢吧嘛呀哈":
        f[f"语气词_{p}"] = _per_k(tc[p], n)
    f["口头话语标记"] = _per_k(_count(ORAL_MARK, plain), n)
    f["书面连接词"] = _per_k(_count(WRITTEN_CONN, plain), n)
    f["口头连接词"] = _per_k(_count(ORAL_CONN, plain), n)
    wc, oc = _count(WRITTEN_CONN, plain), _count(ORAL_CONN, plain)
    f["书面连接词占比"] = round(wc / (wc + oc), 3) if wc + oc else 0.0
    f["口语程度词"] = _per_k(sum(tc[w] for w in STANCE_ORAL), n)
    f["书面程度词"] = _per_k(_count(STANCE_WRITTEN, plain), n)
    f["意外转折副词"] = _per_k(_count(SURPRISE, plain), n)
    f["限定词"] = _per_k(_count(HEDGE, plain), n)
    f["就是"] = _per_k(plain.count("就是"), n)
    f["然后"] = _per_k(plain.count("然后"), n)
    f["其实"] = _per_k(plain.count("其实"), n)
    f["这个那个"] = _per_k(tc["这个"] + tc["那个"], n)
    f["连续重复"] = _per_k(sum(1 for a, b in zip(toks, toks[1:]) if a == b and (len(a) >= 2 or a in "我你他这那就是不")), n)

    # ---- 人称
    for k, ws in {"我": ["我"], "我们": ["我们"], "咱": ["咱", "咱们"], "你": ["你"], "你们": ["你们"], "大家": ["大家", "各位"], "他她它": ["他", "她", "它", "他们", "她们", "它们"]}.items():
        f[f"人称_{k}"] = _per_k(sum(tc[w] for w in ws), n)
    first = f["人称_我"] + f["人称_我们"] + f["人称_咱"]
    f["第一人称"] = round(first, 3)
    f["我占第一人称"] = round(f["人称_我"] / first, 3) if first else 0.0
    f["称呼观众"] = round(f["人称_你"] + f["人称_你们"] + f["人称_大家"] + _per_k(_count(["朋友们", "同学们", "兄弟们", "小伙伴"], plain), n), 3)

    # ---- 问句
    f["疑问标记"] = _per_k(len(QUESTION.findall(plain)) + tc["吗"], n)
    f["问句占比_统一断句"] = round(len(re.findall(r"[？?]", ruled)) / max(1, len(_lens(ruled, PUNCT_END))), 3)

    # ---- 具体性
    f["数字表达"] = _per_k(len(NUM.findall(plain)), n)
    f["专名"] = _per_k(sum(1 for _, fl in pairs if fl in ("nr", "ns", "nt", "nz")), n)
    f["例子标记"] = _per_k(_count(EXAMPLE[:10], plain), n)
    f["模糊归因"] = _per_k(_count(VAGUE_SRC, plain), n)

    # ---- 套话和句式
    f["空词"] = _per_k(_count(BUZZ, plain), n)
    f["套话"] = _per_k(_count(STOCK, plain), n)
    f["抬高意义词"] = _per_k(_count(ELEVATE, plain), n)
    f["说教"] = _per_k(_count(PREACH, plain), n)
    tpl_total = 0
    for name, pat in TEMPLATES.items():
        c = len(re.findall(pat, ruled))
        f[f"句式_{name}"] = _per_k(c, n)
        if name != "序数":
            tpl_total += c
    f["句式模板合计"] = _per_k(tpl_total, n)
    ana2, ana3, iso, tri, pair = parallel(ruled)
    f["排比_两连同开头"] = _per_k(ana2, n)
    f["排比_三连同开头"] = _per_k(ana3, n)
    f["对仗_等长"] = _per_k(iso, n)
    f["三项并列"] = _per_k(tri, n)
    f["三项占并列比"] = round(tri / (tri + pair), 3) if tri + pair else 0.0

    # ---- 信息论（取前 1500 字，免受篇幅影响）
    head = plain[:1500]
    f["字熵"] = _entropy(head)
    f["词熵"] = _entropy(toks[:800])
    f["压缩率"] = round(len(zlib.compress(head.encode("utf-8"), 9)) / max(1, len(head.encode("utf-8"))), 3)
    g4 = Counter(head[i:i + 4] for i in range(len(head) - 3))
    f["四字串重复率"] = round(sum(v for v in g4.values() if v > 1) / max(1, sum(g4.values())), 3)

    # ---- 开头和结尾
    op = plain[:80]
    f["开头_有问候"] = int(bool(GREET.search(plain[:60])))
    f["开头_有疑问"] = int(bool(QUESTION.search(op)))
    f["开头_有你"] = int("你" in op)
    f["开头_有我"] = int("我" in op)
    f["开头_有数字"] = int(bool(NUM.search(op)))
    first_s = [x for x in _lens(ruled, PUNCT_END)][:1]
    f["开头_首句字数"] = first_s[0] if first_s else 0
    m = re.search("你", plain)
    f["首个你的位置"] = m.start() if m else n
    ed = plain[-200:]
    f["结尾_三连"] = int(bool(CTA.search(ed)))
    f["结尾_道别"] = int(bool(BYE.search(ed)))
    f["结尾_升华词"] = len(UPLIFT.findall(ed))
    f["全篇_三连次数"] = len(CTA.findall(plain))
    return f
