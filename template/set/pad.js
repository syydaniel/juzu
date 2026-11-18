// 66 号：桌上的游戏手柄，放在键盘左后方、显示器底下。
// 外形是一块拉伸出来的轮廓（两个握把），上面摇杆、十字键、四个按键、中间一颗会亮的圆钮、后面两个肩键。
// 动作只跟 t 走：hop（被「扔」的那一下：蹦起来再落两下）、rumble（震一下）、glow（中间的钮亮起来）。
import * as THREE from 'three';

export const PAD_AT = { x: 1.27, z: .40, ry: .38 };   // 11-18：原来 1.17，小卡 e07 走到笔记本旁边（1.03, .36）会撞上

function outline() {
  const s = new THREE.Shape();
  const R = [[.05, .046], [[.068, .047], [.077, .038], [.077, .025]], [[.08, .0], [.078, -.03], [.068, -.045]], [[.062, -.058], [.054, -.064], [.045, -.062]],
    [[.036, -.06], [.032, -.04], [.026, -.03]], [[.012, -.022], [.0, -.022], [.0, -.022]]];
  s.moveTo(0, .046); s.lineTo(.05, .046);
  for (const seg of R.slice(1)) s.bezierCurveTo(...seg[0], ...seg[1], ...seg[2]);
  // 左半边：右半边倒着走一遍再镜像
  const back = [[[-.0, -.022], [-.012, -.022], [-.026, -.03]], [[-.032, -.04], [-.036, -.06], [-.045, -.062]], [[-.054, -.064], [-.062, -.058], [-.068, -.045]],
    [[-.078, -.03], [-.08, .0], [-.077, .025]], [[-.077, .038], [-.068, .047], [-.05, .046]]];
  for (const seg of back) s.bezierCurveTo(...seg[0], ...seg[1], ...seg[2]);
  s.lineTo(0, .046); return s;
}

export class Pad {
  constructor(stage, set, spec = {}, TX) {
    this.TX = TX; this.spec = spec; const g = this.g = new THREE.Group(); g.name = 'pad'; stage.scene.add(g);
    this.y0 = (set.MATTOP ?? set.TOP) + .0005; g.position.set(PAD_AT.x, this.y0, PAD_AT.z); g.rotation.y = PAD_AT.ry;
    const body = stage.mat({ color: 0xe8e2d6, rough: .42 }), dark = stage.mat({ color: 0x2b2d33, rough: .55 }), grey = stage.mat({ color: 0x45484f, rough: .6 });
    const add = (geo, mat, x, y, z, p = g) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; p.add(o); return o; };
    const T = .022, BV = .0065;
    const geo = new THREE.ExtrudeGeometry(outline(), { depth: T, bevelEnabled: true, bevelThickness: BV, bevelSize: .0055, bevelSegments: 5, curveSegments: 28 });
    geo.rotateX(-Math.PI / 2); geo.translate(0, BV, 0); add(geo, body, 0, 0, 0);
    const top = T + 2 * BV;                                                            // 机身顶面的高度
    const cyl = (r, h, n = 24) => new THREE.CylinderGeometry(r, r, h, n);
    const stick = (x, z) => { add(cyl(.0115, .003), dark, x, top - .0005, z); add(cyl(.004, .008, 12), dark, x, top + .004, z); const c = add(new THREE.CylinderGeometry(.0098, .0092, .0045, 28), grey, x, top + .009, z); return c; };
    this.sticks = [stick(-.040, -.012), stick(.020, .014)];
    add(new THREE.BoxGeometry(.017, .004, .0055), dark, -.020, top + .001, .014); add(new THREE.BoxGeometry(.0055, .004, .017), dark, -.020, top + .001, .014);   // 十字键
    [[0, -.011, 0x5aa469], [.011, 0, 0xd9574a], [-.011, 0, 0x4f86c6], [0, .011, 0xe0b84a]].forEach(([dx, dz, c]) => add(cyl(.0052, .0035, 20), stage.mat({ color: c, rough: .35 }), .040 + dx, top + .0008, -.012 + dz));   // 四个键
    this.led = new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: .3, emissive: 0xfff1d0, emissiveIntensity: 0 });
    add(cyl(.0065, .003, 24), this.led, 0, top + .0004, -.024);                       // 中间的圆钮
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(.03, .009, .009), grey, sx * .047, top * .62, -.047).rotation.y = sx * -.12;   // 肩键
    g.traverse((o) => { if (o.isMesh) o.userData.fixed = true; });
    this.hops = (spec.hop || []).map((a) => a); this.rum = (spec.rumble || []).map((a) => a); this.glow = (spec.glow || []).map((a) => a);
  }
  update(t) {
    const TX = this.TX, g = this.g; let y = 0, rz = 0, rx = 0, jx = 0, jz = 0;
    for (const a_ of this.hops) { const d = t - TX(a_); if (d < 0 || d > 1.0) continue;
      if (d < .42) { const u = d / .42; y += Math.sin(Math.PI * u) * .042; rz += Math.sin(u * Math.PI) * .32; rx += Math.sin(u * Math.PI) * -.12; }
      else if (d < .64) { const u = (d - .42) / .22; y += Math.sin(Math.PI * u) * .009; rz += Math.sin(u * Math.PI) * -.05; }
      else if (d < .76) { const u = (d - .64) / .12; y += Math.sin(Math.PI * u) * .002; } }
    for (const [a_, dur] of this.rum) { const d = t - TX(a_); if (d < 0 || d > (dur ?? .6)) continue; const k = 1 - d / (dur ?? .6); jx += Math.sin(t * 157) * .0009 * k; jz += Math.sin(t * 131 + 1.3) * .0007 * k; }
    let e = 0; for (const [a_, b_] of this.glow) { const a = TX(a_), b = TX(b_); if (t >= a - .3 && t <= b + .3) e = Math.max(e, Math.min(1, (t - a + .3) / .3, (b + .3 - t) / .3)); }
    this.led.emissiveIntensity = e * (1.6 + Math.sin(t * 3) * .25);
    g.position.set(PAD_AT.x + jx, this.y0 + y, PAD_AT.z + jz); g.rotation.set(rx, PAD_AT.ry, rz);
  }
}
