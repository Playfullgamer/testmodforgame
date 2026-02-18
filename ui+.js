// sbx_overhaul_plus.js
// Sandboxels Overhaul+ (clean UI + lots of QoL + safe behavior/perf tweaks)

(() => {
  "use strict";

  const MOD = {
    name: "Overhaul+",
    version: "0.6.0",
    keys: {
      settings: "sbx_ohp/settings",
      favorites: "sbx_ohp/favorites",
      recents: "sbx_ohp/recents",
    },
    defaults: {
      // UI
      skin: true,
      search: true,
      favorites: true,
      recents: true,
      speed: true,
      tooltips: true,
      compactMode: true,

      // QoL
      hotkeys: true,
      wheelBrush: true,
      inspector: true,
      toasts: true,

      // Tweaks / perf
      smartHumans: true,
      trappedSkip: true,
      lazyGases: true,
    },
  };

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const log = (...a) => console.log(`[${MOD.name}]`, ...a);

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function safeJsonParse(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function loadSettings() {
    const stored = safeJsonParse(localStorage.getItem(MOD.keys.settings) || "{}", {});
    return { ...MOD.defaults, ...stored };
  }
  function saveSettings(next) {
    localStorage.setItem(MOD.keys.settings, JSON.stringify(next));
  }

  function loadList(key) {
    const arr = safeJsonParse(localStorage.getItem(key) || "[]", []);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  }
  function saveList(key, arr) {
    localStorage.setItem(key, JSON.stringify(arr));
  }

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "style") node.setAttribute("style", v);
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }

  function injectCss(id, cssText) {
    $(`#${id}`)?.remove();
    const style = el("style", { id });
    style.textContent = cssText;
    document.head.appendChild(style);
  }

  function waitFor(fn, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const start = performance.now();
      const t = setInterval(() => {
        try {
          const val = fn();
          if (val) { clearInterval(t); resolve(val); }
          else if (performance.now() - start > timeoutMs) { clearInterval(t); reject(new Error("timeout")); }
        } catch {
          if (performance.now() - start > timeoutMs) { clearInterval(t); reject(new Error("timeout")); }
        }
      }, 50);
    });
  }

  function onGameReady(fn) {
    if (typeof window.runAfterLoad === "function") window.runAfterLoad(fn);
    else if (Array.isArray(window.runAfterLoadList)) window.runAfterLoadList.push(fn);
    else window.addEventListener("load", fn, { once: true });
  }

  // ---------- Cleanup old versions (prevents doubled bars / weird CSS stacking)
  function cleanupOld() {
    [
      "sbxOverhaulStyle", "sbxOverhaulPanel", "sbxOverhaulBar", "sbxOverhaulTooltip", "sbxOverhaulBtn",
      "sbxOverhaulStyle2", "sbxOHStyle", "sbxOHBar", "sbxOHPanel", "sbxOHTooltip", "sbxOHToast", "sbxOHInspect"
    ].forEach(id => $(`#${id}`)?.remove());
    document.body?.classList?.remove("sbx-overhaul", "sbx-ohp");
  }

  // ---------- UI Skin (much less global, more consistent)
  function cssSkin() {
    return `
/* ===== Overhaul+ (scoped) ===== */
body.sbx-ohp{
  --ohp-bg: rgba(14,16,20,.92);
  --ohp-panel: rgba(18,21,28,.92);
  --ohp-border: rgba(255,255,255,.12);
  --ohp-border2: rgba(255,255,255,.08);
  --ohp-text: rgba(255,255,255,.92);
  --ohp-muted: rgba(255,255,255,.62);
  --ohp-accent: rgba(76,201,240,.90);
  --ohp-accent2: rgba(167,139,250,.85);
  --ohp-radius: 14px;
  --ohp-shadow: 0 14px 44px rgba(0,0,0,.45);
}

/* Only lightly reskin the top tool buttons (no menu/tab surgery) */
body.sbx-ohp #toolControls .controlButton{
  border-radius: 999px !important;
  border: 1px solid var(--ohp-border2) !important;
  background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04)) !important;
  box-shadow: 0 6px 16px rgba(0,0,0,.25);
  transition: transform .06s ease, filter .12s ease;
}
body.sbx-ohp #toolControls .controlButton:hover{ filter: brightness(1.08); }
body.sbx-ohp #toolControls .controlButton:active{ transform: translateY(1px); }

/* New bar */
#sbxOHBar{
  margin: 6px 0 8px 0;
  border-radius: var(--ohp-radius);
  border: 1px solid var(--ohp-border);
  background: var(--ohp-panel);
  box-shadow: var(--ohp-shadow);
  padding: 10px 10px 8px 10px;
}
#sbxOHBar.compact{
  padding: 8px 8px 6px 8px;
}

.sbxOHRow{
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.sbxOHRow + .sbxOHRow{ margin-top: 8px; }

.sbxOHLeftGrow{ flex: 1 1 260px; min-width: 240px; }

.sbxOHSearchWrap{
  display:flex;
  align-items:center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid var(--ohp-border2);
  background: rgba(255,255,255,.05);
}
#sbxOHSearch{
  flex:1;
  min-width: 140px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--ohp-text);
}
#sbxOHSearch::placeholder{ color: var(--ohp-muted); }
.sbxOHIconBtn{
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid var(--ohp-border2);
  background: rgba(255,255,255,.06);
  color: var(--ohp-text);
  cursor: pointer;
  user-select: none;
}
.sbxOHIconBtn:hover{ filter: brightness(1.10); }

.sbxOHGroup{
  display:flex;
  align-items:center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 999px;
  border: 1px solid var(--ohp-border2);
  background: rgba(255,255,255,.04);
}
.sbxOHLabel{
  font-size: 12px;
  color: var(--ohp-muted);
  user-select: none;
  margin-right: 2px;
}
#sbxOHTps{
  width: 62px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--ohp-text);
  text-align: center;
}
.sbxOHMiniBtn{
  width: 26px;
  height: 26px;
  border-radius: 999px;
  border: 1px solid var(--ohp-border2);
  background: rgba(255,255,255,.06);
  color: var(--ohp-text);
  cursor: pointer;
}

.sbxOHChips{
  display:flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.sbxOHChip{
  display:flex;
  align-items:center;
  gap: 8px;
  max-width: 210px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--ohp-border2);
  background: rgba(255,255,255,.06);
  color: var(--ohp-text);
  cursor: pointer;
  user-select:none;
}
.sbxOHChip:hover{ filter: brightness(1.12); }
.sbxOHDot{
  width: 9px; height: 9px;
  border-radius: 999px;
  box-shadow: inset 0 0 0 2px rgba(0,0,0,.18);
}
.sbxOHChipTxt{
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sbxOHSectionTitle{
  font-size: 12px;
  color: var(--ohp-muted);
  margin: 2px 6px 0 4px;
  user-select: none;
}

/* Tooltip */
#sbxOHTooltip{
  position: fixed;
  z-index: 999999;
  pointer-events: none;
  border-radius: 12px;
  border: 1px solid var(--ohp-border);
  background: rgba(12,14,18,.94);
  color: var(--ohp-text);
  box-shadow: var(--ohp-shadow);
  padding: 8px 10px;
  max-width: 360px;
  display:none;
  font-size: 12px;
}
#sbxOHTooltip .muted{ color: var(--ohp-muted); }
#sbxOHTooltip b{ color: rgba(255,255,255,.98); }

/* Panel */
#sbxOHPanel{
  position: fixed;
  right: 14px; top: 14px;
  width: 360px; max-width: calc(100vw - 28px);
  z-index: 999998;
  border-radius: 16px;
  border: 1px solid var(--ohp-border);
  background: rgba(18,21,28,.96);
  box-shadow: var(--ohp-shadow);
  color: var(--ohp-text);
  padding: 12px;
  display:none;
}
.sbxOHToggle{
  display:flex;
  gap: 10px;
  align-items:flex-start;
  padding: 8px 8px;
  border-radius: 12px;
  cursor: pointer;
}
.sbxOHToggle:hover{ background: rgba(255,255,255,.04); }
.sbxOHToggle input{ margin-top: 3px; }
.sbxOHSmall{ font-size: 12px; color: var(--ohp-muted); }

/* Toast */
#sbxOHToast{
  position: fixed;
  left: 12px; bottom: 12px;
  z-index: 999999;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid var(--ohp-border);
  background: rgba(12,14,18,.92);
  color: var(--ohp-text);
  box-shadow: var(--ohp-shadow);
  display:none;
  font-size: 12px;
}

/* Inspector */
#sbxOHInspect{
  position: fixed;
  z-index: 999999;
  border-radius: 14px;
  border: 1px solid var(--ohp-border);
  background: rgba(12,14,18,.94);
  color: var(--ohp-text);
  box-shadow: var(--ohp-shadow);
  padding: 10px 12px;
  display:none;
  font-size: 12px;
  max-width: 380px;
}
#sbxOHInspect .muted{ color: var(--ohp-muted); }
`;
  }

  // ---------- Toast
  let toastTimer = null;
  function toast(msg) {
    const settings = loadSettings();
    if (!settings.toasts) return;

    const t = $("#sbxOHToast");
    if (!t) return;
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.style.display = "none"), 1300);
  }

  // ---------- Element helpers
  function elementNameFromButton(btn) {
    return btn?.getAttribute?.("element") || btn?.id?.replace?.("elementButton-", "") || null;
  }
  function allElementButtons() {
    return $$(".elementButton").filter(b => b.id && b.id.startsWith("elementButton-"));
  }
  function elementColor(name) {
    const e = window.elements?.[name];
    if (!e) return null;
    const c = e.color;
    if (Array.isArray(c)) return c[0];
    if (typeof c === "string") return c;
    return null;
  }

  // ---------- Favorites / Recents
  function getFavs() { return loadList(MOD.keys.favorites); }
  function setFavs(arr) { saveList(MOD.keys.favorites, arr.slice(0, 30)); }

  function getRecents() { return loadList(MOD.keys.recents); }
  function setRecents(arr) { saveList(MOD.keys.recents, arr.slice(0, 18)); }

  function toggleFavorite(name) {
    if (!name) return;
    const favs = getFavs();
    const i = favs.indexOf(name);
    if (i >= 0) { favs.splice(i, 1); toast(`Unfavorited: ${name}`); }
    else { favs.unshift(name); toast(`Favorited: ${name}`); }
    setFavs(favs);
  }

  function pushRecent(name) {
    if (!name) return;
    const r = getRecents();
    const next = [name, ...r.filter(x => x !== name)];
    setRecents(next);
  }

  function markFavoriteButtons() {
    const favSet = new Set(getFavs());
    for (const btn of allElementButtons()) {
      const name = elementNameFromButton(btn);
      if (!name) continue;
      if (favSet.has(name)) {
        btn.style.outline = "2px solid rgba(76,201,240,.65)";
        btn.style.outlineOffset = "2px";
      } else {
        btn.style.outline = "";
        btn.style.outlineOffset = "";
      }
    }
  }

  // ---------- Search filter
  function filterElements(query) {
    const q = (query || "").trim().toLowerCase();
    const buttons = allElementButtons();
    if (!q) { for (const b of buttons) b.style.display = ""; return; }
    for (const b of buttons) {
      const name = (elementNameFromButton(b) || "").toLowerCase();
      b.style.display = name.includes(q) ? "" : "none";
    }
  }

  // ---------- UI build
  function buildBar() {
    const settings = loadSettings();
    if (!$("#controls") || $("#sbxOHBar")) return;

    const bar = el("div", { id: "sbxOHBar", class: settings.compactMode ? "compact" : "" });

    // Row 1: search + speed + settings
    const row1 = el("div", { class: "sbxOHRow" });

    // Search
    let searchInput = null;
    if (settings.search) {
      searchInput = el("input", {
        id: "sbxOHSearch",
        type: "text",
        placeholder: "Search elements…  (Ctrl+K / /)",
        oninput: () => filterElements(searchInput.value),
      });

      const clearBtn = el("button", {
        class: "sbxOHIconBtn",
        title: "Clear search (Esc)",
        onclick: () => {
          searchInput.value = "";
          filterElements("");
          searchInput.focus();
        }
      }, "×");

      const searchWrap = el("div", { class: "sbxOHSearchWrap sbxOHLeftGrow" }, searchInput, clearBtn);
      row1.appendChild(searchWrap);
    } else {
      row1.appendChild(el("div", { class: "sbxOHLeftGrow" }));
    }

    // TPS controls
    if (settings.speed) {
      const minus = el("button", { class: "sbxOHMiniBtn", title: "TPS -5 (Alt+-)" }, "−");
      const plus  = el("button", { class: "sbxOHMiniBtn", title: "TPS +5 (Alt+=)" }, "+");
      const input = el("input", { id: "sbxOHTps", type: "number", min: "1", max: "1000", value: "" });

      function getTPS() {
        if (typeof window.tps === "number") return window.tps;
        return parseInt(input.value || "30", 10);
      }
      function setTPS(n) {
        n = clamp(Math.abs(parseInt(n || "30", 10)), 1, 1000);
        input.value = String(n);
        if (typeof window.setTPS === "function") window.setTPS(n);
      }

      // init
      input.value = (typeof window.tps === "number") ? String(window.tps) : "30";

      minus.onclick = () => setTPS(getTPS() - 5);
      plus.onclick = () => setTPS(getTPS() + 5);
      input.onchange = () => setTPS(input.value);
      input.onkeydown = (ev) => { if (ev.key === "Enter") input.blur(); };

      const tpsGroup = el("div", { class: "sbxOHGroup" },
        el("span", { class: "sbxOHLabel" }, "TPS"),
        minus, input, plus
      );
      row1.appendChild(tpsGroup);
    }

    // Settings button
    const gear = el("button", { class: "sbxOHIconBtn", title: "Overhaul+ settings" }, "⚙");
    gear.onclick = () => togglePanel();
    row1.appendChild(gear);

    // Row 2: favorites + recents
    const row2 = el("div", { class: "sbxOHRow" });

    const favBlock = el("div", { style: "display:flex; flex-direction:column; gap:6px; flex: 1 1 340px; min-width: 260px;" });
    const recBlock = el("div", { style: "display:flex; flex-direction:column; gap:6px; flex: 1 1 340px; min-width: 260px;" });

    const favTitle = el("div", { class: "sbxOHSectionTitle" }, "Favorites (right-click or long-press an element button)");
    const favChips = el("div", { class: "sbxOHChips", id: "sbxOHFavChips" });
    favBlock.appendChild(favTitle);
    favBlock.appendChild(favChips);

    const recTitle = el("div", { class: "sbxOHSectionTitle" }, "Recent");
    const recChips = el("div", { class: "sbxOHChips", id: "sbxOHRecChips" });
    recBlock.appendChild(recTitle);
    recBlock.appendChild(recChips);

    if (settings.favorites) row2.appendChild(favBlock);
    if (settings.recents) row2.appendChild(recBlock);

    bar.appendChild(row1);
    if (settings.favorites || settings.recents) bar.appendChild(row2);

    // Insert above category controls
    const controls = $("#controls");
    const categoryControls = $("#categoryControls");
    if (controls && categoryControls) controls.insertBefore(bar, categoryControls);
    else controls?.prepend(bar);

    // Hotkeys: Ctrl+K + / + Esc
    if (settings.search && settings.hotkeys) {
      window.addEventListener("keydown", (ev) => {
        const active = document.activeElement;
        const typing = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");

        if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") {
          ev.preventDefault();
          searchInput?.focus(); searchInput?.select();
        }
        if (!typing && ev.key === "/") {
          ev.preventDefault();
          searchInput?.focus(); searchInput?.select();
        }
        if (ev.key === "Escape" && active === searchInput) {
          searchInput.value = "";
          filterElements("");
          searchInput.blur();
        }
      }, { passive: false });
    }

    renderChips();
  }

  function chipButton(name, kind) {
    const dot = el("span", {
      class: "sbxOHDot",
      style: `background:${elementColor(name) || "rgba(255,255,255,.35)"};`
    });
    const txt = el("span", { class: "sbxOHChipTxt" }, name);
    const btn = el("button", { class: "sbxOHChip", title: "Click to select" }, dot, txt);

    btn.onclick = () => {
      if (typeof window.selectElement === "function") window.selectElement(name);
      pushRecent(name);
      renderChips();
      window.focusGame?.();
    };

    // middle click removes (favorites only)
    btn.onauxclick = (ev) => {
      if (ev.button !== 1) return;
      if (kind === "fav") {
        ev.preventDefault();
        toggleFavorite(name);
        markFavoriteButtons();
        renderChips();
      }
    };

    return btn;
  }

  function renderChips() {
    const favWrap = $("#sbxOHFavChips");
    const recWrap = $("#sbxOHRecChips");
    const settings = loadSettings();

    if (settings.favorites && favWrap) {
      favWrap.innerHTML = "";
      const favs = getFavs().filter(n => window.elements?.[n]);
      if (favs.length === 0) {
        favWrap.appendChild(el("span", { class: "sbxOHSmall" }, "No favorites yet."));
      } else {
        for (const n of favs) favWrap.appendChild(chipButton(n, "fav"));
      }
    }

    if (settings.recents && recWrap) {
      recWrap.innerHTML = "";
      const rec = getRecents().filter(n => window.elements?.[n]).slice(0, 10);
      if (rec.length === 0) {
        recWrap.appendChild(el("span", { class: "sbxOHSmall" }, "No recents yet."));
      } else {
        for (const n of rec) recWrap.appendChild(chipButton(n, "rec"));
      }
    }
  }

  // ---------- Right-click + touch long-press to favorite
  function hookFavoriteInput() {
    const root = $("#elementControls") || document;
    if (root.__ohpFavHooked) return;
    root.__ohpFavHooked = true;

    // right click
    root.addEventListener("contextmenu", (ev) => {
      const btn = ev.target?.closest?.(".elementButton");
      if (!btn || !btn.id?.startsWith("elementButton-")) return;
      ev.preventDefault();
      const name = elementNameFromButton(btn);
      toggleFavorite(name);
      markFavoriteButtons();
      renderChips();
    }, { capture: true });

    // long-press for touch
    let pressTimer = null;
    root.addEventListener("pointerdown", (ev) => {
      const btn = ev.target?.closest?.(".elementButton");
      if (!btn || !btn.id?.startsWith("elementButton-")) return;
      // only on touch / pen
      if (ev.pointerType === "mouse") return;
      const name = elementNameFromButton(btn);
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        toggleFavorite(name);
        markFavoriteButtons();
        renderChips();
      }, 450);
    }, { capture: true });

    root.addEventListener("pointerup", () => clearTimeout(pressTimer), { capture: true });
    root.addEventListener("pointercancel", () => clearTimeout(pressTimer), { capture: true });
  }

  // ---------- Wrap selectElement to track recents
  function hookRecents() {
    if (typeof window.selectElement !== "function") return;
    if (window.selectElement.__ohpWrapped) return;

    const old = window.selectElement;
    function wrapped(name, ...rest) {
      try {
        pushRecent(name);
        renderChips();
      } catch {}
      return old.call(this, name, ...rest);
    }
    wrapped.__ohpWrapped = true;
    window.selectElement = wrapped;
  }

  // ---------- Tooltip for element buttons (cleaner, more useful)
  function installTooltip() {
    if ($("#sbxOHTooltip")) return;
    const tip = el("div", { id: "sbxOHTooltip" });
    document.body.appendChild(tip);

    function show(x, y, html) {
      tip.innerHTML = html;
      tip.style.display = "block";
      const pad = 14;
      const maxX = window.innerWidth - 18;
      const maxY = window.innerHeight - 18;
      tip.style.left = `${Math.min(maxX, x + pad)}px`;
      tip.style.top  = `${Math.min(maxY, y + pad)}px`;
    }
    function hide() { tip.style.display = "none"; }

    document.addEventListener("mousemove", (ev) => {
      if (tip.style.display !== "none") {
        const pad = 14;
        const maxX = window.innerWidth - 18;
        const maxY = window.innerHeight - 18;
        tip.style.left = `${Math.min(maxX, ev.clientX + pad)}px`;
        tip.style.top  = `${Math.min(maxY, ev.clientY + pad)}px`;
      }
    });

    document.addEventListener("mouseover", (ev) => {
      const btn = ev.target?.closest?.(".elementButton");
      if (!btn || !btn.id?.startsWith("elementButton-")) return;

      const name = elementNameFromButton(btn);
      const e = window.elements?.[name];
      if (!e) return;

      const cat = e.category ?? "—";
      const state = e.state ?? "—";
      const dens = (typeof e.density === "number") ? e.density : "—";
      const visc = (typeof e.viscosity === "number") ? e.viscosity : "—";
      const desc = e.desc || e.description || "";

      show(ev.clientX, ev.clientY,
        `<b>${name}</b><br>
         <span class="muted">Category:</span> ${cat} &nbsp; <span class="muted">State:</span> ${state}<br>
         <span class="muted">Density:</span> ${dens} &nbsp; <span class="muted">Viscosity:</span> ${visc}
         ${desc ? `<br><span class="muted">${String(desc).slice(0, 220)}</span>` : ""}`
      );
    }, { capture: true });

    document.addEventListener("mouseout", (ev) => {
      const btn = ev.target?.closest?.(".elementButton");
      if (!btn) return;
      hide();
    }, { capture: true });
  }

  // ---------- Inspector (Alt+Click canvas to read pixel data)
  function installInspector() {
    if ($("#sbxOHInspect")) return;
    const box = el("div", { id: "sbxOHInspect" });
    document.body.appendChild(box);

    function hideSoon() {
      setTimeout(() => { box.style.display = "none"; }, 1600);
    }

    function findCanvas() {
      // Sandboxels usually has one main canvas; take the biggest
      const canvases = $$("canvas");
      if (!canvases.length) return null;
      return canvases.sort((a,b) => (b.width*b.height) - (a.width*a.height))[0];
    }

    function screenToGrid(ev, canvas) {
      const rect = canvas.getBoundingClientRect();
      const rx = (ev.clientX - rect.left) / rect.width;
      const ry = (ev.clientY - rect.top) / rect.height;

      const px = clamp(rx * canvas.width, 0, canvas.width - 1);
      const py = clamp(ry * canvas.height, 0, canvas.height - 1);

      // If pixelSize exists, convert to grid
      const ps = (typeof window.pixelSize === "number" && window.pixelSize > 0) ? window.pixelSize : 1;
      const gx = Math.floor(px / ps);
      const gy = Math.floor(py / ps);
      return { gx, gy };
    }

    window.addEventListener("pointerdown", (ev) => {
      const settings = loadSettings();
      if (!settings.inspector) return;
      if (!ev.altKey) return;

      const canvas = findCanvas();
      if (!canvas) return;

      const { gx, gy } = screenToGrid(ev, canvas);
      const p = window.pixelMap?.[gx]?.[gy];
      const elName = p?.element || "empty";

      box.innerHTML = `
        <b>Pixel</b> <span class="muted">(${gx}, ${gy})</span><br>
        <span class="muted">Element:</span> ${elName}<br>
        ${p ? `
          <span class="muted">Temp:</span> ${typeof p.temp === "number" ? p.temp.toFixed(1) : "—"}<br>
          <span class="muted">Charge:</span> ${p.charge ?? "—"}<br>
          <span class="muted">Life:</span> ${p.life ?? "—"}<br>
          <span class="muted">Data:</span> ${Object.keys(p).slice(0, 10).join(", ")}${Object.keys(p).length>10?"…":""}
        ` : `<span class="muted">No pixel here.</span>`}
      `;
      box.style.left = `${Math.min(window.innerWidth - 24, ev.clientX + 14)}px`;
      box.style.top  = `${Math.min(window.innerHeight - 24, ev.clientY + 14)}px`;
      box.style.display = "block";
      hideSoon();
    }, { passive: true });
  }

  // ---------- Wheel brush size (Alt+Wheel on canvas)
  function installWheelBrush() {
    let hud = null, hudTimer = null;

    function showBrush(n) {
      if (!hud) return;
      hud.textContent = `Brush: ${n}`;
      hud.style.display = "block";
      clearTimeout(hudTimer);
      hudTimer = setTimeout(() => hud.style.display = "none", 900);
    }

    function ensureHud() {
      if (hud) return;
      hud = el("div", {
        style: `
          position: fixed; right: 12px; bottom: 12px;
          z-index: 999999;
          padding: 8px 10px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(12,14,18,.92);
          color: rgba(255,255,255,.92);
          box-shadow: 0 14px 44px rgba(0,0,0,.45);
          display:none;
          font-size: 12px;
        `
      });
      document.body.appendChild(hud);
    }

    function findCanvas() {
      const canvases = $$("canvas");
      if (!canvases.length) return null;
      return canvases.sort((a,b) => (b.width*b.height) - (a.width*a.height))[0];
    }

    window.addEventListener("wheel", (ev) => {
      const settings = loadSettings();
      if (!settings.wheelBrush) return;
      if (!ev.altKey) return;

      const canvas = findCanvas();
      if (!canvas) return;

      // only if wheel is over the canvas area
      const rect = canvas.getBoundingClientRect();
      const inside = ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom;
      if (!inside) return;

      ev.preventDefault();
      ensureHud();

      // Sandboxels commonly uses mouseSize; fallback to brushSize if present
      const key = (typeof window.mouseSize === "number") ? "mouseSize"
               : (typeof window.brushSize === "number") ? "brushSize"
               : null;
      if (!key) return;

      const cur = window[key];
      const delta = ev.deltaY > 0 ? -1 : 1;
      const next = clamp(cur + delta, 1, 200);
      window[key] = next;

      // try to sync settings if supported
      if (typeof window.setSetting === "function") {
        try { window.setSetting(key, next); } catch {}
      }

      showBrush(next);
    }, { passive: false });
  }

  // ---------- Hotkeys (favorites + recents + TPS)
  function installHotkeys() {
    window.addEventListener("keydown", (ev) => {
      const settings = loadSettings();
      if (!settings.hotkeys) return;

      const active = document.activeElement;
      const typing = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
      if (typing) return;

      // Alt+1..9 = favorites
      if (ev.altKey && !ev.ctrlKey && !ev.metaKey && /^[1-9]$/.test(ev.key)) {
        const idx = parseInt(ev.key, 10) - 1;
        const fav = getFavs().filter(n => window.elements?.[n])[idx];
        if (fav && typeof window.selectElement === "function") {
          window.selectElement(fav);
          pushRecent(fav);
          renderChips();
          toast(`Selected favorite: ${fav}`);
          ev.preventDefault();
        }
      }

      // Shift+1..9 = recents
      if (ev.shiftKey && !ev.ctrlKey && !ev.metaKey && /^[1-9]$/.test(ev.key)) {
        const idx = parseInt(ev.key, 10) - 1;
        const rec = getRecents().filter(n => window.elements?.[n])[idx];
        if (rec && typeof window.selectElement === "function") {
          window.selectElement(rec);
          toast(`Selected recent: ${rec}`);
          ev.preventDefault();
        }
      }

      // Alt+- / Alt+= TPS adjust
      if (ev.altKey && (ev.key === "-" || ev.key === "=")) {
        const cur = (typeof window.tps === "number") ? window.tps : 30;
        const next = clamp(cur + (ev.key === "-" ? -5 : 5), 1, 1000);
        if (typeof window.setTPS === "function") window.setTPS(next);
        const tpsInput = $("#sbxOHTps");
        if (tpsInput) tpsInput.value = String(next);
        toast(`TPS: ${next}`);
        ev.preventDefault();
      }
    }, { passive: false });
  }

  // ---------- Settings panel
  function buildPanel() {
    if ($("#sbxOHPanel")) return;

    const panel = el("div", { id: "sbxOHPanel" });

    const head = el("div", { style: "display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px;" },
      el("div", {},
        el("div", { style: "font-weight:700;" }, `${MOD.name}`),
        el("div", { class: "sbxOHSmall" }, `v${MOD.version}`)
      ),
      el("button", { class: "sbxOHIconBtn", title: "Close", onclick: () => togglePanel(false) }, "×")
    );

    function toggleRow(key, title, desc) {
      const s = loadSettings();
      const id = `ohp_${key}`;
      const row = el("label", { class: "sbxOHToggle", for: id },
        el("input", {
          id, type: "checkbox",
          checked: s[key] ? "checked" : null,
          onchange: (ev) => {
            const next = loadSettings();
            next[key] = !!ev.target.checked;
            saveSettings(next);
            applySettingsLive();
          }
        }),
        el("div", {},
          el("div", { style: "font-weight:600;" }, title),
          el("div", { class: "sbxOHSmall" }, desc)
        )
      );
      return row;
    }

    const body = el("div", {},
      el("div", { class: "sbxOHSmall", style: "margin: 0 0 6px 2px;" }, "UI"),
      toggleRow("skin", "Clean UI skin", "Less weird spacing, scoped styling, consistent bar"),
      toggleRow("compactMode", "Compact bar", "Less height (looks cleaner)"),
      toggleRow("search", "Search bar", "Filter element buttons instantly"),
      toggleRow("favorites", "Favorites", "Right-click / long-press to pin elements"),
      toggleRow("recents", "Recents", "Shows your last used elements"),
      toggleRow("speed", "TPS controls", "Inline TPS with +/- and hotkeys"),
      toggleRow("tooltips", "Better tooltips", "Cleaner hover info for elements"),

      el("div", { style: "height:1px; background: rgba(255,255,255,.10); margin: 10px 0;" }),

      el("div", { class: "sbxOHSmall", style: "margin: 0 0 6px 2px;" }, "Quality of life"),
      toggleRow("hotkeys", "Hotkeys", "Alt+1..9 favorites, Shift+1..9 recents, / search"),
      toggleRow("wheelBrush", "Alt+Wheel brush size", "Fast brush resize on canvas"),
      toggleRow("inspector", "Alt+Click inspector", "See pixel element/temp/charge quickly"),
      toggleRow("toasts", "Tiny notifications", "Quick feedback for actions"),

      el("div", { style: "height:1px; background: rgba(255,255,255,.10); margin: 10px 0;" }),

      el("div", { class: "sbxOHSmall", style: "margin: 0 0 6px 2px;" }, "Tweaks / performance"),
      toggleRow("smartHumans", "Smart humans", "Humans try to step away from danger"),
      toggleRow("trappedSkip", "Trapped fluid skip", "Skips ticking fully surrounded fluid pixels"),
      toggleRow("lazyGases", "Lazy gases", "Skips ticking fully surrounded gas pixels"),

      el("div", { style: "display:flex; gap:8px; margin-top: 10px; flex-wrap:wrap;" },
        el("button", {
          class: "sbxOHIconBtn",
          style: "width:auto; padding: 6px 10px;",
          onclick: () => { setFavs([]); markFavoriteButtons(); renderChips(); toast("Favorites cleared"); }
        }, "Clear favs"),
        el("button", {
          class: "sbxOHIconBtn",
          style: "width:auto; padding: 6px 10px;",
          onclick: () => { setRecents([]); renderChips(); toast("Recents cleared"); }
        }, "Clear recents"),
        el("button", {
          class: "sbxOHIconBtn",
          style: "width:auto; padding: 6px 10px; border-color: rgba(167,139,250,.45);",
          onclick: () => { saveSettings({ ...MOD.defaults }); toast("Settings reset"); location.reload(); }
        }, "Reset + reload")
      )
    );

    panel.append(head, body);
    document.body.appendChild(panel);
  }

  function togglePanel(force) {
    const p = $("#sbxOHPanel");
    if (!p) return;
    const show = (typeof force === "boolean") ? force : (p.style.display === "none" || !p.style.display);
    p.style.display = show ? "block" : "none";
  }

  function applySettingsLive() {
    // simplest + safest: rebuild the bar + (re)install optional UI pieces
    $("#sbxOHBar")?.remove();
    const s = loadSettings();

    document.body.classList.toggle("sbx-ohp", !!s.skin);

    buildBar();
    hookFavoriteInput();
    hookRecents();
    markFavoriteButtons();
    renderChips();

    if (s.tooltips) installTooltip(); else $("#sbxOHTooltip")?.remove();
    if (s.inspector) { /* already listens */ }
    if (s.wheelBrush) { /* already listens */ }
  }

  // ---------- Tweaks / perf patches (safe-ish)
  function patchSmartHumans() {
    const e = window.elements;
    if (!e?.human || e.human.__ohpSmart || typeof e.human.tick !== "function") return;
    e.human.__ohpSmart = true;

    const old = e.human.tick;
    const danger = new Set([
      "fire", "smoke", "lava", "magma", "acid", "acid_gas", "explosion",
      "radiation", "plasma", "napalm", "greek_fire", "nuke"
    ]);

    const adj = window.adjacentCoords;
    const isEmpty = window.isEmpty;
    const tryMove = window.tryMove;

    e.human.tick = function (pixel) {
      try {
        const pm = window.pixelMap;
        if (!adj || !pm || !isEmpty || !tryMove) return old(pixel);

        let vx = 0, vy = 0, seen = 0;

        for (const [dx, dy] of adj) {
          const nx = pixel.x + dx, ny = pixel.y + dy;
          const p2 = pm?.[nx]?.[ny];
          const nEl = p2?.element;

          const dangerByEl = nEl && danger.has(nEl);
          const dangerByTemp = (typeof p2?.temp === "number" && p2.temp > 250);
          if (dangerByEl || dangerByTemp) { vx += dx; vy += dy; seen++; }
        }

        if (seen > 0) {
          const ax = vx === 0 ? 0 : (vx > 0 ? -1 : 1);
          const ay = vy === 0 ? 0 : (vy > 0 ? -1 : 1);

          const tries = [
            [pixel.x + ax, pixel.y],
            [pixel.x, pixel.y + ay],
            [pixel.x + ax, pixel.y + ay],
            [pixel.x + ax, pixel.y - ay],
          ];

          for (const [tx, ty] of tries) {
            if (tryMove(pixel, tx, ty)) return;
          }
        }
      } catch {}
      return old(pixel);
    };

    log("Patched: smart humans");
  }

  function patchTrappedSkip() {
    const e = window.elements;
    if (!e || !window.adjacentCoords) return;
    const adj = window.adjacentCoords;

    const targets = [
      // fluids
      "water", "salt_water", "dirty_water", "steam", "smoke", "cloud",
      // common gases (some may not exist)
      "oxygen", "hydrogen", "carbon_dioxide", "helium", "nitrogen"
    ];

    for (const name of targets) {
      const elDef = e[name];
      if (!elDef || typeof elDef.tick !== "function" || elDef.__ohpTrapped) continue;
      elDef.__ohpTrapped = true;

      const old = elDef.tick;
      elDef.tick = function (pixel) {
        try {
          // randomize so we don't do neighbor checks every tick
          if (Math.random() < 0.40) {
            const pm = window.pixelMap;
            if (!pm) return old(pixel);

            let trapped = true;
            for (const [dx, dy] of adj) {
              const nx = pixel.x + dx, ny = pixel.y + dy;
              const p2 = pm?.[nx]?.[ny];
              if (!p2 || p2.element !== pixel.element) { trapped = false; break; }
            }
            if (trapped) return;
          }
        } catch {}
        return old(pixel);
      };
    }

    log("Patched: trapped skip");
  }

  function patchLazyGases() {
    const e = window.elements;
    if (!e || !window.adjacentCoords) return;
    const adj = window.adjacentCoords;

    // patch any element with state === "gas"
    for (const [name, def] of Object.entries(e)) {
      if (!def || typeof def.tick !== "function" || def.__ohpLazyGas) continue;
      if (def.state !== "gas") continue;

      def.__ohpLazyGas = true;
      const old = def.tick;

      def.tick = function (pixel) {
        try {
          // only sometimes, and only if surrounded by same gas
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

    log("Patched: lazy gases");
  }

  // ---------- Observe UI changes (mods often rebuild element buttons)
  function installObserver() {
    const root = $("#elementControls");
    if (!root || root.__ohpObs) return;
    root.__ohpObs = true;

    let pending = false;
    const mo = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      setTimeout(() => {
        pending = false;
        markFavoriteButtons();
        renderChips();
      }, 120);
    });
    mo.observe(root, { childList: true, subtree: true });
  }

  // ---------- Boot
  onGameReady(async () => {
    cleanupOld();

    // basic anchors
    try { await waitFor(() => $("#controls")); } catch {}
    try { await waitFor(() => $("#elementControls")); } catch {}

    const settings = loadSettings();

    // CSS + base nodes
    if (settings.skin) document.body.classList.add("sbx-ohp");
    injectCss("sbxOHStyle", cssSkin());

    // support UI nodes
    document.body.appendChild(el("div", { id: "sbxOHToast" }));
    buildPanel();
    buildBar();

    // hooks
    hookFavoriteInput();
    hookRecents();
    installObserver();

    // optional UI features
    if (settings.tooltips) installTooltip();
    if (settings.inspector) installInspector();
    if (settings.wheelBrush) installWheelBrush();
    if (settings.hotkeys) installHotkeys();

    // patches (safe-ish)
    if (settings.smartHumans) patchSmartHumans();
    if (settings.trappedSkip) patchTrappedSkip();
    if (settings.lazyGases) patchLazyGases();

    // initial visuals
    markFavoriteButtons();
    renderChips();

    log("Loaded", settings);
  });

})();
