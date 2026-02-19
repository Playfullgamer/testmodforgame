(() => {
  "use strict";

  const K = {
    settings: "neo_ui/settings",
    favs: "neo_ui/favs",
    recents: "neo_ui/recents",
    openE: "neo_ui/open_elements",
    openO: "neo_ui/open_overhaul",
    wE: "neo_ui/w_elements",
    wO: "neo_ui/w_overhaul",
    maxE: "neo_ui/max_elements",
    maxO: "neo_ui/max_overhaul",
    tab: "neo_ui/tab",
    cat: "neo_ui/cat",
    compact: "neo_ui/compact",
    hideCats: "neo_ui/hide_cats",
    scale: "neo_ui/scale",
    tps: "neo_ui/tps",
    topLift: "neo_ui/top_lift",
    modLib: "neo_ui/modlib",
    modKeyGuess: "neo_ui/modkey_guess",
    neoMods: "neo_ui/neomods",
    neoModsSessionOff: "neo_ui/neomods_session_off",
    startModsSessionOff: "neo_ui/startmods_session_off",
    favFirst: "neo_ui/fav_first",
  };

  const D = {
    enableNeoUI: true,
    neoElementsUI: true,
    neoOverhaulUI: true,
    neoModsBar: true,
    neoInfoBar: true,
    hideVanillaElements: true,
    restyleTop: true,
    openElementsOnStart: true,
    showPreview: true,
    autoCloseOnPick: false,
    compact: true,
    hideCats: false,
    scale: 1.3,
    toasts: true,
    hotkeys: true,
    modsInOverhaul: true,
    smarterHumans: false,
    favFirst: true,
    topLift: 10,
  };

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const jp = (s, f) => { try { return JSON.parse(s); } catch { return f; } };

  const loadSettings = () => ({ ...D, ...(jp(localStorage.getItem(K.settings) || "{}", {})) });
  const saveSettings = (v) => localStorage.setItem(K.settings, JSON.stringify(v));

  const loadList = (k) => {
    const v = jp(localStorage.getItem(k) || "[]", []);
    return Array.isArray(v) ? v.filter(Boolean) : [];
  };
  const saveList = (k, a, cap) => localStorage.setItem(k, JSON.stringify(cap ? a.slice(0, cap) : a));

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "style") n.setAttribute("style", v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else if (v != null) n.setAttribute(k, String(v));
    }
    for (const c of kids) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return n;
  };

  const css = (id, txt) => {
    $(`#${id}`)?.remove();
    const st = el("style", { id });
    st.textContent = txt;
    document.head.appendChild(st);
  };

  const afterLoad = (fn) => {
    if (typeof window.runAfterLoad === "function") window.runAfterLoad(fn);
    else window.addEventListener("load", fn, { once: true });
  };

  const waitFor = (fn, ms = 20000) => new Promise((res, rej) => {
    const t0 = performance.now();
    const it = setInterval(() => {
      let v = null;
      try { v = fn(); } catch {}
      if (v) { clearInterval(it); res(v); }
      else if (performance.now() - t0 > ms) { clearInterval(it); rej(new Error("timeout")); }
    }, 60);
  });

  const copyText = (t) => {
    const s = String(t ?? "");
    if (!s) return;
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(s).catch(() => prompt("Copy:", s));
    else prompt("Copy:", s);
  };

  const toast = (msg) => {
    if (!loadSettings().toasts) return;
    const t = $("#neoToast");
    if (!t) return;
    t.textContent = String(msg ?? "");
    t.style.display = "block";
    clearTimeout(toast._tm);
    toast._tm = setTimeout(() => (t.style.display = "none"), 1200);
  };

  const readScale = () => {
    const s = loadSettings();
    const raw = localStorage.getItem(K.scale);
    const v = raw == null ? s.scale : parseFloat(raw);
    return clamp(Number.isFinite(v) ? v : s.scale, 1.0, 1.75);
  };
  const setScale = (v) => {
    const n = clamp(v, 1.0, 1.75);
    localStorage.setItem(K.scale, String(n));
    document.body.style.setProperty("--neoScale", String(n));
    updateTop();
    toast(`UI ${n.toFixed(2)}`);
  };

  const readTopLift = () => {
    const s = loadSettings();
    const raw = localStorage.getItem(K.topLift);
    const v = raw == null ? s.topLift : parseInt(raw, 10);
    return clamp(Number.isFinite(v) ? v : s.topLift, 0, 28);
  };
  const setTopLift = (v) => {
    const n = clamp(Math.round(v), 0, 28);
    localStorage.setItem(K.topLift, String(n));
    updateTop();
  };

  const cleanup = () => {
    [
      "neoStyle",
      "neoOverlay","neoElements","neoOverhaul","neoEdgeL","neoEdgeR","neoToast","neoTopE","neoTopO","neoInfo",
      "neoCreditStyle"
    ].forEach(id => $(`#${id}`)?.remove());
    document.body.classList.remove("neoUI", "neoTopStyle", "neoHideVanilla", "neoCompact", "neoHideCats");
  };

  const styleText = () => `
body.neoUI{
  --neoScale:${readScale()};
  --neoTop:96px;
  --neoWE:560px;
  --neoWO:560px;

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

#neoOverlay{
  position:fixed; inset:0;
  background:rgba(0,0,0,.40);
  z-index:999980;
  display:none;
  pointer-events:none;
}
#neoOverlay.open{display:block;pointer-events:auto;}

#neoEdgeL,#neoEdgeR{
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
#neoEdgeL{left:8px;}
#neoEdgeR{right:8px;}
#neoEdgeL.hidden,#neoEdgeR.hidden{display:none;}
#neoEdgeL .lbl,#neoEdgeR .lbl{display:block;font-weight:900;letter-spacing:.6px;font-size:12px;}
#neoEdgeL .sub,#neoEdgeR .sub{display:block;font-size:11px;color:var(--neoMuted);margin-top:2px;}

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
  max-width:calc(100vw - 20px);
  min-height:320px;
}
#neoElements{
  left:10px;
  width:var(--neoWE);
  transform:translateX(-110%);
  transition:transform 160ms ease;
}
#neoElements.open{transform:translateX(0);}
#neoOverhaul{
  right:10px;
  width:var(--neoWO);
  transform:translateX(110%);
  transition:transform 160ms ease;
}
#neoOverhaul.open{transform:translateX(0);}
.neoDrawerMax{
  left:10px !important;
  right:10px !important;
  width:auto !important;
}

.neoHdr{
  display:flex;align-items:center;justify-content:space-between;
  gap:8px;padding:12px;
  border-bottom:1px solid var(--neoBorder2);
  background:rgba(0,0,0,.10);
  border-top-left-radius:18px;border-top-right-radius:18px;
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
.neoBtn.ghost{
  background:rgba(255,255,255,.03);
}

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

#neoElBody{
  flex:1;
  display:grid;
  grid-template-columns:180px 1fr;
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

#neoGrid{
  padding:10px;
  overflow:auto;
  display:grid;
  grid-template-columns:repeat(auto-fill, minmax(150px, 1fr));
  gap:10px;
  min-height:200px;
}
body.neoUI.neoCompact #neoGrid{grid-template-columns:repeat(auto-fill, minmax(125px, 1fr));gap:8px;}

.neoElBtn{
  display:flex;align-items:center;gap:10px;
  padding:10px;border-radius:14px;
  border:1px solid var(--neoBorder2);
  background:linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.03));
  cursor:pointer;
}
.neoDot{width:14px;height:14px;border-radius:999px;box-shadow:inset 0 0 0 2px rgba(0,0,0,.25);}
.neoName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
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

#neoToast{
  position:fixed;left:12px;bottom:12px;
  z-index:999999;display:none;
  padding:10px 12px;border-radius:14px;
  background:rgba(12,14,18,.94);
  border:1px solid var(--neoBorder);
  color:var(--neoText);
  box-shadow:var(--neoShadow2);
  font-size:12px;
}

#neoOverBody{flex:1;overflow:auto;padding:10px 12px 12px 12px;}
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
.neoRow{
  display:flex;gap:10px;align-items:center;flex-wrap:wrap;
}
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

#neoInfo{
  position:fixed;
  z-index:999970;
  right:10px;
  top:10px;
  pointer-events:none;
  display:none;
}
#neoInfo.on{display:block;}
#neoInfo .pill{
  max-width:min(620px, 92vw);
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
#neoInfo b{color:rgba(255,255,255,.92);}
#neoInfo span{color:rgba(255,255,255,.74);}

.neoCreditTag{
  color: rgba(167,139,250,.95);
  font-weight: 900;
  margin-left: 8px;
}
`;

  const isCompact = () => (localStorage.getItem(K.compact) ?? (loadSettings().compact ? "1" : "0")) === "1";
  const isHideCats = () => (localStorage.getItem(K.hideCats) ?? (loadSettings().hideCats ? "1" : "0")) === "1";
  const isFavFirst = () => (localStorage.getItem(K.favFirst) ?? (loadSettings().favFirst ? "1" : "0")) === "1";

  const applyFlags = () => {
    document.body.classList.toggle("neoCompact", isCompact());
    document.body.classList.toggle("neoHideCats", isHideCats());
  };

  const isOpenE = () => localStorage.getItem(K.openE) === "1";
  const isOpenO = () => localStorage.getItem(K.openO) === "1";
  const isMax = (w) => localStorage.getItem(w === "e" ? K.maxE : K.maxO) === "1";
  const desiredW = (k, f) => clamp(parseInt(localStorage.getItem(k) || String(f), 10) || f, 340, 980);

  const elementColor = (name) => {
    const def = window.elements?.[name];
    const c = def?.color;
    if (Array.isArray(c) && c.length) return c[0];
    if (typeof c === "string") return c;
    return "rgba(255,255,255,.35)";
  };

  const prettyName = (name) => {
    const def = window.elements?.[name];
    const v = def?.name || def?.displayName || def?.label;
    if (typeof v === "string" && v.trim()) return v.trim();
    return String(name).replace(/_/g, " ");
  };

  const buildIndex = () => {
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
    for (const a of byCat.values()) a.sort(sortFn);
    all.sort(sortFn);
    const cats = ["all", ...Array.from(byCat.keys()).sort((a, b) => String(a).localeCompare(String(b)))];
    return { byCat, all, cats };
  };

  const categoryLabels = () => {
    const map = new Map();
    for (const b of $$(".categoryButton")) {
      const id = b.id || "";
      const key = id.startsWith("categoryButton-") ? id.replace("categoryButton-", "") : (b.getAttribute("category") || b.getAttribute("data-category"));
      if (!key) continue;
      const label = (b.textContent || "").trim();
      if (label) map.set(key, label);
    }
    return map;
  };

  const favs = () => loadList(K.favs);
  const setFavs = (a) => saveList(K.favs, a, 60);
  const recents = () => loadList(K.recents);
  const setRecents = (a) => saveList(K.recents, a, 30);

  let tab = localStorage.getItem(K.tab) || "all";
  let cat = localStorage.getItem(K.cat) || "all";

  const setTab = (t) => {
    tab = t;
    localStorage.setItem(K.tab, t);
    $("#neoTabAll")?.classList.toggle("active", t === "all");
    $("#neoTabFav")?.classList.toggle("active", t === "fav");
    $("#neoTabRec")?.classList.toggle("active", t === "recent");
    renderCats();
    renderElements();
  };

  const setCat = (c) => {
    cat = c;
    localStorage.setItem(K.cat, c);
    renderCats();
    renderElements();
  };

  const syncOverlay = () => $("#neoOverlay")?.classList.toggle("open", isOpenE() || isOpenO());

  const syncEdges = () => {
    const s = loadSettings();
    const show = !!(s.enableNeoUI && (s.neoElementsUI || s.neoOverhaulUI));
    $("#neoEdgeL")?.classList.toggle("hidden", !show || !s.neoElementsUI || isOpenE());
    $("#neoEdgeR")?.classList.toggle("hidden", !show || !s.neoOverhaulUI || isOpenO());
  };

  const updateLayout = () => {
    const openE = isOpenE();
    const openO = isOpenO();
    const maxE = isMax("e");
    const maxO = isMax("o");

    let wE = desiredW(K.wE, 560);
    let wO = desiredW(K.wO, 560);

    if (!maxE && !maxO && openE && openO) {
      const vw = window.innerWidth;
      const available = Math.max(360, vw - 32);
      const half = Math.max(360, Math.floor((available - 12) / 2));
      wE = Math.min(wE, half);
      wO = Math.min(wO, half);
    }

    document.body.style.setProperty("--neoWE", `${wE}px`);
    document.body.style.setProperty("--neoWO", `${wO}px`);

    syncOverlay();
    syncEdges();
  };

  const updateTop = () => {
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

    const lift = readTopLift();
    top = clamp(top - lift, 48, Math.floor(vh * 0.35));

    document.body.style.setProperty("--neoTop", `${top}px`);

    const info = $("#neoInfo");
    if (info) info.style.top = `${Math.max(10, top - 44)}px`;
  };

  const setOpenE = (v) => {
    const s = loadSettings();
    if (!s.enableNeoUI || !s.neoElementsUI) return;
    if (v && window.innerWidth < 900) setOpenO(false);
    localStorage.setItem(K.openE, v ? "1" : "0");
    $("#neoElements")?.classList.toggle("open", v);
    updateTop();
    updateLayout();
  };

  const setOpenO = (v) => {
    const s = loadSettings();
    if (!s.enableNeoUI || !s.neoOverhaulUI) return;
    if (v && window.innerWidth < 900) setOpenE(false);
    localStorage.setItem(K.openO, v ? "1" : "0");
    $("#neoOverhaul")?.classList.toggle("open", v);
    updateTop();
    updateLayout();
  };

  const setMaxPanel = (which, on) => {
    localStorage.setItem(which === "e" ? K.maxE : K.maxO, on ? "1" : "0");
    const node = which === "e" ? $("#neoElements") : $("#neoOverhaul");
    node?.classList.toggle("neoDrawerMax", on);

    if (on) {
      if (which === "e") {
        localStorage.setItem(K.maxO, "0");
        $("#neoOverhaul")?.classList.remove("neoDrawerMax");
        setOpenO(false);
        setOpenE(true);
      } else {
        localStorage.setItem(K.maxE, "0");
        $("#neoElements")?.classList.remove("neoDrawerMax");
        setOpenE(false);
        setOpenO(true);
      }
    }
    updateLayout();
  };

  const toggleFav = (name) => {
    const f = favs();
    const i = f.indexOf(name);
    if (i >= 0) f.splice(i, 1);
    else f.unshift(name);
    setFavs(f);
  };

  const renderCats = () => {
    const s = loadSettings();
    if (!s.enableNeoUI || !s.neoElementsUI) return;
    const wrap = $("#neoCats");
    if (!wrap) return;
    const { cats } = buildIndex();
    const labels = categoryLabels();
    wrap.innerHTML = "";
    for (const c of cats) {
      const label = c === "all" ? "All" : (labels.get(c) || String(c).replace(/_/g, " "));
      const btn = el("button", { class: "neoElBtn", style: "justify-content:flex-start;width:100%;" }, label);
      btn.onclick = () => setCat(c);
      if (cat === c) btn.style.outline = "2px solid rgba(167,139,250,.45)";
      wrap.appendChild(btn);
    }
  };

  const listForTab = ({ all, byCat }) => {
    const f = favs().filter(n => window.elements?.[n]);
    const r = recents().filter(n => window.elements?.[n]);
    if (tab === "fav") return f;
    if (tab === "recent") return r;
    if (cat === "all") return all;
    return byCat.get(cat) || [];
  };

  const inCat = (def) => cat === "all" ? true : String(def?.category || "other") === String(cat);

  const renderElements = () => {
    const s = loadSettings();
    if (!s.enableNeoUI || !s.neoElementsUI) return;

    const grid = $("#neoGrid");
    const count = $("#neoCount");
    if (!grid) return;

    const q = ($("#neoSearch")?.value || "").trim().toLowerCase();
    const favSet = new Set(favs());

    const { all, byCat } = buildIndex();
    let list = listForTab({ all, byCat });

    list = list.filter(n => {
      const def = window.elements?.[n];
      if (!def || def.hidden) return false;
      return inCat(def);
    });

    if (q) {
      list = list.filter(n => {
        const dn = prettyName(n).toLowerCase();
        return dn.includes(q) || String(n).toLowerCase().includes(q);
      });
    }

    if (tab === "all" && isFavFirst() && favSet.size) {
      const fav = [];
      const rest = [];
      for (const n of list) (favSet.has(n) ? fav : rest).push(n);
      list = fav.concat(rest);
    }

    grid.innerHTML = "";
    let shown = 0;

    for (const name of list) {
      const def = window.elements?.[name];
      if (!def || def.hidden) continue;

      const btn = el("button", { class: "neoElBtn" });

      btn.appendChild(el("span", { class: "neoDot", style: `background:${elementColor(name)};` }));
      btn.appendChild(el("span", { class: "neoName" }, prettyName(name)));

      const star = el("button", { class: `neoStarBtn ${favSet.has(name) ? "on" : ""}` }, favSet.has(name) ? "★" : "☆");
      star.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        toggleFav(name);
        renderElements();
      };

      btn.appendChild(star);

      btn.onclick = (ev) => {
        const keepOpen = ev.shiftKey;
        if (typeof window.selectElement === "function") window.selectElement(name);

        const r = recents();
        setRecents([name, ...r.filter(x => x !== name)], 30);

        if (!keepOpen && loadSettings().autoCloseOnPick) setOpenE(false);
      };

      grid.appendChild(btn);
      shown++;
    }

    if (count) count.textContent = `${shown}`;

    const prev = $("#neoPreview");
    if (prev) {
      prev.classList.toggle("show", !!s.showPreview);
      if (!shown) prev.innerHTML = `<div class="muted">No matches.</div>`;
    }
  };

  const findModRoot = () => $("#modManager") || $("#modManagerScreen") || $("#modMenu") || $("#modMenuScreen");

  const findModRows = (root) => {
    if (!root) return [];
    const checks = $$('input[type="checkbox"]', root);
    const rows = new Set();
    for (const cb of checks) {
      const row = cb.closest("div, li, tr") || cb.parentElement;
      if (row && row.textContent && row.textContent.trim()) rows.add(row);
    }
    return Array.from(rows).filter(x => x instanceof HTMLElement);
  };

  const improveModsBar = () => {
    const s = loadSettings();
    if (!s.enableNeoUI || !s.neoModsBar) return;
    const root = findModRoot();
    if (!root) return;
    if ($("#neoModTools", root)) return;

    const bar = el("div", { id: "neoModTools" },
      el("input", { id: "neoModSearch", type: "text", placeholder: "Search mods…" }),
      el("button", {
        class: "neoMiniBtn",
        onclick: () => { setOpenO(true); setTimeout(() => $("#neoModsCard")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); }
      }, "Neo Mods"),
      el("button", { class: "neoMiniBtn", onclick: () => setScale(readScale() + 0.06) }, "UI +"),
      el("button", { class: "neoMiniBtn", onclick: () => setScale(readScale() - 0.06) }, "UI −"),
      el("button", {
        class: "neoMiniBtn",
        onclick: () => { const i = $("#neoModSearch", root); i.value = ""; i.dispatchEvent(new Event("input")); }
      }, "Clear")
    );

    root.prepend(bar);

    const input = $("#neoModSearch", root);
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      const rows = findModRows(root);
      for (const r of rows) {
        const t = (r.textContent || "").toLowerCase();
        r.style.display = (!q || t.includes(q)) ? "" : "none";
      }
    });
  };

  const watchModsMenu = () => setInterval(improveModsBar, 900);

  const modLooks = (x) => {
    if (typeof x !== "string") return false;
    const t = x.trim().toLowerCase();
    return t.endsWith(".js") || t.includes(".js?") || t.startsWith("http://") || t.startsWith("https://");
  };

  const splitMods = (str) => String(str || "").split(";").map(s => s.trim()).filter(Boolean);
  const isModsArray = (v) => Array.isArray(v) && v.every(x => typeof x === "string");

  const guessModsKey = () => {
    const cached = localStorage.getItem(K.modKeyGuess);
    if (cached && localStorage.getItem(cached) != null) return cached;

    const candidates = ["enabledMods","mods","modList","modsEnabled","enabled_mods","enabled-mods","sb_mods","sbmods"];
    for (const k of candidates) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const v = JSON.parse(raw);
        if (isModsArray(v) && v.some(modLooks)) { localStorage.setItem(K.modKeyGuess, k); return k; }
      } catch {
        const parts = splitMods(raw);
        if (parts.length && parts.some(modLooks)) { localStorage.setItem(K.modKeyGuess, k); return k; }
      }
    }

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const raw = localStorage.getItem(k);
      if (!raw || (!raw.includes(".js") && !raw.includes("http"))) continue;
      try {
        const v = JSON.parse(raw);
        if (isModsArray(v) && v.some(modLooks)) { localStorage.setItem(K.modKeyGuess, k); return k; }
      } catch {
        const parts = splitMods(raw);
        if (parts.length && parts.some(modLooks)) { localStorage.setItem(K.modKeyGuess, k); return k; }
      }
    }

    localStorage.setItem(K.modKeyGuess, "enabledMods");
    return "enabledMods";
  };

  const readEnabledMods = () => {
    if (Array.isArray(window.enabledMods)) return window.enabledMods.slice();
    const k = guessModsKey();
    const raw = localStorage.getItem(k);
    if (!raw) return [];
    try {
      const v = JSON.parse(raw);
      if (isModsArray(v)) return v.slice();
    } catch {}
    return splitMods(raw);
  };

  const writeEnabledMods = (list) => {
    const clean = Array.from(new Set(list.map(s => String(s || "").trim()).filter(Boolean)));
    if (Array.isArray(window.enabledMods)) window.enabledMods = clean.slice();
    const k = guessModsKey();
    try { localStorage.setItem(k, JSON.stringify(clean)); }
    catch { localStorage.setItem(k, clean.join(";")); }
    return k;
  };

  const readModLib = () => {
    const v = jp(localStorage.getItem(K.modLib) || "[]", []);
    if (!Array.isArray(v)) return [];
    return v
      .filter(x => x && typeof x.id === "string")
      .map(x => ({ id: x.id.trim(), enabled: !!x.enabled, addedAt: Number(x.addedAt || Date.now()) }))
      .filter(x => x.id);
  };

  const writeModLib = (arr) => {
    const seen = new Set();
    const out = [];
    for (const it of arr || []) {
      const id = String(it?.id || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, enabled: !!it.enabled, addedAt: Number(it.addedAt || Date.now()) });
    }
    localStorage.setItem(K.modLib, JSON.stringify(out));
    return out;
  };

  const readStartSessionOff = () => new Set(jp(sessionStorage.getItem(K.startModsSessionOff) || "[]", []));
  const writeStartSessionOff = (set) => sessionStorage.setItem(K.startModsSessionOff, JSON.stringify(Array.from(set)));

  const syncLibFromEnabled = () => {
    const enabled = new Set(readEnabledMods());
    const lib = readModLib();
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
    writeModLib(out);
  };

  const applyLibToEnabled = () => {
    const lib = readModLib();
    const off = readStartSessionOff();
    const enabled = lib.filter(x => x.enabled && !off.has(x.id)).map(x => x.id);
    writeEnabledMods(enabled);
  };

  const neoModsRead = () => jp(localStorage.getItem(K.neoMods) || "[]", []);
  const neoModsWrite = (a) => localStorage.setItem(K.neoMods, JSON.stringify(Array.isArray(a) ? a : []));
  const neoSessionOffRead = () => new Set(jp(sessionStorage.getItem(K.neoModsSessionOff) || "[]", []));
  const neoSessionOffWrite = (set) => sessionStorage.setItem(K.neoModsSessionOff, JSON.stringify(Array.from(set)));

  const Neo = (window.NeoModLoader ||= {});
  Neo.version ||= "1.0.0";
  Neo._hooks ||= { ready: [], elements: [], tick: [], draw: [], elementSelected: [] };
  Neo._patches ||= [];
  Neo._mods ||= new Map();

  Neo.on = (name, fn) => {
    (Neo._hooks[name] ||= []).push(fn);
    return () => { Neo._hooks[name] = (Neo._hooks[name] || []).filter(x => x !== fn); };
  };
  Neo.emit = (name, ...args) => {
    const a = Neo._hooks[name] || [];
    for (const fn of a) { try { fn(...args); } catch {} }
  };
  Neo.patch = (obj, key, wrap) => {
    if (!obj || !key || typeof wrap !== "function") return null;
    const old = obj[key];
    obj[key] = wrap(old);
    const undo = () => { obj[key] = old; };
    Neo._patches.push(undo);
    return undo;
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
  Neo.element = (name, mut) => {
    if (!window.elements?.[name] || typeof mut !== "function") return false;
    try { mut(window.elements[name], Neo.refs()); return true; } catch { return false; }
  };
  Neo.define = (name, factory) => {
    const n = String(name || "").trim();
    if (!n || typeof factory !== "function") return null;
    if (Neo._mods.has(n)) return Neo._mods.get(n);
    const mod = { name: n, enabled: false, enable() {}, disable() {} };
    try {
      const api = factory(Neo) || {};
      if (typeof api.enable === "function") mod.enable = api.enable;
      if (typeof api.disable === "function") mod.disable = api.disable;
    } catch {}
    Neo._mods.set(n, mod);
    return mod;
  };
  Neo.enable = (name) => {
    const m = Neo._mods.get(name);
    if (!m || m.enabled) return false;
    try { m.enable(); m.enabled = true; return true; } catch { return false; }
  };
  Neo.disable = (name) => {
    const m = Neo._mods.get(name);
    if (!m || !m.enabled) return false;
    try { m.disable(); m.enabled = false; return true; } catch { return false; }
  };
  Neo.load = (url, opts = {}) => new Promise((resolve, reject) => {
    const u = String(url || "").trim();
    if (!u) return reject(new Error("no url"));
    const off = neoSessionOffRead();
    if (off.has(u)) return reject(new Error("session disabled"));
    const id = opts.id || `neo_${Math.random().toString(36).slice(2)}`;
    if (document.querySelector(`script[data-neo-mod="${CSS.escape(u)}"]`)) return resolve({ url: u, id, already: true });
    const s = document.createElement("script");
    s.src = u;
    s.async = true;
    s.dataset.neoMod = u;
    s.dataset.neoModId = id;
    s.onload = () => resolve({ url: u, id });
    s.onerror = () => reject(new Error("load failed"));
    document.head.appendChild(s);
  });

  const hookEngine = (() => {
    let hooked = false;
    const tryHook = () => {
      if (hooked) return;
      const cand = [
        ["tick", "tick"],
        ["doTick", "doTick"],
        ["updateGame", "updateGame"],
        ["draw", "draw"],
        ["render", "render"]
      ];

      for (const [key] of cand) {
        if (typeof window[key] === "function") {
          if (window[key]._neoHooked) continue;
          const orig = window[key];
          const wrapped = function(...args) {
            if (key === "tick" || key === "doTick" || key === "updateGame") Neo.emit("tick", Neo.refs());
            if (key === "draw" || key === "render") Neo.emit("draw", Neo.refs());
            return orig.apply(this, args);
          };
          wrapped._neoHooked = true;
          window[key] = wrapped;
          hooked = true;
          break;
        }
      }
    };
    return { tryHook };
  })();

  const injectCreditTag = () => {
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
    target.appendChild(el("span", { class: "neoCreditTag" }, "modded by Playfullgamer"));
  };

  const getTPS = () => {
    const keys = ["tps","TPS","tickSpeed","ticksPerSecond","targetTPS"];
    for (const k of keys) if (typeof window[k] === "number" && isFinite(window[k])) return window[k];
    const raw = localStorage.getItem(K.tps);
    if (raw != null && isFinite(parseFloat(raw))) return parseFloat(raw);
    return 60;
  };

  const setTPS = (v) => {
    const n = clamp(Math.round(v), 1, 1000);
    localStorage.setItem(K.tps, String(n));

    const keys = ["tps","TPS","tickSpeed","ticksPerSecond","targetTPS"];
    for (const k of keys) {
      if (typeof window[k] === "number") window[k] = n;
    }

    try {
      const inputs = $$('input[type="range"]');
      for (const r of inputs) {
        const p = r.parentElement;
        const t = (p?.textContent || "").toLowerCase();
        if (t.includes("tps")) {
          r.value = String(n);
          r.dispatchEvent(new Event("input", { bubbles: true }));
          r.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    } catch {}

    renderInfo();
  };

  const renderInfo = () => {
    const s = loadSettings();
    const info = $("#neoInfo");
    if (!info) return;
    info.classList.toggle("on", !!(s.enableNeoUI && s.neoInfoBar));
    if (!(s.enableNeoUI && s.neoInfoBar)) return;

    const get = (...names) => { for (const n of names) if (n in window) return window[n]; return undefined; };
    const elName = get("currentElement","element","selectedElement") ?? "-";
    const size = get("mouseSize","cursorSize","brushSize") ?? "-";
    const replace = get("replaceMode","replace","replacing");
    const paused = get("paused","isPaused","pause");

    const pill = $(".pill", info);
    if (!pill) return;

    pill.innerHTML = `
      <span><b>Elem:</b> ${String(elName)}</span>
      <span><b>Size:</b> ${String(size)}</span>
      <span><b>Replace:</b> ${typeof replace === "boolean" ? (replace ? "On" : "Off") : String(replace ?? "-")}</span>
      <span><b>Paused:</b> ${typeof paused === "boolean" ? (paused ? "Yes" : "No") : String(paused ?? "-")}</span>
      <span><b>TPS:</b> ${String(getTPS())}</span>
    `;
  };

  const smarterHumansPatch = () => {
    const s = loadSettings();
    if (!s.smarterHumans) return;

    const h = window.elements?.human;
    if (!h || h._neoSmart) return;

    const orig = h.tick;
    if (typeof orig !== "function") return;

    const danger = new Set(["fire","plasma","lava","acid","radiation","explosion","electric","electricity"]);

    h.tick = function(pixel) {
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

    h._neoSmart = true;
  };

  const buildUI = () => {
    if ($("#neoElements")) return;

    document.body.appendChild(el("div", { id: "neoOverlay", onclick: () => { setOpenE(false); setOpenO(false); } }));
    document.body.appendChild(el("div", { id: "neoEdgeL", onclick: () => setOpenE(true) }, el("span", { class: "lbl" }, "ELEMENTS"), el("span", { class: "sub" }, "☰")));
    document.body.appendChild(el("div", { id: "neoEdgeR", onclick: () => setOpenO(true) }, el("span", { class: "lbl" }, "SETTINGS"), el("span", { class: "sub" }, "⚙")));
    document.body.appendChild(el("div", { id: "neoToast" }));
    document.body.appendChild(el("div", { id: "neoInfo" }, el("div", { class: "pill" }, "")));

    const elements = el("div", { id: "neoElements", class: "neoDrawer" },
      el("div", { class: "neoHdr" },
        el("div", { class: "neoTitle" }, "Elements"),
        el("div", { class: "neoBtns" },
          el("button", { class: "neoBtn ghost", onclick: () => { localStorage.setItem(K.compact, isCompact() ? "0" : "1"); applyFlags(); renderElements(); } }, "▦"),
          el("button", { class: "neoBtn ghost", onclick: () => { localStorage.setItem(K.hideCats, isHideCats() ? "0" : "1"); applyFlags(); } }, "☰"),
          el("button", { class: "neoBtn ghost", onclick: () => { localStorage.setItem(K.favFirst, isFavFirst() ? "0" : "1"); renderElements(); } }, "★"),
          el("button", { class: "neoBtn", onclick: () => setMaxPanel("e", !isMax("e")) }, "⤢"),
          el("button", { class: "neoBtn", onclick: () => setOpenO(true) }, "⚙"),
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

    const overhaul = el("div", { id: "neoOverhaul", class: "neoDrawer" },
      el("div", { class: "neoHdr" },
        el("div", { class: "neoTitle" }, "Settings"),
        el("div", { class: "neoBtns" },
          el("button", { class: "neoBtn", onclick: () => setMaxPanel("o", !isMax("o")) }, "⤢"),
          el("button", { class: "neoBtn", onclick: () => setOpenE(true) }, "☰"),
          el("button", { class: "neoBtn", onclick: () => setOpenO(false) }, "×")
        )
      ),
      el("div", { id: "neoOverBody" })
    );

    document.body.append(elements, overhaul);

    $("#neoSearch")?.addEventListener("input", () => renderElements());
  };

  const addTopButtons = () => {
    const s = loadSettings();
    const tc = $("#toolControls");
    if (!tc) return;

    $("#neoTopE")?.remove();
    $("#neoTopO")?.remove();

    if (s.enableNeoUI && s.neoElementsUI) {
      const b = el("button", { id: "neoTopE", class: "controlButton", onclick: () => setOpenE(!isOpenE()) }, "☰ Elements");
      tc.prepend(b);
    }
    if (s.enableNeoUI && s.neoOverhaulUI) {
      const b = el("button", { id: "neoTopO", class: "controlButton", onclick: () => setOpenO(!isOpenO()) }, "⚙ Settings");
      tc.appendChild(b);
    }
  };

  const panicReset = () => {
    localStorage.setItem(K.scale, "1.30");
    localStorage.setItem(K.wE, "560");
    localStorage.setItem(K.wO, "560");
    localStorage.setItem(K.maxE, "0");
    localStorage.setItem(K.maxO, "0");
    localStorage.setItem(K.openE, "1");
    localStorage.setItem(K.openO, "0");
    localStorage.setItem(K.hideCats, "0");
    localStorage.setItem(K.compact, "1");
    localStorage.setItem(K.favFirst, "1");
    localStorage.setItem(K.topLift, "10");
    document.body.style.setProperty("--neoScale", "1.30");
    $("#neoElements")?.classList.add("open");
    $("#neoOverhaul")?.classList.remove("open");
    $("#neoElements")?.classList.remove("neoDrawerMax");
    $("#neoOverhaul")?.classList.remove("neoDrawerMax");
    applyFlags();
    updateTop();
    updateLayout();
    renderCats();
    renderElements();
    toast("Reset");
  };

  const setPanelWidths = (we, wo) => {
    localStorage.setItem(K.wE, String(clamp(Math.round(we), 340, 980)));
    localStorage.setItem(K.wO, String(clamp(Math.round(wo), 340, 980)));
    updateLayout();
  };

  const buildOverhaul = () => {
    const body = $("#neoOverBody");
    if (!body) return;
    body.innerHTML = "";

    const s = loadSettings();

    const section = (t) => el("div", { class: "neoSection" }, t);

    const toggle = (key, title, desc, onChange) => {
      const id = `neo_${key}`;
      return el("label", { class: "neoToggle", for: id },
        el("input", {
          id, type: "checkbox",
          checked: s[key] ? "checked" : null,
          onchange: (ev) => {
            const next = loadSettings();
            next[key] = !!ev.target.checked;
            saveSettings(next);
            if (typeof onChange === "function") onChange(next);
            liveApply();
          }
        }),
        el("div", {}, el("div", { style: "font-weight:800;" }, title), el("div", { class: "neoSmall" }, desc))
      );
    };

    const slider = (title, valueText, min, max, step, value, oninput) => {
      return el("div", { class: "neoToggle", style: "cursor:default;" },
        el("div", { style: "min-width:18px;" }),
        el("div", { style: "width:100%;" },
          el("div", { style: "font-weight:800;" }, `${title}: ${valueText}`),
          el("div", { style: "display:flex; gap:10px; align-items:center; margin-top:10px;" },
            el("input", {
              type: "range",
              min: String(min),
              max: String(max),
              step: String(step),
              value: String(value),
              style: "flex:1;",
              oninput
            })
          )
        )
      );
    };

    body.append(section("UI"));
    body.append(toggle("enableNeoUI", "Neo UI", "Master switch"));
    body.append(toggle("neoElementsUI", "Elements panel", "Left panel"));
    body.append(toggle("neoOverhaulUI", "Settings panel", "Right panel"));
    body.append(toggle("neoModsBar", "Mods bar style", "Better mod menu top bar"));
    body.append(toggle("neoInfoBar", "Info bar", "Small status pill"));
    body.append(toggle("restyleTop", "Top bar style", "Smooth buttons"));
    body.append(toggle("hideVanillaElements", "Hide vanilla elements UI", "Only when Elements panel is enabled"));
    body.append(toggle("autoCloseOnPick", "Auto-close on pick", "Shift-click keeps it open"));
    body.append(toggle("smarterHumans", "Smarter humans", "Avoid nearby danger"));

    body.append(section("Size"));
    body.append(slider("UI scale", readScale().toFixed(2), 1.0, 1.75, 0.02, readScale(), (ev) => setScale(parseFloat(ev.target.value))));
    body.append(slider("Panel lift", `${readTopLift()}px`, 0, 28, 1, readTopLift(), (ev) => setTopLift(parseInt(ev.target.value, 10))));

    const wE = desiredW(K.wE, 560);
    const wO = desiredW(K.wO, 560);
    body.append(section("Panel width"));
    body.append(
      el("div", { class: "neoCard" },
        el("div", { class: "neoRow" },
          el("span", { class: "neoSmall", style: "flex:1;" }, `Elements: ${wE}px • Settings: ${wO}px`)
        ),
        el("div", { class: "neoRow", style: "margin-top:10px;" },
          el("input", {
            type: "range", min: "340", max: "980", step: "10", value: String(wE),
            style: "flex:1;",
            oninput: (ev) => setPanelWidths(parseInt(ev.target.value, 10), desiredW(K.wO, 560))
          }),
          el("input", {
            type: "range", min: "340", max: "980", step: "10", value: String(wO),
            style: "flex:1;",
            oninput: (ev) => setPanelWidths(desiredW(K.wE, 560), parseInt(ev.target.value, 10))
          })
        )
      )
    );

    body.append(section("TPS"));
    body.append(
      el("div", { class: "neoCard" },
        el("div", { class: "neoRow" },
          el("span", { class: "neoSmall", style: "flex:1;" }, `TPS: ${getTPS()}`)
        ),
        el("div", { class: "neoRow", style: "margin-top:10px;" },
          el("button", { class: "neoBtn", onclick: () => setTPS(getTPS() - 10) }, "–10"),
          el("input", {
            type: "range", min: "1", max: "1000", step: "1",
            value: String(getTPS()),
            style: "flex:1;",
            oninput: (ev) => setTPS(parseInt(ev.target.value, 10))
          }),
          el("button", { class: "neoBtn", onclick: () => setTPS(getTPS() + 10) }, "+10")
        )
      )
    );

    body.append(section("Mods"));

    buildModsUI(body);

    body.append(section("Modding"));
    body.append(
      el("div", { class: "neoCard" },
        el("div", { class: "neoSmall" }, "NeoModLoader is available for mods to hook game logic safely."),
        el("div", { class: "neoRow", style: "margin-top:10px;" },
          el("button", {
            class: "neoBtn",
            onclick: () => copyText(
              [
                "NeoModLoader.on('ready', fn)",
                "NeoModLoader.on('tick', fn)",
                "NeoModLoader.on('draw', fn)",
                "NeoModLoader.refs()",
                "NeoModLoader.patch(obj,'fn',wrap)",
                "NeoModLoader.element('human', (h, refs)=>{ ... })",
                "NeoModLoader.define('mod', Neo=>({ enable(){}, disable(){} }))"
              ].join("\n")
            )
          }, "Copy API cheat sheet"),
          el("button", { class: "neoBtn", onclick: () => copyText(JSON.stringify(Object.keys(Neo.refs()), null, 2)) }, "Copy refs list")
        )
      )
    );

    body.append(section("Reset"));
    body.append(
      el("div", { class: "neoRow" },
        el("button", { class: "neoBtn", onclick: () => panicReset() }, "Reset layout")
      )
    );
  };

  const buildModsUI = (body) => {
    const s = loadSettings();
    if (!s.modsInOverhaul) return;

    syncLibFromEnabled();

    const startCard = el("div", { class: "neoCard", id: "neoModsCard" },
      el("div", { class: "neoRow" },
        el("input", { id: "neoStartAdd", class: "neoInput", placeholder: "Startup mod URL(s) ; separated", type: "text" }),
        el("button", { class: "neoBtn", onclick: () => startAdd(false) }, "Add"),
        el("button", { class: "neoBtn", onclick: () => startAdd(true) }, "Add+Reload"),
        el("button", { class: "neoBtn", onclick: () => location.reload() }, "Reload")
      ),
      el("div", { class: "neoRow", style: "margin-top:10px;" },
        el("button", { class: "neoBtn ghost", onclick: () => startEnableAll(true) }, "Enable all"),
        el("button", { class: "neoBtn ghost", onclick: () => startEnableAll(false) }, "Disable all"),
        el("button", { class: "neoBtn ghost", onclick: () => startClearSessionOff() }, "Clear session-off"),
        el("button", { class: "neoBtn ghost", onclick: () => startBackupPrompt() }, "Backup/Restore"),
        el("span", { class: "neoSmall", style: "margin-left:auto;" }, "Startup mods apply on reload")
      ),
      el("div", { id: "neoStartList" })
    );

    const liveCard = el("div", { class: "neoCard", style: "margin-top:10px;" },
      el("div", { class: "neoRow" },
        el("input", { id: "neoLiveUrl", class: "neoInput", placeholder: "Live mod URL (loads now, no reload)", type: "text" }),
        el("button", { class: "neoBtn", onclick: () => liveLoadNow() }, "Load now"),
        el("button", { class: "neoBtn ghost", onclick: () => liveSaveOnly() }, "Save"),
        el("button", { class: "neoBtn ghost", onclick: () => liveBackupPrompt() }, "Backup/Restore")
      ),
      el("div", { class: "neoRow", style: "margin-top:10px;" },
        el("button", { class: "neoBtn ghost", onclick: () => liveLoadAllSaved() }, "Load saved"),
        el("button", { class: "neoBtn ghost", onclick: () => liveClearSessionOff() }, "Clear session-off"),
        el("span", { class: "neoSmall", style: "margin-left:auto;" }, "Session-off disables saved live mods this refresh")
      ),
      el("div", { id: "neoLiveList" })
    );

    body.append(startCard);
    body.append(liveCard);

    renderStartList();
    renderLiveList();
  };

  const startAdd = (doReload) => {
    const input = $("#neoStartAdd");
    if (!input) return;
    const incoming = splitMods(input.value).filter(modLooks);
    if (!incoming.length) return toast("No mods");
    const lib = readModLib();
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
    writeModLib(out);
    applyLibToEnabled();
    renderStartList();
    toast(doReload ? "Reloading…" : "Added");
    if (doReload) location.reload();
  };

  const startEnableAll = (on) => {
    writeModLib(readModLib().map(x => ({ ...x, enabled: !!on })));
    applyLibToEnabled();
    renderStartList();
    toast(on ? "Enabled all (reload)" : "Disabled all (reload)");
  };

  const startClearSessionOff = () => {
    writeStartSessionOff(new Set());
    applyLibToEnabled();
    renderStartList();
    toast("Cleared session-off (reload)");
  };

  const startBackupPrompt = () => {
    const cur = readModLib();
    copyText(JSON.stringify(cur, null, 2));
    const txt = prompt("Backup/Restore Startup Mods (JSON)\n\nCopied current JSON to clipboard.\nPaste JSON here to restore (Cancel = do nothing).", "");
    if (!txt) return;
    const v = jp(txt, null);
    if (!Array.isArray(v)) return toast("Bad JSON");
    const lib = v
      .filter(x => x && typeof x.id === "string")
      .map(x => ({ id: x.id.trim(), enabled: !!x.enabled, addedAt: Number(x.addedAt || Date.now()) }))
      .filter(x => x.id && modLooks(x.id));
    writeModLib(lib);
    applyLibToEnabled();
    renderStartList();
    toast("Restored (reload)");
  };

  const renderStartList = () => {
    const list = $("#neoStartList");
    if (!list) return;

    const enabledSet = new Set(readEnabledMods());
    const off = readStartSessionOff();

    let lib = readModLib();
    lib.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.id.localeCompare(b.id));

    list.innerHTML = "";
    const total = lib.length;
    const enabled = lib.filter(x => x.enabled).length;
    list.appendChild(el("div", { class: "neoSmall", style: "margin-top:10px;" }, `Saved ${total} • Enabled ${enabled} • Session-off ${off.size}`));

    for (const m of lib) {
      const row = el("div", { class: "neoRow", style: "margin-top:10px;" });

      const cb = el("input", {
        type: "checkbox",
        checked: m.enabled ? "checked" : null,
        onchange: (ev) => {
          writeModLib(readModLib().map(x => x.id === m.id ? { ...x, enabled: !!ev.target.checked } : x));
          applyLibToEnabled();
          renderStartList();
          toast("Changed (reload)");
        }
      });

      const sessionBtn = el("button", { class: "neoBtn ghost" }, off.has(m.id) ? "Session off" : "Session on");
      sessionBtn.onclick = () => {
        const set = readStartSessionOff();
        if (set.has(m.id)) set.delete(m.id); else set.add(m.id);
        writeStartSessionOff(set);
        applyLibToEnabled();
        renderStartList();
        toast("Reload to apply");
      };

      const badge = enabledSet.has(m.id) && !off.has(m.id)
        ? el("span", { class: "neoBadge ok" }, "Enabled")
        : el("span", { class: "neoBadge warn" }, "Reload");

      row.append(
        cb,
        el("span", { style: "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" }, m.id),
        badge,
        sessionBtn,
        el("button", { class: "neoBtn ghost", onclick: () => copyText(m.id) }, "Copy"),
        el("button", {
          class: "neoBtn ghost",
          onclick: () => {
            writeModLib(readModLib().filter(x => x.id !== m.id));
            const set = readStartSessionOff(); set.delete(m.id); writeStartSessionOff(set);
            applyLibToEnabled();
            renderStartList();
            toast("Removed (reload)");
          }
        }, "Remove")
      );

      list.appendChild(row);
    }
  };

  const liveSaveOnly = () => {
    const inp = $("#neoLiveUrl");
    const u = String(inp?.value || "").trim();
    if (!u) return toast("No URL");
    if (!modLooks(u)) return toast("URL must be a .js mod");
    const list = neoModsRead().map(x => String(x || "").trim()).filter(Boolean);
    if (!list.includes(u)) list.push(u);
    neoModsWrite(list);
    renderLiveList();
    toast("Saved");
  };

  const liveLoadNow = async () => {
    const inp = $("#neoLiveUrl");
    const u = String(inp?.value || "").trim();
    if (!u) return toast("No URL");
    if (!modLooks(u)) return toast("URL must be a .js mod");

    try {
      await Neo.load(u);
      toast("Loaded");
    } catch {
      toast("Load blocked");
    }
  };

  const liveBackupPrompt = () => {
    const cur = neoModsRead();
    copyText(JSON.stringify(cur, null, 2));
    const txt = prompt("Backup/Restore Live Mods (JSON array)\n\nCopied current JSON to clipboard.\nPaste JSON here to restore (Cancel = do nothing).", "");
    if (!txt) return;
    const v = jp(txt, null);
    if (!Array.isArray(v)) return toast("Bad JSON");
    const list = v.map(x => String(x || "").trim()).filter(Boolean).filter(modLooks);
    neoModsWrite(list);
    renderLiveList();
    toast("Restored");
  };

  const liveLoadAllSaved = async () => {
    const list = neoModsRead().map(x => String(x || "").trim()).filter(Boolean).filter(modLooks);
    if (!list.length) return toast("No saved live mods");
    const off = neoSessionOffRead();
    let ok = 0, fail = 0, skip = 0;
    for (const u of list) {
      if (off.has(u)) { skip++; continue; }
      try { await Neo.load(u); ok++; } catch { fail++; }
    }
    toast(`Loaded ${ok}${skip ? ` • skipped ${skip}` : ""}${fail ? ` • failed ${fail}` : ""}`);
  };

  const liveClearSessionOff = () => {
    neoSessionOffWrite(new Set());
    renderLiveList();
    toast("Cleared session-off");
  };

  const renderLiveList = () => {
    const list = $("#neoLiveList");
    if (!list) return;

    const saved = neoModsRead().map(x => String(x || "").trim()).filter(Boolean).filter(modLooks);
    const off = neoSessionOffRead();

    list.innerHTML = "";
    list.appendChild(el("div", { class: "neoSmall", style: "margin-top:10px;" }, `Saved ${saved.length} • Session-off ${off.size}`));

    for (const url of saved) {
      const row = el("div", { class: "neoRow", style: "margin-top:10px;" });

      const badge = off.has(url)
        ? el("span", { class: "neoBadge warn" }, "Off")
        : el("span", { class: "neoBadge ok" }, "On");

      const sessionBtn = el("button", { class: "neoBtn ghost" }, off.has(url) ? "Enable" : "Session off");
      sessionBtn.onclick = () => {
        const set = neoSessionOffRead();
        if (set.has(url)) set.delete(url); else set.add(url);
        neoSessionOffWrite(set);
        renderLiveList();
        toast(set.has(url) ? "Session off" : "Enabled");
      };

      row.append(
        el("span", { style: "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" }, url),
        badge,
        el("button", { class: "neoBtn ghost", onclick: () => Neo.load(url).then(() => toast("Loaded")).catch(() => toast("Load blocked")) }, "Load"),
        sessionBtn,
        el("button", { class: "neoBtn ghost", onclick: () => copyText(url) }, "Copy"),
        el("button", {
          class: "neoBtn ghost",
          onclick: () => {
            neoModsWrite(neoModsRead().filter(x => String(x || "").trim() !== url));
            const set = neoSessionOffRead(); set.delete(url); neoSessionOffWrite(set);
            renderLiveList();
            toast("Removed");
          }
        }, "Remove")
      );

      list.appendChild(row);
    }
  };

  const liveAutoLoadSaved = async () => {
    const saved = neoModsRead().map(x => String(x || "").trim()).filter(Boolean).filter(modLooks);
    if (!saved.length) return;
    const off = neoSessionOffRead();
    for (const url of saved) {
      if (off.has(url)) continue;
      try { await Neo.load(url); } catch {}
    }
  };

  const selectHook = () => {
    if (typeof window.selectElement !== "function") return;
    if (window.selectElement._neoHooked) return;
    const orig = window.selectElement;
    const wrapped = function(name, ...rest) {
      try { Neo.emit("elementSelected", name, Neo.refs()); } catch {}
      return orig.call(this, name, ...rest);
    };
    wrapped._neoHooked = true;
    window.selectElement = wrapped;
  };

  const ensureDefaults = () => {
    const s = loadSettings();
    if (localStorage.getItem(K.scale) == null) localStorage.setItem(K.scale, String(s.scale));
    if (localStorage.getItem(K.topLift) == null) localStorage.setItem(K.topLift, String(s.topLift));
    if (localStorage.getItem(K.openE) == null) localStorage.setItem(K.openE, s.openElementsOnStart ? "1" : "0");
    if (localStorage.getItem(K.openO) == null) localStorage.setItem(K.openO, "0");
    if (localStorage.getItem(K.wE) == null) localStorage.setItem(K.wE, "560");
    if (localStorage.getItem(K.wO) == null) localStorage.setItem(K.wO, "560");
    if (localStorage.getItem(K.maxE) == null) localStorage.setItem(K.maxE, "0");
    if (localStorage.getItem(K.maxO) == null) localStorage.setItem(K.maxO, "0");
    if (localStorage.getItem(K.compact) == null) localStorage.setItem(K.compact, s.compact ? "1" : "0");
    if (localStorage.getItem(K.hideCats) == null) localStorage.setItem(K.hideCats, s.hideCats ? "1" : "0");
    if (localStorage.getItem(K.favFirst) == null) localStorage.setItem(K.favFirst, s.favFirst ? "1" : "0");
    if (localStorage.getItem(K.tps) == null) localStorage.setItem(K.tps, String(getTPS()));
  };

  const liveApply = () => {
    const s = loadSettings();

    document.body.classList.toggle("neoUI", !!s.enableNeoUI);
    document.body.classList.toggle("neoTopStyle", !!(s.enableNeoUI && s.restyleTop));
    document.body.classList.toggle("neoHideVanilla", !!(s.enableNeoUI && s.neoElementsUI && s.hideVanillaElements));

    applyFlags();

    const showE = !!(s.enableNeoUI && s.neoElementsUI);
    const showO = !!(s.enableNeoUI && s.neoOverhaulUI);

    $("#neoElements")?.classList.toggle("open", showE && isOpenE());
    $("#neoOverhaul")?.classList.toggle("open", showO && isOpenO());

    if (!showE) localStorage.setItem(K.openE, "0");
    if (!showO) localStorage.setItem(K.openO, "0");

    $("#neoElements")?.style && ($("#neoElements").style.display = showE ? "" : "none");
    $("#neoOverhaul")?.style && ($("#neoOverhaul").style.display = showO ? "" : "none");
    $("#neoOverlay")?.style && ($("#neoOverlay").style.display = (showE || showO) ? "" : "none");
    $("#neoEdgeL")?.style && ($("#neoEdgeL").style.display = showE ? "" : "none");
    $("#neoEdgeR")?.style && ($("#neoEdgeR").style.display = showO ? "" : "none");

    addTopButtons();
    buildOverhaul();
    updateTop();
    updateLayout();
    renderCats();
    renderElements();
    improveModsBar();
    renderInfo();
    smarterHumansPatch();
    selectHook();
    hookEngine.tryHook();
    injectCreditTag();
  };

  const installHotkeys = () => {
    window.addEventListener("keydown", (ev) => {
      const s = loadSettings();
      if (!s.hotkeys || !s.enableNeoUI) return;

      const a = document.activeElement;
      const typing = a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");

      if (!typing && s.neoElementsUI && ev.key.toLowerCase() === "b") { ev.preventDefault(); setOpenE(!isOpenE()); }
      if (!typing && s.neoOverhaulUI && ev.key.toLowerCase() === "o") { ev.preventDefault(); setOpenO(!isOpenO()); }

      if (!typing && s.neoElementsUI && ev.key === "/") {
        ev.preventDefault();
        setOpenE(true);
        $("#neoSearch")?.focus();
        $("#neoSearch")?.select();
      }

      if ((ev.ctrlKey || ev.metaKey) && ev.key === "0") {
        ev.preventDefault();
        panicReset();
      }
    }, { passive: false });
  };

  afterLoad(async () => {
    cleanup();

    try { await waitFor(() => $("#controls") && $("#toolControls")); } catch {}
    try { await waitFor(() => window.elements && Object.keys(window.elements).length > 20); } catch {}

    ensureDefaults();

    css("neoStyle", styleText());

    document.body.style.setProperty("--neoScale", String(readScale()));

    buildUI();

    $("#neoElements")?.classList.toggle("open", isOpenE());
    $("#neoOverhaul")?.classList.toggle("open", isOpenO());
    $("#neoElements")?.classList.toggle("neoDrawerMax", isMax("e"));
    $("#neoOverhaul")?.classList.toggle("neoDrawerMax", isMax("o"));

    const s = loadSettings();
    document.body.classList.add("neoUI");
    document.body.classList.toggle("neoTopStyle", !!(s.enableNeoUI && s.restyleTop));
    document.body.classList.toggle("neoHideVanilla", !!(s.enableNeoUI && s.neoElementsUI && s.hideVanillaElements));

    addTopButtons();
    applyFlags();
    buildOverhaul();

    updateTop();
    updateLayout();

    renderCats();
    setTab(tab);
    renderElements();

    improveModsBar();
    renderInfo();
    setTPS(getTPS());

    syncLibFromEnabled();
    applyLibToEnabled();

    try { await liveAutoLoadSaved(); } catch {}

    installHotkeys();
    watchModsMenu();

    selectHook();
    hookEngine.tryHook();

    injectCreditTag();
    setInterval(injectCreditTag, 1500);

    window.addEventListener("resize", () => { updateTop(); updateLayout(); });
    setInterval(() => { updateTop(); updateLayout(); renderInfo(); hookEngine.tryHook(); }, 900);

    Neo.version = "1.1.0";
    Neo.emit("elements", window.elements);
    Neo.emit("ready");

    toast("Neo UI+ loaded");
  });
})();
