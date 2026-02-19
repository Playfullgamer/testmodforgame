// Natural Disasters Expanded v4 (Sandboxels)
// - New category: "Natural Disasters"
// - NO block/pixel painting for disasters (all are true tools)
// - Tsunami fixed (surge events are ticked)
// - Strong tornadoes + improved storms/blizzards/hail/meteors + lots more

runAfterLoad(function () {
  if (window.__ND_V4__) return;
  window.__ND_V4__ = true;

  const ND_CAT = "Natural Disasters";

  const ND = {
    events: [],
    cd: Object.create(null),
    waterList: ["water", "salt_water", "dirty_water", "sugar_water", "seltzer"],
    rand(a,b){ return Math.random()*(b-a)+a; },
    randi(a,b){ return Math.floor(Math.random()*(b-a+1))+a; },
    clamp(v,a,b){ return v<a?a:v>b?b:v; },
    exists(e){ return !!elements[e]; },
    pickFirst(list,fallback){ for(const e of list){ if(this.exists(e)) return e; } return fallback; },
    isWater(e){ return this.waterList.includes(e); },
    brush(){ return (typeof mouseSize !== "undefined" ? mouseSize : 5) || 5; },
    isShift(){ return (typeof shiftDown !== "undefined" && !!shiftDown); },
    canTrigger(key, ticks){
      const last = this.cd[key] ?? -999999;
      if (pixelTicks - last < ticks) return false;
      this.cd[key] = pixelTicks;
      return true;
    },
    posFromEvent(e){
      try { return getMousePos(document.getElementById("game"), e); }
      catch(_) { return {x: mousePos?.x ?? 0, y: mousePos?.y ?? 0}; }
    }
  };

  function stateOf(elem){ return elements[elem]?.state; }
  function isLight(elem){
    return elem === "smoke" || elem === "dust" || elem === "cloud" || elem === "steam" || elem === "ash";
  }

  function forCircle(cx, cy, r, fn, samples){
    const s = samples ?? Math.floor(r*r*3.5);
    for(let i=0;i<s;i++){
      const x = Math.floor(cx + ND.rand(-r,r));
      const y = Math.floor(cy + ND.rand(-r,r));
      if(outOfBounds(x,y)) continue;
      const dx=x-cx, dy=y-cy;
      if(dx*dx+dy*dy > r*r) continue;
      fn(x,y,dx,dy);
    }
  }

  // ---------- wind + lightning ----------
  function windPush(dir, strength, updraft){
    const x1=1, x2=width-2, y1=1, y2=height-2;
    const area = (x2-x1+1)*(y2-y1+1);
    const samples = Math.floor(area * ND.clamp(0.004 + strength*0.003, 0.004, 0.03));

    for(let i=0;i<samples;i++){
      const x = ND.randi(x1,x2), y = ND.randi(y1,y2);
      if(outOfBounds(x,y) || isEmpty(x,y,true)) continue;
      const p = pixelMap[x][y];
      if(!p || p.del) continue;

      const info = elements[p.element];
      if(!info || info.category==="tools" || info.movable===false) continue;

      const st = stateOf(p.element);
      let mult = 0.8;
      if(st==="gas" || isLight(p.element)) mult = 2.4;
      else if(st==="liquid") mult = 1.4;

      const tries = ND.clamp(Math.floor(strength*mult), 1, 6);
      for(let t=0;t<tries;t++){
        const dx = dir + (Math.random()<0.12 ? -dir : 0);
        const dy = (Math.random()<0.07 ? (Math.random()<0.5?-1:1) : 0);
        if(tryMove(p, p.x+dx, p.y+dy, undefined, true)) continue;
        break;
      }

      if(updraft>0 && Math.random() < updraft*(st==="gas"?0.35:0.10)){
        tryMove(p, p.x, p.y-1, undefined, true);
      }
    }
  }

  function lightningStrike(x, power){
    const plasmaLike = ND.pickFirst(["plasma","electric","fire"], "fire");
    const smokeLike  = ND.pickFirst(["smoke","ash","dust"], "smoke");
    let y = 1, lx = x;

    for(let step=0; step<260 && y<height-2; step++){
      y += 1;
      if(Math.random()<0.55) lx += ND.randi(-1,1);
      lx = ND.clamp(lx, 2, width-3);
      if(outOfBounds(lx,y)) break;

      if(!isEmpty(lx,y,true)){
        const hit = pixelMap[lx][y];
        if(hit && !hit.del){
          hit.temp = Math.max(hit.temp ?? 0, 700 + 1100*power);
          if(elements[hit.element]?.breakInto && Math.random()<0.35*power) breakPixel(hit);
          if(ND.exists(plasmaLike) && Math.random()<0.25*power) changePixel(hit, plasmaLike);
        }

        const R = ND.clamp(Math.floor(3 + 7*power), 3, 18);
        forCircle(lx,y,R,(px,py,dx,dy)=>{
          const dist = Math.hypot(dx,dy);
          const f = 1 - dist/R;
          if(outOfBounds(px,py)) return;

          if(!isEmpty(px,py,true)){
            const p = pixelMap[px][py];
            if(!p || p.del) return;
            p.temp = Math.max(p.temp ?? 0, 400 + 1200*f*power);
            if(elements[p.element]?.breakInto && Math.random()<0.12*f*power) breakPixel(p);
          } else {
            if(ND.exists(smokeLike) && Math.random()<0.10*f*power) createPixel(smokeLike, px, py);
          }
        }, Math.floor(R*R*4.5));

        return;
      } else {
        if(ND.exists(smokeLike) && Math.random()<0.05*power) createPixel(smokeLike, lx, y);
      }
    }
  }

  // ---------- custom elements ----------
  elements.nd_mega_tornado = {
    name: "Mega Tornado",
    color: ["#6f6f6f","#7f7f7f","#5f5f5f"],
    category: "special",
    state: "gas",
    density: 0.03,
    excludeRandom: true,
    noMix: true,
    tick(pixel){
      if(pixel.nd_init !== 1){
        pixel.nd_init = 1;
        pixel.life = ND.randi(700,1200);
        pixel.radius = ND.randi(18,28);
        pixel.power = ND.clamp(pixel.power ?? 1.2, 0.9, 2.8);
        pixel.vx = Math.random()<0.5 ? -1 : 1;
      }

      pixel.life--;
      if(pixel.life<=0){ deletePixel(pixel.x,pixel.y); return; }

      if(Math.random()<0.02) pixel.vx *= -1;

      // stay near ground/structures
      let tx = pixel.x + pixel.vx;
      let ty = pixel.y;
      if(!outOfBounds(pixel.x,pixel.y+1) && isEmpty(pixel.x,pixel.y+1,true)) ty = pixel.y+1;
      else if(!outOfBounds(pixel.x,pixel.y-1) && Math.random()<0.25) ty = pixel.y-1;
      if(!outOfBounds(tx,ty)) tryMove(pixel, tx, ty, undefined, true);

      const cx=pixel.x, cy=pixel.y, R=pixel.radius, power=pixel.power;

      // visible funnel haze
      const haze = ND.pickFirst(["dust","smoke","cloud","ash"], "smoke");
      if(ND.exists(haze)){
        for(let i=0;i<3+Math.floor(power*2);i++){
          const x=cx+ND.randi(-2,2), y=cy+ND.randi(-2,2);
          if(!outOfBounds(x,y) && isEmpty(x,y) && Math.random()<0.65) createPixel(haze,x,y);
        }
      }

      // BIG suction/rotation (cap for performance)
      const steps = ND.clamp(Math.floor(R*R*(5.5 + power*2.2)), 900, 5200);

      for(let i=0;i<steps;i++){
        const x = Math.floor(cx + ND.rand(-R,R));
        const y = Math.floor(cy + ND.rand(-R,R));
        if(outOfBounds(x,y) || isEmpty(x,y,true)) continue;

        const p = pixelMap[x][y];
        if(!p || p===pixel || p.del) continue;

        const info = elements[p.element];
        if(!info || info.category==="tools" || info.movable===false) continue;

        const dx=x-cx, dy=y-cy;
        const dist=Math.sqrt(dx*dx+dy*dy);
        if(dist<1 || dist>R) continue;

        const f = 1 - dist/R;
        const st = stateOf(p.element);

        let resist = 1;
        if(st==="solid") resist = 0.8;
        if(st==="liquid") resist = 1.2;
        if(st==="gas" || isLight(p.element)) resist = 1.6;

        const chance = ND.clamp(f*(0.7 + power*0.55)*resist, 0, 0.98);
        if(Math.random()>chance) continue;

        // spin + inward + lift
        const tanX = dy>0 ? 1 : -1;
        const tanY = dx>0 ? -1 : 1;
        const inX  = dx>0 ? -1 : 1;
        const inY  = dy>0 ? -1 : 1;

        let sx=0, sy=0;
        if(Math.random()<0.88){ sx+=tanX; sy+=tanY; }
        if(Math.random()<0.86){ sx+=inX;  sy+=inY;  }
        if(Math.random()<(0.30+0.55*f)) sy += -1;
        if(f>0.65 && Math.random()<0.10*power) sy += -1;

        // occasional fling
        if(f>0.70 && Math.random()<0.07*power){
          sx += -inX;
          sy += (Math.random()<0.5?-1:0);
        }

        sx = Math.sign(sx); sy = Math.sign(sy);

        const moves = ND.clamp(1 + Math.floor(power*1.2 + f*2.2), 1, 6);
        for(let m=0;m<moves;m++){
          if(tryMove(p, p.x+sx, p.y+sy, undefined, true)) continue;
          if(Math.random()<0.35) tryMove(p, p.x+ND.randi(-1,1), p.y+ND.randi(-1,1), undefined, true);
          break;
        }

        // structural damage near core
        if(f>0.74 && power>1.2 && Math.random()<0.02*power){
          if(info.breakInto) breakPixel(p);
        }
      }

      doDefaults(pixel);
    }
  };

  elements.nd_tsunami_water = {
    name: "Tsunami Water",
    color: ["#2c63ff","#2a55d8","#3777ff"],
    category: "liquids",
    state: "liquid",
    density: 1200,
    viscosity: 1,
    behavior: behaviors.LIQUID,
    tick(pixel){
      if(pixel.nd_init!==1){
        pixel.nd_init=1;
        pixel.dir = pixel.dir ?? (Math.random()<0.5?1:-1);
        pixel.life = ND.randi(220,360);
        pixel.push = ND.clamp(pixel.push ?? 4, 3, 6);
      }
      const dir = pixel.dir;
      for(let k=0;k<pixel.push;k++){
        if(tryMove(pixel,pixel.x+dir,pixel.y,undefined,true)) break;
        if(tryMove(pixel,pixel.x+dir,pixel.y+1,undefined,true)) break;
        if(tryMove(pixel,pixel.x+dir,pixel.y-1,undefined,true)) break;
      }
      const foam = ND.pickFirst(["seltzer","steam","smoke"], "steam");
      if(ND.exists(foam) && Math.random()<0.01){
        const x=pixel.x+ND.randi(-1,1), y=pixel.y-1;
        if(!outOfBounds(x,y) && isEmpty(x,y)) createPixel(foam,x,y);
      }
      pixel.life--;
      if(pixel.life<=0){
        const base = ND.pickFirst(["salt_water","water"], "water");
        if(ND.exists(base)) changePixel(pixel, base);
      }
    }
  };

  elements.nd_surge_water = {
    name: "Surge Water",
    color: ["#2f7bff","#2b6fe6","#3a86ff"],
    category: "liquids",
    state: "liquid",
    density: 1120,
    viscosity: 2,
    behavior: behaviors.LIQUID,
    tick(pixel){
      if(pixel.nd_init!==1){
        pixel.nd_init=1;
        pixel.dir = pixel.dir ?? (Math.random()<0.5?1:-1);
        pixel.life = ND.randi(280,560);
        pixel.push = ND.clamp(pixel.push ?? 2, 1, 4);
      }
      if(Math.random()<0.80){
        const dir = pixel.dir;
        for(let k=0;k<pixel.push;k++){
          if(tryMove(pixel,pixel.x+dir,pixel.y,undefined,true)) break;
          if(tryMove(pixel,pixel.x+dir,pixel.y+1,undefined,true)) break;
        }
      }
      pixel.life--;
      if(pixel.life<=0){
        const base = ND.pickFirst(["dirty_water","salt_water","water"], "water");
        if(ND.exists(base)) changePixel(pixel, base);
      }
    }
  };

  elements.nd_hailstone = {
    name: "Hailstone",
    color: ["#e9f6ff","#cfeeff","#bfe6ff"],
    category: "special",
    state: "solid",
    density: 930,
    excludeRandom: true,
    behavior: behaviors.POWDER,
    tick(pixel){
      for(let i=0;i<3;i++){
        if(tryMove(pixel,pixel.x,pixel.y+1)) continue;
        if(tryMove(pixel,pixel.x+(Math.random()<0.5?-1:1),pixel.y+1)) continue;
        break;
      }
      if(!outOfBounds(pixel.x,pixel.y+1) && !isEmpty(pixel.x,pixel.y+1,true) && Math.random()<0.12){
        const p2 = pixelMap[pixel.x][pixel.y+1];
        if(p2 && elements[p2.element]?.breakInto && Math.random()<0.55) breakPixel(p2);
      }
      if((pixel.temp ?? -5) > 0 && Math.random()<0.18){
        const w = ND.pickFirst(["water","dirty_water"], "water");
        if(ND.exists(w)) changePixel(pixel, w);
      }
      doDefaults(pixel);
    }
  };

  elements.nd_pyroclastic = {
    name: "Pyroclastic Flow",
    color: ["#4a4a4a","#5a4a3a","#3a3a3a"],
    category: "special",
    state: "solid",
    density: 600,
    excludeRandom: true,
    behavior: behaviors.POWDER,
    tick(pixel){
      if(pixel.nd_init!==1){
        pixel.nd_init=1;
        pixel.life = ND.randi(180,360);
        pixel.temp = Math.max(pixel.temp ?? 0, 650 + ND.randi(0,350));
      }
      for(let i=0;i<2;i++){
        if(tryMove(pixel,pixel.x,pixel.y+1,undefined,true)) continue;
        if(tryMove(pixel,pixel.x+(Math.random()<0.5?-1:1),pixel.y+1,undefined,true)) continue;
        tryMove(pixel,pixel.x+(Math.random()<0.5?-1:1),pixel.y,undefined,true);
      }
      if(typeof adjacentCoords !== "undefined" && Math.random()<0.35){
        for(const c of adjacentCoords){
          const x=pixel.x+c[0], y=pixel.y+c[1];
          if(outOfBounds(x,y) || isEmpty(x,y,true)) continue;
          const p = pixelMap[x][y];
          if(!p || p.del) continue;
          p.temp = Math.max(p.temp ?? 0, 300 + ND.randi(0,350));
          const info = elements[p.element];
          const burnable = (info?.burn !== undefined && info.burn !== 0) || info?.burnInto || info?.burnTime;
          if(burnable && ND.exists("fire") && Math.random()<0.07){
            const fx=x+ND.randi(-1,1), fy=y-1;
            if(!outOfBounds(fx,fy) && isEmpty(fx,fy)) createPixel("fire", fx, fy);
          }
        }
      }
      pixel.life--;
      if(pixel.life<=0){
        const ash = ND.pickFirst(["ash","dust"], "dust");
        if(ND.exists(ash)) changePixel(pixel, ash);
      }
      doDefaults(pixel);
    }
  };

  elements.nd_volcano_vent = {
    name: "Volcano Vent",
    color: ["#2f2f2f","#3b3b3b","#444444"],
    category: "special",
    state: "solid",
    density: 3000,
    excludeRandom: true,
    noMix: true,
    tick(pixel){
      if(pixel.nd_init!==1){
        pixel.nd_init=1;
        pixel.life = ND.randi(700,1500);
        pixel.power = ND.clamp(pixel.power ?? 1.2, 0.9, 2.8);
      }
      pixel.life--;
      if(pixel.life<=0){ deletePixel(pixel.x,pixel.y); return; }

      const lava = ND.pickFirst(["magma","lava","molten_rock"], "lava");
      const ash  = ND.pickFirst(["ash","dust","smoke"], "smoke");
      const steam= ND.pickFirst(["steam","smoke"], "smoke");

      if(Math.random() < 0.17*pixel.power){
        for(let i=0;i<Math.floor(3+7*pixel.power);i++){
          const x=pixel.x+ND.randi(-1,1), y=pixel.y-1;
          if(!outOfBounds(x,y) && isEmpty(x,y)){
            createPixel(lava,x,y);
            const p=pixelMap[x][y];
            if(p) p.temp = Math.max(p.temp ?? 0, 1000 + 500*pixel.power);
          }
        }
        for(let i=0;i<Math.floor(10+18*pixel.power);i++){
          const x=pixel.x+ND.randi(-3,3), y=pixel.y-ND.randi(3,16);
          if(!outOfBounds(x,y) && isEmpty(x,y) && ND.exists(ash)) createPixel(ash,x,y);
        }
        if(Math.random() < 0.18*pixel.power){
          for(let i=0;i<Math.floor(10+18*pixel.power);i++){
            const x=pixel.x+ND.randi(-4,4), y=pixel.y+ND.randi(1,4);
            if(!outOfBounds(x,y) && isEmpty(x,y)) createPixel("nd_pyroclastic", x, y);
          }
        }
      } else if(Math.random()<0.06 && ND.exists(steam)){
        const x=pixel.x+ND.randi(-1,1), y=pixel.y-1;
        if(!outOfBounds(x,y) && isEmpty(x,y)) createPixel(steam,x,y);
      }
      doDefaults(pixel);
    }
  };

  // Meteor (big)
  function meteorImpact(x,y,power){
    const smoke = ND.pickFirst(["smoke","ash","dust"], "smoke");
    const fire  = ND.pickFirst(["fire","explosion"], "fire");
    const molten= ND.pickFirst(["molten_rock","magma","lava"], "lava");
    const frag  = ND.pickFirst(["hot_rock","rock","stone"], "rock");

    const R = ND.clamp(Math.floor(10 + power*10), 10, 48);

    forCircle(x,y,R,(px,py,dx,dy)=>{
      const dist=Math.hypot(dx,dy);
      const f=1-dist/R;
      if(outOfBounds(px,py)) return;

      if(Math.random()<0.78*f){
        if(!isEmpty(px,py,true)) deletePixel(px,py);
      } else if(!isEmpty(px,py,true)){
        const p=pixelMap[px][py];
        if(!p || p.del) return;
        p.temp = Math.max(p.temp ?? 0, 700 + 1600*f*power);
        if(elements[p.element]?.breakInto && Math.random()<0.18*f*power) breakPixel(p);
        if(ND.exists(molten) && Math.random()<0.15*f*power) changePixel(p, molten);
      } else {
        if(ND.exists(smoke) && Math.random()<0.10*f*power) createPixel(smoke,px,py);
      }
    }, Math.floor(R*R*5.2));

    if(ND.exists(fire)){
      for(let i=0;i<Math.floor(45+power*80);i++){
        const px=x+ND.randi(-R,R), py=y+ND.randi(-R,R);
        if(outOfBounds(px,py)) continue;
        if(isEmpty(px,py) && Math.random()<0.55) createPixel(fire,px,py);
      }
    }

    if(ND.exists(frag)){
      for(let i=0;i<Math.floor(10+power*18);i++){
        const px=x+ND.randi(-R,R), py=y+ND.randi(-R,R);
        if(outOfBounds(px,py) || !isEmpty(px,py)) continue;
        createPixel(frag,px,py);
        const p=pixelMap[px][py];
        if(p) p.temp = Math.max(p.temp ?? 0, 300 + ND.randi(0,700));
      }
    }

    // shock quake
    ND.events.push({ type:"eq", x, y, mag: ND.clamp(5.2 + power*1.7, 4.8, 9.1), t:0, duration: 90 + Math.floor(power*70) });
  }

  elements.nd_meteor = {
    name: "Meteor",
    color: ["#5a4b3b","#6a5a45","#3e352b"],
    category: "special",
    state: "solid",
    density: 9000,
    excludeRandom: true,
    noMix: true,
    tick(pixel){
      if(pixel.nd_init!==1){
        pixel.nd_init=1;
        pixel.power = ND.clamp(pixel.power ?? 1.4, 0.9, 3.2);
        pixel.vx = pixel.vx ?? (Math.random()<0.5?1:-1);
        pixel.vy = pixel.vy ?? (3 + Math.floor(pixel.power));
        pixel.life = ND.randi(220,520);
        pixel.temp = Math.max(pixel.temp ?? 0, 1600);
      }
      pixel.life--;
      if(pixel.life<=0){ deletePixel(pixel.x,pixel.y); return; }

      const steps = 4 + Math.floor(pixel.power);
      for(let i=0;i<steps;i++){
        const nx=pixel.x+Math.sign(pixel.vx);
        const ny=pixel.y+Math.sign(pixel.vy);
        if(outOfBounds(nx,ny)){ deletePixel(pixel.x,pixel.y); return; }
        if(!isEmpty(nx,ny,true)){
          meteorImpact(nx,ny,pixel.power);
          deletePixel(pixel.x,pixel.y);
          return;
        }
        tryMove(pixel,nx,ny,undefined,true);
      }

      const trail = ND.pickFirst(["smoke","fire","plasma"], "smoke");
      if(ND.exists(trail) && Math.random()<0.55){
        const x=pixel.x-Math.sign(pixel.vx), y=pixel.y-1;
        if(!outOfBounds(x,y) && isEmpty(x,y)) createPixel(trail,x,y);
      }
      doDefaults(pixel);
    }
  };

  // ---------- events ----------
  function tickSurge(ev){
    const edgeX = ev.dir === 1 ? 1 : width - 2;
    const h = ND.clamp(ev.waveHeight, 6, height - 2);
    const topY = ND.clamp(height - h, 1, height - 2);
    for(let i=0;i<ev.rate;i++){
      const y = ND.randi(topY, height-2);
      if(outOfBounds(edgeX,y) || !isEmpty(edgeX,y)) continue;
      createPixel(ev.elemName, edgeX, y);
      const p = pixelMap[edgeX][y];
      if(p){
        p.dir = ev.dir;
        p.push = (ev.elemName === "nd_tsunami_water") ? 4 : 2;
      }
    }
  }

  function tickEarthquake(ev){
    ev.t++;
    const mag=ev.mag;
    const radius = Math.floor(18 + mag*7);
    const samples = Math.floor(380 + mag*220);
    const breakChance = ND.clamp(0.004 + (mag-5)*0.003, 0.004, 0.06);
    const dir = (ev.t % 20) < 10 ? 1 : -1;

    for(let i=0;i<samples;i++){
      const x=ND.randi(ev.x-radius, ev.x+radius);
      const y=ND.randi(ev.y-radius, ev.y+radius);
      if(outOfBounds(x,y) || isEmpty(x,y,true)) continue;
      const p=pixelMap[x][y];
      if(!p || p.del) continue;

      const info=elements[p.element];
      if(!info || info.category==="tools" || info.movable===false) continue;

      const dx=x-ev.x, dy=y-ev.y;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if(dist>radius) continue;

      const f=1-dist/radius;

      if(Math.random()<f*0.95){
        const sx=(Math.random()<0.5?-1:1)*dir;
        const sy=(Math.random()<0.22?-1:0);
        tryMove(p, x+sx, y+sy, undefined, true);
      }

      if(info.breakInto && Math.random()<f*breakChance) breakPixel(p);

      if(mag>=6.6 && ND.exists("mud") && (p.element==="wet_sand"||p.element==="sand"||p.element==="gravel") && Math.random()<f*0.03){
        let nearWater=false;
        if(typeof adjacentCoords !== "undefined"){
          for(const c of adjacentCoords){
            const nx=x+c[0], ny=y+c[1];
            if(outOfBounds(nx,ny) || isEmpty(nx,ny,true)) continue;
            const e2=pixelMap[nx][ny]?.element;
            if(e2 && ND.isWater(e2)){ nearWater=true; break; }
          }
        }
        if(nearWater) changePixel(p,"mud");
      }
    }

    if(mag>=7.2 && ev.t%10===0 && Math.random()<0.45){
      const len=Math.floor(14+mag*4);
      const ang=ND.rand(0,Math.PI);
      const dust=ND.pickFirst(["dust","smoke","ash"], "dust");
      for(let i=-len;i<=len;i++){
        const x=Math.floor(ev.x+i*Math.cos(ang));
        const y=Math.floor(ev.y+i*Math.sin(ang));
        if(outOfBounds(x,y)) continue;
        if(!isEmpty(x,y,true) && Math.random()<0.40){
          const p=pixelMap[x][y];
          if(!p) continue;
          if(elements[p.element]?.breakInto) breakPixel(p);
          else if(Math.random()<0.55) deletePixel(x,y);
        } else if(isEmpty(x,y) && ND.exists(dust) && Math.random()<0.10){
          createPixel(dust,x,y);
        }
      }
    }

    if(ev.t>=ev.duration) ev.done=true;
  }

  function tickRainBand(ev){
    const left = ND.clamp(Math.floor(ev.x-ev.span/2), 1, width-2);
    const right= ND.clamp(Math.floor(ev.x+ev.span/2), 1, width-2);
    const water = ND.pickFirst(["water","dirty_water"], "water");
    for(let i=0;i<ev.rainRate;i++){
      const x=ND.randi(left,right), y=ND.randi(1,4);
      if(!outOfBounds(x,y) && isEmpty(x,y)) createPixel(water,x,y);
    }
  }

  function tickSnowBand(ev){
    const left = ND.clamp(Math.floor(ev.x-ev.span/2), 1, width-2);
    const right= ND.clamp(Math.floor(ev.x+ev.span/2), 1, width-2);
    const snow = ND.pickFirst(["snow"], "snow");
    const cold = ND.pickFirst(["cold_air","air"], "air");

    for(let i=0;i<ev.snowRate;i++){
      const x=ND.randi(left,right), y=ND.randi(1,5);
      if(!outOfBounds(x,y) && isEmpty(x,y) && ND.exists(snow)) createPixel(snow,x,y);
      if(!outOfBounds(x,y) && isEmpty(x,y) && ND.exists(cold) && Math.random()<0.20) createPixel(cold,x,y);
    }

    const r = Math.floor(ev.span/4);
    forCircle(ev.x, Math.floor(height/2), r, (x,y)=>{
      if(isEmpty(x,y,true)) return;
      const p=pixelMap[x][y];
      if(!p || p.del) return;
      p.temp = (p.temp ?? 0) - (1.5 + ev.coldPower);
    }, Math.floor(r*r*2.1));
  }

  function tickHailBand(ev){
    const left = ND.clamp(Math.floor(ev.x-ev.span/2), 1, width-2);
    const right= ND.clamp(Math.floor(ev.x+ev.span/2), 1, width-2);
    for(let i=0;i<ev.hailRate;i++){
      const x=ND.randi(left,right), y=ND.randi(1,4);
      if(!outOfBounds(x,y) && isEmpty(x,y)){
        createPixel("nd_hailstone", x, y);
        const p=pixelMap[x][y];
        if(p) p.temp = -6;
      }
    }
  }

  function tickDust(ev){
    const left = ND.clamp(Math.floor(ev.x-ev.span/2), 1, width-2);
    const right= ND.clamp(Math.floor(ev.x+ev.span/2), 1, width-2);
    const dust = ND.pickFirst(["dust","ash","smoke"], "dust");
    const sand = ND.pickFirst(["sand"], "sand");
    for(let i=0;i<ev.rate;i++){
      const x=ND.randi(left,right), y=ND.randi(1,8);
      if(!outOfBounds(x,y) && isEmpty(x,y) && ND.exists(dust)) createPixel(dust,x,y);
      if(!outOfBounds(x,y) && isEmpty(x,y) && ND.exists(sand) && Math.random()<0.25) createPixel(sand,x,y);
    }
  }

  function tickWildfire(ev){
    const fire = ND.pickFirst(["fire"], "fire");
    const smoke = ND.pickFirst(["smoke","ash","dust"], "smoke");
    const samples = Math.floor(ev.r*ev.r*4.2);

    forCircle(ev.x, ev.y, ev.r, (x,y)=>{
      if(isEmpty(x,y,true)) return;
      const p=pixelMap[x][y];
      if(!p || p.del) return;
      const info=elements[p.element];
      if(!info) return;

      const burnable = (info.burn !== undefined && info.burn !== 0) || info.burnInto || info.burnTime;
      if(!burnable) return;

      const fx = x + (Math.random()<0.70 ? ev.wind : 0);
      const fy = y - ND.randi(0,1);
      if(!outOfBounds(fx,fy) && isEmpty(fx,fy) && ND.exists(fire) && Math.random()<0.18) createPixel(fire, fx, fy);

      p.temp = Math.max(p.temp ?? 0, 280 + ND.randi(0,350));
      if(ND.exists(smoke) && Math.random()<0.03){
        const sx=x+ND.randi(-1,1), sy=y-ND.randi(1,3);
        if(!outOfBounds(sx,sy) && isEmpty(sx,sy)) createPixel(smoke,sx,sy);
      }
    }, samples);
  }

  function tickHeatwave(ev){
    const samples = Math.floor(ev.r*ev.r*3.3);
    forCircle(ev.x, ev.y, ev.r, (x,y)=>{
      if(isEmpty(x,y,true)) return;
      const p=pixelMap[x][y];
      if(!p || p.del) return;

      p.temp = (p.temp ?? 0) + ev.heat;

      // dry soil / mud
      if(p.element==="wet_sand" && ND.exists("sand") && Math.random()<0.08) changePixel(p,"sand");
      if(p.element==="mud" && ND.exists("dirt") && Math.random()<0.05) changePixel(p,"dirt");

      // evaporate
      if(ND.isWater(p.element) && ND.exists("steam") && (p.temp ?? 0) > 110 && Math.random()<0.10) changePixel(p,"steam");

      // ignite chance
      const info = elements[p.element];
      const burnable = (info?.burn !== undefined && info.burn !== 0) || info?.burnInto || info?.burnTime;
      if(burnable && ND.exists("fire") && Math.random() < 0.0025*ev.intensity){
        const fx=x+ND.randi(-1,1), fy=y-1;
        if(!outOfBounds(fx,fy) && isEmpty(fx,fy)) createPixel("fire", fx, fy);
      }
    }, samples);
  }

  function tickSlide(ev, snowOnly){
    const loose = new Set(["sand","wet_sand","gravel","dirt","mud","silt","clay","snow","ash","powder","sawdust","salt"]);
    const icey = new Set(["ice","packed_snow"]);
    const samples = Math.floor(ev.r*ev.r*4.6);

    forCircle(ev.x, ev.y, ev.r, (x,y)=>{
      if(isEmpty(x,y,true)) return;
      const p=pixelMap[x][y];
      if(!p || p.del) return;
      const e=p.element;

      if(snowOnly){
        if(!(e==="snow" || icey.has(e))) return;
      }
      const st=stateOf(e);
      const canMove = loose.has(e) || st==="powder" || (snowOnly && icey.has(e));
      if(!canMove) return;

      const side = (Math.random()<0.7 ? ev.dir : -ev.dir);
      if(!tryMove(p,x,y+1,undefined,true)){
        if(!tryMove(p,x+side,y+1,undefined,true)){
          tryMove(p,x+side,y,undefined,true);
        }
      }
    }, samples);
  }

  function tickSinkhole(ev){
    const r = ND.clamp(ev.r + Math.floor(ev.t/22), ev.r, ev.r+12);
    const dust = ND.pickFirst(["dust","smoke","ash"], "dust");
    forCircle(ev.x, ev.y, r, (x,y,dx,dy)=>{
      const dist=Math.hypot(dx,dy);
      const f=1-dist/r;
      if(outOfBounds(x,y)) return;
      if(!isEmpty(x,y,true) && Math.random()<0.55*f){
        const p=pixelMap[x][y];
        if(!p) return;
        if(elements[p.element]?.breakInto && Math.random()<0.35) breakPixel(p);
        else deletePixel(x,y);

        if(ND.exists(dust) && Math.random()<0.12){
          const sx=x+ND.randi(-1,1), sy=y-ND.randi(0,2);
          if(!outOfBounds(sx,sy) && isEmpty(sx,sy)) createPixel(dust,sx,sy);
        }
      }
    }, Math.floor(r*r*5.2));
  }

  function tickAshfall(ev){
    const left = ND.clamp(Math.floor(ev.x-ev.span/2), 1, width-2);
    const right= ND.clamp(Math.floor(ev.x+ev.span/2), 1, width-2);
    const ash = ND.pickFirst(["ash","dust"], "dust");
    for(let i=0;i<ev.rate;i++){
      const x=ND.randi(left,right), y=ND.randi(1,5);
      if(!outOfBounds(x,y) && isEmpty(x,y) && ND.exists(ash)) createPixel(ash,x,y);
    }
  }

  // main tick
  runEveryTick(function(){
    if(!ND.events.length) return;

    for(const ev of ND.events){
      if(!ev || ev.done) continue;
      ev.t = (ev.t ?? 0) + 1;

      if(ev.type==="eq") tickEarthquake(ev);

      else if(ev.type==="surge") tickSurge(ev);

      else if(ev.type==="thunderstorm"){
        tickRainBand(ev);
        windPush(ev.windDir, ev.windStrength, 0.10);
        if(ev.hailRate>0 && Math.random()<0.70) tickHailBand(ev);
        if(Math.random() < ev.lightningFreq){
          const lx = ND.clamp(Math.floor(ev.x + ND.rand(-ev.span/2, ev.span/2)), 2, width-3);
          lightningStrike(lx, ev.lightningPower);
        }
      }

      else if(ev.type==="hurricane"){
        tickRainBand(ev);
        windPush(ev.windDir, ev.windStrength, 0.18);

        if(ev.surge && Math.random()<0.70){
          ev.surge.t = (ev.surge.t ?? 0) + 1;
          tickSurge(ev.surge);
        }

        if(Math.random() < ev.tornadoFreq){
          const x = ND.clamp(Math.floor(ev.x + ND.rand(-ev.span/2, ev.span/2)), 2, width-3);
          const y = ND.clamp(height - ND.randi(12,45), 2, height-3);
          if(isEmpty(x,y)){
            createPixel("nd_mega_tornado", x, y);
            const t = pixelMap[x][y];
            if(t){
              t.power = ND.clamp(1.0 + ev.windStrength/2, 1.0, 2.6);
              t.radius = ND.clamp(18 + Math.floor(ev.windStrength*3), 16, 40);
              t.life = ND.randi(450, 900);
            }
          }
        }

        if(Math.random() < ev.lightningFreq){
          const lx = ND.clamp(Math.floor(ev.x + ND.rand(-ev.span/2, ev.span/2)), 2, width-3);
          lightningStrike(lx, ev.lightningPower);
        }
      }

      else if(ev.type==="blizzard"){
        tickSnowBand(ev);
        windPush(ev.windDir, ev.windStrength, 0.10);

        // drifts
        const driftSamples = Math.floor(200 + ev.windStrength*140);
        for(let i=0;i<driftSamples;i++){
          const x=ND.randi(2,width-3);
          const y=ND.randi(Math.floor(height*0.45), height-2);
          if(outOfBounds(x,y) || isEmpty(x,y,true)) continue;
          const p=pixelMap[x][y];
          if(!p || p.del) continue;
          if(p.element==="snow" || p.element==="packed_snow"){
            if(Math.random()<0.55) tryMove(p, x+ev.windDir, y, undefined, true);
          }
        }
      }

      else if(ev.type==="hailstorm"){
        tickHailBand(ev);
        windPush(ev.windDir, ev.windStrength, 0.05);
      }

      else if(ev.type==="duststorm"){
        tickDust(ev);
        windPush(ev.windDir, ev.windStrength, 0.03);
      }

      else if(ev.type==="heatwave") tickHeatwave(ev);

      else if(ev.type==="wildfire"){
        tickWildfire(ev);
        windPush(ev.wind, 1.2, 0.12);
      }

      else if(ev.type==="landslide") tickSlide(ev,false);
      else if(ev.type==="avalanche") tickSlide(ev,true);

      else if(ev.type==="sinkhole") tickSinkhole(ev);

      else if(ev.type==="ashfall") tickAshfall(ev);

      if(ev.duration && ev.t >= ev.duration) ev.done = true;
    }

    ND.events = ND.events.filter(e => e && !e.done);
  });

  // ---------- spawn helpers ----------
  function quakeMag(){
    let mag = 6.0 + ND.brush()/9;
    if(ND.isShift()) mag += 2.0;
    return ND.clamp(mag, 4.8, 9.6);
  }

  function spawnMegaTornado(x,y, mult){
    if(outOfBounds(x,y)) return;
    if(!isEmpty(x,y,true)) deletePixel(x,y);
    createPixel("nd_mega_tornado", x, y);
    const t = pixelMap[x][y];
    if(!t) return;
    const base=ND.brush();
    const strong=ND.isShift();
    const m = mult ?? 1;

    t.power  = ND.clamp((1.1 + base/14) * (strong?1.35:1.0) * m, 0.9, 2.8);
    t.radius = ND.clamp(Math.floor((18 + base*1.7) * (strong?1.25:1.0) * m), 14, 44);
    t.life   = ND.randi(650,1100) + (strong?650:0);
  }

  function spawnTsunami(fromX){
    const dir = fromX < width/2 ? 1 : -1;
    const h = ND.clamp(30 + ND.brush()*5 + (ND.isShift()?26:0), 16, height-2);
    const rate = ND.clamp(16 + Math.floor(ND.brush()*2.2), 14, 80);
    ND.events.push({ type:"surge", dir, waveHeight:h, rate, elemName:"nd_tsunami_water", duration: 120 + (ND.isShift()?70:0), t:0 });
  }

  function spawnFlood(x){
    const span = ND.clamp(90 + ND.brush()*22, 70, width-2);
    const rainRate = ND.clamp(18 + Math.floor(ND.brush()*2.2), 16, 180);
    ND.events.push({
      type:"thunderstorm",
      x, span,
      rainRate,
      hailRate: 0,
      windDir: (Math.random()<0.5?-1:1),
      windStrength: ND.clamp(0.8 + ND.brush()/12, 0.7, 2.0),
      lightningFreq: 0,
      lightningPower: 1.0,
      duration: 260 + (ND.isShift()?220:0),
      t:0
    });
  }

  function spawnThunderstorm(x){
    const span = ND.clamp(110 + ND.brush()*24, 90, width-2);
    const rainRate = ND.clamp(18 + Math.floor(ND.brush()*2.3), 16, 200);
    const windDir = (Math.random()<0.5?-1:1);
    ND.events.push({
      type:"thunderstorm",
      x, span,
      rainRate,
      hailRate: ND.isShift() ? ND.clamp(16 + Math.floor(ND.brush()*2.1), 16, 260) : 0,
      windDir,
      windStrength: ND.clamp(1.0 + ND.brush()/10, 0.8, 2.6),
      lightningFreq: ND.clamp(0.04 + ND.brush()/850, 0.04, 0.14),
      lightningPower: ND.clamp(1.0 + ND.brush()/18, 1.0, 2.4),
      duration: 280 + (ND.isShift()?260:0),
      t:0
    });
  }

  function spawnHurricane(x){
    const span = ND.clamp(180 + ND.brush()*30, 150, width-2);
    const rainRate = ND.clamp(35 + Math.floor(ND.brush()*3.0), 30, 260);
    const windDir = (x < width/2) ? 1 : -1;
    const windStrength = ND.clamp(1.4 + ND.brush()/8 + (ND.isShift()?1.0:0), 1.2, 3.3);

    ND.events.push({
      type:"hurricane",
      x, span,
      rainRate,
      windDir,
      windStrength,
      lightningFreq: ND.clamp(0.02 + ND.brush()/1200, 0.02, 0.08),
      lightningPower: ND.clamp(1.2 + ND.brush()/16, 1.2, 2.8),
      tornadoFreq: ND.clamp(0.006 + windStrength/850, 0.006, 0.022),
      surge: {
        type:"surge",
        dir: windDir,
        waveHeight: ND.clamp(22 + ND.brush()*4 + (ND.isShift()?20:0), 16, height-2),
        rate: ND.clamp(18 + Math.floor(ND.brush()*2.4), 18, 140),
        elemName:"nd_surge_water",
        duration: 180 + (ND.isShift()?120:0),
        t:0
      },
      duration: 460 + (ND.isShift()?460:0),
      t:0
    });
  }

  function spawnBlizzard(x){
    ND.events.push({
      type:"blizzard",
      x,
      span: ND.clamp(130 + ND.brush()*26, 100, width-2),
      snowRate: ND.clamp(20 + Math.floor(ND.brush()*2.6), 18, 220),
      windDir: (Math.random()<0.5?-1:1),
      windStrength: ND.clamp(1.3 + ND.brush()/10 + (ND.isShift()?0.9:0), 1.0, 3.3),
      coldPower: ND.clamp(2.0 + ND.brush()/14 + (ND.isShift()?1.5:0), 2.0, 6.0),
      duration: 360 + (ND.isShift()?420:0),
      t:0
    });
  }

  function spawnHailstorm(x){
    ND.events.push({
      type:"hailstorm",
      x,
      span: ND.clamp(110 + ND.brush()*24, 90, width-2),
      hailRate: ND.clamp(20 + Math.floor(ND.brush()*3.0) + (ND.isShift()?40:0), 20, 320),
      windDir: (Math.random()<0.5?-1:1),
      windStrength: ND.clamp(1.0 + ND.brush()/12, 0.8, 2.6),
      duration: 240 + (ND.isShift()?260:0),
      t:0
    });
  }

  function spawnDuststorm(x){
    ND.events.push({
      type:"duststorm",
      x,
      span: ND.clamp(140 + ND.brush()*30, 110, width-2),
      rate: ND.clamp(20 + Math.floor(ND.brush()*2.4), 20, 240),
      windDir: (Math.random()<0.5?-1:1),
      windStrength: ND.clamp(1.4 + ND.brush()/10 + (ND.isShift()?1.0:0), 1.1, 3.6),
      duration: 280 + (ND.isShift()?320:0),
      t:0
    });
  }

  function spawnHeatwave(x,y){
    ND.events.push({
      type:"heatwave",
      x,y,
      r: ND.clamp(40 + ND.brush()*9, 40, 260),
      heat: ND.clamp(1.0 + ND.brush()/22 + (ND.isShift()?1.1:0), 0.9, 3.8),
      intensity: ND.clamp(1.0 + ND.brush()/10 + (ND.isShift()?1.3:0), 1.0, 4.4),
      duration: 340 + (ND.isShift()?460:0),
      t:0
    });
  }

  function spawnWildfire(x,y){
    ND.events.push({
      type:"wildfire",
      x,y,
      r: ND.clamp(22 + ND.brush()*6, 22, 300),
      wind: (Math.random()<0.5?-1:1),
      duration: 340 + (ND.isShift()?480:0),
      t:0
    });
  }

  function spawnLandslide(x,y){
    ND.events.push({
      type:"landslide",
      x,y,
      r: ND.clamp(26 + ND.brush()*7, 26, 320),
      dir: (Math.random()<0.5?-1:1),
      duration: 240 + (ND.isShift()?280:0),
      t:0
    });
  }

  function spawnAvalanche(x,y){
    ND.events.push({
      type:"avalanche",
      x,y,
      r: ND.clamp(28 + ND.brush()*8, 28, 360),
      dir: (Math.random()<0.5?-1:1),
      duration: 240 + (ND.isShift()?300:0),
      t:0
    });
  }

  function spawnSinkhole(x,y){
    ND.events.push({
      type:"sinkhole",
      x,y,
      r: ND.clamp(10 + ND.brush()*3 + (ND.isShift()?14:0), 10, 220),
      duration: 240 + (ND.isShift()?260:0),
      t:0
    });
  }

  function spawnVolcano(x,y){
    if(outOfBounds(x,y)) return;
    const r = ND.clamp(4 + Math.floor(ND.brush()/2), 4, 18);
    const rock = ND.pickFirst(["basalt","rock","stone"], "rock");

    forCircle(x,y,r,(px,py,dx,dy)=>{
      const dist=Math.hypot(dx,dy);
      if(dist < r*0.55){
        if(!isEmpty(px,py,true) && Math.random()<0.70) deletePixel(px,py);
      } else {
        if(!outOfBounds(px,py) && isEmpty(px,py) && ND.exists(rock) && Math.random()<0.32) createPixel(rock,px,py);
      }
    }, Math.floor(r*r*6.5));

    if(!isEmpty(x,y,true)) deletePixel(x,y);
    createPixel("nd_volcano_vent", x, y);
    const v=pixelMap[x][y];
    if(v){
      v.power = ND.clamp(1.0 + ND.brush()/10 + (ND.isShift()?1.0:0), 0.9, 2.8);
      v.life  = ND.randi(750,1300) + (ND.isShift()?1100:0);
      v.temp  = Math.max(v.temp ?? 0, 950);
    }

    // ashfall burst
    ND.events.push({
      type:"ashfall",
      x,
      span: ND.clamp(140 + ND.brush()*34, 100, width-2),
      rate: ND.clamp(22 + Math.floor(ND.brush()*2.8) + (ND.isShift()?60:0), 22, 320),
      duration: 260 + (ND.isShift()?360:0),
      t:0
    });
  }

  function spawnAshfall(x){
    ND.events.push({
      type:"ashfall",
      x,
      span: ND.clamp(140 + ND.brush()*34, 100, width-2),
      rate: ND.clamp(22 + Math.floor(ND.brush()*2.8) + (ND.isShift()?60:0), 22, 320),
      duration: 260 + (ND.isShift()?360:0),
      t:0
    });
  }

  function spawnPyroclastic(x,y){
    const count = ND.clamp(60 + ND.brush()*18 + (ND.isShift()?180:0), 60, 700);
    for(let i=0;i<count;i++){
      const px=ND.clamp(x+ND.randi(-7,7), 2, width-3);
      const py=ND.clamp(y+ND.randi(-2,7), 2, height-3);
      if(isEmpty(px,py)) createPixel("nd_pyroclastic", px, py);
    }
  }

  function spawnMeteorAt(tx,ty,pMult){
    const x = ND.clamp(tx + ND.randi(-12,12), 2, width-3);
    const y = 2;
    if(!isEmpty(x,y,true)) deletePixel(x,y);
    createPixel("nd_meteor", x, y);
    const m=pixelMap[x][y];
    if(!m) return;

    const base=ND.brush();
    const strong=ND.isShift();
    const pm = pMult ?? 1;

    const power = ND.clamp((1.3 + base/9) * (strong?1.35:1.0) * pm, 0.9, 3.2);
    m.power = power;
    const dx = tx - x;
    m.vx = dx===0 ? (Math.random()<0.5?-1:1) : Math.sign(dx);
    m.vy = 3 + Math.floor(power);
    m.temp = 1700;
  }

  function spawnMeteorShower(x,y){
    const count = ND.clamp(4 + Math.floor(ND.brush()/2) + (ND.isShift()?8:0), 4, 32);
    const spread = ND.clamp(90 + ND.brush()*22, 70, 520);
    for(let i=0;i<count;i++){
      const px = ND.clamp(x + Math.floor(ND.rand(-spread, spread)), 2, width-3);
      const py = ND.clamp(y + Math.floor(ND.rand(-spread/3, spread/3)), 2, height-3);
      spawnMeteorAt(px, py, ND.rand(0.55, 1.15) * (ND.isShift()?1.15:1.0));
    }
  }

  // ---------- TOOL MAKER (prevents block painting) ----------
  function makeTool(id, color, name, desc, cooldownKey, cooldownTicks, run){
    elements[id] = {
      name,
      color,
      category: ND_CAT,
      canPlace: false,
      excludeRandom: true,
      noMix: true,
      desc,
      tool(pixel){
        if(!ND.canTrigger(cooldownKey, cooldownTicks)) return;
        const x = pixel?.x ?? mousePos?.x ?? Math.floor(width/2);
        const y = pixel?.y ?? mousePos?.y ?? Math.floor(height/2);
        run(x,y);
      },
      onMouseDown(e){
        if(!ND.canTrigger(cooldownKey, cooldownTicks)) return;
        const p = ND.posFromEvent(e);
        run(p.x,p.y);
      }
    };
  }

  // ---------- tools ----------
  makeTool("nd_earthquake_tool", "#b58b5a", "Earthquake",
    "Effect tool (no blocks). Brush = stronger. Shift = extreme.",
    "eq", 6, (x,y)=> ND.events.push({type:"eq", x, y, mag: quakeMag(), t:0, duration: Math.floor(90 + quakeMag()*35)}));

  makeTool("nd_mega_tornado_tool", "#6f6f6f", "Mega Tornado",
    "Actually grabs lots of voxels. Brush = size. Shift = monster.",
    "tor", 8, (x,y)=> spawnMegaTornado(x,y,1));

  makeTool("nd_tornado_outbreak_tool", "#555555", "Tornado Outbreak",
    "Spawns multiple tornadoes in an area. Brush = count/spread. Shift = many.",
    "outbreak", 18, (x,y)=>{
      const count = ND.clamp(3 + Math.floor(ND.brush()/2) + (ND.isShift()?4:0), 3, 18);
      const spread = ND.clamp(30 + ND.brush()*7, 30, 260);
      for(let i=0;i<count;i++){
        const px = ND.clamp(x + Math.floor(ND.rand(-spread, spread)), 2, width-3);
        const py = ND.clamp(y + Math.floor(ND.rand(-18, 18)), 2, height-3);
        spawnMegaTornado(px, py, ND.rand(0.75, 1.15));
      }
    });

  makeTool("nd_flood_tool", "#2f7bff", "Flood",
    "Heavy rain flooding (effect tool). Brush = wider/stronger. Shift = longer.",
    "flood", 10, (x)=> spawnFlood(x));

  makeTool("nd_tsunami_tool", "#1f49c7", "Tsunami",
    "Working tsunami (surge ticked). Comes from nearest side. Brush = height. Shift = mega.",
    "tsu", 12, (x)=> spawnTsunami(x));

  makeTool("nd_thunderstorm_tool", "#6aa6ff", "Thunderstorm",
    "Rain + wind + lightning. Shift adds hail.",
    "storm", 12, (x)=> spawnThunderstorm(x));

  makeTool("nd_hurricane_tool", "#3f7bd9", "Hurricane",
    "Huge wind + rain + storm surge + occasional tornadoes. Shift = category 5.",
    "hur", 16, (x)=> spawnHurricane(x));

  makeTool("nd_blizzard_tool", "#cfeeff", "Blizzard",
    "Wind + heavy snow + strong cooling + drifts. Shift = extreme.",
    "bliz", 14, (x)=> spawnBlizzard(x));

  makeTool("nd_hailstorm_tool", "#bfe6ff", "Hailstorm",
    "Damaging hail + wind. Shift = brutal.",
    "hail", 12, (x)=> spawnHailstorm(x));

  makeTool("nd_duststorm_tool", "#c2a36a", "Dust Storm",
    "Dust + sand + strong wind. Shift = extreme.",
    "dust", 12, (x)=> spawnDuststorm(x));

  makeTool("nd_heatwave_tool", "#ffb000", "Heatwave / Drought",
    "Heats radius, dries soil, evaporates water, can start fires. Shift = severe.",
    "heat", 12, (x,y)=> spawnHeatwave(x,y));

  makeTool("nd_wildfire_tool", "#ff6a00", "Wildfire Front",
    "Starts a wind-driven wildfire. Shift = bigger/longer.",
    "wf", 12, (x,y)=> spawnWildfire(x,y));

  makeTool("nd_landslide_tool", "#8b6b4a", "Landslide",
    "Destabilizes loose terrain. Shift = stronger/longer.",
    "slide", 12, (x,y)=> spawnLandslide(x,y));

  makeTool("nd_avalanche_tool", "#e6f6ff", "Avalanche",
    "Moves snow/ice downhill fast. Shift = huge.",
    "aval", 12, (x,y)=> spawnAvalanche(x,y));

  makeTool("nd_sinkhole_tool", "#3a2f28", "Sinkhole",
    "Ground collapses into a hole. Shift = wider/deeper.",
    "sink", 14, (x,y)=> spawnSinkhole(x,y));

  makeTool("nd_volcano_tool", "#3b3b3b", "Volcano",
    "Erupting vent + ashfall + pyroclastic bursts. Shift = massive.",
    "vol", 18, (x,y)=> spawnVolcano(x,y));

  makeTool("nd_ashfall_tool", "#777777", "Ashfall",
    "Drops ash from the sky. Shift = heavy.",
    "ash", 12, (x)=> spawnAshfall(x));

  makeTool("nd_pyroclastic_tool", "#4a4a4a", "Pyroclastic Flow",
    "Hot fast ash flow that ignites things. Shift = huge.",
    "pyro", 14, (x,y)=> spawnPyroclastic(x,y));

  makeTool("nd_meteor_tool", "#6a5a45", "Meteor",
    "Massive impact (crater + fires + quake). Shift = huge.",
    "met", 16, (x,y)=> spawnMeteorAt(x,y,1));

  makeTool("nd_meteor_shower_tool", "#8a7a65", "Meteor Shower",
    "Multiple meteors across an area. Shift = chaos.",
    "mets", 22, (x,y)=> spawnMeteorShower(x,y));
});
