'use strict';
/**
 * 键盘设计后端服务（KLE + SwillKB 风格定位板 + Ergogen PCB/外壳）
 *
 * 启动：npm start  ->  http://localhost:3001
 * 前端：同源托管 ../public（打开 http://localhost:3001 即编辑器）
 *
 * API：
 *   POST /api/generate {kle, options} -> 生成并打包下载 zip
 *   POST /api/validate {kle}          -> 校验 KLE 并返回解析信息
 *   GET  /api/health                  -> 健康检查
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { runGenerate, zipJob, OUTPUT_DIR } = require('./generate');
const { parseKle } = require('./kleToKeys');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// 静态托管前端编辑器（frontend/public）
app.use(express.static(path.join(__dirname, '../../frontend/public')));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'keyboard-design', time: new Date().toISOString() });
});

// 校验 KLE
app.post('/api/validate', (req, res) => {
  try {
    const { kle } = req.body || {};
    if (!kle) return res.status(400).json({ ok: false, error: '缺少 kle 字段' });
    const { keys } = parseKle(kle);
    res.json({ ok: true, keyCount: keys.length, keys });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// 生成（含轮询版状态接口由前端下载直连，这里同步完成）
app.post('/api/generate', async (req, res) => {
  const { kle, options = {} } = req.body || {};
  if (!kle) return res.status(400).json({ ok: false, error: '缺少 kle 字段' });

  try {
    const { jobDir, jobId, report } = await runGenerate(kle, options);
    const zipName = `keyboard_${jobId}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
    const archive = zipJob(jobDir);
    archive.pipe(res);
  } catch (e) {
    console.error('[generate] error:', e);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: e.message });
    } else {
      res.end();
    }
  }
});

// 仅生成不下载（返回文件清单 + 目录名），供前端展示
app.post('/api/preview', async (req, res) => {
  const { kle, options = {} } = req.body || {};
  if (!kle) return res.status(400).json({ ok: false, error: '缺少 kle 字段' });
  try {
    const { jobDir, jobId, report } = await runGenerate(kle, options);
    res.json({ ok: true, jobId, report, dir: path.join(OUTPUT_DIR, jobId) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 下载已生成 job 的某个文件
app.get('/api/jobs/:jobId/files/:name', (req, res) => {
  const { jobId, name } = req.params;
  const jobDir = path.join(OUTPUT_DIR, jobId);
  const safe = path.join(jobDir, name);
  if (!safe.startsWith(jobDir)) {
    return res.status(400).json({ ok: false, error: '非法路径' });
  }
  res.sendFile(safe, (err) => {
    if (err) res.status(404).json({ ok: false, error: '文件不存在' });
  });
});

// Ergogen YAML/JS 配置导入：代码式配列 -> KLE raw（供前端可视化编辑）
app.post('/api/import-yaml', async (req, res) => {
  const { yaml } = req.body || {};
  if (!yaml) return res.status(400).json({ ok: false, error: '缺少 yaml 字段' });
  try {
    const ergogen = require('ergogen');
    const result = await ergogen.process(yaml, { debug: true }, () => {});
    const rows = pointsToKleRows(result.points);
    res.json({ ok: true, kle: rows, keyCount: Object.keys(result.points || {}).length });
  } catch (e) {
    res.status(400).json({ ok: false, error: 'YAML 解析失败: ' + e.message });
  }
});

// 键帽规格数据（类型统计 / 尺寸规格 / 三维模型参数）
app.get('/api/keycap-profiles', (req, res) => {
  const kd = require('../../frontend/public/js/keycap.js');
  res.json({
    ok: true,
    stats: kd.keycapStats(),
    profiles: kd.KEYCAP_PROFILES,
    sizes: kd.KEYCAP_SIZE_MM,
    materials: kd.KEYCAP_MATERIALS,
    processes: kd.KEYCAP_PROCESSES,
  });
});

// 参数化键帽 STL（三维模型配置 -> 可打印 STL）
app.get('/api/keycap-stl', (req, res) => {
  const { generateKeycapStl } = require('./keycapStl');
  const q = req.query || {};
  const profile = String(q.profile || 'oem');
  const row = String(q.row || 'R3').toUpperCase();
  const w = parseFloat(q.w) || 1;
  const h = parseFloat(q.h) || 1;
  const dish = String(q.dish || 'auto');
  // corner/depth 缺省时采用该 profile 的 KeyV2 默认值（keycapModelParams 提供）
  const corner = q.corner != null ? parseFloat(q.corner) : undefined;
  const depth = q.depth != null ? parseFloat(q.depth) : undefined;
  try {
    const stl = generateKeycapStl({ profile, row, w, h, dish, corner, depth });
    const suffix = (dish !== 'auto' ? `_${dish}` : '') + (corner != null ? `_r${corner}` : '') + (depth != null ? `_d${depth}` : '');
    res.setHeader('Content-Type', 'model/stl');
    res.setHeader('Content-Disposition', `attachment; filename="keycap_${profile}_${row}_${w}u${suffix}.stl"`);
    res.send(stl);
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

/**
 * ergogen 解析后的 points -> KLE raw 数组（行聚类 + 序列化）
 * points: { name: { x, y, r, meta: {width, height, label} } }（ergogen 坐标：mm、y 向上）
 */
function pointsToKleRows(points) {
  const U = 19.05;
  const keys = [];
  for (const [name, p] of Object.entries(points || {})) {
    const meta = p.meta || {};
    const wU = (meta.width || 19) / U;
    const hU = (meta.height || 19) / U;
    const cxU = p.x / U;
    const cyU = -p.y / U; // y 翻转（ergogen 向上 -> KLE 向下）
    keys.push({
      x: +(cxU - wU / 2).toFixed(4),
      y: +(cyU - hU / 2).toFixed(4),
      w: +wU.toFixed(4),
      h: +hU.toFixed(4),
      r: +(p.r || 0).toFixed(2),
      label: meta.label || name,
    });
  }
  // 行聚类（y 差 < 0.6u 同一行），行内按 x 排序
  const sorted = [...keys].sort((a, b) => a.y - b.y);
  const rows = [];
  let cur = [];
  let prevY = null;
  for (const k of sorted) {
    if (prevY !== null && k.y - prevY > 0.6) {
      rows.push(cur);
      cur = [];
    }
    cur.push(k);
    prevY = k.y;
  }
  if (cur.length) rows.push(cur);

  // 序列化为 KLE raw（与前端 serializeRows 同逻辑）
  const out = [];
  let prevBottom = 0;
  for (let ri = 0; ri < rows.length; ri++) {
    const rowKeys = rows[ri].sort((a, b) => a.x - b.x);
    const rowArr = [];
    let prevX = 0;
    let rowBottom = 0;
    rowKeys.forEach((k, ci) => {
      const attrs = {};
      const gap = +(k.x - prevX).toFixed(4);
      if (ci === 0) {
        if (gap > 0.001) attrs.x = gap;
        const dy = +(k.y - prevBottom).toFixed(4);
        if (ri > 0 && Math.abs(dy - 1) > 0.001 && Math.abs(dy) > 0.001) attrs.y = dy;
      } else if (gap > 0.001) {
        attrs.x = gap;
      }
      if (Math.abs(k.w - 1) > 0.001) attrs.w = k.w;
      if (Math.abs(k.h - 1) > 0.001) attrs.h = k.h;
      if (Math.abs(k.r) > 0.001) {
        attrs.r = k.r;
        attrs.rx = +(k.x + k.w / 2).toFixed(4);
        attrs.ry = +(k.y + k.h / 2).toFixed(4);
      }
      if (Object.keys(attrs).length) rowArr.push(attrs);
      rowArr.push(k.label);
      prevX = k.x + k.w;
      rowBottom = Math.max(rowBottom, k.y + k.h);
    });
    out.push(rowArr);
    prevBottom = rowBottom;
  }
  return out;
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`keyboard-design backend: http://localhost:${PORT}`);
  console.log(`editor: http://localhost:${PORT}/`);
});
