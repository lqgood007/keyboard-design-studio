# Keyboard Design Studio（键盘配列设计器）

> 仓库：https://github.com/lqgood007/keyboard-design-studio

基于 **KLE / SwillKB Plate Builder / Ergogen / KeyV2** 的开源联合项目，对标九尾（nine-fox.com/diy）的一站式网页键盘设计流程：

> 网页画配列 → 一键生成 **定位板 DXF + KiCad PCB + 外壳 STL + 键帽 STL** → 打包下载

纯前端零构建（HTML/JS/SVG），后端 Node.js 直出生产级文件，可本地运行也可一键发布公网远程访问。

---

## 一、功能特性

| 模块 | 能力 |
|---|---|
| **配列设计** | KLE 兼容编辑器：预设模板 / 点选编辑 / 导入导出 KLE raw JSON / Ergogen YAML 导入 |
| **预设配列 26 款** | 常规 / 60% 家族 / 65%+ / 大配列 / 直列 / 人体工学 / ISO / 其他 八组 |
| **键帽模型 13 款** | SA · OEM · Cherry · DSA · MT3 · DCS · DSS · G20 · HiPro · ASA · XDA · MDA · KAT，按 **KeyV2 开源源码**逐款复刻，参数化 3D 实时预览 + 可打印 STL |
| **硬件生成** | 定位板 DXF（SwillKB 风格）、KiCad PCB（MX/二极管/Promicro + 矩阵网络）、外壳 STL（JSCAD，圆角/倒角/分层参数化）、zip 打包 |
| **属性编辑** | − 数值 ＋ 步进控件（0.25u 步进 / 5° 旋转，按住连发）、常用值下拉、方向键微调 |
| **远程访问** | `start-keyboard.ps1` 一键启动服务 + 公网隧道并打印 URL |

### 预设配列（26 款，键数已按 QMK 官方 / 公开资料核对）

| 分组 | 预设（键数） |
|---|---|
| 常规 | 60% ANSI(61) · 65% 紧凑(67) · 68 键(67) · 80% TKL(87) · 75% 下沉方向键(84) |
| 大配列 | 96% / 1800(108) · 100% 全尺寸(104) |
| ISO | 60% ISO(62) · 100% ISO(105) · 65% ISO(68) · 75% ISO(83) |
| 直列 | 40% Ortho(42) · Planck(47) · Preonic(53) · Minivan(42) · 30% Gherkin(30) |
| 60% 家族 | HHKB(60) · WKL(59) |
| 人体工学 | Alice(56) · Arisu(62) · Ergodox(76) · Atreus(42) · Corne CRKBD(42) · Lily58(58) · Sofle(58) |
| 其他 | 4×4 小键盘(18) |

> 校准方式：官方 8 款（60% / ISO 60% / Keycool 84 / ANSI 104 / ISO 105 / Planck / ErgoDox / Atreus）从 KLE 官方 samples 整表直灌，坐标级逐键 diff **零差异**；
> 手写款（gherkin / hhkb / wkl / alice / corne / lily58 / sofle / preonic 等）按 **QMK 官方 `info.json`** 与公开资料核对键数与结构。
> 旋转属性严格遵循 kle-serial 语义：`r/rx/ry` 跨行持久、`rx/ry` 默认 (0,0)、设 `rx/ry` 时 `x/y` 先重置再叠加、行内可负偏移。

### 键帽 Profile 规格（13 款，KeyV2 源码参数）

| Profile | 底宽×深 (mm) | 行差 | 顶面形态 | 倾角语义 | 说明 |
|---|---|---|---|---|---|
| SA | 18.4 × 18.4 | 5.7 / 5.7 | 球形凹 (0.85) | 行倾角 | 高球帽，10 层均匀阶梯 |
| OEM | 18.05 × 18.05 | 5.8 / 4 | 圆柱凹 (1.0) | 1.75° 倾斜 | 量产默认，桶形侧壁 |
| Cherry | 18.16 × 18.16 | 6.31 / 3.52 | 圆柱凹 (0.65) | 2° 倾斜 | 经典原厂高度 |
| DSA | 18.24 × 18.24 | 6 / 6 | 球形凹 (1.2) | 0° | 全行同高，行高 11.6/9.1/8.1/9.1 |
| MT3 | 18.35 × 18.6 | 5.35 / 5.6 | 方形球凹 (1.2) | 行倾角 | 高球帽，corner 微圆角 0.0125 |
| DCS | 18.16 × 18.16 | 6 / 4 | 圆柱凹 (0.5) | 1.75° | Signature Plastics 现代高度 |
| DSS | 18.24 × 18.24 | 6 / 6 | 球形凹 (1.2) | 0° | DSA 加高版 |
| G20 | 18.16 × 18.16 | 2 / 2 | 平面 | 0° | 矮平帽，2u 大圆角 |
| HiPro | 18.35 × 18.17 | 6.05 / 5.52 | 方形挖勺 (0.75) | 行倾角 | 日系 Topre 高球帽 |
| ASA | 18.1 × 18.15 | 6.2 / 6.55 | 球形凹 (1.3) | 1.75° | Akko 高度，SA/OEM 折中 |
| XDA | 18.2 × 18.2 | 5 / 5 | 球形凹 | 0° | 社区规格，全行同高 |
| MDA | 18.2 × 18.2 | 行高阶梯 | 球形凹 | 行倾角 | 社区规格，MelGeek 高度 |
| KAT | 18.2 × 18.2 | 6 / 4 | 球形凹 | 1.75° | 社区规格，Keyreative 高度 |

> 几何实现（`frontend/public/js/keycapGeo.js` / `backend/src/keycapStl.js`）：
> 多层截面 + 弓形 dish（`rad=(c²+4·depth²)/(8·depth)`）+ 行倾角按高度线性插值；
> 倾角语义：**负 = R1 数字行向后翘，正 = R4 底行向打字员翘**（与 KeyV2 一致，勿翻转）。
> 前端 3D 预览与后端 STL 下载共用同一几何，`backend/test/keyv2Geo.js` 333 条断言、`stlCheck.js` 实测包围盒与 KeyV2 输出一致。

---

## 二、技术架构

```
┌─────────────────────────────────────────────────────────┐
│  前端（frontend/public，纯 HTML/JS/SVG，零构建）          │
│  双标签页：配列设计 / 键帽模型                            │
│  KLE 编辑器 · 26 款预设 · 属性步进 · 3D 键帽预览          │
└──────────────────────────┬──────────────────────────────┘
                           │ POST /api/generate {kle, options}
┌──────────────────────────▼──────────────────────────────┐
│  后端（backend，Node.js + Express）                      │
│  ├─ kleToKeys       KLE 解析（kle-serial，与 Ergogen 同款）│
│  ├─ plateDxf        定位板 DXF（SwillKB Plate Builder 风格）│
│  ├─ ergogenPipeline KiCad PCB + 轮廓 DXF/SVG（Ergogen v4） │
│  ├─ caseStl         外壳 STL（@jscad/modeling）            │
│  ├─ keycapStl       键帽 STL（KeyV2 参数化几何）           │
│  └─ generate        编排 + zip 打包                        │
└─────────────────────────────────────────────────────────┘
```

| 组件 | 作用 | 开源协议 |
|---|---|---|
| KLE 格式 | 配列数据格式（`kle-serial` 解析） | MIT（kle-serial） |
| SwillKB Plate Builder | 定位板 DXF 生成（几何逻辑等价实现） | MIT（kad 引擎） |
| Ergogen v4 | PCB 工程（mx/diode 封装 + 矩阵网络）、轮廓 DXF/SVG、外壳 JSCAD | MIT |
| KeyV2 | 键帽 Profile 几何参数（SA/OEM/Cherry/... 13 款） | MIT（rsheldiii/KeyV2） |
| dxf-writer / @jscad/modeling | DXF 写出 / CSG 建模（STL） | MIT |

> 说明：SwillKB 官方 `kad` 引擎仅以 Python 形式存在于 GitHub，PyPI 上的 `kad` 是无关的 DHT 库；
> 本项目按 SwillKB 的几何规则（KLE → 14mm MX 圆角切孔 + 板框外扩）在 Node 中自研等价实现，
> 输出可直接用于激光切割 / 嘉立创等，几何逻辑与 builder.swillkb.com 一致。

---

## 三、快速开始

```powershell
# 前端 3D 依赖（three.js，clone 后首次运行需执行一次，生成 frontend/public/vendor/）
powershell -ExecutionPolicy Bypass -File .\tools\fetch-vendor.ps1

# 后端（Node >= 20）
cd backend
npm install          # 已安装过可跳过
npm start            # http://localhost:3001

# 打开浏览器访问
# http://localhost:3001
```

首次 `npm install` 时 Ergogen 有两个 GitHub 依赖（`hull`、`kle-serial`），
国内网络需通过代理拉取，本项目在 Windows 下实测命令：

```powershell
$env:GIT_CONFIG_COUNT=2
$env:GIT_CONFIG_KEY_0="url.https://ghfast.top/https://github.com/.insteadOf"
$env:GIT_CONFIG_VALUE_0="git@github.com:"
$env:GIT_CONFIG_KEY_1="url.https://ghfast.top/https://github.com/.insteadOf"
$env:GIT_CONFIG_VALUE_1="ssh://git@github.com/"
npm install
```

### 一键启动（服务 + 公网隧道）

```powershell
powershell -ExecutionPolicy Bypass -File .\start-keyboard.ps1     # 服务 + 公网 URL
powershell -ExecutionPolicy Bypass -File .\start-keyboard.ps1 -ServiceOnly   # 仅本机
```

脚本自动：拉起后端服务（已运行则复用）→ 启动 cloudflared 隧道 → 解析打印公网 URL；
按 `Ctrl+C` 退出自动关闭隧道（本机服务保留）。

### 免费固定公网域名（Tailscale Funnel，无需买域名）

1. 注册 https://login.tailscale.com （免费账号）
2. 本机安装 Tailscale 并登录
3. `tailscale funnel 3001` → 获得永久固定域名 `https://<主机名>.<网络名>.ts.net`

---

## 四、使用流程

1. **选预设**：26 款分组可选；或粘贴导入任意 KLE raw JSON / Ergogen YAML
2. **编辑配列**：点选按键 → 属性面板 **− 数值 ＋** 步进控件（X/Y/W/H 0.25u、旋转 5°，按住连发），
   宽/高/旋转带常用值下拉（datalist）；方向键微调；加/删键
3. **顶部标签页**：「配列设计」/「键帽模型」两个标签在同一页面切换——
   「键帽模型」含 **13 款 Profile** 统计表、尺寸规格表、材质/工艺表，以及参数化三维生成器
   （选 Profile/行/宽度/顶面形态/边缘圆角 → 3D 实时预览 → 下载可打印 STL；
   形态=自动·圆柱凹·球形凹·平面·球形凸出，圆角 0/0.5/1/1.5mm）
4. **调参数**：切孔尺寸（MX 默认 14mm）、板框外扩、底板/面板厚度、主控开关、四角螺丝孔/孔径、
   外壳四角圆角（0–10mm）、面板上缘倒角（0–5mm）、分层打印（单件合并 / 底板+面板分件）
5. **3D 预览**：外壳 STL 实时生成 → three.js 网页内渲染（拖拽旋转 / 滚轮缩放）；
   可切换键帽 Profile，键帽按行高/倾角/尺寸参数化建模并落在对应按键上方
6. **分享**：生成分享链接（URL 携带 KLE 数据），任何人打开即加载同一配列
7. **生成**：点「生成硬件文件」→ 下载 zip：

| 文件 | 说明 | 用途 |
|---|---|---|
| `plate.dxf` | 定位板（SwillKB 风格切孔 + 四角螺丝孔） | 激光切割 / 送厂 |
| `main.kicad_pcb` | KiCad 5 格式 PCB 工程（MX/二极管/Promicro 主控 + 矩阵网络） | KiCad 打开，补布线 |
| `pcb_edge.dxf/svg` | PCB 轮廓（Ergogen hull+expand） | 板框参考 |
| `case.stl` | 外壳 STL（底板+带孔面板+螺丝通孔；`cornerRadius` 圆角 / `chamfer` 上缘倒角参数化） | 3D 打印 |
| `case_bottom.stl` / `case_plate.stl` | 分层打印分件（`layerMode:'split'` 时输出，底板/面板独立 STL） | 分色/分件打印 |
| `case_case.jscad` | 外壳 JSCAD 脚本（Ergogen 生成） | JSCAD 二次编辑 |
| `layout.kle.json` | 配列源数据 | 存档/分享 |
| `report.json` | 生成报告（键数/矩阵/尺寸/文件） | 生产核对 |

---

## 五、API

| 接口 | 说明 |
|---|---|
| `POST /api/generate` | `{kle, options}` → 下载 zip |
| `POST /api/validate` | 校验 KLE，返回按键坐标/数量 |
| `POST /api/preview` | 生成但不下载，返回报告（3D 预览用） |
| `POST /api/import-yaml` | Ergogen YAML 配置 → KLE raw（供前端可视化编辑） |
| `GET /api/keycap-profiles` | 键帽规格库：13 款 Profile + 尺寸 + 材质 + 工艺 |
| `GET /api/keycap-stl?profile&row&w&h&corner&dish` | 参数化键帽 STL（`corner/dish` 缺省走 Profile 默认）→ 可 3D 打印 |
| `GET /api/health` | 健康检查 |
| `GET /api/jobs/:id/files/:name` | 下载指定产物 |

`options`：
```json
{
  "cutout": 14, "expand": 5,
  "bottomThickness": 3, "plateThickness": 1.5,
  "controller": true, "screwHoles": true, "screwDia": 3.2,
  "cornerRadius": 0, "chamfer": 0, "layerMode": "single"
}
```

> `cornerRadius`：外壳四角圆角半径 mm（0=直角，建议 1–5）；`chamfer`：面板上缘 45° 倒角宽度 mm（0=直角，建议 0.5–2）；
> `layerMode`：`single` 只输出合并 `case.stl`，`split` 额外输出底板 `case_bottom.stl` 与面板 `case_plate.stl` 分件（分层打印）。

---

## 六、生成管线细节（对应九尾的实现思路）

1. **KLE 解析**：`kle-serial`（与 Ergogen 内部同款）把 raw 数组解析为按键几何（mm、中心坐标）
2. **定位板**：按键包围盒外扩 → 板框 DXF；每键 14mm 圆角矩形切孔（支持旋转键）；四角 M3 螺丝孔（可调）
3. **矩阵网络自动分配**：按键按几何 y 聚类成行（gap > 0.6u 断行），行内按 x 排序列号，
   `row_N / col_M` 网络逐键注入 → MX 轴与二极管成对串联进矩阵
4. **主控**：矩阵几何中心下方（板外）自动放置 Promicro footprint，串入矩阵 + 供电/复位网络
5. **PCB**（Ergogen）：KLE → canonical 配置 → `hull` 凸包 + `expand` 外扩得 PCB 边缘；
   `mx`/`diode`/`promicro` footprint 逐键放置；输出 KiCad 5 格式（`(module ...)`），可导入 KiCad 直接补铜布线
6. **外壳**：底板 + 面板（挖键孔）+ 螺丝通孔，`@jscad/modeling` CSG 建模 → ASCII STL；
   3D 预览由后端实时生成 STL，前端 three.js（本地 vendor 托管，无外网依赖）渲染
7. **键帽 STL**：KeyV2 多层截面几何（`side_sculpting=(1−p)×factor`、`corner_sculpting=p²×factor`、
   截面宽 `baseW−(widthDiff−side_sculpt)×p`、层位置 `[x_skew, top_skew×p, total_depth×p]`、层倾角 `−top_tilt×p`）→ ASCII STL

---

## 七、自测

```powershell
cd backend
node test/e2e.js          # 60% 配列全链路：KLE → DXF / kicad_pcb / STL
                          # 断言：60 MX + 60 二极管 + 1 Promicro + 4 螺丝孔 + 矩阵 5×14
node test/checkOutputs.js # 输出产物合理性检查（对 output/ 下全部作业逐项校验）
node test/keyv2Geo.js     # 键帽几何断言（13 款 Profile，333 条）
node test/stlCheck.js     # STL 包围盒与 KeyV2 官方输出对比
node test/presetCheck.js  # 预设核对：官方直灌款坐标 diff + 手写款几何自洽（52 项）
```

---

## 八、目录结构

```
keyboard_design/
├─ backend/
│  ├─ src/           # server / kleToKeys / plateDxf / ergogenPipeline / caseStl / keycapStl / generate
│  ├─ test/          # e2e.js / checkOutputs.js / keyv2Geo.js / stlCheck.js / presetCheck.js
│  ├─ output/        # 生成产物（git 忽略）
│  └─ package.json
├─ frontend/
│  └─ public/        # index.html + css/ + js/{app,preview,keycap,keycapGeo,keycapPanel}.js + vendor/（three.js 本地化）
├─ tools/            # build_presets_data.js（预设真源）/ repair_app.js（重组 app.js）/ fetch-vendor.ps1（three.js 获取）
├─ tmp_kle_layouts.json   # KLE 官方 13 款原始数据（预设校准依据）
├─ tmp_qmk/          # QMK 官方布局（hhkb/lily58/crkbd/sofle，预设核对依据）
├─ start-keyboard.ps1    # 一键启动脚本（服务 + 公网隧道）
└─ README.md
```

---

## 九、已知限制与路线图

- [x] 标准矩形配列（60%/65%/TKL/Ortho）全流程
- [x] 矩阵网络自动分配（几何行列聚类 → `row_N/col_M`）
- [x] 主控 footprint（Promicro）自动放置
- [x] 四角螺丝孔参数（DXF 圆 + STL 通孔）
- [x] 3D 预览（three.js，本地 vendor 无外网依赖）
- [x] Ergogen YAML 配置导入（代码式配列）
- [x] 配列分享链接（URL 携带 KLE 数据）
- [x] 属性步进控件（− 数值 ＋，常用值下拉，按住连发）
- [x] 预设配列支持修改 / 保存 / 重置所有（localStorage 本地持久化 `kds_custom_presets_v1`）
- [x] 外壳参数化（四角圆角、面板上缘倒角、分层打印分件 STL）
- [x] 26 款预设配列（官方 8 款直灌零差异 + 手写款按 QMK 官方核对修正）
- [x] 键帽规格库（13 Profile 按 KeyV2 源码复刻 + 圆角/Dish 参数化建模 + 可打印 STL 下载）
- [x] 一键启动脚本（服务 + cloudflared 公网隧道）
- [ ] 旋转键（r≠0）矩阵网络优化（当前按几何中心聚类）
- [ ] RP2040/兼容主控封装、电池/充电管理
- [ ] PCB 原理图输出（.kicad_sch 含元件）
- [ ] 在线协作编辑

---

## 十、致谢

- [Keyboard Layout Editor (KLE)](https://www.keyboard-layout-editor.com/) & [kle-serial](https://github.com/ergogen/kle-serial)
- [SwillKB Plate Builder](https://builder.swillkb.com/) / [kad](https://github.com/swill/kad)
- [Ergogen](https://ergogen.xyz/) / [ergogen/ergogen](https://github.com/ergogen/ergogen)
- [KeyV2](https://github.com/rsheldiii/KeyV2)（rsheldiii，键帽几何参考）
- [dxf-writer](https://www.npmjs.com/package/dxf-writer) / [@jscad/modeling](https://www.npmjs.com/package/@jscad/modeling)
- [QMK](https://github.com/qmk/qmk_firmware)（预设键数/结构核对依据）

---

## License

MIT（组件依赖协议见上文表格；本仓库代码可按 MIT 使用，注明上游致谢即可）
