'use strict';
/* =====================================================================
   First-person viewmodel: detailed weapons, arms with IK, keyframed
   animations (draw, fire, reload, inspect, melee, grenade, medkit).
   Gun-local frame: origin at the trigger/grip, -Z is forward, +Y up.
   ===================================================================== */
function gunExtrude(pts, width, mat, parent, uvScale = 2.5, bevel = 0.004) {
  const sh = new THREE.Shape(); pts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 4 });
  g.rotateY(-Math.PI / 2); g.translate((width - bevel * 2) / 2, 0, 0);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale, uv.getY(i) * uvScale);
  const m = new THREE.Mesh(g, mat); if (parent) parent.add(m); return m;
}
function vbox(w, h, d, mat, parent, x, y, z, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; }
function vcylZ(r1, r2, len, mat, parent, x, y, z, seg = 14) { const g = new THREE.CylinderGeometry(r1, r2, len, seg); g.rotateX(Math.PI / 2); const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); parent.add(m); return m; }
function vcylX(r, len, mat, parent, x, y, z, seg = 12) { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateZ(Math.PI / 2); const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); parent.add(m); return m; }
function cartridge(parent, x, y, z, rifle = true) {
  const c = new THREE.Group(); c.position.set(x, y, z); parent.add(c);
  const L = rifle ? 0.052 : 0.024, r = rifle ? 0.0058 : 0.006;
  vcylZ(r, r * 0.95, L, MAT.brass, c, 0, 0, 0, 10);
  vcylZ(r * 0.72, r * 0.45, rifle ? 0.012 : 0.004, MAT.brass, c, 0, 0, -L / 2 - (rifle ? 0.006 : 0.002), 10);
  vcylZ(r * 0.5, r * 0.12, rifle ? 0.02 : 0.01, MAT.copper, c, 0, 0, -L / 2 - (rifle ? 0.021 : 0.009), 10);
  return c;
}
function slingTube(points, mat, parent, flat = 2.6) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => V3(...p)));
  const g = new THREE.TubeGeometry(curve, 24, 0.0065, 4, false); g.scale(flat, 1, 1);
  const m = new THREE.Mesh(g, mat); parent.add(m); return m;
}

/* ---------------- M1 Garand ---------------- */
function buildGarand() {
  const g = new THREE.Group(), W = MAT.walnut, S = MAT.gunSteel, B = MAT.gunBlue, parts = {};
  gunExtrude([[0.39, 0.062], [0.16, 0.05], [0.075, 0.036], [-0.195, 0.036], [-0.2, 0.046], [-0.47, 0.046], [-0.478, 0.036], [-0.478, 0.002], [-0.2, -0.012], [-0.05, -0.018], [0.02, -0.024], [0.06, -0.03], [0.11, -0.056], [0.37, -0.12], [0.39, -0.12]], 0.044, W, g);
  // receiver
  vbox(0.005, 0.042, 0.24, S, g, 0.0145, 0.057, -0.07); vbox(0.005, 0.042, 0.24, S, g, -0.0145, 0.057, -0.07);
  vbox(0.034, 0.012, 0.24, S, g, 0, 0.041, -0.07);
  vbox(0.034, 0.046, 0.042, S, g, 0, 0.057, 0.034);
  vcylZ(0.018, 0.018, 0.036, S, g, 0, 0.056, -0.182);
  // rear sight
  vbox(0.036, 0.014, 0.034, S, g, 0, 0.087, 0.034);
  vbox(0.004, 0.026, 0.03, S, g, 0.0145, 0.104, 0.034); vbox(0.004, 0.026, 0.03, S, g, -0.0145, 0.104, 0.034);
  const ap = new THREE.Mesh(new THREE.TorusGeometry(0.0034, 0.0014, 6, 16), B); ap.position.set(0, 0.1, 0.03); g.add(ap);
  vbox(0.02, 0.005, 0.003, B, g, 0, 0.1065, 0.03); vbox(0.02, 0.005, 0.003, B, g, 0, 0.0935, 0.03);
  vbox(0.006, 0.008, 0.003, B, g, 0.0065, 0.1, 0.03); vbox(0.006, 0.008, 0.003, B, g, -0.0065, 0.1, 0.03);
  vcylX(0.009, 0.008, S, g, 0.023, 0.088, 0.034); vcylX(0.009, 0.008, S, g, -0.023, 0.088, 0.034);
  // barrel, gas system, front sight
  vcylZ(0.0105, 0.0105, 0.6, B, g, 0, 0.056, -0.495);
  vcylZ(0.0155, 0.0155, 0.1, S, g, 0, 0.052, -0.72);
  vcylZ(0.011, 0.011, 0.02, S, g, 0, 0.052, -0.78);
  vbox(0.016, 0.014, 0.03, S, g, 0, 0.072, -0.755);
  vbox(0.0028, 0.022, 0.004, B, g, 0, 0.089, -0.758);
  vbox(0.003, 0.02, 0.02, S, g, 0.0075, 0.087, -0.757); vbox(0.003, 0.02, 0.02, S, g, -0.0075, 0.087, -0.757);
  vbox(0.012, 0.018, 0.03, S, g, 0, 0.03, -0.72);
  // handguards & bands
  const hg1 = vcylZ(0.0175, 0.0175, 0.12, W, g, 0, 0.064, -0.275); hg1.scale.set(0.95, 0.72, 1);
  const hg2 = vcylZ(0.0175, 0.0175, 0.11, W, g, 0, 0.064, -0.405); hg2.scale.set(0.95, 0.72, 1);
  vbox(0.046, 0.088, 0.012, S, g, 0, 0.036, -0.343);
  vbox(0.046, 0.06, 0.014, S, g, 0, 0.03, -0.468);
  // trigger group
  const tg = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.0028, 6, 16), S); tg.rotation.y = Math.PI / 2; tg.position.set(0, -0.02, 0.022); g.add(tg);
  vbox(0.022, 0.008, 0.1, S, g, 0, -0.019, 0.03);
  vbox(0.005, 0.022, 0.006, S, g, 0, -0.028, 0.018, 0.25, 0, 0);
  // butt plate
  vbox(0.047, 0.185, 0.008, S, g, 0, -0.029, 0.392);
  // op-rod + bolt (moves back when cycling)
  const op = new THREE.Group(); g.add(op); parts.oprod = op;
  vbox(0.005, 0.008, 0.62, S, op, 0.021, 0.046, -0.36);
  vbox(0.012, 0.013, 0.024, S, op, 0.027, 0.051, -0.045);
  vcylX(0.006, 0.012, S, op, 0.036, 0.053, -0.045);
  const bolt = vbox(0.018, 0.014, 0.1, S, op, 0, 0.068, -0.1);
  // clip + 8 rounds
  const clip = new THREE.Group(); g.add(clip); parts.clip = clip;
  vbox(0.0022, 0.042, 0.058, MAT.gunBlack, clip, 0.0115, 0, 0); vbox(0.0022, 0.042, 0.058, MAT.gunBlack, clip, -0.0115, 0, 0);
  const rounds = [];
  for (let i = 0; i < 8; i++) rounds.push(cartridge(clip, i % 2 ? 0.0052 : -0.0052, 0, 0.004));
  parts.rounds = rounds;
  // sling
  slingTube([[0, -0.01, -0.46], [0, -0.06, -0.35], [0, -0.13, -0.05], [0, -0.13, 0.15], [0, -0.1, 0.25]], MAT.sling, g);
  vbox(0.01, 0.012, 0.012, S, g, 0, -0.1, 0.25);
  return {
    id: 'garand', g, parts,
    anchors: { gripR: V3(0.0, -0.012, 0.07), gripL: V3(0.0, -0.003, -0.3), sight: V3(0, 0.1, 0.03), muzzle: V3(0, 0.056, -0.8), eject: V3(0.0, 0.08, -0.09), clipSlot: V3(0, 0.03, -0.095) },
    hip: V3(0.13, -0.15, -0.32), hipRot: V3(0, 0.035, 0), adsDist: 0.3,
  };
}
/* ---------------- Thompson M1A1 ---------------- */
function buildThompson() {
  const g = new THREE.Group(), W = MAT.walnut, S = MAT.gunBlack, parts = {};
  vbox(0.05, 0.062, 0.3, S, g, 0, 0.046, -0.06);
  vbox(0.044, 0.03, 0.22, S, g, 0, 0.003, -0.03);
  vbox(0.03, 0.012, 0.03, S, g, 0, 0.083, 0.06);
  vbox(0.004, 0.024, 0.026, S, g, 0.012, 0.097, 0.06); vbox(0.004, 0.024, 0.026, S, g, -0.012, 0.097, 0.06);
  const ap = new THREE.Mesh(new THREE.TorusGeometry(0.003, 0.0012, 6, 14), S); ap.position.set(0, 0.098, 0.058); g.add(ap);
  vcylZ(0.0125, 0.0125, 0.3, S, g, 0, 0.05, -0.36);
  vcylZ(0.015, 0.015, 0.015, S, g, 0, 0.05, -0.5);
  vbox(0.003, 0.036, 0.006, S, g, 0, 0.08, -0.5);
  gunExtrude([[0.09, 0.062], [0.43, 0.048], [0.44, -0.1], [0.42, -0.112], [0.14, -0.02], [0.09, 0.0]], 0.042, W, g);
  const pg = vbox(0.032, 0.105, 0.046, W, g, 0, -0.045, 0.045, -0.28, 0, 0);
  const tg = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0028, 6, 14), S); tg.rotation.y = Math.PI / 2; tg.position.set(0, -0.012, 0.0); g.add(tg);
  vbox(0.005, 0.02, 0.006, S, g, 0, -0.018, -0.004, 0.25, 0, 0);
  const fg = vbox(0.036, 0.048, 0.13, W, g, 0, -0.005, -0.3);
  vbox(0.004, 0.012, 0.012, S, g, -0.026, 0.05, -0.02); vbox(0.004, 0.012, 0.012, S, g, -0.026, 0.05, 0.01);
  // magazine (group origin = magwell top)
  const mag = new THREE.Group(); mag.position.set(0, 0.0, -0.105); g.add(mag); parts.mag = mag;
  vbox(0.024, 0.19, 0.038, S, mag, 0, -0.095, 0); vbox(0.026, 0.01, 0.04, S, mag, 0, -0.19, 0);
  parts.magTop = cartridge(mag, 0, 0.004, 0, false);
  // cocking handle on right side
  const bolt = new THREE.Group(); g.add(bolt); parts.bolt = bolt;
  vbox(0.01, 0.01, 0.02, S, bolt, 0.03, 0.068, -0.12); const knob = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), S); knob.position.set(0.036, 0.07, -0.12); bolt.add(knob);
  slingTube([[0, -0.03, -0.35], [0, -0.1, -0.15], [0, -0.13, 0.15], [0, -0.1, 0.35]], MAT.slingWeb, g);
  return {
    id: 'thompson', g, parts,
    anchors: { gripR: V3(0, -0.035, 0.045), gripL: V3(0, -0.02, -0.3), sight: V3(0, 0.098, 0.058), muzzle: V3(0, 0.05, -0.52), eject: V3(0.03, 0.06, -0.07), magSlot: V3(0, 0.0, -0.105) },
    hip: V3(0.125, -0.145, -0.29), hipRot: V3(0, 0.04, 0), adsDist: 0.27,
  };
}
/* ---------------- M1911 ---------------- */
function buildColt() {
  const g = new THREE.Group(), S = MAT.gunBlue, parts = {};
  const slide = new THREE.Group(); g.add(slide); parts.slide = slide;
  vbox(0.027, 0.03, 0.212, S, slide, 0, 0.05, -0.076);
  for (let i = 0; i < 6; i++) vbox(0.0275, 0.024, 0.002, MAT.gunBlack, slide, 0, 0.05, 0.012 + i * -0.005);
  vbox(0.003, 0.007, 0.01, S, slide, 0, 0.068, -0.172);
  vbox(0.005, 0.008, 0.006, S, slide, 0.005, 0.068, 0.022); vbox(0.005, 0.008, 0.006, S, slide, -0.005, 0.068, 0.022);
  vcylZ(0.0065, 0.0065, 0.01, MAT.gunBlack, slide, 0, 0.048, -0.185);
  vbox(0.025, 0.022, 0.17, S, g, 0, 0.024, -0.06);
  const grip = vbox(0.031, 0.112, 0.05, MAT.grip, g, 0, -0.038, 0.042, -0.3, 0, 0);
  vbox(0.026, 0.114, 0.044, S, g, 0, -0.038, 0.044, -0.3, 0, 0);
  vbox(0.01, 0.005, 0.045, S, g, 0, -0.006, -0.02); vbox(0.01, 0.02, 0.005, S, g, 0, 0.004, -0.042);
  vbox(0.005, 0.016, 0.006, S, g, 0, 0.003, -0.012, 0.2, 0, 0);
  const hammer = vbox(0.008, 0.02, 0.012, S, g, 0, 0.06, 0.036, -0.4, 0, 0); parts.hammer = hammer;
  const mag = new THREE.Group(); mag.position.set(0, -0.004, 0.03); mag.rotation.x = -0.3; g.add(mag); parts.mag = mag;
  vbox(0.022, 0.11, 0.034, S, mag, 0, -0.055, 0); vbox(0.028, 0.008, 0.042, S, mag, 0, -0.112, 0.004);
  return {
    id: 'colt', g, parts,
    anchors: { gripR: V3(0, -0.035, 0.048), gripL: V3(-0.018, -0.05, 0.03), sight: V3(0, 0.071, 0.022), muzzle: V3(0, 0.048, -0.19), eject: V3(0.015, 0.066, -0.03), magSlot: V3(0, -0.004, 0.03) },
    hip: V3(0.1, -0.12, -0.32), hipRot: V3(0, 0.05, 0), adsDist: 0.3,
  };
}
function buildGrenadeModel() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), MAT.grenade); b.scale.set(1, 1.25, 1); g.add(b);
  for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.027 - Math.abs(i - 1.5) * 0.004, 0.003, 4, 14), MAT.grenade); r.rotation.x = Math.PI / 2; r.position.y = -0.024 + i * 0.016; g.add(r); }
  vbox(0.012, 0.018, 0.012, MAT.gunSteel, g, 0, 0.042, 0);
  vbox(0.006, 0.05, 0.012, MAT.gunSteel, g, 0.012, 0.025, 0, 0, 0, -0.15);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.0015, 4, 12), MAT.gunSteel); ring.position.set(-0.012, 0.05, 0); g.add(ring);
  g.userData.ring = ring;
  return g;
}

/* ---------------- arms ---------------- */
const VM_LU = 0.36, VM_LF = 0.33;
function buildFPArm(side) {
  const sh = new THREE.Group();
  const up = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.05, VM_LU, 12), MAT.usJacket); up.position.y = -VM_LU / 2; sh.add(up);
  const el = new THREE.Group(); el.position.y = -VM_LU; sh.add(el);
  const fa = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.043, VM_LF, 12), MAT.usJacket); fa.position.y = -VM_LF / 2; el.add(fa);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.03, 12), MAT.usHBT); cuff.position.y = -VM_LF + 0.02; el.add(cuff);
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.03, 0.05, 10), MAT.skins[0]); wrist.position.y = -VM_LF - 0.01; el.add(wrist);
  const hand = new THREE.Group(); hand.position.y = -VM_LF - 0.03; el.add(hand);
  const skin = MAT.skins[0];
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skin); palm.scale.set(0.043, 0.05, 0.019); palm.position.y = -0.045; hand.add(palm);
  const seg = (len, r) => { const g = new THREE.CylinderGeometry(r, r * 0.92, len, 8); g.translate(0, -len / 2, 0); return g; };
  const tip = new THREE.SphereGeometry(1, 8, 6);
  for (let i = 0; i < 4; i++) {
    const L = [0.034, 0.038, 0.036, 0.028][i];
    const f = new THREE.Group(); f.position.set(-0.029 + i * 0.0195, -0.086, 0.004); hand.add(f);
    const a = new THREE.Mesh(seg(L, 0.0092), skin); f.add(a);
    const k = new THREE.Group(); k.position.y = -L; f.add(k);
    const b = new THREE.Mesh(seg(L * 0.85, 0.0085), skin); k.add(b);
    const t = new THREE.Mesh(tip, skin); t.scale.setScalar(0.0085); t.position.y = -L * 0.85; k.add(t);
    const kn = new THREE.Mesh(tip, skin); kn.scale.setScalar(0.0098); f.add(kn);
    f.rotation.x = 1.15; k.rotation.x = 1.25;
  }
  const th = new THREE.Group(); th.position.set(0.036 * side, -0.03, 0.012); hand.add(th);
  const t1 = new THREE.Mesh(seg(0.034, 0.011), skin); th.add(t1);
  const tk = new THREE.Group(); tk.position.y = -0.034; th.add(tk);
  const t2 = new THREE.Mesh(seg(0.028, 0.0098), skin); tk.add(t2); const tt = new THREE.Mesh(tip, skin); tt.scale.setScalar(0.0095); tt.position.y = -0.028; tk.add(tt);
  th.rotation.set(0.7, 0, 0.75 * side); tk.rotation.x = 0.5;
  hand.rotation.y = side > 0 ? -1.3 : 1.4;
  sh.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
  return { sh, el, hand };
}
const _vik = { d: V3(), p: V3(), e: V3(), u: V3(), l: V3(), q1: new THREE.Quaternion(), q2: new THREE.Quaternion(), down: V3(0, -1, 0) };
function solveFPArm(arm, target, pole) {
  const S = arm.sh.position, K = _vik, L1 = VM_LU, L2 = VM_LF + 0.075;
  K.d.copy(target).sub(S); let len = K.d.length(); const max = (L1 + L2) * 0.999; if (len > max) { K.d.multiplyScalar(max / len); len = max; }
  const dir = K.d.clone().divideScalar(len);
  const a = (L1 * L1 - L2 * L2 + len * len) / (2 * len), hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  K.p.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
  K.e.copy(S).addScaledVector(dir, a).addScaledVector(K.p, hh);
  K.u.copy(K.e).sub(S).normalize(); K.q1.setFromUnitVectors(K.down, K.u); arm.sh.quaternion.copy(K.q1);
  K.l.copy(S).add(K.d).sub(K.e).normalize(); K.q2.setFromUnitVectors(K.down, K.l);
  arm.el.quaternion.copy(K.q1).invert().multiply(K.q2);
}

/* ---------------- keyframe tracks ---------------- */
function sampleTrack(keys, t, out) {
  if (!keys || !keys.length) return null;
  const n = keys[0].length - 1;
  if (t <= keys[0][0]) { for (let i = 0; i < n; i++) out[i] = keys[0][i + 1]; return out; }
  for (let k = 0; k < keys.length - 1; k++) {
    const a = keys[k], b = keys[k + 1];
    if (t < b[0]) { const u = ease((t - a[0]) / (b[0] - a[0])); for (let i = 0; i < n; i++) out[i] = a[i + 1] + (b[i + 1] - a[i + 1]) * u; return out; }
  }
  const l = keys[keys.length - 1]; for (let i = 0; i < n; i++) out[i] = l[i + 1]; return out;
}
const Z6 = [0, 0, 0, 0, 0, 0];
const ANIMS = {
  garand: {
    draw: { dur: 0.6, gun: [[0, 0.02, -0.28, 0.06, -0.9, 0.2, 0.4], [0.6, ...Z6]], ev: [[0.05, 'cloth'], [0.35, 'tap']] },
    holster: { dur: 0.35, gun: [[0, ...Z6], [0.35, 0.02, -0.3, 0.06, -0.9, 0.2, 0.4]] },
    reloadEmpty: {
      dur: 2.25,
      gun: [[0, ...Z6], [0.3, -0.035, 0.04, 0.035, 0.14, 0.22, 0.55], [1.25, -0.035, 0.045, 0.035, 0.16, 0.22, 0.58], [1.36, -0.03, 0.028, 0.045, 0.08, 0.2, 0.52], [1.5, -0.03, 0.035, 0.04, 0.12, 0.2, 0.55], [2.0, ...Z6]],
      lh: [[0, 0, 0, -0.003, -0.3], [0.12, 1, 0, -0.1, -0.24], [0.45, 1, 0.03, -0.38, 0.05], [0.72, 1, 0.01, -0.05, -0.06], [0.95, 1, 0.0, 0.13, -0.09], [1.18, 1, 0.0, 0.07, -0.09], [1.3, 1, 0.05, 0.11, -0.05], [1.75, 1, 0.0, -0.003, -0.3], [1.9, 0, 0, -0.003, -0.3]],
      parts: { oprod: [[0, 1], [1.26, 1], [1.33, 0]] },
      ev: [[0.08, 'cloth'], [0.6, 'clipHand'], [1.18, 'clipSeat'], [1.19, 'clipIn'], [1.32, 'boltFwd'], [1.33, 'refill']]
    },
    reload: {
      dur: 2.85,
      gun: [[0, ...Z6], [0.3, -0.035, 0.04, 0.035, 0.14, 0.22, 0.55], [1.85, -0.035, 0.045, 0.035, 0.16, 0.22, 0.58], [1.95, -0.03, 0.028, 0.045, 0.08, 0.2, 0.52], [2.1, -0.03, 0.035, 0.04, 0.12, 0.2, 0.55], [2.6, ...Z6]],
      lh: [[0, 0, 0, -0.003, -0.3], [0.25, 1, 0.034, 0.05, -0.05], [0.42, 1, 0.034, 0.05, 0.055], [0.55, 1, 0.034, 0.05, 0.055], [0.95, 1, 0.03, -0.38, 0.05], [1.3, 1, 0.01, -0.05, -0.06], [1.55, 1, 0.0, 0.13, -0.09], [1.78, 1, 0.0, 0.07, -0.09], [1.9, 1, 0.05, 0.11, -0.05], [2.35, 1, 0.0, -0.003, -0.3], [2.5, 0, 0, -0.003, -0.3]],
      parts: { oprod: [[0.25, 0], [0.42, 1], [1.86, 1], [1.93, 0]] },
      ev: [[0.42, 'boltBack'], [0.47, 'clipEject'], [1.2, 'clipHand'], [1.78, 'clipSeat'], [1.79, 'clipIn'], [1.92, 'boltFwd'], [1.93, 'refill']]
    },
    inspect: {
      dur: 3.7,
      gun: [[0, ...Z6], [0.55, -0.11, 0.07, 0.07, 0.22, 0.95, -0.85], [1.45, -0.1, 0.075, 0.065, 0.26, 0.9, -0.8], [2.05, -0.07, 0.06, 0.05, 0.12, 0.55, 0.85], [2.9, -0.07, 0.065, 0.05, 0.14, 0.5, 0.82], [3.7, ...Z6]],
      lh: [[0, 0, 0, -0.003, -0.3], [2.15, 0, 0, -0.003, -0.3], [2.35, 1, 0.034, 0.05, -0.05], [2.5, 1, 0.034, 0.05, 0.055], [2.66, 1, 0.034, 0.05, 0.055], [2.76, 1, 0.034, 0.05, -0.045], [3.0, 1, 0.0, -0.003, -0.3], [3.1, 0, 0, -0.003, -0.3]],
      parts: { oprod: [[2.35, 0], [2.5, 1], [2.66, 1], [2.72, 0]] },
      ev: [[0.1, 'cloth'], [2.5, 'boltBack'], [2.72, 'boltFwd'], [3.2, 'cloth']]
    },
  },
  thompson: {
    draw: { dur: 0.55, gun: [[0, 0.02, -0.26, 0.06, -0.9, 0.2, 0.4], [0.55, ...Z6]], ev: [[0.05, 'cloth'], [0.3, 'tap']] },
    holster: { dur: 0.35, gun: [[0, ...Z6], [0.35, 0.02, -0.3, 0.06, -0.9, 0.2, 0.4]] },
    reloadEmpty: {
      dur: 2.55,
      gun: [[0, ...Z6], [0.3, 0.02, 0.035, 0.02, 0.1, -0.18, -0.45], [1.4, 0.02, 0.04, 0.02, 0.12, -0.2, -0.5], [1.5, 0.015, 0.03, 0.03, 0.08, -0.18, -0.4], [1.65, 0.01, 0.03, 0.02, 0.1, 0.2, 0.35], [2.05, 0.01, 0.03, 0.02, 0.1, 0.2, 0.35], [2.2, 0.0, 0.02, 0.035, 0.06, 0.2, 0.3], [2.5, ...Z6]],
      lh: [[0, 0, 0, -0.02, -0.3], [0.2, 1, 0, -0.14, -0.1], [0.34, 1, 0, -0.14, -0.1], [0.5, 1, 0, -0.32, -0.1], [0.85, 1, 0.05, -0.48, 0.1], [1.12, 1, 0, -0.28, -0.1], [1.34, 1, 0, -0.145, -0.1], [1.46, 1, 0, -0.16, -0.1], [1.75, 1, 0.042, 0.07, -0.12], [1.88, 1, 0.042, 0.07, -0.03], [2.0, 1, 0.042, 0.07, -0.03], [2.3, 1, 0, -0.02, -0.3], [2.4, 0, 0, -0.02, -0.3]],
      parts: { bolt: [[0, 0], [1.76, 0], [1.88, 1]] },
      ev: [[0.08, 'cloth'], [0.34, 'magHand'], [0.36, 'magOut'], [0.52, 'magDrop'], [0.95, 'magNew'], [1.34, 'magSeat'], [1.35, 'magIn'], [1.36, 'refill'], [1.88, 'boltBack']]
    },
    reload: {
      dur: 2.1,
      gun: [[0, ...Z6], [0.3, 0.02, 0.035, 0.02, 0.1, -0.18, -0.45], [1.4, 0.02, 0.04, 0.02, 0.12, -0.2, -0.5], [1.5, 0.015, 0.03, 0.03, 0.08, -0.18, -0.4], [2.0, ...Z6]],
      lh: [[0, 0, 0, -0.02, -0.3], [0.2, 1, 0, -0.14, -0.1], [0.34, 1, 0, -0.14, -0.1], [0.5, 1, 0, -0.32, -0.1], [0.85, 1, 0.05, -0.48, 0.1], [1.12, 1, 0, -0.28, -0.1], [1.34, 1, 0, -0.145, -0.1], [1.46, 1, 0, -0.16, -0.1], [1.85, 1, 0, -0.02, -0.3], [1.95, 0, 0, -0.02, -0.3]],
      ev: [[0.08, 'cloth'], [0.34, 'magHand'], [0.36, 'magOut'], [0.52, 'magDrop'], [0.95, 'magNew'], [1.34, 'magSeat'], [1.35, 'magIn'], [1.36, 'refill']]
    },
    inspect: {
      dur: 3.4,
      gun: [[0, ...Z6], [0.5, -0.1, 0.06, 0.06, 0.2, 0.9, -0.9], [1.4, -0.09, 0.065, 0.06, 0.24, 0.85, -0.85], [1.9, -0.06, 0.05, 0.04, 0.1, 0.5, 0.8], [2.7, -0.06, 0.055, 0.04, 0.12, 0.45, 0.78], [3.4, ...Z6]],
      lh: [[0, 0, 0, -0.02, -0.3], [2.0, 0, 0, -0.02, -0.3], [2.2, 1, 0, -0.2, -0.1], [2.35, 1, 0, -0.18, -0.1], [2.45, 1, 0, -0.2, -0.1], [2.8, 1, 0, -0.02, -0.3], [2.9, 0, 0, -0.02, -0.3]],
      ev: [[0.1, 'cloth'], [2.35, 'tap'], [3.0, 'cloth']]
    },
  },
  colt: {
    draw: { dur: 0.45, gun: [[0, 0.02, -0.24, 0.05, -0.9, 0.3, 0.3], [0.45, ...Z6]], ev: [[0.05, 'cloth'], [0.3, 'tap']] },
    holster: { dur: 0.3, gun: [[0, ...Z6], [0.3, 0.02, -0.28, 0.05, -0.9, 0.3, 0.3]] },
    reloadEmpty: {
      dur: 1.75,
      gun: [[0, ...Z6], [0.25, -0.02, 0.04, 0.03, 0.35, 0.2, 0.35], [1.2, -0.02, 0.045, 0.03, 0.35, 0.2, 0.4], [1.3, -0.015, 0.03, 0.04, 0.2, 0.1, 0.3], [1.7, ...Z6]],
      lh: [[0, 0, -0.018, -0.05, 0.03], [0.2, 1, -0.06, -0.16, 0.06], [0.5, 1, -0.06, -0.4, 0.15], [0.75, 1, -0.02, -0.24, 0.08], [0.98, 1, 0, -0.13, 0.06], [1.05, 1, 0, -0.12, 0.055], [1.2, 1, -0.03, 0.06, 0.02], [1.28, 1, -0.03, 0.055, 0.02], [1.55, 1, -0.018, -0.05, 0.03], [1.65, 0, -0.018, -0.05, 0.03]],
      parts: { slide: [[0, 1], [1.24, 1], [1.28, 0]] },
      ev: [[0.15, 'magOut'], [0.2, 'magDrop'], [0.7, 'magNew'], [1.02, 'magSeat'], [1.03, 'magIn'], [1.04, 'refill'], [1.26, 'slideFwd']]
    },
    reload: {
      dur: 1.5,
      gun: [[0, ...Z6], [0.25, -0.02, 0.04, 0.03, 0.35, 0.2, 0.35], [1.1, -0.02, 0.045, 0.03, 0.35, 0.2, 0.4], [1.45, ...Z6]],
      lh: [[0, 0, -0.018, -0.05, 0.03], [0.2, 1, -0.06, -0.16, 0.06], [0.5, 1, -0.06, -0.4, 0.15], [0.75, 1, -0.02, -0.24, 0.08], [0.98, 1, 0, -0.13, 0.06], [1.05, 1, 0, -0.12, 0.055], [1.35, 1, -0.018, -0.05, 0.03], [1.45, 0, -0.018, -0.05, 0.03]],
      ev: [[0.15, 'magOut'], [0.2, 'magDrop'], [0.7, 'magNew'], [1.02, 'magSeat'], [1.03, 'magIn'], [1.04, 'refill']]
    },
    inspect: {
      dur: 2.8,
      gun: [[0, ...Z6], [0.45, -0.07, 0.05, 0.08, 0.25, 0.8, -1.0], [1.2, -0.07, 0.055, 0.08, 0.3, 0.75, -0.95], [1.6, -0.05, 0.05, 0.06, 0.2, 0.3, 0.9], [2.2, -0.05, 0.05, 0.06, 0.22, 0.3, 0.85], [2.8, ...Z6]],
      lh: [[0, 0, -0.018, -0.05, 0.03], [1.6, 0, -0.018, -0.05, 0.03], [1.75, 1, -0.03, 0.06, 0.0], [1.85, 1, -0.03, 0.06, 0.05], [1.95, 1, -0.03, 0.06, 0.0], [2.3, 0, -0.018, -0.05, 0.03]],
      parts: { slide: [[1.75, 0], [1.85, 0.55], [1.95, 0]] },
      ev: [[0.1, 'cloth'], [1.85, 'slideBack'], [1.95, 'slideFwd']]
    },
  },
  common: {
    melee: { dur: 0.62, gun: [[0, ...Z6], [0.12, -0.06, 0.02, 0.07, 0.15, 0.7, 0.35], [0.22, -0.08, 0.0, -0.2, 0.1, 1.2, 0.3], [0.32, -0.06, 0.0, -0.16, 0.1, 1.1, 0.3], [0.62, ...Z6]], ev: [[0.02, 'melee'], [0.2, 'hit']] },
    grenade: { dur: 1.15, gun: [[0, ...Z6], [0.2, 0.05, -0.32, 0.05, -0.7, 0, 0.1], [0.85, 0.05, -0.32, 0.05, -0.7, 0, 0.1], [1.15, ...Z6]], nade: [[0.1, 0.2, -0.4, -0.25, 0], [0.32, 0.12, -0.16, -0.34, 0.2], [0.52, 0.22, 0.04, -0.1, -0.5], [0.66, 0.06, 0.06, -0.62, 0.6], [0.78, 0.1, -0.4, -0.5, 0.6]], ev: [[0.3, 'pin'], [0.66, 'throw']] },
    medkit: { dur: 1.0, gun: [[0, ...Z6], [0.25, 0.05, -0.3, 0.05, -0.7, 0, 0.1], [0.75, 0.05, -0.3, 0.05, -0.7, 0, 0.1], [1.0, ...Z6]], ev: [[0.3, 'heal']] },
  }
};

/* =====================================================================
   VM controller
   ===================================================================== */
const VM = {
  visible: false, root: null, pivot: null, W: {}, cur: null, arms: null,
  anim: null, animName: null, animT: 0, evI: 0, onDone: null,
  ads: 0, sprint: 0, crouch: 0, swayX: 0, swayY: 0, bob: 0, bobAmt: 0, land: 0, landV: 0,
  rec: { z: 0, vz: 0, rx: 0, vrx: 0, ry: 0, vry: 0, rz: 0, vrz: 0 },
  parts: { oprod: 0, bolt: 1, slide: 0 }, cycleT: 0, flashT: 0, casings: [], drops: [],
  clipMode: 'gun', magMode: 'gun', nadeVisible: false,
  init() {
    this.root = new THREE.Group(); this.pivot = new THREE.Group(); this.root.add(this.pivot);
    this.W.garand = buildGarand(); this.W.thompson = buildThompson(); this.W.colt = buildColt();
    for (const k in this.W) { const w = this.W[k]; w.g.visible = false; this.pivot.add(w.g); w.g.traverse(m => { if (m.isMesh) { m.castShadow = false; m.frustumCulled = false; } }); }
    const R_ = buildFPArm(1), L_ = buildFPArm(-1);
    R_.sh.position.set(0.21, -0.33, 0.2); L_.sh.position.set(-0.17, -0.34, 0.12);
    this.root.add(R_.sh, L_.sh); this.arms = { R: R_, L: L_ };
    R_.sh.traverse(m => m.frustumCulled = false); L_.sh.traverse(m => m.frustumCulled = false);
    // muzzle flash sprites (crossed planes)
    const fm = new THREE.MeshBasicMaterial({ map: TEX.flash, color: new THREE.Color(3, 2.4, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.flash = new THREE.Group();
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), fm); this.flash.add(p1);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.34), fm); p2.rotation.y = Math.PI / 2; p2.position.z = -0.12; p2.rotation.z = Math.PI / 2; this.flash.add(p2);
    const p3 = p2.clone(); p3.rotation.set(Math.PI / 2, 0, 0); this.flash.add(p3);
    this.flash.visible = false; this.root.add(this.flash); this.flash.traverse(m => m.frustumCulled = false);
    // grenade in hand
    this.nade = buildGrenadeModel(); this.nade.visible = false; this.root.add(this.nade); this.nade.traverse(m => m.frustumCulled = false);
    // casing pool
    this.casingGeo = new THREE.CylinderGeometry(0.0058, 0.0058, 0.05, 8); this.casingGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 14; i++) { const c = new THREE.Mesh(this.casingGeo, MAT.brass); c.visible = false; c.frustumCulled = false; this.root.add(c); this.casings.push({ m: c, t: 99, v: V3(), s: V3() }); }
  },
  attach() { if (this.root.parent !== R.vmScene) R.vmScene.add(this.root); },
  equip(id, instant = false) {
    for (const k in this.W) this.W[k].g.visible = false;
    this.cur = this.W[id] || null; this.curId = id;
    if (!this.cur) { this.visible = false; return; }
    this.visible = true; this.cur.g.visible = true;
    this.clipMode = 'gun'; this.magMode = 'gun';
    this.parts.oprod = 0; this.parts.bolt = 1; this.parts.slide = 0;
    this.anim = null;
    if (!instant) this.play('draw');
  },
  play(name, onDone, force = false) {
    if (!this.cur) return false;
    if (this.anim && !force && this.animName !== 'draw') return false;
    const A = ANIMS[this.cur.id][name] || ANIMS.common[name];
    if (!A) return false;
    this.anim = A; this.animName = name; this.animT = 0; this.evI = 0; this.onDone = onDone || null; this.onEvent = null;
    return true;
  },
  cancel() { if (this.anim && (this.animName.startsWith('reload') || this.animName === 'inspect')) { this.anim = null; this.animName = null; this.clipMode = 'gun'; this.magMode = 'gun'; } },
  ejectClip() { if (!this.cur || this.curId !== 'garand') return; SFX.ping(); this.dropPart(this.cur.parts.clip, V3(0.3, 2.4, 0.1), 12); this.clipMode = 'hidden'; },
  busy() { return !!this.anim; },
  fire(w) {
    const r = this.rec, adsK = 1 - this.ads * 0.55;
    const k = { garand: [0.05, 0.12, 0.04], thompson: [0.022, 0.035, 0.018], colt: [0.035, 0.18, 0.03] }[w] || [0.03, 0.06, 0.02];
    r.vz += k[0] * 60 * adsK; r.vrx += k[1] * 60 * adsK; r.vry += rand(-1, 1) * k[2] * 40; r.vrz += rand(-1, 1) * k[2] * 60;
    this.flashT = 0.045; this.flash.rotation.z = Math.random() * TAU; this.flash.scale.setScalar(w === 'colt' ? 0.6 : w === 'thompson' ? 0.8 : 1.15);
    if (w === 'garand') this.parts.oprod = 1, this.cycleT = 0.075;
    if (w === 'thompson') this.parts.bolt = 0, this.cycleT = 0.05;
    if (w === 'colt') this.parts.slide = 1, this.cycleT = 0.06;
    this.spawnCasing(w);
  },
  spawnCasing(w) {
    if (!this.cur) return;
    const c = this.casings.find(c => c.t > 1) || this.casings[0];
    const p = this.cur.anchors.eject.clone(); this.cur.g.localToWorld(p); this.root.worldToLocal(p);
    c.m.position.copy(p); c.m.scale.setScalar(w === 'garand' ? 1 : 0.55); c.t = 0; c.m.visible = true;
    c.v.set(rand(0.7, 1.2), rand(1.1, 1.7), rand(-0.1, 0.25)); c.s.set(rand(-20, 20), rand(-20, 20), rand(-20, 20));
    SFX.casing(0.4 + Math.random() * 0.15);
  },
  dropPart(obj, vel, spin = 8) { // clone a part and let it fall out of view
    const c = obj.clone(true); const p = V3(), q = new THREE.Quaternion();
    obj.getWorldPosition(p); obj.getWorldQuaternion(q); this.root.worldToLocal(p);
    const rq = new THREE.Quaternion(); this.root.getWorldQuaternion(rq); rq.invert().multiply(q);
    c.position.copy(p); c.quaternion.copy(rq); c.traverse(m => m.frustumCulled = false); this.root.add(c);
    this.drops.push({ m: c, v: vel, t: 0, s: V3(rand(-spin, spin), rand(-spin, spin), rand(-spin, spin)) });
  },
  event(e) {
    const W = this.cur;
    switch (e) {
      case 'cloth': SFX.mech('cloth'); break;
      case 'tap': SFX.mech('tap'); break;
      case 'boltBack': SFX.mech('boltBack'); break;
      case 'boltFwd': SFX.mech('boltFwd'); this.rec.vz += 0.6; break;
      case 'slideBack': SFX.mech('slideBack'); break;
      case 'slideFwd': SFX.mech('slideFwd'); this.rec.vz += 0.4; break;
      case 'clipEject': SFX.ping(); this.dropPart(W.parts.clip, V3(0.25, 2.2, 0.1), 12); this.clipMode = 'hidden'; break;
      case 'clipHand': this.clipMode = 'hand'; this.showRounds(8); break;
      case 'clipSeat': this.clipMode = 'gun'; break;
      case 'clipIn': SFX.mech('clipIn'); break;
      case 'magHand': this.magMode = 'hand'; break;
      case 'magOut': SFX.mech('magOut'); if (this.curId === 'colt') this.magMode = 'hidden', this.dropPart(W.parts.mag, V3(0, -1.5, 0)); break;
      case 'magDrop': if (this.curId !== 'colt') { this.dropPart(W.parts.mag, V3(-0.2, -1.2, 0.1), 3); this.magMode = 'hidden'; } break;
      case 'magNew': this.magMode = 'hand'; break;
      case 'magSeat': this.magMode = 'gun'; break;
      case 'magIn': SFX.mech('magIn'); this.rec.vz += 0.3; break;
      case 'refill': if (this.onRefill) this.onRefill(); break;
      case 'melee': SFX.mech('melee'); break;
      case 'hit': if (this.onMeleeHit) this.onMeleeHit(); break;
      case 'pin': SFX.mech('pin'); break;
      case 'throw': this.nadeVisible = false; if (this.onThrow) this.onThrow(); break;
      case 'heal': if (this.onHeal) this.onHeal(); break;
    }
  },
  showRounds(n) { if (this.cur && this.cur.parts.rounds) this.cur.parts.rounds.forEach((r, i) => r.visible = i < n); },
  update(dt, P) {
    if (!this.cur) { this.visible = false; return; }
    const W = this.cur, id = this.curId, anc = W.anchors;
    // follow camera
    this.root.position.copy(R.camera.position); this.root.quaternion.copy(R.camera.quaternion);
    R.vmCamera.position.copy(R.camera.position); R.vmCamera.quaternion.copy(R.camera.quaternion);
    // state blends
    const animating = !!this.anim && this.animName !== 'draw';
    this.ads = damp(this.ads, P.adsWant && !animating ? 1 : 0, 14, dt);
    this.sprint = damp(this.sprint, P.sprinting && !animating ? 1 : 0, 8, dt);
    this.crouch = damp(this.crouch, P.crouchAmt, 8, dt);
    // mouse sway
    this.swayX = damp(this.swayX, clamp(-P.lookDX * 0.0009, -0.05, 0.05), 9, dt);
    this.swayY = damp(this.swayY, clamp(P.lookDY * 0.0009, -0.05, 0.05), 9, dt);
    // bob
    const moveAmt = clamp(P.hSpeed / 4.5, 0, 1.6);
    this.bobAmt = damp(this.bobAmt, P.onGround ? moveAmt : 0, 8, dt);
    const ph = P.stepPhase, bk = (1 - this.ads * 0.88) * this.bobAmt;
    const bx = Math.sin(ph) * 0.011 * bk, by = -Math.abs(Math.cos(ph)) * 0.009 * bk;
    // landing spring
    this.landV += (-this.land * 180 - this.landV * 16) * dt; this.land += this.landV * dt;
    // recoil springs
    const r = this.rec, K = 260, C = 22;
    r.vz += (-r.z * K - r.vz * C) * dt; r.z += r.vz * dt;
    r.vrx += (-r.rx * K - r.vrx * C) * dt; r.rx += r.vrx * dt;
    r.vry += (-r.ry * K - r.vry * C) * dt; r.ry += r.vry * dt;
    r.vrz += (-r.rz * K - r.vrz * C) * dt; r.rz += r.vrz * dt;
    // base pose
    const ads = ease(this.ads);
    const adsPos = V3(-anc.sight.x, -anc.sight.y, -W.adsDist - anc.sight.z);
    const pos = W.hip.clone().lerp(adsPos, ads);
    let rx = W.hipRot.x * (1 - ads), ry = W.hipRot.y * (1 - ads), rz = W.hipRot.z * (1 - ads);
    const breathe = Math.sin(R.time * 1.3) * 0.0025 * (1 - ads * 0.8);
    pos.x += bx + this.swayX * 0.25 * (1 - ads * 0.7); pos.y += by + breathe + this.land * 0.6 - this.swayY * 0.25 * (1 - ads * 0.7);
    rx += this.swayY * 1.2 + Math.cos(ph * 2) * 0.004 * bk; ry += this.swayX * 1.4; rz += Math.sin(ph) * 0.01 * bk + this.swayX * 0.6;
    // sprint pose
    const sp = ease(this.sprint);
    pos.x += -0.02 * sp; pos.y += -0.045 * sp; pos.z += 0.03 * sp; rx += -0.28 * sp; ry += 0.6 * sp; rz += 0.35 * sp;
    // crouch tilt
    rz += 0.05 * this.crouch * (1 - ads);
    // animation offsets
    const tmp = [0, 0, 0, 0, 0, 0], lh = [0, 0, 0, 0];
    let lhW = 0; const lhLocal = V3();
    if (this.anim) {
      const A = this.anim; this.animT += dt;
      while (A.ev && this.evI < A.ev.length && this.animT >= A.ev[this.evI][0]) { this.event(A.ev[this.evI][1]); this.evI++; }
      if (A.gun) { sampleTrack(A.gun, this.animT, tmp); pos.x += tmp[0]; pos.y += tmp[1]; pos.z += tmp[2]; rx += tmp[3]; ry += tmp[4]; rz += tmp[5]; }
      if (A.lh) { sampleTrack(A.lh, this.animT, lh); lhW = lh[0]; lhLocal.set(lh[1], lh[2], lh[3]); }
      if (A.parts) for (const k in A.parts) { const o = [0]; sampleTrack(A.parts[k], this.animT, o); this.parts[k] = o[0]; }
      if (A.nade) { const o = [0, 0, 0, 0]; sampleTrack(A.nade, this.animT, o); this.nade.position.set(o[0], o[1], o[2]); this.nade.rotation.set(o[3], 0.4, 0.2); this.nadeVisible = this.animT > 0.1 && this.animT < 0.67; }
      if (this.animT >= A.dur) { const cb = this.onDone; const nm = this.animName; this.anim = null; this.animName = null; this.nadeVisible = false; if (cb) cb(nm); }
    } else {
      if (this.cycleT > 0) this.cycleT -= dt;
      if (!(this.cycleT > 0)) { const empty = P.weaponAmmo() === 0; if (id === 'garand') this.parts.oprod = empty ? 1 : 0; if (id === 'thompson') this.parts.bolt = empty ? 0 : 1; if (id === 'colt') this.parts.slide = empty ? 1 : 0; }
    }
    pos.z += r.z; rx += r.rx; ry += r.ry; rz += r.rz;
    // ADS: keep sight line centred - offset recoil rotation around the sight
    this.pivot.position.copy(pos); this.pivot.rotation.set(rx, ry, rz, 'YXZ');
    // parts
    if (W.parts.oprod) W.parts.oprod.position.z = this.parts.oprod * 0.095;
    if (W.parts.bolt) W.parts.bolt.position.z = this.parts.bolt * 0.07;
    if (W.parts.slide) W.parts.slide.position.z = this.parts.slide * 0.048;
    if (W.parts.hammer) W.parts.hammer.rotation.x = -0.4 - this.parts.slide * 0.6;
    // left hand target (gun local)
    const lhGrip = anc.gripL.clone();
    const lhT = lhW > 0 ? lhGrip.clone().lerp(lhLocal, clamp(lhW, 0, 1)) : lhGrip;
    // clip/mag placement
    if (id === 'garand') {
      const clip = W.parts.clip; const ammo = P.weaponAmmo();
      clip.visible = this.clipMode !== 'hidden' && (this.clipMode === 'hand' || ammo > 0 || this.animName === 'reloadEmpty' || this.animName === 'reload');
      if (this.clipMode === 'hand') { clip.position.copy(lhT).add(V3(0, 0.035, 0.0)); clip.rotation.set(0, 0, 0.1); this.showRounds(8); }
      else { clip.position.copy(anc.clipSlot); clip.rotation.set(0, 0, 0); if (this.clipMode === 'gun' && !this.anim) this.showRounds(ammo); }
      // stack rounds so top round sits at the top
      const vis = W.parts.rounds.filter(x => x.visible).length;
      W.parts.rounds.forEach((rr, i) => { rr.position.y = 0.022 - (vis - 1 - i) * 0.0078; });
    } else if (W.parts.mag) {
      const mag = W.parts.mag;
      mag.visible = this.magMode !== 'hidden';
      if (this.magMode === 'hand') { mag.position.copy(lhT).add(id === 'colt' ? V3(0, 0.07, 0) : V3(0, 0.13, 0)); }
      else mag.position.copy(anc.magSlot);
      if (W.parts.magTop) W.parts.magTop.visible = P.weaponAmmo() > 0 || this.magMode === 'hand';
    }
    // hands IK (root space)
    this.pivot.updateMatrix(); W.g.updateMatrix();
    const toRoot = (v) => v.clone().applyMatrix4(W.g.matrix).applyMatrix4(this.pivot.matrix);
    const rT = toRoot(anc.gripR), lT = toRoot(lhT);
    if (this.nadeVisible || (this.anim && this.anim.nade && this.animT > 0.1 && this.animT < 0.8)) { rT.copy(this.nade.position).add(V3(0.0, -0.05, 0.03)); }
    this.nade.visible = this.nadeVisible;
    solveFPArm(this.arms.R, rT, V3(0.6, -0.9, 0.3).normalize());
    solveFPArm(this.arms.L, lT, V3(-0.8, -0.8, 0.2).normalize());
    // muzzle flash
    this.flashT -= dt;
    if (this.flashT > 0) { const m = toRoot(anc.muzzle); this.flash.position.copy(m); this.flash.quaternion.setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')); this.flash.rotateZ(Math.random() * TAU); this.flash.visible = true; R.vmFill.intensity = 2.2; R.vmFill.position.copy(this.root.localToWorld(m.clone())); }
    else { this.flash.visible = false; R.vmFill.intensity = 0; }
    // casings
    for (const c of this.casings) {
      if (c.t > 1) continue; c.t += dt;
      c.v.y -= 7 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += c.s.x * dt; c.m.rotation.y += c.s.y * dt;
      if (c.t > 0.8) { c.m.visible = false; c.t = 99; }
    }
    for (const d of this.drops) { d.t += dt; d.v.y -= 7 * dt; d.m.position.addScaledVector(d.v, dt); d.m.rotation.x += d.s.x * dt * 0.3; d.m.rotation.z += d.s.z * dt * 0.3; if (d.t > 1.2) { this.root.remove(d.m); d.dead = true; } }
    this.drops = this.drops.filter(d => !d.dead);
    // vm fov narrows slightly when aiming
    const vf = lerp(52, 40, ads);
    if (Math.abs(R.vmCamera.fov - vf) > 0.01) { R.vmCamera.fov = vf; R.vmCamera.updateProjectionMatrix(); }
    this.muzzleWorld = this.root.localToWorld(toRoot(anc.muzzle));
  }
};
