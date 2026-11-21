// 四层背景声（amb4.py）要用的时刻：从这一集的导演表导出来 → out/amb4_shots.json（换光、小卡起跳落地、相框换表情、台词起止、章节）
//   juzu amb4_dump    （amb4 会先自己跑一遍；在这一集的目录里跑，或者设 JUZU_EP）
import fs from 'fs'; import vm from 'vm'; import path from 'path';
const EP = path.resolve(process.env.JUZU_EP || process.cwd()), SET = path.join(EP, 'set');
globalThis.window = globalThis; globalThis.document = { createElement: () => ({ getContext: () => ({}) }) };
vm.runInThisContext(fs.readFileSync(SET + '/tl.js', 'utf8'));
const { TX, TL } = await import('file://' + SET + '/kit.js');
const S = (await import('file://' + SET + '/shots.js')).default({ TX, TL });
const out = {
  dur: TL.duration,
  light: S.LIGHT.map((k) => ({ t: TX(k.at), p: k.p, d: k.d ?? 4 })),
  hops: S.KAKA.filter((k) => k.hop).map((k) => +(TX(k.at) + .5).toFixed(3)),
  whale: (S.WHALE || []).map((k) => ({ t: TX(k.at), face: k.face })),
  lines: Object.entries(TL.lines).map(([k, l]) => [k, l.start, l.end]),
  chapters: (S.CHAPTERS || []).map((c) => TX(c.at)),
};
fs.writeFileSync(path.join(EP, 'out/amb4_shots.json'), JSON.stringify(out));
console.log('换光', out.light.length, '处；起跳', out.hops.length, '次；台词', out.lines.length, '句 → out/amb4_shots.json');
