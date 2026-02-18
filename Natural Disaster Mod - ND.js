// Natural Disasters Pack (Sandboxels mod)
// Adds spawnable: Earthquakes, Tornadoes, Floods (rain + surge), Tsunamis
// Brush size controls scale. Hold Shift for stronger versions.

runAfterLoad(function () {
  if (window.__NATURAL_DISASTERS_PACK__) return;
  window.__NATURAL_DISASTERS_PACK__ = true;

  const ND = {
    events: [],
    cd: Object.create(null),
    waterList: ["water", "salt_water", "dirty_water", "sugar_water", "seltzer"],
    rand(min, max) { return Math.random() * (max - min) + min; },
    randi(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
    clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
    exists(e) { return !!elements[e]; },
    pickFirst(list, fallback) {
      for (const e of list) if (this.exists(e)) return e;
      return fallback;
    },
    isWater(elem) { return this.waterList.includes(elem); },
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
    safeCreate(elem, x, y) {
      if (!this.exists(elem)) return false;
      if (outOfBounds(x, y)) return false;
      if (isEmpty(x, y)) { createPixel(elem, x, y); return true; }
      return false;
    },
    safeChange(pixel, elem) {
      if (!pixel || pixel.del) return false;
      if (!this.exists(elem)) return false;
      changePixel(pixel, elem);
      return true;
    },
  };

  // ---------- Disaster elements ----------

  // Tornado vortex (actual moving entity)
  elements.nd_tornado = {
    name: "Tornado Vortex",
    color: ["#7a7a7a", "#8a8a8a", "#6f6f6f"],
    category: "special",
    state: "gas",
    density: 0.05,
    excludeRandom: true,
    noMix: true,
    // No behavior array: this tick fully drives it.
    tick(pixel) {
      // init
      if (pixel.nd_init !== 1) {
        pixel.nd_init = 1;
        pixel.life = ND.randi(500, 900);
        pixel.radius = ND.randi(8, 14);
        pixel.power = ND.clamp(0.7 + (mouseSize || 5) / 30, 0.6, 1.35);
        pixel.vx = Math.random() < 0.5 ? -1 : 1;
        pixel.vy = 0;
      }

      // expire
      pixel.life--;
      if (pixel.life <= 0) { deletePixel(pixel.x, pixel.y); return; }

      // drift (tries to stay near ground/structures)
      if (Math.random() < 0.03) pixel.vx *= -1;
      let tx = pixel.x + pixel.vx;
      let ty = pixel.y;

      // follow “ground”: if empty below, go down; if blocked, climb a bit
      if (!outOfBounds(pixel.x, pixel.y + 1) && isEmpty(pixel.x, pixel.y + 1, true)) ty = pixel.y + 1;
      else if (!outOfBounds(pixel.x, pixel.y - 1) && Math.random() < 0.35) ty = pixel.y - 1;

      if (!outOfBounds(tx, ty)) tryMove(pixel, tx, ty, undefined, true);

      // suction + rotation
      const cx = pixel.x, cy = pixel.y;
      const R = pixel.radius;
      const steps = Math.floor(R * R * (2.2 + pixel.power)); // stronger tornado = more “pull” samples

      for (let i = 0; i < steps; i++) {
        const x = Math.floor(cx + ND.rand(-R, R));
        const y = Math.floor(cy + ND.rand(-R, R));
        if (outOfBounds(x, y) || isEmpty(x, y, true)) continue;

        const p = pixelMap[x][y];
        if (!p || p === pixel || p.del) continue;

        const info = elements[p.element];
        if (!info) continue;
        if (info.category === "tools" || info.movable === false) continue;

        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1 || dist > R) continue;

        const f = 1 - dist / R;               // falloff
        const chance = f * 0.9 * pixel.power; // pull probability

        if (Math.random() > chance) continue;

        // tangential (spin) + inward + upward bias
        const tx2 = dy > 0 ? 1 : -1;
        const ty2 = dx > 0 ? -1 : 1;
        const ix = dx > 0 ? -1 : 1;
        const iy = dy > 0 ? -1 : 1;

        let sx = 0, sy = 0;
        if (Math.random() < 0.65) { sx += tx2; sy += ty2; } // spin
        if (Math.random() < 0.75) { sx += ix;  sy += iy;  } // pull inward
        if (Math.random() < 0.70) { sy += -1; }             // lift

        sx = Math.sign(sx);
        sy = Math.sign(sy);

        // move (force lets it “shove” stuff a bit)
        tryMove(p, x + sx, y + sy, undefined, true);

        // damage: break brittle stuff near the core
        if (f > 0.65 && pixel.power > 0.9 && Math.random() < 0.01 * pixel.power) {
          if (info.breakInto) {
            const b = info.breakInto;
            const ne = Array.isArray(b) ? b[Math.floor(Math.random() * b.length)] : b;
            if (ne && elements[ne]) changePixel(p, ne);
          }
        }
      }

      // little debris haze
      const smokeLike = ND.pickFirst(["dust", "smoke", "cloud"], "smoke");
      if (ND.exists(smokeLike) && Math.random() < 0.06) {
        const x = cx + ND.randi(-1, 1);
        const y = cy + ND.randi(-1, 1);
        if (!outOfBounds(x, y) && isEmpty(x, y)) createPixel(smokeLike, x, y);
      }

      doDefaults(pixel);
    },
  };

  // Tsunami water: water with strong horizontal “push” that decays into normal water
  elements.nd_tsunami_water = {
    name: "Tsunami Water",
    color: ["#2c63ff", "#2a55d8", "#3777ff"],
    category: "liquids",
    state: "liquid",
    density: 1200,
    viscosity: 1,
    behavior: behaviors.LIQUID, // gets converted into tick2 automatically by the engine
    tick(pixel) {
      if (pixel.nd_init !== 1) {
        pixel.nd_init = 1;
        pixel.dir = pixel.dir ?? (Math.random() < 0.5 ? 1 : -1);
        pixel.life = ND.randi(140, 220);
        pixel.push = ND.clamp(pixel.push ?? 2, 1, 3);
      }

      // horizontal shove (multiple attempts = “wave front”)
      const dir = pixel.dir;
      const tries = pixel.push;
      for (let k = 0; k < tries; k++) {
        if (tryMove(pixel, pixel.x + dir, pixel.y, undefined, true)) break;
        if (tryMove(pixel, pixel.x + dir, pixel.y + 1, undefined, true)) break;
        if (tryMove(pixel, pixel.x + dir, pixel.y - 1, undefined, true)) break;
      }

      // decay to normal water
      pixel.life--;
      if (pixel.life <= 0) {
        const base = ND.pickFirst(["salt_water", "water"], "water");
        if (elements[base]) changePixel(pixel, base);
      }
    },
  };

  // Flood surge water: slower push than tsunami
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
        pixel.life = ND.randi(220, 420);
        pixel.push = ND.clamp(pixel.push ?? 1, 1, 2);
      }

      // gentle shove
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

  // ---------- Global events (earthquake + rain/surge) ----------

  function addEarthquake(x, y, mag) {
    ND.events.push({
      type: "eq",
      x, y,
      mag,
      t: 0,
      duration: Math.floor(70 + mag * 30),
    });
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

      // shake impulse: mostly horizontal, slight vertical jolt
      const sx = (Math.random() < 0.5 ? -1 : 1) * dir;
      const sy = (Math.random() < 0.18 ? -1 : 0);
      if (Math.random() < f * 0.9) {
        tryMove(p, x + sx, y + sy, undefined, true);
      }

      // liquefaction-ish: wet sand/gravel near water becomes mud at high magnitudes
      if (mag >= 6.6 && (p.element === "wet_sand" || p.element === "sand" || p.element === "gravel") && Math.random() < f * 0.02) {
        let nearWater = false;
        for (const c of adjacentCoords) {
          const nx = x + c[0], ny = y + c[1];
          if (outOfBounds(nx, ny) || isEmpty(nx, ny, true)) continue;
          const e2 = pixelMap[nx][ny]?.element;
          if (e2 && ND.isWater(e2)) { nearWater = true; break; }
        }
        if (nearWater && ND.exists("mud")) changePixel(p, "mud");
      }

      // structural damage: prefer built-in breakInto when present
      if (info.breakInto && Math.random() < f * breakChance) {
        const b = info.breakInto;
        const ne = Array.isArray(b) ? b[Math.floor(Math.random() * b.length)] : b;
        if (ne && elements[ne]) changePixel(p, ne);
      }
    }

    // occasional fault “crack” (stronger quakes)
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
          const info = elements[p.element];
          if (info?.breakInto) breakPixel(p);
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

  function tickND() {
    if (!ND.events.length) return;
    for (const ev of ND.events) {
      if (ev.done) continue;
      if (ev.type === "eq") tickEarthquake(ev);
      else if (ev.type === "rain") tickRainstorm(ev);
      else if (ev.type === "surge") tickSurge(ev);
    }
    ND.events = ND.events.filter(e => !e.done);
  }

  runEveryTick(tickND);

  // ---------- Tool elements (spawn buttons) ----------

  function magnitudeFromBrush() {
    // simple-ish scale: bigger brush -> bigger quake
    let mag = 5.6 + (mouseSize || 5) / 10;
    if (shiftDown) mag += 1.8;
    return ND.clamp(mag, 4.2, 9.4);
  }

  elements.nd_earthquake_tool = {
    name: "Earthquake",
    color: "#b58b5a",
    category: "tools",
    canPlace: false,
    desc: "Click to trigger an earthquake. Bigger brush = bigger quake. Hold Shift = stronger.",
    tool(pixel) {
      if (!ND.canTrigger("eq_drag", 10)) return;
      addEarthquake(pixel.x, pixel.y, magnitudeFromBrush());
    },
    onMouseDown(e) {
      if (!ND.canTrigger("eq_click", 20)) return;
      const pos = ND.posFromEvent(e);
      addEarthquake(pos.x, pos.y, magnitudeFromBrush());
    },
  };

  elements.nd_tornado_tool = {
    name: "Tornado",
    color: "#777777",
    category: "tools",
    canPlace: false,
    desc: "Click to spawn a tornado vortex. Bigger brush = bigger tornado. Hold Shift = stronger/longer.",
    tool(pixel) {
      if (!ND.canTrigger("tor_drag", 6)) return;
      // spawn near the pixel you touched
      const x = pixel.x, y = pixel.y;
      if (!outOfBounds(x, y)) {
        if (!isEmpty(x, y)) deletePixel(x, y);
        createPixel("nd_tornado", x, y);
        const t = pixelMap[x][y];
        if (t) {
          t.radius = ND.clamp(7 + Math.floor((mouseSize || 5) / 2) + (shiftDown ? 3 : 0), 6, 18);
          t.power = ND.clamp(0.75 + (shiftDown ? 0.35 : 0) + (mouseSize || 5) / 28, 0.6, 1.4);
          t.life = ND.randi(450, 750) + (shiftDown ? 300 : 0);
        }
      }
    },
    onMouseDown(e) {
      if (!ND.canTrigger("tor_click", 12)) return;
      const pos = ND.posFromEvent(e);
      if (!outOfBounds(pos.x, pos.y)) {
        if (!isEmpty(pos.x, pos.y)) deletePixel(pos.x, pos.y);
        createPixel("nd_tornado", pos.x, pos.y);
        const t = pixelMap[pos.x][pos.y];
        if (t) {
          t.radius = ND.clamp(7 + Math.floor((mouseSize || 5) / 2) + (shiftDown ? 3 : 0), 6, 18);
          t.power = ND.clamp(0.75 + (shiftDown ? 0.35 : 0) + (mouseSize || 5) / 28, 0.6, 1.4);
          t.life = ND.randi(450, 750) + (shiftDown ? 300 : 0);
        }
      }
    },
  };

  elements.nd_flood_tool = {
    name: "Flood",
    color: "#2f7bff",
    category: "tools",
    canPlace: false,
    desc: "Click for heavy rain flooding. Hold Shift for a side surge (river/dam-break style). Bigger brush = wider.",
    tool(pixel) {
      if (!ND.canTrigger("flood_drag", 14)) return;
      const span = ND.clamp(30 + (mouseSize || 5) * 6, 20, width - 2);
      addRainstorm(pixel.x, span, ND.clamp(3 + Math.floor((mouseSize || 5) / 2), 3, 14), 220 + (shiftDown ? 200 : 0));
    },
    onMouseDown(e) {
      if (!ND.canTrigger("flood_click", 18)) return;
      const pos = ND.posFromEvent(e);

      if (!shiftDown) {
        const span = ND.clamp(30 + (mouseSize || 5) * 6, 20, width - 2);
        const rate = ND.clamp(4 + Math.floor((mouseSize || 5) / 2), 4, 16);
        addRainstorm(pos.x, span, rate, 260);
      } else {
        // side surge
        const dir = pos.x < width / 2 ? 1 : -1;
        const h = ND.clamp(18 + (mouseSize || 5) * 3, 10, height - 2);
        const rate = ND.clamp(6 + Math.floor((mouseSize || 5) / 2), 6, 20);
        addSurge(dir, h, rate, 120, "nd_surge_water");
      }
    },
  };

  elements.nd_tsunami_tool = {
    name: "Tsunami",
    color: "#1f49c7",
    category: "tools",
    canPlace: false,
    desc: "Click to launch a tsunami from the nearest side. Bigger brush = taller wave. Hold Shift = mega wave.",
    tool(pixel) {
      if (!ND.canTrigger("tsu_drag", 18)) return;
      const dir = pixel.x < width / 2 ? 1 : -1;
      const h = ND.clamp(26 + (mouseSize || 5) * 4 + (shiftDown ? 20 : 0), 14, height - 2);
      const rate = ND.clamp(10 + Math.floor((mouseSize || 5) / 1.5), 10, 38);
      addSurge(dir, h, rate, 90 + (shiftDown ? 40 : 0), "nd_tsunami_water");
    },
    onMouseDown(e) {
      if (!ND.canTrigger("tsu_click", 24)) return;
      const pos = ND.posFromEvent(e);
      const dir = pos.x < width / 2 ? 1 : -1;
      const h = ND.clamp(26 + (mouseSize || 5) * 4 + (shiftDown ? 20 : 0), 14, height - 2);
      const rate = ND.clamp(10 + Math.floor((mouseSize || 5) / 1.5), 10, 38);
      addSurge(dir, h, rate, 90 + (shiftDown ? 40 : 0), "nd_tsunami_water");
    },
  };

});
