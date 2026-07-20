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
    screech()   { noiseBurst(0.38, 0.16, 2600, 900); tone(1100, 0.3, 0.05, "sawtooth", 620); },
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

  /* ---------- moteur du joueur (boucle continue, UN SON PAR TYPE) ---------- */

  // Chaque type de véhicule a sa voix : fréquences de base/plafond, filtre,
  // forme d'onde, oscillateur secondaire (désaccordé) et modulation
  // d'amplitude (diesel qui tousse, moto qui crache, hors-bord qui toussote).
  const ENGINE_PROFILES = {
    sedan:  { wave: "sawtooth", f0: 50, f1: 240, filt0: 280, filt1: 1180, vol0: 0.10, vol1: 0.15 },
    taxi:   { wave: "sawtooth", f0: 54, f1: 260, filt0: 300, filt1: 1250, vol0: 0.10, vol1: 0.15 },
    police: { wave: "sawtooth", f0: 58, f1: 280, filt0: 320, filt1: 1400, vol0: 0.10, vol1: 0.16 },
    sport:  { wave: "sawtooth", f0: 74, f1: 360, filt0: 420, filt1: 2300, vol0: 0.11, vol1: 0.18,
              osc2: 1.502, wave2: "square" },                       // hurlement à haut régime
    van:    { wave: "sawtooth", f0: 38, f1: 140, filt0: 190, filt1: 620, vol0: 0.13, vol1: 0.18,
              am: 27, amDepth: 0.4 },                               // diesel qui claque
    pickup: { wave: "sawtooth", f0: 44, f1: 170, filt0: 230, filt1: 760, vol0: 0.12, vol1: 0.17,
              am: 21, amDepth: 0.3 },
    bike:   { wave: "square",   f0: 88, f1: 520, filt0: 640, filt1: 2600, vol0: 0.085, vol1: 0.145,
              am: 48, amDepth: 0.35, amRise: 40 },                  // pétarade aiguë
    boat:   { wave: "sine",     f0: 36, f1: 110, filt0: 260, filt1: 520, vol0: 0.12, vol1: 0.18,
              am: 7, amDepth: 0.55, amRise: 14, noise: true },      // hors-bord : putt-putt
    skiff:  { wave: "sine",     f0: 30, f1: 74,  filt0: 220, filt1: 400, vol0: 0.12, vol1: 0.16,
              am: 5, amDepth: 0.6, amRise: 9, noise: true }
  };

  function startEngine(type) {
    if (!ensure()) return;
    if (A.engine) stopEngine();
    const p = ENGINE_PROFILES[type] || ENGINE_PROFILES.sedan;
    const o = A.ctx.createOscillator();
    o.type = p.wave;
    o.frequency.value = p.f0;
    const f = A.ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = p.filt0; f.Q.value = 2;
    const g = A.ctx.createGain();
    g.gain.value = 0.0;
    o.connect(f); f.connect(g); g.connect(A.master);
    o.start();
    const e = { o, f, g, p };
    // oscillateur secondaire (harmonique désaccordée : moteur plus riche)
    if (p.osc2) {
      const o2 = A.ctx.createOscillator();
      o2.type = p.wave2 || p.wave;
      o2.frequency.value = p.f0 * p.osc2;
      const g2 = A.ctx.createGain(); g2.gain.value = 0.45;
      o2.connect(g2); g2.connect(f);
      o2.start();
      e.o2 = o2;
    }
    // modulation d'amplitude (ralenti qui tousse)
    if (p.am) {
      const lfo = A.ctx.createOscillator();
      lfo.type = "square"; lfo.frequency.value = p.am;
      const lfoG = A.ctx.createGain(); lfoG.gain.value = p.vol0 * p.amDepth;
      lfo.connect(lfoG); lfoG.connect(g.gain);
      lfo.start();
      e.lfo = lfo;
    }
    // souffle (bateaux : clapot du moteur dans l'eau)
    if (p.noise) {
      const src = A.ctx.createBufferSource();
      src.buffer = A._noiseBuf; src.loop = true;
      const nf = A.ctx.createBiquadFilter();
      nf.type = "lowpass"; nf.frequency.value = 420;
      const ng = A.ctx.createGain(); ng.gain.value = 0.035;
      src.connect(nf); nf.connect(ng); ng.connect(A.master);
      src.start();
      e.noiseSrc = src; e.noiseG = ng;
    }
    A.engine = e;
  }

  function updateEngine(speedRatio) {
    if (!A.engine) return;
    const t = now(), e = A.engine, p = e.p;
    const r = G.U.clamp(speedRatio, 0, 1);
    e.o.frequency.setTargetAtTime(p.f0 + (p.f1 - p.f0) * r, t, 0.08);
    if (e.o2) e.o2.frequency.setTargetAtTime((p.f0 + (p.f1 - p.f0) * r) * p.osc2, t, 0.08);
    e.f.frequency.setTargetAtTime(p.filt0 + (p.filt1 - p.filt0) * r, t, 0.1);
    e.g.gain.setTargetAtTime(A.muted ? 0 : p.vol0 + (p.vol1 - p.vol0) * r, t, 0.1);
    if (e.lfo && p.amRise) e.lfo.frequency.setTargetAtTime(p.am + p.amRise * r, t, 0.15);
    if (e.noiseG) e.noiseG.gain.setTargetAtTime(A.muted ? 0 : 0.02 + 0.045 * r, t, 0.12);
  }

  function stopEngine() {
    if (!A.engine) return;
    const e = A.engine; A.engine = null;
    e.g.gain.setTargetAtTime(0, now(), 0.08);
    if (e.noiseG) e.noiseG.gain.setTargetAtTime(0, now(), 0.08);
    setTimeout(() => {
      try { e.o.stop(); } catch (_) {}
      try { if (e.o2) e.o2.stop(); } catch (_) {}
      try { if (e.lfo) e.lfo.stop(); } catch (_) {}
      try { if (e.noiseSrc) e.noiseSrc.stop(); } catch (_) {}
    }, 400);
  }

  /* ---------- klaxons par type ---------- */

  const HORNS = {
    sedan:  () => { tone(392, 0.35, 0.28, "square"); tone(330, 0.35, 0.28, "square"); },
    taxi:   () => { tone(440, 0.28, 0.28, "square"); tone(370, 0.28, 0.26, "square"); },
    police: () => { tone(415, 0.3, 0.28, "square"); tone(349, 0.3, 0.26, "square"); },
    sport:  () => { tone(523, 0.26, 0.27, "square"); tone(415, 0.26, 0.25, "square"); },
    van:    () => { tone(233, 0.55, 0.32, "square"); tone(196, 0.55, 0.3, "square"); },
    pickup: () => { tone(294, 0.42, 0.3, "square"); tone(247, 0.42, 0.28, "square"); },
    bike:   () => { tone(880, 0.14, 0.26, "square"); },
    boat:   () => { tone(147, 0.9, 0.34, "sawtooth"); tone(110, 0.9, 0.26, "triangle"); }, // corne de brume
    skiff:  () => { tone(165, 0.7, 0.3, "sawtooth"); }
  };

  function horn(type) {
    if (!ensure()) return;
    (HORNS[type] || HORNS.sedan)();
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

  /* ---------- rotor d'hélicoptère (boucle) ---------- */

  let heliNodes = null;

  function setHeli(on) {
    if (!ensure()) return;
    if (on && !heliNodes) {
      const src = A.ctx.createBufferSource();
      src.buffer = A._noiseBuf;
      src.loop = true;
      const f = A.ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 240;
      const g = A.ctx.createGain();
      g.gain.value = 0.0;
      // battement des pales : modulation d'amplitude ~13 Hz
      const lfo = A.ctx.createOscillator();
      lfo.type = "square"; lfo.frequency.value = 13;
      const lfoG = A.ctx.createGain(); lfoG.gain.value = 0.5;
      lfo.connect(lfoG); lfoG.connect(g.gain);
      src.connect(f); f.connect(g); g.connect(A.master);
      src.start(); lfo.start();
      heliNodes = { src, g, lfo };
    } else if (!on && heliNodes) {
      const h = heliNodes; heliNodes = null;
      h.g.gain.setTargetAtTime(0, now(), 0.3);
      setTimeout(() => { try { h.src.stop(); h.lfo.stop(); } catch (_) {} }, 800);
    }
  }

  function heliDistance(d) {
    if (!heliNodes) return;
    const vol = G.U.clamp(1 - d / 1600, 0, 1) * 0.13;
    heliNodes.g.gain.setTargetAtTime(A.muted ? 0 : vol, now(), 0.2);
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
    ensure, play, toggleMute, horn,
    startEngine, updateEngine, stopEngine,
    setSiren, sirenDistance, musicTick,
    setHeli, heliDistance,
    get muted() { return A.muted; }
  };

})(window.G);
