'use strict';
/* =====================================================================
   CHAPTER ONE · I — EASY RED (Omaha Beach, June 6, 1944)
   Sea is +Z (south), the bluffs are -Z (north).
   ===================================================================== */
const BEACH = {};
function drawX(z) { return 4 + Math.sin((z + 50) * 0.045) * 5; }
function beachH(x, z) {
  let h;
  if (z > 40) h = 0.6 - (z - 40) * 0.045;
  else if (z > -18) h = 0.6 + (40 - z) / 58 * 1.6 + Math.sin(x * 0.7 + z * 0.35) * 0.04 * smoothstep(-10, 30, z);
  else if (z > -27) h = 2.2 + smoothstep(-18, -27, z) * 1.0;
  else h = 3.2;
  // bluffs with a draw (valley exit)
  const f = 1 - smoothstep(5, 17, Math.abs(x - drawX(z)));
  const bluff = lerp(30 * smoothstep(-52, -95, z), 30 * smoothstep(-50, -118, z), f * 0.9);
  h += bluff;
  h += (fbm(x * 0.045, z * 0.045, 3) - 0.5) * 2.4 * smoothstep(-48, -62, z) * (1 - f * 0.7);
  // trench along the crest
  const tz = Math.abs(z + 104.5);
  if (tz < 2.2 && x > -50 && x < 40) h -= 1.35 * (1 - smoothstep(0.9, 2.2, tz));
  for (const c of BEACH.craters || []) { const d = Math.hypot(x - c[0], z - c[1]); if (d < c[2]) h -= c[3] * (1 - (d / c[2]) ** 2); else if (d < c[2] * 1.4) h += c[3] * 0.25 * (1 - (d - c[2]) / (c[2] * 0.4)); }
  return h;
}
function layBody(x, z, o = {}) {
  const h = makeHuman({ side: o.side || 'us', weapon: null, net: true, skinI: randi(0, 5) });
  const y = terrainH(x, z);
  h.root.position.set(x, Math.max(y, -0.3) + 0.12, z); h.root.rotation.order = 'YXZ'; h.root.rotation.set(-(Math.PI / 2 - 0.1) * (o.face ? -1 : 1), o.yaw == null ? rand(0, TAU) : o.yaw, rand(-0.2, 0.2));
  h.hips.position.y = 0.95; h.legL.hip.rotation.x = rand(-0.4, 0.2); h.legR.hip.rotation.x = rand(-0.2, 0.5); h.legL.knee.rotation.x = rand(0, 0.8); h.legR.knee.rotation.x = rand(0, 0.5);
  solveArm(h.armR, V3(-0.4, rand(0.3, 0.8), rand(-0.2, 0.3)), POLE_R); solveArm(h.armL, V3(0.4, rand(0.2, 0.7), rand(-0.2, 0.3)), POLE_L);
  h.head.rotation.y = rand(-0.8, 0.8);
  R.scene.add(h.root); return h;
}
function makeShip(len, big) {
  const g = new THREE.Group(), M = MAT.fgrey;
  mesh(boxG(len, 6, 11), M, g, 0, 1, 0); mesh(boxG(len * 0.3, 5, 8), M, g, -len * 0.05, 6, 0); mesh(boxG(len * 0.12, 6, 5), M, g, -len * 0.05, 11, 0);
  mesh(cylG(1.2, 1.4, 7, 10, false), M, g, len * 0.08, 10, 0); if (big) mesh(cylG(1.2, 1.4, 7, 10, false), M, g, -len * 0.15, 10, 0);
  for (const sx of [0.3, -0.3]) { mesh(boxG(6, 2.5, 5), M, g, len * sx, 5, 0); mesh(cylG(0.4, 0.4, 9, 6, false), M, g, len * sx + 5 * Math.sign(sx), 5.5, 0, { r: [0, 0, Math.PI / 2] }); }
  mesh(cylG(0.2, 0.2, 18, 4, false), M, g, 0, 20, 0);
  R.scene.add(g); return g;
}
function bunker(x, z, o = {}) {
  const K = KIT; let Hb = -99;
  for (let dx = -3.5; dx <= 3.5; dx += 1.75) for (let dz = -3; dz <= 3; dz += 1.5) Hb = Math.max(Hb, terrainH(x + dx, z + dz));
  Hb += 0.05;
  K.box(7.6, 0.4, 6.6, x, Hb - 0.4, z, MAT.concrete, { surf: 'stone' });
  K.wall(x - 3.8, z + 3.1, x + 3.8, z + 3.1, Hb, 2.6, 0.9, MAT.concrete, [{ c: 3.8, w: 2.6, y0: 1.0, y1: 1.5 }]);
  K.wall(x - 3.8, z - 3.1, x + 3.8, z - 3.1, Hb, 2.6, 0.7, MAT.concrete, [{ c: 3.8, w: 1.1, y0: 0, y1: 2.0 }]);
  K.wall(x - 3.6, z - 3, x - 3.6, z + 3, Hb, 2.6, 0.7, MAT.concrete); K.wall(x + 3.6, z - 3, x + 3.6, z + 3, Hb, 2.6, 0.7, MAT.concrete);
  K.box(8.4, 0.8, 7.4, x, Hb + 2.6, z, MAT.concrete, { surf: 'stone' });
  K.visBox(3.4, 0.25, 0.6, x, Hb + 1.5, z + 3.7, MAT.concrete, { rx: 0.3 });
  for (let i = 0; i < 10; i++) K.rock(x + sr(-4.5, 4.5), Hb + 3.4, z + sr(-3.5, 3.5), sr(0.4, 0.9), MAT.stoneDark);
  K.visBox(2.2, 1.0, 0.1, x, Hb, z - 3.6, MAT.interior, { cast: false });
  return Hb;
}
function buildBeachLevel() {
  reseed(61);
  BEACH.craters = [];
  for (let i = 0; i < 30; i++) BEACH.craters.push([sr(-70, 70), sr(-16, 46), sr(1.6, 3.6), sr(0.4, 0.9)]);
  World.water = 0;
  World.terrain = new Terrain({
    x0: -170, z0: -175, w: 340, d: 455, res: 2, h: beachH, cast: true,
    color: (x, z, h, n) => {
      const v = 0.92 + fbm(x * 0.3, z * 0.3, 2) * 0.16;
      let c;
      if (h < -0.2) c = [0.44, 0.41, 0.34];
      else if (z > 38) c = [0.56, 0.5, 0.4];
      else if (z > -18) { const w = smoothstep(30, 45, z); c = [lerp(0.76, 0.58, w), lerp(0.69, 0.52, w), lerp(0.54, 0.42, w)]; }
      else if (z > -28) c = [0.5, 0.5, 0.49];
      else { const s = 1 - n.y; const g = fbm(x * 0.06, z * 0.06, 3); c = s > 0.35 ? [0.46, 0.42, 0.32] : g > 0.5 ? [0.42, 0.46, 0.27] : [0.5, 0.5, 0.33]; }
      return [c[0] * v, c[1] * v, c[2] * v];
    }
  });
  World.surfaceAt = (x, z) => z > -18 ? 'sand' : z > -28 ? 'stone' : 'grass';
  World.bounds = [-68, -150, 72, 260];
  const K = KIT;
  // sea
  const wg = new THREE.PlaneGeometry(1400, 1000, 1, 1); wg.rotateX(-Math.PI / 2);
  BEACH.sea = new THREE.Mesh(wg, MAT.water); BEACH.sea.position.set(0, 0, 480); BEACH.sea.receiveShadow = true; R.scene.add(BEACH.sea);
  MAT.water.normalMap.repeat.set(90, 64);
  // foam line
  const fm = new THREE.MeshBasicMaterial({ map: TEX.smoke, color: new THREE.Color(0.8, 0.82, 0.82), transparent: true, opacity: 0.5, depthWrite: false }); fm.userData.dispose = true;
  BEACH.foam = new THREE.Mesh(new THREE.PlaneGeometry(400, 6, 1, 1).rotateX(-Math.PI / 2), fm); BEACH.foam.position.set(0, 0.03, 53); R.scene.add(BEACH.foam);
  // beach obstacles
  for (let z = 44; z > 0; z -= 9) for (let x = -64; x < 70; x += 8.5) {
    const px = x + sr(-2.5, 2.5) + (Math.abs(z) % 2) * 3, pz = z + sr(-2, 2);
    if (Math.abs(px - 4) < 3 && pz > 30) continue;
    const r = sr();
    if (r < 0.62) K.hedgehog(px, pz, sr(0, 3));
    else if (r < 0.8) { const b = terrainH(px, pz); K.visBox(0.22, 3.2, 0.22, px, b - 0.3, pz, MAT.woodDark, { rx: -0.6 }); addCol(px - 0.3, b, pz - 1, px + 0.3, b + 2.2, pz + 0.6, { surf: 'wood' }); K.cylinder(0.18, 0.08, px, b + 2.2, pz - 1.5, MAT.metalDark, { rx: -0.6, seg: 10 }); }
  }
  for (let x = -66; x < 70; x += 11) if (Math.abs(x - 4) > 6) K.czechGate(x + sr(-2, 2), 49 + sr(-1.5, 1.5), sr(-0.2, 0.2));
  // shingle stones
  for (let i = 0; i < 260; i++) { const x = sr(-68, 72), z = sr(-26.5, -18); K.rock(x, terrainH(x, z) - 0.05, z, sr(0.1, 0.22), sr() < 0.5 ? MAT.stoneDark : MAT.stone); }
  // seawall
  K.box(260, 1.0, 0.7, 0, 3.15, -27.6, MAT.concrete, { surf: 'stone' });
  for (let x = -128; x < 130; x += 4) K.visBox(0.25, 1.1, 0.8, x, 3.1, -27.6, MAT.woodDark);
  // wire
  BEACH.wires = [];
  for (let x = -122; x < 122; x += 12) BEACH.wires.push({ x0: x, w: K.wire(x, -31, x + 12, -31) });
  // minefield tape path
  for (let z = -32; z >= -54; z -= 3) for (const x of [2.3, 5.7]) { const b = terrainH(x, z); K.visBox(0.06, 0.9, 0.06, x, b, z, MAT.woodDark); if (z > -54) K.visBox(0.03, 0.03, 3, x, b + 0.7, z - 1.5, MAT.plasterWhite, { cast: false }); }
  const skull = genTextTex(128, 128, (g, w, h) => { g.fillStyle = '#e2d7b0'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 24px Georgia'; g.textAlign = 'center'; g.fillText('ACHTUNG', 64, 34); g.fillText('MINEN', 64, 116); g.beginPath(); g.arc(64, 64, 16, 0, TAU); g.fill(); g.fillStyle = '#e2d7b0'; g.fillRect(55, 60, 6, 6); g.fillRect(67, 60, 6, 6); });
  for (const [x, z] of [[-6, -33], [14, -34], [-20, -36], [26, -33], [8, -38]]) { const b = terrainH(x, z); K.visBox(0.07, 1.2, 0.07, x, b, z, MAT.woodDark); K.plane(skull, 0.55, 0.55, x, b + 1.05, z + 0.05, 0); }
  BEACH.mines = [];
  for (let i = 0; i < 70; i++) { const x = sr(-45, 55), z = sr(-33, -51); if (Math.abs(x - 4) < 2.6) continue; BEACH.mines.push({ p: V3(x, terrainH(x, z), z), armed: true }); }
  // bunkers & MG nests on the bluff
  BEACH.HA = bunker(30, -96); BEACH.HB = bunker(-38, -93);
  BEACH.nestC = V3(-12, terrainH(-12, -90), -90);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; if (Math.sin(a) < -0.5) continue; K.sandbags(-12 + Math.cos(a) * 1.8, -90 + Math.sin(a) * 1.8, 1.1, 3, -a + Math.PI / 2); }
  // trench parapet & dugouts
  for (let x = -46; x < 38; x += 3) K.sandbags(x + 1.5, -102.6, 3, 2, 0, { y: terrainH(x + 1.5, -102.6) - 0.05 });
  for (let x = -40; x < 40; x += 6) { K.visBox(0.15, 1.3, 0.15, x, terrainH(x, -105.8) - 0.4, -105.8, MAT.woodDark); }
  K.box(6, 2.2, 3, -20, terrainH(-20, -109) - 0.8, -109, MAT.woodDark, { surf: 'wood' });
  // lower-draw nests
  BEACH.nests = [[-6, -62], [10, -66], [-4, -74], [12, -78], [-2, -86], [9, -88]];
  for (const [x, z] of BEACH.nests) K.sandbags(x, z + 1.1, 2.4, 3, 0);
  // wrecks
  const sh = makeSherman(); sh.position.set(-24, terrainH(-24, 12) - 0.2, 12); sh.rotation.set(0.05, 0.6, 0.08); R.scene.add(sh);
  sh.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.multiplyScalar(0.3); m.material.userData.dispose = true; } });
  addCol(-27, 0, 9, -21, 2.6, 15, { surf: 'metal' });
  FX.fireEmitter(V3(-24, terrainH(-24, 12) + 2.2, 12), { size: 1.2 }); FX.smokeColumn(V3(-24, 3, 12), { size: 0.9, rate: 5, dark: 0.08 });
  const wreck = makeLCVP(); wreck.position.set(34, -0.4, 56); wreck.rotation.set(0.1, Math.PI + 0.4, -0.25); R.scene.add(wreck);
  FX.fireEmitter(V3(34, 0.8, 56), { size: 1 }); FX.smokeColumn(V3(34, 1, 56), { size: 0.8, rate: 4, dark: 0.12 });
  FX.smokeColumn(V3(-60, 34, -100), { size: 1.4, rate: 5, dark: 0.18, wind: 2 });
  FX.smokeColumn(V3(60, 33, -95), { size: 1.2, rate: 4, dark: 0.2, wind: 2 });
  FX.smokeColumn(V3(-8, 3.5, -40), { size: 0.8, rate: 3, dark: 0.35, wind: 2.5 });
  // bodies
  for (let i = 0; i < 16; i++) { const x = sr(-50, 55), z = sr(-14, 55); if (Math.abs(x - 4) < 3) continue; layBody(x, z); }
  // Bishop, the engineer, and his bangalore
  BEACH.bishopPos = V3(17, terrainH(17, 7), 7); layBody(17, 7, { yaw: 0.4 });
  BEACH.bangalore = new THREE.Mesh(cylG(0.04, 0.04, 3, 8, false), MAT.od); BEACH.bangalore.rotation.set(Math.PI / 2, 0, 0.5); BEACH.bangalore.position.set(18, terrainH(18, 7) + 0.1, 7.6); R.scene.add(BEACH.bangalore);
  // ships offshore
  const s1 = makeShip(110); s1.position.set(-230, 0, 330); s1.rotation.y = 0.2;
  const s2 = makeShip(95); s2.position.set(170, 0, 300); s2.rotation.y = -0.1;
  const s3 = makeShip(180, true); s3.position.set(20, 0, 420);
  BEACH.ships = [s1, s2, s3];
  // bluff vegetation
  for (let i = 0; i < 60; i++) { const x = sr(-80, 80), z = sr(-60, -100); if (Math.abs(x - drawX(z)) < 4) continue; K.foliage(x, terrainH(x, z) + 0.6, z, sr(1.4, 2.4), sr() < 0.5 ? MAT.leavesDark : MAT.leaves); }
  for (let i = 0; i < 40; i++) { const x = sr(-80, 80), z = sr(-55, -100); K.rock(x, terrainH(x, z), z, sr(0.4, 1.2), MAT.stoneDark); }
  KIT.grass({ x0: -75, x1: 75, z0: -140, z1: -30, count: 16000, color: 0xb4b890, mask: (x, z) => !(Math.abs(x - 4) < 2.6 && z > -54) && !(Math.abs(z + 104.5) < 1.4) });
  for (let i = 0; i < 20; i++) K.tree(sr(-70, 70), sr(-115, -140), { h: sr(8, 13), mat: MAT.leavesDark });
}
/* --------- landing craft --------- */
function makeBoatLoad(g) { // helmets of soldiers packed in a boat (distant boats)
  for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) mesh(helmetUS(), MAT.usHelmet, g, -0.8 + c * 0.8, 0.95, -3 + r * 1.3, { s: [1.3, 1.3, 1.3] });
}
function beachSpawnSquad() {
  const mk = (name, weapon, model) => S.ally({ name, pos: [0, 0, 60], weapon, model: { net: true, ...model } });
  mk('Mahoney', 'thompson', { skinI: 0, hair: MAT.hairGrey, mustache: true });
  mk('Russo', 'garand', { skinI: 4, hair: MAT.hairDark });
  mk('Dupree', 'garand', { skinI: 5, hair: MAT.hairDark });
  mk('Weiss', 'garand', { skinI: 2, hair: MAT.hairBrown });
  mk('Doc', null, { skinI: 1, hair: MAT.hairBlond });
  const doc = S.get('Doc'); doc.combat = false;
  const cross = new THREE.MeshStandardMaterial({ map: genTextTex(64, 64, (g) => { g.fillStyle = '#eee'; g.beginPath(); g.arc(32, 32, 30, 0, TAU); g.fill(); g.fillStyle = '#b01e1e'; g.fillRect(24, 8, 16, 48); g.fillRect(8, 24, 48, 16); }), transparent: true });
  const cm = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), cross); cm.position.set(0, 0.03, 0.155); cm.rotation.x = 0.3; doc.h.helmet && doc.h.helmet.add(cm);
}
const SQUAD = ['Mahoney', 'Russo', 'Dupree', 'Weiss', 'Doc'];
function beachTick(dt) {
  BEACH.t = (BEACH.t || 0) + dt; const t = BEACH.t;
  if (MAT.water.normalMap) { MAT.water.normalMap.offset.x = t * 0.004; MAT.water.normalMap.offset.y = t * 0.007; }
  BEACH.foam.material.opacity = 0.35 + Math.sin(t * 0.6) * 0.15; BEACH.foam.position.z = 53 + Math.sin(t * 0.3) * 1.5;
  // boats
  const B = BEACH.boat;
  if (B && B.moving) {
    B.u = Math.min(1, B.u + dt / B.dur);
    const zc = lerp(B.z0, B.z1, easeOut(B.u) * 0.15 + B.u * 0.85);
    B.g.position.set(4, 0.18 + Math.sin(t * 1.1) * 0.2 * (1 - B.u * 0.6), zc);
    B.g.rotation.set(Math.sin(t * 0.9) * 0.035, Math.PI, Math.sin(t * 0.7) * 0.03);
    if (B.u >= 1) { B.moving = false; B.arrived = true; }
  }
  if (B && B.riding) {
    B.g.updateMatrixWorld();
    for (const r of B.riders) { if (!r.a.alive && r.a.deathT > 0) continue; const p = B.g.localToWorld(r.off.clone()); r.a.pos.copy(p); r.a.o.fixedY = p.y; }
    if (Player.ride) { const p = B.g.localToWorld(V3(0.5, -0.12, -1.6)); Player.pos.copy(p); Player.rideRoll = B.g.rotation.z * 0.6; }
  }
  for (const b of BEACH.others || []) {
    if (b.dead) { b.g.position.y -= dt * 0.25; b.g.rotation.z += dt * 0.05; continue; }
    if (!b.arrived) { b.u = Math.min(1, b.u + dt / b.dur); b.g.position.z = lerp(b.z0, b.z1, b.u); b.g.position.y = 0.18 + Math.sin(t * 1.1 + b.x) * 0.2; b.g.rotation.x = Math.sin(t * 0.9 + b.x) * 0.035; if (b.u >= 1) { b.arrived = true; b.g.userData.ramp.rotation.x = 1.4; } }
  }
  // offshore gunfire
  BEACH.navT = (BEACH.navT || 2) - dt;
  if (BEACH.navT <= 0) { BEACH.navT = rand(1.5, 4); const s = pick(BEACH.ships); const p = s.position.clone().add(V3(rand(-30, 30), 6, 0)); FX.flash.emit({ x: p.x, y: p.y, z: p.z, life: 0.25, s0: 30, s1: 50, c0: [1, 0.8, 0.5, 1], c1: [1, 0.5, 0.2, 0], fin: 0 }); SFX._distantShot('artillery', { g: 0.12, pan: clamp(-p.x / 300, -0.8, 0.8), cut: 700, d: 400 }, SFX.now() + 1.1); }
  // German artillery
  if (BEACH.arty) {
    BEACH.artyT = (BEACH.artyT || 3) - dt;
    if (BEACH.artyT <= 0) {
      BEACH.artyT = rand(BEACH.arty.min, BEACH.arty.max);
      const P = Player.pos; let p;
      if (BEACH.arty.boats) { p = V3(rand(-60, 70), 0, (B ? B.g.position.z : 120) + rand(-50, 40)); if (Math.hypot(p.x - 4, p.z - B.g.position.z) < 14) p.x += 25; }
      else {
        const idle = BEACH.idleT > 9, minD = idle ? 3 : 11;
        const a = rand(0, TAU), d = rand(minD, minD + 22); p = V3(P.x + Math.cos(a) * d, 0, P.z + Math.sin(a) * d * 0.7);
        p.z = clamp(p.z, -18, 70);
        if (idle) BEACH.idleT = 5;
      }
      p.y = Math.max(0, terrainH(p.x, p.z));
      SFX.whiz(0); setTimeout(() => { if (!BEACH.arty) return; Actors.explosion(p, 6, 120, { size: 1.6, playerMul: DIFFICULTY[Settings.difficulty].dmg }); }, 380);
    }
    // standing still in the open on the sand gets you bracketed
    if (Player.pos.z > -20 && Player.pos.z < 60 && Player.hSpeed < 0.5 && !BEACH.cover()) BEACH.idleT = (BEACH.idleT || 0) + dt; else BEACH.idleT = Math.max(0, (BEACH.idleT || 0) - dt * 2);
  }
  // fire from the bluff (tracers raking the sand)
  if (BEACH.rake) {
    BEACH.rakeT = (BEACH.rakeT || 1) - dt;
    if (BEACH.rakeT <= 0) {
      BEACH.rakeT = rand(0.8, 2.2);
      const src = pick([V3(30, BEACH.HA + 1.3, -93), V3(-38, BEACH.HB + 1.3, -90), V3(-12, terrainH(-12, -90) + 1.2, -90)]);
      const x0 = rand(-50, 60), z0 = rand(-12, 55), dx = rand(-12, 12), dz = rand(-6, 6);
      for (let i = 0; i < 14; i++) setTimeout(() => {
        const tp = V3(x0 + dx * i / 14, 0, z0 + dz * i / 14); tp.y = Math.max(0, terrainH(tp.x, tp.z));
        const dir = tp.clone().sub(src).normalize();
        if (i % 3 === 0) FX.tracer(src, dir, src.distanceTo(tp), { speed: 380, len: 6, w: 1.4 });
        FX.impact(tp, V3(0, 1, 0), tp.y <= 0.01 ? 'water' : 'sand');
        if (i % 4 === 0) SFX.impact(tp.y <= 0.01 ? 'water' : 'sand', tp);
      }, i * 55);
      SFX.mgBurst(src, 6, 18);
    }
  }
  // dead ground behind the seawall, easy targets in the open
  Story.playerHitMul = Player.pos.z < -24 && Player.pos.z > -32 ? 0.3 : Player.pos.z > 45 ? 0.55 : 0.9;
  // mines
  if (Player.pos.z < -31.5 && Player.pos.z > -52 && Player.alive) {
    if (Math.abs(Player.pos.x - 4) > 2.1 && !BEACH.mineWarned) { BEACH.mineWarned = true; Story.say('Dupree', 'Kessler! Stay on the tape — it’s a minefield!', 3); }
    for (const m of BEACH.mines) if (m.armed && Math.hypot(m.p.x - Player.pos.x, m.p.z - Player.pos.z) < 1.1) {
      m.armed = false; SFX.mech('click', m.p); HUD.hint('<kbd>!</kbd> Mine', 1);
      setTimeout(() => Actors.explosion(m.p.clone().add(V3(0, 0.2, 0)), 5, 240, { size: 1.2 }), 280);
    }
  }
}
BEACH.cover = () => { // is the player tucked behind an obstacle facing the bluffs?
  const e = Player.eyePos(); return !lineOfSight(e, V3(e.x, e.y + 2.6, e.z - 8));
};
function setAllyPath(name, pts, run = true, crouch = true) { const a = Actors.byName(name); if (a) { a.setGoal(V3(pts[0], 0, pts[1]), run, crouch); } }

MISSIONS.push({
  id: 'easyred', chapter: 'Chapter One', title: 'Easy Red', date: 'June 6, 1944', place: 'Omaha Beach, Normandy', seed: 61,
  card: { kicker: 'Chapter One · The Western Front', title: 'Easy Red', lines: ['Tuesday, June 6, 1944 — 06:21', 'Omaha Beach, sector Easy Red, Normandy', 'Pvt. Daniel Kessler — Charlie Company, 116th Infantry, 29th Division'] },
  ambience: 'sea',
  env: {
    sunDir: [0.75, 0.3, 0.45], sunColor: 0xd8dde2, sunI: 1.5, hemiSky: 0xa9b3bb, hemiGround: 0x6a6456, hemiI: 0.75,
    fog: 0x8e989e, fogDensity: 0.0048, groundColor: 0x6a6a60,
    sky: { top: 0x69747e, horizon: 0xa2aaaf, cloud: 0xa6acb0, cloudDark: 0x51575e, cover: 0.9, sunI: 0.35 },
    grade: { exposure: 1.02, sat: 0.62, contrast: 1.12, tint: [0.97, 1.0, 1.03], vig: 0.6, grain: 0.065, bloom: 1.2 },
    smokeTint: [0.45, 0.45, 0.45], dustTint: [0.62, 0.56, 0.44],
  },
  spawn: { pos: [4, 0, 230], yaw: 0 },
  loadout: { weapons: [{ id: 'garand', res: 64 }, { id: 'colt', res: 21 }], medkits: 2, nades: 3 },
  build() {
    Object.keys(BEACH).forEach(k => { if (k !== 'cover') delete BEACH[k]; });
    buildBeachLevel(); beachSpawnSquad();
    // the player's landing craft
    const g = makeLCVP(); R.scene.add(g);
    BEACH.boat = { g, z0: 236, z1: 78, u: 0, dur: 50, moving: false, riding: false, riders: [] };
    g.position.set(4, 0.2, 236); g.rotation.y = Math.PI;
    // other boats
    BEACH.others = [];
    for (const [x, d, z0] of [[-30, 58, 250], [-14, 48, 232], [22, 54, 248], [40, 62, 262], [58, 57, 245]]) {
      const b = makeLCVP(); makeBoatLoad(b); b.position.set(x, 0.2, z0); b.rotation.y = Math.PI; R.scene.add(b);
      BEACH.others.push({ g: b, x, z0, z1: 76 + Math.abs(x) * 0.08, u: 0, dur: d, arrived: false });
    }
  },
  onReady(stage) {
    Story.onTick = beachTick;
    S.squad('Pfc. Russo', 'Russo', 75);
    // MG crews on the bluff (until destroyed)
    BEACH.mgs = [];
    if (stage <= 5) {
      const a = S.enemy({ pos: [30, BEACH.HA, -93.9], fixedY: BEACH.HA, weapon: 'mg42', behavior: 'mg', alert: true, yaw: Math.PI, arc: { yaw: Math.PI, half: 0.85 }, throws: false });
      const l = S.enemy({ pos: [31.4, BEACH.HA, -95.2], fixedY: BEACH.HA, weapon: 'kar98', behavior: 'hold', alert: true, yaw: Math.PI, spots: [{ peek: V3(31.4, BEACH.HA, -94.2), hide: V3(31.4, BEACH.HA, -95.6), crouchHide: true }], throws: false });
      BEACH.bunkerA = [a, l]; BEACH.mgs.push(a);
    }
    if (stage <= 3) { BEACH.mgB = S.enemy({ pos: [-38, BEACH.HB, -90.9], fixedY: BEACH.HB, weapon: 'mg42', behavior: 'mg', alert: true, yaw: Math.PI, arc: { yaw: Math.PI, half: 0.85 }, throws: false }); BEACH.mgs.push(BEACH.mgB); }
    if (stage <= 4) { const c = BEACH.nestC; BEACH.mgC = S.enemy({ pos: [c.x, c.y, c.z], weapon: 'mg42', behavior: 'mg', alert: true, yaw: Math.PI, arc: { yaw: Math.PI - 0.2, half: 0.9 }, throws: false }); BEACH.mgs.push(BEACH.mgC); }
    BEACH.rake = stage >= 1 && stage <= 4;
  },
  stages: [
    { // ---- the run in ----
      async run(S) {
        const B = BEACH.boat;
        const offs = { Carver: V3(0, -0.12, 3.9), Mahoney: V3(-0.8, -0.12, 2.8), Weiss: V3(0.7, -0.12, 2.3), Dupree: V3(-0.7, -0.12, 1.0), Russo: V3(0.9, -0.12, -0.8), Doc: V3(-0.8, -0.12, -2.4) };
        S.ally({ name: 'Carver', pos: [0, 0, 60], weapon: 'thompson', model: { net: false, skinI: 0 } });
        const extras = [];
        for (const o of [V3(0.8, -0.12, 3.6), V3(-0.8, -0.12, 3.8), V3(0.1, -0.12, 2.0), V3(-0.1, -0.12, 0.2), V3(0.9, -0.12, 1.2), V3(-0.9, -0.12, -0.5), V3(0.1, -0.12, -1.2), V3(-0.2, -0.12, -3.2), V3(0.8, -0.12, -3.3)]) { const e = S.ally({ pos: [0, 0, 60], weapon: 'garand', model: { skinI: randi(0, 5) } }); e.combat = false; extras.push({ a: e, off: o }); }
        B.riders = Object.keys(offs).map(n => ({ a: Actors.byName(n), off: offs[n] })).concat(extras);
        B.riders.forEach(r => { r.a.yaw = 0; r.a.headPitch = 0.2; r.a.aimW = 0; r.a.combat = false; r.a.crouch = 0.3; });
        B.riding = true; B.moving = true; Player.ride = true; Player.lookLimit = { yaw: 0, half: 2.4, pmin: -0.7, pmax: 0.6 };
        HUD.weaponsVisible(true); BEACH.arty = { min: 1.5, max: 3.2, boats: true }; BEACH.rake = false;
        Music.play('tension');
        await S.wait(2.5);
        await S.say('Coxswain', 'Two minutes!', 2);
        await S.say('Carver', 'Listen up! When that ramp drops, you move. You do not stop on the sand. You get to the seawall.');
        S.sayQ('Weiss', 'Sh’ma Yisrael, Adonai Eloheinu, Adonai echad…', 4);
        await S.wait(4.5);
        await S.say('Dupree', 'Ain’t nobody said it’d be dry, Weiss. Hold it together.', 3);
        await S.say('Russo', 'Hey, Danny. Your old man’s watch. What time you got?', 3.2);
        await S.say('Kessler', 'Six thirty-one.', 2);
        await S.say('Russo', 'Remember that. Six thirty-one. When we’re old and fat, we tell ’em we were here at six thirty-one.', 4.4);
        await S.until(() => B.u > 0.5);
        // the boat beside us is hit
        const nb = BEACH.others[1]; nb.dead = true; Actors.explosion(nb.g.position.clone().add(V3(0, 1, 0)), 8, 0, { size: 2.4, noPlayerDmg: true, noScorch: true });
        FX.fireEmitter(nb.g.position.clone().add(V3(0, 1, 0)), { size: 1.2 }); R.shake = 0.6;
        await S.say('Mahoney', 'Jesus! Heads down! Heads DOWN!', 2.4);
        await S.say('Coxswain', 'Thirty seconds!', 1.8);
        await S.say('Mahoney', 'Check your weapons! Doc, you stay on my hip. Kessler, Russo — you stick to Dupree like glue.', 4.2);
        BEACH.rake = true;
        await S.until(() => B.arrived);
        // bullets ring off the ramp
        for (let i = 0; i < 8; i++) setTimeout(() => { const p = B.g.localToWorld(V3(rand(-1.2, 1.2), rand(0.3, 1.8), 5.2)); FX.impact(p, V3(0, 0, 1), 'metal'); SFX.impact('metal', p); }, i * 160);
        await S.say('Coxswain', 'Ramp going down! God be with you, boys!', 2.4);
        const ramp = B.g.userData.ramp; const t0 = Story.gameTime;
        await S.until(() => { const u = clamp((Story.gameTime - t0) / 0.9, 0, 1); ramp.rotation.x = 1.45 * easeIn(u); return u >= 1; });
        R.shake = 0.5; SFX.splash(B.g.localToWorld(V3(0, 0, 6)), true); FX.splash(B.g.localToWorld(V3(0, 0, 7)), 2);
        // the MG finds the ramp
        const mgSrc = V3(30, BEACH.HA + 1.3, -93);
        for (let i = 0; i < 16; i++) setTimeout(() => { const tp = B.g.localToWorld(V3(rand(-1.2, 1.2), rand(0.4, 1.6), rand(1, 4.5))); FX.tracer(mgSrc, tp.clone().sub(mgSrc).normalize(), mgSrc.distanceTo(tp), { speed: 400, len: 6, w: 1.4 }); FX.impact(tp, V3(0, 0, 1), 'flesh'); }, i * 60);
        SFX.mgBurst(mgSrc, 16, 18);
        setTimeout(() => { const c = Actors.byName('Carver'); c.alive = false; c.die(mgSrc); extras[0].a.die(mgSrc); extras[1].a.die(mgSrc); }, 350);
        await S.wait(0.8);
        await S.say('Mahoney', 'LIEUTENANT! — Over the side! Go! GO! GO!', 2.6);
        // release everyone
        B.riding = false; Player.ride = false; Player.lookLimit = null; Player.control = true;
        B.g.updateMatrixWorld();
        const c = B.g.position; addCol(c.x - 1.5, c.y - 0.6, c.z - 5.2, c.x + 1.5, c.y - 0.12, c.z + 5.2, { surf: 'wood' });
        addCol(c.x - 1.75, c.y - 0.6, c.z - 5.2, c.x - 1.5, c.y + 1.7, c.z + 5.2, { surf: 'wood' }); addCol(c.x + 1.5, c.y - 0.6, c.z - 5.2, c.x + 1.75, c.y + 1.7, c.z + 5.2, { surf: 'wood' });
        addCol(c.x - 1.7, c.y - 0.6, c.z + 5.0, c.x + 1.7, c.y + 1.9, c.z + 5.4, { surf: 'wood' });
        B.riders.forEach(r => { if (r.a.alive) { r.a.o.fixedY = null; r.a.headPitch = 0; r.a.combat = r.a.name !== 'Doc'; } });
        extras.slice(2).forEach((e, i) => { if (!e.a.alive) return; e.a.setGoal(V3(rand(-25, 30), 0, rand(-20, 0)), true, false); if (i % 2 === 0) setTimeout(() => e.a.alive && e.a.die(V3(e.a.pos.x, 30, -90)), 3000 + i * 2200); });
        BEACH.extras = extras;
        BEACH.arty = { min: 2.5, max: 5 };
      }
    },
    { // ---- the sand ----
      cp: { pos: [4, 0, 69], yaw: 0 },
      restore() {
        const B = BEACH.boat; B.g.position.set(4, 0.18, 78); B.g.userData.ramp.rotation.x = 1.45; B.arrived = true;
        BEACH.others.forEach((b, i) => { b.u = 1; b.g.position.z = b.z1; b.arrived = true; b.g.userData.ramp.rotation.x = 1.4; if (i === 1) { b.dead = true; b.g.position.y = -1.5; } });
      },
      async run(S) {
        Music.play('combat'); BEACH.arty = { min: 2.5, max: 5 }; BEACH.rake = true;
        if (Story.cpStage === 1) S.place({ Mahoney: [0, 0, 66], Russo: [6, 0, 67], Dupree: [-3, 0, 66], Weiss: [2, 0, 65], Doc: [9, 0, 66] });
        S.obj('Get to the seawall', V3(4, 4.2, -26.5), 'Seawall');
        S.hint('Move from obstacle to obstacle. Don’t stop in the open.', 6);
        const legs = { Mahoney: [[-2, 43], [-8, 19], [-3, -25.4]], Russo: [[8, 45], [10, 21], [6, -25.4]], Dupree: [[-10, 40], [-13, 15], [-7, -25.4]], Weiss: [[1, 37], [3, 12], [1, -25.4]], Doc: [[13, 41], [15, 17], [10, -25.4]] };
        let leg = 0;
        const advance = () => { for (const n in legs) { const a = Actors.byName(n); if (a && legs[n][leg]) a.setGoal(V3(legs[n][leg][0], 0, legs[n][leg][1]), true, true); } leg++; };
        advance();
        const barks = [
          [55, 'Mahoney', 'Move up! Use the obstacles! Keep moving!'],
          [42, 'Russo', 'Danny! Over here! Get behind the hedgehog!'],
          [30, 'Doc', 'Medic! I’m coming, I’m coming — hold on!'],
          [20, 'Dupree', 'That MG up top has us zeroed! Stay low!'],
          [8, 'Mahoney', 'Seawall! Everybody to the seawall!'],
        ];
        let bi = 0;
        await S.until(() => {
          const z = Player.pos.z;
          while (bi < barks.length && z < barks[bi][0]) { S.sayQ(barks[bi][1], barks[bi][2]); bi++; }
          if (leg === 1 && z < 36) advance();
          if (leg === 2 && z < 14) advance();
          return z < -21.5;
        });
        if (leg < 3) advance();
      }
    },
    { // ---- the bangalore ----
      cp: { pos: [3, 0, -25.2], yaw: 0 },
      async run(S) {
        BEACH.arty = { min: 4, max: 7 };
        S.place({ Mahoney: [-3, 0, -25.4], Russo: [6, 0, -25.4], Dupree: [-7, 0, -25.4], Weiss: [1, 0, -25.4], Doc: [10, 0, -25.4] });
        SQUAD.forEach(n => { const a = S.get(n); a.goal = null; a.coverCrouch = true; a.crouch = 1; });
        S.clearObj();
        await S.say('Mahoney', 'We need that wire blown! Where the hell are the engineers?');
        await S.say('Dupree', 'Bishop had the bangalore, Sarge! He’s down by that hedgehog — he didn’t make it!', 3.6);
        await S.say('Mahoney', 'Kessler! Get back out there and bring me that bangalore! We’ll cover you!', 3.4);
        S.obj('Retrieve the Bangalore torpedo', BEACH.bishopPos.clone().add(V3(0, 0.6, 0)), 'Bangalore');
        const take = S.interact({ pos: BEACH.bishopPos.clone().add(V3(0.6, 0.4, 0.4)), text: 'take the Bangalore torpedo', hold: 1, r: 2.6, cone: 0 });
        await take.done;
        R.scene.remove(BEACH.bangalore); HUD.notify('Bangalore torpedo');
        await S.say('Russo', 'He’s got it! Covering fire! Give him covering fire!', 2.8);
        S.obj('Place the Bangalore under the wire', V3(4, 3.8, -30.4), 'Wire');
        const place = S.interact({ pos: V3(4, 3.8, -29.6), text: 'slide the Bangalore under the wire', hold: 1.6, r: 2.4, cone: 0.2 });
        await place.done;
        const tube = new THREE.Mesh(cylG(0.04, 0.04, 3, 8, false), MAT.od); tube.rotation.set(Math.PI / 2, 0, 0); tube.position.set(4, 3.3, -31); R.scene.add(tube);
        await S.say('Kessler', 'Fire in the hole!', 1.5);
        S.obj('Get clear!', null); S.hint('Get away from the wire!', 3);
        await S.wait(3.5);
        R.scene.remove(tube);
        Actors.explosion(V3(4, 3.4, -31), 5.5, 150, { size: 1.6 });
        BEACH.wires.filter(w => w.x0 <= 4 && w.x0 + 12 >= 4).forEach(w => w.w.remove());
        BEACH.breached = true;
        await S.wait(1.2);
        await S.say('Mahoney', 'That’s it! Through the gap! Go, go!', 2.4);
      }
    },
    { // ---- the minefield ----
      cp: { pos: [4, 0, -26], yaw: 0 },
      restore() { R.scene.remove(BEACH.bangalore); BEACH.wires.filter(w => w.x0 <= 4 && w.x0 + 12 >= 4).forEach(w => w.w.remove()); BEACH.breached = true; },
      async run(S) {
        BEACH.arty = null;
        if (Story.cpStage === 3) S.place({ Mahoney: [-3, 0, -25.4], Russo: [6, 0, -25.4], Dupree: [-7, 0, -25.4], Weiss: [1, 0, -25.4], Doc: [10, 0, -25.4] });
        // riflemen on the lower slopes
        BEACH.lower = BEACH.nests.slice(0, 4).map(([x, z]) => S.enemy({ pos: [x, 0, z], weapon: 'kar98', behavior: 'hold', alert: true, spots: [{ peek: V3(x, 0, z), crouchHide: true }], yaw: Math.PI, accMul: 0.8 }));
        await S.say('Dupree', 'Engineers taped a lane! Single file, stay between the tapes!', 3.2);
        await S.say('Mahoney', 'Smoke! Pop smoke and move!', 2);
        // smoke screen
        Story.smoke = [];
        for (const [x, z] of [[-4, -44], [10, -46], [3, -52]]) { Story.smoke.push({ p: V3(x, 5, z), r: 8 }); FX.addEmitter({ rate: 14, life: 70, fn: () => FX.smoke.emit({ x: x + rand(-3, 3), y: terrainH(x, z) + rand(0, 2), z: z + rand(-3, 3), vx: rand(0.4, 1), vy: rand(0.3, 1), vz: rand(-0.3, 0.3), drag: 0.2, life: rand(8, 12), s0: 3, s1: 9, c0: [0.82, 0.82, 0.8, 0.85], c1: [0.8, 0.8, 0.78, 0], fin: 0.1 }) }); }
        ['Dupree', 'Russo', 'Weiss', 'Mahoney', 'Doc'].forEach((n, i) => setTimeout(() => { const a = S.get(n); a && a.setGoal(V3(4 + (i % 2 ? 0.5 : -0.5), 0, -52 + i * 1.2), true, true); }, 800 + i * 900));
        S.obj('Follow the tape across the minefield', V3(4, 4.5, -53), 'Bluff');
        await S.reach(V3(4, 0, -52.5), 3);
        S.clearObj();
      }
    },
    { // ---- the draw ----
      cp: { pos: [4, 0, -53], yaw: 0 },
      restore() { BEACH.mines.forEach(m => m.armed = false); },
      async run(S) {
        Story.smoke = [];
        S.place({ Mahoney: [2, 0, -52], Russo: [6, 0, -53], Dupree: [0, 0, -51], Weiss: [4, 0, -50], Doc: [7, 0, -50] });
        BEACH.rake = false;
        // the Navy takes out bunker B
        if (BEACH.mgB && BEACH.mgB.alive) {
          await S.say('Weiss', 'Navy’s on the net — destroyer’s coming in close! Get down!', 3);
          const p = V3(-38, BEACH.HB + 1.5, -93);
          for (let i = 0; i < 3; i++) setTimeout(() => Actors.explosion(p.clone().add(V3(rand(-3, 3), 0, rand(-2, 2))), 9, 0, { size: 2.2, noPlayerDmg: true }), i * 700);
          setTimeout(() => { BEACH.mgB.die(p); FX.smokeColumn(p.clone(), { size: 1, rate: 4, dark: 0.12 }); FX.fireEmitter(p.clone().add(V3(0, -0.5, 2)), { size: 0.8 }); }, 800);
          await S.wait(2.5);
          await S.say('Russo', 'Look at that! God bless the United States Navy!', 3);
        }
        const lower = (BEACH.lower && BEACH.lower.some(e => e.alive)) ? BEACH.lower : BEACH.nests.slice(0, 4).map(([x, z]) => S.enemy({ pos: [x, 0, z], weapon: 'kar98', behavior: 'hold', alert: true, spots: [{ peek: V3(x, 0, z), crouchHide: true }], yaw: Math.PI, accMul: 0.8 }));
        const upper = [
          ...BEACH.nests.slice(4).map(([x, z]) => S.enemy({ pos: [x, 0, z], weapon: 'kar98', behavior: 'hold', spots: [{ peek: V3(x, 0, z), crouchHide: true }], yaw: Math.PI })),
          S.enemy({ pos: [1, 0, -96], weapon: 'mp40', behavior: 'hold', spots: [{ peek: V3(1, 0, -96), crouchHide: false }], yaw: Math.PI }),
          S.enemy({ pos: [6, 0, -99], weapon: 'mp40', behavior: 'rush', yaw: Math.PI }),
        ];
        const trench = [[-8, -104.5], [0, -104.8], [11, -104.4], [19, -104.6]].map(([x, z]) => S.enemy({ pos: [x, 0, z], weapon: pick(['kar98', 'kar98', 'mp40']), behavior: 'hold', spots: [{ peek: V3(x, 0, z + 1.3), hide: V3(x, 0, z), crouchHide: true }], yaw: Math.PI }));
        S.obj('Fight up the draw', V3(drawX(-80), terrainH(drawX(-80), -80) + 1.5, -80), 'Draw', 'Clear the German positions on the slope');
        S.sayQ('Mahoney', 'Up the draw! Take those holes one at a time!');
        const allyStep = (z) => SQUAD.forEach((n, i) => { const a = S.get(n); const zz = z + (i % 3) * 2; a && a.setGoal(V3(drawX(zz) + (i - 2) * 2.4, 0, zz), true, true); });
        allyStep(-58);
        await S.until(() => { HUD.setObjective(`Fight up the draw (${S.alive(lower)} left on the lower slope)`); return S.alive(lower) === 0 || Player.pos.z < -80; });
        upper.forEach(e => e.alert()); allyStep(-72);
        S.obj('Take the upper slope', V3(drawX(-95), terrainH(drawX(-95), -95) + 1.5, -95), 'Upper slope');
        S.sayQ('Dupree', 'More of ’em up top! Watch that MG on the left!');
        await S.until(() => { HUD.setObjective(`Take the upper slope (${S.alive(upper) + (BEACH.mgC && BEACH.mgC.alive ? 1 : 0)} left)`); return (S.alive(upper) + (BEACH.mgC && BEACH.mgC.alive ? 1 : 0)) <= 1 || Player.pos.z < -97; });
        trench.forEach(e => e.alert()); allyStep(-90);
        S.obj('Clear the trench line', V3(5, terrainH(5, -104) + 1.2, -104), 'Trench');
        await S.until(() => { HUD.setObjective(`Clear the trench line (${S.alive(trench)} left)`); return S.alive(trench) === 0 && S.alive(upper) === 0; });
        await S.say('Mahoney', 'Trench is ours! Good work — now let’s shut that bunker up.', 3);
      }
    },
    { // ---- the bunker ----
      cp: { pos: [8, 0, -104.6], yaw: -Math.PI / 2 },
      restore() { BEACH.mines.forEach(m => m.armed = false); BEACH.rake = false; if (BEACH.mgB) BEACH.mgB.alive && BEACH.mgB.die(); if (BEACH.mgC) BEACH.mgC.alive && BEACH.mgC.die(); },
      async run(S) {
        S.place({ Mahoney: [4, 0, -104.6], Russo: [0, 0, -104.6], Dupree: [-4, 0, -104.6], Weiss: [-8, 0, -104.6], Doc: [-2, 0, -103] });
        const guards = [S.enemy({ pos: [24, 0, -101.5], weapon: 'kar98', behavior: 'hold', spots: [{ peek: V3(24, 0, -101.5), crouchHide: false }], yaw: Math.PI / 2 + 0.3 }), S.enemy({ pos: [27, 0, -103], weapon: 'mp40', behavior: 'hold', spots: [{ peek: V3(27, 0, -103), crouchHide: false }], yaw: Math.PI / 2 })];
        await S.say('Mahoney', 'That bunker’s still chewing up the boats. Kessler, Russo — around the back. Doc, you got the satchel?', 4);
        await S.say('Doc', 'Here. Pull the cord, count five, and run like hell.', 3);
        HUD.notify('Satchel charge');
        S.goals({ Russo: [16, 0, -104.6], Dupree: [12, 0, -104.6] }, true, true);
        S.obj('Destroy the MG bunker', V3(30, BEACH.HA + 1.2, -99.8), 'Bunker', 'Plant the satchel charge at the rear door — or get a grenade inside');
        let done = false, planted = false;
        const destroy = () => {
          if (done) return; done = true;
          const c = V3(30, BEACH.HA + 1.2, -96);
          Actors.explosion(c, 6, 180, { size: 2 });
          (BEACH.bunkerA || []).forEach(e => e.alive && e.die(c));
          Actors.list.filter(a => a.team === 'de' && a.alive && a.pos.distanceTo(c) < 4.5).forEach(a => a.die(c));
          FX.smokeColumn(V3(30, BEACH.HA + 2.5, -92.5), { size: 0.8, rate: 5, dark: 0.1 }); FX.fireEmitter(V3(30, BEACH.HA + 0.3, -95), { size: 0.9 });
        };
        Actors.explosionHooks.push((p, r, o) => { if (o.grenade && Math.abs(p.x - 30) < 3.4 && p.z < -93.2 && p.z > -99.2 && p.y > BEACH.HA - 0.5) destroy(); });
        const it = S.interact({ pos: V3(30, BEACH.HA + 1.0, -100), text: 'plant the satchel charge', hold: 1.2, r: 2.4, cone: 0 });
        it.done.then(() => { planted = true; });
        await S.until(() => planted || done);
        if (!done) {
          it.remove(); S.say('Kessler', 'Charge set! Get clear!', 1.8);
          const sat = new THREE.Mesh(boxG(0.3, 0.25, 0.2), MAT.webbing); sat.position.set(30, BEACH.HA + 0.15, -98.9); R.scene.add(sat);
          const t0 = Story.gameTime;
          await S.until(() => { const left = 5 - (Story.gameTime - t0); HUD.counter(left.toFixed(1), 'Get clear'); return left <= 0 || done; });
          HUD.counter(null); R.scene.remove(sat); destroy();
        }
        await S.wait(1.5);
        await S.until(() => S.alive(guards) === 0 || Player.pos.distanceTo(V3(30, 0, -100)) > 1);
        guards.forEach(g => g.alert());
        await S.until(() => S.alive(guards) === 0);
      }
    },
    { // ---- off the beach ----
      async run(S) {
        S.clearObj(); Music.play('sorrow');
        SQUAD.forEach(n => { const a = S.get(n); a.goal = null; a.combat = false; a.aimW = 0; });
        S.place({ Mahoney: [-2, 0, -98, Math.PI], Russo: [2, 0, -97.5, Math.PI], Dupree: [-5, 0, -99, Math.PI], Weiss: [5, 0, -98.5, Math.PI], Doc: [0, 0, -100, Math.PI] });
        await S.say('Mahoney', 'On me! Regroup on me!', 2.2);
        S.obj('Regroup with the squad', V3(0, terrainH(0, -97) + 1.5, -97), 'Squad');
        await S.reach(V3(0, 0, -98), 5);
        S.clearObj(); S.cinema(true); HUD.weaponsVisible(false); VM.visible = false;
        const cam = S.camPath({ from: [-6, 36, -94], to: [8, 35, -91], lookFrom: [-10, 4, 20], lookTo: [10, 2, 30], dur: 22, hold: true });
        await S.wait(1.5);
        await S.say('Mahoney', 'Look at it. Just… look at it.', 3);
        await S.say('Russo', 'How many, Sarge?', 2);
        await S.say('Mahoney', 'Too many. Lieutenant Carver. Hendricks. Bishop. Half the platoon.', 4);
        await S.say('Mahoney', 'Weiss. Get battalion on the horn. Tell ’em Easy Red is open.', 3.6);
        await S.say('Weiss', 'Battalion, this is Charlie Two. We are off the beach. Repeat — we are off the beach. Over.', 4.6);
        await S.say('Mahoney', 'Kessler. What time is it?', 2.4);
        await S.say('Kessler', 'Eleven forty, Sarge.', 2.2);
        await S.say('Mahoney', 'Five hours to cross three hundred yards. God help us if we ever have to walk to Berlin.', 4.4);
        await S.fade(1, 2.5);
        S.endCam(); S.cinema(false);
      }
    },
  ],
  outro: { kicker: 'June 6, 1944', lines: ['By nightfall, some 34,000 men had come ashore at Omaha Beach.', 'More than 2,000 of them were killed, wounded, or missing.'], hold: 3 },
});
