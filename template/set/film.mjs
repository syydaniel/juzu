// 渲整片：把全片切成小块，几个无头浏览器同时渲，最后无损拼起来。中途断了重跑同一条命令就行，已经渲好的小块会跳过。
//   node film.mjs --tag s1080 --to 180              前三分钟样片，1080
//   node film.mjs --4k                              整片 4K（3840×2160），输出 ../out/film_4k.mp4
//   node film.mjs [--size 1920x1080] [--fps 24] [--from 秒] [--to 秒] [--chunk 12] [--jobs 3] [--tag 名字] [--q "ns=16"] [--out 文件]
// 4K 时每块的秒数自动除以 4（块数乘 4）：每个浏览器活得短一些，不容易遇到「显卡上下文丢了」。只改分块，不改画面。
// 小块编码成 bt709 视频范围（render.mjs 里），拼接时不再转码。夜里长时间渲染时加 caffeinate -i，防止电脑睡着。
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; }, has = (k) => a.includes('--' + k);
const TL = JSON.parse(fs.readFileSync(path.join(ROOT, '../app/src/timeline.json'), 'utf8'));
const k4 = has('4k'), size = opt('size', k4 ? '3840x2160' : '1920x1080'), big = +size.split('x')[1] >= 2000;
const fps = +opt('fps', 24), tag = opt('tag', k4 ? '4k' : size.split('x')[1]), chunk = +opt('chunk', big ? 3 : 12), N = +opt('jobs', 3);
if (TL.draft) console.log('注意：时间线还是草稿（按字数估的），配完音要重跑 timeline 和 mk_tl.py 再出片');
const F = (t) => Math.round(t * fps), f0 = F(+opt('from', 0)), f1 = F(+opt('to', TL.duration));
const dir = path.join(ROOT, `../out/seg/${tag}`); fs.mkdirSync(dir, { recursive: true });
const jobs = []; for (let x = f0; x < f1; x += Math.round(chunk * fps)) { const z = Math.min(f1, x + Math.round(chunk * fps)); jobs.push({ x, z, file: `${dir}/${String(x).padStart(6, '0')}_${String(z).padStart(6, '0')}.mp4` }); }
const todo = jobs.filter((j) => !(fs.existsSync(j.file) && fs.statSync(j.file).size > 1000));
const total = todo.reduce((n, j) => n + j.z - j.x, 0); let done = 0; const t0 = Date.now();   // Date.now 只用来报进度，不进画面
console.log(`${jobs.length} 块（每块 ${chunk} 秒），其中 ${todo.length} 块要渲，${total} 帧，${size} @ ${fps}，同时 ${N} 个`);
const run = (j) => new Promise((res, rej) => { const part = j.file.replace(/\.mp4$/, '.part.mp4');
  const args = ['render.mjs', '--page', 'film.html', '--fps', String(fps), '--size', size, '--from', String(j.x / fps), '--to', String(j.z / fps), '--out', part];
  if (opt('q')) args.push('--q', opt('q'));
  const p = spawn('node', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
  p.on('close', (code) => { if (code !== 0 || !fs.existsSync(part)) return rej(new Error('这一块失败了：' + j.file)); fs.renameSync(part, j.file); done += j.z - j.x;
    console.log(`${path.basename(j.file)}  已完成 ${(100 * done / total).toFixed(1)}%  平均 ${((Date.now() - t0) / done).toFixed(0)} 毫秒/帧  还要约 ${((total - done) * (Date.now() - t0) / done / 60000).toFixed(0)} 分钟`); res(); }); });
const q = [...todo]; await Promise.all(Array.from({ length: N }, async () => { while (q.length) await run(q.shift()); }));
const list = `${dir}/list.txt`; fs.writeFileSync(list, jobs.map((j) => `file '${path.resolve(j.file)}'`).join('\n') + '\n');
const out = opt('out', path.join(ROOT, `../out/film_${tag}.mp4`));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
console.log('拼好了：', out, jobs.reduce((n, j) => n + j.z - j.x, 0), '帧');
