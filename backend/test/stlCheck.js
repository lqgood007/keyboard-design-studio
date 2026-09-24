'use strict';
/** 验证下载的 KeyV2 STL 实测尺寸（解析 ASCII STL 包围盒） */
const fs = require('fs');

function stlBbox(path) {
  const txt = fs.readFileSync(path, 'utf8');
  const xs = [], ys = [], zs = [];
  const re = /vertex\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/g;
  let m;
  while ((m = re.exec(txt))) {
    xs.push(parseFloat(m[1])); ys.push(parseFloat(m[2])); zs.push(parseFloat(m[3]));
  }
  const min = (a) => Math.min(...a), max = (a) => Math.max(...a);
  return {
    W: +(max(xs) - min(xs)).toFixed(2),
    D: +(max(zs) - min(zs)).toFixed(2),
    H: +(max(ys) - min(ys)).toFixed(2),
    yMin: +min(ys).toFixed(2), yMax: +max(ys).toFixed(2),
    zMin: +min(zs).toFixed(2), zMax: +max(zs).toFixed(2),
    facets: (txt.match(/facet normal/g) || []).length,
    bytes: txt.length,
  };
}

const files = [
  ['OEM R1 1u（期望底 18.05×18.05 高 11.2 顶 12.25×14.05）', 'C:\\Users\\30634\\Downloads\\keycap_oem_R1_1u_cylindrical.stl'],
  ['SA R3 6.25u（期望底 115×18.4 高 12.5 顶 102.7×12.7）', 'C:\\Users\\30634\\Downloads\\keycap_sa_R3_6.25u_spherical.stl'],
  ['MT3 R2 1u（期望底 18.35×18.6 高 10.7 顶 13×13）', 'C:\\Users\\30634\\Downloads\\keycap_mt3_R2_1u.stl'],
  ['G20 R3 1u（期望底 18.16 高 6 顶 16.16 平面）', 'C:\\Users\\30634\\Downloads\\keycap_g20_R3_1u_flat.stl'],
];
for (const [desc, p] of files) {
  try {
    const b = stlBbox(p);
    console.log(`${desc}\n  实测: 宽${b.W} 深${b.D} 高${b.H} y[${b.yMin},${b.yMax}] z[${b.zMin},${b.zMax}] 面${b.facets} ${(b.bytes/1024).toFixed(1)}KB`);
  } catch (e) { console.log(`${desc}\n  ✗ ${e.message}`); }
}
