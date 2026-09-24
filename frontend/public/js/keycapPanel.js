'use strict';
/**
 * 键帽模型面板（顶部标签页）：类型统计 / 尺寸规格 / 三维模型生成
 * - 数据：keycap.js 的 window.KeycapData（与后端 /api/keycap-profiles、/api/keycap-stl 同源）
 * - 3D：three.js 本地 vendor（module），渲染后端生成的 ASCII STL（梯形台键帽）
 */
import * as THREE from '../vendor/three.module.js';

const KC = window.KeycapData;
const DISH_NAMES = {
  cylindrical: '圆柱凹', spherical: '球形凹', flat: '平面', disable: '无凹',
  'squared spherical': '方形球凹', 'squared scoop': '方形勺凹',
};
const dishNameOf = (d) => DISH_NAMES[d] || d;
const $ = (id) => document.getElementById(id);

/* ========== 顶部标签切换 ========== */
function bindTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('view-editor').hidden = btn.dataset.view !== 'editor';
      document.getElementById('view-keycap').hidden = btn.dataset.view !== 'keycap';
    });
  });
}

/* ========== 统计表 ========== */
function renderStatsTable() {
  const t = $('kc-stats-table');
  const rows = ['<tr><th>Profile</th><th>类型</th><th>顶面</th><th>最大行高(mm)</th><th>说明</th></tr>'];
  const stats = KC.keycapStats();
  for (const item of stats.list) {
    const p = KC.KEYCAP_PROFILES[item.id];
    const typeName = p.type === 'sculpted' ? '阶梯雕刻' : '统一等高';
    const topName = dishNameOf(p.dishType);
    rows.push(`<tr><td>${item.id.toUpperCase()}<br><small>${p.name.split('（')[0]}</small></td>
      <td>${typeName}</td><td>${topName}</td><td>${p.type === 'uniform' ? p.rows.R3 : 'R1 ' + p.rows.R1 + ' / R4 ' + p.rows.R4}</td>
      <td><small>${p.note}</small></td></tr>`);
  }
  t.innerHTML = rows.join('');
}

/* ========== 尺寸规格表 ========== */
function renderSpecTable() {
  const t = $('kc-spec-table');
  const rows = ['<tr><th>Profile</th><th>R1</th><th>R2</th><th>R3</th><th>R4</th><th>倾角 R1→R4</th><th>声音</th></tr>'];
  for (const id of Object.keys(KC.KEYCAP_PROFILES)) {
    const p = KC.KEYCAP_PROFILES[id];
    const r = p.rows, a = p.angle;
    rows.push(`<tr><td>${id.toUpperCase()}</td>
      <td>${r.R1}</td><td>${r.R2}</td><td>${r.R3}</td><td>${r.R4}</td>
      <td>${a.R1}° / ${a.R2}° / ${a.R3}° / ${a.R4}°</td>
      <td>${p.sound}</td></tr>`);
  }
  t.innerHTML = rows.join('');
}

/* ========== 材质 / 工艺表 ========== */
function renderMatTable() {
  const t = $('kc-mat-table');
  let rows = ['<tr><th>材质</th><th>特点</th><th>声音</th></tr>'];
  for (const m of Object.values(KC.KEYCAP_MATERIALS)) {
    rows.push(`<tr><td>${m.name}</td><td>${m.note}</td><td>${m.sound}</td></tr>`);
  }
  rows.push('<tr><th colspan="3">工艺</th></tr>');
  for (const p of KC.KEYCAP_PROCESSES) {
    rows.push(`<tr><td>${p.name}</td><td colspan="2">${p.note}</td></tr>`);
  }
  t.innerHTML = rows.join('');
}

/* ========== 生成器表单 ========== */
function fillWidthSelect() {
  const sel = $('kc-p-width');
  const ids = ['1', '1.25', '1.5', '1.75', '2', '2.25', '2.5', '2.75', '3', '4', '6.25', '6.5'];
  sel.innerHTML = ids.map((u, i) => {
    const mm = KC.KEYCAP_SIZE_MM['u' + u.replace('.', '')] || (u * 18).toFixed(1);
    return `<option value="${u}" ${i === 0 ? 'selected' : ''}>${u}u（${mm} mm）</option>`;
  }).join('');
}

function currentParams() {
  const pid = $('kc-p-profile').value;
  const row = $('kc-p-row').value;
  const w = parseFloat($('kc-p-width').value) || 1;
  return KC.keycapModelParams(pid, row, w, 1);
}

function currentOpts() {
  const cornerRaw = $('kc-p-corner') ? $('kc-p-corner').value : 'auto';
  return {
    dish: $('kc-p-dish') ? $('kc-p-dish').value : 'auto',
    corner: cornerRaw === 'auto' ? undefined : parseFloat(cornerRaw) || 0,
  };
}

function renderParams() {
  const g = currentParams();
  const o = currentOpts();
  const dishName = o.dish === 'auto' ? '自动（' + dishNameOf(g.topShape) + '）' : (DISH_NAMES[o.dish] || o.dish);
  const cornerShow = o.corner === undefined ? g.corner + '（Profile 默认）' : (o.corner > 0 ? o.corner + ' mm' : '直角');
  $('kc-params').innerHTML = `
    <table>
      <tr><th>Profile</th><td>${g.profileId.toUpperCase()}</td><th>行</th><td>${g.row}</td></tr>
      <tr><th>底面</th><td>${g.baseW.toFixed(2)} × ${g.baseD.toFixed(2)} mm</td><th>顶面</th><td>${g.topW.toFixed(2)} × ${g.topD.toFixed(2)} mm</td></tr>
      <tr><th>总高</th><td>${g.height} mm</td><th>顶面倾角</th><td>${g.angle}°（负=向后翘 R1 类 / 正=向打字员翘 R4 类）</td></tr>
      <tr><th>顶面形态</th><td>${dishName}</td><th>dish 深度</th><td>${g.dishDepth} mm</td></tr>
      <tr><th>顶面后移</th><td>${g.topSkew} mm</td><th>建模层数</th><td>${g.slices} 层${g.sideSculpt ? '（桶形侧面 ' + g.sideSculpt + '）' : ''}</td></tr>
      <tr><th>边缘圆角</th><td>${cornerShow}</td><th>底面 1u</th><td>${g.bottomKeyWidth} × ${g.bottomKeyHeight} mm</td></tr>
    </table>`;
  requestModel();
}

/* ========== 3D 渲染（本地 three.js + ASCII STL） ========== */
let renderer, scene, cam, meshGroup = null, stlText = '';
const ROT = { x: 0.5, y: 0.4 }, ZOOM = 1.2;
let drag = null;

function initThree() {
  const cv = $('kc-canvas');
  try {
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    window.__kc3d = 'ok';
  } catch (e) {
    window.__kc3d = 'err: ' + e.message;
    console.warn('keycap 渲染器构造失败', e);
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(cv.width, cv.height, false);
  scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(1, 1.6, 0.8);
  scene.add(dir);
  cam = new THREE.PerspectiveCamera(45, cv.width / cv.height, 0.1, 500);
  cam.position.set(0, 26, 52);
  cam.lookAt(0, 10, 0);
  // 地面参考网格
  const grid = new THREE.GridHelper(80, 12, 0x94a3b8, 0xcbd5e1);
  grid.position.y = -0.05;
  scene.add(grid);

  cv.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, rx: ROT.x, ry: ROT.y };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    ROT.y += (e.clientX - drag.x) * 0.01;
    ROT.x = Math.max(-1.2, Math.min(1.2, ROT.x + (e.clientY - drag.y) * 0.01));
    drag.x = e.clientX; drag.y = e.clientY;
  });
  cv.addEventListener('pointerup', () => (drag = null));
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    ZOOM = Math.max(0.35, Math.min(3.5, ZOOM * (e.deltaY > 0 ? 1.06 : 0.94)));
  }, { passive: false });

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  if (meshGroup) {
    meshGroup.rotation.x = ROT.x;
    meshGroup.rotation.y = ROT.y;
    meshGroup.scale.setScalar(ZOOM);
  }
  renderer.render(scene, cam);
}

/* ASCII STL → BufferGeometry（与 preview.js 相同的解析语义） */
function parseStlAscii(text) {
  const verts = [];
  const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  let m;
  while ((m = re.exec(text))) verts.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
  return verts;
}

async function requestModel() {
  const pid = $('kc-p-profile').value;
  const row = $('kc-p-row').value;
  const w = parseFloat($('kc-p-width').value) || 1;
  const o = currentOpts();
  try {
    // 本地生成（与后端同源 keycapGeo.js），实时预览圆角/形态
    const geo = buildLocalGeometry(pid, row, w, o);
    if (meshGroup) scene.remove(meshGroup);
    meshGroup = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x818cf8, roughness: 0.42, metalness: 0.05, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0;
    meshGroup.add(mesh);
    // 中心化：让键帽底面居中于原点上方
    const box = new THREE.Box3().setFromObject(mesh);
    const centerY = (box.min.y + box.max.y) / 2;
    mesh.position.y = -centerY;
    scene.add(meshGroup);
  } catch (e) {
    console.warn('键帽几何生成失败', e);
  }
}

/** 本地几何：keycapGeo.js（圆角轮廓 + dish），与后端 /api/keycap-stl 完全一致 */
function buildLocalGeometry(pid, row, w, o) {
  const params = KC.keycapModelParams(pid, row, w, 1);
  const { vertices, faces } = window.KeycapGeo.keycapGeo(params, o);
  const pos = [];
  for (const f of faces) {
    for (const i of f) pos.push(vertices[i][0], vertices[i][1], vertices[i][2]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

function downloadStl() {
  const pid = $('kc-p-profile').value;
  const row = $('kc-p-row').value;
  const w = $('kc-p-width').value;
  const o = currentOpts();
  const qs = `profile=${encodeURIComponent(pid)}&row=${row}&w=${w}&dish=${encodeURIComponent(o.dish)}&corner=${o.corner}`;
  fetch(`/api/keycap-stl?${qs}`)
    .then((r) => (r.ok ? r.blob() : Promise.reject('HTTP ' + r.status)))
    .then((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `keycap_${pid}_${row}_${w}u_${o.dish}.stl`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    })
    .catch((e) => console.warn('下载失败', e));
}

/* ========== 初始化 ========== */
function init() {
  bindTabs();
  renderStatsTable();
  renderSpecTable();
  renderMatTable();
  fillWidthSelect();
  const sel = $('kc-p-profile');
  sel.innerHTML = Object.keys(KC.KEYCAP_PROFILES).map((id) =>
    `<option value="${id}">${id.toUpperCase()} · ${KC.KEYCAP_PROFILES[id].name.split('（')[0]}</option>`).join('');
  sel.addEventListener('change', renderParams);
  $('kc-p-row').addEventListener('change', renderParams);
  $('kc-p-width').addEventListener('change', renderParams);
  if ($('kc-p-dish')) $('kc-p-dish').addEventListener('change', renderParams);
  if ($('kc-p-corner')) $('kc-p-corner').addEventListener('change', renderParams);
  $('kc-download-stl').addEventListener('click', downloadStl);
  $('kc-reset-view').addEventListener('click', () => { ROT.x = 0.5; ROT.y = 0.4; ZOOM = 1.2; });
  renderParams();
  if (window.WebGLRenderingContext) {
    try { initThree(); } catch (e) { console.warn('WebGL 初始化失败', e); }
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
