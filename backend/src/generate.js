'use strict';
/**
 * 生成编排：一个 KLE 配列 -> 全部硬件文件
 *   - plate.dxf          定位板（SwillKB 风格）
 *   - pcb_edge.dxf/svg   PCB 轮廓（ergogen）
 *   - main.kicad_pcb     KiCad PCB 工程（ergogen，含 mx/diode 封装与矩阵网络）
 *   - case.stl           外壳 STL（@jscad/modeling）
 *   - case.jscad         外壳脚本（ergogen，JSCAD 可编辑）
 *   - layout.kle.json    KLE 源数据
 *   - preview.svg        配列预览（ergogen）
 *   - report.json        生成报告（尺寸、按键数、网络数）
 */

const fs = require('fs');
const path = require('path');
const { generatePlateDxf } = require('./plateDxf');
const { generateErgogen } = require('./ergogenPipeline');
const { generateCaseStl } = require('./caseStl');
const { parseKle } = require('./kleToKeys');

const OUTPUT_DIR = path.resolve(__dirname, '../output');

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * 执行完整生成，把文件写入 output/<jobId>/，返回目录路径
 */
async function runGenerate(kleRaw, options = {}) {
  ensureOutputDir();
  const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const jobDir = path.join(OUTPUT_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  // 1. 解析 + 定位板 DXF（同步）
  const { keys } = parseKle(kleRaw);
  const plateDxf = generatePlateDxf(kleRaw, options);

  // 2. ergogen 产物 + 外壳 STL（可并行）
  const [erg] = await Promise.all([
    generateErgogen(kleRaw, options),
  ]);
  const caseStls = generateCaseStl(kleRaw, options);

  // 3. 写文件
  const files = {};
  const write = (name, data) => {
    fs.writeFileSync(path.join(jobDir, name), data);
    files[name] = fs.statSync(path.join(jobDir, name)).size;
  };

  write('plate.dxf', plateDxf);
  write('layout.kle.json', typeof kleRaw === 'string' ? kleRaw : JSON.stringify(kleRaw, null, 2));

  const outline = erg.outlines && erg.outlines.pcb_edge;
  if (outline) {
    if (outline.dxf) write('pcb_edge.dxf', outline.dxf);
    if (outline.svg) write('pcb_edge.svg', outline.svg);
  }
  const pcb = erg.pcbs && erg.pcbs.main;
  if (pcb) write('main.kicad_pcb', pcb);
  for (const [name, c] of Object.entries(erg.cases || {})) {
    if (c.jscad) write(`case_${name}.jscad`, c.jscad);
  }
  write('case.stl', caseStls.case);
  if (caseStls.layerMode === 'split') {
    write('case_bottom.stl', caseStls.bottom);
    write('case_plate.stl', caseStls.plate);
  }

  // 4. 生成报告
  const matrixInfo = erg.matrix ? summarizeMatrix(erg.matrix) : {};
  const report = {
    jobId,
    generatedAt: new Date().toISOString(),
    keyCount: keys.length,
    matrix: matrixInfo,
    options: {
      expand: options.expand ?? 5,
      cutout: options.cutout ?? 14,
      controller: options.controller !== false,
      screwHoles: options.screwHoles !== false,
      screwDia: options.screwDia ?? 3.2,
      cornerRadius: options.cornerRadius ?? 0,
      chamfer: options.chamfer ?? 0,
      layerMode: options.layerMode ?? 'single',
    },
    bounds: { mm: plateBounds(keys) },
    files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, `${v} B`])),
  };
  write('report.json', JSON.stringify(report, null, 2));
  // 补自身到文件清单（报告列出全部 8 个交付文件）
  report.files['report.json'] = `${fs.statSync(path.join(jobDir, 'report.json')).size} B`;
  write('report.json', JSON.stringify(report, null, 2));

  return { jobDir, jobId, report };
}

function summarizeMatrix(matrix) {
  const rows = new Set();
  const cols = new Set();
  for (const [r, c] of Object.values(matrix)) {
    rows.add(r);
    cols.add(c);
  }
  return {
    rows: rows.size,
    cols: Math.max(0, ...cols) + 1,
    nets: `${rows.size} row + ${Math.max(0, ...cols) + 1} col`,
  };
}

function plateBounds(keys) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const { rotatedCorners } = require('./kleToKeys');
  for (const k of keys) {
    for (const [x, y] of rotatedCorners(k.cx, k.cy, k.w, k.h, k.rot)) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return {
    widthMm: +(maxX - minX).toFixed(2),
    heightMm: +(maxY - minY).toFixed(2),
  };
}

/**
 * 把 jobDir 打包成 zip，返回流
 */
function zipJob(jobDir) {
  const { ZipArchive } = require('archiver');
  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.directory(jobDir, false);
  archive.finalize();
  return archive;
}

module.exports = { runGenerate, zipJob, OUTPUT_DIR };
