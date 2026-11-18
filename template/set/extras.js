// 书房里加的东西：软木板（含展开的大白纸）、便签、桌面痕迹、打印纸、主机、纸篓、小机器人的充电座，还有可选的摆设和照片。
// 这些让房间看着是「用着的」，不是「摆好的」。尺寸单位是米。
// opts（导演表里的 SET）：
//   note: ['先灰模', '再打光']        墙上便签的两行字
//   slip: '规格表 → 灰模 → 逐级 → 返工'   软木板上手写纸条的字
//   paper: 'spec.md · 规格表'        桌上那叠打印纸最上面一张的标题
//   prints: [地址 × 6]               软木板上六张照片；不写或文件不在，就用 gen.js 画的风景占位
//   decor: { painting: 地址, sticker: 地址 }   画框里换自己的画、手机背面贴一张贴纸。文件不在就跳过，保持默认
import * as THREE from 'three';
import { rng, speckle, wood, canvasTex } from './tex.js';
import { genImage } from './gen.js';

export function buildExtras(stage, set, opts = {}) {
  const { add, B, rb, lathe, cyl, group, M, TOP, room } = set, r = rng(64);

  // ---------- 软木板：0.78 × 0.52，框宽 0.018，钉在背墙右边，中心离地 1.18 ----------
  const CB = { x: 2.86, y: 1.18, w: .78, h: .52 };
  const cork = stage.mat({ color: 0x8a6a48, rough: .95, set: speckle(81, { tone: [.48, .37, .26], amount: .32, rough: .95, roughVar: .04, grain: 220 }), repeat: [4, 3], bumpScale: .9 });
  const frameM = stage.mat({ color: 0x6b4a2e, rough: .55, set: wood(82, { hue: .07, light: .34, sat: .35, size: 512 }) });
  const board = group(CB.x, CB.y, 0, 'board');
  B(CB.w, CB.h, .012, .002, cork, 0, 0, .006, board);
  for (const [w, h, x, y] of [[CB.w + .036, .018, 0, CB.h / 2 + .009], [CB.w + .036, .018, 0, -CB.h / 2 - .009], [.018, CB.h, -CB.w / 2 - .009, 0], [.018, CB.h, CB.w / 2 + .009, 0]]) B(w, h, .02, .003, frameM, x, y, .01, board);
  // 照片：每张一块很薄的纸板，四角各有一点卷翘看不出，所以只给一个小倾角；图钉是一个圆帽加一根针
  const prints = [];
  const pinCols = [0xc8372d, 0x2f6fb5, 0xe2b13c, 0x3d8b5a, 0xf2f0ea];
  const slots = opts.prints || [];
  const layout = [[-.24, .09, .20, .135, -.04], [.02, .12, .20, .135, .03], [.26, .08, .18, .12, -.02], [-.22, -.13, .18, .12, .05], [.05, -.11, .21, .14, -.03], [.28, -.14, .12, .12, .07]];
  layout.forEach(([x, y, w, h, rot], i) => {
    const g = group(x, y, .0135, null, board); g.rotation.z = rot; g.rotation.x = (r() - .5) * .04;
    const paper = stage.mat({ color: 0xf3efe6, rough: .8 });
    B(w + .012, h + .012, .0008, .0003, paper, 0, 0, 0, g);                                       // 白边
    const pm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .55 });
    const ph = add(new THREE.PlaneGeometry(w, h), pm, 0, 0, .00045, g, { cast: false });
    prints.push({ mesh: ph, mat: pm, src: slots[i] });
    const pin = group(i % 2 ? -w / 2 + .012 : 0, h / 2 - .008, .001, null, g);
    cyl(.0055, .004, stage.mat({ color: pinCols[i % 5], rough: .3 }), 0, 0, .002, pin, 20).rotation.x = Math.PI / 2;
  });
  // 一张手写的纸条
  { const g = group(-.05, -.005, .0135, null, board); g.rotation.z = .015;
    const t = canvasTex(1024, 256, (c, w, h) => { c.fillStyle = '#f6eebc'; c.fillRect(0, 0, w, h); c.fillStyle = '#2b2a30'; c.font = '600 64px "Kaiti SC", "STKaiti", serif'; c.fillText(opts.slip ?? '规格表 → 灰模 → 逐级 → 返工', 28, 150); });
    add(new THREE.PlaneGeometry(.30, .075), stage.mat({ color: 0xf6eebc, rough: .9, set: { map: t } }), 0, 0, 0, g, { cast: false }); }

  // ---------- 软木板上的大白纸：平时卷着看不见，要用时从上沿往下展开，钉两颗图钉。画什么由导演表的 BOARD 定 ----------
  const sheetC = document.createElement('canvas'); sheetC.width = 2048; sheetC.height = 1304;
  const sheetT = new THREE.CanvasTexture(sheetC); sheetT.colorSpace = THREE.SRGBColorSpace; sheetT.anisotropy = 8;
  const sheetG = group(0, CB.h / 2 - .035, .02, null, board); sheetG.visible = false;
  { const sm = new THREE.MeshStandardMaterial({ map: sheetT, emissiveMap: sheetT, emissive: 0xffffff, emissiveIntensity: .32, roughness: .8 });
    const sh = add(new THREE.PlaneGeometry(.70, .446), sm, 0, -.223, 0, sheetG, { cast: true }); sh.userData.fixed = true;
    for (const x of [-.32, .32]) { const pin = cyl(.006, .004, stage.mat({ color: 0xc8372d, rough: .3 }), x, -.012, .003, sheetG, 20); pin.rotation.x = Math.PI / 2; } }

  // ---------- 便签：贴在显示器左边的墙上，7.6 厘米见方（贴在外框上会挡住屏幕里的字） ----------
  { const g = group(1.07, 1.03, .0012, null); g.rotation.z = .06;
    const t = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#ffe36e'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,.05)'; c.fillRect(0, 0, w, 60);
      c.fillStyle = '#22242c'; const L = opts.note || ['先灰模', '再打光']; c.font = `600 ${L.some((x) => x.length > 3) ? 84 : 110}px "Kaiti SC", "STKaiti", serif`; c.fillText(L[0] || '', 50, 250); c.fillText(L[1] || '', 50, 400); });
    const n = add(new THREE.PlaneGeometry(.076, .076, 6, 6), stage.mat({ color: 0xffe36e, rough: .85, set: { map: t } }), 0, 0, 0, g, { cast: false });
    const P = n.geometry.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y < 0) P.setZ(i, Math.pow(-y / .038, 2) * .006); } n.geometry.computeVertexNormals(); }

  // ---------- 桌面上的痕迹：杯印、细划痕、灰。一整张透明的贴片铺在桌面上，第 2 级以上才出现 ----------
  { const DK = { x: 1.45, z: .42, w: 1.40, d: .70 };
    const t = canvasTex(2048, 1024, (c, w, h) => { const q = rng(9);
      const ring = (x, y, R, a) => { c.strokeStyle = `rgba(40,20,8,${a})`; for (let k = 0; k < 3; k++) { c.lineWidth = 5 + q() * 6; c.beginPath(); c.ellipse(x + q() * 3, y + q() * 3, R, R * (.97 + q() * .05), q(), q() * 2, q() * 2 + 4.6 + q() * 1.5); c.stroke(); } };
      const u = (m) => m / DK.w * w, v = (m) => m / DK.d * h;
      ring(u(1.98 - .75), v(.50 - .07), u(.041), .22); ring(u(1.86 - .75), v(.58 - .07), u(.041), .10); ring(u(2.07 - .75), v(.24 - .07), u(.05), .12);
      for (let i = 0; i < 260; i++) { const x = q() * w, y = q() * h, L = 20 + q() * 160, a = (q() - .5) * .6; c.strokeStyle = `rgba(255,240,220,${.03 + q() * .05})`; c.lineWidth = 1 + q();
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); c.stroke(); }
      for (let i = 0; i < 1800; i++) { c.fillStyle = `rgba(230,220,200,${.05 + q() * .1})`; c.fillRect(q() * w, q() * h, 1 + q() * 2, 1 + q() * 2); } });
    const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: .7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const d = add(new THREE.PlaneGeometry(DK.w, DK.d), m, DK.x, TOP + .0004, DK.z, room, { cast: false }); d.rotation.x = -Math.PI / 2; d.userData.minLevel = 2; }

  // ---------- 一叠打印纸：A4，三张错开，台灯和键盘之间 ----------
  { const g = group(1.12, TOP, .34); g.rotation.y = -.22; const paper = stage.mat({ color: 0xf2efe8, rough: .85 });
    for (let i = 0; i < 3; i++) { const s = B(.210, .0006, .297, .0002, paper, (r() - .5) * .02, .0003 + i * .0007, (r() - .5) * .02, g); s.rotation.y = (r() - .5) * .08; }
    const top = canvasTex(840, 1188, (c, w, h) => { c.fillStyle = '#f2efe8'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a2b30'; c.font = '600 44px "PingFang SC"'; c.fillText(opts.paper ?? 'spec.md · 规格表', 60, 110);
      c.font = '400 26px Menlo, "PingFang SC"'; const q = rng(4); for (let i = 0; i < 28; i++) { c.fillStyle = i % 7 === 0 ? '#2a2b30' : '#5a5b62'; c.fillRect(60, 170 + i * 34, 300 + q() * 400, 10); } });
    const tm = stage.mat({ color: 0xf2efe8, rough: .85, set: { map: top } }); const tp = add(new THREE.PlaneGeometry(.21, .297), tm, 0, .0026, 0, g, { cast: false }); tp.rotation.x = -Math.PI / 2; tp.rotation.z = .03; }

  // ---------- 桌下的主机：0.20 × 0.45 × 0.45，前面一条细灯 ----------
  { const g = group(1.06, 0, .33); g.rotation.y = .05; const case_ = stage.mat({ color: 0x1a1b1e, rough: .45, metal: .6, set: speckle(83, { tone: [.08, .08, .09], amount: .08, rough: .45, roughVar: .1 }) });
    B(.20, .45, .45, .006, case_, 0, .225 + .012, 0, g); for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(.012, .012, M.rubber, sx * .08, .006, sz * .19, g, 12);
    const led = add(new THREE.BoxGeometry(.004, .30, .002), new THREE.MeshBasicMaterial({ color: 0xbfd8ff }), .06, .26, .226, g, { cast: false, recv: false }); led.userData.fixed = true;
    for (let i = 0; i < 9; i++) B(.15, .004, .002, .001, M.black, 0, .40 - i * .012, .2255, g, { cast: false }); }

  // ---------- 纸篓：网格金属，直径 0.26，高 0.30；里面几团揉皱的纸 ----------
  { const g = group(2.38, 0, .62); const wire = stage.mat({ color: 0x22252a, rough: .4, metal: .8 });
    const cv = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 16) c.fillRect(x + 3, y + 3, 10, 10); });
    const wm = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: .4, metalness: .8, alphaMap: cv, transparent: false, alphaTest: .5, side: THREE.DoubleSide }); cv.repeat.set(6, 3); cv.wrapS = cv.wrapT = THREE.RepeatWrapping;
    add(new THREE.CylinderGeometry(.13, .11, .30, 48, 1, true), wm, 0, .15, 0, g); cyl(.11, .004, wire, 0, .002, 0, g, 48); add(new THREE.TorusGeometry(.13, .004, 8, 48), wire, 0, .30, 0, g).rotation.x = Math.PI / 2;
    const pm = stage.mat({ color: 0xece8de, rough: .9 });
    for (let i = 0; i < 4; i++) { const ge = new THREE.IcosahedronGeometry(.045 + r() * .02, 2), P = ge.attributes.position; for (let k = 0; k < P.count; k++) { const s = .7 + r() * .45; P.setXYZ(k, P.getX(k) * s, P.getY(k) * s, P.getZ(k) * s); } ge.computeVertexNormals();
      add(ge, pm, (r() - .5) * .1, .27 + r() * .05, (r() - .5) * .1, g); } }

  // ---------- 小机器人脚下的充电座：直径 0.09，厚 0.008 ----------
  { const K = opts.kaka; if (K) { lathe([[0, 0], [.044, 0], [.046, .003], [.045, .007], [.042, .008], [0, .008]], stage.mat({ color: 0x2a2c31, rough: .35 }), K.x, TOP, K.z);
    const ring = add(new THREE.TorusGeometry(.04, .0012, 8, 64), new THREE.MeshBasicMaterial({ color: 0x9fe8da }), K.x, TOP + .0082, K.z, room, { cast: false, recv: false }); ring.rotation.x = Math.PI / 2; ring.userData.fixed = true; } }

  // ---------- 可选的摆设：画框里换自己的画、手机背面贴一张贴纸。颜色要暗、要安静，别抢桌上字的视线 ----------
  const decor = [], D = opts.decor || {};
  if (D.painting && set.artMesh) { const a = set.artMesh, pm = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: .45 });   // 画面带一点清漆的光
    const pl = add(new THREE.PlaneGeometry(.30, .40), pm, a.position.x, a.position.y, .0078, room, { cast: false }); pl.visible = false;
    decor.push({ mat: pm, src: D.painting, ok: () => { pl.visible = true; a.visible = false; } }); }
  if (D.sticker && set.DIM) { const P = set.DIM.phone, ph = group(P.x, TOP + P.t + .0003, P.z); ph.rotation.y = -.31;            // 手机是扣着放的：摄像头在 (-.015, -.05)，贴纸贴在下半部
    const sm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .35, transparent: true, alphaTest: .4 }), st = add(new THREE.PlaneGeometry(.042, .042), sm, .008, 0, .03, ph, { cast: false });
    st.rotation.x = -Math.PI / 2; st.rotation.z = .25; st.visible = false; decor.push({ mat: sm, src: D.sticker, ok: () => { st.visible = true; } }); }

  // 图：开始渲之前加载一次。文件不在就跳过：摆设保持默认，照片换成程序画的风景
  const load = async () => { const L = new THREE.TextureLoader();
    const tex = async (src) => { if (!src) return null; if (src.startsWith('gen:')) return new THREE.CanvasTexture(genImage(src.slice(4)));
      try { return await L.loadAsync(src); } catch { console.warn('图没找到，跳过：', src); return null; } };
    const use = (t, mat) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; mat.map = t; mat.needsUpdate = true; };
    await Promise.all(decor.map(async (p) => { const t = await tex(p.src); if (t) { use(t, p.mat); p.ok(); } }));
    await Promise.all(prints.map(async (p, i) => { const t = (await tex(p.src)) || new THREE.CanvasTexture(genImage('print/' + i)); use(t, p.mat); })); };
  return { load, board: CB, prints, sheet: { canvas: sheetC, tex: sheetT, g: sheetG } };
}
