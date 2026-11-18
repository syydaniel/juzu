// 重画屏幕里的 2D 小机器人（media/kaka.png）。改了 char/*.ts 或者 KAKA_LOOK 以后跑一次：
//   node tools/kaka_png.mjs "$PWD" [--pose thumbsUp] [--face happy] [--yaw -18] [--look '{"shell":"#cfe3f1"}'] [--out media/kaka.png]
// 姿势和表情的名字见 reference/导演表.md。图是透明底，645×700，和原来那张一样大。
import { chromium } from 'playwright-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const ROOT = path.resolve(a[0] && !a[0].startsWith('--') ? a[0] : '.'), out = path.resolve(ROOT, opt('out', 'media/kaka.png'));
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json' };
const sv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise((r) => sv.listen(0, '127.0.0.1', r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 645, height: 700 } }); p.on('pageerror', (e) => console.log('ERR', e.message));
const qs = new URLSearchParams({ pose: opt('pose', 'thumbsUp'), face: opt('face', 'happy'), yaw: opt('yaw', '-18'), ...(opt('look') ? { look: opt('look') } : {}) });
await p.goto(`http://127.0.0.1:${sv.address().port}/kaka.html?${qs}`); await p.waitForFunction('window.READY === true', null, { timeout: 60000 });
await p.screenshot({ path: out, omitBackground: true });
console.log('wrote', path.relative(ROOT, out));
await b.close(); sv.close();
