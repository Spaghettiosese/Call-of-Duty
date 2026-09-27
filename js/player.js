'use strict';
/* =====================================================================
   Player controller: movement, weapons, damage, interaction
   ===================================================================== */
const WDEF = {
  garand: { name: 'M1 GARAND', mag: 8, maxRes: 96, dmg: 105, head: 2.2, limb: 0.72, rate: 0.14, auto: false, hip: 2.6, ads: 0.12, rec: [0.022, 0.006], range: 400, zoom: 0.72, snd: 'garand' },
  thompson: { name: 'M1A1 THOMPSON', mag: 30, maxRes: 240, dmg: 32, head: 2.0, limb: 0.8, rate: 0.088, auto: true, hip: 3.6, ads: 1.0, rec: [0.0085, 0.006], range: 90, zoom: 0.84, snd: 'thompson', tracer: 4 },
  kar98: { name: 'KAR98K', mag: 5, maxRes: 60, dmg: 125, head: 2.2, limb: 0.8, rate: 1.1, auto: false, hip: 2.8, ads: 0.07, rec: [0.034, 0.008], range: 450, zoom: 0.68, snd: 'kar98', bolt: true },
  mp40: { name: 'MP 40', mag: 32, maxRes: 192, dmg: 28, head: 2.0, limb: 0.8, rate: 0.109, auto: true, hip: 3.8, ads: 1.05, rec: [0.0075, 0.005], range: 80, zoom: 0.85, snd: 'mp40' },
  colt: { name: 'M1911', mag: 7, maxRes: 70, dmg: 48, head: 2.6, limb: 0.8, rate: 0.15, auto: false, hip: 2.2, ads: 0.55, rec: [0.03, 0.01], range: 60, zoom: 0.9, snd: 'colt' },
};
const Player = {
  pos: V3(), vel: V3(), yaw: 0, pitch: 0, onGround: true, crouching: false, crouchAmt: 0, sprinting: false, adsWant: false,
  health: 100, maxHealth: 100, medkits: 2, nades: 3, alive: true, weapons: [], wi: 0, fireCd: 0,
  control: true, look: true, armed: true, stepPhase: 0, hSpeed: 0, lookDX: 0, lookDY: 0, recP: 0, recY: 0, lastHurt: 99,
  stats: null, interactT: 0, vault: null, deathT: 0, hidden: false, suppressT: 0, lookLimit: null, invuln: false, beatT: 0, wasOnGround: true, fallV: 0,
  spawn(pos, yaw, loadout) {
    this.pos.copy(pos); this.pos.y = groundAt(pos.x, pos.z, Math.max(pos.y, terrainH(pos.x, pos.z)) + 1); this.vel.set(0, 0, 0); this.yaw = yaw || 0; this.pitch = 0;
    this.alive = true; this.health = this.maxHealth; this.deathT = 0; this.crouching = false; this.crouchAmt = 0; this.vault = null; this.recP = this.recY = 0; this.lastHurt = 99;
    this.control = true; this.look = true; this.hidden = false; this.lookLimit = null; this.invuln = false; this.ride = false; this.rideRoll = 0;
    const L = loadout || { weapons: [], medkits: 0, nades: 0 };
    this.weapons = L.weapons.map(w => ({ id: w.id || w, mag: w.mag == null ? WDEF[w.id || w].mag : w.mag, res: w.res == null ? WDEF[w.id || w].mag * 5 : w.res }));
    this.medkits = L.medkits || 0; this.nades = L.nades || 0; this.wi = 0; this.armed = this.weapons.length > 0;
    VM.equip(this.armed ? this.weapons[0].id : null, true);
    this.updateHud();
  },
  give(id, o = {}) {
    let w = this.weapons.find(x => x.id === id);
    if (!w) { w = { id, mag: WDEF[id].mag, res: o.res == null ? WDEF[id].mag * 4 : o.res }; this.weapons.push(w); }
    if (o.equip !== false) this.switchTo(this.weapons.indexOf(w));
    this.armed = true; this.updateHud();
  },
  cur() { return this.weapons[this.wi]; },
  weaponAmmo() { const w = this.cur(); return w ? w.mag : 0; },
  eyeH() { return lerp(1.64, 1.08, this.crouchAmt); },
  eyePos(out = V3()) { return out.set(this.pos.x, this.pos.y + this.eyeH(), this.pos.z); },
  chestPos(out = V3()) { return out.set(this.pos.x, this.pos.y + this.eyeH() - 0.35, this.pos.z); },
  forward(out = V3()) { return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)); },
  suppress(a) { this.suppressT = Math.min(1, this.suppressT + a); },
  updateHud() {
    const w = this.cur();
    if (w) HUD.ammo(w.mag, w.res, WDEF[w.id].name, w.mag <= Math.ceil(WDEF[w.id].mag * 0.25));
    HUD.health(this.health, this.maxHealth, this.medkits); HUD.nades(this.nades);
    HUD.weaponsVisible(this.armed && !!w);
  },
  switchTo(i) {
    if (i === this.wi && VM.curId === this.weapons[i].id) return;
    if (!this.weapons[i]) return;
    VM.cancel(); this.wi = i; VM.equip(this.weapons[i].id); this.fireCd = 0.45; this.updateHud();
  },
  damage(amt, from, explosive) {
    if (!this.alive || this.invuln || Story.cinematic) return;
    this.health -= amt; this.lastHurt = 0; R.dmg = Math.min(1, R.dmg + amt / 60);
    if (from) { const a = angleDiff(this.yaw, yawTo(from.x - this.pos.x, from.z - this.pos.z)); HUD.damageFrom(-a); }
    SFX.hurt(); this.recP += 0.02; this.recY += rand(-0.02, 0.02);
    if (this.health <= 0) this.die();
    this.updateHud();
  },
  die() {
    if (!this.alive) return;
    this.alive = false; this.health = 0; this.deathT = 0; this.stats && this.stats.deaths++;
    VM.visible = false; Input.lmb = false;
    Story.onPlayerDeath();
  },
  heal() { this.health = this.maxHealth; this.medkits--; SFX.heal(); HUD.notify('Medkit used'); this.updateHud(); R.dmg = 0; },
  /* ---------------- per-frame ---------------- */
  update(dt) {
    const I = Input;
    this.lastHurt += dt;
    // death camera
    if (!this.alive) {
      this.deathT += dt; const u = easeOut(clamp(this.deathT / 1.2, 0, 1));
      R.camera.position.set(this.pos.x, this.pos.y + lerp(this.eyeH(), 0.3, u), this.pos.z);
      R.camera.rotation.set(this.pitch * (1 - u) + u * 0.2, this.yaw, u * 0.9);
      R.dmg = Math.min(1, R.dmg + dt); return;
    }
    // look
    const sens = 0.0022 * Settings.sens * (1 - VM.ads * 0.35);
    let dx = I.mdx, dy = I.mdy;
    if (I.down('ArrowLeft')) dx -= 600 * dt; if (I.down('ArrowRight')) dx += 600 * dt; if (I.down('ArrowUp')) dy -= 400 * dt; if (I.down('ArrowDown')) dy += 400 * dt;
    if (!this.look || Story.cam) { dx = 0; dy = 0; }
    this.lookDX = dx / Math.max(dt, 0.001) * 0.016; this.lookDY = dy / Math.max(dt, 0.001) * 0.016;
    this.yaw -= dx * sens; this.pitch -= dy * sens * (Settings.invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -1.45, 1.45);
    if (this.lookLimit) { const L = this.lookLimit; const d = angleDiff(L.yaw, this.yaw); if (Math.abs(d) > L.half) this.yaw = L.yaw + Math.sign(d) * L.half; this.pitch = clamp(this.pitch, L.pmin == null ? -0.9 : L.pmin, L.pmax == null ? 0.7 : L.pmax); }
    // recoil recovery
    this.recP = damp(this.recP, 0, 9, dt); this.recY = damp(this.recY, 0, 9, dt);
    this.suppressT = Math.max(0, this.suppressT - dt * 0.4);
    if (this.ride) { // carried by a vehicle / scripted seat
      this.hSpeed = 0; this.onGround = true; this.vel.set(0, 0, 0); this.sprinting = false;
      const sh = R.shake * 0.08;
      if (!Story.cam) { R.camera.position.set(this.pos.x + rand(-sh, sh), this.pos.y + this.eyeH() + rand(-sh, sh), this.pos.z); R.camera.rotation.set(this.pitch + this.recP, this.yaw + this.recY, this.rideRoll || 0); }
      this.adsWant = false; HUD.crosshair(0, false); HUD.interact(null);
      setFov(Settings.fov); SFX.listener.pos.copy(R.camera.position); SFX.listener.yaw = this.yaw;
      R.dmg = damp(R.dmg, 0, 2, dt); return;
    }
    // movement
    const ctl = this.control && !this.vault;
    const f = (ctl && (I.down('KeyW') ? 1 : 0)) - (ctl && (I.down('KeyS') ? 1 : 0));
    const s = (ctl && (I.down('KeyD') ? 1 : 0)) - (ctl && (I.down('KeyA') ? 1 : 0));
    if (ctl && (I.hit('KeyC') || I.hit('ControlLeft'))) { if (this.crouching) { if (ceilingAt(this.pos.x, this.pos.z, this.pos.y) > this.pos.y + 1.85) this.crouching = false; } else this.crouching = true; }
    const busy = VM.busy();
    this.sprinting = ctl && I.down('ShiftLeft') && f > 0 && !this.adsWant && this.onGround && !I.lmb;
    if (this.sprinting && this.crouching && ceilingAt(this.pos.x, this.pos.z, this.pos.y) > this.pos.y + 1.85) this.crouching = false;
    if (this.sprinting && this.crouching) this.sprinting = false;
    this.crouchAmt = damp(this.crouchAmt, this.crouching ? 1 : 0, 10, dt);
    const depth = World.water != null ? World.water - this.pos.y : 0;
    this.inWater = depth > 0.15;
    let spd = this.sprinting ? 6.6 : this.crouching ? 2.3 : 4.3;
    if (this.adsWant) spd *= 0.62;
    if (this.inWater) spd *= clamp(1 - depth * 0.45, 0.4, 0.85);
    if (Story.speedMul) spd *= Story.speedMul;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let wx = fx * f + rx * s, wz = fz * f + rz * s; const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
    const acc = this.onGround ? 11 : 2;
    this.vel.x = damp(this.vel.x, wx * spd, acc, dt); this.vel.z = damp(this.vel.z, wz * spd, acc, dt);
    if (this.vault) this.updateVault(dt);
    else {
      this.vel.y -= 19 * dt;
      if (ctl && I.hit('Space') && this.onGround) { if (!this.tryVault()) { this.vel.y = 5.4; this.onGround = false; } }
      const ox = this.pos.x, oz = this.pos.z, oy = this.pos.y;
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vel.y * dt;
      const head = this.pos.y + (this.crouching ? 1.25 : 1.8);
      collideCircle(this.pos, 0.33, this.pos.y + 0.42, head, true);
      // terrain slope limit
      if (World.terrain) {
        const tOld = terrainH(ox, oz), tNew = terrainH(this.pos.x, this.pos.z), hd = Math.hypot(this.pos.x - ox, this.pos.z - oz);
        if (tNew > oy + 0.05 && tNew - tOld > hd * 1.15 + 0.01) {
          // try sliding along one axis
          const tx = terrainH(this.pos.x, oz), tz = terrainH(ox, this.pos.z);
          if (tx - tOld <= Math.abs(this.pos.x - ox) * 1.15 + 0.01) this.pos.z = oz;
          else if (tz - tOld <= Math.abs(this.pos.z - oz) * 1.15 + 0.01) this.pos.x = ox;
          else { this.pos.x = ox; this.pos.z = oz; }
        }
      }
      if (World.bounds) { const B = World.bounds; this.pos.x = clamp(this.pos.x, B[0], B[2]); this.pos.z = clamp(this.pos.z, B[1], B[3]); }
      const g = groundAt(this.pos.x, this.pos.z, Math.max(oy, this.pos.y));
      this.surf = World._lastSurf || (World.surfaceAt ? World.surfaceAt(this.pos.x, this.pos.z) : 'dirt');
      if (this.inWater) this.surf = 'water';
      if (this.pos.y <= g + (this.onGround ? 0.35 : 0.02) && this.vel.y <= 0.01) {
        if (!this.wasOnGround) { const fv = -this.fallV; if (fv > 3) { VM.landV -= fv * 0.012; SFX.footstep(this.surf, 0.4); } if (fv > 13) this.damage((fv - 13) * 12); }
        this.pos.y = g; this.vel.y = 0; this.onGround = true;
      } else this.onGround = false;
      this.fallV = this.vel.y; this.wasOnGround = this.onGround;
    }
    this.hSpeed = Math.hypot(this.vel.x, this.vel.z);
    // footsteps
    const prev = this.stepPhase;
    if (this.onGround) this.stepPhase += this.hSpeed * dt * (this.sprinting ? 1.55 : 1.85);
    if (Math.floor(prev / Math.PI) !== Math.floor(this.stepPhase / Math.PI) && this.hSpeed > 0.8) SFX.footstep(this.surf, this.crouching ? 0.12 : this.sprinting ? 0.3 : 0.2);
    // camera
    if (!Story.cam) {
      const bob = this.onGround ? Math.abs(Math.sin(this.stepPhase)) * 0.035 * clamp(this.hSpeed / 4.5, 0, 1.4) * (1 - VM.ads * 0.7) : 0;
      const sh = R.shake * 0.08;
      R.camera.position.set(this.pos.x + rand(-sh, sh), this.pos.y + this.eyeH() - bob + rand(-sh, sh), this.pos.z + rand(-sh, sh));
      R.camera.rotation.set(this.pitch + this.recP + rand(-sh, sh) * 0.3, this.yaw + this.recY, Math.sin(this.stepPhase * 0.5) * 0.004 * this.hSpeed * (1 - VM.ads));
    }
    // weapons
    this.updateWeapons(dt);
    // interaction
    this.updateInteract(dt);
    // health regen (to the next quarter)
    if (this.lastHurt > 4.5 && this.health < this.maxHealth) { const cap = Math.min(this.maxHealth, Math.ceil(this.health / 25) * 25); if (this.health < cap) { this.health = Math.min(cap, this.health + 9 * dt); this.updateHud(); } }
    R.dmg = damp(R.dmg, clamp((45 - this.health) / 45, 0, 0.75) + this.suppressT * 0.25, 2.5, dt);
    if (this.health < 35) { this.beatT -= dt; if (this.beatT <= 0) { SFX.heartbeat(); this.beatT = 0.9; } }
    // FOV
    const w = this.cur(), zoom = w && this.armed ? WDEF[w.id].zoom : 1;
    setFov(Settings.fov * lerp(1, zoom, ease(VM.ads)) * (1 + ease(VM.sprint) * 0.06));
    // audio listener
    SFX.listener.pos.copy(R.camera.position); SFX.listener.yaw = this.yaw;
  },
  tryVault() {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), d = V3(fx, 0, fz);
    const lo = raycast(V3(this.pos.x, this.pos.y + 0.55, this.pos.z), d, 1.0, { noWater: true });
    if (!lo.hit || lo.hit === 'terrain') return false;
    const hi = raycast(V3(this.pos.x, this.pos.y + 1.45, this.pos.z), d, 1.3, { noWater: true });
    if (hi.hit && hi.t < lo.t + 0.4) return false;
    const land = V3(this.pos.x, 0, this.pos.z).addScaledVector(d, lo.t + 0.45);
    const top = groundAt(land.x, land.z, this.pos.y + 1.35);
    if (top - this.pos.y < 0.4 || top - this.pos.y > 1.35) return false;
    this.vault = { from: this.pos.clone(), to: V3(land.x, top, land.z), t: 0, dur: 0.42 };
    SFX.mech('cloth'); VM.landV += 0.4; return true;
  },
  updateVault(dt) {
    const v = this.vault; v.t += dt; const u = clamp(v.t / v.dur, 0, 1);
    const up = Math.max(v.from.y, v.to.y) + 0.35;
    this.pos.x = lerp(v.from.x, v.to.x, ease(u)); this.pos.z = lerp(v.from.z, v.to.z, ease(u));
    this.pos.y = u < 0.5 ? lerp(v.from.y, up, easeOut(u * 2)) : lerp(up, v.to.y, easeIn((u - 0.5) * 2));
    if (u >= 1) { this.vault = null; this.vel.set(-Math.sin(this.yaw) * 2, 0, -Math.cos(this.yaw) * 2); this.onGround = true; this.wasOnGround = true; }
  },
  /* ---------------- weapons ---------------- */
  updateWeapons(dt) {
    const I = Input, w = this.cur(), canAct = this.armed && w && this.control && !Story.cam && !this.vault;
    this.fireCd -= dt;
    this.adsWant = canAct && I.rmb && !['reload', 'reloadEmpty', 'inspect', 'melee', 'grenade', 'medkit'].includes(VM.animName);
    if (!canAct) { HUD.crosshair(0, false); return; }
    const D = WDEF[w.id];
    // switching
    if (I.hit('Digit1') && this.weapons[0]) this.switchTo(0);
    if (I.hit('Digit2') && this.weapons[1]) this.switchTo(1);
    if (I.wheel && this.weapons.length > 1) this.switchTo((this.wi + (I.wheel > 0 ? 1 : this.weapons.length - 1)) % this.weapons.length);
    const busy = VM.busy() && VM.animName !== 'draw';
    // reload
    const tryReload = () => {
      if (w.mag >= D.mag || w.res <= 0 || busy) return false;
      const empty = w.mag === 0;
      VM.onRefill = () => {
        if (w.id === 'garand' && !empty) { w.res += w.mag; w.mag = 0; } // partial clip ejected, rounds recovered
        const take = Math.min(D.mag - w.mag, w.res); w.mag += take; w.res -= take; this.updateHud();
      };
      VM.play(empty ? 'reloadEmpty' : 'reload', null, true); return true;
    };
    if (I.hit('KeyR')) tryReload();
    if (I.hit('KeyF') && !busy) VM.play('inspect');
    // fire
    const want = D.auto ? I.lmb : I.lmbPressed;
    if (want && this.sprinting) this.sprinting = false;
    if (want && VM.animName === 'inspect') VM.cancel();
    if (want && !busy && this.fireCd <= 0 && VM.animName !== 'draw') {
      if (w.mag > 0) this.shoot(w, D);
      else if (I.lmbPressed) { SFX.mech('dry'); if (!tryReload()) HUD.hint('Out of ammo', 1.5); }
    }
    // melee
    if (I.hit('KeyV') && !busy) {
      VM.onMeleeHit = () => {
        const e = this.eyePos(), fwd = this.forward();
        for (const a of Actors.list) if (a.team === 'de' && a.alive) { const d = a.pos.clone().add(V3(0, 1.1, 0)).sub(e); if (d.length() < 2.4 && d.normalize().dot(fwd) > 0.6) { a.damage(200, this.pos, { melee: true }); this.onHit(a, true, false); SFX.impact('flesh', a.pos); R.shake = 0.3; break; } }
      };
      VM.play('melee', null, true);
    }
    // grenade
    if (I.hit('KeyG') && !busy && this.nades > 0) {
      VM.onThrow = () => {
        this.nades--; this.updateHud();
        const e = this.eyePos(), fwd = this.forward(); const rgt = V3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        const p = e.clone().addScaledVector(fwd, 0.5).addScaledVector(rgt, 0.15);
        const v = fwd.clone().multiplyScalar(17).add(V3(0, 3.8, 0)).add(this.vel.clone().multiplyScalar(0.6));
        new Grenade(p, v, 3.3, this); this.stats && this.stats.nades++;
      };
      VM.play('grenade', null, true);
    }
    // medkit
    if (I.hit('KeyQ') && !busy && this.medkits > 0) { if (this.health < this.maxHealth - 1) { VM.onHeal = () => this.heal(); VM.play('medkit', null, true); } else HUD.hint('Health is full', 1.5); }
    // spread visual
    const sp = lerp(D.hip, D.ads, ease(VM.ads)) + this.hSpeed * 0.35 + (this.onGround ? 0 : 2);
    HUD.crosshair(sp, VM.ads < 0.5 && VM.sprint < 0.5 && !busy);
  },
  shoot(w, D) {
    w.mag--; this.fireCd = D.rate; this.stats && this.stats.shots++;
    SFX.shot(D.snd, null, true); VM.fire(w.id);
    const adsK = ease(VM.ads);
    this.recP += D.rec[0] * (1 - adsK * 0.45) * (this.crouching ? 0.8 : 1); this.recY += rand(-1, 1) * D.rec[1];
    if (D.auto) { this.pitch += D.rec[0] * 0.45; this.yaw += rand(-0.3, 0.6) * D.rec[1] * 0.4; }
    const spreadDeg = lerp(D.hip, D.ads, adsK) * (this.crouching ? 0.75 : 1) + this.hSpeed * 0.35 + (this.onGround ? 0 : 2.5);
    const e = R.camera.position.clone(), fwd = V3(); R.camera.getWorldDirection(fwd);
    const sr_ = Math.tan(spreadDeg * DEG * 0.5) * Math.sqrt(Math.random()), a = Math.random() * TAU;
    const up = V3(0, 1, 0).applyQuaternion(R.camera.quaternion), rg = V3(1, 0, 0).applyQuaternion(R.camera.quaternion);
    const dir = fwd.clone().addScaledVector(up, Math.sin(a) * sr_).addScaledVector(rg, Math.cos(a) * sr_).normalize();
    this.fireRay(e, dir, D, w);
    // world muzzle effects
    const m = VM.muzzleWorld || e.clone().addScaledVector(fwd, 0.8);
    FX.smoke.emit({ x: m.x, y: m.y, z: m.z, vx: dir.x * 1.5, vy: 0.4, vz: dir.z * 1.5, drag: 3, life: 1.2, s0: 0.05, s1: 0.5, c0: [0.75, 0.73, 0.7, 0.18], c1: [0.75, 0.73, 0.7, 0] });
    R.muzzleLight.position.copy(m); R.muzzleLight.intensity = 3.2; this.muzzleT = 0.05;
    if (D.tracer && (this.stats ? this.stats.shots : 0) % D.tracer === 0) FX.tracer(m, dir, 80, { speed: 360, len: 4, start: 1 });
    Actors.alertNear(this.pos, 55);
    if (w.mag === 0 && w.id === 'garand') VM.ejectClip();
    if (w.mag === 0 && w.res > 0 && w.id !== 'garand') setTimeout(() => { if (this.cur() === w && w.mag === 0 && !VM.busy()) { VM.onRefill = () => { const take = Math.min(D.mag - w.mag, w.res); w.mag += take; w.res -= take; this.updateHud(); }; VM.play('reloadEmpty', null, true); } }, 350);
    if (w.mag === 0 && w.res > 0 && w.id === 'garand') setTimeout(() => { if (this.cur() === w && w.mag === 0 && !VM.busy()) { VM.onRefill = () => { const take = Math.min(D.mag, w.res); w.mag += take; w.res -= take; this.updateHud(); }; VM.play('reloadEmpty', null, true); } }, 450);
    this.updateHud();
  },
  fireRay(o, d, D, w) {
    let best = null;
    for (const a of Actors.list) { if (a.team === 'npc' || a.team === 'us' || !a.alive) continue; const h = a.rayHit(o, d, D.range); if (h && (!best || h.t < best.t)) best = h; }
    for (const t of Story.targets || []) { const h = t.rayHit(o, d); if (h && (!best || h.t < best.t)) best = h; }
    const r = raycast(o, d, best ? best.t : D.range, { bullet: true });
    if (best && (!r.hit || r.t >= best.t - 0.01)) {
      const pt = o.clone().addScaledVector(d, best.t);
      if (best.target) { best.target.hit(pt); return; }
      const a = best.actor, mul = best.part === 'head' ? D.head : best.part === 'limb' ? D.limb : 1;
      let dmg = D.dmg * mul; if (best.t > D.range * 0.6) dmg *= 0.75;
      FX.impact(pt, d.clone().negate(), 'flesh', d); SFX.impact('flesh', pt);
      const killed = a.damage(dmg, this.pos, { head: best.part === 'head', byPlayer: true });
      this.onHit(a, killed, best.part === 'head');
      return;
    }
    if (r.hit) { FX.impact(r.point, r.normal, r.surf, d); if (r.t < 25) SFX.impact(r.surf, r.point); if (Story.onPlayerBulletHit) Story.onPlayerBulletHit(r); }
  },
  onHit(a, killed, head) {
    HUD.hitmark(killed); SFX.hitmarker(killed);
    if (this.stats) { this.stats.hits++; if (killed) { this.stats.kills++; if (head) this.stats.heads++; } }
  },
  /* ---------------- interaction ---------------- */
  updateInteract(dt) {
    let best = null, bd = 1e9; const e = this.eyePos(), fwd = this.forward();
    if (this.alive && this.control && !Story.cam) for (const it of Story.inter.concat(Pickups.list)) {
      if (!it.enabled) continue; const p = typeof it.pos === 'function' ? it.pos() : it.pos;
      const d = p.distanceTo(e); if (d > (it.r || 2.2)) continue;
      const dir = p.clone().sub(e).normalize(); const dot = dir.dot(fwd);
      if (dot < (it.cone == null ? 0.55 : it.cone) && d > 0.9) continue;
      if (d < bd) { bd = d; best = it; }
    }
    if (best !== this.focus) { this.interactT = 0; this.focus = best; }
    if (!best) { HUD.interact(null); return; }
    const hold = best.hold || 0;
    if (Input.down('KeyE')) {
      if (hold > 0) { this.interactT += dt; if (this.interactT >= hold) { this.interactT = 0; best.use(); } }
      else if (Input.hit('KeyE')) best.use();
    } else this.interactT = 0;
    HUD.interact((hold > 0 ? 'Hold to ' : '') + best.text, hold > 0 ? this.interactT / hold : 0);
  },
  endFrame(dt) {
    if (this.muzzleT > 0) { this.muzzleT -= dt; if (this.muzzleT <= 0) R.muzzleLight.intensity = 0; }
  }
};
