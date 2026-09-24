# -*- coding: utf-8 -*-
"""
从 Keyboard Layout Editor (keyboard-layout-editor.com) 官方数据源，
批量导出「全部配列」的 raw KLE JSON 与对应 SVG 配列图。

数据来源：https://github.com/ijprest/keyboard-layout-editor
  - 预设：layouts.json 的 presets[]（13 款，Blank Layout 无键位不导出）
  - 样例：layouts.json 的 samples{} + samples/ 下的原始文件（9 款）

渲染口径严格对齐 KLE 官方实现：
  - 解析语义 = serial.js（deserialize + labelMap，默认 align=4）
  - 几何尺寸 = render.js（px 单位；各 Profile 的 keySpacing/bevelMargin/padding/圆角）
  - 标签槽位 = kb.css 的 .keylabel0..11（顶面 3x3 + 前缘 3 槽）
  - 键色提亮 = render.js 的 Lab 提亮（L*1.2）

用法：
  python build_kle_layouts.py [--out DIR] [--offline]

输出（默认写到脚本所在目录）：
  presets/<slug>.json / <slug>.svg
  samples/<slug>.json / <slug>.svg
  manifest.json
  index.html
"""
import json, math, os, re, sys, html as _html, urllib.request

RAW_BASE = "https://raw.githubusercontent.com/ijprest/keyboard-layout-editor/master"

PRESET_SLUG = {
    "ANSI 104": "ansi-104",
    "ANSI 104 (big-ass enter)": "ansi-104-big-ass-enter",
    "ISO 105": "iso-105",
    "Default 60%": "default-60",
    "ISO 60%": "iso-60",
    "JD40": "jd40",
    "ErgoDox": "ergodox",
    "Atreus": "atreus",
    "Planck": "planck",
    "Kinesis Advantage": "kinesis-advantage",
    "Keycool 84": "keycool-84",
    "Leopold FC660m": "leopold-fc660m",
}
SAMPLE_SLUG = {
    "Apple Wireless": "apple-wireless",
    "GB: CCnG": "gb-ccng",
    "GB: Retro DSA": "gb-retro-dsa",
    "Stealth Black": "stealth-black",
    "Televideo TS-800a": "televideo-ts-800a",
    "Symbolics PN 364000": "symbolics-364000",
    "Symbolics SpaceCadet": "symbolics-spacecadet",
    "Commodore VIC-20": "commodore-vic20",
    "Programmer's Keyboard": "programmers-keyboard",
}

# ============================================================ 颜色
def _s2l(c):
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def _l2s(c):
    c = max(0.0, min(1.0, c))
    return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055

def hex_to_rgb(h):
    h = (h or "#cccccc").strip().lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    if len(h) != 6:
        return (204, 204, 204)
    try:
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return (204, 204, 204)

def rgb_to_hex(rgb):
    return "#%02x%02x%02x" % tuple(max(0, min(255, int(round(v)))) for v in rgb)

_Xn, _Yn, _Zn = 0.95047, 1.0, 1.08883

def _f(t):
    return t ** (1 / 3) if t > (6 / 29) ** 3 else t / (3 * (6 / 29) ** 2) + 4 / 29

def _fi(t):
    return t ** 3 if t > 6 / 29 else 3 * (6 / 29) ** 2 * (t - 4 / 29)

def rgb_to_lab(rgb):
    r, g, b = [_s2l(v) for v in rgb]
    X = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
    Y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
    Z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041
    fx, fy, fz = _f(X / _Xn), _f(Y / _Yn), _f(Z / _Zn)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))

def lab_to_rgb(lab):
    L, a, bb = lab
    fy = (L + 16) / 116
    fx, fz = fy + a / 500, fy - bb / 200
    X, Y, Z = _Xn * _fi(fx), _Yn * _fi(fy), _Zn * _fi(fz)
    r = X * 3.2404542 + Y * -1.5371385 + Z * -0.4985314
    g = X * -0.9692660 + Y * 1.8760108 + Z * 0.0415560
    b = X * 0.0556434 + Y * -0.2040259 + Z * 1.0572252
    return tuple(int(round(_l2s(v) * 255)) for v in (r, g, b))

def lighten(color, mod=1.2):
    L, a, b = rgb_to_lab(hex_to_rgb(color))
    return rgb_to_hex(lab_to_rgb((min(100.0, L * mod), a, b)))

# ============================================================ 反序列化
LABEL_MAP = [
    [0, 6, 2, 8, 9, 11, 3, 5, 1, 4, 7, 10],
    [1, 7, -1, -1, 9, 11, 4, -1, -1, -1, -1, 10],
    [3, -1, 5, -1, 9, 11, -1, -1, 4, -1, -1, 10],
    [4, -1, -1, -1, 9, 11, -1, -1, -1, -1, -1, 10],
    [0, 6, 2, 8, 10, -1, 3, 5, 1, 4, 7, -1],
    [1, 7, -1, -1, 10, -1, 4, -1, -1, -1, -1, -1],
    [3, -1, 5, -1, 10, -1, -1, -1, 4, -1, -1, -1],
    [4, -1, -1, -1, 10, -1, -1, -1, -1, -1, -1, -1],
]

def default_key():
    return {"x": 0, "y": 0, "x2": 0, "y2": 0,
            "width": 1, "height": 1, "width2": 1, "height2": 1,
            "rotation_angle": 0, "rotation_x": 0, "rotation_y": 0,
            "labels": [None] * 12, "textColor": [None] * 12, "textSize": [],
            "default": {"textColor": "#000000", "textSize": 3},
            "color": "#cccccc", "profile": "", "nub": False,
            "ghost": False, "stepped": False, "decal": False,
            "sm": "", "sb": "", "st": ""}

DEFAULT_META = {"backcolor": "#eeeeee", "name": "", "author": "", "notes": "",
                "radii": "", "switchMount": "", "switchBrand": "", "switchType": ""}

def reorder_labels_in(labels, align, skip_default=False):
    ret = [None] * 12
    if not labels:
        return ret
    for i in range(1 if skip_default else 0, min(len(labels), 12)):
        pos = LABEL_MAP[align][i]
        if pos >= 0:
            ret[pos] = labels[i]
    return ret

def deserialize(rows):
    current = default_key()
    meta = dict(DEFAULT_META)
    keys, cluster, align = [], {"x": 0, "y": 0}, 4
    for row in rows:
        if isinstance(row, list):
            for key in row:
                if isinstance(key, str):
                    nk = json.loads(json.dumps(current))
                    if nk["width2"] == 0:
                        nk["width2"] = current["width"]
                    if nk["height2"] == 0:
                        nk["height2"] = current["height"]
                    nk["labels"] = reorder_labels_in(key.split("\n"), align)
                    nk["textSize"] = reorder_labels_in(nk["textSize"], align)
                    for i in range(12):
                        if not nk["labels"][i]:
                            nk["textSize"][i] = None
                            nk["textColor"][i] = None
                        if nk["textSize"][i] == nk["default"]["textSize"]:
                            nk["textSize"][i] = None
                        if nk["textColor"][i] == nk["default"]["textColor"]:
                            nk["textColor"][i] = None
                    keys.append(nk)
                    current["x"] += current["width"]
                    current["width"] = current["height"] = 1
                    current["x2"] = current["y2"] = current["width2"] = current["height2"] = 0
                    current["nub"] = current["stepped"] = current["decal"] = False
                else:
                    K = key
                    if K.get("r") is not None:
                        current["rotation_angle"] = K["r"]
                    if K.get("rx") is not None:
                        current["rotation_x"] = cluster["x"] = K["rx"]
                        current["x"], current["y"] = cluster["x"], cluster["y"]
                    if K.get("ry") is not None:
                        current["rotation_y"] = cluster["y"] = K["ry"]
                        current["x"], current["y"] = cluster["x"], cluster["y"]
                    if K.get("a") is not None:
                        align = K["a"]
                    if K.get("f"):
                        current["default"]["textSize"] = K["f"]
                        current["textSize"] = []
                    if K.get("f2"):
                        ts = list(current["textSize"]) if isinstance(current["textSize"], list) else []
                        ts += [None] * (12 - len(ts))
                        for i in range(1, 12):
                            ts[i] = K["f2"]
                        current["textSize"] = ts
                    if K.get("fa"):
                        current["textSize"] = list(K["fa"])
                    if K.get("p"):
                        current["profile"] = K["p"]
                    if K.get("c"):
                        current["color"] = K["c"]
                    if K.get("t"):
                        sp = str(K["t"]).split("\n")
                        current["default"]["textColor"] = sp[0]
                        current["textColor"] = reorder_labels_in(sp, align)
                    if K.get("x"):
                        current["x"] += K["x"]
                    if K.get("y"):
                        current["y"] += K["y"]
                    if K.get("w"):
                        current["width"] = current["width2"] = K["w"]
                    if K.get("h"):
                        current["height"] = current["height2"] = K["h"]
                    if K.get("x2"):
                        current["x2"] = K["x2"]
                    if K.get("y2"):
                        current["y2"] = K["y2"]
                    if K.get("w2"):
                        current["width2"] = K["w2"]
                    if K.get("h2"):
                        current["height2"] = K["h2"]
                    if K.get("n"):
                        current["nub"] = K["n"]
                    if K.get("l"):
                        current["stepped"] = K["l"]
                    if K.get("d"):
                        current["decal"] = K["d"]
                    if K.get("g") is not None:
                        current["ghost"] = K["g"]
                    if K.get("sm"):
                        current["sm"] = K["sm"]
                    if K.get("sb"):
                        current["sb"] = K["sb"]
                    if K.get("st"):
                        current["st"] = K["st"]
            current["y"] += 1
        elif isinstance(row, dict):
            for k, v in row.items():
                if k in DEFAULT_META or k == "background":
                    meta[k] = v
        current["x"] = current["rotation_x"]
    return meta, keys

# ============================================================ 几何
def _sz(**kw):
    d = {"unit": 54.0, "strokeWidth": 1.0, "keySpacing": 0.0, "bevelMargin": 6.0,
         "bevelOffsetTop": 3.0, "bevelOffsetBottom": 3.0, "padding": 3.0,
         "roundOuter": 5.0, "roundInner": 3.0}
    d.update(kw)
    return d

SIZES = {
    "": _sz(), "DCS": _sz(), "OEM": _sz(),
    "DSA": _sz(bevelOffsetTop=0.0, bevelOffsetBottom=0.0, roundInner=8.0),
    "SA": _sz(bevelOffsetTop=2.0, bevelOffsetBottom=2.0, roundInner=5.0),
    "CHICKLET": _sz(keySpacing=3.0, bevelMargin=1.0, bevelOffsetTop=0.0,
                    bevelOffsetBottom=2.0, padding=4.0, roundOuter=4.0, roundInner=4.0),
    "FLAT": _sz(keySpacing=1.0, bevelMargin=1.0, bevelOffsetTop=0.0,
                bevelOffsetBottom=0.0, padding=4.0, roundOuter=5.0, roundInner=3.0),
}

def get_profile(key):
    m = re.search(r"\b(SA|DSA|DCS|OEM|CHICKLET|FLAT)\b", key.get("profile") or "")
    return m.group(1) if m else ""

def geometry(key):
    s = SIZES[get_profile(key)]
    p = {"sizes": s}
    p["jShaped"] = (key["width"] != key["width2"]) or (key["height"] != key["height2"]) \
                   or key["x2"] or key["y2"]
    p["capw"], p["caph"] = s["unit"] * key["width"], s["unit"] * key["height"]
    p["capx"], p["capy"] = s["unit"] * key["x"], s["unit"] * key["y"]
    if p["jShaped"]:
        p["capw2"], p["caph2"] = s["unit"] * key["width2"], s["unit"] * key["height2"]
        p["capx2"], p["capy2"] = s["unit"] * (key["x"] + key["x2"]), s["unit"] * (key["y"] + key["y2"])
    p["ow"] = p["capw"] - s["keySpacing"] * 2
    p["oh"] = p["caph"] - s["keySpacing"] * 2
    p["ox"], p["oy"] = p["capx"] + s["keySpacing"], p["capy"] + s["keySpacing"]
    p["iw"] = p["ow"] - s["bevelMargin"] * 2
    p["ih"] = p["oh"] - s["bevelMargin"] * 2 - (s["bevelOffsetBottom"] - s["bevelOffsetTop"])
    p["ix"] = p["ox"] + s["bevelMargin"]
    p["iy"] = p["oy"] + s["bevelMargin"] - s["bevelOffsetTop"]
    p["tw"] = p["iw"] - s["padding"] * 2
    p["th"] = p["ih"] - s["padding"] * 2
    p["tx"] = p["ix"] + s["padding"]
    p["ty"] = p["iy"] + s["padding"]
    return p

def _rot(pt, ox, oy, ang):
    if not ang:
        return pt
    a = math.radians(ang)
    ca, sa = math.cos(a), math.sin(a)
    dx, dy = pt[0] - ox, pt[1] - oy
    return (ox + dx * ca - dy * sa, oy + dx * sa + dy * ca)

# ============================================================ 标签
_TAG = re.compile(r"<[^>]+>")
_GLYPH = {"ArrowUp": "\u2191", "ArrowDown": "\u2193", "ArrowLeft": "\u2190",
          "ArrowRight": "\u2192", "Shift": "\u21e7", "CapsLock": "\u21ea",
          "Tab": "\u21b9", "Enter": "\u21b5", "Backspace": "\u232b",
          "Delete": "\u2326", "Return": "\u23ce", "Super": "\u2756"}

def clean_label(t):
    if t is None:
        return ""
    t = str(t)
    t = re.sub(r"<i[^>]*class=['\"][^'\"]*kb-[^'\"]*['\"][^>]*>\s*</i>",
               lambda m: next((v for k, v in _GLYPH.items() if "kb-" + k in m.group(0)), ""), t)
    t = re.sub(r"<br\s*/?>", " ", t, flags=re.I)
    return _html.unescape(_TAG.sub("", t)).strip()

def label_svg(text, i, fs, color, p, esc):
    if i < 9:
        row, col = i // 3, i % 3
        if row == 0:
            base = p["ty"] + 0.80 * fs
        elif row == 1:
            base = p["ty"] + p["th"] / 2 + 0.36 * fs
        else:
            base = p["ty"] + p["th"] - 0.20 * fs
    else:
        col = i - 9
        base = p["iy"] + p["ih"] + 2 * p["sizes"]["padding"] - 1 + 0.80 * fs
    if col == 0:
        x, anchor = p["tx"], "start"
    elif col == 1:
        x, anchor = p["tx"] + p["tw"] / 2, "middle"
    else:
        x, anchor = p["tx"] + p["tw"], "end"
    return (f'<text x="{x:.2f}" y="{base:.2f}" text-anchor="{anchor}" '
            f'font-size="{fs:g}" fill="{color}" font-family="Helvetica,Arial,sans-serif">'
            f'{esc(text)}</text>')

# ============================================================ 单键 / 整张
def key_svg(key, p, esc):
    s = p["sizes"]
    sw = s["strokeWidth"]
    dark = key.get("color") or "#cccccc"
    light = lighten(dark, 1.2)
    tf = ""
    if key["rotation_angle"]:
        tf = (f' transform="rotate({key["rotation_angle"]:g} '
              f'{s["unit"] * key["rotation_x"]:.2f} {s["unit"] * key["rotation_y"]:.2f})"')
    out = [f'<g class="keycap"{tf}{" opacity=\"0.5\"" if key.get("ghost") else ""}>']
    if key.get("decal"):
        out.append(f'<rect x="{p["ox"]:.2f}" y="{p["oy"]:.2f}" width="{p["ow"]:.2f}" '
                   f'height="{p["oh"]:.2f}" rx="{s["roundOuter"]:g}" fill="none" '
                   f'stroke="#999" stroke-width="1.2" stroke-dasharray="4 3"/>')
        out.append("</g>")
        return "".join(out)
    out.append(f'<rect x="{p["ox"] + sw:.2f}" y="{p["oy"] + sw:.2f}" '
               f'width="{p["ow"] - 2 * sw:.2f}" height="{p["oh"] - 2 * sw:.2f}" '
               f'rx="{s["roundOuter"]:g}" fill="{dark}" stroke="#000000" stroke-width="{2 * sw:g}"/>')
    if not key.get("ghost"):
        out.append(f'<rect x="{p["ix"] + sw:.2f}" y="{p["iy"] + sw:.2f}" '
                   f'width="{p["iw"] - 2 * sw:.2f}" height="{p["ih"] - 2 * sw:.2f}" '
                   f'rx="{s["roundOuter"]:g}" fill="{light}" stroke="rgba(0,0,0,0.1)" '
                   f'stroke-width="{2 * sw:g}"/>')
        out.append(f'<rect x="{p["ix"] + sw:.2f}" y="{p["iy"] + sw:.2f}" '
                   f'width="{p["iw"] - 2 * sw:.2f}" height="{p["ih"] - 2 * sw:.2f}" '
                   f'rx="{s["roundOuter"]:g}" fill="{light}"/>')
    for i in range(12):
        raw = key["labels"][i] if i < len(key["labels"]) else None
        txt = clean_label(raw)
        if not txt:
            continue
        ts = key["textSize"][i] if i < len(key["textSize"]) else None
        fs = 10 if i >= 9 else 6 + 2 * (ts or key["default"]["textSize"])
        tc = (key["textColor"][i] if i < len(key["textColor"]) else None) or key["default"]["textColor"]
        if i < 9:
            tc = lighten(tc, 1.2)
        out.append(label_svg(txt, i, fs, tc, p, esc))
    out.append("</g>")
    return "".join(out)

def render_svg(meta, keys, title=""):
    esc = lambda t: _html.escape(str(t), quote=False)
    parts, minx, miny, maxx, maxy = [], 1e18, 1e18, -1e18, -1e18
    for key in keys:
        p = geometry(key)
        ox, oy = p["sizes"]["unit"] * key["rotation_x"], p["sizes"]["unit"] * key["rotation_y"]
        pts = [(p["capx"], p["capy"]), (p["capx"] + p["capw"], p["capy"]),
               (p["capx"], p["capy"] + p["caph"]), (p["capx"] + p["capw"], p["capy"] + p["caph"])]
        if p["jShaped"]:
            pts += [(p["capx2"], p["capy2"]), (p["capx2"] + p["capw2"], p["capy2"]),
                    (p["capx2"], p["capy2"] + p["caph2"]),
                    (p["capx2"] + p["capw2"], p["capy2"] + p["caph2"])]
        for pt in pts:
            x, y = _rot(pt, ox, oy, key["rotation_angle"])
            minx, miny = min(minx, x), min(miny, y)
            maxx, maxy = max(maxx, x), max(maxy, y)
        parts.append(key_svg(key, p, esc))
    if not parts:
        return "", (0.0, 0.0)
    M, PAD = 10.0, 5.0
    cw, ch = maxx - minx, maxy - miny
    W, H = cw + 2 * M + 2 * PAD, ch + 2 * M + 2 * PAD
    dx, dy = M + PAD - minx, M + PAD - miny
    back = meta.get("backcolor") or "#eeeeee"
    head = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{H:.0f}" '
            f'viewBox="0 0 {W:.0f} {H:.0f}" role="img">')
    if title:
        head += f"<title>{esc(title)}</title>"
    head += f'<g transform="translate({dx:.2f},{dy:.2f})">'
    head += (f'<rect x="{minx - PAD:.2f}" y="{miny - PAD:.2f}" width="{cw + 2 * PAD:.2f}" '
             f'height="{ch + 2 * PAD:.2f}" rx="6" fill="{back}" stroke="#dddddd" stroke-width="1"/>')
    return head + "".join(parts) + "</g></svg>", (cw / 54.0, ch / 54.0)

# ============================================================ 数据获取
def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (kle-export)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8")

def load_library(here, offline=False):
    cands = [os.path.join(here, "tmp_kle_layouts.json"),
             os.path.join(os.path.dirname(here), "tmp_kle_layouts.json"),
             os.path.join(here, "layouts.json"),
             os.path.join(here, "uploads", "kle", "layouts.json"),
             os.path.join(os.path.dirname(here), "uploads", "kle", "layouts.json")]
    for c in cands:
        if os.path.exists(c):
            with open(c, encoding="utf-8") as f:
                print("[src] layouts.json <- " + c)
                return json.load(f)
    if offline:
        raise SystemExit("offline: 未找到本地 layouts.json")
    print("[src] layouts.json <- " + RAW_BASE)
    return json.loads(fetch(RAW_BASE + "/layouts.json"))

def load_sample(here, path, offline=False):
    name = os.path.basename(path)
    cands = [os.path.join(here, "samples_src", name),
             os.path.join(here, "uploads", "kle", "samples", name),
             os.path.join(os.path.dirname(here), "uploads", "kle", "samples", name)]
    for c in cands:
        if os.path.exists(c):
            with open(c, encoding="utf-8") as f:
                return json.load(f)
    if offline:
        return None
    try:
        return json.loads(fetch(RAW_BASE + "/samples/" + name))
    except Exception as e:
        print("  [warn] sample download failed:", name, e)
        return None

# ============================================================ 主流程
def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    args = sys.argv[1:]
    offline = "--offline" in args
    out = None
    if "--out" in args:
        out = args[args.index("--out") + 1]
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.abspath(out) if out else here

    lib = load_library(here, offline)
    entries = []

    def emit(group, slug, name, raw, note=""):
        meta, keys = deserialize(raw)
        svg, (wu, hu) = render_svg(meta, keys, name)
        d = os.path.join(out, group)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, slug + ".json"), "w", encoding="utf-8", newline="\n") as f:
            json.dump(raw, f, ensure_ascii=False, indent=2)
            f.write("\n")
        with open(os.path.join(d, slug + ".svg"), "w", encoding="utf-8", newline="\n") as f:
            f.write(svg)
        entries.append({"group": group, "name": name, "slug": slug, "keys": len(keys),
                        "size_u": [round(wu, 2), round(hu, 2)],
                        "backcolor": meta.get("backcolor", ""),
                        "author": meta.get("author", ""),
                        "json": f"{group}/{slug}.json", "svg": f"{group}/{slug}.svg",
                        "note": note})
        print(f"  {group}/{slug:<26} keys={len(keys):<4} {round(wu, 1)}u x {round(hu, 1)}u")

    print("== presets ==")
    for pre in lib["presets"]:
        if not pre.get("data"):
            print("  skip empty preset:", pre["name"])
            continue
        emit("presets", PRESET_SLUG.get(pre["name"], slugify(pre["name"])), pre["name"], pre["data"])

    print("== samples ==")
    for name, path in lib["samples"].items():
        raw = load_sample(here, path, offline)
        if raw is None:
            print("  skip (no data):", name)
            continue
        emit("samples", SAMPLE_SLUG.get(name, slugify(name)), name, raw)

    with open(os.path.join(out, "manifest.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump({"source": "https://github.com/ijprest/keyboard-layout-editor",
                   "generated_from": "layouts.json (presets) + samples/ (samples)",
                   "count": len(entries), "layouts": entries},
                  f, ensure_ascii=False, indent=2)
        f.write("\n")
    write_index(out, entries)
    print(f"\nDONE: {len(entries)} layouts -> {out}")

def slugify(s):
    s = s.lower().replace("&", "and")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

def write_index(out, entries):
    def block(e):
        return (f'<div class="c"><div class="h"><b>{_html.escape(e["name"])}</b>'
                f'<span>{e["group"]} · {e["slug"]} · {e["keys"]} keys · '
                f'{e["size_u"][0]}u × {e["size_u"][1]}u</span></div>'
                f'<div class="w"><img src="{e["svg"]}" alt="{_html.escape(e["name"])}"></div></div>')
    pre = "".join(block(e) for e in entries if e["group"] == "presets")
    sam = "".join(block(e) for e in entries if e["group"] == "samples")
    doc = f"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>KLE 配列图总览</title><style>
body{{margin:0;padding:24px 28px;background:#fff;color:#1c2026;
 font-family:'Noto Sans SC','Microsoft YaHei',Helvetica,Arial,sans-serif}}
h1{{font-size:22px;margin:0 0 4px}} .sub{{color:#6b7280;font-size:13px;margin:0 0 20px}}
h2{{font-size:16px;margin:28px 0 10px;padding-left:9px;border-left:4px solid #4A90E2}}
.c{{border:1px solid #eef1f5;border-radius:10px;padding:10px 12px;margin-bottom:12px;background:#fbfcfe}}
.h{{display:flex;gap:10px;align-items:baseline;font-size:13px;margin-bottom:8px;color:#374151}}
.h span{{color:#9aa1ab;font-size:11.5px}}
.w img{{max-width:100%;height:auto;display:block}}
</style></head><body>
<h1>KLE 配列图总览</h1>
<p class="sub">来源 keyboard-layout-editor.com（ijprest/keyboard-layout-editor）。共 {len(entries)} 款；
raw JSON 与 SVG 同目录同名，可直接导入 KLE 或用于后续生成。</p>
<h2>预设 presets（{sum(1 for e in entries if e['group']=='presets')} 款）</h2>{pre}
<h2>样例 samples（{sum(1 for e in entries if e['group']=='samples')} 款）</h2>{sam}
</body></html>
"""
    with open(os.path.join(out, "index.html"), "w", encoding="utf-8", newline="\n") as f:
        f.write(doc)

if __name__ == "__main__":
    main()
