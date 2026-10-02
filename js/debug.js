// Panneau de debug : infos en direct, réglages de physique, triches de test, affichage.
// Ouverture : F1, touche ² (Backquote) ou 5 appuis rapides sur le numéro de version.
import * as THREE from 'three';
import { TUNING, TUNING_DEFAULTS } from './physics.js';
import { CARS, COLORS, PARTS, STAGES } from './data.js';
import { save } from './save.js';

export const isTuned = () => Object.keys(TUNING).some((k) => TUNING[k] !== TUNING_DEFAULTS[k]);

export class DebugPanel {
  constructor(app) {
    this.app = app;
    this.open = false;
    this.timeScale = 1;
    this.showColliders = false;
    this.orbitCam = false;
    this.frames = 0;
    this.fpsTime = 0;
    this.fps = 0;
    this.infoTimer = 0;
    this.build();
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F1' || e.code === 'Backquote') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  toggle(force) {
    this.open = force ?? !this.open;
    this.el.classList.toggle('hidden', !this.open);
    if (this.open) this.refreshInfo();
  }

  // Toute action qui fausse le chrono marque la course en cours.
  markCheat() { if (this.app.race) this.app.race.cheated = true; }

  build() {
    const el = (this.el = document.createElement('aside'));
    el.id = 'debug';
    el.className = 'hidden';
    el.innerHTML = `
      <header><b>DEBUG</b><button data-close title="Fermer">✕</button></header>
      <details open><summary>Infos en direct</summary><pre id="dbg-info"></pre></details>
      <details open><summary>Physique</summary><div id="dbg-tuning"></div></details>
      <details open><summary>Triches</summary><div id="dbg-cheats" class="dbg-buttons"></div></details>
      <details open><summary>Affichage</summary><div id="dbg-view"></div></details>`;
    document.body.appendChild(el);
    el.querySelector('[data-close]').onclick = () => this.toggle(false);
    // Le panneau ne doit pas déclencher les commandes du jeu (glisser = tourner le garage).
    el.addEventListener('pointerdown', (e) => e.stopPropagation());

    const tuning = el.querySelector('#dbg-tuning');
    const sliders = [
      ['grip', 'Adhérence', 0.3, 2, 0.05],
      ['power', 'Puissance', 0.3, 3, 0.05],
      ['steer', 'Braquage', 0.4, 2, 0.05],
      ['handbrake', 'Frein à main', 0.3, 3, 0.05],
      ['inertia', 'Inertie (lacet)', 0.3, 2.5, 0.05],
    ];
    this.sliderEls = [];
    for (const [key, label, min, max, step] of sliders) {
      const row = this.slider(label, min, max, step, () => TUNING[key], (v) => { TUNING[key] = v; this.markCheat(); });
      tuning.appendChild(row);
    }
    tuning.appendChild(this.button('Valeurs par défaut', () => {
      Object.assign(TUNING, TUNING_DEFAULTS);
      this.sliderEls.forEach((s) => s.sync());
    }));

    const cheats = el.querySelector('#dbg-cheats');
    const coins = (n) => () => { save.addCoins(n); this.app.updateCoins(true); this.app.refreshScreen(); };
    cheats.append(
      this.button('+1 000 🪙', coins(1000)),
      this.button('+10 000 🪙', coins(10000)),
      this.button('Tout débloquer', () => this.unlockAll()),
      this.button('Pilote auto', () => {
        this.app.debugAutopilot = !this.app.debugAutopilot;
        if (this.app.debugAutopilot) this.markCheat();
        this.app.toast(`Pilote auto ${this.app.debugAutopilot ? 'activé' : 'désactivé'}`);
      }),
      this.button('Virage suivant', () => this.raceAction((r) => r.debugNextNote())),
      this.button('Finir la spéciale', () => this.raceAction((r) => r.debugFinish())),
    );

    const view = el.querySelector('#dbg-view');
    view.appendChild(this.slider('Vitesse du temps', 0.1, 2, 0.05, () => this.timeScale, (v) => {
      this.timeScale = v;
      if (v > 1) this.markCheat();
    }));
    view.appendChild(this.checkbox('Caméra orbitale', () => this.orbitCam, (v) => { this.orbitCam = v; }));
    view.appendChild(this.checkbox('Zones de collision', () => this.showColliders, (v) => { this.showColliders = v; this.colliderTimer = 0; if (!v) this.clearColliders(); }));
    view.appendChild(this.checkbox('Masquer le HUD', () => document.body.classList.contains('dbg-nohud'), (v) => document.body.classList.toggle('dbg-nohud', v)));
  }

  raceAction(fn) {
    const r = this.app.race;
    if (!r || r.state !== 'racing') { this.app.toast('Disponible pendant une spéciale', true); return; }
    this.markCheat();
    fn(r);
  }

  unlockAll() {
    const d = save.data;
    d.cars = CARS.map((c) => c.id);
    for (const c of COLORS) d.owned[`color:${c.id}`] = true;
    for (const [slot, list] of Object.entries(PARTS)) for (const p of list) d.owned[`${slot}:${p.id}`] = true;
    for (const s of STAGES) d.finished[s.id] = true;
    save.persist();
    this.app.toast('Tout est débloqué');
    this.app.refreshScreen();
  }

  slider(label, min, max, step, get, set) {
    const row = document.createElement('label');
    row.className = 'dbg-row';
    row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><output></output>`;
    const input = row.querySelector('input'), out = row.querySelector('output');
    row.sync = () => { input.value = get(); out.textContent = `×${(+get()).toFixed(2)}`; };
    input.oninput = () => { set(+input.value); row.sync(); };
    row.sync();
    this.sliderEls.push(row);
    return row;
  }

  checkbox(label, get, set) {
    const row = document.createElement('label');
    row.className = 'dbg-row';
    row.innerHTML = `<span>${label}</span><input type="checkbox">`;
    const input = row.querySelector('input');
    input.checked = get();
    input.onchange = () => set(input.checked);
    return row;
  }

  button(label, fn) {
    const b = document.createElement('button');
    b.className = 'btn small';
    b.textContent = label;
    b.onclick = fn;
    return b;
  }

  // Appelé à chaque image par l'application.
  frame(dt) {
    this.frames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) { this.fps = this.frames / this.fpsTime; this.frames = 0; this.fpsTime = 0; }
    if (!this.open) return;
    this.infoTimer -= dt;
    if (this.infoTimer <= 0) { this.infoTimer = 0.2; this.refreshInfo(); }
    if (this.showColliders) this.updateColliders(dt);
  }

  refreshInfo() {
    const app = this.app, r = app.race, info = app.renderer.info.render;
    const lines = [
      `FPS ${this.fps.toFixed(0)}   appels ${info.calls}   triangles ${(info.triangles / 1000).toFixed(0)} k`,
      `Écran ${app.mode === 'race' ? 'course' : app.screen}   pièces ${save.coins}`,
    ];
    if (r && r.phys) {
      const p = r.phys, t = r.track;
      lines.push(
        `Spéciale ${r.stage.id} (graine ${r.stage.seed})   état ${r.state}${r.cheated ? '   ⚠ triche' : ''}`,
        `Distance ${(r.s ?? 0).toFixed(0)} / ${t.finish.toFixed(0)} m   chrono ${(r.time / 1000).toFixed(2)} s`,
        `Vitesse ${(p.speed * 3.6).toFixed(0)} km/h   rapport ${p.gear}   ${p.rpm.toFixed(0)} tr/min`,
        `Glisse ${p.slide.toFixed(2)}   patinage ${p.spin.toFixed(2)}   blocage ${p.lock}`,
        `Surface ${p.surface}${p.offroad ? ' (hors piste)' : ''}   ${p.airborne ? `en l'air ${p.airTime.toFixed(2)} s` : 'au sol'}`,
        `Position ${p.x.toFixed(1)}, ${p.y.toFixed(1)}   alt ${p.alt.toFixed(1)}   cap ${((p.heading * 180) / Math.PI % 360).toFixed(0)}°`,
        `Dérive ${((Math.atan2(p.vy, Math.max(Math.abs(p.vx), 1)) * 180) / Math.PI).toFixed(0)}°   lacet ${p.r.toFixed(2)} rad/s`,
      );
    }
    this.el.querySelector('#dbg-info').textContent = lines.join('\n');
  }

  updateColliders(dt) {
    const r = this.app.race;
    if (!r || !r.world) return;
    this.colliderTimer = (this.colliderTimer ?? 0) - dt;
    if (this.colliderTimer > 0) return;
    this.colliderTimer = 0.4;
    this.clearColliders();
    const g = (this.colliderGroup = new THREE.Group());
    const mat = new THREE.LineBasicMaterial({ color: 0xff2bd6, depthTest: false });
    const p = r.phys;
    const seen = new Set();
    for (let ox = -30; ox <= 30; ox += 10) for (let oy = -30; oy <= 30; oy += 10) {
      for (const c of r.world.collidersNear(p.x + ox, p.y + oy)) {
        if (seen.has(c)) continue;
        seen.add(c);
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          pts.push(new THREE.Vector3(c.x + Math.cos(a) * c.r, 0, -(c.y + Math.sin(a) * c.r)));
        }
        const h = r.track.heightAt(c.x, c.y, p.hint) + 0.3;
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
        line.position.y = h;
        line.renderOrder = 20;
        g.add(line);
      }
    }
    r.scene.add(g);
  }

  clearColliders() {
    const g = this.colliderGroup;
    if (!g) return;
    g.parent?.remove(g);
    g.traverse((o) => o.geometry?.dispose());
    this.colliderGroup = null;
  }
}
