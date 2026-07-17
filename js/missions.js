/* ============================================================
   JADE HARBOR — missions.js
   Framework de missions à étapes + les trois missions du
   prologue (tutoriel scénarisé) : déplacement/combat,
   conduite/police, armes/fusillade/fuite.
   ============================================================ */
"use strict";
(function (G) {

  const U = G.U;
  const T = 48;

  /* =========================================================
     DÉFINITION DES MISSIONS
     ========================================================= */

  const JIN = (t) => ({ who: "jin", name: "Jin", text: t });
  const WU = (t) => ({ who: "wu", name: "Oncle Wu", text: t });
  const SHARK = (t) => ({ who: "shark", name: "Requin du Port", text: t });
  const LONG = (t) => ({ who: "lotus", name: "Long, le mécano", text: t });

  const MISSIONS = [
    /* -------------------------------------------------------
       MISSION 1 — Bienvenue à Jade Harbor
       Tutoriel : déplacement, sprint, GPS, combat au corps à corps
       ------------------------------------------------------- */
    {
      id: "m1",
      title: "Bienvenue à Jade Harbor",
      giverKey: "debarcadere",
      reward: 100,
      steps: [
        { type: "dlg", lines: [
          WU("Jin ! Par ici, petit. Alors c'est toi, le fils de ma sœur… La traversée n'a pas été trop dure ?"),
          JIN("Oncle Wu. Douze heures de ferry avec des caisses de poisson. J'ai connu mieux."),
          WU("Ha ! Bienvenue à Jade Harbor. Ici, tout s'achète, tout se vend — surtout les ennuis. Mon salon de thé est de l'autre côté du canal, dans le Quartier du Lotus."),
          WU("Je rentre préparer le thé. Rejoins-moi là-bas, la marche te remettra les jambes en place. Et ouvre l'œil : les Requins du Port n'aiment pas les nouveaux visages.")
        ]},
        { type: "tuto", text: "Déplace-toi avec Z Q S D (ou W A S D / flèches). Maintiens Maj pour sprinter." },
        { type: "goto", pos: [60, 118.5], r: 60, text: "Remonte la jetée jusqu'aux Docks de Fer" },
        { type: "tuto", text: "Suis le trait VERT sur la minimap : c'est ton GPS. Le point doré est ta destination. Appuie sur C pour la grande carte." },
        { type: "goto", pos: [65, 87], r: 120, text: "Traverse le pont du canal vers le nord" },
        { type: "dlg", lines: [
          SHARK("Hé, toi ! T'es sur le territoire des Requins, le touriste. Le péage, c'est tout ce que t'as dans les poches."),
          JIN("Mauvais jour, mauvais client. Passe ton chemin."),
          SHARK("Oh, il mord ! On va voir ça.")
        ]},
        { type: "spawn", tag: "m1thugs", peds: [
          { kind: "shark", pos: [64.2, 82.5], weapon: "fist" },
          { kind: "shark", pos: [66.3, 82.2], weapon: "fist" }
        ]},
        { type: "tuto", text: "Combat : appuie sur ESPACE (ou clic) pour frapper. Jin se tourne automatiquement vers l'ennemi le plus proche." },
        { type: "kill", tag: "m1thugs", text: "Défends-toi contre les Requins du Port !" },
        { type: "pickup", kind: "bat", pos: [65.2, 82.5], text: "Ramasse la batte qu'ils ont laissée tomber" },
        { type: "toast", text: "La batte fait bien plus mal que les poings. Touche 2 pour la sortir." },
        { type: "goto", pos: [68.5, 61.2], r: 46, text: "Rejoins le salon de thé de l'oncle Wu" },
        { type: "dlg", lines: [
          WU("Te voilà ! On m'a déjà raconté ta petite danse sur le pont. Deux Requins au tapis… ta mère serait fière, ou horrifiée."),
          JIN("Ils ont commencé. C'est quoi le problème de ce gang ?"),
          WU("Les Requins veulent le monopole du port : la contrebande, le racket, tout. Et mon petit commerce de thé les… agace. Repose-toi. Demain, tu travailles pour moi."),
          JIN("Travailler ? Je viens d'arriver."),
          WU("Justement. Personne ne connaît encore ton visage. C'est une monnaie rare, ici.")
        ]}
      ]
    },

    /* -------------------------------------------------------
       MISSION 2 — Les Caisses de l'Oncle
       Tutoriel : véhicules, conduite, timer, police, semer les flics
       ------------------------------------------------------- */
    {
      id: "m2",
      title: "Les Caisses de l'Oncle",
      giverKey: "teahouse",
      reward: 250,
      steps: [
        { type: "dlg", lines: [
          WU("Jin ! Parfait. Un chalutier a déposé mes caisses de « thé » à l'entrepôt 7, au port. Il me les faut avant le service du soir."),
          JIN("Du thé. Dans des caisses plombées. Livrées de nuit par un chalutier."),
          WU("Du thé TRÈS rare. Prends une voiture — celle que tu veux, hmm, disons celle que personne ne regarde — et ramène-les-moi. Vite et SANS bosses."),
          JIN("Je n'ai pas de voiture, oncle Wu."),
          WU("Et alors ? Cette ville en est pleine.")
        ]},
        { type: "tuto", text: "Approche-toi d'une voiture et appuie sur E pour monter. Haut = accélérer, bas = freiner/reculer, ESPACE = frein à main. K = klaxon." },
        { type: "getVehicle", text: "Trouve un véhicule (E pour monter)" },
        { type: "goto", pos: [74, 97.5], r: 80, text: "File à l'entrepôt 7, au sud du canal", vehicle: true },
        { type: "wait", t: 2.5, text: "Chargement des caisses…" },
        { type: "loadCargo" },
        { type: "dlg", lines: [
          JIN("C'est bon, tout est dans le coffre… Attends. Le flic, là-bas — il note ma plaque ?!"),
          WU("(radio) Ne traîne pas, petit. La police du port adore fouiller les coffres. Ramène-moi ce thé avant qu'il refroidisse !")
        ]},
        { type: "wanted", n: 1 },
        { type: "timer", t: 110 },
        { type: "tuto", text: "Tu es RECHERCHÉ (étoiles en haut à droite). Hors de leur vue, les étoiles clignotent puis disparaissent. Détruire une voiture de patrouille fait aussi baisser la pression." },
        { type: "goto", pos: [68.5, 64.5], r: 70, text: "Livre les caisses au salon de thé — sans détruire la voiture !", vehicle: true, needCargo: true },
        { type: "timerOff" },
        { type: "escape", text: "Sème la police avant de décharger les caisses" },
        { type: "dlg", lines: [
          WU("Ha ! Les caisses ! Et la voiture tient encore debout. Tu es plus doué que ton oncle Fei — lui avait noyé la sienne dans le canal."),
          JIN("Le « thé » cliquette bizarrement, oncle Wu."),
          WU("Les feuilles de qualité sont... croustillantes. Tiens, ta part. Et lave-toi les mains avant le dîner.")
        ]}
      ]
    },

    /* -------------------------------------------------------
       MISSION 3 — La Morsure du Requin
       Tutoriel : armes à feu, visée, fusillade, fuite à 2 étoiles
       ------------------------------------------------------- */
    {
      id: "m3",
      title: "La Morsure du Requin",
      giverKey: "teahouse",
      reward: 500,
      steps: [
        { type: "dlg", lines: [
          WU("Les Requins ont intercepté ma dernière cargaison. Une mallette. Elle dort dans leur « pêcherie » des Docks de Fer."),
          JIN("Et tu veux que j'aille la chercher. Chez eux. Tout seul."),
          WU("Pas tout seul : avec un cadeau. Passe voir Long au Garage de l'Ouest, il te prépare quelque chose. Jin… cette mallette vaut plus que ma boutique. Ne reviens pas sans elle."),
        ]},
        { type: "goto", pos: [29, 71.2], r: 50, text: "Va voir Long au Garage de l'Ouest" },
        { type: "dlg", lines: [
          LONG("Alors c'est toi, le neveu. Wu m'a dit : « équipe-le ». Tiens — un 9 mm propre, jamais servi. Enfin, presque jamais."),
          JIN("Un flingue. On parle toujours de thé, là ?"),
          LONG("À Jade Harbor, tout le monde parle de thé. Bon : montre-moi que tu sais t'en servir avant d'aller mordre des Requins. J'ai posé trois mannequins derrière le garage.")
        ]},
        { type: "give", weapon: "pistol", ammo: 45 },
        { type: "tuto", text: "Tir : ESPACE = visée automatique sur l'ennemi le plus proche. CLIC GAUCHE = tir vers la souris. Touches 1-4 ou Tab pour changer d'arme." },
        { type: "spawn", tag: "m3targets", peds: [
          { kind: "shark", pos: [33.5, 71.5], dummy: true },
          { kind: "shark", pos: [34.5, 69.8], dummy: true },
          { kind: "shark", pos: [33.8, 68.2], dummy: true }
        ]},
        { type: "kill", tag: "m3targets", text: "Entraîne-toi sur les mannequins de Long" },
        { type: "dlg", lines: [
          LONG("Pas mal, gamin. Dernier conseil : les Requins, eux, répliquent. Bouge tout le temps, et garde un œil sur ta jauge de vie."),
          JIN("La pêcherie Wang, c'est ça ? Au sud du canal."),
          LONG("C'est ça. Fais-leur goûter le thé de ton oncle.")
        ]},
        { type: "goto", pos: [44.5, 96.6], r: 80, text: "Rends-toi à la pêcherie Wang, la planque des Requins" },
        { type: "dlg", lines: [
          SHARK("Le touriste du pont ! T'as perdu ton chemin, ou tu cherches ta deuxième raclée ?"),
          JIN("Je viens pour la mallette. Vous pouvez me la donner gentiment…"),
          SHARK("LES GARS ! ON A DE LA VISITE !")
        ]},
        { type: "spawn", tag: "m3sharks", peds: [
          { kind: "shark", pos: [42, 98.5], weapon: "pistol" },
          { kind: "shark", pos: [47, 98.3], weapon: "fist" },
          { kind: "shark", pos: [38.6, 102.5], weapon: "bat" },
          { kind: "shark", pos: [49.4, 103.8], weapon: "pistol" },
          { kind: "shark", pos: [44.5, 106.9], weapon: "fist" }
        ]},
        { type: "kill", tag: "m3sharks", text: "Élimine les Requins du Port !" },
        { type: "pickup", kind: "briefcase", pos: [44.5, 106.8], text: "Récupère la mallette de Wu" },
        { type: "dlg", lines: [
          JIN("La mallette… lourde, en plus. Évidemment, il y a des sirènes. Il y a TOUJOURS des sirènes."),
          WU("(radio) La fusillade s'entend depuis mon comptoir, Jin ! La police arrive — DISPARAIS. Et la mallette reste SÈCHE, compris ?")
        ]},
        { type: "wanted", n: 2 },
        { type: "tuto", text: "2 étoiles : les patrouilles te cherchent activement. Prends une voiture, casse la ligne de vue, et laisse les étoiles s'éteindre — ou percute leurs voitures jusqu'à l'épave." },
        { type: "escape", text: "Sème la police !" },
        { type: "goto", pos: [68.5, 61.2], r: 46, text: "Rapporte la mallette au salon de thé" },
        { type: "dlg", lines: [
          WU("Ma mallette ! Intacte ! Petit, tu viens de rembourser dix ans de cadeaux d'anniversaire oubliés."),
          JIN("Les Requins ne vont pas en rester là, oncle Wu. J'ai vu leur regard. C'était pas du thé non plus, dans leurs caisses."),
          WU("Non… La guerre du port ne fait que commencer. Repose-toi, Jin. Jade Harbor est à toi ce soir : explore, roule, respire. Le Lotus Noir te contactera quand il sera l'heure."),
          JIN("Le Lotus Noir ? C'est qui, le Lotus Noir ?"),
          WU("… Bois ton thé, Jin.")
        ]}
      ]
    }
  ];

  /* =========================================================
     MOTEUR DE MISSION
     ========================================================= */

  const Ms = {
    completed: {},
    active: null,        // définition de la mission en cours
    stepI: 0,
    timer: -1,
    data: {},            // cargo, pickups de mission…
    waitT: 0,
    allDone: false,
    armed: true          // faux après une fin de mission : il faut s'éloigner du marqueur
  };

  function giverPos(m) {
    const p = G.Map.POI[m.giverKey];
    return { x: p.x, y: p.y };
  }

  // prochaine mission disponible (progression linéaire)
  function nextMission() {
    for (const m of MISSIONS) if (!Ms.completed[m.id]) return m;
    return null;
  }

  function start(w, m) {
    Ms.active = m;
    Ms.stepI = -1;
    Ms.timer = -1;
    Ms.data = {};
    G.HUD.showBanner(m.title, "#ffc857", "— Mission —", 3);
    advance(w);
  }

  function advance(w) {
    const m = Ms.active;
    Ms.stepI++;
    G.HUD.setMarker(null);
    if (Ms.stepI >= m.steps.length) {
      complete(w);
      return;
    }
    enterStep(w, m.steps[Ms.stepI]);
  }

  function enterStep(w, st) {
    switch (st.type) {
      case "dlg":
        G.HUD.setObjective(null);
        G.HUD.startDialogue(st.lines, () => advance(w));
        break;
      case "tuto":
        G.HUD.tutorial(st.text, 9);
        advance(w);
        break;
      case "toast":
        G.HUD.toast(st.text, 5);
        advance(w);
        break;
      case "goto":
        G.HUD.setObjective(st.text);
        G.HUD.setMarker({ x: st.pos[0] * T, y: st.pos[1] * T });
        break;
      case "getVehicle":
        G.HUD.setObjective(st.text);
        break;
      case "wait":
        Ms.waitT = st.t;
        if (st.text) G.HUD.setObjective(st.text);
        break;
      case "loadCargo":
        Ms.data.cargo = w.player.vehicle || null;
        if (Ms.data.cargo) Ms.data.cargo.missionTag = "cargo";
        advance(w);
        break;
      case "spawn":
        for (const pd of st.peds) {
          w.spawnMissionPed(pd.kind, pd.pos[0] * T, pd.pos[1] * T, {
            tag: st.tag, weapon: pd.weapon || "fist", dummy: !!pd.dummy
          });
        }
        advance(w);
        break;
      case "kill":
        G.HUD.setObjective(st.text);
        break;
      case "pickup": {
        G.HUD.setObjective(st.text);
        G.HUD.setMarker({ x: st.pos[0] * T, y: st.pos[1] * T });
        const pk = G.Ent.makePickup(st.kind, st.pos[0] * T, st.pos[1] * T);
        pk.missionTag = "mstep";
        pk.onTaken = () => { Ms.data.pickupDone = true; };
        Ms.data.pickupDone = false;
        w.pickups.push(pk);
        break;
      }
      case "give": {
        const pl = w.player;
        pl.weapons[st.weapon] = true;
        pl.ammo[st.weapon] = (pl.ammo[st.weapon] || 0) + st.ammo;
        pl.weapon = st.weapon;
        G.Audio.play("pickup");
        advance(w);
        break;
      }
      case "wanted":
        w.setWanted(st.n);
        advance(w);
        break;
      case "timer":
        Ms.timer = st.t;
        advance(w);
        break;
      case "timerOff":
        Ms.timer = -1;
        G.HUD.setTimer(-1);
        advance(w);
        break;
      case "escape":
        G.HUD.setObjective(st.text);
        break;
    }
  }

  function update(w, dt) {
    // marqueur de départ de mission (hors mission)
    if (!Ms.active) {
      const m = nextMission();
      if (m && !G.HUD.dialogueActive) {
        const gp = giverPos(m);
        G.HUD.setMarker(gp);
        G.HUD.setObjective("Rejoins le marqueur de mission : « " + m.title + " »");
        const pl = w.player;
        const d = U.dist(pl.x, pl.y, gp.x, gp.y);
        if (!Ms.armed) {
          if (d > 90) Ms.armed = true; // il faut d'abord quitter le marqueur
        } else if (!pl.vehicle && d < 34) {
          start(w, m);
        }
      } else if (!m) {
        if (!Ms.allDone) {
          Ms.allDone = true;
          G.HUD.setMarker(null);
          G.HUD.setObjective(null);
          G.HUD.showBanner("À SUIVRE…", "#2ee6a8", "Jade Harbor est à toi : explore l'île, la suite au prochain épisode.", 6);
          w.save();
        }
      }
      return;
    }

    // timer
    if (Ms.timer > 0) {
      Ms.timer -= dt;
      G.HUD.setTimer(Ms.timer);
      if (Ms.timer <= 0) {
        fail(w, "Le thé a refroidi… livraison ratée.");
        return;
      }
    } else {
      G.HUD.setTimer(-1);
    }

    // cargaison détruite ?
    if (Ms.data.cargo && Ms.data.cargo.wreck) {
      fail(w, "Les caisses sont parties en fumée avec la voiture !");
      return;
    }

    const st = Ms.active.steps[Ms.stepI];
    if (!st) return;
    const pl = w.player;

    switch (st.type) {
      case "goto": {
        const tx = st.pos[0] * T, ty = st.pos[1] * T;
        // gestion cargo : il faut être dans LA voiture chargée
        if (st.needCargo && Ms.data.cargo && pl.vehicle !== Ms.data.cargo) {
          G.HUD.setObjective("Remonte dans la voiture chargée !");
          G.HUD.setMarker({ x: Ms.data.cargo.x, y: Ms.data.cargo.y });
          return;
        }
        if (st.vehicle && !pl.vehicle) {
          G.HUD.setObjective("Il te faut un véhicule ! (E pour monter)");
          return;
        }
        G.HUD.setObjective(st.text);
        G.HUD.setMarker({ x: tx, y: ty });
        if (U.dist(pl.x, pl.y, tx, ty) < st.r) advance(w);
        break;
      }
      case "getVehicle":
        if (pl.vehicle) advance(w);
        break;
      case "wait":
        Ms.waitT -= dt;
        if (Ms.waitT <= 0) advance(w);
        break;
      case "kill":
        if (w.countMissionPeds(st.tag) === 0) advance(w);
        break;
      case "pickup":
        if (Ms.data.pickupDone) advance(w);
        break;
      case "escape":
        if (w.wanted.level <= 0) advance(w);
        break;
    }
  }

  function complete(w) {
    const m = Ms.active;
    Ms.completed[m.id] = true;
    Ms.active = null;
    Ms.timer = -1;
    if (Ms.data.cargo) { Ms.data.cargo.missionTag = null; Ms.data.cargo = null; }
    G.HUD.setTimer(-1);
    G.HUD.setObjective(null);
    G.HUD.setMarker(null);
    G.HUD.showBanner("MISSION ACCOMPLIE", "#2ee6a8", "+" + m.reward + " $", 4);
    G.Audio.play("jingleWin");
    w.giveMoney(m.reward);
    Ms.armed = false;
    w.save();
  }

  function fail(w, reason) {
    if (!Ms.active) return;
    Ms.active = null;
    Ms.timer = -1;
    Ms.data.cargo = null;
    G.HUD.setTimer(-1);
    G.HUD.setObjective(null);
    G.HUD.setMarker(null);
    G.HUD.showBanner("MISSION ÉCHOUÉE", "#ff5340", reason, 4);
    G.Audio.play("jingleFail");
    Ms.armed = false;
    w.clearMissionPeds();
  }

  // le joueur est mort / arrêté pendant une mission
  function onPlayerDown(w, reason) {
    if (Ms.active) fail(w, reason);
  }

  function drawWorldMarkers(ctx, w) {
    // disque doré pulsant au point de départ de mission
    if (!Ms.active) {
      const m = nextMission();
      if (!m) return;
      const gp = giverPos(m);
      drawDisc(ctx, w, gp.x, gp.y, "#ffc857");
    } else if (G.HUD.markerPos) {
      drawDisc(ctx, w, G.HUD.markerPos.x, G.HUD.markerPos.y, "#2ee6a8");
    }
  }

  function drawDisc(ctx, w, x, y, color) {
    const t = w.time;
    const r = 20 + Math.sin(t * 3) * 3;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, U.TAU); ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, U.TAU); ctx.fill();
    // chevron flottant
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = color;
    const bob = Math.sin(t * 4) * 4;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 34 + bob);
    ctx.lineTo(x + 8, y - 34 + bob);
    ctx.lineTo(x, y - 22 + bob);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* ---------- sauvegarde ---------- */

  function serialize() {
    return { completed: Ms.completed, allDone: Ms.allDone };
  }
  function deserialize(d) {
    if (!d) return;
    Ms.completed = d.completed || {};
    Ms.allDone = !!d.allDone;
  }

  G.Missions = {
    MISSIONS, state: Ms,
    update, fail, onPlayerDown,
    drawWorldMarkers,
    serialize, deserialize,
    get activeMission() { return Ms.active; },
    nextMission
  };

})(window.G);
