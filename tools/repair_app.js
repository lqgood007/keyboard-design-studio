'use strict';
/** 修复 build_presets.js 造成的 app.js 损坏：用 build 脚本数据重组 PRESETS / PRESET_META 段 */
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'frontend', 'public', 'js', 'app.js');
let src = fs.readFileSync(APP, 'utf8');

// 1) 找到 PRESETS 起点（唯一）
const pStart = src.indexOf('const PRESETS = {');
if (pStart < 0) { console.error('找不到 PRESETS'); process.exit(1); }

// 2) 找到真实 META（第 1 次出现即真实）
let mIdx = -1, count = 0;
for (let i = 0; i < src.length; i++) {
  const idx = src.indexOf('const PRESET_META = {', i);
  if (idx < 0) break;
  count++; mIdx = idx;
  i = idx + 1;
}
if (count < 1 || mIdx < 0) { console.error('找不到真实 META，count=' + count); process.exit(1); }

// 3) 从真实 META 的 '};' 找尾部起点（META 原始格式，第一个 '};' 是结尾）
const e2 = src.indexOf('};', mIdx);
if (e2 < 0) { console.error('META 结尾找不到'); process.exit(1); }

const head = src.slice(0, pStart);            // 文件头（PRESETS 之前）
const tail = src.slice(e2 + 2);               // META 之后（文件尾）

// 4) 复用 build_presets_data.js 的数据生成新段
const build = require('./build_presets_data.js');
const prettyP = 'const PRESETS = ' + JSON.stringify(build.PRESETS, null, 2);
const prettyM = 'const PRESET_META = ' + JSON.stringify(build.PRESET_META, null, 2);

fs.writeFileSync(APP, head + prettyP + ';\n\n' + prettyM + ';\n' + tail, 'utf8');
console.log('重组完成: PRESETS 起点=' + pStart + ' 真实META=' + mIdx + ' 尾部长=' + tail.length);
