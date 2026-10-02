// Une spéciale en cours : physique, chrono, copilote, fantôme, caméra, HUD.
import * as THREE from 'three';
import { Track, SAMPLE } from './trackgen.js';
import { World } from './world.js';
import { CarPhysics } from './physics.js';
import { buildCar, poseCar } from './carModel.js';
import { Particles, SkidMarks, Rain } from './effects.js';
import { AIDriver } from './ai.js';
import { CARS, PARTS, SURFACES, MEDALS } from './data.js';
import { clamp, damp, lerp, wrapAngle, formatTime, formatDelta } from './util.js';
import { save } from './save.js';
import { isTuned } from './debug.js';

const DT = 1 / 120;
const RESET_PENALTY = 5000;
const SKID_COLORS = {
  gravel: ['#3d2f20', 0.22], tarmac: ['#111111', 0.4], snow: ['#8fa2b8', 0.35],
  sand: ['#94744a', 0.32], mud: ['#21170f', 0.4], grass: ['#2c2416', 0.3],
};
// Comportement des projections selon la surface (nuage de poussière ou mottes qui retombent).
const PFX = {
  gravel: { size: 0.75, grow: 2.6, life: 1.4, alpha: 0.28, grav: 0.3, up: 1.4 },
  sand: { size: 0.85, grow: 3, life: 1.7, alpha: 0.3, grav: 0.2, up: 1.6 },
  snow: { size: 0.7, grow: 2.4, life: 1.1, alpha: 0.6, grav: 1.5, up: 2.4 },
  mud: { size: 0.3, grow: 0.25, life: 0.8, alpha: 0.85, grav: 9, up: 3.6 },
  tarmac: { size: 0.9, grow: 3.5, life: 1.5, alpha: 0.25, grav: -0.2, up: 0.5 },
  grass: { size: 0.4, grow: 0.6, life: 0.8, alpha: 0.7, grav: 8, up: 3 },
};
const GRADE_WORDS = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six'];

const $ = (id) => document.getElementById(id);

export class Race {
  constructor(app, { stage, car, cfg, key }) {
    this.app = app;
    this.stage = stage;
    this.car = car;
    this.cfg = cfg;
    this.key = key || stage.id;
    this.time = 0; // temps de course (ms) depuis le départ
    this.penalty = 0;
    this.resets = 0;
    this.hits = 0;
    this.state = 'loading';
    this.splitTimes = [];
    this.spoken = new Set();
    this.cameraMode = save.settings.camera || 0;
    this.shake = 0;
    this.acc = 0;
    this.ghostRec = [];
    this.ghostTimer = 0;
    this.offTimer = 0;
    this.wrongTimer = 0;
    this.stuckTimer = 0;
    this.visTime = 0;
    this.pitch = 0;
    this.roll = 0;
    this.camYaw = 0;
  }

  load() {
    const app = this.app;
    const st = this.stage;
    this.track = new Track(st);
    const quality = save.settings.quality;
    this.world = new World(this.track, st, quality);
    const th = this.world.theme;

    const scene = (this.scene = new THREE.Scene());
    scene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);
    scene.background = new THREE.Color(th.horizon);
    scene.environment = app.envMap;
    scene.environmentIntensity = st.night ? 0.08 : 0.5;
    scene.add(this.world.group);

    this.camera = new THREE.PerspectiveCamera(62, app.aspect, 0.1, 6000);

    this.model = buildCar(this.car, this.cfg);
    scene.add(this.model.group);
    this.phys = new CarPhysics(this.car, this.cfg);
    const p0 = this.track.pointAt(this.track.start - 7);
    this.phys.reset(p0.x, p0.y, p0.a, p0.h);
    this.camYaw = p0.a;

    // Phares (spéciale de nuit).
    if (st.night) {
      const mk = (intensity, angle, dist) => {
        const l = new THREE.SpotLight('#fff3d6', intensity, dist, angle, 0.5, 1.1);
        l.position.set(this.car.dims.L / 2, 0.75, 0);
        l.target.position.set(this.car.dims.L / 2 + 20, 0, 0);
        this.model.body.add(l, l.target);
        return l;
      };
      mk(260, 0.55, 90);
      const lv = this.model.lightLevel;
      if (lv > 0) mk(220 + lv * 220, 0.32 + lv * 0.08, 140 + lv * 50);
      const glow = new THREE.PointLight('#ffd9a8', 6, 12, 1.5);
      glow.position.set(this.car.dims.L / 2 + 2, 1.2, 0);
      this.model.body.add(glow);
    }

    // Fantôme du meilleur temps.
    const ghost = save.ghost(this.key);
    if (ghost && ghost.frames?.length > 8) {
      const gcar = CARS.find((c) => c.id === ghost.car) || this.car;
      this.ghost = { data: ghost, model: buildCar(gcar, ghost.cfg || this.cfg, { ghost: true }) };
      scene.add(this.ghost.model.group);
    }

    // Effets.
    this.dust = new Particles(1800, false);
    this.flames = new Particles(300, true);
    if (st.night) this.dust.material.uniforms.uLight.value = 0.45;
    scene.add(this.dust.points, this.flames.points);
    const [sc, so] = SKID_COLORS[this.track.surface];
    this.skids = new SkidMarks(1600, sc, so);
    scene.add(this.skids.mesh);
    if (th.rain && quality !== 'low') {
      this.rain = new Rain();
      scene.add(this.rain.lines);
    }
    this.dustDef = PARTS.dust.find((d) => d.id === this.cfg.dust);
    this.flamesOn = this.cfg.exhaust === 'flames';

    this.best = save.data.best[this.key] ?? null;
    this.bestSplits = save.data.splits[this.key] || [];
    this.medalTimes = MEDALS.map((m) => ({ ...m, time: Math.round(this.track.refTime * m.factor / 100) * 100 }));

    this.setupHud();
    this.resize();
    this.state = 'countdown';
    this.countdown = 3.6;
    this.cheated = isTuned() || !!app.debugAutopilot;
    this.lastBeep = 4;
    this.app.audio.setEngineActive(true);
  }

  // ---------------------------------------------------------------- HUD
  setupHud() {
    $('hud-stage').textContent = `${this.stage.country || '📅'} ${this.stage.name}`;
    $('hud-delta').textContent = '';
    $('hud-msg').textContent = '';
    $('hud-penalty').textContent = '';
    const splits = $('hud-progress');
    splits.querySelectorAll('.split-mark').forEach((e) => e.remove());
    for (const s of this.track.splits) {
      const m = document.createElement('div');
      m.className = 'split-mark';
      m.style.left = `${(s / this.track.finish) * 100}%`;
      splits.appendChild(m);
    }
    $('hud-ghost').style.display = this.ghost ? 'block' : 'none';
    // Mini-carte pré-dessinée.
    const t = this.track;
    const cv = $('hud-minimap');
    const size = cv.width;
    const b = t.bounds;
    const span = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 1.1;
    this.mapTf = (x, y) => [((x - (b.minX + b.maxX) / 2) / span + 0.5) * size, (0.5 - (y - (b.minY + b.maxY) / 2) / span) * size];
    const off = document.createElement('canvas');
    off.width = off.height = size;
    const g = off.getContext('2d');
    g.lineCap = g.lineJoin = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 7;
    const path = () => {
      g.beginPath();
      for (let i = 0; i < t.n; i += 2) { const [x, y] = this.mapTf(t.px[i], t.py[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    };
    path();
    g.strokeStyle = '#ffffff'; g.lineWidth = 3;
    path();
    const fin = t.pointAt(t.finish);
    const [fx, fy] = this.mapTf(fin.x, fin.y);
    g.fillStyle = '#ff3344'; g.beginPath(); g.arc(fx, fy, 5, 0, Math.PI * 2); g.fill();
    this.mapBase = off;
    this.showNotes([]);
  }

  showNotes(list) {
    const box = $('hud-notes');
    const key = list.map((n) => n.s).join(',');
    if (key === this._notesKey) {
      list.forEach((n, i) => { const el = box.children[i]; if (el) el.querySelector('.dist').style.width = `${clamp(1 - n.dist / 220, 0, 1) * 100}%`; });
      return;
    }
    this._notesKey = key;
    box.innerHTML = '';
    for (const n of list) {
      const el = document.createElement('div');
      el.className = `note grade-${n.grade}`;
      let icon = '⌒';
      if (n.kind === 'corner') icon = n.grade === 0 ? (n.dir > 0 ? '↶' : '↷') : n.dir > 0 ? '↰' : '↱';
      const txt = n.kind === 'corner' && n.grade > 0 ? `<b>${n.grade}</b>` : '';
      el.innerHTML = `<span class="ico">${icon}</span>${txt}<span class="lbl">${n.label}${n.into ? ' ›' : ''}</span><div class="dist"></div>`;
      box.appendChild(el);
    }
  }

  updateHud() {
    const p = this.phys;
    const elapsed = Math.max(0, this.time) + this.penalty;
    $('hud-time').textContent = formatTime(this.state === 'countdown' ? 0 : elapsed);
    $('hud-speed').textContent = Math.round(p.speed * 3.6);
    $('hud-gear').textContent = p.gear < 0 ? 'R' : p.speed < 0.5 && !this.throttleHeld ? 'N' : p.gear;
    $('hud-rpm').style.width = `${clamp(p.rpm / 7900, 0, 1) * 100}%`;
    $('hud-rpm').classList.toggle('red', p.rpm > 7200);
    const prog = clamp(this.s / this.track.finish, 0, 1);
    $('hud-progress-fill').style.width = `${prog * 100}%`;
    if (this.ghost && this.ghostS != null) $('hud-ghost').style.left = `${clamp(this.ghostS / this.track.finish, 0, 1) * 100}%`;
    $('hud-penalty').textContent = this.penalty ? `+${(this.penalty / 1000).toFixed(0)}s pénalité` : '';

    const cv = $('hud-minimap');
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(this.mapBase, 0, 0);
    if (this.ghostPos) {
      const [gx, gy] = this.mapTf(this.ghostPos.x, this.ghostPos.y);
      g.fillStyle = 'rgba(159,216,255,0.9)'; g.beginPath(); g.arc(gx, gy, 4, 0, Math.PI * 2); g.fill();
    }
    const [x, y] = this.mapTf(p.x, p.y);
    g.save();
    g.translate(x, y);
    g.rotate(-p.heading);
    g.fillStyle = '#ffd400';
    g.strokeStyle = '#000';
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(8, 0); g.lineTo(-5, 5); g.lineTo(-3, 0); g.lineTo(-5, -5); g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }

  flash(text, cls = '', ms = 1400) {
    const el = $('hud-msg');
    el.textContent = text;
    el.className = cls;
    clearTimeout(this._flashT);
    if (ms) this._flashT = setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, ms);
  }

  // ---------------------------------------------------------------- boucle
  update(dtReal) {
    const app = this.app;
    const input = app.input;
    const dt = Math.min(dtReal, 0.1);
    this.visTime += dt;

    if (input.consume('Escape') || input.consume('KeyP')) {
      if (this.state === 'racing' || this.state === 'countdown') { app.pauseRace(); return; }
    }
    if (input.consume('KeyC')) {
      this.cameraMode = (this.cameraMode + 1) % 3;
      save.setSetting('camera', this.cameraMode);
    }

    let ctrl = input.read(dt);
    this.throttleHeld = ctrl.throttle > 0;

    if (this.state === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown - 0.6);
      if (n < this.lastBeep && n >= 1 && n <= 3) { this.lastBeep = n; app.audio.beep(520, 0.2); this.flash(String(n), 'count', 900); }
      if (this.countdown <= 0.6) {
        this.state = 'racing';
        this.time = 0;
        app.audio.beep(1040, 0.45);
        this.flash('GO !', 'count go', 900);
      }
      // Moteur qui rugit, voiture retenue.
      this.phys.rpm = damp(this.phys.rpm, 1100 + ctrl.throttle * 5500, 8, dt);
      ctrl = { throttle: 0, brake: 1, steer: ctrl.steer, handbrake: true };
    } else if (this.state === 'finished') {
      ctrl = this.autopilot.input();
      ctrl.throttle = 0;
      ctrl.brake = 0.6;
    }

    if (this.state === 'racing' && app.debugAutopilot) {
      this.cheated = true;
      ctrl = (this._dbgAI ||= new AIDriver(this.track, this.phys)).input();
    }
    if (this.state === 'racing') {
      if (input.consume('KeyR') || input.consume('PadReset')) this.resetToRoad(true);
    }

    // Physique à pas fixe.
    this.acc += dt;
    let steps = 0;
    while (this.acc >= DT && steps < 10) {
      this.acc -= DT;
      steps++;
      const freeze = this.state === 'countdown';
      if (!freeze) this.phys.step(DT, ctrl, this.track);
      else this.phys.events.length = 0;
      this.collide();
      if (this.state === 'racing') this.time += DT * 1000;
    }

    this.handleEvents();
    this.progress(dt);
    this.updateGhost(dt);
    this.updateVisuals(dt);
    this.updateCamera(dt);
    this.updateHud();
    this.app.audio.update(this.phys.rpm, this.state === 'countdown' ? (this.throttleHeld ? 1 : 0) : ctrl.throttle, this.phys.speed, Math.max(this.phys.slide, Math.min(this.phys.spin, 1)), SURFACES[this.phys.surface].loose, this.phys.airborne);
  }

  collide() {
    const p = this.phys;
    const R = this.car.dims.W * 0.5;
    const half = this.car.dims.L * 0.32;
    const c = Math.cos(p.heading), s = Math.sin(p.heading);
    let impact = 0;
    // Deux cercles (avant / arrière) contre arbres, rochers, bottes de paille.
    for (const k of [-1, 1]) {
      const cx = p.x + c * half * k, cy = p.y + s * half * k;
      for (const o of this.world.collidersNear(cx, cy)) {
        const dx = cx - o.x, dy = cy - o.y;
        const d = Math.hypot(dx, dy);
        const min = o.r + R;
        if (d < min && d > 1e-4) impact = Math.max(impact, p.collide(dx / d, dy / d, min - d, 0.3));
      }
    }
    // Glissières.
    const q = this.track.nearest(p.x, p.y, p.hint);
    if (!q.far) {
      for (const b of this.world.barriers) {
        if (q.s < b.s0 || q.s > b.s1) continue;
        const lim = this.track.halfW + 0.9 - R;
        const out = q.d * b.side - lim;
        if (out > 0 && out < 3) {
          const pt = this.track.pointAt(q.s);
          const nx = Math.sin(pt.a) * b.side, ny = -Math.cos(pt.a) * b.side; // vers la route
          impact = Math.max(impact, p.collide(nx, ny, out, 0.15));
        }
      }
    }
    if (impact > 2) {
      this.shake = Math.max(this.shake, Math.min(impact / 12, 1));
      if (!this._lastHit || this.visTime - this._lastHit > 0.3) {
        this.app.audio.crash(impact);
        this._lastHit = this.visTime;
        if (impact > 6) this.hits++;
      }
    }
  }

  handleEvents() {
    const p = this.phys;
    for (const e of p.events) {
      if (e.type === 'land') {
        if (e.air > 0.25) {
          this.app.audio.thump(e.air);
          this.shake = Math.max(this.shake, Math.min(e.air * 0.7, 1));
          this.burst(10 + e.air * 20);
          if (e.air > 0.7) this.flash(`SAUT ${(e.air).toFixed(1)} s !`, 'info', 900);
        }
      } else if (e.type === 'shift' && e.up) {
        if (this.flamesOn) this.backfire(6);
      }
    }
    p.events.length = 0;
    if (this.flamesOn && this.lastThrottle > 0.5 && !this.throttleHeld && p.rpm > 5000) this.backfire(4);
    this.lastThrottle = this.throttleHeld ? 1 : 0;
  }

  progress(dt) {
    const p = this.phys, t = this.track;
    const q = t.nearest(p.x, p.y, p.hint);
    this.s = q.far ? this.s || 0 : q.s;
    if (this.state !== 'racing') return;

    // Hors piste lointain : remise automatique.
    const ad = q.far ? 999 : Math.abs(q.d);
    if (ad > 28) {
      this.offTimer += dt;
      if (this.offTimer > 0.2) this.flash('HORS PISTE !', 'warn', 1000);
      if (this.offTimer > 1.4) this.resetToRoad(true);
    } else this.offTimer = 0;

    // Mauvais sens.
    const pt = t.pointAt(this.s);
    const along = Math.cos(p.heading - pt.a);
    if (along < -0.3 && p.speed > 4) {
      this.wrongTimer += dt;
      if (this.wrongTimer > 1.5) this.flash('MAUVAIS SENS !', 'warn', 600);
    } else this.wrongTimer = 0;

    // Bloqué ?
    if (p.speed < 1.5 && (ad > t.halfW + 1 || along < 0)) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 3) this.flash('Appuie sur R pour revenir sur la route', 'info', 1200);
    } else this.stuckTimer = 0;

    // Temps intermédiaires.
    for (let i = 0; i < t.splits.length; i++) {
      if (this.splitTimes[i] == null && this.s >= t.splits[i] && this.s < t.splits[i] + 40) {
        const tm = this.time + this.penalty;
        this.splitTimes[i] = tm;
        const ref = this.bestSplits[i];
        if (ref != null) {
          const d = tm - ref;
          $('hud-delta').textContent = formatDelta(d);
          $('hud-delta').className = d <= 0 ? 'good' : 'bad';
          this.flash(`INTER ${i + 1}  ${formatDelta(d)}`, d <= 0 ? 'good' : 'bad', 1800);
        } else {
          this.flash(`INTER ${i + 1}  ${formatTime(tm)}`, 'info', 1800);
        }
        this.app.audio.beep(880, 0.12, 0.2);
      }
    }

    // Notes du copilote.
    const upcoming = [];
    for (const n of t.notes) {
      if (n.end < this.s) continue;
      const dist = n.s - this.s;
      if (dist > 260) break;
      upcoming.push({ ...n, dist: Math.max(dist, 0) });
      if (upcoming.length >= 2) break;
    }
    this.showNotes(upcoming);
    const callDist = 45 + p.speed * 3.2;
    for (let i = 0; i < upcoming.length; i++) {
      const n = upcoming[i];
      if (n.dist < callDist && !this.spoken.has(n.s)) {
        this.spoken.add(n.s);
        let txt = this.noteSpeech(n);
        if (n.into && upcoming[i + 1] && !this.spoken.has(upcoming[i + 1].s)) {
          this.spoken.add(upcoming[i + 1].s);
          txt += ', dans, ' + this.noteSpeech(upcoming[i + 1]);
        }
        this.app.codriver.say(txt);
      }
    }

    // Arrivée.
    if (this.s >= t.finish && this.s < t.finish + 30) this.finish();
  }

  noteSpeech(n) {
    if (n.kind === 'crest') return n.label.startsWith('Saut') ? 'saut' : 'bosse';
    if (n.grade === 0) return n.label.toLowerCase();
    return `${n.dir > 0 ? 'gauche' : 'droite'} ${GRADE_WORDS[n.grade]}${n.label.endsWith('long') ? ' long' : ''}`;
  }

  // --- Outils du panneau de debug.
  teleport(s, speed = 0) {
    const t = this.track, p = this.phys;
    const pt = t.pointAt(clamp(s, t.start, t.finish + 20));
    p.reset(pt.x, pt.y, pt.a, pt.h);
    p.hint = pt.idx;
    p.vx = speed;
    this.camYaw = pt.a;
    this._camInit = false;
    this.skids.last.clear();
  }

  debugNextNote() {
    const next = this.track.notes.find((n) => n.s > (this.s ?? 0) + 5);
    this.teleport(next ? next.s - 40 : this.track.finish - 30, this.phys.speed);
  }

  debugFinish() { this.teleport(this.track.finish - 12, 15); }

  resetToRoad(penalize) {
    const p = this.phys, t = this.track;
    const q = t.nearest(p.x, p.y, p.hint);
    const s = clamp(q.far ? this.s : q.s, t.start, t.finish - 5);
    const pt = t.pointAt(Math.max(t.start, s - 3));
    p.reset(pt.x, pt.y, pt.a, pt.h);
    p.hint = pt.idx;
    this.camYaw = pt.a;
    if (penalize) {
      this.penalty += RESET_PENALTY;
      this.resets++;
      this.flash('REMISE EN PISTE +5 s', 'warn', 1500);
    }
    this.skids.last.clear();
  }

  finish() {
    this.state = 'finished';
    this.autopilot = new AIDriver(this.track, this.phys);
    const total = Math.round(this.time + this.penalty);
    this.finalTime = total;
    this.app.codriver.say('Arrivée ! Bravo.');
    this.app.audio.beep(1320, 0.5, 0.25);
    this.flash(formatTime(total), 'count', 0);
    // Fantôme : on enregistre le dernier point.
    this.recordGhostFrame();
    setTimeout(() => this.app.raceFinished(this.buildResult()), 2200);
  }

  buildResult() {
    const total = this.finalTime;
    const prevBest = this.best;
    const isBest = !this.cheated && (prevBest == null || total < prevBest);
    let medal = null;
    for (const m of this.medalTimes) if (total <= m.time) { medal = m; break; }
    return {
      key: this.key, stage: this.stage, time: total, prevBest, isBest, medal,
      medalTimes: this.medalTimes, resets: this.resets, hits: this.hits, penalty: this.penalty,
      splits: this.splitTimes, cheated: this.cheated, car: this.car,
      ghost: isBest ? { car: this.car.id, cfg: this.cfg, time: total, frames: this.ghostRec } : null,
    };
  }

  // ---------------------------------------------------------------- fantôme
  recordGhostFrame() {
    const p = this.phys;
    this.ghostRec.push(+p.x.toFixed(2), +p.y.toFixed(2), +p.alt.toFixed(2), +p.heading.toFixed(3));
  }

  updateGhost(dt) {
    if (this.state === 'racing') {
      this.ghostTimer += dt;
      while (this.ghostTimer >= 0.05) { this.ghostTimer -= 0.05; this.recordGhostFrame(); }
    }
    if (!this.ghost) return;
    const f = this.ghost.data.frames;
    const n = f.length / 4;
    const tt = this.state === 'countdown' ? 0 : this.time / 50;
    const i = Math.min(Math.floor(tt), n - 2);
    const k = clamp(tt - i, 0, 1);
    const g = (j) => lerp(f[i * 4 + j], f[(i + 1) * 4 + j], k);
    const x = g(0), y = g(1), alt = g(2);
    const head = f[i * 4 + 3] + wrapAngle(f[(i + 1) * 4 + 3] - f[i * 4 + 3]) * k;
    const gm = this.ghost.model.group;
    gm.position.set(x, alt, -y);
    gm.rotation.set(0, head, 0);
    this.ghostPos = { x, y };
    this.ghostS = this.track.nearest(x, y, this.ghostHint ?? -1).s;
    this.ghostHint = Math.floor(this.ghostS / SAMPLE);
    // Le fantôme s'efface quand on est dessus.
    const d = Math.hypot(x - this.phys.x, y - this.phys.y);
    gm.visible = d > 2.5;
  }

  // ---------------------------------------------------------------- visuels
  updateVisuals(dt) {
    const p = this.phys, m = this.model, t = this.track;
    const g = m.group;
    g.position.set(p.x, p.alt, -p.y);
    if (!p.airborne) {
      const c = Math.cos(p.heading), s = Math.sin(p.heading);
      const hw = this.car.dims.wheelbase / 2, ht = this.car.dims.track / 2;
      const hF = t.heightAt(p.x + c * hw, p.y + s * hw, p.hint), hB = t.heightAt(p.x - c * hw, p.y - s * hw, p.hint);
      const hL = t.heightAt(p.x - s * ht, p.y + c * ht, p.hint), hR = t.heightAt(p.x + s * ht, p.y - c * ht, p.hint);
      this.pitch = damp(this.pitch, Math.atan2(hF - hB, hw * 2), 18, dt);
      this.roll = damp(this.roll, Math.atan2(hL - hR, ht * 2), 18, dt);
      g.position.y = Math.max(p.alt, (hF + hB + hL + hR) / 4);
    } else {
      this.pitch = damp(this.pitch, -0.12, 1.2, dt);
      this.roll = damp(this.roll, 0, 2, dt);
    }
    g.rotation.order = 'YZX';
    g.rotation.set(this.roll, p.heading, this.pitch);
    poseCar(m, p, dt);
    g.updateMatrixWorld(true);
    if (m.neon) m.neon.material.opacity = 0.75 + Math.sin(this.visTime * 3) * 0.15;

    // Projections et traces.
    const surf = SURFACES[p.surface];
    const speed = p.speed;
    const [wvx, wvy] = p.worldVel;
    const loose = surf.loose;
    const emitK = loose * (Math.min(speed / 22, 1.4) + p.slide * 1.6 + Math.min(p.spin, 1.5)) * (p.airborne ? 0 : 1);
    let color = this._dustCol || (this._dustCol = new THREE.Color());
    if (this.dustDef?.hex === 'rainbow') color.setHSL((this.visTime * 0.4) % 1, 0.9, 0.6);
    else if (this.dustDef?.hex) color.set(this.dustDef.hex);
    else color.set(p.offroad ? SURFACES[p.surface].dust : this.world.theme.dust || surf.dust);
    const tmp = this._tmp || (this._tmp = new THREE.Vector3());
    for (const w of m.wheels) {
      w.pivot.getWorldPosition(tmp);
      tmp.y -= this.car.dims.wheelR - 0.05;
      const drive = (w.front ? p.split[0] : p.split[1]) > 0;
      const k = emitK * (w.front ? 0.45 : 1) * (drive || !w.front ? 1 : 0.6);
      const count = k * 60 * dt * (save.settings.quality === 'low' ? 0.5 : 1);
      let n = Math.floor(count) + (Math.random() < count % 1 ? 1 : 0);
      const fx = PFX[p.surface] || PFX.gravel;
      while (n-- > 0) {
        const r = () => (Math.random() - 0.5);
        this.dust.emit(
          tmp.x + r() * 0.3, tmp.y + 0.1, tmp.z + r() * 0.3,
          -wvx * 0.15 + r() * 2.5, (0.5 + Math.random()) * fx.up, wvy * 0.15 + r() * 2.5,
          color, fx.alpha * (0.6 + Math.random() * 0.4), fx.size * (0.8 + Math.random() * 0.5),
          fx.life * (0.7 + Math.random() * 0.6), fx.grow, fx.grav,
        );
      }
      const marking = !p.airborne && (p.slide > 0.25 || p.lock || (drive && p.spin > 0.2));
      this.skids.track(w, tmp, marking, 0.24);
    }
    this.dust.update(dt);
    this.flames.update(dt);
    if (this.rain) this.rain.update(dt, this.camera.position);
    this.world.updateSpectators(this.visTime, this.s ?? null);
    this.world.follow(g.position);
  }

  burst(n) {
    const p = this.phys, col = this._dustCol || new THREE.Color('#b49a76');
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.dust.emit(p.x + Math.cos(a), p.alt + 0.2, -p.y + Math.sin(a), Math.cos(a) * 4, 1 + Math.random() * 2, Math.sin(a) * 4, col, 0.6, 1, 1.6, 2.5, 0.2);
    }
  }

  backfire(n) {
    const m = this.model;
    const ex = m.body.localToWorld(m.exhaust.clone());
    const c = Math.cos(this.phys.heading), s = Math.sin(this.phys.heading);
    const cols = [new THREE.Color('#ff9a1f'), new THREE.Color('#ffd23f'), new THREE.Color('#5aa0ff')];
    for (let i = 0; i < n; i++) {
      this.flames.emit(ex.x, ex.y, ex.z, -c * (4 + Math.random() * 4), Math.random(), s * (4 + Math.random() * 4), cols[i % 3], 0.9, 0.45 + Math.random() * 0.3, 0.12 + Math.random() * 0.1, -1.5, 0);
    }
    if (Math.random() < 0.7) this.app.audio.pop();
  }

  updateCamera(dt) {
    const p = this.phys, cam = this.camera, g = this.model.group;
    const speed = p.speed;
    const beta = speed > 3 ? Math.atan2(p.vy, Math.abs(p.vx)) : 0;
    const target = p.heading + beta * 0.55;
    this.camYaw += wrapAngle(target - this.camYaw) * Math.min(1, dt * 4.5);
    const modes = [[6.4, 2.35], [9.5, 3.6], [0, 0]];
    const [dist, h] = modes[this.cameraMode];
    const fovTarget = 60 + Math.min(speed, 50) * 0.32;
    cam.fov = damp(cam.fov, fovTarget, 3, dt);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const rough = (p.offroad ? 0.05 : SURFACES[p.surface].loose * 0.012) * Math.min(speed / 25, 1);
    const sh = this.shake * 0.25 + rough;
    const jitter = () => (Math.random() - 0.5) * sh;

    if (this.app.debug?.orbitCam) {
      const a = this.visTime * 0.35;
      cam.position.set(p.x + Math.cos(a) * 9, p.alt + 3.5, -(p.y + Math.sin(a) * 9));
      cam.lookAt(p.x, p.alt + 0.8, -p.y);
    } else if (this.cameraMode === 2) {
      // Vue capot.
      const local = new THREE.Vector3(this.car.dims.L * 0.1, this.model.roofY - 0.25, 0);
      const pos = g.localToWorld(local);
      cam.position.copy(pos).add(new THREE.Vector3(jitter(), jitter(), jitter()));
      const look = g.localToWorld(new THREE.Vector3(30, this.model.roofY - 1.2, 0));
      cam.lookAt(look);
    } else {
      const bx = -Math.cos(this.camYaw), by = -Math.sin(this.camYaw);
      const want = new THREE.Vector3(p.x + bx * dist, p.alt + h, -(p.y + by * dist));
      const groundH = this.track.heightAt(want.x, -want.z, p.hint) + 0.8;
      want.y = Math.max(want.y, groundH);
      if (!this._camInit) { cam.position.copy(want); this._camInit = true; }
      cam.position.x = damp(cam.position.x, want.x, 12, dt);
      cam.position.z = damp(cam.position.z, want.z, 12, dt);
      cam.position.y = damp(cam.position.y, want.y, 6, dt);
      cam.position.x += jitter(); cam.position.y += jitter(); cam.position.z += jitter();
      const look = new THREE.Vector3(p.x + Math.cos(this.camYaw) * 2.5, p.alt + 1.1, -(p.y + Math.sin(this.camYaw) * 2.5));
      cam.lookAt(look);
    }
    cam.updateProjectionMatrix();
  }

  resize() {
    if (!this.camera) return;
    this.camera.aspect = this.app.aspect;
    this.camera.updateProjectionMatrix();
    const h = this.app.renderer.domElement.height;
    this.dust?.setScale(h, this.camera.fov);
    this.flames?.setScale(h, this.camera.fov);
  }

  render(renderer) {
    this.dust.setScale(renderer.domElement.height, this.camera.fov);
    this.flames.setScale(renderer.domElement.height, this.camera.fov);
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.app.audio.setEngineActive(false);
    this.app.codriver.stop();
    clearTimeout(this._flashT);
    this.world.dispose();
    this.model.dispose();
    this.ghost?.model.dispose();
    this.dust.dispose();
    this.flames.dispose();
    this.skids.dispose();
    this.rain?.dispose();
  }
}
