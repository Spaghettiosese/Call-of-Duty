'use strict';
/* =====================================================================
   THE LONG ROAD — core utilities, settings, progress, input
   ===================================================================== */
const TAU = Math.PI * 2, DEG = Math.PI / 180;
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
function easeOut(t) { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t); }
function easeIn(t) { t = clamp(t, 0, 1); return t * t; }
function damp(a, b, l, dt) { return lerp(a, b, 1 - Math.exp(-l * dt)); }
function rand(a = 0, b = 1) { return a + Math.random() * (b - a); }
function randi(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function angleDiff(a, b) { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
function yawTo(dx, dz) { return Math.atan2(-dx, -dz); }
function V3(x = 0, y = 0, z = 0) { return new THREE.Vector3(x, y, z); }
function col(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
function srgbArr(hex) { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }
function lin(v) { return Math.pow(v, 2.2); }

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let _sr = mulberry32(7);
function reseed(s) { _sr = mulberry32(s); }
function sr(a = 0, b = 1) { return a + _sr() * (b - a); }
function sri(a, b) { return Math.floor(sr(a, b + 1)); }

/* ---------- value noise (tileable variants for textures) ---------- */
const NOISE_P = new Uint8Array(512);
(() => {
  const r = mulberry32(1337); const p = [];
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) NOISE_P[i] = p[i & 255];
})();
function hash2(x, y) { return NOISE_P[(NOISE_P[x & 255] + (y & 255)) & 511] / 255; }
function hashf(x, y) { return NOISE_P[(NOISE_P[(x * 7 + 3) & 255] + (y * 13 + 5) & 255) & 511] / 255; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, n = 0, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f + i * 17.3, y * f + i * 9.1); n += a; a *= 0.5; f *= 2; }
  return s / n;
}
function tnoise(x, y, p) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const x0 = ((xi % p) + p) % p, x1 = (x0 + 1) % p, y0 = ((yi % p) + p) % p, y1 = (y0 + 1) % p;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(x0, y0), b = hash2(x1, y0), c = hash2(x0, y1), d = hash2(x1, y1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function tfbm(u, v, base, oct) {
  let s = 0, a = 0.5, n = 0, f = base;
  for (let i = 0; i < oct; i++) { s += a * tnoise(u * f + i * 31, v * f + i * 17, f); n += a; a *= 0.5; f *= 2; }
  return s / n;
}

/* ---------- settings & progress ---------- */
const Settings = { sens: 1, fov: 90, quality: 'high', volume: 0.85, music: 0.55, subtitles: true, tts: false, invertY: false, difficulty: 1 };
const Progress = { unlocked: 0, mission: null, stage: 0, difficulty: 1 };
function loadPrefs() {
  try { Object.assign(Settings, JSON.parse(localStorage.getItem('tlr_settings') || '{}')); } catch (e) { }
  try { Object.assign(Progress, JSON.parse(localStorage.getItem('tlr_progress') || '{}')); } catch (e) { }
}
function saveSettings() { try { localStorage.setItem('tlr_settings', JSON.stringify(Settings)); } catch (e) { } }
function saveProgress() { try { localStorage.setItem('tlr_progress', JSON.stringify(Progress)); } catch (e) { } }

const DIFFICULTY = [
  { name: 'Recruit', desc: 'For those new to shooters. Enemies are forgiving.', dmg: 0.45, acc: 0.6 },
  { name: 'Regular', desc: 'The intended balance. Cover matters.', dmg: 0.8, acc: 0.85 },
  { name: 'Hardened', desc: 'Enemies hit hard and rarely miss twice.', dmg: 1.15, acc: 1.0 },
  { name: 'Veteran', desc: 'The war as it was. Every mistake is fatal.', dmg: 1.7, acc: 1.2 },
];

/* ---------- input ---------- */
const Input = {
  keys: Object.create(null), pressed: Object.create(null),
  mdx: 0, mdy: 0, lmb: false, rmb: false, lmbPressed: false, wheel: 0,
  locked: false, lockFailed: false, enabled: false,
  down(c) { return !!this.keys[c]; },
  hit(c) { return !!this.pressed[c]; },
  endFrame() { this.pressed = Object.create(null); this.mdx = 0; this.mdy = 0; this.lmbPressed = false; this.wheel = 0; },
  clear() { this.keys = Object.create(null); this.lmb = this.rmb = false; }
};
(function setupInput() {
  const block = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ControlLeft', 'KeyW', 'KeyS', 'KeyA', 'KeyD']);
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (!Input.keys[e.code]) Input.pressed[e.code] = true;
    Input.keys[e.code] = true;
    if (block.has(e.code) && Input.enabled) e.preventDefault();
  });
  addEventListener('keyup', e => { Input.keys[e.code] = false; });
  addEventListener('blur', () => Input.clear());
  addEventListener('mousemove', e => {
    if (Input.locked || Input.lockFailed) { Input.mdx += e.movementX || 0; Input.mdy += e.movementY || 0; }
  });
  addEventListener('mousedown', e => {
    if (e.button === 0) { Input.lmb = true; Input.lmbPressed = true; }
    if (e.button === 2) Input.rmb = true;
  });
  addEventListener('mouseup', e => { if (e.button === 0) Input.lmb = false; if (e.button === 2) Input.rmb = false; });
  addEventListener('contextmenu', e => { if (Input.enabled) e.preventDefault(); });
  addEventListener('wheel', e => { Input.wheel += Math.sign(e.deltaY); }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    Input.locked = document.pointerLockElement === document.getElementById('game');
    if (typeof onPointerLockChange === 'function') onPointerLockChange(Input.locked);
  });
  document.addEventListener('pointerlockerror', () => { if (Input.reqGesture) Input.lockFailed = true; });
})();
function requestLock(gesture = false) {
  const c = document.getElementById('game'); Input.reqGesture = gesture;
  if (!c.requestPointerLock) { Input.lockFailed = true; return; }
  try {
    const p = c.requestPointerLock();
    if (p && p.catch) p.catch(() => { if (gesture) Input.lockFailed = true; });
  } catch (e) { if (gesture) Input.lockFailed = true; }
}
