'use strict';
/* =====================================================================
   Actors: enemies, allies, civilians, grenades, tanks, explosions
   ===================================================================== */
const Actors = {
  list: [], grenades: [], tanks: [], props: [], nadeCd: 4, explosionHooks: [],
  clear() {
    for (const a of this.list) if (a.h) R.scene && R.scene.remove(a.h.root);
    for (const g of this.grenades) R.scene && R.scene.remove(g.m);
    for (const t of this.tanks) { t.engine && t.engine.stop(); }
    this.list = []; this.grenades = []; this.tanks = []; this.props = []; this.nadeCd = 4; this.explosionHooks = [];
  },
  get enemies() { return this.list.filter(a => a.team === 'de'); },
  get allies() { return this.list.filter(a => a.team === 'us'); },
  byName(n) { return this.list.find(a => a.name === n); },
  update(dt) {
    this.nadeCd -= dt;
    for (const a of this.list) a.update(dt);
    for (const g of this.grenades) g.update(dt);
    this.grenades = this.grenades.filter(g => !g.dead);
    for (const t of this.tanks) t.update(dt);
    // corpse cap
    const dead = this.list.filter(a => !a.alive && a.team === 'de');
    if (dead.length > 26) { const a = dead[0]; R.scene.remove(a.h.root); this.list.splice(this.list.indexOf(a), 1); }
  },
  alertNear(pos, r) { for (const a of this.list) if (a.team === 'de' && a.alive && a.pos.distanceTo(pos) < r) a.alert(); },
  explosion(pos, radius, maxDmg, o = {}) {
    FX.explosion(pos, o.size || radius / 6, o);
    SFX.explosion(pos, o.size || radius / 6);
    const pd = Player.pos.clone().add(V3(0, 1, 0)).distanceTo(pos);
    R.shake = Math.max(R.shake, clamp(1.4 - pd / (radius * 3), 0, 1.2) * (o.size || 1));
    if (pd < radius * 1.6) R.shock = Math.max(R.shock, clamp(1 - pd / (radius * 1.6), 0, 1));
    if (pd < radius && !o.noPlayerDmg && lineOfSight(pos.clone().add(V3(0, 0.3, 0)), Player.eyePos())) Player.damage(maxDmg * Math.pow(1 - pd / radius, 1.2) * (o.playerMul || 1), pos, true);
    for (const a of this.list) {
      if (!a.alive || a.invuln) continue;
      const d = a.pos.clone().add(V3(0, 0.8, 0)).distanceTo(pos);
      if (d < radius && lineOfSight(pos.clone().add(V3(0, 0.3, 0)), a.pos.clone().add(V3(0, 1, 0)))) a.damage(maxDmg * 1.6 * Math.pow(1 - d / radius, 0.8), pos, { explosive: true, byPlayer: o.byPlayer });
    }
    for (const h of this.explosionHooks) h(pos, radius, o);
  }
};

/* ---------------- ray vs sphere ---------------- */
function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc; if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc); return t > 0 ? t : -1;
}

/* =====================================================================
   Base actor
   ===================================================================== */
const _t1 = V3(), _t2 = V3();
class Actor {
  constructor(o) {
    this.o = o; this.name = o.name || null; this.team = o.team;
    this.h = makeHuman(o.model || {}); R.scene.add(this.h.root);
    this.pos = o.pos.clone(); if (o.snap !== false && o.fixedY == null) this.pos.y = groundAt(this.pos.x, this.pos.z, Math.max(this.pos.y, terrainH(this.pos.x, this.pos.z)) + 1);
    if (o.fixedY != null) this.pos.y = o.fixedY;
    this.yaw = o.yaw || 0; this.hp = o.hp || 100; this.alive = true; this.speed = 0; this.crouch = 0; this.aimW = 0; this.pitch = 0;
    this.goal = null; this.stuckT = 0; this.lastD = 1e9; this.recoil = 0; this.noCollide = !!o.noCollide;
    this.place();
    Actors.list.push(this);
  }
  place() { this.h.root.position.copy(this.pos); this.h.root.rotation.y = this.yaw + Math.PI; }
  eye(out = V3()) { return out.set(this.pos.x, this.pos.y + (this.crouch > 0.5 ? 1.05 : 1.58), this.pos.z); }
  chest(out = V3()) { return out.set(this.pos.x, this.pos.y + (this.crouch > 0.5 ? 0.8 : 1.25), this.pos.z); }
  faceTo(p, dt, rate = 6) { const y = yawTo(p.x - this.pos.x, p.z - this.pos.z); this.yaw += angleDiff(this.yaw, y) * Math.min(1, rate * dt); }
  moveTo(target, spd, dt) {
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.15) { this.speed = damp(this.speed, 0, 10, dt); return d; }
    const s = Math.min(spd, d / dt * 0.5);
    this.pos.x += dx / d * s * dt; this.pos.z += dz / d * s * dt;
    if (!this.noCollide) collideCircle(this.pos, 0.3, this.pos.y + 0.45, this.pos.y + 1.7, false);
    // separate from other actors
    for (const a of Actors.list) { if (a === this || !a.alive) continue; const ex = this.pos.x - a.pos.x, ez = this.pos.z - a.pos.z, e2 = ex * ex + ez * ez; if (e2 < 0.36 && e2 > 1e-6) { const e = Math.sqrt(e2); this.pos.x += ex / e * (0.6 - e) * 0.5; this.pos.z += ez / e * (0.6 - e) * 0.5; } }
    if (this.o.fixedY == null) { const g = groundAt(this.pos.x, this.pos.z, this.pos.y + 0.3); this.pos.y = damp(this.pos.y, g, 18, dt); }
    this.speed = damp(this.speed, s, 8, dt);
    if (!this.lookTarget) this.yaw += angleDiff(this.yaw, yawTo(dx, dz)) * Math.min(1, 8 * dt);
    // stuck detection
    this.stuckT += dt; if (this.stuckT > 1) { if (this.lastD - d < 0.3) this.stuck = (this.stuck || 0) + 1; else this.stuck = 0; this.lastD = d; this.stuckT = 0; }
    return d;
  }
  hitSpheres() {
    const h = this.h, out = [];
    out.push({ c: h.head.localToWorld(_t1.set(0, 0.1, 0)).clone(), r: 0.125, part: 'head' });
    out.push({ c: h.torso.localToWorld(_t1.set(0, 0.34, 0)).clone(), r: 0.22, part: 'body' });
    out.push({ c: h.torso.localToWorld(_t1.set(0, 0.06, 0)).clone(), r: 0.2, part: 'body' });
    for (const L of [h.legL, h.legR]) { out.push({ c: L.hip.localToWorld(_t1.set(0, -0.22, 0)).clone(), r: 0.11, part: 'limb' }); out.push({ c: L.knee.localToWorld(_t1.set(0, -0.22, 0)).clone(), r: 0.09, part: 'limb' }); }
    for (const A of [h.armL, h.armR]) out.push({ c: A.el.localToWorld(_t1.set(0, -0.12, 0)).clone(), r: 0.07, part: 'limb' });
    return out;
  }
  rayHit(o, d, maxT) {
    if (!this.alive) return null;
    const c = this.pos; const dx = c.x - o.x, dz = c.z - o.z; const along = dx * d.x + dz * d.z;
    if (along < -1 || along > maxT + 1) return null;
    const perp = Math.abs(dx * d.z - dz * d.x); if (perp > 1.2) return null;
    let best = null;
    for (const s of this.hitSpheres()) { const t = raySphere(o, d, s.c, s.r); if (t > 0 && t < maxT && (!best || t < best.t)) best = { t, part: s.part, actor: this }; }
    return best;
  }
  damage() { }
  update(dt) { }
  die(from, o = {}) {
    this.alive = false; this.deathT = 0;
    const fromDir = from ? V3(this.pos.x - from.x, 0, this.pos.z - from.z).normalize() : V3(0, 0, 1);
    // fall away from the shot, in actor-local space
    const fwd = V3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), rgt = V3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.fallX = fromDir.dot(fwd) > 0 ? 1 : -1; this.fallZ = clamp(-fromDir.dot(rgt) * 0.6, -0.5, 0.5) + rand(-0.15, 0.15);
    this.crumple = Math.random() < 0.45;
    if (o.head && this.h.helmet && Math.random() < 0.75) this.popHelmet(fromDir);
    if (this.glint) this.glint.visible = false;
    if (this.h.gun) { const g = this.h.gun; const wp = V3(), wq = new THREE.Quaternion(); g.getWorldPosition(wp); this.h.torso.remove(g); g.position.copy(wp); g.position.y = groundAt(wp.x, wp.z, wp.y) + 0.05; g.rotation.set(Math.PI / 2 * 0, rand(0, 6), Math.PI / 2); R.scene.add(g); this.h.gun = null; }
    if (this.onDeath) this.onDeath(this);
    if (this.team === 'de') Story.onEnemyDeath && Story.onEnemyDeath(this, o);
  }
  popHelmet(dir) {
    const hm = this.h.helmet, wp = V3(); hm.getWorldPosition(wp); this.h.head.remove(hm); hm.position.copy(wp); R.scene.add(hm);
    const v = dir.clone().multiplyScalar(rand(2, 3.5)).add(V3(0, rand(2.5, 4), 0)), spin = V3(rand(-8, 8), rand(-8, 8), rand(-8, 8));
    Actors.props.push({ m: hm, v, spin, t: 0 });
    this.h.helmet = null;
  }
  updateDeath(dt) {
    if (this.deathT > 3) return;
    this.deathT += dt; const t = this.deathT, h = this.h;
    const u = this.crumple ? easeIn(clamp((t - 0.25) / 0.6, 0, 1)) : easeIn(clamp(t / 0.7, 0, 1));
    const kneel = this.crumple ? clamp(t / 0.3, 0, 1) * (1 - u * 0.6) : 0;
    animHuman(h, dt, { speed: 0, crouch: kneel * 0.8 + this.crouch * (1 - u), aim: 0 });
    h.aimW = 0;
    h.root.rotation.order = 'YXZ';
    h.root.rotation.x = this.fallX * u * (Math.PI / 2 - 0.08);
    h.root.rotation.z = this.fallZ * u;
    h.torso.rotation.x += this.fallX * u * 0.25;
    h.head.rotation.x = -this.fallX * u * 0.5; h.head.rotation.y = this.fallZ * 1.2 * u;
    // arms flop
    const splay = u;
    solveArm(h.armR, V3(-0.35 - splay * 0.25, 0.45 + splay * 0.3, 0.15 * this.fallX), POLE_R);
    solveArm(h.armL, V3(0.35 + splay * 0.2, 0.3 + splay * 0.4, -0.1 * this.fallX), POLE_L);
    h.legL.hip.rotation.x = -0.15 * u; h.legR.hip.rotation.x = 0.1 * u; h.legL.knee.rotation.x = 0.3 * u + kneel; h.legR.knee.rotation.x = 0.1 * u + kneel;
    h.hips.position.y = lerp(h.hips.position.y, 0.95, u);
    // settle onto the ground (feet pivot lifts body when lying)
    this.pos.y = damp(this.pos.y, groundAt(this.pos.x, this.pos.z, this.pos.y + 0.5) + 0.02 + u * 0.08, 10, dt);
    this.place(); h.root.rotation.y = this.yaw + Math.PI;
  }
}

/* =====================================================================
   Enemy (German infantry)
   ===================================================================== */
const EWEAPON = {
  kar98: { gun: 'kar98', snd: 'kar98', cd: [1.6, 2.8], burst: [1, 1], rate: 0.1, hit: 0.3, dmg: 38, range: 120 },
  mp40: { gun: 'mp40', snd: 'mp40', cd: [0.9, 1.8], burst: [3, 6], rate: 0.12, hit: 0.13, dmg: 13, range: 45 },
  mg42: { gun: 'mg42', snd: 'mg42', cd: [1.0, 2.2], burst: [10, 24], rate: 0.05, hit: 0.085, dmg: 17, range: 180, tracer: 3 },
  sniper: { gun: 'kar98', snd: 'kar98', cd: [4.5, 6.5], burst: [1, 1], rate: 0.1, hit: 0.6, dmg: 72, range: 200 },
};
class Enemy extends Actor {
  constructor(o) {
    const weapon = o.weapon || 'kar98';
    super({ ...o, team: 'de', model: { side: 'de', weapon: EWEAPON[weapon].gun, skinI: randi(0, 2), hair: pick([MAT.hairBrown, MAT.hairBlond, MAT.hairDark]), ...(o.model || {}) } });
    this.w = EWEAPON[weapon]; this.weapon = weapon;
    this.behavior = o.behavior || 'hold';
    this.spots = (o.spots || [{ peek: this.pos.clone() }]).map(s => ({ peek: s.peek.clone(), hide: s.hide ? s.hide.clone() : null, crouchHide: s.crouchHide !== false, crouchPeek: !!s.crouchPeek }));
    this.spotI = 0; this.alerted = !!o.alert; this.canSee = false; this.seenT = 0; this.losT = rand(0, 0.3);
    this.fireCd = rand(1, 2.5); this.burstLeft = 0; this.burstT = 0; this.peeking = true; this.phaseT = rand(0.5, 2);
    this.lastSeen = Player.pos.clone(); this.nades = o.nades == null ? (weapon === 'mp40' || Math.random() < 0.3 ? 1 : 0) : o.nades;
    this.path = (o.path || []).map(p => p.clone()); this.pathI = 0; this.holdT = 0; this.moving = false;
    this.arc = o.arc || null; this.accMul = o.accMul || 1; this.dmgMul = o.dmgMul || 1; this.hidden = false;
    this.sweep = 0; this.glint = null; this.invisibleUntilAlert = !!o.invisible;
    if (o.crouch) this.crouch = 1;
    if (this.behavior === 'mg') { this.crouch = 1; this.mgYaw = this.yaw; }
    if (this.behavior === 'sniper') { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.spark, color: new THREE.Color(8, 8, 7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.setScalar(0.6); s.visible = false; R.scene.add(s); this.glint = s; }
    this.onDeath = o.onDeath || null; this.tag = o.tag;
  }
  alert() { if (this.alerted) return; this.alerted = true; this.fireCd = Math.max(this.fireCd, rand(0.6, 1.6)); }
  targetPoint(out = V3()) { return Player.chestPos(out); }
  update(dt) {
    if (!this.alive) return this.updateDeath(dt);
    const P = Player;
    // perception
    this.losT -= dt;
    if (this.losT <= 0) {
      this.losT = rand(0.2, 0.34);
      const tp = P.chestPos(_t2), e = this.eye(_t1), d = e.distanceTo(tp);
      let fov = true;
      if (this.arc) { const y = yawTo(tp.x - this.pos.x, tp.z - this.pos.z); fov = Math.abs(angleDiff(this.arc.yaw, y)) < this.arc.half; }
      this.canSee = P.alive && fov && d < this.w.range && (this.alerted || d < 40) && lineOfSight(e, tp) && lineOfSight(e, P.eyePos());
      if (this.canSee && Story.smoke.length && Story.smokeBlocks(e, tp)) this.canSee = false;
      if (this.canSee && !P.hidden) { if (!this.alerted) this.alert(); this.lastSeen.copy(P.pos); this.seenT += 0.3; this.unseenT = 0; }
      else { this.seenT = Math.max(0, this.seenT - 0.15); this.unseenT = (this.unseenT || 0) + 0.3; if (P.hidden) this.canSee = false; }
      this.dist = d;
    }
    // behaviors
    let wantAim = this.alerted ? 1 : 0, target = null, runSpd = 4.2;
    const B = this.behavior;
    if (B === 'hold' || B === 'window' || (B === 'advance' && !this.moving)) {
      const spot = this.spots[this.spotI % this.spots.length];
      if (this.alerted) {
        this.phaseT -= dt;
        if (this.phaseT <= 0) { this.peeking = !this.peeking; this.phaseT = this.peeking ? rand(2.0, 3.8) : rand(1.0, 2.4); }
      } else this.peeking = true;
      const hasHide = !!spot.hide || spot.crouchHide;
      if (!hasHide) this.peeking = true;
      target = this.peeking ? spot.peek : (spot.hide || spot.peek);
      this.crouchTarget = (!this.peeking && spot.crouchHide) || (this.peeking && spot.crouchPeek) ? 1 : 0;
      if (B === 'advance' && this.alerted) { this.holdT -= dt; if (this.holdT <= 0 && this.pathI < this.path.length) { this.moving = true; this.moveTarget = this.path[this.pathI]; } }
      runSpd = 2.2;
    }
    if (B === 'advance' && this.moving) {
      target = this.moveTarget; this.crouchTarget = 0; wantAim = 0.3; runSpd = 4.6;
      if (this.pos.distanceTo(target) < 0.5 || this.stuck > 2) { this.moving = false; this.stuck = 0; this.pathI++; this.spots = [{ peek: target.clone(), hide: null, crouchHide: true }]; this.spotI = 0; this.holdT = rand(4, 8); this.peeking = true; this.phaseT = rand(1.5, 3); }
    }
    if (B === 'rush') {
      if (this.alerted) {
        const d = this.pos.distanceTo(P.pos);
        target = d > 7 ? P.pos : null; runSpd = 4.8; this.crouchTarget = 0; wantAim = d > 12 ? 0.4 : 1;
        if (this.stuck > 3) { this.behavior = 'hold'; this.spots = [{ peek: this.pos.clone(), crouchHide: true }]; }
      }
    }
    if (B === 'mg') {
      this.crouchTarget = 1; target = null;
      if (this.arc && this.canSee === false && this.alerted && this.unseenT > 5 && P.pos.distanceTo(this.pos) < 15) { // flanked: grab rifle
        this.behavior = 'hold'; this.w = EWEAPON.kar98; attachGun(this.h, 'kar98'); this.arc = null; this.spots = [{ peek: this.pos.clone(), crouchHide: false }];
      }
    }
    if (B === 'sniper') {
      const spot = this.spots[0];
      if (this.alerted) { this.phaseT -= dt; if (this.phaseT <= 0) { this.peeking = !this.peeking; this.phaseT = this.peeking ? rand(2.6, 3.6) : rand(2.5, 4.5); } }
      target = this.peeking ? spot.peek : (spot.hide || spot.peek); runSpd = 1.5; this.crouchTarget = 0;
    }
    if (B === 'idle' || B === 'scripted') { target = this.goal; runSpd = this.goalRun ? 4.4 : 1.6; this.crouchTarget = 0; wantAim = this.alerted ? 1 : 0; if (this.alerted && B === 'idle') { this.behavior = 'hold'; this.spots = [{ peek: this.pos.clone(), crouchHide: false }]; } }
    // movement
    if (target) this.moveTo(target, runSpd, dt); else this.speed = damp(this.speed, 0, 10, dt);
    this.crouch = damp(this.crouch, this.crouchTarget || 0, 7, dt);
    // aim / face
    if (this.alerted && (this.canSee || B === 'mg' || this.aimW > 0.3)) {
      const aimAt = this.canSee ? P.pos : this.lastSeen;
      if (B === 'mg' && this.arc) { const y = yawTo(aimAt.x - this.pos.x, aimAt.z - this.pos.z); const lim = clamp(angleDiff(this.arc.yaw, y), -this.arc.half, this.arc.half); this.yaw += angleDiff(this.yaw, this.arc.yaw + lim) * Math.min(1, 2.5 * dt); }
      else if (!this.moving) this.faceTo(aimAt, dt, 5);
      const dy = (aimAt.y + 1.2) - (this.pos.y + 1.4), dh = Math.hypot(aimAt.x - this.pos.x, aimAt.z - this.pos.z);
      this.pitch = damp(this.pitch, Math.atan2(dy, dh), 5, dt);
    }
    this.aimW = damp(this.aimW, wantAim * (this.peeking || B === 'rush' || B === 'mg' ? 1 : 0.4), 6, dt);
    // fire control
    this.fireCd -= dt;
    const peekOk = this.peeking || B === 'rush' || B === 'mg' || (B === 'advance' && this.moving && this.weapon === 'mp40');
    if (this.alerted && peekOk && this.aimW > 0.6 && P.alive) {
      if (this.burstLeft > 0) { this.burstT -= dt; if (this.burstT <= 0) { this.shoot(); this.burstLeft--; this.burstT = this.w.rate; } }
      else if (this.fireCd <= 0) {
        if (this.canSee) { this.burstLeft = randi(this.w.burst[0], this.w.burst[1]); this.burstT = 0; this.fireCd = rand(this.w.cd[0], this.w.cd[1]) + (B === 'mg' ? 0 : 0); }
        else if (Math.random() < 0.35) { this.shootAtAlly(); this.fireCd = rand(this.w.cd[0], this.w.cd[1]); }
        else this.fireCd = 0.5;
      }
    }
    // grenades
    if (this.alerted && this.nades > 0 && Actors.nadeCd <= 0 && B !== 'mg' && B !== 'sniper' && !this.moving && this.o.throws !== false) {
      const d = this.pos.distanceTo(P.pos);
      if (d > 9 && d < 26 && ((this.unseenT || 0) > 3.5 || Math.random() < 0.002)) this.throwNade();
    }
    // sniper glint
    if (this.glint) { this.glint.visible = this.peeking && this.alerted && this.canSee; if (this.glint.visible) { this.eye(this.glint.position); this.glint.position.y -= 0.05; const s = 0.5 + Math.sin(R.time * 9) * 0.25; this.glint.scale.setScalar(s); } }
    this.recoil = damp(this.recoil, 0, 12, dt);
    animHuman(this.h, dt, { speed: this.speed, crouch: this.crouch, aim: this.aimW, pitch: this.pitch, recoil: this.recoil, prone: B === 'mg' });
    this.place();
  }
  shoot() {
    const P = Player, W = this.w, m = humanMuzzle(this.h, V3());
    const tp = P.chestPos(V3());
    const d = m.distanceTo(tp);
    let p = W.hit * clamp(1.35 - d / 75, 0.28, 1.25) * DIFFICULTY[Settings.difficulty].acc * this.accMul;
    if (P.hSpeed > 3) p *= 0.7; if (P.crouchAmt > 0.5) p *= 0.8; if (P.sprinting) p *= 0.75;
    p *= clamp(0.35 + this.seenT * 0.45, 0.35, 1);
    if (Story.playerHitMul != null) p *= Story.playerHitMul;
    SFX.shot(W.snd, m); FX.muzzle(m, tp.clone().sub(m).normalize(), W === EWEAPON.mg42 ? 1.3 : 0.9, true);
    this.recoil = 1; Story.onEnemyShot && Story.onEnemyShot(this);
    const hit = Math.random() < p && this.canSee;
    let aim;
    if (hit) aim = tp;
    else { const off = V3(rand(-1, 1), rand(-0.6, 1), rand(-1, 1)).normalize().multiplyScalar(rand(0.5, 2.2)); aim = tp.clone().add(off); }
    const dir = aim.clone().sub(m).normalize();
    if (W.tracer && Math.random() < 1 / W.tracer) FX.tracer(m, dir, d + 30, { speed: 300, len: 5, w: 1.3 });
    if (hit) { P.damage(W.dmg * DIFFICULTY[Settings.difficulty].dmg * this.dmgMul, this.pos); return; }
    const r = raycast(m, dir, d + 40, { bullet: true });
    if (r.hit) { FX.impact(r.point, r.normal, r.surf); if (r.point.distanceTo(tp) < 6) SFX.impact(r.surf, r.point); }
    // near miss sound
    const cp = P.eyePos(); const toP = cp.clone().sub(m); const along = toP.dot(dir); const closest = m.clone().addScaledVector(dir, along);
    if (along > 0 && closest.distanceTo(cp) < 2.5) { const side = V3().subVectors(closest, cp); const rgt = V3(Math.cos(P.yaw), 0, -Math.sin(P.yaw)); SFX.whiz(clamp(side.dot(rgt), -1, 1)); P.suppress(0.25); }
  }
  shootAtAlly() {
    const allies = Actors.allies.filter(a => a.alive && a.pos.distanceTo(this.pos) < 90); if (!allies.length) return;
    const a = pick(allies), m = humanMuzzle(this.h, V3()), tp = a.chest(V3()).add(V3(rand(-1.5, 1.5), rand(-0.5, 1), rand(-1.5, 1.5)));
    this.faceTo(a.pos, 1, 1);
    SFX.shot(this.w.snd, m); FX.muzzle(m, tp.clone().sub(m).normalize(), 0.9, true); this.recoil = 1;
    const dir = tp.clone().sub(m).normalize(), r = raycast(m, dir, m.distanceTo(tp) + 20, { bullet: true });
    if (r.hit) FX.impact(r.point, r.normal, r.surf);
    if (this.w.tracer) FX.tracer(m, dir, 80, { speed: 300, len: 5, w: 1.3 });
  }
  throwNade() {
    this.nades--; Actors.nadeCd = rand(7, 11) / DIFFICULTY[Settings.difficulty].acc;
    const P = Player, from = this.pos.clone().add(V3(0, 1.7, 0));
    const tgt = P.pos.clone().add(V3(rand(-2.5, 2.5), 0, rand(-2.5, 2.5)));
    const d = V3(tgt.x - from.x, 0, tgt.z - from.z), hd = d.length(); d.normalize();
    const t = clamp(hd / 13, 0.9, 1.9), vy = (tgt.y - from.y + 0.5 * 9.8 * t * t) / t;
    new Grenade(from, V3(d.x * hd / t, vy, d.z * hd / t), 4.2, this);
    this.h.gesture = 1; setTimeout(() => this.h && (this.h.gesture = 0), 500);
    if (Math.random() < 0.6) Story.bark && Story.bark('grenade');
  }
  damage(amt, from, o = {}) {
    if (!this.alive) return false;
    this.hp -= amt; this.alert();
    if (this.behavior === 'hold' && Math.random() < 0.4) { this.peeking = false; this.phaseT = rand(1, 2); }
    if (this.hp <= 0) { this.die(from, o); return true; }
    return false;
  }
}

/* =====================================================================
   Ally (squad)
   ===================================================================== */
class Ally extends Actor {
  constructor(o) {
    super({ ...o, team: 'us', model: { side: 'us', weapon: o.weapon || 'garand', net: true, ...(o.model || {}) } });
    this.weapon = o.weapon || 'garand'; this.fireCd = rand(0.5, 2); this.target = null; this.tT = 0; this.invuln = true; this.follow = null;
    this.combat = o.combat !== false; this.coverCrouch = false; this.killMul = o.killMul == null ? 1 : o.killMul;
  }
  setGoal(p, run = true, crouch = false) { this.goal = p ? p.clone() : null; this.goalRun = run; this.coverCrouch = crouch; this.stuck = 0; }
  teleport(p, yaw) { this.pos.copy(p); this.pos.y = groundAt(p.x, p.z, Math.max(p.y, terrainH(p.x, p.z)) + 1.5); if (yaw != null) this.yaw = yaw; this.goal = null; this.place(); }
  update(dt) {
    if (!this.alive) return this.updateDeath(dt);
    const P = Player;
    let goal = this.goal;
    if (this.follow) { const f = this.follow; const fp = P.pos.clone().add(V3(Math.cos(P.yaw) * f.x - Math.sin(P.yaw) * f.z, 0, -Math.sin(P.yaw) * f.x - Math.cos(P.yaw) * f.z)); if (this.pos.distanceTo(fp) > 2.5) goal = fp; else goal = null; }
    let d = 0;
    if (goal) {
      d = Math.hypot(goal.x - this.pos.x, goal.z - this.pos.z);
      const spd = this.goalRun && d > 2 ? 4.6 : 2.2;
      this.moveTo(goal, spd, dt);
      if (this.stuck > 3 && this.goal) { const vis = R.camera.position.distanceTo(this.pos) > 25 || V3().subVectors(this.pos, R.camera.position).normalize().dot(R.camera.getWorldDirection(V3())) < 0.2; if (vis) { this.teleport(this.goal); } this.stuck = 0; }
    } else this.speed = damp(this.speed, 0, 8, dt);
    const atGoal = !goal || d < 0.6;
    // combat
    this.tT -= dt;
    if (this.combat && this.tT <= 0) {
      this.tT = rand(0.6, 1.1); this.target = null;
      const cands = Actors.list.filter(a => a.team === 'de' && a.alive && a.alerted && a.pos.distanceTo(this.pos) < 85 && !a.invisibleUntilAlert);
      cands.sort((a, b) => a.pos.distanceTo(this.pos) - b.pos.distanceTo(this.pos));
      for (const c of cands.slice(0, 3)) if (lineOfSight(this.eye(), c.chest())) { this.target = c; break; }
    }
    const tgt = this.target && this.target.alive ? this.target : null;
    this.crouch = damp(this.crouch, (atGoal && (this.coverCrouch || (tgt && this.coverCrouchFire))) ? (tgt && this.fireCd < 0.4 ? 0.3 : 1) : 0, 6, dt);
    if (tgt && atGoal) {
      this.faceTo(tgt.pos, dt, 5);
      const dy = (tgt.pos.y + 1.2) - (this.pos.y + 1.4), dh = this.pos.distanceTo(tgt.pos); this.pitch = damp(this.pitch, Math.atan2(dy, dh), 5, dt);
      this.fireCd -= dt;
      if (this.fireCd <= 0) this.fireAt(tgt);
    } else if (!goal && this.lookAt) this.faceTo(this.lookAt, dt, 3);
    this.aimW = damp(this.aimW || 0, tgt ? 1 : (this.alertPose ? 0.7 : 0), 5, dt);
    this.recoil = damp(this.recoil, 0, 12, dt);
    animHuman(this.h, dt, { speed: this.speed, crouch: this.crouch, aim: this.aimW, pitch: this.pitch, recoil: this.recoil, headPitch: this.headPitch || 0 });
    this.place();
  }
  fireAt(t) {
    const burst = this.weapon === 'thompson' ? randi(3, 5) : 1;
    this.fireCd = this.weapon === 'thompson' ? rand(1.2, 2) : this.weapon === 'bar' ? rand(1, 1.8) : rand(1.1, 2.3);
    for (let i = 0; i < burst; i++) setTimeout(() => {
      if (!this.alive || !t.alive || !this.h.gun) return;
      const m = humanMuzzle(this.h, V3()), tp = t.chest(V3());
      SFX.shot(this.weapon === 'thompson' ? 'thompson' : 'garand', m); FX.muzzle(m, tp.clone().sub(m).normalize(), 0.9, true); this.recoil = 1;
      const hitP = (t.peeking === false && t.crouch > 0.5 ? 0.05 : 0.2) * this.killMul * (Story.allyAccMul || 1);
      if (Math.random() < hitP) { t.damage(this.weapon === 'thompson' ? 35 : 60, this.pos); FX.impact(tp, V3(0, 1, 0), 'flesh', tp.clone().sub(m).normalize()); }
      else { const aim = tp.add(V3(rand(-1, 1), rand(-0.5, 1), rand(-1, 1))); const dir = aim.sub(m).normalize(); const r = raycast(m, dir, 120, { bullet: true }); if (r.hit) FX.impact(r.point, r.normal, r.surf); }
    }, i * 110);
  }
}

/* =====================================================================
   NPC (civilians, scripted soldiers)
   ===================================================================== */
class NPC extends Actor {
  constructor(o) { super({ ...o, team: 'npc' }); this.invuln = true; this.hold = o.hold || null; this.talk = 0; this.sit = o.sit || 0; this.handsOn = o.handsOn || null; this.lookAtPlayer = o.lookAtPlayer !== false; this.path = o.path || null; this.pathI = 0; this.walkSpd = o.walkSpd || 1.4; this.loop = !!o.loop; }
  update(dt) {
    if (!this.alive) return this.updateDeath(dt);
    if (this.path && this.pathI < this.path.length) {
      const d = this.moveTo(this.path[this.pathI], this.walkSpd, dt);
      if (d < 0.3) { this.pathI++; if (this.loop && this.pathI >= this.path.length) this.pathI = 0; }
    } else if (this.goal) { const d = this.moveTo(this.goal, this.goalRun ? 4 : this.walkSpd, dt); if (d < 0.2) this.goal = null; }
    else this.speed = damp(this.speed, 0, 8, dt);
    // look at player when near
    const pd = this.pos.distanceTo(Player.pos);
    if (this.lookAtPlayer && pd < 6) {
      const y = yawTo(Player.pos.x - this.pos.x, Player.pos.z - this.pos.z);
      const rel = clamp(angleDiff(this.yaw, y), -1.1, 1.1);
      this.h.lookYaw = rel;
      if (Math.abs(angleDiff(this.yaw, y)) > 1.3 && this.speed < 0.1 && !this.sit) this.yaw += angleDiff(this.yaw, y) * Math.min(1, dt * 2);
    } else this.h.lookYaw = 0;
    if (this.faceTarget) this.faceTo(this.faceTarget, dt, 3);
    this.talk = Math.max(0, this.talk - dt);
    this.h.gesture = damp(this.h.gesture, this.talk > 0 && Math.sin(R.time * 1.3 + this.pos.x) > 0.3 ? 0.6 : 0, 3, dt);
    const s = { speed: this.speed, crouch: this.sit ? 0.55 : 0, aim: this.alertPose ? 0.8 : 0, pitch: 0, handsOn: this.handsOn, headPitch: this.headPitch || (this.talk > 0 ? Math.sin(R.time * 7) * 0.04 : 0) };
    animHuman(this.h, dt, s);
    if (this.sit) { this.h.hips.position.y = 0.5 + (this.sitH || 0); this.h.legL.hip.rotation.x = this.h.legR.hip.rotation.x = -1.45; this.h.legL.knee.rotation.x = this.h.legR.knee.rotation.x = 1.5; this.h.torso.rotation.x = 0.05; }
    this.place();
  }
}

/* =====================================================================
   Grenade projectile
   ===================================================================== */
class Grenade {
  constructor(pos, vel, fuse, owner) {
    this.p = pos.clone(); this.v = vel.clone(); this.fuse = fuse; this.owner = owner; this.dead = false; this.rest = false;
    this.m = buildGrenadeModel(); this.m.scale.setScalar(owner === Player ? 1.1 : 1.2); if (owner !== Player) this.m.children[0].material = MAT.fgrey;
    this.m.traverse(x => { if (x.isMesh) x.castShadow = true; }); R.scene.add(this.m); this.spin = V3(rand(-12, 12), rand(-12, 12), rand(-12, 12));
    Actors.grenades.push(this);
  }
  update(dt) {
    this.fuse -= dt;
    if (this.fuse <= 0) return this.explode();
    if (!this.rest) {
      const sub = 3;
      for (let s = 0; s < sub; s++) {
        const h = dt / sub; this.v.y -= 9.8 * h; const np = this.p.clone().addScaledVector(this.v, h);
        // colliders
        for (const c of queryCols(np.x - 0.1, np.z - 0.1, np.x + 0.1, np.z + 0.1)) {
          if (c.noBullet) continue;
          if (np.x > c.min[0] - 0.05 && np.x < c.max[0] + 0.05 && np.y > c.min[1] - 0.05 && np.y < c.max[1] + 0.05 && np.z > c.min[2] - 0.05 && np.z < c.max[2] + 0.05) {
            const pen = [Math.abs(np.x - c.min[0]), Math.abs(c.max[0] - np.x), Math.abs(np.y - c.min[1]), Math.abs(c.max[1] - np.y), Math.abs(np.z - c.min[2]), Math.abs(c.max[2] - np.z)];
            let mi = 0; for (let i = 1; i < 6; i++) if (pen[i] < pen[mi]) mi = i;
            const ax = mi >> 1; const comp = ax === 0 ? 'x' : ax === 1 ? 'y' : 'z';
            this.v[comp] = -this.v[comp] * 0.35; this.v.multiplyScalar(0.7); np.copy(this.p);
            SFX.mech('tap', this.p);
          }
        }
        const g = terrainH(np.x, np.z);
        if (World.water != null && np.y < World.water) { this.v.multiplyScalar(0.9); this.v.y = Math.max(this.v.y, -1.5); }
        if (np.y < g + 0.04) { np.y = g + 0.04; if (Math.abs(this.v.y) > 1.5) SFX.mech('tap', np); this.v.y = Math.abs(this.v.y) * 0.3; this.v.x *= 0.6; this.v.z *= 0.6; if (this.v.length() < 0.6) this.rest = true; }
        this.p.copy(np);
      }
      this.m.rotation.x += this.spin.x * dt; this.m.rotation.y += this.spin.y * dt; this.spin.multiplyScalar(0.99);
    }
    this.m.position.copy(this.p);
  }
  explode() {
    this.dead = true; R.scene.remove(this.m);
    Actors.explosion(this.p.clone(), 7, this.owner === Player ? 130 : 115, { size: 1, byPlayer: this.owner === Player, playerMul: this.owner === Player ? 1 : DIFFICULTY[Settings.difficulty].dmg * 1.1, grenade: true });
  }
}

/* =====================================================================
   Tanks
   ===================================================================== */
class Tank {
  constructor(o) {
    this.kind = o.kind; this.o = o;
    this.g = o.kind === 'sherman' ? makeSherman() : makePanzerIV(); R.scene.add(this.g);
    this.pos = o.pos.clone(); this.yaw = o.yaw || 0; this.turYaw = 0; this.hp = o.hp || 1; this.alive = true;
    this.path = (o.path || []).map(p => p.clone()); this.pathI = 0; this.speed = 0; this.maxSpeed = o.speed || 3;
    this.fireCd = o.firstShot || 6; this.mgCd = 3; this.hostile = o.hostile !== false; this.active = o.active !== false;
    this.engine = SFX.engine(true, this.pos); this.target = o.target || null;
    this.col = addCol(this.pos.x - 1.7, this.pos.y, this.pos.z - 1.7, this.pos.x + 1.7, this.pos.y + 2.6, this.pos.z + 1.7, { surf: 'metal' });
    Actors.tanks.push(this); this.place();
  }
  place() {
    this.pos.y = terrainH(this.pos.x, this.pos.z);
    this.g.position.copy(this.pos); this.g.rotation.y = this.yaw + Math.PI;
    this.g.userData.turret.rotation.y = this.turYaw;
    const c = this.col; c.min[0] = this.pos.x - 1.8; c.max[0] = this.pos.x + 1.8; c.min[2] = this.pos.z - 1.8; c.max[2] = this.pos.z + 1.8; c.min[1] = this.pos.y; c.max[1] = this.pos.y + 2.7;
    // re-bin collider (cheap: tanks move slowly)
    const cs = World.cs, k = Math.floor(this.pos.x / cs) + ',' + Math.floor(this.pos.z / cs);
    if (k !== this._bin) { this._bin = k; for (let x = Math.floor(c.min[0] / cs); x <= Math.floor(c.max[0] / cs); x++) for (let z = Math.floor(c.min[2] / cs); z <= Math.floor(c.max[2] / cs); z++) { const kk = gkey(x, z); let a = World.grid.get(kk); if (!a) { a = []; World.grid.set(kk, a); } if (!a.includes(c)) a.push(c); } }
  }
  muzzle() { const m = this.g.userData.muzzle.clone(); this.g.userData.gun.localToWorld(m); return m; }
  update(dt) {
    if (!this.alive) { if (this.engine) { this.engine.stop(); this.engine = null; } return; }
    if (this.engine) this.engine.update(this.pos, this.speed / this.maxSpeed);
    if (!this.active) return;
    // drive
    if (this.pathI < this.path.length) {
      const t = this.path[this.pathI], dx = t.x - this.pos.x, dz = t.z - this.pos.z, d = Math.hypot(dx, dz);
      const want = yawTo(dx, dz); this.yaw += clamp(angleDiff(this.yaw, want), -0.5 * dt, 0.5 * dt);
      const aligned = Math.abs(angleDiff(this.yaw, want)) < 0.3;
      this.speed = damp(this.speed, aligned ? this.maxSpeed : 0.8, 1.5, dt);
      this.pos.x += -Math.sin(this.yaw) * this.speed * dt; this.pos.z += -Math.cos(this.yaw) * this.speed * dt;
      if (d < 1.5) this.pathI++;
    } else this.speed = damp(this.speed, 0, 2, dt);
    // turret
    const tgt = this.target ? (typeof this.target === 'function' ? this.target() : this.target) : (this.hostile ? Player.pos : null);
    if (tgt) {
      const want = angleDiff(this.yaw, yawTo(tgt.x - this.pos.x, tgt.z - this.pos.z));
      this.turYaw += clamp(angleDiff(this.turYaw, want), -0.45 * dt, 0.45 * dt);
      const aligned = Math.abs(angleDiff(this.turYaw, want)) < 0.06;
      this.fireCd -= dt; this.mgCd -= dt;
      const m = this.muzzle();
      const vis = this.hostile ? lineOfSight(m, Player.eyePos()) : true;
      if (aligned && this.fireCd <= 0 && vis) this.fireMain(tgt);
      if (this.hostile && this.mgCd <= 0 && vis && Player.pos.distanceTo(this.pos) < 70) this.fireMG();
    }
    this.place();
  }
  fireMain(tgt) {
    this.fireCd = this.o.reload || rand(6, 8);
    const m = this.muzzle(), aim = tgt.clone().add(V3(0, 1, 0));
    if (this.hostile) aim.add(V3(rand(-2.5, 2.5), rand(-0.5, 1), rand(-2.5, 2.5)).multiplyScalar(Player.hSpeed > 3 ? 1.4 : 0.8));
    const dir = aim.clone().sub(m).normalize();
    SFX.shot('sherman', m); FX.muzzle(m, dir, 4, true);
    for (let i = 0; i < 12; i++) FX.smoke.emit({ x: m.x, y: m.y, z: m.z, vx: dir.x * 8 + rand(-2, 2), vy: rand(0, 2), vz: dir.z * 8 + rand(-2, 2), drag: 2, life: rand(2, 4), s0: 1, s1: 5, c0: [0.6, 0.58, 0.55, 0.6], c1: [0.6, 0.58, 0.55, 0] });
    this.g.userData.gun.position.z -= 0.35; setTimeout(() => { if (this.g) this.g.userData.gun.position.z += 0.35; }, 250);
    const r = raycast(m, dir, 250, { bullet: true, ignore: this.col });
    setTimeout(() => Actors.explosion(r.point.clone().addScaledVector(r.normal, 0.3), 6.5, this.hostile ? 95 : 150, { size: 1.5, noPlayerDmg: !this.hostile, playerMul: DIFFICULTY[Settings.difficulty].dmg }), 60);
  }
  fireMG() {
    this.mgCd = rand(2.5, 4); const n = randi(8, 14);
    for (let i = 0; i < n; i++) setTimeout(() => {
      if (!this.alive) return;
      const m = this.g.userData.turret.localToWorld(V3(0.3, 0.45, 1.3)); const tp = Player.chestPos(V3()).add(V3(rand(-1.2, 1.2), rand(-0.5, 0.8), rand(-1.2, 1.2)));
      const dir = tp.clone().sub(m).normalize();
      SFX.shot('mg42', m); if (i % 3 === 0) FX.tracer(m, dir, 90, { speed: 280, len: 5 });
      if (Math.random() < 0.06 * DIFFICULTY[Settings.difficulty].acc && lineOfSight(m, Player.chestPos())) Player.damage(14 * DIFFICULTY[Settings.difficulty].dmg, this.pos);
      else { const r = raycast(m, dir, 100, { bullet: true, ignore: this.col }); if (r.hit) FX.impact(r.point, r.normal, r.surf); }
    }, i * 70);
  }
  destroy() {
    if (!this.alive) return; this.alive = false;
    Actors.explosion(this.pos.clone().add(V3(0, 1.5, 0)), 8, 60, { size: 2.2, noPlayerDmg: Player.pos.distanceTo(this.pos) > 9 });
    const t = this.g.userData.turret; t.rotation.z = 0.12; t.position.y += 0.15; this.turYaw += 0.4;
    this.g.traverse(m => { if (m.isMesh && m.material && m.material.color) { m.material = m.material.clone(); m.material.color.multiplyScalar(0.25); m.material.userData.dispose = true; } });
    FX.fireEmitter(this.pos.clone().add(V3(0, 2.2, 0)), { size: 1.3 });
    FX.smokeColumn(this.pos.clone().add(V3(0, 2.5, 0)), { size: 0.7, rate: 4, dark: 0.1 });
  }
}
/* helmets & loose props physics */
function updateProps(dt) {
  for (const p of Actors.props) {
    if (p.t > 4) continue; p.t += dt; p.v.y -= 9.8 * dt; p.m.position.addScaledVector(p.v, dt);
    p.m.rotation.x += p.spin.x * dt; p.m.rotation.z += p.spin.z * dt;
    const g = terrainH(p.m.position.x, p.m.position.z);
    const gg = groundAt(p.m.position.x, p.m.position.z, p.m.position.y + 0.2);
    if (p.m.position.y < gg + 0.08) { p.m.position.y = gg + 0.08; p.v.multiplyScalar(0.4); p.v.y = Math.abs(p.v.y) * 0.3; p.spin.multiplyScalar(0.5); }
  }
}
