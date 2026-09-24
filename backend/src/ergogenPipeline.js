'use strict';
/**
 * Ergogen v4 集成管线
 *
 * 链路：
 *   KLE raw data
 *     -> ergogen.process(raw, {debug:true})  得到 canonical（KLE 转换的标准配置，含 points.zones）
 *     -> 矩阵网络自动分配（按几何行列聚类，注入 row_N / col_M）
 *     -> 合并 outlines / cases / pcbs 配置（含 Promicro 主控）
 *     -> ergogen.process(fullConfig)          产出：
 *          outlines.<name>.dxf  (PCB 轮廓 DXF，makerjs 生成)
 *          outlines.<name>.svg  (轮廓 SVG)
 *          pcbs.<name>          (KiCad PCB 工程文本：mx/diode/promicro 封装 + 矩阵网络)
 *          cases.<name>.jscad   (外壳 JSCAD 脚本)
 *
 * 参考官方：https://ergogen.xyz / github.com/ergogen/ergogen
 */

const ergogen = require('ergogen');
const { parseKle, U } = require('./kleToKeys');

const silence = () => {};

/**
 * 矩阵网络自动分配：按几何坐标把按键聚合成行/列，返回 {index: [row, col]}
 * 行 = y 聚类（gap > 0.6u 新行）；列 = 行内按 x 排序的序号（标准键盘矩阵语义）
 */
function assignMatrix(keys) {
  const sorted = [...keys].sort((a, b) => a.cy - b.cy);
  const rows = [];
  let cur = [];
  let prevY = null;
  for (const k of sorted) {
    if (prevY !== null && k.cy - prevY > 0.6 * U) {
      rows.push(cur);
      cur = [];
    }
    cur.push(k);
    prevY = k.cy;
  }
  if (cur.length) rows.push(cur);

  const assign = {};
  rows.forEach((rk, r) => {
    rk.sort((a, b) => a.cx - b.cx);
    rk.forEach((k, c) => { assign[k.index] = [r, c]; });
  });
  return assign;
}

const mean = (arr) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);

/**
 * 从 KLE 生成 ergogen 全部产物
 * @param {Array|Object|string} raw - KLE raw data
 * @param {Object} opts
 * @param {number} opts.expand - PCB 轮廓外扩（mm）
 * @param {number} opts.caseThickness - 外壳厚度（mm，case 脚本用）
 * @param {boolean} opts.controller - 是否放置 Promicro 主控（默认 true）
 * @returns {Promise<{outlines, pcbs, cases, points, matrix}>}
 */
async function generateErgogen(raw, opts = {}) {
  const expand = opts.expand ?? 5;
  const caseThickness = opts.caseThickness ?? 3;
  const enableController = opts.controller !== false;

  // 1) KLE -> canonical 配置（points.zones 由 ergogen 官方转换）
  const first = await ergogen.process(raw, { debug: true }, silence);
  const canonical = first.canonical;
  const pointNames = Object.keys(first.points || {});

  // 2) 矩阵网络自动分配：向 canonical 的每个键注入 row_N / col_M 网络
  const { keys } = parseKle(raw);
  const matrix = assignMatrix(keys);
  const zoneNames = Object.keys(canonical.points.zones || {});
  zoneNames.forEach((zn, i) => {
    const zone = canonical.points.zones[zn];
    const a = matrix[i];
    if (!a) return;
    for (const col of Object.values(zone.columns || {})) {
      for (const row of Object.values(col.rows || {})) {
        row.column_net = `col_${a[1]}`;
        row.row_net = `row_${a[0]}`;
      }
    }
  });

  // 3) 主控 Promicro 定位：矩阵中心水平居中，放在 PCB 板框外正下方
  const footprints = {
    // MX 轴（含热插拔座孔）；from/to 引用矩阵网络
    switch: {
      what: 'mx', where: true,
      params: { from: '{{column_net}}', to: '{{row_net}}' },
    },
    // 二极管：串联进矩阵
    diode: {
      what: 'diode', where: true,
      adjust: { shift: [0, 4] },
      params: { from: '{{row_net}}', to: '{{column_net}}' },
    },
  };

  if (enableController) {
    const bottomY = Math.min(...keys.map(k => k.cy - k.h / 2)); // PCB 底边（y 向上）
    const cyMean = mean(keys.map(k => k.cy));
    // Promicro 半高约 16.5mm：板外下方 = 底边 - 外扩 - 半高 - 2mm 间隙
    const proMicroY = bottomY - expand - 16.5 - 2;
    const shiftY = (proMicroY - cyMean) / U;
    footprints.controller = {
      what: 'promicro',
      where: {
        aggregate: { parts: pointNames, method: 'average' },
        shift: [0, shiftY],
      },
      params: { orientation: 'down' },
    };
  }

  // 4) 完整配置
  const config = {
    ...canonical,
    outlines: {
      _key_hull: [{ what: 'hull', points: pointNames }],
      pcb_edge: [{ what: 'outline', name: '_key_hull', expand }],
    },
    cases: {
      case: [{ name: 'pcb_edge', extrude: caseThickness }],
    },
    pcbs: {
      main: {
        outlines: { edge: { outline: 'pcb_edge' } },
        footprints,
      },
    },
  };

  const result = await ergogen.process(config, { svg: true }, silence);

  return {
    outlines: result.outlines,
    pcbs: result.pcbs,
    cases: result.cases,
    points: result.points,
    matrix,
  };
}

module.exports = { generateErgogen, assignMatrix };
