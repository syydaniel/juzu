// 书桌一角。尺寸全部写在 DIM 里，别处只引用；改尺寸只改这里。单位是米。
// 墙角在原点：x 沿背墙向右，z 朝房间里，y 向上。窗在 x = 0 的墙上，书桌靠 z = 0 的墙。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng, wood, plaster, fabric, speckle, canvasTex } from './tex.js';
import { lampBulbRig } from './lamps.js';

export const DIM = {
  room: { W: 3.4, D: 3.2, H: 2.6 },
  win: { z0: .55, z1: 1.95, y0: .9, y1: 2.2 },
  desk: { x: 1.45, z: .42, w: 1.40, d: .70, h: .74, t: .025, leg: .04 },
  mon: { z: .22, w: .611, h: .356, t: .014, vw: .597, vh: .336, cy: 1.085 },
  kb: { x: 1.42, z: .53, w: .2789, d: .1149, h: .006, u: .019, key: .016 },
  mouse: { x: 1.73, z: .54, w: .0571, l: .1135, h: .0216, pad: 0 },     // pad：鼠标下面要垫鼠标垫时写垫子的厚度，鼠标跟着抬高
  mat: { z: .52, w: .80, d: .35, t: .003 },
  mug: { x: 2.07, z: .24, r: .041, h: .095 },   // 在小机器人身后；原来放杯子的地方留了一圈杯印（extras.js）
  note: { x: 1.02, z: .56, w: .148, l: .210, t: .012 },
  phone: { x: 2.06, z: .66, w: .0715, l: .1467, t: .0078 },   // 放在字块安全区（x 1.12 到 1.97）的右边，不压桌上的字
  lamp: { x: .90, z: .22 },
  shelf: { x: 2.10, y: 1.62, w: 1.20, d: .20, t: .025 },
  chair: { x: 1.55, z: .98, rot: .1 },          // 在书桌正前方。放在 (1.0, 1.10) 时，俯视图里椅背压着床尾那个角
  door: { x: 2.83, w: .80, h: 2.02, casing: .065 },   // 前墙上的门（door.js），门套外沿离右墙 10 厘米；opts.door === false 时不留门洞
};

export function buildDesk(stage, opts = {}) {
  const { scene } = stage, room = new THREE.Group(); scene.add(room);
  const { W, D, H } = DIM.room, { z0: WZ0, z1: WZ1, y0: WY0, y1: WY1 } = DIM.win, WZC = (WZ0 + WZ1) / 2;
  const DK = DIM.desk, TOP = DK.h, MATTOP = TOP + DIM.mat.t;

  // ---------- 材质（第 2 级才接贴图，第 3 级才有金属度） ----------
  const T = {
    wall: plaster(3), floor: wood(11, { planks: 8, hue: .078, light: .46, sat: .36, ring: .35 }), desk: wood(23, { hue: .072, light: .50, sat: .38, ring: .7 }),
    steel: speckle(31, { tone: [.085, .088, .095], amount: .1, rough: .42, roughVar: .12 }), alu: speckle(32, { tone: [.80, .81, .83], amount: .012, rough: .32, roughVar: .025, grain: 128 }),
    black: speckle(33, { tone: [.06, .062, .066], amount: .12, rough: .5, roughVar: .15 }), white: speckle(34, { tone: [.93, .93, .915], amount: .02, rough: .5, roughVar: .12 }),
    felt: speckle(35, { tone: [.135, .14, .155], amount: .28, rough: .95, roughVar: .04, grain: 128 }), glaze: speckle(36, { tone: [.15, .36, .27], amount: .05, rough: .34, roughVar: .1 }),
    shade: fabric(37, { tone: [.90, .86, .76], weave: 180 }), mesh: fabric(38, { tone: [.30, .31, .34], weave: 120 }),
    paper: speckle(39, { tone: [.93, .90, .82], amount: .03, rough: .9, roughVar: .05 }), navy: speckle(40, { tone: [.10, .14, .25], amount: .08, rough: .6, roughVar: .12 }),
    clay: speckle(41, { tone: [.66, .36, .22], amount: .1, rough: .85, roughVar: .08 }), leaf: speckle(42, { tone: [.15, .38, .19], amount: .14, rough: .45, roughVar: .15 }),
    cork: wood(43, { hue: .08, light: .55, sat: .35, size: 512 }), slat: speckle(44, { tone: [.92, .90, .85], amount: .02, rough: .55, roughVar: .1 }),
  };
  let M = {
    wall: stage.mat({ color: 0xe6e1d8, rough: .9, set: T.wall, repeat: [3, 3], bumpScale: .5 }),
    ceil: stage.mat({ color: 0xefede8, rough: .95, set: T.wall, repeat: [3, 3], bumpScale: .3 }),
    floor: stage.mat({ color: 0x9b6f47, rough: .5, set: T.floor, repeat: [1.5, 1.5], bumpScale: .35, roughScale: .8 }),
    desk: stage.mat({ color: 0xa06f45, rough: .45, set: T.desk, bumpScale: .4 }),
    steel: stage.mat({ color: 0x1b1c1f, rough: .42, metal: .85, set: T.steel }),
    alu: stage.mat({ color: 0xc6c9ce, rough: .32, metal: 1, set: T.alu, bumpScale: 0 }),
    black: stage.mat({ color: 0x111214, rough: .5, set: T.black, bumpScale: .2 }),
    gloss: stage.mat({ color: 0x08090b, rough: .06 }),
    white: stage.mat({ color: 0xeeeeea, rough: .5, set: T.white, bumpScale: .15 }),
    felt: stage.mat({ color: 0x25262a, rough: .95, set: T.felt, repeat: [9, 4], bumpScale: 1.2 }),
    mug: stage.mat({ color: 0x2f5d48, rough: .2, set: T.glaze, bumpScale: .1 }),
    coffee: stage.mat({ color: 0x1c0f08, rough: .08 }),
    cork: stage.mat({ color: 0xb48a5c, rough: .8, set: T.cork }),
    shade: stage.mat({ color: 0xe9dfca, rough: .85, set: T.shade, repeat: [3, 1], side: THREE.DoubleSide, bumpScale: .2 }),
    mesh: stage.mat({ color: 0x4a4c52, rough: .9, set: T.mesh, repeat: [2, 2], bumpScale: 1.2 }),
    paper: stage.mat({ color: 0xefe8d6, rough: .9, set: T.paper }),
    navy: stage.mat({ color: 0x1f2a44, rough: .6, set: T.navy, bumpScale: .3 }),
    pot: stage.mat({ color: 0xb5653f, rough: .85, set: T.clay, bumpScale: .5 }),
    soil: stage.mat({ color: 0x2a1e16, rough: 1 }),
    leaf: stage.mat({ color: 0x2e6b3a, rough: .45, set: T.leaf, side: THREE.DoubleSide, bumpScale: .4 }),
    slat: stage.mat({ color: 0xece7dc, rough: .55, set: T.slat, repeat: [6, 1] }),
    glass: stage.mat({ color: 0xdfeef2, rough: .03, transparent: true, opacity: .07 }),
    rubber: stage.mat({ color: 0x0c0c0d, rough: .8 }),
    book: stage.mat({ color: 0xffffff, rough: .7, set: speckle(45, { tone: [1, 1, 1], amount: .04, rough: .7, roughVar: .1 }) }),
    red: stage.mat({ color: 0x9c3a2c, rough: .5 }),
  };

  M.wall.shadowSide = M.ceil.shadowSide = THREE.DoubleSide;

  // ---------- 小工具 ----------
  const add = (geo, mat, x, y, z, parent = room, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = o.cast ?? true; m.receiveShadow = o.recv ?? true; parent.add(m); return m; };
  const rb = (w, h, d, r = .003) => new RoundedBoxGeometry(w, h, d, 3, Math.max(1e-4, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)));
  const B = (w, h, d, r, mat, x, y, z, parent, o) => add(rb(w, h, d, r), mat, x, y, z, parent, o);          // 圆角盒：每条棱都有倒角
  const lathe = (pts, mat, x, y, z, parent, seg = 56) => add(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg), mat, x, y, z, parent);
  const cyl = (r, h, mat, x, y, z, parent, seg = 32) => add(new THREE.CylinderGeometry(r, r, h, seg), mat, x, y, z, parent);
  const tube = (pts, r, mat, parent) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'centripetal'), 64, r, 8), mat, 0, 0, 0, parent);
  const group = (x, y, z, stop, parent = room) => { const g = new THREE.Group(); g.position.set(x, y, z); if (stop) g.userData.stop = stop; parent.add(g); return g; };

  // ---------- 18–20 房间外壳、窗、踢脚线 ----------
  { const f = add(new THREE.PlaneGeometry(W, D), M.floor, W / 2, 0, D / 2, room, { cast: false }); f.rotation.x = -Math.PI / 2;
    const wallBox = (w, h, d, x, y, z, m = M.wall) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z);
    wallBox(W + .2, H, .1, W / 2, H / 2, -.05); wallBox(W + .2, H, .1, W / 2, H / 2, D + .05); wallBox(.1, H, D, W + .05, H / 2, D / 2);
    wallBox(W + .2, .12, D + 6, W / 2, H + .05, D / 2, M.ceil); wallBox(W + .2, .1, D + .2, W / 2, -.052, D / 2);
    wallBox(.1, H, WZ0 + .1, -.05, H / 2, WZ0 / 2 - .05); wallBox(.1, H, 6 - WZ1, -.05, H / 2, (6 + WZ1) / 2);                 // 窗墙多伸出去一截，太阳绕不进来
    wallBox(.1, WY0, WZ1 - WZ0, -.05, WY0 / 2, WZC); wallBox(.1, H - WY1, WZ1 - WZ0, -.05, (H + WY1) / 2, WZC);
    const dl = opts.door === false ? W : DIM.door.x - DIM.door.w / 2 - DIM.door.casing, dr = opts.door === false ? W : DIM.door.x + DIM.door.w / 2 + DIM.door.casing;   // 前墙的踢脚线在门套两边断开
    for (const [w, d, x, z] of [[W, .012, W / 2, .006], [.012, D, .006, D / 2], [dl, .012, dl / 2, D - .006], [W - dr, .012, (W + dr) / 2, D - .006], [.012, D, W - .006, D / 2]]) if (w > .001) B(w, .08, d, .004, M.white, x, .04, z);
    const fw = .045, fx = -.045;                                                                                       // 窗框四边、中梃、玻璃、窗台
    B(.06, fw, WZ1 - WZ0, .004, M.white, fx, WY1 - fw / 2, WZC); B(.06, fw, WZ1 - WZ0, .004, M.white, fx, WY0 + fw / 2, WZC);
    B(.06, WY1 - WY0, fw, .004, M.white, fx, (WY0 + WY1) / 2, WZ0 + fw / 2); B(.06, WY1 - WY0, fw, .004, M.white, fx, (WY0 + WY1) / 2, WZ1 - fw / 2);
    B(.05, WY1 - WY0, .035, .004, M.white, fx, (WY0 + WY1) / 2, WZC);
    const gl = add(new THREE.PlaneGeometry(WZ1 - WZ0, WY1 - WY0), M.glass, fx - .01, (WY0 + WY1) / 2, WZC, room, { cast: false, recv: false }); gl.rotation.y = Math.PI / 2; gl.userData.minLevel = 3;
    B(.17, .03, WZ1 - WZ0 + .1, .006, M.white, .035, WY0 - .015, WZC); }

  // ---------- 19 百叶窗：上轨、29 片、梯绳、底轨、调节杆 ----------
  const blinds = group(0, 0, 0, 'blinds'); let setTilt = () => {};
  { const n = 29, pitch = .043, len = WZ1 - WZ0 - .04, x = .04;
    B(.03, .025, len + .02, .004, M.white, x, WY1 - .0125, WZC, blinds);
    const sg = new THREE.BoxGeometry(.025, .0018, len, 2, 1, 40), SP = sg.attributes.position;                  // 每片中间下垂 2 毫米，横截面带一点弧
    for (let k = 0; k < SP.count; k++) { const u = SP.getZ(k) / (len / 2), c = SP.getX(k) / .0125; SP.setY(k, SP.getY(k) - .002 * (1 - u * u) + .0012 * (1 - c * c)); } sg.computeVertexNormals();
    const sl = new THREE.InstancedMesh(sg, M.slat, n), o = new THREE.Object3D(), rs = rng(19), jit = Array.from({ length: n }, () => [(rs() - .5) * .002, (rs() - .5) * .012, (rs() - .5) * .06]);
    // 百叶的角度可以变（tilt 是弧度，-.5 是平时的角度，-1.35 差不多合上，-.15 几乎全开）。导演表 BLINDS 控制；光条在桌面和床上跟着扫过去。
    // wave：每片晚一点点转，像拉杆带着梯绳一级级动
    setTilt = (tilt, wave = 0) => { for (let i = 0; i < n; i++) { const [dy, rx, rz] = jit[i]; o.position.set(x, WY1 - .045 - i * pitch + dy, WZC); o.rotation.set(rx, 0, tilt + wave * Math.sin(i * .35) + rz + (i === 11 ? .16 : 0) + (i === 23 ? -.12 : 0)); o.updateMatrix(); sl.setMatrixAt(i, o.matrix); } sl.instanceMatrix.needsUpdate = true; };
    setTilt(-.5); sl.castShadow = sl.receiveShadow = true; blinds.add(sl);
    for (const z of [WZ0 + .28, WZ1 - .28]) add(new THREE.BoxGeometry(.0015, n * pitch, .004), M.white, x, WY1 - .03 - n * pitch / 2, z, blinds);
    B(.025, .012, len, .003, M.white, x, WY1 - .05 - n * pitch, WZC, blinds);
    const wand = cyl(.004, .62, M.white, x + .02, WY1 - .34, WZ0 + .07, blinds, 12); wand.rotation.x = .05; }

  // ---------- 1–3 书桌：桌面、四条腿、横梁、脚垫、理线槽 ----------
  { const lx = DK.w / 2 - .07, lz = DK.d / 2 - .07, lh = TOP - DK.t;
    B(DK.w, DK.t, DK.d, .004, M.desk, DK.x, TOP - DK.t / 2, DK.z);
    for (const sx of [-1, 1]) { for (const sz of [-1, 1]) { B(DK.leg, lh, DK.leg, .005, M.steel, DK.x + sx * lx, lh / 2, DK.z + sz * lz); cyl(.017, .006, M.rubber, DK.x + sx * lx, .003, DK.z + sz * lz); }
      B(DK.leg, DK.leg, lz * 2 - DK.leg, .005, M.steel, DK.x + sx * lx, lh - DK.leg / 2, DK.z); }
    B(lx * 2 - DK.leg, DK.leg, .02, .004, M.steel, DK.x, lh - DK.leg / 2, DK.z - lz);
    const ty = .62, tz = DK.z - lz + .09; B(.9, .008, .13, .003, M.steel, DK.x, ty, tz); B(.9, .035, .006, .002, M.steel, DK.x, ty + .017, tz + .062); B(.9, .035, .006, .002, M.steel, DK.x, ty + .017, tz - .062);
    for (const sx of [-1, 1]) B(.02, TOP - DK.t - ty, .02, .003, M.steel, DK.x + sx * .44, (TOP - DK.t + ty) / 2, tz); }

  // ---------- 8 桌垫 ----------
  B(DIM.mat.w, DIM.mat.t, DIM.mat.d, .0015, M.felt, DK.x, TOP + DIM.mat.t / 2, DIM.mat.z, room, { cast: false });

  // ---------- 4–5 显示器：外框、后壳、屏幕、立柱、铰链、底板 ----------
  const MN = DIM.mon, monitor = group(DK.x, 0, MN.z, 'monitor');
  B(MN.w, MN.h, MN.t, .004, M.black, 0, MN.cy, 0, monitor); B(.34, .22, .022, .01, M.black, 0, MN.cy - .01, -.016, monitor);
  B(.07, .30, .012, .003, M.alu, 0, TOP + .16, -.045, monitor).rotation.x = -.08; cyl(.016, .08, M.alu, 0, MN.cy - .05, -.03, monitor).rotation.z = Math.PI / 2;
  B(.24, .008, .19, .004, M.alu, 0, TOP + .004, -.02, monitor);
  const scr = document.createElement('canvas'); scr.width = opts.screenW || 1792; scr.height = Math.round(scr.width * 9 / 16);
  const scrTex = new THREE.CanvasTexture(scr); scrTex.colorSpace = THREE.SRGBColorSpace; scrTex.anisotropy = 8;
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: .42, emissive: 0xffffff, emissiveMap: scrTex }), screen = add(new THREE.PlaneGeometry(MN.vw, MN.vh), screenMat, 0, MN.cy, MN.t / 2 + .0003, monitor, { cast: false });
  function drawScreen(t) {                                                // 占位画面：没有导演表时才用（成片由 film.js 来画）
    const g = scr.getContext('2d'), w = scr.width, h = scr.height; g.fillStyle = '#14151a'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d1f26'; g.fillRect(0, 0, w, 78);
    for (let i = 0; i < 3; i++) { g.fillStyle = ['#ff5f57', '#febc2e', '#28c840'][i]; g.beginPath(); g.arc(48 + i * 42, 39, 13, 0, 7); g.fill(); }
    g.font = '600 36px -apple-system, "PingFang SC", sans-serif'; g.fillStyle = '#8b8f99'; g.fillText('片场 · 占位画面', 210, 52);
    const line = '这块屏幕由导演表来画', n = Math.max(0, Math.min(line.length, Math.floor((t - 1.2) * 9)));
    g.font = '500 62px -apple-system, "PingFang SC", sans-serif'; g.fillStyle = '#e8a45c'; g.fillText('>', 86, 240); g.fillStyle = '#f2f2f2'; g.fillText(line.slice(0, n), 148, 240);
    if (Math.floor(t * 2) % 2 === 0) g.fillRect(154 + g.measureText(line.slice(0, n)).width, 186, 6, 68);
    ['规格表', '灰模', '逐级打开', '全开之后'].forEach((s, i) => { const on = t > 4.2 + i * .55, y = 380 + i * 126;
      g.fillStyle = on ? '#23262f' : '#191b21'; g.beginPath(); g.roundRect(86, y, 1080, 96, 20); g.fill();
      g.fillStyle = on ? '#7ad39b' : '#3a3d47'; g.beginPath(); g.arc(140, y + 48, 16, 0, 7); g.fill();
      g.font = '500 46px -apple-system, "PingFang SC", sans-serif'; g.fillStyle = on ? '#f2f2f2' : '#5a5e6b'; g.fillText(`第 ${'一二三四'[i]} 道闸门：${s}`, 186, y + 64); });
    const p = Math.max(0, Math.min(1, (t - 4.2) / 2.4)); g.fillStyle = '#23262f'; g.beginPath(); g.roundRect(1250, 380, 440, 474, 26); g.fill();
    g.font = '700 136px -apple-system, sans-serif'; g.fillStyle = '#ffd28a'; g.textAlign = 'center'; g.fillText(Math.round(p * 100) + '%', 1470, 620);
    g.font = '500 40px -apple-system, "PingFang SC", sans-serif'; g.fillStyle = '#8b8f99'; g.fillText('片场完成度', 1470, 700); g.textAlign = 'left';
    g.fillStyle = '#3a3d47'; g.fillRect(1300, 760, 340, 12); g.fillStyle = '#ffd28a'; g.fillRect(1300, 760, 340 * p, 12); scrTex.needsUpdate = true;
  }

  // ---------- 6 键盘：底板、77 个键分六排、键帽字符 ----------
  { const K = DIM.kb, kb = group(K.x, MATTOP, K.z), u = K.u, total = 14.5 * u, depth = .011 + 5 * u;
    B(K.w, K.h, K.d, .003, M.alu, 0, K.h / 2, 0, kb);
    const rows = [[1.5, ...Array(13).fill(1)], [...Array(13).fill(1), 1.5], [1.5, ...Array(13).fill(1)], [1.75, ...Array(11).fill(1), 1.75], [2.25, ...Array(10).fill(1), 2.25], [1, 1, 1, 1.25, 5, 1.25, 1, 1, 1, 1]];
    const glyph = [['esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', '⏻'], [...'`1234567890-=', '⌫'], ['⇥', ...'QWERTYUIOP[]\\'], ['⇪', ...'ASDFGHJKL;\'', '⏎'], ['⇧', ...'ZXCVBNM,./', '⇧'], ['fn', '⌃', '⌥', '⌘', '', '⌘', '⌥', '←', '↓', '→']];
    const count = rows.flat().length, keys = new THREE.InstancedMesh(rb(K.key, .003, K.key, .0012), M.white, count), o = new THREE.Object3D(), cells = []; let k = 0, z = -depth / 2;
    rows.forEach((row, ri) => { const pd = ri === 0 ? .011 : u, kd = pd - .003; let x = -total / 2;
      row.forEach((wu, ci) => { const kw = wu * u - .003; o.position.set(x + wu * u / 2, K.h + .0015, z + pd / 2); o.scale.set(kw / K.key, 1, kd / K.key); o.updateMatrix(); keys.setMatrixAt(k++, o.matrix);
        cells.push([(x + wu * u / 2 + total / 2) / total, (z + pd / 2 + depth / 2) / depth, glyph[ri][ci], ri === 0]); x += wu * u; }); z += pd; });
    keys.castShadow = keys.receiveShadow = true; kb.add(keys);
    const lt = canvasTex(2048, Math.round(2048 * depth / total), (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#3b3d42'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const [cx, cy, s, small] of cells) { g.font = `500 ${small || s.length > 1 ? 30 : 52}px -apple-system, "Helvetica Neue", sans-serif`; g.fillText(s, cx * w, cy * h); } });
    const lm = new THREE.MeshStandardMaterial({ map: lt, transparent: true, roughness: .6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const lp = add(new THREE.PlaneGeometry(total, depth), lm, 0, K.h + .0031, 0, kb, { cast: false }); lp.rotation.x = -Math.PI / 2; lp.userData.minLevel = 2; }

  // ---------- 7 鼠标 ----------
  { const g = new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), P = g.attributes.position;                 // 方圆角的低拱形：平面是圆角矩形，顶是一道缓弧
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), h = Math.hypot(x, z) || 1e-6, c = Math.abs(x / h), sn = Math.abs(z / h);
      const sq = h < 1e-5 ? 0 : Math.pow(Math.pow(c, 4) + Math.pow(sn, 4), -.25), rr = Math.pow(h, .55) * sq; P.setXYZ(i, x / h * rr, Math.pow(Math.max(0, y), .8), z / h * rr); }
    g.computeVertexNormals(); const m = add(g, stage.mat({ color: 0xf1f1ef, rough: .2 }), DIM.mouse.x, MATTOP + (DIM.mouse.pad || 0), DIM.mouse.z); m.scale.set(DIM.mouse.w / 2 * .92, DIM.mouse.h, DIM.mouse.l / 2 * .92); m.rotation.y = .12; }

  // ---------- 9 杯子：带内壁的杯身、把手、咖啡、杯垫 ----------
  const mug = group(DIM.mug.x, TOP, DIM.mug.z, 'mug'); mug.rotation.y = .7;
  lathe([[0, .005], [.036, .005], [.0395, .008], [.041, .014], [.041, .09], [.0405, .0945], [.039, .095], [.0375, .0935], [.037, .09], [.0362, .014], [0, .011]], M.mug, 0, 0, 0, mug);
  cyl(.0366, .001, M.coffee, 0, .079, 0, mug).castShadow = false;
  { const h = add(new THREE.TorusGeometry(.027, .0062, 14, 36, Math.PI), M.mug, .039, .053, 0, mug); h.rotation.z = -Math.PI / 2; }
  lathe([[0, 0], [.049, 0], [.05, .001], [.05, .004], [.049, .005], [0, .005]], M.cork, 0, 0, 0, mug);

  // ---------- 10 台灯：底座、灯杆、灯罩、灯泡 ----------
  const lamp = group(DIM.lamp.x, TOP, DIM.lamp.z);
  lathe([[0, 0], [.073, 0], [.075, .003], [.075, .012], [.07, .016], [.014, .021], [.007, .03], [0, .03]], M.steel, 0, 0, 0, lamp); cyl(.005, .36, M.steel, 0, .2, 0, lamp, 16);
  lathe([[.11, .30], [.109, .303], [.066, .44], [.0655, .437]], M.shade, 0, 0, 0, lamp).userData.lampShade = true; add(new THREE.TorusGeometry(.11, .0025, 8, 64), M.steel, 0, .30, 0, lamp).rotation.x = Math.PI / 2; add(new THREE.TorusGeometry(.066, .0025, 8, 48), M.steel, 0, .44, 0, lamp).rotation.x = Math.PI / 2;
  const bulb = add(new THREE.SphereGeometry(.026, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, .37, 0, lamp, { cast: false, recv: false });
  // 台灯照布灯罩的样子分三路（lamps.js）：往下一束，灯罩下口多大就照多大（灯泡到下口边 57°），边是软的；往上一束，上口小（43°），暗一些；
  // 透过布的一点光，往四周都有但很弱，照不出灯罩自己的影子。只放一个点光的话，墙上、天花板上会被灯罩口切出几道很硬的大弧，像探照灯。
  // 灯泡有大小：harness3 每个采样把整组灯在灯泡里挪一下（stage.emit），影子边是软的。
  const lampRig = lampBulbRig(lamp, [0, .37, 0], { down: [1.0, .35], up: [.74, .55] });

  // ---------- 11 笔记本和笔 ----------
  let noteG = null;   // 笔记本能翻开（notebook.js，导演表 NOTEBOOK），几个部件交出去
  { const N = DIM.note, nb = group(N.x, TOP, N.z, 'note'); nb.rotation.y = .21;
    B(N.w, .0015, N.l, .0007, M.navy, 0, .00075, 0, nb); const paper = B(N.w - .004, N.t - .003, N.l - .004, .0005, M.paper, -.001, N.t / 2, 0, nb); const top = B(N.w, .0015, N.l, .0007, M.navy, 0, N.t - .00075, 0, nb);
    const band = B(.007, N.t + .0006, N.l + .0006, .0003, M.black, N.w / 2 - .018, N.t / 2, 0, nb);
    const pen = group(-.01, N.t + .0045, .01, null, nb); pen.rotation.y = .9; cyl(.0045, .125, M.black, 0, 0, 0, pen, 16).rotation.z = Math.PI / 2;
    const tip = add(new THREE.ConeGeometry(.0045, .014, 16), M.alu, .0695, 0, 0, pen); tip.rotation.z = -Math.PI / 2; B(.04, .0012, .003, .0005, M.alu, -.035, .0048, 0, pen);
    noteG = { nb, top, band, pen, paper, N, M }; }

  // ---------- 12 手机 ----------
  let phoneG = null;   // 手机能翻过来亮屏（phone.js，导演表 PHONE），整组交出去
  { const P = DIM.phone, ph = group(P.x, TOP, P.z); ph.rotation.y = -.31; phoneG = ph; const pm = stage.mat({ color: 0x343840, rough: .32 }); B(P.w, P.t, P.l, .0035, pm, 0, P.t / 2, 0, ph); B(.032, .0022, .032, .0009, pm, -.015, P.t + .0008, -.05, ph);
    for (const [lx, lz] of [[-.022, -.057], [-.008, -.043]]) { cyl(.0062, .0012, M.gloss, lx, P.t + .0023, lz, ph, 24); add(new THREE.TorusGeometry(.0066, .0006, 6, 24), M.alu, lx, P.t + .0026, lz, ph, { cast: false }).rotation.x = Math.PI / 2; } }

  // ---------- 13–15 搁板、支架、书、盆栽 ----------
  const SH = DIM.shelf, books = group(0, 0, 0, 'books'), SY = SH.y + SH.t / 2;
  B(SH.w, SH.t, SH.d, .003, M.desk, SH.x, SH.y, SH.d / 2 + .003, books);
  for (const bx of [SH.x - .42, SH.x + .42]) { B(.03, .16, .004, .001, M.steel, bx, SH.y - .09, .002, books); B(.03, .004, .17, .001, M.steel, bx, SH.y - .0145, .09, books);
    const d = B(.02, .004, .17, .001, M.steel, bx, SH.y - .08, .075, books); d.rotation.x = -.75; }
  { const r = rng(7), list = []; let x = SH.x - SH.w / 2 + .2;
    while (x < SH.x + SH.w / 2 - .06) { const w = .018 + r() * .022, h = .17 + r() * .09, d = .12 + r() * .05, lean = list.length === 9 ? .2 : (r() - .5) * .02; if (list.length === 9) x += .03;
      list.push({ x: x + w / 2, w, h, d, lean, col: new THREE.Color().setHSL(r() < .7 ? .02 + r() * .1 : .55 + r() * .1, .25 + r() * .4, .10 + r() * .30), band: r() < .5 }); x += w + .0015 + (list.length === 10 ? .045 : 0); }
    const bands = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.book, list.length * 2), cover = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.book, list.length * 3), pages = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.paper, list.length), o = new THREE.Object3D(), piv = new THREE.Object3D(); piv.add(o);
    list.forEach((b, i) => { piv.position.set(b.x, SY, .01 + b.d / 2); piv.rotation.set(0, 0, -b.lean);                 // 封面是两片板加一条书脊，纸页比封面矮一点、缩进去一点
      const put = (mesh, k, px, py, pz, sx, sy, sz) => { o.position.set(px, py, pz); o.scale.set(sx, sy, sz); piv.updateMatrixWorld(true); mesh.setMatrixAt(k, o.matrixWorld); };
      put(cover, i * 3, -b.w / 2 + .001, b.h / 2, 0, .002, b.h, b.d); put(cover, i * 3 + 1, b.w / 2 - .001, b.h / 2, 0, .002, b.h, b.d); put(cover, i * 3 + 2, 0, b.h / 2, b.d / 2 - .001, b.w, b.h, .002);
      put(pages, i, 0, (b.h - .004) / 2, -.002, b.w - .004, b.h - .004, b.d - .006); for (let k = 0; k < 3; k++) cover.setColorAt(i * 3 + k, b.col);
      put(bands, i * 2, 0, b.h * (b.band ? .74 : .5), b.d / 2 + .0003, b.w * .86, b.band ? .03 : b.h * .5, .0006); put(bands, i * 2 + 1, 0, .02, b.d / 2 + .0003, b.w * .5, .008, .0006);
      bands.setColorAt(i * 2, new THREE.Color(b.band ? 0xd8cfb4 : b.col.clone().multiplyScalar(1.5).getHex())); bands.setColorAt(i * 2 + 1, new THREE.Color(0xb89a55)); });
    for (const m of [cover, pages, bands]) { m.castShadow = m.receiveShadow = true; books.add(m); } }
  { const pl = group(SH.x - SH.w / 2 + .09, SY, .105), r = rng(21);
    lathe([[0, 0], [.04, 0], [.043, .003], [.055, .085], [.058, .09], [.056, .094], [.05, .09], [.05, .08], [0, .08]], M.pot, 0, 0, 0, pl); cyl(.05, .002, M.soil, 0, .081, 0, pl);
    const leafGeo = (L, Wd, droop) => { const g = new THREE.PlaneGeometry(1, 1, 6, 12), P = g.attributes.position;              // 叶片：中脉折起，叶尖往下弯
      for (let k = 0; k < P.count; k++) { const u = P.getY(k) + .5, v = P.getX(k) * 2, w = Math.sin(Math.PI * Math.pow(u, .8)) * Wd * (1 - .15 * u);
        P.setXYZ(k, v * w, u * L * Math.cos(droop * u * u), Math.abs(v) * w * .35 - u * u * L * Math.sin(droop * u * u) * 1.2); } g.computeVertexNormals(); return g; };
    for (let i = 0; i < 30; i++) { const st = group(0, .08, 0, null, pl); st.rotation.y = i * 2.4 + r(); const tilt = .15 + r() * 1.0, len = .05 + r() * .06, stem = .02 + r() * .05;
      cyl(.0012, stem, M.leaf, 0, Math.cos(tilt) * stem / 2, Math.sin(tilt) * stem / 2, st, 6).rotation.x = tilt;
      const lf = add(leafGeo(len, .014 + r() * .01, .6 + r() * .9), M.leaf, 0, Math.cos(tilt) * stem, Math.sin(tilt) * stem, st); lf.rotation.x = tilt * .9; lf.rotation.y = (r() - .5) * .5; } }

  // ---------- 16 画框 ----------
  let artMesh = null;
  { const fx = .80, fy = 1.50, fw = .40, fh = .50, b = .02;
    for (const [w, h, x, y] of [[fw, b, 0, fh / 2 - b / 2], [fw, b, 0, -fh / 2 + b / 2], [b, fh, -fw / 2 + b / 2, 0], [b, fh, fw / 2 - b / 2, 0]]) B(w, h, .022, .003, M.black, fx + x, fy + y, .011);
    add(new THREE.PlaneGeometry(fw - b, fh - b), M.paper, fx, fy, .006, room, { cast: false });
    const art = canvasTex(512, 640, (g, w, h) => { const r = rng(5); g.fillStyle = '#e9e2d0'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 7; i++) { g.fillStyle = ['#c9623f', '#28435c', '#d9a441', '#3c3a36', '#8fa39a'][i % 5]; g.globalAlpha = .88; i % 2 ? g.fillRect(r() * w * .6, r() * h * .7, 60 + r() * 180, 60 + r() * 220) : (g.beginPath(), g.arc(r() * w, r() * h, 40 + r() * 110, 0, 7), g.fill()); } });
    const am = stage.mat({ color: 0xcdb89a, rough: .9, set: { map: art } }); artMesh = add(new THREE.PlaneGeometry(fw - .12, fh - .14), am, fx, fy, .0075, room, { cast: false }); }   // 画芯是程序画的抽象画；extras.js 可以换成自己的图（SET.decor.painting）

  // ---------- 17 椅子：座垫、靠背和腰托、扶手、气杆、五星脚和轮子 ----------
  { const C = DIM.chair, ch = group(C.x, 0, C.z); ch.rotation.y = C.rot;
    const M_black = M.black; M = { ...M, black: stage.mat({ color: 0x2c2d31, rough: .55, set: T.black, bumpScale: .2, tint: 0xffffff }) };
    B(.50, .07, .48, .03, M.mesh, 0, .47, 0, ch); B(.30, .035, .30, .01, M.black, 0, .42, 0, ch);
    const back = group(0, .54, -.17, null, ch); back.rotation.x = .13; const R0 = .42, A = .56;                       // 弧形靠背：一段圆弧面，两边向前包
    add(new THREE.LatheGeometry([[R0 - .006, .02], [R0, .0], [R0 + .008, .04], [R0 + .014, .16], [R0 + .006, .34], [R0 - .004, .52], [R0 - .012, .55], [R0 - .02, .53], [R0 - .008, .34], [R0 + .002, .16], [R0 - .004, .05], [R0 - .006, .02]].map(q => new THREE.Vector2(q[0], q[1])), 28, -A, A * 2), M.mesh, 0, 0, 0, back);
    const arc = (y, r) => Array.from({ length: 9 }, (_, i) => { const a = -A + i / 8 * A * 2; return [Math.sin(a) * r, y, Math.cos(a) * r]; });
    tube(arc(.0, R0 + .002), .011, M.black, back); tube(arc(.545, R0 - .014), .011, M.black, back);
    for (const sx of [-1, 1]) tube([[Math.sin(sx * A) * R0, 0, Math.cos(A) * R0], [Math.sin(sx * A) * (R0 + .012), .18, Math.cos(A) * (R0 + .012)], [Math.sin(sx * A) * (R0 - .014), .545, Math.cos(A) * (R0 - .014)]], .011, M.black, back);
    B(.30, .08, .03, .013, M.black, 0, .17, R0 + .03, back); B(.07, .40, .03, .012, M.black, 0, .0, R0 + .045, back).rotation.x = -.12;
    for (const sx of [-1, 1]) { B(.03, .21, .045, .008, M.black, sx * .275, .555, .03, ch); B(.075, .025, .25, .011, M.black, sx * .275, .672, .0, ch); }
    lathe([[0, .09], [.03, .09], [.03, .26], [.022, .27], [.022, .40], [0, .40]], M.alu, 0, 0, 0, ch, 24); cyl(.045, .05, M.black, 0, .085, 0, ch);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + .3, arm = group(0, 0, 0, null, ch); arm.rotation.y = a;
      const b = B(.30, .028, .042, .01, M.black, .165, .078, 0, arm); b.rotation.z = -.1;
      for (const sz of [-1, 1]) { const w = add(new THREE.CylinderGeometry(.027, .027, .018, 24), M.rubber, .31, .027, sz * .013, arm); w.rotation.x = Math.PI / 2; } B(.03, .04, .012, .004, M.black, .31, .05, 0, arm); }
    M = { ...M, black: M_black }; }

  // ---------- 21–22 插线板、四根线、墙上的插座 ----------
  B(.30, .03, .055, .006, M.white, 1.95, .015, .20); B(.02, .006, .012, .002, M.red, 1.83, .033, .20); for (let i = 0; i < 5; i++) B(.034, .003, .034, .001, M.black, 1.875 + i * .045, .0305, .20, room, { cast: false });
  B(.086, .086, .008, .004, M.white, 2.35, .30, .004); for (const dx of [-.012, .012]) B(.005, .014, .002, .001, M.black, 2.35 + dx, .30, .0085, room, { cast: false });
  tube([[DK.x, 1.0, MN.z - .03], [DK.x + .01, .82, .09], [DK.x + .02, .66, .14], [DK.x + .2, .63, .15], [1.8, .4, .12], [1.9, .06, .18], [1.93, .032, .20]], .0028, M.rubber);
  tube([[DIM.lamp.x, TOP + .012, DIM.lamp.z - .07], [DIM.lamp.x + .01, TOP + .004, .075], [DIM.lamp.x + .03, .6, .05], [1.05, .2, .06], [1.3, .012, .16], [1.6, .01, .26], [1.8, .02, .21]], .0024, M.white);
  tube([[2.1, .016, .20], [2.22, .008, .26], [2.40, .008, .20], [2.38, .10, .07], [2.352, .21, .05], [2.35, .268, .04]], .0032, M.white); B(.036, .036, .03, .007, M.white, 2.35, .285, .023);
  tube([[1.72, .006, .30], [1.6, .006, .42], [1.72, .006, .52], [1.86, .006, .44], [1.78, .006, .33], [1.9, .02, .24]], .0026, M.rubber);

  // ---------- 天色和灯 ----------
  const sky = add(new THREE.SphereGeometry(60, 32, 24), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }), 0, 0, 0, scene, { cast: false, recv: false }); sky.userData.fixed = true;
  { const g = sky.geometry, n = g.attributes.position.count; g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); }
  const paintSky = (hor, top) => { const g = sky.geometry, P = g.attributes.position, C = g.attributes.color; for (let i = 0; i < P.count; i++) { const k = Math.pow(Math.max(0, Math.min(1, P.getY(i) / 60 * 2.2 + .12)), .6); C.setXYZ(i, hor[0] + (top[0] - hor[0]) * k, hor[1] + (top[1] - hor[1]) * k, hor[2] + (top[2] - hor[2]) * k); } C.needsUpdate = true; };
  const outs = []; { const r = rng(77); for (let i = 0; i < 9; i++) { const tree = i % 3 === 2, w = tree ? 5 + r() * 4 : 7 + r() * 9, h = tree ? 5 + r() * 4 : 8 + r() * 16;
      const m = add(tree ? new THREE.SphereGeometry(w / 2, 12, 8) : new THREE.BoxGeometry(w, h, w), new THREE.MeshBasicMaterial(), -16 - r() * 22, tree ? -1 + r() * 2 : h / 2 - 6, -12 + i * 4.2 + r() * 2, scene, { cast: false, recv: false }); m.userData.fixed = true; outs.push(m); } }
  const sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -3.4, right: 3.4, top: 3.2, bottom: -3.2, near: .5, far: 16 }); sun.shadow.bias = -.00015; sun.shadow.normalBias = .004;   // 阴影盖到整间屋子：只盖书桌那 ±2.5 米时，床角那边的墙角会漏光
  sun.target.position.set(1.6, 1.0, 1.6); const amb = new THREE.AmbientLight(0xffffff, 0), hemi = new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0), scrLight = new THREE.PointLight(0xb9c6ff, 0, 2.5, 2); scrLight.position.set(DK.x, MN.cy, MN.z + .25);
  const bounceA = new THREE.PointLight(0xffd0a0, 0, 4, 2), bounceB = new THREE.PointLight(0xffc8a0, 0, 3.5, 2); bounceA.position.set(2.2, 1.2, -.7); bounceB.position.set(2.75, -.7, 1.1);   // 放在墙后面和地板下面：只有朝着那面墙、那块地的面才被它照到，墙上不会出现光斑
  scene.add(sun, sun.target, amb, hemi, scrLight, bounceA, bounceB); stage.sun = { light: sun, base: new THREE.Vector3(), angR: .0046 };
  const PRESET = {                                                           // 太阳的位置、颜色、强度；天色；曝光；台灯；屏幕亮度
    day:    { sun: [-3.0, 5.0, 3.2],  col: 0xfff2dd, I: 10,  hor: [5.5, 5.8, 6.2], top: [1.6, 2.4, 4.0],  exp: .50, lamp: 0,   scr: 3.4, glow: .12, bounce: .25, out: [1.5, 1.7, 1.9] },
    lowsun: { sun: [-4.0, 2.45, 3.6], col: 0xffc08a, I: 15,  hor: [6.0, 4.3, 2.7], top: [1.5, 2.1, 3.4],  exp: .42, lamp: 0,   scr: 3.0, glow: .10, bounce: .9,  out: [1.7, 1.25, .95] },
    night:  { sun: [-4.0, 4.0, 3.6],  col: 0x8fa8d8, I: .12, hor: [.05, .06, .10], top: [.015, .025, .06], exp: 1.0, lamp: 2.0, scr: .8,  glow: 0, bounce: 0, out: [.012, .014, .02] },
  };
  // 下面两套是后来加的。afternoon：太阳高，光条落在床上；dusk：黄昏，台灯开着。
  // 实拍检查过：day 和 afternoon 在书桌这一侧偏灰偏暗，小机器人几乎没有光，桌面镜头还是用 lowsun；这两套留给床角和窗外的「一天」。
  PRESET.afternoon = { sun: [-4.0, 5.0, -1.0], col: 0xffe6c8, I: 11, hor: [5.2, 5.4, 5.8], top: [1.5, 2.2, 3.7], exp: .5, lamp: 0, scr: 3.2, glow: .1, bounce: .35, out: [1.5, 1.6, 1.75] };
  PRESET.dusk = { sun: [-4.2, 1.2, 3.0], col: 0xff8a52, I: 6, hor: [3.2, 1.6, .9], top: [.55, .6, 1.05], exp: .56, lamp: 1.2, scr: 2.2, glow: .06, bounce: .5, out: [.9, .6, .45] };
  // 光可以随时间变（导演表 LIGHT，film.js 每帧调 setLight）。lightNow(p) 只改灯和天色，每帧都能调；p 里的数都能插值，见 mixLight
  const lightNow = (p) => { const L = stage.level, clay = stage.clay;
    stage.sun.base.set(...p.sun); sun.position.set(...p.sun); sun.color.set(p.col); sun.intensity = p.I; sun.shadow.radius = L >= 4 || clay ? 2 : 1;
    paintSky(p.hor, p.top); stage.exposure = p.exp; M.slat.emissive.set(p.col); M.slat.emissiveIntensity = L >= 3 && !clay ? p.glow : 0; screenMat.emissiveIntensity = L === 0 ? 1 : p.scr;
    lampRig.set(p.lamp, { down: 1, up: .32, glow: .22 }, stage); M.shade.emissive.set(0xffb777); M.shade.emissiveIntensity = p.lamp > .02 && L >= 1 && !clay ? .9 * Math.min(1, p.lamp / 1.2) : 0; scrLight.intensity = .25 * Math.max(0, 1 - p.I / 3); bulb.material.color.setScalar(1.2 + Math.min(1, p.lamp / 2) * 12.8); bulb.visible = !clay;
    outs.forEach((m, i) => m.material.color.setRGB(...p.out.map(v => v * (.55 + .5 * ((i * 37) % 10) / 10))));
    if (!clay && L >= 3) { bounceA.intensity = p.bounce * 2.2; bounceB.intensity = p.bounce * 1.2; } };
  stage.onLook = () => { const p = PRESET[stage.light] || PRESET.lowsun, L = stage.level, clay = stage.clay;
    amb.intensity = 0; hemi.intensity = 0; stage.scene.environment = null; bounceA.intensity = bounceB.intensity = 0; stage.scene.environmentIntensity = 1; envKey = null;
    lightNow(p);
    if (clay) hemi.intensity = Math.max(p.I * .14, .8);                       // 灰模：主光被百叶切成了条，补一点均匀的环境光才看得清形体
    else if (L >= 3) { stage.captureEnv(new THREE.Vector3(1.6, 1.3, 1.5)); stage.scene.environmentIntensity = 1.15; }   // 第 3 级：环境光和反射。两盏小灯（bounceA / B）是假的一次反弹
    else amb.intensity = Math.max(p.I * .004, .01); };                        // 第 1、2 级：背光面几乎全黑
  // 两组光按 u 混合（颜色按 RGB 混，位置按直线混）
  const mixLight = (a, b, u) => { const o = {}; for (const k in a) { const x = a[k], y = b[k] ?? x;
      o[k] = Array.isArray(x) ? x.map((v, i) => v + (y[i] - v) * u) : k === 'col' ? new THREE.Color(x).lerp(new THREE.Color(y), u).getHex() : x + (y - x) * u; } return o; };
  // 每帧调：p 是这一刻混好的光。环境贴图（反射和环境光）只在 key 变了的时候重拍，按 pKey 那一刻的光拍。
  // key 只由 t 推出来（film.js 的 light）：最近一个硬切，或者硬切之后最近一次换光、转百叶走完的时刻；光正在变的时候每帧都拍。
  // 这样分段渲染时每段拍出来都一样，光的跳变藏在切里。所以猛地换光要放在硬切上。
  let envKey = null;
  // 显示器在环境贴图里只当一块固定亮度的暗屏：屏幕内容每秒都在变，拍进去就会让整间屋子跟着忽明忽暗（harness3.captureEnv 调 envHooks）
  let keep = null; (stage.envHooks ??= []).push({ pre: () => { keep = [screenMat.emissiveMap, screenMat.emissive.clone()]; screenMat.emissiveMap = null; screenMat.emissive.setRGB(.05, .055, .065); screenMat.needsUpdate = true; },
    post: () => { [screenMat.emissiveMap] = keep; screenMat.emissive.copy(keep[1]); screenMat.needsUpdate = true; } });
  // pre：拍之前先把百叶、床头灯这些摆到 pKey 那一刻（film.js 传进来）
  const setLight = (p, key, pKey, pre) => { if (!stage.clay && stage.level >= 3 && key !== envKey) { envKey = key; pre?.(); lightNow(pKey || p); stage.captureEnv(new THREE.Vector3(1.6, 1.3, 1.5)); stage.scene.environmentIntensity = 1.15; } lightNow(p); };

  // ---------- 运镜：关键帧里是 时间、机位、看向、焦距、光圈值、对焦点 ----------
  const SCR = [DK.x, MN.cy, MN.z], MUG = [DIM.mug.x, TOP + .05, DIM.mug.z], BL = [.04, 1.5, 1.25];
  const KEYS = [
    { t: 0.0,  p: [2.95, 1.45, 2.85], l: [1.35, .98, .25],  mm: 24, f: 4,   focus: SCR },    // 起幅：全景
    { t: 3.2,  p: [2.25, 1.28, 1.95], l: [1.42, 1.0, .25],  mm: 32, f: 2.8, focus: SCR },    // 推近
    { t: 6.0,  p: [1.58, 1.12, 1.12], l: [1.45, 1.08, .22], mm: 45, f: 4,   focus: SCR },    // 显示器
    { t: 7.6,  p: [1.565, 1.12, 1.09], l: [1.45, 1.08, .22], mm: 45, f: 4,   focus: SCR },   // 停 1.6 秒，让人读屏幕
    { t: 10.0, p: [2.18, .97, 1.02],  l: [1.93, .80, .52],  mm: 60, f: 4,   focus: MUG },    // 桌面细节
    { t: 13.2, p: [2.85, 1.70, 1.65], l: [.20, 1.45, 1.25], mm: 28, f: 4,   focus: BL },     // 拉开看窗
    { t: 14.5, p: [2.90, 1.71, 1.70], l: [.20, 1.45, 1.25], mm: 28, f: 4,   focus: BL },     // 落幅
  ];
  const V = a => new THREE.Vector3(...a), curve = k => new THREE.CatmullRomCurve3(KEYS.map(q => V(q[k])), false, 'centripetal');
  const cp = curve('p'), cl = curve('l'), cf = curve('focus'), ease = u => u * u * u * (u * (6 * u - 15) + 10), DUR = KEYS.at(-1).t;
  const poseAt = (t) => { t = Math.max(0, Math.min(DUR, t)); let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
    const a = KEYS[i], b = KEYS[i + 1], u = ease((t - a.t) / (b.t - a.t)), s = (i + u) / (KEYS.length - 1);
    return { p: cp.getPoint(s), l: cl.getPoint(s), focus: cf.getPoint(s), mm: a.mm + (b.mm - a.mm) * u, f: a.f + (b.f - a.f) * u }; };
  const stop = (k, extra) => ({ p: V(k.p), l: V(k.l), focus: V(k.focus), mm: k.mm, f: k.f, ...extra });
  const STOPS = { home: stop(KEYS[0]), monitor: stop(KEYS[2]), mug: stop(KEYS[4]), blinds: stop(KEYS[5]),
    books: { p: V([2.25, 1.74, 1.25]), l: V([2.1, 1.74, .1]), focus: V([2.1, 1.74, .1]), mm: 40, f: 2.8 },
    note: { p: V([1.25, 1.02, .98]), l: V([1.02, .76, .56]), focus: V([1.02, .76, .56]), mm: 50, f: 4 },
    // 下面四个只在自检时用：正面、左、右、俯视
    front: { p: V([1.45, 1.15, 2.9]), l: V([1.45, .95, .3]), focus: V(SCR), mm: 28, f: 5.6 }, left: { p: V([.35, 1.25, 1.75]), l: V([1.5, .9, .35]), focus: V(SCR), mm: 24, f: 5.6 },
    right: { p: V([3.1, 1.25, 1.3]), l: V([1.4, .9, .4]), focus: V(SCR), mm: 28, f: 5.6 }, top: { p: V([1.45, 2.3, 1.0]), l: V([1.45, .74, .44]), focus: V([1.45, .74, .44]), mm: 28, f: 5.6 },
    desktop: { p: V([1.75, 1.22, 1.15]), l: V([1.5, .78, .5]), focus: V([1.5, .78, .5]), mm: 35, f: 5.6 } };
  const tick = opts.drawScreen ? (t) => { opts.drawScreen(scr.getContext('2d'), scr.width, scr.height, t); scrTex.needsUpdate = true; } : drawScreen;   // 成片：屏幕由导演表来画
  return { room, KEYS, STOPS, DUR, poseAt, tick, PRESET, mixLight, setLight, setTilt: (a, w) => setTilt(a, w), M, T, add, B, rb, lathe, cyl, tube, group, screen: { canvas: scr, tex: scrTex, mat: screenMat }, TOP, MATTOP, artMesh, DIM, phone: phoneG, note: noteG };
}
