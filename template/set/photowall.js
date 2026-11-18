// 床头上方的照片墙：28 张 11 厘米的方形照片，7 列 4 行，用和纸胶带贴在前墙上，床头板上方。
// 每张都有一点自己的样子：歪一点、错开几毫米、有几张下沿翘起来离墙几毫米（影子落在墙上），有的带白边、有的满版。
// 照片的画面全是这里用代码画的（海、山、日落、叶子、夜里的楼、咖啡、雪原上的火车……），再加一层胶片的褪色、偏色、暗角和颗粒。
// 背面是黑卡纸。悬浮段（magic.js）把照片拼成一块板，板上的内容就画在这些背面上（back.canvas）。
// 导演表里第一段悬浮是 from: 'air' 的话，这面墙开始是空的：照片在那一段里从空中长出来，最后飞回这里贴好，之后一直留在墙上（可见性由 magic.js 按 t 管）。
// 不要照片墙：film.html?nophotos，或者 SET.photos = false（没有照片墙，悬浮段也就没有照片可用）。
import * as THREE from 'three';

export const PW = { cols: 7, rows: 4, s: .11, gap: .02, cx: .625, cy: 1.50, z: 3.2, t: .0007 };   // 一格 11 厘米，格缝 2 厘米；中心在床的正上方，离地 1.5 米
const hash = (i, s = 0) => { let h = Math.imul(i * 374761393 + s * 668265263 | 0, 1274126177); h ^= h >>> 15; return ((Math.imul(h, 2246822519) ^ (h >>> 13)) >>> 0) / 4294967296; };

// ---------- 照片的画面：每个函数在 (0,0)-(s,s) 里画一张 ----------
const lin = (g, s, stops, x0 = 0, y0 = 0, x1 = 0, y1 = s) => { const q = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => q.addColorStop(o, c)); return q; };
const ridge = (g, s, base, amp, f, ph, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, s); for (let x = 0; x <= s; x += s / 60) { const u = x / s; g.lineTo(x, base + amp * (Math.sin(u * f + ph) * .6 + Math.sin(u * f * 2.3 + ph * 1.7) * .3 + Math.sin(u * f * 5.1 + ph * .3) * .1)); } g.lineTo(s, s); g.closePath(); g.fill(); };
const GEN = {
  sea(g, s, R) { const hz = s * (.42 + R(1) * .16); g.fillStyle = lin(g, s, [[0, '#8fb3cc'], [1, '#dde6e6']], 0, 0, 0, hz); g.fillRect(0, 0, s, hz);
    g.fillStyle = lin(g, s, [[0, '#6b93a8'], [1, '#2c4f63']], 0, hz, 0, s); g.fillRect(0, hz, s, s - hz);
    for (let i = 0; i < 46; i++) { const y = hz + Math.pow(R(10 + i), 1.6) * (s - hz); g.fillStyle = `rgba(235,242,245,${.08 + .25 * R(60 + i)})`; g.fillRect(R(110 + i) * s - s * .2, y, s * (.05 + .25 * R(160 + i)) * (1 - (y - hz) / s), 1.2); } },
  hills(g, s, R) { g.fillStyle = lin(g, s, [[0, '#e3cfb3'], [1, '#f2e6d3']]); g.fillRect(0, 0, s, s);
    ['#a9b2a3', '#7d8c7b', '#4a5d4c'].forEach((c, k) => ridge(g, s, s * (.42 + k * .13), s * (.09 - k * .015), 4 + k * 2 + R(k) * 3, R(5 + k) * 6, c)); },
  sunset(g, s, R) { g.fillStyle = lin(g, s, [[0, '#7f5f7a'], [.45, '#ee9b6a'], [.78, '#f7d39d'], [1, '#f7d39d']]); g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,240,205,.9)'; g.beginPath(); g.arc(s * (.3 + R(1) * .4), s * .68, s * .08, 0, 7); g.fill();
    ridge(g, s, s * .76, s * .03, 3, R(2) * 6, '#2c2326'); g.fillStyle = '#2c2326';
    for (let i = 0; i < 4; i++) { const x = R(20 + i) * s, h = s * (.08 + .1 * R(30 + i)); g.beginPath(); g.moveTo(x, s * .74 - h); g.lineTo(x - h * .25, s * .78); g.lineTo(x + h * .25, s * .78); g.fill(); } },
  leaf(g, s, R) { g.fillStyle = lin(g, s, [[0, '#2b3a2a'], [1, '#1d2a1e']]); g.fillRect(0, 0, s, s);
    for (let i = 0; i < 8; i++) { const x = R(i) * s, y = R(20 + i) * s, a = R(40 + i) * 6.3, L = s * (.18 + .2 * R(60 + i)); g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = ['#6f8f52', '#8aa45e', '#a6b86e', '#5d7d45'][i % 4]; g.beginPath(); g.ellipse(0, 0, L, L * .38, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(230,240,200,.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-L * .9, 0); g.lineTo(L * .9, 0); g.stroke(); g.restore(); } },
  city(g, s, R) { g.fillStyle = lin(g, s, [[0, '#1b2741'], [1, '#3d3651']]); g.fillRect(0, 0, s, s);
    for (let x = 0; x < s;) { const w = s * (.07 + .1 * R(x * 7)), h = s * (.25 + .5 * R(x * 3 + 1)); g.fillStyle = '#12141c'; g.fillRect(x, s - h, w, h);
      for (let yy = s - h + 4; yy < s - 3; yy += 6) for (let xx = x + 3; xx < x + w - 3; xx += 5) if (R(xx * 13 + yy) > .62) { g.fillStyle = `rgba(245,${190 + 40 * R(xx + yy)},110,${.55 + .4 * R(yy)})`; g.fillRect(xx, yy, 2.2, 3); }
      x += w + 1; } },
  coffee(g, s, R) { g.fillStyle = '#8a5f3c'; g.fillRect(0, 0, s, s); for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(60,35,20,${.12 + .15 * R(i)})`; g.lineWidth = 1; g.beginPath(); g.moveTo(0, R(50 + i) * s); g.bezierCurveTo(s * .3, R(80 + i) * s, s * .6, R(90 + i) * s, s, R(70 + i) * s); g.stroke(); }
    const cx = s * (.45 + R(1) * .1), cy = s * (.5 + R(2) * .08); g.fillStyle = 'rgba(30,18,10,.35)'; g.beginPath(); g.arc(cx + s * .03, cy + s * .04, s * .33, 0, 7); g.fill();
    g.fillStyle = '#efe9df'; g.beginPath(); g.arc(cx, cy, s * .32, 0, 7); g.fill(); g.fillStyle = '#5a3a22'; g.beginPath(); g.arc(cx, cy, s * .24, 0, 7); g.fill();
    g.fillStyle = '#e2c49c'; const hs = s * .1; g.beginPath(); g.moveTo(cx, cy + hs * .9); g.bezierCurveTo(cx - hs * 1.6, cy - hs * .1, cx - hs * .7, cy - hs * 1.2, cx, cy - hs * .35); g.bezierCurveTo(cx + hs * .7, cy - hs * 1.2, cx + hs * 1.6, cy - hs * .1, cx, cy + hs * .9); g.fill();   // 拉花：一颗心
    g.strokeStyle = 'rgba(90,58,34,.8)'; g.lineWidth = s * .01; g.beginPath(); g.moveTo(cx, cy - hs * 1.3); g.lineTo(cx, cy + hs * 1.2); g.stroke(); },
  train(g, s, R) { g.fillStyle = lin(g, s, [[0, '#b9c3cd'], [1, '#dfe5ea']], 0, 0, 0, s * .55); g.fillRect(0, 0, s, s * .55); g.fillStyle = '#eef2f4'; g.fillRect(0, s * .55, s, s * .45);
    ridge(g, s, s * .52, s * .02, 9, 1, '#7d8a8f'); g.fillStyle = '#3a3f45'; g.fillRect(s * .1, s * .58, s * .78, s * .07); g.fillStyle = '#e8c77a'; for (let x = s * .14; x < s * .85; x += s * .055) g.fillRect(x, s * .595, s * .025, s * .02);
    g.fillStyle = 'rgba(255,255,255,.75)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(s * (.12 + k * .03), s * (.52 - k * .05), s * (.04 + k * .015), s * (.025 + k * .01), 0, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(80,90,100,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, s * .66); g.lineTo(s, s * .655); g.stroke(); },
  flowers(g, s, R) { g.fillStyle = '#e6dac8'; g.fillRect(0, 0, s, s); for (let i = 0; i < 10; i++) { const x = R(i) * s, y = R(20 + i) * s, r = s * (.06 + .06 * R(40 + i)); g.fillStyle = ['#e59aa0', '#d97b84', '#f0c75e', '#f2b8a0'][i % 4];
      for (let p = 0; p < 6; p++) { const a = p / 6 * 6.28 + R(i); g.beginPath(); g.ellipse(x + Math.cos(a) * r * .6, y + Math.sin(a) * r * .6, r * .5, r * .3, a, 0, 7); g.fill(); } g.fillStyle = '#c99a3a'; g.beginPath(); g.arc(x, y, r * .25, 0, 7); g.fill(); } },
  blocks(g, s, R) { g.fillStyle = '#c9b69b'; g.fillRect(0, 0, s, s); g.filter = `blur(${s * .015}px)`; g.fillStyle = ['#8e4a3c', '#5b6a7c', '#6f7d5b'][Math.floor(R(1) * 3)]; g.fillRect(s * .1, s * .1, s * .8, s * .45); g.fillStyle = '#d9a35b'; g.fillRect(s * .1, s * .62, s * .8, s * .26); g.filter = 'none'; },
  beach(g, s, R) { g.fillStyle = lin(g, s, [[0, '#a9cfe0'], [1, '#e2eef2']], 0, 0, 0, s * .4); g.fillRect(0, 0, s, s * .4); g.fillStyle = '#4f9bb0'; g.fillRect(0, s * .4, s, s * .22);
    g.fillStyle = '#e6d3ac'; g.beginPath(); g.moveTo(0, s * .62); for (let x = 0; x <= s; x += s / 20) g.lineTo(x, s * (.6 + .03 * Math.sin(x / s * 7 + R(1) * 6))); g.lineTo(s, s); g.lineTo(0, s); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= s; x += s / 20) g.lineTo(x, s * (.6 + .03 * Math.sin(x / s * 7 + R(1) * 6)) - 1); g.stroke(); },
  forest(g, s, R) { g.fillStyle = lin(g, s, [[0, '#5d7454'], [1, '#26331f']]); g.fillRect(0, 0, s, s); for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(30,24,18,${.5 + .4 * R(i)})`; g.fillRect(R(20 + i) * s, 0, s * (.015 + .03 * R(40 + i)), s); }
    g.fillStyle = 'rgba(255,240,200,.12)'; g.beginPath(); g.moveTo(s * .55, 0); g.lineTo(s * .75, 0); g.lineTo(s * .45, s); g.lineTo(s * .2, s); g.fill(); },
  street(g, s, R) { g.fillStyle = lin(g, s, [[0, '#3f4d68'], [.6, '#c98f74'], [1, '#2c2a30']]); g.fillRect(0, 0, s, s); g.fillStyle = '#25232a'; g.beginPath(); g.moveTo(0, s); g.lineTo(s * .45, s * .6); g.lineTo(s * .55, s * .6); g.lineTo(s, s); g.fill();
    for (let i = 0; i < 6; i++) { const u = i / 6, x = s * (.43 - u * .38), y = s * (.6 - u * .25), r = s * (.012 + u * .02); const q = g.createRadialGradient(x, y, 0, x, y, r * 4); q.addColorStop(0, 'rgba(255,220,150,.95)'); q.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = q; g.fillRect(x - r * 4, y - r * 4, r * 8, r * 8); } },
  moon(g, s, R) { g.fillStyle = lin(g, s, [[0, '#0d1424'], [1, '#1c2640']]); g.fillRect(0, 0, s, s); const x = s * (.35 + R(1) * .3), y = s * (.35 + R(2) * .2);
    const q = g.createRadialGradient(x, y, 0, x, y, s * .3); q.addColorStop(0, 'rgba(220,225,240,.25)'); q.addColorStop(1, 'rgba(220,225,240,0)'); g.fillStyle = q; g.fillRect(0, 0, s, s);
    g.fillStyle = '#e8e6dc'; g.beginPath(); g.arc(x, y, s * .1, 0, 7); g.fill(); g.fillStyle = 'rgba(160,160,150,.35)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + (R(10 + k) - .5) * s * .12, y + (R(20 + k) - .5) * s * .12, s * .012 * (1 + R(30 + k)), 0, 7); g.fill(); } },
  clouds(g, s, R) { g.fillStyle = lin(g, s, [[0, '#6f97bf'], [1, '#c9dceb']]); g.fillRect(0, 0, s, s);   // 一片积云
    for (let i = 0; i < 9; i++) { const x = s * (.15 + .7 * R(i)), y = s * (.45 + .25 * R(10 + i)), r = s * (.08 + .1 * R(20 + i)); g.fillStyle = `rgba(250,250,248,${.75 + .2 * R(30 + i)})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(150,160,175,.35)'; g.fillRect(0, s * .66, s, s * .04); },
};
// 28 张用哪种画：大部分各两张，雪原火车和积云各一张，放在不起眼的格子里
const PICK = ['sea', 'leaf', 'sunset', 'coffee', 'hills', 'city', 'flowers', 'forest', 'beach', 'moon', 'street', 'blocks', 'hills', 'leaf', 'coffee', 'sunset', 'train', 'sea', 'city', 'clouds', 'flowers',
  'blocks', 'street', 'beach', 'forest', 'moon', 'sea', 'hills'];

function photoAtlas(cols, rows, C) {
  const c = document.createElement('canvas'); c.width = cols * C; c.height = rows * C; const g = c.getContext('2d');
  for (let k = 0; k < cols * rows; k++) { const i = k % cols, j = Math.floor(k / cols), R = (s) => hash(k * 131 + s, 17), x0 = i * C, y0 = j * C;
    const border = R(900) < .62, m = border ? C * .06 : 0, s = C - 2 * m;
    g.fillStyle = '#f1eee6'; g.fillRect(x0, y0, C, C);
    g.save(); g.beginPath(); g.rect(x0 + m, y0 + m, s, s); g.clip(); g.translate(x0 + m, y0 + m);
    GEN[PICK[k] || 'sea'](g, s, R);
    // 胶片味：偏色、褪色（黑位抬起来）、暗角
    g.fillStyle = R(901) < .5 ? 'rgba(255,196,140,.10)' : 'rgba(150,185,215,.08)'; g.fillRect(0, 0, s, s);
    g.fillStyle = `rgba(236,226,210,${.06 + .1 * R(902)})`; g.fillRect(0, 0, s, s);
    const v = g.createRadialGradient(s / 2, s / 2, s * .28, s / 2, s / 2, s * .78); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.3)'); g.fillStyle = v; g.fillRect(0, 0, s, s);
    g.restore();
    if (border) { g.fillStyle = 'rgba(120,110,95,.05)'; g.fillRect(x0, y0 + C - 3, C, 3); } }   // 白边下沿一点手摸过的灰
  const id = g.getImageData(0, 0, c.width, c.height), d = id.data; let h = 12345;                                // 颗粒
  for (let p = 0; p < d.length; p += 4) { h = (Math.imul(h, 1103515245) + 12345) | 0; const n = ((h >>> 16) & 255) / 255 - .5; for (let q = 0; q < 3; q++) d[p + q] = Math.max(0, Math.min(255, d[p + q] + n * 14)); }
  g.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// 和纸胶带：四种颜色，两种带一点细条纹或小点
function tapeTex(col, kind) { const c = document.createElement('canvas'); c.width = 128; c.height = 40; const g = c.getContext('2d'); g.fillStyle = col; g.fillRect(0, 0, 128, 40);
  if (kind === 1) { g.fillStyle = 'rgba(255,255,255,.35)'; for (let x = 0; x < 128; x += 10) g.fillRect(x, 0, 4, 40); }
  if (kind === 2) { g.fillStyle = 'rgba(255,255,255,.45)'; for (let x = 6; x < 128; x += 14) for (let y = 8; y < 40; y += 14) { g.beginPath(); g.arc(x + (y % 28 ? 7 : 0), y, 2.4, 0, 7); g.fill(); } }
  g.globalCompositeOperation = 'destination-out'; for (let y = 0; y < 40; y += 2) { g.fillStyle = `rgba(0,0,0,${.15 + .3 * hash(y, 5)})`; g.fillRect(0, y, 2 + 3 * hash(y, 6), 2); g.fillRect(126 - 3 * hash(y, 7), y, 3, 2); }   // 手撕的两头
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

export function buildPhotoWall(stage, set, opts = {}) {
  const P = { ...PW, ...opts }, { cols, rows, s, gap } = P, scene = stage.scene, root = new THREE.Group(); root.name = 'photowall'; scene.add(root);
  const atlas = photoAtlas(cols, rows, 200);
  const photoMat = new THREE.MeshStandardMaterial({ map: atlas, roughness: .38, metalness: 0 });                 // 半光面相纸：壁灯开着的时候能看见一点高光
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xf0ece4, roughness: .8 });
  // 背面：黑卡纸。悬浮那一段 magic.js 往 back.canvas 上画板子的内容，背面自己发一点光
  const paper = document.createElement('canvas'); paper.width = 1600; paper.height = 900;                     // 黑卡纸：深灰底，一点纤维和不匀
  { const g = paper.getContext('2d'); g.fillStyle = '#1c1a18'; g.fillRect(0, 0, 1600, 900);
    for (let i = 0; i < 2600; i++) { const x = hash(i, 801) * 1600, y = hash(i, 802) * 900, a = hash(i, 803) * 6.3, L = 4 + 14 * hash(i, 804); g.strokeStyle = `rgba(${hash(i, 805) < .5 ? '255,245,230' : '0,0,0'},${.03 + .05 * hash(i, 806)})`; g.lineWidth = .8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); } }
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 900; canvas.getContext('2d').drawImage(paper, 0, 0);
  const backTex = new THREE.CanvasTexture(canvas); backTex.colorSpace = THREE.SRGBColorSpace; backTex.anisotropy = 8;
  const backMat = new THREE.MeshStandardMaterial({ map: backTex, color: 0xb0aaa2, roughness: .8, emissiveMap: backTex, emissive: 0xffffff, emissiveIntensity: 0 });
  const tapes = [['#c9d3b8', 0], ['#e3b9b4', 1], ['#e6cf8f', 2], ['#b9cbd8', 0]].map(([c, k]) => new THREE.MeshStandardMaterial({ map: tapeTex(c, k), roughness: .7, transparent: true, opacity: .8, depthWrite: false }));
  // 板子上一格占多大：和 magic.js 拼板的算法一致（格缝随板宽）
  const FX = (9 / 16 / rows - .0045) * cols, FY = 1 - .0045 * rows / (9 / 16);
  const qWall = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);          // 照片正面朝屋里（-z）
  const nW = new THREE.Vector3(0, 0, -1), W = cols * s + (cols - 1) * gap, H = rows * s + (rows - 1) * gap, cards = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i, R = (q) => hash(k, 300 + q), g = new THREE.Group(); g.name = 'photo' + k; root.add(g);
    // 每张一套自己的材质（贴图共用）：悬浮那一段照片是一张张「长出来」的，要能单独调透明度
    const mats = { body: edgeMat.clone(), front: photoMat.clone(), back: backMat.clone() }; for (const m of Object.values(mats)) m.transparent = true;
    const body = new THREE.Mesh(new THREE.BoxGeometry(s, s, P.t), mats.body); body.castShadow = body.receiveShadow = true;
    const fg = new THREE.PlaneGeometry(s, s), fu = fg.attributes.uv; for (let n = 0; n < fu.count; n++) fu.setXY(n, (i + fu.getX(n)) / cols, 1 - (j + 1 - fu.getY(n)) / rows);
    const front = new THREE.Mesh(fg, mats.front); front.position.z = P.t / 2 + .00005; front.receiveShadow = true;
    const bg = new THREE.PlaneGeometry(s, s), bu = bg.attributes.uv; for (let n = 0; n < bu.count; n++) bu.setXY(n, (i + .5 + (bu.getX(n) - .5) * FX) / cols, 1 - (j + .5 - (bu.getY(n) - .5) * FY) / rows);
    const backM = new THREE.Mesh(bg, mats.back); backM.rotation.y = Math.PI; backM.position.z = -P.t / 2 - .00005;
    g.add(body, front, backM);
    // 胶带：上沿一条，或者两个上角各一条斜着贴；一小截压在墙上
    const tp = R(1) < .4 ? [[0, s / 2 - .002, (R(2) - .5) * .2, .05]] : [[-s / 2 + .008, s / 2 - .006, .7 + R(3) * .25, .04], [s / 2 - .008, s / 2 - .006, -.7 - R(4) * .25, .04]];
    const tapeM = []; for (const [x, y, a, L] of tp) { const m = new THREE.Mesh(new THREE.PlaneGeometry(L, .014), tapes[Math.floor(R(5) * 4)]); m.position.set(x, y, P.t / 2 + .0003); m.rotation.z = a; m.userData.fixed = true; m.renderOrder = 2; g.add(m); tapeM.push(m); }
    // 在墙上的位置：格子中心加几毫米的错位；绕法线歪一点；三分之一的照片下沿翘起来（绕上沿转），离墙几毫米
    const jit = (R(6) - .5) * .045, curl = R(7) < .35 ? -(.012 + R(8) * .03) : -.002;
    const top = new THREE.Vector3(P.cx + W / 2 - s / 2 - i * (s + gap) + (R(9) - .5) * .006, P.cy + H / 2 - j * (s + gap) + (R(10) - .5) * .006, P.z - P.t / 2 - .0006);   // 正面朝 -z，看过去的右手边是 -x
    const qBase = qWall.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), jit));
    const c = { g, i, j, k, s, front, back: backM, body, top, qBase, curl, nW, mats, tapes: tapeM };
    c.pose = (a = 0, out = 0, o = { p: new THREE.Vector3(), q: new THREE.Quaternion() }) => { const ang = curl - a;                // 绕上沿转 ang（负的是下沿离墙），整张往外挪 out
      o.q.copy(qBase).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ang));
      o.p.copy(new THREE.Vector3(0, -s / 2 * Math.cos(ang), -s / 2 * Math.sin(ang)).applyQuaternion(qBase)).add(top).addScaledVector(nW, out); return o; };
    c.fade = (op) => { for (const m of Object.values(mats)) { m.opacity = op; m.depthWrite = op > .5; } };            // 0 到 1：整张照片的透明度
    c.tape = (u) => { tapeM.forEach((m) => { m.visible = u > .01; m.scale.setScalar(Math.max(.01, u)); }); };          // 胶带：0 看不见，1 贴好
    c.reset = () => { g.position.copy(c.home.p); g.quaternion.copy(c.home.q); g.scale.setScalar(1); c.fade(1); c.tape(1); };
    c.home = c.pose();
    c.reset(); cards.push(c);
  }
  const center = new THREE.Vector3(P.cx, P.cy, P.z);
  return { root, cards, P, W, H, center, nW, back: { canvas, paper, tex: backTex, mats: cards.map((c) => c.mats.back) }, FX, FY };
}
