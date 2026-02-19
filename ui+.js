// Neo Mod Center + Settings QoL + Info Bar (no overlap)
// Drop-in mod file for Sandboxels
(() => {
  "use strict";

  // ---- tiny helpers ----
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const safeText = (el) => (el && (el.textContent || "")).trim();
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);
  const cssEscape = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&"));

  const NEO = (window.NEOUI = window.NEOUI || {});
  if (NEO.__neo_modcenter_loaded) return;
  NEO.__neo_modcenter_loaded = true;

  const STORE = {
    keyMods: "neo_modcenter_mods_key_guess",
    keyInfoBar: "neo_infobar_enabled",
    keyScale: "neo_ui_scale",
  };

  const settings = {
    infoBar: localStorage.getItem(STORE.keyInfoBar) !== "0",
    scale: Number(localStorage.getItem(STORE.keyScale) || "1") || 1,
  };

  // ---- CSS (scoped + safe z-index layering) ----
  const style = document.createElement("style");
  style.id = "neoModCenterStyles";
  style.textContent = `
    :root{
      --neo-z-infobar: 999000;
      --neo-z-panels: 999850;
      --neo-z-modcenter: 999920;
      --neo-radius: 16px;
      --neo-gap: 12px;
      --neo-pad: 14px;
      --neo-line: rgba(255,255,255,.12);
      --neo-bg: rgba(20,20,24,.88);
      --neo-bg2: rgba(30,30,36,.92);
      --neo-txt: rgba(255,255,255,.92);
      --neo-txt2: rgba(255,255,255,.72);
      --neo-accent: rgba(120,170,255,.95);
      --neo-danger: rgba(255,90,90,.95);
      --neo-shadow: 0 20px 60px rgba(0,0,0,.55);
      --neo-scale: 1;
    }

    /* ===== Mod Center Overlay ===== */
    #neoModCenterOverlay{
      position: fixed;
      inset: 0;
      z-index: var(--neo-z-modcenter);
      display: none;
      align-items: stretch;
      justify-content: stretch;
      background: rgba(0,0,0,.55);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      color: var(--neo-txt);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      transform: translateZ(0);
    }

    #neoModCenterOverlay.neo-open{ display: flex; }

    .neoMC{
      width: 100%;
      height: 100%;
      background: linear-gradient(180deg, rgba(18,18,22,.92), rgba(10,10,12,.88));
      border: 1px solid var(--neo-line);
      box-shadow: var(--neo-shadow);
      display: flex;
      overflow: hidden;
      font-size: calc(14px * var(--neo-scale));
    }

    .neoMC__left{
      width: min(360px, 42vw);
      min-width: 270px;
      border-right: 1px solid var(--neo-line);
      background: rgba(14,14,18,.82);
      display: flex;
      flex-direction: column;
    }

    .neoMC__right{
      flex: 1;
      display: flex;
      flex-direction: column;
      background: rgba(18,18,22,.75);
      min-width: 0;
    }

    .neoMC__top{
      display: flex;
      gap: var(--neo-gap);
      align-items: center;
      padding: var(--neo-pad);
      border-bottom: 1px solid var(--neo-line);
      background: rgba(10,10,12,.55);
    }

    .neoMC__title{
      display:flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .neoMC__title b{
      font-size: calc(16px * var(--neo-scale));
      letter-spacing: .2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .neoMC__title span{
      color: var(--neo-txt2);
      font-size: calc(12px * var(--neo-scale));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .neoBtn{
      border: 1px solid var(--neo-line);
      background: rgba(255,255,255,.06);
      color: var(--neo-txt);
      padding: 10px 12px;
      border-radius: 12px;
      cursor: pointer;
      user-select: none;
      font-size: calc(13px * var(--neo-scale));
      line-height: 1;
    }
    .neoBtn:hover{ background: rgba(255,255,255,.10); }
    .neoBtn:active{ transform: translateY(1px); }
    .neoBtn.neoPrimary{ border-color: rgba(120,170,255,.4); background: rgba(120,170,255,.18); }
    .neoBtn.neoDanger{ border-color: rgba(255,90,90,.35); background: rgba(255,90,90,.16); }
    .neoBtn.neoGhost{ background: transparent; }

    .neoRow{ display:flex; gap: var(--neo-gap); align-items:center; min-width: 0; }
    .neoGrow{ flex: 1; min-width: 0; }
    .neoSpacer{ flex: 1; }

    .neoInput{
      width: 100%;
      border: 1px solid var(--neo-line);
      background: rgba(0,0,0,.22);
      color: var(--neo-txt);
      padding: 10px 12px;
      border-radius: 12px;
      outline: none;
      font-size: calc(13px * var(--neo-scale));
    }
    .neoInput::placeholder{ color: rgba(255,255,255,.45); }

    .neoTabs{
      display:flex;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--neo-line);
    }

    .neoTab{
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid var(--neo-line);
      background: rgba(255,255,255,.06);
      cursor: pointer;
      font-size: calc(13px * var(--neo-scale));
    }
    .neoTab.neoActive{
      border-color: rgba(120,170,255,.45);
      background: rgba(120,170,255,.18);
    }

    .neoPanel{
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: var(--neo-pad);
      overscroll-behavior: contain;
    }

    .neoCard{
      border: 1px solid var(--neo-line);
      background: rgba(255,255,255,.05);
      border-radius: var(--neo-radius);
      padding: 12px;
      margin-bottom: 10px;
    }

    .neoCard h3{
      margin: 0 0 6px 0;
      font-size: calc(14px * var(--neo-scale));
    }
    .neoCard p{ margin: 0; color: var(--neo-txt2); font-size: calc(12px * var(--neo-scale)); }

    .neoModItem{
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 10px;
      border: 1px solid var(--neo-line);
      background: rgba(0,0,0,.18);
      border-radius: 14px;
      margin-bottom: 10px;
    }

    .neoModName{
      min-width: 0;
      display:flex;
      flex-direction: column;
      gap: 2px;
    }
    .neoModName b{
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: calc(13px * var(--neo-scale));
    }
    .neoModName span{
      color: var(--neo-txt2);
      font-size: calc(12px * var(--neo-scale));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .neoBadge{
      font-size: calc(11px * var(--neo-scale));
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--neo-line);
      background: rgba(255,255,255,.06);
      color: var(--neo-txt2);
      white-space: nowrap;
    }
    .neoBadge.neoOk{ border-color: rgba(80,220,140,.35); background: rgba(80,220,140,.12); color: rgba(200,255,225,.9); }
    .neoBadge.neoWarn{ border-color: rgba(255,200,90,.35); background: rgba(255,200,90,.12); color: rgba(255,240,210,.92); }

    .neoFooter{
      padding: var(--neo-pad);
      border-top: 1px solid var(--neo-line);
      display:flex;
      gap: var(--neo-gap);
      align-items: center;
      background: rgba(10,10,12,.45);
    }

    /* ===== Info Bar ===== */
    #neoInfoBar{
      position: fixed;
      z-index: var(--neo-z-infobar);
      right: 10px;
      top: 10px;
      max-width: min(520px, 92vw);
      pointer-events: none;
      display: none;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color: var(--neo-txt);
      font-size: 12px;
      opacity: .92;
    }
    #neoInfoBar.neo-on{ display: block; }
    #neoInfoBar .neoInfoPill{
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
    }
    #neoInfoBar b{ color: rgba(255,255,255,.92); font-weight: 700; }
    #neoInfoBar span{ color: rgba(255,255,255,.72); }

    /* ===== Settings QoL: make menu screens scrollable + readable ===== */
    .neoScrollFix{
      max-height: min(86vh, 900px) !important;
      overflow: auto !important;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
    }
    .neoStickyTop{
      position: sticky;
      top: 0;
      z-index: 2;
      background: rgba(0,0,0,.18);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(255,255,255,.12);
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
  `;
  document.head.appendChild(style);

  // ---- UI scale ----
  function applyScale() {
    document.documentElement.style.setProperty("--neo-scale", String(clamp(settings.scale, 0.85, 1.35)));
  }
  applyScale();

  // ---- Find / close other panels so nothing overlaps ----
  function closeOtherPanels() {
    // If your UI mod exposes hooks, use them
    try { NEO.closeElements && NEO.closeElements(); } catch {}
    try { NEO.closeSettings && NEO.closeSettings(); } catch {}

    // Otherwise: best-effort hide known ids/classes without breaking the game
    const ids = [
      "neo32ElDrawer","neo31ElDrawer","neoElDrawer","neoElementsDrawer",
      "neo32Settings","neo31Settings","neoSettingsDrawer","neoOverhaulSettings"
    ];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.classList.remove("neo-open");
    }
  }

  // ---- Mods storage (robust guesses) ----
  function isModsArray(v) {
    return Array.isArray(v) && v.length >= 0 && v.every(x => typeof x === "string");
  }
  function looksLikeModString(s) {
    if (typeof s !== "string") return false;
    const t = s.trim().toLowerCase();
    return t.endsWith(".js") || t.startsWith("http://") || t.startsWith("https://") || t.includes(".js?");
  }

  function guessModsKey() {
    const cached = localStorage.getItem(STORE.keyMods);
    if (cached && localStorage.getItem(cached) != null) return cached;

    const candidates = ["enabledMods","mods","modList","modsEnabled","enabled_mods","enabled-mods","sb_mods","sbmods"];
    for (const k of candidates) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const v = JSON.parse(raw);
        if (isModsArray(v) && v.every(looksLikeModString)) {
          localStorage.setItem(STORE.keyMods, k);
          return k;
        }
      } catch {}
      // sometimes stored as ; separated string
      if (typeof raw === "string" && raw.includes(".js")) {
        const parts = raw.split(";").map(x => x.trim()).filter(Boolean);
        if (parts.length && parts.every(looksLikeModString)) {
          localStorage.setItem(STORE.keyMods, k);
          return k;
        }
      }
    }

    // scan everything
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      if (!raw.includes(".js") && !raw.includes("http")) continue;
      try {
        const v = JSON.parse(raw);
        if (isModsArray(v) && v.some(looksLikeModString)) {
          localStorage.setItem(STORE.keyMods, k);
          return k;
        }
      } catch {
        const parts = raw.split(";").map(x => x.trim()).filter(Boolean);
        if (parts.length && parts.every(looksLikeModString)) {
          localStorage.setItem(STORE.keyMods, k);
          return k;
        }
      }
    }
    return null;
  }

  function readEnabledMods() {
    // prefer game globals if available
    if (Array.isArray(window.enabledMods)) return window.enabledMods.slice();

    const k = guessModsKey();
    if (!k) return [];
    const raw = localStorage.getItem(k);
    if (!raw) return [];
    try {
      const v = JSON.parse(raw);
      if (isModsArray(v)) return v.slice();
    } catch {}
    return raw.split(";").map(x => x.trim()).filter(Boolean);
  }

  function writeEnabledMods(mods) {
    const clean = Array.from(new Set(mods.map(s => s.trim()).filter(Boolean)));
    if (Array.isArray(window.enabledMods)) window.enabledMods = clean.slice();

    const k = guessModsKey() || "enabledMods";
    try {
      localStorage.setItem(k, JSON.stringify(clean));
      localStorage.setItem(STORE.keyMods, k);
      return k;
    } catch {
      // fallback
      localStorage.setItem(k, clean.join(";"));
      localStorage.setItem(STORE.keyMods, k);
      return k;
    }
  }

  function loadedModsSet() {
    // Sandboxels has loadedMods in newer versions :contentReference[oaicite:1]{index=1}
    const arr = Array.isArray(window.loadedMods) ? window.loadedMods : [];
    return new Set(arr.map(s => String(s)));
  }

  // ---- Mod Center DOM ----
  const overlay = document.createElement("div");
  overlay.id = "neoModCenterOverlay";
  overlay.innerHTML = `
    <div class="neoMC" role="dialog" aria-modal="true" aria-label="Neo Mod Center">
      <div class="neoMC__left">
        <div class="neoMC__top">
          <div class="neoMC__title neoGrow">
            <b>Neo Mod Center</b>
            <span>Big, scrollable, clickable — no weird stretching</span>
          </div>
          <button class="neoBtn neoGhost" id="neoMC_Close" title="Close (Esc)">✕</button>
        </div>

        <div class="neoTabs" id="neoMC_Tabs">
          <div class="neoTab neoActive" data-tab="installed">Installed</div>
          <div class="neoTab" data-tab="add">Add</div>
          <div class="neoTab" data-tab="tools">Tools</div>
        </div>

        <div class="neoPanel" id="neoMC_LeftPanel">
          <div class="neoCard">
            <h3>Search</h3>
            <input class="neoInput" id="neoMC_Search" placeholder="Search installed mods..." />
          </div>

          <div class="neoCard">
            <h3>UI Size</h3>
            <div class="neoRow">
              <button class="neoBtn" id="neoMC_Smaller">A−</button>
              <button class="neoBtn" id="neoMC_Bigger">A+</button>
              <div class="neoSpacer"></div>
              <label class="neoRow" style="gap:8px;">
                <input type="checkbox" id="neoMC_InfoToggle" />
                <span style="color:rgba(255,255,255,.78); font-size:12px;">Info bar</span>
              </label>
            </div>
          </div>

          <div class="neoCard">
            <h3>Quick actions</h3>
            <div class="neoRow" style="flex-wrap:wrap;">
              <button class="neoBtn neoPrimary" id="neoMC_Reload">Reload</button>
              <button class="neoBtn" id="neoMC_CopyAll">Copy list</button>
              <button class="neoBtn neoDanger" id="neoMC_RemoveAll">Remove all</button>
            </div>
            <p style="margin-top:8px;">Reload is needed after adding/removing mods.</p>
          </div>

          <div class="neoCard">
            <h3>Official mod list</h3>
            <div class="neoRow" style="flex-wrap:wrap;">
              <button class="neoBtn" id="neoMC_OpenList">Open mod list</button>
            </div>
          </div>

        </div>
      </div>

      <div class="neoMC__right">
        <div class="neoMC__top">
          <div class="neoGrow" style="min-width:0;">
            <b id="neoMC_RightTitle">Installed Mods</b>
            <span id="neoMC_RightSub" style="display:block; color:rgba(255,255,255,.72); font-size:12px; margin-top:2px;">
              Manage what loads on refresh
            </span>
          </div>
          <button class="neoBtn" id="neoMC_Help">Hotkeys</button>
        </div>

        <div class="neoPanel" id="neoMC_RightPanel"></div>

        <div class="neoFooter">
          <span style="color:rgba(255,255,255,.65); font-size:12px;" id="neoMC_FooterText"></span>
          <div class="neoSpacer"></div>
          <button class="neoBtn" id="neoMC_Close2">Close</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // ---- Info Bar ----
  const info = document.createElement("div");
  info.id = "neoInfoBar";
  info.innerHTML = `<div class="neoInfoPill" id="neoInfoPill"></div>`;
  document.body.appendChild(info);

  function getToolbarBottom() {
    const controls = qs("#controls") || qs(".controls") || qs("[id*='control']");
    if (!controls) return 10;
    const r = controls.getBoundingClientRect();
    return Math.round(r.bottom) + 10;
  }

  function readVar(...names) {
    for (const n of names) {
      if (n in window) return window[n];
    }
    return undefined;
  }

  function renderInfoBar() {
    if (!settings.infoBar) {
      info.classList.remove("neo-on");
      return;
    }
    info.classList.add("neo-on");
    info.style.top = `${getToolbarBottom()}px`;

    const elName = readVar("currentElement","element","selectedElement");
    const size = readVar("mouseSize","cursorSize","brushSize");
    const replace = readVar("replaceMode","replace","replacing");
    const paused = readVar("paused","isPaused","pause");
    const tps = readVar("tps","TPS","tickSpeed");

    const pill = qs("#neoInfoPill", info);
    pill.innerHTML = `
      <span><b>Elem:</b> ${elName ?? "-"}</span>
      <span><b>Size:</b> ${size ?? "-"}</span>
      <span><b>Replace:</b> ${(typeof replace === "boolean") ? (replace ? "On" : "Off") : (replace ?? "-")}</span>
      <span><b>Paused:</b> ${(typeof paused === "boolean") ? (paused ? "Yes" : "No") : (paused ?? "-")}</span>
      <span><b>TPS:</b> ${tps ?? "-"}</span>
    `;
  }

  setInterval(renderInfoBar, 250);

  // ---- Settings QoL: scroll + search inside settings screen ----
  function enhanceSettingsScreen(screen) {
    if (!screen || screen.__neoSettingsEnhanced) return;
    screen.__neoSettingsEnhanced = true;

    // make it scrollable and readable
    screen.classList.add("neoScrollFix");

    // sticky header wrapper (best-effort)
    const header = document.createElement("div");
    header.className = "neoStickyTop";
    header.innerHTML = `
      <div style="display:flex; gap:10px; align-items:center; padding:10px 0;">
        <input class="neoInput" id="neoSettingsSearch_${Math.random().toString(16).slice(2)}" placeholder="Search settings..." />
        <button class="neoBtn" type="button">Clear</button>
      </div>
    `;
    // Insert at top without breaking layout
    screen.prepend(header);

    const input = qs("input.neoInput", header);
    const clearBtn = qs("button.neoBtn", header);

    function allSettingsButtons() {
      // grab likely clickable controls inside settings menu
      return qsa("button, input, select, a", screen)
        .filter(el => el !== input && el !== clearBtn && !header.contains(el));
    }

    function doFilter() {
      const q = (input.value || "").trim().toLowerCase();
      const els = allSettingsButtons();
      if (!q) {
        els.forEach(el => (el.style.display = ""));
        return;
      }
      els.forEach(el => {
        const t = (el.getAttribute("aria-label") || el.title || safeText(el) || "").toLowerCase();
        el.style.display = t.includes(q) ? "" : "none";
      });
    }

    on(input, "input", doFilter);
    on(clearBtn, "click", () => { input.value = ""; doFilter(); });
  }

  function detectSettingsOpen() {
    // best-effort: look for a big menu/prompt containing "Settings" + common setting words
    const candidates = qsa("div, section").filter(el => el && el.offsetParent !== null);
    for (const el of candidates) {
      const t = safeText(el);
      if (!t) continue;
      if (t.includes("Settings") && (t.includes("Language") || t.includes("Background") || t.includes("Canvas Size"))) {
        enhanceSettingsScreen(el);
        return;
      }
    }
  }

  // ---- Mod Center logic ----
  let activeTab = "installed";
  let searchQuery = "";

  function openModCenter() {
    closeOtherPanels();
    overlay.classList.add("neo-open");
    renderAll();
    // focus search
    const s = qs("#neoMC_Search", overlay);
    s && s.focus();
  }

  function closeModCenter() {
    overlay.classList.remove("neo-open");
  }

  function setTab(tab) {
    activeTab = tab;
    qsa(".neoTab", overlay).forEach(t => t.classList.toggle("neoActive", t.dataset.tab === tab));
    renderAll();
  }

  function normalizeInputMods(str) {
    // supports semicolon-separated input :contentReference[oaicite:2]{index=2}
    return String(str || "")
      .split(";")
      .map(s => s.trim())
      .filter(Boolean);
  }

  function renderInstalled(panel) {
    const mods = readEnabledMods();
    const loaded = loadedModsSet();

    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? mods.filter(m => m.toLowerCase().includes(q))
      : mods;

    const count = mods.length;
    const countFiltered = filtered.length;

    qs("#neoMC_RightTitle", overlay).textContent = "Installed Mods";
    qs("#neoMC_RightSub", overlay).textContent =
      q ? `Showing ${countFiltered}/${count} mods` : `${count} mods enabled`;

    if (!filtered.length) {
      panel.innerHTML = `
        <div class="neoCard">
          <h3>No mods found</h3>
          <p>${mods.length ? "Try a different search." : "Add a mod in the Add tab."}</p>
        </div>
      `;
      return;
    }

    panel.innerHTML = "";
    filtered.forEach((m, idx) => {
      const isLoaded = loaded.has(m) || loaded.has(m.split("/").pop() || m);
      const row = document.createElement("div");
      row.className = "neoModItem";
      row.innerHTML = `
        <div class="neoGrow neoModName">
          <b title="${m.replace(/"/g, "&quot;")}">${m}</b>
          <span>${m.startsWith("http") ? "URL mod" : "File mod"}</span>
        </div>
        <span class="neoBadge ${isLoaded ? "neoOk" : "neoWarn"}">${isLoaded ? "Loaded" : "Reload needed"}</span>
        <button class="neoBtn" data-act="copy" data-mod="${m.replace(/"/g, "&quot;")}">Copy</button>
        <button class="neoBtn neoDanger" data-act="remove" data-mod="${m.replace(/"/g, "&quot;")}">Remove</button>
      `;
      panel.appendChild(row);
    });

    // actions
    qsa("button[data-act]", panel).forEach(btn => {
      on(btn, "click", () => {
        const act = btn.dataset.act;
        const mod = btn.dataset.mod || "";
        if (!mod) return;

        if (act === "copy") {
          navigator.clipboard?.writeText(mod).catch(() => {});
        }
        if (act === "remove") {
          const cur = readEnabledMods().filter(x => x !== mod);
          writeEnabledMods(cur);
          renderAll();
        }
      });
    });
  }

  function renderAdd(panel) {
    qs("#neoMC_RightTitle", overlay).textContent = "Add Mods";
    qs("#neoMC_RightSub", overlay).textContent = "Paste filenames or URLs (use ; for multiple)";

    panel.innerHTML = `
      <div class="neoCard">
        <h3>Add one or more mods</h3>
        <p>Examples: <span style="color:rgba(255,255,255,.9)">chem.js</span> or <span style="color:rgba(255,255,255,.9)">https://.../mod.js</span></p>
        <textarea class="neoInput" id="neoMC_AddBox" rows="6" style="resize:vertical; min-height:120px;" placeholder="mods separated by ;"></textarea>
        <div class="neoRow" style="margin-top:10px; flex-wrap:wrap;">
          <button class="neoBtn neoPrimary" id="neoMC_AddBtn">Add</button>
          <button class="neoBtn neoPrimary" id="neoMC_AddReloadBtn">Add + Reload</button>
          <button class="neoBtn" id="neoMC_ClearAdd">Clear</button>
        </div>
      </div>

      <div class="neoCard">
        <h3>Tip</h3>
        <p>If a mod still doesn’t show as “Loaded”, hit Reload. Some mods only register after refresh.</p>
      </div>
    `;

    const box = qs("#neoMC_AddBox", panel);
    const add = qs("#neoMC_AddBtn", panel);
    const addReload = qs("#neoMC_AddReloadBtn", panel);
    const clear = qs("#neoMC_ClearAdd", panel);

    const doAdd = (reload) => {
      const incoming = normalizeInputMods(box.value);
      const valid = incoming.filter(looksLikeModString);

      const cur = readEnabledMods();
      const merged = Array.from(new Set(cur.concat(valid)));

      writeEnabledMods(merged);
      box.value = valid.length ? valid.join("; ") : box.value;
      renderAll();

      if (reload) location.reload();
    };

    on(add, "click", () => doAdd(false));
    on(addReload, "click", () => doAdd(true));
    on(clear, "click", () => (box.value = ""));
  }

  function renderTools(panel) {
    qs("#neoMC_RightTitle", overlay).textContent = "Tools";
    qs("#neoMC_RightSub", overlay).textContent = "Backup, restore, and sanity controls";

    const mods = readEnabledMods();
    const storageKey = guessModsKey() || "(unknown yet)";

    panel.innerHTML = `
      <div class="neoCard">
        <h3>Storage</h3>
        <p>Mods key: <span style="color:rgba(255,255,255,.9)">${storageKey}</span></p>
        <p>Enabled mods: <span style="color:rgba(255,255,255,.9)">${mods.length}</span></p>
      </div>

      <div class="neoCard">
        <h3>Export / Import</h3>
        <p>Export copies a ; separated list you can paste back later.</p>
        <div class="neoRow" style="flex-wrap:wrap; margin-top:10px;">
          <button class="neoBtn" id="neoMC_Export">Copy export</button>
          <button class="neoBtn" id="neoMC_Import">Import from clipboard</button>
        </div>
      </div>

      <div class="neoCard">
        <h3>Danger zone</h3>
        <div class="neoRow" style="flex-wrap:wrap; margin-top:10px;">
          <button class="neoBtn neoDanger" id="neoMC_ClearAll">Disable all mods</button>
          <button class="neoBtn neoPrimary" id="neoMC_Reload2">Reload</button>
        </div>
        <p style="margin-top:8px;">Disable all = clears enabled list, then you should Reload.</p>
      </div>
    `;

    on(qs("#neoMC_Export", panel), "click", () => {
      const list = readEnabledMods().join("; ");
      navigator.clipboard?.writeText(list).catch(() => {});
    });

    on(qs("#neoMC_Import", panel), "click", async () => {
      try {
        const text = await navigator.clipboard.readText();
        const incoming = normalizeInputMods(text).filter(looksLikeModString);
        if (!incoming.length) return;
        writeEnabledMods(incoming);
        renderAll();
      } catch {}
    });

    on(qs("#neoMC_ClearAll", panel), "click", () => {
      writeEnabledMods([]);
      renderAll();
    });

    on(qs("#neoMC_Reload2", panel), "click", () => location.reload());
  }

  function renderAll() {
    // left controls
    qs("#neoMC_InfoToggle", overlay).checked = !!settings.infoBar;
    qs("#neoMC_FooterText", overlay).textContent = `Tip: Ctrl+M opens Mod Center • Esc closes`;

    // right panel render
    const right = qs("#neoMC_RightPanel", overlay);
    if (!right) return;

    if (activeTab === "installed") renderInstalled(right);
    if (activeTab === "add") renderAdd(right);
    if (activeTab === "tools") renderTools(right);
  }

  // ---- Wire overlay controls ----
  on(qs("#neoMC_Close", overlay), "click", closeModCenter);
  on(qs("#neoMC_Close2", overlay), "click", closeModCenter);

  on(overlay, "click", (e) => {
    if (e.target === overlay) closeModCenter();
  });

  on(document, "keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("neo-open")) {
      e.preventDefault();
      closeModCenter();
      return;
    }
    // Ctrl+M / Cmd+M open
    const isMac = navigator.platform.toLowerCase().includes("mac");
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "m") {
      e.preventDefault();
      openModCenter();
    }
  });

  on(qs("#neoMC_Tabs", overlay), "click", (e) => {
    const tab = e.target && e.target.dataset && e.target.dataset.tab;
    if (tab) setTab(tab);
  });

  on(qs("#neoMC_Search", overlay), "input", (e) => {
    searchQuery = e.target.value || "";
    if (activeTab !== "installed") setTab("installed");
    else renderAll();
  });

  on(qs("#neoMC_Reload", overlay), "click", () => location.reload());
  on(qs("#neoMC_CopyAll", overlay), "click", () => {
    const list = readEnabledMods().join("; ");
    navigator.clipboard?.writeText(list).catch(() => {});
  });
  on(qs("#neoMC_RemoveAll", overlay), "click", () => {
    writeEnabledMods([]);
    renderAll();
  });

  on(qs("#neoMC_OpenList", overlay), "click", () => {
    window.open("https://sandboxels.r74n.com/mod-list", "_blank");
  });

  on(qs("#neoMC_Help", overlay), "click", () => {
    alert("Hotkeys:\n- Ctrl+M / Cmd+M: open Mod Center\n- Esc: close\n\nTip: After adding/removing mods, Reload to apply.");
  });

  on(qs("#neoMC_InfoToggle", overlay), "change", (e) => {
    settings.infoBar = !!e.target.checked;
    localStorage.setItem(STORE.keyInfoBar, settings.infoBar ? "1" : "0");
    renderInfoBar();
  });

  on(qs("#neoMC_Bigger", overlay), "click", () => {
    settings.scale = clamp(settings.scale + 0.05, 0.85, 1.35);
    localStorage.setItem(STORE.keyScale, String(settings.scale));
    applyScale();
    renderAll();
  });
  on(qs("#neoMC_Smaller", overlay), "click", () => {
    settings.scale = clamp(settings.scale - 0.05, 0.85, 1.35);
    localStorage.setItem(STORE.keyScale, String(settings.scale));
    applyScale();
    renderAll();
  });

  // ---- Intercept native Mods button (so you don't get the glitchy screen) ----
  function wireModsButton() {
    // try common toolbar containers first
    const roots = [
      qs("#controls"),
      qs("#toolControls"),
      document.body
    ].filter(Boolean);

    let btn = null;
    for (const root of roots) {
      const candidates = qsa("button, a, div", root);
      btn = candidates.find(el => safeText(el) === "Mods" || (el.title && el.title.toLowerCase().includes("mod")));
      if (btn) break;
    }
    if (!btn || btn.__neoWiredMods) return;
    btn.__neoWiredMods = true;

    on(btn, "click", (e) => {
      // stop vanilla screen
      e.preventDefault();
      e.stopPropagation();
      openModCenter();
    }, true);
  }

  // ---- If vanilla mod screen still appears, replace it (best-effort) ----
  function autoReplaceVanillaModScreen() {
    const nodes = qsa("div, section").filter(el => el && el.offsetParent !== null);
    for (const el of nodes) {
      const t = safeText(el);
      if (!t) continue;
      if (t.includes("Enabled Mods") && t.includes("Reload to apply changes")) {
        // hide vanilla and show ours
        el.style.display = "none";
        openModCenter();
        return;
      }
    }
  }

  // keep wiring (Sandboxels rebuilds UI sometimes)
  setInterval(() => {
    wireModsButton();
    detectSettingsOpen();
    autoReplaceVanillaModScreen();
  }, 600);

  // expose for other parts of your overhaul
  NEO.openModCenter = openModCenter;
})();
