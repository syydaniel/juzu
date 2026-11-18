"""给口播稿打「像 AI」的概率，列出要改的地方和推分最多的几项。

用法：
  python scripts/copy/score.py vo/草稿.txt [--json] [--top 14] [--max 0.4]

输入和 flavor.py 一样：「键|文本」的稿子、vo/lines.py 或纯文本，【…】里的备注不算。
输出依次是：字数和 AI 概率（0 像真人，1 像 AI）；超出真人常见范围的指标和改法；
AI 爱用、这篇也用多了的词和起句；值得再看一眼的句子；把分数往「像 AI」推得最多的 10 项和往「像真人」拉得最多的 6 项。
AI 概率高于 --max（默认 0.4）时退出码是 1，否则是 0。稿子不到 100 字没法打分，退出码 2。

要的包见 requirements.txt。比较重的是标点模型：第一次运行会下载 FunASR 的 ct-punc（约 1 GB）。
打分前先用它把整篇重新断句，因为模型训练时两边的稿子都是这么断的；直接用自己打的标点，
测试稿的分数会从 0.39 变成 0.68。它默认跑 CPU，五千字的稿子整次运行四十秒上下；
Apple 芯片上设 JUZU_PUNC_DEVICE=mps 会快一些。下载慢的话设 JUZU_PUNC_HUB=ms，改从 ModelScope 下。
"""
import argparse
import json
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore", category=SyntaxWarning)  # jieba 在新版 Python 上的转义警告

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from _draft import full_text

try:
    import jieba
    jieba.setLogLevel(60)
    from scorer import scorer as S
except ImportError as e:
    sys.exit(f"缺 Python 包 {e.name}。装法见 {HERE / 'requirements.txt'}")


def main():
    ap = argparse.ArgumentParser(description="口播稿的 AI 概率和修改意见")
    ap.add_argument("file")
    ap.add_argument("--json", action="store_true", help="输出 JSON")
    ap.add_argument("--top", type=int, default=14, help="最多列几条指标问题")
    ap.add_argument("--max", type=float, default=0.4, help="AI 概率超过它就返回 1")
    a = ap.parse_args()

    text = full_text(a.file)
    from scorer.features import han, strip_punct
    if han(strip_punct(text)) < 100:
        print("稿子不到 100 字，没法打分。")
        return 2
    res = S.score(text)
    if a.json:
        print(json.dumps({k: v for k, v in res.items() if k != "指标"}, ensure_ascii=False, indent=1))
    else:
        print(f"字数 {res['字数']}，AI 概率 {res['AI概率']}（0 像真人，1 像 AI；目标 {a.max} 以下）")
        print(S.feedback(res, top=a.top) or "没有超出真人常见范围的项目")
        print("往「像 AI」推的：")
        for r in res["推向AI"]:
            print(f"  {r['指标']}  现在 {r['现在']:.2f}  均值 {r['均值']:.2f}  贡献 {r['贡献']:+.2f}")
        print("往「像真人」拉的：")
        for r in res["拉向真人"]:
            print(f"  {r['指标']}  现在 {r['现在']:.2f}  均值 {r['均值']:.2f}  贡献 {r['贡献']:+.2f}")
    return 1 if res["AI概率_原值"] > a.max else 0


if __name__ == "__main__":
    sys.exit(main())
