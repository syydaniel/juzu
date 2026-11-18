// 桌上的笔记本翻开，书页上写着内容。东西不能凭空冒出来，所以不是自己翻开：
// 小机器人飞过来（导演表 VISIT，magic.js 的 visitAt），从手心拉出一根金色的光线——先把压在封面上的笔拨开，再勾住封面的外沿往上掀，
// 掀过竖直就松手，封面自己落下去、弹一下停住；书页上是一页手写的笔记，说到哪一句，光线就在哪一句底下描一道金线。
// 动画按迪士尼十二法则：拨笔有预备（光线先搭上去顿一下）、封面先被松紧带绷住微微翘起（预备），带子一滑脱才甩开（快出），
// 过顶以后靠重力加速落下（慢入快出）、落桌弹一下（跟随），笔滚出去时自转、到边上掉下去再小弹一下（次要动作），光线一直有一点抖（生命感）。
// 导演表 NOTEBOOK：[{ at, head, inside, lines: [{ text, size, hl, dy }] }]，at 是光线搭上笔的时刻；hl 是说到这一句的时刻（金线开始描）；
// head 书页顶上一行小字；inside 封面里侧衬纸上的一行字（翻开后倒着朝上），不写就空着。翻开以后一直开着。
// 要配一段 VISIT 让小机器人飞过去：VISIT 的 t0 比 at 早 1.75 秒左右（飞 1.3 秒，落下再抬手），t1 在最后一句描完之后。
import * as THREE from 'three';
import { Streaks, glowTex } from './magic.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, u) => a + (b - a) * u;
const P = (t, a, d) => clamp((t - a) / d), sm = (u) => u * u * (3 - 2 * u), eio = (u) => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const eout = (u) => 1 - Math.pow(1 - u, 3);
const WARM = new THREE.Color(3.0, 1.75, .65), FONT = '"Kaiti SC", STKaiti, KaiTi, serif';   // 书页上的手写字。想换成别的手写体，改这里（要本机装了的字体）
const CW = 720, CH = 1030, SS = 2;                              // 书页画布：逻辑坐标 720 × 1030（.142 × .204 米），实际 2 倍（4K 近景要看清字）

export class Notebook {
  constructor(stage, set, list, TX, film) {
    this.stage = stage; this.film = film; const n = set.note;
    this.ev = (list || []).map((e) => ({ ...e, at: TX(e.at), lines: (e.lines || []).map((l) => ({ ...l, hl: l.hl !== undefined ? TX(l.hl) : null })) })).sort((a, b) => a.at - b.at);
    this.ok = !!n && this.ev.length > 0; if (!this.ok) return;
    const { nb, top, band, pen, N } = n; this.n = n;
    // 合页：封面绕书脊（-x 那条边，封面上表面）转
    const hinge = this.hinge = new THREE.Group(); hinge.position.set(-N.w / 2, N.t, 0); nb.add(hinge); nb.remove(top); top.position.set(N.w / 2, -.00075, 0); hinge.add(top);
    // 封面里侧的衬纸（合上时朝下）
    const ec = document.createElement('canvas'); ec.width = 360; ec.height = 512; const eg = ec.getContext('2d'); eg.fillStyle = '#efe8da'; eg.fillRect(0, 0, 360, 512);
    let r = 11; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);   // 定种子：分块渲染时每块画出来一样
    for (let i = 0; i < 900; i++) { eg.fillStyle = `rgba(120,100,70,${.03 + .04 * rnd()})`; eg.fillRect(rnd() * 360, rnd() * 512, 1.2, 1.2); }
    this.etex = new THREE.CanvasTexture(ec); this.etex.colorSpace = THREE.SRGBColorSpace; this.ecv = ec;
    const endp = new THREE.Mesh(new THREE.PlaneGeometry(N.w - .006, N.l - .006), new THREE.MeshStandardMaterial({ map: this.etex, roughness: .95 }));
    endp.rotation.x = Math.PI / 2; endp.position.set(N.w / 2, -.0016, 0); endp.receiveShadow = true; hinge.add(endp);
    // 书页：贴在纸块上表面（合上时藏在封面里）。map 是纸和字，emissiveMap 只有金线
    const mk = () => { const c = document.createElement('canvas'); c.width = CW * SS; c.height = CH * SS; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return [c, t]; };
    [this.cv, this.tex] = mk(); [this.gcv, this.gtex] = mk();
    this.pmat = new THREE.MeshStandardMaterial({ map: this.tex, roughness: .9, emissive: 0xffffff, emissiveMap: this.gtex, emissiveIntensity: 0 });
    this.PW = N.w - .006; this.PH = N.l - .006;
    const page = this.page = new THREE.Mesh(new THREE.PlaneGeometry(this.PW, this.PH), this.pmat); page.rotation.x = -Math.PI / 2; page.position.set(-.001, N.t - .0015 + .00025, 0); page.receiveShadow = true; nb.add(page);
    // 笔和松紧带的原位
    pen.rotation.order = 'YXZ'; this.pen0 = { p: pen.position.clone(), ry: pen.rotation.y }; this.band0 = band.position.clone(); this.bandS = band.scale.clone();
    this.rollDir = new THREE.Vector3(Math.sin(this.pen0.ry), 0, Math.cos(this.pen0.ry));   // 笔轴的垂直方向（往右前方滚，离开封面）
    // 光线：手心到目标的一根细线 + 两头的光点 + 一盏照书页的小暖灯
    const g = this.g = new THREE.Group(); g.name = 'notebook-fx'; stage.scene.add(g);
    this.line = new Streaks(g, 4, WARM, .0007); const glow = glowTex();
    this.dots = [0, 1].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: WARM, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.userData.fixed = true; s.visible = false; g.add(s); return s; });
    this.light = new THREE.PointLight(0xffc27a, 0, .5, 2); stage.scene.add(this.light);
    this.drawn = null; this.fontOk = false;
  }
  async load() { if (!this.ok) return; const txt = this.ev.flatMap((e) => [e.head || '', e.inside || '', ...e.lines.map((l) => l.text)]).join('') || '笔记';
    try { await document.fonts.load(`96px ${FONT}`, txt); this.fontOk = true; } catch (e) { /* 用后备字体 */ } this.paintEnd(); }

  // 这一刻在哪个事件里（翻开以后一直开着）
  cur(t) { let e = null; for (const x of this.ev) if (t >= x.at - .2) e = x; return e; }
  // 各个阶段的时刻（都相对 at）
  plan(e) { const a = e.at; return { pen0: a - .1, pen1: a + .55, roll0: a + .12, roll1: a + .75, cov0: a + .7, slip0: a + .75, slip1: a + 1.1, swing1: a + 1.75, fall1: a + 2.05, bounce1: a + 2.45 }; }
  dur(l) { return .3 + .085 * [...l.text].length; }

  // 封面转角（弧度）：绷住微翘 → 甩开 → 过顶松手、重力加速落下 → 落桌弹一下
  theta(t, T) { const N = this.n.N, end = Math.PI - Math.atan2(N.t, N.w);
    if (t < T.slip0) return 0;
    if (t < T.slip1) return .045 * sm(P(t, T.slip0, T.slip1 - T.slip0));
    if (t < T.swing1) return lerp(.045, Math.PI / 2 + .14, eio(P(t, T.slip1, T.swing1 - T.slip1)));
    if (t < T.fall1) { const u = P(t, T.swing1, T.fall1 - T.swing1); return lerp(Math.PI / 2 + .14, end, u * u); }
    const a = t - T.fall1; return end - .07 * Math.exp(-a * 9) * Math.abs(Math.sin(a * 17)); }

  // 小机器人这一刻要把光线拉向哪儿（世界坐标）；没有就是 null。magic.js 的 visitAt 用它决定小机器人抬手、转身
  aim(t) { if (!this.ok) return null; const e = this.cur(t); if (!e) return null; const T = this.plan(e);
    if (t >= T.pen0 && t < T.pen1) return this.penTip(t, T);
    if (t >= T.cov0 && t < T.swing1) return this.coverEdge();
    for (const l of e.lines) if (l.hl !== null && t >= l.hl - .15 && t < l.hl + this.dur(l) + .15) return this.ulTip(l, t, e);
    return null; }
  coverEdge() { return this.hinge.localToWorld(new THREE.Vector3(this.n.N.w - .004, .0005, .035)); }
  penTip() { const pen = this.n.pen; pen.updateWorldMatrix(true, false); return pen.localToWorld(new THREE.Vector3(-.03, .004, 0)); }
  // 书页画布坐标 → 世界坐标
  pageW(px, py) { this.page.updateWorldMatrix(true, false); return this.page.localToWorld(new THREE.Vector3((px / CW - .5) * this.PW, (.5 - py / CH) * this.PH, .0006)); }
  ulTip(l, t, e) { const L = this.layout(l, e), u = eio(P(t, l.hl, this.dur(l))); return this.pageW(L.x0 + (L.x1 - L.x0) * u, L.y); }

  // 一行字的位置（画布像素）
  layout(l, e) { const i = e.lines.indexOf(l); let y = 150; for (let k = 0; k <= i; k++) { const q = e.lines[k]; y += (q.dy ?? (q.size || 56) * 1.55); }
    const g = this.cv.getContext('2d'); g.font = `${l.size || 56}px ${FONT}`; const w = g.measureText(l.text.replace(/[，。]$/, '')).width;
    return { x0: 64, x1: 64 + w, y: y + (l.size || 56) * .32, base: y }; }

  update(t, fast = false) {
    if (!this.ok) return; const e = this.cur(t), { pen, band, N } = this.n;
    if (!e) { this.hinge.rotation.z = 0; pen.position.copy(this.pen0.p); pen.rotation.set(0, this.pen0.ry, 0); band.position.copy(this.band0); band.scale.copy(this.bandS); this.off(); return; }
    const T = this.plan(e);
    // 笔：被拉着滚出去（越滚越慢），自转；过了封面边就掉到桌上，小弹一下
    const s = .17 * eout(P(t, T.roll0, T.roll1 - T.roll0)), s1 = .115, fall = clamp((s - s1) / .03);
    pen.position.copy(this.pen0.p).addScaledVector(this.rollDir, s); pen.position.y = this.pen0.p.y - N.t * fall * fall + (fall >= 1 ? .002 * Math.abs(Math.sin(P(t, T.roll1 - .18, .18) * Math.PI)) * (1 - P(t, T.roll1 - .18, .18)) : 0);
    pen.rotation.set(s / .0045, this.pen0.ry, 0);   // 往 +z 滚：绕笔轴正转
    // 松紧带：封面翘起时被勾着滑出去，落到书边
    const sl = eout(P(t, T.slip0 + .1, T.slip1 - T.slip0)), dr = sm(P(t, T.slip1 - .05, .2));
    band.position.set(this.band0.x + (N.w / 2 + .0035 - this.band0.x) * sl, this.band0.y - (N.t / 2 - .0008) * dr, this.band0.z); band.scale.set(this.bandS.x, this.bandS.y * (1 - .85 * dr), this.bandS.z);
    // 封面
    this.hinge.rotation.z = this.theta(t, T);
    // 光线
    const tgt = this.aim(t), hand = tgt && this.film.handNear?.(tgt);
    this.line.begin();
    if (tgt && hand) { const fl = .85 + .15 * Math.sin(t * 43) * Math.sin(t * 27), on = this.fadeOn(t, e, T);
      this.line.add(hand, tgt, 1.6 * fl * on * this.kx());
      this.dots.forEach((d, i) => { d.visible = on > .01; d.position.copy(i ? tgt : hand); d.scale.setScalar((i ? .012 : .016) * (.9 + .1 * fl)); d.material.opacity = on; d.material.color.copy(WARM).multiplyScalar(this.kx()); });
      this.light.position.copy(tgt).add(new THREE.Vector3(0, .03, 0)); this.light.intensity = .06 * on * fl * this.kx(); }
    else { this.dots.forEach((d) => { d.visible = false; }); this.light.intensity = 0; }
    this.line.end();
    // 书页：金线
    const gl = e.lines.filter((l) => l.hl !== null).map((l) => P(t, l.hl, this.dur(l))), key = gl.map((u) => u.toFixed(3)).join(',');
    let fresh = 0; for (const l of e.lines) if (l.hl !== null && t >= l.hl) fresh = Math.max(fresh, 1 - P(t, l.hl + this.dur(l), 1.6));
    this.pmat.emissiveIntensity = (.8 + 1.6 * fresh) * this.kx();
    if (!fast && (this.drawn !== e || this.key !== key)) { this.paint(e, t); this.drawn = e; this.key = key; }
  }
  kx() { return 1 / Math.max(.4, this.stage.exposure || 1); }
  fadeOn(t, e, T) { const seg = (a, b) => sm(P(t, a, .12)) * (1 - sm(P(t, b - .12, .12)));
    if (t < T.pen1 + .05) return seg(T.pen0, T.pen1); if (t < T.swing1 + .05) return seg(T.cov0, T.swing1);
    for (const l of e.lines) if (l.hl !== null && t >= l.hl - .2 && t < l.hl + this.dur(l) + .2) return seg(l.hl - .15, l.hl + this.dur(l) + .15);
    return 0; }
  off() { this.line.begin(); this.line.end(); this.dots.forEach((d) => { d.visible = false; }); this.light.intensity = 0; this.pmat.emissiveIntensity = 0; }

  // 衬纸上一行小字（NOTEBOOK 的 inside；封面翻过来以后是倒着的，所以画布转 180 度）
  paintEnd() { const s = this.ev.find((e) => e.inside)?.inside; if (!s) return; const g = this.ecv.getContext('2d'); g.save(); g.translate(180, 256); g.rotate(Math.PI); g.translate(-180, -256);
    g.font = `34px ${FONT}`; g.fillStyle = 'rgba(40,52,74,.75)'; g.fillText(s, 46, 96); g.fillRect(46, 112, 120, 2); g.restore(); this.etex.needsUpdate = true; }

  paint(e, t) {
    const g = this.cv.getContext('2d'), G = this.gcv.getContext('2d'); g.setTransform(SS, 0, 0, SS, 0, 0); G.setTransform(SS, 0, 0, SS, 0, 0);
    g.fillStyle = '#f3eee2'; g.fillRect(0, 0, CW, CH);
    let r = 7; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(120,100,70,${.02 + .04 * rnd()})`; g.fillRect(rnd() * CW, rnd() * CH, 1.3, 1.3); }
    g.fillStyle = 'rgba(150,140,125,.35)'; for (let y = 60; y < CH - 30; y += 36) for (let x = 40; x < CW - 20; x += 36) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }   // 点阵
    if (e.head) { g.font = `40px ${FONT}`; g.fillStyle = 'rgba(40,52,74,.78)'; g.fillText(e.head, 64, 118); }
    G.fillStyle = '#000'; G.fillRect(0, 0, CW, CH);
    e.lines.forEach((l, i) => { const L = this.layout(l, e); g.save(); g.translate(L.x0, L.base); g.rotate(-.012 + .008 * Math.sin(i * 2.3));
      g.font = `${l.size || 56}px ${FONT}`; g.fillStyle = '#1f2b3f'; g.fillText(l.text, 0, 0); g.restore();
      if (l.hl === null) return; const u = eio(P(t, l.hl, this.dur(l))); if (u <= 0) return;
      // 金线：手描的一道，略有起伏；颜色层画一道暗金，自发光层画亮的
      const path = (c) => { c.beginPath(); const n = 40; for (let k = 0; k <= n * u; k++) { const x = L.x0 - 6 + (L.x1 - L.x0 + 12) * k / n, y = L.y + 3 * Math.sin(k * .45 + i) + (k / n) * 4; k ? c.lineTo(x, y) : c.moveTo(x, y); } };
      g.save(); g.strokeStyle = 'rgba(196,140,48,.9)'; g.lineWidth = 9; g.lineCap = 'round'; path(g); g.stroke(); g.restore();
      G.save(); G.strokeStyle = '#ffd27e'; G.lineWidth = 9; G.lineCap = 'round'; G.shadowColor = '#ffb347'; G.shadowBlur = 20 * SS; path(G); G.stroke(); G.restore(); });
    this.tex.needsUpdate = true; this.gtex.needsUpdate = true;
  }
}
