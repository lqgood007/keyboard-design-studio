'use strict';
/** build_presets_data.js —— 预设数据源（供 build_presets.js / repair_app.js 共用） */
const fs = require('fs');
const path = require('path');

const KLE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tmp_kle_layouts.json'), 'utf8'));
const byName = {};
for (const p of KLE.presets) byName[p.name] = p.data;

function cl(s) {
  if (typeof s !== 'string') return s;
  return s.split('\n')[0].replace(/<br\s*\/?>/gi, '').trim();
}
function cv(rows) {
  return rows.map(row => row.map(item => {
    if (typeof item === 'string') return cl(item);
    if (item && typeof item === 'object') {
      const o = {};
      for (const k of ['x', 'y', 'w', 'h', 'r', 'rx', 'ry']) if (item[k] != null) o[k] = item[k];
      return o;
    }
    return item;
  }));
}

const PRESETS = {
  '60': cv(byName['Default 60%']),
  '60iso': cv(byName['ISO 60%']),
  '65': [
    ['Esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', { w: 2 }, 'Backspace', { x: 0.25 }, 'Del'],
    [{ w: 1.5 }, 'Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', { w: 1.5 }, '\\', { x: 0.25 }, 'PgUp'],
    [{ w: 1.75 }, 'Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", { w: 2.25 }, 'Enter', { x: 0.25 }, 'PgDn'],
    [{ w: 2.25 }, 'Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', { w: 1.75 }, 'Shift', { x: 0.25 }, 'Up'],
    [{ w: 1.25 }, 'Ctrl', { w: 1.25 }, 'Win', { w: 1.25 }, 'Alt', { w: 6.25 }, 'Space', { w: 1.25 }, 'Alt', { w: 1.25 }, 'Fn', { w: 1.25 }, 'Ctrl', { x: 0.25 }, 'Left', 'Down', 'Right'],
  ],
  '68': [
    ['Esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', { w: 2 }, 'Backspace', 'Del'],
    [{ w: 1.5 }, 'Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', { w: 1.5 }, '\\', 'PgUp'],
    [{ w: 1.75 }, 'Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", { w: 2.25 }, 'Enter', 'PgDn'],
    [{ w: 2.25 }, 'Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', { w: 1.75 }, 'Shift', 'Up'],
    [{ w: 1.25 }, 'Ctrl', { w: 1.25 }, 'Win', { w: 1.25 }, 'Alt', { w: 6.25 }, 'Space', { w: 1.25 }, 'Alt', { w: 1.25 }, 'Fn', { w: 1.25 }, 'Ctrl', 'Left', 'Down', 'Right'],
  ],
  'tkl': [
    ['Esc', { x: 1 }, 'F1', 'F2', 'F3', 'F4', { x: 0.5 }, 'F5', 'F6', 'F7', 'F8', { x: 0.5 }, 'F9', 'F10', 'F11', 'F12', { x: 0.25 }, 'PrtSc', 'Scrlk', 'Pause'],
    [{ y: 0.5 }, '`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', { w: 2 }, 'Backspace', { x: 0.25 }, 'Ins', 'Home', 'PgUp'],
    [{ w: 1.5 }, 'Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', { w: 1.5 }, '\\', { x: 0.25 }, 'Del', 'End', 'PgDn'],
    [{ w: 1.75 }, 'Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", { w: 2.25 }, 'Enter'],
    [{ w: 2.25 }, 'Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', { w: 2.75 }, 'Shift', { x: 1.25 }, 'Up'],
    [{ w: 1.25 }, 'Ctrl', { w: 1.25 }, 'Win', { w: 1.25 }, 'Alt', { w: 6.25 }, 'Space', { w: 1.25 }, 'Alt', { w: 1.25 }, 'Win', { w: 1.25 }, 'Menu', { w: 1.25 }, 'Ctrl', { x: 0.25 }, 'Left', 'Down', 'Right'],
  ],
  '75c': cv(byName['Keycool 84']),
  '96': [
    [{ x: 0.5 }, 'Esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', { x: 0.5 }, 'PrtSc', 'Scrlk', 'Pause'],
    [{ x: 0.25 }, '`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', { w: 2 }, 'Backspace', { x: 0.25 }, 'Ins', 'Home', 'PgUp', 'NumLk', '/', '*', '-'],
    [{ x: 0.25 }, 'Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', { w: 1.5 }, '\\', { x: 0.25 }, 'Del', 'End', 'PgDn', '7', '8', '9', '+'],
    [{ x: 0.5 }, 'Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", { w: 2 }, 'Enter', { x: 0.25 }, '', '', '', '4', '5', '6', '+'],
    [{ x: 0.5 }, 'Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', { w: 2 }, 'Shift', { x: 0.25 }, 'Up', '', '', '1', '2', '3'],
    [{ x: 0.25, w: 1.5 }, 'Ctrl', { w: 1.5 }, 'Win', { w: 1.5 }, 'Alt', { w: 6.25 }, 'Space', { w: 1.25 }, 'Alt', { w: 1.5 }, 'Fn', { w: 1.5 }, 'Ctrl', { x: 0.25 }, 'Left', 'Down', 'Right', { w: 2 }, '0', { w: 2 }, 'Enter'],
  ],
  '100': cv(byName['ANSI 104']),
  '100iso': cv(byName['ISO 105']),
  'ortho': [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'Enter'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Shift', 'Shift'],
    [{ w: 1.5 }, 'Ctrl', { w: 1.5 }, 'Alt', { w: 2 }, 'Space', { w: 2 }, 'Space', { w: 2 }, 'Alt', { w: 1.5 }, 'Ctrl', { w: 1.5 }],
  ],
  'planck': cv(byName['Planck']),
  'preonic': [
    ['Esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Backspace'],
    [{ x: 0.5 }, 'Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '-'],
    [{ x: 0.5 }, 'Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"],
    [{ x: 0.5 }, 'Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'],
    [{ x: 1, w: 1.5 }, 'Ctrl', { w: 1.5 }, 'Alt', { w: 2.5 }, 'Space', { w: 2.5 }, 'Space', { w: 1.5 }, 'Alt', { w: 1.5 }, 'Ctrl'],
  ],
  'minivan': [
    ['Esc', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Backspace'],
    [{ w: 1.25 }, 'Tab', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', { w: 1.75 }, 'Enter'],
    [{ w: 1.75 }, 'Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', { w: 1.25 }, 'Shift'],
    [{ w: 1.5 }, 'Ctrl', { w: 1.25 }, 'Super', { w: 1.25 }, 'Alt', { w: 2.25 }, 'Space', { w: 1.25 }, 'Alt', { w: 1.25 }, 'Super', { w: 1.5 }, 'Ctrl'],
  ],
  'gherkin': [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'],
  ],
  'hhkb': [
    ['Esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', '`', 'Backspace'],
    [{ w: 1.5 }, 'Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', { w: 1.5 }, '\\'],
    [{ w: 1.75 }, 'Ctrl', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", { w: 2.25 }, 'Enter'],
    [{ w: 2.25 }, 'Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', { w: 1.75 }, 'Shift', 'Fn'],
    [{ x: 1.5 }, 'Fn', { w: 1.5 }, 'Meta', { w: 6 }, 'Space', { w: 1.5 }, 'Meta', 'Fn'],
  ],
  'wkl': [
    ['Esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', { w: 2 }, 'Backspace'],
    [{ w: 1.5 }, 'Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', { w: 1.5 }, '\\'],
    [{ w: 1.75 }, 'Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", { w: 2.25 }, 'Enter'],
    [{ w: 2.25 }, 'Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', { w: 2.75 }, 'Shift'],
    [{ w: 1.25 }, 'Ctrl', { w: 1.25 }, 'Alt', { w: 6.25 }, 'Space', { w: 1.25 }, 'Alt', { w: 1.25 }, 'Fn', { w: 1.25 }, 'Ctrl'],
  ],
  'alice': [
    ['Esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
    ['Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'],
    [{ w: 1.75 }, 'Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", { w: 2.25 }, 'Enter'],
    [{ w: 2.25 }, 'Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'],
    [{ w: 1.5 }, 'Ctrl', { w: 1.5 }, 'Alt', { w: 2.25 }, 'Space', { w: 2.75 }, 'Space', { w: 1.5 }, 'Alt', { w: 1.5 }, 'Ctrl'],
  ],
  'arisu': [
    [{ x: 1 }, 'Esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', { w: 2 }, 'Backspace'],
    [{ x: 1 }, 'Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
    [{ x: 1.5 }, 'Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", { w: 2 }, 'Enter'],
    [{ x: 1.5 }, 'Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', { w: 2 }, 'Shift'],
    [{ w: 1.5 }, 'Ctrl', { w: 1.5 }, 'Alt', { w: 2.25 }, 'Space', { w: 2.25 }, 'Space', { w: 1.5 }, 'Alt', { w: 1.5 }, 'Ctrl', { x: 0.25 }, 'Left', 'Down', 'Right'],
  ],
  'ergodox': cv(byName['ErgoDox']),
  'atreus': cv(byName['Atreus']),
  'corne': [
    ['Q', 'W', 'E', 'R', 'T', 'Y', { x: 3 }, 'U', 'I', 'O', 'P', '[', ']'],
    [{ x: 0.25 }, 'A', 'S', 'D', 'F', 'G', 'H', { x: 2.75 }, 'J', 'K', 'L', ';', "'", '#'],
    [{ x: 0.5 }, 'Z', 'X', 'C', 'V', 'B', 'N', { x: 2.5 }, 'M', ',', '.', '/', '\\', '['],
    [{ x: 1.25, w: 1.5 }, 'Tab', { x: 0.5, w: 1.5 }, 'Space', { x: 0.5, w: 1.5 }, 'Enter', { x: 1.5, w: 1.5 }, 'Enter', { x: 0.5, w: 1.5 }, 'Space', { x: 0.5, w: 1.5 }, 'Tab'],
  ],
  'lily58': [
    ['1', '2', '3', '4', '5', '6', { x: 4.5 }, '7', '8', '9', '0', '-', '='],
    ['Q', 'W', 'E', 'R', 'T', 'Y', { x: 4.5 }, 'U', 'I', 'O', 'P', '[', ']'],
    ['A', 'S', 'D', 'F', 'G', 'H', { x: 4.5 }, 'J', 'K', 'L', ';', "'", '#'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', { x: 2.5 }, ',', '.', '/', '\\', '[', ']', '='],
    [{ x: 2.5 }, 'Ctrl', 'Alt', 'Space', 'Space', { x: 2.5 }, 'Space', 'Alt', 'Ctrl', 'Space'],
  ],
  'sofle': [
    ['1', '2', '3', '4', '5', '6', { x: 4.5 }, '7', '8', '9', '0', '-', '='],
    ['Q', 'W', 'E', 'R', 'T', 'Y', { x: 4.5 }, 'U', 'I', 'O', 'P', '[', ']'],
    ['A', 'S', 'D', 'F', 'G', 'H', { x: 4.5 }, 'J', 'K', 'L', ';', "'", '#'],
    ['Z', 'X', 'C', 'V', 'B', 'N', { x: 4.5 }, 'M', ',', '.', '/', '\\', '['],
    [{ x: 2, w: 1.5 }, 'Ctrl', { w: 1.5 }, 'Alt', { w: 2 }, 'Space', { w: 1.5 }, 'Alt', { w: 1.5 }, 'Ctrl', { x: 3, w: 1.5 }, 'Ctrl', { w: 1.5 }, 'Alt', { w: 2 }, 'Space', { w: 1.5 }, 'Alt', { w: 1.5 }, 'Ctrl'],
  ],
  '65iso': [
    ['Esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', { w: 2 }, 'Backspace', 'Del'],
    [{ w: 1.5 }, 'Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', { x: 0.25, w: 1.25, h: 2 }, 'Enter', 'PgUp'],
    [{ w: 1.75 }, 'Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", '#', { x: 1.25 }, 'PgDn'],
    [{ w: 1.25 }, 'Shift', '\\', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', { w: 1.75 }, 'Shift', 'Up'],
    [{ w: 1.25 }, 'Ctrl', { w: 1.25 }, 'Win', { w: 1.25 }, 'Alt', { w: 6.25 }, 'Space', { w: 1.25 }, 'Alt', { w: 1.25 }, 'Fn', { w: 1.25 }, 'Ctrl', { x: 0.25 }, 'Left', 'Down', 'Right'],
  ],
  '75iso': [
    [{ x: 0.5 }, 'Esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', { w: 2 }, 'Del'],
    [{ x: 0.25 }, '`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', { w: 2 }, 'Backspace', { x: 0.25 }, 'PgUp'],
    [{ x: 0.25 }, { w: 1.5 }, 'Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', { x: 0.25, w: 1.25, h: 2 }, 'Enter', { x: 0.25 }, 'PgDn'],
    [{ x: 0.5 }, 'Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", '#', { x: 2 }, 'Home'],
    [{ x: 0.5 }, { w: 1.25 }, 'Shift', '\\', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', { w: 1.75 }, 'Shift', 'End'],
    [{ x: 0.25 }, { w: 1.25 }, 'Ctrl', { w: 1.25 }, 'Win', { w: 1.25 }, 'Alt', { w: 6.25 }, 'Space', { w: 1.25 }, 'Alt', { w: 1.25 }, 'Fn', { w: 1.25 }, 'Ctrl', { x: 0.25 }, 'Up'],
    [{ x: 13.75 }, 'Left', 'Down', 'Right'],
  ],
  'macropad': [
    ['Num', '/', '*', '-'],
    ['7', '8', '9', '+'],
    ['4', '5', '6', '+'],
    ['1', '2', '3', 'Enter'],
    [{ w: 2 }, '0', { w: 2 }, 'Enter'],
  ],
};

const PRESET_META = {
  '60': { name: '60% ANSI', group: '常规' },
  '60iso': { name: '60% ISO', group: 'ISO' },
  '65': { name: '65% 紧凑', group: '常规' },
  '68': { name: '68 键', group: '65%+ 家族' },
  'tkl': { name: '80% TKL', group: '常规' },
  '75c': { name: '75% 下沉方向键', group: '常规' },
  '96': { name: '96% / 1800', group: '大配列' },
  '100': { name: '100% 全尺寸', group: '大配列' },
  '100iso': { name: '100% ISO', group: 'ISO' },
  'ortho': { name: '40% Ortho', group: '直列' },
  'planck': { name: '40% Planck', group: '直列' },
  'preonic': { name: '40% Preonic', group: '直列' },
  'minivan': { name: '40% Minivan', group: '直列' },
  'gherkin': { name: '30% Gherkin', group: '直列' },
  'hhkb': { name: '60% HHKB', group: '60% 家族' },
  'wkl': { name: '60% WKL', group: '60% 家族' },
  'alice': { name: 'Alice', group: '人体工学' },
  'arisu': { name: 'Arisu（带方向键）', group: '人体工学' },
  'ergodox': { name: 'Ergodox', group: '人体工学' },
  'atreus': { name: 'Atreus', group: '人体工学' },
  'corne': { name: 'Corne CRKBD', group: '人体工学' },
  'lily58': { name: 'Lily58', group: '人体工学' },
  'sofle': { name: 'Sofle', group: '人体工学' },
  '65iso': { name: '65% ISO', group: 'ISO' },
  '75iso': { name: '75% ISO', group: 'ISO' },
  'macropad': { name: '4×4 小键盘', group: '其他' },
};

module.exports = { PRESETS, PRESET_META };
