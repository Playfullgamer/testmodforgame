/* =========================
   FIX: NO MORE “BLOCK PLACING”
   + make ALL disaster tools work on drag
   + FIX TSUNAMI (surge events)
   Paste near bottom of runAfterLoad(...)
   ========================= */

// 1) Process "surge" events (this is why tsunami didn't work)
if (!ND.__surgePatched) {
  ND.__surgePatched = true;
  runEveryTick(function () {
    for (const ev of ND.events) {
      if (!ev || ev.done) continue;
      if (ev.type !== "surge") continue;

      // advance timer
      ev.t = (ev.t ?? 0) + 1;

      // run surge physics
      tickSurge(ev);

      // end
      if (ev.duration && ev.t >= ev.duration) ev.done = true;
    }
  });
}

// 2) Convert every "*_tool" in the Natural Disasters category into a real tool.
//    (No pixel placement. Dragging triggers the disaster instead.)
(function () {
  const BR = () => ND.brush();
  const SHIFT = () => ND.isShift();

  function ensureTool(id, cdKey, cdTicks, run) {
    const el = elements[id];
    if (!el) return;

    el.canPlace = false;
    el.excludeRandom = true;
    el.noMix = true;

    // Replace BOTH click + drag with the same behavior
    el.onMouseDown = function (e) {
      if (!ND.canTrigger(cdKey, cdTicks)) return;
      const p = ND.posFromEvent(e);
      run(p.x, p.y);
    };

    el.tool = function (pixel) {
      if (!ND.canTrigger(cdKey, cdTicks)) return;
      // when dragging, pixel is the brush-cell being hit
      const x = pixel?.x ?? mousePos?.x ?? Math.floor(width / 2);
      const y = pixel?.y ?? mousePos?.y ?? Math.floor(height / 2);
      run(x, y);
    };
  }

  // --- Spawn helpers matching your mod formulas ---
  function spawnThunderstorm(x) {
    const span = ND.clamp(80 + BR() * 18, 70, width - 2);
    const rainRate = ND.clamp(14 + Math.floor(BR() * 2.0), 12, 140);
    const windDir = (Math.random() < 0.5 ? -1 : 1);
    const windStrength = ND.clamp(0.9 + BR() / 10, 0.7, 2.2);

    addStorm({
      type: "thunderstorm",
      x, span,
      rainRate,
      hailRate: SHIFT() ? ND.clamp(10 + Math.floor(BR() * 1.7), 10, 120) : 0,
      windDir, windStrength,
      lightningFreq: ND.clamp(0.03 + BR() / 900, 0.03, 0.12),
      lightningPower: ND.clamp(0.9 + BR() / 20, 0.9, 2.0),
      duration: 260 + (SHIFT() ? 260 : 0),
      t: 0
    });
  }

  function spawnHurricane(x) {
    const span = ND.clamp(160 + BR() * 28, 140, width - 2);
    const rainRate = ND.clamp(30 + Math.floor(BR() * 2.8), 30, 220);
    const windDir = (x < width / 2) ? 1 : -1;
    const windStrength = ND.clamp(1.3 + BR() / 8 + (SHIFT() ? 0.9 : 0), 1.2, 3.0);

    addStorm({
      type: "hurricane",
      x, span,
      rainRate,
      windDir,
      windStrength,
      lightningFreq: ND.clamp(0.02 + BR() / 1200, 0.02, 0.08),
      lightningPower: ND.clamp(1.1 + BR() / 18, 1.1, 2.4),
      tornadoFreq: ND.clamp(0.005 + windStrength / 900, 0.005, 0.02),
      surge: {
        type: "surge",
        dir: windDir,
        waveHeight: ND.clamp(22 + BR() * 4 + (SHIFT() ? 18 : 0), 16, height - 2),
        rate: ND.clamp(18 + Math.floor(BR() * 2.4), 18, 120),
        elemName: "nd_surge_water",
        duration: 140 + (SHIFT() ? 90 : 0),
        t: 0
      },
      duration: 420 + (SHIFT() ? 420 : 0),
      t: 0
    });
  }

  function spawnBlizzard(x) {
    addStorm({
      type: "blizzard",
      x,
      span: ND.clamp(110 + BR() * 22, 90, width - 2),
      snowRate: ND.clamp(18 + Math.floor(BR() * 2.4), 18, 180),
      windDir: (Math.random() < 0.5 ? -1 : 1),
      windStrength: ND.clamp(1.2 + BR() / 10 + (SHIFT() ? 0.7 : 0), 1.0, 3.0),
      coldPower: ND.clamp(1.8 + BR() / 14 + (SHIFT() ? 1.2 : 0), 1.8, 5.0),
      duration: 340 + (SHIFT() ? 380 : 0),
      t: 0
    });
  }

  function spawnHailstorm(x) {
    addStorm({
      type: "hailstorm",
      x,
      span: ND.clamp(90 + BR() * 20, 80, width - 2),
      hailRate: ND.clamp(18 + Math.floor(BR() * 2.8) + (SHIFT() ? 30 : 0), 18, 240),
      windDir: (Math.random() < 0.5 ? -1 : 1),
      windStrength: ND.clamp(0.9 + BR() / 12, 0.8, 2.2),
      duration: 220 + (SHIFT() ? 240 : 0),
      t: 0
    });
  }

  function spawnDuststorm(x) {
    addStorm({
      type: "duststorm",
      x,
      span: ND.clamp(120 + BR() * 28, 100, width - 2),
      rate: ND.clamp(18 + Math.floor(BR() * 2.2), 18, 200),
      windDir: (Math.random() < 0.5 ? -1 : 1),
      windStrength: ND.clamp(1.2 + BR() / 10 + (SHIFT() ? 0.9 : 0), 1.1, 3.2),
      duration: 260 + (SHIFT() ? 300 : 0),
      t: 0
    });
  }

  function spawnHeatwave(x, y) {
    ND.events.push({
      type: "heatwave",
      x, y,
      r: ND.clamp(35 + BR() * 8, 35, 220),
      heat: ND.clamp(0.9 + BR() / 25 + (SHIFT() ? 1.0 : 0), 0.8, 3.4),
      intensity: ND.clamp(1.0 + BR() / 10 + (SHIFT() ? 1.2 : 0), 1.0, 4.0),
      duration: 320 + (SHIFT() ? 420 : 0),
      t: 0
    });
  }

  function spawnWildfire(x, y) {
    ND.events.push({
      type: "wildfire",
      x, y,
      r: ND.clamp(18 + BR() * 5, 18, 240),
      wind: (Math.random() < 0.5 ? -1 : 1),
      duration: 320 + (SHIFT() ? 420 : 0),
      t: 0
    });
  }

  function spawnLandslide(x, y) {
    ND.events.push({
      type: "landslide",
      x, y,
      r: ND.clamp(20 + BR() * 6, 20, 260),
      dir: (Math.random() < 0.5 ? -1 : 1),
      duration: 220 + (SHIFT() ? 240 : 0),
      t: 0
    });
  }

  function spawnAvalanche(x, y) {
    ND.events.push({
      type: "avalanche",
      x, y,
      r: ND.clamp(24 + BR() * 7, 24, 300),
      dir: (Math.random() < 0.5 ? -1 : 1),
      duration: 220 + (SHIFT() ? 260 : 0),
      t: 0
    });
  }

  function spawnSinkhole(x, y) {
    ND.events.push({
      type: "sinkhole",
      x, y,
      r: ND.clamp(10 + BR() * 3 + (SHIFT() ? 10 : 0), 10, 180),
      duration: 220 + (SHIFT() ? 220 : 0),
      t: 0
    });
  }

  function spawnAshfall(x) {
    ND.events.push({
      type: "ashfall",
      x,
      span: ND.clamp(120 + BR() * 28, 90, width - 2),
      rate: ND.clamp(18 + Math.floor(BR() * 2.6) + (SHIFT() ? 40 : 0), 18, 240),
      duration: 240 + (SHIFT() ? 320 : 0),
      t: 0
    });
  }

  function spawnPyroclastic(x, y) {
    const count = ND.clamp(40 + BR() * 14 + (SHIFT() ? 120 : 0), 40, 500);
    for (let i = 0; i < count; i++) {
      const px = ND.clamp(x + ND.randi(-6, 6), 2, width - 3);
      const py = ND.clamp(y + ND.randi(-2, 6), 2, height - 3);
      if (isEmpty(px, py)) createPixel("nd_pyroclastic", px, py);
    }
  }

  function spawnMeteor(x, y) {
    spawnMeteorAt(x, y, 1);
  }

  function spawnMeteorShower(x, y) {
    const count = ND.clamp(3 + Math.floor(BR() / 2) + (SHIFT() ? 6 : 0), 3, 24);
    const spread = ND.clamp(80 + BR() * 18, 60, 420);
    for (let i = 0; i < count; i++) {
      const px = ND.clamp(x + Math.floor(ND.rand(-spread, spread)), 2, width - 3);
      const py = ND.clamp(y + Math.floor(ND.rand(-spread / 3, spread / 3)), 2, height - 3);
      spawnMeteorAt(px, py, ND.rand(0.55, 1.15) * (SHIFT() ? 1.15 : 1.0));
    }
  }

  // --- Apply to ALL your disaster tools (no blocks, drag works) ---
  ensureTool("nd_earthquake_tool", "nd_eq", 6, (x, y) => addEarthquake(x, y, quakeMag()));
  ensureTool("nd_tornado_tool", "nd_tor", 8, (x, y) => spawnMegaTornado(x, y, 1));
  ensureTool("nd_tornado_outbreak_tool", "nd_outbreak", 18, (x, y) => {
    const count = ND.clamp(2 + Math.floor(BR() / 2) + (SHIFT() ? 3 : 0), 2, 14);
    const spread = ND.clamp(20 + BR() * 6, 20, 220);
    for (let i = 0; i < count; i++) {
      const px = ND.clamp(x + Math.floor(ND.rand(-spread, spread)), 2, width - 3);
      const py = ND.clamp(y + Math.floor(ND.rand(-15, 15)), 2, height - 3);
      spawnMegaTornado(px, py, ND.rand(0.75, 1.15));
    }
  });

  ensureTool("nd_flood_tool", "nd_flood", 8, (x) => spawnFlood(x));
  ensureTool("nd_tsunami_tool", "nd_tsu", 10, (x) => spawnTsunami(x)); // now works (surge tick patched)

  ensureTool("nd_thunderstorm_tool", "nd_storm", 10, (x) => spawnThunderstorm(x));
  ensureTool("nd_hurricane_tool", "nd_hur", 14, (x) => spawnHurricane(x));
  ensureTool("nd_blizzard_tool", "nd_bliz", 12, (x) => spawnBlizzard(x));
  ensureTool("nd_hailstorm_tool", "nd_hail", 10, (x) => spawnHailstorm(x));
  ensureTool("nd_duststorm_tool", "nd_dust", 10, (x) => spawnDuststorm(x));

  ensureTool("nd_heatwave_tool", "nd_heat", 10, (x, y) => spawnHeatwave(x, y));
  ensureTool("nd_wildfire_tool", "nd_wf", 10, (x, y) => spawnWildfire(x, y));
  ensureTool("nd_landslide_tool", "nd_slide", 10, (x, y) => spawnLandslide(x, y));
  ensureTool("nd_avalanche_tool", "nd_aval", 10, (x, y) => spawnAvalanche(x, y));
  ensureTool("nd_sinkhole_tool", "nd_sink", 12, (x, y) => spawnSinkhole(x, y));

  ensureTool("nd_volcano_tool", "nd_vol", 18, (x, y) => spawnVolcano(x, y));
  ensureTool("nd_ashfall_tool", "nd_ash", 10, (x) => spawnAshfall(x));
  ensureTool("nd_pyroclastic_tool", "nd_pyro", 12, (x, y) => spawnPyroclastic(x, y));

  ensureTool("nd_meteor_tool", "nd_met", 16, (x, y) => spawnMeteor(x, y));
  ensureTool("nd_meteor_shower_tool", "nd_mets", 22, (x, y) => spawnMeteorShower(x, y));
})();
