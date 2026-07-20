/* ============================================================
   JADE HARBOR — textures.js
   Moteur de textures PARAMÉTRIQUE. Chaque surface (route, dalle,
   herbe, sable, bois…) est décrite par un MATÉRIAU = une pile de
   COUCHES, chacune avec ses valeurs (densité, tons, tailles,
   angles…). `paintTile()` compose ces couches de façon
   déterministe (graine = coordonnées de tuile) sur le canvas de
   chunk, qui est mis en cache : le coût de détail est amorti.
   Ajouter/varier une texture = éditer ses valeurs, pas le moteur.
   ============================================================ */
"use strict";
(function (G) {

  const U = G.U;
  const TAU = Math.PI * 2;

  // PRNG déterministe par tuile + sel de couche (re-bake identique)
  function seedRng(gx, gy, salt) {
    let s = (gx * 374761393 + gy * 668265263 + salt * 2246822519) | 0;
    return function () {
      s = Math.imul(s ^ (s >>> 15), 2246822519);
      s = Math.imul(s ^ (s >>> 13), 3266489917);
      s = (s ^ (s >>> 16)) >>> 0;
      return s / 4294967296;
    };
  }
  const pick = (r, arr) => arr[(r() * arr.length) | 0];
  const rr = (r, a, b) => a + r() * (b - a);

  // moyenne de deux couleurs hex (pour un aplat de base bon marché)
  const _mixCache = {};
  function mixHex(a, b) {
    const k = a + b; if (_mixCache[k]) return _mixCache[k];
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = ((pa >> 16 & 255) + (pb >> 16 & 255)) >> 1;
    const g = ((pa >> 8 & 255) + (pb >> 8 & 255)) >> 1;
    const bl = ((pa & 255) + (pb & 255)) >> 1;
    const out = "#" + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
    _mixCache[k] = out; return out;
  }

  /* =========================================================
     PRIMITIVES DE COUCHE — chacune paramétrée par « plusieurs
     valeurs ». (ctx est déjà translaté : dessin en 0..w, 0..h.)
     ========================================================= */

  const LAYERS = {

    // aplat (bon marché) + variation tonale par plaques. Le dégradé
    // par tuile a été retiré (256 gradients/chunk = trop lent au bake) ;
    // l'aplat prend la teinte moyenne du dégradé.
    base(ctx, w, h, r, L) {
      ctx.fillStyle = L.color || (L.grad ? mixHex(L.grad[0], L.grad[1]) : "#000");
      ctx.fillRect(0, 0, w, h);
      if (L.vary) {
        for (let i = 0; i < L.vary; i++) {
          ctx.fillStyle = pick(r, L.varyColors);
          ctx.globalAlpha = L.varyA != null ? L.varyA : 0.10;
          ctx.beginPath();
          ctx.ellipse(rr(r, 0, w), rr(r, 0, h), rr(r, w * 0.2, w * 0.5),
                      rr(r, h * 0.18, h * 0.42), rr(r, 0, TAU), 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    },

    // mouchetis / grains : petites taches multi-tons (aggrégat, sable…)
    speckle(ctx, w, h, r, L) {
      const n = L.n | 0;
      const a = L.a != null ? L.a : 1;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = pick(r, L.colors);
        ctx.globalAlpha = a * (L.aVar ? rr(r, 0.4, 1) : 1);
        const rad = rr(r, L.r[0], L.r[1]);
        const x = rr(r, 0, w), y = rr(r, 0, h);
        if (L.square) ctx.fillRect(x, y, rad, rad);
        else { ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    },

    // brins (herbe) : petits traits orientés, plusieurs verts
    blades(ctx, w, h, r, L) {
      ctx.lineWidth = L.width || 1;
      const n = L.n | 0;
      for (let i = 0; i < n; i++) {
        ctx.strokeStyle = pick(r, L.colors);
        const x = rr(r, 0, w), y = rr(r, 0, h);
        const len = rr(r, L.len[0], L.len[1]);
        const lean = rr(r, -L.lean, L.lean);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + lean * 0.5, y - len * 0.6, x + lean, y - len);
        ctx.stroke();
      }
    },

    // joints biseautés : dalles / briques / chevrons, avec liseré clair/sombre
    joints(ctx, w, h, r, L) {
      const rows = L.rows || 4, cols = L.cols || 4;
      const cw = w / cols, ch = h / rows;
      ctx.lineWidth = L.width || 1;
      for (let ri = 0; ri < rows; ri++) {
        const off = (L.brick && (ri & 1)) ? cw * 0.5 : 0;
        // ligne horizontale (mortier) + biseau
        ctx.strokeStyle = L.dark;
        ctx.beginPath(); ctx.moveTo(0, ri * ch + 0.5); ctx.lineTo(w, ri * ch + 0.5); ctx.stroke();
        if (L.light) {
          ctx.strokeStyle = L.light;
          ctx.beginPath(); ctx.moveTo(0, ri * ch + 1.5); ctx.lineTo(w, ri * ch + 1.5); ctx.stroke();
        }
        for (let ci = 0; ci <= cols; ci++) {
          let x = ci * cw + off;
          if (x > w + 0.1) x -= w;
          ctx.strokeStyle = L.dark;
          ctx.beginPath(); ctx.moveTo(x + 0.5, ri * ch); ctx.lineTo(x + 0.5, ri * ch + ch); ctx.stroke();
          if (L.light) {
            ctx.strokeStyle = L.light;
            ctx.beginPath(); ctx.moveTo(x + 1.5, ri * ch); ctx.lineTo(x + 1.5, ri * ch + ch); ctx.stroke();
          }
        }
      }
    },

    // chevrons (pavés en épi) : coins alternés
    herringbone(ctx, w, h, r, L) {
      const s = L.size || 12;
      ctx.strokeStyle = L.dark; ctx.lineWidth = L.width || 1;
      for (let y = -s; y < h + s; y += s) {
        for (let x = -s; x < w + s; x += s) {
          const flip = (((x / s) | 0) + ((y / s) | 0)) & 1;
          ctx.beginPath();
          if (flip) { ctx.moveTo(x, y); ctx.lineTo(x + s, y + s); }
          else { ctx.moveTo(x + s, y); ctx.lineTo(x, y + s); }
          ctx.stroke();
        }
      }
    },

    // planches (bois) : nervures verticales/horizontales + veinage + clous
    planks(ctx, w, h, r, L) {
      const dir = L.dir || "h";
      const n = L.n || 3;
      ctx.lineWidth = L.width || 1;
      const along = dir === "h" ? h : w;
      for (let i = 1; i < n; i++) {
        ctx.strokeStyle = L.joint;
        const p = (along / n) * i;
        ctx.beginPath();
        if (dir === "h") { ctx.moveTo(0, p); ctx.lineTo(w, p); }
        else { ctx.moveTo(p, 0); ctx.lineTo(p, h); }
        ctx.stroke();
      }
      // veinage
      if (L.grain) {
        ctx.strokeStyle = L.grain; ctx.lineWidth = 0.5;
        for (let i = 0; i < (L.grainN || 4); i++) {
          const g = rr(r, 0, along);
          ctx.beginPath();
          if (dir === "h") { ctx.moveTo(0, g); ctx.bezierCurveTo(w * 0.3, g + rr(r, -2, 2), w * 0.6, g + rr(r, -2, 2), w, g); }
          else { ctx.moveTo(g, 0); ctx.bezierCurveTo(g + rr(r, -2, 2), h * 0.3, g + rr(r, -2, 2), h * 0.6, g, h); }
          ctx.stroke();
        }
      }
      // clous
      if (L.nails) {
        ctx.fillStyle = L.nailColor || "rgba(30,26,22,0.6)";
        for (let i = 1; i < n; i++) {
          const p = (along / n) * i;
          for (const t of [0.18, 0.82]) {
            const x = dir === "h" ? w * t : p;
            const y = dir === "h" ? p : h * t;
            ctx.beginPath(); ctx.arc(x, y, 0.9, 0, TAU); ctx.fill();
          }
        }
      }
      // nœuds
      if (L.knots && r() < L.knots) {
        ctx.strokeStyle = L.grain || "rgba(60,40,20,0.4)"; ctx.lineWidth = 0.8;
        const kx = rr(r, w * 0.2, w * 0.8), ky = rr(r, h * 0.2, h * 0.8);
        ctx.beginPath(); ctx.ellipse(kx, ky, 2.5, 1.6, rr(r, 0, TAU), 0, TAU); ctx.stroke();
      }
    },

    // fissures ramifiées (asphalte, béton)
    cracks(ctx, w, h, r, L) {
      if (r() > (L.chance != null ? L.chance : 1)) return;
      const n = L.n || 1;
      ctx.strokeStyle = L.color; ctx.lineWidth = L.width || 0.8;
      for (let k = 0; k < n; k++) {
        let x = rr(r, 0, w), y = rr(r, 0, h);
        let a = rr(r, 0, TAU);
        const seg = L.seg || 5;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let i = 0; i < seg; i++) {
          a += rr(r, -0.7, 0.7);
          x += Math.cos(a) * rr(r, 2, L.len || 6);
          y += Math.sin(a) * rr(r, 2, L.len || 6);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },

    // taches douces (huile, humidité, mousse)
    stain(ctx, w, h, r, L) {
      if (r() > (L.chance != null ? L.chance : 1)) return;
      const n = L.n || 1;
      for (let i = 0; i < n; i++) {
        const x = rr(r, 0, w), y = rr(r, 0, h);
        const rad = rr(r, L.r[0], L.r[1]);
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, L.color);
        g.addColorStop(1, L.color.replace(/[\d.]+\)$/, "0)"));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
      }
    },

    // galets / graviers (chemins, plage)
    pebbles(ctx, w, h, r, L) {
      const n = L.n | 0;
      ctx.lineWidth = 0.5;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = pick(r, L.colors);
        const x = rr(r, 0, w), y = rr(r, 0, h);
        const rad = rr(r, L.r[0], L.r[1]);
        ctx.beginPath();
        ctx.ellipse(x, y, rad, rad * rr(r, 0.6, 0.95), rr(r, 0, TAU), 0, TAU);
        ctx.fill();
        if (L.shade) {
          ctx.strokeStyle = L.shade;
          ctx.beginPath(); ctx.arc(x, y, rad, 0.4, 2.2); ctx.stroke();
        }
      }
    },

    // stries / ondulations (rides du sable, reflets)
    ripples(ctx, w, h, r, L) {
      ctx.strokeStyle = L.color; ctx.lineWidth = L.width || 1;
      const n = L.n || 4;
      for (let i = 0; i < n; i++) {
        const y = rr(r, 0, h);
        const amp = rr(r, 1, L.amp || 3);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(w * 0.3, y - amp, w * 0.6, y + amp, w, y + rr(r, -amp, amp));
        ctx.stroke();
      }
    }
  };

  /* =========================================================
     MATÉRIAUX — la « donnée » de chaque texture (valeurs)
     ========================================================= */

  const MATERIALS = {
    grass: {
      layers: [
        { type: "base", grad: ["#83b25c", "#76a552"], vary: 2, varyColors: ["#6f9c4c", "#8dbb64", "#688f45"], varyA: 0.16 },
        { type: "speckle", n: 7, r: [0.5, 1.4], colors: ["#5e8a3f", "#9ac96e", "#c8d98a"], a: 0.5, aVar: true },
        { type: "blades", n: 10, colors: ["#5f9040", "#7cb156", "#4e7a34", "#96c96a"], len: [3, 7], lean: 2.2, width: 1 },
        { type: "speckle", n: 2, r: [0.8, 1.6], colors: ["#f4e6a0", "#e58fb1", "#f0f4e0"], a: 0.9 }, // fleurs
        { type: "stain", chance: 0.18, n: 1, r: [6, 12], color: "rgba(120,96,58,0.28)" }             // plaque de terre
      ]
    },
    sidewalk: {
      layers: [
        { type: "base", grad: ["#d4cbb8", "#c7bda8"], vary: 2, varyColors: ["#cdc3ad", "#dbd2bf"], varyA: 0.2 },
        { type: "joints", rows: 2, cols: 2, dark: "rgba(120,110,90,0.5)", light: "rgba(255,250,238,0.35)", width: 1 },
        { type: "speckle", n: 14, r: [0.4, 1.1], colors: ["#b7ad97", "#e6ddc9", "#8f866f"], a: 0.5, aVar: true },
        { type: "cracks", chance: 0.22, n: 1, len: 5, seg: 5, color: "rgba(90,82,66,0.4)", width: 0.7 },
        { type: "stain", chance: 0.14, n: 1, r: [5, 10], color: "rgba(70,64,52,0.22)" }
      ]
    },
    road: {
      layers: [
        { type: "base", grad: ["#3f434e", "#363a44"], vary: 2, varyColors: ["#3a3e48", "#43474f", "#33363e"], varyA: 0.22 },
        { type: "speckle", n: 22, r: [0.35, 1.0], colors: ["#4c515c", "#2b2e36", "#5a6069", "#3a3d45"], a: 0.55, aVar: true },
        { type: "cracks", chance: 0.14, n: 1, len: 7, seg: 6, color: "rgba(18,20,26,0.6)", width: 0.9 },
        { type: "stain", chance: 0.10, n: 1, r: [7, 13], color: "rgba(14,14,18,0.4)" }   // tache d'huile
      ]
    },
    plaza: {
      layers: [
        { type: "base", grad: ["#dccca8", "#cdbd98" ], vary: 2, varyColors: ["#d3c39f", "#e2d3af"], varyA: 0.18 },
        { type: "herringbone", size: 12, dark: "rgba(150,128,92,0.45)", width: 1 },
        { type: "speckle", n: 12, r: [0.4, 1.1], colors: ["#c3b18a", "#efe2bd", "#a99c88"], a: 0.45, aVar: true },
        { type: "stain", chance: 0.12, n: 1, r: [6, 11], color: "rgba(90,72,44,0.22)" }
      ]
    },
    path: {
      layers: [
        { type: "base", grad: ["#dcc493", "#cbb182"], vary: 2, varyColors: ["#d2b981", "#e2cc9a"], varyA: 0.2 },
        { type: "pebbles", n: 12, r: [0.7, 1.8], colors: ["#b49a6a", "#efe0b8", "#9c8258", "#c8b389"], shade: "rgba(90,72,44,0.3)" },
        { type: "speckle", n: 10, r: [0.4, 1.0], colors: ["#a98f60", "#f0e4c2"], a: 0.5, aVar: true }
      ]
    },
    sand: {
      layers: [
        { type: "base", grad: ["#ecd9a8", "#e2cd98"], vary: 2, varyColors: ["#e7d29f", "#f2e3ba", "#dcc68f"], varyA: 0.18 },
        { type: "ripples", n: 3, amp: 2.5, color: "rgba(200,176,120,0.35)", width: 1 },
        { type: "speckle", n: 18, r: [0.3, 0.9], colors: ["#c8ac74", "#fff4dc", "#b59a63", "#efe0bb"], a: 0.6, aVar: true },
        { type: "speckle", n: 2, r: [0.9, 1.6], colors: ["#fff8ea", "#e9b7a0"], a: 0.9 } // coquillages
      ]
    },
    dock: {
      layers: [
        { type: "base", grad: ["#a6a49a", "#95948b"], vary: 2, varyColors: ["#9d9c92", "#afaea3"], varyA: 0.16 },
        { type: "planks", dir: "h", n: 3, joint: "rgba(60,58,52,0.55)", grain: "rgba(70,64,54,0.3)", grainN: 2, nails: true, knots: 0.25 },
        { type: "speckle", n: 10, r: [0.4, 1.0], colors: ["#8c8b82", "#c0bfb4"], a: 0.4, aVar: true },
        { type: "stain", chance: 0.2, n: 1, r: [6, 12], color: "rgba(60,70,60,0.28)" } // mousse humide
      ]
    },
    building: {
      layers: [
        { type: "base", color: "#241f2e", vary: 2, varyColors: ["#2a2434", "#1e1a28"], varyA: 0.4 }
      ]
    },
    water: {
      layers: [
        { type: "base", grad: ["#16565f", "#124a52"], vary: 2, varyColors: ["#155159", "#1a5d66"], varyA: 0.2 }
      ]
    }
  };

  /* =========================================================
     COMPOSITION
     ========================================================= */

  function paintTile(ctx, px, py, w, h, gx, gy, name) {
    const mat = MATERIALS[name];
    if (!mat) { ctx.fillStyle = "#000"; ctx.fillRect(px, py, w, h); return; }
    ctx.save();
    ctx.translate(px, py);
    // clip pour que le détail ne déborde pas sur les tuiles voisines
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    const layers = mat.layers;
    for (let i = 0; i < layers.length; i++) {
      const L = layers[i];
      const fn = LAYERS[L.type];
      if (fn) fn(ctx, w, h, seedRng(gx, gy, i * 101 + 7), L);
    }
    ctx.restore();
  }

  G.Tex = { paintTile, MATERIALS, LAYERS, seedRng };

})(window.G);
