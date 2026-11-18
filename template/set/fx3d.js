// 片场里的立体字：浮在镜头前的字卡、立在桌上的牌子、从上面掉到桌面的字块。配合运镜，看得出是立在空间里的。
// 每张卡是一块有厚度的金边圆角板，正面贴一张画好字的画布。出现的那一刻按当时的机位摆在镜头前面，
// 之后它就留在原地：镜头继续推、绕、升的时候，卡和后面的桌子、显示器之间会有视差，看得出是立在空间里的。
// 只依赖 t：位置、翻转、浮动、淡出都是 t 的函数。
import * as THREE from 'three';
import { SENSOR_H } from './harness3.js';
import { clamp, ease, easeOut, easeIO, back, P } from './kit.js';
const rnd = (str) => { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.codePointAt(0), 16777619); return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; };   // 按字符串定的随机数

const SANS = '"PingFang SC", -apple-system, "Helvetica Neue", sans-serif', SERIF = '"Songti SC", "STSong", serif', NUM = '"DIN Alternate", "Helvetica Neue", sans-serif';
const GOLD = '#e9b65c';

function shape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}

// 卡面：按样式画在画布上，返回贴图和宽高比
function face(it) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), S = 4;   // 画布按 4 倍画，4K 下也清楚
  const style = it.style || 'card';
  g.font = `800 ${(it.size || 64) * S}px ${it.serif ? SERIF : SANS}`; const tw = g.measureText(it.text).width;
  let W, H;
  if (style === 'num') { W = 420 * S; H = 300 * S; }
  else { W = Math.max(tw + 140 * S, it.sub ? (g.font = `500 ${30 * S}px ${SANS}`, g.measureText(it.sub).width + 140 * S) : 0, (it.minW || 360) * S); H = ((it.kicker ? 64 : 0) + (it.size || 64) * 1.25 + (it.sub ? 60 : 0) + 90) * S; }
  c.width = Math.ceil(W); c.height = Math.ceil(H);
  const light = !!it.flat;                                   // 桌上的字块：米色底、深色字，像木头字块
  // 桌上的字块是瓷白面：不自己发光，被屋里的光照着，百叶窗的光条会落在上面
  const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, light ? '#f4f1ea' : '#20232a'); grd.addColorStop(1, light ? '#e8e3d8' : '#121318'); g.fillStyle = grd; g.fillRect(0, 0, W, H);
  const ink = light ? ({ '#e9b65c': '#9a6414', '#ef6a5b': '#b8321f', '#8d9099': '#7c766c' }[it.col] || '#1d1b19') : (it.col || '#f6f2ea');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (style === 'num') {
    g.font = `800 ${150 * S}px ${NUM}`; g.fillStyle = GOLD; g.fillText(it.num, W / 2, H * .40);
    g.font = `700 ${40 * S}px ${SANS}`; g.fillStyle = '#f3efe6'; g.fillText(it.text, W / 2, H * .80);
  } else {
    let y = 45 * S;
    if (it.kicker) { g.font = `600 ${30 * S}px ${SANS}`; g.fillStyle = GOLD; g.fillText(it.kicker, W / 2, y + 22 * S); y += 64 * S; }
    const fs = (it.size || 64) * S; g.font = `800 ${fs}px ${it.serif ? SERIF : SANS}`; g.fillStyle = ink; g.fillText(it.text, W / 2, y + fs * .62); y += fs * 1.25;
    if (it.mark) { const m = g.measureText(it.text).width; g.fillStyle = 'rgba(233,182,92,.9)'; g.fillRect(W / 2 - m / 2, y - 6 * S, m, 8 * S); }   // 金色划线，动画时由遮罩控制长度
    if (it.sub) { g.font = `500 ${30 * S}px ${SANS}`; g.fillStyle = 'rgba(236,233,226,.78)'; g.fillText(it.sub, W / 2, y + 30 * S); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  let rough = null;
  if (light) {                                               // 字的地方更光一点（像上了釉），底子哑一点
    const rc = document.createElement('canvas'); rc.width = c.width; rc.height = c.height; const rg = rc.getContext('2d');
    rg.fillStyle = '#9a9a9a'; rg.fillRect(0, 0, W, H); rg.font = g.font; rg.textAlign = 'center'; rg.textBaseline = 'middle'; rg.fillStyle = '#3a3a3a';
    const fs = (it.size || 64) * S; rg.font = `800 ${fs}px ${it.serif ? SERIF : SANS}`; rg.fillText(it.text, W / 2, 45 * S + (it.kicker ? 64 * S : 0) + fs * .62);
    rough = new THREE.CanvasTexture(rc); rough.anisotropy = 8;
  }
  return { tex: t, ar: W / H, rough };
}

export class FX3D {
  constructor(stage, list, TX, TOP = .74, MATTOP = .743) {
    this.stage = stage; this.TOP = TOP; this.MATTOP = MATTOP; this.items = (list || []).map((x) => ({ ...x, t0: TX(x.t0 ?? x.at), t1: TX(x.t1), hl: x.hl !== undefined ? [].concat(x.hl).map(TX) : null, st: x.stand !== undefined ? TX(x.stand) : null, offT: x.off !== undefined ? TX(x.off) : null }));
    this.gold = new THREE.MeshStandardMaterial({ color: 0xd8a24a, metalness: .85, roughness: .32 });
    for (const it of this.items) {
      const { tex, ar, rough } = face(it); it.ar = ar;
      const h = 1, w = ar * h, r = .07, dep = .045;
      const geo = new THREE.ExtrudeGeometry(shape(w + .05, h + .05, r), { depth: dep, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 3, curveSegments: 10 });
      geo.translate(0, 0, -dep - .012);
      const slabM = this.gold.clone(); slabM.transparent = true;
      const slab = new THREE.Mesh(geo, slabM); slab.castShadow = true; slab.receiveShadow = true;
      const fm = it.flat ? new THREE.MeshPhysicalMaterial({ map: tex, roughnessMap: rough, roughness: 1, metalness: 0, clearcoat: .35, clearcoatRoughness: .3, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: .06, transparent: true })
        : new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: .85, roughness: .38, metalness: 0, transparent: true });
      it.glow0 = it.flat ? .06 : .85;
      const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), fm); front.position.z = .002;
      const g = new THREE.Group(); g.add(slab, front); g.visible = false; g.userData.fixed = true; slab.userData.fixed = front.userData.fixed = true;
      it.g = g; it.mats = [slabM, fm]; stage.scene.add(g);
    }
  }
  // 卡在 t0 那一刻定位：在当时镜头的视野里，按 x、y（画面宽高的比例，0 是中心）、vh（卡高占画面高的比例）摆，
  // 离镜头的距离取对焦距离的 dk 倍（默认 0.8，落在景深里不糊）
  place(it, pose) {
    if (it.flat) {                                       // 平躺在桌面上：flat = [x, z]，hgt = 卡的纵深（米），yaw = 转角（度）
      // 掉落不规则：每块按自己的文字定一组随机数（每次渲染都一样）：落地的角度、前后错开一点、从多高掉、空中怎么翻、落地后晃几下。
      // 落地时刻固定在 t0 + 0.42 秒，拟音按这个时刻放「嗒」。
      const r = rnd(it.text + it.flat[0]), arrow = it.text.length < 2, sg = () => (r() < .5 ? -1 : 1);
      it.drop = { h: .17 + r() * .1, rx: .25 + r() * .55, rz: sg() * (.2 + r() * .45), ry: sg() * (.15 + r() * .4), bh: .006 + r() * .01, rock: sg() * (.05 + r() * .07), skid: sg() * r() * .006 };
      const yaw = it.yaw ?? sg() * (arrow ? 1 + r() * 2 : 2 + r() * 3.5); it.yaw0 = yaw * Math.PI / 180;
      it.scale = it.hgt || .06; it.up = new THREE.Vector3(0, 1, 0); it.base = new THREE.Vector3(it.flat[0], (it.bed && this.surf ? this.surf(it.flat[0], it.flat[1]) : this.MATTOP) + .07 * it.scale, it.flat[1] + (r() - .5) * .014);   // bed: true 的字块落在被子上（surf 问被面高度）
      it.q = new THREE.Quaternion().setFromAxisAngle(it.up, yaw * Math.PI / 180).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)); return; }
    if (it.pos) {                                        // 立在桌面上：pos = [x, z]，hgt = 卡高（米），yaw = 朝向（度，0 朝观众）
      it.scale = it.hgt || .12; it.up = new THREE.Vector3(0, 1, 0); it.base = new THREE.Vector3(it.pos[0], this.TOP + it.scale * .53, it.pos[1]);
      it.q = new THREE.Quaternion().setFromAxisAngle(it.up, (it.yaw || 0) * Math.PI / 180).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -(it.tilt ?? 6) * Math.PI / 180)); return; }
    const p = pose.p, fwd = pose.l.clone().sub(p).normalize(), right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, fwd);
    const F = Math.max(.25, pose.focus.clone().sub(p).dot(fwd)), d = F * (it.dk ?? .8), vh = d * SENSOR_H / (pose.mm / 1000), vw = vh * 16 / 9;
    const pos = p.clone().addScaledVector(fwd, d).addScaledVector(right, (it.x || 0) * vw).addScaledVector(up, (it.y || 0) * vh);
    it.base = pos; it.scale = vh * (it.vh || .16); it.up = up;
    const m = new THREE.Matrix4().lookAt(p, pos, up); it.q = new THREE.Quaternion().setFromRotationMatrix(m);   // Matrix4.lookAt 让 +z 朝着镜头，卡面正好对着观众
    if (it.yaw) it.q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.yaw * Math.PI / 180));   // 斜一点摆，更显立体
  }
  update(t, poseAt) {
    for (const it of this.items) {
      const on = t >= it.t0 && t < it.t1; it.g.visible = on; if (!on) continue;
      if (!it.base) this.place(it, poseAt(it.t0));
      const i = back(P(t, it.t0, .75)), o = ease(P(t, it.t1 - .45, .45)), a = clamp(P(t, it.t0, .35)) * (1 - o);
      const g = it.g, s = it.scale * (.55 + .45 * i) * (1 - .12 * o);
      if (it.flat) {                                     // 桌上的字：从上面掉下来、落地弹一下；说到它时抬起来一点、发亮；最后缩回去
        const D = it.drop, tl = it.t0 + .42, q = clamp((t - it.t0) / .42), out = easeIO(P(t, it.t1 - .4, .4)), b = P(t, tl, .26), sk = P(t, tl, .7);
        let y = t < tl ? D.h * (1 - q * q) : D.bh * Math.sin(Math.PI * b) * (1 - b), lift = 0, glow = 0;
        const rock = t < tl ? 0 : D.rock * Math.sin(sk * Math.PI * 3) * (1 - sk) ** 2;            // 落地后一边先着地，左右晃两下停住
        if (it.hl) for (const h of it.hl) { const a = Math.min(easeOut(P(t, h, .3)), 1 - easeIO(P(t, h + (it.hlDur ?? 1.6), .5))); if (a > 0) { lift = Math.max(lift, a); glow = Math.max(glow, a); } }
        g.position.copy(it.base); g.position.y += y + lift * .018; g.position.x += t < tl ? 0 : D.skid * easeOut(sk); g.position.y += Math.abs(Math.sin(rock)) * it.ar * it.scale * .5;   // 晃的时候低的那边贴着桌面，不穿进去
        // stand 写了时刻，就在那一刻以靠镜头的那条边为轴立起来（翻到 90 度减 8 度的后仰，带一点回弹，再晃一下停住）
        let th = 0;
        if (it.st !== null && t >= it.st) { const u = back(P(t, it.st, .5)), w = P(t, it.st + .4, .8); th = u * (Math.PI / 2 - .14) + .05 * Math.sin(w * Math.PI * 2) * (1 - w); lift = 0; }
        if (th) { const hh = it.scale / 2, off = new THREE.Vector3(0, hh * Math.sin(th), hh * (1 - Math.cos(th))).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(it.up, it.yaw0 || 0)); g.position.add(off); }
        g.quaternion.copy(it.q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((1 - q) * D.rx + lift * .35 + th, rock, (1 - q) * D.rz + rock * .6)));
        if (t < tl) g.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(it.up, (1 - q) ** 2 * D.ry));
        // off 写了时刻，这块就被推下桌：先抖一下（像不情愿），再往桌沿滑、越滑越快，过了桌沿往前翻着掉下去，掉出画面。桌子前沿在 z = 0.77
        if (it.offT !== null && t >= it.offT - .28) {
          const dt = t - it.offT, edge = .77 - it.base.z + .015, tE = .55, acc = 2 * edge / (tE * tE);
          if (dt < 0) { const e = Math.sin(Math.PI * P(t, it.offT - .28, .28)); g.position.x += .0012 * e * Math.sin(dt * 2 * Math.PI * 22); }
          else { const fT = Math.max(0, dt - tE); g.position.z += dt < tE ? .5 * acc * dt * dt : edge + acc * tE * fT; g.position.y -= 4.9 * fT * fT;
            if (fT > 0) g.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.min(2.6, 7 * fT)));
            if (g.position.y < this.TOP - .45) { g.visible = false; continue; } } }
        g.scale.setScalar(it.scale * Math.max(.001, 1 - out) * (1 + .08 * lift)); it.mats[1].emissiveIntensity = it.glow0 + glow * .5; it.mats[0].emissive?.setHex(glow > 0 ? 0x6a4510 : 0); if (it.mats[0].emissive) it.mats[0].emissiveIntensity = glow;
        it.mats.forEach((m) => { m.opacity = 1; m.depthWrite = true; }); continue; }
      if (it.pos) {                                      // 桌上的牌子：从桌面里升起来，最后沉回去，不晃
        const up = easeOut(P(t, it.t0, .9)) - ease(P(t, it.t1 - .6, .6)); g.position.copy(it.base).addScaledVector(it.up, (up - 1) * it.scale * 1.08);
        g.quaternion.copy(it.q); g.scale.setScalar(it.scale); it.mats.forEach((m) => { m.opacity = 1; m.depthWrite = true; }); continue; }
      g.position.copy(it.base).addScaledVector(it.up, (1 - easeOut(P(t, it.t0, .75))) * -.35 * it.scale + Math.sin((t - it.t0) * 1.4) * .02 * it.scale + o * .15 * it.scale);
      g.quaternion.copy(it.q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((1 - easeOut(P(t, it.t0, .8))) * -1.1, Math.sin((t - it.t0) * .9) * .05, 0)));
      g.scale.setScalar(s); it.mats.forEach((m) => { m.opacity = a; m.depthWrite = a > .98; });
    }
  }
}
