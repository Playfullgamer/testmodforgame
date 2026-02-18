// sbx_neo_full_ui_overhaul_v3_3.js
// FIXES:
// - elements drawer height bug (safe top offset, clamped)
// - clickable + scrollable element grid (min-heights)
// - big UI without breaking #controls layout (NO display:flex override)
// - mods menu restyle without forcing broken sizes
// - Ctrl+0 panic reset

(() => {
  "use strict";

  const MOD = {
    name: "Neo Full UI Overhaul",
    version: "3.3.0",
    keys: {
      settings: "sbx_neo33/settings",
      favs: "sbx_neo33/favs",
      recents: "sbx_neo33/recents",
      openElements: "sbx_neo33/open_elements",
      openOverhaul: "sbx_neo33/open_overhaul",
      widthElements: "sbx_neo33/w_elements",
      widthOverhaul: "sbx_neo33/w_overhaul",
      maxElements: "sbx_neo33/max_elements",
      maxOverhaul: "sbx_neo33/max_overhaul",
      tab: "sbx_neo33/tab",
      cat: "sbx_neo33/cat",
      compact: "sbx_neo33/compact",
      hideCats: "sbx_neo33/hide_cats",
      uiScale: "sbx_neo33/ui_scale",
    },
    defaults: {
      enable: true,
      restyleTopUI: true,
      hideVanillaElementUI: true,
      openElementsOnStart: true,
      showPreview: true,
      showTooltips: true,
      autoCloseOnPick: false,
      compactView: true,
      hideCategories: false,
      uiScale: 1.30, // bigger UI by default
      hotkeys: true,
      toasts: true,
    },
  };

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function safeParse(s, fallback) { try { return JSON.parse(s); } catch { return fallback; } }
  function loadSettings() { return { ...MOD.defaults, ...(safeParse(localStorage.getItem(MOD.keys.settings) || "{}", {})) }; }
  function saveSettings(s) { localStorage.setItem(MOD.keys.settings, JSON.stringify(s)); }

  function loadList(key) {
    const arr = safeParse(localStorage.getItem(key) || "[]", []);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  }
  function saveList(key, arr, cap) {
    localStorage.setItem(key, JSON.stringify(cap ? arr.slice(0, cap) : arr));
  }

  function el(tag, attrs = {}, ...children) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "style") n.setAttribute("style", v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else if (v != null) n.setAttribute(k, String(v));
    }
    for (const c of children) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return n;
  }

  function injectCss(id, cssText) {
    $(`#${id}`)?.remove();
    const st = el("style", { id });
    st.textContent = cssText;
    document.head.appendChild(st);
  }

  function onGameReady(fn) {
    if (typeof window.runAfterLoad === "function") window.runAfterLoad(fn);
    else window.addEventListener("load", fn, { once: true });
  }

  function waitFor(fn, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      const start = performance.now();
      const t = setInterval(() => {
        let val = null;
        try { val = fn(); } catch {}
        if (val) { clearInterval(t); resolve(val); }
        else if (performance.now() - start > timeoutMs) { clearInterval(t); reject(new Error("timeout")); }
      }, 60);
    });
  }

  // ---------- cleanup old versions
  function cleanupOld() {
    [
      "neo32Style","neo32Overlay","neo32Elements","neo32Overhaul","neo32EdgeL","neo32EdgeR","neo32Toast","neo32Tip",
      "neo33Style","neo33Overlay","neo33Elements","neo33Overhaul","neo33EdgeL","neo33EdgeR","neo33Toast","neo33Tip",
      "neo31Style","neo31Overlay","neo31Elements","neo31Overhaul","neo31EdgeL","neo31EdgeR","neo31Toast","neo31Tip"
    ].forEach(id => $(`#${id}`)?.remove());
    document.body.classList.remove("sbx-neo31","sbx-neo32","sbx-neo33","sbx-neo","sbx-pso","sbx-ohp");
    $("#neo33TopElements")?.remove();
    $("#neo33TopOverhaul")?.remove();
  }

  // ---------- UI scale
  function getUiScale() {
    const s = loadSettings();
    const raw = localStorage.getItem(MOD.keys.uiScale);
    const v = raw == null ? s.uiScale : parseFloat(raw);
    return clamp(Number.isFinite(v) ? v : s.uiScale, 1.0, 1.65);
  }
  function setUiScale(v) {
    const next = clamp(v, 1.0, 1.65);
    localStorage.setItem(MOD.keys.uiScale, String(next));
    document.body.style.setProperty("--neo-ui-scale", String(next));
    safeUpdateTopOffset();
    toast(`UI size: ${next.toFixed(2)}`);
  }

  // ---------- toast
  function toast(msg) {
    if (!loadSettings().toasts) return;
    const t = $("#neo33Toast");
    if (!t) return;
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(toast._tm);
    toast._tm = setTimeout(() => (t.style.display = "none"), 1200);
  }

  // ---------- CSS (SAFE: no display:flex overrides on #controls)
  function cssNeo() {
    return `
body.sbx-neo33{
  --neo-ui-scale: ${getUiScale()};
  --neo-top: 110px;
  --neo-w-e: 520px;
  --neo-w-o: 520px;

  --neo-panel: rgba(18,21,28,.92);
  --neo-panel2: rgba(14,16,22,.92);
  --neo-border: rgba(255,255,255,.12);
  --neo-border2: rgba(255,255,255,.08);
  --neo-text: rgba(255,255,255,.92);
  --neo-muted: rgba(255,255,255,.62);
  --neo-shadow: 0 16px 48px rgba(0,0,0,.55);
  --neo-shadow2: 0 10px 30px rgba(0,0,0,.45);
}

body.sbx-neo33.neo-hide-vanilla #categoryControls,
body.sbx-neo33.neo-hide-vanilla #elementControls{ display:none !important; }

/* BIG readable: font + padding only (DO NOT change layout engine) */
body.sbx-neo33 #toolControls,
body.sbx-neo33 #controls{
  font-size: calc(14px * var(--neo-ui-scale));
}
body.sbx-neo33 #toolControls .controlButton,
body.sbx-neo33 #controls .controlButton,
body.sbx-neo33 #controls button{
  font-size: calc(14px * var(--neo-ui-scale)) !important;
  padding: calc(6px * var(--neo-ui-scale)) calc(10px * var(--neo-ui-scale)) !important;
  min-height: calc(34px * var(--neo-ui-scale));
  border-radius: calc(12px * var(--neo-ui-scale)) !important;
}

/* New-style look */
body.sbx-neo33.neo-topstyle #toolControls .controlButton,
body.sbx-neo33.neo-topstyle #controls .controlButton{
  border: 1px solid var(--neo-border2) !important;
  background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04)) !important;
  color: var(--neo-text) !important;
  box-shadow: 0 6px 16px rgba(0,0,0,.25);
}
body.sbx-neo33.neo-topstyle #controls button:not(.controlButton){
  border: 1px solid rgba(255,255,255,.20) !important;
  box-shadow: 0 6px 14px rgba(0,0,0,.20);
}

/* Mods menu: style ONLY, no forced weird sizes */
body.sbx-neo33.neo-topstyle #modManager,
body.sbx-neo33.neo-topstyle #modManagerScreen,
body.sbx-neo33.neo-topstyle #modMenu,
body.sbx-neo33.neo-topstyle #modMenuScreen{
  border-radius: 18px !important;
  border: 1px solid var(--neo-border) !important;
  background: var(--neo-panel) !important;
  box-shadow: var(--neo-shadow) !important;
  color: var(--neo-text) !important;
}

/* Our mod search bar */
#neo33ModTools{
  display:flex;
  gap: 10px;
  align-items:center;
  padding: 10px 10px;
  margin-bottom: 10px;
  border-radius: 16px;
  background: rgba(0,0,0,.18);
  border: 1px solid rgba(255,255,255,.10);
}
#neo33ModSearch{
  flex: 1;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.05);
  color: rgba(255,255,255,.92);
  outline: none;
}
#neo33ModSearch::placeholder{ color: rgba(255,255,255,.60); }
.neo33MiniBtn{
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
  background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
  color: rgba(255,255,255,.92);
  cursor:pointer;
}

/* Overlay */
#neo33Overlay{
  position: fixed; inset: 0;
  background: rgba(0,0,0,.40);
  z-index: 999980;
  display:none;
  pointer-events:none;
}
#neo33Overlay.open{
  display:block;
  pointer-events:auto;
}

/* Edge tabs */
#neo33EdgeL, #neo33EdgeR{
  position: fixed;
  top: calc(var(--neo-top) + 12px);
  z-index: 999995;
  user-select: none;
  cursor: pointer;
  color: var(--neo-text);
  background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
  border: 1px solid var(--neo-border);
  box-shadow: var(--neo-shadow2);
  padding: 10px 10px;
  border-radius: 14px;
  opacity: .96;
}
#neo33EdgeL{ left: 8px; }
#neo33EdgeR{ right: 8px; }
#neo33EdgeL .lbl, #neo33EdgeR .lbl{ display:block; font-weight:900; letter-spacing:.6px; font-size:12px; }
#neo33EdgeL .sub, #neo33EdgeR .sub{ display:block; font-size:11px; color: var(--neo-muted); margin-top:2px; }
#neo33EdgeL.hidden, #neo33EdgeR.hidden{ display:none; }

/* Drawers */
.neo33Drawer{
  position: fixed;
  top: var(--neo-top);
  height: calc(100vh - var(--neo-top));
  z-index: 999990;
  color: var(--neo-text);
  background: var(--neo-panel);
  border: 1px solid var(--neo-border);
  box-shadow: var(--neo-shadow);
  border-radius: 18px;
  display:flex;
  flex-direction: column;
  max-width: calc(100vw - 20px);
  min-height: 280px;
}
#neo33Elements{
  left: 10px;
  width: var(--neo-w-e);
  transform: translateX(-110%);
  transition: transform 160ms ease;
}
#neo33Elements.open{ transform: translateX(0); }

#neo33Overhaul{
  right: 10px;
  width: var(--neo-w-o);
  transform: translateX(110%);
  transition: transform 160ms ease;
}
#neo33Overhaul.open{ transform: translateX(0); }

.neo33Drawer.max{
  left: 10px !important;
  right: 10px !important;
  width: auto !important;
}

/* Header */
.neo33Hdr{
  display:flex; align-items:center; justify-content:space-between;
  gap:8px;
  padding:12px;
  border-bottom: 1px solid var(--neo-border2);
  background: rgba(0,0,0,.10);
  border-top-left-radius: 18px;
  border-top-right-radius: 18px;
}
.neo33Title{ display:flex; flex-direction:column; gap:2px; }
.neo33Title .t{ font-weight:900; letter-spacing:.6px; }
.neo33Title .s{ font-size:12px; color: var(--neo-muted); }
.neo33Btns{ display:flex; gap:8px; }
.neo33Btn{
  border-radius:12px;
  border: 1px solid var(--neo-border2);
  background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
  color: var(--neo-text);
  padding:8px 10px;
  cursor:pointer;
}

/* Tabs + Search */
.neo33Tabs{ display:flex; gap:8px; padding:10px 12px 0 12px; }
.neo33Tab{
  flex:1; text-align:center;
  padding:8px 10px;
  border-radius:999px;
  border:1px solid var(--neo-border2);
  background: rgba(255,255,255,.04);
  cursor:pointer;
}
.neo33Tab.active{ border-color: rgba(76,201,240,.55); background: rgba(76,201,240,.10); }

.neo33SearchRow{ display:flex; gap:8px; padding:10px 12px 12px 12px; border-bottom: 1px solid var(--neo-border2); }
#neo33Search{
  flex:1;
  border-radius:14px;
  border:1px solid var(--neo-border2);
  background: rgba(255,255,255,.05);
  color: var(--neo-text);
  padding:10px 12px;
  outline:none;
}

/* Body layout */
#neo33ElBody{
  flex:1;
  display:grid;
  grid-template-columns: 170px 1fr;
  gap:10px;
  padding:10px 12px 12px 12px;
  overflow:hidden;
  min-height: 220px; /* important */
}
body.sbx-neo33.neo-hidecats #neo33ElBody{ grid-template-columns: 1fr; }
body.sbx-neo33.neo-hidecats #neo33Cats{ display:none; }

#neo33Cats{
  border:1px solid var(--neo-border2);
  border-radius:14px;
  background: var(--neo-panel2);
  overflow:auto;
  padding:8px;
}

#neo33ElRight{
  display:flex;
  flex-direction:column;
  gap:10px;
  overflow:hidden;
  min-height: 220px;
}

#neo33ElGridWrap{
  flex: 1;
  border:1px solid var(--neo-border2);
  border-radius:14px;
  background: var(--neo-panel2);
  overflow:hidden;
  display:flex;
  flex-direction:column;
  min-height: 200px; /* important */
}
#neo33ElGridHead{
  padding:10px;
  border-bottom:1px solid var(--neo-border2);
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px;
}
#neo33Count{ font-size:12px; color: var(--neo-muted); }

/* Auto grid (prevents stretching) */
#neo33ElGrid{
  padding:10px;
  overflow:auto;
  display:grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap:10px;
  min-height: 180px; /* important */
}
body.sbx-neo33.neo-compact #neo33ElGrid{ grid-template-columns: repeat(auto-fill, minmax(125px, 1fr)); gap:8px; }

.neo33ElBtn{
  display:flex;
  align-items:center;
  gap:10px;
  padding:10px;
  border-radius:14px;
  border:1px solid var(--neo-border2);
  background: linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.03));
  cursor:pointer;
}
.neo33Dot{ width:14px; height:14px; border-radius:999px; box-shadow: inset 0 0 0 2px rgba(0,0,0,.25); }
.neo33Name{ overflow:hidden; text-overflow: ellipsis; white-space: nowrap; }
.neo33Star{ margin-left:auto; opacity:.9; }

#neo33Preview{
  border:1px solid var(--neo-border2);
  border-radius:14px;
  background: rgba(255,255,255,.04);
  padding:10px;
  display:none;
}
#neo33Preview.show{ display:block; }
#neo33Preview .muted{ color: var(--neo-muted); font-size:12px; }

/* Toast */
#neo33Toast{
  position: fixed; left: 12px; bottom: 12px;
  z-index: 999999; display:none;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(12,14,18,.94);
  border: 1px solid var(--neo-border);
  color: var(--neo-text);
  box-shadow: var(--neo-shadow2);
  font-size: 12px;
}

/* Overhaul body */
#neo33OverBody{ flex:1; overflow:auto; padding:10px 12px 12px 12px; }
.neo33Section{ margin: 10px 0 8px 0; font-weight:900; letter-spacing:.4px; }
.neo33Toggle{ display:flex; gap:10px; align-items:flex-start; padding:10px; border-radius:14px; cursor:pointer; }
.neo33Toggle:hover{ background: rgba(255,255,255,.05); }
.neo33Small{ font-size:12px; color: var(--neo-muted); margin-top:2px; }
`;
  }

  // ---------- element helpers
  function elementColor(name) {
    const def = window.elements?.[name];
    const c = def?.color;
    if (Array.isArray(c) && c.length) return c[0];
    if (typeof c === "string") return c;
    return "rgba(255,255,255,.35)";
  }
  function prettyName(name) {
    const def = window.elements?.[name];
    const candidate = def?.name || def?.displayName || def?.label;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    return String(name).replace(/_/g, " ");
  }

  function buildIndex() {
    const byCat = new Map();
    const all = [];
    for (const [name, def] of Object.entries(window.elements || {})) {
      if (!def || def.hidden) continue;
      const cat = def.category || "other";
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(name);
      all.push(name);
    }
    const sortFn = (a, b) => prettyName(a).localeCompare(prettyName(b));
    for (const arr of byCat.values()) arr.sort(sortFn);
    all.sort(sortFn);
    const cats = ["all", ...Array.from(byCat.keys()).sort((a, b) => String(a).localeCompare(String(b)))];
    return { byCat, all, cats };
  }

  function buildCategoryLabelsFromDOM() {
    const map = new Map();
    for (const b of $$(".categoryButton")) {
      const id = b.id || "";
      const key = id.startsWith("categoryButton-") ? id.replace("categoryButton-", "") : (b.getAttribute("category") || b.getAttribute("data-category"));
      if (!key) continue;
      const label = (b.textContent || "").trim();
      if (label) map.set(key, label);
    }
    return map;
  }

  // ---------- state
  let currentTab = localStorage.getItem(MOD.keys.tab) || "all";
  let currentCat = localStorage.getItem(MOD.keys.cat) || "all";

  const getFavs = () => loadList(MOD.keys.favs);
  const setFavs = (a) => saveList(MOD.keys.favs, a, 40);
  const getRecents = () => loadList(MOD.keys.recents);
  const setRecents = (a) => saveList(MOD.keys.recents, a, 24);

  function isCompact() {
    const raw = localStorage.getItem(MOD.keys.compact);
    return raw == null ? !!loadSettings().compactView : raw === "1";
  }
  function isHideCats() {
    const raw = localStorage.getItem(MOD.keys.hideCats);
    return raw == null ? !!loadSettings().hideCategories : raw === "1";
  }
  function applyViewFlags() {
    document.body.classList.toggle("neo-compact", isCompact());
    document.body.classList.toggle("neo-hidecats", isHideCats());
  }

  // ---------- drawers + layout
  function isOpenElements() { return localStorage.getItem(MOD.keys.openElements) === "1"; }
  function isOpenOverhaul() { return localStorage.getItem(MOD.keys.openOverhaul) === "1"; }
  function isMax(which) { return localStorage.getItem(which === "elements" ? MOD.keys.maxElements : MOD.keys.maxOverhaul) === "1"; }
  function desiredWidth(key, fallback) { return clamp(parseInt(localStorage.getItem(key) || String(fallback), 10) || fallback, 340, 900); }

  function syncOverlay() {
    const any = isOpenElements() || isOpenOverhaul();
    $("#neo33Overlay")?.classList.toggle("open", any);
  }
  function syncEdgeTabs() {
    const enabled = loadSettings().enable;
    $("#neo33EdgeL")?.classList.toggle("hidden", !enabled || isOpenElements());
    $("#neo33EdgeR")?.classList.toggle("hidden", !enabled || isOpenOverhaul());
  }

  function setOpenElements(open) {
    if (open && window.innerWidth < 900) setOpenOverhaul(false);
    localStorage.setItem(MOD.keys.openElements, open ? "1" : "0");
    $("#neo33Elements")?.classList.toggle("open", open);
    safeUpdateTopOffset();
    updateLayout();
  }
  function setOpenOverhaul(open) {
    if (open && window.innerWidth < 900) setOpenElements(false);
    localStorage.setItem(MOD.keys.openOverhaul, open ? "1" : "0");
    $("#neo33Overhaul")?.classList.toggle("open", open);
    safeUpdateTopOffset();
    updateLayout();
  }
  function setMax(which, on) {
    localStorage.setItem(which === "elements" ? MOD.keys.maxElements : MOD.keys.maxOverhaul, on ? "1" : "0");
    const id = which === "elements" ? "#neo33Elements" : "#neo33Overhaul";
    $(id)?.classList.toggle("max", on);

    // one-max-at-a-time
    if (on) {
      if (which === "elements") {
        localStorage.setItem(MOD.keys.maxOverhaul, "0");
        $("#neo33Overhaul")?.classList.remove("max");
        setOpenOverhaul(false);
        setOpenElements(true);
      } else {
        localStorage.setItem(MOD.keys.maxElements, "0");
        $("#neo33Elements")?.classList.remove("max");
        setOpenElements(false);
        setOpenOverhaul(true);
      }
    }
    updateLayout();
  }

  function updateLayout() {
    const openE = isOpenElements();
    const openO = isOpenOverhaul();
    const maxE = isMax("elements");
    const maxO = isMax("overhaul");

    let wE = desiredWidth(MOD.keys.widthElements, 520);
    let wO = desiredWidth(MOD.keys.widthOverhaul, 520);

    if (!maxE && !maxO && openE && openO) {
      const vw = window.innerWidth;
      const available = Math.max(360, vw - 32);
      const half = Math.max(360, Math.floor((available - 12) / 2));
      wE = Math.min(wE, half);
      wO = Math.min(wO, half);
    }

    document.body.style.setProperty("--neo-w-e", `${wE}px`);
    document.body.style.setProperty("--neo-w-o", `${wO}px`);

    syncOverlay();
    syncEdgeTabs();
  }

  // ---------- SAFE top offset (this fixes your “drawer too short” issue)
  function safeUpdateTopOffset() {
    const controls = $("#controls");
    const tool = $("#toolControls");
    if (!controls && !tool) return;

    let top = 90;

    if (controls) top = Math.max(top, Math.round(controls.getBoundingClientRect().bottom) + 10);
    if (tool) top = Math.max(top, Math.round(tool.getBoundingClientRect().bottom) + 10);

    // clamp so drawers NEVER become tiny even if the UI grows
    const maxTop = Math.floor(window.innerHeight * 0.32);
    top = clamp(top, 70, maxTop);

    document.body.style.setProperty("--neo-top", `${top}px`);
  }

  // ---------- UI build
  function ensureUI() {
    if ($("#neo33Elements")) return;

    document.body.classList.add("sbx-neo33");

    document.body.appendChild(el("div", { id: "neo33Overlay", onclick: () => { setOpenElements(false); setOpenOverhaul(false); } }));
    document.body.appendChild(el("div", { id: "neo33EdgeL", onclick: () => setOpenElements(true), title: "Open Elements (B)" },
      el("span", { class: "lbl" }, "ELEMENTS"), el("span", { class: "sub" }, "Open")));
    document.body.appendChild(el("div", { id: "neo33EdgeR", onclick: () => setOpenOverhaul(true), title: "Open Overhaul (O)" },
      el("span", { class: "lbl" }, "OVERHAUL"), el("span", { class: "sub" }, "Settings")));
    document.body.appendChild(el("div", { id: "neo33Toast" }));

    const elements = el("div", { id: "neo33Elements", class: "neo33Drawer" },
      el("div", { class: "neo33Hdr" },
        el("div", { class: "neo33Title" },
          el("div", { class: "t" }, "ELEMENTS"),
          el("div", { class: "s" }, "Scroll + click works again (fixed)"))
        ,
        el("div", { class: "neo33Btns" },
          el("button", { class: "neo33Btn", onclick: () => { localStorage.setItem(MOD.keys.compact, isCompact() ? "0" : "1"); applyViewFlags(); renderElements(); } }, "▦"),
          el("button", { class: "neo33Btn", onclick: () => { localStorage.setItem(MOD.keys.hideCats, isHideCats() ? "0" : "1"); applyViewFlags(); } }, "☰"),
          el("button", { class: "neo33Btn", onclick: () => setMax("elements", !isMax("elements")) }, "⤢"),
          el("button", { class: "neo33Btn", onclick: () => setOpenOverhaul(true) }, "⚙"),
          el("button", { class: "neo33Btn", onclick: () => setOpenElements(false) }, "×"),
        )
      ),
      el("div", { class: "neo33Tabs" },
        el("div", { class: "neo33Tab", id: "neo33TabAll", onclick: () => setTab("all") }, "All"),
        el("div", { class: "neo33Tab", id: "neo33TabFav", onclick: () => setTab("fav") }, "Favorites"),
        el("div", { class: "neo33Tab", id: "neo33TabRec", onclick: () => setTab("recent") }, "Recents"),
      ),
      el("div", { class: "neo33SearchRow" },
        el("input", { id: "neo33Search", type: "text", placeholder: "Search elements…" }),
        el("button", { class: "neo33Btn", onclick: () => { $("#neo33Search").value = ""; renderElements(); } }, "×"),
      ),
      el("div", { id: "neo33ElBody" },
        el("div", { id: "neo33Cats" }),
        el("div", { id: "neo33ElRight" },
          el("div", { id: "neo33ElGridWrap" },
            el("div", { id: "neo33ElGridHead" },
              el("div", { id: "neo33Count" }, ""),
              el("div", { style: "display:flex; gap:8px; align-items:center;" },
                el("button", { class: "neo33Btn", onclick: () => setOpenElements(false) }, "Hide"),
              )
            ),
            el("div", { id: "neo33ElGrid" })
          ),
          el("div", { id: "neo33Preview" })
        )
      )
    );

    const overhaul = el("div", { id: "neo33Overhaul", class: "neo33Drawer" },
      el("div", { class: "neo33Hdr" },
        el("div", { class: "neo33Title" },
          el("div", { class: "t" }, "OVERHAUL"),
          el("div", { class: "s" }, "Ctrl+0 = panic reset")),
        el("div", { class: "neo33Btns" },
          el("button", { class: "neo33Btn", onclick: () => setMax("overhaul", !isMax("overhaul")) }, "⤢"),
          el("button", { class: "neo33Btn", onclick: () => setOpenElements(true) }, "☰"),
          el("button", { class: "neo33Btn", onclick: () => setOpenOverhaul(false) }, "×"),
        )
      ),
      el("div", { id: "neo33OverBody" })
    );

    document.body.append(elements, overhaul);

    $("#neo33Search").addEventListener("input", () => renderElements());
  }

  function addTopButtons() {
    const tc = $("#toolControls");
    if (!tc) return;

    if (!$("#neo33TopElements")) {
      const b = el("button", { id: "neo33TopElements", class: "controlButton", onclick: () => setOpenElements(!isOpenElements()) }, "☰ Elements");
      tc.prepend(b);
    }
    if (!$("#neo33TopOverhaul")) {
      const b = el("button", { id: "neo33TopOverhaul", class: "controlButton", onclick: () => setOpenOverhaul(!isOpenOverhaul()) }, "⚙ Overhaul");
      tc.appendChild(b);
    }
  }

  // ---------- tabs / cats / render
  function setTab(t) {
    currentTab = t;
    localStorage.setItem(MOD.keys.tab, t);
    $("#neo33TabAll")?.classList.toggle("active", t === "all");
    $("#neo33TabFav")?.classList.toggle("active", t === "fav");
    $("#neo33TabRec")?.classList.toggle("active", t === "recent");
    renderCats();
    renderElements();
  }
  function setCat(c) {
    currentCat = c;
    localStorage.setItem(MOD.keys.cat, c);
    renderCats();
    renderElements();
  }

  function renderCats() {
    const wrap = $("#neo33Cats");
    if (!wrap) return;
    const { cats } = buildIndex();
    const labelMap = buildCategoryLabelsFromDOM();

    wrap.innerHTML = "";
    for (const c of cats) {
      const label = (c === "all") ? "All" : (labelMap.get(c) || String(c).replace(/_/g, " "));
      const btn = el("button", { class: `neo33ElBtn`, style: `justify-content:flex-start; width:100%;` }, label);
      btn.onclick = () => setCat(c);
      if (currentCat === c) btn.style.outline = "2px solid rgba(167,139,250,.45)";
      wrap.appendChild(btn);
    }
  }

  function tabList({ all, byCat }) {
    const favs = getFavs().filter(n => window.elements?.[n]);
    const rec = getRecents().filter(n => window.elements?.[n]);
    if (currentTab === "fav") return favs;
    if (currentTab === "recent") return rec;
    if (currentCat === "all") return all;
    return byCat.get(currentCat) || [];
  }

  function inCat(def) {
    if (currentCat === "all") return true;
    return String(def?.category || "other") === String(currentCat);
  }

  function renderElements() {
    const grid = $("#neo33ElGrid");
    const count = $("#neo33Count");
    if (!grid) return;

    const query = ($("#neo33Search")?.value || "").trim().toLowerCase();
    const favSet = new Set(getFavs());

    const { all, byCat } = buildIndex();
    let list = tabList({ all, byCat });

    list = list.filter(n => {
      const def = window.elements?.[n];
      if (!def || def.hidden) return false;
      return inCat(def);
    });

    if (query) {
      list = list.filter(n => {
        const disp = prettyName(n).toLowerCase();
        return disp.includes(query) || String(n).toLowerCase().includes(query);
      });
    }

    grid.innerHTML = "";
    let shown = 0;

    for (const name of list) {
      const def = window.elements?.[name];
      if (!def || def.hidden) continue;

      const btn = el("button", { class: "neo33ElBtn" });
      btn.appendChild(el("span", { class: "neo33Dot", style: `background:${elementColor(name)};` }));
      btn.appendChild(el("span", { class: "neo33Name" }, prettyName(name)));
      if (favSet.has(name)) btn.appendChild(el("span", { class: "neo33Star" }, "★"));

      btn.onclick = () => {
        if (typeof window.selectElement === "function") window.selectElement(name);
        // recents
        const r = getRecents();
        setRecents([name, ...r.filter(x => x !== name)], 24);
        toast(`Selected: ${prettyName(name)}`);
        if (loadSettings().autoCloseOnPick) setOpenElements(false);
      };

      btn.oncontextmenu = (ev) => {
        ev.preventDefault();
        const favs = getFavs();
        const i = favs.indexOf(name);
        if (i >= 0) favs.splice(i, 1); else favs.unshift(name);
        setFavs(favs);
        renderElements();
      };

      grid.appendChild(btn);
      shown++;
    }

    if (count) count.textContent = `${shown} shown • right-click = favorite`;

    // make sure preview doesn't steal height when broken
    const prev = $("#neo33Preview");
    if (prev) {
      prev.classList.toggle("show", !!loadSettings().showPreview);
      if (!shown) prev.innerHTML = `<div class="muted">No elements match.</div>`;
    }
  }

  // ---------- Overhaul panel
  function buildOverhaulPanel() {
    const body = $("#neo33OverBody");
    if (!body) return;
    body.innerHTML = "";

    const s = loadSettings();

    const section = (t) => el("div", { class: "neo33Section" }, t);
    const toggle = (key, title, desc) => {
      const id = `neo33_${key}`;
      return el("label", { class: "neo33Toggle", for: id },
        el("input", {
          id, type: "checkbox",
          checked: s[key] ? "checked" : null,
          onchange: (ev) => {
            const next = loadSettings();
            next[key] = !!ev.target.checked;
            saveSettings(next);
            liveApply();
          }
        }),
        el("div", {}, el("div", { style: "font-weight:800;" }, title), el("div", { class: "neo33Small" }, desc))
      );
    };

    body.append(
      section("UI Size"),
      el("div", { class: "neo33Toggle", style: "cursor:default;" },
        el("div", { style: "min-width:18px;" }),
        el("div", { style: "width:100%;" },
          el("div", { style: "font-weight:800;" }, `UI scale: ${getUiScale().toFixed(2)}`),
          el("div", { class: "neo33Small" }, "Bigger text/buttons without breaking layout"),
          el("div", { style: "display:flex; gap:10px; align-items:center; margin-top:10px;" },
            el("button", { class: "neo33Btn", onclick: () => setUiScale(getUiScale() - 0.06) }, "–"),
            el("input", {
              type: "range", min: "1.0", max: "1.65", step: "0.02",
              value: String(getUiScale()), style: "flex:1;",
              oninput: (ev) => setUiScale(parseFloat(ev.target.value))
            }),
            el("button", { class: "neo33Btn", onclick: () => setUiScale(getUiScale() + 0.06) }, "+"),
          )
        )
      ),

      section("UI"),
      toggle("restyleTopUI", "New style top bar", "Same vibe as the new UI"),
      toggle("hideVanillaElementUI", "Hide vanilla element rows", "Use the drawer instead"),
      toggle("openElementsOnStart", "Open elements on start", "Opens the drawer after refresh"),
      toggle("autoCloseOnPick", "Auto-close on pick", "Closes drawer after selecting"),

      section("Panic"),
      el("button", {
        class: "neo33Btn",
        onclick: () => panicReset()
      }, "Reset UI layout (panic)")
    );
  }

  function liveApply() {
    const s = loadSettings();
    document.body.classList.toggle("neo-topstyle", !!s.restyleTopUI);
    document.body.classList.toggle("neo-hide-vanilla", !!s.hideVanillaElementUI);

    if (localStorage.getItem(MOD.keys.compact) == null) localStorage.setItem(MOD.keys.compact, s.compactView ? "1" : "0");
    if (localStorage.getItem(MOD.keys.hideCats) == null) localStorage.setItem(MOD.keys.hideCats, s.hideCategories ? "1" : "0");
    if (localStorage.getItem(MOD.keys.uiScale) == null) localStorage.setItem(MOD.keys.uiScale, String(s.uiScale));

    document.body.style.setProperty("--neo-ui-scale", String(getUiScale()));
    applyViewFlags();
    buildOverhaulPanel();
    safeUpdateTopOffset();
    updateLayout();
    renderCats();
    renderElements();
    enhanceModsUI();
  }

  // ---------- Mods UI (safe injection)
  function findModRoot() {
    return $("#modManager") || $("#modManagerScreen") || $("#modMenu") || $("#modMenuScreen");
  }

  function findModRows(root) {
    if (!root) return [];
    const checks = $$('input[type="checkbox"]', root);
    const rows = new Set();
    for (const cb of checks) {
      const row = cb.closest("div, li, tr") || cb.parentElement;
      if (row && row.textContent && row.textContent.trim()) rows.add(row);
    }
    return Array.from(rows).filter(x => x instanceof HTMLElement);
  }

  function enhanceModsUI() {
    const root = findModRoot();
    if (!root) return;
    if ($("#neo33ModTools", root)) return;

    const bar = el("div", { id: "neo33ModTools" },
      el("input", { id: "neo33ModSearch", type: "text", placeholder: "Search mods… (name, url, tag)" }),
      el("button", { class: "neo33MiniBtn", onclick: () => setUiScale(getUiScale() + 0.06) }, "UI +"),
      el("button", { class: "neo33MiniBtn", onclick: () => setUiScale(getUiScale() - 0.06) }, "UI −"),
      el("button", { class: "neo33MiniBtn", onclick: () => { const i = $("#neo33ModSearch", root); i.value = ""; i.dispatchEvent(new Event("input")); } }, "Clear"),
    );

    root.prepend(bar);

    const input = $("#neo33ModSearch", root);
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      const rows = findModRows(root);
      for (const r of rows) {
        const t = (r.textContent || "").toLowerCase();
        r.style.display = (!q || t.includes(q)) ? "" : "none";
      }
    });
  }

  function watchMods() {
    setInterval(() => enhanceModsUI(), 900);
  }

  // ---------- PANIC RESET (fixes your “broken / too short / unclickable” state instantly)
  function panicReset() {
    localStorage.setItem(MOD.keys.uiScale, "1.30");
    localStorage.setItem(MOD.keys.widthElements, "520");
    localStorage.setItem(MOD.keys.widthOverhaul, "520");
    localStorage.setItem(MOD.keys.maxElements, "0");
    localStorage.setItem(MOD.keys.maxOverhaul, "0");
    localStorage.setItem(MOD.keys.openElements, "1");
    localStorage.setItem(MOD.keys.openOverhaul, "0");
    localStorage.setItem(MOD.keys.hideCats, "0");
    localStorage.setItem(MOD.keys.compact, "1");

    document.body.style.setProperty("--neo-ui-scale", "1.30");
    $("#neo33Elements")?.classList.add("open");
    $("#neo33Overhaul")?.classList.remove("open");
    $("#neo33Elements")?.classList.remove("max");
    $("#neo33Overhaul")?.classList.remove("max");

    applyViewFlags();
    safeUpdateTopOffset();
    updateLayout();
    renderCats();
    renderElements();
    toast("UI reset");
  }

  // ---------- hotkeys
  function installHotkeys() {
    window.addEventListener("keydown", (ev) => {
      if (!loadSettings().hotkeys) return;
      const a = document.activeElement;
      const typing = a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");

      if (!typing && ev.key.toLowerCase() === "b") { ev.preventDefault(); setOpenElements(!isOpenElements()); }
      if (!typing && ev.key.toLowerCase() === "o") { ev.preventDefault(); setOpenOverhaul(!isOpenOverhaul()); }

      if (!typing && ev.key === "/") {
        ev.preventDefault();
        setOpenElements(true);
        $("#neo33Search")?.focus();
        $("#neo33Search")?.select();
      }

      // PANIC: Ctrl+0
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "0") {
        ev.preventDefault();
        panicReset();
      }
    }, { passive: false });
  }

  // ---------- boot
  onGameReady(async () => {
    cleanupOld();

    // wait for game UI + elements to exist (IMPORTANT so grid isn't empty)
    try { await waitFor(() => $("#controls") && $("#toolControls")); } catch {}
    try { await waitFor(() => window.elements && Object.keys(window.elements).length > 20); } catch {}

    if (localStorage.getItem(MOD.keys.uiScale) == null) localStorage.setItem(MOD.keys.uiScale, String(loadSettings().uiScale));
    if (localStorage.getItem(MOD.keys.openElements) == null) localStorage.setItem(MOD.keys.openElements, loadSettings().openElementsOnStart ? "1" : "0");
    if (localStorage.getItem(MOD.keys.openOverhaul) == null) localStorage.setItem(MOD.keys.openOverhaul, "0");
    if (localStorage.getItem(MOD.keys.widthElements) == null) localStorage.setItem(MOD.keys.widthElements, "520");
    if (localStorage.getItem(MOD.keys.widthOverhaul) == null) localStorage.setItem(MOD.keys.widthOverhaul, "520");
    if (localStorage.getItem(MOD.keys.maxElements) == null) localStorage.setItem(MOD.keys.maxElements, "0");
    if (localStorage.getItem(MOD.keys.maxOverhaul) == null) localStorage.setItem(MOD.keys.maxOverhaul, "0");
    if (localStorage.getItem(MOD.keys.compact) == null) localStorage.setItem(MOD.keys.compact, loadSettings().compactView ? "1" : "0");
    if (localStorage.getItem(MOD.keys.hideCats) == null) localStorage.setItem(MOD.keys.hideCats, loadSettings().hideCategories ? "1" : "0");

    injectCss("neo33Style", cssNeo());

    document.body.classList.add("sbx-neo33");
    document.body.style.setProperty("--neo-ui-scale", String(getUiScale()));

    ensureUI();
    addTopButtons();

    document.body.classList.toggle("neo-topstyle", !!loadSettings().restyleTopUI);
    document.body.classList.toggle("neo-hide-vanilla", !!loadSettings().hideVanillaElementUI);

    applyViewFlags();

    $("#neo33Elements")?.classList.toggle("open", isOpenElements());
    $("#neo33Overhaul")?.classList.toggle("open", isOpenOverhaul());
    $("#neo33Elements")?.classList.toggle("max", isMax("elements"));
    $("#neo33Overhaul")?.classList.toggle("max", isMax("overhaul"));

    buildOverhaulPanel();
    safeUpdateTopOffset();
    updateLayout();

    renderCats();
    setTab(currentTab);
    renderElements();

    // keep top offset stable even when UI changes
    window.addEventListener("resize", () => { safeUpdateTopOffset(); updateLayout(); });
    setInterval(() => { safeUpdateTopOffset(); updateLayout(); }, 900);

    installHotkeys();
    watchMods();
    enhanceModsUI();

    toast(`${MOD.name} v${MOD.version} loaded`);
  });

})();
