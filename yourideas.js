(() => {
  "use strict";

  const G = globalThis;

  if (G.__sandboxels_pressure_system_v7) return;
  if (typeof elements !== "object" || typeof behaviors !== "object") return;
  G.__sandboxels_pressure_system_v7 = true;

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
    CAT: "pressure",
    LOCK_KEY: "__ps_lock_v7",

    MAX_P: 650,

    WATER_BUILD: 0.55,
    STEAM_BUILD: 1.25,
    CROWD_GAIN_W: 0.14,
    CROWD_GAIN_S: 0.34,

    OPEN_LOSS: 1.35,
    OPEN_MULT: 0.88,

    EQ_RATE: 0.11,
    EQ_MIN_DIFF: 6,

    PUSH_P: 16,
    PUSH_STEPS: 4,

    RUPTURE_P_WATER: 130,
    RUPTURE_P_STEAM: 85,
    RUPTURE_LOSS: 46,

    FLASH_TO_STEAM_P: 190,
    FLASH_CHANCE: 0.26,

    BURST_WAVES: 8,
    WAVE_LIFE: 12,
    WAVE_DECAY: 0.83,
    WAVE_BREAK_MIN: 38,
    WAVE_LOCK_MIN: 140,

    PRESSURIZER_ADD: 10,
    PRESSURIZER_RADIUS: 1,

    PLATE_IDLE_ADD: 2,
    PLATE_ACTIVE_ADD: 34,
    PLATE_RADIUS: 2,
    PLATE_PULSE_CD: 16,

    TOOL_ADD: 90,
    TOOL_SUB: 125,
    TOOL_SPREAD: 1,

    SAMPLE_MOD: 3,

    SEED_WATER_FULL_SEAL: 4,
    SEED_WATER_CROWD_FULL: 10,
    SEED_WATER_SEAL_STEAM: 3,
    SEED_WATER_CROWD_STEAM: 7,

    SEED_STEAM_SEAL: 3,
    SEED_STEAM_CROWD: 5,

    PROMOTE_MIN_P: 2,
    DEMOTE_P: 1,

    OXY_BURST_P: 170,
    OXY_MIN_O2: 2,
    OXY_NEED_OPEN: 1,
    OXY_RADIUS: 2,
    OXY_COOLDOWN: 26,
    OXY_PRESSURE_LOSS: 140,
    OXY_WAVE_POWER_MULT: 0.95,
    OXY_WAVE_POWER_MIN: 40,
    OXY_WAVE_POWER_MAX: 240,
    OXY_SMOKE_CHANCE: 0.78,
    OXY_STEAM_CHANCE: 0.28,
    OXY_AIR_SMOKE_CHANCE: 0.20,
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
    if (!elem || !elements[elem]) return null;
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
    if (!p || !elem || p.element === elem) return false;
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

  const hasLock = (p) => !!p?.[CFG.LOCK_KEY];
  const setLock = (p, on) => {
    if (!p) return;
    if (on) p[CFG.LOCK_KEY] = 1;
    else if (CFG.LOCK_KEY in p) delete p[CFG.LOCK_KEY];
  };

  const isFluidish = (p) => {
    if (!p) return false;
    if (p.element === ID.PRESSURIZED_WATER) return true;
    const st = stateOf(p);
    return st === "liquid" || st === "gas";
  };

  const isUnbreakable = (p) => {
    const d = defOf(p?.element);
    return !!(d?.unbreakable || d?.noMix || d?.category === "tools" || d?.isTool);
  };

  const isWeakSolid = (p) => {
    if (!p || isUnbreakable(p)) return false;
    const d = defOf(p.element);
    if (!d || d.state !== "solid") return false;
    if (p.element === ID.PRESSURIZER || p.element === ID.PRESSURE_PLATE) return false;

    const h = d.hardness;
    if (typeof h === "number" && h < 0.7) return true;

    const den = d.density;
    if (typeof den === "number" && den < 1700) return true;

    if (d.breakInto) return true;
    return false;
  };

  const breakSolid = (p, force = 0) => {
    if (!p || !isWeakSolid(p)) return false;
    const d = defOf(p.element);
    const into = typeof d?.breakInto === "string" ? d.breakInto : ID.PRESSURE_DEBRIS;
    const chance = clamp(0.35 + force * 0.012, 0.35, 0.95);
    if (Math.random() < chance) changeTo(p, into);
    else deleteAt(p.x, p.y);
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

  const steamNeighbors = (x, y) => {
    let c = 0;
    for (let i = 0; i < 8; i += 1) {
      const n = getPx(x + DIR8[i][0], y + DIR8[i][1]);
      if (n && n.element === "steam") c += 1;
    }
    return c;
  };

  const sampleGate = (p) => {
    const t = Number.isFinite(G.pixelTicks) ? G.pixelTicks : 0;
    return ((t + p.x + p.y) % CFG.SAMPLE_MOD) === 0;
  };

  const promoteDemote = (p) => {
    if (!p) return;

    if (p.element === ID.PRESSURIZED_WATER) {
      setLock(p, true);
      if (prOf(p) <= CFG.DEMOTE_P) {
        changeTo(p, "water");
        setLock(p, false);
        setPr(p, 0);
      }
      return;
    }

    if (p.element !== "water") return;
    if (!hasLock(p)) return;

    const pr = prOf(p);
    if (pr <= CFG.DEMOTE_P) {
      setLock(p, false);
      return;
    }

    if (pr >= CFG.PROMOTE_MIN_P) changeTo(p, ID.PRESSURIZED_WATER);
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

    const tries = clamp(((pr / 28) | 0) + 1, 1, CFG.PUSH_STEPS);
    for (let t = 0; t < tries; t += 1) {
      const dir = DIR4[(Math.random() * 4) | 0];
      const nx = p.x + dir[0];
      const ny = p.y + dir[1];
      if (!inBounds(nx, ny) || !isEmptyAt(nx, ny, false)) continue;
      if (tryMoveTo(p, nx, ny)) {
        setPr(p, prOf(p) - 1.8);
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

  const burst = (src, bx, by, power, steamBias) => {
    const pow = clamp(power, 0, CFG.MAX_P);

    for (let i = 0; i < CFG.BURST_WAVES; i += 1) {
      const d = DIR8[i];
      const sx = bx + d[0];
      const sy = by + d[1];
      if (!inBounds(sx, sy)) continue;
      if (isEmptyAt(sx, sy, false)) spawnWave(sx, sy, d[0], d[1], pow);
    }

    for (let i = 0; i < 7; i += 1) {
      const dx = ((Math.random() * 3) | 0) - 1;
      const dy = ((Math.random() * 3) | 0) - 1;
      const sx = bx + dx;
      const sy = by + dy;
      if (!inBounds(sx, sy) || !isEmptyAt(sx, sy, false)) continue;

      if (Math.random() < 0.35) createAt(ID.PRESSURE_DEBRIS, sx, sy, false);
      if (steamBias && Math.random() < 0.30) {
        const st = createAt("steam", sx, sy, false);
        if (st) setPr(st, pow * 0.5);
      }
    }

    if (src) setPr(src, prOf(src) - CFG.RUPTURE_LOSS);
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

    const steamBias = kind === "steam" || power >= CFG.FLASH_TO_STEAM_P;
    burst(p, target.x, target.y, power, steamBias);
    return true;
  };

  const SMOKE_ELEM = elements.smoke ? "smoke" : elements.carbon_dioxide ? "carbon_dioxide" : "steam";

  const oxygenAirScan = (p) => {
    let o2 = 0;
    let open = 0;
    for (let i = 0; i < 8; i += 1) {
      const nx = p.x + DIR8[i][0];
      const ny = p.y + DIR8[i][1];
      if (!inBounds(nx, ny)) continue;
      const n = getPx(nx, ny);
      if (!n) {
        open += 1;
        continue;
      }
      if (n.element === "oxygen") o2 += 1;
      if (n.element === "air" || n.element === "oxygen") open += 1;
    }
    return { o2, open };
  };

  const oxygenBurst = (p) => {
    if (!p) return;
    if (p.__psOxyCd > 0) return;
    p.__psOxyCd = CFG.OXY_COOLDOWN;

    const basePr = prOf(p);
    const power = clamp(basePr * CFG.OXY_WAVE_POWER_MULT, CFG.OXY_WAVE_POWER_MIN, CFG.OXY_WAVE_POWER_MAX);

    for (let i = 0; i < 8; i += 1) {
      const d = DIR8[i];
      const sx = p.x + d[0];
      const sy = p.y + d[1];
      if (!inBounds(sx, sy)) continue;
      if (isEmptyAt(sx, sy, false)) spawnWave(sx, sy, d[0], d[1], power);
    }

    const r = CFG.OXY_RADIUS | 0;
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (!inBounds(x, y)) continue;

        const n = getPx(x, y);

        if (!n) {
          if (Math.random() < CFG.OXY_STEAM_CHANCE) createAt("steam", x, y, false);
          continue;
        }

        if (n.element === "oxygen") {
          if (Math.random() < CFG.OXY_SMOKE_CHANCE) changeTo(n, SMOKE_ELEM);
          continue;
        }

        if (n.element === "air") {
          if (Math.random() < CFG.OXY_AIR_SMOKE_CHANCE) changeTo(n, SMOKE_ELEM);
          continue;
        }

        if (n.element === "water" || n.element === ID.PRESSURIZED_WATER) {
          if (Math.random() < 0.22) {
            changeTo(n, "steam");
            setPr(n, clamp(prOf(n) + power * 0.2, 0, CFG.MAX_P));
          }
        }
      }
    }

    setPr(p, basePr - CFG.OXY_PRESSURE_LOSS);

    if (p.element === ID.PRESSURIZED_WATER && Math.random() < 0.35) changeTo(p, "steam");
  };

  const canWaterBuildHere = (p, sealed, crowd, steamN) => {
    if (steamN > 0 && sealed >= CFG.SEED_WATER_SEAL_STEAM && crowd >= CFG.SEED_WATER_CROWD_STEAM) return true;
    if (sealed >= CFG.SEED_WATER_FULL_SEAL && crowd >= CFG.SEED_WATER_CROWD_FULL) return true;
    return false;
  };

  const seedPressureIfNeeded = (p, kind) => {
    if (prOf(p) > 0) return true;

    const sealed = seal4(p.x, p.y);
    if (sealed < 3) return false;
    if (!sampleGate(p)) return false;

    const crowd = crowd8(p.x, p.y);

    if (kind === "steam") {
      if (sealed < CFG.SEED_STEAM_SEAL || crowd < CFG.SEED_STEAM_CROWD) return false;
      setPr(p, 14);
      return true;
    }

    const steamN = steamNeighbors(p.x, p.y);
    if (!canWaterBuildHere(p, sealed, crowd, steamN)) return false;
    setPr(p, 10);
    return true;
  };

  const pressureCore = (p, kind) => {
    if (!p) return;

    if (p.__psOxyCd > 0) p.__psOxyCd -= 1;

    const cur = prOf(p);
    const sealed = seal4(p.x, p.y);
    const open = 4 - sealed;

    if (cur <= 0 && sealed < 3) return;
    if (cur <= 0 && !seedPressureIfNeeded(p, kind)) return;

    let pr = prOf(p);

    if (!sampleGate(p)) {
      if (open > 0) {
        pr = pr * CFG.OPEN_MULT - CFG.OPEN_LOSS * open;
        setPr(p, pr);
      }
      if (kind === "water") promoteDemote(p);
      return;
    }

    const crowd = sealed >= 3 ? crowd8(p.x, p.y) : 0;

    if (open > 0) {
      pr = pr * CFG.OPEN_MULT - CFG.OPEN_LOSS * open;
      setPr(p, pr);
      if (kind === "water") promoteDemote(p);

      if (prOf(p) >= CFG.OXY_BURST_P) {
        const scan = oxygenAirScan(p);
        if (scan.o2 >= CFG.OXY_MIN_O2 && scan.open >= CFG.OXY_NEED_OPEN) oxygenBurst(p);
      }
      return;
    }

    if (kind === "water") {
      const steamN = steamNeighbors(p.x, p.y);
      if (!canWaterBuildHere(p, sealed, crowd, steamN)) {
        pr = pr * CFG.OPEN_MULT - 0.9;
        setPr(p, pr);
        promoteDemote(p);
        return;
      }
    }

    pr += kind === "steam" ? CFG.STEAM_BUILD : CFG.WATER_BUILD;
    if (crowd > 4) pr += (crowd - 4) * (kind === "steam" ? CFG.CROWD_GAIN_S : CFG.CROWD_GAIN_W);
    setPr(p, pr);

    if (kind === "water" && prOf(p) >= CFG.FLASH_TO_STEAM_P && Math.random() < CFG.FLASH_CHANCE) {
      changeTo(p, "steam");
      return;
    }

    if (prOf(p) >= CFG.OXY_BURST_P) {
      const scan = oxygenAirScan(p);
      if (scan.o2 >= CFG.OXY_MIN_O2 && scan.open >= CFG.OXY_NEED_OPEN) oxygenBurst(p);
    }

    if (kind === "water") promoteDemote(p);

    if (prOf(p) > 0) {
      equalize(p);
      rupture(p, kind);
      pushOut(p);
    }
  };

  const wrapTick = (name, before) => {
    const d = defOf(name);
    if (!d || d.__psWrapped_v7) return;
    d.__psWrapped_v7 = true;

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

  const pressurizedWaterTick = (p) => {
    setLock(p, true);
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

    if (life <= 0 || pow <= 0.6 || (dx === 0 && dy === 0)) {
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
      addPr(hit, pow * 0.42);

      if (hit.element === "water" && pow >= CFG.WAVE_LOCK_MIN) {
        setLock(hit, true);
        promoteDemote(hit);
      }

      if (Math.random() < 0.45) pushOut(hit);

      tryMoveTo(p, nx, ny);
      p.life = life;
      p.pow = pow;
      return;
    }

    if (pow >= CFG.WAVE_BREAK_MIN && isWeakSolid(hit) && Math.random() < clamp(pow / 140, 0.18, 0.92)) {
      breakSolid(hit, pow);
      tryMoveTo(p, nx, ny);
      p.life = life;
      p.pow = pow;
      return;
    }

    deleteAt(p.x, p.y);
  };

  const applyTool = (p, dv, spread, lockWater) => {
    if (!p || !isFluidish(p)) return;

    addPr(p, dv);

    if (lockWater && p.element === "water") {
      setLock(p, true);
      promoteDemote(p);
    } else if (p.element === ID.PRESSURIZED_WATER) {
      setLock(p, true);
      promoteDemote(p);
    } else if (dv < 0 && p.element === "water" && hasLock(p) && prOf(p) <= CFG.DEMOTE_P) {
      setLock(p, false);
    }

    if (spread <= 0) return;

    for (let i = 0; i < 4; i += 1) {
      const n = getPx(p.x + DIR4[i][0], p.y + DIR4[i][1]);
      if (!n || !isFluidish(n)) continue;

      addPr(n, dv * 0.35);

      if (lockWater && n.element === "water") {
        setLock(n, true);
        promoteDemote(n);
      } else if (n.element === ID.PRESSURIZED_WATER) {
        setLock(n, true);
        promoteDemote(n);
      } else if (dv < 0 && n.element === "water" && hasLock(n) && prOf(n) <= CFG.DEMOTE_P) {
        setLock(n, false);
      }
    }
  };

  const armPick = () => {
    G.__ps_pickArmed_v7 = !!(G.shiftDown || G.ctrlDown || G.metaDown || G.altDown);
  };

  const initMachine = (p, radius, addIdle, addActive) => {
    if (p.__psInit_v7) return;
    p.__psInit_v7 = true;
    p.__psTarget_v7 = null;
    p.__psArmed_v7 = !!G.__ps_pickArmed_v7;
    p.__psRadius_v7 = radius;
    p.__psAddIdle_v7 = addIdle;
    p.__psAddActive_v7 = addActive ?? addIdle;
    p.__psPulseCd_v7 = 0;
    G.__ps_pickArmed_v7 = false;
  };

  const lockTargetIfArmed = (p) => {
    if (!p.__psArmed_v7 || typeof p.__psTarget_v7 === "string") return;
    const r = p.__psRadius_v7 | 0;

    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const n = getPx(p.x + dx, p.y + dy);
        if (!n || !isFluidish(n)) continue;
        if (n.element === ID.PRESSURIZER || n.element === ID.PRESSURE_PLATE) continue;
        p.__psTarget_v7 = n.element;
        return;
      }
    }

    p.__psTarget_v7 = null;
  };

  const machineAffect = (p, amt, lockWater) => {
    const r = p.__psRadius_v7 | 0;
    const t = typeof p.__psTarget_v7 === "string" ? p.__psTarget_v7 : null;

    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const n = getPx(p.x + dx, p.y + dy);
        if (!n || !isFluidish(n)) continue;
        if (t && n.element !== t) continue;

        addPr(n, amt);

        if (lockWater && n.element === "water") {
          setLock(n, true);
          promoteDemote(n);
        } else if (n.element === ID.PRESSURIZED_WATER) {
          setLock(n, true);
          promoteDemote(n);
        }
      }
    }
  };

  const anyPressingPlate = (p) => {
    const above = getPx(p.x, p.y - 1);
    if (!above) return false;
    const st = stateOf(above);
    return st === "solid" || st === "liquid";
  };

  const platePulse = (p, power) => {
    if (p.__psPulseCd_v7 > 0) return;
    p.__psPulseCd_v7 = CFG.PLATE_PULSE_CD;

    const pow = clamp(power, 24, 180);
    for (let i = 0; i < 8; i += 1) {
      const d = DIR8[i];
      const sx = p.x + d[0];
      const sy = p.y + d[1];
      if (!inBounds(sx, sy)) continue;
      if (isEmptyAt(sx, sy, false)) spawnWave(sx, sy, d[0], d[1], pow);
    }
  };

  const pressurizerTick = (p) => {
    initMachine(p, CFG.PRESSURIZER_RADIUS, CFG.PRESSURIZER_ADD, CFG.PRESSURIZER_ADD);
    lockTargetIfArmed(p);
    machineAffect(p, p.__psAddIdle_v7, true);
    if (isFn("doDefaults")) G.doDefaults(p);
  };

  const pressurePlateTick = (p) => {
    initMachine(p, CFG.PLATE_RADIUS, CFG.PLATE_IDLE_ADD, CFG.PLATE_ACTIVE_ADD);
    lockTargetIfArmed(p);

    if (p.__psPulseCd_v7 > 0) p.__psPulseCd_v7 -= 1;

    const active = anyPressingPlate(p);
    const amt = active ? p.__psAddActive_v7 : p.__psAddIdle_v7;

    machineAffect(p, amt, true);

    if (active) {
      const src = getPx(p.x, p.y - 1);
      const localPow = prOf(src) + amt * 3;
      platePulse(p, localPow);
    }

    if (isFn("doDefaults")) G.doDefaults(p);
  };

  const waterBehavior = elements.water?.behavior || behaviors.LIQUID;

  if (!elements[ID.PRESSURE_DEBRIS]) {
    elements[ID.PRESSURE_DEBRIS] = {
      color: ["#b9bbc3", "#8e9098", "#6b6d75"],
      behavior: behaviors.POWDER,
      category: CFG.CAT,
      state: "solid",
      density: 1100,
      hardness: 0.15,
    };
  }

  elements[ID.PRESSURE_WAVE] = {
    color: ["#d9ffff", "#aef7ff", "#73f0ff"],
    behavior: behaviors.WALL,
    category: CFG.CAT,
    state: "gas",
    hidden: true,
    density: 0,
    ignoreAir: true,
    tick: waveTick,
  };

  elements[ID.PRESSURIZED_WATER] = {
    color: ["#2aa8ff", "#1e7bff", "#39d1ff"],
    behavior: waterBehavior,
    category: CFG.CAT,
    state: "liquid",
    density: (elements.water?.density ?? 1000) + 140,
    viscosity: (elements.water?.viscosity ?? 1) * 1.55,
    tick: pressurizedWaterTick,
  };

  elements[ID.PRESSURIZER] = {
    color: ["#2cffcf", "#00ffa2", "#00c8ff"],
    behavior: behaviors.WALL,
    category: CFG.CAT,
    state: "solid",
    density: 3400,
    hardness: 0.92,
    insulate: true,
    onSelect: armPick,
    onShiftSelect: armPick,
    tick: pressurizerTick,
  };

  elements[ID.PRESSURE_PLATE] = {
    color: ["#9cff00", "#45ff7a", "#00ffc8"],
    behavior: behaviors.WALL,
    category: CFG.CAT,
    state: "solid",
    density: 3600,
    hardness: 0.94,
    insulate: true,
    onSelect: armPick,
    onShiftSelect: armPick,
    tick: pressurePlateTick,
  };

  elements[ID.TOOL_PRESSURIZE] = {
    color: ["#2cffcf", "#00ffa2", "#00c8ff"],
    category: "tools",
    tool: function (p) {
      applyTool(p, CFG.TOOL_ADD, CFG.TOOL_SPREAD, true);
    },
  };

  elements[ID.TOOL_DEPRESSURIZE] = {
    color: ["#ffd6ff", "#ff9ee0", "#ff7ab3"],
    category: "tools",
    tool: function (p) {
      applyTool(p, -CFG.TOOL_SUB, CFG.TOOL_SPREAD, false);
    },
  };

  wrapTick("water", (p) => pressureCore(p, "water"));
  wrapTick("steam", (p) => pressureCore(p, "steam"));
})();
