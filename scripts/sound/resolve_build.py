"""搭达芬奇工程并出片：V1 画面，A1 人声、A2 配乐、A3 音效和环境声，输出 MP4（H.264 + AAC 48 kHz）。
  juzu.py resolve_build                  4K 整片：out/video_silent.mp4 + out/stems/*.wav，3840×2160、24 帧、60000 kb/s
  juzu.py resolve_build --sample         样片：1920×1080、20000 kb/s，画面默认 out/sample_1080.mp4（前 3 分钟）
  加 --render 搭好就出片，并等到出完、量响度和偏移；--no-wait 只开始出片不等
  --picture 文件  换画面；--name 工程名  不写就用 episode.json 的 name 加「_4K」或「_样片1080」

两种跑法，做的事一样：
  1. 外部脚本：达芬奇开着，偏好设置 → 系统 → 常规 →「外部脚本使用」选「本地」；直接跑上面的命令。
     脚本用达芬奇自带的 DaVinciResolveScript 模块（macOS 默认装在
     /Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules），
     找不到时可以用环境变量 RESOLVE_SCRIPT_API、RESOLVE_SCRIPT_LIB 指过去。免费版的达芬奇不支持外部脚本，要用 Studio 或者走第 2 种。
  2. MCP：juzu.py resolve_build --emit [--sample] [--render] 打印一段脚本（同时存到 out/resolve_build_mcp.py），
     原样贴进达芬奇 MCP 的 run_script。那边已经有 resolve 变量；沙盒里不能用 os、sys，单次最多 60 秒，
     所以出片只负责开始，进度用打印出来的第二段（查状态）隔一会儿再贴一次，看到 Complete 为止。

64 期踩过的坑都写在核心那段里：ImportMedia 只认路径字符串（传字典返回 None）；分辨率和帧率要在建时间线之前设；
VideoQuality 填 'Best' 会失败，要填码率数字；分轨比画面长（64 期长约 1 秒）时用 MarkIn / MarkOut 把出片范围卡在画面的帧数；
换工程之前先 SaveProject()。"""
import json, os, subprocess, sys
from pathlib import Path

# ===== 核心开始：这一段只用达芬奇的 API，不用 os、sys，可以原样贴进 MCP 的 run_script =====
def juzu_build(resolve, P):
    """P：project 工程名，timeline 时间线名，picture 画面路径，stems [人声, 配乐, 音效] 路径，width height fps，
    kbps 码率，picture_frames 画面帧数，stems_frames 分轨帧数，out_dir 出片目录，out_name 出片文件名（不带扩展名），render 要不要出片。"""
    pm = resolve.GetProjectManager()
    if pm.GetCurrentProject():
        pm.SaveProject()                                      # 换工程之前先存
    proj = pm.CreateProject(P['project'])
    if proj is None:                                          # 同名工程已经有了：打开它，在里面新建一条时间线
        proj = pm.LoadProject(P['project'])
        if proj is None:
            raise RuntimeError('建不了也打不开工程「%s」' % P['project'])
    # 分辨率和帧率要在建时间线之前设；工程里已经有时间线时帧率改不了，下面会核对
    for k, v in (('timelineResolutionWidth', str(P['width'])), ('timelineResolutionHeight', str(P['height'])),
                 ('timelineFrameRate', '%g' % P['fps']), ('timelinePlaybackFrameRate', '%g' % P['fps'])):
        proj.SetSetting(k, v)
    got = (proj.GetSetting('timelineResolutionWidth'), proj.GetSetting('timelineResolutionHeight'), proj.GetSetting('timelineFrameRate'))
    if str(got[0]) != str(P['width']) or str(got[1]) != str(P['height']) or float(got[2]) != float(P['fps']):
        raise RuntimeError('工程设置没改过来：%s。多半是这个工程里已经有别的帧率的时间线，换个工程名再来' % (got,))
    mp = proj.GetMediaPool()
    paths = [P['picture']] + list(P['stems'])
    items = mp.ImportMedia(paths)                             # 只认路径字符串
    if not items or len(items) < len(paths):
        raise RuntimeError('导入失败：%s（路径要是字符串、文件要存在）' % paths)
    byname = {}
    for it in items:
        byname[str(it.GetClipProperty('File Path'))] = it
    clips = [byname.get(p) for p in paths]
    if None in clips:
        clips = list(items)[:len(paths)]                      # 按路径对不上时按导入顺序
    names = set(proj.GetTimelineByIndex(i + 1).GetName() for i in range(proj.GetTimelineCount()))
    name, n = P['timeline'], 2
    while name in names:
        name = '%s_%d' % (P['timeline'], n); n += 1
    tl = mp.CreateEmptyTimeline(name)
    if tl is None:
        raise RuntimeError('建不了时间线「%s」' % name)
    proj.SetCurrentTimeline(tl)
    while tl.GetTrackCount('audio') < 3:
        tl.AddTrack('audio', 'stereo')
    tl.SetTrackName('video', 1, '画面')
    for i, t in enumerate(('人声', '配乐', '音效和环境声')):
        tl.SetTrackName('audio', i + 1, t)
    s = tl.GetStartFrame()                                    # 一般是 86400（01:00:00:00）
    infos = [{'mediaPoolItem': clips[0], 'mediaType': 1, 'trackIndex': 1, 'recordFrame': s}]   # mediaType 1 画面
    for i, c in enumerate(clips[1:]):
        infos.append({'mediaPoolItem': c, 'mediaType': 2, 'trackIndex': i + 1, 'recordFrame': s})   # 2 声音
    added = mp.AppendToTimeline(infos)
    if not added or len(added) < len(infos):
        raise RuntimeError('往时间线上放素材失败（放上了 %d 个，应该 %d 个）' % (len(added or []), len(infos)))
    proj.SetCurrentRenderFormatAndCodec('mp4', 'H264')
    rs = {'SelectAllFrames': True, 'TargetDir': P['out_dir'], 'CustomName': P['out_name'], 'ExportVideo': True, 'ExportAudio': True,
          'FormatWidth': int(P['width']), 'FormatHeight': int(P['height']), 'FrameRate': float(P['fps']),
          'AudioCodec': 'aac', 'AudioSampleRate': 48000, 'VideoQuality': int(P['kbps'])}   # 码率填数字，'Best' 会失败
    if P['stems_frames'] > P['picture_frames']:               # 分轨比画面长：出片范围卡在画面的帧数
        rs.update({'SelectAllFrames': False, 'MarkIn': s, 'MarkOut': s + int(P['picture_frames']) - 1})
    if not proj.SetRenderSettings(rs):
        raise RuntimeError('出片设置没设上：%s' % rs)
    pm.SaveProject()
    job = None
    if P.get('render'):
        job = proj.AddRenderJob()
        proj.StartRendering([job])
    return {'工程': P['project'], '时间线': name, '起始帧': s, '出片范围': [rs.get('MarkIn'), rs.get('MarkOut')] if 'MarkIn' in rs else '全部',
            '出片': P['out_dir'] + '/' + P['out_name'] + '.mp4', '任务': job}


def juzu_status(resolve, job):
    """出片进度：返回 {'JobStatus': 'Rendering' / 'Complete' / 'Failed' …, 'CompletionPercentage': …}"""
    proj = resolve.GetProjectManager().GetCurrentProject()
    return proj.GetRenderJobStatus(job)
# ===== 核心结束 =====


def connect():
    """外部脚本连达芬奇：先直接 import，再按 macOS 的默认位置找模块。"""
    try:
        import DaVinciResolveScript as dvr
    except ImportError:
        api = os.environ.get('RESOLVE_SCRIPT_API', '/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting')
        libs = [os.environ.get('RESOLVE_SCRIPT_LIB', ''),
                '/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so',
                '/Applications/DaVinci Resolve Studio/DaVinci Resolve Studio.app/Contents/Libraries/Fusion/fusionscript.so']
        lib = next((x for x in libs if x and os.path.exists(x)), libs[1])
        os.environ['RESOLVE_SCRIPT_API'] = api; os.environ['RESOLVE_SCRIPT_LIB'] = lib
        sys.path.append(os.path.join(api, 'Modules'))
        try:
            import DaVinciResolveScript as dvr
        except ImportError:
            sys.exit(f'找不到 DaVinciResolveScript 模块（找过 {api}/Modules）。装了达芬奇的话，设 RESOLVE_SCRIPT_API 指到 Developer/Scripting；'
                     '或者用 --emit 走 MCP。')
    r = dvr.scriptapp('Resolve')
    if r is None:
        sys.exit('连不上达芬奇：先把达芬奇打开；偏好设置 → 系统 → 常规 →「外部脚本使用」选「本地」。免费版不支持外部脚本，用 --emit 走 MCP。')
    return r


def audio_frames(path, fps):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)],
                         capture_output=True, text=True).stdout.strip()
    return int(round(float(out or 0) * fps))


def frames(path, fps):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=nb_frames:format=duration',
                          '-of', 'json', str(path)], capture_output=True, text=True).stdout
    j = json.loads(out or '{}'); nb = (j.get('streams') or [{}])[0].get('nb_frames')
    if nb and str(nb).isdigit():
        return int(nb)
    return int(round(float(j.get('format', {}).get('duration', 0)) * fps))


def params(E, a):
    sample = '--sample' in a
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    W, H, KB = (1920, 1080, 20000) if sample else (3840, 2160, 60000)
    fps = float(opt('--fps', 24)); fps = int(fps) if fps.is_integer() else fps
    pic = Path(opt('--picture', E / ('out/sample_1080.mp4' if sample else 'out/video_silent.mp4'))).resolve()
    stems = [(E / f'out/stems/{k}.wav').resolve() for k in ('vo', 'music', 'fx')]
    for p in [pic, *stems]:
        if not p.exists():
            sys.exit(f'没有 {p}：画面来自片场渲染，分轨来自 juzu.py stems')
    st = json.load(open(E / 'episode.json'))
    tag = '样片1080' if sample else '4K'
    pf = frames(pic, fps)
    sf_ = max(audio_frames(s, fps) for s in stems)
    return dict(project=opt('--name', f"{st.get('name', E.name)}_{tag}"), timeline='样片_1080' if sample else '成片_4K',
                picture=str(pic), stems=[str(s) for s in stems], width=W, height=H, fps=fps, kbps=KB,
                picture_frames=pf, stems_frames=sf_, out_dir=str((E / 'out').resolve()),
                out_name='样片_1080' if sample else 'final', render='--render' in a)


def core_source(part=None):
    """核心那段的源码；part='status' 只要查进度的函数。"""
    s = Path(__file__).read_text()
    s = s[s.index('# ===== 核心开始'):s.index('# ===== 核心结束')]
    return s[s.index('def juzu_status'):] if part == 'status' else s


if __name__ == '__main__':
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from common import ep, log
    E = ep(); a = sys.argv[1:]; P = params(E, a)
    print('工程参数：', json.dumps(P, ensure_ascii=False, indent=1))
    if '--emit' in a:
        import pprint
        code = (core_source() + '\n# 这一集的参数（resolve_build.py --emit 生成）\nP = ' + pprint.pformat(P, width=120, sort_dicts=False)
                + '\nresult = juzu_build(resolve, P)\nprint(result)\n')
        (E / 'out/resolve_build_mcp.py').write_text(code)
        print('\n# ---- 第一段：贴进 run_script（timeout 填 60）----\n' + code)
        print('# ---- 第二段：出片开始以后，隔一会儿贴一次，看到 Complete 为止（把任务号换成第一段返回的「任务」）----\n'
              + core_source('status') + "\nresult = juzu_status(resolve, '任务号')\n")
        print('脚本也存在 out/resolve_build_mcp.py。')
        sys.exit(0)
    r = connect(); res = juzu_build(r, P)
    print(json.dumps(res, ensure_ascii=False, indent=1))
    log(E, '6-剪辑出片', f"达芬奇工程「{res['工程']}」时间线「{res['时间线']}」：V1 画面，A1 人声、A2 配乐、A3 音效和环境声；"
                       f"{P['width']}×{P['height']}、{P['fps']:g} 帧、{P['kbps']} kb/s，出片范围 {res['出片范围']}")
    if res['任务'] and '--no-wait' not in a:
        import time
        t0 = time.time()
        while True:
            st = juzu_status(r, res['任务']); print(f"\r出片 {st.get('CompletionPercentage', 0)}%  {st.get('JobStatus')}", end='', flush=True)
            if st.get('JobStatus') in ('Complete', 'Failed', 'Cancelled'):
                break
            time.sleep(5)
        print(f"\n{st.get('JobStatus')}，用了 {round(time.time() - t0)} 秒")
        if st.get('JobStatus') == 'Complete':
            sys.path.insert(0, str(Path(__file__).resolve().parent))
            from verify import check
            rep = check(E, Path(res['出片']), expect=f"{P['width']}x{P['height']}@{P['fps']:g}")
            print(json.dumps(rep, ensure_ascii=False, indent=1))
            log(E, '6-剪辑出片', f"达芬奇出片 {Path(res['出片']).name}：{rep['响度']} LUFS，真峰值 {rep['真峰值']}，偏移 {rep['音画偏移毫秒']}，"
                               f"用了 {round(time.time() - t0)} 秒，问题 {rep['问题']}")
