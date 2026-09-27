'use strict';
/* =====================================================================
   Main: boot, menus, game loop
   ===================================================================== */
const Game = {
  state: 'boot', last: 0, cardSkip: false, holdSkip: 0, menuScene: false,
  showScreen(id) { ['menu', 'diffScreen', 'selectScreen', 'settingsScreen', 'controlsScreen', 'pause', 'death', 'endscreen'].forEach(s => $(s).hidden = s !== id); },
  missionComplete(M, st) {
    this.state = 'end'; HUD.show(false); document.exitPointerLock && document.exitPointerLock(); Input.enabled = false;
    const acc = st.shots ? Math.round(st.hits / st.shots * 100) : 0, mm = Math.floor(st.time / 60), ss = Math.floor(st.time % 60);
    const fin = Story.mi + 1 >= MISSIONS.length;
    $('endKicker').textContent = fin ? 'End of Chapter One' : M.chapter + ' · Mission complete'; $('endTitle').textContent = fin ? 'To be continued' : M.title;
    $('endStats').innerHTML = [[`${mm}:${String(ss).padStart(2, '0')}`, 'Time'], [st.kills, 'Kills'], [st.heads, 'Headshots'], [acc + '%', 'Accuracy'], [st.deaths, 'Deaths']].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
    const last = Story.mi + 1 >= MISSIONS.length;
    $('endNext').textContent = last ? 'Main menu' : 'Next mission';
    $('endNext').onclick = () => { SFX.ui('ok'); if (last) this.toMenu(); else this.startMission(Story.mi + 1); };
    this.showScreen('endscreen');
  },
  showDeath(q) {
    this.state = 'dead'; document.exitPointerLock && document.exitPointerLock();
    $('deathQuote').textContent = '“' + q[0] + '”'; $('deathAuthor').textContent = '— ' + q[1];
    this.showScreen('death'); HUD.show(false);
  },
  startMission(i, stage = 0) {
    this.showScreen(null); SFX.init(); Input.enabled = true; this.state = 'loading'; requestLock(true);
    Story.start(i, stage);
  },
  toMenu() {
    Story.run++; Story.active = false; this.state = 'menu'; HUD.show(false); Input.enabled = false; document.body.classList.remove('cinema');
    document.exitPointerLock && document.exitPointerLock();
    this.showScreen('menu'); refreshMenu();
    Music.play('title');
    this.buildMenuScene();
  },
  pause(on) {
    if (on && this.state === 'play') { this.state = 'pause'; Input.clear(); this.showScreen('pause'); $('pauseInfo').textContent = `${Story.mission.chapter} · ${Story.mission.title} — ${Story.mission.place}, ${Story.mission.date}. Difficulty: ${DIFFICULTY[Settings.difficulty].name}.`; SFX.ctx && SFX.ctx.suspend && SFX.ctx.suspend(); }
    else if (!on && this.state === 'pause') { this.showScreen(null); this.state = 'play'; SFX.ctx && SFX.ctx.resume && SFX.ctx.resume(); requestLockSafe(true); }
  },
  async buildMenuScene() {
    // a slow drift over Sainte-Colombe at dusk behind the title
    const M = MISSIONS.find(m => m.id === 'town'); if (!M) return;
    Actors.clear(); resetWorld(); newScene(M.menuEnv || M.env); reseed(M.seed || 11);
    KIT.b = new Batcher(); M.build(true); KIT.b.build(R.scene); if (World.terrain) R.scene.add(World.terrain.mesh);
    if (M.menuDress) M.menuDress();
    VM.visible = false; this.menuScene = true; R.fade = 1; Story.fadeIn && (R.fade = 1);
    this.menuT = 0;
  }
};
function refreshMenu() {
  const has = Progress.mission != null && Progress.unlocked > 0 || (Progress.mission != null && Progress.mission > 0) || (Progress.mission === 0 && Progress.stage > 0);
  $('btnContinue').disabled = !has;
  const list = $('missionList'); list.innerHTML = '';
  MISSIONS.forEach((m, i) => {
    const b = document.createElement('button'); b.className = 'mission'; b.disabled = i > Progress.unlocked;
    b.innerHTML = `<div class="num">${i === 0 || i === 1 ? 'P' + (i + 1) : String(i - 1)}</div><div><div class="ch">${m.chapter}</div><div class="nm">${m.title}</div><div class="meta">${m.place} · ${m.date}</div></div>`;
    b.onclick = () => { SFX.init(); SFX.ui('ok'); Game.pendingMission = i; openDiff(); };
    list.appendChild(b);
  });
}
function openDiff() {
  const d = $('diffList'); d.innerHTML = '';
  DIFFICULTY.forEach((df, i) => {
    const b = document.createElement('button'); b.className = 'diff' + (i === Settings.difficulty ? ' on' : ''); b.innerHTML = `<b>${df.name}</b><span>${df.desc}</span>`;
    b.onclick = () => { Settings.difficulty = i; saveSettings(); SFX.ui(); openDiff(); };
    d.appendChild(b);
  });
  Game.showScreen('diffScreen');
}
function showLoading(on, text) {
  $('loading').hidden = !on; if (text) $('loadText').textContent = text;
  $('loadBar').style.width = on ? '70%' : '100%';
}
function requestLockSafe(gesture = false) {
  if (Input.lockFailed) return;
  if (!Input.locked) { Game.needClick = true; $('clickPlay').textContent = 'Click to continue'; $('clickPlay').hidden = false; requestLock(gesture); }
}
function onLockRefused() {
  if (Game.state !== 'play') return;
  Game.needClick = true; $('clickPlay').textContent = 'Click to resume'; $('clickPlay').hidden = false;
}
function onPointerLockChange(locked) {
  if (locked) { Input.lockFails = 0; Game.needClick = false; $('clickPlay').hidden = true; return; }
  if (Game.state === 'play' && !Game.needClick) Game.pause(true);
}
function bindSettings() {
  const b = (id, key, parse = parseFloat, ev = 'input') => { const el = $(id); if (el.type === 'checkbox') el.checked = !!Settings[key]; else el.value = Settings[key]; el.addEventListener(ev === 'input' && el.type === 'checkbox' ? 'change' : ev, () => { Settings[key] = el.type === 'checkbox' ? el.checked : parse(el.value); saveSettings(); SFX.setVolume(); if (key === 'quality') resize(); }); };
  b('sSens', 'sens'); b('sInvert', 'invertY'); b('sFov', 'fov'); b('sQuality', 'quality', v => v, 'change'); b('sVol', 'volume'); b('sMusic', 'music'); b('sSubs', 'subtitles'); b('sTTS', 'tts');
}
function bindMenus() {
  const click = (id, fn) => $(id).addEventListener('click', () => { SFX.init(); SFX.ui('ok'); fn(); });
  click('btnNew', () => { Game.pendingMission = 0; openDiff(); });
  click('btnContinue', () => { const m = Progress.mission == null ? Math.min(Progress.unlocked, MISSIONS.length - 1) : Progress.mission; Game.startMission(m, Progress.mission === m ? Progress.stage || 0 : 0); });
  click('btnSelect', () => { refreshMenu(); Game.showScreen('selectScreen'); });
  click('btnSettings', () => { Game.settingsFrom = 'menu'; Game.showScreen('settingsScreen'); });
  click('btnControls', () => Game.showScreen('controlsScreen'));
  click('diffGo', () => Game.startMission(Game.pendingMission || 0));
  click('diffBack', () => Game.showScreen('menu'));
  click('selBack', () => Game.showScreen('menu'));
  click('setBack', () => Game.showScreen(Game.settingsFrom === 'pause' ? 'pause' : 'menu'));
  click('ctlBack', () => Game.showScreen('menu'));
  click('pResume', () => Game.pause(false));
  click('pCheckpoint', () => { SFX.ctx && SFX.ctx.resume(); Game.showScreen(null); Game.state = 'loading'; requestLock(true); Story.restartCheckpoint(); });
  click('pSettings', () => { Game.settingsFrom = 'pause'; Game.showScreen('settingsScreen'); });
  click('pQuit', () => { SFX.ctx && SFX.ctx.resume(); Game.toMenu(); });
  click('endMenu', () => Game.toMenu());
  $('death').addEventListener('click', () => { SFX.ui('ok'); Game.showScreen(null); Game.state = 'loading'; requestLock(true); Story.restartCheckpoint(); });
  $('game').addEventListener('click', () => { if (Game.state === 'play' && !Input.locked && !Input.lockFailed) requestLock(true); });
  addEventListener('keydown', e => {
    if (e.code === 'Escape' && Game.state === 'play' && (Input.lockFailed || !Input.locked)) { Game.needClick = false; $('clickPlay').hidden = true; Game.pause(true); }
    else if (e.code === 'Escape' && Game.state === 'pause') Game.pause(false);
  });
}

/* ---------------- loop ---------------- */
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - Game.last) / 1000 || 0.016) * (Game.timeScale || 1); Game.last = now;
  // card skipping (hold space)
  if (!$('card').hidden && $('card').classList.contains('show')) {
    if (Input.down('Space') || Input.lmb) { Game.holdSkip += dt; if (Game.holdSkip > 0.6) Game.cardSkip = true; } else Game.holdSkip = 0;
  } else { Game.holdSkip = 0; Game.cardSkip = false; }
  if (Game.state === 'menu' && Game.menuScene) {
    Game.menuT += dt; R.time += dt;
    R.fade = damp(R.fade, 0, 1.2, dt);
    const t = Game.menuT * 0.02;
    R.camera.position.set(Math.sin(t) * 6 + 2, 2.2 + Math.sin(t * 0.7) * 0.4, 62 - (Game.menuT * 0.25) % 30);
    R.camera.rotation.set(0.04, 0.12 + Math.sin(t * 0.8) * 0.12, 0);
    setFov(80);
    FX.update(dt); updateLights(dt); KIT.grassMeshes.forEach(g => g.userData.uTime.value = R.time);
    updateSunShadow(R.camera.position); renderFrame();
    Input.endFrame(); return;
  }
  if (Game.state === 'play' && !(Game.needClick && !Input.lockFailed)) {
    R.time += dt; Nav.budget = 6;
    Player.update(dt);
    Story.update(dt);
    Actors.update(dt);
    updateProps(dt);
    VM.update(dt, Player);
    FX.update(dt);
    HUD.update(dt);
    updateLights(dt);
    KIT.grassMeshes.forEach(g => g.userData.uTime.value = R.time);
    if (R.scene && R.scene.userData.update) R.scene.userData.update(dt);
    if (Story.mission && Story.mission.update) Story.mission.update(dt);
    // mission briefing (hold Tab)
    const showBrief = Input.down('Tab') && !!Story.mission;
    if (showBrief !== !$('brief').hidden) {
      $('brief').hidden = !showBrief;
      if (showBrief) { const M = Story.mission, st = Story.stats || {}; $('briefKicker').textContent = M.chapter; $('briefTitle').textContent = M.title; $('briefPlace').textContent = M.place + ' \u2014 ' + M.date; const o = $('objective').querySelector('.obj-text span'); $('briefObj').textContent = o ? 'Objective: ' + o.textContent : 'No current objective'; $('briefStats').textContent = `Kills ${st.kills || 0} \u00b7 Headshots ${st.heads || 0} \u00b7 Difficulty ${DIFFICULTY[Settings.difficulty].name}`; }
    }
    updateTag();
    // grenade warnings
    const gw = [];
    for (const g of Actors.grenades) if (g.owner !== Player && g.p.distanceTo(Player.pos) < 9) gw.push({ angle: -angleDiff(Player.yaw, yawTo(g.p.x - Player.pos.x, g.p.z - Player.pos.z)) });
    HUD.grenadeWarn(gw);
    R.shake = damp(R.shake, 0, 4, dt); R.shock = damp(R.shock, 0, 0.8, dt); R.flash = damp(R.flash, 0, 6, dt);
    updateSunShadow(Player.pos);
    Player.endFrame(dt);
    renderFrame();
  } else if (Game.state === 'play' || Game.state === 'dead' || Game.state === 'pause' || Game.state === 'loading' || Game.state === 'end') {
    if (R.scene && Game.state !== 'loading') { if (Game.state === 'dead') { R.time += dt; Player.update(dt); Story.update(dt); FX.update(dt); } renderFrame(); }
  }
  Input.endFrame();
}

/* name & rank of the friendly you're looking at */
function updateTag() {
  const el = $('tag'), o = R.camera.position, d = R.camera.getWorldDirection(V3());
  let best = null, bd = Math.cos(3.2 * DEG);
  if (Player.alive && !Story.cinematic) for (const a of Actors.list) {
    if (!a.alive || !a.display || a.team === 'de') continue;
    const head = a.h.head.getWorldPosition(V3()); head.y += 0.12;
    const dist = head.distanceTo(o); if (dist > 45 || dist < 0.5) continue;
    const dot = head.clone().sub(o).normalize().dot(d); const tol = Math.cos(Math.max(3.2 * DEG, Math.atan(0.45 / dist)));
    if (dot > tol && dot > bd && lineOfSight(o, head)) { bd = dot; best = { a, head }; }
  }
  if (!best) { if (!el.hidden) el.hidden = true; return; }
  const p = best.head.clone(); p.y += 0.35; p.project(R.camera);
  el.hidden = false; el.style.left = ((p.x * 0.5 + 0.5) * innerWidth) + 'px'; el.style.top = ((-p.y * 0.5 + 0.5) * innerHeight) + 'px';
  if (el.dataset.who !== best.a.display) { el.dataset.who = best.a.display; el.textContent = best.a.display; el.classList.toggle('civ', best.a.team === 'npc'); }
}
async function boot() {
  loadPrefs();
  if (('ontouchstart' in window) && !matchMedia('(pointer:fine)').matches) $('touchNote').hidden = false;
  $('loading').hidden = false; $('fade').style.opacity = 0;
  try {
    initRenderer();
  } catch (e) { $('loadText').textContent = 'WebGL is not available in this browser.'; return; }
  await initTextures((p, t) => { $('loadBar').style.width = (p * 100).toFixed(0) + '%'; $('loadText').textContent = t; });
  HUD.init(); VM.init(); bindSettings(); bindMenus();
  $('loading').hidden = true;
  Game.state = 'menu'; Game.showScreen('menu'); refreshMenu();
  await Game.buildMenuScene();
  // music needs a gesture
  const startAudio = () => { SFX.init(); Music.play('title'); removeEventListener('pointerdown', startAudio); removeEventListener('keydown', startAudio); };
  addEventListener('pointerdown', startAudio); addEventListener('keydown', startAudio);
  requestAnimationFrame(frame);
}
boot();
