/* ============================================================
   JADE HARBOR — camera.js
   Caméra vue du dessus : suit le joueur, PIVOTE avec le
   véhicule (signature Chinatown Wars), revient doucement au
   nord à pied. Zoom dynamique selon la vitesse + screenshake.
   ============================================================ */
"use strict";
(function (G) {

  const U = G.U;

  const Cam = {
    x: 0, y: 0,
    rot: 0,          // rotation écran appliquée au monde
    zoom: 1,
    trauma: 0,
    shakeX: 0, shakeY: 0,
    _lookX: 0, _lookY: 0
  };

  function snapTo(x, y) {
    Cam.x = x; Cam.y = y;
    Cam._lookX = x; Cam._lookY = y;
    Cam.rot = 0;
  }

  function update(dt, player) {
    const veh = player.vehicle;
    let tx = player.x, ty = player.y;
    let targetRot, targetZoom;

    if (veh) {
      // regarder devant le véhicule (anticipation accrue à haute vitesse)
      const sp = Math.sqrt(veh.vx * veh.vx + veh.vy * veh.vy);
      const ahead = Math.min(175, sp * 0.55);
      tx = veh.x + Math.cos(veh.angle) * ahead;
      ty = veh.y + Math.sin(veh.angle) * ahead;
      targetRot = -Math.PI / 2 - veh.angle;
      targetZoom = U.lerp(1.0, 0.76, U.clamp(sp / 380, 0, 1));
    } else {
      // en l'air (chute/éjection) : léger dézoom pour garder le joueur en vue
      const airborne = (player.z || 0) > 0;
      tx = player.x + player.vx * 0.4;
      ty = player.y + player.vy * 0.4;
      targetRot = 0; // retour au nord, en douceur
      targetZoom = airborne ? 0.94 : 1.0;
    }

    Cam._lookX = U.damp(Cam._lookX, tx, 6, dt);
    Cam._lookY = U.damp(Cam._lookY, ty, 6, dt);
    Cam.x = Cam._lookX;
    Cam.y = Cam._lookY;

    const k = veh ? 3.2 : 0.9;
    Cam.rot = U.angleDamp(Cam.rot, targetRot, k, dt);
    Cam.zoom = U.damp(Cam.zoom, targetZoom, 2.5, dt);

    // screenshake
    Cam.trauma = Math.max(0, Cam.trauma - dt * 1.8);
    const s = Cam.trauma * Cam.trauma * 14;
    Cam.shakeX = (Math.random() * 2 - 1) * s;
    Cam.shakeY = (Math.random() * 2 - 1) * s;
  }

  function shake(amount) {
    Cam.trauma = Math.min(1, Cam.trauma + amount);
  }

  function apply(ctx, w, h) {
    ctx.translate(w / 2 + Cam.shakeX, h / 2 + Cam.shakeY);
    ctx.rotate(Cam.rot);
    ctx.scale(Cam.zoom, Cam.zoom);
    ctx.translate(-Cam.x, -Cam.y);
  }

  function screenToWorld(sx, sy, w, h) {
    let dx = (sx - w / 2) / Cam.zoom;
    let dy = (sy - h / 2) / Cam.zoom;
    const c = Math.cos(-Cam.rot), s = Math.sin(-Cam.rot);
    return {
      x: Cam.x + dx * c - dy * s,
      y: Cam.y + dx * s + dy * c
    };
  }

  function worldToScreen(wx, wy, w, h) {
    const dx = wx - Cam.x, dy = wy - Cam.y;
    const c = Math.cos(Cam.rot), s = Math.sin(Cam.rot);
    return {
      x: w / 2 + (dx * c - dy * s) * Cam.zoom,
      y: h / 2 + (dx * s + dy * c) * Cam.zoom
    };
  }

  // rayon de vue (cercle englobant, insensible à la rotation)
  function viewRadius(w, h) {
    return Math.sqrt(w * w + h * h) / 2 / Cam.zoom + 80;
  }

  G.Camera = Cam;
  Cam.update = update;
  Cam.apply = apply;
  Cam.shake = shake;
  Cam.snapTo = snapTo;
  Cam.screenToWorld = screenToWorld;
  Cam.worldToScreen = worldToScreen;
  Cam.viewRadius = viewRadius;

})(window.G);
