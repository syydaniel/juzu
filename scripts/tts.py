"""用参考音克隆配音（Qwen3-TTS Base，Apple 芯片上的 mlx 版）。
  juzu.py tts [句子键…]      不给键 = 只做文本有改动的句子；给了键 = 强制重做这几句
  juzu.py tts --repick       不用显卡：拿已经念过的每一遍原声，按现在的停顿设置重新压停顿、重新挑（改了 episode.json 的 voice 以后先跑这个）
  juzu.py tts --off          只重做语速超出目标范围的句子（先 --repick，再 --off）
  juzu.py tts --cut          只重做句尾被截断、又没有别的遍可换的句子（先 --repick，再 --cut）
每句念几遍，用 Whisper 听写核对，选听写最准、句尾自然收住、语速最接近目标的一遍，再把句内过长的停顿压短。
句尾被截断（模型在发声中途停了，最后 20 毫秒还高于 -45 dBFS）的那一遍尽量不用：75 期作者听出「切音」，量下来四成的遍句尾没收干净。
存成品时每句头尾都淡一下（头 4 毫秒、尾 30 毫秒），去掉咔嗒声。
成品不做时间拉伸（拉伸会出电音）：想说快一点，就给模型一条加快过的参考音。

这一集自己的语速写在 episode.json 的 "voice" 里（66 期作者：「语速稳定一点、平缓一点，按原声的 1.03 到 1.05 倍」）：
  "voice": {"speed": 1.04, "rate": 5.52, "tol": 0.05, "keep": 0.40, "longest": 0.60, "takes": 6}
  speed    参考音 = 原声（config 的 voice_ref）加快这么多倍，存成 vo/ref_x<speed>.wav；不写就用 config 的 voice_ref_fast
  rate     目标语速（字/秒，压完停顿以后算）；不写就用 config 的 voice_rate。66 期的参考原声是 5.31
  tol      语速允许偏离目标的比例：每句至少念 2 遍，直到有一遍听写 ≥ 0.95 而且落在范围里，最多念 takes 遍
  keep / longest   句内长于 longest 秒的停顿压到 keep 秒（默认 0.28 / 0.40，偏急；平缓一点用 0.40 / 0.60）
  force    {"句子键": 第几遍}：听写误判了同音字时，手动指定用哪一遍"""
import sys, json, difflib, re, subprocess
from pathlib import Path
import numpy as np, soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
from common import cfg, ep, load_lines, log

C, E = cfg(), ep()
LINES, _ = load_lines(E)
OUT = E / 'vo/me'; (OUT / 'takes').mkdir(parents=True, exist_ok=True)
VC = (json.load(open(E / 'episode.json')).get('voice', {}) if (E / 'episode.json').exists() else {})
RATE = float(VC.get('rate', C['voice_rate'])); TOL = VC.get('tol'); KEEP, LONGEST = VC.get('keep', .28), VC.get('longest', .40)
MAX_TAKES = int(VC.get('takes', 4))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
REPICK, OFF, CUT = '--repick' in sys.argv, '--off' in sys.argv, '--cut' in sys.argv
CUT_DB = float(VC.get('cut_db', -45))

DIG = '〇一二三四五六七八九'
def norm(s):
    s = re.sub(r'\d', lambda m: DIG[int(m.group(0))], s)
    return re.sub(r'[^\w]', '', s).lower().replace('零', '〇').replace('两', '二')

def trim(a, sr):
    idx = np.where(np.abs(a) > 0.01)[0]
    return a[max(0, idx[0] - int(0.03 * sr)): idx[-1] + int(0.25 * sr)] if len(idx) else a

def end_level(a, sr, ms=20):
    """去掉末尾的数字静音以后，最后 ms 毫秒的电平（dBFS）。自然收尾的句子这里已经衰减到 -50 以下；还高，说明模型在发声中途停了（切音）。"""
    nz = np.where(np.abs(a) > 1e-4)[0]
    if not len(nz):
        return -120.0
    e = nz[-1] + 1; n = int(sr * ms / 1000)
    return round(float(20 * np.log10(np.sqrt(np.mean(a[max(0, e - n):e] ** 2)) + 1e-9)), 1)

def is_cut(x):
    return x.get('end', -120) > CUT_DB

def smooth_ends(a, sr, fin=.004, fout=.03, fcut=.09):
    """头 4 毫秒淡入、尾 30 毫秒余弦淡出：只为去掉咔嗒声。被截掉的字救不回来，所以挑遍时先挑自然收尾的。
    实在没有自然收尾的一遍（75 期 c09「超人」、g07「赞吧」、b01「四千多万」念了七八遍都停在 -37 dB 上下，多是 n 结尾的鼻音还在响），
    尾巴淡 90 毫秒，听着像鼻音自己收住，不像一刀切。"""
    a = a.copy(); nz = np.where(np.abs(a) > 1e-4)[0]
    if not len(nz):
        return a
    e = nz[-1] + 1; n = min(int((fcut if end_level(a, sr) > CUT_DB else fout) * sr), e)
    a[e - n:e] *= (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, n))).astype(a.dtype)
    m = min(int(fin * sr), len(a)); a[:m] *= np.linspace(0, 1, m).astype(a.dtype)
    return a

def tighten(a, sr, keep=0.28, longest=0.40):
    """只动静音：句内长于 longest 秒的停顿压到 keep 秒。"""
    hop = sr // 100
    fr = np.sqrt((a[: len(a) // hop * hop].reshape(-1, hop) ** 2).mean(1)) + 1e-9
    db = 20 * np.log10(fr); q = db < np.percentile(db, 90) - 40
    out, last, i = [], 0, 0
    while i < len(q):
        if q[i]:
            j = i
            while j < len(q) and q[j]:
                j += 1
            if (j - i) * hop > longest * sr and i > 0 and j < len(q):
                mid = (i + j) // 2 * hop; half = int(keep * sr / 2); fade = int(0.015 * sr)
                seg = a[last: mid - half].copy(); seg[-fade:] *= np.linspace(1, 0, fade)
                out.append(seg); last = mid + half
                a[last: last + fade] *= np.linspace(0, 1, fade)
            i = j
        else:
            i += 1
    out.append(a[last:])
    return np.concatenate(out)

def ok_rate(r):
    return TOL is None or abs(r - RATE) <= TOL * RATE

def pick(takes):
    """听写最准的那几遍里（差 0.015 以内；设了 tol 时放宽到 0.035，而且不低于 0.9），挑语速最接近目标的。
    放宽是因为 66 期的 a03：「R 星」每遍都被听成「阿星」「二星」，0.03 的差只是听写的误差，语速 5.50 的那遍反而被挤掉了。
    句尾被截断的排在最后（75 期）：语速差 1% 听不出来，切音一耳朵就听出来。"""
    top = max(x['acc'] for x in takes); slack = .035 if TOL else .015
    pool = [x for x in takes if x['acc'] >= min(top, max(.9, top - slack))]
    return min(pool, key=lambda x: (is_cut(x), not ok_rate(x['rate']), abs(x['rate'] - RATE)))

def measure(p, text):
    """一遍原声 → 压停顿以后的音频和语速。"""
    a, sr = sf.read(p); a = a.mean(1) if a.ndim > 1 else a
    tk = tighten(a.astype(np.float32).copy(), sr, KEEP, LONGEST)
    return tk, sr, round(len(norm(text)) / (len(tk) / sr), 2)

cf = OUT / 'choice.json'
choice = json.load(open(cf)) if cf.exists() else {}

FORCE = VC.get('force', {})     # 听过以后指定用第几遍：{"d09": 7}（66 期：第 7 遍听写成「悄悄眉的」，眉和没同音，念得没错）

def save(k, takes, text):
    best = takes[FORCE[k]] if k in FORCE and FORCE[k] < len(takes) else pick(takes); i = takes.index(best)
    tk = np.load(OUT / 'takes' / f'{k}_{i}.npy'); f = OUT / f'{k}.wav'; sf.write(f, smooth_ends(tk, 24000), 24000)
    choice[k] = dict(best, file=str(f.relative_to(E)), text=text, tries=len(takes), takes=takes)
    json.dump(choice, open(cf, 'w'), ensure_ascii=False, indent=1)

def report(tag):
    r = [c['rate'] for k, c in choice.items() if k in LINES]
    off = sorted(k for k, c in choice.items() if k in LINES and not ok_rate(c['rate']))
    low = [k for k, c in choice.items() if c['acc'] < 0.9]
    cut = sorted(k for k, c in choice.items() if k in LINES and is_cut(c))
    msg = (f"{tag}：{len(r)} 句，共 {round(sum(c['dur'] for c in choice.values()), 1)} 秒；语速平均 {np.mean(r):.2f} 字/秒（目标 {RATE}），"
           f"标准差 {np.std(r):.2f}，{min(r)}–{max(r)}；超出范围的：{off or '无'}；听写准确率低于 0.9 的：{low or '无'}；"
           f"句尾被截断的：{cut or '无'}" + ('（跑 juzu.py tts --cut 重念）' if cut else ''))
    print('DONE', msg); log(E, '2-配音', '配音：' + msg)
    return off

if REPICK:
    # 每一遍的原声都在 takes/<键>_<第几遍>.wav；按现在的 keep / longest 重压停顿，重新算语速，重新挑。
    # 每一遍的听写准确率：choice.json 里有就用；老版本只记了选中的那一遍，就从 out/tts*.log 里那一行「a01 2 acc 0.95 …」读；都没有才重新听写
    LOGGED = {}
    for lf in sorted((E / 'out').glob('tts*.log'), key=lambda p: p.stat().st_mtime):
        for ln in lf.read_text(errors='ignore').splitlines():
            mm = re.match(r'^(\w+) (\d+) acc ([\d.]+) dur [\d.]+s rate [\d.]+ ?(.*)$', ln)
            if mm: LOGGED[f'{mm[1]}_{mm[2]}.wav'] = dict(acc=float(mm[3]), asr=mm[4].strip())
    for k, (_, text, _, _) in LINES.items():
        if k not in choice or choice[k].get('text') != text:
            continue
        old = {**LOGGED, **{Path(x['take']).name: x for x in choice[k].get('takes', [])}}
        if 'takes' not in choice[k]: old[Path(choice[k]['take']).name] = choice[k]
        takes = []
        for i in range(choice[k].get('tries', 1) + 8):
            p = OUT / 'takes' / f'{k}_{i}.wav'
            if not p.exists():
                break
            tk, sr, rate = measure(p, text); np.save(OUT / 'takes' / f'{k}_{i}.npy', tk.astype(np.float32))
            acc = old.get(p.name, {}).get('acc')
            if acc is None:        # 老的 choice.json 只记了选中的那一遍：其余几遍重新听写一次
                import mlx_whisper
                asr = mlx_whisper.transcribe(str(p), path_or_hf_repo=C['whisper_model'], language='zh', initial_prompt='以下是普通话的句子，夹杂少量英文单词。')['text']
                acc = round(difflib.SequenceMatcher(None, norm(text), norm(asr)).ratio(), 3); a_txt = asr.strip()
            else:
                a_txt = old[p.name].get('asr', '')
            takes.append(dict(take=str(p), acc=acc, dur=round(len(tk) / sr, 3), rate=rate, asr=a_txt, end=end_level(tk, sr)))
        if takes:
            save(k, takes, text)
            print(k, f"{len(takes)} 遍 → 选第 {Path(choice[k]['take']).stem.split('_')[-1]} 遍 rate {choice[k]['rate']}" + ('' if ok_rate(choice[k]['rate']) else '  超出范围'), flush=True)
    report('重新挑（没用显卡）')
    sys.exit(0)

import mlx_whisper
WH = C['whisper_model']
# 参考音：episode.json 写了 voice.speed 就用原声按这个倍数加快；否则优先用配置里现成的加快版；都没有就按 config 的 voice_speed 加快
if VC.get('speed'):
    REF = E / f"vo/ref_x{VC['speed']}.wav"
    if not REF.exists():
        subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', C['voice_ref'], '-af', f"atempo={VC['speed']}", '-ar', '24000', '-ac', '1', str(REF)])
else:
    REF = Path(C['voice_ref_fast']) if C.get('voice_ref_fast') and Path(C['voice_ref_fast']).exists() else E / 'vo/ref_fast.wav'
    if not REF.exists():
        assert C.get('voice_ref') and Path(C['voice_ref']).exists(), '配置里没有可用的参考音：在 config.json 里填 voice_ref（一段 10 到 20 秒、干净的本人录音）'
        subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', C['voice_ref'], '-af', f"atempo={C['voice_speed']}", '-ar', '24000', '-ac', '1', str(REF)])
rt = Path(C['voice_ref_text']) if C.get('voice_ref_text') and Path(C['voice_ref_text']).exists() else E / 'vo/ref.txt'
if not rt.exists():
    rt.write_text(mlx_whisper.transcribe(str(REF), path_or_hf_repo=WH, language='zh', initial_prompt='以下是普通话的句子。')['text'].strip())
REF_TXT = rt.read_text().strip()
print('参考音：', REF.name, '｜参考文本：', REF_TXT[:30], '…', f'｜目标语速 {RATE}' + (f' ±{TOL:.0%}' if TOL else ''), flush=True)

from mlx_audio.tts.utils import load_model
m = load_model(C['tts_model'])
if CUT:
    keys = [k for k in LINES if k in choice and is_cut(choice[k])]; force = True
    print('句尾被截断、要重念的：', keys, flush=True)
elif OFF:
    keys = [k for k in LINES if k in choice and not ok_rate(choice[k]['rate'])]; force = True
    print('超出范围、要重做的：', keys, flush=True)
else:
    force = bool(args); keys = args or list(LINES)
n_takes = 0
for k in keys:
    text = LINES[k][1]
    if k in choice and choice[k].get('text') == text and not force:
        continue
    # 重做（--off 或者给了键）时，从没用过的编号接着念，前几遍留着一起挑
    takes = list(choice[k].get('takes', [])) if k in choice and choice[k].get('text') == text else []
    start = len(takes)
    for t in range(start, start + MAX_TAKES):
        done = [x for x in takes if x['acc'] >= .95 and ok_rate(x['rate']) and not is_cut(x)] if TOL else [x for x in takes if x['acc'] >= .97 and not is_cut(x)]
        if done and t - start >= 2:
            break
        res = list(m.generate(text=text, ref_audio=str(REF), ref_text=REF_TXT, language='Chinese'))
        sr = res[0].sample_rate
        a = trim(np.concatenate([np.array(r.audio) for r in res]), sr)
        p = OUT / 'takes' / f'{k}_{t}.wav'; sf.write(p, a, sr)
        asr = mlx_whisper.transcribe(str(p), path_or_hf_repo=WH, language='zh', initial_prompt='以下是普通话的句子，夹杂少量英文单词。')['text']
        acc = difflib.SequenceMatcher(None, norm(text), norm(asr)).ratio()
        tk = tighten(a.copy(), sr, KEEP, LONGEST)
        np.save(OUT / 'takes' / f'{k}_{t}.npy', tk.astype(np.float32))
        takes.append(dict(take=str(p), acc=round(acc, 3), dur=round(len(tk) / sr, 3), rate=round(len(norm(text)) / (len(tk) / sr), 2), asr=asr.strip(), end=end_level(tk, sr)))
        n_takes += 1
        print(k, t, f"acc {acc:.2f} dur {takes[-1]['dur']:.1f}s rate {takes[-1]['rate']:.2f} end {takes[-1]['end']:.0f}dB{' 截断' if is_cut(takes[-1]) else ''}", asr.strip(), flush=True)
    save(k, takes, text)
for k in [k for k in choice if k not in LINES]:
    del choice[k]
json.dump(choice, open(cf, 'w'), ensure_ascii=False, indent=1)
report(f'这次念了 {n_takes} 遍')
