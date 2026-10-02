// Sauvegarde de la progression dans le navigateur (localStorage).
import { CARS, COLORS, PARTS, START_COINS, defaultConfig } from './data.js';

const KEY = 'rallye-club-save-v1';
const GHOST_KEY = 'rallye-club-ghost-';

function freshSave() {
  const owned = {};
  for (const c of COLORS) if (c.price === 0) owned[`color:${c.id}`] = true;
  for (const [slot, list] of Object.entries(PARTS)) {
    for (const p of list) if (p.price === 0) owned[`${slot}:${p.id}`] = true;
  }
  const first = CARS[0];
  return {
    coins: START_COINS,
    cars: [first.id],
    selectedCar: first.id,
    owned,
    configs: {},
    best: {},
    splits: {},
    medals: {},
    finished: {},
    daily: {},
    settings: { sound: true, voice: true, quality: 'high', camera: 0 },
  };
}

class Save {
  constructor() {
    this.data = freshSave();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const loaded = JSON.parse(raw);
        const base = freshSave();
        this.data = { ...base, ...loaded, settings: { ...base.settings, ...(loaded.settings || {}) }, owned: { ...base.owned, ...(loaded.owned || {}) } };
      }
    } catch (e) {
      console.warn('Sauvegarde illisible, nouvelle partie.', e);
    }
  }

  persist() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* stockage indisponible */ }
  }

  reset() {
    this.data = freshSave();
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(GHOST_KEY)) localStorage.removeItem(k);
      }
    } catch (e) { /* ignore */ }
    this.persist();
  }

  get coins() { return this.data.coins; }
  addCoins(n) { this.data.coins += n; this.persist(); }
  spend(n) {
    if (this.data.coins < n) return false;
    this.data.coins -= n;
    this.persist();
    return true;
  }

  ownsCar(id) { return this.data.cars.includes(id); }
  buyCar(car) {
    if (this.ownsCar(car.id) || !this.spend(car.price)) return false;
    this.data.cars.push(car.id);
    this.persist();
    return true;
  }
  get selectedCar() { return CARS.find((c) => c.id === this.data.selectedCar) || CARS[0]; }
  selectCar(id) { if (this.ownsCar(id)) { this.data.selectedCar = id; this.persist(); } }

  config(carId) {
    const car = CARS.find((c) => c.id === carId);
    return { ...defaultConfig(car), ...(this.data.configs[carId] || {}) };
  }
  setConfig(carId, cfg) { this.data.configs[carId] = { ...cfg }; this.persist(); }

  // Les pièces "par défaut" d'une voiture sont offertes avec elle.
  owns(key, carId) {
    if (this.data.owned[key]) return true;
    if (carId) {
      const car = CARS.find((c) => c.id === carId);
      const [slot, id] = key.split(':');
      if (car && this.ownsCar(carId) && car.defaults[slot] === id) return true;
      if (car && this.ownsCar(carId) && slot === 'color' && Object.values(car.defaults).includes(id)) return true;
    }
    return false;
  }
  buy(key, price) {
    if (this.data.owned[key] || !this.spend(price)) return false;
    this.data.owned[key] = true;
    this.persist();
    return true;
  }

  get settings() { return this.data.settings; }
  setSetting(k, v) { this.data.settings[k] = v; this.persist(); }

  ghost(stageKey) {
    try { return JSON.parse(localStorage.getItem(GHOST_KEY + stageKey)); } catch (e) { return null; }
  }
  setGhost(stageKey, ghost) {
    try { localStorage.setItem(GHOST_KEY + stageKey, JSON.stringify(ghost)); } catch (e) { /* trop gros ou indisponible */ }
  }
}

export const save = new Save();
