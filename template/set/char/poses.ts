// 姿势库和动画机制：关键姿势、跟随与重叠、眨眼、呼吸、跳跃（腿当减震器）、弹簧（天线、耳朵）。
// 全部是时间的纯函数（弹簧先按 120 Hz 烘焙一遍再查表），任意一帧都能单独算出来。
import {ANTICIPATE, E, bezier, clamp, hash, inv, lerp} from './math';
import type {Arm} from './rig';

export type Pose = {
  lean: number; // 身体侧倾（度，正 = 头往画面右）
  bow: number; // 身体前俯（度，正 = 往镜头方向俯）
  twist: number; // 身体转向（度，正 = 转向画面右）
  hRoll: number; // 头相对身体：侧歪
  hPitch: number; // 点头（正 = 低头）
  hYaw: number; // 转头（正 = 看画面右）
  aL: Arm; // 画面左边的手臂：上臂外展、肘弯、上臂前伸、前臂前伸
  aR: Arm;
  thumbL: number;
  thumbR: number;
  crouch: number; // 0..1 静态下蹲（腿缩短）
  x: number;
  z: number;
};

export const REST: Arm = [12, 8, 8, 10];
export const P0: Pose = {lean: 0, bow: 0, twist: 0, hRoll: 0, hPitch: 0, hYaw: 0, aL: REST, aR: REST, thumbL: 0, thumbR: 0, crouch: 0, x: 0, z: 0};
const p = (o: Partial<Pose>): Pose => ({...P0, ...o});

// 姿势库：沿用 2D 版的名字和大致角度，换成三维的三个轴。两边手臂故意不完全对称（避免"双胞胎"）。
export const POSES: Record<string, Pose> = {
  stand: P0,
  happy: p({bow: -3, lean: -1.5, hRoll: 6, hPitch: -5, aL: [30, 22, 12, 18], aR: [26, 18, 10, 14]}),
  point: p({twist: 10, lean: 2, hYaw: 8, hRoll: -3, aR: [92, 4, 22, 24], aL: [14, 10, 6, 8]}),
  pointUp: p({hPitch: -10, hRoll: 6, aR: [158, 12, 14, 18], aL: [14, 10, 6, 8]}),
  think: p({lean: -2, hRoll: 10, hPitch: -6, hYaw: -6, aR: [18, 196, 42, 70], aL: [10, 6, 6, 8]}),
  shrug: p({bow: -2, hRoll: -9, aL: [64, -86, 18, 30], aR: [60, -80, 20, 32]}),
  surprise: p({bow: -9, hPitch: -6, aL: [52, 42, 12, 14], aR: [48, 46, 10, 12]}),
  present: p({twist: 8, lean: 1.5, hYaw: 6, hRoll: -3, aR: [68, 26, 28, 40], aL: [14, 10, 6, 8]}),
  presentBoth: p({bow: -2, hPitch: -4, aL: [58, 22, 30, 42], aR: [62, 20, 28, 40]}),
  cheer: p({bow: -4, hPitch: -6, aL: [132, 24, 10, 10], aR: [126, 28, 12, 10]}),
  sad: p({bow: 8, lean: 2, hPitch: 16, hRoll: -4, aL: [4, 2, 6, 6], aR: [5, 1, 4, 6]}),
  listen: p({lean: 3, hRoll: 12, hYaw: -4, aR: [136, 64, 4, 22], aL: [12, 8, 6, 8]}),
  check: p({bow: 9, hPitch: 7, hRoll: -4, aR: [36, 84, 48, 64], aL: [12, 8, 6, 8]}),
  wave: p({hRoll: 6, aR: [140, 30, 10, 10]}),
  thumbsUp: p({twist: 6, lean: -1.5, hRoll: -6, hPitch: -3, aR: [64, 82, 30, 58], thumbR: 1, aL: [16, 12, 8, 10]}),
  proud: p({bow: -6, hPitch: -9, hRoll: 4, aL: [72, -128, 4, 16], aR: [70, -124, 2, 14]}),
  heartHands: p({bow: 2, hRoll: -5, hPitch: -3, aL: [26, 138, 40, 56], aR: [24, 142, 40, 56]}),
  bashful: p({bow: 3, lean: -2, hRoll: -10, hPitch: 6, hYaw: -10, aL: [14, 4, 10, 14], aR: [128, 92, 10, 32]}),
  dizzy: p({lean: 3, hRoll: -8, aL: [26, 30, 6, 8], aR: [30, 26, 6, 10]}),
  slump: p({bow: 6, hPitch: 14, aL: [3, 0, 4, 4], aR: [4, 0, 4, 4], crouch: 0.12}),
  rigid: p({aL: [6, 0, 0, 0], aR: [6, 0, 0, 0]}),
  crouch: p({bow: 14, hPitch: -10, aL: [40, 34, -48, -36], aR: [38, 36, -46, -38], crouch: 0.55}),
  air: p({bow: -6, hPitch: -8, aL: [120, 30, 8, 8], aR: [116, 34, 8, 8]}),
  speak: p({twist: 4, hRoll: -3, aR: [34, 52, 30, 46], aL: [14, 10, 8, 10]}),
};

// ---------- 通用关键帧轨道：每个关键姿势都从"当时实际所在的值"出发
type Num = number | number[];
type Obj = {[k: string]: Num};

export const mixObj = <T extends Obj>(a: T, b: T, k: number): T => {
  const out: any = {};
  for (const key in a) {
    const va = a[key] as Num, vb = b[key] as Num;
    if (Array.isArray(va)) out[key] = (va as number[]).map((x, i) => lerp(x, (vb as number[])[i], k));
    else out[key] = lerp(va as number, vb as number, k);
  }
  return out as T;
};

export type Key<T> = {t: number; p: string | Partial<T>; d?: number; ease?: (x: number) => number};

export const trackAt = <T extends Obj>(keys: Key<T>[], t: number, lib: Record<string, T>, base: T, defD = 0.42, defEase = ANTICIPATE): T => {
  const res = (q: Key<T>['p'], from: T): T => (typeof q === 'string' ? lib[q] : ({...from, ...q} as T));
  let from: T = res(keys[0]?.p ?? base, base);
  let to = from, t0 = -1e9, d = 0.001, ease = E.standard;
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

// 跟随与重叠：身体先到；头晚 2 帧，上臂晚 3 帧，前臂晚 6 帧（60 fps）
export const FPS = 60;
export const LAG = {head: 2 / FPS, upper: 3 / FPS, fore: 6 / FPS};

// 眼睛的缓动：快、带一点冲过头（脸上的元素可以挤压拉伸）
export const FACE_EASE = bezier(0.25, 0.1, 0.25, 1.22);

// 眨眼：每 2.5 到 5 秒一次，两成概率连眨两下；闭 3 帧、睁 6 帧。可复现。
export const blinkAt = (t: number, seed = 1, extra: number[] = []) => {
  let k = 1;
  const one = (dt: number) => (dt > -0.01 && dt < 0.15 ? (dt < 0.05 ? 1 - dt / 0.05 : (dt - 0.05) / 0.1) : 1);
  let bt = 0.8 + hash(seed) * 2;
  for (let i = 0; i < 400 && bt < t + 1; i++) {
    k = Math.min(k, one(t - bt));
    if (hash(seed + i * 7.3) > 0.8) k = Math.min(k, one(t - bt - 0.22));
    bt += 2.5 + hash(seed + i * 3.1) * 2.5;
  }
  for (const b of extra) k = Math.min(k, one(t - b));
  return clamp(k, 0.06, 1);
};

// 呼吸：周期 3.4 秒，幅度不超过身高的 1.5%（这里是腿长变化 ±0.024 = 身高 3.4 的 0.7%）
export const BREATH = {period: 3.4, leg: 0.048, headPitch: 0.6, arm: 1.5};
export const breathAt = (t: number, seed = 1) => Math.sin((t / BREATH.period) * Math.PI * 2 + seed);

// 跳一下：take = 离地时刻，land = 落地时刻。返回离地高度、水平进度（0..1，走抛物线）和压扁量（正 = 压扁，负 = 拉长）。
// 预备（下蹲）0.2 秒 = 12 帧，约占整个动作（蹲 + 空中 + 缓冲 ≈ 1.05 秒）的 19%。
export const HOP = {crouch: 0.2, h: 0.62, squashCrouch: 0.15, squashLand: 0.2, stretch: 0.12, settleFreq: 26, settleDecay: 8.5};
export const hopAt = (t: number, take: number, land: number, h = HOP.h) => {
  const air = land - take;
  if (t < take - HOP.crouch) return {hop: 0, u: 0, squash: 0, airborne: false, crouch: 0};
  if (t < take) {
    const c = E.smooth(inv(take - HOP.crouch, take - 0.03, t));
    // 最后 2 帧蹬地：腿迅速伸长
    const push = inv(take - 0.035, take, t);
    return {hop: 0, u: 0, squash: HOP.squashCrouch * c * (1 - push) - HOP.stretch * push, airborne: false, crouch: c * (1 - push)};
  }
  if (t < land) {
    const u = (t - take) / air;
    const st = -HOP.stretch * (1 - Math.sin(u * Math.PI)) * (u < 0.5 ? 1 : 0.55);
    return {hop: 4 * h * u * (1 - u), u, squash: st, airborne: true, crouch: 0};
  }
  const v = t - land;
  return {hop: 0, u: 1, squash: HOP.squashLand * Math.exp(-v * HOP.settleDecay) * Math.cos(v * HOP.settleFreq * (1 - 0.25 * clamp(v / 0.4))), airborne: false, crouch: 0};
};
// 腿是减震器：squash 正时缩短，负时伸长；外壳不变形
export const legFromSquash = (sq: number) => (sq >= 0 ? 1 - Math.min(0.34, sq) * 1.9 : 1 + Math.min(0.2, -sq) * 1.6);

// ---------- 弹簧：按 120 Hz 积分一遍，存成表。drive(t) 给出"弹簧根部要跟的角度"和"根部的水平加速度"。
export type SpringSpec = {k: number; c: number; gain: number; max: number};
// 天线：k 200、c 6.5，大约 0.7 秒（42 帧）停稳；耳朵：k 320、c 9，约 0.5 秒（30 帧）
export const SPRINGS = {
  antenna: {k: 200, c: 6.5, gain: 0.9, max: 38} as SpringSpec,
  ear: {k: 320, c: 9, gain: 0.6, max: 16} as SpringSpec,
};

export const bakeSpring = (t0: number, t1: number, drive: (t: number) => {angle: number; acc: number}, s: SpringSpec) => {
  const h = 1 / 120;
  const n = Math.ceil((t1 - t0) / h) + 2;
  const out = new Float32Array(n);
  let x = drive(t0).angle, v = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + i * h;
    const d = drive(t);
    const a = s.k * (d.angle - x) - s.c * v - d.acc * s.gain;
    v += a * h;
    x += v * h;
    out[i] = Math.max(-s.max, Math.min(s.max, x - d.angle));
  }
  return (t: number) => {
    const f = clamp((t - t0) / h, 0, n - 1.001);
    const i = Math.floor(f), k = f - i;
    return lerp(out[i], out[i + 1], k);
  };
};
