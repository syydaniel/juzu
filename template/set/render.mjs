// 逐帧出片和抽帧拼图。three.js 用 ES 模块，file:// 下加载不稳，所以先起一个只服务本目录的本地小服务器，再用无头 Chrome 打开页面。
//   node render.mjs --page film.html --sheet 2,30,61.5 [--cols 4] [--w 640] [--q ns=4] [--out x.jpg]     抽几帧拼成一张联系表
//   node render.mjs --page film.html [--fps 24] [--size 1920x1080] [--from 0] [--to 秒] [--q "ns=16"] [--out out.mp4]   出一段视频
// Chrome 的位置：环境变量 CHROME，不设就用 macOS 的默认位置。
// 视频直接编码成 bt709 视频范围（达芬奇按这个读，不会整体变暗）。
import { chromium } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import http from 'node:http'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const fps = +opt('fps', 30), [w, h] = opt('size', '1920x1080').split('x').map(Number);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: CHROME, headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
page.on('pageerror', e => { console.error('[page error]', e.message); process.exitCode = 1; });
page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/404/.test(m.text())) console.error('[console]', m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/${opt('page', 'film.html')}?render${opt('q') ? '&' + opt('q') : ''}`);
await page.waitForFunction('window.READY === true', null, { timeout: 60000 });
const DUR = await page.evaluate(() => window.DUR);
const shot = async (t) => { await page.evaluate(t => window.render(t), t); return page.screenshot({ type: 'jpeg', quality: 95 }); };
if (opt('sheet')) {
  const ts = opt('sheet').split(',').map(Number), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sheet-'));
  for (let i = 0; i < ts.length; i++) fs.writeFileSync(`${dir}/${String(i).padStart(3, '0')}.jpg`, await shot(ts[i]));
  const cols = Math.min(+opt('cols', 3), ts.length), rows = Math.ceil(ts.length / cols), out = opt('out', 'sheet.jpg');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', `${dir}/%03d.jpg`, '-vf', `scale=${opt('w', 640)}:-1,tile=${cols}x${rows}`, '-frames:v', '1', out]);
  fs.rmSync(dir, { recursive: true }); console.log('wrote', out, JSON.stringify(await page.evaluate(() => window.STATS())));
} else {
  const from = +opt('from', 0), to = +opt('to', DUR), out = opt('out', 'out.mp4');
  // 截图是 JPEG（全范围、bt601）。先按它本来的样子转成 RGB，再编码成 bt709 视频范围。
  // setparams 把颜色标签贴到每一帧上；只靠后面的 -color_* 参数，新版 ffmpeg 会漏写原色和传递函数
  const vf = 'scale=in_range=full:in_color_matrix=bt601,format=rgb24,scale=out_range=tv:out_color_matrix=bt709,format=yuv420p,setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709';
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-vf', vf,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n0 = Math.round(from * fps), n1 = Math.round(to * fps), t0 = Date.now();
  for (let i = n0; i < n1; i++) {                       // 第 i 帧永远是 render(i / fps)，和机器快慢无关
    const buf = await shot(i / fps);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log(`wrote ${out}: ${n1 - n0} frames, ${((Date.now() - t0) / Math.max(1, n1 - n0)).toFixed(0)} ms/frame`);
}
await browser.close(); server.close();
