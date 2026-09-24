'use strict';
/**
 * 外壳 STL 生成器（@jscad/modeling v2 自研建模）
 *
 * 模型：
 *   - 底板：板框（按键包围盒外扩）挤出 bottomThickness
 *   - 面板：板框挤出 plateThickness，减去所有按键切孔（MX 14mm，旋转键跟随）
 *
 * 说明：ergogen 的 cases 输出是 openjscad v1 风格脚本（makerjs toJscadScript 生成，
 * 使用 CAG 对象方法 API），与 @jscad/modeling v2 函数式 API 不兼容；
 * 故外壳 STL 在此用 v2 直接建模（几何与 ergogen case 脚本一致），
 * 同时保留 ergogen 输出的 .jscad 脚本作为可编辑源文件。
 */

const { primitives, transforms, booleans, extrusions } = require('@jscad/modeling');
const { stlSerializer } = require('@jscad/io');
const { parseKle, keysBounds, rotatedCorners } = require('./kleToKeys');

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
 * @returns {string} ASCII STL
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

  const bounds = keysBounds(keys);
  const w = bounds.maxX - bounds.minX + expand * 2;
  const h = bounds.maxY - bounds.minY + expand * 2;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;

  // 底板
  const bottom = extrusions.extrudeLinear(
    { height: bottomThickness },
    primitives.rectangle({ size: [w, h] })
  );

  // 面板（带切孔）
  let plate = extrusions.extrudeLinear(
    { height: plateThickness },
    primitives.rectangle({ size: [w, h] })
  );

  const holes = keys.map((k) => {
    const rot = (k.rot || 0) * Math.PI / 180;
    let hole = extrusions.extrudeLinear(
      { height: plateThickness + 1 },
      primitives.rectangle({ size: [cutout, cutout] })
    );
    // 旋转键的切孔跟随旋转
    if (rot !== 0) {
      hole = transforms.rotate([0, 0, rot], hole);
    }
    // 平移到板中心相对坐标（@jscad 原点为中心）
    return transforms.translate([k.cx - cx, k.cy - cy, 0], hole);
  });

  plate = booleans.subtract(plate, holes);

  let caseGeom = booleans.union(bottom, plate);

  // 四角螺丝通孔（贯穿底板+面板）
  if (screwHoles && screwDia > 0) {
    const screwR = screwDia / 2;
    const screw = primitives.cylinder({
      radius: screwR,
      height: bottomThickness + plateThickness + 2,
      segments: 24,
    });
    const positions = [
      [-w / 2 + screwInset, -h / 2 + screwInset],
      [w / 2 - screwInset, -h / 2 + screwInset],
      [-w / 2 + screwInset, h / 2 - screwInset],
      [w / 2 - screwInset, h / 2 - screwInset],
    ];
    const screwHoles = positions.map(([x, y]) => transforms.translate([x, y, -1], screw));
    caseGeom = booleans.subtract(caseGeom, screwHoles);
  }

  // ASCII STL（stlSerializer.serialize 返回数组）
  const stl = stlSerializer.serialize({ binary: false }, caseGeom);
  return Array.isArray(stl) ? stl.join('\n') : String(stl);
}

module.exports = { generateCaseStl };
