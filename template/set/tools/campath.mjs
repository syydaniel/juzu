// 自检：逐帧读出机位（位置、看向、对焦距离、焦距），找「来回推拉」：一个镜头里或者滑过去的时候，离看向点的距离先近后远、
// 对焦距离先变近再变远，或者两帧之间突然跳一下（不在硬切上）。用法：node tools/campath.mjs [--fps 24]
import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const a = process.argv.slice(2), fps = +(a[a.indexOf('--fps') + 1] || 24);
const server = http.createServer((req, res) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.error('[page error]', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/film.html?render&ns=1`); await page.waitForFunction('window.READY === true', null, { timeout: 60000 });
const out = await page.evaluate((fps) => { const f = window.film, N = Math.floor(f.DUR * fps), R = [];
  for (let i = 0; i < N; i++) { const t = i / fps, p = f.poseAt(t); const fwd = p.l.clone().sub(p.p).normalize(); R.push([t, p.p.x, p.p.y, p.p.z, p.focus.clone().sub(p.p).dot(fwd), p.mm, p.f]); }
  return { R, cuts: f.cams.map((c) => [c.t, c.d ?? 2.2, c.cam]) }; }, fps);
await browser.close(); server.close();
fs.writeFileSync(path.join(ROOT, '../out/campath.json'), JSON.stringify(out));
console.log('frames', out.R.length, '→ out/campath.json');
