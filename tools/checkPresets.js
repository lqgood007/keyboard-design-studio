'use strict';
/* checkPresets.js —— 26 款预设逐款核对：键数、行宽、总尺寸、坐标自洽、官方对照
 * 用法：node tools/checkPresets.js
 * 输出：每款预设的解析统计 + 问题标记 + （对官方直灌款）坐标 diff
 */
const fs = require('fs');
const path = require('path');
const { PRESETS, PRESET_META } = require('./build_presets_data.js');

/* ---- 与 app.js flattenRows 完全一致的解析语义（权威渲染语义）----
 * app.js: 对象只更新状态不产生键；字符串才产生键（空串=空键）；
 *         连续对象=后一对象覆盖 pending（属性合并）；rx/ry 重置 x/y 到旋转中心
 */
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
      const w = props.w || 1;
      const h = props.h || 1;
      const r = props.r != null ? props.r : rot.r;
      keys.push({ ri, ci, x, y, w, h, r, label: label || '' });
      x += w;
      rowMaxH = Math.max(rowMaxH, h);
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

/* ---- 行统计：每行 (行索引, 行内 x 范围, 行宽) ---- */
function rowStats(keys) {
  const byRow = {};
  for (const k of keys) (byRow[k.ri] = byRow[k.ri] || []).push(k);
  const rows = [];
  for (const ri of Object.keys(byRow).map(Number).sort((a, b) => a - b)) {
    const ks = byRow[ri];
    const minX = Math.min(...ks.map(k => k.x));
    const maxX = Math.max(...ks.map(k => k.x + k.w));
    rows.push({ ri, count: ks.length, minX, maxX, width: +(maxX - minX).toFixed(4) });
  }
  return rows;
}

function analyze(id) {
  const rows = PRESETS[id];
  const keys = flattenRows(rows);
  const rs = rowStats(keys);
  const totalW = Math.max(...keys.map(k => k.x + k.w));
  const totalH = Math.max(...keys.map(k => k.y + k.h));
  const minX = Math.min(...keys.map(k => k.x));
  const minY = Math.min(...keys.map(k => k.y));
  // 键重叠检查（矩形相交，忽略旋转）
  let overlap = 0;
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i], b = keys[j];
      if (a.ri !== b.ri && a.r === 0 && b.r === 0) {
        const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ix > 0.01 && iy > 0.01) overlap++;
      }
    }
  }
  return { id, name: PRESET_META[id].name, group: PRESET_META[id].group,
    keyCount: keys.length, rows: rs.length, totalW: +totalW.toFixed(4), totalH: +totalH.toFixed(4),
    minX, minY, overlap, rowWidths: rs.map(r => r.width), rowCounts: rs.map(r => r.count) };
}

/* ---- 官方直灌款坐标 diff（KLE samples） ---- */
const KLE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tmp_kle_layouts.json'), 'utf8'));
const byName = {};
for (const p of KLE.presets) byName[p.name] = p.data;
function cl(s) { if (typeof s !== 'string') return s; return s.split('\n')[0].replace(/<br\s*\/?>/gi, '').trim(); }
function cv(rows) { return rows.map(row => row.map(item => {
  if (typeof item === 'string') return cl(item);
  if (item && typeof item === 'object') { const o = {}; for (const k of ['x','y','w','h','r','rx','ry']) if (item[k] != null) o[k] = item[k]; return o; }
  return item;
})); }
function normKeys(rows) {
  return flattenRows(rows).map(k => ({ x: +(k.x).toFixed(4), y: +(k.y).toFixed(4), w: k.w, h: k.h, r: k.r || 0 }));
}
const officialMap = { '60': 'Default 60%', '60iso': 'ISO 60%', '75c': 'Keycool 84', '100': 'ANSI 104', '100iso': 'ISO 105', 'planck': 'Planck', 'ergodox': 'ErgoDox', 'atreus': 'Atreus' };

const results = [];
for (const id of Object.keys(PRESETS)) {
  const a = analyze(id);
  // 官方对照
  let official = null;
  if (officialMap[id] && byName[officialMap[id]]) {
    const mine = normKeys(PRESETS[id]);
    const ref = normKeys(byName[officialMap[id]]);
    if (mine.length === ref.length) {
      let maxDiff = 0, diffs = [];
      for (let i = 0; i < mine.length; i++) {
        const d = Math.max(Math.abs(mine[i].x - ref[i].x), Math.abs(mine[i].y - ref[i].y),
          Math.abs(mine[i].w - ref[i].w), Math.abs(mine[i].h - ref[i].h));
        if (d > 1e-6) { diffs.push({ i, mine: mine[i], ref: ref[i] }); }
        maxDiff = Math.max(maxDiff, d);
      }
      official = { ref: officialMap[id], count: ref.length, maxDiff: +maxDiff.toFixed(4), diffCount: diffs.length, diffs: diffs.slice(0, 5) };
    } else {
      official = { ref: officialMap[id], count: ref.length, note: `键数不一致 mine=${mine.length} ref=${ref.length}` };
    }
  }
  results.push({ ...a, official });
}

/* ---- 输出 ---- */
let out = [];
for (const r of results) {
  out.push(`\n【${r.id}】${r.name}（${r.group}）`);
  out.push(`  键数 ${r.keyCount} · 行数 ${r.rows} · 总尺寸 ${r.totalW} × ${r.totalH} u (minX=${r.minX}, minY=${r.minY})`);
  out.push(`  各行宽: ${r.rowWidths.map(w => w.toFixed(2)).join(', ')}  (键数: ${r.rowCounts.join(',')})`);
  const problems = [];
  if (r.minX < -0.001 || r.minY < -0.001) problems.push(`负坐标 minX=${r.minX} minY=${r.minY}`);
  if (r.overlap > 0) problems.push(`${r.overlap} 处键重叠`);
  const ws = r.rowWidths;
  if (ws.length > 1) {
    const max = Math.max(...ws), min = Math.min(...ws);
    if (max - min > 0.01) problems.push(`行宽不一致 max=${max.toFixed(2)} min=${min.toFixed(2)}`);
  }
  if (r.official) {
    if (r.official.diffCount === 0) out.push(`  官方对照(${r.official.ref}): 逐键零差异 ✓`);
    else {
      problems.push(`官方对照(${r.official.ref}): ${r.official.diffCount} 键有差异 maxDiff=${r.official.maxDiff}`);
      for (const d of r.official.diffs) out.push(`    diff#${d.i}: mine(x=${d.mine.x},y=${d.mine.y},w=${d.mine.w},h=${d.mine.h}) vs ref(x=${d.ref.x},y=${d.ref.y},w=${d.ref.w},h=${d.ref.h})`);
    }
  }
  if (problems.length) out.push(`  ⚠ ${problems.join('；')}`);
  else out.push(`  ✓ 无异常`);
}
console.log(out.join('\n'));
