// sbx_pixel_sidebar_overhaul.js
// Pixel Sidebar Overhaul: left element bar w/ scroll + search + categories + pixel-style UI + QoL

(() => {
  "use strict";

  const MOD = {
    name: "Pixel Sidebar Overhaul",
    version: "1.0.0",
    keys: {
      settings: "sbx_pso/settings",
      favorites: "sbx_pso/favorites",
      recents: "sbx_pso/recents",
      sidebarOpen: "sbx_pso/sidebar_open",
    },
    defaults: {
      // UI
      enableSidebar: true,
      hideVanillaElementUI: true,
      sidebarOpenByDefault: true,
      showFavorites: true,
      showRecents: true,
      showTooltips: true,

      // QoL
      hotkeys: true,        // / or Ctrl+K search, Q swap last, Alt+1..9 favs, Shift+1..9 recents
      altWheelBrush: true,  // Alt+mousewheel changes brush size (if supported by game)
      altMiddlePick: true,  // Alt+MiddleClick canvas to pick element under cursor
      altClickInspect: true,// Alt+Click canvas to inspect pixel
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
  function loadSettings() {
    return { ...MOD.defaults, ...(safeParse(localStorage.getItem(MOD.keys.settings) || "{}", {})) };
  }
  function saveSettings(s) { localStorage.setItem(MOD.keys.settings, JSON.stringify(s)); }

  function loadList(key) {
    const arr = safeParse(localStorage.getItem(key) || "[]", []);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  }
  function saveList(key, arr, cap) {
    const out = (cap ? arr.slice(0, cap) : arr);
    localStorage.setItem(key, JSON.stringify(out));
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

  // ---------- Visual style (pixel/bevel to match Sandboxels)
  function cssPixel() {
    return `
/* ===== Pixel Sidebar Overhaul (scoped) ===== */
body.sbx-pso{
  --pso-bg: rgba(10,10,10,.88);
  --pso-panel: rgba(20,20,20,.92);
  --pso-border: rgba(255,255,255,.18);
  --pso-border2: rgba(255,255,255,.10);
  --pso-text: rgba(255,255,255,.92);
  --pso-muted: rgba(255,255,255,.65);
  --pso-shadow: 0 10px 24px rgba(0,0,0,.55);
  --pso-top: 54px;
  --pso-w: 300px;
}

/* Optional: hide vanilla category+element rows */
body.sbx-pso.pso-hide-vanilla #categoryControls,
body.sbx-pso.pso-hide-vanilla #elementControls{
  display:none !important;
}

/* Hamburger button fits in the top pixel UI (uses game's controlButton class) */
#psoHamburger.controlButton{
  min-width: 44px;
  padding-left: 12px !important;
  padding-right: 12px !important;
  font-weight: 700;
}

/* Sidebar + overlay */
#psoOverlay{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.35);
  z-index: 999990;
  display:none;
}
#psoOverlay.open{ display:block; }

#psoSidebar{
  position: fixed;
  left: 8px;
  top: calc(var(--pso-top) + 6px);
  height: calc(100vh - var(--pso-top) - 14px);
  width: var(--pso-w);
  z-index: 999991;
  color: var(--pso-text);

  background: linear-gradient(180deg, rgba(30,30,30,.94), rgba(14,14,14,.92));
  border: 2px solid rgba(255,255,255,.18);
  box-shadow: var(--pso-shadow);
  border-radius: 10px;

  display:flex;
  flex-direction: column;

  transform: translateX(calc(-1 * (var(--pso-w) + 16px)));
  transition: transform 160ms ease;
}
#psoSidebar.open{ transform: translateX(0); }

/* Header */
#psoHeader{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 10px 8px 10px;

  border-bottom: 2px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.22);
}
#psoHeaderTitle{
  display:flex;
  flex-direction: column;
  gap: 2px;
}
#psoHeaderTitle .title{
  font-weight: 700;
  letter-spacing: .5px;
}
#psoHeaderTitle .sub{
  font-size: 12px;
  color: var(--pso-muted);
}
.psoHdrBtns{ display:flex; gap:6px; }

.psoBtn{
  cursor:pointer;
  user-select:none;
  color: var(--pso-text);
  background: linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.04));
  border: 2px solid rgba(255,255,255,.14);
  border-radius: 8px;
  padding: 6px 8px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
}
.psoBtn:hover{ filter: brightness(1.08); }
.psoBtn:active{ transform: translateY(1px); }

/* Search row */
#psoSearchRow{
  padding: 8px 10px;
  border-bottom: 2px solid rgba(255,255,255,.08);
  display:flex;
  gap: 8px;
  align-items:center;
}
#psoSearch{
  flex:1;
  height: 30px;
  padding: 0 8px;
  border-radius: 8px;
  border: 2px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.35);
  color: var(--pso-text);
  outline:none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
}
#psoSearch::placeholder{ color: var(--pso-muted); }

/* Category bar */
#psoCats{
  padding: 8px 10px 6px 10px;
  border-bottom: 2px solid rgba(255,255,255,.08);
  display:flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: thin;
}
#psoCats::-webkit-scrollbar{ height: 8px; }
#psoCats::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.14); border-radius: 999px; }
.psoCat{
  white-space: nowrap;
  border-radius: 999px;
  padding: 5px 10px;
  border: 2px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.22);
  color: var(--pso-text);
  cursor:pointer;
}
.psoCat.active{
  border-color: rgba(255,255,255,.30);
  background: rgba(255,255,255,.10);
}

/* Chips (favorites/recents) */
#psoChips{
  padding: 8px 10px 0 10px;
  display:flex;
  flex-direction: column;
  gap: 8px;
}
.psoSectionTitle{
  font-size: 12px;
  color: var(--pso-muted);
  margin-bottom: 4px;
}
.psoChipRow{
  display:flex;
  gap: 6px;
  flex-wrap: wrap;
  max-height: 64px;
  overflow:auto;
  padding-bottom: 4px;
}
.psoChipRow::-webkit-scrollbar{ height: 8px; width: 8px; }
.psoChipRow::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.14); border-radius: 999px; }

.psoChip{
  display:flex;
  gap: 8px;
  align-items:center;
  max-width: 240px;
  padding: 5px 10px;
  border-radius: 999px;
  border: 2px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.20);
  cursor:pointer;
}
.psoDot{
  width: 9px;
  height: 9px;
  border-radius: 999px;
  box-shadow: inset 0 0 0 2px rgba(0,0,0,.25);
}
.psoChipTxt{
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Element list */
#psoListWrap{
  flex: 1;
  padding: 10px;
  overflow: hidden;
}
#psoList{
  height: 100%;
  overflow: auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding-right: 4px;
}
#psoList::-webkit-scrollbar{ width: 10px; }
#psoList::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.14); border-radius: 999px; }

.psoElBtn{
  position: relative;
  display:flex;
  align-items:center;
  gap: 10px;

  border-radius: 10px;
  padding: 8px 10px;
  cursor:pointer;

  color: var(--pso-text);
  border: 2px solid rgba(255,255,255,.12);
  background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
  user-select:none;
}
.psoElBtn:hover{ filter: brightness(1.10); }
.psoElBtn:active{ transform: translateY(1px); }

.psoElName{
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.psoStar{
  position:absolute;
  top: 6px;
  right: 8px;
  font-size: 12px;
  opacity: .85;
}

/* Tooltip */
#psoTip{
  position: fixed;
  z-index: 999999;
  pointer-events: none;
  display:none;
  max-width: 360px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(0,0,0,.88);
  border: 2px solid rgba(255,255,255,.14);
  color: var(--pso-text);
  box-shadow: var(--pso-shadow);
  font-size: 12px;
}
#psoTip .muted{ color: var(--pso-muted); }

/* Settings panel (scrollable, fits screen) */
#psoSettings{
  position: fixed;
  right: 10px;
  top: calc(var(--pso-top) + 6px);
  z-index: 999992;

  width: 360px;
  max-width: calc(100vw - 20px);
  max-height: calc(100vh - var(--pso-top) - 14px);
  overflow: auto;

  display:none;
  background: linear-gradient(180deg, rgba(30,30,30,.94), rgba(14,14,14,.92));
  border: 2px solid rgba(255,255,255,.18);
  border-radius: 10px;
  box-shadow: var(--pso-shadow);
  color: var(--pso-text);
}
#psoSettings.open{ display:block; }

#psoSettingsHeader{
  position: sticky;
  top: 0;
  background: rgba(0,0,0,.22);
  border-bottom: 2px solid rgba(255,255,255,.10);
  padding: 10px;
  display:flex;
  justify-content: space-between;
  align-items:center;
  gap: 8px;
}
#psoSettingsBody{ padding: 10px; }
.psoToggle{
  display:flex;
  gap: 10px;
  align-items:flex-start;
  padding: 8px;
  border-radius: 10px;
  cursor:pointer;
}
.psoToggle:hover{ background: rgba(255,255,255,.05); }
.psoSmall{ font-size: 12px; color: var(--pso-muted); }
#psoToast{
  position: fixed;
  left: 10px;
  bottom: 10px;
  z-index: 999999;
  display:none;

  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(0,0,0,.88);
  border: 2px solid rgba(255,255,255,.14);
  color: var(--pso-text);
  box-shadow: var(--pso-shadow);
  font-size: 12px;
}
`;
  }

  // ---------- State
  let currentCategory = "all";
  let lastSelected = null;
  let currentSelected = null;

  function getFavs() { return loadList(MOD.keys.favorites); }
  function setFavs(a) { saveList(MOD.keys.favorites, a, 30); }
  function getRecents() { return loadList(MOD.keys.recents); }
  function setRecents(a) { saveList(MOD.keys.recents, a, 18); }

  function toast(msg) {
    const s = loadSettings();
    if (!s.toasts) return;
    const t = $("#psoToast");
    if (!t) return;
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(toast._tm);
    toast._tm = setTimeout(() => (t.style.display = "none"), 1300);
  }

  function elementColor(name) {
    const def = window.elements?.[name];
    if (!def) return "rgba(255,255,255,.35)";
    const c = def.color;
    if (Array.isArray(c) && c.length) return c[0];
    if (typeof c === "string") return c;
    return "rgba(255,255,255,.35)";
  }

  function prettyName(name) {
    const def = window.elements?.[name];
    // many mods/games store display name here; if not, fallback
    const candidate = def?.name || def?.displayName || def?.label;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    return String(name).replace(/_/g, " ");
  }

  function categoriesFromDOMOrFallback() {
    // Try to match language + order by reading existing category buttons
    const domBtns = $$(".categoryButton").filter(b => b.textContent && b.textContent.trim());
    const out = [];
    const seen = new Set();
    for (const b of domBtns) {
      const key =
        b.getAttribute("category") ||
        b.getAttribute("data-category") ||
        (b.id?.startsWith("categoryButton-") ? b.id.replace("categoryButton-", "") : null) ||
        b.textContent.trim().toLowerCase().replace(/\s+/g, "_");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, label: b.textContent.trim() });
    }
    // Fallback: build from elements
    if (!out.length && window.elements) {
      const cats = new Map();
      for (const [name, def] of Object.entries(window.elements)) {
        if (!def || def.hidden) continue;
        const c = def.category || "other";
        cats.set(c, c);
      }
      return [...cats.keys()].sort().map(c => ({ key: c, label: String(c).toUpperCase() }));
    }
    return out;
  }

  function buildElementIndex() {
    const byCat = new Map();
    const all = [];
    if (!window.elements) return { byCat, all };

    for (const [name, def] of Object.entries(window.elements)) {
      if (!def || def.hidden) continue;
      const cat = def.category || "other";
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(name);
      all.push(name);
    }

    // Stable sort by display name
    const nameSort = (a, b) => prettyName(a).localeCompare(prettyName(b));
    for (const [k, arr] of byCat.entries()) arr.sort(nameSort);
    all.sort(nameSort);

    return { byCat, all };
  }

  // ---------- UI Build
  function updateTopOffsetVar() {
    const tc = $("#toolControls");
    const rect = tc?.getBoundingClientRect?.();
    const top = rect ? Math.round(rect.bottom + 6) : 54;
    document.body.style.setProperty("--pso-top", `${top}px`);
  }

  function ensureCoreUI() {
    if ($("#psoSidebar")) return;

    document.body.classList.add("sbx-pso");

    // overlay
    document.body.appendChild(el("div", { id: "psoOverlay", onclick: () => setSidebarOpen(false) }));

    // sidebar
    const sidebar = el("div", { id: "psoSidebar" });

    const header = el("div", { id: "psoHeader" },
      el("div", { id: "psoHeaderTitle" },
        el("div", { class: "title" }, "ELEMENTS"),
        el("div", { class: "sub", id: "psoSub" }, "Search • Categories • Favorites")
      ),
      el("div", { class: "psoHdrBtns" },
        el("button", { class: "psoBtn", title: "Settings", onclick: () => toggleSettings() }, "⚙"),
        el("button", { class: "psoBtn", title: "Close", onclick: () => setSidebarOpen(false) }, "×")
      )
    );

    const searchRow = el("div", { id: "psoSearchRow" },
      el("input", { id: "psoSearch", type: "text", placeholder: "Search…   (/ or Ctrl+K)" }),
      el("button", {
        class: "psoBtn",
        title: "Clear search (Esc)",
        onclick: () => {
          const i = $("#psoSearch");
          i.value = "";
          renderElements();
          i.focus();
        }
      }, "×")
    );

    const cats = el("div", { id: "psoCats" });
    const chips = el("div", { id: "psoChips" });

    const listWrap = el("div", { id: "psoListWrap" },
      el("div", { id: "psoList" })
    );

    sidebar.append(header, searchRow, cats, chips, listWrap);
    document.body.appendChild(sidebar);

    // settings panel
    const settings = el("div", { id: "psoSettings" },
      el("div", { id: "psoSettingsHeader" },
        el("div", {},
          el("div", { style: "font-weight:700;" }, `${MOD.name}`),
          el("div", { class: "psoSmall" }, `v${MOD.version} • scrollable`)
        ),
        el("button", { class: "psoBtn", onclick: () => toggleSettings(false) }, "×")
      ),
      el("div", { id: "psoSettingsBody" })
    );
    document.body.appendChild(settings);

    // tooltip + toast
    document.body.appendChild(el("div", { id: "psoTip" }));
    document.body.appendChild(el("div", { id: "psoToast" }));

    // horizontal scroll with wheel on category row
    cats.addEventListener("wheel", (ev) => {
      if (Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) {
        cats.scrollLeft += ev.deltaY;
        ev.preventDefault();
      }
    }, { passive: false });

    // search behavior
    $("#psoSearch").addEventListener("input", () => renderElements());
  }

  function addHamburgerButton() {
    const tc = $("#toolControls");
    if (!tc || $("#psoHamburger")) return;

    const btn = el("button", {
      id: "psoHamburger",
      class: "controlButton",
      title: "Open/Close element sidebar (≡)",
      onclick: () => setSidebarOpen(!isSidebarOpen()),
    }, "≡");

    // put it near the left of tool buttons
    tc.prepend(btn);
  }

  function isSidebarOpen() {
    return localStorage.getItem(MOD.keys.sidebarOpen) === "1";
  }
  function setSidebarOpen(open) {
    localStorage.setItem(MOD.keys.sidebarOpen, open ? "1" : "0");
    $("#psoSidebar")?.classList.toggle("open", open);
    $("#psoOverlay")?.classList.toggle("open", open);
  }

  function toggleSettings(force) {
    const panel = $("#psoSettings");
    if (!panel) return;
    const open = (typeof force === "boolean") ? force : !panel.classList.contains("open");
    panel.classList.toggle("open", open);
  }

  function applyHideVanilla() {
    const s = loadSettings();
    document.body.classList.toggle("pso-hide-vanilla", !!(s.enableSidebar && s.hideVanillaElementUI));
  }

  function buildSettingsPanel() {
    const body = $("#psoSettingsBody");
    if (!body) return;
    body.innerHTML = "";

    const s = loadSettings();

    function toggleRow(key, title, desc) {
      const id = `pso_${key}`;
      const row = el("label", { class: "psoToggle", for: id },
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
          el("div", { style: "font-weight:700;" }, title),
          el("div", { class: "psoSmall" }, desc)
        )
      );
      return row;
    }

    const section = (t) => el("div", { style: "margin: 10px 0 6px 2px; font-weight:700;" }, t);

    body.append(
      section("UI"),
      toggleRow("enableSidebar", "Enable left element sidebar", "Main feature: a scrollable bar with categories + search"),
      toggleRow("hideVanillaElementUI", "Hide vanilla element/category rows", "Cleaner screen; sidebar becomes the main UI"),
      toggleRow("sidebarOpenByDefault", "Open sidebar by default", "Keeps it open after refresh"),
      toggleRow("showFavorites", "Show favorites", "Right-click element = favorite"),
      toggleRow("showRecents", "Show recents", "Shows last used elements"),
      toggleRow("showTooltips", "Tooltips", "Hover element buttons for info"),

      el("div", { style: "height: 2px; background: rgba(255,255,255,.08); margin: 10px 0;" }),

      section("Quality of life"),
      toggleRow("hotkeys", "Hotkeys", "/ search, Ctrl+K search, Q swap last, Alt+1..9 favs, Shift+1..9 recents"),
      toggleRow("altWheelBrush", "Alt+Wheel brush size", "Fast brush resizing"),
      toggleRow("altMiddlePick", "Alt+MiddleClick pick", "Pick the element under cursor from the canvas"),
      toggleRow("altClickInspect", "Alt+Click inspector", "Quick pixel info box"),
      toggleRow("toasts", "Toasts", "Small notifications for actions"),

      el("div", { style: "height: 2px; background: rgba(255,255,255,.08); margin: 10px 0;" }),

      section("Tweaks / performance"),
      toggleRow("smartHumans", "Smart humans", "Humans step away from danger"),
      toggleRow("trappedSkipFluids", "Skip trapped fluids", "Helps lag with huge enclosed fluid blobs"),
      toggleRow("lazyGases", "Lazy gases", "Helps lag with huge enclosed gas blobs"),

      el("div", { style: "display:flex; gap:8px; flex-wrap:wrap; margin-top: 10px;" },
        el("button", {
          class: "psoBtn",
          onclick: () => { setFavs([]); renderChips(); renderElements(); toast("Favorites cleared"); }
        }, "Clear favs"),
        el("button", {
          class: "psoBtn",
          onclick: () => { setRecents([]); renderChips(); toast("Recents cleared"); }
        }, "Clear recents"),
        el("button", {
          class: "psoBtn",
          onclick: () => { saveSettings({ ...MOD.defaults }); toast("Reset settings"); location.reload(); }
        }, "Reset + reload")
      ),

      el("div", { class: "psoSmall", style: "margin-top:10px;" },
        "Tip: If another mod also edits the UI, disable it to avoid layout fights."
      )
    );
  }

  function liveApply() {
    const s = loadSettings();
    applyHideVanilla();

    // sidebar on/off
    if (!s.enableSidebar) {
      setSidebarOpen(false);
      $("#psoSidebar")?.classList.remove("open");
      $("#psoOverlay")?.classList.remove("open");
      return;
    }

    // chips + list rerender
    renderCategories();
    renderChips();
    renderElements();

    // tooltip toggle
    if (!s.showTooltips) $("#psoTip").style.display = "none";

    // open by default
    if (s.sidebarOpenByDefault && localStorage.getItem(MOD.keys.sidebarOpen) == null) {
      setSidebarOpen(true);
    }
  }

  // ---------- Favorites/Recents + select tracking
  function toggleFavorite(name) {
    const favs = getFavs();
    const i = favs.indexOf(name);
    if (i >= 0) { favs.splice(i, 1); toast(`Unfavorited: ${prettyName(name)}`); }
    else { favs.unshift(name); toast(`Favorited: ${prettyName(name)}`); }
    setFavs(favs);
    renderChips();
    renderElements();
  }

  function pushRecent(name) {
    const r = getRecents();
    const next = [name, ...r.filter(x => x !== name)];
    setRecents(next);
    renderChips();
  }

  function hookSelectElement() {
    if (typeof window.selectElement !== "function") return;
    if (window.selectElement.__psoWrapped) return;

    const old = window.selectElement;
    function wrapped(name, ...rest) {
      try {
        lastSelected = currentSelected;
        currentSelected = name;
        pushRecent(name);
      } catch {}
      return old.call(this, name, ...rest);
    }
    wrapped.__psoWrapped = true;
    window.selectElement = wrapped;
  }

  // ---------- Render categories / chips / elements
  function renderCategories() {
    const catsWrap = $("#psoCats");
    if (!catsWrap) return;

    const s = loadSettings();
    if (!s.enableSidebar) return;

    catsWrap.innerHTML = "";

    const cats = categoriesFromDOMOrFallback();
    const allBtn = el("button", { class: `psoCat ${currentCategory === "all" ? "active" : ""}` }, "ALL");
    allBtn.onclick = () => { currentCategory = "all"; renderCategories(); renderElements(); };
    catsWrap.appendChild(allBtn);

    for (const c of cats) {
      const btn = el("button", { class: `psoCat ${currentCategory === c.key ? "active" : ""}` }, c.label);
      btn.onclick = () => { currentCategory = c.key; renderCategories(); renderElements(); };
      catsWrap.appendChild(btn);
    }
  }

  function chip(label, name) {
    const dot = el("span", { class: "psoDot", style: `background:${elementColor(name)};` });
    const txt = el("span", { class: "psoChipTxt" }, label);
    const b = el("button", { class: "psoChip", title: "Click to select" }, dot, txt);
    b.onclick = () => { window.selectElement?.(name); setSidebarOpen(true); };
    return b;
  }

  function renderChips() {
    const chipsWrap = $("#psoChips");
    if (!chipsWrap) return;

    const s = loadSettings();
    chipsWrap.innerHTML = "";

    if (s.showFavorites) {
      const favs = getFavs().filter(n => window.elements?.[n]);
      chipsWrap.appendChild(el("div", {},
        el("div", { class: "psoSectionTitle" }, "Favorites (right-click element to toggle)"),
        el("div", { class: "psoChipRow" },
          ...(favs.length ? favs.slice(0, 12).map(n => chip(prettyName(n), n)) : [el("div", { class: "psoSmall" }, "No favorites yet.")])
        )
      ));
    }

    if (s.showRecents) {
      const rec = getRecents().filter(n => window.elements?.[n]).slice(0, 12);
      chipsWrap.appendChild(el("div", {},
        el("div", { class: "psoSectionTitle" }, "Recent"),
        el("div", { class: "psoChipRow" },
          ...(rec.length ? rec.map(n => chip(prettyName(n), n)) : [el("div", { class: "psoSmall" }, "No recents yet.")])
        )
      ));
    }
  }

  function matchesCategory(name, def, catKey) {
    if (catKey === "all") return true;
    const c = def?.category || "other";
    return String(c) === String(catKey);
  }

  function renderElements() {
    const list = $("#psoList");
    if (!list) return;

    const s = loadSettings();
    if (!s.enableSidebar) { list.innerHTML = ""; return; }

    const query = ($("#psoSearch")?.value || "").trim().toLowerCase();
    const favSet = new Set(getFavs());

    const { all, byCat } = buildElementIndex();

    let candidates = [];
    if (currentCategory === "all") candidates = all;
    else candidates = (byCat.get(currentCategory) || []);

    // filter by search
    if (query) {
      candidates = candidates.filter(n => {
        const label = prettyName(n).toLowerCase();
        return label.includes(query) || String(n).toLowerCase().includes(query);
      });
    }

    // show count
    const sub = $("#psoSub");
    if (sub) sub.textContent = `${candidates.length} shown • ${query ? "filtered" : (currentCategory === "all" ? "all categories" : "category")}`;

    list.innerHTML = "";

    for (const name of candidates) {
      const def = window.elements?.[name];
      if (!def || def.hidden) continue;

      const b = el("button", { class: "psoElBtn", "data-el": name });
      const dot = el("span", { class: "psoDot", style: `background:${elementColor(name)}; width:12px; height:12px;` });
      const nm = el("span", { class: "psoElName" }, prettyName(name));

      if (favSet.has(name)) b.appendChild(el("span", { class: "psoStar", title: "Favorited" }, "★"));

      b.append(dot, nm);

      b.onclick = () => {
        window.selectElement?.(name);
        setSidebarOpen(true);
      };

      // right click to favorite
      b.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        toggleFavorite(name);
      });

      // tooltip on hover
      if (s.showTooltips) {
        b.addEventListener("mouseenter", (ev) => showTooltip(ev, name));
        b.addEventListener("mousemove", (ev) => moveTooltip(ev));
        b.addEventListener("mouseleave", () => hideTooltip());
      }

      list.appendChild(b);
    }
  }

  // ---------- Tooltip
  function showTooltip(ev, name) {
    const s = loadSettings();
    if (!s.showTooltips) return;
    const tip = $("#psoTip");
    if (!tip) return;

    const def = window.elements?.[name];
    const cat = def?.category ?? "—";
    const state = def?.state ?? "—";
    const dens = (typeof def?.density === "number") ? def.density : "—";
    const visc = (typeof def?.viscosity === "number") ? def.viscosity : "—";

    tip.innerHTML = `<b>${prettyName(name)}</b> <span class="muted">(${name})</span><br>
      <span class="muted">Category:</span> ${cat} &nbsp; <span class="muted">State:</span> ${state}<br>
      <span class="muted">Density:</span> ${dens} &nbsp; <span class="muted">Viscosity:</span> ${visc}`;

    tip.style.display = "block";
    moveTooltip(ev);
  }

  function moveTooltip(ev) {
    const tip = $("#psoTip");
    if (!tip || tip.style.display === "none") return;
    const pad = 14;
    const x = Math.min(window.innerWidth - 16, ev.clientX + pad);
    const y = Math.min(window.innerHeight - 16, ev.clientY + pad);
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }

  function hideTooltip() {
    const tip = $("#psoTip");
    if (tip) tip.style.display = "none";
  }

  // ---------- QoL Hotkeys
  function installHotkeys() {
    window.addEventListener("keydown", (ev) => {
      const s = loadSettings();
      if (!s.hotkeys) return;

      const active = document.activeElement;
      const typing = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");

      // Focus search: / or Ctrl+K
      if (!typing && ev.key === "/") {
        ev.preventDefault();
        setSidebarOpen(true);
        $("#psoSearch")?.focus();
        $("#psoSearch")?.select();
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") {
        ev.preventDefault();
        setSidebarOpen(true);
        $("#psoSearch")?.focus();
        $("#psoSearch")?.select();
      }

      // ESC clears search if focused
      if (ev.key === "Escape" && active === $("#psoSearch")) {
        ev.preventDefault();
        $("#psoSearch").value = "";
        renderElements();
        $("#psoSearch").blur();
      }

      // Q swaps last/current
      if (!typing && ev.key.toLowerCase() === "q" && lastSelected) {
        ev.preventDefault();
        window.selectElement?.(lastSelected);
        toast(`Swapped to: ${prettyName(lastSelected)}`);
      }

      // Alt+1..9 = favorites
      if (!typing && ev.altKey && /^[1-9]$/.test(ev.key)) {
        const idx = parseInt(ev.key, 10) - 1;
        const fav = getFavs().filter(n => window.elements?.[n])[idx];
        if (fav) {
          ev.preventDefault();
          window.selectElement?.(fav);
          toast(`Favorite: ${prettyName(fav)}`);
        }
      }

      // Shift+1..9 = recents
      if (!typing && ev.shiftKey && /^[1-9]$/.test(ev.key)) {
        const idx = parseInt(ev.key, 10) - 1;
        const rec = getRecents().filter(n => window.elements?.[n])[idx];
        if (rec) {
          ev.preventDefault();
          window.selectElement?.(rec);
          toast(`Recent: ${prettyName(rec)}`);
        }
      }
    }, { passive: false });
  }

  // ---------- Alt+Wheel brush size (best-effort)
  function installAltWheelBrush() {
    window.addEventListener("wheel", (ev) => {
      const s = loadSettings();
      if (!s.altWheelBrush) return;
      if (!ev.altKey) return;

      // only if over a canvas
      const canvases = $$("canvas");
      const canvas = canvases.sort((a, b) => (b.width*b.height) - (a.width*a.height))[0];
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      if (!inside) return;

      const key = (typeof window.mouseSize === "number") ? "mouseSize"
               : (typeof window.brushSize === "number") ? "brushSize"
               : null;
      if (!key) return;

      ev.preventDefault();
      const cur = window[key];
      const delta = ev.deltaY > 0 ? -1 : 1;
      const next = clamp(cur + delta, 1, 200);
      window[key] = next;
      try { window.setSetting?.(key, next); } catch {}
      toast(`Brush: ${next}`);
    }, { passive: false });
  }

  // ---------- Canvas coordinate helpers (for pick/inspect)
  function findMainCanvas() {
    const canvases = $$("canvas");
    if (!canvases.length) return null;
    return canvases.sort((a, b) => (b.width*b.height) - (a.width*a.height))[0];
  }

  function screenToGrid(ev, canvas) {
    const rect = canvas.getBoundingClientRect();
    const rx = (ev.clientX - rect.left) / rect.width;
    const ry = (ev.clientY - rect.top) / rect.height;

    const px = clamp(rx * canvas.width, 0, canvas.width - 1);
    const py = clamp(ry * canvas.height, 0, canvas.height - 1);

    const ps = (typeof window.pixelSize === "number" && window.pixelSize > 0) ? window.pixelSize : 1;
    return { gx: Math.floor(px / ps), gy: Math.floor(py / ps) };
  }

  // ---------- Alt+Middle pick
  function installAltMiddlePick() {
    window.addEventListener("pointerdown", (ev) => {
      const s = loadSettings();
      if (!s.altMiddlePick) return;
      if (!ev.altKey) return;
      if (ev.button !== 1) return; // middle click

      const canvas = findMainCanvas();
      if (!canvas) return;

      const { gx, gy } = screenToGrid(ev, canvas);
      const p = window.pixelMap?.[gx]?.[gy];
      const name = p?.element;
      if (name && window.elements?.[name]) {
        window.selectElement?.(name);
        toast(`Picked: ${prettyName(name)}`);
        setSidebarOpen(true);
      }
    }, { passive: true });
  }

  // ---------- Alt+Click inspect
  function installAltClickInspect() {
    const boxId = "psoInspect";
    if ($(`#${boxId}`)) return;
    const box = el("div", {
      id: boxId,
      style: `
        position: fixed; z-index: 999999; display:none;
        padding: 8px 10px;
        border-radius: 10px;
        background: rgba(0,0,0,.88);
        border: 2px solid rgba(255,255,255,.14);
        color: rgba(255,255,255,.92);
        box-shadow: 0 10px 24px rgba(0,0,0,.55);
        font-size: 12px;
        max-width: 380px;
      `
    });
    document.body.appendChild(box);

    window.addEventListener("pointerdown", (ev) => {
      const s = loadSettings();
      if (!s.altClickInspect) return;
      if (!ev.altKey) return;
      if (ev.button !== 0) return;

      const canvas = findMainCanvas();
      if (!canvas) return;

      const { gx, gy } = screenToGrid(ev, canvas);
      const p = window.pixelMap?.[gx]?.[gy];
      const elName = p?.element || "empty";

      box.innerHTML = `
        <b>Pixel</b> <span style="opacity:.7;">(${gx}, ${gy})</span><br>
        <span style="opacity:.7;">Element:</span> ${elName}<br>
        ${p ? `
          <span style="opacity:.7;">Temp:</span> ${typeof p.temp === "number" ? p.temp.toFixed(1) : "—"}<br>
          <span style="opacity:.7;">Charge:</span> ${p.charge ?? "—"}<br>
          <span style="opacity:.7;">Life:</span> ${p.life ?? "—"}
        ` : `<span style="opacity:.7;">No pixel here.</span>`}
      `;

      const pad = 14;
      box.style.left = `${Math.min(window.innerWidth - 16, ev.clientX + pad)}px`;
      box.style.top  = `${Math.min(window.innerHeight - 16, ev.clientY + pad)}px`;
      box.style.display = "block";
      clearTimeout(installAltClickInspect._tm);
      installAltClickInspect._tm = setTimeout(() => box.style.display = "none", 1600);
    }, { passive: true });
  }

  // ---------- Tweaks/perf (safe-ish)
  function patchSmartHumans() {
    const e = window.elements;
    if (!e?.human || e.human.__psoSmart || typeof e.human.tick !== "function") return;
    e.human.__psoSmart = true;

    const old = e.human.tick;
    const danger = new Set(["fire","smoke","lava","magma","acid","acid_gas","explosion","radiation","plasma","napalm","greek_fire","nuke"]);
    const adj = window.adjacentCoords;
    const tryMove = window.tryMove;
    const isEmpty = window.isEmpty;

    e.human.tick = function (pixel) {
      try {
        const pm = window.pixelMap;
        if (!pm || !adj || !tryMove || !isEmpty) return old(pixel);

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
      if (!def || def.__psoTrap || typeof def.tick !== "function") continue;
      def.__psoTrap = true;
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
      if (!def || def.__psoLazyGas || typeof def.tick !== "function") continue;
      if (def.state !== "gas") continue;

      def.__psoLazyGas = true;
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

  // ---------- Boot
  onGameReady(async () => {
    // Wait for UI anchors
    try { await waitFor(() => $("#toolControls")); } catch {}
    try { await waitFor(() => $("#controls")); } catch {}

    injectCss("psoStyle", cssPixel());
    updateTopOffsetVar();
    window.addEventListener("resize", updateTopOffsetVar);
    setInterval(updateTopOffsetVar, 1000);

    ensureCoreUI();
    addHamburgerButton();

    hookSelectElement();

    buildSettingsPanel();
    renderCategories();
    renderChips();
    renderElements();

    const s = loadSettings();
    applyHideVanilla();

    // open by default
    if (s.enableSidebar) {
      const hasPref = localStorage.getItem(MOD.keys.sidebarOpen) != null;
      if (!hasPref) localStorage.setItem(MOD.keys.sidebarOpen, s.sidebarOpenByDefault ? "1" : "0");
      setSidebarOpen(isSidebarOpen());
    }

    // Hooks
    if (s.hotkeys) installHotkeys();
    if (s.altWheelBrush) installAltWheelBrush();
    if (s.altMiddlePick) installAltMiddlePick();
    if (s.altClickInspect) installAltClickInspect();

    // Tweaks/perf
    if (s.smartHumans) patchSmartHumans();
    if (s.trappedSkipFluids) patchTrappedSkipFluids();
    if (s.lazyGases) patchLazyGases();

    // Re-render when elements are changed by other mods
    const ec = $("#elementControls");
    if (ec) {
      const mo = new MutationObserver(() => {
        // categories might have changed (mods/language)
        renderCategories();
        renderChips();
        renderElements();
      });
      mo.observe(ec, { childList: true, subtree: true });
    }
  });

})();
