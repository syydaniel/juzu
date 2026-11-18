// 颜色有语义：金 = 人声（嘴、电平表），青 = 工具（耳朵亮、听），朱红 = AI 味（也是天线灯）。
// 几套配色：PAL_DARK 暗色、PAL_PAPER 亮色纸面、PAL_STAGE 夜场、PAL_LAB 深蓝夜（片场默认用它）。最下面的 PAL 决定小机器人用哪一套。
export const PAL_DARK = {
  bg: '#0E1A1D', bgLift: '#16292D', bgDeep: '#071012', ink: '#1F1D1A', shell: '#FFFDF8', screen: '#121719', dark: '#23272B',
  eye: '#F4EFE5', gold: '#F2C36B', goldText: '#F2C36B', teal: '#7FE6D8', tealText: '#7FE6D8', red: '#E0442E', heart: '#FF6F61', blush: '#FF8A7A',
  text: '#E9F1EE', textSoft: 'rgba(233,241,238,0.62)', line: 'rgba(214,236,232,0.14)', card: '#132326', light: false,
};
export const PAL_PAPER = {
  bg: '#EFE9DE',
  bgLift: '#FAF7F1',
  bgDeep: '#E2DACB',
  ink: '#1F1D1A',
  shell: '#FFFDF8',
  screen: '#121719',
  dark: '#23272B', // 脖子、天线杆、脚
  eye: '#F4EFE5',
  gold: '#E8A02E', // 线和填充
  goldText: '#B26F08', // 亮底上的金色字
  teal: '#12A08F',
  tealText: '#0B7D70',
  red: '#E0442E',
  heart: '#FF6F61',
  blush: '#FF8A7A',
  text: '#1D2A2E',
  textSoft: 'rgba(29,42,46,0.58)',
  line: 'rgba(29,42,46,0.12)',
  card: '#FFFFFF',
  light: true,
};

// 夜场：黑底 + 粉笔白线 + 金色高亮。
// 金 = 重点 / 人声，青 = 工具 / 网页，朱红 = 点赞和提醒（也是天线灯）。
export const PAL_STAGE = {
  bg: '#07080B',
  bgLift: '#12151C',
  bgDeep: '#020203',
  ink: '#16181C',
  shell: '#FFFDF8',
  screen: '#121719',
  dark: '#23272B',
  eye: '#F4EFE5',
  gold: '#F2C36B',
  goldText: '#F6CB7A',
  teal: '#7FE6D8',
  tealText: '#8CEBDD',
  red: '#E8553D',
  heart: '#FF6F61',
  blush: '#FF8A7A',
  text: '#EFE8D8',
  textSoft: 'rgba(239,232,216,0.62)',
  line: 'rgba(239,232,216,0.16)',
  card: '#0E1116',
  chalk: '#EFE8D8',
  stage: '#3D63C9',
  leather: '#141416',
  light: false,
};
// 深蓝夜：深蓝黑底，金 = 重点和小机器人的手势，青 = 工具和终端，朱红 = 看错的地方，绿 = 判对。
export const PAL_LAB = {
  ...PAL_STAGE,
  bg: '#0B1016',
  bgLift: '#17222E',
  bgDeep: '#04070A',
  gold: '#FFB23F',
  goldText: '#FFC261',
  teal: '#5CE1E6',
  tealText: '#7FEAEE',
  red: '#FF5B4A',
  green: '#4BD48A',
  text: '#EAF0F4',
  textSoft: 'rgba(234,240,244,0.62)',
  line: 'rgba(234,240,244,0.14)',
  card: '#101820',
  chalk: '#EAF0F4',
};
export const PAL = PAL_LAB;

export const FONT = {
  title: '"Songti SC", "Noto Serif SC", serif',
  ui: '"PingFang SC", "Noto Sans SC", sans-serif',
  mono: '"JetBrains Mono", "SF Mono", Menlo, monospace',
  hand: '"Kalam", "Xiaolai SC", "Xiaolai", cursive',
  handZh: '"Xiaolai SC", "Xiaolai", "Kalam", cursive',
  serif: '"Noto Serif SC", "Songti SC", serif',
  black: '"Noto Sans SC Black", "PingFang SC", sans-serif',
};
