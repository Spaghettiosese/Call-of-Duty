'use strict';
/* =====================================================================
   Story engine — missions are lists of async stages. Every await goes
   through game-time timers, so pausing freezes scripts and restarting
   a checkpoint simply abandons the old run.
   ===================================================================== */
const MISSIONS = [];
const QUOTES = [
  ['Courage is fear holding on a minute longer.', 'General George S. Patton'],
  ['Two kinds of people are staying on this beach: the dead and those who are going to die. Now let’s get the hell out of here.', 'Colonel George A. Taylor, Omaha Beach, 1944'],
  ['You are about to embark upon the Great Crusade, toward which we have striven these many months.', 'General Dwight D. Eisenhower, June 6, 1944'],
  ['I hate war as only a soldier who has lived it can, only as one who has seen its brutality, its futility, its stupidity.', 'Dwight D. Eisenhower'],
  ['It is foolish and wrong to mourn the men who died. Rather we should thank God that such men lived.', 'General George S. Patton'],
  ['The soldier above all others prays for peace, for it is the soldier who must suffer and bear the deepest wounds and scars of war.', 'General Douglas MacArthur'],
  ['Older men declare war. But it is the youth that must fight and die.', 'Herbert Hoover, 1944'],
  ['We shall defend our island, whatever the cost may be. We shall fight on the beaches.', 'Winston Churchill, June 4, 1940'],
  ['The only thing we have to fear is fear itself.', 'Franklin D. Roosevelt, 1933'],
];
const Story = {
  mission: null, mi: 0, run: 0, stageI: 0, cpStage: 0, timers: [], polls: [], inter: [], lineQ: [], lineBusy: false,
  cam: null, cinematic: false, stats: null, targets: [], playerHitMul: null, allyAccMul: null, speedMul: null, paused: false, active: false,
  gameTime: 0, squadCd: 0, squadMax: 70, squadName: null, barkT: 0, smoke: [], hasWatch: true,
  /* ---------- lifecycle ---------- */
  async start(mi, stage = 0, opts = {}) {
    const M = MISSIONS[mi]; if (!M) return;
    this.run++; const run = this.run;
    this.active = false; this.mission = M; this.mi = mi; this.stageI = stage; this.cpStage = stage;
    this.timers = []; this.polls = []; this.inter = []; this.lineQ = []; this.lineBusy = false; this.cam = null; this.targets = [];
    this.playerHitMul = null; this.allyAccMul = null; this.speedMul = null; this.onEnemyDeath = null; this.onEnemyShot = null; this.onPlayerBulletHit = null; this.onTick = null;
    this.squadCd = 0; this.squadName = null; this.cinematic = false; this.smoke = []; this.hasWatch = true; document.body.classList.remove('cinema');
    if (!opts.keepStats || !this.stats) this.stats = { kills: 0, shots: 0, hits: 0, heads: 0, deaths: 0, nades: 0, time: 0 };
    Player.stats = this.stats;
    HUD.setObjective(null); HUD.setMarker(null); HUD.clearSubs(); HUD.interact(null); HUD.counter(null); HUD.hint(null); HUD.squad(false);
    Music.stop(); SFX.stopAmbience(); if (window.speechSynthesis) speechSynthesis.cancel();
    showLoading(true, M.chapter + ' · ' + M.title);
    await nextFrame(); await nextFrame();
    if (run !== this.run) return;
    // build world
    Nav.ready = false; Actors.clear(); resetWorld(); KIT.grassMeshes = [];
    newScene(M.env);
    reseed(M.seed || 11);
    KIT.b = new Batcher();
    M.build();
    KIT.b.build(R.scene);
    if (World.terrain) R.scene.add(World.terrain.mesh);
    VM.attach();
    for (let i = 0; i < stage; i++) M.stages[i].restore && M.stages[i].restore();
    Nav.build();
    const st = M.stages[stage];
    const cp = (st && st.cp) || M.spawn;
    Player.spawn(V3(...cp.pos), cp.yaw || 0, (st && st.loadout) || M.loadout);
    if (M.onReady) M.onReady(stage);
    // warm up shaders
    R.camera.position.copy(Player.eyePos()); R.camera.rotation.set(0, Player.yaw, 0);
    R.renderer.compile(R.scene, R.camera);
    await nextFrame();
    if (run !== this.run) return;
    showLoading(false);
    R.fade = 1;
    if (stage === 0 && M.card && !opts.skipCard) { SFX.ambience(M.ambience); await this.card(M.card); }
    else SFX.ambience(M.ambience);
    if (run !== this.run) return;
    this.active = true; Game.state = 'play'; HUD.show(true);
    if (!opts.noLock) requestLockSafe();
    this.fadeIn(1.2);
    Progress.mission = mi; Progress.stage = stage; saveProgress();
    // run stages
    for (let i = stage; i < M.stages.length; i++) {
      if (run !== this.run) return;
      this.stageI = i; const s = M.stages[i];
      if (s.cp && i !== stage) { this.cpStage = i; Progress.stage = i; saveProgress(); HUD.notify('Checkpoint', true); }
      await s.run(S);
      if (run !== this.run) return;
    }
    if (run === this.run) this.complete();
  },
  restartCheckpoint() { this.start(this.mi, this.cpStage, { keepStats: true, skipCard: true }); },
  async complete() {
    this.active = false; const M = this.mission, run = this.run;
    Progress.unlocked = Math.max(Progress.unlocked, this.mi + 1); Progress.mission = this.mi + 1 < MISSIONS.length ? this.mi + 1 : null; Progress.stage = 0; saveProgress();
    if (M.outro) {
      Game.state = 'loading'; HUD.show(false); document.body.classList.remove('cinema');
      await this.card(M.outro); if (run !== this.run) return;
    }
    if (M.noStats && this.mi + 1 < MISSIONS.length) {
      Game.state = 'loading'; HUD.show(false); Input.clear();
      $('clickPlay').textContent = 'Click to continue'; $('clickPlay').hidden = false; $('card').classList.add('show'); $('cardInner').innerHTML = '';
      await new Promise(res => { const f = () => { removeEventListener('pointerdown', f); res(); }; addEventListener('pointerdown', f); });
      if (run !== this.run) return;
      $('clickPlay').hidden = true; $('card').classList.remove('show');
      requestLock(true); this.start(this.mi + 1, 0, { noLock: true });
    } else Game.missionComplete(M, this.stats);
  },
  onPlayerDeath() {
    const run = this.run;
    this.timers.push({ t: this.gameTime + 2.2, fn: () => { if (run === this.run) Game.showDeath(pick(QUOTES)); }, run });
  },
  /* ---------- per-frame ---------- */
  update(dt) {
    this.gameTime += dt; this.stats && (this.stats.time += dt);
    const run = this.run;
    const due = this.timers.filter(t => t.t <= this.gameTime && t.run === run);
    this.timers = this.timers.filter(t => t.t > this.gameTime && t.run === run);
    due.forEach(t => t.fn());
    const polls = this.polls; this.polls = [];
    for (const p of polls) { if (p.run !== run) continue; let ok = false; try { ok = p.fn(dt); } catch (e) { console.error(e); } if (ok) p.res(ok); else this.polls.push(p); }
    if (this.onTick) this.onTick(dt);
    // cinematic camera
    if (this.cam) {
      const c = this.cam; c.t += dt; const u = c.ease === false ? clamp(c.t / c.dur, 0, 1) : ease(c.t / c.dur);
      const p = c.path ? c.path.getPoint(u) : c.from.clone().lerp(c.to, u);
      const l = c.lookPath ? c.lookPath.getPoint(u) : c.lookFrom.clone().lerp(c.lookTo, u);
      R.camera.position.copy(p); R.camera.lookAt(l); R.camera.rotation.z += c.roll || 0;
      if (c.shake) { R.camera.position.x += rand(-1, 1) * c.shake; R.camera.position.y += rand(-1, 1) * c.shake; }
      if (c.t >= c.dur && !c.hold) { this.cam = null; c.res && c.res(); }
    }
    // squad ability
    if (this.squadName) {
      this.squadCd = Math.max(0, this.squadCd - dt);
      HUD.squad(true, 1 - this.squadCd / this.squadMax, this.squadName);
      if (Input.hit('KeyT') && Player.alive && Player.control) {
        if (this.squadCd <= 0) {
          this.squadCd = this.squadMax;
          Player.weapons.forEach(w => { w.res = Math.min(WDEF[w.id].maxRes, w.res + WDEF[w.id].mag * 3); });
          Player.nades = Math.min(4, Player.nades + 1); Player.updateHud(); SFX.mech('pickup');
          HUD.notify('Ammo resupplied');
          this.say(this.squadWho || 'Russo', pick(['Here, catch! Don’t say I never gave you nothin’.', 'Last of my clips, Danny. Make ’em count.', 'Ammo! Heads up!', 'Take it. I got more in my pack.']), 2.6);
        } else HUD.hint('Squadmate resupply not ready', 1.4);
      }
    }
    this.barkT -= dt;
  },
  smokeBlocks(a, b) {
    const d = b.clone().sub(a), L = d.length(); d.divideScalar(L);
    for (const s of this.smoke) { const t = clamp(s.p.clone().sub(a).dot(d), 0, L); if (a.clone().addScaledVector(d, t).distanceTo(s.p) < s.r) return true; }
    return false;
  },
  /* ---------- helpers for scripts ---------- */
  wait(s) { const run = this.run; return new Promise(res => this.timers.push({ t: this.gameTime + s, fn: res, run })); },
  until(fn) { const run = this.run; return new Promise(res => this.polls.push({ fn, res, run })); },
  say(who, text, dur) {
    dur = dur || clamp(text.length * 0.058 + 1.1, 2, 9);
    const run = this.run;
    return new Promise(res => { this.lineQ.push({ who, text, dur, res, run }); this.pumpLines(); });
  },
  pumpLines() {
    if (this.lineBusy) return; const l = this.lineQ.shift(); if (!l) return;
    if (l.run !== this.run) return this.pumpLines();
    this.lineBusy = true;
    HUD.subtitle(l.who === 'Radio' ? 'Roosevelt' : l.who, l.text, l.dur, l.who === 'Radio');
    SFX.speak(l.text, l.who === 'Radio' ? 'Roosevelt' : l.who);
    const npc = Actors.byName(l.who); if (npc) npc.talk = l.dur;
    this.timers.push({ t: this.gameTime + l.dur, run: l.run, fn: () => { this.lineBusy = false; l.res(); this.pumpLines(); } });
  },
  bark(kind) {
    if (this.barkT > 0 || this.lineQ.length || this.lineBusy) return; this.barkT = 6;
    const B = { grenade: [['Mahoney', 'Grenade! Get down!'], ['Russo', 'Potato masher! Move, move!'], ['Dupree', 'Grenade, Kessler!']], reload: [['Russo', 'Reloading!']], kill: [['Russo', 'Got him!'], ['Dupree', 'That’s one less.'], ['Mahoney', 'Good shot, Kessler.']] };
    const l = pick(B[kind] || []); if (l && Actors.byName(l[0])) this.say(l[0], l[1], 2);
  },
  async card(c) {
    const el = $('card'), inner = $('cardInner'), run = this.run;
    inner.innerHTML = ''; el.classList.add('show'); R.fade = 1;
    Game.cardSkip = false;
    const add = (cls, txt) => { const d = document.createElement('div'); d.className = cls; if (txt != null) d.textContent = txt; inner.appendChild(d); return d; };
    if (c.kicker) add('kicker', c.kicker);
    if (c.title) add('title', c.title);
    await this.realWait(0.8);
    for (const line of (c.lines || [])) {
      if (run !== this.run) return;
      const d = add(c.letter ? 'letter' : 'tw', '');
      await this.typewrite(d, line, c.letter ? 0.024 : 0.038);
      await this.realWait(c.letter ? 0.5 : 0.35);
    }
    await this.realWait(c.hold == null ? 2.2 : c.hold);
    el.classList.remove('show');
    await this.realWait(0.8);
  },
  typewrite(el, text, spd) {
    return new Promise(res => {
      let i = 0; const cur = document.createElement('span'); cur.className = 'cur'; el.appendChild(cur);
      const tick = () => {
        if (Game.cardSkip) { el.textContent = text; return res(); }
        if (i >= text.length) { cur.remove(); return res(); }
        const ch = text[i++]; cur.insertAdjacentText('beforebegin', ch); if (ch !== ' ' && i % 2) SFX.typewriter();
        setTimeout(tick, ch === '.' || ch === ',' ? spd * 5000 : spd * 1000);
      };
      tick();
    });
  },
  realWait(s) { return new Promise(res => { const t0 = performance.now(); const f = () => { if (Game.cardSkip || performance.now() - t0 > s * 1000) res(); else requestAnimationFrame(f); }; f(); }); },
  fadeIn(d = 1) { this.fadeTo(0, d); },
  fadeTo(v, d = 1) { const run = this.run; const from = R.fade; const t0 = this.gameTime; return this.until(() => { const u = clamp((this.gameTime - t0) / d, 0, 1); R.fade = lerp(from, v, u); return u >= 1; }); },
};

/* The script API passed to stage functions */
const S = {
  wait: (s) => Story.wait(s),
  until: (fn) => Story.until(fn),
  say: (who, text, dur) => Story.say(who, text, dur),
  sayQ(who, text, dur) { Story.say(who, text, dur); },
  obj(text, pos, label, sub) { HUD.setObjective(text, sub); HUD.setMarker(pos ? (Array.isArray(pos) && pos[0] && pos[0].pos ? pos : [{ pos: pos.isVector3 || typeof pos === 'function' ? pos : V3(...pos), label: label || '' }]) : null); SFX.ui('ok'); },
  marker(list) { HUD.setMarker(list); },
  clearObj() { HUD.setObjective(null); HUD.setMarker(null); },
  hint(h, d) { HUD.hint(h, d); },
  notify(t, cp) { HUD.notify(t, cp); },
  async reach(pos, r = 3, o = {}) {
    const p = pos.isVector3 ? pos : V3(...pos);
    return Story.until(() => { const d = Math.hypot(Player.pos.x - p.x, Player.pos.z - p.z); return d < r && (o.y == null || Math.abs(Player.pos.y - p.y) < o.y); });
  },
  interact(o) {
    const it = { enabled: true, pos: o.pos.isVector3 || typeof o.pos === 'function' ? o.pos : V3(...o.pos), text: o.text, hold: o.hold || 0, r: o.r, cone: o.cone };
    let res; it.done = new Promise(r => res = r);
    it.use = () => { if (!it.enabled) return; if (!o.repeat) it.enabled = false; SFX.mech(o.sound || 'pickup'); o.onUse && o.onUse(); res(); if (!o.repeat) Story.inter = Story.inter.filter(x => x !== it); };
    it.remove = () => { it.enabled = false; Story.inter = Story.inter.filter(x => x !== it); };
    Story.inter.push(it); return it;
  },
  cinema(on) { Story.cinematic = on; document.body.classList.toggle('cinema', on); Player.control = !on; if (on) { Input.lmb = false; } },
  camPath(o) { return new Promise(res => { Story.cam = { ...o, t: 0, res, from: o.from && (o.from.isVector3 ? o.from : V3(...o.from)), to: o.to && (o.to.isVector3 ? o.to : V3(...o.to)), lookFrom: o.lookFrom && (o.lookFrom.isVector3 ? o.lookFrom : V3(...o.lookFrom)), lookTo: o.lookTo && (o.lookTo.isVector3 ? o.lookTo : V3(...o.lookTo)) }; }); },
  endCam() { if (Story.cam) { const r = Story.cam.res; Story.cam = null; r && r(); } },
  fade: (v, d) => Story.fadeTo(v, d),
  card: (c) => Story.card(c),
  music: (n) => Music.play(n),
  stopMusic: () => Music.stop(),
  enemy(o) { return new Enemy({ ...o, pos: o.pos.isVector3 ? o.pos : V3(...o.pos) }); },
  enemies(list) { return list.map(o => S.enemy(o)); },
  ally(o) { return new Ally({ ...o, pos: o.pos.isVector3 ? o.pos : V3(...o.pos) }); },
  npc(o) { return new NPC({ ...o, pos: o.pos.isVector3 ? o.pos : V3(...o.pos) }); },
  get(n) { return Actors.byName(n); },
  goals(map, run = true, crouch = true) { for (const k in map) { const a = Actors.byName(k); if (a && a.setGoal) a.setGoal(V3(...map[k]), run, crouch); } },
  place(map) { for (const k in map) { const a = Actors.byName(k); if (a) { const v = map[k]; a.teleport ? a.teleport(V3(v[0], v[1] || 0, v[2]), v[3]) : (a.pos.set(v[0], v[1] || 0, v[2]), a.place()); } } },
  alive(list) { return list.filter(e => e.alive).length; },
  killAll(list) { return Story.until(() => list.every(e => !e.alive)); },
  checkpointHere() { Story.cpStage = Story.stageI; },
  squad(name, who, cd = 70) { Story.squadName = name; Story.squadWho = who; Story.squadMax = cd; Story.squadCd = 0; },
  counter(t, l) { HUD.counter(t, l); },
  explosion(p, r = 6, dmg = 0, o = {}) { Actors.explosion(p.isVector3 ? p : V3(...p), r, dmg, o); },
  blendEnv(t, dur = 5) {
    const from = { sunC: R.sun.color.clone(), sunI: R.sun.intensity, hs: R.hemi.color.clone(), hg: R.hemi.groundColor.clone(), hi: R.hemi.intensity, fog: R.scene.fog.color.clone(), fd: R.scene.fog.density, top: R.sky.material.uniforms.uTop.value.clone(), hor: R.sky.material.uniforms.uHorizon.value.clone(), cl: R.sky.material.uniforms.uCloud.value.clone(), cd: R.sky.material.uniforms.uCloudDark.value.clone(), sc: R.sky.material.uniforms.uSunColor.value.clone(), tint: R.post.uniforms.uTint.value.clone(), exp: R.post.uniforms.uExposure.value, sat: R.post.uniforms.uSat.value };
    const to = { sunC: t.sunColor != null ? col(t.sunColor) : from.sunC, sunI: t.sunI == null ? from.sunI : t.sunI, hs: t.hemiSky != null ? col(t.hemiSky) : from.hs, hg: t.hemiGround != null ? col(t.hemiGround) : from.hg, hi: t.hemiI == null ? from.hi : t.hemiI, fog: t.fog != null ? col(t.fog) : from.fog, fd: t.fogDensity == null ? from.fd : t.fogDensity, top: t.top != null ? col(t.top) : from.top, hor: t.horizon != null ? col(t.horizon) : from.hor, cl: t.cloud != null ? col(t.cloud) : from.cl, cd: t.cloudDark != null ? col(t.cloudDark) : from.cd, sc: t.sunColor != null ? col(t.sunColor) : from.sc, tint: t.tint ? new THREE.Vector3(...t.tint) : from.tint, exp: t.exposure == null ? from.exp : t.exposure, sat: t.sat == null ? from.sat : t.sat };
    const t0 = Story.gameTime, U = R.sky.material.uniforms;
    return Story.until(() => {
      const u = ease((Story.gameTime - t0) / dur);
      R.sun.color.copy(from.sunC).lerp(to.sunC, u); R.sun.intensity = lerp(from.sunI, to.sunI, u); R.vmSun.color.copy(R.sun.color); R.vmSun.intensity = R.sun.intensity * 0.9;
      R.hemi.color.copy(from.hs).lerp(to.hs, u); R.hemi.groundColor.copy(from.hg).lerp(to.hg, u); R.hemi.intensity = lerp(from.hi, to.hi, u); R.vmHemi.color.copy(R.hemi.color); R.vmHemi.groundColor.copy(R.hemi.groundColor); R.vmHemi.intensity = R.hemi.intensity;
      R.scene.fog.color.copy(from.fog).lerp(to.fog, u); R.scene.fog.density = lerp(from.fd, to.fd, u);
      U.uTop.value.copy(from.top).lerp(to.top, u); U.uHorizon.value.copy(from.hor).lerp(to.hor, u); U.uBottom.value.copy(U.uHorizon.value); U.uCloud.value.copy(from.cl).lerp(to.cl, u); U.uCloudDark.value.copy(from.cd).lerp(to.cd, u); U.uSunColor.value.copy(from.sc).lerp(to.sc, u);
      if (t.sunDir) { const d = new THREE.Vector3(...t.sunDir).normalize(); R.env.sunDirV.lerp(d, 0.02).normalize(); U.uSun.value.copy(R.env.sunDirV); }
      R.post.uniforms.uTint.value.copy(from.tint).lerp(to.tint, u); R.post.uniforms.uExposure.value = lerp(from.exp, to.exp, u); R.post.uniforms.uSat.value = lerp(from.sat, to.sat, u);
      return u >= 1;
    });
  },
  timer(sec, label, onTick) {
    const end = Story.gameTime + sec;
    return Story.until((dt) => { const left = Math.max(0, end - Story.gameTime); HUD.counter(`${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`, label); if (onTick) onTick(left, dt || 0.016); if (left <= 0) { HUD.counter(null); return true; } return false; });
  },
};
function nextFrame() { return new Promise(r => requestAnimationFrame(() => r())); }
