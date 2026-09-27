'use strict';
/* =====================================================================
   Captured German weapons: Karabiner 98k and MP 40 (first-person
   models + animations), and world pickups for dropped weapons.
   ===================================================================== */

/* ---------------- Karabiner 98k ---------------- */
function buildKar98() {
  const g = new THREE.Group(), W = MAT.walnutDark, S = MAT.gunBlue, parts = {};
  gunExtrude([[0.42, 0.058], [0.18, 0.046], [0.08, 0.03], [-0.52, 0.03], [-0.535, 0.02], [-0.535, -0.004], [-0.2, -0.016], [-0.02, -0.022], [0.04, -0.036], [0.1, -0.052], [0.4, -0.112], [0.42, -0.112]], 0.042, W, g);
  vcylZ(0.0145, 0.0145, 0.22, S, g, 0, 0.05, -0.06);                       // receiver
  vcylZ(0.0095, 0.0085, 0.66, S, g, 0, 0.05, -0.5);                         // barrel
  const hg = vcylZ(0.016, 0.016, 0.24, W, g, 0, 0.06, -0.31); hg.scale.set(0.9, 0.7, 1);
  vbox(0.046, 0.05, 0.014, S, g, 0, 0.03, -0.3); vbox(0.044, 0.046, 0.014, S, g, 0, 0.028, -0.5);
  vbox(0.016, 0.012, 0.03, S, g, 0, 0.064, -0.8);                           // front sight base
  vbox(0.0026, 0.02, 0.004, S, g, 0, 0.077, -0.8);                          // post (top at .087)
  vbox(0.003, 0.022, 0.024, S, g, 0.009, 0.08, -0.8); vbox(0.003, 0.022, 0.024, S, g, -0.009, 0.08, -0.8); vbox(0.021, 0.003, 0.024, S, g, 0, 0.092, -0.8); // hood
  vbox(0.026, 0.012, 0.07, S, g, 0, 0.066, -0.15);                          // rear sight base
  vbox(0.009, 0.012, 0.004, S, g, 0.0075, 0.08, -0.12); vbox(0.009, 0.012, 0.004, S, g, -0.0075, 0.08, -0.12); vbox(0.024, 0.004, 0.004, S, g, 0, 0.074, -0.12);
  vbox(0.03, 0.01, 0.1, S, g, 0, -0.028, -0.04);                            // floorplate
  const tg = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0028, 6, 14), S); tg.rotation.y = Math.PI / 2; tg.position.set(0, -0.022, 0.03); g.add(tg);
  vbox(0.005, 0.02, 0.006, S, g, 0, -0.028, 0.026, 0.25, 0, 0);
  vbox(0.046, 0.16, 0.008, S, g, 0, -0.027, 0.422);                         // butt plate
  // bolt: pivots around the bore axis, rotates up then slides back
  const bolt = new THREE.Group(); bolt.position.set(0, 0.05, 0); g.add(bolt); parts.kbolt = bolt;
  vcylZ(0.0095, 0.0095, 0.1, S, bolt, 0, 0.005, 0.03);
  vcylZ(0.012, 0.012, 0.03, S, bolt, 0, 0.004, 0.09);                        // shroud
  const stem = vbox(0.036, 0.007, 0.008, S, bolt, 0.02, -0.012, 0.055, 0, 0, -0.75);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 12, 10), S); knob.position.set(0.036, -0.03, 0.058); bolt.add(knob);
  // stripper clip (5 rounds)
  const strip = new THREE.Group(); g.add(strip); parts.strip = strip;
  vbox(0.004, 0.012, 0.05, MAT.gunSteel, strip, 0, 0.004, 0);
  for (let i = 0; i < 5; i++) { const c = cartridge(strip, 0, -0.012, 0); c.rotation.x = -Math.PI / 2; c.position.set(0, -0.035, -0.02 + i * 0.01); }
  strip.visible = false;
  slingTube([[-0.022, -0.01, -0.3], [-0.024, -0.07, -0.15], [-0.024, -0.12, 0.1], [-0.022, -0.09, 0.3]], MAT.sling, g);
  return {
    id: 'kar98', g, parts,
    anchors: { gripR: V3(0.031, 0.03, 0.12), gripL: V3(-0.03, -0.036, -0.32), sight: V3(0, 0.086, -0.12), muzzle: V3(0, 0.05, -0.84), eject: V3(0.02, 0.07, -0.02), clipSlot: V3(0, 0.1, -0.03) },
    hip: V3(0.13, -0.15, -0.33), hipRot: V3(0, 0.035, 0), adsDist: 0.46,
    handR: handBasis([0, -0.86, -0.5], [-1, 0, 0]), handL: handBasis([1, 0, 0], [0, 1, 0]),
  };
}
/* ---------------- MP 40 ---------------- */
function buildMP40() {
  const g = new THREE.Group(), S = MAT.gunBlack, parts = {};
  vcylZ(0.018, 0.018, 0.3, S, g, 0, 0.05, -0.06);                          // receiver tube
  vbox(0.032, 0.036, 0.2, S, g, 0, 0.018, -0.03);                           // lower frame
  vbox(0.03, 0.105, 0.046, MAT.grip, g, 0, -0.04, 0.052, -0.26, 0, 0);       // bakelite grip
  const tg = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0028, 6, 14), S); tg.rotation.y = Math.PI / 2; tg.position.set(0, -0.004, 0.01); g.add(tg);
  vbox(0.005, 0.018, 0.006, S, g, 0, -0.01, 0.008, 0.25, 0, 0);
  vcylZ(0.011, 0.011, 0.26, S, g, 0, 0.05, -0.34);                          // barrel
  vbox(0.012, 0.02, 0.05, S, g, 0, 0.032, -0.42);                           // barrel rest
  vbox(0.034, 0.07, 0.044, S, g, 0, -0.02, -0.14);                          // magazine well
  vbox(0.012, 0.024, 0.006, S, g, 0, 0.074, -0.44); vbox(0.003, 0.018, 0.006, S, g, 0, 0.078, -0.44); // front sight
  vbox(0.022, 0.012, 0.012, S, g, 0, 0.072, 0.04); vbox(0.004, 0.008, 0.004, S, g, 0.007, 0.08, 0.04); vbox(0.004, 0.008, 0.004, S, g, -0.007, 0.08, 0.04);
  // folding stock (tubes + butt plate)
  for (const sx of [-1, 1]) vcylZ(0.006, 0.006, 0.36, S, g, sx * 0.018, 0.02, 0.27);
  vbox(0.05, 0.11, 0.022, S, g, 0, -0.01, 0.45);
  // magazine
  const mag = new THREE.Group(); mag.position.set(0, -0.04, -0.14); g.add(mag); parts.mag = mag;
  vbox(0.024, 0.25, 0.032, S, mag, 0, -0.12, 0); vbox(0.026, 0.01, 0.036, S, mag, 0, -0.245, 0);
  parts.magTop = cartridge(mag, 0, 0.004, 0, false);
  // cocking handle (left side)
  const bolt = new THREE.Group(); g.add(bolt); parts.bolt = bolt;
  vbox(0.012, 0.008, 0.012, S, bolt, -0.024, 0.056, -0.07); const k = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), S); k.position.set(-0.033, 0.056, -0.07); bolt.add(k);
  slingTube([[0, -0.02, -0.3], [0.02, -0.08, -0.1], [0.02, -0.12, 0.2], [0, -0.06, 0.42]], MAT.leather, g);
  return {
    id: 'mp40', g, parts,
    anchors: { gripR: V3(0.03, 0.012, 0.075), gripL: V3(-0.03, -0.075, -0.14), sight: V3(0, 0.083, 0.04), muzzle: V3(0, 0.05, -0.47), eject: V3(0.02, 0.06, -0.05), magSlot: V3(0, -0.04, -0.14) },
    hip: V3(0.12, -0.14, -0.29), hipRot: V3(0, 0.04, 0), adsDist: 0.28, magHandOff: V3(0, 0.2, 0),
    handR: handBasis([0, -0.95, -0.3], [-1, 0, 0]), handL: handBasis([1, 0, 0], [0, 1, 0]),
  };
}

/* ---------------- animations ---------------- */
const KB = [0.034, 0.03, 0.06];     // wrist near the bolt knob (closed)
const KBU = [0.03, 0.058, 0.06];    // knob rotated up
const KBB = [0.03, 0.058, 0.145];   // knob pulled back
ANIMS.kar98 = {
  draw: { dur: 0.6, gun: [[0, 0.02, -0.28, 0.06, -0.9, 0.2, 0.4], [0.6, ...Z6]], ev: [[0.05, 'cloth'], [0.35, 'tap']] },
  holster: { dur: 0.35, gun: [[0, ...Z6], [0.35, 0.02, -0.3, 0.06, -0.9, 0.2, 0.4]] },
  bolt: {
    dur: 0.9,
    gun: [[0, ...Z6], [0.14, -0.005, 0.012, 0.03, 0.06, 0.06, 0.22], [0.62, -0.005, 0.012, 0.03, 0.06, 0.06, 0.22], [0.9, ...Z6]],
    rh: [[0, 0, ...KB], [0.12, 1, ...KB], [0.22, 1, ...KBU], [0.4, 1, ...KBB], [0.52, 1, ...KBU], [0.62, 1, ...KB], [0.8, 0, ...KB]],
    parts: { boltRot: [[0.12, 0], [0.22, 1], [0.52, 1], [0.62, 0]], boltPull: [[0.22, 0], [0.4, 1], [0.52, 0]] },
    ev: [[0.2, 'boltUp'], [0.38, 'eject'], [0.52, 'boltFwd']]
  },
  reload: {
    dur: 2.7,
    gun: [[0, ...Z6], [0.3, -0.03, 0.04, 0.03, 0.14, 0.2, 0.5], [2.1, -0.03, 0.045, 0.03, 0.16, 0.2, 0.52], [2.6, ...Z6]],
    rh: [[0, 0, ...KB], [0.15, 1, ...KB], [0.3, 1, ...KBU], [0.5, 1, ...KBB], [1.75, 1, ...KBB], [1.9, 1, ...KBU], [2.02, 1, ...KB], [2.3, 0, ...KB]],
    lh: [[0, 0, -0.03, -0.036, -0.32], [0.25, 1, -0.02, -0.14, -0.2], [0.6, 1, 0.03, -0.4, 0.05], [0.95, 1, 0.0, 0.04, -0.03], [1.12, 1, 0.0, 0.16, -0.03], [1.45, 1, 0.0, 0.09, -0.03], [1.6, 1, 0.02, 0.15, -0.02], [2.1, 1, -0.03, -0.036, -0.32], [2.3, 0, -0.03, -0.036, -0.32]],
    parts: { boltRot: [[0.15, 0], [0.3, 1], [1.9, 1], [2.02, 0]], boltPull: [[0.3, 0], [0.5, 1], [1.75, 1], [1.9, 0]] },
    ev: [[0.08, 'cloth'], [0.3, 'boltUp'], [0.5, 'boltBack'], [0.8, 'stripHand'], [1.3, 'clipIn'], [1.45, 'refill'], [1.55, 'stripOff'], [1.9, 'boltFwd']]
  },
  inspect: {
    dur: 3.4,
    gun: [[0, ...Z6], [0.5, -0.11, 0.07, 0.07, 0.22, 0.95, -0.85], [1.4, -0.1, 0.075, 0.065, 0.26, 0.9, -0.8], [1.9, -0.07, 0.06, 0.05, 0.12, 0.55, 0.85], [2.7, -0.07, 0.065, 0.05, 0.14, 0.5, 0.82], [3.4, ...Z6]],
    rh: [[0, 0, ...KB], [2.0, 0, ...KB], [2.15, 1, ...KB], [2.3, 1, ...KBU], [2.45, 1, 0.03, 0.058, 0.1], [2.6, 1, ...KBU], [2.72, 1, ...KB], [2.9, 0, ...KB]],
    parts: { boltRot: [[2.15, 0], [2.3, 1], [2.6, 1], [2.72, 0]], boltPull: [[2.3, 0], [2.45, 0.5], [2.6, 0]] },
    ev: [[0.1, 'cloth'], [2.3, 'boltUp'], [2.45, 'boltBack'], [2.62, 'boltFwd'], [3.0, 'cloth']]
  },
};
ANIMS.kar98.reloadEmpty = ANIMS.kar98.reload;
ANIMS.mp40 = {
  draw: { dur: 0.55, gun: [[0, 0.02, -0.26, 0.06, -0.9, 0.2, 0.4], [0.55, ...Z6]], ev: [[0.05, 'cloth'], [0.3, 'tap']] },
  holster: { dur: 0.35, gun: [[0, ...Z6], [0.35, 0.02, -0.3, 0.06, -0.9, 0.2, 0.4]] },
  reloadEmpty: {
    dur: 2.5,
    gun: [[0, ...Z6], [0.3, 0.02, 0.035, 0.02, 0.1, -0.18, -0.45], [1.4, 0.02, 0.04, 0.02, 0.12, -0.2, -0.5], [1.5, 0.015, 0.03, 0.03, 0.08, -0.18, -0.4], [1.62, 0.0, 0.03, 0.02, 0.08, -0.3, -0.5], [2.0, 0.0, 0.03, 0.02, 0.08, -0.3, -0.5], [2.45, ...Z6]],
    lh: [[0, 0, -0.03, -0.075, -0.14], [0.2, 1, -0.02, -0.26, -0.14], [0.34, 1, -0.02, -0.26, -0.14], [0.5, 1, -0.02, -0.42, -0.14], [0.85, 1, 0.03, -0.55, 0.08], [1.12, 1, -0.02, -0.42, -0.14], [1.34, 1, -0.02, -0.265, -0.14], [1.46, 1, -0.02, -0.28, -0.14], [1.72, 1, -0.05, 0.05, -0.07], [1.86, 1, -0.05, 0.05, 0.01], [1.98, 1, -0.05, 0.05, 0.01], [2.25, 1, -0.03, -0.075, -0.14], [2.35, 0, -0.03, -0.075, -0.14]],
    parts: { bolt: [[0, 0], [1.74, 0], [1.86, 1]] },
    ev: [[0.08, 'cloth'], [0.34, 'magHand'], [0.36, 'magOut'], [0.52, 'magDrop'], [0.95, 'magNew'], [1.34, 'magSeat'], [1.35, 'magIn'], [1.36, 'refill'], [1.86, 'boltBack']]
  },
  reload: {
    dur: 2.05,
    gun: [[0, ...Z6], [0.3, 0.02, 0.035, 0.02, 0.1, -0.18, -0.45], [1.4, 0.02, 0.04, 0.02, 0.12, -0.2, -0.5], [1.5, 0.015, 0.03, 0.03, 0.08, -0.18, -0.4], [1.95, ...Z6]],
    lh: [[0, 0, -0.03, -0.075, -0.14], [0.2, 1, -0.02, -0.26, -0.14], [0.34, 1, -0.02, -0.26, -0.14], [0.5, 1, -0.02, -0.42, -0.14], [0.85, 1, 0.03, -0.55, 0.08], [1.12, 1, -0.02, -0.42, -0.14], [1.34, 1, -0.02, -0.265, -0.14], [1.46, 1, -0.02, -0.28, -0.14], [1.8, 1, -0.03, -0.075, -0.14], [1.9, 0, -0.03, -0.075, -0.14]],
    ev: [[0.08, 'cloth'], [0.34, 'magHand'], [0.36, 'magOut'], [0.52, 'magDrop'], [0.95, 'magNew'], [1.34, 'magSeat'], [1.35, 'magIn'], [1.36, 'refill']]
  },
  inspect: {
    dur: 3.2,
    gun: [[0, ...Z6], [0.5, -0.1, 0.06, 0.06, 0.2, 0.9, -0.9], [1.4, -0.09, 0.065, 0.06, 0.24, 0.85, -0.85], [1.9, -0.06, 0.05, 0.04, 0.1, 0.5, 0.8], [2.6, -0.06, 0.055, 0.04, 0.12, 0.45, 0.78], [3.2, ...Z6]],
    lh: [[0, 0, -0.03, -0.075, -0.14], [2.0, 0, -0.03, -0.075, -0.14], [2.15, 1, -0.02, -0.34, -0.14], [2.3, 1, -0.02, -0.32, -0.14], [2.4, 1, -0.02, -0.34, -0.14], [2.7, 0, -0.03, -0.075, -0.14]],
    ev: [[0.1, 'cloth'], [2.3, 'tap'], [2.9, 'cloth']]
  },
};

/* =====================================================================
   Weapon pickups (dropped by the enemy or by the player)
   ===================================================================== */
const Pickups = {
  list: [],
  clear() { this.list = []; },
  add(mesh, type, ammo) {
    if (!WDEF[type]) return;
    const D = WDEF[type];
    const p = { m: mesh, type, mag: ammo ? ammo.mag : D.mag, res: ammo ? ammo.res : Math.max(D.mag * randi(1, 2), 20), enabled: true, r: 2.0, cone: 0.35, hold: 0 };
    p.pos = () => p.m.position.clone().add(V3(0, 0.15, 0));
    Object.defineProperty(p, 'text', { get: () => Player.weapons.some(w => w.id === type) ? `take ${WDEF[type].name} ammunition` : `pick up ${WDEF[type].name}` });
    p.use = () => this.use(p);
    this.list.push(p);
    if (this.list.length > 30) { const o = this.list.shift(); if (o.m.parent) o.m.parent.remove(o.m); }
    if (!this.hinted && Player.alive) { this.hinted = true; }
    return p;
  },
  use(p) {
    const P = Player, D = WDEF[p.type];
    const have = P.weapons.find(w => w.id === p.type);
    if (have) {
      have.res = Math.min(D.maxRes, have.res + p.mag + p.res); SFX.mech('pickup'); HUD.notify(`${D.name} ammunition`);
    } else {
      const nw = { id: p.type, mag: p.mag, res: p.res };
      if (P.weapons.length < 2) { P.weapons.push(nw); SFX.mech('pickup'); P.switchTo(P.weapons.length - 1); }
      else {
        const old = P.weapons[P.wi];
        const g = makeNpcGun(old.id); g.position.copy(P.pos).add(V3(-Math.sin(P.yaw) * 0.8, 0.06, -Math.cos(P.yaw) * 0.8)); g.position.y = groundAt(g.position.x, g.position.z, P.pos.y + 0.5) + 0.05; g.rotation.set(0, rand(0, TAU), Math.PI / 2); R.scene.add(g);
        this.add(g, old.id, { mag: old.mag, res: old.res });
        P.weapons[P.wi] = nw; SFX.mech('pickup'); VM.cancel(); VM.equip(nw.id); P.fireCd = 0.45;
      }
      HUD.notify(D.name);
    }
    P.updateHud();
    p.enabled = false; if (p.m.parent) p.m.parent.remove(p.m);
    this.list = this.list.filter(x => x !== p);
  }
};
