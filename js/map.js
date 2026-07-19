/* ============================================================
   JADE HARBOR — map.js
   Moteur de génération et rendu de la carte. Lit les données
   depuis MapData, utilise le moteur Buildings pour les bâtiments.
   Génère un monde 384×384 tuiles avec réseau routier, canal,
   quartiers variés, mobilier, collisions, minimap et GPS.
   ============================================================ */
"use strict";
(function (G) {

  const U = G.U, S = G.Sprites, MD = G.MapData, B = G.Buildings, TX = G.Tex;
  const INK_MAP = S.INK || "#1a1424";

  const T = MD.T;
  const MW = MD.MW, MH = MD.MH;
  const WPX = MD.WPX, HPX = MD.HPX;

  const WATER = 0, GRASS = 1, SIDEWALK = 2, ROAD = 3, PLAZA = 4,
        DOCK = 5, PATH = 6, BUILDING = 7, SAND = 8;

  const LN = 1, LS = 2, LE = 4, LW = 8;
  const DIRS = [
    { bit: LN, dx: 0, dy: -1 },
    { bit: LS, dx: 0, dy: 1 },
    { bit: LE, dx: 1, dy: 0 },
    { bit: LW, dx: -1, dy: 0 }
  ];

  const tiles = new Uint8Array(MW * MH);
  const lane = new Uint8Array(MW * MH);
  const bridgeF = new Uint8Array(MW * MH);
  const elevation = new Uint8Array(MW * MH);

  const buildings = [];
  const structures = [];
  const flatProps = [];
  const benches = [];
  const solidProps = [];
  const solidGrid = new Map();
  const parkedSpawns = [];
  const pickupSpawns = [];
  const boatSpawns = [];
  const boatRoutes = [];
  const ladders = [];
  const beachSeats = [];

  const segs = [];
  const roundabouts = [];   // { cx, cy, rOut, islandR, island, name }
  const diagonals = [];     // { ax, ay, bx, by } en px, pour le rendu
  const ringTiles = new Set();

  const POI = {};

  const reserved = [];

  function idx(tx, ty) { return ty * MW + tx; }
  function inB(tx, ty) { return tx >= 0 && ty >= 0 && tx < MW && ty < MH; }
  function get(tx, ty) { return inB(tx, ty) ? tiles[idx(tx, ty)] : WATER; }
  function set(tx, ty, v) { if (inB(tx, ty)) tiles[idx(tx, ty)] = v; }

  function tileHash(tx, ty) {
    let h = (tx * 374761393 + ty * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function districtAt(px, py) {
    const tx = Math.floor(px / T), ty = Math.floor(py / T);
    for (const d of MD.DISTRICTS) {
      if (tx >= d.x0 && tx <= d.x1 && ty >= d.y0 && ty <= d.y1) return d;
    }
    return null;
  }

  function isReserved(tx, ty, w, h) {
    for (const r of reserved) {
      if (tx < r.x + r.w && tx + w > r.x && ty < r.y + r.h && ty + h > r.y) return true;
    }
    return false;
  }

  /* =========================================================
     GÉNÉRATION
     ========================================================= */

  function generate() {
    const rng = U.makeRng(20260716);

    genTerrain(rng);
    genElevation();
    genRoads();
    genRoundaboutFeatures(rng);
    genSidewalks();
    genBeach(rng);
    reserveSpecials();
    genBlocks(rng);
    genCanalZone(rng);
    genDocksGround(rng);
    genPark(rng);
    genSpecialBuildings(rng);
    genStreetProps(rng);
    genParkedCars(rng);
    genLadders();
    genBoatTraffic();
    genPickups();
    genPOI();
    buildMinimap();
  }

  function genTerrain(rng) {
    tiles.fill(WATER);
    for (let y = 8; y <= MW - 10; y++) {
      for (let x = 8; x <= MW - 10; x++) {
        const c = 14;
        if ((x - 8) + (y - 8) < c) continue;
        if ((MW - 10 - x) + (y - 8) < c) continue;
        if ((x - 8) + (MH - 10 - y) < c) continue;
        if ((MW - 10 - x) + (MH - 10 - y) < c) continue;
        set(x, y, GRASS);
      }
    }
    // canal
    const cy0 = MD.CANAL_CONFIG.waterY0, cy1 = MD.CANAL_CONFIG.waterY1;
    for (let x = 8; x <= MW - 10; x++) {
      if (get(x, cy0 - 1) !== WATER) set(x, cy0 - 1, DOCK);
      for (let y = cy0; y <= cy1; y++) if (get(x, y) !== WATER) set(x, y, WATER);
      if (get(x, cy1 + 1) !== WATER) set(x, cy1 + 1, DOCK);
    }
    // quai sud de l'île
    for (let y = MH - 38; y <= MH - 14; y++)
      for (let x = 12; x <= MW - 14; x++)
        if (get(x, y) === GRASS) set(x, y, DOCK);
    // jetées
    const jetees = [[55, 58], [150, 153], [250, 253], [340, 343]];
    for (const px of jetees) {
      for (let y = MH - 13; y <= MH - 4; y++)
        for (let x = px[0]; x <= px[1]; x++)
          set(x, y, DOCK);
    }
  }

  function genElevation() {
    for (const zone of MD.ELEVATION_ZONES) {
      for (let y = zone.y0; y <= zone.y1; y++) {
        for (let x = zone.x0; x <= zone.x1; x++) {
          if (!inB(x, y)) continue;
          const dx = Math.min(x - zone.x0, zone.x1 - x) / 8;
          const dy = Math.min(y - zone.y0, zone.y1 - y) / 8;
          const fade = Math.min(1, Math.min(dx, dy));
          elevation[idx(x, y)] = Math.round(zone.elev * fade);
        }
      }
    }
  }

  function addSeg(v, at, from, to, w) { segs.push({ v, at, from, to, w: w || MD.STREET_W }); }

  function genRoads() {
    const cy0 = MD.CANAL_CONFIG.waterY0, cy1 = MD.CANAL_CONFIG.waterY1;
    const bridges = new Set(MD.BRIDGE_VROADS);
    const blvdV = new Set(MD.BOULEVARDS_V), blvdH = new Set(MD.BOULEVARDS_H);

    // 1. axes verticaux (largeur variable : boulevards = 4)
    for (const x of MD.VROADS) {
      const w = blvdV.has(x) ? MD.BLVD_W : MD.STREET_W;
      if (bridges.has(x)) {
        addSeg(true, x, 12, MW - 13, w);
      } else {
        addSeg(true, x, 12, cy0 - 3, w);
        addSeg(true, x, cy1 + 3, MW - 13, w);
      }
    }
    // 2. axes horizontaux (sautent la bande du canal)
    for (const y of MD.HROADS) {
      if (y >= cy0 - 2 && y <= cy1 + 2) continue;
      const w = blvdH.has(y) ? MD.BLVD_W : MD.STREET_W;
      addSeg(false, y, 12, MW - 13, w);
    }
    // 3. peinture des segments droits (les croisements deviennent des
    //    carrefours à masques composés)
    for (const s of segs) paintSeg(s);

    // 4. ronds-points : on évide le croisement et on pose un anneau à
    //    sens giratoire (masques tangentiels anti-horaires, France)
    for (const rb of MD.ROUNDABOUTS) carveRoundabout(rb);

    // 5. avenues diagonales (percées en étoile depuis la place centrale)
    for (const d of MD.DIAGONALS) paintDiagonal(d);

    // 6. raccorde les sorties des anneaux aux voies sortantes
    roundaboutExitPass();
  }

  function paintSeg(s) {
    const w = s.w || MD.STREET_W, half = w / 2;
    if (s.v) {
      for (let y = s.from; y <= s.to + 1; y++)
        for (let k = 0; k < w; k++) paintRoad(s.at + k, y, k < half ? LS : LN);
    } else {
      for (let x = s.from; x <= s.to + 1; x++)
        for (let k = 0; k < w; k++) paintRoad(x, s.at + k, k < half ? LW : LE);
    }
  }

  function paintRoad(tx, ty, bit) {
    if (!inB(tx, ty)) return;
    const i = idx(tx, ty);
    const cy0 = MD.CANAL_CONFIG.waterY0, cy1 = MD.CANAL_CONFIG.waterY1;
    if (ty >= cy0 && ty <= cy1) bridgeF[i] = 1;
    tiles[i] = ROAD;
    lane[i] |= bit;
  }

  /* ---------- ronds-points ---------- */

  function insideAnyRoundabout(tx, ty, pad) {
    pad = pad || 0.5;
    for (const rb of roundabouts) {
      if (Math.hypot(tx + 0.5 - rb.cx, ty + 0.5 - rb.cy) <= rb.rOut + pad) return true;
    }
    return false;
  }

  function carveRoundabout(rb) {
    const cx = rb.cx, cy = rb.cy, rOut = rb.r, islandR = rb.r - 2.2;
    const x0 = Math.floor(cx - rOut - 1), x1 = Math.ceil(cx + rOut + 1);
    const y0 = Math.floor(cy - rOut - 1), y1 = Math.ceil(cy + rOut + 1);
    const ring = [];
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!inB(tx, ty)) continue;
        const d = Math.hypot(tx + 0.5 - cx, ty + 0.5 - cy);
        const i = idx(tx, ty);
        if (d <= islandR) {
          tiles[i] = PLAZA; lane[i] = 0; bridgeF[i] = 0;
        } else if (d <= rOut) {
          tiles[i] = ROAD; lane[i] = 0; bridgeF[i] = 0;
          ring.push(i); ringTiles.add(i);
        }
      }
    }
    const rset = new Set(ring);
    // sens giratoire anti-horaire : tangente CCW = (py, -px) en écran
    for (const i of ring) {
      const tx = i % MW, ty = (i / MW) | 0;
      const px = tx + 0.5 - cx, py = ty + 0.5 - cy;
      const tanx = py, tany = -px;
      let best = null, bestDot = -Infinity;
      for (const dd of DIRS) {
        const nx = tx + dd.dx, ny = ty + dd.dy;
        if (!inB(nx, ny) || !rset.has(idx(nx, ny))) continue;
        const dot = dd.dx * tanx + dd.dy * tany;
        if (dot > bestDot) { bestDot = dot; best = dd; }
      }
      if (best) lane[i] = best.bit;
    }
    reserved.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
    roundabouts.push({ cx, cy, rOut, islandR, island: rb.island, name: rb.name });
  }

  // les voitures de l'anneau peuvent bifurquer sur une voie sortante
  function roundaboutExitPass() {
    for (const i of ringTiles) {
      const tx = i % MW, ty = (i / MW) | 0;
      for (const dd of DIRS) {
        const nx = tx + dd.dx, ny = ty + dd.dy;
        if (!inB(nx, ny)) continue;
        const ni = idx(nx, ny);
        if (ringTiles.has(ni) || tiles[ni] !== ROAD) continue;
        if (lane[ni] & dd.bit) lane[i] |= dd.bit; // la voie file vers l'extérieur
      }
    }
  }

  /* ---------- avenues diagonales ---------- */

  function paintDiagTile(tx, ty, mask) {
    if (!inB(tx, ty)) return;
    if (insideAnyRoundabout(tx, ty, 0.2)) return; // ne pas écraser les anneaux
    const i = idx(tx, ty);
    if (tiles[i] === WATER) return;
    tiles[i] = ROAD; lane[i] |= mask; bridgeF[i] = 0;
  }

  // escalier « supercouverture » : masque composé constant, corridor étroit
  // pour forcer le zigzag sans dérive (l'IA préfère tout droit).
  function paintDiagLane(x0, y0, x1, y1, mask) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(dist * 3);
    let ptx = null, pty = null;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const tx = Math.floor(x0 + (x1 - x0) * t);
      const ty = Math.floor(y0 + (y1 - y0) * t);
      if (ptx !== null && tx !== ptx && ty !== pty) paintDiagTile(ptx, ty, mask); // coude
      paintDiagTile(tx, ty, mask);
      ptx = tx; pty = ty;
    }
  }

  function paintDiagonal(d) {
    const ax = d.x0, ay = d.y0, bx = d.x1, by = d.y1;
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    const perpx = -dy / len, perpy = dx / len, off = 1.1;
    // masque « aller » (A→B) et « retour » (B→A) selon la pente
    const fwd = (dx < 0 ? LW : LE) | (dy < 0 ? LN : LS);
    const bwd = (dx < 0 ? LE : LW) | (dy < 0 ? LS : LN);
    paintDiagLane(ax + perpx * off, ay + perpy * off, bx + perpx * off, by + perpy * off, fwd);
    paintDiagLane(bx - perpx * off, by - perpy * off, ax - perpx * off, ay - perpy * off, bwd);
    // corridor sans bâtiment (petits pavés réservés le long de l'axe)
    const rboxes = Math.ceil(len / 2.5);
    for (let k = 0; k <= rboxes; k++) {
      const t = k / rboxes;
      const cx = Math.floor(ax + dx * t) - 2, cy = Math.floor(ay + dy * t) - 2;
      if (!insideAnyRoundabout(cx + 2, cy + 2, 1)) reserved.push({ x: cx, y: cy, w: 5, h: 5 });
    }
    diagonals.push({
      ax: ax * T, ay: ay * T, bx: bx * T, by: by * T,
      nx: perpx, ny: perpy, name: d.name
    });
  }

  function genSidewalks() {
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        if (get(x, y) !== GRASS) continue;
        if (get(x + 1, y) === ROAD || get(x - 1, y) === ROAD ||
            get(x, y + 1) === ROAD || get(x, y - 1) === ROAD) {
          set(x, y, SIDEWALK);
        }
      }
    }
  }

  /* ---------- îlots + monuments des ronds-points ---------- */

  function genRoundaboutFeatures(rng) {
    for (const rb of roundabouts) {
      const px = rb.cx * T, py = rb.cy * T, rr = rb.islandR * T;
      // collision : l'îlot central est infranchissable
      addSolid({ shape: "circle", x: px, y: py, r: rr * 0.92 });
      structures.push({
        x: px, y: py, r: rr + rb.rOut * T,
        draw: (ctx, camX, camY) => drawRoundaboutIsland(ctx, rb, px, py, rr, camX, camY)
      });
    }
  }

  function drawRoundaboutIsland(ctx, rb, px, py, rr, camX, camY) {
    // pelouse / dallage de l'îlot
    ctx.fillStyle = "#5f7a48";
    ctx.beginPath(); ctx.arc(px, py, rr, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = "#cfc6b3"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(px, py, rr - 2, 0, U.TAU); ctx.stroke();
    ctx.strokeStyle = INK_MAP; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(px, py, rr, 0, U.TAU); ctx.stroke();

    switch (rb.island) {
      case "fountain": {
        ctx.fillStyle = "#8fa9b8";
        ctx.beginPath(); ctx.arc(px, py, rr * 0.55, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = "#d8e6ec"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(px, py, rr * 0.55, 0, U.TAU); ctx.stroke();
        const jet = { x: 0, y: 0 };
        S.elevate(px, py, 34, camX, camY, jet);
        ctx.strokeStyle = "#bfe4f2"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(jet.x, jet.y); ctx.stroke();
        ctx.fillStyle = "rgba(210,240,250,0.85)";
        ctx.beginPath(); ctx.arc(jet.x, jet.y, 5, 0, U.TAU); ctx.fill();
        break;
      }
      case "statue": {
        const top = { x: 0, y: 0 };
        S.drawBox(ctx, px - 8, py - 8, 16, 16, 20, camX, camY, "#9aa0a3", "#c2c8cb");
        S.elevate(px, py, 46, camX, camY, top);
        ctx.fillStyle = "#c9a227"; ctx.strokeStyle = INK_MAP; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.ellipse(top.x, top.y, 6, 12, 0, 0, U.TAU); ctx.fill(); ctx.stroke();
        break;
      }
      case "obelisk": {
        const tip = { x: 0, y: 0 }, base = { x: 0, y: 0 };
        S.elevate(px, py, 0, camX, camY, base);
        S.elevate(px, py, 64, camX, camY, tip);
        ctx.fillStyle = "#b8a06a"; ctx.strokeStyle = INK_MAP; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(base.x - 6, base.y); ctx.lineTo(base.x + 6, base.y);
        ctx.lineTo(tip.x + 1.5, tip.y); ctx.lineTo(tip.x - 1.5, tip.y);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#ffc857";
        ctx.beginPath(); ctx.arc(tip.x, tip.y, 2, 0, U.TAU); ctx.fill();
        break;
      }
      default: { // garden
        const rng = U.makeRng((px * 13 + py * 7) >>> 0);
        for (let k = 0; k < 5; k++) {
          const a = rng() * U.TAU, rd = rng() * rr * 0.6;
          S.PROPS.tree(ctx, { x: px + Math.cos(a) * rd, y: py + Math.sin(a) * rd, h: 30, r: 10 }, camX, camY);
        }
      }
    }
  }

  /* ---------- plage ---------- */

  function genBeach(rng) {
    const bc = MD.BEACH_CONFIG;
    for (let x = bc.x0; x <= bc.x1; x++) {
      const edge = Math.min(x - bc.x0, bc.x1 - x);
      const deep = edge < 5 ? 1 : (edge < 12 ? 2 : 3);
      for (let k = 0; k < deep; k++)
        if (get(x, bc.baseY + k) === GRASS) set(x, bc.baseY + k, SAND);
      const bump = Math.exp(-Math.pow((x - (bc.x0 + bc.x1) / 2) / 30, 2));
      const sea = Math.round(bump * 3);
      for (let k = 1; k <= sea; k++) set(x, bc.baseY - k, SAND);
    }

    const PARA_C = ["#ff4f9a", "#2ee6a8", "#ffc857", "#7ad7ff", "#e58fb1",
                    "#a9dfbf", "#ff8fb0", "#7ad7ff", "#ffc857"];
    const TOWEL_C = ["#7ad7ff", "#ffc857", "#e58fb1", "#a9dfbf", "#f5f0e6"];

    for (let i = 0; i < bc.parasols.length; i++) {
      const [ptx, pty] = bc.parasols[i];
      const px = ptx * T, py = pty * T;
      structures.push({ x: px, y: py, r: 40, draw: (ctx, cx, cy) => S.PROPS.parasol(ctx, { x: px, y: py, c: PARA_C[i % PARA_C.length] }, cx, cy) });
      addSolid({ shape: "circle", x: px, y: py, r: 3.5 });
      const tw = { type: "towel", x: px + 20 + rng() * 8, y: py + 6 + rng() * 8, a: (rng() - 0.5) * 0.6, c: U.pick(rng, TOWEL_C) };
      flatProps.push(tw);
      beachSeats.push({ x: tw.x, y: tw.y, a: tw.a });
    }
    for (const [tx2, ty2] of bc.towels) {
      const tw = { type: "towel", x: tx2 * T, y: ty2 * T, a: (rng() - 0.5) * 0.7, c: U.pick(rng, TOWEL_C) };
      flatProps.push(tw);
      beachSeats.push({ x: tw.x, y: tw.y, a: tw.a });
    }
  }

  /* ---------- échelles ---------- */

  function addLadder(tx, ty, dir) {
    if (get(tx, ty) !== DOCK) return;
    const wx = tx + (dir === 2 ? -1 : dir === 3 ? 1 : 0);
    const wy = ty + (dir === 0 ? 1 : dir === 1 ? -1 : 0);
    if (get(wx, wy) !== WATER) return;
    const cx = (tx + 0.5) * T, cy = (ty + 0.5) * T;
    const ex = dir === 2 ? tx * T + 4 : dir === 3 ? tx * T + T - 4 : cx;
    const ey = dir === 0 ? ty * T + T - 4 : dir === 1 ? ty * T + 4 : cy;
    flatProps.push({ type: "ladder", x: ex, y: ey, dir });
    ladders.push({ x: ex, y: ey, topX: cx, topY: cy, waterX: (wx + 0.5) * T, waterY: (wy + 0.5) * T });
  }

  function genLadders() {
    const lp = MD.LADDER_POSITIONS;
    const cy0 = MD.CANAL_CONFIG.waterY0, cy1 = MD.CANAL_CONFIG.waterY1;
    for (const x of lp.canalNorth) addLadder(x, cy0 - 1, 0);
    for (const x of lp.canalSouth) addLadder(x, cy1 + 1, 1);
    for (const x of lp.southShore) addLadder(x, MH - 14, 0);
    // jetées : bande de 4 tuiles de large, l'eau borde les côtés est/ouest
    // (le sud d'une échelle posée au milieu de la jetée est encore de la
    // jetée — une échelle « plein sud » n'y trouverait jamais d'eau).
    for (const [px, py] of lp.piers) {
      addLadder(px, py, 2);     // bord ouest
      addLadder(px + 3, py, 3); // bord est
    }
  }

  /* ---------- trafic nautique ---------- */

  function genBoatTraffic() {
    for (const bs of MD.BOAT_SPAWNS) {
      boatSpawns.push({ type: bs.type, x: bs.tx * T, y: bs.ty * T, a: bs.a, c: bs.c });
    }
    for (const br of MD.BOAT_ROUTES) {
      boatRoutes.push({
        type: br.type, c: br.c, mode: br.mode, cruise: br.cruise,
        wps: br.wps.map(([x, y]) => ({ x: x * T, y: y * T }))
      });
    }
  }

  /* ---------- réservations ---------- */

  function reserveSpecials() {
    for (const r of MD.RESERVATIONS) reserved.push(r);
  }

  /* ---------- remplissage des blocs ---------- */

  function genBlocks(rng) {
    const vr = MD.VROADS, hr = MD.HROADS;
    const cy0 = MD.CANAL_CONFIG.waterY0 - 2, cy1 = MD.CANAL_CONFIG.waterY1 + 2;

    for (let i = 0; i < vr.length - 1; i++) {
      for (let j = 0; j < hr.length - 1; j++) {
        const x0 = vr[i] + 3, x1 = vr[i + 1] - 2;
        const y0 = hr[j] + 3, y1 = hr[j + 1] - 2;
        if (x1 < x0 || y1 < y0) continue;
        if (y0 <= cy1 && y1 >= cy0) continue;
        const cx = ((x0 + x1) / 2 + 0.5) * T, cy = ((y0 + y1) / 2 + 0.5) * T;
        const d = districtAt(cx, cy);
        if (!d) continue;
        const block = { x0, y0, x1, y1, rng, district: d.key };
        fillBlock(block, rng);
      }
    }
  }

  function fillBlock(b, rng) {
    const palette = MD.BUILDING_PALETTES[b.district];
    if (!palette) return;

    // set ground
    const groundTile = (b.district === "docks" || b.district === "industrial") ? DOCK :
                       (b.district === "downtown" || b.district === "finance" ||
                        b.district === "lotus" || b.district === "market") ? PLAZA : null;
    if (groundTile) {
      for (let y = b.y0 - 1; y <= b.y1 + 1; y++)
        for (let x = b.x0 - 1; x <= b.x1 + 1; x++)
          if (get(x, y) === GRASS) set(x, y, groundTile);
    }

    // place buildings
    const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
    const nBuildings = Math.max(1, Math.round(bw * bh * palette.density / 30));

    for (let k = 0; k < nBuildings; k++) {
      const tw = U.rint(rng, 3, Math.min(8, bw - 1));
      const th = U.rint(rng, 3, Math.min(6, bh - 1));
      const tx = U.rint(rng, b.x0, Math.max(b.x0, b.x1 - tw + 1));
      const ty = U.rint(rng, b.y0, Math.max(b.y0, b.y1 - th + 1));
      if (!canPlace(tx, ty, tw, th)) continue;

      const wall = U.pick(rng, palette.walls);
      const height = U.pick(rng, palette.heights) + (elevation[idx(tx, ty)] || 0);
      const floors = U.pick(rng, palette.floors);
      const archetype = U.pick(rng, palette.styles);
      const roofType = B.pickRoofType(rng, archetype);

      const signs = MD.SIGNS[b.district];
      const hasSign = signs && rng() < 0.35;

      addBuilding({
        tx, ty, tw, th, height, floors, archetype, roofType,
        wall, roof: U.shade(wall, -0.28),
        trim: rng() < 0.4 ? U.pick(rng, MD.SIGN_COLORS) : null,
        sign: hasSign ? { text: U.pick(rng, signs), color: U.pick(rng, MD.SIGN_COLORS) } : null,
        awning: (archetype === "shophouse" && rng() < 0.6) ? U.pick(rng, ["#c0392b", "#1e8449", "#ffc857", "#2874a6"]) : null,
        laundry: (b.district === "lotus" || b.district === "market") && rng() < 0.25,
        accessible: rng() < 0.04
      });
    }

    // trees
    const nTrees = Math.round(bw * bh * (palette.trees || 0) / 20);
    for (let k = 0; k < nTrees; k++) {
      const x = U.rrange(rng, b.x0 + 0.5, b.x1 + 0.5) * T;
      const y = U.rrange(rng, b.y0 + 0.5, b.y1 + 0.5) * T;
      const t = get(Math.floor(x / T), Math.floor(y / T));
      if (t === GRASS || t === PLAZA || t === PATH) {
        addTree(rng() < 0.2 ? "cherry" : "tree", x, y, rng);
      }
    }

    // lanternes + étals de marché en zone lotus / bazar
    if (b.district === "lotus" || b.district === "market") {
      for (let k = 0; k < 2; k++) {
        const x = U.rrange(rng, b.x0 + 1, b.x1) * T;
        const y = U.rrange(rng, b.y0 + 1, b.y1) * T;
        if (get(Math.floor(x / T), Math.floor(y / T)) !== BUILDING) addLantern(x, y);
      }
      // cageots de produits + étals colorés le long des façades
      for (let k = 0; k < 3; k++) {
        if (rng() > 0.55) continue;
        const x = U.rrange(rng, b.x0 + 0.5, b.x1 + 0.5) * T;
        const y = U.rrange(rng, b.y0 + 0.5, b.y1 + 0.5) * T;
        const gt = get(Math.floor(x / T), Math.floor(y / T));
        if (gt !== PLAZA && gt !== SIDEWALK) continue;
        if (rng() < 0.4) {
          const c1 = U.pick(rng, ["#c0392b", "#1e8449", "#2874a6", "#b9770e"]);
          const p = { type: "stall", x, y, c1, c2: "#f5f0e6" };
          structures.push({ x, y, r: 40, draw: (ctx, cx, cy) => S.PROPS.stall(ctx, p, cx, cy) });
          addSolid({ shape: "rect", x: x - 15, y: y - 10, w: 30, h: 20 });
        } else {
          flatProps.push({ type: "produce", x, y, a: (rng() - 0.5) * 0.5,
            pc: U.pick(rng, [["#e8622b", "#e0b020", "#c0392b"], ["#7cb156", "#e0b020", "#b9770e"], ["#c0392b", "#8e44ad", "#e8622b"]]) });
          addSolid({ shape: "rect", x: x - 10, y: y - 7, w: 20, h: 14 });
        }
      }
    }
  }

  function addBuilding(b) {
    for (let ty = b.ty; ty < b.ty + b.th; ty++)
      for (let tx = b.tx; tx < b.tx + b.tw; tx++)
        set(tx, ty, BUILDING);
    b.x = b.tx * T; b.y = b.ty * T; b.w = b.tw * T; b.h = b.th * T;
    b.cx = b.x + b.w / 2; b.cy = b.y + b.h / 2;
    buildings.push(b);
    structures.push({
      x: b.cx, y: b.cy, r: Math.max(b.w, b.h) / 2 + b.height * 0.6,
      draw: (ctx, cx, cy) => B.renderBuilding(ctx, b, cx, cy)
    });
    return b;
  }

  function canPlace(tx, ty, tw, th) {
    if (isReserved(tx, ty, tw, th)) return false;
    for (let y = ty; y < ty + th; y++)
      for (let x = tx; x < tx + tw; x++) {
        const t = get(x, y);
        if (t !== GRASS && t !== PLAZA && t !== DOCK) return false;
      }
    return true;
  }

  /* ---------- zones custom ---------- */

  function genCanalZone(rng) {
    const cy0 = MD.CANAL_CONFIG.waterY0, cy1 = MD.CANAL_CONFIG.waterY1;
    // promenade nord
    for (let y = cy0 - 5; y <= cy0 - 2; y++)
      for (let x = 10; x <= MW - 12; x++)
        if (get(x, y) === GRASS) set(x, y, y === cy0 - 2 ? DOCK : PLAZA);
    for (let x = 15; x <= MW - 15; x += 9) {
      if (get(x, cy0 - 4) === PLAZA) {
        addTree(x % 18 === 15 ? "cherry" : "tree", (x + 0.5) * T, (cy0 - 3.5) * T, rng);
        if (rng() < 0.5) {
          const bench = { type: "bench", x: (x + 4) * T, y: (cy0 - 2.8) * T, a: 0 };
          flatProps.push(bench); benches.push(bench);
        }
      }
    }
    // berge sud : conteneurs
    for (let y = cy1 + 2; y <= cy1 + 8; y++)
      for (let x = 10; x <= MW - 12; x++)
        if (get(x, y) === GRASS) set(x, y, DOCK);
    for (let x = 18; x <= MW - 20; x += 14) {
      if (rng() < 0.7) {
        const cx = (x + rng() * 3) * T, cy2 = (cy1 + 4 + rng() * 3) * T;
        if (get(Math.floor(cx / T), Math.floor(cy2 / T)) === DOCK)
          addContainer(cx, cy2, rng() < 0.5 ? 0 : Math.PI / 2, rng);
      }
    }
    // grues
    for (const gx of [50, 130, 210, 290, 350]) {
      const x = gx * T, y = (cy1 + 2.4) * T;
      structures.push({ x, y, r: 140, draw: (ctx, cx, cy) => S.PROPS.crane(ctx, { x, y }, cx, cy) });
      addSolid({ shape: "rect", x: x - 10, y: y - 7, w: 20, h: 14 });
    }
  }

  function genDocksGround(rng) {
    for (const gx of [65, 155, 245, 335]) {
      const x = gx * T, y = (MH - 20) * T;
      structures.push({ x, y, r: 140, draw: (ctx, cx, cy) => S.PROPS.crane(ctx, { x, y }, cx, cy) });
      addSolid({ shape: "rect", x: x - 10, y: y - 7, w: 20, h: 14 });
    }
    for (let k = 0; k < 35; k++) {
      const x = U.rrange(rng, 15, MW - 15) * T;
      const y = U.rrange(rng, MH - 36, MH - 15) * T;
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (get(tx, ty) === DOCK && rng() < 0.7) addCrate(x, y, rng);
    }
  }

  function genPark(rng) {
    const pc = MD.PARK_CONFIG;
    // étang
    for (let y = pc.y0; y <= pc.y1; y++)
      for (let x = pc.x0; x <= pc.x1; x++) {
        const dx = (x - pc.pond.cx) / pc.pond.rx;
        const dy = (y - pc.pond.cy) / pc.pond.ry;
        if (dx * dx + dy * dy < 1) set(x, y, WATER);
      }
    // allées
    for (const p of pc.paths) {
      if (p.axis === "h") {
        for (let x = p.from; x <= p.to; x++) if (get(x, p.at) === GRASS) set(x, p.at, PATH);
      } else {
        for (let y = p.from; y <= p.to; y++) if (get(p.at, y) === GRASS) set(p.at, y, PATH);
      }
    }
    // pagode
    const pg = pc.pagoda;
    const pgx = (pg.tx + 0.5) * T, pgy = (pg.ty + 0.5) * T;
    structures.push({
      x: pgx, y: pgy, r: 130,
      draw: (ctx, cx, cy) => {
        S.drawBox(ctx, pgx - 72, pgy - 72, 144, 144, 30, cx, cy, "#8a3324", "#7a1f14");
        S.drawBox(ctx, pgx - 52, pgy - 52, 104, 104, 58, cx, cy, "#a4442f", "#8f2717");
        S.drawBox(ctx, pgx - 32, pgy - 32, 64, 64, 86, cx, cy, "#b85c3e", "#a43214");
        S.drawBox(ctx, pgx - 14, pgy - 14, 28, 28, 108, cx, cy, "#ffc857", "#e0a52f");
      }
    });
    for (let ty = pg.ty; ty < pg.ty + pg.size; ty++)
      for (let tx = pg.tx; tx < pg.tx + pg.size; tx++) set(tx, ty, BUILDING);
    // arbres
    for (let k = 0; k < pc.trees; k++) {
      const x = U.rrange(rng, pc.x0, pc.x1) * T, y = U.rrange(rng, pc.y0, pc.y1) * T;
      if (get(Math.floor(x / T), Math.floor(y / T)) === GRASS)
        addTree("tree", x, y, rng);
    }
    for (let k = 0; k < pc.cherries; k++) {
      const x = U.rrange(rng, pc.x0, pc.x1) * T, y = U.rrange(rng, pc.y0, pc.y1) * T;
      if (get(Math.floor(x / T), Math.floor(y / T)) === GRASS)
        addTree("cherry", x, y, rng);
    }
    // bancs + lanternes
    for (let k = 0; k < pc.benches; k++) {
      const x = U.rrange(rng, pc.x0 + 2, pc.x1 - 2) * T;
      const y = U.rrange(rng, pc.y0 + 2, pc.y1 - 2) * T;
      const t = get(Math.floor(x / T), Math.floor(y / T));
      if (t === GRASS || t === PATH) {
        const bench = { type: "bench", x, y, a: rng() < 0.5 ? 0 : Math.PI / 2 };
        flatProps.push(bench); benches.push(bench);
      }
    }
    for (let k = 0; k < pc.lanterns; k++) {
      const x = U.rrange(rng, pc.x0 + 2, pc.x1 - 2) * T;
      const y = U.rrange(rng, pc.y0 + 2, pc.y1 - 2) * T;
      if (get(Math.floor(x / T), Math.floor(y / T)) !== BUILDING) addLantern(x, y);
    }
  }

  function genSpecialBuildings(rng) {
    for (const def of MD.SPECIAL_BUILDINGS) {
      const b = addBuilding({
        tx: def.tx, ty: def.ty, tw: def.tw, th: def.th,
        height: def.height, wall: def.wall, roof: def.roof,
        archetype: def.archetype, floors: Math.max(2, Math.ceil(def.height / 18)),
        sign: def.sign, trim: def.trim,
        accessible: def.accessible || false, interior: def.interior || null,
        hospital: def.id === "hospital",
        roofType: def.archetype === "skyscraper" ? "helipad" : B.pickRoofType(rng, def.archetype)
      });
      POI[def.id] = { x: b.cx, y: (def.ty + def.th + 0.9) * T };
    }
    // gates
    for (const gate of MD.GATES) {
      addGate(gate.tx * T, gate.ty * T);
    }
  }

  function addGate(gx, gy) {
    const w = 92;
    structures.push({
      x: gx, y: gy, r: 110,
      draw: (ctx, camX, camY) => {
        S.drawBox(ctx, gx - w / 2 - 10, gy - 6, 14, 12, 48, camX, camY, "#a43214", "#7a1f14");
        S.drawBox(ctx, gx + w / 2 - 4, gy - 6, 14, 12, 48, camX, camY, "#a43214", "#7a1f14");
        const e0 = { x: 0, y: 0 }, e1 = { x: 0, y: 0 }, e2 = { x: 0, y: 0 }, e3 = { x: 0, y: 0 };
        S.elevate(gx - w / 2 - 12, gy, 44, camX, camY, e0);
        S.elevate(gx + w / 2 + 12, gy, 44, camX, camY, e1);
        S.elevate(gx + w / 2 + 12, gy, 60, camX, camY, e2);
        S.elevate(gx - w / 2 - 12, gy, 60, camX, camY, e3);
        ctx.fillStyle = "#c0392b";
        ctx.strokeStyle = S.INK; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(e0.x, e0.y); ctx.lineTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y); ctx.lineTo(e3.x, e3.y);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        S.elevate(gx, gy, 74, camX, camY, e0);
        ctx.fillStyle = "#ffc857";
        ctx.beginPath();
        ctx.moveTo(e3.x - 8, e3.y); ctx.lineTo(e2.x + 8, e2.y); ctx.lineTo(e0.x, e0.y);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    });
    addSolid({ shape: "rect", x: gx - w / 2 - 12, y: gy - 7, w: 16, h: 14 });
    addSolid({ shape: "rect", x: gx + w / 2 - 6, y: gy - 7, w: 16, h: 14 });
  }

  /* ---------- props helpers ---------- */

  function addSolid(sp) {
    solidProps.push(sp);
    const x0 = Math.floor((sp.x - (sp.r || 0)) / T), y0 = Math.floor((sp.y - (sp.r || 0)) / T);
    const x1 = Math.floor(((sp.x + (sp.w || sp.r || 0))) / T), y1 = Math.floor(((sp.y + (sp.h || sp.r || 0))) / T);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        if (!inB(tx, ty)) continue;
        const k = idx(tx, ty);
        if (!solidGrid.has(k)) solidGrid.set(k, []);
        solidGrid.get(k).push(sp);
      }
  }

  function addTree(kind, x, y, rng) {
    const p = { type: kind, x, y, h: U.rint(rng, 40, 54), r: U.rint(rng, 12, 17) };
    structures.push({ x, y, r: 70, draw: (ctx, cx, cy) => S.PROPS[kind](ctx, p, cx, cy) });
    addSolid({ shape: "circle", x, y, r: 5 });
  }

  function addLantern(x, y) {
    structures.push({ x, y, r: 50, draw: (ctx, cx, cy) => S.PROPS.lantern(ctx, { x, y }, cx, cy) });
    addSolid({ shape: "circle", x, y, r: 3 });
  }

  function addContainer(x, y, a, rng) {
    const colors = ["#c0632b", "#2e6d8c", "#3f8f5f", "#8c3f3f", "#b3541e", "#5d6d7e"];
    const p = { type: "container", x, y, a, c: U.pick(rng, colors), w: 76, hh: 30, h: U.rint(rng, 24, 34) };
    structures.push({ x, y, r: 70, draw: (ctx, cx, cy) => S.PROPS.container(ctx, p, cx, cy) });
    if (Math.abs(Math.sin(a)) > 0.5) addSolid({ shape: "rect", x: x - 15, y: y - 38, w: 30, h: 76 });
    else addSolid({ shape: "rect", x: x - 38, y: y - 15, w: 76, h: 30 });
  }

  function addCrate(x, y, rng) {
    const s = U.rint(rng, 13, 18);
    structures.push({ x, y, r: 30, draw: (ctx, cx, cy) => S.PROPS.crate(ctx, { x, y, s }, cx, cy) });
    addSolid({ shape: "rect", x: x - s / 2, y: y - s / 2, w: s, h: s });
  }

  function genStreetProps(rng) {
    for (const s of segs) {
      const step = 8, w = s.w || 2;
      for (let t = s.from + 4; t <= s.to - 2; t += step) {
        const side = ((t / step) | 0) % 2 === 0 ? -1 : 1;
        if (s.v) {
          if (insideAnyRoundabout(s.at + w / 2, t, 1.5)) continue;
          const x = side < 0 ? (s.at - 0.35) * T : (s.at + w + 0.35) * T;
          placeStreetProp(x, (t + 0.5) * T, rng);
        } else {
          if (insideAnyRoundabout(t, s.at + w / 2, 1.5)) continue;
          const y = side < 0 ? (s.at - 0.35) * T : (s.at + w + 0.35) * T;
          placeStreetProp((t + 0.5) * T, y, rng);
        }
      }
    }
    // extra trees in residential areas
    for (let k = 0; k < 120; k++) {
      const x = U.rint(rng, 200, MW - 15), y = U.rint(rng, 22, 70);
      if (get(x, y) === GRASS && rng() < 0.5) addTree("tree", (x + 0.5) * T, (y + 0.5) * T, rng);
    }
    for (let k = 0; k < 80; k++) {
      const x = U.rint(rng, 255, MW - 15), y = U.rint(rng, 72, 155);
      if (get(x, y) === GRASS && rng() < 0.4) addTree("tree", (x + 0.5) * T, (y + 0.5) * T, rng);
    }
  }

  // structure (prop en élévation, trié par profondeur) / prop plat (au sol)
  function addStructProp(type, x, y, extra, r) {
    const e = extra || {};
    structures.push({ x, y, r: r || 46, draw: (ctx, cx, cy) => S.PROPS[type](ctx, Object.assign({ x, y }, e), cx, cy) });
    addSolid({ shape: "circle", x, y, r: 3 });
  }
  function addFlatProp(type, x, y, extra, solidR) {
    flatProps.push(Object.assign({ type, x, y }, extra || {}));
    if (solidR) addSolid({ shape: "circle", x, y, r: solidR });
  }

  // mobilier urbain diversifié, à saveur de quartier
  function placeStreetProp(x, y, rng) {
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    const t = get(tx, ty);
    if (t !== SIDEWALK && t !== PLAZA && t !== DOCK) return;
    const d = districtAt(x, y);
    const dk = d ? d.key : "";
    const oriental = dk === "lotus" || dk === "market";
    const office = dk === "downtown" || dk === "finance";
    const resid = dk === "resid" || dk === "resid_n" || dk === "hills" || dk === "campus";
    const roll = rng();

    if (roll < 0.50) return addStructProp("lamp", x, y);
    if (roll < 0.57 && oriental) return addStructProp("lantern", x, y, null, 50);
    if (roll < 0.65) return addFlatProp("hydrant", x, y, null, 4);
    if (roll < 0.72) return addFlatProp("trash", x, y, null, 5);
    if (roll < 0.78) return addFlatProp("bollard", x, y, null, 4);
    if (roll < 0.84) return addFlatProp("planter", x, y, null, 8);
    if (roll < 0.88 && resid) return addFlatProp("mailbox", x, y, null, 5);
    if (roll < 0.92)
      return addFlatProp("bicycle", x, y, { a: rng() * U.TAU, c: U.pick(rng, ["#2874a6", "#c0392b", "#1e8449", "#b9770e"]) }, 6);
    if (roll < 0.955 && office) return addStructProp("vending", x, y, null, 40);
    if (roll < 0.975 && office) return addStructProp("phonebooth", x, y, null, 46);
    if (roll < 0.99) return addFlatProp("cone", x, y, null, 3);
    return addStructProp("busstop", x, y, { a: 0 }, 60);
  }

  function genParkedCars(rng) {
    const types = ["sedan", "sedan", "taxi", "van", "pickup", "sport", "sedan", "bike"];
    for (const s of segs) {
      if ((s.w || 2) > MD.STREET_W) continue; // pas de stationnement sur les boulevards
      for (let t = s.from + 5; t <= s.to - 4; t += U.rint(rng, 8, 14)) {
        if (rng() < 0.4) continue;
        if (s.v) {
          const ty = t;
          if (bridgeF[idx(s.at, ty)] || isCross(s.at, ty)) continue;
          if (insideAnyRoundabout(s.at + 1, ty, 1.5)) continue;
          parkedSpawns.push({
            x: (s.at + 0.30) * T, y: (ty + 0.5) * T,
            angle: Math.PI / 2, type: U.pick(rng, types),
            color: U.pick(rng, S.CAR_COLORS)
          });
        } else {
          const tx = t;
          if (bridgeF[idx(tx, s.at)] || isCross(tx, s.at)) continue;
          if (insideAnyRoundabout(tx, s.at + 1, 1.5)) continue;
          parkedSpawns.push({
            x: (tx + 0.5) * T, y: (s.at + 0.30) * T,
            angle: Math.PI, type: U.pick(rng, types),
            color: U.pick(rng, S.CAR_COLORS)
          });
        }
      }
    }
  }

  function isCross(tx, ty) {
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        if (!inB(tx + dx, ty + dy)) continue;
        const m = lane[idx(tx + dx, ty + dy)];
        if ((m & (LN | LS)) && (m & (LE | LW))) return true;
      }
    return false;
  }

  function genPickups() {
    const pk = MD.PICKUPS;
    for (const [x, y] of pk.health) pickupSpawns.push({ kind: "health", x: x * T, y: y * T });
    for (const [x, y] of pk.cash) pickupSpawns.push({ kind: "cash", x: x * T, y: y * T, amount: 30 });
    for (const [x, y] of pk.bat) pickupSpawns.push({ kind: "bat", x: x * T, y: y * T });
    for (const [x, y] of pk.pistol) pickupSpawns.push({ kind: "pistol", x: x * T, y: y * T });
    for (const [x, y] of pk.smg) pickupSpawns.push({ kind: "smg", x: x * T, y: y * T });
    for (const [x, y] of pk.shotgun) pickupSpawns.push({ kind: "shotgun", x: x * T, y: y * T });
    for (const [x, y] of pk.armor) pickupSpawns.push({ kind: "armor", x: x * T, y: y * T });
  }

  function genPOI() {
    for (const [key, def] of Object.entries(MD.POI_DEFS)) {
      if (!POI[key]) POI[key] = { x: def.tx * T, y: def.ty * T };
    }
  }

  /* =========================================================
     RENDU DU SOL
     ========================================================= */

  const CHUNK = 16;
  const CPX = CHUNK * T;
  const CW = Math.ceil(MW / CHUNK);
  const CH = Math.ceil(MH / CHUNK);
  const chunkCache = new Map();
  const MAX_CHUNKS = 64;
  const GSS = 2;

  const TILE_COLORS = {
    [WATER]: "#16535c", [GRASS]: "#7fae5a", [SIDEWALK]: "#cfc6b3",
    [ROAD]: "#3b3f4a", [PLAZA]: "#d8c9a8", [DOCK]: "#9aa0a3",
    [PATH]: "#d9c08f", [BUILDING]: "#2a2633", [SAND]: "#e8d5a4"
  };

  function chunkCanvas(ci, cj) {
    const key = cj * CW + ci;
    let c = chunkCache.get(key);
    if (c) return c;
    if (chunkCache.size >= MAX_CHUNKS) {
      const first = chunkCache.keys().next().value;
      chunkCache.delete(first);
    }
    const hi = document.createElement("canvas");
    hi.width = CPX * GSS; hi.height = CPX * GSS;
    const hiCtx = hi.getContext("2d");
    hiCtx.scale(GSS, GSS);
    renderChunk(hiCtx, ci, cj);
    c = document.createElement("canvas");
    c.width = CPX; c.height = CPX;
    const fCtx = c.getContext("2d");
    fCtx.imageSmoothingEnabled = true;
    if ("imageSmoothingQuality" in fCtx) fCtx.imageSmoothingQuality = "high";
    fCtx.drawImage(hi, 0, 0, CPX, CPX);
    chunkCache.set(key, c);
    return c;
  }

  function renderChunk(ctx, ci, cj) {
    const ox = ci * CHUNK, oy = cj * CHUNK;
    for (let ty = 0; ty < CHUNK; ty++)
      for (let tx = 0; tx < CHUNK; tx++)
        drawTile(ctx, ox + tx, oy + ty, tx * T, ty * T);
    ctx.save();
    ctx.translate(-ox * T, -oy * T);
    drawRoadMarkings(ctx, ox * T, oy * T, (ox + CHUNK) * T, (oy + CHUNK) * T);
    ctx.restore();
  }

  const MAT_NAME = {
    [WATER]: "water", [GRASS]: "grass", [SIDEWALK]: "sidewalk", [ROAD]: "road",
    [PLAZA]: "plaza", [DOCK]: "dock", [PATH]: "path", [BUILDING]: "building", [SAND]: "sand"
  };

  function drawTile(ctx, gx, gy, px, py) {
    const t = get(gx, gy);
    const h = tileHash(gx, gy);

    // tablier de pont : platelage spécifique (pas de l'asphalte)
    if (t === ROAD && bridgeF[idx(gx, gy)]) {
      ctx.fillStyle = "#4a505c"; ctx.fillRect(px, py, T, T);
      ctx.strokeStyle = "rgba(20,24,30,0.4)"; ctx.lineWidth = 1;
      for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.moveTo(px, py + k * T / 3); ctx.lineTo(px + T, py + k * T / 3); ctx.stroke(); }
      ctx.fillStyle = "#20242c";
      if (get(gx - 1, gy) === WATER || (get(gx - 1, gy) === DOCK && !bridgeF[idx(gx - 1, gy)])) ctx.fillRect(px, py, 4, T);
      if (get(gx + 1, gy) === WATER || (get(gx + 1, gy) === DOCK && !bridgeF[idx(gx + 1, gy)])) ctx.fillRect(px + T - 4, py, 4, T);
      return;
    }

    // texture de base ultra-détaillée (moteur paramétrique)
    TX.paintTile(ctx, px, py, T, T, gx, gy, MAT_NAME[t] || "building");

    // relief (herbe surélevée = collines)
    if (t === GRASS) {
      const elev = inB(gx, gy) ? elevation[idx(gx, gy)] : 0;
      if (elev > 0) { ctx.fillStyle = "rgba(40,80,30," + (elev / 60) + ")"; ctx.fillRect(px, py, T, T); }
    }

    // détails dépendant du voisinage
    switch (t) {
      case WATER: {
        ctx.strokeStyle = "rgba(232,246,248,0.45)"; ctx.lineWidth = 2;
        ctx.beginPath();
        if (get(gx, gy - 1) !== WATER) { ctx.moveTo(px, py + 3); ctx.lineTo(px + T, py + 3); }
        if (get(gx, gy + 1) !== WATER) { ctx.moveTo(px, py + T - 3); ctx.lineTo(px + T, py + T - 3); }
        if (get(gx - 1, gy) !== WATER) { ctx.moveTo(px + 3, py); ctx.lineTo(px + 3, py + T); }
        if (get(gx + 1, gy) !== WATER) { ctx.moveTo(px + T - 3, py); ctx.lineTo(px + T - 3, py + T); }
        ctx.stroke();
        if (h < 0.3) {
          ctx.strokeStyle = "rgba(122,215,255,0.22)"; ctx.lineWidth = 1.5;
          ctx.beginPath();
          const wy = py + 10 + h * 90;
          ctx.moveTo(px + 8, wy); ctx.quadraticCurveTo(px + 16, wy - 4, px + 24, wy);
          ctx.quadraticCurveTo(px + 32, wy + 4, px + 40, wy);
          ctx.stroke();
        }
        break;
      }
      case SIDEWALK: {
        // bordure de trottoir renforcée côté chaussée
        ctx.strokeStyle = "#8f8775"; ctx.lineWidth = 3; ctx.beginPath();
        if (get(gx + 1, gy) === ROAD) { ctx.moveTo(px + T - 1.5, py); ctx.lineTo(px + T - 1.5, py + T); }
        if (get(gx - 1, gy) === ROAD) { ctx.moveTo(px + 1.5, py); ctx.lineTo(px + 1.5, py + T); }
        if (get(gx, gy + 1) === ROAD) { ctx.moveTo(px, py + T - 1.5); ctx.lineTo(px + T, py + T - 1.5); }
        if (get(gx, gy - 1) === ROAD) { ctx.moveTo(px, py + 1.5); ctx.lineTo(px + T, py + 1.5); }
        ctx.stroke();
        break;
      }
      case ROAD: {
        // plaque d'égout détaillée (rare)
        if (h < 0.03) {
          const cx = px + 24, cy = py + 24;
          ctx.fillStyle = "#33373f"; ctx.strokeStyle = "#1a1d24"; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(cx, cy, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = "rgba(15,17,22,0.7)"; ctx.lineWidth = 0.7;
          for (let a = 0; a < 8; a++) {
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a / 8 * Math.PI * 2) * 2, cy + Math.sin(a / 8 * Math.PI * 2) * 2);
            ctx.lineTo(cx + Math.cos(a / 8 * Math.PI * 2) * 5.5, cy + Math.sin(a / 8 * Math.PI * 2) * 5.5);
            ctx.stroke();
          }
          ctx.fillStyle = "rgba(80,86,96,0.6)";
          for (let a = 0; a < 6; a++) ctx.fillRect(cx + Math.cos(a / 6 * Math.PI * 2) * 5.5 - 0.7, cy + Math.sin(a / 6 * Math.PI * 2) * 5.5 - 0.7, 1.4, 1.4);
        }
        break;
      }
      case DOCK: {
        ctx.fillStyle = "#5f6d5f";
        if (get(gx, gy + 1) === WATER) ctx.fillRect(px, py + T - 4, T, 4);
        if (get(gx, gy - 1) === WATER) ctx.fillRect(px, py, T, 4);
        if (get(gx + 1, gy) === WATER) ctx.fillRect(px + T - 4, py, 4, T);
        if (get(gx - 1, gy) === WATER) ctx.fillRect(px, py, 4, T);
        break;
      }
      case SAND: {
        ctx.fillStyle = "rgba(150,120,80,0.35)";
        if (get(gx, gy - 1) === WATER) ctx.fillRect(px, py, T, 9);
        if (get(gx, gy + 1) === WATER) ctx.fillRect(px, py + T - 9, T, 9);
        if (get(gx - 1, gy) === WATER) ctx.fillRect(px, py, 9, T);
        if (get(gx + 1, gy) === WATER) ctx.fillRect(px + T - 9, py, 9, T);
        break;
      }
    }

    // ombre douce au pied des bâtiments
    if (t !== BUILDING && t !== WATER) {
      ctx.fillStyle = "rgba(18,14,28,0.16)";
      if (get(gx, gy - 1) === BUILDING) ctx.fillRect(px, py, T, 7);
      if (get(gx, gy + 1) === BUILDING) ctx.fillRect(px, py + T - 7, T, 7);
      if (get(gx - 1, gy) === BUILDING) ctx.fillRect(px, py, 7, T);
      if (get(gx + 1, gy) === BUILDING) ctx.fillRect(px + T - 7, py, 7, T);
    }
  }

  function drawWaterOverlay(ctx, vx0, vy0, vx1, vy1, time) {
    const tx0 = U.clamp(Math.floor(vx0 / T), 0, MW - 1);
    const ty0 = U.clamp(Math.floor(vy0 / T), 0, MH - 1);
    const tx1 = U.clamp(Math.floor(vx1 / T), 0, MW - 1);
    const ty1 = U.clamp(Math.floor(vy1 / T), 0, MH - 1);
    ctx.fillStyle = "rgba(122,215,255,0.10)";
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (tiles[idx(tx, ty)] !== WATER) continue;
        const h = tileHash(tx, ty);
        if (h > 0.5) continue;
        const ph = (time * (10 + h * 16) + h * 480) % (T + 26) - 13;
        ctx.fillRect(tx * T + ph, ty * T + 8 + h * 60, 13 + h * 14, 2.4);
      }
    }
  }

  function drawRoadMarkings(ctx, x0, y0, x1, y1) {
    // 0. bandes d'asphalte des avenues diagonales (sous les marquages)
    for (const d of diagonals) {
      const minx = Math.min(d.ax, d.bx) - 90, maxx = Math.max(d.ax, d.bx) + 90;
      const miny = Math.min(d.ay, d.by) - 90, maxy = Math.max(d.ay, d.by) + 90;
      if (maxx < x0 || minx > x1 || maxy < y0 || miny > y1) continue;
      const hw = 1.9 * T;
      ctx.fillStyle = "#3b3f4a";
      ctx.beginPath();
      ctx.moveTo(d.ax + d.nx * hw, d.ay + d.ny * hw);
      ctx.lineTo(d.bx + d.nx * hw, d.by + d.ny * hw);
      ctx.lineTo(d.bx - d.nx * hw, d.by - d.ny * hw);
      ctx.lineTo(d.ax - d.nx * hw, d.ay - d.ny * hw);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#c9a227"; ctx.lineWidth = 2.4; ctx.setLineDash([14, 18]);
      ctx.beginPath(); ctx.moveTo(d.ax, d.ay); ctx.lineTo(d.bx, d.by); ctx.stroke();
      ctx.setLineDash([]);
    }

    // 1. lignes d'axe des rues (médiane pour les boulevards)
    ctx.strokeStyle = "#c9a227"; ctx.lineWidth = 2.5;
    ctx.setLineDash([14, 18]);
    for (const s of segs) {
      const w = s.w || MD.STREET_W, mid = (s.at + w / 2) * T;
      if (s.v) {
        if (mid < x0 - 50 || mid > x1 + 50) continue;
        ctx.beginPath();
        ctx.moveTo(mid, Math.max(s.from * T, y0 - 40));
        ctx.lineTo(mid, Math.min((s.to + 2) * T, y1 + 40));
        ctx.stroke();
      } else {
        if (mid < y0 - 50 || mid > y1 + 50) continue;
        ctx.beginPath();
        ctx.moveTo(Math.max(s.from * T, x0 - 40), mid);
        ctx.lineTo(Math.min((s.to + 2) * T, x1 + 40), mid);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // 2. passages piétons aux carrefours (hors ronds-points)
    ctx.fillStyle = "rgba(232,228,216,0.75)";
    for (const v of segs) {
      if (!v.v) continue;
      const vw = v.w || 2;
      for (const hseg of segs) {
        if (hseg.v) continue;
        const hw = hseg.w || 2;
        if (hseg.at < v.from || hseg.at > v.to) continue;
        if (v.at < hseg.from || v.at > hseg.to) continue;
        const ix = v.at * T, iy = hseg.at * T;
        if (ix < x0 - 200 || ix > x1 + 200 || iy < y0 - 200 || iy > y1 + 200) continue;
        if (insideAnyRoundabout(v.at + vw / 2, hseg.at + hw / 2, 1)) continue;
        const vwp = vw * T, hwp = hw * T;
        const nV = Math.max(2, Math.round(vwp / 15));
        const nH = Math.max(2, Math.round(hwp / 15));
        for (let k = 0; k < nV; k++) {
          const zx = ix + 5 + k * (vwp - 6) / nV;
          ctx.fillRect(zx, iy - 14, 9, 10);
          ctx.fillRect(zx, iy + hwp + 4, 9, 10);
        }
        for (let k = 0; k < nH; k++) {
          const zy = iy + 5 + k * (hwp - 6) / nH;
          ctx.fillRect(ix - 14, zy, 10, 9);
          ctx.fillRect(ix + vwp + 4, zy, 10, 9);
        }
      }
    }

    // 3. anneaux giratoires des ronds-points
    for (const rb of roundabouts) {
      const px = rb.cx * T, py = rb.cy * T, R = rb.rOut * T;
      if (px + R < x0 || px - R > x1 || py + R < y0 || py - R > y1) continue;
      ctx.strokeStyle = "rgba(232,228,216,0.55)"; ctx.lineWidth = 2;
      ctx.setLineDash([12, 14]);
      ctx.beginPath(); ctx.arc(px, py, (rb.islandR + rb.rOut) / 2 * T, 0, U.TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(20,16,26,0.4)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, R, 0, U.TAU); ctx.stroke();
    }
  }

  function drawGround(ctx, vx0, vy0, vx1, vy1) {
    const ci0 = U.clamp(Math.floor(vx0 / CPX), 0, CW - 1);
    const cj0 = U.clamp(Math.floor(vy0 / CPX), 0, CH - 1);
    const ci1 = U.clamp(Math.floor(vx1 / CPX), 0, CW - 1);
    const cj1 = U.clamp(Math.floor(vy1 / CPX), 0, CH - 1);
    for (let cj = cj0; cj <= cj1; cj++)
      for (let ci = ci0; ci <= ci1; ci++)
        ctx.drawImage(chunkCanvas(ci, cj), ci * CPX, cj * CPX);
    for (const p of flatProps) {
      if (p.x < vx0 - 40 || p.x > vx1 + 40 || p.y < vy0 - 40 || p.y > vy1 + 40) continue;
      S.PROPS[p.type](ctx, p);
    }
  }

  /* ---------- structures ---------- */

  const _visible = [];
  function drawStructures(ctx, camX, camY, vx0, vy0, vx1, vy1) {
    _visible.length = 0;
    for (let i = 0; i < structures.length; i++) {
      const st = structures[i];
      const pad = st.r + 120;
      if (st.x < vx0 - pad || st.x > vx1 + pad || st.y < vy0 - pad || st.y > vy1 + pad) continue;
      st._d2 = U.dist2(st.x, st.y, camX, camY);
      _visible.push(st);
    }
    _visible.sort((a, b) => b._d2 - a._d2);
    for (let i = 0; i < _visible.length; i++) _visible[i].draw(ctx, camX, camY);
  }

  /* =========================================================
     COLLISIONS
     ========================================================= */

  function isSolidTile(tx, ty) {
    const t = get(tx, ty);
    return t === WATER || t === BUILDING;
  }
  function isSolidAt(px, py) { return isSolidTile(Math.floor(px / T), Math.floor(py / T)); }
  function isWalkable(px, py) { return !isSolidAt(px, py); }

  const solidForWalker = (tx, ty) => get(tx, ty) === BUILDING;
  function solidForSwimmer(tx, ty) {
    const t = get(tx, ty);
    if (t === WATER || t === SAND || t === GRASS || t === PATH) return false;
    const cy0 = MD.CANAL_CONFIG.waterY0, cy1 = MD.CANAL_CONFIG.waterY1;
    if (t === ROAD && bridgeF[idx(tx, ty)] && ty >= cy0 && ty <= cy1) return false;
    return true;
  }
  function boatBlockedTile(tx, ty) {
    const t = get(tx, ty);
    if (t === WATER) return false;
    const cy0 = MD.CANAL_CONFIG.waterY0, cy1 = MD.CANAL_CONFIG.waterY1;
    if (t === ROAD && bridgeF[idx(tx, ty)] && ty >= cy0 && ty <= cy1) return false;
    return true;
  }

  function isWaterAt(px, py) { return get(Math.floor(px / T), Math.floor(py / T)) === WATER; }
  function isLowShoreAt(px, py) {
    const t = get(Math.floor(px / T), Math.floor(py / T));
    return t === SAND || t === GRASS || t === PATH;
  }
  function isUnderBridge(px, py) {
    const tx = Math.floor(px / T), ty = Math.floor(py / T);
    const cy0 = MD.CANAL_CONFIG.waterY0, cy1 = MD.CANAL_CONFIG.waterY1;
    return inB(tx, ty) && bridgeF[idx(tx, ty)] === 1 && ty >= cy0 && ty <= cy1;
  }

  function collideCircle(e, r, solidFn) {
    solidFn = solidFn || isSolidTile;
    const tx0 = Math.floor((e.x - r) / T), ty0 = Math.floor((e.y - r) / T);
    const tx1 = Math.floor((e.x + r) / T), ty1 = Math.floor((e.y + r) / T);
    let hit = false;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (solidFn(tx, ty)) {
          if (pushOutRect(e, r, tx * T, ty * T, T, T)) hit = true;
        }
        const list = solidGrid.get(idx(tx, ty));
        if (list) {
          for (const sp of list) {
            if (sp.shape === "circle") {
              const d = U.dist(e.x, e.y, sp.x, sp.y);
              const min = r + sp.r;
              if (d < min && d > 0.001) {
                e.x += (e.x - sp.x) / d * (min - d);
                e.y += (e.y - sp.y) / d * (min - d);
                hit = true;
              }
            } else {
              if (pushOutRect(e, r, sp.x, sp.y, sp.w, sp.h)) hit = true;
            }
          }
        }
      }
    }
    return hit;
  }

  function pushOutRect(e, r, rx, ry, rw, rh) {
    const cx = U.clamp(e.x, rx, rx + rw);
    const cy = U.clamp(e.y, ry, ry + rh);
    const dx = e.x - cx, dy = e.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return false;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      e.x += dx / d * (r - d);
      e.y += dy / d * (r - d);
    } else {
      const l = e.x - rx, rr = rx + rw - e.x, tt = e.y - ry, bb = ry + rh - e.y;
      const m = Math.min(l, rr, tt, bb);
      if (m === l) e.x = rx - r;
      else if (m === rr) e.x = rx + rw + r;
      else if (m === tt) e.y = ry - r;
      else e.y = ry + rh + r;
    }
    return true;
  }

  function pointPush(x, y) {
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (isSolidTile(tx, ty)) return aabbPush(x, y, tx * T, ty * T, T, T);
    const list = solidGrid.get(idx(tx, ty));
    if (list) {
      for (const sp of list) {
        if (sp.shape === "rect") {
          if (x >= sp.x && x < sp.x + sp.w && y >= sp.y && y < sp.y + sp.h)
            return aabbPush(x, y, sp.x, sp.y, sp.w, sp.h);
        } else {
          const d2 = U.dist2(x, y, sp.x, sp.y);
          if (d2 < sp.r * sp.r) {
            const d = Math.sqrt(d2) || 0.01;
            return { x: (x - sp.x) / d * (sp.r - d), y: (y - sp.y) / d * (sp.r - d) };
          }
        }
      }
    }
    return null;
  }

  function aabbPush(x, y, rx, ry, rw, rh) {
    const l = x - rx, r = rx + rw - x, t = y - ry, b = ry + rh - y;
    const m = Math.min(l, r, t, b);
    if (m === l) return { x: -l, y: 0 };
    if (m === r) return { x: r, y: 0 };
    if (m === t) return { x: 0, y: -t };
    return { x: 0, y: b };
  }

  function pointPushBoat(x, y) {
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (boatBlockedTile(tx, ty)) return aabbPush(x, y, tx * T, ty * T, T, T);
    return null;
  }

  function blocksShot(px, py) {
    const tx = Math.floor(px / T), ty = Math.floor(py / T);
    if (get(tx, ty) === BUILDING) return true;
    const list = solidGrid.get(idx(tx, ty));
    if (list) {
      for (const sp of list) {
        if (sp.shape === "rect" && sp.w >= 20 &&
            px >= sp.x && px < sp.x + sp.w && py >= sp.y && py < sp.y + sp.h) return true;
      }
    }
    return false;
  }

  function lineOfSight(x0, y0, x1, y1) {
    const d = U.dist(x0, y0, x1, y1);
    const steps = Math.ceil(d / 20);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (blocksShot(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }

  /* =========================================================
     NAVIGATION
     ========================================================= */

  function laneMaskAt(tx, ty) { return inB(tx, ty) ? lane[idx(tx, ty)] : 0; }
  function isRoad(tx, ty) { return get(tx, ty) === ROAD; }

  const _came = new Int32Array(MW * MH);
  const _q = U.makeQueue(MW * MH);

  function nearestRoadTile(px, py, maxR) {
    const tx = Math.floor(px / T), ty = Math.floor(py / T);
    maxR = maxR || 8;
    for (let r = 0; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (isRoad(tx + dx, ty + dy)) return idx(tx + dx, ty + dy);
        }
    }
    return -1;
  }

  function findWalkPath(x0, y0, x1, y1, maxR) {
    maxR = maxR || 60;
    const sx = U.clamp(Math.floor(x0 / T), 0, MW - 1), sy = U.clamp(Math.floor(y0 / T), 0, MH - 1);
    const ex = U.clamp(Math.floor(x1 / T), 0, MW - 1), ey = U.clamp(Math.floor(y1 / T), 0, MH - 1);
    if (Math.abs(ex - sx) > maxR || Math.abs(ey - sy) > maxR) return null;
    const s = idx(sx, sy), e = idx(ex, ey);
    if (isSolidTile(sx, sy) || isSolidTile(ex, ey)) return null;
    if (s === e) return null;
    _came.fill(-1);
    _q.reset();
    _q.push(s);
    _came[s] = s;
    let found = false;
    while (_q.length) {
      const cur = _q.shift();
      if (cur === e) { found = true; break; }
      const cx = cur % MW, cy = (cur / MW) | 0;
      if (Math.abs(cx - sx) > maxR || Math.abs(cy - sy) > maxR) continue;
      for (const d of DIRS) {
        const nx = cx + d.dx, ny = cy + d.dy;
        if (!inB(nx, ny)) continue;
        const ni = idx(nx, ny);
        if (_came[ni] !== -1 || isSolidTile(nx, ny)) continue;
        _came[ni] = cur;
        _q.push(ni);
      }
    }
    if (!found) return null;
    const path = [];
    let cur = e;
    while (cur !== s) {
      path.push({ x: (cur % MW + 0.5) * T, y: ((cur / MW | 0) + 0.5) * T });
      cur = _came[cur];
    }
    path.reverse();
    const out = [];
    for (let i = 0; i < path.length; i++) {
      if (i % 2 === 0 || i === path.length - 1) out.push(path[i]);
    }
    return out;
  }

  function findRoadPath(x0, y0, x1, y1) {
    const s = nearestRoadTile(x0, y0), e = nearestRoadTile(x1, y1);
    if (s < 0 || e < 0) return null;
    if (s === e) return [{ x: (s % MW + 0.5) * T, y: ((s / MW | 0) + 0.5) * T }];
    _came.fill(-1);
    _q.reset();
    _q.push(s);
    _came[s] = s;
    let found = false;
    while (_q.length) {
      const cur = _q.shift();
      if (cur === e) { found = true; break; }
      const cx = cur % MW, cy = (cur / MW) | 0;
      for (const d of DIRS) {
        const nx = cx + d.dx, ny = cy + d.dy;
        if (!inB(nx, ny)) continue;
        const ni = idx(nx, ny);
        if (_came[ni] !== -1 || tiles[ni] !== ROAD) continue;
        _came[ni] = cur;
        _q.push(ni);
      }
    }
    if (!found) return null;
    const path = [];
    let cur = e;
    while (cur !== s) {
      path.push({ x: (cur % MW + 0.5) * T, y: ((cur / MW | 0) + 0.5) * T });
      cur = _came[cur];
    }
    path.push({ x: (s % MW + 0.5) * T, y: ((s / MW | 0) + 0.5) * T });
    path.reverse();
    return path;
  }

  /* =========================================================
     MINIMAP
     ========================================================= */

  let minimapCanvas = null;
  const MM_PPT = 4; // larger map → smaller pixel per tile to keep minimap manageable

  function buildMinimap() {
    minimapCanvas = document.createElement("canvas");
    minimapCanvas.width = MW * MM_PPT; minimapCanvas.height = MH * MM_PPT;
    const ctx = minimapCanvas.getContext("2d");
    const cols = {
      [WATER]: "#0d3a41", [GRASS]: "#4f7a3a", [SIDEWALK]: "#8f8775",
      [ROAD]: "#454a56", [PLAZA]: "#9a8b6d", [DOCK]: "#6a7073",
      [PATH]: "#9a8352", [BUILDING]: "#2c2637", [SAND]: "#c9ad74"
    };
    for (let y = 0; y < MH; y++)
      for (let x = 0; x < MW; x++) {
        ctx.fillStyle = cols[tiles[idx(x, y)]];
        ctx.fillRect(x * MM_PPT, y * MM_PPT, MM_PPT, MM_PPT);
      }
  }

  /* ---------- spawns runtime ---------- */

  function randomWalkable(rng, cx, cy, minD, maxD, kinds) {
    for (let tries = 0; tries < 12; tries++) {
      const a = rng() * Math.PI * 2;
      const d = minD + rng() * (maxD - minD);
      const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d;
      const t = get(Math.floor(px / T), Math.floor(py / T));
      if (kinds.includes(t)) return { x: px, y: py };
    }
    return null;
  }

  function randomSidewalk(rng, cx, cy, minD, maxD) {
    return randomWalkable(rng, cx, cy, minD, maxD, [SIDEWALK, PLAZA, PATH, SAND]);
  }

  function randomLaneTile(rng, cx, cy, minD, maxD) {
    for (let tries = 0; tries < 14; tries++) {
      const a = rng() * Math.PI * 2;
      const d = minD + rng() * (maxD - minD);
      const tx = Math.floor((cx + Math.cos(a) * d) / T);
      const ty = Math.floor((cy + Math.sin(a) * d) / T);
      if (!inB(tx, ty)) continue;
      const m = lane[idx(tx, ty)];
      if (m && !bridgeF[idx(tx, ty)]) {
        if (m === LN || m === LS || m === LE || m === LW) return { tx, ty, mask: m };
      }
    }
    return null;
  }

  /* =========================================================
     EXPORTS
     ========================================================= */

  G.Map = {
    T, MW, MH, WPX, HPX, MINIMAP_PPT: MM_PPT,
    WATER, GRASS, SIDEWALK, ROAD, PLAZA, DOCK, PATH, BUILDING, SAND,
    LN, LS, LE, LW, DIRS,
    generate,
    get, laneMaskAt, isRoad, isSolidTile, isSolidAt, isWalkable,
    isBridge: (tx, ty) => inB(tx, ty) && bridgeF[idx(tx, ty)] === 1,
    collideCircle, blocksShot, lineOfSight, pointPush,
    collideWalker: (e, r) => collideCircle(e, r, solidForWalker),
    collideSwimmer: (e, r) => collideCircle(e, r, solidForSwimmer),
    pointPushBoat, isWaterAt, isLowShoreAt, isUnderBridge,
    nearestRoadTile, findRoadPath, findWalkPath,
    drawGround, drawStructures, drawWaterOverlay,
    districtAt,
    get minimap() { return minimapCanvas; },
    POI, parkedSpawns, pickupSpawns, buildings, benches,
    boatSpawns, boatRoutes, ladders, beachSeats,
    randomSidewalk, randomLaneTile, randomWalkable
  };

})(window.G);
