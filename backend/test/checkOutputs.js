'use strict';
/**
 * 输出文件合理性检查：对 backend/output 下所有作业的产物做内容级校验
 * 用法：node test/checkOutputs.js
 * 检查项：
 *   report.json       结构/数字一致性
 *   plate.dxf         DXF 实体数（板框4线 + 键×切孔5元素 + 螺丝孔4圆）、几何尺寸
 *   main.kicad_pcb    module/pad/网络计数、坐标范围、矩阵网络
 *   case.stl          solid/facet 数、包围盒尺寸
 *   pcb_edge.dxf/svg  轮廓实体
 *   layout.kle.json   JSON 合法性、键数
 *   case_case.jscad   脚本可读
 */

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../output');
const U = 19.05;

function listJobs() {
  if (!fs.existsSync(OUT)) return [];
  return fs.readdirSync(OUT)
    .filter((d) => fs.statSync(path.join(OUT, d)).isDirectory())
    .sort();
}

function parseDxf(text) {
  const entities = [];
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    const code = lines[i].trim();
    const val = lines[i + 1] ? lines[i + 1].trim() : '';
    if (code === '0' && ['LINE', 'CIRCLE', 'ARC', 'LWPOLYLINE', 'POLYLINE', 'SPLINE', 'ELLIPSE'].includes(val)) {
      entities.push(val);
    }
    i += 2;
  }
  return entities;
}

function parseStlMeta(text) {
  const solids = (text.match(/^solid /gm) || []).length;
  const facets = (text.match(/facet normal/g) || []).length;
  const verts = [];
  const re = /vertex\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) verts.push([+m[1], +m[2], +m[3]]);
  if (!verts.length) return { solids, facets, bounds: null };
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const v of verts) for (let a = 0; a < 3; a++) {
    min[a] = Math.min(min[a], v[a]); max[a] = Math.max(max[a], v[a]);
  }
  return {
    solids, facets,
    bounds: { x: +(max[0] - min[0]).toFixed(2), y: +(max[1] - min[1]).toFixed(2), z: +(max[2] - min[2]).toFixed(2) },
  };
}

function parseKicadPcb(text) {
  const modules = (text.match(/\(module /g) || []).length;
  const pads = (text.match(/\(pad /g) || []).length;
  const nets = (text.match(/^  \(net \d+ "/gm) || []).length;
  const rowNets = (text.match(/"row_\d+"/g) || []).length;
  const colNets = (text.match(/"col_\d+"/g) || []).length;
  // 坐标范围（module at 行）
  const ats = [...text.matchAll(/\(at (-?[\d.]+) (-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]);
  let bounds = null;
  if (ats.length) {
    const xs = ats.map((p) => p[0]), ys = ats.map((p) => p[1]);
    bounds = {
      x: +(Math.max(...xs) - Math.min(...xs)).toFixed(2),
      y: +(Math.max(...ys) - Math.min(...ys)).toFixed(2),
    };
  }
  return { modules, pads, nets, rowNets, colNets, bounds };
}

const problems = [];
function check(cond, msg) {
  if (cond) console.log('  ✓', msg);
  else { console.log('  ✗', msg); problems.push(msg); }
}

async function main() {
  const jobs = listJobs();
  console.log(`找到 ${jobs.length} 个作业目录\n`);

  for (const job of jobs) {
    const dir = path.join(OUT, job);
    const files = fs.readdirSync(dir);
    console.log(`\n=== ${job} (${files.length} 个文件) ===`);

    // 1. report.json
    const repPath = path.join(dir, 'report.json');
    const isLegacy = !fs.existsSync(repPath) || !JSON.parse(fs.readFileSync(repPath, 'utf8')).matrix;
    if (isLegacy) console.log('  ⚠ 旧版产物（新特性上线前生成），跳过新特性断言');
    if (fs.existsSync(repPath)) {
      const rep = JSON.parse(fs.readFileSync(repPath, 'utf8'));
      check(rep.keyCount > 0, `report: 键数 ${rep.keyCount}`);
      if (!isLegacy) {
        check(rep.matrix && rep.matrix.rows > 0, `report: 矩阵 ${rep.matrix && rep.matrix.rows}×${rep.matrix && rep.matrix.cols}`);
      }
      check(rep.bounds && rep.bounds.mm.widthMm > 50, `report: 板框尺寸 ${rep.bounds && rep.bounds.mm.widthMm}×${rep.bounds && rep.bounds.mm.heightMm}mm`);
      const repFiles = Object.keys(rep.files || {}).length;
      check(repFiles >= 7, `report: 文件清单 ${repFiles} 项（交付文件+report 自身）`);
    } else {
      check(false, 'report.json 缺失');
    }

    // 2. plate.dxf（板框=1 POLYLINE；每键切孔=4 LINE+4 ARC；螺丝孔=4 CIRCLE）
    const dxfPath = path.join(dir, 'plate.dxf');
    if (fs.existsSync(dxfPath)) {
      const ents = parseDxf(fs.readFileSync(dxfPath, 'utf8'));
      const kc = fs.existsSync(repPath) ? JSON.parse(fs.readFileSync(repPath, 'utf8')).keyCount : 60;
      const lines = ents.filter(e => e === 'LINE').length;
      const arcs = ents.filter(e => e === 'ARC').length;
      const circles = ents.filter(e => e === 'CIRCLE').length;
      const polylines = ents.filter(e => e === 'POLYLINE' || e === 'LWPOLYLINE').length;
      check(polylines >= 1, `plate.dxf: 板框 POLYLINE=${polylines}`);
      check(lines === kc * 4, `plate.dxf: 切孔 LINE=${lines}（期望 ${kc * 4}）`);
      check(arcs === kc * 4, `plate.dxf: 切孔 ARC=${arcs}（期望 ${kc * 4}）`);
      if (!isLegacy) check(circles === 4, `plate.dxf: 螺丝孔 CIRCLE=${circles}（四角=4）`);
    }

    // 3. main.kicad_pcb
    const pcbPath = path.join(dir, 'main.kicad_pcb');
    if (fs.existsSync(pcbPath)) {
      const pcb = parseKicadPcb(fs.readFileSync(pcbPath, 'utf8'));
      const kc = fs.existsSync(repPath) ? JSON.parse(fs.readFileSync(repPath, 'utf8')).keyCount : 60;
      if (!isLegacy) {
        check(pcb.modules >= kc * 2 + 1, `kicad_pcb: 器件=${pcb.modules}（≥ ${kc * 2 + 1}：MX+二极管+主控）`);
        check(pcb.rowNets >= kc && pcb.colNets >= kc, `kicad_pcb: 矩阵网络 row=${pcb.rowNets} col=${pcb.colNets}`);
      } else {
        check(pcb.modules >= kc * 2, `kicad_pcb: 器件=${pcb.modules}（≥ ${kc * 2}：MX+二极管）`);
      }
      check(pcb.pads >= kc * 4, `kicad_pcb: 焊盘=${pcb.pads}（≥ ${kc * 4}）`);
      check(pcb.bounds && pcb.bounds.x > 100 && pcb.bounds.y > 30, `kicad_pcb: 器件分布范围 ${pcb.bounds && pcb.bounds.x}×${pcb.bounds && pcb.bounds.y}mm`);
    }

    // 4. case.stl
    const stlPath = path.join(dir, 'case.stl');
    if (fs.existsSync(stlPath)) {
      const stl = parseStlMeta(fs.readFileSync(stlPath, 'utf8'));
      if (!isLegacy) {
        check(stl.solids === 1 && stl.facets > 100, `case.stl: solid=${stl.solids} facet=${stl.facets}`);
      } else {
        check(stl.solids === 1 && stl.facets >= 6, `case.stl: solid=${stl.solids} facet=${stl.facets}（旧版简化模型）`);
      }
      if (stl.bounds) {
        check(stl.bounds.z > 2 && stl.bounds.z < 20, `case.stl: 厚度 ${stl.bounds.z}mm（底板+面板）`);
        check(stl.bounds.x > 100, `case.stl: 板面 ${stl.bounds.x}×${stl.bounds.y}mm`);
      }
    }

    // 5. pcb_edge
    for (const f of ['pcb_edge.dxf', 'pcb_edge.svg']) {
      const p = path.join(dir, f);
      if (fs.existsSync(p)) {
        const size = fs.statSync(p).size;
        check(size > 100, `${f}: ${size}B`);
      }
    }

    // 6. layout.kle.json
    const klePath = path.join(dir, 'layout.kle.json');
    if (fs.existsSync(klePath)) {
      const kle = JSON.parse(fs.readFileSync(klePath, 'utf8'));
      const flat = kle.flat();
      const labels = flat.filter((x) => typeof x === 'string').length;
      check(Array.isArray(kle) && labels > 0, `layout.kle.json: 行=${kle.length} 标签=${labels}`);
    }

    // 7. case_case.jscad
    const jscadPath = path.join(dir, 'case_case.jscad');
    if (fs.existsSync(jscadPath)) {
      const txt = fs.readFileSync(jscadPath, 'utf8');
      check(txt.includes('CAG') || txt.includes('function') || txt.length > 200, `case_case.jscad: ${txt.length}B 脚本`);
    }
  }

  console.log('\n' + (problems.length ? `✗ 发现 ${problems.length} 个问题` : '✅ 全部输出文件合理'));
  if (problems.length) process.exit(1);
}

main().catch((e) => { console.error('检查脚本异常:', e); process.exit(1); });
