'use strict';
/**
 * 3D 预览模块（three.js）：渲染 case.stl + 参数化键帽
 * 通过 window 自定义事件 `kb-preview-stl` 接收 { stl, keys }：
 *   stl  - ASCII STL（外壳/定位板）
 *   keys - KLE 键列表（x/y/w/h/r，单位 u），用于在其上方渲染键帽
 *
 * 零依赖策略：仅 import three.module.js；ASCII STL 解析与轨道控制内置。
 * 键帽模型：梯形台（底面按 u 数缩放、顶面单边内缩 2.25mm、行高与倾角按 Profile），
 * 规格数据来自 js/keycap.js（window.KeycapData）。
 */
import * as THREE from '../vendor/three.module.js';

let renderer = null;
let scene = null;
let camera = null;
let model = null;
let keycapGroup = null;
let grid = null;
let caseInfo = null;      // 记录 case 包围盒，用于键帽对齐
let cachedKeys = null;    // 最近一次键列表

const KD = (typeof window !== 'undefined' && window.KeycapData) ? window.KeycapData : null;

/* 轨道状态（球坐标绕原点） */
const orbit = { theta: 0.85, phi: 0.95, radius: 300 };
let dragging = false;
let lastX = 0;
let lastY = 0;

function applyOrbit() {
  const s = Math.sin(orbit.phi);
  camera.position.set(
    orbit.radius * s * Math.cos(orbit.theta),
    orbit.radius * Math.cos(orbit.phi),
    orbit.radius * s * Math.sin(orbit.theta)
  );
  camera.lookAt(0, 0, 0);
}

function init() {
  const container = document.getElementById('preview-canvas');
  const w = container.clientWidth || 640;
  const h = container.clientHeight || 480;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeef2f7);

  camera = new THREE.PerspectiveCamera(45, w / h, 1, 100000);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(w, h);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(300, 500, 400);
  scene.add(dir);
  const dir2 = new THREE.DirectionalLight(0xffffff, 0.25);
  dir2.position.set(-300, -200, -300);
  scene.add(dir2);

  const el = renderer.domElement;
  el.addEventListener('mousedown', (ev) => {
    dragging = true;
    lastX = ev.clientX;
    lastY = ev.clientY;
    el.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', (ev) => {
    if (!dragging) return;
    const dx = ev.clientX - lastX;
    const dy = ev.clientY - lastY;
    lastX = ev.clientX;
    lastY = ev.clientY;
    orbit.theta -= dx * 0.008;
    orbit.phi = Math.max(0.05, Math.min(Math.PI - 0.05, orbit.phi - dy * 0.008));
    applyOrbit();
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    el.style.cursor = 'grab';
  });
  el.style.cursor = 'grab';
  el.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    orbit.radius *= ev.deltaY > 0 ? 1.1 : 0.9;
    orbit.radius = Math.max(10, Math.min(20000, orbit.radius));
    applyOrbit();
  }, { passive: false });
  el.addEventListener('contextmenu', (ev) => ev.preventDefault());

  window.addEventListener('resize', () => {
    const c = document.getElementById('preview-canvas');
    if (!c) return;
    const nw = c.clientWidth || 640;
    const nh = c.clientHeight || 480;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });
}

/** 解析 ASCII STL（facet normal / vertex 三行一组） */
function parseStlAscii(text) {
  const vertices = [];
  const re = /vertex\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    vertices.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
  }
  if (vertices.length < 9) throw new Error('STL 中未找到足够顶点');
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * 参数化键帽几何（圆角轮廓 + 顶面 dish，与键帽模型标签页/后端 keycapStl 同源 keycapGeo.js）。
 * 返回 BufferGeometry。
 */
function buildKeycapGeometry(p) {
  // dish/corner 缺省 → 用 KeyV2 Profile 默认（keycapModelParams 已携带）
  const { vertices, faces } = window.KeycapGeo.keycapGeo(p, { dish: 'auto' });
  const pos = [];
  for (const f of faces) {
    for (const i of f) pos.push(vertices[i][0], vertices[i][1], vertices[i][2]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}
function rowForKey(k) {
  // 行序 ri 0=顶行(F区/数字) → R1，依此类推；超出取 R4
  const ri = k.ri != null ? k.ri : 0;
  const r = ri + 1;
  return 'R' + Math.max(1, Math.min(4, r));
}

/**
 * 渲染键帽：每个键中心上方放置参数化键帽。
 * 坐标系：case 已平移到自身包围盒中心（caseInfo.center）；
 * 键的 KLE 坐标（u，y 向下）→ mm：x=(cxU-centerXu)*19.05，z=-(cyU-centerZu)*19.05。
 */
function renderKeycaps(keys) {
  if (!scene || !keys || !keys.length || !KD) return;
  if (keycapGroup) {
    scene.remove(keycapGroup);
    disposeGroup(keycapGroup);
    keycapGroup = null;
  }
  const show = document.getElementById('kc-show');
  if (show && !show.checked) return;
  const sel = document.getElementById('kc-profile');
  const profileId = sel ? sel.value : 'oem';

  keycapGroup = new THREE.Group();
  const baseY = caseInfo ? caseInfo.topY + 5.5 : 6; // switch 露出高度
  const cxU = caseInfo ? caseInfo.centerX / 19.05 : 0;
  const czU = caseInfo ? caseInfo.centerZ / 19.05 : 0;

  const capMat = new THREE.MeshStandardMaterial({
    color: 0x8aa0c0, metalness: 0.05, roughness: 0.75, side: THREE.DoubleSide,
  });
  const capGeoCache = {}; // profileId:row:u 缓存

  for (const k of keys) {
    const row = rowForKey(k);
    const p = KD.keycapModelParams(profileId, row, k.w, k.h);
    const key = `${profileId}|${row}|${k.w}|${k.h}`;
    let geo = capGeoCache[key];
    if (!geo) {
      geo = buildKeycapGeometry(p);
      capGeoCache[key] = geo;
    }
    const mesh = new THREE.Mesh(geo, capMat);
    // 中心：KLE 键中心（u）→ mm
    const kcx = (k.x + k.w / 2) * 19.05;
    const kcy = (k.y + k.h / 2) * 19.05;
    mesh.position.set(kcx - caseInfo.centerX, baseY, -(kcy - caseInfo.centerZ));
    if (k.r) mesh.rotation.y = -k.r * Math.PI / 180; // KLE 顺时针 → three 逆时针
    keycapGroup.add(mesh);
  }
  scene.add(keycapGroup);
}

function disposeGroup(g) {
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
}

function renderStl(stlText, keys) {
  cachedKeys = keys || null;
  if (!renderer) init();
  if (model) {
    scene.remove(model);
    model.geometry.dispose();
    model.material.dispose();
    model = null;
  }
  if (keycapGroup) {
    scene.remove(keycapGroup);
    disposeGroup(keycapGroup);
    keycapGroup = null;
  }
  if (grid) { scene.remove(grid); grid = null; }

  let geo;
  try {
    geo = parseStlAscii(stlText);
  } catch (e) {
    document.dispatchEvent(new CustomEvent('kb-preview-error', { detail: { error: String(e) } }));
    return;
  }
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const sizeVec = new THREE.Vector3();
  bb.getSize(sizeVec);
  const cx = (bb.min.x + bb.max.x) / 2;
  const cy = (bb.min.y + bb.max.y) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;
  geo.translate(-cx, -cy, -cz);
  caseInfo = { centerX: cx, centerY: cy, centerZ: cz, topY: sizeVec.y / 2, sizeY: sizeVec.y };

  const mat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.15,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  model = new THREE.Mesh(geo, mat);
  scene.add(model);

  grid = new THREE.GridHelper(Math.max(sizeVec.x, sizeVec.y, 20), 20, 0x94a3b8, 0xcbd5e1);
  grid.position.y = -sizeVec.z / 2 - 1;
  scene.add(grid);

  renderKeycaps(cachedKeys);

  orbit.radius = Math.max(sizeVec.length(), 60) * 1.35;
  orbit.theta = 0.85;
  orbit.phi = 0.95;
  applyOrbit();
  animate();
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

/* 模态框控制：填充 Profile 下拉 + 变化时重渲染 */
function fillProfileSelect() {
  const sel = document.getElementById('kc-profile');
  if (!sel || !KD) return;
  if (sel.options.length) return;
  for (const id of Object.keys(KD.KEYCAP_PROFILES)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = KD.KEYCAP_PROFILES[id].name;
    sel.appendChild(opt);
  }
  sel.value = 'oem';
  sel.addEventListener('change', () => renderKeycaps(cachedKeys));
  const show = document.getElementById('kc-show');
  if (show) show.addEventListener('change', () => renderKeycaps(cachedKeys));
}

window.addEventListener('kb-preview-stl', (e) => {
  const stl = (e.detail || {}).stl;
  if (!stl) return;
  fillProfileSelect();
  document.getElementById('preview-modal').style.display = 'flex';
  renderStl(stl, (e.detail || {}).keys || null);
});
