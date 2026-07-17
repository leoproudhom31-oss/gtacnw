/* ============================================================
   JADE HARBOR — audio.js
   Sons 100 % procéduraux (WebAudio) : moteur, tirs, sirènes,
   klaxon, explosions, jingles et nappe d'ambiance pentatonique.
   ============================================================ */
"use strict";
(function (G) {

  const A = {
    ctx: null,
    master: null,
    muted: false,
    engine: null,        // { osc, gain, filter } du véhicule joueur
    sirens: new Map(),   // par véhicule de police
    musicOn: true,
    _musicTimer: 0,
    _noiseBuf: null
  };

  function ensure() {
    if (A.ctx) {
      if (A.ctx.state === "suspended") A.ctx.resume();
      return true;
    }
    try {
      A.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return false; }
    A.master = A.ctx.createGain();
    A.master.gain.value = 0.55;
    A.master.connect(A.ctx.destination);

    // Buffer de bruit blanc réutilisable
    const len = A.ctx.sampleRate * 1.2;
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A._noiseBuf = buf;
    return true;
  }

  function now() { return A.ctx ? A.ctx.currentTime : 0; }

  function toggleMute() {
    if (!ensure()) return;
    A.muted = !A.muted;
    A.master.gain.setTargetAtTime(A.muted ? 0 : 0.55, now(), 0.05);
    return A.muted;
  }

  /* ---------- petits sons one-shot ---------- */

  function noiseBurst(dur, vol, filterFreq, sweepTo) {
    if (!A.ctx || A.muted) return;
    const t = now();
    const src = A.ctx.createBufferSource();
    src.buffer = A._noiseBuf;
    const f = A.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(filterFreq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(A.master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  function tone(freq, dur, vol, type, sweepTo) {
    if (!A.ctx || A.muted) return;
    const t = now();
    const o = A.ctx.createOscillator();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(A.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  const SFX = {
    shot()      { noiseBurst(0.14, 0.5, 3000, 400); tone(160, 0.06, 0.25, "square", 60); },
    smg()       { noiseBurst(0.09, 0.38, 3400, 500); },
    shotgun()   { noiseBurst(0.30, 0.65, 1800, 200); tone(110, 0.12, 0.3, "square", 45); },
    punchHit()  { noiseBurst(0.08, 0.35, 900, 300); tone(90, 0.07, 0.3, "sine", 50); },
    punchMiss() { noiseBurst(0.05, 0.12, 1400, 700); },
    crash(v)    { const k = G.U.clamp(v == null ? 0.5 : v, 0.15, 1); noiseBurst(0.22 * k + 0.08, 0.45 * k, 900, 180); },
    explosion() {
      noiseBurst(0.9, 0.9, 900, 60);
      tone(70, 0.7, 0.6, "sine", 28);
      tone(46, 0.9, 0.4, "triangle", 20);
    },
    pickup()    { tone(660, 0.09, 0.25, "sine"); tone(990, 0.14, 0.22, "sine"); },
    cash()      { tone(880, 0.06, 0.2, "square"); setTimeout(() => tone(1175, 0.09, 0.2, "square"), 60); },
    horn()      { tone(392, 0.35, 0.28, "square"); tone(330, 0.35, 0.28, "square"); },
    hurt()      { tone(190, 0.12, 0.3, "sawtooth", 90); },
    door()      { noiseBurst(0.10, 0.2, 600, 250); },
    wasted()    { tone(220, 0.5, 0.35, "sawtooth", 55); tone(110, 0.9, 0.3, "triangle", 40); },
    star()      { tone(1046, 0.1, 0.2, "square"); setTimeout(() => tone(784, 0.14, 0.2, "square"), 90); },
    reload()    { noiseBurst(0.06, 0.18, 2200, 900); },
    splash()    { noiseBurst(0.35, 0.3, 700, 150); },
    jingleWin() {
      const seq = [523, 659, 784, 1046, 784, 1046];
      seq.forEach((f, i) => setTimeout(() => tone(f, 0.22, 0.28, "triangle"), i * 130));
    },
    jingleFail() {
      const seq = [330, 262, 208, 165];
      seq.forEach((f, i) => setTimeout(() => tone(f, 0.3, 0.28, "sawtooth"), i * 180));
    }
  };

  function play(name) { if (ensure() && SFX[name]) SFX[name](); }

  /* ---------- moteur du joueur (boucle continue) ---------- */

  function startEngine() {
    if (!ensure() || A.engine) return;
    const o = A.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = 55;
    const f = A.ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 320; f.Q.value = 2;
    const g = A.ctx.createGain();
    g.gain.value = 0.0;
    o.connect(f); f.connect(g); g.connect(A.master);
    o.start();
    A.engine = { o, f, g };
  }

  function updateEngine(speedRatio) {
    if (!A.engine) return;
    const t = now();
    A.engine.o.frequency.setTargetAtTime(50 + 190 * speedRatio, t, 0.08);
    A.engine.f.frequency.setTargetAtTime(280 + 900 * speedRatio, t, 0.1);
    A.engine.g.gain.setTargetAtTime(A.muted ? 0 : 0.10 + 0.05 * speedRatio, t, 0.1);
  }

  function stopEngine() {
    if (!A.engine) return;
    const e = A.engine; A.engine = null;
    e.g.gain.setTargetAtTime(0, now(), 0.08);
    setTimeout(() => { try { e.o.stop(); } catch (_) {} }, 400);
  }

  /* ---------- sirène de police ---------- */

  function setSiren(id, on) {
    if (!ensure()) return;
    if (on && !A.sirens.has(id)) {
      const o = A.ctx.createOscillator();
      o.type = "triangle";
      const g = A.ctx.createGain();
      g.gain.value = 0.05;
      const lfo = A.ctx.createOscillator();
      lfo.type = "square"; lfo.frequency.value = 0.9;
      const lfoG = A.ctx.createGain(); lfoG.gain.value = 140;
      lfo.connect(lfoG); lfoG.connect(o.frequency);
      o.frequency.value = 800;
      o.connect(g); g.connect(A.master);
      o.start(); lfo.start();
      A.sirens.set(id, { o, g, lfo });
    } else if (!on && A.sirens.has(id)) {
      const s = A.sirens.get(id); A.sirens.delete(id);
      s.g.gain.setTargetAtTime(0, now(), 0.1);
      setTimeout(() => { try { s.o.stop(); s.lfo.stop(); } catch (_) {} }, 500);
    }
  }

  function sirenDistance(id, d) {
    const s = A.sirens.get(id);
    if (!s) return;
    const vol = G.U.clamp(1 - d / 1200, 0, 1) * 0.06;
    s.g.gain.setTargetAtTime(A.muted ? 0 : vol, now(), 0.15);
  }

  /* ---------- musique d'ambiance pentatonique ---------- */

  const PENTA = [220, 247.5, 293.33, 330, 392, 440, 495, 586.67];

  function musicTick(dt) {
    if (!A.ctx || A.muted || !A.musicOn) return;
    A._musicTimer -= dt;
    if (A._musicTimer > 0) return;
    A._musicTimer = 0.5 + Math.random() * 2.2;
    if (Math.random() < 0.35) return; // silences — la ville respire
    const f = PENTA[Math.floor(Math.random() * PENTA.length)];
    // pluck façon guzheng : sinus + harmonique, décroissance rapide
    tone(f, 1.4, 0.045, "sine");
    tone(f * 2, 0.8, 0.02, "sine");
    if (Math.random() < 0.25) setTimeout(() => tone(f * 1.5, 1.1, 0.03, "sine"), 220);
  }

  G.Audio = {
    ensure, play, toggleMute,
    startEngine, updateEngine, stopEngine,
    setSiren, sirenDistance, musicTick,
    get muted() { return A.muted; }
  };

})(window.G);
