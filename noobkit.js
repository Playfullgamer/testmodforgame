// noobkit.js (Playfullgamer anatomy pack)
// Unique ids: pg_* so it won't conflict with other mods.

(function (main) {
  if (typeof runAfterLoad === "function") runAfterLoad(main);
  else if (document.readyState === "complete") main();
  else window.addEventListener("load", main);
})(function () {
  if (typeof elements === "undefined" || typeof behaviors === "undefined") {
    console.error("[pg_noobkit] elements/behaviors not ready");
    return;
  }

  console.log("[pg_noobkit] loaded OK");

  // ----- helpers -----
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

  // ----- sanity test element -----
  elements.pg_test_powder = {
    color: "#00ffcc",
    behavior: behaviors.POWDER,
    category: "anatomy",   // new category (auto appears)
    state: "solid",
    density: 1500,
  };

  // ----- base references -----
  const BLOOD = elements.blood ? "blood" : "pg_blood";
  const BONE  = elements.bone  ? "bone"  : "pg_bone";
  const ASH   = elements.ash   ? "ash"   : null;
  const STEAM = elements.steam ? "steam" : null;

  // fallback blood/bone if base game doesn't have them
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

  if (!elements[BONE]) {
    elements.pg_bone = {
      color: ["#e9e2d1", "#d8cfbb", "#f2ead8"],
      behavior: behaviors.WALL,
      category: "solids",
      state: "solid",
      density: 1900,
      hardness: 0.7,
      breakInto: "pg_bone_dust",
      tempHigh: 900,
      stateHigh: ASH || "ash",
    };
    elements.pg_bone_dust = {
      color: ["#e8e0cf", "#d8cfbb"],
      behavior: behaviors.POWDER,
      category: "powders",
      state: "solid",
      density: 1200,
    };
  }

  // ----- fluids (put into liquids category so they're easy to find) -----
  elements.pg_brain_fluid = {
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

  elements.pg_stomach_acid = {
    color: ["#c9ff3b", "#a8f000", "#d7ff6a"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1040,
    viscosity: 9000,
    stain: 0.10,
    reactions: {
      // dissolves your anatomy stuff:
      pg_skin:         { elem1: "pg_stomach_acid", elem2: "pg_digested_slurry", chance: 0.25 },
      pg_muscle:       { elem1: "pg_stomach_acid", elem2: "pg_digested_slurry", chance: 0.25 },
      pg_organ_flesh:  { elem1: "pg_stomach_acid", elem2: "pg_digested_slurry", chance: 0.25 },
      pg_brain_flesh:  { elem1: "pg_stomach_acid", elem2: "pg_digested_slurry", chance: 0.30 },
      pg_heart:        { elem1: "pg_stomach_acid", elem2: "pg_digested_slurry", chance: 0.25 },
      pg_brain:        { elem1: "pg_stomach_acid", elem2: "pg_digested_slurry", chance: 0.25 },
      pg_stomach:      { elem1: "pg_stomach_acid", elem2: "pg_digested_slurry", chance: 0.20 },
      // gets weaker with water/brain fluid
      water:           { elem1: "pg_diluted_acid", elem2: "pg_diluted_acid", chance: 0.5 },
      pg_brain_fluid:  { elem1: "pg_diluted_acid", elem2: "pg_diluted_acid", chance: 0.5 },
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
    reactions: {
      pg_skin:        { elem1: "pg_diluted_acid", elem2: "pg_digested_slurry", chance: 0.10 },
      pg_muscle:      { elem1: "pg_diluted_acid", elem2: "pg_digested_slurry", chance: 0.10 },
      pg_organ_flesh: { elem1: "pg_diluted_acid", elem2: "pg_digested_slurry", chance: 0.10 },
      pg_brain_flesh: { elem1: "pg_diluted_acid", elem2: "pg_digested_slurry", chance: 0.12 },
    }
  };

  elements.pg_digested_slurry = {
    color: ["#6b4b2a", "#845a34", "#5c3f22"],
    behavior: behaviors.LIQUID,
    category: "liquids",
    state: "liquid",
    density: 1150,
    viscosity: 25000,
    stain: 0.12,
  };

  // ----- tissues/organs (new category anatomy so they group together) -----
  elements.pg_skin = {
    color: ["#f2c6a7", "#e8b996", "#d9a785"],
    behavior: behaviors.STURDYPOWDER,
    category: "anatomy",
    state: "solid",
    density: 1120,
    burn: 6,
    burnTime: 160,
    burnInto: ASH || "ash",
    tempHigh: 120,
    stateHigh: ASH || "ash",
  };

  elements.pg_muscle = {
    color: ["#b54545", "#c85a5a", "#9c2f2f"],
    behavior: behaviors.STURDYPOWDER,
    category: "anatomy",
    state: "solid",
    density: 1150,
    burn: 7,
    burnTime: 140,
    burnInto: ASH || "ash",
    tempHigh: 110,
    stateHigh: ASH || "ash",
  };

  elements.pg_organ_flesh = {
    color: ["#c96b6b", "#b85b5b", "#d77c7c"],
    behavior: behaviors.STURDYPOWDER,
    category: "anatomy",
    state: "solid",
    density: 1080,
    burn: 8,
    burnTime: 120,
    burnInto: ASH || "ash",
    tempHigh: 90,
    stateHigh: ASH || "ash",
  };

  elements.pg_brain_flesh = {
    color: ["#b3a2ad", "#c3b1bc", "#9a8a95"],
    behavior: behaviors.STURDYPOWDER,
    category: "anatomy",
    state: "solid",
    density: 1040,
    burn: 7,
    burnTime: 110,
    burnInto: ASH || "ash",
    tempHigh: 80,
    stateHigh: ASH || "ash",
  };

  elements.pg_brain = {
    color: ["#a99aa6", "#bdb0ba", "#948793"],
    behavior: behaviors.WALL,
    category: "anatomy",
    state: "solid",
    density: 1060,
    hardness: 0.15,
    tempHigh: 85,
    stateHigh: "pg_brain_flesh",
    tick: function (pixel) {
      // leaks brain fluid a bit if exposed
      if (chance(0.01)) {
        const dirs = [[0,1],[1,0],[-1,0],[0,-1]];
        for (const [dx,dy] of dirs) {
          const nx = pixel.x + dx, ny = pixel.y + dy;
          if (empty(nx, ny)) { safeCreate("pg_brain_fluid", nx, ny); break; }
        }
      }
    }
  };

  elements.pg_stomach = {
    color: ["#c07a68", "#b56c5a", "#d18a79"],
    behavior: behaviors.WALL,
    category: "anatomy",
    state: "solid",
    density: 1100,
    hardness: 0.18,
    tick: function (pixel) {
      // slow acid leak
      if (chance(0.006)) {
        const dirs = [[0,1],[1,0],[-1,0],[0,-1]];
        for (const [dx,dy] of dirs) {
          const nx = pixel.x + dx, ny = pixel.y + dy;
          if (empty(nx, ny)) { safeCreate("pg_stomach_acid", nx, ny); break; }
        }
      }
    }
  };

  elements.pg_heart = {
    color: ["#8c0f1f", "#a31226", "#6e0b17"],
    behavior: behaviors.WALL,
    category: "anatomy",
    state: "solid",
    density: 1120,
    hardness: 0.22,
    tick: function (pixel) {
      // pumps blood
      if (chance(0.03)) {
        const dirs = [[0,1],[1,0],[-1,0],[0,-1]];
        const pick = dirs[(Math.random() * dirs.length) | 0];
        const nx = pixel.x + pick[0], ny = pixel.y + pick[1];
        if (empty(nx, ny)) safeCreate(BLOOD, nx, ny);
      }
    }
  };

  // ----- tool (existing tools category) -----
  elements.pg_scalpel = {
    color: "#d9d9d9",
    category: "tools",
    tool: function (pixel) {
      const e = pixel.element;

      if (e === "pg_stomach") {
        safeCreate("pg_stomach_acid", pixel.x, pixel.y + 1);
        safeCreate("pg_stomach_acid", pixel.x + 1, pixel.y);
        safeChange(pixel, "pg_organ_flesh");
        return;
      }

      if (e === "pg_brain") {
        safeCreate("pg_brain_fluid", pixel.x, pixel.y + 1);
        safeCreate("pg_brain_fluid", pixel.x + 1, pixel.y);
        safeCreate("pg_brain_fluid", pixel.x - 1, pixel.y);
        safeChange(pixel, "pg_brain_flesh");
        return;
      }

      if (e === "pg_heart") {
        safeCreate(BLOOD, pixel.x, pixel.y + 1);
        safeCreate(BLOOD, pixel.x + 1, pixel.y);
        safeCreate(BLOOD, pixel.x - 1, pixel.y);
        safeChange(pixel, "pg_organ_flesh");
        return;
      }

      if (e === "pg_skin" || e === "pg_muscle" || e === "pg_organ_flesh" || e === "pg_brain_flesh") {
        if (chance(0.35)) safeCreate(BLOOD, pixel.x + (Math.random() < 0.5 ? -1 : 1), pixel.y);
      }
    }
  };

  // ----- seeds (build simple body) -----
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

  const HUMAN_TEMPLATE = [
    "....S....",
    "...SSS...",
    "...SBS...",
    "...SSS...",
    "....S....",
    "..SSSSS..",
    "..SMOMS..",
    "..SMHMS..",
    "..SMGMS..",
    "..SMMMS..",
    "..SSSSS..",
    "..S...S.."
  ];

  elements.pg_human_seed = {
    color: ["#222222", "#444444"],
    behavior: behaviors.STURDYPOWDER,
    category: "anatomy",
    state: "solid",
    density: 1600,
    tick: function (pixel) {
      if (pixel._built) return;
      pixel._built = true;

      const legend = {
        "S": "pg_skin",
        "M": "pg_muscle",
        "O": BONE,
        "B": "pg_brain",
        "H": "pg_heart",
        "G": "pg_stomach",
      };

      buildFromTemplate(pixel.x, pixel.y, HUMAN_TEMPLATE, legend);
      safeChange(pixel, "pg_skin");
    }
  };
});
