// Natural Disasters Expanded v3 (Sandboxels mod)
// NEW category: "Natural Disasters"
// Tools: Earthquake, Mega Tornado, Tornado Outbreak, Flood, Tsunami, Thunderstorm, Hurricane,
// Blizzard, Hailstorm, Dust Storm, Heatwave/Drought, Wildfire Front, Landslide, Avalanche,
// Sinkhole, Volcano (eruption + ash), Ashfall, Pyroclastic Flow, Meteor, Meteor Shower

runAfterLoad(function () {
  if (window.__ND_EXPANDED_V3__) return;
  window.__ND_EXPANDED_V3__ = true;

  const ND_CAT = "Natural Disasters";

  const ND = {
    events: [],
    cd: Object.create(null),
    waterList: ["water", "salt_water", "dirty_water", "sugar_water", "seltzer"],
    rand(min, max) { return Math.random() * (max - min) + min; },
    randi(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
    clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
    exists(e) { return !!elements[e]; },
    pickFirst(list, fallback) { for (const e of list) if (this.exists(e)) return e; return fallback; },
    isWater(elem) { return this.waterList.includes(elem); },
    isShift() { return (typeof shiftDown !== "undefined" && !!shiftDown); },
    brush() { return (typeof mouseSize !== "undefined" ? mouseSize : 5) || 5; },
    canTrigger(key, cooldownTicks) {
      const last = this.cd[key] ?? -999999;
      if (pixelTicks - last < cooldownTicks) return false;
      this.cd[key] = pixelTicks;
      return true;
    },
    posFromEvent(e) {
      try {
        const canvas = document.getElementById("game");
        return getMousePos(canvas, e);
      } catch (_) {
        return { x: mousePos?.x ?? 0, y: mousePos?.y ?? 0 };
      }
    },
  };

  // ---------- helpers ----------
  function forCircle(cx, cy, r, fn, samples) {
    const s = samples ?? Math.floor(r * r * 3.5);
    for (let i = 0; i < s; i++) {
      const x = Math.floor(cx + ND.rand(-r, r));
      const y = Math.floor(cy + ND.rand(-r, r));
      if (outOfBounds(x, y)) continue;
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy > r * r) continue;
      fn(x, y, dx, dy);
    }
  }

  function isLightElement(elem) {
    return elem === "smoke" || elem === "dust" || elem === "cloud" || elem === "steam" || elem === "ash";
  }
  function stateOf(elem) { return elements[elem]?.state; }

  function windPush(x1, x2, y1, y2, dir, strength, updraft) {
    // strength ~ 0.2 .. 2.5
    const w = Math.max(1, x2 - x1 + 1);
    const h = Math.max(1, y2 - y1 + 1);
    const samples = Math.floor((w * h) * ND.clamp(0.004 + strength * 0.0025, 0.004, 0.03));
    for (let i = 0; i < samples; i++) {
      const x = ND.randi(x1, x2);
      const y = ND.randi(y1, y2);
      if (outOfBounds(x, y) || isEmpty(x, y, true)) continue;
      const p = pixelMap[x][y];
      if (!p || p.del) continue;

      const info = elements[p.element];
      if (!info || info.category === "tools" || info.movable === false) continue;

      const st = stateOf(p.element);
      let mult = 1;
      if (st === "gas" || isLightElement(p.element)) mult = 2.2;
      else if (st === "liquid") mult = 1.4;
      else mult = 0.7;

      const tries = ND.clamp(Math.floor(strength * mult), 1, 5);
      for (let t = 0; t < tries; t++) {
        // shove sideways, with a little turbulence
        const dx = dir + (Math.random() < 0.10 ? -dir : 0);
        const dy = (Math.random() < 0.07 ? (Math.random() < 0.5 ? -1 : 1) : 0);
        if (tryMove(p, x + dx, y + dy, undefined, true)) break;
      }

      if (updraft > 0 && Math.random() < updraft * (st === "gas" ? 0.35 : 0.10)) {
        tryMove(p, p.x, p.y - 1, undefined, true);
      }
    }
  }

  function lightningStrike(x, startY, maxY, power) {
    const plasmaLike = ND.pickFirst(["plasma", "electric", "fire"], "fire");
    const smokeLike  = ND.pickFirst(["smoke", "ash", "dust"], "smoke");
    const explodeLike = ND.pickFirst(["explosion", "fire"], "fire");

    let y = startY;
    let lx = x;

    // draw bolt path (as heat + sometimes plasma)
    for (let steps = 0; steps < 220 && y < maxY; steps++) {
      if (outOfBounds(lx, y)) break;

      if (Math.random() < 0.60 && isEmpty(lx, y) && ND.exists(smokeLike)) {
        // faint ion trail
        if (Math.random() < 0.10 * power) createPixel(smokeLike, lx, y);
      }

      // move down with jitter
      y += 1;
      if (Math.random() < 0.55) lx += ND.randi(-1, 1);

      if (outOfBounds(lx, y)) break;

      // hit something
      if (!isEmpty(lx, y, true)) {
        const hit = pixelMap[lx][y];
        if (hit && !hit.del) {
          hit.temp = Math.max(hit.temp ?? 0, 600 + 900 * power);
          if (elements[hit.element]?.breakInto && Math.random() < 0.35 * power) breakPixel(hit);
          if (ND.exists(plasmaLike) && Math.random() < 0.25 * power) changePixel(hit, plasmaLike);
        }

        // impact blast
        const R = ND.clamp(Math.floor(2 + 5 * power), 2, 14);
        forCircle(lx, y, R, (px, py, dx, dy) => {
          const dist = Math.hypot(dx, dy);
          const f = 1 - dist / R;
          if (outOfBounds(px, py)) return;

          if (!isEmpty(px, py, true)) {
            const p = pixelMap[px][py];
            if (!p || p.del) return;
            p.temp = Math.max(p.temp ?? 0, 350 + 900 * f * power);
            if (elements[p.element]?.breakInto && Math.random() < 0.12 * f * power) breakPixel(p);
            if (ND.exists(explodeLike) && Math.random() < 0.05 * f * power && isEmpty(px, py)) createPixel(explodeLike, px, py);
          } else {
            if (ND.exists(smokeLike) && Math.random() < 0.10 * f * power) createPixel(smokeLike, px, py);
          }
        }, Math.floor(R * R * 4.5));

        return;
      }
    }
  }

  // ---------- improved tornado ----------
  elements.nd_mega_tornado = {
    name: "Mega Tornado",
    color: ["#6f6f6f", "#7f7f7f", "#5f5f5f"],
    category: "special",
    state: "gas",
    density: 0.03,
    excludeRandom: true,
    noMix: true,
    tick(pixel) {
      if (pixel.nd_init !== 1) {
        pixel.nd_init = 1;
        pixel.life = ND.randi(700, 1200);
        pixel.radius = ND.randi(16, 26);
        pixel.power = ND.clamp(pixel.power ?? 1.2, 0.8, 2.6);
        pixel.vx = Math.random() < 0.5 ? -1 : 1;
      }

      pixel.life--;
      if (pixel.life <= 0) { deletePixel(pixel.x, pixel.y); return; }

      // drift, prefers staying near the ground / structures
      if (Math.random() < 0.02) pixel.vx *= -1;

      let tx = pixel.x + pixel.vx;
      let ty = pixel.y;

      // try to stay near ground contact
      if (!outOfBounds(pixel.x, pixel.y + 1) && isEmpty(pixel.x, pixel.y + 1, true)) ty = pixel.y + 1;
      else if (!outOfBounds(pixel.x, pixel.y - 1) && Math.random() < 0.30) ty = pixel.y - 1;

      if (!outOfBounds(tx, ty)) tryMove(pixel, tx, ty, undefined, true);

      const cx = pixel.x, cy = pixel.y;
      const R = pixel.radius;
      const power = pixel.power;

      // more visible funnel + debris column
      const haze = ND.pickFirst(["dust", "smoke", "cloud", "ash"], "smoke");
      if (ND.exists(haze)) {
        for (let i = 0; i < 3 + Math.floor(power * 2); i++) {
          const x = cx + ND.randi(-2, 2);
          const y = cy + ND.randi(-2, 2);
          if (!outOfBounds(x, y) && isEmpty(x, y) && Math.random() < 0.60) createPixel(haze, x, y);
        }
      }

      // main suction/rotation (WAY stronger)
      const steps = Math.floor(R * R * (6.5 + power * 2.2)); // BIG
      for (let i = 0; i < steps; i++) {
        const x = Math.floor(cx + ND.rand(-R, R));
        const y = Math.floor(cy + ND.rand(-R, R));
        if (outOfBounds(x, y) || isEmpty(x, y, true)) continue;

        const p = pixelMap[x][y];
        if (!p || p === pixel || p.del) continue;

        const info = elements[p.element];
        if (!info || info.category === "tools" || info.movable === false) continue;

        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1 || dist > R) continue;

        const f = 1 - dist / R;
        const st = stateOf(p.element);

        // heavier solids resist a bit
        let resist = 1;
        if (st === "solid") resist = 0.75;
        if (st === "liquid") resist = 1.1;
        if (st === "gas" || isLightElement(p.element)) resist = 1.5;

        const chance = ND.clamp(f * (0.75 + power * 0.55) * resist, 0, 0.98);
        if (Math.random() > chance) continue;

        // tangential spin (perpendicular) + inward pull + strong lift near core
        const tanX = dy > 0 ? 1 : -1;
        const tanY = dx > 0 ? -1 : 1;
        const inX  = dx > 0 ? -1 : 1;
        const inY  = dy > 0 ? -1 : 1;

        let sx = 0, sy = 0;

        if (Math.random() < 0.85) { sx += tanX; sy += tanY; }  // spin
        if (Math.random() < 0.85) { sx += inX;  sy += inY;  }  // pull
        if (Math.random() < (0.30 + 0.55 * f)) sy += -1;        // lift
        if (f > 0.55 && Math.random() < 0.12 * power) sy += -1; // extra lift near center

        // occasionally fling outward after lifting (makes it chaotic)
        if (f > 0.60 && Math.random() < 0.08 * power) {
          sx += -inX;
          sy += (Math.random() < 0.5 ? -1 : 0);
        }

        sx = Math.sign(sx); sy = Math.sign(sy);

        // multiple forced moves makes it actually grab lots of pixels
        const mv = ND.clamp(1 + Math.floor(power * 1.2 + f * 2.0), 1, 5);
        for (let m = 0; m < mv; m++) {
          if (tryMove(p, p.x + sx, p.y + sy, undefined, true)) continue;
          // turbulence wiggle
          if (Math.random() < 0.35) tryMove(p, p.x + ND.randi(-1, 1), p.y + ND.randi(-1, 1), undefined, true);
          break;
        }

        // structural damage near core (break buildings)
        if (f > 0.70 && power > 1.2 && Math.random() < 0.02 * power) {
          if (info.breakInto) breakPixel(p);
        }
      }

      doDefaults(pixel);
    },
  };

  // ---------- water surges ----------
  elements.nd_tsunami_water = {
    name: "Tsunami Water",
    color: ["#2c63ff", "#2a55d8", "#3777ff"],
    category: "liquids",
    state: "liquid",
    density: 1200,
    viscosity: 1,
    behavior: behaviors.LIQUID,
    tick(pixel) {
      if (pixel.nd_init !== 1) {
        pixel.nd_init = 1;
        pixel.dir = pixel.dir ?? (Math.random() < 0.5 ? 1 : -1);
        pixel.life = ND.randi(180, 320);
        pixel.push = ND.clamp(pixel.push ?? 3, 2, 5);
      }
      const dir = pixel.dir;

      // strong horizontal shove (wave front)
      for (let k = 0; k < pixel.push; k++) {
        if (tryMove(pixel, pixel.x + dir, pixel.y, undefined, true)) break;
        if (tryMove(pixel, pixel.x + dir, pixel.y + 1, undefined, true)) break;
        if (tryMove(pixel, pixel.x + dir, pixel.y - 1, undefined, true)) break;
      }

      // churn: occasionally kick up foam/smoke-like
      const foam = ND.pickFirst(["seltzer", "steam", "smoke"], "steam");
      if (ND.exists(foam) && Math.random() < 0.01) {
        const x = pixel.x + ND.randi(-1, 1);
        const y = pixel.y - 1;
        if (!outOfBounds(x, y) && isEmpty(x, y)) createPixel(foam, x, y);
      }

      pixel.life--;
      if (pixel.life <= 0) {
        const base = ND.pickFirst(["salt_water", "water"], "water");
        if (elements[base]) changePixel(pixel, base);
      }
    },
  };

  elements.nd_surge_water = {
    name: "Surge Water",
    color: ["#2f7bff", "#2b6fe6", "#3a86ff"],
    category: "liquids",
    state: "liquid",
    density: 1120,
    viscosity: 2,
    behavior: behaviors.LIQUID,
    tick(pixel) {
      if (pixel.nd_init !== 1) {
        pixel.nd_init = 1;
        pixel.dir = pixel.dir ?? (Math.random() < 0.5 ? 1 : -1);
        pixel.life = ND.randi(260, 520);
        pixel.push = ND.clamp(pixel.push ?? 2, 1, 3);
      }
      if (Math.random() < 0.75) {
        const dir = pixel.dir;
        for (let k = 0; k < pixel.push; k++) {
          if (tryMove(pixel, pixel.x + dir, pixel.y, undefined, true)) break;
          if (tryMove(pixel, pixel.x + dir, pixel.y + 1, undefined, true)) break;
        }
      }
      pixel.life--;
      if (pixel.life <= 0) {
        const base = ND.pickFirst(["dirty_water", "salt_water", "water"], "water");
        if (elements[base]) changePixel(pixel, base);
      }
    },
  };

  // ---------- improved hail ----------
  elements.nd_hailstone = {
    name: "Hailstone",
    color: ["#e9f6ff", "#cfeeff", "#bfe6ff"],
    category: "special",
    state: "solid",
    density: 930,
    excludeRandom: true,
    behavior: behaviors.POWDER,
    tick(pixel) {
      // falls fast + slight bounce
      for (let i = 0; i < 3; i++) {
        if (tryMove(pixel, pixel.x, pixel.y + 1)) continue;
        if (tryMove(pixel, pixel.x + (Math.random() < 0.5 ? -1 : 1), pixel.y + 1)) continue;
        break;
      }

      // impact damage
      if (!outOfBounds(pixel.x, pixel.y + 1) && !isEmpty(pixel.x, pixel.y + 1, true) && Math.random() < 0.10) {
        const p2 = pixelMap[pixel.x][pixel.y + 1];
        const info = p2 ? elements[p2.element] : null;
        if (info?.breakInto && Math.random() < 0.55) breakPixel(p2);
        if (p2) p2.temp = (p2.temp ?? 0) - 1;
      }

      // melt if warm
      if ((pixel.temp ?? -5) > 0 && Math.random() < 0.18) {
        const w = ND.pickFirst(["water", "dirty_water"], "water");
        if (elements[w]) changePixel(pixel, w);
      }

      doDefaults(pixel);
    },
  };

  // ---------- pyroclastic ----------
  elements.nd_pyroclastic = {
    name: "Pyroclastic Flow",
    color: ["#4a4a4a", "#5a4a3a", "#3a3a3a"],
    category: "special",
    state: "solid",
    density: 600, // “powdery” but heavy
    excludeRandom: true,
    behavior: behaviors.POWDER,
    tick(pixel) {
      if (pixel.nd_init !== 1) {
        pixel.nd_init = 1;
        pixel.life = ND.randi(160, 320);
        pixel.temp = Math.max(pixel.temp ?? 0, 500 + ND.randi(0, 300));
      }

      // flows fast downhill + sideways
      for (let i = 0; i < 2; i++) {
        if (tryMove(pixel, pixel.x, pixel.y + 1, undefined, true)) continue;
        if (tryMove(pixel, pixel.x + (Math.random() < 0.5 ? -1 : 1), pixel.y + 1, undefined, true)) continue;
        tryMove(pixel, pixel.x + (Math.random() < 0.5 ? -1 : 1), pixel.y, undefined, true);
      }

      // ignite nearby burnables + heat
      if (typeof adjacentCoords !== "undefined" && Math.random() < 0.35) {
        for (const c of adjacentCoords) {
          const x = pixel.x + c[0], y = pixel.y + c[1];
          if (outOfBounds(x, y) || isEmpty(x, y, true)) continue;
          const p = pixelMap[x][y];
          if (!p || p.del) continue;
          p.temp = Math.max(p.temp ?? 0, 250 + ND.randi(0, 250));
          const info = elements[p.element];
          const burnable = (info?.burn !== undefined && info.burn !== 0) || info?.burnInto || info?.burnTime;
          if (burnable && ND.exists("fire") && Math.random() < 0.06) {
            const fx = x + ND.randi(-1, 1), fy = y - 1;
            if (!outOfBounds(fx, fy) && isEmpty(fx, fy)) createPixel("fire", fx, fy);
          }
        }
      }

      // cool down to ash
      pixel.life--;
      if (pixel.life <= 0) {
        const ash = ND.pickFirst(["ash", "dust"], "dust");
        if (ND.exists(ash)) changePixel(pixel, ash);
      }

      doDefaults(pixel);
    },
  };

  // ---------- volcano vent (stronger: ash + pyroclastic) ----------
  elements.nd_volcano_vent = {
    name: "Volcano Vent",
    color: ["#2f2f2f", "#3b3b3b", "#444444"],
    category: "special",
    state: "solid",
    density: 3000,
    excludeRandom: true,
    noMix: true,
    tick(pixel) {
      if (pixel.nd_init !== 1) {
        pixel.nd_init = 1;
        pixel.life = ND.randi(650, 1400);
        pixel.power = ND.clamp(pixel.power ?? 1.2, 0.8, 2.6);
      }

      pixel.life--;
      if (pixel.life <= 0) { deletePixel(pixel.x, pixel.y); return; }

      const lava = ND.pickFirst(["magma", "lava", "molten_rock"], "lava");
      const ash  = ND.pickFirst(["ash", "dust", "smoke"], "smoke");
      const steam = ND.pickFirst(["steam", "smoke"], "smoke");

      // eruption pulses
      if (Math.random() < 0.16 * pixel.power) {
        // lava spatter
        for (let i = 0; i < Math.floor(3 + 6 * pixel.power); i++) {
          const x = pixel.x + ND.randi(-1, 1);
          const y = pixel.y - 1;
          if (!outOfBounds(x, y) && isEmpty(x, y)) {
            createPixel(lava, x, y);
            const p = pixelMap[x][y];
            if (p) p.temp = Math.max(p.temp ?? 0, 900 + 450 * pixel.power);
          }
        }
        // ash plume
        for (let i = 0; i < Math.floor(10 + 16 * pixel.power); i++) {
          const x = pixel.x + ND.randi(-3, 3);
          const y = pixel.y - ND.randi(3, 14);
          if (!outOfBounds(x, y) && isEmpty(x, y) && ND.exists(ash)) createPixel(ash, x, y);
        }
        // occasional pyroclastic burst
        if (Math.random() < 0.18 * pixel.power) {
          for (let i = 0; i < Math.floor(8 + 14 * pixel.power); i++) {
            const x = pixel.x + ND.randi(-4, 4);
            const y = pixel.y + ND.randi(1, 4);
            if (!outOfBounds(x, y) && isEmpty(x, y)) createPixel("nd_pyroclastic", x, y);
          }
        }
      } else if (Math.random() < 0.06 && ND.exists(steam)) {
        const x = pixel.x + ND.randi(-1, 1);
        const y = pixel.y - 1;
        if (!outOfBounds(x, y) && isEmpty(x, y)) createPixel(steam, x, y);
      }

      doDefaults(pixel);
    },
  };

  // ---------- meteor (heavier + fragments) ----------
  function meteorImpact(x, y, power) {
    const smoke = ND.pickFirst(["smoke", "ash", "dust"], "smoke");
    const fire = ND.pickFirst(["fire", "explosion"], "fire");
    const molten = ND.pickFirst(["molten_rock", "magma", "lava"], "lava");

    const R = ND.clamp(Math.floor(10 + power * 9), 10, 44);

    // crater + heat
    forCircle(x, y, R, (px, py, dx, dy) => {
      const dist = Math.hypot(dx, dy);
      const f = 1 - dist / R;
      if (outOfBounds(px, py)) return;

      if (Math.random() < 0.75 * f) {
        if (!isEmpty(px, py, true)) deletePixel(px, py);
      } else if (!isEmpty(px, py, true)) {
        const p = pixelMap[px][py];
        if (!p || p.del) return;
        p.temp = Math.max(p.temp ?? 0, 600 + 1400 * f * power);
        if (elements[p.element]?.breakInto && Math.random() < 0.18 * f * power) breakPixel(p);
        if (ND.exists(molten) && Math.random() < 0.15 * f * power) changePixel(p, molten);
      } else {
        if (ND.exists(smoke) && Math.random() < 0.10 * f * power) createPixel(smoke, px, py);
      }
    }, Math.floor(R * R * 5.2));

    // fireball
    if (ND.exists(fire)) {
      for (let i = 0; i < Math.floor(40 + power * 70); i++) {
        const px = x + ND.randi(-R, R);
        const py = y + ND.randi(-R, R);
        if (outOfBounds(px, py)) continue;
        if (isEmpty(px, py) && Math.random() < 0.55) createPixel(fire, px, py);
      }
    }

    // fragments (mini meteors as hot rocks)
    const frag = ND.pickFirst(["hot_rock", "rock", "stone"], "rock");
    if (ND.exists(frag)) {
      for (let i = 0; i < Math.floor(8 + power * 16); i++) {
        const px = x + ND.randi(-R, R);
        const py = y + ND.randi(-R, R);
        if (outOfBounds(px, py) || !isEmpty(px, py)) continue;
        createPixel(frag, px, py);
        const p = pixelMap[px][py];
        if (p) p.temp = Math.max(p.temp ?? 0, 300 + ND.randi(0, 600));
      }
    }

    // shock quake
    ND.events.push({ type: "eq", x, y, mag: ND.clamp(5.2 + power * 1.6, 4.8, 8.8), t: 0, duration: 80 + Math.floor(power * 60) });
  }

  elements.nd_meteor = {
    name: "Meteor",
    color: ["#5a4b3b", "#6a5a45", "#3e352b"],
    category: "special",
    state: "solid",
    density: 9000,
    excludeRandom: true,
    noMix: true,
    tick(pixel) {
      if (pixel.nd_init !== 1) {
        pixel.nd_init = 1;
        pixel.power = ND.clamp(pixel.power ?? 1.2, 0.8, 3.0);
        pixel.vx = pixel.vx ?? (Math.random() < 0.5 ? 1 : -1);
        pixel.vy = pixel.vy ?? (3 + Math.floor(pixel.power));
        pixel.life = ND.randi(220, 520);
        pixel.temp = Math.max(pixel.temp ?? 0, 1400);
      }

      pixel.life--;
      if (pixel.life <= 0) { deletePixel(pixel.x, pixel.y); return; }

      const steps = 4 + Math.floor(pixel.power);
      for (let i = 0; i < steps; i++) {
        const nx = pixel.x + Math.sign(pixel.vx);
        const ny = pixel.y + Math.sign(pixel.vy);
        if (outOfBounds(nx, ny)) { deletePixel(pixel.x, pixel.y); return; }

        if (!isEmpty(nx, ny, true)) {
          meteorImpact(nx, ny, pixel.power);
          deletePixel(pixel.x, pixel.y);
          return;
        }
        tryMove(pixel, nx, ny, undefined, true);
      }

      // hot trail
      const trail = ND.pickFirst(["smoke", "fire", "plasma"], "smoke");
      if (ND.exists(trail) && Math.random() < 0.55) {
        const x = pixel.x - Math.sign(pixel.vx);
        const y = pixel.y - 1;
        if (!outOfBounds(x, y) && isEmpty(x, y)) createPixel(trail, x, y);
      }

      doDefaults(pixel);
    },
  };

  // ---------- event systems ----------
  function addEarthquake(x, y, mag) {
    ND.events.push({ type: "eq", x, y, mag, t: 0, duration: Math.floor(90 + mag * 35) });
  }

  function tickEarthquake(ev) {
    ev.t++;
    const mag = ev.mag;
    const radius = Math.floor(18 + mag * 7);
    const samples = Math.floor(380 + mag * 220);
    const breakChance = ND.clamp(0.004 + (mag - 5) * 0.003, 0.004, 0.05);
    const dir = (ev.t % 20) < 10 ? 1 : -1;

    for (let i = 0; i < samples; i++) {
      const x = ND.randi(ev.x - radius, ev.x + radius);
      const y = ND.randi(ev.y - radius, ev.y + radius);
      if (outOfBounds(x, y) || isEmpty(x, y, true)) continue;

      const p = pixelMap[x][y];
      if (!p || p.del) continue;

      const info = elements[p.element];
      if (!info || info.category === "tools" || info.movable === false) continue;

      const dx = x - ev.x, dy = y - ev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;
      const f = 1 - dist / radius;

      // shake
      const sx = (Math.random() < 0.5 ? -1 : 1) * dir;
      const sy = (Math.random() < 0.22 ? -1 : 0);
      if (Math.random() < f * 0.95) tryMove(p, x + sx, y + sy, undefined, true);

      // break structures
      if (info.breakInto && Math.random() < f * breakChance) breakPixel(p);

      // liquefaction-ish
      if (mag >= 6.6 && (p.element === "wet_sand" || p.element === "sand" || p.element === "gravel") && ND.exists("mud") && Math.random() < f * 0.03) {
        let nearWater = false;
        if (typeof adjacentCoords !== "undefined") {
          for (const c of adjacentCoords) {
            const nx = x + c[0], ny = y + c[1];
            if (outOfBounds(nx, ny) || isEmpty(nx, ny, true)) continue;
            const e2 = pixelMap[nx][ny]?.element;
            if (e2 && ND.isWater(e2)) { nearWater = true; break; }
          }
        }
        if (nearWater) changePixel(p, "mud");
      }
    }

    if (mag >= 7.2 && ev.t % 10 === 0 && Math.random() < 0.45) {
      // fault crack
      const len = Math.floor(14 + mag * 4);
      const ang = ND.rand(0, Math.PI);
      const dustLike = ND.pickFirst(["dust", "smoke", "ash"], "dust");
      for (let i = -len; i <= len; i++) {
        const x = Math.floor(ev.x + i * Math.cos(ang));
        const y = Math.floor(ev.y + i * Math.sin(ang));
        if (outOfBounds(x, y)) continue;
        if (!isEmpty(x, y, true) && Math.random() < 0.40) {
          const p = pixelMap[x][y];
          if (!p) continue;
          if (elements[p.element]?.breakInto) breakPixel(p);
          else if (Math.random() < 0.55) deletePixel(x, y);
        } else if (isEmpty(x, y) && ND.exists(dustLike) && Math.random() < 0.10) {
          createPixel(dustLike, x, y);
        }
      }
    }

    if (ev.t >= ev.duration) ev.done = true;
  }

  function addStorm(ev) { ND.events.push(ev); }

  function tickRain(ev) {
    const left = ND.clamp(Math.floor(ev.x - ev.span / 2), 1, width - 2);
    const right = ND.clamp(Math.floor(ev.x + ev.span / 2), 1, width - 2);
    const water = ND.pickFirst(["water", "dirty_water"], "water");
    for (let i = 0; i < ev.rainRate; i++) {
      const x = ND.randi(left, right);
      const y = ND.randi(1, 4);
      if (!outOfBounds(x, y) && isEmpty(x, y)) createPixel(water, x, y);
    }
  }

  function tickSnow(ev) {
    const left = ND.clamp(Math.floor(ev.x - ev.span / 2), 1, width - 2);
    const right = ND.clamp(Math.floor(ev.x + ev.span / 2), 1, width - 2);
    const snow = ND.pickFirst(["snow"], "snow");
    const cold = ND.pickFirst(["cold_air", "air"], "air");
    for (let i = 0; i < ev.snowRate; i++) {
      const x = ND.randi(left, right);
      const y = ND.randi(1, 5);
      if (!outOfBounds(x, y) && isEmpty(x, y) && ND.exists(snow)) createPixel(snow, x, y);
      if (!outOfBounds(x, y) && isEmpty(x, y) && ND.exists(cold) && Math.random() < 0.20) createPixel(cold, x, y);
    }

    // strong cooling
    const r = Math.floor(ev.span / 4);
    forCircle(ev.x, Math.floor(height / 2), r, (x, y) => {
      if (isEmpty(x, y, true)) return;
      const p = pixelMap[x][y];
      if (!p || p.del) return;
      p.temp = (p.temp ?? 0) - (1.5 + ev.coldPower);
    }, Math.floor(r * r * 2.1));
  }

  function tickHail(ev) {
    const left = ND.clamp(Math.floor(ev.x - ev.span / 2), 1, width - 2);
    const right = ND.clamp(Math.floor(ev.x + ev.span / 2), 1, width - 2);
    for (let i = 0; i < ev.hailRate; i++) {
      const x = ND.randi(left, right);
      const y = ND.randi(1, 4);
      if (!outOfBounds(x, y) && isEmpty(x, y)) {
        createPixel("nd_hailstone", x, y);
        const p = pixelMap[x][y];
        if (p) p.temp = -6;
      }
    }
  }

  function tickSurge(ev) {
    const edgeX = ev.dir === 1 ? 1 : width - 2;
    const h = ND.clamp(ev.waveHeight, 6, height - 2);
    const topY = ND.clamp(height - h, 1, height - 2);
    for (let i = 0; i < ev.rate; i++) {
      const y = ND.randi(topY, height - 2);
      if (outOfBounds(edgeX, y) || !isEmpty(edgeX, y)) continue;
      createPixel(ev.elemName, edgeX, y);
      const p = pixelMap[edgeX][y];
      if (p) {
        p.dir = ev.dir;
        p.push = (ev.elemName === "nd_tsunami_water") ? 3 : 2;
      }
    }
  }

  function tickWildfire(ev) {
    const fire = ND.pickFirst(["fire"], "fire");
    const smoke = ND.pickFirst(["smoke", "ash", "dust"], "smoke");
    const samples = Math.floor(ev.r * ev.r * 4.2);

    forCircle(ev.x, ev.y, ev.r, (x, y) => {
      if (isEmpty(x, y, true)) return;
      const p = pixelMap[x][y];
      if (!p || p.del) return;

      const info = elements[p.element];
      if (!info) return;

      const burnable = (info.burn !== undefined && info.burn !== 0) || info.burnInto || info.burnTime;
      if (!burnable) return;

      // wind-driven fire front
      const fx = x + (Math.random() < 0.70 ? ev.wind : 0);
      const fy = y - ND.randi(0, 1);
      if (!outOfBounds(fx, fy) && isEmpty(fx, fy) && ND.exists(fire) && Math.random() < 0.18) createPixel(fire, fx, fy);

      p.temp = Math.max(p.temp ?? 0, 280 + ND.randi(0, 350));

      if (ND.exists(smoke) && Math.random() < 0.03) {
        const sx = x + ND.randi(-1, 1);
        const sy = y - ND.randi(1, 3);
        if (!outOfBounds(sx, sy) && isEmpty(sx, sy)) createPixel(smoke, sx, sy);
      }
    }, samples);
  }

  function tickLandslide(ev, snowOnly) {
    const loose = new Set([
      "sand","wet_sand","gravel","dirt","mud","silt","clay","snow","ash","powder","sawdust","salt"
    ]);
    const icey = new Set(["ice","packed_snow"]);
    const samples = Math.floor(ev.r * ev.r * 4.6);

    forCircle(ev.x, ev.y, ev.r, (x, y) => {
      if (isEmpty(x, y, true)) return;
      const p = pixelMap[x][y];
      if (!p || p.del) return;

      const e = p.element;
      if (snowOnly) {
        if (!(e === "snow" || icey.has(e))) return;
      }

      const st = stateOf(e);
      const canMove = loose.has(e) || st === "powder" || (snowOnly && icey.has(e));
      if (!canMove) return;

      // strong downhill bias + sideways drift
      const side = (Math.random() < 0.7 ? ev.dir : -ev.dir);
      if (!tryMove(p, x, y + 1, undefined, true)) {
        if (!tryMove(p, x + side, y + 1, undefined, true)) {
          tryMove(p, x + side, y, undefined, true);
        }
      }
    }, samples);
  }

  function tickSinkhole(ev) {
    ev.t++;
    const r = ND.clamp(ev.r + Math.floor(ev.t / 20), ev.r, ev.r + 10);
    const dust = ND.pickFirst(["dust", "smoke", "ash"], "dust");
    forCircle(ev.x, ev.y, r, (x, y, dx, dy) => {
      const dist = Math.hypot(dx, dy);
      const f = 1 - dist / r;
      if (outOfBounds(x, y)) return;

      // delete / crumble a lot of ground
      if (!isEmpty(x, y, true) && Math.random() < 0.55 * f) {
        const p = pixelMap[x][y];
        if (!p) return;
        if (elements[p.element]?.breakInto && Math.random() < 0.35) breakPixel(p);
        else deletePixel(x, y);
        if (ND.exists(dust) && Math.random() < 0.12) {
          const sx = x + ND.randi(-1, 1), sy = y - ND.randi(0, 2);
          if (!outOfBounds(sx, sy) && isEmpty(sx, sy)) createPixel(dust, sx, sy);
        }
      }
    }, Math.floor(r * r * 5.2));
  }

  function tickHeatwave(ev) {
    ev.t++;
    const r = ev.r;
    const heat = ev.heat;
    forCircle(ev.x, ev.y, r, (x, y) => {
      if (isEmpty(x, y, true)) return;
      const p = pixelMap[x][y];
      if (!p || p.del) return;
      p.temp = (p.temp ?? 0) + heat;

      // dry out soil
      if (p.element === "wet_sand" && ND.exists("sand") && Math.random() < 0.08) changePixel(p, "sand");
      if (p.element === "mud" && ND.exists("dirt") && Math.random() < 0.05) changePixel(p, "dirt");

      // evaporate water
      if (ND.isWater(p.element) && ND.exists("steam") && (p.temp ?? 0) > 110 && Math.random() < 0.10) changePixel(p, "steam");

      // ignite stuff
      const info = elements[p.element];
      const burnable = (info?.burn !== undefined && info.burn !== 0) || info?.burnInto || info?.burnTime;
      if (burnable && ND.exists("fire") && Math.random() < 0.0025 * ev.intensity) {
        const fx = x + ND.randi(-1, 1), fy = y - 1;
        if (!outOfBounds(fx, fy) && isEmpty(fx, fy)) createPixel("fire", fx, fy);
      }
    }, Math.floor(r * r * 3.3));

    if (ev.t >= ev.duration) ev.done = true;
  }

  function tickAshfall(ev) {
    const left = ND.clamp(Math.floor(ev.x - ev.span / 2), 1, width - 2);
    const right = ND.clamp(Math.floor(ev.x + ev.span / 2), 1, width - 2);
    const ash = ND.pickFirst(["ash", "dust"], "dust");
    for (let i = 0; i < ev.rate; i++) {
      const x = ND.randi(left, right);
      const y = ND.randi(1, 5);
      if (!outOfBounds(x, y) && isEmpty(x, y) && ND.exists(ash)) createPixel(ash, x, y);
    }
  }

  function tickND() {
    if (!ND.events.length) return;

    for (const ev of ND.events) {
      if (ev.done) continue;
      ev.t = (ev.t ?? 0) + 1;

      if (ev.type === "eq") tickEarthquake(ev);

      else if (ev.type === "thunderstorm") {
        tickRain(ev);
        windPush(1, width - 2, 1, height - 2, ev.windDir, ev.windStrength, 0.10);
        if (Math.random() < ev.lightningFreq) {
          const lx = ND.clamp(Math.floor(ev.x + ND.rand(-ev.span / 2, ev.span / 2)), 2, width - 3);
          lightningStrike(lx, 1, height - 2, ev.lightningPower);
        }
        if (ev.hailRate > 0 && Math.random() < 0.65) tickHail(ev);
      }

      else if (ev.type === "hurricane") {
        tickRain(ev);
        windPush(1, width - 2, 1, height - 2, ev.windDir, ev.windStrength, 0.18);

        // storm surge pulses
        if (Math.random() < 0.65) tickSurge(ev.surge);

        // occasional spawned tornadoes inside hurricane bands
        if (Math.random() < ev.tornadoFreq) {
          const x = ND.clamp(Math.floor(ev.x + ND.rand(-ev.span / 2, ev.span / 2)), 2, width - 3);
          const y = ND.clamp(height - ND.randi(10, 40), 2, height - 3);
          if (isEmpty(x, y)) {
            createPixel("nd_mega_tornado", x, y);
            const t = pixelMap[x][y];
            if (t) {
              t.power = ND.clamp(1.0 + ev.windStrength / 2, 1.0, 2.4);
              t.radius = ND.clamp(18 + Math.floor(ev.windStrength * 3), 16, 32);
              t.life = ND.randi(450, 900);
            }
          }
        }

        // lightning in hurricanes too
        if (Math.random() < ev.lightningFreq) {
          const lx = ND.clamp(Math.floor(ev.x + ND.rand(-ev.span / 2, ev.span / 2)), 2, width - 3);
          lightningStrike(lx, 1, height - 2, ev.lightningPower);
        }
      }

      else if (ev.type === "blizzard") {
        tickSnow(ev);
        windPush(1, width - 2, 1, height - 2, ev.windDir, ev.windStrength, 0.10);

        // drifting snow piles (push snow sideways near ground)
        const driftSamples = Math.floor(180 + ev.windStrength * 120);
        for (let i = 0; i < driftSamples; i++) {
          const x = ND.randi(2, width - 3);
          const y = ND.randi(Math.floor(height * 0.45), height - 2);
          if (outOfBounds(x, y) || isEmpty(x, y, true)) continue;
          const p = pixelMap[x][y];
          if (!p || p.del) continue;
          if (p.element === "snow" || p.element === "packed_snow") {
            if (Math.random() < 0.55) tryMove(p, x + ev.windDir, y, undefined, true);
          }
        }
      }

      else if (ev.type === "hailstorm") {
        tickHail(ev);
        windPush(1, width - 2, 1, height - 2, ev.windDir, ev.windStrength, 0.05);
      }

      else if (ev.type === "duststorm") {
        // dust spawn + strong wind
        const left = ND.clamp(Math.floor(ev.x - ev.span / 2), 1, width - 2);
        const right = ND.clamp(Math.floor(ev.x + ev.span / 2), 1, width - 2);
        const dust = ND.pickFirst(["dust", "ash", "smoke"], "dust");
        const sand = ND.pickFirst(["sand"], "sand");

        for (let i = 0; i < ev.rate; i++) {
          const x = ND.randi(left, right);
          const y = ND.randi(1, 8);
          if (!outOfBounds(x, y) && isEmpty(x, y) && ND.exists(dust)) createPixel(dust, x, y);
          if (!outOfBounds(x, y) && isEmpty(x, y) && ND.exists(sand) && Math.random() < 0.25) createPixel(sand, x, y);
        }

        windPush(1, width - 2, 1, height - 2, ev.windDir, ev.windStrength, 0.03);
      }

      else if (ev.type === "wildfire") {
        tickWildfire(ev);
        // wind also pushes smoke hard
        windPush(1, width - 2, 1, height - 2, ev.wind, 1.2, 0.12);
      }

      else if (ev.type === "landslide") tickLandslide(ev, false);
      else if (ev.type === "avalanche") tickLandslide(ev, true);
      else if (ev.type === "sinkhole") tickSinkhole(ev);
      else if (ev.type === "heatwave") tickHeatwave(ev);
      else if (ev.type === "ashfall") tickAshfall(ev);

      // timeouts
      if (ev.duration && ev.t >= ev.duration) ev.done = true;
    }

    ND.events = ND.events.filter(e => !e.done);
  }

  runEveryTick(tickND);

  // ---------- spawn helpers ----------
  function quakeMag() {
    let mag = 6.0 + ND.brush() / 9;
    if (ND.isShift()) mag += 2.0;
    return ND.clamp(mag, 4.8, 9.6);
  }

  function spawnMegaTornado(x, y, scaleMult) {
    if (outOfBounds(x, y)) return;
    if (!isEmpty(x, y, true)) deletePixel(x, y);
    createPixel("nd_mega_tornado", x, y);
    const t = pixelMap[x][y];
    if (!t) return;

    const base = ND.brush();
    const strong = ND.isShift();

    const power = ND.clamp((1.1 + base / 14) * (strong ? 1.35 : 1.0) * (scaleMult ?? 1), 0.9, 2.6);
    const radius = ND.clamp(Math.floor((18 + base * 1.7) * (strong ? 1.25 : 1.0) * (scaleMult ?? 1)), 14, 42);
    t.power = power;
    t.radius = radius;
    t.life = ND.randi(650, 1100) + (strong ? 600 : 0);
  }

  function spawnTsunami(fromX) {
    const dir = fromX < width / 2 ? 1 : -1;
    const h = ND.clamp(30 + ND.brush() * 5 + (ND.isShift() ? 24 : 0), 16, height - 2);
    const rate = ND.clamp(14 + Math.floor(ND.brush() * 2.2), 12, 70);
    ND.events.push({ type: "surge", dir, waveHeight: h, rate, t: 0, duration: 110 + (ND.isShift() ? 60 : 0), elemName: "nd_tsunami_water" });
  }

  function spawnFlood(x) {
    const span = ND.clamp(40 + ND.brush() * 10, 30, width - 2);
    const rainRate = ND.clamp(10 + Math.floor(ND.brush() * 1.7), 10, 90);
    ND.events.push({ type: "thunderstorm", x, span, rainRate, hailRate: 0, windDir: (Math.random() < 0.5 ? -1 : 1), windStrength: 0.6, lightningFreq: 0, lightningPower: 0.8, duration: 240 + (ND.isShift() ? 220 : 0) });
  }

  function spawnVolcano(x, y) {
    if (outOfBounds(x, y)) return;

    const r = ND.clamp(4 + Math.floor(ND.brush() / 2), 4, 16);
    const rock = ND.pickFirst(["basalt", "rock", "stone"], "rock");

    // crater + rim
    forCircle(x, y, r, (px, py, dx, dy) => {
      const dist = Math.hypot(dx, dy);
      if (dist < r * 0.55) {
        if (!isEmpty(px, py, true) && Math.random() < 0.70) deletePixel(px, py);
      } else {
        if (!outOfBounds(px, py) && isEmpty(px, py) && ND.exists(rock) && Math.random() < 0.32) createPixel(rock, px, py);
      }
    }, Math.floor(r * r * 6.5));

    if (!isEmpty(x, y, true)) deletePixel(x, y);
    createPixel("nd_volcano_vent", x, y);
    const v = pixelMap[x][y];
    if (v) {
      v.power = ND.clamp(1.0 + ND.brush() / 10 + (ND.isShift() ? 0.9 : 0), 0.8, 2.6);
      v.life = ND.randi(700, 1200) + (ND.isShift() ? 950 : 0);
      v.temp = Math.max(v.temp ?? 0, 900);
    }

    // extra ashfall after placing a volcano
    ND.events.push({
      type: "ashfall",
      x,
      span: ND.clamp(80 + ND.brush() * 18, 60, width - 2),
      rate: ND.clamp(18 + Math.floor(ND.brush() * 2.0), 18, 140),
      duration: 220 + (ND.isShift() ? 260 : 0),
      t: 0
    });
  }

  function spawnMeteorAt(tx, ty, powerMult) {
    const x = ND.clamp(tx + ND.randi(-12, 12), 2, width - 3);
    const y = 2;
    if (!isEmpty(x, y, true)) deletePixel(x, y);
    createPixel("nd_meteor", x, y);
    const m = pixelMap[x][y];
    if (!m) return;

    const base = ND.brush();
    const strong = ND.isShift();
    const power = ND.clamp((1.2 + base / 9) * (strong ? 1.35 : 1.0) * (powerMult ?? 1), 0.9, 3.0);

    m.power = power;
    const dx = tx - x;
    m.vx = dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dx);
    m.vy = 3 + Math.floor(power);
    m.temp = 1600;
  }

  // ---------- TOOLS (category tab) ----------
  elements.nd_earthquake_tool = {
    name: "Earthquake",
    color: "#b58b5a",
    category: ND_CAT,
    canPlace: false,
    desc: "Click/drag. Bigger brush = stronger. Shift = extreme.",
    tool(pixel) { if (ND.canTrigger("eq_drag", 10)) addEarthquake(pixel.x, pixel.y, quakeMag()); },
    onMouseDown(e) { if (ND.canTrigger("eq_click", 18)) { const p = ND.posFromEvent(e); addEarthquake(p.x, p.y, quakeMag()); } },
  };

  elements.nd_tornado_tool = {
    name: "Mega Tornado",
    color: "#6f6f6f",
    category: ND_CAT,
    canPlace: false,
    desc: "Huge tornado that grabs LOTS of pixels. Brush = size. Shift = monster.",
    tool(pixel) { if (ND.canTrigger("tor_drag", 7)) spawnMegaTornado(pixel.x, pixel.y, 1); },
    onMouseDown(e) { if (ND.canTrigger("tor_click", 12)) { const p = ND.posFromEvent(e); spawnMegaTornado(p.x, p.y, 1); } },
  };

  elements.nd_tornado_outbreak_tool = {
    name: "Tornado Outbreak",
    color: "#555555",
    category: ND_CAT,
    canPlace: false,
    desc: "Spawns multiple tornadoes in a line. Brush = count/size. Shift = many.",
    onMouseDown(e) {
      if (!ND.canTrigger("outbreak", 30)) return;
      const p = ND.posFromEvent(e);
      const count = ND.clamp(2 + Math.floor(ND.brush() / 2) + (ND.isShift() ? 3 : 0), 2, 14);
      const spread = ND.clamp(20 + ND.brush() * 6, 20, 220);
      for (let i = 0; i < count; i++) {
        const x = ND.clamp(p.x + Math.floor(ND.rand(-spread, spread)), 2, width - 3);
        const y = ND.clamp(p.y + Math.floor(ND.rand(-15, 15)), 2, height - 3);
        spawnMegaTornado(x, y, ND.rand(0.75, 1.15));
      }
    },
  };

  elements.nd_flood_tool = {
    name: "Flood",
    color: "#2f7bff",
    category: ND_CAT,
    canPlace: false,
    desc: "Heavy rain flooding. Brush = width/intensity. Shift = longer.",
    onMouseDown(e) { if (ND.canTrigger("flood_click", 18)) { const p = ND.posFromEvent(e); spawnFlood(p.x); } },
    tool(pixel) { if (ND.canTrigger("flood_drag", 14)) spawnFlood(pixel.x); },
  };

  elements.nd_tsunami_tool = {
    name: "Tsunami",
    color: "#1f49c7",
    category: ND_CAT,
    canPlace: false,
    desc: "Massive wave from nearest side. Brush = height. Shift = mega.",
    onMouseDown(e) { if (ND.canTrigger("tsu_click", 24)) { const p = ND.posFromEvent(e); spawnTsunami(p.x); } },
    tool(pixel) { if (ND.canTrigger("tsu_drag", 18)) spawnTsunami(pixel.x); },
  };

  elements.nd_thunderstorm_tool = {
    name: "Thunderstorm",
    color: "#6aa6ff",
    category: ND_CAT,
    canPlace: false,
    desc: "Rain + wind + lightning (+ optional hail with Shift). Brush = width/intensity.",
    onMouseDown(e) {
      if (!ND.canTrigger("storm_click", 20)) return;
      const p = ND.posFromEvent(e);
      const span = ND.clamp(80 + ND.brush() * 18, 70, width - 2);
      const rainRate = ND.clamp(14 + Math.floor(ND.brush() * 2.0), 12, 140);
      const windDir = (Math.random() < 0.5 ? -1 : 1);
      const windStrength = ND.clamp(0.9 + ND.brush() / 10, 0.7, 2.2);
      addStorm({
        type: "thunderstorm",
        x: p.x, span,
        rainRate,
        hailRate: ND.isShift() ? ND.clamp(10 + Math.floor(ND.brush() * 1.7), 10, 120) : 0,
        windDir,
        windStrength,
        lightningFreq: ND.clamp(0.03 + ND.brush() / 900, 0.03, 0.12),
        lightningPower: ND.clamp(0.9 + ND.brush() / 20, 0.9, 2.0),
        duration: 260 + (ND.isShift() ? 260 : 0),
        t: 0
      });
    },
  };

  elements.nd_hurricane_tool = {
    name: "Hurricane",
    color: "#3f7bd9",
    category: ND_CAT,
    canPlace: false,
    desc: "Huge wind + rain + storm surge + occasional tornadoes. Brush = size. Shift = category 5.",
    onMouseDown(e) {
      if (!ND.canTrigger("hur_click", 40)) return;
      const p = ND.posFromEvent(e);

      const span = ND.clamp(160 + ND.brush() * 28, 140, width - 2);
      const rainRate = ND.clamp(30 + Math.floor(ND.brush() * 2.8), 30, 220);
      const windDir = (p.x < width / 2) ? 1 : -1;
      const windStrength = ND.clamp(1.3 + ND.brush() / 8 + (ND.isShift() ? 0.9 : 0), 1.2, 3.0);

      addStorm({
        type: "hurricane",
        x: p.x, span,
        rainRate,
        windDir,
        windStrength,
        lightningFreq: ND.clamp(0.02 + ND.brush() / 1200, 0.02, 0.08),
        lightningPower: ND.clamp(1.1 + ND.brush() / 18, 1.1, 2.4),
        tornadoFreq: ND.clamp(0.005 + windStrength / 900, 0.005, 0.02),
        surge: {
          type: "surge",
          dir: windDir,
          waveHeight: ND.clamp(22 + ND.brush() * 4 + (ND.isShift() ? 18 : 0), 16, height - 2),
          rate: ND.clamp(18 + Math.floor(ND.brush() * 2.4), 18, 120),
          elemName: "nd_surge_water",
          t: 0
        },
        duration: 420 + (ND.isShift() ? 420 : 0),
        t: 0
      });
    },
  };

  elements.nd_blizzard_tool = {
    name: "Blizzard",
    color: "#cfeeff",
    category: ND_CAT,
    canPlace: false,
    desc: "Hard wind + snow + big cooling + drifts. Brush = width/intensity. Shift = extreme.",
    onMouseDown(e) {
      if (!ND.canTrigger("bliz_click", 22)) return;
      const p = ND.posFromEvent(e);
      addStorm({
        type: "blizzard",
        x: p.x,
        span: ND.clamp(110 + ND.brush() * 22, 90, width - 2),
        snowRate: ND.clamp(18 + Math.floor(ND.brush() * 2.4), 18, 180),
        windDir: (Math.random() < 0.5 ? -1 : 1),
        windStrength: ND.clamp(1.2 + ND.brush() / 10 + (ND.isShift() ? 0.7 : 0), 1.0, 3.0),
        coldPower: ND.clamp(1.8 + ND.brush() / 14 + (ND.isShift() ? 1.2 : 0), 1.8, 5.0),
        duration: 340 + (ND.isShift() ? 380 : 0),
        t: 0
      });
    },
  };

  elements.nd_hailstorm_tool = {
    name: "Hailstorm",
    color: "#bfe6ff",
    category: ND_CAT,
    canPlace: false,
    desc: "Big damaging hail + wind. Brush = width/intensity. Shift = brutal.",
    onMouseDown(e) {
      if (!ND.canTrigger("hail_click", 18)) return;
      const p = ND.posFromEvent(e);
      addStorm({
        type: "hailstorm",
        x: p.x,
        span: ND.clamp(90 + ND.brush() * 20, 80, width - 2),
        hailRate: ND.clamp(18 + Math.floor(ND.brush() * 2.8) + (ND.isShift() ? 30 : 0), 18, 240),
        windDir: (Math.random() < 0.5 ? -1 : 1),
        windStrength: ND.clamp(0.9 + ND.brush() / 12, 0.8, 2.2),
        duration: 220 + (ND.isShift() ? 240 : 0),
        t: 0
      });
    },
  };

  elements.nd_duststorm_tool = {
    name: "Dust Storm",
    color: "#c2a36a",
    category: ND_CAT,
    canPlace: false,
    desc: "Dust + sand + strong wind. Brush = width/intensity. Shift = extreme.",
    onMouseDown(e) {
      if (!ND.canTrigger("dust_click", 22)) return;
      const p = ND.posFromEvent(e);
      addStorm({
        type: "duststorm",
        x: p.x,
        span: ND.clamp(120 + ND.brush() * 28, 100, width - 2),
        rate: ND.clamp(18 + Math.floor(ND.brush() * 2.2), 18, 200),
        windDir: (Math.random() < 0.5 ? -1 : 1),
        windStrength: ND.clamp(1.2 + ND.brush() / 10 + (ND.isShift() ? 0.9 : 0), 1.1, 3.2),
        duration: 260 + (ND.isShift() ? 300 : 0),
        t: 0
      });
    },
  };

  elements.nd_heatwave_tool = {
    name: "Heatwave / Drought",
    color: "#ffb000",
    category: ND_CAT,
    canPlace: false,
    desc: "Heats area, dries soil, evaporates water, can start fires. Brush = radius. Shift = severe.",
    onMouseDown(e) {
      if (!ND.canTrigger("heat_click", 22)) return;
      const p = ND.posFromEvent(e);
      const r = ND.clamp(35 + ND.brush() * 8, 35, 220);
      ND.events.push({
        type: "heatwave",
        x: p.x, y: p.y,
        r,
        heat: ND.clamp(0.9 + ND.brush() / 25 + (ND.isShift() ? 1.0 : 0), 0.8, 3.4),
        intensity: ND.clamp(1.0 + ND.brush() / 10 + (ND.isShift() ? 1.2 : 0), 1.0, 4.0),
        duration: 320 + (ND.isShift() ? 420 : 0),
        t: 0
      });
    },
  };

  elements.nd_wildfire_tool = {
    name: "Wildfire Front",
    color: "#ff6a00",
    category: ND_CAT,
    canPlace: false,
    desc: "Starts a wind-driven wildfire. Brush = size. Shift = bigger/longer.",
    onMouseDown(e) {
      if (!ND.canTrigger("wf_click", 18)) return;
      const p = ND.posFromEvent(e);
      ND.events.push({
        type: "wildfire",
        x: p.x, y: p.y,
        r: ND.clamp(18 + ND.brush() * 5, 18, 240),
        wind: (Math.random() < 0.5 ? -1 : 1),
        duration: 320 + (ND.isShift() ? 420 : 0),
        t: 0
      });
    },
  };

  elements.nd_landslide_tool = {
    name: "Landslide",
    color: "#8b6b4a",
    category: ND_CAT,
    canPlace: false,
    desc: "Destabilizes terrain. Brush = radius. Shift = stronger/longer.",
    onMouseDown(e) {
      if (!ND.canTrigger("slide_click", 18)) return;
      const p = ND.posFromEvent(e);
      ND.events.push({
        type: "landslide",
        x: p.x, y: p.y,
        r: ND.clamp(20 + ND.brush() * 6, 20, 260),
        dir: (Math.random() < 0.5 ? -1 : 1),
        duration: 220 + (ND.isShift() ? 240 : 0),
        t: 0
      });
    },
  };

  elements.nd_avalanche_tool = {
    name: "Avalanche",
    color: "#e6f6ff",
    category: ND_CAT,
    canPlace: false,
    desc: "Moves snow/ice downhill FAST. Brush = radius. Shift = huge.",
    onMouseDown(e) {
      if (!ND.canTrigger("aval_click", 18)) return;
      const p = ND.posFromEvent(e);
      ND.events.push({
        type: "avalanche",
        x: p.x, y: p.y,
        r: ND.clamp(24 + ND.brush() * 7, 24, 300),
        dir: (Math.random() < 0.5 ? -1 : 1),
        duration: 220 + (ND.isShift() ? 260 : 0),
        t: 0
      });
    },
  };

  elements.nd_sinkhole_tool = {
    name: "Sinkhole",
    color: "#3a2f28",
    category: ND_CAT,
    canPlace: false,
    desc: "Ground collapses into a hole. Brush = radius. Shift = wider/deeper.",
    onMouseDown(e) {
      if (!ND.canTrigger("sink_click", 26)) return;
      const p = ND.posFromEvent(e);
      ND.events.push({
        type: "sinkhole",
        x: p.x, y: p.y,
        r: ND.clamp(10 + ND.brush() * 3 + (ND.isShift() ? 10 : 0), 10, 180),
        duration: 220 + (ND.isShift() ? 220 : 0),
        t: 0
      });
    },
  };

  elements.nd_volcano_tool = {
    name: "Volcano",
    color: "#3b3b3b",
    category: ND_CAT,
    canPlace: false,
    desc: "Creates an erupting vent + ashfall + pyroclastic bursts. Brush = size. Shift = massive.",
    onMouseDown(e) {
      if (!ND.canTrigger("vol_click", 26)) return;
      const p = ND.posFromEvent(e);
      spawnVolcano(p.x, p.y);
    },
  };

  elements.nd_ashfall_tool = {
    name: "Ashfall",
    color: "#777777",
    category: ND_CAT,
    canPlace: false,
    desc: "Drops ash from the sky. Brush = width/intensity. Shift = heavy.",
    onMouseDown(e) {
      if (!ND.canTrigger("ash_click", 18)) return;
      const p = ND.posFromEvent(e);
      ND.events.push({
        type: "ashfall",
        x: p.x,
        span: ND.clamp(120 + ND.brush() * 28, 90, width - 2),
        rate: ND.clamp(18 + Math.floor(ND.brush() * 2.6) + (ND.isShift() ? 40 : 0), 18, 240),
        duration: 240 + (ND.isShift() ? 320 : 0),
        t: 0
      });
    },
  };

  elements.nd_pyroclastic_tool = {
    name: "Pyroclastic Flow",
    color: "#4a4a4a",
    category: ND_CAT,
    canPlace: false,
    desc: "Hot fast ash flow that ignites things. Brush = size. Shift = huge.",
    onMouseDown(e) {
      if (!ND.canTrigger("pyro_click", 18)) return;
      const p = ND.posFromEvent(e);
      const count = ND.clamp(40 + ND.brush() * 14 + (ND.isShift() ? 120 : 0), 40, 500);
      for (let i = 0; i < count; i++) {
        const x = ND.clamp(p.x + ND.randi(-6, 6), 2, width - 3);
        const y = ND.clamp(p.y + ND.randi(-2, 6), 2, height - 3);
        if (isEmpty(x, y)) createPixel("nd_pyroclastic", x, y);
      }
    },
  };

  elements.nd_meteor_tool = {
    name: "Meteor",
    color: "#6a5a45",
    category: ND_CAT,
    canPlace: false,
    desc: "Massive meteor impact (crater + fires + quake). Brush = power. Shift = huge.",
    onMouseDown(e) {
      if (!ND.canTrigger("met_click", 28)) return;
      const p = ND.posFromEvent(e);
      spawnMeteorAt(p.x, p.y, 1);
    },
  };

  elements.nd_meteor_shower_tool = {
    name: "Meteor Shower",
    color: "#8a7a65",
    category: ND_CAT,
    canPlace: false,
    desc: "Multiple meteors across an area. Brush = count/power. Shift = chaos.",
    onMouseDown(e) {
      if (!ND.canTrigger("met_shower", 45)) return;
      const p = ND.posFromEvent(e);
      const count = ND.clamp(3 + Math.floor(ND.brush() / 2) + (ND.isShift() ? 6 : 0), 3, 24);
      const spread = ND.clamp(80 + ND.brush() * 18, 60, 420);
      for (let i = 0; i < count; i++) {
        const x = ND.clamp(p.x + Math.floor(ND.rand(-spread, spread)), 2, width - 3);
        const y = ND.clamp(p.y + Math.floor(ND.rand(-spread / 3, spread / 3)), 2, height - 3);
        spawnMeteorAt(x, y, ND.rand(0.55, 1.15) * (ND.isShift() ? 1.15 : 1.0));
      }
    },
  };
});
