'use strict';
/* =====================================================================
   CHAPTER ONE · II — THE HEDGEROWS (near Saint-Aubin-des-Haies,
   June 12, 1944). Player advances north (-Z) through bocage fields.
   ===================================================================== */
const HEDGE = {};
// hedgerows: axis-aligned lines with gaps
const HEDGES = [
  { axis: 'x', c: 60, a: -140, b: 91, gaps: [[-44, -38], [27, 33]] },
  { axis: 'x', c: 0, a: -100, b: 91, gaps: [[-13, -7]] },
  { axis: 'x', c: -60, a: -100, b: 91, gaps: [[-63, -57], [-13, -7]] },
  { axis: 'x', c: -118, a: -140, b: 140, gaps: [] },
  { axis: 'x', c: 128, a: -140, b: 140, gaps: [] },
  { axis: 'z', c: -100, a: -140, b: 140, gaps: [] },
  { axis: 'z', c: 91, a: -120, b: 128, gaps: [[33, 40], [-21, -14]] },
  { axis: 'z', c: 99, a: -120, b: 128, gaps: [] },
];
function hedgeBase(x, z) { return (fbm(x * 0.012 + 3, z * 0.012, 3) - 0.5) * 5; }
let FARM_H = null, BARN_H = null;
function hedgeH(x, z) {
  if (FARM_H == null) { FARM_H = hedgeBase(-40, -32); BARN_H = hedgeBase(-70, -20); }
  let h = hedgeBase(x, z);
  const fm = 1 - smoothstep(0, 7, Math.max(Math.abs(x + 40) - 8, Math.abs(z + 32) - 6.5, 0)); h = lerp(h, FARM_H, fm);
  const bm = 1 - smoothstep(0, 6, Math.max(Math.abs(x + 70) - 8, Math.abs(z + 20) - 6, 0)); h = lerp(h, BARN_H, bm);
  let mound = 0;
  for (const H of HEDGES) {
    const along = H.axis === 'x' ? x : z, across = H.axis === 'x' ? z : x;
    if (along < H.a - 3 || along > H.b + 3) continue;
    const d = Math.abs(across - H.c); if (d > 3) continue;
    let gapK = 1;
    for (const g of H.gaps) { const o = Math.max(g[0] - along, along - g[1], 0); gapK = Math.min(gapK, smoothstep(0, 1.6, o)); }
    const endK = smoothstep(H.a - 2, H.a + 1, along) * (1 - smoothstep(H.b - 1, H.b + 2, along));
    mound = Math.max(mound, 2.3 * (1 - smoothstep(0.9, 2.7, d)) * gapK * endK);
  }
  h += mound;
  const lane = Math.abs(x - 95); if (lane < 3.6) h -= 1.3 * (1 - smoothstep(2.3, 3.6, lane));
  const tk = Math.abs(z + 26 + Math.sin(x * 0.05) * 3); if (x < -20 && x > -95 && tk < 2.2) h -= 0.15 * (1 - tk / 2.2);
  return h;
}
function inGap(H, along) { return H.gaps.some(g => along > g[0] - 0.5 && along < g[1] + 0.5); }
function buildHedgeLevel(menu) {
  reseed(77); World.water = null;
  World.terrain = new Terrain({
    x0: -145, z0: -145, w: 290, d: 290, res: 1.5, h: hedgeH, cast: true,
    color: (x, z, h, n) => {
      const g = fbm(x * 0.03, z * 0.03, 4), v = 0.9 + fbm(x * 0.4, z * 0.4, 2) * 0.2;
      let c = g > 0.55 ? [0.47, 0.53, 0.27] : g > 0.4 ? [0.42, 0.5, 0.25] : [0.52, 0.52, 0.3];
      if (n.y < 0.8) c = [0.4, 0.35, 0.25];
      const tk = Math.abs(z + 26 + Math.sin(x * 0.05) * 3); if (x < -20 && x > -95 && tk < 2.2) c = [0.45, 0.4, 0.3];
      if (Math.abs(x - 95) < 2.6) c = [0.38, 0.33, 0.24];
      return [c[0] * v, c[1] * v, c[2] * v];
    }
  });
  World.surfaceAt = (x, z) => Math.abs(x - 95) < 2.6 ? 'dirt' : 'grass';
  World.bounds = [-98, -116, 126, 126];
  const K = KIT;
  // hedge foliage + blocking colliders (bullets pass through leaves)
  for (const H of HEDGES) {
    const len = H.b - H.a;
    for (let s = H.a; s < H.b; s += 1.6) {
      if (inGap(H, s)) continue;
      const x = H.axis === 'x' ? s + sr(-0.5, 0.5) : H.c + sr(-0.8, 0.8), z = H.axis === 'x' ? H.c + sr(-0.8, 0.8) : s + sr(-0.5, 0.5);
      const b = terrainH(x, z);
      K.foliage(x, b + sr(0.5, 1.2), z, sr(2.0, 2.8), sr() < 0.5 ? MAT.leaves : MAT.leavesDark, 3);
      if (sr() < 0.55) K.foliage(x, b + sr(1.7, 2.6), z, sr(1.7, 2.4), sr() < 0.3 ? MAT.leavesAutumn : MAT.leaves, 2);
      if (sr() < 0.07) K.tree(x, z, { h: sr(9, 14), y: b - 0.5, col: false });
    }
    // colliders in 8m chunks skipping gaps
    for (let s = H.a; s < H.b; s += 8) {
      let s0 = s, s1 = Math.min(H.b, s + 8);
      for (const g of H.gaps) { if (s1 > g[0] && s0 < g[1]) { if (s0 < g[0]) { const [x0, x1, z0, z1] = H.axis === 'x' ? [s0, g[0] - 0.3, H.c - 0.7, H.c + 0.7] : [H.c - 0.7, H.c + 0.7, s0, g[0] - 0.3]; addCol(x0, -10, z0, x1, terrainH((x0 + x1) / 2, (z0 + z1) / 2) + 4, z1, { noBullet: true, surf: 'wood' }); } s0 = g[1] + 0.3; } }
      if (s1 - s0 < 0.2) continue;
      const [x0, x1, z0, z1] = H.axis === 'x' ? [s0, s1, H.c - 0.7, H.c + 0.7] : [H.c - 0.7, H.c + 0.7, s0, s1];
      addCol(x0, -10, z0, x1, terrainH((x0 + x1) / 2, (z0 + z1) / 2) + 4, z1, { noBullet: true, surf: 'wood' });
    }
  }
  // gate posts in gaps
  for (const H of HEDGES) for (const g of H.gaps) for (const e of g) { const x = H.axis === 'x' ? e : H.c, z = H.axis === 'x' ? H.c : e; K.box(0.25, 1.6, 0.25, x, terrainH(x, z) - 0.2, z, MAT.woodDark, { surf: 'wood' }); }
  // a broken gate in the main gap
  K.visBox(4, 0.12, 0.08, -10, terrainH(-10, 1.5) + 0.5, 1.5, MAT.woodDark, { ry: 0.7, rz: 0.2 }); K.visBox(4, 0.12, 0.08, -10, terrainH(-10, 1.5) + 0.9, 1.5, MAT.woodDark, { ry: 0.7, rz: 0.2 });
  // orchard (NE of field C)
  HEDGE.orchard = [];
  for (let x = 32; x < 86; x += 8) for (let z = -54; z < -8; z += 8) { const px = x + sr(-1.5, 1.5), pz = z + sr(-1.5, 1.5); K.tree(px, pz, { type: 'apple', h: sr(5, 6.5), crown: sr(2.2, 2.8), trunk: 0.2, mat: sr() < 0.3 ? MAT.leavesAutumn : MAT.leaves }); }
  // MG position on H2 with sandbags
  HEDGE.mg = V3(50, 0, -1.0); HEDGE.mg.y = terrainH(50, -1.0);
  K.sandbags(50, 0.2, 3, 2, 0, { y: terrainH(50, 0.2) - 0.1 });
  // farmhouse, barn, walls
  HEDGE.farm = K.building({ x: -40, z: -32, w: 12, d: 9, floors: 2, fh: 3.2, mat: MAT.stone, trim: MAT.stoneDark, roofMat: MAT.roofSlate, door: 's', enter: true, shutterMat: MAT.woodPaint, spacing: 3, winW: 1.2, y: terrainH(-40, -32) - 0.1, ridgeX: true });
  K.building({ x: -70, z: -20, w: 14, d: 10, floors: 1, fh: 5, mat: MAT.woodDark, trim: MAT.woodDark, roofMat: MAT.roofSlate, y: terrainH(-70, -20) - 0.1, shutters: false, winW: 2, spacing: 4.5, winH: 2.4 });
  for (const [x0, z0, x1, z1] of [[-54, -44, -54, -18], [-54, -44, -30, -44], [-22, -44, -22, -36]]) K.wall(x0, z0, x1, z1, terrainH((x0 + x1) / 2, (z0 + z1) / 2) - 0.3, 1.5, 0.5, MAT.stoneDark);
  K.box(2, 1, 1.4, -44, terrainH(-44, -22), -22, MAT.wood, { surf: 'wood' }); // cart
  for (const [x, z] of [[-30, -24], [-33, -20], [-56, -8]]) K.cylinder(0.7, 1.2, x, terrainH(x, z), z, std({ map: TEX.burlap, color: col(0xc8a860) }), { col: true, rz: Math.PI / 2, seg: 12 });
  K.cylinder(0.9, 1, -50, terrainH(-50, -12), -12, MAT.stone, { col: true, seg: 14 }); // well
  // interior dressing: table, crates, ammo crate
  const fy = terrainH(-40, -32) - 0.1 + 0.08;
  K.box(2, 0.08, 1, -41, fy + 0.75, -31, MAT.woodDark, { surf: 'wood' }); K.box(0.1, 0.75, 0.1, -41.9, fy, -31.4, MAT.woodDark); K.box(0.1, 0.75, 0.1, -40.1, fy, -30.6, MAT.woodDark);
  HEDGE.ammoPos = V3(-36, fy + 0.3, -34.5); K.crate(-36, -34.5, 0.2, 1, { y: fy }); K.plane(makeLabelTex('.30 CAL', '#e8e0c0', '#2d3422', 128, 48), 0.5, 0.18, -36, fy + 0.35, -34.19, 0);
  K.visBox(1.6, 0.5, 0.7, -44.5, fy, -35.5, MAT.woodDark);
  // fields dressing: a dead cow or two, wrecked Kübelwagen-like hulk, stumps
  for (const [x, z] of [[-60, 90], [50, 30], [-70, 22]]) { K.rock(x, terrainH(x, z) + 0.5, z, 0.9, std({ color: col(0x5a4a3a), roughness: 0.9 }), { sx: 1.8, sy: 0.9, sz: 0.9 }); }
  for (let i = 0; i < 25; i++) { const x = sr(-95, 88), z = sr(-110, 120); K.rock(x, terrainH(x, z), z, sr(0.3, 0.7), MAT.stoneDark); }
  // trees outside the play space
  for (let i = 0; i < 50; i++) { const a = sr(0, TAU), r = sr(150, 200); K.tree(Math.cos(a) * r, Math.sin(a) * r, { h: sr(12, 18), col: false }); }
  // smoke on the horizon
  FX.smokeColumn(V3(140, 2, -160), { size: 1.6, rate: 4, dark: 0.22, wind: 1.5 });
  FX.smokeColumn(V3(-120, 2, -180), { size: 1.2, rate: 3, dark: 0.3, wind: 1.5 });
  KIT.grass({ x0: -98, x1: 126, z0: -116, z1: 126, count: 42000, color: 0xc6ccaa, scale: 1.05, mask: (x, z) => !(Math.abs(x + 40) < 7 && Math.abs(z + 32) < 5.5) && Math.abs(x - 95) > 2.4 });
}
function hedgeSquad() {
  const mk = (name, weapon, model) => S.ally({ name, pos: [0, 0, 110], weapon, model: { net: true, ...model } });
  mk('Mahoney', 'thompson', { skinI: 0, hair: MAT.hairGrey, mustache: true });
  mk('Russo', 'garand', { skinI: 4, hair: MAT.hairDark });
  mk('Dupree', 'garand', { skinI: 5, hair: MAT.hairDark });
  mk('Weiss', 'garand', { skinI: 2, hair: MAT.hairBrown });
  mk('Doc', null, { skinI: 1, hair: MAT.hairBlond }); S.get('Doc').combat = false;
}
MISSIONS.push({
  id: 'hedgerows', chapter: 'Chapter One', title: 'The Hedgerows', date: 'June 12, 1944', place: 'Near Saint-Aubin-des-Haies, Normandy', seed: 77,
  card: { kicker: 'Chapter One · The Western Front', title: 'The Hedgerows', lines: ['Monday, June 12, 1944', 'Near Saint-Aubin-des-Haies, Normandy', 'Six days since the landing. Six miles inland.'] },
  ambience: 'field',
  env: {
    sunDir: [-0.45, 0.62, 0.55], sunColor: 0xffe6c4, sunI: 2.5, hemiSky: 0xb6c4cf, hemiGround: 0x5d5a3c, hemiI: 0.62,
    fog: 0xb4bcb8, fogDensity: 0.0062, groundColor: 0x5a6038,
    sky: { top: 0x5b7ea0, horizon: 0xc2c9c4, cloud: 0xf0eee6, cloudDark: 0x8e949a, cover: 0.55, sunI: 0.9 },
    grade: { exposure: 1.0, sat: 0.78, contrast: 1.08, tint: [1.03, 1.0, 0.93], vig: 0.5, grain: 0.05 },
    dustTint: [0.46, 0.42, 0.32],
  },
  spawn: { pos: [-16, 0, 116], yaw: 0.35 },
  loadout: { weapons: [{ id: 'garand', res: 72 }, { id: 'colt', res: 28 }], medkits: 2, nades: 3 },
  build() { buildHedgeLevel(); hedgeSquad(); },
  onReady(stage) { S.squad('Pfc. Russo', 'Russo', 70); if (stage >= 3) { const w = S.get('Weiss'); if (w) { R.scene.remove(w.h.root); Actors.list.splice(Actors.list.indexOf(w), 1); } } },
  stages: [
    { // walk up
      async run(S) {
        S.place({ Mahoney: [-12, 0, 112], Russo: [-19, 0, 113], Dupree: [-9, 0, 115], Weiss: [-21, 0, 118], Doc: [-14, 0, 120] });
        S.goals({ Mahoney: [26, 0, 65], Russo: [31, 0, 66], Dupree: [34, 0, 67], Weiss: [23, 0, 68], Doc: [29, 0, 70] }, false, true);
        Music.play('home');
        S.obj('Advance to the next hedgerow', V3(30, 2, 61), 'Gap');
        await S.wait(1.5);
        await S.say('Mahoney', 'Six days. Six miles. At this rate I’ll be collecting my pension in Paris.');
        await S.say('Dupree', 'The farmers call it the bocage. Every field’s a little fort. Boche love it.', 3.8);
        await S.say('Weiss', 'My old man had a rug store on Pitkin Avenue. Smaller than this field. He’d still say it was too big.', 4.6);
        await S.say('Russo', 'Weiss, nobody asked about your old man’s rugs.', 2.8);
        await S.say('Weiss', 'You asked yesterday, Frankie.', 2.4);
        await S.reach(V3(30, 0, 62), 5);
      }
    },
    { // ambush at H2
      cp: { pos: [30, 0, 64], yaw: 0.2 },
      async run(S) {
        S.place({ Mahoney: [26, 0, 63], Russo: [32, 0, 64], Dupree: [35, 0, 65], Weiss: [23, 0, 64], Doc: [29, 0, 67] });
        S.obj('Cross the field', V3(-10, 2, 2), 'Hedgerow');
        await S.until(() => Player.pos.z < 55);
        const pos = [[-38, 0, 'kar98'], [-27, 0, 'mp40'], [-18, 0, 'kar98'], [-3, 0, 'kar98'], [8, 0, 'kar98'], [19, 0, 'mp40'], [31, 0, 'kar98']];
        const foes = pos.map(([x, z, w]) => S.enemy({ pos: [x, 0, -1.25], weapon: w, behavior: 'hold', alert: true, spots: [{ peek: V3(x, 0, -1.25), hide: V3(x, 0, -3.8), crouchHide: true }], yaw: Math.PI }));
        Music.play('combat');
        foes.forEach(f => SFX.shot('kar98', f.pos));
        await S.say('Mahoney', 'AMBUSH! Hedgerow, twelve o’clock! Get down!', 2.4);
        S.goals({ Mahoney: [20, 0, 56.5], Russo: [26, 0, 56.8], Dupree: [36, 0, 56.4], Weiss: [14, 0, 57], Doc: [30, 0, 57.5] }, true, true);
        S.hint('Get behind cover, pick your shots when they pop up.', 5);
        await S.until(() => { HUD.setObjective(`Clear the far hedgerow (${S.alive(foes)} left)`); return S.alive(foes) === 0; });
        Music.play('tension');
        await S.say('Dupree', 'Clear! Hedgerow’s clear!', 2);
      }
    },
    { // Weiss, the MG, and the sunken lane
      cp: { pos: [16, 0, 55], yaw: 0 },
      async run(S) {
        S.place({ Mahoney: [20, 0, 56.5], Russo: [26, 0, 56.8], Dupree: [36, 0, 56.4], Weiss: [14, 0, 57], Doc: [30, 0, 57.5] });
        await S.say('Mahoney', 'Weiss, get up to that gap and see if the next field’s clear. Dupree, cover him.', 3.6);
        const W = S.get('Weiss'); W.setGoal(V3(-8, 0, 6), true, false);
        await S.until(() => W.pos.z < 24 || W.stuck > 4);
        const mg = S.enemy({ pos: [HEDGE.mg.x, HEDGE.mg.y, HEDGE.mg.z], fixedY: HEDGE.mg.y, weapon: 'mg42', behavior: 'mg', alert: true, yaw: Math.PI, arc: { yaw: Math.PI - 0.45, half: 1.05 }, throws: false });
        const loader = S.enemy({ pos: [52.2, 0, -2.6], weapon: 'kar98', behavior: 'hold', alert: true, yaw: Math.PI, spots: [{ peek: V3(52.2, 0, -1.4), hide: V3(52.2, 0, -3.8), crouchHide: true }] });
        const src = mg.eye(V3());
        for (let i = 0; i < 16; i++) setTimeout(() => { const tp = W.chest(V3()).add(V3(rand(-1, 1), rand(-0.6, 0.4), rand(-1, 1))); FX.tracer(src, tp.clone().sub(src).normalize(), src.distanceTo(tp), { speed: 380, len: 6, w: 1.4 }); FX.impact(tp, V3(0, 1, 0), i % 3 ? 'grass' : 'flesh'); }, i * 55);
        SFX.mgBurst(src, 16, 18);
        await S.wait(0.5);
        W.die(src); Music.play('sorrow');
        await S.say('Russo', 'WEISS! Weiss! Eli!', 2.2);
        S.get('Doc').setGoal(W.pos.clone().add(V3(1, 0, 1)), true, false);
        await S.say('Mahoney', 'Doc, NO! Stay down! That gun’s zeroed on him!', 3);
        await S.say('Dupree', 'MG42, in the hedge on the right! By the big oak!', 2.6);
        S.get('Doc').setGoal(V3(24, 0, 57.5), true, true);
        Music.play('combat');
        await S.say('Mahoney', 'Kessler! We can’t go through that. Take the sunken lane on the right flank and hit it from behind. We’ll keep its head down.', 5);
        S.obj('Flank the MG42 through the sunken lane', V3(93, terrainH(93, 36.5) + 1.2, 36.5), 'Sunken lane');
        const laneFoes = [S.enemy({ pos: [95, 0, -2], weapon: 'kar98', behavior: 'hold', spots: [{ peek: V3(95, 0, -2), crouchHide: false }], yaw: 0 }), S.enemy({ pos: [96, 0, -12], weapon: 'mp40', behavior: 'hold', spots: [{ peek: V3(96, 0, -12), crouchHide: false }], yaw: 0 })];
        const orchard = [S.enemy({ pos: [70, 0, -16], weapon: 'kar98', behavior: 'hold', spots: [{ peek: V3(70, 0, -16), crouchHide: false }], yaw: -Math.PI / 2 }), S.enemy({ pos: [60, 0, -24], weapon: 'kar98', behavior: 'hold', spots: [{ peek: V3(60, 0, -24), crouchHide: false }], yaw: -Math.PI / 2 })];
        await S.until(() => Player.pos.x > 90 || (!mg.alive && !loader.alive));
        S.obj('Move up the sunken lane', V3(93, terrainH(93, -17.5) + 1.2, -17.5), 'Orchard');
        await S.until(() => Player.pos.z < -5 && Player.pos.x > 86 || (!mg.alive && !loader.alive));
        S.obj('Take out the MG42 crew', () => mg.alive ? mg.pos.clone().add(V3(0, 1.4, 0)) : loader.pos.clone().add(V3(0, 1.4, 0)), 'MG42');
        await S.until(() => { const n = (mg.alive ? 1 : 0) + (loader.alive ? 1 : 0); HUD.setObjective(`Take out the MG42 crew (${n} left)`); return n === 0; });
        laneFoes.concat(orchard).forEach(f => f.alert());
        await S.say('Mahoney', 'MG’s down! Kessler did it! Move up, move up!', 2.6);
        S.obj('Clear the orchard', V3(60, 2, -20), 'Orchard');
        await S.until(() => { const n = S.alive(orchard) + S.alive(laneFoes); HUD.setObjective(`Clear the orchard (${n} left)`); return n === 0; });
      }
    },
    { // farmhouse
      cp: { pos: [52, 0, -10], yaw: Math.PI / 2 },
      restore() { },
      async run(S) {
        Music.play('tension');
        S.place({ Mahoney: [44, 0, -6], Russo: [48, 0, -4], Dupree: [42, 0, -9], Doc: [46, 0, -12] });
        S.goals({ Mahoney: [-38, 0, -26], Russo: [-43, 0, -26], Dupree: [-36, 0, -25], Doc: [-41, 0, -24] }, false, false);
        S.obj('Regroup at the farmhouse', V3(-40, terrainH(-40, -27) + 2, -27), 'Farmhouse');
        await S.wait(2);
        await S.say('Russo', 'He was right there, Danny. He was right there and then he wasn’t.', 3.6);
        await S.say('Mahoney', 'Later, Russo. Grieve later. Eyes open now.', 3);
        await S.reach(V3(-40, 0, -27.5), 5);
        const fy = terrainH(-40, -32) - 0.02;
        const M = S.npc({ name: 'Marguerite', pos: [-44, fy, -34.6], yaw: 0.4, model: { side: 'civ', jacket: MAT.dress, pants: MAT.dress, skirt: MAT.dress, female: true, hair: MAT.hairDark, hat: 'none', skinI: 2 } });
        M.sit = 1; M.sitH = -0.25;
        S.obj('Search the farmhouse', V3(-40, fy + 1.8, -31.5), 'Farmhouse');
        await S.until(() => Player.pos.distanceTo(V3(-40, Player.pos.y, -31.5)) < 4.5);
        S.clearObj(); M.sit = 0;
        await S.say('Kessler', 'Hold it! Hands where I can see them!', 2.2);
        await S.say('Marguerite', 'Ne tirez pas ! Je vous en prie… Américains ? Vous êtes américains ?', 3.6);
        S.goals({ Dupree: [-41.5, fy, -32] }, true, false);
        await S.say('Dupree', 'Easy, Kessler. Oui, mademoiselle, nous sommes américains. N’ayez pas peur.', 3.6);
        await S.say('Marguerite', 'Les Allemands… ils ont pris mon frère, Luc. À Sainte-Colombe. Avec les chars.', 4);
        await S.say('Dupree', 'Her name’s Marguerite. Germans took her brother to Sainte-Colombe. She says they have tanks in the town.', 4.4);
        await S.say('Marguerite', 'Ils reviennent. Ce soir, ils reviennent toujours par le nord.', 3.2);
        await S.say('Dupree', 'Sarge — she says they always come back. From the north.', 3);
        SFX._distantShot('kar98', { g: 0.2, pan: 0, cut: 2000, d: 120 }, SFX.now());
        await S.say('Mahoney', 'She’s right. Everybody up! Windows on the north side — here they come!', 3.4);
      }
    },
    { // defend
      cp: { pos: [-40, 0, -32], yaw: Math.PI * 0.05 },
      async run(S) {
        Music.play('combat');
        const fy = terrainH(-40, -32) - 0.02;
        if (!S.get('Marguerite')) { const M = S.npc({ name: 'Marguerite', pos: [-44, fy, -34.6], yaw: 0.4, model: { side: 'civ', jacket: MAT.dress, pants: MAT.dress, skirt: MAT.dress, female: true, hair: MAT.hairDark, hat: 'none', skinI: 2 } }); M.sit = 1; M.sitH = -0.25; }
        S.place({ Mahoney: [-37, fy, -35.7], Russo: [-43, fy, -35.7], Dupree: [-51, 0, -40], Doc: [-40, fy, -30] });
        S.goals({ Mahoney: [-37, fy, -35.7], Russo: [-43, fy, -35.7], Dupree: [-51.5, 0, -40] }, false, true);
        const ammo = S.interact({ pos: HEDGE.ammoPos, text: 'Take ammunition', r: 2.2, repeat: true, onUse: () => { Player.weapons.forEach(w => w.res = WDEF[w.id].maxRes); Player.nades = Math.max(Player.nades, 3); Player.updateHud(); HUD.notify('Ammunition'); } });
        S.obj('Defend the farmhouse', null, null, 'Ammunition crate inside the house');
        const pathW = [V3(-60, 0, -62), V3(-56, 0, -52), V3(-50, 0, -47)], pathE = [V3(-10, 0, -62), V3(-18, 0, -52), V3(-26, 0, -46)];
        const spawnWave = (n, mix) => {
          const list = [];
          for (let i = 0; i < n; i++) {
            const west = i % 2 === 0, p = west ? pathW : pathE, w = mix[i % mix.length];
            const start = V3(p[0].x + rand(-3, 3), 0, -70 - rand(0, 8));
            const path = p.map(q => q.clone().add(V3(rand(-2.5, 2.5), 0, rand(-2, 2))));
            list.push(S.enemy({ pos: start, weapon: w, behavior: w === 'mp40' && Math.random() < 0.5 ? 'rush' : 'advance', alert: true, path, spots: [{ peek: path[0].clone(), crouchHide: true }], yaw: Math.PI }));
          }
          return list;
        };
        const waves = [[5, ['kar98', 'kar98', 'mp40']], [6, ['kar98', 'mp40', 'kar98']], [7, ['mp40', 'kar98', 'kar98', 'mp40']]];
        for (let wi = 0; wi < waves.length; wi++) {
          const foes = spawnWave(...waves[wi]);
          if (wi === 2) { const mg = S.enemy({ pos: [-60, 0, -63.5], weapon: 'mg42', behavior: 'mg', alert: true, yaw: Math.PI, arc: { yaw: Math.PI, half: 0.7 } }); foes.push(mg); S.sayQ('Dupree', 'MG setting up in the west gap!'); }
          S.sayQ(...pick([['Mahoney', 'Here they come! Pick your targets!'], ['Russo', 'Movement in the hedgerow! North side!'], ['Mahoney', 'Second wave! Stay in the windows!']]));
          await S.until(() => { HUD.setObjective(`Defend the farmhouse — wave ${wi + 1} of 3 (${S.alive(foes)} left)`); return S.alive(foes) === 0; });
          if (wi < 2) { await S.say(pick(['Mahoney', 'Dupree']), wi === 0 ? 'They’re pulling back! Reload, get ready!' : 'Hold on, more coming!', 2.4); await S.wait(5); }
        }
        ammo.remove();
        await S.say('Mahoney', 'That’s all of ’em. That’s all of ’em. Cease fire!', 3);
      }
    },
    { // evening
      async run(S) {
        S.clearObj(); Music.play('sorrow'); Player.control = false;
        const fy = terrainH(-40, -32) - 0.02;
        S.place({ Mahoney: [-38.5, fy, -33.5, Math.PI * 0.8], Russo: [-42, fy, -30.5, -0.8], Dupree: [-43.5, fy, -33.6, 0.9], Doc: [-40.5, fy, -29.8, Math.PI] });
        ['Russo', 'Doc'].forEach(n => { const a = S.get(n); a.goal = null; a.combat = false; a.coverCrouch = true; });
        const blend = S.blendEnv({ sunColor: 0xff9a50, sunI: 1.4, hemiSky: 0x8a7a7a, hemiGround: 0x3a3028, hemiI: 0.45, fog: 0x9a7a66, top: 0x3a4466, horizon: 0xd08a5a, cloud: 0xe0a070, cloudDark: 0x5a4450, tint: [1.08, 0.98, 0.88], exposure: 0.95 }, 8);
        Player.pos.set(-39.5, fy, -31); Player.yaw = 2.6;
        await S.wait(2);
        await S.say('Russo', 'He never could play this thing, you know. Weiss. Not one song, start to finish.', 4);
        await S.say('Dupree', 'He played “Oh! Susanna” the whole way over to England. Badly.', 3.6);
        await S.say('Doc', 'I wrote his mother’s address down. Somebody should write her. Somebody who knew him.', 4);
        await S.say('Kessler', 'I’ll write her.', 2);
        await S.say('Mahoney', 'Division wants the crossroads at Sainte-Colombe. If the girl’s right, there’s armor in that town.', 4);
        await S.say('Dupree', 'And her brother. Luc. He’s seventeen.', 3);
        await S.say('Mahoney', 'Then we go get him. We move at first light. Get some sleep. That’s an order.', 4);
        await blend;
        await S.fade(1, 3);
      }
    },
  ],
  outro: { kicker: 'In memoriam', title: 'Pfc. Eli Weiss', lines: ['Brooklyn, New York', '1924 — 1944'], hold: 3 },
});
