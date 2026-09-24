'use strict';
/**
 * kleRender.js —— KLE 官方风格配列渲染器（参考 keyboard_layout/build_kle_layouts.py）
 *
 * 与 KLE (ijprest/keyboard-layout-editor) 官方渲染口径一致：
 *   - 解析语义：serial.js（deserialize + labelMap，默认 align=4）
 *   - 几何尺寸：render.js（unit 缩放；keySpacing/bevelMargin/padding/圆角）
 *   - 标签槽位：kb.css .keylabel0..11（顶面 3x3 + 前缘 3 槽）
 *   - 键色提亮：render.js 的 Lab 提亮（L*1.2）
 *
 * 输出：完整 SVG 字符串（viewBox 自适应、背景、旋转键、ghost/decal），
 *      供编辑器画布与「配列图库」缩略图共用。
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ---- 标签槽位映射（align=4 为 KLE 默认） ---- */
const LABEL_MAP = [
  [0, 6, 2, 8, 9, 11, 3, 5, 1, 4, 7, 10],
  [1, 7, -1, -1, 9, 11, 4, -1, -1, -1, -1, 10],
  [3, -1, 5, -1, 9, 11, -1, -1, 4, -1, -1, 10],
  [4, -1, -1, -1, 9, 11, -1, -1, -1, -1, -1, 10],
  [0, 6, 2, 8, 10, -1, 3, 5, 1, 4, 7, -1],
  [1, 7, -1, -1, 10, -1, 4, -1, -1, -1, -1, -1],
  [3, -1, 5, -1, 10, -1, -1, -1, 4, -1, -1, -1],
  [4, -1, -1, -1, 10, -1, -1, -1, -1, -1, -1, -1],
];

/* ---- 颜色提亮（Lab L*1.2，KLE render.js 同款） ---- */
function _s2l(c) { c /= 255; return c / 12.92; }
function _l2s(c) {
  c = Math.max(0, Math.min(1, c));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
function hexToRgb(h) {
  h = (h || '#cccccc').trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  if (h.length !== 6) return [204, 204, 204];
  const v = parseInt(h, 16);
  if (Number.isNaN(v)) return [204, 204, 204];
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function rgbToHex(rgb) {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
const _Xn = 0.95047, _Yn = 1.0, _Zn = 1.08883;
const _f = (t) => (t > Math.pow(6 / 29, 3) ? Math.pow(t, 1 / 3) : t / (3 * Math.pow(6 / 29, 2)) + 4 / 29);
const _fi = (t) => (t > 6 / 29 ? Math.pow(t, 3) : 3 * Math.pow(6 / 29, 2) * (t - 4 / 29));
function rgbToLab(rgb) {
  const [r, g, b] = rgb.map(_s2l);
  const X = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const Y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  const Z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
  const fx = _f(X / _Xn), fy = _f(Y / _Yn), fz = _f(Z / _Zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function labToRgb(lab) {
  const [L, a, b] = lab;
  const fy = (L + 16) / 116;
  const fx = fy + a / 500, fz = fy - b / 200;
  const X = _Xn * _fi(fx), Y = _Yn * _fi(fy), Z = _Zn * _fi(fz);
  const r = X * 3.2404542 + Y * -1.5371385 + Z * -0.4985314;
  const g = X * -0.9692660 + Y * 1.8760108 + Z * 0.0415560;
  const b2 = X * 0.0556434 + Y * -0.2040259 + Z * 1.0572252;
  return [_l2s(r) * 255, _l2s(g) * 255, _l2s(b2) * 255];
}
function lighten(color, mod = 1.2) {
  const lab = rgbToLab(hexToRgb(color));
  return rgbToHex(labToRgb([Math.min(100, lab[0] * mod), lab[1], lab[2]]));
}

/* ---- 键帽几何（unit 可缩放；profile 尺寸表） ---- */
function _sz(kw) {
  const d = { unit: 54, strokeWidth: 1.0, keySpacing: 0.0, bevelMargin: 6.0,
    bevelOffsetTop: 3.0, bevelOffsetBottom: 3.0, padding: 3.0,
    roundOuter: 5.0, roundInner: 3.0 };
  Object.assign(d, kw);
  return d;
}
const SIZES = {
  '': _sz(), DCS: _sz(), OEM: _sz(),
  DSA: _sz({bevelOffsetTop: 0.0, bevelOffsetBottom: 0.0, roundInner: 8.0}),
  SA: _sz({bevelOffsetTop: 2.0, bevelOffsetBottom: 2.0, roundInner: 5.0}),
  CHICKLET: _sz({keySpacing: 3.0, bevelMargin: 1.0, bevelOffsetTop: 0.0,
    bevelOffsetBottom: 2.0, padding: 4.0, roundOuter: 4.0, roundInner: 4.0}),
  FLAT: _sz({keySpacing: 1.0, bevelMargin: 1.0, bevelOffsetTop: 0.0,
    bevelOffsetBottom: 0.0, padding: 4.0, roundOuter: 5.0, roundInner: 3.0}),
};
const PROFILE_RE = /\b(SA|DSA|DCS|OEM|CHICKLET|FLAT)\b/;
function getProfile(key) {
  const m = PROFILE_RE.exec(key.profile || '');
  return m ? m[1] : '';
}
function geometry(key, unit) {
  const s = SIZES[getProfile(key)];
  const k = unit / 54; // 缩放系数
  const sc = (v) => v * k;
  const p = { sizes: s };
  p.jShaped = key.width !== key.width2 || key.height !== key.height2 || key.x2 || key.y2;
  p.capw = sc(s.unit) * key.width;
  p.caph = sc(s.unit) * key.height;
  p.capx = sc(s.unit) * key.x;
  p.capy = sc(s.unit) * key.y;
  if (p.jShaped) {
    p.capw2 = sc(s.unit) * key.width2;
    p.caph2 = sc(s.unit) * key.height2;
    p.capx2 = sc(s.unit) * (key.x + key.x2);
    p.capy2 = sc(s.unit) * (key.y + key.y2);
  }
  p.ow = p.capw - sc(s.keySpacing) * 2;
  p.oh = p.caph - sc(s.keySpacing) * 2;
  p.ox = p.capx + sc(s.keySpacing);
  p.oy = p.capy + sc(s.keySpacing);
  p.iw = p.ow - sc(s.bevelMargin) * 2;
  p.ih = p.oh - sc(s.bevelMargin) * 2 - sc(s.bevelOffsetBottom - s.bevelOffsetTop);
  p.ix = p.ox + sc(s.bevelMargin);
  p.iy = p.oy + sc(s.bevelMargin) - sc(s.bevelOffsetTop);
  p.tw = p.iw - sc(s.padding) * 2;
  p.th = p.ih - sc(s.padding) * 2;
  p.tx = p.ix + sc(s.padding);
  p.ty = p.iy + sc(s.padding);
  p.sw = sc(s.strokeWidth);
  p.roundOuter = sc(s.roundOuter);
  p.roundInner = sc(s.roundInner);
  return p;
}

/* ---- 反序列化：KLE raw rows → keys（12 槽位标签） ---- */
function defaultKey() {
  return { x: 0, y: 0, x2: 0, y2: 0, width: 1, height: 1, width2: 1, height2: 1,
    rotation_angle: 0, rotation_x: 0, rotation_y: 0, labels: Array(12).fill(null),
    textColor: Array(12).fill(null), textSize: [], default: { textColor: '#000000', textSize: 3 },
    color: '#cccccc', profile: '', nub: false, ghost: false, stepped: false, decal: false };
}
const DEFAULT_META = { backcolor: '#eeeeee', name: '', author: '', notes: '',
  radii: '', switchMount: '', switchBrand: '', switchType: '' };
function reorderLabels(labels, align) {
  const ret = Array(12).fill(null);
  if (!labels) return ret;
  for (let i = 1; i < Math.min(labels.length, 12); i++) {
    const pos = LABEL_MAP[align][i];
    if (pos >= 0) ret[pos] = labels[i];
  }
  if (labels.length > 0) ret[LABEL_MAP[align][0] >= 0 ? LABEL_MAP[align][0] : 0] = labels[0];
  return ret;
}
function deserialize(rows) {
  const current = defaultKey();
  const meta = Object.assign({}, DEFAULT_META);
  const keys = [];
  const cluster = { x: 0, y: 0 };
  let align = 4;
  for (const row of rows) {
    if (Array.isArray(row)) {
      for (const key of row) {
        if (typeof key === 'string') {
          const nk = JSON.parse(JSON.stringify(current));
          if (nk.width2 === 0) nk.width2 = current.width;
          if (nk.height2 === 0) nk.height2 = current.height;
          const labs = key.split('\n');
          nk.labels = reorderLabels(labs, align);
          nk.textSize = Array(12).fill(null);
          nk.textColor = Array(12).fill(null);
          for (let i = 0; i < 12; i++) {
            if (!nk.labels[i]) { nk.textSize[i] = null; nk.textColor[i] = null; }
          }
          keys.push(nk);
          current.x += current.width;
          current.width = current.height = 1;
          current.x2 = current.y2 = current.width2 = current.height2 = 0;
          current.nub = current.stepped = current.decal = false;
        } else if (key && typeof key === 'object') {
          const K = key;
          if (K.r != null) current.rotation_angle = K.r;
          if (K.rx != null) { current.rotation_x = cluster.x = K.rx; current.x = cluster.x; current.y = cluster.y; }
          if (K.ry != null) { current.rotation_y = cluster.y = K.ry; current.x = cluster.x; current.y = cluster.y; }
          if (K.a != null) align = K.a;
          if (K.f != null) { current.default.textSize = K.f; current.textSize = []; }
          if (K.f2 != null) {
            const ts = Array(12).fill(null);
            for (let i = 1; i < 12; i++) ts[i] = K.f2;
            current.textSize = ts;
          }
          if (K.fa != null) current.textSize = K.fa;
          if (K.p != null) current.profile = K.p;
          if (K.c != null) current.color = K.c;
          if (K.t != null) {
            const sp = String(K.t).split('\n');
            current.default.textColor = sp[0];
            current.textColor = reorderLabels(sp, align);
          }
          if (K.x != null) current.x += K.x;
          if (K.y != null) current.y += K.y;
          if (K.w != null) current.width = current.width2 = K.w;
          if (K.h != null) current.height = current.height2 = K.h;
          if (K.x2 != null) current.x2 = K.x2;
          if (K.y2 != null) current.y2 = K.y2;
          if (K.w2 != null) current.width2 = K.w2;
          if (K.h2 != null) current.height2 = K.h2;
          if (K.n != null) current.nub = K.n;
          if (K.l != null) current.stepped = K.l;
          if (K.d != null) current.decal = K.d;
          if (K.g != null) current.ghost = K.g;
          if (K.sm != null) current.sm = K.sm;
          if (K.sb != null) current.sb = K.sb;
          if (K.st != null) current.st = K.st;
        }
      }
      current.y += 1;
    } else if (row && typeof row === 'object') {
      for (const [k, v] of Object.entries(row)) {
        if (k in DEFAULT_META || k === 'background') meta[k] = v;
      }
    }
    current.x = current.rotation_x;
  }
  return { meta, keys };
}

/* ---- 标签符号 ---- */
const GLYPH = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Shift: '⇧', CapsLock: '⇪', Tab: '↹', Enter: '↵', Backspace: '⌫',
  Delete: '⌦', Return: '⏎', Super: '❖' };
const TAG_RE = /<[^>]+>/g;
const KBI_RE = /<i[^>]*class=['"][^'"]*kb-([^'"]+)['"][^>]*>\s*<\/i>/g;
function cleanLabel(t) {
  if (t == null) return '';
  let s = String(t);
  s = s.replace(KBI_RE, (m, cls) => (GLYPH[cls] || ''));
  s = s.replace(/<br\s*\/?>/gi, ' ');
  s = s.replace(TAG_RE, '');
  return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").trim();
}
function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function labelSvg(text, i, fs, color, p) {
  let row, col, base;
  if (i < 9) {
    row = Math.floor(i / 3);
    col = i % 3;
    if (row === 0) base = p.ty + 0.80 * fs;
    else if (row === 1) base = p.ty + p.th / 2 + 0.36 * fs;
    else base = p.ty + p.th - 0.20 * fs;
  } else {
    col = i - 9;
    base = p.iy + p.ih + 2 * p.sizes.padding * (p.sizes.unit / 54) - 1 + 0.80 * fs;
  }
  let x, anchor;
  if (col === 0) { x = p.tx; anchor = 'start'; }
  else if (col === 1) { x = p.tx + p.tw / 2; anchor = 'middle'; }
  else { x = p.tx + p.tw; anchor = 'end'; }
  return `<text x="${x.toFixed(2)}" y="${base.toFixed(2)}" text-anchor="${anchor}" ` +
    `font-size="${fs.toFixed(1)}" fill="${color}" font-family="Helvetica,Arial,sans-serif">${escXml(text)}</text>`;
}

/* 单键 SVG（外框+内框+12 槽位标签） */
function keySvg(key, p, idx, selected) {
  const s = p.sizes;
  const sw = p.sw;
  const dark = key.color || '#cccccc';
  const light = lighten(dark, 1.2);
  let tf = '';
  if (key.rotation_angle) {
    const ru = p.capw / (key.width || 1); // 实际 1u 像素
    tf = ` transform="rotate(${key.rotation_angle} ${(ru * key.rotation_x).toFixed(2)} ${(ru * key.rotation_y).toFixed(2)})"`;
  }
  const out = [`<g class="keycap${selected ? ' selected' : ''}" data-idx="${idx}"${tf}${key.ghost ? ' opacity="0.5"' : ''}>`];
  if (key.decal) {
    out.push(`<rect x="${p.ox.toFixed(2)}" y="${p.oy.toFixed(2)}" width="${p.ow.toFixed(2)}" height="${p.oh.toFixed(2)}" rx="${p.roundOuter.toFixed(1)}" fill="none" stroke="#999" stroke-width="1.2" stroke-dasharray="4 3"/>`);
    out.push('</g>');
    return out.join('');
  }
  // 外框（深色键帽主体）；选中态内联高亮（避免被 CSS 优先级覆盖）
  const selStroke = selected ? '#4f46e5' : '#000000';
  const selWidth = selected ? Math.max(2.5, 3 * sw) : 2 * sw;
  out.push(`<rect class="key-rect${selected ? ' selected' : ''}" x="${(p.ox + sw).toFixed(2)}" y="${(p.oy + sw).toFixed(2)}" ` +
    `width="${(p.ow - 2 * sw).toFixed(2)}" height="${(p.oh - 2 * sw).toFixed(2)}" rx="${p.roundOuter.toFixed(1)}" ` +
    `fill="${dark}" stroke="${selStroke}" stroke-width="${selWidth.toFixed(1)}"/>`);
  // 内框（提亮面）
  if (!key.ghost) {
    out.push(`<rect x="${(p.ix + sw).toFixed(2)}" y="${(p.iy + sw).toFixed(2)}" ` +
      `width="${(p.iw - 2 * sw).toFixed(2)}" height="${(p.ih - 2 * sw).toFixed(2)}" rx="${p.roundOuter.toFixed(1)}" ` +
      `fill="${light}" stroke="rgba(0,0,0,0.1)" stroke-width="${(2 * sw).toFixed(1)}"/>`);
  }
  for (let i = 0; i < 12; i++) {
    const raw = key.labels[i];
    const txt = cleanLabel(raw);
    if (!txt) continue;
    const fs = i >= 9 ? 10 * (p.sizes.unit / 54) : (6 + 2 * (key.default.textSize || 3)) * (p.sizes.unit / 54);
    const tc = (key.textColor[i] || key.default.textColor);
    const c = i < 9 ? lighten(tc, 1.2) : tc;
    out.push(labelSvg(txt, i, fs, c, p));
  }
  out.push('</g>');
  return out.join('');
}

function _rot(pt, ox, oy, ang) {
  if (!ang) return pt;
  const a = ang * Math.PI / 180;
  const ca = Math.cos(a), sa = Math.sin(a);
  const dx = pt[0] - ox, dy = pt[1] - oy;
  return [ox + dx * ca - dy * sa, oy + dx * sa + dy * ca];
}

/**
 * 渲染整张配列 SVG
 * @param {Array} rows - KLE raw data（数组形式）
 * @param {Object} opts - { unit(px/u，默认 54), selected(-1), backcolor, title, pad }
 * @returns {string} 完整 SVG
 */
function renderLayout(rows, opts = {}) {
  const unit = opts.unit || 54;
  const selected = opts.selected != null ? opts.selected : -1;
  const pad = opts.pad != null ? opts.pad : 5;
  const { meta, keys } = deserialize(rows);
  const parts = [];
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  keys.forEach((key, i) => {
    const p = geometry(key, unit);
    const ru = p.capw / (key.width || 1); // 实际 1u 像素
    const ox = ru * key.rotation_x;
    const oy = ru * key.rotation_y;
    const pts = [
      [p.capx, p.capy], [p.capx + p.capw, p.capy],
      [p.capx, p.capy + p.caph], [p.capx + p.capw, p.capy + p.caph],
    ];
    if (p.jShaped) {
      pts.push([p.capx2, p.capy2], [p.capx2 + p.capw2, p.capy2],
        [p.capx2, p.capy2 + p.caph2], [p.capx2 + p.capw2, p.capy2 + p.caph2]);
    }
    for (const pt of pts) {
      const [x, y] = _rot(pt, ox, oy, key.rotation_angle);
      minx = Math.min(minx, x); miny = Math.min(miny, y);
      maxx = Math.max(maxx, x); maxy = Math.max(maxy, y);
    }
    parts.push(keySvg(key, p, i, i === selected));
  });
  if (!parts.length) {
    return `<svg xmlns="${SVG_NS}" width="100" height="60" viewBox="0 0 100 60"><text x="50" y="32" text-anchor="middle" font-size="12" fill="#999">空配列</text></svg>`;
  }
  const cw = maxx - minx, ch = maxy - miny;
  const W = cw + 2 * unit + 2 * pad, H = ch + 2 * unit + 2 * pad;
  const dx = unit + pad - minx, dy = unit + pad - miny;
  const back = meta.backcolor || opts.backcolor || '#eeeeee';
  let head = `<svg xmlns="${SVG_NS}" width="${W.toFixed(0)}" height="${H.toFixed(0)}" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" role="img"`;
  if (opts.className) head += ` class="${opts.className}"`;
  head += '>';
  if (opts.title) head += `<title>${escXml(opts.title)}</title>`;
  head += `<g transform="translate(${dx.toFixed(2)},${dy.toFixed(2)})">`;
  head += `<rect x="${(minx - pad).toFixed(2)}" y="${(miny - pad).toFixed(2)}" width="${(cw + 2 * pad).toFixed(2)}" height="${(ch + 2 * pad).toFixed(2)}" rx="6" fill="${back}" stroke="#dddddd" stroke-width="1"/>`;
  head += parts.join('') + '</g></svg>';
  return head;
}

/** 计算配列尺寸（u） */
function layoutSize(rows) {
  const { keys } = deserialize(rows);
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const key of keys) {
    const p = geometry(key, 54);
    const ox = 54 * key.rotation_x, oy = 54 * key.rotation_y;
    const pts = [[p.capx, p.capy], [p.capx + p.capw, p.capy], [p.capx, p.capy + p.caph], [p.capx + p.capw, p.capy + p.caph]];
    for (const pt of pts) {
      const [x, y] = _rot(pt, ox, oy, key.rotation_angle);
      minx = Math.min(minx, x); miny = Math.min(miny, y);
      maxx = Math.max(maxx, x); maxy = Math.max(maxy, y);
    }
  }
  if (!isFinite(maxx)) return { wU: 0, hU: 0, keys: 0 };
  return { wU: +( (maxx - minx) / 54).toFixed(2), hU: +((maxy - miny) / 54).toFixed(2), keys: keys.length };
}

window.KleRender = { renderLayout, layoutSize, lighten, deserialize };
