// sbx_neo_full_ui_overhaul_v3_2.js
// BIG UI + better Mods screen + mod search + no overlap + no stretched elements (auto grid)
// Hotkeys: B Elements, O Overhaul, / Search, Ctrl+K Search, Q swap last, Ctrl+Plus/Minus UI scale
(() => {
  "use strict";

  const MOD = {
    name: "Neo Full UI Overhaul",
    version: "3.2.0",
    keys: {
      settings: "sbx_neo32/settings",
      favs: "sbx_neo32/favs",
      recents: "sbx_neo32/recents",
      openElements: "sbx_neo32/open_elements",
      openOverhaul: "sbx_neo32/open_overhaul",
      widthElements: "sbx_neo32/w_elements",
      widthOverhaul: "sbx_neo32/w_overhaul",
      maxElements: "sbx_neo32/max_elements",
      maxOverhaul: "sbx_neo32/max_overhaul",
      tab: "sbx_neo32/tab",
      cat: "sbx_neo32/cat",
      compact: "sbx_neo32/compact",
      hideCats: "sbx_neo32/hide_cats",
      uiScale: "sbx_neo32/ui_scale",
    },
    defaults: {
      enable: true,

      // UI
      restyleTopUI: true,
      hideVanillaElementUI: true,
      openElementsOnStart: true,
      showPreview: true,
      showTooltips: true,
      autoCloseOnPick: false,

      // Browsing
      compactView: true,
      hideCategories: false,

      // BIG readable UI
      uiScale: 1.28, // 1.0 - 1.6

      // QoL
      hotkeys: true,
      toasts: true,

      // Tweaks/perf (safe-ish)
      smartHumans: true,
      trappedSkipFluids: true,
      lazyGases: true,
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
    for (const c of children) {
      if (c == null) continue;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
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
    else if (Array.isArray(window.runAfterLoadList)) window.runAfterLoadList.push(fn);
    else window.addEventListener("load", fn, { once: true });
  }

  function waitFor(fn, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const start = performance.now();
      const t = setInterval(() => {
        let val = null;
        try { val = fn(); } catch {}
        if (val) { clearInterval(t); resolve(val); }
        else if (performance.now() - start > timeoutMs) { clearInterval(t); reject(new Error("timeout")); }
      }, 50);
    });
  }

  // ---------- cleanup old stacks
  function cleanupOld() {
    [
      "neo31Style","neo31Overlay","neo31Elements","neo31Overhaul","neo31EdgeL","neo31EdgeR","neo31Toast","neo31Tip",
      "neo32Style","neo32Overlay","neo32Elements","neo32Overhaul","neo32EdgeL","neo32EdgeR","neo32Toast","neo32Tip",
      "psoStyle","psoSidebar","psoOverlay","psoHamburger","psoSettings","psoTip","psoToast","psoInspect",
      "sbxOHStyle","sbxOHBar","sbxOHPanel","sbxOHTooltip","sbxOHToast"
    ].forEach(id => $(`#${id}`)?.remove());
    document.body.classList.remove("sbx-neo31","sbx-neo32","sbx-pso","sbx-ohp","sbx-neo");
    $("#neo32TopElements")?.remove();
    $("#neo32TopOverhaul")?.remove();
  }

  // ---------- UI scale
  function getUiScale() {
    const s = loadSettings();
    const raw = localStorage.getItem(MOD.keys.uiScale);
    const v = raw == null ? s.uiScale : parseFloat(raw);
    return clamp(Number.isFinite(v) ? v : s.uiScale, 1.0, 1.6);
  }
  function setUiScale(v) {
    const next = clamp(v, 1.0, 1.6);
    localStorage.setItem(MOD.keys.uiScale, String(next));
    document.body.style.setProperty("--neo-ui-scale", String(next));
    updateLayout(); // top offset changes when UI grows
    toast(`UI scale: ${next.toFixed(2)}`);
  }

  // ---------- style (BIG readable UI + mod manager overhaul)
  function cssNeo() {
    return `
body.sbx-neo32{
  --neo-top: 78px;
  --neo-w-e: 520px;
  --neo-w-o: 520px;

  --neo-ui-scale: ${getUiScale()};

  --neo-panel: rgba(18,21,28,.92);
  --neo-panel2: rgba(14,16,22,.92);

  --neo-border: rgba(255,255,255,.12);
  --neo-border2: rgba(255,255,255,.08);

  --neo-text: rgba(255,255,255,.92);
  --neo-muted: rgba(255,255,255,.62);

  --neo-shadow: 0 16px 48px rgba(0,0,0,.55);
  --neo-shadow2: 0 10px 30px rgba(0,0,0,.45);
}

body.sbx-neo32.neo-hide-vanilla #categoryControls,
body.sbx-neo32.neo-hide-vanilla #elementControls{
  display:none !important;
}

/* =======================
   BIG READABLE TOP UI
   (real size increase: font+padding+height)
   ======================= */
body.sbx-neo32 #toolControls,
body.sbx-neo32 #controls{
  font-size: calc(14px * var(--neo-ui-scale));
}

/* Make top rows wrap nicely instead of squishing */
body.sbx-neo32 #toolControls,
body.sbx-neo32 #controls{
  display: flex;
  flex-wrap: wrap;
  gap: calc(6px * var(--neo-ui-scale)) calc(6px * var(--neo-ui-scale));
  align-items: center;
  padding: calc(2px * var(--neo-ui-scale)) calc(4px * var(--neo-ui-scale));
}

/* Bigger click targets for everything in those bars */
body.sbx-neo32 #toolControls .controlButton,
body.sbx-neo32 #controls .controlButton,
body.sbx-neo32 #controls button{
  font-size: calc(14px * var(--neo-ui-scale)) !important;
  line-height: 1.1 !important;
  padding: calc(6px * var(--neo-ui-scale)) calc(10px * var(--neo-ui-scale)) !important;
  min-height: calc(34px * var(--neo-ui-scale));
  border-radius: calc(12px * var(--neo-ui-scale)) !important;
}

/* Extra spacing between rows (so it's not cramped) */
body.sbx-neo32 #controls{
  row-gap: calc(8px * var(--neo-ui-scale));
}

/* “New GUI thingies” look */
body.sbx-neo32.neo-topstyle #toolControls .controlButton,
body.sbx-neo32.neo-topstyle #controls .controlButton{
  border: 1px solid var(--neo-border2) !important;
  background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04)) !important;
  color: var(--neo-text) !important;
  box-shadow: 0 6px 16px rgba(0,0,0,.25);
  transition: transform .06s ease, filter .12s ease;
}
body.sbx-neo32.neo-topstyle #toolControls .controlButton:hover,
body.sbx-neo32.neo-topstyle #controls .controlButton:hover{ filter: brightness(1.08); }
body.sbx-neo32.neo-topstyle #toolControls .controlButton:active,
body.sbx-neo32.neo-topstyle #controls .controlButton:active{ transform: translateY(1px); }

/* Improve the colored “mode” strip buttons too */
body.sbx-neo32.neo-topstyle #controls button:not(.controlButton){
  border: 1px solid rgba(255,255,255,.20) !important;
  box-shadow: 0 6px 14px rgba(0,0,0,.20);
}

/* =======================
   MOD MANAGER (Mods GUI) RESTYLE
   ======================= */
body.sbx-neo32.neo-topstyle #modManager,
body.sbx-neo32.neo-topstyle #modManager .menuScreen,
body.sbx-neo32.neo-topstyle #modManagerScreen,
body.sbx-neo32.neo-topstyle #modMenu,
body.sbx-neo32.neo-topstyle #modMenuScreen{
  border-radius: 18px !important;
  border: 1px solid var(--neo-border) !important;
  background: var(--neo-panel) !important;
  box-shadow: var(--neo-shadow) !important;
  color: var(--neo-text) !important;
}

/* If mod manager is a popup, make it bigger and readable */
body.sbx-neo32 #modManager,
body.sbx-neo32 #modManagerScreen,
body.sbx-neo32 #modMenu,
body.sbx-neo32 #modMenuScreen{
  width: min(980px, 96vw) !important;
  height: min(86vh, calc(100vh - var(--neo-top) - 20px)) !important;
  max-height: min(86vh, calc(100vh - var(--neo-top) - 20px)) !important;
  overflow: auto !important;
  padding: calc(10px * var(--neo-ui-scale)) !important;
}

/* Bigger inputs/buttons inside Mods GUI */
body.sbx-neo32 #modManager input,
body.sbx-neo32 #modManager button,
body.sbx-neo32 #modManager textarea,
body.sbx-neo32 #modManager select,
body.sbx-neo32 #modManagerScreen input,
body.sbx-neo32 #modManagerScreen button,
body.sbx-neo32 #modManagerScreen textarea,
body.sbx-neo32 #modManagerScreen select{
  font-size: calc(14px * var(--neo-ui-scale)) !important;
  border-radius: 14px !important;
  border: 1px solid rgba(255,255,255,.14) !important;
}

/* Make mod list items easier to read if they exist */
body.sbx-neo32 #modManager .mod,
body.sbx-neo32 #modManager .modItem,
body.sbx-neo32 #modManager .modRow,
body.sbx-neo32 #modManagerScreen .mod,
body.sbx-neo32 #modManagerScreen .modItem,
body.sbx-neo32 #modManagerScreen .modRow{
  padding: calc(10px * var(--neo-ui-scale)) !important;
  border-radius: 14px !important;
  border: 1px solid rgba(255,255,255,.10) !important;
  background: rgba(255,255,255,.04) !important;
  margin-bottom: calc(8px * var(--neo-ui-scale)) !important;
}

/* Our injected Mods search bar */
#neo32ModTools{
  position: sticky;
  top: 0;
  z-index: 50;
  display:flex;
  gap: 10px;
  align-items:center;
  padding: 10px 10px;
  margin-bottom: 10px;
  border-radius: 16px;
  background: rgba(0,0,0,.18);
  border: 1px solid rgba(255,255,255,.10);
  backdrop-filter: blur(6px);
}
#neo32ModSearch{
  flex: 1;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.05);
  color: rgba(255,255,255,.92);
  outline: none;
}
#neo32ModSearch::placeholder{ color: rgba(255,255,255,.60); }
.neo32MiniBtn{
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
  background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
  color: rgba(255,255,255,.92);
  cursor:pointer;
}
.neo32MiniBtn:hover{ filter: brightness(1.08); }

/* =======================
   Drawers (elements/overhaul)
   ======================= */
#neo32Overlay{
  position: fixed; inset: 0;
  background: rgba(0,0,0,.40);
  z-index: 999980;
  display:none;
}
#neo32Overlay.open{ display:block; }

#neo32EdgeL, #neo32EdgeR{
  position: fixed;
  top: calc(var(--neo-top) + 16px);
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
#neo32EdgeL{ left: 8px; }
#neo32EdgeR{ right: 8px; }
#neo32EdgeL .lbl, #neo32EdgeR .lbl{ display:block; font-weight: 900; letter-spacing: .6px; font-size: 12px; }
#neo32EdgeL .sub, #neo32EdgeR .sub{ display:block; font-size: 11px; color: var(--neo-muted); margin-top: 2px; }
#neo32EdgeL.hidden, #neo32EdgeR.hidden{ display:none; }

.neo32Drawer{
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
}

#neo32Elements{
  left: 10px;
  width: var(--neo-w-e);
  transform: translateX(-110%);
  transition: transform 160ms ease;
}
#neo32Elements.open{ transform: translateX(0); }

#neo32Overhaul{
  right: 10px;
  width: var(--neo-w-o);
  transform: translateX(110%);
  transition: transform 160ms ease;
}
#neo32Overhaul.open{ transform: translateX(0); }

.neo32Drawer.max{
  left: 10px !important;
  right: 10px !important;
  width: auto !important;
}

.neo32Hdr{
  display:flex; align-items:center; justify-content: space-between;
  gap: 8px;
  padding: 12px 12px 10px 12px;
  border-bottom: 1px solid var(--neo-border2);
  background: rgba(0,0,0,.10);
  border-top-left-radius: 18px;
  border-top-right-radius: 18px;
}
.neo32Title{ display:flex; flex-direction: column; gap: 2px; }
.neo32Title .t{ font-weight: 900; letter-spacing: .6px; }
.neo32Title .s{ font-size: 12px; color: var(--neo-muted); }
.neo32Btns{ display:flex; gap: 8px; }

.neo32Btn{
  border-radius: 12px;
  border: 1px solid var(--neo-border2);
  background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
  color: var(--neo-text);
  padding: 8px 10px;
  cursor: pointer;
}
.neo32Btn:hover{ filter: brightness(1.08); }
.neo32Btn:active{ transform: translateY(1px); }

.neo32Tabs{ display:flex; gap: 8px; padding: 10px 12px 0 12px; }
.neo32Tab{
  flex: 1; text-align:center;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid var(--neo-border2);
  background: rgba(255,255,255,.04);
  cursor:pointer;
  color: var(--neo-text);
  user-select:none;
}
.neo32Tab.active{
  border-color: rgba(76,201,240,.55);
  background: rgba(76,201,240,.10);
}

.neo32SearchRow{
  display:flex; gap: 8px;
  padding: 10px 12px 12px 12px;
  border-bottom: 1px solid var(--neo-border2);
}
#neo32Search{
  flex:1;
  border-radius: 14px;
  border: 1px solid var(--neo-border2);
  background: rgba(255,255,255,.05);
  color: var(--neo-text);
  padding: 10px 12px;
  outline:none;
}
#neo32Search::placeholder{ color: var(--neo-muted); }

#neo32ElBody{
  flex:1;
  display:grid;
  grid-template-columns: 170px 1fr;
  gap: 10px;
  padding: 10px 12px 12px 12px;
  overflow:hidden;
}
body.sbx-neo32.neo-hidecats #neo32ElBody{ grid-template-columns: 1fr; }
body.sbx-neo32.neo-hidecats #neo32Cats{ display:none; }

#neo32Cats{
  border: 1px solid var(--neo-border2);
  border-radius: 14px;
  background: var(--neo-panel2);
  overflow:auto;
  padding: 8px;
}
#neo32Cats::-webkit-scrollbar{ width: 10px; }
#neo32Cats::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.14); border-radius: 999px; }

.neo32Cat{
  width: 100%;
  text-align:left;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--neo-text);
  cursor:pointer;
  user-select:none;
  margin-bottom: 6px;
}
.neo32Cat:hover{ background: rgba(255,255,255,.05); }
.neo32Cat.active{
  border-color: rgba(167,139,250,.45);
  background: rgba(167,139,250,.10);
}

#neo32ElRight{ display:flex; flex-direction: column; gap: 10px; overflow:hidden; }

#neo32ElGridWrap{
  flex: 1;
  border: 1px solid var(--neo-border2);
  border-radius: 14px;
  background: var(--neo-panel2);
  overflow:hidden;
  display:flex;
  flex-direction: column;
}

#neo32ElGridHead{
  position: sticky;
  top: 0;
  z-index: 3;
  background: var(--neo-panel2);
  padding: 10px 10px 8px 10px;
  border-bottom: 1px solid var(--neo-border2);
  display:flex;
  justify-content: space-between;
  align-items:center;
  gap: 10px;
}
#neo32Count{ font-size: 12px; color: var(--neo-muted); }

/* Auto grid to prevent stretching */
#neo32ElGrid{
  padding: 10px;
  overflow:auto;
  display:grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}
#neo32ElGrid::-webkit-scrollbar{ width: 10px; }
#neo32ElGrid::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.14); border-radius: 999px; }

body.sbx-neo32.neo-compact #neo32ElGrid{
  grid-template-columns: repeat(auto-fill, minmax(125px, 1fr));
  gap: 8px;
}
body.sbx-neo32.neo-compact .neo32ElBtn{
  padding: 8px 8px;
  border-radius: 12px;
}
body.sbx-neo32.neo-compact .neo32Dot{ width: 12px; height: 12px; }

.neo32ElBtn{
  position: relative;
  display:flex;
  align-items:center;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 14px;
  border: 1px solid var(--neo-border2);
  background: linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.03));
  color: var(--neo-text);
  cursor:pointer;
  user-select:none;
}
.neo32ElBtn:hover{ filter: brightness(1.10); }
.neo32ElBtn:active{ transform: translateY(1px); }
.neo32Dot{
  width: 14px; height: 14px;
  border-radius: 999px;
  box-shadow: inset 0 0 0 2px rgba(0,0,0,.25);
}
.neo32Name{
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.neo32Star{
  position:absolute; right: 10px; top: 8px;
  font-size: 12px; opacity: .9;
}

#neo32Preview{
  border: 1px solid var(--neo-border2);
  border-radius: 14px;
  background: rgba(255,255,255,.04);
  padding: 10px 10px;
  display:none;
}
#neo32Preview.show{ display:block; }
#neo32Preview .muted{ color: var(--neo-muted); font-size: 12px; }

.neo32Resize{
  position:absolute; top: 10px; bottom: 10px;
  width: 10px; cursor: ew-resize; opacity: .6;
}
#neo32ResE{ right: -4px; }
#neo32ResO{ left: -4px; }

#neo32Tip{
  position: fixed; z-index: 999999;
  display:none; max-width: 360px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(12,14,18,.94);
  border: 1px solid var(--neo-border);
  color: var(--neo-text);
  box-shadow: var(--neo-shadow2);
  pointer-events:none;
  font-size: 12px;
}
#neo32Tip .muted{ color: var(--neo-muted); }

#neo32Toast{
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

#neo32OverBody{
  flex:1;
  overflow:auto;
  padding: 10px 12px 12px 12px;
}
#neo32OverBody::-webkit-scrollbar{ width: 10px; }
#neo32OverBody::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.14); border-radius: 999px; }
.neo32Section{ margin: 10px 0 8px 0; font-weight: 900; letter-spacing: .4px; }
.neo32Toggle{
  display:flex; gap: 10px; align-items:flex-start;
  padding: 10px 10px;
  border-radius: 14px;
  cursor:pointer;
  border: 1px solid transparent;
}
.neo32Toggle:hover{ background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.06); }
.neo32Small{ font-size: 12px; color: var(--neo-muted); margin-top: 2px; }
`;
  }

  // ---------- state
  let currentTab = localStorage.getItem(MOD.keys.tab) || "all";
  let currentCat = localStorage.getItem(MOD.keys.cat) || "all";
  let lastSelected = null;
  let currentSelected = null;
  let hovered = null;

  const getFavs = () => loadList(MOD.keys.favs);
  const setFavs = (a) => saveList(MOD.keys.favs, a, 40);
  const getRecents = () => loadList(MOD.keys.recents);
  const setRecents = (a) => saveList(MOD.keys.recents, a, 24);

  function isCompact() {
    const s = loadSettings();
    const fromKey = localStorage.getItem(MOD.keys.compact);
    return (fromKey == null) ? !!s.compactView : (fromKey === "1");
  }
  function isHideCats() {
    const s = loadSettings();
    const fromKey = localStorage.getItem(MOD.keys.hideCats);
    return (fromKey == null) ? !!s.hideCategories : (fromKey === "1");
  }
  function setCompact(on) { localStorage.setItem(MOD.keys.compact, on ? "1" : "0"); applyViewFlags(); renderElements(); }
  function setHideCats(on) { localStorage.setItem(MOD.keys.hideCats, on ? "1" : "0"); applyViewFlags(); updateLayout(); }

  function applyViewFlags() {
    document.body.classList.toggle("neo-compact", isCompact());
    document.body.classList.toggle("neo-hidecats", isHideCats());
  }

  function toast(msg) {
    if (!loadSettings().toasts) return;
    const t = $("#neo32Toast");
    if (!t) return;
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(toast._tm);
    toast._tm = setTimeout(() => (t.style.display = "none"), 1300);
  }

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

  function buildIndex() {
    const byCat = new Map();
    const all = [];
    if (!window.elements) return { byCat, all, cats: ["all"] };

    for (const [name, def] of Object.entries(window.elements)) {
      if (!def || def.hidden) continue;
      const cat = def.category || "other";
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(name);
      all.push(name);
    }

    const sortFn = (a, b) => prettyName(a).localeCompare(prettyName(b));
    for (const [k, arr] of byCat.entries()) arr.sort(sortFn);
    all.sort(sortFn);

    const cats = ["all", ...Array.from(byCat.keys()).sort((a, b) => String(a).localeCompare(String(b)))];
    return { byCat, all, cats };
  }

  // ---------- open/close + maximize
  function isOpenElements() { return localStorage.getItem(MOD.keys.openElements) === "1"; }
  function isOpenOverhaul() { return localStorage.getItem(MOD.keys.openOverhaul) === "1"; }
  function isMax(which) {
    const k = which === "elements" ? MOD.keys.maxElements : MOD.keys.maxOverhaul;
    return localStorage.getItem(k) === "1";
  }

  function setOpenElements(open) {
    if (open && window.innerWidth < 900) setOpenOverhaul(false);
    localStorage.setItem(MOD.keys.openElements, open ? "1" : "0");
    $("#neo32Elements")?.classList.toggle("open", open);
    if (!open) setMax("elements", false, true);
    updateLayout();
  }

  function setOpenOverhaul(open) {
    if (open && window.innerWidth < 900) setOpenElements(false);
    localStorage.setItem(MOD.keys.openOverhaul, open ? "1" : "0");
    $("#neo32Overhaul")?.classList.toggle("open", open);
    if (!open) setMax("overhaul", false, true);
    updateLayout();
  }

  function setMax(which, on, silent = false) {
    const key = which === "elements" ? MOD.keys.maxElements : MOD.keys.maxOverhaul;
    localStorage.setItem(key, on ? "1" : "0");

    const id = which === "elements" ? "#neo32Elements" : "#neo32Overhaul";
    $(id)?.classList.toggle("max", on);

    // one-max-at-a-time: close the other
    if (on) {
      if (which === "elements") {
        localStorage.setItem(MOD.keys.maxOverhaul, "0");
        $("#neo32Overhaul")?.classList.remove("max");
        setOpenOverhaul(false);
        setOpenElements(true);
      } else {
        localStorage.setItem(MOD.keys.maxElements, "0");
        $("#neo32Elements")?.classList.remove("max");
        setOpenElements(false);
        setOpenOverhaul(true);
      }
      if (!silent) toast(`${which} maximized`);
    } else {
      if (!silent) toast(`${which} unmaximized`);
    }

    updateLayout();
  }

  function syncOverlay() {
    const any = isOpenElements() || isOpenOverhaul();
    $("#neo32Overlay")?.classList.toggle("open", any);
  }

  function syncEdgeTabs() {
    const enabled = loadSettings().enable;
    $("#neo32EdgeL")?.classList.toggle("hidden", !enabled || isOpenElements());
    $("#neo32EdgeR")?.classList.toggle("hidden", !enabled || isOpenOverhaul());
  }

  // ---------- layout manager (no overlap when both open)
  function desiredWidth(key, fallback) {
    return clamp(parseInt(localStorage.getItem(key) || String(fallback), 10) || fallback, 320, 860);
  }

  function updateLayout() {
    updateTopOffset();

    const openE = isOpenElements();
    const openO = isOpenOverhaul();
    const maxE = isMax("elements");
    const maxO = isMax("overhaul");

    if (maxE || maxO) {
      document.body.style.setProperty("--neo-w-e", `${desiredWidth(MOD.keys.widthElements, 520)}px`);
      document.body.style.setProperty("--neo-w-o", `${desiredWidth(MOD.keys.widthOverhaul, 520)}px`);
      syncOverlay();
      syncEdgeTabs();
      return;
    }

    let wE = desiredWidth(MOD.keys.widthElements, 520);
    let wO = desiredWidth(MOD.keys.widthOverhaul, 520);

    if (openE && openO) {
      const vw = window.innerWidth;
      const margin = 20;
      const gap = 12;
      const available = Math.max(320, vw - margin - gap);
      const half = Math.max(320, Math.floor(available / 2));
      wE = Math.min(wE, half);
      wO = Math.min(wO, half);
      if (wE + wO > available) {
        const scale = available / (wE + wO);
        wE = clamp(Math.floor(wE * scale), 320, 860);
        wO = clamp(Math.floor(wO * scale), 320, 860);
      }
    }

    document.body.style.setProperty("--neo-w-e", `${wE}px`);
    document.body.style.setProperty("--neo-w-o", `${wO}px`);

    syncOverlay();
    syncEdgeTabs();
  }

  // ---------- top offset (accounts for bigger UI)
  function updateTopOffset() {
    const controls = $("#controls");
    if (!controls) return;

    let top = 72;
    const cat = $("#categoryControls");

    const kids = Array.from(controls.children || []);
    const cut = cat ? kids.indexOf(cat) : -1;
    const scan = cut > 0 ? kids.slice(0, cut) : kids;

    for (const k of scan) {
      if (!(k instanceof HTMLElement)) continue;
      const st = getComputedStyle(k);
      if (st.display === "none" || st.visibility === "hidden") continue;
      const r = k.getBoundingClientRect();
      if (r.height > 0) top = Math.max(top, Math.round(r.bottom) + 10);
    }

    const tc = $("#toolControls");
    if (tc) top = Math.max(top, Math.round(tc.getBoundingClientRect().bottom) + 10);

    document.body.style.setProperty("--neo-top", `${top}px`);
  }

  // ---------- UI build
  function ensureUI() {
    if ($("#neo32Elements")) return;

    document.body.classList.add("sbx-neo32");

    document.body.appendChild(el("div", { id: "neo32Overlay", onclick: () => { setOpenElements(false); setOpenOverhaul(false); } }));

    document.body.appendChild(el("div", {
      id: "neo32EdgeL",
      onclick: () => setOpenElements(true),
      title: "Open Elements (B)"
    }, el("span", { class: "lbl" }, "ELEMENTS"), el("span", { class: "sub" }, "Open")));

    document.body.appendChild(el("div", {
      id: "neo32EdgeR",
      onclick: () => setOpenOverhaul(true),
      title: "Open Overhaul (O)"
    }, el("span", { class: "lbl" }, "OVERHAUL"), el("span", { class: "sub" }, "Settings")));

    document.body.appendChild(el("div", { id: "neo32Toast" }));
    document.body.appendChild(el("div", { id: "neo32Tip" }));

    const elDrawer = el("div", { id: "neo32Elements", class: "neo32Drawer" },
      el("div", { class: "neo32Hdr" },
        el("div", { class: "neo32Title" },
          el("div", { class: "t" }, "ELEMENTS"),
          el("div", { class: "s", id: "neo32ElSub" }, "Search • Categories • Grid")
        ),
        el("div", { class: "neo32Btns" },
          el("button", { class: "neo32Btn", title: "Compact view", onclick: () => setCompact(!isCompact()) }, "▦"),
          el("button", { class: "neo32Btn", title: "Hide/show categories", onclick: () => setHideCats(!isHideCats()) }, "☰"),
          el("button", { class: "neo32Btn", title: "Maximize (closes other panel)", onclick: () => setMax("elements", !isMax("elements")) }, "⤢"),
          el("button", { class: "neo32Btn", title: "Overhaul", onclick: () => setOpenOverhaul(true) }, "⚙"),
          el("button", { class: "neo32Btn", title: "Close (B)", onclick: () => setOpenElements(false) }, "×"),
        )
      ),
      el("div", { class: "neo32Tabs" },
        el("div", { class: "neo32Tab", id: "neo32TabAll", onclick: () => setTab("all") }, "All"),
        el("div", { class: "neo32Tab", id: "neo32TabFav", onclick: () => setTab("fav") }, "Favorites"),
        el("div", { class: "neo32Tab", id: "neo32TabRec", onclick: () => setTab("recent") }, "Recents")
      ),
      el("div", { class: "neo32SearchRow" },
        el("input", { id: "neo32Search", type: "text", placeholder: "Search elements…   (/ or Ctrl+K)" }),
        el("button", { class: "neo32Btn", title: "Clear search (Esc)", onclick: () => { $("#neo32Search").value = ""; renderElements(); $("#neo32Search").focus(); } }, "×")
      ),
      el("div", { id: "neo32ElBody" },
        el("div", { id: "neo32Cats" }),
        el("div", { id: "neo32ElRight" },
          el("div", { id: "neo32ElGridWrap" },
            el("div", { id: "neo32ElGridHead" },
              el("div", { id: "neo32Count" }, ""),
              el("div", { style: "display:flex; gap:8px; align-items:center;" },
                el("button", { class: "neo32Btn", title: "Auto-close after pick", onclick: () => { const s = loadSettings(); s.autoCloseOnPick = !s.autoCloseOnPick; saveSettings(s); toast(`Auto-close: ${s.autoCloseOnPick ? "ON" : "OFF"}`); } }, "📌"),
                el("button", { class: "neo32Btn", title: "Close drawer (B)", onclick: () => setOpenElements(false) }, "Hide"),
              )
            ),
            el("div", { id: "neo32ElGrid" }),
          ),
          el("div", { id: "neo32Preview" })
        )
      ),
      el("div", { id: "neo32ResE", class: "neo32Resize", title: "Drag to resize" })
    );

    const overDrawer = el("div", { id: "neo32Overhaul", class: "neo32Drawer" },
      el("div", { class: "neo32Hdr" },
        el("div", { class: "neo32Title" },
          el("div", { class: "t" }, "OVERHAUL"),
          el("div", { class: "s" }, "Big UI • Scrollable • Mods panel improved")
        ),
        el("div", { class: "neo32Btns" },
          el("button", { class: "neo32Btn", title: "Maximize (closes other panel)", onclick: () => setMax("overhaul", !isMax("overhaul")) }, "⤢"),
          el("button", { class: "neo32Btn", title: "Elements", onclick: () => setOpenElements(true) }, "☰"),
          el("button", { class: "neo32Btn", title: "Close (O)", onclick: () => setOpenOverhaul(false) }, "×"),
        )
      ),
      el("div", { id: "neo32OverBody" }),
      el("div", { id: "neo32ResO", class: "neo32Resize", title: "Drag to resize" })
    );

    document.body.append(elDrawer, overDrawer);
    $("#neo32Search").addEventListener("input", () => renderElements());
  }

  function addTopButtons() {
    const tc = $("#toolControls");
    if (!tc) return;

    if (!$("#neo32TopElements")) {
      const b = el("button", {
        id: "neo32TopElements",
        class: "controlButton",
        title: "Open Elements (B)",
        onclick: () => setOpenElements(!isOpenElements())
      }, "☰ Elements");
      tc.prepend(b);
    }

    if (!$("#neo32TopOverhaul")) {
      const b = el("button", {
        id: "neo32TopOverhaul",
        class: "controlButton",
        title: "Open Overhaul (O)",
        onclick: () => setOpenOverhaul(!isOpenOverhaul())
      }, "⚙ Overhaul");
      tc.appendChild(b);
    }
  }

  // ---------- overhaul panel
  function buildOverhaulPanel() {
    const body = $("#neo32OverBody");
    if (!body) return;
    body.innerHTML = "";

    const s = loadSettings();

    function toggleRow(key, title, desc) {
      const id = `neo32_${key}`;
      return el("label", { class: "neo32Toggle", for: id },
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
        el("div", {},
          el("div", { style: "font-weight:800;" }, title),
          el("div", { class: "neo32Small" }, desc)
        )
      );
    }

    const section = (t) => el("div", { class: "neo32Section" }, t);

    // UI scale slider
    const scaleVal = getUiScale();
    const scaleRow = el("div", { class: "neo32Toggle", style: "cursor: default;" },
      el("div", { style: "min-width: 18px;" }),
      el("div", { style: "width: 100%;" },
        el("div", { style: "font-weight:800;" }, `UI size (scale): ${scaleVal.toFixed(2)}`),
        el("div", { class: "neo32Small" }, "Bigger text/buttons everywhere (top bar + menus + mods screen)"),
        el("div", { style: "display:flex; gap:10px; align-items:center; margin-top:10px;" },
          el("button", { class: "neo32Btn", onclick: () => setUiScale(getUiScale() - 0.06) }, "–"),
          el("input", {
            type: "range",
            min: "1.0",
            max: "1.6",
            step: "0.02",
            value: String(scaleVal),
            style: "flex:1;",
            oninput: (ev) => setUiScale(parseFloat(ev.target.value))
          }),
          el("button", { class: "neo32Btn", onclick: () => setUiScale(getUiScale() + 0.06) }, "+"),
        )
      )
    );

    body.append(
      section("BIG UI"),
      scaleRow,

      section("UI"),
      toggleRow("restyleTopUI", "New-looking top GUI", "Modern pills + nicer menus"),
      toggleRow("hideVanillaElementUI", "Hide vanilla element/category rows", "Use the big drawers instead"),
      toggleRow("openElementsOnStart", "Open Elements on start", "Open drawer automatically on refresh"),
      toggleRow("showPreview", "Show element preview", "Extra info panel in Elements drawer"),
      toggleRow("showTooltips", "Tooltips", "Hover element buttons for quick info"),
      toggleRow("autoCloseOnPick", "Auto-close after selecting element", "More space for the sim"),

      section("Browsing"),
      toggleRow("compactView", "Compact element grid", "Shows more elements at once"),
      toggleRow("hideCategories", "Hide categories column", "More space for the grid"),

      section("Quality of life"),
      toggleRow("hotkeys", "Hotkeys", "B elements, O overhaul, / search, Ctrl+K search, Q swap last, Ctrl± UI size"),
      toggleRow("toasts", "Toasts", "Small notifications"),

      section("Tweaks / performance"),
      toggleRow("smartHumans", "Smart humans", "Humans try to step away from danger"),
      toggleRow("trappedSkipFluids", "Skip trapped fluids", "Helps lag with enclosed big fluid blobs"),
      toggleRow("lazyGases", "Lazy gases", "Helps lag with enclosed big gas blobs"),

      el("div", { style: "height:1px; background: rgba(255,255,255,.08); margin: 12px 0;" }),

      el("div", { style: "display:flex; gap:10px; flex-wrap:wrap;" },
        el("button", { class: "neo32Btn", onclick: () => { setFavs([]); toast("Favorites cleared"); renderElements(); } }, "Clear favs"),
        el("button", { class: "neo32Btn", onclick: () => { setRecents([]); toast("Recents cleared"); renderElements(); } }, "Clear recents"),
        el("button", { class: "neo32Btn", onclick: () => { saveSettings({ ...MOD.defaults }); localStorage.removeItem(MOD.keys.uiScale); toast("Reset + reload"); location.reload(); } }, "Reset + reload")
      )
    );
  }

  function liveApply() {
    const s = loadSettings();

    document.body.classList.toggle("neo-topstyle", !!s.restyleTopUI);
    document.body.classList.toggle("neo-hide-vanilla", !!(s.enable && s.hideVanillaElementUI));

    if (localStorage.getItem(MOD.keys.compact) == null) localStorage.setItem(MOD.keys.compact, s.compactView ? "1" : "0");
    if (localStorage.getItem(MOD.keys.hideCats) == null) localStorage.setItem(MOD.keys.hideCats, s.hideCategories ? "1" : "0");
    if (localStorage.getItem(MOD.keys.uiScale) == null) localStorage.setItem(MOD.keys.uiScale, String(s.uiScale));

    document.body.style.setProperty("--neo-ui-scale", String(getUiScale()));

    applyViewFlags();
    buildOverhaulPanel();
    renderCats();
    renderElements();

    $("#neo32Preview")?.classList.toggle("show", !!s.showPreview);

    updateLayout();
    enhanceModsUI(); // restyle + search injection
  }

  // ---------- selection wrapper
  function hookSelectElement() {
    if (typeof window.selectElement !== "function") return;
    if (window.selectElement.__neo32Wrapped) return;

    const old = window.selectElement;
    function wrapped(name, ...rest) {
      try {
        lastSelected = currentSelected;
        currentSelected = name;
        pushRecent(name);
        if (loadSettings().autoCloseOnPick) setOpenElements(false);
        updatePreview(name);
      } catch {}
      return old.call(this, name, ...rest);
    }
    wrapped.__neo32Wrapped = true;
    window.selectElement = wrapped;
  }

  function toggleFavorite(name) {
    if (!name) return;
    const favs = getFavs();
    const i = favs.indexOf(name);
    if (i >= 0) favs.splice(i, 1);
    else favs.unshift(name);
    setFavs(favs);
    toast(i >= 0 ? `Unfavorited: ${prettyName(name)}` : `Favorited: ${prettyName(name)}`);
    renderElements();
  }

  function pushRecent(name) {
    if (!name) return;
    const r = getRecents();
    const next = [name, ...r.filter(x => x !== name)];
    setRecents(next);
  }

  // ---------- tabs + categories
  function setTab(t) {
    currentTab = t;
    localStorage.setItem(MOD.keys.tab, t);
    $("#neo32TabAll")?.classList.toggle("active", t === "all");
    $("#neo32TabFav")?.classList.toggle("active", t === "fav");
    $("#neo32TabRec")?.classList.toggle("active", t === "recent");
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
    const wrap = $("#neo32Cats");
    if (!wrap) return;

    const { cats } = buildIndex();
    const labelMap = buildCategoryLabelsFromDOM();

    wrap.innerHTML = "";
    for (const c of cats) {
      const label = (c === "all") ? "All" : (labelMap.get(c) || String(c).replace(/_/g, " "));
      const btn = el("button", { class: `neo32Cat ${currentCat === c ? "active" : ""}` }, label);
      btn.onclick = () => setCat(c);
      wrap.appendChild(btn);
    }
  }

  function inCat(def) {
    if (currentCat === "all") return true;
    return String(def?.category || "other") === String(currentCat);
  }

  function tabList({ all, byCat }) {
    const favs = getFavs().filter(n => window.elements?.[n]);
    const rec = getRecents().filter(n => window.elements?.[n]);
    if (currentTab === "fav") return favs;
    if (currentTab === "recent") return rec;
    if (currentCat === "all") return all;
    return (byCat.get(currentCat) || []);
  }

  function renderElements() {
    const grid = $("#neo32ElGrid");
    const count = $("#neo32Count");
    if (!grid) return;

    const s = loadSettings();
    const query = ($("#neo32Search")?.value || "").trim().toLowerCase();
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

      const btn = el("button", { class: "neo32ElBtn", "data-el": name });
      const dot = el("span", { class: "neo32Dot", style: `background:${elementColor(name)};` });
      const nm = el("span", { class: "neo32Name" }, prettyName(name));

      if (favSet.has(name)) btn.appendChild(el("span", { class: "neo32Star", title: "Favorite" }, "★"));
      btn.append(dot, nm);

      btn.onclick = () => { window.selectElement?.(name); toast(`Selected: ${prettyName(name)}`); };

      btn.addEventListener("contextmenu", (ev) => { ev.preventDefault(); toggleFavorite(name); });

      btn.addEventListener("mouseenter", (ev) => {
        hovered = name;
        if (s.showTooltips) showTip(ev, name);
        updatePreview(name, true);
      });
      btn.addEventListener("mousemove", (ev) => { if (s.showTooltips) moveTip(ev); });
      btn.addEventListener("mouseleave", () => {
        hovered = null;
        hideTip();
        if (currentSelected) updatePreview(currentSelected);
      });

      grid.appendChild(btn);
      shown++;
    }

    if (count) count.textContent = `${shown} shown • right-click = favorite`;
    $("#neo32Preview")?.classList.toggle("show", !!s.showPreview);

    if (s.showPreview && !currentSelected && !hovered) {
      const box = $("#neo32Preview");
      if (box) box.innerHTML = `<div class="muted">Hover or select an element to see details.</div>`;
    }
  }

  function updatePreview(name, isHover = false) {
    const s = loadSettings();
    const box = $("#neo32Preview");
    if (!box || !s.showPreview) return;

    const def = window.elements?.[name];
    if (!def) {
      box.innerHTML = `<div class="muted">Hover or select an element to see details.</div>`;
      return;
    }

    const favSet = new Set(getFavs());
    const cat = def.category ?? "—";
    const state = def.state ?? "—";
    const dens = (typeof def.density === "number") ? def.density : "—";
    const visc = (typeof def.viscosity === "number") ? def.viscosity : "—";
    const desc = def.desc || def.description || "";

    box.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
          <span class="neo32Dot" style="background:${elementColor(name)};"></span>
          <div style="min-width:0;">
            <div style="font-weight:900; letter-spacing:.3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${prettyName(name)} ${isHover ? '<span class="muted">(hover)</span>' : ''}
            </div>
            <div class="muted">${name}</div>
          </div>
        </div>
        <button class="neo32Btn" id="neo32PrevFav">${favSet.has(name) ? "★" : "☆"}</button>
      </div>
      <div class="muted" style="margin-top:8px;">
        Category: <b style="color:rgba(255,255,255,.92)">${cat}</b> • State: <b style="color:rgba(255,255,255,.92)">${state}</b><br>
        Density: <b style="color:rgba(255,255,255,.92)">${dens}</b> • Viscosity: <b style="color:rgba(255,255,255,.92)">${visc}</b>
      </div>
      ${desc ? `<div class="muted" style="margin-top:8px;">${String(desc).slice(0, 260)}</div>` : ""}
    `;

    const favBtn = $("#neo32PrevFav");
    if (favBtn) favBtn.onclick = () => toggleFavorite(name);
  }

  // ---------- tooltip
  function showTip(ev, name) {
    const tip = $("#neo32Tip");
    if (!tip) return;
    const def = window.elements?.[name];
    if (!def) return;

    tip.innerHTML = `
      <b>${prettyName(name)}</b> <span class="muted">(${name})</span><br>
      <span class="muted">Category:</span> ${def.category ?? "—"} &nbsp; <span class="muted">State:</span> ${def.state ?? "—"}
    `;
    tip.style.display = "block";
    moveTip(ev);
  }
  function moveTip(ev) {
    const tip = $("#neo32Tip");
    if (!tip || tip.style.display === "none") return;
    const pad = 14;
    tip.style.left = `${Math.min(window.innerWidth - 16, ev.clientX + pad)}px`;
    tip.style.top  = `${Math.min(window.innerHeight - 16, ev.clientY + pad)}px`;
  }
  function hideTip() {
    const tip = $("#neo32Tip");
    if (tip) tip.style.display = "none";
  }

  // ---------- resizing
  function installResize(which) {
    const drawer = which === "elements" ? $("#neo32Elements") : $("#neo32Overhaul");
    const handle = which === "elements" ? $("#neo32ResE") : $("#neo32ResO");
    if (!drawer || !handle) return;

    let dragging = false, startX = 0, startW = 0;

    handle.addEventListener("pointerdown", (ev) => {
      dragging = true;
      startX = ev.clientX;
      startW = drawer.getBoundingClientRect().width;
      handle.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });

    window.addEventListener("pointermove", (ev) => {
      if (!dragging) return;
      const dx = ev.clientX - startX;
      let w;
      if (which === "elements") w = clamp(startW + dx, 320, 860);
      else w = clamp(startW - dx, 320, 860);

      if (which === "elements") localStorage.setItem(MOD.keys.widthElements, String(w));
      else localStorage.setItem(MOD.keys.widthOverhaul, String(w));

      updateLayout();
    });

    window.addEventListener("pointerup", () => { dragging = false; });
    window.addEventListener("pointercancel", () => { dragging = false; });
  }

  // ---------- hotkeys (includes UI scale)
  function installHotkeys() {
    window.addEventListener("keydown", (ev) => {
      const s = loadSettings();
      if (!s.hotkeys) return;

      const a = document.activeElement;
      const typing = a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");

      if (!typing && ev.key.toLowerCase() === "b") { ev.preventDefault(); setOpenElements(!isOpenElements()); }
      if (!typing && ev.key.toLowerCase() === "o") { ev.preventDefault(); setOpenOverhaul(!isOpenOverhaul()); }

      if (!typing && ev.key === "/") {
        ev.preventDefault();
        setOpenElements(true);
        $("#neo32Search")?.focus();
        $("#neo32Search")?.select();
      }

      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") {
        ev.preventDefault();
        setOpenElements(true);
        $("#neo32Search")?.focus();
        $("#neo32Search")?.select();
      }

      // Ctrl + / - UI scale
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === "+" || ev.key === "=")) { ev.preventDefault(); setUiScale(getUiScale() + 0.06); }
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === "-" || ev.key === "_")) { ev.preventDefault(); setUiScale(getUiScale() - 0.06); }

      if (ev.key === "Escape" && a === $("#neo32Search")) {
        ev.preventDefault();
        $("#neo32Search").value = "";
        renderElements();
        $("#neo32Search").blur();
      }

      if (!typing && ev.key.toLowerCase() === "q" && lastSelected) {
        ev.preventDefault();
        window.selectElement?.(lastSelected);
        toast(`Swapped: ${prettyName(lastSelected)}`);
      }
    }, { passive: false });
  }

  // ---------- Mods GUI improvement (search filter injected)
  function findModManagerRoot() {
    // Try common ids
    return $("#modManager") || $("#modManagerScreen") || $("#modMenu") || $("#modMenuScreen");
  }

  function findModRows(root) {
    if (!root) return [];
    // Heuristic: rows often have a checkbox and some text
    const checks = $$('input[type="checkbox"]', root);
    const rows = new Set();
    for (const cb of checks) {
      const row = cb.closest("div, li, tr") || cb.parentElement;
      if (row && row.textContent && row.textContent.trim().length) rows.add(row);
    }
    // fallback: any element with class containing "mod"
    if (rows.size < 3) {
      for (const n of $$("*", root)) {
        const cls = (n.className || "").toString().toLowerCase();
        if (cls.includes("mod") && n.textContent && n.textContent.trim().length > 2) rows.add(n);
      }
    }
    return Array.from(rows).filter(r => r instanceof HTMLElement);
  }

  function enhanceModsUI() {
    const root = findModManagerRoot();
    if (!root) return;

    // avoid duplicating toolbar
    if ($("#neo32ModTools", root)) return;

    // Create tools bar
    const bar = el("div", { id: "neo32ModTools" },
      el("input", { id: "neo32ModSearch", type: "text", placeholder: "Search mods… (name, url, tag)" }),
      el("button", { class: "neo32MiniBtn", title: "Bigger UI", onclick: () => setUiScale(getUiScale() + 0.06) }, "UI +"),
      el("button", { class: "neo32MiniBtn", title: "Smaller UI", onclick: () => setUiScale(getUiScale() - 0.06) }, "UI –"),
      el("button", { class: "neo32MiniBtn", title: "Clear search", onclick: () => { const i = $("#neo32ModSearch", root); i.value = ""; i.dispatchEvent(new Event("input")); } }, "Clear"),
    );

    // Insert at top
    root.prepend(bar);

    const input = $("#neo32ModSearch", root);
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      const rows = findModRows(root);
      if (!q) {
        for (const r of rows) r.style.display = "";
        return;
      }
      for (const r of rows) {
        const t = (r.textContent || "").toLowerCase();
        r.style.display = t.includes(q) ? "" : "none";
      }
    });

    // If mod manager is opened later, keep tools visible
    bar.style.display = "flex";
  }

  // Observe mod manager opening
  function watchModsOpen() {
    const check = () => {
      const root = findModManagerRoot();
      if (!root) return;
      enhanceModsUI();
    };
    setInterval(check, 900);
  }

  // ---------- tweaks/perf (same as before)
  function patchSmartHumans() {
    const e = window.elements;
    if (!e?.human || e.human.__neo32Smart || typeof e.human.tick !== "function") return;
    e.human.__neo32Smart = true;

    const old = e.human.tick;
    const danger = new Set(["fire","smoke","lava","magma","acid","acid_gas","explosion","radiation","plasma","napalm","greek_fire","nuke"]);
    const adj = window.adjacentCoords;
    const tryMove = window.tryMove;

    e.human.tick = function (pixel) {
      try {
        const pm = window.pixelMap;
        if (!pm || !adj || !tryMove) return old(pixel);

        let vx = 0, vy = 0, seen = 0;
        for (const [dx, dy] of adj) {
          const p2 = pm?.[pixel.x + dx]?.[pixel.y + dy];
          if (!p2) continue;
          const hot = typeof p2.temp === "number" && p2.temp > 250;
          if (danger.has(p2.element) || hot) { vx += dx; vy += dy; seen++; }
        }
        if (seen) {
          const ax = vx === 0 ? 0 : (vx > 0 ? -1 : 1);
          const ay = vy === 0 ? 0 : (vy > 0 ? -1 : 1);
          const tries = [
            [pixel.x + ax, pixel.y],
            [pixel.x, pixel.y + ay],
            [pixel.x + ax, pixel.y + ay],
            [pixel.x + ax, pixel.y - ay],
          ];
          for (const [tx, ty] of tries) if (tryMove(pixel, tx, ty)) return;
        }
      } catch {}
      return old(pixel);
    };
  }

  function patchTrappedSkipFluids() {
    const e = window.elements;
    const adj = window.adjacentCoords;
    if (!e || !adj) return;

    const targets = ["water","salt_water","dirty_water","steam","smoke","cloud"];
    for (const name of targets) {
      const def = e[name];
      if (!def || def.__neo32Trap || typeof def.tick !== "function") continue;
      def.__neo32Trap = true;
      const old = def.tick;

      def.tick = function (pixel) {
        try {
          if (Math.random() < 0.40) {
            const pm = window.pixelMap;
            if (!pm) return old(pixel);
            let trapped = true;
            for (const [dx, dy] of adj) {
              const p2 = pm?.[pixel.x + dx]?.[pixel.y + dy];
              if (!p2 || p2.element !== pixel.element) { trapped = false; break; }
            }
            if (trapped) return;
          }
        } catch {}
        return old(pixel);
      };
    }
  }

  function patchLazyGases() {
    const e = window.elements;
    const adj = window.adjacentCoords;
    if (!e || !adj) return;

    for (const [name, def] of Object.entries(e)) {
      if (!def || def.__neo32LazyGas || typeof def.tick !== "function") continue;
      if (def.state !== "gas") continue;

      def.__neo32LazyGas = true;
      const old = def.tick;

      def.tick = function (pixel) {
        try {
          if (Math.random() < 0.35) {
            const pm = window.pixelMap;
            if (!pm) return old(pixel);
            let surrounded = true;
            for (const [dx, dy] of adj) {
              const p2 = pm?.[pixel.x + dx]?.[pixel.y + dy];
              if (!p2 || p2.element !== pixel.element) { surrounded = false; break; }
            }
            if (surrounded) return;
          }
        } catch {}
        return old(pixel);
      };
    }
  }

  // ---------- boot
  onGameReady(async () => {
    cleanupOld();

    try { await waitFor(() => $("#controls")); } catch {}
    try { await waitFor(() => $("#toolControls")); } catch {}

    // init stored scale if missing
    if (localStorage.getItem(MOD.keys.uiScale) == null) {
      localStorage.setItem(MOD.keys.uiScale, String(loadSettings().uiScale));
    }

    injectCss("neo32Style", cssNeo());

    const s = loadSettings();
    if (!s.enable) return;

    document.body.classList.add("sbx-neo32");
    document.body.style.setProperty("--neo-ui-scale", String(getUiScale()));

    ensureUI();
    addTopButtons();

    // init prefs
    if (localStorage.getItem(MOD.keys.openElements) == null) localStorage.setItem(MOD.keys.openElements, s.openElementsOnStart ? "1" : "0");
    if (localStorage.getItem(MOD.keys.openOverhaul) == null) localStorage.setItem(MOD.keys.openOverhaul, "0");

    if (localStorage.getItem(MOD.keys.widthElements) == null) localStorage.setItem(MOD.keys.widthElements, "520");
    if (localStorage.getItem(MOD.keys.widthOverhaul) == null) localStorage.setItem(MOD.keys.widthOverhaul, "520");

    if (localStorage.getItem(MOD.keys.maxElements) == null) localStorage.setItem(MOD.keys.maxElements, "0");
    if (localStorage.getItem(MOD.keys.maxOverhaul) == null) localStorage.setItem(MOD.keys.maxOverhaul, "0");

    if (localStorage.getItem(MOD.keys.compact) == null) localStorage.setItem(MOD.keys.compact, s.compactView ? "1" : "0");
    if (localStorage.getItem(MOD.keys.hideCats) == null) localStorage.setItem(MOD.keys.hideCats, s.hideCategories ? "1" : "0");

    hookSelectElement();

    document.body.classList.toggle("neo-topstyle", !!s.restyleTopUI);
    document.body.classList.toggle("neo-hide-vanilla", !!(s.hideVanillaElementUI));
    applyViewFlags();

    $("#neo32Elements")?.classList.toggle("open", isOpenElements());
    $("#neo32Overhaul")?.classList.toggle("open", isOpenOverhaul());
    $("#neo32Elements")?.classList.toggle("max", isMax("elements"));
    $("#neo32Overhaul")?.classList.toggle("max", isMax("overhaul"));

    buildOverhaulPanel();
    setTab(currentTab);
    setCat(currentCat);
    renderCats();
    renderElements();

    updateLayout();
    window.addEventListener("resize", updateLayout);
    setInterval(updateLayout, 1200);

    installResize("elements");
    installResize("overhaul");
    if (s.hotkeys) installHotkeys();

    if (s.smartHumans) patchSmartHumans();
    if (s.trappedSkipFluids) patchTrappedSkipFluids();
    if (s.lazyGases) patchLazyGases();

    watchModsOpen();
    enhanceModsUI();

    const ec = $("#elementControls");
    if (ec) {
      const mo = new MutationObserver(() => { renderCats(); renderElements(); });
      mo.observe(ec, { childList: true, subtree: true });
    }

    toast(`${MOD.name} v${MOD.version} loaded`);
  });

})();
