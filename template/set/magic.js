// 悬浮段（导演表的 MAGIC）：小机器人飞到地毯上的坐墩，举起两手，照片在它头顶的空中一张张长出来，拼成一块斜着的板，
// 板上放这一句的内容；讲完照片翻回正面，飞到床头上方的墙上贴好，变成照片墙。
// 为什么这样设计（作者试过别的，都被打回来）：凭空打开一扇「传送门」或者画一圈符文，观众会觉得没来由；东西要有一个说得通的来处。
// 所以照片要么一粒粒从小机器人手心上方长出来（from: 'air'，第一段的默认），要么本来就贴在墙上、被揭下来（from: 'wall'，之后各段的默认）。
// 第一段（from: 'air'）：
//   1 小机器人从桌上起飞，脚底两团推进的光，落在地毯上的针织坐墩上，坐墩被压得一扁。
//   2 举起两只手：床上的毛绒小熊、抱枕，床头柜上的闹钟和书慢慢浮起来（导演表 float 里写哪几样）。
//   3 手心上方一粒一粒冒出暖色的小光点，往上飘；每一粒飘到自己那一格时，先用金线把一个方块「画」出来（线一边描、方块一边长大），
//      方块描完，纸面再慢慢显出来。离手心近的格子先长，往外一圈圈长满。
//   4 7 × 4 张拼成一块 16:9 的板，悬在小机器人头顶，和床、和前墙都斜着（默认面朝 135°，即书桌那个角）；板上亮出这一句的内容。
//   5 收：内容灭掉；照片一张张翻到有画的那一面，飞到床头上方的墙上，贴上去按一下，胶带出现，金线灭掉。从这以后墙上就一直是这面照片墙。
// 以后的段（from: 'wall'）照片已经在墙上了：描金边、胶带那头松开、下沿翘起、离墙、翻面，飞去拼板，最后再飞回墙上。
// 照片墙的可见性只跟 t 走：第一段开始以前全部藏起来；第一段里每张照片从它冒出来那一刻起可见；第一段结束以后一直可见。没有任何悬浮段时照片墙一直在。
// 一段至少 12 秒（起飞 1.7 秒，照片长出来到亮内容 5.6 秒，收回去 4.4 秒）。时间表在 plan() 里。
// end: 'gather' 的段不上墙：讲完照片缩回一粒粒光点，飞回小机器人手心（适合放在前半段，照片墙留给后面那段第一次贴）。
// VISIT（setVisits / visitAt）：小机器人飞到桌上别的地方办点事再飞回来，起落和悬浮段同一套弧线、推进光和前倾；笔记本那一段用（notebook.js）。
import * as THREE from 'three';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, u) => a + (b - a) * u;
const P = (t, a, d) => clamp((t - a) / d), sm = (u) => u * u * (3 - 2 * u), eio = (u) => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const back = (u, k = 1.6) => 1 + (k + 1) * Math.pow(u - 1, 3) + k * Math.pow(u - 1, 2), eout = (u) => 1 - Math.pow(1 - u, 3);
const hash = (i, s = 0) => { let h = Math.imul(i * 374761393 + s * 668265263 | 0, 1274126177); h ^= h >>> 15; return ((Math.imul(h, 2246822519) ^ (h >>> 13)) >>> 0) / 4294967296; };
const V = (a) => new THREE.Vector3(...a), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const GOLD = new THREE.Color(3.0, 1.7, .55), DUST = new THREE.Color(.55, .5, .44), WARM = new THREE.Color(3.0, 1.75, .65);
export const POUF = { x: 1.86, z: 2.30, r: .21, h: .36 };                 // 地毯上的针织坐墩：小机器人落脚的地方
// 板子默认：悬在小机器人头顶稍后（下沿离地约 0.77，小机器人头顶约 0.56），面朝 135°（书桌那个角），和床、前墙都成 45°；离前墙 0.5 米以上，离床边 0.24 米
export const PANEL0 = { c: [1.78, 1.02, 2.33], yaw: 135, w: .9 };

export function glowTex() { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.18, 'rgba(255,255,255,.55)'); r.addColorStop(.45, 'rgba(255,255,255,.12)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

// 一堆细长的光条：每一根给两个端点，画成一根很细的圆柱（金线、火星、灰都用它）
export class Streaks {
  constructor(parent, n, color, r = .0016) {
    this.mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), n);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); this.mesh.frustumCulled = false; this.mesh.userData.fixed = true; this.mesh.castShadow = this.mesh.receiveShadow = false;
    this.n = n; this.col = color; this.r = r; this.k = 0; this.o = new THREE.Object3D(); this.c = new THREE.Color(); parent.add(this.mesh);
  }
  begin() { this.k = 0; }
  add(a, b, bright, r = this.r) { if (this.k >= this.n || bright <= .003) return; const o = this.o, d = b.clone().sub(a), L = Math.max(d.length(), 1e-4);
    o.position.copy(a).addScaledVector(d, .5); o.quaternion.setFromUnitVectors(Y, d.multiplyScalar(1 / L)); o.scale.set(r, L, r); o.updateMatrix();
    this.mesh.setMatrixAt(this.k, o.matrix); this.mesh.setColorAt(this.k, this.c.copy(this.col).multiplyScalar(bright)); this.k++; }
  end() { this.mesh.count = this.k; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; this.mesh.visible = this.k > 0; }
}
const bez = (a, b, c, d, u) => { const v = 1 - u; return a.clone().multiplyScalar(v * v * v).addScaledVector(b, 3 * v * v * u).addScaledVector(c, 3 * v * u * u).addScaledVector(d, u * u * u); };

export class Magic {
  // film：小机器人（kaka）的位置和姿势；set / bed：找浮起来的东西，bed.photos 是照片墙；list：导演表的 MAGIC（film.js 已按时间排好、补好 from）；draw(g, w, h, spec, t)：板上的内容
  constructor(stage, film, set, bed, list, TX, draw) {
    this.stage = stage; this.film = film; this.draw = draw; const scene = stage.scene, g = this.g = new THREE.Group(); g.name = 'magic'; scene.add(g);
    this.ev = (list || []).map((m, i) => ({ ...m, t0: TX(m.t0), t1: TX(m.t1), from: m.from ?? (i === 0 ? 'air' : 'wall') })).sort((a, b) => a.t0 - b.t0);
    this.air = this.ev.find((m) => m.from === 'air' && m.end !== 'gather') || null;   // 照片墙是哪一段「长」出来的（end: 'gather' 的段收回小机器人手心，不上墙）
    this.wall = bed?.photos || null;
    const glow = this.glow = glowTex();
    // 坐墩：针织的圆墩，顶面微微鼓；落地时被压扁一下
    { const prof = [[0, 0], [POUF.r * .92, 0], [POUF.r, .03], [POUF.r * 1.03, POUF.h * .5], [POUF.r, POUF.h - .035], [POUF.r * .9, POUF.h - .008], [POUF.r * .5, POUF.h + .006], [0, POUF.h + .01]];
      const knit = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 256; const q = c.getContext('2d'); q.fillStyle = '#b5a48a'; q.fillRect(0, 0, 256, 256);
        for (let x = 0; x < 16; x++) for (let y = 0; y < 22; y++) { q.fillStyle = `rgba(255,248,235,${.18 + .1 * hash(x * 31 + y, 3)})`; q.beginPath(); q.ellipse(x * 16 + 8, y * 11.6 + 6, 6.2, 5.6, (x % 2 ? .5 : -.5), 0, 7); q.fill();
          q.strokeStyle = 'rgba(70,55,40,.35)'; q.lineWidth = 1.2; q.stroke(); }
        const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 4); t.colorSpace = THREE.SRGBColorSpace; return t; })();
      const m = new THREE.MeshPhysicalMaterial({ map: knit, bumpMap: knit, bumpScale: 1.6, roughness: .95, sheen: .8, sheenColor: new THREE.Color(0xfff4e0) });
      this.pouf = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 64), m); this.pouf.position.set(POUF.x, 0, POUF.z); this.pouf.castShadow = this.pouf.receiveShadow = true; scene.add(this.pouf); }
    // 脚底推进：两团光 + 一盏照地面的小灯 + 往下拖的几道细光
    this.jets = film.rig.feet.map((f) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(1.6, 2.4, 3.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      s.position.set(0, -.15, .05); s.scale.set(.0001, .0001, 1); s.userData.fixed = true; f.add(s); return s; });
    this.jetLight = new THREE.PointLight(0xa8d4ff, 0, 1.6, 2); scene.add(this.jetLight);
    this.trail = new Streaks(g, 60, new THREE.Color(1.4, 2.2, 3.2), .0012);
    // 照片那一边：金线（wall 段线头还有两粒小火星）、灰、每张照片「出生」时的那粒小光点；手心上方的一盏暖灯；金线照墙的小灯；板子的面光
    const n = this.wall?.cards.length || 0;
    this.edge = new Streaks(g, n * 4 + n * 2 + 8, GOLD, .0009);
    this.dust = new Streaks(g, n * 8, DUST, .0012);
    this.seeds = Array.from({ length: n }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: WARM, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.userData.fixed = true; s.visible = false; g.add(s); return s; });
    this.handLight = new THREE.PointLight(0xffc27a, 0, 1.4, 2); scene.add(this.handLight);
    this.wallLight = new THREE.PointLight(0xffb866, 0, 2.2, 2); scene.add(this.wallLight);
    this.panelLight = new THREE.PointLight(0xffe2b8, 0, 4, 2); scene.add(this.panelLight);
    this.tmp = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
    // 浮起来的东西：名字 → Object3D
    this.things = {}; const reg = (k, o) => { if (o) this.things[k] = o; };
    reg('plush', bed?.plush); reg('cushion', bed?.cushion); reg('pillow', bed?.pillow); reg('clock', bed?.clockObj); reg('book', bed?.bookObj);
    scene.traverse((o) => { if (o.userData.stop && !this.things[o.userData.stop]) this.things[o.userData.stop] = o; });
    this.base = new Map(); this.dirty = true; this.built = null;
    this.wall?.cards.forEach((c) => c.reset());
  }
  active(t) { return this.ev.find((m) => t >= m.t0 - .01 && t <= m.t1 + .01) || null; }

  // 这一段的板子：中心、朝向、每一格的位置；照片排先后（air：离小机器人手心近的先长；wall：离小机器人近的先下墙）
  build(m) {
    if (this.built === m) return; this.built = m; const pn = m.panel || {}, W = pn.w ?? PANEL0.w, H = W * 9 / 16, cols = this.wall.P.cols, rows = this.wall.P.rows;
    const c = V(pn.c || PANEL0.c), yaw = pn.face ? Math.atan2(pn.face[0] - c.x, pn.face[2] - c.z) : (pn.yaw ?? PANEL0.yaw) * Math.PI / 180;
    const q = new THREE.Quaternion().setFromAxisAngle(Y, yaw); if (pn.tilt) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -pn.tilt * Math.PI / 180));   // tilt：板面往上仰几度
    const nrm = Z.clone().applyQuaternion(q), ch = H / rows, cw = W / cols, sc = (ch - W * .0045) / this.wall.P.s, flip = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, Math.PI));   // 翻过来：黑背面朝前
    const slots = this.wall.cards.map((cd) => new THREE.Vector3((cd.i + .5) * cw - W / 2, H / 2 - (cd.j + .5) * ch, 0).applyQuaternion(q).add(c));
    const src = m.from === 'air' ? new THREE.Vector3(POUF.x, POUF.h + .2, POUF.z) : new THREE.Vector3(POUF.x, POUF.h + .15, POUF.z);
    const ord = m.from === 'air' ? slots.map((s) => s.distanceTo(src)) : this.wall.cards.map((cd) => cd.home.p.distanceTo(src)), lo = Math.min(...ord), hi = Math.max(...ord);
    this.panel = { c, q, nrm, W, H, sc, flip, slots, rank: ord.map((d, k) => (d - lo) / Math.max(1e-6, hi - lo) * .85 + hash(k, 77) * .15) };
  }

  // 一段的时间表（都相对 t0 / t1）。air：birth0 起每张照片在 spread 秒里依次冒出来；wall：lit0 起依次描金边、下墙
  plan(m) { const t0 = m.t0, t1 = m.t1, air = m.from === 'air';
    return { air, gather: air && m.end === 'gather', fly0: t0, land: t0 + 1.7, wave: t0 + 1.9, float0: t0 + 2.2, birth0: t0 + 2.3, lit0: t0 + 2.5, spread: m.spread ?? (air ? 1.6 : 1.0), rise: .8, fly: 1.15,
      content: t0 + (air ? 5.6 : 6.0), unform: t1 - 4.4, rspread: 1.0, rfly: 1.4, settle: t1 - 2.6, back: t1 - 1.6, end: t1 }; }
  // 一张照片的几个时刻。air：B 冒出来、A 到位；wall：L 亮、Pk 松开、G 离墙、A 到位。回程：R0 起飞、RA 碰到墙、S 按好
  times(T, r) { const R0 = T.unform + r * T.rspread, RA = R0 + T.rfly, S = RA + .3;
    if (T.air) { const B = T.birth0 + r * T.spread, G0 = B + T.rise - .1; return { B, L: B, G0, A: G0 + .6, R0, RA, S }; }   // G0：光点到了，开始描边
    const L = T.lit0 + r * T.spread, Pk = L + .4, G = Pk + .32; return { L, Pk, G, A: G + T.fly, R0, RA, S }; }

  // 小机器人这一刻在哪、朝哪、做什么姿势；不在这一段里就返回 null
  kaka(t, home) {
    const vz = this.visitAt(t, home); if (vz) return vz;
    const m = this.active(t); if (!m) return null; const T = this.plan(m), perch = new THREE.Vector3(POUF.x, POUF.h + this.squash(t, T) + .004, POUF.z);
    const arc = (a, b, u, h) => { const p = a.clone().lerp(b, u); p.y += Math.sin(Math.PI * u) * h; return p; };
    let pos, thrust = 0, yaw = null, lean = 0;
    if (t < T.land) { const u = eio(P(t, T.fly0, T.land - T.fly0)); pos = arc(home, perch, u, .55); thrust = Math.min(1, P(t, T.fly0 - .15, .3)) * (1 - .6 * P(t, T.land - .25, .25)); yaw = Math.atan2(perch.x - home.x, perch.z - home.z) * 180 / Math.PI; lean = 14 * Math.sin(Math.PI * u); }
    else if (t > T.back) { const u = eio(P(t, T.back, T.end - T.back)); pos = arc(perch, home, u, .55); thrust = Math.min(1, P(t, T.back - .1, .25)) * (1 - P(t, T.end - .2, .2)); yaw = Math.atan2(home.x - perch.x, home.z - perch.z) * 180 / Math.PI; lean = 14 * Math.sin(Math.PI * u); }
    else { pos = perch; if (t > T.land && t < T.land + .35) thrust = .5 * (1 - P(t, T.land, .35)); }
    // 姿势：起飞和回程举一只手（像超人）；air：落下后两手举过头顶，照片从手心上方一粒粒冒出来，拼好以后两手摊开讲；wall：先挥手
    // 每一段在两头各用 0.3 秒淡入淡出；挨着的两段正好交叉过渡（film.js 用 from / u 把两个姿势混起来）
    const segs = [[T.fly0, T.land, 'pointUp'], ...(T.air ? [[T.wave, T.content - .2, 'cheer'], [T.content - .2, T.gather ? T.unform - .1 : T.unform, m.pose ?? 'presentBoth'], ...(T.gather ? [[T.unform - .1, T.back, 'cheer']] : [])] : [[T.wave, T.wave + 1.2, 'wave'], [T.wave + 1.2, T.unform, m.pose ?? 'presentBoth']]), [T.back, T.end, 'pointUp']];
    const ws = segs.map(([a, b, name]) => ({ name, w: sm(P(t, a - .15, .3)) * (1 - sm(P(t, b - .15, .3))) })).filter((q) => q.w > .001);
    const pose = !ws.length ? null : ws.length === 1 ? ws[0] : { from: ws[0].name, name: ws[1].name, w: Math.min(1, ws[0].w + ws[1].w), u: ws[1].w / (ws[0].w + ws[1].w) };
    return { pos, thrust, yaw, lean, pose };
  }
  // 小机器人飞到桌上别的地方办点事再飞回来（导演表 VISIT：[{ t0, t1, to: [x, z], yaw, pose }]）。笔记本那一段用：落在本子右后方，
  // notebook.aim(t) 有目标时抬手（point），光线从手心拉过去；没目标时摆 pose。起落用和悬浮段一样的弧线、推进光和前倾
  setVisits(list, TX) { this.visits = (list || []).map((v) => ({ ...v, t0: TX(v.t0), t1: TX(v.t1) })); }
  visitAt(t, home) {
    for (const v of this.visits || []) { if (t < v.t0 - .01 || t > v.t1 + .01) continue;
      const F = v.fly ?? 1.3, spot = new THREE.Vector3(v.to[0], home.y, v.to[1]), land = v.t0 + F, back = v.t1 - F, deg = (d) => Math.atan2(d.x, d.z) * 180 / Math.PI;
      const arc = (a, b, u, h) => { const p = a.clone().lerp(b, u); p.y += Math.sin(Math.PI * u) * h; return p; };
      let pos, thrust = 0, yaw = v.yaw ?? -60, lean = 0;
      if (t < land) { const u = eio(P(t, v.t0, F)); pos = arc(home, spot, u, .2); thrust = Math.min(1, P(t, v.t0 - .15, .3)) * (1 - .6 * P(t, land - .25, .25)); yaw = deg(spot.clone().sub(home)); lean = 14 * Math.sin(Math.PI * u); }
      else if (t > back) { const u = eio(P(t, back, v.t1 - back)); pos = arc(spot, home, u, .2); thrust = Math.min(1, P(t, back - .1, .25)) * (1 - P(t, v.t1 - .2, .2)); yaw = deg(home.clone().sub(spot)); lean = 14 * Math.sin(Math.PI * u); }
      const nb = this.film.notebook, near = [-.3, -.2, -.1, 0, .1, .2, .3].map((d) => nb?.aim(t + d)), aimW = near.filter(Boolean).length / near.length;
      if (!pos) { pos = spot.clone(); if (t < land + .35) thrust = .5 * (1 - P(t, land, .35)); const k = P(t, land, .45); yaw = lerp(deg(spot.clone().sub(home)), yaw, sm(k));
        // 有目标时身子转向目标（前后 0.3 秒取平均，换目标时慢慢转过去），抬起的手才对得上光线
        const hit = near.filter(Boolean); if (hit.length) { const c = hit.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / hit.length); yaw = lerp(yaw, deg(c.sub(pos)) + (v.aimOff ?? 0), sm(aimW)); } }
      // 姿势：飞的时候举一只手；落地以后有目标就 point（前后 0.3 秒淡入淡出），没有就 v.pose
      const fly = Math.max(sm(1 - P(t, land - .15, .3)) * (t < land + .2 ? 1 : 0), t > back - .15 ? sm(P(t, back - .15, .3)) : 0);
      let pose = null;
      if (fly > .001) pose = { name: 'pointUp', w: fly };
      else if (aimW > .001) pose = v.pose ? { from: v.pose, name: 'reach', w: 1, u: sm(aimW) } : { name: 'reach', w: sm(aimW) };
      else if (v.pose) pose = { name: v.pose, w: 1 };
      return { pos, thrust, yaw, lean, pose };
    }
    return null;
  }
  squash(t, T) { const a = t - T.land, b = t - T.back; let s = 0; if (a > 0 && a < .6) s -= .035 * Math.exp(-a * 7) * Math.cos(a * 22); if (b > -.15 && b < .5) s -= .02 * Math.exp(-Math.max(0, b) * 7) * Math.sin(P(t, T.back - .15, .15) * Math.PI); return s; }

  // 小机器人两只手的位置（这一帧的姿势已经摆好）
  hands() { const h = this.film.hold; h.updateWorldMatrix(false, true); return this.film.rig.arms.map((a) => a.hand.getWorldPosition(new THREE.Vector3())); }

  // 一张照片在 t 时刻：位置、朝向、大小、透明度、胶带，和金线（亮度 e、描到哪 tr）
  card(cd, t, T, H2) {
    const pn = this.panel, r = pn.rank[cd.k], k = this.times(T, r), slot = pn.slots[cd.k], o = this.tmp, nW = cd.nW;
    const bob = new THREE.Vector3(0, .012 * Math.sin(t * .9), 0), qP = pn.flip;
    let p, q, s = 1, e = 0, where = 'wall', vis = true, op = 1, tape = 1, seed = 0, tr = 1, sp = null;
    const settle = (pp) => { if (t > k.A) pp.addScaledVector(pn.nrm, -.016 * Math.sin(P(t, k.A, .3) * Math.PI) * (1 - P(t, k.A, .3))); };   // 落进格子时往里一顶
    if (t < k.R0) {                                                                                                           // ---- 去程 ----
      if (T.air) {                                                                                                            // 凭空长出来
        // 先是一粒暖光从小机器人手心上方飘起来，飘到自己那一格；到了以后在原地用金线描出一个方块（线一边描、方块一边从小长到整格，微微转正），再慢慢显出纸面
        if (t < k.B) return { vis: false, k };
        const u = P(t, k.B, T.rise), h = H2[cd.k % 2].clone().add(new THREE.Vector3(0, .03, 0)), sd = hash(cd.k, 21) - .5;
        const c1 = h.clone().add(new THREE.Vector3(sd * .1, .18 + hash(cd.k, 22) * .08, 0)), c2 = slot.clone().addScaledVector(pn.nrm, .05 + hash(cd.k, 23) * .06).add(new THREE.Vector3(0, -.08, 0));
        sp = u < 1 ? bez(h, c1, c2, slot, eio(u)) : slot.clone(); sp.addScaledVector(bob, sm(u));
        const gu = P(t, k.G0, .6), g = eout(gu);
        p = slot.clone().addScaledVector(pn.nrm, .02 * (1 - g)); settle(p); p.addScaledVector(bob, 1);
        q = qP.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(pn.nrm, (hash(cd.k, 24) - .5) * .6 * (1 - g)));
        s = pn.sc * (.1 + .9 * g); tr = gu; op = sm(P(t, k.G0 + .45, .45)); tape = 0; seed = P(t, k.B, .12) * (1 - sm(P(t, k.G0 - .05, .35)));
        e = t < k.A + .2 ? 1.3 : lerp(1.3, .55, P(t, k.A + .2, .5)) * (1 - .82 * P(t, T.content, .6)); where = t < k.G0 ? 'seed' : 'panel';
      } else {                                                                                                                // 从墙上揭下来
        const peelA = .26, peelO = .014, lift = (u) => cd.pose(peelA * u, peelO * u, { p: new THREE.Vector3(), q: new THREE.Quaternion() });
        tr = P(t, k.L, .45);
        if (t < k.Pk) { cd.pose(0, 0, o); p = o.p.clone(); q = o.q.clone(); }
        else if (t < k.G) { const w = lift(eout(P(t, k.Pk, k.G - k.Pk))); p = w.p; q = w.q; }                                   // 胶带松开，下沿先翘起来
        else { const w = lift(1), u = P(t, k.G, T.fly), e2 = eio(u), sd = (hash(cd.k, 5) - .5) * .5;                         // 离墙，飞到三成才翻面
          const c1 = w.p.clone().addScaledVector(nW, .32).add(new THREE.Vector3(sd * .3, .12 + hash(cd.k, 6) * .18, 0)), c2 = slot.clone().addScaledVector(pn.nrm, .28 + hash(cd.k, 7) * .2).add(new THREE.Vector3(0, sd * .2, 0));
          p = u < 1 ? bez(w.p, c1, c2, slot, e2) : slot.clone(); settle(p); p.addScaledVector(bob, sm(u));
          const ax = new THREE.Vector3(hash(cd.k, 8) - .5, hash(cd.k, 9) - .5, hash(cd.k, 10) - .5).normalize();
          q = w.q.clone().slerp(qP, sm(P(u, .3, .6))).premultiply(new THREE.Quaternion().setFromAxisAngle(ax, Math.sin(Math.PI * e2) * (.35 + hash(cd.k, 11) * .4))); s = lerp(1, pn.sc, sm(u)); where = u < 1 ? 'fly' : 'panel'; }
        if (t >= k.L) e = t < k.A ? lerp(1.25, .7, P(t, k.L + .45, .6)) : lerp(1.2, .55, P(t, k.A, .5)) * (1 - .82 * P(t, T.content, .6));
      }
    } else if (T.gather) {                                                                                                    // ---- 收回：金线倒着收、方块缩回一粒光点，再飞回小机器人手心（不上墙） ----
      const a = P(t, k.R0, .6), g = 1 - eio(a), u = P(t, k.R0 + .5, .85); if (u >= 1) return { vis: false, k };
      const h = H2[cd.k % 2].clone().add(new THREE.Vector3(0, .03, 0)), sd = hash(cd.k, 21) - .5;
      const c2 = slot.clone().addScaledVector(pn.nrm, .05 + hash(cd.k, 23) * .06).add(new THREE.Vector3(0, -.08, 0)), c1 = h.clone().add(new THREE.Vector3(sd * .1, .18 + hash(cd.k, 22) * .08, 0));
      p = slot.clone().addScaledVector(bob, 1); q = qP.clone(); s = pn.sc * (.1 + .9 * g); tr = g; tape = 0; op = 1 - sm(P(t, k.R0 + .1, .4));
      e = lerp(.1, 1.3, sm(P(t, k.R0, .2))); where = a < 1 ? 'panel' : 'seed';
      seed = sm(P(t, k.R0 + .35, .2)) * (1 - sm(P(u, .8, .2))); sp = u > 0 ? bez(slot, c2, c1, h, eio(u)) : slot.clone().addScaledVector(bob, 1);
    } else if (t < k.RA) {                                                                                                    // ---- 回程：翻到有画的一面，飞到墙前两厘米 ----
      const u = P(t, k.R0, T.rfly), e2 = eio(u), w = cd.pose(0, .02, { p: new THREE.Vector3(), q: new THREE.Quaternion() }), sd = (hash(cd.k, 12) - .5) * .5, st = slot.clone().add(bob);
      const c1 = st.clone().addScaledVector(pn.nrm, .25 + hash(cd.k, 13) * .2).add(new THREE.Vector3(0, .1 + sd * .2, 0)), c2 = w.p.clone().addScaledVector(nW, .3).add(new THREE.Vector3(sd * .3, .08, 0));
      p = bez(st, c1, c2, w.p, e2); const ax = new THREE.Vector3(hash(cd.k, 14) - .5, hash(cd.k, 15) - .5, hash(cd.k, 16) - .5).normalize();
      q = qP.clone().slerp(w.q, sm(P(u, .1, .6))).premultiply(new THREE.Quaternion().setFromAxisAngle(ax, Math.sin(Math.PI * e2) * .3)); s = lerp(pn.sc, 1, sm(u)); where = 'fly';
      tape = T.air ? 0 : 1; e = .12 + .3 * sm(P(t, k.RA - .3, .3));                                                       // 飞的时候金线压暗（细亮线在运动模糊里会一道道地重影），快贴上墙时才亮起来
    } else {                                                                                                                  // ---- 贴上墙，按一下；air 这一段胶带这时才出现 ----
      const u = P(t, k.RA, k.S - k.RA), out = .02 * (1 - eout(u)) - .003 * Math.sin(Math.PI * u); cd.pose(0, Math.max(0, out), o); p = o.p.clone(); q = o.q.clone();
      tape = T.air ? back(P(t, k.RA + .12, .2), 2) : 1; e = .42 * (1 - P(t, k.RA + .1, .8));
    }
    return { vis, p, q, s, e, tr, where, k, op, tape, seed, sp };
  }

  // 不在任何一段里的时候：照片在墙上的哪一格、看不看得见（只跟 t 走）
  idle(t) { const W = this.wall, show = !this.air || t > this.air.t1; for (const c of W.cards) { c.g.visible = show; if (this.dirty) { c.reset(); c.body.castShadow = true; } } W.back.mats.forEach((m) => { m.emissiveIntensity = 0; }); }

  // 脚底推进：两团光、照地面的小灯、往下拖的细光（悬浮段和 visit 共用）
  thrusters(t, kakaPos, th) {
    const fl = .85 + .15 * Math.sin(t * 61) * Math.sin(t * 37);
    this.jets.forEach((s) => { const z = th * fl; s.scale.set(.5 * z + 1e-4, 1.1 * z + 1e-4, 1); s.material.opacity = Math.min(1, z * 1.5); });
    this.jetLight.position.copy(kakaPos).add(new THREE.Vector3(0, -.03, 0)); this.jetLight.intensity = th * fl * .5;
    this.trail.begin(); for (let i = 0; i < 30 && th > .05; i++) { const a = (i * .037 + t * 1.7) % 1, p0 = kakaPos.clone().add(new THREE.Vector3((hash(i, 9) - .5) * .03, -.02 - a * .12, (hash(i, 8) - .5) * .03)); this.trail.add(p0, p0.clone().add(new THREE.Vector3(0, -.015, 0)), th * (1 - a) * .45); } this.trail.end();
  }
  update(t, kakaPos, fast = false) {
    const m = this.active(t), W = this.wall;
    if (!m || !W) { const vz = this.visitAt(t, this.film.home);
      if (vz) { this.g.visible = true; this.thrusters(t, kakaPos, vz.thrust); this.edge.begin(); this.edge.end(); this.dust.begin(); this.dust.end(); this.seeds.forEach((q) => { q.visible = false; });
        this.wallLight.intensity = this.panelLight.intensity = this.handLight.intensity = 0; this.pouf.scale.set(1, 1, 1); if (this.dirty) this.restore(); if (W) this.idle(t); this.dirty = false; return; }
      this.g.visible = false; this.jets.forEach((s) => s.scale.set(1e-4, 1e-4, 1)); this.jetLight.intensity = this.wallLight.intensity = this.panelLight.intensity = this.handLight.intensity = 0; this.pouf.scale.set(1, 1, 1);
      if (this.dirty) this.restore(); if (W) this.idle(t); this.dirty = false; return; }
    this.dirty = true; this.g.visible = true; this.build(m); const T = this.plan(m), pn = this.panel;
    // 1 推进
    const kk = this.kaka(t, this.film.home), th = kk.thrust; this.thrusters(t, kakaPos, th);
    const sq = this.squash(t, T); this.pouf.scale.y = 1 + sq / POUF.h * 2.2; this.pouf.scale.x = this.pouf.scale.z = 1 - sq / POUF.h * .9;
    // 2 东西浮起来
    const bounce = t > T.settle + 1.1 && t < T.settle + 1.6 ? .012 * Math.sin(P(t, T.settle + 1.1, .5) * Math.PI) * (1 - P(t, T.settle + 1.1, .5)) : 0;
    (m.float || []).forEach((name, i) => { const o = this.things[name]; if (!o) return; if (!this.base.has(o)) this.base.set(o, { p: o.position.clone(), q: o.quaternion.clone() });
      const b = this.base.get(o), d = i * .12, w = clamp(Math.min(back(P(t, T.float0 + d, 1.4), 1.2), 1 - eio(P(t, T.settle + d * .5, 1.1)))), h = (m.lift?.[i] ?? .14 + hash(i, 11) * .12);
      o.position.copy(b.p); o.position.y += w * (h + .015 * Math.sin(t * 1.3 + i * 1.7)) + bounce * (1 - w);
      const ax = new THREE.Vector3(hash(i, 12) - .5, 1.5, hash(i, 13) - .5).normalize(); o.quaternion.copy(b.q).premultiply(new THREE.Quaternion().setFromAxisAngle(ax, w * (.25 + .18 * Math.sin(t * .7 + i))));
    });
    // 3、4 照片
    const H2 = T.air ? this.hands() : null;
    const kx = 1 / Math.max(.4, this.stage.exposure || 1);   // 白天（曝光 .42）也要亮得起来；夜里曝光 1，不变
    this.edge.begin(); this.dust.begin(); let onWall = 0, onPanel = 0, off = 0, seeds = 0;
    for (const cd of W.cards) {
      const st = this.card(cd, t, T, H2), sd = this.seeds[cd.k];
      if (!st.vis) { cd.g.visible = false; sd.visible = false; continue; }
      cd.g.visible = st.op > .002; cd.g.position.copy(st.p); cd.g.quaternion.copy(st.q); cd.g.scale.setScalar(st.s); cd.fade(st.op); cd.tape(st.tape); cd.body.castShadow = st.op > .6;   // 还半透明的时候不投影
      sd.visible = st.seed > .01; if (sd.visible) { sd.position.copy(st.sp ?? st.p); sd.scale.setScalar((.013 * st.seed + .003) * (1 + .12 * Math.sin(t * 19 + cd.k * 2.3))); sd.material.opacity = Math.min(1, st.seed * 1.4); sd.material.color.copy(WARM).multiplyScalar(kx); seeds += st.seed; }
      if (st.where !== 'wall') off++; if (st.e > 0) { if (st.where === 'wall') onWall += st.e; else if (st.where === 'panel') onPanel += st.e; }
      if (st.e > .003) { const hw = cd.s / 2, fz = Z.clone().applyQuaternion(st.q);                                         // 金线贴着纸边，往看得见的那一面挪出 0.6 毫米
        const C = [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]].map(([x, y]) => new THREE.Vector3(x, y, 0).multiplyScalar(st.s).applyQuaternion(st.q).add(st.p).addScaledVector(fz, st.where === 'panel' || (T.air && st.where === 'fly' && t < st.k.R0) ? -.0006 : .0006));
        for (let e = 0; e < 4; e++) { const f = clamp(st.tr * 4 - e); if (f <= 0) break; const a = C[e], b = C[(e + 1) % 4]; this.edge.add(a, a.clone().lerp(b, f), st.e * kx);
          if (f < 1 && st.tr < 1 && !T.air) { const hd = a.clone().lerp(b, f); for (let s = 0; s < 2; s++) { const ph = (t * 7 + s * .5 + cd.k * .13) % 1, d = new THREE.Vector3(hash(cd.k * 7 + s, 41) - .5, -.3 - hash(cd.k * 7 + s, 42) * .5, hash(cd.k * 7 + s, 43) - .5).multiplyScalar(.03 * ph);
            this.edge.add(hd.clone().add(d), hd.clone().add(d.clone().multiplyScalar(1.4)), 1.4 * (1 - ph)); } } } }
      // 灰：从墙上揭下来那一刻抖下来几粒（只有 wall 段）；贴回墙上的时候扬起一点
      for (const [t0, nN, sp] of T.gather ? [] : T.air ? [[st.k.RA + .1, 2, .6]] : [[st.k.Pk + .1, 5, 1], [st.k.RA + .1, 2, .6]]) { const a = t - t0; if (a < 0 || a > 2.6) continue;
        for (let n = 0; n < nN; n++) { const life = 1.6 + hash(cd.k * 13 + n, 51) * 1.0; if (a > life) continue; const u = hash(cd.k * 13 + n, 52), side = n % 3;
          const p0 = cd.home.p.clone().add(new THREE.Vector3(side === 0 ? (u - .5) * cd.s : (side === 1 ? -1 : 1) * cd.s / 2, side === 0 ? -cd.s / 2 : (u - .5) * cd.s, 0).applyQuaternion(cd.qBase)).addScaledVector(cd.nW, .004);
          const v = cd.nW.clone().multiplyScalar((.03 + .06 * hash(cd.k * 13 + n, 53)) * sp).add(new THREE.Vector3((hash(cd.k * 13 + n, 54) - .5) * .04, -.025 - .02 * hash(cd.k * 13 + n, 55), 0));
          const at = (x) => p0.clone().addScaledVector(v, x).add(new THREE.Vector3(Math.sin(x * 2.1 + n) * .006, 0, Math.cos(x * 1.7 + n) * .006)), b = .6 * Math.sin(Math.PI * a / life);
          this.dust.add(at(Math.max(0, a - .03)), at(a), b, .0009 + .0006 * hash(cd.k * 13 + n, 56)); } } }
    this.edge.end(); this.dust.end();
    // 灯：手心上方冒光点时的一点暖光；金线照墙；板子亮起来以后的面光
    if (H2) { this.handLight.position.copy(H2[0]).lerp(H2[1], .5).add(new THREE.Vector3(0, .08, 0)); this.handLight.intensity = .35 * Math.min(1, seeds / 3); } else this.handLight.intensity = 0;
    this.wallLight.position.copy(W.center).addScaledVector(W.nW, .3); this.wallLight.intensity = .42 * onWall / W.cards.length;
    const cw = P(t, T.content, .6) * (1 - P(t, T.unform - .35, .35)); W.back.mats.forEach((mt) => { mt.emissiveIntensity = 1.1 * cw * kx; });
    if (off && !fast) { const g = W.back.canvas.getContext('2d'); g.drawImage(W.back.paper, 0, 0); if (cw > 0) { g.save(); g.globalAlpha = cw; this.draw?.(g, 1600, 900, m.panel, t); g.restore(); } W.back.tex.needsUpdate = true; }
    this.panelLight.position.copy(pn.c).addScaledVector(pn.nrm, .45).add(new THREE.Vector3(0, -.25, 0)); this.panelLight.intensity = .65 * cw + .3 * onPanel / W.cards.length;
  }
  restore() { for (const [o, b] of this.base) { o.position.copy(b.p); o.quaternion.copy(b.q); } }
}
