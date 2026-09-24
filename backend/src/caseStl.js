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
function loftRect(baseSize, topSize, baseR, topR, height, slices = 12) {
  // base 必须与第一 slice 轮廓一致（圆角），否则 capStart 封底与侧面带不匹配留下边界边
  const base = extrusions.slice.fromPoints(roundedPts(baseSize[0], baseSize[1], baseR, 0));
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
/* 一体外壳框架：底部柱体(w×h) + 面板倒角截锥(w×h→w-2c×h-2c)，单件无 union 共面 */
/* 底板/面板基体（无孔，供分件使用） */
function makeBaseBottom(w, h, bottomThickness, cornerRadius) {
  return cornerRadius > 1e-6
    ? extrusions.extrudeLinear({ height: bottomThickness },
        primitives.roundedRectangle({ size: [w, h], roundRadius: cornerRadius }))
    : extrusions.extrudeLinear({ height: bottomThickness },
        primitives.rectangle({ size: [w, h] }));
}
function makeBasePlate(w, h, bottomThickness, plateThickness, cornerRadius, chamfer) {
  if (chamfer > 1e-6) {
    return loftRect([w, h], [w - 2 * chamfer, h - 2 * chamfer],
      cornerRadius, Math.max(0, cornerRadius - chamfer), plateThickness);
  }
  return cornerRadius > 1e-6
    ? extrusions.extrudeLinear({ height: plateThickness },
        primitives.roundedRectangle({ size: [w, h], roundRadius: cornerRadius }))
    : extrusions.extrudeLinear({ height: plateThickness },
        primitives.rectangle({ size: [w, h] }));
}

function caseFrame(w, h, bottomThickness, plateThickness, cornerRadius, chamfer, slices = 16) {
  const totalH = bottomThickness + plateThickness;
  if (chamfer <= 1e-6) {
    const base = cornerRadius > 1e-6
      ? primitives.roundedRectangle({ size: [w, h], roundRadius: cornerRadius })
      : primitives.rectangle({ size: [w, h] });
    return extrusions.extrudeLinear({ height: totalH }, base);
  }
  return extrusions.extrudeFromSlices({
    numberOfSlices: Math.max(8, slices),
    capStart: true,
    capEnd: true,
    callback: (progress) => {
      const z = progress * totalH;
      let cw = w, ch = h, r = cornerRadius;
      if (z > bottomThickness) {
        const t = (z - bottomThickness) / plateThickness;
        cw = w - 2 * chamfer * t;
        ch = h - 2 * chamfer * t;
        r = Math.max(0, cornerRadius - chamfer * t);
      }
      return extrusions.slice.fromPoints(roundedPts(cw, ch, r, z));
    },
  }, extrusions.slice.fromPoints(roundedPts(w, h, cornerRadius, 0)));
}

/* 垂直螺丝通孔（沿 z 轴，从 zBase 向上贯穿） */
function screwHolesAt(positions, radius, height, zBase) {
  const cyl = primitives.cylinder({ radius, height, segments: 24 });
  return positions.map(([x, y]) => transforms.translate([x, y, zBase], cyl));
}

function generateCaseStl(raw, opts = {}) {
  const { keys } = parseKle(raw);
  const cutout = opts.cutout ?? 14;
  const expand = opts.expand ?? 5;
  const bottomThickness = opts.bottomThickness ?? 3;
  const plateThickness = opts.plateThickness ?? 1.5;
  const screwHoles = opts.screwHoles !== false;
  const screwDia = opts.screwDia ?? 3.2;
  const cornerRadius = opts.cornerRadius ?? 0;
  // 螺丝孔中心需避开四角圆角：孔缘到圆角弧心距离 > 0
  //   min inset = cornerRadius + screwDia/2 + 3（留 3mm 安全壁厚），下限 6
  const screwInset = opts.screwInset ?? Math.max(6, cornerRadius + screwDia / 2 + 3);
  const chamfer = opts.chamfer ?? 0;
  const layerMode = opts.layerMode ?? 'single';

  const bounds = keysBounds(keys);
  const w = bounds.maxX - bounds.minX + expand * 2;
  const h = bounds.maxY - bounds.minY + expand * 2;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;

  /* 1) 键切孔：面板层盲孔（合并件）与贯穿孔（分件 plate） */
  const keyHolesBlind = keys.map((k) => {
    const rot = (k.rot || 0) * Math.PI / 180;
    let hole = extrusions.extrudeLinear(
      { height: plateThickness },
      primitives.rectangle({ size: [cutout, cutout] })
    );
    if (rot !== 0) hole = transforms.rotate([0, 0, rot], hole);
    return transforms.translate([k.cx - cx, k.cy - cy, bottomThickness], hole);
  });
  const keyHolesThru = keys.map((k) => {
    const rot = (k.rot || 0) * Math.PI / 180;
    let hole = extrusions.extrudeLinear(
      { height: plateThickness + 1 },
      primitives.rectangle({ size: [cutout, cutout] })
    );
    if (rot !== 0) hole = transforms.rotate([0, 0, rot], hole);
    return transforms.translate([k.cx - cx, k.cy - cy, bottomThickness - 0.01], hole);
  });

  /* 2) 螺丝通孔（垂直，沿 z 轴贯穿） */
  const screwR = screwDia / 2;
  const positions = [
    [-w / 2 + screwInset, -h / 2 + screwInset],
    [w / 2 - screwInset, -h / 2 + screwInset],
    [-w / 2 + screwInset, h / 2 - screwInset],
    [w / 2 - screwInset, h / 2 - screwInset],
  ];
  const screwCase = screwHolesAt(positions, screwR, bottomThickness + plateThickness + 1, -0.5);
  const screwBottom = screwHolesAt(positions, screwR, bottomThickness + 1, -0.5);

  /* 3) 底板 / 面板分件（各自封闭，split 模式用，统一全局坐标） */
  let bottomFinal = makeBaseBottom(w, h, bottomThickness, cornerRadius);
  if (screwHoles && screwDia > 0) {
    bottomFinal = booleans.subtract(bottomFinal, screwBottom);
  }
  let plateFinal = transforms.translate([0, 0, bottomThickness],
    makeBasePlate(w, h, bottomThickness, plateThickness, cornerRadius, chamfer));
  // 面板只挖键切孔：分件打印时螺丝孔由底板承担，避免孔壁穿过曲面产生非流形边
  plateFinal = booleans.subtract(plateFinal, keyHolesThru);

  /* 4) 合并件（预览/单件打印）：一体框架 - 盲孔 - 贯穿螺丝孔 */
  let caseGeom = caseFrame(w, h, bottomThickness, plateThickness, cornerRadius, chamfer);
  caseGeom = booleans.subtract(caseGeom, keyHolesBlind);
  if (screwHoles && screwDia > 0) {
    caseGeom = booleans.subtract(caseGeom, screwCase);
  }

  const serialize = (geom) => {
    const stl = stlSerializer.serialize({ binary: false }, geom);
    return Array.isArray(stl) ? stl.join('\n') : String(stl);
  };

  return {
    case: serialize(caseGeom),
    bottom: serialize(bottomFinal),
    plate: serialize(plateFinal),
    layerMode,
  };
}

/**
 * 中间板（定位板）STL：板框挤出 + 键切孔（旋转跟随）+ 可选螺丝孔
 * 独立可调尺寸：thickness / cutout / expand / cornerRadius / screwHoles
 * @param {Array|Object|string} raw - KLE raw data
 * @param {Object} opts
 *   thickness  板厚 mm（默认 1.5）
 *   cutout     键切孔边长 mm（默认 14）
 *   expand     板框外扩 mm（默认 5）
 *   cornerRadius 板框四角圆角 mm（默认 2）
 *   screwHoles 四角螺丝孔（默认 true）
 *   screwDia   螺丝孔径 mm（默认 3.2）
 *   screwInset 螺丝孔距边 mm（默认 6）
 * @returns {string} ASCII STL
 */
function generatePlateStl(raw, opts = {}) {
  const { keys } = parseKle(raw);
  const thickness = opts.thickness ?? 1.5;
  const cutout = opts.cutout ?? 14;
  const expand = opts.expand ?? 5;
  const cornerRadius = opts.cornerRadius ?? 2;
  const screwHoles = opts.screwHoles !== false;
  const screwDia = opts.screwDia ?? 3.2;
  const screwInset = opts.screwInset ?? 6;

  const bounds = keysBounds(keys);
  const w = bounds.maxX - bounds.minX + expand * 2;
  const h = bounds.maxY - bounds.minY + expand * 2;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;

  // 板框（圆角可选）
  const base = cornerRadius > 1e-6
    ? primitives.roundedRectangle({ size: [w, h], roundRadius: cornerRadius })
    : primitives.rectangle({ size: [w, h] });
  let geom = extrusions.extrudeLinear({ height: thickness }, base);

  // 键切孔（垂直贯穿，旋转键跟随）+ 螺丝孔：先 union 成单个减体，一次 subtract
  // （避免多次 subtract 在底面圆孔环处产生 T 形交点/边界边）
  const allHoles = keys.map((k) => {
    const rot = (k.rot || 0) * Math.PI / 180;
    let hole = extrusions.extrudeLinear({ height: thickness + 1 },
      primitives.rectangle({ size: [cutout, cutout] }));
    if (rot !== 0) hole = transforms.rotate([0, 0, rot], hole);
    return transforms.translate([k.cx - cx, k.cy - cy, -0.01], hole);
  });
  if (screwHoles && screwDia > 0) {
    // 圆角方孔（4.5×4.5 / r0.5，可穿 M3）：与键孔同为方孔类几何，
    // 避免 jscad 在多批贯穿孔中对圆柱孔底面缝合失败（12 条边界边）
    const side = screwDia * 1.4;
    const positions = [
      [-w / 2 + screwInset, -h / 2 + screwInset],
      [w / 2 - screwInset, -h / 2 + screwInset],
      [-w / 2 + screwInset, h / 2 - screwInset],
      [w / 2 - screwInset, h / 2 - screwInset],
    ];
    for (const [x, y] of positions) {
      const sq = extrusions.extrudeLinear({ height: thickness + 1 },
        primitives.roundedRectangle({ size: [side, side], roundRadius: Math.min(0.5, screwDia * 0.15) }));
      allHoles.push(transforms.translate([x, y, -0.5], sq));
    }
  }
  geom = booleans.subtract(geom, booleans.union(...allHoles));

  const stl = stlSerializer.serialize({ binary: false }, geom);
  return Array.isArray(stl) ? stl.join('\n') : String(stl);
}

module.exports = { generateCaseStl, generatePlateStl };
