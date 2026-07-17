/* ============================================================
   JADE HARBOR — entities.js
   Joueur, piétons (civils, gangs, flics), véhicules (physique
   arcade + IA trafic), balles, pickups, particules.
   Toutes les entités reçoivent `w` = l'objet Game (monde).
   ============================================================ */
"use strict";
(function (G) {

  const U = G.U, S = G.Sprites, M = () => G.Map;

  /* =========================================================
     ARMES
     ========================================================= */

  const WEAPONS = {
    fist:    { name: "Poings",        melee: true,  dmg: 12, rate: 0.38, range: 30 },
    bat:     { name: "Batte",         melee: true,  dmg: 26, rate: 0.50, range: 38 },
    pistol:  { name: "Pistolet 9 mm", dmg: 16, rate: 0.30, spread: 0.05, auto: false, clip: 30 },
    smg:     { name: "PM « Guêpe »",  dmg: 10, rate: 0.09, spread: 0.13, auto: true,  clip: 60 },
    shotgun: { name: "Fusil à pompe", dmg: 9,  rate: 0.85, spread: 0.30, auto: false, pellets: 6, clip: 16 }
  };
  const WEAPON_ORDER = ["fist", "bat", "pistol", "smg", "shotgun"];

  /* =========================================================
     PIÉTON
     ========================================================= */

  let PED_ID = 1;

  function makePed(kind, x, y, rng) {
    const r = rng || Math.random;
    return {
      id: PED_ID++,
      etype: "ped",
      kind,                         // civ | cop | shark | lotus | wu
      look: S.pedLook(kind, r),
      x, y, vx: 0, vy: 0,
      angle: r() * U.TAU,
      radius: 7,
      scale: kind === "civ" ? 0.92 + r() * 0.16 : 1,
      hp: kind === "cop" ? 60 : (kind === "shark" || kind === "lotus") ? 55 : 35,
      dead: false,
      corpseT: 0,
      state: "wander",              // wander | flee | cower | chase | search | knocked | dummy
      walkPhase: 0,
      idleT: 0.5 + r() * 2,
      tgtX: x, tgtY: y,
      threatX: 0, threatY: 0,
      weapon: kind === "cop" ? "pistol" : "fist",
      attackT: 0, shootT: 0,
      knockT: 0, cowerT: 0,
      aggro: null,                  // entité ciblée (le joueur en général)
      stuckT: 0,
      // vie de quartier
      activity: null,               // sit | phone | chat
      actT: 0,
      chatWith: null,
      pendingBench: null,
      // témoin d'un crime
      witness: false, phoneT: 0,
      // combat
      flankSide: r() < 0.5 ? -1 : 1,
      strafeDir: 1, strafeT: 0,
      burstLeft: 0,
      // navigation
      path: null, pathT: 0,
      // police
      searchX: 0, searchY: 0, searchT: 0,
      noDespawn: false,
      missionTag: null
    };
  }

  function pedTakeDamage(p, w, dmg, srcKind, kx, ky) {
    if (p.dead) return;
    p.hp -= dmg;
    w.addParticle("blood", p.x, p.y, 4);
    // interrompre toute activité en cours (banc, téléphone, discussion)
    if (p.pendingBench) { p.pendingBench.busy = false; p.pendingBench = null; }
    p.activity = null; p.actT = 0; p.chatWith = null;
    if (p.hp <= 0) {
      p.dead = true;
      p.corpseT = 18;
      w.addDecal("blood", p.x, p.y);
      w.onPedKilled(p, srcKind);
      return;
    }
    // réaction
    if (p.kind === "civ" || p.kind === "wu") {
      p.state = "flee";
      p.threatX = kx != null ? kx : w.player.x;
      p.threatY = ky != null ? ky : w.player.y;
    } else if (srcKind === "player" || srcKind === "playercar") {
      p.state = "chase";
      p.aggro = w.player;
      // le gang tout entier prend fait et cause
      if (w.alertGang && (p.kind === "shark" || p.kind === "lotus") && !p.missionTag) {
        w.alertGang(p.kind, p.x, p.y);
      }
    }
  }

  function pedKnock(p, w, vx, vy, dmg) {
    pedTakeDamage(p, w, dmg, "playercar", p.x - vx, p.y - vy);
    if (!p.dead) {
      p.state = "knocked";
      p.knockT = 1.6;
      p.vx = vx; p.vy = vy;
    }
  }

  function updatePed(p, w, dt) {
    if (p.dead) {
      p.corpseT -= dt;
      return p.corpseT > 0;
    }

    p.attackT = Math.max(0, p.attackT - dt);
    p.shootT = Math.max(0, p.shootT - dt);
    p.pathT = Math.max(0, p.pathT - dt);

    switch (p.state) {
      case "dummy": return true;
      case "knocked": {
        p.knockT -= dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= Math.exp(-4 * dt); p.vy *= Math.exp(-4 * dt);
        M().collideCircle(p, p.radius);
        if (p.knockT <= 0) {
          const player = w.player;
          p.state = (p.kind === "civ" || p.kind === "wu") ? "flee" : "chase";
          if (p.state === "chase") p.aggro = player;
          p.threatX = player.x; p.threatY = player.y;
        }
        return true;
      }
      case "cower": {
        p.cowerT -= dt;
        p.walkPhase = 0; p.vx = 0; p.vy = 0;
        if (p.cowerT <= 0) p.state = "flee";
        return true;
      }
      case "wander": wanderUpdate(p, w, dt); break;
      case "flee":   fleeUpdate(p, w, dt); break;
      case "search": searchUpdate(p, w, dt); break;
      case "chase":  chaseUpdate(p, w, dt); break;
    }
    return true;
  }

  /* ---------- vie de quartier ---------- */

  function wanderUpdate(p, w, dt) {
    // activité en cours (banc, téléphone, discussion)
    if (p.actT > 0) {
      p.actT -= dt;
      p.walkPhase = 0; p.vx = 0; p.vy = 0;
      if (p.activity === "chat" && p.chatWith && !p.chatWith.dead) {
        p.angle = Math.atan2(p.chatWith.y - p.y, p.chatWith.x - p.x);
      }
      if (p.actT <= 0) {
        if (p.pendingBench) { p.pendingBench.busy = false; p.pendingBench = null; }
        p.activity = null; p.chatWith = null;
        p.idleT = 0.4;
      }
      return;
    }

    if (p.idleT > 0) {
      p.idleT -= dt;
      p.walkPhase = 0; p.vx = 0; p.vy = 0;
      return;
    }

    const d = U.dist(p.x, p.y, p.tgtX, p.tgtY);
    if (d < 14) {
      // arrivé : choisir la suite
      if (p.pendingBench) {
        // s'asseoir
        p.x = p.pendingBench.x; p.y = p.pendingBench.y - 6;
        p.angle = p.pendingBench.a + Math.PI / 2;
        p.activity = "sit";
        p.actT = 6 + Math.random() * 9;
        return;
      }
      const roll = Math.random();
      if (roll < 0.10 && p.kind === "civ") {
        p.activity = "phone";
        p.actT = 4 + Math.random() * 5;
        return;
      }
      if (roll < 0.18 && p.kind === "civ" && w.findChatPartner) {
        const other = w.findChatPartner(p);
        if (other) {
          p.activity = "chat"; p.chatWith = other;
          other.activity = "chat"; other.chatWith = p;
          p.actT = other.actT = 4 + Math.random() * 5;
          other.idleT = 0;
          return;
        }
      }
      if (roll < 0.28 && p.kind === "civ") {
        // un banc libre à proximité ?
        const bench = nearestFreeBench(p, 200);
        if (bench) {
          bench.busy = true;
          p.pendingBench = bench;
          p.tgtX = bench.x; p.tgtY = bench.y - 6;
          return;
        }
      }
      p.idleT = 0.5 + Math.random() * 3;
      pickWanderTarget(p);
      return;
    }

    // en chemin : presser le pas sur la chaussée
    const onRoad = M().get(Math.floor(p.x / 48), Math.floor(p.y / 48)) === M().ROAD;
    moveToward(p, w, p.tgtX, p.tgtY, onRoad ? 92 : 52, dt);
  }

  function nearestFreeBench(p, range) {
    let best = null, bd = range;
    for (const b of M().benches) {
      if (b.busy) continue;
      const d = U.dist(p.x, p.y, b.x, b.y);
      if (d < bd) { best = b; bd = d; }
    }
    return best;
  }

  function pickWanderTarget(p) {
    // éviter de traverser inutilement les routes : 3 essais
    for (let tries = 0; tries < 3; tries++) {
      const spot = M().randomSidewalk(Math.random, p.x, p.y, 60, 260);
      if (!spot) continue;
      if (tries < 2 && roadCrossingLength(p.x, p.y, spot.x, spot.y) > 3) continue;
      p.tgtX = spot.x; p.tgtY = spot.y;
      return;
    }
  }

  function roadCrossingLength(x0, y0, x1, y1) {
    const Mp = M();
    const d = U.dist(x0, y0, x1, y1);
    const steps = Math.max(2, Math.ceil(d / 30));
    let n = 0;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (Mp.get(Math.floor((x0 + (x1 - x0) * t) / 48), Math.floor((y0 + (y1 - y0) * t) / 48)) === Mp.ROAD) n++;
    }
    return n;
  }

  function fleeUpdate(p, w, dt) {
    const dx = p.x - p.threatX, dy = p.y - p.threatY;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;

    // témoin : une fois à distance, s'arrête et appelle la police
    if (p.witness) {
      if (d > 300) {
        p.walkPhase = 0; p.vx = 0; p.vy = 0;
        p.activity = "phone";
        p.phoneT -= dt;
        if (p.phoneT <= 0) {
          p.witness = false; p.activity = null;
          w.onWitnessReport(p);
          p.state = "wander"; p.idleT = 2;
        }
        return;
      }
      p.activity = null;
    }

    if (d > 560 && !p.witness) { p.state = "wander"; p.idleT = 1; p.activity = null; return; }
    moveToward(p, w, p.x + (dx / d) * 100, p.y + (dy / d) * 100, 150, dt);
  }

  /* ---------- police : ratissage de la dernière position connue ---------- */

  function searchUpdate(p, w, dt) {
    if (w.wanted.level <= 0 && !p.missionTag) { p.state = "wander"; return; }
    const pl = w.player;
    // le suspect repasse en visuel ?
    if (U.dist(p.x, p.y, pl.x, pl.y) < 460 && M().lineOfSight(p.x, p.y, pl.x, pl.y)) {
      p.state = "chase"; p.aggro = pl;
      return;
    }
    p.searchT -= dt;
    if (p.searchT <= 0) { p.state = "wander"; p.idleT = 1; return; }
    p.searchElapsed = (p.searchElapsed || 0) + dt;

    const d = U.dist(p.x, p.y, p.tgtX, p.tgtY);
    if (d < 22) {
      // ratissage en spirale : cet agent balaie son propre secteur autour
      // du dernier point vu, avec un rayon qui grandit avec le temps —
      // bien plus méthodique qu'un simple point aléatoire répété.
      const radius = Math.min(300, 55 + p.searchElapsed * 24);
      const a = p.searchAngle + (Math.random() - 0.5) * 1.1;
      const tx = p.searchX + Math.cos(a) * radius, ty = p.searchY + Math.sin(a) * radius;
      if (M().isWalkable(tx, ty)) { p.tgtX = tx; p.tgtY = ty; }
      else p.searchAngle += 0.9; // secteur bloqué par un mur : pivoter
    }
    followPath(p, w, p.tgtX, p.tgtY, 122, dt);
  }

  /* ---------- combat ---------- */

  function chaseUpdate(p, w, dt) {
    const t = p.aggro;
    if (!t || t.hp <= 0 || t.busted || t.wreck) { p.state = "wander"; return; }
    const targetIsVehicle = t.etype === "vehicle";
    const wp = WEAPONS[p.weapon];

    // les flics abandonnent si plus recherché
    if (p.kind === "cop" && w.wanted.level <= 0 && !p.missionTag) { p.state = "wander"; return; }

    // cible réelle ou dernière position connue (police)
    let tx = t.x, ty = t.y;
    const d = U.dist(p.x, p.y, t.x, t.y);
    const hasLOS = d < 520 && M().lineOfSight(p.x, p.y, t.x, t.y);
    if (p.kind === "cop" && !p.missionTag && !hasLOS && w.wanted.lastSeenT < 12) {
      tx = w.wanted.lastSeenX; ty = w.wanted.lastSeenY;
      if (U.dist(p.x, p.y, tx, ty) < 44) {
        // arrivé sur la dernière position : ratisser le secteur. Chaque
        // agent couvre son propre angle (nombre d'or → bonne répartition
        // même avec peu d'unités) et le rayon grandit avec le temps.
        p.state = "search";
        p.searchX = tx; p.searchY = ty;
        p.searchT = 15;
        p.searchElapsed = 0;
        p.searchAngle = (p.id * 2.399963601) % U.TAU;
        p.tgtX = tx; p.tgtY = ty;
        p.path = null; p.pathT = 0;
        return;
      }
    } else if (d > 900) { p.state = "wander"; return; }

    if (wp.melee) {
      if (d > wp.range + 6) {
        // approche avec léger débordement pour encercler
        let ax = tx, ay = ty;
        if (d > 70 && hasLOS) {
          const perp = Math.atan2(ty - p.y, tx - p.x) + Math.PI / 2;
          const off = Math.min(46, d * 0.3) * p.flankSide;
          ax += Math.cos(perp) * off; ay += Math.sin(perp) * off;
        }
        if (hasLOS) moveToward(p, w, ax, ay, 150, dt);
        else followPath(p, w, tx, ty, 150, dt);
      } else {
        p.walkPhase = 0; p.vx = 0; p.vy = 0;
        p.angle = Math.atan2(t.y - p.y, t.x - p.x);
        if (p.attackT <= 0) {
          p.attackT = wp.rate + 0.25;
          if (U.dist(p.x, p.y, t.x, t.y) < wp.range + (targetIsVehicle ? 26 : 8)) {
            if (targetIsVehicle) damageVehicle(t, w, wp.dmg * 0.8, p);
            else w.hurtPlayer(wp.dmg * (p.kind === "cop" ? 0.6 : 1), p);
            G.Audio.play("punchHit");
          }
        }
      }
    } else {
      // tireur : distance de sécurité + strafe + tir en rafales
      if (!hasLOS || d > 300) {
        followPath(p, w, tx, ty, 140, dt);
      } else if (d < 110) {
        const a = Math.atan2(p.y - t.y, p.x - t.x);
        moveToward(p, w, p.x + Math.cos(a) * 60, p.y + Math.sin(a) * 60, 110, dt);
        p.angle = Math.atan2(t.y - p.y, t.x - p.x);
      } else {
        // pas chassés : mouvement latéral
        p.strafeT -= dt;
        if (p.strafeT <= 0) {
          p.strafeT = 0.7 + Math.random() * 0.9;
          p.strafeDir = Math.random() < 0.5 ? -1 : 1;
        }
        const perp = Math.atan2(t.y - p.y, t.x - p.x) + Math.PI / 2;
        moveToward(p, w, p.x + Math.cos(perp) * 50 * p.strafeDir, p.y + Math.sin(perp) * 50 * p.strafeDir, 80, dt);
        p.angle = Math.atan2(t.y - p.y, t.x - p.x);
      }
      const mayShoot = p.kind !== "cop" || w.wanted.level >= 2 || p.missionTag;
      if (mayShoot && hasLOS && d < 320 && p.shootT <= 0) {
        if (p.burstLeft > 0) {
          p.burstLeft--;
          p.shootT = 0.16;
        } else {
          p.burstLeft = 1 + (Math.random() * 2 | 0);
          p.shootT = 0.9 + Math.random() * 0.8;
        }
        const a = Math.atan2(t.y - p.y, t.x - p.x) + (Math.random() * 2 - 1) * 0.13;
        w.spawnBullet(p, p.x + Math.cos(a) * 12, p.y + Math.sin(a) * 12, a, wp.dmg, "enemy");
        G.Audio.play("shot");
        w.noise(p.x, p.y, 380, "shot");
      }
    }
  }

  /* ---------- navigation piétonne ---------- */

  function followPath(p, w, tx, ty, speed, dt) {
    const stale = !p.path || !p.path.length ||
      U.dist(p.path[p.path.length - 1].x, p.path[p.path.length - 1].y, tx, ty) > 130;
    if (stale && p.pathT <= 0) {
      p.pathT = 1.1 + Math.random() * 0.4;
      p.path = M().findWalkPath(p.x, p.y, tx, ty, 36);
    }
    if (p.path && p.path.length) {
      const wp = p.path[0];
      moveToward(p, w, wp.x, wp.y, speed, dt);
      if (U.dist(p.x, p.y, wp.x, wp.y) < 22) p.path.shift();
    } else {
      moveToward(p, w, tx, ty, speed, dt);
    }
  }

  function moveToward(p, w, tx, ty, speed, dt) {
    const dx = tx - p.x, dy = ty - p.y;
    const desired = Math.atan2(dy, dx);
    p.angle = U.angleDamp(p.angle, desired, 10, dt);
    const ox = p.x, oy = p.y;
    // vitesse mémorisée pour l'anticipation de la visée auto
    p.vx = Math.cos(p.angle) * speed;
    p.vy = Math.sin(p.angle) * speed;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // séparation locale : ne pas se marcher dessus
    if (w.eachPedNear) {
      let sx = 0, sy = 0;
      w.eachPedNear(p.x, p.y, 22, (o) => {
        if (o === p || o.dead) return;
        const d2 = U.dist2(p.x, p.y, o.x, o.y);
        if (d2 > 0.01 && d2 < 17 * 17) {
          const d = Math.sqrt(d2);
          const f = (17 - d) / d;
          sx += (p.x - o.x) * f; sy += (p.y - o.y) * f;
        }
      });
      p.x += sx * 4.5 * dt;
      p.y += sy * 4.5 * dt;
    }

    const hit = M().collideCircle(p, p.radius);
    if (hit) {
      p.stuckT += dt;
      if (p.stuckT > 0.7) {
        p.stuckT = 0;
        if (p.state === "wander") {
          pickWanderTarget(p);
        } else {
          // glisser le long de l'obstacle et forcer un recalcul de chemin
          p.x = ox + Math.cos(p.angle + Math.PI / 2) * speed * dt;
          p.y = oy + Math.sin(p.angle + Math.PI / 2) * speed * dt;
          M().collideCircle(p, p.radius);
          p.path = null; p.pathT = 0;
        }
      }
    } else p.stuckT = 0;
    p.walkPhase += dt * speed * 0.09;
  }

  function drawPedEntity(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.dead) {
      S.drawPed(ctx, p.look, p.angle, 0, "down", { alpha: U.clamp(p.corpseT / 4, 0, 1) });
    } else if (p.state === "knocked") {
      S.drawPed(ctx, p.look, p.angle, 0, "down", {});
    } else {
      const wp = WEAPONS[p.weapon];
      let pose = "idle";
      const opt = { weapon: p.weapon === "fist" ? null : p.weapon, scale: p.scale };
      if (p.state === "cower") pose = "cower";
      else if (p.activity === "sit") pose = "sit";
      else if (p.activity === "phone") pose = "phone";
      else if (p.attackT > 0 && wp.melee) { pose = "punch"; opt.punchT = U.clamp(p.attackT / wp.rate, 0, 1); }
      else if (!wp.melee && (p.state === "chase" || p.state === "search")) { pose = "aim"; }
      else if (p.walkPhase > 0) pose = "walk";
      S.drawPed(ctx, p.look, p.angle, p.walkPhase, pose, opt);

      // témoin en train d'alerter la police : bulle « ! »
      if (p.witness) {
        ctx.rotate(-G.Camera.rot);
        ctx.fillStyle = "rgba(18,14,28,0.9)";
        ctx.beginPath(); ctx.arc(0, -22, 7, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = "#ffc857"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(0, -22, 7, 0, U.TAU); ctx.stroke();
        ctx.fillStyle = "#ffc857";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("!", 0, -21);
      }
    }
    ctx.restore();
  }

  /* =========================================================
     JOUEUR
     ========================================================= */

  function makePlayer(x, y) {
    return {
      etype: "player",
      x, y, vx: 0, vy: 0,
      angle: -Math.PI / 2,
      radius: 7,
      hp: 100, maxHp: 100,
      armor: 0,
      money: 0,
      dead: false, busted: false,
      look: S.pedLook("player"),
      walkPhase: 0,
      weapon: "fist",
      weapons: { fist: true },
      ammo: { pistol: 0, smg: 0, shotgun: 0 },
      attackT: 0,
      punchAnimT: 0,
      vehicle: null,
      enterT: 0,
      aimTarget: null,
      hurtFlash: 0,
      onBridge: false
    };
  }

  function playerUpdate(pl, w, dt) {
    const In = G.Input, Cam = G.Camera;
    pl.attackT = Math.max(0, pl.attackT - dt);
    pl.punchAnimT = Math.max(0, pl.punchAnimT - dt);
    pl.enterT = Math.max(0, pl.enterT - dt);
    pl.hurtFlash = Math.max(0, pl.hurtFlash - dt);

    // changement d'arme
    if (In.wasPressed("Tab")) cycleWeapon(pl, 1);
    if (In.wasPressed("Digit1")) selectWeapon(pl, "fist");
    if (In.wasPressed("Digit2")) selectWeapon(pl, "bat");
    if (In.wasPressed("Digit3")) selectWeapon(pl, "pistol");
    if (In.wasPressed("Digit4")) selectWeapon(pl, pl.weapons.shotgun ? "shotgun" : "smg");

    if (pl.vehicle) {
      updatePlayerDriving(pl, w, dt);
      return;
    }

    // ------- à pied -------
    const ax = In.axis();
    // direction relative à la caméra (la caméra pivote !)
    const c = Math.cos(-Cam.rot), s = Math.sin(-Cam.rot);
    const mx = ax.x * c - ax.y * s;
    const my = ax.x * s + ax.y * c;
    const moving = (mx !== 0 || my !== 0);
    const speed = In.sprint ? 190 : 125;

    pl.vx = mx * speed;
    pl.vy = my * speed;
    pl.x += pl.vx * dt;
    pl.y += pl.vy * dt;
    M().collideCircle(pl, pl.radius);

    if (moving) {
      pl.angle = U.angleDamp(pl.angle, Math.atan2(my, mx), 14, dt);
      pl.walkPhase += dt * speed * 0.09;
    } else {
      pl.walkPhase = 0;
    }

    // visée auto
    pl.aimTarget = findAimTarget(pl, w);

    // attaque
    const wp = WEAPONS[pl.weapon];
    if (wp.melee) {
      if (In.attackTap && pl.attackT <= 0) {
        pl.attackT = wp.rate;
        pl.punchAnimT = 0.28;
        // se tourner vers la cible la plus proche + petit pas d'attaque
        const tgt = nearestHostile(pl, w, 80);
        if (tgt) {
          pl.angle = Math.atan2(tgt.y - pl.y, tgt.x - pl.x);
          if (U.dist(pl.x, pl.y, tgt.x, tgt.y) > 28) {
            pl.x += Math.cos(pl.angle) * 8;
            pl.y += Math.sin(pl.angle) * 8;
            M().collideCircle(pl, pl.radius);
          }
        }
        let hit = false;
        for (const p of w.peds) {
          if (p.dead) continue;
          const d = U.dist(pl.x, pl.y, p.x, p.y);
          if (d < wp.range + p.radius &&
              Math.abs(U.angleDiff(pl.angle, Math.atan2(p.y - pl.y, p.x - pl.x))) < 1.2) {
            pedTakeDamage(p, w, wp.dmg, "player", pl.x, pl.y);
            const kb = 60;
            p.x += Math.cos(pl.angle) * 6;
            p.y += Math.sin(pl.angle) * 6;
            hit = true;
            w.onPlayerAttack(p, wp.melee);
          }
        }
        G.Audio.play(hit ? "punchHit" : "punchMiss");
        if (hit) w.noise(pl.x, pl.y, 120, "fight");
      }
    } else {
      const wantFire = wp.auto ? In.attackHeld : In.attackTap;
      if (wantFire && pl.attackT <= 0) {
        if (pl.ammo[pl.weapon] <= 0) {
          if (In.attackTap) { G.Audio.play("reload"); w.toast("Plus de munitions ! (Tab pour changer d'arme)"); }
        } else {
          pl.attackT = wp.rate;
          pl.ammo[pl.weapon]--;
          fireWeapon(pl, w, wp);
        }
      }
    }

    // entrer dans un véhicule
    if (In.action && pl.enterT <= 0) {
      const v = w.nearestVehicle(pl.x, pl.y, 78);
      if (v && !v.wreck) enterVehicle(pl, w, v);
    }
  }

  function fireWeapon(pl, w, wp) {
    const In = G.Input, Cam = G.Camera;
    let aimA;
    if (In.mouse.usedRecently > 0) {
      const m = Cam.screenToWorld(In.mouse.x, In.mouse.y, w.viewW, w.viewH);
      aimA = Math.atan2(m.y - pl.y, m.x - pl.x);
    } else if (pl.aimTarget && !pl.aimTarget.dead) {
      // anticipation : viser là où sera la cible à l'arrivée de la balle
      const t = pl.aimTarget;
      const eta = U.dist(pl.x, pl.y, t.x, t.y) / 950;
      aimA = Math.atan2(t.y + (t.vy || 0) * eta - pl.y, t.x + (t.vx || 0) * eta - pl.x);
    } else {
      aimA = pl.angle;
    }
    pl.angle = aimA;
    const n = wp.pellets || 1;
    for (let i = 0; i < n; i++) {
      const a = aimA + (Math.random() * 2 - 1) * wp.spread;
      w.spawnBullet(pl, pl.x + Math.cos(a) * 14, pl.y + Math.sin(a) * 14, a, wp.dmg, "player");
    }
    w.addParticle("flash", pl.x + Math.cos(aimA) * 16, pl.y + Math.sin(aimA) * 16, 1);
    G.Audio.play(pl.weapon === "smg" ? "smg" : pl.weapon === "shotgun" ? "shotgun" : "shot");
    w.noise(pl.x, pl.y, 420, "shot");
    G.Camera.shake(0.12);
  }

  function isHostileToPlayer(p, w) {
    if (p.dead || p.kind === "civ" || p.kind === "wu" || p.staticNpc) return false;
    return p.state === "chase" || p.kind === "shark" ||
           (p.kind === "cop" && w.wanted.level > 0) || !!p.missionTag;
  }

  function findAimTarget(pl, w) {
    // 1) cible dans le cône de visée devant le joueur
    let best = null, bestD = 300;
    for (const p of w.peds) {
      if (!isHostileToPlayer(p, w)) continue;
      const d = U.dist(pl.x, pl.y, p.x, p.y);
      if (d > bestD) continue;
      if (Math.abs(U.angleDiff(pl.angle, Math.atan2(p.y - pl.y, p.x - pl.x))) > 1.3) continue;
      if (!M().lineOfSight(pl.x, pl.y, p.x, p.y)) continue;
      best = p; bestD = d;
    }
    if (best) return best;
    // 2) sinon : verrouillage large à courte portée (lock-on arcade généreux)
    bestD = 230;
    for (const p of w.peds) {
      if (!isHostileToPlayer(p, w)) continue;
      const d = U.dist(pl.x, pl.y, p.x, p.y);
      if (d > bestD) continue;
      if (!M().lineOfSight(pl.x, pl.y, p.x, p.y)) continue;
      best = p; bestD = d;
    }
    return best;
  }

  function nearestHostile(pl, w, range) {
    let best = null, bestD = range;
    for (const p of w.peds) {
      if (p.dead) continue;
      const d = U.dist(pl.x, pl.y, p.x, p.y);
      if (d < bestD) { best = p; bestD = d; }
    }
    return best;
  }

  function cycleWeapon(pl, dir) {
    const owned = WEAPON_ORDER.filter(k => pl.weapons[k]);
    let i = owned.indexOf(pl.weapon);
    i = (i + dir + owned.length) % owned.length;
    pl.weapon = owned[i];
    G.Audio.play("reload");
  }
  function selectWeapon(pl, k) {
    if (pl.weapons[k]) { pl.weapon = k; G.Audio.play("reload"); }
  }

  function enterVehicle(pl, w, v) {
    if (v.driverKind === "cop" && !v.copOut) {
      // voler une voiture de police occupée : gros délit
      w.addHeat(40, true);
    } else if (v.ai && v.driverKind === "civ") {
      // carjacking : le conducteur s'enfuit
      const rng = Math.random;
      const ped = makePed("civ", v.x + Math.cos(v.angle + Math.PI / 2) * 26, v.y + Math.sin(v.angle + Math.PI / 2) * 26);
      ped.state = "flee"; ped.threatX = pl.x; ped.threatY = pl.y;
      w.peds.push(ped);
      w.addHeat(18, false);
    }
    v.ai = null;
    v.driverKind = "player";
    pl.vehicle = v;
    pl.enterT = 0.5;
    pl.x = v.x; pl.y = v.y;
    G.Audio.play("door");
    G.Audio.startEngine();
    w.onEnterVehicle(v);
  }

  function exitVehicle(pl, w) {
    const v = pl.vehicle;
    const sp = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
    if (sp > 140) return; // trop rapide pour sauter
    const side = v.angle + Math.PI / 2;
    const ex = v.x + Math.cos(side) * (v.def.W / 2 + 14);
    const ey = v.y + Math.sin(side) * (v.def.W / 2 + 14);
    if (M().isSolidAt(ex, ey)) {
      const ex2 = v.x - Math.cos(side) * (v.def.W / 2 + 14);
      const ey2 = v.y - Math.sin(side) * (v.def.W / 2 + 14);
      if (M().isSolidAt(ex2, ey2)) return;
      pl.x = ex2; pl.y = ey2;
    } else {
      pl.x = ex; pl.y = ey;
    }
    v.throttle = 0; v.steer = 0; v.driverKind = null;
    pl.vehicle = null;
    pl.enterT = 0.5;
    G.Audio.play("door");
    G.Audio.stopEngine();
  }

  function updatePlayerDriving(pl, w, dt) {
    const In = G.Input;
    const v = pl.vehicle;
    const ax = In.axis();
    v.throttle = -ax.y;               // haut = accélérer
    v.steer = ax.x;
    v.handbrake = In.attackHeld && !In.mouseFire; // espace = frein à main
    if (In.wasPressed("KeyK")) { G.Audio.play("horn"); w.noise(v.x, v.y, 300, "horn"); }

    pl.x = v.x; pl.y = v.y;
    pl.angle = v.angle;

    const sp = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
    G.Audio.updateEngine(U.clamp(sp / v.def.maxSpeed, 0, 1));

    if (In.action && pl.enterT <= 0) exitVehicle(pl, w);

    // tir en conduite (souris uniquement)
    const wp = WEAPONS[pl.weapon];
    if (!wp.melee && In.mouseFire && pl.attackT <= 0 && pl.ammo[pl.weapon] > 0) {
      pl.attackT = Math.max(wp.rate, 0.18);
      pl.ammo[pl.weapon]--;
      const m = G.Camera.screenToWorld(In.mouse.x, In.mouse.y, w.viewW, w.viewH);
      const aimA = Math.atan2(m.y - v.y, m.x - v.x);
      w.spawnBullet(pl, v.x + Math.cos(aimA) * 30, v.y + Math.sin(aimA) * 30, aimA, wp.dmg, "player");
      G.Audio.play(pl.weapon === "smg" ? "smg" : "shot");
      w.noise(v.x, v.y, 420, "shot");
    }
  }

  function hurtPlayer(pl, w, dmg) {
    if (pl.dead || pl.busted) return;
    if (pl.armor > 0) {
      const absorbed = Math.min(pl.armor, dmg * 0.7);
      pl.armor -= absorbed;
      dmg -= absorbed;
    }
    pl.hp -= dmg;
    pl.hurtFlash = 0.4;
    G.Audio.play("hurt");
    G.Camera.shake(0.18);
    if (pl.hp <= 0) {
      pl.hp = 0;
      pl.dead = true;
      w.onWasted();
    }
  }

  function drawPlayer(ctx, pl) {
    if (pl.vehicle) return; // dessiné avec la voiture
    ctx.save();
    ctx.translate(pl.x, pl.y);
    const wp = WEAPONS[pl.weapon];
    let pose = "idle";
    const opt = { weapon: pl.weapon === "fist" ? null : pl.weapon, showWeapon: !wp.melee };
    if (pl.dead) pose = "down";
    else if (pl.punchAnimT > 0 && wp.melee) { pose = "punch"; opt.punchT = pl.punchAnimT / 0.28; }
    else if (!wp.melee && (pl.aimTarget || G.Input.attackHeld)) pose = "aim";
    else if (pl.walkPhase > 0) pose = "walk";
    S.drawPed(ctx, pl.look, pl.angle, pl.walkPhase, pose, opt);
    ctx.restore();
  }

  /* =========================================================
     VÉHICULE
     ========================================================= */

  let VEH_ID = 1;
  const CORNERS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

  function makeVehicle(type, x, y, angle, color) {
    const def = S.VEHICLE_DEFS[type];
    return {
      id: VEH_ID++,
      etype: "vehicle",
      type, def,
      color: color || U.pick(Math.random, S.CAR_COLORS),
      x, y, vx: 0, vy: 0,
      angle, angVel: 0,
      throttle: 0, steer: 0, handbrake: false,
      hp: def.hp, maxHp: def.hp,
      wreck: false, burnT: 0, explodeT: -1,
      screechT: 0, braking: false,
      wallT: 0, wallNX: 0, wallNY: 0,
      ai: null,               // { mode, tgtX, tgtY, cruise, blockedT, dir }
      driverKind: null,       // civ | cop | player | null (garé)
      copOut: false,
      siren: false,
      lightT: 0,
      horn: 0,
      lastDamager: null,
      missionTag: null
    };
  }

  function vehicleSpeed(v) { return Math.sqrt(v.vx * v.vx + v.vy * v.vy); }

  function updateVehicle(v, w, dt) {
    if (v.wreck) return true;

    if (v.explodeT >= 0) {
      v.explodeT -= dt;
      if (Math.random() < 0.3) w.addParticle("fire", v.x + (Math.random() - 0.5) * 30, v.y + (Math.random() - 0.5) * 16, 2);
      if (v.explodeT <= 0) explodeVehicle(v, w);
    }

    if (v.ai) updateVehicleAI(v, w, dt);

    const driving = v.driverKind !== null;
    if (!driving && vehicleSpeed(v) < 2) { v.vx = 0; v.vy = 0; return true; }

    // --- physique arcade ---
    const def = v.def;
    const fw = { x: Math.cos(v.angle), y: Math.sin(v.angle) };
    const rt = { x: -fw.y, y: fw.x };
    let fSpd = v.vx * fw.x + v.vy * fw.y;
    let lSpd = v.vx * rt.x + v.vy * rt.y;

    // accélération / freinage
    if (v.throttle > 0) fSpd += def.accel * v.throttle * dt;
    else if (v.throttle < 0) {
      if (fSpd > 5) fSpd += def.accel * 1.6 * v.throttle * dt;      // frein
      else fSpd = Math.max(fSpd + def.accel * 0.7 * v.throttle * dt, -95); // marche arrière
    }
    // frottements
    fSpd *= Math.exp(-(v.throttle === 0 ? 0.9 : 0.15) * dt);
    if (v.handbrake) fSpd *= Math.exp(-1.6 * dt);
    fSpd = U.clamp(fSpd, -95, def.maxSpeed);

    // adhérence latérale (dérive au frein à main)
    lSpd *= Math.exp(-(v.handbrake ? 1.8 : def.grip) * dt);

    // direction + moment induit par les chocs
    const steerEff = v.steer * def.turn * U.clamp(Math.abs(fSpd) / 130, 0, 1) * Math.sign(fSpd || 1);
    v.angle += (steerEff * (v.handbrake ? 1.5 : 1) + v.angVel) * dt;
    v.angVel *= Math.exp(-5 * dt);

    v.braking = v.throttle < -0.1 && fSpd > 15;

    v.vx = fw.x * fSpd + rt.x * lSpd;
    v.vy = fw.y * fSpd + rt.y * lSpd;
    v.x += v.vx * dt;
    v.y += v.vy * dt;

    // traces + crissements de pneus
    if (v.handbrake && Math.abs(fSpd) > 90 && v.driverKind === "player") {
      w.addSkid(v);
    }
    v.screechT = Math.max(0, v.screechT - dt);
    if (((Math.abs(lSpd) > 62 && Math.abs(fSpd) > 100) || (v.braking && fSpd > 215)) &&
        v.screechT <= 0 && U.dist2(v.x, v.y, w.player.x, w.player.y) < 700 * 700) {
      G.Audio.play("screech");
      v.screechT = 0.5;
    }

    // --- collisions monde : les quatre coins de la caisse ---
    const hl = def.L * 0.44, hw = def.W * 0.48;
    let impact = 0;
    let wnx = 0, wny = 0, wnCount = 0; // normale moyenne des murs touchés (pour l'IA)
    for (const c of CORNERS) {
      const ox = c[0] * hl, oy = c[1] * hw;
      const wx = v.x + ox * fw.x - oy * fw.y;
      const wy = v.y + ox * fw.y + oy * fw.x;
      const push = M().pointPush(wx, wy);
      if (!push) continue;
      v.x += push.x; v.y += push.y;
      const pl = Math.sqrt(push.x * push.x + push.y * push.y) || 1;
      const nx = push.x / pl, ny = push.y / pl;
      wnx += nx; wny += ny; wnCount++;
      const vn = v.vx * nx + v.vy * ny;
      if (vn < 0) {
        impact = Math.max(impact, -vn);
        v.vx -= nx * vn * 1.3;
        v.vy -= ny * vn * 1.3;
        // couple : un choc au coin fait pivoter la caisse (borné plus bas)
        const rx = wx - v.x, ry = wy - v.y;
        v.angVel += (rx * ny - ry * nx) * (-vn) * 0.00030;
      }
    }
    // le couple ne doit jamais s'emballer (sinon une caisse coincée dans un
    // coin se met à tourner sur elle-même indéfiniment)
    v.angVel = U.clamp(v.angVel, -6, 6);
    if (wnCount > 0) {
      v.wallNX = wnx / wnCount; v.wallNY = wny / wnCount; v.wallT = 0.4;
    } else {
      v.wallT = Math.max(0, (v.wallT || 0) - dt);
    }
    if (impact > 60) {
      const dmg = (impact - 50) * 0.14;
      damageVehicle(v, w, dmg, null);
      G.Audio.play("crash");
      w.addParticle("spark", v.x + fw.x * hl, v.y + fw.y * hl, 5);
      if (v.driverKind === "player") G.Camera.shake(U.clamp(impact / 500, 0.1, 0.5));
      if (v.ai) v.ai.blockedT += 0.4;
    }

    // --- collisions véhicule / véhicule ---
    for (const o of w.vehicles) {
      if (o === v) continue;
      // chaque paire active une seule fois ; les voitures garées ne
      // simulant pas, c'est toujours la voiture en mouvement qui gère.
      const oParked = !o.ai && o.driverKind === null && (o.vx * o.vx + o.vy * o.vy) < 4;
      if (o.id < v.id && !oParked) continue;
      const minD = (v.def.W + o.def.W) * 0.55 + 8;
      const d = U.dist(v.x, v.y, o.x, o.y);
      const reach = (v.def.L + o.def.L) * 0.5;
      if (d > reach) continue;
      // test simple : cercles centraux, réponse pondérée par les masses
      const cc = (v.def.L + o.def.L) * 0.30;
      if (d < cc) {
        const nx = (o.x - v.x) / (d || 1), ny = (o.y - v.y) / (d || 1);
        const overlap = cc - d;
        const mv = v.def.mass, mo = o.def.mass, tm = mv + mo;
        v.x -= nx * overlap * (mo / tm); v.y -= ny * overlap * (mo / tm);
        o.x += nx * overlap * (mv / tm); o.y += ny * overlap * (mv / tm);
        const rel = (v.vx - o.vx) * nx + (v.vy - o.vy) * ny;
        if (rel > 0) {
          v.vx -= nx * rel * 1.4 * (mo / tm); v.vy -= ny * rel * 1.4 * (mo / tm);
          o.vx += nx * rel * 1.4 * (mv / tm); o.vy += ny * rel * 1.4 * (mv / tm);
          // amorce de tête-à-queue selon le point de contact
          const side = (o.x - v.x) * -Math.sin(v.angle) + (o.y - v.y) * Math.cos(v.angle);
          v.angVel += Math.sign(side) * rel * 0.0006 * (mo / tm);
          o.angVel -= Math.sign(side) * rel * 0.0006 * (mv / tm);
          if (rel > 70) {
            const dm = (rel - 50) * 0.12;
            damageVehicle(v, w, dm, o); damageVehicle(o, w, dm, v);
            G.Audio.play("crash");
            w.addParticle("spark", (v.x + o.x) / 2, (v.y + o.y) / 2, 4);
            if (o.ai && o.ai.mode === "cruise") o.ai.panicT = 4;
          }
        }
      }
    }

    // --- collisions piétons ---
    const sp = vehicleSpeed(v);
    if (sp > 50) {
      for (const p of w.peds) {
        if (p.dead || p.state === "knocked") continue;
        const d = U.dist(v.x, v.y, p.x, p.y);
        if (d < def.L * 0.42 + p.radius) {
          const nx = (p.x - v.x) / (d || 1), ny = (p.y - v.y) / (d || 1);
          pedKnock(p, w, v.vx * 0.7 + nx * 90, v.vy * 0.7 + ny * 90, sp * 0.30 * def.mass);
          if (v.driverKind === "player") w.onPlayerRanOver(p);
          v.vx *= 0.92; v.vy *= 0.92;
        }
      }
    }

    // fumée si abîmé
    if (v.hp < 40 && Math.random() < 0.25)
      w.addParticle("smoke", v.x, v.y, 1);

    v.lightT += dt;
    return true;
  }

  function damageVehicle(v, w, dmg, src) {
    if (v.wreck) return;
    v.hp -= dmg;
    // créditer le joueur : à pied, ou au volant de son bélier
    if (src && (src.etype === "player" ||
        (src.etype === "vehicle" && src.driverKind === "player"))) {
      v.lastDamager = "player";
    }
    if (v.hp <= 25 && v.explodeT < 0) {
      v.explodeT = 1.4; // compte à rebours d'explosion
      if (v.ai) { v.ai = null; } // le conducteur panique et cale
    }
  }

  function explodeVehicle(v, w) {
    if (v.wreck) return;
    v.wreck = true;
    v.explodeT = -1;
    G.Audio.play("explosion");
    G.Camera.shake(0.6);
    w.addDecal("scorch", v.x, v.y);
    for (let i = 0; i < 26; i++) w.addParticle("fire", v.x + (Math.random() - 0.5) * 44, v.y + (Math.random() - 0.5) * 26, 3);
    for (let i = 0; i < 16; i++) w.addParticle("smoke", v.x + (Math.random() - 0.5) * 40, v.y + (Math.random() - 0.5) * 24, 3);
    for (let i = 0; i < 12; i++) w.addParticle("debris", v.x, v.y, 1);
    w.addParticle("ring", v.x, v.y, 1);
    // dégâts de zone
    for (const p of w.peds) {
      const d = U.dist(v.x, v.y, p.x, p.y);
      if (d < 95) pedTakeDamage(p, w, 80 - d * 0.5, v.lastDamager === "player" ? "player" : "explosion", v.x, v.y);
    }
    for (const o of w.vehicles) {
      if (o === v || o.wreck) continue;
      const d = U.dist(v.x, v.y, o.x, o.y);
      if (d < 110) damageVehicle(o, w, 70 - d * 0.4, v.lastDamager === "player" ? w.player : null);
    }
    const pl = w.player;
    const dp = U.dist(v.x, v.y, pl.x, pl.y);
    if (pl.vehicle === v) w.hurtPlayer(200, null);
    else if (dp < 95) w.hurtPlayer(70 - dp * 0.5, null);
    w.onVehicleExploded(v);
  }

  /* ---------- IA trafic / poursuite ---------- */

  /**
   * Détecteur de blocage réel + manœuvre de dégagement, partagé par les
   * modes « cruise » et « chase ». Se base sur le déplacement effectif
   * (pas sur la vitesse visée) pour ne jamais laisser une voiture tourner
   * sur elle-même indéfiniment contre un obstacle. Renvoie true tant
   * qu'une manœuvre de dégagement est en cours (l'appelant doit alors
   * s'arrêter là pour cette frame : throttle/steer sont déjà posés).
   */
  function updateStuckDetector(v, ai, dt) {
    ai._stuckT = (ai._stuckT || 0) + dt;
    if (ai._stuckT >= 0.7) {
      const moved = ai._stuckX != null ? U.dist(v.x, v.y, ai._stuckX, ai._stuckY) : 999;
      if (moved < 24 && (Math.abs(v.throttle) > 0.05 || v.wallT > 0)) {
        ai.wedgedT = (ai.wedgedT || 0) + ai._stuckT;
      } else {
        ai.wedgedT = 0;
      }
      ai._stuckT = 0; ai._stuckX = v.x; ai._stuckY = v.y;
    }
    if (ai.escapeT > 0) {
      ai.escapeT -= dt;
      v.throttle = -1;
      if (v.wallT > 0) {
        // reculer à l'opposé de la normale moyenne des murs touchés
        const away = Math.atan2(-v.wallNY, -v.wallNX);
        v.steer = U.clamp(U.angleDiff(v.angle, away) * 2, -1, 1);
      } else {
        v.steer = ai.escapeSteer || 1;
      }
      if (ai.escapeT <= 0) { ai.wedgedT = 0; ai.tgtX = null; }
      return true;
    }
    if (ai.wedgedT > 1.3) {
      ai.escapeT = 1.0;
      ai.escapeSteer = Math.random() < 0.5 ? -1 : 1;
      ai.wedgedT = 0;
      v.throttle = -1; v.steer = ai.escapeSteer;
      return true;
    }
    return false;
  }

  function updateVehicleAI(v, w, dt) {
    const ai = v.ai;
    const Mp = M();

    if (ai.mode === "roadblock") {
      // barrage : rester en travers, moteur coupé
      v.throttle = 0; v.steer = 0;
      return;
    }

    if (ai.mode === "route") {
      // véhicule scripté : suit une liste de jalons routiers (missions)
      if (updateStuckDetector(v, ai, dt)) return;
      if (!ai.wps || ai.wpi >= ai.wps.length) {
        ai.done = true;
        v.throttle = vehicleSpeed(v) > 8 ? -0.8 : 0;
        v.steer = 0;
        return;
      }
      // escorte : ne pas semer son protecteur
      if (ai.escort && U.dist(v.x, v.y, w.player.x, w.player.y) > 620) {
        v.throttle = vehicleSpeed(v) > 10 ? -0.6 : 0;
        ai.waiting = true;
        return;
      }
      ai.waiting = false;
      const wp = ai.wps[ai.wpi];
      steerTowards(v, wp.x, wp.y, dt);
      if (U.dist(v.x, v.y, wp.x, wp.y) < 42) ai.wpi++;
      const sp2 = vehicleSpeed(v);
      v.throttle = sp2 < (ai.cruise || 95) ? 0.7 : 0;
      return;
    }

    if (ai.mode === "ram") {
      // bélier : fonce sur une cible arbitraire (van d'escorte, joueur…)
      if (updateStuckDetector(v, ai, dt)) return;
      const t = ai.targetRef;
      if (!t || t.wreck || t.hp <= 0) {
        ai.mode = "cruise"; ai.cruise = 120; ai.tgtX = null;
        return;
      }
      const d = U.dist(v.x, v.y, t.x, t.y);
      const lead = U.clamp(d / 300, 0, 1);
      steerTowards(v, t.x + (t.vx || 0) * lead, t.y + (t.vy || 0) * lead, dt);
      v.throttle = 1;
      if (d > 90 && vehicleSpeed(v) < 20) {
        ai.blockedT += dt;
        if (ai.blockedT > 1.6) { v.throttle = -0.8; v.steer = Math.random() < 0.5 ? -1 : 1; if (ai.blockedT > 2.6) ai.blockedT = 0; }
      } else ai.blockedT = 0;
      return;
    }

    if (ai.mode === "chase") {
      if (updateStuckDetector(v, ai, dt)) return;
      // voiture de police : ne connaît la position du fuyard que si la
      // brigade l'a vu récemment (mémoire radio partagée avec les agents à
      // pied — voir chaseUpdate). Sans ça, les patrouilles fonçaient tout
      // droit sur le joueur en toute circonstance : impossible à semer.
      const pl = w.player;
      const src = pl.vehicle || pl;
      const seen = w.wanted.lastSeenT < 12;
      const rx = seen ? pl.x : w.wanted.lastSeenX, ry = seen ? pl.y : w.wanted.lastSeenY;
      const d = U.dist(v.x, v.y, pl.x, pl.y);      // distance réelle (dépose d'agent)
      const dTgt = U.dist(v.x, v.y, rx, ry);        // distance à la cible poursuivie
      const lead = seen ? U.clamp(dTgt / 320, 0, 1.1) : 0;
      const tx = rx + (seen ? src.vx * lead : 0), ty = ry + (seen ? src.vy * lead : 0);
      steerTowards(v, tx, ty, dt);

      if (!seen && dTgt < 60) {
        // arrivée sur la dernière position sans visuel : reprend une
        // patrouille normale (sera re-recrutée si on l'aperçoit à nouveau)
        ai.mode = "cruise"; ai.cruise = 130; ai.tgtX = null; ai.blockedT = 0;
        v.siren = false; G.Audio.setSiren(v.id, false);
        return;
      }
      if (seen && !pl.vehicle && d < 130) {
        // s'arrêter et déposer un agent
        v.throttle = -1;
        if (vehicleSpeed(v) < 30 && !v.copOut) {
          v.copOut = true;
          const cop = makePed("cop", v.x + Math.cos(v.angle + Math.PI / 2) * 24, v.y + Math.sin(v.angle + Math.PI / 2) * 24);
          cop.state = "chase"; cop.aggro = pl;
          cop.weapon = w.wanted.level >= 2 ? "pistol" : "fist";
          w.peds.push(cop);
        }
      } else {
        v.throttle = dTgt > 60 ? 1 : 0.2;
      }
      if (dTgt > 90 && vehicleSpeed(v) < 20) {
        ai.blockedT += dt;
        if (ai.blockedT > 1.6) { v.throttle = -0.8; v.steer = Math.random() < 0.5 ? -1 : 1; if (ai.blockedT > 2.6) ai.blockedT = 0; }
      } else ai.blockedT = 0;
      return;
    }

    // détection de blocage réel (voir updateStuckDetector plus bas) : sans
    // elle, une voiture coincée contre un coin de bâtiment ne se considère
    // jamais « bloquée » (sa vitesse de croisière visée reste élevée) et
    // tourne sur elle-même indéfiniment sous le seul couple des chocs.
    if (updateStuckDetector(v, ai, dt)) return;

    // --- croisière sur les voies ---
    if (ai.tgtX == null) pickNextLaneTarget(v, w);
    if (U.dist(v.x, v.y, ai.tgtX, ai.tgtY) < 26) pickNextLaneTarget(v, w);

    // écart latéral temporaire pour contourner une épave
    ai.swerveT = Math.max(0, (ai.swerveT || 0) - dt);
    let tgtX = ai.tgtX, tgtY = ai.tgtY;
    if (ai.swerveT > 0) {
      const perp = v.angle + Math.PI / 2;
      tgtX += Math.cos(perp) * 34 * ai.swerveDir;
      tgtY += Math.sin(perp) * 34 * ai.swerveDir;
    }
    steerTowards(v, tgtX, tgtY, dt);

    const cruise = ai.panicT > 0 ? 240 : ai.cruise;
    ai.panicT = Math.max(0, (ai.panicT || 0) - dt);
    const sp = vehicleSpeed(v);
    const ca = Math.cos(v.angle), sa = Math.sin(v.angle);
    let targetSpd = cruise;

    // — suivi de file : la voiture devant dicte l'allure —
    let lead = null, leadProj = 1e9;
    const scan = (o) => {
      if (o === v) return;
      const rx = o.x - v.x, ry = o.y - v.y;
      const proj = rx * ca + ry * sa;          // distance devant
      const lat = Math.abs(-rx * sa + ry * ca); // écart latéral
      if (proj > 10 && proj < 150 && lat < 30 && proj < leadProj) { lead = o; leadProj = proj; }
    };
    if (w.eachVehNear) w.eachVehNear(v.x + ca * 80, v.y + sa * 80, 110, scan);
    else for (const o of w.vehicles) scan(o);

    if (lead) {
      const leadSpd = lead.vx * ca + lead.vy * sa;
      const gap = leadProj - (v.def.L + lead.def.L) * 0.5;
      targetSpd = Math.min(targetSpd, Math.max(0, leadSpd + (gap - 30) * 1.6));
      // épave ou véhicule à l'arrêt : tenter un déboîtement
      const leadStopped = Math.abs(leadSpd) < 14 && (lead.wreck || !lead.ai || lead.driverKind === null);
      if (leadStopped && gap < 95 && gap > 20 && ai.swerveT <= 0 && ai.panicT <= 0) {
        for (const side of [ai.swerveDir || 1, -(ai.swerveDir || 1)]) {
          const cx = v.x + ca * 75 - sa * 34 * side;
          const cy = v.y + sa * 75 + ca * 34 * side;
          let free = Mp.get(Math.floor(cx / 48), Math.floor(cy / 48)) === Mp.ROAD;
          if (free && w.eachVehNear) w.eachVehNear(cx, cy, 40, (o) => { if (o !== v && o !== lead && U.dist2(cx, cy, o.x, o.y) < 38 * 38) free = false; });
          if (free) { ai.swerveDir = side; ai.swerveT = 1.5; break; }
        }
      }
    }

    // — piéton ou joueur sur la trajectoire —
    if (targetSpd > 0) {
      const lookAhead = 40 + sp * 0.45;
      const px = v.x + ca * lookAhead, py = v.y + sa * lookAhead;
      const pl = w.player;
      if (!pl.vehicle && U.dist2(px, py, pl.x, pl.y) < 36 * 36) targetSpd = 0;
      else if (w.eachPedNear) {
        w.eachPedNear(px, py, 30, (p) => {
          if (!p.dead && U.dist2(px, py, p.x, p.y) < 26 * 26) targetSpd = 0;
        });
      }
    }

    // — lever le pied aux intersections —
    if (ai.panicT <= 0) {
      const ttx = Math.floor(ai.tgtX / 48), tty = Math.floor(ai.tgtY / 48);
      const m = Mp.laneMaskAt(ttx, tty);
      const isCross = (m & (Mp.LN | Mp.LS)) && (m & (Mp.LE | Mp.LW));
      if (isCross) targetSpd = Math.min(targetSpd, 95);
    }

    // — accélérateur / frein + gestion de blocage —
    if (targetSpd < 12 && sp < 25) {
      v.throttle = 0;
      ai.blockedT += dt;
      if (ai.blockedT > 1.6 && !ai.horned && U.dist2(v.x, v.y, w.player.x, w.player.y) < 600 * 600) {
        ai.horned = true;
        G.Audio.play("horn");
      }
      if (ai.blockedT > 4) {
        v.throttle = -0.7; v.steer = 0.8;
        if (ai.blockedT > 5.2) { ai.blockedT = 0; ai.horned = false; pickNextLaneTarget(v, w); }
      }
    } else {
      if (ai.blockedT > 0 && sp > 40) { ai.blockedT = 0; ai.horned = false; }
      v.throttle = sp < targetSpd ? 0.75 : (sp > targetSpd + 30 ? -0.6 : 0);
    }
  }

  function steerTowards(v, tx, ty, dt) {
    const desired = Math.atan2(ty - v.y, tx - v.x);
    const diff = U.angleDiff(v.angle, desired);
    v.steer = U.clamp(diff * 2.4, -1, 1);
    // marche arrière : inverser le volant
    const fSpd = v.vx * Math.cos(v.angle) + v.vy * Math.sin(v.angle);
    if (fSpd < -5) v.steer = -v.steer;
  }

  function pickNextLaneTarget(v, w) {
    const Mp = M(), T = Mp.T;
    const ai = v.ai;
    const tx = Math.floor(v.x / T), ty = Math.floor(v.y / T);
    const mask = Mp.laneMaskAt(tx, ty);

    // direction actuelle dominante
    const dirs = Mp.DIRS;
    let curDir = ai.dir || null;
    const choices = [];
    for (const d of dirs) {
      if (!(mask & d.bit)) continue;
      if (curDir && d.dx === -curDir.dx && d.dy === -curDir.dy) continue; // pas de demi-tour
      // la tuile suivante doit rester une route
      if (!Mp.isRoad(tx + d.dx, ty + d.dy)) continue;
      let weight = 1;
      if (curDir && d.dx === curDir.dx && d.dy === curDir.dy) weight = 4; // tout droit de préférence
      choices.push({ d, weight });
    }
    if (!choices.length) {
      // hors voie (après un carambolage) : rejoindre la voie la plus proche
      const lt = Mp.nearestRoadTile(v.x, v.y, 5);
      if (lt >= 0) {
        ai.tgtX = (lt % Mp.MW + 0.5) * T;
        ai.tgtY = ((lt / Mp.MW | 0) + 0.5) * T;
        ai.dir = null;
        return;
      }
      ai.tgtX = v.x; ai.tgtY = v.y;
      return;
    }
    let total = 0; for (const c of choices) total += c.weight;
    let r = Math.random() * total, chosen = choices[0];
    for (const c of choices) { r -= c.weight; if (r <= 0) { chosen = c; break; } }
    ai.dir = chosen.d;
    ai.tgtX = (tx + chosen.d.dx + 0.5) * T;
    ai.tgtY = (ty + chosen.d.dy + 0.5) * T;
  }

  /* ---------- rendu véhicule ---------- */

  const wreckCache = new Map();
  function wreckSprite(type, color) {
    const key = type + "|" + color;
    let c = wreckCache.get(key);
    if (c) return c;
    const base = S.vehicleSprite(type, color);
    c = document.createElement("canvas");
    c.width = base.width; c.height = base.height;
    c.lw = base.lw; c.lh = base.lh;
    const ctx = c.getContext("2d");
    ctx.drawImage(base, 0, 0);
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = "rgba(16,12,14,0.82)";
    ctx.fillRect(0, 0, c.width, c.height);
    wreckCache.set(key, c);
    return c;
  }

  function drawVehicle(ctx, v, w) {
    ctx.save();
    ctx.translate(v.x, v.y);
    // ombre
    ctx.save();
    ctx.rotate(v.angle);
    ctx.fillStyle = "rgba(10,8,20,0.30)";
    ctx.beginPath();
    ctx.ellipse(2, 3, v.def.L * 0.52, v.def.W * 0.62, 0, 0, U.TAU);
    ctx.fill();
    ctx.restore();

    ctx.rotate(v.angle);
    const spr = v.wreck ? wreckSprite(v.type, v.color) : S.vehicleSprite(v.type, v.color);
    ctx.drawImage(spr, 0, 0, spr.width, spr.height, -spr.lw / 2, -spr.lh / 2, spr.lw, spr.lh);

    // feux stop
    if (v.braking && !v.wreck) {
      ctx.fillStyle = "rgba(255,60,60,0.55)";
      ctx.beginPath(); ctx.arc(-v.def.L / 2 + 1, -v.def.W / 2 + 4, 3.6, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(-v.def.L / 2 + 1, v.def.W / 2 - 4, 3.6, 0, U.TAU); ctx.fill();
    }

    if (v.type === "police" && !v.wreck && (v.siren || v.ai)) {
      // gyrophare
      const ph = Math.floor(v.lightT * 6) % 2;
      ctx.fillStyle = ph ? "#ff4045" : "#3b8bff";
      ctx.beginPath(); ctx.arc(-2, ph ? -4 : 4, 3.4, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.arc(-2, ph ? -4 : 4, 9, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (v.explodeT >= 0) {
      // flammes avant explosion
      ctx.fillStyle = Math.random() < 0.5 ? "#ff8c42" : "#ffc857";
      ctx.beginPath(); ctx.arc((Math.random() - 0.5) * 26, (Math.random() - 0.5) * 12, 4 + Math.random() * 4, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
  }

  /* =========================================================
     BALLES
     ========================================================= */

  function makeBullet(src, x, y, angle, dmg, team) {
    return {
      etype: "bullet",
      src, team,             // 'player' | 'enemy'
      x, y,
      dx: Math.cos(angle), dy: Math.sin(angle),
      speed: 950,
      life: 0.55,
      dmg
    };
  }

  function updateBullet(b, w, dt) {
    b.life -= dt;
    if (b.life <= 0) return false;
    const step = b.speed * dt;
    const sub = 3;
    for (let i = 0; i < sub; i++) {
      b.x += b.dx * step / sub;
      b.y += b.dy * step / sub;
      if (M().blocksShot(b.x, b.y)) {
        w.addParticle("spark", b.x, b.y, 3);
        return false;
      }
      // piétons
      for (const p of w.peds) {
        if (p.dead || p === b.src) continue;
        if (b.team === "enemy" && (p.kind === "cop" || p.kind === "shark" || p.kind === "lotus")) continue;
        if (U.dist2(b.x, b.y, p.x, p.y) < 110) {
          pedTakeDamage(p, w, b.dmg, b.team === "player" ? "player" : "enemy", b.src.x, b.src.y);
          if (b.team === "player") w.onPlayerShotPed(p);
          return false;
        }
      }
      // joueur
      const pl = w.player;
      if (b.team === "enemy" && !pl.vehicle && !pl.dead && U.dist2(b.x, b.y, pl.x, pl.y) < 130) {
        w.hurtPlayer(b.dmg, b.src);
        return false;
      }
      // véhicules
      for (const v of w.vehicles) {
        if (v.wreck) continue;
        if (b.src === pl && pl.vehicle === v) continue;
        const d2 = U.dist2(b.x, b.y, v.x, v.y);
        if (d2 < (v.def.L * 0.38) * (v.def.L * 0.38)) {
          damageVehicle(v, w, b.dmg * 0.8, b.team === "player" ? pl : null);
          if (b.team === "enemy" && pl.vehicle === v) w.hurtPlayer(b.dmg * 0.35, b.src);
          w.addParticle("spark", b.x, b.y, 2);
          return false;
        }
      }
      // hélicoptère (arcade : on ignore l'altitude)
      if (b.team === "player" && w.heli && !w.heli.dead &&
          U.dist2(b.x, b.y, w.heli.x, w.heli.y) < 26 * 26) {
        w.onHeliHit(b.dmg);
        w.addParticle("spark", b.x, b.y, 3);
        return false;
      }
    }
    return true;
  }

  function drawBullet(ctx, b) {
    ctx.strokeStyle = "#ffd98a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - b.dx * 14, b.y - b.dy * 14);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  /* =========================================================
     PICKUPS
     ========================================================= */

  function makePickup(kind, x, y, amount) {
    return { etype: "pickup", kind, x, y, amount: amount || 0, t: Math.random() * 6, taken: false, respawnT: 0 };
  }

  function updatePickup(pk, w, dt) {
    pk.t += dt;
    if (pk.taken) {
      if (pk.respawnT > 0) {
        pk.respawnT -= dt;
        if (pk.respawnT <= 0) pk.taken = false;
      }
      return;
    }
    const pl = w.player;
    if (pl.dead || pl.vehicle) return;
    if (U.dist2(pl.x, pl.y, pk.x, pk.y) > 22 * 22) return;

    switch (pk.kind) {
      case "health":
        if (pl.hp >= pl.maxHp) return;
        pl.hp = Math.min(pl.maxHp, pl.hp + 50);
        pk.respawnT = 75;
        G.Audio.play("pickup");
        w.toast("Baozi vapeur : +50 PV");
        break;
      case "armor":
        if (pl.armor >= 100) return;
        pl.armor = Math.min(100, pl.armor + 50);
        pk.respawnT = 120;
        G.Audio.play("pickup");
        w.toast("Gilet : +50 armure");
        break;
      case "cash":
        w.giveMoney(pk.amount || 30);
        G.Audio.play("cash");
        break;
      case "bat":
        pl.weapons.bat = true;
        if (WEAPONS[pl.weapon].melee) pl.weapon = "bat";
        G.Audio.play("pickup");
        w.toast("Batte ramassée (touche 2)");
        break;
      case "pistol":
        pl.weapons.pistol = true;
        pl.ammo.pistol += 30;
        pl.weapon = "pistol";
        G.Audio.play("pickup");
        w.toast("Pistolet 9 mm : +30 munitions (touche 3)");
        break;
      case "smg":
        pl.weapons.smg = true;
        pl.ammo.smg += 60;
        pl.weapon = "smg";
        G.Audio.play("pickup");
        w.toast("PM « Guêpe » : +60 munitions (touche 4)");
        break;
      case "shotgun":
        pl.weapons.shotgun = true;
        pl.ammo.shotgun += 16;
        pl.weapon = "shotgun";
        G.Audio.play("pickup");
        w.toast("Fusil à pompe : +16 cartouches (touche 4)");
        break;
      case "briefcase":
        // objet de mission
        G.Audio.play("cash");
        break;
    }
    pk.taken = true;
    if (pk.kind === "cash" || pk.kind === "briefcase") pk.respawnT = 0; // unique
    if (pk.onTaken) pk.onTaken(w);
  }

  function drawPickup(ctx, pk) {
    if (pk.taken) return;
    const bob = Math.sin(pk.t * 3) * 2;
    const x = pk.x, y = pk.y + bob;
    // halo
    ctx.fillStyle = "rgba(46,230,168,0.18)";
    ctx.beginPath(); ctx.arc(pk.x, pk.y, 13 + Math.sin(pk.t * 3) * 2, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = S.INK; ctx.lineWidth = 1.4;
    switch (pk.kind) {
      case "health":
        ctx.fillStyle = "#f5f0e6";
        ctx.beginPath(); ctx.arc(x, y, 7, 0, U.TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#e58fb1";
        ctx.beginPath(); ctx.arc(x, y - 1, 3, 0, U.TAU); ctx.fill();
        break;
      case "armor":
        ctx.fillStyle = "#3b8bff";
        ctx.beginPath();
        ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y - 6); ctx.lineTo(x + 6, y + 2);
        ctx.quadraticCurveTo(x, y + 8, x - 6, y + 2);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case "cash":
        ctx.fillStyle = "#27ae60";
        ctx.fillRect(x - 8, y - 5, 16, 10);
        ctx.strokeRect(x - 8, y - 5, 16, 10);
        ctx.fillStyle = "#a9dfbf";
        ctx.beginPath(); ctx.arc(x, y, 3, 0, U.TAU); ctx.fill();
        break;
      case "bat":
        ctx.save(); ctx.translate(x, y); ctx.rotate(-0.7);
        ctx.fillStyle = "#a9805b";
        ctx.fillRect(-9, -2, 18, 4); ctx.strokeRect(-9, -2, 18, 4);
        ctx.restore();
        break;
      case "briefcase":
        ctx.fillStyle = "#8a6242";
        ctx.fillRect(x - 8, y - 6, 16, 12); ctx.strokeRect(x - 8, y - 6, 16, 12);
        ctx.fillStyle = "#ffc857";
        ctx.fillRect(x - 2, y - 2, 4, 3);
        break;
      default: { // armes à feu
        ctx.save(); ctx.translate(x, y); ctx.rotate(-0.5);
        ctx.fillStyle = "#20242c";
        const len = pk.kind === "shotgun" ? 20 : pk.kind === "smg" ? 14 : 11;
        ctx.fillRect(-len / 2, -2, len, 4); ctx.strokeRect(-len / 2, -2, len, 4);
        ctx.fillRect(-len / 2 + 2, 2, 3, 4);
        ctx.restore();
      }
    }
  }

  /* =========================================================
     PARTICULES
     ========================================================= */

  function makeParticle(type, x, y) {
    const p = { type, x, y, vx: 0, vy: 0, life: 1, maxLife: 1, size: 4 };
    switch (type) {
      case "smoke":
        p.vx = (Math.random() - 0.5) * 20; p.vy = -14 - Math.random() * 18;
        p.maxLife = p.life = 1.2 + Math.random() * 1.2; p.size = 5 + Math.random() * 7;
        break;
      case "fire":
        p.vx = (Math.random() - 0.5) * 60; p.vy = -30 - Math.random() * 50;
        p.maxLife = p.life = 0.4 + Math.random() * 0.5; p.size = 5 + Math.random() * 8;
        break;
      case "spark":
        p.vx = (Math.random() - 0.5) * 220; p.vy = (Math.random() - 0.5) * 220;
        p.maxLife = p.life = 0.25 + Math.random() * 0.2; p.size = 2;
        break;
      case "blood":
        p.vx = (Math.random() - 0.5) * 90; p.vy = (Math.random() - 0.5) * 90;
        p.maxLife = p.life = 0.35 + Math.random() * 0.3; p.size = 2.5;
        break;
      case "flash":
        p.maxLife = p.life = 0.07; p.size = 9;
        break;
      case "ring":
        p.maxLife = p.life = 0.45; p.size = 10;
        break;
      case "cashpop":
        p.vx = (Math.random() - 0.5) * 60; p.vy = -70;
        p.maxLife = p.life = 0.8; p.size = 5;
        break;
      case "debris":
        p.vx = (Math.random() - 0.5) * 340; p.vy = (Math.random() - 0.5) * 340;
        p.maxLife = p.life = 0.5 + Math.random() * 0.5; p.size = 2.5 + Math.random() * 3;
        p.spin = Math.random() * U.TAU;
        break;
    }
    return p;
  }

  function updateParticle(p, dt) {
    p.life -= dt;
    if (p.life <= 0) return false;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.type === "smoke") { p.size += 8 * dt; p.vx *= 0.98; }
    if (p.type === "ring") p.size += 340 * dt;
    if (p.type === "cashpop") p.vy += 160 * dt;
    if (p.type === "debris") { p.vx *= 0.94; p.vy *= 0.94; p.spin += dt * 9; }
    return true;
  }

  function drawParticle(ctx, p) {
    const a = U.clamp(p.life / p.maxLife, 0, 1);
    switch (p.type) {
      case "smoke":
        ctx.fillStyle = "rgba(60,60,70," + (0.35 * a) + ")";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, U.TAU); ctx.fill();
        break;
      case "fire":
        ctx.fillStyle = a > 0.5 ? "rgba(255,200,87," + a + ")" : "rgba(255,110,60," + a + ")";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, U.TAU); ctx.fill();
        break;
      case "spark":
        ctx.fillStyle = "rgba(255,220,140," + a + ")";
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
        break;
      case "blood":
        ctx.fillStyle = "rgba(160,30,40," + a + ")";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, U.TAU); ctx.fill();
        break;
      case "flash":
        ctx.fillStyle = "rgba(255,240,180,0.9)";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, U.TAU); ctx.fill();
        break;
      case "ring":
        ctx.strokeStyle = "rgba(255,200,87," + a + ")";
        ctx.lineWidth = 5 * a + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, U.TAU); ctx.stroke();
        break;
      case "cashpop":
        ctx.fillStyle = "rgba(120,220,140," + a + ")";
        ctx.fillRect(p.x - 3, p.y - 2, 6, 4);
        break;
      case "debris":
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillStyle = "rgba(30,26,34," + a + ")";
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        ctx.restore();
        break;
    }
  }

  G.Ent = {
    WEAPONS, WEAPON_ORDER,
    makePed, updatePed, drawPedEntity, pedTakeDamage, pedKnock,
    makePlayer, playerUpdate, drawPlayer, hurtPlayer, exitVehicle, enterVehicle,
    makeVehicle, updateVehicle, drawVehicle, vehicleSpeed, damageVehicle, explodeVehicle,
    makeBullet, updateBullet, drawBullet,
    makePickup, updatePickup, drawPickup,
    makeParticle, updateParticle, drawParticle
  };

})(window.G);
