// 造型用的几何体和材质：圆角块（带圆滑倒角）、反向外壳描边、辉光贴图。
import * as THREE from 'three';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const roundRectShape = (w: number, h: number, r: number) => {
  r = Math.min(r, Math.min(w, h) / 2 - 1e-4);
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
};

const smooth = (g: THREE.BufferGeometry) => {
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g.clearGroups();
  const m = mergeVertices(g, 1e-5);
  m.computeVertexNormals();
  return m;
};

// 圆角块：正面看是圆角矩形（圆角 r），侧面的棱是半径 bevel 的圆角。尺寸是最外沿的尺寸，中心在原点，厚度沿 z。
export const softBlock = (w: number, h: number, d: number, r: number, bevel: number, hole?: {w: number; h: number; r: number}, segs = 7) => {
  const b = Math.min(bevel, d / 2 - 1e-3, r - 1e-3);
  const shape = roundRectShape(w - 2 * b, h - 2 * b, r - b);
  if (hole) {
    const hs = roundRectShape(hole.w + 2 * b, hole.h + 2 * b, hole.r + b);
    shape.holes.push(new THREE.Path(hs.getPoints(24).reverse()));
  }
  const depth = Math.max(1e-3, d - 2 * b);
  const g = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: segs, curveSegments: 20, steps: 1});
  g.translate(0, 0, -depth / 2);
  return smooth(g);
};

// 反向外壳描边：沿法线往外撑一圈，只画背面，颜色是墨色。thickness 是世界单位。
export const makeOutlineMaterial = (color: string, thickness: number) =>
  new THREE.ShaderMaterial({
    uniforms: {color: {value: new THREE.Color(color)}, thickness: {value: thickness}},
    vertexShader: /* glsl */ `
      uniform float thickness;
      void main() {
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        mv.xyz += n * thickness;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      void main() {
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  });

let glowTex: THREE.Texture | null = null;
export const glowTexture = () => {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(128, 128, 2, 128, 128, 128);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  r.addColorStop(0.45, 'rgba(255,255,255,0.14)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
};

let blobTex: THREE.Texture | null = null;
export const blobTexture = () => {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(0,0,0,0.85)');
  r.addColorStop(0.35, 'rgba(0,0,0,0.5)');
  r.addColorStop(0.7, 'rgba(0,0,0,0.14)');
  r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
};

let starTex: THREE.Texture | null = null;
export const starTexture = () => {
  if (starTex) return starTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.translate(64, 64);
  g.shadowColor = 'rgba(255,255,255,0.9)';
  g.shadowBlur = 14;
  g.fillStyle = '#fff';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? 17 : 40;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
  g.lineJoin = 'round';
  g.lineWidth = 10;
  g.strokeStyle = '#fff';
  g.stroke();
  g.fill();
  starTex = new THREE.CanvasTexture(c);
  starTex.colorSpace = THREE.SRGBColorSpace;
  return starTex;
};

// 地面上的一片柔光（摄影棚的光斑），中心偏亮的青黑
let poolTex: THREE.Texture | null = null;
export const poolTexture = () => {
  if (poolTex) return poolTex;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  // 中性的白光斑，颜色由材质的 color 决定
  r.addColorStop(0, 'rgba(255,255,255,0.30)');
  r.addColorStop(0.4, 'rgba(255,255,255,0.13)');
  r.addColorStop(0.75, 'rgba(255,255,255,0.035)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 512, 512);
  poolTex = new THREE.CanvasTexture(c);
  poolTex.colorSpace = THREE.SRGBColorSpace;
  return poolTex;
};

// 外壳的细微表面：喷涂塑料那种很细的橘皮起伏 + 粗糙度深浅不一。
// 用确定的伪随机（不随时间变），多进程渲染每帧一样。
let micro: {rough: THREE.CanvasTexture; bump: THREE.CanvasTexture} | null = null;
export const microSurface = () => {
  if (micro) return micro;
  const N = 512;
  const hash = (x: number, y: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const vnoise = (x: number, y: number, p: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const w = (a: number) => ((a % p) + p) % p;
    const a = hash(w(xi), w(yi)), b = hash(w(xi + 1), w(yi)), c = hash(w(xi), w(yi + 1)), d = hash(w(xi + 1), w(yi + 1));
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const make = (fn: (x: number, y: number) => number) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const g = cv.getContext('2d')!;
    const im = g.createImageData(N, N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const v = Math.max(0, Math.min(255, Math.round(fn(x, y) * 255)));
        const i = (y * N + x) * 4;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
        im.data[i + 3] = 255;
      }
    g.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    t.anisotropy = 8;
    return t;
  };
  // 粗糙度：大块的深浅（手摸过、喷涂不匀）+ 细颗粒，整体在 0.82–1.0 之间（乘在材质的 roughness 上）
  const rough = make((x, y) => 0.82 + 0.12 * vnoise(x / 64, y / 64, N / 64) + 0.06 * vnoise(x / 6, y / 6, N / 6));
  // 凹凸：很细的橘皮
  const bump = make((x, y) => 0.5 + 0.35 * (vnoise(x / 5, y / 5, N / 5) - 0.5) + 0.15 * (vnoise(x / 2.2, y / 2.2, Math.round(N / 2.2)) - 0.5));
  micro = {rough, bump};
  return micro;
};

// 反射用的环境：一间暗青色的摄影棚，只有三块灯箱（左前上暖色主灯箱、右后青色灯条、左后冷色灯条）和很淡的顶光。
// 不用 RoomEnvironment：那间屋子四面都亮，屏幕一抬头就把整块玻璃洗灰。
export const studioEnvScene = () => {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(24, 14, 24), new THREE.MeshBasicMaterial({color: new THREE.Color('#0A1315'), side: THREE.BackSide}));
  room.position.y = 5;
  scene.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshBasicMaterial({color: new THREE.Color('#122326')}));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  scene.add(floor);
  const panel = (w: number, h: number, color: string, k: number, pos: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide}));
    m.position.set(...pos);
    m.lookAt(0, 1.6, 0);
    scene.add(m);
  };
  panel(6.5, 4.2, '#FFE2C4', 9, [-5.5, 8, 6.5]); // 主灯箱
  panel(1.3, 7, '#7FE6D8', 4, [7.5, 4, -6.5]); // 青色轮廓灯条
  panel(1.1, 6, '#A8D8F0', 2, [-7.5, 3.5, -6]); // 冷色灯条
  panel(9, 9, '#3A5A5E', 2.2, [0, 11.5, 0]); // 很淡的顶光
  panel(8, 1.2, '#FFFFFF', 0.9, [2, 1.2, 10]); // 机位后面一条很低的白条：给外壳一道底部高光
  panel(7, 2.2, '#FFF6EC', 6, [0.5, 9.5, 5.5]); // 前上方一大块柔光，头顶和肚子有一道渐变的亮面
  return scene;
};
