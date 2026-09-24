'use strict';
/**
 * 端到端自测：60% ANSI 配列 -> plate.dxf / pcb_edge.dxf / main.kicad_pcb / case.stl
 * 覆盖：矩阵网络自动分配、Promicro 主控、四角螺丝孔
 * 用法：node test/e2e.js
 */

const fs = require('fs');
const path = require('path');
const { generatePlateDxf } = require('../src/plateDxf');
const { generateErgogen } = require('../src/ergogenPipeline');
const { generateCaseStl } = require('../src/caseStl');
const { parseKle } = require('../src/kleToKeys');

// 60% ANSI 配列（KLE raw data）
const KLE_60 = [
  [{ x: 0.5 }, 'Esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
  [{ x: 0.25 }, 'Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
  [{ x: 0.75 }, 'Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'Enter'],
  [{ x: 1.25 }, 'Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Shift'],
  [{ x: 0.25, w: 1.25 }, 'Ctrl', { w: 1.25 }, 'Win', { w: 1.25 }, 'Alt', { w: 6.25 }, 'Space', { w: 1.25 }, 'Alt', { w: 1.25 }, 'Fn', { w: 1.25 }, 'Ctrl'],
];

async function main() {
  const outDir = path.join(__dirname, '_e2e_out');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  // 1. KLE 解析
  const { keys } = parseKle(KLE_60);
  console.log(`[1/5] KLE 解析: ${keys.length} 键`);

  // 2. 定位板 DXF（含螺丝孔）
  const dxf = generatePlateDxf(KLE_60);
  fs.writeFileSync(path.join(outDir, 'plate.dxf'), dxf);
  const screwCount = (dxf.match(/CIRCLE/g) || []).length;
  console.log(`[2/5] 定位板 DXF: ${dxf.length} 字符, 螺丝孔圆=${screwCount}`);

  // 3. ergogen（PCB + outlines + 矩阵网络 + 主控）
  const erg = await generateErgogen(KLE_60);
  const outline = erg.outlines.pcb_edge;
  fs.writeFileSync(path.join(outDir, 'pcb_edge.dxf'), outline.dxf);
  fs.writeFileSync(path.join(outDir, 'pcb_edge.svg'), outline.svg);
  fs.writeFileSync(path.join(outDir, 'main.kicad_pcb'), erg.pcbs.main);
  console.log(`[3/5] ergogen: outlines=${Object.keys(erg.outlines)} pcbs=${Object.keys(erg.pcbs)} cases=${Object.keys(erg.cases)}`);
  console.log(`      kicad_pcb ${erg.pcbs.main.length} 字符, dxf ${outline.dxf.length} 字符`);
  const netDefs = (erg.pcbs.main.match(/^  \(net \d+ "/gm) || []).length;
  const moduleCount = (erg.pcbs.main.match(/\(module /g) || []).length;
  const padCount = (erg.pcbs.main.match(/\(pad /g) || []).length;
  const mcuCount = (erg.pcbs.main.match(/\(module ProMicro/g) || []).length;
  const rowNetCount = (erg.pcbs.main.match(/"row_\d+"/g) || []).length;
  const colNetCount = (erg.pcbs.main.match(/"col_\d+"/g) || []).length;
  const mxCount = (erg.pcbs.main.match(/\(module MX/g) || []).length;
  const diodeCount = (erg.pcbs.main.match(/\(module ComboDiode/g) || []).length;
  console.log(`      网络定义=${netDefs}, 器件=${moduleCount} (MX=${mxCount}, Diode=${diodeCount}, MCU=${mcuCount}), 焊盘=${padCount}`);
  console.log(`      矩阵网络: row_* ${rowNetCount} 处引用, col_* ${colNetCount} 处引用`);
  const matrix = erg.matrix;
  const rowNums = new Set(), colNums = new Set();
  Object.values(matrix).forEach(([r, c]) => { rowNums.add(r); colNums.add(c); });
  console.log(`      矩阵结构: ${rowNums.size} 行 x ${Math.max(...colNums) + 1} 列`);

  // 4. 外壳 STL（含螺丝孔）
  const stl = generateCaseStl(KLE_60);
  fs.writeFileSync(path.join(outDir, 'case.stl'), stl);
  const solidCount = (stl.match(/^solid /gm) || []).length;
  const facetCount = (stl.match(/facet normal/g) || []).length;
  console.log(`[4/5] 外壳 STL: ${stl.length} 字符, solid=${solidCount}, 三角面=${facetCount}`);

  // 5. 断言
  console.log('[5/5] 断言检查…');
  const assert = (cond, msg) => { if (!cond) throw new Error('断言失败: ' + msg); console.log('  ✓', msg); };
  assert(mxCount === keys.length, `MX 器件数=${mxCount} 应=${keys.length}`);
  assert(diodeCount === keys.length, `二极管数=${diodeCount} 应=${keys.length}`);
  assert(mcuCount === 1, 'Promicro 主控应存在');
  assert(screwCount === 4, `螺丝孔数=${screwCount} 应=4`);
  assert(rowNetCount >= keys.length, `row_* 网络引用=${rowNetCount}`);
  assert(colNetCount >= keys.length, `col_* 网络引用=${colNetCount}`);
  assert(facetCount > 100, `STL 三角面=${facetCount} 应>100`);

  // 汇总
  const files = fs.readdirSync(outDir).map((f) => {
    const s = fs.statSync(path.join(outDir, f));
    return `${f}: ${(s.size / 1024).toFixed(1)} KB`;
  });
  console.log('\n输出目录', outDir);
  console.log(files.join('\n'));
  console.log('\n✅ 全链路通过');
}

main().catch((e) => {
  console.error('❌ 失败:', e);
  process.exit(1);
});
