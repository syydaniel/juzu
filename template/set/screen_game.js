// 66 号「读博的矛盾」：游戏画风的屏幕（像素小屏、RPG 对话框、HUD、战争迷雾、集章卡）。
// 作者 11-18：模拟的场景用游戏画风（像素风、RPG 对话框），效果从代码画风图鉴里挑。这里用了其中三类的做法：
//   像素 · 复古：低分辨率小画布 + 最近邻放大（Pyxel、TIC-80 那种小屏），自己定的 20 色调色板，点阵字（系统字按阈值二值化）；
//   程序化生成：地图一格一格「坍缩」出来（波函数坍缩那种长法），再盖上战争迷雾；
//   游戏 HUD：小地图、任务点、经验条、存档点、队友。
// 画法：在 chrome() 的内容区里开一块 800 宽的小画布（一格 = 屏幕画布 4 像素），画完最近邻放大贴回去。
// 图形按 2 格一个「像素」画（看着像 400 宽的小屏），字按 1 格画（细一点，读得清）。
// 每一帧只依赖 t：随机数都由 hash 决定，角色位置取整到格子上。
import { chrome } from './screen.js';
import { clamp, ease, easeOut, easeIO, back, lerp, P, hash } from './kit.js';

let TX0 = (x) => x; export const setTX3 = (f) => { TX0 = f; };
const T = (x, d) => TX0(x ?? d);

// ---------- 调色板（自己定的，暖金色跟书房的金色一致） ----------
export const PAL = { k: '#0d0f1a', n: '#161b33', d: '#25305c', v: '#5b4b8a', g: '#2f7d4f', h: '#24603f', l: '#62c46c', s: '#e8c37a', y: '#ffcc4d', o: '#ff9a3c',
  r: '#ef5a4e', p: '#ff8fb1', b: '#56b6f0', i: '#bfe8ff', c: '#f4ead8', e: '#8a8fa3', a: '#3a3f55', w: '#ffffff', m: '#8a5a3c', t: '#d9a066', u: '#1e6f8f', q: '#2a2f45' };
const FONT = '"PingFang SC", "Hiragino Sans GB", sans-serif', DIG = 'Menlo, "SF Mono", monospace';

// ---------- 小精灵（一格一个字母，. 是透明） ----------
const SPR = {
  kaka: ['.....r.....', '.....k.....', '.ccccccccc.', 'cckkkkkkkcc', 'cckikkkikcc', 'cckkkkkkkcc', 'cckkyyykkcc', '.ccccccccc.', '.....k.....', '..ccccccc..', '..cycycyc..', '..ccccccc..', '...k...k...', '..kk...kk..'],
  kaka2: ['.....r.....', '.....k.....', '.ccccccccc.', 'cckkkkkkkcc', 'cckikkkikcc', 'cckkkkkkkcc', 'cckkyyykkcc', '.ccccccccc.', '.....k.....', '..ccccccc..', '..cycycyc..', '..ccccccc..', '....k.k....', '...kk.kk...'],
  kakasad: ['.....r.....', '.....k.....', '.ccccccccc.', 'cckkkkkkkcc', 'cckkkkkkkcc', 'ccikkkkkicc', 'cckkkyykkcc', '.ccccccccc.', '.....k.....', '..ccccccc..', '..cycycyc..', '..ccccccc..', '...k...k...', '..kk...kk..'],
  slime: ['...llll...', '..llllll..', '.lwkllwkl.', '.llllllll.', 'llllllllll', 'hhhhhhhhhh'],
  boss: ['..v..............v..', '..vv............vv..', '...vvv..vvvv..vvv...', '....vvvvvvvvvvvv....', '...vvvvvvvvvvvvvv...', '..vvvrrvvvvvvrrvvv..', '..vvvrrvvvvvvrrvvv..',
    '.vvvvvvvvvvvvvvvvvv.', '.vvvwvwvwvwvwvwvvvv.', '.vvvkkkkkkkkkkkvvvv.', '.vvvwvwvwvwvwvwvvvv.', 'vvvvvvvvvvvvvvvvvvvv', 'vvvvvvvvvvvvvvvvvvvv', '.vvvvvvvvvvvvvvvvvv.', '..vvvv..vvvv..vvvv..', '..vvv....vv....vvv..'],
  npc: ['...eeeeee...', '..eeeeeeee..', '..etttttte..', '..tkktkktt..', '..tttttttt..', '..teeeeeet..', '...eeeeee...', '....eeee....', '..mmmmmmmm..', '.mmmmmmmmmm.', '.mmmsssmmmm.', '.mmmsssmmmm.', '.mmmmmmmmmm.', '..mmmmmmmm..', '..mm....mm..', '..kk....kk..'],
  car: ['..rrrr..', '.rrrrrr.', 'riiiiiir', 'rrrrrrrr', 'rrrrrrrr', 'rrrrrrrr', 'rriiiirr', 'rrrrrrrr', 'krrrrrrk', '.rrrrrr.'],
  carside: ['....rrrrrr......', '...riiriiirr....', '..rriiriiiirrr..', 'rrrrrrrrrrrrrrrr', 'rrrrrrrrrrrrrrry', 'rkkrrrrrrrrkkrrr', '.kek.......kek..', '..k.........k...'],
  lamp: ['yyyy', 'yyyy', '.ee.', '.ee.', '.ee.', '.ee.', '.ee.', '.ee.', '.ee.', '.ee.', '.ee.', '.ee.', 'eeee'],
  tree: ['...ll...', '..llll..', '.llllll.', 'llhlllll', '.llllhl.', 'llllllll', '.hllllh.', '...mm...', '...mm...'],
  rock: ['..eeee..', '.eeeeee.', 'eeaeeeee', 'eeeeeaee', '.aaaaaa.'],
  house: ['....rrrr....', '...rrrrrr...', '..rrrrrrrr..', '.rrrrrrrrrr.', 'rrrrrrrrrrrr', '.cccccccccc.', '.cbbcccbbcc.', '.cbbcmmcbbc.', '.ccccmmcccc.', '.ccccmmcccc.'],
  crystal: ['...b...', '..bib..', '.bbibb.', 'bbbiibb', '.bbibb.', '..bbb..', '...b...', '..eee..', '.eeeee.'],
  heart: ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
  heartE: ['.aa.aa.', 'a..a..a', 'a.....a', '.a...a.', '..a.a..', '...a...'],
  check: ['......ll', '.....ll.', 'l...ll..', 'll.ll...', '.lll....', '..l.....'],
  cross: ['rr....rr', '.rr..rr.', '..rrrr..', '..rrrr..', '.rr..rr.', 'rr....rr'],
  marker: ['..yyy..', '.yykyy.', 'yyykyyy', 'yyykyyy', '.yyyyy.', '..yky..', '...y...'],
  pad: ['..aaaaaaaa..', '.aaaaaaaaaa.', 'aaeaaaaaraaa', 'aeeeaaaayaya', 'aaeaaaaabaaa', 'aaaaaaaaaaaa', '.aaa....aaa.'],
  coin: ['.yyy.', 'yyoyy', 'yoyyy', 'yyoyy', '.yyy.'],
  star: ['..y..', '.yyy.', 'yyyyy', '.y.y.'],
  flag: ['rrrr.', 'rrrrr', 'rrrr.', 'e....', 'e....', 'e....', 'e....'],
  sword: ['.....e', '....e.', '...e..', 'm.e...', '.m....', 'm.m...'],
  book: ['mmmmmmm', 'mcccccm', 'mcaaacm', 'mcccccm', 'mcaaacm', 'mcccccm', 'mmmmmmm'],
  clock: ['..eee..', '.ecccce', 'ecckcce', 'ecckkce', 'eccccce', '.ecccce', '..eee..'],
  hop: ['..l.......l..', '..l.......l..', '...l.....l...', '....lllll....', '...lkllllll..', 'llllllllllllh', '.hhlllllllhh.', '.h..h...h..h.', 'h...h...h...h'],
  golf: ['..w..', '.www.', '..w..'],
};
const SC = new Map();
function sprC(name, tint) {
  const key = name + (tint ? JSON.stringify(tint) : ''); let c = SC.get(key); if (c) return c;
  const rows = SPR[name], wd = Math.max(...rows.map((r) => r.length)), ht = rows.length; c = document.createElement('canvas'); c.width = wd; c.height = ht; const x = c.getContext('2d');
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '.') return; x.fillStyle = (tint && tint[ch]) || PAL[ch]; x.fillRect(i, j, 1, 1); })); SC.set(key, c); return c;
}
// 画一个精灵：x,y 是左上角（小画布格子），sc 是一个精灵像素占几格；o: { flip, tint: { c: '#…' }, alpha, ax/ay（锚点 0..1） }
function spr(q, name, x, y, sc = 2, o = {}) {
  const c = sprC(name, o.tint), wd = c.width * sc, ht = c.height * sc, X = Math.round(x - (o.ax || 0) * wd), Y = Math.round(y - (o.ay || 0) * ht);
  q.save(); if (o.alpha !== undefined) q.globalAlpha *= o.alpha; if (o.flip) { q.translate(X + wd, Y); q.scale(-1, 1); q.drawImage(c, 0, 0, wd, ht); } else q.drawImage(c, X, Y, wd, ht); q.restore();
  return [X, Y, wd, ht];
}
const sprW = (name, sc = 2) => sprC(name).width * sc, sprH = (name, sc = 2) => sprC(name).height * sc;

// ---------- 点阵字：系统字画一次，按阈值二值化，缓存 ----------
const GC = new Map();
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
function glyph(ch, size, col, font) {
  const key = `${ch}|${size}|${col}|${font}`; let e = GC.get(key); if (e) return e;
  const m = document.createElement('canvas'), x = m.getContext('2d'), F = `600 ${size}px ${font}`; x.font = F;
  const wd = Math.max(1, Math.round(x.measureText(ch).width)); m.width = wd + 2; m.height = Math.ceil(size * 1.4) + 2;
  x.font = F; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText(ch, 1, Math.round(m.height / 2));
  const d = x.getImageData(0, 0, m.width, m.height), [R, G, B] = rgb(col);
  for (let i = 0; i < d.data.length; i += 4) { const on = d.data[i + 3] > 110; d.data[i] = R; d.data[i + 1] = G; d.data[i + 2] = B; d.data[i + 3] = on ? 255 : 0; }
  x.putImageData(d, 0, 0); e = { m, w: wd }; GC.set(key, e); return e;
}
// 写一行字：y 是这一行的竖直中心。o: { align: 'left'|'center'|'right', n: 只显示前 n 个字（打字机）, sh: 影子颜色（false 不要）, font, gap }
function txt(q, str, x, y, size, col = PAL.c, o = {}) {
  const chars = [...String(str)], font = o.font || FONT, gap = o.gap ?? Math.round(size * .06);
  const gs = chars.map((ch) => glyph(ch, size, col, font)), total = gs.reduce((n, gl) => n + gl.w + gap, -gap);
  let px = Math.round(o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x); const n = o.n ?? chars.length, sh = o.sh === undefined ? PAL.k : o.sh, d = Math.max(1, Math.round(size / 14));
  gs.forEach((gl, i) => { if (i >= n) return; const Y = Math.round(y - gl.m.height / 2);
    if (sh) q.drawImage(glyph(chars[i], size, sh, font).m, px - 1 + d, Y + d); q.drawImage(gl.m, px - 1, Y); px += gl.w + gap; });
  return total;
}
const tw = (str, size, font = FONT) => { const chars = [...String(str)], gap = Math.round(size * .06); return chars.reduce((n, ch) => n + glyph(ch, size, '#ffffff', font).w + gap, -gap); };
const typed = (t, t0, cps = 16) => Math.max(0, Math.floor((t - t0) * cps));        // 打字机：从 t0 起每秒几个字

// ---------- 窗口（RPG 那种双线框，四角缺一格） ----------
function box(q, x, y, w, h, o = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  q.fillStyle = o.bg || 'rgba(13,15,26,.92)'; q.fillRect(x + 2, y + 2, w - 4, h - 4);
  q.fillStyle = o.edge || PAL.c; q.fillRect(x + 2, y, w - 4, 2); q.fillRect(x + 2, y + h - 2, w - 4, 2); q.fillRect(x, y + 2, 2, h - 4); q.fillRect(x + w - 2, y + 2, 2, h - 4);
  q.fillStyle = o.edge2 || PAL.a; q.fillRect(x + 5, y + 5, w - 10, 1); q.fillRect(x + 5, y + h - 6, w - 10, 1); q.fillRect(x + 5, y + 5, 1, h - 10); q.fillRect(x + w - 6, y + 5, 1, h - 10);
}
// 一格一格的进度条：v 0..1，cells 格数
function cells(q, x, y, w, h, v, o = {}) {
  const n = o.n || 10, gap = 2, cw = (w - gap * (n - 1)) / n; q.fillStyle = PAL.k; q.fillRect(Math.round(x - 3), Math.round(y - 3), Math.round(w + 6), Math.round(h + 6));
  for (let i = 0; i < n; i++) { const f = clamp(v * n - i), X = Math.round(x + i * (cw + gap)); q.fillStyle = o.empty || PAL.q; q.fillRect(X, Math.round(y), Math.round(cw), Math.round(h));
    if (f > 0) { q.fillStyle = (o.pre && i < o.pre) ? (o.preCol || PAL.y) : (o.col || PAL.l); q.fillRect(X, Math.round(y), Math.round(cw * f), Math.round(h)); q.fillStyle = 'rgba(255,255,255,.28)'; q.fillRect(X, Math.round(y), Math.round(cw * f), 2); } }
}

// ---------- 开一块小画布，画完放大贴回去 ----------
let QC = null;
function begin(g, w, h, it, bg = PAL.n) {
  const a = chrome(g, w, h, it.title, it.sub), k = w / 800, H = Math.floor(a.h / k);
  if (!QC) QC = document.createElement('canvas'); if (QC.width !== 800 || QC.height !== H) { QC.width = 800; QC.height = H; }
  const q = QC.getContext('2d'); q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.imageSmoothingEnabled = false; q.fillStyle = bg; q.fillRect(0, 0, 800, H);
  return { g, q, a, k, W: 800, H };
}
function end(R) {
  const { g, a, k, H } = R; g.save(); g.imageSmoothingEnabled = false; g.drawImage(QC, 0, 0, 800, H, a.x, a.y, 800 * k, H * k);
  const vg = g.createRadialGradient(a.x + 400 * k, a.y + H * k / 2, H * k * .35, a.x + 400 * k, a.y + H * k / 2, 520 * k);   // 一点点屏幕暗角，像老显示器
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.28)'); g.fillStyle = vg; g.fillRect(a.x, a.y, 800 * k, H * k); g.restore();
}
const appear = (t, at, d = .35) => easeOut(P(t, at, d));
const pop = (t, at, d = .4) => back(P(t, at, d));

// ---------- 背景 ----------
function vn(x, y, sd) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, hh = (a, b) => hash(a * 57.31 + b * 113.7 + sd * 7.7), u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hh(xi, yi), hh(xi + 1, yi), u), lerp(hh(xi, yi + 1), hh(xi + 1, yi + 1), u), v); }
const TS = 16;                                                                       // 地图一格 16（看着是 8 个像素）
function terr(i, j, sd) { const n = vn(i / 6.5, j / 6.5, sd) * .7 + vn(i / 2.7, j / 2.7, sd + 3) * .3; return n < .3 ? 'w' : n < .35 ? 's' : n > .7 ? 'f' : n > .64 && hash(i * 3.3 + j * 9.1 + sd) > .55 ? 'r' : 'g'; }
function tile(q, ty, X, Y, i, j, t) {
  if (ty === 'w') { q.fillStyle = PAL.u; q.fillRect(X, Y, TS, TS); const ph = Math.floor(t * 1.5 + hash(i * 7 + j * 13) * 4) % 4; q.fillStyle = PAL.b; q.fillRect(X + 2 + ph * 2, Y + 5 + (j % 2) * 5, 6, 2); return; }
  if (ty === 's') { q.fillStyle = PAL.s; q.fillRect(X, Y, TS, TS); q.fillStyle = PAL.t; q.fillRect(X + 4, Y + 10, 2, 2); return; }
  if (ty === 'p') { q.fillStyle = PAL.t; q.fillRect(X, Y, TS, TS); q.fillStyle = PAL.s; q.fillRect(X + 3, Y + 4, 2, 2); q.fillRect(X + 10, Y + 11, 2, 2); return; }
  q.fillStyle = PAL.g; q.fillRect(X, Y, TS, TS); q.fillStyle = PAL.h; if (hash(i * 1.7 + j * 3.1) > .5) q.fillRect(X + 3, Y + 6, 2, 2); if (hash(i * 5.3 + j * .7) > .6) q.fillRect(X + 10, Y + 11, 2, 2);
  if (ty === 'f') spr(q, 'tree', X, Y - 2, 2); if (ty === 'r') spr(q, 'rock', X, Y + 4, 2);
}
// 一张地图：sd 种子；path: 一条土路（格子坐标的折线）；order：波函数坍缩式地一格格长出来 { at, speed }
function field(q, W, H, t, o = {}) {
  const cols = Math.ceil(W / TS), rows = Math.ceil(H / TS), sd = o.seed ?? 3, road = new Set();
  (o.road || []).forEach(([i0, j0, i1, j1]) => { const n = Math.max(Math.abs(i1 - i0), Math.abs(j1 - j0)); for (let s = 0; s <= n; s++) road.add(`${Math.round(lerp(i0, i1, s / Math.max(1, n)))},${Math.round(lerp(j0, j1, s / Math.max(1, n)))}`); });
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const X = i * TS, Y = j * TS; let ty = road.has(`${i},${j}`) ? 'p' : terr(i, j, sd); if (o.clear && o.clear(i, j)) ty = road.has(`${i},${j}`) ? 'p' : 'g';
    if (o.grow) { const d = Math.hypot(i - o.grow.i, j - o.grow.j) / (o.grow.speed || 26) + hash(i * 9.7 + j * 3.3) * .25, at = o.grow.at + d;
      if (t < at) { q.fillStyle = PAL.n; q.fillRect(X, Y, TS, TS); if ((i + j) % 2 === 0) { q.fillStyle = PAL.d; q.fillRect(X + 7, Y + 7, 2, 2); } continue; }
      if (t < at + .12) { q.fillStyle = PAL.i; q.fillRect(X, Y, TS, TS); continue; } }
    tile(q, ty, X, Y, i, j, t);
  }
}
function stars(q, W, H, t, sd = 1) {
  q.fillStyle = PAL.k; q.fillRect(0, 0, W, H); for (let j = 0; j < 6; j++) { q.fillStyle = j % 2 ? PAL.n : PAL.k; q.fillRect(0, Math.round(H * (.55 + j * .075)), W, Math.round(H * .075)); }
  for (let i = 0; i < 70; i++) { const x = Math.round(hash(i * 3.7 + sd) * W), y = Math.round(hash(i * 9.1 + sd) * H * .7), tw_ = (Math.floor(t * 2 + hash(i) * 8) % 8) === 0;
    q.fillStyle = tw_ ? PAL.y : i % 3 ? PAL.e : PAL.i; q.fillRect(x, y, 2, 2); }
}
// 小卡走路：位置取整，两帧交替
function walker(q, x, y, t, sc = 3, o = {}) { const step = o.still ? 0 : Math.floor(t * (o.fps || 6)) % 2; return spr(q, o.sad ? 'kakasad' : step ? 'kaka2' : 'kaka', x, y + (step && !o.still ? -1 : 0) * sc, sc, { flip: o.flip, tint: o.tint, ax: .5, ay: 1 }); }
// 沿着关键帧走：path [[at, x, y]]（x,y 是小画布坐标），在两个点之间走 dur 秒；返回 [x, y, 在不在走]
// 第 k 段走了多少（0..1）：到下一个点的时刻正好走到；写了 dur 就只在最后 dur 秒里走，没写就整段慢慢走
function seg(path, k, t, dur) { const ta = T(path[k][0]), tb = T(path[k + 1][0]), d = Math.max(.01, dur ? Math.min(dur, tb - ta) : tb - ta); return clamp((t - (tb - d)) / d); }
function along(path, t, dur) {
  for (let k = 0; k + 1 < path.length; k++) if (t < T(path[k + 1][0])) { const s = t < T(path[k][0]) ? 0 : seg(path, k, t, dur); return [lerp(path[k][1], path[k + 1][1], s), lerp(path[k][2], path[k + 1][2], s), s > 0 && s < 1]; }
  const z = path[path.length - 1]; return [z[1], z[2], false];
}
function shadow(q, x, y, w) { q.fillStyle = 'rgba(0,0,0,.35)'; q.fillRect(Math.round(x - w / 2), Math.round(y - 2), Math.round(w), 4); }
// 浮起来的字（+10 XP 那种）
function floater(q, text, x, y, t, at, col = PAL.y, size = 18) { const u = P(t, at, .9); if (u <= 0 || u >= 1) return; q.save(); q.globalAlpha = 1 - u * u; txt(q, text, x, y - u * 34, size, col, { align: 'center' }); q.restore(); }
// 系统提示的小框（弹出来）
function toast(q, text, x, y, t, at, o = {}) { const u = pop(t, at, .35); if (u <= 0) return; const w = tw(text, o.size || 18) + 36, h = (o.size || 18) + 22;
  q.save(); q.translate(Math.round(x), Math.round(y)); q.scale(u, u); box(q, -w / 2, -h / 2, w, h, { edge: o.edge || PAL.y, bg: o.bg }); txt(q, text, 0, 1, o.size || 18, o.col || PAL.c, { align: 'center' }); q.restore(); }

// ================= 画面种类 =================

// ---------- 标题卡：it { kicker, big, small, at, bg: 'stars'|'field'|'grow', spr: [{ name, x, y, sc, at, walk }], hint } ----------
function gtitle(g, w, h, it, t) {
  const R = begin(g, w, h, it), { q, W, H } = R, t0 = T(it.at, it.t0);
  if (it.bg === 'field' || it.bg === 'grow') { field(q, W, H, t, { seed: it.seed ?? 5, grow: it.bg === 'grow' ? { at: t0, i: 25, j: 12, speed: 30 } : null }); q.fillStyle = 'rgba(13,15,26,.55)'; q.fillRect(0, 0, W, H); }
  else stars(q, W, H, t, it.seed ?? 1);
  const cy = H * (it.cy ?? .44);
  const bigs = Array.isArray(it.big) ? it.big : [it.big];
  if (it.kicker) { const u = appear(t, t0); q.save(); q.globalAlpha = u; txt(q, it.kicker, W / 2, cy - 74 - (bigs.length - 1) * 26, 22, PAL.y, { align: 'center' }); q.restore(); }
  bigs.forEach((b, i) => { const [s_, col, a_] = Array.isArray(b) ? b : typeof b === 'object' ? [b.text, b.col || 'c', b.at] : [b, PAL.c]; const at = a_ !== undefined ? T(a_) : t0 + .15 + i * .35, n = typed(t, at, 22);
    txt(q, s_, W / 2, cy - 10 + i * 64 - (bigs.length - 1) * 26, it.size || 46, PAL[col] || col, { align: 'center', n }); });
  if (it.small) { const u = appear(t, t0 + .7); q.save(); q.globalAlpha = u; txt(q, it.small, W / 2, cy + 70 + (bigs.length - 1) * 38, 20, PAL.e, { align: 'center' }); q.restore(); }
  (it.spr || []).forEach((s_) => { const at = T(s_.at, it.t0); if (t < at) return; const y = s_.y ?? H - 40; if (s_.name === 'kaka') walker(q, s_.x, y, t, s_.sc || 3, { still: !s_.walk, sad: s_.sad, flip: s_.flip }); else spr(q, s_.name, s_.x, y, s_.sc || 3, { ax: .5, ay: 1, flip: s_.flip }); });
  if (it.hint) { const on = Math.floor(t * 1.6) % 2 === 0; if (t > t0 + 1 && on) txt(q, it.hint, W / 2, H - 26, 16, PAL.e, { align: 'center' }); }
  end(R);
}

// ---------- 大数字卡：it { kicker, num, unit, roll（数字从 0 滚上去）, numAt, lines: [{ text, at, hl }], note, icon } ----------
function gstat(g, w, h, it, t) {
  const R = begin(g, w, h, it), { q, W, H } = R, t0 = T(it.numAt, it.t0); stars(q, W, H, t, it.seed ?? 7);
  const X = it.icon ? 300 : W / 2, al = it.icon ? 'left' : 'center';
  if (it.icon) { const u = pop(t, T(it.t0) + .1, .5); if (u > 0) { q.save(); q.translate(160, H * .45); q.scale(u, u); spr(q, it.icon, 0, 0, it.isc || 10, { ax: .5, ay: .5 }); q.restore(); } }
  if (it.kicker) txt(q, it.kicker, X, H * .2, 22, PAL.y, { align: al, n: typed(t, T(it.t0), 26) });
  if (it.num !== undefined) { const u = P(t, t0, .9); let s_ = String(it.num); if (it.roll && u < 1) { const v = +String(it.num).replace(/[^\d.]/g, ''); s_ = String(Math.round(v * easeOut(u))); }
    if (t >= t0) { const nw = txt(q, s_, X, H * .42, it.nsize || 92, PAL.c, { align: al, font: DIG }); if (it.unit) txt(q, it.unit, al === 'center' ? X + nw / 2 + 12 : X + nw + 12, H * .42 + 18, 30, PAL.y); } }
  (it.lines || []).forEach((l, i) => { const at = T(l.at, it.t0); if (t < at) return; txt(q, l.text, X, H * .62 + i * 36, 22, l.hl ? PAL.y : PAL.c, { align: al, n: typed(t, at, 24) }); });
  if (it.note) txt(q, it.note, W - 20, H - 18, 13, PAL.e, { align: 'right', sh: false });
  end(R);
}

// ---------- 存档界面：it { slots: [{ name, time, at, icon, sad }], del: { at, text, sel（光标移到「是」的时刻） } } ----------
function gsave(g, w, h, it, t) {
  const R = begin(g, w, h, it), { q, W, H } = R; stars(q, W, H, t, 4);
  txt(q, '选择存档', 40, 34, 24, PAL.y); const sw = W - 80, sh = 96;
  it.slots.forEach((s_, i) => { const at = T(s_.at, it.t0), u = appear(t, at); if (u <= 0) return; const y = 70 + i * (sh + 18);
    q.save(); q.globalAlpha = u; box(q, 40, y, sw, sh, { edge: s_.hl ? PAL.y : PAL.c }); walker(q, 100, y + sh - 18, t, 4, { still: 1, sad: s_.sad });
    txt(q, `存档 ${i + 1}`, 160, y + 28, 16, PAL.e); txt(q, s_.name, 160, y + 60, 30, PAL.c); txt(q, s_.time, sw + 20, y + 60, 28, s_.sad ? PAL.r : PAL.l, { align: 'right', font: s_.mono ? DIG : FONT });
    if (s_.mood) txt(q, s_.mood, sw + 20, y + 28, 16, PAL.e, { align: 'right' }); q.restore(); });
  const D = it.del; if (D && t >= T(D.at)) { const u = pop(t, T(D.at), .35); q.fillStyle = `rgba(13,15,26,${.5 * u})`; q.fillRect(0, 0, W, H);
    q.save(); q.translate(W / 2, H * .56); q.scale(u, u); const bw = 460, bh = 150; box(q, -bw / 2, -bh / 2, bw, bh, { edge: PAL.r });
    txt(q, D.text, 0, -32, 24, PAL.c, { align: 'center', n: typed(t, T(D.at) + .2, 20) });
    const sel = D.sel && t >= T(D.sel) ? 0 : 1; ['是', '否'].forEach((o, i) => { const x = -70 + i * 140; txt(q, o, x, 30, 26, i === sel ? PAL.y : PAL.e, { align: 'center' }); if (i === sel) spr(q, 'marker', x - 40, 30, 2, { ax: .5, ay: .5 }); }); q.restore(); }
  end(R);
}

// ---------- 搜索页（示意，不是截图）：it { query, typeAt, rows: [{ text, by, game, at }], pun: { at, text } } ----------
function gsearch(g, w, h, it, t) {
  const R = begin(g, w, h, it, PAL.k), { q, W, H } = R, ta = T(it.typeAt, it.t0);
  box(q, 40, 20, W - 80, 52, { edge: PAL.b }); txt(q, '搜索', 64, 46, 18, PAL.e); txt(q, it.query, 130, 46, 26, PAL.c, { n: typed(t, ta, 6) }); if (Math.floor(t * 2) % 2 && t < ta + 1.5) { q.fillStyle = PAL.c; q.fillRect(130 + tw(it.query.slice(0, typed(t, ta, 6)), 26) + 4, 32, 3, 28); }
  it.rows.forEach((r, i) => { const at = T(r.at, it.t0), u = appear(t, at, .25); if (u <= 0) return; const y = 96 + i * 46; q.save(); q.globalAlpha = u;
    q.fillStyle = r.game ? 'rgba(239,90,78,.16)' : 'rgba(255,255,255,.04)'; q.fillRect(40, y, W - 80, 40); spr(q, r.game ? 'pad' : 'book', 70, y + 20, 2, { ax: .5, ay: .5 });
    txt(q, r.text, 104, y + 20, 19, PAL.c); if (r.game) txt(q, '游戏', W - 60, y + 20, 15, PAL.r, { align: 'right' }); q.restore(); });
  if (it.pun && t >= T(it.pun.at)) { const u = pop(t, T(it.pun.at), .45); q.save(); q.translate(W / 2, H * .62); q.rotate(-.06); q.scale(u, u); box(q, -230, -46, 460, 92, { edge: PAL.y, bg: 'rgba(37,48,92,.96)' });
    txt(q, it.pun.text, 0, 0, 32, PAL.y, { align: 'center' }); q.restore(); }
  if (it.note) txt(q, it.note, W - 20, H - 14, 13, PAL.e, { align: 'right', sh: false });
  end(R);
}

// ---------- 选关：it { nodes: [{ name, at }] } 小卡沿着路走到正在说的那一关 ----------
function glevels(g, w, h, it, t) {
  const R = begin(g, w, h, it), { q, W, H } = R, n = it.nodes.length, pts = it.nodes.map((_, i) => [110 + i * ((W - 220) / (n - 1)), H * (i % 2 ? .38 : .62)]);
  const road = []; for (let i = 0; i + 1 < n; i++) road.push([Math.round(pts[i][0] / TS), Math.round(pts[i][1] / TS), Math.round(pts[i + 1][0] / TS), Math.round(pts[i + 1][1] / TS)]);
  field(q, W, H, t, { seed: it.seed ?? 11, road, clear: (i, j) => pts.some(([x, y]) => Math.abs(i - x / TS) < 2.5 && Math.abs(j - y / TS) < 2) }); q.fillStyle = 'rgba(13,15,26,.25)'; q.fillRect(0, 0, W, H);
  let cur = -1; it.nodes.forEach((nd, i) => { if (t >= T(nd.at, it.t0)) cur = i; });
  it.nodes.forEach((nd, i) => { const [x, y] = pts[i], on = i <= cur, u = pop(t, T(nd.at, it.t0), .4); spr(q, 'flag', x + 10, y - 4, 3, { ax: 0, ay: 1, alpha: on ? 1 : .35 });
    const bw = Math.max(150, tw(nd.name, 18) + 30), ly = i % 2 ? y + 54 : y - 92; q.save(); q.globalAlpha = on ? 1 : .55; box(q, x - bw / 2, ly, bw, 60, { edge: i === cur ? PAL.y : PAL.e });
    txt(q, `1-${i + 1}`, x, ly + 18, 14, PAL.y, { align: 'center' }); txt(q, nd.name, x, ly + 41, 18, PAL.c, { align: 'center' }); q.restore(); if (u > 0 && u < 1) { q.save(); q.globalAlpha = 1 - u; q.strokeStyle = PAL.y; q.lineWidth = 2; q.strokeRect(x - 20 - u * 20, y - 20 - u * 20, 40 + u * 40, 40 + u * 40); q.restore(); } });
  const path = [[it.t0, pts[0][0] - 60, pts[0][1]], ...it.nodes.map((nd, i) => [nd.at, pts[i][0], pts[i][1]])], [x, y, mv] = along(path, t, .8);
  shadow(q, x, y + 2, 22); walker(q, x, y, t, 3, { still: !mv });
  end(R);
}

// ---------- 开放世界 + HUD：it { show: { mini, marker, xp, save, party, quest }（各自出现的时刻，null 不出现）, hits: [时刻]（砍一下史莱姆）, labels: 1（安装时弹出名字）,
//   quest: '…', tasks: [{ text, at, done }], fog: 1（没有界面的版本：一片迷雾）, xp0 } ----------
function ghud(g, w, h, it, t) {
  const R = begin(g, w, h, it), { q, W, H } = R, S = it.show || {}, on = (k) => S[k] !== undefined && S[k] !== null && t >= T(S[k]), at = (k) => T(S[k]);
  field(q, W, H, t, { seed: it.seed ?? 21, road: [[0, 14, 30, 14], [30, 14, 30, 4]] });
  const px = 300 + Math.round(Math.sin((t - T(it.t0)) * .6) * 6), py = 14 * TS + 6, hits = (it.hits || []).map((x) => T(x)), lastHit = hits.filter((x) => t >= x).pop();
  const swing = lastHit !== undefined && t - lastHit < .25;
  if (!it.noSlime) { const sx = px + 70, flash = swing, alive = !(it.slimeDie && t >= T(it.slimeDie)); if (alive) { shadow(q, sx + 10, py + 2, 22); spr(q, 'slime', sx + 10, py + Math.round(Math.sin(t * 5) * 1.5), 3, { ax: .5, ay: 1, tint: flash ? { l: '#ffffff', h: '#bfe8ff', w: '#ffffff' } : null }); } }
  shadow(q, px, py + 2, 22); walker(q, px, py, t, 3, { still: !it.walk }); if (swing) spr(q, 'sword', px + 22, py - 30, 3, { ax: .5, ay: .5 }); else spr(q, 'sword', px + 18, py - 18, 3, { ax: .5, ay: .5 });
  hits.forEach((x) => floater(q, '+10 XP', px + 80, py - 50, t, x));
  if (it.fog) { // 没有界面：迷雾里只看得见脚下一小圈
    const fx = px, fy = py - 20, r = 70 + Math.sin(t * 1.3) * 4; for (let j = 0; j < H; j += 8) for (let i = 0; i < W; i += 8) { const d = Math.hypot(i + 4 - fx, j + 4 - fy) - r; if (d < -10) continue;
      q.fillStyle = d > 26 ? PAL.n : ((i / 8 + j / 8) % 2 ? PAL.n : 'rgba(22,27,51,.55)'); q.fillRect(i, j, 8, 8); } }
  const lab = (text, x, y, k) => { if (it.labels && t < at(k) + 2.2) toast(q, text, x, y, t, at(k) + .15, { size: 16 }); };
  if (on('quest')) { const u = appear(t, at('quest')); q.save(); q.globalAlpha = u; box(q, 16, 14, 300, 70); txt(q, '当前任务', 32, 34, 14, PAL.y); txt(q, it.quest || '前往老城区', 32, 60, 20, PAL.c, { n: typed(t, at('quest'), 20) }); q.restore(); }
  if (on('tasks')) { const ts = it.tasks || [], bh = 40 + ts.length * 30; const u = appear(t, at('tasks')); q.save(); q.globalAlpha = u; box(q, 16, 14, 330, bh); txt(q, '今天的小任务', 32, 34, 14, PAL.y);
    ts.forEach((k, i) => { const ka = T(k.at, it.t0); if (t < ka) return; const done = k.done && t >= T(k.done); spr(q, done ? 'check' : 'heartE', 34, 50 + i * 30, 2); txt(q, k.text, 60, 56 + i * 30, 17, done ? PAL.l : PAL.c, { n: typed(t, ka, 22) }); if (k.done) floater(q, '+1', 300, 56 + i * 30, t, T(k.done), PAL.y, 16); }); q.restore(); lab('任务点', 180, bh + 40, 'tasks'); }
  if (on('mini')) { const u = appear(t, at('mini')), mx = W - 150, my = 16; q.save(); q.globalAlpha = u; box(q, mx, my, 134, 100); q.fillStyle = PAL.h; q.fillRect(mx + 8, my + 8, 118, 84);
    for (let j = 0; j < 14; j++) for (let i = 0; i < 20; i++) { const ty = terr(i * 2, j * 2, it.seed ?? 21); if (ty === 'w') { q.fillStyle = PAL.u; q.fillRect(mx + 8 + i * 6, my + 8 + j * 6, 6, 6); } else if (ty === 'f') { q.fillStyle = PAL.g; q.fillRect(mx + 8 + i * 6, my + 8 + j * 6, 6, 6); } }
    if (Math.floor(t * 3) % 2 === 0) { q.fillStyle = PAL.w; q.fillRect(mx + 56, my + 58, 6, 6); } if (on('marker')) { q.fillStyle = PAL.y; q.fillRect(mx + 100, my + 22, 6, 6); } q.restore(); lab('小地图', mx + 67, my + 124, 'mini'); }
  if (on('marker')) { const bob = Math.round(Math.sin(t * 4) * 3); spr(q, 'marker', 540, 70 + bob, 4, { ax: .5, ay: 0, alpha: appear(t, at('marker')) }); q.save(); q.globalAlpha = appear(t, at('marker')); txt(q, it.mdist || '120 m', 540, 120, 14, PAL.y, { align: 'center' }); q.restore(); lab(it.mlab || '任务点', 540, 150, 'marker'); }
  if (on('xp')) { const u = appear(t, at('xp')), n = hits.filter((x) => t >= x).length, v = clamp((it.xp0 ?? .35) + n * .12 + (it.xpRate || 0) * Math.max(0, t - at('xp'))); q.save(); q.globalAlpha = u;
    txt(q, it.xpName || 'Lv.3', 30, H - 26, 16, PAL.y); cells(q, 90, H - 34, it.xpW || 300, 14, v, { n: it.xpCells || 20, col: PAL.y, pre: it.pre, preCol: PAL.l }); if (it.xpCap) txt(q, it.xpCap, 90 + (it.xpW || 300) + 14, H - 26, 15, PAL.c); q.restore(); lab(it.xpLab || '经验条', 200, H - 66, 'xp'); }
  if (on('save')) { const u = pop(t, at('save')); q.save(); q.translate(W - 110, H - 80); q.scale(u, u); spr(q, 'crystal', 0, Math.round(Math.sin(t * 3) * 2), 4, { ax: .5, ay: .5 }); q.restore(); if (t >= at('save') + .4) txt(q, it.saveCap || '存档点', W - 110, H - 26, 15, PAL.b, { align: 'center' }); }
  (it.tips || []).forEach((tp) => { const a_ = T(tp.at); if (t >= a_ && t < (tp.to ? T(tp.to) : 1e9)) toast(q, tp.text, tp.x ?? W / 2, tp.y ?? H / 2 - 40, t, a_, { size: tp.size || 22 }); });
  if (on('party')) { const u = appear(t, at('party')); q.save(); q.globalAlpha = u; ['#bfe8ff', '#ffcc4d', '#ff8fb1'].forEach((c, i) => { const x = px - 50 - i * 34; shadow(q, x, py + 2, 20); walker(q, x, py, t + i * .3, 3, { still: !it.walk, tint: { c } }); }); q.restore(); lab('队友', px - 84, py - 70, 'party'); }
  end(R);
}

// ---------- 心流通道：it { chips: [{ text, at }], dot: [[at, 能力 0..1, 难度 0..1]], zones: at（标出无聊 / 焦虑） } ----------
function gflow(g, w, h, it, t) {
  const R = begin(g, w, h, it, PAL.k), { q, W, H } = R, X0 = 340, Y0 = H - 50, CW = 420, CH = H - 110;
  const za = T(it.zones, it.t0);
  for (let j = 0; j < CH; j += 8) for (let i = 0; i < CW; i += 8) { const u = i / CW, v = 1 - j / CH, d = v - u; let col = Math.abs(d) < .16 ? PAL.g : d > 0 ? PAL.v : PAL.u; if (t < za) col = Math.abs(d) < .16 ? PAL.g : PAL.q;
    q.fillStyle = col; q.fillRect(X0 + i, Y0 - CH + j, 8, 8); if ((i / 8 + j / 8) % 2 === 0) { q.fillStyle = 'rgba(0,0,0,.18)'; q.fillRect(X0 + i, Y0 - CH + j, 8, 8); } }
  q.fillStyle = PAL.c; q.fillRect(X0 - 2, Y0 - CH, 2, CH + 2); q.fillRect(X0 - 2, Y0, CW + 2, 2);
  txt(q, '难度', X0 - 14, Y0 - CH + 12, 16, PAL.c, { align: 'right' }); txt(q, '你现在的水平', X0 + CW, Y0 + 20, 16, PAL.c, { align: 'right' });
  txt(q, '心流', X0 + CW * .62, Y0 - CH * .66, 24, PAL.y, { align: 'center' });
  if (t >= za) { q.save(); q.globalAlpha = appear(t, za); txt(q, '太难：崩溃', X0 + CW * .22, Y0 - CH * .82, 18, PAL.p, { align: 'center' }); txt(q, '太简单：无聊', X0 + CW * .78, Y0 - CH * .16, 18, PAL.i, { align: 'center' }); q.restore(); }
  (it.chips || []).forEach((c, i) => { const at = T(c.at, it.t0), u = pop(t, at); if (u <= 0) return; q.save(); q.translate(150, 70 + i * 82); q.scale(u, u); box(q, -110, -30, 220, 60, { edge: PAL.y }); txt(q, c.text, 0, 0, 22, PAL.c, { align: 'center' }); q.restore(); });
  if (it.dot) { const [u, v] = along(it.dot.map(([a, x, y]) => [a, x, y]), t, .7); const x = X0 + u * CW, y = Y0 - v * CH; spr(q, 'kaka', x, y + 14, 2, { ax: .5, ay: 1 }); }
  if (it.note) txt(q, it.note, W - 20, H - 12, 13, PAL.e, { align: 'right', sh: false });
  end(R);
}

// ---------- 对照表：it { cols: ['', '游戏里'], rows: [{ k, v, at, mark: 'check'|'cross', markAt, icon }] } ----------
function gcheck(g, w, h, it, t) {
  const R = begin(g, w, h, it), { q, W, H } = R; stars(q, W, H, t, it.seed ?? 9);
  const n = it.rows.length, rh = Math.min(84, (H - 80) / n), Y0 = (H - rh * n) / 2 + 14;
  if (it.cols) { txt(q, it.cols[0], 70, Y0 - 22, 16, PAL.e); txt(q, it.cols[1], 330, Y0 - 22, 16, PAL.e); }
  it.rows.forEach((r, i) => { const at = T(r.at, it.t0), u = appear(t, at, .3); if (u <= 0) return; const y = Y0 + i * rh; q.save(); q.globalAlpha = u; q.translate(Math.round((1 - u) * -20), 0);
    box(q, 50, y, W - 100, rh - 12, { edge: r.hl ? PAL.y : PAL.a }); if (r.icon) spr(q, r.icon, 90, y + (rh - 12) / 2, 3, { ax: .5, ay: .5 });
    txt(q, r.k, r.icon ? 130 : 74, y + (rh - 12) / 2, 26, r.hl ? PAL.y : PAL.c); if (r.v) txt(q, r.v, 330, y + (rh - 12) / 2, 22, PAL.c, { n: typed(t, T(r.vAt, at) , 22) });
    if (r.mark && t >= T(r.markAt, at)) { const m = pop(t, T(r.markAt, at)); q.save(); q.translate(W - 100, y + (rh - 12) / 2); q.scale(m, m); spr(q, r.mark, 0, 0, 4, { ax: .5, ay: .5 }); q.restore(); }
    q.restore(); });
  if (it.note) txt(q, it.note, W - 20, H - 12, 13, PAL.e, { align: 'right', sh: false });
  end(R);
}

// ---------- RPG 对话：it { bg: 'office'|'field', cast: [{ name: 'npc', x, at, leave }], lines: [{ who, text, at, port }], kakaX } ----------
function office(q, W, H) {
  q.fillStyle = PAL.d; q.fillRect(0, 0, W, H * .58); q.fillStyle = PAL.m; q.fillRect(0, H * .58, W, H * .42); q.fillStyle = PAL.t; for (let x = 0; x < W; x += 48) q.fillRect(x, H * .58, 2, H * .42);
  for (let s = 0; s < 3; s++) { const y = 30 + s * 58; q.fillStyle = PAL.m; q.fillRect(470, y + 44, 300, 6); for (let b = 0; b < 16; b++) { const bh = 30 + Math.round(hash(b * 3 + s) * 12); q.fillStyle = ['#ef5a4e', '#56b6f0', '#e8c37a', '#62c46c', '#8a8fa3'][(b + s) % 5]; q.fillRect(476 + b * 18, y + 44 - bh, 14, bh); } }
  q.fillStyle = PAL.i; q.fillRect(60, 40, 150, 110); q.fillStyle = PAL.b; q.fillRect(66, 46, 138, 98); q.fillStyle = PAL.c; q.fillRect(133, 40, 4, 110); q.fillRect(60, 93, 150, 4);
  q.fillStyle = PAL.t; q.fillRect(480, H * .5, 220, 14); q.fillStyle = '#5e3d28'; q.fillRect(490, H * .5 + 14, 12, 40); q.fillRect(678, H * .5 + 14, 12, 40);
  for (let p = 0; p < 4; p++) { q.fillStyle = PAL.c; q.fillRect(510 + p * 40 + p % 2 * 6, H * .5 - 6 - p % 3 * 4, 34, 6 + p % 3 * 4); }
}
function gdialog(g, w, h, it, t) {
  const R = begin(g, w, h, it), { q, W, H } = R; if (it.bg === 'field') field(q, W, H, t, { seed: it.seed ?? 31 }); else office(q, W, H);
  const fy = it.bg === 'field' ? H * .7 + 10 : H * .64, kx = it.kakaX ?? 230; shadow(q, kx, fy + 2, 24); walker(q, kx, fy, t, 4, { still: 1, sad: it.sadAt && t >= T(it.sadAt) });
  (it.cast || []).forEach((c) => { const a = T(c.at, it.t0); if (t < a) return; let x = c.x; const lv = c.leave !== undefined ? T(c.leave) : 1e9; if (t >= lv) x += (t - lv) * 180; if (x > W + 40) return;
    shadow(q, x, fy + 2, 28); spr(q, c.name, x, fy + (t >= lv ? -(Math.floor(t * 6) % 2) * 2 : 0), 4, { ax: .5, ay: 1, flip: t >= lv ? 0 : 1 }); });
  if (it.pat && t >= T(it.pat) && t < T(it.pat) + .8) { floater(q, '拍拍', kx + 30, fy - 80, t, T(it.pat), PAL.c, 16); }
  let cur = null; (it.lines || []).forEach((l) => { if (t >= T(l.at, it.t0)) cur = l; }); if (cur && !(cur.to && t >= T(cur.to))) { const bx = 24, by = H - 128, bw = W - 48, bh = 112, at = T(cur.at, it.t0), u = appear(t, at, .2);
    q.save(); q.globalAlpha = u; box(q, bx, by, bw, bh); if (cur.port) { q.fillStyle = PAL.d; q.fillRect(bx + 14, by + 14, 84, 84); spr(q, cur.port, bx + 56, by + 56, 5, { ax: .5, ay: .5 }); }
    const tx = cur.port ? bx + 116 : bx + 24; txt(q, cur.who, tx, by + 26, 16, PAL.y); const n = typed(t, at + .15, cur.cps || 14); txt(q, cur.text, tx, by + 66, 28, PAL.c, { n });
    if (n >= [...cur.text].length && Math.floor(t * 2.5) % 2 === 0) { q.fillStyle = PAL.c; q.fillRect(bx + bw - 34, by + bh - 24, 10, 6); q.fillRect(bx + bw - 32, by + bh - 18, 6, 4); } q.restore(); }
  if (it.dots && t >= T(it.dots)) floater(q, '……', kx, fy - 76, t, T(it.dots), PAL.c, 22);
  end(R);
}

// ---------- 等反馈：it { rows: [{ name, act, at, dur, days, col, done, note }], note } ----------
function gload(g, w, h, it, t) {
  const R = begin(g, w, h, it, PAL.k), { q, W, H } = R, n = it.rows.length, rh = (H - 40) / n;
  it.rows.forEach((r, i) => { const at = T(r.at, it.t0), u = appear(t, at, .3); if (u <= 0) return; const y = 20 + i * rh; q.save(); q.globalAlpha = u * (r.ghost ? .7 : 1);
    box(q, 30, y, W - 60, rh - 16, { edge: r.hl ? PAL.y : PAL.a }); spr(q, r.icon || 'pad', 80, y + (rh - 16) / 2, 4, { ax: .5, ay: .5 }); txt(q, r.name, 130, y + 30, 22, PAL.c); txt(q, r.act, 130, y + 62, 16, PAL.e);
    const bx = 330, bw = 300, by = y + (rh - 16) / 2 - 10, v = r.dur ? clamp((t - at - .3) / r.dur) : (t >= at + .3 ? 1 : 0);
    if (r.days) { cells(q, bx, by, bw, 20, easeIO(v), { n: 20, col: r.col ? PAL[r.col] : PAL.b }); const day = Math.round(r.days * easeIO(v)); txt(q, v >= 1 ? (r.doneText || `${r.days} 天`) : `第 ${day} 天…`, bx + bw + 20, by + 10, 22, v >= 1 ? PAL.y : PAL.c);
      if (v < 1) { const k = Math.floor(t * 8) % 8; for (let s = 0; s < 8; s++) { q.fillStyle = s === k ? PAL.c : PAL.a; q.fillRect(bx - 34 + Math.round(Math.cos(s / 8 * 6.28) * 9), by + 7 + Math.round(Math.sin(s / 8 * 6.28) * 9), 4, 4); } } }
    else { if (v >= 1) { spr(q, 'check', bx + 6, by - 2, 4); txt(q, r.doneText || '马上就有反应', bx + 60, by + 10, 22, PAL.l); } else txt(q, '…', bx, by + 10, 22, PAL.c); }
    if (r.loop && t >= T(r.loop)) { const m = pop(t, T(r.loop)); q.save(); q.translate(bx + bw / 2, by + 10); q.rotate(-.08); q.scale(m, m); box(q, -110, -20, 220, 40, { edge: PAL.r, bg: 'rgba(60,20,24,.95)' }); txt(q, '改完，重新排队 ↻', 0, 0, 18, PAL.r, { align: 'center' }); q.restore(); }
    q.restore(); });
  if (it.note) txt(q, it.note, W - 20, H - 10, 13, PAL.e, { align: 'right', sh: false });
  end(R);
}

// ---------- 蹭路灯：it { hit, later, msg, text, throwAt } ----------
function gcar(g, w, h, it, t) {
  const R = begin(g, w, h, it), { q, W, H } = R, hit = T(it.hit), later = T(it.later), msg = T(it.msg); field(q, W, H, t, { seed: it.seed ?? 41 });
  const ry = H * .55; q.fillStyle = PAL.a; q.fillRect(0, ry, W, 70); q.fillStyle = PAL.e; for (let x = 0; x < W; x += 40) q.fillRect(x + 8, ry + 33, 20, 4); q.fillStyle = PAL.c; q.fillRect(0, ry - 4, W, 4);
  const lx = 520, tilt = t >= hit ? Math.min(.35, (t - hit) * 2) : 0; q.save(); q.translate(lx, ry); q.rotate(tilt); spr(q, 'lamp', 0, 0, 4, { ax: .5, ay: 1 }); q.restore();
  const t0 = T(it.t0), cx = t < hit ? lerp(-80, lx - 70, clamp((t - t0) / Math.max(.3, hit - t0))) : lx - 70 + Math.min(20, (t - hit) * 10); spr(q, 'carside', cx, ry + 30, 5, { ax: .5, ay: 1 });
  if (t >= hit && t < hit + .6) { for (let s = 0; s < 10; s++) { const a = hash(s * 7.1) * 6.28, d = (t - hit) * 160 * (.5 + hash(s)); q.fillStyle = s % 2 ? PAL.y : PAL.o; q.fillRect(Math.round(lx - 20 + Math.cos(a) * d), Math.round(ry - 20 + Math.sin(a) * d), 4, 4); } txt(q, '哐！', lx - 20, ry - 90, 36, PAL.y, { align: 'center' }); }
  if (t >= hit + .3 && t < later) txt(q, '……', W / 2, 60, 26, PAL.c, { align: 'center' });
  if (t >= later) { const u = appear(t, later, .5); q.fillStyle = `rgba(13,15,26,${.82 * u})`; q.fillRect(0, 0, W, H); if (t < msg) { q.save(); q.globalAlpha = u; txt(q, it.laterText || '三个月以后……', W / 2, H / 2 - 10, 40, PAL.c, { align: 'center', n: typed(t, later + .2, 10) });
      const k = clamp((t - later) / Math.max(.5, msg - later)); spr(q, 'clock', W / 2, H / 2 + 70, 5, { ax: .5, ay: .5 }); q.fillStyle = PAL.r; q.fillRect(W / 2 - 1, H / 2 + 62, 2, 8); q.restore(); } }
  if (t >= msg) { const u = pop(t, msg, .4); q.save(); q.translate(W / 2, H / 2); q.scale(u, u); const bw = 620, bh = 170; box(q, -bw / 2, -bh / 2, bw, bh, { edge: PAL.y });
    txt(q, '系统提示', -bw / 2 + 28, -bh / 2 + 28, 16, PAL.y); txt(q, it.text || '您刚才那一下蹭得不太行，建议大修', -bw / 2 + 28, 0, 26, PAL.c, { n: typed(t, msg + .2, 12) });
    txt(q, '确定', 0, bh / 2 - 28, 20, PAL.y, { align: 'center' }); q.restore(); }
  if (it.throwAt && t >= T(it.throwAt)) { const u = clamp((t - T(it.throwAt)) / .9); q.save(); q.translate(W / 2 + u * 360, H / 2 + 80 - Math.sin(u * 3.14) * 200); q.rotate(u * 9); spr(q, 'pad', 0, 0, 5, { ax: .5, ay: .5 }); q.restore(); }
  end(R);
}

// ---------- 新手直接面对 Boss：it { slimeAt, bossAt, name, sub } ----------
function gboss(g, w, h, it, t) {
  const R = begin(g, w, h, it), { q, W, H } = R, ba = T(it.bossAt), sa = T(it.slimeAt, it.t0), sh = t >= ba && t < ba + .5 ? Math.round(Math.sin((t - ba) * 60) * 4 * (1 - (t - ba) / .5)) : 0;
  q.save(); q.translate(sh, 0); field(q, W, H, t, { seed: it.seed ?? 51, clear: (i, j) => j > 13 && j < 20 });
  const fy = H * .78; shadow(q, 200, fy + 2, 24); walker(q, 200, fy, t, 4, { still: 1, sad: t >= ba + .6 }); spr(q, 'sword', 232, fy - 34, 3, { ax: .5, ay: .5 });
  if (t >= sa && t < ba) { const u = pop(t, sa); txt(q, '新手村', 200, 40, 22, PAL.l, { align: 'center' }); q.save(); q.translate(360, fy); q.scale(u, u); spr(q, 'slime', 0, 0, 4, { ax: .5, ay: 1 }); q.restore(); txt(q, '史莱姆 Lv.1', 360, fy - 50, 15, PAL.c, { align: 'center' }); }
  if (t >= ba) { const u = easeOut(P(t, ba, .35)), y = lerp(-200, fy, u); q.fillStyle = `rgba(91,75,138,${.25 * u})`; q.fillRect(0, 0, W, H); shadow(q, 560, fy + 2, 160 * u); spr(q, 'boss', 560, y, 12, { ax: .5, ay: 1 });
    if (t >= ba + .5) { const v = appear(t, ba + .5); q.save(); q.globalAlpha = v; box(q, W / 2 - 300, 16, 600, 74, { edge: PAL.r }); txt(q, it.name || '最终 Boss', W / 2, 38, 18, PAL.r, { align: 'center' }); txt(q, it.sub || '还没有人做出来的问题', W / 2, 66, 24, PAL.c, { align: 'center' });
      cells(q, W / 2 - 280, 100, 560, 10, 1, { n: 40, col: PAL.r }); txt(q, 'HP ？？？', W / 2 + 280, 122, 14, PAL.r, { align: 'right' }); q.restore(); } }
  q.restore(); end(R);
}

// ---------- 进度条：it { rows: [{ name, at, from, to, dur, col, pre（先送的几格）, preLabels, cap, sad, blink }] } ----------
function gbars(g, w, h, it, t) {
  const R = begin(g, w, h, it), { q, W, H } = R; stars(q, W, H, t, it.seed ?? 13); const n = it.rows.length, rh = Math.min(120, (H - 60) / n), Y0 = (H - rh * n) / 2;
  it.rows.forEach((r, i) => { const at = T(r.at, it.t0), u = appear(t, at, .3); if (u <= 0) return; const y = Y0 + i * rh + rh / 2; q.save(); q.globalAlpha = u;
    walker(q, 80, y + 22, t + i, 3, { still: 1, sad: r.sad, tint: r.tint ? { c: r.tint } : null }); txt(q, r.name, 120, y - 22, 20, r.hl ? PAL.y : PAL.c);
    const N = r.cells || 10; let v = lerp(r.from ?? 0, r.to ?? 0, easeIO(clamp((t - at - .2) / (r.dur || 2))));
    if (r.preLabels) v = Math.max(v, r.preLabels.reduce((n_, l) => n_ + easeOut(P(t, T(l.at, at), .45)), 0) / N); cells(q, 120, y + 2, 440, 26, v, { n: N, col: PAL[r.col] || PAL.l, pre: r.pre, preCol: PAL.y });
    (r.preLabels || []).forEach((l, k) => { const la = T(l.at, at); if (t < la) return; const cw = (440 - 2 * (N - 1)) / N; q.save(); q.globalAlpha = appear(t, la); txt(q, l.text, 120 + (k + .5) * (cw + 2), y + 52, 14, PAL.y, { align: 'center' }); q.restore(); });
    const pct = Math.round(v * 100); if (!(r.blink && pct === 0 && Math.floor(t * 2) % 2)) txt(q, `${pct}%`, 580, y + 16, 24, pct ? PAL.c : PAL.r, { font: DIG });
    if (r.cap) txt(q, r.cap, 646, y + 16, 16, PAL.e); q.restore(); });
  end(R);
}

// ---------- 战争迷雾：it { path: [[at, i, j]]（格子坐标）, reveal: 1（走过的地方迷雾散开）, r（散开的半径）, quest, noMarker, grow（地图先坍缩出来）, walkDur } ----------
function gfog(g, w, h, it, t) {
  const R = begin(g, w, h, it), { q, W, H } = R, cols = Math.ceil(W / TS), rows = Math.ceil(H / TS), path = it.path.map(([a, i, j]) => [a, i, j]);
  field(q, W, H, t, { seed: it.seed ?? 61, grow: it.grow ? { at: T(it.grow), i: path[0][1], j: path[0][2], speed: 34 } : null });
  const [pi, pj, mv] = along(path, t, it.walkDur), rr_ = it.r ?? 3.2, seen = [];
  if (it.reveal) { for (let k = 0; k + 1 < path.length; k++) { if (t < T(path[k][0])) break; const [, i0, j0] = path[k], [, i1, j1] = path[k + 1], s = seg(path, k, t, it.walkDur), L = Math.max(1, Math.ceil(Math.hypot(i1 - i0, j1 - j0) * 2));
      for (let m = 0; m <= L * s; m++) seen.push([lerp(i0, i1, m / L), lerp(j0, j1, m / L)]); } }
  seen.push([pi, pj]);
  if (!it.noFog) for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { let d = 1e9; for (const [a, b] of seen) { const e = Math.hypot(i + .5 - a - .5, j + .5 - b - .5); if (e < d) d = e; }
    const rad = it.reveal ? rr_ : (it.r0 ?? 1.8); if (d < rad - .6) continue; const X = i * TS, Y = j * TS;
    if (d < rad + .4) { q.fillStyle = PAL.n; for (let y = 0; y < TS; y += 4) for (let x = 0; x < TS; x += 4) if (((x + y) / 4) % 2 === 0) q.fillRect(X + x, Y + y, 4, 4); continue; }
    const fv = vn(i / 5 + t * .15, j / 5 - t * .05, 9) * .65 + vn(i / 2.2 - t * .1, j / 2.2, 4) * .35; q.fillStyle = fv > .62 ? '#1f2647' : fv > .45 ? '#1a2040' : PAL.n; q.fillRect(X, Y, TS, TS);
    if (fv > .7) { q.fillStyle = PAL.d; q.fillRect(X + 4, Y + 6, 8, 2); } else if (hash(i * 3.1 + j * 7.3) > .86) { q.fillStyle = PAL.d; q.fillRect(X + 6, Y + 6, 2, 2); } }
  const x = pi * TS + TS / 2, y = pj * TS + TS; shadow(q, x, y + 2, 20); walker(q, x, y, t, 3, { still: !mv, sad: it.sad });
  if (it.quest) { box(q, 16, 14, 330, it.qline2 ? 98 : 72); txt(q, '主线任务', 32, 34, 14, PAL.y); txt(q, it.quest, 32, 60, 22, PAL.c);
    if (it.qline2) { const at = T(it.qline2.at, it.t0); if (t >= at) txt(q, it.qline2.text, 32, 86, 16, PAL.e, { n: typed(t, at, 18) }); } }
  if (it.noMarker && t >= T(it.noMarker)) toast(q, '没有任务点', W - 130, 46, t, T(it.noMarker), { edge: PAL.r, size: 16 });
  if (it.goal) { const [gi, gj] = it.goal, gx = gi * TS + 8, gy = gj * TS, ga = T(it.goalAt, it.t0); if (t >= ga) { spr(q, 'flag', gx, gy + 16, 3, { ax: .2, ay: 1 }); } }
  (it.tips || []).forEach((tp) => { const at = T(tp.at); if (t >= at && t < (tp.to ? T(tp.to) : 1e9)) toast(q, tp.text, tp.x ?? W / 2, tp.y ?? H - 40, t, at, { size: 18 }); });
  end(R);
}

// ---------- 时间线：it { nodes: [{ label, sub, at, stamp, hl }], row2: { text, at } } ----------
function gtimeline(g, w, h, it, t) {
  const R = begin(g, w, h, it), { q, W, H } = R; stars(q, W, H, t, it.seed ?? 17); const n = it.nodes.length, X0 = 90, X1 = W - 90, y = H * .42;
  q.fillStyle = PAL.a; q.fillRect(X0, y - 3, X1 - X0, 6); let last = -1; it.nodes.forEach((nd, i) => { if (t >= T(nd.at, it.t0)) last = i; });
  if (last >= 0) { const xs = (i) => lerp(X0, X1, i / (n - 1)), u = clamp((t - T(it.nodes[last].at, it.t0)) / .5), xl = last > 0 ? lerp(xs(last - 1), xs(last), easeOut(u)) : xs(0); q.fillStyle = PAL.y; q.fillRect(X0, y - 3, xl - X0, 6); walker(q, xl, y - 8, t, 3, { still: u >= 1 }); }
  it.nodes.forEach((nd, i) => { const x = lerp(X0, X1, i / (n - 1)), at = T(nd.at, it.t0), u = pop(t, at); if (u <= 0) return; q.save(); q.translate(Math.round(x), Math.round(y)); q.scale(u, u);
    q.fillStyle = nd.hl ? PAL.y : PAL.c; q.fillRect(-8, -8, 16, 16); q.fillStyle = PAL.k; q.fillRect(-4, -4, 8, 8); q.restore();
    q.save(); q.globalAlpha = clamp(u); txt(q, nd.label, x, y + 46, 22, nd.hl ? PAL.y : PAL.c, { align: 'center', font: DIG }); if (nd.sub) txt(q, nd.sub, x, y + 76, 16, PAL.e, { align: 'center' }); q.restore();
    if (nd.stamp && t >= at + .25) { const m = pop(t, at + .25, .3); q.save(); q.translate(x, y - 96); q.rotate(-.12); q.scale(m, m); q.strokeStyle = PAL.r; q.lineWidth = 3; q.strokeRect(-46, -20, 92, 40); txt(q, nd.stamp, 0, 0, 22, PAL.r, { align: 'center', sh: false }); q.restore(); } });
  if (it.row2 && t >= T(it.row2.at)) { const u = appear(t, T(it.row2.at)); q.save(); q.globalAlpha = u; box(q, W / 2 - 300, H - 86, 600, 64, { edge: PAL.r }); txt(q, it.row2.text, W / 2, H - 54, 22, PAL.c, { align: 'center' }); q.restore(); }
  end(R);
}

// ---------- 一排心（自愿）：it { label, n, keys: [[at, 剩几颗]], cap: [{ text, at }] } ----------
function gmeter(g, w, h, it, t) {
  const R = begin(g, w, h, it), { q, W, H } = R; stars(q, W, H, t, it.seed ?? 19); const n = it.n || 5, keys = it.keys.map(([a, v]) => [T(a), v]);
  let v = keys[0][1]; for (let i = 0; i + 1 < keys.length; i++) if (t >= keys[i][0]) v = lerp(keys[i][1], keys[i + 1][1], clamp((t - keys[i][0]) / Math.max(.01, keys[i + 1][0] - keys[i][0]))); if (t >= keys.at(-1)[0]) v = keys.at(-1)[1];
  txt(q, it.label || '自愿', W / 2, H * .26, 30, PAL.y, { align: 'center' }); const sc = 8, hw = sprW('heart', sc) + 18, X0 = W / 2 - (n * hw - 18) / 2;
  for (let i = 0; i < n; i++) { const f = clamp(v - i), x = X0 + i * hw, y = H * .4; spr(q, 'heartE', x, y, sc); if (f > 0) { const c = sprC('heart'); q.drawImage(c, 0, 0, Math.ceil(c.width * f), c.height, Math.round(x), Math.round(y), Math.round(c.width * f * sc), c.height * sc); } }
  (it.cap || []).forEach((c, i) => { const at = T(c.at, it.t0); if (t < at) return; txt(q, c.text, W / 2, H * .72 + i * 36, 22, c.hl ? PAL.y : PAL.c, { align: 'center', n: typed(t, at, 20) }); });
  end(R);
}

// ---------- 集章卡：it { cards: [{ name, n, pre, at }], stampAt: [时刻…]（两张同时各盖一个）, res: { at, a, b }, note } ----------
function gstamp(g, w, h, it, t) {
  const R = begin(g, w, h, it), { q, W, H } = R; stars(q, W, H, t, it.seed ?? 23); const y0s = 20, sts = (it.stampAt || []).map((x) => T(x)), got = sts.filter((x) => t >= x).length;
  it.cards.forEach((cd, ci) => { const at = T(cd.at, it.t0), u = appear(t, at, .35); if (u <= 0) return; const cx = ci ? W * .75 : W * .25, cw = 330, chh = 172, x0 = cx - cw / 2, y0 = 20;
    q.save(); q.globalAlpha = u; box(q, x0, y0, cw, chh, { bg: 'rgba(244,234,216,.95)', edge: PAL.m, edge2: PAL.t }); txt(q, cd.name, cx, y0 + 26, 18, PAL.k, { align: 'center', sh: false });
    const per = 5, rows_ = Math.ceil(cd.n / per), sz = 46, gx = cx - (per * (sz + 10) - 10) / 2;
    for (let k = 0; k < cd.n; k++) { const X = gx + (k % per) * (sz + 10), Y = y0 + 46 + Math.floor(k / per) * (sz + 10); q.fillStyle = PAL.t; q.fillRect(X, Y, sz, sz); q.fillStyle = '#efe2c8'; q.fillRect(X + 2, Y + 2, sz - 4, sz - 4);
      const pre = cd.pre && k < cd.pre, preAt = T(cd.preAt, at), stamped = pre ? t >= preAt : k - (cd.pre || 0) < got && k >= (cd.pre || 0);
      if (stamped) { const sa = pre ? preAt + k * .2 : sts[k - (cd.pre || 0)], m = pop(t, sa, .25); q.save(); q.translate(X + sz / 2, Y + sz / 2); q.scale(m, m); q.rotate(-.2 + hash(k + ci * 10) * .4); q.fillStyle = pre ? PAL.y : PAL.r; q.fillRect(-16, -16, 32, 32); q.fillStyle = '#efe2c8'; q.fillRect(-10, -10, 20, 20); q.fillStyle = pre ? PAL.y : PAL.r; q.fillRect(-6, -6, 12, 12); q.restore(); } }
    if (cd.pre && t >= T(cd.preAt, at)) txt(q, '送你两个章', cx, y0 + chh + 20, 16, PAL.y, { align: 'center' });
    if (it.res && t >= T(it.res.at)) { const v = ci ? it.res.b : it.res.a, ra = ci ? T(it.res.bAt ?? it.res.at) : T(it.res.at); if (t < ra) { q.restore(); return; } const k_ = 0, k = easeOut(P(t, ra, .9)); txt(q, `${Math.round(v * k)}%`, cx, H - 76, 56, ci ? PAL.y : PAL.c, { align: 'center', font: DIG }); txt(q, '的人集满', cx, H - 30, 18, PAL.e, { align: 'center' }); }
    q.restore(); });
  if (it.same && t >= T(it.same)) txt(q, '要洗的次数：一样多', W / 2, y0s + 172 + 52, 20, PAL.c, { align: 'center', n: typed(t, T(it.same), 18) });
  if (it.note) txt(q, it.note, W - 20, H - 10, 13, PAL.e, { align: 'right', sh: false });
  end(R);
}

// ---------- 高尔夫（休茨的例子）：it { hand（先演「直接拿手放进去」）, club（拿杆子一杆杆敲）, no（障碍没必要）, joy（心甘情愿）, fun（乐在其中） } ----------
// 不用老教学片（1931 年的片子 2027 年才进公有领域），自己画。
function ggolf(g, w, h, it, t) {
  const R = begin(g, w, h, it), { q, W, H } = R, fy = Math.round(H * .74), hx = 700;
  field(q, W, H, t, { seed: it.seed ?? 71, clear: (i, j) => j >= Math.floor(fy / TS) - 7 && j <= Math.floor(fy / TS) + 3 });
  q.fillStyle = 'rgba(13,15,26,.35)'; q.fillRect(0, 0, W, fy - 110); q.fillStyle = 'rgba(98,196,108,.35)'; q.fillRect(0, fy - 40, W, 58);                                     // 球道颜色浅一点
  q.fillStyle = PAL.l; q.fillRect(hx - 60, fy - 14, 120, 24); q.fillStyle = PAL.k; q.fillRect(hx - 7, fy - 3, 14, 6);   // 果岭和洞
  spr(q, 'flag', hx + 2, fy - 2, 4, { ax: 0, ay: 1 });
  const ha = T(it.hand, it.t0), ca = T(it.club), na = T(it.no), ja = T(it.joy), fa = T(it.fun);
  const ball = (x, y, sh = 1) => { if (sh) { q.fillStyle = 'rgba(0,0,0,.35)'; q.fillRect(Math.round(x - 4), fy, 8, 2); } q.fillStyle = PAL.w; q.fillRect(Math.round(x - 3), Math.round(y - 6), 6, 6); q.fillStyle = PAL.e; q.fillRect(Math.round(x + 1), Math.round(y - 2), 2, 2); };
  const club = (x, y, a) => { q.fillStyle = PAL.c; for (let k = 0; k < 16; k++) q.fillRect(Math.round(x + Math.sin(a) * k * 2), Math.round(y + Math.cos(a) * k * 2), 3, 3);
    q.fillStyle = PAL.e; q.fillRect(Math.round(x + Math.sin(a) * 32) - 2, Math.round(y + Math.cos(a) * 32) - 1, 9, 4); };
  if (t < ca) {                                                                                          // 第一遍：拿着球直接走过去放进洞
    const u = clamp((t - ha) / 2.0), kx = lerp(150, hx - 22, easeIO(u)), mv = u > 0 && u < 1;
    shadow(q, kx, fy + 2, 30); walker(q, kx, fy, t, 4, { still: !mv });
    const drop = ha + 2.15; if (t < drop) ball(kx + 2, fy - 62 + (mv ? (Math.floor(t * 6) % 2) * -4 : 0), 0); else if (t < drop + .25) ball(lerp(kx + 2, hx, (t - drop) / .25), lerp(fy - 62, fy, (t - drop) / .25), 0);
    if (t >= ha) txt(q, '最快的办法', 40, 40, 18, PAL.y, { n: typed(t, ha, 16) });
    if (t >= drop + .35) { const m = pop(t, drop + .35, .3); q.save(); q.translate(W / 2, H * .36); q.rotate(-.1); q.scale(m, m); q.strokeStyle = PAL.r; q.lineWidth = 4; q.strokeRect(-130, -34, 260, 68);
      txt(q, '犯规：这不叫高尔夫', 0, 0, 24, PAL.r, { align: 'center', sh: false }); q.restore(); }
    end(R); return;
  }
  const S = [ca + .45, ca + 1.6, ca + 2.75], BX = [126, 400, 612, hx], fl = [.75, .7, .75], ar = [70, 44, 0];
  let k = 0; while (k < 3 && t >= S[k]) k++;                                                             // 已经打了几杆
  let bx = BX[k], by = fy; if (k > 0) { const s = S[k - 1], u = clamp((t - s) / fl[k - 1]); bx = lerp(BX[k - 1], BX[k], k === 3 ? easeOut(u) : u); by = fy - Math.sin(u * Math.PI) * ar[k - 1]; }
  const walkTo = (i) => BX[i] - 30; let kx = walkTo(0), mv = false;
  for (let i = 0; i < 3; i++) { if (t >= S[i] + fl[i] && (i === 2 || t < S[i + 1] - .15)) { if (i === 2) { kx = walkTo(2); break; } const u = clamp((t - S[i] - fl[i]) / Math.max(.1, S[i + 1] - .15 - S[i] - fl[i])); kx = lerp(walkTo(i), walkTo(i + 1), easeIO(u)); mv = u > 0 && u < 1; break; }
    if (t < S[i] + fl[i]) { kx = walkTo(i); break; } }
  const cheer = t >= fa ? Math.abs(Math.sin((t - fa) * 7)) * 10 : 0;
  shadow(q, kx, fy + 2, 30); walker(q, kx, fy - cheer, t, 4, { still: !mv });
  let a = .45; const sw = k < 3 ? S[k] : null, last = k > 0 ? S[k - 1] : null;                                // 杆子：上杆、下杆、收杆
  if (sw !== null && t > sw - .4) a = lerp(.45, -1.5, easeOut(clamp((t - (sw - .4)) / .4)));
  if (last !== null && t - last < .5) a = t - last < .1 ? lerp(-1.5, 1.9, (t - last) / .1) : lerp(1.9, .45, easeIO(clamp((t - last - .1) / .4)));
  club(kx + 14, fy - 22 - cheer, a);
  const inHole = k === 3 && t >= S[2] + fl[2]; if (!inHole) ball(bx, by);
  for (let i = 0; i < 3; i++) if (t >= S[i]) floater(q, i === 2 ? '嗒' : '啪', BX[i], fy - 40, t, S[i], PAL.c, 18);
  box(q, 16, 14, 250, 70); txt(q, '第 1 洞 · 标准杆 3', 32, 34, 14, PAL.y); txt(q, k ? `第 ${k} 杆` : '还没开打', 32, 60, 22, PAL.c);
  const left = [380, 120, 8, 0][k]; if (!inHole) txt(q, `${left} m`, hx + 22, fy - 76, 16, PAL.y, { align: 'center' });
  if (inHole) { floater(q, '进了！', hx, fy - 46, t, S[2] + fl[2], PAL.y, 26); if (t > S[2] + fl[2] + .9) txt(q, '进洞', hx + 22, fy - 76, 16, PAL.y, { align: 'center' }); }
  if (t >= na && t < ja) toast(q, '这个障碍：完全没必要', W / 2 + 70, 52, t, na, { edge: PAL.r, size: 20 });
  if (t >= ja) { toast(q, fa && t >= fa ? '心甘情愿，还乐在其中' : '心甘情愿', W / 2 + 70, 52, t, t >= fa ? fa : ja, { size: 22 });
    for (let i = 0; i < 5; i++) { const s = ja + i * .35, u = P(t, s, 1.4); if (u > 0 && u < 1) { q.save(); q.globalAlpha = 1 - u; spr(q, 'heart', kx - 20 + i * 10 + Math.sin(u * 6 + i) * 6, fy - 50 - u * 70, 2, { ax: .5, ay: .5 }); q.restore(); } } }
  end(R);
}

export const KINDS3 = { gtitle, gstat, gsave, gsearch, glevels, ghud, gflow, gcheck, gdialog, gload, gcar, gboss, gbars, gfog, gtimeline, gmeter, gstamp, ggolf };
