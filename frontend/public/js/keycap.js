'use strict';
/**
 * 键帽类型统计与尺寸规格 —— 按 KeyV2 源码参数体系重构
 *
 * 数据来源：
 * - KeyV2（rsheldiii/KeyV2，OpenSCAD 最知名开源键帽库）src/key_profiles/*.scad 逐行照抄：
 *   $bottom_key_width / $bottom_key_height（底面 1u）
 *   $width_difference / $height_difference（顶面 = 底面 - 差值）
 *   $total_depth（总高，顶面 placement 高度）与 $top_tilt（顶面倾角，按行）
 *   $top_skew（顶面后移）、$dish_type / $dish_depth（顶面形态与挖入深度）
 *   $corner_radius、$height_slices（层数）、$side_sculpting（侧面桶形雕刻）
 * - XDA / MDA / KAT 为 KeyV2 未收录的社区 Profile，按社区通用规格映射到同一参数体系
 *
 * 三维模型配置：见 keycapGeo.js（KeyV2 多层截面建模）/ keycapStl.js（后端 STL 生成）
 */

/** 键帽高度 Profile（KeyV2 行参数：R1=row1、R2=row2、R3=row3、R4=row4） */
const KEYCAP_PROFILES = {
  sa: {
    name: 'SA（超高球形，复古）',
    type: 'sculpted',
    bottomKeyWidth: 18.4, bottomKeyHeight: 18.4,
    widthDiff: 5.7, heightDiff: 5.7,
    dishType: 'spherical', dishDepth: 0.85,
    topSkew: 0, cornerRadius: 1, heightSlices: 10,
    sideSculptFactor: 4.5, moreSideSculpt: 0.4, cornerSculptFactor: 1,
    rows: { R1: 14.89, R2: 12.925, R3: 12.5, R4: 12.925 },
    angle: { R1: -13, R2: -7, R3: 0, R4: 7 },
    sound: '极高·深共鸣',
    material: ['ABS', 'PBT'],
    note: 'KeyV2 源码：打字机复古观感，指腹承托好，手腕易累',
  },
  oem: {
    name: 'OEM（原厂高度，量产标配）',
    type: 'sculpted',
    bottomKeyWidth: 18.05, bottomKeyHeight: 18.05,
    widthDiff: 5.8, heightDiff: 4,
    dishType: 'cylindrical', dishDepth: 1,
    topSkew: 1.75, cornerRadius: 1, heightSlices: 1,
    sideSculptFactor: 0, moreSideSculpt: 0, cornerSculptFactor: 0,
    rows: { R1: 11.2, R2: 9.45, R3: 9, R4: 9.25 },
    angle: { R1: -3, R2: 1, R3: 6, R4: 9 },
    sound: '中高·清脆',
    material: ['ABS', 'PBT'],
    note: 'KeyV2 源码：市售成品键盘默认高度，最易上手',
  },
  cherry: {
    name: 'Cherry（原厂，客制化主流）',
    type: 'sculpted',
    bottomKeyWidth: 18.16, bottomKeyHeight: 18.16,
    widthDiff: 6.31, heightDiff: 3.52,
    dishType: 'cylindrical', dishDepth: 0.65,
    topSkew: 2, cornerRadius: 1, heightSlices: 1,
    sideSculptFactor: 0, moreSideSculpt: 0, cornerSculptFactor: 0,
    rows: { R1: 9.8, R2: 7.45, R3: 6.55, R4: 7.35 },
    angle: { R1: 0, R2: 2.5, R3: 5, R4: 11.5 },
    sound: '低·厚实（thock）',
    material: ['ABS', 'PBT'],
    note: 'KeyV2 源码（GMK 数据）：高端套件主力',
  },
  dsa: {
    name: 'DSA（低矮，球形）',
    type: 'uniform',
    bottomKeyWidth: 18.24, bottomKeyHeight: 18.24,
    widthDiff: 6, heightDiff: 6,
    dishType: 'spherical', dishDepth: 1.2,
    topSkew: 0, cornerRadius: 1, heightSlices: 10,
    sideSculptFactor: 4.5, moreSideSculpt: 0.4, cornerSculptFactor: 1,
    rows: { R1: 11.6, R2: 9.1, R3: 8.1, R4: 9.1 },
    angle: { R1: -14, R2: -7, R3: 0, R4: 7 },
    sound: '轻·高亢',
    material: ['PBT', 'ABS'],
    note: 'KeyV2 源码（含 depth_raisers 行差）：Ortho/自定义配列首选',
  },
  mt3: {
    name: 'MT3（超高深凹，IBM 风格）',
    type: 'sculpted',
    bottomKeyWidth: 18.35, bottomKeyHeight: 18.6,
    widthDiff: 5.35, heightDiff: 5.6,
    dishType: 'squared spherical', dishDepth: 1.2,
    topSkew: 0, cornerRadius: 0.0125, heightSlices: 10,
    sideSculptFactor: 4.5, moreSideSculpt: 0.75, cornerSculptFactor: 2,
    rows: { R1: 13.1, R2: 10.7, R3: 10.7, R4: 11.6 },
    angle: { R1: -6, R2: -6, R3: 6, R4: 12 },
    sound: '极高·深共鸣',
    material: ['PBT', 'ABS'],
    note: 'KeyV2 源码（近似克隆）：Drop 独占，指位锁定感强',
  },
  dcs: {
    name: 'DCS（中高圆柱，经典复古）',
    type: 'sculpted',
    bottomKeyWidth: 18.16, bottomKeyHeight: 18.16,
    widthDiff: 6, heightDiff: 4,
    dishType: 'cylindrical', dishDepth: 0.5,
    topSkew: 1.75, cornerRadius: 1, heightSlices: 1,
    sideSculptFactor: 0, moreSideSculpt: 0, cornerSculptFactor: 0,
    rows: { R1: 11.5, R2: 8.5, R3: 7.5, R4: 6 },
    angle: { R1: -6, R2: -1, R3: 3, R4: 7 },
    sound: '中·均衡',
    material: ['ABS', 'PBT'],
    note: 'KeyV2 源码：Signature Plastics 经典高度',
  },
  dss: {
    name: 'DSS（中低球形，SA 平替）',
    type: 'sculpted',
    bottomKeyWidth: 18.24, bottomKeyHeight: 18.24,
    widthDiff: 6, heightDiff: 6,
    dishType: 'spherical', dishDepth: 1.2,
    topSkew: 0, cornerRadius: 1, heightSlices: 10,
    sideSculptFactor: 4.5, moreSideSculpt: 0.4, cornerSculptFactor: 1,
    rows: { R1: 10.5, R2: 8.6, R3: 7.9, R4: 9.1 },
    angle: { R1: -1, R2: 3, R3: 8, R4: 16 },
    sound: '中·均衡',
    material: ['ABS'],
    note: 'KeyV2 源码：SA 观感、更矮更顺手',
  },
  g20: {
    name: 'G20（扁平无凹，POM 经典）',
    type: 'uniform',
    bottomKeyWidth: 18.16, bottomKeyHeight: 18.16,
    widthDiff: 2, heightDiff: 2,
    dishType: 'flat', dishDepth: 0,
    topSkew: 0.75, cornerRadius: 1, heightSlices: 1,
    sideSculptFactor: 0, moreSideSculpt: 0, cornerSculptFactor: 0,
    rows: { R1: 6.5, R2: 6, R3: 6, R4: 6.5 },
    angle: { R1: -5.5, R2: 2.5, R3: 2.5, R4: 2.5 },
    sound: '轻·顺滑',
    material: ['POM'],
    note: 'KeyV2 源码：顶面全平，仅按键定位凸点',
  },
  hipro: {
    name: 'HiPro（高球面，Topre 风格）',
    type: 'sculpted',
    bottomKeyWidth: 18.35, bottomKeyHeight: 18.17,
    widthDiff: 6.05, heightDiff: 5.52,
    dishType: 'squared scoop', dishDepth: 0.75,
    topSkew: 0, cornerRadius: 1, heightSlices: 10,
    sideSculptFactor: 4.5, moreSideSculpt: 0.4, cornerSculptFactor: 1,
    rows: { R1: 13.7, R2: 11.1, R3: 11.1, R4: 12.25 },
    angle: { R1: -13, R2: -7, R3: 7, R4: 13 },
    sound: '极高·深共鸣',
    material: ['ABS'],
    note: 'KeyV2 源码：REALFORCE/静电容高端手感',
  },
  asa: {
    name: 'ASA（Akko 高球形）',
    type: 'sculpted',
    bottomKeyWidth: 18.1, bottomKeyHeight: 18.15,
    widthDiff: 6.2, heightDiff: 6.55,
    dishType: 'spherical', dishDepth: 1.3,
    topSkew: 1.75, cornerRadius: 1, heightSlices: 10,
    sideSculptFactor: 4.5, moreSideSculpt: 0.4, cornerSculptFactor: 1,
    rows: { R1: 10.5, R2: 9.95, R3: 10.75, R4: 12.55 },
    angle: { R1: 9.33, R2: 4, R3: 1.5, R4: 0.43 },
    sound: '高·共鸣',
    material: ['PBT'],
    note: 'KeyV2 源码：SA 观感、OEM 实用，Akko 出品',
  },
  xda: {
    name: 'XDA（低矮等高，平面）',
    type: 'uniform',
    bottomKeyWidth: 18.0, bottomKeyHeight: 18.0,
    widthDiff: 4.5, heightDiff: 4.5,
    dishType: 'flat', dishDepth: 0,
    topSkew: 0, cornerRadius: 1, heightSlices: 1,
    sideSculptFactor: 0, moreSideSculpt: 0, cornerSculptFactor: 0,
    rows: { R1: 9.8, R2: 9.8, R3: 9.8, R4: 9.8 },
    angle: { R1: 0, R2: 0, R3: 0, R4: 0 },
    sound: '中·均匀',
    material: ['PBT'],
    note: '社区规格（KeyV2 未收录）：顶面大、颜值干净，键帽可互换',
  },
  mda: {
    name: 'MDA（中高球形，舒适折中）',
    type: 'sculpted',
    bottomKeyWidth: 18.0, bottomKeyHeight: 18.0,
    widthDiff: 4.5, heightDiff: 4.5,
    dishType: 'spherical', dishDepth: 0.8,
    topSkew: 0, cornerRadius: 1, heightSlices: 10,
    sideSculptFactor: 2, moreSideSculpt: 0.4, cornerSculptFactor: 1,
    rows: { R1: 11.5, R2: 10.5, R3: 9.8, R4: 9.5 },
    angle: { R1: 3, R2: 7, R3: 8, R4: 10 },
    sound: '中深·温暖',
    material: ['PBT', 'ABS'],
    note: '社区规格（KeyV2 未收录）：Cherry 手感 + SA 球面',
  },
  kat: {
    name: 'KAT（中高球形，现代）',
    type: 'sculpted',
    bottomKeyWidth: 18.0, bottomKeyHeight: 18.0,
    widthDiff: 4.5, heightDiff: 4.5,
    dishType: 'spherical', dishDepth: 0.8,
    topSkew: 0, cornerRadius: 1, heightSlices: 10,
    sideSculptFactor: 3, moreSideSculpt: 0.4, cornerSculptFactor: 1,
    rows: { R1: 13.5, R2: 12.5, R3: 11.5, R4: 11.5 },
    angle: { R1: 3, R2: 7, R3: 8, R4: 10 },
    sound: '深·平滑',
    material: ['PBT'],
    note: '社区规格（KeyV2 未收录）：球面+雕刻，舒适度口碑好',
  },
};

/** 键帽宽度规格（底面 mm；顶面 = 底面 - profile 的 widthDiff） */
const KEYCAP_SIZE_MM = {
  u1:   18.0,
  u125: 22.5,
  u15:  27.0,
  u175: 31.5,
  u2:   36.0,
  u225: 40.5,
  u25:  45.0,
  u275: 49.5,
  u3:   54.0,
  u625: 112.5,
  u65:  117.0,
};

/** 键帽材质与工艺统计 */
const KEYCAP_MATERIALS = {
  ABS:   { name: 'ABS',   note: '手感细腻、透光好；久用易打油', sound: '清脆' },
  PBT:   { name: 'PBT',   note: '耐磨不打油、热升华载体；纹理感强', sound: '厚实' },
  POM:   { name: 'POM',   note: '自润滑顺滑，稀有', sound: 'thock' },
  PC:    { name: 'PC',    note: '全透光，RGB 电竞常用', sound: '清脆' },
};
const KEYCAP_PROCESSES = [
  { name: '二色成型（Double-shot）', note: '字符永不磨损，高端 ABS 主流' },
  { name: '热升华（Dye-sub）',       note: '字符渗入 PBT，细腻不掉字' },
  { name: '镭雕（Laser）',           note: '成本低，字符易磨损' },
  { name: '喷油（Pad-print）',       note: '入门方案，寿命最短' },
];

/** 键帽三维模型配置：由 profile + 行 + u 数导出建模参数（KeyV2 语义） */
function keycapModelParams(profileId, row, uW, uH) {
  const p = KEYCAP_PROFILES[profileId] || KEYCAP_PROFILES.oem;
  const h = p.type === 'uniform' ? p.rows.R3 : (p.rows[row] ?? p.rows.R3);
  const ang = p.type === 'uniform' ? p.angle.R3 : (p.angle[row] ?? p.angle.R3);
  const baseW = (uW || 1) * p.bottomKeyWidth;   // 底面宽（按 KeyV2 底面）
  const baseD = (uH || 1) * p.bottomKeyHeight;  // 底面深
  return {
    profileId,
    row,
    baseW,
    baseD,
    topW: Math.max(6, baseW - p.widthDiff),    // 顶面宽 = 底 - widthDiff（KeyV2）
    topD: Math.max(6, baseD - p.heightDiff),   // 顶面深
    height: h,                                 // KeyV2 total_depth（顶面 placement 高度）
    angle: ang,                                // KeyV2 top_tilt
    type: p.type,
    topShape: p.dishType,                      // dish 类型（KeyV2）
    topSkew: p.topSkew || 0,                   // 顶面后移 mm（KeyV2）
    dishDepth: p.dishDepth || 0,               // dish 深度 mm（KeyV2）
    corner: p.cornerRadius != null ? p.cornerRadius : 1,
    slices: p.heightSlices || 1,               // KeyV2 层数（SA 等 10 层）
    sideSculpt: p.sideSculptFactor || 0,       // 侧面桶形雕刻系数
    moreSideSculpt: p.moreSideSculpt || 0,     // 侧边弧系数
    cornerSculpt: p.cornerSculptFactor || 0,   // 圆角随高度增长系数
    bottomKeyWidth: p.bottomKeyWidth,
    bottomKeyHeight: p.bottomKeyHeight,
  };
}

/** 统计：类型（雕刻/统一）分布 */
function keycapStats() {
  const ids = Object.keys(KEYCAP_PROFILES);
  return {
    count: ids.length,
    sculpted: ids.filter((k) => KEYCAP_PROFILES[k].type === 'sculpted').length,
    uniform: ids.filter((k) => KEYCAP_PROFILES[k].type === 'uniform').length,
    list: ids.map((k) => ({
      id: k, name: KEYCAP_PROFILES[k].name.split('（')[0],
      type: KEYCAP_PROFILES[k].type, maxH: Math.max(...Object.values(KEYCAP_PROFILES[k].rows)),
    })),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KEYCAP_PROFILES, KEYCAP_SIZE_MM, KEYCAP_MATERIALS, KEYCAP_PROCESSES, keycapModelParams, keycapStats };
}
if (typeof window !== 'undefined') {
  window.KeycapData = { KEYCAP_PROFILES, KEYCAP_SIZE_MM, KEYCAP_MATERIALS, KEYCAP_PROCESSES, keycapModelParams, keycapStats };
}
