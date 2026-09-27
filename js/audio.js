'use strict';
/* =====================================================================
   Procedural audio: weapons, impacts, ambience, music, radio.
   Everything is synthesised with the Web Audio API.
   ===================================================================== */
const SFX = {
  ctx: null, master: null, sfxBus: null, musicBus: null, ambBus: null, verb: null, verbSend: null,
  noise: null, brown: null, listener: { pos: new THREE.Vector3(), yaw: 0 }, ambNodes: [], ready: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = Settings.volume;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.25;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = 0.9; this.ambBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = Settings.music * 0.6; this.musicBus.connect(this.master);
    this.duck = ctx.createGain(); this.duck.connect(this.sfxBus);
    // reverb
    this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(2.6, 2.4);
    this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0.55; this.verbSend.connect(this.verb); this.verb.connect(this.master);
    // noise buffers
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate); const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate); const b = this.brown.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    this.ready = true;
  },
  impulse(sec, decay) {
    const ctx = this.ctx, len = ctx.sampleRate * sec, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) { const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < ctx.sampleRate * 0.01 ? i / (ctx.sampleRate * 0.01) : 1); } }
    return buf;
  },
  setVolume() { if (this.master) this.master.gain.value = Settings.volume; if (this.musicBus) this.musicBus.gain.value = Settings.music * 0.6; },
  now() { return this.ctx ? this.ctx.currentTime : 0; },
  /* spatial params for a world position relative to the listener */
  spatial(pos) {
    if (!pos) return { g: 1, pan: 0, cut: 20000, d: 0 };
    const L = this.listener, dx = pos.x - L.pos.x, dz = pos.z - L.pos.z, dy = pos.y - L.pos.y;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const ang = Math.atan2(-dx, -dz) - L.yaw;
    const pan = clamp(-Math.sin(ang), -1, 1) * clamp(d / 3, 0, 0.85);
    const g = 1 / (1 + d / 9);
    const cut = clamp(18000 / (1 + d / 25), 500, 18000);
    return { g, pan, cut, d };
  },
  /* create a chain: src -> filter -> gain -> panner -> bus (+ reverb send) */
  chain(sp, gain, verb = 0.15) {
    const ctx = this.ctx, g = ctx.createGain(); g.gain.value = gain * sp.g;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = sp.cut;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    f.connect(g);
    if (p) { p.pan.value = sp.pan; g.connect(p); p.connect(this.duck); } else g.connect(this.duck);
    const vs = ctx.createGain(); vs.gain.value = verb * (0.4 + clamp(sp.d / 60, 0, 1.6)) * gain * Math.max(sp.g, 0.08); g.connect(vs); vs.connect(this.verbSend);
    return f;
  },
  noiseSrc(t, dur, rate = 1, buf) {
    const s = this.ctx.createBufferSource(); s.buffer = buf || this.noise; s.playbackRate.value = rate;
    const off = Math.random() * Math.max(0, 1.95 - (dur + 0.05) * rate); if ((dur + 0.05) * rate > 1.9) s.loop = true; s.start(t, off); s.stop(t + dur + 0.05); return s;
  },
  env(node, t, a, peak, dec, curve = 'exp') {
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); else g.gain.linearRampToValueAtTime(0, t + a + dec);
    node.connect(g); return g;
  },
  burst(out, t, { type = 'bandpass', f = 1000, q = 1, a = 0.001, dec = 0.1, peak = 1, rate = 1, buf } = {}) {
    const src = this.noiseSrc(t, a + dec, rate, buf); const flt = this.ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    src.connect(flt); const e = this.env(flt, t, a, peak, dec); e.connect(out); return flt;
  },
  tone(out, t, { f = 440, f2 = null, type = 'sine', a = 0.002, dec = 0.2, peak = 0.5, glide = 0.1 } = {}) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + glide);
    const e = this.env(o, t, a, peak, dec); e.connect(out); o.start(t); o.stop(t + a + dec + 0.05); return o;
  },

  /* ---------------- weapon reports ---------------- */
  shot(kind, pos, isPlayer = false) {
    if (!this.ready) return;
    const t = this.now() + 0.001, sp = this.spatial(pos);
    if (!isPlayer && sp.d > 20) { // distant: delayed by speed of sound, dull
      const delay = Math.min(sp.d / 343, 1.2);
      return this._distantShot(kind, sp, t + delay);
    }
    const P = {
      garand: { crack: 1.0, body: 1.0, thump: 1.0, bf: 1300, tail: 0.5, lowF: 110 },
      thompson: { crack: 0.6, body: 0.85, thump: 1.1, bf: 900, tail: 0.3, lowF: 90 },
      colt: { crack: 0.7, body: 0.8, thump: 0.9, bf: 1000, tail: 0.3, lowF: 100 },
      kar98: { crack: 1.0, body: 1.0, thump: 1.0, bf: 1500, tail: 0.5, lowF: 120 },
      mp40: { crack: 0.55, body: 0.7, thump: 0.9, bf: 900, tail: 0.25, lowF: 95 },
      mg42: { crack: 0.7, body: 0.7, thump: 0.9, bf: 1500, tail: 0.25, lowF: 120 },
      sherman: { crack: 0.8, body: 1.6, thump: 2.2, bf: 500, tail: 1.2, lowF: 55 },
    }[kind] || { crack: 1, body: 1, thump: 1, bf: 1200, tail: 0.4, lowF: 110 };
    const vol = isPlayer ? 0.85 : 0.75;
    const out = this.chain(sp, vol, P.tail * (isPlayer ? 0.9 : 0.6));
    this.burst(out, t, { type: 'highpass', f: 2600, q: 0.7, dec: 0.045, peak: 1.1 * P.crack });
    this.burst(out, t, { type: 'lowpass', f: P.bf, q: 0.9, a: 0.002, dec: 0.22, peak: 1.4 * P.body });
    this.burst(out, t + 0.004, { type: 'bandpass', f: 380, q: 1.2, a: 0.004, dec: 0.35, peak: 0.9 * P.body, buf: this.brown });
    this.tone(out, t, { f: P.lowF * 1.8, f2: P.lowF * 0.4, a: 0.001, dec: 0.18, peak: 0.9 * P.thump, glide: 0.12 });
    if (isPlayer) { // mechanical layer
      this.burst(out, t + 0.03, { type: 'bandpass', f: 3200, q: 4, dec: 0.03, peak: 0.25 });
    }
  },
  _distantShot(kind, sp, t) {
    const out = this.chain({ ...sp, cut: Math.min(sp.cut, 2200) }, 0.9, 0.9);
    const big = kind === 'sherman' || kind === 'artillery';
    this.burst(out, t, { type: 'lowpass', f: big ? 400 : 1400, q: 0.7, a: 0.002, dec: big ? 1.2 : 0.3, peak: big ? 2.2 : 1.1 });
    this.burst(out, t, { type: 'bandpass', f: 2200, q: 1, dec: 0.03, peak: 0.4 });
  },
  mgBurst(pos, n, rate = 20) {
    for (let i = 0; i < n; i++) setTimeout(() => this.shot('mg42', pos), i * 1000 / rate);
  },
  ping() {
    if (!this.ready) return; const t = this.now() + 0.02, out = this.chain({ g: 1, pan: 0.25, cut: 18000, d: 1 }, 0.5, 0.4);
    [[2480, 0.7], [3950, 0.5], [5620, 0.28], [7120, 0.18]].forEach(([f, p], i) => this.tone(out, t, { f, type: 'sine', a: 0.001, dec: 0.9 - i * 0.15, peak: p * 0.45 }));
    this.burst(out, t, { type: 'highpass', f: 4000, dec: 0.02, peak: 0.4 });
  },
  mech(kind, pos) {
    if (!this.ready) return; const t = this.now(), sp = pos ? this.spatial(pos) : { g: 1, pan: 0.15, cut: 18000, d: 0.5 };
    const out = this.chain(sp, 0.5, 0.05);
    const K = {
      boltBack: [[0, 1800, 3, 0.05, 0.6], [0.04, 900, 2, 0.06, 0.5]],
      boltFwd: [[0, 1300, 2, 0.08, 0.9], [0.015, 3400, 5, 0.03, 0.5]],
      clipIn: [[0, 2300, 4, 0.04, 0.6], [0.05, 1600, 3, 0.05, 0.6]],
      magOut: [[0, 1500, 3, 0.04, 0.5], [0.03, 900, 2, 0.05, 0.3]],
      magIn: [[0, 1100, 3, 0.05, 0.7], [0.03, 2600, 5, 0.03, 0.6]],
      click: [[0, 3000, 6, 0.02, 0.5]],
      dry: [[0, 2600, 8, 0.02, 0.7]],
      slideBack: [[0, 2100, 4, 0.04, 0.5]],
      slideFwd: [[0, 1500, 3, 0.05, 0.8], [0.02, 3600, 6, 0.02, 0.4]],
      cloth: [[0, 700, 0.6, 0.12, 0.25], [0.08, 900, 0.6, 0.1, 0.2]],
      pin: [[0, 4200, 7, 0.02, 0.5], [0.06, 2800, 5, 0.04, 0.4]],
      pickup: [[0, 900, 1, 0.08, 0.35], [0.05, 2400, 4, 0.03, 0.4]],
      tap: [[0, 1200, 3, 0.03, 0.4]],
      door: [[0, 300, 1, 0.3, 0.6], [0.05, 900, 2, 0.2, 0.3]],
      melee: [[0, 400, 0.8, 0.15, 0.9], [0.01, 180, 1, 0.2, 0.7]],
    }[kind] || [[0, 2000, 4, 0.03, 0.5]];
    K.forEach(([dt, f, q, dec, p]) => this.burst(out, t + dt, { type: 'bandpass', f: f * rand(0.92, 1.08), q, dec, peak: p }));
  },
  casing(delay = 0.35) {
    if (!this.ready) return; const t = this.now() + delay, out = this.chain({ g: 1, pan: 0.5, cut: 18000, d: 1 }, 0.18, 0.1);
    const f = rand(3800, 5200);
    this.tone(out, t, { f, type: 'sine', dec: 0.12, peak: 0.25 }); this.tone(out, t + 0.09, { f: f * 1.1, type: 'sine', dec: 0.08, peak: 0.12 });
  },
  impact(surf, pos) {
    if (!this.ready) return; const sp = this.spatial(pos); if (sp.d > 60) return;
    const t = this.now(), out = this.chain(sp, 0.35, 0.1);
    if (surf === 'metal') { this.tone(out, t, { f: rand(1800, 3200), type: 'triangle', dec: 0.25, peak: 0.35 }); this.burst(out, t, { type: 'highpass', f: 3000, dec: 0.03, peak: 0.6 }); }
    else if (surf === 'wood') this.burst(out, t, { type: 'bandpass', f: 700, q: 2, dec: 0.06, peak: 0.9 });
    else if (surf === 'water') this.burst(out, t, { type: 'bandpass', f: 1400, q: 0.7, dec: 0.18, peak: 0.6 });
    else if (surf === 'flesh') this.burst(out, t, { type: 'lowpass', f: 500, q: 1, dec: 0.08, peak: 1 });
    else this.burst(out, t, { type: 'bandpass', f: surf === 'dirt' || surf === 'sand' ? 500 : 1500, q: 1, dec: 0.07, peak: 0.8 });
  },
  whiz(pan = 0) {
    if (!this.ready) return; const t = this.now(), out = this.chain({ g: 1, pan, cut: 18000, d: 2 }, 0.4, 0.05);
    const s = this.noiseSrc(t, 0.2); const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(900, t + 0.18);
    s.connect(f); this.env(f, t, 0.03, 0.9, 0.15).connect(out);
    this.burst(out, t + 0.02, { type: 'highpass', f: 3500, dec: 0.02, peak: 0.5 });
  },
  explosion(pos, size = 1) {
    if (!this.ready) return; const sp = this.spatial(pos), t = this.now() + Math.min(sp.d / 343, 1.5);
    const near = sp.d < 30;
    const out = this.chain({ ...sp, g: Math.max(sp.g, 0.12), cut: near ? 9000 : 1600 }, 1.2 * size, 1.1);
    const s = this.noiseSrc(t, 2.4, 0.8, this.brown); const f = this.ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(near ? 3000 : 900, t); f.frequency.exponentialRampToValueAtTime(120, t + 1.8);
    s.connect(f); this.env(f, t, 0.005, 2.4, 2.0).connect(out);
    this.tone(out, t, { f: 90, f2: 26, a: 0.003, dec: 1.2, peak: 1.4, glide: 0.8 });
    if (near) { this.burst(out, t, { type: 'highpass', f: 1500, dec: 0.12, peak: 1.2 }); for (let i = 0; i < 8; i++) this.burst(out, t + 0.3 + Math.random() * 1.2, { type: 'bandpass', f: rand(800, 3000), q: 2, dec: 0.04, peak: 0.25 }); }
  },
  splash(pos, big = false) {
    if (!this.ready) return; const sp = this.spatial(pos), t = this.now(), out = this.chain(sp, big ? 1 : 0.4, 0.3);
    this.burst(out, t, { type: 'bandpass', f: big ? 600 : 1500, q: 0.6, a: 0.01, dec: big ? 1.5 : 0.3, peak: 1 });
  },
  footstep(surf, vol = 0.22, pos) {
    if (!this.ready) return; const t = this.now(), sp = pos ? this.spatial(pos) : { g: 1, pan: rand(-0.1, 0.1), cut: 18000, d: 0 };
    const out = this.chain(sp, vol, 0.03);
    const F = { sand: [700, 0.8, 0.12], dirt: [500, 0.9, 0.1], grass: [1200, 0.6, 0.11], stone: [1800, 1.5, 0.05], wood: [400, 2, 0.09], water: [900, 0.5, 0.25], snow: [900, 0.7, 0.14], metal: [2200, 3, 0.06], tile: [2600, 2, 0.04] }[surf] || [900, 1, 0.08];
    this.burst(out, t, { type: 'bandpass', f: F[0] * rand(0.85, 1.15), q: F[1], a: 0.004, dec: F[2], peak: 1 });
    if (surf === 'water') this.burst(out, t + 0.05, { type: 'bandpass', f: 1600, q: 0.7, a: 0.02, dec: 0.2, peak: 0.6 });
    if (surf === 'wood' || surf === 'tile') this.burst(out, t, { type: 'lowpass', f: 250, q: 1, dec: 0.06, peak: 0.6 });
  },
  hitmarker(kill) { if (!this.ready) return; const t = this.now(), out = this.chain({ g: 1, pan: 0, cut: 18000, d: 0 }, 0.18, 0); this.burst(out, t, { type: 'bandpass', f: kill ? 1800 : 2800, q: 3, dec: 0.05, peak: 1 }); },
  hurt() { if (!this.ready) return; const t = this.now(), out = this.chain({ g: 1, pan: 0, cut: 18000, d: 0 }, 0.6, 0); this.burst(out, t, { type: 'lowpass', f: 300, dec: 0.2, peak: 1, buf: this.brown }); this.tone(out, t, { f: 70, f2: 40, dec: 0.25, peak: 0.7 }); },
  heartbeat() { if (!this.ready) return; const t = this.now(), out = this.chain({ g: 1, pan: 0, cut: 18000, d: 0 }, 0.5, 0); this.tone(out, t, { f: 55, f2: 40, dec: 0.12, peak: 0.9 }); this.tone(out, t + 0.22, { f: 50, f2: 38, dec: 0.12, peak: 0.6 }); },
  heal() { if (!this.ready) return; this.mech('cloth'); const t = this.now() + 0.3, out = this.chain({ g: 1, pan: -0.1, cut: 18000, d: 0 }, 0.2, 0.1); this.burst(out, t, { type: 'highpass', f: 5000, dec: 0.25, peak: 0.6 }); },
  ui(kind = 'move') { if (!this.ready) return; const t = this.now(), out = this.chain({ g: 1, pan: 0, cut: 18000, d: 0 }, 0.12, 0.05); this.burst(out, t, { type: 'bandpass', f: kind === 'ok' ? 1400 : 2400, q: 5, dec: 0.05, peak: 1 }); },
  typewriter() { if (!this.ready) return; const t = this.now(), out = this.chain({ g: 1, pan: rand(-0.2, 0.2), cut: 18000, d: 0 }, 0.12, 0.02); this.burst(out, t, { type: 'bandpass', f: rand(1800, 2600), q: 3, dec: 0.025, peak: 1 }); },
  bell() { if (!this.ready) return; const t = this.now(), out = this.chain({ g: 1, pan: 0.3, cut: 18000, d: 3 }, 0.3, 0.4); [1320, 1980, 2640].forEach((f, i) => this.tone(out, t, { f, dec: 1.2 - i * 0.3, peak: 0.3 })); },
  planeFlyby(dur = 6) {
    if (!this.ready) return; const t = this.now(), out = this.chain({ g: 1, pan: 0, cut: 18000, d: 30 }, 0.8, 0.4);
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(120, t + dur * 0.45); o.frequency.linearRampToValueAtTime(70, t + dur);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; o.connect(f);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    f.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.1);
    const n = this.noiseSrc(t, dur); const nf = this.ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 500; n.connect(nf);
    const ng = this.ctx.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.6, t + dur * 0.45); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur); nf.connect(ng); ng.connect(out);
  },
  engine(on, pos) { // tank engine loop handle
    if (!this.ready) return null;
    const ctx = this.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(); o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = 38; o2.frequency.value = 57;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320; const g = ctx.createGain(); g.gain.value = 0;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o.connect(f); o2.connect(f); f.connect(g); if (p) { g.connect(p); p.connect(this.ambBus); } else g.connect(this.ambBus);
    const n = ctx.createBufferSource(); n.buffer = this.brown; n.loop = true; const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 600; n.connect(nf); nf.connect(g);
    o.start(); o2.start(); n.start();
    const h = { o, o2, n, g, p, stop: () => { try { g.gain.setTargetAtTime(0, ctx.currentTime, 0.3); setTimeout(() => { o.stop(); o2.stop(); n.stop(); }, 1500); } catch (e) { } }, update: (pos, rev = 0.5) => { const sp = this.spatial(pos); g.gain.setTargetAtTime(0.5 * sp.g * (0.7 + rev * 0.5), ctx.currentTime, 0.1); f.frequency.setTargetAtTime(Math.min(sp.cut, 250 + rev * 300), ctx.currentTime, 0.1); o.frequency.setTargetAtTime(34 + rev * 16, ctx.currentTime, 0.2); o2.frequency.setTargetAtTime(51 + rev * 24, ctx.currentTime, 0.2); if (p) p.pan.setTargetAtTime(sp.pan, ctx.currentTime, 0.1); } };
    this.ambNodes.push(h); return h;
  },

  /* ---------------- ambience beds ---------------- */
  stopAmbience() { this.ambNodes.forEach(n => { try { n.stop(); } catch (e) { } }); this.ambNodes = []; clearInterval(this._ambTimer); },
  loopNoise(filterType, freq, q, gain, lfoRate = 0, lfoDepth = 0, buf) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = buf || this.noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(this.ambBus);
    let lfo = null;
    if (lfoRate) { lfo = ctx.createOscillator(); lfo.frequency.value = lfoRate; const lg = ctx.createGain(); lg.gain.value = lfoDepth; lfo.connect(lg); lg.connect(g.gain); lfo.start(); }
    s.start();
    const h = { g, stop: () => { g.gain.setTargetAtTime(0, ctx.currentTime, 0.5); setTimeout(() => { try { s.stop(); lfo && lfo.stop(); } catch (e) { } }, 2000); } };
    this.ambNodes.push(h); return h;
  },
  ambience(type) {
    if (!this.ready) return; this.stopAmbience();
    const A = this;
    if (type === 'diner') {
      this.loopNoise('lowpass', 300, 0.7, 0.05, 0.1, 0.02, this.brown);
      const ctx = this.ctx, o = ctx.createOscillator(); o.frequency.value = 60; const g = ctx.createGain(); g.gain.value = 0.012; o.connect(g); g.connect(this.ambBus); o.start(); this.ambNodes.push({ stop: () => { try { o.stop(); } catch (e) { } } });
      this._ambTimer = setInterval(() => { if (Math.random() < 0.3) A.mech('tap', null); }, 2500);
    } else if (type === 'winter') {
      this.loopNoise('bandpass', 500, 0.6, 0.12, 0.13, 0.08);
      this.loopNoise('lowpass', 180, 0.7, 0.1, 0, 0, this.brown);
    } else if (type === 'camp') {
      this.loopNoise('bandpass', 5200, 3, 0.012, 3.2, 0.01);
      this.loopNoise('lowpass', 400, 0.7, 0.05, 0.08, 0.03);
      this._ambTimer = setInterval(() => { if (Math.random() < 0.4) A._distantShot('garand', { g: 0.06, pan: rand(-0.8, 0.8), cut: 1500, d: 300 }, A.now()); }, 1400);
    } else if (type === 'sea') {
      this.loopNoise('lowpass', 700, 0.5, 0.35, 0.12, 0.2, this.brown);
      this.loopNoise('bandpass', 1800, 0.4, 0.06, 0.2, 0.05);
      this.loopNoise('lowpass', 120, 0.7, 0.25, 0, 0, this.brown);
      this._ambTimer = setInterval(() => A.battleTick(0.9), 450);
    } else if (type === 'field') {
      this.loopNoise('bandpass', 600, 0.5, 0.08, 0.1, 0.05);
      this.loopNoise('bandpass', 6000, 4, 0.006, 4, 0.004);
      this._ambTimer = setInterval(() => A.battleTick(0.5), 700);
    } else if (type === 'town') {
      this.loopNoise('bandpass', 500, 0.5, 0.1, 0.09, 0.06);
      this.loopNoise('highpass', 3000, 0.5, 0.012, 7, 0.01);
      this._ambTimer = setInterval(() => A.battleTick(0.6), 600);
    } else if (type === 'dusk') {
      this.loopNoise('bandpass', 450, 0.5, 0.08, 0.07, 0.04);
      this.loopNoise('bandpass', 5000, 5, 0.008, 5, 0.006);
    }
  },
  battleTick(intensity) {
    if (Math.random() > intensity * 0.5) return;
    const t = this.now(), r = Math.random(), sp = { g: rand(0.02, 0.09), pan: rand(-0.9, 0.9), cut: rand(500, 1500), d: rand(200, 900) };
    if (r < 0.25) this._distantShot('artillery', { ...sp, g: sp.g * 1.8 }, t);
    else if (r < 0.45) { const n = randi(5, 14); for (let i = 0; i < n; i++) this._distantShot('mg42', sp, t + i * 0.05); }
    else this._distantShot('kar98', sp, t);
  },

  /* ---------------- radio (FDR address bed) ---------------- */
  radio(on) {
    if (!this.ready) return;
    if (on && !this._radio) this._radio = this.loopNoise('bandpass', 2400, 0.8, 0.03, 7, 0.012);
    if (!on && this._radio) { this._radio.stop(); this._radio = null; }
  },
  radioApplause(sec = 6) {
    if (!this.ready) return; const t = this.now(), out = this.chain({ g: 1, pan: 0.3, cut: 3500, d: 3 }, 0.35, 0.2);
    for (let i = 0; i < sec * 40; i++) this.burst(out, t + Math.random() * sec, { type: 'bandpass', f: rand(1200, 3200), q: 2, dec: 0.02, peak: rand(0.2, 0.6) * (1 - i / (sec * 40) * 0.6) });
  },

  /* ---------------- text-to-speech (optional) ---------------- */
  speak(text, who) {
    if (!Settings.tts || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      const voices = speechSynthesis.getVoices().filter(v => /en/i.test(v.lang));
      const female = /Mother|Ruth|Marguerite/.test(who || '');
      const v = voices.find(v => female ? /female|zira|samantha|susan|victoria/i.test(v.name) : /male|david|daniel|alex|fred|george/i.test(v.name)) || voices[0];
      if (v) u.voice = v; u.rate = who === 'Roosevelt' ? 0.82 : 1.0; u.pitch = who === 'Ruth' ? 1.35 : female ? 1.15 : (who === 'Hollis' ? 0.75 : 0.9);
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { }
  }
};

/* =====================================================================
   Music — a small sequencer playing slow orchestral-ish pads + horn
   ===================================================================== */
const Music = {
  cur: null, timer: null, gain: null, step: 0,
  N(n) { return 440 * Math.pow(2, (n - 69) / 12); },
  play(name) {
    if (!SFX.ready || this.cur === name) return;
    this.stop(); this.cur = name; const ctx = SFX.ctx;
    this.gain = ctx.createGain(); this.gain.gain.value = 0; this.gain.connect(SFX.musicBus); this.gain.gain.setTargetAtTime(1, ctx.currentTime, 1.5);
    const rev = ctx.createGain(); rev.gain.value = 0.6; this.gain.connect(rev); rev.connect(SFX.verbSend);
    const songs = {
      // D minor elegy. chords as midi arrays, melody [note, beats]
      title: { bpm: 56, chords: [[50, 57, 62, 65], [46, 58, 62, 65], [48, 55, 60, 64], [45, 57, 61, 64], [50, 57, 62, 65], [43, 55, 58, 62], [45, 52, 57, 61], [50, 57, 62, 66]], mel: [[74, 2], [72, 1], [70, 1], [69, 3], [null, 1], [67, 2], [69, 1], [70, 1], [69, 3], [null, 1], [74, 2], [76, 1], [77, 1], [76, 2], [74, 2], [72, 1], [70, 1], [69, 2], [73, 2], [74, 4]] },
      home: { bpm: 64, chords: [[48, 55, 64, 67], [45, 57, 60, 64], [41, 57, 60, 65], [43, 55, 59, 62]], mel: [[67, 2], [72, 2], [71, 1], [69, 1], [67, 4], [65, 2], [69, 2], [67, 4], [null, 4]] },
      tension: { bpm: 70, chords: [[38, 45, 50, 53], [38, 45, 50, 53], [39, 46, 51, 54], [37, 44, 49, 52]], mel: [] },
      combat: { bpm: 96, chords: [[38, 50, 53, 57], [36, 48, 52, 55], [34, 46, 50, 53], [33, 45, 49, 52]], mel: [], drums: true },
      sorrow: { bpm: 50, chords: [[45, 52, 57, 60], [41, 53, 57, 60], [43, 50, 55, 59], [40, 52, 55, 59]], mel: [[76, 3], [74, 1], [72, 2], [71, 2], [69, 4], [null, 4], [72, 2], [74, 2], [76, 3], [79, 1], [76, 4], [null, 4]] },
      victory: { bpm: 60, chords: [[43, 55, 59, 62], [48, 55, 60, 64], [45, 57, 60, 64], [50, 57, 62, 66], [43, 55, 59, 62], [40, 52, 55, 59], [48, 55, 60, 64], [50, 57, 62, 66]], mel: [[67, 2], [71, 1], [74, 1], [79, 3], [78, 1], [76, 2], [74, 2], [72, 2], [71, 2], [69, 4], [67, 2], [71, 1], [74, 1], [76, 3], [74, 1], [72, 2], [71, 2], [69, 4], [67, 4]] },
    };
    const S = songs[name]; if (!S) return;
    const beat = 60 / S.bpm, barLen = beat * 4;
    let next = ctx.currentTime + 0.2, chordI = 0, melI = 0, melT = next;
    const schedule = () => {
      while (next < ctx.currentTime + 1.5) {
        this.pad(S.chords[chordI % S.chords.length], next, barLen * 1.08, name === 'combat' ? 0.05 : 0.07);
        if (S.drums) for (let b = 0; b < 4; b++) this.drum(next + b * beat, b % 2 === 0);
        chordI++; next += barLen;
      }
      while (S.mel.length && melT < ctx.currentTime + 1.5) {
        const [n, beats] = S.mel[melI % S.mel.length];
        if (n) this.horn(n, melT, beats * beat * 0.95);
        melT += beats * beat; melI++;
      }
    };
    schedule(); this.timer = setInterval(schedule, 400);
  },
  pad(notes, t, dur, vol) {
    const ctx = SFX.ctx;
    notes.forEach((n, i) => {
      for (let d = -1; d <= 1; d += 2) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = this.N(n); o.detune.value = d * 7;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900 + i * 150; f.Q.value = 0.5;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * (i === 0 ? 1.2 : 0.8), t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(f); f.connect(g); g.connect(this.gain); o.start(t); o.stop(t + dur + 0.1);
      }
    });
  },
  horn(n, t, dur) {
    const ctx = SFX.ctx, o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = this.N(n);
    const vib = ctx.createOscillator(); vib.frequency.value = 5; const vg = ctx.createGain(); vg.gain.value = 3; vib.connect(vg); vg.connect(o.frequency);
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = this.N(n); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.12); g.gain.setValueAtTime(0.09, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(f);
    o.connect(f); f.connect(g); g.connect(this.gain); [o, o2, vib].forEach(x => { x.start(t); x.stop(t + dur + 0.1); });
  },
  drum(t, low) {
    const ctx = SFX.ctx, s = ctx.createBufferSource(); s.buffer = SFX.brown; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low ? 180 : 900;
    const g = ctx.createGain(); g.gain.setValueAtTime(low ? 0.5 : 0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (low ? 0.4 : 0.12));
    s.connect(f); f.connect(g); g.connect(this.gain); s.start(t, Math.random(), 0.5);
  },
  stop() {
    if (this.timer) clearInterval(this.timer); this.timer = null;
    if (this.gain && SFX.ctx) { const g = this.gain; g.gain.setTargetAtTime(0, SFX.ctx.currentTime, 0.8); setTimeout(() => g.disconnect(), 4000); }
    this.gain = null; this.cur = null;
  }
};
