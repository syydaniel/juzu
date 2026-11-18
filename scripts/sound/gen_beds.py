"""用 ACE-Step 1.5 写配乐候选：开场一段、口播底下几段铺底。  juzu.py gen_beds [段名 或 段名_种子 …]   不写就全写
输出 music/cands/<段名>_<种子>.wav，参数记在 music/cands/参数.json。很吃显卡，别和渲染、配音同时跑。

模型：XL-SFT（4B）50 步，加 4B 规划模型。turbo（8 步）写出来的作者听得出「劣质」，64 期换成 XL-SFT 以后才过。
每段按它要垫的长度一次写完，不循环：cues.json 里 dur 写 "auto"，就按 plan 里这段用到的最长一截算（多留 8 秒）。
歌词栏写段落标签（[Intro] [Verse] [Bridge] [Outro] 加一句乐器提示），长段才会有变化。
铺底默认在描述后面加一句「平缓、没有鼓、没有拍子、给旁白让路」（calm，可以在这段里写 "calm": false 关掉）。
写长段会撞上 ACE-Step 自带的 600 秒生成超时（64 期写 220 秒那段时进程崩了），这里默认放宽到 3600 秒。

cues.json 的 beds 写法：
  "explain": {"bpm": 70, "key": "F major", "dur": "auto", "seeds": [4101, 4102],
              "caption": "Gentle, beautiful ambient piano underscore: …", "lyrics": "[Intro]\\n[Instrumental]\\n…"}"""
import json, math, os, shutil, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _snd import ep, cfg, cues, Clock, log  # noqa: E402

MODEL, LM, STEPS = 'acestep-v15-xl-sft', 'acestep-5Hz-lm-4B', 50
CALM = (' Real acoustic instruments recorded in a quiet hall, pristine high-fidelity, warm, soft and spacious, natural reverb, wide stereo.'
        ' Slow and flowing, rubato, no drums, no percussion, no beat, no pulse, no bass groove, no vocals.'
        ' Gentle underscore that sits quietly under a narrator, no sudden changes.')
LYRICS = '[Intro]\n[Instrumental]\n[soft opening]\n\n[Verse]\n[gentle theme]\n\n[Bridge]\n[a little warmer, still calm]\n\n[Outro]\n[quiet ending]'


def need_dur(name, plan, ck):
    """plan 里这段铺底最长要用到第几秒（offset 加上这一截的长度，再加 0.5 秒的交叉淡化），多留 8 秒。"""
    longest = 0.0
    for p in plan:
        if p['bed'] == name:
            longest = max(longest, p.get('offset', 0) + ck.at(p['to']) - ck.at(p['from']) + 0.5)
    return int(math.ceil(longest + 8)) if longest else 60


def jobs(B, args):
    """要写哪些：不写参数就是每段的全部种子；参数是段名（这段的全部种子）或者 段名_种子（只写这一个）。"""
    if not args:
        return [(n, int(s)) for n, b in B.items() for s in b.get('seeds', [4101])]
    out = []
    for a in args:
        if a in B:
            out += [(a, int(s)) for s in B[a].get('seeds', [4101])]
        elif '_' in a and a.rsplit('_', 1)[0] in B and a.rsplit('_', 1)[1].isdigit():
            out.append((a.rsplit('_', 1)[0], int(a.rsplit('_', 1)[1])))
        else:
            sys.exit(f'不认识「{a}」：段名有 {list(B)}，也可以写 段名_种子')
    return out


if __name__ == '__main__':
    E = ep(); C = cues(E); K = cfg()
    B = {k: v for k, v in C.get('beds', {}).items() if isinstance(v, dict)}
    if not B:
        sys.exit('cues.json 里还没有 beds（写法见 template/cues.json）')
    todo = jobs(B, sys.argv[1:])
    if not todo:
        sys.exit(f'没有要写的：段名有 {list(B)}')
    for k in ('http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY'):
        os.environ.pop(k, None)
    os.environ.setdefault('ACESTEP_GENERATION_TIMEOUT', '3600')
    ROOT = K['acestep_root']; sys.path.insert(0, ROOT)
    from acestep.handler import AceStepHandler
    from acestep.llm_inference import LLMHandler
    from acestep.inference import GenerationParams, GenerationConfig, generate_music

    OUT = E / 'music/cands'; (OUT / 'raw').mkdir(parents=True, exist_ok=True)
    ck = Clock(E) if (E / 'app/src/timeline.json').exists() else None
    dit = AceStepHandler(); print(dit.initialize_service(project_root=ROOT, config_path=MODEL, device='auto', offload_to_cpu=False))
    lm = LLMHandler(); print(lm.initialize(checkpoint_dir=os.path.join(ROOT, 'checkpoints'), lm_model_path=LM, backend='mlx',
                                           device='auto', offload_to_cpu=False, dtype=None))
    book = json.loads((OUT / '参数.json').read_text()) if (OUT / '参数.json').exists() else {}
    for name, seed in todo:
        b = B[name]; t0 = time.time()
        dur = b.get('dur', 'auto')
        if dur == 'auto':
            if ck is None:
                sys.exit(f'{name} 的 dur 是 auto，但还没有时间线（app/src/timeline.json）：先配音，或者写一个秒数')
            dur = need_dur(name, C.get('plan', []), ck)
        cap = b['caption'] + (CALM if b.get('calm', True) else '')
        p = dict(task_type='text2music', thinking=True, caption=cap, lyrics=b.get('lyrics', LYRICS), bpm=int(b.get('bpm', 70)),
                 keyscale=b.get('key', 'C major'), timesignature='4', vocal_language='unknown', duration=int(dur),
                 inference_steps=STEPS, guidance_scale=7.0, shift=3.0, seed=seed, instrumental=True)
        r = generate_music(dit, lm, params=GenerationParams(**p), config=GenerationConfig(batch_size=1, audio_format='wav'), save_dir=str(OUT / 'raw'))
        dt = round(time.time() - t0); tag = f'{name}_{seed}'
        print(tag, '成功' if r.success else '失败', dt, '秒', '' if r.success else r.status_message, flush=True)
        if r.success and r.audios:
            shutil.copyfile(r.audios[0]['path'], OUT / f'{tag}.wav')
            book[tag] = {**p, 'model': MODEL, 'lm': LM, '秒': dt}
            (OUT / '参数.json').write_text(json.dumps(book, ensure_ascii=False, indent=1))
            log(E, '3-作曲', f'{tag}：{dur} 秒，{MODEL} {STEPS} 步，用了 {dt} 秒')
    print('接着跑 juzu.py screen_beds 看机器初筛，再挑 2 到 3 个给用户听。')
