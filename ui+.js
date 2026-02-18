// sbx_overhaul.js
// Sandboxels Overhaul: UI reskin + search + favorites + quick speed + behavior/perf tweaks

(() => {
  "use strict";

  const MOD = {
    name: "Sandboxels Overhaul",
    version: "0.3.0",
    keys: {
      settings: "sbx_overhaul/settings",
      favorites: "sbx_overhaul/favorites",
    },
    defaults: {
      uiReskin: true,
      searchBar: true,
      favoritesBar: true,
      quickSpeed: true,
      tooltip: true,

      // Gameplay/behavior:
      smartHumans: true,

      // Perf:
      trappedSkipForCommonFluids: true,
    },
  };

  const log = (...a) => console.log(`[${MOD.name}]`, ...a);

  function safeJsonParse(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function loadSettings() {
    const raw = localStorage.getItem(MOD.keys.settings);
    const stored = raw ? safeJsonParse(raw, {}) : {};
    return { ...MOD.defaults, ...stored };
  }
  function saveSettings(next) {
    localStorage.setItem(MOD.keys.settings, JSON.stringify(next));
  }

  function loadFavorites() {
    const raw = localStorage.getItem(MOD.keys.favorites);
    const arr = raw ? safeJsonParse(raw, []) : [];
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  }
  function saveFavorites(arr) {
    localStorage.setItem(MOD.keys.favorites, JSON.stringify(arr));
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

  function injectCss(cssText) {
    const style = el("style", { id: "sbxOverhaulStyle" });
    style.textContent = cssText;
    document.head.appendChild(style);
  }

  function waitForSelector(selector, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const start = performance.now();
      const t = setInterval(() => {
        const node = document.querySelector(selector);
        if (node) { clearInterval(t); resolve(node); return; }
        if (performance.now() - start > timeoutMs) {
          clearInterval(t);
          reject(new Error(`Timeout waiting for ${selector}`));
        }
      }, 50);
    });
  }

  function onGameReady(fn) {
    // Sandboxels exposes runAfterLoad() + runAfterLoadList. :contentReference[oaicite:3]{index=3}
    if (typeof window.runAfterLoad === "function") window.runAfterLoad(fn);
    else if (Array.isArray(window.runAfterLoadList)) window.runAfterLoadList.push(fn);
    else window.addEventListener("load", fn, { once: true });
  }

  // ---------- UI: reskin + search + favorites + quick speed + tooltip ----------

  function uiCss() {
    return `
/* ===== Sandboxels Overhaul UI Skin ===== */
:root{
  --sbx-bg: #0f1115;
  --sbx-panel: rgba(20,24,32,.92);
  --sbx-panel2: rgba(16,18,24,.92);
  --sbx-border: rgba(255,255,255,.10);
  --sbx-text: rgba(255,255,255,.92);
  --sbx-muted: rgba(255,255,255,.65);
  --sbx-accent: #4cc9f0;
  --sbx-accent2: #a78bfa;
  --sbx-radius: 14px;
  --sbx-shadow: 0 10px 30px rgba(0,0,0,.45);
}

#controls{
  gap: 10px;
}

#toolControls{
  display:flex;
  gap: 6px !important;
  flex-wrap: wrap;
}

.controlButton{
  border-radius: 999px !important;
  border: 1px solid var(--sbx-border) !important;
  background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.03)) !important;
  color: var(--sbx-text) !important;
  padding: 8px 12px !important;
  box-shadow: 0 6px 14px rgba(0,0,0,.25);
  transition: transform .06s ease, filter .12s ease;
}
.controlButton:hover{ filter: brightness(1.12); }
.controlButton:active{ transform: translateY(1px); }

.menuScreen, #modManager, #infoScreen, #settingsMenu{
  border-radius: var(--sbx-radius) !important;
  border: 1px solid var(--sbx-border) !important;
  box-shadow: var(--sbx-shadow) !important;
  background: var(--sbx-panel) !important;
  color: var(--sbx-text) !important;
}

.menuText, .menuTitle{
  color: var(--sbx-text) !important;
}

.menuTab{
  border-radius: 999px !important;
  border: 1px solid var(--sbx-border) !important;
}
.menuTab.selected{
  outline: none !important;
  border-color: rgba(76,201,240,.65) !important;
}

#sbxOverhaulBar{
  display:flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  padding: 10px 12px;
  margin: 8px 0 0 0;
  border-radius: var(--sbx-radius);
  border: 1px solid var(--sbx-border);
  background: var(--sbx-panel2);
  box-shadow: var(--sbx-shadow);
}

#sbxOverhaulSearch{
  flex: 1 1 240px;
  min-width: 200px;
  padding: 10px 12px;
  border-radius: 999px;
  border: 1px solid var(--sbx-border);
  background: rgba(255,255,255,.05);
  color: var(--sbx-text);
  outline: none;
}
#sbxOverhaulSearch::placeholder{ color: var(--sbx-muted); }

#sbxOverhaulFavs{
  display:flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

.sbxFavBtn{
  border-radius: 999px;
  border: 1px solid var(--sbx-border);
  background: rgba(255,255,255,.06);
  color: var(--sbx-text);
  padding: 6px 10px;
  cursor: pointer;
  user-select: none;
}
.sbxFavBtn:hover{ filter: brightness(1.12); }

.sbxMiniLabel{
  font-size: 12px;
  color: var(--sbx-muted);
  user-select: none;
}

#sbxOverhaulSpeed{
  width: 92px;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid var(--sbx-border);
  background: rgba(255,255,255,.05);
  color: var(--sbx-text);
  outline: none;
}

#sbxOverhaulBtn{
  border-color: rgba(167,139,250,.55) !important;
}

#sbxOverhaulTooltip{
  position: fixed;
  z-index: 999999;
  pointer-events: none;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid var(--sbx-border);
  background: rgba(15,17,21,.92);
  color: var(--sbx-text);
  box-shadow: var(--sbx-shadow);
  font-size: 12px;
  max-width: 320px;
  display: none;
}
#sbxOverhaulTooltip b{ color: white; }
#sbxOverhaulTooltip .muted{ color: var(--sbx-muted); }
`;
  }

  function addOverhaulToolbarButton() {
    const toolControls = document.getElementById("toolControls");
    if (!toolControls || document.getElementById("sbxOverhaulBtn")) return;

    const btn = el("button", {
      id: "sbxOverhaulBtn",
      class: "controlButton",
      title: "Overhaul settings (favorites / search / tweaks)",
      onclick: () => toggleOverhaulPanel(),
    }, "Overhaul");

    toolControls.appendChild(btn);
  }

  function buildOverhaulPanel() {
    if (document.getElementById("sbxOverhaulPanel")) return;

    const settings = loadSettings();

    const panel = el("div", {
      id: "sbxOverhaulPanel",
      style: `
        position: fixed; z-index: 999998;
        right: 16px; top: 16px;
        width: 340px; max-width: calc(100vw - 32px);
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(20,24,32,.94);
        box-shadow: 0 18px 50px rgba(0,0,0,.55);
        color: rgba(255,255,255,.92);
        padding: 12px;
        display: none;
      `,
    });

    const header = el("div", { style: "display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;" },
      el("div", {},
        el("div", { style: "font-weight:700;" }, `${MOD.name}`),
        el("div", { style: "font-size:12px; opacity:.7;" }, `v${MOD.version}`)
      ),
      el("button", {
        class: "controlButton",
        style: "padding:6px 10px;",
        onclick: () => toggleOverhaulPanel(false),
      }, "Close")
    );

    function makeToggle(key, label, hint) {
      const id = `sbxOverhaulToggle-${key}`;
      const row = el("label", {
        for: id,
        style: "display:flex; align-items:flex-start; gap:10px; padding:8px 6px; border-radius:12px; cursor:pointer;"
      },
        el("input", {
          id,
          type: "checkbox",
          style: "margin-top:3px;",
          ...(settings[key] ? { checked: "checked" } : {}),
          onchange: (ev) => {
            const next = loadSettings();
            next[key] = !!ev.target.checked;
            saveSettings(next);
            // Reload makes sure patches apply cleanly
            log("Setting changed:", key, next[key], "(refresh to fully re-apply everything)");
          }
        }),
        el("div", {},
          el("div", { style: "font-weight:600;" }, label),
          el("div", { style: "font-size:12px; opacity:.75;" }, hint)
        )
      );
      row.addEventListener("mouseenter", () => row.style.background = "rgba(255,255,255,.04)");
      row.addEventListener("mouseleave", () => row.style.background = "transparent");
      return row;
    }

    const body = el("div", {},
      makeToggle("uiReskin", "UI Reskin", "Rounded modern buttons + menus"),
      makeToggle("searchBar", "Element Search Bar", "Filter element buttons instantly"),
      makeToggle("favoritesBar", "Favorites Bar", "Right-click elements to favorite them"),
      makeToggle("quickSpeed", "Quick Speed", "Inline TPS control near your search"),
      makeToggle("tooltip", "Hover Tooltips", "Quick element stats on hover"),
      el("div", { style: "height:1px; background: rgba(255,255,255,.10); margin: 10px 0;" }),
      makeToggle("smartHumans", "Smart Humans", "Humans try to step away from danger"),
      makeToggle("trappedSkipForCommonFluids", "Fluid Lag Saver", "Skips ticks for trapped fluid pixels"),
      el("div", { style: "font-size:12px; opacity:.75; margin-top: 10px;" },
        "Tip: after changing toggles, refresh for a clean apply."
      )
    );

    panel.append(header, body);
    document.body.appendChild(panel);
  }

  function toggleOverhaulPanel(force) {
    const panel = document.getElementById("sbxOverhaulPanel");
    if (!panel) return;
    const show = (typeof force === "boolean") ? force : (panel.style.display === "none");
    panel.style.display = show ? "block" : "none";
  }

  function installSearchFavoritesSpeedBar() {
    const settings = loadSettings();
    if (!settings.searchBar && !settings.favoritesBar && !settings.quickSpeed) return;

    const controls = document.getElementById("controls");
    const categoryControls = document.getElementById("categoryControls");
    const elementControls = document.getElementById("elementControls");
    if (!controls || !categoryControls || !elementControls) return;

    if (document.getElementById("sbxOverhaulBar")) return;

    const bar = el("div", { id: "sbxOverhaulBar" });

    let searchInput = null;
    if (settings.searchBar) {
      searchInput = el("input", {
        id: "sbxOverhaulSearch",
        type: "text",
        placeholder: "Search elements… (Ctrl+K)",
        oninput: () => filterElements(searchInput.value),
      });
      bar.appendChild(searchInput);
    }

    if (settings.quickSpeed) {
      const speedWrap = el("div", { style: "display:flex; align-items:center; gap:8px;" },
        el("span", { class: "sbxMiniLabel" }, "TPS"),
        el("input", {
          id: "sbxOverhaulSpeed",
          type: "number",
          min: "1",
          max: "1000",
          placeholder: "30",
          onkeydown: (ev) => {
            if (ev.key === "Enter") ev.target.blur();
          },
          onchange: (ev) => {
            const n = Math.max(1, Math.min(1000, Math.abs(parseInt(ev.target.value || "30", 10))));
            if (typeof window.setTPS === "function") {
              window.setTPS(n);
              // Keep Sandboxels setting in sync if setSetting exists
              if (typeof window.setSetting === "function" && typeof window.tps !== "undefined") {
                window.setSetting("tps", window.tps);
              }
            }
          }
        })
      );
      bar.appendChild(speedWrap);
    }

    if (settings.favoritesBar) {
      const favWrap = el("div", { style: "display:flex; flex-direction:column; gap:6px; width: 100%;" },
        el("div", { class: "sbxMiniLabel" }, "Favorites (right-click element buttons to toggle)"),
        el("div", { id: "sbxOverhaulFavs" })
      );
      bar.appendChild(favWrap);
    }

    // Place bar above category controls
    controls.insertBefore(bar, categoryControls);

    if (settings.favoritesBar) {
      hookFavoriteRightClick();
      renderFavorites();
      markFavoriteButtons();
    }

    if (settings.searchBar) {
      // Ctrl+K focuses search
      window.addEventListener("keydown", (ev) => {
        if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") {
          ev.preventDefault();
          searchInput?.focus();
          searchInput?.select();
        }
        if (ev.key === "Escape" && document.activeElement === searchInput) {
          searchInput.value = "";
          filterElements("");
          searchInput.blur();
          window.focusGame?.();
        }
      });
    }
  }

  function allElementButtons() {
    // Sandboxels uses id="elementButton-<name>" and class "elementButton" in the UI
    return Array.from(document.querySelectorAll(".elementButton"))
      .filter(b => b.id && b.id.startsWith("elementButton-") && !b.classList.contains("close"));
  }

  function filterElements(query) {
    const q = (query || "").trim().toLowerCase();
    const buttons = allElementButtons();
    if (!q) {
      for (const b of buttons) b.style.display = "";
      return;
    }
    for (const b of buttons) {
      const name = (b.getAttribute("element") || b.id.replace("elementButton-", "") || "").toLowerCase();
      b.style.display = name.includes(q) ? "" : "none";
    }
  }

  function hookFavoriteRightClick() {
    const root = document.getElementById("elementControls") || document;
    if (root.__sbxOverhaulFavHooked) return;
    root.__sbxOverhaulFavHooked = true;

    root.addEventListener("contextmenu", (ev) => {
      const btn = ev.target?.closest?.(".elementButton");
      if (!btn || !btn.id?.startsWith("elementButton-")) return;
      ev.preventDefault();

      const elementName = btn.getAttribute("element") || btn.id.replace("elementButton-", "");
      toggleFavorite(elementName);
      markFavoriteButtons();
      renderFavorites();
    }, { capture: true });
  }

  function toggleFavorite(name) {
    if (!name) return;
    const favs = loadFavorites();
    const i = favs.indexOf(name);
    if (i >= 0) favs.splice(i, 1);
    else favs.unshift(name);
    saveFavorites(favs.slice(0, 24)); // cap
  }

  function markFavoriteButtons() {
    const favs = new Set(loadFavorites());
    for (const btn of allElementButtons()) {
      const name = btn.getAttribute("element") || btn.id.replace("elementButton-", "");
      btn.style.outline = favs.has(name) ? "2px solid rgba(76,201,240,.65)" : "";
      btn.style.outlineOffset = favs.has(name) ? "2px" : "";
    }
  }

  function elementSwatchColor(name) {
    const e = window.elements?.[name];
    if (!e) return null;
    const c = e.color;
    if (Array.isArray(c)) return c[0];
    if (typeof c === "string") return c;
    return null;
  }

  function renderFavorites() {
    const favDiv = document.getElementById("sbxOverhaulFavs");
    if (!favDiv) return;

    favDiv.innerHTML = "";
    const favs = loadFavorites().filter(n => window.elements?.[n]);

    if (favs.length === 0) {
      favDiv.appendChild(el("span", { class: "sbxMiniLabel" }, "No favorites yet."));
      return;
    }

    for (const name of favs) {
      const sw = elementSwatchColor(name);
      const btn = el("span", {
        class: "sbxFavBtn",
        style: sw ? `border-color: rgba(255,255,255,.18); background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.04));` : "",
        onclick: () => {
          if (typeof window.selectElement === "function") window.selectElement(name);
          window.focusGame?.();
        }
      }, name);

      if (sw) btn.style.boxShadow = `inset 0 0 0 2px ${sw}33`;
      favDiv.appendChild(btn);
    }
  }

  function installTooltip() {
    if (document.getElementById("sbxOverhaulTooltip")) return;

    const tip = el("div", { id: "sbxOverhaulTooltip" });
    document.body.appendChild(tip);

    function showTip(x, y, html) {
      tip.innerHTML = html;
      tip.style.left = `${Math.min(window.innerWidth - 20, x + 14)}px`;
      tip.style.top = `${Math.min(window.innerHeight - 20, y + 14)}px`;
      tip.style.display = "block";
    }
    function hideTip() {
      tip.style.display = "none";
    }

    document.addEventListener("mousemove", (ev) => {
      if (tip.style.display !== "none") {
        tip.style.left = `${Math.min(window.innerWidth - 20, ev.clientX + 14)}px`;
        tip.style.top = `${Math.min(window.innerHeight - 20, ev.clientY + 14)}px`;
      }
    });

    document.addEventListener("mouseover", (ev) => {
      const btn = ev.target?.closest?.(".elementButton");
      if (!btn || !btn.id?.startsWith("elementButton-")) return;

      const name = btn.getAttribute("element") || btn.id.replace("elementButton-", "");
      const e = window.elements?.[name];
      if (!e) return;

      const state = e.state ?? "unknown";
      const cat = e.category ?? "unknown";
      const dens = (typeof e.density === "number") ? e.density : "—";
      const visc = (typeof e.viscosity === "number") ? e.viscosity : "—";

      showTip(ev.clientX, ev.clientY,
        `<b>${name}</b><br>
         <span class="muted">Category:</span> ${cat}<br>
         <span class="muted">State:</span> ${state}<br>
         <span class="muted">Density:</span> ${dens}<br>
         <span class="muted">Viscosity:</span> ${visc}`
      );
    }, { capture: true });

    document.addEventListener("mouseout", (ev) => {
      const btn = ev.target?.closest?.(".elementButton");
      if (!btn) return;
      hideTip();
    }, { capture: true });
  }

  // ---------- Gameplay/behavior tweaks ----------

  function patchSmartHumans() {
    const elements = window.elements;
    if (!elements?.human) return;

    // Avoid double-patching
    if (elements.human.__sbxOverhaulSmart) return;
    elements.human.__sbxOverhaulSmart = true;

    const oldTick = elements.human.tick;
    if (typeof oldTick !== "function") return;

    // Tune this list however you want
    const danger = new Set([
      "fire", "smoke", "lava", "magma", "acid", "acid_gas", "explosion",
      "radiation", "plasma", "greek_fire", "napalm", "nuke"
    ]);

    const adj = window.adjacentCoords; // usually 8 directions
    const pixelMap = () => window.pixelMap;
    const isEmpty = window.isEmpty;
    const tryMove = window.tryMove;

    elements.human.tick = function (pixel) {
      try {
        if (adj && isEmpty && tryMove && pixelMap()) {
          let dxSum = 0, dySum = 0, found = 0;

          for (let i = 0; i < adj.length; i++) {
            const nx = pixel.x + adj[i][0];
            const ny = pixel.y + adj[i][1];
            if (!isEmpty(nx, ny, true)) {
              const p = pixelMap()[nx]?.[ny];
              const elName = p?.element;
              if (elName && danger.has(elName)) {
                dxSum += adj[i][0];
                dySum += adj[i][1];
                found++;
              }
            }
          }

          if (found > 0) {
            // Step away from average danger direction
            const ax = dxSum === 0 ? 0 : (dxSum > 0 ? -1 : 1);
            const ay = dySum === 0 ? 0 : (dySum > 0 ? -1 : 1);

            // Try a few escape attempts
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
        }
      } catch { /* keep vanilla behavior if anything fails */ }

      return oldTick(pixel);
    };

    log("Patched: smart humans");
  }

  function patchTrappedSkipForCommonFluids() {
    const elements = window.elements;
    if (!elements) return;

    const pixelMap = () => window.pixelMap;
    const adj = window.adjacentCoords;
    const currentSaveData = () => window.currentSaveData;
    const pixelTicks = () => window.pixelTicks;

    // Only patch elements that exist & have a tick
    const targets = ["water", "steam", "smoke", "cloud", "salt_water", "dirty_water"];
    for (const name of targets) {
      const e = elements[name];
      if (!e || typeof e.tick !== "function" || e.__sbxOverhaulTrapped) continue;
      e.__sbxOverhaulTrapped = true;

      const oldTick = e.tick;

      e.tick = function (pixel) {
        try {
          // If already optimized this tick, skip
          if (typeof pixel.opti !== "undefined" && pixel.opti === pixelTicks()) return;

          // Randomize so we don't do neighbor checks every time
          if (Math.random() < 0.35 && adj && pixelMap() && currentSaveData()) {
            let trapped = true;
            for (let i = 0; i < adj.length; i++) {
              const nx = pixel.x + adj[i][0];
              const ny = pixel.y + adj[i][1];

              const border = currentSaveData().border ?? 0;
              if (nx < border || ny < border || nx > window.width - border || ny > window.height - border) continue;

              const p = pixelMap()[nx]?.[ny];
              if (!p || p.element !== pixel.element) { trapped = false; break; }
            }
            if (trapped) {
              pixel.opti = pixelTicks();
              return;
            }
          }
        } catch { /* ignore */ }

        return oldTick(pixel);
      };
    }

    log("Patched: trapped fluid tick skipping");
  }

  // ---------- Boot ----------

  onGameReady(async () => {
    const settings = loadSettings();

    try {
      if (settings.uiReskin) injectCss(uiCss());

      // Wait for toolbar to exist
      await waitForSelector("#toolControls", 15000);

      addOverhaulToolbarButton();
      buildOverhaulPanel();

      // Wait until element buttons are likely created
      await waitForSelector("#elementControls", 15000);
      installSearchFavoritesSpeedBar();

      if (settings.tooltip) installTooltip();

      // Behavior/perf patches
      if (settings.smartHumans) patchSmartHumans();
      if (settings.trappedSkipForCommonFluids) patchTrappedSkipForCommonFluids();

      // Keep favorites outline up-to-date
      setInterval(() => {
        const s = loadSettings();
        if (s.favoritesBar) markFavoriteButtons();
      }, 1500);

      log("Loaded with settings:", settings);
    } catch (err) {
      console.warn(`[${MOD.name}] failed to init`, err);
    }
  });

})();
