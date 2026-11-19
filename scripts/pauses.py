"""一句话里加停顿：timeline 排时间线、keep_slot 保住某一句的位置，用的是同一套算法。"""
import json, re
from pathlib import Path
import numpy as np
from common import wlen

SR = 24000
# 气口（65 期作者：「文字和文字之间的气口可以稍微再长一点，显得没有那么仓促」）。episode.json 里 "pause" 可以改：
#   scale / min：句与句之间停 max(min, 句后停顿 × scale)；section：换章节时至少停这么久；
#   inner：一句里面有句号、问号、感叹号的地方，在那附近找一段静音，再多停这么久（找不到够长的静音就不加，免得切到字）
#   comma：逗号、顿号、分号、冒号处也这样多停一点（66 期作者：「讲得平缓一点」；稿子都是只用逗号的长句，inner 用不上）


def params(E):
    PZ = json.load(open(E / 'episode.json')).get('pause', {}) if (E / 'episode.json').exists() else {}
    return PZ.get('scale', .72), PZ.get('min', .18), PZ.get('section', 0), PZ.get('inner', 0), PZ.get('comma', 0)


def widen(a, tts, P_IN, P_CM):
    """一句里的句号处多停 P_IN 秒、逗号处多停 P_CM 秒。返回新音频和插进去的位置 [(原来的秒, 加了几秒)]。"""
    if not (P_IN or P_CM):
        return a, []
    dur = len(a) / SR; total = wlen(tts); ins = []
    hop = int(.01 * SR); fr = np.sqrt(np.convolve(a ** 2, np.ones(hop) / hop, 'same')[::hop] + 1e-12); db = 20 * np.log10(fr / (fr.max() + 1e-9))
    for m in re.finditer(r'[。？！?!，、；：,;:]', tts):
        add = P_IN if m.group(0) in '。？！?!' else P_CM
        if not add or m.end() >= len(tts.rstrip()):
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
            at = (best[1] + best[0] / 2) / 100
            near = [x for x in ins if abs(x[0] - at) < .05]       # 两个标点找到了同一段静音：只加一次，取长的
            if near:
                ins[ins.index(near[0])] = (near[0][0], max(near[0][1], add))
            else:
                ins.append((at, add))
    if not ins:
        return a, []
    ins.sort()
    out, last = [], 0
    for at, d in ins:
        j = int(at * SR); out += [a[last:j], np.zeros(int(d * SR), a.dtype)]; last = j
    out.append(a[last:])
    return np.concatenate(out), ins
