// 运镜顺滑：导演表写完以后统一过一道，导演表本身不用改。shots.js 里在 CAM 写完以后调用：smooth(CAM, TX, TL.duration, CAMS)
// 来历（66 期作者看完样片）：「运镜的时候一顿一顿的，明明已经推过去了，突然又跳到了后面；切换场景或者在一个较短片段里运镜，
// 不要切换得那么大，运镜要丝滑」。毛病出在两处：同一个机位连着切（整屏推到 1.0，下一个整屏又从 1.02 起，等于往后跳一下），
// 和短镜头来回切（整屏 → 小卡 3.5 秒 → 整屏）。做的事：
//   0. 整屏镜头（写了 full: 1）统一往下看一点、离远一点：屏幕最底下一行（出处小字、进度条）不压在字幕上（66 期：原来落在 1012 到 1070 像素，字幕基线 1008）；
//   1. 同一个机位连着的几个镜头并成一个（后面的删掉，前一个的运镜一直走到下一个机位）；
//   2. 夹在两个相同机位中间、不到 4.5 秒的短镜头去掉（道具镜头留着），两边并成一个；
//   3. 剩下不到 3.5 秒、又不是道具的镜头并进前一个；
//   4. 同一片区域的两个机位（小卡的近景中景、屋子的几个远景……）之间，硬切改成滑过去；滑多久按走多远、转多少度定
//      （ease5 的峰值速度是平均的 1.875 倍：峰值压在 0.6 米/秒、每秒 30 度左右，最短 1 秒、最长 4.5 秒，也不超过这个镜头的一半）；
//   5. 并出来的整屏长镜头：运镜走满整个镜头（不提前停），超过 7 秒的再加 ±2.2 度很慢的左右横移，一左一右交替，画面一直在动但不往前推（推多了压字幕）。
// 不想被动的镜头写 keep: 1；每章开头（a01、b01……）自动留着。opt.cuts 给一串时刻（一般就是 LIGHT 里换光的那几刀）：
// 在这些时刻开始的镜头留着、而且一定硬切（66 期：c01 换黄昏的光是瞬间换的，被改成滑 1.5 秒以后，光在滑的开头一下子变了）。处理记录在 window.SMOOTH_LOG。
// 自检：node tools/campath.mjs 逐帧读机位，再看滑过去的峰值速度、有没有不在硬切处的跳动。
export const PROP = new Set(['padcam', 'phoneflip', 'board', 'desk', 'desklow', 'magic', 'magicb', 'magicwall', 'holo', 'nbwide', 'nbtop', 'top', 'side', 'low', 'bedclose', 'fill']);
export const GROUP = { talk: 'bot', host: 'bot', host2: 'bot', holo: 'bot', wide: 'room', wide2: 'room', room: 'room', magicb: 'room', nbwide: 'nb', nbtop: 'nb', bedwide: 'bed', bedclose: 'bed' };

export function smooth(CAM, TX, DUR, CAMS, opt = {}) {
  const prop = opt.prop || PROP, group = opt.group || GROUP, log = [];
  const CUT = new Set((opt.cuts || []).map((x) => +TX(x).toFixed(3)));
  if (opt.fullSafe !== false) for (const c of CAM) if (c.full) { c.v = .563; c.dist = Math.max(c.dist ?? .95, 1.02); c.dist2 = Math.max(c.dist2 ?? c.dist, 1.0); c.creep = .02; }
  const key = (c) => c.cam === 'scr' ? `scr${c.full ? 'F' : ''}${c.u ?? .5},${c.v ?? .5}` : c.cam === 'desk' ? `desk${c.x}` : c.cam;
  const isProp = (c) => prop.has(c.cam) || (c.cam === 'scr' && !c.full);
  for (const c of CAM) if (/^[a-z]01$/.test(String(c.at))) c.keep = 1;
  for (const c of CAM) if (CUT.has(+TX(c.at).toFixed(3))) { c.keep = 1; c.cut = 1; }
  const sorted = () => CAM.map((c) => ({ c, t: TX(c.at) })).sort((a, b) => a.t - b.t);
  const drop = (set) => { for (let i = CAM.length - 1; i >= 0; i--) if (set.has(CAM[i])) CAM.splice(i, 1); };
  const len = (L, i) => (L[i + 1]?.t ?? DUR) - L[i].t;
  const same = () => { const L = sorted(), del = new Set();
    for (let i = 1; i < L.length; i++) { let j = i - 1; while (del.has(L[j].c)) j--; if (key(L[j].c) === key(L[i].c) && !L[i].c.keep) { del.add(L[i].c); log.push(`并 ${L[i].c.at}→${L[j].c.at}`); } }
    drop(del); };
  same();
  { const L = sorted(), del = new Set();
    for (let i = 1; i + 1 < L.length; i++) if (!isProp(L[i].c) && !L[i].c.keep && len(L, i) < 4.5 && key(L[i - 1].c) === key(L[i + 1].c) && !del.has(L[i - 1].c)) { del.add(L[i].c); log.push(`去来回 ${L[i].c.at}`); }
    drop(del); }
  same();
  { const L = sorted(), del = new Set();
    for (let i = 1; i < L.length; i++) if (!isProp(L[i].c) && !L[i].c.keep && len(L, i) < 3.5 && !del.has(L[i - 1].c)) { del.add(L[i].c); log.push(`并短 ${L[i].c.at}`); }
    drop(del); }
  same();
  const L = sorted(); let side = 1;
  const dir = (q) => { const v = [q.l[0] - q.p[0], q.l[1] - q.p[1], q.l[2] - q.p[2]], m = Math.hypot(...v); return v.map((x) => x / m); };
  for (let i = 0; i < L.length; i++) { const c = L[i].c, n = len(L, i), p = L[i - 1]?.c;
    if (p && group[c.cam] && group[c.cam] === group[p.cam] && !(c.d > 0) && !c.cut) {
      const A = CAMS[p.cam], B = CAMS[c.cam], far = A && B ? Math.hypot(A.p[0] - B.p[0], A.p[1] - B.p[1], A.p[2] - B.p[2]) : 1;
      const deg = A && B ? Math.acos(Math.min(1, dir(A).reduce((s, x, k) => s + x * dir(B)[k], 0))) * 180 / Math.PI : 20;
      c.d = Math.max(1.0, Math.min(4.5, .5 * n, Math.max(1.875 * far / .6, 1.875 * deg / 30))); log.push(`滑 ${p.cam}→${c.cam} ${c.d.toFixed(1)}s（${far.toFixed(2)} 米，${deg.toFixed(0)} 度）`); }
    if (c.full) { delete c.span; if (n > 7) { c.yaw = -2.2 * side; c.yaw2 = 2.2 * side; side = -side; } }
  }
  (typeof window !== 'undefined' ? window : globalThis).SMOOTH_LOG = log;
  return log;
}
