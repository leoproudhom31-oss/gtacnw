/* ============================================================
   JADE HARBOR — sprites.js
   Tout le visuel est dessiné au code (zéro asset externe) :
   piétons, véhicules, boîtes extrudées 2.5D, arbres, mobilier
   urbain, portraits de dialogue. Style « encre & néon » :
   aplats saturés + contours encre.
   ============================================================ */
"use strict";
(function (G) {

  const U = G.U;
  const INK = "#1a1424";

  /* =========================================================
     PIÉTONS — dessinés en direct (peu de formes), face à +x
     ========================================================= */

  // Palettes de tenues civiles
  const CIV_TOPS = ["#c94f4f", "#4f7fc9", "#c9a44f", "#7ac94f", "#9b59b6", "#e8e4d8",
                    "#3aa6a6", "#e07b39", "#5d6d7e", "#d63c6b", "#8d6e63", "#2e8b57"];
  const CIV_BOTTOMS = ["#33415c", "#4a4a4a", "#6b4f3a", "#2c3e50", "#5c4d7d", "#7f8c8d"];
  const SKINS = ["#f0c8a0", "#e8b48c", "#c68e5f", "#a06a42", "#8a5a34", "#f5d7b5"];
  const HAIRS = ["#1b1b1b", "#3a2a1a", "#5a3a1a", "#777777", "#101a2e", "#4d4d4d"];

  function pedLook(kind, rng) {
    switch (kind) {
      case "player": return { skin: "#e8b48c", hair: "#14181f", top: "#2ee6a8", top2: "#0f7a55", bottom: "#23262e", hat: null };
      case "wu":     return { skin: "#d9a878", hair: "#b9b9b9", top: "#6d6875", top2: "#4a4653", bottom: "#3a3a3a", hat: null };
      case "cop":    return { skin: U.pick(rng, SKINS), hair: "#222", top: "#2b4c7e", top2: "#1c3357", bottom: "#22304a", hat: "#22304a" };
      case "shark":  return { skin: U.pick(rng, SKINS), hair: "#181818", top: "#19b3c4", top2: "#0d7885", bottom: "#2c2c34", hat: "#0d7885" };
      case "lotus":  return { skin: U.pick(rng, SKINS), hair: "#101010", top: "#23202b", top2: "#141119", bottom: "#1b1820", hat: null, trim: "#ffc857" };
      default:       return { skin: U.pick(rng, SKINS), hair: U.pick(rng, HAIRS), top: U.pick(rng, CIV_TOPS), top2: null, bottom: U.pick(rng, CIV_BOTTOMS), hat: null };
    }
  }

  /**
   * Dessine un piéton. Le contexte doit déjà être translaté sur sa position.
   * angle : direction du regard. walk : phase de marche (0 si immobile).
   * pose : "idle" | "walk" | "punch" | "aim" | "down" | "sit" | "phone" | "cower"
   */
  function drawPed(ctx, look, angle, walkPhase, pose, opt) {
    opt = opt || {};
    ctx.save();
    ctx.rotate(angle);
    if (opt.scale && opt.scale !== 1) ctx.scale(opt.scale, opt.scale);
    if (pose === "cower") ctx.scale(0.86, 0.86);

    if (pose === "down") {
      // au sol
      ctx.globalAlpha = opt.alpha != null ? opt.alpha : 1;
      ctx.fillStyle = look.bottom;
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(-2, 0, 9, 5, 0, 0, U.TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = look.top;
      ctx.beginPath(); ctx.ellipse(3, 0, 7, 6, 0, 0, U.TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = look.skin;
      ctx.beginPath(); ctx.arc(10, 0, 4, 0, U.TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
      return;
    }

    const swing = Math.sin(walkPhase);
    const punchT = pose === "punch" ? (opt.punchT || 0) : 0; // 0..1

    // ombre portée
    ctx.fillStyle = "rgba(10,8,20,0.30)";
    ctx.beginPath(); ctx.ellipse(0, 2, 9, 7, 0, 0, U.TAU); ctx.fill();

    // pieds
    ctx.fillStyle = "#20242c";
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
    if (pose === "sit") {
      // jambes repliées devant
      ctx.beginPath(); ctx.ellipse(6, -3, 3.2, 2.4, 0, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(6, 3, 3.2, 2.4, 0, 0, U.TAU); ctx.fill();
    } else if (pose !== "cower") {
      ctx.beginPath(); ctx.ellipse(swing * 4, -4, 3.2, 2.4, 0, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-swing * 4, 4, 3.2, 2.4, 0, 0, U.TAU); ctx.fill();
    }

    // bras
    const armFwd = pose === "aim" ? 8 : (punchT > 0 ? punchT * 10 : 0);
    ctx.fillStyle = look.top2 || U.shade(look.top, -0.25);
    if (pose === "aim") {
      // deux bras tendus devant (tenue d'arme)
      ctx.beginPath(); ctx.ellipse(7, -3, 4.5, 2.6, 0.25, 0, U.TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(7, 3, 4.5, 2.6, -0.25, 0, U.TAU); ctx.fill(); ctx.stroke();
    } else if (pose === "cower") {
      // bras au-dessus de la tête
      ctx.beginPath(); ctx.ellipse(4.5, -3, 3.4, 2.6, 0.4, 0, U.TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(4.5, 3, 3.4, 2.6, -0.4, 0, U.TAU); ctx.fill(); ctx.stroke();
    } else if (pose === "phone") {
      // une main à l'oreille
      ctx.beginPath(); ctx.ellipse(1, 7, 3.4, 2.6, 0, 0, U.TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(4, -4.5, 3.2, 2.6, 0.5, 0, U.TAU); ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.ellipse(1 + swing * 3 + armFwd, -7, 3.4, 2.6, 0, 0, U.TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(1 - swing * 3 + (punchT > 0.5 ? armFwd : 0), 7, 3.4, 2.6, 0, 0, U.TAU); ctx.fill(); ctx.stroke();
    }

    // torse
    ctx.fillStyle = look.top;
    ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 6.5, 0, 0, U.TAU); ctx.fill(); ctx.stroke();
    if (look.trim) {
      ctx.strokeStyle = look.trim; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(2, -4); ctx.lineTo(5, 0); ctx.lineTo(2, 4); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
    }

    // arme en main
    if (opt.weapon && (pose === "aim" || opt.showWeapon)) {
      ctx.fillStyle = "#14141c";
      if (opt.weapon === "bat") {
        ctx.save(); ctx.rotate(0.5);
        ctx.fillStyle = "#a9805b";
        ctx.fillRect(6, -2, 14, 3.2);
        ctx.strokeRect(6, -2, 14, 3.2);
        ctx.restore();
      } else {
        const len = opt.weapon === "smg" ? 9 : (opt.weapon === "shotgun" ? 13 : 7);
        ctx.fillRect(9, -1.4, len, 2.8);
        ctx.strokeRect(9, -1.4, len, 2.8);
      }
    }

    // tête
    ctx.fillStyle = look.skin;
    ctx.beginPath(); ctx.arc(2.5, 0, 4.6, 0, U.TAU); ctx.fill(); ctx.stroke();
    // cheveux (arrière de la tête)
    ctx.fillStyle = look.hair;
    ctx.beginPath(); ctx.arc(1.2, 0, 4.6, Math.PI * 0.55, Math.PI * 1.45); ctx.fill();
    // casquette / bandana
    if (look.hat) {
      ctx.fillStyle = look.hat;
      ctx.beginPath(); ctx.arc(2.0, 0, 4.8, Math.PI * 0.45, Math.PI * 1.55); ctx.fill(); ctx.stroke();
    }

    ctx.restore();
  }

  /* =========================================================
     VÉHICULES — pré-rendus sur canvas offscreen (face à +x)
     ========================================================= */

  const VEHICLE_DEFS = {
    sedan:  { L: 46, W: 22, cabin: [0.28, 0.72], body: null,      maxSpeed: 290, accel: 210, grip: 7.5, turn: 2.6, hp: 100, mass: 1.00 },
    taxi:   { L: 46, W: 22, cabin: [0.28, 0.72], body: "#f7c948", maxSpeed: 290, accel: 215, grip: 7.5, turn: 2.7, hp: 100, mass: 1.00 },
    sport:  { L: 46, W: 20, cabin: [0.34, 0.66], body: null,      maxSpeed: 380, accel: 300, grip: 9.0, turn: 3.1, hp:  85, mass: 0.88 },
    van:    { L: 52, W: 25, cabin: [0.55, 0.95], body: null,      maxSpeed: 240, accel: 160, grip: 6.0, turn: 2.2, hp: 130, mass: 1.45 },
    pickup: { L: 50, W: 24, cabin: [0.42, 0.72], body: null,      maxSpeed: 260, accel: 185, grip: 6.8, turn: 2.4, hp: 120, mass: 1.30 },
    police: { L: 47, W: 22, cabin: [0.30, 0.70], body: "#e8e8ee", maxSpeed: 330, accel: 260, grip: 8.5, turn: 2.9, hp: 110, mass: 1.10 }
  };

  const CAR_COLORS = ["#c0392b", "#2980b9", "#27ae60", "#8e44ad", "#d35400", "#16a085",
                      "#7f8c8d", "#2c3e50", "#f5f0e6", "#a04000", "#5d6d7e", "#7d3c98"];

  const vehicleCache = new Map();

  function vehicleSprite(type, color) {
    const key = type + "|" + color;
    let c = vehicleCache.get(key);
    if (c) return c;

    const def = VEHICLE_DEFS[type];
    const pad = 6;
    c = document.createElement("canvas");
    c.width = def.L + pad * 2;
    c.height = def.W + pad * 2;
    const x = pad, y = pad, L = def.L, W = def.W;
    const ctx = c.getContext("2d");
    ctx.translate(x, y);

    const body = def.body || color;
    const dark = U.shade(body, -0.35);
    const lite = U.shade(body, 0.25);

    // roues (dépassent légèrement)
    ctx.fillStyle = "#101018";
    const wy = [-1.5, W - 3.5];
    for (const yy of wy) {
      ctx.fillRect(L * 0.12, yy, 8, 5);
      ctx.fillRect(L * 0.72, yy, 8, 5);
    }

    // carrosserie
    ctx.fillStyle = body;
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    roundRect(ctx, 0, 0, L, W, 6); ctx.fill(); ctx.stroke();

    // capot / coffre : nuances
    ctx.fillStyle = lite;
    roundRect(ctx, 2, 2, L - 4, 4, 3); ctx.fill();

    // cabine + vitres
    const c0 = L * def.cabin[0], c1 = L * def.cabin[1];
    ctx.fillStyle = dark;
    roundRect(ctx, c0 - 2, 1.5, (c1 - c0) + 4, W - 3, 4); ctx.fill();
    ctx.fillStyle = "#9fd8e8";
    // pare-brise (avant = +x)
    roundRect(ctx, c1 - 3, 2.5, 5, W - 5, 2); ctx.fill();
    // lunette arrière
    roundRect(ctx, c0 - 2, 3, 4, W - 6, 2); ctx.fill();
    // toit
    ctx.fillStyle = body;
    roundRect(ctx, c0 + 3, 2.5, (c1 - c0) - 8, W - 5, 3); ctx.fill();
    ctx.strokeStyle = "rgba(20,16,32,0.5)"; ctx.lineWidth = 1;
    roundRect(ctx, c0 + 3, 2.5, (c1 - c0) - 8, W - 5, 3); ctx.stroke();

    // phares / feux
    ctx.fillStyle = "#ffe9a8";
    ctx.fillRect(L - 2.5, 2, 2.5, 4);
    ctx.fillRect(L - 2.5, W - 6, 2.5, 4);
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(0, 2, 2.5, 4);
    ctx.fillRect(0, W - 6, 2.5, 4);

    // spécifiques
    if (type === "taxi") {
      ctx.fillStyle = "#1a1424";
      ctx.fillRect(c0 + (c1 - c0) / 2 - 5, W / 2 - 3, 10, 6);
      ctx.fillStyle = "#ffe9a8";
      ctx.font = "bold 5px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("TAXI", c0 + (c1 - c0) / 2, W / 2 + 0.5);
    }
    if (type === "police") {
      // bande latérale + toit
      ctx.fillStyle = "#1f3a63";
      ctx.fillRect(4, 0.5, L - 8, 4);
      ctx.fillRect(4, W - 4.5, L - 8, 4);
      ctx.fillStyle = "#ffc857";
      ctx.font = "bold 6px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.save(); ctx.translate(L * 0.5, W / 2); ctx.fillText("警", 0, 0.5); ctx.restore();
    }
    if (type === "sport") {
      // aileron
      ctx.fillStyle = dark;
      ctx.fillRect(1, 1.5, 4, W - 3);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.strokeRect(1, 1.5, 4, W - 3);
      // double bande
      ctx.fillStyle = "rgba(245,240,230,0.85)";
      ctx.fillRect(6, W / 2 - 3.5, L - 10, 2.4);
      ctx.fillRect(6, W / 2 + 1.1, L - 10, 2.4);
    }
    if (type === "van") {
      ctx.fillStyle = U.shade(body, -0.15);
      ctx.fillRect(4, 4, L * 0.45, W - 8);
      ctx.strokeStyle = "rgba(20,16,32,0.4)";
      ctx.strokeRect(4, 4, L * 0.45, W - 8);
    }
    if (type === "pickup") {
      // benne
      ctx.fillStyle = dark;
      roundRect(ctx, 2, 2.5, L * 0.34, W - 5, 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      roundRect(ctx, 2, 2.5, L * 0.34, W - 5, 2); ctx.stroke();
    }

    vehicleCache.set(key, c);
    return c;
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* =========================================================
     BOÎTE EXTRUDÉE 2.5D (bâtiments, conteneurs, caisses…)
     Le sommet est décalé radialement depuis le centre caméra :
     c'est CE trick qui donne la vue « Chinatown Wars ».
     ========================================================= */

  const EXTRUDE = 1 / 950; // intensité de la parallaxe verticale

  function elevate(px, py, h, camX, camY, out) {
    const f = h * EXTRUDE;
    out.x = px + (px - camX) * f;
    out.y = py + (py - camY) * f;
  }

  const _e = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];

  /**
   * Dessine une boîte extrudée (coordonnées monde ; le ctx est déjà
   * transformé caméra). corners = 4 sommets de la base (sens horaire).
   */
  function drawBoxPoly(ctx, corners, h, camX, camY, wallColor, roofColor, opt) {
    opt = opt || {};
    for (let i = 0; i < 4; i++) elevate(corners[i].x, corners[i].y, h, camX, camY, _e[i]);

    // faces latérales visibles uniquement (normale opposée au centre caméra)
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const nx = (b.y - a.y), ny = -(b.x - a.x); // normale extérieure (base horaire)
      if (nx * (mx - camX) + ny * (my - camY) <= 0) continue; // face cachée
      const ta = _e[i], tb = _e[(i + 1) % 4];
      // éclairage simple selon l'orientation (soleil au sud-ouest)
      const l = (nx * -0.6 + ny * 0.8) / Math.sqrt(nx * nx + ny * ny);
      ctx.fillStyle = U.shade(wallColor, -0.18 + l * 0.16);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.lineTo(tb.x, tb.y); ctx.lineTo(ta.x, ta.y);
      ctx.closePath();
      ctx.fill();
      // étages : lignes interpolées sur la face
      if (opt.floors > 1) {
        ctx.strokeStyle = "rgba(18,14,28,0.28)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let fI = 1; fI < opt.floors; fI++) {
          const t = fI / opt.floors;
          ctx.moveTo(a.x + (ta.x - a.x) * t, a.y + (ta.y - a.y) * t);
          ctx.lineTo(b.x + (tb.x - b.x) * t, b.y + (tb.y - b.y) * t);
        }
        ctx.stroke();
      }
      if (opt.windows) {
        ctx.fillStyle = "rgba(35,60,80,0.55)";
        const cols = Math.max(2, Math.round(U.dist(a.x, a.y, b.x, b.y) / 26));
        for (let ci = 0; ci < cols; ci++) {
          const t0 = (ci + 0.25) / cols, t1 = (ci + 0.75) / cols;
          const bax = a.x + (b.x - a.x) * t0, bay = a.y + (b.y - a.y) * t0;
          const bbx = a.x + (b.x - a.x) * t1, bby = a.y + (b.y - a.y) * t1;
          const tax = ta.x + (tb.x - ta.x) * t0, tay = ta.y + (tb.y - ta.y) * t0;
          const tbx = ta.x + (tb.x - ta.x) * t1, tby = ta.y + (tb.y - ta.y) * t1;
          ctx.beginPath();
          ctx.moveTo(bax + (tax - bax) * 0.18, bay + (tay - bay) * 0.18);
          ctx.lineTo(bbx + (tbx - bbx) * 0.18, bby + (tby - bby) * 0.18);
          ctx.lineTo(tbx - (tbx - bbx) * 0.10, tby - (tby - bby) * 0.10);
          ctx.lineTo(tax - (tax - bax) * 0.10, tay - (tay - bay) * 0.10);
          ctx.closePath(); ctx.fill();
        }
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(ta.x, ta.y);
      ctx.moveTo(b.x, b.y); ctx.lineTo(tb.x, tb.y);
      ctx.stroke();
    }

    // toit
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(_e[0].x, _e[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(_e[i].x, _e[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.stroke();

    return _e; // sommets du toit (réutilisés pour la déco)
  }

  const _c4 = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
  function drawBox(ctx, x, y, w, h, height, camX, camY, wallColor, roofColor, opt) {
    _c4[0].x = x;     _c4[0].y = y;
    _c4[1].x = x + w; _c4[1].y = y;
    _c4[2].x = x + w; _c4[2].y = y + h;
    _c4[3].x = x;     _c4[3].y = y + h;
    return drawBoxPoly(ctx, _c4, height, camX, camY, wallColor, roofColor, opt);
  }

  /* =========================================================
     PROPS (dessin dynamique, avec élévation pour les hauts)
     ========================================================= */

  const _p = { x: 0, y: 0 };

  const PROPS = {
    tree(ctx, p, camX, camY) {
      ctx.fillStyle = "rgba(10,8,20,0.25)";
      ctx.beginPath(); ctx.ellipse(p.x + 4, p.y + 4, 13, 10, 0, 0, U.TAU); ctx.fill();
      elevate(p.x, p.y, p.h || 46, camX, camY, _p);
      // tronc
      ctx.strokeStyle = "#5a3a22"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(_p.x, _p.y); ctx.stroke();
      // canopée (3 tons)
      const r = p.r || 15;
      ctx.fillStyle = "#2c6e49";
      ctx.beginPath(); ctx.arc(_p.x, _p.y, r, 0, U.TAU); ctx.fill();
      ctx.fillStyle = "#3f8f5f";
      ctx.beginPath(); ctx.arc(_p.x - r * 0.25, _p.y - r * 0.25, r * 0.72, 0, U.TAU); ctx.fill();
      ctx.fillStyle = "#5cb377";
      ctx.beginPath(); ctx.arc(_p.x - r * 0.35, _p.y - r * 0.35, r * 0.4, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(_p.x, _p.y, r, 0, U.TAU); ctx.stroke();
    },

    cherry(ctx, p, camX, camY) {
      ctx.fillStyle = "rgba(10,8,20,0.25)";
      ctx.beginPath(); ctx.ellipse(p.x + 4, p.y + 4, 12, 9, 0, 0, U.TAU); ctx.fill();
      elevate(p.x, p.y, p.h || 40, camX, camY, _p);
      ctx.strokeStyle = "#4a3226"; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(_p.x, _p.y); ctx.stroke();
      const r = p.r || 13;
      ctx.fillStyle = "#e58fb1";
      ctx.beginPath(); ctx.arc(_p.x, _p.y, r, 0, U.TAU); ctx.fill();
      ctx.fillStyle = "#f2b0c9";
      ctx.beginPath(); ctx.arc(_p.x - r * 0.3, _p.y - r * 0.3, r * 0.55, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(_p.x, _p.y, r, 0, U.TAU); ctx.stroke();
    },

    lamp(ctx, p, camX, camY) {
      elevate(p.x, p.y, 40, camX, camY, _p);
      ctx.strokeStyle = "#2a2f38"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(_p.x, _p.y); ctx.stroke();
      ctx.fillStyle = "#ffe9a8";
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(_p.x, _p.y, 4, 0, U.TAU); ctx.fill(); ctx.stroke();
    },

    lantern(ctx, p, camX, camY) {
      elevate(p.x, p.y, 34, camX, camY, _p);
      ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(_p.x, _p.y); ctx.stroke();
      ctx.fillStyle = "#ff4f4f";
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(_p.x, _p.y - 3, 5.5, 7, 0, 0, U.TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ffc857";
      ctx.fillRect(_p.x - 2, _p.y - 12, 4, 3);
      ctx.fillRect(_p.x - 2, _p.y + 3, 4, 3);
    },

    hydrant(ctx, p) {
      ctx.fillStyle = "rgba(10,8,20,0.25)";
      ctx.beginPath(); ctx.ellipse(p.x + 1.5, p.y + 1.5, 5, 4, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = "#d64541";
      ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4.4, 0, U.TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ff8a80";
      ctx.beginPath(); ctx.arc(p.x - 1.2, p.y - 1.2, 1.6, 0, U.TAU); ctx.fill();
    },

    bench(ctx, p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a || 0);
      ctx.fillStyle = "rgba(10,8,20,0.22)";
      ctx.fillRect(-11, -3, 24, 9);
      ctx.fillStyle = "#8a6242";
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.fillRect(-12, -4, 24, 8); ctx.strokeRect(-12, -4, 24, 8);
      ctx.strokeStyle = "rgba(20,16,32,0.4)";
      ctx.beginPath();
      ctx.moveTo(-12, -1); ctx.lineTo(12, -1);
      ctx.moveTo(-12, 2); ctx.lineTo(12, 2);
      ctx.stroke();
      ctx.restore();
    },

    stall(ctx, p, camX, camY) {
      // étal de marché : boîte basse + auvent rayé
      ctx.save();
      const w = 30, h = 20;
      drawBox(ctx, p.x - w / 2, p.y - h / 2, w, h, 14, camX, camY, "#7a5230", p.c1 || "#c0392b");
      // rayures de l'auvent sur le toit
      elevate(p.x - w / 2, p.y - h / 2, 14, camX, camY, _p);
      const tx = _p.x, ty = _p.y;
      elevate(p.x + w / 2, p.y + h / 2, 14, camX, camY, _p);
      ctx.fillStyle = p.c2 || "#f5f0e6";
      const stripes = 4;
      for (let i = 0; i < stripes; i += 2) {
        const x0 = tx + (i / stripes) * (_p.x - tx);
        const x1 = tx + ((i + 1) / stripes) * (_p.x - tx);
        ctx.fillRect(Math.min(x0, x1), Math.min(ty, _p.y) + 1.5, Math.abs(x1 - x0), Math.abs(_p.y - ty) - 3);
      }
      ctx.restore();
    },

    container(ctx, p, camX, camY) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a || 0);
      ctx.translate(-p.x, -p.y);
      const w = p.w || 76, h = p.hh || 30;
      const roof = U.shade(p.c || "#c0632b", -0.12);
      drawBox(ctx, p.x - w / 2, p.y - h / 2, w, h, p.h || 26, camX, camY, p.c || "#c0632b", roof);
      ctx.restore();
    },

    crate(ctx, p, camX, camY) {
      const s = p.s || 16;
      drawBox(ctx, p.x - s / 2, p.y - s / 2, s, s, s * 0.8, camX, camY, "#a9805b", "#c3986f");
    },

    boat(ctx, p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a || 0);
      ctx.fillStyle = "rgba(6,20,26,0.35)";
      ctx.beginPath(); ctx.ellipse(2, 3, 30, 10, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = p.c || "#4a6d8c";
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-28, -8); ctx.lineTo(18, -8);
      ctx.quadraticCurveTo(34, 0, 18, 8);
      ctx.lineTo(-28, 8);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = U.shade(p.c || "#4a6d8c", 0.3);
      ctx.beginPath();
      ctx.moveTo(-24, -5); ctx.lineTo(14, -5);
      ctx.quadraticCurveTo(26, 0, 14, 5);
      ctx.lineTo(-24, 5);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#2f3640";
      ctx.fillRect(-20, -4, 12, 8);
      ctx.restore();
    },

    crane(ctx, p, camX, camY) {
      // grue portuaire stylisée
      elevate(p.x, p.y, 120, camX, camY, _p);
      ctx.strokeStyle = "#b3541e"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(_p.x, _p.y); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      const bx = _p.x, by = _p.y;
      // flèche horizontale
      ctx.strokeStyle = "#b3541e"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(bx - 55, by); ctx.lineTo(bx + 30, by); ctx.stroke();
      ctx.fillStyle = "#8c3f14";
      ctx.fillRect(bx - 6, by - 8, 14, 12);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
      ctx.strokeRect(bx - 6, by - 8, 14, 12);
      // câble + crochet
      ctx.strokeStyle = "#20242c"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(bx - 45, by); ctx.lineTo(bx - 45, by + 26); ctx.stroke();
      ctx.fillStyle = "#ffc857";
      ctx.fillRect(bx - 48, by + 26, 6, 5);
      // base
      ctx.fillStyle = "#33383f";
      ctx.fillRect(p.x - 9, p.y - 6, 18, 12);
      ctx.strokeRect(p.x - 9, p.y - 6, 18, 12);
    },

    planter(ctx, p) {
      ctx.fillStyle = "#6b4f3a";
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.fillRect(p.x - 8, p.y - 8, 16, 16);
      ctx.strokeRect(p.x - 8, p.y - 8, 16, 16);
      ctx.fillStyle = "#3f8f5f";
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, U.TAU); ctx.fill();
      ctx.fillStyle = "#e58fb1";
      ctx.beginPath(); ctx.arc(p.x - 2, p.y - 2, 2, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x + 3, p.y + 1, 1.8, 0, U.TAU); ctx.fill();
    },

    trash(ctx, p) {
      ctx.fillStyle = "rgba(10,8,20,0.22)";
      ctx.beginPath(); ctx.ellipse(p.x + 1.5, p.y + 1.5, 6, 5, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = "#4a5568";
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5.5, 0, U.TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#2d3748";
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, U.TAU); ctx.fill();
    }
  };

  /* =========================================================
     HÉLICOPTÈRE DE POLICE (dessiné en altitude par le moteur)
     ========================================================= */

  function drawHelicopter(ctx, x, y, angle, rotor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = INK;
    // patins
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#20242c";
    ctx.beginPath();
    ctx.moveTo(-14, -11); ctx.lineTo(12, -11);
    ctx.moveTo(-14, 11); ctx.lineTo(12, 11);
    ctx.stroke();
    // queue
    ctx.fillStyle = "#2b4c7e";
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.fillRect(-34, -3, 22, 6);
    ctx.strokeRect(-34, -3, 22, 6);
    // rotor de queue
    ctx.save();
    ctx.translate(-34, 0);
    ctx.rotate(rotor * 2.2);
    ctx.strokeStyle = "#14181f"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.stroke();
    ctx.restore();
    // cellule
    ctx.fillStyle = "#2b4c7e";
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 17, 10, 0, 0, U.TAU); ctx.fill(); ctx.stroke();
    // verrière (avant = +x)
    ctx.fillStyle = "#9fd8e8";
    ctx.beginPath(); ctx.ellipse(7, 0, 8, 7, 0, -1.2, 1.2); ctx.fill();
    // marquage
    ctx.fillStyle = "#ffc857";
    ctx.font = "bold 8px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.save(); ctx.rotate(Math.PI / 2); ctx.fillText("警", 0, 3); ctx.restore();
    // rotor principal (flou + pales)
    ctx.fillStyle = "rgba(20,20,30,0.14)";
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, U.TAU); ctx.fill();
    ctx.save();
    ctx.rotate(rotor);
    ctx.strokeStyle = "rgba(16,16,24,0.85)"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-30, 0); ctx.lineTo(30, 0);
    ctx.moveTo(0, -30); ctx.lineTo(0, 30);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#14181f";
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, U.TAU); ctx.fill();
    ctx.restore();
  }

  /* =========================================================
     PORTRAITS DE DIALOGUE (96×96, mis en cache)
     ========================================================= */

  const portraitCache = new Map();

  function portrait(id) {
    let c = portraitCache.get(id);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = 96; c.height = 96;
    const x = c.getContext("2d");

    // fond : motif « soleil levant »
    const bgs = { jin: "#0f3d30", wu: "#3d2f0f", shark: "#0f2f3d", cop: "#1a2440", lotus: "#241a30" };
    x.fillStyle = bgs[id] || "#241a30";
    x.fillRect(0, 0, 96, 96);
    x.strokeStyle = "rgba(255,200,87,0.15)";
    x.lineWidth = 5;
    for (let i = 0; i < 7; i++) {
      x.beginPath();
      x.moveTo(48, 96);
      const a = Math.PI + (i / 6) * Math.PI;
      x.lineTo(48 + Math.cos(a) * 130, 96 + Math.sin(a) * 130);
      x.stroke();
    }

    x.strokeStyle = INK;
    x.lineWidth = 2.4;

    function head(skin) {
      x.fillStyle = skin;
      x.beginPath(); x.ellipse(48, 46, 21, 24, 0, 0, U.TAU); x.fill(); x.stroke();
    }
    function eyes(dx) {
      x.fillStyle = INK;
      x.beginPath(); x.ellipse(40, 44 + (dx || 0), 2.6, 3.4, 0, 0, U.TAU); x.fill();
      x.beginPath(); x.ellipse(57, 44 + (dx || 0), 2.6, 3.4, 0, 0, U.TAU); x.fill();
    }
    function mouth(w, sad) {
      x.strokeStyle = INK; x.lineWidth = 2;
      x.beginPath();
      if (sad) x.arc(48, 62, w, Math.PI * 1.15, Math.PI * 1.85);
      else x.arc(48, 56, w, Math.PI * 0.15, Math.PI * 0.85);
      x.stroke();
      x.lineWidth = 2.4;
    }
    function shoulders(color) {
      x.fillStyle = color;
      x.beginPath();
      x.moveTo(12, 96); x.quadraticCurveTo(48, 62, 84, 96);
      x.closePath(); x.fill(); x.stroke();
    }

    if (id === "jin") {
      shoulders("#2ee6a8");
      head("#e8b48c");
      // undercut
      x.fillStyle = "#14181f";
      x.beginPath();
      x.moveTo(27, 44); x.quadraticCurveTo(30, 18, 52, 20);
      x.quadraticCurveTo(70, 21, 69, 42);
      x.quadraticCurveTo(60, 28, 44, 30);
      x.quadraticCurveTo(31, 32, 27, 44);
      x.closePath(); x.fill(); x.stroke();
      eyes(); mouth(6);
      // écouteur
      x.fillStyle = "#ffc857";
      x.beginPath(); x.arc(68, 48, 3, 0, U.TAU); x.fill();
    } else if (id === "wu") {
      shoulders("#6d6875");
      head("#d9a878");
      x.fillStyle = "#b9b9b9";
      x.beginPath(); // barbiche
      x.moveTo(41, 66); x.quadraticCurveTo(48, 84, 55, 66);
      x.closePath(); x.fill(); x.stroke();
      x.beginPath(); // sourcils épais
      x.fillRect(34, 37, 11, 3); x.fillRect(51, 37, 11, 3);
      eyes(2); mouth(5);
      // calotte
      x.fillStyle = "#2c2c34";
      x.beginPath(); x.ellipse(48, 27, 19, 9, 0, Math.PI, 0); x.fill(); x.stroke();
      x.fillStyle = "#ffc857";
      x.beginPath(); x.arc(48, 22, 2.5, 0, U.TAU); x.fill();
    } else if (id === "shark") {
      shoulders("#19b3c4");
      head("#c68e5f");
      // bandana requin
      x.fillStyle = "#0d7885";
      x.beginPath();
      x.moveTo(26, 40); x.quadraticCurveTo(48, 14, 70, 40);
      x.lineTo(70, 33); x.quadraticCurveTo(48, 10, 26, 33);
      x.closePath(); x.fill(); x.stroke();
      x.fillStyle = "#e8f6f8";
      // dents dessinées sur le bandana
      for (let i = 0; i < 4; i++) {
        x.beginPath();
        x.moveTo(34 + i * 8, 34); x.lineTo(38 + i * 8, 26); x.lineTo(42 + i * 8, 34);
        x.closePath(); x.fill();
      }
      eyes(); mouth(6, true);
      // cicatrice
      x.strokeStyle = "#8a4a2a"; x.lineWidth = 2;
      x.beginPath(); x.moveTo(60, 50); x.lineTo(66, 60); x.stroke();
    } else if (id === "cop") {
      shoulders("#2b4c7e");
      head("#f0c8a0");
      eyes(); mouth(4, true);
      // casquette
      x.fillStyle = "#22304a";
      x.beginPath(); x.ellipse(48, 28, 22, 11, 0, Math.PI, 0); x.fill(); x.stroke();
      x.fillRect(26, 26, 44, 6);
      x.strokeRect(26, 26, 44, 6);
      x.fillStyle = "#ffc857";
      x.beginPath(); x.arc(48, 24, 3.5, 0, U.TAU); x.fill(); x.stroke();
      // lunettes
      x.fillStyle = "#14181f";
      x.fillRect(33, 40, 13, 7); x.fillRect(51, 40, 13, 7);
      x.strokeRect(33, 40, 13, 7); x.strokeRect(51, 40, 13, 7);
    } else { // lotus / défaut
      shoulders("#23202b");
      head("#e8b48c");
      x.fillStyle = "#101010";
      x.beginPath();
      x.moveTo(27, 46); x.quadraticCurveTo(28, 16, 48, 18);
      x.quadraticCurveTo(68, 16, 69, 46);
      x.quadraticCurveTo(62, 26, 48, 27);
      x.quadraticCurveTo(34, 26, 27, 46);
      x.closePath(); x.fill(); x.stroke();
      eyes(); mouth(5);
      x.strokeStyle = "#ffc857"; x.lineWidth = 2;
      x.beginPath(); x.moveTo(30, 84); x.quadraticCurveTo(48, 70, 66, 84); x.stroke();
    }

    portraitCache.set(id, c);
    return c;
  }

  G.Sprites = {
    INK, drawPed, pedLook,
    VEHICLE_DEFS, CAR_COLORS, vehicleSprite,
    drawBox, drawBoxPoly, elevate, EXTRUDE,
    PROPS, portrait, roundRect, drawHelicopter
  };

})(window.G);
