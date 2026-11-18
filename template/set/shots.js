import { smooth } from './smooth.js';
// 导演表：这一期每一秒做什么。按口播的顺序写，时间尽量写成词，少写秒数。全部写法见 skill 里的 reference/导演表.md。
// 时间写法：'c05'（这句开始）、'c05$'（这句结束）、'c05:关键词'（念到这个词）、'c05:关键词+0.4'、数字秒、'END'（片尾卡）、'DUR'（全片结束）。
// 这一份是演示：十一句口播，带着观众逛一遍片场（显示器、桌面和主持小机器人、软木板、床角），每一种东西都用到一次。新的一期从这里改起。
// 床角那一站示范三样随时间变的东西：LIGHT（光，换光只放在硬切上）、BLINDS（百叶慢慢合上）、MAGIC（悬浮段，至少 12 秒）。
// 手机翻面（PHONE）、全息投影（HOLO）、翻开的笔记本（NOTEBOOK + VISIT）演示里没用，写法在文末的注释里，要用时解开注释、换成这一期的词。
export default function ({ TX, TL }) {
  const KAKA_AT = { x: 1.93, z: .36, s: .072 };                       // 主持小机器人站的地方（米）和大小
  const MON = [1.45, 1.085, .2273];                                   // 显示器屏幕中心
  // 固定机位：p 机位、l 看向、mm 焦距、f 光圈值、focus 对焦点
  const CAMS = {
    wide:   { p: [2.95, 1.45, 2.85], l: [1.45, .98, .25], mm: 24, f: 4, focus: [1.45, 1.0, .25] },
    wide2:  { p: [2.70, 1.30, 2.45], l: [1.55, 1.0, .25], mm: 28, f: 4, focus: [1.6, 1.0, .3] },
    host:   { p: [1.88, 1.15, 1.30], l: [1.58, 1.0, .26], mm: 35, f: 4, focus: [1.80, 1.0, .33] },
    host2:  { p: [2.30, 1.10, 1.25], l: [1.62, 1.0, .25], mm: 40, f: 4, focus: [1.9, .95, .36] },
    talk:   { p: [2.18, .99, 1.24], l: [1.68, .88, .36], mm: 50, f: 2.0, focus: [1.93, .87, .38] },   // 小机器人在画面右三分之一，左边虚掉的地方放磨砂卡和贴图
    board:  { p: [2.66, 1.19, 1.55], l: [2.86, 1.17, .02], mm: 45, f: 5.6, focus: [2.86, 1.17, .02] }, // 软木板正面
    side:   { p: [0.80, 1.14, 0.98], l: [1.55, 1.02, .24], mm: 32, f: 4, focus: [1.45, 1.05, .25] },
    low:    { p: [2.10, .84, .80], l: [1.50, 1.00, .22], mm: 28, f: 2.8, focus: [1.93, .84, .36] },
    top:    { p: [1.60, 1.75, 1.05], l: [1.55, .76, .30], mm: 28, f: 4, focus: [1.6, .78, .3] },
    // 床角和悬浮段
    room:      { p: [3.15, 1.55, 3.0], l: [1.05, .75, 1.55], mm: 20, f: 5.6, focus: [1.2, .75, 1.6] },      // 整间屋子：窗、书桌、床角都在
    bedwide:   { p: [2.35, 1.32, 1.45], l: [.62, 1.0, 2.60], mm: 26, f: 5.6, focus: [.75, .6, 2.4] },      // 床角全景（再往左挪会被椅背挡住）
    bedclose:  { p: [1.50, .92, 1.80], l: [.32, .64, 2.82], mm: 40, f: 2.8, focus: [.34, .66, 2.76] },     // 床头近景：枕头、毛绒小熊
    // 悬浮段：屋子右后角看过去，36mm f/1.4 只装坐墩上的小机器人和板子，对焦约 2.3 米，后面的床和墙虚开
    magic:     { p: [3.05, 1.02, .48], l: [1.80, .82, 2.36], mm: 36, f: 1.4, focus: [1.81, .80, 2.32] },
    // 同一个位置退到 28mm、焦点拉到床头上方的墙：照片飞回墙上那一段用，从 magic 软切过来就是一次拉远加拉焦
    magicwall: { p: [3.05, 1.10, .48], l: [1.30, .98, 2.85], mm: 28, f: 2.8, focus: [.62, 1.45, 3.17] },
  };
  // 片场的布置（都可以不写）：便签、纸条、打印纸上的字，软木板上的六张照片，可选的摆设。图不在就用程序画的占位
  // bed / photos / door / shelf 写 false 就整期不要床角、照片墙、门、矮书柜；clock 是床头闹钟在第 0 秒指几点（小时，16.8 就是 16:48）
  const SET = { note: ['先灰模', '再打光'], prints: [0, 1, 2, 3, 4, 5].map((i) => `gen:print/${i}`), decor: {} };
  const KAKA_LOOK = {};                                               // 主持小机器人换颜色：{ shell: '#…', dark: '#…', red: '#…' }，不写就是中性的浅灰配雾蓝灰
  const DATA = {};                                                    // 终端录屏的数据：{ 名字: 'data/xxx.json' }，屏幕的 term 用
  const VOICE_ENV = 'data/voice_env.json';                            // 配音的响度包络（vo/env.py 生成）；没有就按每句的起止假装说话

  // ---------- 镜头 ----------
  // d 是从上一个镜头滑过来用几秒，0 = 硬切。scr：对着屏幕上 (u, v)，dist 米外；写 u2 / v2 / dist2 / yaw2 就在镜头时长里跟着内容移过去
  const FULL = { cam: 'scr', u: .5, v: .5, dist: .95, mm: 50, full: 1 };     // full：整屏镜头，smooth() 会让它不压字幕
  const JUMP = { cam: 'scr', u: .78, v: .75, dist: 1.2, yaw: 14, pitch: 6, mm: 35, creep: 0 };   // 屏幕和右边的小机器人都在画里：它跳进去、跳出来的时候用
  const at = (a, o) => ({ at: a, ...o });
  const CAM = [
    at(0, { cam: 'wide', drift: [-.02, -.005, -.035], move: 0 }),
    at('a01:导演表', { cam: 'host2', d: 2.4, move: { push: .06 } }),                          // 滑过去：从全景推到书桌
    at('a02', { ...FULL, d: 2.2, dist: 1.05, dist2: .95 }),
    // 第一站：屏幕
    at('b01', { cam: 'scr', d: 0, u: .42, v: .5, dist: .92, u2: .5, dist2: .88, span: 7 }),   // 硬切
    at('b02', { ...FULL, d: 1.6, dist: .95, dist2: .9 }),
    at('b03', { cam: 'scr', d: 1.6, u: .5, v: .5, dist: .92, yaw: -6, yaw2: 3, span: 6 }),
    at('b03:要比前后', { ...FULL, d: 1.4, dist: .95, dist2: .9 }),
    // 第二站：桌面和小机器人
    at('c01', { cam: 'desk', d: 0, x: 1.22, x2: 1.55, h2: .64, back2: .44, mm: 30, f: 2.8, span: 7.5 }),
    at('c02', { cam: 'talk', d: 0, move: { push: .05 } }),
    at('c02:跳进屏幕-1.0', { ...JUMP, d: 0 }),
    at('c02:跳进屏幕+.4', { ...FULL, d: 2.0 }),
    // 第三站：软木板
    at('d01', { cam: 'board', d: 0, move: { push: .14 } }),
    // 第四站：床角。先看整间屋子，百叶慢慢合上；「天一黑」硬切到床角，同时换成夜里的光（换光只放在硬切上）
    at('e01', { cam: 'room', d: 0, drift: [-.01, 0, -.012], move: 0 }),
    at('e01:天一黑', { cam: 'bedwide', d: 0, move: { push: .05 } }),
    // 悬浮段（MAGIC 在下面）：全屋看它起飞 → 硬切大光圈近景看照片长出来 → 照片回墙前软切 1.4 秒，拉远加拉焦到墙上
    at('e02-.3', { keep: 1, cam: 'room', d: 0, drift: [-.01, 0, -.01], move: 0 }),   // keep：短，但要看清它起飞，smooth() 别并掉
    at('e02+2.2', { cam: 'magic', d: 0, move: 0 }),
    at('e02$-2.6', { cam: 'magicwall', d: 1.4, move: 0 }),
    at('e03', { cam: 'wide', d: 0, drift: [-.012, -.004, -.02], move: 0 }),
  ];
  const CALM = ['talk'];                                              // 这些机位里显示器只留安静的底：近景里屏幕在画面一角，大字会被画框切掉一半

  // ---------- 显示器 ----------
  // head：屏幕顶上那行大字，可以随着话换：[[时刻, 字], …]；fx：圈注、放大镜、标签、荧光笔；tr：'push' 整页推过去、'rise' 从下面升上来
  const lab = (a, text, o) => ({ type: 'label', at: a, text, ...o });
  const SCREEN = [
    { kind: 'bigwords', t0: 0, t1: 'a02', kicker: '一间代码搭的书房', big: '每一帧都是算出来的', small: '照着导演表 shots.js', size: 92, col: '#eceae4' },
    { kind: 'chapters', t0: 'a02', t1: 'b01', head: '这一条，逛四个地方', cap: ' ', dy: 40, chh: 360, items: [{ name: '显示器', at: 'a02:显示器' }, { name: '桌面和小机器人', at: 'a02:桌面和小机器人' }, { name: '软木板', at: 'a02:软木板' }, { name: '床角', at: 'a02:床角' }] },
    { kind: 'list', t0: 'b01', t1: 'b02', title: 'shots.js · SCREEN', head: [['b01', '屏幕：每一页先有一行大标题'], ['b01:要点', '要点跟着话，一条条亮起来']], big: 42,
      items: [{ text: '大标题：一眼知道在讲什么', at: 'b01:大标题' }, { text: '要点：说一条，亮一条', at: 'b01:要点' }, { text: '说到哪个词，哪个词出来', at: 'b01:说到哪个词', hl: 'b01:哪个词就出来' }] },
    { kind: 'table', t0: 'b02', t1: 'b03', title: 'shots.js · SCREEN', head: '表格一行行出来，旧的划掉，换上新的', cols: ['', '旧写法', '新写法'], cw: [300, 560, 600], rh: 130,
      rows: [{ v: ['镜头', '每句都切一刀', '少切，跟着字慢慢推'], at: 'b02', at2: 'b02:换上新的', big: 32 },
             { v: ['屏幕', '只放一张图', '标题、要点和图解'], at: 'b02:一行一行', at2: 'b02:换上新的+.5', big: 32 },
             { v: ['时间', '手填秒数', '对准口播里的词'], at: 'b02:一行一行+.7', at2: 'b02:换上新的+1.0', big: 32, hl: 1 }] },
    { kind: 'bars', t0: 'b03', t1: 'b03:要比前后', title: 'shots.js', head: '这张导演表里写了多少条（程序现数的）', max: 1, rows: [] },
    { kind: 'versus', t0: 'b03:要比前后', t1: 'c01', title: 'gen.js · 同一张图', head: [['b03:要比前后', '前后对比：左右摆在一起'], ['b03:红笔', '再用红笔圈出该看的地方']], tr: 'push',
      a: { src: 'gen:clay/3', tag: '灰模' }, b: { src: 'gen:print/3', tag: '打上光以后' },
      fx: [{ type: 'ring', at: 'b03:红笔+.3', side: 1, u: .64, v: .4, rx: 90, ry: 70 }, lab('b03:该看的地方', '光从这里来', { side: 1, u: .5, v: .85, size: 28 })] },
    { kind: 'words', t0: 'c01', t1: 'c02', big: '桌面', small: '字块从上面掉下来', size: 110 },
    { kind: 'list', t0: 'c02', t1: 'd01', title: 'shots.js · KAKA', head: '小机器人的三条规矩', big: 40,
      items: [{ text: '不单独占一个镜头讲话', at: 'c02:它说话' }, { text: '旁边一定贴着这句话的重点', at: 'c02:旁边' }, { text: '可以跳进屏幕里帮忙指', at: 'c02:跳进屏幕', hl: 'c02:指一指' }] },
    { kind: 'bigwords', t0: 'd01', t1: 'e01', kicker: '剧组 · 片场', big: '软木板', small: '大白纸从上沿展开', size: 100 },
    { kind: 'bigwords', t0: 'e01', t1: 'END', kicker: '剧组 · 片场', big: '床角', small: 'LIGHT · BLINDS · MAGIC', size: 100 },
    { kind: 'bigwords', t0: 'END', t1: 'DUR', kicker: '片场就逛到这儿', big: '下次见', small: '想看的画面，写在评论区', size: 110 },
  ];

  // ---------- 小机器人跳进屏幕：path = [[时刻, x, y（脚底，屏幕设计稿 1600×900）, 大小, 翻转]]；say = 气泡 ----------
  const KAKA_IN = [
    { t0: 'c02:跳进屏幕+.3', t1: 'c02$+.2', path: [['c02:跳进屏幕+.3', 1430, 880, .85, 1], ['c02:指一指', 1180, 880, .85, 1]], say: [{ text: '看这条！', at: 'c02:指一指+.3', to: 'c02$', dx: -330 }] },
  ];

  // ---------- 软木板上的白纸：note 手写清单（mark 打勾打叉、strike 划掉、hl 荧光笔、ring 圈起来）；pins 钉照片 ----------
  const BOARD = [
    { kind: 'note', t0: 'd01', t1: 'e01', title: '软木板上的清单', size: 50,
      lines: [{ text: '大白纸从上沿展开', at: 'd01:展开', mark: '✓' }, { text: '清单一行行写出来', at: 'd01:清单', mark: '✓' }, { text: '写完打个勾', at: 'd01:打勾', mark: '✓', hl: 'd01:打勾+.4' }, { text: '写错的划掉', at: 'd01:打勾+.5', strike: 'd01:划掉' }] },
  ];

  // ---------- 片场里的立体字：flat = 平躺在桌上（从上面掉下来，出现后 0.42 秒落地）；pos = 立在桌上的牌子；都不写就浮在镜头前 ----------
  // 字块放在安全区里：x 1.12 到 1.97（左边是笔记本，右边是手机），z .665。tools/chk.mjs 会估每块多宽，出界会提醒
  const fl = (text, a, t1, x, o = {}) => ({ text, at: a, t1, flat: [x, o.z ?? .665], hgt: o.hgt ?? .065, size: o.size ?? 64, minW: o.minW ?? 300, ...o });
  const FX3D = [
    fl('掉下来', 'c01:掉下来', 'c02', 1.194), fl('一排字块', 'c01:一排字块', 'c02', 1.353), fl('角度都不一样', 'c01:角度', 'c02', 1.549),
    fl('落地', 'c01:落地那一下', 'c02', 1.726, { hl: 'c01:刚好对上' }), fl('嗒', 'c01:嗒-.42', 'c02', 1.861, { col: '#e9b65c' }),
  ];

  // ---------- 叠在最上面的 2D：磨砂信息卡（GLASS）、贴图（STICK：照片或便签） ----------
  const GLASS = [
    { t0: 'c02', t1: 'c02:跳进屏幕-1.0', x: 90, y: 200, w: 700, h: 430, kicker: '小机器人讲话的时候', title: '重点就在旁边',
      lines: [{ text: '一块磨砂卡，写着这句的重点', at: 'c02:它说话' }, { text: '或者一张贴图', at: 'c02:旁边', hl: 1 }] },
  ];
  const STICK = [
    { t0: 'a01:没有拍摄', t1: 'a02', src: 'gen:print/1', x: 1600, y: 300, w: 440, rot: 4, cap: '这张也是代码画的', ring: { u: .5, v: .55, r: .3, at: 'a01:素材图' } },
    { t0: 'c02:旁边', t1: 'c02:跳进屏幕-1.0', note: ['重点', '贴在旁边'], x: 1040, y: 260, w: 300, h: 210, rot: 5, fs: 40 },
  ];

  // ---------- 小机器人（三维）的表演：pose 姿势、face 表情、look 看哪（'screen' 看屏幕，不写就看镜头）、hop 跳一下 ----------
  const KAKA = [
    { at: 0, pose: 'stand', look: 'screen' }, { at: 'a01', pose: 'wave', face: 'happy' }, { at: 'a01:每一帧', pose: 'present', look: 'screen' },
    { at: 'a02', pose: 'stand', look: 'screen' },
    { at: 'b01', pose: 'present', look: 'screen' }, { at: 'b03', pose: 'point', look: 'screen' },
    { at: 'c01', pose: 'check', face: 'focus' },
    { at: 'c02', pose: 'happy', face: 'happy' }, { at: 'c02:它说话', pose: 'present', face: 'speak' }, { at: 'c02:旁边', pose: 'presentBoth' },
    { at: 'd01', pose: 'stand', look: 'screen' },
    { at: 'e01', pose: 'stand', look: 'screen' },
    { at: 'e03', pose: 'thumbsUp', face: 'happy', hop: 1 }, { at: 'e03:告诉我', pose: 'wave', face: 'happy' },
  ];

  // ---------- 光、百叶、悬浮段（都只在床角这一站用一次） ----------
  // LIGHT：每一行 { at, p: 'lowsun' | 'day' | 'afternoon' | 'dusk' | 'night', bed: 床头壁灯 0 到 1, d: 过渡秒数 }。只写一个名字（LIGHT = 'night'）就是整期一种光
  const LIGHT = [{ at: 0, p: 'lowsun' }, { at: 'e01:天一黑', p: 'night', bed: 1, d: .01 }];
  // BLINDS：{ at, a: 角度（弧度，-.5 平时，-1.35 差不多合上，-.15 几乎全开）, d: 转多久 }
  const BLINDS = [{ at: 0, a: -.5 }, { at: 'e01:百叶-.6', a: -1.35, d: 1.6 }];
  // MAGIC：小机器人飞到坐墩上，照片在它头顶长出来拼成板，板上放 panel 的内容（和显示器同一套画法），最后照片飞回床头墙。一段至少 12 秒。
  // float：哪几样东西跟着浮起来（plush 毛绒小熊、cushion 抱枕、pillow 枕头、clock 闹钟、book 床头柜上的书）
  const MAGIC = [{ t0: 'e02', t1: 'e02$+1.4', float: ['plush', 'clock', 'book'],
    panel: { w: .9, kind: 'bigwords', kicker: '悬浮段 · MAGIC', big: '板上也能放字', small: '和显示器同一套画法', size: 110, col: '#eceae4' } }];
  const HERO = [];                                                    // 整屏画面（比如真实录屏的片段）：{ t0, t1, dir, fps, n, start, fin, fout, zoom, label }
  const TITLES = [{ t0: 'a01', t1: 'a01:没有拍摄', kicker: '剧组', big: [['欢迎来我的', 0], ['片场', 1]], small: '每一帧都照着导演表算出来', dim: 1 }];
  const CHAPTERS = [{ at: 'a02$', dur: 2.6, no: '第一站', num: '01', name: '屏幕' }, { at: 'b03$', dur: 2.4, no: '第二站', num: '02', name: '桌面和小机器人' }, { at: 'c02$', dur: 2.4, no: '第三站', num: '03', name: '软木板' }, { at: 'd01$', dur: 2.4, no: '第四站', num: '04', name: '床角' }];
  const PROGRESS = { t0: 'b01+2', t1: 'e03', items: [{ name: '屏幕', at: 'b01' }, { name: '桌面和小机器人', at: 'c01' }, { name: '软木板', at: 'd01' }, { name: '床角', at: 'e01' }] };
  const CTA = [
    { at: 'e03:点个赞', kind: 'like', dur: 4.5, keys: ['like', 'coin', 'fav'], text: '点赞 · 投币 · 收藏', cx: 760, cy: 760 },
    { at: 'e03:评论区-.4', kind: 'comment', dur: 4.2, text: '想看下雨天的片场' },
    { at: 'e03:弹幕', kind: 'danmaku', dur: 6, hint: '想看什么，发条弹幕', lines: ['想看下雨的版本', '小机器人好可爱', '杯子还冒热气', '1', '百叶窗是真的吗'] },
  ];
  const FADES = [{ t0: 0, t1: .8, kind: 'in' }, { t0: 'DUR-1.2', t1: 'DUR', kind: 'out' }];
  const NOSUB = [];                                                   // 不画字幕的时间段：[[起, 止], …]
  const BADGE = '';                                                   // 右上角的系列标，比如 '系列名 · 第 1 期'；空着就不画
  const NOBADGE = [];

  // ---------- 演示里没用到的几样（写法见 reference/导演表.md），要用时解开注释、把时刻换成这一期的词 ----------
  // 手机翻过来亮屏（phone.js）：at 开始翻（前面 0.6 秒震两下），t1 硬切那一刻扣回去；kind 'comments' 评论区 / 'chat' 对话
  const PHONE = [
    // { at: 'e03:评论区', t1: 'DUR', kind: 'comments', title: '评论区', lines: [{ at: 'e03:评论区+.6' }, { at: 'e03:评论区+1.0' }], hl: { at: 'e03:弹幕', text: '想看下雨天' } },
  ];
  // 小机器人打出全息投影（holo.js）：kind 'flow' 几项加箭头 / 'merge' 几项收成一个结果 / 'check' 对和错；pos 是相对它站的位置（米）
  const HOLO = [
    // { t0: 'c02:旁边', t1: 'c02:跳进屏幕-1.0', kind: 'merge', kicker: '一句话的重点', inputs: [{ text: '磨砂卡', at: 'c02:旁边' }, { text: '贴图', at: 'c02:旁边+.6' }], result: { text: '贴在旁边', at: 'c02:一定贴着' } },
  ];
  // 桌上的笔记本被光线掀开（notebook.js）：小机器人要先飞过去（VISIT，t0 比 at 早 1.75 秒左右），说到哪句就在哪句底下描金线
  const NOTEBOOK = [
    // { at: 'd01+.15', head: '片场笔记', lines: [{ text: '先灰模', size: 90, hl: 'd01:清单' }, { text: '再打光', size: 90, hl: 'd01:打勾' }] },
  ];
  const VISIT = [
    // { t0: 'd01-1.6', t1: 'd01$+.6', to: [1.03, .36], yaw: -8, pose: 'present' },   // 落在笔记本正后方，面朝镜头
  ];
  // 其他新写法（都在别的表里加一个字段）：
  //   CAM 一条里写 rack: [[时刻, [x, y, z]], …]，对焦点在镜头里一个个拉过去；滑过去的镜头怕擦着东西，写 arc: .06（米）往后让一点
  //   MAGIC 的 panel 写 parts: [{ until: 'e02:词', kind: 'bigwords', … }, { kind: 'list', center: 1, … }]，板上分几段，到点交叉淡化
  //   MAGIC 写 end: 'gather'，讲完照片缩回小机器人手心，不上墙
  //   GLASS 宽高按字自动量；靠下的卡写 anchor: 'bottom'（底边钉在 y + h），minW 最小宽度，fit: false 用手写的固定 w、h
  //   SCREEN 的 list 写 center: 1 整块居中、subSize 小字字号；bigwords 写 kSize、sSize 改上下两行小字的字号
  //   KAKA 一条里写 act: 'nod' 点头、'shake' 摇头；FX3D 的字块写 off: 时刻，被推下桌

  // 柱状图的数字：从这一份导演表里数出来，改了表数字跟着变
  const bars = SCREEN.find((s) => s.kind === 'bars');
  bars.rows = [{ k: '镜头', v: CAM.length, at: 'b03+.4' }, { k: '屏幕', v: SCREEN.length, at: 'b03+.7' }, { k: '桌上的字块', v: FX3D.filter((x) => x.flat).length, at: 'b03+1.0' }, { k: '小机器人的动作', v: KAKA.length, at: 'b03:柱子', hl: 1 }];
  bars.max = Math.max(...bars.rows.map((r) => r.v)) * 1.15;
  // 运镜顺滑（smooth.js）：同机位连切并掉、短镜头不来回切、同一区域滑过去；换光的那几刀保持硬切。放在 LIGHT 写完以后
  smooth(CAM, TX, TL.duration, CAMS, { cuts: (Array.isArray(LIGHT) ? LIGHT : []).filter((l) => l.at !== 0).map((l) => l.at) });
  return { KAKA_AT, CAMS, SET, LIGHT, BLINDS, MAGIC, CALM, KAKA_LOOK, DATA, VOICE_ENV, CAM, SCREEN, KAKA, KAKA_IN, BOARD, FX3D, GLASS, STICK, PHONE, HOLO, NOTEBOOK, VISIT, HERO, TITLES, CHAPTERS, PROGRESS, CTA, FADES, NOSUB, BADGE, NOBADGE };
}
