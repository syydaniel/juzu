// 屏幕脸：眼睛、眉毛（新）、嘴（新，金色声线）和各种小道具，画在一张 2D canvas 上，再贴到三维屏幕上。
// 单位：1 fu = 0.01 个世界单位。屏幕可见区域 130 × 88 fu，原点在屏幕中心，y 向下。
// 脸上的元素可以挤压拉伸（眼睛弹开时冲过头），外壳不变形，字不变形。
import {clamp, lerp, pop} from './math';
import {PAL} from './palette';

export const SCREEN_W = 130;
export const SCREEN_H = 88;

export type Face = {
  vis: number; // 脸上元素整体出现 0..1
  dot: number; // 待机小点 0..1
  scan: number; // 开机时的一条横线 0..1
  glow: number; // 屏幕背光 0..1
  look: [number, number]; // 眼睛看向（-1..1，x 正 = 画面右，y 正 = 下）
  open: [number, number]; // 两只眼的睁开量（1 = 正常；含眨眼）。下标 0 = 画面左边那只
  wide: number; // 整体睁大（惊讶 1.25）
  lidT: [number, number]; // 上眼皮盖下来 0..1
  lidA: [number, number]; // 上眼皮角度（度，正 = 外眼角往下 = 委屈）
  lidB: [number, number]; // 下眼皮平着推上来 0..1（眯眼）
  happy: [number, number]; // 笑眼：下面被一道弧顶上来 0..1
  square: number; // AI 模式：眼睛变成直角方块
  browOn: number;
  browY: [number, number]; // 眉毛抬高（fu）
  browA: [number, number]; // 眉毛角度（度，正 = 内侧抬起 = 担心/委屈，负 = 内侧压低 = 专注）
  mOn: number;
  mCurve: number; // 嘴的弯度（fu，正 = 笑，负 = 撇嘴）
  mW: number; // 嘴宽（fu）
  mX: number;
  mY: number;
  mTilt: number; // 嘴歪（fu，正 = 右边低）
  mO: number; // O 形嘴 0..1
  mOpen: number; // 咧嘴张开 0..1
  mWavy: number; // 波浪嘴（害羞）0..1
  mSpeak: number; // 由真实声音驱动 0..1
  mAI: number; // AI 模式：呆板的正弦波 0..1
  blush: number;
  spiral: number;
  heart: number;
  sparkle: number;
  sweat: number;
  code: number; // 代码眼，两只眼变成 < >
  star: number; // 星星眼
};

export const FACE0: Face = {
  vis: 1, dot: 0, scan: 0, glow: 1,
  look: [0, 0], open: [1, 1], wide: 1,
  lidT: [0, 0], lidA: [0, 0], lidB: [0, 0], happy: [0, 0], square: 0,
  browOn: 1, browY: [0, 0], browA: [0, 0],
  mOn: 1, mCurve: 3.2, mW: 22, mX: 0, mY: 0, mTilt: 0, mO: 0, mOpen: 0, mWavy: 0, mSpeak: 0, mAI: 0,
  blush: 0, spiral: 0, heart: 0, sparkle: 0, sweat: 0, code: 0, star: 0,
};

export type FaceKey = Partial<Face>;
export const face = (o: FaceKey): Face => ({...FACE0, ...o});

const PAIRS: (keyof Face)[] = ['look', 'open', 'lidT', 'lidA', 'lidB', 'happy', 'browY', 'browA'];
export const mixFace = (a: Face, b: Face, k: number): Face => {
  const out: any = {};
  for (const key of Object.keys(a) as (keyof Face)[]) {
    if (PAIRS.includes(key)) {
      const pa = a[key] as [number, number], pb = b[key] as [number, number];
      out[key] = [lerp(pa[0], pb[0], k), lerp(pa[1], pb[1], k)];
    } else {
      out[key] = lerp(a[key] as number, b[key] as number, k);
    }
  }
  return out as Face;
};

// 表情库（只管屏幕上的脸；身体的姿势在 poses.ts）
export const FACES: Record<string, Face> = {
  neutral: FACE0,
  blink: face({open: [0.06, 0.06]}),
  happy: face({happy: [1, 1], open: [1.08, 1.08], browY: [3.5, 3.5], browA: [4, 4], mCurve: 7.5, mW: 34, mOpen: 0.75, mY: -1}),
  surprised: face({wide: 1.25, browY: [8, 8], browA: [6, 6], mO: 1, mCurve: 0, look: [0, -0.1]}),
  focus: face({lidT: [0.36, 0.36], lidB: [0.3, 0.3], browY: [-4, -4], browA: [-14, -14], mCurve: 0.6, mW: 13, mX: 5, mTilt: 0.8, look: [0.35, 0.15]}),
  doubt: face({lidT: [0.32, 0], open: [0.92, 1.06], browY: [-3, 8], browA: [-10, 8], mCurve: -1.5, mW: 15, mX: 12, mTilt: 2.6, look: [0.55, -0.35]}),
  sad: face({lidT: [0.18, 0.18], lidA: [24, 24], browY: [1, 1], browA: [20, 20], mCurve: -5.5, mW: 22, mY: 2, look: [0, 0.6]}),
  dizzy: face({spiral: 1, browY: [2, -1], browA: [16, -10], mWavy: 1, mCurve: -1, mW: 26, blush: 0}),
  embarrassed: face({happy: [0.45, 0.45], blush: 1, browY: [1, 1], browA: [16, 16], mWavy: 0.7, mCurve: 1, mW: 14, mY: 1, look: [-0.55, 0.45]}),
  proud: face({lidT: [0.4, 0.4], happy: [0.35, 0.35], browY: [4, 4], browA: [-8, -8], mCurve: 7, mW: 30, mOpen: 0.45, mTilt: -1.2, sparkle: 1, look: [0, -0.15]}),
  heart: face({heart: 1, browY: [4, 4], browA: [8, 8], mCurve: 8, mW: 32, mOpen: 0.85, blush: 0.55}),
  wink: face({open: [1.05, 0.5], happy: [0, 1], lidT: [0, 0], browY: [4, -1.5], browA: [4, -6], mCurve: 6.5, mW: 28, mTilt: -2.6, mX: -2, mOpen: 0.3, sparkle: 1}),
  standby: face({vis: 0, dot: 1, glow: 0, browOn: 0, mOn: 0}),
  listen: face({look: [-0.7, -0.35], wide: 1.05, browY: [6, 2.5], browA: [6, 2], mCurve: 0.6, mW: 10, mO: 0.35}),
  speak: face({mSpeak: 1, browY: [2.5, 2.5], mCurve: 2.5, mW: 32}),
  code: face({code: 1, browY: [3, 3], browA: [-6, -6], mCurve: 4.5, mW: 20, mOpen: 0.2, look: [0, -0.05]}),
  star: face({star: 1, browY: [7, 7], browA: [6, 6], mO: 0.55, mCurve: 5, mW: 22, mOpen: 0.6, blush: 0.35, look: [0, -0.2]}),
  ai: face({square: 1, browY: [0, 0], browA: [0, 0], mAI: 1, mCurve: 0, mW: 52, look: [0, 0]}),
};

export type AudioFrame = {open: number; bright: number; wave: number[] | null; level: number};
export const SILENT: AudioFrame = {open: 0, bright: 0.5, wave: null, level: 0};

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a)})`;
};
const mixHex = (h1: string, h2: string, k: number, a = 1) => {
  const n1 = parseInt(h1.slice(1), 16), n2 = parseInt(h2.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(lerp((n1 >> s) & 255, (n2 >> s) & 255, clamp(k))));
  return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a)})`;
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const heartPath = (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) => {
  // 一个圆润的爱心，s = 半宽
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.95);
  ctx.bezierCurveTo(cx - s * 0.2, cy + s * 0.75, cx - s * 1.05, cy + s * 0.25, cx - s * 1.0, cy - s * 0.3);
  ctx.bezierCurveTo(cx - s * 0.95, cy - s * 0.95, cx - s * 0.2, cy - s * 1.05, cx, cy - s * 0.45);
  ctx.bezierCurveTo(cx + s * 0.2, cy - s * 1.05, cx + s * 0.95, cy - s * 0.95, cx + s * 1.0, cy - s * 0.3);
  ctx.bezierCurveTo(cx + s * 1.05, cy + s * 0.25, cx + s * 0.2, cy + s * 0.75, cx, cy + s * 0.95);
  ctx.closePath();
};

const star4 = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot: number) => {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    const rr = i % 2 ? r * 0.28 : r;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
};

export const EYE_X = 29, EYE_Y = -5, EYE_W = 23, EYE_H = 33, BROW_DY = 27, MOUTH_Y = 25;
export const LOOK_X = 13, LOOK_Y = 7;

export type FaceCanvas = {canvas: HTMLCanvasElement; layer: HTMLCanvasElement; res: number};
export const makeFaceCanvas = (res: number): FaceCanvas => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(SCREEN_W * res);
  canvas.height = Math.round(SCREEN_H * res);
  const layer = document.createElement('canvas');
  layer.width = canvas.width;
  layer.height = canvas.height;
  return {canvas, layer, res};
};

// 画一帧脸。t 用于会自己动的小东西（螺旋、正弦、心跳、待机点），audio 是这一帧的声音特征。
export const drawFace = (fc: FaceCanvas, f: Face, t: number, audio: AudioFrame = SILENT) => {
  const {canvas, layer, res} = fc;
  const ctx = canvas.getContext('2d')!;
  const lx = layer.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  const toFu = (c: CanvasRenderingContext2D) => c.setTransform(res, 0, 0, res, W / 2, H / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  lx.setTransform(1, 0, 0, 1, 0, 0);
  lx.clearRect(0, 0, W, H);
  toFu(ctx);
  toFu(lx);

  // 背光：开机后屏幕中间有一层很淡的青光
  if (f.glow > 0.001) {
    const g = ctx.createRadialGradient(0, -4, 4, 0, 0, 70);
    g.addColorStop(0, rgba(PAL.teal, 0.075 * f.glow));
    g.addColorStop(1, rgba(PAL.teal, 0.012 * f.glow));
    ctx.fillStyle = g;
    ctx.fillRect(-SCREEN_W / 2, -SCREEN_H / 2, SCREEN_W, SCREEN_H);
  }
  // AI 模式：屏幕上有一层细细的扫描线
  if (f.square > 0.01) {
    ctx.fillStyle = rgba('#FFFFFF', 0.035 * f.square);
    for (let y = -SCREEN_H / 2; y < SCREEN_H / 2; y += 2.4) ctx.fillRect(-SCREEN_W / 2, y, SCREEN_W, 0.7);
  }

  // 玻璃反光：沿用 2D 版左上角那一笔
  if (f.glow > 0.001 || f.dot > 0.001) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-SCREEN_W / 2 + 10, -SCREEN_H / 2 + 15);
    ctx.quadraticCurveTo(-SCREEN_W / 2 + 14, -SCREEN_H / 2 + 8, -SCREEN_W / 2 + 26, -SCREEN_H / 2 + 7);
    ctx.stroke();
    ctx.restore();
  }
  const vis = clamp(f.vis, 0, 1.4);
  const lookX = f.look[0] * LOOK_X, lookY = f.look[1] * LOOK_Y;

  // ---------- 眼睛（先画到单独一层，再用"橡皮"切出眼皮，最后带着辉光贴回来）
  if (vis > 0.001) {
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const cx = side * EYE_X * (1 + 0.03 * (f.wide - 1)) + lookX;
      const cy = EYE_Y + lookY - (f.wide - 1) * 2;
      const op = Math.max(0, f.open[i]) * vis;
      // 挤压拉伸：眼睛被拉高时变窄，压扁时变宽（面积大致不变）
      const sqz = op > 1 ? 1 / Math.sqrt(op) : 1 + (1 - op) * 0.22;
      const spiralK = clamp(f.spiral), heartK = clamp(f.heart);
      const codeK = clamp(f.code), starK = clamp(f.star);
      const hide = Math.max(spiralK, heartK, codeK, starK);
      let w = EYE_W * Math.pow(f.wide, 0.7) * sqz * (1 + 0.1 * f.happy[i]) * (1 + 0.12 * f.square);
      let h = Math.max(2.6, EYE_H * f.wide * op) * (1 - 0.06 * f.square);
      w *= 1 - hide;
      h *= 1 - hide;
      if (w > 0.2 && h > 0.2) {
        lx.globalCompositeOperation = 'source-over';
        lx.fillStyle = PAL.eye;
        const r = lerp(Math.min(w, h) / 2, 1.4, clamp(f.square));
        roundRect(lx, cx - w / 2, cy - h / 2, w, h, r);
        lx.fill();
        lx.globalCompositeOperation = 'destination-out';
        lx.fillStyle = '#000';
        const out = side; // 外眼角方向
        // 上眼皮：一条可以斜的直线，以上全部切掉
        if (f.lidT[i] > 0.001 || Math.abs(f.lidA[i]) > 0.01) {
          const y0 = cy - h / 2 + f.lidT[i] * h;
          const k = Math.tan((f.lidA[i] * Math.PI) / 180);
          const xa = cx - w, xb = cx + w;
          lx.beginPath();
          lx.moveTo(xa, y0 + k * (xa - cx) * out);
          lx.lineTo(xb, y0 + k * (xb - cx) * out);
          lx.lineTo(xb, cy - h * 2 - 10);
          lx.lineTo(xa, cy - h * 2 - 10);
          lx.closePath();
          lx.fill();
        }
        // 下眼皮：平的，往上推（眯眼）
        if (f.lidB[i] > 0.001) {
          const y1 = cy + h / 2 - f.lidB[i] * h;
          lx.fillRect(cx - w, y1, w * 2, h * 2 + 10);
        }
        // 笑眼：下面一道弧顶上来，剩下一个弯弯的月牙
        if (f.happy[i] > 0.001) {
          const hh = Math.max(h, 12);
          const rx = w * 0.86, ry = hh * 0.56;
          const ey = cy + h / 2 + ry - f.happy[i] * (h * 0.74 + 2);
          lx.beginPath();
          lx.ellipse(cx, ey, rx, ry, 0, 0, Math.PI * 2);
          lx.fill();
        }
        lx.globalCompositeOperation = 'source-over';
      }
      // 晕：螺旋眼
      if (spiralK > 0.001 && vis > 0.01) {
        const s = pop(spiralK * 0.6, 3, 0.4) * vis;
        lx.save();
        lx.translate(cx, cy);
        lx.rotate(-t * 9 * side);
        lx.strokeStyle = PAL.eye;
        lx.lineWidth = 2.7;
        lx.lineCap = 'round';
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

    // 代码眼：左边一个 <，右边一个 >，合起来像一对尖括号
    if (f.code > 0.001) {
      const s = pop(clamp(f.code) * 0.7, 3, 0.42) * vis;
      ctx.save();
      ctx.shadowColor = rgba(PAL.eye, 0.75);
      ctx.shadowBlur = 5 * res;
      ctx.strokeStyle = PAL.eye;
      ctx.lineWidth = 6.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
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
    // 星星眼：四角星，慢慢转、一闪一闪
    if (f.star > 0.001) {
      const s = pop(clamp(f.star) * 0.7, 2.8, 0.38) * vis;
      ctx.save();
      ctx.shadowColor = rgba(PAL.gold, 0.95);
      ctx.shadowBlur = 7 * res;
      ctx.fillStyle = '#FFF1CF';
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const tw = 1 + 0.08 * Math.sin(t * 7 + i * 1.7);
        star4(ctx, side * EYE_X + lookX, EYE_Y + lookY, 17 * s * tw, Math.sin(t * 1.3 + i) * 0.18 - Math.PI / 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // 爱心眼
    if (f.heart > 0.001) {
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
      // 心上的一点高光
      ctx.shadowBlur = 0;
      ctx.fillStyle = rgba('#FFFFFF', 0.55 * clamp(f.heart));
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        ctx.beginPath();
        ctx.ellipse(side * EYE_X + lookX - 6 * s, EYE_Y + lookY - 7 * s, 2.6 * s, 1.7 * s, -0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ---------- 眉毛（小小两道，带一点弧）
    if (f.browOn > 0.001) {
      ctx.save();
      ctx.shadowColor = rgba(PAL.eye, 0.45);
      ctx.shadowBlur = 3.5 * res;
      ctx.strokeStyle = rgba(PAL.eye, 0.95 * clamp(f.browOn) * clamp(vis));
      ctx.lineWidth = 4.2 * (1 - 0.15 * f.square);
      ctx.lineCap = f.square > 0.5 ? 'butt' : 'round';
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const bx = side * EYE_X + lookX * 0.85;
        const by = EYE_Y - BROW_DY - f.browY[i] + lookY * 0.75 - (f.wide - 1) * 14;
        const L = 17 * clamp(f.browOn) * (1 + 0.15 * f.square);
        const a = (f.browA[i] * Math.PI) / 180;
        // 内侧在 -side 方向
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

  // ---------- 嘴：金色声线
  if (f.mOn * vis > 0.001) {
    const N = 72;
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
    const dn = f.mO * 6.2 + f.mOpen * 7.5 + A * 1.0;
    const wave = audio.wave;
    const wv = (u: number) => {
      if (!wave) return 0;
      const p = ((u + 1) / 2) * (wave.length - 1);
      const i = Math.floor(p), k = p - i;
      const a = wave[i] ?? 0, b = wave[Math.min(wave.length - 1, i + 1)] ?? 0;
      return (a + (b - a) * k) / 100;
    };
    // 两层：嘴腔（一圈很淡、很圆滑的开口，张多大跟着 RMS 走）和声线（真波形，一根线，静音时就是那道微笑）。
    // 嘴腔不带抖动，抖动全在声线上，免得开口的边缘长出"嘴唇"。
    const ups: [number, number][] = [], dns: [number, number][] = [], trace: [number, number][] = [];
    const tr = Math.max(sp, ai);
    for (let k = 0; k <= N; k++) {
      const u = -1 + (2 * k) / N;
      const x = mx + u * half;
      const q = 1 - u * u;
      const base = my + f.mCurve * q - f.mCurve * 0.35 + f.mTilt * u;
      const env = lerp(Math.pow(Math.max(0, q), 0.85), Math.sqrt(Math.max(0, q)), clamp(f.mO));
      const wavy = f.mWavy * 1.7 * Math.sin(u * Math.PI * 3 + t * 7) * Math.sqrt(Math.max(0, q));
      const sine = ai * 5.2 * Math.sin(u * Math.PI * 2 * 2.5 - t * Math.PI * 2 * 2.5);
      const c = wavy + sine;
      ups.push([x, base - env * up + c]);
      dns.push([x, base + env * dn + c]);
      // 声线：在嘴腔正中间，振幅 = 嘴腔半高的 0.9（两头收成 0），形状 = 这一帧的真波形
      const mid = base + env * (dn - up) * 0.5;
      const amp = env * ((up + dn) * 0.5) * 0.9;
      trace.push([x, mid + amp * wv(u) * sp + c]);
    }
    const gold = ai > 0 ? mixHex(PAL.gold, PAL.red, ai) : PAL.gold;
    const glowCol = ai > 0 ? mixHex(PAL.gold, PAL.red, ai, 0.85) : rgba(PAL.gold, 0.85);
    const smoothPath = (pts: [number, number][], close: boolean) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length - 1; k++) {
        ctx.quadraticCurveTo(pts[k][0], pts[k][1], (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2);
      }
      ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      if (close) ctx.closePath();
    };
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const opening = Math.max(up, dn);
    // 嘴腔（说话时退成一圈淡淡的光，声线在里面跳）
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
    ctx.strokeStyle = ai > 0 ? mixHex('#FFE7B0', '#FF9A85', ai) : '#FFE3A6';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    // 声线
    if (tr > 0.001) {
      ctx.globalAlpha = tr;
      smoothPath(trace, false);
      ctx.shadowColor = glowCol;
      ctx.shadowBlur = 5 * res;
      ctx.strokeStyle = gold;
      ctx.lineWidth = 3.1;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = ai > 0 ? mixHex('#FFE7B0', '#FF9A85', ai) : '#FFE3A6';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- 腮红（害羞、爱心）
  if (f.blush > 0.001 && vis > 0.01) {
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
      ctx.strokeStyle = rgba('#FFB3A8', 0.9 * f.blush);
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(bx + k * 4.2 - 1.6, by + 2.4);
        ctx.lineTo(bx + k * 4.2 + 1.6, by - 2.4);
        ctx.stroke();
      }
    }
  }

  // ---------- 一颗小星光（得意、眨眼）
  if (f.sparkle > 0.001 && vis > 0.01) {
    const s = pop(clamp(f.sparkle) * 0.7, 3, 0.4);
    const tw = 0.85 + 0.15 * Math.sin(t * 9);
    ctx.save();
    ctx.shadowColor = rgba(PAL.gold, 0.9);
    ctx.shadowBlur = 4 * res;
    ctx.fillStyle = '#FFF3D6';
    star4(ctx, 50, -27, 6.5 * s * tw, t * 0.8);
    ctx.fill();
    star4(ctx, 57, -16, 3 * s * tw, -t);
    ctx.fill();
    ctx.restore();
  }

  // ---------- 汗珠（尴尬时可选）
  if (f.sweat > 0.001 && vis > 0.01) {
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

  // ---------- 待机小点 / 开机横线
  if (f.dot > 0.001) {
    const p = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.8);
    ctx.save();
    ctx.shadowColor = rgba(PAL.eye, 0.7);
    ctx.shadowBlur = 5 * res;
    ctx.fillStyle = rgba(PAL.eye, (0.3 + 0.55 * p) * clamp(f.dot));
    ctx.beginPath();
    ctx.arc(0, 0, 2.9 + 0.5 * p, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (f.scan > 0.001) {
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
