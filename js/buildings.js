/* ============================================================
   JADE HARBOR — buildings.js  (moteur v3)
   Rendu de bâtiments détaillé : ombrage par face, façades
   matiérées, vitrines de rez-de-chaussée, fenêtres à cadres et
   meneaux avec lueur, corniches, bandeaux d'étage, balcons,
   entrées, toits variés, enseignes néon. Tout est dessiné au
   canvas, trié par profondeur par le moteur de carte.
   ============================================================ */
"use strict";
(function (G) {

  const U = G.U, S = G.Sprites, MD = G.MapData;
  const T = MD.T;
  const INK = S.INK || "#1a1424";

  // lumière (heure dorée, soleil au sud-ouest) : sert à teinter chaque
  // face selon son orientation pour un vrai relief.
  const LIGHT = { x: -0.55, y: 0.83 };

  function h2(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function interpQuad(pts, u, v) {
    const p0 = pts[0], p1 = pts[1], p2 = pts[2], p3 = pts[3];
    // p0 = base-gauche, p1 = base-droite, p2 = haut-droite, p3 = haut-gauche
    const bx = p0.x + (p1.x - p0.x) * u, by = p0.y + (p1.y - p0.y) * u;
    const tx = p3.x + (p2.x - p3.x) * u, ty = p3.y + (p2.y - p3.y) * u;
    return { x: bx + (tx - bx) * v, y: by + (ty - by) * v };
  }

  // rectangle (en coords face u,v) → polygone écran, rempli + tracé option
  function faceRect(ctx, pts, u0, v0, u1, v1) {
    const a = interpQuad(pts, u0, v0), b = interpQuad(pts, u1, v0);
    const c = interpQuad(pts, u1, v1), d = interpQuad(pts, u0, v1);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath();
  }

  /* =========================================================
     FAÇADES MATIÉRÉES (par face visible)
     ========================================================= */

  function drawFacadeMaterial(ctx, pts, texture, wallColor, seed, w, h) {
    switch (texture) {
      case "brick":      return matBrick(ctx, pts, w, h, wallColor);
      case "concrete":   return matPanels(ctx, pts, w, h, 22, 18, 0.10);
      case "glass":      return matGlass(ctx, pts, w, h, seed);
      case "wood":       return matWood(ctx, pts, w, h, seed);
      case "corrugated": return matCorrugated(ctx, pts, w, h, wallColor);
      case "metal":      return matPanels(ctx, pts, w, h, 16, 14, 0.14);
      case "tile":       return matPanels(ctx, pts, w, h, 8, 8, 0.10);
      case "stucco":     return matStucco(ctx, pts, w, h, seed);
    }
  }

  function matBrick(ctx, pts, w, h, wall) {
    const rows = U.clamp(Math.round(h / 5), 4, 46);
    const cols = U.clamp(Math.round(w / 9), 3, 28);
    ctx.strokeStyle = "rgba(50,28,18,0.22)"; ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let r = 1; r < rows; r++) {
      const v = r / rows;
      const a = interpQuad(pts, 0, v), b = interpQuad(pts, 1, v);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    for (let r = 0; r < rows; r++) {
      const v0 = r / rows, v1 = (r + 1) / rows;
      const off = (r & 1) ? 0.5 / cols : 0;
      for (let c = 1; c < cols; c++) {
        let u = c / cols + off; if (u >= 1) continue;
        const a = interpQuad(pts, u, v0), b = interpQuad(pts, u, v1);
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      }
    }
    ctx.stroke();
  }

  function matPanels(ctx, pts, w, h, cellH, cellW, alpha) {
    const rows = U.clamp(Math.round(h / cellH), 2, 30);
    const cols = U.clamp(Math.round(w / cellW), 2, 26);
    ctx.strokeStyle = "rgba(0,0,0," + alpha + ")"; ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let r = 1; r < rows; r++) {
      const a = interpQuad(pts, 0, r / rows), b = interpQuad(pts, 1, r / rows);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    for (let c = 1; c < cols; c++) {
      const a = interpQuad(pts, c / cols, 0), b = interpQuad(pts, c / cols, 1);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }

  function matGlass(ctx, pts, w, h, seed) {
    // reflets diagonaux clairs sur le rideau de verre
    ctx.strokeStyle = "rgba(210,240,255,0.10)"; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const u = 0.12 + h2(seed + i * 3, seed) * 0.7;
      const p = interpQuad(pts, u, 0.05), q = interpQuad(pts, u + 0.08, 0.85);
      ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
  }

  function matWood(ctx, pts, w, h, seed) {
    const planks = U.clamp(Math.round(w / 6), 3, 24);
    ctx.strokeStyle = "rgba(45,26,12,0.28)"; ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let c = 1; c < planks; c++) {
      const a = interpQuad(pts, c / planks, 0), b = interpQuad(pts, c / planks, 1);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }

  function matCorrugated(ctx, pts, w, h, wall) {
    const ridges = U.clamp(Math.round(w / 4), 5, 40);
    for (let c = 0; c < ridges; c++) {
      const u0 = c / ridges, u1 = (c + 0.5) / ridges;
      ctx.fillStyle = (c & 1) ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.10)";
      faceRect(ctx, pts, u0, 0, u1, 1); ctx.fill();
    }
  }

  function matStucco(ctx, pts, w, h, seed) {
    // léger mouchetis + fissures discrètes
    ctx.strokeStyle = "rgba(0,0,0,0.06)"; ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const u = 0.2 + h2(seed + i, seed * 2) * 0.6;
      const p = interpQuad(pts, u, 0.15 + h2(seed, i) * 0.2);
      const q = interpQuad(pts, u + 0.02, 0.6 + h2(i, seed) * 0.3);
      ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
  }

  /* =========================================================
     FENÊTRES (étages supérieurs) — cadre + verre + meneaux
     ========================================================= */

  const AWNING_COLORS = ["#c0392b", "#1e8449", "#2874a6", "#b9770e", "#7d3c98", "#0e6655"];
  const CURTAIN_COLORS = ["rgba(240,230,210,0.55)", "rgba(220,180,150,0.5)", "rgba(180,200,220,0.5)"];

  function drawUpperWindows(ctx, pts, style, floorsUpper, groundV, seed, w) {
    const conf = MD.WINDOW_STYLES[style] || MD.WINDOW_STYLES.modern;
    if (w < 12 || floorsUpper < 1) return;

    const spacing = style === "industrial" ? 34 : (style === "shopfront" ? 30 : 24);
    const cols = U.clamp(Math.round(w / spacing), 2, 9);
    const detailed = w > 26 && floorsUpper <= 7; // fioritures seulement de près
    const trad = style === "traditional" || style === "shuttered" || style === "arched";
    const span = (0.96 - groundV) / floorsUpper;

    for (let ri = 0; ri < floorsUpper; ri++) {
      const vb = groundV + ri * span;
      const v0 = vb + span * 0.16;
      const v1 = vb + span * 0.80;
      const margin = style === "industrial" ? 0.10 : 0.20;

      for (let ci = 0; ci < cols; ci++) {
        const c0 = (ci + margin) / cols;
        const c1 = (ci + 1 - margin) / cols;
        const lit = h2(seed + ci * 13.7, seed + ri * 29.3) > (1 - conf.lit);

        // verre (une seule passe de remplissage)
        if (style === "arched") {
          const a = interpQuad(pts, c0, v1), b = interpQuad(pts, c1, v1);
          const c = interpQuad(pts, c1, v0), d = interpQuad(pts, c0, v0);
          const topMid = interpQuad(pts, (c0 + c1) / 2, v0 - span * 0.14);
          ctx.fillStyle = lit ? "rgba(255,214,140,0.86)" : conf.dark;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y);
          ctx.quadraticCurveTo(topMid.x, topMid.y, d.x, d.y);
          ctx.closePath(); ctx.fill();
        } else {
          ctx.fillStyle = lit ? "rgba(255,214,140,0.86)" : conf.dark;
          faceRect(ctx, pts, c0, v0, c1, v1); ctx.fill();
        }

        // cadre + meneau en croix : un seul tracé, un seul stroke
        const cm = (c0 + c1) / 2, vm = (v0 + v1) / 2;
        const P0 = interpQuad(pts, c0, v0), P1 = interpQuad(pts, c1, v0);
        const P2 = interpQuad(pts, c1, v1), P3 = interpQuad(pts, c0, v1);
        ctx.strokeStyle = "rgba(240,236,224,0.5)"; ctx.lineWidth = conf.frameW || 1;
        ctx.beginPath();
        ctx.moveTo(P0.x, P0.y); ctx.lineTo(P1.x, P1.y);
        ctx.lineTo(P2.x, P2.y); ctx.lineTo(P3.x, P3.y); ctx.closePath();
        const mvt = interpQuad(pts, cm, v0), mvb = interpQuad(pts, cm, v1);
        const mhl = interpQuad(pts, c0, vm), mhr = interpQuad(pts, c1, vm);
        ctx.moveTo(mvt.x, mvt.y); ctx.lineTo(mvb.x, mvb.y);
        ctx.moveTo(mhl.x, mhl.y); ctx.lineTo(mhr.x, mhr.y);
        ctx.stroke();

        if (!detailed) continue;

        // rideau sur certaines fenêtres éteintes
        if (!lit && h2(seed + ci, seed + ri * 5) > 0.62) {
          ctx.fillStyle = CURTAIN_COLORS[(ci + ri) % CURTAIN_COLORS.length];
          faceRect(ctx, pts, c0, v0, cm, v1); ctx.fill();
        }
        // appui de fenêtre (bas de baie, styles traditionnels)
        if (trad) {
          ctx.strokeStyle = "rgba(230,224,205,0.7)"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(P0.x, P0.y); ctx.lineTo(P1.x, P1.y); ctx.stroke();
        }
        // volets (style shuttered)
        if (style === "shuttered" && h2(seed + ci + ri * 7, seed) > 0.5) {
          ctx.fillStyle = "rgba(70,45,25,0.55)";
          faceRect(ctx, pts, c0 - 0.05, v0, c0, v1); ctx.fill();
          faceRect(ctx, pts, c1, v0, c1 + 0.05, v1); ctx.fill();
        }
        // jardinière fleurie occasionnelle (posée sur l'appui)
        if (trad && h2(seed + ci * 3, seed + ri * 11) > 0.74) {
          const box = interpQuad(pts, cm, v0);
          ctx.fillStyle = "#6a4a2a";
          ctx.fillRect(box.x - (c1 - c0) * w * 0.5, box.y - 1, (c1 - c0) * w, 3);
          ctx.fillStyle = h2(ci, ri) > 0.5 ? "#e05a7a" : "#e0a52f";
          ctx.beginPath();
          ctx.arc(box.x - 3, box.y, 1.5, 0, Math.PI * 2);
          ctx.arc(box.x + 3, box.y, 1.5, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  /* =========================================================
     REZ-DE-CHAUSSÉE : vitrines / entrées
     ========================================================= */

  function drawGroundFloor(ctx, pts, b, groundV, isFront, seed, w) {
    // socle sombre + vitrines
    const commercial = b.archetype === "shophouse" || b.archetype === "commercial" ||
                       b.archetype === "office" || b.awning;

    // bandeau de rez-de-chaussée (matière plus sombre = pierre/soubassement)
    ctx.fillStyle = "rgba(20,16,26,0.30)";
    faceRect(ctx, pts, 0, 0, 1, groundV); ctx.fill();

    if (commercial && isFront) {
      const bays = U.clamp(Math.round(w / 34), 1, 6);
      for (let i = 0; i < bays; i++) {
        const c0 = (i + 0.12) / bays, c1 = (i + 0.88) / bays;
        const isDoor = (i === (Math.floor(h2(seed, i) * bays)));
        if (isDoor) {
          // porte vitrée
          ctx.fillStyle = "rgba(30,40,50,0.85)";
          faceRect(ctx, pts, (c0 + c1) / 2 - 0.10 / bays * 2, 0, (c0 + c1) / 2 + 0.10 / bays * 2, groundV * 0.92);
          ctx.fill();
          ctx.strokeStyle = "#c9a227"; ctx.lineWidth = 1.4;
          faceRect(ctx, pts, (c0 + c1) / 2 - 0.10 / bays * 2, 0, (c0 + c1) / 2 + 0.10 / bays * 2, groundV * 0.92);
          ctx.stroke();
        } else {
          // vitrine éclairée
          const lit = h2(seed + i * 5, seed) > 0.35;
          ctx.fillStyle = lit ? "rgba(255,224,150,0.65)" : "rgba(60,90,110,0.65)";
          faceRect(ctx, pts, c0, groundV * 0.18, c1, groundV * 0.86); ctx.fill();
          ctx.strokeStyle = "rgba(20,16,26,0.8)"; ctx.lineWidth = 1.6;
          faceRect(ctx, pts, c0, groundV * 0.18, c1, groundV * 0.86); ctx.stroke();
          // reflets / marchandise (silhouettes)
          ctx.fillStyle = "rgba(20,16,26,0.35)";
          faceRect(ctx, pts, c0 + 0.02, groundV * 0.5, c0 + (c1 - c0) * 0.35, groundV * 0.84); ctx.fill();
        }
      }
      // store-banne (auvent) au-dessus des vitrines
      const aw = b.awning || AWNING_COLORS[(b.tx + b.ty) % AWNING_COLORS.length];
      drawAwningStripe(ctx, pts, groundV * 0.9, groundV * 1.02, aw, bays);
    } else if (isFront) {
      // entrée classique (immeuble d'habitation / civique)
      const dw = 0.16;
      ctx.fillStyle = "rgba(35,26,18,0.9)";
      faceRect(ctx, pts, 0.5 - dw / 2, 0, 0.5 + dw / 2, groundV * 0.9); ctx.fill();
      ctx.fillStyle = "#5a3a20";
      faceRect(ctx, pts, 0.5 - dw / 2 + 0.02, 0.02, 0.5 + dw / 2 - 0.02, groundV * 0.86); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
      faceRect(ctx, pts, 0.5 - dw / 2, 0, 0.5 + dw / 2, groundV * 0.9); ctx.stroke();
      // imposte + poignée dorée
      ctx.fillStyle = "#c9a227";
      const hd = interpQuad(pts, 0.5 + dw / 2 - 0.03, groundV * 0.45);
      ctx.beginPath(); ctx.arc(hd.x, hd.y, 1.5, 0, Math.PI * 2); ctx.fill();
      // deux petites fenêtres de part et d'autre
      for (const cc of [0.22, 0.78]) {
        ctx.fillStyle = h2(seed + cc * 10, seed) > 0.5 ? "rgba(255,214,140,0.7)" : "rgba(50,70,90,0.7)";
        faceRect(ctx, pts, cc - 0.07, groundV * 0.35, cc + 0.07, groundV * 0.8); ctx.fill();
        ctx.strokeStyle = "rgba(230,224,205,0.5)"; ctx.lineWidth = 1;
        faceRect(ctx, pts, cc - 0.07, groundV * 0.35, cc + 0.07, groundV * 0.8); ctx.stroke();
      }
    }
    // ligne de séparation rez / étages (bandeau)
    ctx.strokeStyle = "rgba(245,240,228,0.35)"; ctx.lineWidth = 2;
    const a = interpQuad(pts, 0, groundV), bb = interpQuad(pts, 1, groundV);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bb.x, bb.y); ctx.stroke();
  }

  function drawAwningStripe(ctx, pts, v0, v1, color, bays) {
    for (let i = 0; i < bays; i++) {
      const c0 = i / bays, c1 = (i + 1) / bays;
      ctx.fillStyle = (i & 1) ? color : U.shade(color, -0.18);
      faceRect(ctx, pts, c0, v0, c1, v1); ctx.fill();
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 1;
    faceRect(ctx, pts, 0, v0, 1, v1); ctx.stroke();
  }

  /* =========================================================
     BANDEAUX D'ÉTAGE + CORNICHE
     ========================================================= */

  function drawStringCourses(ctx, pts, floorsUpper, groundV, wall) {
    if (floorsUpper < 2) return;
    ctx.strokeStyle = U.shade(wall, 0.14); ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let f = 1; f < floorsUpper; f++) {
      const v = groundV + (0.96 - groundV) * (f / floorsUpper);
      const a = interpQuad(pts, 0, v), b = interpQuad(pts, 1, v);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }

  function drawCornice(ctx, pts, wall, trim) {
    // corniche saillante juste sous le toit
    ctx.fillStyle = trim || U.shade(wall, 0.20);
    faceRect(ctx, pts, -0.01, 0.955, 1.01, 1.0); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.1;
    faceRect(ctx, pts, -0.01, 0.955, 1.01, 1.0); ctx.stroke();
    // fine ombre portée dessous
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    faceRect(ctx, pts, 0, 0.93, 1, 0.955); ctx.fill();
  }

  /* =========================================================
     PIGNONS / DÉTAILS DE TOIT (élévation)
     ========================================================= */

  function drawACUnits(ctx, b, camX, camY) {
    const rng = U.makeRng((b.tx * 431 + b.ty * 233) >>> 0);
    const n = U.clamp(Math.floor(b.tw * b.th / 12), 1, 6);
    for (let i = 0; i < n; i++) {
      const side = rng() < 0.5 ? 0 : 1;
      const wx = side === 0 ? b.x + 2 : b.x + b.w - 2;
      const wy = b.y + b.h * (0.2 + rng() * 0.6);
      const hh = b.height * (0.25 + rng() * 0.55);
      const p = { x: 0, y: 0 };
      S.elevate(wx, wy, hh, camX, camY, p);
      ctx.fillStyle = "#cbc7bd"; ctx.strokeStyle = INK; ctx.lineWidth = 0.8;
      ctx.fillRect(p.x - 4, p.y - 3, 8, 6); ctx.strokeRect(p.x - 4, p.y - 3, 8, 6);
      ctx.strokeStyle = "rgba(0,0,0,0.28)"; ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(p.x - 2.5, p.y - 1); ctx.lineTo(p.x + 2.5, p.y - 1);
      ctx.moveTo(p.x - 2.5, p.y + 1); ctx.lineTo(p.x + 2.5, p.y + 1);
      ctx.stroke();
    }
  }

  function drawBalconies(ctx, b, camX, camY) {
    const rng = U.makeRng((b.tx * 811 + b.ty * 359) >>> 0);
    const nFloors = b.floors || 3;
    const front = b.y + b.h; // face sud
    for (let fi = 1; fi < nFloors; fi++) {
      if (rng() > 0.55) continue;
      const hgt = b.height * (fi / nFloors);
      const eL = { x: 0, y: 0 }, eR = { x: 0, y: 0 };
      S.elevate(b.x + 3, front, hgt, camX, camY, eL);
      S.elevate(b.x + b.w - 3, front, hgt, camX, camY, eR);
      // dalle
      ctx.fillStyle = "rgba(150,140,120,0.75)"; ctx.strokeStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(eL.x, eL.y + 5); ctx.lineTo(eR.x, eR.y + 5);
      ctx.lineTo(eR.x, eR.y); ctx.lineTo(eL.x, eL.y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // balustrade en fer forgé
      const n = Math.max(4, Math.round(U.dist(eL.x, eL.y, eR.x, eR.y) / 8));
      ctx.strokeStyle = "rgba(30,24,20,0.75)"; ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = eL.x + (eR.x - eL.x) * t, y = eL.y + (eR.y - eL.y) * t;
        ctx.moveTo(x, y); ctx.lineTo(x, y - 7);
      }
      ctx.moveTo(eL.x, eL.y - 7); ctx.lineTo(eR.x, eR.y - 7);
      ctx.stroke();
      if (rng() > 0.5) {
        const px = eL.x + (eR.x - eL.x) * (0.2 + rng() * 0.6);
        ctx.fillStyle = "#4a8f4a";
        ctx.beginPath(); ctx.arc(px, eL.y - 4, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawRoofAntenna(ctx, b, camX, camY) {
    const ax = b.cx + (h2(b.tx + 5, b.ty) - 0.5) * b.w * 0.4;
    const ay = b.cy + (h2(b.tx, b.ty + 5) - 0.5) * b.h * 0.4;
    const base = { x: 0, y: 0 }, top = { x: 0, y: 0 };
    S.elevate(ax, ay, b.height, camX, camY, base);
    S.elevate(ax, ay, b.height + 32, camX, camY, top);
    ctx.strokeStyle = "#2a2f38"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    ctx.fillStyle = "#ff4040";
    ctx.beginPath(); ctx.arc(top.x, top.y, 1.8, 0, Math.PI * 2); ctx.fill();
  }

  const LAUNDRY_COLORS = ["#f5ead6", "#ff8fb0", "#7ad7ff", "#ffc857", "#a9dfbf"];
  function drawRoofLaundry(ctx, b, camX, camY) {
    const rng = U.makeRng((b.tx * 733 + b.ty * 197) >>> 0);
    const y = b.y + b.h * U.rrange(rng, 0.3, 0.7);
    const p0 = { x: 0, y: 0 }, p1 = { x: 0, y: 0 };
    S.elevate(b.x + b.w * 0.15, y, b.height + 6, camX, camY, p0);
    S.elevate(b.x + b.w * 0.85, y, b.height + 6, camX, camY, p1);
    ctx.strokeStyle = "rgba(20,16,32,0.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    const n = 3 + (rng() * 3 | 0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = p0.x + (p1.x - p0.x) * t, yy = p0.y + (p1.y - p0.y) * t;
      ctx.fillStyle = U.pick(rng, LAUNDRY_COLORS);
      ctx.beginPath();
      ctx.moveTo(x - 4, yy); ctx.lineTo(x + 4, yy);
      ctx.lineTo(x + 3, yy + 7); ctx.lineTo(x - 3, yy + 7);
      ctx.closePath(); ctx.fill();
    }
  }

  const ROOFS_TOWER = ["tier2", "helipad", "tank", "antenna", "dish", "garden"];
  const ROOFS_LOW = ["tank", "antenna", "vents", "garden", "none", "none", "laundry"];
  const ROOFS_LOTUS = ["tank", "antenna", "laundry", "laundry", "none"];

  function drawRoofDetail(ctx, b, tcx, tcy, sc, camX, camY) {
    const rt = b.roofType;
    if (!rt || rt === "none") return;

    if (rt === "helipad") {
      ctx.strokeStyle = "#ffc857"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(tcx, tcy, 20 * sc, 0, Math.PI * 2); ctx.stroke();
      ctx.font = "bold " + Math.max(10, 22 * sc) + "px sans-serif";
      ctx.fillStyle = "#ffc857"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("H", tcx, tcy + 1);
      return;
    }
    if (rt === "vents") {
      ctx.fillStyle = U.shade(b.roof, -0.25); ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      const s = 16 * sc;
      ctx.fillRect(tcx - s + 4, tcy - s / 2, s, s * 0.8);
      ctx.strokeRect(tcx - s + 4, tcy - s / 2, s, s * 0.8);
      ctx.fillRect(tcx + 4, tcy - s / 4, s * 0.7, s * 0.6);
      ctx.strokeRect(tcx + 4, tcy - s / 4, s * 0.7, s * 0.6);
      return;
    }

    const jx = (h2(b.tx + 3, b.ty + 11) - 0.5) * Math.max(0, b.w - 30);
    const jy = (h2(b.tx + 19, b.ty + 7) - 0.5) * Math.max(0, b.h - 30);
    const cx = b.cx + jx, cy = b.cy + jy;
    const top = { x: 0, y: 0 };

    switch (rt) {
      case "tier2": {
        const extra = 24 + h2(b.tx, b.ty + 3) * 26;
        renderBuilding(ctx, {
          x: b.x + b.w * 0.24, y: b.y + b.h * 0.24, w: b.w * 0.52, h: b.h * 0.52,
          cx: b.cx, cy: b.cy, tx: b.tx + 2, ty: b.ty + 2, tw: Math.max(2, b.tw - 2),
          th: Math.max(2, b.th - 2),
          height: b.height + extra, floors: Math.max(2, (b.floors || 5) - 3),
          wall: U.shade(b.wall, 0.05), roof: U.shade(b.roof, 0.08),
          archetype: b.archetype, roofType: "antenna"
        }, camX, camY);
        break;
      }
      case "tank": {
        const s = 15 + h2(b.tx, b.ty + 3) * 7;
        S.drawBox(ctx, cx - s / 2, cy - s / 2, s, s, b.height + s * 1.4, camX, camY, "#9c8064", "#c2a67e");
        break;
      }
      case "antenna": {
        S.drawBox(ctx, cx - 2, cy - 2, 4, 4, b.height + 44, camX, camY, "#2a2f38", "#3a4048");
        S.elevate(cx, cy, b.height + 44, camX, camY, top);
        ctx.strokeStyle = "#2a2f38"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(top.x - 9, top.y); ctx.lineTo(top.x + 9, top.y); ctx.stroke();
        ctx.fillStyle = "#ff5340";
        ctx.beginPath(); ctx.arc(top.x, top.y, 2, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "dish": {
        S.drawBox(ctx, cx - 3, cy - 3, 6, 6, b.height + 16, camX, camY, "#2a2f38", "#3a4048");
        S.elevate(cx, cy, b.height + 16, camX, camY, top);
        ctx.fillStyle = "#c9d4d8"; ctx.strokeStyle = INK; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(top.x + 5, top.y - 2, 7, 5, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      }
      case "garden": {
        const gw = Math.min(b.w - 16, 30), gh = Math.min(b.h - 16, 22);
        S.drawBox(ctx, cx - gw / 2, cy - gh / 2, gw, gh, b.height + 5, camX, camY, "#3f5a3a", "#4a6b44");
        S.elevate(cx - gw * 0.2, cy - gh * 0.1, b.height + 9, camX, camY, top);
        ctx.fillStyle = "#5cb377";
        ctx.beginPath(); ctx.arc(top.x, top.y, 5, 0, Math.PI * 2); ctx.fill();
        S.elevate(cx + gw * 0.22, cy + gh * 0.15, b.height + 9, camX, camY, top);
        ctx.beginPath(); ctx.arc(top.x, top.y, 4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "laundry":
        drawRoofLaundry(ctx, b, camX, camY);
        break;
    }
  }

  /* =========================================================
     TOIT INCLINÉ (tuiles) pour shophouses / temples / villas
     ========================================================= */

  function drawPitchedRoof(ctx, tops, b, camX, camY) {
    // faîtage relevé façon toit asiatique (léger)
    const midTop = { x: (tops[0].x + tops[2].x) / 2, y: (tops[0].y + tops[2].y) / 2 };
    const ridge = { x: 0, y: 0 };
    S.elevate(b.cx, b.cy, b.height + Math.min(b.w, b.h) * 0.35, camX, camY, ridge);
    ctx.fillStyle = U.shade(b.roof, -0.05);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
    // deux versants (avant/arrière) vers la caméra
    ctx.beginPath();
    ctx.moveTo(tops[3].x, tops[3].y); ctx.lineTo(tops[2].x, tops[2].y);
    ctx.lineTo(ridge.x, ridge.y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = U.shade(b.roof, 0.06);
    ctx.beginPath();
    ctx.moveTo(tops[0].x, tops[0].y); ctx.lineTo(tops[1].x, tops[1].y);
    ctx.lineTo(ridge.x, ridge.y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // rangées de tuiles
    ctx.strokeStyle = "rgba(0,0,0,0.16)"; ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let k = 1; k < 4; k++) {
      const t = k / 4;
      ctx.moveTo(tops[3].x + (ridge.x - tops[3].x) * t, tops[3].y + (ridge.y - tops[3].y) * t);
      ctx.lineTo(tops[2].x + (ridge.x - tops[2].x) * t, tops[2].y + (ridge.y - tops[2].y) * t);
    }
    ctx.stroke();
  }

  /* =========================================================
     RENDU PRINCIPAL
     ========================================================= */

  const CORN = [{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}];
  const ELEV = [{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}];

  function renderBuilding(ctx, b, camX, camY) {
    const archConf = MD.ARCHETYPE_CONFIG[b.archetype || "office"] || MD.ARCHETYPE_CONFIG.office;
    const floors = Math.max(1, b.floors || 3);
    const pitched = (b.archetype === "shophouse" || b.archetype === "villa" ||
                     b.archetype === "temple") && b.height < 70;

    // 1. boîte de base (faces ombrées + toit) — sans fenêtres (on les fait nous-mêmes)
    const tops = S.drawBox(ctx, b.x, b.y, b.w, b.h, b.height, camX, camY, b.wall, b.roof,
                           { floors: 1 });

    // 2. matière + fenêtres + rez-de-chaussée sur les faces visibles
    CORN[0].x = b.x;       CORN[0].y = b.y;
    CORN[1].x = b.x + b.w; CORN[1].y = b.y;
    CORN[2].x = b.x + b.w; CORN[2].y = b.y + b.h;
    CORN[3].x = b.x;       CORN[3].y = b.y + b.h;
    for (let i = 0; i < 4; i++) S.elevate(CORN[i].x, CORN[i].y, b.height, camX, camY, ELEV[i]);

    const groundV = U.clamp(1 / (floors + 0.6), 0.12, 0.34);
    const floorsUpper = Math.max(1, floors - 1);
    // la face « avant » est la face sud (celle qui donne sur la rue en vue du dessus)
    let frontFace = -1, frontDot = -1;

    const faces = [];
    for (let i = 0; i < 4; i++) {
      const a = CORN[i], bb = CORN[(i + 1) % 4];
      const mx = (a.x + bb.x) / 2, my = (a.y + bb.y) / 2;
      const nx = (bb.y - a.y), ny = -(bb.x - a.x);
      if (nx * (mx - camX) + ny * (my - camY) <= 0) continue; // face cachée
      const ta = ELEV[i], tb = ELEV[(i + 1) % 4];
      const pts = [{ x: a.x, y: a.y }, { x: bb.x, y: bb.y }, { x: tb.x, y: tb.y }, { x: ta.x, y: ta.y }];
      const w = U.dist(a.x, a.y, bb.x, bb.y);
      const isSouth = ny > 0; // face vers le sud (bas)
      faces.push({ i, pts, w, isSouth });
      if (isSouth && ny > frontDot) { frontDot = ny; frontFace = faces.length - 1; }
    }

    for (let k = 0; k < faces.length; k++) {
      const f = faces[k];
      const seed = b.tx * 17 + b.ty * 31 + f.i * 7;
      const isFront = (k === frontFace);

      // remplissage matière (léger, la teinte de base vient de drawBox)
      drawFacadeMaterial(ctx, f.pts, archConf.texture, b.wall, seed, f.w, b.height);
      // rez-de-chaussée
      drawGroundFloor(ctx, f.pts, b, groundV, isFront, seed, f.w);
      // bandeaux d'étage
      if (archConf.texture !== "glass")
        drawStringCourses(ctx, f.pts, floorsUpper, groundV, b.wall);
      // fenêtres des étages
      drawUpperWindows(ctx, f.pts, archConf.windows, floorsUpper, groundV, seed, f.w);
      // corniche
      if (!pitched) drawCornice(ctx, f.pts, b.wall, b.trim);
      // arêtes verticales nettes
      ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(f.pts[0].x, f.pts[0].y); ctx.lineTo(f.pts[3].x, f.pts[3].y);
      ctx.moveTo(f.pts[1].x, f.pts[1].y); ctx.lineTo(f.pts[2].x, f.pts[2].y);
      ctx.stroke();
    }

    // 3. toiture
    const tcx = (tops[0].x + tops[2].x) / 2, tcy = (tops[0].y + tops[2].y) / 2;
    const sc = Math.abs(tops[2].x - tops[0].x) / b.w;
    if (pitched) {
      drawPitchedRoof(ctx, tops, b, camX, camY);
    } else {
      drawRoofDetail(ctx, b, tcx, tcy, sc, camX, camY);
    }

    // 4. décorations en élévation
    if (archConf.ac && floors >= 3) drawACUnits(ctx, b, camX, camY);
    if (archConf.balcony && floors >= 2 && !pitched) drawBalconies(ctx, b, camX, camY);
    if (archConf.antenna && !pitched && b.roofType !== "antenna") drawRoofAntenna(ctx, b, camX, camY);
    if (b.laundry) drawRoofLaundry(ctx, b, camX, camY);

    if (b.hospital) {
      ctx.fillStyle = "#ff5340";
      const s = 26 * sc;
      ctx.fillRect(tcx - s / 2, tcy - s / 6, s, s / 3);
      ctx.fillRect(tcx - s / 6, tcy - s / 2, s / 3, s);
    }

    // 5. enseigne (bandeau lumineux sur la face avant)
    if (b.sign) drawSign(ctx, b, tops);

    // 6. porte d'accès (bâtiments accessibles) — repère doré
    if (b.accessible) drawAccessDoor(ctx, b, camX, camY);
  }

  function drawSign(ctx, b, tops) {
    const sx = (tops[3].x + tops[2].x) / 2, sy = (tops[3].y + tops[2].y) / 2;
    const sc = Math.abs(tops[2].x - tops[0].x) / b.w;
    ctx.font = "bold " + Math.max(11, 14 * sc) + "px 'Rubik','Trebuchet MS',sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const wtxt = ctx.measureText(b.sign.text).width + 14;
    ctx.fillStyle = "rgba(16,12,24,0.9)";
    ctx.fillRect(sx - wtxt / 2, sy - 11, wtxt, 22);
    ctx.strokeStyle = b.sign.color; ctx.lineWidth = 1.5;
    ctx.strokeRect(sx - wtxt / 2, sy - 11, wtxt, 22);
    ctx.fillStyle = b.sign.color;
    ctx.shadowColor = b.sign.color; ctx.shadowBlur = 9;
    ctx.fillText(b.sign.text, sx, sy + 1);
    ctx.shadowBlur = 0;
  }

  function drawAccessDoor(ctx, b, camX, camY) {
    const doorX = b.cx, doorY = b.y + b.h;
    ctx.fillStyle = "#ffc857";
    ctx.beginPath();
    ctx.arc(doorX, doorY + 4, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(20,16,26,0.7)"; ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* =========================================================
     INTÉRIEUR (bâtiments accessibles) — inchangé
     ========================================================= */

  function drawInterior(ctx, b, px, py, scale) {
    const intDef = MD.INTERIORS[b.interior];
    if (!intDef) return;
    const iw = intDef.w * T * scale, ih = intDef.h * T * scale;
    const ix = px - iw / 2, iy = py - ih / 2;
    ctx.fillStyle = intDef.floor; ctx.fillRect(ix, iy, iw, ih);
    ctx.strokeStyle = intDef.walls; ctx.lineWidth = 4 * scale; ctx.strokeRect(ix, iy, iw, ih);
    ctx.fillStyle = "rgba(60,50,40,0.4)";
    const furn = intDef.furniture || [];
    const fw = iw / (furn.length + 1);
    for (let i = 0; i < furn.length; i++) {
      const fx = ix + fw * (i + 0.5), fy = iy + ih * 0.5;
      switch (furn[i]) {
        case "counter": ctx.fillRect(fx - fw * 0.35, fy - ih * 0.1, fw * 0.7, ih * 0.2); break;
        case "tables":
          for (let t = 0; t < 3; t++) {
            ctx.beginPath();
            ctx.arc(fx + (t - 1) * fw * 0.3, fy + (t % 2 - 0.5) * ih * 0.3, 6 * scale, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case "shrine": case "plant":
          ctx.beginPath(); ctx.arc(fx, fy, 8 * scale, 0, Math.PI * 2); ctx.fill(); break;
        case "lift": case "elevator":
          ctx.fillRect(fx - 10 * scale, fy - 12 * scale, 20 * scale, 24 * scale); break;
        case "toolrack": case "shelves":
          ctx.fillRect(fx - fw * 0.4, fy - ih * 0.35, fw * 0.8, ih * 0.7); break;
        case "car": ctx.fillRect(fx - 15 * scale, fy - 8 * scale, 30 * scale, 16 * scale); break;
        case "desk": case "ticket": ctx.fillRect(fx - 12 * scale, fy - 5 * scale, 24 * scale, 10 * scale); break;
        case "bench": ctx.fillRect(fx - 14 * scale, fy - 3 * scale, 28 * scale, 6 * scale); break;
        case "bar": case "stage": ctx.fillRect(fx - fw * 0.3, fy + ih * 0.1, fw * 0.6, ih * 0.2); break;
      }
    }
    ctx.fillStyle = "#ffc857";
    ctx.fillRect(ix + iw / 2 - 6 * scale, iy + ih - 2 * scale, 12 * scale, 4 * scale);
  }

  function pickRoofType(rng, archetype) {
    switch (archetype) {
      case "skyscraper": return U.pick(rng, ROOFS_TOWER);
      case "office": return U.pick(rng, ROOFS_TOWER);
      case "shophouse": return U.pick(rng, ROOFS_LOTUS);
      default: return U.pick(rng, ROOFS_LOW);
    }
  }

  G.Buildings = {
    renderBuilding, drawInterior, pickRoofType,
    ROOFS_TOWER, ROOFS_LOW, ROOFS_LOTUS
  };

})(window.G);
