'use strict';
/* qmkToKle.js —— QMK info.json layouts[LAYOUT].layout → KLE raw data
 * 行聚类：以"行内按 x 排序后首键的 y"为行起点 rowY；KLE 行内 {y} 是相对当前累计 y 的增量、
 *         行首 {y} 是相对上一行结束累计 y 的偏移；对象-字符串严格交替、行首属性并入单对象。
 * 自校验：转换结果再用与 app.js 一致的 flattenRows 解析，逐键零差异才算通过。
 * 用法：node tools/qmkToKle.js <keyboard.json> <LAYOUT> [--tags]
 */
const fs = require('fs');
const path = require('path');

/* ---- app.js 权威渲染语义（对象只更新状态、字符串才产生键、连续对象覆盖、rx/ry 重置 x/y） ---- */
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

/* 把 QMK 键列表聚合成 KLE 行（行 = 同 y 聚类，gap>0.5u 断行） */
function clusterRows(qkeys) {
  const sorted = [...qkeys].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const rows = [];
  let cur = [];
  let curY = null;
  for (const k of sorted) {
    if (curY === null || Math.abs(k.y - curY) > 0.5) {
      if (cur.length) rows.push(cur);
      cur = [];
      curY = k.y;
    }
    cur.push(k);
  }
  if (cur.length) rows.push(cur);
  return rows;
}

/* 行内键 → KLE 元素流（对象-字符串严格交替；行内 x/y 均用增量表达）
 * KLE 语义：行内对象 {x:dx}/{y:dy} 为相对当前累计值的增量；累计 x/y 逐对象累加。
 * 因此每个键前一个对象携带 (本键绝对 x - 累计 x, 本键绝对 y - 累计 y) 增量即可精确还原坐标。
 */
function rowToKle(keys, rowIndex, totalRows) {
  const els = [];
  let accX = 0; // 行内累计 x（flattenRows: 行开始 x=rot.rx=0，行内 x += item.x || 0）
  let accY = keys[0].y; // 行内累计 y：首键为行起点（行首对象已设 y 偏移到 firstY）
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const props = {};
    const dx = +(k.x - accX).toFixed(4);
    if (Math.abs(dx) > 1e-6) props.x = dx;
    const dy = +(k.y - accY).toFixed(4);
    if (Math.abs(dy) > 1e-6) props.y = dy;
    if (k.w && k.w !== 1) props.w = k.w;
    if (k.h && k.h !== 1) props.h = k.h;
    if (k.r && k.r !== 0) props.r = k.r;
    if (Object.keys(props).length) els.push(props);
    els.push(k.label !== undefined ? k.label : '');
    accX = k.x + (k.w || 1);
    accY = k.y;
  }
  return els;
}

/* QMK 键列表 → KLE rows（含行首 y 偏移）
 * 行首 {y} 是相对"上一行结束累计 y"的偏移；flattenRows 里上一行结束累计 y = 进入该行时 y + 该行 maxH
 */
function qmkToKle(qkeys, opts = {}) {
  const rows = clusterRows(qkeys);
  const out = [];
  let rowEndY = 0; // 进入第 0 行时 y = 0
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const firstY = row[0].y;
    const head = {};
    const dy = +(firstY - rowEndY).toFixed(4);
    if (Math.abs(dy) > 1e-6) head.y = dy;
    const els = rowToKle(row, ri, rows.length);
    const rowArr = [];
    if (Object.keys(head).length) rowArr.push(head);
    rowArr.push(...els);
    out.push(rowArr);
    // 该行结束累计 y = 进入该行时 y + 行高（行内最大 h，至少 1）
    const rowH = Math.max(1, ...row.map(k => k.h || 1));
    rowEndY = firstY + rowH;
  }
  return out;
}

/* 标签提取：QMK 键无标签 → 用索引填充可读标签（可关闭） */
function labelsFor(qkeys) {
  return qkeys.map((k, i) => (k.label !== undefined ? k.label : ''));
}

/* ---- main ---- */
function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('用法: node tools/qmkToKle.js <keyboard.json> <LAYOUT> [--tags]');
    process.exit(1);
  }
  const file = args[0];
  const layoutName = args[1];
  const withTags = args.includes('--tags');
  const kb = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!kb.layouts || !kb.layouts[layoutName]) {
    console.error(`布局 ${layoutName} 不存在。可用: ${Object.keys(kb.layouts || {}).join(', ')}`);
    process.exit(1);
  }
  const qkeys = kb.layouts[layoutName].layout.map(e => ({
    x: e.x || 0, y: e.y || 0, w: e.w || 1, h: e.h || 1, r: e.r || 0,
    label: withTags ? (e.matrix ? `M${e.matrix[0]},${e.matrix[1]}` : '') : undefined,
  }));
  const rows = qmkToKle(qkeys, { withTags });
  /* 自校验：转换结果用 app.js 语义解析，与 QMK 坐标逐键零差异 */
  const mine = flattenRows(rows).map(k => ({ x: +(+k.x).toFixed(3), y: +(+k.y).toFixed(3), w: k.w, h: k.h, r: k.r || 0 }));
  const ref = qkeys.map(k => ({ x: k.x, y: k.y, w: k.w, h: k.h, r: k.r || 0 }));
  const sortFn = (a, b) => (a.y - b.y) || (a.x - b.x);
  const m2 = [...mine].sort(sortFn), r2 = [...ref].sort(sortFn);
  let diff = 0, maxD = 0;
  for (let i = 0; i < m2.length; i++) {
    const d = Math.max(Math.abs(m2[i].x - r2[i].x), Math.abs(m2[i].y - r2[i].y),
      Math.abs(m2[i].w - r2[i].w), Math.abs(m2[i].h - r2[i].h));
    if (d > 1e-6) diff++;
    maxD = Math.max(maxD, d);
  }
  console.log(`键数 ${mine.length}（ref ${ref.length}）· 行数 ${rows.length} · 自校验 diff=${diff} maxDiff=${maxD.toFixed(3)}`);
  if (diff > 0) {
    console.error('⚠ 自校验未通过');
    process.exit(2);
  }
  console.log(JSON.stringify(rows));
}

if (require.main === module) main();
module.exports = { qmkToKle, clusterRows, flattenRows };
