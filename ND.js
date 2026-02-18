// Natural Disasters Pack v2 (Sandboxels mod)
// Adds a NEW category: "Natural Disasters" with spawnable disasters.
// Brush size controls scale. Hold Shift for stronger versions.

runAfterLoad(function () {
  if (window.__NATURAL_DISASTERS_PACK_V2__) return;
  window.__NATURAL_DISASTERS_PACK_V2__ = true;

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

  // ---------- Helper: safe sampling circle ----------
  function forCircle(cx, cy, r, fn, samples) {
    const s = samples ?? Math.floor(r * r * 3.2);
    for (let i = 0; i < s; i++) {
      const x = Math.floor(cx + ND.rand(-r, r));
      const y = Math.floor(cy + ND.rand(-r, r));
      if (outOfBounds(x, y)) continue;
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy > r * r) continue;
      fn(x, y, dx, dy);
    }
  }

  // ---------- Tornado element ----------
  elements.nd_tornado = {
    name: "Tornado Vortex",
    color: ["#7a7a7a", "#8a8a8a", "#6f6f6f"],
    category: "special",
    state: "gas",
    density: 0.05,
    excludeRandom: true,
    noMix: true,
    tick(pixel) {
      if (pixel.nd_init !== 1) {
        pixel.nd_init = 1;
        pixel.life = ND.randi(520, 900);
        pixel.radius = ND.randi(8, 14);
        pixel.power = 0.75;
        pixel.vx = Math.random() < 0.5 ? -1 : 1;
      }

      pixel.life--;
      if (pixel.life <= 0) { deletePixel(pixel.x, pixel.y); return; }

      if (Math.random() < 0.03) pixel.vx *= -1;
      let tx = pixel.x + pixel.vx;
      let ty = pixel.y;

      if (!outOfBounds(pixel.x, pixel.y + 1) && isEmpty(pixel.x, pixel.y + 1, true)) ty = pixel.y + 1;
      else if (!outOfBounds(pixel.x, pixel.y - 1) && Math.random() < 0.35) ty = pixel.y - 1;

      if (!outOfBounds(tx, ty)) tryMove(pixel, tx, ty, undefined, true);

      const cx = pixel.x, cy = pixel.y;
      const R = pixel.radius;
      const steps = Math.floor(R * R * (2.2 + pixel.power));

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
        const chance = f * 0.9 * pixel.power;
        if (Math.random() > chance) continue;

        // spin + inward + lift
        const tx2 = dy > 0 ? 1 : -1;
        const ty2 = dx > 0 ? -1 : 1;
        const ix = dx > 0 ? -1 : 1;
        const iy = dy > 0 ? -1 : 1;

        let sx = 0, sy = 0;
        if (Math.random() < 0.65) { sx += tx2; sy += ty2; }
        if (Math.random() < 0.75) { sx += ix;  sy += iy;  }
        if (Math.random() < 0.70) { sy += -1; }

        sx = Math.sign(sx); sy = Math.sign(sy);
        tryMove(p, x + sx, y + sy, undefined, true);

        // light damage near core
        if (f > 0.65 && pixel.power > 0.95 && Math.random() < 0.012 * pixel.power) {
          if (info.breakInto) breakPixel(p);
        }
      }

      const haze = ND.pickFirst(["dust", "smoke", "cloud"], "smoke");
      if (ND.exists(haze) && Math.random() < 0.06) {
        const x = cx + ND.randi(-1, 1);
        const y = cy + ND.randi(-1, 1);
        if (!outOfBounds(x, y) && isEmpty(x, y)) createPixel(haze, x, y);
      }

      doDefaults(pixel);
    },
  };

  // ---------- Tsunami / Surge water ----------
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
        pixel.life = ND.randi(140, 220);
        pixel.push = ND.clamp(pixel.push ?? 2, 1, 3);
      }
      const dir = pixel.dir;
      for (let k = 0; k < pixel.push; k++) {
        if (tryMove(pixel, pixel.x + dir, pixel.y, undefined, true)) break;
        if (tryMove(pixel, pixel.x + dir, pixel.y + 1, undefined, true)) break;
        if (tryMove(pixel, pixel.x + dir, pixel.y - 1, undefined, true)) break;
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
        pixel.life = ND.randi(240, 460);
        pixel.push = ND.clamp(pixel.push ?? 1, 1, 2);
      }
      if (Math.random() < 0.70) {
        const dir = pixel.dir;
        if (!tryMove(pixel, pixel.x + dir, pixel.y, undefined, true)) {
          tryMove(pixel, pixel.x + dir, pixel.y + 1, undefined, true);
        }
      }
      pixel.life--;
      if (pixel.life <= 0) {
        const base = ND.pickFirst(["dirty_water", "salt_water", "water"], "water");
        if (elements[base]) changePixel(pixel, base);
      }
    },
  };

  // ---------- Hail ----------
  elements.nd_hail = {
    name: "Hail",
    color: ["#e9f6ff", "#cfeeff", "#bfe6ff"],
    category: "special",
    state: "solid",
    density: 920,
    excludeRandom: true,
    behavior: behaviors.POWDER,
    tick(pixel) {
      // fall faster
      for (let i = 0; i < 2; i++) {
        if (tryMove(pixel, pixel.x, pixel.y + 1)) continue;
        if (tryMove(pixel, pixel.x + (Math.random() < 0.5 ? -1 : 1), pixel.y + 1)) continue;
        break;
      }

      // impact chip
      if (!outOfBounds(pixel.x, pixel.y + 1) && !isEmpty(pixel.x, pixel.y + 1, true) && Math.random() < 0.03) {
        const p2 = pixelMap[pixel.x][pixel.y + 1];
        const info = p2 ? elements[p2.element] : null;
        if (info?.breakInto && Math.random() < 0.35) breakPixel(p2);
      }

      // melt if warm
      if ((pixel.temp ?? 0) > 0 && Math.random() < 0.12) {
        const w = ND.pickFirst(["water", "dirty_water"], "water");
        if (elements[w]) changePixel(pixel, w);
      }

      doDefaults(pixel);
    },
  };

  // ---------- Volcano vent ----------
  elements.nd_volcano_vent = {
    name: "Volcano Vent",
    color: ["#3b3b3b", "#2f2f2f", "#444444"],
    category: "special",
    state: "solid",
    density: 3000,
    excludeRandom: true,
    noMix: true,
    tick(pixel) {
      if (pixel.nd_init !== 1) {
        pixel.nd_init = 1;
        pixel.life = ND.randi(500, 1100);
        pixel.power = ND.clamp(pixel.power ?? 1, 0.6, 2.2);
      }

      pixel.life--;
      if (pixel.life <= 0) { deletePixel(pixel.x, pixel.y); return; }

      // erupt pulses
      const lava = ND.pickFirst(["magma", "lava", "molten_rock"], "lava");
      const ash  = ND.pickFirst(["ash", "dust", "smoke"], "smoke");
      const steam = ND.pickFirst(["steam", "smoke"], "smoke");

      const pulse = (Math.random() < 0.12 * pixel.power);
      if (pulse) {
        // push lava upward + some sideways
        for (let i = 0; i < Math.floor(2 + 3 * pixel.power); i++) {
          const x = pixel.x + ND.randi(-1, 1);
          const y = pixel.y - 1;
          if (!outOfBounds(x, y) && isEmpty(x, y)) {
            createPixel(lava, x, y);
            const p = pixelMap[x][y];
            if (p) p.temp = Math.max(p.temp ?? 0, 900 + 300 * pixel.power);
          }
        }
        // ash plume
        for (let i = 0; i < Math.floor(3 + 6 * pixel.power); i++) {
          const x = pixel.x + ND.randi(-2, 2);
          const y = pixel.y - ND.randi(2, 6);
          if (!outOfBounds(x, y) && isEmpty(x, y) && ND.exists(ash)) createPixel(ash, x, y);
        }
      } else if (Math.random() < 0.05 && ND.exists(steam)) {
        const x = pixel.x + ND.randi(-1, 1);
        const y = pixel.y - 1;
        if (!outOfBounds(x, y) && isEmpty(x, y)) createPixel(steam, x, y);
      }

      doDefaults(pixel);
    },
  };

  // ---------- Meteor ----------
  function meteorImpact(x, y, power) {
    const fire = ND.pickFirst(["fire", "explosion"], "fire");
    const smoke = ND.pickFirst(["smoke", "dust"], "smoke");
    const molten = ND.pickFirst(["molten_rock", "magma", "lava"], "lava");

    const R = ND.clamp(Math.floor(6 + power * 5), 6, 28);

    // crater / blast
    forCircle(x, y, R, (px, py, dx, dy) => {
      const dist = Math.sqrt(dx*dx + dy*dy);
      const f = 1 - dist / R;

      if (Math.random() < 0.65 * f) {
        if (!isEmpty(px, py, true)) deletePixel(px, py);
      } else if (!isEmpty(px, py, true)) {
        const p = pixelMap[px][py];
        if (!p) return;
        if (Math.random() < 0.20 * f && elements[p.element]?.breakInto) breakPixel(p);
        if (Math.random() < 0.14 * f && ND.exists(molten)) {
          changePixel(p, molten);
          p.temp = Math.max(p.temp ?? 0, 1200);
        } else {
          p.temp = Math.max(p.temp ?? 0, 450);
        }
      } else {
        if (ND.exists(smoke) && Math.random() < 0.10 * f) createPixel(smoke, px, py);
      }
    }, Math.floor(R * R * 5));

    // fireball
    if (ND.exists(fire)) {
      for (let i = 0; i < Math.floor(20 + power * 30); i++) {
        const px = x + ND.randi(-R, R);
        const py = y + ND.randi(-R, R);
        if (outOfBounds(px, py)) continue;
        if (isEmpty(px, py) && Math.random() < 0.5) createPixel(fire, px, py);
      }
    }

    // shockwave quake (small)
    ND.events.push({ type: "eq", x, y, mag: ND.clamp(4.8 + power * 1.2, 4.6, 7.8), t: 0, duration: 60 + Math.floor(power * 40) });
  }

  elements.nd_meteor = {
    name: "Meteor",
    color: ["#5a4b3b", "#6a5a45", "#3e352b"],
    category: "special",
    state: "solid",
    density: 8000,
    excludeRandom: true,
    noMix: true,
    tick(pixel) {
      if (pixel.nd_init !== 1) {
        pixel.nd_init = 1;
        pixel.power = ND.clamp(pixel.power ?? 1.0, 0.6, 2.6);
        pixel.vx = pixel.vx ?? (Math.random() < 0.5 ? 1 : -1);
        pixel.vy = pixel.vy ?? 2;
        pixel.life = ND.randi(250, 500);
        pixel.temp = Math.max(pixel.temp ?? 0, 1200);
      }

      pixel.life--;
      if (pixel.life <= 0) { deletePixel(pixel.x, pixel.y); return; }

      // move multiple steps per tick (fast)
      const steps = 3 + Math.floor(pixel.power);
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

      // heat trail
      const smoke = ND.pickFirst(["smoke", "fire", "plasma"], "smoke");
      if (ND.exists(smoke) && Math.random() < 0.35) {
        const x = pixel.x - Math.sign(pixel.vx);
        const y = pixel.y - 1;
        if (!outOfBounds(x, y) && isEmpty(x, y)) createPixel(smoke, x, y);
      }

      doDefaults(pixel);
    },
  };

  // ---------- Events: Earthquake / Rain / Surge / Wildfire / Blizzard / Hailstorm / Landslide ----------
  function addEarthquake(x, y, mag) {
    ND.events.push({ type: "eq", x, y, mag, t: 0, duration: Math.floor(70 + mag * 30) });
  }

  function tickEarthquake(ev) {
    ev.t++;
    const mag = ev.mag;
    const radius = Math.floor(14 + mag * 6);
    const samples = Math.floor(220 + mag * 140);
    const breakChance = ND.clamp(0.002 + (mag - 5) * 0.002, 0.002, 0.02);
    const dir = (ev.t % 18) < 9 ? 1 : -1;

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

      const sx = (Math.random() < 0.5 ? -1 : 1) * dir;
      const sy = (Math.random() < 0.18 ? -1 : 0);
      if (Math.random() < f * 0.9) tryMove(p, x + sx, y + sy, undefined, true);

      // “liquefaction-ish”: loose soil near water -> mud (big quakes)
      if (mag >= 6.6 && (p.element === "wet_sand" || p.element === "sand" || p.element === "gravel") && Math.random() < f * 0.02) {
        let nearWater = false;
        if (typeof adjacentCoords !== "undefined") {
          for (const c of adjacentCoords) {
            const nx = x + c[0], ny = y + c[1];
            if (outOfBounds(nx, ny) || isEmpty(nx, ny, true)) continue;
            const e2 = pixelMap[nx][ny]?.element;
            if (e2 && ND.isWater(e2)) { nearWater = true; break; }
          }
        }
        if (nearWater && ND.exists("mud")) changePixel(p, "mud");
      }

      if (info.breakInto && Math.random() < f * breakChance) breakPixel(p);
    }

    if (mag >= 7.2 && ev.t % 12 === 0 && Math.random() < 0.35) {
      const len = Math.floor(10 + mag * 3);
      const ang = ND.rand(0, Math.PI);
      const dustLike = ND.pickFirst(["dust", "smoke", "steam"], "smoke");
      for (let i = -len; i <= len; i++) {
        const x = Math.floor(ev.x + i * Math.cos(ang));
        const y = Math.floor(ev.y + i * Math.sin(ang));
        if (outOfBounds(x, y)) continue;
        if (!isEmpty(x, y, true) && Math.random() < 0.35) {
          const p = pixelMap[x][y];
          if (!p) continue;
          if (elements[p.element]?.breakInto) breakPixel(p);
          else if (Math.random() < 0.5) deletePixel(x, y);
        } else if (isEmpty(x, y) && ND.exists(dustLike) && Math.random() < 0.08) {
          createPixel(dustLike, x, y);
        }
      }
    }

    if (ev.t >= ev.duration) ev.done = true;
  }

  function addRainstorm(x, span, rate, duration) {
    ND.events.push({ type: "rain", x, span, rate, t: 0, duration });
  }
  function tickRainstorm(ev) {
    ev.t++;
    const left = ND.clamp(Math.floor(ev.x - ev.span / 2), 1, width - 2);
    const right = ND.clamp(Math.floor(ev.x + ev.span / 2), 1, width - 2);
    const water = ND.pickFirst(["water", "dirty_water"], "water");
    for (let i = 0; i < ev.rate; i++) {
      const x = ND.randi(left, right);
      const y = ND.randi(1, 3);
      if (!outOfBounds(x, y) && isEmpty(x, y)) createPixel(water, x, y);
    }
    if (ev.t >= ev.duration) ev.done = true;
  }

  function addSurge(dir, waveHeight, rate, duration, elemName) {
    ND.events.push({ type: "surge", dir, waveHeight, rate, t: 0, duration, elemName });
  }
  function tickSurge(ev) {
    ev.t++;
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
        p.push = ev.elemName === "nd_tsunami_water" ? 2 : 1;
      }
    }
    if (ev.t >= ev.duration) ev.done = true;
  }

  function addWildfire(x, y, r, duration) {
    ND.events.push({ type: "wildfire", x, y, r, t: 0, duration, wind: (Math.random() < 0.5 ? -1 : 1) });
  }
  function tickWildfire(ev) {
    ev.t++;
    const fire = ND.pickFirst(["fire"], "fire");
    const smoke = ND.pickFirst(["smoke", "dust"], "smoke");
    const samples = Math.floor(ev.r * ev.r * 3.8);

    forCircle(ev.x, ev.y, ev.r, (x, y) => {
      if (isEmpty(x, y, true)) return;
      const p = pixelMap[x][y];
      if (!p || p.del) return;
      const info = elements[p.element];
      if (!info) return;

      // burnable heuristic
      const burnable = (info.burn !== undefined && info.burn !== 0) || info.burnInto || info.burnTime;
      if (!burnable) return;

      // place fire in nearby empty space (lets vanilla fire spread)
      const fx = x + (Math.random() < 0.5 ? 0 : ev.wind);
      const fy = y - ND.randi(0, 1);
      if (!outOfBounds(fx, fy) && isEmpty(fx, fy) && ND.exists(fire) && Math.random() < 0.12) createPixel(fire, fx, fy);

      // heat it up
      p.temp = Math.max(p.temp ?? 0, 200 + ND.randi(0, 250));

      // smoke
      if (ND.exists(smoke) && Math.random() < 0.02) {
        const sx = x + ND.randi(-1, 1);
        const sy = y - ND.randi(1, 3);
        if (!outOfBounds(sx, sy) && isEmpty(sx, sy)) createPixel(smoke, sx, sy);
      }
    }, samples);

    if (ev.t >= ev.duration) ev.done = true;
  }

  function addBlizzard(x, span, rate, duration) {
    ND.events.push({ type: "blizzard", x, span, rate, t: 0, duration });
  }
  function tickBlizzard(ev) {
    ev.t++;
    const left = ND.clamp(Math.floor(ev.x - ev.span / 2), 1, width - 2);
    const right = ND.clamp(Math.floor(ev.x + ev.span / 2), 1, width - 2);
    const snow = ND.pickFirst(["snow"], "snow");
    const cold = ND.pickFirst(["cold_air", "air"], "air");

    // snow fall + cold gusts
    for (let i = 0; i < ev.rate; i++) {
      const x = ND.randi(left, right);
      const y = ND.randi(1, 4);
      if (!outOfBounds(x, y) && isEmpty(x, y) && ND.exists(snow)) createPixel(snow, x, y);
      if (!outOfBounds(x, y) && isEmpty(x, y) && ND.exists(cold) && Math.random() < 0.15) createPixel(cold, x, y);
    }

    // cool an area (freeze water easier)
    const r = Math.floor(ev.span / 5);
    forCircle(ev.x, Math.floor(height / 2), r, (x, y) => {
      if (isEmpty(x, y, true)) return;
      const p = pixelMap[x][y];
      if (!p || p.del) return;
      p.temp = (p.temp ?? 0) - 2.2;
    }, Math.floor(r * r * 2.2));

    if (ev.t >= ev.duration) ev.done = true;
  }

  function addHailstorm(x, span, rate, duration) {
    ND.events.push({ type: "hail", x, span, rate, t: 0, duration });
  }
  function tickHailstorm(ev) {
    ev.t++;
    const left = ND.clamp(Math.floor(ev.x - ev.span / 2), 1, width - 2);
    const right = ND.clamp(Math.floor(ev.x + ev.span / 2), 1, width - 2);
    for (let i = 0; i < ev.rate; i++) {
      const x = ND.randi(left, right);
      const y = ND.randi(1, 4);
      if (!outOfBounds(x, y) && isEmpty(x, y)) {
        createPixel("nd_hail", x, y);
        const p = pixelMap[x][y];
        if (p) p.temp = -5;
      }
    }
    if (ev.t >= ev.duration) ev.done = true;
  }

  function addLandslide(x, y, r, duration) {
    ND.events.push({ type: "slide", x, y, r, t: 0, duration, dir: (Math.random() < 0.5 ? -1 : 1) });
  }
  function tickLandslide(ev) {
    ev.t++;
    const loose = new Set([
      "sand","wet_sand","gravel","dirt","mud","silt","clay","snow","ash","powder","sawdust"
    ]);
    const rockish = new Set(["rock","stone","basalt","concrete","brick"]);

    const samples = Math.floor(ev.r * ev.r * 4.2);
    forCircle(ev.x, ev.y, ev.r, (x, y) => {
      if (isEmpty(x, y, true)) return;
      const p = pixelMap[x][y];
      if (!p || p.del) return;

      const e = p.element;

      // prefer moving loose stuff
      if (loose.has(e) || elements[e]?.state === "powder") {
        // bias downhill + sideways
        if (!tryMove(p, x, y + 1, undefined, true)) {
          const dx = (Math.random() < 0.7 ? ev.dir : -ev.dir);
          tryMove(p, x + dx, y + 1, undefined, true);
        }
      } else if (rockish.has(e) && Math.random() < 0.01) {
        // occasional crumble
        const into = ND.pickFirst(["gravel","sand"], "gravel");
        if (ND.exists(into)) changePixel(p, into);
      }
    }, samples);

    if (ev.t >= ev.duration) ev.done = true;
  }

  function tickND() {
    if (!ND.events.length) return;
    for (const ev of ND.events) {
      if (ev.done) continue;
      if (ev.type === "eq") tickEarthquake(ev);
      else if (ev.type === "rain") tickRainstorm(ev);
      else if (ev.type === "surge") tickSurge(ev);
      else if (ev.type === "wildfire") tickWildfire(ev);
      else if (ev.type === "blizzard") tickBlizzard(ev);
      else if (ev.type === "hail") tickHailstorm(ev);
      else if (ev.type === "slide") tickLandslide(ev);
    }
    ND.events = ND.events.filter(e => !e.done);
  }
  runEveryTick(tickND);

  // ---------- Tool strength helpers ----------
  function quakeMag() {
    let mag = 5.6 + ND.brush() / 10;
    if (ND.isShift()) mag += 1.8;
    return ND.clamp(mag, 4.2, 9.4);
  }
  function big(v, a, b) { return ND.clamp(Math.floor(v), a, b); }

  // ---------- Tools (NEW CATEGORY) ----------
  elements.nd_earthquake_tool = {
    name: "Earthquake",
    color: "#b58b5a",
    category: ND_CAT,
    canPlace: false,
    desc: "Click/drag to trigger shaking. Bigger brush = bigger quake. Hold Shift = stronger.",
    tool(pixel) {
      if (!ND.canTrigger("eq_drag", 10)) return;
      addEarthquake(pixel.x, pixel.y, quakeMag());
    },
    onMouseDown(e) {
      if (!ND.canTrigger("eq_click", 20)) return;
      const pos = ND.posFromEvent(e);
      addEarthquake(pos.x, pos.y, quakeMag());
    },
  };

  elements.nd_tornado_tool = {
    name: "Tornado",
    color: "#777777",
    category: ND_CAT,
    canPlace: false,
    desc: "Click/drag to spawn a tornado. Bigger brush = bigger tornado. Hold Shift = stronger/longer.",
    tool(pixel) {
      if (!ND.canTrigger("tor_drag", 6)) return;
      spawnTornado(pixel.x, pixel.y);
    },
    onMouseDown(e) {
      if (!ND.canTrigger("tor_click", 12)) return;
      const pos = ND.posFromEvent(e);
      spawnTornado(pos.x, pos.y);
    },
  };

  function spawnTornado(x, y) {
    if (outOfBounds(x, y)) return;
    if (!isEmpty(x, y, true)) deletePixel(x, y);
    createPixel("nd_tornado", x, y);
    const t = pixelMap[x][y];
    if (t) {
      t.radius = ND.clamp(7 + Math.floor(ND.brush() / 2) + (ND.isShift() ? 3 : 0), 6, 18);
      t.power  = ND.clamp(0.75 + (ND.isShift() ? 0.40 : 0) + ND.brush() / 28, 0.6, 1.5);
      t.life   = ND.randi(450, 750) + (ND.isShift() ? 340 : 0);
    }
  }

  elements.nd_flood_tool = {
    name: "Flood",
    color: "#2f7bff",
    category: ND_CAT,
    canPlace: false,
    desc: "Click for heavy rain flooding. Hold Shift for side surge (dam-break style). Bigger brush = wider.",
    tool(pixel) {
      if (!ND.canTrigger("flood_drag", 14)) return;
      const span = ND.clamp(30 + ND.brush() * 6, 20, width - 2);
      addRainstorm(pixel.x, span, ND.clamp(3 + Math.floor(ND.brush() / 2), 3, 14), 220 + (ND.isShift() ? 200 : 0));
    },
    onMouseDown(e) {
      if (!ND.canTrigger("flood_click", 18)) return;
      const pos = ND.posFromEvent(e);
      if (!ND.isShift()) {
        const span = ND.clamp(30 + ND.brush() * 6, 20, width - 2);
        const rate = ND.clamp(4 + Math.floor(ND.brush() / 2), 4, 16);
        addRainstorm(pos.x, span, rate, 260);
      } else {
        const dir = pos.x < width / 2 ? 1 : -1;
        const h = ND.clamp(18 + ND.brush() * 3, 10, height - 2);
        const rate = ND.clamp(6 + Math.floor(ND.brush() / 2), 6, 20);
        addSurge(dir, h, rate, 130, "nd_surge_water");
      }
    },
  };

  elements.nd_tsunami_tool = {
    name: "Tsunami",
    color: "#1f49c7",
    category: ND_CAT,
    canPlace: false,
    desc: "Click/drag to launch a tsunami from the nearest side. Bigger brush = taller wave. Hold Shift = mega wave.",
    tool(pixel) {
      if (!ND.canTrigger("tsu_drag", 18)) return;
      spawnTsunami(pixel.x);
    },
    onMouseDown(e) {
      if (!ND.canTrigger("tsu_click", 24)) return;
      const pos = ND.posFromEvent(e);
      spawnTsunami(pos.x);
    },
  };

  function spawnTsunami(x) {
    const dir = x < width / 2 ? 1 : -1;
    const h = ND.clamp(26 + ND.brush() * 4 + (ND.isShift() ? 20 : 0), 14, height - 2);
    const rate = ND.clamp(10 + Math.floor(ND.brush() / 1.5), 10, 38);
    addSurge(dir, h, rate, 90 + (ND.isShift() ? 45 : 0), "nd_tsunami_water");
  }

  elements.nd_volcano_tool = {
    name: "Volcano",
    color: "#3b3b3b",
    category: ND_CAT,
    canPlace: false,
    desc: "Click to spawn an erupting vent. Bigger brush = bigger volcano. Hold Shift = longer/stronger eruption.",
    tool(pixel) {
      if (!ND.canTrigger("vol_drag", 16)) return;
      spawnVolcano(pixel.x, pixel.y);
    },
    onMouseDown(e) {
      if (!ND.canTrigger("vol_click", 22)) return;
      const pos = ND.posFromEvent(e);
      spawnVolcano(pos.x, pos.y);
    },
  };

  function spawnVolcano(x, y) {
    if (outOfBounds(x, y)) return;

    const r = ND.clamp(3 + Math.floor(ND.brush() / 2), 3, 12);
    const rock = ND.pickFirst(["basalt", "rock", "stone"], "rock");

    // carve a tiny crater + build a rim
    forCircle(x, y, r, (px, py) => {
      const d = Math.hypot(px - x, py - y);
      if (d < r * 0.55) {
        if (!isEmpty(px, py, true) && Math.random() < 0.65) deletePixel(px, py);
      } else {
        if (!outOfBounds(px, py) && isEmpty(px, py) && ND.exists(rock) && Math.random() < 0.25) createPixel(rock, px, py);
      }
    }, Math.floor(r * r * 6));

    // vent
    if (!isEmpty(x, y, true)) deletePixel(x, y);
    createPixel("nd_volcano_vent", x, y);
    const v = pixelMap[x][y];
    if (v) {
      v.power = ND.clamp(0.9 + ND.brush() / 10 + (ND.isShift() ? 0.7 : 0), 0.7, 2.2);
      v.life = ND.randi(520, 900) + (ND.isShift() ? 650 : 0);
      v.temp = Math.max(v.temp ?? 0, 700);
    }
  }

  elements.nd_wildfire_tool = {
    name: "Wildfire",
    color: "#ff6a00",
    category: ND_CAT,
    canPlace: false,
    desc: "Click/drag to start a spreading wildfire. Bigger brush = larger fire area. Hold Shift = longer/stronger.",
    tool(pixel) {
      if (!ND.canTrigger("wf_drag", 14)) return;
      startWildfire(pixel.x, pixel.y);
    },
    onMouseDown(e) {
      if (!ND.canTrigger("wf_click", 18)) return;
      const pos = ND.posFromEvent(e);
      startWildfire(pos.x, pos.y);
    },
  };

  function startWildfire(x, y) {
    const r = ND.clamp(10 + ND.brush() * 2, 10, 80);
    const dur = 260 + (ND.isShift() ? 360 : 0);
    addWildfire(x, y, r, dur);
  }

  elements.nd_blizzard_tool = {
    name: "Blizzard",
    color: "#cfeeff",
    category: ND_CAT,
    canPlace: false,
    desc: "Click to spawn heavy snow + cold. Bigger brush = wider storm. Hold Shift = longer/stronger.",
    onMouseDown(e) {
      if (!ND.canTrigger("bliz_click", 20)) return;
      const pos = ND.posFromEvent(e);
      const span = ND.clamp(40 + ND.brush() * 10, 40, width - 2);
      const rate = ND.clamp(10 + Math.floor(ND.brush() * 1.2), 10, 60);
      const dur = 220 + (ND.isShift() ? 260 : 0);
      addBlizzard(pos.x, span, rate, dur);
    },
    tool(pixel) {
      if (!ND.canTrigger("bliz_drag", 14)) return;
      const span = ND.clamp(40 + ND.brush() * 10, 40, width - 2);
      const rate = ND.clamp(10 + Math.floor(ND.brush() * 1.2), 10, 60);
      addBlizzard(pixel.x, span, rate, 160);
    },
  };

  elements.nd_hailstorm_tool = {
    name: "Hailstorm",
    color: "#bfe6ff",
    category: ND_CAT,
    canPlace: false,
    desc: "Click to spawn hail. Bigger brush = wider storm. Hold Shift = longer/denser.",
    onMouseDown(e) {
      if (!ND.canTrigger("hail_click", 18)) return;
      const pos = ND.posFromEvent(e);
      const span = ND.clamp(40 + ND.brush() * 10, 40, width - 2);
      const rate = ND.clamp(10 + Math.floor(ND.brush() * 1.5), 10, 80);
      const dur = 160 + (ND.isShift() ? 220 : 0);
      addHailstorm(pos.x, span, rate, dur);
    },
    tool(pixel) {
      if (!ND.canTrigger("hail_drag", 12)) return;
      const span = ND.clamp(40 + ND.brush() * 10, 40, width - 2);
      const rate = ND.clamp(8 + Math.floor(ND.brush() * 1.2), 8, 70);
      addHailstorm(pixel.x, span, rate, 110);
    },
  };

  elements.nd_landslide_tool = {
    name: "Landslide",
    color: "#8b6b4a",
    category: ND_CAT,
    canPlace: false,
    desc: "Click/drag to destabilize terrain. Bigger brush = bigger slide. Hold Shift = longer/stronger.",
    tool(pixel) {
      if (!ND.canTrigger("slide_drag", 12)) return;
      startSlide(pixel.x, pixel.y);
    },
    onMouseDown(e) {
      if (!ND.canTrigger("slide_click", 18)) return;
      const pos = ND.posFromEvent(e);
      startSlide(pos.x, pos.y);
    },
  };

  function startSlide(x, y) {
    const r = ND.clamp(10 + ND.brush() * 2, 10, 90);
    const dur = 160 + (ND.isShift() ? 260 : 0);
    addLandslide(x, y, r, dur);
  }

  elements.nd_meteor_tool = {
    name: "Meteor",
    color: "#6a5a45",
    category: ND_CAT,
    canPlace: false,
    desc: "Click to call a meteor strike from above. Bigger brush = bigger impact. Hold Shift = massive.",
    onMouseDown(e) {
      if (!ND.canTrigger("met_click", 26)) return;
      const pos = ND.posFromEvent(e);
      spawnMeteorAt(pos.x, pos.y);
    },
    tool(pixel) {
      if (!ND.canTrigger("met_drag", 18)) return;
      spawnMeteorAt(pixel.x, pixel.y);
    },
  };

  function spawnMeteorAt(tx, ty) {
    // spawn near top, aimed roughly at target x
    const x = ND.clamp(tx + ND.randi(-10, 10), 2, width - 3);
    const y = 2;
    if (!isEmpty(x, y, true)) deletePixel(x, y);
    createPixel("nd_meteor", x, y);
    const m = pixelMap[x][y];
    if (m) {
      const power = ND.clamp(0.9 + ND.brush() / 10 + (ND.isShift() ? 1.1 : 0), 0.6, 2.6);
      m.power = power;

      // aim: vx direction toward target
      const dx = tx - x;
      m.vx = dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dx);
      m.vy = 2 + Math.floor(power); // always falling fast
      m.temp = 1400;
    }
  }
});
