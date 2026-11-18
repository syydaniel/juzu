# 剧组 Juzu

**从改文案到出片，一个人的 B 站知识视频剧组。**

拍一部片子要用到的工种，剧组基本都有：写稿的编剧，念稿的配音演员，作曲，美术和导演，做声效的拟音师，混音出片的剪辑师，还有准备封面文案的宣发。你是制片人，只在四个地方点头：**稿子、配乐、前三分钟的样片、成片**。其余的活交给它。

剧组是一个给 AI 助手（Claude Code 等）用的 skill。它做的是这样一种视频：B 站横屏，4K，十到二十分钟；画面每一帧都是代码渲染的，一间 three.js 搭的书房和床角，显示器、软木板、桌上掉下来的字块、一个主持小机器人（名字和颜色由你定），全由一张导演表按口播的字来驱动；声音分人声、配乐、音效和环境声，最后在达芬奇里混音出片。

## 八步

| 步 | 工种 | 做什么 |
|---|---|---|
| 0 | 开工 | 建目录（可以从上一集带过片场来），查环境 |
| 1 | 编剧 | 看自己的后台和同类爆款，出候选题；写稿；过两道检查：AI 套话检查、「像 AI」打分器 |
| 2 | 配音 | 你自己声音的克隆（Qwen3-TTS）。每句念几遍，Whisper 听写成字对稿，留最准的一遍 |
| 3 | 作曲 | ACE-Step 1.5 在本机写开场和铺底，量拍子感，筛掉抢人声的 |
| 4 | 美术和导演 | 片场每期往前走一点；导演表一行一个动作，时间写成口播里的词 |
| 5 | 拟音 | 片场动作的音效从导演表里读出来；音效少而柔；环境声用真实录音 |
| 6 | 剪辑出片 | 三条分轨，脚本建达芬奇工程，三分钟样片，再出 4K |
| 7 | 宣发 | 封面、标题、简介、置顶评论、字幕，发布前体检，附一页「请戴耳机检查」 |
| 8 | 收工 | 运行记录收尾，写经验总结，把新学到的写回 skill |

每个工种做了什么、花了多久、卡在哪，都记在这一集的 `运行记录.md` 里。片子里说的数字从记录里取，不靠估。

## 安装

把这个仓库的地址发给你的 AI 助手，跟它说「帮我装上这个 skill，检查环境缺什么」。或者手动：

```bash
git clone https://github.com/syydaniel/juzu ~/.claude/skills/juzu
cp ~/.claude/skills/juzu/config.example.json ~/.claude/skills/juzu/config.json   # 填上路径和你的参考音
python3 ~/.claude/skills/juzu/scripts/juzu.py doctor
```

然后跟 AI 说：「用剧组做一期讲某某的视频」。它会先问你要题目，然后一路往下做，到那四个地方就停。

第一次用，可以先跑自带的示范片看看片场：

```bash
python3 ~/.claude/skills/juzu/scripts/juzu.py new 试一下
cd 你的 productions_dir/试一下/set
node render.mjs --page film.html --sheet 3,20,40,63,66,77 --cols 3 --w 640 --q ns=4 --out ../out/看看.jpg
```

## 需要什么

只在 **Apple 芯片的 Mac** 上测过。

| 东西 | 干什么用 |
|---|---|
| Node.js 18 以上、Chrome | 片场逐帧渲染（three.js + Playwright） |
| ffmpeg | 合成、响度、抽帧 |
| Python，装 `numpy soundfile scipy pillow` | 混音、音效、分轨、封面 |
| Python，装 `mlx-audio mlx-whisper` | 配音和听写。mlx 只能在 Apple 芯片上跑 |
| [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) | 作曲。用 XL-SFT 模型 50 步，很吃显卡，长段要等一阵 |
| Python，装 `scripts/copy/requirements.txt` | 「像 AI」打分器。第一次跑会下载约 1 GB 的标点模型 |
| 达芬奇 DaVinci Resolve | 混音出片，工程由脚本来建 |
| 一段 10 到 20 秒你自己的干净录音 | 声音克隆的参考音。只能用你本人的声音，或者本人同意过的声音 |

三个 Python 可以是同一个环境，也可以分开，在 `config.json` 的 `py`、`py_audio`、`py_music` 里写。缺哪样，`juzu.py doctor` 会说；缺的那一步做不了，别的步照常。

## 目录

```
SKILL.md        给 AI 看的总说明：八步、四个停点、规矩
stages/         每一步一份说明
reference/      文案怎么写、导演表写法、混音的数、达芬奇、踩过的坑
scripts/        juzu.py 是总入口；copy/ 是稿子的两道检查；sound/ 是作曲、拟音、分轨、达芬奇、发布
template/       一集的骨架：片场引擎和一段一分半钟左右的示范导演表、示范稿、cues.json
```

## 已知的不足

- 只在 Apple 芯片的 Mac 上测过。配音用的是 mlx 版的模型，别的机器要换方案。
- 「像 AI」打分器只拿真人稿和 AI 裸写稿比过一次，是个参考。稿子像不像你，最后要你自己听，能做盲测更好。
- 好不好听，机器判断不了。所以发布包里永远附着一页「请戴耳机检查」。
- 片场只有一间书房，带一个床角。想要别的景，要自己搭；想做平面的代码动画，用套娃。
- 慢。十四分钟的片子，从开工到出片前后将近一天，4K 逐帧渲染要一个多小时。

## 同一系列的 skill

- [卡字 kazi](https://github.com/syydaniel/kazi)：让讲解动画的画面卡在旁白的关键词上。
- [开口 kaikou](https://github.com/syydaniel/kaikou)：让克隆的声音，一开口就说人话。
- [套娃 taowa](https://github.com/syydaniel/taowa)：把「讲一个 skill 的视频」从选题做到发布包。
- [真实感开关 zhenshi-kaiguan](https://github.com/syydaniel/zhenshi-kaiguan)：用纯代码做出看着像拍出来的 3D 画面。
- [曲风环游 qufeng-huanyou](https://github.com/syydaniel/qufeng-huanyou)：一首曲子进去，八个国家的版本出来。

文档里说的「作者」，是写这个 skill 的人，那些规矩是一期期返工攒下来的；「用户」是你。

## 许可

MIT，见 `LICENSE`。片场里的字体用系统自带的；三维的主持小机器人是代码画的，可以随便起名、改颜色或换掉（见 `reference/导演表.md`）。床角被子的做法（先设计被面每一点的高度，再沿床垫包下去）学自 [room-at-dawn](https://github.com/Leonxlnx/room-at-dawn)（MIT）的思路，代码是这里自己写的。
