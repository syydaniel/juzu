"""开一集新的：  juzu.py new 65_片场 [--from 上一集的目录] [--no-npm]
在 config.json 的 productions_dir 下建目录。默认从 skill 自带的 template/ 复制；
写了 --from，就把上一集的片场代码、配乐和音效的设置一起带过来（只带代码和设置，不带素材和成片），这是作者自己的做法：每一期都在上一期的基础上往前走一点。"""
import json, shutil, subprocess, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import cfg, SKILL

a = [x for x in sys.argv[1:] if not x.startswith('--')]
if not a:
    sys.exit(__doc__)
name = a[0]
src = None
if '--from' in sys.argv:
    src = Path(sys.argv[sys.argv.index('--from') + 1]).expanduser().resolve()
    a = [x for x in a if Path(x).expanduser().resolve() != src]
root = Path(cfg()['productions_dir']).expanduser()
E = root / name
if E.exists():
    sys.exit(f'已经有这个目录了：{E}')
root.mkdir(parents=True, exist_ok=True)
JUNK = shutil.ignore_patterns('node_modules', 'out', 'check', 'sheet-*', 'frames', '*.wav', '*.mp4', '*.mov', '__pycache__', '.DS_Store', 'tl.js')
shutil.copytree(SKILL / 'template', E, ignore=JUNK)
if src:
    assert (src / 'episode.json').exists(), f'{src} 不像是一集的目录（没有 episode.json）'
    for d in ['set']:
        if (src / d).exists():
            shutil.rmtree(E / d, ignore_errors=True)
            shutil.copytree(src / d, E / d, ignore=shutil.ignore_patterns('node_modules', 'check', 'sheet-*', 'frames', 'out', '*.mp4', '*.mov', 'tl.js', '__pycache__', '.DS_Store'))
    for f in ['cues.json', 'vo/mk_lines.py']:
        if (src / f).exists():
            (E / f).parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(src / f, E / f)
for d in ['out', 'music', 'sfx', 'research', 'cover']:
    (E / d).mkdir(exist_ok=True)
json.dump({'name': name, 'created': time.strftime('%Y-%m-%d %H:%M'), 'from': src.name if src else 'template', 'stage': '0-开工', 'gates': {}},
          open(E / 'episode.json', 'w'), ensure_ascii=False, indent=1)
(E / '运行记录.md').write_text(f'# {name} 运行记录\n\n每个工种做了什么、花了多久、卡在哪，都记在这里。片子里说的数字从这里取。\n\n')
with open(E / '运行记录.md', 'a') as f:
    f.write(f"- {time.strftime('%m-%d %H:%M')} 【0-开工】建目录，来源：{src or 'template'}\n")
if '--no-npm' not in sys.argv and (E / 'set/package.json').exists():
    print('装片场的依赖（three、playwright-core）…', flush=True)
    subprocess.call(['npm', 'install', '--silent', '--no-audit', '--no-fund'], cwd=E / 'set')
if (E / 'set/mk_tl.py').exists() and (E / 'app/src/timeline.json').exists():
    subprocess.call([sys.executable, str(E / 'set/mk_tl.py')])      # 先把示范（或上一集）的时间线写成 set/tl.js，片场马上能渲
print('好了：', E)
