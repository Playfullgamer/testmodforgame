/* ui+.js — UI+ Ultra v2.0 (Big + Safe + No black screens)

IMPORTANT ABOUT THE FILE NAME:
- If you load this from a URL and the filename contains "+", use "%2B" in the URL:
  ui%2B.js
Because many parsers treat "+" like a space and the mod won't load.

Features:
- UI+ toolbar button
- Full-screen Mod Center overlay (enable/disable without removing)
- Mod profiles (quick swap sets)
- Import/Export
- Non-overlapping Info HUD (draggable, toggleable)
- Overlay UI scale controls
*/

(() => {
  "use strict";

  // ---------------------------
  // Core helpers
  // ---------------------------
  const UIPlus = (window.UIPlus = window.UIPlus || {});
  if (UIPlus.__ultra_v2_loaded) return;
  UIPlus.__ultra_v2_loaded = true;

  const log = (...a) => console.log("%c[UI+]", "color:#7fb0ff;font-weight:700", ...a);
  const warn = (...a) => console.warn("%c[UI+]", "color:#ffd37f;font-weight:700", ...a);
  const err = (...a) => console.error("%c[UI+]", "color:#ff7f7f;font-weight:700", ...a);

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const safeText = (el) => (el && (el.textContent || "")).trim();

  const STORAGE = {
    // enabled mods key guess is cached
    enabledKeyGuess: "uiplus_enabledMods_key_guess_v1",

    // our library stores mods even if disabled
    library: "uiplus_mod_library_v2",

    // profiles
    profiles: "uiplus_mod_profiles_v2",
    activeProfile: "uiplus_mod_active_profile_v2",

    // ui
    overlayScale: "uiplus_overlay_scale_v2",
    hud: "uiplus_hud_v2",
    prefs: "uiplus_prefs_v2",
  };

  const state = {
    overlayOpen: false,
    tab: "mods",
    modSearch: "",
    modSort: "enabledFirst",
    overlayScale: Number(localStorage.getItem(STORAGE.overlayScale) || "1") || 1,

    hud: {
      enabled: true,
      x: 18,
      y: 74,
      compact: false,
      ...(safeParse(localStorage.getItem(STORAGE.hud)) || {}),
    },

    prefs: {
      // we DO NOT override vanilla Mods button by default (safe)
      hijackModsButton: false,
      ...(safeParse(localStorage.getItem(STORAGE.prefs)) || {}),
    },
  };

  function safeParse(v) {
    try { return JSON.parse(v); } catch { return null; }
  }
  function saveHUD() { localStorage.setItem(STORAGE.hud, JSON.stringify(state.hud)); }
  function savePrefs() { localStorage.setItem(STORAGE.prefs, JSON.stringify(state.prefs)); }
  function saveScale() { localStorage.setItem(STORAGE.overlayScale, String(state.overlayScale)); }

  function looksLikeModString(s) {
    if (typeof s !== "string") return false;
    const t = s.trim().toLowerCase();
    return t.endsWith(".js") || t.includes(".js?") || t.startsWith("http://") || t.startsWith("https://");
  }
  function normalizeMods(str) {
    return String(str || "").split(";").map(s => s.trim()).filter(Boolean);
  }
  function uniq(arr) {
    const out = [];
    const seen = new Set();
    for (const x of arr) {
      const t = String(x || "").trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }

  // ---------------------------
  // Enabled mods (game storage) — robust guess
  // ---------------------------
  function isModsArray(v) {
    return Array.isArray(v) && v.every(x => typeof x === "string");
  }

  function guessEnabledModsKey() {
    const cached = localStorage.getItem(STORAGE.enabledKeyGuess);
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
        if (isModsArray(v) && v.some(looksLikeModString)) {
          localStorage.setItem(STORAGE.enabledKeyGuess, k);
          return k;
        }
      } catch {
        const parts = normalizeMods(raw);
        if (parts.length && parts.some(looksLikeModString)) {
          localStorage.setItem(STORAGE.enabledKeyGuess, k);
          return k;
        }
      }
    }

    // fallback: scan everything
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const raw = localStorage.getItem(k);
      if (!raw || (!raw.includes(".js") && !raw.includes("http"))) continue;

      try {
        const v = JSON.parse(raw);
        if (isModsArray(v) && v.some(looksLikeModString)) {
          localStorage.setItem(STORAGE.enabledKeyGuess, k);
          return k;
        }
      } catch {
        const parts = normalizeMods(raw);
        if (parts.length && parts.some(looksLikeModString)) {
          localStorage.setItem(STORAGE.enabledKeyGuess, k);
          return k;
        }
      }
    }
    // default guess
    localStorage.setItem(STORAGE.enabledKeyGuess, "enabledMods");
    return "enabledMods";
  }

  function readEnabledMods() {
    // some builds also keep a global enabledMods array
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
    const clean = uniq(list);
    if (Array.isArray(window.enabledMods)) window.enabledMods = clean.slice();
    const k = guessEnabledModsKey();
    try {
      localStorage.setItem(k, JSON.stringify(clean));
    } catch {
      localStorage.setItem(k, clean.join(";"));
    }
    return k;
  }

  // ---------------------------
  // Library: store mods even when disabled
  // entry = { id: string, enabled: boolean, addedAt: number, note?: string }
  // ---------------------------
  function readLibrary() {
    const raw = localStorage.getItem(STORAGE.library);
    if (!raw) return [];
    const v = safeParse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter(x => x && typeof x.id === "string")
      .map(x => ({
        id: x.id.trim(),
        enabled: !!x.enabled,
        addedAt: Number(x.addedAt || Date.now()),
        note: typeof x.note === "string" ? x.note : ""
      }))
      .filter(x => x.id);
  }

  function writeLibrary(lib) {
    const out = [];
    const seen = new Set();
    for (const it of lib || []) {
      const id = String(it?.id || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        enabled: !!it.enabled,
        addedAt: Number(it.addedAt || Date.now()),
        note: typeof it.note === "string" ? it.note : ""
      });
    }
    localStorage.setItem(STORAGE.library, JSON.stringify(out));
    return out;
  }

  function syncLibraryFromEnabled() {
    const enabled = new Set(readEnabledMods());
    const lib = readLibrary();
    const map = new Map(lib.map(x => [x.id, x]));

    // ensure enabled mods exist and are marked enabled
    for (const id of enabled) {
      const existing = map.get(id);
      if (existing) existing.enabled = true;
      else map.set(id, { id, enabled: true, addedAt: Date.now(), note: "" });
    }

    // preserve old order then append missing enabled
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
    writeLibrary(out);
  }

  function applyLibraryToEnabled() {
    const lib = readLibrary();
    const enabled = lib.filter(x => x.enabled).map(x => x.id);
    writeEnabledMods(enabled);
  }

  // ---------------------------
  // Profiles
  // profile = { name, mods: [{id, enabled}] }
  // ---------------------------
  function readProfiles() {
    const raw = localStorage.getItem(STORAGE.profiles);
    const v = safeParse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter(p => p && typeof p.name === "string" && Array.isArray(p.mods))
      .map(p => ({
        name: p.name.trim() || "Unnamed",
        mods: p.mods
          .filter(m => m && typeof m.id === "string")
          .map(m => ({ id: m.id.trim(), enabled: !!m.enabled }))
          .filter(m => m.id)
      }));
  }

  function writeProfiles(p) {
    const out = [];
    const seen = new Set();
    for (const prof of p || []) {
      const name = String(prof?.name || "").trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push({ name, mods: (prof.mods || []).map(m => ({ id: String(m.id||"").trim(), enabled: !!m.enabled })).filter(m => m.id) });
    }
    localStorage.setItem(STORAGE.profiles, JSON.stringify(out));
    return out;
  }

  function getActiveProfileName() {
    return (localStorage.getItem(STORAGE.activeProfile) || "").trim();
  }

  function setActiveProfileName(name) {
    localStorage.setItem(STORAGE.activeProfile, String(name || "").trim());
  }

  function saveCurrentAsProfile(name) {
    const lib = readLibrary().map(x => ({ id: x.id, enabled: x.enabled }));
    const profiles = readProfiles().filter(p => p.name !== name);
    profiles.unshift({ name, mods: lib });
    writeProfiles(profiles);
    setActiveProfileName(name);
  }

  function loadProfile(name) {
    const prof = readProfiles().find(p => p.name === name);
    if (!prof) return false;
    // apply to library (keep notes/addedAt if possible)
    const old = readLibrary();
    const oldMap = new Map(old.map(x => [x.id, x]));
    const merged = [];
    for (const m of prof.mods) {
      const prev = oldMap.get(m.id);
      merged.push({
        id: m.id,
        enabled: !!m.enabled,
        addedAt: prev?.addedAt || Date.now(),
        note: prev?.note || ""
      });
    }
    writeLibrary(merged);
    applyLibraryToEnabled();
    setActiveProfileName(name);
    return true;
  }

  // ---------------------------
  // Toasts (tiny notifications)
  // ---------------------------
  function toast(msg, ms = 1600) {
    const wrap = qs("#uiplus_toasts") || (() => {
      const d = document.createElement("div");
      d.id = "uiplus_toasts";
      d.style.cssText = `
        position:fixed;right:18px;bottom:18px;z-index:999999;
        display:flex;flex-direction:column;gap:10px;
        pointer-events:none;
      `;
      document.body.appendChild(d);
      return d;
    })();

    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = `
      pointer-events:none;
      max-width:min(520px,85vw);
      background:rgba(18,18,22,.92);
      border:1px solid rgba(255,255,255,.14);
      color:rgba(255,255,255,.92);
      padding:10px 12px;
      border-radius:14px;
      box-shadow:0 16px 40px rgba(0,0,0,.45);
      font: 600 13px/1.25 system-ui, -apple-system, Segoe UI, Roboto, Arial;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      transform: translateY(6px);
      opacity:0;
      transition: transform .18s ease, opacity .18s ease;
    `;
    wrap.appendChild(t);
    requestAnimationFrame(() => {
      t.style.opacity = "1";
      t.style.transform = "translateY(0)";
    });
    setTimeout(() => {
      t.style.opacity = "0";
      t.style.transform = "translateY(6px)";
      setTimeout(() => t.remove(), 240);
    }, ms);
  }

  // ---------------------------
  // CSS for overlay + hud
  // ---------------------------
  function injectCSS() {
    if (qs("#uiplus_ultra_v2_css")) return;

    const st = document.createElement("style");
    st.id = "uiplus_ultra_v2_css";
    st.textContent = `
:root{
  --uip-z: 999940;
  --uip-line: rgba(255,255,255,.14);
  --uip-bg: rgba(12,12,16,.92);
  --uip-bg2: rgba(20,20,26,.86);
  --uip-txt: rgba(255,255,255,.92);
  --uip-txt2: rgba(255,255,255,.66);
  --uip-radius: 18px;
  --uip-shadow: 0 22px 70px rgba(0,0,0,.60);
  --uip-scale: 1;
}

#uiplus_overlay{
  position:fixed; inset:0;
  z-index: var(--uip-z);
  display:none;
  background: rgba(0,0,0,.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--uip-txt);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}
#uiplus_overlay.open{ display:block; }

#uiplus_panel{
  width: min(1280px, 96vw);
  height: min(88vh, 980px);
  margin: 6vh auto 0 auto;
  background: linear-gradient(180deg, rgba(18,18,24,.94), rgba(8,8,10,.88));
  border: 1px solid var(--uip-line);
  border-radius: var(--uip-radius);
  box-shadow: var(--uip-shadow);
  overflow:hidden;
  display:grid;
  grid-template-columns: minmax(280px, 380px) 1fr;
  font-size: calc(14px * var(--uip-scale));
}

#uiplus_left{
  background: rgba(14,14,18,.84);
  border-right: 1px solid var(--uip-line);
  display:flex; flex-direction:column;
  min-width:0;
}
#uiplus_right{
  background: rgba(18,18,22,.76);
  display:flex; flex-direction:column;
  min-width:0;
}

.uip_top{
  display:flex; align-items:center; gap:12px;
  padding: 14px;
  border-bottom: 1px solid var(--uip-line);
  background: rgba(10,10,12,.55);
}
.uip_title{ display:flex; flex-direction:column; gap:2px; min-width:0; }
.uip_title b{
  font-size: calc(16px * var(--uip-scale));
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.uip_title span{
  color: var(--uip-txt2);
  font-size: calc(12px * var(--uip-scale));
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}

.uip_row{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; min-width:0; }
.uip_grow{ flex:1; min-width:0; }

.uip_btn{
  border:1px solid var(--uip-line);
  background: rgba(255,255,255,.06);
  color: var(--uip-txt);
  padding: 10px 12px;
  border-radius: 12px;
  cursor:pointer;
  user-select:none;
  font-size: calc(13px * var(--uip-scale));
  line-height: 1;
}
.uip_btn:hover{ background: rgba(255,255,255,.10); }
.uip_btn:active{ transform: translateY(1px); }
.uip_btn.primary{ border-color: rgba(120,170,255,.45); background: rgba(120,170,255,.18); }
.uip_btn.danger{ border-color: rgba(255,90,90,.35); background: rgba(255,90,90,.16); }
.uip_btn.ghost{ background: transparent; }

.uip_input, .uip_textarea, .uip_select{
  width:100%;
  border:1px solid var(--uip-line);
  background: rgba(0,0,0,.22);
  color: var(--uip-txt);
  padding: 10px 12px;
  border-radius: 12px;
  outline:none;
  font-size: calc(13px * var(--uip-scale));
}
.uip_textarea{ resize: vertical; min-height: 140px; }
.uip_input::placeholder, .uip_textarea::placeholder{ color: rgba(255,255,255,.45); }

.uip_tabs{
  display:flex; gap:8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--uip-line);
}
.uip_tab{
  padding: 10px 12px;
  border-radius: 12px;
  border:1px solid var(--uip-line);
  background: rgba(255,255,255,.06);
  cursor:pointer;
  font-size: calc(13px * var(--uip-scale));
}
.uip_tab.active{
  border-color: rgba(120,170,255,.45);
  background: rgba(120,170,255,.18);
}

.uip_scroll{
  flex:1; min-height:0;
  overflow:auto;
  padding: 14px;
  overscroll-behavior: contain;
}

.uip_card{
  border:1px solid var(--uip-line);
  background: rgba(255,255,255,.05);
  border-radius: var(--uip-radius);
  padding: 12px;
  margin-bottom: 10px;
}
.uip_card h3{ margin:0 0 6px 0; font-size: calc(14px * var(--uip-scale)); }
.uip_card p{ margin:0; color: var(--uip-txt2); font-size: calc(12px * var(--uip-scale)); }

.uip_item{
  display:flex; align-items:center; gap:10px;
  padding: 10px;
  border:1px solid var(--uip-line);
  background: rgba(0,0,0,.18);
  border-radius: 14px;
  margin-bottom: 10px;
}
.uip_item .name{ min-width:0; display:flex; flex-direction:column; gap:2px; }
.uip_item .name b{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size: calc(13px * var(--uip-scale)); }
.uip_item .name span{ color: var(--uip-txt2); font-size: calc(12px * var(--uip-scale)); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.uip_toggle{
  display:flex; align-items:center; gap:8px;
  border:1px solid var(--uip-line);
  background: rgba(255,255,255,.06);
  border-radius: 999px;
  padding: 8px 10px;
}
.uip_toggle input{ transform: scale(1.05); }

.uip_footer{
  padding: 14px;
  border-top: 1px solid var(--uip-line);
  background: rgba(10,10,12,.45);
  display:flex; gap: 12px; align-items:center;
}

#uiplus_hud{
  position:fixed;
  z-index: 999930;
  left: 18px; top: 74px;
  padding: 10px 12px;
  border-radius: 14px;
  border:1px solid rgba(255,255,255,.14);
  background: rgba(14,14,18,.72);
  color: rgba(255,255,255,.92);
  font: 700 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial;
  box-shadow: 0 14px 40px rgba(0,0,0,.40);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  user-select:none;
}
#uiplus_hud .sub{
  margin-top:6px;
  color: rgba(255,255,255,.68);
  font-weight: 600;
  font-size: 11px;
}
#uiplus_hud.compact{ padding: 8px 10px; border-radius: 12px; }
#uiplus_hud small{ font-weight:600; color: rgba(255,255,255,.70); }
#uiplus_hud .drag{
  display:flex; align-items:center; gap:10px;
}
#uiplus_hud .dot{
  width:8px; height:8px; border-radius:999px;
  background: rgba(120,170,255,.85);
  box-shadow: 0 0 0 4px rgba(120,170,255,.18);
}
#uiplus_hud .btns{
  display:flex; gap:8px; margin-left:auto;
}
#uiplus_hud button{
  pointer-events:auto;
  border:1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  padding: 6px 8px;
  border-radius: 10px;
  cursor:pointer;
  font: 800 11px/1 system-ui, -apple-system, Segoe UI, Roboto, Arial;
}
#uiplus_hud button:hover{ background: rgba(255,255,255,.10); }
    `;
    document.head.appendChild(st);
  }

  function applyOverlayScale() {
    state.overlayScale = clamp(state.overlayScale, 0.85, 1.35);
    document.documentElement.style.setProperty("--uip-scale", String(state.overlayScale));
    saveScale();
  }

  // ---------------------------
  // HUD (non-overlapping, draggable)
  // ---------------------------
  function createHUD() {
    if (qs("#uiplus_hud")) return;

    const hud = document.createElement("div");
    hud.id = "uiplus_hud";
    hud.style.left = `${Number(state.hud.x || 18)}px`;
    hud.style.top = `${Number(state.hud.y || 74)}px`;
    if (state.hud.compact) hud.classList.add("compact");
    if (!state.hud.enabled) hud.style.display = "none";

    hud.innerHTML = `
      <div class="drag">
        <span class="dot"></span>
        <div>
          <div><span id="uiplus_hud_title">UI+ Ready</span> <small id="uiplus_hud_ver">v2.0</small></div>
          <div class="sub" id="uiplus_hud_sub">Mods: <span id="uiplus_hud_mods">?</span> • Key: Ctrl+Shift+U</div>
        </div>
        <div class="btns">
          <button id="uiplus_hud_toggle">Hide</button>
          <button id="uiplus_hud_open">Open</button>
        </div>
      </div>
    `;
    document.body.appendChild(hud);

    // update mods count sometimes
    const update = () => {
      try {
        const enabled = readEnabledMods().length;
        const lib = readLibrary().length;
        qs("#uiplus_hud_mods").textContent = `${enabled}/${lib}`;
      } catch {}
    };
    update();
    setInterval(update, 1400);

    // buttons
    on(qs("#uiplus_hud_open"), "click", () => openOverlay("mods"));
    on(qs("#uiplus_hud_toggle"), "click", () => {
      state.hud.enabled = false;
      saveHUD();
      hud.style.display = "none";
      toast("HUD hidden (re-enable in UI+ → Preferences)");
    });

    // drag
    let dragging = false, ox = 0, oy = 0;
    const dragHandle = qs("#uiplus_hud .drag");
    on(dragHandle, "mousedown", (e) => {
      if (e.target && e.target.tagName === "BUTTON") return;
      dragging = true;
      ox = e.clientX - hud.offsetLeft;
      oy = e.clientY - hud.offsetTop;
      e.preventDefault();
    });
    on(document, "mousemove", (e) => {
      if (!dragging) return;
      const x = clamp(e.clientX - ox, 6, window.innerWidth - hud.offsetWidth - 6);
      const y = clamp(e.clientY - oy, 6, window.innerHeight - hud.offsetHeight - 6);
      hud.style.left = `${x}px`;
      hud.style.top = `${y}px`;
    });
    on(document, "mouseup", () => {
      if (!dragging) return;
      dragging = false;
      state.hud.x = hud.offsetLeft;
      state.hud.y = hud.offsetTop;
      saveHUD();
    });
  }

  // ---------------------------
  // Overlay UI
  // ---------------------------
  function createOverlay() {
    if (qs("#uiplus_overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "uiplus_overlay";
    overlay.innerHTML = `
      <div id="uiplus_panel" role="dialog" aria-modal="true" aria-label="UI+ Ultra">
        <div id="uiplus_left">
          <div class="uip_top">
            <div class="uip_title uip_grow">
              <b>UI+ Ultra</b>
              <span>Mod Center • Profiles • QoL</span>
            </div>
            <button class="uip_btn ghost" id="uiplus_close" title="Close (Esc)">✕</button>
          </div>

          <div class="uip_tabs" id="uiplus_tabs">
            <div class="uip_tab active" data-tab="mods">Mods</div>
            <div class="uip_tab" data-tab="profiles">Profiles</div>
            <div class="uip_tab" data-tab="prefs">Preferences</div>
          </div>

          <div class="uip_scroll" id="uiplus_left_scroll"></div>
        </div>

        <div id="uiplus_right">
          <div class="uip_top">
            <div class="uip_title uip_grow">
              <b id="uiplus_r_title">Mods</b>
              <span id="uiplus_r_sub">Enable/disable without removing</span>
            </div>
            <button class="uip_btn" id="uiplus_help">Hotkeys</button>
          </div>

          <div class="uip_scroll" id="uiplus_right_scroll"></div>

          <div class="uip_footer">
            <span style="color:rgba(255,255,255,.65); font-size:12px;" id="uiplus_footer"></span>
            <div class="uip_grow"></div>
            <button class="uip_btn" id="uiplus_close2">Close</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    on(qs("#uiplus_close"), "click", closeOverlay);
    on(qs("#uiplus_close2"), "click", closeOverlay);

    on(overlay, "click", (e) => {
      if (e.target === overlay) closeOverlay();
    });

    on(qs("#uiplus_tabs"), "click", (e) => {
      const tab = e.target?.dataset?.tab;
      if (!tab) return;
      setTab(tab);
    });

    on(qs("#uiplus_help"), "click", () => {
      alert(
        "UI+ Hotkeys:\n" +
        "- Ctrl+Shift+U (Cmd+Shift+U on Mac): Open UI+\n" +
        "- Esc: Close UI+\n\n" +
        "Notes:\n" +
        "- Disabling mods keeps them saved.\n" +
        "- Reload is required to fully unload mods."
      );
    });

    on(document, "keydown", (e) => {
      if (!state.overlayOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeOverlay();
      }
    }, { passive: false });

    on(document, "keydown", (e) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      if (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        openOverlay(state.tab || "mods");
      }
    }, { passive: false });
  }

  function setTab(tab) {
    state.tab = tab;
    qsa(".uip_tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    render();
  }

  function openOverlay(tab = "mods") {
    syncLibraryFromEnabled();
    state.overlayOpen = true;
    setTab(tab);
    qs("#uiplus_overlay").classList.add("open");
    qs("#uiplus_footer").textContent = "Tip: Disable keeps it saved • Reload applies changes";
  }

  function closeOverlay() {
    state.overlayOpen = false;
    qs("#uiplus_overlay").classList.remove("open");
  }

  // ---------------------------
  // Render tabs
  // ---------------------------
  function render() {
    const L = qs("#uiplus_left_scroll");
    const R = qs("#uiplus_right_scroll");
    if (!L || !R) return;

    applyOverlayScale();

    if (state.tab === "mods") renderMods(L, R);
    if (state.tab === "profiles") renderProfiles(L, R);
    if (state.tab === "prefs") renderPrefs(L, R);
  }

  function renderMods(L, R) {
    qs("#uiplus_r_title").textContent = "Mod Center";
    qs("#uiplus_r_sub").textContent = "Enable/disable without removing";

    // Left side: controls
    L.innerHTML = `
      <div class="uip_card">
        <h3>Search</h3>
        <input class="uip_input" id="uiplus_mod_search" placeholder="Search mods..." value="${escapeHtml(state.modSearch)}" />
      </div>

      <div class="uip_card">
        <h3>Sort</h3>
        <select class="uip_select" id="uiplus_mod_sort">
          <option value="enabledFirst">Enabled first</option>
          <option value="az">A → Z</option>
          <option value="recent">Recently added</option>
        </select>
      </div>

      <div class="uip_card">
        <h3>Add Mods</h3>
        <textarea class="uip_textarea" id="uiplus_mod_add" placeholder="example.js; https://.../mod.js"></textarea>
        <div class="uip_row" style="margin-top:10px;">
          <button class="uip_btn primary" id="uiplus_add_btn">Add</button>
          <button class="uip_btn primary" id="uiplus_add_reload">Add + Reload</button>
          <button class="uip_btn" id="uiplus_add_clear">Clear</button>
        </div>
        <p style="margin-top:8px;">Use <b>;</b> for multiple. Reload applies changes.</p>
      </div>

      <div class="uip_card">
        <h3>Quick</h3>
        <div class="uip_row">
          <button class="uip_btn" id="uiplus_enable_all">Enable all</button>
          <button class="uip_btn" id="uiplus_disable_all">Disable all</button>
          <button class="uip_btn danger" id="uiplus_remove_disabled">Remove disabled</button>
          <button class="uip_btn primary" id="uiplus_reload">Reload</button>
        </div>
      </div>
    `;

    // Wire left controls
    const search = qs("#uiplus_mod_search");
    const sort = qs("#uiplus_mod_sort");
    sort.value = state.modSort;

    on(search, "input", () => { state.modSearch = search.value || ""; render(); });
    on(sort, "change", () => { state.modSort = sort.value || "enabledFirst"; render(); });

    on(qs("#uiplus_reload"), "click", () => location.reload());

    on(qs("#uiplus_enable_all"), "click", () => {
      const lib = readLibrary().map(x => ({ ...x, enabled: true }));
      writeLibrary(lib);
      applyLibraryToEnabled();
      toast("Enabled all (reload to apply)");
      render();
    });

    on(qs("#uiplus_disable_all"), "click", () => {
      const lib = readLibrary().map(x => ({ ...x, enabled: false }));
      writeLibrary(lib);
      applyLibraryToEnabled();
      toast("Disabled all (reload to apply)");
      render();
    });

    on(qs("#uiplus_remove_disabled"), "click", () => {
      const lib = readLibrary().filter(x => x.enabled);
      writeLibrary(lib);
      applyLibraryToEnabled();
      toast("Removed disabled from library");
      render();
    });

    const addBox = qs("#uiplus_mod_add");
    on(qs("#uiplus_add_clear"), "click", () => addBox.value = "");

    function doAdd(reload) {
      const incoming = normalizeMods(addBox.value).filter(looksLikeModString);
      if (!incoming.length) return toast("Nothing to add");
      const old = readLibrary();
      const map = new Map(old.map(x => [x.id, x]));
      for (const id of incoming) {
        const ex = map.get(id);
        if (ex) ex.enabled = true;
        else map.set(id, { id, enabled: true, addedAt: Date.now(), note: "" });
      }
      // keep order
      const out = [];
      const seen = new Set();
      for (const x of old) { out.push(map.get(x.id) || x); seen.add(x.id); }
      for (const id of incoming) if (!seen.has(id)) out.push(map.get(id));
      writeLibrary(out);
      applyLibraryToEnabled();
      toast(reload ? "Added (reloading...)" : "Added (reload to apply)");
      if (reload) location.reload();
      else render();
    }

    on(qs("#uiplus_add_btn"), "click", () => doAdd(false));
    on(qs("#uiplus_add_reload"), "click", () => doAdd(true));

    // Right side: list
    const lib = readLibrary();
    const q = (state.modSearch || "").trim().toLowerCase();

    let items = q ? lib.filter(x => x.id.toLowerCase().includes(q)) : lib.slice();

    if (state.modSort === "enabledFirst") {
      items.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.id.localeCompare(b.id));
    } else if (state.modSort === "az") {
      items.sort((a, b) => a.id.localeCompare(b.id));
    } else if (state.modSort === "recent") {
      items.sort((a, b) => Number(b.addedAt) - Number(a.addedAt));
    }

    const enabledCount = lib.filter(x => x.enabled).length;
    qs("#uiplus_footer").textContent = `Enabled: ${enabledCount}/${lib.length} • Reload applies changes`;

    if (!items.length) {
      R.innerHTML = `
        <div class="uip_card">
          <h3>No mods found</h3>
          <p>${lib.length ? "Try another search." : "Add a mod on the left to get started."}</p>
        </div>
      `;
      return;
    }

    R.innerHTML = "";
    for (const it of items) {
      const row = document.createElement("div");
      row.className = "uip_item";
      row.innerHTML = `
        <div class="uip_grow name">
          <b title="${escapeHtml(it.id)}">${escapeHtml(it.id)}</b>
          <span>${it.id.startsWith("http") ? "URL mod" : "File mod"} • ${new Date(it.addedAt).toLocaleString()}</span>
        </div>

        <label class="uip_toggle" title="Disable keeps it saved (reload to apply)">
          <input type="checkbox" ${it.enabled ? "checked" : ""} data-act="toggle" data-id="${escapeAttr(it.id)}" />
          <span style="color:rgba(255,255,255,.85); font-size:12px;">Enabled</span>
        </label>

        <button class="uip_btn" data-act="copy" data-id="${escapeAttr(it.id)}">Copy</button>
        <button class="uip_btn danger" data-act="remove" data-id="${escapeAttr(it.id)}">Remove</button>
      `;
      R.appendChild(row);
    }

    // row actions
    qsa("[data-act]", R).forEach(el => {
      const act = el.dataset.act;
      const id = el.dataset.id || "";
      if (!id) return;

      if (act === "copy") {
        on(el, "click", async () => {
          try { await navigator.clipboard.writeText(id); toast("Copied"); }
          catch { prompt("Copy:", id); }
        });
      }
      if (act === "remove") {
        on(el, "click", () => {
          const out = readLibrary().filter(x => x.id !== id);
          writeLibrary(out);
          applyLibraryToEnabled();
          toast("Removed (reload to apply)");
          render();
        });
      }
    });

    qsa('input[data-act="toggle"]', R).forEach(chk => {
      on(chk, "change", () => {
        const id = chk.dataset.id;
        const out = readLibrary().map(x => x.id === id ? { ...x, enabled: chk.checked } : x);
        writeLibrary(out);
        applyLibraryToEnabled();
        qs("#uiplus_footer").textContent = "Changed. Reload to apply.";
      });
    });
  }

  function renderProfiles(L, R) {
    qs("#uiplus_r_title").textContent = "Profiles";
    qs("#uiplus_r_sub").textContent = "Save mod sets and switch fast";

    const profiles = readProfiles();
    const active = getActiveProfileName();

    L.innerHTML = `
      <div class="uip_card">
        <h3>Active</h3>
        <p>Current: <b style="color:rgba(255,255,255,.92)">${escapeHtml(active || "None")}</b></p>
      </div>

      <div class="uip_card">
        <h3>Save current as</h3>
        <input class="uip_input" id="uiplus_profile_name" placeholder="Profile name..." />
        <div class="uip_row" style="margin-top:10px;">
          <button class="uip_btn primary" id="uiplus_profile_save">Save</button>
        </div>
        <p style="margin-top:8px;">Saves your current library+enabled states.</p>
      </div>

      <div class="uip_card">
        <h3>Export / Import</h3>
        <div class="uip_row">
          <button class="uip_btn" id="uiplus_profiles_export">Copy export</button>
          <button class="uip_btn" id="uiplus_profiles_import">Import from clipboard</button>
        </div>
      </div>
    `;

    on(qs("#uiplus_profile_save"), "click", () => {
      const name = (qs("#uiplus_profile_name").value || "").trim();
      if (!name) return toast("Name required");
      saveCurrentAsProfile(name);
      toast(`Saved profile: ${name}`);
      render();
    });

    on(qs("#uiplus_profiles_export"), "click", async () => {
      try { await navigator.clipboard.writeText(JSON.stringify(readProfiles())); toast("Profiles copied"); }
      catch { prompt("Copy profiles JSON:", JSON.stringify(readProfiles())); }
    });

    on(qs("#uiplus_profiles_import"), "click", async () => {
      try {
        const txt = await navigator.clipboard.readText();
        const v = safeParse(txt);
        if (!Array.isArray(v)) return toast("Clipboard is not valid JSON array");
        writeProfiles(v);
        toast("Imported profiles");
        render();
      } catch {
        toast("Clipboard read blocked");
      }
    });

    if (!profiles.length) {
      R.innerHTML = `
        <div class="uip_card">
          <h3>No profiles yet</h3>
          <p>Create one on the left (“Save current as”).</p>
        </div>
      `;
      return;
    }

    R.innerHTML = `
      <div class="uip_card">
        <h3>Profile List</h3>
        <p>Load switches enabled mods (reload to apply).</p>
      </div>
    `;

    for (const p of profiles) {
      const row = document.createElement("div");
      row.className = "uip_item";
      const enabled = p.mods.filter(m => m.enabled).length;
      row.innerHTML = `
        <div class="uip_grow name">
          <b>${escapeHtml(p.name)}</b>
          <span>${enabled}/${p.mods.length} enabled</span>
        </div>
        <button class="uip_btn primary" data-act="load" data-name="${escapeAttr(p.name)}">Load</button>
        <button class="uip_btn" data-act="setactive" data-name="${escapeAttr(p.name)}">Set Active</button>
        <button class="uip_btn danger" data-act="del" data-name="${escapeAttr(p.name)}">Delete</button>
      `;
      R.appendChild(row);
    }

    qsa("[data-act]", R).forEach(btn => {
      const act = btn.dataset.act;
      const name = btn.dataset.name;
      if (!name) return;

      if (act === "load") {
        on(btn, "click", () => {
          const ok = loadProfile(name);
          if (!ok) return toast("Profile not found");
          toast(`Loaded: ${name} (reload to apply)`);
          render();
        });
      }
      if (act === "setactive") {
        on(btn, "click", () => {
          setActiveProfileName(name);
          toast(`Active: ${name}`);
          render();
        });
      }
      if (act === "del") {
        on(btn, "click", () => {
          const out = readProfiles().filter(p => p.name !== name);
          writeProfiles(out);
          if (getActiveProfileName() === name) setActiveProfileName("");
          toast("Deleted profile");
          render();
        });
      }
    });
  }

  function renderPrefs(L, R) {
    qs("#uiplus_r_title").textContent = "Preferences";
    qs("#uiplus_r_sub").textContent = "UI size, HUD, safety toggles";

    const enabled = !!state.hud.enabled;
    const compact = !!state.hud.compact;
    const hijack = !!state.prefs.hijackModsButton;

    L.innerHTML = `
      <div class="uip_card">
        <h3>Overlay Size</h3>
        <div class="uip_row">
          <button class="uip_btn" id="uiplus_scale_down">A−</button>
          <button class="uip_btn" id="uiplus_scale_up">A+</button>
          <div class="uip_grow"></div>
          <button class="uip_btn primary" id="uiplus_reload_now">Reload</button>
        </div>
        <p style="margin-top:8px;">Scale affects UI+ overlay only.</p>
      </div>

      <div class="uip_card">
        <h3>HUD</h3>
        <div class="uip_row">
          <button class="uip_btn" id="uiplus_hud_on">${enabled ? "Disable HUD" : "Enable HUD"}</button>
          <button class="uip_btn" id="uiplus_hud_compact">${compact ? "Normal HUD" : "Compact HUD"}</button>
        </div>
        <p style="margin-top:8px;">HUD never blocks clicks (small + draggable).</p>
      </div>

      <div class="uip_card">
        <h3>Safety</h3>
        <label class="uip_toggle" style="width:fit-content;">
          <input type="checkbox" id="uiplus_hijack_mods" ${hijack ? "checked" : ""} />
          <span style="color:rgba(255,255,255,.85); font-size:12px;">Hijack vanilla Mods button</span>
        </label>
        <p style="margin-top:8px;">OFF recommended (prevents black-screen bugs).</p>
      </div>
    `;

    R.innerHTML = `
      <div class="uip_card">
        <h3>Why your mod “stopped loading”</h3>
        <p>
          If your URL ends with <b>ui+.js</b>, many parsers treat <b>+</b> like a space.
          Then the game fetches <b>ui .js</b> (404) and nothing runs.
        </p>
        <p style="margin-top:8px;">
          Fix: use <b>ui%2B.js</b> in the URL, or rename the file to <b>ui_plus.js</b>.
        </p>
      </div>

      <div class="uip_card">
        <h3>Quick Tips</h3>
        <p>• Disable mods without deleting them (toggle Enabled)</p>
        <p>• Save profiles for “big mod set” vs “light set”</p>
        <p>• Reload applies changes (unload needs refresh)</p>
      </div>
    `;

    on(qs("#uiplus_scale_down"), "click", () => { state.overlayScale = clamp(state.overlayScale - 0.05, 0.85, 1.35); saveScale(); applyOverlayScale(); });
    on(qs("#uiplus_scale_up"), "click", () => { state.overlayScale = clamp(state.overlayScale + 0.05, 0.85, 1.35); saveScale(); applyOverlayScale(); });

    on(qs("#uiplus_reload_now"), "click", () => location.reload());

    on(qs("#uiplus_hud_on"), "click", () => {
      state.hud.enabled = !state.hud.enabled;
      saveHUD();
      const h = qs("#uiplus_hud");
      if (h) h.style.display = state.hud.enabled ? "" : "none";
      toast(state.hud.enabled ? "HUD enabled" : "HUD disabled");
      render();
    });

    on(qs("#uiplus_hud_compact"), "click", () => {
      state.hud.compact = !state.hud.compact;
      saveHUD();
      const h = qs("#uiplus_hud");
      if (h) h.classList.toggle("compact", !!state.hud.compact);
      toast(state.hud.compact ? "HUD compact" : "HUD normal");
      render();
    });

    on(qs("#uiplus_hijack_mods"), "change", (e) => {
      state.prefs.hijackModsButton = !!e.target.checked;
      savePrefs();
      toast(state.prefs.hijackModsButton ? "Will hijack Mods button" : "Will NOT hijack Mods button");
    });
  }

  // ---------------------------
  // Toolbar button injection (UI+)
  // ---------------------------
  function findToolbar() {
    // Sandboxels usually has a top control bar; try common containers
    const candidates = [
      qs("#controls"), qs("#toolControls"), qs("#controlButtons"),
      qs(".controls"), qs(".toolbar"), document.body
    ].filter(Boolean);

    // pick the first element that contains known button labels
    for (const c of candidates) {
      const txt = safeText(c);
      if (txt.includes("Mods") && txt.includes("Settings")) return c;
    }
    // fallback
    return qs("#controls") || qs("#toolControls") || document.body;
  }

  function injectToolbarButton() {
    if (qs("#uiplus_toolbar_btn")) return;

    const bar = findToolbar();
    if (!bar) return;

    // Find a reference button to place next to (Mods/Settings)
    const buttons = qsa("button, .button, a", bar);
    const modsBtn = buttons.find(b => safeText(b) === "Mods" || (b.title && b.title.toLowerCase().includes("mod")));
    const settingsBtn = buttons.find(b => safeText(b) === "Settings" || (b.title && b.title.toLowerCase().includes("setting")));

    const btn = document.createElement("button");
    btn.id = "uiplus_toolbar_btn";
    btn.type = "button";
    btn.textContent = "UI+";
    btn.style.cssText = `
      margin-left: 6px;
      border: 1px solid rgba(120,170,255,.55);
      background: rgba(120,170,255,.18);
      color: rgba(255,255,255,.92);
      border-radius: 10px;
      padding: 6px 10px;
      font: 800 12px/1 system-ui, -apple-system, Segoe UI, Roboto, Arial;
      cursor: pointer;
    `;
    btn.addEventListener("click", () => openOverlay("mods"));

    // Insert near Mods if possible
    if (modsBtn && modsBtn.parentNode) modsBtn.parentNode.insertBefore(btn, modsBtn.nextSibling);
    else if (settingsBtn && settingsBtn.parentNode) settingsBtn.parentNode.insertBefore(btn, settingsBtn);
    else bar.appendChild(btn);

    log("Toolbar UI+ button added");
  }

  // Optional: hijack vanilla Mods button (OFF by default)
  function maybeHijackModsButton() {
    if (!state.prefs.hijackModsButton) return;

    const bar = findToolbar();
    if (!bar) return;

    const buttons = qsa("button, .button, a", bar);
    const modsBtn = buttons.find(b => safeText(b) === "Mods" || (b.title && b.title.toLowerCase().includes("mod")));
    if (!modsBtn || modsBtn.__uiplus_hijacked) return;
    modsBtn.__uiplus_hijacked = true;

    modsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      openOverlay("mods");
    }, true);

    log("Hijacked Mods button (Preferences)");
  }

  // ---------------------------
  // Escapes
  // ---------------------------
  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replaceAll("\n", " ").replaceAll("\r", " ");
  }

  // ---------------------------
  // Boot
  // ---------------------------
  function boot() {
    try {
      injectCSS();
      applyOverlayScale();
      syncLibraryFromEnabled();

      createOverlay();
      createHUD();

      // Re-inject button because Sandboxels can rebuild toolbar
      setInterval(() => {
        injectToolbarButton();
        maybeHijackModsButton();
      }, 700);

      // First run inject now too
      injectToolbarButton();
      maybeHijackModsButton();

      toast("UI+ loaded (Ctrl+Shift+U)");
      log("Loaded OK");
    } catch (e) {
      err("Boot failed:", e);
      // If something goes wrong, do NOT break the game
      try { toast("UI+ failed (check console)"); } catch {}
    }
  }

  // Wait for DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
