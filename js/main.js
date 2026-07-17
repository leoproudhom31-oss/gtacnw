/* ============================================================
   JADE HARBOR — main.js
   Bootstrap : canvas, écran titre, chargement, boucle de jeu
   à pas fixe, pause, mute.
   ============================================================ */
"use strict";
(function (G) {

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
  const titleScreen = document.getElementById("title-screen");
  const controlsScreen = document.getElementById("controls-screen");
  const loadingScreen = document.getElementById("loading-screen");
  const loadingFill = document.getElementById("loading-fill");
  const loadingLabel = document.getElementById("loading-label");

  let running = false;
  let paused = false;
  let last = 0;
  let acc = 0;
  const STEP = 1 / 60;
  let viewW = 1280, viewH = 720;

  // --- résolution adaptative -----------------------------------------
  // Écrans Retina/HiDPI : on VISE la vraie densité de l'écran (jusqu'à
  // 2x — au-delà le gain visuel ne justifie plus le coût de remplissage)
  // pour un rendu net. Mais ce jeu dessine énormément de vecteurs par
  // frame (bâtiments, piétons, véhicules) : sur une scène très chargée
  // (poursuite en centre-ville avec beaucoup de trafic), remplir 4× plus
  // de pixels peut faire chuter le fps bien plus vite que prévu. On
  // mesure donc le temps de frame en continu et on recule d'un cran si
  // ça sature, puis on retente plus net dès que la charge retombe —
  // qualité maximale par défaut, jamais au prix de la fluidité.
  const DPR_STEP = 0.25, DPR_MIN = 1;
  let dprCap = 2;     // densité native de l'écran, plafonnée à 2
  let dpr = 2;         // densité RÉELLEMENT utilisée cette frame (adaptative)
  let frameTimes = [];
  let dprCheckT = 1;

  function resize() {
    dprCap = Math.min(window.devicePixelRatio || 1, 2);
    dpr = Math.min(dpr, dprCap);
    applyCanvasSize();
  }
  function applyCanvasSize() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    canvas.style.width = viewW + "px";
    canvas.style.height = viewH + "px";
  }
  function adaptDpr(dt) {
    frameTimes.push(dt);
    if (frameTimes.length > 45) frameTimes.shift();
    dprCheckT -= dt;
    if (dprCheckT > 0 || frameTimes.length < 45) return;
    dprCheckT = 1.1; // une réévaluation par seconde environ, pas plus
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const fps = 1 / avg;
    if (fps < 40 && dpr > DPR_MIN) {
      dpr = Math.max(DPR_MIN, +(dpr - DPR_STEP).toFixed(2));
      applyCanvasSize();
    } else if (fps > 52 && dpr < dprCap) {
      dpr = Math.min(dprCap, +(dpr + DPR_STEP).toFixed(2));
      applyCanvasSize();
    }
  }
  window.addEventListener("resize", resize);
  dprCap = Math.min(window.devicePixelRatio || 1, 2);
  dpr = dprCap; // on démarre net ; adaptDpr() reculera si la scène sature
  applyCanvasSize();

  /* ---------- écran titre ---------- */

  const btnNew = document.getElementById("btn-new");
  const btnContinue = document.getElementById("btn-continue");
  const btnControls = document.getElementById("btn-controls");
  const btnCloseControls = document.getElementById("btn-close-controls");

  try {
    if (localStorage.getItem("jadeharbor_save_v1")) btnContinue.style.display = "";
  } catch (e) { /* pas de stockage */ }

  btnNew.addEventListener("click", () => startGame(false));
  btnContinue.addEventListener("click", () => startGame(true));
  btnControls.addEventListener("click", () => {
    titleScreen.style.display = "none";
    controlsScreen.style.display = "flex";
  });
  btnCloseControls.addEventListener("click", () => {
    controlsScreen.style.display = "none";
    if (!running) titleScreen.style.display = "flex";
  });

  function startGame(fromSave) {
    G.Audio.ensure();
    titleScreen.style.display = "none";
    loadingScreen.style.display = "flex";
    loadingFill.style.width = "12%";
    loadingLabel.textContent = "Construction de la ville…";

    // laisser le navigateur peindre l'écran de chargement
    setTimeout(() => {
      G.Map.generate();
      loadingFill.style.width = "70%";
      loadingLabel.textContent = "Réveil du Quartier du Lotus…";
      setTimeout(() => {
        G.Game.init(fromSave);
        loadingFill.style.width = "100%";
        setTimeout(() => {
          loadingScreen.style.display = "none";
          if (!running) {
            running = true;
            last = performance.now();
            requestAnimationFrame(loop);
          }
          if (!fromSave) {
            G.HUD.showBanner("JADE HARBOR", "#2ee6a8", "Quelque part entre le thé et la poudre…", 4);
            G.HUD.tutorial("Avance vers le marqueur doré pour lancer la première mission. Z Q S D pour bouger, Maj pour sprinter.", 10);
          }
        }, 200);
      }, 30);
    }, 60);
  }

  /* ---------- boucle ---------- */

  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);

    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1; // onglet en arrière-plan
    else adaptDpr(dt); // ignorer les dt géants (tab masqué) dans la moyenne

    // pause
    if (G.Input.wasPressed("Escape") || G.Input.wasPressed("KeyP")) {
      paused = !paused;
    }
    if (G.Input.wasPressed("KeyM")) {
      const muted = G.Audio.toggleMute();
      G.HUD.toast(muted ? "Son coupé" : "Son activé", 1.5);
    }

    if (!paused) {
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 4) {
        G.Game.update(STEP);
        G.Input.endFrame(STEP);
        acc -= STEP;
        steps++;
      }
      if (steps === 4) acc = 0;
    } else {
      G.Input.endFrame(dt);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    G.Game.render(ctx, viewW, viewH);

    if (paused) drawPause();
  }

  function drawPause() {
    ctx.fillStyle = "rgba(10,8,16,0.72)";
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = "center";
    ctx.fillStyle = "#2ee6a8";
    ctx.font = "bold 46px 'Rubik','Trebuchet MS',sans-serif";
    ctx.fillText("PAUSE", viewW / 2, viewH / 2 - 80);
    ctx.fillStyle = "#f5ead6";
    ctx.font = "15px 'Rubik','Trebuchet MS',sans-serif";
    const lines = [
      "Z Q S D / W A S D / flèches : bouger · conduire",
      "Maj : sprint   ·   E / Entrée : monter, descendre, interagir",
      "Espace : frapper / tirer (visée auto) · frein à main en voiture",
      "Clic gauche : tirer vers la souris   ·   Tab / 1-4 : changer d'arme",
      "K : klaxon   ·   C : grande carte   ·   M : couper le son",
      "",
      "Échap ou P : reprendre la partie"
    ];
    lines.forEach((l, i) => ctx.fillText(l, viewW / 2, viewH / 2 - 30 + i * 26));
    ctx.fillStyle = "#ffc857";
    ctx.font = "13px 'Rubik','Trebuchet MS',sans-serif";
    ctx.fillText("JADE HARBOR — Chroniques du Lotus Noir · v1.0", viewW / 2, viewH - 40);
  }

  // petit pont de debug (utilisé par les tests automatisés)
  window.__jh = {
    G,
    start: startGame,
    teleport(x, y) {
      const pl = G.Game.player;
      if (!pl) return;
      pl.x = x; pl.y = y;
      if (pl.vehicle) { pl.vehicle.x = x; pl.vehicle.y = y; }
      G.Camera.snapTo(x, y);
    },
    get state() { return G.Game.state; },
    get dpr() { return dpr; },
    get dprCap() { return dprCap; }
  };

})(window.G);
