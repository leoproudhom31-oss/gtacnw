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

    // objectif
    if (HUD.objective) {
      ctx.font = "bold 15px 'Rubik','Trebuchet MS',sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const tw = ctx.measureText(HUD.objective).width + 34;
      const y = H - 44;
      ctx.fillStyle = "rgba(18,14,28,0.78)";
      roundedRect(ctx, W / 2 - tw / 2, y - 15, tw, 30, 6); ctx.fill();
      ctx.strokeStyle = "rgba(46,230,168,0.5)"; ctx.lineWidth = 1.5;
      roundedRect(ctx, W / 2 - tw / 2, y - 15, tw, 30, 6); ctx.stroke();
      ctx.fillStyle = "#2ee6a8";
      ctx.fillText(HUD.objective, W / 2, y + 1);
    }

    // ligne auxiliaire de mission (état du van, distance de filature…)
    if (HUD.auxText) {
      ctx.font = "bold 13px 'Rubik','Trebuchet MS',sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const tw2 = ctx.measureText(HUD.auxText).width + 24;
      const y2 = H - 74;
      ctx.fillStyle = "rgba(18,14,28,0.72)";
      roundedRect(ctx, W / 2 - tw2 / 2, y2 - 12, tw2, 24, 5); ctx.fill();
      ctx.fillStyle = HUD.auxText.startsWith("⚠") ? "#ff5340" : "#ffc857";
      ctx.fillText(HUD.auxText, W / 2, y2 + 1);
    }

    // timer
    if (HUD.timer >= 0) {
      ctx.font = "bold 34px 'Rubik','Trebuchet MS',monospace";
      ctx.textAlign = "center";
      const txt = U.fmtTime(HUD.timer);
      ctx.fillStyle = "rgba(18,14,28,0.6)";
      roundedRect(ctx, W / 2 - 58, 14, 116, 44, 8); ctx.fill();
      ctx.fillStyle = HUD.timer < 10 ? "#ff5340" : "#f5ead6";
      ctx.fillText(txt, W / 2, 44);
    }

    // toast
    if (HUD.toastT > 0 && HUD.toastText) {
      const a = Math.min(1, HUD.toastT / 0.4);
      ctx.globalAlpha = a;
      ctx.font = "14px 'Rubik','Trebuchet MS',sans-serif";
      ctx.textAlign = "center";
      const tw = ctx.measureText(HUD.toastText).width + 28;
      ctx.fillStyle = "rgba(18,14,28,0.85)";
      roundedRect(ctx, W / 2 - tw / 2, H - 86, tw, 26, 5); ctx.fill();
      ctx.fillStyle = "#f5ead6";
      ctx.fillText(HUD.toastText, W / 2, H - 69);
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
      const bx = W - bw - 14, by = 120;
      ctx.fillStyle = "rgba(18,14,28,0.85)";
      roundedRect(ctx, bx, by, bw, bh, 8); ctx.fill();
      ctx.strokeStyle = "#ffc857"; ctx.lineWidth = 1.5;
      roundedRect(ctx, bx, by, bw, bh, 8); ctx.stroke();
      ctx.fillStyle = "#ffc857";
      ctx.font = "bold 12px 'Rubik','Trebuchet MS',sans-serif";
      ctx.fillText("◆ LEÇON DE JADE HARBOR", bx + 13, by + 18);
      ctx.fillStyle = "#f5ead6";
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
    ctx.fillStyle = "rgba(18,14,28,0.85)";
    roundedRect(ctx, mx - 4, my - 4, size + 8, size + 8, 12); ctx.fill();
    ctx.strokeStyle = "#2ee6a8"; ctx.lineWidth = 2;
    roundedRect(ctx, mx - 4, my - 4, size + 8, size + 8, 12); ctx.stroke();

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
    const imgScale = s * 48 / 2; // le canvas minimap fait 2 px par tuile
    ctx.scale(imgScale, imgScale);
    ctx.translate(-pl.x / 24, -pl.y / 24);
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

  /* ---------- barres & compteurs ---------- */

  function drawBars(ctx, w, W, H) {
    const pl = w.player;
    const x = 16, y = 16 + MM_SIZE + 14, bw = MM_SIZE, bh = 10;
    // vie
    ctx.fillStyle = "rgba(18,14,28,0.8)";
    roundedRect(ctx, x - 2, y - 2, bw + 4, bh + 4, 4); ctx.fill();
    ctx.fillStyle = "#3d1f24";
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = pl.hp > 30 ? "#2ee6a8" : "#ff5340";
    ctx.fillRect(x, y, bw * U.clamp(pl.hp / pl.maxHp, 0, 1), bh);
    // armure
    if (pl.armor > 0) {
      const y2 = y + bh + 5;
      ctx.fillStyle = "rgba(18,14,28,0.8)";
      roundedRect(ctx, x - 2, y2 - 2, bw + 4, bh + 2, 4); ctx.fill();
      ctx.fillStyle = "#3b8bff";
      ctx.fillRect(x, y2, bw * U.clamp(pl.armor / 100, 0, 1), bh - 2);
    }
  }

  function drawMoneyWanted(ctx, w, W, H) {
    const pl = w.player;
    // argent
    ctx.font = "bold 22px 'Rubik','Trebuchet MS',monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#12101a";
    ctx.fillText(U.fmtMoney(pl.money), W - 16 + 2, 16 + 2);
    ctx.fillStyle = "#8ee6b8";
    ctx.fillText(U.fmtMoney(pl.money), W - 16, 16);
    if (HUD.moneyPopT > 0) {
      ctx.globalAlpha = Math.min(1, HUD.moneyPopT);
      ctx.font = "bold 16px 'Rubik','Trebuchet MS',monospace";
      ctx.fillStyle = "#ffc857";
      ctx.fillText("+" + HUD.moneyPop + " $", W - 16, 44 - (1.6 - HUD.moneyPopT) * 10);
      ctx.globalAlpha = 1;
    }

    // étoiles de recherche
    const lvl = w.wanted.level;
    const cooling = w.wanted.evadeT > 0;
    for (let i = 0; i < 5; i++) {
      const sx = W - 16 - (4 - i) * 26 - 13, sy = 62;
      const filled = i < lvl;
      const blink = cooling && filled ? (Math.sin(w.time * 8) > 0) : true;
      drawStar(ctx, sx, sy, 10, filled && blink ? "#ffc857" : "rgba(245,234,214,0.16)");
    }
  }

  function drawStar(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawWeapon(ctx, w, W, H) {
    const pl = w.player;
    const wp = G.Ent.WEAPONS[pl.weapon];
    const x = W - 16, y = 84;
    ctx.font = "bold 14px 'Rubik','Trebuchet MS',sans-serif";
    ctx.textAlign = "right"; ctx.textBaseline = "top";
    ctx.fillStyle = "#f5ead6";
    let label = wp.name;
    if (!wp.melee) label += "  ·  " + pl.ammo[pl.weapon];
    ctx.fillStyle = "rgba(18,14,28,0.6)";
    const tw = ctx.measureText(label).width + 18;
    roundedRect(ctx, x - tw, y - 4, tw + 4, 24, 5); ctx.fill();
    ctx.fillStyle = "#f5ead6";
    ctx.fillText(label, x - 6, y);
  }

  /* ---------- dialogue ---------- */

  function drawDialogue(ctx, w, W, H) {
    const d = HUD.dialogue;
    const line = d.lines[d.i];
    const bw = Math.min(720, W - 40), bh = 118;
    const bx = W / 2 - bw / 2, by = H - bh - 18;

    ctx.fillStyle = "rgba(18,14,28,0.92)";
    roundedRect(ctx, bx, by, bw, bh, 10); ctx.fill();
    ctx.strokeStyle = "#ffc857"; ctx.lineWidth = 2;
    roundedRect(ctx, bx, by, bw, bh, 10); ctx.stroke();

    // portrait
    const img = S.portrait(line.who);
    ctx.save();
    roundedRect(ctx, bx + 12, by + 12, 94, 94, 8);
    ctx.clip();
    ctx.drawImage(img, bx + 12, by + 12, 94, 94);
    ctx.restore();
    ctx.strokeStyle = "#2ee6a8"; ctx.lineWidth = 1.5;
    roundedRect(ctx, bx + 12, by + 12, 94, 94, 8); ctx.stroke();

    // nom
    ctx.font = "bold 15px 'Rubik','Trebuchet MS',sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillStyle = "#2ee6a8";
    ctx.fillText(line.name, bx + 120, by + 14);

    // texte machine à écrire
    ctx.font = "15px 'Rubik','Trebuchet MS',sans-serif";
    ctx.fillStyle = "#f5ead6";
    const shown = line.text.slice(0, Math.floor(d.chars));
    const lines = wrapText(ctx, shown, bw - 140);
    lines.slice(0, 4).forEach((l, i) => ctx.fillText(l, bx + 120, by + 40 + i * 19));

    // indication
    if (d.chars >= line.text.length) {
      ctx.font = "12px 'Rubik','Trebuchet MS',sans-serif";
      ctx.fillStyle = "rgba(255,200,87," + (0.5 + Math.sin(w.time * 5) * 0.4) + ")";
      ctx.textAlign = "right";
      ctx.fillText("[E] continuer  (" + (d.i + 1) + "/" + d.lines.length + ")", bx + bw - 14, by + bh - 20);
    }
  }

  /* ---------- grande carte ---------- */

  function drawBigMap(ctx, w, W, H) {
    const pl = w.player;
    ctx.fillStyle = "rgba(10,8,16,0.88)";
    ctx.fillRect(0, 0, W, H);
    const size = Math.min(W, H) - 90;
    const mx = W / 2 - size / 2, my = H / 2 - size / 2 + 10;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(G.Map.minimap, mx, my, size, size);
    ctx.imageSmoothingEnabled = true;
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
