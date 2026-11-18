// 「真实感开关」的 three.js 外壳。原版的外壳是给片元着色器用的，这里换成网格场景，约定不变：
//   ?level=0..7 固定某一级，?clay=1 灰模，?ns=采样数，?render 时不自己跑循环；页面暴露 render(t)、DUR、READY。
// 七个开关落在哪里：
//   0 平涂               每种材质换成不受光的纯色
//   1 直射光和硬阴影     一盏太阳加阴影贴图，几乎没有环境光
//   2 程序化贴图         颜色、起伏、粗糙度三张贴图接上
//   3 环境光和反射       在房间中央拍一圈当环境贴图（拍两次，算进一次反弹），金属度打开
//   4 软阴影和接触阴影   太阳当成有大小的圆盘，每个采样换一个位置；屏幕空间的接触阴影
//   5 景深               薄透镜：每个采样把相机挪到光圈上的一个点，焦平面不动。光圈半径 = 焦距 ÷ 光圈值 ÷ 2
//   6 运动模糊           每个采样取快门时间里的一个时刻（180° 快门）
//   7 色调映射和颗粒     ACES、对比、暗角、颗粒
// 4、5、6 三级共用同一批采样：一帧渲 ns 次，累加到一张浮点贴图上再平均。
import * as THREE from 'three';

export const Q = new URLSearchParams(location.search);
export const RENDER = Q.has('render');
export const NAMES = ['平涂', '直射光和硬阴影', '程序化贴图', '环境光和反射', '软阴影和接触阴影', '景深', '运动模糊', '色调映射和颗粒'];
export const SENSOR_H = 0.02025;                                   // 16:9 的全画幅感光面高度（米）
const fr = x => x - Math.floor(x), hash = n => fr(Math.sin(n * 127.1 + 311.7) * 43758.5453);

const QUAD_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const ACC_FS = `
uniform sampler2D tC; uniform sampler2D tD; uniform mat4 P; uniform mat4 PI; uniform float ao; uniform float seed; varying vec2 vUv;
vec3 vp(vec2 uv){ float d = texture2D(tD, uv).x; vec4 c = PI * vec4(uv * 2. - 1., d * 2. - 1., 1.); return c.xyz / c.w; }
float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed * 3.7) * 43758.5453); }
void main(){
  vec3 col = texture2D(tC, vUv).rgb;
  if (ao > 0. && texture2D(tD, vUv).x < 1.) {                      // 接触阴影：看附近有没有东西挡着
    vec3 p = vp(vUv), n = normalize(cross(dFdx(p), dFdy(p)));
    vec3 up = abs(n.y) < .9 ? vec3(0., 1., 0.) : vec3(1., 0., 0.), T = normalize(cross(up, n)), B = cross(n, T);
    float rot = h21(gl_FragCoord.xy) * 6.2831, occ = 0.;
    for (int i = 0; i < 10; i++) {
      float fi = float(i), r = (fi + .5) / 10., a = fi * 2.39996 + rot;
      vec3 l = vec3(cos(a) * sqrt(r), sin(a) * sqrt(r), sqrt(1. - r));
      float R0 = mod(fi, 2.) < .5 ? .16 : .6, R = R0 * mix(.2, 1., fract(fi * .618 + rot));     // 两种尺度：贴着的一圈暗，和墙角、桌下的大片暗
      vec3 sp = p + (T * l.x + B * l.y + n * l.z) * R + n * .002;
      vec4 c = P * vec4(sp, 1.); float sz = vp(c.xy / c.w * .5 + .5).z;
      occ += step(sp.z + .003, sz) * smoothstep(0., 1., R0 / max(abs(p.z - sz), 1e-4));
    }
    col *= 1. - ao * occ / 10.;
  }
  gl_FragColor = vec4(col, 1.);
}`;
const OUT_FS = `
uniform sampler2D tA; uniform float inv; uniform float exposure; uniform float grade; uniform float frame; uniform vec2 res; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + frame * 1.618) * 43758.5453); }
void main(){
  vec3 c = texture2D(tA, vUv).rgb * inv * exposure;
  if (grade > .5) {
    vec3 a = c * (2.51 * c + .03) / (c * (2.43 * c + .59) + .14);                   // ACES 近似
    float l0 = dot(c, vec3(.2126, .7152, .0722)), l1 = l0 * (2.51 * l0 + .03) / (l0 * (2.43 * l0 + .59) + .14);
    c = mix(a, c * (l1 / max(l0, 1e-4)), .45);                                      // 一半按亮度压，暖色的高光不至于整片发黄
    c = pow(clamp(c, 0., 1.), vec3(1. / 2.2));
    c = mix(c, c * c * (3. - 2. * c), .32);                                         // 一点 S 形对比
    float l = dot(c, vec3(.2126, .7152, .0722));
    c = mix(vec3(l), c, 1.05);
    c += vec3(-.010, .0, .016) * (1. - l) + vec3(.014, .004, -.012) * l;            // 暗部偏冷，亮部偏暖
    vec2 q = (vUv - .5) * vec2(res.x / res.y, 1.); c *= 1. - .32 * dot(q, q);       // 暗角
    c += (h(gl_FragCoord.xy) - .5) * .016;                                          // 颗粒，种子是帧号
  } else c = pow(clamp(c, 0., 1.), vec3(1. / 2.2));                                 // 前几级只做 gamma，高光会过曝，这是故意的
  gl_FragColor = vec4(c, 1.);
}`;

export class Stage {
  constructor() {
    this.level = Q.has('level') ? +Q.get('level') : 7; this.clay = Q.get('clay') === '1';
    this.light = Q.get('light') || 'lowsun'; this.fps = +(Q.get('fps') || 30);
    this.ns = +(Q.get('ns') || 16); this.nsLive = 64; this.exposure = 1; this.aoStrength = .8; this.count = 0;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.setPixelRatio(RENDER ? 1 : Math.min(devicePixelRatio, 1.5)); r.setSize(innerWidth, innerHeight); r.autoClear = false;
    r.toneMapping = THREE.NoToneMapping; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    document.body.appendChild(r.domElement);
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, .05, 80);
    this.mats = []; this.clayMat = new THREE.MeshStandardMaterial({ color: 0x8e8e8e, roughness: .82, shadowSide: THREE.DoubleSide });
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const sm = (fs, u, extra) => new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false, ...extra });
    this.accMat = sm(ACC_FS, { tC: { value: null }, tD: { value: null }, P: { value: new THREE.Matrix4() }, PI: { value: new THREE.Matrix4() }, ao: { value: 0 }, seed: { value: 0 } },
      { transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
    this.outMat = sm(OUT_FS, { tA: { value: null }, inv: { value: 1 }, exposure: { value: 1 }, grade: { value: 0 }, frame: { value: 0 }, res: { value: new THREE.Vector2() } });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.accMat); this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene(); this.quadScene.add(this.quad);
    this._alloc();
    addEventListener('resize', () => { r.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this._alloc(); this.dirty = true; });
  }
  _alloc() {
    const s = this.renderer.getDrawingBufferSize(new THREE.Vector2()); this.rtS?.dispose(); this.rtA?.dispose();
    this.rtS = new THREE.WebGLRenderTarget(s.x, s.y, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(s.x, s.y) });
    this.rtA = new THREE.WebGLRenderTarget(s.x, s.y, { type: THREE.FloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.outMat.uniforms.res.value.copy(s); this.size = s;
  }

  // 登记一种材质。o：color（平涂和没贴图时的颜色）、rough、metal、set（tex.js 给的一套贴图）、repeat、bumpScale、tint。
  mat(o) {
    const std = new THREE.MeshStandardMaterial({ color: o.color, roughness: o.rough ?? .6, side: o.side ?? THREE.FrontSide, transparent: !!o.transparent, opacity: o.opacity ?? 1, depthWrite: !o.transparent });
    const flat = new THREE.MeshBasicMaterial({ color: o.flat ?? o.color, side: std.side, transparent: !!o.transparent, opacity: o.transparent ? Math.min(1, (o.opacity ?? 1) * 2) : 1, depthWrite: !o.transparent });
    const rec = { o, std, flat, tex: null }; std.userData.rec = rec;
    if (o.set) { rec.tex = {}; for (const k of ['map', 'bump', 'rough']) if (o.set[k]) { const t = o.set[k].clone(); t.repeat.set(...(o.repeat || [1, 1])); t.needsUpdate = true; rec.tex[k] = t; } }
    this.mats.push(rec); return std;
  }
  // 级别、灰模或光变了以后调用：换材质状态，再让场景自己调灯。
  applyLook() {
    const L = this.level, clay = this.clay;
    for (const { o, std, tex } of this.mats) { const t = L >= 2 && tex;
      std.map = t ? tex.map : null; std.bumpMap = t ? tex.bump : null; std.bumpScale = o.bumpScale ?? 1; std.roughnessMap = t && tex.rough ? tex.rough : null;
      std.color.set(t && tex.map ? (o.tint ?? 0xffffff) : o.color); std.roughness = t && tex.rough ? (o.roughScale ?? 1) : (o.rough ?? .6);
      std.metalness = L >= 3 ? (o.metal ?? 0) : 0; std.needsUpdate = true; }
    this.scene.traverse(m => { if (!m.isMesh && !m.isPoints) return; if (m.userData.fixed) return;
      m.userData.orig ??= m.material; if (m.isInstancedMesh) m.userData.ic ??= m.instanceColor;
      const rec = m.userData.orig.userData.rec;
      m.material = clay ? this.clayMat : (L === 0 && rec ? rec.flat : m.userData.orig);
      if (m.isInstancedMesh && m.userData.ic) { m.instanceColor = clay ? null : m.userData.ic; }
      if (m.userData.minLevel !== undefined) m.visible = !clay && L >= m.userData.minLevel;
      if (m.userData.noClay) m.visible = !clay; });
    this.onLook?.(this); this.dirty = true;
  }
  // 在一个点上把四周拍下来当环境贴图。拍两遍：第二遍带着第一遍的结果，多算一次反弹。
  captureEnv(pos, passes = 2) {
    const s = this.scene, r = this.renderer; s.environment = null; this.pmrem ??= new THREE.PMREMGenerator(r);
    const crt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType }), cc = new THREE.CubeCamera(.05, 60, crt); cc.position.copy(pos);
    r.autoClear = true;
    for (let i = 0; i < passes; i++) { cc.update(r, s); const e = this.pmrem.fromCubemap(crt.texture).texture; this.env?.dispose(); this.env = e; s.environment = e; }
    r.autoClear = false; crt.dispose(); r.setRenderTarget(null);
  }

  begin() { const r = this.renderer; r.setRenderTarget(this.rtA); r.setClearColor(0x000000, 0); r.clear(); this.count = 0; }
  // 累加第 i 个采样（一共 N 个）。pose：{ p 机位, l 看向, mm 焦距, f 光圈值, focus 对焦点 }。
  addSample(t, i, N) {
    const L = this.clay ? 4 : this.level, f = Math.round(t * this.fps), s0 = hash(7.1), s1 = hash(3.3), cam = this.camera, r = this.renderer;   // 种子不随帧变：每帧同一套采样位置，静止的地方逐帧完全一样，软阴影和环境遮蔽不会一抖一抖
    let ti = t; if (L >= 6 && N > 1 && !this.clay) ti = t + ((i + fr(i * .618 + s0)) / N - .5) * (.5 / this.fps);       // 180° 快门
    if (this.tickFast && ti !== t) this.tickFast(ti);                                                          // 快的东西（飞的小机器人、照片、掉落的字块）也按这个采样的快门时刻推进，才有运动模糊；采样少的时候会一格格重影，见 reference/踩过的坑.md
    const pose = this.poseAt(ti);
    cam.position.copy(pose.p); cam.up.set(0, 1, 0); cam.lookAt(pose.l);
    cam.fov = 2 * Math.atan(SENSOR_H / 2 / (pose.mm / 1000)) * 180 / Math.PI; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const e = cam.matrixWorld.elements, right = new THREE.Vector3(e[0], e[1], e[2]), up = new THREE.Vector3(e[4], e[5], e[6]), fwd = new THREE.Vector3(-e[8], -e[9], -e[10]);
    const F = Math.max(.1, pose.focus.clone().sub(pose.p).dot(fwd)); let dx = 0, dy = 0;
    if (L >= 5 && N > 1 && !this.clay) { const R = pose.mm / 1000 / pose.f / 2, rr = Math.sqrt((i + .5) / N), a = i * 2.39996323 + s1 * 6.2832; dx = R * rr * Math.cos(a); dy = R * rr * Math.sin(a); }
    const jx = N > 1 ? fr(.5 + i * .7548776662 + s0) - .5 : 0, jy = N > 1 ? fr(.5 + i * .5698402910 + s1) - .5 : 0;   // 像素内抖动当抗锯齿
    cam.position.addScaledVector(right, dx).addScaledVector(up, dy); cam.updateMatrixWorld();
    const P = cam.projectionMatrix.elements;                                                                        // 剪切投影：相机挪了，焦平面上的点还落在原处
    P[8] = -P[0] * dx / F + jx * 2 / this.size.x; P[9] = -P[5] * dy / F + jy * 2 / this.size.y; cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    if (this.sun) { const { light, base, angR } = this.sun, d = base.clone().sub(light.target.position), len = d.length(); light.position.copy(base);
      if (L >= 4 && N > 1) { const u = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize(), v = new THREE.Vector3().crossVectors(d, u).normalize();
        const rr = Math.sqrt(fr(.5 + i * .7548776662 + s1)) * Math.tan(angR) * len, a = fr(i * .5698402910 + s0) * 6.2832; light.position.addScaledVector(u, rr * Math.cos(a)).addScaledVector(v, rr * Math.sin(a)); } }
    r.setRenderTarget(this.rtS); r.setClearColor(0x000000, 1); r.clear(); r.render(this.scene, cam);
    const u = this.accMat.uniforms; u.tC.value = this.rtS.texture; u.tD.value = this.rtS.depthTexture; u.P.value.copy(cam.projectionMatrix); u.PI.value.copy(cam.projectionMatrixInverse);
    u.ao.value = L >= 4 ? this.aoStrength : 0; u.seed.value = i;
    this.quad.material = this.accMat; r.setRenderTarget(this.rtA); r.render(this.quadScene, this.quadCam); this.count++;
  }
  present(t) {
    const u = this.outMat.uniforms, flat = this.level === 0 && !this.clay; u.tA.value = this.rtA.texture; u.inv.value = 1 / Math.max(1, this.count);
    u.exposure.value = flat ? 1 : this.exposure; u.grade.value = this.level >= 7 && !this.clay ? 1 : 0; u.frame.value = Math.round(t * this.fps);
    this.quad.material = this.outMat; this.renderer.setRenderTarget(null); this.renderer.render(this.quadScene, this.quadCam);
  }
  // 出片时的一整帧。没有软阴影、景深和运动模糊的级别只需要抗锯齿，采样少一些。
  renderFrame(t) { this.tick?.(t); this.begin(); const L = this.clay ? 4 : this.level, N = L >= 4 ? this.ns : Math.min(this.ns, 6); for (let i = 0; i < N; i++) this.addSample(t, i, N); this.present(t); }
}
