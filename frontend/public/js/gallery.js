'use strict';
/**
 * gallery.js —— 「配列图库」标签页
 *
 * 显示方式参考 keyboard_layout/（KLE 官方渲染风格 + 卡片式总览）：
 *  - 分组：内置预设（26 款，来自 app.js 的 PRESETS / PRESET_META）
 *          KLE 官方（21 款，来自 frontend/public/data/kle/*.json + manifest.json）
 *  - 每张卡片：kleRender 实时渲染的缩略图 + 名称 + 键数 + 尺寸
 *  - 点击卡片：载入编辑器（内置 → loadPreset；官方 → 粘贴导入语义 loadKleData）
 *
 * 依赖全局：KleRender（kleRender.js）、PRESETS/PRESET_META/state/loadPreset/flattenRows
 *          （app.js，先于本脚本加载）
 */

const GALLERY_DATA = '/data/kle/manifest.json';

let officialItems = []; // 官方配列元信息（manifest.layouts）
let officialCache = {}; // slug -> rows（懒加载 json）

const $g = (id) => document.getElementById(id);

/* ---------- 内置预设条目 ---------- */
function builtinItems() {
  const items = [];
  for (const [id, meta] of Object.entries(typeof PRESET_META !== 'undefined' ? PRESET_META : {})) {
    const rows = typeof PRESETS !== 'undefined' ? PRESETS[id] : undefined;
    if (!rows) continue;
    const size = KleRender.layoutSize(rows);
    items.push({
      source: '内置预设',
      id,
      name: meta.name || id,
      group: meta.group || '其他',
      keys: size.keys,
      sizeU: `${size.wU}u × ${size.hU}u`,
      rows,
    });
  }
  return items;
}

/* ---------- 官方条目（懒加载 json） ---------- */
async function ensureOfficial() {
  if (officialItems.length) return;
  const res = await fetch(GALLERY_DATA);
  if (!res.ok) throw new Error('图库数据加载失败: ' + res.status);
  const manifest = await res.json();
  officialItems = (manifest.layouts || []).map((e) => ({
    source: 'KLE 官方',
    id: e.slug,
    name: e.name,
    group: e.group === 'presets' ? '官方预设' : '官方样例',
    keys: e.keys,
    sizeU: `${e.size_u[0]}u × ${e.size_u[1]}u`,
    backcolor: e.backcolor,
    url: '/data/kle/' + e.json,
  }));
}

async function loadOfficialRows(item) {
  if (officialCache[item.id]) return officialCache[item.id];
  const res = await fetch(item.url);
  if (!res.ok) throw new Error('配列数据加载失败: ' + item.url);
  const rows = await res.json();
  officialCache[item.id] = rows;
  return rows;
}

/* ---------- 卡片渲染 ---------- */
function card(item, rows, sizeU) {
  const div = document.createElement('div');
  div.className = 'gallery-card';
  div.title = `${item.name} · ${item.keys} 键 · ${sizeU}\n点击载入编辑器`;
  // 缩略图：kleRender 渲染（灰底小图）
  const svg = KleRender.renderLayout(rows, {
    unit: 26,
    backcolor: item.backcolor || '#eeeeee',
    className: 'gallery-thumb',
  });
  div.innerHTML = `
    <div class="gallery-thumb-wrap">${svg}</div>
    <div class="gallery-meta">
      <b>${item.name.replace(/</g, '&lt;')}</b>
      <span>${item.source} · ${item.keys} 键 · ${sizeU}</span>
      <small>${item.group}</small>
    </div>`;
  div.addEventListener('click', () => loadToEditor(item));
  return div;
}

async function loadToEditor(item) {
  if (item.source === '内置预设') {
    loadPreset(item.id);
    switchTab('editor');
    setStatus(`已载入内置预设：${item.name}`, 'ok');
    return;
  }
  // 官方配列：取 raw data → flattenRows 载入
  try {
    const rows = await loadOfficialRows(item);
    state.keys = flattenRows(JSON.parse(JSON.stringify(rows)));
    state.selected = -1;
    refresh();
    switchTab('editor');
    setStatus(`已载入 KLE 官方配列：${item.name}（${state.keys.length} 键）`, 'ok');
  } catch (e) {
    setStatus('载入失败: ' + e.message, 'err');
  }
}

/* ---------- 渲染网格 ---------- */
let galleryAll = [];
function renderGallery() {
  const q = ($g('gallery-search').value || '').toLowerCase();
  const grp = $g('gallery-group').value;
  const grid = $g('gallery-grid');
  grid.innerHTML = '';
  let shown = 0;
  for (const item of galleryAll) {
    if (grp !== 'all' && item.source !== grp && !(grp === '内置预设' && item.source === '内置预设')) {
      if (!(grp === 'KLE 官方' && item.source === 'KLE 官方')) continue;
    }
    if (q && !(item.name.toLowerCase().includes(q) ||
        String(item.keys).includes(q) || item.sizeU.includes(q) || item.group.toLowerCase().includes(q))) continue;
    const sizeU = item.sizeU;
    grid.appendChild(card(item, item.rows, sizeU));
    shown++;
  }
  $g('gallery-count').textContent = `共 ${shown} 款`;
}

function switchTab(view) {
  document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
  const btn = document.querySelector(`.tab[data-view="${view}"]`);
  if (btn) btn.classList.add('active');
  document.getElementById('view-editor').hidden = view !== 'editor';
  document.getElementById('view-gallery').hidden = view !== 'gallery';
  document.getElementById('view-keycap').hidden = view !== 'keycap';
}

/* ---------- 初始化 ---------- */
async function initGallery() {
  // 内置 26 款（同步）
  galleryAll = builtinItems();
  // 官方 21 款（异步，加载 json 数据）
  try {
    await ensureOfficial();
    for (const it of officialItems) {
      try {
        it.rows = await loadOfficialRows(it);
        galleryAll.push(it);
      } catch (e) {
        console.warn('[gallery] skip', it.id, e.message);
      }
    }
  } catch (e) {
    console.warn('[gallery] official data unavailable:', e.message);
  }
  renderGallery();
  // 图库内搜索 / 分组
  $g('gallery-search').addEventListener('input', renderGallery);
  $g('gallery-group').addEventListener('change', renderGallery);
}

// 等 app.js 就绪后初始化（DOMContentLoaded 已在 app.js 尾部执行，这里直接跑）
initGallery();
