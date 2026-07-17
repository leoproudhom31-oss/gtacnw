/* ============================================================
   JADE HARBOR — hud.js
   Minimap rotative + GPS, barres de vie/armure, argent,
   étoiles de recherche, arme, objectifs, timer, toasts,
   dialogues avec portraits, bannières, grande carte.
   ============================================================ */
"use strict";
(function (G) {

  const U = G.U, S = G.Sprites;

  const HUD = {
    toastText: null, toastT: 0,
    banner: null, bannerT: 0, bannerColor: "#ffc857", bannerSub: null,
    objective: null,
    timer: -1,
    route: null,          // polyline GPS (px monde)
    routeTarget: null,
    markerPos: null,      // marqueur de mission
    dialogue: null,       // { lines, i, chars, done }
    moneyPop: 0, moneyPopT: 0,
    district: null, districtT: 0,
    bigMap: false,
    tutoText: null, tutoT: 0
  };

  /* ---------- API ---------- */

  HUD.toast = function (text, secs) {
    HUD.toastText = text;
    HUD.toastT = secs || 3.5;
  };

  HUD.tutorial = function (text, secs) {
    HUD.tutoText = text;
    HUD.tutoT = secs || 6;
  };

  HUD.showBanner = function (text, color, sub, secs) {
    HUD.banner = text;
    HUD.bannerColor = color || "#ffc857";
    HUD.bannerSub = sub || null;
    HUD.bannerT = secs || 3.4;
  };

  HUD.setObjective = function (text) { HUD.objective = text; };
  HUD.setAux = function (text) { HUD.auxText = text; };
  HUD.setTimer = function (t) { HUD.timer = t; };
  HUD.setMarker = function (pos) { HUD.markerPos = pos; };

  HUD.startDialogue = function (lines, onDone) {
    HUD.dialogue = { lines, i: 0, chars: 0, onDone };
    G.Audio.play("pickup");
  };
  Object.defineProperty(HUD, "dialogueActive", { get: () => !!HUD.dialogue });

  HUD.moneyGain = function (n) {
    HUD.moneyPop = n;
    HUD.moneyPopT = 1.6;
  };

  HUD.announceDistrict = function (name) {
    if (HUD.district === name) return;
    HUD.district = name;
    HUD.districtT = 3.4;
  };

  /* ---------- update ---------- */

  HUD.update = function (w, dt) {
    HUD.toastT = Math.max(0, HUD.toastT - dt);
    HUD.bannerT = Math.max(0, HUD.bannerT - dt);
    HUD.moneyPopT = Math.max(0, HUD.moneyPopT - dt);
    HUD.districtT = Math.max(0, HUD.districtT - dt);
    HUD.tutoT = Math.max(0, HUD.tutoT - dt);

    if (G.Input.wasPressed("KeyC")) HUD.bigMap = !HUD.bigMap;

    // dialogue : avancement
    const d = HUD.dialogue;
    if (d) {
      d.chars += dt * 45;
      const line = d.lines[d.i];
      if (G.Input.action || G.Input.wasPressed("Space") || G.Input.mouse.clicked) {
        if (d.chars < line.text.length) {
          d.chars = line.text.length;
        } else {
          d.i++;
          d.chars = 0;
          if (d.i >= d.lines.length) {
            HUD.dialogue = null;
            if (d.onDone) d.onDone();
          }
        }
      }
    }

    // GPS : recalcul périodique
    HUD._gpsT = (HUD._gpsT || 0) - dt;
    if (HUD.markerPos && HUD._gpsT <= 0) {
      HUD._gpsT = 1.2;
      HUD.route = G.Map.findRoadPath(w.player.x, w.player.y, HUD.markerPos.x, HUD.markerPos.y);
    }
    if (!HUD.markerPos) HUD.route = null;
  };

  /* ---------- rendu ---------- */

  HUD.draw = function (ctx, w, W, H) {
    const pl = w.player;

    // vignette de dégâts (sous le HUD)
    if (pl.hurtFlash > 0 || (pl.hp < 30 && !pl.dead)) {
      const pulse = pl.hp < 30 && !pl.dead ? 0.12 + Math.sin(w.time * 5) * 0.06 : 0;
      const a = Math.min(0.55, pl.hurtFlash * 0.9 + pulse);
      const grd = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.8);
      grd.addColorStop(0, "rgba(170,25,35,0)");
      grd.addColorStop(1, "rgba(170,25,35," + a + ")");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    }

    drawMinimap(ctx, w, W, H);
    drawBars(ctx, w, W, H);
    drawMoneyWanted(ctx, w, W, H);
    drawWeapon(ctx, w, W, H);

    // objectif (bandeau bas, avec pastille losange)
    if (HUD.objective) {
      ctx.font = "bold 15px 'Rubik','Trebuchet MS',sans-serif";
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      const tw = ctx.measureText(HUD.objective).width;
      const pad = 20, diam = 22;
      const boxW = tw + pad * 2 + diam;
      const y = H - 44, bxo = W / 2 - boxW / 2;
      hudPanel(ctx, bxo, y - 16, boxW, 32, 8, "rgba(46,230,168,0.55)");
      // losange d'objectif
      const dx = bxo + pad, dy = y;
      ctx.save(); ctx.translate(dx, dy); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#2ee6a8";
      ctx.shadowColor = "#2ee6a8"; ctx.shadowBlur = 6;
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
      ctx.fillStyle = "#eafff6";
      ctx.textAlign = "left";
      ctx.fillText(HUD.objective, dx + 16, y + 1);
    }

    // ligne auxiliaire de mission (état du van, distance de filature…)
    if (HUD.auxText) {
      const alert = HUD.auxText.startsWith("⚠");
      ctx.font = "bold 13px 'Rubik','Trebuchet MS',sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const tw2 = ctx.measureText(HUD.auxText).width + 30;
      const y2 = H - 78;
      hudPanel(ctx, W / 2 - tw2 / 2, y2 - 13, tw2, 26, 6, alert ? "rgba(255,83,64,0.6)" : "rgba(255,200,87,0.5)");
      ctx.fillStyle = alert ? "#ff6a58" : "#ffc857";
      ctx.textAlign = "center";
      if (alert && Math.sin(w.time * 10) > 0) ctx.fillStyle = "#ff9a8a";
      ctx.fillText(HUD.auxText, W / 2, y2 + 1);
    }

    // timer (chrono en haut au centre)
    if (HUD.timer >= 0) {
      const urgent = HUD.timer < 10;
      hudPanel(ctx, W / 2 - 58, 12, 116, 46, 9, urgent ? "rgba(255,83,64,0.7)" : "rgba(255,200,87,0.5)");
      ctx.font = "9px 'Rubik',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(245,234,214,0.55)";
      ctx.fillText("TEMPS RESTANT", W / 2, 22);
      ctx.font = "bold 26px 'Rubik','Trebuchet MS',monospace";
      ctx.fillStyle = urgent ? (Math.sin(w.time * 8) > 0 ? "#ff5340" : "#ff9a8a") : "#f5ead6";
      ctx.fillText(U.fmtTime(HUD.timer), W / 2, 42);
    }

    // toast
    if (HUD.toastT > 0 && HUD.toastText) {
      const a = Math.min(1, HUD.toastT / 0.4);
      ctx.globalAlpha = a;
      ctx.font = "13px 'Rubik','Trebuchet MS',sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const tw = ctx.measureText(HUD.toastText).width + 32;
      hudPanel(ctx, W / 2 - tw / 2, H - 90, tw, 27, 6, "rgba(255,200,87,0.4)");
      ctx.fillStyle = "#f7eeda";
      ctx.fillText(HUD.toastText, W / 2, H - 76);
      ctx.globalAlpha = 1;
    }

    // tutoriel (encadré doré à droite)
    if (HUD.tutoT > 0 && HUD.tutoText) {
      const a = Math.min(1, HUD.tutoT / 0.4);
      ctx.globalAlpha = a;
      ctx.font = "13px 'Rubik','Trebuchet MS',sans-serif";
      ctx.textAlign = "left";
      const lines = wrapText(ctx, HUD.tutoText, 250);
      const bw = 276, bh = lines.length * 18 + 34;
      const bx = W - bw - 14, by = 146; // sous le panneau d'arme (92→134)
      hudPanel(ctx, bx, by, bw, bh, 8, "rgba(255,200,87,0.6)");
      ctx.fillStyle = "#ffc857";
      ctx.font = "bold 12px 'Rubik','Trebuchet MS',sans-serif";
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText("◆ LEÇON DE JADE HARBOR", bx + 13, by + 18);
      ctx.fillStyle = "#f2e9d6";
      ctx.font = "13px 'Rubik','Trebuchet MS',sans-serif";
      lines.forEach((l, i) => ctx.fillText(l, bx + 13, by + 40 + i * 18));
      ctx.globalAlpha = 1;
    }

    // quartier
    if (HUD.districtT > 0 && HUD.district) {
      const a = Math.min(1, HUD.districtT / 0.5) * Math.min(1, (3.4 - HUD.districtT) / 0.4 + 0.2);
      ctx.globalAlpha = U.clamp(a, 0, 1);
      ctx.font = "italic bold 24px 'Rubik','Trebuchet MS',serif";
      ctx.textAlign = "right";
      ctx.fillStyle = "#12101a";
      ctx.fillText(HUD.district, W - 18 + 2, H - 26 + 2);
      ctx.fillStyle = "#ffc857";
      ctx.fillText(HUD.district, W - 18, H - 26);
      ctx.globalAlpha = 1;
    }

    // bannière
    if (HUD.bannerT > 0 && HUD.banner) {
      const t = HUD.bannerT;
      const a = Math.min(1, t / 0.5);
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(18,14,28,0.55)";
      ctx.fillRect(0, H * 0.30, W, 110);
      ctx.font = "bold 44px 'Rubik','Trebuchet MS',sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#12101a";
      ctx.fillText(HUD.banner, W / 2 + 3, H * 0.30 + 58 + 3);
      ctx.fillStyle = HUD.bannerColor;
      ctx.fillText(HUD.banner, W / 2, H * 0.30 + 58);
      if (HUD.bannerSub) {
        ctx.font = "17px 'Rubik','Trebuchet MS',sans-serif";
        ctx.fillStyle = "#f5ead6";
        ctx.fillText(HUD.bannerSub, W / 2, H * 0.30 + 90);
      }
      ctx.globalAlpha = 1;
    }

    // dialogue
    if (HUD.dialogue) drawDialogue(ctx, w, W, H);

    if (HUD.bigMap) drawBigMap(ctx, w, W, H);
  };

  /* ---------- minimap ---------- */

  const MM_SIZE = 168, MM_SCALE = 2 / 48 * 2.3; // px minimap par px monde

  function drawMinimap(ctx, w, W, H) {
    const pl = w.player;
    const mx = 16, my = 16, size = MM_SIZE;
    const cx = mx + size / 2, cy = my + size / 2;

    ctx.save();
    // cadre
    const fg = ctx.createLinearGradient(0, my - 5, 0, my + size + 5);
    fg.addColorStop(0, "rgba(26,20,38,0.92)");
    fg.addColorStop(1, "rgba(14,11,22,0.92)");
    ctx.fillStyle = fg;
    roundedRect(ctx, mx - 5, my - 5, size + 10, size + 10, 13); ctx.fill();
    ctx.strokeStyle = "rgba(46,230,168,0.85)"; ctx.lineWidth = 2;
    roundedRect(ctx, mx - 5, my - 5, size + 10, size + 10, 13); ctx.stroke();
    // accents d'angle dorés
    ctx.strokeStyle = "#ffc857"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    const cc = 14, o = -5;
    const corners = [[mx + o, my + o, 1, 1], [mx + size - o, my + o, -1, 1],
                     [mx + o, my + size - o, 1, -1], [mx + size - o, my + size - o, -1, -1]];
    for (const [cxx, cyy, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cxx + dx * cc, cyy); ctx.lineTo(cxx, cyy); ctx.lineTo(cxx, cyy + dy * cc);
      ctx.stroke();
    }
    ctx.lineCap = "butt";

    roundedRect(ctx, mx, my, size, size, 9);
    ctx.clip();

    ctx.fillStyle = "#0d3a41";
    ctx.fillRect(mx, my, size, size);

    // carte tournée avec la caméra
    const rot = G.Camera.rot;
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    const s = MM_SCALE; // monde → minimap
    const mmImg = G.Map.minimap;
    const ppt = G.Map.MINIMAP_PPT;      // px du bitmap minimap par tuile monde
    const worldPerImgPx = G.Map.T / ppt; // unités monde représentées par 1 px du bitmap
    const imgScale = s * worldPerImgPx;
    ctx.scale(imgScale, imgScale);
    ctx.translate(-pl.x / worldPerImgPx, -pl.y / worldPerImgPx);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mmImg, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.restore();

    // seconde passe : overlays en coordonnées minimap
    ctx.save();
    roundedRect(ctx, mx, my, size, size, 9);
    ctx.clip();

    function toMM(wx, wy) {
      let dx = (wx - pl.x) * s, dy = (wy - pl.y) * s;
      const c = Math.cos(rot), sn = Math.sin(rot);
      return { x: cx + dx * c - dy * sn, y: cy + dx * sn + dy * c };
    }

    // itinéraire GPS
    if (HUD.route && HUD.route.length > 1) {
      ctx.strokeStyle = "rgba(46,230,168,0.9)";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.beginPath();
      const p0 = toMM(HUD.route[0].x, HUD.route[0].y);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < HUD.route.length; i++) {
        const p = toMM(HUD.route[i].x, HUD.route[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // blips : police
    for (const v of w.vehicles) {
      if (v.type === "police" && v.ai && !v.wreck) {
        const p = toMM(v.x, v.y);
        ctx.fillStyle = "#3b8bff";
        ctx.beginPath(); ctx.arc(p.x, p.y, 3.4, 0, U.TAU); ctx.fill();
      }
    }
    // hélicoptère
    if (w.heli && !w.heli.dead) {
      const p = toMM(w.heli.x, w.heli.y);
      ctx.fillStyle = "#7ad7ff";
      ctx.strokeStyle = "#12101a"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4.4, 0, U.TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#12101a";
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, U.TAU); ctx.fill();
    }
    for (const p of w.peds) {
      if (p.dead) continue;
      if (p.kind === "cop" && p.state === "chase") {
        const q = toMM(p.x, p.y);
        ctx.fillStyle = "#3b8bff";
        ctx.beginPath(); ctx.arc(q.x, q.y, 2.6, 0, U.TAU); ctx.fill();
      } else if (p.missionTag === "enemy") {
        const q = toMM(p.x, p.y);
        ctx.fillStyle = "#ff5340";
        ctx.beginPath(); ctx.arc(q.x, q.y, 3, 0, U.TAU); ctx.fill();
      }
    }

    // marqueur de mission (clampé au bord)
    if (HUD.markerPos) {
      const p = toMM(HUD.markerPos.x, HUD.markerPos.y);
      const cl = clampToBox(p.x, p.y, mx + 10, my + 10, size - 20, size - 20, cx, cy);
      ctx.fillStyle = "#ffc857";
      ctx.strokeStyle = "#12101a"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cl.x, cl.y, 5, 0, U.TAU); ctx.fill(); ctx.stroke();
    }

    // joueur au centre (flèche orientée)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(pl.vehicle ? pl.vehicle.angle + rot : pl.angle + rot);
    ctx.fillStyle = "#f5ead6";
    ctx.strokeStyle = "#12101a"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-2.5, 0); ctx.lineTo(-5, 5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.restore();

    // indicateur Nord sur le pourtour
    const na = -Math.PI / 2 + rot;
    const nx = cx + Math.cos(na) * (size / 2 - 2);
    const ny = cy + Math.sin(na) * (size / 2 - 2);
    ctx.fillStyle = "#ffc857";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("N", nx, ny);
  }

  function clampToBox(x, y, bx, by, bw, bh, cx, cy) {
    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return { x, y };
    // projeter vers le centre
    let dx = x - cx, dy = y - cy;
    const sx = dx !== 0 ? (bw / 2) / Math.abs(dx) : Infinity;
    const sy = dy !== 0 ? (bh / 2) / Math.abs(dy) : Infinity;
    const t = Math.min(sx, sy, 1);
    return { x: cx + dx * t, y: cy + dy * t };
  }

  /* ---------- helpers de style ---------- */

  // panneau HUD cohérent : fond encre + liseré supérieur + accent
  function hudPanel(ctx, x, y, w, h, r, accent) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "rgba(26,20,38,0.90)");
    g.addColorStop(1, "rgba(14,11,22,0.90)");
    ctx.fillStyle = g;
    roundedRect(ctx, x, y, w, h, r); ctx.fill();
    // liseré clair en haut
    ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + r, y + 0.5); ctx.lineTo(x + w - r, y + 0.5); ctx.stroke();
    // bordure d'accent
    ctx.strokeStyle = accent || "rgba(46,230,168,0.55)"; ctx.lineWidth = 1.5;
    roundedRect(ctx, x, y, w, h, r); ctx.stroke();
  }

  // barre segmentée (vie, armure, munitions…)
  function segBar(ctx, x, y, w, h, frac, colA, colB, glow) {
    frac = U.clamp(frac, 0, 1);
    // fond creusé
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    roundedRect(ctx, x, y, w, h, h / 2); ctx.fill();
    // remplissage dégradé
    if (frac > 0.001) {
      ctx.save();
      roundedRect(ctx, x, y, w, h, h / 2); ctx.clip();
      const fw = w * frac;
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, colA);
      g.addColorStop(1, colB);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, fw, h);
      // reflet supérieur
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(x, y + 1, fw, h * 0.35);
      // séparateurs de segments
      ctx.strokeStyle = "rgba(0,0,0,0.28)"; ctx.lineWidth = 1;
      for (let s = 1; s < 10; s++) {
        const sx = x + w * (s / 10);
        ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx, y + h); ctx.stroke();
      }
      ctx.restore();
      if (glow) {
        ctx.save();
        ctx.shadowColor = colA; ctx.shadowBlur = 6;
        ctx.strokeStyle = "rgba(255,255,255,0.0)";
        roundedRect(ctx, x, y, w * frac, h, h / 2); ctx.stroke();
        ctx.restore();
      }
    }
    // contour
    ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 1;
    roundedRect(ctx, x, y, w, h, h / 2); ctx.stroke();
  }

  function heartIcon(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.75);
    ctx.bezierCurveTo(cx - r * 1.3, cy - r * 0.35, cx - r * 0.5, cy - r * 1.1, cx, cy - r * 0.3);
    ctx.bezierCurveTo(cx + r * 0.5, cy - r * 1.1, cx + r * 1.3, cy - r * 0.35, cx, cy + r * 0.75);
    ctx.closePath(); ctx.fill();
  }

  function shieldIcon(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.85, cy - r * 0.55);
    ctx.lineTo(cx + r * 0.85, cy + r * 0.2);
    ctx.quadraticCurveTo(cx + r * 0.7, cy + r * 0.9, cx, cy + r * 1.15);
    ctx.quadraticCurveTo(cx - r * 0.7, cy + r * 0.9, cx - r * 0.85, cy + r * 0.2);
    ctx.lineTo(cx - r * 0.85, cy - r * 0.55);
    ctx.closePath(); ctx.fill();
  }

  /* ---------- barres vie/armure (sous la minimap) ---------- */

  function drawBars(ctx, w, W, H) {
    const pl = w.player;
    const px = 12, py = 16 + MM_SIZE + 12, pw = MM_SIZE + 8;
    const hasArmor = pl.armor > 0;
    const ph = hasArmor ? 52 : 32;
    hudPanel(ctx, px, py, pw, ph, 9, "rgba(46,230,168,0.5)");

    const bx = px + 30, bw = pw - 42, bh = 11;
    // vie
    let hy = py + (hasArmor ? 11 : 11);
    heartIcon(ctx, px + 16, hy + bh / 2, 7, pl.hp > 30 ? "#ff5a6e" : "#ff3242");
    const hpFrac = U.clamp(pl.hp / pl.maxHp, 0, 1);
    const hpA = pl.hp > 30 ? "#3cf0b0" : "#ff6a58", hpB = pl.hp > 30 ? "#1b9c6e" : "#c0342b";
    segBar(ctx, bx, hy, bw, bh, hpFrac, hpA, hpB, pl.hp <= 30);
    ctx.font = "bold 9px 'Rubik',sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(245,234,214,0.9)";
    ctx.fillText(Math.ceil(pl.hp), bx + bw - 3, hy + bh / 2 + 0.5);

    // armure
    if (hasArmor) {
      const ay = hy + bh + 8;
      shieldIcon(ctx, px + 16, ay + bh / 2 - 1, 6.5, "#7ab8ff");
      segBar(ctx, bx, ay, bw, bh, U.clamp(pl.armor / 100, 0, 1), "#7ab8ff", "#2f6fbf", false);
      ctx.fillStyle = "rgba(245,234,214,0.9)"; ctx.textAlign = "right";
      ctx.font = "bold 9px 'Rubik',sans-serif";
      ctx.fillText(Math.ceil(pl.armor), bx + bw - 3, ay + bh / 2 + 0.5);
    }
  }

  /* ---------- argent + étoiles de recherche (haut-droite) ---------- */

  function drawMoneyWanted(ctx, w, W, H) {
    const pl = w.player;
    const rm = 16;

    // panneau argent
    ctx.font = "bold 21px 'Rubik','Trebuchet MS',monospace";
    const moneyTxt = U.fmtMoney(pl.money);
    const mtw = ctx.measureText(moneyTxt).width;
    const pw = mtw + 46, pw2 = Math.max(pw, 150);
    const px = W - rm - pw2, py = 14, ph = 34;
    hudPanel(ctx, px, py, pw2, ph, 8, "rgba(255,200,87,0.5)");
    // pièce
    const coinX = px + 18, coinY = py + ph / 2;
    const cg = ctx.createRadialGradient(coinX - 2, coinY - 2, 1, coinX, coinY, 9);
    cg.addColorStop(0, "#ffe89a"); cg.addColorStop(1, "#e0a52f");
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(coinX, coinY, 9, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = "#a5761a"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(coinX, coinY, 9, 0, U.TAU); ctx.stroke();
    ctx.fillStyle = "#a5761a"; ctx.font = "bold 11px 'Rubik',sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("$", coinX, coinY + 0.5);
    // montant
    ctx.font = "bold 20px 'Rubik','Trebuchet MS',monospace";
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#f6ecd6";
    ctx.fillText(moneyTxt, W - rm - 12, py + ph / 2 + 1);
    // popup de gain
    if (HUD.moneyPopT > 0) {
      ctx.globalAlpha = Math.min(1, HUD.moneyPopT);
      ctx.font = "bold 15px 'Rubik','Trebuchet MS',monospace";
      ctx.fillStyle = "#5cf0a8";
      ctx.textAlign = "right";
      ctx.fillText("+" + HUD.moneyPop + " $", W - rm - 12, py + ph + 12 - (1.6 - HUD.moneyPopT) * 8);
      ctx.globalAlpha = 1;
    }

    // étoiles de recherche
    const lvl = w.wanted.level;
    const cooling = w.wanted.evadeT > 0;
    const starGap = 25, sr = 10;
    const rowW = 5 * starGap;
    const sx0 = W - rm - rowW + starGap / 2, sy = py + ph + 20;
    for (let i = 0; i < 5; i++) {
      const filled = i < lvl;
      const blink = cooling && filled ? (Math.sin(w.time * 8) > 0) : true;
      const on = filled && blink;
      drawStar(ctx, sx0 + i * starGap, sy, sr, on);
    }
  }

  function drawStar(ctx, x, y, r, on) {
    ctx.save();
    if (on) { ctx.shadowColor = "#ffc857"; ctx.shadowBlur = 9; }
    // corps
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.44;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    if (on) {
      const g = ctx.createLinearGradient(x, y - r, x, y + r);
      g.addColorStop(0, "#ffe89a"); g.addColorStop(1, "#f0a52f");
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = "rgba(245,234,214,0.12)";
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = on ? "#a5761a" : "rgba(245,234,214,0.22)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- arme équipée (haut-droite, sous les étoiles) ---------- */

  const WEAPON_ORDER_HUD = ["fist", "bat", "pistol", "smg", "shotgun"];

  function drawWeaponIcon(ctx, cx, cy, weapon, col) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = "rgba(10,8,18,0.6)"; ctx.lineWidth = 1;
    ctx.fillStyle = col;
    switch (weapon) {
      case "fist":
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, U.TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "rgba(10,8,18,0.5)";
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-5, i * 2.6); ctx.lineTo(4, i * 2.6); ctx.stroke(); }
        break;
      case "bat":
        ctx.rotate(-0.6); ctx.fillStyle = "#b08a5e";
        roundedRect(ctx, -10, -2, 20, 4, 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#8a6a44"; roundedRect(ctx, -10, -2, 5, 4, 2); ctx.fill();
        break;
      case "pistol":
        ctx.fillStyle = "#2a2d38";
        roundedRect(ctx, -9, -3, 16, 5, 1); ctx.fill(); ctx.stroke();
        roundedRect(ctx, -7, 1, 4, 6, 1); ctx.fill(); ctx.stroke();
        break;
      case "smg":
        ctx.fillStyle = "#2a2d38";
        roundedRect(ctx, -11, -3, 22, 5, 1); ctx.fill(); ctx.stroke();
        roundedRect(ctx, -3, 1, 4, 7, 1); ctx.fill(); ctx.stroke();
        break;
      case "shotgun":
        ctx.fillStyle = "#2a2d38";
        roundedRect(ctx, -12, -2.5, 18, 4, 1); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#8a5a2c";
        roundedRect(ctx, 4, -2.5, 8, 4, 1); ctx.fill(); ctx.stroke();
        break;
    }
    ctx.restore();
  }

  function drawWeapon(ctx, w, W, H) {
    const pl = w.player;
    const wp = G.Ent.WEAPONS[pl.weapon];
    const rm = 16;
    const pw = 150, ph = 42;
    const px = W - rm - pw, py = 92;
    hudPanel(ctx, px, py, pw, ph, 8, "rgba(245,234,214,0.35)");

    // pastille icône
    const icX = px + 24, icY = py + ph / 2;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.arc(icX, icY, 15, 0, U.TAU); ctx.fill();
    drawWeaponIcon(ctx, icX, icY, pl.weapon, "#cfd6dc");

    // nom + munitions
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.font = "bold 12px 'Rubik','Trebuchet MS',sans-serif";
    ctx.fillStyle = "#f5ead6";
    ctx.fillText(wp.name, px + 46, py + 18);
    if (wp.melee) {
      ctx.font = "10px 'Rubik',sans-serif";
      ctx.fillStyle = "rgba(245,234,214,0.55)";
      ctx.fillText("corps à corps", px + 46, py + 32);
    } else {
      const ammo = pl.ammo[pl.weapon] || 0;
      ctx.font = "bold 13px 'Rubik','Trebuchet MS',monospace";
      ctx.fillStyle = ammo > 0 ? "#ffc857" : "#ff5340";
      ctx.fillText(ammo + " balles", px + 46, py + 33);
    }
  }

  /* ---------- dialogue ---------- */

  function drawDialogue(ctx, w, W, H) {
    const d = HUD.dialogue;
    const line = d.lines[d.i];
    const bw = Math.min(740, W - 40), bh = 126;
    const bx = W / 2 - bw / 2, by = H - bh - 18;

    // fond du panneau
    const g = ctx.createLinearGradient(0, by, 0, by + bh);
    g.addColorStop(0, "rgba(28,22,40,0.96)");
    g.addColorStop(1, "rgba(16,12,24,0.96)");
    ctx.fillStyle = g;
    roundedRect(ctx, bx, by, bw, bh, 12); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx + 12, by + 0.5); ctx.lineTo(bx + bw - 12, by + 0.5); ctx.stroke();
    ctx.strokeStyle = "#ffc857"; ctx.lineWidth = 2;
    roundedRect(ctx, bx, by, bw, bh, 12); ctx.stroke();

    // portrait avec cadre
    const ps = 100, ppx = bx + 13, ppy = by + 13;
    ctx.fillStyle = "#0d1512";
    roundedRect(ctx, ppx - 2, ppy - 2, ps + 4, ps + 4, 10); ctx.fill();
    const img = S.portrait(line.who);
    ctx.save();
    roundedRect(ctx, ppx, ppy, ps, ps, 8);
    ctx.clip();
    ctx.drawImage(img, ppx, ppy, ps, ps);
    ctx.restore();
    ctx.strokeStyle = "#2ee6a8"; ctx.lineWidth = 2;
    roundedRect(ctx, ppx, ppy, ps, ps, 8); ctx.stroke();

    const tx = bx + 130;
    // plaque de nom
    ctx.font = "bold 15px 'Chakra Petch','Rubik',sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const ntw = ctx.measureText(line.name).width;
    ctx.fillStyle = "rgba(46,230,168,0.16)";
    roundedRect(ctx, tx, by + 14, ntw + 20, 24, 6); ctx.fill();
    ctx.strokeStyle = "rgba(46,230,168,0.5)"; ctx.lineWidth = 1;
    roundedRect(ctx, tx, by + 14, ntw + 20, 24, 6); ctx.stroke();
    ctx.fillStyle = "#5cf0b8";
    ctx.fillText(line.name, tx + 10, by + 26);

    // texte machine à écrire
    ctx.font = "15px 'Rubik','Trebuchet MS',sans-serif";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#f2e9d6";
    const shown = line.text.slice(0, Math.floor(d.chars));
    const lines = wrapText(ctx, shown, bw - 150);
    lines.slice(0, 4).forEach((l, i) => ctx.fillText(l, tx, by + 50 + i * 20));

    // indication
    if (d.chars >= line.text.length) {
      ctx.font = "bold 11px 'Rubik','Trebuchet MS',sans-serif";
      ctx.fillStyle = "rgba(255,200,87," + (0.55 + Math.sin(w.time * 5) * 0.35) + ")";
      ctx.textAlign = "right";
      const arrow = Math.sin(w.time * 5) > 0 ? "▸ " : "▹ ";
      ctx.fillText(arrow + "[E] continuer   " + (d.i + 1) + "/" + d.lines.length, bx + bw - 16, by + bh - 22);
    }
  }

  /* ---------- grande carte ---------- */

  function drawBigMap(ctx, w, W, H) {
    const pl = w.player;
    ctx.fillStyle = "rgba(10,8,16,0.88)";
    ctx.fillRect(0, 0, W, H);
    const size = Math.min(W, H) - 90;
    const mx = W / 2 - size / 2, my = H / 2 - size / 2 + 10;
    // grande carte : le bitmap source est assez fin pour être downscalé
    // ici (jamais agrandi), donc lissage activé = rendu net, pas de blocs.
    ctx.imageSmoothingEnabled = true;
    if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
    ctx.drawImage(G.Map.minimap, mx, my, size, size);
    ctx.strokeStyle = "#2ee6a8"; ctx.lineWidth = 2;
    ctx.strokeRect(mx, my, size, size);

    const k = size / G.Map.WPX;
    // itinéraire
    if (HUD.route && HUD.route.length > 1) {
      ctx.strokeStyle = "rgba(46,230,168,0.9)"; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(mx + HUD.route[0].x * k, my + HUD.route[0].y * k);
      for (const p of HUD.route) ctx.lineTo(mx + p.x * k, my + p.y * k);
      ctx.stroke();
    }
    // POI
    ctx.font = "11px 'Rubik','Trebuchet MS',sans-serif";
    ctx.textAlign = "left";
    const pois = [
      ["teahouse", "Salon de thé", "#ffc857"],
      ["garage", "Garage", "#2ee6a8"],
      ["police", "Police", "#3b8bff"],
      ["hospital", "Hôpital", "#ff5340"],
      ["pagoda", "Pagode", "#e58fb1"],
      ["debarcadere", "Jetée", "#7ad7ff"]
    ];
    for (const [key, label, color] of pois) {
      const p = G.Map.POI[key];
      if (!p) continue;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(mx + p.x * k, my + p.y * k, 4, 0, U.TAU); ctx.fill();
      ctx.fillStyle = "#f5ead6";
      ctx.fillText(label, mx + p.x * k + 7, my + p.y * k + 4);
    }
    // marqueur mission
    if (HUD.markerPos) {
      ctx.fillStyle = "#ffc857";
      const px = mx + HUD.markerPos.x * k, py = my + HUD.markerPos.y * k;
      ctx.beginPath(); ctx.arc(px, py, 6, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = "#12101a"; ctx.stroke();
    }
    // joueur
    ctx.save();
    ctx.translate(mx + pl.x * k, my + pl.y * k);
    ctx.rotate(pl.vehicle ? pl.vehicle.angle : pl.angle);
    ctx.fillStyle = "#f5ead6";
    ctx.beginPath();
    ctx.moveTo(8, 0); ctx.lineTo(-6, -6); ctx.lineTo(-3, 0); ctx.lineTo(-6, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    ctx.font = "bold 20px 'Rubik','Trebuchet MS',sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffc857";
    ctx.fillText("JADE HARBOR — carte de l'île", W / 2, my - 16);
    ctx.font = "13px 'Rubik','Trebuchet MS',sans-serif";
    ctx.fillStyle = "#c9bda6";
    ctx.fillText("[C] fermer la carte", W / 2, my + size + 22);
  }

  /* ---------- helpers ---------- */

  function roundedRect(ctx, x, y, w, h, r) {
    S.roundRect(ctx, x, y, w, h, r);
  }

  function wrapText(ctx, text, maxW) {
    const words = text.split(" ");
    const lines = [];
    let cur = "";
    for (const wd of words) {
      const test = cur ? cur + " " + wd : wd;
      if (ctx.measureText(test).width > maxW && cur) {
        lines.push(cur); cur = wd;
      } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  G.HUD = HUD;

})(window.G);
