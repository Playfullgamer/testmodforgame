(() => {
  "use strict";

  if (window.__NEO_UI_PLUS__) return;
  window.__NEO_UI_PLUS__ = { v: "3.6.0" };

  const Keys = {
    settings: "neo_ui/settings_v36",
    favs: "neo_ui/favs_v36",
    recents: "neo_ui/recents_v36",
    openElements: "neo_ui/open_elements_v36",
    openSettings: "neo_ui/open_settings_v36",
    maxElements: "neo_ui/max_elements_v36",
    maxSettings: "neo_ui/max_settings_v36",
    widthElements: "neo_ui/width_elements_v36",
    widthSettings: "neo_ui/width_settings_v36",
    tab: "neo_ui/tab_v36",
    cat: "neo_ui/cat_v36",
    compact: "neo_ui/compact_v36",
    hideCats: "neo_ui/hideCats_v36",
    scale: "neo_ui/scale_v36",
    topLift: "neo_ui/topLift_v36",
    tps: "neo_ui/tps_v36",

    startupMods: "neo_ui/startupMods_v36",      
    startupSessionOff: "neo_ui/startupSessionOff_v36", 
    enabledModsKeyGuess: "neo_ui/enabledModsKeyGuess_v36",

    liveMods: "neo_ui/liveMods_v36",
    liveSessionOff: "neo_ui/liveSessionOff_v36",
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

    smarterHumans: false,
  };

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
    readSettings() {
      const s = Store.readJSON(Keys.settings, {});
      return { ...Defaults, ...(s && typeof s === "object" ? s : {}) };
    },
    saveSettings(patch) {
      const next = { ...Store.readSettings(), ...patch };
      Store.writeJSON(Keys.settings, next);
      return next;
    },
    readList(key) {
      const v = Store.readJSON(key, []);
      return Array.isArray(v) ? v.filter(Boolean) : [];
    },
    saveList(key, arr, cap) {
      const a = Array.isArray(arr) ? arr.filter(Boolean) : [];
      Store.writeJSON(key, cap ? a.slice(0, cap) : a);
    },
    readSessionSet(key) {
      try {
        const v = JSON.parse(sessionStorage.getItem(key) || "[]");
        return new Set(Array.isArray(v) ? v : []);
      } catch {
        return new Set();
      }
    },
    writeSessionSet(key, set) {
      sessionStorage.setItem(key, JSON.stringify(Array.from(set || new Set())));
    },
  };

  const UI = {
    ids: {
      style: "neoStyleV36",
      overlay: "neoOverlay",
      elements: "neoElements",
      settings: "neoSettings",
      edgeE: "neoEdgeElements",
      edgeS: "neoEdgeSettings",
      toast: "neoToast",
      info: "neoInfo",
      topE: "neoTopElements",
      topS: "neoTopSettings",
    },
    state: {
      tab: localStorage.getItem(Keys.tab) || "all",
      cat: localStorage.getItem(Keys.cat) || "all",
    },
    get scale() {
      const s = Store.readSettings();
      const raw = localStorage.getItem(Keys.scale);
      const v = raw == null ? s.scale : parseFloat(raw);
      return clamp(Number.isFinite(v) ? v : s.scale, 1.0, 1.75);
    },
    setScale(v) {
      const n = clamp(v, 1.0, 1.75);
      localStorage.setItem(Keys.scale, String(n));
      document.body.style.setProperty("--neoScale", String(n));
      UI.updateTop();
      UI.toast(`UI ${n.toFixed(2)}`);
    },
    get topLift() {
      const s = Store.readSettings();
      const raw = localStorage.getItem(Keys.topLift);
      const v = raw == null ? s.topLift : parseInt(raw, 10);
      return clamp(Number.isFinite(v) ? v : s.topLift, 0, 28);
    },
    setTopLift(v) {
      const n = clamp(Math.round(v), 0, 28);
      localStorage.setItem(Keys.topLift, String(n));
      UI.updateTop();
    },
    toast(msg) {
      const s = Store.readSettings();
      if (!s.enableNeoUI) return;
      const t = $(`#${UI.ids.toast}`);
      if (!t) return;
      t.textContent = String(msg ?? "");
      t.style.display = "block";
      clearTimeout(UI.toast._tm);
      UI.toast._tm = setTimeout(() => (t.style.display = "none"), 1100);
    },
    injectCSS() {
      $(`#${UI.ids.style}`)?.remove();
      const st = document.createElement("style");
      st.id = UI.ids.style;
      st.textContent = UI.cssText();
      document.head.appendChild(st);
    },
    cssText() {
      return `
body.neoUI{
  --neoScale:${UI.scale};
  --neoTop:96px;
  --neoWE:${clamp(parseInt(localStorage.getItem(Keys.widthElements) || "560", 10) || 560, 340, 980)}px;
  --neoWS:${clamp(parseInt(localStorage.getItem(Keys.widthSettings) || "560", 10) || 560, 340, 980)}px;

  --neoPanel:rgba(18,21,28,.92);
  --neoPanel2:rgba(14,16,22,.92);
  --neoBorder:rgba(255,255,255,.12);
  --neoBorder2:rgba(255,255,255,.08);
  --neoText:rgba(255,255,255,.92);
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

#${UI.ids.overlay}{
  position:fixed; inset:0;
  background:rgba(0,0,0,.40);
  z-index:999980;
  display:none;
  pointer-events:none;
}
#${UI.ids.overlay}.open{display:block;pointer-events:auto;}

.neoEdge{
  position:fixed;
  top:calc(var(--neoTop) + 10px);
  z-index:999995;
  user-select:none;
  cursor:pointer;
  color:var(--neoText);
  background:linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
  border:1px solid var(--neoBorder);
  box-shadow:var(--neoShadow2);
  padding:10px 10px;
  border-radius:14px;
  opacity:.96;
}
.neoEdge.hidden{display:none;}
.neoEdge .lbl{display:block;font-weight:900;letter-spacing:.6px;font-size:12px;}
.neoEdge .sub{display:block;font-size:11px;color:var(--neoMuted);margin-top:2px;}
#${UI.ids.edgeE}{left:8px;}
#${UI.ids.edgeS}{right:8px;}

.neoDrawer{
  position:fixed;
  top:var(--neoTop);
  height:calc(100vh - var(--neoTop));
  z-index:999990;
  color:var(--neoText);
  background:var(--neoPanel);
  border:1px solid var(--neoBorder);
  box-shadow:var(--neoShadow);
  border-radius:18px;
  display:flex;
  flex-direction:column;
  max-width:calc(100vw - 16px);
  min-height:340px;
  overflow:hidden;
}

#${UI.ids.elements}{
  left:8px;
  width:var(--neoWE);
  transform:translateX(-110%);
  transition:transform 160ms ease;
}
#${UI.ids.elements}.open{transform:translateX(0);}

#${UI.ids.settings}{
  right:8px;
  width:var(--neoWS);
  transform:translateX(110%);
  transition:transform 160ms ease;
}
#${UI.ids.settings}.open{transform:translateX(0);}

.neoMax{
  left:8px !important;
  right:8px !important;
  width:auto !important;
  top:var(--neoTop) !important;
  bottom:8px !important;
  height:auto !important;
  transform: none !important;
}

.neoHdr{
  display:flex;align-items:center;justify-content:space-between;
  gap:8px;padding:12px;
  border-bottom:1px solid var(--neoBorder2);
  background:rgba(0,0,0,.10);
}
.neoTitle{font-weight:900;letter-spacing:.6px;}
.neoBtns{display:flex;gap:8px;align-items:center;}
.neoBtn{
  border-radius:12px;
  border:1px solid var(--neoBorder2);
  background:linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
  color:var(--neoText);
  padding:8px 10px;
  cursor:pointer;
}
.neoBtn.ghost{background:rgba(255,255,255,.03);}

.neoTabs{display:flex;gap:8px;padding:10px 12px 0 12px;}
.neoTab{
  flex:1;text-align:center;
  padding:8px 10px;
  border-radius:999px;
  border:1px solid var(--neoBorder2);
  background:rgba(255,255,255,.04);
  cursor:pointer;
}
.neoTab.active{border-color:rgba(76,201,240,.55);background:rgba(76,201,240,.10);}

.neoSearchRow{display:flex;gap:8px;padding:10px 12px 12px 12px;border-bottom:1px solid var(--neoBorder2);}
#neoSearch{
  flex:1;border-radius:14px;border:1px solid var(--neoBorder2);
  background:rgba(255,255,255,.05);
  color:var(--neoText);
  padding:10px 12px;
  outline:none;
}

/* Elements layout */
#neoElBody{
  flex:1;
  display:grid;
  grid-template-columns:190px 1fr;
  gap:10px;
  padding:10px 12px 12px 12px;
  overflow:hidden;
  min-height:240px;
}
body.neoUI.neoHideCats #neoElBody{grid-template-columns:1fr;}
body.neoUI.neoHideCats #neoCats{display:none;}
#neoCats{
  border:1px solid var(--neoBorder2);
  border-radius:14px;
  background:var(--neoPanel2);
  overflow:auto;
  padding:8px;
}
#neoElRight{display:flex;flex-direction:column;gap:10px;overflow:hidden;min-height:240px;}
#neoGridWrap{
  flex:1;
  border:1px solid var(--neoBorder2);
  border-radius:14px;
  background:var(--neoPanel2);
  overflow:hidden;
  display:flex;
  flex-direction:column;
  min-height:220px;
}
#neoGridHead{
  padding:10px;
  border-bottom:1px solid var(--neoBorder2);
  display:flex;justify-content:space-between;align-items:center;gap:10px;
}
#neoCount{font-size:12px;color:var(--neoMuted);}

/* name visibility fix: 2-line clamp + tooltip */
#neoGrid{
  padding:10px;
  overflow:auto;
  display:grid;
  grid-template-columns:repeat(auto-fill, minmax(170px, 1fr));
  gap:10px;
  min-height:200px;
}
body.neoUI.neoCompact #neoGrid{
  grid-template-columns:repeat(auto-fill, minmax(150px, 1fr));
  gap:8px;
}
#${UI.ids.elements}.neoMax #neoGrid{
  grid-template-columns:repeat(auto-fill, minmax(210px, 1fr));
}
#${UI.ids.elements}.neoMax #neoElBody{
  grid-template-columns:240px 1fr;
}

.neoElBtn{
  display:flex;align-items:flex-start;gap:10px;
  padding:10px;border-radius:14px;
  border:1px solid var(--neoBorder2);
  background:linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.03));
  cursor:pointer;
  min-height:44px;
}
.neoDot{width:14px;height:14px;border-radius:999px;box-shadow:inset 0 0 0 2px rgba(0,0,0,.25);margin-top:2px;}
.neoName{
  overflow:hidden;
  display:-webkit-box;
  -webkit-box-orient:vertical;
  -webkit-line-clamp:2;
  white-space:normal;
  line-height:1.12;
  margin-top:1px;
}
#${UI.ids.elements}.neoMax .neoName{-webkit-line-clamp:3;}
.neoStarBtn{
  margin-left:auto;
  border:1px solid rgba(255,255,255,.14);
  background:rgba(255,255,255,.05);
  color:rgba(255,255,255,.90);
  border-radius:12px;
  padding:6px 8px;
  cursor:pointer;
}
.neoStarBtn.on{
  border-color:rgba(167,139,250,.45);
  background:rgba(167,139,250,.12);
}

#neoPreview{
  border:1px solid var(--neoBorder2);
  border-radius:14px;
  background:rgba(255,255,255,.04);
  padding:10px;
  display:none;
}
#neoPreview.show{display:block;}
#neoPreview .muted{color:var(--neoMuted);font-size:12px;}

#${UI.ids.toast}{
  position:fixed;left:12px;bottom:12px;
  z-index:999999;display:none;
  padding:10px 12px;border-radius:14px;
  background:rgba(12,14,18,.94);
  border:1px solid var(--neoBorder);
  color:var(--neoText);
  box-shadow:var(--neoShadow2);
  font-size:12px;
}

#neoSettingsBody{flex:1;overflow:auto;padding:10px 12px 12px 12px;}
.neoSection{margin:12px 0 8px 0;font-weight:900;letter-spacing:.4px;}
.neoToggle{display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:14px;cursor:pointer;}
.neoToggle:hover{background:rgba(255,255,255,.05);}
.neoSmall{font-size:12px;color:var(--neoMuted);margin-top:2px;}

.neoCard{
  border:1px solid var(--neoBorder2);
  border-radius:14px;
  background:rgba(0,0,0,.10);
  padding:10px;
}
.neoRow{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
.neoInput{
  flex:1;min-width:240px;
  border-radius:14px;border:1px solid var(--neoBorder2);
  background:rgba(255,255,255,.05);
  color:var(--neoText);
  padding:10px 12px;outline:none;
}
.neoBadge{
  font-size:11px;padding:6px 10px;border-radius:999px;
  border:1px solid rgba(255,255,255,.14);
  background:rgba(255,255,255,.06);
  color:rgba(255,255,255,.72);
}
.neoBadge.ok{border-color:rgba(80,220,140,.35);background:rgba(80,220,140,.12);color:rgba(210,255,230,.9);}
.neoBadge.warn{border-color:rgba(255,200,90,.35);background:rgba(255,200,90,.12);color:rgba(255,240,210,.92);}

#neoModTools{
  display:flex;
  gap:10px;
  align-items:center;
  padding:10px 10px;
  margin:10px 0;
  border-radius:16px;
  background:rgba(0,0,0,.20);
  border:1px solid rgba(255,255,255,.10);
}
#neoModSearch{
  flex:1;
  padding:10px 12px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,.14);
  background:rgba(255,255,255,.05);
  color:rgba(255,255,255,.92);
  outline:none;
}
#neoModSearch::placeholder{color:rgba(255,255,255,.60);}
.neoMiniBtn{
  padding:10px 12px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,.14);
  background:linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
  color:rgba(255,255,255,.92);
  cursor:pointer;
  white-space:nowrap;
}

/* info pill */
#${UI.ids.info}{
  position:fixed;
  z-index:999970;
  right:10px;
  top:10px;
  pointer-events:none;
  display:none;
}
#${UI.ids.info}.on{display:block;}
#${UI.ids.info} .pill{
  max-width:min(680px, 92vw);
  border:1px solid rgba(255,255,255,.16);
  background:rgba(12,12,14,.62);
  backdrop-filter:blur(10px);
  -webkit-backdrop-filter:blur(10px);
  border-radius:999px;
  padding:8px 12px;
  display:flex;
  gap:10px;
  align-items:center;
  flex-wrap:wrap;
  box-shadow:0 14px 40px rgba(0,0,0,.35);
  color:rgba(255,255,255,.90);
  font-size:12px;
}
#${UI.ids.info} b{color:rgba(255,255,255,.92);}
#${UI.ids.info} span{color:rgba(255,255,255,.74);}

/* credit tag */
.neoCreditTag{
  color: rgba(167,139,250,.95);
  font-weight: 900;
  margin-left: 8px;
}
      `;
    },
  };

  const Elements = {
    get favorites() { return Store.readList(Keys.favs); },
    set favorites(v) { Store.saveList(Keys.favs, v, 80); },
    get recents() { return Store.readList(Keys.recents); },
    set recents(v) { Store.saveList(Keys.recents, v, 40); },

    elementColor(name) {
      const def = window.elements?.[name];
      const c = def?.color;
      if (Array.isArray(c) && c.length) return c[0];
      if (typeof c === "string") return c;
      return "rgba(255,255,255,.35)";
    },
    prettyName(name) {
      const def = window.elements?.[name];
      const v = def?.name || def?.displayName || def?.label;
      if (typeof v === "string" && v.trim()) return v.trim();
      return String(name).replace(/_/g, " ");
    },
    buildIndex() {
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
    categoryLabels() {
      const map = new Map();
      for (const b of $$(".categoryButton")) {
        const id = b.id || "";
        const key = id.startsWith("categoryButton-") ? id.replace("categoryButton-", "") : (b.getAttribute("category") || b.getAttribute("data-category"));
        if (!key) continue;
        const label = (b.textContent || "").trim();
        if (label) map.set(key, label);
      }
      return map;
    },
    toggleFav(name) {
      const f = Elements.favorites.slice();
      const i = f.indexOf(name);
      if (i >= 0) f.splice(i, 1);
      else f.unshift(name);
      Elements.favorites = f;
    },
  };

  const Mods = {
    looksLikeMod(s) {
      if (typeof s !== "string") return false;
      const t = s.trim().toLowerCase();
      return t.endsWith(".js") || t.includes(".js?") || t.startsWith("http://") || t.startsWith("https://");
    },
    normalize(u) {
      return String(u || "").trim().replace(/[?#].*$/,"").replace(/\/+$/,"");
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

    readStartupLibrary() {
      const v = Store.readJSON(Keys.startupMods, []);
      if (!Array.isArray(v)) return [];
      return v
        .filter(x => x && typeof x.id === "string")
        .map(x => ({ id: x.id.trim(), enabled: !!x.enabled, addedAt: Number(x.addedAt || Date.now()) }))
        .filter(x => x.id);
    },
    writeStartupLibrary(arr) {
      const out = [];
      const seen = new Set();
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
      const lib = Mods.readStartupLibrary();
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
      Mods.writeStartupLibrary(out);
    },
    applyStartupToEnabled() {
      const off = Store.readSessionSet(Keys.startupSessionOff);
      const lib = Mods.readStartupLibrary();
      Mods.writeEnabledMods(lib.filter(x => x.enabled && !off.has(x.id)).map(x => x.id));
    },

    readLiveList() {
      const v = Store.readJSON(Keys.liveMods, []);
      return Array.isArray(v) ? v.map(x => String(x||"").trim()).filter(Boolean) : [];
    },
    writeLiveList(arr) {
      const seen = new Set();
      const out = [];
      for (const x of arr || []) {
        const id = String(x||"").trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
      }
      Store.writeJSON(Keys.liveMods, out);
      return out;
    },
  };

  const Neo = (window.NeoModLoader ||= {});
  Neo.version = "1.2.0";
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
  Neo.patch = (obj, key, wrap) => {
    if (!obj || !key || typeof wrap !== "function") return null;
    const old = obj[key];
    obj[key] = wrap(old);
    return () => { obj[key] = old; };
  };
  Neo.element = (name, mut) => {
    if (!window.elements?.[name] || typeof mut !== "function") return false;
    try { mut(window.elements[name], Neo.refs()); return true; } catch { return false; }
  };
  Neo.load = (url) => new Promise((resolve, reject) => {
    const u = String(url || "").trim();
    if (!u) return reject(new Error("no url"));
    const off = Store.readSessionSet(Keys.liveSessionOff);
    if (off.has(u)) return reject(new Error("session off"));
    if (document.querySelector(`script[data-neo-mod="${CSS.escape(u)}"]`)) return resolve({ url: u, already: true });

    const s = document.createElement("script");
    s.src = u;
    s.async = true;
    s.dataset.neoMod = u;
    s.onload = () => resolve({ url: u });
    s.onerror = () => reject(new Error("load failed"));
    document.head.appendChild(s);
  });

  const EngineHooks = {
    _installed: false,
    install() {
      if (EngineHooks._installed) return;
      EngineHooks._installed = true;

      const wrapIfExists = (name, hookName) => {
        if (typeof window[name] !== "function") return false;
        if (window[name]._neoWrapped) return true;
        const orig = window[name];
        const wrapped = function(...args) {
          try { Neo.emit(hookName, Neo.refs()); } catch {}
          return orig.apply(this, args);
        };
        wrapped._neoWrapped = true;
        window[name] = wrapped;
        return true;
      };

      wrapIfExists("tick", "tick") || wrapIfExists("doTick", "tick") || wrapIfExists("updateGame", "tick");
      wrapIfExists("draw", "draw") || wrapIfExists("render", "draw");

      if (typeof window.selectElement === "function" && !window.selectElement._neoWrapped) {
        const orig = window.selectElement;
        const wrapped = function(name, ...rest) {
          try { Neo.emit("elementSelected", name, Neo.refs()); } catch {}
          return orig.call(this, name, ...rest);
        };
        wrapped._neoWrapped = true;
        window.selectElement = wrapped;
      }
    }
  };

  const Credits = {
    inject() {
      const want = /developed by\s*r74n/i;
      let target = null;

      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = tw.nextNode())) {
        const txt = (n.nodeValue || "").trim();
        if (!txt) continue;
        if (want.test(txt)) { target = n.parentElement; break; }
        const p = n.parentElement;
        if (p && want.test(p.textContent || "")) { target = p; break; }
      }
      if (!target) return;
      if (target.querySelector?.(".neoCreditTag")) return;
      target.appendChild(Object.assign(document.createElement("span"), { className: "neoCreditTag", textContent: "modded by Playfullgamer" }));
    }
  };

  const TPS = {
    get() {
      const raw = localStorage.getItem(Keys.tps);
      const v = raw == null ? Store.readSettings().tps : parseFloat(raw);
      return clamp(Number.isFinite(v) ? v : 60, 1, 1000);
    },
    set(v) {
      const n = clamp(Math.round(v), 1, 1000);
      localStorage.setItem(Keys.tps, String(n));
      const keys = ["tps","TPS","tickSpeed","ticksPerSecond","targetTPS"];
      for (const k of keys) if (typeof window[k] === "number") window[k] = n;
      UI.renderInfo();
    }
  };

  UI.renderInfo = () => {
    const s = Store.readSettings();
    const info = $(`#${UI.ids.info}`);
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
      <span><b>TPS:</b> ${String(TPS.get())}</span>
    `;
  };

  UI.updateTop = () => {
    const vh = window.innerHeight || 800;
    let top = 64;

    const consider = (node) => {
      if (!node) return;
      const r = node.getBoundingClientRect();
      if (r.bottom <= 0) return;
      if (r.top > vh * 0.45) return; // ignore bottom bars
      top = Math.max(top, Math.round(r.bottom) + 8);
    };

    consider($("#toolControls"));
    consider($("#controls"));

    top = clamp(top, 56, Math.floor(vh * 0.35));
    top = clamp(top - UI.topLift, 48, Math.floor(vh * 0.35));

    document.body.style.setProperty("--neoTop", `${top}px`);

    const info = $(`#${UI.ids.info}`);
    if (info) info.style.top = `${Math.max(10, top - 44)}px`;
  };

  const Layout = {
    openElements() { return localStorage.getItem(Keys.openElements) === "1"; },
    openSettings() { return localStorage.getItem(Keys.openSettings) === "1"; },
    maxElements() { return localStorage.getItem(Keys.maxElements) === "1"; },
    maxSettings() { return localStorage.getItem(Keys.maxSettings) === "1"; },

    setOpenElements(v) {
      const s = Store.readSettings();
      if (!s.enableNeoUI || !s.elementsPanel) return;
      if (v && window.innerWidth < 900) Layout.setOpenSettings(false);
      localStorage.setItem(Keys.openElements, v ? "1" : "0");
      $(`#${UI.ids.elements}`)?.classList.toggle("open", v);
      Layout.syncOverlay();
      UI.updateTop();
      Layout.syncEdges();
    },
    setOpenSettings(v) {
      const s = Store.readSettings();
      if (!s.enableNeoUI || !s.settingsPanel) return;
      if (v && window.innerWidth < 900) Layout.setOpenElements(false);
      localStorage.setItem(Keys.openSettings, v ? "1" : "0");
      $(`#${UI.ids.settings}`)?.classList.toggle("open", v);
      Layout.syncOverlay();
      UI.updateTop();
      Layout.syncEdges();
    },
    setMax(which, v) {
      if (which === "elements") {
        localStorage.setItem(Keys.maxElements, v ? "1" : "0");
        $(`#${UI.ids.elements}`)?.classList.toggle("neoMax", v);
        if (v) {
          localStorage.setItem(Keys.maxSettings, "0");
          $(`#${UI.ids.settings}`)?.classList.remove("neoMax");
          Layout.setOpenSettings(false);
          Layout.setOpenElements(true);
        }
      } else {
        localStorage.setItem(Keys.maxSettings, v ? "1" : "0");
        $(`#${UI.ids.settings}`)?.classList.toggle("neoMax", v);
        if (v) {
          localStorage.setItem(Keys.maxElements, "0");
          $(`#${UI.ids.elements}`)?.classList.remove("neoMax");
          Layout.setOpenElements(false);
          Layout.setOpenSettings(true);
        }
      }
    },
    syncOverlay() {
      const overlay = $(`#${UI.ids.overlay}`);
      if (!overlay) return;
      overlay.classList.toggle("open", Layout.openElements() || Layout.openSettings());
    },
    syncEdges() {
      const s = Store.readSettings();
      const showE = !!(s.enableNeoUI && s.elementsPanel);
      const showS = !!(s.enableNeoUI && s.settingsPanel);
      $(`#${UI.ids.edgeE}`)?.classList.toggle("hidden", !showE || Layout.openElements());
      $(`#${UI.ids.edgeS}`)?.classList.toggle("hidden", !showS || Layout.openSettings());
    },
  };

  const Panels = {
    buildShell() {
      if ($(`#${UI.ids.elements}`)) return;

      document.body.classList.add("neoUI");
      document.body.style.setProperty("--neoScale", String(UI.scale));

      document.body.appendChild(el("div", { id: UI.ids.overlay, onclick: () => { Layout.setOpenElements(false); Layout.setOpenSettings(false); } }));
      document.body.appendChild(el("div", { id: UI.ids.toast }));
      document.body.appendChild(el("div", { id: UI.ids.info }, el("div", { class: "pill" }, "")));

      const edgeE = el("div", { id: UI.ids.edgeE, class: "neoEdge", onclick: () => Layout.setOpenElements(true) },
        el("span", { class: "lbl" }, "ELEMENTS"),
        el("span", { class: "sub" }, "☰")
      );
      const edgeS = el("div", { id: UI.ids.edgeS, class: "neoEdge", onclick: () => Layout.setOpenSettings(true) },
        el("span", { class: "lbl" }, "SETTINGS"),
        el("span", { class: "sub" }, "⚙")
      );
      document.body.append(edgeE, edgeS);

      const elementsPanel = el("div", { id: UI.ids.elements, class: "neoDrawer" },
        el("div", { class: "neoHdr" },
          el("div", { class: "neoTitle" }, "Elements"),
          el("div", { class: "neoBtns" },
            el("button", { class: "neoBtn ghost", onclick: () => {
              const cur = (localStorage.getItem(Keys.compact) ?? (Store.readSettings().compactGrid ? "1" : "0")) === "1";
              localStorage.setItem(Keys.compact, cur ? "0" : "1");
              Panels.applyBodyFlags();
              Panels.renderElements();
            } }, "▦"),
            el("button", { class: "neoBtn ghost", onclick: () => {
              const cur = (localStorage.getItem(Keys.hideCats) ?? (Store.readSettings().hideCategories ? "1" : "0")) === "1";
              localStorage.setItem(Keys.hideCats, cur ? "0" : "1");
              Panels.applyBodyFlags();
            } }, "☰"),
            el("button", { class: "neoBtn", onclick: () => Layout.setMax("elements", !Layout.maxElements()) }, "⤢"),
            el("button", { class: "neoBtn", onclick: () => Layout.setOpenSettings(true) }, "⚙"),
            el("button", { class: "neoBtn", onclick: () => Layout.setOpenElements(false) }, "×")
          )
        ),
        el("div", { class: "neoTabs" },
          el("div", { class: "neoTab", id: "neoTabAll", onclick: () => Panels.setTab("all") }, "All"),
          el("div", { class: "neoTab", id: "neoTabFav", onclick: () => Panels.setTab("fav") }, "Fav"),
          el("div", { class: "neoTab", id: "neoTabRec", onclick: () => Panels.setTab("recent") }, "Recent")
        ),
        el("div", { class: "neoSearchRow" },
          el("input", { id: "neoSearch", type: "text", placeholder: "Search…" }),
          el("button", { class: "neoBtn", onclick: () => { $("#neoSearch").value = ""; Panels.renderElements(); } }, "×")
        ),
        el("div", { id: "neoElBody" },
          el("div", { id: "neoCats" }),
          el("div", { id: "neoElRight" },
            el("div", { id: "neoGridWrap" },
              el("div", { id: "neoGridHead" },
                el("div", { id: "neoCount" }, ""),
                el("div", { style: "display:flex;gap:8px;align-items:center;" },
                  el("button", { class: "neoBtn ghost", onclick: () => Layout.setOpenElements(false) }, "Hide")
                )
              ),
              el("div", { id: "neoGrid" })
            ),
            el("div", { id: "neoPreview" })
          )
        )
      );

      const settingsPanel = el("div", { id: UI.ids.settings, class: "neoDrawer" },
        el("div", { class: "neoHdr" },
          el("div", { class: "neoTitle" }, "Settings"),
          el("div", { class: "neoBtns" },
            el("button", { class: "neoBtn", onclick: () => Layout.setMax("settings", !Layout.maxSettings()) }, "⤢"),
            el("button", { class: "neoBtn", onclick: () => Layout.setOpenElements(true) }, "☰"),
            el("button", { class: "neoBtn", onclick: () => Layout.setOpenSettings(false) }, "×")
          )
        ),
        el("div", { id: "neoSettingsBody" })
      );

      document.body.append(elementsPanel, settingsPanel);

      $("#neoSearch").addEventListener("input", () => Panels.renderElements());
    },

    applyBodyFlags() {
      const s = Store.readSettings();
      const compact = (localStorage.getItem(Keys.compact) ?? (s.compactGrid ? "1" : "0")) === "1";
      const hideCats = (localStorage.getItem(Keys.hideCats) ?? (s.hideCategories ? "1" : "0")) === "1";
      document.body.classList.toggle("neoCompact", compact);
      document.body.classList.toggle("neoHideCats", hideCats);
    },

    setTab(t) {
      UI.state.tab = t;
      localStorage.setItem(Keys.tab, t);
      $("#neoTabAll")?.classList.toggle("active", t === "all");
      $("#neoTabFav")?.classList.toggle("active", t === "fav");
      $("#neoTabRec")?.classList.toggle("active", t === "recent");
      Panels.renderCats();
      Panels.renderElements();
    },

    setCat(c) {
      UI.state.cat = c;
      localStorage.setItem(Keys.cat, c);
      Panels.renderCats();
      Panels.renderElements();
    },

    renderCats() {
      const s = Store.readSettings();
      if (!s.enableNeoUI || !s.elementsPanel) return;

      const wrap = $("#neoCats");
      if (!wrap) return;

      const { cats } = Elements.buildIndex();
      const labels = Elements.categoryLabels();

      wrap.innerHTML = "";
      for (const c of cats) {
        const label = c === "all" ? "All" : (labels.get(c) || String(c).replace(/_/g, " "));
        const btn = el("button", { class: "neoElBtn", style: "justify-content:flex-start;width:100%;" }, label);
        btn.onclick = () => Panels.setCat(c);
        if (UI.state.cat === c) btn.style.outline = "2px solid rgba(167,139,250,.45)";
        wrap.appendChild(btn);
      }
    },

    renderElements() {
      const s = Store.readSettings();
      if (!s.enableNeoUI || !s.elementsPanel) return;

      const grid = $("#neoGrid");
      const count = $("#neoCount");
      if (!grid) return;

      const query = ($("#neoSearch")?.value || "").trim().toLowerCase();
      const favSet = new Set(Elements.favorites);

      const { all, byCat } = Elements.buildIndex();
      let list;
      if (UI.state.tab === "fav") list = Elements.favorites.filter(n => window.elements?.[n]);
      else if (UI.state.tab === "recent") list = Elements.recents.filter(n => window.elements?.[n]);
      else list = (UI.state.cat === "all") ? all : (byCat.get(UI.state.cat) || []);

      list = list.filter(n => {
        const def = window.elements?.[n];
        if (!def || def.hidden) return false;
        if (UI.state.cat !== "all" && String(def.category || "other") !== String(UI.state.cat)) return false;
        return true;
      });

      if (query) {
        list = list.filter(n => Elements.prettyName(n).toLowerCase().includes(query) || String(n).toLowerCase().includes(query));
      }

      if (UI.state.tab === "all" && (localStorage.getItem("neo_ui/fav_first_v36") ?? (s.favFirst ? "1" : "0")) === "1") {
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
        btn.appendChild(el("span", { class: "neoDot", style: `background:${Elements.elementColor(name)};` }));
        btn.appendChild(el("span", { class: "neoName" }, Elements.prettyName(name)));

        const star = el("button", { class: `neoStarBtn ${favSet.has(name) ? "on" : ""}`, title: favSet.has(name) ? "Unfavorite" : "Favorite" }, favSet.has(name) ? "★" : "☆");
        star.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          Elements.toggleFav(name);
          Panels.renderElements();
        };
        btn.appendChild(star);

        btn.onclick = (ev) => {
          if (typeof window.selectElement === "function") window.selectElement(name);
          Elements.recents = [name, ...Elements.recents.filter(x => x !== name)];
          if (!ev.shiftKey && Store.readSettings().autoCloseOnPick) Layout.setOpenElements(false);
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
    },

    buildTopButtons() {
      const s = Store.readSettings();
      const tc = $("#toolControls");
      if (!tc) return;

      $(`#${UI.ids.topE}`)?.remove();
      $(`#${UI.ids.topS}`)?.remove();

      if (s.enableNeoUI && s.elementsPanel) {
        const b = el("button", { id: UI.ids.topE, class: "controlButton", onclick: () => Layout.setOpenElements(!Layout.openElements()) }, "☰ Elements");
        tc.prepend(b);
      }
      if (s.enableNeoUI && s.settingsPanel) {
        const b = el("button", { id: UI.ids.topS, class: "controlButton", onclick: () => Layout.setOpenSettings(!Layout.openSettings()) }, "⚙ Settings");
        tc.appendChild(b);
      }
    },

    buildSettingsPanel() {
      const body = $("#neoSettingsBody");
      if (!body) return;
      body.innerHTML = "";

      const s = Store.readSettings();
      const section = (t) => el("div", { class: "neoSection" }, t);

      const toggle = (key, label, desc) => {
        const id = `neoSet_${key}`;
        return el("label", { class: "neoToggle", for: id },
          el("input", {
            id, type: "checkbox",
            checked: s[key] ? "checked" : null,
            onchange: (ev) => {
              Store.saveSettings({ [key]: !!ev.target.checked });
              App.applySettings();
            }
          }),
          el("div", {}, el("div", { style: "font-weight:800;" }, label), el("div", { class: "neoSmall" }, desc))
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
        toggle("elementsPanel", "Neo Elements panel", "Left elements drawer"),
        toggle("settingsPanel", "Neo Settings panel", "Right settings drawer"),
        toggle("restyleTop", "Top bar style", "Smoother buttons"),
        toggle("hideVanillaElements", "Hide vanilla elements UI", "Only when Neo Elements panel is enabled"),
        toggle("infoBar", "Info bar", "Status pill (non-clickable)"),
        toggle("modsBar", "Better Mods menu bar", "Search + shortcut"),
        toggle("autoCloseOnPick", "Auto-close after pick", "Shift-click keeps panel open"),
        toggle("smarterHumans", "Smarter humans", "Avoid nearby hazards"),

        section("Sizing"),
        slider("UI scale", UI.scale.toFixed(2), 1.0, 1.75, 0.02, UI.scale, (ev) => UI.setScale(parseFloat(ev.target.value))),
        slider("Panel lift", `${UI.topLift}px`, 0, 28, 1, UI.topLift, (ev) => UI.setTopLift(parseInt(ev.target.value, 10))),

        section("TPS"),
        slider("TPS", String(TPS.get()), 1, 1000, 1, TPS.get(), (ev) => TPS.set(parseInt(ev.target.value, 10))),

        section("Mods"),
        ModsUI.build(body),

        section("Modding"),
        el("div", { class: "neoCard" },
          el("div", { class: "neoSmall" }, "NeoModLoader gives easy access to game internals."),
          el("div", { class: "neoRow", style: "margin-top:10px;" },
            el("button", {
              class: "neoBtn",
              onclick: () => {
                const text = [
                  "NeoModLoader.on('ready', fn)",
                  "NeoModLoader.on('tick', fn)",
                  "NeoModLoader.on('draw', fn)",
                  "NeoModLoader.on('elementSelected', fn)",
                  "NeoModLoader.refs()",
                  "NeoModLoader.patch(obj, 'fn', wrap)",
                  "NeoModLoader.element('human', (h, refs) => { ... })",
                  "NeoModLoader.load(url)"
                ].join("\n");
                navigator.clipboard?.writeText(text).catch(() => prompt("Copy:", text));
              }
            }, "Copy API"),
            el("button", {
              class: "neoBtn ghost",
              onclick: () => {
                const refs = Object.keys(Neo.refs()).join("\n");
                navigator.clipboard?.writeText(refs).catch(() => prompt("Copy:", refs));
              }
            }, "Copy refs")
          )
        ),

        section("Reset"),
        el("div", { class: "neoRow" },
          el("button", { class: "neoBtn", onclick: () => App.panicReset() }, "Reset layout")
        )
      );
    },
  };

  const ModsUI = {
    build(parent) {
      const card1 = el("div", { class: "neoCard", id: "neoModsCard" },
        el("div", { class: "neoSmall" }, "Startup mods (apply after reload). Session Off disables for this refresh only."),
        el("div", { class: "neoRow", style: "margin-top:10px;" },
          el("input", { id: "neoStartupAdd", class: "neoInput", placeholder: "Add startup mods… ( ; separated )", type: "text" }),
          el("button", { class: "neoBtn", onclick: () => ModsUI.addStartup(false) }, "Add"),
          el("button", { class: "neoBtn", onclick: () => ModsUI.addStartup(true) }, "Add+Reload"),
          el("button", { class: "neoBtn ghost", onclick: () => location.reload() }, "Reload")
        ),
        el("div", { id: "neoStartupList" })
      );

      const card2 = el("div", { class: "neoCard", style: "margin-top:10px;" },
        el("div", { class: "neoSmall" }, "Neo Mod Loader (loads immediately). Save URLs here for quick loading."),
        el("div", { class: "neoRow", style: "margin-top:10px;" },
          el("input", { id: "neoLiveUrl", class: "neoInput", placeholder: "Live mod URL (.js)", type: "text" }),
          el("button", { class: "neoBtn", onclick: () => ModsUI.loadLiveNow() }, "Load now"),
          el("button", { class: "neoBtn ghost", onclick: () => ModsUI.saveLive() }, "Save"),
          el("button", { class: "neoBtn ghost", onclick: () => ModsUI.backupLive() }, "Backup")
        ),
        el("div", { class: "neoRow", style: "margin-top:10px;" },
          el("button", { class: "neoBtn ghost", onclick: () => ModsUI.loadAllLiveSaved() }, "Load saved"),
          el("button", { class: "neoBtn ghost", onclick: () => ModsUI.clearLiveSessionOff() }, "Clear session-off")
        ),
        el("div", { id: "neoLiveList" })
      );

      parent.append(card1, card2);
      ModsUI.renderStartup();
      ModsUI.renderLive();
    },

    addStartup(reload) {
      const input = $("#neoStartupAdd");
      const raw = String(input?.value || "");
      const incoming = raw.split(";").map(x => x.trim()).filter(Boolean).filter(Mods.looksLikeMod);
      if (!incoming.length) return UI.toast("No mods");

      const lib = Mods.readStartupLibrary();
      const map = new Map(lib.map(x => [x.id, x]));
      for (const id of incoming) {
        const ex = map.get(id);
        if (ex) ex.enabled = true;
        else map.set(id, { id, enabled: true, addedAt: Date.now() });
      }
      const out = [];
      const seen = new Set();
      for (const x of lib) { out.push(map.get(x.id) || x); seen.add(x.id); }
      for (const id of incoming) if (!seen.has(id)) out.push(map.get(id));
      Mods.writeStartupLibrary(out);
      Mods.applyStartupToEnabled();
      ModsUI.renderStartup();
      UI.toast(reload ? "Reloading…" : "Added");
      input.value = incoming.join("; ");
      if (reload) location.reload();
    },

    renderStartup() {
      const list = $("#neoStartupList");
      if (!list) return;

      Mods.syncStartupFromEnabled();
      const lib = Mods.readStartupLibrary().slice().sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.id.localeCompare(b.id));
      const off = Store.readSessionSet(Keys.startupSessionOff);
      const enabledSet = new Set(Mods.readEnabledMods());

      list.innerHTML = "";
      list.appendChild(el("div", { class: "neoSmall", style: "margin-top:10px;" },
        `Saved ${lib.length} • Enabled ${lib.filter(x => x.enabled).length} • Session Off ${off.size}`
      ));

      for (const m of lib) {
        const row = el("div", { class: "neoRow", style: "margin-top:10px;" });

        const cb = el("input", {
          type: "checkbox",
          checked: m.enabled ? "checked" : null,
          onchange: (ev) => {
            const next = Mods.readStartupLibrary().map(x => x.id === m.id ? { ...x, enabled: !!ev.target.checked } : x);
            Mods.writeStartupLibrary(next);
            Mods.applyStartupToEnabled();
            ModsUI.renderStartup();
          }
        });

        const badge = (enabledSet.has(m.id) && !off.has(m.id))
          ? el("span", { class: "neoBadge ok" }, "Enabled")
          : el("span", { class: "neoBadge warn" }, "Reload");

        const sessionBtn = el("button", { class: "neoBtn ghost" }, off.has(m.id) ? "Session Off" : "Session On");
        sessionBtn.onclick = () => {
          const set = Store.readSessionSet(Keys.startupSessionOff);
          if (set.has(m.id)) set.delete(m.id); else set.add(m.id);
          Store.writeSessionSet(Keys.startupSessionOff, set);
          Mods.applyStartupToEnabled();
          ModsUI.renderStartup();
          UI.toast("Reload to apply");
        };

        row.append(
          cb,
          el("span", { style: "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" }, m.id),
          badge,
          sessionBtn,
          el("button", { class: "neoBtn ghost", onclick: () => copyText(m.id) }, "Copy"),
          el("button", {
            class: "neoBtn ghost",
            onclick: () => {
              Mods.writeStartupLibrary(Mods.readStartupLibrary().filter(x => x.id !== m.id));
              const set = Store.readSessionSet(Keys.startupSessionOff); set.delete(m.id); Store.writeSessionSet(Keys.startupSessionOff, set);
              Mods.applyStartupToEnabled();
              ModsUI.renderStartup();
              UI.toast("Removed (reload)");
            }
          }, "Remove")
        );

        list.appendChild(row);
      }
    },

    saveLive() {
      const inp = $("#neoLiveUrl");
      const u = String(inp?.value || "").trim();
      if (!u) return UI.toast("No URL");
      if (!Mods.looksLikeMod(u)) return UI.toast("Needs .js url");

      const list = Mods.readLiveList();
      if (!list.includes(u)) list.push(u);
      Mods.writeLiveList(list);
      ModsUI.renderLive();
      UI.toast("Saved");
    },

    async loadLiveNow() {
      const inp = $("#neoLiveUrl");
      const u = String(inp?.value || "").trim();
      if (!u) return UI.toast("No URL");
      if (!Mods.looksLikeMod(u)) return UI.toast("Needs .js url");
      try {
        await Neo.load(u);
        UI.toast("Loaded");
      } catch {
        UI.toast("Load blocked");
      }
    },

    async loadAllLiveSaved() {
      const saved = Mods.readLiveList();
      const off = Store.readSessionSet(Keys.liveSessionOff);
      const selfUrl = Mods.normalize((document.currentScript && document.currentScript.src) || "");
      let ok = 0, skip = 0, fail = 0;

      for (const u of saved) {
        if (off.has(u)) { skip++; continue; }
        if (Mods.normalize(u) === selfUrl) { skip++; continue; } // prevents self loading again
        try { await Neo.load(u); ok++; } catch { fail++; }
      }
      UI.toast(`Loaded ${ok}${skip ? ` • skipped ${skip}` : ""}${fail ? ` • failed ${fail}` : ""}`);
    },

    clearLiveSessionOff() {
      Store.writeSessionSet(Keys.liveSessionOff, new Set());
      ModsUI.renderLive();
      UI.toast("Cleared");
    },

    backupLive() {
      const cur = Mods.readLiveList();
      copyText(JSON.stringify(cur, null, 2));
      const txt = prompt("Paste JSON array to restore Live Mods (Cancel = keep current).", "");
      if (!txt) return;
      const v = (() => { try { return JSON.parse(txt); } catch { return null; } })();
      if (!Array.isArray(v)) return UI.toast("Bad JSON");
      Mods.writeLiveList(v.map(x => String(x||"").trim()).filter(Boolean).filter(Mods.looksLikeMod));
      ModsUI.renderLive();
      UI.toast("Restored");
    },

    renderLive() {
      const list = $("#neoLiveList");
      if (!list) return;

      const saved = Mods.readLiveList();
      const off = Store.readSessionSet(Keys.liveSessionOff);

      list.innerHTML = "";
      list.appendChild(el("div", { class: "neoSmall", style: "margin-top:10px;" },
        `Saved ${saved.length} • Session Off ${off.size}`
      ));

      for (const url of saved) {
        const row = el("div", { class: "neoRow", style: "margin-top:10px;" });

        const badge = off.has(url)
          ? el("span", { class: "neoBadge warn" }, "Off")
          : el("span", { class: "neoBadge ok" }, "On");

        const sessionBtn = el("button", { class: "neoBtn ghost" }, off.has(url) ? "Enable" : "Session Off");
        sessionBtn.onclick = () => {
          const set = Store.readSessionSet(Keys.liveSessionOff);
          if (set.has(url)) set.delete(url); else set.add(url);
          Store.writeSessionSet(Keys.liveSessionOff, set);
          ModsUI.renderLive();
        };

        row.append(
          el("span", { style: "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" }, url),
          badge,
          el("button", { class: "neoBtn ghost", onclick: () => Neo.load(url).then(() => UI.toast("Loaded")).catch(() => UI.toast("Load blocked")) }, "Load"),
          sessionBtn,
          el("button", { class: "neoBtn ghost", onclick: () => copyText(url) }, "Copy"),
          el("button", {
            class: "neoBtn ghost",
            onclick: () => {
              Mods.writeLiveList(Mods.readLiveList().filter(x => x !== url));
              const set = Store.readSessionSet(Keys.liveSessionOff); set.delete(url); Store.writeSessionSet(Keys.liveSessionOff, set);
              ModsUI.renderLive();
              UI.toast("Removed");
            }
          }, "Remove")
        );

        list.appendChild(row);
      }
    },
  };

  const Behavior = {
    smarterHumans() {
      const s = Store.readSettings();
      if (!s.smarterHumans) return;

      const human = window.elements?.human;
      if (!human || human._neoSmart) return;

      const orig = human.tick;
      if (typeof orig !== "function") return;

      const danger = new Set(["fire","plasma","lava","acid","radiation","explosion","electric","electricity"]);

      human.tick = function(pixel) {
        try {
          const pm = window.pixelMap;
          const isEmpty = window.isEmpty;
          const tryMove = window.tryMove;
          const outOfBounds = window.outOfBounds;
          if (!pixel || !pm || !isEmpty || !tryMove || !outOfBounds) return orig(pixel);

          const x = pixel.x, y = pixel.y;
          let dx = 0, dy = 0, found = false;

          for (let ox = -1; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
              if (!ox && !oy) continue;
              const nx = x + ox, ny = y + oy;
              if (outOfBounds(nx, ny)) continue;
              const p = pm[nx]?.[ny];
              if (p && danger.has(p.element)) { dx -= ox; dy -= oy; found = true; }
            }
          }
          if (found) {
            const ax = dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dx);
            const ay = dy === 0 ? 0 : Math.sign(dy);
            const moves = [[x + ax, y],[x + ax, y + ay],[x, y + ay],[x - ax, y],[x - ax, y + ay]];
            for (const [mx, my] of moves) {
              if (outOfBounds(mx, my)) continue;
              if (isEmpty(mx, my, true) && tryMove(pixel, mx, my)) return;
            }
          }
        } catch {}
        return orig(pixel);
      };

      human._neoSmart = true;
    }
  };

  const ModsMenuBar = {
    findRoot() {
      return $("#modManager") || $("#modManagerScreen") || $("#modMenu") || $("#modMenuScreen");
    },
    enhance() {
      const s = Store.readSettings();
      if (!s.enableNeoUI || !s.modsBar) return;

      const root = ModsMenuBar.findRoot();
      if (!root) return;
      if ($("#neoModTools", root)) return;

      const bar = el("div", { id: "neoModTools" },
        el("input", { id: "neoModSearch", type: "text", placeholder: "Search mods…" }),
        el("button", { class: "neoMiniBtn", onclick: () => { Layout.setOpenSettings(true); setTimeout(() => $("#neoModsCard")?.scrollIntoView({ behavior: "smooth", block: "start" }), 70); } }, "Neo Mods"),
        el("button", { class: "neoMiniBtn", onclick: () => UI.setScale(UI.scale + 0.06) }, "UI +"),
        el("button", { class: "neoMiniBtn", onclick: () => UI.setScale(UI.scale - 0.06) }, "UI −"),
        el("button", { class: "neoMiniBtn", onclick: () => { const i = $("#neoModSearch", root); i.value = ""; i.dispatchEvent(new Event("input")); } }, "Clear")
      );

      root.prepend(bar);

      const input = $("#neoModSearch", root);
      input.addEventListener("input", () => {
        const q = input.value.trim().toLowerCase();
        const rows = (() => {
          const checks = $$('input[type="checkbox"]', root);
          const set = new Set();
          for (const cb of checks) {
            const row = cb.closest("div, li, tr") || cb.parentElement;
            if (row && row.textContent && row.textContent.trim()) set.add(row);
          }
          return Array.from(set);
        })();

        for (const r of rows) {
          const t = (r.textContent || "").toLowerCase();
          r.style.display = (!q || t.includes(q)) ? "" : "none";
        }
      });
    }
  };

  const App = {
    applySettings() {
      const s = Store.readSettings();

      document.body.classList.toggle("neoUI", !!s.enableNeoUI);
      document.body.classList.toggle("neoTopStyle", !!(s.enableNeoUI && s.restyleTop));
      document.body.classList.toggle("neoHideVanilla", !!(s.enableNeoUI && s.elementsPanel && s.hideVanillaElements));

      UI.injectCSS();

      Panels.applyBodyFlags();
      Panels.buildTopButtons();
      Panels.buildSettingsPanel();

      UI.updateTop();
      Layout.syncOverlay();
      Layout.syncEdges();

      if (!s.enableNeoUI || !s.elementsPanel) {
        localStorage.setItem(Keys.openElements, "0");
        $(`#${UI.ids.elements}`)?.classList.remove("open");
      }
      if (!s.enableNeoUI || !s.settingsPanel) {
        localStorage.setItem(Keys.openSettings, "0");
        $(`#${UI.ids.settings}`)?.classList.remove("open");
      }

      Panels.renderCats();
      Panels.renderElements();
      UI.renderInfo();

      ModsMenuBar.enhance();
      Behavior.smarterHumans();
      EngineHooks.install();
      Credits.inject();
    },

    panicReset() {
      localStorage.setItem(Keys.scale, "1.30");
      localStorage.setItem(Keys.topLift, "10");
      localStorage.setItem(Keys.widthElements, "560");
      localStorage.setItem(Keys.widthSettings, "560");
      localStorage.setItem(Keys.maxElements, "0");
      localStorage.setItem(Keys.maxSettings, "0");
      localStorage.setItem(Keys.openElements, "1");
      localStorage.setItem(Keys.openSettings, "0");
      localStorage.setItem(Keys.compact, "1");
      localStorage.setItem(Keys.hideCats, "0");
      localStorage.setItem(Keys.tab, "all");
      localStorage.setItem(Keys.cat, "all");

      document.body.style.setProperty("--neoScale", "1.30");

      $(`#${UI.ids.elements}`)?.classList.add("open");
      $(`#${UI.ids.settings}`)?.classList.remove("open");
      $(`#${UI.ids.elements}`)?.classList.remove("neoMax");
      $(`#${UI.ids.settings}`)?.classList.remove("neoMax");

      UI.updateTop();
      Layout.syncOverlay();
      Layout.syncEdges();
      Panels.applyBodyFlags();
      Panels.setTab("all");
      UI.toast("Reset");
    },
  };

  function initOnce() {
    UI.injectCSS();
    Panels.buildShell();
    Panels.buildTopButtons();

    const s = Store.readSettings();
    document.body.classList.add("neoUI");
    document.body.classList.toggle("neoTopStyle", !!(s.enableNeoUI && s.restyleTop));
    document.body.classList.toggle("neoHideVanilla", !!(s.enableNeoUI && s.elementsPanel && s.hideVanillaElements));

    Panels.applyBodyFlags();

    const openE = localStorage.getItem(Keys.openElements);
    const openS = localStorage.getItem(Keys.openSettings);

    if (openE == null) localStorage.setItem(Keys.openElements, s.openElementsOnStart ? "1" : "0");
    if (openS == null) localStorage.setItem(Keys.openSettings, "0");

    $(`#${UI.ids.elements}`)?.classList.toggle("open", Layout.openElements());
    $(`#${UI.ids.settings}`)?.classList.toggle("open", Layout.openSettings());
    $(`#${UI.ids.elements}`)?.classList.toggle("neoMax", Layout.maxElements());
    $(`#${UI.ids.settings}`)?.classList.toggle("neoMax", Layout.maxSettings());

    UI.updateTop();
    Layout.syncOverlay();
    Layout.syncEdges();

    Panels.buildSettingsPanel();
    Panels.setTab(UI.state.tab);
    Panels.renderCats();
    Panels.renderElements();
    UI.renderInfo();

    Mods.syncStartupFromEnabled();
    Mods.applyStartupToEnabled();

    ModsMenuBar.enhance();
    Behavior.smarterHumans();
    EngineHooks.install();

    Credits.inject();
    setInterval(Credits.inject, 1500);

    setInterval(() => {
      UI.updateTop();
      Layout.syncOverlay();
      Layout.syncEdges();
      UI.renderInfo();
      ModsMenuBar.enhance();
      EngineHooks.install();
    }, 900);

    window.addEventListener("resize", () => {
      UI.updateTop();
      Layout.syncOverlay();
      Layout.syncEdges();
    });

    installHotkeys();

    Neo.emit("elements", window.elements);
    Neo.emit("ready");
    UI.toast("Neo UI+ loaded");
  }

  function installHotkeys() {
    window.addEventListener("keydown", (ev) => {
      const s = Store.readSettings();
      if (!s.enableNeoUI) return;

      const a = document.activeElement;
      const typing = a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");

      if (!typing && s.elementsPanel && ev.key.toLowerCase() === "b") {
        ev.preventDefault();
        Layout.setOpenElements(!Layout.openElements());
      }
      if (!typing && s.settingsPanel && ev.key.toLowerCase() === "o") {
        ev.preventDefault();
        Layout.setOpenSettings(!Layout.openSettings());
      }
      if (!typing && s.elementsPanel && ev.key === "/") {
        ev.preventDefault();
        Layout.setOpenElements(true);
        $("#neoSearch")?.focus();
        $("#neoSearch")?.select();
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "0") {
        ev.preventDefault();
        App.panicReset();
      }
    }, { passive: false });
  }

  function ensureDefaults() {
    const s = Store.readSettings();
    if (localStorage.getItem(Keys.scale) == null) localStorage.setItem(Keys.scale, String(s.scale));
    if (localStorage.getItem(Keys.topLift) == null) localStorage.setItem(Keys.topLift, String(s.topLift));
    if (localStorage.getItem(Keys.widthElements) == null) localStorage.setItem(Keys.widthElements, "560");
    if (localStorage.getItem(Keys.widthSettings) == null) localStorage.setItem(Keys.widthSettings, "560");
    if (localStorage.getItem(Keys.maxElements) == null) localStorage.setItem(Keys.maxElements, "0");
    if (localStorage.getItem(Keys.maxSettings) == null) localStorage.setItem(Keys.maxSettings, "0");
    if (localStorage.getItem(Keys.compact) == null) localStorage.setItem(Keys.compact, s.compactGrid ? "1" : "0");
    if (localStorage.getItem(Keys.hideCats) == null) localStorage.setItem(Keys.hideCats, s.hideCategories ? "1" : "0");
    if (localStorage.getItem(Keys.tps) == null) localStorage.setItem(Keys.tps, String(s.tps));
  }

  function waitUntilReadyThen(start) {
    const step = () => {
      const haveUI = !!$("#controls") || !!$("#toolControls");
      const haveElements = !!(window.elements && Object.keys(window.elements).length > 20);
      if (haveUI && haveElements) return start();
      setTimeout(step, 80);
    };
    step();
  }

  function boot() {
    ensureDefaults();
    document.body.style.setProperty("--neoScale", String(UI.scale));
    TPS.set(TPS.get());
    waitUntilReadyThen(initOnce);
  }

  if (typeof window.runAfterLoad === "function") window.runAfterLoad(boot);
  else window.addEventListener("load", boot, { once: true });
})();
