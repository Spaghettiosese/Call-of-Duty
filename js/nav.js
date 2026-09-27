'use strict';
/* =====================================================================
   Navigation: a walkability grid built from the level's colliders and
   terrain, A* pathfinding, and cover finding for the AI.
   ===================================================================== */
const Nav = {
  cs: 1, R: 0.38, ready: false, budget: 0,
  build() {
    const B = World.bounds || [-100, -100, 100, 100], m = 6;
    this.x0 = Math.floor(B[0] - m); this.z0 = Math.floor(B[1] - m);
    this.nx = Math.ceil(B[2] + m - this.x0) + 1; this.nz = Math.ceil(B[3] + m - this.z0) + 1;
    const n = this.nx * this.nz;
    this.h = new Float32Array(n); this.block = new Uint8Array(n);
    this.g = new Float32Array(n); this.par = new Int32Array(n); this.stamp = new Uint32Array(n); this.closed = new Uint32Array(n); this.run = 0;
    const hn = Math.max(n * 2, 24000 * 8 + 16); this.heapI = new Int32Array(hn); this.heapF = new Float32Array(hn);
    for (let j = 0; j < this.nz; j++) for (let i = 0; i < this.nx; i++) this.h[j * this.nx + i] = terrainH(this.x0 + i, this.z0 + j);
    this.rebuildRect(this.x0, this.z0, this.x0 + this.nx, this.z0 + this.nz);
    this.ready = true;
  },
  rebuildRect(minx, minz, maxx, maxz) {
    const nx = this.nx, nz = this.nz, R = this.R;
    const i0 = clamp(Math.floor(minx - this.x0 - 1), 0, nx - 1), i1 = clamp(Math.ceil(maxx - this.x0 + 1), 0, nx - 1);
    const j0 = clamp(Math.floor(minz - this.z0 - 1), 0, nz - 1), j1 = clamp(Math.ceil(maxz - this.z0 + 1), 0, nz - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * nx + i, h = this.h[k]; let b = 0;
      // steep ground (hedgerow banks, bluff faces)
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; if (Math.abs(this.h[jj * nx + ii] - h) > 0.95) { b = 1; break; } }
      if (World.water != null && h < World.water - 1.4) b = 1;
      if (!b) {
        const x = this.x0 + i, z = this.z0 + j;
        for (const c of queryCols(x - R - 0.5, z - R - 0.5, x + R + 0.5, z + R + 0.5)) {
          if (x + 0.5 + R < c.min[0] || x - 0.5 - R > c.max[0] || z + 0.5 + R < c.min[2] || z - 0.5 - R > c.max[2]) continue;
          // blocks if it rises above a step and isn't overhead
          if (c.max[1] > h + 0.5 && c.min[1] < h + 1.7) {
            // cell centre must be inside the inflated box, not just the cell square
            if (x > c.min[0] - R && x < c.max[0] + R && z > c.min[2] - R && z < c.max[2] + R) { b = 1; break; }
          }
        }
      }
      this.block[k] = b;
    }
  },
  cell(x, z) { const i = Math.round(x - this.x0), j = Math.round(z - this.z0); if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return -1; return j * this.nx + i; },
  walk(k) { return k >= 0 && !this.block[k]; },
  walkable(x, z) { return this.walk(this.cell(x, z)); },
  pos(k, out = V3()) { const i = k % this.nx, j = (k / this.nx) | 0; return out.set(this.x0 + i, this.h[k], this.z0 + j); },
  nearestWalkable(x, z, maxR = 5) {
    const k0 = this.cell(x, z); if (this.walk(k0)) return k0;
    let best = -1, bd = 1e9;
    for (let r = 1; r <= maxR; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const k = this.cell(x + di, z + dj); if (!this.walk(k)) continue;
        const d = di * di + dj * dj; if (d < bd) { bd = d; best = k; }
      }
      if (best >= 0) return best;
    }
    return -1;
  },
  /* straight line walkable on the grid? */
  line(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.4);
    for (let s = 1; s <= n; s++) { const t = s / n; if (!this.walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
    return true;
  },
  /* A* — returns an array of waypoints (smoothed), or null */
  path(from, to) {
    if (!this.ready) return null;
    let s = this.nearestWalkable(from.x, from.z, 3), g = this.nearestWalkable(to.x, to.z, 6);
    if (s < 0 || g < 0) return null;
    if (this.line(from.x, from.z, to.x, to.z)) return [to.clone()];
    const nx = this.nx, run = ++this.run, G = this.g, P = this.par, ST = this.stamp, CL = this.closed;
    const gi = g % nx, gj = (g / nx) | 0;
    const hf = (k) => { const di = Math.abs(k % nx - gi), dj = Math.abs(((k / nx) | 0) - gj); return (di + dj) + (1.414 - 2) * Math.min(di, dj); };
    let hs = 0; const HI = this.heapI, HF = this.heapF;
    const push = (k, f) => { let i = hs++; HI[i] = k; HF[i] = f; while (i > 0) { const p = (i - 1) >> 1; if (HF[p] <= HF[i]) break; const tk = HI[p], tf = HF[p]; HI[p] = HI[i]; HF[p] = HF[i]; HI[i] = tk; HF[i] = tf; i = p; } };
    const pop = () => { const k = HI[0]; hs--; HI[0] = HI[hs]; HF[0] = HF[hs]; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < hs && HF[l] < HF[m]) m = l; if (r < hs && HF[r] < HF[m]) m = r; if (m === i) break; const tk = HI[m], tf = HF[m]; HI[m] = HI[i]; HF[m] = HF[i]; HI[i] = tk; HF[i] = tf; i = m; } return k; };
    ST[s] = run; G[s] = 0; P[s] = -1; push(s, hf(s));
    const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let found = false, it = 0;
    while (hs > 0 && it++ < 24000) {
      const k = pop(); if (CL[k] === run) continue; CL[k] = run;
      if (k === g) { found = true; break; }
      const i = k % nx, j = (k / nx) | 0;
      for (const [di, dj, c] of D) {
        const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= this.nz) continue;
        const kk = jj * nx + ii; if (this.block[kk] || CL[kk] === run) continue;
        if (di && dj && (this.block[j * nx + ii] || this.block[jj * nx + i])) continue; // no corner cutting
        const ng = G[k] + c + Math.abs(this.h[kk] - this.h[k]) * 0.5;
        if (ST[kk] !== run || ng < G[kk]) { ST[kk] = run; G[kk] = ng; P[kk] = k; push(kk, ng + hf(kk)); }
      }
    }
    if (!found) return null;
    const cells = []; for (let k = g; k !== -1; k = P[k]) cells.push(k); cells.reverse();
    // string-pulling
    const pts = []; let ax = from.x, az = from.z, last = 0;
    for (let i = 1; i < cells.length; i++) {
      const p = this.pos(cells[i]);
      if (!this.line(ax, az, p.x, p.z)) { const q = this.pos(cells[i - 1]); pts.push(q); ax = q.x; az = q.z; }
    }
    pts.push(to.clone());
    return pts;
  },
  /* pick a spot near `around` that is hidden from `threat` when crouched but lets you shoot when standing */
  findCover(around, threat, o = {}) {
    if (!this.ready) return null;
    const rMin = o.rMin == null ? 2 : o.rMin, rMax = o.rMax || 10, te = threat ? threat.clone().setY(threat.y + 1.6) : null;
    let best = null, bs = -1e9;
    for (let n = 0; n < (o.samples || 18); n++) {
      const a = Math.random() * TAU, r = rMin + Math.random() * (rMax - rMin);
      const k = this.cell(around.x + Math.cos(a) * r, around.z + Math.sin(a) * r); if (!this.walk(k)) continue;
      const p = this.pos(k); let sc = -p.distanceTo(o.from || around) * 0.08;
      if (te) {
        const low = !lineOfSight(te, V3(p.x, p.y + 0.95, p.z)), high = lineOfSight(te, V3(p.x, p.y + 1.5, p.z));
        sc += low && high ? 4 : low ? 2 : 0;
        const dT = p.distanceTo(threat);
        if (o.minThreat && dT < o.minThreat) sc -= 5;
        if (o.advance) sc += (o.from.distanceTo(threat) - dT) * 0.25;
      }
      if (o.avoid) for (const q of o.avoid) if (q.distanceTo(p) < 1.6) sc -= 3;
      if (sc > bs) { bs = sc; best = p; }
    }
    return best;
  },
};
/* rank & name shown when you look at someone */
const DISPLAY = {
  us: { Mahoney: 'Sgt. Walter Mahoney', Russo: 'Pfc. Frank Russo', Dupree: 'Cpl. Ray Dupree', Weiss: 'Pfc. Eli Weiss', Doc: 'T/5 Thomas Harlan · Medic', Carver: '2nd Lt. James Carver', Hollins: 'Pvt. Earl Hollins', Pike: 'Pvt. Danny Pike' },
  npc: { Father: 'Wilhelm Kessler', Mother: 'Margaret Kessler', Ruth: 'Ruth Kessler', Russo: 'Frankie Russo', Abernathy: 'Mr. Abernathy', Recruiter: 'Recruiting Sergeant', Newsboy: 'Newsboy', Hollis: 'Staff Sgt. Hollis · Drill Instructor', Marguerite: 'Marguerite Aubert', Luc: 'Luc Aubert' },
};
const SURNAMES = ['Kowalski', 'Brennan', 'Hayes', 'Novak', 'Martinez', 'O’Neill', 'Sullivan', 'Jensen', 'Carter', 'Delgado', 'Fischer', 'Walsh', 'Moreau', 'Baker', 'Lindqvist', 'Reyes', 'Gallo', 'Price', 'Mercer', 'Dunn', 'Hollis', 'Tate', 'Rourke', 'Pruitt'];
