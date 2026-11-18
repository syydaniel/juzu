// 小机器人打出一块全息投影：脚下的充电座朝左前方打出一束光，半空里先拉出一条亮线，再上下撑开成一块半透明的青色屏，内容一条条扫进来；
// 讲完先压回一条线、缩成一个点，光束灭。屏、光束、光里飘的小亮点都是加色混合，屏上的光会照到小机器人和桌面上一点。
// 导演表 HOLO：[{ t0, t1, kind: 'flow' | 'merge' | 'check', pos: [dx, dy, dz]（相对小机器人站的位置）, w: 宽（米）, kicker, ... }]
//   flow：inputs: [{ text, at, hl, size, code: ['一行', …] }] 几项横着排，中间箭头；hl 那一刻变暖色；code 在这一项下面一行行打出来
//   merge：inputs 同上，result: { text, at, size }，join（默认 '+'）：几项先排开，到 result.at 往中间收，闪一下，变成结果
//   check：marks: [{ text, at, no }] 对和错两个大圆，no: 1 是打叉
// 只依赖 t。
import * as THREE from 'three';
import { clamp, ease, easeOut, easeIO, back, P } from './kit.js';

const SANS = '"PingFang SC", -apple-system, "Helvetica Neue", sans-serif', MONO = '"SF Mono", Menlo, monospace';
const CW = 1600, CH = 900, CY = '#9ff6ff', WARM = '#ffd58a';
const fr = (x) => x - Math.floor(x), hsh = (n) => fr(Math.sin(n * 127.1 + 311.7) * 43758.5453);

export class Holo {
  constructor(stage, home, list, TX) {
    this.stage = stage; this.home = home; const T = (x) => (x === undefined ? undefined : TX(x));
    this.items = (list || []).map((x) => ({ ...x, t0: TX(x.t0), t1: TX(x.t1),
      inputs: (x.inputs || x.items || []).map((i) => ({ ...i, at: TX(i.at), hl: T(i.hl) })), result: x.result && { ...x.result, at: TX(x.result.at) },
      marks: (x.marks || []).map((m) => ({ ...m, at: TX(m.at) })) }));
    const c = this.canvas = document.createElement('canvas'); c.width = CW; c.height = CH;
    const tex = this.tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };
    this.pmat = new THREE.MeshBasicMaterial({ map: tex, ...add });
    this.panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.pmat);
    // 光束：从投影点到屏四个角的四棱锥，越靠近屏越亮
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3));
    bg.setAttribute('k', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1]), 1));
    this.bmat = new THREE.ShaderMaterial({ ...add, uniforms: { col: { value: new THREE.Color(0x47d8ff) }, op: { value: 0 } },
      vertexShader: 'attribute float k; varying float vk; void main(){ vk = k; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform vec3 col; uniform float op; varying float vk; void main(){ float a = op * pow(vk, 1.8); gl_FragColor = vec4(col * a, a); }' });
    this.beam = new THREE.Mesh(bg, this.bmat); this.beam.frustumCulled = false;
    // 光里往上飘的小亮点
    const N = 36; this.motes = Array.from({ length: N }, (_, i) => ({ ph: hsh(i * 3.1), u: hsh(i * 7.7), v: hsh(i * 5.3) }));
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x9ff3ff, size: .0028, sizeAttenuation: true, ...add, opacity: 0 })); this.pts.frustumCulled = false;
    this.light = new THREE.PointLight(0x62e2ff, 0, 1.2, 2);
    for (const m of [this.panel, this.beam, this.pts]) { m.castShadow = false; m.receiveShadow = false; m.userData.fixed = true; m.visible = false; }
    stage.scene.add(this.panel, this.beam, this.pts, this.light);
    this.last = null;
  }

  // 定位：t0 那一刻按镜头的位置让屏正对镜头（只转水平方向，再往后仰 6°）
  place(it, pose) {
    const h = this.home, o = it.pos || [-.25, .19, .12]; it.c = new THREE.Vector3(h.x + o[0], h.y + o[1], h.z + o[2]);
    it.W = it.w || .34; it.H = it.W * 9 / 16;
    const yaw = Math.atan2(pose.p.x - it.c.x, pose.p.z - it.c.z); it.q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-.1, yaw, 0, 'YXZ'));
    it.src = new THREE.Vector3(h.x + (it.from?.[0] ?? -.034), h.y + (it.from?.[1] ?? .012), h.z + (it.from?.[2] ?? .028));   // 充电座左前沿
  }

  update(t, poseAt) {
    const it = this.items.find((x) => t >= x.t0 && t < x.t1), vis = !!it;
    for (const m of [this.panel, this.beam, this.pts]) m.visible = vis; if (!vis) { this.light.intensity = 0; return; }
    if (!it.c) this.place(it, poseAt(it.t0));
    // 开：0–0.18 秒拉出一条横线，0.15–0.6 秒上下撑开（带一点回弹）；关：最后 0.4 秒压回线、缩成点
    const sx = Math.min(easeOut(P(t, it.t0 + .08, .2)), 1 - ease(P(t, it.t1 - .18, .18))), sy = Math.min(back(P(t, it.t0 + .2, .45)), 1 - easeIO(P(t, it.t1 - .42, .26)));
    const open = clamp(sx) * clamp(sy, .02, 1.2), flick = t - it.t0 < .3 ? (hsh(Math.floor((t - it.t0) * 40)) > .35 ? 1 : .25) : .94 + .06 * Math.sin(t * 23) * Math.sin(t * 7.3);
    const ex = this.stage.exposure || .5, bob = .003 * Math.sin(2 * Math.PI * .45 * (t - it.t0));
    const c = it.c.clone(); c.y += bob; const w = it.W * Math.max(.002, sx), hh = it.H * Math.max(.015, sy);
    this.panel.position.copy(c); this.panel.quaternion.copy(it.q); this.panel.scale.set(w, hh, 1);
    this.pmat.color.setScalar(1.15 / ex * flick);
    // 光束的四个角跟着屏走
    const R = new THREE.Vector3(1, 0, 0).applyQuaternion(it.q), U = new THREE.Vector3(0, 1, 0).applyQuaternion(it.q);
    const corner = (a, b) => c.clone().addScaledVector(R, a * w / 2).addScaledVector(U, b * hh / 2);
    const k = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], s = it.src, pos = this.beam.geometry.attributes.position;
    for (let i = 0; i < 4; i++) { const A = k[i], B = k[(i + 1) % 4]; pos.setXYZ(i * 3, s.x, s.y, s.z); pos.setXYZ(i * 3 + 1, A.x, A.y, A.z); pos.setXYZ(i * 3 + 2, B.x, B.y, B.z); }
    pos.needsUpdate = true; this.bmat.uniforms.op.value = .18 / ex * clamp(open * 1.6) * flick;
    const pp = this.pts.geometry.attributes.position;
    this.motes.forEach((m, i) => { const f = fr(m.ph + (t - it.t0) * .35), e = corner(m.u * 2 - 1, m.v * 1.6 - 1); const q = s.clone().lerp(e, f); pp.setXYZ(i, q.x, q.y, q.z); });
    pp.needsUpdate = true; this.pts.material.opacity = .8 * clamp(open * 1.5) * Math.min(1, 1 / ex * .5);
    this.light.position.copy(c).addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(it.q), .05); this.light.intensity = .05 * open;
    this.draw(it, t, sy);
  }

  // ---------- 屏上的内容 ----------
  draw(it, t, sy) {
    const key = Math.round(t * 48); if (this.last === key) return; this.last = key;
    const g = this.canvas.getContext('2d'); g.clearRect(0, 0, CW, CH);
    g.fillStyle = 'rgba(40,170,230,.10)'; g.fillRect(0, 0, CW, CH);
    g.strokeStyle = 'rgba(140,235,255,.10)'; g.lineWidth = 2; for (let x = 0; x <= CW; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, CH); g.stroke(); } for (let y = 0; y <= CH; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(CW, y); g.stroke(); }
    g.strokeStyle = 'rgba(160,240,255,.55)'; g.lineWidth = 3; g.strokeRect(14, 14, CW - 28, CH - 28);
    g.strokeStyle = CY; g.lineWidth = 9; const L = 70;
    for (const [x, y, dx, dy] of [[14, 14, 1, 1], [CW - 14, 14, -1, 1], [14, CH - 14, 1, -1], [CW - 14, CH - 14, -1, -1]]) { g.beginPath(); g.moveTo(x, y + dy * L); g.lineTo(x, y); g.lineTo(x + dx * L, y); g.stroke(); }
    if (it.kicker) { g.font = `600 40px ${SANS}`; g.fillStyle = 'rgba(170,245,255,.75)'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(it.kicker, 60, 70); }
    g.save(); g.shadowColor = '#2fd0ff'; g.shadowBlur = 26;
    if (it.kind === 'flow') this.flow(g, it, t); else if (it.kind === 'merge') this.merge(g, it, t); else if (it.kind === 'check') this.check(g, it, t);
    g.restore();
    // 扫描线、从上往下扫一遍的亮带、刚打开时几条横向错位
    g.fillStyle = 'rgba(0,0,0,.22)'; const off = Math.floor((t * 60) % 6); for (let y = off; y < CH; y += 6) g.fillRect(0, y, CW, 2);
    const sw = P(t, it.t0 + .3, .9); if (sw > 0 && sw < 1) { const y = sw * CH, gr = g.createLinearGradient(0, y - 90, 0, y + 10); gr.addColorStop(0, 'rgba(150,240,255,0)'); gr.addColorStop(1, 'rgba(190,250,255,.35)'); g.fillStyle = gr; g.fillRect(0, y - 90, CW, 100); }
    if (t - it.t0 < .45) for (let i = 0; i < 5; i++) { const y = hsh(i * 9 + Math.floor((t - it.t0) * 30)) * CH, hgt = 10 + hsh(i * 3.3) * 40, dx = (hsh(i * 5.1 + t) - .5) * 80; g.drawImage(this.canvas, 0, y, CW, hgt, dx, y, CW, hgt); }
    this.tex.needsUpdate = true;
  }
  // 一个字一个字扫进来
  typed(g, s, x, y, t0, t, dur = .35) { const n = [...s].length, k = Math.floor(clamp((t - t0) / dur) * n + .001); g.fillText([...s].slice(0, k).join(''), x, y); return k >= n; }
  box(g, x, y, w, h, u, hot) {                                  // 外框按周长一点点画出来
    const per = 2 * (w + h), len = per * easeOut(u); g.lineWidth = hot ? 7 : 5; g.strokeStyle = hot ? WARM : CY;
    g.setLineDash([len, per]); g.beginPath(); g.rect(x, y, w, h); g.stroke(); g.setLineDash([]);
    if (hot) { g.fillStyle = 'rgba(255,200,120,.12)'; g.fillRect(x, y, w, h); }
  }
  // 几项横着排，中间箭头；某一项可以带几行代码在下面打出来
  flow(g, it, t) {
    const n = it.inputs.length, gap = 120, bw = (CW - 160 - gap * (n - 1)) / n, bh = 230, y = it.code ? 230 : 330;
    it.inputs.forEach((x, i) => {
      const u = P(t, x.at, .4); if (u <= 0) return; const bx = 80 + i * (bw + gap), hot = x.hl !== undefined && t >= x.hl;
      this.box(g, bx, y, bw, bh, u, hot);
      g.font = `700 ${x.size || 84}px ${SANS}`; g.fillStyle = hot ? WARM : CY; g.textAlign = 'center'; g.textBaseline = 'middle'; this.typed(g, x.text, bx + bw / 2, y + bh / 2, x.at + .1, t);
      if (i > 0) { const a = P(t, x.at - .15, .3), ax = bx - gap + 22, aw = (gap - 44) * easeOut(a); if (a > 0) { g.strokeStyle = CY; g.lineWidth = 7; g.beginPath(); g.moveTo(ax, y + bh / 2); g.lineTo(ax + aw, y + bh / 2); g.stroke();
        if (a >= 1) { g.beginPath(); g.moveTo(ax + aw - 22, y + bh / 2 - 18); g.lineTo(ax + aw, y + bh / 2); g.lineTo(ax + aw - 22, y + bh / 2 + 18); g.stroke(); } } }
      if (x.code) { g.font = `500 40px ${MONO}`; g.textAlign = 'left'; g.fillStyle = 'rgba(190,250,255,.9)';
        x.code.forEach((s, k) => this.typed(g, s, bx + 10, y + bh + 70 + k * 58, x.at + .45 + k * .28, t, .3)); }
    });
  }
  // 几项先排开，到 result.at 往中间收，闪一下，变成结果
  merge(g, it, t) {
    const n = it.inputs.length, R = it.result, m = R ? easeIO(P(t, R.at, .55)) : 0, bw = n > 2 ? 400 : 520, bh = 190, gap = (CW - 160 - n * bw) / Math.max(1, n - 1), y = 240;
    it.inputs.forEach((x, i) => {
      const u = P(t, x.at, .4); if (u <= 0) return; const bx0 = 80 + i * (bw + gap), cx = bx0 + bw / 2, tx = CW / 2, cxm = cx + (tx - cx) * m, s = 1 - .45 * m;
      g.save(); g.globalAlpha = 1 - m * .9; g.translate(cxm, y + bh / 2 + m * 120); g.scale(s, s);
      this.box(g, -bw / 2, -bh / 2, bw, bh, u, false); g.font = `700 ${x.size || 72}px ${SANS}`; g.fillStyle = CY; g.textAlign = 'center'; g.textBaseline = 'middle'; this.typed(g, x.text, 0, 0, x.at + .1, t); g.restore();
      if (i > 0 && m < .2) { const pu = P(t, x.at - .1, .3); g.globalAlpha = (1 - m * 5) * pu; g.font = `300 90px ${SANS}`; g.fillStyle = CY; g.textAlign = 'center'; g.fillText(it.join || '+', bx0 - gap / 2, y + bh / 2); g.globalAlpha = 1; }
    });
    if (R && t >= R.at + .35) {
      const u = P(t, R.at + .35, .45), fl = Math.max(0, 1 - (t - R.at - .35) / .25), bw2 = 860, bh2 = 230, x = CW / 2 - bw2 / 2, yy = 520;
      if (fl > 0) { g.fillStyle = `rgba(200,250,255,${.45 * fl})`; g.beginPath(); g.arc(CW / 2, yy + bh2 / 2, 260 * (1 - fl) + 40, 0, 7); g.fill(); }
      g.save(); g.translate(CW / 2, yy + bh2 / 2); const s = .7 + .3 * back(u); g.scale(s, s); this.box(g, -bw2 / 2, -bh2 / 2, bw2, bh2, u, true);
      g.font = `800 ${R.size || 92}px ${SANS}`; g.fillStyle = WARM; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(R.text, 0, 0); g.restore();
    }
  }
  // 对和错两个大圆：说到哪个，哪个画出来
  check(g, it, t) {
    it.marks.forEach((m, i) => {
      const u = P(t, m.at, .5); if (u <= 0) return; const cx = CW / 2 + (i ? 330 : -330), cy = 400, r = 190, col = m.no ? '#ff8f7a' : CY;
      g.strokeStyle = col; g.lineWidth = 12; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * easeOut(u)); g.stroke();
      const v = P(t, m.at + .3, .35); g.lineWidth = 22; g.lineCap = 'round'; g.beginPath();
      if (!m.no) { const p = [[cx - 85, cy + 5], [cx - 20, cy + 70], [cx + 95, cy - 70]]; g.moveTo(...p[0]); const a = clamp(v * 2), b = clamp(v * 2 - 1); g.lineTo(p[0][0] + (p[1][0] - p[0][0]) * a, p[0][1] + (p[1][1] - p[0][1]) * a); if (b > 0) g.lineTo(p[1][0] + (p[2][0] - p[1][0]) * b, p[1][1] + (p[2][1] - p[1][1]) * b); }
      else { const a = clamp(v * 2), b = clamp(v * 2 - 1); g.moveTo(cx - 75, cy - 75); g.lineTo(cx - 75 + 150 * a, cy - 75 + 150 * a); if (b > 0) { g.moveTo(cx + 75, cy - 75); g.lineTo(cx + 75 - 150 * b, cy - 75 + 150 * b); } }
      g.stroke(); g.lineCap = 'butt';
      g.font = `700 76px ${SANS}`; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; this.typed(g, m.text, cx, cy + r + 95, m.at + .2, t);
    });
  }
}
