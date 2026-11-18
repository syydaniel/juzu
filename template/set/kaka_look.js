// 主持小机器人换颜色。模板默认是一套中性配色：浅灰外壳，雾蓝灰的关节、天线头和耳垫（KAKA_LOOK0）。
// 导演表 shots.js 里写 KAKA_LOOK = { shell: '#cfe3f1', dark: '#1d2a33', red: '#ffb000' } 盖掉其中几项；三项都可以只写一项。
// shell 外壳，dark 深色的脖子、手脚和天线杆，red 天线头和耳垫（名字是历史原因：char/ 里这两样的底色是红的）。
// 按材质原来的颜色找，所以 char/ 里改了底色，KAKA_COLORS 也要跟着改。改完跑 npm run kaka-png，屏幕里那张 2D 的图跟着变。
import * as THREE from 'three';
export const KAKA_COLORS = { shell: 0xefe9df, dark: 0x23272b, red: 0xff5b4a };
export const KAKA_LOOK0 = { shell: '#dde1e5', dark: '#5a6673', red: '#8a9cae' };
const RED_GLOW = [0xff4a30, 0xff5a3c];                                         // 天线头亮起来时的自发光和光晕，跟着 red 一起换
export function recolor(root, look) {
  const L = { ...KAKA_LOOK0, ...(look || {}) };
  const want = Object.entries(L).filter(([k]) => k in KAKA_COLORS).map(([k, v]) => [new THREE.Color(KAKA_COLORS[k]).getHex(), new THREE.Color(v)]);
  const red = new THREE.Color(L.red);
  root.traverse((m) => { if (!m.isMesh && !m.isSprite) return;
    for (const mat of [].concat(m.material)) {
      if (m.isSprite) { if (RED_GLOW.includes(mat.color?.getHex())) mat.color.copy(red); continue; }
      const hit = want.find(([h]) => mat.color?.getHex() === h); if (hit) mat.color.copy(hit[1]);
      if (mat.emissive && RED_GLOW.includes(mat.emissive.getHex())) mat.emissive.copy(red); } });
}
