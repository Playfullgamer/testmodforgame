
(function(){
    if (typeof elements === "undefined") { return; }

    var root = (typeof window !== "undefined") ? window : globalThis;
    if (root.__controllerHumanModLoaded) { return; }
    root.__controllerHumanModLoaded = true;

    var CH = root.ControllerHumanState || {
        keys: {},
        prevKeys: {},
        edges: {},
        activeId: null,
        nextId: 1,
        lastHelpTick: -9999,
        keyListenersInstalled: false,
        humanSpawnTick: -1,
        zombieSpawnTick: -1,
        aiCombat: true
    };
    root.ControllerHumanState = CH;

    var HUMAN_CATEGORY = "controller mobs";
    var ZOMBIE_CATEGORY = "controller zombies";

    function say(msg) {
        if (typeof logMessage === "function") { logMessage(msg); }
        else if (typeof console !== "undefined" && console.log) { console.log(msg); }
    }

    function clamp(v, lo, hi) {
        if (v < lo) { return lo; }
        if (v > hi) { return hi; }
        return v;
    }

    function lowerKey(ev) {
        if (!ev) { return ""; }
        var k = ev.key || "";
        return ("" + k).toLowerCase();
    }

    function ignoreKeyEvent(ev) {
        if (!ev) { return false; }
        var t = ev.target;
        if (!t) { return false; }
        var tag = (t.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") { return true; }
        if (t.isContentEditable) { return true; }
        return false;
    }

    function installKeyListeners() {
        if (CH.keyListenersInstalled || typeof document === "undefined") { return; }
        CH.keyListenersInstalled = true;

        document.addEventListener("keydown", function(ev){
            if (ignoreKeyEvent(ev)) { return; }
            var k = lowerKey(ev);
            CH.keys[k] = true;
            if (CH.activeId !== null && (k === "q" || k === "z" || k === "x" || k === "g" || k === "b" || k === "n" || k === "u" || k === "c" || k === "e" || k === "r" || k === "f" || k === "v" || k === "t" || k === "h" || k === "p" || k === "m")) {
                if (ev.preventDefault) { ev.preventDefault(); }
            }
        });

        document.addEventListener("keyup", function(ev){
            if (ignoreKeyEvent(ev)) { return; }
            CH.keys[lowerKey(ev)] = false;
        });

        if (typeof window !== "undefined") {
            window.addEventListener("blur", function(){
                CH.keys = {};
                CH.prevKeys = {};
                CH.edges = {};
            });
        }
    }
    installKeyListeners();

    function getPixelSafe(x, y) {
        if (typeof outOfBounds === "function" && outOfBounds(x, y)) { return null; }
        if (typeof isEmpty === "function" && isEmpty(x, y, true)) { return null; }
        if (typeof pixelMap === "undefined" || !pixelMap[x]) { return null; }
        return pixelMap[x][y] || null;
    }

    function elemInfo(name) {
        if (typeof elements === "undefined") { return null; }
        return elements[name] || null;
    }

    function doStandard(pixel) {
        if (typeof doDefaults === "function") { doDefaults(pixel); return; }
        if (typeof doHeat === "function") { doHeat(pixel); }
        if (typeof doBurning === "function") { doBurning(pixel); }
        if (typeof doElectricity === "function") {
            try { doElectricity(pixel); }
            catch (e) { try { doElectricity(pixel, 1); } catch (e2) {} }
        }
    }

    // ---------- Species checks ----------
    function isHumanBody(p) { return !!p && p.element === "controller_human_body"; }
    function isHumanHead(p) { return !!p && p.element === "controller_human_head"; }
    function isHumanPart(p) { return isHumanBody(p) || isHumanHead(p); }

    function isZombieBody(p) { return !!p && p.element === "controller_zombie_body"; }
    function isZombieHead(p) { return !!p && p.element === "controller_zombie_head"; }
    function isZombiePart(p) { return isZombieBody(p) || isZombieHead(p); }

    function isOurPart(p) { return isHumanPart(p) || isZombiePart(p); }

    function linkedHeadForBody(body, headElem) {
        if (!body) { return null; }
        var offsets = [
            [0,-1],[1,-1],[-1,-1],[0,-2],[1,-2],[-1,-2],[0,0],[1,0],[-1,0]
        ];
        for (var i=0; i<offsets.length; i++) {
            var p = getPixelSafe(body.x + offsets[i][0], body.y + offsets[i][1]);
            if (p && p.element === headElem && p.cid === body.cid) { return p; }
        }
        return null;
    }

    function linkedBodyForHead(head, bodyElem) {
        if (!head) { return null; }
        var offsets = [
            [0,1],[1,1],[-1,1],[0,2],[1,2],[-1,2],[0,0],[1,0],[-1,0]
        ];
        for (var i=0; i<offsets.length; i++) {
            var p = getPixelSafe(head.x + offsets[i][0], head.y + offsets[i][1]);
            if (p && p.element === bodyElem && p.cid === head.cid) { return p; }
        }
        return null;
    }

    function linkedHumanHead(body) { return linkedHeadForBody(body, "controller_human_head"); }
    function linkedHumanBody(head) { return linkedBodyForHead(head, "controller_human_body"); }
    function linkedZombieHead(body) { return linkedHeadForBody(body, "controller_zombie_head"); }
    function linkedZombieBody(head) { return linkedBodyForHead(head, "controller_zombie_body"); }

    function canMoveHeadTo(head, x, y) {
        var p = getPixelSafe(x, y);
        if (!p) { return true; }
        if (p === head) { return true; }
        return false;
    }

    function headTarget(body) {
        var ox = body && typeof body.headOffsetX === "number" ? clamp(body.headOffsetX, -1, 1) : 0;
        return { x: body.x + ox, y: body.y - 1 };
    }

    function dragHeadToBody(body, head) {
        if (!body || !head) { return false; }
        var t = headTarget(body);
        if (head.x === t.x && head.y === t.y) { return true; }
        if (typeof isEmpty === "function" && isEmpty(t.x, t.y, true)) {
            movePixel(head, t.x, t.y);
            return true;
        }
        var atTarget = getPixelSafe(t.x, t.y);
        if (atTarget && atTarget !== head) { return false; }
        movePixel(head, t.x, t.y);
        return true;
    }

    function tryMovePair(body, head, nx, ny) {
        if (!body) { return false; }
        if (head) {
            var ox = body && typeof body.headOffsetX === "number" ? clamp(body.headOffsetX, -1, 1) : 0;
            if (!canMoveHeadTo(head, nx + ox, ny - 1)) { return false; }
        }
        if (!tryMove(body, nx, ny)) { return false; }
        if (head) {
            dragHeadToBody(body, head);
        }
        return true;
    }

    function onGround(body) {
        return !!getPixelSafe(body.x, body.y + 1);
    }

    function blockedAhead(body, dx) {
        if (!dx) { return false; }
        return !!getPixelSafe(body.x + dx, body.y) && !!getPixelSafe(body.x + dx, body.y - 1);
    }

    function stepMove(body, head, dx) {
        if (!dx) { return false; }
        if (tryMovePair(body, head, body.x + dx, body.y)) { return true; }
        if (tryMovePair(body, head, body.x + dx, body.y - 1)) { return true; } // step up
        return false;
    }

    function jumpStep(body, head, dx) {
        var moved = false;
        if (dx && tryMovePair(body, head, body.x + dx, body.y - 1)) { moved = true; }
        else if (tryMovePair(body, head, body.x, body.y - 1)) { moved = true; }
        else if (dx && tryMovePair(body, head, body.x + dx, body.y)) { moved = true; }
        return moved;
    }

    // ---------- Common hazard / survival ----------
    function isFoodPixel(p) {
        if (!p) { return false; }
        var e = elemInfo(p.element);
        if (!e) { return false; }
        return !!e.isFood || e.category === "food";
    }

    function isLiquidPixel(p) {
        if (!p) { return false; }
        var e = elemInfo(p.element);
        if (!e) { return false; }
        return e.state === "liquid";
    }

    function isHazardPixel(p) {
        if (!p) { return false; }
        if (isOurPart(p)) { return false; }
        if (p.burning) { return true; }
        var n = p.element;
        if (n === "fire" || n === "plasma" || n === "magma" || n === "acid" || n === "poison" || n === "infection" || n === "virus" || n === "cancer" || n === "gray_goo" || n === "antimatter" || n === "void" || n === "electric" || n === "laser" || n === "radiation" || n === "cold_fire") {
            return true;
        }
        var e = elemInfo(n);
        if (e) {
            if (e.category === "weapons") { return true; }
            if (typeof e.temp === "number" && (e.temp > 180 || e.temp < -70)) { return true; }
        }
        if (typeof p.temp === "number" && (p.temp > 140 || p.temp < -50)) { return true; }
        return false;
    }

    function getNeighborList(x, y) {
        var arr = [];
        for (var dx=-1; dx<=1; dx++) {
            for (var dy=-1; dy<=1; dy++) {
                if (!dx && !dy) { continue; }
                arr.push(getPixelSafe(x + dx, y + dy));
            }
        }
        return arr;
    }

    function hurtHumanBody(body, amount, head) {
        if (!body || body.dead) { return; }
        if (typeof body.hp !== "number") { body.hp = 100; }
        if ((body.guard || 0) > 20) {
            amount *= 0.55;
            body.stamina = clamp((body.stamina || 0) - 0.4, 0, 100);
        }
        body.hp -= amount;
        body.lastHurtTick = (typeof pixelTicks !== "undefined") ? pixelTicks : 0;
        body.hurtFlash = 3;
        body.panic = (body.panic || 0) + amount * 0.2;
        if (body.panic > 20) { body.panic = 20; }
        if (body.hp <= 0) {
            body.dead = (typeof pixelTicks !== "undefined") ? pixelTicks : 1;
            if (head) { head.dead = body.dead; }
        }
    }

    function nearbyHumanEffects(body, head) {
        var ns = getNeighborList(body.x, body.y);
        if (head) {
            var hn = getNeighborList(head.x, head.y);
            for (var i=0; i<hn.length; i++) { ns.push(hn[i]); }
        }
        var hits = 0;
        for (var j=0; j<ns.length; j++) {
            if (isHazardPixel(ns[j])) { hits++; }
        }
        if (hits > 0) { hurtHumanBody(body, hits * 0.25, head); }
        if (body.temp > 90) { hurtHumanBody(body, 0.12, head); }
        if (body.temp < -25) { hurtHumanBody(body, 0.08, head); }
        if (head && head.temp > 90) { hurtHumanBody(body, 0.15, head); }
        if (head && head.temp < -25) { hurtHumanBody(body, 0.1, head); }
    }

    function humanBreathTick(head, body) {
        if (!head || !body || body.dead) { return; }
        var wet = 0;
        var spots = [
            getPixelSafe(head.x, head.y),
            getPixelSafe(head.x+1, head.y),
            getPixelSafe(head.x-1, head.y),
            getPixelSafe(head.x, head.y+1),
            getPixelSafe(head.x, head.y-1)
        ];
        for (var i=0; i<spots.length; i++) { if (isLiquidPixel(spots[i])) { wet++; } }
        if (wet >= 3) {
            head.breath -= 1.1;
            body.oxygen -= 0.9;
            if (head.breath < 0 && ((typeof pixelTicks === "undefined") || pixelTicks % 5 === 0)) {
                hurtHumanBody(body, 1.4, head);
            }
        } else {
            head.breath = clamp((head.breath || 0) + 1.2, 0, 100);
            body.oxygen = clamp((body.oxygen || 0) + 0.8, 0, 100);
        }
    }

    function humanEatTick(body, head) {
        if (body.dead) { return; }
        body.hunger += 0.012;
        if (body.hunger > 100) { hurtHumanBody(body, 0.08, head); }
        if (body.hunger < 30) { return; }
        var dir = body.dir || 1;
        var spots = [
            [body.x + dir, body.y - 1],
            [body.x + dir, body.y],
            [body.x, body.y - 2],
            [body.x, body.y - 1],
            [body.x - dir, body.y - 1]
        ];
        for (var i=0; i<spots.length; i++) {
            var p = getPixelSafe(spots[i][0], spots[i][1]);
            if (!p || isOurPart(p)) { continue; }
            if (isFoodPixel(p)) {
                deletePixel(p.x, p.y);
                body.hunger = clamp(body.hunger - 28, 0, 100);
                body.hp = clamp(body.hp + 4, 0, 100);
                body.stamina = clamp(body.stamina + 15, 0, 100);
                break;
            }
        }
    }

    // ---------- Human init ----------
    function initHumanBody(body) {
        if (typeof body.dead === "undefined") { body.dead = false; }
        if (typeof body.cid !== "number" || !body.cid) { body.cid = CH.nextId++; }
        if (CH.activeId === null) { CH.activeId = body.cid; }
        if (typeof body.dir !== "number") { body.dir = Math.random() < 0.5 ? -1 : 1; }
        if (typeof body.panic !== "number") { body.panic = 0; }
        if (typeof body.hp !== "number") { body.hp = 100; }
        if (typeof body.stamina !== "number") { body.stamina = 100; }
        if (typeof body.oxygen !== "number") { body.oxygen = 100; }
        if (typeof body.hunger !== "number") { body.hunger = 0; }
        if (typeof body.jumpCd !== "number") { body.jumpCd = 0; }
        if (typeof body.coyote !== "number") { body.coyote = 0; }
        if (typeof body.airJumps !== "number") { body.airJumps = 1; }
        if (typeof body.jumpBoost !== "number") { body.jumpBoost = 0; }
        if (typeof body.dashCd !== "number") { body.dashCd = 0; }
        if (typeof body.dashTicks !== "number") { body.dashTicks = 0; }
        if (typeof body.dashDir !== "number") { body.dashDir = body.dir || 1; }
        if (typeof body.mode !== "number") { body.mode = 1; } // 0 manual 1 assist 2 auto
        if (typeof body.held === "undefined") { body.held = null; }
        if (typeof body.wanderDir !== "number") { body.wanderDir = body.dir || 1; }
        if (typeof body.wanderTimer !== "number") { body.wanderTimer = 0; }
        if (typeof body.healCd !== "number") { body.healCd = 0; }
        if (typeof body.attackCd !== "number") { body.attackCd = 0; }
        if (typeof body.action !== "string") { body.action = ""; }
        if (typeof body.actionTimer !== "number") { body.actionTimer = 0; }
        if (typeof body.headOffsetX !== "number") { body.headOffsetX = 0; }
        if (typeof body.animStep !== "number") { body.animStep = 0; }
        if (typeof body.hurtFlash !== "number") { body.hurtFlash = 0; }
        if (typeof body.thirst !== "number") { body.thirst = 0; }
        if (typeof body.infection !== "number") { body.infection = 0; }
        if (typeof body.guard !== "number") { body.guard = 0; }
        if (typeof body.combo !== "number") { body.combo = 0; }
        if (!Array.isArray(body.bag)) { body.bag = []; }
        if (!body.skinTone) { body.skinTone = "#e7c29b"; }
        if (!body.shirtColor) { body.shirtColor = "#4a90e2"; }
        if (!body.shirtColor2) { body.shirtColor2 = "#3f7fc8"; }
    }

    function initHumanHead(head) {
        if (typeof head.dead === "undefined") { head.dead = false; }
        if (typeof head.breath !== "number") { head.breath = 100; }
        if (typeof head.cid !== "number" || !head.cid) { head.cid = CH.nextId++; }
    }

    // ---------- Human interactions ----------
    function findPickupTarget(body) {
        var dir = body.dir || 1;
        var cands = [
            [body.x + dir, body.y - 1],
            [body.x + dir, body.y],
            [body.x, body.y - 2],
            [body.x + dir, body.y - 2],
            [body.x - dir, body.y - 1]
        ];
        for (var i=0; i<cands.length; i++) {
            var p = getPixelSafe(cands[i][0], cands[i][1]);
            if (!p || isOurPart(p)) { continue; }
            var e = elemInfo(p.element);
            if (!e) { continue; }
            if (e.category === "tools" || e.category === "special") { continue; }
            if (p.element === "wall" || p.element === "void") { continue; }
            return p;
        }
        return null;
    }

    function doPickup(body) {
        if (!Array.isArray(body.bag)) { body.bag = []; }
        if (body.held && body.bag.length >= 6) { return false; }
        var t = findPickupTarget(body);
        if (!t) { return false; }
        if (body.held) { body.bag.push(body.held); }
        body.held = t.element;
        deletePixel(t.x, t.y);
        body.stamina = clamp(body.stamina - 2, 0, 100);
        body.action = "pickup";
        body.actionTimer = 4;
        return true;
    }

    function cycleHeld(body) {
        if (!body) { return false; }
        if (!Array.isArray(body.bag)) { body.bag = []; }
        if (!body.held && !body.bag.length) { return false; }
        if (!body.held) {
            body.held = body.bag.shift();
            return true;
        }
        body.bag.push(body.held);
        body.held = body.bag.shift();
        body.action = "swap";
        body.actionTimer = 3;
        return true;
    }

    function dropHeld(body) {
        if (!body || !body.held) { return false; }
        if (!Array.isArray(body.bag)) { body.bag = []; }
        var dir = body.dir || 1;
        var spots = [
            [body.x + dir, body.y - 1],
            [body.x + dir, body.y],
            [body.x, body.y - 1],
            [body.x - dir, body.y - 1]
        ];
        for (var i=0; i<spots.length; i++) {
            var x = spots[i][0], y = spots[i][1];
            if (typeof isEmpty === "function" && isEmpty(x, y, true)) {
                createPixel(body.held, x, y);
                body.held = null;
                if (body.bag.length) { body.held = body.bag.shift(); }
                body.action = "drop";
                body.actionTimer = 3;
                return true;
            }
        }
        return false;
    }

    function doPlace(body, head, throwFar) {
        if (!body.held) { return false; }
        var dir = body.dir || 1;
        var spots = throwFar ? [
            [body.x + dir*2, body.y - 1],
            [body.x + dir*2, body.y - 2],
            [body.x + dir*3, body.y - 1],
            [body.x + dir, body.y - 1]
        ] : [
            [body.x + dir, body.y - 1],
            [body.x + dir, body.y],
            [body.x, body.y - 2],
            [body.x + dir, body.y - 2]
        ];
        for (var i=0; i<spots.length; i++) {
            var x = spots[i][0], y = spots[i][1];
            if (typeof isEmpty === "function" && isEmpty(x, y, true)) {
                createPixel(body.held, x, y);
                body.held = null;
                if (body.bag.length) { body.held = body.bag.shift(); }
                body.stamina = clamp(body.stamina - (throwFar ? 4 : 1), 0, 100);
                body.action = throwFar ? "throw" : "place";
                body.actionTimer = throwFar ? 6 : 4;
                return true;
            }
        }
        return false;
    }

    function doPunch(body, head) {
        if (body.attackCd > 0 || body.stamina < 3) { return false; }
        var dir = body.dir || 1;
        var hits = [
            getPixelSafe(body.x + dir, body.y - 1),
            getPixelSafe(body.x + dir, body.y),
            getPixelSafe(body.x + dir, body.y - 2)
        ];
        for (var i=0; i<hits.length; i++) {
            var p = hits[i];
            if (!p || isOurPart(p)) { continue; }
            if (typeof isEmpty === "function" && isEmpty(p.x + dir, p.y, true)) { movePixel(p, p.x + dir, p.y); }
            else if (typeof isEmpty === "function" && isEmpty(p.x + dir, p.y - 1, true)) { movePixel(p, p.x + dir, p.y - 1); }

            if (isHazardPixel(p)) { hurtHumanBody(body, 1.0, head); }
            var bonus = Math.min(body.combo, 4);
            if (isHumanBody(p)) { hurtHumanBody(p, 6 + bonus, linkedHumanHead(p)); }
            else if (isHumanHead(p)) { var hb = linkedHumanBody(p); if (hb) { hurtHumanBody(hb, 8 + bonus, p); } }
            else if (isZombieBody(p)) { hurtZombieBody(p, 8 + bonus, linkedZombieHead(p)); }
            else if (isZombieHead(p)) { var zb = linkedZombieBody(p); if (zb) { hurtZombieBody(zb, 10 + bonus, p); } }

            body.stamina = clamp(body.stamina - 4, 0, 100);
            body.attackCd = 5;
            body.combo = clamp((body.combo || 0) + 1, 0, 8);
            body.action = "punch";
            body.actionTimer = 6;
            return true;
        }
        body.combo = 0;
        return false;
    }

    function doKick(body, head) {
        if (body.attackCd > 0 || body.stamina < 6) { return false; }
        var dir = body.dir || 1;
        var hits = [
            getPixelSafe(body.x + dir, body.y),
            getPixelSafe(body.x + dir*2, body.y),
            getPixelSafe(body.x + dir, body.y - 1)
        ];
        for (var i=0; i<hits.length; i++) {
            var p = hits[i];
            if (!p || isOurPart(p)) { continue; }
            var moved = false;
            if (typeof isEmpty === "function" && isEmpty(p.x + dir*2, p.y, true)) { movePixel(p, p.x + dir*2, p.y); moved = true; }
            else if (typeof isEmpty === "function" && isEmpty(p.x + dir, p.y - 1, true)) { movePixel(p, p.x + dir, p.y - 1); moved = true; }
            if (isHumanBody(p)) { hurtHumanBody(p, 10, linkedHumanHead(p)); }
            else if (isHumanHead(p)) { var hb = linkedHumanBody(p); if (hb) { hurtHumanBody(hb, 12, p); } }
            else if (isZombieBody(p)) { hurtZombieBody(p, 13, linkedZombieHead(p)); }
            else if (isZombieHead(p)) { var zb = linkedZombieBody(p); if (zb) { hurtZombieBody(zb, 14, p); } }
            if (moved && p.burning) { hurtHumanBody(body, 1.5, head); }
            body.stamina = clamp(body.stamina - 8, 0, 100);
            body.attackCd = 8;
            body.combo = 0;
            body.action = "kick";
            body.actionTimer = 8;
            return true;
        }
        return false;
    }

    function doHeal(body) {
        if (body.dead) { return false; }
        if (body.healCd > 0) { return false; }
        if (body.hp >= 100) { return false; }
        if (body.stamina < 18 || body.hunger > 82 || body.thirst > 90) { return false; }
        body.hp = clamp(body.hp + 16, 0, 100);
        body.stamina = clamp(body.stamina - 18, 0, 100);
        body.hunger = clamp(body.hunger + 8, 0, 100);
        body.infection = clamp(body.infection - 12, 0, 100);
        body.healCd = 45;
        body.action = "heal";
        body.actionTimer = 10;
        return true;
    }

    function showHumanStats(body) {
        if (!body) { return; }
        var bagCount = Array.isArray(body.bag) ? body.bag.length : 0;
        say("[Controller Human #" + body.cid + "] HP " + Math.round(body.hp) + " | STA " + Math.round(body.stamina) + " | HUN " + Math.round(body.hunger) + " | THR " + Math.round(body.thirst) + " | INF " + Math.round(body.infection) + " | O2 " + Math.round(body.oxygen) + " | Held: " + (body.held || "none") + " | Bag: " + bagCount + " | Mode: " + modeName(body.mode));
    }

    function isDrinkableLiquid(p) {
        if (!p) { return false; }
        if (!isLiquidPixel(p)) { return false; }
        if (isHazardPixel(p)) { return false; }
        var n = p.element;
        if (n === "water" || n === "salt_water" || n === "sugar_water" || n === "dirty_water" || n === "pool_water" || n === "seltzer") { return true; }
        return false;
    }

    function humanStatusTick(body, head) {
        if (!body || body.dead) { return; }
        body.thirst = clamp((body.thirst || 0) + 0.015, 0, 120);
        if (body.thirst > 85) { hurtHumanBody(body, 0.08, head); }

        var zombieNear = 0;
        for (var dx=-2; dx<=2; dx++) {
            for (var dy=-2; dy<=2; dy++) {
                if (dx === 0 && dy === 0) { continue; }
                var p = getPixelSafe(body.x + dx, body.y + dy);
                if (isZombiePart(p)) { zombieNear++; }
            }
        }
        if (zombieNear > 0) {
            body.infection = clamp((body.infection || 0) + 0.08 * zombieNear, 0, 100);
        } else {
            body.infection = clamp((body.infection || 0) - 0.03, 0, 100);
        }

        if (body.infection > 92 && Math.random() < 0.004) {
            convertHumanToZombie(body, head);
            return;
        }

        if (body.thirst > 25 && head) {
            var drinkSpots = [
                getPixelSafe(head.x, head.y),
                getPixelSafe(head.x + 1, head.y),
                getPixelSafe(head.x - 1, head.y),
                getPixelSafe(head.x, head.y + 1)
            ];
            for (var i=0; i<drinkSpots.length; i++) {
                if (!isDrinkableLiquid(drinkSpots[i])) { continue; }
                body.thirst = clamp(body.thirst - 1.5, 0, 120);
                body.oxygen = clamp(body.oxygen + 0.2, 0, 100);
                break;
            }
        }
    }

    function nearestCombatTarget(body, head, radius) {
        var ox = head ? head.x : body.x;
        var oy = head ? head.y : body.y - 1;
        var best = null;
        var bestDist = 999;
        for (var dx=-radius; dx<=radius; dx++) {
            for (var dy=-radius; dy<=radius; dy++) {
                var p = getPixelSafe(ox + dx, oy + dy);
                if (!p || isHumanPart(p)) { continue; }
                var valid = isZombiePart(p) || p.element === "body" || p.element === "head";
                if (!valid) { continue; }
                var d = Math.abs(dx) + Math.abs(dy);
                if (d < bestDist) {
                    bestDist = d;
                    best = { p: p, dx: dx, dy: dy, dist: d };
                }
            }
        }
        return best;
    }

    function doStomp(body) {
        if (!body || body.attackCd > 0 || body.stamina < 10) { return false; }
        var hits = [
            getPixelSafe(body.x, body.y + 1),
            getPixelSafe(body.x + (body.dir || 1), body.y + 1),
            getPixelSafe(body.x - (body.dir || 1), body.y + 1)
        ];
        for (var i=0; i<hits.length; i++) {
            var p = hits[i];
            if (!p || isHumanPart(p)) { continue; }
            if (isZombieBody(p)) { hurtZombieBody(p, 16, linkedZombieHead(p)); }
            else if (isZombieHead(p)) {
                var zb = linkedZombieBody(p);
                if (zb) { hurtZombieBody(zb, 18, p); }
            } else if (isHumanBody(p)) { hurtHumanBody(p, 12, linkedHumanHead(p)); }
            else if (isHumanHead(p)) {
                var hb = linkedHumanBody(p);
                if (hb) { hurtHumanBody(hb, 14, p); }
            } else if (!isOurPart(p) && typeof isEmpty === "function" && isEmpty(p.x, p.y + 1, true)) {
                movePixel(p, p.x, p.y + 1);
            }
            body.stamina = clamp(body.stamina - 10, 0, 100);
            body.attackCd = 10;
            body.action = "stomp";
            body.actionTimer = 8;
            return true;
        }
        return false;
    }

    // ---------- Human AI ----------
    function manualIntent() {
        var left = !!CH.keys["a"];
        var right = !!CH.keys["d"];
        var dx = 0;
        if (left && !right) { dx = -1; }
        else if (right && !left) { dx = 1; }
        return {
            dx: dx,
            jumpPress: !!CH.edges["w"],
            jumpHold: !!CH.keys["w"],
            crouch: !!CH.keys["s"],
            sprint: !!CH.keys["shift"],
            guard: !!CH.keys["t"],
            dash: !!CH.edges["c"],
            punch: !!CH.edges["x"],
            kick: !!CH.edges["e"],
            stomp: !!CH.edges["h"],
            pickup: !!CH.edges["q"],
            place: !!CH.edges["z"],
            throwItem: !!CH.edges["g"],
            swapHeld: !!CH.edges["v"],
            dropHeld: !!CH.edges["p"],
            heal: !!CH.edges["r"],
            stats: !!CH.edges["f"],
            toggleAiCombat: !!CH.edges["m"]
        };
    }

    function aiIntent(body, head, assistMode) {
        var intent = {
            dx: 0, jumpPress: false, jumpHold: false, crouch: false, sprint: false,
            guard: false, dash: false, punch: false, kick: false, stomp: false,
            pickup: false, place: false, throwItem: false, swapHeld: false, dropHeld: false,
            heal: false, stats: false, toggleAiCombat: false
        };
        var hx = head ? head.x : body.x;
        var hy = head ? head.y : body.y - 1;

        var awayScore = 0;
        var foodScore = 0;
        var bestHazardDist = 999;

        for (var dx=-6; dx<=6; dx++) {
            for (var dy=-5; dy<=4; dy++) {
                var p = getPixelSafe(hx + dx, hy + dy);
                if (!p || isOurPart(p)) { continue; }
                var dist = Math.abs(dx) + Math.abs(dy);
                if (dist < 1) { dist = 1; }
                if (isHazardPixel(p)) {
                    awayScore += (-dx) / dist;
                    if (dist < bestHazardDist) { bestHazardDist = dist; }
                    if (dy >= 0 && dist <= 2) { intent.jumpPress = true; intent.jumpHold = true; }
                    if (dist <= 2 && body.stamina > 35) { intent.dash = true; }
                }
                if (body.hunger > 35 && isFoodPixel(p)) { foodScore += dx / dist; }
            }
        }

        if (body.hp < 45 && body.stamina > 35 && body.hunger < 75 && body.infection < 88) { intent.heal = true; }

        var desiredDx = 0;
        if (bestHazardDist <= 4 && awayScore !== 0) {
            desiredDx = awayScore > 0 ? 1 : -1;
            intent.sprint = body.stamina > 25;
        }
        else if (body.hunger > 35 && foodScore !== 0) {
            desiredDx = foodScore > 0 ? 1 : -1;
        }
        else {
            body.wanderTimer -= 1;
            if (body.wanderTimer <= 0) {
                body.wanderTimer = 20 + Math.floor(Math.random() * 60);
                body.wanderDir = Math.random() < 0.2 ? 0 : (Math.random() < 0.5 ? -1 : 1);
            }
            desiredDx = body.wanderDir || 0;
            if (Math.random() < 0.01) { intent.jumpPress = true; intent.jumpHold = true; }
        }

        if (desiredDx && blockedAhead(body, desiredDx) && Math.random() < 0.45) {
            intent.jumpPress = true;
            intent.jumpHold = true;
        }

        if (CH.aiCombat) {
            var target = nearestCombatTarget(body, head, 5);
            if (target) {
                if (target.dx < 0) { desiredDx = -1; }
                else if (target.dx > 0) { desiredDx = 1; }
                if (target.dist <= 3 && body.stamina > 10) { intent.sprint = true; }
                if (target.dy < -1 && body.jumpCd <= 0) { intent.jumpPress = true; intent.jumpHold = true; }
                if (target.dist <= 1 && body.attackCd <= 0) {
                    if (Math.abs(target.dy) <= 1 && body.stamina >= 6) { intent.kick = Math.random() < 0.35; }
                    intent.punch = !intent.kick;
                } else if (target.dist <= 2 && body.attackCd <= 0 && body.stamina >= 10 && Math.random() < 0.15) {
                    intent.stomp = true;
                }
            }
        }

        intent.dx = desiredDx;

        if (assistMode && bestHazardDist > 4 && body.hunger <= 60) {
            intent.dx = 0;
            intent.jumpPress = false;
            intent.jumpHold = false;
            intent.sprint = false;
            intent.dash = false;
            intent.heal = false;
            intent.punch = false;
            intent.kick = false;
            intent.stomp = false;
        }
        if (bestHazardDist <= 2 && body.stamina > 15) { intent.guard = true; }
        return intent;
    }

    function mergeIntents(manual, auto, mode) {
        if (mode === 2) { return auto; }
        if (mode === 1) {
            var out = {
                dx: manual.dx,
                jumpPress: manual.jumpPress,
                jumpHold: manual.jumpHold,
                crouch: manual.crouch,
                sprint: manual.sprint,
                guard: manual.guard,
                dash: manual.dash,
                punch: manual.punch,
                kick: manual.kick,
                stomp: manual.stomp,
                pickup: manual.pickup,
                place: manual.place,
                throwItem: manual.throwItem,
                swapHeld: manual.swapHeld,
                dropHeld: manual.dropHeld,
                heal: manual.heal,
                stats: manual.stats,
                toggleAiCombat: manual.toggleAiCombat
            };
            if (auto.dx && !manual.dx) { out.dx = auto.dx; }
            if (auto.jumpPress) { out.jumpPress = true; }
            if (auto.jumpHold) { out.jumpHold = true; }
            if (auto.sprint && !manual.sprint) { out.sprint = true; }
            if (auto.guard && !manual.guard) { out.guard = true; }
            if (auto.dash && !manual.dash) { out.dash = true; }
            if (auto.punch && !manual.punch) { out.punch = true; }
            if (auto.kick && !manual.kick) { out.kick = true; }
            if (auto.stomp && !manual.stomp) { out.stomp = true; }
            if (auto.heal && !manual.heal) { out.heal = true; }
            return out;
        }
        return manual;
    }

    function updateHumanVisuals(body, head, moved, intent) {
        if (!body) { return; }
        if (body.hurtFlash > 0) { body.hurtFlash--; }
        if (body.actionTimer > 0) { body.actionTimer--; }
        else if (body.action) { body.action = ""; }

        var lean = 0;
        if (body.action === "punch" || body.action === "kick" || body.action === "throw") {
            lean = body.dir || 1;
        } else if (body.action === "heal") {
            lean = 0;
        } else if (intent.crouch) {
            lean = 0;
        } else if (moved && intent.dx) {
            lean = intent.dx > 0 ? 1 : -1;
        }
        body.headOffsetX = lean;

        if (moved && intent.dx) { body.animStep = (body.animStep + 1) % 8; }

        var bodyCol = body.shirtColor || "#4a90e2";
        if (body.action === "dash") { bodyCol = "#7cc7ff"; }
        else if (body.action === "kick") { bodyCol = "#f0a64b"; }
        else if (body.action === "punch") { bodyCol = "#ffb36b"; }
        else if (body.action === "stomp") { bodyCol = "#d2a0ff"; }
        else if (body.action === "heal") { bodyCol = "#7cd67c"; }
        else if ((body.guard || 0) > 20) { bodyCol = "#92b4ff"; }
        else if (moved && body.animStep % 2 === 0) { bodyCol = body.shirtColor2 || bodyCol; }
        if (body.hurtFlash > 0) { bodyCol = "#d85d5d"; }
        body.color = bodyCol;

        if (head) {
            var headCol = body.skinTone || "#e7c29b";
            if (body.hurtFlash > 0) { headCol = "#ffb1b1"; }
            else if (body.action === "heal") { headCol = "#bff0bf"; }
            head.color = headCol;
        }
    }

    function applyHumanMovementAndActions(body, head, intent, isControlled) {
        if (!body || body.dead) { return; }
        initHumanBody(body);
        if (head) { initHumanHead(head); }

        if (intent.dx) { body.dir = intent.dx > 0 ? 1 : -1; }

        if (body.jumpCd > 0) { body.jumpCd--; }
        if (body.dashCd > 0) { body.dashCd--; }
        if (body.healCd > 0) { body.healCd--; }
        if (body.attackCd > 0) { body.attackCd--; }
        if (body.coyote > 0) { body.coyote--; }

        if (onGround(body)) {
            body.coyote = 6;
            body.airJumps = 1;
            if (body.jumpBoost < 0) { body.jumpBoost = 0; }
        }

        // jump start (high jump + coyote + double jump)
        if (intent.jumpPress && body.jumpCd <= 0) {
            var canGroundJump = onGround(body) || body.coyote > 0;
            var didStart = false;
            if (canGroundJump) {
                body.jumpBoost = 5;
                body.jumpCd = 3;
                body.coyote = 0;
                body.stamina = clamp(body.stamina - 4, 0, 100);
                body.action = "jump";
                body.actionTimer = 5;
                didStart = jumpStep(body, head, intent.dx || 0);
                if (Math.random() < 0.25 && typeof isEmpty === "function" && isEmpty(body.x, body.y + 1, true)) {
                    // optional dust when jumping from flat ground
                }
            } else if (body.airJumps > 0) {
                body.airJumps--;
                body.jumpBoost = 4;
                body.jumpCd = 3;
                body.stamina = clamp(body.stamina - 7, 0, 100);
                body.action = "jump";
                body.actionTimer = 6;
                didStart = jumpStep(body, head, intent.dx || 0);
            } else {
                // small wall-jump assist
                if (intent.dx && getPixelSafe(body.x - intent.dx, body.y) && !getPixelSafe(body.x + intent.dx, body.y)) {
                    body.dir = intent.dx;
                    body.jumpBoost = 4;
                    body.jumpCd = 3;
                    body.stamina = clamp(body.stamina - 7, 0, 100);
                    jumpStep(body, head, intent.dx);
                    didStart = true;
                }
            }
            if (didStart) { body.jumpBoost = Math.max(body.jumpBoost - 1, 0); }
        }

        // held jump boost
        if (body.jumpBoost > 0) {
            if (intent.jumpHold) {
                if (jumpStep(body, head, intent.dx || 0)) {
                    body.jumpBoost--;
                    body.stamina = clamp(body.stamina - 0.7, 0, 100);
                } else {
                    body.jumpBoost = 0;
                }
            } else {
                body.jumpBoost = 0;
            }
        }

        // dash
        if (intent.dash && body.dashCd <= 0 && body.stamina >= 10) {
            body.dashCd = 24;
            body.dashTicks = 3;
            body.dashDir = body.dir || (intent.dx || 1);
            body.stamina = clamp(body.stamina - 10, 0, 100);
            body.action = "dash";
            body.actionTimer = 8;
        }

        var moved = false;
        var sprinting = !!intent.sprint && body.stamina > 8;
        var moveSteps = sprinting ? 2 : 1;
        var guarding = !!intent.guard && body.stamina > 0;

        if (guarding) {
            body.guard = clamp((body.guard || 0) + 1.2, 0, 100);
            body.stamina = clamp(body.stamina - 0.25, 0, 100);
        } else {
            body.guard = clamp((body.guard || 0) - 1.3, 0, 100);
        }

        if (body.dashTicks > 0) {
            var dashDx = body.dashDir || body.dir || 1;
            for (var ds=0; ds<3; ds++) {
                if (stepMove(body, head, dashDx)) { moved = true; }
                else if (jumpStep(body, head, dashDx)) { moved = true; }
            }
            body.dashTicks--;
            body.stamina = clamp(body.stamina - 1.2, 0, 100);
        }

        if (intent.dx) {
            for (var i=0; i<moveSteps; i++) {
                if (stepMove(body, head, intent.dx)) {
                    moved = true;
                    body.stamina = clamp(body.stamina - (sprinting ? 1.15 : 0.45), 0, 100);
                } else if (blockedAhead(body, intent.dx) && (onGround(body) || body.coyote > 0) && body.jumpCd <= 0) {
                    // auto-step jump for smoother platforming
                    if (jumpStep(body, head, intent.dx)) {
                        body.jumpBoost = Math.max(body.jumpBoost, 2);
                        body.jumpCd = 3;
                        moved = true;
                    }
                } else {
                    break;
                }
            }
        }

        // gravity (manual because this element uses custom tick)
        var fallSteps = 1;
        if (!onGround(body) && body.jumpBoost <= 0) { fallSteps = 2; }
        for (var f=0; f<fallSteps; f++) {
            if (body.jumpBoost > 0 && intent.jumpHold) { break; } // don't cancel held jump instantly
            if (tryMovePair(body, head, body.x, body.y + 1)) { moved = true; }
            else { break; }
        }

        if (!moved && !guarding) { body.stamina = clamp(body.stamina + 0.35, 0, 100); }
        else { body.stamina = clamp(body.stamina + 0.05, 0, 100); }

        if (body.panic > 0) {
            body.panic -= 0.02;
            if (body.panic < 0) { body.panic = 0; }
        }

        if (isControlled) {
            if (intent.pickup) {
                if (body.held) { doPlace(body, head, false); }
                else { doPickup(body); }
            }
            if (intent.place) { doPlace(body, head, false); }
            if (intent.throwItem) { doPlace(body, head, true); }
            if (intent.swapHeld) { cycleHeld(body); }
            if (intent.dropHeld) { dropHeld(body); }
            if (intent.punch) { doPunch(body, head); }
            if (intent.kick) { doKick(body, head); }
            if (intent.stomp) { doStomp(body); }
            if (intent.heal) { doHeal(body); }
            if (intent.stats) { showHumanStats(body); }
            if (intent.toggleAiCombat) {
                CH.aiCombat = !CH.aiCombat;
                say("[Controller Human] AI combat " + (CH.aiCombat ? "ON" : "OFF"));
            }
        } else {
            // auto/assist can still self-heal
            if (intent.heal && Math.random() < 0.6) { doHeal(body); }
            if (intent.punch) { doPunch(body, head); }
            else if (intent.kick) { doKick(body, head); }
            else if (intent.stomp) { doStomp(body); }
        }

        updateHumanVisuals(body, head, moved, intent);
        if (head) { dragHeadToBody(body, head); }
    }

    // ---------- Human management ----------
    function collectHumanBodies() {
        var out = [];
        if (typeof pixelMap === "undefined") { return out; }
        for (var x=0; x<pixelMap.length; x++) {
            var col = pixelMap[x];
            if (!col) { continue; }
            for (var y=0; y<col.length; y++) {
                var p = col[y];
                if (isHumanBody(p)) { out.push(p); }
            }
        }
        out.sort(function(a,b){ return (a.cid||0)-(b.cid||0); });
        return out;
    }

    function findHumanBodyById(cid) {
        if (cid === null || typeof cid === "undefined") { return null; }
        var all = collectHumanBodies();
        for (var i=0; i<all.length; i++) { if (all[i].cid === cid) { return all[i]; } }
        return null;
    }

    function modeName(m) {
        if (m === 0) { return "Manual"; }
        if (m === 1) { return "Assist"; }
        if (m === 2) { return "Auto"; }
        return "?";
    }

    function cycleActiveHuman() {
        var all = collectHumanBodies();
        if (!all.length) {
            CH.activeId = null;
            say("[Controller Human] No controller humans found.");
            return;
        }
        var idx = -1;
        for (var i=0; i<all.length; i++) { if (all[i].cid === CH.activeId) { idx = i; break; } }
        idx = (idx + 1) % all.length;
        CH.activeId = all[idx].cid;
        say("[Controller Human] Active #" + CH.activeId + " | Mode: " + modeName(all[idx].mode));
    }

    function cycleMode() {
        var body = findHumanBodyById(CH.activeId);
        if (!body) { say("[Controller Human] No active human."); return; }
        body.mode = ((body.mode || 0) + 1) % 3;
        say("[Controller Human] #" + body.cid + " -> " + modeName(body.mode));
    }

    function showHelp() {
        var pt = (typeof pixelTicks !== "undefined") ? pixelTicks : 0;
        if (pt - CH.lastHelpTick < 10) { return; }
        CH.lastHelpTick = pt;
        say("[Controller Human] WASD move | Hold W high jump + double jump | Shift sprint | T guard | C dash | X punch | E kick | H stomp | Q pickup | Z place | G throw | V swap slot | P drop | R heal | F stats | M toggle AI-combat | B cycle | N mode | U help");
    }

    // ---------- Zombies ----------
    function initZombieBody(body) {
        if (typeof body.dead === "undefined") { body.dead = false; }
        if (typeof body.cid !== "number" || !body.cid) { body.cid = CH.nextId++; }
        if (typeof body.hp !== "number") { body.hp = 120; }
        if (typeof body.dir !== "number") { body.dir = Math.random() < 0.5 ? -1 : 1; }
        if (typeof body.jumpCd !== "number") { body.jumpCd = 0; }
        if (typeof body.jumpBoost !== "number") { body.jumpBoost = 0; }
        if (typeof body.headOffsetX !== "number") { body.headOffsetX = 0; }
        if (typeof body.animStep !== "number") { body.animStep = 0; }
        if (typeof body.attackCd !== "number") { body.attackCd = 0; }
        if (typeof body.actionTimer !== "number") { body.actionTimer = 0; }
        if (typeof body.hurtFlash !== "number") { body.hurtFlash = 0; }
        if (typeof body.wanderDir !== "number") { body.wanderDir = body.dir; }
        if (typeof body.wanderTimer !== "number") { body.wanderTimer = 0; }
        if (!body.skinTone) { body.skinTone = "#87b36b"; }
    }

    function initZombieHead(head) {
        if (typeof head.dead === "undefined") { head.dead = false; }
        if (typeof head.cid !== "number" || !head.cid) { head.cid = CH.nextId++; }
    }

    function hurtZombieBody(body, amount, head) {
        if (!body || body.dead) { return; }
        body.hp = (typeof body.hp === "number") ? body.hp : 120;
        body.hp -= amount;
        body.hurtFlash = 3;
        if (body.hp <= 0) {
            body.dead = (typeof pixelTicks !== "undefined") ? pixelTicks : 1;
            if (head) { head.dead = body.dead; }
        }
    }

    function zombieTargetScore(p) {
        if (!p) { return 0; }
        if (isZombiePart(p)) { return 0; }
        if (isHumanPart(p)) { return 10; }
        if (p.element === "body" || p.element === "head") { return 6; } // vanilla humans
        var e = elemInfo(p.element);
        if (!e) { return 0; }
        if (e.category === "life") { return 3; }
        return 0;
    }

    function findZombieTarget(body, head) {
        var hx = head ? head.x : body.x;
        var hy = head ? head.y : body.y - 1;
        var best = null;
        var bestDist = 999;
        for (var dx=-12; dx<=12; dx++) {
            for (var dy=-8; dy<=8; dy++) {
                var p = getPixelSafe(hx + dx, hy + dy);
                var score = zombieTargetScore(p);
                if (!score) { continue; }
                var dist = Math.abs(dx) + Math.abs(dy);
                if (dist < 1) { dist = 1; }
                var weighted = dist - score*0.4;
                if (weighted < bestDist) {
                    bestDist = weighted;
                    best = { pixel: p, dx: dx, dy: dy, dist: dist };
                }
            }
        }
        return best;
    }

    function convertHumanToZombie(hBody, hHead) {
        if (!hBody) { return false; }
        var hx = hHead ? hHead.x : hBody.x;
        var hy = hHead ? hHead.y : hBody.y - 1;
        changePixel(hBody, "controller_zombie_body", false);
        var zBody = getPixelSafe(hBody.x, hBody.y) || hBody;
        if (hHead) {
            changePixel(hHead, "controller_zombie_head", false);
        } else if (typeof isEmpty === "function" && isEmpty(hx, hy, true)) {
            createPixel("controller_zombie_head", hx, hy);
        }
        var zHead = getPixelSafe(hx, hy);
        var id = CH.nextId++;
        if (zBody) {
            zBody.cid = id;
            zBody.dead = false;
            zBody.hp = 120;
            zBody.dir = Math.random() < 0.5 ? -1 : 1;
            zBody.jumpCd = 0;
            zBody.jumpBoost = 0;
            zBody.attackCd = 0;
            zBody.headOffsetX = 0;
            zBody.hurtFlash = 0;
        }
        if (zHead && zHead.element === "controller_zombie_head") {
            zHead.cid = id;
            zHead.dead = false;
        }
        return true;
    }

    function zombieAttack(body, head) {
        if (!body || body.dead) { return false; }
        if (body.attackCd > 0) { return false; }
        var dir = body.dir || 1;
        var cells = [
            getPixelSafe(body.x + dir, body.y - 1),
            getPixelSafe(body.x + dir, body.y),
            getPixelSafe(body.x + dir*2, body.y - 1),
            getPixelSafe(body.x + dir*2, body.y)
        ];
        for (var i=0; i<cells.length; i++) {
            var p = cells[i];
            if (!p || isZombiePart(p)) { continue; }

            if (isHumanBody(p)) {
                var hh = linkedHumanHead(p);
                hurtHumanBody(p, 9, hh);
                p.infection = clamp((p.infection || 0) + 9, 0, 100);
                if ((p.dead || p.hp <= 0) && Math.random() < 0.65) { convertHumanToZombie(p, hh); }
                body.attackCd = 10;
                body.actionTimer = 8;
                return true;
            }
            if (isHumanHead(p)) {
                var hb = linkedHumanBody(p);
                if (hb) {
                    hurtHumanBody(hb, 11, p);
                    hb.infection = clamp((hb.infection || 0) + 12, 0, 100);
                    if ((hb.dead || hb.hp <= 0) && Math.random() < 0.65) { convertHumanToZombie(hb, p); }
                } else if (Math.random() < 0.3) {
                    changePixel(p, "rotten_meat", false);
                }
                body.attackCd = 10;
                body.actionTimer = 8;
                return true;
            }

            // vanilla humans / other life: just shove + damage-ish
            var e = elemInfo(p.element);
            if (p.element === "body" || p.element === "head" || (e && e.category === "life")) {
                if (typeof isEmpty === "function" && isEmpty(p.x + dir, p.y, true)) { movePixel(p, p.x + dir, p.y); }
                if (typeof p.temp === "number") { p.temp += 2; }
                if (Math.random() < 0.22 && p.element !== "fire") { p.burning = true; } // chaotic zombie bites
                body.attackCd = 10;
                body.actionTimer = 8;
                return true;
            }
        }
        return false;
    }

    function updateZombieVisuals(body, head, moved) {
        if (body.hurtFlash > 0) { body.hurtFlash--; }
        if (body.attackCd > 0) { body.attackCd--; }
        if (body.actionTimer > 0) { body.actionTimer--; }

        var lean = 0;
        if (body.actionTimer > 0) { lean = body.dir || 1; }
        else if (moved) { lean = body.dir || 1; }
        body.headOffsetX = lean;

        if (moved) { body.animStep = (body.animStep + 1) % 8; }

        body.color = (body.hurtFlash > 0) ? "#6a3030" : (body.animStep % 2 === 0 ? "#3f7a3f" : "#4f8e4f");
        if (head) { head.color = (body.hurtFlash > 0) ? "#b56565" : (body.actionTimer > 0 ? "#a7d87d" : "#90c96e"); }
    }

    function zombieTickMove(body, head) {
        if (!body || body.dead) { return; }
        initZombieBody(body);
        if (head) { initZombieHead(head); }

        if (body.jumpCd > 0) { body.jumpCd--; }
        if (body.attackCd > 0) { body.attackCd--; }

        var target = findZombieTarget(body, head);
        var dx = 0;
        var wantsJump = false;

        if (target) {
            if (target.dx < 0) { dx = -1; }
            else if (target.dx > 0) { dx = 1; }
            if (target.dy < -1 || (dx && blockedAhead(body, dx))) { wantsJump = true; }
            if (target.dist <= 2) { zombieAttack(body, head); }
        } else {
            body.wanderTimer--;
            if (body.wanderTimer <= 0) {
                body.wanderTimer = 20 + Math.floor(Math.random()*50);
                body.wanderDir = Math.random() < 0.25 ? 0 : (Math.random() < 0.5 ? -1 : 1);
            }
            dx = body.wanderDir || 0;
            if (dx && blockedAhead(body, dx) && Math.random() < 0.4) { wantsJump = true; }
            if (Math.random() < 0.003) { wantsJump = true; }
        }

        if (dx) { body.dir = dx; }

        if (onGround(body)) { body.jumpBoost = Math.max(body.jumpBoost, 0); }

        if (wantsJump && body.jumpCd <= 0) {
            body.jumpBoost = target ? 3 : 2;
            body.jumpCd = 5;
            jumpStep(body, head, dx);
            body.jumpBoost--;
        }
        if (body.jumpBoost > 0) {
            if (jumpStep(body, head, dx)) { body.jumpBoost--; }
            else { body.jumpBoost = 0; }
        }

        var moved = false;
        var rage = (body.hp < 60) ? 1 : 0;
        var steps = 1 + rage;
        if (dx) {
            for (var s=0; s<steps; s++) {
                if (stepMove(body, head, dx)) { moved = true; }
            }
            if (target && target.dist > 3 && Math.random() < 0.45 && stepMove(body, head, dx)) { moved = true; } // lunge-ish
        }

        if (!onGround(body) || body.jumpBoost <= 0) {
            if (tryMovePair(body, head, body.x, body.y + 1)) { moved = true; }
        }

        updateZombieVisuals(body, head, moved);
        if (head) { dragHeadToBody(body, head); }
    }

    // ---------- Global keyboard edges ----------
    if (typeof runEveryTick === "function") {
        runEveryTick(function(){
            var allKeys = {}, k;
            for (k in CH.keys) { allKeys[k] = true; }
            for (k in CH.prevKeys) { allKeys[k] = true; }

            CH.edges = {};
            for (k in allKeys) { CH.edges[k] = !!CH.keys[k] && !CH.prevKeys[k]; }

            if (CH.edges["b"]) { cycleActiveHuman(); }
            if (CH.edges["n"]) { cycleMode(); }
            if (CH.edges["u"]) { showHelp(); }

            CH.prevKeys = {};
            for (k in CH.keys) { if (CH.keys[k]) { CH.prevKeys[k] = true; } }

            CH._activeCheck = (CH._activeCheck || 0) + 1;
            if (CH._activeCheck >= 15) {
                CH._activeCheck = 0;
                if (CH.activeId !== null && !findHumanBodyById(CH.activeId)) {
                    var allBodies = collectHumanBodies();
                    CH.activeId = allBodies.length ? allBodies[0].cid : null;
                }
            }
        });
    }

    if (typeof runAfterLoad === "function") { runAfterLoad(function(){ showHelp(); }); }
    if (typeof runAfterReset === "function") {
        runAfterReset(function(){
            CH.activeId = null;
            CH.keys = {};
            CH.prevKeys = {};
            CH.edges = {};
            CH.humanSpawnTick = -1;
            CH.zombieSpawnTick = -1;
            CH.aiCombat = true;
        });
    }

    // ---------- Elements: Human spawner ----------
    elements.controller_human = {
        color: ["#f5eac6","#e6d3a5","#c89f75","#8a6448"],
        category: HUMAN_CATEGORY,
        state: "solid",
        density: 1200,
        maxSize: 1,
        desc: "Advanced controllable human with inventory slots, guard, stomp, smarter AI combat, thirst/infection survival, and controller zombies.",
        tick: function(pixel) {
            var pt = (typeof pixelTicks !== "undefined") ? pixelTicks : 0;
            if (CH.humanSpawnTick === pt) { deletePixel(pixel.x, pixel.y); return; }
            CH.humanSpawnTick = pt;

            var head = null, body = null;
            if (typeof isEmpty === "function" && isEmpty(pixel.x, pixel.y + 1, true)) {
                createPixel("controller_human_body", pixel.x, pixel.y + 1);
                changePixel(pixel, "controller_human_head", false);
                head = pixel;
                body = getPixelSafe(pixel.x, pixel.y + 1);
            }
            else if (typeof isEmpty === "function" && isEmpty(pixel.x, pixel.y - 1, true)) {
                createPixel("controller_human_head", pixel.x, pixel.y - 1);
                changePixel(pixel, "controller_human_body", false);
                body = pixel;
                head = getPixelSafe(pixel.x, pixel.y - 1);
            } else {
                deletePixel(pixel.x, pixel.y);
                return;
            }

            if (!head || !body) { return; }

            var skins = ["#f5eac6","#e4c998","#be8a62","#7a4c33"];
            var shirts = [
                ["#3fa7d6","#2f86b0"],
                ["#6f9ceb","#5479b8"],
                ["#7cc576","#5ea15a"],
                ["#d67e3f","#b4652f"],
                ["#9f6bd6","#7e51ae"]
            ];
            var s = skins[Math.floor(Math.random()*skins.length)];
            var sh = shirts[Math.floor(Math.random()*shirts.length)];
            var id = CH.nextId++;

            initHumanHead(head);
            initHumanBody(body);
            head.cid = id;
            body.cid = id;
            head.dead = false;
            body.dead = false;
            body.mode = 1;
            body.hp = 100;
            body.stamina = 100;
            body.oxygen = 100;
            body.hunger = 0;
            body.jumpCd = 0;
            body.coyote = 0;
            body.airJumps = 1;
            body.jumpBoost = 0;
            body.dashCd = 0;
            body.dashTicks = 0;
            body.attackCd = 0;
            body.healCd = 0;
            body.held = null;
            body.bag = [];
            body.dir = Math.random() < 0.5 ? -1 : 1;
            body.wanderDir = body.dir;
            body.wanderTimer = 0;
            body.headOffsetX = 0;
            body.animStep = 0;
            body.thirst = 0;
            body.infection = 0;
            body.guard = 0;
            body.combo = 0;
            body.skinTone = s;
            body.shirtColor = sh[0];
            body.shirtColor2 = sh[1];
            head.breath = 100;
            head.color = s;
            body.color = sh[0];

            CH.activeId = id;
        }
    };

    elements.controller_human_body = {
        color: ["#3fa7d6","#6f9ceb","#7cc576","#d67e3f","#9f6bd6"],
        category: HUMAN_CATEGORY,
        hidden: true,
        state: "solid",
        density: 1500,
        conduct: 25,
        tempHigh: 250, stateHigh: "cooked_meat",
        tempLow: -30, stateLow: "frozen_meat",
        burn: 10, burnTime: 250, burnInto: "cooked_meat",
        properties: {
            dead: false, dir: 1, panic: 0, hp: 100, stamina: 100, oxygen: 100, hunger: 0,
            jumpCd: 0, coyote: 0, airJumps: 1, jumpBoost: 0, dashCd: 0, dashTicks: 0, dashDir: 1,
            healCd: 0, attackCd: 0, mode: 1, held: null, bag: null, cid: 0, wanderDir: 1, wanderTimer: 0,
            headOffsetX: 0, animStep: 0, action: "", actionTimer: 0, hurtFlash: 0,
            thirst: 0, infection: 0, guard: 0, combo: 0,
            skinTone: "#e7c29b", shirtColor: "#4a90e2", shirtColor2: "#3f7fc8"
        },
        tick: function(pixel) {
            initHumanBody(pixel);
            var head = linkedHumanHead(pixel);
            if (head) { initHumanHead(head); }

            doStandard(pixel);

            if (pixel.dead) {
                if (head) { head.dead = pixel.dead; }
                if (typeof pixelTicks !== "undefined" && pixelTicks - pixel.dead > 260) {
                    changePixel(pixel, "rotten_meat", false);
                }
                return;
            }

            if (!head) {
                if (Math.random() < 0.05 && typeof isEmpty === "function" && isEmpty(pixel.x, pixel.y - 1, true)) { createPixel("blood", pixel.x, pixel.y - 1); }
                hurtHumanBody(pixel, 0.35, null);
                if (tryMove(pixel, pixel.x, pixel.y + 1)) {}
                return;
            }

            if (head.dead && !pixel.dead) { pixel.dead = head.dead; return; }

            nearbyHumanEffects(pixel, head);
            humanBreathTick(head, pixel);
            humanEatTick(pixel, head);
            humanStatusTick(pixel, head);

            var controlled = (CH.activeId === pixel.cid);
            var man = manualIntent();
            var auto = aiIntent(pixel, head, pixel.mode === 1);
            var intent = mergeIntents(man, auto, pixel.mode || 0);

            if (!controlled && (pixel.mode || 0) === 0) {
                if (pixel.panic > 4) { intent = aiIntent(pixel, head, true); }
                else {
                    intent = {dx:0,jumpPress:false,jumpHold:false,crouch:false,sprint:false,guard:false,dash:false,punch:false,kick:false,stomp:false,pickup:false,place:false,throwItem:false,swapHeld:false,dropHeld:false,heal:false,stats:false,toggleAiCombat:false};
                }
            }

            applyHumanMovementAndActions(pixel, head, intent, controlled);

            if (pixel.hp < 100 && pixel.hunger < 55 && pixel.oxygen > 40 && pixel.panic < 1 && Math.random() < 0.03) {
                pixel.hp = clamp(pixel.hp + 0.2, 0, 100);
            }
        }
    };

    elements.controller_human_head = {
        color: ["#f5eac6","#e4c998","#be8a62","#7a4c33"],
        category: HUMAN_CATEGORY,
        hidden: true,
        state: "solid",
        density: 1080,
        conduct: 25,
        tempHigh: 250, stateHigh: "cooked_meat",
        tempLow: -30, stateLow: "frozen_meat",
        burn: 10, burnTime: 250, burnInto: "cooked_meat",
        properties: { dead:false, breath:100, cid:0 },
        tick: function(pixel) {
            initHumanHead(pixel);
            doStandard(pixel);

            var body = linkedHumanBody(pixel);
            if (body) { initHumanBody(body); }

            if (pixel.dead) {
                if (typeof pixelTicks !== "undefined" && pixelTicks - pixel.dead > 260) { changePixel(pixel, "rotten_meat", false); }
                return;
            }

            if (body && body.dead) { pixel.dead = body.dead; return; }

            if (!body) {
                tryMove(pixel, pixel.x, pixel.y + 1);
                if (Math.random() < 0.03 && typeof isEmpty === "function" && isEmpty(pixel.x, pixel.y + 1, true)) { createPixel("blood", pixel.x, pixel.y + 1); }
                if (Math.random() < 0.02) { pixel.dead = (typeof pixelTicks !== "undefined") ? pixelTicks : 1; }
                return;
            }

            // keep attached
            dragHeadToBody(body, pixel);
        }
    };

    // ---------- Elements: Zombie spawner + zombie parts ----------
    elements.controller_zombie = {
        color: ["#98c06a","#7ea95a","#6f9051"],
        category: ZOMBIE_CATEGORY,
        state: "solid",
        density: 1200,
        maxSize: 1,
        desc: "Controller zombie (single-spawn brush lock). Chases humans and can infect controller humans.",
        tick: function(pixel) {
            var pt = (typeof pixelTicks !== "undefined") ? pixelTicks : 0;
            if (CH.zombieSpawnTick === pt) { deletePixel(pixel.x, pixel.y); return; }
            CH.zombieSpawnTick = pt;

            var head = null, body = null;
            if (typeof isEmpty === "function" && isEmpty(pixel.x, pixel.y + 1, true)) {
                createPixel("controller_zombie_body", pixel.x, pixel.y + 1);
                changePixel(pixel, "controller_zombie_head", false);
                head = pixel;
                body = getPixelSafe(pixel.x, pixel.y + 1);
            }
            else if (typeof isEmpty === "function" && isEmpty(pixel.x, pixel.y - 1, true)) {
                createPixel("controller_zombie_head", pixel.x, pixel.y - 1);
                changePixel(pixel, "controller_zombie_body", false);
                body = pixel;
                head = getPixelSafe(pixel.x, pixel.y - 1);
            } else {
                deletePixel(pixel.x, pixel.y);
                return;
            }

            if (!head || !body) { return; }

            var id = CH.nextId++;
            initZombieHead(head);
            initZombieBody(body);
            head.cid = id;
            body.cid = id;
            head.dead = false;
            body.dead = false;
            body.hp = 120;
            body.dir = Math.random() < 0.5 ? -1 : 1;
            body.jumpCd = 0;
            body.jumpBoost = 0;
            body.attackCd = 0;
            body.headOffsetX = 0;
            head.color = "#90c96e";
            body.color = "#3f7a3f";
        }
    };

    elements.controller_zombie_body = {
        color: ["#3f7a3f","#4f8e4f"],
        category: ZOMBIE_CATEGORY,
        hidden: true,
        state: "solid",
        density: 1520,
        conduct: 10,
        tempHigh: 250, stateHigh: "cooked_meat",
        tempLow: -30, stateLow: "frozen_meat",
        burn: 8, burnTime: 240, burnInto: "rotten_meat",
        properties: {
            dead:false, hp:120, dir:1, jumpCd:0, jumpBoost:0, cid:0,
            headOffsetX:0, animStep:0, attackCd:0, actionTimer:0, hurtFlash:0, wanderDir:1, wanderTimer:0
        },
        tick: function(pixel) {
            initZombieBody(pixel);
            var head = linkedZombieHead(pixel);
            if (head) { initZombieHead(head); }

            doStandard(pixel);

            if (pixel.dead) {
                if (head) { head.dead = pixel.dead; }
                if (typeof pixelTicks !== "undefined" && pixelTicks - pixel.dead > 220) { changePixel(pixel, "rotten_meat", false); }
                return;
            }

            if (!head) {
                if (Math.random() < 0.07 && typeof isEmpty === "function" && isEmpty(pixel.x, pixel.y - 1, true)) { createPixel("infection", pixel.x, pixel.y - 1); }
                tryMove(pixel, pixel.x, pixel.y + 1);
                if (Math.random() < 0.01) { hurtZombieBody(pixel, 1, null); }
                return;
            }

            if (head.dead && !pixel.dead) { pixel.dead = head.dead; return; }

            // zombies hate extreme temps too
            if (pixel.temp > 95 || pixel.temp < -30) { hurtZombieBody(pixel, 0.12, head); }
            zombieTickMove(pixel, head);
        }
    };

    elements.controller_zombie_head = {
        color: ["#90c96e","#7fb65f"],
        category: ZOMBIE_CATEGORY,
        hidden: true,
        state: "solid",
        density: 1090,
        conduct: 8,
        tempHigh: 250, stateHigh: "cooked_meat",
        tempLow: -30, stateLow: "frozen_meat",
        burn: 8, burnTime: 240, burnInto: "rotten_meat",
        properties: { dead:false, cid:0 },
        tick: function(pixel) {
            initZombieHead(pixel);
            doStandard(pixel);

            var body = linkedZombieBody(pixel);
            if (body) { initZombieBody(body); }

            if (pixel.dead) {
                if (typeof pixelTicks !== "undefined" && pixelTicks - pixel.dead > 220) { changePixel(pixel, "rotten_meat", false); }
                return;
            }

            if (body && body.dead) { pixel.dead = body.dead; return; }

            if (!body) {
                tryMove(pixel, pixel.x, pixel.y + 1);
                if (Math.random() < 0.03 && typeof isEmpty === "function" && isEmpty(pixel.x, pixel.y + 1, true)) { createPixel("infection", pixel.x, pixel.y + 1); }
                if (Math.random() < 0.02) { pixel.dead = (typeof pixelTicks !== "undefined") ? pixelTicks : 1; }
                return;
            }

            dragHeadToBody(body, pixel);
        }
    };
})();
