"""成片的机器检查：  juzu.py verify [成片.mp4] [--ref out/mix_ref.wav] [--expect 3840x2160@24] [--sheet]
不写成片就查 out/final.mp4。查这几样，结果写到 out/verify.json：
  画面    分辨率、帧率、时长（和时间线、和无声画面 out/video_silent.mp4 比）
  响度    整体响度（目标 -16 LUFS，差 0.5 以内）、真峰值（不超过 -1 dB）、LRA
  音画同步  成片的声音和 stems.py 出的 out/mix_ref.wav 在片子的 1/4、1/2、3/4 三处各取 6 秒做互相关，偏移应该是 0 毫秒
  联系表  --sheet 时抽 24 帧拼成 out/check_sheet.jpg（6 列 4 行，从左到右、从上到下按时间排）
64 期达芬奇出片：-16.2 LUFS，真峰值 -1.2 dB，三处偏移都是 0 毫秒。"""
import json, subprocess, sys, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _snd import ep, loudness, read_mono, timeline, log  # noqa: E402


def probe(path):
    p = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)]))
    v = next((s for s in p['streams'] if s['codec_type'] == 'video'), None)
    a = next((s for s in p['streams'] if s['codec_type'] == 'audio'), None)
    num, den = (v['r_frame_rate'].split('/') if v else ('0', '1'))
    return dict(width=v and v['width'], height=v and v['height'], fps=round(int(num) / int(den), 3) if v else None,
                vcodec=v and v['codec_name'], acodec=a and a['codec_name'], frames=int(v.get('nb_frames', 0)) if v else 0,
                duration=round(float(p['format']['duration']), 3), size_mb=round(int(p['format']['size']) / 1e6, 1))


def offset_ms(final, ref, at, win=6.0, maxlag=1.0):
    """在 at 秒附近取 win 秒，用互相关找成片相对参考的偏移（毫秒，正数是成片的声音晚了）。"""
    import numpy as np
    sr = 48000
    x, _ = read_mono(final, sr, at - maxlag, win + 2 * maxlag)
    y, _ = read_mono(ref, sr, at, win)
    if len(y) < sr or len(x) < len(y) or np.abs(y).max() < 1e-4:
        return None
    n = 1 << int(np.ceil(np.log2(len(x) + len(y))))
    c = np.fft.irfft(np.fft.rfft(x, n) * np.conj(np.fft.rfft(y, n)), n)[: len(x) - len(y) + 1]
    k = int(np.argmax(c))
    return round(1000 * (k / sr - maxlag), 2)


def sheet(final, out, dur, n=24, cols=6):
    with tempfile.TemporaryDirectory() as d:
        for i in range(n):
            t = dur * (i + 0.5) / n
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.2f}', '-i', str(final), '-frames:v', '1',
                            '-vf', 'scale=640:-2', f'{d}/{i:03d}.jpg'], check=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{d}/%03d.jpg', '-vf', f'tile={cols}x{(n + cols - 1) // cols}:padding=4',
                        '-frames:v', '1', '-q:v', '3', str(out)], check=True)
    return [round(dur * (i + 0.5) / n, 1) for i in range(n)]


def check(E, final, ref=None, expect='3840x2160@24', want_sheet=False):
    rep, bad = {'文件': final.name}, []
    rep.update(probe(final))
    w, rest = expect.split('x'); h, fps = rest.split('@')
    if (rep['width'], rep['height']) != (int(w), int(h)):
        bad.append(f"分辨率是 {rep['width']}×{rep['height']}，应为 {w}×{h}")
    if rep['fps'] and abs(rep['fps'] - float(fps)) > 0.01:
        bad.append(f"帧率是 {rep['fps']}，应为 {fps}")
    try:
        td = timeline(E)['duration']
        rep['时间线秒'] = td
        if abs(rep['duration'] - td) > 0.5:
            bad.append(f"时长 {rep['duration']} 秒，时间线是 {td} 秒")
    except FileNotFoundError:
        pass
    sil = E / 'out/video_silent.mp4'
    if sil.exists() and sil.resolve() != final.resolve():
        ps = probe(sil); rep['无声画面帧数'] = ps['frames']
        if ps['frames'] and rep['frames'] and ps['frames'] != rep['frames']:
            bad.append(f"成片 {rep['frames']} 帧，无声画面 {ps['frames']} 帧")
    I, TP, LRA = loudness(final); rep.update(响度=I, 真峰值=TP, LRA=LRA)
    if abs(I + 16) > 0.5:
        bad.append(f'响度 {I} LUFS，目标 -16')
    if TP > -1:
        bad.append(f'真峰值 {TP} dB，应不超过 -1')
    ref = ref or E / 'out/mix_ref.wav'
    if ref.exists():
        pts = [round(rep['duration'] * f, 1) for f in (.25, .5, .75)]
        offs = [offset_ms(final, ref, t) for t in pts]
        rep['音画偏移毫秒'] = dict(zip(map(str, pts), offs))
        if any(o is None or abs(o) > 1 for o in offs):
            bad.append(f'和 out/mix_ref.wav 比有偏移：{rep["音画偏移毫秒"]}（None 是那一段太安静，换个位置再量）')
    else:
        rep['音画偏移毫秒'] = '没有 out/mix_ref.wav（先跑 stems.py），没量'
    if want_sheet:
        ts = sheet(final, E / 'out/check_sheet.jpg', rep['duration'])
        rep['联系表'] = f'out/check_sheet.jpg（24 格，时间 {ts[0]} 到 {ts[-1]} 秒）'
    rep['问题'] = bad
    return rep


if __name__ == '__main__':
    E = ep(); a = sys.argv[1:]
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    pos = [x for i, x in enumerate(a) if not x.startswith('--') and (i == 0 or a[i - 1] not in ('--ref', '--expect'))]
    final = Path(pos[0]) if pos else E / 'out/final.mp4'
    if not final.exists():
        sys.exit(f'没有 {final}')
    rep = check(E, final, Path(opt('--ref')) if opt('--ref') else None, opt('--expect', '3840x2160@24'), '--sheet' in a)
    (E / 'out/verify.json').write_text(json.dumps(rep, ensure_ascii=False, indent=1))
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    log(E, '6-剪辑出片', f"检查 {final.name}：{rep['width']}×{rep['height']}，{rep['duration']} 秒，{rep['响度']} LUFS，"
                       f"真峰值 {rep['真峰值']}，偏移 {rep['音画偏移毫秒']}，问题 {len(rep['问题'])} 个")
    sys.exit(1 if rep['问题'] else 0)
