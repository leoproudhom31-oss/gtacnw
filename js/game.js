/* ============================================================
   JADE HARBOR — game.js
   Le « monde » : boucle de simulation, trafic, piétons,
   système de recherche (wanted), événements, rendu, save.
   ============================================================ */
"use strict";
(function (G) {

  const U = G.U, E = () => G.Ent;

  const SAVE_KEY = "jadeharbor_save_v1";

  // chaleur nécessaire par étoile de recherche. Sous une étoile, la
  // chaleur des petits délits redescend d'elle-même (voir updateWanted) :
  // un accrochage isolé n'attire donc plus la police.
  const STAR_HEAT = 40;
  const HEAT_DECAY = 16; // points de chaleur perdus par seconde au calme

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

    wanted: { level: 0, heat: 0, unseenT: 0, evadeT: 0, bustT: 0,
              lastSeenX: 0, lastSeenY: 0, lastSeenT: 99 },

    heli: null,          // hélicoptère de police (4★+)
    roadblock: null,     // barrage routier actif (3★+)
    _heliRespawnT: 0,
    _rbT: 0,

    _spawnT: 0,
    _districtT: 0,
    _stateT: 0,
    _rng: U.makeRng(Date.now() >>> 0)
  };

  // grilles spatiales, reconstruites à chaque pas de simulation
  const pedGrid = U.makeGrid(96);
  const vehGrid = U.makeGrid(128);

  W.eachPedNear = (x, y, r, cb) => pedGrid.near(x, y, r, cb);
  W.eachVehNear = (x, y, r, cb) => vehGrid.near(x, y, r, cb);

  // partenaire de discussion : un autre civil inactif tout proche
  W.findChatPartner = function (p) {
    let best = null;
    pedGrid.near(p.x, p.y, 60, (o) => {
      if (best || o === p || o.dead || o.kind !== "civ") return;
      if (o.state !== "wander" || o.activity || o.idleT <= 0) return;
      if (U.dist2(p.x, p.y, o.x, o.y) < 60 * 60) best = o;
    });
    return best;
  };

  /* =========================================================
     INITIALISATION
     ========================================================= */

  function init(fromSave) {
    const Mp = G.Map;
    W.peds = []; W.vehicles = []; W.bullets = [];
    W.particles = []; W.pickups = []; W.decals = []; W.skids = [];
    W.wanted = { level: 0, heat: 0, unseenT: 0, evadeT: 0, bustT: 0,
                 lastSeenX: 0, lastSeenY: 0, lastSeenT: 99 };
    W.heli = null; W.roadblock = null;
    W._heliRespawnT = 0; W._rbT = 0;
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
      const v = E().makeVehicle(s.type, s.x, s.y, s.angle, s.color);
      v.parked = true;
      W.vehicles.push(v);
    }

    // bateaux amarrés (volables) le long du canal, des jetées et de la plage
    for (const s of Mp.boatSpawns) {
      const v = E().makeVehicle(s.type, s.x, s.y, s.a, s.c);
      v.parked = true;
      W.vehicles.push(v);
    }

    // trafic nautique : pilotes PNJ sur leurs routes d'eau
    for (const r of Mp.boatRoutes) {
      const v = E().makeVehicle(r.type, r.wps[0].x, r.wps[0].y, 0, r.c);
      v.ai = { mode: "waterRoute", wps: r.wps, wpi: 1, dirStep: 1,
               loop: r.mode, cruise: r.cruise, blockedT: 0 };
      v.driverKind = "civ";
      v.noDespawnV = true;
      W.vehicles.push(v);
    }

    // baigneurs assis sur leurs serviettes, au Croissant de Sable
    for (let i = 0; i < Mp.beachSeats.length; i += 2) {
      const seat = Mp.beachSeats[i];
      const p = E().makePed("civ", seat.x, seat.y);
      p.state = "dummy";
      p.activity = "sit";
      p.angle = seat.a - Math.PI / 2;
      p.noDespawn = true;
      W.peds.push(p);
    }

    // pickups de la carte
    for (const p of Mp.pickupSpawns) {
      W.pickups.push(E().makePickup(p.kind, p.x, p.y, p.amount));
    }

    // PNJ fixes : Wu devant le salon de thé, Long au garage
    spawnStaticNpc("wu", Mp.POI.teahouse.x - 30, Mp.POI.teahouse.y - 6);
    spawnStaticNpc("mechanic", Mp.POI.garage.x + 34, Mp.POI.garage.y - 6);

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
    G.Missions.noteDamage(dmg);
    E().hurtPlayer(W.player, W, dmg);
  };

  // ---- bruit : réactions des passants et témoins ----
  W.noise = function (x, y, r, kind) {
    for (const p of W.peds) {
      if (p.dead || p.staticNpc) continue;
      if (p.kind === "civ" && U.dist2(p.x, p.y, x, y) < r * r) {
        if (p.state === "wander" || p.state === "flee") {
          p.threatX = x; p.threatY = y;
          if (p.pendingBench) { p.pendingBench.busy = false; p.pendingBench = null; }
          p.activity = null; p.chatWith = null; p.actT = 0;
          // tout près d'une fusillade : certains se jettent au sol
          if (kind === "shot" && p.state === "wander" &&
              U.dist2(p.x, p.y, x, y) < 170 * 170 && Math.random() < 0.35) {
            p.state = "cower";
            p.cowerT = 1.5 + Math.random() * 2;
          } else {
            p.state = "flee";
          }
        }
      }
    }
    // les voitures proches paniquent
    if (kind === "shot") {
      for (const v of W.vehicles) {
        if (v.ai && v.ai.mode === "cruise" && U.dist2(v.x, v.y, x, y) < r * r) v.ai.panicT = 5;
      }
      // un flic doit VOIR le tireur (ligne de vue) pour réagir — et un
      // seul coup n'inquiète plus la police : la chaleur s'accumule,
      // il faut une vraie fusillade pour décrocher une étoile.
      if (copSees(x, y, 500)) W.addHeat(18, true);
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

  // comme copNearby mais exige une ligne de vue dégagée
  function copSees(x, y, r) {
    const r2 = r * r;
    for (const p of W.peds) {
      if (!p.dead && p.kind === "cop" && U.dist2(p.x, p.y, x, y) < r2 &&
          G.Map.lineOfSight(p.x, p.y, x, y)) return true;
    }
    for (const v of W.vehicles) {
      if (v.type === "police" && v.ai && !v.wreck && U.dist2(v.x, v.y, x, y) < r2 &&
          G.Map.lineOfSight(v.x, v.y, x, y)) return true;
    }
    return false;
  }

  // un crime vient d'être commis : les civils qui l'ont vu deviennent
  // témoins. Renvoie le nombre de témoins trouvés (0 = personne n'a vu).
  W.crimeWitnessed = function (x, y) {
    let n = 0;
    for (const p of W.peds) {
      if (n >= 2) break;
      if (p.dead || p.kind !== "civ" || p.staticNpc || p.witness) continue;
      if (U.dist2(p.x, p.y, x, y) > 220 * 220) continue;
      if (!G.Map.lineOfSight(p.x, p.y, x, y)) continue;
      p.witness = true;
      p.phoneT = 4 + Math.random() * 3; // délai d'appel : on peut le rattraper
      p.state = "flee";
      p.threatX = x; p.threatY = y;
      p.activity = null; p.actT = 0;
      n++;
    }
    return n;
  };

  W.onWitnessReport = function (p) {
    // un témoin ajoute de la chaleur mais ne déclenche plus une étoile
    // instantanée : plusieurs signalements (ou un vrai crime) sont requis.
    W.addHeat(26, true);
    W.toast("Un témoin a alerté la police !");
  };

  W.addHeat = function (amount, forceSeen) {
    if (!forceSeen && !copNearby(W.player.x, W.player.y, 520)) amount *= 0.35;
    W.wanted.heat = U.clamp(W.wanted.heat + amount, 0, 5 * STAR_HEAT + 20);
    refreshWantedLevel();
  };

  W.setWanted = function (n) {
    W.wanted.heat = n * STAR_HEAT;
    refreshWantedLevel();
  };

  function refreshWantedLevel() {
    const prev = W.wanted.level;
    const lvl = Math.min(5, Math.floor(W.wanted.heat / STAR_HEAT));
    if (lvl > prev) {
      G.Audio.play("star");
      G.Camera.shake(0.1);
    }
    W.wanted.level = lvl;
    if (lvl === 0 && prev > 0) standDown();
  }

  // plus recherché : toutes les forces de police décrochent
  function standDown() {
    for (const v of W.vehicles) {
      if (v.type !== "police") continue;
      G.Audio.setSiren(v.id, false);
      v.siren = false;
      if (v.ai && v.ai.mode !== "cruise") {
        v.ai = { mode: "cruise", cruise: 100, blockedT: 0, tgtX: null, tgtY: null, dir: null, panicT: 0 };
      }
    }
    for (const p of W.peds) {
      if (p.kind === "cop" && !p.missionTag) { p.state = "wander"; p.aggro = null; }
    }
  }

  // ---- événements de gameplay ----
  W.onPedKilled = function (p, srcKind) {
    if (srcKind === "player" || srcKind === "playercar") {
      if (p.kind === "civ") {
        // vu par quelqu'un → crime grave (≈ 1 étoile) ; personne autour →
        // presque rien, on peut s'en tirer discrètement
        const seen = W.crimeWitnessed(p.x, p.y);
        if (seen > 0) W.addHeat(42, true);
        else W.addHeat(8, false);
      }
      else if (p.kind === "cop") W.addHeat(55, true);
      else W.addHeat(6, false); // un membre de gang : la police s'en moque presque
      // les gangsters lâchent des billets
      if ((p.kind === "shark" || p.kind === "lotus") && Math.random() < 0.6) {
        W.pickups.push(E().makePickup("cash", p.x + 8, p.y + 4, 10 + (Math.random() * 30 | 0)));
      }
    }
  };

  W.onPlayerShotPed = function (p) {
    if (p.kind === "civ") W.addHeat(14, false);
  };

  W.onPlayerAttack = function (p) {
    // une bousculade / un coup isolé n'est presque rien et se dissipe vite
    if (p.kind === "civ" || p.kind === "wu") W.addHeat(2, false);
    if (p.kind === "cop") W.addHeat(24, true);
  };

  W.onPlayerRanOver = function (p) {
    if (p.kind === "civ") {
      const seen = W.crimeWitnessed(p.x, p.y);
      W.addHeat(seen > 0 ? 22 : 8, seen > 0);
    }
    if (p.kind === "cop") W.addHeat(36, true);
  };

  W.onVehicleExploded = function (v) {
    if (v.type === "police" && W.wanted.level > 0 && v.lastDamager === "player") {
      // la signature Chinatown Wars : neutraliser une patrouille SOI-MÊME
      // fait retomber la pression — pas leurs accidents tout seuls
      W.wanted.heat = Math.max(0, W.wanted.heat - STAR_HEAT);
      refreshWantedLevel();
      if (W.wanted.level === 0) W.wanted.unseenT = 99;
      W.toast("Patrouille neutralisée : la pression retombe !");
      G.Audio.setSiren(v.id, false);
    } else if (v.type === "police") {
      G.Audio.setSiren(v.id, false);
    } else if (v.lastDamager === "player") {
      W.addHeat(12, false);
      W.crimeWitnessed(v.x, v.y);
    }
  };

  W.onEnterVehicle = function (v) {
    if (v.def && v.def.name) W.toast(v.def.name, 1.6);
    if (v.def && v.def.water && !W._boatTuto) {
      W._boatTuto = true;
      G.HUD.tutorial("Navigation : haut/bas = gaz/frein moteur, gauche/droite = barre. Pas de frein à main sur l'eau !", 6);
    } else if (!W._driveTuto) {
      W._driveTuto = true;
      G.HUD.tutorial("Conduite : haut/bas = accélérer/freiner, gauche/droite = tourner, ESPACE = frein à main, E = descendre.", 6);
    }
  };

  W.onWasted = function () {
    if (W.state !== "play") return;
    // en mission avec point de contrôle : reprise directe, pas d'hôpital
    if (G.Missions.tryCheckpointRestart(W, "Jin est tombé — la mission reprend.")) {
      G.Audio.play("wasted");
      return;
    }
    W.state = "dead";
    W._stateT = 3.2;
    G.Audio.play("wasted");
    G.Audio.stopEngine();
    G.HUD.showBanner("TU ES TOMBÉ", "#ff5340", "L'hôpital de Jade Harbor te rafistole… (-150 $)", 3.2);
    G.Missions.onPlayerDown(W, "Jin est tombé au combat.");
  };

  function onBusted() {
    if (W.state !== "play") return;
    if (G.Missions.tryCheckpointRestart(W, "Jin a filé entre les doigts de la police — la mission reprend.")) {
      return;
    }
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

  // retire les véhicules de mission (van filé, cibles, vagues d'assaut) —
  // la cargaison de la m2 et le véhicule du joueur restent en place
  W.clearMissionVehicles = function () {
    for (let i = W.vehicles.length - 1; i >= 0; i--) {
      const v = W.vehicles[i];
      if (v.missionTag && v.missionTag !== "cargo" && v.driverKind !== "player") {
        G.Audio.setSiren(v.id, false);
        W.vehicles.splice(i, 1);
      }
    }
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

    // grilles spatiales de la frame
    pedGrid.clear();
    for (const p of W.peds) if (!p.dead) pedGrid.insert(p);
    vehGrid.clear();
    for (const v of W.vehicles) vehGrid.insert(v);

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
    updateHeli(dt);
    updateRoadblock(dt);
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
    pl.swimming = false;
    pl.money = Math.max(0, pl.money - (where === "hospital" ? 150 : 100));
    W.wanted.heat = 0;
    refreshWantedLevel();
    W.wanted.bustT = 0;
    W.wanted.lastSeenT = 99;
    if (W.heli) W.heli.leaving = true;
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
  const CIV_TYPES = ["sedan", "sedan", "taxi", "taxi", "van", "pickup", "sport", "bike", "bike"];
  // allure de croisière par type : le trafic roule à des vitesses crédibles
  const CRUISE_BY_TYPE = { sedan: 92, taxi: 106, van: 74, pickup: 84, sport: 128, bike: 112, police: 96 };

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
      const d = U.dist(v.x, v.y, pl.x, pl.y);
      if (d > 1500 && v.driverKind !== "player" && !v.missionTag && !v.noDespawnV) {
        // trafic, épaves et voitures volées puis abandonnées ; les
        // voitures garées d'origine restent en place
        if (v.ai || v.wreck || (!v.parked && v.driverKind === null)) {
          G.Audio.setSiren(v.id, false);
          W.vehicles.splice(i, 1);
        }
      }
    }
    for (let i = W.peds.length - 1; i >= 0; i--) {
      const p = W.peds[i];
      if (p.noDespawn) continue;
      if (U.dist(p.x, p.y, pl.x, pl.y) > 1400) {
        if (p.pendingBench) p.pendingBench.busy = false;
        W.peds.splice(i, 1);
      }
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
          v.ai = { mode: "cruise", cruise: (CRUISE_BY_TYPE[type] || 90) * (0.9 + rng() * 0.25),
                   blockedT: 0, tgtX: null, tgtY: null, dir: null, panicT: 0 };
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

    // --- gangs territoriaux ---
    const district = G.Map.districtAt(pl.x, pl.y);
    if (district && (district.key === "docks" || district.key === "lotus")) {
      const kind = district.key === "docks" ? "shark" : "lotus";
      const cap = kind === "shark" ? 3 : 2;
      let n = 0;
      for (const p of W.peds) if (p.kind === kind && !p.missionTag && !p.staticNpc && !p.dead) n++;
      if (n < cap) {
        const spot = G.Map.randomSidewalk(rng, pl.x, pl.y, minD * 0.6, maxD);
        if (spot && G.Map.districtAt(spot.x, spot.y) &&
            G.Map.districtAt(spot.x, spot.y).key === district.key) {
          const p = E().makePed(kind, spot.x, spot.y, rng);
          if (rng() < 0.3) p.weapon = "bat";
          W.peds.push(p);
        }
      }
      // les Requins n'oublient pas : après la mission 3, Jin est un ennemi
      if (kind === "shark" && (G.Missions.state.completed.m3 || W.gangHeatT > 0)) {
        for (const p of W.peds) {
          if (p.kind === "shark" && p.state === "wander" && !p.staticNpc &&
              U.dist2(p.x, p.y, pl.x, pl.y) < 240 * 240 &&
              G.Map.lineOfSight(p.x, p.y, pl.x, pl.y)) {
            p.state = "chase";
            p.aggro = pl;
          }
        }
      }
    }
    W.gangHeatT = Math.max(0, (W.gangHeatT || 0) - 0.35);
  }

  // représailles : blesser un Requin ameute ses frères d'armes
  W.alertGang = function (kind, x, y) {
    if (kind !== "shark" && kind !== "lotus") return;
    W.gangHeatT = 30;
    pedGrid.near(x, y, 420, (p) => {
      if (p.kind === kind && !p.dead && !p.staticNpc &&
          (p.state === "wander" || p.state === "flee")) {
        p.state = "chase";
        p.aggro = W.player;
      }
    });
  };

  /* =========================================================
     POLICE / SYSTÈME DE RECHERCHE
     ========================================================= */

  function updateWanted(dt) {
    const wd = W.wanted;
    const pl = W.player;
    wd.lastSeenT += dt;

    if (wd.level <= 0) {
      wd.unseenT = 0; wd.evadeT = 0; wd.bustT = 0;
      // décroissance des délits mineurs : la chaleur sous une étoile
      // ne s'accumule plus indéfiniment, elle retombe au calme.
      if (wd.heat > 0) wd.heat = Math.max(0, wd.heat - HEAT_DECAY * dt);
      return;
    }

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
    // l'œil du ciel : impossible de se cacher tant que l'hélico est là
    if (!seen && W.heli && !W.heli.dead && U.dist2(W.heli.x, W.heli.y, pl.x, pl.y) < 650 * 650) {
      seen = true;
    }

    if (seen) {
      wd.unseenT = 0; wd.evadeT = 0;
      wd.lastSeenX = pl.x; wd.lastSeenY = pl.y; wd.lastSeenT = 0;
    }
    else {
      wd.unseenT += dt;
      if (wd.unseenT > 3.2) {
        wd.evadeT += dt;
        if (wd.evadeT > 4) {
          wd.evadeT = 0;
          wd.heat = Math.max(0, wd.heat - STAR_HEAT);
          refreshWantedLevel();
          if (wd.level === 0) W.toast("Tu as semé la police."); // standDown() a déjà tout rangé
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
     HÉLICOPTÈRE DE POLICE (4★ et plus)
     ========================================================= */

  function updateHeli(dt) {
    const pl = W.player;

    if (!W.heli) {
      W._heliRespawnT = Math.max(0, W._heliRespawnT - dt);
      if (W.wanted.level >= 4 && W._heliRespawnT <= 0) {
        // arrive du large
        const a = W._rng() * U.TAU;
        W.heli = {
          x: pl.x + Math.cos(a) * 1400, y: pl.y + Math.sin(a) * 1400,
          vx: 0, vy: 0, angle: 0, rotor: 0,
          hp: 120, dead: false, leaving: false, orbitA: 0
        };
        G.Audio.setHeli(true);
        W.toast("Un hélicoptère de la police est en approche !");
      }
      return;
    }

    const h = W.heli;
    h.rotor += dt * 28;

    if (W.wanted.level < 4) h.leaving = true;
    else if (h.leaving) h.leaving = false; // le suspect a regagné 4★ : demi-tour

    let tx, ty, maxSpd;
    if (h.leaving) {
      // repart vers le large
      tx = h.x + (h.x - pl.x) * 2 + 100;
      ty = h.y + (h.y - pl.y) * 2;
      maxSpd = 380;
      if (U.dist(h.x, h.y, pl.x, pl.y) > 1800) {
        W.heli = null;
        G.Audio.setHeli(false);
        return;
      }
    } else {
      // orbite autour du fuyard
      h.orbitA += dt * 0.55;
      tx = pl.x + Math.cos(h.orbitA) * 150;
      ty = pl.y + Math.sin(h.orbitA) * 150;
      maxSpd = 330;
    }

    const dx = tx - h.x, dy = ty - h.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const spd = Math.min(maxSpd, d * 2.2);
    h.vx = U.damp(h.vx, dx / d * spd, 2.2, dt);
    h.vy = U.damp(h.vy, dy / d * spd, 2.2, dt);
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    if (Math.abs(h.vx) + Math.abs(h.vy) > 40) {
      h.angle = U.angleDamp(h.angle, Math.atan2(h.vy, h.vx), 3, dt);
    }
    G.Audio.heliDistance(U.dist(h.x, h.y, pl.x, pl.y));
  }

  W.onHeliHit = function (dmg) {
    const h = W.heli;
    if (!h || h.dead) return;
    h.hp -= dmg;
    if (h.hp <= 0) {
      // il s'écrase dans un fracas doré
      G.Audio.play("explosion");
      G.Camera.shake(0.7);
      W.addDecal("scorch", h.x, h.y);
      for (let i = 0; i < 30; i++) W.addParticle("fire", h.x + (W._rng() - 0.5) * 60, h.y + (W._rng() - 0.5) * 40, 1);
      for (let i = 0; i < 18; i++) W.addParticle("debris", h.x, h.y, 1);
      W.addParticle("ring", h.x, h.y, 1);
      for (const p of W.peds) {
        if (U.dist(h.x, h.y, p.x, p.y) < 90) E().pedTakeDamage(p, W, 70, "explosion", h.x, h.y);
      }
      W.heli = null;
      W._heliRespawnT = 26;
      G.Audio.setHeli(false);
      W.addHeat(30, true);
      W.giveMoney(250);
      W.toast("Hélicoptère abattu ! Prime de chaos : +250 $");
    }
  };

  /* =========================================================
     BARRAGES ROUTIERS (3★ et plus)
     ========================================================= */

  function updateRoadblock(dt) {
    const pl = W.player;
    const rb = W.roadblock;

    // levée du barrage : dépassé, détruit ou plus recherché
    if (rb) {
      const done = W.wanted.level < 3 ||
        rb.cars.every(c => c.wreck) ||
        U.dist(pl.x, pl.y, rb.x, rb.y) > 1300;
      if (done) {
        for (const c of rb.cars) {
          if (c.wreck || !c.ai || c.ai.mode !== "roadblock") continue;
          if (W.wanted.level >= 1) {
            c.ai = { mode: "chase", blockedT: 0 };
            c.siren = true;
            G.Audio.setSiren(c.id, true);
          } else {
            c.ai = { mode: "cruise", cruise: 100, blockedT: 0, tgtX: null, tgtY: null, dir: null, panicT: 0 };
            c.siren = false;
            G.Audio.setSiren(c.id, false);
          }
        }
        W.roadblock = null;
      }
      return;
    }

    if (W.wanted.level < 3) { W._rbT = 4; return; }
    W._rbT -= dt;
    if (W._rbT > 0) return;
    W._rbT = 2.0; // re-tenter bientôt ; le vrai cooldown ne part qu'après un barrage posé

    // seulement si le fuyard roule vite : on lui coupe la route
    const v = pl.vehicle;
    if (!v) return;
    const sp = Math.hypot(v.vx, v.vy);
    if (sp < 90) return;

    // point ~600 px devant, aligné sur une route
    const px = pl.x + (v.vx / sp) * 620, py = pl.y + (v.vy / sp) * 620;
    const rt = G.Map.nearestRoadTile(px, py, 6);
    if (rt < 0) return;
    const T = G.Map.T, MW = G.Map.MW;
    const bx = (rt % MW + 0.5) * T, by = ((rt / MW | 0) + 0.5) * T;
    const mask = G.Map.laneMaskAt(rt % MW, (rt / MW) | 0);
    if (G.Map.isBridge(rt % MW, (rt / MW) | 0)) return;
    // orientation : voitures en travers, réparties sur la LARGEUR de la chaussée
    const vertical = (mask & (G.Map.LN | G.Map.LS)) !== 0; // la route file nord-sud
    const across = vertical ? 0 : Math.PI / 2;             // donc on se met est-ouest
    const cars = [];
    for (const off of [-25, 25]) {
      const c = E().makeVehicle("police", bx + (vertical ? off : 0), by + (vertical ? 0 : off), across, null);
      c.ai = { mode: "roadblock", blockedT: 0 };
      c.driverKind = "cop";
      c.siren = true;
      G.Audio.setSiren(c.id, true);
      W.vehicles.push(c);
      cars.push(c);
      // un agent posté à côté de chaque voiture
      const cop = E().makePed("cop", c.x + (vertical ? 0 : -36), c.y + (vertical ? -36 : 0));
      cop.state = "chase";
      cop.aggro = pl;
      cop.weapon = "pistol";
      W.peds.push(cop);
    }
    W.roadblock = { x: bx, y: by, cars };
    W._rbT = 14;
    W.toast("Barrage de police droit devant !");
  }

  /* =========================================================
     RENDU
     ========================================================= */

  // point dans un quadrilatère (via deux triangles, ordre quelconque)
  function _sign(ax, ay, bx, by, cx, cy) {
    return (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
  }
  function _inTri(px, py, ax, ay, bx, by, cx, cy) {
    const d1 = _sign(px, py, ax, ay, bx, by);
    const d2 = _sign(px, py, bx, by, cx, cy);
    const d3 = _sign(px, py, cx, cy, ax, ay);
    const neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    return !(neg && pos);
  }
  function _inQuad(px, py, q) {
    return _inTri(px, py, q[0][0], q[0][1], q[1][0], q[1][1], q[2][0], q[2][1]) ||
           _inTri(px, py, q[0][0], q[0][1], q[2][0], q[2][1], q[3][0], q[3][1]);
  }

  const _elv = { x: 0, y: 0 };
  // (ex,ey) est-il masqué par la silhouette extrudée du bâtiment b ?
  function pointUnderBuilding(ex, ey, b, camX, camY) {
    const cor = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
    const top = [];
    for (let i = 0; i < 4; i++) {
      G.Sprites.elevate(cor[i][0], cor[i][1], b.height, camX, camY, _elv);
      top.push([_elv.x, _elv.y]);
    }
    if (_inQuad(ex, ey, cor)) return true;      // empreinte au sol
    if (_inQuad(ex, ey, top)) return true;      // toit
    for (let i = 0; i < 4; i++) {               // murs (base → toit)
      const j = (i + 1) % 4;
      if (_inQuad(ex, ey, [cor[i], cor[j], top[j], top[i]])) return true;
    }
    return false;
  }

  function drawPlayerGhostIfHidden(ctx, cam) {
    const pl = W.player;
    if (pl.dead || W.state !== "play") return;
    // le joueur ne peut être masqué que lorsque la caméra vise ailleurs que
    // sur lui : au volant (regard porté devant) ou projeté en l'air. À pied et
    // au sol il est au centre, là où l'extrusion radiale ne recouvre rien.
    if (!pl.vehicle && (pl.z || 0) <= 0 && (pl.tumbleT || 0) <= 0) return;
    const ent = pl.vehicle || pl;
    const ex = ent.x, ey = ent.y;
    const camDist = U.dist(cam.x, cam.y, ex, ey);
    let hidden = false;
    for (const b of G.Map.buildings) {
      if (b.height < 30) continue;
      if (Math.abs(b.cx - ex) > 300 || Math.abs(b.cy - ey) > 300) continue;
      // seul un bâtiment PLUS PROCHE de la caméra peut masquer l'entité
      if (U.dist(cam.x, cam.y, b.cx, b.cy) >= camDist + 24) continue;
      if (pointUnderBuilding(ex, ey, b, cam.x, cam.y)) { hidden = true; break; }
    }
    if (!hidden) return;
    // silhouette translucide + halo pour ne jamais perdre le joueur
    ctx.save();
    ctx.globalAlpha = 0.45;
    if (pl.vehicle) E().drawVehicle(ctx, pl.vehicle, W);
    else E().drawPlayer(ctx, pl);
    ctx.restore();
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(-cam.rot);
    ctx.strokeStyle = "rgba(46,230,168,0.85)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, U.TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

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

    // 1. sol + reflets d'eau animés
    G.Map.drawGround(ctx, vx0, vy0, vx1, vy1);
    G.Map.drawWaterOverlay(ctx, vx0, vy0, vx1, vy1, W.time);

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

    // aide contextuelle : échelle de quai à portée quand on nage
    if (pl.swimming && !pl.dead && W.state === "play") {
      let lad = null, ld = 110;
      for (const l of G.Map.ladders) {
        const d = U.dist(pl.x, pl.y, l.waterX, l.waterY);
        if (d < ld) { lad = l; ld = d; }
      }
      if (lad) {
        ctx.save();
        ctx.translate(lad.x, lad.y);
        ctx.rotate(-G.Camera.rot);
        ctx.fillStyle = "rgba(18,14,28,0.85)";
        ctx.beginPath(); ctx.arc(0, -16, 10, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = "#7ad7ff"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, -16, 10, 0, U.TAU); ctx.stroke();
        ctx.fillStyle = "#7ad7ff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("E", 0, -15);
        ctx.restore();
      }
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

    // ombre de l'hélicoptère au sol (sous les bâtiments)
    if (W.heli && !W.heli.dead) {
      ctx.fillStyle = "rgba(10,8,20,0.22)";
      ctx.beginPath();
      ctx.ellipse(W.heli.x + 16, W.heli.y + 22, 26, 17, 0, 0, U.TAU);
      ctx.fill();
    }

    // 8. bâtiments & props hauts (occlusion 2.5D)
    G.Map.drawStructures(ctx, cam.x, cam.y, vx0, vy0, vx1, vy1);

    // 8b. le joueur (et son véhicule) ne doivent JAMAIS être perdus derrière
    //     un bâtiment : s'il est masqué, on le redessine en silhouette.
    drawPlayerGhostIfHidden(ctx, cam);

    // 9. hélicoptère (au-dessus de tout, avec parallaxe d'altitude)
    if (W.heli && !W.heli.dead) {
      const h = W.heli;
      const e = { x: 0, y: 0 };
      G.Sprites.elevate(h.x, h.y, 170, cam.x, cam.y, e);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(1.15, 1.15);
      G.Sprites.drawHelicopter(ctx, 0, 0, h.angle, h.rotor);
      ctx.restore();
    }

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
