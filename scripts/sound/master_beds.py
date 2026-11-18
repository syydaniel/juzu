"""铺底的轻母带：把用户选定的候选做成 music/<段名>.wav，给 mix.py 拼。  juzu.py master_beds [段名=候选 …]
不写参数就按 cues.json 里每段的 "pick"（比如 "explain": {"pick": "explain_4101"}）；候选在 music/cands/<候选>.wav。

每一段先过 despur.py：去掉 ACE-Step 解码器留下的 2.5 到 18 kHz 固定细线（「哨音」）。
铺底（role 不是 open 的）：30 Hz 低切，300 Hz 减 2 dB（去闷），2.5 kHz 减 3 dB（给人声让位），4.8 kHz 减 1.5 dB、8 kHz 高架减 2 dB、15 kHz 缓低通（65 期作者：配乐高频刺耳；
原来的 9 kHz 高架 +1.5 dB 去掉了），2:1 轻压缩，两遍 loudnorm 到 -20 LUFS（真峰值 -2，LRA 20），结尾 3 秒淡出，48 kHz 24 bit。
所有铺底统一 -20 LUFS，混音时再整体压到人声底下（stems.py 里 -13 dB）。
开场（role 是 open）只转成 48 kHz 原样拷过去，不压：开场要保住从安静到展开的起伏，音量在 plan 的 gain 里给（64 期是 4；给到 11 时总峰值超了）。
某一段比别的段亮（比如结尾冒出沙锤、镲片），在 cues.json 的这一段写 "eq": "highshelf=f=5000:g=-6"，接在统一的链后面（65 期 crew_b）。
旧的 music/<段名>.wav 不删，挪到 music/old/<段名>_<时间>.wav 留着对照。"""
import json, shutil, subprocess, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _snd import ep, cues, duration, replace_into, loudness, log  # noqa: E402
from despur import despur  # noqa: E402

PRE = ('highpass=f=30,equalizer=f=300:t=q:w=1.0:g=-2,equalizer=f=2500:t=q:w=1.2:g=-3,equalizer=f=4800:t=q:w=1.0:g=-1.5,highshelf=f=8000:g=-2,lowpass=f=15000:p=1,'
       'acompressor=threshold=-22dB:ratio=2:attack=30:release=300:makeup=1')


def master(src, dst, is_open, eq=''):
    tmp = dst.with_name('_' + dst.name); ds = dst.with_name('_ds_' + dst.name)
    n, top = despur(src, ds); print(f'  {src.stem}：去掉 {n} 条哨音' + (f'（{top}）' if n else '')); src = ds
    if is_open:
        cmd = ['ffmpeg', '-y', '-v', 'error', '-i', str(src), '-af', 'aresample=48000', '-c:a', 'pcm_s24le', str(tmp)]
    else:
        end = duration(src); pre = PRE + (',' + eq if eq else '')
        r = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(src), '-af', pre + ',loudnorm=I=-20:TP=-2:LRA=20:print_format=json',
                            '-f', 'null', '-'], capture_output=True, text=True).stderr
        j = json.loads(r[r.rindex('{'):r.rindex('}') + 1])
        ln = (f"loudnorm=I=-20:TP=-2:LRA=20:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
              f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
        cmd = ['ffmpeg', '-y', '-v', 'error', '-i', str(src), '-af', f'{pre},{ln},afade=out:st={max(0, end - 3):.3f}:d=3,aresample=48000',
               '-c:a', 'pcm_s24le', str(tmp)]
    subprocess.run(cmd, check=True); ds.unlink(missing_ok=True)
    if dst.exists() and not dst.is_symlink():
        old = dst.parent / 'old'; old.mkdir(exist_ok=True)
        shutil.move(str(dst), old / f"{dst.stem}_{time.strftime('%m%d-%H%M')}.wav")
    replace_into(tmp, dst)


if __name__ == '__main__':
    E = ep(); B = {k: v for k, v in cues(E).get('beds', {}).items() if isinstance(v, dict)}
    want = dict(a.split('=', 1) for a in sys.argv[1:]) if sys.argv[1:] else {n: b['pick'] for n, b in B.items() if b.get('pick')}
    if not want:
        sys.exit('不知道用哪个候选：在 cues.json 的 beds.<段名> 里写 "pick": "<段名>_<种子>"，或者 juzu.py master_beds explain=explain_4101')
    done = []
    for name, cand in want.items():
        src = Path(cand) if cand.endswith('.wav') else E / f'music/cands/{cand}.wav'
        if not src.exists():
            sys.exit(f'没有候选 {src}')
        is_open = B.get(name, {}).get('role') == 'open'
        master(src, E / f'music/{name}.wav', is_open, B.get(name, {}).get('eq', ''))
        I, TP, _ = loudness(E / f'music/{name}.wav')
        done.append(f'{name} ← {src.stem}' + (f'（加 {B[name]["eq"]}）' if B.get(name, {}).get('eq') else '') + f'（{I} LUFS，真峰值 {TP}）'); print(done[-1])
    log(E, '3-作曲', '铺底母带：' + '；'.join(done))
