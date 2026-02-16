// anatomy_pack.js
// Adds anatomy fluids/tissues + a Human Seed that builds a simple body.
// Drop into /mods or host elsewhere and load via Mod Manager.

(function () {
    if (typeof elements === "undefined") return;

    // ---------- Helpers ----------
    function inBounds(x, y) {
        return !(typeof outOfBounds === "function" && outOfBounds(x, y));
    }
    function empty(x, y) {
        return inBounds(x, y) && (typeof isEmpty === "function" ? isEmpty(x, y) : true);
    }
    function safeCreate(elem, x, y) {
        if (!inBounds(x, y)) return false;
        if (typeof createPixel !== "function") return false;
        if (!empty(x, y)) return false;
        if (!elements[elem]) return false;
        createPixel(elem, x, y);
        return true;
    }
    function safeChange(pixel, elem) {
        if (!elements[elem]) return;
        if (typeof changePixel === "function") changePixel(pixel, elem);
        else pixel.element = elem;
    }
    function randChance(p) {
        return Math.random() < p;
    }

    // Prefer base-game elements if they exist; otherwise create our own.
    const BLOOD = elements.blood ? "blood" : "anatomy_blood";
    const BONE  = elements.bone  ? "bone"  : "anatomy_bone";
    const ASH   = elements.ash   ? "ash"   : null;
    const STEAM = elements.steam ? "steam" : null;
    const METHANE = elements.methane ? "methane" : null;

    // ---------- Fallback basics (only if missing) ----------
    if (!elements[BLOOD]) {
        elements[BLOOD] = {
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
        elements[BONE] = {
            color: ["#e9e2d1", "#d8cfbb", "#f2ead8"],
            behavior: behaviors.WALL,
            category: "solids",
            state: "solid",
            density: 1900,
            hardness: 0.7,
            breakInto: "anatomy_bone_dust",
            tempHigh: 900,
            stateHigh: ASH || "ash",
        };
        elements.anatomy_bone_dust = {
            color: ["#e8e0cf", "#d8cfbb"],
            behavior: behaviors.POWDER,
            category: "powders",
            state: "solid",
            density: 1200,
        };
    }

    // ---------- Anatomy category ----------
    const CAT = "anatomy";

    // Fluids
    elements.brain_fluid = {
        color: ["#d9f2ff", "#c7ecff", "#e8fbff"],
        behavior: behaviors.LIQUID,
        category: CAT,
        state: "liquid",
        density: 1010,
        viscosity: 12000,
        stain: 0.03,
        tempHigh: 105,
        stateHigh: STEAM || "steam",
        reactions: {
            // makes acid weaker
            stomach_acid: { elem1: "brain_fluid", elem2: "diluted_stomach_acid", chance: 0.35 },
        }
    };

    elements.stomach_acid = {
        color: ["#c9ff3b", "#a8f000", "#d7ff6a"],
        behavior: behaviors.LIQUID,
        category: CAT,
        state: "liquid",
        density: 1040,
        viscosity: 9000,
        stain: 0.10,
        // "corrosive" effect is done via reactions
        reactions: {
            water: { elem1: "diluted_stomach_acid", elem2: "diluted_stomach_acid", chance: 0.45 },
            brain_fluid: { elem1: "diluted_stomach_acid", elem2: "diluted_stomach_acid", chance: 0.45 },
            skin: { elem1: "stomach_acid", elem2: "digested_slurry", chance: 0.25 },
            muscle_tissue: { elem1: "stomach_acid", elem2: "digested_slurry", chance: 0.25 },
            organ_flesh: { elem1: "stomach_acid", elem2: "digested_slurry", chance: 0.25 },
            brain_flesh: { elem1: "stomach_acid", elem2: "digested_slurry", chance: 0.30 },
            heart: { elem1: "stomach_acid", elem2: "digested_slurry", chance: 0.25 },
            stomach: { elem1: "stomach_acid", elem2: "digested_slurry", chance: 0.20 },
            brain: { elem1: "stomach_acid", elem2: "digested_slurry", chance: 0.25 },
        }
    };

    elements.diluted_stomach_acid = {
        color: ["#dfff80", "#cfff6a", "#e9ffb0"],
        behavior: behaviors.LIQUID,
        category: CAT,
        state: "liquid",
        density: 1020,
        viscosity: 7000,
        stain: 0.06,
        reactions: {
            skin: { elem1: "diluted_stomach_acid", elem2: "digested_slurry", chance: 0.10 },
            muscle_tissue: { elem1: "diluted_stomach_acid", elem2: "digested_slurry", chance: 0.10 },
            organ_flesh: { elem1: "diluted_stomach_acid", elem2: "digested_slurry", chance: 0.10 },
            brain_flesh: { elem1: "diluted_stomach_acid", elem2: "digested_slurry", chance: 0.12 },
        }
    };

    elements.digested_slurry = {
        color: ["#6b4b2a", "#845a34", "#5c3f22"],
        behavior: behaviors.LIQUID,
        category: CAT,
        state: "liquid",
        density: 1150,
        viscosity: 25000,
        stain: 0.12,
        tick: function (pixel) {
            // small chance to off-gas when warm
            if (pixel.temp > 25 && METHANE && randChance(0.0015)) {
                safeCreate(METHANE, pixel.x + (Math.random() < 0.5 ? -1 : 1), pixel.y - 1);
            }
        }
    };

    // Tissues / organs
    elements.organ_flesh = {
        color: ["#c96b6b", "#b85b5b", "#d77c7c"],
        behavior: behaviors.STURDYPOWDER,
        category: CAT,
        state: "solid",
        density: 1080,
        burn: 8,
        burnTime: 120,
        burnInto: ASH || "ash",
        tempHigh: 90,
        stateHigh: "cooked_tissue",
    };

    elements.brain_flesh = {
        color: ["#b3a2ad", "#c3b1bc", "#9a8a95"],
        behavior: behaviors.STURDYPOWDER,
        category: CAT,
        state: "solid",
        density: 1040,
        burn: 7,
        burnTime: 110,
        burnInto: ASH || "ash",
        tempHigh: 80,
        stateHigh: "cooked_tissue",
        reactions: {
            stomach_acid: { elem1: "digested_slurry", elem2: "stomach_acid", chance: 0.20 },
            diluted_stomach_acid: { elem1: "digested_slurry", elem2: "diluted_stomach_acid", chance: 0.10 },
        }
    };

    elements.skin = {
        color: ["#f2c6a7", "#e8b996", "#d9a785"],
        behavior: behaviors.STURDYPOWDER,
        category: CAT,
        state: "solid",
        density: 1120,
        burn: 6,
        burnTime: 160,
        burnInto: ASH || "ash",
        tempHigh: 120,
        stateHigh: "cooked_tissue",
    };

    elements.muscle_tissue = {
        color: ["#b54545", "#c85a5a", "#9c2f2f"],
        behavior: behaviors.STURDYPOWDER,
        category: CAT,
        state: "solid",
        density: 1150,
        burn: 7,
        burnTime: 140,
        burnInto: ASH || "ash",
        tempHigh: 110,
        stateHigh: "cooked_tissue",
    };

    elements.cooked_tissue = {
        color: ["#7a4a2b", "#8a5a3b", "#6a3a1b"],
        behavior: behaviors.STURDYPOWDER,
        category: CAT,
        state: "solid",
        density: 1200,
        burn: 5,
        burnTime: 80,
        burnInto: ASH || "ash",
        tempHigh: 250,
        stateHigh: ASH || "ash",
    };

    elements.brain = {
        color: ["#a99aa6", "#bdb0ba", "#948793"],
        behavior: behaviors.WALL,
        category: CAT,
        state: "solid",
        density: 1060,
        hardness: 0.15,
        burn: 6,
        burnTime: 120,
        burnInto: ASH || "ash",
        tempHigh: 85,
        stateHigh: "cooked_tissue",
        tick: function (pixel) {
            // If exposed to air/empty near it, it can "leak" brain fluid a bit
            if (randChance(0.01)) {
                const spots = [
                    [0, 1], [1, 0], [-1, 0], [0, -1]
                ];
                for (const [dx, dy] of spots) {
                    if (empty(pixel.x + dx, pixel.y + dy)) {
                        safeCreate("brain_fluid", pixel.x + dx, pixel.y + dy);
                        break;
                    }
                }
            }
        }
    };

    elements.stomach = {
        color: ["#c07a68", "#b56c5a", "#d18a79"],
        behavior: behaviors.WALL,
        category: CAT,
        state: "solid",
        density: 1100,
        hardness: 0.18,
        burn: 6,
        burnTime: 160,
        burnInto: ASH || "ash",
        tempHigh: 95,
        stateHigh: "cooked_tissue",
        tick: function (pixel) {
            // Slow internal acid leak if there's empty space around (acts like "contents")
            if (randChance(0.006)) {
                const dirs = [[0,1],[1,0],[-1,0],[0,-1]];
                for (const [dx,dy] of dirs) {
                    const nx = pixel.x + dx, ny = pixel.y + dy;
                    if (empty(nx, ny)) {
                        safeCreate("stomach_acid", nx, ny);
                        break;
                    }
                }
            }
        }
    };

    elements.heart = {
        color: ["#8c0f1f", "#a31226", "#6e0b17"],
        behavior: behaviors.WALL,
        category: CAT,
        state: "solid",
        density: 1120,
        hardness: 0.22,
        burn: 7,
        burnTime: 140,
        burnInto: ASH || "ash",
        tempHigh: 110,
        stateHigh: "cooked_tissue",
        tick: function (pixel) {
            // "pump" blood occasionally into nearby empty spaces
            if (randChance(0.03)) {
                const dirs = [[0,1],[1,0],[-1,0],[0,-1]];
                const pick = dirs[(Math.random() * dirs.length) | 0];
                const nx = pixel.x + pick[0], ny = pixel.y + pick[1];
                if (empty(nx, ny)) safeCreate(BLOOD, nx, ny);
            }
        }
    };

    // ---------- Tools ----------
    elements.anatomy_scalpel = {
        color: "#d9d9d9",
        category: "tools",
        tool: function (pixel) {
            // Slice open organs/tissue for fun anatomy interactions
            const e = pixel.element;

            // Stomach -> spill acid + become flesh
            if (e === "stomach") {
                safeCreate("stomach_acid", pixel.x, pixel.y + 1);
                safeCreate("stomach_acid", pixel.x + 1, pixel.y);
                safeCreate("digested_slurry", pixel.x - 1, pixel.y);
                safeChange(pixel, "organ_flesh");
                return;
            }

            // Brain -> spill brain fluid + become brain flesh
            if (e === "brain") {
                safeCreate("brain_fluid", pixel.x, pixel.y + 1);
                safeCreate("brain_fluid", pixel.x + 1, pixel.y);
                safeCreate("brain_fluid", pixel.x - 1, pixel.y);
                safeChange(pixel, "brain_flesh");
                return;
            }

            // Heart -> spill blood + become flesh
            if (e === "heart") {
                safeCreate(BLOOD, pixel.x, pixel.y + 1);
                safeCreate(BLOOD, pixel.x + 1, pixel.y);
                safeCreate(BLOOD, pixel.x - 1, pixel.y);
                safeChange(pixel, "organ_flesh");
                return;
            }

            // Cut other tissues -> small blood chance
            if (e === "skin" || e === "muscle_tissue" || e === "organ_flesh" || e === "brain_flesh") {
                if (randChance(0.35)) safeCreate(BLOOD, pixel.x + (Math.random() < 0.5 ? -1 : 1), pixel.y);
            }
        }
    };

    // ---------- Buildable creatures ----------
    function buildFromTemplate(cx, cy, template, legend) {
        // template: array of strings, '.' = skip
        // (cx,cy) is the center-ish anchor (we place template centered horizontally, top aligned at cy - 6 etc)
        const h = template.length;
        const w = template[0].length;

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

    const ANIMAL_TEMPLATE = [
        "..SSSSS..",
        ".SMMMMMS.",
        ".SMBOMMS.",
        ".SMMHMM.S",
        "..SMGMS..",
        "...S.S...",
        "..S...S.."
    ];

    elements.anatomy_human_seed = {
        color: ["#222222", "#444444"],
        behavior: behaviors.STURDYPOWDER,
        category: CAT,
        state: "solid",
        density: 1600,
        tick: function (pixel) {
            if (pixel._built) return;
            pixel._built = true;

            const legend = {
                "S": "skin",
                "M": "muscle_tissue",
                "O": BONE,
                "B": "brain",
                "H": "heart",
                "G": "stomach",
            };

            buildFromTemplate(pixel.x, pixel.y, HUMAN_TEMPLATE, legend);

            // Turn seed into skin so it blends in
            safeChange(pixel, "skin");
        }
    };

    elements.anatomy_animal_seed = {
        color: ["#1a1a1a", "#3a3a3a"],
        behavior: behaviors.STURDYPOWDER,
        category: CAT,
        state: "solid",
        density: 1600,
        tick: function (pixel) {
            if (pixel._built) return;
            pixel._built = true;

            const legend = {
                "S": "skin",
                "M": "muscle_tissue",
                "O": BONE,
                "B": "brain",
                "H": "heart",
                "G": "stomach",
            };

            buildFromTemplate(pixel.x, pixel.y, ANIMAL_TEMPLATE, legend);

            safeChange(pixel, "skin");
        }
    };

    // ---------- Compatibility: make base acid interact with new tissues (if acid exists) ----------
    if (elements.acid) {
        if (!elements.acid.reactions) elements.acid.reactions = {};
        elements.acid.reactions.brain_flesh = { elem1: "acid", elem2: "digested_slurry", chance: 0.18 };
        elements.acid.reactions.organ_flesh = { elem1: "acid", elem2: "digested_slurry", chance: 0.14 };
        elements.acid.reactions.muscle_tissue = { elem1: "acid", elem2: "digested_slurry", chance: 0.14 };
        elements.acid.reactions.skin = { elem1: "acid", elem2: "digested_slurry", chance: 0.12 };
    }
})();
