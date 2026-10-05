// Physique arcade d'une voiture de rallye (modèle "bicyclette" à deux essieux).
// Repère local : x vers l'avant, y vers la gauche. Monde 2D : (x, y), altitude à part.
import { SURFACES } from './data.js';
import { clamp, lerp, damp } from './util.js';
import { setupEffects, damageEffects, tyreGrip, wetFactor } from './gameplay.js';

const G = 9.81;

// Multiplicateurs réglables à chaud depuis le panneau de debug.
export const TUNING = { grip: 1, power: 1, steer: 1, handbrake: 1, inertia: 1 };
export const TUNING_DEFAULTS = { ...TUNING };
const DRIVE_SPLIT = { FWD: [1, 0], RWD: [0, 1], AWD: [0.42, 0.58] };
const HEIGHT_MODS = {
  low: { grip: 1.04, tarmac: 1.04, offroad: 1.25 },
  stock: { grip: 1, tarmac: 1, offroad: 1 },
  raised: { grip: 0.99, tarmac: 0.96, offroad: 0.65 },
};

// Courbe de pneu simplifiée (Pacejka) : pic vers 9-15° puis légère chute.
const tire = (alpha, B) => Math.sin(1.3 * Math.atan(B * alpha));

export class CarPhysics {
  // opts : { tyre, damage, assists: { abs, tc, esp }, surface } (tous facultatifs).
  constructor(car, cfg = {}, opts = {}) {
    this.car = car;
    this.tyre = opts.tyre || null;
    this.damage = opts.damage || null; // objet partagé, modifié par la course lors des chocs
    this.assists = opts.assists || {};
    this.setup = setupEffects(cfg, opts.surface);
    this.top = car.top * this.setup.topMult;
    const d = car.dims;
    this.m = car.mass;
    const front = car.shape === 'wedge' ? 0.56 : car.drive === 'FWD' ? 0.42 : car.shape === 'coupe' ? 0.58 : 0.48;
    this.a = d.wheelbase * front; // CdG → essieu avant
    this.b = d.wheelbase - this.a; // CdG → essieu arrière
    this.L = d.wheelbase;
    this.cgh = 0.5;
    this.I = (this.m * (d.L * d.L + d.W * d.W)) / 12 * 0.95; // un peu vif : c'est un jeu d'arcade
    this.power = car.power * 1000;
    this.cd = this.power / this.top ** 3;
    this.split = DRIVE_SPLIT[car.drive];
    this.hmod = HEIGHT_MODS[cfg.height] || HEIGHT_MODS.stock;
    this.offroadPenalty = (car.offroad ?? 1) * this.hmod.offroad;
    this.gearTops = [0.28, 0.43, 0.58, 0.72, 0.86, 1.0].map((k) => k * this.top);
    this.reset(0, 0, 0, 0);
  }

  reset(x, y, heading, alt) {
    this.x = x; this.y = y; this.heading = heading;
    this.vx = 0; this.vy = 0; this.r = 0;
    this.alt = alt; this.vAlt = 0; this.prevGround = alt;
    this.airborne = false; this.airTime = 0;
    this.steer = 0; this.ax = 0; this.ay = 0; this.axF = 0; this.ayF = 0;
    this.gear = 1; this.rpm = 900; this.reverse = false;
    this.rotF = 0; this.rotR = 0;
    this.slide = 0; this.spin = 0; this.lock = 0;
    this.absActive = false; this.tcActive = false; this.espActive = false;
    this.surface = 'gravel'; this.offroad = false;
    this.events = [];
    this.hint = -1;
  }

  get speed() { return Math.hypot(this.vx, this.vy); }
  get worldVel() {
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    return [this.vx * c - this.vy * s, this.vx * s + this.vy * c];
  }
  setWorldVel(wx, wy) {
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    this.vx = wx * c + wy * s;
    this.vy = -wx * s + wy * c;
  }

  step(dt, input, track) {
    const { m, a, b } = this;
    const car = this.car;
    const speed = this.speed;
    const vx = this.vx, vy = this.vy, r = this.r;
    const dmg = damageEffects(this.damage || {});

    // --- Direction : limitée avec la vitesse, sauf en contre-braquage.
    let limit = (car.steer * TUNING.steer * dmg.steerMult) / (1 + speed / 22);
    if (input.steer * vy > 0 && speed > 5) {
      const beta = Math.abs(Math.atan2(vy, Math.abs(vx)));
      limit = Math.max(limit, Math.min(car.steer, beta * 0.95 + 0.06));
    }
    // Direction faussée : la voiture tire d'un côté.
    const target = clamp(input.steer, -1, 1) * limit + dmg.pull * clamp(speed / 15, 0, 1);
    this.steer += clamp(target - this.steer, -4.5 * dt, 4.5 * dt);

    // --- Surface sous la voiture.
    const q = track.query(this.x, this.y, this.hint);
    this.hint = q.idx;
    this.surface = q.surface;
    this.offroad = q.offroad;
    const roadKey = q.roadSurface || track.surface; // neige ou verglas par plaques sur l'asphalte
    const roadSurf = SURFACES[roadKey];
    let mu = roadSurf.mu, roll = roadSurf.roll, B = roadSurf.B;
    if (roadKey === 'tarmac') mu *= this.hmod.tarmac;
    if (q.offroad) {
      const off = SURFACES[track.offroadSurface];
      const p = clamp(this.offroadPenalty * q.offroadBlend, 0, 1.2);
      mu = lerp(mu, off.mu, Math.min(p, 1));
      roll = lerp(roll, off.roll, p);
      B = off.B;
    }
    const wet = track.wetness || 0;
    let tyreK = lerp(tyreGrip(this.tyre, roadKey, false), tyreGrip(this.tyre, roadKey, true), wet);
    if (q.offroad) tyreK = lerp(tyreK, tyreGrip(this.tyre, track.offroadSurface, false), Math.min(q.offroadBlend, 1));
    mu *= wetFactor(q.offroad ? track.offroadSurface : roadKey, wet);
    mu *= car.grip * this.hmod.grip * TUNING.grip * tyreK * this.setup.gripMult * dmg.gripMult;

    // --- Vertical : suit le sol, décolle si le sol tombe plus vite que la gravité.
    const ground = q.height;
    const groundVel = (ground - this.prevGround) / dt;
    if (this.airborne) {
      this.airTime += dt;
      this.vAlt -= G * dt;
      this.alt += this.vAlt * dt;
      if (this.alt <= ground) {
        this.events.push({ type: 'land', air: this.airTime, impact: Math.max(0, groundVel - this.vAlt) });
        this.alt = ground;
        this.vAlt = clamp(groundVel, -30, 6);
        this.airborne = false;
      }
    } else {
      // Le sol tombe plus vite que la gravité : la voiture s'en détache.
      const vBall = this.vAlt - G * dt;
      if (groundVel >= vBall || speed < 8) {
        this.alt = ground;
        this.vAlt = clamp(groundVel, -30, 6);
      } else {
        this.vAlt = vBall;
        this.alt = Math.max(this.alt + vBall * dt, ground);
        if (this.alt - ground > 0.08) { this.airborne = true; this.airTime = 0; }
      }
    }
    this.prevGround = ground;

    // --- Moteur / freins (marche arrière en restant sur le frein à l'arrêt).
    let throttle = clamp(input.throttle, 0, 1);
    let brake = clamp(input.brake, 0, 1);
    const hb = input.handbrake ? 1 : 0;
    if (brake > 0.1 && throttle < 0.1 && vx < 0.8) this.reverse = true;
    if (throttle > 0.1) this.reverse = false;
    let drive = 0;
    if (this.reverse) {
      drive = vx > -9 ? -brake * m * 4 : 0;
      brake = 0;
    } else {
      if (throttle > 0.1 && vx < -0.5) { brake = throttle; throttle = 0; }
      const fm = this.setup.forceMult;
      drive = throttle * Math.min(m * G * 1.3 * fm, (this.power * TUNING.power * dmg.powerMult * fm) / Math.max(Math.abs(vx), 6));
    }

    let FxF = 0, FxR = 0, FyF = 0, FyR = 0;
    if (!this.airborne) {
      const L = this.L;
      let Wf = m * G * (b / L) - (m * this.axF * this.cgh) / L;
      Wf = clamp(Wf, 0.22 * m * G, 0.78 * m * G);
      const Wr = m * G - Wf;
      const FmaxF = mu * Wf, FmaxR = mu * Wr;

      const dir = vx >= 0 ? 1 : -1;
      // ABS : le freinage reste sous la limite de blocage, la voiture garde sa direction.
      this.absActive = !!this.assists.abs && brake > 0.8 && Math.abs(vx) > 3;
      if (this.absActive) brake = 0.8;
      const brakeF = brake * mu * m * G * 0.95;
      const stopK = clamp(Math.abs(vx) / 0.6, 0, 1);
      const fb = this.setup.frontBrake;
      let driveF = drive * this.split[0], driveR = drive * this.split[1];
      // Antipatinage : coupe la puissance avant que les roues ne patinent.
      this.tcActive = false;
      if (this.assists.tc && !this.reverse) {
        if (Math.abs(driveF) > FmaxF * 0.92) { driveF = Math.sign(driveF) * FmaxF * 0.92; this.tcActive = true; }
        if (Math.abs(driveR) > FmaxR * 0.85) { driveR = Math.sign(driveR) * FmaxR * 0.85; this.tcActive = true; }
      }
      const wantF = driveF - dir * brakeF * fb * stopK;
      const wantR = driveR - dir * (brakeF * (1 - fb) + hb * FmaxR * 0.9) * stopK;
      FxF = clamp(wantF, -FmaxF, FmaxF);
      FxR = clamp(wantR, -FmaxR, FmaxR);
      this.spin = Math.max(Math.abs(wantF) - FmaxF, Math.abs(wantR) - FmaxR, 0) / (m * G * 0.3);
      this.lock = ((brake > 0.6 && !this.absActive) || hb) && Math.abs(vx) > 3 ? 1 : 0;

      // Cercle de friction : l'effort longitudinal réduit l'adhérence latérale.
      const latF = FmaxF * Math.sqrt(1 - 0.45 * (FxF / FmaxF) ** 2);
      const kR = car.drive === 'RWD' ? 0.45 : 0.4;
      const latR = FmaxR * Math.sqrt(1 - kR * (FxR / FmaxR) ** 2) * (hb ? clamp(0.35 / TUNING.handbrake, 0.05, 1) : 1.06);

      const vxa = Math.max(Math.abs(vx), 4);
      const alphaF = Math.atan2(vy + r * a, vxa) - this.steer * dir;
      const alphaR = Math.atan2(vy - r * b, vxa);
      const lowK = clamp(speed / 4, 0, 1);
      FyF = -latF * tire(alphaF, B) * lowK;
      FyR = -latR * tire(alphaR, B) * lowK;
      this.slide = clamp((Math.abs(alphaR) - 0.07) * 3, 0, 1) * clamp(speed / 8, 0, 1);
    } else {
      this.slide = 0; this.spin = 0; this.lock = 0;
    }

    const cs = Math.cos(this.steer), sn = Math.sin(this.steer);
    let Fx = FxF * cs - FyF * sn + FxR;
    let Fy = FxF * sn + FyF * cs + FyR;
    const torque = a * (FyF * cs + FxF * sn) - b * FyR;

    // Résistances : aéro, roulement, pente.
    Fx -= this.cd * vx * speed;
    Fy -= this.cd * vy * speed * 2;
    if (!this.airborne) {
      Fx -= roll * m * G * (vx / (Math.abs(vx) + 0.5));
      const c = Math.cos(this.heading), s = Math.sin(this.heading);
      const hF = track.heightAt(this.x + c, this.y + s, this.hint);
      const hB = track.heightAt(this.x - c, this.y - s, this.hint);
      const hL = track.heightAt(this.x - s, this.y + c, this.hint);
      const hR = track.heightAt(this.x + s, this.y - c, this.hint);
      Fx -= m * G * clamp((hF - hB) / 2, -0.6, 0.6);
      Fy -= m * G * clamp((hL - hR) / 2, -0.6, 0.6);
    }

    this.ax = Fx / m;
    this.ay = Fy / m;
    this.axF = damp(this.axF, this.ax, 8, dt);
    this.ayF = damp(this.ayF, this.ay, 8, dt);

    let nvx = vx + (this.ax + r * vy) * dt;
    let nvy = vy + (this.ay - r * vx) * dt;
    let nr = r + (torque / (this.I * TUNING.inertia)) * dt;

    if (this.airborne) {
      nr *= 1 - 0.8 * dt;
    } else {
      // À basse vitesse : rotation cinématique, pas de glisse parasite.
      const lowK = clamp(speed / 5, 0, 1);
      const kin = (nvx * Math.tan(this.steer)) / this.L;
      nr = lerp(kin, nr, lowK);
      nvy *= 1 - (1 - lowK) * Math.min(1, 10 * dt);
      if (speed < 0.3 && throttle < 0.05 && !this.reverse) { nvx *= 0.9; }
      // Contrôle de stabilité : ramène la rotation vers la trajectoire voulue en cas de forte glisse.
      this.espActive = false;
      if (this.assists.esp && speed > 8 && !input.handbrake) {
        const beta = Math.atan2(nvy, Math.abs(nvx));
        if (Math.abs(beta) > 0.16) {
          nr = lerp(nr, kin, Math.min(1, 2.5 * dt));
          this.espActive = true;
        }
      }
    }
    this.vx = nvx; this.vy = nvy; this.r = nr;

    this.heading += this.r * dt;
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    this.x += (this.vx * c - this.vy * s) * dt;
    this.y += (this.vx * s + this.vy * c) * dt;

    // Rotation visuelle des roues.
    const wr = car.dims.wheelR;
    const spinBoost = this.spin > 0 ? 1 + Math.min(this.spin, 2) : 1;
    this.rotF += (this.vx / wr) * dt * (this.split[0] > 0 ? spinBoost : 1);
    if (!hb) this.rotR += (this.vx / wr) * dt * (this.split[1] > 0 ? spinBoost : 1);

    this.updateGearbox(dt, throttle);
  }

  updateGearbox(dt, throttle) {
    const v = Math.abs(this.vx);
    if (this.reverse && this.vx < -0.3) {
      this.gear = -1;
    } else {
      if (this.gear < 1) this.gear = 1;
      const top = this.gearTops[this.gear - 1];
      if (v > top * 0.97 && this.gear < 6) { this.gear++; this.events.push({ type: 'shift', up: true, throttle }); }
      else if (this.gear > 1 && v < this.gearTops[this.gear - 2] * 0.72) { this.gear--; this.events.push({ type: 'shift', up: false }); }
    }
    const g = Math.max(this.gear, 1);
    const lo = g === 1 ? 0 : this.gearTops[g - 2] * 0.6;
    let ratio = clamp((v - lo) / (this.gearTops[g - 1] - lo), 0, 1);
    let target = 1100 + ratio * 6600;
    if (this.airborne || this.spin > 0.05) target = Math.max(target, 2500 + throttle * 5200);
    if (v < 1) target = 900 + throttle * 3500;
    this.rpm = damp(this.rpm, Math.min(target, 7900), 14, dt);
  }

  // Collision contre un obstacle : n = normale (monde) vers l'extérieur de l'obstacle.
  collide(nx, ny, depth, restitution = 0.25) {
    this.x += nx * depth;
    this.y += ny * depth;
    const [wx, wy] = this.worldVel;
    const vn = wx * nx + wy * ny;
    if (vn >= 0) return 0;
    let rx = wx - (1 + restitution) * vn * nx;
    let ry = wy - (1 + restitution) * vn * ny;
    rx *= 0.85; ry *= 0.85;
    this.setWorldVel(rx, ry);
    this.r *= 0.6;
    return -vn;
  }
}
