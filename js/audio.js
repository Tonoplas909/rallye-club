// Sons synthétisés avec WebAudio (aucun fichier audio nécessaire).
export class AudioFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.engineOn = false;
  }

  // Doit être appelé suite à un geste de l'utilisateur.
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.55 : 0;
    this.master.connect(ctx.destination);

    // Moteur : fondamentale + sous-harmonique + harmonique aiguë, saturées puis filtrées.
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 900;
    this.engFilter.Q.value = 3;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; curve[i] = Math.tanh(x * 2.5); }
    shaper.curve = curve;
    this.osc1 = ctx.createOscillator(); this.osc1.type = 'sawtooth';
    this.osc2 = ctx.createOscillator(); this.osc2.type = 'square';
    this.osc3 = ctx.createOscillator(); this.osc3.type = 'sawtooth';
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    this.g3 = ctx.createGain(); this.g3.gain.value = 0;
    this.osc1.connect(shaper); this.osc2.connect(g2); g2.connect(shaper); this.osc3.connect(this.g3); this.g3.connect(shaper);
    shaper.connect(this.engFilter);
    this.engFilter.connect(this.engGain);
    this.engGain.connect(this.master);
    this.osc1.start(); this.osc2.start(); this.osc3.start();
    // Sifflement du turbo.
    this.turbo = ctx.createOscillator(); this.turbo.type = 'sine';
    this.turboGain = ctx.createGain(); this.turboGain.gain.value = 0;
    this.turbo.connect(this.turboGain); this.turboGain.connect(this.master);
    this.turbo.start();
    this.boost = 0;
    this.profile = { cyl: 4, turbo: false };

    // Bruit (gravier, vent).
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const mkNoise = (type, freq, q) => {
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start();
      return { f, g };
    };
    this.gravel = mkNoise('bandpass', 1800, 0.7);
    this.wind = mkNoise('lowpass', 500, 0.5);
    this.hiss = mkNoise('highpass', 3500, 0.5); // pneus sur route mouillée
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05);
  }

  setEngineActive(on) {
    this.engineOn = on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (!on) {
      for (const g of [this.engGain.gain, this.gravel.g.gain, this.wind.g.gain, this.hiss.g.gain, this.turboGain.gain]) g.setTargetAtTime(0, t, 0.1);
    }
  }

  // Caractère du moteur selon la voiture (nombre de cylindres, turbo).
  setCar(car) {
    const turbo = ['mistral', 'vortex', 'lionne', 'toundra', 'kodiak', 'fennec'].includes(car.id);
    const cyl = { toundra: 6, kodiak: 6, corsaire: 4, berlinette: 4 }[car.id] || (car.id === 'vortex' || car.id === 'lionne' ? 5 : 4);
    this.profile = { cyl, turbo };
  }

  update({ rpm, throttle, speed, slide, loose, airborne, wet = 0 }) {
    if (!this.ctx || !this.engineOn) return;
    if (![rpm, throttle, speed, slide, loose].every(Number.isFinite)) return;
    const t = this.ctx.currentTime;
    const { cyl, turbo } = this.profile;
    // Fréquence d'allumage : tr/min / 60 × cylindres / 2.
    const f = Math.max(20, (rpm / 60) * (cyl / 2));
    this.osc1.frequency.setTargetAtTime(f, t, 0.03);
    this.osc2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    this.osc3.frequency.setTargetAtTime(f * 2.01, t, 0.03);
    this.g3.gain.setTargetAtTime(Math.max(0, (rpm - 3500) / 4400) * 0.35, t, 0.05);
    this.engFilter.frequency.setTargetAtTime(500 + throttle * 1800 + rpm * 0.15, t, 0.05);
    // Rupteur : la voiture "bégaie" en haut du compte-tours.
    const limiter = rpm > 7650 && throttle > 0.5 ? (Math.sin(t * 160) > 0 ? 0.4 : 1) : 1;
    this.engGain.gain.setTargetAtTime((0.13 + throttle * 0.13) * limiter * (this.shiftDip > t ? 0.35 : 1), t, 0.02);
    // Turbo : monte en pression à l'accélération, souffle quand on lâche.
    if (turbo) {
      const target = throttle > 0.5 && rpm > 3000 ? Math.min(1, (rpm - 3000) / 3500) : 0;
      const prev = this.boost;
      this.boost += (target - this.boost) * (target > this.boost ? 0.04 : 0.25);
      this.turbo.frequency.setTargetAtTime(2200 + this.boost * 2600, t, 0.05);
      this.turboGain.gain.setTargetAtTime(this.boost * 0.018, t, 0.05);
      if (prev > 0.6 && throttle < 0.2 && !this.blowCooldown) { this.blowOff(); this.blowCooldown = true; }
      if (throttle > 0.5) this.blowCooldown = false;
    }
    const roll = airborne ? 0 : Math.min(speed / 30, 1);
    this.gravel.g.gain.setTargetAtTime((roll * 0.08 + slide * 0.22) * loose * (1 - wet * 0.5), t, 0.08);
    this.gravel.f.frequency.setTargetAtTime(900 + speed * 25, t, 0.1);
    this.wind.g.gain.setTargetAtTime(Math.min(speed / 55, 1) * 0.12, t, 0.1);
    this.hiss.g.gain.setTargetAtTime(roll * wet * 0.1, t, 0.1);
  }

  // Petite coupure d'allumage au passage de rapport.
  shift() { if (this.ctx) this.shiftDip = this.ctx.currentTime + 0.07; }

  blowOff() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(900, t + 0.35); f.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random()); src.stop(t + 0.4);
  }

  beep(freq = 660, dur = 0.18, vol = 0.3) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  burst(vol = 0.5, freq = 300, dur = 0.25) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  thump(k) { this.burst(Math.min(0.9, 0.25 + k * 0.4), 220, 0.3); }
  pop() { this.burst(0.5, 1400, 0.09); }
  crash(k) { this.burst(Math.min(1, 0.3 + k * 0.05), 700, 0.35); }

  coin() {
    this.beep(988, 0.08, 0.18);
    setTimeout(() => this.beep(1319, 0.2, 0.18), 80);
  }
}

// Copilote : annonces vocales en français si le navigateur le permet.
export class CoDriver {
  constructor() {
    this.enabled = true;
    this.voice = null;
    if ('speechSynthesis' in window) {
      const pick = () => {
        const voices = speechSynthesis.getVoices();
        this.voice = voices.find((v) => v.lang?.startsWith('fr')) || null;
      };
      pick();
      speechSynthesis.addEventListener?.('voiceschanged', pick);
    }
  }

  say(text) {
    if (!this.enabled || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    if (this.voice) u.voice = this.voice;
    u.rate = 1.35;
    u.pitch = 0.9;
    u.volume = 0.9;
    speechSynthesis.speak(u);
  }

  stop() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }
}
