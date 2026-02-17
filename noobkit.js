// noobkit.js v11 - Veins + Better Gore + Big Human Digest + Cartilage + Brain Fluid + Esophagus Conveyor
// IDs are pg_*
//
// NEW in v11:
// - pg_vein_block + pg_vein_chunk (bleeding vessels)
// - pg_clot and improved pg_gore behavior (drips blood, clots, separates into fluids)
// - seed places some veins inside body/limbs

(function(main){
  if (typeof runAfterLoad === "function") runAfterLoad(main);
  else if (document.readyState === "complete") main();
  else window.addEventListener("load", main);
})(function(){
  try {
    if (typeof elements === "undefined" || typeof behaviors === "undefined") {
      console.error("[pg_noobkit] elements/behaviors not ready");
      return;
    }
    console.log("[pg_noobkit] loaded v11");

    // ---------------- helpers ----------------
    function inBounds(x,y){ return !(typeof outOfBounds === "function" && outOfBounds(x,y)); }
    function empty(x,y){ return inBounds(x,y) && (typeof isEmpty === "function" ? isEmpty(x,y) : true); }
    function getPixel(x,y){
      if (typeof pixelMap === "undefined" || !pixelMap) return null;
      if (!inBounds(x,y)) return null;
      return (pixelMap[x] && pixelMap[x][y]) ? pixelMap[x][y] : null;
    }
    function safeCreate(elem,x,y){
      if (!inBounds(x,y) || !elements[elem] || typeof createPixel !== "function" || !empty(x,y)) return false;
      createPixel(elem,x,y); return true;
    }
    function safeChange(pixel, elem){
      if (!elements[elem]) return;
      if (typeof changePixel === "function") changePixel(pixel, elem);
      else pixel.element = elem;
    }
    function setOrChange(x,y,elem){
      const p = getPixel(x,y);
      if (p) safeChange(p, elem);
      else safeCreate(elem, x, y);
    }
    function safeDeleteAt(x,y){
      if (typeof deletePixel === "function") { deletePixel(x,y); return true; }
      return false;
    }
    function chance(p){ return Math.random() < p; }

    const CAT = "anatomy";
    const STEAM = elements.steam ? "steam" : null;
    const METHANE = elements.methane ? "methane" : null;

    // ---------------- proof marker ----------------
    elements.pg_loaded_marker = {
      color: "#ff00ff",
      behavior: behaviors.WALL,
      category: CAT,
      state: "solid",
      density: 9999,
    };

    // ---------------- blood ----------------
    const BLOOD = elements.blood ? "blood" : "pg_blood";
    if (!elements[BLOOD]) {
      elements.pg_blood = {
        color: ["#b3001b","#8f0015","#cc0020"],
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

    // ---------------- bleeding helper ----------------
    function bleedTick(pixel, strength){
      pixel._pgBleedAge = (pixel._pgBleedAge||0)+1;
      if (pixel._pgBleedAge > 260) return;
      if (!chance(strength)) return;

      const dirs = [[0,1],[1,0],[-1,0],[0,-1]];
      const d = dirs[(Math.random()*dirs.length)|0];
      const nx = pixel.x + d[0], ny = pixel.y + d[1];
      if (empty(nx,ny)) safeCreate(BLOOD, nx, ny);
    }

    // ---------------- fluids ----------------
    elements.pg_saliva = {
      color: ["#e7f6ff","#d7efff"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1005,
      viscosity: 2200,
      stain: 0.01,
      tick: function(pixel){
        // Lubricant field: nudges ANY nearby solid/powder/shard/chunk
        if (typeof tryMove !== "function") return;
        if (!chance(0.20)) return;

        const cand = [];
        const above = getPixel(pixel.x, pixel.y - 1);
        if (above) cand.push(above);
        if (chance(0.25)) {
          const l = getPixel(pixel.x-1,pixel.y), r = getPixel(pixel.x+1,pixel.y);
          if (l) cand.push(l);
          if (r) cand.push(r);
        }
        if (!cand.length) return;

        const p = cand[(Math.random()*cand.length)|0];
        if (!p) return;

        const ed = elements[p.element];
        if (!ed) return;
        if (ed.state === "liquid" || ed.state === "gas") return;

        const dir = chance(0.5) ? 1 : -1;
        if (!tryMove(p, p.x, p.y+1)) {
          if (!tryMove(p, p.x+dir, p.y+1)) {
            tryMove(p, p.x+dir, p.y);
          }
        }
      }
    };

    elements.pg_mucus = {
      color: ["#cfe7b0","#bfe08f","#d7f0b8"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1030,
      viscosity: 65000,
      stain: 0.04,
    };

    elements.pg_csf = {
      color: ["#d9f2ff","#c7ecff","#e8fbff"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1010,
      viscosity: 12000,
      stain: 0.03,
      tempHigh: 105,
      stateHigh: STEAM || "steam",
    };

    elements.pg_brain_fluid = {
      color: ["#d9f2ff","#c7ecff","#e8fbff"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1010,
      viscosity: 12000,
      stain: 0.03,
      tempHigh: 105,
      stateHigh: STEAM || "steam",
    };

    elements.pg_waste_water = {
      color: ["#b7c89b","#a2b384","#d0dfb8"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1015,
      viscosity: 9000,
      stain: 0.03,
    };

    elements.pg_chyme = {
      color: ["#6b4b2a","#845a34","#5c3f22"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1150,
      viscosity: 30000,
      stain: 0.12,
      tick: function(pixel){
        if (METHANE && pixel.temp > 25 && chance(0.0008)) {
          safeCreate(METHANE, pixel.x + (chance(0.5)?-1:1), pixel.y-1);
        }
      }
    };

    elements.pg_feces = {
      color: ["#5b3a1f","#6b4424","#4a2e18"],
      behavior: behaviors.STURDYPOWDER,
      category: CAT,
      state: "solid",
      density: 1350,
      stain: 0.10,
      tick: function(pixel){
        if (METHANE && pixel.temp > 20 && chance(0.0012)) {
          safeCreate(METHANE, pixel.x, pixel.y-1);
        }
      }
    };

    elements.pg_food_bolus = {
      color: ["#c2a06b","#b58a58","#d3b37b"],
      behavior: behaviors.STURDYPOWDER,
      category: CAT,
      state: "solid",
      density: 1300,
    };

    // ---------------- improved gore + clots ----------------
    elements.pg_clot = {
      color: ["#4a0a10","#5f0c14","#3b070c"],
      behavior: behaviors.STURDYPOWDER,
      category: CAT,
      state: "solid",
      density: 1400,
      stain: 0.18,
      tick: function(pixel){
        // slowly re-wets into blood when surrounded by liquids (optional)
        if (!chance(0.005)) return;
        const up = getPixel(pixel.x, pixel.y-1);
        const dn = getPixel(pixel.x, pixel.y+1);
        if ((up && elements[up.element] && elements[up.element].state === "liquid") ||
            (dn && elements[dn.element] && elements[dn.element].state === "liquid")) {
          safeChange(pixel, BLOOD);
        }
      }
    };

    elements.pg_gore = {
      color: ["#6e1010","#7d1c1c","#4c0d0d","#5a2424"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1200,
      viscosity: 65000,
      stain: 0.22,
      tick: function(pixel){
        pixel._pgAge = (pixel._pgAge||0)+1;

        // drip blood a bit (so destroyed stuff "bleeds out")
        if (chance(0.06)) {
          const nx = pixel.x + (chance(0.5)?-1:1);
          const ny = pixel.y + (chance(0.7)?1:0);
          if (empty(nx,ny)) safeCreate(BLOOD, nx, ny);
        }

        // clotting: if older or cool, some gore becomes clot chunks
        if (pixel._pgAge > 400 && chance(0.03)) {
          // prefer clotting if not super hot
          if (pixel.temp < 55 || chance(0.6)) {
            safeChange(pixel, "pg_clot");
            return;
          }
        }

        // separate over time into other fluids (more variety than before)
        if (pixel._pgAge > 650 && chance(0.10)) {
          const r = Math.random();
          if (r < 0.50) safeChange(pixel, BLOOD);
          else if (r < 0.75) safeChange(pixel, "pg_chyme");
          else safeChange(pixel, "pg_mucus");
          return;
        }

        // hot gore steams off a bit
        if (STEAM && pixel.temp > 110 && chance(0.02)) {
          const nx = pixel.x, ny = pixel.y-1;
          if (empty(nx,ny)) safeCreate(STEAM, nx, ny);
        }
      }
    };

    // brain mush (better brain destruction)
    elements.pg_brain_mush = {
      color: ["#8f7f8a","#a89aa3","#7a6b73"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1100,
      viscosity: 50000,
      stain: 0.12,
      tick: function(pixel){
        pixel._pgAge = (pixel._pgAge||0)+1;
        if (chance(0.03)) {
          const nx = pixel.x + (chance(0.5)?-1:1);
          const ny = pixel.y;
          if (empty(nx,ny)) safeCreate("pg_brain_fluid", nx, ny);
        }
        if (pixel._pgAge > 900 && chance(0.12)) {
          safeChange(pixel, chance(0.55) ? "pg_chyme" : "pg_gore");
        }
      }
    };

    // ---------------- materials: bone + cartilage + veins ----------------
    elements.pg_bone_block = {
      color: ["#eee5d2","#e0d4bc","#f6eedb"],
      behavior: behaviors.WALL,
      category: CAT,
      state: "solid",
      density: 1900,
      hardness: 0.85,
      breakInto: "pg_bone_chunk",
      burn: 0
    };
    elements.pg_bone_chunk = {
      color: ["#eee5d2","#e0d4bc"],
      behavior: behaviors.POWDER,
      category: CAT,
      state: "solid",
      density: 1700,
      burn: 0
    };

    elements.pg_cartilage_block = {
      color: ["#d9e2e6","#c7d0d6","#eef3f5"],
      behavior: behaviors.WALL,
      category: CAT,
      state: "solid",
      density: 1200,
      hardness: 0.25,
      breakInto: "pg_cartilage_chunk",
      burn: 2,
      burnTime: 220,
      burnInto: "pg_gore"
    };
    elements.pg_cartilage_chunk = {
      color: ["#d9e2e6","#c7d0d6","#eef3f5"],
      behavior: behaviors.STURDYPOWDER,
      category: CAT,
      state: "solid",
      density: 1180,
      burn: 2,
      burnTime: 180,
      burnInto: "pg_gore",
      tick: function(pixel){ bleedTick(pixel, 0.003); }
    };

    // VEINS (what you asked)
    elements.pg_vein_block = {
      color: ["#5d1a2a", "#3a2a6b", "#7a2238"], // red+blue mix
      behavior: behaviors.WALL,
      category: CAT,
      state: "solid",
      density: 1120,
      hardness: 0.10,
      breakInto: "pg_vein_chunk",
      burn: 6,
      burnTime: 120,
      burnInto: "pg_gore",
      tick: function(pixel){
        // small leaks even if intact (adds realism)
        if (!chance(0.01)) return;
        const dirs = [[0,1],[1,0],[-1,0],[0,-1]];
        const d = dirs[(Math.random()*dirs.length)|0];
        const nx = pixel.x + d[0], ny = pixel.y + d[1];
        if (empty(nx,ny)) safeCreate(BLOOD, nx, ny);
      }
    };

    elements.pg_vein_chunk = {
      color: ["#5d1a2a", "#3a2a6b", "#7a2238"],
      behavior: behaviors.STURDYPOWDER,
      category: CAT,
      state: "solid",
      density: 1100,
      burn: 5,
      burnTime: 90,
      burnInto: "pg_gore",
      tick: function(pixel){
        // heavy bleeding when broken
        bleedTick(pixel, 0.05);
      }
    };

    // ---------------- tissues + organs (block + chunk) ----------------
    function makeBlockAndChunk(baseId, blockDef, chunkDef, bleedStrength){
      elements[baseId+"_block"] = Object.assign({
        behavior: behaviors.WALL,
        category: CAT,
        state: "solid",
        breakInto: baseId+"_chunk",
      }, blockDef);

      elements[baseId+"_chunk"] = Object.assign({
        behavior: behaviors.STURDYPOWDER,
        category: CAT,
        state: "solid",
        tick: bleedStrength ? function(pixel){ bleedTick(pixel, bleedStrength); } : undefined,
      }, chunkDef);
    }

    makeBlockAndChunk("pg_skin",
      { color:["#f2c6a7","#e8b996","#d9a785"], density:1120, burn:7, burnTime:140, burnInto:"pg_gore" },
      { color:["#f2c6a7","#e8b996","#d9a785"], density:1100, burn:6, burnTime:90, burnInto:"pg_gore" },
      0.015
    );

    makeBlockAndChunk("pg_muscle",
      { color:["#b54545","#c85a5a","#9c2f2f"], density:1150, burn:8, burnTime:120, burnInto:"pg_gore" },
      { color:["#b54545","#c85a5a","#9c2f2f"], density:1120, burn:7, burnTime:80, burnInto:"pg_gore" },
      0.02
    );

    makeBlockAndChunk("pg_fat",
      { color:["#fff3b0","#ffe68a","#fff0a0"], density:920, burn:10, burnTime:90, burnInto:"pg_gore" },
      { color:["#fff3b0","#ffe68a","#fff0a0"], density:900, burn:9, burnTime:70, burnInto:"pg_gore" },
      0.01
    );

    // Brain: leaks brain fluid
    makeBlockAndChunk("pg_brain",
      { color:["#a99aa6","#bdb0ba","#948793"], density:1060, hardness:0.12, burn:8, burnTime:90, burnInto:"pg_brain_mush",
        tick:function(pixel){
          if (chance(0.015)) {
            const dirs=[[0,1],[1,0],[-1,0],[0,-1]];
            const d=dirs[(Math.random()*dirs.length)|0];
            const nx=pixel.x+d[0], ny=pixel.y+d[1];
            if (empty(nx,ny)) safeCreate("pg_brain_fluid", nx, ny);
          }
        }
      },
      { color:["#a99aa6","#bdb0ba","#948793"], density:1040, burn:7, burnTime:70, burnInto:"pg_brain_mush",
        tick:function(pixel){
          bleedTick(pixel, 0.02);
          if (chance(0.02)) {
            const nx=pixel.x+(chance(0.5)?-1:1), ny=pixel.y;
            if (empty(nx,ny)) safeCreate("pg_brain_fluid", nx, ny);
          }
        }
      },
      null
    );

    makeBlockAndChunk("pg_heart",
      { color:["#8c0f1f","#a31226","#6e0b17"], density:1120, hardness:0.22, burn:9, burnTime:110, burnInto:"pg_gore",
        tick:function(pixel){
          if (chance(0.03)) {
            const dirs=[[0,1],[1,0],[-1,0],[0,-1]];
            const d=dirs[(Math.random()*dirs.length)|0];
            const nx=pixel.x+d[0], ny=pixel.y+d[1];
            if (empty(nx,ny)) safeCreate(BLOOD,nx,ny);
          }
        }
      },
      { color:["#8c0f1f","#a31226","#6e0b17"], density:1100, burn:8, burnTime:80, burnInto:"pg_gore" },
      0.02
    );

    makeBlockAndChunk("pg_lung",
      { color:["#c7a0a0","#d8b1b1","#b78d8d"], density:980, hardness:0.12, burn:7, burnTime:140, burnInto:"pg_gore",
        tick:function(pixel){
          if (chance(0.004)) {
            const nx=pixel.x+(chance(0.5)?-1:1), ny=pixel.y;
            if (empty(nx,ny)) safeCreate("pg_mucus",nx,ny);
          }
        }
      },
      { color:["#c7a0a0","#d8b1b1","#b78d8d"], density:950, burn:6, burnTime:90, burnInto:"pg_gore" },
      0.015
    );

    makeBlockAndChunk("pg_liver",
      { color:["#5b1d1d","#6d2323","#4a1717"], density:1180, hardness:0.20, burn:8, burnTime:130, burnInto:"pg_gore" },
      { color:["#5b1d1d","#6d2323","#4a1717"], density:1160, burn:7, burnTime:90, burnInto:"pg_gore" },
      0.015
    );

    // ---------------- esophagus conveyor ----------------
    elements.pg_esophagus_belt = {
      color: ["#b77a6d","#c98a7c","#a86a5d"],
      behavior: behaviors.WALL,
      category: CAT,
      state: "solid",
      density: 1100,
      hardness: 0.12,
      tick: function(pixel){
        if (typeof tryMove !== "function") return;
        const p = getPixel(pixel.x, pixel.y - 1);
        if (!p) return;

        const ed = elements[p.element];
        if (!ed) return;
        if (ed.behavior === behaviors.WALL && ed.tool !== true) return;

        if (chance(0.65)) {
          if (!tryMove(p, p.x - 1, p.y)) {
            tryMove(p, p.x - 1, p.y + 1);
          }
        }
        if (chance(0.01)) {
          const mx = pixel.x, my = pixel.y - 1;
          if (empty(mx, my)) safeCreate("pg_saliva", mx, my);
        }
      }
    };

    // ---------------- digestion walls ----------------
    elements.pg_mouth_block = {
      color: ["#f0a0b2","#e98ea0","#d97a8b"],
      behavior: behaviors.WALL,
      category: CAT,
      state: "solid",
      density: 1120,
      tick: function(pixel){
        pixel._pgCD = (pixel._pgCD||0)-1;
        if (pixel._pgCD <= 0) {
          pixel._pgCD = 40;
          const spots=[[0,1],[0,0],[1,0],[-1,0],[0,-1]];
          for (let i=0;i<3;i++){
            const s=spots[(Math.random()*spots.length)|0];
            const nx=pixel.x+s[0], ny=pixel.y+s[1];
            if (empty(nx,ny)) { safeCreate("pg_saliva",nx,ny); break; }
          }
        }

        // chew: convert nearby non-pg solids -> food bolus
        if (!chance(0.20)) return;
        const targets=[[0,-1],[1,-1],[-1,-1],[0,1]];
        const t=targets[(Math.random()*targets.length)|0];
        const p=getPixel(pixel.x+t[0], pixel.y+t[1]);
        if (!p) return;

        if (typeof p.element !== "string") return;
        if (p.element.startsWith("pg_")) return;
        const ed=elements[p.element];
        if (!ed || ed.state === "liquid" || ed.state === "gas") return;

        safeChange(p, "pg_food_bolus");
      }
    };

    elements.pg_stomach_wall = {
      color: ["#c07a68","#b56c5a","#d18a79"],
      behavior: behaviors.WALL,
      category: CAT,
      state: "solid",
      density: 1100,
      hardness: 0.30,
      breakInto: "pg_stomach_chunk",
      tick: function(pixel){
        // cap acid in radius
        let acid=0;
        for (let dy=-3; dy<=3; dy++){
          for (let dx=-3; dx<=3; dx++){
            const p=getPixel(pixel.x+dx, pixel.y+dy);
            if (p && p.element === "pg_gastric_acid") acid++;
          }
        }

        if (acid > 10 && chance(0.35)) {
          for (let i=0;i<10;i++){
            const nx=pixel.x+((Math.random()*7)|0)-3;
            const ny=pixel.y+((Math.random()*7)|0)-3;
            const p=getPixel(nx,ny);
            if (p && p.element === "pg_gastric_acid") { safeChange(p,"pg_diluted_acid"); break; }
          }
        }
        if (acid < 4 && chance(0.05)) {
          const dirs=[[0,1],[1,0],[-1,0],[0,-1]];
          const d=dirs[(Math.random()*dirs.length)|0];
          const nx=pixel.x+d[0], ny=pixel.y+d[1];
          if (empty(nx,ny)) safeCreate("pg_gastric_acid", nx, ny);
        }

        if (chance(0.12)) {
          const dirs=[[0,1],[1,0],[-1,0],[0,-1]];
          const d=dirs[(Math.random()*dirs.length)|0];
          const p=getPixel(pixel.x+d[0], pixel.y+d[1]);
          if (p && p.element === "pg_food_bolus") safeChange(p, "pg_chyme");
        }
      }
    };

    elements.pg_stomach_chunk = {
      color: ["#c07a68","#b56c5a","#d18a79"],
      behavior: behaviors.STURDYPOWDER,
      category: CAT,
      state: "solid",
      density: 1080,
      tick: function(pixel){ bleedTick(pixel, 0.015); }
    };

    elements.pg_intestine_wall = {
      color: ["#caa07b","#d5b08b","#b88962"],
      behavior: behaviors.WALL,
      category: CAT,
      state: "solid",
      density: 1120,
      hardness: 0.18,
      breakInto: "pg_intestine_chunk",
      tick: function(pixel){
        if (!chance(0.20)) return;
        const dirs=[[0,1],[1,0],[-1,0],[0,-1]];
        const d=dirs[(Math.random()*dirs.length)|0];
        const p=getPixel(pixel.x+d[0], pixel.y+d[1]);
        if (!p) return;

        if (p.element === "pg_chyme") {
          if (chance(0.65)) safeChange(p, "pg_feces");
          else safeChange(p, "pg_waste_water");
        }
      }
    };

    elements.pg_intestine_chunk = {
      color: ["#caa07b","#d5b08b","#b88962"],
      behavior: behaviors.STURDYPOWDER,
      category: CAT,
      state: "solid",
      density: 1100,
      tick: function(pixel){ bleedTick(pixel, 0.012); }
    };

    // ---------------- acids ----------------
    elements.pg_diluted_acid = {
      color: ["#dfff80","#cfff6a","#e9ffb0"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1020,
      viscosity: 7000,
      stain: 0.05,
      tick: function(pixel){
        pixel._pgAge=(pixel._pgAge||0)+1;
        if (pixel._pgAge > 2600 && chance(0.18)) {
          if (!safeDeleteAt(pixel.x,pixel.y) && elements.water) safeChange(pixel,"water");
        }
      }
    };

    elements.pg_gastric_acid = {
      color: ["#c9ff3b","#a8f000","#d7ff6a"],
      behavior: behaviors.LIQUID,
      category: "liquids",
      state: "liquid",
      density: 1040,
      viscosity: 9000,
      stain: 0.10,
      tick: function(pixel){
        pixel._pgAge=(pixel._pgAge||0)+1;

        if (pixel._pgAge > 900 && chance(0.15)) { safeChange(pixel,"pg_diluted_acid"); return; }
        if (pixel._pgAge > 1800 && chance(0.20)) { safeDeleteAt(pixel.x,pixel.y); return; }

        if (!chance(0.12)) return;
        const dirs=[[0,1],[1,0],[-1,0],[0,-1]];
        const d=dirs[(Math.random()*dirs.length)|0];
        const p=getPixel(pixel.x+d[0], pixel.y+d[1]);
        if (!p) return;

        const e = p.element;

        // don't self-melt stomach/intestines
        if (e === "pg_stomach_wall" || e === "pg_intestine_wall") {
          if (chance(0.35)) safeChange(pixel, "pg_diluted_acid");
          return;
        }

        // brain destruction
        if (e === "pg_brain_block" || e === "pg_brain_chunk") {
          for (let i=0;i<3;i++){
            const nx = p.x + (chance(0.5)?-1:1);
            const ny = p.y + (chance(0.5)?0:1);
            if (empty(nx,ny)) { safeCreate("pg_brain_fluid", nx, ny); break; }
          }
          if (chance(0.35) && empty(p.x, p.y-1)) safeCreate(BLOOD, p.x, p.y-1);
          safeChange(p, "pg_brain_mush");
          return;
        }

        // pg chunks/bolus -> chyme/gore + blood
        if (typeof e === "string" && e.startsWith("pg_")) {
          if (e.endsWith("_chunk") || e === "pg_food_bolus" || e === "pg_cartilage_chunk") {
            if (chance(0.40) && empty(pixel.x, pixel.y-1)) safeCreate(BLOOD, pixel.x, pixel.y-1);
            safeChange(p, chance(0.75) ? "pg_chyme" : "pg_gore");
          }
          return;
        }

        // generic non-liquid/gas -> chyme
        const ed = elements[e];
        if (!ed || ed.state === "liquid" || ed.state === "gas") return;
        const hard = (ed.hardness || 0) > 0.6;
        if (chance(hard ? 0.10 : 0.25)) safeChange(p, "pg_chyme");
      }
    };

    // ---------------- tools ----------------
    elements.pg_scalpel = {
      color: "#d9d9d9",
      category: "tools",
      tool: function(pixel){
        const e = pixel.element;
        if (typeof e === "string" && e.endsWith("_block")) {
          const chunk = e.replace("_block","_chunk");
          if (elements[chunk]) {
            if (chance(0.70)) safeCreate(BLOOD, pixel.x+(chance(0.5)?1:-1), pixel.y);
            if (chance(0.35)) safeCreate("pg_gore", pixel.x, pixel.y+1); // improved gore on cuts

            if (e === "pg_brain_block" && chance(0.7)) {
              safeCreate("pg_brain_fluid", pixel.x, pixel.y+1);
              if (chance(0.5)) safeCreate("pg_brain_fluid", pixel.x+1, pixel.y);
            }
            safeChange(pixel, chunk);
          }
        }
      }
    };

    elements.pg_stapler = {
      color: "#777777",
      category: "tools",
      tool: function(pixel){
        const e = pixel.element;
        if (typeof e === "string" && e.endsWith("_chunk")) {
          const block = e.replace("_chunk","_block");
          if (elements[block]) safeChange(pixel, block);
        }
      }
    };

    // ---------------- BIG HUMAN SEED (with veins) ----------------
    function fillRect(x1,y1,x2,y2, elem){
      const xa=Math.min(x1,x2), xb=Math.max(x1,x2), ya=Math.min(y1,y2), yb=Math.max(y1,y2);
      for (let y=ya;y<=yb;y++) for (let x=xa;x<=xb;x++) if (empty(x,y)) safeCreate(elem,x,y);
    }
    function outlineRect(x1,y1,x2,y2, elem){
      const xa=Math.min(x1,x2), xb=Math.max(x1,x2), ya=Math.min(y1,y2), yb=Math.max(y1,y2);
      for (let x=xa;x<=xb;x++){ if (empty(x,ya)) safeCreate(elem,x,ya); if (empty(x,yb)) safeCreate(elem,x,yb); }
      for (let y=ya;y<=yb;y++){ if (empty(xa,y)) safeCreate(elem,xa,y); if (empty(xb,y)) safeCreate(elem,xb,y); }
    }
    function carveRect(x1,y1,x2,y2){
      const xa=Math.min(x1,x2), xb=Math.max(x1,x2), ya=Math.min(y1,y2), yb=Math.max(y1,y2);
      for (let y=ya;y<=yb;y++) for (let x=xa;x<=xb;x++) if (!empty(x,y)) safeDeleteAt(x,y);
    }
    function line(x1,y1,x2,y2, elem){
      const dx=Math.sign(x2-x1), dy=Math.sign(y2-y1);
      let x=x1, y=y1;
      for (let i=0;i<260;i++){
        setOrChange(x,y,elem);
        if (x===x2 && y===y2) break;
        if (x!==x2) x+=dx;
        if (y!==y2) y+=dy;
      }
    }

    function buildBigHumanV2(cx, cy){
      const headR = 5;
      const headY = cy - 18;
      const torsoTop = cy - 12;
      const torsoBot = cy + 12;
      const torsoL = cx - 7;
      const torsoR = cx + 7;

      outlineRect(torsoL, torsoTop, torsoR, torsoBot, "pg_skin_block");
      fillRect(torsoL+1, torsoTop+1, torsoR-1, torsoBot-1, "pg_muscle_block");

      outlineRect(cx-headR, headY-headR, cx+headR, headY+headR, "pg_skin_block");
      fillRect(cx-headR+1, headY-headR+1, cx+headR-1, headY+headR-1, "pg_muscle_block");

      outlineRect(cx-(headR-1), headY-(headR-1), cx+(headR-1), headY+(headR-1), "pg_bone_block");
      fillRect(cx-2, headY-2, cx+2, headY+1, "pg_brain_block");

      // mouth
      const mouthY = headY + headR;
      const stEntryY = torsoTop + 6;
      carveRect(cx, mouthY, cx, stEntryY);

      if (empty(cx-1, mouthY)) safeCreate("pg_mouth_block", cx-1, mouthY);
      if (empty(cx+1, mouthY)) safeCreate("pg_mouth_block", cx+1, mouthY);

      // skeleton
      line(cx, headY+2, cx, torsoBot, "pg_bone_block");
      for (let ry=torsoTop+2; ry<=torsoTop+6; ry+=2) line(cx-5, ry, cx+5, ry, "pg_bone_block");
      line(cx-3, torsoBot-1, cx+3, torsoBot-1, "pg_bone_block");

      // arms
      outlineRect(cx-12, torsoTop+2, cx-9, torsoTop+9, "pg_skin_block");
      fillRect(cx-11, torsoTop+3, cx-10, torsoTop+8, "pg_muscle_block");
      line(cx-11, torsoTop+3, cx-10, torsoTop+8, "pg_bone_block");
      setOrChange(cx-9, torsoTop+2, "pg_cartilage_block");

      outlineRect(cx+9, torsoTop+2, cx+12, torsoTop+9, "pg_skin_block");
      fillRect(cx+10, torsoTop+3, cx+11, torsoTop+8, "pg_muscle_block");
      line(cx+10, torsoTop+3, cx+11, torsoTop+8, "pg_bone_block");
      setOrChange(cx+9, torsoTop+2, "pg_cartilage_block");

      // legs
      outlineRect(cx-5, torsoBot+1, cx-2, torsoBot+12, "pg_skin_block");
      fillRect(cx-4, torsoBot+2, cx-3, torsoBot+11, "pg_muscle_block");
      line(cx-4, torsoBot+2, cx-3, torsoBot+11, "pg_bone_block");
      setOrChange(cx-2, torsoBot+1, "pg_cartilage_block");

      outlineRect(cx+2, torsoBot+1, cx+5, torsoBot+12, "pg_skin_block");
      fillRect(cx+3, torsoBot+2, cx+4, torsoBot+11, "pg_muscle_block");
      line(cx+3, torsoBot+2, cx+4, torsoBot+11, "pg_bone_block");
      setOrChange(cx+2, torsoBot+1, "pg_cartilage_block");

      // chest cavity
      carveRect(cx-5, torsoTop+2, cx+5, torsoTop+9);

      // organs
      fillRect(cx-5, torsoTop+3, cx-2, torsoTop+7, "pg_lung_block");
      fillRect(cx+2, torsoTop+3, cx+5, torsoTop+7, "pg_lung_block");
      fillRect(cx-1, torsoTop+5, cx+1, torsoTop+6, "pg_heart_block");
      fillRect(cx+1, torsoTop+8, cx+5, torsoTop+10, "pg_liver_block");

      // stomach
      const stL = cx-7, stR = cx-2, stT = torsoTop+8, stB = torsoTop+12;
      outlineRect(stL, stT, stR, stB, "pg_stomach_wall");
      carveRect(stL+1, stT+1, stR-1, stB-1);
      carveRect(stL+2, stT, stR-2, stT);

      // intestines
      const inL = cx-6, inR = cx+6, inT = torsoTop+12, inB = torsoBot-1;
      outlineRect(inL, inT, inR, inB, "pg_intestine_wall");
      carveRect(inL+1, inT+1, inR-1, inB-2);
      carveRect(stL+2, stB, stR-2, stB);
      carveRect(cx-1, inT, cx+1, inT);

      // poop exit
      carveRect(cx, inB, cx, inB+2);

      // ESOPHAGUS conveyor
      const beltY = stEntryY;
      const trackY = stEntryY - 1;
      carveRect(stL+1, trackY, cx, trackY);

      for (let x=cx; x>=stL+4; x--) {
        if (empty(x, beltY)) safeCreate("pg_esophagus_belt", x, beltY);
      }
      carveRect(stL+2, beltY, stL+3, beltY);
      carveRect(stL+2, trackY, stL+3, trackY);

      // ---------------- VEINS placement ----------------
      // Heart center:
      const hx = cx, hy = torsoTop + 5;

      // Main vein down from heart into belly
      for (let y=hy+1; y<=torsoTop+10; y++) setOrChange(hx, y, "pg_vein_block");

      // Branch to left arm
      for (let x=hx-1; x>=cx-10; x--) setOrChange(x, hy, "pg_vein_block");
      // Branch to right arm
      for (let x=hx+1; x<=cx+10; x++) setOrChange(x, hy, "pg_vein_block");

      // Branch to legs (two lines down)
      for (let y=torsoBot-1; y<=torsoBot+10; y++) {
        setOrChange(cx-3, y, "pg_vein_block");
        setOrChange(cx+3, y, "pg_vein_block");
      }
    }

    elements.pg_big_human_seed = {
      color: ["#111111","#333333"],
      behavior: behaviors.STURDYPOWDER,
      category: CAT,
      state: "solid",
      density: 1600,
      tick: function(pixel){
        if (pixel._built) return;
        pixel._built = true;
        buildBigHumanV2(pixel.x, pixel.y);
        safeChange(pixel, "pg_skin_block");
      }
    };

  } catch (err) {
    console.error("[pg_noobkit] CRASH:", err);
  }
});
