// 小机器人的三维身体。改了 char/ 里的任何文件，在 set/ 里跑 npm run kaka，重新打包成 set/kaka.js 给片场用。
export {makeRig, applyState, STATE0, REST_ARM, DIM} from './rig';
export {FACES, face, mixFace, FACE0, SILENT} from './face';
export {POSES, P0, REST, trackAt, blinkAt, breathAt, LAG, mixObj} from './poses';
export * as MATH from './math';
