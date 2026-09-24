'use strict';
/* deepCheck.js —— 手写款与权威参考逐键坐标对照（QMK info.json / KLE samples）
 * 用法：node tools/deepCheck.js
 */
const fs = require('fs');
const path = require('path');
const { PRESETS, PRESET_META } = require('./build_presets_data.js');

function flattenRows(rows) {
  const keys = [];
  let y = 0;
  let rot = { r: 0, rx: 0, ry: 0 };
  for (let ri = 0; ri < rows.length; ri++) {
    const row = Array.isArray(rows[ri]) ? rows[ri] : [];
    let x = rot.rx;
    let rowMaxH = 1;
    let pending = null;
    const emit = (props, label, ci) => {
      const w = props.w || 1, h = props.h || 1, r = props.r != null ? props.r : rot.r;
      keys.push({ ri, ci, x, y, w, h, r, label: label || '' });
      x += w; rowMaxH = Math.max(rowMaxH, h);
    };
    for (let ci = 0; ci < row.length; ci++) {
      const item = row[ci];
      if (item && typeof item === 'object') {
        if (item.r != null) rot.r = item.r;
        if (item.rx != null || item.ry != null) {
          if (item.rx != null) rot.rx = item.rx;
          if (item.ry != null) rot.ry = item.ry;
          x = rot.rx; y = rot.ry;
        }
        if (item.y) y += item.y;
        x += item.x || 0;
        pending = item;
      } else {
        emit(pending || {}, String(item), ci);
        pending = null;
      }
    }
    x = rot.rx;
    y += rowMaxH;
  }
  return keys;
}

function norm(keys) {
  return keys.map(k => ({ x: +(+k.x).toFixed(3), y: +(+k.y).toFixed(3), w: k.w || 1, h: k.h || 1, r: k.r || 0 }));
}

/* QMK info.json layouts[LAYOUT].layout → 键列表（x/y/w/h/r） */
function qmkKeys(layoutArr) {
  return layoutArr.map(e => ({
    x: e.x || 0, y: e.y || 0, w: e.w || 1, h: e.h || 1, r: e.r || 0,
  }));
}

function compare(mineName, refName, refKeys, label) {
  const mine = norm(flattenRows(PRESETS[mineName]));
  const ref = norm(refKeys);
  const out = [];
  out.push(`\n### ${mineName} ${PRESET_META[mineName].name} vs ${label}(${refName})`);
  out.push(`键数 mine=${mine.length} ref=${ref.length}`);
  if (mine.length !== ref.length) { out.push(`  ⚠ 键数不一致`); return out; }
  // 排序后逐键 diff（几何坐标一致才算一致；聚行顺序与 QMK 宏顺序无需相同）
  const sortFn = (a, b) => (a.y - b.y) || (a.x - b.x);
  const m2 = [...mine].sort(sortFn), r2 = [...ref].sort(sortFn);
  let diff = [], maxD = 0;
  for (let i = 0; i < m2.length; i++) {
    const d = Math.max(Math.abs(m2[i].x - r2[i].x), Math.abs(m2[i].y - r2[i].y),
      Math.abs(m2[i].w - r2[i].w), Math.abs(m2[i].h - r2[i].h));
    if (d > 1e-6) { diff.push({ i, m: m2[i], r: r2[i], d }); }
    maxD = Math.max(maxD, d);
  }
  out.push(`差异键 ${diff.length} / ${mine.length} · maxDiff=${maxD.toFixed(3)}`);
  if (diff.length) {
    out.push(`逐键明细（i: mine x,y,w,h,r vs ref x,y,w,h,r）：`);
    for (const dd of diff) out.push(`  #${dd.i}: mine(${dd.m.x},${dd.m.y},w${dd.m.w},h${dd.m.h}) vs ref(${dd.r.x},${dd.r.y},w${dd.r.w},h${dd.r.h})`);
  } else {
    out.push(`  ✓ 逐键零差异`);
  }
  return out;
}

const out = [];
/* 1. HHKB / WKL vs QMK hhkb */
const hhkbQ = require('../tmp_qmk/hhkb.json');
const hhkbRef = hhkbQ.layouts.LAYOUT.layout;
out.push(...compare('hhkb', 'LAYOUT', hhkbRef, 'QMK hhkb'));
out.push(...compare('wkl', 'LAYOUT', hhkbRef, 'QMK hhkb（WKL 应去掉 Win 键）'));

/* 2. Corne vs QMK crkbd */
const crkbdQ = require('../tmp_qmk/crkbd.json');
const crkbdKeys = Object.keys(crkbdQ.layouts);
out.push(`\n### Corne vs QMK crkbd（layouts: ${crkbdKeys.join(',')}）`);
for (const k of crkbdKeys) {
  out.push(...compare('corne', k, crkbdQ.layouts[k].layout, 'QMK crkbd.' + k));
}

/* 3. Lily58 vs QMK lily58 */
const lilyQ = require('../tmp_qmk/lily58.json');
const lilyKeys = Object.keys(lilyQ.layouts);
out.push(`\n### Lily58 vs QMK lily58（layouts: ${lilyKeys.join(',')}）`);
for (const k of lilyKeys) {
  out.push(...compare('lily58', k, lilyQ.layouts[k].layout, 'QMK lily58.' + k));
}

/* 4. Sofle vs QMK 官方 rev1 keyboard.json */
const sofQ = require('../tmp_qmk/sofle_qmk_official.json');
const sofKeys = Object.keys(sofQ.layouts);
out.push(`\n### Sofle vs QMK 官方 rev1（layouts: ${sofKeys.join(',')}）`);
for (const k of sofKeys) {
  out.push(...compare('sofle', k, sofQ.layouts[k].layout, 'QMK sofle.' + k));
}

/* 5. 65/68 vs KLE FC660m（65% 参考） */
const KLE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tmp_kle_layouts.json'), 'utf8'));
const fc = KLE.presets.find(p => p.name === 'Leopold FC660m');
function cv(rows) { return rows.map(row => row.map(item => {
  if (typeof item === 'string') return item.split('\n')[0].replace(/<br\s*\/?>/gi, '').trim();
  if (item && typeof item === 'object') { const o = {}; for (const k of ['x','y','w','h','r','rx','ry']) if (item[k] != null) o[k] = item[k]; return o; }
  return item;
})); }
const fcRef = norm(flattenRows(cv(fc.data)));
out.push(`\n### 65 vs KLE Leopold FC660m`);
out.push(`键数 mine=${norm(flattenRows(PRESETS['65'])).length} ref=${fcRef.length}`);
const mine65 = norm(flattenRows(PRESETS['65']));
if (mine65.length === fcRef.length) {
  let diff = [], maxD = 0;
  for (let i = 0; i < mine65.length; i++) {
    const d = Math.max(Math.abs(mine65[i].x - fcRef[i].x), Math.abs(mine65[i].y - fcRef[i].y),
      Math.abs(mine65[i].w - fcRef[i].w), Math.abs(mine65[i].h - fcRef[i].h));
    if (d > 1e-6) diff.push({ i, m: mine65[i], r: fcRef[i] });
    maxD = Math.max(maxD, d);
  }
  out.push(`差异键 ${diff.length} · maxDiff=${maxD.toFixed(3)}`);
  for (const dd of diff.slice(0, 40)) out.push(`  #${dd.i}: mine(${dd.m.x},${dd.m.y},w${dd.m.w}) vs ref(${dd.r.x},${dd.r.y},w${dd.r.w})`);
} else {
  out.push(`  ⚠ 键数不一致（65 是 65%紧凑右列 Del/PgUp/PgDn/方向键；FC660m 是 Insert/Delete 变体，结构本就不同）`);
}
console.log(out.join('\n'));
