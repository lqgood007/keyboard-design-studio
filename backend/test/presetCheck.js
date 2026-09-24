'use strict';
/**
 * 预设配列逐款核对（坐标级）：
 * A. 官方直灌款：官方 layouts.json（tmp_kle_layouts.json）解析 vs 本项目 PRESETS 解析，逐键坐标 diff
 * B. 手写款：几何自洽检查（行内 x 连续、无重叠、底行宽度合计、旋转簇中心）
 */
const fs = require('fs');
const path = require('path');
const kle = require('../node_modules/kle-serial');
const { PRESETS } = require('../../tools/build_presets_data.js');

const KLE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'tmp_kle_layouts.json'), 'utf8'));
const byName = {};
for (const p of KLE.presets) byName[p.name] = p.data;

/** 官方款 → 本项目 preset id 映射（build_presets_data 直灌的） */
const OFFICIAL_MAP = [
  ['Default 60%', '60'], ['ISO 60%', '60iso'], ['Keycool 84', '75c'],
  ['ANSI 104', '100'], ['ISO 105', '100iso'], ['Planck', 'planck'],
  ['ErgoDox', 'ergodox'], ['Atreus', 'atreus'],
];

function parse(rows) { return kle.Serial.deserialize(rows); }

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };
const near = (a, b) => Math.abs(a - b) < 0.001;

console.log('=== A. 官方直灌款坐标 diff（期望全部 0 差异） ===');
for (const [offName, pid] of OFFICIAL_MAP) {
  const official = parse(byName[offName]);
  const ours = parse(PRESETS[pid]);
  ok(official.keys.length === ours.keys.length, `${pid}（${offName}）键数 ${ours.keys.length} vs 官方 ${official.keys.length}`);
  let maxDiff = 0, bad = 0;
  for (let i = 0; i < Math.min(official.keys.length, ours.keys.length); i++) {
    const a = official.keys[i], b = ours.keys[i];
    for (const f of ['x', 'y', 'w', 'h', 'r', 'rx', 'ry']) {
      const d = Math.abs((a[f] || 0) - (b[f] || 0));
      if (d > maxDiff) maxDiff = d;
      if (d > 0.001) bad++;
    }
  }
  ok(bad === 0, `${pid} 坐标差异键数=${bad}，最大差=${maxDiff.toFixed(4)}u`);
}

console.log('\n=== B. 手写款几何自洽检查 ===');
const HAND = Object.keys(PRESETS).filter((id) => !OFFICIAL_MAP.some(([, p]) => p === id));
for (const pid of HAND) {
  let kb;
  try { kb = parse(PRESETS[pid]); } catch (e) { console.log(`  ✗ ${pid} 解析失败: ${e.message}`); fail++; continue; }
  const keys = kb.keys;
  // 统一字段：kle Key → {x,y,w,h,r}
  const K = keys.map((k) => ({ x: k.x, y: k.y, w: k.width, h: k.height, r: k.rotation_angle, rx: k.rotation_x, ry: k.rotation_y, label: (k.labels || [])[0] || '' }));
  // 1) 行内 x 连续：按 y 聚类（±0.25），每行内键 x 应连续（gap >= 0 无重叠）
  const sorted = [...K].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  let cur = [], prevY = null;
  for (const k of sorted) {
    if (prevY !== null && k.y - prevY > 0.25) { rows.push(cur); cur = []; }
    cur.push(k); prevY = k.y;
  }
  if (cur.length) rows.push(cur);
  let rowOverlap = 0, rowGapWarn = 0;
  for (const r of rows) {
    const rs = r.sort((a, b) => a.x - b.x);
    for (let i = 0; i < rs.length - 1; i++) {
      const end = rs[i].x + rs[i].w;
      const nextStart = rs[i + 1].x;
      if (end > nextStart + 0.001) rowOverlap++;
      if (nextStart - end > 0.05) rowGapWarn++;
    }
  }
  ok(rowOverlap === 0, `${pid} 行内键重叠=${rowOverlap}（应 0）`);
  // 2) 底行宽度合计（最后一行）
  const lastRow = rows[rows.length - 1] || [];
  const bottomWidth = lastRow.reduce((s, k) => s + k.w, 0);
  const bottomStart = lastRow.length ? Math.min(...lastRow.map((k) => k.x)) : 0;
  const bottomSpan = lastRow.length ? Math.max(...lastRow.map((k) => k.x + k.w)) - bottomStart : 0;
  // 3) 旋转键：旋转簇 rx/ry 应等于簇中心
  const rotated = K.filter((k) => k.r && Math.abs(k.r) > 0.001);
  let rotBad = 0;
  for (const k of rotated) {
    const cx = k.x + k.w / 2, cy = k.y + k.h / 2;
    const cluster = K.filter((o) => o !== k && Math.abs((o.rx ?? cx) - (k.rx ?? cx)) < 0.01 && Math.abs((o.ry ?? cy) - (k.ry ?? cy)) < 0.01 && Math.abs(o.r - k.r) < 0.01);
    if (cluster.length) {
      const nearKey = cluster.find((o) => Math.abs(o.x - (k.x + k.w)) < 0.01 && Math.abs(o.y - k.y) < 0.05);
      if (nearKey) {
        const expX = (k.rx ?? cx) + (k.x + k.w - (k.rx ?? cx)) * Math.cos(k.r * Math.PI / 180) - (k.y - (k.ry ?? cy)) * Math.sin(k.r * Math.PI / 180);
        const expY = (k.ry ?? cy) + (k.x + k.w - (k.rx ?? cx)) * Math.sin(k.r * Math.PI / 180) + (k.y - (k.ry ?? cy)) * Math.cos(k.r * Math.PI / 180);
        if (!near(expX, nearKey.x) || !near(expY, nearKey.y)) rotBad++;
      }
    }
  }
  ok(rotBad === 0, `${pid} 旋转簇坐标不一致=${rotBad}`);
  console.log(`     ${pid}: ${keys.length} 键, 底行 ${lastRow.length} 键 合计=${bottomWidth.toFixed(2)}u 跨度=${bottomSpan.toFixed(2)}u${rowGapWarn ? `, 行内空隙=${rowGapWarn}` : ''}`);
}

console.log(`\n预设核对：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
