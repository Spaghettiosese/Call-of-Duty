'use strict';
/* =====================================================================
   Procedural textures & material library (everything is generated
   at load time — no external images).
   ===================================================================== */
const TEX = {};
const MAT = {};
let MAX_ANISO = 4;

function mkCanvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function toTex(c, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = MAX_ANISO;
  return t;
}
/* fn(x,y,out) writes out[0..2]=rgb 0..255, out[3]=height, out[4]=alpha(0..255, default 255) */
function genTex(size, fn, h = size) {
  const c = mkCanvas(size, h), ctx = c.getContext('2d'), img = ctx.createImageData(size, h), d = img.data;
  const H = new Float32Array(size * h), o = [0, 0, 0, 0, 255];
  for (let y = 0; y < h; y++) for (let x = 0; x < size; x++) {
    o[3] = 0; o[4] = 255; fn(x, y, o);
    const i = y * size + x, j = i * 4;
    d[j] = o[0]; d[j + 1] = o[1]; d[j + 2] = o[2]; d[j + 3] = o[4]; H[i] = o[3];
  }
  ctx.putImageData(img, 0, 0);
  return { c, H, w: size, h };
}
function normalMap(g, strength) {
  const { H, w, h } = g, c = mkCanvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const hl = H[y * w + ((x - 1 + w) % w)], hr = H[y * w + ((x + 1) % w)];
    const hu = H[((y - 1 + h) % h) * w + x], hd = H[((y + 1) % h) * w + x];
    let nx = (hl - hr) * strength, ny = (hd - hu) * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const j = (y * w + x) * 4;
    d[j] = (nx * 0.5 + 0.5) * 255; d[j + 1] = (ny * 0.5 + 0.5) * 255; d[j + 2] = (nz * 0.5 + 0.5) * 255; d[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return toTex(c, false);
}

/* ---------------- individual generators ---------------- */
function genPlaster() {
  return genTex(512, (x, y, o) => {
    const u = x / 512, v = y / 512;
    const n = tfbm(u, v, 4, 5), fine = tnoise(u * 128, v * 128, 128);
    const patch = tfbm(u + 0.37, v + 0.11, 3, 4);
    if (patch > 0.72) {
      const row = Math.floor(y / 22), off = (row & 1) ? 30 : 0, bx = (x + off) % 60, by = y % 22;
      const mortar = bx < 3 || by < 3;
      const id = hashf(Math.floor((x + off) / 60), row);
      if (mortar) { o[0] = 150; o[1] = 142; o[2] = 128; o[3] = -0.9; }
      else { const k = 0.8 + id * 0.35 + (fine - 0.5) * 0.2; o[0] = 150 * k; o[1] = 78 * k; o[2] = 60 * k; o[3] = -0.45 + fine * 0.1; }
      return;
    }
    const rim = smoothstep(0.66, 0.72, patch);
    const st = tfbm(u, v + 0.5, 2, 3);
    let b = 232 + (n - 0.5) * 46 + (fine - 0.5) * 16 - rim * 55;
    if (st > 0.58) b -= (st - 0.58) * 120;
    o[0] = b; o[1] = b * 0.975; o[2] = b * 0.93;
    o[3] = n * 0.35 + fine * 0.12 - rim * 0.3;
  });
}
function genStone() {
  return genTex(512, (x, y, o) => {
    const u = x / 512, v = y / 512;
    const row = Math.floor(y / 64), off = Math.floor(hash2(row, 3) * 128), xx = x + off;
    const bw = 128, bx = xx % bw, by = y % 64, id = hashf(Math.floor(xx / bw) & 3, row);
    const ex = Math.min(bx, bw - bx), ey = Math.min(by, 64 - by), edge = Math.min(ex, ey);
    const n = tfbm(u, v, 8, 4), f = tnoise(u * 256, v * 256, 256);
    if (edge < 3) { const m = 95 + n * 40; o[0] = m; o[1] = m * 0.96; o[2] = m * 0.9; o[3] = -0.6; return; }
    const k = 0.78 + id * 0.3 + (n - 0.5) * 0.35 + (f - 0.5) * 0.12;
    o[0] = 196 * k; o[1] = 186 * k; o[2] = 166 * k;
    o[3] = Math.min(1, edge / 9) * 0.6 + n * 0.5 + f * 0.1;
  });
}
function genBrick() {
  return genTex(256, (x, y, o) => {
    const u = x / 256, v = y / 256;
    const row = Math.floor(y / 16), off = (row & 1) ? 16 : 0, bx = (x + off) % 32, by = y % 16;
    const n = tfbm(u, v, 8, 3), f = tnoise(u * 128, v * 128, 128);
    if (bx < 2 || by < 2) { o[0] = 170; o[1] = 160; o[2] = 145; o[3] = -0.5; return; }
    const id = hashf(Math.floor((x + off) / 32) & 7, row & 15);
    const k = 0.75 + id * 0.4 + (f - 0.5) * 0.2;
    o[0] = 160 * k; o[1] = 76 * k * (0.9 + n * 0.2); o[2] = 56 * k; o[3] = 0.4 + n * 0.3;
  });
}
function genCobble() {
  const S = 512, C = 16, cs = S / C, pts = [];
  for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) pts.push([(i + 0.2 + hashf(i, j) * 0.6) * cs, (j + 0.2 + hashf(j + 50, i) * 0.6) * cs]);
  return genTex(S, (x, y, o) => {
    const ci = Math.floor(x / cs), cj = Math.floor(y / cs);
    let d1 = 1e9, d2 = 1e9, id = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = (ci + di + C) % C, jj = (cj + dj + C) % C, p = pts[jj * C + ii];
      const px = p[0] + (ci + di - ii) * cs, py = p[1] + (cj + dj - jj) * cs;
      const d = Math.hypot(x - px, y - py);
      if (d < d1) { d2 = d1; d1 = d; id = jj * C + ii; } else if (d < d2) d2 = d;
    }
    const e = d2 - d1, n = tnoise(x / 8, y / 8, S / 8);
    if (e < 3) { const m = 70 + n * 30; o[0] = m; o[1] = m * 0.93; o[2] = m * 0.82; o[3] = -0.3; return; }
    const r = hash2(id, 7), k = 0.72 + r * 0.38 + (n - 0.5) * 0.2;
    o[0] = 150 * k; o[1] = 142 * k; o[2] = 128 * k * (0.9 + hash2(id, 3) * 0.2);
    o[3] = Math.sqrt(Math.min(1, e / 12)) + n * 0.15;
  });
}
function genRoof() {
  return genTex(256, (x, y, o) => {
    const row = Math.floor(y / 32), off = (row & 1) ? 16 : 0, bx = (x + off) % 32, by = y % 32;
    const id = hashf(Math.floor((x + off) / 32) & 7, row & 7), n = tnoise(x / 16, y / 16, 16);
    const shade = 0.55 + (by / 32) * 0.45;
    const gap = bx < 1.5 ? 0.5 : 1;
    const k = shade * gap * (0.8 + id * 0.35) * (0.85 + n * 0.3);
    o[0] = 150 * k; o[1] = 72 * k; o[2] = 52 * k; o[3] = by / 32 * 0.8 + n * 0.2;
  });
}
function genWood() {
  return genTex(256, (x, y, o) => {
    const plank = Math.floor(x / 32), bx = x % 32;
    const id = hashf(plank, 9);
    const g = tnoise(x / 4 + id * 40, y / 32, 8) * 0.5 + tnoise(x / 2, y / 8, 32) * 0.5;
    if (bx < 1.5) { o[0] = 40; o[1] = 30; o[2] = 22; o[3] = -0.6; return; }
    const k = 0.7 + id * 0.45 + (g - 0.5) * 0.5;
    o[0] = 140 * k; o[1] = 104 * k; o[2] = 70 * k; o[3] = g * 0.4;
  });
}
function genWalnut() {
  return genTex(256, (x, y, o) => {
    const u = x / 256, v = y / 256;
    const w = tnoise(u * 2, v * 3, 2) * 0.6;
    const g = tnoise(u * 4 + w * 3, v * 70, 70) * 0.6 + tnoise(u * 8, v * 140, 140) * 0.4;
    const fig = tfbm(u, v, 4, 3);
    const k = 0.6 + g * 0.55 + (fig - 0.5) * 0.3;
    o[0] = 120 * k; o[1] = 76 * k; o[2] = 46 * k; o[3] = g * 0.2;
  });
}
function genSteel() {
  return genTex(256, (x, y, o) => {
    const u = x / 256, v = y / 256;
    const f = tnoise(u * 256, v * 256, 256), n = tfbm(u, v, 4, 4);
    const wear = smoothstep(0.7, 0.85, tfbm(u + 0.3, v, 16, 3));
    const k = 70 + f * 26 + (n - 0.5) * 16 + wear * 45;
    o[0] = k; o[1] = k * 1.01; o[2] = k * 1.04; o[3] = f * 0.2;
  });
}
function genFabric() {
  return genTex(256, (x, y, o) => {
    const w = ((x >> 1) + (y >> 1)) & 1;
    const n = tnoise(x / 32, y / 32, 8), f = tnoise(x / 2, y / 2, 128);
    const k = 200 + (w ? 18 : -6) + (n - 0.5) * 60 + (f - 0.5) * 16;
    o[0] = k; o[1] = k; o[2] = k * 0.97; o[3] = w * 0.3 + n * 0.3;
  });
}
function genBurlap() {
  return genTex(128, (x, y, o) => {
    const wx = Math.sin(x * Math.PI / 2) * 0.5 + 0.5, wy = Math.sin(y * Math.PI / 2) * 0.5 + 0.5;
    const n = tnoise(x / 16, y / 16, 8);
    const k = 170 + (wx * wy) * 50 + (n - 0.5) * 70;
    o[0] = k; o[1] = k * 0.9; o[2] = k * 0.7; o[3] = wx * wy;
  });
}
function genConcrete() {
  return genTex(512, (x, y, o) => {
    const u = x / 512, v = y / 512;
    const n = tfbm(u, v, 4, 5), f = tnoise(u * 256, v * 256, 256);
    const board = (y % 64) < 2 ? -18 : 0;
    const pit = f > 0.9 ? -40 : 0;
    const st = smoothstep(0.55, 0.75, tfbm(u + 0.2, v * 0.3, 3, 3)) * 40;
    const k = 168 + (n - 0.5) * 60 + (f - 0.5) * 20 + board + pit - st;
    o[0] = k; o[1] = k * 0.99; o[2] = k * 0.95; o[3] = n * 0.4 + (pit ? -0.4 : 0) + (board ? -0.2 : 0);
  });
}
function genGround() {
  return genTex(512, (x, y, o) => {
    const u = x / 512, v = y / 512;
    const n = tfbm(u, v, 8, 5), f = tnoise(u * 256, v * 256, 256), p = tnoise(u * 64, v * 64, 64);
    let k = 190 + (n - 0.5) * 90 + (f - 0.5) * 30;
    let h = n * 0.6 + f * 0.2;
    if (p > 0.72) { k += (p - 0.72) * 200; h += (p - 0.72) * 3; }
    o[0] = k; o[1] = k * 0.98; o[2] = k * 0.94; o[3] = h;
  });
}
function genMetal() {
  return genTex(256, (x, y, o) => {
    const u = x / 256, v = y / 256;
    const n = tfbm(u, v, 4, 4), f = tnoise(u * 128, v * 128, 128);
    const chip = smoothstep(0.68, 0.72, tfbm(u + 0.5, v + 0.2, 8, 3));
    const rust = smoothstep(0.6, 0.8, tfbm(u + 0.1, v + 0.7, 4, 3));
    const scratch = (Math.abs(((x * 0.7 + y * 0.3) % 37) - 18) < 0.5 && f > 0.6) ? 50 : 0;
    let r = 205 + (n - 0.5) * 50 + (f - 0.5) * 16, g = r, b = r;
    r = lerp(r, 150, rust * 0.6); g = lerp(g, 90, rust * 0.6); b = lerp(b, 60, rust * 0.6);
    r = lerp(r, 110, chip); g = lerp(g, 108, chip); b = lerp(b, 104, chip);
    o[0] = r + scratch; o[1] = g + scratch; o[2] = b + scratch; o[3] = n * 0.3 - chip * 0.3;
  });
}
function genCamo() {
  return genTex(256, (x, y, o) => {
    const u = x / 256, v = y / 256;
    const a = tfbm(u, v, 3, 4), b = tfbm(u + 0.4, v + 0.9, 3, 4), f = tnoise(u * 128, v * 128, 128);
    let c = [196, 170, 110];
    if (a > 0.6) c = [92, 98, 62]; else if (b > 0.63) c = [120, 70, 50];
    const k = 0.85 + (f - 0.5) * 0.2 + (tfbm(u, v, 8, 3) - 0.5) * 0.3;
    o[0] = c[0] * k; o[1] = c[1] * k; o[2] = c[2] * k; o[3] = f * 0.2;
  });
}
function genBark() {
  return genTex(256, (x, y, o) => {
    const u = x / 256, v = y / 256;
    const r = tnoise(u * 24, v * 3, 24) * 0.7 + tnoise(u * 48, v * 8, 48) * 0.3;
    const k = 60 + r * 90;
    o[0] = k * 0.95; o[1] = k * 0.85; o[2] = k * 0.72; o[3] = r;
  });
}
function genSnow() {
  return genTex(256, (x, y, o) => {
    const u = x / 256, v = y / 256, n = tfbm(u, v, 8, 4), f = tnoise(u * 128, v * 128, 128);
    const k = 225 + (n - 0.5) * 40 + (f - 0.5) * 14;
    o[0] = k * 0.97; o[1] = k * 0.99; o[2] = k * 1.03; o[3] = n;
  });
}
function genChecker() {
  return genTex(256, (x, y, o) => {
    const t = ((x >> 5) + (y >> 5)) & 1, n = tnoise(x / 16, y / 16, 16), f = tnoise(x / 2, y / 2, 128);
    const k = t ? 214 + (n - 0.5) * 30 : 36 + (n - 0.5) * 16;
    const g = ((x & 31) < 1 || (y & 31) < 1) ? 0.8 : 1;
    o[0] = k * g + (f - 0.5) * 8; o[1] = k * g * 0.98; o[2] = k * g * 0.93; o[3] = g < 1 ? -0.3 : 0;
  });
}
function genWallpaper() {
  return genTex(256, (x, y, o) => {
    const stripe = (x % 32) < 3 ? 0.88 : 1;
    const dx = (x % 32) - 17, dy = (y % 32) - 16, dot = (dx * dx + dy * dy) < 10 ? 0.9 : 1;
    const n = tnoise(x / 32, y / 32, 8);
    const k = stripe * dot * (0.95 + n * 0.08);
    o[0] = 196 * k; o[1] = 206 * k; o[2] = 176 * k;
  });
}
function genLeaves(autumn) {
  const S = 256, c = mkCanvas(S), g = c.getContext('2d');
  const rng = mulberry32(autumn ? 99 : 42);
  g.strokeStyle = 'rgba(70,52,34,1)'; g.lineWidth = 2;
  for (let i = 0; i < 7; i++) { g.beginPath(); const x = rng() * S, y = rng() * S; g.moveTo(x, y); g.quadraticCurveTo(x + (rng() - 0.5) * 80, y + (rng() - 0.5) * 80, x + (rng() - 0.5) * 120, y + (rng() - 0.5) * 120); g.stroke(); }
  const pals = autumn
    ? [[196, 138, 44], [178, 96, 32], [150, 140, 50], [110, 120, 46], [205, 160, 70], [140, 70, 30]]
    : [[74, 100, 40], [58, 84, 34], [96, 118, 50], [48, 70, 30], [110, 128, 60], [66, 92, 44]];
  for (let i = 0; i < 520; i++) {
    const x = rng() * S, y = rng() * S, r = 6 + rng() * 7, a = rng() * TAU;
    const p = pals[Math.floor(rng() * pals.length)], k = 0.7 + rng() * 0.5;
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = `rgb(${p[0] * k | 0},${p[1] * k | 0},${p[2] * k | 0})`;
    g.beginPath(); g.ellipse(0, 0, r, r * 0.45, 0, 0, TAU); g.fill();
    g.strokeStyle = `rgba(0,0,0,.18)`; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0); g.stroke();
    g.restore();
  }
  // soften edges into alpha falloff so the clump reads round
  const id = g.getImageData(0, 0, S, S), d = id.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x - S / 2) / (S / 2), dy = (y - S / 2) / (S / 2), r = Math.sqrt(dx * dx + dy * dy);
    const j = (y * S + x) * 4;
    if (r > 0.98 - tnoise(x / 20, y / 20, 13) * 0.35) d[j + 3] = 0;
  }
  g.putImageData(id, 0, 0);
  const t = toTex(c, true, false); t.premultiplyAlpha = false; return t;
}
function genGrassBlades() {
  const S = 256, c = mkCanvas(S), g = c.getContext('2d'), rng = mulberry32(5);
  for (let i = 0; i < 90; i++) {
    const x = 8 + rng() * (S - 16), h = S * (0.45 + rng() * 0.55), lean = (rng() - 0.5) * 70, w = 3 + rng() * 4;
    const k = 0.7 + rng() * 0.5, dry = rng() < 0.3;
    g.fillStyle = dry ? `rgb(${176 * k | 0},${162 * k | 0},${98 * k | 0})` : `rgb(${112 * k | 0},${142 * k | 0},${66 * k | 0})`;
    g.beginPath(); g.moveTo(x - w / 2, S); g.quadraticCurveTo(x + lean * 0.3, S - h * 0.6, x + lean, S - h); g.quadraticCurveTo(x + lean * 0.3 + w * 0.3, S - h * 0.6, x + w / 2, S); g.fill();
  }
  const t = toTex(c, true, false); return t;
}
function genSoft(size, fnAlpha, rgb = [255, 255, 255]) {
  const c = mkCanvas(size), g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size * 2 - 1, v = (y + 0.5) / size * 2 - 1, j = (y * size + x) * 4;
    const a = clamp(fnAlpha(u, v, x, y), 0, 1);
    const cc = typeof rgb === 'function' ? rgb(u, v) : rgb;
    d[j] = cc[0]; d[j + 1] = cc[1]; d[j + 2] = cc[2]; d[j + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); return t;
}
function genTextTex(w, h, draw, srgb = true) {
  const c = mkCanvas(w, h), g = c.getContext('2d'); draw(g, w, h);
  const t = toTex(c, srgb, false); return t;
}

/* ---------- text-based props (newspaper, posters, signs) ---------- */
function paperBg(g, w, h, base = [226, 216, 190]) {
  g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(90,70,40,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(90,60,20,.35)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
}
function textLines(g, x, y, w, lines, lh) { for (let i = 0; i < lines; i++) { const lw = w * (0.7 + Math.random() * 0.3); g.fillRect(x, y + i * lh, lw, lh * 0.45); } }
function makeNewspaper() {
  return genTextTex(512, 640, (g, w, h) => {
    paperBg(g, w, h, [222, 214, 192]);
    g.fillStyle = '#1b1914'; g.textAlign = 'center';
    g.font = 'bold 34px Georgia, serif'; g.fillText('The Allentown Chronicle', w / 2, 52);
    g.fillRect(24, 64, w - 48, 3); g.font = '14px Georgia, serif'; g.fillText('MONDAY, DECEMBER 8, 1941        EXTRA        THREE CENTS', w / 2, 84); g.fillRect(24, 92, w - 48, 1.5);
    g.font = 'bold 66px Impact, "Arial Black", sans-serif'; g.fillText('JAPAN WARS', w / 2, 168); g.fillText('ON U.S.', w / 2, 236);
    g.font = 'bold 26px Georgia, serif'; g.fillText('Bombs Hawaii; Heavy Losses at Pearl Harbor', w / 2, 278);
    g.font = 'bold 18px Georgia, serif'; g.fillText('President to Address Congress at 12:30', w / 2, 306);
    g.fillStyle = 'rgba(30,28,22,.75)';
    for (let c = 0; c < 3; c++) textLines(g, 30 + c * 158, 326, 140, 26, 11);
    g.fillStyle = '#2a261f'; g.fillRect(190, 330, 136, 110); g.fillStyle = '#6d665a'; g.fillRect(196, 336, 124, 98);
  });
}
function makePoster(kind) {
  return genTextTex(256, 360, (g, w, h) => {
    paperBg(g, w, h, kind === 'army' ? [232, 222, 200] : [214, 196, 160]);
    g.textAlign = 'center';
    if (kind === 'army') {
      g.fillStyle = '#243a6b'; g.fillRect(0, 0, w, 70); g.fillStyle = '#efe6d2'; g.font = 'bold 30px Impact, sans-serif'; g.fillText('U.S. ARMY', w / 2, 46);
      g.fillStyle = '#9b2a22'; g.font = 'bold 44px Impact, sans-serif'; g.fillText('ENLIST', w / 2, 140); g.fillText('NOW', w / 2, 190);
      g.fillStyle = '#243a6b'; g.font = 'bold 18px Georgia, serif'; g.fillText('Serve Your Country', w / 2, 232);
      for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#efe6d2' : '#9b2a22'; g.fillRect(0, 260 + i * 7.7, w, 7.7); }
    } else if (kind === 'bonds') {
      g.fillStyle = '#2d4b2e'; g.font = 'bold 34px Impact, sans-serif'; g.fillText('BUY', w / 2, 70); g.fillText('DEFENSE', w / 2, 112); g.fillText('BONDS', w / 2, 154);
      g.fillStyle = '#7a1c16'; g.beginPath(); g.arc(w / 2, 240, 60, 0, TAU); g.fill(); g.fillStyle = '#e8dcc0'; g.font = 'bold 22px Georgia'; g.fillText('AMERICA', w / 2, 248);
    } else {
      g.fillStyle = '#3a2e22'; g.font = 'bold 26px Georgia, serif'; g.fillText('DECEMBER', w / 2, 40); g.fillText('1941', w / 2, 70);
      g.font = '15px Georgia'; const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      days.forEach((d, i) => g.fillText(d, 28 + i * 33, 110));
      let day = 1; for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) { if (r === 0 && c < 1) continue; if (day > 31) break; g.fillStyle = day === 7 ? '#9b2a22' : '#3a2e22'; g.fillText(String(day), 28 + c * 33, 140 + r * 34); if (day === 8) { g.strokeStyle = '#9b2a22'; g.lineWidth = 2; g.beginPath(); g.arc(28 + c * 33, 135 + r * 34, 13, 0, TAU); g.stroke(); } day++; }
    }
  });
}
function makeSign(text, o = {}) {
  const w = o.w || 512, h = o.h || 96;
  return genTextTex(w, h, (g) => {
    g.fillStyle = o.bg || '#1f2a22'; g.fillRect(0, 0, w, h);
    if (o.border !== false) { g.strokeStyle = o.fg || '#e9dfc4'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16); }
    g.fillStyle = o.fg || '#e9dfc4'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = o.font || `bold ${Math.floor(h * 0.45)}px Georgia, serif`; g.fillText(text, w / 2, h / 2 + 2);
    if (o.grime !== false) for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  });
}
function makePhoto() {
  return genTextTex(256, 320, (g, w, h) => {
    g.fillStyle = '#2a2016'; g.fillRect(0, 0, w, h); g.fillStyle = '#c8b28c'; g.fillRect(14, 14, w - 28, h - 28);
    const gr = g.createLinearGradient(0, 14, 0, h - 14); gr.addColorStop(0, '#a88d68'); gr.addColorStop(1, '#6d5840'); g.fillStyle = gr; g.fillRect(24, 24, w - 48, h - 72);
    g.fillStyle = '#3a2d1f';
    g.beginPath(); g.ellipse(w / 2, 108, 30, 36, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(w / 2, 82, 50, 14, 0, 0, TAU); g.fill(); g.fillRect(w / 2 - 32, 60, 64, 24);
    g.beginPath(); g.moveTo(w / 2 - 70, 250); g.quadraticCurveTo(w / 2, 120, w / 2 + 70, 250); g.fill();
    g.fillStyle = '#5a4630'; g.fillRect(w / 2 - 4, 150, 8, 90);
    g.fillStyle = '#3a2d1f'; g.font = 'italic 16px Georgia'; g.textAlign = 'center'; g.fillText('W. Kessler — 1918', w / 2, h - 28);
  });
}
function makeLabelTex(text, color = '#e7dcc0', bg = null, w = 256, h = 64) {
  return genTextTex(w, h, (g) => { if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.floor(h * 0.62)}px Georgia, serif`; g.fillText(text, w / 2, h / 2); });
}
function makeStar(colorStr = '#f2f0ea', bg = null) {
  return genTextTex(256, 256, (g, w, h) => {
    if (bg) { g.fillStyle = bg; g.beginPath(); g.arc(w / 2, h / 2, w * 0.48, 0, TAU); g.fill(); }
    g.strokeStyle = colorStr; g.lineWidth = 10; g.beginPath(); g.arc(w / 2, h / 2, w * 0.42, 0, TAU); g.stroke();
    g.fillStyle = colorStr; g.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? w * 0.15 : w * 0.38, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); }
    g.closePath(); g.fill();
  });
}

/* ---------------- material library ---------------- */
function std(o) { return new THREE.MeshStandardMaterial(o); }
function uvs(m, s) { m.userData.uvs = s; return m; }

async function initTextures(progress) {
  const steps = [
    ['plaster', () => genPlaster(), 3.2], ['stone', () => genStone(), 3], ['brick', () => genBrick(), 2.5],
    ['cobble', () => genCobble(), 2.2], ['roof', () => genRoof(), 1.4], ['wood', () => genWood(), 2],
    ['walnut', () => genWalnut(), 1.2], ['steel', () => genSteel(), 1], ['fabric', () => genFabric(), 1],
    ['burlap', () => genBurlap(), 2], ['concrete', () => genConcrete(), 2], ['ground', () => genGround(), 1.6],
    ['metal', () => genMetal(), 1.2], ['camo', () => genCamo(), 1], ['bark', () => genBark(), 1.5],
    ['snow', () => genSnow(), 1], ['checker', () => genChecker(), 0.8], ['wallpaper', () => genWallpaper(), 1],
  ];
  const G = {};
  for (let i = 0; i < steps.length; i++) {
    const [name, fn, ns] = steps[i];
    progress && progress(i / (steps.length + 4), 'Painting ' + name);
    await new Promise(r => setTimeout(r, 0));
    const g = fn();
    TEX[name] = toTex(g.c);
    TEX[name + 'N'] = normalMap(g, ns * 2.2);
  }
  progress && progress(0.85, 'Growing foliage');
  await new Promise(r => setTimeout(r, 0));
  TEX.leaves = genLeaves(false); TEX.leavesAutumn = genLeaves(true); TEX.grass = genGrassBlades();
  TEX.smoke = genSoft(128, (u, v, x, y) => { const r = Math.sqrt(u * u + v * v); return (1 - smoothstep(0.2, 1, r)) * (0.55 + 0.45 * tnoise(x / 12, y / 12, 11)); });
  TEX.flash = genSoft(128, (u, v) => {
    const r = Math.sqrt(u * u + v * v), a = Math.atan2(v, u);
    const spikes = Math.pow(Math.abs(Math.cos(a * 3.5)), 18) * (1 - r) * 1.2;
    return clamp((1 - smoothstep(0, 0.45, r)) + spikes, 0, 1);
  }, (u, v) => { const r = Math.sqrt(u * u + v * v); return [255, 230 - r * 90, 170 - r * 150]; });
  TEX.spark = genSoft(32, (u, v) => { const r = Math.sqrt(u * u + v * v); return Math.pow(1 - clamp(r, 0, 1), 2.5); });
  TEX.hole = genSoft(64, (u, v, x, y) => { const r = Math.sqrt(u * u + v * v); return r < 0.18 ? 1 : (1 - smoothstep(0.18, 0.9, r)) * 0.75 * (0.6 + 0.4 * tnoise(x / 4, y / 4, 16)); }, (u, v) => { const r = Math.sqrt(u * u + v * v); return r < 0.18 ? [8, 7, 6] : [40, 36, 30]; });
  TEX.scorch = genSoft(128, (u, v, x, y) => { const r = Math.sqrt(u * u + v * v); return (1 - smoothstep(0.25, 1, r + (tnoise(x / 10, y / 10, 13) - 0.5) * 0.4)) * 0.9; }, [14, 12, 10]);
  TEX.water = (() => { const g = genTex(256, (x, y, o) => { const u = x / 256, v = y / 256; o[3] = tfbm(u, v, 4, 4) * 0.7 + tnoise(u * 32, v * 32, 32) * 0.3; }); return normalMap(g, 5); })();
  TEX.marker = makeStar('#ece6d8');
  progress && progress(0.95, 'Issuing materials');

  const n = (k, s = 0.8) => ({ normalMap: TEX[k + 'N'], normalScale: new THREE.Vector2(s, s) });
  MAT.plaster = uvs(std({ map: TEX.plaster, ...n('plaster', 0.7), color: col(0xe9e1cf), roughness: 0.95 }), 3.2);
  MAT.plasterPink = uvs(std({ map: TEX.plaster, ...n('plaster', 0.7), color: col(0xd88a80), roughness: 0.93 }), 3.2);
  MAT.plasterGrey = uvs(std({ map: TEX.plaster, ...n('plaster', 0.7), color: col(0xb9b3a6), roughness: 0.95 }), 3.2);
  MAT.plasterWhite = uvs(std({ map: TEX.plaster, ...n('plaster', 0.6), color: col(0xf2eee4), roughness: 0.9 }), 3.2);
  MAT.plasterOchre = uvs(std({ map: TEX.plaster, ...n('plaster', 0.7), color: col(0xd8bf8c), roughness: 0.95 }), 3.2);
  MAT.stone = uvs(std({ map: TEX.stone, ...n('stone', 1), color: col(0xd6ccb8), roughness: 0.92 }), 3.0);
  MAT.stoneDark = uvs(std({ map: TEX.stone, ...n('stone', 1), color: col(0x9d968a), roughness: 0.95 }), 3.0);
  MAT.brick = uvs(std({ map: TEX.brick, ...n('brick', 1), roughness: 0.9 }), 1.6);
  MAT.brickDark = uvs(std({ map: TEX.brick, ...n('brick', 1), color: col(0x8a7066), roughness: 0.9 }), 1.6);
  MAT.cobble = uvs(std({ map: TEX.cobble, ...n('cobble', 1.2), color: col(0xc2baa8), roughness: 0.85 }), 3.2);
  MAT.roof = uvs(std({ map: TEX.roof, ...n('roof', 1), roughness: 0.8 }), 1.6);
  MAT.roofSlate = uvs(std({ map: TEX.roof, ...n('roof', 1), color: col(0x8898a8), roughness: 0.7 }), 1.6);
  MAT.wood = uvs(std({ map: TEX.wood, ...n('wood', 0.8), roughness: 0.85 }), 2);
  MAT.woodDark = uvs(std({ map: TEX.wood, ...n('wood', 0.8), color: col(0x7a6450), roughness: 0.85 }), 2);
  MAT.woodPaint = uvs(std({ map: TEX.wood, ...n('wood', 0.5), color: col(0x6d7c64), roughness: 0.8 }), 2);
  MAT.concrete = uvs(std({ map: TEX.concrete, ...n('concrete', 1), color: col(0xc9c4b8), roughness: 0.95 }), 4);
  MAT.ground = uvs(std({ map: TEX.ground, ...n('ground', 1.1), vertexColors: true, roughness: 0.97 }), 3.2);
  MAT.metal = uvs(std({ map: TEX.metal, ...n('metal', 0.5), color: col(0x6c6c68), metalness: 0.7, roughness: 0.55 }), 1.5);
  MAT.metalDark = uvs(std({ map: TEX.metal, ...n('metal', 0.5), color: col(0x3c3d3a), metalness: 0.75, roughness: 0.5 }), 1.5);
  MAT.rust = uvs(std({ map: TEX.metal, ...n('metal', 0.8), color: col(0x7c5a44), metalness: 0.5, roughness: 0.8 }), 1.5);
  MAT.od = uvs(std({ map: TEX.metal, ...n('metal', 0.5), color: col(0x5f6440), metalness: 0.35, roughness: 0.7 }), 2);
  MAT.panzer = uvs(std({ map: TEX.camo, ...n('camo', 0.4), metalness: 0.3, roughness: 0.75 }), 3);
  MAT.fgrey = uvs(std({ map: TEX.metal, ...n('metal', 0.5), color: col(0x646a5a), metalness: 0.3, roughness: 0.75 }), 2);
  MAT.burlap = std({ map: TEX.burlap, ...n('burlap', 1), color: col(0xb9a57e), roughness: 1 });
  MAT.bark = uvs(std({ map: TEX.bark, ...n('bark', 1.2), roughness: 1 }), 1.2);
  MAT.snow = uvs(std({ map: TEX.snow, ...n('snow', 0.5), roughness: 0.8, color: col(0xf2f4f8) }), 3);
  MAT.checker = uvs(std({ map: TEX.checker, ...n('checker', 0.3), roughness: 0.35 }), 1.6);
  MAT.wallpaper = uvs(std({ map: TEX.wallpaper, roughness: 0.9 }), 1.6);
  MAT.chrome = std({ color: col(0xd8dadc), metalness: 1, roughness: 0.18 });
  MAT.vinylRed = std({ map: TEX.fabric, color: col(0xa3302a), roughness: 0.45 });
  MAT.counter = std({ color: col(0xd9cfb8), roughness: 0.35 });
  MAT.glass = std({ color: col(0x8fa4a8), roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false });
  MAT.dark = std({ color: col(0x121210), roughness: 1 });
  MAT.interior = std({ color: col(0x1d1a16), roughness: 1 });
  MAT.black = std({ color: col(0x0a0a0a), roughness: 0.6 });
  MAT.rope = std({ color: col(0x4a4034), roughness: 0.9, metalness: 0.2 });
  MAT.wire = std({ color: col(0x3a3630), roughness: 0.6, metalness: 0.8 });
  MAT.rubber = std({ color: col(0x1e1e1c), roughness: 0.9 });
  MAT.track = uvs(std({ map: TEX.steel, color: col(0x4a4640), metalness: 0.6, roughness: 0.8 }), 0.6);
  MAT.leaves = std({ map: TEX.leaves, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, color: col(0xd8e0c8) });
  MAT.leavesAutumn = std({ map: TEX.leavesAutumn, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
  MAT.leavesDark = std({ map: TEX.leaves, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, color: col(0x8f9c86) });
  MAT.grass = std({ map: TEX.grass, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95 });
  MAT.water = std({ color: col(0x3e5a58), roughness: 0.12, metalness: 0.1, normalMap: TEX.water, normalScale: new THREE.Vector2(0.6, 0.6), transparent: true, opacity: 0.88 });
  MAT.emissiveWarm = new THREE.MeshBasicMaterial({ color: col(0xffd9a0) });
  MAT.windowLit = std({ color: col(0x2a2418), emissive: col(0xd8a860), emissiveIntensity: 0.9, roughness: 0.3 });

  // characters / fabrics
  MAT.usJacket = std({ map: TEX.fabric, ...n('fabric', 0.5), color: col(0x8b7f5b), roughness: 0.95 });
  MAT.usHBT = std({ map: TEX.fabric, ...n('fabric', 0.5), color: col(0x6c6b4c), roughness: 0.95 });
  MAT.usPants = std({ map: TEX.fabric, ...n('fabric', 0.5), color: col(0x6f6647), roughness: 0.95 });
  MAT.usHelmet = std({ map: TEX.metal, color: col(0x535637), roughness: 0.85, metalness: 0.2 });
  MAT.usNet = std({ color: col(0x3f3a28), roughness: 1, wireframe: true });
  MAT.webbing = std({ map: TEX.fabric, color: col(0x9e9270), roughness: 1 });
  MAT.legging = std({ map: TEX.fabric, color: col(0xb0a47e), roughness: 1 });
  MAT.boot = std({ color: col(0x4a3222), roughness: 0.7 });
  MAT.bootBlack = std({ color: col(0x161412), roughness: 0.5 });
  MAT.deTunic = std({ map: TEX.fabric, ...n('fabric', 0.5), color: col(0x626656), roughness: 0.95 });
  MAT.dePants = std({ map: TEX.fabric, ...n('fabric', 0.5), color: col(0x5a5d52), roughness: 0.95 });
  MAT.deHelmet = std({ map: TEX.metal, color: col(0x4f5549), roughness: 0.6, metalness: 0.35 });
  MAT.leather = std({ color: col(0x2c2016), roughness: 0.55 });
  MAT.leatherBrown = std({ color: col(0x5a3a22), roughness: 0.6 });
  MAT.hairDark = std({ color: col(0x241a12), roughness: 0.8 });
  MAT.hairBrown = std({ color: col(0x5a3d22), roughness: 0.8 });
  MAT.hairBlond = std({ color: col(0xa88a55), roughness: 0.8 });
  MAT.hairGrey = std({ color: col(0x8d8a84), roughness: 0.8 });
  MAT.eye = std({ color: col(0x1a1612), roughness: 0.2 });
  MAT.skins = [0xc9977a, 0xb88564, 0xd8a88a, 0x9a6a4c, 0xc49070, 0x7a5038].map(h => std({ color: col(h), roughness: 0.62 }));
  MAT.civShirt = std({ map: TEX.fabric, color: col(0xe8e4d8), roughness: 0.9 });
  MAT.civSuit = std({ map: TEX.fabric, color: col(0x3c3a38), roughness: 0.9 });
  MAT.civCoat = std({ map: TEX.fabric, color: col(0x5b4a3a), roughness: 0.95 });
  MAT.civCoatGrey = std({ map: TEX.fabric, color: col(0x6d6b66), roughness: 0.95 });
  MAT.civLeather = std({ color: col(0x4a3020), roughness: 0.5 });
  MAT.dress = std({ map: TEX.fabric, color: col(0x6f8aa0), roughness: 0.9 });
  MAT.dressRed = std({ map: TEX.fabric, color: col(0x8f3a34), roughness: 0.9 });
  MAT.apron = std({ map: TEX.fabric, color: col(0xf0ece2), roughness: 0.95 });
  MAT.khaki = std({ map: TEX.fabric, color: col(0xa89870), roughness: 0.9 });

  // weapons
  MAT.walnut = std({ map: TEX.walnut, color: col(0xc4a88e), roughness: 0.5, metalness: 0.0 });
  MAT.walnutDark = std({ map: TEX.walnut, color: col(0x8a6a50), roughness: 0.5 });
  MAT.gunSteel = std({ map: TEX.steel, color: col(0x8a8c90), metalness: 0.6, roughness: 0.5 });
  MAT.gunBlue = std({ map: TEX.steel, color: col(0x6a707c), metalness: 0.7, roughness: 0.36 });
  MAT.gunBlack = std({ map: TEX.steel, color: col(0x55575a), metalness: 0.6, roughness: 0.48 });
  MAT.brass = std({ color: col(0xd7a55a), metalness: 1, roughness: 0.28 });
  MAT.copper = std({ color: col(0xc27a4a), metalness: 1, roughness: 0.3 });
  MAT.sling = std({ map: TEX.fabric, color: col(0x5a3c22), roughness: 0.75 });
  MAT.slingWeb = std({ map: TEX.fabric, color: col(0x8f8663), roughness: 0.95 });
  MAT.grip = std({ color: col(0x3b2618), roughness: 0.6 });
  MAT.grenade = std({ map: TEX.metal, color: col(0x565c3a), roughness: 0.6, metalness: 0.4 });
  progress && progress(1, 'Ready');
}
