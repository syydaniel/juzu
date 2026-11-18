// 叠在三维画面最上面的一层 2D：整屏画面（HERO）、标题、章节、进度条、磨砂信息卡、贴图、点赞评论弹幕的引导、黑场、系列标、字幕。
// 设计稿按 1920×1080 写，画的时候乘 u（4K 时 u = 2）。只依赖 t。
import { img, frameSrc } from './screen.js';
import { TL, clamp, ease, easeOut, easeIO, back, lerp, P, W, hash } from './kit.js';

const SANS = '-apple-system, "PingFang SC", "Helvetica Neue", sans-serif', SERIF = '"Songti SC", "STSong", serif', NUM = '"DIN Alternate", "Helvetica Neue", sans-serif';
const GOLD = '#e9b65c', PINK = '#fb7299';
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

export class Overlay {
  constructor(S, TX) {
    this.S = S; this.TX = TX;
    const c = this.c = document.createElement('canvas'); c.width = innerWidth; c.height = innerHeight;
    c.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:5;pointer-events:none'; document.body.appendChild(c);
    this.g = c.getContext('2d'); this.u = innerHeight / 1080;
    const tt = (L) => (L || []).map((x) => ({ ...x, t0: TX(x.t0 ?? x.at), t1: x.t1 !== undefined ? TX(x.t1) : undefined, numAt: x.numAt !== undefined ? TX(x.numAt) : undefined,
      nlab: x.nlab ? { ...x.nlab, at: TX(x.nlab.at) } : undefined, lines: Array.isArray(x.lines) ? x.lines.map((L) => (L && typeof L === 'object' && L.at !== undefined ? { ...L, at: TX(L.at) } : L)) : x.lines }));
    this.hero = tt(S.HERO); this.cta = tt(S.CTA); this.titles = tt(S.TITLES); this.fades = tt(S.FADES); this.chap = tt(S.CHAPTERS); this.glass = tt(S.GLASS); this.stick = tt(S.STICK); this.prog = S.PROGRESS ? { ...S.PROGRESS, t0: TX(S.PROGRESS.t0), t1: TX(S.PROGRESS.t1), at: S.PROGRESS.items.map((q) => TX(q.at)) } : null;
    this.subOff = (S.NOSUB || []).map(([a, b]) => [TX(a), TX(b)]);
  }
  needs(t) { return [...this.hero.filter((h) => t >= h.t0 - .01 && t < h.t1 + .01).map((h) => frameSrc(h, t)), ...this.stick.filter((x) => x.src && t >= x.t0 - .1 && t < x.t1).map((x) => x.src)]; }

  draw(t, gl) {
    const g = this.g, u = this.u; this.gl = gl; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.c.width, this.c.height); g.setTransform(u, 0, 0, u, 0, 0);
    if (new URLSearchParams(location.search).has('clean')) return;   // ?clean：只看三维画面，查片场用
    // 整屏画面（开场的实测镜头）：前后各淡 fade 秒
    for (const h of this.hero) { if (t < h.t0 || t >= h.t1) continue; const im = img(frameSrc(h, t)); if (!im) continue;
      const a = Math.min(h.fin === 0 ? 1 : P(t, h.t0, h.fin ?? .5), h.fout === 0 ? 1 : 1 - P(t, h.t1 - (h.fout ?? .5), h.fout ?? .5)); g.globalAlpha = a;
      const z = h.zoom ? lerp(h.zoom[0], h.zoom[1], (t - h.t0) / (h.t1 - h.t0)) : 1, w = 1920 * z, hh = 1080 * z; g.drawImage(im, (1920 - w) / 2, (1080 - hh) / 2, w, hh); g.globalAlpha = 1;
      if (h.label) { const la = W(t, h.t0 + .4, h.t1 - .2, .4); g.globalAlpha = la * .9; g.font = `500 22px ${SANS}`; g.fillStyle = 'rgba(255,255,255,.85)'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(h.label, 64, 1080 - 60); g.globalAlpha = 1; } }
    for (const f of this.fades) { const a = f.t1 === undefined ? 0 : (f.kind === 'in' ? 1 - P(t, f.t0, f.t1 - f.t0) : f.kind === 'out' ? P(t, f.t0, f.t1 - f.t0) : W(t, f.t0, f.t1, (f.t1 - f.t0) / 2));
      if (t >= f.t0 - 1e-3 && t <= f.t1 + (f.kind === 'out' ? 999 : 0) && a > 0) { g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(0, 0, 1920, 1080); } }
    for (const x of this.titles) if (t >= x.t0 && t < x.t1) this.title(g, x, t);
    for (const x of this.chap) if (t >= x.t0 - .2 && t < x.t0 + (x.dur || 3.4)) this.chapter(g, x, t);
    for (const x of this.glass) if (t >= x.t0 && t < x.t1) this.panel(g, x, t);
    for (const x of this.stick) if (t >= x.t0 && t < x.t1) this.sticker(g, x, t);
    if (this.prog && t >= this.prog.t0 && t < this.prog.t1) this.progress(g, t);
    for (const x of this.cta) if (t >= x.t0 && t < x.t0 + (x.dur || 5)) this[x.kind](g, x, t);
    if (!this.S.NOBADGE || !this.S.NOBADGE.some(([a, b]) => t >= this.TX(a) && t < this.TX(b))) this.badge(g, t);
    if (!this.subOff.some(([a, b]) => t >= a && t < b)) this.subs(g, t);
  }

  badge(g, t) { const s = this.S.BADGE; if (!s) return;   // 右上角的系列标：导演表里写 BADGE: '系列名 · 第 N 期'，不写就不画
    g.globalAlpha = .82; g.font = `600 19px ${SANS}`; g.textBaseline = 'middle'; g.textAlign = 'left'; const w = g.measureText(s).width + 34;
    const x0 = 1920 - 40 - w;   // 放右上角：镜头贴着显示器时，左上角是窗口标题，会撞
    g.fillStyle = 'rgba(14,15,18,.55)'; rr(g, x0, 34, w, 40, 20); g.fill(); g.fillStyle = '#f1ede4'; g.fillText(s, x0 + 17, 55); g.globalAlpha = 1; }

  subs(g, t) {
    const s = TL.subs.find((x) => t >= x.start && t < x.end); if (!s) return;
    g.font = `600 46px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.lineJoin = 'round'; g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(s.text, 960, 1080 - 72);
    g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 10; g.fillStyle = '#fbf8f1'; g.fillText(s.text, 960, 1080 - 72); g.shadowBlur = 0; g.textAlign = 'left';
  }

  title(g, x, t) {           // 居中的大标题：一行小号宋体，一行大号宋体（关键词金色），一行副标题
    const a = W(t, x.t0, x.t1, .6), e = easeOut(P(t, x.t0, 1.0)); g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (x.dim) { g.fillStyle = `rgba(0,0,0,${.45 * a})`; g.fillRect(0, 0, 1920, 1080); }
    if (x.kicker) { g.font = `500 34px ${SERIF}`; g.fillStyle = 'rgba(245,240,230,.88)'; g.fillText(x.kicker, 960, 400 - (1 - e) * 10); }
    g.font = `900 104px ${SERIF}`; const parts = x.big, total = parts.reduce((n, [s]) => n + g.measureText(s).width, 0); let px = 960 - total / 2; g.textAlign = 'left';
    for (const [s, gold] of parts) { g.fillStyle = gold ? GOLD : '#fbf8f1'; g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 24; g.fillText(s, px, 530 + (1 - e) * 16); px += g.measureText(s).width; } g.shadowBlur = 0;
    if (x.small) { g.textAlign = 'center'; g.font = `500 36px ${SANS}`; g.fillStyle = 'rgba(245,240,230,.9)'; g.fillText(x.small, 960, 650); }
    g.globalAlpha = 1; g.textAlign = 'left';
  }

  // 把三维画面在 (x, y, w, h) 里虚化、压暗，当磨砂玻璃：小机器人和背景虚掉，卡上的字才看得清
  frost(g, x, y, w, h, r, blur, dim) {
    if (!this.gl || blur <= .2) { g.fillStyle = `rgba(12,13,16,${dim})`; rr(g, x, y, w, h, r); g.fill(); return; }
    g.save(); rr(g, x, y, w, h, r); g.clip(); g.filter = `blur(${blur}px)`; g.drawImage(this.gl, -20, -20, 1960, 1120); g.filter = 'none';
    g.fillStyle = `rgba(12,13,16,${dim})`; g.fillRect(x, y, w, h); g.restore();
  }

  // 章节：整个画面虚掉、压暗，中间一个大号章节号和章节名，字一个个浮上来；约 3 秒后画面重新清楚
  chapter(g, x, t) {
    const D = x.dur || 3.4, a = Math.min(P(t, x.t0 - .2, .6), 1 - P(t, x.t0 + D - .8, .8)); if (a <= 0) return;
    this.frost(g, 0, 0, 1920, 1080, 0, 26 * a, .42 * a);
    g.save(); g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'middle';
    const e = easeOut(P(t, x.t0, .7));
    g.font = `600 30px ${SANS}`; g.fillStyle = GOLD; g.fillText(x.no, 960, 400 - (1 - e) * 14);
    g.font = `900 150px ${SERIF}`; g.fillStyle = 'rgba(233,182,92,.95)'; g.fillText(x.num || '', 960, 500 + (1 - e) * 20);
    g.font = `800 76px ${SERIF}`; const ch = [...x.name], tw = ch.reduce((n, c) => n + g.measureText(c).width, 0); let px = 960 - tw / 2; g.textAlign = 'left';
    ch.forEach((c, i) => { const q = easeOut(P(t, x.t0 + .25 + i * .05, .45)); g.globalAlpha = a * q; g.fillStyle = '#fbf8f1'; g.fillText(c, px, 640 + (1 - q) * 22); px += g.measureText(c).width; });
    g.globalAlpha = a; const lu = easeIO(P(t, x.t0 + .5, .8)); g.fillStyle = GOLD; g.fillRect(960 - tw / 2, 700, tw * lu, 4);
    g.restore(); g.textAlign = 'left';
  }

  // 顶部正中的章节进度条：每章一段，当前那段是金色、按进度填满；很淡，不抢画面
  progress(g, t) {
    const P_ = this.prog, a = Math.min(P(t, P_.t0, .8), 1 - P(t, P_.t1 - .8, .8)) * .85, n = P_.items.length, W_ = 150, gap = 10, X0 = 960 - (n * W_ + (n - 1) * gap) / 2, Y = 52;
    let k = -1; P_.at.forEach((q, i) => { if (t >= q) k = i; });
    g.save(); g.globalAlpha = a; g.textBaseline = 'middle'; g.textAlign = 'center';
    P_.items.forEach((q, i) => { const x = X0 + i * (W_ + gap), end = P_.at[i + 1] ?? P_.t1, f = i < k ? 1 : i === k ? clamp((t - P_.at[i]) / (end - P_.at[i])) : 0;
      g.fillStyle = 'rgba(14,15,18,.55)'; rr(g, x, Y - 4, W_, 8, 4); g.fill(); g.fillStyle = i === k ? GOLD : 'rgba(241,237,228,.55)'; if (f > 0) { rr(g, x, Y - 4, W_ * f, 8, 4); g.fill(); }
      g.font = `${i === k ? 700 : 500} 22px ${SANS}`; g.fillStyle = i === k ? '#fbf8f1' : 'rgba(241,237,228,.6)'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 6; g.fillText(q.name, x + W_ / 2, Y - 24); g.shadowBlur = 0; });
    g.restore(); g.textAlign = 'left';
  }

  // 磨砂卡的大小按字量出来：宽 = 最长那行 + 两边留白，高 = 最后一行 + 底边留白。手写的宽高一改字就对不上（框比字大一圈，或者字跑出框）。
  // x.minW 最小宽度（默认 300）；x.fit === false 才用写死的 x.w、x.h
  fitBox(g, x) {
    if (x._fit) return x._fit; if (x.fit === false) return (x._fit = [x.w, x.h]);
    let y = 70, R = 0, B = 0; const m = (f, s) => { g.font = f; return g.measureText(s).width; };
    if (x.kicker) { R = Math.max(R, 34 + m(`600 26px ${SANS}`, x.kicker)); B = y + 14; y += 56; }
    if (x.nlab) { R = Math.max(R, 54 + m(`500 28px ${SANS}`, x.nlab.text)); B = y + 16; y += 40; }
    if (x.num) { g.font = `800 120px ${NUM}`; const nw = g.measureText(x.num).width; R = Math.max(R, 44 + nw + (x.unit ? m(`700 40px ${SANS}`, x.unit) : 0)); B = y + 90; y += 130; }
    if (x.title) { const ts = x.tsize || 54; R = Math.max(R, 34 + m(`800 ${ts}px ${SERIF}`, x.title)); B = y + ts * .55; y += ts * 1.35; }
    for (const L of x.lines || []) { R = Math.max(R, 36 + m(`${L.hl ? 700 : 600} ${L.size || 36}px ${SANS}`, L.text) + (L.hl ? 8 : 0)); B = y + 24;
      if (L.sub) { R = Math.max(R, 36 + m(`500 24px ${SANS}`, L.sub)); B = y + 54; y += 30; } y += 62; }
    return (x._fit = [Math.max(x.minW || 300, Math.ceil(R + 44)), Math.ceil(B + 36)]);
  }
  // 磨砂信息卡：镜头离开屏幕的时候，重点写在这张卡上。x: { x, y, w, h（1920 设计稿）, kicker, title, tsize, lines: [{ text, at, hl, sub, size }], num, unit, numAt, nlab, blur, fit, minW, anchor }
  // 宽高按字自动量（fitBox），x、y 是左上角；anchor: 'bottom' 时底边钉在 y + h，卡往上长，靠下的卡用它，字多了也不压字幕
  panel(g, x, t) {
    const [Wd, H] = this.fitBox(g, x), a = Math.min(P(t, x.t0, .5), 1 - P(t, x.t1 - .45, .45)), e = easeOut(P(t, x.t0, .6)), X = x.x + (1 - e) * (x.from === 'left' ? -40 : 40), Y = x.anchor === 'bottom' ? x.y + x.h - H : x.y;
    if (a <= 0) return; g.save(); g.globalAlpha = a;
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 40; g.fillStyle = 'rgba(0,0,0,.01)'; rr(g, X, Y, Wd, H, 26); g.fill(); g.shadowBlur = 0;
    this.frost(g, X, Y, Wd, H, 26, (x.blur ?? 22), .5);
    g.strokeStyle = 'rgba(233,182,92,.55)'; g.lineWidth = 2; rr(g, X, Y, Wd, H, 26); g.stroke();
    g.fillStyle = GOLD; g.fillRect(X + 34, Y + 34, 44 * easeOut(P(t, x.t0 + .2, .5)), 4);
    let y = Y + 70; g.textBaseline = 'middle'; g.textAlign = 'left';
    if (x.kicker) { g.font = `600 26px ${SANS}`; g.fillStyle = GOLD; g.fillText(x.kicker, X + 34, y); y += 56; }
    if (x.nlab) { const q = easeOut(P(t, x.nlab.at, .45)); if (q > 0) { g.globalAlpha = a * q; g.font = `500 28px ${SANS}`; g.fillStyle = 'rgba(241,237,228,.8)'; g.fillText(x.nlab.text, X + 36 + (1 - q) * 18, y); g.globalAlpha = a; } y += 40; }
    if (x.num && t < (x.numAt ?? -1)) y += 130;                                    // numAt：数字等说到它的时候再数上来
    else if (x.num) { const q = easeOut(P(t, x.numAt ?? x.t0 + .3, 1.0)), v = parseFloat(x.num) * q, dec = (x.num.split('.')[1] || '').length;
      g.font = `800 120px ${NUM}`; g.fillStyle = GOLD; g.fillText(v.toFixed(dec), X + 30, y + 40); const nw = g.measureText(v.toFixed(dec)).width;
      if (x.unit) { g.font = `700 40px ${SANS}`; g.fillStyle = '#fbf8f1'; g.fillText(x.unit, X + 44 + nw, y + 58); } y += 130; }
    if (x.title) { g.font = `800 ${x.tsize || 54}px ${SERIF}`; const ch = [...x.title]; let px = X + 34;
      ch.forEach((c, i) => { const q = easeOut(P(t, x.t0 + .15 + i * .035, .4)); g.globalAlpha = a * q; g.fillStyle = '#fbf8f1'; g.fillText(c, px, y + (1 - q) * 16); px += g.measureText(c).width; });
      g.globalAlpha = a; y += (x.tsize || 54) * 1.35; }
    for (const L of x.lines || []) { const ta = L.at ?? x.t0 + .5, q = easeOut(P(t, ta, .45)); if (q <= 0) { y += L.sub ? 92 : 62; continue; }
      g.globalAlpha = a * q; g.font = `${L.hl ? 700 : 600} ${L.size || 36}px ${SANS}`; const tw = g.measureText(L.text).width;
      if (L.hl) { const hu = easeIO(P(t, ta + .25, .5)); g.fillStyle = 'rgba(233,182,92,.32)'; rr(g, X + 30, y - 24, (tw + 12) * hu, 48, 8); g.fill(); }
      g.fillStyle = L.dim ? 'rgba(241,237,228,.6)' : '#fbf8f1'; g.fillText(L.text, X + 36 + (1 - q) * 18, y);
      if (L.sub) { g.font = `500 24px ${SANS}`; g.fillStyle = 'rgba(241,237,228,.66)'; g.fillText(L.sub, X + 36 + (1 - q) * 18, y + 40); y += 30; }
      y += 62; }
    g.restore();
  }

  // 贴图：小机器人讲话时贴在它旁边的照片 / 便签。弹出来、歪一点、顶上一条胶带；可以在照片上画红圈、写一行字。
  // x: { x, y（中心，1920 设计稿）, w, rot, src | note: [行], cap, ring: { u, v, r, at }, tag }
  sticker(g, x, t) {
    const e = back(P(t, x.t0, .55)), out = easeIO(P(t, x.t1 - .4, .4)), a = clamp(P(t, x.t0, .2)) * (1 - out); if (a <= 0) return;
    const im = x.src ? img(x.src) : null, W_ = x.w, H_ = im ? W_ * im.height / im.width : (x.h || W_ * .8);
    g.save(); g.globalAlpha = a; g.translate(x.x, x.y + out * 40); g.rotate((x.rot || 0) * Math.PI / 180 + (1 - e) * (x.spin ?? -.3)); const sc = .55 + .45 * e; g.scale(sc, sc);
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 30; g.shadowOffsetY = 14;
    if (im) { g.fillStyle = '#fbfaf6'; g.fillRect(-W_ / 2 - 14, -H_ / 2 - 14, W_ + 28, H_ + 28 + (x.cap ? 56 : 0)); g.shadowBlur = 0; g.shadowOffsetY = 0; g.drawImage(im, -W_ / 2, -H_ / 2, W_, H_);
      if (x.cap) { g.font = `600 30px ${'"Kaiti SC", "STKaiti", serif'}`; g.fillStyle = '#23242b'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(x.cap, 0, H_ / 2 + 30); }
      if (x.ring) { const ru = easeOut(P(t, this.TX(x.ring.at ?? x.t0 + .6), .6)); if (ru > 0) { const cx = -W_ / 2 + x.ring.u * W_, cy = -H_ / 2 + x.ring.v * H_, R = (x.ring.r || .15) * W_; g.strokeStyle = '#ef4a3b'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath();
        for (let i = 0; i <= 60 * ru; i++) { const q = i / 60 * Math.PI * 2.1 - 1.8; g.lineTo(cx + Math.cos(q) * R, cy + Math.sin(q) * R * (x.ring.ry ?? .8)); } g.stroke(); } }
      if (x.tag) { g.font = `700 24px ${SANS}`; const tw = g.measureText(x.tag).width + 30; g.fillStyle = x.tagCol || GOLD; rr(g, -W_ / 2 + 14, -H_ / 2 + 14, tw, 40, 20); g.fill(); g.fillStyle = '#17181b'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(x.tag, -W_ / 2 + 29, -H_ / 2 + 35); } }
    else { g.fillStyle = x.col || '#ffe27a'; g.fillRect(-W_ / 2, -H_ / 2, W_, H_); g.shadowBlur = 0; g.shadowOffsetY = 0; g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(-W_ / 2, -H_ / 2, W_, 26);
      g.fillStyle = '#23242b'; g.textAlign = 'center'; g.textBaseline = 'middle'; const L = x.note, fs = x.fs || 46; g.font = `700 ${fs}px ${'"Kaiti SC", "STKaiti", serif'}`;
      L.forEach((s, i) => { const q = clamp((t - x.t0 - .3 - i * .35) / .5); g.save(); g.beginPath(); const tw = g.measureText(s).width; g.rect(-tw / 2 - 4, -H_ / 2, (tw + 8) * q, H_); g.clip(); g.fillText(s, 0, (i - (L.length - 1) / 2) * fs * 1.35 + 8); g.restore(); }); }
    g.shadowBlur = 0; g.fillStyle = 'rgba(240,226,170,.72)'; g.save(); g.translate(0, -H_ / 2 - 8); g.rotate(-.04); g.fillRect(-60, -18, 120, 36); g.restore();   // 胶带
    g.restore(); g.textAlign = 'left';
  }

  // ---------- 引导：点赞收藏（右下角三个按钮依次弹出、点亮） ----------
  like(g, x, t) {
    const D = x.dur || 5, a = W(t, x.t0, x.t0 + D, .4), keys = x.keys || ['like', 'coin', 'fav'];
    const CX = x.cx ?? 1920 - 120, CY = x.cy ?? 860;
    keys.forEach((k, i) => { const t0 = x.t0 + .25 + i * .32, p = back(P(t, t0, .45)), lit = P(t, t0 + .5, .25), X = CX - (keys.length - 1 - i) * 150, Y = CY;
      g.save(); g.globalAlpha = a; g.translate(X, Y); g.scale(p, p);
      g.fillStyle = `rgba(14,15,18,${.7})`; g.beginPath(); g.arc(0, 0, 58, 0, 7); g.fill();
      if (lit > 0) { g.strokeStyle = `rgba(251,114,153,${lit})`; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 58 + (1 - lit) * 16, 0, 7); g.stroke(); }
      g.fillStyle = lit > .5 ? PINK : '#f1ede4'; icon(g, k); g.font = `600 22px ${SANS}`; g.textAlign = 'center'; g.fillStyle = '#f1ede4'; g.fillText({ like: '点赞', coin: '投币', fav: '收藏' }[k], 0, 92);
      g.restore(); });
    if (x.text) { g.globalAlpha = a; g.font = `700 34px ${SANS}`; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillStyle = '#fbf8f1'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 12;
      if (x.cx) { g.textAlign = 'center'; g.fillText(x.text, CX - (keys.length - 1) * 75, CY - 120); } else g.fillText(x.text, 1920 - 70, 740); g.shadowBlur = 0; g.textAlign = 'left'; g.globalAlpha = 1; }
  }
  // ---------- 引导：评论区（一个评论框，字一个个打出来） ----------
  comment(g, x, t) {
    const D = x.dur || 6, a = W(t, x.t0, x.t0 + D, .4), e = back(P(t, x.t0, .5)); g.save(); g.globalAlpha = a; g.translate(1920 - 690, 700 + (1 - e) * 40);
    g.fillStyle = 'rgba(250,248,244,.96)'; rr(g, 0, 0, 640, 170, 22); g.fill(); g.fillStyle = '#9499a3'; g.font = `600 22px ${SANS}`; g.textBaseline = 'middle'; g.fillText('发一条友善的评论', 30, 36);
    const s = x.text, n = Math.floor(clamp((t - x.t0 - .6) / (x.typing || 1.6)) * [...s].length); g.fillStyle = '#18191c'; g.font = `600 32px ${SANS}`; g.fillText([...s].slice(0, n).join(''), 30, 92);
    if (Math.floor(t * 2.4) % 2 === 0) { g.fillStyle = PINK; g.fillRect(30 + g.measureText([...s].slice(0, n).join('')).width + 4, 72, 3, 40); }
    g.fillStyle = PINK; rr(g, 640 - 130, 116, 104, 40, 20); g.fill(); g.fillStyle = '#fff'; g.font = `700 20px ${SANS}`; g.textAlign = 'center'; g.fillText('发布', 640 - 78, 137); g.restore();
  }
  // ---------- 引导：弹幕（几条从右往左飘过上半屏） ----------
  danmaku(g, x, t) {
    const D = x.dur || 7; g.textBaseline = 'middle'; g.font = `600 40px ${SANS}`;
    (x.lines || [x.text]).forEach((s, i) => { const t0 = x.t0 + i * .55 + hash(i + 3) * .3, sp = 330 + hash(i * 7) * 120, wd = g.measureText(s).width, X = 1920 - (t - t0) * sp, Y = 150 + (i % 4) * 66 + hash(i) * 14;
      if (t < t0 || X < -wd) return; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(s, X, Y); g.fillStyle = i === 0 ? '#fff' : ['#ffe08a', '#fbf8f1', '#9fe8da', '#ffd0dc'][i % 4]; g.fillText(s, X, Y); });
    if (x.hint) { const a = W(t, x.t0, x.t0 + D, .4); g.globalAlpha = a; g.font = `700 30px ${SANS}`; const w = g.measureText(x.hint).width + 56; g.fillStyle = 'rgba(14,15,18,.7)'; rr(g, 960 - w / 2, 60, w, 56, 28); g.fill();
      g.fillStyle = '#fbf8f1'; g.textAlign = 'center'; g.fillText(x.hint, 960, 89); g.textAlign = 'left'; g.globalAlpha = 1; }
  }
}

function icon(g, k) {                               // 三个图标用路径画，不用字体图标
  g.save();
  if (k === 'like') { g.beginPath(); g.moveTo(-20, -4); g.lineTo(-6, -4); g.lineTo(-2, -26); g.quadraticCurveTo(10, -26, 8, -12); g.lineTo(6, -4); g.lineTo(22, -4); g.quadraticCurveTo(30, -2, 26, 8); g.lineTo(20, 24); g.quadraticCurveTo(18, 28, 12, 28); g.lineTo(-20, 28); g.closePath(); g.fill(); g.fillRect(-30, -4, 7, 32); }
  else if (k === 'coin') { g.beginPath(); g.arc(0, 2, 27, 0, 7); g.fill(); g.fillStyle = 'rgba(14,15,18,.85)'; g.font = `800 30px ${NUM}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('币', 0, 3); }
  else { g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 29, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r + 3); } g.closePath(); g.fill(); }
  g.restore();
}
