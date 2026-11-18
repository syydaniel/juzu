// 在片场页面里查一个值：node tools/dbg.mjs "$PWD" "表达式"
// 例：node tools/dbg.mjs "$PWD" "TL.lines.b03.start"     node tools/dbg.mjs "$PWD" "film.poseAt(12).p"
import { chromium } from 'playwright-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = path.resolve(process.argv[2] || '.');
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json' };
const sv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise((r) => sv.listen(0, '127.0.0.1', r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 640, height: 360 } }); p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(`http://127.0.0.1:${sv.address().port}/film.html?render&ns=1`); await p.waitForFunction('window.READY === true', null, { timeout: 60000 });
console.log(JSON.stringify(await p.evaluate(process.argv[3]), null, 1));
await b.close(); sv.close();
