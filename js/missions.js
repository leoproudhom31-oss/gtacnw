/* ============================================================
   JADE HARBOR — missions.js (v2)
   Moteur de missions à étapes : points de contrôle (reprise
   sans échec total), médailles or/argent/bronze, objectifs
   bonus, filature, escorte, destruction d'objectifs, routes
   scriptées, rejouabilité. Cinq missions scénarisées.
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
  const RADIO = (t) => ({ who: "wu", name: "Wu (radio)", text: t });
  const SHARK = (t) => ({ who: "shark", name: "Requin du Port", text: t });
  const LONG = (t) => ({ who: "lotus", name: "Long, le mécano", text: t });

  const MISSIONS = [
    /* -------------------------------------------------------
       MISSION 1 — Bienvenue à Jade Harbor
       ------------------------------------------------------- */
    {
      id: "m1",
      title: "Bienvenue à Jade Harbor",
      giverKey: "debarcadere",
      reward: 100,
      gold: 150, silver: 250,
      bonuses: [
        { id: "b1", text: "Sans une égratignure", reward: 75, check: (w, Ms) => Ms.damage < 1 }
      ],
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
        { type: "checkpoint" },
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
       ------------------------------------------------------- */
    {
      id: "m2",
      title: "Les Caisses de l'Oncle",
      giverKey: "teahouse",
      reward: 250,
      gold: 170, silver: 280,
      bonuses: [
        { id: "b1", text: "Livraison éclair (moins de 2:30)", reward: 100, check: (w, Ms) => (w.time - Ms.startTime) <= 150 },
        { id: "b2", text: "Sans une égratignure", reward: 75, check: (w, Ms) => Ms.damage < 1 }
      ],
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
        { type: "checkpoint" },
        { type: "dlg", lines: [
          JIN("C'est bon, tout est dans le coffre… Attends. Le flic, là-bas — il note ma plaque ?!"),
          RADIO("Ne traîne pas, petit. La police du port adore fouiller les coffres. Ramène-moi ce thé avant qu'il refroidisse !")
        ]},
        { type: "wanted", n: 1 },
        { type: "timer", t: 110 },
        { type: "tuto", text: "Tu es RECHERCHÉ (étoiles en haut à droite). Hors de leur vue, les étoiles clignotent puis disparaissent. Neutraliser une patrouille toi-même fait aussi baisser la pression." },
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
       ------------------------------------------------------- */
    {
      id: "m3",
      title: "La Morsure du Requin",
      giverKey: "teahouse",
      reward: 500,
      gold: 220, silver: 340,
      bonuses: [
        { id: "b1", text: "Chirurgical (moins de 100 dégâts subis)", reward: 150, check: (w, Ms) => Ms.damage < 100 },
        { id: "b2", text: "Rafle express (moins de 3:00)", reward: 100, check: (w, Ms) => (w.time - Ms.startTime) <= 180 }
      ],
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
        { type: "checkpoint" },
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
          RADIO("La fusillade s'entend depuis mon comptoir, Jin ! La police arrive — DISPARAIS. Et la mallette reste SÈCHE, compris ?")
        ]},
        { type: "wanted", n: 2 },
        { type: "tuto", text: "2 étoiles : les patrouilles te cherchent activement. Prends une voiture, casse la ligne de vue, et laisse les étoiles s'éteindre." },
        { type: "escape", text: "Sème la police !" },
        { type: "goto", pos: [68.5, 61.2], r: 46, text: "Rapporte la mallette au salon de thé" },
        { type: "dlg", lines: [
          WU("Ma mallette ! Intacte ! Petit, tu viens de rembourser dix ans de cadeaux d'anniversaire oubliés."),
          JIN("Les Requins ne vont pas en rester là, oncle Wu. J'ai vu leur regard."),
          WU("Non… La guerre du port ne fait que commencer. Va voir Long : il paraît qu'un van des Requins fait des allers-retours suspects depuis ce matin.")
        ]}
      ]
    },

    /* -------------------------------------------------------
       MISSION 4 — L'Ombre du Requin  (filature)
       ------------------------------------------------------- */
    {
      id: "m4",
      title: "L'Ombre du Requin",
      giverKey: "garage",
      reward: 400,
      gold: 260, silver: 400,
      bonuses: [
        { id: "b1", text: "Fantôme : jamais inquiété", reward: 150, check: (w, Ms) => !Ms.data.flags.closeCall },
        { id: "b2", text: "Démolition totale (moins de 4:00)", reward: 100, check: (w, Ms) => (w.time - Ms.startTime) <= 240 }
      ],
      steps: [
        { type: "dlg", lines: [
          LONG("Wu t'a briefé ? Un van des Requins tourne depuis ce matin : chargement au canal, déchargement… mystère. Personne ne sait où."),
          JIN("Donc je le suis, et le mystère devient une adresse."),
          LONG("Exactement. Mais ces types sont nerveux : colle-le de trop près et ça finira en fusillade. Perds-le, et on attendra un mois la prochaine navette."),
          LONG("Trouve une caisse banale et poste-toi près du canal, rive nord. Le van ne va pas tarder.")
        ]},
        { type: "getVehicle", text: "Trouve un véhicule banal (E pour monter)" },
        { type: "goto", pos: [17, 79], r: 140, text: "Poste-toi près du canal, rive nord-ouest", vehicle: true },
        { type: "checkpoint" },
        { type: "spawnRoute", id: "sharkvan", vtype: "van", color: "#158fa0",
          from: [14, 78.5], to: [107, 97.5], cruise: 105, tag: "m4van" },
        { type: "dlg", lines: [
          JIN("Un van bleu lagon, des caisses qui débordent… c'est lui. Allez, mon grand, montre-moi ta cachette."),
          LONG("(radio) Reste à distance : s'il te repère, tout tombe à l'eau. S'il sort de ton champ de vision trop longtemps, pareil.")
        ]},
        { type: "tail", id: "sharkvan", minD: 120, maxD: 460,
          text: "File le van des Requins — ni trop près, ni trop loin" },
        { type: "checkpoint" },
        { type: "dlg", lines: [
          JIN("Un dépôt planqué derrière les grues de l'est… Long, tu notes ? Je passe en phase deux."),
          LONG("(radio) Phase deux ? Il n'y a pas de… Jin. JIN. Qu'est-ce que tu appelles « phase deux » ?"),
          JIN("La partie où leur stock devient un feu de camp.")
        ]},
        { type: "spawnTargets", tag: "m4crates", vehicles: [
          { type: "van", pos: [103, 100.5], angle: 0, color: "#158fa0" },
          { type: "van", pos: [105.5, 103.5], angle: 1.2, color: "#0d7885" },
          { type: "van", pos: [101, 105.5], angle: 0.5, color: "#158fa0" }
        ]},
        { type: "spawn", tag: "m4guards", peds: [
          { kind: "shark", pos: [100, 99.5], weapon: "pistol" },
          { kind: "shark", pos: [106.5, 101.5], weapon: "bat" },
          { kind: "shark", pos: [103, 107], weapon: "pistol" }
        ]},
        { type: "destroy", tag: "m4crates", text: "Détruis les trois vans de contrebande !" },
        { type: "escape", text: "Quitte la zone et fais-toi oublier" },
        { type: "goto", pos: [29, 71.2], r: 50, text: "Retourne au Garage de l'Ouest" },
        { type: "dlg", lines: [
          LONG("Trois vans, un dépôt grillé et une colonne de fumée visible depuis mon comptoir. Discret, le neveu."),
          JIN("La filature était discrète. La suite était… expressive."),
          LONG("Wu va adorer. Les Requins vont pleurer leurs caisses pendant des semaines. Tiens, ta part — et ne raye pas ma clé à molette en sortant.")
        ]}
      ]
    },

    /* -------------------------------------------------------
       MISSION 5 — Le Convoi du Lotus  (escorte)
       ------------------------------------------------------- */
    {
      id: "m5",
      title: "Le Convoi du Lotus",
      giverKey: "teahouse",
      reward: 600,
      gold: 240, silver: 360,
      bonuses: [
        { id: "b1", text: "Convoi intact (van au-dessus de 60 %)", reward: 200,
          check: (w, Ms) => { const v = Ms.data.veh.wuvan; return v && !v.wreck && v.hp / v.maxHp >= 0.6; } },
        { id: "b2", text: "Garde du corps (moins de 150 dégâts subis)", reward: 100, check: (w, Ms) => Ms.damage < 150 }
      ],
      steps: [
        { type: "dlg", lines: [
          WU("C'est l'heure, Jin. La mallette quitte l'île ce soir : un bateau attend à la Jetée du Départ. Mon van part dans une minute."),
          JIN("Et les Requins le savent déjà, c'est ça ?"),
          WU("Après ton feu de camp d'hier ? Ils surveillent chaque rue. C'est pourquoi TU roules à côté du van. Rien ne doit l'arrêter."),
          WU("Prends une voiture, ouvre l'œil, et ramène-moi mon chauffeur vivant. C'est mon meilleur serveur de thé.")
        ]},
        { type: "getVehicle", text: "Trouve un véhicule pour escorter le van (E pour monter)" },
        { type: "checkpoint" },
        { type: "spawnRoute", id: "wuvan", vtype: "van", color: "#6d6875",
          from: [68, 64.5], to: [60, 118.5], cruise: 82, escort: true, hp: 300, tag: "m5van" },
        { type: "dlg", lines: [
          RADIO("Le van démarre, Jin. Reste à portée : s'il te distance, il t'attendra — mais les Requins, eux, n'attendront pas.")
        ]},
        { type: "escort", id: "wuvan", text: "Escorte le van de Wu jusqu'à la Jetée du Départ !",
          waves: [
            { frac: 0.25, cars: 1, peds: 0 },
            { frac: 0.55, cars: 1, peds: 2 },
            { frac: 0.85, cars: 2, peds: 0 }
          ] },
        { type: "checkpoint" },
        { type: "dlg", lines: [
          JIN("Le van est à quai. Mais ces bateaux-là n'aiment pas partir sans comité d'adieu…"),
          SHARK("LE VOILÀ ! La mallette est sur la jetée — TOUS SUR EUX !")
        ]},
        { type: "spawn", tag: "m5finale", peds: [
          { kind: "shark", pos: [57, 119.5], weapon: "pistol" },
          { kind: "shark", pos: [63, 119.8], weapon: "smg" },
          { kind: "shark", pos: [59, 117.5], weapon: "bat" },
          { kind: "shark", pos: [61.5, 121.5], weapon: "pistol" }
        ]},
        { type: "kill", tag: "m5finale", text: "Repousse l'assaut final des Requins !" },
        { type: "escape", text: "Le bateau largue les amarres — fais le mort quelques instants" },
        { type: "goto", pos: [68.5, 61.2], r: 46, text: "Retourne fêter ça au salon de thé" },
        { type: "give", weapon: "shotgun", ammo: 16 },
        { type: "dlg", lines: [
          WU("Le bateau est parti, la mallette avec, et mon serveur me réclame une prime de risque. Une excellente soirée."),
          JIN("Les Requins ont perdu leur dépôt, leur cargaison et leur réputation en deux jours. Ils vont vouloir une revanche."),
          WU("Et nous serons prêts. Tiens : le fusil de mon père. Il disait qu'on ne le sort que pour la famille. Bienvenue dans la famille, Jin."),
          JIN("… Merci, oncle Wu. Alors, c'est quoi la suite ?"),
          WU("La suite ? Le Lotus Noir se réveille, petit. Mais ça… c'est pour le prochain chapitre.")
        ]}
      ]
    }
  ];

  const MEDALS = [null,
    { name: "Bronze", label: "Médaille de Bronze", color: "#c9825e" },
    { name: "Argent", label: "Médaille d'Argent", color: "#c9d4d8" },
    { name: "Or",     label: "Médaille d'Or",     color: "#ffc857" }];

  /* =========================================================
     MOTEUR DE MISSION
     ========================================================= */

  const Ms = {
    completed: {},
    medals: {},          // id -> rang 1..3 (meilleur)
    active: null,
    stepI: 0,
    timer: -1,
    data: {},            // cargo, veh{}, flags{}, compteurs…
    waitT: 0,
    allDone: false,
    armed: true,
    // notation de la tentative en cours
    startTime: 0,
    damage: 0,
    deaths: 0,
    replaying: false,
    // point de contrôle
    checkpointI: -1,
    checkpointPos: null
  };

  function giverPos(m) {
    const p = G.Map.POI[m.giverKey];
    return { x: p.x, y: p.y };
  }

  function nextMission() {
    for (const m of MISSIONS) if (!Ms.completed[m.id]) return m;
    return null;
  }

  function missionIndex(m) { return MISSIONS.indexOf(m); }

  function start(w, m, replaying) {
    Ms.active = m;
    Ms.stepI = -1;
    Ms.timer = -1;
    Ms.data = { veh: {}, flags: {} };
    Ms.startTime = w.time;
    Ms.damage = 0;
    Ms.deaths = 0;
    Ms.replaying = !!replaying;
    Ms.checkpointI = -1;
    Ms.checkpointPos = null;
    G.HUD.setAux(null);
    G.HUD.showBanner(m.title, "#ffc857",
      "— Mission " + (missionIndex(m) + 1) + "/" + MISSIONS.length + (replaying ? " · Rejouée" : "") + " —", 3);
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
      case "checkpoint":
        Ms.checkpointI = Ms.stepI;
        Ms.checkpointPos = { x: w.player.x, y: w.player.y };
        G.HUD.toast("◆ Point de contrôle", 2.5);
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

      /* ----- nouveaux types v2 ----- */
      case "spawnRoute": {
        const from = { x: st.from[0] * T, y: st.from[1] * T };
        const to = { x: st.to[0] * T, y: st.to[1] * T };
        let wps = G.Map.findRoadPath(from.x, from.y, to.x, to.y);
        if (!wps || wps.length < 2) wps = [from, to];
        const v = G.Ent.makeVehicle(st.vtype, wps[0].x, wps[0].y,
          Math.atan2(wps[1].y - wps[0].y, wps[1].x - wps[0].x), st.color);
        v.ai = { mode: "route", wps, wpi: 1, cruise: st.cruise || 95,
                 escort: !!st.escort, blockedT: 0, done: false };
        v.driverKind = "shark";
        v.missionTag = st.tag || st.id;
        if (st.hp) { v.hp = st.hp; v.maxHp = st.hp; }
        w.vehicles.push(v);
        Ms.data.veh[st.id] = v;
        advance(w);
        break;
      }
      case "tail":
        G.HUD.setObjective(st.text);
        Ms.data.tailClose = 0;
        Ms.data.tailFar = 0;
        break;
      case "escort":
        G.HUD.setObjective(st.text);
        for (const wv of st.waves) wv.done = false;
        break;
      case "spawnTargets": {
        for (const sv of st.vehicles) {
          const v = G.Ent.makeVehicle(sv.type, sv.pos[0] * T, sv.pos[1] * T, sv.angle || 0, sv.color);
          v.missionTag = st.tag;
          w.vehicles.push(v);
        }
        advance(w);
        break;
      }
      case "destroy":
        G.HUD.setObjective(st.text);
        break;
    }
  }

  function update(w, dt) {
    if (!Ms.active) {
      idleUpdate(w);
      return;
    }

    // timer de mission
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

      /* ----- v2 ----- */
      case "tail": {
        const v = Ms.data.veh[st.id];
        if (!v || v.wreck) { fail(w, "Le van des Requins a été détruit — la piste est morte."); return; }
        G.HUD.setMarker({ x: v.x, y: v.y });
        if (v.ai && v.ai.done) { G.HUD.setAux(null); advance(w); return; }
        const d = U.dist(pl.x, pl.y, v.x, v.y);
        if (d < st.minD) {
          Ms.data.tailClose += dt;
          Ms.data.flags.closeCall = true;
          G.HUD.setAux("⚠ TROP PRÈS ! Recule ! (" + Math.max(0, 3 - Ms.data.tailClose).toFixed(1) + " s)");
          if (Ms.data.tailClose > 3) { fail(w, "Les Requins t'ont repéré dans le rétro !"); return; }
        } else if (d > st.maxD) {
          Ms.data.tailFar += dt;
          if (Ms.data.tailFar > 2) Ms.data.flags.closeCall = true;
          G.HUD.setAux("⚠ Tu vas le perdre… (" + Math.max(0, 9 - Ms.data.tailFar).toFixed(0) + " s)");
          if (Ms.data.tailFar > 9) { fail(w, "Tu as perdu le van dans la circulation."); return; }
        } else {
          Ms.data.tailClose = Math.max(0, Ms.data.tailClose - dt * 1.5);
          Ms.data.tailFar = 0;
          G.HUD.setAux("Distance de filature : bonne — reste discret");
        }
        break;
      }
      case "escort": {
        const v = Ms.data.veh[st.id];
        if (!v || v.wreck) { fail(w, "Le van de Wu est détruit ! La mallette est perdue."); return; }
        G.HUD.setMarker({ x: v.x, y: v.y });
        const pct = Math.max(0, Math.round(v.hp / v.maxHp * 100));
        G.HUD.setAux((v.ai && v.ai.waiting ? "Le van t'attend — rapproche-toi · " : "") +
                     "Van de Wu : " + pct + " %");
        // vagues d'assaut selon la progression de la route
        const prog = v.ai ? v.ai.wpi / v.ai.wps.length : 0;
        for (const wv of st.waves) {
          if (wv.done || prog < wv.frac) continue;
          wv.done = true;
          spawnEscortWave(w, v, wv);
        }
        if (v.ai && v.ai.done) { G.HUD.setAux(null); advance(w); return; }
        break;
      }
      case "destroy": {
        let alive = 0, nearest = null, nd = 1e9;
        for (const v of w.vehicles) {
          if (v.missionTag !== st.tag || v.wreck) continue;
          alive++;
          const d = U.dist2(pl.x, pl.y, v.x, v.y);
          if (d < nd) { nd = d; nearest = v; }
        }
        G.HUD.setAux(alive > 0 ? "Vans restants : " + alive : null);
        if (nearest) G.HUD.setMarker({ x: nearest.x, y: nearest.y });
        if (alive === 0) { G.HUD.setAux(null); advance(w); }
        break;
      }
    }
  }

  function spawnEscortWave(w, van, wv) {
    G.Audio.play("star");
    G.HUD.toast("Les Requins attaquent le convoi !", 3);
    const a = van.angle;
    for (let i = 0; i < wv.cars; i++) {
      // surgissent devant/derrière le van, sur la route
      const side = i % 2 === 0 ? 1 : -1;
      const px = van.x + Math.cos(a) * side * 420 + (Math.random() - 0.5) * 60;
      const py = van.y + Math.sin(a) * side * 420 + (Math.random() - 0.5) * 60;
      const rt = G.Map.nearestRoadTile(px, py, 6);
      if (rt < 0) continue;
      const vx = (rt % G.Map.MW + 0.5) * T, vy = ((rt / G.Map.MW | 0) + 0.5) * T;
      const c = G.Ent.makeVehicle("sedan", vx, vy, Math.atan2(van.y - vy, van.x - vx), "#0d7885");
      c.ai = { mode: "ram", targetRef: van, blockedT: 0 };
      c.driverKind = "shark";
      c.missionTag = "m5wave";
      w.vehicles.push(c);
    }
    for (let i = 0; i < wv.peds; i++) {
      const spot = G.Map.randomSidewalk(Math.random, van.x, van.y, 160, 320);
      if (!spot) continue;
      const p = w.spawnMissionPed("shark", spot.x, spot.y, { tag: "m5wave", weapon: "pistol" });
      p.aggro = van; // ils visent le van, pas Jin
    }
  }

  function idleUpdate(w) {
    const pl = w.player;
    if (!Ms.allDone) {
      const m = nextMission();
      if (!m) {
        Ms.allDone = true;
        G.HUD.setMarker(null);
        G.HUD.setObjective(null);
        G.HUD.showBanner("À SUIVRE…", "#2ee6a8",
          "L'île est à toi. Reviens sur un marqueur pour rejouer une mission et viser l'Or.", 6);
        w.save();
        return;
      }
      if (G.HUD.dialogueActive) return;
      const gp = giverPos(m);
      G.HUD.setMarker(gp);
      G.HUD.setObjective("Rejoins le marqueur de mission : « " + m.title + " »");
      const d = U.dist(pl.x, pl.y, gp.x, gp.y);
      if (!Ms.armed) {
        if (d > 90) Ms.armed = true;
      } else if (!pl.vehicle && d < 34) {
        start(w, m);
      }
      return;
    }

    // tout est terminé : chaque marqueur permet de REJOUER sa mission
    if (G.HUD.dialogueActive) return;
    G.HUD.setMarker(null);
    let nearest = null, nd = 1e9;
    for (const m of MISSIONS) {
      const gp = giverPos(m);
      const d = U.dist(pl.x, pl.y, gp.x, gp.y);
      if (d < nd) { nd = d; nearest = m; }
    }
    if (nearest && nd < 200) {
      const rank = Ms.medals[nearest.id] || 0;
      G.HUD.setObjective("Rejouer « " + nearest.title + " »" +
        (rank ? " — meilleure médaille : " + MEDALS[rank].name : ""));
    } else {
      G.HUD.setObjective(null);
    }
    if (!Ms.armed) {
      if (!nearest || nd > 90) Ms.armed = true;
    } else if (nearest && !pl.vehicle && nd < 34) {
      start(w, nearest, true);
    }
  }

  function computeMedal(w) {
    const m = Ms.active;
    const t = w.time - Ms.startTime;
    if (t <= m.gold && Ms.deaths === 0) return 3;
    if (t <= m.silver) return 2;
    return 1;
  }

  function complete(w) {
    const m = Ms.active;
    const t = w.time - Ms.startTime;
    const rank = computeMedal(w);
    const medal = MEDALS[rank];
    const firstTime = !Ms.completed[m.id];

    Ms.completed[m.id] = true;
    if (rank > (Ms.medals[m.id] || 0)) Ms.medals[m.id] = rank;

    // récompense : pleine la première fois, réduite en rejouant
    let payout = firstTime ? m.reward : Math.round(m.reward / 4);
    const earned = [];
    for (const b of (m.bonuses || [])) {
      if (b.check(w, Ms)) { payout += b.reward; earned.push(b); }
    }

    cleanupMission(w);
    w.clearMissionPeds();
    if (w.clearMissionVehicles) w.clearMissionVehicles();
    G.HUD.showBanner("MISSION ACCOMPLIE", medal.color,
      medal.label + " · " + U.fmtTime(t) + " · +" + payout + " $", 4.5);
    G.Audio.play("jingleWin");
    let delay = 1200;
    for (const b of earned) {
      setTimeout(() => { G.HUD.toast("★ Bonus « " + b.text + " » : +" + b.reward + " $", 3.5); G.Audio.play("cash"); }, delay);
      delay += 1400;
    }
    w.giveMoney(payout);
    Ms.armed = false;
    w.save();
  }

  function cleanupMission(w) {
    Ms.active = null;
    Ms.timer = -1;
    if (Ms.data.cargo) { Ms.data.cargo.missionTag = null; Ms.data.cargo = null; }
    G.HUD.setTimer(-1);
    G.HUD.setObjective(null);
    G.HUD.setMarker(null);
    G.HUD.setAux(null);
  }

  function fail(w, reason) {
    if (!Ms.active) return;
    if (Ms.data.cargo) Ms.data.cargo.missionTag = null;
    cleanupMission(w);
    G.HUD.showBanner("MISSION ÉCHOUÉE", "#ff5340", reason, 4);
    G.Audio.play("jingleFail");
    Ms.armed = false;
    w.clearMissionPeds();
    if (w.clearMissionVehicles) w.clearMissionVehicles();
  }

  /**
   * Mort ou arrestation pendant une mission : si un point de contrôle a
   * été franchi, on y reprend la mission au lieu de la faire échouer.
   * Renvoie true si la reprise a eu lieu (le flux wasted/busted normal
   * doit alors être court-circuité).
   */
  function tryCheckpointRestart(w, reason) {
    if (!Ms.active || Ms.checkpointI < 0) return false;
    const pl = w.player;
    Ms.deaths++;
    pl.dead = false;
    pl.busted = false;
    pl.hp = pl.maxHp;
    if (pl.vehicle) { pl.vehicle.driverKind = null; pl.vehicle = null; }
    G.Audio.stopEngine();
    pl.x = Ms.checkpointPos.x;
    pl.y = Ms.checkpointPos.y;
    w.setWanted(0);
    w.clearMissionPeds();
    if (w.clearMissionVehicles) w.clearMissionVehicles();
    Ms.timer = -1;
    G.HUD.setTimer(-1);
    G.HUD.setAux(null);
    G.Camera.snapTo(pl.x, pl.y);
    G.HUD.showBanner("REPRISE AU POINT DE CONTRÔLE", "#7ad7ff", reason, 3.2);
    Ms.stepI = Ms.checkpointI;
    advance(w);
    return true;
  }

  function onPlayerDown(w, reason) {
    if (Ms.active) fail(w, reason);
  }

  function noteDamage(dmg) {
    if (Ms.active) Ms.damage += dmg;
  }

  /* ---------- marqueurs monde ---------- */

  function drawWorldMarkers(ctx, w) {
    if (!Ms.active) {
      if (!Ms.allDone) {
        const m = nextMission();
        if (!m) return;
        const gp = giverPos(m);
        drawDisc(ctx, w, gp.x, gp.y, "#ffc857");
      } else {
        for (const m of MISSIONS) {
          const gp = giverPos(m);
          drawDisc(ctx, w, gp.x, gp.y, "rgba(46,230,168,0.75)");
        }
      }
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
    return { completed: Ms.completed, allDone: Ms.allDone, medals: Ms.medals };
  }
  function deserialize(d) {
    if (!d) return;
    Ms.completed = d.completed || {};
    Ms.allDone = !!d.allDone;
    Ms.medals = d.medals || {};
  }

  G.Missions = {
    MISSIONS, MEDALS, state: Ms,
    update, fail, onPlayerDown, noteDamage, tryCheckpointRestart,
    drawWorldMarkers,
    serialize, deserialize,
    get activeMission() { return Ms.active; },
    nextMission
  };

})(window.G);
