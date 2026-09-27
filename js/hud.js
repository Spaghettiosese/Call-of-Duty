'use strict';
/* =====================================================================
   HUD — DOM overlay: objective, markers, ammo, health, subtitles,
   damage indicators, prompts, notifications.
   ===================================================================== */
const $ = (id) => document.getElementById(id);
const SPEAKER_COLORS = {
  Mahoney: '#d2a847', Russo: '#8fb7d8', Frankie: '#8fb7d8', Dupree: '#b6c98a', Weiss: '#d99a7a', Doc: '#c7b3e0', Hollis: '#e0a060', Kessler: '#e8e2d0',
  Father: '#d8b48a', Mother: '#e2a0a8', Ruth: '#f0c0d0', Abernathy: '#b8b0a0', Roosevelt: '#e8e2d0', Recruiter: '#a8c0a0', Coxswain: '#a0b8c8', Marguerite: '#e8b0a0', Carver: '#a8b8d0', Newsboy: '#c0c0c0', Radio: '#e8e2d0', Tankman: '#b0c090'
};
const HUD = {
  markers: [], arcs: [], hitT: 0, kill: false, hintT: 0,
  init() {
    this.el = { hud: $('hud'), obj: $('objective'), mag: $('ammoMag'), res: $('ammoRes'), wname: $('wName'), nades: $('nadeCount'), hp: $('hpFill'), kits: $('kitCount'), subs: $('subs'), notify: $('notify'), inter: $('interact'), hint: $('hint'), cross: $('crosshair'), hit: $('hitmark'), markers: $('markers'), dmg: $('dmg'), nade: $('nadeWarn'), counter: $('counter'), squad: $('squad'), ring: $('ringArc'), ammo: $('ammo'), health: $('health') };
    this.drawPortrait();
  },
  show(on) { this.el.hud.hidden = !on; },
  weaponsVisible(on) { this.el.ammo.style.visibility = on ? 'visible' : 'hidden'; this.el.cross.style.visibility = on ? 'visible' : 'hidden'; },
  healthVisible(on) { this.el.health.style.visibility = on ? 'visible' : 'hidden'; },
  setObjective(text, sub, head = 'Objective') {
    const o = this.el.obj;
    if (!text) { o.innerHTML = ''; return; }
    o.innerHTML = `<div class="obj-head">${head}</div><div class="obj-text"><svg class="star" width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.6" fill="none" stroke="#d2a847" stroke-width="1.6"/><path d="M10 4.2l1.7 3.7 4 .4-3 2.7.9 3.9L10 12.9l-3.6 2 .9-3.9-3-2.7 4-.4z" fill="#d2a847"/></svg><span>${text}</span></div>${sub ? `<div class="obj-sub">${sub}</div>` : ''}`;
    o.classList.remove('flash'); void o.offsetWidth; o.classList.add('flash');
  },
  setMarker(list) { // list of {pos, label}
    this.el.markers.innerHTML = ''; this.markers = [];
    (list || []).forEach(m => {
      const d = document.createElement('div'); d.className = 'marker';
      d.innerHTML = `<span class="lbl">${m.label || ''}</span><svg class="ico" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="11" fill="rgba(0,0,0,.25)" stroke="#ece6d8" stroke-width="1.8"/><path d="M13 5.8l2 4.4 4.8.5-3.6 3.2 1 4.7L13 16.2l-4.2 2.4 1-4.7-3.6-3.2 4.8-.5z" fill="#ece6d8"/></svg><span class="dist"></span>`;
      this.el.markers.appendChild(d); this.markers.push({ ...m, el: d, dist: d.querySelector('.dist') });
    });
  },
  ammo(mag, res, name, low) { this.el.mag.textContent = mag; this.el.res.textContent = res; this.el.wname.textContent = name; this.el.mag.classList.toggle('low', !!low); },
  health(hp, max, kits) { this.el.hp.style.width = clamp(hp / max * 100, 0, 100) + '%'; this.el.hp.classList.toggle('low', hp < 35); this.el.kits.textContent = kits; },
  nades(n) { this.el.nades.textContent = n; },
  squad(show, frac, name) { this.el.squad.hidden = !show; if (show) { this.el.ring.setAttribute('stroke-dashoffset', String(100.5 * (1 - frac))); this.el.ring.setAttribute('stroke', frac >= 1 ? '#d2a847' : '#7d776b'); if (name) $('squadName').textContent = name; } },
  crosshair(spread, visible) {
    const c = this.el.cross; c.style.opacity = visible ? 1 : 0;
    const g = 5 + spread * 5;
    c.children[0].style.top = (-g - 8) + 'px'; c.children[1].style.top = g + 'px'; c.children[2].style.left = (-g - 8) + 'px'; c.children[3].style.left = g + 'px';
  },
  hitmark(kill) { this.hitT = kill ? 0.45 : 0.22; this.kill = kill; this.el.hit.classList.toggle('kill', !!kill); },
  damageFrom(angle) {
    const d = document.createElement('div'); d.className = 'dmgArc';
    d.innerHTML = `<svg viewBox="0 0 220 220" aria-hidden="true"><path d="M70 22 A 92 92 0 0 1 150 22" fill="none" stroke="rgba(200,40,30,.85)" stroke-width="9" stroke-linecap="round"/></svg>`;
    d.style.transform = `rotate(${angle}rad)`; this.el.dmg.appendChild(d); this.arcs.push({ el: d, t: 1.3, angle });
  },
  subtitle(who, text, dur, radio) {
    if (!Settings.subtitles) return null;
    const d = document.createElement('div'); d.className = 'line' + (radio ? ' radio' : '');
    const c = SPEAKER_COLORS[who] || '#e8e2d0';
    d.innerHTML = who ? `<b style="color:${c}">${who}:</b>${text}` : text;
    this.el.subs.appendChild(d);
    while (this.el.subs.children.length > 2) this.el.subs.removeChild(this.el.subs.firstChild);
    setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, dur * 1000);
    return d;
  },
  clearSubs() { this.el.subs.innerHTML = ''; },
  notify(text, cp = false, dur = 2.6) {
    const d = document.createElement('div'); d.className = 'n' + (cp ? ' cp' : ''); d.textContent = text; this.el.notify.appendChild(d);
    setTimeout(() => d.remove(), dur * 1000);
  },
  hint(html, dur = 5) { const h = this.el.hint; if (!html) { h.hidden = true; return; } h.innerHTML = html; h.hidden = false; this.hintT = dur; },
  interact(text, prog = 0) {
    const e = this.el.inter; if (!text) { e.hidden = true; return; }
    e.hidden = false; e.querySelector('span').textContent = text.charAt(0).toUpperCase() + text.slice(1); e.querySelector('.prog').style.width = (prog * 100) + '%';
  },
  counter(text, label) { const c = this.el.counter; if (text == null) { c.hidden = true; return; } c.hidden = false; c.innerHTML = (label ? `<small>${label}</small>` : '') + text; },
  update(dt) {
    // markers
    const w = innerWidth, h = innerHeight, cam = R.camera, v = V3();
    for (const m of this.markers) {
      const p = typeof m.pos === 'function' ? m.pos() : m.pos; if (!p) { m.el.style.display = 'none'; continue; }
      m.el.style.display = '';
      v.copy(p); v.y += m.yOff == null ? 0.4 : m.yOff;
      const dist = v.distanceTo(cam.position);
      v.project(cam);
      let x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h, edge = false;
      if (v.z > 1) { x = w - x; y = h - 12; edge = true; }
      const mx = 40, my = 70;
      if (x < mx || x > w - mx || y < my || y > h - my) edge = true;
      x = clamp(x, mx, w - mx); y = clamp(y, my, h - my);
      m.el.style.left = x + 'px'; m.el.style.top = y + 'px'; m.el.classList.toggle('edge', edge);
      m.dist.textContent = Math.round(dist) + 'm';
      m.el.style.opacity = dist < 3 ? 0.35 : 1;
    }
    // hit marker
    this.hitT -= dt; this.el.hit.style.opacity = this.hitT > 0 ? Math.min(1, this.hitT * 6) : 0;
    // damage arcs
    for (const a of this.arcs) { a.t -= dt; a.el.style.opacity = clamp(a.t, 0, 1); if (a.t <= 0) a.el.remove(); }
    this.arcs = this.arcs.filter(a => a.t > 0);
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) this.el.hint.hidden = true; }
  },
  grenadeWarn(list) {
    const c = this.el.nade;
    if (!list.length) { if (c.childElementCount) c.innerHTML = ''; return; }
    c.innerHTML = '';
    for (const g of list) {
      const d = document.createElement('div'); d.className = 'gw';
      const r = 90;
      d.style.transform = `translate(${Math.sin(g.angle) * r}px, ${-Math.cos(g.angle) * r}px)`;
      d.innerHTML = `<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="13" fill="rgba(150,20,10,.55)" stroke="#f0d0c0" stroke-width="1.5"/><ellipse cx="15" cy="17" rx="5" ry="6" fill="none" stroke="#f0e6d8" stroke-width="1.6"/><path d="M12.5 9.5h5v2h-5z" fill="#f0e6d8"/></svg>`;
      c.appendChild(d);
    }
  },
  drawPortrait() {
    const c = $('portrait'), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 52); gr.addColorStop(0, '#4a4636'); gr.addColorStop(1, '#23221c'); g.fillStyle = gr; g.fillRect(0, 0, 46, 52);
    g.fillStyle = '#6b6440'; g.beginPath(); g.moveTo(4, 52); g.quadraticCurveTo(23, 30, 42, 52); g.fill();
    g.fillStyle = '#c99a78'; g.beginPath(); g.ellipse(23, 27, 10, 12.5, 0, 0, TAU); g.fill();
    g.fillStyle = '#4f5236'; g.beginPath(); g.ellipse(23, 17, 14, 9, 0, Math.PI, 0); g.fill(); g.fillRect(9, 16, 28, 3);
    g.fillStyle = '#2a1e16'; g.fillRect(18, 26, 3, 2); g.fillRect(25, 26, 3, 2); g.fillStyle = '#9a6a52'; g.fillRect(20, 34, 6, 1.5);
  }
};
