// noobkit.js v8 (Builder Anatomy + Saliva Slippery-for-ALL + Better Acid + Bleeding)
// IDs are pg_* to avoid conflicts.
//
// Changes vs v7:
// - Saliva makes ANY movable pixel slide (not just glass_shard) using saliva.tick
// - Removed glass_shard-only patch
// - Stomach still acid-proof + neutralizes acid
// - Acid dissolves many things but NOT: stomach/muscle/intestines (enforced)
// - Soft chunks bleed briefly for realism

(function (main) {
  if (typeof runAfterLoad === "function") runAfterLoad(main);
  else if (document.readyState === "complete") main();
  else window.addEventListener("load", main);
})(function () {
  try {
    if (typeof elements === "undefined" || typeof behaviors === "undefined") {
      console.error("[pg_noobkit] elements/behaviors not ready");
      return;
    }
    console.log("[pg_noobkit] loaded v8");

    // ---------- helpers ----------
    function inBounds(x, y) {
      return !(typeof outOfBounds === "function" && outOfBounds(x, y));
    }
    function empty(x, y) {
      return inBounds(x, y) && (typeof isEmpty === "function" ? isEmpty(x, y) : true);
    }
    function safeCreate(elem, x, y) {
      if (!inBounds(x, y)) return false;
      if (!elements[elem]) return false;
      if (typeof createPixel !== "function") return false;
      if (!empty(x, y)) return false;
      createPixel(elem, x, y);
      return true;
    }
    function safeChange(pixel, elem) {
      if (!elements[elem]) return;
      if (typeof changePixel === "function") changePixel(pixel, elem);
      else pixel.element = elem;
    }
    function safeDeleteAt(x, y) {
      if (typeof deletePixel === "function") {
        deletePixel(x, y);
        return true;
      }
      return false;
    }
    function chance(p) { return Math.random() < p; }

    function getPixel(x, y) {
      if (typeof pixelMap === "undefined" || !pixelMap) return null;
      if (!inBounds(x, y)) return null;
      return pixelMap[x] && pixelMap[x][y] ? pixelMap[x][y] : null;
    }

    const CAT = "anatomy";
    const ASH = elements.ash ? "ash" : null;
    const STEAM = elements.steam ? "steam" : null;

    // ---------- proof marker ----------
    elements.pg_loaded_marker = {
      color: "#ff00ff",
      behavior: behaviors.WALL,
      category: CAT,
      state: "solid",
      density: 9999,
    };

    // ---------- base refs ----------
    const BLOOD = elements.blood ? "blood" : "pg_blood";
    if (!elements[BLOOD]) {
      elements.pg_blood = {
        color: ["#b3001b", "#8f0015", "#cc0020"],
        behavior: behaviors.LIQUID,
        category: "liquids",
        state: "liquid",
        density: 1060,
        viscosity: 18000,
        stain: 0.15,
        tempHigh: 120,
        stateHigh: STEAM || "steam",
      };
    }

    const BONE = elements.bone ? "bone" : "pg_bone";
    if (!elements[BONE]) {
      elements.pg_bone = {
        color: ["#e9e2d1", "#d8cfbb", "#f2ead8"],
        behavior: behaviors.WALL,
        category: "solids",
        state: "solid",
        density: 1900,
        hardness: 0.7,
        breakInto: "pg_bone_dust",
      };
      elements.pg_bone_dust = {
        color: ["#e8e0cf", "#d8cfbb"],
        behavior: behaviors.POWDER,
        category: "powders",
        state: "solid",
        density: 1200,
      };
    }

    // ---------- bleeding helper ----------
    function bleedTick(pixel, strength) {
      pixel._pgBleedAge = (pixel._pgBleedAge || 0) + 1;
      if (pixel._pgBleedAge > 220) return;

      if (chance(strength)) {
        const dirs = [[0,1],[1,0],[-1,0],[0,-1]];
        const pick = dirs[(Math.random() * dirs.length) | 0];
        const nx = pixel.x + pick[0], ny = pixel.y + pick[1];
        if (empty(nx, ny)) safeCreate(BLOOD, nx, ny);
      }
    }

    // ---------- fluids ----------
    elements.pg_saliva = {
      color: ["#e7f6ff", "#d7efff"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1005,
      viscosity: 2500,
      stain: 0.01,
      tick: function (pixel) {
        // Slippery-for-ALL:
        // If something is resting on/next to saliva, nudge it sideways/down-diagonal sometimes.
        // This makes shards/chunks/powders slide like they're lubricated.
        if (typeof tryMove !== "function") return;

        // small chance so it doesn't go crazy
        if (!chance(0.20)) return;

        // Prefer to move the pixel ABOVE the saliva (resting on it)
        const above = getPixel(pixel.x, pixel.y - 1);
        const candidates = [];

        if (above) candidates.push(above);

        // Also sometimes nudge side-adjacent pixels (makes "slippery surface" wider)
        if (chance(0.25)) {
          const left = getPixel(pixel.x - 1, pixel.y);
          const right = getPixel(pixel.x + 1, pixel.y);
          if (left) candidates.push(left);
          if (right) candidates.push(right);
        }

        if (!candidates.length) return;

        const p = candidates[(Math.random() * candidates.length) | 0];
        if (!p) return;

        // Don't push liquids/gases; focus on solids/powders/etc
        const ed = elements[p.element];
        if (!ed) return;
        if (ed.state === "liquid" || ed.state === "gas") return;

        // Avoid double-moving the same pixel in the same global tick (if available)
        if (typeof pixelTicks !== "undefined") {
          if (p._pgSlipTick === pixelTicks) return;
        }

        const dir = chance(0.5) ? 1 : -1;

        // Try down-diagonal first (most "slippery" feel), then sideways
        // NOTE: p might not be at same y as saliva if it's "above" candidate
        const target1 = { x: p.x + dir, y: p.y + 1 };
        const target2 = { x: p.x + dir, y: p.y };

        if (empty(target1.x, target1.y) && tryMove(p, target1.x, target1.y)) {
          if (typeof pixelTicks !== "undefined") p._pgSlipTick = pixelTicks;
          return;
        }
        if (empty(target2.x, target2.y) && tryMove(p, target2.x, target2.y)) {
          if (typeof pixelTicks !== "undefined") p._pgSlipTick = pixelTicks;
        }
      }
    };

    elements.pg_mucus = {
      color: ["#cfe7b0", "#bfe08f", "#d7f0b8"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1030,
      viscosity: 60000,
      stain: 0.04,
    };

    elements.pg_csf = {
      color: ["#d9f2ff", "#c7ecff", "#e8fbff"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1010,
      viscosity: 12000,
      stain: 0.03,
      tempHigh: 105,
      stateHigh: STEAM || "steam",
    };

    elements.pg_bile = {
      color: ["#7aa800", "#94c000", "#6f9a00"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1020,
      viscosity: 18000,
      stain: 0.06,
    };

    elements.pg_slurry = {
      color: ["#6b4b2a", "#845a34", "#5c3f22"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1150,
      viscosity: 25000,
      stain: 0.12,
    };

    elements.pg_dissolved_glass = {
      color: ["#8ed6ff", "#6fc7ff", "#b7e7ff"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1200,
      viscosity: 12000,
      tick: function (pixel) {
        pixel._pgAge = (pixel._pgAge || 0) + 1;
        if (pixel._pgAge > 900 && chance(0.18)) {
          if (elements.sand) safeChange(pixel, "sand");
          else if (elements.glass_shard) safeChange(pixel, "glass_shard");
          else safeChange(pixel, "pg_slurry");
        }
      }
    };

    // ---------- block+chunk maker ----------
    function makeBlockAndChunk(baseId, blockDef, chunkDef, bleedStrength) {
      elements[baseId + "_block"] = Object.assign({
        behavior: behaviors.WALL,
        category: CAT,
        state: "solid",
        breakInto: baseId + "_chunk",
      }, blockDef);

      elements[baseId + "_chunk"] = Object.assign({
        behavior: behaviors.STURDYPOWDER,
        category: CAT,
        state: "solid",
        tick: bleedStrength ? function (pixel) { bleedTick(pixel, bleedStrength); } : undefined,
      }, chunkDef);
    }

    // ---------- tissues ----------
    makeBlockAndChunk("pg_skin", {
      color: ["#f2c6a7", "#e8b996", "#d9a785"],
      density: 1120,
      burn: 6, burnTime: 160, burnInto: ASH || "ash",
    }, {
      color: ["#f2c6a7", "#e8b996", "#d9a785"],
      density: 1100,
    }, 0.015);

    makeBlockAndChunk("pg_muscle", {
      color: ["#b54545", "#c85a5a", "#9c2f2f"],
      density: 1150,
      burn: 7, burnTime: 140, burnInto: ASH || "ash",
    }, {
      color: ["#b54545", "#c85a5a", "#9c2f2f"],
      density: 1120,
    }, 0.02);

    makeBlockAndChunk("pg_fat", {
      color: ["#fff3b0", "#ffe68a", "#fff0a0"],
      density: 920,
      burn: 9, burnTime: 120, burnInto: ASH || "ash",
    }, {
      color: ["#fff3b0", "#ffe68a", "#fff0a0"],
      density: 900,
    }, 0.01);

    makeBlockAndChunk("pg_cartilage", {
      color: ["#d9e2e6", "#c7d0d6", "#eef3f5"],
      density: 1200,
      hardness: 0.25,
    }, {
      color: ["#d9e2e6", "#c7d0d6", "#eef3f5"],
      density: 1180,
    }, 0.004);

    makeBlockAndChunk("pg_tendon", {
      color: ["#efe7d3", "#e3d8bd", "#f7f0de"],
      density: 1250,
      hardness: 0.3,
    }, {
      color: ["#efe7d3", "#e3d8bd", "#f7f0de"],
      density: 1230,
    }, 0.004);

    makeBlockAndChunk("pg_nerve", {
      color: ["#f3e9b4", "#f7f0cf", "#e9dd95"],
      density: 1100,
    }, {
      color: ["#f3e9b4", "#f7f0cf", "#e9dd95"],
      density: 1080,
    }, 0.01);

    // ---------- organs ----------
    makeBlockAndChunk("pg_brain", {
      color: ["#a99aa6", "#bdb0ba", "#948793"],
      density: 1060,
      hardness: 0.12,
      tick: function (pixel) {
        if (chance(0.01)) {
          const dirs = [[0,1],[1,0],[-1,0],[0,-1]];
          for (const d of dirs) {
            const nx = pixel.x + d[0], ny = pixel.y + d[1];
            if (empty(nx, ny)) { safeCreate("pg_csf", nx, ny); break; }
          }
        }
      }
    }, {
      color: ["#a99aa6", "#bdb0ba", "#948793"],
      density: 1040,
    }, 0.02);

    makeBlockAndChunk("pg_heart", {
      color: ["#8c0f1f", "#a31226", "#6e0b17"],
      density: 1120,
      hardness: 0.2,
      tick: function (pixel) {
        if (chance(0.03)) {
          const dirs = [[0,1],[1,0],[-1,0],[0,-1]];
          const pick = dirs[(Math.random() * dirs.length) | 0];
          const nx = pixel.x + pick[0], ny = pixel.y + pick[1];
          if (empty(nx, ny)) safeCreate(BLOOD, nx, ny);
        }
      }
    }, {
      color: ["#8c0f1f", "#a31226", "#6e0b17"],
      density: 1100,
    }, 0.02);

    makeBlockAndChunk("pg_lung", {
      color: ["#c7a0a0", "#d8b1b1", "#b78d8d"],
      density: 980,
      hardness: 0.12,
      tick: function (pixel) {
        if (chance(0.004)) {
          const dirs = [[0,1],[1,0],[-1,0],[0,-1]];
          for (const d of dirs) {
            const nx = pixel.x + d[0], ny = pixel.y + d[1];
            if (empty(nx, ny)) { safeCreate("pg_mucus", nx, ny); break; }
          }
        }
      }
    }, {
      color: ["#c7a0a0", "#d8b1b1", "#b78d8d"],
      density: 950,
    }, 0.015);

    makeBlockAndChunk("pg_liver", {
      color: ["#5b1d1d", "#6d2323", "#4a1717"],
      density: 1180,
      hardness: 0.2,
      tick: function (pixel) {
        if (chance(0.003)) {
          const dirs = [[0,1],[1,0],[-1,0],[0,-1]];
          for (const d of dirs) {
            const nx = pixel.x + d[0], ny = pixel.y + d[1];
            if (empty(nx, ny)) { safeCreate("pg_bile", nx, ny); break; }
          }
        }
      }
    }, {
      color: ["#5b1d1d", "#6d2323", "#4a1717"],
      density: 1160,
    }, 0.015);

    makeBlockAndChunk("pg_kidney", {
      color: ["#8a3d3d", "#9b4a4a", "#6f2f2f"],
      density: 1160,
      hardness: 0.18,
    }, {
      color: ["#8a3d3d", "#9b4a4a", "#6f2f2f"],
      density: 1140,
    }, 0.012);

    makeBlockAndChunk("pg_intestine", {
      color: ["#caa07b", "#d5b08b", "#b88962"],
      density: 1120,
      hardness: 0.16,
      tick: function (pixel) {
        if (chance(0.002)) {
          const dirs = [[0,1],[1,0],[-1,0],[0,-1]];
          for (const d of dirs) {
            const nx = pixel.x + d[0], ny = pixel.y + d[1];
            if (empty(nx, ny)) { safeCreate(chance(0.5) ? "pg_mucus" : "pg_slurry", nx, ny); break; }
          }
        }
      }
    }, {
      color: ["#caa07b", "#d5b08b", "#b88962"],
      density: 1100,
    }, 0.012);

    // ---------- acids ----------
    elements.pg_diluted_acid = {
      color: ["#dfff80", "#cfff6a", "#e9ffb0"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1020,
      viscosity: 7000,
      stain: 0.05,
      tick: function (pixel) {
        pixel._pgAge = (pixel._pgAge || 0) + 1;
        if (pixel._pgAge > 2400 && chance(0.18)) {
          if (!safeDeleteAt(pixel.x, pixel.y)) {
            if (elements.water) safeChange(pixel, "water");
          }
        }
      }
    };

    elements.pg_gastric_acid = {
      color: ["#c9ff3b", "#a8f000", "#d7ff6a"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1040,
      viscosity: 9000,
      stain: 0.10,
      tick: function (pixel) {
        pixel._pgAge = (pixel._pgAge || 0) + 1;

        // extra realism: if acid is dissolving chunks nearby, drip blood sometimes
        if (chance(0.02)) {
          const d = [[0,1],[1,0],[-1,0],[0,-1]][(Math.random() * 4) | 0];
          const p = getPixel(pixel.x + d[0], pixel.y + d[1]);
          if (p && typeof p.element === "string" && p.element.endsWith("_chunk")) {
            if (chance(0.35)) {
              const bx = pixel.x + (chance(0.5) ? 1 : -1);
              const by = pixel.y + (chance(0.5) ? 1 : 0);
              if (empty(bx, by)) safeCreate(BLOOD, bx, by);
            }
          }
        }

        // decay to diluted, then fade
        if (pixel._pgAge > 900 && chance(0.15)) {
          safeChange(pixel, "pg_diluted_acid");
          pixel._pgAge = 0;
          return;
        }
        if (pixel._pgAge > 1700 && chance(0.25)) {
          if (!safeDeleteAt(pixel.x, pixel.y)) safeChange(pixel, "pg_diluted_acid");
        }
      },
      reactions: {
        water:     { elem1: "pg_diluted_acid", elem2: "pg_diluted_acid", chance: 0.55 },
        pg_saliva: { elem1: "pg_diluted_acid", elem2: "pg_diluted_acid", chance: 0.55 },
        pg_mucus:  { elem1: "pg_diluted_acid", elem2: "pg_diluted_acid", chance: 0.55 },
        pg_csf:    { elem1: "pg_diluted_acid", elem2: "pg_diluted_acid", chance: 0.55 },

        // dissolve many things (BUT NOT muscle/intestine/stomach; we delete those later)
        pg_skin_chunk:      { elem1: "pg_gastric_acid", elem2: "pg_slurry", chance: 0.25 },
        pg_fat_chunk:       { elem1: "pg_gastric_acid", elem2: "pg_slurry", chance: 0.22 },
        pg_cartilage_chunk: { elem1: "pg_gastric_acid", elem2: "pg_slurry", chance: 0.16 },
        pg_tendon_chunk:    { elem1: "pg_gastric_acid", elem2: "pg_slurry", chance: 0.16 },
        pg_nerve_chunk:     { elem1: "pg_gastric_acid", elem2: "pg_slurry", chance: 0.18 },
        pg_brain_chunk:     { elem1: "pg_gastric_acid", elem2: "pg_slurry", chance: 0.22 },
        pg_heart_chunk:     { elem1: "pg_gastric_acid", elem2: "pg_slurry", chance: 0.18 },
        pg_lung_chunk:      { elem1: "pg_gastric_acid", elem2: "pg_slurry", chance: 0.18 },
        pg_liver_chunk:     { elem1: "pg_gastric_acid", elem2: "pg_slurry", chance: 0.18 },
        pg_kidney_chunk:    { elem1: "pg_gastric_acid", elem2: "pg_slurry", chance: 0.18 },

        pg_skin_block:      { elem1: "pg_gastric_acid", elem2: "pg_skin_chunk", chance: 0.08 },
        pg_fat_block:       { elem1: "pg_gastric_acid", elem2: "pg_fat_chunk", chance: 0.08 },
        pg_cartilage_block: { elem1: "pg_gastric_acid", elem2: "pg_cartilage_chunk", chance: 0.06 },
        pg_tendon_block:    { elem1: "pg_gastric_acid", elem2: "pg_tendon_chunk", chance: 0.06 },
        pg_nerve_block:     { elem1: "pg_gastric_acid", elem2: "pg_nerve_chunk", chance: 0.06 },
        pg_brain_block:     { elem1: "pg_gastric_acid", elem2: "pg_brain_chunk", chance: 0.08 },
        pg_heart_block:     { elem1: "pg_gastric_acid", elem2: "pg_heart_chunk", chance: 0.07 },
        pg_lung_block:      { elem1: "pg_gastric_acid", elem2: "pg_lung_chunk", chance: 0.07 },
        pg_liver_block:     { elem1: "pg_gastric_acid", elem2: "pg_liver_chunk", chance: 0.07 },
        pg_kidney_block:    { elem1: "pg_gastric_acid", elem2: "pg_kidney_chunk", chance: 0.07 },

        // cool byproducts
        glass_shard: { elem1: "pg_gastric_acid", elem2: "pg_dissolved_glass", chance: 0.10 },
        sand:        { elem1: "pg_gastric_acid", elem2: "pg_slurry", chance: 0.04 },
      }
    };

    // ---------- stomach (acid-proof + maintains acid without flooding) ----------
    elements.pg_stomach_block = {
      color: ["#c07a68", "#b56c5a", "#d18a79"],
      behavior: behaviors.WALL,
      category: CAT,
      state: "solid",
      density: 1100,
      hardness: 0.30,
      breakInto: "pg_stomach_chunk",
      reactions: {
        // neutralize any acid touching stomach
        pg_gastric_acid: { elem1: "pg_stomach_block", elem2: "pg_diluted_acid", chance: 0.75 },
        pg_diluted_acid: { elem1: "pg_stomach_block", elem2: "pg_diluted_acid", chance: 0.25 },
      },
      tick: function (pixel) {
        // Maintain SMALL acid around stomach (so it doesn't flood)
        let acidCount = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const p = getPixel(pixel.x + dx, pixel.y + dy);
            if (p && p.element === "pg_gastric_acid") acidCount++;
          }
        }

        // too much? neutralize one acid nearby
        if (acidCount > 6 && chance(0.40)) {
          for (let i = 0; i < 10; i++) {
            const nx = pixel.x + ((Math.random() * 5) | 0) - 2;
            const ny = pixel.y + ((Math.random() * 5) | 0) - 2;
            const p = getPixel(nx, ny);
            if (p && p.element === "pg_gastric_acid") { safeChange(p, "pg_diluted_acid"); break; }
          }
        }

        // low? slowly renew
        if (acidCount < 2 && chance(0.02)) {
          const dirs = [[0,1],[1,0],[-1,0],[0,-1]];
          const d = dirs[(Math.random() * dirs.length) | 0];
          const nx = pixel.x + d[0], ny = pixel.y + d[1];
          if (empty(nx, ny)) safeCreate("pg_gastric_acid", nx, ny);
        }
      }
    };

    elements.pg_stomach_chunk = {
      color: ["#c07a68", "#b56c5a", "#d18a79"],
      behavior: behaviors.STURDYPOWDER,
      category: CAT,
      state: "solid",
      density: 1080,
      tick: function (pixel) { bleedTick(pixel, 0.015); }
    };

    // ---------- saliva spawners ----------
    elements.pg_saliva_gland_block = {
      color: ["#ffb6c1", "#f3a3b0", "#ffc8d1"],
      behavior: behaviors.WALL,
      category: CAT,
      state: "solid",
      density: 1100,
      tick: function (pixel) {
        pixel._pgCD = (pixel._pgCD || 0) - 1;
        if (pixel._pgCD > 0) return;
        pixel._pgCD = 180;

        const dirs = [[0,1],[1,0],[-1,0],[0,-1]];
        for (let i = 0; i < 4; i++) {
          const d = dirs[(Math.random() * dirs.length) | 0];
          const nx = pixel.x + d[0], ny = pixel.y + d[1];
          if (empty(nx, ny)) { safeCreate("pg_saliva", nx, ny); break; }
        }
      }
    };

    elements.pg_tongue_block = {
      color: ["#e97a8a", "#f08ea0", "#d96576"],
      behavior: behaviors.WALL,
      category: CAT,
      state: "solid",
      density: 1120,
      tick: function (pixel) {
        pixel._pgCD = (pixel._pgCD || 0) - 1;
        if (pixel._pgCD > 0) return;
        pixel._pgCD = 60;

        const spots = [[0,-1],[1,-1],[-1,-1],[0,0],[1,0],[-1,0]];
        for (let i = 0; i < 3; i++) {
          const s = spots[(Math.random() * spots.length) | 0];
          const nx = pixel.x + s[0], ny = pixel.y + s[1];
          if (empty(nx, ny)) { safeCreate("pg_saliva", nx, ny); break; }
        }
      }
    };

    // ---------- enforce: acid cannot destroy muscle/intestine/stomach ----------
    function delRxn(elemName, key) {
      if (elements[elemName] && elements[elemName].reactions && elements[elemName].reactions[key]) {
        delete elements[elemName].reactions[key];
      }
    }

    // delete from gastric acid + diluted acid if present
    for (const a of ["pg_gastric_acid", "pg_diluted_acid"]) {
      delRxn(a, "pg_muscle_block");
      delRxn(a, "pg_muscle_chunk");
      delRxn(a, "pg_intestine_block");
      delRxn(a, "pg_intestine_chunk");
      delRxn(a, "pg_stomach_block");
      delRxn(a, "pg_stomach_chunk");
    }

    // make these parts actively neutralize acid
    function addNeutralizeOn(elemName) {
      if (!elements[elemName]) return;
      if (!elements[elemName].reactions) elements[elemName].reactions = {};
      elements[elemName].reactions.pg_gastric_acid = { elem1: elemName, elem2: "pg_diluted_acid", chance: 0.35 };
      elements[elemName].reactions.pg_diluted_acid = { elem1: elemName, elem2: "pg_diluted_acid", chance: 0.15 };
    }
    addNeutralizeOn("pg_muscle_block");
    addNeutralizeOn("pg_muscle_chunk");
    addNeutralizeOn("pg_intestine_block");
    addNeutralizeOn("pg_intestine_chunk");
    addNeutralizeOn("pg_stomach_block");
    addNeutralizeOn("pg_stomach_chunk");

    // ---------- tools ----------
    elements.pg_scalpel = {
      color: "#d9d9d9",
      category: "tools",
      tool: function (pixel) {
        const e = pixel.element;

        if (typeof e === "string" && e.endsWith("_block")) {
          const chunk = e.replace("_block", "_chunk");
          if (elements[chunk]) {
            // more blood on cut
            if (chance(0.55)) safeCreate(BLOOD, pixel.x + (chance(0.5) ? 1 : -1), pixel.y);
            if (chance(0.25)) safeCreate(BLOOD, pixel.x, pixel.y + 1);

            if (e === "pg_brain_block" && chance(0.6)) safeCreate("pg_csf", pixel.x, pixel.y + 1);
            if (e === "pg_stomach_block" && chance(0.6)) safeCreate("pg_gastric_acid", pixel.x, pixel.y + 1);

            safeChange(pixel, chunk);
          }
        }
      }
    };

    elements.pg_stapler = {
      color: "#777777",
      category: "tools",
      tool: function (pixel) {
        const e = pixel.element;
        if (typeof e === "string" && e.endsWith("_chunk")) {
          const block = e.replace("_chunk", "_block");
          if (elements[block]) safeChange(pixel, block);
        }
      }
    };

  } catch (err) {
    console.error("[pg_noobkit] CRASH:", err);
  }
});
