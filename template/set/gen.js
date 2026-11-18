// 程序画的占位图：不读任何图片文件。导演表里写 'gen:print/3' 这样的地址，就会得到一张画布，用法和图片一样（屏幕、贴图、软木板都认）。
//   gen:print/N   一张风景照（天色、太阳、几层山、雾、颗粒、暗角），N 换一组颜色和山形
//   gen:flat/N    同一张，只有平涂的色块：当「改之前」
//   gen:clay/N    同一张，刷成灰模：只看形状
// 同一个 N 每次画出来都一样。真图到了以后，把地址换成 media/ 下的文件就行。
import { rng } from './tex.js';

const W = 1200, H = 800;
const PAL = [   // 天顶、地平线、太阳、四层山（远到近）
  { top: '#3b4a6b', hor: '#f2b880', sun: '#ffe2b0', ridges: ['#8b7f9e', '#6c6585', '#4b4763', '#2e2b3d'], sy: .52 },
  { top: '#5f95cc', hor: '#dbe9f4', sun: '#fffbe8', ridges: ['#9fb8c8', '#7fa08c', '#5d8463', '#3d5e40'], sy: .22 },
  { top: '#2a2440', hor: '#e8875a', sun: '#ffd08a', ridges: ['#7a5a6e', '#5a4256', '#3c2d3e', '#221a26'], sy: .58 },
  { top: '#86afd2', hor: '#f4e6cf', sun: '#fff4dc', ridges: ['#a8bccb', '#7f97a8', '#58707f', '#3a4a55'], sy: .4 },
  { top: '#c97f58', hor: '#f6d29a', sun: '#fff0c8', ridges: ['#d9a77a', '#c48a5c', '#a56c42', '#7a4c2c'], sy: .45 },
  { top: '#9fbcd6', hor: '#eef2f5', sun: '#ffffff', ridges: ['#c9d6e2', '#aebfd0', '#8297ad', '#55657a'], sy: .3 },
];
const mix = (a, b, k) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`; };
const grey = (h, k = 1) => { const v = Math.round(([1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).reduce((a, b) => a + b) / 3) * k); return `rgb(${v},${v},${v})`; };

function ridgeY(r, layer) {   // 一层山的轮廓：几道正弦叠起来，越近越低、起伏越大
  const base = H * (.5 + layer * .1), amp = H * (.05 + layer * .035), w = [r() * 6.28, r() * 6.28, r() * 6.28], f = [1 + r() * 2, 3 + r() * 3, 8 + r() * 6];
  return (x) => { const u = x / W; return base - amp * (Math.sin(u * f[0] * 3.14 + w[0]) * .6 + Math.sin(u * f[1] * 3.14 + w[1]) * .3 + Math.sin(u * f[2] * 3.14 + w[2]) * .1); };
}

export function genImage(name) {
  const [kind, n] = name.split('/'), k = (+n || 0), P = PAL[k % PAL.length], r = rng(101 + k * 17);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const flat = kind === 'flat', clay = kind === 'clay', col = (h, d = 1) => clay ? grey(h, d) : h;
  const ridges = P.ridges.map((_, i) => ridgeY(r, i)), sx = W * (.3 + .4 * ((k * .618) % 1)), sy = H * P.sy;   // 太阳在图里的位置：u = .3 + .4 × (N × .618 的小数部分)，v 见 PAL 的 sy，圈注时用
  // 天
  if (flat) { g.fillStyle = mix(P.top, P.hor, .5); g.fillRect(0, 0, W, H); }
  else { const sk = g.createLinearGradient(0, 0, 0, H * .75); sk.addColorStop(0, col(P.top)); sk.addColorStop(1, col(P.hor)); g.fillStyle = sk; g.fillRect(0, 0, W, H); }
  // 太阳和光晕
  if (!clay) { if (!flat) { const gl = g.createRadialGradient(sx, sy, 0, sx, sy, H * .45); gl.addColorStop(0, 'rgba(255,240,210,.55)'); gl.addColorStop(1, 'rgba(255,240,210,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, H); }
    g.fillStyle = P.sun; g.beginPath(); g.arc(sx, sy, H * .045, 0, 7); g.fill(); }
  // 山：远的淡、近的深；每层顶上一道受光的亮边，层和层之间一层雾
  ridges.forEach((y, i) => {
    g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 4) g.lineTo(x, y(x)); g.lineTo(W, H); g.closePath();
    if (flat) g.fillStyle = P.ridges[i];
    else { const top = Math.min(...Array.from({ length: 30 }, (_, j) => y(j * W / 29))), gr = g.createLinearGradient(0, top, 0, H); gr.addColorStop(0, col(P.ridges[i], clay ? 1.15 - i * .12 : 1)); gr.addColorStop(1, col(P.ridges[i], clay ? .8 - i * .1 : .7)); g.fillStyle = gr; }
    g.fill();
    if (!flat) { g.strokeStyle = clay ? 'rgba(255,255,255,.25)' : 'rgba(255,236,200,.28)'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= W; x += 4) g.lineTo(x, y(x) + 1); g.stroke();
      if (!clay && i < 3) { const hz = g.createLinearGradient(0, y(W / 2) - 40, 0, H); hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(1, `rgba(${P.hor === '#f6d29a' ? '246,210,154' : '235,232,226'},.18)`); g.fillStyle = hz; g.fillRect(0, 0, W, H); } }
  });
  if (flat || clay) return c;
  // 暗角和颗粒
  const vg = g.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .85); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  const im = g.getImageData(0, 0, W, H), d = im.data, q = rng(7 + k);
  for (let i = 0; i < d.length; i += 4) { const v = (q() - .5) * 14; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
  g.putImageData(im, 0, 0); return c;
}
