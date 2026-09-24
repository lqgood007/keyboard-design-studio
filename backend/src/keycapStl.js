'use strict';
/**
 * 键帽 STL 生成器（参数化三维模型配置）
 *
 * 模型：圆角矩形轮廓梯形台 + 顶面 dish（auto/cylindrical/spherical/flat/dome），
 * 几何与前端 keycapGeo.js 同源（同一份 keycap.js 规格数据 + 同一网格算法）。
 * 输出 ASCII STL，可直接 3D 打印。
 */

const { keycapModelParams } = require('../../frontend/public/js/keycap.js');
const { keycapGeo } = require('../../frontend/public/js/keycapGeo.js');

/**
 * 生成单个键帽的 ASCII STL
 * @param {Object} opts
 * @param {string} opts.profile - keycap.js 中的 profile id（默认 oem）
 * @param {string} opts.row - R1|R2|R3|R4（默认 R3）
 * @param {number} opts.w - 宽度（u，默认 1）
 * @param {number} opts.h - 高度（u，默认 1）
 * @param {string} [opts.dish='auto'] - auto|cylindrical|spherical|flat|dome
 * @param {number} [opts.corner=1]  - 轮廓圆角半径 mm
 * @param {number} [opts.depth=0.8] - dish 深度 mm
 * @param {number} [opts.seg=6]     - 每边采样段数
 * @returns {string} ASCII STL
 */
function generateKeycapStl(opts = {}) {
  const p = keycapModelParams(opts.profile || 'oem', opts.row || 'R3', opts.w || 1, opts.h || 1);
  const { vertices, faces } = keycapGeo(p, opts);

  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm = (n) => {
    const l = Math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2) || 1;
    return [n[0] / l, n[1] / l, n[2] / l];
  };
  const fmt = (n) => (Number.isFinite(n) && Math.abs(n) < 1e-12 ? '0' : +n.toFixed(6));

  const lines = ['solid keycap'];
  for (const [a, b, c] of faces) {
    const p0 = vertices[a], p1 = vertices[b], p2 = vertices[c];
    const n = norm(cross(sub(p1, p0), sub(p2, p0)));
    lines.push(`  facet normal ${fmt(n[0])} ${fmt(n[1])} ${fmt(n[2])}`);
    lines.push('    outer loop');
    for (const pt of [p0, p1, p2]) lines.push(`      vertex ${fmt(pt[0])} ${fmt(pt[1])} ${fmt(pt[2])}`);
    lines.push('    endloop');
    lines.push('  endfacet');
  }
  lines.push('endsolid keycap');
  return lines.join('\n');
}

module.exports = { generateKeycapStl };
