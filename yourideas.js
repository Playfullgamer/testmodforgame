(() => {
  "use strict";

  const G = globalThis;
  if (typeof elements !== "object" || typeof behaviors !== "object") return;

  const SYS = (G.__ps_sys = G.__ps_sys || { version: 0, origTicks: Object.create(null) });
  SYS.version = 9;

  const ID = Object.freeze({
    PRESSURIZED_WATER: "pressurized_water",
    PRESSURIZER: "pressurizer",
    PRESSURE_PLATE: "pressure_plate",
    PRESSURE_WAVE: "pressure_wave",
    TOOL_PRESSURIZE: "pressurize",
    TOOL_DEPRESSURIZE: "depressurize",
  });

  const KEY = Object.freeze({
    LOCK: "__ps_lock",
    PERM: "__ps_perm",
    AGE: "__ps_age",
    PUMP: "__ps_pump",
    OXY_CD: "__ps_oxcd",
    REL_CD: "__ps_relcd",
  });

  const pickElem = (a, b, c) => (elements[a] ? a : elements[b] ? b : c);
  const E = Object.freeze({
    OXY: pickElem("oxygen", "oxygen_gas", "air"),
    STEAM: elements.steam ? "steam" : null,
    SMOKE: pickElem("smoke", "carbon_dioxide", elements.steam ? "steam" : "air"),
    AIR: elements.air ? "air" : null,
  });

  const CFG = Object.freeze({
    CAT: "pressure",

    MAX_P: 900,

    PROMOTE_P: 55,
    DEMOTE_P: 8,
    PERM_MIN_P: 25,

    OPEN_MULT: 0.90,
    OPEN_LOSS: 1.05,

    EQ_RATE_STRONG: 0.24,
    EQ_RATE_WEAK: 0.10,
    EQ_MIN_DIFF_STRONG: 2,
    EQ_MIN_DIFF_WEAK: 8,

    PUSH_P: 26,
    PUSH_TRIES: 4,

    RUPTURE_P_WATER: 260,
    RUPTURE_P_STEAM: 165,
    RUPTURE_LOSS: 80,

    WAVE_LIFE: 12,
    WAVE_DECAY: 0.84,

    WAVE_BREAK_MIN: 95,
    WAVE_PUSH_SOLID_CHANCE: 0.55,

    PRESSURIZER_ADD: 2.2,
    PRESSURIZER_RADIUS: 2,

    PLATE_IDLE_ADD: 0.9,
    PLATE_ACTIVE_ADD: 4.8,
    PLATE_RADIUS: 3,
    PLATE_PULSE_CD: 22,

    TOOL_PUMP_ADD: 22,
    TOOL_PUMP_MAX: 160,
    TOOL_PUMP_RATE: 2.2,
    TOOL_PR_TAP: 4,
    TOOL_SPREAD: 1,

    DEP_SUB: 18,
    DEP_CLEAR_PERM_AT: 10,

    REACT_MIN_P: 260,
    REACT_SEAL_MIN: 3,
    REACT_GAIN: 1,
    REACT_DECAY: 3,
    REACT_TICK_MOD: 3,
    REACT_RELEASE_AT: 180,
    REACT_RELEASE_CD: 26,
    REACT_O2_SPAWN: 2,
    REACT_O2_RADIUS: 2,

    OVER_P: 720,
    OVER_AGE: 520,
    OVER_CD: 80,
    OVER_LOSS: 520,

    OXY_BURST_P: 360,
    OXY_MIN_O2: 3,
    OXY_NEED_OPEN: 2,
    OXY_RADIUS: 3,
    OXY_COOLDOWN: 30,
    OXY_PRESSURE_LOSS: 220,

    BLAST_SOLID_RADIUS_MIN: 2,
    BLAST_SOLID_RADIUS_MAX: 6,
    BLAST_SOLID_STEPS_MAX: 4,
    BLAST_UP_BIAS: 0.72,

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
    return !!(pm && pm[x] && y >= 0 && y < pm[x].length);
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
  const swap = (a, b) => (isFn("swapPixels") ? G.swapPixels(a, b) : false);

  const createAt = (elem, x, y, replace = false) => {
    if (!elem || !elements[elem] || !inBounds(x, y)) return null;
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

  const hasLock = (p) => !!p?.[KEY.LOCK];
  const setLock = (p, on) => {
    if (!p) return;
    if (on) p[KEY.LOCK] = 1;
    else if (KEY.LOCK in p) delete p[KEY.LOCK];
  };

  const isPerm = (p) => !!p?.[KEY.PERM];
  const setPerm = (p, on) => {
    if (!p) return;
    if (on) p[KEY.PERM] = 1;
    else if (KEY.PERM in p) delete p[KEY.PERM];
  };

  const ageOf = (p) => (p && Number.isFinite(p[KEY.AGE]) ? p[KEY.AGE] : 0);
  const setAge = (p, v) => {
    if (!p) return;
    const nv = v <= 0 ? 0 : v;
    if (!nv) {
      if (KEY.AGE in p) delete p[KEY.AGE];
      return;
    }
    p[KEY.AGE] = nv;
  };

  const pumpOf = (p) => (p && Number.isFinite(p[KEY.PUMP]) ? p[KEY.PUMP] : 0);
  const addPump = (p, dv) => {
    if (!p || !Number.isFinite(dv) || dv === 0) return;
    const nv = clamp(pumpOf(p) + dv, 0, CFG.TOOL_PUMP_MAX);
    if (nv <= 0) {
      if (KEY.PUMP in p) delete p[KEY.PUMP];
      return;
    }
    p[KEY.PUMP] = nv;
  };

  const decCd = (p, k) => {
    if (!p) return 0;
    const v = p[k];
    if (!Number.isFinite(v) || v <= 0) {
      if (k in p) delete p[k];
      return 0;
    }
    p[k] = v - 1;
    if (p[k] <= 0) delete p[k];
    return p[k] || 0;
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
    if (typeof h === "number" && h < 0.72) return true;

    const den = d.density;
    if (typeof den === "number" && den < 1800) return true;

    if (d.breakInto) return true;
    return false;
  };

  const breakSolid = (p) => {
    if (!p || !isWeakSolid(p)) return false;
    if (Math.random() < 0.55) deleteAt(p.x, p.y);
    else changeTo(p, E.SMOKE);
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

  const sampleGate = (p) => {
    const t = Number.isFinite(G.pixelTicks) ? G.pixelTicks : 0;
    return ((t + p.x + p.y) % CFG.SAMPLE_MOD) === 0;
  };

  const equalize = (p, rate, minDiff) => {
    let pr = prOf(p);
    if (pr <= 0) return;

    for (let i = 0; i < 4; i += 1) {
      const n = getPx(p.x + DIR4[i][0], p.y + DIR4[i][1]);
      if (!n || !isFluidish(n)) continue;

      const npr = prOf(n);
      const diff = pr - npr;
      if (diff <= minDiff) continue;

      const flow = diff * rate;
      pr -= flow;
      setPr(n, npr + flow);
      if (pr <= 0) break;
    }

    setPr(p, pr);
  };

  const pushOut = (p) => {
    const pr = prOf(p);
    if (pr < CFG.PUSH_P) return;

    const tries = CFG.PUSH_TRIES;
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

  const moveUpImpulse = (pix, steps) => {
    if (!pix || isUnbreakable(pix)) return false;
    let moved = false;

    for (let s = 0; s < steps; s += 1) {
      const x = pix.x;
      const y = pix.y;
      const up = getPx(x, y - 1);

      if (!inBounds(x, y - 1)) break;

      if (!up) {
        if (tryMoveTo(pix, x, y - 1)) {
          moved = true;
          continue;
        }
      } else {
        const upDef = defOf(up.element);
        const upState = upDef?.state;
        if (upState === "gas" || up.element === E.AIR || up.element === E.OXY || up.element === E.SMOKE || up.element === E.STEAM) {
          if (swap(pix, up)) {
            moved = true;
            continue;
          }
        }
      }

      const dl = getPx(x - 1, y - 1);
      if (inBounds(x - 1, y - 1) && !dl) {
        if (tryMoveTo(pix, x - 1, y - 1)) {
          moved = true;
          continue;
        }
      }

      const dr = getPx(x + 1, y - 1);
      if (inBounds(x + 1, y - 1) && !dr) {
        if (tryMoveTo(pix, x + 1, y - 1)) {
          moved = true;
          continue;
        }
      }

      break;
    }

    return moved;
  };

  const blastImpulse = (bx, by, power) => {
    const p = clamp(power, 0, CFG.MAX_P);
    const r = clamp(CFG.BLAST_SOLID_RADIUS_MIN + (p / 140) | 0, CFG.BLAST_SOLID_RADIUS_MIN, CFG.BLAST_SOLID_RADIUS_MAX);
    const steps = clamp(1 + (p / 220) | 0, 1, CFG.BLAST_SOLID_STEPS_MAX);

    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        const x = bx + dx;
        const y = by + dy;
        if (!inBounds(x, y)) continue;

        const n = getPx(x, y);
        if (!n) continue;

        const st = stateOf(n);
        if (st !== "solid") continue;
        if (isUnbreakable(n)) continue;

        const bias = Math.random() < CFG.BLAST_UP_BIAS;
        if (bias) moveUpImpulse(n, steps);
        else if (Math.random() < 0.28) {
          const nx = x + (Math.random() < 0.5 ? -1 : 1);
          const ny = y - 1;
          if (inBounds(nx, ny) && isEmptyAt(nx, ny, false)) tryMoveTo(n, nx, ny);
        }

        if (isWeakSolid(n) && p > 520 && Math.random() < 0.18) breakSolid(n);
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

  const burst = (src, bx, by, power) => {
    const pow = clamp(power, 0, CFG.MAX_P);

    blastImpulse(bx, by, pow);

    for (let i = 0; i < 8; i += 1) {
      const d = DIR8[i];
      const sx = bx + d[0];
      const sy = by + d[1];
      if (!inBounds(sx, sy)) continue;
      if (isEmptyAt(sx, sy, false)) spawnWave(sx, sy, d[0], d[1], pow);
    }

    for (let i = 0; i < 9; i += 1) {
      const dx = ((Math.random() * 5) | 0) - 2;
      const dy = ((Math.random() * 4) | 0) - 3;
      const sx = bx + dx;
      const sy = by + dy;
      if (!inBounds(sx, sy) || !isEmptyAt(sx, sy, false)) continue;
      if (Math.random() < 0.42) createAt(E.SMOKE, sx, sy, false);
      else if (E.STEAM && Math.random() < 0.35) createAt(E.STEAM, sx, sy, false);
    }

    if (src) setPr(src, prOf(src) - CFG.RUPTURE_LOSS);
  };

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
      if (n.element === "air" || n.element === "oxygen" || n.element === E.SMOKE || n.element === E.STEAM) open += 1;
    }
    return { o2, open };
  };

  const oxygenBurst = (p) => {
    if (!p) return;
    if (p[KEY.OXY_CD] > 0) return;
    p[KEY.OXY_CD] = CFG.OXY_COOLDOWN;

    const basePr = prOf(p);
    const pow = clamp(basePr, 80, 520);

    burst(p, p.x, p.y, pow);

    const r = CFG.OXY_RADIUS | 0;
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (!inBounds(x, y)) continue;

        const n = getPx(x, y);
        if (!n) {
          if (Math.random() < 0.22 && E.STEAM) createAt(E.STEAM, x, y, false);
          if (Math.random() < 0.32) createAt(E.SMOKE, x, y, false);
          continue;
        }

        if (n.element === "oxygen") {
          if (Math.random() < 0.62) changeTo(n, E.SMOKE);
          continue;
        }

        if (n.element === "air") {
          if (Math.random() < 0.22) changeTo(n, E.SMOKE);
          continue;
        }

        if (n.element === "water" || n.element === ID.PRESSURIZED_WATER) {
          if (E.STEAM && Math.random() < 0.20) changeTo(n, E.STEAM);
          addPr(n, pow * 0.10);
        }
      }
    }

    setPr(p, basePr - CFG.OXY_PRESSURE_LOSS);
  };

  const reactGate = (p) => {
    const t = Number.isFinite(G.pixelTicks) ? G.pixelTicks : 0;
    return ((t + p.x * 3 + p.y) % CFG.REACT_TICK_MOD) === 0;
  };

  const spawnOxygenNear = (p, count, r) => {
    let made = 0;
    const rad = r | 0;

    for (let pass = 0; pass < 2 && made < count; pass += 1) {
      for (let dy = -rad; dy <= rad && made < count; dy += 1) {
        for (let dx = -rad; dx <= rad && made < count; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const x = p.x + dx;
          const y = p.y + dy;
          if (!inBounds(x, y)) continue;

          const n = getPx(x, y);

          if (!n) {
            if (pass === 0 && Math.random() < 0.80) {
              if (createAt(E.OXY, x, y, false)) made += 1;
            }
            continue;
          }

          if (pass === 1 && (n.element === "air" || n.element === "oxygen")) {
            if (Math.random() < 0.55) {
              changeTo(n, E.OXY);
              made += 1;
            }
          }
        }
      }
    }

    return made;
  };

  const catastrophicOverpressure = (p) => {
    if (!p) return;
    if (p[KEY.REL_CD] > 0) return;
    p[KEY.REL_CD] = CFG.OVER_CD;

    const basePr = prOf(p);
    burst(p, p.x, p.y, clamp(basePr * 1.1, 140, 620));
    spawnOxygenNear(p, 4, 3);

    setPr(p, basePr - CFG.OVER_LOSS);
    setAge(p, 0);

    if (E.STEAM && Math.random() < 0.55) changeTo(p, E.STEAM);
  };

  const promoteDemote = (p) => {
    if (!p) return;

    if (p.element === ID.PRESSURIZED_WATER) {
      setLock(p, true);

      if (isPerm(p)) {
        if (prOf(p) < CFG.PERM_MIN_P) setPr(p, CFG.PERM_MIN_P);
        return;
      }

      if (prOf(p) <= CFG.DEMOTE_P) {
        changeTo(p, "water");
        setPerm(p, false);
        setLock(p, false);
        setAge(p, 0);
        setPr(p, 0);
      }

      return;
    }

    if (p.element !== "water") return;
    if (!hasLock(p)) return;

    const pr = prOf(p);
    if (pr <= CFG.DEMOTE_P && !isPerm(p)) {
      setLock(p, false);
      setAge(p, 0);
      return;
    }

    if (pr >= CFG.PROMOTE_P) changeTo(p, ID.PRESSURIZED_WATER);
  };

  const ruptureMaybe = (p, kind) => {
    if (!p) return false;
    const pr = prOf(p);
    const thr = kind === "steam" ? CFG.RUPTURE_P_STEAM : CFG.RUPTURE_P_WATER;
    if (pr < thr) return false;

    const sealed = seal4(p.x, p.y);
    if (sealed < 3) return false;

    const weak = [];
    for (let i = 0; i < 4; i += 1) {
      const n = getPx(p.x + DIR4[i][0], p.y + DIR4[i][1]);
      if (n && isWeakSolid(n)) weak.push(n);
    }

    const power = clamp(pr, 0, CFG.MAX_P);

    if (weak.length) {
      const target = weak[(Math.random() * weak.length) | 0];
      breakSolid(target);
      burst(p, target.x, target.y, power);
    } else {
      burst(p, p.x, p.y, power);
    }

    return true;
  };

  const pumpTick = (p) => {
    const pump = pumpOf(p);
    if (pump <= 0) return;

    const rate = CFG.TOOL_PUMP_RATE;
    addPr(p, rate);

    const next = pump - 1;
    if (next <= 0) delete p[KEY.PUMP];
    else p[KEY.PUMP] = next;
  };

  const waterReactionTick = (p) => {
    if (!p || p.element !== ID.PRESSURIZED_WATER || !isPerm(p)) return;

    decCd(p, KEY.REL_CD);

    if (!reactGate(p)) return;

    const pr = prOf(p);
    const sealed = seal4(p.x, p.y);
    const pumping = pumpOf(p) > 0;

    let age = ageOf(p);

    const stable = pumping && pr >= CFG.REACT_MIN_P && sealed >= CFG.REACT_SEAL_MIN;
    if (!stable) {
      age = age - CFG.REACT_DECAY;
      setAge(p, age);
      return;
    }

    age += CFG.REACT_GAIN;
    setAge(p, age);

    if (age >= CFG.REACT_RELEASE_AT && (!p[KEY.REL_CD] || p[KEY.REL_CD] <= 0)) {
      p[KEY.REL_CD] = CFG.REACT_RELEASE_CD;
      spawnOxygenNear(p, CFG.REACT_O2_SPAWN, CFG.REACT_O2_RADIUS);
      addPr(p, 10);
    }

    if (prOf(p) >= CFG.OVER_P || age >= CFG.OVER_AGE) catastrophicOverpressure(p);

    if (prOf(p) >= CFG.OXY_BURST_P) {
      const scan = oxygenAirScan(p);
      if (scan.o2 >= CFG.OXY_MIN_O2 && scan.open >= CFG.OXY_NEED_OPEN) oxygenBurst(p);
    }
  };

  const pressureCore = (p, kind) => {
    if (!p) return;

    decCd(p, KEY.OXY_CD);

    if (kind === "water") {
      pumpTick(p);
      promoteDemote(p);
    } else {
      pumpTick(p);
    }

    const cur = prOf(p);
    if (cur <= 0 && kind !== "steam") return;

    const sealed = seal4(p.x, p.y);
    const open = 4 - sealed;

    if (!sampleGate(p)) {
      if (open > 0) {
        setPr(p, prOf(p) * CFG.OPEN_MULT - CFG.OPEN_LOSS * open);
      }
      if (kind === "water") promoteDemote(p);
      return;
    }

    if (open > 0) {
      setPr(p, prOf(p) * CFG.OPEN_MULT - CFG.OPEN_LOSS * open);

      if (kind === "water" && p.element === ID.PRESSURIZED_WATER && prOf(p) >= CFG.OXY_BURST_P) {
        const scan = oxygenAirScan(p);
        if (scan.o2 >= CFG.OXY_MIN_O2 && scan.open >= CFG.OXY_NEED_OPEN) oxygenBurst(p);
      }

      if (kind === "water") promoteDemote(p);
      return;
    }

    if (kind === "steam") addPr(p, 0.55);
    else if (hasLock(p) || p.element === ID.PRESSURIZED_WATER) addPr(p, 0.08);

    if (p.element === ID.PRESSURIZED_WATER || hasLock(p)) {
      equalize(p, CFG.EQ_RATE_STRONG, CFG.EQ_MIN_DIFF_STRONG);
      pushOut(p);
    } else {
      equalize(p, CFG.EQ_RATE_WEAK, CFG.EQ_MIN_DIFF_WEAK);
    }

    if (kind === "water") promoteDemote(p);

    if (p.element === ID.PRESSURIZED_WATER) {
      ruptureMaybe(p, "water");
    } else if (kind === "steam") {
      ruptureMaybe(p, "steam");
    }
  };

  const wrapTick = (name, before) => {
    const d = defOf(name);
    if (!d) return;

    if (!SYS.origTicks[name]) SYS.origTicks[name] = typeof d.tick === "function" ? d.tick : null;
    else d.tick = SYS.origTicks[name];

    const base = typeof d.tick === "function" ? d.tick : null;

    d.tick = function (p) {
      const old = p?.element;
      try {
        before(p);
      } catch (_e) {}
      if (!p || p.element !== old) return;
      if (base) base(p);
    };
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

    const st = stateOf(hit);

    if (isFluidish(hit)) {
      addPr(hit, pow * 0.22);
      if (hit.element === "water") {
        setLock(hit, true);
        if (prOf(hit) >= CFG.PROMOTE_P) changeTo(hit, ID.PRESSURIZED_WATER);
      }
      if (Math.random() < 0.25) pushOut(hit);
      tryMoveTo(p, nx, ny);
      p.life = life;
      p.pow = pow;
      return;
    }

    if (st === "solid" && !isUnbreakable(hit)) {
      if (Math.random() < CFG.WAVE_PUSH_SOLID_CHANCE) moveUpImpulse(hit, clamp(1 + (pow / 240) | 0, 1, 3));
      if (pow >= CFG.WAVE_BREAK_MIN && isWeakSolid(hit) && Math.random() < clamp(pow / 520, 0.12, 0.55)) breakSolid(hit);
      deleteAt(p.x, p.y);
      return;
    }

    deleteAt(p.x, p.y);
  };

  const pressurizedWaterOnCreate = (p) => {
    if (!p) return;
    setLock(p, true);
    setPerm(p, true);
    if (prOf(p) < 220) setPr(p, 220);
    addPump(p, 0);
    setAge(p, 0);
  };

  const pressurizeApply = (p) => {
    if (!p) return;

    const st = stateOf(p);
    const ok = p.element === "water" || p.element === ID.PRESSURIZED_WATER || p.element === "steam" || st === "liquid" || st === "gas";
    if (!ok) return;

    if (p.element === "water" || p.element === ID.PRESSURIZED_WATER) {
      setLock(p, true);
      setPerm(p, true);
      addPump(p, CFG.TOOL_PUMP_ADD);
      addPr(p, CFG.TOOL_PR_TAP);
      promoteDemote(p);
    } else {
      addPump(p, (CFG.TOOL_PUMP_ADD * 0.7) | 0);
      addPr(p, CFG.TOOL_PR_TAP * 0.6);
    }

    if (CFG.TOOL_SPREAD > 0) {
      for (let i = 0; i < 4; i += 1) {
        const n = getPx(p.x + DIR4[i][0], p.y + DIR4[i][1]);
        if (!n) continue;

        const nst = stateOf(n);
        const nok = n.element === "water" || n.element === ID.PRESSURIZED_WATER || n.element === "steam" || nst === "liquid" || nst === "gas";
        if (!nok) continue;

        if (n.element === "water" || n.element === ID.PRESSURIZED_WATER) {
          setLock(n, true);
          setPerm(n, true);
          addPump(n, (CFG.TOOL_PUMP_ADD * 0.45) | 0);
          addPr(n, CFG.TOOL_PR_TAP * 0.35);
          promoteDemote(n);
        } else {
          addPump(n, (CFG.TOOL_PUMP_ADD * 0.25) | 0);
          addPr(n, CFG.TOOL_PR_TAP * 0.25);
        }
      }
    }
  };

  const depressurizeApply = (p) => {
    if (!p) return;
    if (!isFluidish(p) && p.element !== "water") return;

    addPr(p, -CFG.DEP_SUB);

    if (p.element === ID.PRESSURIZED_WATER) {
      if (prOf(p) <= CFG.DEP_CLEAR_PERM_AT) setPerm(p, false);
      if (!isPerm(p) && prOf(p) <= CFG.DEMOTE_P) {
        changeTo(p, "water");
        setLock(p, false);
        setAge(p, 0);
        setPr(p, 0);
      }
    } else if (p.element === "water") {
      if (prOf(p) <= CFG.DEMOTE_P) {
        setLock(p, false);
        if (!isPerm(p)) setAge(p, 0);
        if (!isPerm(p)) setPr(p, 0);
      }
    }

    for (let i = 0; i < 4; i += 1) {
      const n = getPx(p.x + DIR4[i][0], p.y + DIR4[i][1]);
      if (!n) continue;
      if (!isFluidish(n) && n.element !== "water") continue;
      addPr(n, -CFG.DEP_SUB * 0.35);

      if (n.element === ID.PRESSURIZED_WATER) {
        if (prOf(n) <= CFG.DEP_CLEAR_PERM_AT) setPerm(n, false);
        if (!isPerm(n) && prOf(n) <= CFG.DEMOTE_P) {
          changeTo(n, "water");
          setLock(n, false);
          setAge(n, 0);
          setPr(n, 0);
        }
      } else if (n.element === "water") {
        if (prOf(n) <= CFG.DEMOTE_P) {
          setLock(n, false);
          if (!isPerm(n)) setAge(n, 0);
          if (!isPerm(n)) setPr(n, 0);
        }
      }
    }
  };

  const initMachine = (p, radius, addIdle, addActive) => {
    if (p.__psInit) return;
    p.__psInit = true;
    p.__psTarget = null;
    p.__psArmed = !!(G.shiftDown || G.ctrlDown || G.metaDown || G.altDown);
    p.__psRadius = radius;
    p.__psAddIdle = addIdle;
    p.__psAddActive = addActive ?? addIdle;
    p.__psPulseCd = 0;
  };

  const lockTargetIfArmed = (p) => {
    if (!p.__psArmed || typeof p.__psTarget === "string") return;
    const r = p.__psRadius | 0;

    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const n = getPx(p.x + dx, p.y + dy);
        if (!n || !isFluidish(n)) continue;
        if (n.element === ID.PRESSURIZER || n.element === ID.PRESSURE_PLATE) continue;
        p.__psTarget = n.element;
        return;
      }
    }

    p.__psTarget = null;
  };

  const machineAffect = (p, amt) => {
    const r = p.__psRadius | 0;
    const t = typeof p.__psTarget === "string" ? p.__psTarget : null;

    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const n = getPx(p.x + dx, p.y + dy);
        if (!n || !isFluidish(n)) continue;
        if (t && n.element !== t) continue;

        addPr(n, amt);

        if (n.element === "water" || n.element === ID.PRESSURIZED_WATER) {
          setLock(n, true);
          if (prOf(n) >= CFG.PROMOTE_P) changeTo(n, ID.PRESSURIZED_WATER);
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
    if (p.__psPulseCd > 0) return;
    p.__psPulseCd = CFG.PLATE_PULSE_CD;

    const pow = clamp(power, 60, 520);
    blastImpulse(p.x, p.y - 1, pow);

    for (let i = 0; i < 8; i += 1) {
      const d = DIR8[i];
      const sx = p.x + d[0];
      const sy = p.y + d[1];
      if (!inBounds(sx, sy)) continue;
      if (isEmptyAt(sx, sy, false)) spawnWave(sx, sy, d[0], d[1], pow * 0.6);
    }
  };

  const pressurizerTick = (p) => {
    initMachine(p, CFG.PRESSURIZER_RADIUS, CFG.PRESSURIZER_ADD, CFG.PRESSURIZER_ADD);
    lockTargetIfArmed(p);
    machineAffect(p, p.__psAddIdle);
    if (isFn("doDefaults")) G.doDefaults(p);
  };

  const pressurePlateTick = (p) => {
    initMachine(p, CFG.PLATE_RADIUS, CFG.PLATE_IDLE_ADD, CFG.PLATE_ACTIVE_ADD);
    lockTargetIfArmed(p);

    if (p.__psPulseCd > 0) p.__psPulseCd -= 1;

    const active = anyPressingPlate(p);
    const amt = active ? p.__psAddActive : p.__psAddIdle;

    machineAffect(p, amt);

    if (active) {
      const src = getPx(p.x, p.y - 1);
      const localPow = prOf(src) + prOf(p) + amt * 50;
      platePulse(p, localPow);
    }

    if (isFn("doDefaults")) G.doDefaults(p);
  };

  const waterBehavior = elements.water?.behavior || behaviors.LIQUID;

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
    density: (elements.water?.density ?? 1000) + 160,
    viscosity: (elements.water?.viscosity ?? 1) * 1.55,
    onCreate: pressurizedWaterOnCreate,
    tick: function (p) {
      if (!p) return;
      setLock(p, true);
      if (isPerm(p) && prOf(p) < CFG.PERM_MIN_P) setPr(p, CFG.PERM_MIN_P);
      pressureCore(p, "water");
      waterReactionTick(p);
      if (isFn("doDefaults")) G.doDefaults(p);
    },
  };

  elements[ID.PRESSURIZER] = {
    color: ["#2cffcf", "#00ffa2", "#00c8ff"],
    behavior: behaviors.WALL,
    category: CFG.CAT,
    state: "solid",
    density: 3400,
    hardness: 0.92,
    insulate: true,
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
    tick: pressurePlateTick,
  };

  elements[ID.TOOL_PRESSURIZE] = {
    color: ["#2cffcf", "#00ffa2", "#00c8ff"],
    category: "tools",
    tool: function (p) {
      pressurizeApply(p);
    },
  };

  elements[ID.TOOL_DEPRESSURIZE] = {
    color: ["#ffd6ff", "#ff9ee0", "#ff7ab3"],
    category: "tools",
    tool: function (p) {
      depressurizeApply(p);
    },
  };

  wrapTick("water", (p) => {
    if (!p) return;
    if (pumpOf(p) > 0 || hasLock(p) || p.element === ID.PRESSURIZED_WATER) pressureCore(p, "water");
    else {
      if (prOf(p) > 0) setPr(p, prOf(p) * 0.95 - 0.35);
    }
  });

  wrapTick("steam", (p) => {
    if (!p) return;
    pressureCore(p, "steam");
  });
})();
