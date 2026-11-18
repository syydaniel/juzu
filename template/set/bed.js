// 床角：房间左前角，床贴着窗墙，床头靠前墙 z = 3.2，床尾朝书桌。床架、软包床头板、床垫和床单、被子、枕头、抱枕、
// 一只毛绒小熊、床头柜（闹钟指针跟着片子的时间走）、壁灯（平时关着，导演表的 LIGHT 用 bed 控制）、床边地毯。
// 每样东西都是代码搭的，不用模型文件：
//   被子：先在被面的平面坐标里「设计」每一点比床垫高多少（几团鼓包 + 顺着拉扯方向的长折 + 削平尖顶 + 一条条画上去的细褶），
//         再沿床垫的圆角包下去、垂到床边。先设计高度再盖上去的思路学自 room-at-dawn（MIT 许可）的床，代码和参数是这里自己写的。
//   小东西（毛绒小熊、抱枕、地毯）都不正对镜头，像随手放的；颜色压得低，不抢小机器人和屏幕。
// 不要床角：film.html?nobed，或者导演表里写 SET.bed = false（悬浮段 MAGIC 要用到床角和照片墙，一起关掉）。
// 尺寸单位是米。床的局部坐标：s 横跨床宽（0 在窗墙那边），t 沿床长（0 在床尾）。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng, wood, canvasTex } from './tex.js';
import { lampBulbRig } from './lamps.js';

export const BED = { x0: .025, z0: 1.27, w: 1.20, l: 1.89, top: .50, mh: .20, r: .055, frameH: .30 };
const HB = { t: .05, h: 1.02 };                                          // 床头板：厚 5 厘米，顶离地 1.02
const NS = { x: 1.27, z: 2.74, w: .40, d: .38, h: .50 };                  // 床头柜（贴前墙，在床的右边）
const RUG = { x: 1.34, z: 1.52, w: .78, l: 1.20 };                       // 床边地毯：左下角 (x, z)，宽沿 x，长沿 z

// ---------- 自己的噪声 ----------
const hash = (i, j, s) => { let h = (i * 374761393 + j * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const sm = (t) => t * t * (3 - 2 * t), clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function vn(x, y, s) { const i = Math.floor(x), j = Math.floor(y), fx = sm(x - i), fy = sm(y - j), a = hash(i, j, s), b = hash(i + 1, j, s), c = hash(i, j + 1, s), d = hash(i + 1, j + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; }
const fbm2 = (x, y, s, o = 4) => { let v = 0, a = .5, f = 1, n = 0; for (let k = 0; k < o; k++) { v += a * vn(x * f + k * 7.3, y * f - k * 3.1, s + k * 17); n += a; a *= .5; f *= 2.03; } return v / n; };
const billow = (n) => Math.abs(2 * n - 1);                               // 圆顶、尖谷：被子的折就是这样

// 一张平面上的数值场（被子的高度），双线性取值
class Grid {
  constructor(w, h, dx) { this.dx = dx; this.nx = Math.ceil(w / dx) + 1; this.ny = Math.ceil(h / dx) + 1; this.a = new Float32Array(this.nx * this.ny); }
  fill(f) { const { nx, ny, dx, a } = this; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) a[j * nx + i] = f(i * dx, j * dx); return this; }
  at(x, y) { const { nx, ny, dx, a } = this, fx = clamp(x / dx, 0, nx - 1.001), fy = clamp(y / dx, 0, ny - 1.001), i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, k = j * nx + i;
    return (a[k] * (1 - u) + a[k + 1] * u) * (1 - v) + (a[k + nx] * (1 - u) + a[k + nx + 1] * u) * v; }
  blur(r) { const { nx, ny, a } = this, b = new Float32Array(a.length), c = new Float32Array(a.length);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const ii = i + k; if (ii >= 0 && ii < nx) { s += a[j * nx + ii]; n++; } } b[j * nx + i] = s / n; }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const jj = j + k; if (jj >= 0 && jj < ny) { s += b[jj * nx + i]; n++; } } c[j * nx + i] = s / n; }
    return c; }
}

// ---------- 被子 ----------
// 被面平面：宽 SW（跨过床宽再垂下去），长 SL；床头那条边斜着，像是被人往床里推过一把。
const SW = 1.50, SL = 1.50, T_IN = .07;                                  // 被子从床尾往里 7 厘米开始，露出一截床单
const P0 = BED.w - BED.r, ARC = BED.r * Math.PI / 2;                      // 床垫平面到 P0，然后是圆角，再往下是垂直的床边
const tEnd = (s) => SL - .16 * (s / SW) - .03 * Math.sin(s * 4.1);
// 鼓包：[s, t, 半长, 半宽, 角度（度）, 高]。普通睡过一晚的样子：一条斜着的大卷，旁边挤着一条矮的，床尾和床里各一团。
const LOBES = [[.80, .86, .36, .15, 28, .105], [.60, 1.13, .27, .12, -12, .075], [1.02, .56, .30, .17, -38, .065], [.38, .44, .40, .22, 8, .045], [.30, 1.24, .24, .15, 32, .04]]
  .map(([s, t, a, b, deg, h]) => ({ s, t, a, b, c: Math.cos(deg * Math.PI / 180), d: Math.sin(deg * Math.PI / 180), h }));
const smax = (a, b, k) => { const h = clamp(.5 + .5 * (b - a) / k); return a * (1 - h) + b * h + k * h * (1 - h); };
function lobesAt(s, t) { let m = 0; for (const L of LOBES) { const u = ((s - L.s) * L.c + (t - L.t) * L.d) / L.a, v = (-(s - L.s) * L.d + (t - L.t) * L.c) / L.b, q = u * u + v * v; if (q < 1) m = smax(m, L.h * (1 - q) * (1 - q), .02); } return m; }
const fold = (deg, along, across, seed) => { const c = Math.cos(deg * Math.PI / 180), d = Math.sin(deg * Math.PI / 180); return (s, t) => billow(vn((s * c + t * d) / along, (-s * d + t * c) / across, seed)); };
const famA = fold(-36, .58, .12, 211), famB = fold(90, .6, .13, 213), famC = fold(4, .55, .12, 215);
const hangOf = (s) => sstep(P0 - .02, P0 + ARC, s);                         // 0 = 在床面上，1 = 垂在床边

function baseH(s, t) {
  const w1 = fbm2(s * 2.4 + 3.1, t * 2.4 + 1.7, 101, 3) - .5, w2 = fbm2(s * 2.4 + 9.4, t * 2.4 + 5.2, 102, 3) - .5, ws = s + w1 * .09, wt = t + w2 * .09;   // 扭一扭，免得出现尺子画的直线
  const hang = hangOf(s), M = lobesAt(ws, wt) * (1 - .92 * hang);
  const side = Math.max(sstep(.3, .08, s), sstep(1.0, 1.16, s)), foot = sstep(.42, .16, t) * (1 - side * .6), mid = clamp(1 - .75 * side - .75 * foot);
  const folds = mid * .040 * famA(ws, wt) + side * .028 * famB(ws, wt) + foot * .030 * famC(ws, wt), am = (.6 + .75 * vn(s * 1.7 + 11.3, t * 1.7 + .9, 117)) * (1 + 1.4 * M);
  const over = s - (P0 + ARC), flute = over > 0 ? .045 * sstep(.02, .24, over) * billow(vn(t / .17 + .3 * Math.sin(t * 9 + over * 3), over * 1.6 + .3, 121)) : 0;   // 垂下来的部分：竖着的大波浪，越往下越开
  const H = .046 * (.9 + .25 * vn(s * 3.1 + 2.7, t * 3.1 + 8.1, 118)) + M + folds * am * (1 - hang) + flute;
  return H - Math.max(0, H - .17) * .7;                                   // 最高的那团压一压
}

// 细褶：一条条画上去的「帐篷形」短线，两头收尖；从鼓包的两头扇形散开，其余顺着一个缓慢变化的方向撒
function creases(G, seed) {
  const r = rng(seed), { nx, ny, dx, a } = G;
  const one = (s0, t0, ang, L, R, A) => { const c = Math.cos(ang), d = Math.sin(ang), x1 = s0 + c * L, y1 = t0 + d * L;
    const i0 = Math.max(0, Math.floor((Math.min(s0, x1) - R) / dx)), i1 = Math.min(nx - 1, Math.ceil((Math.max(s0, x1) + R) / dx)), j0 = Math.max(0, Math.floor((Math.min(t0, y1) - R) / dx)), j1 = Math.min(ny - 1, Math.ceil((Math.max(t0, y1) + R) / dx));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const px = i * dx - s0, py = j * dx - t0, u = (px * c + py * d) / L; if (u < 0 || u > 1) continue;
      const q = Math.abs(-px * d + py * c) / R; if (q >= 1) continue; a[j * nx + i] += A * Math.pow(1 - q, 1.6) * Math.pow(Math.sin(Math.PI * u), .7); } };
  for (const L of LOBES) for (const end of [-1, 1]) { const ex = L.s + end * L.a * .85 * L.c, ey = L.t + end * L.a * .85 * L.d, base = Math.atan2(L.d * end, L.c * end), n = 4 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) one(ex, ey, base + (k / (n - 1) - .5) * 1.3 + (r() - .5) * .2, .12 + r() * .2, .02 + r() * .012, (r() < .3 ? -1 : 1) * (.006 + r() * .006)); }
  for (let k = 0; k < 190; k++) { const s0 = .04 + r() * (P0 - .1), t0 = .04 + r() * (SL - .2), ang = 7.5 * fbm2(s0 * 1.3 + 5.3, t0 * 1.3 + 2.9, 171, 2) + (r() - .5) * .5;
    one(s0, t0, ang, .07 + r() * .17, .014 + r() * .012, (r() < .3 ? -1 : 1) * (.003 + r() * .005)); }
}

function buildDuvetField() {
  const B = new Grid(SW, SL, .006).fill(baseH);
  const bl = B.blur(4), bl2 = new Grid(SW, SL, .006); bl2.a = bl; const b2 = bl2.blur(4);       // 削峰：每一点最多比周围（模糊两次）高 1.2 厘米，凹处不动
  for (let k = 0; k < B.a.length; k++) B.a[k] = Math.min(B.a[k], b2[k] + .012);
  const C = new Grid(SW, SL, .006); creases(C, 5521);
  for (let j = 0; j < C.ny; j++) for (let i = 0; i < C.nx; i++) { const s = i * C.dx, t = j * C.dx, ed = Math.min(s, t, tEnd(s) - t);
    C.a[j * C.nx + i] *= (1 - hangOf(s)) * (.35 + .65 * sstep(.02, .09, ed)) * (.7 + .6 * vn(s * 2.3 + 1.1, t * 2.3 + 7.7, 172)); }
  return { B, C };
}

export function buildBed(stage, set, opts = {}) {
  const { add, B: box, group, M } = set, root = new THREE.Group(); root.name = 'bedcorner'; stage.scene.add(root);
  const bed = group(BED.x0, 0, BED.z0, 'bed', root), r = rng(65);

  // ---------- 材质：布都用带绒光的物理材质 ----------
  const tex = (c, rep = 1, srgb = true) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const wrinkles = tex(wrinkleNormal(512, 913), 1, false), slub = linen(1024, 41), fleece = tex(fleeceNormal(256, 77), 1, false);
  const cloth = (o) => new THREE.MeshPhysicalMaterial({ roughness: .88, sheen: 1, sheenRoughness: .55, normalScale: new THREE.Vector2(.9, .9), side: THREE.DoubleSide, ...o });
  const duvetMap = tex(slub.map, 1); duvetMap.repeat.set(1 / .55, 1 / .55);
  const wr = wrinkles.clone(); wr.repeat.set(1 / .42, 1 / .42); wr.rotation = .4; wr.needsUpdate = true;
  const MAT = {
    duvet: cloth({ map: duvetMap, normalMap: wr, normalScale: new THREE.Vector2(.55, .55), color: 0xffffff, sheen: .35, sheenRoughness: .85, sheenColor: new THREE.Color(0xc9d1c4) }),   // 绒光太强会像毛毯
    sheet: cloth({ color: 0xebe7df, normalMap: (() => { const t = wrinkles.clone(); t.repeat.set(1 / .5, 1 / .5); t.needsUpdate = true; return t; })(), normalScale: new THREE.Vector2(.45, .45), sheenColor: new THREE.Color(0xffffff), side: THREE.FrontSide }),
    case: cloth({ color: 0xf0ebe2, normalMap: (() => { const t = wrinkles.clone(); t.repeat.set(1 / .3, 1 / .3); t.rotation = 1.2; t.needsUpdate = true; return t; })(), sheenColor: new THREE.Color(0xffffff) }),
    cushion: cloth({ map: tex(cushionPrint(1024), 1), normalMap: (() => { const t = wrinkles.clone(); t.repeat.set(1 / .35, 1 / .35); t.needsUpdate = true; return t; })(), normalScale: new THREE.Vector2(.5, .5), sheenColor: new THREE.Color(0xf4ece0) }),
    head: cloth({ color: 0xb8ad9d, normalMap: null, bumpMap: (() => { const t = tex(slub.bump, 1, false); t.repeat.set(4, 4); return t; })(), bumpScale: 1.4, sheenColor: new THREE.Color(0xd8d0c4), side: THREE.FrontSide }),
    oak: stage.mat({ color: 0xc49a6c, rough: .5, set: wood(651, { hue: .075, light: .58, sat: .30, ring: .6 }), bumpScale: .3 }),
    oakEnd: stage.mat({ color: 0xb48a5e, rough: .6 }),
    plush: cloth({ color: 0xc8b9a4, map: null, normalMap: (() => { const t = fleece.clone(); t.repeat.set(6, 6); t.needsUpdate = true; return t; })(), normalScale: new THREE.Vector2(.6, .6), roughness: .95, sheen: 1, sheenRoughness: .35, sheenColor: new THREE.Color(0xf2ead8), side: THREE.FrontSide }),
    felt: (c) => cloth({ color: c, roughness: .95, sheen: .6, sheenColor: new THREE.Color(0xffffff), side: THREE.FrontSide }),
    rug: cloth({ map: tex(rugMap(1024, 1580), 1), normalMap: (() => { const t = tex(rugWeave(256, 9), 1, false); t.repeat.set(14, 22); return t; })(), normalScale: new THREE.Vector2(.8, .8), roughness: 1, sheenColor: new THREE.Color(0xf4ead8), side: THREE.FrontSide }),
  };

  // ---------- 床架：比床垫窄一点（垂下来的被子不碰架子），矮脚；床头板是软包，五道竖向的鼓条 ----------
  { const fw = BED.w - .03, fl = BED.l - .02;
    for (const [w, h, d, x, y, z] of [[fw, .22, .03, BED.w / 2, .19, .03], [.03, .22, fl, .03, .19, fl / 2 + .02], [.03, .22, fl, fw, .19, fl / 2 + .02]]) box(w, h, d, .006, MAT.oak, x, y, z, bed);
    for (const [x, z] of [[.06, .06], [fw - .03, .06], [.06, BED.l - .05], [fw - .03, BED.l - .05]]) box(.045, .08, .045, .004, MAT.oakEnd, x, .04, z, bed);
    box(fw - .05, .02, fl - .04, .003, MAT.oakEnd, BED.w / 2, .29, fl / 2 + .02, bed, { cast: false });
    const hb = group(0, 0, BED.l + HB.t / 2, null, bed), n = 5, cw = (BED.w + .02) / n;
    box(BED.w + .04, HB.h - .06, HB.t * .5, .01, MAT.oak, BED.w / 2, (HB.h - .06) / 2 + .02, HB.t * .2, hb);
    for (let i = 0; i < n; i++) add(new RoundedBoxGeometry(cw - .006, HB.h - BED.top - .06, HB.t * .7, 6, .016), MAT.head, -.01 + cw * (i + .5), BED.top + (HB.h - BED.top) / 2 - .02, -HB.t * .25, hb); }

  // ---------- 床垫和床单：床单在床垫四边包下去，边上一条车线 ----------
  { const m = add(new RoundedBoxGeometry(BED.w, BED.mh, BED.l, 6, BED.r), MAT.sheet, BED.w / 2, BED.top - BED.mh / 2, BED.l / 2, bed);
    m.name = 'mattress'; }

  // ---------- 被子 ----------
  const { B: FB, C: FC } = buildDuvetField(), E = (s, t) => FB.at(s, t) + FC.at(s, t);
  const hem = (H, ed) => ed > .08 ? H : .004 + (H - .004) * Math.pow(sstep(.012, .075, ed), 1.2);   // 边上 1.2 厘米是缝平的两层布，往里才鼓起来
  const elev = (s, t) => hem(E(s, t), Math.min(s - .0, t, tEnd(s) - t, SW - s));
  // 沿床垫截面走：平面 → 圆角 → 垂直往下。s 是走过的布长，e 沿法线方向抬高
  const drape = (s, t, e, o) => { let x, y, nx, ny;
    if (s <= P0) { x = s; y = BED.top; nx = 0; ny = 1; }
    else if (s <= P0 + ARC) { const a = (s - P0) / BED.r; nx = Math.sin(a); ny = Math.cos(a); x = P0 + BED.r * nx; y = BED.top - BED.r + BED.r * ny; }
    else { x = BED.w; y = BED.top - BED.r - (s - P0 - ARC); nx = 1; ny = 0; }
    o[0] = x + nx * e; o[1] = y + ny * e; o[2] = t + T_IN; };
  const NU = 250, NV = 250, pos = new Float32Array((NU + 1) * (NV + 1) * 3), uv = new Float32Array((NU + 1) * (NV + 1) * 2), o = [0, 0, 0];
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) { const s = SW * i / NU, t = tEnd(s) * j / NV, k = j * (NU + 1) + i;
    drape(s, t, elev(s, t), o); pos.set(o, k * 3); uv[k * 2] = s; uv[k * 2 + 1] = t; }
  const idx = []; for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); dg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); dg.setIndex(idx); dg.computeVertexNormals();
  const duvet = add(dg, MAT.duvet, 0, 0, 0, bed); duvet.name = 'duvet';
  { const rim = [], P = (i, j) => { const k = j * (NU + 1) + i; rim.push(new THREE.Vector3(pos[k * 3], pos[k * 3 + 1] + .0015, pos[k * 3 + 2])); };    // 一圈包边的车线
    for (let i = 0; i < NU; i += 2) P(i, 0); for (let j = 0; j < NV; j += 2) P(NU, j); for (let i = NU; i > 0; i -= 2) P(i, NV); for (let j = NV; j > 0; j -= 2) P(0, j);
    const cv = new THREE.CatmullRomCurve3(rim, true, 'centripetal'); add(new THREE.TubeGeometry(cv, 700, .0022, 5, true), MAT.duvet, 0, 0, 0, bed, { cast: false }); }
  // 被面上某一点（世界坐标）的高度：桌上的字块落到床上（FX3D 里写 bed: true）、毛绒小熊坐的位置都问它
  const duvetY = (xw, zw) => { const s = xw - BED.x0, t = zw - BED.z0 - T_IN; if (s < 0 || s > P0 || t < 0 || t > tEnd(s)) return BED.top; return BED.top + elev(s, t); };

  // ---------- 枕头和抱枕：两片布缝起来、中间塞满。四个角瘪、每条边中间往里收；睡过的那只中间压出一个坑 ----------
  const cushion = (w, l, T, seed, o = {}) => {
    const nu = 56, nv = 40, P = [], U = [], I = [], h = (u, v) => { const a = Math.pow(1 - Math.pow(Math.abs(u), 3), .55), b = Math.pow(1 - Math.pow(Math.abs(v), 3), .55);
      let e = T / 2 * a * b * (1 - .28 * Math.pow(Math.abs(u * v), 2)) * (1 + .1 * (fbm2(u * 1.6 + 3, v * 1.6 + 1, seed, 3) - .5));
      if (o.dent) { const [du, dv, ru, rv, k] = o.dent, q = ((u - du) / ru) ** 2 + ((v - dv) / rv) ** 2; e *= 1 - k * Math.exp(-q); } return e; };
    for (const side of [1, -1]) for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const u = -1 + 2 * i / nu, v = -1 + 2 * j / nv, e = h(u, v) * (side > 0 ? 1 : (o.flat ?? .6));
      const wob = .006 * (vn(u * 3 + seed, v * 3, seed + 9) - .5);
      P.push(u * w / 2 * (1 - .05 * (1 - v * v)) + wob, side * e, v * l / 2 * (1 - .05 * (1 - u * u)) + wob); U.push((u + 1) / 2 * (o.uvw ?? 1), (v + 1) / 2 * (o.uvl ?? 1)); }
    const off = (nu + 1) * (nv + 1);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; I.push(a, c, b, b, c, d, a + off, b + off, c + off, b + off, d + off, c + off); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals(); return g; };
  // 放平以后绕着靠床尾的那条边往上翘 tilt（度），后背靠在床头板上；再落到床面上
  const lay = (geo, mat, x, t, tilt, yaw, roll = 0) => { const m = add(geo, mat, 0, 0, 0, bed); m.rotation.set(-tilt * Math.PI / 180, yaw * Math.PI / 180, roll * Math.PI / 180, 'YXZ'); m.updateMatrix();
    const bb = new THREE.Box3().setFromBufferAttribute(geo.attributes.position).applyMatrix4(m.matrix); m.position.set(x, BED.top - bb.min.y - .006, Math.min(t, BED.l - .003 - bb.max.z)); return m; };
  const pillow = lay(cushion(.70, .44, .13, 301, { dent: [-.05, .1, .45, .5, .38] }), MAT.case, .43, 1.72, 18, 6, -2);
  const cush = lay(cushion(.42, .42, .15, 317, { flat: .9 }), MAT.cushion, .96, 1.80, 64, -16, 6);
  pillow.name = 'pillow'; cush.name = 'cushion';

  // ---------- 毛绒小熊：梨形的身子，浅色肚皮，两只圆耳朵，扣子眼睛，小鼻头。像被随手扔在床头，歪着靠在枕头边上 ----------
  const plush = group(0, 0, 0, 'plush', bed);
  { const prof = [[0, 0], [.07, .002], [.094, .014], [.103, .043], [.102, .08], [.095, .114], [.084, .145], [.073, .174], [.064, .199], [.056, .221], [.044, .241], [.027, .255], [0, .261]];
    const yOfV = (v) => { const f = v * (prof.length - 1), i = Math.min(prof.length - 2, Math.floor(f)); return prof[i][1] + (prof[i + 1][1] - prof[i][1]) * (f - i); };
    const rOfY = (y) => { for (let i = 0; i < prof.length - 1; i++) if (y <= prof[i + 1][1]) { const u = (y - prof[i][1]) / (prof[i + 1][1] - prof[i][1]); return prof[i][0] + (prof[i + 1][0] - prof[i][0]) * u; } return 0; };
    const bodyTex = canvasTex(512, 256, (g, w, h) => { const id = g.createImageData(w, h);     // 燕麦色身子 + 前面一块浅色肚皮（缝上去的，边上一圈针脚）+ 两侧缝线
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) { const y = yOfV(1 - py / h), ang = (px / w - .5) * 360, q = (ang / 55) ** 2 + ((y - .085) / .06) ** 2, k = (py * w + px) * 4, n = vn(px / 6, py / 6, 5) * .06;
        let c = q < 1 ? [236, 228, 214] : [200, 185, 164]; if (Math.abs(q - 1) < .05 && (px >> 2) % 2) c = c.map((x) => x * .84); if (Math.abs(Math.abs(ang) - 92) < .9) c = c.map((x) => x * .82);
        id.data[k] = c[0] * (1 - n); id.data[k + 1] = c[1] * (1 - n); id.data[k + 2] = c[2] * (1 - n); id.data[k + 3] = 255; }
      g.putImageData(id, 0, 0); });
    bodyTex.colorSpace = THREE.SRGBColorSpace; MAT.plush.map = bodyTex; MAT.plush.color.set(0xffffff);
    const body = add(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 72, Math.PI, Math.PI * 2), MAT.plush, 0, 0, 0, plush); body.scale.set(1, 1, .86);
    const ZS = .86, onBody = (y, deg, lift = 0) => { const a = deg * Math.PI / 180, rr = rOfY(y), dr = (rOfY(y + .004) - rOfY(y - .004)) / .008, n = new THREE.Vector3(Math.sin(a), -dr, Math.cos(a) / ZS).normalize();
      return { p: new THREE.Vector3(Math.sin(a) * rr, y, Math.cos(a) * rr * ZS).addScaledVector(n, lift), n }; };
    const disc = (r0, mat, y, deg, lift, t = .0025) => { const { p, n } = onBody(y, deg, lift), m = add(new THREE.CylinderGeometry(r0, r0, t, 40), mat, p.x, p.y, p.z, plush, { cast: false }); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n); return m; };
    const ink = MAT.felt(0x2b2a28), paw = MAT.felt(0x9c8b76), inner = MAT.felt(0xe6dccb);
    for (const s of [-1, 1]) disc(.0105, ink, .205, s * 34, .0012, .004);                                                               // 扣子眼睛
    { const { p, n } = onBody(.178, 0, .004), snout = add(new THREE.SphereGeometry(.026, 24, 16), inner, p.x, p.y, p.z, plush); snout.scale.set(1.1, .8, .7); snout.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);   // 鼻头
      const tip = onBody(.186, 0, .02); add(new THREE.SphereGeometry(.008, 16, 12), ink, tip.p.x, tip.p.y, tip.p.z, plush, { cast: false }).scale.set(1.3, .8, .8); }
    for (const s of [-1, 1]) { const ear = add(new THREE.SphereGeometry(.03, 24, 16), MAT.plush, s * .05, .248, -.004, plush); ear.scale.set(1, 1, .45);   // 两只圆耳朵
      add(new THREE.SphereGeometry(.019, 20, 14), inner, s * .05, .246, .008, plush, { cast: false }).scale.set(1, 1, .3); }
    for (const s of [-1, 1]) { const arm = group(s * .088, .118, .01, null, plush); arm.rotation.set(-.55, 0, s * .5);                        // 短粗的胳膊，手搭在肚子两边
      add(new THREE.CapsuleGeometry(.02, .04, 6, 16), MAT.plush, 0, -.03, 0, arm); const hand = add(new THREE.SphereGeometry(.022, 20, 14), paw, 0, -.066, 0, arm); hand.scale.set(1, .75, 1.1);
      const foot = add(new THREE.SphereGeometry(.03, 20, 14), paw, s * .045, .014, .075, plush); foot.scale.set(1, .5, 1.45); foot.rotation.y = s * .2; }
    // 歪着坐：往后靠在枕头边上，朝墙那边倒一点，屁股陷进被子里一点
    const px = .15, pz = 1.47, py = duvetY(BED.x0 + px, BED.z0 + pz) - .018;
    plush.position.set(px, py, pz); plush.rotation.set(-.24, 2.45, .2, 'YXZ'); plush.scale.setScalar(.95); }   // 脸大致朝床尾和书桌，不正对任何机位

  // ---------- 床头柜：一个抽屉；上面一只小闹钟（指针跟着片子的时间走）和一本书 ----------
  const nst = group(NS.x + NS.w / 2, 0, NS.z + NS.d / 2, 'nightstand', root);
  const clock = {};
  { box(NS.w, .03, NS.d, .006, MAT.oak, 0, NS.h - .015, 0, nst); box(NS.w, .025, NS.d, .005, MAT.oak, 0, .1, 0, nst);
    for (const sx of [-1, 1]) box(.022, NS.h - .03, NS.d, .004, MAT.oak, sx * (NS.w / 2 - .011), (NS.h - .03) / 2, 0, nst);
    box(NS.w - .05, .015, NS.d - .02, .003, MAT.oakEnd, 0, .02, -.005, nst); box(NS.w - .048, .012, NS.d - .02, .003, MAT.oakEnd, 0, .29, -.005, nst);
    box(NS.w - .05, .15, .018, .004, MAT.oak, 0, .395, -NS.d / 2 + .012, nst); box(.06, .012, .016, .006, MAT.oakEnd, 0, .41, -NS.d / 2 - .002, nst);     // 抽屉面和拉手
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(.025, .1, .025, .003, MAT.oakEnd, x * (NS.w / 2 - .02), .05, z * (NS.d / 2 - .02), nst);
    const ck = clock.obj = group(.08, NS.h + .002, .02, null, nst); ck.rotation.y = Math.PI - .35;                                             // 闹钟面朝房间（-z 往里转一点）
    const shell = set.M.white; add(new THREE.CylinderGeometry(.045, .045, .035, 48), shell, 0, .047, 0, ck).rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(.006, .008, .012, 16), set.M.steel, sx * .03, .006, 0, ck);
    const face = canvasTex(256, 256, (g) => { g.fillStyle = '#f4efe4'; g.beginPath(); g.arc(128, 128, 128, 0, 7); g.fill(); g.fillStyle = '#2b2a28';
      for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, L = i % 5 ? 8 : 20, w = i % 5 ? 2 : 5; g.save(); g.translate(128, 128); g.rotate(a); g.fillRect(-w / 2, -118, w, L); g.restore(); } });
    face.colorSpace = THREE.SRGBColorSpace; add(new THREE.CircleGeometry(.04, 48), new THREE.MeshStandardMaterial({ map: face, roughness: .5 }), 0, .047, .0177, ck, { cast: false });
    add(new THREE.RingGeometry(.0395, .043, 48), set.M.steel, 0, .047, .018, ck, { cast: false });
    const hand = (L, W) => { const g = new THREE.Group(); g.position.set(0, .047, .019); ck.add(g); add(new THREE.BoxGeometry(W, L, .001), set.M.black, 0, L / 2 - .004, 0, g, { cast: false }); return g; };
    clock.h = hand(.022, .0032); clock.m = hand(.032, .0022);
    const bk = clock.book = group(-.06, NS.h, -.01, null, nst); bk.rotation.y = .22; box(.15, .022, .21, .002, set.M.navy, 0, .011, 0, bk); box(.142, .018, .204, .001, set.M.paper, .004, .011, 0, bk); }
  // 片子里第 t 秒是几点：从 start（时，小数）开始，跟真实时间一样走
  clock.set = (t, start = 16.8) => { const hr = start + t / 3600, mn = (hr % 1) * 60; clock.m.rotation.z = -mn / 60 * Math.PI * 2; clock.h.rotation.z = -(hr % 12) / 12 * Math.PI * 2; };

  // ---------- 壁灯：床头柜上方，前墙上；黑色摇臂，布灯罩朝下。平时关着，夜里或者导演表叫它的时候开 ----------
  const sconce = group(NS.x + NS.w / 2 - .02, 1.30, 3.2, 'sconce', root);
  const lamp = {};
  { add(new THREE.CylinderGeometry(.04, .04, .012, 32), set.M.black, 0, 0, -.006, sconce).rotation.x = Math.PI / 2;
    set.tube([[0, 0, -.01], [0, .02, -.12], [-.06, .04, -.24]], .006, set.M.black, sconce);
    const hd = group(-.06, .04, -.24, null, sconce); add(new THREE.LatheGeometry([[.075, -.11], [.074, -.108], [.04, 0], [.039, -.002]].map(([x, y]) => new THREE.Vector2(x, y)), 48), set.M.shade, 0, 0, 0, hd).userData.lampShade = true;
    lamp.bulb = add(new THREE.SphereGeometry(.018, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, -.05, 0, hd, { cast: false, recv: false });
    // 光束要顺着灯罩轴往下：斜着打的话会从灯罩侧面穿出去，在窗那面墙上拉出一道横线。所以是灯头本身朝床那边歪一点（摇臂壁灯本来就能掰），
    // 宽度按灯罩下口算（51°）；三路光的分法见 lamps.js
    hd.rotation.set(.2, 0, -.26);
    lamp.rig = lampBulbRig(hd, [0, -.05, 0], { down: [.89, .4], up: [.66, .6], r: .02, glowDist: 2, upShadow: false }); }
  // v：0 关、1 全亮；stage 传进来才登记灯泡大小（软影子），film.js 的 light 每帧调
  lamp.set = (v, stage) => { lamp.rig.set(v, { down: 3.2, up: .15, glow: .45 }, stage); lamp.bulb.material.color.setScalar(v > .02 ? 1.2 + 12 * v : 1.2); };
  lamp.set(0);

  // ---------- 床边地毯：燕麦色平织，炭灰和陶土色的边，花边里一圈同色的小菱形，两头流苏；地毯不是完全平的 ----------
  { const g = new THREE.PlaneGeometry(RUG.w, RUG.l, 60, 90), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), ex = Math.abs(x) / (RUG.w / 2), ey = Math.abs(y) / (RUG.l / 2);
      P.setZ(i, .004 + .006 * Math.max(0, ex * ey - .6) * 2.5 + .0015 * vn(x * 6, y * 6, 39)); }
    g.computeVertexNormals(); const m = add(g, MAT.rug, RUG.x + RUG.w / 2, 0, RUG.z + RUG.l / 2, root); m.rotation.x = -Math.PI / 2; m.rotation.z = .035; m.name = 'rug';
    const fr = new THREE.InstancedMesh(new THREE.CylinderGeometry(.0018, .0014, .045, 5), MAT.felt(0xd8ccb6), 2 * 46), q = new THREE.Object3D();
    for (let e = 0; e < 2; e++) for (let i = 0; i < 46; i++) { const u = (i + .5) / 46 - .5, side = e ? 1 : -1;
      q.position.set(u * (RUG.w - .04), .003, side * (RUG.l / 2 + .02 + r() * .004)); q.rotation.set(Math.PI / 2 + (r() - .5) * .2, 0, (r() - .5) * .35); q.updateMatrix(); fr.setMatrixAt(e * 46 + i, q.matrix); }
    const fg = group(RUG.x + RUG.w / 2, 0, RUG.z + RUG.l / 2, null, root); fg.rotation.y = .035; fg.add(fr); fr.castShadow = false; fr.receiveShadow = true; }

  return { root, bed, duvet, duvetY, pillow, cushion: cush, plush, clock, clockObj: clock.obj, bookObj: clock.book, lamp, BED, NS, RUG, tick(t) { clock.set(t, opts.clockStart ?? 16.8); } };
}

// ---------- 贴图：都在这里画 ----------
// 细皱纹的法线图：几百条两头尖的短线画在高度图上，模糊一下再求法线；四方连续
function wrinkleNormal(N, seed) {
  const r = rng(seed), H = new Float32Array(N * N);
  for (let k = 0; k < 420; k++) { const x0 = r() * N, y0 = r() * N, a = (vn(x0 / 120, y0 / 120, seed) * 2 - 1) * 2.4 + (r() - .5) * .6, L = 30 + r() * 80, R = 4 + r() * 7, A = (r() < .35 ? -1 : 1) * (.4 + r() * .6), c = Math.cos(a), d = Math.sin(a);
    for (let u = 0; u <= L; u += .7) { const cx = x0 + c * u, cy = y0 + d * u, env = Math.pow(Math.sin(Math.PI * u / L), .8);
      for (let v = -R; v <= R; v += .7) { const px = ((Math.round(cx - d * v) % N) + N) % N, py = ((Math.round(cy + c * v) % N) + N) % N; H[py * N + px] += A * env * (1 - Math.abs(v) / R) * .06; } } }
  for (let i = 0; i < N * N; i++) H[i] += (vn((i % N) / 3, Math.floor(i / N) / 3, seed + 1) - .5) * .05;
  return heightToNormal(H, N, 2.0);
}
function fleeceNormal(N, seed) { const H = new Float32Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = vn(i / 1.6, j / 1.6, seed) * .7 + vn(i / 5, j / 5, seed + 3) * .5; return heightToNormal(H, N, 1.6); }
function rugWeave(N, seed) { const H = new Float32Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = Math.sin(i / N * Math.PI * 2 * 16), b = Math.sin(j / N * Math.PI * 2 * 16); H[j * N + i] = ((Math.floor(i / 8) + Math.floor(j / 8)) % 2 ? a : b) * .5 + vn(i / 2, j / 2, seed) * .4; } return heightToNormal(H, N, 2.2); }
function heightToNormal(H, N, k) {
  const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), id = g.createImageData(N, N), at = (x, y) => H[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = (at(x + 1, y) - at(x - 1, y)) * k, dy = (at(x, y + 1) - at(x, y - 1)) * k, l = Math.hypot(dx, dy, 1), o = (y * N + x) * 4;
    id.data[o] = (-dx / l * .5 + .5) * 255; id.data[o + 1] = (dy / l * .5 + .5) * 255; id.data[o + 2] = (1 / l * .5 + .5) * 255; id.data[o + 3] = 255; }
  g.putImageData(id, 0, 0); return c;
}
// 洗过的亚麻：灰绿色，横竖都有粗细不匀的纱（竹节）
function linen(N, seed) {
  const r = rng(seed), map = document.createElement('canvas'), bump = document.createElement('canvas'); map.width = map.height = bump.width = bump.height = N;
  const g = map.getContext('2d'), b = bump.getContext('2d'); g.fillStyle = '#a9b3a1'; g.fillRect(0, 0, N, N); b.fillStyle = '#808080'; b.fillRect(0, 0, N, N);
  for (let k = 0; k < 2600; k++) { const v = r() < .5, p = r() * N, s = r() * N, L = 20 + r() * 160, wdt = .6 + r() * 1.8, l = (r() - .5) * 26;
    g.fillStyle = `rgba(${l > 0 ? '255,255,250' : '40,52,40'},${Math.abs(l) / 100})`; b.fillStyle = `rgba(${l > 0 ? '255,255,255' : '0,0,0'},${Math.abs(l) / 60})`;
    for (const o of [0, N]) { if (v) { g.fillRect(p, s - o, wdt, L); b.fillRect(p, s - o, wdt, L); } else { g.fillRect(s - o, p, L, wdt); b.fillRect(s - o, p, L, wdt); } } }
  return { map, bump };
}
// 抱枕的面料：奶油底上的细格纹（两种颜色的经纬线交叉，交叉处颜色深一点），像洗过的棉布
function cushionPrint(N) {
  return canvasTex(N, N, (g) => { g.fillStyle = '#efe7d8'; g.fillRect(0, 0, N, N); const step = N / 14;
    for (let k = 0; k < 14; k++) { const x = k * step; g.fillStyle = 'rgba(176,112,86,.20)'; g.fillRect(x, 0, step * .38, N); g.fillRect(0, x, N, step * .38);
      g.fillStyle = 'rgba(92,104,112,.22)'; g.fillRect(x + step * .62, 0, step * .06, N); g.fillRect(0, x + step * .62, N, step * .06); } }).image;
}
// 地毯：燕麦色底，外圈炭灰，里面一道陶土色的细线；两条边之间的花边里，一圈只比底色深一点的小菱形；中间是很淡的菱形格
function rugMap(W, H) {
  return canvasTex(W, H, (g) => { const r = rng(391); g.fillStyle = '#d6cab3'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 9000; k++) { g.fillStyle = `rgba(${r() < .5 ? '255,250,240' : '90,75,55'},${.05 + r() * .06})`; g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 2); }
    const b = W * .055; g.strokeStyle = '#3b3936'; g.lineWidth = b * .55; g.strokeRect(b * .5, b * .5, W - b, H - b);
    g.strokeStyle = '#b0644a'; g.lineWidth = b * .14; g.strokeRect(b * 2.3, b * 2.3, W - b * 4.6, H - b * 4.6);
    g.save(); g.globalAlpha = .22; g.fillStyle = '#7d6a50';
    const band = b * 1.6, sil = (x, y) => { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); const s = b * .3; g.fillRect(-s / 2, -s / 2, s, s); g.restore(); };
    for (let x = band; x < W - band; x += b * 1.25) { sil(x, band); sil(x, H - band); } for (let y = band + b * 1.25; y < H - band - b; y += b * 1.25) { sil(band, y); sil(W - band, y); }
    g.restore(); g.strokeStyle = 'rgba(176,100,74,.22)'; g.lineWidth = 3;
    const cx0 = b * 3.2, cy0 = b * 3.2, cw = W - b * 6.4, ch = H - b * 6.4, n = 5, dw = cw / n, dh = dw * 1.4;
    for (let y = cy0; y < cy0 + ch - 1; y += dh) for (let x = cx0; x < cx0 + cw - 1; x += dw) { g.beginPath(); g.moveTo(x + dw / 2, y); g.lineTo(x + dw, y + dh / 2); g.lineTo(x + dw / 2, y + dh); g.lineTo(x, y + dh / 2); g.closePath(); g.stroke(); } }).image;
}
