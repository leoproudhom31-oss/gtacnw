/* ============================================================
   JADE HARBOR — buildings.js
   Moteur de bâtiments : rendu détaillé avec textures procédurales,
   fenêtres variées, décorations (AC, balcons, enseignes, antennes),
   intérieurs accessibles, et système de verticalité.
   ============================================================ */
"use strict";
(function (G) {

  const U = G.U, S = G.Sprites, MD = G.MapData;
  const T = MD.T;

  const INK = S.INK || "#120e1c";

  function h2(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /* =========================================================
     FACADE TEXTURES (procédurales, dessinées directement sur
     les faces latérales des bâtiments)
     ========================================================= */

  function drawFacadeTexture(ctx, pts, texture, wallColor, seed) {
    const p0 = pts[0], p1 = pts[1], p2 = pts[2], p3 = pts[3];
    const w = U.dist(p0.x, p0.y, p1.x, p1.y);
    const h = U.dist(p0.x, p0.y, p3.x, p3.y);
    if (w < 4 || h < 4) return;

    switch (texture) {
      case "brick": drawBrickTexture(ctx, pts, w, h, seed); break;
      case "concrete": drawConcreteTexture(ctx, pts, w, h, seed); break;
      case "glass": drawGlassTexture(ctx, pts, w, h, wallColor, seed); break;
      case "wood": drawWoodTexture(ctx, pts, w, h, seed); break;
      case "corrugated": drawCorrugatedTexture(ctx, pts, w, h, seed); break;
      case "metal": drawMetalTexture(ctx, pts, w, h, seed); break;
      case "tile": drawTileTexture(ctx, pts, w, h, seed); break;
    }
  }

  function interpQuad(pts, u, v) {
    const p0 = pts[0], p1 = pts[1], p2 = pts[2], p3 = pts[3];
    return {
      x: p0.x * (1 - u) * (1 - v) + p1.x * u * (1 - v) + p2.x * u * v + p3.x * (1 - u) * v,
      y: p0.y * (1 - u) * (1 - v) + p1.y * u * (1 - v) + p2.y * u * v + p3.y * (1 - u) * v
    };
  }

  function drawBrickTexture(ctx, pts, w, h, seed) {
    const rows = Math.max(3, Math.round(h / 5));
    const cols = Math.max(4, Math.round(w / 8));
    ctx.strokeStyle = "rgba(80,50,30,0.18)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let r = 1; r < rows; r++) {
      const v = r / rows;
      const a = interpQuad(pts, 0, v);
      const b = interpQuad(pts, 1, v);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    for (let r = 0; r < rows; r++) {
      const v0 = r / rows, v1 = (r + 1) / rows;
      const offset = (r % 2 === 0) ? 0 : 0.5 / cols;
      for (let c = 1; c < cols; c++) {
        const u = c / cols + offset;
        if (u > 1) continue;
        const a = interpQuad(pts, u, v0);
        const b = interpQuad(pts, u, v1);
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      }
    }
    ctx.stroke();
  }

  function drawConcreteTexture(ctx, pts, w, h, seed) {
    const panelsH = Math.max(2, Math.round(h / 18));
    const panelsW = Math.max(2, Math.round(w / 22));
    ctx.strokeStyle = "rgba(0,0,0,0.09)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let r = 1; r < panelsH; r++) {
      const v = r / panelsH;
      const a = interpQuad(pts, 0, v);
      const b = interpQuad(pts, 1, v);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    for (let c = 1; c < panelsW; c++) {
      const u = c / panelsW;
      const a = interpQuad(pts, u, 0);
      const b = interpQuad(pts, u, 1);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }

  function drawGlassTexture(ctx, pts, w, h, wallColor, seed) {
    ctx.fillStyle = "rgba(120,200,240,0.08)";
    const a = interpQuad(pts, 0, 0), b = interpQuad(pts, 1, 0);
    const c = interpQuad(pts, 1, 1), d = interpQuad(pts, 0, 1);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath(); ctx.fill();
    // reflection streaks
    ctx.strokeStyle = "rgba(200,240,255,0.12)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const u = 0.2 + h2(seed + i, seed * 3) * 0.6;
      const p = interpQuad(pts, u, 0.1);
      const q = interpQuad(pts, u + 0.05, 0.7);
      ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
  }

  function drawWoodTexture(ctx, pts, w, h, seed) {
    const planks = Math.max(3, Math.round(w / 6));
    ctx.strokeStyle = "rgba(60,35,15,0.2)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let c = 1; c < planks; c++) {
      const u = c / planks;
      const a = interpQuad(pts, u, 0);
      const b = interpQuad(pts, u, 1);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    // wood grain
    ctx.strokeStyle = "rgba(60,35,15,0.08)";
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const v = h2(seed + i * 7, seed + i * 13) * 0.8 + 0.1;
      const a = interpQuad(pts, 0, v);
      const b = interpQuad(pts, 1, v);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }

  function drawCorrugatedTexture(ctx, pts, w, h, seed) {
    const ridges = Math.max(5, Math.round(w / 4));
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    for (let c = 0; c < ridges; c++) {
      const u = c / ridges;
      const a = interpQuad(pts, u, 0);
      const b = interpQuad(pts, u, 1);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }

  function drawMetalTexture(ctx, pts, w, h, seed) {
    // riveted panels
    const ph = Math.max(2, Math.round(h / 14));
    const pw = Math.max(2, Math.round(w / 16));
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let r = 1; r < ph; r++) {
      const a = interpQuad(pts, 0, r / ph), b = interpQuad(pts, 1, r / ph);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    for (let c = 1; c < pw; c++) {
      const a = interpQuad(pts, c / pw, 0), b = interpQuad(pts, c / pw, 1);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    // rivets
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    for (let r = 0; r <= ph; r++) {
      for (let c = 0; c <= pw; c++) {
        const p = interpQuad(pts, c / pw, r / ph);
        ctx.beginPath(); ctx.arc(p.x, p.y, 0.8, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawTileTexture(ctx, pts, w, h, seed) {
    const rows = Math.max(4, Math.round(h / 6));
    const cols = Math.max(4, Math.round(w / 6));
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 0.4;
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

  /* =========================================================
     WINDOW SYSTEM — variété de styles de fenêtres
     ========================================================= */

  function drawWindows(ctx, pts, style, floors, seed, height) {
    const conf = MD.WINDOW_STYLES[style] || MD.WINDOW_STYLES.modern;
    const w = U.dist(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    if (w < 12) return;

    const rows = Math.max(1, floors);
    const cols = Math.max(2, Math.round(w / (style === "shopfront" ? 30 : 20)));

    ctx.lineWidth = conf.frameW;

    for (let ri = 0; ri < rows; ri++) {
      const r0 = ri / rows + 0.08 / rows;
      const r1 = (ri + 1) / rows - 0.20 / rows;
      for (let ci = 0; ci < cols; ci++) {
        const c0 = (ci + 0.18) / cols;
        const c1 = (ci + 0.82) / cols;

        const p0 = interpQuad(pts, c0, r0);
        const p1 = interpQuad(pts, c1, r0);
        const p2 = interpQuad(pts, c1, r1);
        const p3 = interpQuad(pts, c0, r1);

        const lit = h2(seed + ci * 13.7, seed + ri * 29.3) > (1 - conf.lit);
        ctx.fillStyle = lit ? "rgba(255,208,120,0.75)" : conf.dark;
        ctx.strokeStyle = "rgba(15,12,20,0.4)";

        if (style === "arched") {
          // arched top
          const midX = (p2.x + p3.x) / 2, midY = (p2.y + p3.y) / 2 - 2;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.quadraticCurveTo(midX, midY, p3.x, p3.y);
          ctx.closePath();
        } else {
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y);
          ctx.closePath();
        }
        ctx.fill(); ctx.stroke();

        // shutters for shuttered style
        if (style === "shuttered" && h2(seed + ci + ri * 7, seed) > 0.5) {
          ctx.fillStyle = "rgba(90,60,30,0.5)";
          const sw = (p1.x - p0.x) * 0.22;
          ctx.fillRect(p0.x - sw, p0.y, sw, p3.y - p0.y);
          ctx.fillRect(p1.x, p1.y, sw, p2.y - p1.y);
        }

        // window sill for traditional
        if (style === "traditional" || style === "shuttered") {
          ctx.fillStyle = "rgba(180,160,130,0.5)";
          const sy = p0.y + (p0.y - p3.y) * 0.02;
          ctx.fillRect(p0.x - 1, sy, p1.x - p0.x + 2, 2);
        }
      }
    }
  }

  /* =========================================================
     AC UNITS, BALCONIES, FIRE ESCAPES, ANTENNAS
     ========================================================= */

  function drawACUnits(ctx, b, camX, camY) {
    const rng = U.makeRng((b.tx * 431 + b.ty * 233) >>> 0);
    const n = Math.max(1, Math.floor(b.tw * b.th / 12));
    for (let i = 0; i < n; i++) {
      const frac = 0.2 + rng() * 0.6;
      const hFrac = 0.15 + rng() * 0.7;
      const side = rng() < 0.5 ? 0 : 1; // left or right wall
      const wx = side === 0 ? b.x : b.x + b.w;
      const wy = b.y + b.h * hFrac;
      const h = b.height * frac;
      const p = { x: 0, y: 0 };
      S.elevate(wx, wy, h, camX, camY, p);
      ctx.fillStyle = "#d4d0c8";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.8;
      ctx.fillRect(p.x - 4, p.y - 3, 8, 6);
      ctx.strokeRect(p.x - 4, p.y - 3, 8, 6);
      // grill lines
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(p.x - 2, p.y - 1); ctx.lineTo(p.x + 2, p.y - 1);
      ctx.moveTo(p.x - 2, p.y + 1); ctx.lineTo(p.x + 2, p.y + 1);
      ctx.stroke();
    }
  }

  function drawBuildingBalconies(ctx, b, camX, camY) {
    const rng = U.makeRng((b.tx * 811 + b.ty * 359) >>> 0);
    const nFloors = b.floors || 3;
    const nBal = Math.min(nFloors - 1, 3);
    for (let fi = 1; fi <= nBal; fi++) {
      if (rng() > 0.6) continue;
      const frac = fi / nFloors;
      const h = b.height * frac;
      const eL = { x: 0, y: 0 }, eR = { x: 0, y: 0 };
      S.elevate(b.x, b.y + b.h, h, camX, camY, eL);
      S.elevate(b.x + b.w, b.y + b.h, h, camX, camY, eR);

      // balcony slab
      ctx.fillStyle = "rgba(160,150,130,0.7)";
      ctx.strokeStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(eL.x, eL.y + 5); ctx.lineTo(eR.x, eR.y + 5);
      ctx.lineTo(eR.x, eR.y); ctx.lineTo(eL.x, eL.y);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // railing
      const n = Math.max(3, Math.round(U.dist(eL.x, eL.y, eR.x, eR.y) / 10));
      ctx.strokeStyle = "rgba(40,30,20,0.6)"; ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = eL.x + (eR.x - eL.x) * t;
        const y = eL.y + (eR.y - eL.y) * t;
        ctx.moveTo(x, y); ctx.lineTo(x, y - 6);
      }
      // top rail
      ctx.moveTo(eL.x, eL.y - 6); ctx.lineTo(eR.x, eR.y - 6);
      ctx.stroke();

      // potted plant
      if (rng() > 0.5) {
        const px = eL.x + (eR.x - eL.x) * (0.2 + rng() * 0.6);
        const py = eL.y + (eR.y - eL.y) * (0.2 + rng() * 0.6);
        ctx.fillStyle = "#4a8f4a";
        ctx.beginPath(); ctx.arc(px, py - 3, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#8c5a3a";
        ctx.fillRect(px - 2, py, 4, 3);
      }
    }
  }

  function drawFireEscape(ctx, b, camX, camY) {
    const nFloors = b.floors || 3;
    if (nFloors < 3) return;
    const side = h2(b.tx, b.ty) > 0.5 ? b.x : b.x + b.w;
    ctx.strokeStyle = "rgba(60,55,50,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let fi = 1; fi < nFloors; fi++) {
      const frac = fi / nFloors;
      const h = b.height * frac;
      const p = { x: 0, y: 0 };
      S.elevate(side, b.y + b.h * 0.5, h, camX, camY, p);
      ctx.moveTo(p.x - 5, p.y); ctx.lineTo(p.x + 5, p.y);
      if (fi > 1) {
        const prev = { x: 0, y: 0 };
        S.elevate(side, b.y + b.h * 0.5, b.height * ((fi - 1) / nFloors), camX, camY, prev);
        ctx.moveTo(p.x - 3, p.y); ctx.lineTo(prev.x - 3, prev.y);
      }
    }
    ctx.stroke();
  }

  function drawRoofAntenna(ctx, b, camX, camY) {
    const p = { x: 0, y: 0 };
    const ax = b.cx + (h2(b.tx + 5, b.ty) - 0.5) * b.w * 0.4;
    const ay = b.cy + (h2(b.tx, b.ty + 5) - 0.5) * b.h * 0.4;
    S.elevate(ax, ay, b.height + 30, camX, camY, p);
    ctx.strokeStyle = "#2a2f38"; ctx.lineWidth = 1.2;
    const base = { x: 0, y: 0 };
    S.elevate(ax, ay, b.height, camX, camY, base);
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    // red light
    ctx.fillStyle = "#ff4040";
    ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fill();
  }

  /* =========================================================
     BUILDING DOOR (pour les intérieurs accessibles)
     ========================================================= */

  function drawDoor(ctx, b, camX, camY) {
    if (!b.accessible) return;
    const doorX = b.cx;
    const doorY = b.y + b.h;
    const dw = 12, dh = 18;
    const p0 = { x: 0, y: 0 }, p1 = { x: 0, y: 0 };
    S.elevate(doorX - dw / 2, doorY, 0, camX, camY, p0);
    S.elevate(doorX + dw / 2, doorY, dh, camX, camY, p1);

    // door frame
    ctx.fillStyle = "#3a2a1a";
    ctx.fillRect(doorX - dw / 2, doorY - dh, dw, dh);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
    ctx.strokeRect(doorX - dw / 2, doorY - dh, dw, dh);
    // door panel
    ctx.fillStyle = "#5a3a20";
    ctx.fillRect(doorX - dw / 2 + 2, doorY - dh + 2, dw - 4, dh - 2);
    // handle
    ctx.fillStyle = "#c9a227";
    ctx.beginPath(); ctx.arc(doorX + 3, doorY - dh / 2, 1.5, 0, Math.PI * 2); ctx.fill();
  }

  /* =========================================================
     LAUNDRY & ROOF DETAILS
     ========================================================= */

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

  const ROOFS_TOWER = ["tier2", "helipad", "tank", "antenna", "dish", "garden", "vents"];
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
      ctx.fillStyle = U.shade(b.roof, -0.25);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
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
        S.drawBox(ctx, b.x + b.w * 0.22, b.y + b.h * 0.22, b.w * 0.56, b.h * 0.56,
                  b.height + extra, camX, camY, U.shade(b.wall, 0.06), U.shade(b.roof, 0.1),
                  { windows: true, floors: Math.max(2, (b.floors || 4) - 3) });
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
      case "solar": {
        ctx.fillStyle = "#1a2a4a";
        ctx.strokeStyle = INK; ctx.lineWidth = 0.8;
        const sw = Math.min(b.w - 12, 28), sh = Math.min(b.h - 10, 18);
        const p = { x: 0, y: 0 };
        S.elevate(cx - sw / 2, cy - sh / 2, b.height + 4, camX, camY, p);
        ctx.fillRect(p.x, p.y, sw * sc, sh * sc);
        ctx.strokeRect(p.x, p.y, sw * sc, sh * sc);
        // grid lines
        ctx.strokeStyle = "rgba(80,120,180,0.3)"; ctx.lineWidth = 0.4;
        ctx.beginPath();
        for (let i = 1; i < 4; i++) {
          ctx.moveTo(p.x + sw * sc * i / 4, p.y);
          ctx.lineTo(p.x + sw * sc * i / 4, p.y + sh * sc);
        }
        ctx.stroke();
        break;
      }
    }
  }

  /* =========================================================
     MAIN BUILDING RENDERER — le point d'entrée
     ========================================================= */

  function renderBuilding(ctx, b, camX, camY) {
    const archConf = MD.ARCHETYPE_CONFIG[b.archetype || "office"] || MD.ARCHETYPE_CONFIG.office;
    const opt = { windows: false, floors: b.floors || 3, trim: b.trim };

    // Draw the extruded box (base geometry)
    const tops = S.drawBox(ctx, b.x, b.y, b.w, b.h, b.height, camX, camY, b.wall, b.roof, opt);

    // Get roof center for decorations
    const t0x = tops[0].x, t0y = tops[0].y, t2x = tops[2].x, t2y = tops[2].y;
    const tcx = (t0x + t2x) / 2, tcy = (t0y + t2y) / 2;
    const sc = Math.abs(t2x - t0x) / b.w;

    // Draw facade texture on visible faces
    drawFacadeOnVisibleFaces(ctx, b, camX, camY, archConf.texture);

    // Draw windows
    drawWindowsOnVisibleFaces(ctx, b, camX, camY, archConf.windows, b.floors || 3);

    // Decorations
    if (archConf.ac && b.floors >= 3) drawACUnits(ctx, b, camX, camY);
    if (archConf.balcony && b.floors >= 2) drawBuildingBalconies(ctx, b, camX, camY);
    if (archConf.antenna) drawRoofAntenna(ctx, b, camX, camY);
    if (b.archetype === "apartment" && b.floors >= 4) drawFireEscape(ctx, b, camX, camY);

    // Roof detail
    drawRoofDetail(ctx, b, tcx, tcy, sc, camX, camY);

    // Laundry on roof (Lotus district flavor)
    if (b.laundry) drawRoofLaundry(ctx, b, camX, camY);

    // Temple specifics
    if (b.archetype === "temple") {
      S.drawBox(ctx, b.x + b.w * 0.2, b.y + b.h * 0.15, b.w * 0.6, b.h * 0.7,
                b.height + 26, camX, camY, "#a4442f", "#7a1f14");
    }
    if (b.hospital) {
      ctx.fillStyle = "#ff5340";
      const s = 26 * sc;
      ctx.fillRect(tcx - s / 2, tcy - s / 6, s, s / 3);
      ctx.fillRect(tcx - s / 6, tcy - s / 2, s / 3, s);
    }

    // Sign
    if (b.sign) {
      const sx = (tops[3].x + tops[2].x) / 2, sy = (tops[3].y + tops[2].y) / 2;
      ctx.font = "bold " + Math.max(11, 14 * sc) + "px 'Rubik','Trebuchet MS',sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const wtxt = ctx.measureText(b.sign.text).width + 12;
      ctx.fillStyle = "rgba(18,14,28,0.88)";
      ctx.fillRect(sx - wtxt / 2, sy - 10, wtxt, 20);
      ctx.strokeStyle = b.sign.color; ctx.lineWidth = 1.5;
      ctx.strokeRect(sx - wtxt / 2, sy - 10, wtxt, 20);
      ctx.fillStyle = b.sign.color;
      ctx.shadowColor = b.sign.color; ctx.shadowBlur = 8;
      ctx.fillText(b.sign.text, sx, sy + 1);
      ctx.shadowBlur = 0;
    }

    // Awning
    if (b.awning) {
      ctx.fillStyle = b.awning;
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.fillRect(b.x + 4, b.y + b.h - 2, b.w - 8, 8);
      ctx.strokeRect(b.x + 4, b.y + b.h - 2, b.w - 8, 8);
    }

    // Door
    if (b.accessible) drawDoor(ctx, b, camX, camY);
  }

  function drawFacadeOnVisibleFaces(ctx, b, camX, camY, texture) {
    const corners = [
      { x: b.x, y: b.y }, { x: b.x + b.w, y: b.y },
      { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }
    ];
    const e = [{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}];
    for (let i = 0; i < 4; i++) S.elevate(corners[i].x, corners[i].y, b.height, camX, camY, e[i]);

    for (let i = 0; i < 4; i++) {
      const a = corners[i], bb = corners[(i + 1) % 4];
      const mx = (a.x + bb.x) / 2, my = (a.y + bb.y) / 2;
      const nx = (bb.y - a.y), ny = -(bb.x - a.x);
      if (nx * (mx - camX) + ny * (my - camY) <= 0) continue;

      const ta = e[i], tb = e[(i + 1) % 4];
      const pts = [
        { x: a.x, y: a.y }, { x: bb.x, y: bb.y },
        { x: tb.x, y: tb.y }, { x: ta.x, y: ta.y }
      ];
      drawFacadeTexture(ctx, pts, texture, b.wall, b.tx * 17 + b.ty * 31 + i * 7);
    }
  }

  function drawWindowsOnVisibleFaces(ctx, b, camX, camY, style, floors) {
    const corners = [
      { x: b.x, y: b.y }, { x: b.x + b.w, y: b.y },
      { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }
    ];
    const e = [{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}];
    for (let i = 0; i < 4; i++) S.elevate(corners[i].x, corners[i].y, b.height, camX, camY, e[i]);

    for (let i = 0; i < 4; i++) {
      const a = corners[i], bb = corners[(i + 1) % 4];
      const mx = (a.x + bb.x) / 2, my = (a.y + bb.y) / 2;
      const nx = (bb.y - a.y), ny = -(bb.x - a.x);
      if (nx * (mx - camX) + ny * (my - camY) <= 0) continue;

      const ta = e[i], tb = e[(i + 1) % 4];
      const pts = [
        { x: a.x, y: a.y }, { x: bb.x, y: bb.y },
        { x: tb.x, y: tb.y }, { x: ta.x, y: ta.y }
      ];
      drawWindows(ctx, pts, style, floors, b.tx * 13 + b.ty * 29 + i * 11, b.height);
    }
  }

  /* =========================================================
     INTERIOR RENDERING (pour bâtiments accessibles)
     ========================================================= */

  function drawInterior(ctx, b, px, py, scale) {
    const intDef = MD.INTERIORS[b.interior];
    if (!intDef) return;

    const iw = intDef.w * T * scale;
    const ih = intDef.h * T * scale;
    const ix = px - iw / 2, iy = py - ih / 2;

    // floor
    ctx.fillStyle = intDef.floor;
    ctx.fillRect(ix, iy, iw, ih);

    // walls
    ctx.strokeStyle = intDef.walls; ctx.lineWidth = 4 * scale;
    ctx.strokeRect(ix, iy, iw, ih);

    // simple furniture silhouettes
    ctx.fillStyle = "rgba(60,50,40,0.4)";
    const furn = intDef.furniture || [];
    const fw = iw / (furn.length + 1);
    for (let i = 0; i < furn.length; i++) {
      const fx = ix + fw * (i + 0.5);
      const fy = iy + ih * 0.5;
      switch (furn[i]) {
        case "counter":
          ctx.fillRect(fx - fw * 0.35, fy - ih * 0.1, fw * 0.7, ih * 0.2);
          break;
        case "tables":
          for (let t = 0; t < 3; t++) {
            ctx.beginPath();
            ctx.arc(fx + (t - 1) * fw * 0.3, fy + (t % 2 - 0.5) * ih * 0.3, 6 * scale, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case "shrine": case "plant":
          ctx.beginPath(); ctx.arc(fx, fy, 8 * scale, 0, Math.PI * 2); ctx.fill();
          break;
        case "lift": case "elevator":
          ctx.fillRect(fx - 10 * scale, fy - 12 * scale, 20 * scale, 24 * scale);
          break;
        case "toolrack": case "shelves":
          ctx.fillRect(fx - fw * 0.4, fy - ih * 0.35, fw * 0.8, ih * 0.7);
          break;
        case "car":
          ctx.fillRect(fx - 15 * scale, fy - 8 * scale, 30 * scale, 16 * scale);
          break;
        case "desk": case "ticket":
          ctx.fillRect(fx - 12 * scale, fy - 5 * scale, 24 * scale, 10 * scale);
          break;
        case "bench":
          ctx.fillRect(fx - 14 * scale, fy - 3 * scale, 28 * scale, 6 * scale);
          break;
        case "bar": case "stage":
          ctx.fillRect(fx - fw * 0.3, fy + ih * 0.1, fw * 0.6, ih * 0.2);
          break;
      }
    }

    // door indicator
    ctx.fillStyle = "#ffc857";
    ctx.fillRect(ix + iw / 2 - 6 * scale, iy + ih - 2 * scale, 12 * scale, 4 * scale);
  }

  /* =========================================================
     ROOF TYPE SELECTION
     ========================================================= */

  function pickRoofType(rng, archetype) {
    switch (archetype) {
      case "skyscraper": return U.pick(rng, ROOFS_TOWER);
      case "shophouse": return U.pick(rng, ROOFS_LOTUS);
      default: return U.pick(rng, ROOFS_LOW);
    }
  }

  /* =========================================================
     EXPORTS
     ========================================================= */

  G.Buildings = {
    renderBuilding,
    drawInterior,
    pickRoofType,
    drawDoor,
    ROOFS_TOWER, ROOFS_LOW, ROOFS_LOTUS
  };

})(window.G);
