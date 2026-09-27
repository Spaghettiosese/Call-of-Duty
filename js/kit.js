'use strict';
/* =====================================================================
   KIT — level construction helpers. All static geometry goes through
   the current Batcher (KIT.b) and registers colliders with World.
   ===================================================================== */
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
function mtx(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) { _e.set(rx, ry, rz); _q.setFromEuler(_e); _s.set(sx, sy, sz); _p.set(x, y, z); return _m4.compose(_p, _q, _s); }
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1); UNIT_BOX.userData.shared = true;
const rockGeos = [];
function rockGeo(i) {
  if (!rockGeos.length) for (let k = 0; k < 8; k++) {
    const g = new THREE.IcosahedronGeometry(1, k < 6 ? 1 : 3), p = g.attributes.position, r = mulberry32(k * 31 + 7);
    const map = new Map();
    for (let j = 0; j < p.count; j++) {
      const key = `${p.getX(j).toFixed(3)},${p.getY(j).toFixed(3)},${p.getZ(j).toFixed(3)}`;
      let f = map.get(key); if (f == null) { f = 0.72 + r() * 0.5; map.set(key, f); }
      p.setXYZ(j, p.getX(j) * f, p.getY(j) * f * 0.75, p.getZ(j) * f);
    }
    g.computeVertexNormals();
    if (k >= 6) { const n = g.attributes.normal, v = new THREE.Vector3(); for (let j = 0; j < p.count; j++) { v.set(p.getX(j), p.getY(j) / 0.75, p.getZ(j)).normalize(); const fn = new THREE.Vector3(n.getX(j), n.getY(j), n.getZ(j)); v.lerp(fn, 0.35).normalize(); n.setXYZ(j, v.x, v.y, v.z); } }
    g.userData.shared = true; rockGeos.push(g);
  }
  return rockGeos[i % rockGeos.length];
}
const KIT = {
  b: null,
  add(geom, m, mat, o = {}) { this.b.add(geom, m, mat, o); },
  /* box: (x,z) centre, y = base height */
  box(w, h, d, x, y, z, mat, o = {}) {
    const ry = o.ry || 0;
    this.b.add(UNIT_BOX, mtx(x, y + h / 2, z, o.rx || 0, ry, o.rz || 0, w, h, d), mat, o);
    if (o.col === false) return null;
    let hw = w / 2, hd = d / 2;
    if (ry) { const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)); const a = hw * c + hd * s, b = hw * s + hd * c; hw = a; hd = b; }
    return addCol(x - hw, y, z - hd, x + hw, y + h, z + hd, o);
  },
  visBox(w, h, d, x, y, z, mat, o = {}) { return this.box(w, h, d, x, y, z, mat, { ...o, col: false }); },
  rock(x, y, z, s, mat, o = {}) { this.b.add(rockGeo(s > 1 ? 6 + sri(0, 1) : o.v == null ? sri(0, 5) : o.v), mtx(x, y, z, sr(0, 6), sr(0, 6), sr(0, 6), s * (o.sx || 1), s * (o.sy || 1), s * (o.sz || 1)), mat, { worldUV: true, ...o }); },
  cylinder(r, h, x, y, z, mat, o = {}) {
    const g = geo(`kc${r},${o.r2 || r},${o.seg || 12}`, () => { const c = new THREE.CylinderGeometry(1, (o.r2 || r) / r, 1, o.seg || 12); c.translate(0, 0.5, 0); return c; });
    this.b.add(g, mtx(x, y, z, o.rx || 0, o.ry || 0, o.rz || 0, r, h, r), mat, o);
    if (o.col) return addCol(x - r, y, z - r, x + r, y + h, z + r, o);
  },
  /* axis-aligned wall with rectangular openings. openings: [{c, w, y0, y1}] measured along the wall from (x0,z0) */
  wall(x0, z0, x1, z1, y0, h, t, mat, openings = [], o = {}) {
    const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
    const L = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const sgn = alongX ? Math.sign(x1 - x0) || 1 : Math.sign(z1 - z0) || 1;
    const piece = (a, b, ya, yb) => {
      if (b - a < 0.01 || yb - ya < 0.01) return;
      const mid = (a + b) / 2, len = b - a;
      const cx = alongX ? x0 + sgn * mid : x0, cz = alongX ? z0 : z0 + sgn * mid;
      this.box(alongX ? len : t, yb - ya, alongX ? t : len, cx, y0 + ya, cz, mat, o);
    };
    const ops = openings.slice().sort((a, b) => a.c - b.c);
    let cur = 0;
    for (const op of ops) {
      const a = op.c - op.w / 2, b = op.c + op.w / 2;
      piece(cur, a, 0, h);
      piece(a, b, 0, op.y0); piece(a, b, op.y1, h);
      cur = b;
    }
    piece(cur, L, 0, h);
  },
  /* gable roof prism */
  roof(x, z, w, d, y, rh, mat, o = {}) {
    const oh = o.overhang == null ? 0.35 : o.overhang;
    const along = o.ridgeX ? 'x' : 'z';
    const W = along === 'z' ? w : d, D = along === 'z' ? d : w;
    const key = `roof${W},${D},${rh},${oh}`;
    const g = geo(key, () => {
      const sh = new THREE.Shape(); sh.moveTo(-W / 2 - oh, 0); sh.lineTo(W / 2 + oh, 0); sh.lineTo(0, rh); sh.closePath();
      const e = new THREE.ExtrudeGeometry(sh, { depth: D + oh * 2, bevelEnabled: false }); e.translate(0, 0, -(D + oh * 2) / 2); return e;
    });
    this.b.add(g, mtx(x, y, z, 0, along === 'z' ? 0 : Math.PI / 2, 0), mat, { worldUV: false, uvScale: 0.7 });
    if (o.col !== false) addCol(x - w / 2, y, z - d / 2, x + w / 2, y + rh * 0.6, z + d / 2, { surf: 'wood' });
  },
  /* multi-storey building, possibly ruined and/or enterable */
  building(o) {
    const { x, z, w, d } = o; const floors = o.floors || 2, fh = o.fh || 3.3, t = 0.4, H = floors * fh;
    const mat = o.mat || MAT.plaster, trim = o.trim || MAT.stone, ruin = o.ruin || 0;
    const winW = o.winW || 1.1, winH = o.winH || 1.7;
    const detail = !!(o.enter || o.detail);
    const res = { windows: [], door: null, x, z, w, d, H };
    const sides = [
      { n: 'n', x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z - d / 2, L: w, nrm: V3(0, 0, -1) },
      { n: 's', x0: x - w / 2, z0: z + d / 2, x1: x + w / 2, z1: z + d / 2, L: w, nrm: V3(0, 0, 1) },
      { n: 'w', x0: x - w / 2, z0: z - d / 2, x1: x - w / 2, z1: z + d / 2, L: d, nrm: V3(-1, 0, 0) },
      { n: 'e', x0: x + w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2, L: d, nrm: V3(1, 0, 0) },
    ];
    const colOpt = detail ? { surf: 'stone' } : { surf: 'stone', col: false };
    if (!detail) addCol(x - w / 2, 0 + (o.y || 0), z - d / 2, x + w / 2, H * (1 - ruin * 0.35) + (o.y || 0), z + d / 2, { surf: 'stone' });
    const y0 = o.y || 0;
    for (const s of sides) {
      const alongX = s.n === 'n' || s.n === 's';
      const n = Math.max(1, Math.floor(s.L / (o.spacing || 3.1))), sp = s.L / n;
      // wall is built as vertical piers + spandrels so ruins can be jagged
      const tops = [];
      for (let i = 0; i <= n; i++) tops.push(ruin > 0 ? H * clamp(1 - ruin * sr(0.05, 1.05), 0.25, 1) : H);
      const along = (dd) => alongX ? [s.x0 + dd, s.z0] : [s.x0, s.z0 + dd];
      const inset = s.n === 'n' || s.n === 'w' ? t / 2 : -t / 2;
      const off = (px, pz) => alongX ? [px, pz + inset] : [px + inset, pz];
      for (let i = 0; i <= n; i++) {
        // pier around boundary i
        const pa = i === 0 ? 0 : i * sp - (sp - winW) / 2, pb = i === n ? s.L : i * sp + (sp - winW) / 2;
        const ph = Math.min(tops[i], i > 0 ? tops[i - 1] + fh * 0.8 : 99, i < n ? tops[i + 1] + fh * 0.8 : 99);
        const [cx, cz] = off(...along((pa + pb) / 2));
        if (pb - pa > 0.01) this.box(alongX ? pb - pa : t, ph, alongX ? t : pb - pa, cx, y0, cz, mat, colOpt);
        if (i === n) break;
        // window column i
        const ca = i * sp + (sp - winW) / 2, cb = ca + winW, top = Math.min(tops[i], tops[i + 1]);
        const [wx, wz] = off(...along((ca + cb) / 2));
        for (let f = 0; f < floors; f++) {
          const fb = f * fh, isDoor = f === 0 && o.door === s.n && i === Math.floor(n / 2);
          const shop = f === 0 && o.shopfront && o.shopfront.includes(s.n);
          const sill = isDoor ? 0 : shop ? 0.5 : fb + (f === 0 ? 1.0 : 0.95), lint = isDoor ? 2.4 : shop ? 2.7 : sill + winH;
          const segA = fb, segB = Math.min(fb + fh, top);
          if (segB <= segA) break;
          const put = (ya, yb) => { if (yb > ya + 0.01) this.box(alongX ? winW : t, yb - ya, alongX ? t : winW, wx, y0 + ya, wz, mat, colOpt); };
          put(segA, Math.min(sill, segB)); put(Math.max(lint, segA), segB);
          if (lint <= segB) {
            const wp = V3(wx, y0 + (sill + lint) / 2, wz).addScaledVector(s.nrm, -t / 2);
            if (isDoor) res.door = { pos: V3(wx, y0, wz).addScaledVector(s.nrm, 0.6), nrm: s.nrm.clone(), w: winW };
            else res.windows.push({ pos: wp, nrm: s.nrm.clone(), floor: f, side: s.n, sill: y0 + sill });
            // sill & lintel trim
            if (!isDoor) {
              const sx = alongX ? winW + 0.2 : 0.14, sz = alongX ? 0.14 : winW + 0.2, so = s.nrm.clone().multiplyScalar(0.05);
              this.visBox(sx, 0.08, sz, wx + (alongX ? 0 : s.nrm.x * t / 2) + so.x, y0 + sill - 0.08, wz + (alongX ? s.nrm.z * t / 2 : 0) + so.z, trim, { cast: false });
              this.visBox(sx, 0.18, sz, wx + (alongX ? 0 : s.nrm.x * t / 2) + so.x, y0 + lint, wz + (alongX ? s.nrm.z * t / 2 : 0) + so.z, trim, { cast: false });
              if (o.shutters !== false && sr() < 0.7 && f > 0) {
                for (const sd of [-1, 1]) {
                  if (sr() < 0.25) continue;
                  const dd = (winW / 2 + 0.32) * sd, px = alongX ? wx + dd : wx + s.nrm.x * (t / 2 + 0.04), pz = alongX ? wz + s.nrm.z * (t / 2 + 0.04) : wz + dd;
                  const broken = sr() < 0.25;
                  this.visBox(alongX ? 0.55 : 0.04, winH * 0.95, alongX ? 0.04 : 0.55, px, y0 + sill + (broken ? -0.3 : 0), pz, o.shutterMat || MAT.woodPaint, { rz: broken ? sr(-0.4, 0.4) : 0, cast: false });
                }
              }
            }
          }
        }
      }
      // cornice bands
      for (let f = 1; f <= floors; f++) {
        const yy = f * fh; const minTop = Math.min(...tops); if (yy > minTop + 0.01 && ruin > 0) continue;
        const bx = alongX ? s.L + 0.3 : 0.18, bz = alongX ? 0.18 : s.L + 0.3, [cx, cz] = alongX ? [x, s.z0 + s.nrm.z * 0.05] : [s.x0 + s.nrm.x * 0.05, z];
        this.visBox(bx, f === floors ? 0.35 : 0.16, bz, cx, y0 + yy - (f === floors ? 0.35 : 0.08), cz, trim, { cast: false });
      }
      // top jagged rubble on ruined walls
      if (ruin > 0) for (let i = 0; i < n; i++) { const th = Math.min(tops[i], tops[i + 1]); const [cx, cz] = off(...along((i + 0.5) * sp)); for (let k = 0; k < 3; k++) this.rock(cx + sr(-0.5, 0.5), y0 + th + sr(-0.1, 0.1), cz + sr(-0.2, 0.2), sr(0.18, 0.35), sr() < 0.5 ? MAT.brick : mat); }
      s.tops = tops;
    }
    // corner quoins
    for (const [cx, cz] of [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x - w / 2, z + d / 2], [x + w / 2, z + d / 2]]) {
      const hh = H * (ruin > 0 ? sr(0.4, 0.9) : 1);
      for (let yy = 0; yy < hh - 0.3; yy += 0.6) this.visBox(0.55, 0.3, 0.55, cx, y0 + yy + (Math.round(yy / 0.6) % 2 ? 0 : 0.3), cz, trim, { cast: false, ry: 0 });
    }
    // interior
    const ins = o.inset || 1.1;
    if (o.enter) {
      this.box(w - t * 2, 0.08, d - t * 2, x, y0, z, MAT.woodDark, { surf: 'wood', cast: false });
      if (floors > 1) this.box(w - 0.1, 0.3, d - 0.1, x, y0 + fh - 0.3, z, MAT.woodDark, { surf: 'wood' });
      if (floors > 1) this.visBox(Math.max(0.5, w - ins * 2), Math.max(0.5, H * (1 - ruin * 0.5) - fh - 0.2), Math.max(0.5, d - ins * 2), x, y0 + fh, z, MAT.interior, { cast: false });
      // interior dressing
      const px = x + sr(-w / 4, w / 4), pz = z + sr(-d / 4, d / 4);
      this.box(1.4, 0.8, 0.8, px, y0, pz, MAT.wood, { surf: 'wood' });
      this.rock(x + sr(-w / 3, w / 3), y0, z + sr(-d / 3, d / 3), 0.5, MAT.plaster);
    } else {
      this.visBox(Math.max(0.5, w - ins * 2), Math.max(0.5, H * (1 - ruin * 0.4) - 0.2), Math.max(0.5, d - ins * 2), x, y0 + 0.1, z, MAT.interior, { cast: false });
    }
    // roof
    if (ruin < 0.25 && o.roof !== false) {
      this.roof(x, z, w, d, y0 + H, o.roofH || Math.min(w, d) * 0.42, o.roofMat || MAT.roof, { ridgeX: o.ridgeX, col: !detail ? false : true });
    } else if (o.roof !== false && ruin < 0.75) {
      // skeletal roof: a few charred rafters
      const n = Math.floor(w / 1.2);
      for (let i = 0; i < n; i++) if (sr() < 0.6) this.visBox(0.14, 0.18, d * sr(0.4, 0.8), x - w / 2 + (i + 0.5) * w / n, y0 + H * sr(0.75, 0.95), z + sr(-1, 1), MAT.woodDark, { rx: sr(-0.6, 0.6) });
    }
    if (o.sign) { res.signPos = V3(x, y0 + fh * 0.85, o.signSide === 'n' ? z - d / 2 - 0.25 : z + d / 2 + 0.25); }
    return res;
  },
  rubble(x, z, r, h, o = {}) {
    const mats = o.mats || [MAT.stone, MAT.plaster, MAT.brick, MAT.stoneDark];
    const base = o.y == null ? terrainH(x, z) : o.y;
    const n = Math.floor(r * r * 3 * (o.density || 1)) + 6;
    for (let i = 0; i < n; i++) {
      const a = sr(0, TAU), rr = Math.sqrt(sr()) * r, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
      const top = h * (1 - (rr / r) * (rr / r));
      this.rock(px, base + sr(0, top), pz, sr(0.18, 0.5) * (0.6 + h * 0.3), mats[i % mats.length]);
    }
    for (let i = 0; i < n * 0.4; i++) { const a = sr(0, TAU), rr = sr(0, r), px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; this.visBox(0.24, 0.07, 0.11, px, base + h * (1 - (rr / r) ** 2) * sr(0.3, 1), pz, MAT.brick, { rx: sr(-1, 1), ry: sr(0, 3), cast: false }); }
    for (let i = 0; i < n * 0.08; i++) this.visBox(0.12, 0.1, sr(1.5, 3), x + sr(-r, r) * 0.6, base + h * sr(0.3, 0.8), z + sr(-r, r) * 0.6, MAT.woodDark, { rx: sr(-0.5, 0.5), ry: sr(0, 3), rz: sr(-0.3, 0.3) });
    // mound body + stepped colliders so it can be climbed
    this.b.add(rockGeo(sri(0, 5)), mtx(x, base - h * 0.15, z, 0, sr(0, 6), 0, r * 0.95, h * 1.25, r * 0.95), mats[0], { worldUV: true });
    if (o.col !== false) { const steps = Math.max(1, Math.ceil(h / 0.4)); for (let i = 1; i <= steps; i++) { const f = i / steps, rr = r * Math.sqrt(1 - f * 0.85) * 0.8; addCol(x - rr, base, z - rr, x + rr, base + h * f, z + rr, { surf: 'stone' }); } }
  },
  sandbags(x, z, len, rows, ry = 0, o = {}) {
    const g = geo('sandbag', () => { const s = new THREE.SphereGeometry(0.5, 10, 6); s.scale(0.62, 0.2, 0.34); return s; });
    const base = o.y == null ? terrainH(x, z) : o.y, c = Math.cos(ry), s = Math.sin(ry);
    const per = Math.max(1, Math.round(len / 0.58));
    for (let r = 0; r < rows; r++) for (let i = 0; i < per; i++) {
      const d = (i - (per - 1) / 2) * 0.58 + (r % 2 ? 0.29 : 0);
      if (Math.abs(d) > len / 2) continue;
      for (let k = 0; k < (o.thick || 1); k++) {
        const off = (k - ((o.thick || 1) - 1) / 2) * 0.34;
        this.b.add(g, mtx(x + c * d + s * off, base + 0.09 + r * 0.17, z - s * d + c * off, sr(-0.05, 0.05), -ry + sr(-0.08, 0.08), sr(-0.05, 0.05)), MAT.burlap, { worldUV: false, uvScale: 1 });
      }
    }
    const hw = Math.abs(c) * len / 2 + Math.abs(s) * 0.25 * (o.thick || 1), hd = Math.abs(s) * len / 2 + Math.abs(c) * 0.25 * (o.thick || 1);
    return addCol(x - hw, base, z - hd, x + hw, base + rows * 0.17 + 0.05, z + hd, { surf: 'sand' });
  },
  hedgehog(x, z, ry = 0, o = {}) {
    const base = o.y == null ? terrainH(x, z) : o.y, M = o.mat || MAT.rust;
    const beam = geo('hhbeam', () => { const g = new THREE.BoxGeometry(0.14, 0.14, 2.1); return g; });
    const rots = [[0.62, 0, 0], [0, 0, 0.62], [Math.PI / 2 - 0.2, 0.95, 0.4]];
    rots.forEach(r => this.b.add(beam, mtx(x, base + 0.6, z, r[0], ry + r[1], r[2]), M, { worldUV: true }));
    this.b.add(beam, mtx(x, base + 0.62, z, 0.6, ry + Math.PI / 2, 0.3), M, { worldUV: true });
    return addCol(x - 0.45, base, z - 0.45, x + 0.45, base + 1.3, z + 0.45, { surf: 'metal' });
  },
  czechGate(x, z, ry = 0) { // Belgian gate (Element C): a braced steel lattice
    const base = terrainH(x, z), c = Math.cos(ry), s = Math.sin(ry), M = MAT.rust;
    const at = (lx, lz) => [x + c * lx + s * lz, z - s * lx + c * lz];
    const beam = (lx, ly, lz, len, rx, rz, w = 0.1) => { const [px, pz] = at(lx, lz); this.b.add(UNIT_BOX, mtx(px, base + ly, pz, rx, ry, rz, w, len, w), M, { worldUV: true }); };
    for (const lx of [-1.5, 0, 1.5]) beam(lx, 1.2, 0, 2.4, 0, 0);
    for (const ly of [0.15, 1.2, 2.3]) beam(0, ly, 0, 3.1, 0, Math.PI / 2);
    beam(-0.75, 1.2, 0, 2.6, 0, 0.56); beam(0.75, 1.2, 0, 2.6, 0, -0.56);
    for (const lx of [-1.5, 0, 1.5]) beam(lx, 1.0, 1.0, 2.6, -0.72, 0, 0.09);
    for (const lx of [-1.5, 1.5]) beam(lx, 0.1, 1.0, 2.2, Math.PI / 2, 0, 0.09);
    const hw = Math.abs(c) * 1.6 + Math.abs(s) * 1.1, hd = Math.abs(s) * 1.6 + Math.abs(c) * 1.1, [cx, cz] = at(0, 0.6);
    return addCol(cx - hw, base, cz - hd, cx + hw, base + 2.4, cz + hd, { surf: 'metal' });
  },
  /* barbed-wire coil; returns removable object */
  wire(x0, z0, x1, z1, o = {}) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len * 3.5), pts = [];
    for (let i = 0; i <= n * 8; i++) {
      const t = i / (n * 8), a = t * n * TAU, x = lerp(x0, x1, t), z = lerp(z0, z1, t);
      const b = (o.y == null ? terrainH(x, z) : o.y);
      const nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
      pts.push(V3(x + nx * Math.cos(a) * 0.42, b + 0.45 + Math.sin(a) * 0.42, z + nz * Math.cos(a) * 0.42));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curve, pts.length * 2, 0.012, 4, false);
    const m = new THREE.Mesh(g, MAT.wire); m.castShadow = true; R.scene.add(m);
    // posts
    const posts = [];
    for (let i = 0; i <= Math.floor(len / 3); i++) { const t = i / Math.max(1, Math.floor(len / 3)), x = lerp(x0, x1, t), z = lerp(z0, z1, t); const p = new THREE.Mesh(boxG(0.06, 1.1, 0.06), MAT.woodDark); p.position.set(x, terrainH(x, z) + 0.5, z); p.rotation.z = sr(-0.2, 0.2); R.scene.add(p); posts.push(p); }
    const hw = Math.abs(x1 - x0) / 2 + 0.5, hd = Math.abs(z1 - z0) / 2 + 0.5, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, b = terrainH(cx, cz);
    const c = addCol(cx - hw, b - 0.5, cz - hd, cx + hw, b + 1.0, cz + hd, { noBullet: true, surf: 'metal' });
    return { mesh: m, posts, col: c, remove() { R.scene.remove(m); posts.forEach(p => R.scene.remove(p)); c.active = false; if (Nav.ready) Nav.rebuildRect(c.min[0], c.min[2], c.max[0], c.max[2]); } };
  },
  foliage(x, y, z, size, mat, n = 3) {
    const g = geo('leafquad', () => { const p = new THREE.PlaneGeometry(1, 1); return p; });
    for (let i = 0; i < n; i++) this.b.add(g, mtx(x, y, z, sr(-0.5, 0.5), i * Math.PI / n + sr(-0.3, 0.3), sr(-0.3, 0.3), size, size, size), mat, { worldUV: false });
  },
  tree(x, z, o = {}) {
    const base = o.y == null ? terrainH(x, z) : o.y, h = o.h || sr(7, 11), type = o.type || 'oak';
    const tr = o.trunk || (type === 'pine' ? 0.18 : 0.26);
    const mat = o.mat || (o.autumn ? MAT.leavesAutumn : sr() < 0.5 ? MAT.leaves : MAT.leavesDark);
    if (type === 'pine') {
      this.cylinder(tr, h, x, base, z, MAT.bark, { r2: tr * 1.4, seg: 8, worldUV: true });
      const crown = h * 0.35;
      for (let i = 0; i < 9; i++) { const yy = base + h - crown + sr(0, crown), a = sr(0, TAU), rr = sr(0.2, 1.6); this.foliage(x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr, sr(1.8, 2.6), MAT.leavesDark); }
    } else {
      const tl = h * (type === 'apple' ? 0.35 : 0.5);
      this.cylinder(tr, tl + 0.5, x, base, z, MAT.bark, { r2: tr * 1.5, seg: 9, worldUV: true });
      const br = sri(2, 4);
      for (let i = 0; i < br; i++) { const a = sr(0, TAU); this.cylinder(tr * 0.45, h * 0.35, x + Math.cos(a) * 0.1, base + tl * sr(0.6, 0.95), z + Math.sin(a) * 0.1, MAT.bark, { rx: Math.sin(a) * 0.7, rz: -Math.cos(a) * 0.7, seg: 6, worldUV: true }); }
      const cr = o.crown || h * (type === 'apple' ? 0.45 : 0.36), cy = base + tl + cr * 0.8;
      const clusters = o.clusters || (type === 'apple' ? 14 : 20);
      for (let i = 0; i < clusters; i++) {
        const u = sr(-1, 1), a = sr(0, TAU), rr = Math.sqrt(1 - u * u) * sr(0.3, 1);
        this.foliage(x + Math.cos(a) * rr * cr, cy + u * cr * 0.7, z + Math.sin(a) * rr * cr, sr(2.2, 3.4) * (cr / 3.5), mat);
      }
    }
    if (o.col !== false) addCol(x - tr, base, z - tr, x + tr, base + h * 0.5, z + tr, { surf: 'wood' });
  },
  bushLine(x0, z0, x1, z1, o = {}) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / (o.spacing || 1.3));
    for (let i = 0; i <= n; i++) {
      const t = i / Math.max(1, n), x = lerp(x0, x1, t) + sr(-0.5, 0.5), z = lerp(z0, z1, t) + sr(-0.5, 0.5);
      const b = (o.yf ? o.yf(x, z) : terrainH(x, z));
      this.foliage(x, b + sr(0.6, 1.4), z, sr(1.8, 2.8), sr() < 0.5 ? MAT.leaves : MAT.leavesDark, 3);
      if (sr() < 0.5) this.foliage(x, b + sr(1.8, 2.6), z, sr(1.6, 2.4), MAT.leaves, 2);
    }
  },
  crate(x, z, ry = 0, s = 1, o = {}) { const b = o.y == null ? terrainH(x, z) : o.y; const c = this.box(0.9 * s, 0.6 * s, 0.6 * s, x, b, z, MAT.wood, { ry, surf: 'wood' }); this.visBox(0.92 * s, 0.06, 0.62 * s, x, b + 0.45 * s, z, MAT.woodDark, { ry, cast: false }); return c; },
  barrel(x, z, o = {}) { const b = o.y == null ? terrainH(x, z) : o.y; this.cylinder(0.3, 0.9, x, b, z, o.mat || MAT.rust, { col: true, surf: 'metal', seg: 14 }); },
  lamp(x, z, o = {}) { const b = terrainH(x, z); this.cylinder(0.07, 3.6, x, b, z, MAT.metalDark, { col: true, surf: 'metal', seg: 8 }); this.visBox(0.3, 0.4, 0.3, x, b + 3.6, z, MAT.metalDark); },
  pole(x, z, h = 7) { const b = terrainH(x, z); this.cylinder(0.12, h, x, b, z, MAT.woodDark, { col: true, surf: 'wood', seg: 8 }); this.visBox(1.6, 0.1, 0.1, x, b + h - 0.6, z, MAT.woodDark); },
  /* one-off meshes that need their own texture (signs, posters) */
  plane(tex, w, h, x, y, z, ry = 0, o = {}) {
    const p = { map: tex, roughness: o.rough || 0.85, transparent: !!o.transparent, side: o.double ? THREE.DoubleSide : THREE.FrontSide };
    if (o.emissive) { p.emissive = col(o.emissive); p.emissiveMap = tex; p.emissiveIntensity = o.ei || 0; }
    const m = new THREE.MeshStandardMaterial(p);
    m.userData.dispose = true;
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set(x, y, z); me.rotation.y = ry; if (o.rx) me.rotation.x = o.rx; me.receiveShadow = true; me.castShadow = !!o.cast; R.scene.add(me); return me;
  },
  /* instanced wind-blown grass */
  grass(o) {
    const count = Math.floor(o.count * Q().grass); if (count <= 0) return null;
    const g = new THREE.BufferGeometry(), P = [], N = [], U = [];
    for (let k = 0; k < 3; k++) {
      const a = k * Math.PI / 3, c = Math.cos(a) * 0.4, s = Math.sin(a) * 0.4, h = 0.55;
      const v = [[-c, 0, -s, 0, 0], [c, 0, s, 1, 0], [c, h, s, 1, 1], [-c, 0, -s, 0, 0], [c, h, s, 1, 1], [-c, h, -s, 0, 1]];
      v.forEach(q => { P.push(q[0], q[1], q[2]); N.push(0, 1, 0); U.push(q[3], q[4]); });
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    const mat = MAT.grass.clone(); mat.userData.dispose = true; mat.color = col(o.color || 0xc8c8b0);
    const uTime = { value: 0 };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec4 ip = instanceMatrix[3];
        float ph = uTime*1.6 + ip.x*0.35 + ip.z*0.25;
        transformed.x += sin(ph)*0.12*position.y + sin(ph*2.3)*0.03*position.y;
        transformed.z += cos(ph*0.8)*0.06*position.y;
        #endif`);
    };
    const im = new THREE.InstancedMesh(g, mat, count); im.receiveShadow = true; im.castShadow = false;
    let n = 0, tries = 0;
    while (n < count && tries < count * 4) {
      tries++;
      const x = o.x0 + Math.random() * (o.x1 - o.x0), z = o.z0 + Math.random() * (o.z1 - o.z0);
      if (o.mask && !o.mask(x, z)) continue;
      const s = rand(0.7, 1.5) * (o.scale || 1);
      im.setMatrixAt(n++, mtx(x, terrainH(x, z) - 0.03, z, 0, rand(0, TAU), 0, s, s * rand(0.8, 1.4), s));
    }
    im.count = n; im.instanceMatrix.needsUpdate = true; im.userData.uTime = uTime;
    R.scene.add(im); KIT.grassMeshes.push(im);
    return im;
  },
  grassMeshes: [],
};
