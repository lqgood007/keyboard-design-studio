'use strict';
/**
 * 定位板 DXF 生成器 —— SwillKB Plate Builder 风格等价实现
 *
 * 核心几何逻辑（与 builder.swillkb.com 一致）：
 *   - 板框：所有按键角点包围盒 + 外扩 (expand)
 *   - 切孔：每个按键一个 MX 标准切孔（14mm 圆角矩形，带 0.5mm 圆角）
 *   - 旋转键：切孔跟随按键旋转角
 *
 * 说明：SwillKB 的官方 kad 引擎是 Python 库且未在 PyPI 发布可用版本
 * （PyPI 上的 "kad" 是无关的 DHT 库），此处按相同几何规则自研实现。
 * 输出为 DXF R12 文本，可直接用于激光切割 / 嘉立创等。
 */

const Drawing = require('dxf-writer');
const { parseKle, keysBounds, rotatedCorners } = require('./kleToKeys');

/**
 * 生成定位板 DXF
 * @param {Array|Object|string} raw - KLE raw data
 * @param {Object} opts
 * @param {number} opts.cutout  - MX 切孔边长（mm），默认 14
 * @param {number} opts.expand  - 板框外扩（mm），默认 5
 * @param {number} opts.cornerRadius - 切孔圆角半径（mm），默认 0.5
 * @param {boolean} opts.screwHoles - 是否生成四角螺丝孔（默认 true）
 * @param {number} opts.screwDia - 螺丝孔直径（mm），默认 3.2（M3）
 * @param {number} opts.screwInset - 螺丝孔距板边距离（mm），默认 6
 * @returns {string} DXF 文本
 */
function generatePlateDxf(raw, opts = {}) {
  const { keys } = parseKle(raw);
  const cutout = opts.cutout ?? 14;
  const expand = opts.expand ?? 5;
  const cornerRadius = opts.cornerRadius ?? 0.5;
  const radius = Math.min(cornerRadius, cutout / 2 - 0.01);
  const screwHoles = opts.screwHoles !== false;
  const screwDia = opts.screwDia ?? 3.2;
  const screwInset = opts.screwInset ?? 6;

  const bounds = keysBounds(keys);
  const plate = {
    x1: bounds.minX - expand, y1: bounds.minY - expand,
    x2: bounds.maxX + expand, y2: bounds.maxY + expand,
  };

  const d = new Drawing();
  d.setUnits('Millimeters');

  // 板框图层（白色）
  d.addLayer('plate', 'CONTINUOUS', 'white');
  d.setActiveLayer('plate');
  d.drawRect(plate.x1, plate.y1, plate.x2, plate.y2);

  // 切孔图层（红色）
  d.addLayer('cutout', 'CONTINUOUS', 'red');
  d.setActiveLayer('cutout');
  for (const k of keys) {
    drawRoundedRectCutout(d, k.cx, k.cy, cutout, radius, k.rot);
  }

  // 螺丝孔图层（青色）
  if (screwHoles && screwDia > 0) {
    d.addLayer('screw', 'CONTINUOUS', 'cyan');
    d.setActiveLayer('screw');
    const r = screwDia / 2;
    const pts = [
      [plate.x1 + screwInset, plate.y1 + screwInset],
      [plate.x2 - screwInset, plate.y1 + screwInset],
      [plate.x1 + screwInset, plate.y2 - screwInset],
      [plate.x2 - screwInset, plate.y2 - screwInset],
    ];
    for (const [sx, sy] of pts) d.drawCircle(sx, sy, r);
  }

  return d.toDxfString();
}

/**
 * 画一个（可旋转的）圆角矩形切孔
 * 用 4 条直线 + 4 段圆弧构成圆角矩形轮廓；radius <= 0 时为方角
 */
function drawRoundedRectCutout(d, cx, cy, size, radius, rotDeg) {
  const rot = (rotDeg || 0) * Math.PI / 180;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const half = size / 2;

  // 局部坐标 -> 世界坐标
  const rotPoint = (lx, ly) => [cx + lx * cos - ly * sin, cy + lx * sin + ly * cos];

  if (radius <= 0) {
    // 方角：直接连 4 角
    const pts = [
      rotPoint(-half, -half), rotPoint(half, -half),
      rotPoint(half, half), rotPoint(-half, half),
    ];
    for (let i = 0; i < 4; i++) {
      d.drawLine(pts[i][0], pts[i][1], pts[(i + 1) % 4][0], pts[(i + 1) % 4][1]);
    }
    return;
  }

  const inner = half - radius;
  // 圆弧中心（4 个角），局部坐标
  const arcCenters = [
    { lx: -inner, ly: -inner, start: 180, end: 270 },
    { lx: inner, ly: -inner, start: 270, end: 360 },
    { lx: inner, ly: inner, start: 0, end: 90 },
    { lx: -inner, ly: inner, start: 90, end: 180 },
  ];
  // 直线端点（每个圆弧两侧的切点），局部坐标
  const tangent = (lx, ly, angle) => {
    const a = angle * Math.PI / 180;
    return rotPoint(lx + radius * Math.cos(a), ly + radius * Math.sin(a));
  };

  const lines = [];
  const arcs = [];
  for (const c of arcCenters) {
    const center = rotPoint(c.lx, c.ly);
    arcs.push({ cx: center[0], cy: center[1], r: radius, start: c.start + (rotDeg || 0), end: c.end + (rotDeg || 0) });
  }
  // 切线端点：第 i 段圆弧的 end 切点 连到 第 i+1 段圆弧的 start 切点
  for (let i = 0; i < 4; i++) {
    const c1 = arcCenters[i];
    const c2 = arcCenters[(i + 1) % 4];
    const p1 = tangent(c1.lx, c1.ly, c1.end);
    const p2 = tangent(c2.lx, c2.ly, c2.start);
    lines.push([p1, p2]);
  }

  for (const [p1, p2] of lines) d.drawLine(p1[0], p1[1], p2[0], p2[1]);
  for (const a of arcs) d.drawArc(a.cx, a.cy, a.r, a.start, a.end);
}

module.exports = { generatePlateDxf };
