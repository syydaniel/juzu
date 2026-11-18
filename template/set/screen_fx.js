// 显示器里的动画和特效：屏幕上不能只有字，要有会动的图解；放大镜、荧光笔、圈注、标签；小机器人可以跳进屏幕里。
// 新的画面种类（KINDS2）+ 叠在任何画面上的特效（applyFx）+ 屏幕里的小机器人（drawKaka）。都只依赖 t。
// 坐标：设计稿 1600×900（含 46 高的标题栏），乘 s 落到画布上。图上的位置用 {u, v}（图里 0..1 的比例），由画面记下的 _map 换算。
import { chrome, img, tag, C, SANS, NUM, MONO } from './screen.js';
import { clamp, ease, easeOut, easeIO, back, lerp, P, W, hash } from './kit.js';

const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
let TX0 = (x) => x; export const setTX2 = (f) => { TX0 = f; };
const T = (x, d) => TX0(x ?? d);

// 背景：慢慢流动的光斑和细网格，让屏幕不呆板
function ambient(g, w, h, t, s, hue = 38) {
  g.save(); g.globalAlpha = .55;
  for (let i = 0; i < 3; i++) { const x = w * (.2 + .6 * hash(i * 3.1)) + Math.sin(t * .23 + i * 2) * 120 * s, y = h * (.3 + .5 * hash(i * 5.7)) + Math.cos(t * .19 + i) * 80 * s, R = (380 + 120 * i) * s;
    const gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `hsla(${hue + i * 14},70%,55%,.10)`); gr.addColorStop(1, 'hsla(0,0%,0%,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  g.globalAlpha = .06; g.strokeStyle = '#fff'; g.lineWidth = 1 * s; const step = 40 * s, off = (t * 6 * s) % step;
  for (let x = -off; x < w; x += step) { g.beginPath(); g.moveTo(x, 46 * s); g.lineTo(x, h); g.stroke(); }
  for (let y = 46 * s; y < h; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.restore();
}

// 逐字出现的标题（每个字从下面浮上来、由虚到实），返回宽度
function revealText(g, text, x, y, t, t0, opt = {}) {
  const chars = [...text], dt = opt.dt ?? .045, align = opt.align || 'left'; g.textBaseline = 'middle'; g.textAlign = 'left';
  const total = chars.reduce((n, c) => n + g.measureText(c).width, 0); let px = align === 'center' ? x - total / 2 : x;
  chars.forEach((c, i) => { const u = easeOut(P(t, t0 + i * dt, .35)); g.save(); g.globalAlpha *= u; g.fillText(c, px, y + (1 - u) * (opt.rise ?? 18)); g.restore(); px += g.measureText(c).width; });
  return [align === 'center' ? x - total / 2 : x, total];
}

// ---------- 一排开关依次拨开，右边的图跟着一格格变：it: { title, items: [{ name, at }], src（逐级拼图：cols × rows 格，第 k 格是开了 k 个时的样子）, cols, rows } ----------
function switches(g, w, h, it, t) {
  const A = chrome(g, w, h, it.title, it.sub), s = A.s; ambient(g, w, h, t, s);
  const n = it.items.length, X = 70 * s, Y0 = A.y + 60 * s, gap = (A.h - 120 * s) / n;
  let on = 0;
  it.items.forEach((q, i) => { const ta = T(q.at, it.t0), u = easeIO(P(t, ta, .35)), y = Y0 + i * gap + gap / 2, vis = easeOut(P(t, it.t0 + i * .08, .4)); if (t >= ta) on = i + 1;
    g.save(); g.globalAlpha = vis; g.translate((1 - vis) * -30 * s, 0);
    const tw = 86 * s, th = 44 * s; g.fillStyle = `rgba(${lerp(60, 233, u)},${lerp(63, 182, u)},${lerp(72, 92, u)},1)`; rr(g, X, y - th / 2, tw, th, th / 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(X + th / 2 + u * (tw - th), y, th / 2 - 5 * s, 0, 7); g.fill();
    if (u > 0 && u < 1) { g.strokeStyle = `rgba(233,182,92,${1 - u})`; g.lineWidth = 3 * s; g.beginPath(); g.arc(X + tw / 2, y, (30 + u * 40) * s, 0, 7); g.stroke(); }
    g.font = `${u > .5 ? 700 : 500} ${30 * s}px ${SANS}`; g.fillStyle = u > .5 ? C.text : C.dim; g.textBaseline = 'middle'; g.fillText(q.name, X + tw + 26 * s, y);
    g.font = `600 ${18 * s}px ${NUM}`; g.fillStyle = u > .5 ? C.gold : '#4a4e58'; g.fillText(String(i + 1), X - 34 * s, y); g.restore(); });
  // 右边：画面随着开关一格格变（用逐级拼图里的格子，按打开的个数切）
  const im = img(it.src); if (!im) return;
  const PX = 720 * s, PY = A.y + 70 * s, PW = 830 * s, PH = PW * 9 / 16, cols = it.cols || 3, rows = it.rows || 3, k = Math.min(on, cols * rows - 1);
  const sw = im.width / cols, sh = im.height / rows, cx = (k % cols) * sw, cy = Math.floor(k / cols) * sh;
  g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 40 * s; g.fillStyle = '#000'; g.fillRect(PX, PY, PW, PH); g.restore();
  g.drawImage(im, cx, cy, sw, sh, PX, PY, PW, PH);
  if (it.levelsT) { const flash = 1 - P(t, T(it.items[Math.max(0, on - 1)]?.at, it.t0), .3); if (on > 0 && flash > 0) { g.fillStyle = `rgba(255,255,255,${flash * .35})`; g.fillRect(PX, PY, PW, PH); } }
  g.strokeStyle = 'rgba(233,182,92,.8)'; g.lineWidth = 3 * s; g.strokeRect(PX, PY, PW, PH);
  tag(g, PX + 16 * s, PY + 16 * s, on ? `打开 ${on} 个` : '全关', s);
}

// ---------- 几道门：一个光点沿着路走，过一道门亮一道。it: { title, gates: [{ name, sub, at }], fail: { gate, at, text }（在第几道门被打回） } ----------
function gates(g, w, h, it, t) {
  const A = chrome(g, w, h, it.title, it.sub), s = A.s; ambient(g, w, h, t, s, 200);
  const n = it.gates.length, X0 = 130 * s, X1 = w - 130 * s, Y = A.y + A.h * .48, step = (X1 - X0) / (n - 1);
  const ats = it.gates.map((q) => T(q.at, it.t0)); let k = -1; ats.forEach((a, i) => { if (t >= a) k = i; });
  // 路
  g.strokeStyle = '#2e323b'; g.lineWidth = 8 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(X0, Y); g.lineTo(X1, Y); g.stroke();
  const prog = k < 0 ? 0 : k + easeIO(P(t, ats[k], .9)) * 0, px = X0 + Math.min(n - 1, Math.max(0, k)) * step;
  const mv = k >= 0 ? easeIO(P(t, ats[k], .8)) : 0, from = X0 + Math.max(0, k - 1) * step, dotX = k <= 0 ? X0 : lerp(from, px, mv);
  g.strokeStyle = C.gold; g.beginPath(); g.moveTo(X0, Y); g.lineTo(dotX, Y); g.stroke();
  it.gates.forEach((q, i) => { const x = X0 + i * step, lit = i <= k ? easeOut(P(t, ats[i] + (i ? .6 : 0), .4)) : 0, app = back(P(t, it.t0 + i * .12, .5));
    g.save(); g.translate(x, Y); g.scale(app, app);
    g.fillStyle = lit > .5 ? 'rgba(233,182,92,.18)' : 'rgba(255,255,255,.04)'; rr(g, -70 * s, -150 * s, 140 * s, 150 * s, 70 * s); g.fill();   // 门洞
    g.strokeStyle = lit > .5 ? C.gold : '#4a4e58'; g.lineWidth = 6 * s; g.beginPath(); g.moveTo(-70 * s, 0); g.lineTo(-70 * s, -80 * s); g.arc(0, -80 * s, 70 * s, Math.PI, 0); g.lineTo(70 * s, 0); g.stroke();
    if (lit > 0) { g.strokeStyle = `rgba(233,182,92,${(1 - lit) * .8})`; g.lineWidth = 4 * s; g.beginPath(); g.arc(0, -70 * s, (80 + lit * 60) * s, 0, 7); g.stroke(); }
    g.font = `800 ${46 * s}px ${NUM}`; g.fillStyle = lit > .5 ? C.gold : '#5a5e6b'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), 0, -78 * s);
    g.font = `700 ${32 * s}px ${SANS}`; g.fillStyle = lit > .5 ? C.text : C.dim; g.fillText(q.name, 0, 60 * s);
    if (q.sub) { g.font = `500 ${20 * s}px ${SANS}`; g.fillStyle = C.dim; g.fillText(q.sub, 0, 100 * s); } g.restore(); });
  // 光点
  if (k >= 0) { const gl = g.createRadialGradient(dotX, Y, 0, dotX, Y, 40 * s); gl.addColorStop(0, 'rgba(255,230,170,1)'); gl.addColorStop(1, 'rgba(255,200,100,0)'); g.fillStyle = gl; g.beginPath(); g.arc(dotX, Y, 40 * s, 0, 7); g.fill(); }
  if (it.fail) { const fa = W(t, T(it.fail.at), T(it.fail.to ?? it.t1), .3); if (fa > 0) { const x = X0 + it.fail.gate * step; g.save(); g.globalAlpha = fa;
    g.strokeStyle = C.red; g.lineWidth = 8 * s; g.beginPath(); g.moveTo(x - 40 * s, Y - 120 * s); g.lineTo(x + 40 * s, Y - 40 * s); g.moveTo(x + 40 * s, Y - 120 * s); g.lineTo(x - 40 * s, Y - 40 * s); g.stroke();
    g.font = `700 ${28 * s}px ${SANS}`; g.fillStyle = C.red; g.textAlign = 'center'; g.fillText(it.fail.text, x, Y + 160 * s);
    // 一个红色的小球沿路弹回第一道门
    const back_ = easeIO(P(t, T(it.fail.at) + .4, 1.0)), bx = lerp(x, X0, back_), by = Y - Math.sin(back_ * Math.PI) * 120 * s; g.fillStyle = C.red; g.beginPath(); g.arc(bx, by, 14 * s, 0, 7); g.fill(); g.restore(); } }
  g.textAlign = 'left';
}

// ---------- 一个时刻 → 每个像素的颜色：左边一根时间轴在走，右边一张像素格由当时那一帧取色。it: { dir, n, fps, start, title } ----------
function pixels(g, w, h, it, t) {
  const A = chrome(g, w, h, it.title, it.sub), s = A.s; ambient(g, w, h, t, s, 25);
  const ct = (t - it.t0) * (it.rate ?? .5), k = Math.floor(ct * it.fps) % it.n, im = img(`${it.dir}/f${String(k).padStart(4, '0')}.jpg`);
  // 时间表盘
  const cx = 260 * s, cy = A.y + A.h / 2, R = 150 * s; g.strokeStyle = '#2e323b'; g.lineWidth = 14 * s; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
  const fr = (ct % (it.n / it.fps)) / (it.n / it.fps); g.strokeStyle = C.gold; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + fr * Math.PI * 2); g.stroke();
  g.font = `800 ${64 * s}px ${NUM}`; g.fillStyle = C.text; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`t = ${(fr * it.n / it.fps).toFixed(2)}`, cx, cy - 6 * s);
  g.font = `500 ${22 * s}px ${SANS}`; g.fillStyle = C.dim; g.fillText('给它一个时刻', cx, cy + 56 * s);
  // 箭头
  const ax = 470 * s, aw = easeOut(P(t, it.t0 + .4, .6)) * 120 * s; g.strokeStyle = C.gold; g.lineWidth = 6 * s; g.beginPath(); g.moveTo(ax, cy); g.lineTo(ax + aw, cy); g.stroke();
  g.beginPath(); g.moveTo(ax + aw, cy); g.lineTo(ax + aw - 18 * s, cy - 14 * s); g.moveTo(ax + aw, cy); g.lineTo(ax + aw - 18 * s, cy + 14 * s); g.stroke();
  g.font = `700 ${22 * s}px ${MONO}`; g.fillStyle = C.gold; g.fillText('f(t)', ax + 60 * s, cy - 34 * s);
  if (!im) return;
  // 像素格：由粗到细（同一帧，格子越来越小），最后是原图
  const PX = 650 * s, PY = A.y + 80 * s, PW = 880 * s, PH = PW * 9 / 16, lv = clamp((t - it.t0 - 1.2) / Math.max(1, (it.t1 - it.t0) * .8)), cells = Math.round(lerp(8, 180, Math.pow(ease(lv), 1.6)));
  const tmp = pixels.c ||= document.createElement('canvas'); tmp.width = cells; tmp.height = Math.round(cells * 9 / 16); const q = tmp.getContext('2d'); q.drawImage(im, 0, 0, tmp.width, tmp.height);
  g.save(); g.imageSmoothingEnabled = false; g.drawImage(tmp, PX, PY, PW, PH); g.restore();
  if (cells < 60) { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1 * s; for (let i = 0; i <= cells; i++) { const x = PX + PW * i / cells; g.beginPath(); g.moveTo(x, PY); g.lineTo(x, PY + PH); g.stroke(); }
    const rows = tmp.height; for (let j = 0; j <= rows; j++) { const y = PY + PH * j / rows; g.beginPath(); g.moveTo(PX, y); g.lineTo(PX + PW, y); g.stroke(); } }
  g.strokeStyle = 'rgba(233,182,92,.7)'; g.lineWidth = 3 * s; g.strokeRect(PX, PY, PW, PH);
  g.font = `600 ${22 * s}px ${SANS}`; g.fillStyle = C.dim; g.textAlign = 'left'; g.fillText(`${tmp.width} × ${tmp.height} 个像素，每一个都由 f(t) 算颜色`, PX, PY + PH + 36 * s);
}

// ---------- 胶片条：一格一格截下来，再连起来放。it: { dir, n, fps, title, count } ----------
function filmstrip(g, w, h, it, t) {
  const A = chrome(g, w, h, it.title, it.sub), s = A.s; ambient(g, w, h, t, s, 30);
  const N = it.count || 6, fw = 230 * s, fh = fw * 9 / 16, gap = 22 * s, X0 = (w - (N * fw + (N - 1) * gap)) / 2, Y = A.y + 110 * s, step = it.step || .55;
  g.fillStyle = '#0b0b0c'; g.fillRect(X0 - 30 * s, Y - 40 * s, N * fw + (N - 1) * gap + 60 * s, fh + 80 * s);
  for (let x = X0 - 20 * s; x < X0 + N * (fw + gap); x += 34 * s) { g.fillStyle = '#26282d'; rr(g, x, Y - 30 * s, 18 * s, 14 * s, 3 * s); g.fill(); rr(g, x, Y + fh + 16 * s, 18 * s, 14 * s, 3 * s); g.fill(); }
  for (let i = 0; i < N; i++) { const ta = it.t0 + .5 + i * step, u = easeOut(P(t, ta, .3)), x = X0 + i * (fw + gap), k = Math.round(i * (it.n - 1) / (N - 1)), im = img(`${it.dir}/f${String(k).padStart(4, '0')}.jpg`);
    g.fillStyle = '#16171a'; g.fillRect(x, Y, fw, fh); if (u <= 0 || !im) continue;
    g.save(); g.globalAlpha = u; g.drawImage(im, x, Y + (1 - u) * -30 * s, fw, fh); g.restore();
    const fl = 1 - P(t, ta, .25); if (fl > 0) { g.fillStyle = `rgba(255,255,255,${fl * .8})`; g.fillRect(x, Y, fw, fh); }   // 快门一闪
    g.font = `600 ${18 * s}px ${MONO}`; g.fillStyle = C.gold; g.textAlign = 'center'; g.fillText(`t=${(k / it.fps).toFixed(2)}s`, x + fw / 2, Y + fh + 60 * s); g.textAlign = 'left'; }
  // 下面：连起来播放
  const pa = easeOut(P(t, it.t0 + .5 + N * step + .3, .5)); if (pa > 0) { const k = Math.floor((t - it.t0) * it.fps) % it.n, im = img(`${it.dir}/f${String(k).padStart(4, '0')}.jpg`), PW = 520 * s, PH = PW * 9 / 16, PX = (w - PW) / 2, PY = Y + fh + 100 * s;
    g.save(); g.globalAlpha = pa; if (im) g.drawImage(im, PX, PY, PW, PH); g.strokeStyle = C.gold; g.lineWidth = 3 * s; g.strokeRect(PX, PY, PW, PH);
    g.fillStyle = 'rgba(12,13,15,.75)'; g.font = `700 ${18 * s}px ${SANS}`; rr(g, PX + 14 * s, PY + 14 * s, g.measureText(it.playLabel || '连起来').width + 60 * s, 36 * s, 18 * s); g.fill(); g.fillStyle = C.red; g.beginPath(); g.arc(PX + 34 * s, PY + 32 * s, 7 * s, 0, 7); g.fill();
    g.fillStyle = C.text; g.font = `700 ${18 * s}px ${SANS}`; g.textBaseline = 'middle'; g.fillText(it.playLabel || '连起来', PX + 50 * s, PY + 33 * s); g.restore(); }
}

// ---------- 柱状图：柱子一根根长出来，数字跟着涨。it: { title, rows: [{ k, v, label, at, hl }], max, unit, dec（小数位，整数默认 0）, note } ----------
function bars(g, w, h, it, t) {
  const A = chrome(g, w, h, it.title, it.sub), s = A.s; ambient(g, w, h, t, s, 40);
  const n = it.rows.length, X = 360 * s, X1 = w - 220 * s, Y0 = A.y + 90 * s, rh = (A.h - 200 * s) / n;
  it.rows.forEach((r, i) => { const ta = T(r.at, it.t0), u = easeIO(P(t, ta, 1.1)), y = Y0 + i * rh, vis = easeOut(P(t, ta - .1, .3)); if (vis <= 0) return;
    g.save(); g.globalAlpha = vis; g.font = `600 ${28 * s}px ${SANS}`; g.fillStyle = r.hl ? C.text : C.dim; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(r.k, X - 30 * s, y + rh * .4);
    const bw = (X1 - X) * r.v / it.max * u; const gr = g.createLinearGradient(X, 0, X + bw, 0); gr.addColorStop(0, r.hl ? '#a87a2e' : '#3a3e48'); gr.addColorStop(1, r.hl ? C.gold : '#5a5e6b');
    g.fillStyle = gr; rr(g, X, y + rh * .4 - 30 * s, Math.max(2, bw), 60 * s, 12 * s); g.fill();
    if (u > 0 && u < 1) { g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(X + bw - 4 * s, y + rh * .4 - 30 * s, 4 * s, 60 * s); }
    g.textAlign = 'left'; g.font = `800 ${40 * s}px ${NUM}`; g.fillStyle = r.hl ? C.gold : C.text; g.fillText((r.v * u).toFixed(it.dec ?? (Number.isInteger(r.v) ? 0 : 2)) + (it.unit || ''), X + bw + 20 * s, y + rh * .4);
    if (r.label) { g.font = `500 ${20 * s}px ${SANS}`; g.fillStyle = C.dim; g.fillText(r.label, X, y + rh * .4 + 52 * s); } g.restore(); });
  if (it.note) { g.font = `500 ${20 * s}px ${SANS}`; g.fillStyle = C.dim; g.textAlign = 'left'; g.fillText(it.note, 70 * s, h - 40 * s); }
}

// ---------- 章节总览：几张卡依次翻上来。it: { title, items: [{ name, at }], cap（上面一行小字）, chh（卡高）, dy } ----------
function chapters(g, w, h, it, t) {
  const A = chrome(g, w, h, it.title, it.sub), s = A.s; ambient(g, w, h, t, s, 38);
  const n = it.items.length, cw = 330 * s, chh = (it.chh || 420) * s, gap = 34 * s, X0 = (w - (n * cw + (n - 1) * gap)) / 2, Y = A.y + (it.dy !== undefined ? it.dy * s : (A.h - chh) / 2);
  g.font = `600 ${26 * s}px ${SANS}`; g.fillStyle = C.dim; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(it.cap ?? '', w / 2, A.y + 60 * s);
  it.items.forEach((q, i) => { const ta = T(q.at, it.t0 + i * .4), u = back(P(t, ta, .6)), lit = P(t, ta, .4), x = X0 + i * (cw + gap);
    g.save(); g.translate(x + cw / 2, Y + chh / 2 + (1 - easeOut(P(t, ta, .6))) * 80 * s); g.scale(1, Math.max(.01, u)); g.globalAlpha = clamp(P(t, ta, .3));
    g.fillStyle = '#1d2026'; rr(g, -cw / 2, -chh / 2, cw, chh, 22 * s); g.fill(); g.strokeStyle = lit > .5 ? C.gold : '#2e323b'; g.lineWidth = 3 * s; g.stroke();
    g.font = `800 ${120 * s}px ${NUM}`; g.fillStyle = C.gold; g.globalAlpha *= .9; g.fillText(String(i + 1).padStart(2, '0'), 0, -70 * s);
    g.globalAlpha = clamp(P(t, ta, .3)); g.font = `700 ${34 * s}px ${SANS}`; g.fillStyle = C.text;
    const lines = q.name.length > 7 ? [q.name.slice(0, Math.ceil(q.name.length / 2)), q.name.slice(Math.ceil(q.name.length / 2))] : [q.name];
    lines.forEach((l, j) => g.fillText(l, 0, 70 * s + j * 48 * s)); g.restore(); });
  g.textAlign = 'left';
}

// ---------- 引用：一句话逐字打出来，带光标。it: { title, quote, who（出处）, at } ----------
function quote(g, w, h, it, t) {
  const A = chrome(g, w, h, it.title, it.sub), s = A.s; ambient(g, w, h, t, s, 45);
  const ta = T(it.at, it.t0), chars = [...it.quote], n = Math.floor(clamp((t - ta - .3) / (it.typing || chars.length * .07)) * chars.length);
  g.font = `800 ${200 * s}px ${'"Songti SC", serif'}`; g.fillStyle = 'rgba(233,182,92,.25)'; g.textBaseline = 'top'; g.fillText('“', 90 * s, A.y + 40 * s);
  g.font = `700 ${it.size || 52}px ${SANS}`.replace(/^(\d+) (\d+)px/, (m, a, b) => `${a} ${b * s}px`); g.font = `700 ${(it.size || 52) * s}px ${SANS}`; g.fillStyle = C.text; g.textBaseline = 'middle';
  const maxW = w - 300 * s, lines = []; let cur = ''; for (const c of chars.slice(0, n)) { if (g.measureText(cur + c).width > maxW) { lines.push(cur); cur = ''; } cur += c; } lines.push(cur);
  const y0 = A.y + A.h / 2 - (lines.length - 1) * 40 * s; lines.forEach((l, i) => g.fillText(l, 150 * s, y0 + i * 80 * s));
  if (n < chars.length || Math.floor(t * 2.2) % 2) { const lw = g.measureText(lines.at(-1)).width; g.fillStyle = C.gold; g.fillRect(150 * s + lw + 6 * s, y0 + (lines.length - 1) * 80 * s - 30 * s, 5 * s, 60 * s); }
  if (it.who) { g.font = `500 ${26 * s}px ${SANS}`; g.fillStyle = C.dim; g.globalAlpha = P(t, ta + 1, .5); g.fillText('出自 ' + it.who, 150 * s, y0 + lines.length * 80 * s + 30 * s); g.globalAlpha = 1; }
}

// ---------- 大字（新版）：字一个个浮上来，下面一道金线扫过，背景在流动。it: { kicker, big, small, col, size, kSize（kicker 字号，默认 30）, sSize（small 字号，默认 32） } ----------
function bigwords(g, w, h, it, t) {
  const A = chrome(g, w, h, it.title, it.sub), s = A.s; ambient(g, w, h, t, s, it.hue ?? 38);
  if (it.kicker) { g.font = `600 ${(it.kSize || 30) * s}px ${SANS}`; g.fillStyle = C.dim; revealText(g, it.kicker, w / 2, h * .32, t, it.t0, { align: 'center', dt: .03 }); }
  g.font = `800 ${(it.size || 110) * s}px ${SANS}`; g.fillStyle = it.col || C.gold;
  const [x0, tw] = revealText(g, it.big, w / 2, h * .5, t, it.t0 + .15, { align: 'center', rise: 30 * s });
  const lu = easeIO(P(t, it.t0 + .3 + [...it.big].length * .045, .6)); g.fillStyle = C.gold; g.fillRect(x0, h * .5 + (it.size || 110) * s * .62, tw * lu, 6 * s);
  if (it.small) { g.font = `500 ${(it.sSize || 32) * s}px ${SANS}`; g.fillStyle = C.text; g.globalAlpha = P(t, it.t0 + .8, .5); g.textAlign = 'center'; g.fillText(it.small, w / 2, h * .70); g.globalAlpha = 1; g.textAlign = 'left'; }
}


// ---------- 三格并排的视频：说到哪一段，哪一格亮起来变大。it: { items: [{ dir, n, label, at }], stamp: { text, at }, allOn } ----------
function tri(g, w, h, it, t) {
  const A = chrome(g, w, h, it.title, it.sub), s = A.s; ambient(g, w, h, t, s, 30);
  const n = it.items.length, gap = 24 * s, cw = (w - gap * (n + 1)) / n, ch = cw * 9 / 16, Y = A.y + (A.h - ch) / 2 - 30 * s;
  let cur = -1; it.items.forEach((q, i) => { if (t >= T(q.at, it.t0)) cur = i; });
  it.items.forEach((q, i) => { const ta = T(q.at, it.t0), on = easeOut(P(t, ta, .5)), isCur = i === cur && !it.allOn, z = 1 + .06 * (isCur ? easeOut(P(t, ta, .5)) : 0);
    const x = gap + i * (cw + gap), k = Math.floor((t - it.t0) * 24) % q.n, im = img(`${q.dir}/f${String(k).padStart(4, '0')}.jpg`);
    g.save(); g.translate(x + cw / 2, Y + ch / 2); g.scale(z, z); g.globalAlpha = .3 + .7 * on;
    g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 30 * s; g.fillStyle = '#000'; g.fillRect(-cw / 2, -ch / 2, cw, ch); g.shadowBlur = 0;
    if (im) g.drawImage(im, -cw / 2, -ch / 2, cw, ch);
    if (on < 1) { g.fillStyle = `rgba(10,11,13,${.65 * (1 - on)})`; g.fillRect(-cw / 2, -ch / 2, cw, ch); }
    g.strokeStyle = isCur ? C.gold : 'rgba(255,255,255,.25)'; g.lineWidth = (isCur ? 5 : 2) * s; g.strokeRect(-cw / 2, -ch / 2, cw, ch);
    g.font = `700 ${30 * s}px ${SANS}`; g.fillStyle = on > .5 ? C.text : C.dim; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(q.label, 0, ch / 2 + 50 * s); g.restore(); });
  if (it.stamp) { const ta = T(it.stamp.at), u = P(t, ta, .35); if (u > 0) { const sc = 1.8 - .8 * easeOut(u); g.save(); g.globalAlpha = clamp(u * 2); g.translate(w / 2, Y + ch + 140 * s); g.rotate(-.04); g.scale(sc, sc);
    g.font = `800 ${46 * s}px ${SANS}`; const tw = g.measureText(it.stamp.text).width + 70 * s; g.strokeStyle = C.gold; g.lineWidth = 5 * s; rr(g, -tw / 2, -40 * s, tw, 80 * s, 14 * s); g.stroke();
    g.fillStyle = C.gold; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(it.stamp.text, 0, 3 * s); g.restore(); } }
  g.textAlign = 'left';
}

// ---------- 一刀划过去：先显示 a，划过的地方变成 b。it: { a, b（图的地址）, at, d（划多久）, la, lb（两边的标签） } ----------
function wipe(g, w, h, it, t) {
  const A = chrome(g, w, h, it.title, it.sub), s = A.s, ia = img(it.a), ib = img(it.b); if (!ia || !ib) return;
  const X = 18 * s, Y = A.y + 18 * s, Wd = w - 36 * s, Hd = A.h - 36 * s, u = easeIO(P(t, T(it.at, it.t0), it.d || 1.6)), cx = X + Wd * u;
  const cov = (im) => { const k = Math.max(Wd / im.width, Hd / im.height), iw = im.width * k, ih = im.height * k; g.drawImage(im, X + (Wd - iw) / 2, Y + (Hd - ih) / 2, iw, ih); return [X + (Wd - iw) / 2, Y + (Hd - ih) / 2, iw, ih]; };
  g.save(); g.beginPath(); g.rect(X, Y, Wd, Hd); g.clip(); it._map = cov(ia); g.beginPath(); g.rect(X, Y, cx - X, Hd); g.clip(); cov(ib); g.restore();
  if (u > 0 && u < 1) { g.fillStyle = '#fff'; g.fillRect(cx - 2 * s, Y, 4 * s, Hd); const gl = g.createLinearGradient(cx - 40 * s, 0, cx + 40 * s, 0); gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(.5, 'rgba(255,240,200,.35)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(cx - 40 * s, Y, 80 * s, Hd); }
  if (it.la && u < .5) tag(g, X + Wd - 260 * s, Y + 18 * s, it.la, s); if (it.lb && u > .02) tag(g, X + 18 * s, Y + 18 * s, it.lb, s);
}

// ---------- 盖章：一个大数字或一句话，说到 at 时被红线划掉，再盖一个章。it: { big, unit, cap（上面一行小字）, at, stamp（章上的字）, count（写 0 就不从 0 数上来）, size } ----------
function stamp(g, w, h, it, t) {
  const A = chrome(g, w, h, it.title, it.sub), s = A.s; ambient(g, w, h, t, s, 0);
  const ta = T(it.at, it.t0), cx = w / 2, cy = A.y + A.h * .45, num = parseFloat(it.big), isNum = /^\d+(\.\d+)?$/.test(String(it.big));
  const shown = isNum && it.count !== 0 ? (num * easeOut(P(t, it.t0, 1.2))).toFixed((String(it.big).split('.')[1] || '').length) : String(it.big);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 ${(it.size || 230) * s}px ${isNum ? NUM : SANS}`; const bw = g.measureText(shown).width, ox = it.unit ? -90 * s : 0;
  g.fillStyle = t < ta ? C.gold : '#6b6f7a'; g.fillText(shown, cx + ox, cy);
  if (it.unit) { g.font = `700 ${80 * s}px ${NUM}`; g.fillStyle = C.dim; g.textAlign = 'left'; g.fillText(it.unit, cx + ox + bw / 2 + 30 * s, cy + 50 * s); g.textAlign = 'center'; }
  if (it.cap) { g.font = `500 ${28 * s}px ${SANS}`; g.fillStyle = C.dim; g.fillText(it.cap, cx, cy - 190 * s); }
  const u = easeOut(P(t, ta, .4)), half = bw / 2 + 60 * s; if (u > 0) { g.strokeStyle = C.red; g.lineWidth = 14 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + ox - half, cy + 20 * s); g.lineTo(cx + ox - half + half * 2 * u, cy - 30 * s); g.stroke(); }
  const v = P(t, ta + .3, .3); if (v > 0 && it.stamp) { const k = 1.7 - .7 * easeOut(v); g.save(); g.globalAlpha = clamp(v * 2); g.translate(cx, cy + 230 * s); g.rotate(-.06); g.scale(k, k);
    g.font = `800 ${54 * s}px ${SANS}`; const tw = g.measureText(it.stamp).width + 80 * s; g.strokeStyle = C.red; g.lineWidth = 6 * s; rr(g, -tw / 2, -48 * s, tw, 96 * s, 14 * s); g.stroke(); g.fillStyle = C.red; g.fillText(it.stamp, 0, 4 * s); g.restore(); }
  g.textAlign = 'left';
}

export const KINDS2 = { switches, gates, pixels, filmstrip, bars, chapters, quote, bigwords, tri, wipe, stamp };

// ================= 叠在任何画面上的特效 =================
// it.fx: [{ type: 'lens'|'hl'|'ring'|'arrow'|'label', at, to, … }]。位置：{ u, v }（在图里）或 { x, y }（设计稿坐标）或 { find: '字' }（终端里第一次出现这段字的地方）
function where(it, f, s, k = '') {
  const u = f['u' + k], v = f['v' + k];
  if (f.find && it._found?.[f.find]) { const [x, y, w, h] = it._found[f.find]; return [x + w / 2, y + h / 2, w, h]; }
  if (u !== undefined) { const m = (f.side !== undefined ? it._maps?.[f.side] : it._map); if (!m) return null; return [m[0] + u * m[2], m[1] + v * m[3], (f.w || 0) * m[2], (f.h || 0) * m[3]]; }
  if (f['x' + k] !== undefined) return [f['x' + k] * s, f['y' + k] * s, (f.w || 0) * s, (f.h || 0) * s];
  return null;
}
export function applyFx(g, w, h, it, t) {
  if (!it.fx) return; const s = w / 1600;
  for (const f of it.fx) {
    const t0 = T(f.at, it.t0), t1 = f.to !== undefined ? T(f.to) : it.t1; if (t < t0 || t >= t1) continue;
    const a = W(t, t0, t1, .3), pos = where(it, f, s); if (!pos) continue; const [x, y, fw, fh] = pos;
    g.save(); g.globalAlpha = a;
    if (f.type === 'lens') {                               // 放大镜：圆里放大 z 倍，带金色镜框和手柄，从小弹出来
      const R = (f.r || 130) * s, z = f.z || 2.2, sc = back(P(t, t0, .5)), [dx, dy] = f.dx !== undefined ? [x + f.dx * s, y + f.dy * s] : [x, y];
      const src = applyFx.c ||= document.createElement('canvas'); src.width = w; src.height = h; src.getContext('2d').drawImage(g.canvas, 0, 0);
      g.translate(dx, dy); g.scale(sc, sc);
      g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 40 * s; g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill(); g.restore();
      g.save(); g.beginPath(); g.arc(0, 0, R, 0, 7); g.clip(); const sw = R * 2 / z; g.drawImage(src, x - sw / 2, y - sw / 2, sw, sw, -R, -R, R * 2, R * 2);
      const gl = g.createRadialGradient(-R * .4, -R * .5, 0, 0, 0, R); gl.addColorStop(0, 'rgba(255,255,255,.18)'); gl.addColorStop(.5, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fillRect(-R, -R, R * 2, R * 2); g.restore();
      g.strokeStyle = C.gold; g.lineWidth = 10 * s; g.beginPath(); g.arc(0, 0, R, 0, 7); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2 * s; g.beginPath(); g.arc(0, 0, R - 6 * s, 0, 7); g.stroke();
      g.rotate(.75); g.fillStyle = '#3a2a14'; rr(g, R + 2 * s, -14 * s, 110 * s, 28 * s, 14 * s); g.fill(); g.fillStyle = C.gold; g.fillRect(R - 4 * s, -16 * s, 24 * s, 32 * s);
      if (f.dx !== undefined) { g.restore(); g.save(); g.globalAlpha = a * .7; g.strokeStyle = C.gold; g.lineWidth = 2 * s; g.setLineDash([6 * s, 6 * s]); g.beginPath(); g.arc(x, y, R / z, 0, 7); g.stroke(); }
    } else if (f.type === 'hl') {                          // 荧光笔：一道半透明的金色从左往右扫过
      const u = easeIO(P(t, t0, f.d || .55)), pad = 8 * s; g.globalCompositeOperation = f.dark ? 'source-over' : 'screen'; g.fillStyle = f.col || 'rgba(233,182,92,.38)';
      rr(g, x - fw / 2 - pad, y - fh / 2 - pad * .6, (fw + pad * 2) * u, fh + pad * 1.2, 6 * s); g.fill(); g.globalCompositeOperation = 'source-over';
      g.fillStyle = C.gold; g.fillRect(x - fw / 2 - pad, y + fh / 2 + pad * .6, (fw + pad * 2) * u, 4 * s);
    } else if (f.type === 'ring') {                        // 手画的圈：一笔画出来，稍微不圆
      const u = easeOut(P(t, t0, .6)), rx = (f.rx || 120) * s, ry = (f.ry || f.rx || 120) * s; g.strokeStyle = f.col || C.red; g.lineWidth = 7 * s; g.lineCap = 'round'; g.beginPath();
      for (let i = 0; i <= 64 * u; i++) { const q = i / 64 * Math.PI * 2.15 - 1.9, wob = 1 + .04 * Math.sin(i * .7); g.lineTo(x + Math.cos(q) * rx * wob, y + Math.sin(q) * ry * wob); } g.stroke();
    } else if (f.type === 'arrow') {                       // 箭头：从 x1,y1 画到目标
      const [x1, y1] = where(it, f, s, '1') || [x - 200 * s, y - 150 * s], u = easeOut(P(t, t0, .5)), ex = lerp(x1, x, u), ey = lerp(y1, y, u), an = Math.atan2(y - y1, x - x1);
      g.strokeStyle = f.col || C.gold; g.lineWidth = 7 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo((x1 + ex) / 2 + 40 * s, (y1 + ey) / 2 - 40 * s, ex, ey); g.stroke();
      if (u > .9) { g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex - Math.cos(an - .5) * 30 * s, ey - Math.sin(an - .5) * 30 * s); g.moveTo(ex, ey); g.lineTo(ex - Math.cos(an + .5) * 30 * s, ey - Math.sin(an + .5) * 30 * s); g.stroke(); }
    } else if (f.type === 'line') {                        // 一道线沿着某个方向画过去（标出一条水平线、一道边）
      const [x1, y1] = where(it, f, s, '1') || [x - 300 * s, y], u = easeIO(P(t, t0, .8)); g.strokeStyle = f.col || C.gold; g.lineWidth = (f.lw || 6) * s; g.lineCap = 'round'; g.setLineDash(f.dash ? [16 * s, 12 * s] : []);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(lerp(x1, x, u), lerp(y1, y, u)); g.stroke(); g.setLineDash([]);
    } else if (f.type === 'dim') {                         // 尺寸线：两头带短竖线，中间写尺寸
      const [x1, y1] = where(it, f, s, '1'), u = easeIO(P(t, t0, .7)), mx = (x + x1) / 2, my = (y + y1) / 2, an = Math.atan2(y1 - y, x1 - x), nx = -Math.sin(an) * 14 * s, ny = Math.cos(an) * 14 * s;
      g.strokeStyle = f.col || C.gold; g.lineWidth = 4 * s; g.beginPath(); g.moveTo(mx - (mx - x) * u, my - (my - y) * u); g.lineTo(mx + (x1 - mx) * u, my + (y1 - my) * u); g.stroke();
      if (u > .95) { g.beginPath(); g.moveTo(x - nx, y - ny); g.lineTo(x + nx, y + ny); g.moveTo(x1 - nx, y1 - ny); g.lineTo(x1 + nx, y1 + ny); g.stroke(); }
      const q = back(P(t, t0 + .5, .4)); if (q > 0) { g.save(); g.translate(mx + (f.ox || 0) * s, my + (f.oy ?? -34) * s); g.scale(q, q); g.font = `800 ${(f.size || 32) * s}px ${NUM}`; const tw = g.measureText(f.text).width + 26 * s;
        g.fillStyle = 'rgba(12,13,15,.85)'; rr(g, -tw / 2, -24 * s, tw, 48 * s, 10 * s); g.fill(); g.fillStyle = f.col || C.gold; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f.text, 0, 2 * s); g.restore(); }
    } else if (f.type === 'label') {                       // 标签：弹出来的一块说明
      const sc = back(P(t, t0, .45)); g.translate(x, y); g.scale(sc, sc); g.font = `700 ${(f.size || 28) * s}px ${SANS}`; const tw = g.measureText(f.text).width + 44 * s, th = (f.size || 28) * s * 1.9;
      g.fillStyle = f.bg || 'rgba(233,182,92,.95)'; rr(g, -tw / 2, -th / 2, tw, th, th / 2); g.fill(); g.fillStyle = f.fg || '#17181b'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f.text, 0, 2 * s);
    }
    g.restore();
  }
}

// ================= 屏幕里的小机器人 =================
// KAKA_IN: [{ t0, t1, path: [[t, x, y, scale, flip, mood]] }]：跳进来（从屏幕下边弹进来）、走到要指的地方、跳出去
export function drawKaka(g, w, h, list, t) {
  const im = img('media/kaka.png'); if (!im) return; const s = w / 1600;
  for (const k of list) { if (t < k.t0 || t >= k.t1) continue;
    const P_ = k.path; let i = 0; while (i + 1 < P_.length && t >= T(P_[i + 1][0])) i++;
    const a = P_[i], b = P_[Math.min(i + 1, P_.length - 1)], ta = T(a[0]), tb = T(b[0]), u = b === a ? 0 : easeIO(clamp((t - ta) / Math.max(.01, Math.min(tb - ta, .8))));
    let x = lerp(a[1], b[1], u), y = lerp(a[2], b[2], u); const sc = lerp(a[3] ?? 1, b[3] ?? 1, u), flip = (u < .5 ? a[4] : b[4]) ? -1 : 1;
    const hop = Math.sin(clamp(u) * Math.PI) * (Math.abs(b[1] - a[1]) > 10 ? 60 : 0);   // 挪位置时跳着走
    const enter = back(P(t, k.t0 - .05, .5)), leave = 1 - easeIO(P(t, k.t1 - .35, .35)), bob = Math.sin(t * 3.1) * 5 + (Math.abs(Math.sin(t * 1.7)) * 3);
    const H = 260 * s * sc, Wd = H * im.width / im.height;
    const pop = enter * leave; if (pop <= .01) continue;   // 从桌上跳进来的那一刻在落点上弹出来，走的时候缩回落点
    g.save(); g.translate(x * s, (y - hop - bob * pop) * s); g.rotate(Math.sin(t * 1.3) * .04 + (u > 0 && u < 1 ? .08 * flip : 0)); g.scale(flip * pop, pop);
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 30 * s; g.shadowOffsetY = 10 * s; g.drawImage(im, -Wd / 2, -H, Wd, H); g.restore();
    if (k.say) for (const q of k.say) { const t0 = T(q.at), t1 = q.to !== undefined ? T(q.to) : t0 + 2.5; if (t < t0 || t >= t1) continue;   // 气泡
      const sc2 = back(P(t, t0, .4)) * (1 - P(t, t1 - .3, .3)); g.save(); g.translate((x + (q.dx ?? 130)) * s, (y - 300) * s); g.scale(sc2, sc2); g.font = `700 ${30 * s}px ${SANS}`; const tw = g.measureText(q.text).width + 50 * s;
      g.fillStyle = 'rgba(250,247,240,.97)'; rr(g, 0, -40 * s, tw, 80 * s, 40 * s); g.fill(); g.beginPath(); g.moveTo(20 * s, 30 * s); g.lineTo(0, 60 * s); g.lineTo(50 * s, 36 * s); g.fill();
      g.fillStyle = '#17181b'; g.textBaseline = 'middle'; g.fillText(q.text, 25 * s, 2 * s); g.restore(); }
  }
}

// 这一刻要先加载的图（film.prepare 用）
export function needsOf(s, t) {
  const fr = (k) => `${s.dir}/f${String(k).padStart(4, '0')}.jpg`, out = [];
  if (s.kind === 'switches' && s.src) out.push(s.src);
  if (s.kind === 'wipe') out.push(s.a, s.b);
  if (s.kind === 'tri') for (const q of s.items) out.push(`${q.dir}/f${String(Math.floor((t - s.t0) * 24) % q.n).padStart(4, '0')}.jpg`);
  if (s.kind === 'pixels') out.push(fr(Math.floor((t - s.t0) * (s.rate ?? .5) * s.fps) % s.n));
  if (s.kind === 'filmstrip') { const N = s.count || 6; for (let i = 0; i < N; i++) out.push(fr(Math.round(i * (s.n - 1) / (N - 1)))); out.push(fr(Math.floor((t - s.t0) * s.fps) % s.n)); }
  return out;
}
