/* ============================================================
   JADE HARBOR — map.js
   Génération déterministe de l'île : réseau routier avec sens
   de circulation, canal + ponts, 7 quartiers, bâtiments 2.5D,
   mobilier urbain, collisions, minimap et GPS (BFS).
   ============================================================ */
"use strict";
(function (G) {

  const U = G.U, S = G.Sprites;

  const T = 48;          // taille d'une tuile en px
  const MW = 128, MH = 128;
  const WPX = MW * T, HPX = MH * T;

  // Types de tuiles
  const WATER = 0, GRASS = 1, SIDEWALK = 2, ROAD = 3, PLAZA = 4,
        DOCK = 5, PATH = 6, BUILDING = 7;

  // Bits de circulation (laneMask)
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

  const buildings = [];   // { x,y,w,h (px), height, wall, roof, ... }
  const structures = [];  // tout ce qui se dessine avec élévation (tri par distance)
  const flatProps = [];   // props plats dessinés avec les entités (bancs, bouches…)
  const benches = [];     // bancs où les piétons peuvent s'asseoir
  const solidProps = [];  // collisions { shape:'circle'|'rect', ... }
  const solidGrid = new Map(); // tile idx -> [solidProps]
  const parkedSpawns = [];
  const pickupSpawns = [];
  const boats = [];

  const vxs = [8, 22, 36, 50, 64, 78, 92, 106, 118];
  const hys = [8, 22, 36, 50, 64, 78, 96, 108, 118];

  // Segments routiers { v:bool, at, from, to }
  const segs = [];

  const DISTRICTS = [
    { key: "downtown", name: "Hauteurs Meridian",   x0: 10, y0: 10, x1: 49,  y1: 49 },
    { key: "resid",    name: "Collines de Papier",  x0: 50, y0: 10, x1: 117, y1: 49 },
    { key: "market",   name: "Bazar de l'Ouest",    x0: 10, y0: 50, x1: 49,  y1: 79 },
    { key: "lotus",    name: "Quartier du Lotus",   x0: 50, y0: 50, x1: 91,  y1: 79 },
    { key: "park",     name: "Jardin des Brumes",   x0: 92, y0: 50, x1: 117, y1: 79 },
    { key: "canal",    name: "Canal des Lanternes", x0: 5,  y0: 80, x1: 122, y1: 95 },
    { key: "docks",    name: "Docks de Fer",        x0: 5,  y0: 96, x1: 122, y1: 119 },
    { key: "piers",    name: "Jetée du Départ",     x0: 5,  y0: 120, x1: 122, y1: 127 }
  ];

  // Points d'intérêt (px)
  const POI = {};

  // Zones réservées (tuiles) pour les bâtiments spéciaux
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
    for (const d of DISTRICTS) {
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
    genRoads();
    genSidewalks();
    reserveSpecials();
    genBlocks(rng);
    genCanalZone(rng);
    genDocksGround(rng);
    genPark(rng);
    genSpecialBuildings(rng);
    genStreetProps(rng);
    genParkedCars(rng);
    genPickups();
    buildMinimap();

    // tri de rendu : on garde structures tel quel, tri par frame
  }

  function genTerrain(rng) {
    tiles.fill(WATER);
    for (let y = 5; y <= 122; y++) {
      for (let x = 5; x <= 122; x++) {
        // coins adoucis en diagonale
        const c = 9;
        if ((x - 5) + (y - 5) < c) continue;
        if ((122 - x) + (y - 5) < c) continue;
        if ((x - 5) + (122 - y) < c) continue;
        if ((122 - x) + (122 - y) < c) continue;
        set(x, y, GRASS);
      }
    }
    // canal
    for (let x = 5; x <= 122; x++) {
      if (get(x, 84) !== WATER) set(x, 84, DOCK);
      for (let y = 85; y <= 88; y++) if (get(x, y) !== WATER) set(x, y, WATER);
      if (get(x, 89) !== WATER) set(x, 89, DOCK);
    }
    // parvis sud (apron des docks)
    for (let y = 120; y <= 122; y++)
      for (let x = 8; x <= 119; x++)
        if (get(x, y) === GRASS) set(x, y, DOCK);
    // jetées sur l'eau
    for (const px of [[20, 22], [58, 61], [100, 102]]) {
      for (let y = 121; y <= 126; y++)
        for (let x = px[0]; x <= px[1]; x++)
          set(x, y, DOCK);
    }
  }

  function addSeg(v, at, from, to) { segs.push({ v, at, from, to }); }

  function genRoads() {
    // verticales
    for (const x of vxs) {
      if (x === 22 || x === 50 || x === 78) { addSeg(true, x, 8, 79); addSeg(true, x, 96, 119); }
      else if (x === 106) { addSeg(true, x, 8, 49); addSeg(true, x, 96, 119); }
      else addSeg(true, x, 8, 119); // 8, 36, 64, 92, 118 : traversent le canal (ponts)
    }
    // horizontales
    for (const y of hys) {
      if (y === 64) addSeg(false, y, 8, 91);
      else addSeg(false, y, 8, 119);
    }

    for (const s of segs) {
      if (s.v) {
        for (let y = s.from; y <= s.to + 1; y++) {
          paintRoad(s.at, y, LS);
          paintRoad(s.at + 1, y, LN);
        }
      } else {
        for (let x = s.from; x <= s.to + 1; x++) {
          paintRoad(x, s.at, LW);
          paintRoad(x, s.at + 1, LE);
        }
      }
    }
  }

  function paintRoad(tx, ty, bit) {
    if (!inB(tx, ty)) return;
    const i = idx(tx, ty);
    if (ty >= 84 && ty <= 89) bridgeF[i] = 1; // au-dessus du canal
    tiles[i] = ROAD;
    lane[i] |= bit;
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

  function reserveSpecials() {
    reserved.push(
      { x: 65, y: 55, w: 8, h: 6 },   // salon de thé
      { x: 25, y: 65, w: 8, h: 6 },   // garage
      { x: 11, y: 37, w: 8, h: 6 },   // commissariat
      { x: 95, y: 23, w: 8, h: 7 },   // hôpital
      { x: 39, y: 99, w: 11, h: 7 }   // planque des Requins
    );
  }

  /* ---------- remplissage des blocs par quartier ---------- */

  function genBlocks(rng) {
    for (let i = 0; i < vxs.length - 1; i++) {
      for (let j = 0; j < hys.length - 1; j++) {
        const x0 = vxs[i] + 3, x1 = vxs[i + 1] - 2;
        const y0 = hys[j] + 3, y1 = hys[j + 1] - 2;
        if (x1 < x0 || y1 < y0) continue;
        if (y0 <= 95 && y1 >= 80) continue; // bande du canal : custom
        const cx = ((x0 + x1) / 2 + 0.5) * T, cy = ((y0 + y1) / 2 + 0.5) * T;
        const d = districtAt(cx, cy);
        if (!d) continue;
        const block = { x0, y0, x1, y1, rng };
        switch (d.key) {
          case "downtown":
            if (block.x0 <= 40 && 40 <= block.x1 && block.y0 <= 28 && 28 <= block.y1) plazaBlock(block);
            else downtownBlock(block);
            break;
          case "resid": residentialBlock(block); break;
          case "market": marketBlock(block); break;
          case "lotus":
            if (block.x0 <= 58 && 58 <= block.x1 && block.y0 <= 70 && 70 <= block.y1) lotusMarketBlock(block);
            else lotusBlock(block);
            break;
          case "docks": docksBlock(block); break;
          case "park": break; // custom
        }
      }
    }
  }

  function addBuilding(b) {
    // marque les tuiles pleines
    for (let ty = b.ty; ty < b.ty + b.th; ty++)
      for (let tx = b.tx; tx < b.tx + b.tw; tx++)
        set(tx, ty, BUILDING);
    b.x = b.tx * T; b.y = b.ty * T; b.w = b.tw * T; b.h = b.th * T;
    b.cx = b.x + b.w / 2; b.cy = b.y + b.h / 2;
    buildings.push(b);
    structures.push({
      x: b.cx, y: b.cy, r: Math.max(b.w, b.h) / 2 + b.height * 0.6,
      draw: (ctx, cx, cy) => drawBuilding(ctx, b, cx, cy)
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

  const SIGNS_LOTUS = ["NOUILLES", "THÉ 茶", "BAO 包", "DIM SUM", "HERBES", "K-TV",
                       "PHO 88", "JADE", "WOK", "TATOU", "酒 BAR", "PERLES"];
  const SIGN_COLORS = ["#2ee6a8", "#ff4f9a", "#ffc857", "#7ad7ff"];

  function downtownBlock(b) {
    const rng = b.rng;
    const colors = ["#5d6d7e", "#46586a", "#3f4f63", "#6a7a8c", "#54626f", "#4a5a70"];
    // 2 à 3 tours par bloc
    const n = U.rint(rng, 2, 3);
    for (let k = 0; k < n; k++) {
      const tw = U.rint(rng, 4, 6), th = U.rint(rng, 4, 6);
      const tx = U.rint(rng, b.x0, Math.max(b.x0, b.x1 - tw + 1));
      const ty = U.rint(rng, b.y0, Math.max(b.y0, b.y1 - th + 1));
      if (!canPlace(tx, ty, tw, th)) continue;
      const wall = U.pick(rng, colors);
      addBuilding({
        tx, ty, tw, th,
        height: U.rint(rng, 95, 150),
        wall, roof: U.shade(wall, -0.28),
        windows: true, floors: U.rint(rng, 6, 10),
        helipad: rng() < 0.3
      });
    }
    // le reste du bloc devient parvis
    for (let y = b.y0 - 1; y <= b.y1 + 1; y++)
      for (let x = b.x0 - 1; x <= b.x1 + 1; x++)
        if (get(x, y) === GRASS) set(x, y, PLAZA);
    scatterProps(b, rng, ["planter", "trash"], 3);
  }

  function plazaBlock(b) {
    const rng = b.rng;
    for (let y = b.y0 - 1; y <= b.y1 + 1; y++)
      for (let x = b.x0 - 1; x <= b.x1 + 1; x++)
        if (get(x, y) === GRASS) set(x, y, PLAZA);
    // statue centrale = petit socle extrudé
    const cx = ((b.x0 + b.x1) / 2 + 0.5) * T, cy = ((b.y0 + b.y1) / 2 + 0.5) * T;
    structures.push({
      x: cx, y: cy, r: 60,
      draw: (ctx, camX, camY) => {
        S.drawBox(ctx, cx - 22, cy - 22, 44, 44, 14, camX, camY, "#8a8f98", "#a5abb5");
        S.drawBox(ctx, cx - 9, cy - 9, 18, 18, 52, camX, camY, "#3f8f5f", "#5cb377");
      }
    });
    addSolid({ shape: "rect", x: cx - 24, y: cy - 24, w: 48, h: 48 });
    POI.plaza = { x: cx, y: cy + 90 };
    const rng2 = rng;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * U.TAU;
      addTree("tree", cx + Math.cos(a) * 150, cy + Math.sin(a) * 150, rng2);
    }
    scatterProps(b, rng, ["bench", "planter", "trash"], 6);
  }

  function residentialBlock(b) {
    const rng = b.rng;
    const colors = ["#b96a4b", "#a3593d", "#c9825e", "#8f5a3a", "#b5836a", "#9c6f50", "#c98a6a"];
    // rangées de maisons en haut et en bas du bloc
    for (const edge of [0, 1]) {
      let tx = b.x0;
      const ty = edge === 0 ? b.y0 : b.y1 - 2;
      while (tx + 2 <= b.x1) {
        const tw = U.rint(rng, 2, 4);
        if (tx + tw - 1 > b.x1) break;
        if (rng() < 0.82 && canPlace(tx, ty, tw, 3)) {
          const wall = U.pick(rng, colors);
          addBuilding({
            tx, ty, tw, th: 3,
            height: U.rint(rng, 36, 54),
            wall, roof: U.shade(wall, -0.3),
            windows: false, floors: 2
          });
        }
        tx += tw + (rng() < 0.35 ? 1 : 0);
      }
    }
    // jardins au centre
    for (let k = 0; k < 3; k++) {
      const x = U.rrange(rng, b.x0 + 1, b.x1 - 1) * T;
      const y = U.rrange(rng, b.y0 + 3.5, b.y1 - 2.5) * T;
      if (get(Math.floor(x / T), Math.floor(y / T)) === GRASS) addTree("tree", x, y, rng);
    }
  }

  function marketBlock(b) {
    const rng = b.rng;
    const colors = ["#7f8c8d", "#95a5a6", "#8c7a5f", "#6d7a8c", "#a08c6a"];
    const signs = ["OUTILS", "MOTEL", "BANQUE", "LAVERIE", "PIÈCES", "TABAC"];
    const n = U.rint(rng, 3, 4);
    for (let k = 0; k < n; k++) {
      const tw = U.rint(rng, 3, 5), th = U.rint(rng, 3, 4);
      const tx = U.rint(rng, b.x0, Math.max(b.x0, b.x1 - tw + 1));
      const ty = U.rint(rng, b.y0, Math.max(b.y0, b.y1 - th + 1));
      if (!canPlace(tx, ty, tw, th)) continue;
      const wall = U.pick(rng, colors);
      addBuilding({
        tx, ty, tw, th,
        height: U.rint(rng, 44, 66),
        wall, roof: U.shade(wall, -0.28),
        windows: rng() < 0.4, floors: U.rint(rng, 2, 4),
        sign: rng() < 0.4 ? { text: U.pick(rng, signs), color: U.pick(rng, SIGN_COLORS) } : null
      });
    }
  }

  function lotusBlock(b) {
    const rng = b.rng;
    const colors = ["#c0392b", "#d35400", "#c9a227", "#1e8449", "#19b3c4", "#a93226", "#b9770e"];
    // shophouses en périmètre
    const edges = [
      { x: b.x0, y: b.y0, dx: 1, dy: 0, len: b.x1 - b.x0 + 1, d: 3 },
      { x: b.x0, y: b.y1 - 2, dx: 1, dy: 0, len: b.x1 - b.x0 + 1, d: 3 }
    ];
    for (const e of edges) {
      let o = 0;
      while (o + 2 <= e.len) {
        const tw = U.rint(rng, 2, 3);
        if (o + tw > e.len) break;
        const tx = e.x + e.dx * o, ty = e.y;
        if (rng() < 0.86 && canPlace(tx, ty, tw, 3)) {
          const wall = U.pick(rng, colors);
          addBuilding({
            tx, ty, tw, th: 3,
            height: U.rint(rng, 36, 52),
            wall, roof: rng() < 0.5 ? "#7a1f14" : U.shade(wall, -0.3),
            windows: false, floors: U.rint(rng, 2, 3),
            sign: rng() < 0.55 ? { text: U.pick(rng, SIGNS_LOTUS), color: U.pick(rng, SIGN_COLORS) } : null,
            awning: rng() < 0.6 ? U.pick(rng, ["#c0392b", "#1e8449", "#ffc857"]) : null
          });
        }
        o += tw + (rng() < 0.3 ? 1 : 0);
      }
    }
    // cour intérieure
    for (let y = b.y0 + 3; y <= b.y1 - 3; y++)
      for (let x = b.x0; x <= b.x1; x++)
        if (get(x, y) === GRASS) set(x, y, PLAZA);
    // lanternes dans la cour
    for (let k = 0; k < 2; k++) {
      const x = U.rrange(rng, b.x0 + 1, b.x1 - 1) * T;
      const y = U.rrange(rng, b.y0 + 3.5, b.y1 - 2.5) * T;
      addLantern(x, y);
    }
  }

  function lotusMarketBlock(b) {
    // le grand marché couvert du Lotus : place + étals
    const rng = b.rng;
    for (let y = b.y0 - 1; y <= b.y1 + 1; y++)
      for (let x = b.x0 - 1; x <= b.x1 + 1; x++)
        if (get(x, y) === GRASS) set(x, y, PLAZA);
    const c1 = ["#c0392b", "#1e8449", "#b9770e", "#19b3c4"];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const x = (b.x0 + 1.5 + col * 3.2) * T, y = (b.y0 + 1.5 + row * 3.2) * T;
        const stall = { type: "stall", x, y, c1: U.pick(rng, c1), c2: "#f5f0e6" };
        structures.push({ x, y, r: 40, draw: (ctx, cx, cy) => S.PROPS.stall(ctx, stall, cx, cy) });
        addSolid({ shape: "rect", x: x - 15, y: y - 10, w: 30, h: 20 });
      }
    }
    for (let k = 0; k < 4; k++)
      addLantern((b.x0 + 0.5 + k * 3) * T, (b.y1 - 0.2) * T);
    POI.market = { x: (b.x0 + 5) * T, y: (b.y0 + 5) * T };
    scatterProps(b, rng, ["trash", "planter"], 3);
  }

  function docksBlock(b) {
    const rng = b.rng;
    // sol béton
    for (let y = b.y0 - 1; y <= b.y1 + 1; y++)
      for (let x = b.x0 - 1; x <= b.x1 + 1; x++)
        if (get(x, y) === GRASS) set(x, y, DOCK);
    const colors = ["#8c6d3f", "#6d7a8c", "#7a5230", "#5f6d5f", "#8c5a4a"];
    const n = U.rint(rng, 1, 2);
    for (let k = 0; k < n; k++) {
      const tw = U.rint(rng, 5, 8), th = U.rint(rng, 3, 4);
      const tx = U.rint(rng, b.x0, Math.max(b.x0, b.x1 - tw + 1));
      const ty = U.rint(rng, b.y0, Math.max(b.y0, b.y1 - th + 1));
      if (!canPlace(tx, ty, tw, th)) continue;
      const wall = U.pick(rng, colors);
      addBuilding({
        tx, ty, tw, th,
        height: U.rint(rng, 42, 58),
        wall, roof: U.shade(wall, -0.22),
        windows: false, floors: 1, warehouse: true
      });
    }
    // conteneurs épars
    for (let k = 0; k < U.rint(rng, 1, 3); k++) {
      const x = U.rrange(rng, b.x0 + 1.5, b.x1 - 1.5) * T;
      const y = U.rrange(rng, b.y0 + 1.5, b.y1 - 1.5) * T;
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (get(tx, ty) === DOCK && !isReserved(tx - 1, ty - 1, 3, 2)) addContainer(x, y, rng() < 0.5 ? 0 : Math.PI / 2, rng);
    }
  }

  /* ---------- zones custom ---------- */

  function genCanalZone(rng) {
    // promenade nord (80..83) : dalles + arbres + bancs
    for (let y = 80; y <= 83; y++)
      for (let x = 6; x <= 121; x++)
        if (get(x, y) === GRASS) set(x, y, y === 83 ? DOCK : PLAZA);
    for (let x = 12; x <= 116; x += 7) {
      if (get(x, 81) === PLAZA) {
        addTree(x % 14 === 12 ? "cherry" : "tree", (x + 0.5) * T, 81.5 * T, rng);
        if (rng() < 0.5) {
          const b = { type: "bench", x: (x + 3.5) * T, y: 82.2 * T, a: 0 };
          flatProps.push(b); benches.push(b);
        }
      }
    }
    // berge sud (90..95) : parc à conteneurs
    for (let y = 90; y <= 95; y++)
      for (let x = 6; x <= 121; x++)
        if (get(x, y) === GRASS) set(x, y, DOCK);
    const cxs = [14, 28, 44, 56, 70, 84, 98, 112];
    for (const cx of cxs) {
      if (Math.abs(cx - 36) < 4 || Math.abs(cx - 64) < 4 || Math.abs(cx - 92) < 4) continue; // ponts
      const n = U.rint(rng, 1, 3);
      for (let k = 0; k < n; k++) {
        const x = (cx + U.rrange(rng, -1, 1)) * T, y = (91.5 + k * 1.6) * T;
        if (get(Math.floor(x / T), Math.floor(y / T)) === DOCK) addContainer(x, y, 0, rng);
      }
    }
    // grues le long du quai sud
    for (const gx of [20, 76, 104]) {
      const x = gx * T, y = 90.4 * T;
      structures.push({ x, y, r: 140, draw: (ctx, cx, cy) => S.PROPS.crane(ctx, { x, y }, cx, cy) });
      addSolid({ shape: "rect", x: x - 10, y: y - 7, w: 20, h: 14 });
    }
    // bateaux dans le canal
    boats.push({ type: "boat", x: 30 * T, y: 86.9 * T, a: 0, c: "#4a6d8c" });
    boats.push({ type: "boat", x: 74 * T, y: 86.2 * T, a: Math.PI, c: "#8c4a5a" });
    boats.push({ type: "boat", x: 111 * T, y: 86.8 * T, a: 0.1, c: "#5f8c4a" });
  }

  function genDocksGround(rng) {
    // jetées sud : caisses, bateaux, grues
    boats.push({ type: "boat", x: 63.5 * T, y: 124.5 * T, a: -0.15, c: "#3d6d99" }); // le ferry de Jin
    boats.push({ type: "boat", x: 17 * T, y: 124 * T, a: 0.3, c: "#8c6d3f" });
    for (const gx of [24, 98]) {
      const x = gx * T, y = 120.8 * T;
      structures.push({ x, y, r: 140, draw: (ctx, cx, cy) => S.PROPS.crane(ctx, { x, y }, cx, cy) });
      addSolid({ shape: "rect", x: x - 10, y: y - 7, w: 20, h: 14 });
    }
    for (let k = 0; k < 14; k++) {
      const x = U.rrange(rng, 10, 118) * T, y = U.rrange(rng, 120.4, 122.2) * T;
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (get(tx, ty) === DOCK && rng() < 0.8) addCrate(x, y, rng);
    }
    POI.debarcadere = { x: 60 * T, y: 122.3 * T }; // marqueur de mission 1
    POI.spawn = { x: 60 * T, y: 125.2 * T };       // Jin débarque au bout de la jetée
  }

  function genPark(rng) {
    // limites intérieures du parc
    const x0 = 95, x1 = 116, y0 = 53, y1 = 76;
    // étang
    for (let y = 60; y <= 70; y++)
      for (let x = 100; x <= 112; x++) {
        const dx = (x - 106) / 6.5, dy = (y - 65) / 5.5;
        if (dx * dx + dy * dy < 1) set(x, y, WATER);
      }
    // allées
    for (let x = x0; x <= x1; x++) { if (get(x, 57) === GRASS) set(x, 57, PATH); if (get(x, 73) === GRASS) set(x, 73, PATH); }
    for (let y = y0; y <= y1; y++) {
      if (get(98, y) === GRASS) set(98, y, PATH);
      if (get(114, y) === GRASS) set(114, y, PATH);
    }
    // ponton de bois traversant l'étang
    for (let y = 60; y <= 70; y++) set(106, y, PATH);
    // pagode sur la rive nord de l'étang (empreinte carrée 3×3 tuiles)
    const px = 106.5 * T, py = 58.5 * T;
    structures.push({
      x: px, y: py, r: 130,
      draw: (ctx, cx, cy) => {
        S.drawBox(ctx, px - 72, py - 72, 144, 144, 30, cx, cy, "#8a3324", "#7a1f14");
        S.drawBox(ctx, px - 52, py - 52, 104, 104, 58, cx, cy, "#a4442f", "#8f2717");
        S.drawBox(ctx, px - 32, py - 32, 64, 64, 86, cx, cy, "#b85c3e", "#a43214");
        S.drawBox(ctx, px - 14, py - 14, 28, 28, 108, cx, cy, "#ffc857", "#e0a52f");
      }
    });
    for (let ty = 57; ty <= 59; ty++)
      for (let tx = 105; tx <= 107; tx++) set(tx, ty, BUILDING);
    POI.pagoda = { x: px, y: py + 92 };
    // cerisiers + arbres + bancs + lanternes
    for (let k = 0; k < 26; k++) {
      const x = U.rrange(rng, x0, x1) * T, y = U.rrange(rng, y0, y1) * T;
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (get(tx, ty) !== GRASS) continue;
      addTree(rng() < 0.45 ? "cherry" : "tree", x, y, rng);
    }
    for (const [bx, by] of [[99, 58.6], [110, 73.6], [114.8, 65]]) {
      const b = { type: "bench", x: bx * T, y: by * T, a: 0 };
      flatProps.push(b); benches.push(b);
    }
    for (const [lx, ly] of [[98.5, 57.5], [106.5, 71.8], [114.5, 57.5]])
      addLantern(lx * T, ly * T);
  }

  function genSpecialBuildings(rng) {
    // ----- Salon de thé du Lotus (QG de Wu) -----
    let b = addBuilding({
      tx: 66, ty: 56, tw: 6, th: 4,
      height: 46, wall: "#8a3324", roof: "#7a1f14",
      windows: false, floors: 2, teahouse: true,
      sign: { text: "SALON DE THÉ 茶", color: "#ffc857" }
    });
    POI.teahouse = { x: b.cx, y: (60.9) * T };
    addLantern(65.6 * T, 60.4 * T);
    addLantern(72.4 * T, 60.4 * T);

    // ----- Garage Long (ouest) -----
    b = addBuilding({
      tx: 26, ty: 66, tw: 6, th: 4,
      height: 52, wall: "#6d7a8c", roof: "#54626f",
      windows: false, floors: 2, garage: true,
      sign: { text: "GARAGE LONG", color: "#2ee6a8" }
    });
    POI.garage = { x: b.cx, y: 70.9 * T };

    // ----- Commissariat -----
    b = addBuilding({
      tx: 12, ty: 38, tw: 6, th: 4,
      height: 74, wall: "#2b4c7e", roof: "#22304a",
      windows: true, floors: 4,
      sign: { text: "POLICE 警察", color: "#7ad7ff" }
    });
    POI.police = { x: b.cx, y: 42.9 * T };

    // ----- Hôpital -----
    b = addBuilding({
      tx: 96, ty: 24, tw: 6, th: 5,
      height: 80, wall: "#e8e4d8", roof: "#cfc6b3",
      windows: true, floors: 5, hospital: true,
      sign: { text: "HÔPITAL +", color: "#ff5340" }
    });
    POI.hospital = { x: b.cx, y: 29.9 * T };

    // ----- Planque des Requins du Port (docks) -----
    b = addBuilding({
      tx: 40, ty: 100, tw: 9, th: 5,
      height: 56, wall: "#5f4a3f", roof: "#4a3a30",
      windows: false, floors: 1, warehouse: true, hideout: true,
      sign: { text: "PÊCHERIE WANG", color: "#19b3c4" }
    });
    POI.hideout = { x: b.cx, y: 99.2 * T };
    // conteneurs formant une cour devant la planque
    addContainer(38.5 * T, 98.4 * T, 0, rng);
    addContainer(52.8 * T, 106.6 * T, Math.PI / 2, rng);

    // ----- Portes paifang du Quartier du Lotus -----
    addGate(65 * T, 52.6 * T);   // entrée nord (rue v64)
    addGate(65 * T, 76.4 * T);   // entrée sud
    POI.gateN = { x: 65 * T, y: 52.6 * T };
  }

  function addGate(gx, gy) {
    const w = 92; // enjambe la route (2 voies = 96 px)
    structures.push({
      x: gx, y: gy, r: 110,
      draw: (ctx, camX, camY) => {
        S.drawBox(ctx, gx - w / 2 - 10, gy - 6, 14, 12, 48, camX, camY, "#a43214", "#7a1f14");
        S.drawBox(ctx, gx + w / 2 - 4, gy - 6, 14, 12, 48, camX, camY, "#a43214", "#7a1f14");
        // linteau : quad élevé entre les deux piliers
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
        // toit doré
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

  function scatterProps(b, rng, kinds, n) {
    for (let k = 0; k < n; k++) {
      const x = U.rrange(rng, b.x0, b.x1 + 1) * T;
      const y = U.rrange(rng, b.y0, b.y1 + 1) * T;
      const t = get(Math.floor(x / T), Math.floor(y / T));
      if (t !== PLAZA && t !== SIDEWALK && t !== GRASS && t !== DOCK) continue;
      const kind = U.pick(rng, kinds);
      if (kind === "bench") {
        const b = { type: "bench", x, y, a: rng() < 0.5 ? 0 : Math.PI / 2 };
        flatProps.push(b);
        benches.push(b);
      } else {
        flatProps.push({ type: kind, x, y });
        addSolid({ shape: "circle", x, y, r: kind === "planter" ? 8 : 5 });
      }
    }
  }

  function genStreetProps(rng) {
    // lampadaires + bouches + poubelles le long des segments
    for (const s of segs) {
      const step = 6;
      for (let t = s.from + 3; t <= s.to - 1; t += step) {
        if (s.v) {
          const side = ((t / step) | 0) % 2 === 0 ? -1 : 1;
          const x = side < 0 ? (s.at - 0.35) * T : (s.at + 2.35) * T;
          const y = (t + 0.5) * T;
          placeLamp(x, y, rng);
        } else {
          const side = ((t / step) | 0) % 2 === 0 ? -1 : 1;
          const y = side < 0 ? (s.at - 0.35) * T : (s.at + 2.35) * T;
          const x = (t + 0.5) * T;
          placeLamp(x, y, rng);
        }
      }
    }
    // arbres de rue en résidentiel
    for (let k = 0; k < 40; k++) {
      const x = U.rint(rng, 52, 117), y = U.rint(rng, 11, 48);
      if (get(x, y) === GRASS && rng() < 0.5) addTree("tree", (x + 0.5) * T, (y + 0.5) * T, rng);
    }
  }

  function placeLamp(x, y, rng) {
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    const t = get(tx, ty);
    if (t !== SIDEWALK && t !== PLAZA && t !== DOCK) return;
    if (rng() < 0.12) {
      flatProps.push({ type: "hydrant", x, y });
      addSolid({ shape: "circle", x, y, r: 4 });
    } else if (rng() < 0.1) {
      flatProps.push({ type: "trash", x, y });
      addSolid({ shape: "circle", x, y, r: 5 });
    } else {
      structures.push({ x, y, r: 46, draw: (ctx, cx, cy) => S.PROPS.lamp(ctx, { x, y }, cx, cy) });
      addSolid({ shape: "circle", x, y, r: 3 });
    }
  }

  function genParkedCars(rng) {
    const types = ["sedan", "sedan", "taxi", "van", "pickup", "sport", "sedan"];
    for (const s of segs) {
      for (let t = s.from + 4; t <= s.to - 3; t += U.rint(rng, 7, 11)) {
        if (rng() < 0.42) continue;
        // pas sur les ponts ni aux intersections
        if (s.v) {
          const ty = t;
          if (bridgeF[idx(s.at, ty)]) continue;
          if (isCross(s.at, ty)) continue;
          parkedSpawns.push({
            x: (s.at + 0.30) * T, y: (ty + 0.5) * T,
            angle: Math.PI / 2, type: U.pick(rng, types),
            color: U.pick(rng, S.CAR_COLORS)
          });
        } else {
          const tx = t;
          if (bridgeF[idx(tx, s.at)]) continue;
          if (isCross(tx, s.at)) continue;
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
    // vrai si à moins de 3 tuiles d'une intersection (masque multi-directions)
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        if (!inB(tx + dx, ty + dy)) continue;
        const m = lane[idx(tx + dx, ty + dy)];
        const hasV = (m & (LN | LS)) !== 0, hasH = (m & (LE | LW)) !== 0;
        if (hasV && hasH) return true;
      }
    return false;
  }

  function genPickups() {
    const P = pickupSpawns;
    // santé (baozi vapeur)
    for (const [x, y] of [[41, 29], [18, 55.5], [58.5, 74.5], [88, 16], [106.5, 74],
                          [30.5, 91.5], [70, 104.5], [12, 104], [116.5, 100.5], [60, 121],
                          [95, 40.5], [13, 13]])
      P.push({ kind: "health", x: x * T, y: y * T });
    // liasses de billets
    for (const [x, y] of [[26.5, 13], [45, 41.5], [70.5, 13.5], [102.5, 33], [116, 13],
                          [13, 70], [33, 74.5], [55, 55], [86, 55.5], [98.5, 76],
                          [16, 81.5], [58, 81.5], [100, 91.5], [26, 110.5], [80, 110.5],
                          [110, 116], [21, 124.5], [101, 124.5]])
      P.push({ kind: "cash", x: x * T, y: y * T, amount: 30 });
    // armes cachées
    P.push({ kind: "bat", x: 111 * T, y: 59 * T });          // pavillon du parc
    P.push({ kind: "pistol", x: 15.5 * T, y: 118 * T });     // coin des docks
    P.push({ kind: "smg", x: 21 * T, y: 125.5 * T });        // bout de jetée ouest
    P.push({ kind: "shotgun", x: 52 * T, y: 106.8 * T });    // derrière la planque
    P.push({ kind: "armor", x: 14.5 * T, y: 41 * T });       // près du commissariat
  }

  /* =========================================================
     RENDU DU SOL (chunks pré-rendus, cache LRU)
     ========================================================= */

  const CHUNK = 16;                 // tuiles par chunk
  const CPX = CHUNK * T;            // 768 px
  const CW = MW / CHUNK;            // 8 × 8 chunks
  const chunkCache = new Map();     // idx -> canvas
  const MAX_CHUNKS = 24;

  const TILE_COLORS = {
    [WATER]: "#16535c", [GRASS]: "#7fae5a", [SIDEWALK]: "#cfc6b3",
    [ROAD]: "#3b3f4a", [PLAZA]: "#d8c9a8", [DOCK]: "#9aa0a3",
    [PATH]: "#d9c08f", [BUILDING]: "#2a2633"
  };

  function chunkCanvas(ci, cj) {
    const key = cj * CW + ci;
    let c = chunkCache.get(key);
    if (c) return c;
    if (chunkCache.size >= MAX_CHUNKS) {
      const first = chunkCache.keys().next().value;
      chunkCache.delete(first);
    }
    c = document.createElement("canvas");
    c.width = CPX; c.height = CPX;
    renderChunk(c.getContext("2d"), ci, cj);
    chunkCache.set(key, c);
    return c;
  }

  function renderChunk(ctx, ci, cj) {
    const ox = ci * CHUNK, oy = cj * CHUNK;
    for (let ty = 0; ty < CHUNK; ty++) {
      for (let tx = 0; tx < CHUNK; tx++) {
        drawTile(ctx, ox + tx, oy + ty, tx * T, ty * T);
      }
    }
    // marquages routiers par-dessus les tuiles
    ctx.save();
    ctx.translate(-ox * T, -oy * T);
    drawRoadMarkings(ctx, ox * T, oy * T, (ox + CHUNK) * T, (oy + CHUNK) * T);
    ctx.restore();
  }

  function drawTile(ctx, gx, gy, px, py) {
    const t = get(gx, gy);
    const h = tileHash(gx, gy);
    ctx.fillStyle = TILE_COLORS[t];
    ctx.fillRect(px, py, T, T);

    switch (t) {
      case WATER: {
        // écume le long des berges (couleur de fond uniforme)
        ctx.strokeStyle = "rgba(232,246,248,0.45)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (get(gx, gy - 1) !== WATER) { ctx.moveTo(px, py + 3); ctx.lineTo(px + T, py + 3); }
        if (get(gx, gy + 1) !== WATER) { ctx.moveTo(px, py + T - 3); ctx.lineTo(px + T, py + T - 3); }
        if (get(gx - 1, gy) !== WATER) { ctx.moveTo(px + 3, py); ctx.lineTo(px + 3, py + T); }
        if (get(gx + 1, gy) !== WATER) { ctx.moveTo(px + T - 3, py); ctx.lineTo(px + T - 3, py + T); }
        ctx.stroke();
        if (h < 0.3) {
          ctx.strokeStyle = "rgba(122,215,255,0.25)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          const wy = py + 10 + h * 90;
          ctx.moveTo(px + 8, wy); ctx.quadraticCurveTo(px + 16, wy - 4, px + 24, wy);
          ctx.quadraticCurveTo(px + 32, wy + 4, px + 40, wy);
          ctx.stroke();
        }
        break;
      }
      case GRASS: {
        ctx.fillStyle = h < 0.5 ? "rgba(110,160,70,0.5)" : "rgba(150,190,100,0.35)";
        const n = 3 + (h * 5) | 0;
        for (let i = 0; i < n; i++) {
          const hx = tileHash(gx * 7 + i, gy * 3 + i);
          ctx.fillRect(px + hx * 42, py + tileHash(gx + i, gy * 11) * 42, 4, 3);
        }
        break;
      }
      case SIDEWALK: {
        ctx.strokeStyle = "rgba(120,110,90,0.35)";
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
        ctx.beginPath();
        ctx.moveTo(px + T / 2, py); ctx.lineTo(px + T / 2, py + T);
        ctx.stroke();
        // bordure côté route
        ctx.strokeStyle = "#8f8775";
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (get(gx + 1, gy) === ROAD) { ctx.moveTo(px + T - 1.5, py); ctx.lineTo(px + T - 1.5, py + T); }
        if (get(gx - 1, gy) === ROAD) { ctx.moveTo(px + 1.5, py); ctx.lineTo(px + 1.5, py + T); }
        if (get(gx, gy + 1) === ROAD) { ctx.moveTo(px, py + T - 1.5); ctx.lineTo(px + T, py + T - 1.5); }
        if (get(gx, gy - 1) === ROAD) { ctx.moveTo(px, py + 1.5); ctx.lineTo(px + T, py + 1.5); }
        ctx.stroke();
        break;
      }
      case ROAD: {
        if (bridgeF[idx(gx, gy)]) {
          ctx.fillStyle = "#4a505c";
          ctx.fillRect(px, py, T, T);
          // rambardes sur les bords extérieurs (voisin = eau)
          ctx.fillStyle = "#20242c";
          if (get(gx - 1, gy) === WATER || get(gx - 1, gy) === DOCK && !bridgeF[idx(gx - 1, gy)])
            ctx.fillRect(px, py, 4, T);
          if (get(gx + 1, gy) === WATER || get(gx + 1, gy) === DOCK && !bridgeF[idx(gx + 1, gy)])
            ctx.fillRect(px + T - 4, py, 4, T);
        } else if (h < 0.06) {
          // plaque d'égout
          ctx.fillStyle = "#2f333d";
          ctx.beginPath(); ctx.arc(px + 24, py + 24, 6, 0, U.TAU); ctx.fill();
          ctx.strokeStyle = "#1c1f26"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(px + 24, py + 24, 6, 0, U.TAU); ctx.stroke();
        } else if (h > 0.94) {
          ctx.fillStyle = "rgba(28,30,38,0.55)"; // tache d'huile
          ctx.beginPath(); ctx.ellipse(px + 20 + h * 8, py + 26, 9, 6, h * 3, 0, U.TAU); ctx.fill();
        }
        break;
      }
      case PLAZA: {
        ctx.strokeStyle = "rgba(140,120,90,0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
        if (((gx + gy) & 1) === 0) {
          ctx.fillStyle = "rgba(190,165,125,0.35)";
          ctx.fillRect(px, py, T, T);
        }
        break;
      }
      case DOCK: {
        ctx.strokeStyle = "rgba(70,75,80,0.5)";
        ctx.lineWidth = 1.5;
        if (gx % 3 === 0) { ctx.beginPath(); ctx.moveTo(px + 0.5, py); ctx.lineTo(px + 0.5, py + T); ctx.stroke(); }
        if (gy % 3 === 0) { ctx.beginPath(); ctx.moveTo(px, py + 0.5); ctx.lineTo(px + T, py + 0.5); ctx.stroke(); }
        if (h > 0.9) {
          ctx.fillStyle = "rgba(60,50,45,0.4)";
          ctx.beginPath(); ctx.ellipse(px + 24, py + 20, 10, 7, h, 0, U.TAU); ctx.fill();
        }
        // bord de quai
        ctx.fillStyle = "#5f6d5f";
        if (get(gx, gy + 1) === WATER) ctx.fillRect(px, py + T - 4, T, 4);
        if (get(gx, gy - 1) === WATER) ctx.fillRect(px, py, T, 4);
        if (get(gx + 1, gy) === WATER) ctx.fillRect(px + T - 4, py, 4, T);
        if (get(gx - 1, gy) === WATER) ctx.fillRect(px, py, 4, T);
        break;
      }
      case PATH: {
        ctx.fillStyle = "rgba(160,130,80,0.3)";
        for (let i = 0; i < 4; i++)
          ctx.fillRect(px + tileHash(gx + i, gy) * 40, py + tileHash(gx, gy + i) * 40, 5, 4);
        break;
      }
      case BUILDING: {
        ctx.fillStyle = "#241f2e";
        ctx.fillRect(px, py, T, T);
        break;
      }
    }

    // occlusion ambiante au pied des bâtiments
    if (t !== BUILDING && t !== WATER) {
      ctx.fillStyle = "rgba(18,14,28,0.16)";
      if (get(gx, gy - 1) === BUILDING) ctx.fillRect(px, py, T, 7);
      if (get(gx, gy + 1) === BUILDING) ctx.fillRect(px, py + T - 7, T, 7);
      if (get(gx - 1, gy) === BUILDING) ctx.fillRect(px, py, 7, T);
      if (get(gx + 1, gy) === BUILDING) ctx.fillRect(px + T - 7, py, 7, T);
    }
  }

  // reflets animés sur l'eau visible (appelé chaque frame, hors cache)
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
        if (h > 0.5) continue; // un reflet sur deux tuiles
        const ph = (time * (10 + h * 16) + h * 480) % (T + 26) - 13;
        ctx.fillRect(tx * T + ph, ty * T + 8 + h * 60, 13 + h * 14, 2.4);
      }
    }
  }

  function drawRoadMarkings(ctx, x0, y0, x1, y1) {
    ctx.strokeStyle = "#c9a227";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([14, 18]);
    for (const s of segs) {
      if (s.v) {
        const x = (s.at + 1) * T;
        if (x < x0 - 50 || x > x1 + 50) continue;
        ctx.beginPath();
        ctx.moveTo(x, Math.max(s.from * T, y0 - 40));
        ctx.lineTo(x, Math.min((s.to + 2) * T, y1 + 40));
        ctx.stroke();
      } else {
        const y = (s.at + 1) * T;
        if (y < y0 - 50 || y > y1 + 50) continue;
        ctx.beginPath();
        ctx.moveTo(Math.max(s.from * T, x0 - 40), y);
        ctx.lineTo(Math.min((s.to + 2) * T, x1 + 40), y);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    // passages piétons aux intersections
    ctx.fillStyle = "rgba(232,228,216,0.75)";
    for (const v of segs) {
      if (!v.v) continue;
      for (const hseg of segs) {
        if (hseg.v) continue;
        if (hseg.at < v.from || hseg.at > v.to) continue;
        if (v.at < hseg.from || v.at > hseg.to) continue;
        const ix = v.at * T, iy = hseg.at * T;
        if (ix < x0 - 200 || ix > x1 + 200 || iy < y0 - 200 || iy > y1 + 200) continue;
        // zébrures nord & sud
        for (let k = 0; k < 6; k++) {
          const zx = ix + 6 + k * 15;
          ctx.fillRect(zx, iy - 14, 9, 10);
          ctx.fillRect(zx, iy + 2 * T + 4, 9, 10);
        }
        for (let k = 0; k < 6; k++) {
          const zy = iy + 6 + k * 15;
          ctx.fillRect(ix - 14, zy, 10, 9);
          ctx.fillRect(ix + 2 * T + 4, zy, 10, 9);
        }
      }
    }
  }

  function drawGround(ctx, vx0, vy0, vx1, vy1) {
    const ci0 = U.clamp(Math.floor(vx0 / CPX), 0, CW - 1);
    const cj0 = U.clamp(Math.floor(vy0 / CPX), 0, CW - 1);
    const ci1 = U.clamp(Math.floor(vx1 / CPX), 0, CW - 1);
    const cj1 = U.clamp(Math.floor(vy1 / CPX), 0, CW - 1);
    for (let cj = cj0; cj <= cj1; cj++)
      for (let ci = ci0; ci <= ci1; ci++)
        ctx.drawImage(chunkCanvas(ci, cj), ci * CPX, cj * CPX);
    // bateaux décoratifs (sous les entités)
    for (const b of boats) {
      if (b.x < vx0 - 80 || b.x > vx1 + 80 || b.y < vy0 - 80 || b.y > vy1 + 80) continue;
      S.PROPS.boat(ctx, b);
    }
    // props plats
    for (const p of flatProps) {
      if (p.x < vx0 - 40 || p.x > vx1 + 40 || p.y < vy0 - 40 || p.y > vy1 + 40) continue;
      S.PROPS[p.type](ctx, p);
    }
  }

  /* ---------- structures (bâtiments + props hauts) ---------- */

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
    _visible.sort((a, b) => b._d2 - a._d2); // loin d'abord, proche du centre en dernier
    for (let i = 0; i < _visible.length; i++) _visible[i].draw(ctx, camX, camY);
  }

  function drawBuilding(ctx, b, camX, camY) {
    const opt = { windows: b.windows, floors: b.floors };
    const tops = S.drawBox(ctx, b.x, b.y, b.w, b.h, b.height, camX, camY, b.wall, b.roof, opt);

    // — décorations de toit (les sommets `tops` sont partagés : utiliser tout de suite)
    const t0x = tops[0].x, t0y = tops[0].y, t2x = tops[2].x, t2y = tops[2].y;
    const tcx = (t0x + t2x) / 2, tcy = (t0y + t2y) / 2;
    const sc = Math.abs(t2x - t0x) / b.w; // échelle approx du toit

    if (b.teahouse) {
      // étage pagode
      S.drawBox(ctx, b.x + b.w * 0.2, b.y + b.h * 0.15, b.w * 0.6, b.h * 0.7, b.height + 26, camX, camY, "#a4442f", "#7a1f14");
    }
    if (b.hospital) {
      ctx.fillStyle = "#ff5340";
      const s = 26 * sc;
      ctx.fillRect(tcx - s / 2, tcy - s / 6, s, s / 3);
      ctx.fillRect(tcx - s / 6, tcy - s / 2, s / 3, s);
    }
    if (b.helipad) {
      ctx.strokeStyle = "#ffc857"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(tcx, tcy, 20 * sc, 0, U.TAU); ctx.stroke();
      ctx.font = "bold " + Math.max(10, 22 * sc) + "px sans-serif";
      ctx.fillStyle = "#ffc857";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("H", tcx, tcy + 1);
    }
    if (b.warehouse) {
      // lignes de toit ondulé
      ctx.strokeStyle = "rgba(20,16,32,0.25)"; ctx.lineWidth = 1.5;
      ctx.beginPath();
      const n = Math.max(3, (b.w / 26) | 0);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        ctx.moveTo(t0x + (t2x - t0x) * t, Math.min(t0y, t2y));
        ctx.lineTo(t0x + (t2x - t0x) * t, Math.max(t0y, t2y));
      }
      ctx.stroke();
    }
    if (!b.warehouse && !b.hospital && b.height > 80 && tileHash(b.tx, b.ty) > 0.4) {
      // clim / cabanon d'accès
      ctx.fillStyle = U.shade(b.roof, -0.25);
      ctx.strokeStyle = S.INK; ctx.lineWidth = 1.2;
      const s = 16 * sc;
      ctx.fillRect(tcx - s + 4, tcy - s / 2, s, s * 0.8);
      ctx.strokeRect(tcx - s + 4, tcy - s / 2, s, s * 0.8);
      ctx.fillRect(tcx + 4, tcy - s / 4, s * 0.7, s * 0.6);
      ctx.strokeRect(tcx + 4, tcy - s / 4, s * 0.7, s * 0.6);
    }
    if (b.sign) {
      // enseigne sur l'avant du toit (côté sud)
      const sx = (tops[3].x + tops[2].x) / 2, sy = (tops[3].y + tops[2].y) / 2;
      ctx.font = "bold " + Math.max(11, 15 * sc) + "px 'Trebuchet MS', sans-serif";
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
    if (b.awning) {
      // auvent au pied du mur sud
      ctx.fillStyle = b.awning;
      ctx.strokeStyle = S.INK; ctx.lineWidth = 1.2;
      ctx.fillRect(b.x + 4, b.y + b.h - 2, b.w - 8, 8);
      ctx.strokeRect(b.x + 4, b.y + b.h - 2, b.w - 8, 8);
    }
  }

  /* =========================================================
     COLLISIONS
     ========================================================= */

  function isSolidTile(tx, ty) {
    const t = get(tx, ty);
    return t === WATER || t === BUILDING;
  }
  function isSolidAt(px, py) {
    return isSolidTile(Math.floor(px / T), Math.floor(py / T));
  }
  function isWalkable(px, py) { return !isSolidAt(px, py); }

  // Résout un cercle contre tuiles pleines + props. Modifie e.x, e.y.
  function collideCircle(e, r) {
    const tx0 = Math.floor((e.x - r) / T), ty0 = Math.floor((e.y - r) / T);
    const tx1 = Math.floor((e.x + r) / T), ty1 = Math.floor((e.y + r) / T);
    let hit = false;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (isSolidTile(tx, ty)) {
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
      // centre dans le rect : pousser vers le bord le plus proche
      const l = e.x - rx, rr = rx + rw - e.x, tt = e.y - ry, bb = ry + rh - e.y;
      const m = Math.min(l, rr, tt, bb);
      if (m === l) e.x = rx - r;
      else if (m === rr) e.x = rx + rw + r;
      else if (m === tt) e.y = ry - r;
      else e.y = ry + rh + r;
    }
    return true;
  }

  /**
   * Résolution ponctuelle : si (x,y) est dans un obstacle plein (tuile ou
   * prop rectangulaire), renvoie le vecteur de sortie minimal, sinon null.
   * Utilisé par la collision « coins » des véhicules.
   */
  function pointPush(x, y) {
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (isSolidTile(tx, ty)) {
      return aabbPush(x, y, tx * T, ty * T, T, T);
    }
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

  // Un point est-il opaque aux balles / à la ligne de vue ?
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
     NAVIGATION (voies + GPS)
     ========================================================= */

  function laneMaskAt(tx, ty) { return inB(tx, ty) ? lane[idx(tx, ty)] : 0; }
  function isRoad(tx, ty) { return get(tx, ty) === ROAD; }

  // BFS sur les tuiles de route pour le GPS
  const _came = new Int32Array(MW * MH);
  const _q = U.makeQueue(MW * MH);

  function nearestRoadTile(px, py, maxR) {
    const tx = Math.floor(px / T), ty = Math.floor(py / T);
    maxR = maxR || 6;
    for (let r = 0; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (isRoad(tx + dx, ty + dy)) return idx(tx + dx, ty + dy);
        }
      }
    }
    return -1;
  }

  /**
   * Chemin piéton : BFS sur les tuiles praticables (tout sauf eau/bâtiment),
   * limité à maxR tuiles autour du départ. Renvoie des jalons en px
   * (une tuile sur deux pour lisser), ou null.
   */
  function findWalkPath(x0, y0, x1, y1, maxR) {
    maxR = maxR || 36;
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
    // garder un jalon sur deux (sauf le dernier)
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

  function buildMinimap() {
    minimapCanvas = document.createElement("canvas");
    minimapCanvas.width = MW * 2; minimapCanvas.height = MH * 2;
    const ctx = minimapCanvas.getContext("2d");
    const cols = {
      [WATER]: "#0d3a41", [GRASS]: "#4f7a3a", [SIDEWALK]: "#8f8775",
      [ROAD]: "#454a56", [PLAZA]: "#9a8b6d", [DOCK]: "#6a7073",
      [PATH]: "#9a8352", [BUILDING]: "#2c2637"
    };
    for (let y = 0; y < MH; y++)
      for (let x = 0; x < MW; x++) {
        ctx.fillStyle = cols[tiles[idx(x, y)]];
        ctx.fillRect(x * 2, y * 2, 2, 2);
      }
  }

  /* ---------- spawns aléatoires runtime ---------- */

  function randomWalkable(rng, cx, cy, minD, maxD, kinds) {
    for (let tries = 0; tries < 10; tries++) {
      const a = rng() * U.TAU;
      const d = minD + rng() * (maxD - minD);
      const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d;
      const t = get(Math.floor(px / T), Math.floor(py / T));
      if (kinds.includes(t)) return { x: px, y: py };
    }
    return null;
  }

  function randomSidewalk(rng, cx, cy, minD, maxD) {
    return randomWalkable(rng, cx, cy, minD, maxD, [SIDEWALK, PLAZA, PATH]);
  }

  function randomLaneTile(rng, cx, cy, minD, maxD) {
    for (let tries = 0; tries < 12; tries++) {
      const a = rng() * U.TAU;
      const d = minD + rng() * (maxD - minD);
      const tx = Math.floor((cx + Math.cos(a) * d) / T);
      const ty = Math.floor((cy + Math.sin(a) * d) / T);
      if (!inB(tx, ty)) continue;
      const m = lane[idx(tx, ty)];
      if (m && !bridgeF[idx(tx, ty)]) {
        // une seule direction => tronçon simple (pas une intersection)
        if (m === LN || m === LS || m === LE || m === LW) return { tx, ty, mask: m };
      }
    }
    return null;
  }

  G.Map = {
    T, MW, MH, WPX, HPX,
    WATER, GRASS, SIDEWALK, ROAD, PLAZA, DOCK, PATH, BUILDING,
    LN, LS, LE, LW, DIRS,
    generate,
    get, laneMaskAt, isRoad, isSolidTile, isSolidAt, isWalkable,
    isBridge: (tx, ty) => inB(tx, ty) && bridgeF[idx(tx, ty)] === 1,
    collideCircle, blocksShot, lineOfSight, pointPush,
    nearestRoadTile, findRoadPath, findWalkPath,
    drawGround, drawStructures, drawWaterOverlay,
    districtAt,
    get minimap() { return minimapCanvas; },
    POI, parkedSpawns, pickupSpawns, buildings, benches,
    randomSidewalk, randomLaneTile, randomWalkable
  };

})(window.G);
