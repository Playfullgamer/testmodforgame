// sbx_neo_full_ui_overhaul.js
// Neo Fullscreen UI Overhaul: modernized top controls + clear open buttons + full-height drawers
(() => {
  "use strict";

  const MOD = {
    name: "Neo Full UI Overhaul",
    version: "3.0.0",
    keys: {
      settings: "sbx_neo3/settings",
      favs: "sbx_neo3/favs",
      recents: "sbx_neo3/recents",
      openElements: "sbx_neo3/open_elements",
      openOverhaul: "sbx_neo3/open_overhaul",
      widthElements: "sbx_neo3/w_elements",
      widthOverhaul: "sbx_neo3/w_overhaul",
      maxElements: "sbx_neo3/max_elements",
      maxOverhaul: "sbx_neo3/max_overhaul",
      tab: "sbx_neo3/tab",
      cat: "sbx_neo3/cat",
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

      // QoL
      hotkeys: true, // B toggle elements, O toggle overhaul, / search, Ctrl+K search, Q swap last
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

  // ---------- cleanup old stacks (prevents double UI)
  function cleanupOld() {
    [
      "psoStyle","psoSidebar","psoOverlay","psoHamburger","psoSettings","psoTip","psoToast","psoInspect",
      "sbxOHStyle","sbxOHBar","sbxOHPanel","sbxOHTooltip","sbxOHToast",
      "neo3Style","neo3Overlay","neo3Elements","neo3Overhaul","neo3EdgeL","neo3EdgeR","neo3Toast","neo3Tip"
    ].forEach(id => $(`#${id}`)?.remove());
    document.body.classList.remove("sbx-pso","sbx-ohp","sbx-neo","sbx-neo3");
  }

  // ---------- UI style
  function cssNeo() {
    const wE = clamp(parseInt(localStorage.getItem(MOD.keys.widthElements) || "520", 10) || 520, 320, 860);
    const wO = clamp(parseInt(localStorage.getItem(MOD.keys.widthOverhaul) || "520", 10) || 520, 320, 860);
    return `
body.sbx-neo3{
  --neo-top: 78px;
  --neo-w-e: ${wE}px;
  --neo-w-o: ${wO}px;

  --neo-bg: rgba(12,14,18,.92);
  --neo-panel: rgba(18,21,28,.92);
  --neo-panel2: rgba(14,16,22,.92);

  --neo-border: rgba(255,255,255,.12);
  --neo-border2: rgba(255,255,255,.08);

  --neo-text: rgba(255,255,255,.92);
  --neo-muted: rgba(255,255,255,.62);

  --neo-accent: rgba(76,201,240,.90);
  --neo-accent2: rgba(167,139,250,.85);

  --neo-radius: 16px;
  --neo-shadow: 0 16px 48px rgba(0,0,0,.55);
  --neo-shadow2: 0 10px 30px rgba(0,0,0,.45);
}

body.sbx-neo3.neo-hide-vanilla #categoryControls,
body.sbx-neo3.neo-hide-vanilla #elementControls{
  display:none !important;
}

/* ===== Top UI restyle (the “new GUI thingies”) ===== */
body.sbx-neo3.neo-topstyle #toolControls .controlButton,
body.sbx-neo3.neo-topstyle #controls .controlButton{
  border-radius: 14px !important;
  border: 1px solid var(--neo-border2) !important;
  background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04)) !important;
  color: var(--neo-text) !important;
  box-shadow: 0 6px 16px rgba(0,0,0,.25);
  transition: transform .06s ease, filter .12s ease;
}
body.sbx-neo3.neo-topstyle #toolControls .controlButton:hover,
body.sbx-neo3.neo-topstyle #controls .controlButton:hover{ filter: brightness(1.08); }
body.sbx-neo3.neo-topstyle #toolControls .controlButton:active,
body.sbx-neo3.neo-topstyle #controls .controlButton:active{ transform: translateY(1px); }

/* Many “mode/tool” chips are just buttons; gently modernize them */
body.sbx-neo3.neo-topstyle #controls button{
  border-radius: 12px;
}
body.sbx-neo3.neo-topstyle .menuScreen,
body.sbx-neo3.neo-topstyle #modManager,
body.sbx-neo3.neo-topstyle #infoScreen,
body.sbx-neo3.neo-topstyle #settingsMenu{
  border-radius: 18px !important;
  border: 1px solid var(--neo-border) !important;
  background: var(--neo-panel) !important;
  box-shadow: var(--neo-shadow) !important;
  color: var(--neo-text) !important;
}

/* ===== Overlay ===== */
#neo3Overlay{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.40);
  z-index: 999980;
  display:none;
}
#neo3Overlay.open{ display:block; }

/* ===== Edge tabs (always visible, super clear open) ===== */
#neo3EdgeL, #neo3EdgeR{
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
#neo3EdgeL{ left: 8px; }
#neo3EdgeR{ right: 8px; }
#neo3EdgeL .lbl, #neo3EdgeR .lbl{
  display:block;
  font-weight: 800;
  letter-spacing: .6px;
  font-size: 12px;
}
#neo3EdgeL .sub, #neo3EdgeR .sub{
  display:block;
  font-size: 11px;
  color: var(--neo-muted);
  margin-top: 2px;
}
#neo3EdgeL.hidden, #neo3EdgeR.hidden{ display:none; }

/* ===== Drawers ===== */
.neo3Drawer{
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

  transform: translateX(-110%);
  transition: transform 160ms ease;
}
.neo3Drawer.open{ transform: translateX(0); }

#neo3Elements{
  left: 10px;
  width: var(--neo-w-e);
}
#neo3Overhaul{
  right: 10px;
  width: var(--neo-w-o);
  transform: translateX(110%);
}
#neo3Overhaul.open{ transform: translateX(0); }

.neo3Drawer.max{
  left: 10px !important;
  right: 10px !important;
  width: auto !important;
}
.neo3Drawer.max #neo3ElGrid{ grid-template-columns: repeat(4, 1fr); }
@media (max-width: 900px){
  #neo3Elements{ width: min(var(--neo-w-e), calc(100vw - 20px)); }
  #neo3Overhaul{ width: min(var(--neo-w-o), calc(100vw - 20px)); }
  .neo3Drawer.max #neo3ElGrid{ grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 600px){
  .neo3Drawer.max #neo3ElGrid{ grid-template-columns: repeat(2, 1fr); }
}

/* Drawer header */
.neo3Hdr{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 12px 10px 12px;
  border-bottom: 1px solid var(--neo-border2);
  background: rgba(0,0,0,.10);
  border-top-left-radius: 18px;
  border-top-right-radius: 18px;
}
.neo3Title{
  display:flex;
  flex-direction: column;
  gap: 2px;
}
.neo3Title .t{ font-weight: 900; letter-spacing: .6px; }
.neo3Title .s{ font-size: 12px; color: var(--neo-muted); }

.neo3Btns{ display:flex; gap: 8px; }
.neo3Btn{
  border-radius: 12px;
  border: 1px solid var(--neo-border2);
  background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
  color: var(--neo-text);
  padding: 8px 10px;
  cursor: pointer;
}
.neo3Btn:hover{ filter: brightness(1.08); }
.neo3Btn:active{ transform: translateY(1px); }

/* Tabs row */
.neo3Tabs{
  display:flex;
  gap: 8px;
  padding: 10px 12px 0 12px;
}
.neo3Tab{
  flex: 1;
  text-align:center;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid var(--neo-border2);
  background: rgba(255,255,255,.04);
  cursor:pointer;
  color: var(--neo-text);
  user-select:none;
}
.neo3Tab.active{
  border-color: rgba(76,201,240,.55);
  background: rgba(76,201,240,.10);
}

/* Search */
.neo3SearchRow{
  display:flex;
  gap: 8px;
  padding: 10px 12px 12px 12px;
  border-bottom: 1px solid var(--neo-border2);
}
#neo3Search{
  flex:1;
  border-radius: 14px;
  border: 1px solid var(--neo-border2);
  background: rgba(255,255,255,.05);
  color: var(--neo-text);
  padding: 10px 12px;
  outline:none;
}
#neo3Search::placeholder{ color: var(--neo-muted); }

/* Content split */
#neo3ElBody{
  flex:1;
  display:grid;
  grid-template-columns: 140px 1fr;
  gap: 10px;
  padding: 10px 12px 12px 12px;
  overflow:hidden;
}

/* Categories (left) */
#neo3Cats{
  border: 1px solid var(--neo-border2);
  border-radius: 14px;
  background: var(--neo-panel2);
  overflow:auto;
  padding: 8px;
}
#neo3Cats::-webkit-scrollbar{ width: 10px; }
#neo3Cats::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.14); border-radius: 999px; }

.neo3Cat{
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
.neo3Cat:hover{ background: rgba(255,255,255,.05); }
.neo3Cat.active{
  border-color: rgba(167,139,250,.45);
  background: rgba(167,139,250,.10);
}

/* Elements grid (right) */
#neo3ElRight{
  display:flex;
  flex-direction: column;
  gap: 10px;
  overflow:hidden;
}
#neo3ElGridWrap{
  flex: 1;
  border: 1px solid var(--neo-border2);
  border-radius: 14px;
  background: var(--neo-panel2);
  overflow:hidden;
  display:flex;
  flex-direction: column;
}
#neo3ElGridHead{
  padding: 10px 10px 8px 10px;
  border-bottom: 1px solid var(--neo-border2);
  display:flex;
  justify-content: space-between;
  align-items:center;
  gap: 10px;
}
#neo3Count{ font-size: 12px; color: var(--neo-muted); }

#neo3ElGrid{
  padding: 10px;
  overflow:auto;
  display:grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
#neo3ElGrid::-webkit-scrollbar{ width: 10px; }
#neo3ElGrid::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.14); border-radius: 999px; }

.neo3ElBtn{
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
.neo3ElBtn:hover{ filter: brightness(1.10); }
.neo3ElBtn:active{ transform: translateY(1px); }
.neo3Dot{
  width: 14px;
  height: 14px;
  border-radius: 999px;
  box-shadow: inset 0 0 0 2px rgba(0,0,0,.25);
}
.neo3Name{
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.neo3Star{
  position:absolute;
  right: 10px;
  top: 8px;
  font-size: 12px;
  opacity: .9;
}

/* Preview */
#neo3Preview{
  border: 1px solid var(--neo-border2);
  border-radius: 14px;
  background: rgba(255,255,255,.04);
  padding: 10px 10px;
  display:none;
}
#neo3Preview.show{ display:block; }
#neo3Preview .muted{ color: var(--neo-muted); font-size: 12px; }

/* Resize handles */
.neo3Resize{
  position:absolute;
  top: 10px;
  bottom: 10px;
  width: 10px;
  cursor: ew-resize;
  opacity: .6;
}
#neo3ResE{ right: -4px; }
#neo3ResO{ left: -4px; }

/* Tooltip + toast */
#neo3Tip{
  position: fixed;
  z-index: 999999;
  display:none;
  max-width: 360px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(12,14,18,.94);
  border: 1px solid var(--neo-border);
  color: var(--neo-text);
  box-shadow: var(--neo-shadow2);
  pointer-events:none;
  font-size: 12px;
}
#neo3Tip .muted{ color: var(--neo-muted); }

#neo3Toast{
  position: fixed;
  left: 12px;
  bottom: 12px;
  z-index: 999999;
  display:none;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(12,14,18,.94);
  border: 1px solid var(--neo-border);
  color: var(--neo-text);
  box-shadow: var(--neo-shadow2);
  font-size: 12px;
}

/* Overhaul panel content scroll */
#neo3OverBody{
  flex:1;
  overflow:auto;
  padding: 10px 12px 12px 12px;
}
#neo3OverBody::-webkit-scrollbar{ width: 10px; }
#neo3OverBody::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.14); border-radius: 999px; }

.neo3Section{
  margin: 10px 0 8px 0;
  font-weight: 900;
  letter-spacing: .4px;
}
.neo3Toggle{
  display:flex;
  gap: 10px;
  align-items:flex-start;
  padding: 10px 10px;
  border-radius: 14px;
  cursor:pointer;
  border: 1px solid transparent;
}
.neo3Toggle:hover{ background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.06); }
.neo3Small{ font-size: 12px; color: var(--neo-muted); margin-top: 2px; }
`;
  }

  // ---------- state
  let currentTab = localStorage.getItem(MOD.keys.tab) || "all"; // all|fav|recent
  let currentCat = localStorage.getItem(MOD.keys.cat) || "all";
  let lastSelected = null;
  let currentSelected = null;
  let hovered = null;

  const getFavs = () => loadList(MOD.keys.favs);
  const setFavs = (a) => saveList(MOD.keys.favs, a, 40);
  const getRecents = () => loadList(MOD.keys.recents);
  const setRecents = (a) => saveList(MOD.keys.recents, a, 24);

  function toast(msg) {
    if (!loadSettings().toasts) return;
    const t = $("#neo3Toast");
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

  function setOpenElements(open) {
    localStorage.setItem(MOD.keys.openElements, open ? "1" : "0");
    $("#neo3Elements")?.classList.toggle("open", open);
    syncOverlay();
    syncEdgeTabs();
  }
  function setOpenOverhaul(open) {
    localStorage.setItem(MOD.keys.openOverhaul, open ? "1" : "0");
    $("#neo3Overhaul")?.classList.toggle("open", open);
    syncOverlay();
    syncEdgeTabs();
  }

  function syncOverlay() {
    const any = isOpenElements() || isOpenOverhaul();
    $("#neo3Overlay")?.classList.toggle("open", any);
  }
  function syncEdgeTabs() {
    // edge tabs show when their panel is closed
    $("#neo3EdgeL")?.classList.toggle("hidden", isOpenElements() || !loadSettings().enable);
    $("#neo3EdgeR")?.classList.toggle("hidden", isOpenOverhaul() || !loadSettings().enable);
  }

  function setMax(which, on) {
    const key = which === "elements" ? MOD.keys.maxElements : MOD.keys.maxOverhaul;
    localStorage.setItem(key, on ? "1" : "0");
    const id = which === "elements" ? "#neo3Elements" : "#neo3Overhaul";
    $(id)?.classList.toggle("max", on);
  }
  function isMax(which) {
    const key = which === "elements" ? MOD.keys.maxElements : MOD.keys.maxOverhaul;
    return localStorage.getItem(key) === "1";
  }

  // ---------- top offset (start drawers below ALL top UI rows)
  function updateTopOffset() {
    const controls = $("#controls");
    if (!controls) return;

    let top = 72;
    const cat = $("#categoryControls");

    // take all children before categoryControls, compute max bottom
    const kids = Array.from(controls.children || []);
    const cut = cat ? kids.indexOf(cat) : -1;
    const scan = cut > 0 ? kids.slice(0, cut) : kids;

    for (const k of scan) {
      if (!(k instanceof HTMLElement)) continue;
      const st = getComputedStyle(k);
      if (st.display === "none" || st.visibility === "hidden") continue;
      const r = k.getBoundingClientRect();
      if (r.height > 0) top = Math.max(top, Math.round(r.bottom) + 8);
    }

    // fallback: toolControls
    const tc = $("#toolControls");
    if (tc) top = Math.max(top, Math.round(tc.getBoundingClientRect().bottom) + 8);

    document.body.style.setProperty("--neo-top", `${top}px`);
  }

  // ---------- build UI
  function ensureUI() {
    if ($("#neo3Elements")) return;

    document.body.classList.add("sbx-neo3");

    // overlay
    document.body.appendChild(el("div", { id: "neo3Overlay", onclick: () => { setOpenElements(false); setOpenOverhaul(false); } }));

    // edge tabs (super clear)
    document.body.appendChild(el("div", {
      id: "neo3EdgeL",
      onclick: () => setOpenElements(true),
      title: "Open Elements (B)"
    }, el("span", { class: "lbl" }, "ELEMENTS"), el("span", { class: "sub" }, "Open")));

    document.body.appendChild(el("div", {
      id: "neo3EdgeR",
      onclick: () => setOpenOverhaul(true),
      title: "Open Overhaul (O)"
    }, el("span", { class: "lbl" }, "OVERHAUL"), el("span", { class: "sub" }, "Settings")));

    // toast + tooltip
    document.body.appendChild(el("div", { id: "neo3Toast" }));
    document.body.appendChild(el("div", { id: "neo3Tip" }));

    // Elements drawer
    const elDrawer = el("div", { id: "neo3Elements", class: "neo3Drawer" },
      el("div", { class: "neo3Hdr" },
        el("div", { class: "neo3Title" },
          el("div", { class: "t" }, "ELEMENTS"),
          el("div", { class: "s", id: "neo3ElSub" }, "Search • Categories • Grid")
        ),
        el("div", { class: "neo3Btns" },
          el("button", { class: "neo3Btn", title: "Maximize", onclick: () => setMax("elements", !isMax("elements")) }, "⤢"),
          el("button", { class: "neo3Btn", title: "Overhaul", onclick: () => setOpenOverhaul(true) }, "⚙"),
          el("button", { class: "neo3Btn", title: "Close", onclick: () => setOpenElements(false) }, "×"),
        )
      ),
      el("div", { class: "neo3Tabs" },
        el("div", { class: "neo3Tab", id: "neo3TabAll", onclick: () => setTab("all") }, "All"),
        el("div", { class: "neo3Tab", id: "neo3TabFav", onclick: () => setTab("fav") }, "Favorites"),
        el("div", { class: "neo3Tab", id: "neo3TabRec", onclick: () => setTab("recent") }, "Recents")
      ),
      el("div", { class: "neo3SearchRow" },
        el("input", { id: "neo3Search", type: "text", placeholder: "Search elements…   (/ or Ctrl+K)" }),
        el("button", { class: "neo3Btn", title: "Clear search (Esc)", onclick: () => { $("#neo3Search").value = ""; renderElements(); $("#neo3Search").focus(); } }, "×")
      ),
      el("div", { id: "neo3ElBody" },
        el("div", { id: "neo3Cats" }),
        el("div", { id: "neo3ElRight" },
          el("div", { id: "neo3ElGridWrap" },
            el("div", { id: "neo3ElGridHead" },
              el("div", { id: "neo3Count" }, ""),
              el("div", { style: "display:flex; gap:8px; align-items:center;" },
                el("button", { class: "neo3Btn", title: "Toggle auto-close on pick", onclick: () => { const s = loadSettings(); s.autoCloseOnPick = !s.autoCloseOnPick; saveSettings(s); toast(`Auto-close: ${s.autoCloseOnPick ? "ON" : "OFF"}`); } }, "📌"),
                el("button", { class: "neo3Btn", title: "Close drawer (B)", onclick: () => setOpenElements(false) }, "Hide"),
              )
            ),
            el("div", { id: "neo3ElGrid" }),
          ),
          el("div", { id: "neo3Preview" })
        )
      ),
      el("div", { id: "neo3ResE", class: "neo3Resize", title: "Drag to resize" })
    );

    // Overhaul drawer
    const overDrawer = el("div", { id: "neo3Overhaul", class: "neo3Drawer" },
      el("div", { class: "neo3Hdr" },
        el("div", { class: "neo3Title" },
          el("div", { class: "t" }, "OVERHAUL"),
          el("div", { class: "s" }, "Full-height • Scrollable • Toggles")
        ),
        el("div", { class: "neo3Btns" },
          el("button", { class: "neo3Btn", title: "Maximize", onclick: () => setMax("overhaul", !isMax("overhaul")) }, "⤢"),
          el("button", { class: "neo3Btn", title: "Elements", onclick: () => setOpenElements(true) }, "☰"),
          el("button", { class: "neo3Btn", title: "Close", onclick: () => setOpenOverhaul(false) }, "×"),
        )
      ),
      el("div", { id: "neo3OverBody" }),
      el("div", { id: "neo3ResO", class: "neo3Resize", title: "Drag to resize" })
    );

    document.body.append(elDrawer, overDrawer);

    $("#neo3Search").addEventListener("input", () => renderElements());
  }

  function addTopButtons() {
    const tc = $("#toolControls");
    if (!tc) return;

    // clear + obvious
    if (!$("#neo3TopElements")) {
      const b = el("button", {
        id: "neo3TopElements",
        class: "controlButton",
        title: "Open Elements (B)",
        onclick: () => setOpenElements(!isOpenElements())
      }, "☰ Elements");
      tc.prepend(b);
    }

    if (!$("#neo3TopOverhaul")) {
      const b = el("button", {
        id: "neo3TopOverhaul",
        class: "controlButton",
        title: "Open Overhaul (O)",
        onclick: () => setOpenOverhaul(!isOpenOverhaul())
      }, "⚙ Overhaul");
      tc.appendChild(b);
    }
  }

  // ---------- settings panel content
  function buildOverhaulPanel() {
    const body = $("#neo3OverBody");
    if (!body) return;
    body.innerHTML = "";

    const s = loadSettings();

    function toggleRow(key, title, desc) {
      const id = `neo3_${key}`;
      const row = el("label", { class: "neo3Toggle", for: id },
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
          el("div", { class: "neo3Small" }, desc)
        )
      );
      return row;
    }

    function section(title) {
      return el("div", { class: "neo3Section" }, title);
    }

    body.append(
      section("UI"),
      toggleRow("restyleTopUI", "New-looking top GUI", "Modern pills + menus (matches the new vibe)"),
      toggleRow("hideVanillaElementUI", "Hide vanilla element/category rows", "Use the big drawers instead"),
      toggleRow("openElementsOnStart", "Open Elements on start", "Opens drawer automatically on refresh"),
      toggleRow("showPreview", "Show element preview", "Extra info panel in Elements drawer"),
      toggleRow("showTooltips", "Tooltips", "Hover element buttons for quick stats"),
      toggleRow("autoCloseOnPick", "Auto-close after selecting element", "If you want more screen for the sim"),

      section("Quality of life"),
      toggleRow("hotkeys", "Hotkeys", "B elements, O overhaul, / search, Ctrl+K search, Q swap last"),
      toggleRow("toasts", "Toasts", "Small notifications"),

      section("Tweaks / performance"),
      toggleRow("smartHumans", "Smart humans", "Humans try to step away from danger"),
      toggleRow("trappedSkipFluids", "Skip trapped fluids", "Helps lag with enclosed big fluid blobs"),
      toggleRow("lazyGases", "Lazy gases", "Helps lag with enclosed big gas blobs"),

      el("div", { style: "height:1px; background: rgba(255,255,255,.08); margin: 12px 0;" }),

      el("div", { style: "display:flex; gap:10px; flex-wrap:wrap;" },
        el("button", { class: "neo3Btn", onclick: () => { setFavs([]); toast("Favorites cleared"); renderElements(); } }, "Clear favs"),
        el("button", { class: "neo3Btn", onclick: () => { setRecents([]); toast("Recents cleared"); renderElements(); } }, "Clear recents"),
        el("button", { class: "neo3Btn", onclick: () => { saveSettings({ ...MOD.defaults }); toast("Reset + reload"); location.reload(); } }, "Reset + reload")
      ),

      el("div", { class: "neo3Small", style: "margin-top: 10px;" },
        "Tip: drag the drawer edge to resize • click ⤢ to maximize • use the left/right edge tabs to open."
      )
    );
  }

  function liveApply() {
    const s = loadSettings();

    document.body.classList.toggle("neo-topstyle", !!s.restyleTopUI);
    document.body.classList.toggle("neo-hide-vanilla", !!(s.enable && s.hideVanillaElementUI));

    buildOverhaulPanel();
    renderCats();
    renderElements();
    syncEdgeTabs();

    // preview toggle
    $("#neo3Preview")?.classList.toggle("show", !!(s.showPreview));
  }

  // ---------- favorites/recents/selection
  function toggleFavorite(name) {
    if (!name) return;
    const favs = getFavs();
    const i = favs.indexOf(name);
    if (i >= 0) favs.splice(i, 1);
    else favs.unshift(name);
    setFavs(favs);
    toast((i >= 0) ? `Unfavorited: ${prettyName(name)}` : `Favorited: ${prettyName(name)}`);
    renderElements();
  }

  function pushRecent(name) {
    if (!name) return;
    const r = getRecents();
    const next = [name, ...r.filter(x => x !== name)];
    setRecents(next);
  }

  function hookSelectElement() {
    if (typeof window.selectElement !== "function") return;
    if (window.selectElement.__neo3Wrapped) return;

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
    wrapped.__neo3Wrapped = true;
    window.selectElement = wrapped;
  }

  // ---------- tabs + categories
  function setTab(t) {
    currentTab = t;
    localStorage.setItem(MOD.keys.tab, t);
    $("#neo3TabAll")?.classList.toggle("active", t === "all");
    $("#neo3TabFav")?.classList.toggle("active", t === "fav");
    $("#neo3TabRec")?.classList.toggle("active", t === "recent");
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
    const wrap = $("#neo3Cats");
    if (!wrap) return;

    const { cats } = buildIndex();
    const labelMap = buildCategoryLabelsFromDOM();

    wrap.innerHTML = "";
    for (const c of cats) {
      const label = (c === "all") ? "All" : (labelMap.get(c) || String(c).replace(/_/g, " "));
      const btn = el("button", { class: `neo3Cat ${currentCat === c ? "active" : ""}` }, label);
      btn.onclick = () => setCat(c);
      wrap.appendChild(btn);
    }
  }

  // ---------- element rendering
  function inCat(name, def) {
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
    const grid = $("#neo3ElGrid");
    const count = $("#neo3Count");
    if (!grid) return;

    const s = loadSettings();
    const query = ($("#neo3Search")?.value || "").trim().toLowerCase();
    const favSet = new Set(getFavs());

    const { all, byCat } = buildIndex();
    let list = tabList({ all, byCat });

    // if tab != all, still allow category filter
    list = list.filter(n => {
      const def = window.elements?.[n];
      if (!def || def.hidden) return false;
      return inCat(n, def);
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

      const btn = el("button", { class: "neo3ElBtn", "data-el": name });
      const dot = el("span", { class: "neo3Dot", style: `background:${elementColor(name)};` });
      const nm = el("span", { class: "neo3Name" }, prettyName(name));

      if (favSet.has(name)) btn.appendChild(el("span", { class: "neo3Star", title: "Favorite" }, "★"));
      btn.append(dot, nm);

      btn.onclick = () => {
        window.selectElement?.(name);
        toast(`Selected: ${prettyName(name)}`);
      };

      btn.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        toggleFavorite(name);
      });

      // tooltip + preview on hover
      btn.addEventListener("mouseenter", (ev) => { hovered = name; if (s.showTooltips) showTip(ev, name); updatePreview(name, true); });
      btn.addEventListener("mousemove", (ev) => { if (s.showTooltips) moveTip(ev); });
      btn.addEventListener("mouseleave", () => { hovered = null; hideTip(); if (currentSelected) updatePreview(currentSelected); });

      grid.appendChild(btn);
      shown++;
    }

    if (count) count.textContent = `${shown} shown • right-click = favorite`;

    // active tabs UI
    $("#neo3TabAll")?.classList.toggle("active", currentTab === "all");
    $("#neo3TabFav")?.classList.toggle("active", currentTab === "fav");
    $("#neo3TabRec")?.classList.toggle("active", currentTab === "recent");

    // preview visibility
    $("#neo3Preview")?.classList.toggle("show", !!(s.showPreview));
  }

  function updatePreview(name, isHover = false) {
    const s = loadSettings();
    const box = $("#neo3Preview");
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
          <span class="neo3Dot" style="background:${elementColor(name)};"></span>
          <div style="min-width:0;">
            <div style="font-weight:900; letter-spacing:.3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${prettyName(name)} ${isHover ? '<span class="muted">(hover)</span>' : ''}
            </div>
            <div class="muted">${name}</div>
          </div>
        </div>
        <button class="neo3Btn" id="neo3PrevFav">${favSet.has(name) ? "★" : "☆"}</button>
      </div>
      <div class="muted" style="margin-top:8px;">
        Category: <b style="color:rgba(255,255,255,.92)">${cat}</b> • State: <b style="color:rgba(255,255,255,.92)">${state}</b><br>
        Density: <b style="color:rgba(255,255,255,.92)">${dens}</b> • Viscosity: <b style="color:rgba(255,255,255,.92)">${visc}</b>
      </div>
      ${desc ? `<div class="muted" style="margin-top:8px;">${String(desc).slice(0, 260)}</div>` : ""}
    `;

    const favBtn = $("#neo3PrevFav");
    if (favBtn) favBtn.onclick = () => toggleFavorite(name);
  }

  // ---------- tooltip
  function showTip(ev, name) {
    const tip = $("#neo3Tip");
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
    const tip = $("#neo3Tip");
    if (!tip || tip.style.display === "none") return;
    const pad = 14;
    tip.style.left = `${Math.min(window.innerWidth - 16, ev.clientX + pad)}px`;
    tip.style.top  = `${Math.min(window.innerHeight - 16, ev.clientY + pad)}px`;
  }
  function hideTip() {
    const tip = $("#neo3Tip");
    if (tip) tip.style.display = "none";
  }

  // ---------- resizing
  function installResize(which) {
    const drawer = which === "elements" ? $("#neo3Elements") : $("#neo3Overhaul");
    const handle = which === "elements" ? $("#neo3ResE") : $("#neo3ResO");
    if (!drawer || !handle) return;

    let dragging = false;
    let startX = 0;
    let startW = 0;

    handle.addEventListener("pointerdown", (ev) => {
      dragging = true;
      startX = ev.clientX;
      const rect = drawer.getBoundingClientRect();
      startW = rect.width;
      handle.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });

    window.addEventListener("pointermove", (ev) => {
      if (!dragging) return;
      const dx = ev.clientX - startX;

      let w;
      if (which === "elements") w = clamp(startW + dx, 320, 860);
      else w = clamp(startW - dx, 320, 860);

      if (which === "elements") {
        localStorage.setItem(MOD.keys.widthElements, String(w));
        document.body.style.setProperty("--neo-w-e", `${w}px`);
      } else {
        localStorage.setItem(MOD.keys.widthOverhaul, String(w));
        document.body.style.setProperty("--neo-w-o", `${w}px`);
      }
    });

    window.addEventListener("pointerup", () => { dragging = false; });
    window.addEventListener("pointercancel", () => { dragging = false; });
  }

  // ---------- hotkeys (clear + simple)
  function installHotkeys() {
    window.addEventListener("keydown", (ev) => {
      const s = loadSettings();
      if (!s.hotkeys) return;

      const a = document.activeElement;
      const typing = a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");

      // B toggles elements
      if (!typing && ev.key.toLowerCase() === "b") {
        ev.preventDefault();
        setOpenElements(!isOpenElements());
      }

      // O toggles overhaul
      if (!typing && ev.key.toLowerCase() === "o") {
        ev.preventDefault();
        setOpenOverhaul(!isOpenOverhaul());
      }

      // / focuses search
      if (!typing && ev.key === "/") {
        ev.preventDefault();
        setOpenElements(true);
        $("#neo3Search")?.focus();
        $("#neo3Search")?.select();
      }

      // Ctrl+K focuses search
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") {
        ev.preventDefault();
        setOpenElements(true);
        $("#neo3Search")?.focus();
        $("#neo3Search")?.select();
      }

      // Esc clears search
      if (ev.key === "Escape" && a === $("#neo3Search")) {
        ev.preventDefault();
        $("#neo3Search").value = "";
        renderElements();
        $("#neo3Search").blur();
      }

      // Q swaps last/current
      if (!typing && ev.key.toLowerCase() === "q" && lastSelected) {
        ev.preventDefault();
        window.selectElement?.(lastSelected);
        toast(`Swapped: ${prettyName(lastSelected)}`);
      }
    }, { passive: false });
  }

  // ---------- tweaks/perf (safe-ish)
  function patchSmartHumans() {
    const e = window.elements;
    if (!e?.human || e.human.__neo3Smart || typeof e.human.tick !== "function") return;
    e.human.__neo3Smart = true;

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
      if (!def || def.__neo3Trap || typeof def.tick !== "function") continue;
      def.__neo3Trap = true;
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
      if (!def || def.__neo3LazyGas || typeof def.tick !== "function") continue;
      if (def.state !== "gas") continue;

      def.__neo3LazyGas = true;
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

    injectCss("neo3Style", cssNeo());

    const s = loadSettings();
    if (!s.enable) return;

    ensureUI();
    addTopButtons();

    // top offset (important because your UI has 2 rows)
    updateTopOffset();
    window.addEventListener("resize", updateTopOffset);
    setInterval(updateTopOffset, 1200);

    hookSelectElement();

    // apply styles / hide vanilla
    document.body.classList.toggle("neo-topstyle", !!s.restyleTopUI);
    document.body.classList.toggle("neo-hide-vanilla", !!s.hideVanillaElementUI);

    // build panels + render
    buildOverhaulPanel();
    setTab(currentTab);
    setCat(currentCat);
    renderCats();
    renderElements();
    updatePreview(currentSelected || hovered || null);

    // restore open states
    if (localStorage.getItem(MOD.keys.openElements) == null) {
      localStorage.setItem(MOD.keys.openElements, s.openElementsOnStart ? "1" : "0");
    }
    if (localStorage.getItem(MOD.keys.openOverhaul) == null) {
      localStorage.setItem(MOD.keys.openOverhaul, "0");
    }

    $("#neo3Elements")?.classList.toggle("open", isOpenElements());
    $("#neo3Overhaul")?.classList.toggle("open", isOpenOverhaul());
    setMax("elements", isMax("elements"));
    setMax("overhaul", isMax("overhaul"));
    syncOverlay();
    syncEdgeTabs();

    // resizing
    installResize("elements");
    installResize("overhaul");

    // hotkeys
    if (s.hotkeys) installHotkeys();

    // tweaks/perf
    if (s.smartHumans) patchSmartHumans();
    if (s.trappedSkipFluids) patchTrappedSkipFluids();
    if (s.lazyGases) patchLazyGases();

    // keep in sync if other mods add/remove elements UI
    const ec = $("#elementControls");
    if (ec) {
      const mo = new MutationObserver(() => {
        renderCats();
        renderElements();
      });
      mo.observe(ec, { childList: true, subtree: true });
    }

    toast(`${MOD.name} loaded`);
  });

})();
