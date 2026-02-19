// ui+.js — Neo Mod Center v1.2
// Fixes: auto-open bug, black screen after close, adds enable/disable toggles (library)
// Hotkeys: Ctrl+Shift+M (or Cmd+Shift+M on Mac) opens; Esc closes

(() => {
  "use strict";

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const safeText = (el) => (el && (el.textContent || "")).trim();

  const NEO = (window.NEOUI = window.NEOUI || {});
  if (NEO.__neo_modcenter_v12_loaded) return;
  NEO.__neo_modcenter_v12_loaded = true;

  const STORE = {
    keyGuess: "neo_modcenter_enabled_key_guess",
    keyLibrary: "neo_modcenter_library_v1",
    keyScale: "neo_modcenter_scale",
  };

  const state = {
    open: false,
    scale: Number(localStorage.getItem(STORE.keyScale) || "1") || 1,
    search: "",
    tab: "installed",
    lastVanillaModScreen: null,
    lastVanillaMenuRoot: null,
  };

  function looksLikeModString(s) {
    if (typeof s !== "string") return false;
    const t = s.trim().toLowerCase();
    return (
      t.endsWith(".js") ||
      t.includes(".js?") ||
      t.startsWith("http://") ||
      t.startsWith("https://")
    );
  }

  function normalizeMods(str) {
    return String(str || "")
      .split(";")
      .map(s => s.trim())
      .filter(Boolean);
  }

  // ---------- enabledMods storage (game key guessing) ----------
  function isModsArray(v) {
    return Array.isArray(v) && v.every(x => typeof x === "string");
  }

  function guessEnabledModsKey() {
    const cached = localStorage.getItem(STORE.keyGuess);
    if (cached && localStorage.getItem(cached) != null) return cached;

    const candidates = [
      "enabledMods", "mods", "modList", "modsEnabled",
      "enabled_mods", "enabled-mods", "sb_mods", "sbmods"
    ];

    for (const k of candidates) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;

      try {
        const v = JSON.parse(raw);
        if (isModsArray(v) && v.every(looksLikeModString)) {
          localStorage.setItem(STORE.keyGuess, k);
          return k;
        }
      } catch {
        const parts = normalizeMods(raw);
        if (parts.length && parts.every(looksLikeModString)) {
          localStorage.setItem(STORE.keyGuess, k);
          return k;
        }
      }
    }

    // fallback: scan keys
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const raw = localStorage.getItem(k);
      if (!raw || (!raw.includes(".js") && !raw.includes("http"))) continue;

      try {
        const v = JSON.parse(raw);
        if (isModsArray(v) && v.some(looksLikeModString)) {
          localStorage.setItem(STORE.keyGuess, k);
          return k;
        }
      } catch {
        const parts = normalizeMods(raw);
        if (parts.length && parts.some(looksLikeModString)) {
          localStorage.setItem(STORE.keyGuess, k);
          return k;
        }
      }
    }
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
    const clean = Array.from(new Set(list.map(s => s.trim()).filter(Boolean)));

    if (Array.isArray(window.enabledMods)) window.enabledMods = clean.slice();

    const k = guessEnabledModsKey();
    try {
      localStorage.setItem(k, JSON.stringify(clean));
    } catch {
      localStorage.setItem(k, clean.join(";"));
    }
    localStorage.setItem(STORE.keyGuess, k);
    return k;
  }

  // ---------- library (keeps mods even when disabled) ----------
  // library entry: { id: string, enabled: boolean }
  function readLibrary() {
    const raw = localStorage.getItem(STORE.keyLibrary);
    if (!raw) return [];
    try {
      const v = JSON.parse(raw);
      if (Array.isArray(v)) {
        return v
          .filter(x => x && typeof x.id === "string")
          .map(x => ({ id: x.id.trim(), enabled: !!x.enabled }))
          .filter(x => x.id);
      }
    } catch {}
    return [];
  }

  function writeLibrary(lib) {
    const clean = [];
    const seen = new Set();
    for (const it of lib || []) {
      const id = String(it?.id || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      clean.push({ id, enabled: !!it.enabled });
    }
    localStorage.setItem(STORE.keyLibrary, JSON.stringify(clean));
    return clean;
  }

  // Sync library with current enabled list (first run / external changes)
  function syncLibraryFromEnabled() {
    const enabled = new Set(readEnabledMods());
    const lib = readLibrary();
    const map = new Map(lib.map(x => [x.id, x.enabled]));

    // Ensure enabled mods are in library and marked enabled
    for (const m of enabled) map.set(m, true);

    // Build in stable order: keep existing order, then append new enabled ones
    const out = [];
    const seen = new Set();

    for (const x of lib) {
      const en = map.get(x.id) ?? false;
      out.push({ id: x.id, enabled: en });
      seen.add(x.id);
    }
    for (const m of enabled) {
      if (!seen.has(m)) out.push({ id: m, enabled: true });
    }
    writeLibrary(out);
  }

  function applyLibraryToEnabled() {
    const lib = readLibrary();
    const enabled = lib.filter(x => x.enabled).map(x => x.id);
    writeEnabledMods(enabled);
  }

  // ---------- UI + CSS ----------
  const style = document.createElement("style");
  style.id = "neoModCenterV12CSS";
  style.textContent = `
:root{
  --neoMC-z: 999920;
  --neoMC-line: rgba(255,255,255,.14);
  --neoMC-bg: rgba(16,16,20,.92);
  --neoMC-bg2: rgba(22,22,28,.92);
  --neoMC-txt: rgba(255,255,255,.92);
  --neoMC-txt2: rgba(255,255,255,.68);
  --neoMC-shadow: 0 20px 60px rgba(0,0,0,.60);
  --neoMC-radius: 16px;
  --neoMC-scale: 1;
}
#neoMCOverlay{
  position: fixed; inset: 0;
  z-index: var(--neoMC-z);
  display: none;
  background: rgba(0,0,0,.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--neoMC-txt);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}
#neoMCOverlay.open{ display:block; }
#neoMC{
  width: min(1200px, 96vw);
  height: min(88vh, 920px);
  margin: 6vh auto 0 auto;
  background: linear-gradient(180deg, rgba(18,18,22,.92), rgba(10,10,12,.88));
  border: 1px solid var(--neoMC-line);
  border-radius: var(--neoMC-radius);
  box-shadow: var(--neoMC-shadow);
  display: grid;
  grid-template-columns: minmax(260px, 360px) 1fr;
  overflow: hidden;
  font-size: calc(14px * var(--neoMC-scale));
}
#neoMCLeft{
  background: rgba(14,14,18,.84);
  border-right: 1px solid var(--neoMC-line);
  display:flex;
  flex-direction: column;
  min-width: 0;
}
#neoMCRight{
  background: rgba(18,18,22,.76);
  display:flex;
  flex-direction: column;
  min-width: 0;
}
.neoMCTop{
  display:flex;
  align-items:center;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid var(--neoMC-line);
  background: rgba(10,10,12,.55);
}
.neoMCtitle{
  display:flex; flex-direction:column; gap:2px; min-width:0;
}
.neoMCtitle b{
  font-size: calc(16px * var(--neoMC-scale));
  white-space: nowrap; overflow:hidden; text-overflow: ellipsis;
}
.neoMCtitle span{
  color: var(--neoMC-txt2);
  font-size: calc(12px * var(--neoMC-scale));
  white-space: nowrap; overflow:hidden; text-overflow: ellipsis;
}
.neoRow{ display:flex; gap: 10px; align-items:center; min-width:0; flex-wrap: wrap; }
.neoGrow{ flex:1; min-width:0; }
.neoBtn{
  border: 1px solid var(--neoMC-line);
  background: rgba(255,255,255,.06);
  color: var(--neoMC-txt);
  padding: 10px 12px;
  border-radius: 12px;
  cursor:pointer;
  user-select:none;
  font-size: calc(13px * var(--neoMC-scale));
  line-height: 1;
}
.neoBtn:hover{ background: rgba(255,255,255,.10); }
.neoBtn:active{ transform: translateY(1px); }
.neoBtn.primary{ border-color: rgba(120,170,255,.45); background: rgba(120,170,255,.18); }
.neoBtn.danger{ border-color: rgba(255,90,90,.35); background: rgba(255,90,90,.16); }
.neoBtn.ghost{ background: transparent; }
.neoInput{
  width: 100%;
  border: 1px solid var(--neoMC-line);
  background: rgba(0,0,0,.22);
  color: var(--neoMC-txt);
  padding: 10px 12px;
  border-radius: 12px;
  outline: none;
  font-size: calc(13px * var(--neoMC-scale));
}
.neoInput::placeholder{ color: rgba(255,255,255,.45); }
.neoTabs{
  display:flex;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--neoMC-line);
}
.neoTab{
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--neoMC-line);
  background: rgba(255,255,255,.06);
  cursor:pointer;
  font-size: calc(13px * var(--neoMC-scale));
}
.neoTab.active{
  border-color: rgba(120,170,255,.45);
  background: rgba(120,170,255,.18);
}
.neoPanel{
  flex:1;
  min-height: 0;
  overflow:auto;
  padding: 14px;
  overscroll-behavior: contain;
}
.neoCard{
  border: 1px solid var(--neoMC-line);
  background: rgba(255,255,255,.05);
  border-radius: var(--neoMC-radius);
  padding: 12px;
  margin-bottom: 10px;
}
.neoCard h3{ margin:0 0 6px 0; font-size: calc(14px * var(--neoMC-scale)); }
.neoCard p{ margin:0; color: var(--neoMC-txt2); font-size: calc(12px * var(--neoMC-scale)); }

.neoModItem{
  display:flex;
  align-items:center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--neoMC-line);
  background: rgba(0,0,0,.18);
  border-radius: 14px;
  margin-bottom: 10px;
}
.neoModName{
  min-width:0;
  display:flex;
  flex-direction:column;
  gap:2px;
}
.neoModName b{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size: calc(13px * var(--neoMC-scale)); }
.neoModName span{ color: var(--neoMC-txt2); font-size: calc(12px * var(--neoMC-scale)); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.neoToggle{
  display:flex; align-items:center; gap: 8px;
  border: 1px solid var(--neoMC-line);
  background: rgba(255,255,255,.06);
  border-radius: 999px;
  padding: 8px 10px;
}
.neoToggle input{ transform: scale(1.05); }
.neoFooter{
  padding: 14px;
  border-top: 1px solid var(--neoMC-line);
  background: rgba(10,10,12,.45);
  display:flex;
  gap: 12px;
  align-items:center;
}
`;
  document.head.appendChild(style);

  function applyScale() {
    state.scale = clamp(state.scale, 0.85, 1.35);
    document.documentElement.style.setProperty("--neoMC-scale", String(state.scale));
    localStorage.setItem(STORE.keyScale, String(state.scale));
  }
  applyScale();

  const overlay = document.createElement("div");
  overlay.id = "neoMCOverlay";
  overlay.innerHTML = `
    <div id="neoMC" role="dialog" aria-modal="true" aria-label="Neo Mod Center">
      <div id="neoMCLeft">
        <div class="neoMCTop">
          <div class="neoMCtitle neoGrow">
            <b>Neo Mod Center</b>
            <span>Enable/disable without removing</span>
          </div>
          <button class="neoBtn ghost" id="neoMCClose" title="Close (Esc)">✕</button>
        </div>

        <div class="neoTabs" id="neoMCTabs">
          <div class="neoTab active" data-tab="installed">Installed</div>
          <div class="neoTab" data-tab="add">Add</div>
          <div class="neoTab" data-tab="tools">Tools</div>
        </div>

        <div class="neoPanel">
          <div class="neoCard">
            <h3>Search</h3>
            <input class="neoInput" id="neoMCSearch" placeholder="Search mods..." />
          </div>

          <div class="neoCard">
            <h3>UI Size</h3>
            <div class="neoRow">
              <button class="neoBtn" id="neoMCSmaller">A−</button>
              <button class="neoBtn" id="neoMCBigger">A+</button>
              <div class="neoGrow"></div>
              <button class="neoBtn primary" id="neoMCReload">Reload</button>
            </div>
            <p style="margin-top:8px;">Reload applies changes (unloading mods needs refresh).</p>
          </div>

          <div class="neoCard">
            <h3>Quick</h3>
            <div class="neoRow">
              <button class="neoBtn" id="neoMCEnableAll">Enable all</button>
              <button class="neoBtn" id="neoMCDisableAll">Disable all</button>
              <button class="neoBtn danger" id="neoMCRemoveDisabled">Remove disabled</button>
            </div>
            <p style="margin-top:8px;">“Remove disabled” deletes from library (optional).</p>
          </div>
        </div>
      </div>

      <div id="neoMCRight">
        <div class="neoMCTop">
          <div class="neoMCtitle neoGrow">
            <b id="neoMCRTitle">Installed Mods</b>
            <span id="neoMCRSub">Toggle enabled without deleting</span>
          </div>
          <button class="neoBtn" id="neoMCHelp">Hotkeys</button>
        </div>

        <div class="neoPanel" id="neoMCRPanel"></div>

        <div class="neoFooter">
          <span style="color:rgba(255,255,255,.65); font-size:12px;" id="neoMCFooter"></span>
          <div class="neoGrow"></div>
          <button class="neoBtn" id="neoMCClose2">Close</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // ---------- don’t overlap other UI panels ----------
  function closeOtherPanels() {
    try { NEO.closeElements && NEO.closeElements(); } catch {}
    try { NEO.closeSettings && NEO.closeSettings(); } catch {}
  }

  // ---------- vanilla mod menu cleanup (prevents black screen) ----------
  function findVisibleVanillaModScreen() {
    // Look for something that is clearly the vanilla mod screen (only when visible)
    const candidates = qsa("div, section").filter(el => el && el.offsetParent !== null);
    for (const el of candidates) {
      const t = safeText(el);
      if (!t) continue;
      if (t.includes("Enabled Mods") && (t.includes("Reload") || t.includes("apply"))) return el;
    }
    return null;
  }

  function closeVanillaMenuIfOpen() {
    // Best-effort: if vanilla mod screen exists, click a visible close/back button near it
    const modScreen = state.lastVanillaModScreen || findVisibleVanillaModScreen();
    if (!modScreen) return;

    // Try to click close/back inside it
    const btns = qsa("button, a", modScreen);
    const closeBtn = btns.find(b => {
      const t = safeText(b).toLowerCase();
      return t === "close" || t === "back" || t === "x" || t.includes("close") || t.includes("back");
    });
    if (closeBtn) {
      closeBtn.click();
      return;
    }

    // If no close button, unhide it (we never hide it in v1.2, but safe)
    modScreen.style.display = "";
  }

  // ---------- open/close ----------
  function openModCenter() {
    syncLibraryFromEnabled();
    closeOtherPanels();

    // If user clicked mods button, vanilla might have opened; remember it and close after opening ours
    state.lastVanillaModScreen = findVisibleVanillaModScreen();
    overlay.classList.add("open");
    state.open = true;
    renderAll();

    // Close vanilla overlay AFTER ours is shown (prevents black/flash)
    setTimeout(() => closeVanillaMenuIfOpen(), 0);

    qs("#neoMCSearch")?.focus();
  }

  function closeModCenter() {
    overlay.classList.remove("open");
    state.open = false;

    // Make sure we aren't leaving the game in a "menu open but empty" state
    closeVanillaMenuIfOpen();
  }

  NEO.openModCenter = openModCenter;
  NEO.closeModCenter = closeModCenter;

  // ---------- rendering ----------
  function setTab(tab) {
    state.tab = tab;
    qsa(".neoTab", overlay).forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    renderAll();
  }

  function renderInstalled(panel) {
    const lib = readLibrary();
    const q = state.search.trim().toLowerCase();

    const filtered = q ? lib.filter(x => x.id.toLowerCase().includes(q)) : lib;
    qs("#neoMCRTitle").textContent = "Installed Mods";
    qs("#neoMCRSub").textContent = q ? `Showing ${filtered.length}/${lib.length}` : `${lib.length} saved`;

    if (!filtered.length) {
      panel.innerHTML = `
        <div class="neoCard">
          <h3>No mods found</h3>
          <p>${lib.length ? "Try another search." : "Go to Add to put mods in your library."}</p>
        </div>
      `;
      return;
    }

    panel.innerHTML = "";
    for (const item of filtered) {
      const row = document.createElement("div");
      row.className = "neoModItem";
      row.innerHTML = `
        <div class="neoGrow neoModName">
          <b title="${item.id.replace(/"/g, "&quot;")}">${item.id}</b>
          <span>${item.id.startsWith("http") ? "URL mod" : "File mod"}</span>
        </div>

        <label class="neoToggle" title="Disable keeps it saved (reload to apply)">
          <input type="checkbox" ${item.enabled ? "checked" : ""} data-act="toggle" data-id="${item.id.replace(/"/g, "&quot;")}" />
          <span style="color:rgba(255,255,255,.85); font-size:12px;">Enabled</span>
        </label>

        <button class="neoBtn" data-act="copy" data-id="${item.id.replace(/"/g, "&quot;")}">Copy</button>
        <button class="neoBtn danger" data-act="remove" data-id="${item.id.replace(/"/g, "&quot;")}">Remove</button>
      `;
      panel.appendChild(row);
    }

    // Actions
    qsa("[data-act]", panel).forEach(el => {
      on(el, "click", async (e) => {
        const act = el.dataset.act;
        const id = el.dataset.id || "";
        if (!id) return;

        if (act === "copy") {
          try { await navigator.clipboard.writeText(id); } catch {}
          return;
        }
        if (act === "remove") {
          const lib2 = readLibrary().filter(x => x.id !== id);
          writeLibrary(lib2);
          applyLibraryToEnabled();
          renderAll();
          return;
        }
      });
    });

    // Toggle checkboxes
    qsa('input[data-act="toggle"]', panel).forEach(chk => {
      on(chk, "change", () => {
        const id = chk.dataset.id;
        const lib2 = readLibrary().map(x => x.id === id ? { id: x.id, enabled: chk.checked } : x);
        writeLibrary(lib2);
        applyLibraryToEnabled();
        qs("#neoMCFooter").textContent = "Changed. Reload to apply.";
      });
    });
  }

  function renderAdd(panel) {
    qs("#neoMCRTitle").textContent = "Add Mods";
    qs("#neoMCRSub").textContent = "Paste URLs/filenames; use ; for multiple";

    panel.innerHTML = `
      <div class="neoCard">
        <h3>Add to library</h3>
        <p>Mods stay saved even when disabled.</p>
        <textarea class="neoInput" id="neoMCAddBox" rows="6" style="resize:vertical; min-height:140px;" placeholder="example.js; https://.../mod.js"></textarea>
        <div class="neoRow" style="margin-top:10px;">
          <button class="neoBtn primary" id="neoMCAddBtn">Add</button>
          <button class="neoBtn primary" id="neoMCAddReloadBtn">Add + Reload</button>
          <button class="neoBtn" id="neoMCClearAdd">Clear</button>
        </div>
      </div>
    `;

    const box = qs("#neoMCAddBox");
    const add = qs("#neoMCAddBtn");
    const addR = qs("#neoMCAddReloadBtn");
    const clear = qs("#neoMCClearAdd");

    const doAdd = (reload) => {
      const incoming = normalizeMods(box.value).filter(looksLikeModString);
      if (!incoming.length) return;

      const lib = readLibrary();
      const map = new Map(lib.map(x => [x.id, x.enabled]));
      for (const m of incoming) map.set(m, true);

      // preserve old order, append new
      const out = [];
      const seen = new Set();
      for (const x of lib) { out.push({ id: x.id, enabled: map.get(x.id) ?? x.enabled }); seen.add(x.id); }
      for (const m of incoming) if (!seen.has(m)) out.push({ id: m, enabled: true });

      writeLibrary(out);
      applyLibraryToEnabled();

      box.value = incoming.join("; ");
      qs("#neoMCFooter").textContent = "Added. Reload to apply.";
      if (reload) location.reload();
      else setTab("installed");
    };

    on(add, "click", () => doAdd(false));
    on(addR, "click", () => doAdd(true));
    on(clear, "click", () => (box.value = ""));
  }

  function renderTools(panel) {
    const enabledKey = guessEnabledModsKey();
    const lib = readLibrary();
    const enabled = lib.filter(x => x.enabled).length;

    qs("#neoMCRTitle").textContent = "Tools";
    qs("#neoMCRSub").textContent = "Export/import and storage info";

    panel.innerHTML = `
      <div class="neoCard">
        <h3>Status</h3>
        <p>Enabled storage key: <b style="color:rgba(255,255,255,.92)">${enabledKey}</b></p>
        <p>Library: <b style="color:rgba(255,255,255,.92)">${lib.length}</b> • Enabled: <b style="color:rgba(255,255,255,.92)">${enabled}</b></p>
      </div>

      <div class="neoCard">
        <h3>Export / Import</h3>
        <p>Exports your library as JSON.</p>
        <div class="neoRow" style="margin-top:10px;">
          <button class="neoBtn" id="neoMCExport">Copy export</button>
          <button class="neoBtn" id="neoMCImport">Import from clipboard</button>
        </div>
      </div>

      <div class="neoCard">
        <h3>Danger</h3>
        <div class="neoRow" style="margin-top:10px;">
          <button class="neoBtn danger" id="neoMCClearLib">Clear library</button>
          <button class="neoBtn primary" id="neoMCReload2">Reload</button>
        </div>
        <p style="margin-top:8px;">Clearing library disables everything (needs reload).</p>
      </div>
    `;

    on(qs("#neoMCExport"), "click", async () => {
      try { await navigator.clipboard.writeText(JSON.stringify(readLibrary())); } catch {}
    });

    on(qs("#neoMCImport"), "click", async () => {
      try {
        const txt = await navigator.clipboard.readText();
        const v = JSON.parse(txt);
        if (!Array.isArray(v)) return;
        const lib2 = v
          .filter(x => x && typeof x.id === "string")
          .map(x => ({ id: x.id.trim(), enabled: !!x.enabled }))
          .filter(x => x.id && looksLikeModString(x.id));
        writeLibrary(lib2);
        applyLibraryToEnabled();
        qs("#neoMCFooter").textContent = "Imported. Reload to apply.";
        renderAll();
      } catch {}
    });

    on(qs("#neoMCClearLib"), "click", () => {
      writeLibrary([]);
      applyLibraryToEnabled();
      qs("#neoMCFooter").textContent = "Cleared. Reload to apply.";
      renderAll();
    });

    on(qs("#neoMCReload2"), "click", () => location.reload());
  }

  function renderAll() {
    const panel = qs("#neoMCRPanel");
    if (!panel) return;

    qs("#neoMCFooter").textContent = "Tip: Disable keeps it saved • Reload applies changes";

    if (state.tab === "installed") renderInstalled(panel);
    if (state.tab === "add") renderAdd(panel);
    if (state.tab === "tools") renderTools(panel);
  }

  // ---------- wire UI events ----------
  on(qs("#neoMCClose"), "click", closeModCenter);
  on(qs("#neoMCClose2"), "click", closeModCenter);

  on(overlay, "click", (e) => {
    if (e.target === overlay) closeModCenter();
  });

  on(qs("#neoMCTabs"), "click", (e) => {
    const tab = e.target?.dataset?.tab;
    if (tab) setTab(tab);
  });

  on(qs("#neoMCSearch"), "input", (e) => {
    state.search = e.target.value || "";
    if (state.tab !== "installed") setTab("installed");
    else renderAll();
  });

  on(qs("#neoMCReload"), "click", () => location.reload());

  on(qs("#neoMCBigger"), "click", () => {
    state.scale = clamp(state.scale + 0.05, 0.85, 1.35);
    applyScale();
    renderAll();
  });
  on(qs("#neoMCSmaller"), "click", () => {
    state.scale = clamp(state.scale - 0.05, 0.85, 1.35);
    applyScale();
    renderAll();
  });

  on(qs("#neoMCEnableAll"), "click", () => {
    const lib = readLibrary().map(x => ({ id: x.id, enabled: true }));
    writeLibrary(lib);
    applyLibraryToEnabled();
    qs("#neoMCFooter").textContent = "Enabled all. Reload to apply.";
    renderAll();
  });

  on(qs("#neoMCDisableAll"), "click", () => {
    const lib = readLibrary().map(x => ({ id: x.id, enabled: false }));
    writeLibrary(lib);
    applyLibraryToEnabled();
    qs("#neoMCFooter").textContent = "Disabled all. Reload to apply.";
    renderAll();
  });

  on(qs("#neoMCRemoveDisabled"), "click", () => {
    const lib = readLibrary().filter(x => x.enabled);
    writeLibrary(lib);
    applyLibraryToEnabled();
    qs("#neoMCFooter").textContent = "Removed disabled from library. Reload to apply.";
    renderAll();
  });

  on(qs("#neoMCHelp"), "click", () => {
    alert("Hotkeys:\n- Ctrl+Shift+M (Cmd+Shift+M on Mac): open Mod Center\n- Esc: close\n\nNotes:\n- Disable keeps mods saved.\n- Reload applies changes.");
  });

  // Esc closes when open
  on(document, "keydown", (e) => {
    if (e.key === "Escape" && state.open) {
      e.preventDefault();
      closeModCenter();
    }
  }, { passive: false });

  // Open hotkey (avoid Ctrl+M because browsers / OS steal it)
  on(document, "keydown", (e) => {
    const isMac = navigator.platform.toLowerCase().includes("mac");
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
    if (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "m") {
      e.preventDefault();
      openModCenter();
    }
  }, { passive: false });

  // ---------- intercept Mods button (NO auto-open at startup) ----------
  function wireModsButton() {
    const roots = [qs("#toolControls"), qs("#controls"), document.body].filter(Boolean);
    let btn = null;

    for (const root of roots) {
      const candidates = qsa("button, a", root);
      btn = candidates.find(el => safeText(el) === "Mods" || (el.title && el.title.toLowerCase().includes("mod")));
      if (btn) break;
    }
    if (!btn || btn.__neoMCwired) return;
    btn.__neoMCwired = true;

    // capture phase so vanilla won’t open
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      openModCenter();
    }, true);
  }

  // keep wiring (game rebuilds toolbar sometimes)
  setInterval(wireModsButton, 700);

  // initial sync once
  syncLibraryFromEnabled();
})();
