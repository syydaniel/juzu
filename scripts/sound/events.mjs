// 从导演表 set/shots.js 读出片场里「会发出声音」的动作和时刻，写到 sfx/events.json（给 set_fx.py 用）。
//   juzu.py events        （在这一集的目录里跑，或者设 JUZU_EP=那一集的目录）
// 认这几类：FX3D 桌上的字块落桌（出现后 0.42 秒，和落地动画对齐）、牌子升起来、镜头前翻出来的立体卡；
// BOARD 软木板的纸展开（提前 0.8 秒）和图钉（晚 0.45 秒）；STICK 贴截图；KAKA_IN 小机器人跳进（提前 0.8 秒）和跳出屏幕。
// 导演表里换了写法或者加了新动作，就改这里的规则；规则以外的零星动作写在 cues.json 的 set_fx.extra。
import fs from 'fs'; import path from 'path'; import url from 'url';

function findEp() {
  let d = path.resolve(process.env.JUZU_EP || process.cwd());
  for (;;) {
    if (fs.existsSync(path.join(d, 'episode.json'))) return d;
    const up = path.dirname(d); if (up === d) break; d = up;
  }
  console.error('找不到 episode.json：请在某一集的目录里运行，或者设 JUZU_EP=那一集的目录'); process.exit(1);
}

const E = findEp(), D = path.join(E, 'set');
const src = fs.readFileSync(path.join(D, 'tl.js'), 'utf8'); globalThis.window = globalThis.window || {};
window.TL = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const kit = await import(url.pathToFileURL(path.join(D, 'kit.js')).href);
const S = (await import(url.pathToFileURL(path.join(D, 'shots.js')).href)).default({ TX: kit.TX, TL: window.TL });
const TX = kit.TX, ev = [];
for (const it of S.FX3D || []) {
  const t0 = TX(it.t0 ?? it.at);
  if (it.flat) ev.push({ t: t0 + .42, kind: 'tok', text: it.text });          // 桌上的字块落到桌面
  else if (it.pos) ev.push({ t: t0, kind: 'rise', text: it.text });            // 桌上的牌子升起来
  else ev.push({ t: t0, kind: 'card', text: it.text });                        // 镜头前翻出来的立体卡
}
for (const b of S.BOARD || []) ev.push({ t: TX(b.t0) - .8, kind: 'unroll', text: b.title || '' });
for (const b of S.BOARD || []) for (const p of b.pins || []) ev.push({ t: TX(p.at ?? b.t0) + .45, kind: 'pin', text: p.cap || '' });
for (const s of S.STICK || []) ev.push({ t: TX(s.t0), kind: 'stick', text: s.cap || s.tag || (s.note || []).join('') });
for (const k of S.KAKA_IN || []) { ev.push({ t: TX(k.t0) - .8, kind: 'hopin' }); ev.push({ t: TX(k.t1), kind: 'hopout' }); }
const bad = ev.filter(e => !Number.isFinite(e.t));
if (bad.length) { console.error('这些动作的时间算不出来（时间串写错了？）：', JSON.stringify(bad.slice(0, 5))); process.exit(1); }
ev.sort((a, b) => a.t - b.t);
fs.mkdirSync(path.join(E, 'sfx'), { recursive: true });
fs.writeFileSync(path.join(E, 'sfx/events.json'), JSON.stringify(ev, null, 1));
const c = {}; for (const e of ev) c[e.kind] = (c[e.kind] || 0) + 1;
console.log('动作', ev.length, '处', JSON.stringify(c), '→ sfx/events.json');
