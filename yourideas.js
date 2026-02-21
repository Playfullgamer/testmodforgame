(() => {
  "use strict";

  if (typeof elements !== "object" || typeof behaviors !== "object") return;

  const ID = {
    PLAYER: "dm_player",
    PULSE: "dm_pulse",
    NEON_BRICK: "dm_neon_brick",
  };

  const keys = (() => {
    const state = Object.create(null);
    const set = (down) => (e) => {
      state[e.code] = down;
    };
    const clear = () => {
      for (const k in state) delete state[k];
    };

    if (typeof document !== "undefined" && document && document.addEventListener) {
      document.addEventListener("keydown", set(true));
      document.addEventListener("keyup", set(false));
    }
    if (typeof window !== "undefined" && window && window.addEventListener) {
      window.addEventListener("blur", clear);
    }

    return {
      down(code) {
        return !!state[code];
      },
    };
  })();

  const hasFn = (name) => typeof globalThis[name] === "function";
  const inBounds = (x, y) => {
    if (typeof width === "number" && typeof height === "number") {
      return x >= 0 && x < width && y >= 0 && y < height;
    }
    return !!(globalThis.pixelMap && pixelMap[x] && y >= 0 && y < pixelMap[x].length);
  };

  const getPixel = (x, y) => {
    if (!inBounds(x, y) || !globalThis.pixelMap || !pixelMap[x]) return null;
    return pixelMap[x][y] || null;
  };

  const isCellEmpty = (x, y) => {
    if (!inBounds(x, y)) return false;
    if (hasFn("isEmpty")) return isEmpty(x, y);
    return !getPixel(x, y);
  };

  const tryStep = (pixel, x, y) => {
    if (!inBounds(x, y)) return false;

    if (hasFn("tryMove") && tryMove(pixel, x, y)) return true;

    const other = getPixel(x, y);
    if (!other) return false;

    const otherDef = elements[other.element];
    if (otherDef && otherDef.movable && hasFn("swapPixels")) {
      swapPixels(pixel, other);
      return true;
    }
    return false;
  };

  const setElement = (pixel, element) => {
    if (!pixel) return;
    if (hasFn("changePixel")) changePixel(pixel, element);
    else pixel.element = element;
  };

  const spawnPulse = (x, y, dir) => {
    if (!inBounds(x, y) || !isCellEmpty(x, y) || !hasFn("createPixel")) return;

    createPixel(ID.PULSE, x, y);
    const p = getPixel(x, y);
    if (!p) return;

    p.dir = dir;
    p.life = 0;
  };

  const initPlayer = (pixel) => {
    if (pixel.dir !== 1 && pixel.dir !== -1) pixel.dir = 1;
    if (typeof pixel.cooldown !== "number") pixel.cooldown = 0;
    if (typeof pixel.jumpCd !== "number") pixel.jumpCd = 0;
  };

  const playerTick = (pixel) => {
    initPlayer(pixel);

    const left = keys.down("KeyA");
    const right = keys.down("KeyD");
    const down = keys.down("KeyS");
    const up = keys.down("KeyW");
    const shoot = keys.down("KeyQ");

    if (pixel.cooldown > 0) pixel.cooldown -= 1;
    if (pixel.jumpCd > 0) pixel.jumpCd -= 1;

    const belowSolid = !isCellEmpty(pixel.x, pixel.y + 1);
    const canJump = belowSolid && pixel.jumpCd === 0 && isCellEmpty(pixel.x, pixel.y - 1);

    if (up && canJump) {
      tryStep(pixel, pixel.x, pixel.y - 1);
      pixel.jumpCd = 6;
    }

    if (down) tryStep(pixel, pixel.x, pixel.y + 1);

    if (left && !right) {
      pixel.dir = -1;
      tryStep(pixel, pixel.x - 1, pixel.y);
    } else if (right && !left) {
      pixel.dir = 1;
      tryStep(pixel, pixel.x + 1, pixel.y);
    }

    if (isCellEmpty(pixel.x, pixel.y + 1)) tryStep(pixel, pixel.x, pixel.y + 1);

    if (shoot && pixel.cooldown === 0) {
      const sx = pixel.x + pixel.dir;
      const sy = pixel.y;
      spawnPulse(sx, sy, pixel.dir);
      pixel.cooldown = 10;
    }

    if (hasFn("doDefaults")) doDefaults(pixel);
  };

  const pulseTick = (pixel) => {
    if (pixel.dir !== 1 && pixel.dir !== -1) pixel.dir = 1;
    if (typeof pixel.life !== "number") pixel.life = 0;

    pixel.life += 1;
    if (pixel.life > 70) {
      if (hasFn("deletePixel")) deletePixel(pixel.x, pixel.y);
      return;
    }

    const steps = 2;
    for (let i = 0; i < steps; i += 1) {
      const nx = pixel.x + pixel.dir;
      const ny = pixel.y;

      if (!inBounds(nx, ny)) {
        if (hasFn("deletePixel")) deletePixel(pixel.x, pixel.y);
        return;
      }

      if (isCellEmpty(nx, ny)) {
        if (hasFn("tryMove")) tryMove(pixel, nx, ny);
        continue;
      }

      const hit = getPixel(nx, ny);
      if (hit && hit.element !== ID.PULSE && hit.element !== ID.PLAYER) {
        setElement(hit, ID.NEON_BRICK);
      }

      if (hasFn("deletePixel")) deletePixel(pixel.x, pixel.y);
      return;
    }
  };

  elements[ID.NEON_BRICK] = {
    color: ["#00e5ff", "#00ffb3", "#7c4dff"],
    behavior: behaviors.WALL,
    category: "solids",
    state: "solid",
    density: 2500,
    hardness: 0.8,
    emit: 2,
    insulate: true,
    renderer: hasFn("drawSquare")
      ? function (pixel, ctx) {
          drawSquare(ctx, pixel.color, pixel.x, pixel.y);
          if (hasFn("drawPlus")) drawPlus(ctx, pixel.color, pixel.x, pixel.y);
        }
      : undefined,
  };

  elements[ID.PULSE] = {
    color: ["#ffffff", "#b3ffff", "#00ffff"],
    behavior: behaviors.WALL,
    category: "energy",
    state: "gas",
    density: 0,
    ignoreAir: true,
    hidden: true,
    emit: 3,
    tick: pulseTick,
  };

  elements[ID.PLAYER] = {
    color: ["#ff2d55", "#ffcc00", "#34c759"],
    behavior: behaviors.WALL,
    category: "special",
    state: "solid",
    density: 9000,
    hardness: 0.95,
    insulate: true,
    tick: playerTick,
  };

  const afterLoad = hasFn("runAfterLoad") ? runAfterLoad : (fn) => fn();
  afterLoad(() => {
    const water = elements.water;
    if (water) {
      if (!water.reactions) water.reactions = {};
      water.reactions[ID.NEON_BRICK] = water.reactions[ID.NEON_BRICK] || { elem2: "steam", chance: 0.01 };
    }
  });
})();
