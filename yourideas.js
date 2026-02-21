(() => {
  "use strict";

  if (typeof elements !== "object" || typeof behaviors !== "object") return;
  if (elements.__pressureSystemMod_v1) return;
  elements.__pressureSystemMod_v1 = true;

  const IDS = Object.freeze({
    PRESSURIZED_WATER: "pressurized_water",
    PRESSURIZER: "pressurizer",
    PRESSURE_DEBRIS: "pressure_debris",
    PRESSURIZE_TOOL: "pressurize",
    DEPRESSURIZE_TOOL: "depressurize",
  });

  const CFG = Object.freeze({
    MAX_P: 320,
    MIN_PUSH_P: 6,
    AUTO_CONVERT_P: 14,
    AUTO_REVERT_P: 2,
    BUILD_P_BASE: 0.35,
    BUILD_P_STEAM: 0.55,
    SEAL_BONUS_3: 0.55,
    SEAL_BONUS_4: 1.25,
    DISSIPATE_OPEN: 0.85,
    RUPTURE_P: 60,
    RUPTURE_LOSS: 18,
    RUPTURE_RADIUS: 1,
    PRESSURIZER_ADD: 6,
    TOOL_ADD: 30,
    TOOL_SUB: 40,
    TOOL_SPREAD: 1,
  });

  const DIR4 = Object.freeze([
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]);

  const DIR8 = Object.freeze([
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ]);

  const hasFn = (name) => typeof globalThis[name] === "function";
  const clamp = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n);
  const randi = (n) => (n <= 0 ? 0 : (Math.random() * n) | 0);

  const inBounds = (x, y) => {
    if (typeof width === "number" && typeof height === "number") {
      return x >= 0 && x < width && y >= 0 && y < height;
    }
    if (!globalThis.pixelMap) return false;
    return x >= 0 && x < pixelMap.length && y >= 0 && y < pixelMap[x].length;
  };

  const getPixel = (x, y) => {
    if (!inBounds(x, y) || !globalThis.pixelMap) return null;
    return pixelMap[x][y] || null;
  };

  const isEmptyAt = (x, y, ignoreBounds = false) => {
    if (!ignoreBounds && !inBounds(x, y)) return false;
    if (hasFn("isEmpty")) return isEmpty(x, y, ignoreBounds);
    return !getPixel(x, y);
  };

  const delPixel = (x, y) => {
    if (hasFn("deletePixel")) deletePixel(x, y);
    else {
      const p = getPixel(x, y);
      if (p) pixelMap[x][y] = null;
    }
  };

  const chPixel = (pixel, elem) => {
    if (!pixel) return;
    if (pixel.element === elem) return;
    if (hasFn("changePixel")) changePixel(pixel, elem);
    else pixel.element = elem;
  };

  const tryStep = (pixel, x, y) => (hasFn("tryMove") ? tryMove(pixel, x, y) : false);
  const swap = (a, b) => (hasFn("swapPixels") ? swapPixels(a, b) : false);

  const elemDef = (name) => (name && elements[name]) || null;
  const stateOf = (pixel) => {
    const d = elemDef(pixel?.element);
    return d?.state || null;
  };

  const getHardness = (pixel) => {
    const d = elemDef(pixel?.element);
    const h = d?.hardness;
    return typeof h === "number" ? h : null;
  };

  const isUnbreakable = (pixel) => {
    const d = elemDef(pixel?.element);
    return !!(d?.unbreakable || d?.noMix || d?.isTool || d?.category === "tools");
  };

  const isWeakWall = (pixel) => {
    if (!pixel || isUnbreakable(pixel)) return false;
    const d = elemDef(pixel.element);
    if (!d) return false;
    if (pixel.element === IDS.PRESSURIZER) return false;

    const st = d.state;
    if (st !== "solid") return false;

    const h = getHardness(pixel);
    if (typeof h === "number" && h < 0.55) return true;

    if (d.breakInto || d.breakIntoColor) return true;

    const den = d.density;
    if (typeof den === "number" && den < 1400) return true;

    const cat = d.category;
    if (cat === "powders" || cat === "food" || cat === "life" || cat === "misc") return true;

    return false;
  };

  const ensurePressure = (pixel) => {
    if (!pixel) return 0;
    if (typeof pixel.pr !== "number" || !Number.isFinite(pixel.pr)) pixel.pr = 0;
    return pixel.pr;
  };

  const addPressure = (pixel, amt) => {
    if (!pixel || !Number.isFinite(amt) || amt === 0) return;
    ensurePressure(pixel);
    pixel.pr = clamp(pixel.pr + amt, 0, CFG.MAX_P);

    if (pixel.element === "water" && pixel.pr >= CFG.AUTO_CONVERT_P) chPixel(pixel, IDS.PRESSURIZED_WATER);
  };

  const setPressure = (pixel, val) => {
    if (!pixel || !Number.isFinite(val)) return;
    pixel.pr = clamp(val, 0, CFG.MAX_P);
  };

  const sealScore4 = (x, y) => {
    let s = 0;
    for (let i = 0; i < 4; i += 1) {
      const dx = DIR4[i][0];
      const dy = DIR4[i][1];
      if (!isEmptyAt(x + dx, y + dy, false)) s += 1;
    }
    return s;
  };

  const localFluidCount = (x, y) => {
    let c = 0;
    for (let i = 0; i < 8; i += 1) {
      const dx = DIR8[i][0];
      const dy = DIR8[i][1];
      const p = getPixel(x + dx, y + dy);
      if (!p) continue;
      const st = stateOf(p);
      if (st === "liquid" || st === "gas") c += 1;
      else if (p.element === IDS.PRESSURIZED_WATER) c += 1;
    }
    return c;
  };

  const ruptureAround = (pixel) => {
    const pr = ensurePressure(pixel);
    if (pr < CFG.RUPTURE_P) return false;

    const x = pixel.x;
    const y = pixel.y;

    const choices = [];
    for (let i = 0; i < 4; i += 1) {
      const dx = DIR4[i][0];
      const dy = DIR4[i][1];
      const nx = x + dx;
      const ny = y + dy;
      const n = getPixel(nx, ny);
      if (!n) continue;
      if (!isWeakWall(n)) continue;
      choices.push([nx, ny, dx, dy]);
    }

    if (!choices.length) return false;

    const pick = choices[randi(choices.length)];
    const wx = pick[0];
    const wy = pick[1];

    const wallPix = getPixel(wx, wy);
    if (wallPix && isWeakWall(wallPix)) {
      const wDef = elemDef(wallPix.element);
      const into = typeof wDef?.breakInto === "string" ? wDef.breakInto : IDS.PRESSURE_DEBRIS;
      if (Math.random() < 0.55) chPixel(wallPix, into);
      else delPixel(wx, wy);
    }

    pixel.pr = clamp(pixel.pr - CFG.RUPTURE_LOSS, 0, CFG.MAX_P);

    for (let i = 0; i < 6; i += 1) {
      const dx = (Math.random() * 3 - 1) | 0;
      const dy = (Math.random() * 3 - 1) | 0;
      const tx = wx + dx;
      const ty = wy + dy;
      if (!inBounds(tx, ty) || !isEmptyAt(tx, ty, false) || !hasFn("createPixel")) continue;
      if (Math.random() < 0.35) createPixel(IDS.PRESSURE_DEBRIS, tx, ty);
    }

    return true;
  };

  const pressurePush = (pixel) => {
    const pr = ensurePressure(pixel);
    if (pr < CFG.MIN_PUSH_P) return;

    const x = pixel.x;
    const y = pixel.y;

    let open = 0;
    for (let i = 0; i < 4; i += 1) {
      const dx = DIR4[i][0];
      const dy = DIR4[i][1];
      if (isEmptyAt(x + dx, y + dy, false)) open += 1;
    }

    if (open > 0) {
      pixel.pr = clamp(pixel.pr - CFG.DISSIPATE_OPEN * open, 0, CFG.MAX_P);

      const tries = clamp(((pr / 35) | 0) + 1, 1, 4);
      for (let t = 0; t < tries; t += 1) {
        const dir = DIR4[randi(4)];
        const nx = x + dir[0];
        const ny = y + dir[1];
        if (!isEmptyAt(nx, ny, false)) continue;
        if (tryStep(pixel, nx, ny)) {
          pixel.pr = clamp(pixel.pr - 1.5, 0, CFG.MAX_P);
          break;
        }
      }
    } else {
      pixel.pr = clamp(pixel.pr + 0.25, 0, CFG.MAX_P);
    }
  };

  const buildPressureFromCrowding = (pixel, base, extra) => {
    const s = sealScore4(pixel.x, pixel.y);
    if (s < 3) return;

    const fluids = localFluidCount(pixel.x, pixel.y);
    if (fluids < 5) return;

    ensurePressure(pixel);
    let add = base + extra * (fluids - 4);

    if (s === 3) add += CFG.SEAL_BONUS_3;
    if (s === 4) add += CFG.SEAL_BONUS_4;

    pixel.pr = clamp(pixel.pr + add, 0, CFG.MAX_P);
  };

  const waterPressureTick = (pixel) => {
    ensurePressure(pixel);

    if (pixel.pr > 0) {
      if (pixel.pr >= CFG.AUTO_CONVERT_P) chPixel(pixel, IDS.PRESSURIZED_WATER);
      return;
    }

    buildPressureFromCrowding(pixel, CFG.BUILD_P_BASE, 0.14);

    if (pixel.pr >= CFG.AUTO_CONVERT_P) chPixel(pixel, IDS.PRESSURIZED_WATER);
  };

  const steamPressureTick = (pixel) => {
    ensurePressure(pixel);

    buildPressureFromCrowding(pixel, CFG.BUILD_P_STEAM, 0.18);

    if (pixel.pr >= CFG.RUPTURE_P) ruptureAround(pixel);
    if (pixel.pr > 0) pressurePush(pixel);
  };

  const pressurizedWaterTick = (pixel) => {
    ensurePressure(pixel);

    buildPressureFromCrowding(pixel, CFG.BUILD_P_BASE, 0.18);

    if (pixel.pr >= CFG.RUPTURE_P) ruptureAround(pixel);
    if (pixel.pr > 0) pressurePush(pixel);

    if (pixel.pr <= CFG.AUTO_REVERT_P && sealScore4(pixel.x, pixel.y) <= 1) {
      chPixel(pixel, "water");
      return;
    }

    if (hasFn("doDefaults")) doDefaults(pixel);
  };

  const wrapTick = (elementName, wrapper) => {
    const d = elemDef(elementName);
    if (!d) return;
    if (d.__pressureWrapped) return;
    d.__pressureWrapped = true;

    const orig = typeof d.tick === "function" ? d.tick : null;
    d.tick = function (pixel) {
      wrapper(pixel);
      if (orig) orig(pixel);
    };
  };

  const keys = (() => {
    const st = Object.create(null);
    const set = (down) => (e) => {
      st[e.code] = down;
    };
    const clear = () => {
      for (const k in st) delete st[k];
    };

    if (typeof document !== "undefined" && document?.addEventListener) {
      document.addEventListener("keydown", set(true));
      document.addEventListener("keyup", set(false));
    }
    if (typeof window !== "undefined" && window?.addEventListener) window.addEventListener("blur", clear);

    return {
      down(code) {
        return !!st[code];
      },
    };
  })();

  const modState = (() => {
    const s = Object.create(null);
    s.pickArmed = false;
    s.pickElement = null;
    return s;
  })();

  const shiftHeld = () => !!globalThis.shiftDown || keys.down("ShiftLeft") || keys.down("ShiftRight");
  const ctrlHeld = () =>
    !!globalThis.ctrlDown || keys.down("ControlLeft") || keys.down("ControlRight") || keys.down("MetaLeft") || keys.down("MetaRight");

  const pressurizerInit = (pixel) => {
    if (pixel.__psInit) return;
    pixel.__psInit = true;

    if (modState.pickArmed && modState.pickElement) pixel.target = modState.pickElement;
    else pixel.target = null;

    pixel.strength = CFG.PRESSURIZER_ADD;
  };

  const pressurizerPickIfNeeded = (pixel) => {
    if (!modState.pickArmed || modState.pickElement) return;
    for (let i = 0; i < 8; i += 1) {
      const dx = DIR8[i][0];
      const dy = DIR8[i][1];
      const n = getPixel(pixel.x + dx, pixel.y + dy);
      if (!n) continue;
      if (n.element === IDS.PRESSURIZER) continue;
      modState.pickElement = n.element;
      pixel.target = modState.pickElement;
      break;
    }
  };

  const pressurizerTick = (pixel) => {
    pressurizerInit(pixel);
    pressurizerPickIfNeeded(pixel);

    const str = typeof pixel.strength === "number" ? pixel.strength : CFG.PRESSURIZER_ADD;
    const target = typeof pixel.target === "string" ? pixel.target : null;

    for (let i = 0; i < 8; i += 1) {
      const dx = DIR8[i][0];
      const dy = DIR8[i][1];
      const n = getPixel(pixel.x + dx, pixel.y + dy);
      if (!n) continue;

      if (target && n.element !== target) continue;

      const st = stateOf(n);
      if (st !== "liquid" && st !== "gas" && n.element !== "water" && n.element !== IDS.PRESSURIZED_WATER) continue;

      addPressure(n, str);

      if (n.element === "water" && n.pr >= CFG.AUTO_CONVERT_P) chPixel(n, IDS.PRESSURIZED_WATER);
    }

    if (hasFn("doDefaults")) doDefaults(pixel);
  };

  const toolApplyToPixel = (pixel, amt, spread = 0) => {
    if (!pixel) return;
    addPressure(pixel, amt);
    if (pixel.element === "water" && pixel.pr >= CFG.AUTO_CONVERT_P) chPixel(pixel, IDS.PRESSURIZED_WATER);

    if (spread <= 0) return;
    for (let i = 0; i < 4; i += 1) {
      const dx = DIR4[i][0];
      const dy = DIR4[i][1];
      const n = getPixel(pixel.x + dx, pixel.y + dy);
      if (!n) continue;
      const st = stateOf(n);
      if (st !== "liquid" && st !== "gas" && n.element !== "water" && n.element !== IDS.PRESSURIZED_WATER) continue;
      addPressure(n, amt * 0.35);
      if (n.element === "water" && n.pr >= CFG.AUTO_CONVERT_P) chPixel(n, IDS.PRESSURIZED_WATER);
    }
  };

  const toolShim = (amt, spread) => {
    return function (a, b) {
      if (a && typeof a === "object" && typeof a.x === "number" && typeof a.y === "number") {
        toolApplyToPixel(a, amt, spread);
        return;
      }
      const x = a | 0;
      const y = b | 0;
      const p = getPixel(x, y);
      if (!p) return;
      toolApplyToPixel(p, amt, spread);
    };
  };

  const toolPressurizeOnSelect = () => {
    if (shiftHeld() || ctrlHeld()) {
      modState.pickArmed = true;
      modState.pickElement = null;
    } else {
      modState.pickArmed = false;
      modState.pickElement = null;
    }
  };

  const waterLikeBehavior = (() => {
    const w = elements.water;
    if (w && w.behavior) return w.behavior;
    if (behaviors.LIQUID) return behaviors.LIQUID;
    return behaviors.POWDER;
  })();

  elements[IDS.PRESSURE_DEBRIS] = {
    color: ["#b6b7bf", "#8f9098", "#6a6b73"],
    behavior: behaviors.POWDER,
    category: "powders",
    state: "solid",
    density: 1100,
    hardness: 0.15,
    breakInto: "dust",
  };

  elements[IDS.PRESSURIZED_WATER] = {
    color: ["#2aa8ff", "#1e7bff", "#39d1ff"],
    behavior: waterLikeBehavior,
    category: "liquids",
    state: "liquid",
    density: elements.water?.density ?? 1000,
    viscosity: (elements.water?.viscosity ?? 1) * 1.25,
    tick: pressurizedWaterTick,
  };

  elements[IDS.PRESSURIZER] = {
    color: ["#2cffcf", "#00ffa2", "#00c8ff"],
    behavior: behaviors.WALL,
    category: "machines",
    state: "solid",
    density: 3200,
    hardness: 0.85,
    insulate: true,
    tick: pressurizerTick,
    onSelect: toolPressurizeOnSelect,
    onShiftSelect: toolPressurizeOnSelect,
  };

  elements[IDS.PRESSURIZE_TOOL] = {
    color: ["#2cffcf", "#00ffa2", "#00c8ff"],
    category: "tools",
    onSelect: toolPressurizeOnSelect,
    onShiftSelect: toolPressurizeOnSelect,
    tool: toolShim(CFG.TOOL_ADD, CFG.TOOL_SPREAD),
  };

  elements[IDS.DEPRESSURIZE_TOOL] = {
    color: ["#ffd6ff", "#ff9ee0", "#ff7ab3"],
    category: "tools",
    tool: toolShim(-CFG.TOOL_SUB, 0),
  };

  wrapTick("water", waterPressureTick);
  wrapTick("steam", steamPressureTick);

  const afterLoad = hasFn("runAfterLoad") ? runAfterLoad : (fn) => fn();
  afterLoad(() => {
    const w = elements.water;
    if (w && typeof w.tick !== "function") w.tick = waterPressureTick;

    const s = elements.steam;
    if (s && typeof s.tick !== "function") s.tick = steamPressureTick;
  });
})();
