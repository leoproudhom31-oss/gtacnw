/* ============================================================
   JADE HARBOR — util.js
   Outils mathématiques, RNG déterministe, helpers géométrie.
   Espace de noms global : G
   ============================================================ */
"use strict";
window.G = window.G || {};

(function (G) {

  const TAU = Math.PI * 2;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // Interpolation exponentielle indépendante du framerate.
  function damp(a, b, k, dt) { return lerp(a, b, 1 - Math.exp(-k * dt)); }

  function dist(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function dist2(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    return dx * dx + dy * dy;
  }

  // Ramène un angle dans [-PI, PI]
  function wrapAngle(a) {
    a = a % TAU;
    if (a > Math.PI) a -= TAU;
    if (a < -Math.PI) a += TAU;
    return a;
  }
  function angleDiff(a, b) { return wrapAngle(b - a); }
  function angleLerp(a, b, t) { return a + angleDiff(a, b) * t; }
  function angleDamp(a, b, k, dt) { return a + angleDiff(a, b) * (1 - Math.exp(-k * dt)); }

  // RNG déterministe (mulberry32) — la ville est identique à chaque partie.
  function makeRng(seed) {
    let s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function rrange(rng, a, b) { return a + rng() * (b - a); }
  function rint(rng, a, b) { return Math.floor(rrange(rng, a, b + 1)); }

  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function pointInRect(px, py, x, y, w, h) {
    return px >= x && px < x + w && py >= y && py < y + h;
  }

  // Couleur utilitaire : assombrir/éclaircir un hex "#rrggbb"
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    return "rgb(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + ")";
  }

  // File d'attente simple pour BFS (indices de tuiles)
  function makeQueue(cap) {
    const buf = new Int32Array(cap);
    let head = 0, tail = 0;
    return {
      push(v) { buf[tail++] = v; },
      shift() { return buf[head++]; },
      get length() { return tail - head; },
      reset() { head = 0; tail = 0; }
    };
  }

  function fmtMoney(n) {
    return n.toLocaleString("fr-FR") + " $";
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  G.U = {
    TAU, clamp, lerp, damp, dist, dist2,
    wrapAngle, angleDiff, angleLerp, angleDamp,
    makeRng, pick, rrange, rint,
    rectsOverlap, pointInRect, shade, makeQueue,
    fmtMoney, fmtTime
  };

})(window.G);
