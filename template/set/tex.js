// 程序化贴图：全部在加载时用带种子的噪声现算，不读任何图片。
// 每一套给三张：颜色、起伏（给法线用）、粗糙度。对应「真实感开关」的第 2 级。
import * as THREE from 'three';

export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// 可以无缝平铺的分形噪声。gx、gy 是第一层在两个方向上的格数，拉开差距就得到顺着一个方向的纹理（木纹）。
export function fbm(size, seed, gx = 4, gy = 4, oct = 5, gain = .5) {
  const out = new Float32Array(size * size), r = rng(seed); let amp = 1, sum = 0;
  for (let o = 0; o < oct; o++) {
    const nx = gx << o, ny = gy << o, lat = new Float32Array(nx * ny); for (let i = 0; i < lat.length; i++) lat[i] = r();
    for (let y = 0; y < size; y++) { const fy = y / size * ny, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty), r0 = (y0 % ny) * nx, r1 = ((y0 + 1) % ny) * nx;
      for (let x = 0; x < size; x++) { const fx = x / size * nx, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx), a = x0 % nx, b = (x0 + 1) % nx;
        out[y * size + x] += amp * ((lat[r0 + a] * (1 - sx) + lat[r0 + b] * sx) * (1 - sy) + (lat[r1 + a] * (1 - sx) + lat[r1 + b] * sx) * sy); } }
    sum += amp; amp *= gain; if (nx > size / 2 || ny > size / 2) break;
  }
  for (let i = 0; i < out.length; i++) out[i] /= sum; return out;
}

function toTex(size, fill, srgb) {            // fill(i, x, y) 返回 [r, g, b]，范围 0 到 1
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), im = g.createImageData(size, size), d = im.data;
  for (let y = 0, i = 0; y < size; y++) for (let x = 0; x < size; x++, i++) { const v = fill(i, x, y); d[i * 4] = v[0] * 255; d[i * 4 + 1] = v[1] * 255; d[i * 4 + 2] = v[2] * 255; d[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
const gray = v => [v, v, v], cl = v => Math.max(0, Math.min(1, v));
const hsl = (h, s, l) => { const a = s * Math.min(l, 1 - l), f = n => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)]; };

// 木头：大块色差 + 顺纹的条纹 + 细孔。planks > 1 时是拼板（地板），板缝压暗、压低。
export function wood(seed, { hue = .07, sat = .45, light = .36, planks = 1, size = 1024, ring: RK = 1 } = {}) {
  const big = fbm(size, seed, 2, 2, 3), grain = fbm(size, seed + 1, 3, 48, 5, .6), fine = fbm(size, seed + 2, 16, 256, 3), r = rng(seed + 3);
  const pl = Array.from({ length: planks }, () => [(r() - .5) * .07, (r() - .5) * .03, Math.floor(r() * size)]);
  const at = (x, y) => { const k = Math.min(planks - 1, Math.floor(x / size * planks)), yy = (y + pl[k][2]) % size, i = yy * size + x, j = yy * size + (x + Math.floor(big[i] * size * .22)) % size;
    const edge = planks > 1 ? Math.min(1, Math.abs((x / size * planks) % 1 - .5) * -2 + 1) : 0, seam = edge < .012 ? 1 : 0;       // 板缝
    const ring = Math.abs(Math.sin((grain[j] * 9 + big[i] * 5) * Math.PI)); return { k, i, seam, ring }; };
  return {
    map: toTex(size, (_, x, y) => { const { k, i, seam, ring } = at(x, y); const l = light + pl[k][0] + (big[i] - .5) * .10 - Math.pow(ring, 6) * .10 * RK + (fine[i] - .5) * .06 * RK - seam * .2;
      return hsl(hue + pl[k][1] + (big[i] - .5) * .02, sat, cl(l)); }, true),
    bump: toTex(size, (_, x, y) => { const { i, seam, ring } = at(x, y); return gray(cl(.6 - Math.pow(ring, 6) * .25 * RK + (fine[i] - .5) * .25 * RK - seam * .6)); }),
    rough: toTex(size, (_, x, y) => { const { i, seam, ring } = at(x, y); return gray(cl(.42 + (big[i] - .5) * .25 + Math.pow(ring, 6) * .2 + seam * .4)); }),
  };
}

// 墙面：几乎是白的，有大片的轻微色差、滚筒留下的细颗粒、靠下的地方略脏。
export function plaster(seed, { tone = [.93, .91, .87], size = 512 } = {}) {
  const big = fbm(size, seed, 2, 2, 4), fine = fbm(size, seed + 1, 64, 64, 3), mid = fbm(size, seed + 2, 12, 12, 3);
  return {
    map: toTex(size, i => { const k = 1 + (big[i] - .5) * .09 + (mid[i] - .5) * .07 + (fine[i] - .5) * .03; return tone.map(c => cl(c * k)); }, true),
    bump: toTex(size, i => gray(cl(.5 + (fine[i] - .5) * .9 + (mid[i] - .5) * .3))),
    rough: toTex(size, i => gray(cl(.86 + (big[i] - .5) * .2))),
  };
}

// 织物：经纬交织的起伏。椅子的网布和灯罩用。
export function fabric(seed, { tone = [.17, .18, .2], weave = 96, size = 512 } = {}) {
  const big = fbm(size, seed, 3, 3, 3), fine = fbm(size, seed + 1, 128, 128, 2);
  const w = (x, y) => .5 + .5 * Math.sin(x / size * weave * Math.PI * 2) * Math.sin(y / size * weave * Math.PI * 2);
  return {
    map: toTex(size, (i, x, y) => { const k = .82 + w(x, y) * .3 + (big[i] - .5) * .2; return tone.map(c => cl(c * k)); }, true),
    bump: toTex(size, (i, x, y) => gray(cl(w(x, y) * .8 + (fine[i] - .5) * .3))),
    rough: toTex(size, i => gray(cl(.88 + (big[i] - .5) * .15))),
  };
}

// 细颗粒的哑光面：毛毡桌垫、塑料外壳、陶瓷釉面上的细微不均匀。
export function speckle(seed, { tone = [.1, .1, .11], amount = .12, rough = .7, roughVar = .25, grain = 96, size = 512 } = {}) {
  const big = fbm(size, seed, 3, 3, 4), fine = fbm(size, seed + 1, grain, grain, 3);
  return {
    map: toTex(size, i => { const k = 1 + (fine[i] - .5) * amount * 2 + (big[i] - .5) * amount; return tone.map(c => cl(c * k)); }, true),
    bump: toTex(size, i => gray(cl(.5 + (fine[i] - .5) * .9))),
    rough: toTex(size, i => gray(cl(rough + (big[i] - .5) * roughVar * 2 + (fine[i] - .5) * roughVar))),
  };
}

// 一张普通的 2D 画布当贴图（键帽字符、画芯、屏幕）。
export function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
