// 桌上扣着的手机翻过来亮屏，显示一点东西（评论区、聊天）。翻面照迪士尼动画十二法则做。
// 导演表 PHONE：[{ at: 开始翻的时刻, t1: 收（硬切那一刻扣回去）, back: 可选，镜头里翻回去的时刻, kind: 'comments' | 'chat', title, sub, ... }]
//   comments：lines: [{ at }]（每条评论进来的时刻，只画轮廓，不编具体的评论），hl: { at, text }（最后一条金边，写着要点）
//   chat：lines: [{ who: 'me' | 'ai', text, at, typing }]（我发的在右边，对面的在左边，先打一会儿点点点再出字）
// 一次翻面拆成这几拍（秒，相对 at）：
//   -0.60 到 -0.20  预备 1：来消息，震两下（短促的左右抖，带一点转），手机像是被「叫醒」的
//   -0.15 到  0     预备 2：往反方向歪一点点（一条长边压下去），蓄力
//    0    到  0.52 翻：绕长轴转半圈，重心走一条抛物线（中间最快，两头慢），空中顺带转 8° 落地，不是原地硬翻
//    0.52 到  0.90 落地的跟随动作：先一条边着地，弹一下、晃两下停住（幅度一次比一次小）
//    0.60 起        次要动作：屏幕晚半拍亮起来，内容再一条条进来，进来的那一条右下角的心跳一下
// 刚体不做挤压拉伸，靠弹跳和晃动的衰减表现重量。只依赖 t。
import * as THREE from 'three';
import { clamp, ease, ease5, easeOut, easeIO, P } from './kit.js';

const SANS = '"PingFang SC", -apple-system, "Helvetica Neue", sans-serif';
const GOLD = '#e9b65c';
const W = 800, H = 1690;                                       // 屏幕画布，和屏幕同比例（6.75 × 14.27 厘米）

export class Phone {
  constructor(stage, set, extras, list, TX) {
    this.stage = stage; this.TX = TX; const ph = this.ph = set.phone, D = set.DIM.phone; this.D = D;
    this.items = (list || []).map((x) => ({ ...x, at: TX(x.at), t1: TX(x.t1), back: x.back !== undefined ? TX(x.back) : null,
      ats: (x.lines || []).map((l) => TX(l.at)), hlAt: x.hl ? TX(x.hl.at) : null }));
    if (!ph) return;
    if (extras?.phoneSticker) ph.attach(extras.phoneSticker);  // 背面的贴纸跟着手机一起翻
    // 转轴放在机身正中：把原来的零件都挪进 body，body 抬到半个机身厚
    const body = this.body = new THREE.Group(); body.position.y = D.t / 2;
    for (const c of [...ph.children]) { body.add(c); c.position.y -= D.t / 2; }
    ph.add(body);
    // 屏幕：贴在原来朝下的那一面（扣着的时候藏在桌面下面），翻过来以后朝上
    const c = this.canvas = document.createElement('canvas'); c.width = W; c.height = H;
    const tex = this.tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    this.mat = new THREE.MeshStandardMaterial({ color: 0x060708, roughness: .12, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 });
    const scr = this.scr = new THREE.Mesh(new THREE.PlaneGeometry(D.w - .004, D.l - .004), this.mat);
    scr.rotation.set(Math.PI / 2, 0, Math.PI); scr.position.y = -D.t / 2 - .00025; scr.castShadow = false; scr.receiveShadow = false; body.add(scr);
    this.lastDraw = null;
  }

  // 机身中心离桌面多高才不会穿进桌子：绕长轴转了 th 以后最低点
  contact(th) { const D = this.D; return (D.w / 2) * Math.abs(Math.sin(th)) + (D.t / 2) * Math.abs(Math.cos(th)); }

  // 一次翻面（从 a 转到 a + π），返回 { th, y, x, yaw }
  flip(t, t0, a, o = {}) {
    const H0 = o.h ?? .05, twist = o.twist ?? .14;
    let th = a, y = 0, x = 0, yaw = 0, rz = 0;
    if (t >= t0 - .6 && t < t0 - .2) {                         // 震两下
      for (const c of [t0 - .5, t0 - .3]) { const e = Math.max(0, 1 - Math.abs(t - c) / .07); x += .0007 * e * Math.sin((t - c) * 2 * Math.PI * 38); yaw += .012 * e * Math.sin((t - c) * 2 * Math.PI * 31); } }
    if (t >= t0 - .15 && t < t0) th = a - .07 * ease(P(t, t0 - .15, .15));             // 往反方向歪一点，蓄力
    if (t >= t0) {
      const u = P(t, t0, .52), s = ease5(u);
      th = a - .07 + (Math.PI + .07) * s; y = H0 * Math.sin(Math.PI * u) ** .85; x = (o.side ?? .006) * Math.sin(Math.PI * u);
      yaw = twist * easeIO(u);
      if (t >= t0 + .52) {                                       // 落地：弹一下、晃两下
        const v = P(t, t0 + .52, .38); th = a + Math.PI; y = .0035 * Math.abs(Math.sin(Math.PI * 1.6 * v)) * (1 - v) ** 2; x = 0; yaw = twist;
        rz = .045 * Math.sin(2 * Math.PI * 1.4 * v) * (1 - v) ** 2; }
    }
    return { th: th + rz, y, x, yaw };
  }

  update(t) {
    if (!this.body) return;
    const it = this.items.find((x) => t >= x.at - .7 && t < x.t1), b = this.body, D = this.D;
    if (!it) { b.position.set(0, D.t / 2, 0); b.rotation.set(0, 0, 0); this.mat.emissiveIntensity = 0; return; }
    let f = this.flip(t, it.at, 0);
    if (it.back !== null && t >= it.back - .2) { const g = this.flip(t, it.back, Math.PI, { h: .035, twist: -.14 }); f = { ...g, yaw: .14 + g.yaw }; }
    b.position.set(f.x, this.contact(f.th) + f.y, 0); b.rotation.set(0, f.yaw, f.th, 'YXZ');
    // 屏幕晚半拍亮；翻回去之前先暗
    const on = Math.min(easeOut(P(t, it.at + .6, .35)), it.back !== null ? 1 - ease(P(t, it.back - .45, .3)) : 1);
    const ex = this.stage.exposure || .5; this.mat.emissiveIntensity = on * 1.0 / ex;   // 不另外放灯：屏幕正上方的小灯会在玻璃上反出一个亮点
    if (on > 0) this.draw(it, t, on);
  }

  // ---------- 屏幕上画什么 ----------
  draw(it, t, on) {
    const g = this.canvas.getContext('2d'), key = Math.round(t * 48); if (this.lastDraw === key) return; this.lastDraw = key;
    g.fillStyle = '#0c0e12'; g.fillRect(0, 0, W, H);
    // 顶上的状态条：刘海、电量、信号（不写时间）
    g.fillStyle = '#000'; this.rr(g, W / 2 - 110, 22, 220, 58, 29); g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)'; this.rr(g, W - 120, 40, 58, 26, 7); g.fill(); g.fillRect(W - 60, 47, 5, 12);
    for (let i = 0; i < 4; i++) g.fillRect(60 + i * 16, 62 - i * 7, 10, 8 + i * 7);
    g.save(); g.globalAlpha = clamp((t - it.at - .65) / .3);
    if (it.kind === 'comments') this.comments(g, it, t); else if (it.kind === 'chat') this.chat(g, it, t);
    g.restore();
    this.tex.needsUpdate = true;
  }
  rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  header(g, title, sub) {
    g.fillStyle = '#f3f1ec'; g.font = `700 58px ${SANS}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(title, 60, 170);
    if (sub) { g.fillStyle = 'rgba(243,241,236,.45)'; g.font = `500 34px ${SANS}`; g.fillText(sub, 60, 232); }
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 280, W, 2);
  }
  // 评论区：一条条从下面顶上来（只画轮廓，不编具体的评论），最后一条金边的写着要点
  comments(g, it, t) {
    this.header(g, it.title ?? '评论区', it.sub);
    const n = it.ats.length, cardH = 250, gap = 26, y0 = 330;
    it.ats.forEach((a, i) => {
      const u = easeOut(P(t, a, .45)); if (u <= 0) return;
      const y = y0 + i * (cardH + gap) + (1 - u) * 160, hl = i === n - 1 && it.hl;
      g.save(); g.globalAlpha *= u;
      g.fillStyle = hl ? 'rgba(233,182,92,.13)' : 'rgba(255,255,255,.055)'; this.rr(g, 40, y, W - 80, cardH, 30); g.fill();
      if (hl) { g.strokeStyle = GOLD; g.lineWidth = 4; this.rr(g, 40, y, W - 80, cardH, 30); g.stroke(); }
      const col = ['#7aa6d8', '#d89a7a', '#8fc29a', '#c9a6e0', GOLD][i % 5];
      g.fillStyle = col; g.beginPath(); g.arc(110, y + 70, 36, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; this.rr(g, 170, y + 52, 180, 30, 15); g.fill();
      if (hl) { const p = clamp((t - it.hlAt) / .5); g.fillStyle = '#f6efe0'; g.font = `700 50px ${SANS}`; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText(it.hl.text, 80, y + 160); g.fillStyle = GOLD; g.fillRect(80, y + 200, g.measureText(it.hl.text).width * easeOut(p), 7); }
      else { g.fillStyle = 'rgba(255,255,255,.18)'; this.rr(g, 80, y + 128, W - 240 - (i * 70) % 160, 26, 13); g.fill(); this.rr(g, 80, y + 176, 260 + (i * 90) % 200, 26, 13); g.fill(); }
      // 右下角一颗小心，进来以后跳一下
      const hp = P(t, a + .35, .35), s = 1 + .35 * Math.sin(Math.PI * hp) * (hp < 1 ? 1 : 0);
      g.save(); g.translate(W - 110, y + cardH - 50); g.scale(s, s); g.fillStyle = hp > 0 ? '#ef6a5b' : 'rgba(255,255,255,.25)';
      g.beginPath(); g.moveTo(0, 12); g.bezierCurveTo(-30, -8, -14, -30, 0, -14); g.bezierCurveTo(14, -30, 30, -8, 0, 12); g.fill(); g.restore();
      g.restore();
    });
  }
  // 对话：我发的在右边，对面（who: 'ai'）的在左边；对面先打一会儿点点点再出字
  chat(g, it, t) {
    this.header(g, it.title ?? '对话', it.sub);
    let y = 330;
    it.lines.forEach((l, i) => {
      const a = it.ats[i], typing = l.who === 'ai' ? (l.typing ?? .8) : 0, u = easeOut(P(t, a, .35)); if (u <= 0) return;
      g.font = `500 44px ${SANS}`; const lines = this.wrap(g, l.text, 470), bw = Math.max(...lines.map((s) => g.measureText(s).width)) + 70, bh = lines.length * 62 + 50;
      const me = l.who === 'me', x = me ? W - 50 - bw : 50, show = t >= a + typing;
      g.save(); g.globalAlpha *= u; g.translate(0, (1 - u) * 40);
      g.fillStyle = me ? '#e9b65c' : 'rgba(255,255,255,.1)';
      if (!show) { this.rr(g, x, y, 190, 100, 40); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; for (let k = 0; k < 3; k++) { const ph = Math.sin((t - a) * 9 - k * .9) * .5 + .5; g.globalAlpha = (.35 + .65 * ph) * u; g.beginPath(); g.arc(x + 55 + k * 40, y + 50, 11, 0, 7); g.fill(); } g.restore(); y += 130; return; }
      this.rr(g, x, y, bw, bh, 36); g.fill();
      g.fillStyle = me ? '#1b1712' : '#f1eee8'; g.textAlign = 'left'; g.textBaseline = 'top'; lines.forEach((s, k) => g.fillText(s, x + 35, y + 26 + k * 62));
      g.restore(); y += bh + 34;
    });
  }
  wrap(g, s, max) { const out = []; let cur = ''; for (const ch of s) { if (g.measureText(cur + ch).width > max && cur) { out.push(cur); cur = ch; } else cur += ch; } if (cur) out.push(cur); return out; }
}
