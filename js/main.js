// Point d'entrée : rendu, écrans, garage, enchaînement des courses.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CARS, COLORS, PARTS, STAGES, MEDALS, SURFACES, GARAGE_TABS, DAILY_SURFACES, SURFACE_THEME, colorHex } from './data.js';
import { save } from './save.js';
import { Garage } from './garage.js';
import { Race } from './race.js';
import { Track } from './trackgen.js';
import { Input } from './input.js';
import { AudioFX, CoDriver } from './audio.js';
import { DebugPanel } from './debug.js';
import { Online } from './online.js';
import { AccountUI } from './accountUI.js';
import { VERSION, RELEASES } from './version.js';
import { formatTime, formatDelta, hashString, mulberry32, todayKey } from './util.js';

const $ = (id) => document.getElementById(id);
const SURF_COLORS = { gravel: '#b48a5a', tarmac: '#8a8f99', snow: '#cfe3ff', sand: '#e0b86e', mud: '#6b4a2e' };
const COLOR_SLOTS = new Set(['paint', 'livery2', 'rimColor']);
const MEDAL_RANK = { gold: 0, silver: 1, bronze: 2 };

function dailyStage() {
  const key = todayKey();
  const h = hashString(`rallye-${key}`);
  const rng = mulberry32(h);
  const surface = DAILY_SURFACES[h % DAILY_SURFACES.length];
  const [y, m, d] = key.split('-');
  return {
    id: `daily-${key}`, name: 'Défi du jour', country: '📅', surface, theme: SURFACE_THEME[surface],
    length: 2200 + Math.floor(rng() * 800), seed: h % 100000, hairpin: 0.03 + rng() * 0.15, twist: 0.4 + rng() * 0.45,
    reward: 350, daily: true, desc: `Spéciale unique du ${d}/${m}/${y}. +500 🪙 à la première arrivée du jour.`,
  };
}

class App {
  constructor() {
    const canvas = $('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping; // garde des couleurs de carrosserie saturées
    this.renderer.toneMappingExposure = 1.0;
    this.applyQuality();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.input = new Input();
    this.audio = new AudioFX();
    this.audio.enabled = save.settings.sound;
    this.codriver = new CoDriver();
    this.codriver.enabled = save.settings.voice;
    this.refTimes = new Map();

    this.garage = new Garage(this);
    this.mode = 'garage';
    this.screen = 'menu';
    this.viewCarId = save.selectedCar.id;
    this.tab = 'cars';
    this.pending = null;
    this.garage.setCar(save.selectedCar, save.config(save.selectedCar.id));

    this.isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    document.body.classList.toggle('touch-device', this.isTouch);
    this.input.bindTouch($('touch'));

    this.bindUI();
    this.debug = new DebugPanel(this);
    this.online = new Online();
    this.account = new AccountUI(this, this.online);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.showScreen('menu');
    this.setupReleaseNotes();

    // L'audio ne peut démarrer qu'après une interaction.
    const unlock = () => { this.audio.init(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    this.clock = new THREE.Clock();
    this.time = 0;
    this.renderer.setAnimationLoop(() => this.frame());
    window.__rallye = this; // utile pour le débogage / tests automatisés
  }

  applyQuality() {
    const high = save.settings.quality !== 'low';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 2 : 1));
    this.renderer.shadowMap.enabled = high;
  }

  get aspect() { return window.innerWidth / window.innerHeight; }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.garage.resize();
    this.race?.resize();
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.time += dt;
    if (this.mode === 'race' && this.race) {
      if (!this.paused && this.race.state !== 'loading') this.race.update(dt * this.debug.timeScale);
      if (this.paused && (this.input.consume('Escape') || this.input.consume('KeyP'))) this.resumeRace();
      this.race.render(this.renderer);
    } else {
      this.garage.update(dt, this.time);
      this.garage.render(this.renderer);
      if (this.input.consume('Escape') && this.screen !== 'menu') this.back();
    }
    this.debug.frame(dt);
    this.input.endFrame();
  }

  // Réaffiche l'écran courant (après un changement fait depuis le panneau de debug).
  refreshScreen() {
    if (this.mode === 'race') return;
    if (this.screen === 'garage') this.renderGarage();
    else if (this.screen === 'stages') this.renderStages();
  }

  // ------------------------------------------------------------- écrans
  showScreen(name) {
    this.screen = name;
    for (const s of ['menu', 'stages', 'garage']) $(`screen-${s}`).classList.toggle('hidden', s !== name);
    $('topbar').classList.toggle('hidden', !['menu', 'stages', 'garage'].includes(name));
    $('btn-back').classList.toggle('hidden', name === 'menu');
    $('topbar-title').textContent = { menu: '', stages: 'SPÉCIALES', garage: 'GARAGE' }[name] || '';
    this.updateCoins();
    if (name === 'menu') {
      this.revertPreview();
      this.viewCarId = save.selectedCar.id;
      this.garage.setCar(save.selectedCar, save.config(this.viewCarId));
      this.garage.focus('menu');
      const car = save.selectedCar;
      $('menu-car-name').textContent = car.name;
      $('menu-car-desc').textContent = `${car.drive} · ${car.power} kW · ${car.mass} kg`;
      const ds = dailyStage();
      $('daily-sub').textContent = save.data.daily[ds.id] ? 'Déjà terminé aujourd’hui — record à battre !' : `${SURFACES[ds.surface].name} · +500 🪙 bonus`;
    }
    if (name === 'stages') { this.garage.focus('threeq'); this.renderStages(); }
    if (name === 'garage') { this.renderGarage(); }
  }

  back() {
    if (this.screen === 'garage' && this.pending) { this.revertPreview(); return; }
    this.showScreen('menu');
  }

  updateCoins(bump) {
    $('coins-val').textContent = save.coins.toLocaleString('fr-FR');
    if (bump) { $('coins').classList.remove('bump'); void $('coins').offsetWidth; $('coins').classList.add('bump'); }
  }

  toast(text, bad = false) {
    const t = $('toast');
    t.textContent = text;
    t.className = `show${bad ? ' bad' : ''}`;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { t.className = ''; }, 1800);
  }

  bindUI() {
    $('btn-play').onclick = () => this.showScreen('stages');
    $('btn-garage').onclick = () => { this.tab = 'cars'; this.showScreen('garage'); };
    $('btn-daily').onclick = () => this.startRace(dailyStage());
    $('btn-back').onclick = () => this.back();
    $('btn-stages-garage').onclick = () => { this.tab = 'cars'; this.showScreen('garage'); };
    $('btn-settings').onclick = () => this.openSettings();
    $('btn-settings-close').onclick = () => $('screen-settings').classList.add('hidden');
    $('set-sound').onchange = (e) => { save.setSetting('sound', e.target.checked); this.audio.setEnabled(e.target.checked); };
    $('set-voice').onchange = (e) => { save.setSetting('voice', e.target.checked); this.codriver.enabled = e.target.checked; };
    $('set-quality').onchange = (e) => { save.setSetting('quality', e.target.checked ? 'high' : 'low'); this.applyQuality(); this.resize(); };
    $('btn-reset').onclick = () => {
      if (!confirm('Effacer toute la progression (pièces, voitures, records) ?')) return;
      save.reset();
      $('screen-settings').classList.add('hidden');
      this.showScreen('menu');
      this.toast('Progression réinitialisée');
    };
    $('btn-pause').onclick = () => this.pauseRace();
    $('btn-resume').onclick = () => this.resumeRace();
    $('btn-restart').onclick = () => { $('screen-pause').classList.add('hidden'); this.paused = false; this.startRace(this.race.stage); };
    $('btn-quit').onclick = () => { $('screen-pause').classList.add('hidden'); this.exitRace('stages'); };
    $('btn-res-retry').onclick = () => { $('screen-results').classList.add('hidden'); this.startRace(this.race.stage); };
    $('btn-res-stages').onclick = () => { $('screen-results').classList.add('hidden'); this.exitRace('stages'); };
    $('btn-res-garage').onclick = () => { $('screen-results').classList.add('hidden'); this.tab = 'cars'; this.exitRace('garage'); };
    $('btn-buy').onclick = () => this.confirmPurchase();
    $('btn-buy-cancel').onclick = () => this.revertPreview();
  }

  setupReleaseNotes() {
    const label = $('btn-version');
    label.textContent = `v${VERSION} · Nouveautés`;
    let taps = [];
    label.onclick = () => {
      // 5 appuis rapides : panneau de debug (pratique sur mobile, sans clavier).
      const now = performance.now();
      taps = taps.filter((t) => now - t < 2000).concat(now);
      if (taps.length >= 5) { taps = []; $('screen-notes').classList.add('hidden'); this.debug.toggle(true); return; }
      this.openReleaseNotes();
    };
    $('btn-notes-close').onclick = () => $('screen-notes').classList.add('hidden');
    const seen = save.data.seenVersion;
    if (seen !== VERSION) {
      save.data.seenVersion = VERSION;
      save.persist(false);
      // Pas de notes au tout premier lancement, seulement après une mise à jour.
      if (seen || Object.keys(save.data.best).length) this.openReleaseNotes();
    }
  }

  openReleaseNotes() {
    $('notes-list').innerHTML = RELEASES.map((r) => `
      <article class="release">
        <h3>v${r.version} <small>${r.date.split('-').reverse().join('/')}</small></h3>
        <div class="release-title">${r.title}</div>
        <ul>${r.notes.map((n) => `<li>${n}</li>`).join('')}</ul>
      </article>`).join('');
    $('screen-notes').classList.remove('hidden');
  }

  openSettings() {
    $('set-sound').checked = save.settings.sound;
    $('set-voice').checked = save.settings.voice;
    $('set-quality').checked = save.settings.quality !== 'low';
    $('screen-settings').classList.remove('hidden');
  }

  // ------------------------------------------------------------- spéciales
  refTime(stage) {
    if (!this.refTimes.has(stage.id)) this.refTimes.set(stage.id, new Track(stage).refTime);
    return this.refTimes.get(stage.id);
  }

  stageCard(stage, i) {
    const unlocked = stage.daily || i === 0 || save.data.finished[STAGES[i - 1].id];
    const best = save.data.best[stage.id];
    const medal = save.data.medals[stage.id];
    const ref = this.refTime(stage);
    const el = document.createElement('div');
    el.className = `stage-card${unlocked ? '' : ' locked'}${stage.daily ? ' daily' : ''}`;
    el.style.setProperty('--surf', SURF_COLORS[stage.surface]);
    const medals = MEDALS.map((m) => {
      const t = Math.round(ref * m.factor / 100) * 100;
      const got = best != null && best <= t;
      return `<span class="${got ? 'got' : ''}">${m.icon} ${formatTime(t).slice(0, -2)}</span>`;
    }).join('');
    const won = medal ? MEDALS.find((m) => m.id === medal).icon : '';
    el.innerHTML = `
      ${won ? `<div class="won">${won}</div>` : ''}
      <div>${stage.country}</div>
      <h3>${stage.name}</h3>
      <div class="meta"><span class="badge">${SURFACES[stage.surface].name}</span><span class="badge">${(stage.length / 1000).toFixed(1)} km</span>${stage.night ? '<span class="badge">🌙 Nuit</span>' : ''}<span class="badge">+${stage.reward} 🪙</span></div>
      <p>${stage.desc}</p>
      <div class="medals">${medals}</div>
      <div class="best">Record : <b>${best != null ? formatTime(best) : '—'}</b></div>
      ${unlocked ? '' : `<div class="lock">🔒 Termine « ${STAGES[i - 1].name} » pour débloquer</div>`}
      ${this.online.configured ? '<button class="btn small board-link">🏆 Classement</button>' : ''}`;
    el.querySelector('.board-link')?.addEventListener('click', (e) => { e.stopPropagation(); this.account.openBoard(stage); });
    el.onclick = () => {
      if (!unlocked) { this.toast('Spéciale verrouillée', true); return; }
      this.startRace(stage);
    };
    return el;
  }

  renderStages() {
    $('stages-car-name').textContent = save.selectedCar.name;
    const list = $('stage-list');
    list.innerHTML = '';
    list.appendChild(this.stageCard(dailyStage(), -1));
    STAGES.forEach((s, i) => list.appendChild(this.stageCard(s, i)));
  }

  // ------------------------------------------------------------- garage
  renderGarage() {
    const tabs = $('garage-tabs');
    tabs.innerHTML = '';
    for (const t of GARAGE_TABS) {
      const b = document.createElement('button');
      b.className = t.id === this.tab ? 'active' : '';
      b.innerHTML = `<span class="ti">${t.icon}</span><span class="tl">${t.label}</span>`;
      b.onclick = () => {
        this.revertPreview();
        this.tab = t.id;
        if (t.id !== 'cars' && this.viewCarId !== save.selectedCar.id) {
          this.viewCarId = save.selectedCar.id;
          this.garage.setCar(save.selectedCar, save.config(this.viewCarId));
        }
        this.renderGarage();
      };
      tabs.appendChild(b);
    }
    const tab = GARAGE_TABS.find((t) => t.id === this.tab);
    this.garage.focus(tab.focus || 'threeq');
    const panel = $('garage-panel');
    panel.innerHTML = '';
    if (tab.id === 'cars') this.renderCars(panel);
    else for (const sec of tab.sections) this.renderSection(panel, sec);
  }

  renderCars(panel) {
    const maxP = Math.max(...CARS.map((c) => c.power / c.mass));
    for (const car of CARS) {
      const owned = save.ownsCar(car.id);
      const selected = save.selectedCar.id === car.id;
      const el = document.createElement('div');
      el.className = `car-card${selected ? ' selected' : ''}${this.viewCarId === car.id && !selected ? ' viewing' : ''}`;
      const bar = (label, v) => `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${Math.round(Math.min(v, 1) * 100)}%"></i></div></div>`;
      el.innerHTML = `
        <div class="row"><h3>${car.name}</h3><span class="drive">${car.drive}</span></div>
        <p>${car.desc}</p>
        ${bar('Accélération', (car.power / car.mass) / maxP)}
        ${bar('Vitesse max', (car.top - 40) / 22)}
        ${bar('Adhérence', (car.grip - 0.85) / 0.3)}
        ${bar('Hors piste', car.offroad ? 1 : car.drive === 'AWD' ? 0.6 : 0.4)}
        <div class="actions">${selected ? '<span class="badge">✔ Sélectionnée</span>' : owned ? '<button class="btn small primary">Choisir</button>' : `<span class="badge">🪙 ${car.price.toLocaleString('fr-FR')}</span>`}</div>`;
      el.onclick = () => {
        this.revertPreview(false);
        this.viewCarId = car.id;
        this.garage.setCar(car, save.config(car.id));
        if (owned) {
          save.selectCar(car.id);
          this.toast(`${car.name} sélectionnée`);
        } else {
          this.pending = { type: 'car', car, price: car.price, label: car.name };
          this.showBuyBar();
        }
        this.renderGarage();
      };
      panel.appendChild(el);
    }
  }

  ownKey(slot, id) { return COLOR_SLOTS.has(slot) ? `color:${id}` : `${slot}:${id}`; }

  renderSection(panel, sec) {
    const h = document.createElement('h4');
    h.textContent = sec.title;
    panel.appendChild(h);
    if (sec.hint) { const p = document.createElement('div'); p.className = 'hint'; p.textContent = sec.hint; panel.appendChild(p); }
    const carId = this.viewCarId;
    const cfg = save.config(carId);
    const previewId = this.pending?.slot === sec.slot ? this.pending.id : null;

    if (sec.kind === 'number') {
      const wrap = document.createElement('div');
      wrap.className = 'stepper';
      wrap.innerHTML = '<button class="btn">−</button><div class="num"></div><button class="btn">+</button><button class="btn small">Aléatoire</button>';
      const [minus, num, plus, rnd] = wrap.children;
      num.textContent = cfg.number;
      const set = (n) => {
        const c = save.config(carId);
        c.number = ((n - 1 + 99) % 99) + 1;
        save.setConfig(carId, c);
        num.textContent = c.number;
        this.garage.setCar(CARS.find((x) => x.id === carId), c);
      };
      minus.onclick = () => set(save.config(carId).number - 1);
      plus.onclick = () => set(save.config(carId).number + 1);
      rnd.onclick = () => set(1 + Math.floor(Math.random() * 99));
      panel.appendChild(wrap);
      return;
    }

    if (sec.kind === 'color') {
      const grid = document.createElement('div');
      grid.className = 'swatches';
      for (const c of COLORS) {
        const owned = save.owns(this.ownKey(sec.slot, c.id), carId);
        const sw = document.createElement('div');
        sw.className = `swatch${cfg[sec.slot] === c.id && !previewId ? ' equipped' : ''}${previewId === c.id ? ' preview' : ''}`;
        sw.style.background = c.hex;
        sw.title = `${c.name}${owned ? '' : ` — ${c.price} 🪙`}`;
        if (!owned) sw.innerHTML = '<span class="lockdot">🔒</span>';
        sw.onclick = () => this.pickItem(sec.slot, c.id, c.price, c.name, owned);
        grid.appendChild(sw);
      }
      panel.appendChild(grid);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const it of PARTS[sec.slot]) {
      const owned = save.owns(this.ownKey(sec.slot, it.id), carId);
      const el = document.createElement('div');
      el.className = `item${cfg[sec.slot] === it.id && !previewId ? ' equipped' : ''}${previewId === it.id ? ' preview' : ''}${owned ? '' : ' locked'}`;
      const sw = it.hex && it.hex !== 'rainbow' ? `<span style="width:18px;height:18px;border-radius:50%;background:${it.hex};display:inline-block"></span>` : it.hex === 'rainbow' ? '🌈' : '';
      el.innerHTML = `${sw}<span class="name">${it.name}</span>${owned ? (cfg[sec.slot] === it.id ? '<span class="owned-tag">Équipé</span>' : '<span class="owned-tag">Possédé</span>') : `<span class="price">🔒 ${it.price} 🪙</span>`}`;
      el.onclick = () => this.pickItem(sec.slot, it.id, it.price, it.name, owned);
      grid.appendChild(el);
    }
    panel.appendChild(grid);
  }

  pickItem(slot, id, price, name, owned) {
    const carId = this.viewCarId;
    const car = CARS.find((c) => c.id === carId);
    if (!save.ownsCar(carId)) { this.toast('Achète d’abord cette voiture', true); return; }
    const cfg = save.config(carId);
    if (owned) {
      this.pending = null;
      cfg[slot] = id;
      save.setConfig(carId, cfg);
      this.garage.setCar(car, cfg);
      this.hideBuyBar();
    } else {
      this.pending = { type: 'item', slot, id, price, label: name, key: this.ownKey(slot, id) };
      this.garage.setCar(car, { ...cfg, [slot]: id });
      this.showBuyBar();
    }
    this.renderGarage();
  }

  showBuyBar() {
    const p = this.pending;
    $('buy-name').textContent = p.label;
    $('buy-price').textContent = `🪙 ${p.price.toLocaleString('fr-FR')}`;
    $('btn-buy').disabled = save.coins < p.price;
    $('btn-buy').textContent = save.coins < p.price ? 'Pas assez de pièces' : 'Acheter';
    $('garage-buy').classList.remove('hidden');
  }

  hideBuyBar() { $('garage-buy').classList.add('hidden'); }

  revertPreview(rerender = true) {
    const had = this.pending;
    this.pending = null;
    this.hideBuyBar();
    if (!had) return;
    if (had.type === 'car') {
      this.viewCarId = save.selectedCar.id;
    }
    const car = CARS.find((c) => c.id === this.viewCarId);
    this.garage.setCar(car, save.config(car.id));
    if (rerender && this.screen === 'garage') this.renderGarage();
  }

  confirmPurchase() {
    const p = this.pending;
    if (!p) return;
    if (p.type === 'car') {
      if (!save.buyCar(p.car)) { this.toast('Pas assez de pièces', true); return; }
      save.selectCar(p.car.id);
      this.toast(`${p.car.name} achetée !`);
    } else {
      if (!save.buy(p.key, p.price)) { this.toast('Pas assez de pièces', true); return; }
      const cfg = save.config(this.viewCarId);
      cfg[p.slot] = p.id;
      save.setConfig(this.viewCarId, cfg);
      this.toast(`${p.label} débloqué !`);
    }
    this.audio.init();
    this.audio.coin();
    this.pending = null;
    this.hideBuyBar();
    this.updateCoins(true);
    this.renderGarage();
  }

  // ------------------------------------------------------------- course
  startRace(stage) {
    this.audio.init();
    this.revertPreview(false);
    $('loading').classList.remove('hidden');
    $('loading-text').textContent = `${stage.country || ''} ${stage.name} — préparation de la spéciale…`;
    if (this.race) { this.race.dispose(); this.race = null; }
    // Laisse le temps à l'écran de chargement de s'afficher.
    setTimeout(() => {
      try {
        const car = save.selectedCar;
        const race = new Race(this, { stage, car, cfg: save.config(car.id) });
        race.load();
        this.race = race;
        this.mode = 'race';
        this.paused = false;
        for (const s of ['menu', 'stages', 'garage']) $(`screen-${s}`).classList.add('hidden');
        $('topbar').classList.add('hidden');
        $('hud').classList.remove('hidden');
        $('touch').classList.toggle('hidden', !this.isTouch);
        this.clock.getDelta();
      } catch (err) {
        console.error(err);
        this.toast('Erreur au chargement de la spéciale', true);
        this.exitRace('stages');
      }
      $('loading').classList.add('hidden');
    }, 40);
  }

  pauseRace() {
    if (!this.race || this.paused) return;
    this.paused = true;
    this.audio.setEngineActive(false);
    this.codriver.stop();
    $('screen-pause').classList.remove('hidden');
  }

  resumeRace() {
    this.paused = false;
    this.audio.setEngineActive(true);
    $('screen-pause').classList.add('hidden');
    this.clock.getDelta();
  }

  exitRace(to) {
    this.race?.dispose();
    this.race = null;
    this.mode = 'garage';
    this.paused = false;
    $('hud').classList.add('hidden');
    this.showScreen(to);
  }

  raceFinished(r) {
    if (!this.race) return;
    const st = r.stage;
    const rewards = [['Arrivée', st.reward]];
    if (r.medal) {
      const had = save.data.medals[r.key];
      const better = had == null || MEDAL_RANK[had] > MEDAL_RANK[r.medal.id];
      rewards.push([`Médaille ${r.medal.name} ${r.medal.icon}`, better ? r.medal.bonus : Math.round(r.medal.bonus / 3)]);
      if (better) save.data.medals[r.key] = r.medal.id;
    }
    if (r.isBest && r.prevBest != null) rewards.push(['Nouveau record', 100]);
    if (!r.resets && !r.hits) rewards.push(['Spéciale propre', 50]);
    if (st.daily && !save.data.daily[r.key]) { rewards.push(['Défi du jour', 500]); save.data.daily[r.key] = true; }
    const total = rewards.reduce((a, [, v]) => a + v, 0);
    if (r.isBest) {
      save.data.best[r.key] = r.time;
      save.data.splits[r.key] = r.splits;
      if (r.ghost) save.setGhost(r.key, r.ghost);
    }
    if (!r.cheated) save.data.finished[r.key] = true;
    save.addCoins(total);

    $('res-stage').textContent = `${st.country || ''} ${st.name} · ${save.selectedCar.name}`;
    $('res-medal').textContent = r.medal ? r.medal.icon : '🏁';
    $('res-time').textContent = formatTime(r.time);
    let sub = r.penalty ? `dont ${r.penalty / 1000} s de pénalités · ` : '';
    if (r.cheated) sub += '<span class="bad">Mode debug : chrono non enregistré</span>';
    else if (r.prevBest == null) sub += 'Premier temps enregistré';
    else if (r.isBest) sub += `<span class="good">Nouveau record ! ${formatDelta(r.time - r.prevBest)}</span>`;
    else sub += `<span class="bad">Record : ${formatTime(r.prevBest)} (${formatDelta(r.time - r.prevBest)})</span>`;
    $('res-sub').innerHTML = sub;
    $('res-targets').innerHTML = r.medalTimes.map((m) => `<span class="${r.time <= m.time ? 'got' : ''}">${m.icon} ${formatTime(m.time).slice(0, -2)}</span>`).join('');
    $('res-rewards').innerHTML = rewards.map(([k, v], i) => `<div class="r" style="animation-delay:${0.15 + i * 0.18}s"><span>${k}</span><span>+${v} 🪙</span></div>`).join('')
      + `<div class="r total" style="animation-delay:${0.15 + rewards.length * 0.18}s"><span>Total</span><span>+${total} 🪙</span></div>`;
    $('screen-results').classList.remove('hidden');
    this.account.afterRace(r);
    this.audio.coin();
    this.updateCoins(true);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    new App();
  } catch (e) {
    console.error(e);
    document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;inset:0;display:grid;place-items:center;color:#fff;font:600 16px system-ui;text-align:center;padding:20px">Impossible de démarrer le jeu (WebGL requis).<br><small>${e.message}</small></div>`);
  }
});
