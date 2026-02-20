(() => {
  "use strict";

  if (window.__NEO_UI_PLUS_SAFE_V363__) return;
  window.__NEO_UI_PLUS_SAFE_V363__ = true;

  const Keys = {
    settings: "neo_safe/settings_v363",
    favs: "neo_safe/favs_v363",
    recents: "neo_safe/recents_v363",
    tab: "neo_safe/tab_v363",
    cat: "neo_safe/cat_v363",
    compact: "neo_safe/compact_v363",
    hideCats: "neo_safe/hideCats_v363",
    scale: "neo_safe/scale_v363",
    topLift: "neo_safe/topLift_v363",
    tps: "neo_safe/tps_v363",

    openE: "neo_safe/openE_v363",
    openS: "neo_safe/openS_v363",
    maxE: "neo_safe/maxE_v363",
    maxS: "neo_safe/maxS_v363",
    wE: "neo_safe/wE_v363",
    wS: "neo_safe/wS_v363",

    enabledModsKeyGuess: "neo_safe/enabledModsKeyGuess_v363",
    startupMods: "neo_safe/startupMods_v363",
    startupSessionOff: "neo_safe/startupSessionOff_v363",
    liveMods: "neo_safe/liveMods_v363",
    liveSessionOff: "neo_safe/liveSessionOff_v363",
  };

  const Defaults = {
    enableNeoUI: true,
    elementsPanel: true,
    settingsPanel: true,
    restyleTop: true,
    hideVanillaElements: true,
    infoBar: true,
    modsBar: true,

    openElementsOnStart: true,
    autoCloseOnPick: false,

    showPreview: true,
    compactGrid: true,
    hideCategories: false,
    favFirst: true,

    scale: 1.30,
    topLift: 10,
    tps: 60,
  };

  const WHITE = "rgba(255,255,255,.92)";
  const PURPLE = "rgba(167,139,250,.95)";

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const Store = {
    readJSON(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key) || ""); } catch { return fallback; }
    },
    writeJSON(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },
    settings() {
      const v = Store.readJSON(Keys.settings, {});
      return { ...Defaults, ...(v && typeof v === "object" ? v : {}) };
    },
    patchSettings(patch) {
      const next = { ...Store.settings(), ...patch };
      Store.writeJSON(Keys.settings, next);
      return next;
    },
    list(key) {
      const v = Store.readJSON(key, []);
      return Array.isArray(v) ? v.filter(Boolean) : [];
    },
    saveList(key, arr, cap) {
      const a = Array.isArray(arr) ? arr.filter(Boolean) : [];
      Store.writeJSON(key, cap ? a.slice(0, cap) : a);
    },
    sessSet(key) {
      try {
        const v = JSON.parse(sessionStorage.getItem(key) || "[]");
        return new Set(Array.isArray(v) ? v : []);
      } catch {
        return new Set();
      }
    },
    saveSessSet(key, set) {
      sessionStorage.setItem(key, JSON.stringify(Array.from(set || new Set())));
    }
  };

  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "style") n.setAttribute("style", v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else if (v != null) n.setAttribute(k, String(v));
    }
    for (const c of kids) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return n;
  }

  function safe(fn) { try { fn(); } catch (e) { console.error("[Neo UI+] error:", e); } }

  function toast(msg) {
    safe(() => {
      if (!Store.settings().enableNeoUI) return;
      const t = $("#neoToast");
      if (!t) return;
      t.textContent = String(msg ?? "");
      t.style.display = "block";
      clearTimeout(toast._tm);
      toast._tm = setTimeout(() => (t.style.display = "none"), 1000);
    });
  }

  const Mods = {
    looksLikeMod(s) {
      if (typeof s !== "string") return false;
      const t = s.trim().toLowerCase();
      return t.endsWith(".js") || t.includes(".js?") || t.startsWith("http://") || t.startsWith("https://");
    },
    normalize(u) {
      return String(u || "").trim().replace(/[?#].*$/, "").replace(/\/+$/, "");
    },
    guessEnabledModsKey() {
      const cached = localStorage.getItem(Keys.enabledModsKeyGuess);
      if (cached && localStorage.getItem(cached) != null) return cached;

      const candidates = ["enabledMods","mods","modList","modsEnabled","enabled_mods","enabled-mods","sb_mods","sbmods"];
      for (const k of candidates) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        try {
          const v = JSON.parse(raw);
          if (Array.isArray(v) && v.some(Mods.looksLikeMod)) { localStorage.setItem(Keys.enabledModsKeyGuess, k); return k; }
        } catch {
          const parts = raw.split(";").map(x => x.trim()).filter(Boolean);
          if (parts.length && parts.some(Mods.looksLikeMod)) { localStorage.setItem(Keys.enabledModsKeyGuess, k); return k; }
        }
      }
      localStorage.setItem(Keys.enabledModsKeyGuess, "enabledMods");
      return "enabledMods";
    },
    readEnabledMods() {
      if (Array.isArray(window.enabledMods)) return window.enabledMods.slice();
      const k = Mods.guessEnabledModsKey();
      const raw = localStorage.getItem(k);
      if (!raw) return [];
      try {
        const v = JSON.parse(raw);
        if (Array.isArray(v)) return v.slice();
      } catch {}
      return raw.split(";").map(x => x.trim()).filter(Boolean);
    },
    writeEnabledMods(list) {
      const clean = Array.from(new Set((list || []).map(x => String(x||"").trim()).filter(Boolean)));
      if (Array.isArray(window.enabledMods)) window.enabledMods = clean.slice();
      const k = Mods.guessEnabledModsKey();
      try { localStorage.setItem(k, JSON.stringify(clean)); }
      catch { localStorage.setItem(k, clean.join(";")); }
      return k;
    },
    dedupeEnabledMods() {
      const arr = Mods.readEnabledMods();
      const seen = new Set();
      const out = [];
      for (const u of arr) {
        const n = Mods.normalize(u);
        if (!n || seen.has(n)) continue;
        seen.add(n);
        out.push(u);
      }
      if (out.length !== arr.length) Mods.writeEnabledMods(out);
    },

    readStartupLib() {
      const v = Store.readJSON(Keys.startupMods, []);
      if (!Array.isArray(v)) return [];
      return v
        .filter(x => x && typeof x.id === "string")
        .map(x => ({ id: x.id.trim(), enabled: !!x.enabled, addedAt: Number(x.addedAt || Date.now()) }))
        .filter(x => x.id);
    },
    writeStartupLib(arr) {
      const seen = new Set();
      const out = [];
      for (const it of arr || []) {
        const id = String(it?.id || "").trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push({ id, enabled: !!it.enabled, addedAt: Number(it.addedAt || Date.now()) });
      }
      Store.writeJSON(Keys.startupMods, out);
      return out;
    },
    syncStartupFromEnabled() {
      const enabled = new Set(Mods.readEnabledMods());
      const lib = Mods.readStartupLib();
      const map = new Map(lib.map(x => [x.id, x]));
      for (const id of enabled) {
        const ex = map.get(id);
        if (ex) ex.enabled = true;
        else map.set(id, { id, enabled: true, addedAt: Date.now() });
      }
      const out = [];
      const seen = new Set();
      for (const x of lib) { out.push(map.get(x.id) || x); seen.add(x.id); }
      for (const id of enabled) if (!seen.has(id)) out.push(map.get(id));
      Mods.writeStartupLib(out);
    },
    applyStartupToEnabled() {
      const off = Store.sessSet(Keys.startupSessionOff);
      const lib = Mods.readStartupLib();
      Mods.writeEnabledMods(lib.filter(x => x.enabled && !off.has(x.id)).map(x => x.id));
    },

    readLiveList() { return Store.list(Keys.liveMods).map(x => String(x||"").trim()).filter(Boolean); },
    writeLiveList(arr) {
      const seen = new Set();
      const out = [];
      for (const x of arr || []) {
        const u = String(x||"").trim();
        if (!u || seen.has(u)) continue;
        seen.add(u);
        out.push(u);
      }
      Store.writeJSON(Keys.liveMods, out);
      return out;
    }
  };

  const Neo = (window.NeoModLoader ||= {});
  Neo.version = "1.2.1";
  Neo._hooks ||= { ready: [], elements: [], tick: [], draw: [], elementSelected: [] };
  Neo.on = (name, fn) => {
    (Neo._hooks[name] ||= []).push(fn);
    return () => { Neo._hooks[name] = (Neo._hooks[name] || []).filter(x => x !== fn); };
  };
  Neo.emit = (name, ...args) => {
    const a = Neo._hooks[name] || [];
    for (const fn of a) { try { fn(...args); } catch {} }
  };
  Neo.refs = () => ({
    elements: window.elements,
    pixelMap: window.pixelMap,
    currentPixels: window.currentPixels,
    width: window.width,
    height: window.height,
    mouseX: window.mouseX,
    mouseY: window.mouseY,
    mouseSize: window.mouseSize,
    paused: window.paused,
    isEmpty: window.isEmpty,
    tryMove: window.tryMove,
    outOfBounds: window.outOfBounds,
    createPixel: window.createPixel,
    deletePixel: window.deletePixel,
    changePixel: window.changePixel,
    doDefaults: window.doDefaults,
    settings: window.settings,
  });
  Neo.load = (url) => new Promise((resolve, reject) => {
    const u = String(url || "").trim();
    if (!u) return reject(new Error("no url"));
    const off = Store.sessSet(Keys.liveSessionOff);
    if (off.has(u)) return reject(new Error("session off"));

    for (const s of document.scripts) {
      if (s?.dataset?.neoMod === u) return resolve({ url: u, already: true });
    }

    const s = document.createElement("script");
    s.src = u;
    s.async = true;
    s.dataset.neoMod = u;
    s.onload = () => resolve({ url: u });
    s.onerror = () => reject(new Error("load failed"));
    document.head.appendChild(s);
  });

  const UI = {
    scale() {
      const s = Store.settings();
      const raw = localStorage.getItem(Keys.scale);
      const v = raw == null ? s.scale : parseFloat(raw);
      return clamp(Number.isFinite(v) ? v : s.scale, 1.0, 1.75);
    },
    topLift() {
      const s = Store.settings();
      const raw = localStorage.getItem(Keys.topLift);
      const v = raw == null ? s.topLift : parseInt(raw, 10);
      return clamp(Number.isFinite(v) ? v : s.topLift, 0, 28);
    },
    setScale(v) {
      const n = clamp(v, 1.0, 1.75);
      localStorage.setItem(Keys.scale, String(n));
      document.body.style.setProperty("--neoScale", String(n));
      UI.updateTop();
    },
    setTopLift(v) {
      const n = clamp(Math.round(v), 0, 28);
      localStorage.setItem(Keys.topLift, String(n));
      UI.updateTop();
    },
    setTPS(v) {
      const n = clamp(Math.round(v), 1, 1000);
      localStorage.setItem(Keys.tps, String(n));
      for (const k of ["tps","TPS","tickSpeed","ticksPerSecond","targetTPS"]) {
        if (typeof window[k] === "number") window[k] = n;
      }
      UI.renderInfo();
    },
    getTPS() {
      const raw = localStorage.getItem(Keys.tps);
      const v = raw == null ? Store.settings().tps : parseFloat(raw);
      return clamp(Number.isFinite(v) ? v : 60, 1, 1000);
    },
    updateTop() {
      const vh = window.innerHeight || 800;
      let top = 64;

      const consider = (node) => {
        if (!node) return;
        const r = node.getBoundingClientRect();
        if (r.bottom <= 0) return;
        if (r.top > vh * 0.45) return;
        top = Math.max(top, Math.round(r.bottom) + 8);
      };

      consider($("#toolControls"));
      consider($("#controls"));

      top = clamp(top, 56, Math.floor(vh * 0.35));
      top = clamp(top - UI.topLift(), 48, Math.floor(vh * 0.35));

      document.body.style.setProperty("--neoTop", `${top}px`);
      const info = $("#neoInfo");
      if (info) info.style.top = `${Math.max(10, top - 44)}px`;
    },
    renderInfo() {
      const s = Store.settings();
      const info = $("#neoInfo");
      if (!info) return;
      info.classList.toggle("on", !!(s.enableNeoUI && s.infoBar));
      if (!(s.enableNeoUI && s.infoBar)) return;

      const get = (...names) => { for (const n of names) if (n in window) return window[n]; return undefined; };
      const elName = get("currentElement","element","selectedElement") ?? "-";
      const size = get("mouseSize","cursorSize","brushSize") ?? "-";
      const replace = get("replaceMode","replace","replacing");
      const paused = get("paused","isPaused","pause");

      const pill = info.querySelector(".pill");
      if (!pill) return;

      pill.innerHTML = `
        <span><b>Elem:</b> ${String(elName)}</span>
        <span><b>Size:</b> ${String(size)}</span>
        <span><b>Replace:</b> ${typeof replace === "boolean" ? (replace ? "On" : "Off") : String(replace ?? "-")}</span>
        <span><b>Paused:</b> ${typeof paused === "boolean" ? (paused ? "Yes" : "No") : String(paused ?? "-")}</span>
        <span><b>TPS:</b> ${String(UI.getTPS())}</span>
      `;
    },
    injectCSS() {
      $("#neoStyle")?.remove();
      const st = document.createElement("style");
      st.id = "neoStyle";
      st.textContent = UI.cssText();
      document.head.appendChild(st);
    },
    cssText() {
      return `
body.neoUI{
  --neoScale:${UI.scale()};
  --neoTop:96px;
  --neoWE:${clamp(parseInt(localStorage.getItem(Keys.wE) || "560", 10) || 560, 340, 980)}px;
  --neoWS:${clamp(parseInt(localStorage.getItem(Keys.wS) || "560", 10) || 560, 340, 980)}px;

  --neoPanel:rgba(18,21,28,.92);
  --neoPanel2:rgba(14,16,22,.92);
  --neoBorder:rgba(255,255,255,.12);
  --neoBorder2:rgba(255,255,255,.08);
  --neoText:${WHITE};
  --neoMuted:rgba(255,255,255,.62);
  --neoShadow:0 16px 48px rgba(0,0,0,.55);
  --neoShadow2:0 10px 30px rgba(0,0,0,.45);
}
body.neoUI.neoHideVanilla #categoryControls,
body.neoUI.neoHideVanilla #elementControls{display:none !important;}

body.neoUI #toolControls, body.neoUI #controls{font-size:calc(14px * var(--neoScale));}
body.neoUI #toolControls .controlButton,
body.neoUI #controls .controlButton,
body.neoUI #controls button{
  font-size:calc(14px * var(--neoScale)) !important;
  padding:calc(6px * var(--neoScale)) calc(10px * var(--neoScale)) !important;
  min-height:calc(34px * var(--neoScale));
  border-radius:calc(12px * var(--neoScale)) !important;
}
body.neoUI.neoTopStyle #toolControls .controlButton,
body.neoUI.neoTopStyle #controls .controlButton{
  border:1px solid var(--neoBorder2) !important;
  background:linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04)) !important;
  color:var(--neoText) !important;
  box-shadow:0 6px 16px rgba(0,0,0,.25);
}

#neoOverlay{position:fixed;inset:0;background:rgba(0,0,0,.40);z-index:999980;display:none;pointer-events:none;}
#neoOverlay.open{display:block;pointer-events:auto;}

.neoEdge{position:fixed;top:calc(var(--neoTop) + 10px);z-index:999995;user-select:none;cursor:pointer;color:var(--neoText);
  background:linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
  border:1px solid var(--neoBorder);box-shadow:var(--neoShadow2);padding:10px 10px;border-radius:14px;opacity:.96;}
.neoEdge.hidden{display:none;}
.neoEdge .lbl{display:block;font-weight:900;letter-spacing:.6px;font-size:12px;}
.neoEdge .sub{display:block;font-size:11px;color:var(--neoMuted);margin-top:2px;}
#neoEdgeElements{left:8px;}
#neoEdgeSettings{right:8px;}

.neoDrawer{position:fixed;top:var(--neoTop);height:calc(100vh - var(--neoTop));z-index:999990;color:var(--neoText);
  background:var(--neoPanel);border:1px solid var(--neoBorder);box-shadow:var(--neoShadow);border-radius:18px;
  display:flex;flex-direction:column;max-width:calc(100vw - 16px);min-height:340px;overflow:hidden;}
#neoElements{left:8px;width:var(--neoWE);transform:translateX(-110%);transition:transform 160ms ease;}
#neoElements.open{transform:translateX(0);}
#neoSettings{right:8px;width:var(--neoWS);transform:translateX(110%);transition:transform 160ms ease;}
#neoSettings.open{transform:translateX(0);}
.neoMax{left:8px !important;right:8px !important;width:auto !important;top:var(--neoTop) !important;bottom:8px !important;height:auto !important;transform:none !important;}

.neoHdr{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px;border-bottom:1px solid var(--neoBorder2);background:rgba(0,0,0,.10);}
.neoTitle{font-weight:900;letter-spacing:.6px;}
.neoBtns{display:flex;gap:8px;align-items:center;}
.neoBtn{border-radius:12px;border:1px solid var(--neoBorder2);
  background:linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
  color:var(--neoText);padding:8px 10px;cursor:pointer;}
.neoBtn.ghost{background:rgba(255,255,255,.03);}

.neoTabs{display:flex;gap:8px;padding:10px 12px 0 12px;}
.neoTab{flex:1;text-align:center;padding:8px 10px;border-radius:999px;border:1px solid var(--neoBorder2);background:rgba(255,255,255,.04);cursor:pointer;}
.neoTab.active{border-color:rgba(76,201,240,.55);background:rgba(76,201,240,.10);}

.neoSearchRow{display:flex;gap:8px;padding:10px 12px 12px 12px;border-bottom:1px solid var(--neoBorder2);}
#neoSearch{flex:1;border-radius:14px;border:1px solid var(--neoBorder2);background:rgba(255,255,255,.05);color:var(--neoText);padding:10px 12px;outline:none;}

#neoElBody{flex:1;display:grid;grid-template-columns:190px 1fr;gap:10px;padding:10px 12px 12px 12px;overflow:hidden;min-height:240px;}
body.neoUI.neoHideCats #neoElBody{grid-template-columns:1fr;}
body.neoUI.neoHideCats #neoCats{display:none;}
#neoCats{border:1px solid var(--neoBorder2);border-radius:14px;background:var(--neoPanel2);overflow:auto;padding:8px;}
#neoElRight{display:flex;flex-direction:column;gap:10px;overflow:hidden;min-height:240px;}
#neoGridWrap{flex:1;border:1px solid var(--neoBorder2);border-radius:14px;background:var(--neoPanel2);overflow:hidden;display:flex;flex-direction:column;min-height:220px;}
#neoGridHead{padding:10px;border-bottom:1px solid var(--neoBorder2);display:flex;justify-content:space-between;align-items:center;gap:10px;}
#neoCount{font-size:12px;color:var(--neoMuted);}

#neoGrid{padding:10px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill, minmax(170px, 1fr));gap:10px;min-height:200px;}
body.neoUI.neoCompact #neoGrid{grid-template-columns:repeat(auto-fill, minmax(150px, 1fr));gap:8px;}
#neoElements.neoMax #neoGrid{grid-template-columns:repeat(auto-fill, minmax(210px, 1fr));}
#neoElements.neoMax #neoElBody{grid-template-columns:240px 1fr;}
.neoElBtn{display:flex;align-items:flex-start;gap:10px;padding:10px;border-radius:14px;border:1px solid var(--neoBorder2);
  background:linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.03));cursor:pointer;min-height:44px;}
.neoDot{width:14px;height:14px;border-radius:999px;box-shadow:inset 0 0 0 2px rgba(0,0,0,.25);margin-top:2px;}
.neoName{overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;line-height:1.12;margin-top:1px;}
#neoElements.neoMax .neoName{-webkit-line-clamp:3;}
.neoStarBtn{margin-left:auto;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:rgba(255,255,255,.90);
  border-radius:12px;padding:6px 8px;cursor:pointer;}
.neoStarBtn.on{border-color:${PURPLE};background:rgba(167,139,250,.12);}

#neoPreview{border:1px solid var(--neoBorder2);border-radius:14px;background:rgba(255,255,255,.04);padding:10px;display:none;}
#neoPreview.show{display:block;}
#neoPreview .muted{color:var(--neoMuted);font-size:12px;}

#neoToast{position:fixed;left:12px;bottom:12px;z-index:999999;display:none;padding:10px 12px;border-radius:14px;background:rgba(12,14,18,.94);
  border:1px solid var(--neoBorder);color:var(--neoText);box-shadow:var(--neoShadow2);font-size:12px;}

#neoSettingsBody{flex:1;overflow:auto;padding:10px 12px 12px 12px;}
.neoSection{margin:12px 0 8px 0;font-weight:900;letter-spacing:.4px;}
.neoToggle{display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:14px;cursor:pointer;}
.neoToggle:hover{background:rgba(255,255,255,.05);}
.neoSmall{font-size:12px;color:var(--neoMuted);margin-top:2px;}
.neoCard{border:1px solid var(--neoBorder2);border-radius:14px;background:rgba(0,0,0,.10);padding:10px;}
.neoRow{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
.neoInput{flex:1;min-width:240px;border-radius:14px;border:1px solid var(--neoBorder2);background:rgba(255,255,255,.05);color:var(--neoText);padding:10px 12px;outline:none;}
.neoBadge{font-size:11px;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:rgba(255,255,255,.72);}

#neoModTools{display:flex;gap:10px;align-items:center;padding:10px 10px;margin:10px 0;border-radius:16px;background:rgba(0,0,0,.20);border:1px solid rgba(255,255,255,.10);}
#neoModSearch{flex:1;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:rgba(255,255,255,.92);outline:none;}
#neoModSearch::placeholder{color:rgba(255,255,255,.60);}
.neoMiniBtn{padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));color:rgba(255,255,255,.92);cursor:pointer;white-space:nowrap;}

#neoInfo{position:fixed;z-index:999970;right:10px;top:10px;pointer-events:none;display:none;}
#neoInfo.on{display:block;}
#neoInfo .pill{max-width:min(680px, 92vw);border:1px solid rgba(255,255,255,.16);background:rgba(12,12,14,.62);
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  border-radius:999px;padding:8px 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;
  box-shadow:0 14px 40px rgba(0,0,0,.35);color:rgba(255,255,255,.90);font-size:12px;}
#neoInfo b{color:${WHITE};}
#neoInfo span{color:rgba(255,255,255,.74);}

.neoCreditHost{color:${WHITE} !important;}
.neoCreditTag{color:${PURPLE} !important;font-weight:900;margin-left:8px;}
      `;
    }
  };

  const Elements = {
    prettyName(name) {
      const def = window.elements?.[name];
      const v = def?.name || def?.displayName || def?.label;
      if (typeof v === "string" && v.trim()) return v.trim();
      return String(name).replace(/_/g, " ");
    },
    color(name) {
      const def = window.elements?.[name];
      const c = def?.color;
      if (Array.isArray(c) && c.length) return c[0];
      if (typeof c === "string") return c;
      return "rgba(255,255,255,.35)";
    },
    index() {
      const byCat = new Map();
      const all = [];
      for (const [name, def] of Object.entries(window.elements || {})) {
        if (!def || def.hidden) continue;
        const c = def.category || "other";
        if (!byCat.has(c)) byCat.set(c, []);
        byCat.get(c).push(name);
        all.push(name);
      }
      const sortFn = (a, b) => Elements.prettyName(a).localeCompare(Elements.prettyName(b));
      for (const arr of byCat.values()) arr.sort(sortFn);
      all.sort(sortFn);
      const cats = ["all", ...Array.from(byCat.keys()).sort((a, b) => String(a).localeCompare(String(b)))];
      return { byCat, all, cats };
    },
    labels() {
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
  };

  function injectCreditTagHard() {
    safe(() => {
      if (!document.body) return;

      const rx = /\br74n\b/i;
      const rxDev = /developed by/i;

      let target = null;

      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          const tag = (p.tagName || "").toLowerCase();
          if (tag === "script" || tag === "style" || tag === "textarea") return NodeFilter.FILTER_REJECT;
          const txt = (node.nodeValue || "").trim();
          if (!txt) return NodeFilter.FILTER_REJECT;
          const full = (p.textContent || "");
          if (!rx.test(full)) return NodeFilter.FILTER_REJECT;
          if (rxDev.test(full) || rxDev.test(txt) || rx.test(txt)) return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      let node;
      while ((node = tw.nextNode())) {
        const p = node.parentElement;
        if (!p) continue;

        // avoid touching our own panels
        if (p.closest("#neoElements,#neoSettings,#neoInfo,#neoOverlay")) continue;

        // pick the smallest sensible container
        let host = p;
        for (let i = 0; i < 3; i++) {
          if (!host.parentElement) break;
          const t = (host.textContent || "").trim();
          if (t.length > 140) break;
          host = host.parentElement;
        }

        target = host;
        break;
      }

      if (!target) return;

      // If the credit text is inside a link or span, make sure we attach on the visible container
      if (target.querySelector && target.querySelector(".neoCreditTag")) {
        target.classList.add("neoCreditHost");
        return;
      }

      target.classList.add("neoCreditHost");

      const span = document.createElement("span");
      span.className = "neoCreditTag";
      span.textContent = "modded by Playfullgamer";
      target.appendChild(span);
    });
  }

  let creditObserver = null;
  function startCreditObserver() {
    if (creditObserver || !window.MutationObserver) return;
    creditObserver = new MutationObserver(() => injectCreditTagHard());
    creditObserver.observe(document.body, { childList: true, subtree: true });
  }

  function toggleBool(key, fallbackBool) {
    const cur = localStorage.getItem(key);
    const v = cur == null ? !!fallbackBool : cur === "1";
    localStorage.setItem(key, v ? "0" : "1");
  }

  function isOpenE() { return localStorage.getItem(Keys.openE) === "1"; }
  function isOpenS() { return localStorage.getItem(Keys.openS) === "1"; }
  function isMax(which) { return localStorage.getItem(which === "elements" ? Keys.maxE : Keys.maxS) === "1"; }

  function setOpenE(v) {
    const s = Store.settings();
    if (!s.enableNeoUI || !s.elementsPanel) return;
    if (v && window.innerWidth < 900) setOpenS(false);
    localStorage.setItem(Keys.openE, v ? "1" : "0");
    $("#neoElements")?.classList.toggle("open", v);
    syncOverlayEdges();
    UI.updateTop();
  }
  function setOpenS(v) {
    const s = Store.settings();
    if (!s.enableNeoUI || !s.settingsPanel) return;
    if (v && window.innerWidth < 900) setOpenE(false);
    localStorage.setItem(Keys.openS, v ? "1" : "0");
    $("#neoSettings")?.classList.toggle("open", v);
    syncOverlayEdges();
    UI.updateTop();
  }
  function setMax(which, v) {
    if (which === "elements") {
      localStorage.setItem(Keys.maxE, v ? "1" : "0");
      $("#neoElements")?.classList.toggle("neoMax", v);
      if (v) {
        localStorage.setItem(Keys.maxS, "0");
        $("#neoSettings")?.classList.remove("neoMax");
        setOpenS(false);
        setOpenE(true);
      }
    } else {
      localStorage.setItem(Keys.maxS, v ? "1" : "0");
      $("#neoSettings")?.classList.toggle("neoMax", v);
      if (v) {
        localStorage.setItem(Keys.maxE, "0");
        $("#neoElements")?.classList.remove("neoMax");
        setOpenE(false);
        setOpenS(true);
      }
    }
  }

  function syncOverlayEdges() {
    $("#neoOverlay")?.classList.toggle("open", isOpenE() || isOpenS());

    const s = Store.settings();
    $("#neoEdgeElements")?.classList.toggle("hidden", !(s.enableNeoUI && s.elementsPanel) || isOpenE());
    $("#neoEdgeSettings")?.classList.toggle("hidden", !(s.enableNeoUI && s.settingsPanel) || isOpenS());
  }

  function applyBodyFlags() {
    const s = Store.settings();
    const compact = (localStorage.getItem(Keys.compact) ?? (s.compactGrid ? "1" : "0")) === "1";
    const hideCats = (localStorage.getItem(Keys.hideCats) ?? (s.hideCategories ? "1" : "0")) === "1";
    document.body.classList.toggle("neoCompact", compact);
    document.body.classList.toggle("neoHideCats", hideCats);
  }

  function buildUI() {
    if ($("#neoElements")) return;

    document.body.appendChild(el("div", { id: "neoOverlay", onclick: () => { setOpenE(false); setOpenS(false); } }));
    document.body.appendChild(el("div", { id: "neoToast" }));
    document.body.appendChild(el("div", { id: "neoInfo" }, el("div", { class: "pill" }, "")));

    document.body.appendChild(
      el("div", { id: "neoEdgeElements", class: "neoEdge", onclick: () => setOpenE(true) },
        el("span", { class: "lbl" }, "ELEMENTS"),
        el("span", { class: "sub" }, "☰")
      )
    );
    document.body.appendChild(
      el("div", { id: "neoEdgeSettings", class: "neoEdge", onclick: () => setOpenS(true) },
        el("span", { class: "lbl" }, "SETTINGS"),
        el("span", { class: "sub" }, "⚙")
      )
    );

    const elPanel = el("div", { id: "neoElements", class: "neoDrawer" },
      el("div", { class: "neoHdr" },
        el("div", { class: "neoTitle" }, "Elements"),
        el("div", { class: "neoBtns" },
          el("button", { class: "neoBtn ghost", onclick: () => { toggleBool(Keys.compact, Store.settings().compactGrid); applyBodyFlags(); renderElements(); } }, "▦"),
          el("button", { class: "neoBtn ghost", onclick: () => { toggleBool(Keys.hideCats, Store.settings().hideCategories); applyBodyFlags(); } }, "☰"),
          el("button", { class: "neoBtn", onclick: () => setMax("elements", !isMax("elements")) }, "⤢"),
          el("button", { class: "neoBtn", onclick: () => setOpenS(true) }, "⚙"),
          el("button", { class: "neoBtn", onclick: () => setOpenE(false) }, "×")
        )
      ),
      el("div", { class: "neoTabs" },
        el("div", { class: "neoTab", id: "neoTabAll", onclick: () => setTab("all") }, "All"),
        el("div", { class: "neoTab", id: "neoTabFav", onclick: () => setTab("fav") }, "Fav"),
        el("div", { class: "neoTab", id: "neoTabRec", onclick: () => setTab("recent") }, "Recent")
      ),
      el("div", { class: "neoSearchRow" },
        el("input", { id: "neoSearch", type: "text", placeholder: "Search…" }),
        el("button", { class: "neoBtn", onclick: () => { $("#neoSearch").value = ""; renderElements(); } }, "×")
      ),
      el("div", { id: "neoElBody" },
        el("div", { id: "neoCats" }),
        el("div", { id: "neoElRight" },
          el("div", { id: "neoGridWrap" },
            el("div", { id: "neoGridHead" },
              el("div", { id: "neoCount" }, ""),
              el("div", { style: "display:flex;gap:8px;align-items:center;" },
                el("button", { class: "neoBtn ghost", onclick: () => setOpenE(false) }, "Hide")
              )
            ),
            el("div", { id: "neoGrid" })
          ),
          el("div", { id: "neoPreview" })
        )
      )
    );

    const stPanel = el("div", { id: "neoSettings", class: "neoDrawer" },
      el("div", { class: "neoHdr" },
        el("div", { class: "neoTitle" }, "Settings"),
        el("div", { class: "neoBtns" },
          el("button", { class: "neoBtn", onclick: () => setMax("settings", !isMax("settings")) }, "⤢"),
          el("button", { class: "neoBtn", onclick: () => setOpenE(true) }, "☰"),
          el("button", { class: "neoBtn", onclick: () => setOpenS(false) }, "×")
        )
      ),
      el("div", { id: "neoSettingsBody" })
    );

    document.body.append(elPanel, stPanel);
    $("#neoSearch").addEventListener("input", renderElements);
  }

  function setTab(t) {
    localStorage.setItem(Keys.tab, t);
    $("#neoTabAll")?.classList.toggle("active", t === "all");
    $("#neoTabFav")?.classList.toggle("active", t === "fav");
    $("#neoTabRec")?.classList.toggle("active", t === "recent");
    renderCats();
    renderElements();
  }

  function renderCats() {
    const s = Store.settings();
    if (!s.enableNeoUI || !s.elementsPanel) return;

    const wrap = $("#neoCats");
    if (!wrap) return;

    const { cats } = Elements.index();
    const labels = Elements.labels();

    const curCat = localStorage.getItem(Keys.cat) || "all";

    wrap.innerHTML = "";
    for (const c of cats) {
      const label = c === "all" ? "All" : (labels.get(c) || String(c).replace(/_/g, " "));
      const btn = el("button", { class: "neoElBtn", style: "justify-content:flex-start;width:100%;" }, label);
      btn.onclick = () => { localStorage.setItem(Keys.cat, c); renderCats(); renderElements(); };
      if (curCat === c) btn.style.outline = `2px solid ${PURPLE}`;
      wrap.appendChild(btn);
    }
  }

  function renderElements() {
    const s = Store.settings();
    if (!s.enableNeoUI || !s.elementsPanel) return;

    const grid = $("#neoGrid");
    const count = $("#neoCount");
    if (!grid) return;

    const favs = Store.list(Keys.favs);
    const recs = Store.list(Keys.recents);
    const favSet = new Set(favs);

    const tab = localStorage.getItem(Keys.tab) || "all";
    const cat = localStorage.getItem(Keys.cat) || "all";

    const query = ($("#neoSearch")?.value || "").trim().toLowerCase();

    const { all, byCat } = Elements.index();
    let list;
    if (tab === "fav") list = favs.filter(n => window.elements?.[n]);
    else if (tab === "recent") list = recs.filter(n => window.elements?.[n]);
    else list = (cat === "all") ? all : (byCat.get(cat) || []);

    list = list.filter(n => {
      const def = window.elements?.[n];
      if (!def || def.hidden) return false;
      if (cat !== "all" && String(def.category || "other") !== String(cat)) return false;
      return true;
    });

    if (query) {
      list = list.filter(n => Elements.prettyName(n).toLowerCase().includes(query) || String(n).toLowerCase().includes(query));
    }

    if (tab === "all" && s.favFirst && favSet.size) {
      const f = [];
      const r = [];
      for (const n of list) (favSet.has(n) ? f : r).push(n);
      list = f.concat(r);
    }

    grid.innerHTML = "";
    let shown = 0;

    for (const name of list) {
      const def = window.elements?.[name];
      if (!def || def.hidden) continue;

      const btn = el("button", { class: "neoElBtn", title: Elements.prettyName(name) });
      btn.appendChild(el("span", { class: "neoDot", style: `background:${Elements.color(name)};` }));
      btn.appendChild(el("span", { class: "neoName" }, Elements.prettyName(name)));

      const star = el("button", { class: `neoStarBtn ${favSet.has(name) ? "on" : ""}` }, favSet.has(name) ? "★" : "☆");
      star.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const f = Store.list(Keys.favs);
        const i = f.indexOf(name);
        if (i >= 0) f.splice(i, 1);
        else f.unshift(name);
        Store.saveList(Keys.favs, f, 80);
        renderElements();
      };
      btn.appendChild(star);

      btn.onclick = (ev) => {
        if (typeof window.selectElement === "function") window.selectElement(name);
        const r = Store.list(Keys.recents);
        Store.saveList(Keys.recents, [name, ...r.filter(x => x !== name)], 40);
        if (!ev.shiftKey && s.autoCloseOnPick) setOpenE(false);
      };

      grid.appendChild(btn);
      shown++;
    }

    if (count) count.textContent = String(shown);

    const prev = $("#neoPreview");
    if (prev) {
      prev.classList.toggle("show", !!s.showPreview);
      if (!shown) prev.innerHTML = `<div class="muted">No matches.</div>`;
    }
  }

  function buildSettings() {
    const body = $("#neoSettingsBody");
    if (!body) return;
    body.innerHTML = "";
    const s = Store.settings();

    const section = (t) => el("div", { class: "neoSection" }, t);
    const toggle = (key, title, desc) => {
      const id = `neo_${key}`;
      return el("label", { class: "neoToggle", for: id },
        el("input", {
          id, type: "checkbox",
          checked: s[key] ? "checked" : null,
          onchange: (ev) => { Store.patchSettings({ [key]: !!ev.target.checked }); applySettings(); }
        }),
        el("div", {}, el("div", { style: "font-weight:800;" }, title), el("div", { class: "neoSmall" }, desc))
      );
    };
    const slider = (label, valueText, min, max, step, value, oninput) => {
      return el("div", { class: "neoCard" },
        el("div", { class: "neoSmall" }, `${label}: ${valueText}`),
        el("div", { class: "neoRow", style: "margin-top:10px;" },
          el("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(value), style: "flex:1;", oninput })
        )
      );
    };

    body.append(
      section("UI"),
      toggle("enableNeoUI", "Neo UI", "Master switch"),
      toggle("elementsPanel", "Neo Elements panel", "Left drawer"),
      toggle("settingsPanel", "Neo Settings panel", "Right drawer"),
      toggle("restyleTop", "Top bar style", "Smoother buttons"),
      toggle("hideVanillaElements", "Hide vanilla elements UI", "Only when Elements panel is enabled"),
      toggle("infoBar", "Info bar", "Status pill"),
      toggle("modsBar", "Better Mods menu bar", "Search + shortcut"),
      toggle("autoCloseOnPick", "Auto-close after pick", "Shift-click keeps it open"),

      section("Sizing"),
      slider("UI scale", UI.scale().toFixed(2), 1.0, 1.75, 0.02, UI.scale(), (ev) => { UI.setScale(parseFloat(ev.target.value)); }),
      slider("Panel lift", `${UI.topLift()}px`, 0, 28, 1, UI.topLift(), (ev) => { UI.setTopLift(parseInt(ev.target.value, 10)); }),

      section("TPS"),
      slider("TPS", String(UI.getTPS()), 1, 1000, 1, UI.getTPS(), (ev) => UI.setTPS(parseInt(ev.target.value, 10))),

      section("Mods"),
      ModsPanel(),

      section("Reset"),
      el("div", { class: "neoRow" },
        el("button", { class: "neoBtn", onclick: () => panicReset() }, "Reset layout")
      )
    );
  }

  function ModsPanel() {
    const wrap = el("div", { class: "neoCard" },
      el("div", { class: "neoSmall" }, "Startup mods apply on reload. Live mods load instantly."),
      el("div", { class: "neoRow", style: "margin-top:10px;" },
        el("input", { id: "neoStartAdd", class: "neoInput", placeholder: "Startup mods URL(s) ; separated", type: "text" }),
        el("button", { class: "neoBtn", onclick: () => addStartup(false) }, "Add"),
        el("button", { class: "neoBtn", onclick: () => addStartup(true) }, "Add+Reload"),
        el("button", { class: "neoBtn ghost", onclick: () => location.reload() }, "Reload")
      ),
      el("div", { id: "neoStartList" }),
      el("div", { class: "neoRow", style: "margin-top:14px;" },
        el("input", { id: "neoLiveUrl", class: "neoInput", placeholder: "Live mod URL (.js)", type: "text" }),
        el("button", { class: "neoBtn", onclick: () => loadLiveNow() }, "Load now"),
        el("button", { class: "neoBtn ghost", onclick: () => saveLive() }, "Save"),
        el("button", { class: "neoBtn ghost", onclick: () => loadSavedLive() }, "Load saved")
      ),
      el("div", { id: "neoLiveList" })
    );

    setTimeout(() => { renderStartupList(); renderLiveList(); }, 0);
    return wrap;
  }

  function addStartup(reload) {
    const input = $("#neoStartAdd");
    const incoming = String(input?.value || "").split(";").map(x => x.trim()).filter(Boolean).filter(Mods.looksLikeMod);
    if (!incoming.length) return toast("No mods");

    Mods.syncStartupFromEnabled();
    const lib = Mods.readStartupLib();
    const map = new Map(lib.map(x => [x.id, x]));
    for (const id of incoming) map.set(id, { id, enabled: true, addedAt: Date.now() });

    const out = [];
    const seen = new Set();
    for (const x of lib) { out.push(map.get(x.id) || x); seen.add(x.id); }
    for (const id of incoming) if (!seen.has(id)) out.push(map.get(id));

    Mods.writeStartupLib(out);
    Mods.applyStartupToEnabled();

    renderStartupList();
    toast(reload ? "Reloading…" : "Added");
    input.value = incoming.join("; ");
    if (reload) location.reload();
  }

  function renderStartupList() {
    const list = $("#neoStartList");
    if (!list) return;

    Mods.syncStartupFromEnabled();
    const lib = Mods.readStartupLib().slice().sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.id.localeCompare(b.id));
    const off = Store.sessSet(Keys.startupSessionOff);

    list.innerHTML = "";
    list.appendChild(el("div", { class: "neoSmall", style: "margin-top:10px;" },
      `Saved ${lib.length} • Session Off ${off.size}`
    ));

    for (const m of lib) {
      const row = el("div", { class: "neoRow", style: "margin-top:10px;" });

      const cb = el("input", {
        type: "checkbox",
        checked: m.enabled ? "checked" : null,
        onchange: (ev) => {
          const next = Mods.readStartupLib().map(x => x.id === m.id ? { ...x, enabled: !!ev.target.checked } : x);
          Mods.writeStartupLib(next);
          Mods.applyStartupToEnabled();
          renderStartupList();
        }
      });

      const sessionBtn = el("button", { class: "neoBtn ghost" }, off.has(m.id) ? "Session Off" : "Session On");
      sessionBtn.onclick = () => {
        const set = Store.sessSet(Keys.startupSessionOff);
        if (set.has(m.id)) set.delete(m.id); else set.add(m.id);
        Store.saveSessSet(Keys.startupSessionOff, set);
        Mods.applyStartupToEnabled();
        renderStartupList();
      };

      row.append(
        cb,
        el("span", { style: "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" }, m.id),
        sessionBtn,
        el("button", { class: "neoBtn ghost", onclick: () => navigator.clipboard?.writeText(m.id).catch(() => prompt("Copy:", m.id)) }, "Copy"),
        el("button", {
          class: "neoBtn ghost",
          onclick: () => {
            Mods.writeStartupLib(Mods.readStartupLib().filter(x => x.id !== m.id));
            const set = Store.sessSet(Keys.startupSessionOff); set.delete(m.id); Store.saveSessSet(Keys.startupSessionOff, set);
            Mods.applyStartupToEnabled();
            renderStartupList();
            toast("Removed (reload)");
          }
        }, "Remove")
      );

      list.appendChild(row);
    }
  }

  function saveLive() {
    const inp = $("#neoLiveUrl");
    const u = String(inp?.value || "").trim();
    if (!u) return toast("No URL");
    if (!Mods.looksLikeMod(u)) return toast("Needs .js url");
    const list = Mods.readLiveList();
    if (!list.includes(u)) list.push(u);
    Mods.writeLiveList(list);
    renderLiveList();
    toast("Saved");
  }

  async function loadLiveNow() {
    const inp = $("#neoLiveUrl");
    const u = String(inp?.value || "").trim();
    if (!u) return toast("No URL");
    if (!Mods.looksLikeMod(u)) return toast("Needs .js url");
    try { await Neo.load(u); toast("Loaded"); }
    catch { toast("Load blocked"); }
  }

  async function loadSavedLive() {
    const saved = Mods.readLiveList();
    const off = Store.sessSet(Keys.liveSessionOff);
    const selfUrl = Mods.normalize((document.currentScript && document.currentScript.src) || "");
    for (const u of saved) {
      if (off.has(u)) continue;
      if (Mods.normalize(u) === selfUrl) continue;
      try { await Neo.load(u); } catch {}
    }
    toast("Loaded saved");
  }

  function renderLiveList() {
    const list = $("#neoLiveList");
    if (!list) return;

    const saved = Mods.readLiveList();
    const off = Store.sessSet(Keys.liveSessionOff);

    list.innerHTML = "";
    list.appendChild(el("div", { class: "neoSmall", style: "margin-top:10px;" },
      `Saved ${saved.length} • Session Off ${off.size}`
    ));

    for (const url of saved) {
      const row = el("div", { class: "neoRow", style: "margin-top:10px;" });

      const sessionBtn = el("button", { class: "neoBtn ghost" }, off.has(url) ? "Enable" : "Session Off");
      sessionBtn.onclick = () => {
        const set = Store.sessSet(Keys.liveSessionOff);
        if (set.has(url)) set.delete(url); else set.add(url);
        Store.saveSessSet(Keys.liveSessionOff, set);
        renderLiveList();
      };

      row.append(
        el("span", { style: "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" }, url),
        el("button", { class: "neoBtn ghost", onclick: () => Neo.load(url).then(() => toast("Loaded")).catch(() => toast("Load blocked")) }, "Load"),
        sessionBtn,
        el("button", { class: "neoBtn ghost", onclick: () => navigator.clipboard?.writeText(url).catch(() => prompt("Copy:", url)) }, "Copy"),
        el("button", {
          class: "neoBtn ghost",
          onclick: () => {
            Mods.writeLiveList(Mods.readLiveList().filter(x => x !== url));
            const set = Store.sessSet(Keys.liveSessionOff); set.delete(url); Store.saveSessSet(Keys.liveSessionOff, set);
            renderLiveList();
            toast("Removed");
          }
        }, "Remove")
      );

      list.appendChild(row);
    }
  }

  function applySettings() {
    safe(() => {
      const s = Store.settings();
      document.body.classList.toggle("neoUI", !!s.enableNeoUI);
      document.body.classList.toggle("neoTopStyle", !!(s.enableNeoUI && s.restyleTop));
      document.body.classList.toggle("neoHideVanilla", !!(s.enableNeoUI && s.elementsPanel && s.hideVanillaElements));

      UI.injectCSS();
      applyBodyFlags();
      buildSettings();
      UI.updateTop();
      syncOverlayEdges();
      renderCats();
      renderElements();
      UI.renderInfo();

      injectCreditTagHard();
    });
  }

  function ensureDefaults() {
    const s = Store.settings();
    if (localStorage.getItem(Keys.scale) == null) localStorage.setItem(Keys.scale, String(s.scale));
    if (localStorage.getItem(Keys.topLift) == null) localStorage.setItem(Keys.topLift, String(s.topLift));
    if (localStorage.getItem(Keys.tps) == null) localStorage.setItem(Keys.tps, String(s.tps));
    if (localStorage.getItem(Keys.wE) == null) localStorage.setItem(Keys.wE, "560");
    if (localStorage.getItem(Keys.wS) == null) localStorage.setItem(Keys.wS, "560");
    if (localStorage.getItem(Keys.openE) == null) localStorage.setItem(Keys.openE, s.openElementsOnStart ? "1" : "0");
    if (localStorage.getItem(Keys.openS) == null) localStorage.setItem(Keys.openS, "0");
    if (localStorage.getItem(Keys.maxE) == null) localStorage.setItem(Keys.maxE, "0");
    if (localStorage.getItem(Keys.maxS) == null) localStorage.setItem(Keys.maxS, "0");
    if (localStorage.getItem(Keys.compact) == null) localStorage.setItem(Keys.compact, s.compactGrid ? "1" : "0");
    if (localStorage.getItem(Keys.hideCats) == null) localStorage.setItem(Keys.hideCats, s.hideCategories ? "1" : "0");
    if (localStorage.getItem(Keys.tab) == null) localStorage.setItem(Keys.tab, "all");
    if (localStorage.getItem(Keys.cat) == null) localStorage.setItem(Keys.cat, "all");
  }

  function panicReset() {
    localStorage.setItem(Keys.scale, "1.30");
    localStorage.setItem(Keys.topLift, "10");
    localStorage.setItem(Keys.tps, "60");
    localStorage.setItem(Keys.wE, "560");
    localStorage.setItem(Keys.wS, "560");
    localStorage.setItem(Keys.maxE, "0");
    localStorage.setItem(Keys.maxS, "0");
    localStorage.setItem(Keys.openE, "1");
    localStorage.setItem(Keys.openS, "0");
    localStorage.setItem(Keys.compact, "1");
    localStorage.setItem(Keys.hideCats, "0");
    localStorage.setItem(Keys.tab, "all");
    localStorage.setItem(Keys.cat, "all");
    toast("Reset");
    applySettings();
  }

  function enhanceModsMenuBar() {
    safe(() => {
      const s = Store.settings();
      if (!s.enableNeoUI || !s.modsBar) return;

      const root = $("#modManager") || $("#modManagerScreen") || $("#modMenu") || $("#modMenuScreen");
      if (!root) return;
      if ($("#neoModTools", root)) return;

      const bar = el("div", { id: "neoModTools" },
        el("input", { id: "neoModSearch", type: "text", placeholder: "Search mods…" }),
        el("button", { class: "neoMiniBtn", onclick: () => { setOpenS(true); setTimeout(() => $("#neoStartAdd")?.focus(), 80); } }, "Neo Mods"),
        el("button", { class: "neoMiniBtn", onclick: () => UI.setScale(UI.scale() + 0.06) }, "UI +"),
        el("button", { class: "neoMiniBtn", onclick: () => UI.setScale(UI.scale() - 0.06) }, "UI −"),
        el("button", { class: "neoMiniBtn", onclick: () => { const i = $("#neoModSearch", root); i.value = ""; i.dispatchEvent(new Event("input")); } }, "Clear")
      );

      root.prepend(bar);

      const input = $("#neoModSearch", root);
      input.addEventListener("input", () => {
        const q = input.value.trim().toLowerCase();
        const checks = $$('input[type="checkbox"]', root);
        const rows = new Set();
        for (const cb of checks) {
          const row = cb.closest("div, li, tr") || cb.parentElement;
          if (row && row.textContent && row.textContent.trim()) rows.add(row);
        }
        for (const r of rows) {
          const t = (r.textContent || "").toLowerCase();
          r.style.display = (!q || t.includes(q)) ? "" : "none";
        }
      });
    });
  }

  function installHotkeys() {
    window.addEventListener("keydown", (ev) => {
      const s = Store.settings();
      if (!s.enableNeoUI) return;

      const a = document.activeElement;
      const typing = a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");

      if (!typing && s.elementsPanel && ev.key.toLowerCase() === "b") { ev.preventDefault(); setOpenE(!isOpenE()); }
      if (!typing && s.settingsPanel && ev.key.toLowerCase() === "o") { ev.preventDefault(); setOpenS(!isOpenS()); }
      if (!typing && s.elementsPanel && ev.key === "/") { ev.preventDefault(); setOpenE(true); $("#neoSearch")?.focus(); $("#neoSearch")?.select(); }
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "0") { ev.preventDefault(); panicReset(); }
    }, { passive: false });
  }

  function boot() {
    safe(() => {
      ensureDefaults();

      Mods.dedupeEnabledMods();

      document.body.style.setProperty("--neoScale", String(UI.scale()));
      UI.setTPS(UI.getTPS());

      UI.injectCSS();
      buildUI();

      document.body.classList.add("neoUI");

      $("#neoElements")?.classList.toggle("open", isOpenE());
      $("#neoSettings")?.classList.toggle("open", isOpenS());
      $("#neoElements")?.classList.toggle("neoMax", isMax("elements"));
      $("#neoSettings")?.classList.toggle("neoMax", isMax("settings"));

      applySettings();
      UI.updateTop();
      syncOverlayEdges();

      Mods.syncStartupFromEnabled();
      Mods.applyStartupToEnabled();

      renderCats();
      renderElements();
      renderStartupList();
      renderLiveList();
      UI.renderInfo();

      enhanceModsMenuBar();
      installHotkeys();

      injectCreditTagHard();
      startCreditObserver();

      setInterval(() => {
        UI.updateTop();
        syncOverlayEdges();
        UI.renderInfo();
        enhanceModsMenuBar();
        injectCreditTagHard();
      }, 900);

      window.addEventListener("resize", () => {
        UI.updateTop();
        syncOverlayEdges();
      });

      Neo.emit("elements", window.elements);
      Neo.emit("ready");
      toast("Neo UI+ loaded");
    });
  }

  function waitForGameReady(start) {
    const tryStart = () => {
      const uiOk = !!$("#toolControls") || !!$("#controls");
      const elementsOk = !!(window.elements && Object.keys(window.elements).length > 20);
      if (uiOk && elementsOk) return start();
      setTimeout(tryStart, 80);
    };
    tryStart();
  }

  const start = () => waitForGameReady(boot);

  if (typeof window.runAfterLoad === "function") window.runAfterLoad(start);
  else window.addEventListener("load", start, { once: true });
})();
