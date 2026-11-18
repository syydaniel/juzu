// 缓动和小工具（沿用《卡字》lib/anim.ts 的写法）。全部是时间的纯函数，任意一帧都能单独算出来。
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const inv = (a: number, b: number, x: number) => clamp((x - a) / (b - a));
export const rad = (d: number) => (d * Math.PI) / 180;

// 三次贝塞尔缓动（与 CSS cubic-bezier 相同），牛顿迭代求解
export const bezier = (x1: number, y1: number, x2: number, y2: number) => {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
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

export const E = {
  linear: (x: number) => clamp(x),
  standard: bezier(0.2, 0, 0, 1),
  enter: bezier(0.05, 0.7, 0.1, 1),
  exit: bezier(0.3, 0, 0.8, 0.15),
  inOut: bezier(0.65, 0, 0.35, 1),
  smooth: (x: number) => {
    x = clamp(x);
    return x * x * x * (x * (x * 6 - 15) + 10);
  },
  step: (x: number) => (x < 0.5 ? 0 : 1),
};

// 预备 + 夸张：y 超出 [0,1] 的贝塞尔，先回一点、冲过一点、再停住（和 2D 版同一条曲线）
export const ANTICIPATE = bezier(0.45, -0.28, 0.2, 1.18);

// 有阻尼的弹簧（解析解），用于"弹出来、冲过头、停住"。zeta 越小越弹。
export const spring = (t: number, freq = 2.2, zeta = 0.75) => {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq;
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
};

// 弹出：0 -> 1，冲过头再回来（眼睛弹开、爱心弹出）
export const pop = (t: number, freq = 3.2, zeta = 0.42) => spring(t, freq, zeta);

export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
export const noise1 = (x: number, seed = 0) => {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 101), hash(i + 1 + seed * 101), u) * 2 - 1;
};

// 一个小脉冲：dt 秒前触发，attack 秒冲上去，release 秒落回（带一点点回弹）
export const pulse = (dt: number, attack = 0.06, release = 0.22) => {
  if (dt < 0) return 0;
  if (dt < attack) return E.smooth(dt / attack);
  const r = (dt - attack) / release;
  return Math.exp(-r * 3) * Math.cos(r * 2.2);
};

// 三角波：AI 模式的节拍器（故意线性、没有缓入缓出）
export const tri = (x: number) => {
  const f = x - Math.floor(x);
  return f < 0.5 ? f * 4 - 1 : 3 - f * 4;
};
