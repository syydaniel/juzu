// 小机器人的三维身体：用 three.js 搭出来，applyState 把某一瞬间的状态摆上去。可选：翻页笔（clicker）、皮夹克（costume: 'jacket'）。
// 外壳颜色在下面的 shell 材质里（#EFE9DF），关节和脚是 PAL.dark，天线灯是 PAL.red。只换颜色的话，导演表里写 KAKA_LOOK 就行，不用重新打包。
// 坐标：脚底中点为原点，y 向上，小机器人面朝 +z（镜头）。"L" = 画面左边那一侧（也就是小机器人自己的右手）。
// 尺寸沿用 2D 版（1 个单位 = 2D 里的 100 像素）：头 1.72 × 1.26，身子 1.08 × 0.96，腿 0.5，天线 0.38。
import * as THREE from 'three';
import {softBlock, roundRectShape, makeOutlineMaterial, glowTexture, blobTexture, starTexture, poolTexture, microSurface} from './geom';
import {drawFace, makeFaceCanvas, Face, FACE0, AudioFrame, SILENT, FaceCanvas, SCREEN_W, SCREEN_H} from './face';
import {PAL} from './palette';
import {clamp, lerp, rad, pop} from './math';

export const DIM = {
  LEG: 0.5,
  HIP_X: 0.22,
  BW: 1.08, BH: 0.96, BD: 0.76,
  HW: 1.72, HH: 1.26, HD: 1.0,
  NECK: 0.12,
  UA: 0.5, FA: 0.46, // 上臂、前臂：再短就够不到脸、比不了心
  ANT: 0.38,
};

export type Arm = [number, number, number, number]; // 上臂外展、肘弯、上臂前伸、前臂前伸（度）

export type CharState = {
  t: number;
  x: number; z: number; hop: number; yaw: number;
  legK: [number, number];
  footLift: [number, number];
  body: [number, number, number]; // 侧倾 lean、前俯 bow、转身 twist（度）
  head: [number, number, number]; // 相对身体：侧倾、点头、转头
  armL: Arm; armR: Arm;
  thumb: [number, number];
  antenna: [number, number]; // 相对头：侧摆、前后摆（度）
  ears: [number, number];
  face: Face;
  audio: AudioFrame;
  rec: number;
  meter: [number, number, number];
  earGlow: number;
  listen: number;
  stars: number;
  shadow: number;
  click: number; // 翻页笔的指示灯闪一下 0..1
};

export const REST_ARM: Arm = [12, 8, 8, 10];
export const STATE0: CharState = {
  t: 0, x: 0, z: 0, hop: 0, yaw: 0,
  legK: [1, 1], footLift: [0, 0],
  body: [0, 0, 0], head: [0, 0, 0],
  armL: REST_ARM, armR: REST_ARM, thumb: [0, 0],
  antenna: [0, 0], ears: [0, 0],
  face: FACE0, audio: SILENT,
  rec: 0, meter: [0, 0, 0], earGlow: 0, listen: 0, stars: 0, shadow: 1, click: 0,
};

const TUBE_SEG = 26, TUBE_RAD = 12;

type ArmParts = {tube: THREE.Mesh; geo: THREE.BufferGeometry; hand: THREE.Mesh; thumb: THREE.Group};

export type Rig = {
  root: THREE.Group;
  ground: THREE.Group;
  hip: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  antenna: THREE.Group;
  earL: THREE.Group; earR: THREE.Group;
  arms: [ArmParts, ArmParts];
  legs: THREE.Mesh[];
  feet: THREE.Mesh[];
  lights: THREE.MeshPhysicalMaterial[];
  lightGlows: THREE.Sprite[];
  bulbMat: THREE.MeshPhysicalMaterial;
  bulbGlow: THREE.Sprite;
  earRingMats: THREE.MeshPhysicalMaterial[];
  earGlows: THREE.Sprite[];
  arcs: THREE.Mesh[];
  stars: THREE.Sprite[];
  blob: THREE.Mesh;
  faceCanvas: FaceCanvas;
  faceTex: THREE.CanvasTexture;
  outlines: THREE.Object3D[];
  setOutline: (on: boolean) => void;
  clickLed: THREE.MeshPhysicalMaterial | null;
  clickGlow: THREE.Sprite | null;
};

export type RigOptions = {outline?: boolean; outlineWidth?: number; faceRes?: number; shadows?: boolean; costume?: 'none' | 'jacket'; clicker?: boolean};

export const makeRig = (opt: RigOptions = {}): Rig => {
  const {outlineWidth = 0.03, faceRes = 8, shadows = true, costume = 'none', clicker = false} = opt;
  const jacket = costume === 'jacket';
  const outlines: THREE.Object3D[] = [];
  const inkMat = makeOutlineMaterial(PAL.ink, outlineWidth);
  const inkThin = makeOutlineMaterial(PAL.ink, outlineWidth * 0.75);
  const addInk = (m: THREE.Mesh, thin = false) => {
    const o = new THREE.Mesh(m.geometry, thin ? inkThin : inkMat);
    o.castShadow = false;
    o.receiveShadow = false;
    m.add(o);
    outlines.push(o);
    return o;
  };
  const cast = (m: THREE.Mesh) => {
    m.castShadow = shadows;
    m.receiveShadow = shadows;
    return m;
  };

  // 外壳像喷涂过的陶瓷感塑料：底层磨砂（粗糙度有深浅），上面一层清漆，带一点细橘皮
  const ms = microSurface();
  const shell = new THREE.MeshPhysicalMaterial({
    color: '#EFE9DF', roughness: 0.5, roughnessMap: ms.rough, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.07,
    bumpMap: ms.bump, bumpScale: 0.6, ior: 1.48, specularIntensity: 0.85, envMapIntensity: 1.25,
    sheen: 0.4, sheenColor: new THREE.Color('#FFF3E6'), sheenRoughness: 0.5,
  });
  const darkMat = new THREE.MeshPhysicalMaterial({color: PAL.dark, roughness: 0.32, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.15});
  // 屏幕玻璃：粗糙度低、高光弱，只在角度正好时出现一小块反光，不会把整块屏幕洗灰
  const screenMat = new THREE.MeshPhysicalMaterial({color: '#0B1012', roughness: 0.1, metalness: 0, specularIntensity: 0.4, clearcoat: 0.45, clearcoatRoughness: 0.035, envMapIntensity: 0.3});
  const redMat = new THREE.MeshPhysicalMaterial({color: PAL.red, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.1});
  // 皮夹克：黑色皮革，粗糙一点，带一层薄清漆和一点丝绒光，侧光下能看出皮子的起伏
  const leather = new THREE.MeshPhysicalMaterial({color: '#141416', roughness: 0.42, metalness: 0.05, clearcoat: 0.55, clearcoatRoughness: 0.35, sheen: 0.6, sheenColor: new THREE.Color('#8C93A8'), sheenRoughness: 0.5});
  const zipMat = new THREE.MeshPhysicalMaterial({color: '#B9BCC2', roughness: 0.22, metalness: 0.9});

  const root = new THREE.Group();
  const ground = new THREE.Group();
  const hip = new THREE.Group();
  hip.rotation.order = 'YXZ';
  root.add(hip);

  // ---------- 身体
  const {BW, BH, BD, HW, HH, HD} = DIM;
  const bodyY = BH / 2 - 0.06;
  const body = cast(new THREE.Mesh(softBlock(BW, BH, BD, 0.32, 0.14), shell));
  body.position.y = bodyY;
  hip.add(body);
  addInk(body);
  // 胸口三颗灯（现在是一个小电平表）
  const lights: THREE.MeshPhysicalMaterial[] = [];
  const lightGlows: THREE.Sprite[] = [];
  const socketGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.03, 32);
  socketGeo.rotateX(Math.PI / 2);
  const domeGeo = new THREE.SphereGeometry(0.056, 24, 16);
  domeGeo.scale(1, 1, 0.5);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.18;
    const y = bodyY - BH * 0.05;
    const socket = new THREE.Mesh(socketGeo, darkMat);
    const fz = jacket ? 0.07 : 0;
    socket.position.set(x, y, BD / 2 - 0.005 + fz);
    hip.add(socket);
    const mat = new THREE.MeshPhysicalMaterial({color: '#2B3034', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, emissive: new THREE.Color(PAL.gold), emissiveIntensity: 0});
    const dome = new THREE.Mesh(domeGeo, mat);
    dome.position.set(x, y, BD / 2 + 0.012 + fz);
    hip.add(dome);
    lights.push(mat);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTexture(), color: PAL.gold, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false}));
    gl.scale.setScalar(0.42);
    gl.position.set(x, y, BD / 2 + 0.06 + fz);
    hip.add(gl);
    lightGlows.push(gl);
  }

  // ---------- 可选：皮夹克（敞怀，露出白色胸口和三颗灯；袖子 = 黑色手臂，手还是白的）
  if (jacket) {
    // 外套整个包住身子（底下不露白），正面敞开成一个 V：白色胸口 + 两片大翻领，袖子是黑的
    const JW = BW + 0.07, JD = BD + 0.07, JH = BH * 0.98;
    const jy = bodyY + 0.012;
    const coat = cast(new THREE.Mesh(softBlock(JW, JH, JD, 0.33, 0.15), leather));
    coat.position.y = jy;
    hip.add(coat);
    addInk(coat);
    const top = jy + JH / 2 - 0.05, bot = jy - JH / 2 + 0.07;
    const vShape = new THREE.Shape();
    const tw = 0.4, bw = 0.27, rr = 0.05;
    vShape.moveTo(-tw + rr, top);
    vShape.lineTo(tw - rr, top);
    vShape.quadraticCurveTo(tw, top, tw - 0.01, top - rr);
    vShape.lineTo(bw, bot + rr);
    vShape.quadraticCurveTo(bw - 0.005, bot, bw - rr, bot);
    vShape.lineTo(-bw + rr, bot);
    vShape.quadraticCurveTo(-bw + 0.005, bot, -bw, bot + rr);
    vShape.lineTo(-tw + 0.01, top - rr);
    vShape.quadraticCurveTo(-tw, top, -tw + rr, top);
    const shirt = cast(new THREE.Mesh(new THREE.ExtrudeGeometry(vShape, {depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 8}), shell));
    shirt.position.z = JD / 2 - 0.012;
    hip.add(shirt);
    // 翻领：沿 V 的两条边，上宽下尖，往外翻一点
    for (const side of [-1, 1]) {
      const s = new THREE.Shape();
      s.moveTo(side * (tw - 0.02), top + 0.02);
      s.lineTo(side * (tw + 0.17), top - 0.02);
      s.lineTo(side * (tw + 0.05), top - 0.2);
      s.lineTo(side * (bw + 0.04), bot + 0.2);
      s.lineTo(side * (bw - 0.01), bot + 0.16);
      s.lineTo(side * (tw - 0.06), top - 0.06);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, {depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 4});
      const lap = cast(new THREE.Mesh(g, leather));
      lap.position.z = JD / 2 + 0.002;
      hip.add(lap);
      addInk(lap, true);
      const zip = new THREE.Mesh(new THREE.BoxGeometry(0.016, (top - bot) * 0.5, 0.014), zipMat);
      zip.position.set(side * (bw + 0.035), bot + (top - bot) * 0.27, JD / 2 + 0.02);
      zip.rotation.z = side * -0.12;
      hip.add(zip);
    }
    const collar = cast(new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.06, 14, 40), leather));
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, BH - 0.06, -0.05);
    collar.scale.set(1.3, 1, 0.85);
    hip.add(collar);
    addInk(collar, true);
  }

  // ---------- 脖子和头
  const neck = new THREE.Group();
  neck.rotation.order = 'YXZ';
  neck.position.y = BH - 0.1;
  hip.add(neck);
  const neckMesh = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.34, 24), darkMat));
  neckMesh.position.y = 0.1;
  neck.add(neckMesh);
  const head = new THREE.Group();
  head.position.y = 0.16 + HH / 2;
  neck.add(head);
  const headBevel = 0.16;
  const headMesh = cast(new THREE.Mesh(softBlock(HW, HH, HD, 0.44, headBevel), shell));
  head.add(headMesh);
  addInk(headMesh);
  // 屏幕：白色面框 + 往里凹一点的深色亮面玻璃
  const capW = HW - 2 * headBevel, capH = HH - 2 * headBevel, capR = 0.44 - headBevel;
  const scrW = SCREEN_W / 100, scrH = SCREEN_H / 100;
  const rb = 0.02;
  const ring = cast(new THREE.Mesh(softBlock(capW, capH, 0.07, capR, rb, {w: scrW - 2 * rb, h: scrH - 2 * rb, r: 0.2}), shell));
  ring.position.z = HD / 2 + 0.005;
  head.add(ring);
  const screenGeo = new THREE.ExtrudeGeometry(roundRectShape(scrW + 0.04, scrH + 0.04, 0.24), {depth: 0.03, bevelEnabled: false, curveSegments: 20});
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.receiveShadow = false;
  screen.position.z = HD / 2 - 0.016; // 玻璃面在头壳正面前 0.014，比面框低 0.03（凹进去）
  head.add(screen);
  const faceCanvas = makeFaceCanvas(faceRes);
  const faceTex = new THREE.CanvasTexture(faceCanvas.canvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 8;
  const faceMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(scrW, scrH),
    new THREE.MeshBasicMaterial({map: faceTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false}),
  );
  faceMesh.position.z = HD / 2 + 0.017;
  faceMesh.renderOrder = 2;
  head.add(faceMesh);

  // ---------- 耳朵：白色耳壳 + 红色耳垫（保留），耳垫外面一圈导光条，听的时候亮青色
  const earRingMats: THREE.MeshPhysicalMaterial[] = [];
  const earGlows: THREE.Sprite[] = [];
  const makeEar = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * (HW / 2 - 0.03), -0.06, 0.02);
    const shellGeo = softBlock(0.4, 0.62, 0.26, 0.19, 0.09);
    shellGeo.rotateY(Math.PI / 2);
    const earShell = cast(new THREE.Mesh(shellGeo, shell));
    earShell.position.x = side * 0.1;
    g.add(earShell);
    addInk(earShell);
    const ringMat = new THREE.MeshPhysicalMaterial({color: PAL.shell, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, emissive: new THREE.Color(PAL.teal), emissiveIntensity: 0});
    const ringGeo = softBlock(0.21, 0.42, 0.03, 0.105, 0.012);
    ringGeo.rotateY(Math.PI / 2);
    const rm = new THREE.Mesh(ringGeo, ringMat);
    rm.position.x = side * (0.1 + 0.13);
    g.add(rm);
    earRingMats.push(ringMat);
    const padGeo = softBlock(0.13, 0.34, 0.05, 0.065, 0.02);
    padGeo.rotateY(Math.PI / 2);
    const pad = cast(new THREE.Mesh(padGeo, redMat));
    pad.position.x = side * (0.1 + 0.145);
    g.add(pad);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTexture(), color: PAL.teal, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false}));
    glow.scale.set(0.7, 0.95, 1);
    glow.position.x = side * 0.3;
    g.add(glow);
    earGlows.push(glow);
    head.add(g);
    return g;
  };
  const earL = makeEar(-1);
  const earR = makeEar(1);

  // ---------- 天线：深色杆 + 红灯（兼做录音指示灯 REC）
  const antenna = new THREE.Group();
  antenna.rotation.order = 'XZY';
  antenna.position.y = HH / 2 - 0.02;
  head.add(antenna);
  const base = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.07, 24), darkMat));
  base.position.y = 0.01;
  antenna.add(base);
  const stalkGeo = new THREE.CylinderGeometry(0.024, 0.028, DIM.ANT, 12);
  stalkGeo.translate(0, DIM.ANT / 2, 0);
  const stalk = cast(new THREE.Mesh(stalkGeo, darkMat));
  antenna.add(stalk);
  const bulbMat = new THREE.MeshPhysicalMaterial({color: PAL.red, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06, emissive: new THREE.Color('#FF4A30'), emissiveIntensity: 0});
  const bulb = cast(new THREE.Mesh(new THREE.SphereGeometry(0.105, 32, 24), bulbMat));
  bulb.position.y = DIM.ANT + 0.085;
  antenna.add(bulb);
  addInk(bulb, true);
  const bulbGlow = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTexture(), color: '#FF5A3C', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false}));
  bulbGlow.scale.setScalar(0.9);
  bulbGlow.position.y = DIM.ANT + 0.085;
  antenna.add(bulbGlow);

  // ---------- 手臂：两段弯的软管（每帧重建顶点），球形手，竖大拇指时冒出一个小拇指头
  const makeArm = (): ArmParts => {
    const n = (TUBE_SEG + 1) * (TUBE_RAD + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const idx: number[] = [];
    for (let i = 0; i < TUBE_SEG; i++)
      for (let j = 0; j < TUBE_RAD; j++) {
        const a = i * (TUBE_RAD + 1) + j, b = a + TUBE_RAD + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    geo.setIndex(idx);
    const tube = cast(new THREE.Mesh(geo, jacket ? leather : shell));
    tube.frustumCulled = false;
    hip.add(tube);
    const o = addInk(tube, true);
    o.frustumCulled = false;
    const hand = cast(new THREE.Mesh(new THREE.SphereGeometry(0.125, 32, 24), shell));
    hip.add(hand);
    addInk(hand, true);
    const thumb = new THREE.Group();
    const tm = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.1, 6, 16), shell));
    tm.position.y = 0.075;
    thumb.add(tm);
    addInk(tm, true);
    hand.add(thumb);
    return {tube, geo, hand, thumb};
  };
  const arms: [ArmParts, ArmParts] = [makeArm(), makeArm()];
  // ---------- 可选：画面右边那只手里攥着一支翻页笔（发布会的标配），按一下指示灯亮
  let clickLed: THREE.MeshPhysicalMaterial | null = null;
  let clickGlow: THREE.Sprite | null = null;
  if (clicker) {
    const g = new THREE.Group();
    const bodyM = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.2, 6, 16), darkMat));
    bodyM.rotation.z = Math.PI / 2;
    g.add(bodyM);
    addInk(bodyM, true);
    clickLed = new THREE.MeshPhysicalMaterial({color: '#3A2A1A', roughness: 0.2, clearcoat: 1, emissive: new THREE.Color(PAL.gold), emissiveIntensity: 0.2});
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), clickLed);
    led.position.set(0.13, 0.02, 0.03);
    g.add(led);
    clickGlow = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTexture(), color: PAL.gold, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false}));
    clickGlow.scale.setScalar(0.28);
    clickGlow.position.copy(led.position);
    g.add(clickGlow);
    g.position.set(0.06, -0.02, 0.1);
    g.rotation.set(0, -0.5, 0.35);
    arms[1].hand.add(g);
  }

  // ---------- 腿（减震器）和脚
  const legs: THREE.Mesh[] = [];
  const feet: THREE.Mesh[] = [];
  const legGeo = new THREE.CylinderGeometry(0.062, 0.062, 1, 20);
  legGeo.translate(0, -0.5, 0);
  const footGeo = softBlock(0.3, 0.19, 0.44, 0.13, 0.085);
  footGeo.translate(0, 0.095, 0);
  for (const side of [-1, 1]) {
    const leg = cast(new THREE.Mesh(legGeo, shell));
    root.add(leg);
    addInk(leg, true);
    legs.push(leg);
    const foot = cast(new THREE.Mesh(footGeo, darkMat));
    root.add(foot);
    addInk(foot, true);
    feet.push(foot);
    void side;
  }

  // ---------- 听：耳边往里收的声波弧（画面右侧那只耳朵）
  const arcs: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.93, 1, 48, 1, -Math.PI * 0.32, Math.PI * 0.64),
      new THREE.MeshBasicMaterial({color: PAL.teal, transparent: true, opacity: 0, depthWrite: false, blending: PAL.light ? THREE.NormalBlending : THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide}),
    );
    head.add(m);
    arcs.push(m);
  }
  // ---------- 晕：头顶转圈的小星星
  const stars: THREE.Sprite[] = [];
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map: starTexture(), color: i === 1 ? PAL.red : PAL.gold, transparent: true, opacity: 0, depthWrite: false, toneMapped: false}));
    s.scale.setScalar(0.2);
    head.add(s);
    stars.push(s);
  }

  // ---------- 地面：一片柔光 + 接触阴影
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({map: poolTexture(), color: '#FFE2B8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false}));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.001;
  if (!PAL.light) ground.add(pool);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.1), new THREE.MeshBasicMaterial({map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.9}));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.004;
  ground.add(blob);
  if (shadows) {
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({opacity: 0.42}));
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.y = 0.006;
    catcher.receiveShadow = true;
    ground.add(catcher);
  }

  const setOutline = (on: boolean) => outlines.forEach((o) => (o.visible = on));
  setOutline(opt.outline ?? true);

  return {root, ground, hip, neck, head, antenna, earL, earR, arms, legs, feet, lights, lightGlows, bulbMat, bulbGlow, earRingMats, earGlows, arcs, stars, blob, faceCanvas, faceTex, outlines, setOutline, clickLed, clickGlow};
};

// ---------- 摆姿势
const v3 = new THREE.Vector3();
const dirOf = (a: number, f: number, side: number, out: THREE.Vector3) => {
  // 先在正面平面里按外展角转（0 = 垂下，90 = 平伸，180 = 举过头），再朝镜头方向"掰"过去 f 度
  const ar = rad(a), fr = rad(f);
  out.set(side * Math.sin(ar) * Math.cos(fr), -Math.cos(ar) * Math.cos(fr), Math.sin(fr));
  return out.normalize();
};

const P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), P2 = new THREE.Vector3();
const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), Q = new THREE.Vector3(), tmp = new THREE.Vector3();

const updateTube = (geo: THREE.BufferGeometry, s: THREE.Vector3, e: THREE.Vector3, h: THREE.Vector3, r0: number, r1: number) => {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
  // 弯曲平面的法线：三点不共线时用叉积，否则退回到 z
  N.subVectors(e, s).cross(tmp.subVectors(h, e));
  if (N.lengthSq() < 1e-8) N.set(0, 0, 1);
  N.normalize();
  for (let i = 0; i <= TUBE_SEG; i++) {
    const u = i / TUBE_SEG;
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    Q.set(a * s.x + b * e.x + c * h.x, a * s.y + b * e.y + c * h.y, a * s.z + b * e.z + c * h.z);
    T.set(2 * (1 - u) * (e.x - s.x) + 2 * u * (h.x - e.x), 2 * (1 - u) * (e.y - s.y) + 2 * u * (h.y - e.y), 2 * (1 - u) * (e.z - s.z) + 2 * u * (h.z - e.z)).normalize();
    B.crossVectors(T, N).normalize();
    const nn = tmp.crossVectors(B, T).normalize();
    const r = lerp(r0, r1, u);
    for (let j = 0; j <= TUBE_RAD; j++) {
      const phi = (j / TUBE_RAD) * Math.PI * 2;
      const cx = Math.cos(phi), sx = Math.sin(phi);
      const nx = cx * nn.x + sx * B.x, ny = cx * nn.y + sx * B.y, nz = cx * nn.z + sx * B.z;
      const k = i * (TUBE_RAD + 1) + j;
      pos.setXYZ(k, Q.x + nx * r, Q.y + ny * r, Q.z + nz * r);
      nor.setXYZ(k, nx, ny, nz);
    }
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  geo.computeBoundingSphere();
};

export const applyState = (rig: Rig, S: CharState) => {
  const {BW, BH, HH, HW} = DIM;
  rig.root.position.set(S.x, S.hop, S.z);
  rig.root.rotation.y = rad(S.yaw);
  rig.ground.position.set(S.x, 0, S.z);
  const legL = DIM.LEG * S.legK[0], legR = DIM.LEG * S.legK[1];
  const hipY = (legL + legR) / 2;
  rig.hip.position.set(0, hipY, 0);
  rig.hip.rotation.set(rad(S.body[1]), rad(S.body[2]), -rad(S.body[0]));
  rig.neck.rotation.set(rad(S.head[1]), rad(S.head[2]), -rad(S.head[0]));
  // 腿：顶端插在身体里，底端接脚
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const lift = S.footLift[i];
    const top = hipY + 0.06;
    const bottom = lift + 0.12;
    rig.legs[i].position.set(side * DIM.HIP_X, top, 0);
    rig.legs[i].scale.set(1, Math.max(0.02, top - bottom), 1);
    rig.feet[i].position.set(side * DIM.HIP_X, lift, 0.05);
  }
  // 手臂（在身体的坐标里算）
  const shY = BH - 0.06 - 0.3;
  const armsP: Arm[] = [S.armL, S.armR];
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const [a0, a1, f0, f1] = armsP[i];
    P0.set(side * (BW / 2 - 0.07), shY, 0);
    P1.copy(P0).addScaledVector(dirOf(a0, f0, side, v3), DIM.UA);
    P2.copy(P1).addScaledVector(dirOf(a0 + a1, f1, side, v3), DIM.FA);
    updateTube(rig.arms[i].geo, P0, P1, P2, 0.062, 0.053);
    rig.arms[i].hand.position.copy(P2);
    // 大拇指：从手的上方冒出来，冲过头再回来
    const th = clamp(S.thumb[i], 0, 1.3);
    rig.arms[i].thumb.visible = th > 0.01;
    rig.arms[i].thumb.scale.set(1, Math.max(0.01, th), 1);
    rig.arms[i].thumb.position.set(side * -0.02, 0.07, 0.04);
    rig.arms[i].thumb.rotation.set(0.25, 0, side * 0.15);
  }
  // 天线（相对头）和耳朵
  rig.antenna.rotation.set(rad(S.antenna[1]), 0, -rad(S.antenna[0]));
  rig.earL.rotation.set(0, 0, -rad(S.ears[0]));
  rig.earR.rotation.set(0, 0, -rad(S.ears[1]));
  // 灯：天线 REC、胸口电平表、耳朵导光条
  rig.bulbMat.emissiveIntensity = 0.15 + 2.6 * S.rec;
  (rig.bulbGlow.material as THREE.SpriteMaterial).opacity = 0.85 * S.rec;
  rig.bulbGlow.scale.setScalar(0.55 + 0.5 * S.rec);
  for (let i = 0; i < 3; i++) {
    const v = clamp(S.meter[i]);
    rig.lights[i].emissiveIntensity = 2.4 * v;
    rig.lights[i].color.set(v > 0.05 ? '#5A4524' : '#2B3034');
    (rig.lightGlows[i].material as THREE.SpriteMaterial).opacity = 0.75 * v;
  }
  for (let i = 0; i < 2; i++) {
    rig.earRingMats[i].emissiveIntensity = 2.2 * S.earGlow;
    (rig.earGlows[i].material as THREE.SpriteMaterial).opacity = 0.55 * S.earGlow;
  }
  // 声波弧：从外面往画面右侧的耳朵里收
  rig.arcs.forEach((m, i) => {
    const ph = (S.t * 1.25 + i / 3) % 1;
    const r = lerp(0.62, 0.2, ph);
    m.scale.set(r, r, 1);
    m.position.set(HW / 2 + 0.34 + r * 0.55, -0.06, 0.12);
    m.rotation.set(0, 0, Math.PI);
    (m.material as THREE.MeshBasicMaterial).opacity = S.listen * Math.sin(ph * Math.PI) * 0.95;
    m.visible = S.listen > 0.01;
  });
  // 晕：小星星绕着天线根转圈
  rig.stars.forEach((s, i) => {
    const a = S.t * 4.2 + (i * Math.PI * 2) / 3;
    const k = pop(clamp(S.stars) * 0.7, 3, 0.45);
    s.position.set(Math.cos(a) * 0.62 * k, HH / 2 + 0.2 + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.45 * k);
    s.scale.setScalar(0.19 * k * (0.85 + 0.15 * Math.sin(S.t * 11 + i)));
    (s.material as THREE.SpriteMaterial).opacity = clamp(S.stars);
    s.visible = S.stars > 0.01;
  });
  // 接触阴影：跳得越高越小越淡
  const air = clamp(S.hop / 1.2);
  rig.blob.scale.set(1 - air * 0.45, 1 - air * 0.45, 1);
  (rig.blob.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - air * 0.7) * S.shadow;
  if (rig.clickLed && rig.clickGlow) {
    rig.clickLed.emissiveIntensity = 0.2 + 3 * clamp(S.click);
    (rig.clickGlow.material as THREE.SpriteMaterial).opacity = 0.9 * clamp(S.click);
  }
  // 脸
  drawFace(rig.faceCanvas, S.face, S.t, S.audio);
  rig.faceTex.needsUpdate = true;
};

export {FACE0};
