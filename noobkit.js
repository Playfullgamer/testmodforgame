// noobkit.js v5 (stable, anchored builder anatomy)
// IMPORTANT: load with a URL ending in .js (no ?v=)
// IDs are pg_* so they won't conflict with other mods.

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

    console.log("[pg_noobkit] loaded v5");

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
    function chance(p) { return Math.random() < p; }

    const CAT = "anatomy";
    const ASH = elements.ash ? "ash" : null;
    const STEAM = elements.steam ? "steam" : null;
    const METHANE = elements.methane ? "methane" : null;

    // ---------- obvious proof it loaded ----------
    elements.pg_loaded_marker = {
      color: "#ff00ff",
      behavior: behaviors.WALL,
      category: CAT,
      state: "solid",
      density: 9999,
    };

    // ---------- base references ----------
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

    // ---------- fluids ----------
    elements.pg_plasma = {
      color: ["#ffd9a8", "#ffe4c1", "#ffcf8a"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1025,
      viscosity: 14000,
      stain: 0.05,
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

    elements.pg_saliva = {
      color: ["#e7f6ff", "#d7efff"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1005,
      viscosity: 9000,
      stain: 0.02,
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
      tick: function (pixel) {
        if (pixel.temp > 25 && METHANE && chance(0.001)) {
          safeCreate(METHANE, pixel.x + (Math.random() < 0.5 ? -1 : 1), pixel.y - 1);
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
      reactions: {
        water: { elem1: "pg_diluted_acid", elem2: "pg_diluted_acid", chance: 0.55 },
        pg_saliva: { elem1: "pg_diluted_acid", elem2: "pg_diluted_acid", chance: 0.55 },
        pg_mucus: { elem1: "pg_diluted_acid", elem2: "pg_diluted_acid", chance: 0.55 },
        pg_csf: { elem1: "pg_diluted_acid", elem2: "pg_diluted_acid", chance: 0.55 },
      }
    };

    elements.pg_diluted_acid = {
      color: ["#dfff80", "#cfff6a", "#e9ffb0"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1020,
      viscosity: 7000,
      stain: 0.06,
    };

    // ---------- block+chunk builder ----------
    function makeBlockAndChunk(baseId, blockDef, chunkDef) {
      elements[baseId + "_block"] = Object.assign({
        behavior: behaviors.WALL,          // anchored (won't fall)
        category: CAT,
        state: "solid",
        breakInto: baseId + "_chunk",
      }, blockDef);

      elements[baseId + "_chunk"] = Object.assign({
        behavior: behaviors.STURDYPOWDER,  // falls when cut/destroyed
        category: CAT,
        state: "solid",
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
    });

    makeBlockAndChunk("pg_muscle", {
      color: ["#b54545", "#c85a5a", "#9c2f2f"],
      density: 1150,
      burn: 7, burnTime: 140, burnInto: ASH || "ash",
    }, {
      color: ["#b54545", "#c85a5a", "#9c2f2f"],
      density: 1120,
    });

    makeBlockAndChunk("pg_fat", {
      color: ["#fff3b0", "#ffe68a", "#fff0a0"],
      density: 920,
      burn: 9, burnTime: 120, burnInto: ASH || "ash",
      tempHigh: 50, stateHigh: "pg_melted_fat",
    }, {
      color: ["#fff3b0", "#ffe68a", "#fff0a0"],
      density: 900,
    });

    elements.pg_melted_fat = {
      color: ["#fff1a0", "#ffe070"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 880,
      viscosity: 25000,
      tempLow: 35,
      stateLow: "pg_fat_chunk",
    };

    makeBlockAndChunk("pg_cartilage", {
      color: ["#d9e2e6", "#c7d0d6", "#eef3f5"],
      density: 1200,
      hardness: 0.25,
    }, {
      color: ["#d9e2e6", "#c7d0d6", "#eef3f5"],
      density: 1180,
    });

    makeBlockAndChunk("pg_tendon", {
      color: ["#efe7d3", "#e3d8bd", "#f7f0de"],
      density: 1250,
      hardness: 0.3,
    }, {
      color: ["#efe7d3", "#e3d8bd", "#f7f0de"],
      density: 1230,
    });

    makeBlockAndChunk("pg_nerve", {
      color: ["#f3e9b4", "#f7f0cf", "#e9dd95"],
      density: 1100,
    }, {
      color: ["#f3e9b4", "#f7f0cf", "#e9dd95"],
      density: 1080,
    });

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
    });

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
    });

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
    });

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
    });

    makeBlockAndChunk("pg_kidney", {
      color: ["#8a3d3d", "#9b4a4a", "#6f2f2f"],
      density: 1160,
      hardness: 0.18,
    }, {
      color: ["#8a3d3d", "#9b4a4a", "#6f2f2f"],
      density: 1140,
    });

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
    });

    // stomach as separate id (block/chunk but custom name)
    elements.pg_stomach_block = {
      color: ["#c07a68", "#b56c5a", "#d18a79"],
      behavior: behaviors.WALL,
      category: CAT,
      state: "solid",
      density: 1100,
      hardness: 0.18,
      breakInto: "pg_stomach_chunk",
      tick: function (pixel) {
        if (chance(0.006)) {
          const dirs = [[0,1],[1,0],[-1,0],[0,-1]];
          for (const d of dirs) {
            const nx = pixel.x + d[0], ny = pixel.y + d[1];
            if (empty(nx, ny)) { safeCreate("pg_gastric_acid", nx, ny); break; }
          }
        }
      }
    };
    elements.pg_stomach_chunk = {
      color: ["#c07a68", "#b56c5a", "#d18a79"],
      behavior: behaviors.STURDYPOWDER,
      category: CAT,
      state: "solid",
      density: 1080,
    };

    // ---------- acid dissolving rules ----------
    // chunks dissolve faster, blocks convert to chunks
    const dissolveFast = {
      pg_skin_chunk: 1, pg_muscle_chunk: 1, pg_fat_chunk: 1,
      pg_cartilage_chunk: 1, pg_tendon_chunk: 1, pg_nerve_chunk: 1,
      pg_brain_chunk: 1, pg_heart_chunk: 1, pg_lung_chunk: 1,
      pg_liver_chunk: 1, pg_kidney_chunk: 1, pg_intestine_chunk: 1,
      pg_stomach_chunk: 1,
    };
    const dissolveSlow = {
      pg_skin_block: "pg_skin_chunk",
      pg_muscle_block: "pg_muscle_chunk",
      pg_fat_block: "pg_fat_chunk",
      pg_cartilage_block: "pg_cartilage_chunk",
      pg_tendon_block: "pg_tendon_chunk",
      pg_nerve_block: "pg_nerve_chunk",
      pg_brain_block: "pg_brain_chunk",
      pg_heart_block: "pg_heart_chunk",
      pg_lung_block: "pg_lung_chunk",
      pg_liver_block: "pg_liver_chunk",
      pg_kidney_block: "pg_kidney_chunk",
      pg_intestine_block: "pg_intestine_chunk",
      pg_stomach_block: "pg_stomach_chunk",
    };

    if (!elements.pg_gastric_acid.reactions) elements.pg_gastric_acid.reactions = {};
    for (const k in dissolveFast) {
      elements.pg_gastric_acid.reactions[k] = { elem1: "pg_gastric_acid", elem2: "pg_slurry", chance: 0.28 };
    }
    for (const k in dissolveSlow) {
      elements.pg_gastric_acid.reactions[k] = { elem1: "pg_gastric_acid", elem2: dissolveSlow[k], chance: 0.10 };
    }

    // bile breaks fat (better for destruction)
    if (!elements.pg_bile.reactions) elements.pg_bile.reactions = {};
    elements.pg_bile.reactions.pg_fat_block = { elem1: "pg_bile", elem2: "pg_slurry", chance: 0.18 };
    elements.pg_bile.reactions.pg_fat_chunk = { elem1: "pg_bile", elem2: "pg_slurry", chance: 0.25 };

    // ---------- bacteria / rot ----------
    elements.pg_bacteria = {
      color: ["#9ad400", "#7fb300", "#b6f000"],
      behavior: behaviors.POWDER,
      category: CAT,
      state: "solid",
      density: 900,
    };

    elements.pg_rotten_tissue = {
      color: ["#3f4a1e", "#2f3816", "#596b2b"],
      behavior: behaviors.STURDYPOWDER,
      category: CAT,
      state: "solid",
      density: 1150,
      tick: function (pixel) {
        if (chance(0.01)) safeCreate("pg_pus", pixel.x, pixel.y + 1);
      }
    };

    elements.pg_pus = {
      color: ["#e5e58a", "#d6d66f", "#f0f0a8"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1035,
      viscosity: 45000,
      stain: 0.07,
    };

    // bacteria reactions (rots blocks)
    elements.pg_bacteria.reactions = {
      pg_skin_block:      { elem1: "pg_bacteria", elem2: "pg_rotten_tissue", chance: 0.08 },
      pg_muscle_block:    { elem1: "pg_bacteria", elem2: "pg_rotten_tissue", chance: 0.10 },
      pg_fat_block:       { elem1: "pg_bacteria", elem2: "pg_rotten_tissue", chance: 0.07 },
      pg_brain_block:     { elem1: "pg_bacteria", elem2: "pg_rotten_tissue", chance: 0.12 },
      pg_heart_block:     { elem1: "pg_bacteria", elem2: "pg_rotten_tissue", chance: 0.10 },
      pg_lung_block:      { elem1: "pg_bacteria", elem2: "pg_rotten_tissue", chance: 0.09 },
      pg_liver_block:     { elem1: "pg_bacteria", elem2: "pg_rotten_tissue", chance: 0.09 },
      pg_kidney_block:    { elem1: "pg_bacteria", elem2: "pg_rotten_tissue", chance: 0.09 },
      pg_intestine_block: { elem1: "pg_bacteria", elem2: "pg_rotten_tissue", chance: 0.12 },
      pg_stomach_block:   { elem1: "pg_bacteria", elem2: "pg_rotten_tissue", chance: 0.10 },
    };
    elements.pg_bacteria.reactions[BLOOD] = { elem1: "pg_bacteria", elem2: "pg_pus", chance: 0.08 };

    // ---------- tools ----------
    elements.pg_scalpel = {
      color: "#d9d9d9",
      category: "tools",
      tool: function (pixel) {
        const e = pixel.element;

        // convert *_block -> *_chunk
        if (typeof e === "string" && e.endsWith("_block")) {
          const chunk = e.replace("_block", "_chunk");
          if (elements[chunk]) {
            if (chance(0.35)) safeCreate(BLOOD, pixel.x + (Math.random() < 0.5 ? -1 : 1), pixel.y);
            if (e === "pg_brain_block" && chance(0.5)) safeCreate("pg_csf", pixel.x, pixel.y + 1);
            if (e === "pg_stomach_block" && chance(0.5)) safeCreate("pg_gastric_acid", pixel.x, pixel.y + 1);
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

    // ---------- seeds (clean, no weird spacing) ----------
    function buildFromTemplate(cx, cy, template, legend) {
      const h = template.length, w = template[0].length;
      const x0 = cx - ((w / 2) | 0);
      const y0 = cy - ((h / 2) | 0);
      for (let ty = 0; ty < h; ty++) {
        const row = template[ty];
        for (let tx = 0; tx < w; tx++) {
          const ch = row[tx];
          if (ch === ".") continue;
          const elem = legend[ch];
          if (!elem) continue;
          safeCreate(elem, x0 + tx, y0 + ty);
        }
      }
    }

    // 15 wide, simple and symmetric
    const HUMAN = [
      ".....SSSSS.....",
      "....SMMMMMS....",
      "...SMMBBBMM S...",
      "...SMMBBBMM S...",
      "...SMMMMMMM S...",
      "....SMMMMMS....",
      ".....SSSSS.....",
      ".....SMMMS.....",
      "...SSMMHMMSS...",
      "..SMMMLLMMMMS..",
      "..SMMMLLMMMMS..",
      "..SMMMMVMMMMS..",
      "..SMMMKKKMMM S..",
      "..SMMMIIIMMM S..",
      "...SMMMGMMM S...",
      "...SMMMMMMM S...",
      "....SMMMMMS....",
      ".....SMMMS.....",
      "......S.S......"
    ].map(r => r.replace(/ /g, ".")); // safe: only turns spaces into dots

    const MANNEQUIN = [
      ".....SSSSS.....",
      "....SMMMMMS....",
      "...SMMMMMMM....",
      "...SMMMMMMM....",
      "...SMMMMMMM....",
      "....SMMMMMS....",
      ".....SSSSS.....",
      ".....SMMMS.....",
      "...SSMMMMMSS...",
      "..SMMMMMMMMMS..",
      "..SMMMMMMMMMS..",
      "..SMMMMMMMMMS..",
      "..SMMMMMMMMMS..",
      "...SMMMMMMMS...",
      "...SMMMMMMMS...",
      "....SMMMMMS....",
      ".....SMMMS.....",
      "......S.S......"
    ];

    elements.pg_human_seed = {
      color: ["#222222", "#444444"],
      behavior: behaviors.STURDYPOWDER,
      category: CAT,
      state: "solid",
      density: 1600,
      tick: function (pixel) {
        if (pixel._built) return;
        pixel._built = true;

        const legend = {
          "S": "pg_skin_block",
          "M": "pg_muscle_block",
          "B": "pg_brain_block",
          "H": "pg_heart_block",
          "L": "pg_lung_block",
          "V": "pg_liver_block",
          "K": "pg_kidney_block",
          "I": "pg_intestine_block",
          "G": "pg_stomach_block",
          "O": BONE,
        };

        buildFromTemplate(pixel.x, pixel.y, HUMAN, legend);
        safeChange(pixel, "pg_skin_block");
      }
    };

    elements.pg_mannequin_seed = {
      color: ["#111111", "#333333"],
      behavior: behaviors.STURDYPOWDER,
      category: CAT,
      state: "solid",
      density: 1600,
      tick: function (pixel) {
        if (pixel._built) return;
        pixel._built = true;

        const legend = {
          "S": "pg_skin_block",
          "M": "pg_muscle_block",
        };

        buildFromTemplate(pixel.x, pixel.y, MANNEQUIN, legend);
        safeChange(pixel, "pg_skin_block");
      }
    };

  } catch (err) {
    console.error("[pg_noobkit] CRASH:", err);
  }
});
