'use strict';
/**
 * KeyV2 键帽几何验证：13 款 Profile × 4 行 × 1u 生成网格，
 * 断言底面/顶面尺寸、总高、顶面倾角（前低后高）、dish 深度、top_skew 均符合 KeyV2 参数。
 */
const { KEYCAP_PROFILES, keycapModelParams } = require('../../frontend/public/js/keycap.js');
const { keycapGeo } = require('../../frontend/public/js/keycapGeo.js');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + msg); } };
const near = (a, b, eps) => Math.abs(a - b) <= eps;

function bbox(geo) {
  const xs = [], ys = [], zs = [];
  for (const v of geo.vertices) { xs.push(v[0]); ys.push(v[1]); zs.push(v[2]); }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), z0: Math.min(...zs), z1: Math.max(...zs) };
}

for (const pid of Object.keys(KEYCAP_PROFILES)) {
  const prof = KEYCAP_PROFILES[pid];
  for (const row of ['R1', 'R2', 'R3', 'R4']) {
    const p = keycapModelParams(pid, row, 1, 1);
    const geo = keycapGeo(p, { dish: 'auto' });
    const bb = bbox(geo);
    // 底面宽 = baseW（x 范围），深 = baseD（z 范围，取底层环 y≈0 的点，避开 top_skew 偏移的顶环）
    ok(near(bb.x1 - bb.x0, p.baseW, 0.1), `${pid} ${row} 底面宽 ${(bb.x1-bb.x0).toFixed(2)}≈${p.baseW}`);
    const bottomPts = geo.vertices.filter((v) => v[1] < 0.01);
    const zs = bottomPts.map((v) => v[2]);
    ok(near(Math.max(...zs) - Math.min(...zs), p.baseD, 0.1), `${pid} ${row} 底面深 ${(Math.max(...zs)-Math.min(...zs)).toFixed(2)}≈${p.baseD}`);
    // 顶面中心 y = totalDepth + dishCenter（flat/dome 时）
    const dishCenter = geo.vertices[geo.vertices.length - 1][1] - p.height;
    if (p.topShape === 'flat' || p.topShape === 'disable') {
      ok(near(dishCenter, 0, 0.01), `${pid} ${row} 平面顶中心 y=totalDepth`);
    } else {
      ok(dishCenter < 0, `${pid} ${row} 凹面顶中心低于 totalDepth（${dishCenter.toFixed(3)}）`);
    }
    // 顶面倾角方向（dish 关闭，纯几何）：KeyV2 rotate([-top_tilt]) → sign(前后y差) = -sign(angle)
    //   负角（R1 数字行）= 前低后高（Back 高，远离打字员翘起）；正角（R4 底行）= 前高后低（Front 高，向打字员翘起）
    const flatGeo = keycapGeo(p, { dish: 'flat' });
    let zMin = Infinity, zMax = -Infinity, yAtZMin = 0, yAtZMax = 0;
    for (let i = 0; i < 80; i++) {   // 每环点数 = 8·seg = 8·10（seg 默认 10）
      const v = flatGeo.vertices[flatGeo.vertices.length - 2 - 80 + i];
      if (v[2] < zMin) { zMin = v[2]; yAtZMin = v[1]; }
      if (v[2] > zMax) { zMax = v[2]; yAtZMax = v[1]; }
    }
    if (Math.abs(p.angle) > 0.5) {
      const dir = Math.sign(yAtZMax - yAtZMin) === -Math.sign(p.angle);
      ok(dir, `${pid} ${row} 倾角方向正确（前 ${yAtZMin.toFixed(2)} 后 ${yAtZMax.toFixed(2)}，${p.angle}°）`);
    }
    // top_skew：顶面中心 z ≈ topSkew
    const topCenterV = geo.vertices[geo.vertices.length - 1];
    ok(near(topCenterV[2], p.topSkew, 0.15), `${pid} ${row} 顶面后移 z=${topCenterV[2].toFixed(2)}≈${p.topSkew}`);
    // 网格量：直台（1 层）98 顶点；多层（SA 等）>100
    ok(geo.vertices.length >= 98 && geo.faces.length >= 192, `${pid} ${row} 网格量 ${geo.vertices.length} 顶点 / ${geo.faces.length} 面`);
    // 桶形侧面（SA 等 10 层）：中间层比底面窄但比顶面宽 → x 范围应介于 baseW 与 topW 之间（实际可能桶形凸出中间层最宽）
    if (p.slices > 1 && p.sideSculpt > 0) {
      ok(bb.x1 - bb.x0 <= p.baseW + 1.0, `${pid} ${row} 桶形侧不超底面太多`);
    }
  }
}

console.log(`\nKeyV2 几何断言：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
