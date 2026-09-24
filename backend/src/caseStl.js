'use strict';
/**
 * 外壳 STL 生成器（@jscad/modeling v2 自研建模）
 *
 * 模型：
 *   - 底板：板框（按键包围盒外扩，支持圆角）挤出 bottomThickness
 *   - 面板：板框（支持圆角、顶部倒角）挤出 plateThickness，减去所有按键切孔（MX 14mm，旋转键跟随）
 *   - 分层打印：可选输出底板/面板独立 STL（case_bottom.stl + case_plate.stl），便于分色/分件打印
 *
 * 参数化（options）：
 *   - cornerRadius: 外壳四角圆角半径 mm（默认 0 = 直角；常见 1/2/3/5）
 *   - chamfer:      面板上边缘倒角 mm（默认 0 = 直角；常见 0.5/1/1.5/2，倒角宽度沿顶面内缩）
 *   - layerMode:    'single'（默认，合并单件 case.stl）| 'split'（分层，case.stl + 底板/面板分件）
 *
 * 说明：ergogen 的 cases 输出是 openjscad v1 风格脚本（makerjs toJscadScript 生成，
 * 使用 CAG 对象方法 API），与 @jscad/modeling v2 函数式 API 不兼容；
 * 故外壳 STL 在此用 v2 直接建模（几何与 ergogen case 脚本一致），
 * 同时保留 ergogen 输出的 .jscad 脚本作为可编辑源文件。
 */

const { primitives, transforms, booleans, extrusions, measurements } = require('@jscad/modeling');
const { stlSerializer } = require('@jscad/io');
const { parseKle, keysBounds, rotatedCorners } = require('./kleToKeys');

/* ---- 圆角矩形轮廓点（CCW，含圆弧角） ---- */
function roundedPts(w, h, r, z) {
  const pts = [];
  if (!(r > 1e-6)) {
    const hw = w / 2, hh = h / 2;
    pts.push([-hw, -hh, z], [hw, -hh, z], [hw, hh, z], [-hw, hh, z]);
    return pts;
  }
  const hw = w / 2 - r, hh = h / 2 - r;
  const seg = 5;
  const cx = [hw, hw, -hw, -hw], cy = [-hh, hh, hh, -hh];
  const a0 = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i <= seg; i++) {
      const a = a0[k] + (Math.PI / 2) * i / seg;
      pts.push([cx[k] + r * Math.cos(a), cy[k] + r * Math.sin(a), z]);
    }
  }
  return pts;
}

/* 放样：底部矩形(可圆角) → 顶部矩形(可圆角+倒角内缩) 的截锥体 */
function loftRect(baseSize, topSize, baseR, topR, height, slices = 4) {
  const base = primitives.rectangle({ size: baseSize });
  return extrusions.extrudeFromSlices({
    numberOfSlices: Math.max(2, slices),
    capStart: true,
    capEnd: true,
    callback: (progress) => {
      const w = baseSize[0] + (topSize[0] - baseSize[0]) * progress;
      const h = baseSize[1] + (topSize[1] - baseSize[1]) * progress;
      const r = baseR + (topR - baseR) * progress;
      return extrusions.slice.fromPoints(roundedPts(w, h, r, progress * height));
    },
  }, base);
}

/**
 * 生成外壳 STL（ASCII）
 * @param {Array|Object|string} raw - KLE raw data
 * @param {Object} opts
 * @param {number} opts.cutout - 切孔边长（mm）默认 14
 * @param {number} opts.expand - 板框外扩（mm）默认 5
 * @param {number} opts.bottomThickness - 底板厚（mm）默认 3
 * @param {number} opts.plateThickness - 面板厚（mm）默认 1.5
 * @param {boolean} opts.screwHoles - 是否生成四角螺丝孔（默认 true）
 * @param {number} opts.screwDia - 螺丝孔直径（mm）默认 3.2（M3）
 * @param {number} opts.screwInset - 螺丝孔距板边距离（mm）默认 6
 * @param {number} opts.cornerRadius - 外壳四角圆角（mm）默认 0
 * @param {number} opts.chamfer - 面板上缘倒角（mm）默认 0
 * @param {string} opts.layerMode - 'single' | 'split'（默认 single）
 * @returns {Object} { case, bottom, plate } 三段 ASCII STL（case 为合并件）
 */
function generateCaseStl(raw, opts = {}) {
  const { keys } = parseKle(raw);
  const cutout = opts.cutout ?? 14;
  const expand = opts.expand ?? 5;
  const bottomThickness = opts.bottomThickness ?? 3;
  const plateThickness = opts.plateThickness ?? 1.5;
  const screwHoles = opts.screwHoles !== false;
  const screwDia = opts.screwDia ?? 3.2;
  const screwInset = opts.screwInset ?? 6;
  const cornerRadius = opts.cornerRadius ?? 0;
  const chamfer = opts.chamfer ?? 0;
  const layerMode = opts.layerMode ?? 'single';

  const bounds = keysBounds(keys);
  const w = bounds.maxX - bounds.minX + expand * 2;
  const h = bounds.maxY - bounds.minY + expand * 2;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;

  /* 1) 底板（可圆角） */
  let bottom;
  if (cornerRadius > 1e-6) {
    bottom = extrusions.extrudeLinear(
      { height: bottomThickness },
      primitives.roundedRectangle({ size: [w, h], roundRadius: cornerRadius })
    );
  } else {
    bottom = extrusions.extrudeLinear(
      { height: bottomThickness },
      primitives.rectangle({ size: [w, h] })
    );
  }

  /* 2) 面板（可圆角 + 上缘倒角），带切孔 */
  let plate;
  if (chamfer > 1e-6) {
    // 截锥体：底部 w×h → 顶部内缩 chamfer（45° 倒角），高度 plateThickness
    plate = loftRect([w, h], [w - 2 * chamfer, h - 2 * chamfer],
      cornerRadius, Math.max(0, cornerRadius - chamfer), plateThickness);
  } else if (cornerRadius > 1e-6) {
    plate = extrusions.extrudeLinear(
      { height: plateThickness },
      primitives.roundedRectangle({ size: [w, h], roundRadius: cornerRadius })
    );
  } else {
    plate = extrusions.extrudeLinear(
      { height: plateThickness },
      primitives.rectangle({ size: [w, h] })
    );
  }

  /* 切孔（垂直贯穿，旋转键跟随） */
  const holes = keys.map((k) => {
    const rot = (k.rot || 0) * Math.PI / 180;
    let hole = extrusions.extrudeLinear(
      { height: plateThickness + 1 },
      primitives.rectangle({ size: [cutout, cutout] })
    );
    if (rot !== 0) {
      hole = transforms.rotate([0, 0, rot], hole);
    }
    return transforms.translate([k.cx - cx, k.cy - cy, -0.01], hole);
  });
  plate = booleans.subtract(plate, holes);

  /* 3) 螺丝通孔（贯穿，底板/面板各自挖） */
  const screwR = screwDia / 2;
  const screw = primitives.cylinder({
    radius: screwR,
    height: Math.max(bottomThickness, plateThickness) + 4,
    segments: 24,
  });
  const positions = [
    [-w / 2 + screwInset, -h / 2 + screwInset],
    [w / 2 - screwInset, -h / 2 + screwInset],
    [-w / 2 + screwInset, h / 2 - screwInset],
    [w / 2 - screwInset, h / 2 - screwInset],
  ];
  if (screwHoles && screwDia > 0) {
    const bottomHoles = positions.map(([x, y]) =>
      transforms.translate([x, y, -2], transforms.rotateX(Math.PI / 2, screw))
    );
    bottom = booleans.subtract(bottom, bottomHoles);
    const plateHoles = positions.map(([x, y]) =>
      transforms.translate([x, y, -2], transforms.rotateX(Math.PI / 2, screw))
    );
    plate = booleans.subtract(plate, plateHoles);
  }

  /* 4) 合并件（预览/单件打印用） */
  const caseGeom = booleans.union(
    transforms.translate([0, 0, 0], bottom),
    transforms.translate([0, 0, bottomThickness], plate)
  );

  const serialize = (geom) => {
    const stl = stlSerializer.serialize({ binary: false }, geom);
    return Array.isArray(stl) ? stl.join('\n') : String(stl);
  };

  return {
    case: serialize(caseGeom),
    bottom: serialize(bottom),
    plate: serialize(plate),
    layerMode,
  };
}

module.exports = { generateCaseStl };
