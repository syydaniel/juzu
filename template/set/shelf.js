// 背墙上软木板下面的矮书柜：主机位 wide 右下角那一块墙和地原来空着。
// 白漆的两格矮柜，宽 0.78（和软木板一样宽，正好在板子下面）、高 0.72、深 0.30，靠墙（让出踢脚线）。
// 柜顶离软木板下沿 0.20：放一摞横放的书、一只小陶瓶、一个斜靠在墙上的小相框，都不高过板子下沿。
// 左边离纸篓和墙上的插座 1 厘米以上，右边离右墙 0.10。
// 不放在前墙床头柜和门之间：那里在悬浮镜头里正好挡在板子和小机器人后面 0.45 米，景深拉不开。
// 两格里是书（大多竖着，有一本斜靠，下格有一摞横放的）。整个柜子在自己的坐标里搭：背靠 z = 0，正面朝 -z，再整体转过去贴到墙上。
// 不要书柜：film.html?noshelf，或者 SET.shelf = false。
import * as THREE from 'three';
import { rng } from './tex.js';

export const SHELF = { cx: 2.91, w: .78, h: .72, d: .30, wallZ: .015, ym: .39 };   // wallZ：背板离背墙（踢脚线厚 1.2 厘米）

export function buildShelf(stage, set) {
  const { B, lathe, group, M } = set, S = { ...SHELF, x0: -SHELF.w / 2, x1: SHELF.w / 2, back: 0 }, w = S.w, cx = 0, zf = -S.d, zc = -S.d / 2, t = .018;
  const paint = stage.mat({ color: 0xebe7de, rough: .42 }), g = group(S.cx, 0, S.wallZ, 'shelf'); g.rotation.y = Math.PI;   // 局部 -z（正面）转到屋里 +z
  // 柜体：两块侧板、顶板、底板（下面一条往里缩 2 厘米的踢脚）、中间一块隔板、薄背板
  for (const sx of [S.x0 + t / 2, S.x1 - t / 2]) B(t, S.h, S.d, .002, paint, sx, S.h / 2, zc, g);
  B(w, t, S.d, .002, paint, cx, S.h - t / 2, zc, g);
  B(w - 2 * t, .05, t, .002, paint, cx, .025, zf + .02 + t / 2, g);
  const y0 = .05 + t, ym = S.ym;                                                    // 下格底面、隔板中心
  B(w - 2 * t, t, S.d - .006, .002, paint, cx, .05 + t / 2, zc + .003, g);
  B(w - 2 * t, t, S.d - .02, .002, paint, cx, ym, zc + .01, g);
  B(w - 2 * t, S.h - .05, .006, .001, paint, cx, .05 + (S.h - .05) / 2, S.back - .003, g);
  // 书：一格一排，封面两片 + 书脊，纸页缩进去一点（和书桌上方那排书同一种做法）
  const r = rng(53), list = [];
  const row = (yb, top, seed) => { const rr = rng(seed); let x = S.x0 + t + .012; const end = S.x1 - t - .01, gapAt = 3 + Math.floor(rr() * 6);
    while (x < end - .02) { const n = list.length, bw = .016 + rr() * .026, bh = Math.min(top - yb - .012, .17 + rr() * .13), bd = .14 + rr() * .08;
      if (x + bw > end) break; const leanIt = n % 13 === gapAt && x < end - .09;
      list.push({ x: x + bw / 2 + (leanIt ? .02 : 0), y: yb, w: bw, h: bh, d: bd, lean: leanIt ? .2 : (rr() - .5) * .015, z: zf + .015 + bd / 2,
        col: new THREE.Color().setHSL(rr() < .65 ? .02 + rr() * .1 : .5 + rr() * .14, .18 + rr() * .35, .12 + rr() * .3), band: rr() < .45 });
      x += bw + .0012 + (leanIt ? .07 : 0) + (rr() < .08 ? .03 : 0); } };
  row(y0, ym - t / 2, 61); const nLow = list.length;
  // 下格右边一段换成一摞横放的大开本：先把那里竖着的书去掉
  { const stack = []; let y = y0, left = 9; for (let k = 0; k < 4; k++) { const bh = .022 + r() * .018, bw = .19 + r() * .05, bd = .22 + r() * .04, x = S.x1 - t - .012 - bw / 2 - r() * .01; left = Math.min(left, x - bw / 2 - .012);
      stack.push({ flat: true, x, y, w: bw, h: bh, d: bd, rot: (r() - .5) * .06, z: zf + .015 + bd / 2, col: new THREE.Color().setHSL(.04 + r() * .55, .15 + r() * .25, .2 + r() * .35), band: false }); y += bh; }
    for (let i = nLow - 1; i >= 0; i--) if (list[i].x + list[i].w / 2 + Math.abs(list[i].lean) * list[i].h > left) list.splice(i, 1); list.push(...stack); }
  row(ym + t / 2, S.h - t, 67);
  // 柜顶：左边一摞三本横放的
  { let y = S.h; for (let k = 0; k < 3; k++) { const bh = .02 + r() * .015, bw = .2 - k * .02 + r() * .02, bd = .15 + r() * .03;
      list.push({ flat: true, x: S.x0 + .14 + (r() - .5) * .01, y, w: bw, h: bh, d: bd, rot: (r() - .5) * .14, z: zf + .05 + bd / 2, col: new THREE.Color().setHSL(.05 + r() * .5, .15 + r() * .3, .25 + r() * .35), band: k === 1 }); y += bh; } }
  const n = list.length, cover = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.book, n * 3), pages = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.paper, n),
    bands = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.book, n * 2), o = new THREE.Object3D(), piv = new THREE.Object3D(); piv.add(o);
  list.forEach((b, i) => {
    if (b.flat) { piv.position.set(b.x, b.y, b.z); piv.rotation.set(0, Math.PI + b.rot, Math.PI / 2); }              // 横放：绕 z 转 90°，书脊朝屋里
    else { piv.position.set(b.x, b.y, b.z); piv.rotation.set(0, Math.PI, b.lean); }                                     // 竖放：书脊朝屋里（-z）
    const W = b.flat ? b.h : b.w, H = b.flat ? b.w : b.h;
    const put = (mesh, k, px, py, pz, sx, sy, sz) => { o.position.set(px, py, pz); o.scale.set(sx, sy, sz); piv.updateMatrixWorld(true); mesh.setMatrixAt(k, o.matrixWorld); };
    const yo = b.flat ? -H / 2 : 0, xo = b.flat ? W / 2 : 0;
    put(cover, i * 3, xo - W / 2 + .001, yo + H / 2, 0, .002, H, b.d); put(cover, i * 3 + 1, xo + W / 2 - .001, yo + H / 2, 0, .002, H, b.d); put(cover, i * 3 + 2, xo, yo + H / 2, b.d / 2 - .001, W, H, .002);
    put(pages, i, xo, yo + (H - .004) / 2 + .002, -.002, W - .004, H - .004, b.d - .006); for (let k = 0; k < 3; k++) cover.setColorAt(i * 3 + k, b.col);
    put(bands, i * 2, xo, yo + H * (b.band ? .74 : .5), b.d / 2 + .0003, W * .86, b.band ? .03 : H * .45, .0006); put(bands, i * 2 + 1, xo, yo + .02, b.d / 2 + .0003, W * .5, .007, .0006);
    bands.setColorAt(i * 2, new THREE.Color(b.band ? 0xd8cfb4 : b.col.clone().multiplyScalar(1.45).getHex())); bands.setColorAt(i * 2 + 1, new THREE.Color(0xb89a55));
  });
  for (const m of [cover, pages, bands]) { m.castShadow = m.receiveShadow = true; g.add(m); }
  // 小陶瓶（不插东西：上面就是软木板）
  { const clay = stage.mat({ color: 0xcfc6b6, rough: .8 });
    lathe([[0, 0], [.026, 0], [.03, .006], [.036, .05], [.03, .09], [.014, .112], [.012, .13], [.015, .134], [0, .134]], clay, S.x0 + .36, S.h, zc + .02, g, 40); }
  // 斜靠在墙上的小相框（一张黄昏海面的照片）
  { const fw = .12, fh = .15, fr = B(fw, fh, .012, .002, M.desk, S.x1 - .1, S.h + fh / 2 * Math.cos(.16) + .002, S.back - .03, g); fr.rotation.x = .16;                       // 上沿靠墙，下沿离墙
    const c = document.createElement('canvas'); c.width = 260; c.height = 340; const q = c.getContext('2d'), gr = q.createLinearGradient(0, 0, 0, 340);
    gr.addColorStop(0, '#d9c3a2'); gr.addColorStop(.52, '#c9906a'); gr.addColorStop(.53, '#5e6f78'); gr.addColorStop(1, '#2f3c44'); q.fillStyle = gr; q.fillRect(0, 0, 260, 340);
    q.fillStyle = 'rgba(255,230,190,.8)'; q.beginPath(); q.arc(150, 170, 18, 0, 7); q.fill();
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; const mat = new THREE.MeshStandardMaterial({ map: tx, roughness: .5 });
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(fw - .03, fh - .03), mat); pic.position.set(0, 0, -.0065); pic.rotation.y = Math.PI; pic.receiveShadow = true; fr.add(pic); }
  return g;
}
