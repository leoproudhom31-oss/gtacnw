/* ============================================================
   JADE HARBOR — game.js
   Le « monde » : boucle de simulation, trafic, piétons,
   système de recherche (wanted), événements, rendu, save.
   ============================================================ */
"use strict";
(function (G) {

  const U = G.U, E = () => G.Ent;

  const SAVE_KEY = "jadeharbor_save_v1";

  const W = {
    state: "title",     // title | play | dead | busted
    time: 0,
    viewW: 1280, viewH: 720,

    player: null,
    peds: [],
    vehicles: [],
    bullets: [],
    particles: [],
    pickups: [],
    decals: [],
    skids: [],

    wanted: { level: 0, heat: 0, unseenT: 0, evadeT: 0, bustT: 0 },

    _spawnT: 0,
    _districtT: 0,
    _stateT: 0,
    _rng: U.makeRng(Date.now() >>> 0)
  };

  /* =========================================================
     INITIALISATION
     ========================================================= */

  function init(fromSave) {
    const Mp = G.Map;
    W.peds = []; W.vehicles = []; W.bullets = [];
    W.particles = []; W.pickups = []; W.decals = []; W.skids = [];
    W.wanted = { level: 0, heat: 0, unseenT: 0, evadeT: 0, bustT: 0 };
    W.time = 0;

    // joueur : Jin débarque du ferry, au bout de la jetée
    const sp = Mp.POI.spawn;
    W.player = E().makePlayer(sp.x, sp.y);

    if (fromSave) {
      const d = loadData();
      if (d) {
        G.Missions.deserialize(d.missions);
        W.player.money = d.money || 0;
        W.player.armor = d.armor || 0;
        if (d.weapons) W.player.weapons = d.weapons;
        if (d.ammo) W.player.ammo = d.ammo;
        if (G.Missions.state.completed.m1) {
          // reprendre près du salon de thé
          const th = Mp.POI.teahouse;
          W.player.x = th.x; W.player.y = th.y + 40;
        }
      }
    }

    G.Camera.snapTo(W.player.x, W.player.y);

    // voitures garées
    for (const s of Mp.parkedSpawns) {
      W.vehicles.push(E().makeVehicle(s.type, s.x, s.y, s.angle, s.color));
    }

    // pickups de la carte
    for (const p of Mp.pickupSpawns) {
      W.pickups.push(E().makePickup(p.kind, p.x, p.y, p.amount));
    }

    // PNJ fixes : Wu devant le salon de thé, Long au garage
    spawnStaticNpc("wu", Mp.POI.teahouse.x - 30, Mp.POI.teahouse.y - 6);
    spawnStaticNpc("lotus", Mp.POI.garage.x + 34, Mp.POI.garage.y - 6);

    W.state = "play";
  }

  function spawnStaticNpc(kind, x, y) {
    const p = E().makePed(kind, x, y);
    p.state = "dummy";
    p.noDespawn = true;
    p.angle = Math.PI / 2;
    p.staticNpc = true;
    W.peds.push(p);
  }

  /* =========================================================
     SERVICES OFFERTS AUX ENTITÉS / MISSIONS
     ========================================================= */

  W.toast = (t, s) => G.HUD.toast(t, s);

  W.giveMoney = function (n) {
    W.player.money += n;
    G.HUD.moneyGain(n);
    W.addParticle("cashpop", W.player.x, W.player.y - 10, 3);
  };

  W.spawnBullet = function (src, x, y, angle, dmg, team) {
    W.bullets.push(E().makeBullet(src, x, y, angle, dmg, team));
  };

  W.addParticle = function (type, x, y, n) {
    for (let i = 0; i < (n || 1); i++) {
      if (W.particles.length > 400) W.particles.shift();
      W.particles.push(E().makeParticle(type, x, y));
    }
  };

  W.addDecal = function (type, x, y) {
    if (W.decals.length > 70) W.decals.shift();
    W.decals.push({ type, x, y, life: 40, r: type === "scorch" ? 34 : 10 + Math.random() * 6, a: Math.random() * U.TAU });
  };

  W.addSkid = function (v) {
    if (W.skids.length > 500) W.skids.splice(0, 2);
    const fw = { x: Math.cos(v.angle), y: Math.sin(v.angle) };
    const rt = { x: -fw.y, y: fw.x };
    const bx = v.x - fw.x * v.def.L * 0.30, by = v.y - fw.y * v.def.L * 0.30;
    for (const s of [-1, 1]) {
      const wx = bx + rt.x * v.def.W * 0.38 * s, wy = by + rt.y * v.def.W * 0.38 * s;
      W.skids.push({ x0: wx - v.vx * 0.016, y0: wy - v.vy * 0.016, x1: wx, y1: wy, life: 14 });
    }
  };

  W.nearestVehicle = function (x, y, maxD) {
    let best = null, bd = maxD;
    for (const v of W.vehicles) {
      const d = U.dist(x, y, v.x, v.y);
      if (d < bd) { best = v; bd = d; }
    }
    return best;
  };

  W.hurtPlayer = function (dmg, src) {
    E().hurtPlayer(W.player, W, dmg);
  };

  // ---- bruit : réactions des passants et témoins ----
  W.noise = function (x, y, r, kind) {
    for (const p of W.peds) {
      if (p.dead || p.staticNpc) continue;
      if (p.kind === "civ" && U.dist2(p.x, p.y, x, y) < r * r) {
        p.state = "flee";
        p.threatX = x; p.threatY = y;
      }
    }
    // les voitures proches paniquent
    if (kind === "shot") {
      for (const v of W.vehicles) {
        if (v.ai && v.ai.mode === "cruise" && U.dist2(v.x, v.y, x, y) < r * r) v.ai.panicT = 5;
      }
      // témoin policier ?
      if (copNearby(x, y, r + 120)) {
        if (W.wanted.heat < 35) W.setWanted(1);
        else W.addHeat(6, true);
      }
    }
  };

  function copNearby(x, y, r) {
    for (const p of W.peds) {
      if (!p.dead && p.kind === "cop" && U.dist2(p.x, p.y, x, y) < r * r) return true;
    }
    for (const v of W.vehicles) {
      if (v.type === "police" && v.ai && !v.wreck && U.dist2(v.x, v.y, x, y) < r * r) return true;
    }
    return false;
  }

  W.addHeat = function (amount, forceSeen) {
    if (!forceSeen && !copNearby(W.player.x, W.player.y, 520)) amount *= 0.4;
    W.wanted.heat = U.clamp(W.wanted.heat + amount, 0, 5 * 35 + 30);
    refreshWantedLevel();
  };

  W.setWanted = function (n) {
    W.wanted.heat = n * 35;
    refreshWantedLevel();
  };

  function refreshWantedLevel() {
    const lvl = Math.min(5, Math.floor(W.wanted.heat / 35));
    if (lvl > W.wanted.level) {
      G.Audio.play("star");
      G.Camera.shake(0.1);
    }
    W.wanted.level = lvl;
  }

  // ---- événements de gameplay ----
  W.onPedKilled = function (p, srcKind) {
    if (srcKind === "player" || srcKind === "playercar") {
      if (p.kind === "civ") W.addHeat(26, false);
      else if (p.kind === "cop") W.addHeat(40, true);
      else W.addHeat(8, false);
      // les gangsters lâchent des billets
      if ((p.kind === "shark" || p.kind === "lotus") && Math.random() < 0.6) {
        W.pickups.push(E().makePickup("cash", p.x + 8, p.y + 4, 10 + (Math.random() * 30 | 0)));
      }
    }
  };

  W.onPlayerShotPed = function (p) {
    if (p.kind === "civ") W.addHeat(9, false);
  };

  W.onPlayerAttack = function (p) {
    if (p.kind === "civ" || p.kind === "wu") W.addHeat(5, false);
    if (p.kind === "cop") W.addHeat(22, true);
  };

  W.onPlayerRanOver = function (p) {
    if (p.kind === "civ") W.addHeat(14, false);
    if (p.kind === "cop") W.addHeat(30, true);
  };

  W.onVehicleExploded = function (v) {
    if (v.type === "police" && W.wanted.level > 0) {
      W.wanted.heat = Math.max(0, W.wanted.heat - 38);
      refreshWantedLevel();
      if (W.wanted.level === 0) W.wanted.unseenT = 99;
      W.toast("Patrouille neutralisée : la pression retombe !");
      G.Audio.setSiren(v.id, false);
    } else if (v.lastDamager === "player") {
      W.addHeat(12, false);
    }
  };

  W.onEnterVehicle = function (v) {
    G.HUD.tutorial("Conduite : haut/bas = accélérer/freiner, gauche/droite = tourner, ESPACE = frein à main, E = descendre.", 6);
    W.onEnterVehicle = function () {}; // une seule fois
  };

  W.onWasted = function () {
    if (W.state !== "play") return;
    W.state = "dead";
    W._stateT = 3.2;
    G.Audio.play("wasted");
    G.Audio.stopEngine();
    G.HUD.showBanner("TU ES TOMBÉ", "#ff5340", "L'hôpital de Jade Harbor te rafistole… (-150 $)", 3.2);
    G.Missions.onPlayerDown(W, "Jin est tombé au combat.");
  };

  function onBusted() {
    if (W.state !== "play") return;
    W.state = "busted";
    W._stateT = 3.2;
    G.Audio.stopEngine();
    G.HUD.showBanner("EN ÉTAT D'ARRESTATION", "#3b8bff", "La police confisque une partie de ton argent… (-100 $)", 3.2);
    G.Missions.onPlayerDown(W, "Jin s'est fait épingler par la police.");
  }

  // ---- PNJ de mission ----
  W.spawnMissionPed = function (kind, x, y, opts) {
    const p = E().makePed(kind, x, y);
    p.missionTag = "enemy";
    p.missionGroup = opts.tag;
    p.weapon = opts.weapon || "fist";
    p.noDespawn = true;
    if (opts.dummy) {
      p.state = "dummy";
      p.hp = 20;
    } else {
      p.state = "chase";
      p.aggro = W.player;
    }
    W.peds.push(p);
    return p;
  };

  W.countMissionPeds = function (tag) {
    let n = 0;
    for (const p of W.peds) if (p.missionGroup === tag && !p.dead) n++;
    return n;
  };

  W.clearMissionPeds = function () {
    for (const p of W.peds) if (p.missionTag && !p.staticNpc) p.dead = true, p.corpseT = 0.5;
    for (const pk of W.pickups) if (pk.missionTag) pk.taken = true;
  };

  /* =========================================================
     SAUVEGARDE
     ========================================================= */

  W.save = function () {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        missions: G.Missions.serialize(),
        money: W.player.money,
        armor: W.player.armor,
        weapons: W.player.weapons,
        ammo: W.player.ammo
      }));
      G.HUD.toast("Partie sauvegardée", 2);
    } catch (e) { /* stockage indisponible */ }
  };

  function loadData() {
    try {
      const s = localStorage.getItem(SAVE_KEY);
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  }
  W.hasSave = function () { return !!loadData(); };

  /* =========================================================
     BOUCLE DE SIMULATION
     ========================================================= */

  function update(dt) {
    W.time += dt;
    G.Audio.musicTick(dt);

    if (W.state === "dead" || W.state === "busted") {
      W._stateT -= dt;
      updateParticles(dt);
      if (W._stateT <= 0) respawn(W.state === "dead" ? "hospital" : "police");
      return;
    }
    if (W.state !== "play") return;

    // pendant un dialogue, le monde retient son souffle
    if (G.HUD.dialogueActive) {
      G.HUD.update(W, dt);
      G.Camera.update(dt, W.player);
      updateParticles(dt);
      return;
    }

    E().playerUpdate(W.player, W, dt);

    // piétons
    for (let i = W.peds.length - 1; i >= 0; i--) {
      const p = W.peds[i];
      if (p.state === "dummy" && !p.dead) { /* statique */ }
      else if (!E().updatePed(p, W, dt)) { W.peds.splice(i, 1); continue; }
      if (p.dead && p.corpseT <= 0) W.peds.splice(i, 1);
    }

    // véhicules
    for (const v of W.vehicles) E().updateVehicle(v, W, dt);

    // balles
    for (let i = W.bullets.length - 1; i >= 0; i--) {
      if (!E().updateBullet(W.bullets[i], W, dt)) W.bullets.splice(i, 1);
    }

    updateParticles(dt);

    // pickups
    for (const pk of W.pickups) E().updatePickup(pk, W, dt);

    // décals / traces
    for (let i = W.decals.length - 1; i >= 0; i--) {
      W.decals[i].life -= dt;
      if (W.decals[i].life <= 0) W.decals.splice(i, 1);
    }
    for (let i = W.skids.length - 1; i >= 0; i--) {
      W.skids[i].life -= dt;
      if (W.skids[i].life <= 0) W.skids.splice(i, 1);
    }

    maintainCrowd(dt);
    updateWanted(dt);
    G.Missions.update(W, dt);

    // annonce de quartier
    W._districtT -= dt;
    if (W._districtT <= 0) {
      W._districtT = 0.6;
      const d = G.Map.districtAt(W.player.x, W.player.y);
      if (d) G.HUD.announceDistrict(d.name);
    }

    G.Camera.update(dt, W.player);
    G.HUD.update(W, dt);
  }

  function updateParticles(dt) {
    for (let i = W.particles.length - 1; i >= 0; i--) {
      if (!E().updateParticle(W.particles[i], dt)) W.particles.splice(i, 1);
    }
  }

  function respawn(where) {
    const pl = W.player;
    const poi = G.Map.POI[where === "hospital" ? "hospital" : "police"];
    if (pl.vehicle) { pl.vehicle.driverKind = null; }
    pl.x = poi.x; pl.y = poi.y + 30;
    pl.hp = pl.maxHp;
    pl.dead = false;
    pl.busted = false;
    pl.vehicle = null;
    pl.money = Math.max(0, pl.money - (where === "hospital" ? 150 : 100));
    W.wanted.heat = 0;
    refreshWantedLevel();
    W.wanted.bustT = 0;
    // dissoudre la meute de flics
    for (const p of W.peds) {
      if (p.kind === "cop") { p.state = "wander"; p.aggro = null; }
    }
    for (const v of W.vehicles) {
      if (v.type === "police" && v.ai) { v.ai = { mode: "cruise", cruise: 100, blockedT: 0, tgtX: null, tgtY: null }; G.Audio.setSiren(v.id, false); }
    }
    G.Camera.snapTo(pl.x, pl.y);
    W.state = "play";
  }

  /* =========================================================
     FOULE : trafic + piétons ambiants
     ========================================================= */

  const TRAFFIC_TARGET = 13, PED_TARGET = 24;
  const CIV_TYPES = ["sedan", "sedan", "taxi", "taxi", "van", "pickup", "sport"];

  function maintainCrowd(dt) {
    W._spawnT -= dt;
    if (W._spawnT > 0) return;
    W._spawnT = 0.35;

    const pl = W.player;
    const rng = W._rng;
    const viewR = G.Camera.viewRadius(W.viewW, W.viewH);
    const minD = Math.min(viewR + 120, 950), maxD = minD + 320;

    // --- despawn au loin ---
    for (let i = W.vehicles.length - 1; i >= 0; i--) {
      const v = W.vehicles[i];
      if (!v.ai && v.driverKind === null && !v.parkedSpawn && !v.wreck) { /* volée puis abandonnée : garder un peu */ }
      const d = U.dist(v.x, v.y, pl.x, pl.y);
      if (d > 1500 && v.driverKind !== "player" && !v.missionTag) {
        if (v.ai || v.wreck) {
          G.Audio.setSiren(v.id, false);
          W.vehicles.splice(i, 1);
        }
      }
    }
    for (let i = W.peds.length - 1; i >= 0; i--) {
      const p = W.peds[i];
      if (p.noDespawn) continue;
      if (U.dist(p.x, p.y, pl.x, pl.y) > 1400) W.peds.splice(i, 1);
    }

    // --- trafic ---
    let nCars = 0;
    for (const v of W.vehicles) if (v.ai && v.ai.mode === "cruise") nCars++;
    if (nCars < TRAFFIC_TARGET) {
      const lt = G.Map.randomLaneTile(rng, pl.x, pl.y, minD, maxD);
      if (lt) {
        const T = G.Map.T;
        const x = (lt.tx + 0.5) * T, y = (lt.ty + 0.5) * T;
        let free = true;
        for (const v of W.vehicles) if (U.dist2(v.x, v.y, x, y) < 70 * 70) { free = false; break; }
        if (free) {
          const isPolice = rng() < 0.06;
          const type = isPolice ? "police" : U.pick(rng, CIV_TYPES);
          const dir = { [G.Map.LN]: -Math.PI / 2, [G.Map.LS]: Math.PI / 2, [G.Map.LE]: 0, [G.Map.LW]: Math.PI }[lt.mask];
          const v = E().makeVehicle(type, x, y, dir);
          v.ai = { mode: "cruise", cruise: 85 + rng() * 50, blockedT: 0, tgtX: null, tgtY: null, dir: null, panicT: 0 };
          v.driverKind = isPolice ? "cop" : "civ";
          const sp = 60;
          v.vx = Math.cos(dir) * sp; v.vy = Math.sin(dir) * sp;
          W.vehicles.push(v);
        }
      }
    }

    // --- piétons ---
    let nPeds = 0;
    for (const p of W.peds) if (!p.noDespawn && p.kind === "civ") nPeds++;
    if (nPeds < PED_TARGET) {
      const spot = G.Map.randomSidewalk(rng, pl.x, pl.y, minD * 0.75, maxD);
      if (spot) {
        const p = E().makePed("civ", spot.x, spot.y, rng);
        W.peds.push(p);
      }
    }
  }

  /* =========================================================
     POLICE / SYSTÈME DE RECHERCHE
     ========================================================= */

  function updateWanted(dt) {
    const wd = W.wanted;
    const pl = W.player;

    if (wd.level <= 0) { wd.unseenT = 0; wd.evadeT = 0; wd.bustT = 0; return; }

    // le joueur est-il vu ?
    let seen = false;
    for (const p of W.peds) {
      if (p.dead || p.kind !== "cop") continue;
      if (U.dist2(p.x, p.y, pl.x, pl.y) < 460 * 460 && G.Map.lineOfSight(p.x, p.y, pl.x, pl.y)) { seen = true; break; }
    }
    if (!seen) {
      for (const v of W.vehicles) {
        if (v.type !== "police" || !v.ai || v.wreck) continue;
        if (U.dist2(v.x, v.y, pl.x, pl.y) < 460 * 460 && G.Map.lineOfSight(v.x, v.y, pl.x, pl.y)) { seen = true; break; }
      }
    }

    if (seen) { wd.unseenT = 0; wd.evadeT = 0; }
    else {
      wd.unseenT += dt;
      if (wd.unseenT > 3.5) {
        wd.evadeT += dt;
        if (wd.evadeT > 4.5) {
          wd.evadeT = 0;
          wd.heat = Math.max(0, wd.heat - 35);
          refreshWantedLevel();
          if (wd.level === 0) {
            W.toast("Tu as semé la police.");
            for (const v of W.vehicles) if (v.type === "police") G.Audio.setSiren(v.id, false);
            for (const p of W.peds) if (p.kind === "cop") { p.state = "wander"; p.aggro = null; }
          }
        }
      }
    }

    // maintenir les patrouilles en chasse
    let chase = 0;
    for (const v of W.vehicles) if (v.type === "police" && v.ai && v.ai.mode === "chase" && !v.wreck) chase++;
    const want = Math.min(wd.level, 4);

    // recruter les patrouilles en croisière
    if (chase < want) {
      for (const v of W.vehicles) {
        if (chase >= want) break;
        if (v.type === "police" && v.ai && v.ai.mode === "cruise" && !v.wreck) {
          v.ai = { mode: "chase", blockedT: 0 };
          v.siren = true;
          G.Audio.setSiren(v.id, true);
          chase++;
        }
      }
    }
    // en faire apparaître
    if (chase < want) {
      const rng = W._rng;
      const lt = G.Map.randomLaneTile(rng, pl.x, pl.y, 550, 900);
      if (lt) {
        const T = G.Map.T;
        const dir = { [G.Map.LN]: -Math.PI / 2, [G.Map.LS]: Math.PI / 2, [G.Map.LE]: 0, [G.Map.LW]: Math.PI }[lt.mask];
        const v = E().makeVehicle("police", (lt.tx + 0.5) * T, (lt.ty + 0.5) * T, dir);
        v.ai = { mode: "chase", blockedT: 0 };
        v.driverKind = "cop";
        v.siren = true;
        G.Audio.setSiren(v.id, true);
        W.vehicles.push(v);
      }
    }

    // volume des sirènes selon la distance
    for (const v of W.vehicles) {
      if (v.type === "police" && v.siren && !v.wreck) {
        G.Audio.sirenDistance(v.id, U.dist(v.x, v.y, pl.x, pl.y));
      }
    }

    // à 3+ étoiles : flics à pied supplémentaires
    if (wd.level >= 3) {
      let foot = 0;
      for (const p of W.peds) if (p.kind === "cop" && !p.dead) foot++;
      if (foot < wd.level) {
        const spot = G.Map.randomSidewalk(W._rng, pl.x, pl.y, 400, 700);
        if (spot) {
          const cop = E().makePed("cop", spot.x, spot.y);
          cop.state = "chase";
          cop.aggro = pl;
          cop.weapon = wd.level >= 2 ? "pistol" : "fist";
          W.peds.push(cop);
        }
      }
    }

    // arrestation : un flic au contact pendant que Jin traîne à pied
    if (!pl.vehicle && !pl.dead) {
      let close = false;
      for (const p of W.peds) {
        if (!p.dead && p.kind === "cop" && p.state === "chase" && U.dist2(p.x, p.y, pl.x, pl.y) < 26 * 26) { close = true; break; }
      }
      const slow = Math.abs(pl.vx) + Math.abs(pl.vy) < 60;
      if (close && slow) {
        wd.bustT += dt;
        if (wd.bustT > 0.9) { pl.busted = true; onBusted(); }
      } else {
        wd.bustT = Math.max(0, wd.bustT - dt * 2);
      }
    } else wd.bustT = 0;
  }

  /* =========================================================
     RENDU
     ========================================================= */

  function render(ctx, width, height) {
    W.viewW = width; W.viewH = height;
    const pl = W.player;

    // fond (eau du large)
    ctx.fillStyle = "#0d2b33";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    G.Camera.apply(ctx, width, height);

    const cam = G.Camera;
    const vr = cam.viewRadius(width, height);
    const vx0 = cam.x - vr, vy0 = cam.y - vr, vx1 = cam.x + vr, vy1 = cam.y + vr;

    // 1. sol
    G.Map.drawGround(ctx, vx0, vy0, vx1, vy1);

    // 2. décals & traces de pneus
    for (const d of W.decals) {
      const a = U.clamp(d.life / 8, 0, 0.8);
      if (d.type === "blood") {
        ctx.fillStyle = "rgba(120,20,30," + (a * 0.55) + ")";
        ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.7, d.a, 0, U.TAU); ctx.fill();
      } else {
        ctx.fillStyle = "rgba(15,12,14," + (a * 0.8) + ")";
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, U.TAU); ctx.fill();
      }
    }
    if (W.skids.length) {
      ctx.strokeStyle = "rgba(20,18,24,0.5)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (const s of W.skids) {
        if (s.x1 < vx0 || s.x1 > vx1 || s.y1 < vy0 || s.y1 > vy1) continue;
        ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1);
      }
      ctx.stroke();
    }

    // 3. marqueurs de mission au sol
    G.Missions.drawWorldMarkers(ctx, W);

    // 4. pickups
    for (const pk of W.pickups) {
      if (pk.x < vx0 || pk.x > vx1 || pk.y < vy0 || pk.y > vy1) continue;
      E().drawPickup(ctx, pk);
    }

    // 5. véhicules puis piétons
    for (const v of W.vehicles) {
      if (v.x < vx0 - 60 || v.x > vx1 + 60 || v.y < vy0 - 60 || v.y > vy1 + 60) continue;
      E().drawVehicle(ctx, v, W);
    }
    for (const p of W.peds) {
      if (p.x < vx0 - 30 || p.x > vx1 + 30 || p.y < vy0 - 30 || p.y > vy1 + 30) continue;
      E().drawPedEntity(ctx, p);
    }
    E().drawPlayer(ctx, pl);

    // réticule de visée auto
    if (pl.aimTarget && !pl.aimTarget.dead && !pl.vehicle) {
      const t = pl.aimTarget;
      ctx.strokeStyle = "#ff5340";
      ctx.lineWidth = 2;
      const r = 13 + Math.sin(W.time * 6) * 2;
      ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, U.TAU); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(t.x - r - 5, t.y); ctx.lineTo(t.x - r + 3, t.y);
      ctx.moveTo(t.x + r + 5, t.y); ctx.lineTo(t.x + r - 3, t.y);
      ctx.stroke();
    }

    // aide contextuelle : monter en voiture
    if (!pl.vehicle && !pl.dead && W.state === "play") {
      const v = W.nearestVehicle(pl.x, pl.y, 78);
      if (v && !v.wreck) {
        ctx.save();
        ctx.translate(v.x, v.y - 30);
        ctx.rotate(-G.Camera.rot); // toujours lisible
        ctx.fillStyle = "rgba(18,14,28,0.85)";
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = "#2ee6a8"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, U.TAU); ctx.stroke();
        ctx.fillStyle = "#2ee6a8";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("E", 0, 1);
        ctx.restore();
      }
    }

    // 6. balles
    for (const b of W.bullets) E().drawBullet(ctx, b);

    // 7. particules
    for (const p of W.particles) E().drawParticle(ctx, p);

    // 8. bâtiments & props hauts (occlusion 2.5D)
    G.Map.drawStructures(ctx, cam.x, cam.y, vx0, vy0, vx1, vy1);

    ctx.restore();

    // teinte « heure dorée » très légère
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "rgba(255,180,90,0.05)");
    grad.addColorStop(1, "rgba(150,60,160,0.06)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // HUD
    G.HUD.draw(ctx, W, width, height);
  }

  G.Game = W;
  W.init = init;
  W.update = update;
  W.render = render;

})(window.G);
