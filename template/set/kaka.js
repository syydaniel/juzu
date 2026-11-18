var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// char/rig.ts
import * as THREE2 from "three";

// char/geom.ts
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
var roundRectShape = (w, h, r) => {
  r = Math.min(r, Math.min(w, h) / 2 - 1e-4);
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
};
var smooth = (g) => {
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g.clearGroups();
  const m = mergeVertices(g, 1e-5);
  m.computeVertexNormals();
  return m;
};
var softBlock = (w, h, d, r, bevel, hole, segs = 7) => {
  const b = Math.min(bevel, d / 2 - 1e-3, r - 1e-3);
  const shape = roundRectShape(w - 2 * b, h - 2 * b, r - b);
  if (hole) {
    const hs = roundRectShape(hole.w + 2 * b, hole.h + 2 * b, hole.r + b);
    shape.holes.push(new THREE.Path(hs.getPoints(24).reverse()));
  }
  const depth = Math.max(1e-3, d - 2 * b);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: segs, curveSegments: 20, steps: 1 });
  g.translate(0, 0, -depth / 2);
  return smooth(g);
};
var makeOutlineMaterial = (color, thickness) => new THREE.ShaderMaterial({
  uniforms: { color: { value: new THREE.Color(color) }, thickness: { value: thickness } },
  vertexShader: (
    /* glsl */
    `
      uniform float thickness;
      void main() {
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        mv.xyz += n * thickness;
        gl_Position = projectionMatrix * mv;
      }`
  ),
  fragmentShader: (
    /* glsl */
    `
      uniform vec3 color;
      void main() {
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`
  ),
  side: THREE.BackSide
});
var glowTex = null;
var glowTexture = () => {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(128, 128, 2, 128, 128, 128);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.18, "rgba(255,255,255,0.55)");
  r.addColorStop(0.45, "rgba(255,255,255,0.14)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
};
var blobTex = null;
var blobTexture = () => {
  if (blobTex) return blobTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, "rgba(0,0,0,0.85)");
  r.addColorStop(0.35, "rgba(0,0,0,0.5)");
  r.addColorStop(0.7, "rgba(0,0,0,0.14)");
  r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
};
var starTex = null;
var starTexture = () => {
  if (starTex) return starTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.translate(64, 64);
  g.shadowColor = "rgba(255,255,255,0.9)";
  g.shadowBlur = 14;
  g.fillStyle = "#fff";
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 ? 17 : 40;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
  g.lineJoin = "round";
  g.lineWidth = 10;
  g.strokeStyle = "#fff";
  g.stroke();
  g.fill();
  starTex = new THREE.CanvasTexture(c);
  starTex.colorSpace = THREE.SRGBColorSpace;
  return starTex;
};
var poolTex = null;
var poolTexture = () => {
  if (poolTex) return poolTex;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  r.addColorStop(0, "rgba(255,255,255,0.30)");
  r.addColorStop(0.4, "rgba(255,255,255,0.13)");
  r.addColorStop(0.75, "rgba(255,255,255,0.035)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 512, 512);
  poolTex = new THREE.CanvasTexture(c);
  poolTex.colorSpace = THREE.SRGBColorSpace;
  return poolTex;
};
var micro = null;
var microSurface = () => {
  if (micro) return micro;
  const N2 = 512;
  const hash2 = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const vnoise = (x, y, p2) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const w = (a2) => (a2 % p2 + p2) % p2;
    const a = hash2(w(xi), w(yi)), b = hash2(w(xi + 1), w(yi)), c = hash2(w(xi), w(yi + 1)), d = hash2(w(xi + 1), w(yi + 1));
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const make = (fn) => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = N2;
    const g = cv.getContext("2d");
    const im = g.createImageData(N2, N2);
    for (let y = 0; y < N2; y++)
      for (let x = 0; x < N2; x++) {
        const v = Math.max(0, Math.min(255, Math.round(fn(x, y) * 255)));
        const i = (y * N2 + x) * 4;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
        im.data[i + 3] = 255;
      }
    g.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    t.anisotropy = 8;
    return t;
  };
  const rough = make((x, y) => 0.82 + 0.12 * vnoise(x / 64, y / 64, N2 / 64) + 0.06 * vnoise(x / 6, y / 6, N2 / 6));
  const bump = make((x, y) => 0.5 + 0.35 * (vnoise(x / 5, y / 5, N2 / 5) - 0.5) + 0.15 * (vnoise(x / 2.2, y / 2.2, Math.round(N2 / 2.2)) - 0.5));
  micro = { rough, bump };
  return micro;
};

// char/math.ts
var math_exports = {};
__export(math_exports, {
  ANTICIPATE: () => ANTICIPATE,
  E: () => E,
  bezier: () => bezier,
  clamp: () => clamp,
  hash: () => hash,
  inv: () => inv,
  lerp: () => lerp,
  noise1: () => noise1,
  pop: () => pop,
  pulse: () => pulse,
  rad: () => rad,
  spring: () => spring,
  tri: () => tri
});
var clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
var lerp = (a, b, t) => a + (b - a) * t;
var inv = (a, b, x) => clamp((x - a) / (b - a));
var rad = (d) => d * Math.PI / 180;
var bezier = (x1, y1, x2, y2) => {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    x = clamp(x);
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      const d = dx(t);
      if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    return sy(clamp(t));
  };
};
var E = {
  linear: (x) => clamp(x),
  standard: bezier(0.2, 0, 0, 1),
  enter: bezier(0.05, 0.7, 0.1, 1),
  exit: bezier(0.3, 0, 0.8, 0.15),
  inOut: bezier(0.65, 0, 0.35, 1),
  smooth: (x) => {
    x = clamp(x);
    return x * x * x * (x * (x * 6 - 15) + 10);
  },
  step: (x) => x < 0.5 ? 0 : 1
};
var ANTICIPATE = bezier(0.45, -0.28, 0.2, 1.18);
var spring = (t, freq = 2.2, zeta = 0.75) => {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq;
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + zeta * w / wd * Math.sin(wd * t));
};
var pop = (t, freq = 3.2, zeta = 0.42) => spring(t, freq, zeta);
var hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
var noise1 = (x, seed = 0) => {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 101), hash(i + 1 + seed * 101), u) * 2 - 1;
};
var pulse = (dt, attack = 0.06, release = 0.22) => {
  if (dt < 0) return 0;
  if (dt < attack) return E.smooth(dt / attack);
  const r = (dt - attack) / release;
  return Math.exp(-r * 3) * Math.cos(r * 2.2);
};
var tri = (x) => {
  const f = x - Math.floor(x);
  return f < 0.5 ? f * 4 - 1 : 3 - f * 4;
};

// char/palette.ts
var PAL_STAGE = {
  bg: "#07080B",
  bgLift: "#12151C",
  bgDeep: "#020203",
  ink: "#16181C",
  shell: "#FFFDF8",
  screen: "#121719",
  dark: "#23272B",
  eye: "#F4EFE5",
  gold: "#F2C36B",
  goldText: "#F6CB7A",
  teal: "#7FE6D8",
  tealText: "#8CEBDD",
  red: "#E8553D",
  heart: "#FF6F61",
  blush: "#FF8A7A",
  text: "#EFE8D8",
  textSoft: "rgba(239,232,216,0.62)",
  line: "rgba(239,232,216,0.16)",
  card: "#0E1116",
  chalk: "#EFE8D8",
  stage: "#3D63C9",
  leather: "#141416",
  light: false
};
var PAL_LAB = {
  ...PAL_STAGE,
  bg: "#0B1016",
  bgLift: "#17222E",
  bgDeep: "#04070A",
  gold: "#FFB23F",
  goldText: "#FFC261",
  teal: "#5CE1E6",
  tealText: "#7FEAEE",
  red: "#FF5B4A",
  green: "#4BD48A",
  text: "#EAF0F4",
  textSoft: "rgba(234,240,244,0.62)",
  line: "rgba(234,240,244,0.14)",
  card: "#101820",
  chalk: "#EAF0F4"
};
var PAL = PAL_LAB;

// char/face.ts
var SCREEN_W = 130;
var SCREEN_H = 88;
var FACE0 = {
  vis: 1,
  dot: 0,
  scan: 0,
  glow: 1,
  look: [0, 0],
  open: [1, 1],
  wide: 1,
  lidT: [0, 0],
  lidA: [0, 0],
  lidB: [0, 0],
  happy: [0, 0],
  square: 0,
  browOn: 1,
  browY: [0, 0],
  browA: [0, 0],
  mOn: 1,
  mCurve: 3.2,
  mW: 22,
  mX: 0,
  mY: 0,
  mTilt: 0,
  mO: 0,
  mOpen: 0,
  mWavy: 0,
  mSpeak: 0,
  mAI: 0,
  blush: 0,
  spiral: 0,
  heart: 0,
  sparkle: 0,
  sweat: 0,
  code: 0,
  star: 0
};
var face = (o) => ({ ...FACE0, ...o });
var PAIRS = ["look", "open", "lidT", "lidA", "lidB", "happy", "browY", "browA"];
var mixFace = (a, b, k) => {
  const out = {};
  for (const key of Object.keys(a)) {
    if (PAIRS.includes(key)) {
      const pa = a[key], pb = b[key];
      out[key] = [lerp(pa[0], pb[0], k), lerp(pa[1], pb[1], k)];
    } else {
      out[key] = lerp(a[key], b[key], k);
    }
  }
  return out;
};
var FACES = {
  neutral: FACE0,
  blink: face({ open: [0.06, 0.06] }),
  happy: face({ happy: [1, 1], open: [1.08, 1.08], browY: [3.5, 3.5], browA: [4, 4], mCurve: 7.5, mW: 34, mOpen: 0.75, mY: -1 }),
  surprised: face({ wide: 1.25, browY: [8, 8], browA: [6, 6], mO: 1, mCurve: 0, look: [0, -0.1] }),
  focus: face({ lidT: [0.36, 0.36], lidB: [0.3, 0.3], browY: [-4, -4], browA: [-14, -14], mCurve: 0.6, mW: 13, mX: 5, mTilt: 0.8, look: [0.35, 0.15] }),
  doubt: face({ lidT: [0.32, 0], open: [0.92, 1.06], browY: [-3, 8], browA: [-10, 8], mCurve: -1.5, mW: 15, mX: 12, mTilt: 2.6, look: [0.55, -0.35] }),
  sad: face({ lidT: [0.18, 0.18], lidA: [24, 24], browY: [1, 1], browA: [20, 20], mCurve: -5.5, mW: 22, mY: 2, look: [0, 0.6] }),
  dizzy: face({ spiral: 1, browY: [2, -1], browA: [16, -10], mWavy: 1, mCurve: -1, mW: 26, blush: 0 }),
  embarrassed: face({ happy: [0.45, 0.45], blush: 1, browY: [1, 1], browA: [16, 16], mWavy: 0.7, mCurve: 1, mW: 14, mY: 1, look: [-0.55, 0.45] }),
  proud: face({ lidT: [0.4, 0.4], happy: [0.35, 0.35], browY: [4, 4], browA: [-8, -8], mCurve: 7, mW: 30, mOpen: 0.45, mTilt: -1.2, sparkle: 1, look: [0, -0.15] }),
  heart: face({ heart: 1, browY: [4, 4], browA: [8, 8], mCurve: 8, mW: 32, mOpen: 0.85, blush: 0.55 }),
  wink: face({ open: [1.05, 0.5], happy: [0, 1], lidT: [0, 0], browY: [4, -1.5], browA: [4, -6], mCurve: 6.5, mW: 28, mTilt: -2.6, mX: -2, mOpen: 0.3, sparkle: 1 }),
  standby: face({ vis: 0, dot: 1, glow: 0, browOn: 0, mOn: 0 }),
  listen: face({ look: [-0.7, -0.35], wide: 1.05, browY: [6, 2.5], browA: [6, 2], mCurve: 0.6, mW: 10, mO: 0.35 }),
  speak: face({ mSpeak: 1, browY: [2.5, 2.5], mCurve: 2.5, mW: 32 }),
  code: face({ code: 1, browY: [3, 3], browA: [-6, -6], mCurve: 4.5, mW: 20, mOpen: 0.2, look: [0, -0.05] }),
  star: face({ star: 1, browY: [7, 7], browA: [6, 6], mO: 0.55, mCurve: 5, mW: 22, mOpen: 0.6, blush: 0.35, look: [0, -0.2] }),
  ai: face({ square: 1, browY: [0, 0], browA: [0, 0], mAI: 1, mCurve: 0, mW: 52, look: [0, 0] })
};
var SILENT = { open: 0, bright: 0.5, wave: null, level: 0 };
var rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${clamp(a)})`;
};
var mixHex = (h1, h2, k, a = 1) => {
  const n1 = parseInt(h1.slice(1), 16), n2 = parseInt(h2.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(lerp(n1 >> s & 255, n2 >> s & 255, clamp(k))));
  return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a)})`;
};
var roundRect = (ctx, x, y, w, h, r) => {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};
var heartPath = (ctx, cx, cy, s) => {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.95);
  ctx.bezierCurveTo(cx - s * 0.2, cy + s * 0.75, cx - s * 1.05, cy + s * 0.25, cx - s * 1, cy - s * 0.3);
  ctx.bezierCurveTo(cx - s * 0.95, cy - s * 0.95, cx - s * 0.2, cy - s * 1.05, cx, cy - s * 0.45);
  ctx.bezierCurveTo(cx + s * 0.2, cy - s * 1.05, cx + s * 0.95, cy - s * 0.95, cx + s * 1, cy - s * 0.3);
  ctx.bezierCurveTo(cx + s * 1.05, cy + s * 0.25, cx + s * 0.2, cy + s * 0.75, cx, cy + s * 0.95);
  ctx.closePath();
};
var star4 = (ctx, cx, cy, r, rot) => {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot + i * Math.PI / 4;
    const rr = i % 2 ? r * 0.28 : r;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
};
var EYE_X = 29;
var EYE_Y = -5;
var EYE_W = 23;
var EYE_H = 33;
var BROW_DY = 27;
var MOUTH_Y = 25;
var LOOK_X = 13;
var LOOK_Y = 7;
var makeFaceCanvas = (res) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(SCREEN_W * res);
  canvas.height = Math.round(SCREEN_H * res);
  const layer = document.createElement("canvas");
  layer.width = canvas.width;
  layer.height = canvas.height;
  return { canvas, layer, res };
};
var drawFace = (fc, f, t, audio = SILENT) => {
  const { canvas, layer, res } = fc;
  const ctx = canvas.getContext("2d");
  const lx = layer.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const toFu = (c) => c.setTransform(res, 0, 0, res, W / 2, H / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  lx.setTransform(1, 0, 0, 1, 0, 0);
  lx.clearRect(0, 0, W, H);
  toFu(ctx);
  toFu(lx);
  if (f.glow > 1e-3) {
    const g = ctx.createRadialGradient(0, -4, 4, 0, 0, 70);
    g.addColorStop(0, rgba(PAL.teal, 0.075 * f.glow));
    g.addColorStop(1, rgba(PAL.teal, 0.012 * f.glow));
    ctx.fillStyle = g;
    ctx.fillRect(-SCREEN_W / 2, -SCREEN_H / 2, SCREEN_W, SCREEN_H);
  }
  if (f.square > 0.01) {
    ctx.fillStyle = rgba("#FFFFFF", 0.035 * f.square);
    for (let y = -SCREEN_H / 2; y < SCREEN_H / 2; y += 2.4) ctx.fillRect(-SCREEN_W / 2, y, SCREEN_W, 0.7);
  }
  if (f.glow > 1e-3 || f.dot > 1e-3) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.13)";
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-SCREEN_W / 2 + 10, -SCREEN_H / 2 + 15);
    ctx.quadraticCurveTo(-SCREEN_W / 2 + 14, -SCREEN_H / 2 + 8, -SCREEN_W / 2 + 26, -SCREEN_H / 2 + 7);
    ctx.stroke();
    ctx.restore();
  }
  const vis = clamp(f.vis, 0, 1.4);
  const lookX = f.look[0] * LOOK_X, lookY = f.look[1] * LOOK_Y;
  if (vis > 1e-3) {
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const cx = side * EYE_X * (1 + 0.03 * (f.wide - 1)) + lookX;
      const cy = EYE_Y + lookY - (f.wide - 1) * 2;
      const op = Math.max(0, f.open[i]) * vis;
      const sqz = op > 1 ? 1 / Math.sqrt(op) : 1 + (1 - op) * 0.22;
      const spiralK = clamp(f.spiral), heartK = clamp(f.heart);
      const codeK = clamp(f.code), starK = clamp(f.star);
      const hide = Math.max(spiralK, heartK, codeK, starK);
      let w = EYE_W * Math.pow(f.wide, 0.7) * sqz * (1 + 0.1 * f.happy[i]) * (1 + 0.12 * f.square);
      let h = Math.max(2.6, EYE_H * f.wide * op) * (1 - 0.06 * f.square);
      w *= 1 - hide;
      h *= 1 - hide;
      if (w > 0.2 && h > 0.2) {
        lx.globalCompositeOperation = "source-over";
        lx.fillStyle = PAL.eye;
        const r = lerp(Math.min(w, h) / 2, 1.4, clamp(f.square));
        roundRect(lx, cx - w / 2, cy - h / 2, w, h, r);
        lx.fill();
        lx.globalCompositeOperation = "destination-out";
        lx.fillStyle = "#000";
        const out = side;
        if (f.lidT[i] > 1e-3 || Math.abs(f.lidA[i]) > 0.01) {
          const y0 = cy - h / 2 + f.lidT[i] * h;
          const k = Math.tan(f.lidA[i] * Math.PI / 180);
          const xa = cx - w, xb = cx + w;
          lx.beginPath();
          lx.moveTo(xa, y0 + k * (xa - cx) * out);
          lx.lineTo(xb, y0 + k * (xb - cx) * out);
          lx.lineTo(xb, cy - h * 2 - 10);
          lx.lineTo(xa, cy - h * 2 - 10);
          lx.closePath();
          lx.fill();
        }
        if (f.lidB[i] > 1e-3) {
          const y1 = cy + h / 2 - f.lidB[i] * h;
          lx.fillRect(cx - w, y1, w * 2, h * 2 + 10);
        }
        if (f.happy[i] > 1e-3) {
          const hh = Math.max(h, 12);
          const rx = w * 0.86, ry = hh * 0.56;
          const ey = cy + h / 2 + ry - f.happy[i] * (h * 0.74 + 2);
          lx.beginPath();
          lx.ellipse(cx, ey, rx, ry, 0, 0, Math.PI * 2);
          lx.fill();
        }
        lx.globalCompositeOperation = "source-over";
      }
      if (spiralK > 1e-3 && vis > 0.01) {
        const s = pop(spiralK * 0.6, 3, 0.4) * vis;
        lx.save();
        lx.translate(cx, cy);
        lx.rotate(-t * 9 * side);
        lx.strokeStyle = PAL.eye;
        lx.lineWidth = 2.7;
        lx.lineCap = "round";
        lx.beginPath();
        const turns = 2.6, R = 13.5 * s;
        for (let k = 0; k <= 90; k++) {
          const u = k / 90;
          const a = u * turns * Math.PI * 2;
          const rr = 1 + u * R;
          const x = Math.cos(a) * rr * side, y = Math.sin(a) * rr;
          if (k) lx.lineTo(x, y);
          else lx.moveTo(x, y);
        }
        lx.stroke();
        lx.restore();
      }
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.shadowColor = rgba(PAL.eye, 0.55);
    ctx.shadowBlur = 4.5 * res;
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
    toFu(ctx);
    if (f.code > 1e-3) {
      const s = pop(clamp(f.code) * 0.7, 3, 0.42) * vis;
      ctx.save();
      ctx.shadowColor = rgba(PAL.eye, 0.75);
      ctx.shadowBlur = 5 * res;
      ctx.strokeStyle = PAL.eye;
      ctx.lineWidth = 6.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const cx = side * EYE_X + lookX, cy = EYE_Y + lookY;
        const hw = 8.5 * s, hh = 13 * s;
        ctx.beginPath();
        ctx.moveTo(cx - side * hw, cy - hh);
        ctx.lineTo(cx + side * hw, cy);
        ctx.lineTo(cx - side * hw, cy + hh);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (f.star > 1e-3) {
      const s = pop(clamp(f.star) * 0.7, 2.8, 0.38) * vis;
      ctx.save();
      ctx.shadowColor = rgba(PAL.gold, 0.95);
      ctx.shadowBlur = 7 * res;
      ctx.fillStyle = "#FFF1CF";
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const tw = 1 + 0.08 * Math.sin(t * 7 + i * 1.7);
        star4(ctx, side * EYE_X + lookX, EYE_Y + lookY, 17 * s * tw, Math.sin(t * 1.3 + i) * 0.18 - Math.PI / 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (f.heart > 1e-3) {
      const beat = 1 + 0.07 * Math.max(0, Math.sin(t * Math.PI * 2 * 1.6)) ** 6;
      const s = pop(clamp(f.heart) * 0.7, 2.8, 0.38) * beat * vis;
      ctx.save();
      ctx.shadowColor = rgba(PAL.heart, 0.8);
      ctx.shadowBlur = 6 * res;
      ctx.fillStyle = PAL.heart;
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        heartPath(ctx, side * EYE_X + lookX, EYE_Y + lookY - 1, 13.5 * s);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = rgba("#FFFFFF", 0.55 * clamp(f.heart));
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        ctx.beginPath();
        ctx.ellipse(side * EYE_X + lookX - 6 * s, EYE_Y + lookY - 7 * s, 2.6 * s, 1.7 * s, -0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (f.browOn > 1e-3) {
      ctx.save();
      ctx.shadowColor = rgba(PAL.eye, 0.45);
      ctx.shadowBlur = 3.5 * res;
      ctx.strokeStyle = rgba(PAL.eye, 0.95 * clamp(f.browOn) * clamp(vis));
      ctx.lineWidth = 4.2 * (1 - 0.15 * f.square);
      ctx.lineCap = f.square > 0.5 ? "butt" : "round";
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const bx = side * EYE_X + lookX * 0.85;
        const by = EYE_Y - BROW_DY - f.browY[i] + lookY * 0.75 - (f.wide - 1) * 14;
        const L = 17 * clamp(f.browOn) * (1 + 0.15 * f.square);
        const a = f.browA[i] * Math.PI / 180;
        const inX = bx - side * Math.cos(a) * (L / 2), inY = by - Math.sin(a) * (L / 2);
        const outX = bx + side * Math.cos(a) * (L / 2), outY = by + Math.sin(a) * (L / 2);
        const bend = 2.2 * (1 - f.square);
        ctx.beginPath();
        ctx.moveTo(outX, outY);
        ctx.quadraticCurveTo(bx - Math.sin(a) * 0, by - bend, inX, inY);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  if (f.mOn * vis > 1e-3) {
    const N2 = 72;
    const sp = clamp(f.mSpeak), ai = clamp(f.mAI);
    const ao = clamp(audio.open) * sp;
    const bright = audio.bright ?? 0.5;
    let width = lerp(f.mW, 15, clamp(f.mO));
    width *= 1 + sp * (0.16 * (bright - 0.5) + 0.12 * ao);
    width = lerp(width, 54, ai * 0) * clamp(f.mOn) * Math.min(1, vis);
    const half = width / 2;
    const mx = f.mX + lookX * 0.6, my = MOUTH_Y + f.mY + lookY * 0.6;
    const A = ao * 10;
    const up = f.mO * 6.2 + f.mOpen * 0.8 + A * 0.55;
    const dn = f.mO * 6.2 + f.mOpen * 7.5 + A * 1;
    const wave = audio.wave;
    const wv = (u) => {
      if (!wave) return 0;
      const p2 = (u + 1) / 2 * (wave.length - 1);
      const i = Math.floor(p2), k = p2 - i;
      const a = wave[i] ?? 0, b = wave[Math.min(wave.length - 1, i + 1)] ?? 0;
      return (a + (b - a) * k) / 100;
    };
    const ups = [], dns = [], trace = [];
    const tr = Math.max(sp, ai);
    for (let k = 0; k <= N2; k++) {
      const u = -1 + 2 * k / N2;
      const x = mx + u * half;
      const q = 1 - u * u;
      const base = my + f.mCurve * q - f.mCurve * 0.35 + f.mTilt * u;
      const env = lerp(Math.pow(Math.max(0, q), 0.85), Math.sqrt(Math.max(0, q)), clamp(f.mO));
      const wavy = f.mWavy * 1.7 * Math.sin(u * Math.PI * 3 + t * 7) * Math.sqrt(Math.max(0, q));
      const sine = ai * 5.2 * Math.sin(u * Math.PI * 2 * 2.5 - t * Math.PI * 2 * 2.5);
      const c = wavy + sine;
      ups.push([x, base - env * up + c]);
      dns.push([x, base + env * dn + c]);
      const mid = base + env * (dn - up) * 0.5;
      const amp = env * ((up + dn) * 0.5) * 0.9;
      trace.push([x, mid + amp * wv(u) * sp + c]);
    }
    const gold = ai > 0 ? mixHex(PAL.gold, PAL.red, ai) : PAL.gold;
    const glowCol = ai > 0 ? mixHex(PAL.gold, PAL.red, ai, 0.85) : rgba(PAL.gold, 0.85);
    const smoothPath = (pts, close) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length - 1; k++) {
        ctx.quadraticCurveTo(pts[k][0], pts[k][1], (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2);
      }
      ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      if (close) ctx.closePath();
    };
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const opening = Math.max(up, dn);
    smoothPath([...ups, ...dns.slice().reverse()], true);
    if (opening > 0.6) {
      ctx.fillStyle = ai > 0 ? mixHex(PAL.gold, PAL.red, ai, 0.2) : rgba(PAL.gold, (0.2 - 0.06 * sp) * clamp(opening / 4));
      ctx.fill();
    }
    const rimA = 1 - 0.7 * tr;
    ctx.globalAlpha = rimA;
    ctx.shadowColor = glowCol;
    ctx.shadowBlur = 5 * res;
    ctx.strokeStyle = gold;
    ctx.lineWidth = lerp(3.1, 2.2, tr);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = ai > 0 ? mixHex("#FFE7B0", "#FF9A85", ai) : "#FFE3A6";
    ctx.lineWidth = 1.3;
    ctx.stroke();
    if (tr > 1e-3) {
      ctx.globalAlpha = tr;
      smoothPath(trace, false);
      ctx.shadowColor = glowCol;
      ctx.shadowBlur = 5 * res;
      ctx.strokeStyle = gold;
      ctx.lineWidth = 3.1;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = ai > 0 ? mixHex("#FFE7B0", "#FF9A85", ai) : "#FFE3A6";
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
    ctx.restore();
  }
  if (f.blush > 1e-3 && vis > 0.01) {
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const bx = side * 44 + lookX * 0.7, by = 12 + lookY * 0.6;
      const g = ctx.createRadialGradient(bx, by, 0.5, bx, by, 11);
      g.addColorStop(0, rgba(PAL.blush, 0.6 * f.blush));
      g.addColorStop(1, rgba(PAL.blush, 0));
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(1, 0.55);
      ctx.translate(-bx, -by);
      ctx.beginPath();
      ctx.arc(bx, by, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = rgba("#FFB3A8", 0.9 * f.blush);
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(bx + k * 4.2 - 1.6, by + 2.4);
        ctx.lineTo(bx + k * 4.2 + 1.6, by - 2.4);
        ctx.stroke();
      }
    }
  }
  if (f.sparkle > 1e-3 && vis > 0.01) {
    const s = pop(clamp(f.sparkle) * 0.7, 3, 0.4);
    const tw = 0.85 + 0.15 * Math.sin(t * 9);
    ctx.save();
    ctx.shadowColor = rgba(PAL.gold, 0.9);
    ctx.shadowBlur = 4 * res;
    ctx.fillStyle = "#FFF3D6";
    star4(ctx, 50, -27, 6.5 * s * tw, t * 0.8);
    ctx.fill();
    star4(ctx, 57, -16, 3 * s * tw, -t);
    ctx.fill();
    ctx.restore();
  }
  if (f.sweat > 1e-3 && vis > 0.01) {
    const s = clamp(f.sweat);
    ctx.save();
    ctx.fillStyle = rgba(PAL.teal, 0.85 * s);
    ctx.shadowColor = rgba(PAL.teal, 0.7);
    ctx.shadowBlur = 3 * res;
    const sx = 52, sy = -24 + 6 * s;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 6);
    ctx.quadraticCurveTo(sx + 4.2, sy + 1, sx, sy + 3.5);
    ctx.quadraticCurveTo(sx - 4.2, sy + 1, sx, sy - 6);
    ctx.fill();
    ctx.restore();
  }
  if (f.dot > 1e-3) {
    const p2 = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.8);
    ctx.save();
    ctx.shadowColor = rgba(PAL.eye, 0.7);
    ctx.shadowBlur = 5 * res;
    ctx.fillStyle = rgba(PAL.eye, (0.3 + 0.55 * p2) * clamp(f.dot));
    ctx.beginPath();
    ctx.arc(0, 0, 2.9 + 0.5 * p2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (f.scan > 1e-3) {
    const w = 96 * clamp(f.scan, 0, 1.2);
    ctx.save();
    ctx.shadowColor = rgba(PAL.eye, 0.8);
    ctx.shadowBlur = 6 * res;
    ctx.fillStyle = rgba(PAL.eye, 0.95);
    roundRect(ctx, -w / 2, -1.4, w, 2.8, 1.4);
    ctx.fill();
    ctx.restore();
  }
};

// char/rig.ts
var DIM = {
  LEG: 0.5,
  HIP_X: 0.22,
  BW: 1.08,
  BH: 0.96,
  BD: 0.76,
  HW: 1.72,
  HH: 1.26,
  HD: 1,
  NECK: 0.12,
  UA: 0.5,
  FA: 0.46,
  // 上臂、前臂：再短就够不到脸、比不了心
  ANT: 0.38
};
var REST_ARM = [12, 8, 8, 10];
var STATE0 = {
  t: 0,
  x: 0,
  z: 0,
  hop: 0,
  yaw: 0,
  legK: [1, 1],
  footLift: [0, 0],
  body: [0, 0, 0],
  head: [0, 0, 0],
  armL: REST_ARM,
  armR: REST_ARM,
  thumb: [0, 0],
  antenna: [0, 0],
  ears: [0, 0],
  face: FACE0,
  audio: SILENT,
  rec: 0,
  meter: [0, 0, 0],
  earGlow: 0,
  listen: 0,
  stars: 0,
  shadow: 1,
  click: 0
};
var TUBE_SEG = 26;
var TUBE_RAD = 12;
var makeRig = (opt = {}) => {
  const { outlineWidth = 0.03, faceRes = 8, shadows = true, costume = "none", clicker = false } = opt;
  const jacket = costume === "jacket";
  const outlines = [];
  const inkMat = makeOutlineMaterial(PAL.ink, outlineWidth);
  const inkThin = makeOutlineMaterial(PAL.ink, outlineWidth * 0.75);
  const addInk = (m, thin = false) => {
    const o = new THREE2.Mesh(m.geometry, thin ? inkThin : inkMat);
    o.castShadow = false;
    o.receiveShadow = false;
    m.add(o);
    outlines.push(o);
    return o;
  };
  const cast = (m) => {
    m.castShadow = shadows;
    m.receiveShadow = shadows;
    return m;
  };
  const ms = microSurface();
  const shell = new THREE2.MeshPhysicalMaterial({
    color: "#EFE9DF",
    roughness: 0.5,
    roughnessMap: ms.rough,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.07,
    bumpMap: ms.bump,
    bumpScale: 0.6,
    ior: 1.48,
    specularIntensity: 0.85,
    envMapIntensity: 1.25,
    sheen: 0.4,
    sheenColor: new THREE2.Color("#FFF3E6"),
    sheenRoughness: 0.5
  });
  const darkMat = new THREE2.MeshPhysicalMaterial({ color: PAL.dark, roughness: 0.32, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const screenMat = new THREE2.MeshPhysicalMaterial({ color: "#0B1012", roughness: 0.1, metalness: 0, specularIntensity: 0.4, clearcoat: 0.45, clearcoatRoughness: 0.035, envMapIntensity: 0.3 });
  const redMat = new THREE2.MeshPhysicalMaterial({ color: PAL.red, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.1 });
  const leather = new THREE2.MeshPhysicalMaterial({ color: "#141416", roughness: 0.42, metalness: 0.05, clearcoat: 0.55, clearcoatRoughness: 0.35, sheen: 0.6, sheenColor: new THREE2.Color("#8C93A8"), sheenRoughness: 0.5 });
  const zipMat = new THREE2.MeshPhysicalMaterial({ color: "#B9BCC2", roughness: 0.22, metalness: 0.9 });
  const root = new THREE2.Group();
  const ground = new THREE2.Group();
  const hip = new THREE2.Group();
  hip.rotation.order = "YXZ";
  root.add(hip);
  const { BW, BH, BD, HW, HH, HD } = DIM;
  const bodyY = BH / 2 - 0.06;
  const body = cast(new THREE2.Mesh(softBlock(BW, BH, BD, 0.32, 0.14), shell));
  body.position.y = bodyY;
  hip.add(body);
  addInk(body);
  const lights = [];
  const lightGlows = [];
  const socketGeo = new THREE2.CylinderGeometry(0.072, 0.072, 0.03, 32);
  socketGeo.rotateX(Math.PI / 2);
  const domeGeo = new THREE2.SphereGeometry(0.056, 24, 16);
  domeGeo.scale(1, 1, 0.5);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.18;
    const y = bodyY - BH * 0.05;
    const socket = new THREE2.Mesh(socketGeo, darkMat);
    const fz = jacket ? 0.07 : 0;
    socket.position.set(x, y, BD / 2 - 5e-3 + fz);
    hip.add(socket);
    const mat = new THREE2.MeshPhysicalMaterial({ color: "#2B3034", roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, emissive: new THREE2.Color(PAL.gold), emissiveIntensity: 0 });
    const dome = new THREE2.Mesh(domeGeo, mat);
    dome.position.set(x, y, BD / 2 + 0.012 + fz);
    hip.add(dome);
    lights.push(mat);
    const gl = new THREE2.Sprite(new THREE2.SpriteMaterial({ map: glowTexture(), color: PAL.gold, transparent: true, opacity: 0, depthWrite: false, blending: THREE2.AdditiveBlending, toneMapped: false }));
    gl.scale.setScalar(0.42);
    gl.position.set(x, y, BD / 2 + 0.06 + fz);
    hip.add(gl);
    lightGlows.push(gl);
  }
  if (jacket) {
    const JW = BW + 0.07, JD = BD + 0.07, JH = BH * 0.98;
    const jy = bodyY + 0.012;
    const coat = cast(new THREE2.Mesh(softBlock(JW, JH, JD, 0.33, 0.15), leather));
    coat.position.y = jy;
    hip.add(coat);
    addInk(coat);
    const top = jy + JH / 2 - 0.05, bot = jy - JH / 2 + 0.07;
    const vShape = new THREE2.Shape();
    const tw = 0.4, bw = 0.27, rr = 0.05;
    vShape.moveTo(-tw + rr, top);
    vShape.lineTo(tw - rr, top);
    vShape.quadraticCurveTo(tw, top, tw - 0.01, top - rr);
    vShape.lineTo(bw, bot + rr);
    vShape.quadraticCurveTo(bw - 5e-3, bot, bw - rr, bot);
    vShape.lineTo(-bw + rr, bot);
    vShape.quadraticCurveTo(-bw + 5e-3, bot, -bw, bot + rr);
    vShape.lineTo(-tw + 0.01, top - rr);
    vShape.quadraticCurveTo(-tw, top, -tw + rr, top);
    const shirt = cast(new THREE2.Mesh(new THREE2.ExtrudeGeometry(vShape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 8 }), shell));
    shirt.position.z = JD / 2 - 0.012;
    hip.add(shirt);
    for (const side of [-1, 1]) {
      const s = new THREE2.Shape();
      s.moveTo(side * (tw - 0.02), top + 0.02);
      s.lineTo(side * (tw + 0.17), top - 0.02);
      s.lineTo(side * (tw + 0.05), top - 0.2);
      s.lineTo(side * (bw + 0.04), bot + 0.2);
      s.lineTo(side * (bw - 0.01), bot + 0.16);
      s.lineTo(side * (tw - 0.06), top - 0.06);
      s.closePath();
      const g = new THREE2.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 4 });
      const lap = cast(new THREE2.Mesh(g, leather));
      lap.position.z = JD / 2 + 2e-3;
      hip.add(lap);
      addInk(lap, true);
      const zip = new THREE2.Mesh(new THREE2.BoxGeometry(0.016, (top - bot) * 0.5, 0.014), zipMat);
      zip.position.set(side * (bw + 0.035), bot + (top - bot) * 0.27, JD / 2 + 0.02);
      zip.rotation.z = side * -0.12;
      hip.add(zip);
    }
    const collar = cast(new THREE2.Mesh(new THREE2.TorusGeometry(0.21, 0.06, 14, 40), leather));
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, BH - 0.06, -0.05);
    collar.scale.set(1.3, 1, 0.85);
    hip.add(collar);
    addInk(collar, true);
  }
  const neck = new THREE2.Group();
  neck.rotation.order = "YXZ";
  neck.position.y = BH - 0.1;
  hip.add(neck);
  const neckMesh = cast(new THREE2.Mesh(new THREE2.CylinderGeometry(0.1, 0.12, 0.34, 24), darkMat));
  neckMesh.position.y = 0.1;
  neck.add(neckMesh);
  const head = new THREE2.Group();
  head.position.y = 0.16 + HH / 2;
  neck.add(head);
  const headBevel = 0.16;
  const headMesh = cast(new THREE2.Mesh(softBlock(HW, HH, HD, 0.44, headBevel), shell));
  head.add(headMesh);
  addInk(headMesh);
  const capW = HW - 2 * headBevel, capH = HH - 2 * headBevel, capR = 0.44 - headBevel;
  const scrW = SCREEN_W / 100, scrH = SCREEN_H / 100;
  const rb = 0.02;
  const ring = cast(new THREE2.Mesh(softBlock(capW, capH, 0.07, capR, rb, { w: scrW - 2 * rb, h: scrH - 2 * rb, r: 0.2 }), shell));
  ring.position.z = HD / 2 + 5e-3;
  head.add(ring);
  const screenGeo = new THREE2.ExtrudeGeometry(roundRectShape(scrW + 0.04, scrH + 0.04, 0.24), { depth: 0.03, bevelEnabled: false, curveSegments: 20 });
  const screen = new THREE2.Mesh(screenGeo, screenMat);
  screen.receiveShadow = false;
  screen.position.z = HD / 2 - 0.016;
  head.add(screen);
  const faceCanvas = makeFaceCanvas(faceRes);
  const faceTex = new THREE2.CanvasTexture(faceCanvas.canvas);
  faceTex.colorSpace = THREE2.SRGBColorSpace;
  faceTex.anisotropy = 8;
  const faceMesh = new THREE2.Mesh(
    new THREE2.PlaneGeometry(scrW, scrH),
    new THREE2.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false, blending: THREE2.AdditiveBlending, toneMapped: false })
  );
  faceMesh.position.z = HD / 2 + 0.017;
  faceMesh.renderOrder = 2;
  head.add(faceMesh);
  const earRingMats = [];
  const earGlows = [];
  const makeEar = (side) => {
    const g = new THREE2.Group();
    g.position.set(side * (HW / 2 - 0.03), -0.06, 0.02);
    const shellGeo = softBlock(0.4, 0.62, 0.26, 0.19, 0.09);
    shellGeo.rotateY(Math.PI / 2);
    const earShell = cast(new THREE2.Mesh(shellGeo, shell));
    earShell.position.x = side * 0.1;
    g.add(earShell);
    addInk(earShell);
    const ringMat = new THREE2.MeshPhysicalMaterial({ color: PAL.shell, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, emissive: new THREE2.Color(PAL.teal), emissiveIntensity: 0 });
    const ringGeo = softBlock(0.21, 0.42, 0.03, 0.105, 0.012);
    ringGeo.rotateY(Math.PI / 2);
    const rm = new THREE2.Mesh(ringGeo, ringMat);
    rm.position.x = side * (0.1 + 0.13);
    g.add(rm);
    earRingMats.push(ringMat);
    const padGeo = softBlock(0.13, 0.34, 0.05, 0.065, 0.02);
    padGeo.rotateY(Math.PI / 2);
    const pad = cast(new THREE2.Mesh(padGeo, redMat));
    pad.position.x = side * (0.1 + 0.145);
    g.add(pad);
    const glow = new THREE2.Sprite(new THREE2.SpriteMaterial({ map: glowTexture(), color: PAL.teal, transparent: true, opacity: 0, depthWrite: false, blending: THREE2.AdditiveBlending, toneMapped: false }));
    glow.scale.set(0.7, 0.95, 1);
    glow.position.x = side * 0.3;
    g.add(glow);
    earGlows.push(glow);
    head.add(g);
    return g;
  };
  const earL = makeEar(-1);
  const earR = makeEar(1);
  const antenna = new THREE2.Group();
  antenna.rotation.order = "XZY";
  antenna.position.y = HH / 2 - 0.02;
  head.add(antenna);
  const base = cast(new THREE2.Mesh(new THREE2.CylinderGeometry(0.08, 0.1, 0.07, 24), darkMat));
  base.position.y = 0.01;
  antenna.add(base);
  const stalkGeo = new THREE2.CylinderGeometry(0.024, 0.028, DIM.ANT, 12);
  stalkGeo.translate(0, DIM.ANT / 2, 0);
  const stalk = cast(new THREE2.Mesh(stalkGeo, darkMat));
  antenna.add(stalk);
  const bulbMat = new THREE2.MeshPhysicalMaterial({ color: PAL.red, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06, emissive: new THREE2.Color("#FF4A30"), emissiveIntensity: 0 });
  const bulb = cast(new THREE2.Mesh(new THREE2.SphereGeometry(0.105, 32, 24), bulbMat));
  bulb.position.y = DIM.ANT + 0.085;
  antenna.add(bulb);
  addInk(bulb, true);
  const bulbGlow = new THREE2.Sprite(new THREE2.SpriteMaterial({ map: glowTexture(), color: "#FF5A3C", transparent: true, opacity: 0, depthWrite: false, blending: THREE2.AdditiveBlending, toneMapped: false }));
  bulbGlow.scale.setScalar(0.9);
  bulbGlow.position.y = DIM.ANT + 0.085;
  antenna.add(bulbGlow);
  const makeArm = () => {
    const n = (TUBE_SEG + 1) * (TUBE_RAD + 1);
    const geo = new THREE2.BufferGeometry();
    geo.setAttribute("position", new THREE2.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute("normal", new THREE2.BufferAttribute(new Float32Array(n * 3), 3));
    const idx = [];
    for (let i = 0; i < TUBE_SEG; i++)
      for (let j = 0; j < TUBE_RAD; j++) {
        const a = i * (TUBE_RAD + 1) + j, b = a + TUBE_RAD + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    geo.setIndex(idx);
    const tube = cast(new THREE2.Mesh(geo, jacket ? leather : shell));
    tube.frustumCulled = false;
    hip.add(tube);
    const o = addInk(tube, true);
    o.frustumCulled = false;
    const hand = cast(new THREE2.Mesh(new THREE2.SphereGeometry(0.125, 32, 24), shell));
    hip.add(hand);
    addInk(hand, true);
    const thumb = new THREE2.Group();
    const tm = cast(new THREE2.Mesh(new THREE2.CapsuleGeometry(0.058, 0.1, 6, 16), shell));
    tm.position.y = 0.075;
    thumb.add(tm);
    addInk(tm, true);
    hand.add(thumb);
    return { tube, geo, hand, thumb };
  };
  const arms = [makeArm(), makeArm()];
  let clickLed = null;
  let clickGlow = null;
  if (clicker) {
    const g = new THREE2.Group();
    const bodyM = cast(new THREE2.Mesh(new THREE2.CapsuleGeometry(0.045, 0.2, 6, 16), darkMat));
    bodyM.rotation.z = Math.PI / 2;
    g.add(bodyM);
    addInk(bodyM, true);
    clickLed = new THREE2.MeshPhysicalMaterial({ color: "#3A2A1A", roughness: 0.2, clearcoat: 1, emissive: new THREE2.Color(PAL.gold), emissiveIntensity: 0.2 });
    const led = new THREE2.Mesh(new THREE2.SphereGeometry(0.022, 16, 12), clickLed);
    led.position.set(0.13, 0.02, 0.03);
    g.add(led);
    clickGlow = new THREE2.Sprite(new THREE2.SpriteMaterial({ map: glowTexture(), color: PAL.gold, transparent: true, opacity: 0, depthWrite: false, blending: THREE2.AdditiveBlending, toneMapped: false }));
    clickGlow.scale.setScalar(0.28);
    clickGlow.position.copy(led.position);
    g.add(clickGlow);
    g.position.set(0.06, -0.02, 0.1);
    g.rotation.set(0, -0.5, 0.35);
    arms[1].hand.add(g);
  }
  const legs = [];
  const feet = [];
  const legGeo = new THREE2.CylinderGeometry(0.062, 0.062, 1, 20);
  legGeo.translate(0, -0.5, 0);
  const footGeo = softBlock(0.3, 0.19, 0.44, 0.13, 0.085);
  footGeo.translate(0, 0.095, 0);
  for (const side of [-1, 1]) {
    const leg = cast(new THREE2.Mesh(legGeo, shell));
    root.add(leg);
    addInk(leg, true);
    legs.push(leg);
    const foot = cast(new THREE2.Mesh(footGeo, darkMat));
    root.add(foot);
    addInk(foot, true);
    feet.push(foot);
    void side;
  }
  const arcs = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE2.Mesh(
      new THREE2.RingGeometry(0.93, 1, 48, 1, -Math.PI * 0.32, Math.PI * 0.64),
      new THREE2.MeshBasicMaterial({ color: PAL.teal, transparent: true, opacity: 0, depthWrite: false, blending: PAL.light ? THREE2.NormalBlending : THREE2.AdditiveBlending, toneMapped: false, side: THREE2.DoubleSide })
    );
    head.add(m);
    arcs.push(m);
  }
  const stars = [];
  for (let i = 0; i < 3; i++) {
    const s = new THREE2.Sprite(new THREE2.SpriteMaterial({ map: starTexture(), color: i === 1 ? PAL.red : PAL.gold, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    s.scale.setScalar(0.2);
    head.add(s);
    stars.push(s);
  }
  const pool = new THREE2.Mesh(new THREE2.PlaneGeometry(4.6, 4.6), new THREE2.MeshBasicMaterial({ map: poolTexture(), color: "#FFE2B8", transparent: true, depthWrite: false, blending: THREE2.AdditiveBlending, toneMapped: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 1e-3;
  if (!PAL.light) ground.add(pool);
  const blob = new THREE2.Mesh(new THREE2.PlaneGeometry(1.9, 1.1), new THREE2.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.9 }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 4e-3;
  ground.add(blob);
  if (shadows) {
    const catcher = new THREE2.Mesh(new THREE2.PlaneGeometry(14, 14), new THREE2.ShadowMaterial({ opacity: 0.42 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.y = 6e-3;
    catcher.receiveShadow = true;
    ground.add(catcher);
  }
  const setOutline = (on) => outlines.forEach((o) => o.visible = on);
  setOutline(opt.outline ?? true);
  return { root, ground, hip, neck, head, antenna, earL, earR, arms, legs, feet, lights, lightGlows, bulbMat, bulbGlow, earRingMats, earGlows, arcs, stars, blob, faceCanvas, faceTex, outlines, setOutline, clickLed, clickGlow };
};
var v3 = new THREE2.Vector3();
var dirOf = (a, f, side, out) => {
  const ar = rad(a), fr = rad(f);
  out.set(side * Math.sin(ar) * Math.cos(fr), -Math.cos(ar) * Math.cos(fr), Math.sin(fr));
  return out.normalize();
};
var P0 = new THREE2.Vector3();
var P1 = new THREE2.Vector3();
var P2 = new THREE2.Vector3();
var T = new THREE2.Vector3();
var N = new THREE2.Vector3();
var B = new THREE2.Vector3();
var Q = new THREE2.Vector3();
var tmp = new THREE2.Vector3();
var updateTube = (geo, s, e, h, r0, r1) => {
  const pos = geo.getAttribute("position");
  const nor = geo.getAttribute("normal");
  N.subVectors(e, s).cross(tmp.subVectors(h, e));
  if (N.lengthSq() < 1e-8) N.set(0, 0, 1);
  N.normalize();
  for (let i = 0; i <= TUBE_SEG; i++) {
    const u = i / TUBE_SEG;
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    Q.set(a * s.x + b * e.x + c * h.x, a * s.y + b * e.y + c * h.y, a * s.z + b * e.z + c * h.z);
    T.set(2 * (1 - u) * (e.x - s.x) + 2 * u * (h.x - e.x), 2 * (1 - u) * (e.y - s.y) + 2 * u * (h.y - e.y), 2 * (1 - u) * (e.z - s.z) + 2 * u * (h.z - e.z)).normalize();
    B.crossVectors(T, N).normalize();
    const nn = tmp.crossVectors(B, T).normalize();
    const r = lerp(r0, r1, u);
    for (let j = 0; j <= TUBE_RAD; j++) {
      const phi = j / TUBE_RAD * Math.PI * 2;
      const cx = Math.cos(phi), sx = Math.sin(phi);
      const nx = cx * nn.x + sx * B.x, ny = cx * nn.y + sx * B.y, nz = cx * nn.z + sx * B.z;
      const k = i * (TUBE_RAD + 1) + j;
      pos.setXYZ(k, Q.x + nx * r, Q.y + ny * r, Q.z + nz * r);
      nor.setXYZ(k, nx, ny, nz);
    }
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  geo.computeBoundingSphere();
};
var applyState = (rig, S) => {
  const { BW, BH, HH, HW } = DIM;
  rig.root.position.set(S.x, S.hop, S.z);
  rig.root.rotation.y = rad(S.yaw);
  rig.ground.position.set(S.x, 0, S.z);
  const legL = DIM.LEG * S.legK[0], legR = DIM.LEG * S.legK[1];
  const hipY = (legL + legR) / 2;
  rig.hip.position.set(0, hipY, 0);
  rig.hip.rotation.set(rad(S.body[1]), rad(S.body[2]), -rad(S.body[0]));
  rig.neck.rotation.set(rad(S.head[1]), rad(S.head[2]), -rad(S.head[0]));
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const lift = S.footLift[i];
    const top = hipY + 0.06;
    const bottom = lift + 0.12;
    rig.legs[i].position.set(side * DIM.HIP_X, top, 0);
    rig.legs[i].scale.set(1, Math.max(0.02, top - bottom), 1);
    rig.feet[i].position.set(side * DIM.HIP_X, lift, 0.05);
  }
  const shY = BH - 0.06 - 0.3;
  const armsP = [S.armL, S.armR];
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const [a0, a1, f0, f1] = armsP[i];
    P0.set(side * (BW / 2 - 0.07), shY, 0);
    P1.copy(P0).addScaledVector(dirOf(a0, f0, side, v3), DIM.UA);
    P2.copy(P1).addScaledVector(dirOf(a0 + a1, f1, side, v3), DIM.FA);
    updateTube(rig.arms[i].geo, P0, P1, P2, 0.062, 0.053);
    rig.arms[i].hand.position.copy(P2);
    const th = clamp(S.thumb[i], 0, 1.3);
    rig.arms[i].thumb.visible = th > 0.01;
    rig.arms[i].thumb.scale.set(1, Math.max(0.01, th), 1);
    rig.arms[i].thumb.position.set(side * -0.02, 0.07, 0.04);
    rig.arms[i].thumb.rotation.set(0.25, 0, side * 0.15);
  }
  rig.antenna.rotation.set(rad(S.antenna[1]), 0, -rad(S.antenna[0]));
  rig.earL.rotation.set(0, 0, -rad(S.ears[0]));
  rig.earR.rotation.set(0, 0, -rad(S.ears[1]));
  rig.bulbMat.emissiveIntensity = 0.15 + 2.6 * S.rec;
  rig.bulbGlow.material.opacity = 0.85 * S.rec;
  rig.bulbGlow.scale.setScalar(0.55 + 0.5 * S.rec);
  for (let i = 0; i < 3; i++) {
    const v = clamp(S.meter[i]);
    rig.lights[i].emissiveIntensity = 2.4 * v;
    rig.lights[i].color.set(v > 0.05 ? "#5A4524" : "#2B3034");
    rig.lightGlows[i].material.opacity = 0.75 * v;
  }
  for (let i = 0; i < 2; i++) {
    rig.earRingMats[i].emissiveIntensity = 2.2 * S.earGlow;
    rig.earGlows[i].material.opacity = 0.55 * S.earGlow;
  }
  rig.arcs.forEach((m, i) => {
    const ph = (S.t * 1.25 + i / 3) % 1;
    const r = lerp(0.62, 0.2, ph);
    m.scale.set(r, r, 1);
    m.position.set(HW / 2 + 0.34 + r * 0.55, -0.06, 0.12);
    m.rotation.set(0, 0, Math.PI);
    m.material.opacity = S.listen * Math.sin(ph * Math.PI) * 0.95;
    m.visible = S.listen > 0.01;
  });
  rig.stars.forEach((s, i) => {
    const a = S.t * 4.2 + i * Math.PI * 2 / 3;
    const k = pop(clamp(S.stars) * 0.7, 3, 0.45);
    s.position.set(Math.cos(a) * 0.62 * k, HH / 2 + 0.2 + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.45 * k);
    s.scale.setScalar(0.19 * k * (0.85 + 0.15 * Math.sin(S.t * 11 + i)));
    s.material.opacity = clamp(S.stars);
    s.visible = S.stars > 0.01;
  });
  const air = clamp(S.hop / 1.2);
  rig.blob.scale.set(1 - air * 0.45, 1 - air * 0.45, 1);
  rig.blob.material.opacity = 0.9 * (1 - air * 0.7) * S.shadow;
  if (rig.clickLed && rig.clickGlow) {
    rig.clickLed.emissiveIntensity = 0.2 + 3 * clamp(S.click);
    rig.clickGlow.material.opacity = 0.9 * clamp(S.click);
  }
  drawFace(rig.faceCanvas, S.face, S.t, S.audio);
  rig.faceTex.needsUpdate = true;
};

// char/poses.ts
var REST = [12, 8, 8, 10];
var P02 = { lean: 0, bow: 0, twist: 0, hRoll: 0, hPitch: 0, hYaw: 0, aL: REST, aR: REST, thumbL: 0, thumbR: 0, crouch: 0, x: 0, z: 0 };
var p = (o) => ({ ...P02, ...o });
var POSES = {
  stand: P02,
  happy: p({ bow: -3, lean: -1.5, hRoll: 6, hPitch: -5, aL: [30, 22, 12, 18], aR: [26, 18, 10, 14] }),
  point: p({ twist: 10, lean: 2, hYaw: 8, hRoll: -3, aR: [92, 4, 22, 24], aL: [14, 10, 6, 8] }),
  reach: p({ twist: -12, lean: 5, hPitch: 9, hYaw: -6, hRoll: 3, aL: [58, 74, 8, 10], aR: [16, 12, 6, 8] }),   // 往前下方伸手（笔记本那一段，光线从这只手拉出去）
  pointUp: p({ hPitch: -10, hRoll: 6, aR: [158, 12, 14, 18], aL: [14, 10, 6, 8] }),
  think: p({ lean: -2, hRoll: 10, hPitch: -6, hYaw: -6, aR: [18, 196, 42, 70], aL: [10, 6, 6, 8] }),
  shrug: p({ bow: -2, hRoll: -9, aL: [64, -86, 18, 30], aR: [60, -80, 20, 32] }),
  surprise: p({ bow: -9, hPitch: -6, aL: [52, 42, 12, 14], aR: [48, 46, 10, 12] }),
  present: p({ twist: 8, lean: 1.5, hYaw: 6, hRoll: -3, aR: [68, 26, 28, 40], aL: [14, 10, 6, 8] }),
  presentBoth: p({ bow: -2, hPitch: -4, aL: [58, 22, 30, 42], aR: [62, 20, 28, 40] }),
  cheer: p({ bow: -4, hPitch: -6, aL: [132, 24, 10, 10], aR: [126, 28, 12, 10] }),
  sad: p({ bow: 8, lean: 2, hPitch: 16, hRoll: -4, aL: [4, 2, 6, 6], aR: [5, 1, 4, 6] }),
  listen: p({ lean: 3, hRoll: 12, hYaw: -4, aR: [136, 64, 4, 22], aL: [12, 8, 6, 8] }),
  check: p({ bow: 9, hPitch: 7, hRoll: -4, aR: [36, 84, 48, 64], aL: [12, 8, 6, 8] }),
  wave: p({ hRoll: 6, aR: [140, 30, 10, 10] }),
  thumbsUp: p({ twist: 6, lean: -1.5, hRoll: -6, hPitch: -3, aR: [64, 82, 30, 58], thumbR: 1, aL: [16, 12, 8, 10] }),
  proud: p({ bow: -6, hPitch: -9, hRoll: 4, aL: [72, -128, 4, 16], aR: [70, -124, 2, 14] }),
  heartHands: p({ bow: 2, hRoll: -5, hPitch: -3, aL: [26, 138, 40, 56], aR: [24, 142, 40, 56] }),
  bashful: p({ bow: 3, lean: -2, hRoll: -10, hPitch: 6, hYaw: -10, aL: [14, 4, 10, 14], aR: [128, 92, 10, 32] }),
  dizzy: p({ lean: 3, hRoll: -8, aL: [26, 30, 6, 8], aR: [30, 26, 6, 10] }),
  slump: p({ bow: 6, hPitch: 14, aL: [3, 0, 4, 4], aR: [4, 0, 4, 4], crouch: 0.12 }),
  rigid: p({ aL: [6, 0, 0, 0], aR: [6, 0, 0, 0] }),
  crouch: p({ bow: 14, hPitch: -10, aL: [40, 34, -48, -36], aR: [38, 36, -46, -38], crouch: 0.55 }),
  air: p({ bow: -6, hPitch: -8, aL: [120, 30, 8, 8], aR: [116, 34, 8, 8] }),
  speak: p({ twist: 4, hRoll: -3, aR: [34, 52, 30, 46], aL: [14, 10, 8, 10] })
};
var mixObj = (a, b, k) => {
  const out = {};
  for (const key in a) {
    const va = a[key], vb = b[key];
    if (Array.isArray(va)) out[key] = va.map((x, i) => lerp(x, vb[i], k));
    else out[key] = lerp(va, vb, k);
  }
  return out;
};
var trackAt = (keys, t, lib, base, defD = 0.42, defEase = ANTICIPATE) => {
  const res = (q, from2) => typeof q === "string" ? lib[q] : { ...from2, ...q };
  let from = res(keys[0]?.p ?? base, base);
  let to = from, t0 = -1e9, d = 1e-3, ease = E.standard;
  for (const k of keys) {
    if (k.t > t) break;
    from = mixObj(from, to, ease(inv(t0, t0 + d, k.t)));
    to = res(k.p, from);
    t0 = k.t;
    d = k.d ?? defD;
    ease = k.ease ?? defEase;
  }
  return mixObj(from, to, ease(inv(t0, t0 + d, t)));
};
var FPS = 60;
var LAG = { head: 2 / FPS, upper: 3 / FPS, fore: 6 / FPS };
var FACE_EASE = bezier(0.25, 0.1, 0.25, 1.22);
var blinkAt = (t, seed = 1, extra = []) => {
  let k = 1;
  const one = (dt) => dt > -0.01 && dt < 0.15 ? dt < 0.05 ? 1 - dt / 0.05 : (dt - 0.05) / 0.1 : 1;
  let bt = 0.8 + hash(seed) * 2;
  for (let i = 0; i < 400 && bt < t + 1; i++) {
    k = Math.min(k, one(t - bt));
    if (hash(seed + i * 7.3) > 0.8) k = Math.min(k, one(t - bt - 0.22));
    bt += 2.5 + hash(seed + i * 3.1) * 2.5;
  }
  for (const b of extra) k = Math.min(k, one(t - b));
  return clamp(k, 0.06, 1);
};
var BREATH = { period: 3.4, leg: 0.048, headPitch: 0.6, arm: 1.5 };
var breathAt = (t, seed = 1) => Math.sin(t / BREATH.period * Math.PI * 2 + seed);
export {
  DIM,
  FACE0,
  FACES,
  LAG,
  math_exports as MATH,
  P02 as P0,
  POSES,
  REST,
  REST_ARM,
  SILENT,
  STATE0,
  applyState,
  blinkAt,
  breathAt,
  face,
  makeRig,
  mixFace,
  mixObj,
  trackAt
};
