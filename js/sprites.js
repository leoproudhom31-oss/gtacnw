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

  // hash déterministe 2D (style bruit GLSL) : sert à varier fenêtres et
  // détails de toit sans RNG à état, uniquement à partir de coordonnées.
  function h2(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  /* =========================================================
     PIÉTONS v3 — sprites « cuits » en 2× sur canvas offscreen.
     Chaque combinaison (allure, pose, frame, arme) n'est
     dessinée qu'une fois, avec bien plus de détail : archétypes
     civils, coiffures, chapeaux, lunettes, sacs, vraie marche
     à 4 frames, éclairage rim + contours encre.
     Repère local : le personnage regarde vers +x.
     ========================================================= */

  const SKINS = ["#f5d7b5", "#f0c8a0", "#e8b48c", "#d9a878", "#c68e5f", "#a06a42", "#8a5a34"];
  const HAIRS = ["#14120f", "#2a1c10", "#4a2c14", "#6b4423", "#8a8078", "#b5aca0",
                 "#101a2e", "#3d1f24", "#7a3520"];

  // Archétypes civils : silhouette + palette + accessoires cohérents.
  const ARCHETYPES = [
    { id: "salaryman", w: 3,
      tops: ["#33415c", "#2c3e50", "#4a4a55", "#3d3245"], panels: ["#e8e4d8", "#d8e4f0", "#f0e0d0"],
      bottoms: ["#2c3040", "#3a3a44"], shoes: "#1d1a20",
      hair: ["buzz", "short", "short"], hat: null, tie: true, glasses: 0.35, bag: "hand" },
    { id: "worker", w: 2,
      tops: ["#e07b39", "#e0b839", "#c9622e"], panels: ["#f5f0e6"],
      bottoms: ["#4a5568", "#6b4f3a"], shoes: "#3a2c1a",
      hair: ["buzz", "short"], hat: "hard", hatC: "#f2c230", hivis: true },
    { id: "vendor", w: 2,
      tops: ["#8d6e63", "#7a8a6a", "#a3593d"], panels: ["#e8dcc8"],
      bottoms: ["#5c4d3d", "#4a4a4a"], shoes: "#2c2620",
      hair: ["short"], hat: "straw", hatC: "#d9b36c", apron: "#5a4632" },
    { id: "hoodie", w: 3,
      tops: ["#d63c6b", "#4f7fc9", "#7ac94f", "#9b59b6", "#e05840"], panels: null,
      bottoms: ["#23262e", "#3a4a5c"], shoes: "#e8e4d8",
      hair: ["spiky", "buzz", "short"], hood: true, headphones: 0.5 },
    { id: "tourist", w: 2,
      tops: ["#3aa6a6", "#e8a03a", "#d0567a"], panels: ["#f5ead6"], floral: true,
      bottoms: ["#c9bda6", "#8fa3b0"], shoes: "#b5836a",
      hair: ["short", "bob"], hat: "bob", hatC: "#e8e0c8", bag: "strap", camera: true },
    { id: "elegant", w: 2,
      tops: ["#c0396b", "#6b3fa0", "#2e8b57", "#c9a227"], panels: null, dress: true,
      bottoms: ["#1d1a20"], shoes: "#3d1f24",
      hair: ["bob", "long", "bun"], glasses: 0.2, bag: "strap" },
    { id: "granny", w: 1.5,
      tops: ["#9c8aa8", "#b5836a", "#8fa3b0", "#c9bda6"], panels: ["#e8e4d8"],
      bottoms: ["#5c5560", "#6b5f50"], shoes: "#4a4038",
      hair: ["bun"], hairC: "#b5aca0", glasses: 0.5 },
    { id: "courier", w: 2,
      tops: ["#2e8b57", "#c94f4f", "#4f7fc9"], panels: null,
      bottoms: ["#23262e", "#4a4a4a"], shoes: "#e05840",
      hair: ["short", "spiky"], hat: "cap", hatC: "#1d1a20", bag: "strap" }
  ];

  let _lookN = 0;

  function pickArch(rng) {
    let total = 0;
    for (const a of ARCHETYPES) total += a.w;
    let r = rng() * total;
    for (const a of ARCHETYPES) { r -= a.w; if (r <= 0) return a; }
    return ARCHETYPES[0];
  }

  function pedLook(kind, rng) {
    rng = rng || Math.random;
    const skin = U.pick(rng, SKINS);
    let L;
    switch (kind) {
      case "player":
        L = { skin: "#e8b48c", hair: "#14181f", hairStyle: "spiky",
              top: "#1f9c72", panel: "#2ee6a8", bottom: "#23262e", shoes: "#e8e4d8",
              trim: "#ffc857", zipper: true };
        break;
      case "wu":
        L = { skin: "#d9a878", hair: "#b9b9b9", hairStyle: "bald",
              top: "#5c5568", panel: "#6d6875", bottom: "#3a3a3a", shoes: "#2c2620",
              robe: true, trim: "#ffc857", beard: "#b9b9b9" };
        break;
      case "mechanic":
        L = { skin: "#c68e5f", hair: "#2a1c10", hairStyle: "short",
              top: "#4f6a8a", panel: "#5f7a9a", bottom: "#4f6a8a", shoes: "#2c2620",
              hat: "cap", hatC: "#8a3324", apron: "#3d4a5c" };
        break;
      case "cop":
        L = { skin, hair: "#1d1a20", hairStyle: "buzz",
              top: "#2b4c7e", panel: "#3a5c90", bottom: "#22304a", shoes: "#14121a",
              hat: "police", hatC: "#22304a", belt: "#14121a", badge: true,
              glasses: rng() < 0.4 };
        break;
      case "shark":
        L = { skin, hair: "#181818", hairStyle: "buzz",
              top: "#158fa0", panel: "#19b3c4", bottom: "#2c2c34", shoes: "#1d1a20",
              hat: "bandana", hatC: "#0d5f6b", zipper: true,
              tattoo: rng() < 0.5 };
        break;
      case "lotus":
        L = { skin, hair: "#101010", hairStyle: "short",
              top: "#23202b", panel: "#141119", bottom: "#1b1820", shoes: "#14121a",
              trim: "#ffc857", tie: "#ffc857", glasses: rng() < 0.5 };
        break;
      default: {
        const a = pickArch(rng);
        L = {
          skin,
          hair: a.hairC || U.pick(rng, HAIRS),
          hairStyle: U.pick(rng, a.hair),
          top: U.pick(rng, a.tops),
          panel: a.panels ? U.pick(rng, a.panels) : null,
          bottom: U.pick(rng, a.bottoms),
          shoes: a.shoes,
          hat: a.hat || null, hatC: a.hatC || null,
          tie: a.tie ? U.pick(rng, ["#a93226", "#1e8449", "#2874a6", "#b9770e"]) : null,
          glasses: a.glasses ? rng() < a.glasses : false,
          bag: a.bag && rng() < 0.6 ? a.bag : null,
          bagC: U.pick(rng, ["#6b4f3a", "#3d4a5c", "#8a3324"]),
          hivis: !!a.hivis, apron: a.apron || null, hood: !!a.hood,
          headphones: a.headphones ? rng() < a.headphones : false,
          dress: !!a.dress, floral: !!a.floral, camera: !!a.camera
        };
      }
    }
    // clé de cache : les mêmes combinaisons partagent leurs sprites
    L.key = [kind, L.skin, L.hair, L.hairStyle, L.top, L.panel, L.bottom, L.hat, L.hatC,
             L.tie, L.glasses ? 1 : 0, L.bag, L.bagC, L.hivis ? 1 : 0, L.apron,
             L.hood ? 1 : 0, L.headphones ? 1 : 0, L.dress ? 1 : 0, L.floral ? 1 : 0,
             L.robe ? 1 : 0, L.trim, L.beard, L.belt, L.zipper ? 1 : 0, L.tattoo ? 1 : 0,
             L.camera ? 1 : 0, L.badge ? 1 : 0].join("~");
    return L;
  }

  /* ---------- cuisson des frames ---------- */

  const SS = 3;              // super-échantillonnage (netteté HiDPI + zoom)
  const FR = 64;             // taille logique d'une frame
  const frameCache = new Map();
  const FRAME_CACHE_MAX = 900;

  // balancements des 4 frames de marche : foulée avant / passage / foulée
  // arrière / passage — cadence naturelle sans direction inversée.
  const WALK_SWING = [0.95, 0.2, -0.95, -0.2];

  function pedFrame(look, pose, fi, weapon) {
    const key = look.key + "|" + pose + fi + "|" + (weapon || "");
    let c = frameCache.get(key);
    if (c) return c;
    if (frameCache.size >= FRAME_CACHE_MAX) {
      const first = frameCache.keys().next().value;
      frameCache.delete(first);
    }
    c = document.createElement("canvas");
    c.width = c.height = FR * SS;
    const x = c.getContext("2d");
    x.setTransform(SS, 0, 0, SS, FR * SS / 2, FR * SS / 2);
    x.lineJoin = "round";
    bakePed(x, look, pose, fi, weapon);
    frameCache.set(key, c);
    return c;
  }

  function E(x, cx, cy, rx, ry, rot, fill, noStroke) {
    x.fillStyle = fill;
    x.beginPath();
    x.ellipse(cx, cy, rx, ry, rot || 0, 0, U.TAU);
    x.fill();
    if (!noStroke) { x.strokeStyle = INK; x.lineWidth = 1.25; x.stroke(); }
  }

  // ellipse en dôme : dégradé radial (lumière en haut-gauche) donnant du
  // volume, à partir d'une couleur de base — remplace les aplats plats.
  // tint décale l'ensemble du dôme (négatif = plus sombre) pour distinguer
  // p.ex. une manche du torse tout en gardant le relief.
  function Er(x, cx, cy, rx, ry, rot, base, noStroke, lw, tint) {
    tint = tint || 0;
    const lit = U.shade(base, 0.26 + tint), mid = tint ? U.shade(base, tint) : base, sh = U.shade(base, -0.32 + tint);
    x.save();
    x.translate(cx, cy); x.rotate(rot || 0);
    const g = x.createRadialGradient(-rx * 0.34, -ry * 0.42, ry * 0.12, 0, ry * 0.15, Math.max(rx, ry) * 1.3);
    g.addColorStop(0, lit); g.addColorStop(0.52, mid); g.addColorStop(1, sh);
    x.fillStyle = g;
    x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, U.TAU); x.fill();
    if (!noStroke) { x.strokeStyle = INK; x.lineWidth = lw || 1.3; x.stroke(); }
    x.restore();
  }

  function bakePed(x, L, pose, fi, weapon) {
    if (pose === "down") { bakeDown(x, L); return; }
    if (pose === "cower") x.scale(0.86, 0.86);

    const swing = pose === "walk" ? WALK_SWING[fi] : 0;
    const punch = pose === "punch" ? (fi === 0 ? 1 : 0.35) : 0;
    const shoes = L.shoes || "#20242c";
    const hand = L.skin;

    /* --- jambes / pieds --- */
    if (pose === "sit") {
      Er(x, 7, -3, 3.6, 2.5, 0, L.bottom);
      Er(x, 7, 3, 3.6, 2.5, 0, L.bottom);
      Er(x, 10, -3, 2.2, 1.9, 0, shoes);
      Er(x, 10, 3, 2.2, 1.9, 0, shoes);
    } else if (pose !== "cower") {
      // cuisse + chaussure par jambe, foulée opposée
      const lift = pose === "walk" ? Math.abs(swing) * 0.8 : 0;
      Er(x, swing * 3.2, -4.2, 3.6, 2.5, swing * 0.18, L.bottom, true);
      Er(x, -swing * 3.2, 4.2, 3.6, 2.5, -swing * 0.18, L.bottom, true);
      Er(x, swing * 5.6, -4.4, 2.4 + lift * 0.4, 1.9, 0, shoes);
      Er(x, -swing * 5.6, 4.4, 2.4 + lift * 0.4, 1.9, 0, shoes);
    }

    /* --- sac à dos / mallette (derrière le torse) --- */
    if (L.bag === "hand" && (pose === "idle" || pose === "walk")) {
      x.fillStyle = L.bagC; x.strokeStyle = INK; x.lineWidth = 1.2;
      x.fillRect(-2 - swing * 2, 7.6, 5.5, 3.6);
      x.strokeRect(-2 - swing * 2, 7.6, 5.5, 3.6);
    }

    /* --- bras --- */
    x.strokeStyle = INK;
    const armY = L.robe ? 8.2 : 7.4;
    const arm = -0.18; // teinte de manche (plus sombre que le torse)
    if (pose === "aim") {
      Er(x, 7.2, -3.2, 4.8, 2.7, 0.28, L.top, false, 1.3, arm);
      Er(x, 7.2, 3.2, 4.8, 2.7, -0.28, L.top, false, 1.3, arm);
      Er(x, 10.6, -1.6, 1.7, 1.5, 0, hand);
      Er(x, 10.6, 1.6, 1.7, 1.5, 0, hand);
    } else if (pose === "cower") {
      Er(x, 4.4, -3, 3.6, 2.6, 0.45, L.top, false, 1.3, arm);
      Er(x, 4.4, 3, 3.6, 2.6, -0.45, L.top, false, 1.3, arm);
      Er(x, 6.8, -1.8, 1.6, 1.4, 0, hand);
      Er(x, 6.8, 1.8, 1.6, 1.4, 0, hand);
    } else if (pose === "phone") {
      Er(x, 1, armY, 3.6, 2.6, 0, L.top, false, 1.3, arm);
      Er(x, 4.2, -4.6, 3.4, 2.6, 0.55, L.top, false, 1.3, arm);
      Er(x, 6.4, -2.6, 1.7, 1.5, 0, hand);
      // le téléphone
      x.fillStyle = "#14121a";
      x.fillRect(6.4, -3.8, 2.2, 3.4);
    } else if (pose === "punch") {
      const ext = 4 + punch * 7;
      Er(x, ext, -5.4, 4.2, 2.5, 0.12, L.top, false, 1.3, arm);
      Er(x, 1 - punch * 2, 6.8, 3.4, 2.6, 0, L.top, false, 1.3, arm);
      Er(x, ext + 3.4, -4.8, 1.9, 1.7, 0, hand);
    } else {
      Er(x, 1 + swing * 3, -armY, 3.5, 2.6, 0, L.top, false, 1.3, arm);
      Er(x, 1 - swing * 3, armY, 3.5, 2.6, 0, L.top, false, 1.3, arm);
      Er(x, 3.4 + swing * 4, -armY - 0.4, 1.6, 1.4, 0, hand);
      Er(x, 3.4 - swing * 4, armY + 0.4, 1.6, 1.4, 0, hand);
    }

    /* --- torse --- */
    const trx = L.robe ? 9.4 : (L.dress ? 8.2 : 7.8);
    const trY = L.robe || L.dress ? 7.4 : 6.8;
    Er(x, 0, 0, trx, trY, 0, L.top, true);
    // panneau central (chemise sous veste ouverte)
    if (L.panel) {
      x.fillStyle = L.panel;
      x.beginPath();
      x.moveTo(trx - 1.6, -2.4);
      x.quadraticCurveTo(2.2, -3.2, 0.4, 0);
      x.quadraticCurveTo(2.2, 3.2, trx - 1.6, 2.4);
      x.quadraticCurveTo(trx + 0.4, 0, trx - 1.6, -2.4);
      x.fill();
    }
    if (L.zipper) {
      x.strokeStyle = "rgba(20,16,32,0.55)"; x.lineWidth = 0.9;
      x.beginPath(); x.moveTo(trx - 1, 0); x.lineTo(-trx + 2, 0); x.stroke();
    }
    if (L.hivis) {
      x.strokeStyle = "#e8e4d8"; x.lineWidth = 1.6;
      x.beginPath();
      x.moveTo(-3, -trY + 1.4); x.lineTo(-3, trY - 1.4);
      x.moveTo(1.5, -trY + 1.2); x.lineTo(1.5, trY - 1.2);
      x.stroke();
    }
    if (L.floral) {
      x.fillStyle = "rgba(245,234,214,0.75)";
      for (const [fx, fy] of [[-3, -3], [1, 3.4], [-4.5, 2.4], [2.6, -3.4]]) {
        x.beginPath(); x.arc(fx, fy, 1.1, 0, U.TAU); x.fill();
      }
    }
    if (L.apron) {
      x.fillStyle = L.apron;
      x.beginPath();
      x.moveTo(trx - 1, -3.4); x.quadraticCurveTo(trx + 2.4, 0, trx - 1, 3.4);
      x.lineTo(1, 2.6); x.lineTo(1, -2.6);
      x.closePath(); x.fill();
      x.strokeStyle = INK; x.lineWidth = 1; x.stroke();
    }
    if (L.tie) {
      x.fillStyle = typeof L.tie === "string" ? L.tie : "#a93226";
      x.beginPath();
      x.moveTo(trx - 2, -1); x.lineTo(trx - 2, 1); x.lineTo(2.4, 0.7); x.lineTo(2.4, -0.7);
      x.closePath(); x.fill();
    }
    if (L.belt) {
      x.strokeStyle = L.belt; x.lineWidth = 1.7;
      x.beginPath(); x.moveTo(-2.4, -trY + 1); x.lineTo(-2.4, trY - 1); x.stroke();
    }
    if (L.trim) {
      x.strokeStyle = L.trim; x.lineWidth = 1.3;
      x.beginPath();
      x.moveTo(trx - 2.2, -2.8); x.quadraticCurveTo(trx + 0.6, 0, trx - 2.2, 2.8);
      x.stroke();
    }
    if (L.bag === "strap") {
      x.strokeStyle = L.bagC; x.lineWidth = 1.9;
      x.beginPath(); x.moveTo(trx - 2.6, -3.4); x.lineTo(-trx + 2.6, 3.4); x.stroke();
      E(x, -2.5, 6.8, 3, 2.2, 0.3, L.bagC);
    }
    if (L.camera) {
      x.fillStyle = "#2c2c34"; x.strokeStyle = INK; x.lineWidth = 1;
      x.fillRect(2.2, 2.6, 3.4, 2.6); x.strokeRect(2.2, 2.6, 3.4, 2.6);
    }
    // rim light discret (soleil au sud-ouest de la ville)
    x.strokeStyle = "rgba(255,236,190,0.34)"; x.lineWidth = 1.3;
    x.beginPath(); x.ellipse(0, 0, trx - 0.9, trY - 0.9, 0, Math.PI * 0.75, Math.PI * 1.35); x.stroke();
    // contour du torse par-dessus les détails
    x.strokeStyle = INK; x.lineWidth = 1.3;
    x.beginPath(); x.ellipse(0, 0, trx, trY, 0, 0, U.TAU); x.stroke();

    /* --- arme tenue --- */
    if (weapon && weapon !== "fist") {
      x.strokeStyle = INK; x.lineWidth = 1.1;
      if (weapon === "bat") {
        x.save(); x.rotate(pose === "aim" ? 0.15 : 0.55);
        x.fillStyle = "#b08a5e";
        x.fillRect(6, -1.7, 14, 3.4); x.strokeRect(6, -1.7, 14, 3.4);
        x.fillStyle = "#8a6a44";
        x.fillRect(6, -1.7, 3.4, 3.4);
        x.restore();
      } else if (pose === "aim" || pose === "idle" || pose === "walk") {
        const len = weapon === "smg" ? 9.5 : weapon === "shotgun" ? 13.5 : 7.5;
        const gy = pose === "aim" ? 0 : 5.8;
        x.fillStyle = "#20202c";
        x.fillRect(pose === "aim" ? 11 : 4.6, gy - 1.4, len, 2.8);
        x.strokeRect(pose === "aim" ? 11 : 4.6, gy - 1.4, len, 2.8);
        if (weapon === "shotgun") {
          x.fillStyle = "#6b4423";
          x.fillRect((pose === "aim" ? 11 : 4.6) + len - 3.4, gy - 1.4, 3.4, 2.8);
        }
      }
    }

    /* --- tête --- */
    bakeHead(x, L);
  }

  function bakeHead(x, L) {
    const hx = 2.6, r = 4.9;
    // ombre de nuque : un croissant sombre décalé vers le torse donne
    // l'épaisseur du cou sous la tête.
    x.fillStyle = "rgba(10,7,18,0.24)";
    x.beginPath(); x.ellipse(hx - 2.6, 0, r - 0.2, r - 0.3, 0, 0, U.TAU); x.fill();
    // oreilles (sous la tête, teinte peau ombrée)
    if (!L.hat || L.hat === "cap" || L.hat === "bandana") {
      Er(x, hx - 0.6, -r + 0.4, 1.2, 1, 0, L.skin, true, 1, -0.12);
      Er(x, hx - 0.6, r - 0.4, 1.2, 1, 0, L.skin, true, 1, -0.12);
    }
    // crâne / visage en dôme (lumière en haut-gauche)
    Er(x, hx, 0, r, r, 0, L.skin);
    // pommette éclairée côté lumière
    x.fillStyle = "rgba(255,246,226,0.20)";
    x.beginPath(); x.ellipse(hx + 1.4, -1.8, 1.9, 1.3, -0.4, 0, U.TAU); x.fill();

    // traits du visage (le perso regarde vers +x, légère plongée) : nez,
    // sourcils et yeux — donne un vrai petit visage plutôt qu'un dôme nu.
    const fx = hx + 2.1;
    // nez : arête claire + ombre douce
    x.strokeStyle = "rgba(255,244,224,0.42)"; x.lineWidth = 0.75; x.lineCap = "round";
    x.beginPath(); x.moveTo(fx - 0.3, -0.4); x.lineTo(fx + 1.5, 0); x.lineTo(fx - 0.3, 0.4); x.stroke();
    x.strokeStyle = "rgba(90,58,40,0.34)"; x.lineWidth = 0.7;
    x.beginPath(); x.moveTo(fx + 1.4, 0.5); x.lineTo(fx - 0.2, 0.9); x.stroke();
    x.lineCap = "butt";
    if (!L.glasses) {
      // sourcils
      x.strokeStyle = "rgba(34,24,20,0.55)"; x.lineWidth = 0.85; x.lineCap = "round";
      x.beginPath(); x.moveTo(fx - 1.1, -2.3); x.lineTo(fx + 0.5, -1.5); x.stroke();
      x.beginPath(); x.moveTo(fx - 1.1, 2.3); x.lineTo(fx + 0.5, 1.5); x.stroke();
      x.lineCap = "butt";
      // yeux (petits, sombres, reflet ponctuel)
      for (const ey of [-1.55, 1.55]) {
        x.fillStyle = "rgba(24,18,26,0.78)";
        x.beginPath(); x.ellipse(fx - 0.1, ey, 0.72, 0.52, 0, 0, U.TAU); x.fill();
        x.fillStyle = "rgba(255,255,255,0.65)";
        x.beginPath(); x.arc(fx + 0.15, ey - 0.2, 0.2, 0, U.TAU); x.fill();
      }
    }
    // barbe / barbiche (pointe avant)
    if (L.beard) {
      x.fillStyle = L.beard;
      x.beginPath();
      x.moveTo(hx + r - 0.6, -1.8);
      x.quadraticCurveTo(hx + r + 2.6, 0, hx + r - 0.6, 1.8);
      x.closePath(); x.fill();
    }

    const hairC = L.hair;
    x.fillStyle = hairC;
    switch (L.hairStyle) {
      case "bald": {
        // couronne de cheveux
        x.beginPath(); x.arc(hx - 0.4, 0, r - 0.3, Math.PI * 0.72, Math.PI * 1.28); x.lineWidth = 2.1;
        x.strokeStyle = hairC; x.stroke();
        break;
      }
      case "buzz":
        x.beginPath(); x.arc(hx - 0.6, 0, r - 0.4, Math.PI * 0.55, Math.PI * 1.45); x.fill();
        break;
      case "short":
        x.beginPath(); x.arc(hx - 0.4, 0, r, Math.PI * 0.5, Math.PI * 1.5); x.fill();
        x.beginPath(); x.ellipse(hx - 1.8, 0, 3.4, r - 0.6, 0, 0, U.TAU); x.fill();
        break;
      case "spiky": {
        x.beginPath(); x.arc(hx - 0.6, 0, r - 0.2, Math.PI * 0.5, Math.PI * 1.5); x.fill();
        for (let i = 0; i < 4; i++) {
          const a = Math.PI * 0.62 + (i / 3) * Math.PI * 0.76;
          const bx = hx - 0.6 + Math.cos(a) * (r - 0.6), by = Math.sin(a) * (r - 0.6);
          x.beginPath();
          x.moveTo(bx + Math.cos(a + 0.5), by + Math.sin(a + 0.5) * 1.4);
          x.lineTo(bx + Math.cos(a) * 2.6, by + Math.sin(a) * 2.6);
          x.lineTo(bx + Math.cos(a - 0.5), by + Math.sin(a - 0.5) * 1.4);
          x.closePath(); x.fill();
        }
        break;
      }
      case "bob":
        x.beginPath(); x.ellipse(hx - 0.8, 0, r + 0.7, r + 0.7, 0, Math.PI * 0.42, Math.PI * 1.58); x.fill();
        x.strokeStyle = INK; x.lineWidth = 1.1; x.stroke();
        break;
      case "bun":
        x.beginPath(); x.arc(hx - 0.4, 0, r - 0.2, Math.PI * 0.5, Math.PI * 1.5); x.fill();
        E(x, hx - r - 1.6, 0, 2.2, 2.2, 0, hairC);
        break;
      case "pony":
        x.beginPath(); x.arc(hx - 0.4, 0, r - 0.2, Math.PI * 0.5, Math.PI * 1.5); x.fill();
        E(x, hx - r - 3, 0, 3.6, 1.9, 0, hairC);
        break;
      case "long":
        x.beginPath(); x.ellipse(hx - 1.2, 0, r + 1, r + 1.3, 0, Math.PI * 0.4, Math.PI * 1.6); x.fill();
        x.strokeStyle = INK; x.lineWidth = 1.1; x.stroke();
        E(x, hx - r - 2.4, 0, 4, 3.2, 0, hairC, true);
        break;
    }

    // reflet sur la chevelure (mèche lumineuse côté lumière)
    if (L.hairStyle && L.hairStyle !== "bald" && !L.hood && (!L.hat || L.hat === "bandana")) {
      x.strokeStyle = U.shade(hairC, 0.34); x.lineWidth = 1.2; x.lineCap = "round";
      x.beginPath(); x.arc(hx - 1.2, -0.8, r - 1.3, Math.PI * 0.92, Math.PI * 1.42); x.stroke();
      x.lineCap = "butt";
    }

    // capuche par-dessus les cheveux
    if (L.hood) {
      x.fillStyle = U.shade(L.top, -0.12);
      x.beginPath(); x.arc(hx - 0.8, 0, r + 1, Math.PI * 0.42, Math.PI * 1.58); x.fill();
      x.strokeStyle = INK; x.lineWidth = 1.15; x.stroke();
    }

    // chapeaux
    x.strokeStyle = INK; x.lineWidth = 1.15;
    switch (L.hat) {
      case "cap":
        x.fillStyle = L.hatC;
        x.beginPath(); x.arc(hx - 0.4, 0, r - 0.1, Math.PI * 0.45, Math.PI * 1.55); x.fill(); x.stroke();
        // visière
        x.fillStyle = U.shade(L.hatC, -0.15);
        x.beginPath();
        x.moveTo(hx + 1.4, -3.4); x.quadraticCurveTo(hx + 6.4, 0, hx + 1.4, 3.4);
        x.closePath(); x.fill(); x.stroke();
        break;
      case "police":
        x.fillStyle = L.hatC;
        E(x, hx - 0.4, 0, r - 0.1, r - 0.1, 0, L.hatC);
        x.fillStyle = "#ffc857";
        x.beginPath(); x.arc(hx + 1.6, 0, 1.2, 0, U.TAU); x.fill();
        x.fillStyle = U.shade(L.hatC, -0.2);
        x.beginPath();
        x.moveTo(hx + 2.4, -3.2); x.quadraticCurveTo(hx + 6.6, 0, hx + 2.4, 3.2);
        x.closePath(); x.fill(); x.stroke();
        break;
      case "straw":
        x.fillStyle = L.hatC;
        E(x, hx - 0.2, 0, r + 2.6, r + 2.6, 0, L.hatC);
        x.strokeStyle = U.shade(L.hatC, -0.3); x.lineWidth = 1;
        x.beginPath(); x.arc(hx - 0.2, 0, r - 0.6, 0, U.TAU); x.stroke();
        x.strokeStyle = INK; x.lineWidth = 1.15;
        E(x, hx - 0.2, 0, 2.3, 2.3, 0, U.shade(L.hatC, -0.12));
        break;
      case "hard":
        x.fillStyle = L.hatC;
        E(x, hx - 0.2, 0, r + 0.5, r + 0.5, 0, L.hatC);
        x.strokeStyle = U.shade(L.hatC, -0.35); x.lineWidth = 1.4;
        x.beginPath(); x.moveTo(hx - r + 0.6, 0); x.lineTo(hx + r - 0.6, 0); x.stroke();
        break;
      case "bandana": {
        x.fillStyle = L.hatC;
        x.beginPath(); x.arc(hx - 0.4, 0, r, Math.PI * 0.42, Math.PI * 1.58); x.fill(); x.stroke();
        // dents de requin
        x.fillStyle = "#e8f6f8";
        for (let i = -1; i <= 1; i++) {
          x.beginPath();
          x.moveTo(hx - 2 , i * 2.4 - 0.9);
          x.lineTo(hx - 4.2, i * 2.4);
          x.lineTo(hx - 2, i * 2.4 + 0.9);
          x.closePath(); x.fill();
        }
        // nœud
        E(x, hx - r - 0.8, 0, 1.4, 2, 0, L.hatC, true);
        break;
      }
      case "bob":
        x.fillStyle = L.hatC;
        E(x, hx - 0.3, 0, r + 1.8, r + 1.8, 0, L.hatC);
        E(x, hx - 0.3, 0, r - 0.9, r - 0.9, 0, U.shade(L.hatC, -0.1));
        break;
    }

    // lunettes de soleil (branche visible du dessus)
    if (L.glasses) {
      x.strokeStyle = "#14121a"; x.lineWidth = 1.7;
      x.beginPath();
      x.moveTo(hx + r - 1.2, -3.1);
      x.quadraticCurveTo(hx + r + 1.4, 0, hx + r - 1.2, 3.1);
      x.stroke();
    }

    // casque audio
    if (L.headphones) {
      x.strokeStyle = "#e05840"; x.lineWidth = 1.6;
      x.beginPath(); x.arc(hx - 0.6, 0, r + 0.8, Math.PI * 0.62, Math.PI * 1.38); x.stroke();
      E(x, hx - 0.6, -(r + 0.6), 1.5, 1.5, 0, "#e05840");
      E(x, hx - 0.6, r + 0.6, 1.5, 1.5, 0, "#e05840");
    }

    // tatouage de nuque (Requins)
    if (L.tattoo) {
      x.strokeStyle = "rgba(20,60,70,0.8)"; x.lineWidth = 1;
      x.beginPath();
      x.moveTo(hx - r - 0.4, -1.4); x.lineTo(hx - r - 2, 0); x.lineTo(hx - r - 0.4, 1.4);
      x.stroke();
    }
  }

  function bakeDown(x, L) {
    // au sol, membres relâchés
    Er(x, -6, 2.5, 4, 2.3, 0.5, L.bottom);
    Er(x, -5.4, -3, 4, 2.3, -0.4, L.bottom);
    Er(x, -8.6, 3.6, 2.1, 1.7, 0, L.shoes || "#20242c");
    Er(x, -8, -4.2, 2.1, 1.7, 0, L.shoes || "#20242c");
    Er(x, 1.5, 0, 7.6, 6.2, 0.12, L.top);
    Er(x, 3, -6.4, 3.2, 2.2, -0.5, L.top, false, 1.3, -0.18);
    Er(x, 1, 6.6, 3.2, 2.2, 0.6, L.top, false, 1.3, -0.18);
    Er(x, 9.6, -1, 4.4, 4.4, 0, L.skin);
    x.fillStyle = L.hair;
    x.beginPath(); x.arc(8.6, -1.4, 4.4, Math.PI * 0.5, Math.PI * 1.5); x.fill();
  }

  /**
   * Dessine un piéton (API inchangée). Le contexte doit déjà être translaté
   * sur sa position. angle : direction du regard ; walkPhase : phase de
   * marche ; pose : idle|walk|punch|aim|down|sit|phone|cower.
   */
  function drawPed(ctx, look, angle, walkPhase, pose, opt) {
    opt = opt || {};

    // ombre portée (hors sprite : elle ne tourne pas avec le corps),
    // dégradé radial → bords doux plutôt qu'une tache dure.
    if (pose !== "down") {
      const sg = ctx.createRadialGradient(1.6, 2.8, 1.2, 1.6, 2.8, 9.4);
      sg.addColorStop(0, "rgba(8,6,16,0.36)");
      sg.addColorStop(0.62, "rgba(8,6,16,0.22)");
      sg.addColorStop(1, "rgba(8,6,16,0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(1.6, 2.8, 9.2, 7.4, 0, 0, U.TAU);
      ctx.fill();
    }

    let fi = 0;
    if (pose === "walk") fi = Math.floor(walkPhase / (Math.PI / 2)) & 3;
    else if (pose === "punch") fi = (opt.punchT || 0) > 0.45 ? 0 : 1;

    const weapon = (pose === "aim" || opt.showWeapon) ? opt.weapon : null;
    const frame = pedFrame(look, pose, fi, weapon);

    ctx.save();
    ctx.rotate(angle);
    if (opt.scale && opt.scale !== 1) ctx.scale(opt.scale, opt.scale);
    if (opt.alpha != null) ctx.globalAlpha = opt.alpha;
    ctx.drawImage(frame, -FR / 2, -FR / 2, FR, FR);
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
  const VSS = 4; // suréchantillonnage : les voitures sont cuites une fois
                 // pour toutes, la mémoire supplémentaire est négligeable
                 // (quelques dizaines de combinaisons type × couleur) —
                 // autant les cuire très nettes pour le HiDPI et le zoom.

  // chemin de carrosserie : nez avant (droite/+x) plus arrondi que l'arrière
  function carBodyPath(ctx, x, y, w, h, rF, rR) {
    ctx.beginPath();
    ctx.moveTo(x + rR, y);
    ctx.lineTo(x + w - rF, y);
    ctx.arcTo(x + w, y, x + w, y + rF, rF);
    ctx.lineTo(x + w, y + h - rF);
    ctx.arcTo(x + w, y + h, x + w - rF, y + h, rF);
    ctx.lineTo(x + rR, y + h);
    ctx.arcTo(x, y + h, x, y + h - rR, rR);
    ctx.lineTo(x, y + rR);
    ctx.arcTo(x, y, x + rR, y, rR);
    ctx.closePath();
  }

  // vitre : verre teinté avec dégradé + streak de reflet diagonal
  function glass(ctx, x, y, w, h, r) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "#8fb8cc");
    g.addColorStop(0.45, "#3f5566");
    g.addColorStop(0.55, "#334455");
    g.addColorStop(1, "#6f97ab");
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, r); ctx.fill();
    // reflet
    ctx.save();
    roundRect(ctx, x, y, w, h, r); ctx.clip();
    ctx.fillStyle = "rgba(220,240,250,0.28)";
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.18);
    ctx.lineTo(x + w, y - h * 0.1);
    ctx.lineTo(x + w, y + h * 0.32);
    ctx.lineTo(x, y + h * 0.58);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(18,14,28,0.55)"; ctx.lineWidth = 0.8;
    roundRect(ctx, x, y, w, h, r); ctx.stroke();
  }

  function wheel(ctx, cx, cy, ln, wd) {
    // pneu
    ctx.fillStyle = "#15151c";
    roundRect(ctx, cx - ln / 2, cy - wd / 2, ln, wd, wd * 0.35); ctx.fill();
    // jante
    ctx.fillStyle = "#3a3d45";
    roundRect(ctx, cx - ln / 2 + 1.4, cy - wd / 2 + 0.9, ln - 2.8, wd - 1.8, 1); ctx.fill();
    ctx.fillStyle = "#565a63";
    ctx.fillRect(cx - 0.7, cy - wd / 2 + 0.9, 1.4, wd - 1.8);
  }

  function vehicleSprite(type, color) {
    const key = type + "|" + color;
    let c = vehicleCache.get(key);
    if (c) return c;

    const def = VEHICLE_DEFS[type];
    const pad = 7;
    const lw = def.L + pad * 2, lh = def.W + pad * 2; // dimensions logiques (unités monde)
    c = document.createElement("canvas");
    c.width = Math.round(lw * VSS);
    c.height = Math.round(lh * VSS);
    c.lw = lw; c.lh = lh;
    const L = def.L, W = def.W;
    const ctx = c.getContext("2d");
    ctx.scale(VSS, VSS);
    ctx.translate(pad, pad);
    ctx.lineJoin = "round";

    const body = def.body || color;
    const dark = U.shade(body, -0.34);
    const darker = U.shade(body, -0.5);
    const lite = U.shade(body, 0.28);
    const c0 = L * def.cabin[0], c1 = L * def.cabin[1];

    /* ---------- roues (sous la caisse, dépassent sur les côtés) ---------- */
    const axF = L * 0.75, axR = L * 0.17;
    for (const cx of [axR, axF]) {
      wheel(ctx, cx, -0.4, 9, 4.4);
      wheel(ctx, cx, W + 0.4, 9, 4.4);
    }

    /* ---------- ombre de contact sous la caisse ---------- */
    ctx.fillStyle = "rgba(8,6,14,0.28)";
    roundRect(ctx, 1.5, 1.5, L - 1, W - 1, 7); ctx.fill();

    /* ---------- carrosserie : base + dégradé directionnel ---------- */
    const rF = W * 0.42, rR = W * 0.30;
    carBodyPath(ctx, 0, 0, L, W, rF, rR);
    const bg = ctx.createLinearGradient(0, -1, 0, W + 1);
    bg.addColorStop(0, lite);              // bord éclairé (haut)
    bg.addColorStop(0.28, U.shade(body, 0.08));
    bg.addColorStop(0.5, body);
    bg.addColorStop(0.78, U.shade(body, -0.14));
    bg.addColorStop(1, dark);              // bord ombré (bas)
    ctx.fillStyle = bg;
    ctx.fill();

    // ligne de reflet longitudinale (arête du capot au coffre)
    ctx.save();
    carBodyPath(ctx, 0, 0, L, W, rF, rR); ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(3, W * 0.34); ctx.lineTo(L - 3, W * 0.34); ctx.stroke();
    ctx.strokeStyle = "rgba(10,8,18,0.18)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(3, W * 0.68); ctx.lineTo(L - 3, W * 0.68); ctx.stroke();
    // séparations capot / cabine / coffre
    ctx.strokeStyle = "rgba(12,9,20,0.32)"; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(c0 - 1, 1.5); ctx.lineTo(c0 - 1, W - 1.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c1 + 1, 1.5); ctx.lineTo(c1 + 1, W - 1.5); ctx.stroke();
    ctx.restore();

    /* ---------- toit + vitres ---------- */
    // bloc cabine (toit)
    const roofG = ctx.createLinearGradient(0, 1, 0, W - 1);
    roofG.addColorStop(0, U.shade(body, 0.12));
    roofG.addColorStop(0.5, U.shade(body, -0.06));
    roofG.addColorStop(1, U.shade(body, -0.24));
    ctx.fillStyle = roofG;
    roundRect(ctx, c0 + 2.5, 2.4, (c1 - c0) - 5, W - 4.8, 3.2); ctx.fill();
    ctx.strokeStyle = "rgba(12,9,20,0.4)"; ctx.lineWidth = 0.8;
    roundRect(ctx, c0 + 2.5, 2.4, (c1 - c0) - 5, W - 4.8, 3.2); ctx.stroke();
    // pare-brise (avant = +x) et lunette arrière
    glass(ctx, c1 - 3.5, 2.6, 5.5, W - 5.2, 2);
    glass(ctx, c0 - 1.5, 2.8, 4.5, W - 5.6, 2);
    // vitres latérales
    glass(ctx, c0 + 3, 1.6, (c1 - c0) - 6, 2.4, 1);
    glass(ctx, c0 + 3, W - 4, (c1 - c0) - 6, 2.4, 1);

    /* ---------- pare-chocs avant / arrière ---------- */
    ctx.fillStyle = "#2a2d34";
    roundRect(ctx, L - 2.4, 3.5, 2.8, W - 7, 1.4); ctx.fill();
    roundRect(ctx, -0.4, 4, 2.4, W - 8, 1.4); ctx.fill();

    /* ---------- phares (halo) et feux arrière ---------- */
    ctx.fillStyle = "#fff4cf";
    roundRect(ctx, L - 3.4, 3.2, 2.2, 3, 1); ctx.fill();
    roundRect(ctx, L - 3.4, W - 6.2, 2.2, 3, 1); ctx.fill();
    ctx.fillStyle = "rgba(255,240,190,0.5)";
    ctx.beginPath(); ctx.arc(L - 2, 4.7, 2.4, 0, U.TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(L - 2, W - 4.7, 2.4, 0, U.TAU); ctx.fill();
    ctx.fillStyle = "#d0342b";
    roundRect(ctx, 0.2, 3.4, 1.8, 2.8, 0.8); ctx.fill();
    roundRect(ctx, 0.2, W - 6.2, 1.8, 2.8, 0.8); ctx.fill();

    /* ---------- rétroviseurs ---------- */
    ctx.fillStyle = dark;
    ctx.strokeStyle = INK; ctx.lineWidth = 0.7;
    roundRect(ctx, c1 - 2, -1.4, 3, 2, 0.8); ctx.fill(); ctx.stroke();
    roundRect(ctx, c1 - 2, W - 0.6, 3, 2, 0.8); ctx.fill(); ctx.stroke();

    /* ---------- contour encre général ---------- */
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
    carBodyPath(ctx, 0, 0, L, W, rF, rR); ctx.stroke();

    /* ---------- spécifiques par type ---------- */
    if (type === "taxi") {
      ctx.fillStyle = "#141018";
      roundRect(ctx, c0 + (c1 - c0) / 2 - 6, W / 2 - 3, 12, 6, 1.2); ctx.fill();
      ctx.fillStyle = "#ffd54a";
      ctx.font = "bold 5px 'Rubik',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("TAXI", c0 + (c1 - c0) / 2, W / 2 + 0.4);
      // damier sur les flancs
      ctx.fillStyle = "#141018";
      for (let i = 0; i < 6; i++) ctx.fillRect(6 + i * 5.5, i % 2 ? 0.6 : W - 2, 2.6, 1.4);
    }
    if (type === "police") {
      // livrée bicolore + toit bleu nuit
      ctx.fillStyle = "#22345c";
      roundRect(ctx, c0 + 3, 3, (c1 - c0) - 6, W - 6, 2.5); ctx.fill();
      ctx.fillStyle = "#1c2c4c";
      ctx.fillRect(3, 1, L - 6, 3.2);
      ctx.fillRect(3, W - 4.2, L - 6, 3.2);
      // barre de gyrophares sur le toit
      ctx.fillStyle = "#101018";
      roundRect(ctx, L * 0.5 - 5, W / 2 - 2.6, 10, 5.2, 1); ctx.fill();
      ctx.fillStyle = "#ff3b3b"; roundRect(ctx, L * 0.5 - 4.4, W / 2 - 2, 4, 4, 0.8); ctx.fill();
      ctx.fillStyle = "#3b8bff"; roundRect(ctx, L * 0.5 + 0.4, W / 2 - 2, 4, 4, 0.8); ctx.fill();
      ctx.fillStyle = "#ffc857";
      ctx.font = "bold 5px 'Rubik',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("警", L * 0.28, W / 2 + 0.4);
    }
    if (type === "sport") {
      // aileron arrière + supports
      ctx.fillStyle = darker;
      roundRect(ctx, -0.5, 1.5, 4.5, W - 3, 1.2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1;
      roundRect(ctx, -0.5, 1.5, 4.5, W - 3, 1.2); ctx.stroke();
      ctx.fillStyle = "#101018";
      ctx.fillRect(3.5, W * 0.32, 2, 1.6); ctx.fillRect(3.5, W * 0.62, 2, 1.6);
      // bandes de course centrales
      ctx.fillStyle = "rgba(248,244,236,0.9)";
      ctx.fillRect(6, W / 2 - 3.4, L - 12, 2.2);
      ctx.fillRect(6, W / 2 + 1.2, L - 12, 2.2);
      // prise d'air sur le capot
      ctx.fillStyle = "rgba(10,8,18,0.45)";
      roundRect(ctx, c1 + 2, W / 2 - 2, 4, 4, 1); ctx.fill();
    }
    if (type === "van") {
      // compartiment de charge nervuré
      ctx.fillStyle = U.shade(body, -0.1);
      roundRect(ctx, 3.5, 3.5, L * 0.44, W - 7, 2); ctx.fill();
      ctx.strokeStyle = "rgba(12,9,20,0.35)"; ctx.lineWidth = 0.7;
      for (let i = 1; i < 4; i++) {
        const lx = 3.5 + (L * 0.44) * (i / 4);
        ctx.beginPath(); ctx.moveTo(lx, 4); ctx.lineTo(lx, W - 4); ctx.stroke();
      }
      roundRect(ctx, 3.5, 3.5, L * 0.44, W - 7, 2); ctx.stroke();
    }
    if (type === "pickup") {
      // benne ouverte avec bords
      const bg2 = ctx.createLinearGradient(0, 2, 0, W - 2);
      bg2.addColorStop(0, U.shade(body, -0.12));
      bg2.addColorStop(1, U.shade(body, -0.38));
      ctx.fillStyle = bg2;
      roundRect(ctx, 2.5, 3, L * 0.34, W - 6, 1.5); ctx.fill();
      ctx.fillStyle = "rgba(8,6,14,0.4)";
      roundRect(ctx, 4, 4.4, L * 0.34 - 3, W - 8.8, 1); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1;
      roundRect(ctx, 2.5, 3, L * 0.34, W - 6, 1.5); ctx.stroke();
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

      // bandeau de finition (corniche colorée près du toit)
      if (opt.trim) {
        const r0 = 0.83, r1 = 0.92;
        ctx.fillStyle = opt.trim;
        ctx.beginPath();
        ctx.moveTo(a.x + (ta.x - a.x) * r0, a.y + (ta.y - a.y) * r0);
        ctx.lineTo(b.x + (tb.x - b.x) * r0, b.y + (tb.y - b.y) * r0);
        ctx.lineTo(b.x + (tb.x - b.x) * r1, b.y + (tb.y - b.y) * r1);
        ctx.lineTo(a.x + (ta.x - a.x) * r1, a.y + (ta.y - a.y) * r1);
        ctx.closePath();
        ctx.fill();
      }

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

      // fenêtres : véritable grille étage × colonne, allumées/éteintes
      // au hasard (déterministe) pour casser la monotonie des façades
      if (opt.windows) {
        const rows = Math.max(1, opt.floors || 3);
        const cols = Math.max(2, Math.round(U.dist(a.x, a.y, b.x, b.y) / 24));
        ctx.strokeStyle = "rgba(15,12,20,0.35)"; ctx.lineWidth = 1;
        for (let ri = 0; ri < rows; ri++) {
          const r0 = ri / rows + 0.10 / rows, r1 = (ri + 1) / rows - 0.28 / rows;
          const blx = a.x + (ta.x - a.x) * r0, bly = a.y + (ta.y - a.y) * r0;
          const brx = b.x + (tb.x - b.x) * r0, bry = b.y + (tb.y - b.y) * r0;
          const tlx = a.x + (ta.x - a.x) * r1, tly = a.y + (ta.y - a.y) * r1;
          const trx = b.x + (tb.x - b.x) * r1, try_ = b.y + (tb.y - b.y) * r1;
          for (let ci = 0; ci < cols; ci++) {
            const c0 = (ci + 0.22) / cols, c1 = (ci + 0.78) / cols;
            const p0x = blx + (brx - blx) * c0, p0y = bly + (bry - bly) * c0;
            const p1x = blx + (brx - blx) * c1, p1y = bly + (bry - bly) * c1;
            const p2x = tlx + (trx - tlx) * c1, p2y = tly + (try_ - tly) * c1;
            const p3x = tlx + (trx - tlx) * c0, p3y = tly + (try_ - tly) * c0;
            const lit = h2(a.x * 0.7 + ci * 13.7, a.y * 0.7 + ri * 29.3 + i * 5.1) > 0.8;
            ctx.fillStyle = lit ? "rgba(255,208,120,0.8)" : "rgba(35,58,78,0.58)";
            ctx.beginPath();
            ctx.moveTo(p0x, p0y); ctx.lineTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.lineTo(p3x, p3y);
            ctx.closePath(); ctx.fill(); ctx.stroke();
          }
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
  const PSS = 2; // suréchantillonnage : quelques portraits seulement,
                 // le coût mémoire est négligeable et le gain de netteté
                 // très visible en gros plan de dialogue.

  /* ---------- système de visage détaillé ---------- */

  function headPath(g, cx, cy, rw, rh) {
    g.beginPath();
    g.moveTo(cx - rw, cy - rh * 0.32);
    g.quadraticCurveTo(cx - rw, cy - rh, cx, cy - rh);
    g.quadraticCurveTo(cx + rw, cy - rh, cx + rw, cy - rh * 0.32);
    g.quadraticCurveTo(cx + rw, cy + rh * 0.5, cx + rw * 0.52, cy + rh * 0.9);
    g.quadraticCurveTo(cx, cy + rh * 1.06, cx - rw * 0.52, cy + rh * 0.9);
    g.quadraticCurveTo(cx - rw, cy + rh * 0.5, cx - rw, cy - rh * 0.32);
    g.closePath();
  }

  // visage : peau + modelé (lumière en haut-gauche), oreilles, cou
  function drawFace(g, cx, cy, rw, rh, skin, opt) {
    opt = opt || {};
    const shadow = U.shade(skin, -0.24), lit = U.shade(skin, 0.14);
    // cou
    g.fillStyle = shadow;
    g.beginPath();
    g.moveTo(cx - 9, cy + rh * 0.7); g.lineTo(cx - 8, cy + rh + 8);
    g.lineTo(cx + 8, cy + rh + 8); g.lineTo(cx + 9, cy + rh * 0.7);
    g.closePath(); g.fill();
    g.fillStyle = skin;
    g.fillRect(cx - 8, cy + rh * 0.7, 16, 6);
    // oreilles
    for (const s of [-1, 1]) {
      g.fillStyle = s < 0 ? skin : shadow;
      g.beginPath(); g.ellipse(cx + s * (rw - 1), cy + 2, 3.6, 5.2, 0, 0, U.TAU); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
      g.strokeStyle = U.shade(skin, -0.3); g.lineWidth = 1;
      g.beginPath(); g.arc(cx + s * (rw - 1.5), cy + 2, 2, -Math.PI / 2, Math.PI / 2); g.stroke();
    }
    // tête
    headPath(g, cx, cy, rw, rh);
    g.fillStyle = skin; g.fill();
    // modelé
    g.save(); headPath(g, cx, cy, rw, rh); g.clip();
    const rg = g.createRadialGradient(cx - rw * 0.4, cy - rh * 0.5, 4, cx, cy + rh * 0.2, rh * 1.5);
    rg.addColorStop(0, lit); rg.addColorStop(0.5, skin); rg.addColorStop(1, shadow);
    g.fillStyle = rg; g.fillRect(cx - rw - 2, cy - rh - 2, rw * 2 + 4, rh * 2.3 + 4);
    // ombre de la joue droite + mâchoire
    g.fillStyle = "rgba(40,20,20,0.14)";
    g.beginPath(); g.ellipse(cx + rw * 0.55, cy + rh * 0.25, rw * 0.5, rh * 0.55, 0, 0, U.TAU); g.fill();
    // pommettes (léger rose)
    if (opt.blush) {
      g.fillStyle = "rgba(220,110,90,0.22)";
      g.beginPath(); g.ellipse(cx - rw * 0.55, cy + rh * 0.28, 4, 3, 0, 0, U.TAU); g.fill();
      g.beginPath(); g.ellipse(cx + rw * 0.55, cy + rh * 0.28, 4, 3, 0, 0, U.TAU); g.fill();
    }
    g.restore();
    // contour
    headPath(g, cx, cy, rw, rh);
    g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
  }

  // œil détaillé : blanc amande, iris, pupille, reflet, paupière
  function drawEye(g, ex, ey, w, h, iris, squint) {
    g.save();
    // orbite (blanc)
    g.fillStyle = "#f6f1e6";
    g.beginPath(); g.ellipse(ex, ey, w, squint ? h * 0.6 : h, 0, 0, U.TAU); g.fill();
    g.beginPath(); g.ellipse(ex, ey, w, squint ? h * 0.6 : h, 0, 0, U.TAU); g.clip();
    // iris
    g.fillStyle = iris || "#5a3a24";
    g.beginPath(); g.arc(ex + 0.4, ey + 0.6, h * 0.92, 0, U.TAU); g.fill();
    g.fillStyle = U.shade(iris || "#5a3a24", -0.3);
    g.beginPath(); g.arc(ex + 0.4, ey + 0.6, h * 0.92, Math.PI * 0.1, Math.PI * 0.9); g.fill();
    // pupille
    g.fillStyle = "#120e0d";
    g.beginPath(); g.arc(ex + 0.4, ey + 0.6, h * 0.44, 0, U.TAU); g.fill();
    // reflet
    g.fillStyle = "rgba(255,255,255,0.92)";
    g.beginPath(); g.arc(ex - 0.8, ey - 0.7, h * 0.24, 0, U.TAU); g.fill();
    g.restore();
    // paupière supérieure (trait épais)
    g.strokeStyle = INK; g.lineWidth = 1.7;
    g.beginPath(); g.ellipse(ex, ey, w + 0.4, (squint ? h * 0.6 : h) + 0.4, 0, Math.PI * 1.02, Math.PI * 1.98); g.stroke();
    // cerne inférieur léger
    g.strokeStyle = "rgba(90,50,40,0.35)"; g.lineWidth = 1;
    g.beginPath(); g.ellipse(ex, ey, w, (squint ? h * 0.6 : h), 0, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
  }

  function drawBrow(g, cx, browY, spread, thick, angle, color) {
    g.fillStyle = color || "#2a1c12";
    for (const s of [-1, 1]) {
      g.save();
      g.translate(cx + s * spread, browY);
      g.rotate(s * angle);
      g.beginPath();
      g.moveTo(-6, 1.5);
      g.quadraticCurveTo(0, -thick, 7, -0.5);
      g.quadraticCurveTo(1, thick * 0.5, -6, 3);
      g.closePath(); g.fill();
      g.restore();
    }
  }

  function drawNose(g, cx, noseY, skin) {
    g.strokeStyle = "rgba(70,40,30,0.4)"; g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(cx - 1.5, noseY - 5);
    g.quadraticCurveTo(cx - 2.5, noseY + 2, cx - 0.5, noseY + 3);
    g.stroke();
    // narine / base
    g.fillStyle = U.shade(skin, -0.2);
    g.beginPath(); g.ellipse(cx + 1, noseY + 3, 2.4, 1.6, 0, 0, U.TAU); g.fill();
    g.fillStyle = "rgba(255,240,220,0.4)";
    g.beginPath(); g.ellipse(cx - 2, noseY - 1, 1.2, 3, -0.2, 0, U.TAU); g.fill();
  }

  // bouches expressives
  function drawMouth(g, cx, my, type) {
    g.strokeStyle = "#7a3b30"; g.lineWidth = 2; g.lineCap = "round";
    g.fillStyle = "#8a2f28";
    switch (type) {
      case "smirk":
        g.beginPath(); g.moveTo(cx - 7, my); g.quadraticCurveTo(cx + 2, my + 3, cx + 8, my - 2); g.stroke();
        break;
      case "smile":
        g.beginPath(); g.moveTo(cx - 8, my - 1);
        g.quadraticCurveTo(cx, my + 6, cx + 8, my - 1);
        g.quadraticCurveTo(cx, my + 2, cx - 8, my - 1); g.fill();
        g.strokeStyle = "#5a2a22"; g.beginPath();
        g.moveTo(cx - 8, my - 1); g.quadraticCurveTo(cx, my + 6, cx + 8, my - 1); g.stroke();
        break;
      case "grin":
        g.beginPath(); g.moveTo(cx - 9, my - 1);
        g.quadraticCurveTo(cx, my + 7, cx + 9, my - 1); g.lineTo(cx + 9, my - 1);
        g.quadraticCurveTo(cx, my + 1, cx - 9, my - 1); g.closePath();
        g.fillStyle = "#3a1512"; g.fill();
        g.fillStyle = "#f2ece0";
        g.beginPath(); g.moveTo(cx - 8, my); g.quadraticCurveTo(cx, my + 2.5, cx + 8, my); g.lineTo(cx + 7, my + 2.5);
        g.quadraticCurveTo(cx, my + 4.5, cx - 7, my + 2.5); g.closePath(); g.fill();
        g.strokeStyle = "#5a2a22"; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(cx - 9, my - 1); g.quadraticCurveTo(cx, my + 7, cx + 9, my - 1); g.stroke();
        break;
      case "snarl":
        g.beginPath(); g.moveTo(cx - 8, my - 2);
        g.quadraticCurveTo(cx, my - 5, cx + 8, my); g.lineTo(cx + 7, my + 3);
        g.quadraticCurveTo(cx, my + 1, cx - 7, my + 2); g.closePath();
        g.fillStyle = "#3a1512"; g.fill();
        g.fillStyle = "#eee6d8";
        g.fillRect(cx - 6, my - 3, 12, 2.6);
        g.strokeStyle = "#5a2a22"; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(cx - 8, my - 2); g.quadraticCurveTo(cx, my - 5, cx + 8, my); g.stroke();
        break;
      case "frown":
        g.beginPath(); g.moveTo(cx - 7, my + 2); g.quadraticCurveTo(cx, my - 2, cx + 7, my + 2); g.stroke();
        break;
      default: // neutral
        g.beginPath(); g.moveTo(cx - 7, my); g.quadraticCurveTo(cx, my + 1.5, cx + 7, my); g.stroke();
    }
    g.lineCap = "butt";
  }

  function drawShoulders(g, color, trim) {
    const grd = g.createLinearGradient(0, 72, 0, 96);
    grd.addColorStop(0, U.shade(color, 0.1)); grd.addColorStop(1, U.shade(color, -0.2));
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(6, 96); g.quadraticCurveTo(12, 74, 30, 71);
    g.lineTo(66, 71); g.quadraticCurveTo(84, 74, 90, 96);
    g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
    if (trim) {
      g.strokeStyle = trim; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(34, 74); g.lineTo(48, 88); g.lineTo(62, 74); g.stroke();
    }
  }

  function portraitBg(g, id) {
    const themes = {
      jin: ["#0d4a38", "#072920"], wu: ["#4a3810", "#2a1f08"],
      shark: ["#0d3a44", "#07222a"], cop: ["#1a2c52", "#0d1830"],
      long: ["#3a2a1a", "#22160c"], lotus: ["#2e1a3a", "#170d20"]
    };
    const [c1, c2] = themes[id] || themes.lotus;
    const rg = g.createRadialGradient(48, 40, 6, 48, 60, 80);
    rg.addColorStop(0, c1); rg.addColorStop(1, c2);
    g.fillStyle = rg; g.fillRect(0, 0, 96, 96);
    // rayons « soleil levant »
    g.save(); g.beginPath(); g.rect(0, 0, 96, 96); g.clip();
    g.strokeStyle = "rgba(255,220,140,0.07)"; g.lineWidth = 7;
    for (let i = 0; i < 9; i++) {
      g.beginPath(); g.moveTo(48, 104);
      const a = Math.PI + (i / 8) * Math.PI;
      g.lineTo(48 + Math.cos(a) * 150, 104 + Math.sin(a) * 150); g.stroke();
    }
    g.restore();
    // vignette
    const vg = g.createRadialGradient(48, 48, 30, 48, 48, 62);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.4)");
    g.fillStyle = vg; g.fillRect(0, 0, 96, 96);
  }

  function portrait(id) {
    let c = portraitCache.get(id);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = 96 * PSS; c.height = 96 * PSS;
    const g = c.getContext("2d");
    g.scale(PSS, PSS);
    g.lineJoin = "round";

    portraitBg(g, id);

    const CX = 48;

    if (id === "jin") {
      drawShoulders(g, "#1f9c72", "#ffc857");
      // col de veste jade
      g.fillStyle = "#0f7a55";
      g.beginPath(); g.moveTo(38, 96); g.lineTo(44, 76); g.lineTo(52, 76); g.lineTo(58, 96); g.closePath(); g.fill();
      drawFace(g, CX, 46, 21, 25, "#e8b48c");
      drawBrow(g, CX, 35, 10, 4, 0.05, "#14100f");
      drawEye(g, CX - 9, 44, 4.4, 4, "#3a2718");
      drawEye(g, CX + 9, 44, 4.4, 4, "#3a2718");
      drawNose(g, CX, 50, "#e8b48c");
      drawMouth(g, CX, 60, "smirk");
      // cheveux : undercut avec mèches en pointe
      g.fillStyle = "#16140f";
      g.beginPath();
      g.moveTo(26, 42); g.quadraticCurveTo(24, 18, 48, 16);
      g.quadraticCurveTo(72, 18, 70, 42);
      g.quadraticCurveTo(64, 30, 56, 30);
      g.quadraticCurveTo(58, 24, 50, 26);
      g.quadraticCurveTo(46, 22, 42, 27);
      g.quadraticCurveTo(38, 24, 36, 30);
      g.quadraticCurveTo(30, 30, 26, 42);
      g.closePath(); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
      // reflet cheveux
      g.strokeStyle = "rgba(120,140,160,0.35)"; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(34, 24); g.quadraticCurveTo(44, 19, 54, 22); g.stroke();
      // oreillette dorée
      g.fillStyle = "#ffc857"; g.strokeStyle = INK; g.lineWidth = 1;
      g.beginPath(); g.arc(69, 48, 3, 0, U.TAU); g.fill(); g.stroke();
      g.strokeStyle = "#ffc857"; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(69, 51); g.quadraticCurveTo(66, 58, 60, 60); g.stroke();

    } else if (id === "wu") {
      drawShoulders(g, "#5c5568", "#ffc857");
      // col mandarin
      g.fillStyle = "#3a3646";
      g.beginPath(); g.moveTo(34, 96); g.lineTo(40, 74); g.lineTo(56, 74); g.lineTo(62, 96); g.closePath(); g.fill();
      g.strokeStyle = "#ffc857"; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(48, 74); g.lineTo(48, 90); g.stroke();
      drawFace(g, CX, 45, 20, 24, "#d9a878", { blush: true });
      // rides du front
      g.strokeStyle = "rgba(120,80,50,0.3)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(38, 30); g.quadraticCurveTo(48, 27, 58, 30); g.stroke();
      drawBrow(g, CX, 35, 10, 5, -0.1, "#c8c4bc");
      drawEye(g, CX - 9, 44, 4, 3, "#4a3826", true);
      drawEye(g, CX + 9, 44, 4, 3, "#4a3826", true);
      drawNose(g, CX, 50, "#d9a878");
      drawMouth(g, CX, 59, "smile");
      // moustache tombante
      g.fillStyle = "#c8c4bc";
      g.beginPath();
      g.moveTo(40, 57); g.quadraticCurveTo(48, 61, 56, 57);
      g.quadraticCurveTo(58, 64, 53, 68); g.quadraticCurveTo(48, 60, 43, 68);
      g.quadraticCurveTo(38, 64, 40, 57); g.closePath(); g.fill(); g.stroke();
      // barbiche
      g.fillStyle = "#c8c4bc";
      g.beginPath(); g.moveTo(43, 66); g.quadraticCurveTo(48, 82, 53, 66);
      g.quadraticCurveTo(48, 70, 43, 66); g.closePath(); g.fill(); g.stroke();
      // calotte / crâne dégarni + cheveux gris sur les côtés
      g.fillStyle = "#d9a878";
      g.beginPath(); g.ellipse(CX, 30, 20, 15, 0, Math.PI, 0); g.fill();
      headPath(g, CX, 45, 20, 24); g.save(); g.clip();
      g.fillStyle = "#c8c4bc";
      g.beginPath(); g.ellipse(28, 40, 6, 12, 0.3, 0, U.TAU); g.fill();
      g.beginPath(); g.ellipse(68, 40, 6, 12, -0.3, 0, U.TAU); g.fill();
      g.restore();
      // calotte de soie
      g.fillStyle = "#2c2c38";
      g.beginPath(); g.ellipse(CX, 26, 17, 8, 0, Math.PI, 0); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = "#ffc857";
      g.beginPath(); g.arc(CX, 20, 2.6, 0, U.TAU); g.fill(); g.stroke();

    } else if (id === "shark") {
      drawShoulders(g, "#158fa0");
      // fermeture éclair
      g.strokeStyle = "#0a5560"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(48, 74); g.lineTo(48, 96); g.stroke();
      drawFace(g, CX, 46, 21, 24, "#c68e5f");
      drawBrow(g, CX, 36, 10, 5, -0.28, "#181410");
      drawEye(g, CX - 9, 44, 4, 3.4, "#2a4a52");
      drawEye(g, CX + 9, 44, 4, 3.4, "#2a4a52");
      drawNose(g, CX, 50, "#c68e5f");
      drawMouth(g, CX, 60, "snarl");
      // barbe naissante
      g.save(); headPath(g, CX, 46, 21, 24); g.clip();
      g.fillStyle = "rgba(20,16,14,0.25)";
      g.fillRect(30, 54, 36, 20);
      g.restore();
      // cicatrice sur l'œil
      g.strokeStyle = "#9a5a3a"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(58, 36); g.lineTo(62, 52); g.stroke();
      g.strokeStyle = "rgba(255,220,200,0.4)"; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(59, 37); g.lineTo(63, 51); g.stroke();
      // bandana requin
      g.fillStyle = "#0d6b78";
      g.beginPath();
      g.moveTo(25, 40); g.quadraticCurveTo(48, 20, 71, 40);
      g.lineTo(71, 30); g.quadraticCurveTo(48, 12, 25, 30);
      g.closePath(); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.8; g.stroke();
      g.fillStyle = U.shade("#0d6b78", 0.12);
      g.fillRect(25, 30, 46, 3);
      // dents de requin peintes
      g.fillStyle = "#eaf6f8";
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.moveTo(31 + i * 8, 38); g.lineTo(35 + i * 8, 30); g.lineTo(39 + i * 8, 38);
        g.closePath(); g.fill();
      }
      // nœud du bandana
      g.fillStyle = "#0d6b78"; g.strokeStyle = INK; g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(70, 34, 4, 3, 0.4, 0, U.TAU); g.fill(); g.stroke();

    } else if (id === "cop") {
      drawShoulders(g, "#2b4c7e", "#ffc857");
      // insigne
      g.fillStyle = "#ffc857";
      g.beginPath(); g.arc(34, 84, 4, 0, U.TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
      drawFace(g, CX, 47, 20, 23, "#e6c39a");
      drawBrow(g, CX, 38, 10, 4, -0.05, "#3a2a1a");
      drawNose(g, CX, 51, "#e6c39a");
      drawMouth(g, CX, 60, "neutral");
      // lunettes aviateur
      g.fillStyle = "#14181f"; g.strokeStyle = "#2a2f38"; g.lineWidth = 1.4;
      for (const s of [-1, 1]) {
        g.beginPath(); g.ellipse(CX + s * 9, 45, 6, 5, 0, 0, U.TAU); g.fill(); g.stroke();
        g.fillStyle = "rgba(120,180,220,0.35)";
        g.beginPath(); g.ellipse(CX + s * 9 - 1.5, 43, 2, 2.5, 0, 0, U.TAU); g.fill();
        g.fillStyle = "#14181f";
      }
      g.strokeStyle = "#2a2f38"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(CX - 3, 44); g.lineTo(CX + 3, 44); g.stroke();
      // casquette de police
      g.fillStyle = "#22304a";
      g.beginPath(); g.ellipse(CX, 30, 22, 12, 0, Math.PI, 0); g.fill();
      g.fillStyle = "#1a2740";
      g.beginPath(); g.ellipse(CX, 32, 24, 6, 0, 0, Math.PI); g.fill(); // visière
      g.strokeStyle = INK; g.lineWidth = 1.8;
      g.beginPath(); g.ellipse(CX, 30, 22, 12, 0, Math.PI, 0); g.stroke();
      g.beginPath(); g.ellipse(CX, 32, 24, 6, 0, 0, Math.PI); g.stroke();
      // bandeau + écusson
      g.fillStyle = "#14203a"; g.fillRect(CX - 22, 30, 44, 4);
      g.fillStyle = "#ffc857"; g.strokeStyle = INK; g.lineWidth = 1;
      g.beginPath();
      g.moveTo(CX, 20); g.lineTo(CX + 4, 24); g.lineTo(CX + 3, 29);
      g.lineTo(CX - 3, 29); g.lineTo(CX - 4, 24); g.closePath(); g.fill(); g.stroke();

    } else if (id === "long") {
      drawShoulders(g, "#3d4a5c", "#8a3324");
      // bavette de salopette
      g.fillStyle = "#4f6a8a";
      g.beginPath(); g.moveTo(38, 96); g.lineTo(40, 76); g.lineTo(56, 76); g.lineTo(58, 96); g.closePath(); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
      g.fillStyle = "#c8a24a";
      g.fillRect(42, 78, 3, 3); g.fillRect(51, 78, 3, 3); // boutons
      drawFace(g, CX, 47, 21, 24, "#c68e5f");
      drawBrow(g, CX, 37, 10, 4.5, 0.02, "#241810");
      drawEye(g, CX - 9, 45, 4.2, 3.6, "#2e2014");
      drawEye(g, CX + 9, 45, 4.2, 3.6, "#2e2014");
      drawNose(g, CX, 51, "#c68e5f");
      drawMouth(g, CX, 61, "grin");
      // barbe de trois jours
      g.save(); headPath(g, CX, 47, 21, 24); g.clip();
      g.fillStyle = "rgba(30,20,12,0.28)";
      g.fillRect(28, 56, 40, 20);
      // tache de cambouis
      g.fillStyle = "rgba(20,16,20,0.4)";
      g.beginPath(); g.ellipse(62, 56, 4, 2.5, 0.5, 0, U.TAU); g.fill();
      g.restore();
      // cheveux courts
      g.fillStyle = "#241810";
      g.beginPath();
      g.moveTo(27, 40); g.quadraticCurveTo(26, 22, 48, 20);
      g.quadraticCurveTo(70, 22, 69, 40);
      g.quadraticCurveTo(62, 32, 48, 32);
      g.quadraticCurveTo(34, 32, 27, 40);
      g.closePath(); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
      // casquette relevée (rouge atelier)
      g.fillStyle = "#8a3324";
      g.beginPath(); g.ellipse(CX, 26, 19, 9, 0, Math.PI, 0); g.fill();
      g.fillStyle = "#a53c2a";
      g.beginPath(); g.ellipse(CX, 22, 14, 7, 0, Math.PI, 0); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.6;
      g.beginPath(); g.ellipse(CX, 26, 19, 9, 0, Math.PI, 0); g.stroke();

    } else { // lotus (exécuteur) / défaut
      drawShoulders(g, "#23202b", "#ffc857");
      // cravate dorée
      g.fillStyle = "#141119";
      g.beginPath(); g.moveTo(40, 76); g.lineTo(48, 84); g.lineTo(56, 76); g.closePath(); g.fill();
      g.fillStyle = "#ffc857";
      g.beginPath(); g.moveTo(46, 80); g.lineTo(50, 80); g.lineTo(52, 96); g.lineTo(44, 96); g.closePath(); g.fill();
      drawFace(g, CX, 46, 20, 24, "#e8b48c");
      drawBrow(g, CX, 36, 10, 4, -0.15, "#0e0c0a");
      drawEye(g, CX - 9, 44, 4, 3.4, "#241a12");
      drawEye(g, CX + 9, 44, 4, 3.4, "#241a12");
      drawNose(g, CX, 50, "#e8b48c");
      drawMouth(g, CX, 60, "neutral");
      // cheveux gominés en arrière
      g.fillStyle = "#0e0c0a";
      g.beginPath();
      g.moveTo(27, 44); g.quadraticCurveTo(25, 18, 48, 16);
      g.quadraticCurveTo(71, 18, 69, 44);
      g.quadraticCurveTo(64, 30, 48, 30);
      g.quadraticCurveTo(32, 30, 27, 44);
      g.closePath(); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
      // raies gominées
      g.strokeStyle = "rgba(90,90,110,0.4)"; g.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        g.beginPath(); g.moveTo(48 + i * 7, 18); g.quadraticCurveTo(48 + i * 9, 26, 48 + i * 6, 30); g.stroke();
      }
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
