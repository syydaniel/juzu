// 前墙上的门和门边的开关：一间卧室得有门，空间才说得通。
// 门在前墙（z = 3.2）右边，离右墙 10 厘米：白漆的两格门（竖梃、上中下三道横档，中间两块凹进去的板），门套比墙凸出 2.5 厘米，
// 门扇比墙凸出 1 厘米；左边是执手和锁眼，右边三片合页；门下留 1.2 厘米的缝。踢脚线在门套两边断开（desk.js 的 DIM.door）。
// 不要门：film.html?nodoor，或者 SET.door = false。
import * as THREE from 'three';

export function buildDoor(stage, set) {
  const { B, cyl, group, M, DIM } = set, D = DIM.room.D, d = DIM.door, c = d.casing;
  const paint = stage.mat({ color: 0xefebe3, rough: .34 }), g = group(d.x, 0, D, 'door');
  const z = (proud) => -proud;                                                     // 局部 z：负的是往屋里
  // 门扇：一整块板（面在墙外 1 厘米），上面压竖梃和横档（再凸 6 毫米），中间两块就成了凹进去的板
  B(d.w, d.h - .012, .04, .003, paint, 0, .012 + (d.h - .012) / 2, z(.01) + .02, g);
  const fr = (w, h, x, y) => B(w, h, .012, .0025, paint, x, y, z(.016) + .006, g), sw = .11;
  fr(sw, d.h - .012, -d.w / 2 + sw / 2, .012 + (d.h - .012) / 2); fr(sw, d.h - .012, d.w / 2 - sw / 2, .012 + (d.h - .012) / 2);
  for (const [h, y] of [[.11, d.h - .055], [.16, .98], [.2, .112]]) fr(d.w - 2 * sw, h, 0, y);
  // 门套：左右两根加上头，凸出 2.5 厘米
  for (const sx of [-1, 1]) B(c, d.h + c, .05, .004, paint, sx * (d.w / 2 + c / 2), (d.h + c) / 2, 0, g);
  B(d.w + 2 * c, c, .05, .004, paint, 0, d.h + c / 2, 0, g);
  // 执手（左边，离地 1 米）、锁眼，右边三片合页
  const hx = -d.w / 2 + .065, metal = M.alu;
  const ros = cyl(.026, .012, metal, hx, 1.0, z(.016) - .006, g, 32); ros.rotation.x = Math.PI / 2;
  const neck = cyl(.009, .045, metal, hx, 1.0, z(.016) - .03, g, 16); neck.rotation.x = Math.PI / 2;
  B(.125, .018, .02, .007, metal, hx + .055, 1.0, z(.016) - .055, g);
  const esc = cyl(.017, .008, metal, hx, .9, z(.016) - .004, g, 24); esc.rotation.x = Math.PI / 2;
  B(.004, .014, .004, .001, M.black, hx, .9, z(.016) - .0085, g, { cast: false });
  for (const y of [.25, 1.05, 1.8]) cyl(.0065, .085, metal, d.w / 2 + .002, y, z(.01) - .002, g, 16);
  // 门边的开关：门套左边 12 厘米，离地 1.32 米
  const sx0 = -d.w / 2 - c - .12;
  B(.086, .086, .008, .004, M.white, sx0, 1.32, z(.004), g); B(.036, .052, .008, .004, M.white, sx0, 1.32, z(.009), g).rotation.x = .06;
  return g;
}
