'use strict';
/* =====================================================================
   CHAPTER ONE · III — SAINTE-COLOMBE (June 14, 1944)
   Main street runs north (-Z) into the square; the pink mairie closes
   the north side, the church tower rises on the east.
   ===================================================================== */
const TOWN = {};
function townH(x, z) {
  const d = Math.max(Math.abs(x) - 60, Math.abs(z + 20) - 110, 0);
  return (fbm(x * 0.02, z * 0.02, 3) - 0.5) * 3 * smoothstep(0, 40, d) + d * 0.04;
}
function rotunda(x, z, r, h) {
  const K = KIT, seg = 22, y0 = 0;
  for (let i = 0; i < seg; i++) {
    const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU, am = (a0 + a1) / 2;
    const cx = x + Math.cos(am) * r, cz = z + Math.sin(am) * r, len = 2 * r * Math.sin(Math.PI / seg) + 0.05, ry = -am + Math.PI / 2;
    const win = i % 2 === 0, broken = i >= 14 && i <= 17;
    const top = broken ? h * sr(0.5, 0.8) : h;
    const piece = (ya, yb, w, off = 0) => K.visBox(w, yb - ya, 0.45, cx + Math.cos(am + Math.PI / 2) * off, y0 + ya, cz + Math.sin(am + Math.PI / 2) * off, MAT.plasterGrey, { ry });
    if (!win) piece(0, top, len);
    else {
      piece(0, 1.0, len); piece(3.2, Math.min(top, 4.4), len); if (top > 5.2) { piece(4.4, 4.9, len); piece(6.9, top, len); }
      piece(1.0, 3.2, (len - 1.2) / 2, -(len / 2 - (len - 1.2) / 4)); piece(1.0, 3.2, (len - 1.2) / 2, (len / 2 - (len - 1.2) / 4));
      if (top > 5.2) { piece(4.9, 6.9, (len - 1.1) / 2, -(len / 2 - (len - 1.1) / 4)); piece(4.9, 6.9, (len - 1.1) / 2, (len / 2 - (len - 1.1) / 4)); }
      K.cylinder(0.6, 0.3, cx, 3.2, cz, MAT.plasterWhite, { rx: Math.PI / 2, rz: 0, ry, seg: 10 });
    }
    K.visBox(len + 0.1, 0.3, 0.7, cx, y0 + 4.4, cz, MAT.stone, { ry, cast: false });
    if (!broken) K.visBox(len + 0.15, 0.45, 0.85, cx, y0 + h, cz, MAT.stone, { ry });
  }
  K.visBox(r * 1.5, h - 0.3, r * 1.5, x, 0.2, z, MAT.interior, { cast: false });
  K.cylinder(r * 0.98, 1.2, x, h + 0.45, z, MAT.roofSlate, { r2: r * 0.98, seg: seg });
  K.cylinder(r * 0.3, r * 0.55, x, h + 1.6, z, MAT.roofSlate, { r2: r * 0.95, seg: seg });
  addCol(x - r * 0.95, 0, z - r * 0.95, x + r * 0.95, h + 1, z + r * 0.95, { surf: 'stone' });
}
function tower(x, z, w, h) {
  const K = KIT, bel = h - 7;
  for (const [x0, z0, x1, z1] of [[x - w / 2, z + w / 2, x + w / 2, z + w / 2], [x - w / 2, z - w / 2, x + w / 2, z - w / 2], [x - w / 2, z - w / 2, x - w / 2, z + w / 2], [x + w / 2, z - w / 2, x + w / 2, z + w / 2]])
    K.wall(x0, z0, x1, z1, 0, h, 0.7, MAT.stone, [{ c: w / 2, w: 2.8, y0: bel, y1: bel + 3.4 }, { c: w / 2, w: 0.7, y0: 6, y1: 7.8 }]);
  K.box(w - 0.4, 0.3, w - 0.4, x, bel - 0.3, z, MAT.woodDark, { surf: 'wood' });
  const g = geo('spire' + w, () => { const c = new THREE.ConeGeometry(w * 0.72, 9, 4); c.rotateY(Math.PI / 4); c.translate(0, 4.5, 0); return c; });
  KIT.b.add(g, mtx(x, h, z), MAT.roofSlate, { worldUV: false, uvScale: 0.3 });
  K.visBox(w + 0.4, 0.5, w + 0.4, x, h - 0.2, z, MAT.stoneDark);
  K.visBox(w + 0.3, 0.35, w + 0.3, x, bel - 0.6, z, MAT.stoneDark);
  K.visBox(w - 1.6, h - 1, w - 1.6, x, 0.2, z, MAT.interior, { cast: false });
  return bel;
}
function buildTownLevel(menu) {
  reseed(91); World.water = null;
  World.terrain = new Terrain({
    x0: -180, z0: -220, w: 360, d: 340, res: 2, h: townH,
    color: (x, z, h, n) => { const v = 0.85 + fbm(x * 0.2, z * 0.2, 2) * 0.25; const g = fbm(x * 0.05, z * 0.05, 3); const c = g > 0.5 ? [0.46, 0.44, 0.34] : [0.52, 0.48, 0.38]; return [c[0] * v, c[1] * v, c[2] * v]; }
  });
  World.surfaceAt = () => 'stone';
  World.bounds = [-30, -128, 30, 72];
  const K = KIT;
  // cobbled streets & square
  for (const [x, z, w, d] of [[0, 30, 16, 104], [0, -50, 66, 58], [-70, -46, 80, 13], [22, -110, 13, 64]]) K.visBox(w, 0.06, d, x, 0, z, MAT.cobble, { cast: false, receive: true });
  // pavements
  for (const sx of [-1, 1]) K.visBox(1.6, 0.16, 100, sx * 8.2, 0, 30, MAT.stoneDark, { cast: false });
  addCol(-9, 0, -20, -7.4, 0.16, 80, { surf: 'stone' }); addCol(7.4, 0, -20, 9, 0.16, 80, { surf: 'stone' });
  // ---- west row ----
  rotunda(-17, 46, 8, 8.6);
  TOWN.W2 = K.building({ x: -15, z: 27, w: 12, d: 14, floors: 3, fh: 3.3, mat: MAT.plasterOchre, trim: MAT.stone, ruin: 0.5, detail: true, inset: 1.5 });
  TOWN.W3 = K.building({ x: -15, z: 12, w: 12, d: 11, floors: 3, fh: 3.3, mat: MAT.plaster, trim: MAT.stone, ruin: 0.75, enter: true, door: 'e', inset: 1.5 });
  TOWN.W4 = K.building({ x: -15, z: -9, w: 12, d: 15, floors: 3, fh: 3.3, mat: MAT.plasterGrey, trim: MAT.stone, ruin: 0.3, detail: true, inset: 1.5, shopfront: ['e'] });
  // back lane walls & sheds
  K.wall(-28.5, 64, -28.5, -38, 0, 2.2, 0.5, MAT.stoneDark);
  K.box(4, 2.6, 5, -25.5, 0, 36, MAT.woodDark, { surf: 'wood' }); K.crate(-23, 20, 0.3); K.crate(-23.5, 21, 1.1); K.barrel(-22.5, 5); K.barrel(-23.3, 4.2);
  K.rubble(-24.5, -12, 2.2, 1.0); K.box(3, 1.4, 1.2, -24, 0, -24, MAT.wood, { surf: 'wood' });
  // alley between W3 and W4 (z -1.5..6.5) — walls at the lane end keep the player in
  // ---- east side ----
  K.wall(8.3, 70, 8.3, 36, 0, 1.4, 0.6, MAT.stone); K.visBox(0.8, 0.12, 34, 8.3, 1.4, 53, MAT.stoneDark);
  for (let i = 0; i < 9; i++) { const x = 12 + sr(0, 12), z = 40 + i * 3.6 + sr(-1, 1); K.tree(x, z, { h: sr(7, 10), crown: sr(2.6, 3.4), mat: sr() < 0.65 ? MAT.leavesAutumn : MAT.leaves, col: false }); }
  K.rubble(12, 50, 3, 1.2, { col: false }); K.rubble(10, 38, 2.5, 1.4);
  for (let i = 0; i < 18; i++) K.rock(sr(9, 12), sr(0.8, 1.6), sr(38, 68), sr(0.3, 0.7), sr() < 0.5 ? MAT.stone : MAT.stoneDark);
  addCol(8, 0, 36, 26, 1.6, 70, { surf: 'stone' });
  K.building({ x: 17, z: 76, w: 16, d: 10, floors: 2, fh: 3.3, mat: MAT.plaster, ruin: 0.2 });
  TOWN.E1 = K.building({ x: 16, z: 24, w: 12, d: 16, floors: 2, fh: 3.3, mat: MAT.plasterWhite, trim: MAT.stone, ruin: 0.6, detail: true, inset: 1.5 });
  TOWN.E2 = K.building({ x: 16, z: 4, w: 12, d: 14, floors: 3, fh: 3.3, mat: MAT.plasterOchre, trim: MAT.stone, ruin: 0.2, detail: true, inset: 1.5, shopfront: ['w'] });
  TOWN.E3 = K.building({ x: 16, z: -13, w: 12, d: 10, floors: 2, fh: 3.3, mat: MAT.plasterGrey, trim: MAT.stone, ruin: 0.8, detail: true });
  // ---- the square ----
  TOWN.mairie = K.building({ x: 0, z: -88, w: 26, d: 12, floors: 3, fh: 3.6, mat: MAT.plasterPink, trim: MAT.plasterWhite, ruin: 0.12, detail: true, inset: 1.5, door: 's', shutterMat: MAT.plasterWhite, spacing: 3.2, winW: 1.3, winH: 1.9, roofMat: MAT.roofSlate, ridgeX: true });
  K.plane(makeSign('MAIRIE', { bg: 'rgba(0,0,0,0)', fg: '#f3ece0', w: 512, h: 96, border: false, grime: false, font: 'bold 60px Georgia, serif' }), 5, 0.95, 0, 8.4, -81.8, 0, { transparent: true });
  const tricolor = genTextTex(96, 64, (g) => { g.fillStyle = '#23305a'; g.fillRect(0, 0, 32, 64); g.fillStyle = '#efe9dc'; g.fillRect(32, 0, 32, 64); g.fillStyle = '#b3262c'; g.fillRect(64, 0, 32, 64); });
  TOWN.flag = K.plane(genTextTex(96, 64, (g) => { g.fillStyle = '#b3262c'; g.fillRect(0, 0, 96, 64); g.fillStyle = '#efe9dc'; g.beginPath(); g.arc(48, 32, 18, 0, TAU); g.fill(); g.fillStyle = '#111'; g.fillRect(44, 18, 8, 28); g.fillRect(34, 28, 28, 8); }), 2.4, 1.6, 0, 11.6, -81.7, 0, { double: true });
  TOWN.tricolor = tricolor;
  TOWN.churchBel = tower(36, -30, 7, 25);
  K.building({ x: 45, z: -54, w: 14, d: 30, floors: 2, fh: 6, mat: MAT.stone, trim: MAT.stoneDark, winW: 1.6, winH: 4, spacing: 5, roofMat: MAT.roofSlate, shutters: false, ruin: 0.1 });
  K.building({ x: -40, z: -30, w: 14, d: 13, floors: 3, fh: 3.3, mat: MAT.plaster, ruin: 0.7, detail: true });
  K.building({ x: -40, z: -65, w: 14, d: 17, floors: 3, fh: 3.3, mat: MAT.plasterOchre, ruin: 0.45, detail: true });
  K.building({ x: -60, z: -29, w: 16, d: 12, floors: 2, fh: 3.3, mat: MAT.plasterGrey, ruin: 0.5 });
  K.building({ x: -62, z: -64, w: 18, d: 14, floors: 3, fh: 3.3, mat: MAT.plaster, ruin: 0.2 });
  K.building({ x: -86, z: -64, w: 18, d: 14, floors: 2, fh: 3.3, mat: MAT.plasterWhite, ruin: 0.1 });
  K.building({ x: -86, z: -29, w: 18, d: 12, floors: 2, fh: 3.3, mat: MAT.plasterOchre, ruin: 0.3 });
  TOWN.burn = K.building({ x: 38, z: -96, w: 14, d: 16, floors: 3, fh: 3.3, mat: MAT.plasterGrey, ruin: 0.55 });
  K.building({ x: 6, z: -110, w: 18, d: 14, floors: 3, fh: 3.3, mat: MAT.plaster, ruin: 0.3 });
  K.building({ x: 38, z: -122, w: 14, d: 16, floors: 3, fh: 3.3, mat: MAT.plasterOchre, ruin: 0.2 });
  K.building({ x: -20, z: -106, w: 16, d: 18, floors: 2, fh: 3.3, mat: MAT.plasterGrey, ruin: 0.4 });
  // back row of distant ruined facades (skyline)
  for (let i = 0; i < 10; i++) K.building({ x: -70 + i * 16, z: -150 - sr(0, 12), w: 14, d: 10, floors: sri(2, 4), fh: 3.3, mat: pick([MAT.plaster, MAT.plasterGrey, MAT.plasterOchre, MAT.plasterPink]), ruin: sr(0.1, 0.8) });
  for (let i = 0; i < 6; i++) K.building({ x: -60 - sr(0, 20), z: 70 - i * 18, w: 14, d: 14, floors: sri(2, 3), fh: 3.3, mat: pick([MAT.plaster, MAT.plasterGrey]), ruin: sr(0.1, 0.6) });
  for (let i = 0; i < 5; i++) K.building({ x: 44 + sr(0, 10), z: 20 - i * 16, w: 14, d: 14, floors: sri(2, 3), fh: 3.3, mat: pick([MAT.plaster, MAT.plasterOchre]), ruin: sr(0.1, 0.6) });
  // fountain & square furniture
  K.cylinder(3.2, 0.7, 0, 0, -48, MAT.stone, { col: true, seg: 24 }); K.cylinder(2.9, 0.12, 0, 0.62, -48, std({ color: col(0x3a4a48), roughness: 0.1 }), { seg: 24 });
  K.cylinder(0.45, 2.8, 0, 0.7, -48, MAT.stone, { col: true, seg: 12 }); K.cylinder(1.1, 0.25, 0, 2.2, -48, MAT.stone, { seg: 16 });
  TOWN.ammoPos = V3(2.8, 0.6, -44);
  K.crate(3.6, -43.6, 0.3); K.crate(2.4, -43.5, -0.2); K.plane(makeLabelTex('.30 CAL', '#e8e0c0', '#2d3422', 128, 48), 0.5, 0.18, 2.4, 0.35, -43.18, 0);
  for (const [x, z] of [[-20, -30], [20, -30], [-24, -70], [24, -70], [-14, -60], [14, -60]]) { K.tree(x, z, { h: sr(9, 12), crown: 3.2, mat: sr() < 0.5 ? MAT.leavesAutumn : MAT.leaves }); }
  for (const [x, z] of [[-6, -24], [6, -24], [-28, -26], [28, -76]]) K.lamp(x, z);
  K.sandbags(-3.5, -21, 5, 3, 0); K.sandbags(4, -21.5, 4, 3, 0.1);
  K.sandbags(-2, -56, 4, 3, 0); K.sandbags(5.5, -55, 3, 3, -0.3);
  K.hedgehog(-10, -35, 0.4); K.hedgehog(12, -38, 1.2);
  // wrecked Sherman in the street (like the reference)
  const wk = makeSherman(); wk.position.set(2.5, 0, -8); wk.rotation.set(0.02, 0.35, -0.04); R.scene.add(wk);
  wk.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.multiplyScalar(0.55); m.material.userData.dispose = true; } }); wk.userData.turret.rotation.y = 0.6;
  addCol(0, 0, -11, 5, 2.6, -5, { surf: 'metal' });
  // rubble — foreground to square
  K.rubble(-3.5, 51, 2.8, 1.4); K.rock(-4.5, 1.2, 50.5, 2.2, MAT.concrete, { v: 2, sx: 1.4, sy: 1.2 }); addCol(-7, 0, 49, -2, 2.4, 53, { surf: 'stone' });
  K.rubble(5, 44, 3.2, 1.6); K.rubble(-5, 33, 2.4, 1.0); K.rubble(5.5, 16, 2.6, 1.2); K.rubble(-4.8, 2, 2.2, 0.9); K.rubble(-6, -16, 2.8, 1.6);
  K.rubble(-18, -40, 3.5, 1.8); K.rubble(20, -48, 3, 1.5); K.rubble(-8, -76, 3.2, 1.4); K.rubble(14, -70, 2.6, 1.2);
  K.crate(3, 22, 0.4); K.crate(3.5, 22.8, 1); K.barrel(-5.5, 10); K.box(2, 1.1, 1.3, 4.5, 0, 30, MAT.wood, { ry: 0.4, surf: 'wood' });
  for (const [x, z] of [[-6, 58], [6, 36], [-2, 12], [6, -2], [-10, -52], [18, -60]]) FX.scorchMark(V3(x, 0, z), sr(2, 3.5));
  // pole & wires
  for (const z of [64, 40, 16]) K.pole(7.6, z, 8);
  // smoke & fire
  FX.smokeColumn(V3(38, 10, -96), { size: 2.4, rate: 7, dark: 0.1, wind: 2.2, windZ: 0.6, lifeMul: 1.3 });
  FX.fireEmitter(V3(36, 3.4, -90), { size: 1.6 }); FX.fireEmitter(V3(41, 6.8, -92), { size: 1.2 });
  FX.smokeColumn(V3(-40, 6, -30), { size: 0.9, rate: 3, dark: 0.25, wind: 1.5 });
  FX.fireEmitter(V3(-16, 3.4, 12), { size: 0.7 });
  FX.smokeColumn(V3(70, 2, -170), { size: 2, rate: 3, dark: 0.18 });
  TOWN.lights = true;
}
function townSquad() {
  const mk = (name, weapon, model) => S.ally({ name, pos: [0, 0, 60], weapon, model: { net: true, ...model } });
  mk('Mahoney', 'thompson', { skinI: 0, hair: MAT.hairGrey, mustache: true });
  mk('Russo', 'garand', { skinI: 4, hair: MAT.hairDark });
  mk('Dupree', 'garand', { skinI: 5, hair: MAT.hairDark });
  mk('Doc', null, { skinI: 1, hair: MAT.hairBlond }); S.get('Doc').combat = false;
  ['Hollins', 'Pike'].forEach((n, i) => mk(n, i ? 'thompson' : 'garand', { skinI: i + 2 }));
}
function windowEnemy(win, weapon = 'kar98', o = {}) {
  const inward = win.nrm.clone().negate();
  const peek = win.pos.clone().addScaledVector(inward, 0.55), hide = win.pos.clone().addScaledVector(inward, 1.8);
  const fy = win.sill - (win.floor === 0 ? 1.0 : 0.95);
  peek.y = fy; hide.y = fy;
  return S.enemy({ pos: peek, fixedY: fy, weapon, behavior: 'hold', spots: [{ peek, hide, crouchHide: false }], yaw: yawTo(win.nrm.x, win.nrm.z), noCollide: true, ...o });
}
function pickWins(b, side, floors) { return b.windows.filter(w => w.side === side && floors.includes(w.floor)); }

const TOWN_ENV = {
  sunDir: [0.55, 0.42, -0.3], sunColor: 0xf4e2c4, sunI: 2.2, hemiSky: 0xb4bcc4, hemiGround: 0x6a6252, hemiI: 0.7,
  fog: 0xb8bcbc, fogDensity: 0.0046, groundColor: 0x6a665c,
  sky: { top: 0x74879a, horizon: 0xd2d5d4, cloud: 0xe4e2dc, cloudDark: 0x7c8088, cover: 0.72, sunI: 0.8 },
  grade: { exposure: 1.02, sat: 0.8, contrast: 1.08, tint: [1.02, 1.0, 0.96], vig: 0.5, grain: 0.05 },
  dustTint: [0.6, 0.57, 0.5], smokeTint: [0.5, 0.49, 0.47],
};
MISSIONS.push({
  id: 'town', chapter: 'Chapter One', title: 'Sainte-Colombe', date: 'June 14, 1944', place: 'Sainte-Colombe-sur-Aure, Normandy', seed: 91,
  card: { kicker: 'Chapter One · The Western Front', title: 'Sainte-Colombe', lines: ['Wednesday, June 14, 1944', 'Sainte-Colombe-sur-Aure, Normandy', 'Objective: the crossroads, the town hall, and a boy named Luc'] },
  ambience: 'town',
  env: TOWN_ENV,
  menuEnv: { ...TOWN_ENV, sunDir: [0.7, 0.12, -0.5], sunColor: 0xffa060, sunI: 1.8, hemiSky: 0x8a8490, hemiGround: 0x3a3430, hemiI: 0.5, fog: 0x8c7a70, fogDensity: 0.0085, sky: { top: 0x39465e, horizon: 0xc88a62, cloud: 0xd89c78, cloudDark: 0x4a4654, cover: 0.7, sunI: 1.2, sunColor: 0xffa060 }, grade: { exposure: 1.0, sat: 0.75, contrast: 1.1, tint: [1.06, 0.98, 0.9], vig: 0.62, grain: 0.05 } },
  spawn: { pos: [0.5, 0, 62], yaw: 0.02 },
  loadout: { weapons: [{ id: 'garand', res: 72 }, { id: 'thompson', res: 120 }], medkits: 2, nades: 3 },
  build(menu) { buildTownLevel(menu); if (!menu) townSquad(); },
  menuDress() { },
  onReady(stage) { S.squad('Pfc. Russo', 'Russo', 65); TOWN.tank = null; },
  stages: [
    { // advance up the street
      async run(S) {
        S.place({ Mahoney: [-3, 0, 60, 0], Russo: [3, 0, 58, 0], Dupree: [-5.5, 0, 56, 0], Doc: [2, 0, 64, 0], Hollins: [5, 0, 63, 0], Pike: [-2, 0, 66, 0] });
        Music.play('tension');
        await S.wait(1.2);
        await S.say('Mahoney', 'This is it. Sainte-Colombe. Crossroads is past the square, town hall on the north side — the pink one.', 4.4);
        await S.say('Dupree', 'Marguerite said they keep the prisoners in the mairie cellar. Luc’s in there.', 3.6);
        await S.say('Russo', 'Place looks like it got hit by every bomber in England.', 3);
        await S.say('Mahoney', 'It did. Watch the windows. Every one of ’em.', 3);
        S.obj('Advance', V3(0, 2, -21), 'Advance');
        S.goals({ Mahoney: [-5, 0, 44], Russo: [6.5, 0, 40], Dupree: [-5.5, 0, 30], Hollins: [5, 0, 31], Pike: [-6, 0, 50] }, true, true);
        await S.until(() => Player.pos.z < 49);
        Music.play('combat');
        const foes = [
          ...pickWins(TOWN.W2, 'e', [1, 2]).slice(0, 2).map(w => windowEnemy(w)),
          ...pickWins(TOWN.E1, 'w', [1]).slice(0, 2).map(w => windowEnemy(w)),
          ...pickWins(TOWN.E2, 'w', [1, 2]).slice(1, 3).map(w => windowEnemy(w)),
          ...pickWins(TOWN.W4, 'e', [1, 2]).slice(0, 2).map(w => windowEnemy(w)),
          S.enemy({ pos: [-4.8, 0, 0.2], weapon: 'kar98', behavior: 'hold', spots: [{ peek: V3(-4.8, 0, 0.2), crouchHide: true }], yaw: Math.PI }),
          S.enemy({ pos: [5.2, 0, 13.6], weapon: 'mp40', behavior: 'hold', spots: [{ peek: V3(5.2, 0, 13.6), crouchHide: true }], yaw: Math.PI }),
          S.enemy({ pos: [-3.5, 0, -22], weapon: 'kar98', behavior: 'hold', spots: [{ peek: V3(-3.5, 0, -22.2), crouchHide: true }], yaw: Math.PI }),
          S.enemy({ pos: [4, 0, -22.6], weapon: 'mp40', behavior: 'hold', spots: [{ peek: V3(4, 0, -22.6), crouchHide: true }], yaw: Math.PI }),
          S.enemy({ pos: [0, 0, -30], weapon: 'mp40', behavior: 'rush', yaw: Math.PI }),
        ];
        foes.forEach(f => f.alert());
        await S.say('Mahoney', 'Windows! Both sides! Take cover!', 2.2);
        let step = 0;
        await S.until(() => {
          const z = Player.pos.z, n = S.alive(foes);
          HUD.setObjective(`Advance (${n} enemies in the street)`);
          if (step === 0 && z < 32) { step = 1; S.goals({ Mahoney: [-5.5, 0, 22], Russo: [6, 0, 18], Dupree: [-5, 0, 6], Hollins: [5, 0, 10], Pike: [-6, 0, 30] }, true, true); }
          if (step === 1 && z < 10) { step = 2; S.goals({ Mahoney: [-5, 0, -2], Russo: [5.5, 0, -4], Dupree: [-6, 0, -14], Hollins: [6, 0, -16], Pike: [-5, 0, 8] }, true, true); }
          return n === 0 && z < 0;
        });
        await S.say('Dupree', 'Street’s clear!', 1.8);
      }
    },
    { // sniper
      cp: { pos: [2, 0, -2], yaw: 0 },
      async run(S) {
        S.place({ Mahoney: [-5, 0, -2], Russo: [5.5, 0, -4], Dupree: [-6, 0, -14], Hollins: [6, 0, -16], Pike: [-5, 0, 8], Doc: [-4, 0, 4] });
        S.goals({ Pike: [-3, 0, -19], Hollins: [2, 0, -19] }, true, false);
        const bel = TOWN.churchBel;
        const sn = S.enemy({ pos: [36, 0, -29.5], fixedY: bel, weapon: 'sniper', behavior: 'sniper', alert: true, spots: [{ peek: V3(33.3, bel, -29.6), hide: V3(35.8, bel, -30.8) }], yaw: Math.PI * 0.6, noCollide: true, throws: false });
        await S.wait(1.5);
        SFX.shot('kar98', V3(36, bel, -30)); await S.wait(0.15); Actors.byName('Pike').die(V3(36, bel, -30));
        await S.say('Russo', 'PIKE! Sniper!', 1.8);
        await S.say('Mahoney', 'Church tower! Everybody down! Kessler — you’ve got the best eyes. Put him down!', 3.6);
        SQUAD.concat(['Hollins']).forEach(n => { const a = S.get(n); if (a && a.alive) { a.coverCrouch = true; a.goal = null; } });
        S.obj('Kill the sniper in the church tower', () => V3(36, bel + 1.6, -30), 'Sniper');
        S.hint('Watch for the glint. Aim down your sights and wait for him to show himself.', 6);
        await S.until(() => !sn.alive);
        await S.say('Mahoney', 'Got him! Nice shooting, Kessler.', 2.4);
        await S.wait(1);
      }
    },
    { // the Panzer
      cp: { pos: [2, 0, -14], yaw: 0 },
      async run(S) {
        S.place({ Mahoney: [-5, 0, -16], Russo: [5.5, 0, -17], Dupree: [-6, 0, -12], Hollins: [6, 0, -12], Doc: [-4, 0, -6] });
        const P = new Tank({ kind: 'panzer', pos: V3(-110, 0, -46), yaw: -Math.PI / 2, path: [V3(-60, 0, -46), V3(-26, 0, -46.5)], speed: 3.2, firstShot: 9, reload: 7.5 });
        TOWN.tank = P;
        const escort = [
          S.enemy({ pos: [-116, 0, -44], weapon: 'kar98', behavior: 'advance', alert: true, path: [V3(-44, 0, -42), V3(-32, 0, -38)], yaw: -Math.PI / 2 }),
          S.enemy({ pos: [-118, 0, -48], weapon: 'mp40', behavior: 'advance', alert: true, path: [V3(-44, 0, -50), V3(-30, 0, -53)], yaw: -Math.PI / 2 }),
          S.enemy({ pos: [-122, 0, -45], weapon: 'kar98', behavior: 'advance', alert: true, path: [V3(-36, 0, -44), V3(-22, 0, -40)], yaw: -Math.PI / 2 }),
          S.enemy({ pos: [-38, 0, -56], weapon: 'kar98', behavior: 'hold', alert: true, spots: [{ peek: V3(-34, 0, -56), crouchHide: false }], yaw: -Math.PI / 2 }),
        ];
        await S.wait(1);
        await S.say('Dupree', 'Listen… you hear that?', 2);
        await S.until(() => P.pos.x > -60);
        await S.say('Russo', 'TANK! Panzer, coming out of the west street!', 2.4);
        await S.say('Mahoney', 'Doc — the satchel! Kessler, we can’t touch it from the front. Cut through the alley on the left and get behind it!', 4.6);
        HUD.notify('Satchel charge');
        S.obj('Flank the tank through the west alley', V3(-20, 1.5, 2.5), 'Alley', 'Through the ruined house, up the back lane');
        let planted = false, destroyed = false;
        const rear = () => P.pos.clone().add(V3(-Math.sin(P.yaw + Math.PI) * 3.3, 1.2, -Math.cos(P.yaw + Math.PI) * 3.3));
        const it = S.interact({ pos: rear, text: 'plant the satchel charge on the engine deck', hold: 1.4, r: 2.8, cone: 0 });
        it.done.then(() => planted = true);
        let stage = 0;
        await S.until(() => {
          if (stage === 0 && Player.pos.x < -18) { stage = 1; S.obj('Move up the back lane', V3(-24.5, 1.5, -36), 'Back lane'); }
          if (stage === 1 && Player.pos.z < -30) { stage = 2; S.obj('Plant the satchel charge on the Panzer', rear, 'Panzer'); }
          return planted || !P.alive;
        });
        if (P.alive) {
          const sat = new THREE.Mesh(boxG(0.35, 0.25, 0.25), MAT.webbing); sat.position.copy(rear()).add(V3(0, 0.6, 0)); R.scene.add(sat);
          S.sayQ('Kessler', 'Charge set!', 1.4);
          const t0 = Story.gameTime;
          await S.until(() => { const l = 6 - (Story.gameTime - t0); HUD.counter(l.toFixed(1), 'Get clear'); return l <= 0; });
          HUD.counter(null); R.scene.remove(sat); P.destroy();
        }
        escort.forEach(e => e.alert());
        await S.say('Mahoney', 'Scratch one Panzer! Hell of a job, Kessler!', 2.8);
        S.obj('Clear the square', null);
        await S.until(() => { const n = S.alive(escort); HUD.setObjective(`Clear the square (${n} left)`); return n === 0; });
      }
    },
    { // hold the square
      cp: { pos: [0, 0, -42], yaw: 0 },
      restore() {
        const P = new Tank({ kind: 'panzer', pos: V3(-26, 0, -46.5), yaw: -Math.PI / 2, active: false }); P.destroy(); P.engine && P.engine.stop();
      },
      async run(S) {
        S.place({ Mahoney: [-3, 0, -52.5], Russo: [4, 0, -52], Dupree: [-6, 0, -44], Hollins: [6.5, 0, -45], Doc: [0, 0, -44] });
        ['Mahoney', 'Russo', 'Dupree', 'Hollins'].forEach(n => { const a = S.get(n); if (a && a.alive) { a.goal = null; a.coverCrouch = true; } });
        const ammo = S.interact({ pos: TOWN.ammoPos, text: 'Take ammunition', r: 2.4, repeat: true, onUse: () => { Player.weapons.forEach(w => w.res = WDEF[w.id].maxRes); Player.nades = Math.max(Player.nades, 3); Player.updateHud(); HUD.notify('Ammunition'); } });
        await S.say('Mahoney', 'They’ll want this square back. Everybody on the fountain! Hold until armor gets here.', 4);
        await S.say('Dupree', 'Radio says Shermans are ten minutes out.', 2.6);
        await S.say('Russo', 'Army ten minutes or real ten minutes?', 2.4);
        S.obj('Hold the square until the armor arrives', null, null, 'Ammunition at the fountain');
        const foes = [];
        const routes = [
          { s: [22, -135], p: [V3(22, 0, -96), V3(18, 0, -80), V3(12, 0, -66)] },
          { s: [-112, -46], p: [V3(-50, 0, -46), V3(-30, 0, -44), V3(-18, 0, -52)] },
          { s: [18, -128], p: [V3(24, 0, -92), V3(26, 0, -74), V3(22, 0, -62)] },
          { s: [-110, -50], p: [V3(-46, 0, -50), V3(-26, 0, -58), V3(-14, 0, -66)] },
        ];
        let spawnT = 0, ri = 0;
        const mwins = pickWins(TOWN.mairie, 's', [1, 2]);
        let wi = 0;
        const spawn = () => {
          if (S.alive(foes) > 9) return;
          if (Math.random() < 0.3 && wi < 6) { foes.push(windowEnemy(mwins[(wi * 3) % mwins.length], 'kar98', { alert: true })); wi++; return; }
          const r = routes[ri++ % routes.length], w = pick(['kar98', 'kar98', 'mp40']);
          foes.push(S.enemy({ pos: [r.s[0] + rand(-3, 3), 0, r.s[1] + rand(-3, 3)], weapon: w, behavior: w === 'mp40' && Math.random() < 0.4 ? 'rush' : 'advance', alert: true, path: r.p.map(q => q.clone().add(V3(rand(-2, 2), 0, rand(-2, 2)))), yaw: 0 }));
        };
        for (let i = 0; i < 4; i++) spawn();
        let mgDone = false;
        let said100 = false, said45 = false;
        await S.timer(150, 'Armor arrives in', (left, dt) => {
          spawnT -= dt;
          if (spawnT <= 0) { spawnT = left > 60 ? 5.5 : 4; spawn(); }
          if (!mgDone && left < 90) { mgDone = true; foes.push(windowEnemy(mwins[Math.floor(mwins.length / 2)], 'mg42', { behavior: 'hold', alert: true })); S.sayQ('Dupree', 'MG in the town hall! Second floor, center window!'); }
          if (!said100 && left < 100) { said100 = true; S.sayQ('Mahoney', 'Keep your heads down! Watch the flanks!'); }
          if (!said45 && left < 45) { said45 = true; S.sayQ('Russo', 'Where the hell is that armor?!'); }
        });
        ammo.remove();
        TOWN.foes = foes;
      }
    },
    { // the Sherman
      async run(S) {
        const sh = new Tank({ kind: 'sherman', pos: V3(0, 0, 80), yaw: 0, path: [V3(-1.5, 0, 30), V3(-2, 0, -2), V3(-2, 0, -18), V3(0, 0, -34)], speed: 4.5, hostile: false, firstShot: 3, reload: 3.5, target: () => { const f = (TOWN.foes || []).find(e => e.alive); return f ? f.pos : null; } });
        await S.say('Tankman', 'Somebody order a Sherman?', 2.4);
        await S.say('Russo', 'ARMY TEN MINUTES! God bless you, you beautiful tin can!', 3);
        Story.onEnemyShot = null;
        const foes = TOWN.foes || [];
        const t0 = Story.gameTime;
        await S.until(() => {
          // the tank's HE hits clear out the square
          if (Story.gameTime - t0 > 12) foes.forEach(e => { if (e.alive && Math.random() < 0.01) e.die(sh.pos); });
          HUD.setObjective(`Clear the square with the Sherman (${S.alive(foes)} left)`);
          return S.alive(foes) === 0;
        });
        sh.target = V3(0, 3, -90);
        Music.play('victory');
        await S.say('Mahoney', 'Cease fire! Cease fire! The square is ours!', 2.8);
        await S.say('Mahoney', 'Dupree, Kessler — the town hall. Find that boy.', 3);
        S.obj('Search the town hall', V3(0, 1.6, -81), 'Mairie');
        await S.reach(V3(0, 0, -80), 4);
        const luc = S.npc({ name: 'Luc', pos: [-1.2, 0, -83.5], yaw: 0, model: { side: 'civ', jacket: MAT.civShirt, pants: MAT.civSuit, hair: MAT.hairDark, hat: 'none', skinI: 2 } });
        luc.goal = V3(-0.5, 0, -79); S.goals({ Dupree: [1.5, 0, -79.5] }, false, false);
        await S.wait(1.5);
        await S.say('Dupree', 'Luc? Luc Aubert? Ta sœur Marguerite nous envoie.', 3.4);
        await S.say('Luc', 'Marguerite… elle est vivante ? Elle est vivante…', 3.2);
        await S.say('Dupree', 'She’s alive, kid. Oui. Elle t’attend.', 2.8);
        await S.say('Luc', 'Merci. Merci, messieurs… merci.', 2.8);
        S.clearObj();
        await S.wait(1);
      }
    },
    { // evening in the square
      async run(S) {
        Player.control = false; Music.play('sorrow');
        S.cinema(true); HUD.weaponsVisible(false); VM.visible = false;
        const blend = S.blendEnv({ sunColor: 0xff8a48, sunI: 1.5, hemiSky: 0x7a7488, hemiGround: 0x3a3430, hemiI: 0.45, fog: 0x8a7468, fogDensity: 0.008, top: 0x323e58, horizon: 0xc2825a, cloud: 0xd89470, cloudDark: 0x483e4c, tint: [1.08, 0.97, 0.88], exposure: 0.98, sunDir: [0.7, 0.1, -0.5] }, 10);
        S.place({ Russo: [1.8, 0.7, -45.2, Math.PI * 0.9], Mahoney: [-2.2, 0.7, -45.6, -Math.PI * 0.85], Dupree: [3.2, 0, -51.8, 0.4], Doc: [-3.4, 0, -50.8, -0.5] });
        ['Russo', 'Mahoney'].forEach(n => { const a = S.get(n); a.goal = null; a.combat = false; a.coverCrouch = true; a.aimW = 0; });
        S.camPath({ from: [6, 2.4, -38], to: [2.6, 1.9, -41.5], lookFrom: [0, 1.2, -48], lookTo: [0, 1.2, -47], dur: 30, hold: true });
        await S.wait(2);
        await S.say('Russo', 'Hey, Danny. What time you got?', 2.6);
        await S.say('Kessler', '…', 1.2);
        await S.say('Kessler', 'Six thirty-one.', 2);
        await S.say('Russo', 'Six thirty-one? Sun’s going down, genius.', 2.6);
        await S.say('Kessler', 'It stopped. On the beach. Must’ve been the water. I didn’t notice till the farmhouse.', 4.4);
        await S.say('Russo', 'Six thirty-one. Guess part of us is still standing in that boat, huh?', 3.8);
        await S.say('Mahoney', 'Wind it anyway, Kessler. Your old man will want it ticking when you hand it back.', 4.2);
        await S.say('Mahoney', 'Get some sleep. Tomorrow we keep walking. Germany’s a long way off.', 3.8);
        await blend;
        await S.fade(1, 3);
        S.endCam(); S.cinema(false);
      }
    },
  ],
  outro: {
    letter: true, kicker: 'Sainte-Colombe, France — June 15, 1944',
    lines: [
      'Dear Pop,',
      'I can’t tell you where I am, only that it is France, and that the people here cry when they see us. An old woman gave Frankie a bottle of cider and kissed him on both cheeks. He hasn’t stopped talking about it.',
      'We lost Eli Weiss in the hedgerows. You would have liked him. I wrote to his mother.',
      'Your watch stopped on the beach. Six thirty-one. I wound it tonight and it runs again. I think it just needed somebody to keep going.',
      'I’m coming home, Pop. Just not yet.',
      'Danny',
    ], hold: 4,
  },
});
// SQUAD list may be declared in beach.js; make sure it exists
if (typeof SQUAD === 'undefined') window.SQUAD = ['Mahoney', 'Russo', 'Dupree', 'Doc'];
