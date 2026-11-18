// 成片用的公共小工具：读时间线、缓动。时间线在 tl.js 里（window.TL，由 mk_tl.py 从 ../app/src/timeline.json 生成）。
// 所有函数都只依赖传进来的 t，不读系统时间。
export const TL = window.TL;
export const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
export const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const ease5 = (x) => { x = clamp(x); return x * x * x * (x * (6 * x - 15) + 10); };
export const easeOut = (x) => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
export const easeIO = (x) => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const back = (x) => { x = clamp(x); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
export const lerp = (a, b, x) => a + (b - a) * x;
export const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// K('c05')：这句开始；K('c05$')：结束；K('c05', '直射光')：这个词被念到的时刻（按字数比例估）
export function K(key, word, off = 0) {
  const end = key.endsWith('$'), k = end ? key.slice(0, -1) : key, L = TL.lines[k];
  if (!L) throw new Error('时间线里没有这一句：' + key);
  if (!word) return (end ? L.end : L.start) + off;
  for (const c of L.clauses) { const i = c.text.indexOf(word); if (i >= 0) return c.start + (c.end - c.start) * i / Math.max(1, c.text.length) + off; }
  throw new Error(`「${key}」里找不到「${word}」`);
}
// 'c05:直射光+0.3' → 秒；数字原样；'DUR' 全片结束；'END' 片尾卡
export function TX(expr) {
  if (typeof expr === 'number') return expr; if (expr === 'DUR') return TL.duration; if (expr === 'END') return TL.end_card;
  const m = /^(.*?)([+-](?:\d+(?:\.\d+)?|\.\d+))?$/.exec(expr), off = m[2] ? parseFloat(m[2]) : 0, base = m[1];
  if (/^\d+(\.\d+)?$/.test(base)) return parseFloat(base) + off;
  if (base === 'DUR') return TL.duration + off; if (base === 'END') return TL.end_card + off;
  const [key, word] = base.split(':'); return K(key, word) + off;
}
export const P = (t, t0, d = .5) => clamp((t - t0) / d);                          // 0→1 的进度
export const W = (t, t0, t1, f = .35) => Math.min(P(t, t0, f), 1 - P(t, t1 - f, f)); // 出现又消失
