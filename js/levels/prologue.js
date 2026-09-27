'use strict';
/* =====================================================================
   PROLOGUE — "Infamy" (Allentown, PA, Dec 8 1941) and "Boot"
   (Camp Blanding, Florida, April 1942)
   ===================================================================== */

/* ---------- pop-up training targets ---------- */
const TARGET_TEX = {};
function targetTex(kind) {
  if (TARGET_TEX[kind]) return TARGET_TEX[kind];
  return TARGET_TEX[kind] = genTextTex(128, 192, (g, w, h) => {
    g.fillStyle = '#d9cfb2'; g.fillRect(0, 0, w, h);
    if (kind === 'bull') { for (let i = 5; i > 0; i--) { g.fillStyle = i % 2 ? '#1c1c1a' : '#d9cfb2'; g.beginPath(); g.arc(w / 2, h / 2, i * 11, 0, TAU); g.fill(); } }
    else { g.fillStyle = '#26282a'; g.beginPath(); g.arc(w / 2, 46, 22, 0, TAU); g.fill(); g.beginPath(); g.moveTo(18, h); g.quadraticCurveTo(w / 2, 50, w - 18, h); g.fill(); g.strokeStyle = '#d9cfb2'; g.lineWidth = 2; g.beginPath(); g.arc(w / 2, 110, 26, 0, TAU); g.stroke(); g.beginPath(); g.arc(w / 2, 110, 12, 0, TAU); g.stroke(); }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(80,60,30,${Math.random() * 0.1})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  });
}
class PopTarget {
  constructor(x, z, o = {}) {
    this.g = new THREE.Group(); this.g.position.set(x, o.y == null ? terrainH(x, z) : o.y, z); this.g.rotation.y = o.ry || 0; R.scene.add(this.g);
    this.hinge = new THREE.Group(); this.g.add(this.hinge);
    const w = o.w || 0.62, h = o.h || 0.95, lift = o.lift || 0.25;
    const mat = new THREE.MeshStandardMaterial({ map: targetTex(o.kind || 'man'), roughness: 0.9, side: THREE.DoubleSide }); mat.userData.dispose = true;
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), [MAT.wood, MAT.wood, MAT.wood, MAT.wood, mat, MAT.wood]); board.position.y = lift + h / 2; board.castShadow = true; this.hinge.add(board);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, lift + 0.1, 0.06), MAT.woodDark); post.position.set(0, (lift + 0.1) / 2 - 0.1, -0.03); this.hinge.add(post);
    this.box = new THREE.Box3(new THREE.Vector3(-w / 2, lift, -0.03), new THREE.Vector3(w / 2, lift + h, 0.03));
    this.up = false; this.rot = -Math.PI / 2; this.want = -Math.PI / 2; this.hinge.rotation.x = this.rot; this.onHit = o.onHit || null;
    Story.targets.push(this); PopTarget.list.push(this);
  }
  raise() { this.up = true; this.want = 0; SFX.mech('boltFwd', this.g.position); }
  lower() { this.up = false; this.want = -Math.PI / 2; }
  hit(pt) {
    if (!this.up) return; this.up = false; this.want = -Math.PI / 2; SFX.impact('wood', pt); HUD.hitmark(true); SFX.hitmarker(true);
    FX.impact(pt, V3(0, 0, 1).applyQuaternion(this.g.quaternion), 'wood');
    if (Player.stats) Player.stats.hits++;
    this.onHit && this.onHit(this);
  }
  rayHit(o, d) {
    if (!this.up || this.rot < -0.15) return null;
    this.g.updateMatrixWorld(); this.hinge.updateMatrixWorld();
    const inv = this.hinge.matrixWorld.clone().invert(); const ray = new THREE.Ray(o.clone(), d.clone()).applyMatrix4(inv);
    const p = ray.intersectBox(this.box, V3()); if (!p) return null;
    p.applyMatrix4(this.hinge.matrixWorld); return { t: p.distanceTo(o), target: this };
  }
  update(dt) { this.rot = damp(this.rot, this.want, 12, dt); this.hinge.rotation.x = this.rot; }
}
PopTarget.list = [];

/* =====================================================================
   PROLOGUE I — INFAMY
   ===================================================================== */
const FDR = [
  ['Mr. Vice President, Mr. Speaker, Members of the Senate, and of the House of Representatives:', 6],
  ['Yesterday, December 7th, 1941 — a date which will live in infamy — the United States of America was suddenly and deliberately attacked by naval and air forces of the Empire of Japan.', 11],
  ['The United States was at peace with that nation and, at the solicitation of Japan, was still in conversation with its Government and its Emperor looking toward the maintenance of peace in the Pacific.', 10],
  ['The attack yesterday on the Hawaiian Islands has caused severe damage to American naval and military forces. I regret to tell you that very many American lives have been lost.', 10],
  ['Yesterday the Japanese Government also launched an attack against Malaya.', 4.5],
  ['Last night Japanese forces attacked Hong Kong.', 3.4],
  ['Last night Japanese forces attacked Guam.', 3.2],
  ['Last night Japanese forces attacked the Philippine Islands.', 3.6],
  ['Last night the Japanese attacked Wake Island.', 3.2],
  ['And this morning the Japanese attacked Midway Island.', 4],
  ['As Commander in Chief of the Army and Navy I have directed that all measures be taken for our defense.', 6],
  ['No matter how long it may take us to overcome this premeditated invasion, the American people in their righteous might will win through to absolute victory.', 9],
  ['Hostilities exist. There is no blinking at the fact that our people, our territory and our interests are in grave danger.', 7.5],
  ['With confidence in our armed forces — with the unbounding determination of our people — we will gain the inevitable triumph — so help us God.', 9],
  ['I ask that the Congress declare that since the unprovoked and dastardly attack by Japan on Sunday, December 7th, 1941, a state of war has existed between the United States and the Japanese Empire.', 11],
];
const REACT = { 2: ['Father', 'At peace. Hah.'], 3: ['Mother', 'Oh, those poor boys. On a Sunday.'], 9: ['Abernathy', 'Midway too. Lord.'], 11: ['Abernathy', '“Righteous might.” That’s the stuff, Mr. President.'] };

const DINER = { door: null, radioGlow: null, doorCol: null };
function buildDinerLevel() {
  World.water = null;
  World.terrain = new Terrain({
    x0: -90, z0: -40, w: 180, d: 90, res: 1,
    h: (x, z) => 0.15 * (1 - smoothstep(8.2, 8.45, z)) + 0.15 * smoothstep(19.55, 19.8, z),
    color: (x, z, h) => {
      const n = fbm(x * 0.2, z * 0.2, 3);
      if (z > 8.3 && z < 19.7) { // slushy road with tyre tracks
        const tr = [11, 12.6, 15.3, 16.9].reduce((m, t) => Math.min(m, Math.abs(z - t)), 9);
        const edge = Math.min(z - 8.3, 19.7 - z);
        let v = tr < 0.35 ? 0.3 : 0.55 + n * 0.2; if (edge < 1.2) v = lerp(0.85, v, edge / 1.2);
        return [v * 0.95, v * 0.96, v];
      }
      const v = 0.8 + n * 0.15; return [v * 0.97, v * 0.98, v * 1.02];
    }
  });
  World.surfaceAt = (x, z) => (Math.abs(x) < 7 && Math.abs(z) < 4.5) ? 'tile' : 'snow';
  World.bounds = [-24, -4.4, 46, 23.2];
  const K = KIT;
  // ---- diner shell ----
  K.box(14, 0.05, 9, 0, 0.15, 0, MAT.checker, { surf: 'tile', cast: false });
  K.box(14.6, 0.25, 9.6, 0, 3.4, 0, MAT.counter, { cast: true });
  K.wall(-7.3, -4.65, 7.3, -4.65, 0.2, 3.2, 0.3, MAT.wallpaper, [{ c: 4.8, w: 2, y0: 1.1, y1: 2.0 }, { c: 10.4, w: 1, y0: 0, y1: 2.3 }]);
  K.box(15, 3.2, 3, 0, 0.2, -6.3, MAT.interior);
  K.visBox(2, 0.05, 0.5, -2.5, 1.1, -4.55, MAT.counter);
  K.wall(-7.3, 4.65, 7.3, 4.65, 0.2, 3.2, 0.3, MAT.brickDark, [{ c: 3.8, w: 5.4, y0: 0.9, y1: 2.6 }, { c: 9, w: 3.4, y0: 0.9, y1: 2.6 }, { c: 11.8, w: 1.0, y0: 0, y1: 2.4 }, { c: 13.45, w: 1.3, y0: 0.9, y1: 2.6 }]);
  for (const [x, w] of [[-3.5, 5.4], [1.7, 3.4], [6.15, 1.3]]) {
    K.visBox(w, 1.7, 0.02, x, 1.1, 4.62, MAT.glass, { cast: false });
    K.visBox(w + 0.1, 0.08, 0.36, x, 1.02, 4.6, MAT.chrome, { cast: false });
    for (let i = 1; i < Math.round(w / 1.4); i++) K.visBox(0.05, 1.7, 0.08, x - w / 2 + i * w / Math.round(w / 1.4), 1.1, 4.62, MAT.chrome, { cast: false });
  }
  K.wall(-7.15, -4.5, -7.15, 4.5, 0.2, 3.2, 0.3, MAT.wallpaper);
  K.wall(7.15, -4.5, 7.15, 4.5, 0.2, 3.2, 0.3, MAT.wallpaper);
  // wainscot
  K.visBox(0.03, 1.0, 9, -6.98, 0.2, 0, MAT.woodDark, { cast: false }); K.visBox(0.03, 1.0, 9, 6.98, 0.2, 0, MAT.woodDark, { cast: false }); K.visBox(14, 1.0, 0.03, 0, 0.2, -4.48, MAT.woodDark, { cast: false });
  // counter & stools
  K.box(7.5, 0.95, 0.6, -1.5, 0.2, -2.3, MAT.woodDark, { surf: 'wood' });
  K.visBox(7.8, 0.06, 0.85, -1.5, 1.15, -2.3, MAT.counter); K.visBox(7.6, 0.06, 0.03, -1.5, 0.9, -1.98, MAT.chrome, { cast: false });
  for (let i = 0; i < 6; i++) { const x = -4.6 + i * 1.15; K.cylinder(0.05, 0.62, x, 0.2, -1.5, MAT.chrome, { col: true }); K.cylinder(0.2, 0.09, x, 0.8, -1.5, MAT.vinylRed, { seg: 16 }); K.cylinder(0.2, 0.02, x, 0.2, -1.5, MAT.chrome, { seg: 16 }); }
  // back bar
  K.box(9, 0.9, 0.5, -1.5, 0.2, -4.15, MAT.woodDark, { surf: 'wood' }); K.visBox(9.1, 0.05, 0.55, -1.5, 1.1, -4.15, MAT.counter);
  K.visBox(9, 0.04, 0.3, -1.5, 1.58, -4.33, MAT.woodDark); K.visBox(9, 0.04, 0.3, -1.5, 2.1, -4.33, MAT.woodDark);
  for (let i = 0; i < 14; i++) K.cylinder(0.045, 0.1, -5.6 + i * 0.3, 1.62, -4.33, MAT.counter, { seg: 10 });
  const glassB = std({ color: col(0x6a4a24), roughness: 0.1, metalness: 0.2 }); glassB.userData.dispose = true;
  for (let i = 0; i < 12; i++) K.cylinder(0.04, 0.26 + (i % 3) * 0.04, -5.5 + i * 0.25 + (i > 5 ? 3.2 : 0), 2.14, -4.33, i % 2 ? glassB : MAT.glass, { seg: 8 });
  K.cylinder(0.16, 0.55, -5.2, 1.15, -4.1, MAT.chrome, { seg: 16 }); K.cylinder(0.16, 0.55, -4.7, 1.15, -4.1, MAT.chrome, { seg: 16 });
  // cathedral radio on the back bar
  K.visBox(0.38, 0.3, 0.22, 0.8, 1.15, -4.18, MAT.walnut);
  K.cylinder(0.19, 0.22, 0.8, 1.45, -4.07, MAT.walnut, { rx: Math.PI / 2, seg: 18 });
  K.visBox(0.24, 0.26, 0.01, 0.8, 1.2, -4.065, MAT.burlap, { cast: false });
  DINER.radioGlow = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.2, 0.08) })); DINER.radioGlow.position.set(0.8, 1.22, -4.058); R.scene.add(DINER.radioGlow);
  // pie case & newspaper
  K.visBox(0.7, 0.36, 0.45, -3.6, 1.18, -2.3, MAT.glass, { cast: false });
  const pie = std({ color: col(0xc8904a), roughness: 0.7 }); pie.userData.dispose = true;
  K.cylinder(0.14, 0.05, -3.75, 1.2, -2.3, pie, { seg: 16 }); K.cylinder(0.14, 0.05, -3.42, 1.2, -2.3, pie, { seg: 16 });
  K.plane(makeNewspaper(), 0.42, 0.52, -2.1, 1.215, -2.25, 0, { rx: -Math.PI / 2 });
  // booths
  for (const bx of [-5.4, -2.5, 0.4]) {
    K.box(1.05, 0.05, 0.78, bx, 0.96, 3.45, MAT.counter); K.cylinder(0.05, 0.76, bx, 0.2, 3.45, MAT.chrome);
    K.box(1.15, 0.12, 0.5, bx, 0.55, 2.62, MAT.vinylRed, { surf: 'wood' }); K.box(1.15, 0.72, 0.12, bx, 0.67, 2.33, MAT.vinylRed);
    K.box(1.15, 0.12, 0.5, bx, 0.55, 4.2, MAT.vinylRed, { surf: 'wood' });
    K.cylinder(0.04, 0.08, bx + 0.25, 1.01, 3.35, MAT.counter, { seg: 10 }); K.visBox(0.12, 0.02, 0.08, bx - 0.2, 1.01, 3.5, MAT.chrome);
  }
  // jukebox
  K.box(0.85, 1.25, 0.55, 6.5, 0.2, -2.8, MAT.walnut); K.cylinder(0.42, 0.55, 6.5, 1.45, -2.8, MAT.walnut, { rz: Math.PI / 2, seg: 18 });
  K.plane(genTextTex(128, 128, (g) => { const gr = g.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, '#ffb347'); gr.addColorStop(0.5, '#ff5e3a'); gr.addColorStop(1, '#ffd26e'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 8; i++) g.fillRect(0, i * 16, 128, 3); }), 0.6, 0.7, 6.2, 1.0, -2.8, -Math.PI / 2, { emissive: 0xffffff, ei: 0.8 });
  // christmas tree
  K.cylinder(0.18, 0.3, 6.1, 0.2, 3.6, MAT.woodDark, { seg: 10 });
  for (let i = 0; i < 7; i++) K.foliage(6.1, 0.8 + i * 0.28, 3.6, 1.2 - i * 0.14, MAT.leavesDark, 3);
  const bulbC = [0xff3020, 0x30ff60, 0x3070ff, 0xffd030, 0xff60d0];
  for (let i = 0; i < 26; i++) { const a = i * 2.4, y = 0.75 + (i / 26) * 1.7, r = 0.55 * (1 - (y - 0.6) / 2.1) + 0.05; const b = new THREE.Mesh(sphG(0.025, 6, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(bulbC[i % 5]).multiplyScalar(3) })); b.position.set(6.1 + Math.cos(a) * r, y, 3.6 + Math.sin(a) * r); R.scene.add(b); }
  // pictures & posters
  K.plane(makePhoto(), 0.42, 0.52, -6.96, 1.8, 0.6, Math.PI / 2);
  K.plane(makePoster('cal'), 0.4, 0.56, -6.96, 1.7, -2.0, Math.PI / 2);
  K.plane(makePoster('bonds'), 0.5, 0.7, 6.96, 1.75, 1.0, -Math.PI / 2);
  K.plane(makeSign('KESSLER’S · HOME COOKING', { bg: '#2c3b2e', w: 512, h: 72 }), 2.8, 0.4, -2.5, 2.45, -4.47, 0);
  // pendant lamps
  for (const [x, z] of [[-4.5, -0.5], [-1.5, 0.5], [1.5, -0.5], [4.5, 0.5]]) { K.cylinder(0.01, 0.5, x, 2.9, z, MAT.metalDark, { seg: 4 }); K.cylinder(0.05, 0.18, x, 2.72, z, MAT.chrome, { r2: 0.22, seg: 14 }); const b = new THREE.Mesh(sphG(0.06, 8, 6), MAT.emissiveWarm); b.position.set(x, 2.72, z); R.scene.add(b); }
  // door
  DINER.door = new THREE.Group(); DINER.door.position.set(4.0, 0.2, 4.65); R.scene.add(DINER.door);
  const dp = mesh(boxG(1.0, 2.3, 0.05), MAT.woodPaint, DINER.door, 0.5, 1.15, 0); mesh(boxG(0.7, 1.0, 0.052), MAT.glass, DINER.door, 0.5, 1.6, 0, { cast: false }); mesh(sphG(0.04, 8, 6), MAT.chrome, DINER.door, 0.9, 1.1, 0.05);
  DINER.doorCol = addCol(4.0, 0.2, 4.55, 5.0, 2.5, 4.75, { surf: 'wood' });
  // ---- exterior: our block ----
  K.visBox(14.6, 3.8, 9.6, 0, 3.6, 0, MAT.brickDark);
  for (let i = 0; i < 5; i++) { K.visBox(1.1, 1.5, 0.05, -5.6 + i * 2.8, 4.4, 4.82, i === 2 ? MAT.windowLit : MAT.interior, { cast: false }); K.visBox(1.3, 0.12, 0.2, -5.6 + i * 2.8, 4.3, 4.85, MAT.stone, { cast: false }); }
  K.plane(makeSign('KESSLER’S DINER', { bg: '#7d1f1a', fg: '#f3e6c4', w: 512, h: 96 }), 5.2, 0.9, 0, 3.05, 4.84, 0, { emissive: 0xffffff, ei: 0.25 });
  K.visBox(14.6, 0.14, 0.9, 0, 2.72, 5.1, MAT.woodPaint, { cast: true });
  for (const [x0, x1, m] of [[-40, -7.3, MAT.brick], [7.3, 26, MAT.brickDark], [26, 50, MAT.brick]]) {
    const w = x1 - x0, cx = (x0 + x1) / 2; K.box(w, 9, 10, cx, 0.15, 9.8 - 10 - 0.2 - 4.65 + 4.65, m);
    for (let x = x0 + 1.5; x < x1 - 1; x += 3) for (let f = 0; f < 3; f++) K.visBox(1.2, 1.5, 0.05, x, 0.9 + f * 2.8, 4.63, (x * 7 + f * 3) % 5 < 1.3 ? MAT.windowLit : MAT.interior, { cast: false });
  }
  // ---- across the street ----
  const across = [[-60, -30, MAT.brick, 11], [-30, -8, MAT.plasterGrey, 8], [-5, 18, MAT.brickDark, 12], [21, 33, MAT.brick, 9], [33, 45, MAT.stone, 8], [45, 70, MAT.brickDark, 10]];
  for (const [x0, x1, m, h] of across) {
    const cx = (x0 + x1) / 2, w = x1 - x0; K.box(w, h, 12, cx, 0.15, 29.6, m);
    if (m !== MAT.stone) for (let x = x0 + 1.5; x < x1 - 1; x += 3) for (let f = 0; f < Math.floor(h / 3); f++) K.visBox(1.2, 1.5, 0.05, x, 1.1 + f * 3, 23.57, (x * 3 + f * 7) % 6 < 1.6 ? MAT.windowLit : MAT.interior, { cast: false });
    K.visBox(w, 0.3, 0.3, cx, h + 0.15, 23.5, MAT.stone, { cast: false });
  }
  // shopfront awnings across the street
  for (const x of [-20, 2, 10, 26]) K.visBox(5, 0.08, 1.4, x, 3, 22.9, MAT.woodPaint);
  // recruiting station (post office) front
  K.visBox(10, 0.4, 0.4, 39, 7.6, 23.45, MAT.stone);
  for (let i = 0; i < 4; i++) K.cylinder(0.3, 6, 35 + i * 2.7, 0.15, 23.2, MAT.stone, { seg: 14, col: true });
  K.visBox(1.6, 2.8, 0.05, 39.6, 0.15, 23.56, MAT.interior, { cast: false });
  K.plane(makeSign('U.S. ARMY RECRUITING STATION', { bg: '#1f2d4a', fg: '#efe6d2', w: 1024, h: 96, font: 'bold 44px Georgia, serif' }), 7.5, 0.72, 39, 6.5, 23.35, Math.PI);
  K.plane(makePoster('army'), 1.0, 1.4, 36.6, 2.0, 23.4, Math.PI); K.plane(makePoster('army'), 1.0, 1.4, 42.4, 2.0, 23.4, Math.PI);
  const flag = genTextTex(256, 160, (g, w, h) => { for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#efe6d2' : '#a3282a'; g.fillRect(0, i * h / 13, w, h / 13 + 1); } g.fillStyle = '#23305a'; g.fillRect(0, 0, w * 0.42, h * 7 / 13); g.fillStyle = '#efe6d2'; for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) g.fillRect(8 + c * 12 + (r % 2) * 5, 6 + r * 13, 3, 3); });
  K.cylinder(0.05, 7, 44.5, 7.8, 23.2, MAT.chrome, { rx: -0.6, seg: 8 });
  DINER.flag = K.plane(flag, 1.8, 1.1, 45.3, 12.6, 20.2, Math.PI, { double: true });
  // street furniture
  for (const x of [-18, 0, 18, 36]) { K.lamp(x, 8.0); }
  for (const x of [-10, 30]) K.lamp(x, 20.2);
  const car1 = makeCar(0x1c2226); car1.position.set(-12, 0, 9.4); car1.rotation.y = Math.PI / 2; R.scene.add(car1);
  const car2 = makeCar(0x3a2a24); car2.position.set(15, 0, 9.4); car2.rotation.y = Math.PI / 2; R.scene.add(car2);
  const car3 = makeCar(0x243426); car3.position.set(24, 0, 18.6); car3.rotation.y = -Math.PI / 2; R.scene.add(car3);
  addCol(-14.5, 0, 8.5, -9.5, 1.5, 10.3, { surf: 'metal' }); addCol(12.5, 0, 8.5, 17.5, 1.5, 10.3, { surf: 'metal' }); addCol(21.5, 0, 17.7, 26.5, 1.5, 19.5, { surf: 'metal' });
  for (let i = 0; i < 40; i++) { const x = sr(-60, 60), z = sr() < 0.5 ? sr(8.4, 9) : sr(19, 19.6); if (Math.abs(x + 12) < 3 || Math.abs(x - 15) < 3 || Math.abs(x - 24) < 3) continue; K.rock(x, 0.02, z, sr(0.3, 0.6), MAT.snow, { sy: 0.4 }); }
  // mailbox & fire hydrant
  K.box(0.5, 1.1, 0.45, 8.5, 0.15, 6.8, MAT.od); K.cylinder(0.12, 0.7, -6, 0.15, 7.8, std({ color: col(0x8a2a22), roughness: 0.6 }), { seg: 10, col: true });
}
function spawnDinerCast() {
  const civ = (o) => S.npc({ ...o, model: { side: 'civ', ...o.model } });
  civ({ name: 'Father', pos: [-1.2, 0.2, -3.25], yaw: Math.PI, model: { jacket: MAT.civShirt, pants: MAT.civSuit, hair: MAT.hairGrey, mustache: true, apron: true, hat: 'hair', skinI: 0 } });
  civ({ name: 'Mother', pos: [-2.5, 0.2, 2.0], yaw: 0, model: { jacket: MAT.dress, pants: MAT.dress, skirt: MAT.dress, female: true, hair: MAT.hairBrown, hat: 'none', skinI: 2 } });
  civ({ name: 'Ruth', pos: [-5.4, 0.2, 4.1], yaw: Math.PI * 0 + Math.PI, sit: 1, sitH: 0.08, model: { jacket: MAT.dressRed, pants: MAT.dressRed, skirt: MAT.dressRed, female: true, hair: MAT.hairBlond, hat: 'none', skinI: 2 } });
  civ({ name: 'Abernathy', pos: [1.15, 0.2, -1.5], yaw: 0, sit: 1, sitH: 0.32, model: { jacket: MAT.civCoatGrey, pants: MAT.civSuit, hair: MAT.hairGrey, mustache: true, hat: 'fedora', skinI: 0 } });
  const fr = civ({ name: 'Russo', pos: [4.5, 0.15, 14], yaw: 0, model: { jacket: MAT.civLeather, pants: MAT.civSuit, hat: 'cap', capMat: MAT.civCoatGrey, hair: MAT.hairDark, skinI: 4 } });
  fr.h.root.visible = false;
  const walkers = [[[-40, 0.15, 6.5], [30, 0.15, 6.5]], [[35, 0.15, 21.5], [-40, 0.15, 21.5]], [[-20, 0.15, 21.2], [20, 0.15, 21.2]]];
  walkers.forEach((p, i) => civ({ name: 'Walker' + i, pos: p[0], path: [V3(...p[1]), V3(...p[0])], loop: true, walkSpd: 1.2 + i * 0.15, lookAtPlayer: false, model: { jacket: i % 2 ? MAT.civCoat : MAT.civCoatGrey, hat: 'fedora', hair: MAT.hairDark } }));
  civ({ name: 'Newsboy', pos: [14, 0.15, 6.4], yaw: -Math.PI / 2, model: { jacket: MAT.civCoat, pants: MAT.civCoatGrey, hat: 'cap', capMat: MAT.civCoat, skinI: 1 } });
  // recruiting line
  for (let i = 0; i < 7; i++) civ({ name: 'Line' + i, pos: [29.5 + i * 1.05, 0.15, 21.9 + (i % 2) * 0.2], yaw: -Math.PI / 2 + rand(-0.2, 0.2), lookAtPlayer: false, model: { jacket: pick([MAT.civCoat, MAT.civCoatGrey, MAT.civLeather, MAT.civSuit]), hat: pick(['fedora', 'cap', 'hair']), capMat: MAT.civCoatGrey, hair: pick([MAT.hairDark, MAT.hairBrown, MAT.hairBlond]) } });
  civ({ name: 'Recruiter', pos: [38.2, 0.15, 22.3], yaw: Math.PI / 2, model: { side: 'civ', jacket: MAT.usJacket, pants: MAT.usPants, hat: 'garrison', capMat: MAT.usJacket, hair: MAT.hairBrown, tie: MAT.khaki, skinI: 0 } });
}
function openDinerDoor(instant) {
  DINER.doorCol.active = false;
  if (instant) { DINER.door.rotation.y = -1.6; return; }
  SFX.mech('door'); SFX.bell();
  const t0 = Story.gameTime; Story.until(() => { const u = clamp((Story.gameTime - t0) / 0.8, 0, 1); DINER.door.rotation.y = -1.6 * easeOut(u); return u >= 1; });
}
function examine(pos, text, line) { return S.interact({ pos, text, r: 2.4, onUse: () => S.say('Kessler', line) }); }

MISSIONS.push({
  id: 'infamy', chapter: 'Prologue', title: 'Infamy', date: 'December 8, 1941', place: 'Allentown, Pennsylvania', noStats: true, seed: 3,
  card: { kicker: 'Prologue', title: 'Infamy', lines: ['Monday, December 8, 1941', 'Kessler’s Diner — Allentown, Pennsylvania', 'Daniel Kessler, age 19'] },
  ambience: 'diner',
  env: {
    sunDir: [0.35, 0.5, 0.75], sunColor: 0xe6ebf2, sunI: 1.3, hemiSky: 0xcfd6de, hemiGround: 0x7a746a, hemiI: 0.62,
    fog: 0xc9ced3, fogDensity: 0.016, groundColor: 0xd0d2d4,
    sky: { top: 0x98a3ad, horizon: 0xd2d6d9, cloud: 0xdadcde, cloudDark: 0x8d9197, cover: 0.9, sunI: 0.25 },
    lights: [{ pos: [-3, 2.6, 0], color: 0xffc98a, i: 1.25, dist: 11 }, { pos: [3, 2.6, 0], color: 0xffc98a, i: 1.25, dist: 11 }],
    grade: { exposure: 1.05, sat: 0.8, contrast: 1.05, tint: [1.03, 1.0, 0.95], vig: 0.55, grain: 0.05 },
    smokeTint: [0.8, 0.8, 0.8], vmHemi: 1,
  },
  spawn: { pos: [-0.6, 0.2, 1.4], yaw: 0.25 },
  loadout: { weapons: [], medkits: 0, nades: 0 },
  build() { buildDinerLevel(); spawnDinerCast(); },
  onReady(stage) {
    HUD.healthVisible(false); HUD.weaponsVisible(false);
    FX.snow(Player.pos).mask = (x, z) => !(Math.abs(x) < 7.4 && z < 4.9 && z > -5);
    const e = FX.emitters[FX.emitters.length - 1]; Story.onTick = () => { e.center = Player.pos; if (DINER.flag) DINER.flag.rotation.y = Math.PI + Math.sin(R.time * 2) * 0.12; };
  },
  stages: [
    { // the address
      async run(S) {
        await S.wait(1.5);
        await S.say('Mother', 'Danny, turn the radio up for your father, would you? The President’s coming on at half past.');
        S.sayQ('Father', 'Go on, son. Loud as she goes.');
        const radioPos = V3(0.8, 1.4, -4.1);
        S.obj('Turn up the radio', radioPos, 'Radio');
        S.hint('Move with <kbd>W A S D</kbd> &middot; look with the mouse &middot; interact with <kbd>E</kbd>', 7);
        await S.interact({ pos: radioPos, text: 'Turn up the radio', r: 2.8, cone: 0.3 }).done;
        S.clearObj(); SFX.radio(true); DINER.radioGlow.material.color.setRGB(3, 1.8, 0.6);
        await S.wait(1.5);
        S.obj('Listen to the President’s address', null, null, 'Look around the diner while he speaks');
        const ex = [
          examine(V3(-6.9, 1.8, 0.6), 'Look at the photograph', 'Pop, in France. Nineteen eighteen. He never talks about it. Not once.'),
          examine(V3(-2.1, 1.25, -2.25), 'Read the newspaper', '“Japan wars on U.S.” Printed at four this morning. Pop read it three times.'),
          examine(V3(-6.9, 1.7, -2.0), 'Look at the calendar', 'Ellie’s birthday is Saturday. I was going to take her to the picture show.'),
          examine(V3(6.2, 1.2, -2.8), 'Look at the jukebox', '“Chattanooga Choo Choo.” Nobody’s putting a nickel in today.'),
          examine(V3(6.1, 1.3, 3.6), 'Look at the Christmas tree', 'Ruthie hung every one of those lights on Saturday. Feels like a year ago.'),
          examine(V3(-3.6, 1.3, -2.3), 'Look at the pies', 'Mom’s apple. Ten cents a slice. Abernathy’s had two already.'),
        ];
        for (let i = 0; i < FDR.length; i++) {
          await S.say('Radio', FDR[i][0], FDR[i][1]);
          if (REACT[i]) await S.say(REACT[i][0], REACT[i][1], 3);
        }
        SFX.radioApplause(8);
        await S.wait(3.5);
        ex.forEach(e => e.remove());
        SFX.radio(false); DINER.radioGlow.material.color.setRGB(0.3, 0.2, 0.08);
        await S.say('Abernathy', 'Well. That’s it, then.', 2.5);
        await S.say('Ruth', 'Is Danny going to have to go?', 2.5);
        await S.say('Mother', 'Hush, Ruthie.', 2);
        S.clearObj();
      }
    },
    { // Frankie arrives
      restore() { },
      async run(S) {
        const fr = S.get('Russo'); fr.h.root.visible = true; fr.pos.set(4.5, 0.15, 12); fr.place();
        fr.path = [V3(4.5, 0.15, 6.5), V3(4.5, 0.2, 4.0), V3(3.4, 0.2, 2.2)]; fr.pathI = 0; fr.walkSpd = 3.2;
        await S.until(() => fr.pos.z < 6.8);
        openDinerDoor();
        await S.until(() => fr.pathI >= 3);
        await S.say('Russo', 'Danny! You hear it? Half of Seventh Street’s down at the post office. The Army’s got a line clear around the block!');
        await S.say('Father', 'Francis Russo, you’re letting the snow in.', 3);
        await S.say('Russo', 'Sorry, Mr. K. — Danny, come on. We said if it ever came to it, we’d go together.');
        await S.say('Ruth', 'Danny, you’re not going. Are you?', 3);
        const fa = S.get('Father');
        S.obj('Talk to your father', () => fa.pos.clone().add(V3(0, 1.9, 0)), 'Pop');
        await S.interact({ pos: () => fa.pos.clone().add(V3(0, 1.5, 0)), text: 'Talk to Pop', r: 3.2, cone: 0.4 }).done;
        S.clearObj();
        await S.say('Father', 'I know that look. I wore it myself once. Nineteen seventeen.');
        await S.say('Kessler', 'Pop, they killed sailors in their bunks on a Sunday morning.');
        await S.say('Father', 'I heard him. And mark me — the Germans will be in this inside a week. That man in Berlin won’t sit it out.');
        await S.say('Father', 'Your grandfather came over from Bremen with a trunk and a name. There will be boys called Kessler on the other side of this. You understand me?');
        await S.say('Kessler', 'Then I’d better make sure the right Kesslers win.');
        fa.talk = 0;
        await S.wait(1.2);
        await S.say('Father', 'Here. It’s a Waltham. It kept time for me in the Argonne. It’ll keep time for you.');
        SFX.mech('pickup'); HUD.notify('Received — father’s Waltham trench watch'); Story.hasWatch = true;
        await S.say('Father', 'You bring it back to me. And you bring yourself back with it.');
        await S.say('Mother', 'Wilhelm…', 2);
        await S.say('Father', 'He’s nineteen, Maggie. He was always going to go.', 3.5);
        await S.say('Mother', 'You come home, Daniel Kessler. You hear me? You come home.', 4);
        await S.say('Russo', 'I’ll bring him back, Mrs. K. Swear on my mother.', 3);
        S.obj('Go with Frankie', V3(4.5, 1.2, 5.5), 'Door');
        fr.path = [V3(4.5, 0.2, 4.0), V3(4.5, 0.15, 6.8), V3(7, 0.15, 7)]; fr.pathI = 0; fr.walkSpd = 1.6;
        await S.reach(V3(4.5, 0, 6.0), 1.6);
      }
    },
    { // walk to the recruiting station
      cp: { pos: [5, 0.15, 7], yaw: -Math.PI / 2 },
      restore() { openDinerDoor(true); Story.hasWatch = true; },
      async run(S) {
        const fr = S.get('Russo'); fr.h.root.visible = true;
        if (fr.pos.z < 5) { fr.pos.set(6.5, 0.15, 7); fr.place(); }
        fr.path = [V3(20, 0.15, 7.2), V3(24, 0.15, 12), V3(27, 0.15, 18), V3(28.5, 0.15, 21.4)]; fr.pathI = 0; fr.walkSpd = 1.5; fr.lookAtPlayer = false;
        S.obj('Walk with Frankie to the recruiting station', V3(36, 1.5, 22), 'Recruiting station');
        Music.play('home');
        const nb = S.get('Newsboy');
        const lines = [
          [11, () => S.say('Russo', 'My ma’s gonna kill me. Then Tojo’s gonna have to wait his turn.')],
          [14, () => { nb.talk = 3; return S.say('Newsboy', 'Extra! Extra! Roosevelt asks Congress for war! Read all about it!'); }],
          [18, () => S.say('Russo', 'My cousin Sal says the Navy’s got better uniforms, but the Army feeds you three times a day. I did the math.')],
          [24, () => S.say('Russo', 'Hey. Whatever they do with us, we stick together. Same outfit. Deal?')],
          [26, () => S.say('Kessler', 'Deal.')],
        ];
        let li = 0;
        await S.until(() => { while (li < lines.length && Player.pos.x > lines[li][0]) { lines[li][1](); li++; } return Player.pos.x > 28 && Player.pos.z > 17; });
        const rc = S.get('Recruiter');
        S.obj('Enlist', () => rc.pos.clone().add(V3(0, 1.9, 0)), 'Recruiting sergeant');
        await S.say('Recruiter', 'All right, gentlemen, one at a time! Next!', 3);
        await S.interact({ pos: () => rc.pos.clone().add(V3(0, 1.5, 0)), text: 'Step up to the sergeant', r: 3.5, cone: 0.3 }).done;
        S.clearObj(); Player.control = false;
        await S.say('Recruiter', 'Name?', 1.6);
        await S.say('Kessler', 'Daniel Kessler.', 2);
        await S.say('Recruiter', 'Kessler. That German?', 2.2);
        await S.say('Kessler', 'Pennsylvania, Sergeant.', 2.2);
        await S.say('Recruiter', 'Ha. Good answer. Age?', 2);
        await S.say('Kessler', 'Nineteen.', 1.6);
        await S.say('Recruiter', 'Sign right here, son. Welcome to the United States Army.', 3.5);
        await S.fade(1, 2.5);
        Music.stop();
      }
    },
  ],
  outro: { kicker: 'December 11, 1941', lines: ['Three days later, Germany and Italy declared war on the United States.', 'Daniel Kessler and Francis Russo reported for induction on January 5, 1942.'], hold: 2.5 },
});

/* =====================================================================
   PROLOGUE II — BOOT (Camp Blanding, Florida)
   ===================================================================== */
const CAMP = {};
function campH(x, z) {
  let h = (fbm(x * 0.02 + 5, z * 0.02, 3) - 0.5) * 1.2;
  h *= smoothstep(10, 40, Math.abs(z + 40) + Math.abs(x) * 0.2);
  h += smoothstep(-100, -112, z) * 7 * (1 - smoothstep(20, 40, Math.abs(x)));  // berm behind targets
  const pd = Math.hypot(x + 32, z + 16); if (pd < 4) h -= (1 - (pd / 4) ** 2) * 0.8; // grenade pit
  return h;
}
function buildCampLevel() {
  World.water = null;
  World.terrain = new Terrain({
    x0: -140, z0: -170, w: 280, d: 260, res: 2, h: campH,
    color: (x, z, h, n) => {
      const g = fbm(x * 0.05, z * 0.05, 4), sand = [0.8, 0.72, 0.55], grass = [0.5, 0.52, 0.3];
      let c = g > 0.52 ? grass : sand; const k = smoothstep(0.45, 0.6, g);
      c = [lerp(sand[0], grass[0], k), lerp(sand[1], grass[1], k), lerp(sand[2], grass[2], k)];
      if (Math.abs(x) < 16 && z < 4 && z > -100) { c = [c[0] * 0.95, c[1] * 0.92, c[2] * 0.85]; }
      const v = 0.9 + fbm(x * 0.4, z * 0.4, 2) * 0.2; return [c[0] * v, c[1] * v, c[2] * v];
    }
  });
  World.surfaceAt = () => 'sand';
  World.bounds = [-110, -140, 110, 60];
  const K = KIT;
  // firing line pavilion
  for (let x = -14; x <= 14; x += 4) { K.box(0.2, 3, 0.2, x, 0, 3, MAT.woodDark, { surf: 'wood' }); K.box(0.2, 2.6, 0.2, x, 0, -0.8, MAT.woodDark, { surf: 'wood' }); }
  K.visBox(30, 0.1, 5, 0, 2.95, 1.1, MAT.metal, { rx: 0.08 });
  for (let x = -12; x <= 12; x += 4) { K.sandbags(x, -1.4, 1.6, 3, 0); }
  K.box(3, 0.9, 0.8, 5, 0, 5, MAT.wood, { surf: 'wood' });
  // rifle rack
  K.box(2.2, 0.08, 0.5, -4, 0.9, 5.2, MAT.woodDark, { surf: 'wood' }); K.box(0.1, 1.4, 0.4, -5, 0, 5.2, MAT.woodDark); K.box(0.1, 1.4, 0.4, -3, 0, 5.2, MAT.woodDark);
  for (let i = 0; i < 6; i++) { const g = makeNpcGun('garand'); g.position.set(-4.8 + i * 0.32, 0.45, 5.35); g.rotation.set(-Math.PI / 2 + 0.25, 0, 0); R.scene.add(g); }
  // target frames and berm
  for (const z of [-45.7, -91.4]) { K.box(26, 0.6, 1.2, 0, terrainH(0, z + 1.5) - 0.2, z + 1.4, MAT.wood, { surf: 'wood' }); K.visBox(26, 2.4, 0.15, 0, terrainH(0, z - 1) - 0.1, z - 1.2, MAT.woodDark); }
  // lane numbers
  for (let i = 0; i < 7; i++) { const x = -12 + i * 4; K.plane(makeLabelTex(String(i + 1), '#1d1f18', '#e2d8bd', 64, 64), 0.5, 0.5, x, 0.9, -2.25, 0); }
  // barracks
  for (let i = 0; i < 6; i++) K.building({ x: -60 + i * 24, z: 52, w: 18, d: 9, floors: 2, fh: 3, mat: MAT.plasterWhite, trim: MAT.woodPaint, roofMat: MAT.roofSlate, ridgeX: true, shutters: false, spacing: 2.4, winW: 1.0, winH: 1.3 });
  // water tower & flagpole
  for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) K.cylinder(0.15, 14, 70 + dx, 0, 30 + dz, MAT.metalDark, { seg: 6, col: true });
  K.cylinder(3.2, 4, 70, 14, 30, MAT.metal, { seg: 20 }); K.cylinder(0.3, 1.5, 70, 18, 30, MAT.metal, { r2: 3.3, seg: 20 });
  K.cylinder(0.08, 12, 0, 0, 34, MAT.chrome, { seg: 8, col: true });
  // obstacle course (x 34..42)
  K.plane(makeSign('OBSTACLE COURSE', { bg: '#2b3524', w: 512, h: 96 }), 3, 0.56, 38, 2.4, 9.2, Math.PI);
  K.visBox(0.12, 2.2, 0.12, 36.5, 0, 9.3, MAT.woodDark); K.visBox(0.12, 2.2, 0.12, 39.5, 0, 9.3, MAT.woodDark);
  for (const z of [0, -6]) { K.cylinder(0.28, 8, 34, terrainH(38, z) + 0.28, z, MAT.bark, { rz: -Math.PI / 2, seg: 10 }); addCol(34, terrainH(38, z), z - 0.3, 42, terrainH(38, z) + 0.56, z + 0.3, { surf: 'wood' }); }
  for (let z = -12; z >= -20; z -= 2) for (const x of [34, 42]) K.box(0.1, 1.5, 0.1, x, terrainH(x, z), z, MAT.woodDark, { surf: 'wood' });
  for (let z = -12; z >= -20; z -= 0.8) K.visBox(8, 0.02, 0.02, 38, terrainH(38, z) + 1.33 + Math.sin(z * 3) * 0.03, z, MAT.wire, { cast: false });
  addCol(34, terrainH(38, -16) + 1.28, -20.2, 42, terrainH(38, -16) + 1.6, -11.8, { noBullet: true, surf: 'metal' });
  K.box(8, 1.15, 0.35, 38, terrainH(38, -27), -27, MAT.wood, { surf: 'wood' });
  K.visBox(0.1, 2.2, 0.1, 34.5, terrainH(34, -34), -34, MAT.woodDark); K.visBox(0.1, 2.2, 0.1, 41.5, terrainH(41, -34), -34, MAT.woodDark);
  // grenade range
  K.sandbags(-32, 2.5, 6, 4, 0, { thick: 2 });
  for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; K.sandbags(-32 + Math.cos(a) * 4.4, -16 + Math.sin(a) * 4.4, 1.3, 2, -a + Math.PI / 2); }
  K.plane(makeSign('HAND GRENADE COURT', { bg: '#402a1c', w: 512, h: 96 }), 3, 0.56, -32, 2.6, 5, Math.PI);
  // mock village (plywood facades)
  const ply = MAT.woodPaint;
  const houses = [[-44, -58, 8, 6], [-30, -60, 7, 7], [-44, -74, 8, 7], [-28, -76, 9, 6]];
  for (const [x, z, w, d] of houses) {
    K.wall(x - w / 2, z + d / 2, x + w / 2, z + d / 2, 0, 3, 0.15, ply, [{ c: w * 0.3, w: 1.1, y0: 0, y1: 2.2 }, { c: w * 0.72, w: 1.2, y0: 1.0, y1: 2.0 }]);
    K.wall(x - w / 2, z - d / 2, x + w / 2, z - d / 2, 0, 3, 0.15, ply, [{ c: w * 0.5, w: 1.2, y0: 1.0, y1: 2.0 }]);
    K.wall(x - w / 2, z - d / 2, x - w / 2, z + d / 2, 0, 3, 0.15, ply, [{ c: d * 0.5, w: 1.1, y0: 0, y1: 2.2 }]);
    K.wall(x + w / 2, z - d / 2, x + w / 2, z + d / 2, 0, 3, 0.15, ply, [{ c: d * 0.5, w: 1.2, y0: 1.0, y1: 2.0 }]);
    K.roof(x, z, w, d, 3, 1.4, MAT.roofSlate, { ridgeX: true });
  }
  K.plane(makeSign('VILLAGE FIGHTING', { bg: '#402a1c', w: 512, h: 96 }), 3, 0.56, -37, 2.6, -46.5, Math.PI);
  K.box(1.8, 0.85, 0.8, -37, 0, -49, MAT.wood, { surf: 'wood' });
  CAMP.tommy = makeNpcGun('thompson'); CAMP.tommy.position.set(-37, 0.9, -49); CAMP.tommy.rotation.set(0, 0.4, Math.PI / 2); R.scene.add(CAMP.tommy);
  // pines
  for (let i = 0; i < 90; i++) {
    const a = sr(0, TAU), r = sr(70, 125), x = Math.cos(a) * r, z = -40 + Math.sin(a) * r * 0.9;
    if (z > 40 && Math.abs(x) < 80) continue;
    K.tree(x, z, { type: 'pine', h: sr(14, 22) });
  }
  for (let i = 0; i < 12; i++) K.tree(sr(-90, -55), sr(-120, 20), { type: 'oak', h: sr(8, 12), mat: MAT.leavesDark });
  KIT.grass({ x0: -110, x1: 110, z0: -140, z1: 60, count: 9000, color: 0xd0c8a0, scale: 0.8, mask: (x, z) => fbm(x * 0.05, z * 0.05, 4) > 0.5 && !(Math.abs(x) < 16 && z < 6 && z > -95) });
}
MISSIONS.push({
  id: 'boot', chapter: 'Prologue', title: 'Boot', date: 'April 1942', place: 'Camp Blanding, Florida', noStats: true, seed: 5,
  card: { kicker: 'Prologue', title: 'Boot', lines: ['April 1942', 'Camp Blanding, Florida — Infantry Replacement Training Center', 'Pvt. Daniel Kessler, 16th week of training'] },
  ambience: 'camp',
  env: {
    sunDir: [-0.4, 0.8, 0.35], sunColor: 0xfff0d8, sunI: 2.6, hemiSky: 0xb8d0e8, hemiGround: 0x9a8a68, hemiI: 0.6,
    fog: 0xc8d4de, fogDensity: 0.0055, groundColor: 0xb8a888,
    sky: { top: 0x3d6ea8, horizon: 0xc2d4e2, cloud: 0xf4f4f0, cloudDark: 0xa0a8b4, cover: 0.35, sunI: 1.2 },
    grade: { exposure: 1.0, sat: 0.9, contrast: 1.06, tint: [1.03, 1.0, 0.95], vig: 0.4 },
    dustTint: [0.75, 0.68, 0.52],
  },
  spawn: { pos: [-1.5, 0, 7.5], yaw: Math.PI * 0.05 },
  loadout: { weapons: [], medkits: 0, nades: 0 },
  build() {
    PopTarget.list = []; buildCampLevel();
    CAMP.t50 = [-8, -4, 0, 4, 8].map(x => new PopTarget(x, -44.6, { kind: 'man', y: terrainH(x, -44.6) + 0.35 }));
    CAMP.t100 = [-6, -2, 2, 6].map(x => new PopTarget(x, -90.3, { kind: 'man', y: terrainH(x, -90.3) + 0.35 }));
    CAMP.village = [[-46.2, -58.5, Math.PI / 2], [-31, -56.6, 0], [-28.5, -61.5, 0], [-42, -70.6, 0], [-44, -77.2, 0], [-30.8, -73.3, Math.PI / 2 * 0], [-26, -78.8, 0], [-40.5, -58, 0]].map(([x, z, ry]) => new PopTarget(x, z, { ry, kind: 'man', y: 0.4, h: 1.2 }));
    const npc = (o) => S.npc(o);
    npc({ name: 'Hollis', pos: [1.5, 0, 3.8], yaw: Math.PI * 0.9, model: { side: 'civ', jacket: MAT.khaki, pants: MAT.khaki, hat: 'campaign', hair: MAT.hairDark, skinI: 1, tie: MAT.usPants, gear: false } });
    npc({ name: 'Russo', pos: [-2.8, 0, 2.2], yaw: 0.2, model: { side: 'us', jacket: MAT.usHBT, pants: MAT.usHBT, hat: 'us', weapon: 'garand', skinI: 4, gear: false } });
    CAMP.recruits = [[-12, -0.4], [-8, -0.4], [8, -0.4], [12, -0.4]].map(([x, z], i) => { const n = npc({ name: 'Recruit' + i, pos: [x, 0, z], yaw: 0, lookAtPlayer: false, model: { side: 'us', jacket: MAT.usHBT, pants: MAT.usHBT, hat: 'us', weapon: 'garand', skinI: i % 5, gear: false } }); n.alertPose = true; n.headPitch = 0.05; return n; });
  },
  onReady(stage) {
    HUD.healthVisible(false);
    let rt = 0;
    Story.onTick = (dt) => {
      PopTarget.list.forEach(t => t.update(dt));
      rt -= dt;
      if (rt <= 0) { rt = rand(0.6, 1.8); const r = pick(CAMP.recruits); const m = humanMuzzle(r.h, V3()); SFX.shot('garand', m); FX.muzzle(m, V3(0, 0, -1), 0.9, true); const hit = V3(r.pos.x + rand(-1, 1), terrainH(r.pos.x, -100) + rand(1, 3), -100); FX.impact(hit, V3(0, 0, 1), 'sand'); }
    };
    Story.targets = PopTarget.list.slice();
  },
  stages: [
    {
      async run(S) {
        const H = S.get('Hollis'); Player.control = false;
        await S.wait(1);
        await S.say('Hollis', 'Listen up, you collection of soda jerks and farm boys! This is the rifle range, not a church picnic!');
        await S.say('Hollis', 'Sixteen weeks I’ve had you. Today you show me whether Uncle Sam wasted his money.');
        await S.say('Hollis', 'Kessler! Since you’re so eager — draw a rifle from the rack.');
        Player.control = true;
        S.obj('Take an M1 Garand from the rack', V3(-4, 1.2, 5.2), 'Rifle rack');
        await S.interact({ pos: V3(-4, 1.0, 5.2), text: 'Take M1 Garand', r: 2.6 }).done;
        Player.give('garand', { res: 40 }); HUD.weaponsVisible(true);
        S.clearObj();
        await S.say('Hollis', 'That is the M1 rifle. Eight rounds, semi-automatic, the finest battle implement ever devised. General Patton said so, and I believe everything the General says.');
      }
    },
    {
      async run(S) {
        S.obj('Hit the 50-yard targets', V3(0, 1.5, -1.5), 'Firing line', 'Step up to the firing line');
        await S.reach(V3(0, 0, -0.5), 3.5);
        S.hint('<kbd>Left click</kbd> to fire', 6);
        await S.say('Hollis', 'Targets up at fifty yards. Put them down.', 2.6);
        let n = 0; CAMP.t50.forEach(t => { t.onHit = () => { n++; HUD.setObjective(`Hit the 50-yard targets (${n}/5)`); }; t.raise(); });
        HUD.setObjective('Hit the 50-yard targets (0/5)'); HUD.setMarker(null);
        await S.until(() => n >= 5);
        await S.say('Hollis', 'Not bad. Now let’s see you do it at a hundred.', 2.6);
      }
    },
    {
      async run(S) {
        S.hint('Hold <kbd>Right click</kbd> to aim down the sights — line up the front post inside the rear aperture', 8);
        let n = 0; CAMP.t100.forEach(t => { t.onHit = () => { n++; HUD.setObjective(`Aim down sights and hit the 100-yard targets (${n}/4)`); }; t.raise(); });
        HUD.setObjective('Aim down sights and hit the 100-yard targets (0/4)');
        await S.until(() => n >= 4);
        await S.say('Hollis', 'Hear that ping when she runs dry? That’s your clip ejecting. So does every German within a hundred yards. You learn to count to eight, Private.');
      }
    },
    {
      async run(S) {
        const w = Player.cur();
        S.obj('Reload your rifle', null, null, w.mag < 8 ? 'Press R' : 'Fire a few rounds, then press R');
        S.hint('<kbd>R</kbd> to reload. A Garand reloads fastest when the clip is empty.', 7);
        const startRes = w.res;
        await S.until(() => VM.animName && VM.animName.startsWith('reload'));
        await S.until(() => !VM.busy());
        S.obj('Inspect your rifle', null, null, 'Press F');
        S.hint('<kbd>F</kbd> to inspect your weapon', 6);
        await S.until(() => VM.animName === 'inspect');
        await S.say('Hollis', 'That’s right, Kessler. Look at her. That rifle is your best girl now. You clean her, you oil her, you sleep with her.', 5);
        await S.until(() => !VM.busy());
        w.res = Math.max(w.res, 40); Player.updateHud();
        await S.say('Russo', 'Sarge, can I sleep with the Thompson instead?', 3);
        await S.say('Hollis', 'Russo, you can sleep in the latrine. Obstacle course, both of you. Move!', 3.5);
      }
    },
    {
      async run(S) {
        const R_ = S.get('Russo'); R_.goal = V3(36, 0, 8); R_.goalRun = true;
        S.obj('Run the obstacle course', V3(38, 1.2, 7), 'Start');
        S.hint('Hold <kbd>Shift</kbd> to sprint', 5);
        await S.reach(V3(38, 0, 7.5), 2.5);
        const t0 = Story.gameTime; let done = false;
        Story.until(() => { HUD.counter(((Story.gameTime - t0)).toFixed(1) + 's', 'Course time'); return done; });
        S.obj('Jump the logs', V3(38, 1, -8.5), 'Logs'); S.hint('<kbd>Space</kbd> to jump or vault', 5);
        await S.until(() => Player.pos.z < -7);
        S.obj('Crawl under the wire', V3(38, 0.8, -22), 'Wire'); S.hint('<kbd>C</kbd> or <kbd>Ctrl</kbd> to crouch', 5);
        await S.until(() => Player.pos.z < -20.5 && Math.abs(Player.pos.x - 38) < 5);
        S.obj('Vault the wall', V3(38, 1.4, -29), 'Wall'); S.hint('Run at the wall and press <kbd>Space</kbd> to vault', 5);
        await S.until(() => Player.pos.z < -27.6);
        S.obj('Finish', V3(38, 1.2, -35), 'Finish');
        await S.until(() => Player.pos.z < -33.5);
        done = true; const t = Story.gameTime - t0; HUD.counter(null);
        HUD.notify(`Course time ${t.toFixed(1)}s`);
        await S.say('Hollis', t < 26 ? 'Well, I’ll be. Somebody tell the Olympic committee.' : t < 40 ? 'Adequate. The Germans will be very impressed with adequate.' : 'My grandmother runs faster, Kessler, and she’s been dead since Coolidge.', 3.5);
      }
    },
    {
      cp: { pos: [-32, 0, 5.8], yaw: 0 },
      loadout: { weapons: [{ id: 'garand', res: 40 }], medkits: 0, nades: 0 },
      async run(S) {
        const H = S.get('Hollis'); H.pos.set(-29.5, terrainH(-29.5, 5), 5.5); H.place();
        S.obj('Go to the hand grenade court', V3(-32, 1.4, 5), 'Grenades');
        await S.reach(V3(-32, 0, 5.5), 3);
        Player.nades = 2; Player.updateHud();
        await S.say('Hollis', 'Mark Two fragmentation grenade. Pull the pin, throw it like you mean it, and don’t stand there admiring your work.');
        S.obj('Throw a grenade into the pit', V3(-32, 0.5, -16), 'Pit');
        S.hint('<kbd>G</kbd> to throw a grenade', 6);
        let ok = false;
        Actors.explosionHooks.push((p) => { if (Math.hypot(p.x + 32, p.z + 16) < 4.5) ok = true; });
        await S.until(() => ok || (Player.nades === 0 && Actors.grenades.length === 0 && !VM.busy()));
        if (!ok) { await S.say('Hollis', 'You missed a hole the size of a Buick. Again!', 3); Player.nades = 2; Player.updateHud(); await S.until(() => ok || (Player.nades === 0 && Actors.grenades.length === 0)); }
        if (!ok) { Player.nades = 3; Player.updateHud(); await S.until(() => ok); }
        await S.say('Hollis', 'In the hole. Congratulations, you have killed a pile of sand.', 3);
      }
    },
    {
      cp: { pos: [-35, 0, -42], yaw: 0 },
      loadout: { weapons: [{ id: 'garand', res: 40 }], medkits: 0, nades: 0 },
      async run(S) {
        const R_ = S.get('Russo'); R_.pos.set(-33, 0, -44); R_.place(); R_.goal = null;
        const H = S.get('Hollis'); H.pos.set(-35.5, 0, -46); H.place();
        S.obj('Take the Thompson from the table', V3(-37, 1.1, -49), 'Thompson');
        await S.say('Hollis', 'Village fighting. Close quarters. For this you want the Thompson submachine gun.', 3.5);
        await S.interact({ pos: V3(-37, 1.0, -49), text: 'Take M1A1 Thompson', r: 2.4 }).done;
        R.scene.remove(CAMP.tommy); Player.give('thompson', { res: 90 });
        S.hint('<kbd>1</kbd> / <kbd>2</kbd> or mouse wheel to switch weapons. The Thompson fires as long as you hold the trigger.', 7);
        await S.say('Russo', 'Aw, come on, why does he get the Tommy gun?', 2.6);
        await S.say('Hollis', 'Because he can hit things, Russo. Kessler — targets will pop in the village. Clear it. Clock’s running.', 4);
        S.obj('Clear the village', V3(-36, 1.2, -58), 'Village');
        let n = 0; const tot = CAMP.village.length; const t0 = Story.gameTime;
        CAMP.village.forEach((t, i) => { t.onHit = () => { n++; HUD.setObjective(`Clear the village (${n}/${tot})`); }; setTimeout(() => t.raise(), 200 + i * 150); });
        await S.until(() => { HUD.counter((Story.gameTime - t0).toFixed(1) + 's', 'Village time'); return n >= tot; });
        HUD.counter(null);
        const t = Story.gameTime - t0;
        await S.say('Hollis', t < 40 ? 'Clean. Real clean, Kessler.' : 'You’d be dead twice over, but the targets are down. Good enough for government work.', 3);
      }
    },
    {
      async run(S) {
        const H = S.get('Hollis'), R_ = S.get('Russo');
        S.obj('Report to Sergeant Hollis', () => H.pos.clone().add(V3(0, 1.9, 0)), 'Sgt. Hollis');
        await S.until(() => Player.pos.distanceTo(H.pos) < 3.5);
        S.clearObj(); Player.control = false;
        await S.say('Hollis', 'Kessler. Russo. Orders came down this morning. You two are going to the 29th Infantry Division.');
        await S.say('Russo', 'Where’s the 29th, Sarge?', 2.2);
        await S.say('Hollis', 'England. Where the boat goes after that, nobody’s saying. But you can bet it isn’t Coney Island.');
        await S.say('Hollis', 'You two listen to me. Out there the targets shoot back. Keep your heads down, keep your rifles clean, and keep each other alive. That’s the whole job.');
        await S.say('Russo', 'Same outfit, Danny. Told you.', 2.6);
        await S.fade(1, 2);
      }
    },
  ],
  outro: {
    letter: true, kicker: 'Somewhere in England — May 1944',
    lines: [
      'Dear Pop,',
      'Two years now. Two years of England — rain, mud, marching, and more rain. Frankie says the sun here is a rumor.',
      'They put us with a good bunch. Sergeant Mahoney — the boys call him Pops, never to his face — was a steelworker in Gary before all this. Ray Dupree is a Cajun from Lafayette who speaks better French than the French. Eli Weiss from Brooklyn carries the radio and a harmonica he can’t play. Doc Harlan is our medic. He says prayers under his breath when he thinks nobody’s listening.',
      'Something big is coming. I can’t say more. The watch still keeps perfect time.',
      'Your son, Danny',
    ], hold: 3,
  },
});
