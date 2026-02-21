(() => {
  "use strict";

  const G = globalThis;
  if (G.__sandboxels_pressure_system_v3) return;
  if (typeof elements !== "object" || typeof behaviors !== "object") return;
  G.__sandboxels_pressure_system_v3 = true;

  const ID = Object.freeze({
    PRESSURIZED_WATER: "pressurized_water",
    PRESSURIZER: "pressurizer",
    PRESSURE_PLATE: "pressure_plate",
    PRESSURE_WAVE: "pressure_wave",
    PRESSURE_DEBRIS: "pressure_debris",
    TOOL_PRESSURIZE: "pressurize",
    TOOL_DEPRESSURIZE: "depressurize",
  });

  const CFG = Object.freeze({
    MAX_P: 520,
    CONVERT_P: 22,
    REVERT_P: 2,
    PUSH_P: 10,
    FLASH_TO_STEAM_P: 110,
    FLASH_CHANCE: 0.35,

    WATER_BUILD: 0.45,
    STEAM_BUILD: 0.95,
    CROWD_GAIN_W: 0.16,
    CROWD_GAIN_S: 0.28,

    OPEN_LOSS: 1.15,
    OPEN_MULT: 0.92,

    EQ_RATE: 0.12,
    EQ_MIN_DIFF: 5,

    RUPTURE_P_WATER: 88,
    RUPTURE_P_STEAM: 74,
    RUPTURE_LOSS: 36,

    BURST_WAVES: 8,
    WAVE_LIFE: 10,
    WAVE_DECAY: 0.84,
    WAVE_PUSH_CHANCE: 0.55,

    PRESSURIZER_ADD: 10,
    PLATE_ADD: 22,

    TOOL_ADD: 55,
    TOOL_SUB: 85,
    TOOL_SPREAD: 1,

    SAMPLE_MOD: 3,
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
    return G.pixelMap?.[x]?.[y] || null;
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
    if (!isFn("createPixel")) return null;
    if (!replace && !isEmptyAt(x, y, false)) return null;
    G.createPixel(elem, x, y);
    return getPx(x, y);
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
    if (!p || p.element === elem) return false;
    if (isFn("changePixel")) G.changePixel(p, elem);
    else p.element = elem;
    return true;
  };

  const swap = (a, b) => (isFn("swapPixels") ? G.swapPixels(a, b) : false);

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
    setPr(p, prOf(p) + dv);
  };

  const isFluidish = (p) => {
    if (!p) return false;
    if (p.element === ID.PRESSURIZED_WATER) return true;
    const st = stateOf(p);
    return st === "liquid" || st === "gas";
  };

  const isUnbreakable = (p) => {
    const d = defOf(p?.element);
    if (!d) return false;
    return !!(d.unbreakable || d.noMix || d.category === "tools" || d.isTool);
  };

  const isWeakSolid = (p) => {
    if (!p || isUnbreakable(p)) return false;
    const d = defOf(p.element);
    if (!d || d.state !== "solid") return false;
    if (p.element === ID.PRESSURIZER || p.element === ID.PRESSURE_PLATE) return false;

    const h = d.hardness;
    if (typeof h === "number" && h < 0.68) return true;

    const den = d.density;
    if (typeof den === "number" && den < 1650) return true;

    if (d.breakInto) return true;
    return false;
  };

  const breakSolid = (p, force = 0) => {
    if (!p || !isWeakSolid(p)) return false;
    const d = defOf(p.element);
    const into = typeof d?.breakInto === "string" ? d.breakInto : ID.PRESSURE_DEBRIS;
    const chance = clamp(0.35 + force * 0.015, 0.35, 0.95);
    if (Math.random() < chance) {
      changeTo(p, into);
    } else {
      deleteAt(p.x, p.y);
    }
    return true;
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
      const n = getPx(x + DIR8[i][0], y + DIR8[i][1]);
      if (n && isFluidish(n)) c += 1;
    }
    return c;
  };

  const sampleGate = (p) => {
    const t = Number.isFinite(G.pixelTicks) ? G.pixelTicks : null;
    if (t === null) return ((p.x + p.y) % CFG.SAMPLE_MOD) === 0;
    return ((t + p.x + p.y) % CFG.SAMPLE_MOD) === 0;
  };

  const equalize = (p) => {
    let pr = prOf(p);
    if (pr <= 0) return;

    for (let i = 0; i < 4; i += 1) {
      const n = getPx(p.x + DIR4[i][0], p.y + DIR4[i][1]);
      if (!n || !isFluidish(n)) continue;

      const npr = prOf(n);
      const diff = pr - npr;
      if (diff <= CFG.EQ_MIN_DIFF) continue;

      const flow = diff * CFG.EQ_RATE;
      pr -= flow;
      setPr(n, npr + flow);
      if (pr <= 0) break;
    }

    setPr(p, pr);
  };

  const pushOut = (p) => {
    const pr = prOf(p);
    if (pr < CFG.PUSH_P) return;

    const tries = clamp(((pr / 26) | 0) + 1, 1, 4);
    for (let t = 0; t < tries; t += 1) {
      const dir = DIR4[(Math.random() * 4) | 0];
      const nx = p.x + dir[0];
      const ny = p.y + dir[1];
      if (!inBounds(nx, ny) || !isEmptyAt(nx, ny, false)) continue;
      if (tryMoveTo(p, nx, ny)) {
        setPr(p, prOf(p) - 1.6);
        break;
      }
    }
  };

  const spawnWave = (x, y, dx, dy, power) => {
    const w = createAt(ID.PRESSURE_WAVE, x, y, false);
    if (!w) return;
    w.dx = dx;
    w.dy = dy;
    w.life = CFG.WAVE_LIFE;
    w.pow = clamp(power, 0, CFG.MAX_P);
  };

  const burst = (src, bx, by, power, makeSteam) => {
    if (!src) return;

    if (makeSteam && (src.element === "water" || src.element === ID.PRESSURIZED_WATER)) {
      if (Math.random() < clamp(CFG.FLASH_CHANCE + power * 0.0015, 0.15, 0.85)) changeTo(src, "steam");
    }

    for (let i = 0; i < CFG.BURST_WAVES; i += 1) {
      const d = DIR8[i];
      const sx = bx + d[0];
      const sy = by + d[1];
      if (!inBounds(sx, sy)) continue;
      if (isEmptyAt(sx, sy, false)) {
        spawnWave(sx, sy, d[0], d[1], power);
      }
    }

    for (let i = 0; i < 6; i += 1) {
      const dx = ((Math.random() * 3) | 0) - 1;
      const dy = ((Math.random() * 3) | 0) - 1;
      const sx = bx + dx;
      const sy = by + dy;
      if (!inBounds(sx, sy) || !isEmptyAt(sx, sy, false)) continue;
      if (Math.random() < 0.35) createAt(ID.PRESSURE_DEBRIS, sx, sy, false);
      if (makeSteam && Math.random() < 0.22) {
        const st = createAt("steam", sx, sy, false);
        if (st) setPr(st, power * 0.45);
      }
    }

    setPr(src, prOf(src) - CFG.RUPTURE_LOSS);
  };

  const rupture = (p, kind) => {
    const pr = prOf(p);
    const threshold = kind === "steam" ? CFG.RUPTURE_P_STEAM : CFG.RUPTURE_P_WATER;
    if (pr < threshold) return false;

    const sealed = seal4(p.x, p.y);
    if (sealed < 3) return false;

    const weak = [];
    for (let i = 0; i < 4; i += 1) {
      const n = getPx(p.x + DIR4[i][0], p.y + DIR4[i][1]);
      if (n && isWeakSolid(n)) weak.push(n);
    }
    if (!weak.length) return false;

    const target = weak[(Math.random() * weak.length) | 0];
    const power = clamp(pr, 0, CFG.MAX_P);

    if (!breakSolid(target, power)) return false;

    burst(p, target.x, target.y, power, kind === "steam" || power >= CFG.FLASH_TO_STEAM_P);
    return true;
  };

  const convertIfNeeded = (p) => {
    if (!p) return false;
    const pr = prOf(p);

    if (p.element === "water" && pr >= CFG.CONVERT_P) return changeTo(p, ID.PRESSURIZED_WATER);
    if (p.element === ID.PRESSURIZED_WATER && pr <= CFG.REVERT_P) {
      changeTo(p, "water");
      setPr(p, 0);
      return true;
    }
    return false;
  };

  const pressureCore = (p, kind) => {
    const cur = prOf(p);
    const sealed = seal4(p.x, p.y);
    const open = 4 - sealed;

    if (cur <= 0 && sealed <= 1) return;

    let pr = cur;

    if (!sampleGate(p)) {
      if (open > 0) {
        pr = pr * CFG.OPEN_MULT - CFG.OPEN_LOSS * open;
        setPr(p, pr);
        convertIfNeeded(p);
      }
      return;
    }

    const crowd = sealed >= 3 ? crowd8(p.x, p.y) : 0;

    if (open > 0) {
      pr = pr * CFG.OPEN_MULT - CFG.OPEN_LOSS * open;
    } else {
      pr += kind === "steam" ? CFG.STEAM_BUILD : CFG.WATER_BUILD;
      if (crowd > 4) pr += (crowd - 4) * (kind === "steam" ? CFG.CROWD_GAIN_S : CFG.CROWD_GAIN_W);
    }

    setPr(p, pr);

    if (convertIfNeeded(p)) return;

    if (kind === "water" && prOf(p) >= CFG.FLASH_TO_STEAM_P && Math.random() < CFG.FLASH_CHANCE) {
      changeTo(p, "steam");
      return;
    }

    if (prOf(p) > 0) {
      equalize(p);
      rupture(p, kind);
      pushOut(p);
    }
  };

  const wrapTick = (name, before) => {
    const d = defOf(name);
    if (!d || d.__psWrapped) return;
    d.__psWrapped = true;

    const orig = typeof d.tick === "function" ? d.tick : null;
    d.tick = function (p) {
      const old = p?.element;
      try {
        before(p);
      } catch (_e) {}
      if (!p || p.element !== old) return;
      if (orig) orig(p);
    };
  };

  const waterBefore = (p) => pressureCore(p, "water");
  const steamBefore = (p) => pressureCore(p, "steam");

  const waterBehavior = elements.water?.behavior || behaviors.LIQUID;

  const pressurizedWaterTick = (p) => {
    const old = p.element;
    pressureCore(p, "water");
    if (!p || p.element !== old) return;
    if (isFn("doDefaults")) G.doDefaults(p);
  };

  const waveTick = (p) => {
    let life = Number.isFinite(p.life) ? p.life : CFG.WAVE_LIFE;
    let pow = Number.isFinite(p.pow) ? p.pow : 0;
    const dx = (p.dx | 0) || 0;
    const dy = (p.dy | 0) || 0;

    life -= 1;
    pow *= CFG.WAVE_DECAY;

    if (life <= 0 || pow <= 0.5 || (dx === 0 && dy === 0)) {
      deleteAt(p.x, p.y);
      return;
    }

    const nx = p.x + dx;
    const ny = p.y + dy;

    if (!inBounds(nx, ny)) {
      deleteAt(p.x, p.y);
      return;
    }

    const hit = getPx(nx, ny);

    if (!hit) {
      tryMoveTo(p, nx, ny);
      p.life = life;
      p.pow = pow;
      return;
    }

    if (isFluidish(hit)) {
      addPr(hit, pow * 0.35);

      if (hit.element === "water" && prOf(hit) >= CFG.CONVERT_P) changeTo(hit, ID.PRESSURIZED_WATER);

      if (Math.random() < CFG.WAVE_PUSH_CHANCE) {
        const tx = nx + dx;
        const ty = ny + dy;
        if (inBounds(tx, ty) && isEmptyAt(tx, ty, false)) {
          if (tryMoveTo(hit, tx, ty)) {
            swap(p, getPx(nx, ny) || p);
          }
        }
      }

      tryMoveTo(p, nx, ny);
      p.life = life;
      p.pow = pow;
      return;
    }

    if (isWeakSolid(hit) && Math.random() < clamp(pow / 120, 0.18, 0.92)) {
      breakSolid(hit, pow);
      tryMoveTo(p, nx, ny);
      p.life = life;
      p.pow = pow;
      return;
    }

    deleteAt(p.x, p.y);
  };

  const applyTool = (p, dv, spread) => {
    if (!p || !isFluidish(p)) return;

    addPr(p, dv);

    if (p.element === ID.PRESSURIZED_WATER && prOf(p) <= CFG.REVERT_P) {
      changeTo(p, "water");
      setPr(p, 0);
    } else if (p.element === "water" && prOf(p) >= CFG.CONVERT_P) {
      changeTo(p, ID.PRESSURIZED_WATER);
    }

    if (spread <= 0) return;

    for (let i = 0; i < 4; i += 1) {
      const n = getPx(p.x + DIR4[i][0], p.y + DIR4[i][1]);
      if (!n || !isFluidish(n)) continue;
      addPr(n, dv * 0.35);

      if (n.element === ID.PRESSURIZED_WATER && prOf(n) <= CFG.REVERT_P) {
        changeTo(n, "water");
        setPr(n, 0);
      } else if (n.element === "water" && prOf(n) >= CFG.CONVERT_P) {
        changeTo(n, ID.PRESSURIZED_WATER);
      }
    }
  };

  const pressurizerSelect = () => {
    const armed = !!(G.shiftDown || G.ctrlDown || G.metaDown);
    G.__ps_pickArmed = armed;
  };

  const pressurizerInit = (p, add) => {
    if (p.__psInit) return;
    p.__psInit = true;
    p.__psAdd = add;
    p.__psArmed = !!G.__ps_pickArmed;
    p.__psTarget = null;
  };

  const pressurizerTryLock = (p) => {
    if (!p.__psArmed || typeof p.__psTarget === "string") return;
    for (let i = 0; i < 8; i += 1) {
      const n = getPx(p.x + DIR8[i][0], p.y + DIR8[i][1]);
      if (!n) continue;
      if (n.element === ID.PRESSURIZER || n.element === ID.PRESSURE_PLATE) continue;
      if (!isFluidish(n)) continue;
      p.__psTarget = n.element;
      return;
    }
  };

  const pressurizerTickFactory = (add) => {
    return function (p) {
      pressurizerInit(p, add);
      pressurizerTryLock(p);

      const t = typeof p.__psTarget === "string" ? p.__psTarget : null;
      const amt = Number.isFinite(p.__psAdd) ? p.__psAdd : add;

      for (let i = 0; i < 8; i += 1) {
        const n = getPx(p.x + DIR8[i][0], p.y + DIR8[i][1]);
        if (!n || !isFluidish(n)) continue;
        if (t && n.element !== t) continue;
        addPr(n, amt);
        if (n.element === "water" && prOf(n) >= CFG.CONVERT_P) changeTo(n, ID.PRESSURIZED_WATER);
      }

      if (isFn("doDefaults")) G.doDefaults(p);
    };
  };

  if (!elements[ID.PRESSURE_DEBRIS]) {
    elements[ID.PRESSURE_DEBRIS] = {
      color: ["#b9bbc3", "#8e9098", "#6b6d75"],
      behavior: behaviors.POWDER,
      category: "powders",
      state: "solid",
      density: 1100,
      hardness: 0.15,
    };
  }

  elements[ID.PRESSURE_WAVE] = {
    color: ["#d9ffff", "#aef7ff", "#73f0ff"],
    behavior: behaviors.WALL,
    category: "energy",
    state: "gas",
    hidden: true,
    density: 0,
    ignoreAir: true,
    tick: waveTick,
  };

  elements[ID.PRESSURIZED_WATER] = {
    color: ["#2aa8ff", "#1e7bff", "#39d1ff"],
    behavior: waterBehavior,
    category: "liquids",
    state: "liquid",
    density: (elements.water?.density ?? 1000) + 120,
    viscosity: (elements.water?.viscosity ?? 1) * 1.45,
    tick: pressurizedWaterTick,
  };

  elements[ID.PRESSURIZER] = {
    color: ["#2cffcf", "#00ffa2", "#00c8ff"],
    behavior: behaviors.WALL,
    category: "machines",
    state: "solid",
    density: 3400,
    hardness: 0.92,
    insulate: true,
    onSelect: pressurizerSelect,
    onShiftSelect: pressurizerSelect,
    tick: pressurizerTickFactory(CFG.PRESSURIZER_ADD),
  };

  elements[ID.PRESSURE_PLATE] = {
    color: ["#9cff00", "#45ff7a", "#00ffc8"],
    behavior: behaviors.WALL,
    category: "machines",
    state: "solid",
    density: 3600,
    hardness: 0.94,
    insulate: true,
    tick: pressurizerTickFactory(CFG.PLATE_ADD),
  };

  elements[ID.TOOL_PRESSURIZE] = {
    color: ["#2cffcf", "#00ffa2", "#00c8ff"],
    category: "tools",
    tool: function (p) {
      applyTool(p, CFG.TOOL_ADD, CFG.TOOL_SPREAD);
    },
  };

  elements[ID.TOOL_DEPRESSURIZE] = {
    color: ["#ffd6ff", "#ff9ee0", "#ff7ab3"],
    category: "tools",
    tool: function (p) {
      applyTool(p, -CFG.TOOL_SUB, CFG.TOOL_SPREAD);
    },
  };

  wrapTick("water", waterBefore);
  wrapTick("steam", steamBefore);
})();
