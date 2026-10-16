// Tiny synthesised sounds (Web Audio, no files). Created lazily on first
// use so the AudioContext follows a key press. Everything is best-effort:
// a browser without audio just stays quiet.
(function () {
  const HE = window.HE;
  let ac = null;

  function ctx() {
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
      return ac;
    } catch (e) {
      return null;
    }
  }

  // One note: `type` oscillator at `freq` Hz, starting `at` s from now,
  // lasting `dur` s with a quick attack and a linear fade.
  function note(freq, at, dur, type, vol) {
    const a = ctx();
    if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type || "square";
    o.frequency.value = freq;
    const t0 = a.currentTime + at;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol || 0.12, t0 + 0.01);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  HE.sfx = {
    // a rising blip for each swap of the silhouette; `k` 0..1 = how far along
    tick(k) {
      note(440 + 660 * k, 0, 0.06, "triangle", 0.08);
    },
    // Minefeltet: a gulp and a belly rumble for a bomb eaten
    gulp() {
      note(220, 0, 0.08, "triangle", 0.1);
      note(110, 0.1, 0.25, "square", 0.06);
      for (let i = 0; i < 4; i++) note(150 - i * 10, 0.36 + i * 0.1, 0.05, "square", 0.09); // chomp chomp
      note(70, 0.78, 0.12, "triangle", 0.1); // a muffled pop in the belly
      note(880, 0.9, 0.08, "triangle", 0.07); // the burp
    },
    // …and the real thing for a wrong plate
    boom() {
      const a = ctx();
      if (!a) return;
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = "sawtooth";
      const t0 = a.currentTime;
      o.frequency.setValueAtTime(160, t0);
      o.frequency.exponentialRampToValueAtTime(30, t0 + 0.5);
      g.gain.setValueAtTime(0.18, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      o.connect(g).connect(a.destination);
      o.start(t0);
      o.stop(t0 + 0.65);
    },
    // Brobyggeren: an axe blow, a saw stroke, a splash
    chop() {
      note(180, 0, 0.05, "square", 0.12);
      note(90, 0.02, 0.1, "triangle", 0.1);
    },
    saw() {
      for (let i = 0; i < 4; i++) note(i % 2 ? 300 : 260, i * 0.09, 0.07, "sawtooth", 0.05);
    },
    splash() {
      const a = ctx();
      if (!a) return;
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = "triangle";
      const t0 = a.currentTime;
      o.frequency.setValueAtTime(600, t0);
      o.frequency.exponentialRampToValueAtTime(120, t0 + 0.35);
      g.gain.setValueAtTime(0.14, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
      o.connect(g).connect(a.destination);
      o.start(t0);
      o.stop(t0 + 0.45);
    },
    // the level-up fanfare: C E G C' then G C' held
    fanfare() {
      const seq = [
        [523, 0.0, 0.12],
        [659, 0.12, 0.12],
        [784, 0.24, 0.12],
        [1047, 0.36, 0.22],
        [784, 0.6, 0.14],
        [1047, 0.74, 0.6],
      ];
      seq.forEach(([f, at, d]) => note(f, at, d, "square", 0.1));
      seq.forEach(([f, at, d]) => note(f / 2, at, d, "triangle", 0.08));
    },
  };
})();
