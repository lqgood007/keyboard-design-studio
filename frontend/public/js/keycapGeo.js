'use strict';
/**
 * 键帽三维模型几何生成 —— 按 KeyV2 源码多层截面建模（前后端同源）
 *
 * KeyV2（rsheldiii/KeyV2，OpenSCAD）建模语义（src/hulls/hull.scad + src/shapes/sculpted_square.scad）：
 * - 沿高度分 $height_slices 层（SA/DSA/MT3 等 10 层，OEM/Cherry/DCS 1 层直台）
 * - 每层 progress p∈[0,1]：
 *   - 截面尺寸 = 底面 - (差值 - side_sculpting(p))·p
 *     side_sculpting(p) = (1-p)·$side_sculpting_factor（SA 等桶形侧面：中间层更宽）
 *   - 圆角 = $corner_radius + p²·$corner_sculpting_factor（顶角更大）
 *   - 位置：translate([x_skew, top_skew·p, total_depth·p]) rotate([-top_tilt·p, 0, 0])
 *     —— 高度线性过渡 + 顶面后移 top_skew + 顶面倾角 top_tilt（前低后高）
 * - 顶面 dish 挖切：cylindrical 弧沿宽度（弦=顶宽）/ spherical 弧沿对角线（弦=√(w²+d²)）
 *   弓形公式 rad = (c²+4·depth²)/(8·depth)
 * 本模块输出 { vertices, faces }（y 向上），供前端实时渲染与后端 STL 三角化。
 */

/** KeyV2 sculpted_square 轮廓：4 角圆弧（r）+ 4 边弓形弧（bow）。返回 [x, z] 逆时针闭环点 */
function roundedRectPoints(hw, hd, r, seg, bow) {
  const R = Math.max(0.05, Math.min(r, hw, hd));
  const pts = [];
  // 弓形弧：P0→P1，外凸 outward（单位向量），弓高 b
  const bowArc = (x0, z0, x1, z1, ox, oz, b) => {
    const L = Math.hypot(x1 - x0, z1 - z0);
    if (b <= 0.0001 || L <= 0.0001) {
      for (let i = 1; i <= seg; i++) pts.push([x0 + (x1 - x0) * i / seg, z0 + (z1 - z0) * i / seg]);
      return;
    }
    const Rb = (L * L / 4 + b * b) / (2 * b);
    // 圆心 = 中点 - outward·(Rb - b)
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const cx = mx - ox * (Rb - b), cz = mz - oz * (Rb - b);
    const a0 = Math.atan2(z0 - cz, x0 - cx), a1 = Math.atan2(z1 - cz, x1 - cx);
    // 弧段取较短方向；若跨 ±π 需调整
    let da = a1 - a0;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    for (let i = 1; i <= seg; i++) {
      const a = a0 + da * i / seg;
      pts.push([cx + Rb * Math.cos(a), cz + Rb * Math.sin(a)]);
    }
  };
  const arc = (cx, cz, a0, a1) => {
    for (let i = 1; i <= seg; i++) {
      const a = a0 + (a1 - a0) * i / seg;
      pts.push([cx + R * Math.cos(a), cz + R * Math.sin(a)]);
    }
  };
  // 底边（外凸向下）：(-hw+R,-hd) → (hw-R,-hd)
  bowArc(-hw + R, -hd, hw - R, -hd, 0, -1, bow);
  // 右下角：圆心 (hw-R, -hd+R)，-90°→0°
  arc(hw - R, -hd + R, -Math.PI / 2, 0);
  // 右边（外凸向右）：(hw,-hd+R) → (hw,hd-R)
  bowArc(hw, -hd + R, hw, hd - R, 1, 0, bow);
  // 右上角：0°→90°
  arc(hw - R, hd - R, 0, Math.PI / 2);
  // 顶边（外凸向上）：(hw-R,hd) → (-hw+R,hd)
  bowArc(hw - R, hd, -hw + R, hd, 0, 1, bow);
  // 左上角：90°→180°
  arc(-hw + R, hd - R, Math.PI / 2, Math.PI);
  // 左边（外凸向左）：(-hw,hd-R) → (-hw,-hd+R)
  bowArc(-hw, hd - R, -hw, -hd + R, -1, 0, bow);
  // 左下角：180°→270°
  arc(-hw + R, -hd + R, Math.PI, Math.PI * 3 / 2);
  return pts;
}

/** dish 曲面高度附加（负=凹入，正=凸出）；tx/tz 为顶面局部坐标（中心原点，z=深度方向） */
function dishOffset(dish, tx, tz, topW, topD, depth) {
  if (!depth || dish === 'flat' || dish === 'disable') return 0;
  if (dish === 'cylindrical') {
    // 弧沿宽度方向（x）：手指左右贴合；深度方向平直（KeyV2 用 top_total_key_width）
    const c = topW;
    const R = (c * c + 4 * depth * depth) / (8 * depth);
    const sag = R - Math.sqrt(Math.max(0, R * R - tx * tx));
    return -(depth - sag);
  }
  // spherical / dome / squared spherical / squared scoop：对角线弦（KeyV2 用 √(w²+d²)）
  const c = Math.sqrt(topW * topW + topD * topD);
  const R = (c * c + 4 * depth * depth) / (8 * depth);
  const d2 = tx * tx + tz * tz;
  const sag = R - Math.sqrt(Math.max(0, R * R - d2));
  return dish === 'dome' ? (depth - sag) : -(depth - sag);
}

/**
 * 生成键帽网格（KeyV2 多层截面）
 * @param {Object} p - keycapModelParams 输出（baseW/baseD/topW/topD/height/angle/topShape/
 *                     topSkew/dishDepth/corner/slices/sideSculpt/moreSideSculpt/cornerSculpt）
 * @param {Object} [opts] 覆盖项：dish / corner / depth / slices / seg
 */
function keycapGeo(p, opts = {}) {
  const dish = opts.dish === 'auto' || !opts.dish ? (p.topShape || 'cylindrical') : opts.dish;
  const corner = opts.corner != null ? opts.corner : (p.corner != null ? p.corner : 1);
  const depth = opts.depth != null ? opts.depth : (p.dishDepth != null ? p.dishDepth : 0.8);
  const slices = opts.slices != null ? opts.slices : (p.slices || 1);
  const seg = opts.seg || 6;

  const baseW = p.baseW, baseD = p.baseD, topW = p.topW, topD = p.topD;
  const widthDiff = baseW - topW, heightDiff = baseD - topD;
  const totalDepth = p.height;
  const angle = p.angle || 0;
  const topSkew = p.topSkew || 0;
  const sideSculpt = p.sideSculpt || 0;
  const moreSide = p.moreSideSculpt || 0;
  const cornerSculpt = p.cornerSculpt || 0;
  const tiltMax = -angle * Math.PI / 180;   // KeyV2 rotate([-top_tilt]) → 前低后高

  // 1) 逐层截面（KeyV2 placed_shape_slice）
  const rings = [];            // 每层 3D 环点
  const local = [];            // 每层局部 (u, v)（顶层 dish 用）
  for (let k = 0; k <= slices; k++) {
    const prog = k / slices;
    const ss = (1 - prog) * sideSculpt;             // side_sculpting(p)
    const cs = prog * prog * cornerSculpt;          // corner_sculpting(p)
    const w = baseW - (widthDiff - ss) * prog;      // 该层宽
    const d = baseD - (heightDiff - ss) * prog;     // 该层深
    const r = Math.max(0.05, corner + cs);
    const bow = moreSide * prog * 0.5;              // 边弧（side_rounded_square 近似）
    const tilt = tiltMax * prog;
    const depth_p = totalDepth * prog;
    const skew_p = topSkew * prog;
    const cosT = Math.cos(tilt), sinT = Math.sin(tilt);
    const pts = roundedRectPoints(w / 2, d / 2, r, seg, bow);
    const ring = pts.map(([u, v]) => [u, v * sinT + depth_p, v * cosT + skew_p]);
    rings.push(ring);
    local.push(pts);
  }

  // 2) 顶点
  const v = [];
  for (const ring of rings) for (const pt of ring) v.push([pt[0], pt[1], pt[2]]);
  const n = rings[0].length;                       // 每层点数（恒定）
  const layerCount = rings.length;                 // slices+1
  // 顶层 dish 叠加
  const topRing = rings[layerCount - 1], topLocal = local[layerCount - 1];
  for (let i = 0; i < n; i++) {
    const [u, tz] = topLocal[i];
    const off = dishOffset(dish, u, tz, topW, topD, depth);
    v[(layerCount - 1) * n + i][1] += off;
  }
  // 底面中心 / 顶面中心
  const bottomCenter = v.length;
  v.push([0, 0, 0]);
  const dishCenter = dishOffset(dish, 0, 0, topW, topD, depth);
  const topCenter = v.length;
  v.push([0, totalDepth + dishCenter, topSkew]);

  // 3) 面
  const f = [];
  // 侧面：层 k ↔ k+1（索引模式同旧版：外法线朝外）
  for (let k = 0; k < layerCount - 1; k++) {
    const b = k * n, t = (k + 1) * n;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      f.push([b + i, b + j, t + j]);
      f.push([b + i, t + j, t + i]);
    }
  }
  // 底面（朝下）：Cb → B[i+1] → B[i]
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    f.push([bottomCenter, j, i]);
  }
  // 顶面（朝上）：Ct → T[i] → T[i+1]
  const tb = (layerCount - 1) * n;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    f.push([topCenter, tb + i, tb + j]);
  }
  return { vertices: v, faces: f };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { keycapGeo, roundedRectPoints, dishOffset };
}
if (typeof window !== 'undefined') {
  window.KeycapGeo = { keycapGeo, roundedRectPoints, dishOffset };
}
