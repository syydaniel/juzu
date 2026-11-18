#!/usr/bin/env python3
"""剧组的总入口：python3 ~/.claude/skills/juzu/scripts/juzu.py <命令> [参数…]
不带参数会列出全部命令。除了 new 和 doctor，其余命令都在某一集的目录里跑（或者设 JUZU_EP=那一集的目录）。
命令名就是脚本名：先找 scripts/<命令>.py，再找 scripts/copy/、scripts/sound/ 下面的同名脚本。"""
import subprocess, sys, os
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import cfg

# 每个命令用哪个 Python：配音要 mlx，作曲要 ACE-Step 的环境，其余用普通的（numpy、soundfile、scipy）
PY = {'tts': 'py_audio', 'timeline': 'py_audio', 'gen_beds': 'py_music'}
DIRS = [HERE, HERE / 'copy', HERE / 'sound']
SKIP = {'common', 'juzu', '__init__'}


def find(cmd):
    for d in DIRS:
        for ext in ('.py', '.mjs', '.sh'):
            p = d / (cmd + ext)
            if p.exists():
                return p
    return None


def listing():
    print(__doc__)
    for d in DIRS:
        if not d.exists():
            continue
        rows = []
        for p in sorted(d.iterdir()):
            if p.suffix not in ('.py', '.mjs', '.sh') or p.stem in SKIP or p.stem.startswith('_'):
                continue
            first = ''
            try:
                txt = p.read_text()
                if p.suffix == '.py' and '"""' in txt:
                    first = txt.split('"""')[1].strip().split('\n')[0]
                else:
                    first = next((l.lstrip('/#').strip() for l in txt.split('\n') if l.startswith(('//', '#')) and not l.startswith('#!')), '')
            except Exception:
                pass
            rows.append(f'  {p.stem:<14} {first[:70]}')
        if rows:
            print(f'\n[{d.relative_to(HERE.parent)}]'); print('\n'.join(rows))
    print('\n[这一集自己的脚本]\n  lines          vo/草稿.txt → vo/lines.py（配音文本：数字换汉字、英文换好念的写法）\n  tl             app/src/timeline.json → set/tl.js 和 out/字幕.srt\n  log            juzu.py log 阶段 "一句话"：往运行记录里记一笔')


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ('-h', '--help', 'help'):
        return listing()
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == 'log':                       # juzu.py log 阶段 "一句话"：往运行记录里记一笔
        from common import ep, log
        log(ep(), args[0], ' '.join(args[1:])); return
    LOCAL = {'lines': 'vo/mk_lines.py', 'tl': 'set/mk_tl.py'}   # 这两个脚本跟着每一集走（每集可以改），不在 skill 里
    if cmd in LOCAL:
        from common import ep
        p = ep() / LOCAL[cmd]
    else:
        p = find(cmd)
    if not p:
        sys.exit(f'没有这个命令：{cmd}。不带参数运行可以看全部命令。')
    C = cfg()
    if p.suffix == '.py':
        py = C.get(PY.get(cmd, 'py')) or 'python3'
        run = [py, str(p), *args]
    elif p.suffix == '.mjs':
        run = ['node', str(p), *args]
    else:
        run = ['sh', str(p), *args]
    env = dict(os.environ, PYTHONPATH=str(HERE) + os.pathsep + os.environ.get('PYTHONPATH', ''))
    sys.exit(subprocess.call(run, env=env))


if __name__ == '__main__':
    main()
