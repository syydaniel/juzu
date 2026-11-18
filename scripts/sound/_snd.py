"""scripts/sound 里各脚本共用的小工具：量响度、读写音频、在音效库里找文件、做试听串。
只用标准库和 ffmpeg；用到 numpy、soundfile、scipy 的函数在函数里面才导入，没装它们的 Python 也能用其余部分。"""
import json, os, re, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from common import cfg, ep, Clock, log, timeline  # noqa: E402,F401

SR = 48000
AUDIO = ('.wav', '.aif', '.aiff', '.flac', '.mp3', '.m4a', '.ogg', '.caf')


def ff(*a):
    """跑一次 ffmpeg，返回 CompletedProcess（文字输出在 stderr）。"""
    return subprocess.run(['ffmpeg', '-hide_banner', '-nostats', *map(str, a)], capture_output=True, text=True)


def loudness(path, ss=None, t=None):
    """整体响度（LUFS）和真峰值（dBTP），用 ffmpeg 的 ebur128。ss / t 只量其中一段。"""
    cut = ['-ss', f'{ss:.3f}', '-t', f'{t:.3f}'] if ss is not None else []
    r = ff(*cut, '-i', path, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-').stderr
    I = re.findall(r'I:\s+(-?[\d.]+|-inf) LUFS', r)
    P = re.findall(r'Peak:\s+(-?[\d.]+|-inf) dBFS', r)
    L = re.findall(r'LRA:\s+([\d.]+) LU', r)
    if not I:
        raise RuntimeError(f'量不出响度：{path}\n{r[-600:]}')
    return float(I[-1]), float(P[-1]) if P else float('nan'), float(L[-1]) if L else float('nan')


def momentary_max(path):
    """最大瞬时响度（400 毫秒窗，LUFS）。短音效按它校准，不看峰值。"""
    r = ff('-i', path, '-af', 'apad=pad_dur=0.6,ebur128', '-f', 'null', '-')
    M = [float(v) for v in re.findall(r' M:\s*(-?[\d.]+)', r.stderr)]
    return max(M) if M else float('-inf')


def read_mono(path, sr=24000, ss=None, t=None):
    """用 ffmpeg 读成单声道 float（不需要 soundfile）。"""
    import numpy as np
    cut = ['-ss', f'{ss:.3f}', '-t', f'{t:.3f}'] if ss is not None else []
    raw = subprocess.run(['ffmpeg', '-v', 'error', *cut, '-i', str(path), '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'],
                         capture_output=True).stdout
    return np.frombuffer(raw, np.float32).astype(float), sr


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)],
                         capture_output=True, text=True).stdout.strip()
    return float(out) if out else 0.0


def write(path, a, sr=SR, subtype=None):
    """写 wav。目标要是软链接，先把链接删掉再写，免得写穿到链接指向的原文件。"""
    import soundfile as sf
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_symlink():
        path.unlink()
    sf.write(path, a, sr, subtype=subtype) if subtype else sf.write(path, a, sr)


def replace_into(tmp, dst):
    """把临时文件挪到目标位置（目标是软链接也只替换链接本身）。"""
    dst = Path(dst)
    if dst.is_symlink():
        dst.unlink()
    os.replace(tmp, dst)


def cues(e):
    p = e / 'cues.json'
    return json.load(open(p)) if p.exists() else {}


# ---------- 音效库 ----------
_INDEX = None


def lib_dirs(e=None):
    """找录音的地方：这一集的 sfx/lib（自己下载的），再是 config 里的 ambience_dirs（默认达芬奇的 Fairlight 音效库）。"""
    ds = []
    if e is not None:
        ds.append(e / 'sfx/lib')
    ds += [Path(d) for d in cfg().get('ambience_dirs', []) if d]
    return [d for d in ds if d.exists()]


def _index(e):
    global _INDEX
    if _INDEX is None:
        _INDEX = []
        for d in lib_dirs(e):
            for root, _, files in os.walk(d, followlinks=True):
                for f in files:
                    if f.lower().endswith(AUDIO):
                        _INDEX.append(Path(root) / f)
    return _INDEX


def find_lib(name, e=None):
    """按文件名找一个录音。可以写绝对路径、相对这一集的路径，或者只写文件名（带不带扩展名都行，不分大小写）。"""
    p = Path(os.path.expanduser(str(name)))
    if p.is_absolute() and p.exists():
        return p
    if e is not None and (e / p).exists():
        return e / p
    key = p.name.lower()
    for q in _index(e):
        if q.name.lower() == key or q.stem.lower() == key:
            return q
    raise FileNotFoundError(f'找不到录音「{name}」。放进这一集的 sfx/lib/，或者在 config.json 的 ambience_dirs 里加上它所在的文件夹。'
                            f'找过：{[str(d) for d in lib_dirs(e)]}')


def search_lib(words, e=None):
    """文件名里同时含有这些词的录音（不分大小写）。Fairlight 库的文件名是英文，搜 wind / train / paper 这类词。"""
    ws = [w.lower() for w in words]
    return [q for q in _index(e) if all(w in q.name.lower() for w in ws)]


# ---------- 检查和试听 ----------
def attack_ms(a, sr=SR):
    """起音时间：包络（希尔伯特包络，2 毫秒平滑）从 -60 dB 升到最高点用了多少毫秒。
    合成音效写的是 8 毫秒的升余弦起音，这样量出来约 7 毫秒；量出来低于 7 就算太快。"""
    import numpy as np
    from scipy.signal import hilbert
    m = a if a.ndim == 1 else a.mean(1)
    k = max(1, int(sr * 0.002)); e = np.convolve(np.abs(hilbert(m)), np.ones(k) / k, 'same')
    pk = int(np.argmax(e)); on = int(np.argmax(e >= e[pk] * 1e-3))
    return 1000 * (pk - on) / sr


def band_share(a, lo_hz, hi_hz=None, sr=SR):
    """lo_hz 以上（到 hi_hz）的能量占全部能量的百分比。"""
    import numpy as np
    m = a if a.ndim == 1 else a.mean(1)
    S = np.abs(np.fft.rfft(m)) ** 2; f = np.fft.rfftfreq(len(m), 1 / sr)
    sel = (f >= lo_hz) if hi_hz is None else ((f >= lo_hz) & (f < hi_hz))
    return 100 * S[sel].sum() / (S.sum() + 1e-20)


def audition(items, out, gap=0.9, sr=SR):
    """把一组音效排成一条试听：每个之间空 gap 秒。items：[(名字, 立体声数组)]。旁边写一份时间表。"""
    import numpy as np
    parts, rows, t = [], [], 0.5
    parts.append(np.zeros((int(0.5 * sr), 2)))
    for name, a in items:
        a = a if a.ndim == 2 else np.stack([a, a], 1)
        rows.append(f'{t:6.2f}  {name}')
        parts.append(a); parts.append(np.zeros((int(gap * sr), 2)))
        t += len(a) / sr + gap
    write(out, np.concatenate(parts).astype(np.float32), sr, 'PCM_24')
    Path(out).with_suffix('.txt').write_text('试听顺序（秒  名字）\n' + '\n'.join(rows) + '\n')
    return rows


def mmss(t):
    return '%d:%02d' % (t // 60, t % 60)
