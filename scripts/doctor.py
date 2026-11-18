"""检查环境缺什么：  juzu.py doctor
看命令行工具、三个 Python 环境里的包、参考音、ACE-Step、Chrome、达芬奇、环境声音效库。只读，不装东西。"""
import shutil, subprocess, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import cfg, SKILL

C = cfg(); bad = 0
def row(ok, what, hint=''):
    global bad
    bad += not ok
    print(('  有  ' if ok else '  缺  ') + what + ('' if ok or not hint else f'    → {hint}'))

def has_mods(py, mods):
    code = 'import importlib.util,sys;print(",".join(m for m in sys.argv[1:] if importlib.util.find_spec(m) is None))'
    try:
        r = subprocess.run([py, '-c', code, *mods], capture_output=True, text=True, timeout=60)
    except Exception as e:
        return None, str(e)
    return r.returncode == 0, r.stdout.strip()

print('配置：', SKILL / 'config.json', '（有）' if (SKILL / 'config.json').exists() else '（还没有，先复制 config.example.json）')
print('\n命令行')
for t, hint in [('ffmpeg', 'brew install ffmpeg'), ('ffprobe', 'brew install ffmpeg'), ('node', 'brew install node'), ('npm', 'brew install node')]:
    row(bool(shutil.which(t)), t, hint)
print('\nPython 环境')
for key, mods, why in [('py', ['numpy', 'soundfile', 'scipy', 'PIL'], '混音、音效、分轨、封面拼图'),
                       ('py_audio', ['mlx_audio', 'mlx_whisper', 'numpy', 'soundfile'], '配音和听写（只在 Apple 芯片上能用）'),
                       ('py_music', ['acestep'], '作曲'),
                       ('py', ['jieba', 'numpy', 'wordfreq', 'spacy', 'zh_core_web_md', 'funasr', 'torch'], '口播稿打分器（第一次跑还会下载约 1 GB 的标点模型）')]:
    py = C.get(key) or 'python3'
    ok, miss = has_mods(py, mods)
    row(ok is not None and not miss, f'{key}（{py}）：{"、".join(mods)}，{why}', f'缺 {miss}' if miss else '这个 Python 跑不起来')
print('\n素材和软件')
ref = C.get('voice_ref')
row(bool(ref) and Path(ref).exists(), f'参考音 voice_ref：{ref or "没填"}', '录一段 10 到 20 秒、干净的本人录音，路径填进 config.json')
row(Path(C.get('acestep_root', '')).exists(), f'ACE-Step：{C.get("acestep_root")}', 'https://github.com/ace-step/ACE-Step-1.5')
row(Path(C.get('chrome', '')).exists(), f'Chrome：{C.get("chrome")}', '片场逐帧渲染要用')
row(Path('/Applications/DaVinci Resolve/DaVinci Resolve.app').exists() or Path('/Applications/DaVinci Resolve Studio/DaVinci Resolve Studio.app').exists(), '达芬奇 DaVinci Resolve', 'https://www.blackmagicdesign.com/products/davinciresolve')
for d in C.get('ambience_dirs', []):
    row(Path(d).exists(), f'环境声音效库：{d}', '没有也行，环境声可以用别的真实录音，在 cues.json 里写路径')
print('\n' + ('都齐了。' if not bad else f'缺 {bad} 样。缺的那几步做不了，别的照常。'))
