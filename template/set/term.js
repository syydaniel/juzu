// 在画布上画一屏终端。数据来自 rec/snap.py：{w, h, screens, at}，每行是 [文字, 前景, 背景, 粗体, 起始列] 的片段。
// 宽字符（中文、全角符号、部分图形符号）占两列。只依赖传进来的录屏时刻，不保留状态。
const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;
export const BG = '#141414', FG = '#e6e6e6';
const MONO = 'Menlo, "SF Mono", monospace', CJK = '"PingFang SC", "Hiragino Sans GB", sans-serif';

export function screenAt(data, castT) {               // 录屏第 castT 秒时的那一屏（取不晚于它的最后一个采样）
  const at = data.at; let lo = 0, hi = at.length - 1;
  if (castT <= at[0][0]) return data.screens[at[0][1]];
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (at[m][0] <= castT) lo = m; else hi = m - 1; }
  return data.screens[at[lo][1]];
}

// 把一屏画进 (x, y, w, h)。opt.rows：只画哪几行（[起, 止)），用来放大局部；opt.hl：要高亮的行号列表。
export function drawTerm(g, rows, x, y, w, h, cols, opt = {}) {
  const r0 = opt.rows ? opt.rows[0] : 0, r1 = opt.rows ? opt.rows[1] : rows.length, n = r1 - r0;
  const cw = w / cols, ch = h / n, fs = Math.min(ch / 1.22, cw / .602);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = opt.bg || BG; g.fillRect(x, y, w, h);
  g.textBaseline = 'middle';
  for (let r = r0; r < r1; r++) {
    const line = rows[r] || [], yy = y + (r - r0) * ch;
    if (opt.hl && opt.hl.includes(r)) { g.fillStyle = 'rgba(255,196,92,.16)'; g.fillRect(x, yy, w, ch); }
    if (opt.find) { let txt = '', cols = [], cc = 0; for (const [tx, , , , col] of line) { let c = col; while (cc < c) { txt += ' '; cols.push(cc); cc++; } for (const s of tx) { txt += s; cols.push(c); c += WIDE.test(s) ? 2 : 1; } cc = c; }
      for (const f of opt.find) { if (opt.found[f] ) continue; const i = txt.indexOf(f); if (i < 0) continue;   // 屏幕上第一次出现这段字的位置，给高亮和放大镜用
        const c0 = cols[i], last = i + f.length - 1, c1 = cols[last] + (WIDE.test(txt[last]) ? 2 : 1); opt.found[f] = [x + c0 * cw, yy, (c1 - c0) * cw, ch]; } }
    for (const [text, fg, bg, bold, col] of line) {
      let c = col;
      for (const s of text) {
        const wide = WIDE.test(s), cx = x + c * cw;
        if (bg && bg !== 'default') { g.fillStyle = '#' + bg; g.fillRect(cx, yy, cw * (wide ? 2 : 1) + .5, ch + .5); }
        if (s !== ' ') {
          g.fillStyle = fg && fg !== 'default' ? (fg[0] === '#' ? fg : (/^[0-9a-f]{6}$/i.test(fg) ? '#' + fg : NAMED[fg] || FG)) : FG;
          g.font = `${bold ? 600 : 400} ${wide ? fs * .98 : fs}px ${wide ? CJK : MONO}`;
          if (/[▐▛█▜▀▝▘▗▖▙▟▌▄]/.test(s)) block(g, s, cx, yy, cw, ch);       // 方块字符自己画，字体里的大小对不齐
          else g.fillText(s, cx, yy + ch * .54);
        }
        c += wide ? 2 : 1;
      }
    }
  }
  g.restore();
}
const NAMED = { black: '#3a3a3a', red: '#ff6b6b', green: '#7ad39b', brown: '#e5c07b', yellow: '#e5c07b', blue: '#6cb6ff', magenta: '#d38aea', cyan: '#56d4dd', white: '#e6e6e6' };
function block(g, s, x, y, w, h) {                     // 半块和象限字符
  const q = { '█': [1, 1, 1, 1], '▀': [1, 1, 0, 0], '▄': [0, 0, 1, 1], '▌': [1, 0, 1, 0], '▐': [0, 1, 0, 1], '▘': [1, 0, 0, 0], '▝': [0, 1, 0, 0], '▖': [0, 0, 1, 0], '▗': [0, 0, 0, 1],
    '▛': [1, 1, 1, 0], '▜': [1, 1, 0, 1], '▙': [1, 0, 1, 1], '▟': [0, 1, 1, 1] }[s] || [0, 0, 0, 0];
  const hw = w / 2, hh = h / 2;
  q.forEach((on, i) => { if (on) g.fillRect(x + (i % 2) * hw, y + (i >> 1) * hh, hw + .5, hh + .5); });
}
