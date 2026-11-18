// 显示器里的画面。每一种内容是一个函数：(g, w, h, it, t) → 画在 3200×1800 的屏幕画布上（设计稿按 1600×900 写，统一乘 s）。
// it 是导演表里的一条：{ kind, t0, t1, ... }，t 是全片时间。图片和视频帧要先 need() 再画。
// 图的地址可以是 media/ 下的文件，也可以是 'gen:print/3' 这样的程序占位图（gen.js）。
import { screenAt, drawTerm } from './term.js';
import { genImage } from './gen.js';
import { clamp, ease, easeOut, lerp, P, hash } from './kit.js';

export const C = { bg: '#121316', panel: '#1b1d22', panel2: '#23262d', line: '#2e323b', text: '#eceae4', dim: '#8d9099', gold: '#e9b65c', red: '#ef6a5b', green: '#7ad39b', blue: '#79b3ff' };
export const SANS = '-apple-system, "PingFang SC", "Helvetica Neue", sans-serif', MONO = 'Menlo, "SF Mono", "PingFang SC", monospace', NUM = '"DIN Alternate", "Helvetica Neue", "PingFang SC", sans-serif';

// ---------- 图片缓存：prepare 阶段 await，画的时候同步取 ----------
const cache = new Map();
export function need(src) {
  if (!src) return null; let e = cache.get(src);
  if (!e && src.startsWith('gen:')) { e = { im: genImage(src.slice(4)), ok: true, p: Promise.resolve() }; cache.set(src, e); }
  if (!e) { const im = new Image(); im.src = src; e = { im, p: im.decode().then(() => e.ok = true).catch(() => { console.warn('图片没找到，这一处先空着：', src); }) }; cache.set(src, e); }
  return e.p;
}
export const img = (src) => { const e = cache.get(src); return e && e.ok ? e.im : null; };
export function forget(keep) { for (const k of cache.keys()) if (!keep.has(k) && /\/f\d+\.jpg$/.test(k)) cache.delete(k); }   // 视频帧用完就丢

const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
function cover(g, im, x, y, w, h, zoom = 1, fx = .5, fy = .5) {           // 铺满 (x,y,w,h)，按 fx,fy 对准，zoom>1 放大
  const s = Math.max(w / im.width, h / im.height) * zoom, iw = im.width * s, ih = im.height * s;
  g.drawImage(im, x + (w - iw) * fx, y + (h - ih) * fy, iw, ih); return [x + (w - iw) * fx, y + (h - ih) * fy, iw, ih];   // 图在画布上的位置：特效按图里的比例坐标找地方
}
function contain(g, im, x, y, w, h) { const s = Math.min(w / im.width, h / im.height), iw = im.width * s, ih = im.height * s; g.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); return [x + (w - iw) / 2, y + (h - ih) / 2, iw, ih]; }

// ---------- 窗口外壳：标题栏 + 内容区 ----------
// 大标题（屏幕上不能只有图和代码，要让人一眼知道在讲什么）：film 在画每一层之前 setHead，chrome 在标题栏下面画一条大字，内容区相应下移
let HEAD = null; export const setHead = (x) => { HEAD = x; };
function head(g, w, s) {
  const H = HEAD, list = typeof H.head === 'string' ? [[H.t0, H.head]] : H.head.map(([a, x]) => [TX0(a), x]); let k = 0; list.forEach(([a], i) => { if (H.t >= a) k = i; });
  const [ta, text] = list[k], prev = k > 0 ? list[k - 1][1] : null, u = easeOut(P(H.t, ta, .45));
  g.fillStyle = '#17181c'; g.fillRect(0, 46 * s, w, 104 * s); g.fillStyle = 'rgba(233,182,92,.9)'; g.fillRect(40 * s, 72 * s, 7 * s, 52 * s);
  g.textBaseline = 'middle'; g.font = `800 ${44 * s}px ${SANS}`;
  if (prev && u < 1) { g.save(); g.globalAlpha = 1 - u; g.fillStyle = C.text; g.fillText(prev, 70 * s, 98 * s - u * 20 * s); g.restore(); }
  let x = 70 * s; [...text].forEach((c, i) => { const q = easeOut(P(H.t, ta + .1 + i * .025, .3)); g.save(); g.globalAlpha = q; g.fillStyle = C.text; g.fillText(c, x, 98 * s + (1 - q) * 14 * s); g.restore(); x += g.measureText(c).width; });
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(0, 150 * s); g.lineTo(w, 150 * s); g.stroke();
}
let NOBAR = false; export const setNoBar = (v) => { NOBAR = !!v; };                      // 悬浮段那块照片拼成的板：不画窗口条（没有红黄绿三个点），底色用照片背面的黑卡纸
export function chrome(g, w, h, title, sub) {
  const s = w / 1600;
  if (NOBAR) { if (HEAD?.head) { head(g, w, s); return { x: 0, y: 150 * s, w, h: h - 150 * s, s }; } return { x: 0, y: 0, w, h, s }; }
  g.fillStyle = C.bg; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1a1b1f'; g.fillRect(0, 0, w, 46 * s);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc((26 + i * 22) * s, 23 * s, 7 * s, 0, 7); g.fill(); });
  g.textBaseline = 'middle'; g.font = `600 ${17 * s}px ${SANS}`; g.fillStyle = C.dim; g.fillText(title || '', 104 * s, 24 * s);
  if (sub) { g.textAlign = 'right'; g.font = `500 ${15 * s}px ${SANS}`; g.fillStyle = C.gold; g.fillText(sub, w - 22 * s, 24 * s); g.textAlign = 'left'; }
  if (HEAD?.head) { head(g, w, s); return { x: 0, y: 150 * s, w, h: h - 150 * s, s }; }
  return { x: 0, y: 46 * s, w, h: h - 46 * s, s };
}

// ---------- 终端回放 ----------
// it: { cast: 数据名, map: [[全片秒, 录屏秒], …]（分段线性，可以快放）, title, sub, rows: [起, 止]（放大几行）, hl: [行号], dim: 0..1 }
export function term(g, w, h, it, t, data) {
  const d = data[it.cast]; if (!d) { const a = chrome(g, w, h, it.title || 'Claude Code', it.sub); g.font = `500 ${30 * a.s}px ${SANS}`; g.fillStyle = C.dim; g.fillText('（录屏数据没找到：' + it.cast + '）', 70 * a.s, a.y + 80 * a.s); return; }
  const m = it.map; let ct = m[0][1];
  for (let i = 0; i + 1 < m.length; i++) if (t >= m[i][0]) ct = lerp(m[i][1], m[i + 1][1], clamp((t - m[i][0]) / (m[i + 1][0] - m[i][0])));
  if (t >= m.at(-1)[0]) ct = m.at(-1)[1];
  const a = chrome(g, w, h, it.title || 'Claude Code', it.sub), rows = screenAt(d, ct), pad = 14 * a.s;
  const zr = it.rows ? (typeof it.rows === 'function' ? it.rows(t) : it.rows) : null;
  it._found = {}; drawTerm(g, rows, pad, a.y + pad * .6, w - pad * 2, a.h - pad * 1.4, d.w, { rows: zr, hl: it.hl, find: it.find, found: it._found });
  if (it.clock) { const s = a.s, x = w - 300 * s, y = h - 70 * s; g.fillStyle = 'rgba(18,19,22,.86)'; rr(g, x, y, 280 * s, 54 * s, 12 * s); g.fill();       // 录屏里的时刻：从回车算起
    const sec = Math.max(0, ct - it.clock), mm = Math.floor(sec / 60), ss = Math.floor(sec % 60); g.font = `600 ${16 * s}px ${SANS}`; g.fillStyle = C.dim; g.fillText('从回车算起', x + 18 * s, y + 27 * s);
    g.font = `700 ${28 * s}px ${NUM}`; g.fillStyle = C.gold; g.textAlign = 'right'; g.fillText(`${mm}:${String(ss).padStart(2, '0')}`, x + 262 * s, y + 28 * s); g.textAlign = 'left';
    if (it.speed) { const sp = typeof it.speed === 'function' ? it.speed(t) : it.speed; if (sp > 1.5) { g.font = `600 ${15 * s}px ${SANS}`; g.fillStyle = C.text; g.fillText(`快放 ${Math.round(sp)}×`, x + 120 * s, y + 27 * s); } } }
}

// ---------- 一张图（自检图、截图）。it: { src, title, sub, fit: 'contain'|'cover', kb: [z0, z1, fx0, fy0, fx1, fy1]（慢推）, tag, cap } ----------
export function picture(g, w, h, it, t) {
  const a = chrome(g, w, h, it.title, it.sub), im = img(it.src), s = a.s; if (!im) return;
  const pad = it.fit === 'cover' ? 0 : 18 * s, X = pad, Y = a.y + pad, Wd = w - pad * 2, Hd = a.h - pad * 2 - (it.cap ? 70 * s : 0);
  g.save(); g.beginPath(); g.rect(X, Y, Wd, Hd); g.clip(); g.fillStyle = '#0c0d0f'; g.fillRect(X, Y, Wd, Hd);
  if (it.kb) { const [z0, z1, x0, y0, x1, y1] = it.kb, u = ease(P(t, it.t0, it.t1 - it.t0)); it._map = cover(g, im, X, Y, Wd, Hd, lerp(z0, z1, u), lerp(x0, x1, u), lerp(y0, y1, u)); }
  else if (it.fit === 'cover') it._map = cover(g, im, X, Y, Wd, Hd); else it._map = contain(g, im, X, Y, Wd, Hd);
  if (it.mark) it.mark(g, X, Y, Wd, Hd, t, s);                                    // 在图上圈出要看的地方
  g.restore();
  if (it.tag) tag(g, X + 18 * s, Y + 18 * s, it.tag, s, it.tagColor);
  if (it.cap) { g.font = `500 ${24 * s}px ${SANS}`; g.fillStyle = C.text; g.textBaseline = 'middle'; g.fillText(it.cap, 26 * s, h - 40 * s); }
}
export function tag(g, x, y, text, s, col = C.gold) {
  g.font = `700 ${20 * s}px ${SANS}`; const tw = g.measureText(text).width + 30 * s;
  g.fillStyle = 'rgba(12,13,15,.82)'; rr(g, x, y, tw, 40 * s, 20 * s); g.fill(); g.fillStyle = col; g.textBaseline = 'middle'; g.fillText(text, x + 15 * s, y + 21 * s);
}

// ---------- 视频帧：it: { dir, fps, n, start（全片秒，第 0 帧）, loop, title, sub, tag } ----------
export const frameSrc = (it, t) => { let k = Math.floor((t - TX0(it.start ?? it.t0)) * it.fps + 1e-6); k = it.loop ? ((k % it.n) + it.n) % it.n : clamp(k, 0, it.n - 1); return `${it.dir}/f${String(k).padStart(4, '0')}.jpg`; };
let TX0 = (x) => x; export const setTX = (f) => { TX0 = f; };
export function video(g, w, h, it, t) {
  const a = chrome(g, w, h, it.title, it.sub), im = img(frameSrc(it, t)), s = a.s; if (!im) return;
  g.fillStyle = '#000'; g.fillRect(0, a.y, w, a.h); it._map = contain(g, im, 0, a.y, w, a.h);
  if (it.tag) tag(g, 18 * s, a.y + 18 * s, it.tag, s, it.tagColor);
}

// ---------- 两张图并排对比。it: { a: {src, tag}, b: {src, tag}, title } ----------
export function versus(g, w, h, it, t) {
  const A = chrome(g, w, h, it.title, it.sub), s = A.s, gap = 16 * s, cw = (w - gap * 3) / 2, chh = A.h - gap * 2;
  [it.a, it.b].forEach((q, i) => { const x = gap + i * (cw + gap), y = A.y + gap, im = img(q.src), u = easeOut(P(t, it.t0 + i * .35, .5));
    g.save(); g.globalAlpha = u; g.fillStyle = '#0c0d0f'; g.fillRect(x, y, cw, chh); if (im) { g.save(); g.beginPath(); g.rect(x, y, cw, chh); g.clip(); (it._maps ||= [])[i] = cover(g, im, x, y, cw, chh, q.zoom || 1, q.fx ?? .5, q.fy ?? .5); g.restore(); }
    if (q.tag) tag(g, x + 16 * s, y + 16 * s, q.tag, s, q.col); if (q.cap) { g.fillStyle = 'rgba(12,13,15,.8)'; g.fillRect(x, y + chh - 64 * s, cw, 64 * s); g.font = `500 ${22 * s}px ${SANS}`; g.fillStyle = C.text; g.fillText(q.cap, x + 18 * s, y + chh - 32 * s); }
    g.restore(); });
}

// ---------- 数字卡：it: { title, rows: [{ k: 名字, a: 第一版, b: 第二版, c: 第三列, at: 出现时刻（TX） }], head: [列名…], note } ----------
export function table(g, w, h, it, t) {
  const A = chrome(g, w, h, it.title, it.sub), s = A.s, X = 70 * s, cols = it.cols.length, cw = it.cw || [520, ...Array(cols - 1).fill((1460 - 520) / (cols - 1))];
  let y = A.y + 70 * s; g.textBaseline = 'middle';
  g.font = `600 ${22 * s}px ${SANS}`; g.fillStyle = C.dim; let x = X; it.cols.forEach((c, i) => { g.textAlign = i ? 'right' : 'left'; g.fillText(c, i ? x + cw[i] * s - 20 * s : x, y); x += cw[i] * s; }); g.textAlign = 'left';
  y += 40 * s; g.fillStyle = C.line; g.fillRect(X, y, 1460 * s, 2 * s); y += 20 * s;
  const rh = it.rh || 112;
  it.rows.forEach((r) => { const u = easeOut(P(t, TX0(r.at ?? it.t0), .45)); if (u <= 0) { y += rh * s; return; }
    g.save(); g.globalAlpha = u; g.translate(0, (1 - u) * 20 * s); let x = X;
    if (r.hl) { g.fillStyle = 'rgba(233,182,92,.08)'; rr(g, X - 20 * s, y, 1500 * s, (rh - 12) * s, 14 * s); g.fill(); }
    const u2 = r.at2 !== undefined ? easeOut(P(t, TX0(r.at2), .45)) : 1;            // at2：最后一列晚一点出现（先摆旧毛病，再一条条换成新规矩），出现时把旧的划掉
    r.v.forEach((v, i) => { g.textAlign = i ? 'right' : 'left'; const big = i > 0, last = i === cols - 1, old = r.at2 !== undefined && i === cols - 2;
      if (last && u2 <= 0) { x += cw[i] * s; return; }
      g.save(); if (last) { g.globalAlpha *= u2; g.translate((1 - u2) * 30 * s, 0); }
      g.font = big ? `700 ${(r.big || 46) * s}px ${NUM}` : `600 ${30 * s}px ${SANS}`; g.fillStyle = big ? (r.col?.[i] || (last ? C.gold : C.text)) : C.text; if (old && u2 > 0) g.fillStyle = `rgba(236,233,226,${1 - .55 * u2})`;
      const tx = i ? x + cw[i] * s - 20 * s : x, ty = y + (rh - 12) * s / 2; g.fillText(v, tx, ty);
      if (old && u2 > 0) { const tw = g.measureText(v).width; g.strokeStyle = 'rgba(239,106,91,.9)'; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(tx - tw - 6 * s, ty); g.lineTo(tx - tw - 6 * s + (tw + 12 * s) * u2, ty); g.stroke(); }
      g.restore(); x += cw[i] * s; });
    if (r.src) { g.textAlign = 'left'; g.font = `500 ${17 * s}px ${SANS}`; g.fillStyle = C.dim; g.fillText(r.src, X, y + (rh - 12) * s - 4 * s); }
    g.restore(); y += rh * s; }); g.textAlign = 'left';
  if (it.note) { g.font = `500 ${20 * s}px ${SANS}`; g.fillStyle = C.dim; g.fillText(it.note, X, h - 46 * s); }
}

// ---------- 清单：一条一条亮起来。it: { title, items: [{ text, sub, at, hl, strike, fix }], big, subSize, num, lhead, center }
// hl：这个时刻荧光笔从左往右扫过这一条；strike：这个时刻划掉；fix：划掉以后跟在后面出现的新写法（金色）
// center: 1 整块清单在画面里横向居中（悬浮段的板上用：不然字只占左边三分之一，右边一大片空着）；subSize 小字字号（默认 22） ----------
export function list(g, w, h, it, t) {
  const A = chrome(g, w, h, it.title, it.sub), s = A.s, n = it.items.length, gap = it.gap ?? Math.min(150, (A.h / s - 120) / n);   // 66 号：gap、top 可以自己写（悬浮板上字大、条数少的时候用）
  let X = 90 * s;
  if (it.center) { let mw = 0; for (const q of it.items) { g.font = `700 ${(it.big || 38) * s}px ${SANS}`; mw = Math.max(mw, g.measureText(q.text).width);
      if (q.sub) { g.font = `500 ${(it.subSize || 22) * s}px ${SANS}`; mw = Math.max(mw, g.measureText(q.sub).width); } }
    X = Math.max(90 * s, (w - (mw + 52 * s)) / 2); }
  let y = A.y + (it.top ?? 90) * s; g.textBaseline = 'middle';
  if (it.lhead) { g.font = `700 ${40 * s}px ${SANS}`; g.fillStyle = C.text; g.fillText(it.lhead, X, y); y += 80 * s; }
  it.items.forEach((q, i) => { const on = P(t, TX0(q.at ?? it.t0), .4), cur = i === it.items.findLastIndex((z) => t >= TX0(z.at ?? it.t0)), u = easeOut(on);
    g.save(); g.globalAlpha = .25 + .75 * u; g.translate((1 - u) * 26 * s, 0);
    g.fillStyle = cur ? C.gold : on > 0 ? C.green : '#3a3d47'; g.beginPath(); g.arc(X + 14 * s, y, 13 * s, 0, 7); g.fill();
    if (it.num) { g.fillStyle = C.bg; g.font = `800 ${16 * s}px ${NUM}`; g.textAlign = 'center'; g.fillText(String(i + 1), X + 14 * s, y + 1 * s); g.textAlign = 'left'; }
    g.font = `${cur ? 700 : 600} ${(it.big || 38) * s}px ${SANS}`; const tw = g.measureText(q.text).width, fs = (it.big || 38) * s;
    if (q.hl !== undefined) { const hu = easeOut(P(t, TX0(q.hl), .5)); if (hu > 0) { g.fillStyle = 'rgba(233,182,92,.30)'; rr(g, X + 44 * s, y - fs * .62, (tw + 16 * s) * hu, fs * 1.24, 8 * s); g.fill(); } }
    const su = q.strike !== undefined ? easeOut(P(t, TX0(q.strike), .4)) : 0;
    g.fillStyle = on > 0 ? (su > 0 ? `rgba(236,234,228,${1 - .5 * su})` : C.text) : '#5a5e6b'; g.fillText(q.text, X + 52 * s, y);
    if (su > 0) { g.strokeStyle = C.red; g.lineWidth = 5 * s; g.beginPath(); g.moveTo(X + 46 * s, y + 2 * s); g.lineTo(X + 46 * s + (tw + 14 * s) * su, y - 3 * s); g.stroke(); }
    if (q.fix && su >= 1) { const fu = easeOut(P(t, TX0(q.strike) + .4, .45)); g.save(); g.globalAlpha *= fu; g.fillStyle = C.gold; g.font = `700 ${(it.big || 38) * s}px ${SANS}`; g.fillText('→ ' + q.fix, X + 52 * s + tw + 36 * s + (1 - fu) * 24 * s, y); g.restore(); }
    if (q.sub) { const ss = it.subSize || 22; g.font = `500 ${ss * s}px ${SANS}`; g.fillStyle = C.dim; g.fillText(q.sub, X + 52 * s, y + (20 + ss) * s); }
    g.restore(); y += gap * s; });
}

// ---------- 代码：it: { title, file, lines: [[行号, 文字]], hl: {行号: 出现时刻}, note } ----------
export function code(g, w, h, it, t) {
  const A = chrome(g, w, h, it.title || it.file, it.sub), s = A.s, lh = it.lh || 46, fs = it.fs || 26; let y = A.y + 46 * s; g.textBaseline = 'middle';
  for (const [n, txt] of it.lines) {
    const hl = it.hl && n in it.hl ? easeOut(P(t, TX0(it.hl[n]), .4)) : 0;
    if (hl > 0) { g.fillStyle = `rgba(239,106,91,${.18 * hl})`; g.fillRect(0, y - lh * s / 2, w, lh * s); g.fillStyle = C.red; g.fillRect(0, y - lh * s / 2, 6 * s * hl, lh * s); }
    g.font = `400 ${fs * .8 * s}px ${MONO}`; g.fillStyle = '#5a5e6b'; g.textAlign = 'right'; g.fillText(String(n), 92 * s, y); g.textAlign = 'left';
    g.font = `400 ${fs * s}px ${MONO}`; g.fillStyle = hl > .5 ? '#fff' : '#c9ccd3'; g.fillText(txt, 120 * s, y); y += lh * s; }
  if (it.note) { const u = easeOut(P(t, TX0(it.noteAt ?? it.t0), .4)); g.globalAlpha = u; g.fillStyle = C.panel2; rr(g, 70 * s, h - 190 * s, w - 140 * s, 130 * s, 18 * s); g.fill();
    g.font = `600 ${30 * s}px ${SANS}`; g.fillStyle = C.gold; g.fillText(it.note, 104 * s, h - 125 * s); g.globalAlpha = 1; }
}

// ---------- 大字：一句话、一个数。it: { big, small, kicker, col } ----------
export function words(g, w, h, it, t) {
  const A = chrome(g, w, h, it.title, it.sub), s = A.s, u = easeOut(P(t, it.t0, .5)); g.textAlign = 'center'; g.textBaseline = 'middle';
  if (it.kicker) { g.font = `600 ${30 * s}px ${SANS}`; g.fillStyle = C.dim; g.globalAlpha = u; g.fillText(it.kicker, w / 2, h * .32); }
  g.font = `800 ${(it.size || 120) * s}px ${it.mono ? NUM : SANS}`; g.fillStyle = it.col || C.gold; g.globalAlpha = u; g.fillText(it.big, w / 2, h * .5 + (1 - u) * 20 * s);
  if (it.small) { g.font = `500 ${32 * s}px ${SANS}`; g.fillStyle = C.text; g.fillText(it.small, w / 2, h * .66); }
  g.globalAlpha = 1; g.textAlign = 'left';
}

export const KINDS = { term, picture, video, versus, table, list, code, words };
