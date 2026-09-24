'use strict';
/**
 * KLE (Keyboard Layout Editor) 数据解析模块
 * 基于 kle-serial 库（ergogen 同款解析器），把 KLE raw data 转为按键几何列表。
 *
 * KLE raw data 格式：
 *   [ 行数组, ... ]
 *   行内元素：字符串（1u 按键标签）或对象（{x, y, w, h, r, rx, ry, ...}）
 *   坐标单位：1u = 19.05mm，y 轴向下
 */

const kle = require('kle-serial');

const U = 19.05; // 1u 间距（mm）

/**
 * 解析 KLE raw data
 * @param {Array|Object|string} raw - KLE raw data（数组 / KLE JSON 对象 / 字符串）
 * @returns {{keys: Array, meta: Object}} keys: [{index, cx, cy, w, h, rot, label}]
 *   坐标已转为毫米、键中心坐标、y 轴向上（右手系，方便 DXF/STL 直接使用）
 */
function parseKle(raw) {
  let keyboard;
  try {
    keyboard = kle.Serial.deserialize(raw);
  } catch (e) {
    throw new Error('无效的 KLE 数据: ' + e.message);
  }

  const keys = (keyboard.keys || []).map((k, i) => {
    // KLE: x/y 为左上角（单位 u），y 向下
    const w = (k.width || 1) * U;
    const h = (k.height || 1) * U;
    const cx = (k.x + (k.width || 1) / 2) * U;
    const cy = -(k.y + (k.height || 1) / 2) * U; // y 翻转 -> 向上
    return {
      index: i,
      cx,
      cy,
      w,
      h,
      rot: k.rotation_x || 0, // 旋转角（度）
      label: ((k.labels || []).find(Boolean) || '').toString(),
      raw: k,
    };
  });

  return { keys, meta: keyboard.meta || {} };
}

/**
 * 按键包围盒（含旋转后的角点）
 * @returns {{minX, minY, maxX, maxY}}
 */
function keysBounds(keys) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of keys) {
    for (const [x, y] of rotatedCorners(k.cx, k.cy, k.w, k.h, k.rot)) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

/**
 * 计算一个矩形（中心 cx,cy，宽 w 高 h）旋转 rot 度后的 4 个角点
 * 局部坐标系：x 向右，y 向上
 */
function rotatedCorners(cx, cy, w, h, rotDeg) {
  const rot = (rotDeg || 0) * Math.PI / 180;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const hw = w / 2, hh = h / 2;
  const corners = [];
  for (const [lx, ly] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) {
    corners.push([
      cx + lx * cos - ly * sin,
      cy + lx * sin + ly * cos,
    ]);
  }
  return corners;
}

module.exports = { U, parseKle, keysBounds, rotatedCorners };
