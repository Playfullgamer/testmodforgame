(function(){
    if (typeof elements === "undefined") { return; }

    var root = (typeof window !== "undefined") ? window : globalThis;
    if (root.__controllerHumanModLoaded) {
        return;
    }
    root.__controllerHumanModLoaded = true;

    var CH = root.ControllerHumanState || {
        keys: {},
        prevKeys: {},
        edges: {},
        activeId: null,
        nextId: 1,
        lastHelpTick: -9999,
        keyListenersInstalled: false
    };
    root.ControllerHumanState = CH;

    function say(msg) {
        if (typeof logMessage === "function") {
            logMessage(msg);
        }
        else if (typeof console !== "undefined" && console.log) {
            console.log(msg);
        }
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
            // prevent browser/game hotkeys from stealing controller actions while a controller human exists
            if (CH.activeId !== null && (k === "q" || k === "z" || k === "x" || k === "g" || k === "b" || k === "n" || k === "u")) {
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
        if (typeof pixelMap === "undefined") { return null; }
        if (!pixelMap[x]) { return null; }
        return pixelMap[x][y] || null;
    }

    function isOurBody(p) {
        return !!p && p.element === "controller_human_body";
    }

    function isOurHead(p) {
        return !!p && p.element === "controller_human_head";
    }

    function isOurPart(p) {
        return isOurBody(p) || isOurHead(p);
    }

    function elemInfo(name) {
        if (typeof elements === "undefined") { return null; }
        return elements[name] || null;
    }

    function doStandard(pixel) {
        if (typeof doDefaults === "function") {
            doDefaults(pixel);
            return;
        }
        if (typeof doHeat === "function") { doHeat(pixel); }
        if (typeof doBurning === "function") { doBurning(pixel); }
        if (typeof doElectricity === "function") {
            try { doElectricity(pixel); }
            catch (e) { try { doElectricity(pixel, 1); } catch (e2) {} }
        }
    }

    function linkedHead(body) {
        if (!body) { return null; }
        var offsets = [
            [0,-1], [1,-1], [-1,-1],
            [0,-2], [1,-2], [-1,-2],
            [0,0], [1,0], [-1,0]
        ];
        for (var i=0; i<offsets.length; i++) {
            var p = getPixelSafe(body.x + offsets[i][0], body.y + offsets[i][1]);
            if (isOurHead(p) && p.cid === body.cid) {
                return p;
            }
        }
        return null;
    }

    function linkedBody(head) {
        if (!head) { return null; }
        var offsets = [
            [0,1], [1,1], [-1,1],
            [0,2], [1,2], [-1,2],
            [0,0], [1,0], [-1,0]
        ];
        for (var i=0; i<offsets.length; i++) {
            var p = getPixelSafe(head.x + offsets[i][0], head.y + offsets[i][1]);
            if (isOurBody(p) && p.cid === head.cid) {
                return p;
            }
        }
        return null;
    }

    function canMoveHeadTo(head, x, y) {
        var p = getPixelSafe(x, y);
        if (!p) { return true; }
        if (p === head) { return true; }
        return false;
    }

    function dragHeadToBody(body, head) {
        if (!body || !head) { return false; }
        var tx = body.x;
        var ty = body.y - 1;
        if (head.x === tx && head.y === ty) { return true; }
        if (typeof isEmpty === "function" && isEmpty(tx, ty, true)) {
            movePixel(head, tx, ty);
            return true;
        }
        var atTarget = getPixelSafe(tx, ty);
        if (atTarget && atTarget !== head) {
            if (atTarget === body) {
                // Usually won't happen after move; if it does, try above target then let head fall naturally.
                return false;
            }
            return false;
        }
        movePixel(head, tx, ty);
        return true;
    }

    function tryMovePair(body, head, nx, ny) {
        if (!body) { return false; }
        if (head) {
            if (!canMoveHeadTo(head, nx, ny - 1)) { return false; }
        }
        if (!tryMove(body, nx, ny)) { return false; }
        if (head) {
            if ((typeof isEmpty === "function" && isEmpty(nx, ny - 1, true)) || (head.x === nx && head.y === ny - 1)) {
                movePixel(head, nx, ny - 1);
            }
            else {
                dragHeadToBody(body, head);
            }
        }
        return true;
    }

    function stepMove(body, head, dx) {
        if (!dx) { return false; }
        if (tryMovePair(body, head, body.x + dx, body.y)) { return true; }
        // step up 1 pixel like vanilla human
        if (tryMovePair(body, head, body.x + dx, body.y - 1)) { return true; }
        return false;
    }

    function jumpMove(body, head, dx) {
        var jumped = false;
        var firstDx = dx || 0;
        if (tryMovePair(body, head, body.x + firstDx, body.y - 1)) {
            jumped = true;
        }
        else if (tryMovePair(body, head, body.x, body.y - 1)) {
            jumped = true;
        }
        else if (dx && tryMovePair(body, head, body.x + dx, body.y)) {
            jumped = true;
        }
        return jumped;
    }

    function onGround(body) {
        return !!getPixelSafe(body.x, body.y + 1);
    }

    function isFoodPixel(p) {
        if (!p) { return false; }
        var e = elemInfo(p.element);
        if (!e) { return false; }
        if (e.isFood) { return true; }
        return e.category === "food";
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
            if (e.state === "gas" && (n === "smoke" || n === "steam")) {
                // not always lethal, but treat as mild hazard near face for pathing
                return true;
            }
        }
        if (typeof p.temp === "number" && (p.temp > 140 || p.temp < -50)) { return true; }
        return false;
    }

    function isLiquidPixel(p) {
        if (!p) { return false; }
        var e = elemInfo(p.element);
        if (!e) { return false; }
        return e.state === "liquid";
    }

    function hurtBody(body, amount, head) {
        if (!body || body.dead) { return; }
        if (typeof body.hp !== "number") { body.hp = 100; }
        body.hp -= amount;
        if (typeof body.panic !== "number") { body.panic = 0; }
        body.panic += amount * 0.25;
        if (body.panic > 20) { body.panic = 20; }
        body.lastHurtTick = (typeof pixelTicks !== "undefined") ? pixelTicks : 0;
        if (body.hp <= 0) {
            body.dead = (typeof pixelTicks !== "undefined") ? pixelTicks : 1;
            if (head) { head.dead = body.dead; }
        }
    }

    function initializeBodyDefaults(body) {
        if (typeof body.dead === "undefined") { body.dead = false; }
        if (typeof body.dir !== "number") { body.dir = Math.random() < 0.5 ? -1 : 1; }
        if (typeof body.panic !== "number") { body.panic = 0; }
        if (typeof body.hp !== "number") { body.hp = 100; }
        if (typeof body.stamina !== "number") { body.stamina = 100; }
        if (typeof body.oxygen !== "number") { body.oxygen = 100; }
        if (typeof body.hunger !== "number") { body.hunger = 0; }
        if (typeof body.jumpCd !== "number") { body.jumpCd = 0; }
        if (typeof body.wanderDir !== "number") { body.wanderDir = body.dir || 1; }
        if (typeof body.wanderTimer !== "number") { body.wanderTimer = 0; }
        if (typeof body.mode !== "number") { body.mode = 1; } // 0 manual, 1 assist, 2 auto
        if (typeof body.held === "undefined") { body.held = null; }
        if (typeof body.cid !== "number") {
            body.cid = CH.nextId++;
            if (CH.activeId === null) { CH.activeId = body.cid; }
        }
    }

    function initializeHeadDefaults(head) {
        if (typeof head.dead === "undefined") { head.dead = false; }
        if (typeof head.breath !== "number") { head.breath = 100; }
        if (typeof head.cid !== "number") {
            head.cid = CH.nextId++;
            if (CH.activeId === null) { CH.activeId = head.cid; }
        }
    }

    function getNeighborList(x, y) {
        var arr = [];
        for (var dx = -1; dx <= 1; dx++) {
            for (var dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) { continue; }
                arr.push(getPixelSafe(x + dx, y + dy));
            }
        }
        return arr;
    }

    function nearbyEffects(body, head) {
        var neighbors = getNeighborList(body.x, body.y);
        if (head) {
            var hn = getNeighborList(head.x, head.y);
            for (var i=0; i<hn.length; i++) { neighbors.push(hn[i]); }
        }

        var hazardHits = 0;
        for (var j=0; j<neighbors.length; j++) {
            var p = neighbors[j];
            if (!p) { continue; }
            if (isHazardPixel(p)) { hazardHits++; }
        }

        if (hazardHits > 0) {
            hurtBody(body, 0.25 * hazardHits, head);
        }

        if (body.temp > 90) { hurtBody(body, 0.12, head); }
        if (body.temp < -25) { hurtBody(body, 0.08, head); }
        if (head && head.temp > 90) { hurtBody(body, 0.15, head); }
        if (head && head.temp < -25) { hurtBody(body, 0.1, head); }
    }

    function breathTick(head, body) {
        if (!head || !body || body.dead) { return; }
        var wet = 0;
        var around = [
            getPixelSafe(head.x, head.y),
            getPixelSafe(head.x+1, head.y),
            getPixelSafe(head.x-1, head.y),
            getPixelSafe(head.x, head.y+1),
            getPixelSafe(head.x, head.y-1)
        ];
        for (var i=0; i<around.length; i++) {
            if (isLiquidPixel(around[i])) { wet++; }
        }
        if (wet >= 3) {
            head.breath -= 1.1;
            body.oxygen -= 0.9;
            if (head.breath < 0 && ((typeof pixelTicks === "undefined") || pixelTicks % 5 === 0)) {
                hurtBody(body, 1.5, head);
            }
        }
        else {
            head.breath += 1.2;
            body.oxygen += 0.8;
            if (head.breath > 100) { head.breath = 100; }
            if (body.oxygen > 100) { body.oxygen = 100; }
        }
    }

    function tryEat(body, head) {
        if (body.dead) { return; }
        body.hunger += 0.012;
        if (body.hunger < 0) { body.hunger = 0; }
        if (body.hunger > 100) {
            hurtBody(body, 0.08, head);
        }
        if (body.hunger < 30) { return; }

        var spots = [
            [body.x + (body.dir || 1), body.y - 1],
            [body.x + (body.dir || 1), body.y],
            [body.x, body.y - 2],
            [body.x, body.y - 1],
            [body.x - (body.dir || 1), body.y - 1]
        ];
        for (var i=0; i<spots.length; i++) {
            var p = getPixelSafe(spots[i][0], spots[i][1]);
            if (!p || isOurPart(p)) { continue; }
            if (isFoodPixel(p)) {
                deletePixel(p.x, p.y);
                body.hunger -= 28;
                if (body.hunger < 0) { body.hunger = 0; }
                body.hp += 4;
                if (body.hp > 100) { body.hp = 100; }
                body.stamina += 15;
                if (body.stamina > 100) { body.stamina = 100; }
                break;
            }
        }
    }

    function findPickupTarget(body) {
        var dir = body.dir || 1;
        var candidates = [
            [body.x + dir, body.y - 1],
            [body.x + dir, body.y],
            [body.x, body.y - 2],
            [body.x + dir, body.y - 2],
            [body.x - dir, body.y - 1]
        ];
        for (var i=0; i<candidates.length; i++) {
            var p = getPixelSafe(candidates[i][0], candidates[i][1]);
            if (!p) { continue; }
            if (isOurPart(p)) { continue; }
            var e = elemInfo(p.element);
            if (!e) { continue; }
            if (e.category === "tools" || e.category === "special") { continue; }
            if (p.element === "wall" || p.element === "void") { continue; }
            return p;
        }
        return null;
    }

    function doPickup(body) {
        if (body.held) { return false; }
        var target = findPickupTarget(body);
        if (!target) { return false; }
        body.held = target.element;
        deletePixel(target.x, target.y);
        body.stamina -= 2;
        if (body.stamina < 0) { body.stamina = 0; }
        return true;
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
                body.stamina -= throwFar ? 4 : 1;
                if (body.stamina < 0) { body.stamina = 0; }
                return true;
            }
        }
        return false;
    }

    function doPunch(body, head) {
        var dir = body.dir || 1;
        var hits = [
            getPixelSafe(body.x + dir, body.y - 1),
            getPixelSafe(body.x + dir, body.y),
            getPixelSafe(body.x + dir, body.y - 2)
        ];
        for (var i=0; i<hits.length; i++) {
            var p = hits[i];
            if (!p || isOurPart(p)) { continue; }
            var pushed = false;
            if (typeof isEmpty === "function" && isEmpty(p.x + dir, p.y, true)) {
                movePixel(p, p.x + dir, p.y);
                pushed = true;
            }
            else if (typeof isEmpty === "function" && isEmpty(p.x + dir, p.y - 1, true)) {
                movePixel(p, p.x + dir, p.y - 1);
                pushed = true;
            }
            if (pushed && isHazardPixel(p)) {
                // punching fire/plasma hurts
                hurtBody(body, 1.0, head);
            }
            if (isOurBody(p)) {
                hurtBody(p, 6, linkedHead(p));
            }
            else if (isOurHead(p)) {
                var b = linkedBody(p);
                if (b) { hurtBody(b, 8, p); }
            }
            body.stamina -= 4;
            if (body.stamina < 0) { body.stamina = 0; }
            return true;
        }
        return false;
    }

    function manualIntent() {
        var left = !!CH.keys["a"];
        var right = !!CH.keys["d"];
        var dx = 0;
        if (left && !right) { dx = -1; }
        else if (right && !left) { dx = 1; }
        return {
            dx: dx,
            jump: !!CH.edges["w"],
            crouch: !!CH.keys["s"],
            sprint: !!CH.keys["shift"]
        };
    }

    function aiIntent(body, head, assistMode) {
        var intent = { dx: 0, jump: false, crouch: false, sprint: false };
        var hx = head ? head.x : body.x;
        var hy = head ? head.y : body.y - 1;

        var awayScore = 0;
        var foodScore = 0;
        var bestHazardDist = 999;

        for (var dx = -5; dx <= 5; dx++) {
            for (var dy = -4; dy <= 3; dy++) {
                var p = getPixelSafe(hx + dx, hy + dy);
                if (!p || isOurPart(p)) { continue; }
                var dist = Math.abs(dx) + Math.abs(dy);
                if (dist === 0) { dist = 1; }

                if (isHazardPixel(p)) {
                    awayScore += (-dx) / dist;
                    if (dist < bestHazardDist) { bestHazardDist = dist; }
                    if (dy >= 0 && dist <= 2) {
                        intent.jump = true;
                    }
                }

                if (body.hunger > 35 && isFoodPixel(p)) {
                    foodScore += (dx) / dist;
                }
            }
        }

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
                if (Math.random() < 0.2) { body.wanderDir = 0; }
                else { body.wanderDir = Math.random() < 0.5 ? -1 : 1; }
            }
            desiredDx = body.wanderDir || 0;
            if (Math.random() < 0.01) { intent.jump = true; }
        }

        intent.dx = desiredDx;

        if (assistMode) {
            // In assist mode we only auto-steer for danger; otherwise manual wins.
            if (bestHazardDist > 4 && body.hunger <= 60) {
                intent.dx = 0;
                intent.jump = false;
                intent.sprint = false;
            }
        }

        return intent;
    }

    function mergeIntents(manual, auto, mode) {
        if (mode === 2) {
            return auto;
        }
        if (mode === 1) {
            var out = {
                dx: manual.dx,
                jump: manual.jump,
                crouch: manual.crouch,
                sprint: manual.sprint
            };
            if (auto.dx && !manual.dx) { out.dx = auto.dx; }
            if (auto.jump) { out.jump = true; }
            if (auto.sprint && !manual.sprint) { out.sprint = true; }
            return out;
        }
        return manual;
    }

    function applyMovementAndActions(body, head, intent, isControlled) {
        if (!body || body.dead) { return; }

        if (intent.dx) { body.dir = intent.dx > 0 ? 1 : -1; }
        if (typeof body.jumpCd !== "number") { body.jumpCd = 0; }
        if (body.jumpCd > 0) { body.jumpCd--; }

        var sprinting = !!intent.sprint && body.stamina > 8;
        var moveSteps = sprinting ? 2 : 1;
        var moved = false;

        if (intent.jump && body.jumpCd <= 0) {
            var jdx = intent.dx || 0;
            if (jumpMove(body, head, jdx)) {
                body.jumpCd = 5;
                body.stamina -= sprinting ? 8 : 5;
                moved = true;
            }
        }

        if (intent.dx) {
            for (var i=0; i<moveSteps; i++) {
                if (stepMove(body, head, intent.dx)) {
                    moved = true;
                    body.stamina -= sprinting ? 1.2 : 0.5;
                }
                else {
                    if (intent.crouch && typeof tryMovePair === "function") {
                        // no-op crouch placeholder for future crawling
                    }
                    break;
                }
            }
        }

        if (!moved) {
            body.stamina += 0.35;
        }
        else {
            body.stamina += 0.05;
        }

        if (body.stamina > 100) { body.stamina = 100; }
        if (body.stamina < 0) { body.stamina = 0; }

        if (body.panic > 0) {
            body.panic -= 0.02;
            if (body.panic < 0) { body.panic = 0; }
        }

        if (isControlled) {
            if (CH.edges["q"]) {
                if (body.held) { doPlace(body, head, false); }
                else { doPickup(body); }
            }
            if (CH.edges["z"]) {
                doPlace(body, head, false);
            }
            if (CH.edges["g"]) {
                doPlace(body, head, true);
            }
            if (CH.edges["x"]) {
                doPunch(body, head);
            }
        }
    }

    function collectBodies() {
        var out = [];
        if (typeof pixelMap === "undefined") { return out; }
        for (var x = 0; x < pixelMap.length; x++) {
            var col = pixelMap[x];
            if (!col) { continue; }
            for (var y = 0; y < col.length; y++) {
                var p = col[y];
                if (isOurBody(p)) { out.push(p); }
            }
        }
        out.sort(function(a, b){ return (a.cid || 0) - (b.cid || 0); });
        return out;
    }

    function findBodyById(cid) {
        if (cid === null || typeof cid === "undefined") { return null; }
        var all = collectBodies();
        for (var i=0; i<all.length; i++) {
            if (all[i].cid === cid) { return all[i]; }
        }
        return null;
    }

    function cycleActiveBody() {
        var all = collectBodies();
        if (all.length === 0) {
            CH.activeId = null;
            say("[Controller Human] No controller humans found.");
            return;
        }
        var idx = -1;
        for (var i=0; i<all.length; i++) {
            if (all[i].cid === CH.activeId) { idx = i; break; }
        }
        idx = (idx + 1) % all.length;
        CH.activeId = all[idx].cid;
        say("[Controller Human] Active #" + CH.activeId + " | Mode: " + modeName(all[idx].mode));
    }

    function modeName(mode) {
        if (mode === 0) { return "Manual"; }
        if (mode === 1) { return "Assist"; }
        if (mode === 2) { return "Auto"; }
        return "?";
    }

    function cycleMode() {
        var body = findBodyById(CH.activeId);
        if (!body) {
            say("[Controller Human] No active human to change mode.");
            return;
        }
        body.mode = ((body.mode || 0) + 1) % 3;
        say("[Controller Human] #" + body.cid + " -> " + modeName(body.mode));
    }

    function showHelp() {
        var pt = (typeof pixelTicks !== "undefined") ? pixelTicks : 0;
        if (pt - CH.lastHelpTick < 10) { return; }
        CH.lastHelpTick = pt;
        say("[Controller Human] WASD move/jump/crouch, Shift sprint, Q pick/drop, Z place, G throw, X punch, B cycle human, N mode (Manual/Assist/Auto)");
    }

    if (typeof runEveryTick === "function") {
        runEveryTick(function(){
            var allKeys = {};
            var k;
            for (k in CH.keys) { allKeys[k] = true; }
            for (k in CH.prevKeys) { allKeys[k] = true; }

            CH.edges = {};
            for (k in allKeys) {
                CH.edges[k] = !!CH.keys[k] && !CH.prevKeys[k];
            }

            if (CH.edges["b"]) { cycleActiveBody(); }
            if (CH.edges["n"]) { cycleMode(); }
            if (CH.edges["u"]) { showHelp(); }

            CH.prevKeys = {};
            for (k in CH.keys) {
                if (CH.keys[k]) { CH.prevKeys[k] = true; }
            }

            CH._activeCheck = (CH._activeCheck || 0) + 1;
            if (CH._activeCheck >= 15) {
                CH._activeCheck = 0;
                if (CH.activeId !== null && !findBodyById(CH.activeId)) {
                    var allBodies = collectBodies();
                    CH.activeId = allBodies.length ? allBodies[0].cid : null;
                }
            }
        });
    }

    if (typeof runAfterLoad === "function") {
        runAfterLoad(function(){
            showHelp();
        });
    }

    if (typeof runAfterReset === "function") {
        runAfterReset(function(){
            CH.activeId = null;
            CH.keys = {};
            CH.prevKeys = {};
            CH.edges = {};
        });
    }

    elements.controller_human = {
        color: ["#f5eac6", "#e6d3a5", "#c89f75", "#8a6448"],
        category: "life",
        state: "solid",
        density: 1200,
        desc: "Spawns a keyboard-controllable human. B cycles active human, N changes AI mode, U shows controls.",
        tick: function(pixel) {
            var madeHead = false;
            var head = null;
            var body = null;

            if (typeof isEmpty === "function" && isEmpty(pixel.x, pixel.y + 1, true)) {
                createPixel("controller_human_body", pixel.x, pixel.y + 1);
                changePixel(pixel, "controller_human_head", false);
                head = pixel;
                body = getPixelSafe(pixel.x, pixel.y + 1);
                madeHead = true;
            }
            else if (typeof isEmpty === "function" && isEmpty(pixel.x, pixel.y - 1, true)) {
                createPixel("controller_human_head", pixel.x, pixel.y - 1);
                changePixel(pixel, "controller_human_body", false);
                body = pixel;
                head = getPixelSafe(pixel.x, pixel.y - 1);
            }
            else {
                deletePixel(pixel.x, pixel.y);
                return;
            }

            if (!head || !body) { return; }
            initializeHeadDefaults(head);
            initializeBodyDefaults(body);

            var id = CH.nextId++;
            head.cid = id;
            body.cid = id;
            head.dead = false;
            body.dead = false;
            body.mode = 1;
            body.hp = 100;
            body.stamina = 100;
            body.hunger = 0;
            body.oxygen = 100;
            body.jumpCd = 0;
            body.held = null;
            body.dir = Math.random() < 0.5 ? -1 : 1;
            body.wanderDir = body.dir;
            body.wanderTimer = 0;
            head.breath = 100;

            if (madeHead) {
                head.color = pixelColorPick(head, ["#f5eac6", "#e4c998", "#be8a62", "#7a4c33"]);
                body.color = pixelColorPick(body, ["#3fa7d6", "#6f9ceb", "#7cc576", "#d67e3f", "#9f6bd6"]);
            }
            else {
                head.color = pixelColorPick(head, ["#f5eac6", "#e4c998", "#be8a62", "#7a4c33"]);
                body.color = pixelColorPick(body, ["#3fa7d6", "#6f9ceb", "#7cc576", "#d67e3f", "#9f6bd6"]);
            }

            CH.activeId = id;
        }
    };

    elements.controller_human_body = {
        color: ["#3fa7d6", "#6f9ceb", "#7cc576", "#d67e3f", "#9f6bd6"],
        category: "life",
        hidden: true,
        state: "solid",
        density: 1500,
        conduct: 25,
        tempHigh: 250,
        stateHigh: "cooked_meat",
        tempLow: -30,
        stateLow: "frozen_meat",
        burn: 10,
        burnTime: 250,
        burnInto: "cooked_meat",
        properties: {
            dead: false,
            dir: 1,
            panic: 0,
            hp: 100,
            stamina: 100,
            oxygen: 100,
            hunger: 0,
            jumpCd: 0,
            mode: 1,
            held: null,
            cid: 0,
            wanderDir: 1,
            wanderTimer: 0
        },
        tick: function(pixel) {
            initializeBodyDefaults(pixel);
            var head = linkedHead(pixel);
            if (head) { initializeHeadDefaults(head); }

            // Gravity first, then drag head down like vanilla humans.
            if (tryMove(pixel, pixel.x, pixel.y + 1)) {
                if (head) { dragHeadToBody(pixel, head); }
            }

            head = linkedHead(pixel);
            if (head) { initializeHeadDefaults(head); }

            doStandard(pixel);

            if (pixel.dead) {
                if (head) { head.dead = pixel.dead; }
                if (typeof pixelTicks !== "undefined" && pixelTicks - pixel.dead > 260) {
                    changePixel(pixel, "rotten_meat", false);
                    if (head && !head.dead) { head.dead = pixel.dead; }
                }
                return;
            }

            if (!head) {
                if (Math.random() < 0.05 && typeof isEmpty === "function" && isEmpty(pixel.x, pixel.y - 1, true)) {
                    createPixel("blood", pixel.x, pixel.y - 1);
                }
                hurtBody(pixel, 0.4, null);
                return;
            }

            if (head.dead && !pixel.dead) {
                pixel.dead = head.dead;
                return;
            }

            nearbyEffects(pixel, head);
            breathTick(head, pixel);
            tryEat(pixel, head);

            var controlled = (CH.activeId === pixel.cid);
            var man = manualIntent();
            var auto = aiIntent(pixel, head, pixel.mode === 1);
            var intent = mergeIntents(man, auto, pixel.mode || 0);
            if (!controlled && (pixel.mode || 0) === 0) {
                // Non-active humans in manual mode idle, but still flee if panicking a lot.
                if (pixel.panic > 4) {
                    intent = aiIntent(pixel, head, true);
                }
                else {
                    intent = {dx:0,jump:false,crouch:false,sprint:false};
                }
            }

            applyMovementAndActions(pixel, head, intent, controlled);

            // Keep head attached if movement couldn't align perfectly
            head = linkedHead(pixel);
            if (head) { dragHeadToBody(pixel, head); }

            // Tiny regeneration when safe
            if (pixel.hp < 100 && pixel.hunger < 55 && pixel.oxygen > 40 && pixel.panic < 1 && Math.random() < 0.03) {
                pixel.hp += 0.2;
                if (pixel.hp > 100) { pixel.hp = 100; }
            }
        }
    };

    elements.controller_human_head = {
        color: ["#f5eac6", "#e4c998", "#be8a62", "#7a4c33"],
        category: "life",
        hidden: true,
        state: "solid",
        density: 1080,
        conduct: 25,
        tempHigh: 250,
        stateHigh: "cooked_meat",
        tempLow: -30,
        stateLow: "frozen_meat",
        burn: 10,
        burnTime: 250,
        burnInto: "cooked_meat",
        properties: {
            dead: false,
            breath: 100,
            cid: 0
        },
        tick: function(pixel) {
            initializeHeadDefaults(pixel);
            doStandard(pixel);

            var body = linkedBody(pixel);
            if (body) { initializeBodyDefaults(body); }

            if (pixel.dead) {
                if (typeof pixelTicks !== "undefined" && pixelTicks - pixel.dead > 260) {
                    changePixel(pixel, "rotten_meat", false);
                }
                return;
            }

            if (body && body.dead) {
                pixel.dead = body.dead;
                return;
            }

            if (!body) {
                if (tryMove(pixel, pixel.x, pixel.y + 1)) {
                    // severed head falls
                }
                if (Math.random() < 0.03 && typeof isEmpty === "function" && isEmpty(pixel.x, pixel.y + 1, true)) {
                    createPixel("blood", pixel.x, pixel.y + 1);
                }
                if (Math.random() < 0.02) {
                    pixel.dead = (typeof pixelTicks !== "undefined") ? pixelTicks : 1;
                }
                return;
            }

            // If space under head opens while body is stuck weirdly, settle downward.
            if (typeof isEmpty === "function" && isEmpty(pixel.x, pixel.y + 1, true)) {
                tryMove(pixel, pixel.x, pixel.y + 1);
            }
        }
    };
})();
