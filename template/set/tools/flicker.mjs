// 背景的光抖不抖：node tools/flicker.mjs "$PWD" 秒 [帧数 8] [--fps 24] [--q ns=16]
// 从这一秒起连着渲几帧（和成片同样的采样数），只看三维画面（不含叠字层），量相邻两帧的平均亮度差（满分 255）。
// 同一个镜头里相邻两帧差在 0.1 以下算不抖。镜头在推拉的时候亮度本来就会慢慢变，挑镜头停住或很慢的地方量。
import { chromium } from 'playwright-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const ROOT = path.resolve(a[0] || '.'), t0 = +a[1], n = +(a[2] && !a[2].startsWith('--') ? a[2] : 8), fps = +opt('fps', 24);
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json' };
const sv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise((r) => sv.listen(0, '127.0.0.1', r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } }); p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(`http://127.0.0.1:${sv.address().port}/film.html?render${opt('q') ? '&' + opt('q') : ''}`); await p.waitForFunction('window.READY === true', null, { timeout: 60000 });
const means = [];
for (let i = 0; i < n; i++) means.push(await p.evaluate(async (t) => { await window.render(t); const gl = window.stage.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); let s = 0; for (let k = 0; k < px.length; k += 4) s += .2126 * px[k] + .7152 * px[k + 1] + .0722 * px[k + 2]; return s / (w * h); }, t0 + i / fps));
const d = means.slice(1).map((m, i) => Math.abs(m - means[i])), worst = Math.max(...d);
console.log(`从 ${t0} 秒起 ${n} 帧（${fps} 帧/秒）：平均亮度 ${means.map((m) => m.toFixed(2)).join(' ')}`);
console.log(`相邻两帧的亮度差：${d.map((x) => x.toFixed(3)).join(' ')}；最大 ${worst.toFixed(3)}，${worst < .1 ? '不抖' : '超过 0.1，查一下'}`);
await b.close(); sv.close();
