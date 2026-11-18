"""出发布包，并做发布前的体检。  juzu.py publish [发布包目录] [--video 成片.mp4] [--expect 3840x2160@24]
不写目录就是这一集的 发布包/。上传和发布由用户自己来，这里只把东西备齐、查一遍。

发布包里有：
  成片_4K_3840x2160.mp4   out/final.mp4（达芬奇出的片）；同一个磁盘上用硬链接，不多占地方
  封面_横版_16比9_3840x2160.jpg、封面_横版_4比3_1440x1080.jpg、封面_竖版_3比4_1080x1440.jpg   从 cover/ 里按尺寸挑，有几张放几张
  发布文案.md             标题（几选一）、简介、章节时间、标签、置顶评论、各平台的说法。这一集目录里有就拷，没有就生成一份空架子
  字幕.srt                out/字幕.srt，没有就按时间线现做
  口播稿.md               按章节排好的定稿
  运行记录.md
  请戴耳机检查.md          机器查过什么、结果如何，以及只有耳朵能判断的时刻（按时间排好）
  体检.json

体检（只做机器能做的，不做 OCR）：
  成片的分辨率、帧率、时长、响度、真峰值、和 out/mix_ref.wav 的音画偏移、24 格联系表（见 verify.py）；
  config 里 banned_words 的字词：在发布包的所有文字、口播稿、时间线里的字幕、导演表、封面工程里找；
  身份泄露：本机的家目录路径、电脑用户名、config 里 private_words 的字词（真名、账号名），在同样这些文件里找，
  另外查片场 set/ 下的 .js .json（终端录屏的数据在这里，64 期抽帧时抓到过两处露出用户名的临时路径）。"""
import getpass, json, os, re, shutil, subprocess, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _snd import ep, cfg, cues, Clock, timeline, read_mono, mmss, log  # noqa: E402

COVERS = {(3840, 2160): '封面_横版_16比9_3840x2160', (1440, 1080): '封面_横版_4比3_1440x1080', (1080, 1440): '封面_竖版_3比4_1080x1440'}
TEXT = ('.md', '.txt', '.srt', '.json', '.js', '.mjs', '.html', '.svg', '.py')
FX_NAMES = {'air': '章节换段的一口气', 'chime': '小铃', 'tap': '轻敲', 'thud': '片尾的低音', 'bloom': '慢慢亮起来的和弦'}
SET_NAMES = {'tok': '字块落桌', 'stick': '贴截图（胶带声）', 'unroll': '纸展开', 'card': '立体卡翻出来', 'hopin': '小机器人跳进屏幕',
             'hopout': '小机器人跳出屏幕', 'pin': '图钉', 'rise': '牌子升起来'}


def img_size(p):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', str(p)],
                         capture_output=True, text=True).stdout.strip()
    try:
        w, h = out.split(',')[:2]; return int(w), int(h)
    except ValueError:
        return None


def link_or_copy(src, dst):
    if dst.exists() or dst.is_symlink():
        dst.unlink()
    try:
        os.link(src, dst)
    except OSError:
        shutil.copyfile(src, dst)


def srt(subs):
    ts = lambda x: f'{int(x // 3600):02d}:{int(x % 3600 // 60):02d}:{int(x % 60):02d},{int(round(x % 1 * 1000)) % 1000:03d}'
    return ''.join(f"{i}\n{ts(s['start'])} --> {ts(s['end'])}\n{s['text']}\n\n" for i, s in enumerate(subs, 1))


def chapters_text(TL):
    rows = []
    for c in TL.get('chapters', []):
        name = c.get('name') or ('开头' if not rows else '')
        if name:
            rows.append(f"{mmss(c['start'] if rows else 0)} {name}")
    return rows


def script_md(E, TL, st):
    rows = []
    p = E / 'vo/草稿.txt'
    if p.exists():
        rows = [l.split('|', 1) for l in p.read_text().strip().split('\n') if '|' in l]
    else:
        rows = [(k, v.get('sub') or v.get('tts', '')) for k, v in TL['lines'].items()]
    names = {c['sec']: c.get('name') for c in TL.get('chapters', [])}
    out = [f"# {st.get('name', E.name)} 口播稿（定稿）", '', f"{len(rows)} 句，成片 {mmss(TL['duration'])}。", '']
    cur = None
    for k, t in rows:
        if k[0] != cur:
            cur = k[0]; out += ['', f"## {cur} {names.get(cur) or ''}".rstrip(), '']
        out.append(f'- `{k}` {t}')
    return '\n'.join(out) + '\n'


def copy_skeleton(st, TL):
    ch = '\n'.join(chapters_text(TL)) or '（时间线里还没有章节名）'
    return f"""# {st.get('name', '')} 发布文案

成片 {mmss(TL['duration'])}，横屏 3840×2160，24 帧每秒。上传由用户来点。

## 标题（三选一）

1. 待填
2. 待填
3. 待填

## 封面

待填：用了哪张画面、钩子小字、大标题、副题。

## 简介

待填。片子里说的每个数字都要能在运行记录里找到。

{ch}

说明：
- 画面由代码逐帧渲染，没有使用图像或视频生成模型。旁白是本人声音的 AI 合成，配乐由 ACE-Step 生成。
- 环境声是现成的录音（写明来源和许可）。

## 标签

待填

## 置顶评论

待填

## 其他平台的说法

待填。各平台发布页都要勾选 AI 生成内容的声明。
"""


def scan(files, words):
    """在这些文件里找这些字词，返回 [(文件, 字词, 行号, 那一行)]。"""
    hits = []
    for f in files:
        try:
            if f.stat().st_size > 50e6:
                continue
            for i, line in enumerate(f.read_text(errors='ignore').split('\n'), 1):
                for w in words:
                    if w and w in line:
                        hits.append((f, w, i, line.strip()[:80]))
        except (OSError, UnicodeDecodeError):
            pass
    return hits


def text_files(*dirs, skip=('node_modules', '.git', 'out', '__pycache__')):
    fs = []
    for d in dirs:
        if d.is_file():
            fs.append(d); continue
        if not d.exists():
            continue
        for root, ds, names in os.walk(d):
            ds[:] = [x for x in ds if x not in skip]
            fs += [Path(root) / n for n in names if n.endswith(TEXT)]
    return fs


def masking(E, top=3, block=3.0):
    """人声在说话、配乐又相对最响的几处（按 3 秒一块算配乐比人声低多少 dB，差得最少的几块）。要有 out/stems。"""
    import numpy as np
    v, sr = read_mono(E / 'out/stems/vo.wav', 8000); m, _ = read_mono(E / 'out/stems/music.wav', 8000)
    n = int(block * sr); k = min(len(v), len(m)) // n
    db = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
    rows = []
    for i in range(k):
        vv, mm = v[i * n:(i + 1) * n], m[i * n:(i + 1) * n]
        if db(vv) > -40:
            rows.append((db(mm) - db(vv), i * block))
    rows.sort(reverse=True)
    picked = []
    for d, t in rows:
        if all(abs(t - p) > 20 for _, p in picked):
            picked.append((d, t))
        if len(picked) >= top:
            break
    return [(t, round(float(d), 1)) for d, t in sorted(picked, key=lambda x: x[1])]


def ear_list(E, C, ck, TL, rep):
    """请戴耳机检查.md 的正文：只有耳朵能判断的时刻，按时间排。"""
    must, n = [], 1
    for name, A in C.get('ambience', {}).items():
        if not isinstance(A, dict) or 'segments' not in A:
            continue
        t0 = ck.at(A.get('at', 0)); segs = A['segments']; rel = lambda v: ck.at(v) - t0 if isinstance(v, str) else float(v)   # 时间写法或段内秒数
        desc = '；'.join(f"{mmss(t0 + rel(s['from']))} " + ' + '.join(L.get('role', '') + ' ' + Path(L['file']).stem for L in s['layers'])
                        for s in segs)
        must.append((t0, f"**{mmss(t0)}–{mmss(t0 + rel(A['dur']))} 环境声 {name}**：{desc}。环境声比配乐低 {A.get('under_music', 7)} LU。"
                         '听两件事：是不是刚好垫在音乐底下、不抢；切画面时跟着一起换，会不会突兀。'))
    ev = []
    if (E / 'out/sfx_set.wav').exists():
        from set_fx import placed   # 和 set_fx 摆声音用同一份：加上 extra、去掉 off、同一刻的并成一声
        ev, _ = placed(E, C.get('set_fx', {}), ck)
        if ev:
            ts = sorted(x['t'] for x in ev)
            best = max(ts, key=lambda t: sum(1 for u in ts if t <= u < t + 10))
            cnt = sum(1 for u in ts if best <= u < best + 10)
            must.append((best, f"**{mmss(best)}–{mmss(best + 10)} 片场动作声最密的 10 秒**（{cnt} 声）：听会不会太碎、太密。"))
            first = {}
            for x in ev:
                first.setdefault(x['kind'], x['t'])
            for k, t in first.items():
                if k in ('hopin', 'unroll'):
                    must.append((t, f"**{mmss(t)} 第一次{SET_NAMES.get(k, k)}**：听音色合不合适。"))
    for s in C.get('sfx_soft', []):
        nm = s['name'].rstrip('0123456789')
        if nm in ('chime', 'thud', 'bloom'):
            t = ck.at(s['at']); must.append((t, f"**{mmss(t)} {FX_NAMES.get(nm, nm)}**（{s['at']}）"))
    if (E / 'out/stems/vo.wav').exists():
        for t, d in masking(E):
            must.append((t, f"**{mmss(t)}–{mmss(t + 3)} 配乐相对最响的地方**（比人声只低 {-d} dB）：听会不会盖过人声。"))
    must.sort(key=lambda x: x[0])
    out = ['## 一定要听的', '']
    for t, s in must:
        out.append(f'{n}. {s}'); n += 1
    plan = C.get('plan', [])
    changes = [ck.at(p['from']) for i, p in enumerate(plan) if i and p['bed'] != plan[i - 1]['bed']]
    airs = [ck.at(s['at']) - s.get('pre', 0) for s in C.get('sfx_soft', []) if s['name'].startswith('air')]
    if changes or airs:
        out += ['', '## 换段的地方', '']
        if changes:
            out.append('铺底配乐在这几处换段：' + '、'.join(mmss(t) for t in changes) + '。听有没有突兀、有没有一下子断掉。')
        if airs:
            out.append('章节开头的气声：' + '、'.join(mmss(t) for t in airs) + '。')
    if ev:
        c = {}
        for x in ev:
            c[x['kind']] = c.get(x['kind'], 0) + 1
        out += ['', '## 片场动作的音效', '', f'一共 {len(ev)} 声，基准比章节气声低 4 dB：']
        out += [f'- {SET_NAMES.get(k, k)} {v} 声' for k, v in sorted(c.items(), key=lambda x: -x[1])]
    out += ['', '## 配音', '', '有没有念错的多音字、语气对不对。配音时听写准确率低于 0.9 的句子记在运行记录里配音那一条，先听那几句。']
    out += ['', '哪一声不舒服，把时间告诉我。改声音只要重出分轨、在达芬奇里重新出片，不用重渲画面。']
    return '\n'.join(out) + '\n'


if __name__ == '__main__':
    E = ep(); K = cfg(); C = cues(E); a = sys.argv[1:]
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    pos = [x for i, x in enumerate(a) if not x.startswith('--') and (i == 0 or a[i - 1] not in ('--video', '--expect'))]
    D = Path(pos[0]) if pos else E / '发布包'; D.mkdir(parents=True, exist_ok=True)
    st = json.load(open(E / 'episode.json')); TL = timeline(E); ck = Clock(E)
    expect = opt('--expect', '3840x2160@24')
    problems = []

    # 成片和体检
    video = Path(opt('--video', E / 'out/final.mp4'))
    rep = {}
    readable = video.exists() and subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(video)],
                                                 capture_output=True).returncode == 0
    if video.exists() and not readable:   # 66 期：达芬奇还在写 final.mp4 时试跑 publish，ffprobe 读不了（moov atom not found），整个脚本报错退出
        problems.append(f'成片 {video} 还读不了，多半是达芬奇还在写（出完再跑）')
    elif video.exists():
        from verify import check
        rep = check(E, video, expect=expect, want_sheet=True)
        problems += rep['问题']
        link_or_copy(video, D / f"成片_4K_{rep['width']}x{rep['height']}.mp4" if rep['width'] >= 3840 else D / f"成片_{rep['width']}x{rep['height']}.mp4")
    else:
        problems.append(f'没有成片 {video}（达芬奇出片以后再跑）')

    # 封面
    got = {}
    for p in sorted((E / 'cover').glob('*')) if (E / 'cover').exists() else []:
        if p.suffix.lower() in ('.jpg', '.jpeg', '.png'):
            sz = img_size(p)
            if sz in COVERS:
                got[sz] = p
    for sz, name in COVERS.items():
        if sz in got:
            shutil.copyfile(got[sz], D / (name + got[sz].suffix.lower()))
        else:
            problems.append(f'cover/ 里没有 {sz[0]}×{sz[1]} 的封面')

    # 文字
    if (E / '发布文案.md').exists():
        shutil.copyfile(E / '发布文案.md', D / '发布文案.md')
    else:
        (D / '发布文案.md').write_text(copy_skeleton(st, TL)); problems.append('这一集还没有 发布文案.md，发布包里放的是空架子，要填')
    doc = (D / '发布文案.md').read_text()
    for h in ('标题', '简介', '置顶评论'):
        if h not in doc:
            problems.append(f'发布文案.md 里没有「{h}」')
    if '待填' in doc:
        problems.append('发布文案.md 里还有「待填」')
    sub = E / 'out/字幕.srt'
    (D / '字幕.srt').write_text(sub.read_text() if sub.exists() else srt(TL['subs']))
    (D / '口播稿.md').write_text(script_md(E, TL, st))
    if (E / '运行记录.md').exists():
        shutil.copyfile(E / '运行记录.md', D / '运行记录.md')

    # 禁用字和身份泄露
    pub = [f for f in text_files(D) if f.name not in ('请戴耳机检查.md', '体检.json')]   # 这两个是这里自己写的
    src = text_files(E / 'vo/草稿.txt', E / 'app/src/timeline.json', E / 'set', E / 'cover', E / 'cues.json')
    banned = [w for w in K.get('banned_words', []) if w]
    for f, w, i, line in scan(pub + src, banned):
        problems.append(f'禁用字「{w}」：{f.relative_to(E) if f.is_relative_to(E) else f.name} 第 {i} 行')
    home = os.path.expanduser('~'); user = getpass.getuser()
    private = [home, *([user] if len(user) >= 3 else []), *[w for w in K.get('private_words', []) if w]]
    seen = set()
    for f, w, i, line in scan(pub + src, private):
        if (f, w) in seen:
            continue
        seen.add((f, w))
        what = '本机路径' if w == home else '电脑用户名' if w == user else f'私人字词「{w}」'
        problems.append(f'{what}：{f.relative_to(E) if f.is_relative_to(E) else f.name} 第 {i} 行（这个文件里可能还有别处）')

    # 请戴耳机检查
    mach = ['机器能查的都查过了。', '']
    if rep:
        mach += [f"- **画面**：{rep['width']}×{rep['height']}，{rep['fps']:g} 帧，{mmss(rep['duration'])}，共 {rep['frames']} 帧。联系表 out/check_sheet.jpg（24 格）。",
                 f"- **声音**：响度 {rep['响度']} LUFS，真峰值 {rep['真峰值']} dB，LRA {rep['LRA']}。",
                 f"- **音画同步**：和混音参考在三处比，偏移 {rep['音画偏移毫秒']} 毫秒。"]
    mach += [f"- **禁用字**：config 里的 {len(banned)} 个禁用字词，在发布文案、字幕、口播稿、导演表、封面工程里找过。",
             f"- **身份**：本机路径、用户名{'、私人字词' if K.get('private_words') else ''}，同样这些文件加片场数据里找过。",
             f"- **问题**：{len(problems)} 个" + ('' if not problems else '，见 体检.json'), '']
    (D / '请戴耳机检查.md').write_text(f"# 请戴耳机检查（{st.get('name', E.name)}）\n\n" + '\n'.join(mach) + '\n下面这些只有耳朵能判断，按时间排好了。\n\n'
                                    + ear_list(E, C, ck, TL, rep))
    (D / '体检.json').write_text(json.dumps({**rep, '问题': problems}, ensure_ascii=False, indent=1))
    have = sorted(p.name for p in D.iterdir())
    print('发布包', D, '：', have)
    print('问题', len(problems), '个：' if problems else '个。')
    for p in problems:
        print('  -', p)
    print('停点：把发布包交给用户。不要替用户上传或发布。')
    # 运行记录会拷进发布包、下次还要被扫：这里写进去的问题不能带禁用字、本机路径和私人字词，不然自己报自己（65 期）
    def safe(p):
        for w in banned:
            p = p.replace(f'「{w}」', '')
        for w in private:
            p = p.replace(w, '~' if w == home else '＊')
        return p
    log(E, '7-宣发', f'发布包 {len(have)} 个文件，问题 {len(problems)} 个' + (f'：{[safe(p) for p in problems[:3]]}' if problems else ''))
    sys.exit(1 if problems else 0)
