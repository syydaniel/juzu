// 杯子里冒热气。十几团很淡的雾，从咖啡面升起来，一边升一边打旋、变大、变淡。
// 只跟 t 走：每一团有自己的周期和相位，同一个 t 永远是同一帧。逆着窗光看最明显，正面几乎看不出，这是对的。
// 不要热气：film.html?nosteam，或者导演表里写 STEAM = false。
import * as THREE from 'three';
const hash = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
function puffTex() { const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), id = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = x / N - .5, dy = y / N - .5, r = Math.hypot(dx, dy) * 2, n = .6 + .4 * Math.sin(x * .21 + Math.sin(y * .17) * 2) * Math.sin(y * .13 + x * .05), a = Math.max(0, 1 - r) ** 2 * n, o = (y * N + x) * 4;
    id.data[o] = id.data[o + 1] = id.data[o + 2] = 255; id.data[o + 3] = a * 255; }
  g.putImageData(id, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
export class Steam {
  constructor(scene, at, o = {}) { this.at = at; this.n = o.n ?? 16; this.k = o.strength ?? 1; const tex = puffTex();
    this.p = Array.from({ length: this.n }, (_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xf6f1ea, transparent: true, depthWrite: false, opacity: 0 })); s.userData.fixed = true; s.castShadow = false; scene.add(s); return s; }); }
  update(t, on = 1) { const [x0, y0, z0] = this.at;
    this.p.forEach((s, i) => { const per = 2.8 + hash(i, 1) * 1.6, a = ((t + hash(i, 2) * per) % per) / per, h = a * .2, sw = Math.sin(t * .9 + i * 1.3) * .012 + Math.sin(h * 30 + i) * .006 * a;
      s.position.set(x0 + sw + (hash(i, 3) - .5) * .02, y0 + h, z0 + Math.cos(t * .7 + i) * .008 * a + (hash(i, 4) - .5) * .015);
      s.material.rotation = hash(i, 5) * 6 + a * (hash(i, 6) - .5) * 3; s.scale.setScalar(.018 + a * .075);
      s.material.opacity = on * this.k * .1 * Math.min(1, a * 5) * (1 - a) ** 1.5; s.visible = s.material.opacity > .002; }); }
}
