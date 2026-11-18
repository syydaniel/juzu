// 带布灯罩的灯（书桌台灯、床头壁灯）怎么打光。desk.js 和 bed.js 都用它。
// 灯罩里只放一个往四面八方照的点光、灯罩又不透光的话，墙上、天花板上会被灯罩口切出几道边很硬的大弧，像探照灯；
// 斜着打的光束还会从灯罩侧面「穿」出去。真的布灯罩是这样的：
//   往下：灯罩下口多大，光就照多大（角度 = 灯泡到下口边的夹角），桌上一片亮，边是软的；
//   往上：上口小，往上的光窄一些、暗一些，在墙上、天花板上留一片淡淡的光；
//   透过布：往四周都有一点暖光，很弱，而且照不出灯罩自己的影子。
// 灯泡有大小（几厘米），所以影子边是软的：harness3 每个采样把整组灯在灯泡大小的球里挪一下（stage.emit）。
// 灯罩的网格要写 userData.lampShade = true，透过布的那路光才不会被它自己挡住。
import * as THREE from 'three';

export const GLOW_LAYER = 6;   // 透过布的那路光，影子相机只看这一层；场景里除了灯罩，所有东西都在这一层（markGlow）

// parent 里 pos 处放一组灯。o：down / up = [角度（弧度）, 软边比例]，r 灯泡半径，color，glowDist，upShadow
export function lampBulbRig(parent, pos, o) {
  const rig = new THREE.Group(); rig.position.set(...pos); parent.add(rig);
  const col = o.color ?? 0xffc38a;
  const spot = (ang, pen, dir, map) => { const s = new THREE.SpotLight(col, 0, o.dist ?? 5, ang, pen, 2); s.target.position.set(0, dir, 0); rig.add(s, s.target);
    s.shadow.mapSize.set(map, map); s.shadow.bias = -.002; s.shadow.camera.near = .03; return s; };
  const down = spot(...o.down, -1, 1024), up = o.up ? spot(...o.up, 1, 512) : null;
  const glow = new THREE.PointLight(o.glowColor ?? 0xffb47a, 0, o.glowDist ?? 2.5, 2); rig.add(glow);
  glow.shadow.mapSize.set(512, 512); glow.shadow.bias = -.003; glow.shadow.camera.near = .03; glow.shadow.camera.layers.set(GLOW_LAYER);
  const emit = { obj: rig, base: rig.position.clone(), r: o.r ?? .03 };
  return {
    rig, down, up, glow,
    // v：灯开多大（0 关）；k：三路各占多少；stage：传进来才登记灯泡大小（软影子）
    set(v, k, stage) {
      const on = v > .02; down.intensity = v * k.down; glow.intensity = v * k.glow; if (up) up.intensity = v * k.up;
      down.castShadow = on; glow.castShadow = on; if (up) up.castShadow = on && (o.upShadow ?? true);
      if (stage) { stage.emit ??= []; if (!stage.emit.includes(emit)) stage.emit.push(emit); if (on) markGlow(stage.scene); }
    },
  };
}

// 每帧灯开着的时候调：新加进场景的东西（字块、飞的东西）也要挡透过布的光；灯罩不挡（它就是那块布）
export function markGlow(scene) {
  scene.traverse((m) => { if (!m.isMesh) return; if (m.userData.lampShade) m.layers.disable(GLOW_LAYER); else m.layers.enable(GLOW_LAYER); });
}
