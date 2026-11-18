// 软木板上那张大白纸画什么：手写的清单（note）、钉上去的照片（pins）。画布 2048×1304，按 1000×637 的设计稿写，乘 k。只依赖 t。
import { img } from './screen.js';
import { clamp, ease, easeOut, easeIO, back, lerp, P, hash } from './kit.js';

let TX = (x) => x; export const setTXb = (f) => { TX = f; };
const T = (x, d) => TX(x ?? d);
const HAND = '"Kaiti SC", "STKaiti", "PingFang SC", serif', SANS = '"PingFang SC", sans-serif';
const INK = '#23242b', RED = '#c8372d', GOLD = '#d39a2f', BLUE = '#2f5fa5';

function paper(g, w, h) {
  g.fillStyle = '#f7f4ec'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(80,120,200,.10)'; g.lineWidth = 2; for (let y = 120; y < h; y += 72) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  const gr = g.createRadialGradient(w / 2, h / 2, h * .2, w / 2, h / 2, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(60,40,10,.10)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
}
// 手写：从左到右一点点露出来（像笔在写），写完以后可以划掉、可以用荧光笔涂
function hand(g, text, x, y, t, t0, k, o = {}) {
  g.font = `${o.w || 600} ${(o.size || 48) * k}px ${HAND}`; g.textBaseline = 'middle'; g.textAlign = 'left';
  const tw = g.measureText(text).width, dur = o.dur ?? Math.max(.5, [...text].length * .07), u = clamp((t - t0) / dur); if (u <= 0) return tw;
  if (o.hl !== undefined) { const hu = easeIO(P(t, T(o.hl), .5)); if (hu > 0) { g.fillStyle = 'rgba(255,214,90,.6)'; g.fillRect(x - 8 * k, y - (o.size || 48) * k * .45, (tw + 16 * k) * hu, (o.size || 48) * k * .9); } }
  g.save(); g.beginPath(); g.rect(x - 10, y - 200, (tw + 20) * u, 400); g.clip(); g.fillStyle = o.col || INK; g.fillText(text, x, y); g.restore();
  if (o.strike !== undefined) { const su = easeOut(P(t, T(o.strike), .4)); if (su > 0) { g.strokeStyle = RED; g.lineWidth = 6 * k; g.beginPath(); g.moveTo(x - 6 * k, y + 2 * k); g.lineTo(x - 6 * k + (tw + 12 * k) * su, y - 4 * k); g.stroke(); } }
  if (o.ring !== undefined) { const ru = easeOut(P(t, T(o.ring), .6)); if (ru > 0) { g.strokeStyle = RED; g.lineWidth = 5 * k; g.beginPath(); for (let i = 0; i <= 60 * ru; i++) { const q = i / 60 * Math.PI * 2.1 - 1.8; g.lineTo(x + tw / 2 + Math.cos(q) * (tw / 2 + 26 * k), y + Math.sin(q) * (o.size || 48) * k * .9); } g.stroke(); } }
  return tw;
}

// 清单：it: { title, lines: [{ text, at, sub, strike, hl, ring, col, mark: '✓'|'✗' }], size }
function note(g, w, h, it, t) {
  const k = w / 1000; paper(g, w, h);
  if (it.title) { hand(g, it.title, 60 * k, 70 * k, t, it.t0, k, { size: 60, w: 800, dur: .6 }); g.fillStyle = GOLD; g.fillRect(60 * k, 108 * k, 260 * k * easeOut(P(t, it.t0 + .4, .5)), 6 * k); }
  const n = it.lines.length, gap = Math.min(110, (560 - (it.title ? 150 : 60)) / n); let y = (it.title ? 190 : 100) * k;
  it.lines.forEach((L, i) => { const ta = T(L.at, it.t0 + .3 + i * .5); if (t >= ta) {
      if (L.mark) { const mu = back(P(t, ta, .4)); g.save(); g.translate(78 * k, y); g.scale(mu, mu); g.font = `800 ${50 * k}px ${HAND}`; g.fillStyle = L.mark === '✗' ? RED : '#2e8b57'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L.mark, 0, 0); g.restore(); }
      else { g.fillStyle = INK; g.beginPath(); g.arc(78 * k, y, 8 * k * easeOut(P(t, ta, .2)), 0, 7); g.fill(); } }
    hand(g, L.text, 116 * k, y, t, ta, k, { size: it.size || 50, strike: L.strike, hl: L.hl, ring: L.ring, col: L.col });
    if (L.sub) hand(g, L.sub, 120 * k, y + 50 * k, t, ta + .4, k, { size: 30, col: '#6b6a70', w: 500 });
    y += (gap + (L.sub ? 30 : 0)) * k; });
}

// 钉照片：一张一张落下来、钉上，下面手写一行；可以在照片上画红圈。it: { title, pins: [{ src, at, x, y, w, rot, cap, ring: { u, v, r, at } }] }
function pins(g, w, h, it, t) {
  const k = w / 1000; paper(g, w, h);
  if (it.title) { hand(g, it.title, 50 * k, 60 * k, t, it.t0, k, { size: 52, w: 800, dur: .6 }); }
  for (const p of it.pins) { const ta = T(p.at, it.t0), u = P(t, ta, .5); if (u <= 0) continue; const im = img(p.src); if (!im) continue;
    const pw = p.w * k, ph = pw * im.height / im.width, drop = 1 - easeOut(u), sc = 1 + .15 * drop;
    g.save(); g.translate(p.x * k, p.y * k - drop * 60 * k); g.rotate((p.rot || 0) * Math.PI / 180 + drop * .15); g.scale(sc, sc);
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 24 * k * (1 + drop); g.shadowOffsetY = 8 * k * (1 + drop * 3); g.fillStyle = '#fff'; g.fillRect(-pw / 2 - 12 * k, -ph / 2 - 12 * k, pw + 24 * k, ph + 24 * k); g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.drawImage(im, -pw / 2, -ph / 2, pw, ph);
    if (p.ring) { const ru = easeOut(P(t, T(p.ring.at), .6)); if (ru > 0) { const cx = -pw / 2 + p.ring.u * pw, cy = -ph / 2 + p.ring.v * ph, R = (p.ring.r || .15) * pw; g.strokeStyle = RED; g.lineWidth = 6 * k; g.beginPath(); for (let i = 0; i <= 60 * ru; i++) { const q = i / 60 * Math.PI * 2.1 - 1.8; g.lineTo(cx + Math.cos(q) * R, cy + Math.sin(q) * R * .8); } g.stroke(); } }
    const pa = clamp((u - .7) / .3); if (pa > 0) { g.fillStyle = RED; g.beginPath(); g.arc(0, -ph / 2 - 2 * k, 11 * k * pa, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(-3 * k, -ph / 2 - 5 * k, 3 * k * pa, 0, 7); g.fill(); }
    g.restore();
    if (p.cap) hand(g, p.cap, (p.x - p.w / 2) * k, (p.y * k + ph / 2 + 44 * k), t, ta + .45, k, { size: p.capSize || 34, col: p.capCol || INK });
  }
}

export const BKINDS = { note, pins };
export function boardNeeds(it) { return it?.kind === 'pins' ? it.pins.map((p) => p.src) : []; }
