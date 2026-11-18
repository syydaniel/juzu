// 导演表体检（不开浏览器，一两秒就完）：node tools/chk.mjs "$PWD"
// 查这些：时间写法能不能换成秒；屏幕内容中间有没有空档；镜头数、硬切数、太短的镜头；各张表是不是按口播顺序写的；
// 桌上的字块在不在安全区、会不会互相压住；屏幕镜头会不会切掉标题条；小机器人镜头旁边有没有这句话的重点；悬浮段够不够长；换光是不是放在硬切上。
// 有时间写法解析不了时，退出码是 1。
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url';
const dir = path.resolve(process.argv[2] || '.'), U = (f) => pathToFileURL(path.join(dir, f)).href;
const src = fs.readFileSync(path.join(dir, 'tl.js'), 'utf8');
globalThis.window = {}; window.TL = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const kit = await import(U('kit.js')), TX = kit.TX, TL = window.TL;
const S = (await import(U('shots.js'))).default({ TX, TL });
const warn = [], bad = new Set(); let n = 0;
const walk = (o) => { if (typeof o === 'string' && /^([a-z]\d\d|DUR|END)/.test(o)) { n++; try { if (isNaN(TX(o))) throw new Error('不是数字'); } catch (e) { bad.add(o + '  ← ' + e.message); } }
  else if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') for (const k in o) walk(o[k]); };
walk(S);
const T = (x) => { try { return TX(x); } catch { return NaN; } }, f1 = (x) => x.toFixed(1);
console.log(`时间写法 ${n} 个，解析不了的 ${bad.size} 个`); for (const b of bad) console.log('  ✗', b);

// 按口播顺序写：同一张表里，后一条的时刻不该比前一条早（KAKA 例外：它可以穿插）
for (const [name, key] of [['CAM', 'at'], ['SCREEN', 't0'], ['FX3D', 'at'], ['STICK', 't0'], ['GLASS', 't0'], ['BOARD', 't0'], ['KAKA_IN', 't0'], ['CTA', 'at'], ['PHONE', 'at'], ['HOLO', 't0'], ['NOTEBOOK', 'at'], ['VISIT', 't0']]) {
  const L = (S[name] || []).map((x) => T(x[key] ?? x.at ?? x.t0)); for (let i = 1; i < L.length; i++) if (L[i] < L[i - 1] - .05) warn.push(`${name} 第 ${i + 1} 条（${f1(L[i])} 秒）比上一条（${f1(L[i - 1])} 秒）早：按口播顺序写`); }

// 屏幕：中间不要有空档
const sc = S.SCREEN.map((x) => [T(x.t0), T(x.t1), x.kind]).sort((a, b) => a[0] - b[0]);
if (sc[0]?.[0] > .05) warn.push(`屏幕从 ${f1(sc[0][0])} 秒才开始有内容，前面是黑的`);
for (let i = 1; i < sc.length; i++) if (sc[i][0] - Math.max(...sc.slice(0, i).map((q) => q[1])) > .05) warn.push(`屏幕在 ${f1(sc[i - 1][1])} 到 ${f1(sc[i][0])} 秒之间是空的`);
for (const [a, b, k] of sc) if (!(b > a)) warn.push(`屏幕 ${k} 的结束（${f1(b)}）不晚于开始（${f1(a)}）`);

// 镜头
const cams = S.CAM.map((c) => ({ ...c, t: T(c.at) })).sort((a, b) => a.t - b.t); cams.forEach((c, i) => { c.t1 = cams[i + 1]?.t ?? TL.duration; });
console.log(`镜头 ${cams.length} 个，硬切 ${cams.filter((c) => c.d === 0).length} 次，滑过去 ${cams.filter((c, i) => i && c.d !== 0).length} 次`);
cams.forEach((c, i) => { const nx = cams[i + 1]; if (c.t1 - c.t < 2.5 && (!nx || nx.d === 0)) warn.push(`${f1(c.t)} 秒的 ${c.cam} 镜头只有 ${f1(c.t1 - c.t)} 秒就硬切走了：太短，观众还没看清`); });   // 后面接的是滑过去的，不算
// 屏幕镜头的取景：算一下画面上沿和左沿落在屏幕的哪里。上沿低于 0.06、左沿右于 0.05，标题条就被切了
const fovH = (mm) => 2 * Math.atan(20.25 / 2 / mm), MW = .597, MH = .336;
for (const c of cams.filter((c) => c.cam === 'scr')) for (const e of [0, 1]) {
  const g = (k, d) => e && c[k + '2'] !== undefined ? c[k + '2'] : (c[k] ?? d), dist = g('dist', .9) * (e ? 1 - (c.creep ?? .04) : 1), hh = dist * Math.tan(fovH(g('mm', 50)) / 2), hw = hh * 16 / 9;
  const top = g('v', .5) - hh / MH, left = g('u', .5) - hw / MW;
  if (top > .06 || left > .05) warn.push(`${f1(c.t)} 秒的屏幕镜头${e ? '（走到最后）' : ''}可能切到标题条：画面上沿在屏幕 ${top.toFixed(2)} 处、左沿在 ${left.toFixed(2)} 处（dist 加大，或者 u、v 往 0.5 靠）`);
}

// 桌上的字块：估一下每块多宽，看在不在安全区（x 1.12 到 1.97），同时在桌上的会不会压在一起
const SAFE = S.SAFE || [1.12, 1.97];
const wid = (it) => { const sz = it.size ?? 64, cw = [...it.text].reduce((s, ch) => s + (/[\x00-\x7f]/.test(ch) ? .58 : 1), 0) * sz, W = Math.max(cw + 140, it.minW ?? 300), H = sz * 1.25 + 90; return W / H * (it.hgt ?? .06); };
const flats = (S.FX3D || []).filter((x) => x.flat).map((x) => ({ ...x, a: T(x.at ?? x.t0), b: T(x.t1), w: wid(x) }));
for (const f of flats) { const l = f.flat[0] - f.w / 2, r = f.flat[0] + f.w / 2;
  if (l < SAFE[0] || r > SAFE[1]) warn.push(`字块「${f.text}」占 x ${l.toFixed(2)} 到 ${r.toFixed(2)}，出了安全区 ${SAFE[0]} 到 ${SAFE[1]}，会被笔记本或手机压住`);
  if (Math.abs(f.flat[1] - .665) > .04) warn.push(`字块「${f.text}」的 z 是 ${f.flat[1]}，离 .665 太远：会压到键盘或掉出桌沿`); }
for (let i = 0; i < flats.length; i++) for (let j = i + 1; j < flats.length; j++) { const p = flats[i], q = flats[j];
  if (p.a < q.b && q.a < p.b && Math.abs(p.flat[0] - q.flat[0]) < (p.w + q.w) / 2 - .005) warn.push(`字块「${p.text}」和「${q.text}」同时在桌上，压在一起了`); }

// 小机器人镜头：它占画面的时候，旁边要有这句话的重点（贴图、磨砂卡、立体字、标题）
const KC = S.KAKA_CAMS || ['talk', 'host', 'host2'], on = (L, t, a = 't0', b = 't1') => (L || []).some((x) => t >= T(x[a] ?? x.at) && t < T(x[b]));
for (const c of cams.filter((c) => KC.includes(c.cam))) { let miss = 0, tot = 0;
  for (let t = c.t + .6; t < c.t1 - .2; t += .25) { tot++; if (!(on(S.STICK, t) || on(S.GLASS, t) || on(S.TITLES, t) || on((S.FX3D || []).filter((x) => !x.flat), t, 'at') || (S.CHAPTERS || []).some((x) => t >= T(x.at) - .2 && t < T(x.at) + (x.dur || 3.4)))) miss++; }
  if (miss > tot * .25) warn.push(`${f1(c.t)} 秒的 ${c.cam} 镜头里，小机器人有 ${Math.round(miss / tot * 100)}% 的时间旁边什么都没有：加一张贴图或磨砂卡`); }

// 悬浮段：一段至少 12 秒（起飞 1.7、照片长出来到亮内容 5.6、收回去 4.4）；两段不要叠在一起
const mg = (S.MAGIC || []).map((m) => [T(m.t0), T(m.t1)]).sort((a, b) => a[0] - b[0]);
// 笔记本要有小机器人飞过去（VISIT）才掀得开：光线从它手心拉出去
for (const e of S.NOTEBOOK || []) { const t = T(e.at); if (!(S.VISIT || []).some((v) => T(v.t0) + 1.3 < t && t < T(v.t1))) warn.push(`${f1(t)} 秒的笔记本（NOTEBOOK）旁边没有 VISIT：小机器人不在，光线没处拉，写一段 VISIT 让它飞过去`); }
mg.forEach(([a, b], i) => { if (b - a < 12) warn.push(`${f1(a)} 秒的悬浮段只有 ${f1(b - a)} 秒：至少 12 秒，照片才来得及长出来、亮内容、再飞回墙上`); if (i && a < mg[i - 1][1]) warn.push(`${f1(a)} 秒的悬浮段和上一段叠在一起了`); });
// 换光：一下子换掉的光（d 小于 0.5 秒）要放在硬切上，环境反射只在硬切时重拍；镜头中间换，反射要到下一刀才跟上
if (Array.isArray(S.LIGHT)) { const cuts = cams.filter((c, i) => i === 0 || (c.d ?? 2.2) <= 0).map((c) => c.t);
  for (const k of S.LIGHT) { const t = T(k.at); if (t > .05 && (k.d ?? 4) < .5 && !cuts.some((c) => Math.abs(c - t) < .06)) warn.push(`${f1(t)} 秒一下子换成「${typeof k.p === 'string' ? k.p : '自定的光'}」，但这里不是硬切：把换光挪到硬切上，或者 d 写长一点慢慢变`); } }

console.log(warn.length ? `要看一下的 ${warn.length} 处：\n` + warn.map((w) => '  · ' + w).join('\n') : '没有发现问题。');
process.exitCode = bad.size ? 1 : 0;
