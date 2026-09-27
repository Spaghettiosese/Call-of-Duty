'use strict';
/* =====================================================================
   Models: humans (procedural rig with arm IK), NPC weapons, vehicles
   ===================================================================== */
const GEO = {};
function geo(key, fn) { let g = GEO[key]; if (!g) { g = GEO[key] = fn(); g.userData.shared = true; } return g; }
function cyl(rt, rb, h, seg = 10, pivotTop = true) { const g = new THREE.CylinderGeometry(rt, rb, h, seg); if (pivotTop) g.translate(0, -h / 2, 0); return g; }
function mesh(g, m, parent, x = 0, y = 0, z = 0, o = {}) {
  const me = new THREE.Mesh(g, m); me.position.set(x, y, z);
  if (o.s) me.scale.set(...o.s); if (o.r) me.rotation.set(...o.r);
  me.castShadow = o.cast !== false; me.receiveShadow = o.receive !== false;
  if (parent) parent.add(me); return me;
}
function boxG(w, h, d) { return geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)); }
function cylG(rt, rb, h, seg = 10, top = true) { return geo(`c${rt},${rb},${h},${seg},${top}`, () => cyl(rt, rb, h, seg, top)); }
function sphG(r, ws = 12, hs = 10) { return geo(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs)); }

/* ---------------- helmets ---------------- */
function helmetUS() {
  return geo('helmUS', () => {
    const pts = [[0, 0.135], [0.05, 0.132], [0.09, 0.118], [0.12, 0.095], [0.138, 0.06], [0.147, 0.02], [0.152, -0.01], [0.158, -0.022], [0.16, -0.026]].map(p => new THREE.Vector2(p[0], p[1]));
    const g = new THREE.LatheGeometry(pts, 20); g.scale(1, 1, 1.1); return g;
  });
}
function helmetDE() {
  return geo('helmDE', () => {
    const pts = [[0, 0.14], [0.05, 0.137], [0.09, 0.122], [0.118, 0.095], [0.134, 0.06], [0.14, 0.025], [0.142, 0.0], [0.15, -0.01], [0.165, -0.035], [0.172, -0.06], [0.175, -0.07]].map(p => new THREE.Vector2(p[0], p[1]));
    const g = new THREE.LatheGeometry(pts, 20); g.scale(0.95, 1, 1.08); return g;
  });
}

/* ---------------- human rig ---------------- */
const L_UP = 0.3, L_FORE = 0.28, L_THIGH = 0.45, L_SHIN = 0.43;
function makeHuman(o = {}) {
  const side = o.side || 'us';
  const skin = o.skin || MAT.skins[o.skinI == null ? randi(0, 4) : o.skinI];
  const jacket = o.jacket || (side === 'us' ? MAT.usJacket : side === 'de' ? MAT.deTunic : MAT.civCoat);
  const pants = o.pants || (side === 'us' ? MAT.usPants : side === 'de' ? MAT.dePants : MAT.civSuit);
  const sleeve = o.sleeve || jacket;
  const root = new THREE.Group(); root.userData.isHuman = true;
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  mesh(cylG(0.165, 0.155, 0.24, 12, false), pants, hips, 0, 0, 0, { s: [1, 1, 0.68] });
  const torso = new THREE.Group(); torso.position.y = 0.06; hips.add(torso);
  const chest = mesh(cylG(0.19, 0.165, 0.54, 12, false), jacket, torso, 0, 0.29, 0, { s: [1, 1, 0.62] });
  mesh(cylG(0.14, 0.19, 0.1, 12, false), jacket, torso, 0, 0.58, 0, { s: [1, 1, 0.62] }); // shoulders slope
  if (o.skirt) mesh(cylG(0.17, 0.3, 0.55, 14, false), o.skirt, hips, 0, -0.3, 0, { s: [1, 1, 0.8] });
  // neck & head
  mesh(cylG(0.052, 0.058, 0.12, 8, false), skin, torso, 0, 0.64, 0);
  const head = new THREE.Group(); head.position.set(0, 0.68, 0.01); torso.add(head);
  mesh(sphG(0.108, 16, 12), skin, head, 0, 0.1, 0, { s: [0.9, 1.1, 1] });
  mesh(boxG(0.13, 0.06, 0.1), skin, head, 0, 0.035, 0.03); // jaw
  mesh(boxG(0.024, 0.045, 0.03), skin, head, 0, 0.095, 0.105, { r: [-0.2, 0, 0] });
  mesh(sphG(0.026, 8, 6), skin, head, 0.098, 0.1, 0, { s: [0.5, 1, 0.8] }); mesh(sphG(0.026, 8, 6), skin, head, -0.098, 0.1, 0, { s: [0.5, 1, 0.8] });
  mesh(sphG(0.012, 6, 5), MAT.eye, head, 0.034, 0.124, 0.093, { cast: false }); mesh(sphG(0.012, 6, 5), MAT.eye, head, -0.034, 0.124, 0.093, { cast: false });
  const hair = o.hair || MAT.hairBrown;
  mesh(boxG(0.034, 0.008, 0.01), hair, head, 0.034, 0.146, 0.1, { cast: false }); mesh(boxG(0.034, 0.008, 0.01), hair, head, -0.034, 0.146, 0.1, { cast: false });
  if (o.mustache) mesh(boxG(0.05, 0.012, 0.012), hair, head, 0, 0.068, 0.108, { cast: false });
  if (o.female) { mesh(sphG(0.118, 14, 10), hair, head, 0, 0.13, -0.02, { s: [1, 1, 1.05] }); mesh(sphG(0.09, 10, 8), hair, head, 0, 0.05, -0.08); }
  const hat = o.hat == null ? (side === 'us' ? 'us' : side === 'de' ? 'de' : 'hair') : o.hat;
  if (hat !== 'none' && !o.female) mesh(sphG(0.112, 14, 8), hair, head, 0, 0.125, -0.012, { s: [0.97, 0.85, 1.02] });
  let helmet = null;
  if (hat === 'us') {
    helmet = new THREE.Group(); helmet.position.set(0, 0.13, -0.005); head.add(helmet);
    mesh(helmetUS(), MAT.usHelmet, helmet); if (o.net) mesh(helmetUS(), MAT.usNet, helmet, 0, 0.004, 0, { s: [1.03, 1.03, 1.03], cast: false });
    mesh(boxG(0.01, 0.09, 0.012), MAT.webbing, helmet, 0.105, -0.06, 0.03, { cast: false, r: [0, 0, 0.12] }); mesh(boxG(0.01, 0.09, 0.012), MAT.webbing, helmet, -0.105, -0.06, 0.03, { cast: false, r: [0, 0, -0.12] });
  } else if (hat === 'de') {
    helmet = new THREE.Group(); helmet.position.set(0, 0.125, -0.012); head.add(helmet); mesh(helmetDE(), MAT.deHelmet, helmet);
  } else if (hat === 'cap') { // garrison / flat cap
    mesh(cylG(0.12, 0.125, 0.06, 14, false), o.capMat || MAT.civCoatGrey, head, 0, 0.19, -0.005, { s: [1, 1, 1.05] }); mesh(boxG(0.16, 0.012, 0.08), o.capMat || MAT.civCoatGrey, head, 0, 0.17, 0.1);
  } else if (hat === 'fedora') {
    mesh(cylG(0.1, 0.12, 0.1, 14, false), MAT.civSuit, head, 0, 0.225, -0.005); mesh(cylG(0.19, 0.19, 0.012, 16, false), MAT.civSuit, head, 0, 0.18, -0.005);
  } else if (hat === 'campaign') { // drill sergeant's campaign hat
    mesh(new THREE.ConeGeometry(0.11, 0.14, 4), MAT.khaki, head, 0, 0.26, 0, { r: [0, Math.PI / 4, 0] }); mesh(cylG(0.22, 0.22, 0.012, 20, false), MAT.khaki, head, 0, 0.19, 0);
  } else if (hat === 'garrison') {
    mesh(boxG(0.12, 0.05, 0.24), o.capMat || MAT.usJacket, head, 0, 0.215, -0.01);
  }
  // arms
  const mkArm = (sx) => {
    const sh = new THREE.Group(); sh.position.set(0.2 * sx, 0.55, 0); torso.add(sh);
    mesh(cylG(0.062, 0.052, L_UP), sleeve, sh);
    const el = new THREE.Group(); el.position.y = -L_UP; sh.add(el);
    mesh(cylG(0.052, 0.045, L_FORE), sleeve, el);
    const hand = mesh(boxG(0.07, 0.09, 0.035), skin, el, 0, -L_FORE - 0.04, 0.01);
    mesh(boxG(0.025, 0.05, 0.025), skin, el, -0.035 * sx, -L_FORE - 0.02, 0.03);
    return { sh, el, hand, sx };
  };
  const armR = mkArm(-1), armL = mkArm(1);
  // legs
  const mkLeg = (sx) => {
    const hip = new THREE.Group(); hip.position.set(0.095 * sx, -0.04, 0); hips.add(hip);
    mesh(cylG(0.088, 0.066, L_THIGH), pants, hip);
    const knee = new THREE.Group(); knee.position.y = -L_THIGH; hip.add(knee);
    mesh(cylG(0.064, 0.05, L_SHIN), side === 'de' ? MAT.bootBlack : pants, knee);
    if (side === 'us') mesh(cylG(0.068, 0.06, 0.24), MAT.legging, knee, 0, -0.18, 0);
    if (side === 'de') mesh(cylG(0.07, 0.062, 0.3), MAT.bootBlack, knee, 0, -0.12, 0);
    const foot = mesh(boxG(0.1, 0.085, 0.26), side === 'de' ? MAT.bootBlack : side === 'us' ? MAT.boot : MAT.leather, knee, 0, -L_SHIN - 0.03, 0.05);
    return { hip, knee, foot };
  };
  const legR = mkLeg(-1), legL = mkLeg(1);
  // gear
  if (side === 'us' && o.gear !== false) {
    mesh(cylG(0.172, 0.172, 0.06, 12, false), MAT.webbing, torso, 0, 0.02, 0, { s: [1, 1, 0.66] });
    for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; mesh(boxG(0.06, 0.075, 0.035), MAT.webbing, torso, Math.sin(a) * 0.17, 0.02, Math.cos(a) * 0.115, { r: [0, a, 0] }); }
    mesh(boxG(0.04, 0.5, 0.012), MAT.webbing, torso, 0.1, 0.3, 0.115, { r: [0, 0, 0.12] }); mesh(boxG(0.04, 0.5, 0.012), MAT.webbing, torso, -0.1, 0.3, 0.115, { r: [0, 0, -0.12] });
    mesh(boxG(0.28, 0.3, 0.1), MAT.webbing, torso, 0, 0.36, -0.15); // pack
    mesh(cylG(0.045, 0.045, 0.14, 8, false), MAT.od, torso, 0.16, -0.04, -0.08); // canteen
    if (o.shovel !== false) mesh(boxG(0.12, 0.2, 0.03), MAT.webbing, torso, 0, 0.14, -0.22);
  }
  if (side === 'de' && o.gear !== false) {
    mesh(cylG(0.172, 0.172, 0.055, 12, false), MAT.leather, torso, 0, 0.02, 0, { s: [1, 1, 0.66] });
    mesh(boxG(0.1, 0.07, 0.04), MAT.leather, torso, 0.08, 0.02, 0.115); mesh(boxG(0.1, 0.07, 0.04), MAT.leather, torso, -0.08, 0.02, 0.115);
    mesh(boxG(0.03, 0.5, 0.012), MAT.leather, torso, 0.08, 0.3, 0.115, { r: [0, 0, 0.1] }); mesh(boxG(0.03, 0.5, 0.012), MAT.leather, torso, -0.08, 0.3, 0.115, { r: [0, 0, -0.1] });
    const gm = mesh(cylG(0.055, 0.055, 0.26, 10, false), MAT.fgrey, torso, 0.1, 0.02, -0.14, { r: [0, 0, 0.3] }); // gas mask canister
    mesh(boxG(0.18, 0.16, 0.06), MAT.webbing, torso, -0.12, -0.08, -0.08); // bread bag
  }
  if (o.apron) mesh(boxG(0.3, 0.55, 0.01), MAT.apron, torso, 0, 0.1, 0.12);
  if (o.tie) mesh(boxG(0.04, 0.26, 0.01), o.tie, torso, 0, 0.42, 0.118);
  const h = { root, hips, torso, head, helmet, armR, armL, legR, legL, phase: Math.random() * 10, gun: null, gunType: null, side, t: 0, aimW: 0, crouchW: 0, gesture: 0, lookYaw: 0, lookPitch: 0 };
  if (o.weapon) attachGun(h, o.weapon);
  root.traverse(m => { if (m.isMesh) m.userData.human = h; });
  return h;
}

/* ---------------- NPC guns (origin at grip, +Z forward) ---------------- */
function makeNpcGun(type) {
  const g = new THREE.Group(); let fore = V3(0, -0.01, 0.3), muzzle = V3(0, 0.05, 0.75);
  const W = MAT.walnut, S = MAT.gunSteel, B = MAT.gunBlack;
  if (type === 'garand' || type === 'kar98') {
    const wood = type === 'kar98' ? MAT.walnutDark : W;
    mesh(boxG(0.045, 0.1, 0.32), wood, g, 0, -0.025, -0.2, { r: [0.12, 0, 0] });
    mesh(boxG(0.042, 0.055, 0.62), wood, g, 0, 0.02, 0.26);
    mesh(boxG(0.034, 0.04, 0.24), S, g, 0, 0.05, 0.02);
    mesh(cylG(0.011, 0.011, 0.5, 6, false), S, g, 0, 0.055, 0.6, { r: [Math.PI / 2, 0, 0] });
    if (type === 'kar98') { mesh(cylG(0.008, 0.008, 0.06, 6, false), S, g, 0.035, 0.06, 0.02, { r: [0, 0, Math.PI / 2] }); mesh(sphG(0.012, 6, 5), S, g, 0.065, 0.05, 0.02); }
    muzzle = V3(0, 0.055, 0.85); fore = V3(0, -0.005, 0.32);
  } else if (type === 'thompson') {
    mesh(boxG(0.05, 0.07, 0.3), B, g, 0, 0.04, 0.05); mesh(cylG(0.012, 0.012, 0.3, 6, false), B, g, 0, 0.05, 0.35, { r: [Math.PI / 2, 0, 0] });
    mesh(boxG(0.04, 0.09, 0.3), W, g, 0, 0.0, -0.22, { r: [0.1, 0, 0] }); mesh(boxG(0.03, 0.2, 0.035), B, g, 0, -0.08, 0.1); mesh(boxG(0.035, 0.05, 0.12), W, g, 0, -0.01, 0.28);
    muzzle = V3(0, 0.05, 0.5); fore = V3(0, -0.02, 0.28);
  } else if (type === 'mp40') {
    mesh(boxG(0.04, 0.05, 0.3), B, g, 0, 0.04, 0.08); mesh(cylG(0.013, 0.013, 0.26, 6, false), B, g, 0, 0.045, 0.34, { r: [Math.PI / 2, 0, 0] });
    mesh(boxG(0.03, 0.2, 0.03), B, g, 0, -0.08, 0.2, { r: [0.12, 0, 0] }); mesh(boxG(0.03, 0.1, 0.04), MAT.grip, g, 0, -0.03, -0.02, { r: [0.25, 0, 0] });
    mesh(boxG(0.02, 0.02, 0.26), B, g, 0, 0.04, -0.18);
    muzzle = V3(0, 0.045, 0.48); fore = V3(0, -0.06, 0.2);
  } else if (type === 'mg42') {
    mesh(boxG(0.06, 0.08, 0.45), B, g, 0, 0.04, 0.08); mesh(cylG(0.03, 0.03, 0.55, 10, false), B, g, 0, 0.05, 0.55, { r: [Math.PI / 2, 0, 0] });
    mesh(boxG(0.05, 0.1, 0.28), B, g, 0, 0.0, -0.26); mesh(boxG(0.03, 0.09, 0.04), MAT.grip, g, 0, -0.04, 0);
    mesh(boxG(0.1, 0.06, 0.14), MAT.od, g, -0.08, 0.02, 0.12);
    const bip = new THREE.Group(); bip.position.set(0, 0.03, 0.72); g.add(bip);
    mesh(cylG(0.008, 0.008, 0.35, 5), S, bip, 0, 0, 0, { r: [0, 0, 0.35] }); mesh(cylG(0.008, 0.008, 0.35, 5), S, bip, 0, 0, 0, { r: [0, 0, -0.35] });
    muzzle = V3(0, 0.05, 0.85); fore = V3(0, -0.02, -0.2);
  } else if (type === 'bazooka' || type === 'satchel') {
    mesh(boxG(0.2, 0.15, 0.08), MAT.webbing, g, 0, 0, 0);
  }
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  g.userData = { fore, muzzle, type };
  return g;
}
function attachGun(h, type) {
  if (h.gun) h.torso.remove(h.gun);
  h.gunType = type; if (!type) { h.gun = null; return; }
  h.gun = makeNpcGun(type); h.torso.add(h.gun);
}

/* ---------------- two-bone IK for arms (torso space) ---------------- */
const _ik = { d: V3(), p: V3(), e: V3(), u: V3(), l: V3(), q1: new THREE.Quaternion(), q2: new THREE.Quaternion(), down: V3(0, -1, 0) };
function solveArm(arm, target, pole) {
  const S = arm.sh.position, K = _ik;
  K.d.copy(target).sub(S); let len = K.d.length(); const max = (L_UP + L_FORE + 0.06) * 0.999;
  if (len > max) { K.d.multiplyScalar(max / len); len = max; } if (len < 0.08) len = 0.08;
  const L1 = L_UP, L2 = L_FORE + 0.06;
  const dir = K.d.clone().divideScalar(len);
  const a = (L1 * L1 - L2 * L2 + len * len) / (2 * len), hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  K.p.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
  K.e.copy(S).addScaledVector(dir, a).addScaledVector(K.p, hh);
  K.u.copy(K.e).sub(S).normalize(); K.q1.setFromUnitVectors(K.down, K.u); arm.sh.quaternion.copy(K.q1);
  K.l.copy(S).add(K.d).sub(K.e).normalize(); K.q2.setFromUnitVectors(K.down, K.l);
  arm.el.quaternion.copy(K.q1).invert().multiply(K.q2);
}
const POLE_R = V3(-0.8, -1, -0.3).normalize(), POLE_L = V3(0.8, -1, -0.2).normalize();
const _gp = { aimP: V3(-0.06, 0.47, 0.2), lowP: V3(-0.02, 0.26, 0.24), q: new THREE.Quaternion(), qa: new THREE.Quaternion(), ql: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.55, 0.45, 0.1)), t: V3(), f: V3() };
function legDrop(a, k) { return L_THIGH * Math.cos(a) + (L_SHIN + 0.05) * Math.cos(a + k); }

/* s: {speed, crouch, aim, pitch, dt, gesture} */
function animHuman(h, dt, s) {
  h.t += dt;
  const speed = s.speed || 0, amp = clamp(speed / 3.6, 0, 1.15);
  h.phase += dt * (speed * 2.3 + (speed > 0.1 ? 1.5 : 0));
  h.crouchW = damp(h.crouchW, s.crouch || 0, 8, dt); h.aimW = damp(h.aimW, s.aim || 0, 7, dt);
  const cw = h.crouchW, sw = Math.sin(h.phase);
  const base = -cw * 1.25;
  const aL = base + sw * 0.6 * amp, aR = base - sw * 0.6 * amp;
  const kL = cw * 1.9 + (0.1 + Math.max(0, Math.sin(h.phase + 1.4))) * amp * 1.0, kR = cw * 1.9 + (0.1 + Math.max(0, Math.sin(h.phase + 1.4 + Math.PI))) * amp * 1.0;
  h.legL.hip.rotation.x = aL; h.legL.knee.rotation.x = kL; h.legR.hip.rotation.x = aR; h.legR.knee.rotation.x = kR;
  h.legL.foot.rotation.x = -(aL + kL) * 0.5; h.legR.foot.rotation.x = -(aR + kR) * 0.5;
  const drop = Math.max(legDrop(aL, kL), legDrop(aR, kR));
  h.hips.position.y = drop + 0.1 + Math.sin(h.t * 1.7) * 0.004;
  h.hips.rotation.y = sw * 0.08 * amp;
  const breathe = Math.sin(h.t * 1.9) * 0.012;
  h.torso.rotation.x = cw * 0.35 + amp * 0.12 - (s.pitch || 0) * 0.45 * h.aimW + breathe;
  h.torso.rotation.y = -sw * 0.06 * amp;
  h.head.rotation.x = -(s.pitch || 0) * 0.4 * h.aimW - cw * 0.2 + (s.headPitch || 0);
  h.head.rotation.y = damp(h.head.rotation.y, h.lookYaw || 0, 4, dt);
  // gun placement & arms
  if (h.gun) {
    const P = _gp; P.t.lerpVectors(P.lowP, P.aimP, h.aimW);
    P.q.copy(P.ql).slerp(P.qa, h.aimW);
    if (s.recoil) P.t.z -= s.recoil * 0.05;
    h.gun.position.copy(P.t); h.gun.quaternion.copy(P.q);
    if (h.gunType === 'mg42' && s.prone) { h.gun.position.set(-0.05, 0.3, 0.35); h.gun.quaternion.identity(); }
    solveArm(h.armR, h.gun.position.clone(), POLE_R);
    P.f.copy(h.gun.userData.fore).applyQuaternion(h.gun.quaternion).add(h.gun.position);
    solveArm(h.armL, P.f, POLE_L);
  } else {
    const swing = Math.sin(h.phase) * 0.18 * amp;
    const g = h.gesture || 0, gt = h.t * 2.2;
    const tr = V3(-0.23, -0.02 + g * (0.35 + Math.sin(gt) * 0.05), 0.02 - swing + g * 0.3);
    const tl = V3(0.23, -0.02, 0.02 + swing);
    if (s.handsOn) { tr.copy(s.handsOn[0]); tl.copy(s.handsOn[1]); }
    solveArm(h.armR, tr, POLE_R); solveArm(h.armL, tl, POLE_L);
  }
}
/* world position of a human's muzzle */
function humanMuzzle(h, out = V3()) {
  if (!h.gun) return h.head.getWorldPosition(out);
  out.copy(h.gun.userData.muzzle); h.gun.localToWorld(out); return out;
}

/* =====================================================================
   Vehicles
   ===================================================================== */
function extrudeSide(pts, width, mat, parent, o = {}) {
  const sh = new THREE.Shape(); pts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1]));
  const g = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: !!o.bevel, bevelThickness: o.bevel || 0, bevelSize: o.bevel || 0, bevelSegments: 2 });
  g.rotateY(-Math.PI / 2); g.translate(width / 2, 0, 0);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; if (parent) parent.add(m); return m;
}
function wheels(parent, n, x, y, z0, z1, r, mat) {
  for (let i = 0; i < n; i++) { const z = lerp(z0, z1, n > 1 ? i / (n - 1) : 0.5); mesh(cylG(r, r, 0.12, 14, false), mat, parent, x, y, z, { r: [0, 0, Math.PI / 2] }); }
}
function makeSherman(opts = {}) {
  const g = new THREE.Group(), M = MAT.od;
  // hull side profile (z forward), extruded across width
  extrudeSide([[-2.9, 0.45], [2.2, 0.45], [2.95, 0.9], [2.1, 1.95], [-2.5, 1.95], [-2.95, 1.55]], 2.3, M, g, { bevel: 0.04 });
  // tracks & suspension
  for (const sx of [-1, 1]) {
    mesh(boxG(0.5, 0.75, 5.7), MAT.track, g, sx * 1.33, 0.42, 0);
    wheels(g, 6, sx * 1.35, 0.4, -2.2, 2.2, 0.3, MAT.metalDark);
    mesh(cylG(0.32, 0.32, 0.52, 14, false), MAT.metalDark, g, sx * 1.33, 0.75, 2.75, { r: [0, 0, Math.PI / 2] });
    mesh(boxG(0.08, 0.2, 5.2), M, g, sx * 1.16, 1.02, 0);
  }
  const turret = new THREE.Group(); turret.position.set(0, 1.95, -0.2); g.add(turret);
  mesh(cylG(1.05, 1.18, 0.95, 20, false), M, turret, 0, 0.45, 0, { s: [1, 1, 1.12] });
  mesh(sphG(0.85, 16, 8), M, turret, 0, 0.85, -0.1, { s: [1.2, 0.35, 1.35] });
  mesh(boxG(0.9, 0.55, 0.3), M, turret, 0, 0.45, 1.2);
  const gun = new THREE.Group(); gun.position.set(0, 0.45, 1.3); turret.add(gun);
  mesh(cylG(0.075, 0.085, 2.6, 12, false), M, gun, 0, 0, 1.3, { r: [Math.PI / 2, 0, 0] });
  mesh(cylG(0.1, 0.1, 0.15, 12, false), M, gun, 0, 0, 2.55, { r: [Math.PI / 2, 0, 0] });
  mesh(cylG(0.3, 0.3, 0.16, 14, false), M, turret, 0.35, 1.0, -0.2); // hatch
  mesh(cylG(0.012, 0.012, 1.8, 4), MAT.metalDark, turret, -0.6, 2.4, -0.7); // antenna
  mesh(cylG(0.03, 0.03, 0.9, 6, false), MAT.gunBlack, turret, 0.35, 1.2, 0.1, { r: [Math.PI / 2, 0, 0] }); // .50 cal
  // star decals
  const star = new THREE.MeshStandardMaterial({ map: makeStar('#e9e6dc'), transparent: true, roughness: 0.8 });
  for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), star); s.position.set(sx * 1.17, 1.5, -0.4); s.rotation.y = sx * Math.PI / 2; g.add(s); }
  // stowage
  mesh(boxG(1.4, 0.3, 0.7), MAT.webbing, g, 0, 2.1, -2.1); mesh(cylG(0.2, 0.2, 1.5, 10, false), MAT.burlap, g, 0, 2.15, -2.4, { r: [0, 0, Math.PI / 2] });
  g.userData = { turret, gun, muzzle: V3(0, 0, 2.7) };
  return g;
}
function makePanzerIV() {
  const g = new THREE.Group(), M = MAT.panzer;
  mesh(boxG(2.4, 0.9, 5.6), M, g, 0, 0.95, 0);
  extrudeSide([[-2.8, 1.4], [2.2, 1.4], [2.8, 1.1], [2.8, 1.85], [-2.8, 1.85]], 2.6, M, g);
  for (const sx of [-1, 1]) {
    mesh(boxG(0.45, 0.7, 5.9), MAT.track, g, sx * 1.4, 0.4, 0);
    wheels(g, 8, sx * 1.42, 0.36, -2.3, 2.1, 0.24, MAT.metalDark);
    mesh(boxG(0.05, 0.9, 5.2), M, g, sx * 1.72, 1.15, -0.1); // schürzen
    mesh(cylG(0.3, 0.3, 0.45, 12, false), MAT.metalDark, g, sx * 1.4, 0.72, 2.8, { r: [0, 0, Math.PI / 2] });
  }
  const turret = new THREE.Group(); turret.position.set(0, 1.85, 0.1); g.add(turret);
  extrudeSide([[-1.2, 0], [1.1, 0], [0.9, 0.85], [-1.1, 0.85]], 1.8, M, turret);
  mesh(boxG(2.6, 0.9, 2.5), M, turret, 0, 0.45, -0.1, { s: [1, 1, 1] }).visible = true;
  mesh(cylG(0.38, 0.4, 0.35, 12, false), M, turret, 0, 1.05, -0.6); // cupola
  const gun = new THREE.Group(); gun.position.set(0, 0.45, 1.15); turret.add(gun);
  mesh(boxG(0.5, 0.45, 0.3), M, gun, 0, 0, 0.1);
  mesh(cylG(0.06, 0.07, 3.2, 12, false), M, gun, 0, 0, 1.75, { r: [Math.PI / 2, 0, 0] });
  mesh(boxG(0.28, 0.14, 0.3), MAT.metalDark, gun, 0, 0, 3.35);
  const cross = new THREE.MeshStandardMaterial({ map: genTextTex(128, 128, (c) => { c.fillStyle = '#111'; c.fillRect(44, 8, 40, 112); c.fillRect(8, 44, 112, 40); c.fillStyle = '#eee'; c.fillRect(52, 8, 24, 112); c.fillRect(8, 52, 112, 24); c.fillStyle = '#111'; c.fillRect(58, 14, 12, 100); c.fillRect(14, 58, 100, 12); }), transparent: true });
  for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), cross); s.position.set(sx * 1.76, 1.3, 0.4); s.rotation.y = sx * Math.PI / 2; g.add(s); }
  g.userData = { turret, gun, muzzle: V3(0, 0, 3.5) };
  return g;
}
function makeLCVP() {
  const g = new THREE.Group(), M = MAT.woodPaint;
  mesh(boxG(3.2, 0.25, 10.5), M, g, 0, -0.3, 0);
  for (const sx of [-1, 1]) mesh(boxG(0.12, 2.0, 10.5), M, g, sx * 1.6, 0.6, 0);
  mesh(boxG(3.2, 2.2, 0.12), M, g, 0, 0.7, -5.2); // stern
  mesh(boxG(1.2, 0.9, 1.0), M, g, 0.9, 1.9, -4.5); // coxswain station
  const ramp = new THREE.Group(); ramp.position.set(0, -0.3, 5.25); g.add(ramp);
  mesh(boxG(3.1, 2.3, 0.14), MAT.metal, ramp, 0, 1.15, 0);
  for (let i = 0; i < 5; i++) mesh(boxG(3.0, 0.05, 0.05), MAT.metalDark, ramp, 0, 0.3 + i * 0.45, -0.1);
  mesh(boxG(3.2, 0.08, 10.4), MAT.woodDark, g, 0, -0.16, 0); // deck
  g.userData = { ramp };
  return g;
}
function makeCar(color = 0x1c1f22) {
  const g = new THREE.Group(), paint = std({ color: col(color), metalness: 0.6, roughness: 0.3 }); paint.userData.dispose = true;
  extrudeSide([[-2.4, 0.35], [2.4, 0.35], [2.45, 0.8], [1.3, 0.95], [0.6, 1.5], [-0.9, 1.52], [-1.9, 1.05], [-2.45, 0.9]], 1.7, paint, g, { bevel: 0.08 });
  mesh(boxG(1.5, 0.45, 1.4), MAT.glass, g, 0, 1.2, -0.15, { cast: false });
  for (const [x, z] of [[-0.88, 1.5], [0.88, 1.5], [-0.88, -1.5], [0.88, -1.5]]) { mesh(cylG(0.36, 0.36, 0.24, 16, false), MAT.rubber, g, x, 0.36, z, { r: [0, 0, Math.PI / 2] }); mesh(cylG(0.2, 0.2, 0.26, 12, false), MAT.chrome, g, x, 0.36, z, { r: [0, 0, Math.PI / 2] }); }
  for (const sx of [-1, 1]) { mesh(sphG(0.12, 10, 8), MAT.chrome, g, sx * 0.6, 0.85, 2.35); mesh(boxG(0.34, 0.5, 1.1), paint, g, sx * 0.86, 0.6, 1.55); mesh(boxG(0.34, 0.5, 1.1), paint, g, sx * 0.86, 0.6, -1.55); }
  mesh(boxG(1.6, 0.12, 0.1), MAT.chrome, g, 0, 0.45, 2.48); mesh(boxG(1.6, 0.12, 0.1), MAT.chrome, g, 0, 0.45, -2.48);
  return g;
}
function makePlane() {
  const g = new THREE.Group(), M = std({ color: col(0x5c6148), metalness: 0.5, roughness: 0.45 }); M.userData.dispose = true;
  mesh(cylG(0.65, 0.35, 9, 14, false), M, g, 0, 0, 0, { r: [Math.PI / 2, 0, 0] });
  mesh(boxG(12, 0.18, 2.2), M, g, 0, -0.2, 0.8); mesh(boxG(4.4, 0.12, 1.2), M, g, 0, 0.2, -4);
  mesh(boxG(0.12, 1.5, 1.2), M, g, 0, 0.8, -4); mesh(sphG(0.45, 12, 8), MAT.glass, g, 0, 0.6, 1.2, { s: [1, 0.8, 1.8] });
  const prop = new THREE.Group(); prop.position.z = 4.6; g.add(prop); mesh(boxG(3.6, 0.2, 0.05), MAT.black, prop); mesh(boxG(0.2, 3.6, 0.05), MAT.black, prop);
  const stripe = std({ color: col(0xe8e8e0) }); stripe.userData.dispose = true;
  for (let i = 0; i < 5; i++) mesh(boxG(0.2, 0.19, 2.21), i % 2 ? MAT.black : stripe, g, 3 + i * 0.2, -0.2, 0.8);
  g.userData.prop = prop; return g;
}
