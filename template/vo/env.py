"""配音的响度包络，给小机器人的嘴用：python3 vo/env.py [out/vo.wav] → set/data/voice_env.json（每秒 30 个值，0 到 1）
配完音、排好时间线以后跑一遍。导演表里写 VOICE_ENV: 'data/voice_env.json'；没有这个文件时，小机器人按每句话的起止假装在说。要 numpy。"""
import sys, json, wave, pathlib
import numpy as np
here = pathlib.Path(__file__).resolve().parent.parent
w = wave.open(str(here / (sys.argv[1] if len(sys.argv) > 1 else 'out/vo.wav')))
sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
x = np.frombuffer(w.readframes(n), np.int16).astype(np.float32).reshape(-1, ch).mean(1) / 32768
fps = 30; hop = sr // fps; m = len(x) // hop
r = np.sqrt((x[:m * hop].reshape(m, hop) ** 2).mean(1))
db = 20 * np.log10(r + 1e-6); v = np.clip((db + 42) / 30, 0, 1)        # -42 dB 以下当作闭嘴，-12 dB 张到最大
v = np.convolve(v, np.ones(3) / 3, 'same')
(here / 'set/data').mkdir(exist_ok=True)
json.dump({'fps': fps, 'v': [round(float(a), 3) for a in v]}, open(here / 'set/data/voice_env.json', 'w'))
print('写好了', round(m / fps, 1), '秒')
