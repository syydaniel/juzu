// 成片的引擎：机位、小机器人的表演、显示器里画什么、软木板、桌上的字块、光和百叶、悬浮段、最上面的叠字层。全部只依赖 t。
// 每一秒做什么写在 shots.js（导演表），这里只负责执行。导演表的写法见 skill 里的 reference/导演表.md。
import * as THREE from 'three';
import { Q } from './harness3.js';
import { DIM } from './desk.js';
import { makeRig, applyState, STATE0, FACES, POSES, blinkAt, breathAt, mixObj } from './kaka.js';
import { recolor } from './kaka_look.js';
import { KINDS, need, frameSrc, setTX, forget, setHead, setNoBar } from './screen.js';
import { KINDS2, applyFx, drawKaka, setTX2, needsOf } from './screen_fx.js';
import { FX3D } from './fx3d.js';
import { BKINDS, boardNeeds, setTXb } from './board.js';
import { Magic } from './magic.js';
import { Steam } from './steam.js';
import { TL, TX, clamp, ease, ease5, easeOut, easeIO, lerp, P, hash } from './kit.js';
import { Overlay } from './overlay.js';
import SHOTS from './shots.js';

const V = (a) => new THREE.Vector3(...a);
const json = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
setTX(TX); setTX2(TX); setTXb(TX);
const ALL = { ...KINDS, ...KINDS2 };
// 显示器可视区域：中心、宽高都从 desk.js 的尺寸表来。scrPt(u, v)：屏幕上 (u, v)（左上 0,0，右下 1,1）在房间里的位置
const MON = { x: DIM.desk.x, y: DIM.mon.cy, z: DIM.mon.z + DIM.mon.t / 2 + .0003, w: DIM.mon.vw, h: DIM.mon.vh };
export const scrPt = (u, v) => V([MON.x + (u - .5) * MON.w, MON.y - (v - .5) * MON.h, MON.z]);

// 主持小机器人（代码里叫 kaka）换颜色见 kaka_look.js。想改脸上的颜色、身体的形状，改 char/*.ts 再 npm run kaka 重新打包，然后 npm run kaka-png 重画屏幕里的 2D 小机器人。
export class Film {
  constructor(stage) {
    this.stage = stage; this.data = {}; this.DUR = TL.duration;
    this.S = SHOTS({ TX, TL });
  }

  async init(set, extras, bed) {
    this.set = set; this.extras = extras; this.bed = bed; const S = this.S;
    const K = this.K = S.KAKA_AT;                                     // 小机器人站在显示器右边的桌面上，身高约 0.23 米
    const rig = this.rig = makeRig({ faceRes: 10, shadows: true, outlineWidth: .02 });
    rig.setOutline(false); recolor(rig.root, S.KAKA_LOOK);
    const hold = this.hold = new THREE.Group(); hold.scale.setScalar(K.s); this.home = V([K.x, set.TOP + .008, K.z]); hold.position.copy(this.home); hold.add(rig.root, rig.ground);
    rig.ground.visible = false; this.stage.scene.add(hold);
    for (const [k, u] of Object.entries(S.DATA || {})) this.data[k] = await json(u).catch(() => { console.warn('数据文件没找到，跳过：' + u); return null; });
    this.env = S.VOICE_ENV ? await json(S.VOICE_ENV).catch(() => null) : null;   // 配音的响度包络：小机器人的嘴。没有的时候按时间线里每句的起止假装在说
    this.cams = S.CAM.map((c) => ({ ...c, t: TX(c.at) })).sort((a, b) => a.t - b.t);
    this.cams.forEach((c, i) => { c.dur = (this.cams[i + 1]?.t ?? this.DUR) - c.t; c.i = i; });   // 每个镜头的长度：运镜在这段时间里走完
    this.screens = calmScreens(S.SCREEN.map((s) => ({ ...s, t0: TX(s.t0), t1: TX(s.t1) })), this.cams, S.CALM);
    this.kk = S.KAKA.map((k) => ({ ...k, t: TX(k.at) })).sort((a, b) => a.t - b.t);
    this.kin = (S.KAKA_IN || []).map((k) => ({ ...k, t0: TX(k.t0), t1: TX(k.t1) }));
    this.fx3d = new FX3D(this.stage, S.FX3D || [], TX, set.TOP, set.MATTOP); if (bed) this.fx3d.surf = (x, z) => bed.duvetY(x, z) - .012;   // bed: true 的字块落在被子上，压进去一点
    this.boards = (S.BOARD || []).map((b) => ({ ...b, t0: TX(b.t0), t1: TX(b.t1) }));
    this.lines = Object.values(TL.lines);
    this.over = new Overlay(S, TX);
    // 说话时手跟着比划：每个分句开头是一个「重音」，小机器人在那儿抬一下手（左右轮流，三种手势按句子挑），说完放下。导演表写 GESTURE = false 关掉
    this.claus = S.GESTURE === false ? [] : Object.values(TL.lines).flatMap((L) => L.clauses || []).filter((c) => (c.text || '').length >= 4).map((c) => c.start).sort((a, b) => a - b);
    this.steam = S.STEAM === false || Q.has('nosteam') ? null : new Steam(this.stage.scene, [set.DIM.mug.x, set.TOP + .084, set.DIM.mug.z]);   // 杯子里冒热气
    // 悬浮段（magic.js）。第一段默认 from: 'air'（照片从空中长出来），之后默认 'wall'（从墙上揭下来）；板上的内容和显示器同一套画法，不画窗口条
    const MG = (S.MAGIC || []).slice().sort((a, b) => TX(a.t0) - TX(b.t0)).map((m, i) => { const from = m.from ?? (i === 0 ? 'air' : 'wall');
      return { ...m, from, panel: m.panel && { ...m.panel, t0: m.panel.t0 !== undefined ? TX(m.panel.t0) : TX(m.t0) + (from === 'wall' ? 6.0 : 5.6), t1: TX(m.t1) } }; });
    if (MG.some((m) => TX(m.t1) - TX(m.t0) < 12)) console.warn('悬浮段短于 12 秒，照片来不及长出来再飞回去：', MG.map((m) => [m.t0, m.t1]));
    this.magic = MG.length ? new Magic(this.stage, this, set, bed, MG, (x) => (typeof x === 'number' ? x : TX(x)),
      (g, w, h, spec, t) => { const fn = ALL[spec.kind]; if (!fn) throw new Error('板上没有这种画面：' + spec.kind); setHead(spec.head ? { head: spec.head, t0: spec.t0, t } : null); setNoBar(true); fn(g, w, h, spec, t, this.data); setNoBar(false); setHead(null); }) : null;
  }

  // 某个机位在 t 时刻。
  // 'scr'：对着屏幕上的一点 (u, v)，从 yaw（左右，度）、pitch（上下，度）方向、dist 米外看；写了 u2 / v2 / dist2 / yaw2 / pitch2 就在镜头时长里缓缓移过去（跟着内容走）。
  // 'desk'：俯看桌面前沿，x → x2 跟着桌上的字块走。
  // 其他机位：shots.js 里 CAMS 的固定机位，加一种运镜：push 推近、orbit 绕、rise 升降、pan 平移、zoom 变焦。
  camAt(c, t) {
    const dt = t - c.t, span = Math.max(2.5, Math.min(c.span ?? c.dur ?? 6, c.dur ?? 6)), u = easeIO(clamp(dt / span));
    if (c.cam === 'desk') {                                                                   // h 高、back 往后退多少；看的点比字再靠近镜头一点，字落在画面中上部，不压字幕
      const L = (a, b, d) => b === undefined ? (a ?? d) : lerp(a ?? d, b, u), x = L(c.x, c.x2, 1.4), z = c.z ?? .665, TOP = this.set.TOP;
      const p = V([x + (c.side ?? 0), TOP + L(c.h, c.h2, .40), z + L(c.back, c.back2, .32)]), l = V([x, TOP, z]);
      return { p, l, focus: c.focus ? V(c.focus) : V([x, TOP, z]), mm: L(c.mm, c.mm2, 32), f: c.f ?? 4 };
    }
    if (c.cam === 'scr') {
      const L = (a, b, d) => b === undefined ? (a ?? d) : lerp(a ?? d, b, u);
      const creep = 1 - (c.creep ?? .04) * clamp(dt / Math.max(4, c.dur || 8));                // 停住以后也不全静止：极慢地再推一点
      const pt = scrPt(L(c.u, c.u2, .5), L(c.v, c.v2, .5)), dist = L(c.dist, c.dist2, .9) * creep, yaw = L(c.yaw, c.yaw2, 0) * Math.PI / 180, pitch = L(c.pitch, c.pitch2, 0) * Math.PI / 180;
      const p = pt.clone().add(V([Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)]).multiplyScalar(dist));
      const l = c.look ? V(c.look) : pt;
      return { p, l, focus: c.focus ? V(c.focus) : pt.clone(), mm: L(c.mm, c.mm2, 50), f: c.f ?? 5.6 };
    }
    const b = this.S.CAMS[c.cam]; if (!b) throw new Error('没有这个机位：' + c.cam);
    const d = c.drift || b.drift || [0, 0, 0], dl = c.driftL || [0, 0, 0];
    const p = V(b.p).add(V(d).multiplyScalar(dt)), l = V(b.l).add(V(dl).multiplyScalar(dt)); let mm = b.mm;
    const mv = c.move === 0 ? null : (c.move || { push: .08 });
    if (mv) { const k = u * Math.min(1, (c.dur || 6) / 6);
      if (mv.orbit) { const a = mv.orbit * k * Math.PI / 180, ox = p.x - l.x, oz = p.z - l.z; p.x = l.x + ox * Math.cos(a) - oz * Math.sin(a); p.z = l.z + ox * Math.sin(a) + oz * Math.cos(a); }
      if (mv.push) p.lerp(l, mv.push * k);
      if (mv.rise) { p.y += mv.rise * k; l.y += mv.rise * k * .35; }
      if (mv.pan) { p.x += mv.pan * k; l.x += mv.pan * k; }
      if (mv.zoom) mm += mv.zoom * k; }
    let focus = c.focus ? V(c.focus) : V(b.focus || b.l); if (c.fk) focus = p.clone().lerp(focus, c.fk);   // fk：对焦在镜头前面的立体字卡上，后面的小机器人和房间虚掉
    return { p, l, focus, mm: c.mm ?? mm, f: c.f ?? b.f };
  }
  poseAt(t) {
    if (Q.has('pose')) { const a = Q.get('pose').split(',').map(Number); return { p: V(a.slice(0, 3)), l: V(a.slice(3, 6)), focus: V(a.length > 9 ? a.slice(8, 11) : a.slice(3, 6)), mm: a[6] || 28, f: a[7] || 5.6 }; }   // 自检：?pose=px,py,pz,lx,ly,lz,mm,f[,fx,fy,fz]
    if (Q.has('cam')) { const b = this.S.CAMS[Q.get('cam')]; return { p: V(b.p), l: V(b.l), focus: V(b.focus || b.l), mm: b.mm, f: b.f }; }
    const L = this.cams; let i = 0; while (i + 1 < L.length && t >= L[i + 1].t) i++;
    const cur = this.camAt(L[i], t); if (i === 0) return cur;
    const d = L[i].d ?? 2.2; if (d <= 0 || t >= L[i].t + d) return cur;
    const prev = this.camAt(L[i - 1], t), u = ease5((t - L[i].t) / d), sh = (a, b) => a.clone().lerp(b, u);
    // 机位之间滑过去时，看的点和位置一起走；中间稍微往后让一点，免得两头都近的时候擦着屏幕过去
    const p = sh(prev.p, cur.p), l = sh(prev.l, cur.l), back = Math.sin(u * Math.PI) * (L[i].arc ?? .06);
    p.addScaledVector(p.clone().sub(l).normalize(), back);
    return { p, l, focus: sh(prev.focus, cur.focus), mm: lerp(prev.mm, cur.mm, u), f: lerp(prev.f, cur.f, u) };
  }

  // 小机器人的嘴有多大：有响度包络就照着它；还没配音的草稿，在每句话的起止之间按音节的节奏假装说话
  voice(t) {
    const e = this.env;
    if (e) { const f = t * e.fps, i = Math.floor(f), a = e.v[i] || 0, b = e.v[i + 1] || 0; return a + (b - a) * (f - i); }
    const L = this.lines.find((l) => t >= l.start && t < l.end); if (!L) return 0;
    const k = Math.floor((t - L.start) * 5.3), q = (t - L.start) * 5.3 - k;
    return (.35 + .4 * hash(k + L.start * 7)) * Math.sin(Math.PI * q) * Math.min(1, (L.end - t) * 6);
  }

  // 小机器人跳进屏幕：t0 前 0.8 秒从桌上沿一条弧线跳向屏幕上的落点，越来越小，进去以后由屏幕里的小机器人接着演；t1 后 0.8 秒原路跳回来
  jump(t) {
    const J = .8;
    for (const k of this.kin) {
      if (t < k.t0 - J || t > k.t1 + J) continue;
      const [x, y] = k.path[0].slice(1), [xe, ye] = k.path.at(-1).slice(1), tin = scrPt(x / 1600, y / 900), tout = scrPt(xe / 1600, ye / 900);
      tin.z += .01; tout.z += .01;
      let w, tgt; if (t < k.t0) { w = easeIO((t - (k.t0 - J)) / J); tgt = tin; } else if (t > k.t1) { w = 1 - easeIO((t - k.t1) / J); tgt = tout; } else return { hide: true };
      const pos = this.home.clone().lerp(tgt, w); pos.y += Math.sin(w * Math.PI) * .16;
      return { pos, s: this.K.s * (1 - .8 * w), hide: w > .97, w };
    }
    return null;
  }

  tick(t) {
    const pose = this.poseAt(t), K = this.K, toCam = Math.atan2(pose.p.x - K.x, pose.p.z - K.z) * 180 / Math.PI;
    const keys = this.kk; let i = 0; while (i + 1 < keys.length && t >= keys[i + 1].t) i++;
    const k = keys[i], kp = keys[Math.max(0, i - 1)], u = i === 0 ? 1 : ease(clamp((t - k.t) / (k.d || .45)));
    const Pm = mixObj(POSES[kp.pose || 'stand'], POSES[k.pose || 'stand'], u);
    const look = (q) => q.look === 'screen' ? -40 : (q.look === undefined || q.look === 'cam') ? toCam * .85 : q.look;
    let yaw = lerp(look(kp), look(k), u);
    const b = breathAt(t, 1), v = clamp(this.voice(t) * 1.3), talk = v > .03;
    let hop = k.hop ? Math.max(0, Math.sin(clamp((t - k.t) / .5) * Math.PI)) * .3 : 0;
    const face = { ...FACES[(i > 0 && t - k.t < .2 ? kp.face : k.face) || 'neutral'] };
    if (talk && (!k.face || k.face === 'speak')) Object.assign(face, FACES.speak);
    const bl = blinkAt(t, 3); face.open = [(face.open?.[0] ?? 1) * bl, (face.open?.[1] ?? 1) * bl];
    const nod = talk ? (Math.sin(t * 5.3) * 1.4 + Math.sin(t * 2.1 + 1)) * v : 0;
    const j = this.jump(t), h = this.hold;
    if (j?.hide) h.visible = false; else { h.visible = true; if (j) { h.position.copy(j.pos); h.scale.setScalar(j.s); yaw = -70; } else { h.position.copy(this.home); h.scale.setScalar(K.s); } }
    const mg = this.magic?.kaka(t, this.home); let bow = 0, Pq = Pm;                // 悬浮段：飞去坐墩、在那儿讲、再飞回来
    if (mg) { h.visible = true; h.position.copy(mg.pos); h.scale.setScalar(K.s); yaw = mg.yaw ?? Math.atan2(pose.p.x - mg.pos.x, pose.p.z - mg.pos.z) * 180 / Math.PI * .85; bow = mg.lean; if (mg.pose) Pq = mixObj(Pm, mg.pose.from ? mixObj(POSES[mg.pose.from], POSES[mg.pose.name], mg.pose.u) : POSES[mg.pose.name], mg.pose.w); }   // from：相邻两个姿势交叉过渡，不先回站姿
    { const rest = (a) => Math.abs(a[0] - 12) < 7 && Math.abs(a[1] - 8) < 7;                // 只在两手垂着的姿势里比划，导演表写了动作的地方不动
      if (this.claus.length && rest(Pq.aL) && rest(Pq.aR) && !(mg && mg.thrust > .05)) {
        const vs = (this.voice(t) + this.voice(t - .08) + this.voice(t - .16) + this.voice(t - .24)) / 4, gate = clamp((vs - .03) * 6);
        let lo = 0, hi = this.claus.length - 1, ci = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (this.claus[mid] <= t) { ci = mid; lo = mid + 1; } else hi = mid - 1; }
        if (ci >= 0 && gate > 0) { const dt = t - this.claus[ci], nxt = this.claus[ci + 1] ?? 1e9, a = easeOut(clamp(dt / .28)) * (1 - ease(clamp((dt - .7) / Math.min(.9, nxt - this.claus[ci])))) * gate;
          const kind = Math.floor(hash(ci * 7.31) * 3), G = [[44, 30, 26, 42], [54, 16, 34, 48], [30, 24, 20, 30]][kind], side = ci % 2;
          const mixA = (A, w) => A.map((x, n) => x + (G[n] - x) * w + (n === 3 ? 7 * vs * Math.sin(t * 4.7 + n) : 0));
          Pq = { ...Pq, aR: side || kind === 2 ? mixA(Pq.aR, a) : Pq.aR, aL: !side || kind === 2 ? mixA(Pq.aL, a * (kind === 2 ? .8 : 1)) : Pq.aL, hRoll: Pq.hRoll + (side ? -2.5 : 2.5) * a }; } } }
    const S = { ...STATE0, t, yaw, hop, legK: [1 + b * .024, 1 + b * .024],
      body: [Pq.lean, Pq.bow + bow, Pq.twist], head: [Pq.hRoll + nod * .5, Pq.hPitch + b * .6 + nod * 1.2, Pq.hYaw], armL: Pq.aL, armR: Pq.aR, thumb: [Pq.thumbL, Pq.thumbR],
      antenna: [Math.sin(t * 1.7) * 3 + nod * 1.5, Math.sin(t * 2.3) * 2], face,
      audio: { open: v, bright: .5, wave: null, level: v }, meter: [v > .1 ? 1 : 0, v > .35 ? 1 : 0, v > .6 ? 1 : 0] };
    applyState(this.rig, S);
    this.fx3d.update(t, (x) => this.poseAt(x));
    this.magic?.update(t, h.position);
    this.light(t);
    this.steam?.update(t);
    this.drawBoard(t);
  }
  // 光随时间变。导演表 LIGHT：[{ at, p: 'lowsun' | 'day' | 'afternoon' | 'dusk' | 'night' | {…}, bed: 0 到 1（床头壁灯）, d: 过渡秒数 }]
  // 百叶：导演表 BLINDS：[{ at, a: 角度（弧度，-.5 平时，-1.35 合上，-.15 全开）, d: 秒 }]；转的时候每片错开一点。
  // 环境反射只在最近一个硬切（d: 0 的镜头）重拍，所以整段换光放在硬切上。自检：?lt=night&bed=1 固定一种光，?bl=-1.35 固定百叶
  light(t) {
    if (!this._lt) { const L = Q.get('lt') ? [{ at: 0, p: Q.get('lt'), bed: +(Q.get('bed') ?? 1) }] : Array.isArray(this.S.LIGHT) && !Q.has('light') ? this.S.LIGHT : [];
      this._lt = L.map((k) => ({ ...k, t: TX(k.at) })).sort((a, b) => a.t - b.t);
      const B = Q.get('bl') ? [{ at: 0, a: +Q.get('bl') }] : this.S.BLINDS || []; this._bl = B.map((k) => ({ ...k, t: TX(k.at) })).sort((a, b) => a.t - b.t); }
    const K = this._lt, PR = this.set.PRESET;
    if (K.length && this.set.setLight) {
      const get = (k) => { const p = typeof k.p === 'string' ? PR[k.p] : k.p; if (!p) throw new Error('LIGHT 里没有这种光：' + k.p); return { bed: 0, ...p, ...(k.bed !== undefined ? { bed: k.bed } : {}) }; };
      const at = (x) => { let i = 0; while (i + 1 < K.length && x >= K[i + 1].t) i++; const a = K[Math.max(0, i - 1)], b = K[i], u = i === 0 ? 1 : easeIO(clamp((x - b.t) / (b.d ?? 4))); return this.set.mixLight(get(a), get(b), u); };
      let tc = 0; for (const c of this.cams) { if (c.t > t) break; if ((c.d ?? 2.2) <= 0 || c.i === 0) tc = c.t; }   // 最近一个硬切
      const p = at(t); this.set.setLight(p, 'cut@' + tc.toFixed(3), at(tc)); this.bed?.lamp.set(p.bed ?? 0); }
    const BL = this._bl; if (BL.length && this.set.setTilt) {
      let i = 0; while (i + 1 < BL.length && t >= BL[i + 1].t) i++; const a = BL[Math.max(0, i - 1)], b = BL[i], u = i === 0 ? 1 : clamp((t - b.t) / (b.d ?? 1.6));
      this.set.setTilt(lerp(a.a, b.a, easeIO(u)), .05 * Math.sin(Math.PI * u)); }
  }
  // 快的那几秒要多采样：运动模糊是一个个采样叠出来的，飞得快的东西在 16 个采样下会一格一格地重影。
  // 悬浮段自动算一段，导演表 NS: [{ t0, t1, ns: 32 }] 可以再加。只在出片（网址上的 ns 不小于 12）时生效，抽帧检查用 ns=4 不受影响
  fastSpans() { const M = (this.S.MAGIC || []).map((m) => [TX(m.t0) - .3, TX(m.t1) + .3, 32]); return M.concat((this.S.NS || []).map((x) => [TX(x.t0), TX(x.t1), x.ns ?? 32])); }
  // 运动模糊：harness3 的每个采样在自己的快门时刻调它，只推进快的东西（飞的小机器人、照片、掉落的字块）。慢的东西整帧只算一次
  tickFast(t) {
    const mg = this.magic?.kaka(t, this.home); if (mg) this.hold.position.copy(mg.pos);
    this.magic?.update(t, this.hold.position, true); this.fx3d.update(t, (x) => this.poseAt(x));
  }
  curBoard(t) { return this.boards.find((b) => t >= b.t0 - .8 && t < b.t1 + .8); }
  // 软木板上的大白纸：t0 前 0.8 秒从上沿往下展开，t1 后卷回去
  drawBoard(t) {
    const sh = this.extras?.sheet; if (!sh) return; const b = this.curBoard(t); sh.g.visible = !!b; if (!b) return;
    const u = Math.min(easeOut(P(t, b.t0 - .8, .8)), 1 - easeIO(P(t, b.t1, .8))); sh.g.scale.y = Math.max(.001, u);
    const c = sh.canvas, g = c.getContext('2d'); BKINDS[b.kind](g, c.width, c.height, b, Math.max(t, b.t0)); sh.tex.needsUpdate = true;
  }

  curScreens(t) { return this.screens.filter((s) => t >= s.t0 - .001 && t < s.t1).slice(-2); }
  async prepare(t) {
    const want = new Set();
    for (const s of this.curScreens(t)) { if (s.src) want.add(s.src); if (s.a) want.add(s.a.src ?? s.a); if (s.b) want.add(s.b.src ?? s.b); if (s.kind === 'video') want.add(frameSrc(s, t)); for (const u of needsOf(s, t)) want.add(u); }
    if (this.kin.some((k) => t >= k.t0 - 1 && t < k.t1 + 1)) want.add('media/kaka.png');
    for (const u of boardNeeds(this.curBoard(t))) want.add(u);
    for (const u of this.over.needs(t)) want.add(u);
    const mgp = this.magic?.active(t)?.panel; if (mgp) { if (mgp.src) want.add(mgp.src); for (const u of needsOf(mgp, t)) want.add(u); }
    forget(want); await Promise.all([...want].map(need));
  }
  // 换内容的转场：新的一层写 tr：'push'（整页推过去）、'rise'（从下面升上来）、'cut'（直接换）、默认是淡入加一点点缩放
  drawScreen(g, w, h, t) {
    const L = this.curScreens(t); g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const top = L.length > 1 ? L.at(-1) : null, tr = top?.tr || 'fade', D = tr === 'fade' ? .45 : .7, u = top && tr !== 'cut' ? easeIO(P(t, top.t0, D)) : 1;
    L.forEach((s) => {
      const isTop = s === top; g.save();
      if (top && tr === 'push') g.translate(isTop ? (1 - u) * w : -u * w * .35, 0);
      else if (top && tr === 'rise') { if (isTop) g.translate(0, (1 - u) * h); }
      else if (isTop) { g.globalAlpha = u; const z = 1.04 - .04 * u; g.translate(w / 2, h / 2); g.scale(z, z); g.translate(-w / 2, -h / 2); }
      const fn = ALL[s.kind]; if (!fn) throw new Error('屏幕里没有这种画面：' + s.kind);
      setHead(s.head ? { head: s.head, t0: s.t0, t } : null); fn(g, w, h, s, t, this.data); setHead(null); applyFx(g, w, h, s, t); g.restore(); });
    drawKaka(g, w, h, this.kin, t);
  }
}

// CALM：导演表写 CALM = ['talk']，在这些机位的镜头里显示器只留一层安静的底，不画大标题和字（图片、视频照常）。
// 小机器人近景里显示器在画面一角，屏幕正中的大字正好被画框切掉一半，虚着压在章节进度条上，像出了错。远景和全屏镜头里照常显示。
const KEEP_ON_CALM = new Set(['picture', 'video', 'filmstrip', 'versus', 'tri']);
function calmScreens(list, cams, calm) {
  const names = new Set([].concat(calm || [])); if (!names.size) return list;
  const spans = cams.filter((c) => names.has(c.cam)).map((c) => [c.t, c.t + c.dur]), out = [];
  for (const s of list) {
    if (KEEP_ON_CALM.has(s.kind)) { out.push(s); continue; }
    let cur = s.t0;
    for (const [a, b] of spans) { if (b <= cur || a >= s.t1) continue; const a0 = Math.max(a, cur), b0 = Math.min(b, s.t1);
      if (a0 > cur + .05) out.push(cur === s.t0 ? { ...s, t1: a0 } : { ...s, t0: cur, t1: a0, tr: 'cut' });
      out.push({ kind: 'bigwords', t0: a0, t1: b0, kicker: '', big: '', calm: 1, tr: 'cut' }); cur = b0; }
    if (cur < s.t1 - .05) out.push(cur === s.t0 ? s : { ...s, t0: cur, tr: 'cut' }); else if (cur < s.t1 && out.length) out[out.length - 1].t1 = s.t1;
  }
  return out;
}
