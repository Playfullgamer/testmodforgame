// sbx_neo_full_ui_overhaul_v3_4.js
// Neo Full UI Overhaul v3.4.0
// Keeps: Elements drawer + Overhaul drawer + big readable UI + safe top offset + mods menu restyle + Ctrl+0 panic reset
// Adds:
// - Mods Library inside Overhaul (disable without removing; import/export; profiles-lite via export)
// - Non-overlapping Info Bar (toggleable)
// - Mods menu gets a safe "Open Neo Mods" button + search (no hijacking)
// Notes:
// - Disabling mods needs Reload to fully unload (game limitation)

(() => {
  "use strict";

  const MOD = {
    name: "Neo Full UI Overhaul",
    version: "3.4.0",
    keys: {
      settings: "sbx_neo34/settings",
      favs: "sbx_neo34/favs",
      recents: "sbx_neo34/recents",
      openElements: "sbx_neo34/open_elements",
      openOverhaul: "sbx_neo34/open_overhaul",
      widthElements: "sbx_neo34/w_elements",
      widthOverhaul: "sbx_neo34/w_overhaul",
      maxElements: "sbx_neo34/max_elements",
      maxOverhaul: "sbx_neo34/max_overhaul",
      tab: "sbx_neo34/tab",
      cat: "sbx_neo34/cat",
      compact: "sbx_neo34/compact",
      hideCats: "sbx_neo34/hide_cats",
      uiScale: "sbx_neo34/ui_scale",

      // mods library (disable without deleting)
      modLib: "sbx_neo34/modlib",
      modKeyGuess: "sbx_neo34/modkey_guess",
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
      uiScale: 1.30,
      hotkeys: true,
      toasts: true,
      infoBar: true,
      modsInOverhaul: true,
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

  function copyText(text) {
    const t = String(text || "");
    if (!t) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(t).catch(() => prompt("Copy:", t));
    } else {
      prompt("Copy:", t);
    }
  }

  // ---------- cleanup old / conflicting UI scripts
  function cleanupOld() {
    [
      // old neo ids
      "neo32Style","neo32Overlay","neo32Elements","neo32Overhaul","neo32EdgeL","neo32EdgeR","neo32Toast","neo32Tip",
      "neo33Style","neo33Overlay","neo33Elements","neo33Overhaul","neo33EdgeL","neo33EdgeR","neo33Toast","neo33Tip",
      "neo34Style","neo34Overlay","neo34Elements","neo34Overhaul","neo34EdgeL","neo34EdgeR","neo34Toast",
      "neo33TopElements","neo33TopOverhaul","neo34TopElements","neo34TopOverhaul",
      // other modcenter leftovers (safe remove)
      "uiplus_overlay","uiplus_panel","uiplus_hud","uiplus_toasts",
      "neoMCOverlay","neoModCenterOverlay"
    ].forEach(id => $(`#${id}`)?.remove());

    document.body.classList.remove("sbx-neo31","sbx-neo32","sbx-neo33","sbx-neo34","sbx-neo","sbx-pso","sbx-ohp");
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
    const t = $("#neo34Toast");
    if (!t) return;
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(toast._tm);
    toast._tm = setTimeout(() => (t.style.display = "none"), 1200);
  }

  // ---------- Mods enabled list (read/write) + library (disable without deleting)
  function looksLikeModString(s) {
    if (typeof s !== "string") return false;
    const t = s.trim().toLowerCase();
    return t.endsWith(".js") || t.includes(".js?") || t.startsWith("http://") || t.startsWith("https://");
  }
  function normalizeMods(str) {
    return String(str || "").split(";").map(s => s.trim()).filter(Boolean);
  }
  function isModsArray(v) {
    return Array.isArray(v) && v.every(x => typeof x === "string");
  }

  function guessEnabledModsKey() {
    const cached = localStorage.getItem(MOD.keys.modKeyGuess);
    if (cached && localStorage.getItem(cached) != null) return cached;

    const candidates = [
      "enabledMods","mods","modList","modsEnabled","enabled_mods","enabled-mods","sb_mods","sbmods"
    ];

    for (const k of candidates) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const v = JSON.parse(raw);
        if (isModsArray(v) && v.some(looksLikeModString)) {
          localStorage.setItem(MOD.keys.modKeyGuess, k);
          return k;
        }
      } catch {
        const parts = normalizeMods(raw);
        if (parts.length && parts.some(looksLikeModString)) {
          localStorage.setItem(MOD.keys.modKeyGuess, k);
          return k;
        }
      }
    }

    // scan localStorage for something that looks like mods
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const raw = localStorage.getItem(k);
      if (!raw || (!raw.includes(".js") && !raw.includes("http"))) continue;

      try {
        const v = JSON.parse(raw);
        if (isModsArray(v) && v.some(looksLikeModString)) {
          localStorage.setItem(MOD.keys.modKeyGuess, k);
          return k;
        }
      } catch {
        const parts = normalizeMods(raw);
        if (parts.length && parts.some(looksLikeModString)) {
          localStorage.setItem(MOD.keys.modKeyGuess, k);
          return k;
        }
      }
    }

    localStorage.setItem(MOD.keys.modKeyGuess, "enabledMods");
    return "enabledMods";
  }

  function readEnabledMods() {
    if (Array.isArray(window.enabledMods)) return window.enabledMods.slice();
    const k = guessEnabledModsKey();
    const raw = localStorage.getItem(k);
    if (!raw) return [];
    try {
      const v = JSON.parse(raw);
      if (isModsArray(v)) return v.slice();
    } catch {}
    return normalizeMods(raw);
  }

  function writeEnabledMods(list) {
    const clean = Array.from(new Set(list.map(s => String(s || "").trim()).filter(Boolean)));
    if (Array.isArray(window.enabledMods)) window.enabledMods = clean.slice();
    const k = guessEnabledModsKey();
    try { localStorage.setItem(k, JSON.stringify(clean)); }
    catch { localStorage.setItem(k, clean.join(";")); }
    return k;
  }

  // library entry: { id, enabled, addedAt }
  function readModLib() {
    const v = safeParse(localStorage.getItem(MOD.keys.modLib) || "[]", []);
    if (!Array.isArray(v)) return [];
    return v
      .filter(x => x && typeof x.id === "string")
      .map(x => ({ id: x.id.trim(), enabled: !!x.enabled, addedAt: Number(x.addedAt || Date.now()) }))
      .filter(x => x.id);
  }
  function writeModLib(arr) {
    const seen = new Set();
    const out = [];
    for (const it of arr || []) {
      const id = String(it?.id || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, enabled: !!it.enabled, addedAt: Number(it.addedAt || Date.now()) });
    }
    localStorage.setItem(MOD.keys.modLib, JSON.stringify(out));
    return out;
  }
  function syncModLibFromEnabled() {
    const enabled = new Set(readEnabledMods());
    const lib = readModLib();
    const map = new Map(lib.map(x => [x.id, x]));
    for (const id of enabled) {
      const ex = map.get(id);
      if (ex) ex.enabled = true;
      else map.set(id, { id, enabled: true, addedAt: Date.now() });
    }
    // preserve order, append missing enabled
    const out = [];
    const seen = new Set();
    for (const x of lib) {
      const y = map.get(x.id) || x;
      out.push(y);
      seen.add(y.id);
    }
    for (const id of enabled) {
      if (!seen.has(id)) out.push(map.get(id));
    }
    writeModLib(out);
  }
  function applyModLibToEnabled() {
    const lib = readModLib();
    writeEnabledMods(lib.filter(x => x.enabled).map(x => x.id));
  }

  // ---------- CSS (safe: no display:flex overrides on #controls)
  function cssNeo() {
    return `
body.sbx-neo34{
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

body.sbx-neo34.neo-hide-vanilla #categoryControls,
body.sbx-neo34.neo-hide-vanilla #elementControls{ display:none !important; }

/* BIG readable (font + padding only; no layout engine changes) */
body.sbx-neo34 #toolControls,
body.sbx-neo34 #controls{
  font-size: calc(14px * var(--neo-ui-scale));
}
body.sbx-neo34 #toolControls .controlButton,
body.sbx-neo34 #controls .controlButton,
body.sbx-neo34 #controls button{
  font-size: calc(14px * var(--neo-ui-scale)) !important;
  padding: calc(6px * var(--neo-ui-scale)) calc(10px * var(--neo-ui-scale)) !important;
  min-height: calc(34px * var(--neo-ui-scale));
  border-radius: calc(12px * var(--neo-ui-scale)) !important;
}

/* New-style look */
body.sbx-neo34.neo-topstyle #toolControls .controlButton,
body.sbx-neo34.neo-topstyle #controls .controlButton{
  border: 1px solid var(--neo-border2) !important;
  background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04)) !important;
  color: var(--neo-text) !important;
  box-shadow: 0 6px 16px rgba(0,0,0,.25);
}
body.sbx-neo34.neo-topstyle #controls button:not(.controlButton){
  border: 1px solid rgba(255,255,255,.20) !important;
  box-shadow: 0 6px 14px rgba(0,0,0,.20);
}

/* Mods menu: style ONLY (no forced sizes) */
body.sbx-neo34.neo-topstyle #modManager,
body.sbx-neo34.neo-topstyle #modManagerScreen,
body.sbx-neo34.neo-topstyle #modMenu,
body.sbx-neo34.neo-topstyle #modMenuScreen{
  border-radius: 18px !important;
  border: 1px solid var(--neo-border) !important;
  background: var(--neo-panel) !important;
  box-shadow: var(--neo-shadow) !important;
  color: var(--neo-text) !important;
}

/* Our mod search bar injected into vanilla mod menu */
#neo34ModTools{
  display:flex;
  gap: 10px;
  align-items:center;
  padding: 10px 10px;
  margin-bottom: 10px;
  border-radius: 16px;
  background: rgba(0,0,0,.18);
  border: 1px solid rgba(255,255,255,.10);
}
#neo34ModSearch{
  flex: 1;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.05);
  color: rgba(255,255,255,.92);
  outline: none;
}
#neo34ModSearch::placeholder{ color: rgba(255,255,255,.60); }
.neo34MiniBtn{
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
  background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
  color: rgba(255,255,255,.92);
  cursor:pointer;
}

/* Overlay */
#neo34Overlay{
  position: fixed; inset: 0;
  background: rgba(0,0,0,.40);
  z-index: 999980;
  display:none;
  pointer-events:none;
}
#neo34Overlay.open{
  display:block;
  pointer-events:auto;
}

/* Edge tabs */
#neo34EdgeL, #neo34EdgeR{
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
#neo34EdgeL{ left: 8px; }
#neo34EdgeR{ right: 8px; }
#neo34EdgeL .lbl, #neo34EdgeR .lbl{ display:block; font-weight:900; letter-spacing:.6px; font-size:12px; }
#neo34EdgeL .sub, #neo34EdgeR .sub{ display:block; font-size:11px; color: var(--neo-muted); margin-top:2px; }
#neo34EdgeL.hidden, #neo34EdgeR.hidden{ display:none; }

/* Drawers */
.neo34Drawer{
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
#neo34Elements{
  left: 10px;
  width: var(--neo-w-e);
  transform: translateX(-110%);
  transition: transform 160ms ease;
}
#neo34Elements.open{ transform: translateX(0); }

#neo34Overhaul{
  right: 10px;
  width: var(--neo-w-o);
  transform: translateX(110%);
  transition: transform 160ms ease;
}
#neo34Overhaul.open{ transform: translateX(0); }

.neo34Drawer.max{
  left: 10px !important;
  right: 10px !important;
  width: auto !important;
}

/* Header */
.neo34Hdr{
  display:flex; align-items:center; justify-content:space-between;
  gap:8px;
  padding:12px;
  border-bottom: 1px solid var(--neo-border2);
  background: rgba(0,0,0,.10);
  border-top-left-radius: 18px;
  border-top-right-radius: 18px;
}
.neo34Title{ display:flex; flex-direction:column; gap:2px; }
.neo34Title .t{ font-weight:900; letter-spacing:.6px; }
.neo34Title .s{ font-size:12px; color: var(--neo-muted); }
.neo34Btns{ display:flex; gap:8px; }
.neo34Btn{
  border-radius:12px;
  border: 1px solid var(--neo-border2);
  background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
  color: var(--neo-text);
  padding:8px 10px;
  cursor:pointer;
}

/* Tabs + Search */
.neo34Tabs{ display:flex; gap:8px; padding:10px 12px 0 12px; }
.neo34Tab{
  flex:1; text-align:center;
  padding:8px 10px;
  border-radius:999px;
  border:1px solid var(--neo-border2);
  background: rgba(255,255,255,.04);
  cursor:pointer;
}
.neo34Tab.active{ border-color: rgba(76,201,240,.55); background: rgba(76,201,240,.10); }

.neo34SearchRow{ display:flex; gap:8px; padding:10px 12px 12px 12px; border-bottom: 1px solid var(--neo-border2); }
#neo34Search{
  flex:1;
  border-radius:14px;
  border:1px solid var(--neo-border2);
  background: rgba(255,255,255,.05);
  color: var(--neo-text);
  padding:10px 12px;
  outline:none;
}

/* Body layout */
#neo34ElBody{
  flex:1;
  display:grid;
  grid-template-columns: 170px 1fr;
  gap:10px;
  padding:10px 12px 12px 12px;
  overflow:hidden;
  min-height: 220px;
}
body.sbx-neo34.neo-hidecats #neo34ElBody{ grid-template-columns: 1fr; }
body.sbx-neo34.neo-hidecats #neo34Cats{ display:none; }

#neo34Cats{
  border:1px solid var(--neo-border2);
  border-radius:14px;
  background: var(--neo-panel2);
  overflow:auto;
  padding:8px;
}

#neo34ElRight{
  display:flex;
  flex-direction:column;
  gap:10px;
  overflow:hidden;
  min-height: 220px;
}

#neo34ElGridWrap{
  flex: 1;
  border:1px solid var(--neo-border2);
  border-radius:14px;
  background: var(--neo-panel2);
  overflow:hidden;
  display:flex;
  flex-direction:column;
  min-height: 200px;
}
#neo34ElGridHead{
  padding:10px;
  border-bottom:1px solid var(--neo-border2);
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px;
}
#neo34Count{ font-size:12px; color: var(--neo-muted); }

#neo34ElGrid{
  padding:10px;
  overflow:auto;
  display:grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap:10px;
  min-height: 180px;
}
body.sbx-neo34.neo-compact #neo34ElGrid{ grid-template-columns: repeat(auto-fill, minmax(125px, 1fr)); gap:8px; }

.neo34ElBtn{
  display:flex;
  align-items:center;
  gap:10px;
  padding:10px;
  border-radius:14px;
  border:1px solid var(--neo-border2);
  background: linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.03));
  cursor:pointer;
}
.neo34Dot{ width:14px; height:14px; border-radius:999px; box-shadow: inset 0 0 0 2px rgba(0,0,0,.25); }
.neo34Name{ overflow:hidden; text-overflow: ellipsis; white-space: nowrap; }
.neo34Star{ margin-left:auto; opacity:.9; }

#neo34Preview{
  border:1px solid var(--neo-border2);
  border-radius:14px;
  background: rgba(255,255,255,.04);
  padding:10px;
  display:none;
}
#neo34Preview.show{ display:block; }
#neo34Preview .muted{ color: var(--neo-muted); font-size:12px; }

/* Toast */
#neo34Toast{
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
#neo34OverBody{ flex:1; overflow:auto; padding:10px 12px 12px 12px; }
.neo34Section{ margin: 12px 0 8px 0; font-weight:900; letter-spacing:.4px; }
.neo34Toggle{ display:flex; gap:10px; align-items:flex-start; padding:10px; border-radius:14px; cursor:pointer; }
.neo34Toggle:hover{ background: rgba(255,255,255,.05); }
.neo34Small{ font-size:12px; color: var(--neo-muted); margin-top:2px; }

/* Mods library UI inside Overhaul */
#neo34ModsWrap{
  border: 1px solid var(--neo-border2);
  border-radius: 14px;
  background: rgba(0,0,0,.10);
  padding: 10px;
}
#neo34ModsTop{
  display:flex;
  gap:10px;
  flex-wrap: wrap;
  align-items:center;
}
#neo34ModsAdd, #neo34ModsFind{
  flex: 1;
  min-width: 220px;
  border-radius: 14px;
  border: 1px solid var(--neo-border2);
  background: rgba(255,255,255,.05);
  color: var(--neo-text);
  padding: 10px 12px;
  outline: none;
}
.neo34ModsRow{
  display:flex;
  gap:10px;
  align-items:center;
  padding: 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.14);
  margin-top: 10px;
}
.neo34ModsRow b{
  flex:1;
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.neo34Badge{
  font-size: 11px;
  padding: 6px 10px;
  border-radius: 999px;
  border:1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.72);
}
.neo34Badge.ok{ border-color: rgba(80,220,140,.35); background: rgba(80,220,140,.12); color: rgba(210,255,230,.9); }
.neo34Badge.warn{ border-color: rgba(255,200,90,.35); background: rgba(255,200,90,.12); color: rgba(255,240,210,.92); }

/* Info bar (never blocks clicks) */
#neo34Info{
  position: fixed;
  z-index: 999970;
  right: 10px;
  top: 10px;
  pointer-events: none;
  display:none;
}
#neo34Info.on{ display:block; }
#neo34Info .pill{
  max-width: min(560px, 92vw);
  border: 1px solid rgba(255,255,255,.16);
  background: rgba(12,12,14,.62);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 999px;
  padding: 8px 12px;
  display:flex;
  gap: 10px;
  align-items:center;
  flex-wrap: wrap;
  box-shadow: 0 14px 40px rgba(0,0,0,.35);
  color: rgba(255,255,255,.90);
  font-size: 12px;
}
#neo34Info b{ color: rgba(255,255,255,.92); }
#neo34Info span{ color: rgba(255,255,255,.74); }
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
    $("#neo34Overlay")?.classList.toggle("open", any);
  }
  function syncEdgeTabs() {
    const enabled = loadSettings().enable;
    $("#neo34EdgeL")?.classList.toggle("hidden", !enabled || isOpenElements());
    $("#neo34EdgeR")?.classList.toggle("hidden", !enabled || isOpenOverhaul());
  }

  function setOpenElements(open) {
    if (open && window.innerWidth < 900) setOpenOverhaul(false);
    localStorage.setItem(MOD.keys.openElements, open ? "1" : "0");
    $("#neo34Elements")?.classList.toggle("open", open);
    safeUpdateTopOffset();
    updateLayout();
  }
  function setOpenOverhaul(open) {
    if (open && window.innerWidth < 900) setOpenElements(false);
    localStorage.setItem(MOD.keys.openOverhaul, open ? "1" : "0");
    $("#neo34Overhaul")?.classList.toggle("open", open);
    safeUpdateTopOffset();
    updateLayout();
  }
  function setMax(which, on) {
    localStorage.setItem(which === "elements" ? MOD.keys.maxElements : MOD.keys.maxOverhaul, on ? "1" : "0");
    const id = which === "elements" ? "#neo34Elements" : "#neo34Overhaul";
    $(id)?.classList.toggle("max", on);

    // one-max-at-a-time
    if (on) {
      if (which === "elements") {
        localStorage.setItem(MOD.keys.maxOverhaul, "0");
        $("#neo34Overhaul")?.classList.remove("max");
        setOpenOverhaul(false);
        setOpenElements(true);
      } else {
        localStorage.setItem(MOD.keys.maxElements, "0");
        $("#neo34Elements")?.classList.remove("max");
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

  // ---------- SAFE top offset (fixes drawer too short)
  function safeUpdateTopOffset() {
    const controls = $("#controls");
    const tool = $("#toolControls");
    if (!controls && !tool) return;

    let top = 90;
    if (controls) top = Math.max(top, Math.round(controls.getBoundingClientRect().bottom) + 10);
    if (tool) top = Math.max(top, Math.round(tool.getBoundingClientRect().bottom) + 10);

    const maxTop = Math.floor(window.innerHeight * 0.32);
    top = clamp(top, 70, maxTop);

    document.body.style.setProperty("--neo-top", `${top}px`);

    // position info bar under toolbar but above drawers, never blocking clicks
    const info = $("#neo34Info");
    if (info) {
      const infoTop = Math.max(10, top - 44);
      info.style.top = `${infoTop}px`;
    }
  }

  // ---------- Info bar
  function infoGet(...names) {
    for (const n of names) if (n in window) return window[n];
    return undefined;
  }
  function renderInfoBar() {
    const s = loadSettings();
    const info = $("#neo34Info");
    if (!info) return;
    info.classList.toggle("on", !!s.infoBar);

    if (!s.infoBar) return;

    const elName = infoGet("currentElement","element","selectedElement") ?? "-";
    const size = infoGet("mouseSize","cursorSize","brushSize") ?? "-";
    const replace = infoGet("replaceMode","replace","replacing");
    const paused = infoGet("paused","isPaused","pause");
    const tps = infoGet("tps","TPS","tickSpeed");

    const pill = $(".pill", info);
    if (!pill) return;
    pill.innerHTML = `
      <span><b>Elem:</b> ${String(elName)}</span>
      <span><b>Size:</b> ${String(size)}</span>
      <span><b>Replace:</b> ${typeof replace === "boolean" ? (replace ? "On" : "Off") : String(replace ?? "-")}</span>
      <span><b>Paused:</b> ${typeof paused === "boolean" ? (paused ? "Yes" : "No") : String(paused ?? "-")}</span>
      <span><b>TPS:</b> ${String(tps ?? "-")}</span>
    `;
  }

  // ---------- UI build
  function ensureUI() {
    if ($("#neo34Elements")) return;

    document.body.classList.add("sbx-neo34");

    document.body.appendChild(el("div", { id: "neo34Overlay", onclick: () => { setOpenElements(false); setOpenOverhaul(false); } }));
    document.body.appendChild(el("div", { id: "neo34EdgeL", onclick: () => setOpenElements(true), title: "Open Elements (B)" },
      el("span", { class: "lbl" }, "ELEMENTS"), el("span", { class: "sub" }, "Open")));
    document.body.appendChild(el("div", { id: "neo34EdgeR", onclick: () => setOpenOverhaul(true), title: "Open Overhaul (O)" },
      el("span", { class: "lbl" }, "OVERHAUL"), el("span", { class: "sub" }, "Settings")));
    document.body.appendChild(el("div", { id: "neo34Toast" }));

    // info bar (never blocks clicks)
    document.body.appendChild(el("div", { id: "neo34Info" }, el("div", { class: "pill" }, "")));

    const elements = el("div", { id: "neo34Elements", class: "neo34Drawer" },
      el("div", { class: "neo34Hdr" },
        el("div", { class: "neo34Title" },
          el("div", { class: "t" }, "ELEMENTS"),
          el("div", { class: "s" }, "Scroll + click works (fixed)"))
        ,
        el("div", { class: "neo34Btns" },
          el("button", { class: "neo34Btn", onclick: () => { localStorage.setItem(MOD.keys.compact, isCompact() ? "0" : "1"); applyViewFlags(); renderElements(); } }, "▦"),
          el("button", { class: "neo34Btn", onclick: () => { localStorage.setItem(MOD.keys.hideCats, isHideCats() ? "0" : "1"); applyViewFlags(); } }, "☰"),
          el("button", { class: "neo34Btn", onclick: () => setMax("elements", !isMax("elements")) }, "⤢"),
          el("button", { class: "neo34Btn", onclick: () => setOpenOverhaul(true) }, "⚙"),
          el("button", { class: "neo34Btn", onclick: () => setOpenElements(false) }, "×"),
        )
      ),
      el("div", { class: "neo34Tabs" },
        el("div", { class: "neo34Tab", id: "neo34TabAll", onclick: () => setTab("all") }, "All"),
        el("div", { class: "neo34Tab", id: "neo34TabFav", onclick: () => setTab("fav") }, "Favorites"),
        el("div", { class: "neo34Tab", id: "neo34TabRec", onclick: () => setTab("recent") }, "Recents"),
      ),
      el("div", { class: "neo34SearchRow" },
        el("input", { id: "neo34Search", type: "text", placeholder: "Search elements…" }),
        el("button", { class: "neo34Btn", onclick: () => { $("#neo34Search").value = ""; renderElements(); } }, "×"),
      ),
      el("div", { id: "neo34ElBody" },
        el("div", { id: "neo34Cats" }),
        el("div", { id: "neo34ElRight" },
          el("div", { id: "neo34ElGridWrap" },
            el("div", { id: "neo34ElGridHead" },
              el("div", { id: "neo34Count" }, ""),
              el("div", { style: "display:flex; gap:8px; align-items:center;" },
                el("button", { class: "neo34Btn", onclick: () => setOpenElements(false) }, "Hide"),
              )
            ),
            el("div", { id: "neo34ElGrid" })
          ),
          el("div", { id: "neo34Preview" })
        )
      )
    );

    const overhaul = el("div", { id: "neo34Overhaul", class: "neo34Drawer" },
      el("div", { class: "neo34Hdr" },
        el("div", { class: "neo34Title" },
          el("div", { class: "t" }, "OVERHAUL"),
          el("div", { class: "s" }, "Ctrl+0 = panic reset")),
        el("div", { class: "neo34Btns" },
          el("button", { class: "neo34Btn", onclick: () => setMax("overhaul", !isMax("overhaul")) }, "⤢"),
          el("button", { class: "neo34Btn", onclick: () => setOpenElements(true) }, "☰"),
          el("button", { class: "neo34Btn", onclick: () => setOpenOverhaul(false) }, "×"),
        )
      ),
      el("div", { id: "neo34OverBody" })
    );

    document.body.append(elements, overhaul);

    $("#neo34Search").addEventListener("input", () => renderElements());
  }

  function addTopButtons() {
    const tc = $("#toolControls");
    if (!tc) return;

    if (!$("#neo34TopElements")) {
      const b = el("button", { id: "neo34TopElements", class: "controlButton", onclick: () => setOpenElements(!isOpenElements()) }, "☰ Elements");
      tc.prepend(b);
    }
    if (!$("#neo34TopOverhaul")) {
      const b = el("button", { id: "neo34TopOverhaul", class: "controlButton", onclick: () => setOpenOverhaul(!isOpenOverhaul()) }, "⚙ Overhaul");
      tc.appendChild(b);
    }
  }

  // ---------- tabs / cats / render
  function setTab(t) {
    currentTab = t;
    localStorage.setItem(MOD.keys.tab, t);
    $("#neo34TabAll")?.classList.toggle("active", t === "all");
    $("#neo34TabFav")?.classList.toggle("active", t === "fav");
    $("#neo34TabRec")?.classList.toggle("active", t === "recent");
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
    const wrap = $("#neo34Cats");
    if (!wrap) return;
    const { cats } = buildIndex();
    const labelMap = buildCategoryLabelsFromDOM();

    wrap.innerHTML = "";
    for (const c of cats) {
      const label = (c === "all") ? "All" : (labelMap.get(c) || String(c).replace(/_/g, " "));
      const btn = el("button", { class: `neo34ElBtn`, style: `justify-content:flex-start; width:100%;` }, label);
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
    const grid = $("#neo34ElGrid");
    const count = $("#neo34Count");
    if (!grid) return;

    const query = ($("#neo34Search")?.value || "").trim().toLowerCase();
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

      const btn = el("button", { class: "neo34ElBtn" });
      btn.appendChild(el("span", { class: "neo34Dot", style: `background:${elementColor(name)};` }));
      btn.appendChild(el("span", { class: "neo34Name" }, prettyName(name)));
      if (favSet.has(name)) btn.appendChild(el("span", { class: "neo34Star" }, "★"));

      btn.onclick = () => {
        if (typeof window.selectElement === "function") window.selectElement(name);
        const r = getRecents();
        setRecents([name, ...r.filter(x => x !== name)], 24);
        toast(`Selected: ${prettyName(name)}`);
        if (loadSettings().autoCloseOnPick) setOpenElements(false);
      };

      // right click toggles favorite
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

    const prev = $("#neo34Preview");
    if (prev) {
      prev.classList.toggle("show", !!loadSettings().showPreview);
      if (!shown) prev.innerHTML = `<div class="muted">No elements match.</div>`;
    }
  }

  // ---------- Overhaul panel (Settings + Mods Library)
  function buildOverhaulPanel() {
    const body = $("#neo34OverBody");
    if (!body) return;
    body.innerHTML = "";

    const s = loadSettings();

    const section = (t) => el("div", { class: "neo34Section" }, t);
    const toggle = (key, title, desc) => {
      const id = `neo34_${key}`;
      return el("label", { class: "neo34Toggle", for: id },
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
        el("div", {}, el("div", { style: "font-weight:800;" }, title), el("div", { class: "neo34Small" }, desc))
      );
    };

    body.append(
      section("UI Size"),
      el("div", { class: "neo34Toggle", style: "cursor:default;" },
        el("div", { style: "min-width:18px;" }),
        el("div", { style: "width:100%;" },
          el("div", { style: "font-weight:800;" }, `UI scale: ${getUiScale().toFixed(2)}`),
          el("div", { class: "neo34Small" }, "Bigger text/buttons without breaking layout"),
          el("div", { style: "display:flex; gap:10px; align-items:center; margin-top:10px;" },
            el("button", { class: "neo34Btn", onclick: () => setUiScale(getUiScale() - 0.06) }, "–"),
            el("input", {
              type: "range", min: "1.0", max: "1.65", step: "0.02",
              value: String(getUiScale()), style: "flex:1;",
              oninput: (ev) => setUiScale(parseFloat(ev.target.value))
            }),
            el("button", { class: "neo34Btn", onclick: () => setUiScale(getUiScale() + 0.06) }, "+"),
          )
        )
      ),

      section("UI"),
      toggle("restyleTopUI", "New style top bar", "Same vibe as the new UI"),
      toggle("hideVanillaElementUI", "Hide vanilla element rows", "Use the drawer instead"),
      toggle("openElementsOnStart", "Open elements on start", "Opens the drawer after refresh"),
      toggle("autoCloseOnPick", "Auto-close on pick", "Closes drawer after selecting"),
      toggle("infoBar", "Info bar", "Small status pill that never blocks clicks"),

      section("Panic"),
      el("button", { class: "neo34Btn", onclick: () => panicReset() }, "Reset UI layout (panic)")
    );

    // Mods Library section (disable without deleting)
    if (s.modsInOverhaul) {
      syncModLibFromEnabled();

      body.append(section("Mods Library (disable without deleting)"));

      const wrap = el("div", { id: "neo34ModsWrap" },
        el("div", { class: "neo34Small", style: "margin-bottom:10px;" },
          "Toggle enabled mods here. Reload applies changes (unload needs refresh)."
        ),
        el("div", { id: "neo34ModsTop" },
          el("input", { id: "neo34ModsAdd", placeholder: "Add mods… (use ; for multiple)", type: "text" }),
          el("button", { class: "neo34Btn", onclick: () => modsAdd(false) }, "Add"),
          el("button", { class: "neo34Btn", onclick: () => modsAdd(true) }, "Add+Reload"),
          el("button", { class: "neo34Btn", onclick: () => location.reload() }, "Reload"),
        ),
        el("div", { style: "display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;" },
          el("input", { id: "neo34ModsFind", placeholder: "Search saved mods…", type: "text" }),
          el("button", { class: "neo34Btn", onclick: () => modsEnableAll(true) }, "Enable all"),
          el("button", { class: "neo34Btn", onclick: () => modsEnableAll(false) }, "Disable all"),
          el("button", { class: "neo34Btn", onclick: () => modsRemoveDisabled() }, "Remove disabled"),
          el("button", { class: "neo34Btn", onclick: () => copyText(JSON.stringify(readModLib())) }, "Export"),
          el("button", { class: "neo34Btn", onclick: () => modsImport() }, "Import"),
        ),
        el("div", { id: "neo34ModsList" })
      );

      body.append(wrap);

      $("#neo34ModsFind").addEventListener("input", () => renderModsLibList());
      renderModsLibList();
    }
  }

  function modsAdd(reload) {
    const input = $("#neo34ModsAdd");
    if (!input) return;
    const incoming = normalizeMods(input.value).filter(looksLikeModString);
    if (!incoming.length) return toast("No mods to add");

    const lib = readModLib();
    const map = new Map(lib.map(x => [x.id, x]));
    for (const id of incoming) {
      const ex = map.get(id);
      if (ex) ex.enabled = true;
      else map.set(id, { id, enabled: true, addedAt: Date.now() });
    }
    // preserve order then append new
    const out = [];
    const seen = new Set();
    for (const x of lib) { out.push(map.get(x.id) || x); seen.add(x.id); }
    for (const id of incoming) if (!seen.has(id)) out.push(map.get(id));

    writeModLib(out);
    applyModLibToEnabled();
    toast(reload ? "Added (reloading…)" : "Added (reload to apply)");
    input.value = incoming.join("; ");
    renderModsLibList();
    if (reload) location.reload();
  }

  function modsEnableAll(on) {
    const lib = readModLib().map(x => ({ ...x, enabled: !!on }));
    writeModLib(lib);
    applyModLibToEnabled();
    toast(on ? "Enabled all (reload to apply)" : "Disabled all (reload to apply)");
    renderModsLibList();
  }

  function modsRemoveDisabled() {
    const lib = readModLib().filter(x => x.enabled);
    writeModLib(lib);
    applyModLibToEnabled();
    toast("Removed disabled (reload to apply)");
    renderModsLibList();
  }

  async function modsImport() {
    try {
      const txt = navigator.clipboard?.readText ? await navigator.clipboard.readText() : "";
      const v = safeParse(txt, null);
      if (!Array.isArray(v)) return toast("Clipboard is not mod JSON");
      const lib = v
        .filter(x => x && typeof x.id === "string")
        .map(x => ({ id: x.id.trim(), enabled: !!x.enabled, addedAt: Number(x.addedAt || Date.now()) }))
        .filter(x => x.id && looksLikeModString(x.id));
      writeModLib(lib);
      applyModLibToEnabled();
      toast("Imported (reload to apply)");
      renderModsLibList();
    } catch {
      toast("Clipboard blocked");
    }
  }

  function renderModsLibList() {
    const list = $("#neo34ModsList");
    if (!list) return;

    const q = ($("#neo34ModsFind")?.value || "").trim().toLowerCase();
    const enabledSet = new Set(readEnabledMods());
    let lib = readModLib();

    if (q) lib = lib.filter(x => x.id.toLowerCase().includes(q));

    // sort: enabled first then name
    lib.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.id.localeCompare(b.id));

    list.innerHTML = "";
    const total = readModLib().length;
    const enabled = readModLib().filter(x => x.enabled).length;

    list.appendChild(
      el("div", { class: "neo34Small", style: "margin-top:10px;" },
        `Saved: ${total} • Enabled: ${enabled} • Key: ${guessEnabledModsKey()}`
      )
    );

    for (const m of lib) {
      const row = el("div", { class: "neo34ModsRow" });

      const cb = el("input", {
        type: "checkbox",
        checked: m.enabled ? "checked" : null,
        onchange: (ev) => {
          const lib2 = readModLib().map(x => x.id === m.id ? { ...x, enabled: !!ev.target.checked } : x);
          writeModLib(lib2);
          applyModLibToEnabled();
          toast("Changed (reload to apply)");
          renderModsLibList();
        }
      });

      const badge = enabledSet.has(m.id)
        ? el("span", { class: "neo34Badge ok" }, "Enabled")
        : el("span", { class: "neo34Badge warn" }, "Reload");

      row.append(
        cb,
        el("b", {}, m.id),
        badge,
        el("button", { class: "neo34Btn", onclick: () => copyText(m.id) }, "Copy"),
        el("button", {
          class: "neo34Btn",
          onclick: () => {
            const lib2 = readModLib().filter(x => x.id !== m.id);
            writeModLib(lib2);
            applyModLibToEnabled();
            toast("Removed (reload to apply)");
            renderModsLibList();
          }
        }, "Remove")
      );

      list.appendChild(row);
    }
  }

  function focusModsSection() {
    setOpenOverhaul(true);
    // wait a tick for open animation then scroll
    setTimeout(() => {
      const wrap = $("#neo34ModsWrap");
      if (wrap) wrap.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
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
    renderInfoBar();
  }

  // ---------- Mods UI (safe injection into vanilla mod menu)
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
    if ($("#neo34ModTools", root)) return;

    const bar = el("div", { id: "neo34ModTools" },
      el("input", { id: "neo34ModSearch", type: "text", placeholder: "Search mods…" }),
      el("button", { class: "neo34MiniBtn", onclick: () => focusModsSection() }, "Open Neo Mods"),
      el("button", { class: "neo34MiniBtn", onclick: () => setUiScale(getUiScale() + 0.06) }, "UI +"),
      el("button", { class: "neo34MiniBtn", onclick: () => setUiScale(getUiScale() - 0.06) }, "UI −"),
      el("button", {
        class: "neo34MiniBtn",
        onclick: () => { const i = $("#neo34ModSearch", root); i.value = ""; i.dispatchEvent(new Event("input")); }
      }, "Clear"),
    );

    root.prepend(bar);

    const input = $("#neo34ModSearch", root);
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

  // ---------- PANIC RESET
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
    $("#neo34Elements")?.classList.add("open");
    $("#neo34Overhaul")?.classList.remove("open");
    $("#neo34Elements")?.classList.remove("max");
    $("#neo34Overhaul")?.classList.remove("max");

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
        $("#neo34Search")?.focus();
        $("#neo34Search")?.select();
      }

      // Quick jump to mods section
      if (!typing && ev.key.toLowerCase() === "m") {
        ev.preventDefault();
        focusModsSection();
        $("#neo34ModsFind")?.focus();
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

    try { await waitFor(() => $("#controls") && $("#toolControls")); } catch {}
    try { await waitFor(() => window.elements && Object.keys(window.elements).length > 20); } catch {}

    // defaults
    if (localStorage.getItem(MOD.keys.uiScale) == null) localStorage.setItem(MOD.keys.uiScale, String(loadSettings().uiScale));
    if (localStorage.getItem(MOD.keys.openElements) == null) localStorage.setItem(MOD.keys.openElements, loadSettings().openElementsOnStart ? "1" : "0");
    if (localStorage.getItem(MOD.keys.openOverhaul) == null) localStorage.setItem(MOD.keys.openOverhaul, "0");
    if (localStorage.getItem(MOD.keys.widthElements) == null) localStorage.setItem(MOD.keys.widthElements, "520");
    if (localStorage.getItem(MOD.keys.widthOverhaul) == null) localStorage.setItem(MOD.keys.widthOverhaul, "520");
    if (localStorage.getItem(MOD.keys.maxElements) == null) localStorage.setItem(MOD.keys.maxElements, "0");
    if (localStorage.getItem(MOD.keys.maxOverhaul) == null) localStorage.setItem(MOD.keys.maxOverhaul, "0");
    if (localStorage.getItem(MOD.keys.compact) == null) localStorage.setItem(MOD.keys.compact, loadSettings().compactView ? "1" : "0");
    if (localStorage.getItem(MOD.keys.hideCats) == null) localStorage.setItem(MOD.keys.hideCats, loadSettings().hideCategories ? "1" : "0");

    injectCss("neo34Style", cssNeo());

    document.body.classList.add("sbx-neo34");
    document.body.style.setProperty("--neo-ui-scale", String(getUiScale()));

    ensureUI();
    addTopButtons();

    // sync mod lib once
    syncModLibFromEnabled();

    // apply settings
    document.body.classList.toggle("neo-topstyle", !!loadSettings().restyleTopUI);
    document.body.classList.toggle("neo-hide-vanilla", !!loadSettings().hideVanillaElementUI);
    applyViewFlags();

    // open state
    $("#neo34Elements")?.classList.toggle("open", isOpenElements());
    $("#neo34Overhaul")?.classList.toggle("open", isOpenOverhaul());
    $("#neo34Elements")?.classList.toggle("max", isMax("elements"));
    $("#neo34Overhaul")?.classList.toggle("max", isMax("overhaul"));

    buildOverhaulPanel();
    safeUpdateTopOffset();
    updateLayout();

    renderCats();
    setTab(currentTab);
    renderElements();

    // keep stable even when UI changes
    window.addEventListener("resize", () => { safeUpdateTopOffset(); updateLayout(); });
    setInterval(() => { safeUpdateTopOffset(); updateLayout(); renderInfoBar(); }, 900);

    installHotkeys();
    watchMods();
    enhanceModsUI();
    renderInfoBar();

    toast(`${MOD.name} v${MOD.version} loaded`);
  });

})();
