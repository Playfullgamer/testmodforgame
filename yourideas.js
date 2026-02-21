(() => {
  "use strict";

  const G = globalThis;
  if (G.__sandboxels_pressure_system_v2) return;
  if (typeof elements !== "object" || typeof behaviors !== "object") return;
  G.__sandboxels_pressure_system_v2 = true;

  const ID = Object.freeze({
    PRESSURIZED_WATER: "pressurized_water",
    PRESSURIZER: "pressurizer",
    PRESSURE_PLATE: "pressure_plate",
    PRESSURE_DEBRIS: "pressure_debris",
    TOOL_PRESSURIZE: "pressurize",
    TOOL_DEPRESSURIZE: "depressurize",
  });

  const CFG = Object.freeze({
    MAX_P: 360,
    CONVERT_P: 18,
    REVERT_P: 2,
    PUSH_P: 8,
    RUPTURE_P: 70,
    RUPTURE_LOSS: 28,
    BUILD_WATER: 0.45,
    BUILD_STEAM: 0.8,
    DISSIPATE_OPEN: 0.9,
    EQUALIZE_RATE: 0.12,
    EQUALIZE_MIN_DIFF: 4,
    PRESSURIZER_ADD: 7,
    TOOL_ADD: 40,
    TOOL_SUB: 60,
    TOOL_SPREAD: 1,
    SAMPLE_MOD: 4,
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

  const isFn = (k) => typeof G[k] === "function";
  const clamp = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n);

  const hasDims = () => Number.isFinite(G.width) && Number.isFinite(G.height);
  const inBounds = (x, y) => {
    if (hasDims()) return x >= 0 && x < G.width && y >= 0 && y < G.height;
    const pm = G.pixelMap;
    if (!pm || !pm[x]) return false;
    return y >= 0 && y < pm[x].length;
  };

  const getPx = (x, y) => {
    if (!inBounds(x, y)) return null;
    if (isFn("getPixel")) return G.getPixel(x, y);
    const pm = G.pixelMap;
    return pm?.[x]?.[y] || null;
  };

  const isEmptyAt = (x, y, ignoreBounds = false) => {
    if (!ignoreBounds && !inBounds(x, y)) return false;
    if (isFn("isEmpty")) return G.isEmpty(x, y, ignoreBounds);
    return !getPx(x, y);
  };

  const tryMoveTo = (p, x, y) => (isFn("tryMove") ? G.tryMove(p, x, y) : false);

  const createAt = (elem, x, y, replace = false) => {
    if (!inBounds(x, y)) return null;
    if (isFn("tryCreate")) return G.tryCreate(elem, x, y, replace) || null;
    if (isFn("createPixel")) {
      if (!replace && !isEmptyAt(x, y, false)) return null;
      G.createPixel(elem, x, y);
      return getPx(x, y);
    }
    return null;
  };

  const deleteAt = (x, y) => {
    if (!inBounds(x, y)) return null;
    if (isFn("tryDelete")) return G.tryDelete(x, y) || null;
    if (isFn("deletePixel")) return G.deletePixel(x, y) || null;
    const p = getPx(x, y);
    if (p && G.pixelMap?.[x]) G.pixelMap[x][y] = null;
    return p || null;
  };

  const changeTo = (p, elem) => {
    if (!p || p.element === elem) return;
    if (isFn("changePixel")) G.changePixel(p, elem);
    else p.element = elem;
  };

  const defOf = (name) => (name && elements[name]) || null;
  const stateOf = (p) => defOf(p?.element)?.state || null;

  const prOf = (p) => (p && Number.isFinite(p.pr) ? p.pr : 0);
  const setPr = (p, v) => {
    if (!p) return;
    const nv = clamp(v, 0, CFG.MAX_P);
    if (nv <= 0) {
      if ("pr" in p) delete p.pr;
      return;
    }
    p.pr = nv;
  };

  const addPr = (p, dv) => {
    if (!p || !Number.isFinite(dv) || dv === 0) return;
    const nv = prOf(p) + dv;
    setPr(p, nv);
  };

  const isFluidish = (p) => {
    if (!p) return false;
    const st = stateOf(p);
    return st === "liquid" || st === "gas" || p.element === ID.PRESSURIZED_WATER;
  };

  const seal4 = (x, y) => {
    let s = 0;
    for (let i = 0; i < 4; i += 1) {
      const nx = x + DIR4[i][0];
      const ny = y + DIR4[i][1];
      if (!inBounds(nx, ny)) {
        s += 1;
        continue;
      }
      if (!isEmptyAt(nx, ny, false)) s += 1;
    }
    return s;
  };

  const crowd8 = (x, y) => {
    let c = 0;
    for (let i = 0; i < 8; i += 1) {
      const nx = x + DIR8[i][0];
      const ny = y + DIR8[i][1];
      const n = getPx(nx, ny);
      if (!n) continue;
      if (isFluidish(n)) c += 1;
    }
    return c;
  };

  const isUnbreakable = (p) => {
    const d = defOf(p?.element);
    return !!(d?.unbreakable || d?.noMix || d?.category === "tools");
  };

  const isWeakSolid = (p) => {
    if (!p || isUnbreakable(p)) return false;
    const d = defOf(p.element);
    if (!d || d.state !== "solid") return false;

    const h = d.hardness;
    if (typeof h === "number" && h < 0.6) return true;

    const den = d.density;
    if (typeof den === "number" && den < 1500) return true;

    if (d.breakInto) return true;
    return false;
  };

  const breakSolid = (p) => {
    if (!p || !isWeakSolid(p)) return false;
    const d = defOf(p.element);
    const into = typeof d?.breakInto === "string" ? d.breakInto : ID.PRESSURE_DEBRIS;
    if (Math.random() < 0.55) changeTo(p, into);
    else deleteAt(p.x, p.y);
    return true;
  };

  const sampleGate = (p) => {
    const t = Number.isFinite(G.pixelTicks) ? G.pixelTicks : null;
    if (t === null) return true;
    return ((t + p.x + p.y) & (CFG.SAMPLE_MOD - 1)) === 0;
  };

  const equalize = (p) => {
    let pr = prOf(p);
    if (pr <= 0) return;

    for (let i = 0; i < 4; i += 1) {
      const nx = p.x + DIR4[i][0];
      const ny = p.y + DIR4[i][1];
      const n = getPx(nx, ny);
      if (!n || !isFluidish(n)) continue;

      const npr = prOf(n);
      const diff = pr - npr;
      if (diff <= CFG.EQUALIZE_MIN_DIFF) continue;

      const flow = diff * CFG.EQUALIZE_RATE;
      pr -= flow;
      setPr(n, npr + flow);
      if (pr <= 0) break;
    }

    setPr(p, pr);
  };

  const pushOut = (p) => {
    const pr = prOf(p);
    if (pr < CFG.PUSH_P) return;

    const tries = clamp(((pr / 28) | 0) + 1, 1, 4);
    for (let t = 0; t < tries; t += 1) {
      const dir = DIR4[(Math.random() * 4) | 0];
      const nx = p.x + dir[0];
      const ny = p.y + dir[1];
      if (!inBounds(nx, ny) || !isEmptyAt(nx, ny, false)) continue;
      if (tryMoveTo(p, nx, ny)) {
        setPr(p, prOf(p) - 1.4);
        break;
      }
    }
  };

  const rupture = (p) => {
    const pr = prOf(p);
    if (pr < CFG.RUPTURE_P) return false;

    const sealed = seal4(p.x, p.y);
    if (sealed < 3) return false;

    const weak = [];
    for (let i = 0; i < 4; i += 1) {
      const nx = p.x + DIR4[i][0];
      const ny = p.y + DIR4[i][1];
      const n = getPx(nx, ny);
      if (n && isWeakSolid(n)) weak.push(n);
    }
    if (!weak.length) return false;

    const target = weak[(Math.random() * weak.length) | 0];
    if (!breakSolid(target)) return false;

    setPr(p, pr - CFG.RUPTURE_LOSS);

    for (let i = 0; i < 7; i += 1) {
      const dx = ((Math.random() * 3) | 0) - 1;
      const dy = ((Math.random() * 3) | 0) - 1;
      const sx = target.x + dx;
      const sy = target.y + dy;
      if (!inBounds(sx, sy) || !isEmptyAt(sx, sy, false)) continue;
      if (Math.random() < 0.35) createAt(ID.PRESSURE_DEBRIS, sx, sy, false);
    }

    return true;
  };

  const pressureCore = (p, kind) => {
    const cur = prOf(p);
    const sealed = seal4(p.x, p.y);
    const open = 4 - sealed;

    if (cur <= 0 && sealed <= 1) return;
    if (cur <= 0 && !sampleGate(p)) return;

    const crowd = sealed >= 3 ? crowd8(p.x, p.y) : 0;

    let pr = cur;
    if (pr <= 0) {
      if (sealed >= 3 && crowd >= 5) pr = kind === "steam" ? 10 : 7;
      else return;
    }

    if (open > 0) {
      pr = pr - CFG.DISSIPATE_OPEN * open;
    } else {
      pr += kind === "steam" ? CFG.BUILD_STEAM : CFG.BUILD_WATER;
      if (crowd > 4) pr += (crowd - 4) * (kind === "steam" ? 0.22 : 0.14);
    }

    pr = clamp(pr, 0, CFG.MAX_P);
    setPr(p, pr);

    if (p.element === "water" && pr >= CFG.CONVERT_P) {
      changeTo(p, ID.PRESSURIZED_WATER);
      return;
    }

    if (p.element === ID.PRESSURIZED_WATER && pr <= CFG.REVERT_P) {
      changeTo(p, "water");
      setPr(p, 0);
      return;
    }

    if (prOf(p) >= CFG.RUPTURE_P) rupture(p);
    equalize(p);
    pushOut(p);
  };

  const wrapTick = (name, before) => {
    const d = defOf(name);
    if (!d || d.__psWrapped) return;
    d.__psWrapped = true;

    const orig = typeof d.tick === "function" ? d.tick : null;
    d.tick = function (p) {
      try {
        const cont = before(p);
        if (cont !== false && orig) orig(p);
      } catch (_e) {}
    };
  };

  const waterBefore = (p) => {
    if (!p) return;
    if (prOf(p) > 0) pressureCore(p, "water");
    else pressureCore(p, "water");
  };

  const steamBefore = (p) => {
    if (!p) return;
    pressureCore(p, "steam");
  };

  const pressurizedWaterTick = (p) => {
    try {
      pressureCore(p, "water");
      if (isFn("doDefaults")) G.doDefaults(p);
    } catch (_e) {}
  };

  const tryConvertForPressure = (p) => {
    if (!p) return;
    if (p.element === "water" && prOf(p) >= CFG.CONVERT_P) changeTo(p, ID.PRESSURIZED_WATER);
  };

  const toolApply = (p, dv, spread) => {
    if (!p || !isFluidish(p)) return;

    addPr(p, dv);
    tryConvertForPressure(p);

    if (p.element === ID.PRESSURIZED_WATER && prOf(p) <= CFG.REVERT_P) {
      changeTo(p, "water");
      setPr(p, 0);
    }

    if (spread <= 0) return;
    for (let i = 0; i < 4; i += 1) {
      const n = getPx(p.x + DIR4[i][0], p.y + DIR4[i][1]);
      if (!n || !isFluidish(n)) continue;
      addPr(n, dv * 0.35);
      tryConvertForPressure(n);
      if (n.element === ID.PRESSURIZED_WATER && prOf(n) <= CFG.REVERT_P) {
        changeTo(n, "water");
        setPr(n, 0);
      }
    }
  };

  const pressurizerInit = (p) => {
    if (p.__psInit) return;
    p.__psInit = true;
    p.target = null;
  };

  const pressurizerLockTarget = (p) => {
    if (typeof p.target === "string") return;
    for (let i = 0; i < 8; i += 1) {
      const n = getPx(p.x + DIR8[i][0], p.y + DIR8[i][1]);
      if (!n || n.element === ID.PRESSURIZER || n.element === ID.PRESSURE_PLATE) continue;
      if (!isFluidish(n)) continue;
      p.target = n.element;
      return;
    }
    p.target = null;
  };

  const pressurizerTick = (p) => {
    try {
      pressurizerInit(p);
      pressurizerLockTarget(p);

      const t = typeof p.target === "string" ? p.target : null;
      for (let i = 0; i < 8; i += 1) {
        const n = getPx(p.x + DIR8[i][0], p.y + DIR8[i][1]);
        if (!n || !isFluidish(n)) continue;
        if (t && n.element !== t) continue;
        addPr(n, CFG.PRESSURIZER_ADD);
        tryConvertForPressure(n);
      }

      if (isFn("doDefaults")) G.doDefaults(p);
    } catch (_e) {}
  };

  const waterBehavior = elements.water?.behavior || behaviors.LIQUID;

  elements[ID.PRESSURE_DEBRIS] = {
    color: ["#b9bbc3", "#8e9098", "#6b6d75"],
    behavior: behaviors.POWDER,
    category: "powders",
    state: "solid",
    density: 1100,
    hardness: 0.15,
  };

  elements[ID.PRESSURIZED_WATER] = {
    color: ["#2aa8ff", "#1e7bff", "#39d1ff"],
    behavior: waterBehavior,
    category: "liquids",
    state: "liquid",
    density: (elements.water?.density ?? 1000) + 80,
    viscosity: (elements.water?.viscosity ?? 1) * 1.35,
    tick: pressurizedWaterTick,
  };

  elements[ID.PRESSURIZER] = {
    color: ["#2cffcf", "#00ffa2", "#00c8ff"],
    behavior: behaviors.WALL,
    category: "machines",
    state: "solid",
    density: 3200,
    hardness: 0.9,
    insulate: true,
    tick: pressurizerTick,
  };

  elements[ID.PRESSURE_PLATE] = {
    color: ["#2cffcf", "#00ffa2", "#00c8ff"],
    behavior: behaviors.WALL,
    category: "machines",
    state: "solid",
    density: 3200,
    hardness: 0.9,
    insulate: true,
    tick: pressurizerTick,
  };

  elements[ID.TOOL_PRESSURIZE] = {
    color: ["#2cffcf", "#00ffa2", "#00c8ff"],
    category: "tools",
    tool: function (p) {
      toolApply(p, CFG.TOOL_ADD, CFG.TOOL_SPREAD);
    },
  };

  elements[ID.TOOL_DEPRESSURIZE] = {
    color: ["#ffd6ff", "#ff9ee0", "#ff7ab3"],
    category: "tools",
    tool: function (p) {
      toolApply(p, -CFG.TOOL_SUB, CFG.TOOL_SPREAD);
    },
  };

  wrapTick("water", waterBefore);
  wrapTick("steam", steamBefore);
})();
