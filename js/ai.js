// Pilote automatique simple : sert pour la démo du menu et pour les tests.
import { SURFACES } from './data.js';
import { clamp, wrapAngle } from './util.js';
import { SAMPLE } from './trackgen.js';

export class AIDriver {
  constructor(track, phys, skill = 0.92) {
    this.track = track;
    this.phys = phys;
    this.skill = skill;
  }

  input() {
    const t = this.track, p = this.phys;
    const speed = p.speed;
    const s = Math.max(p.hint, 0) * SAMPLE;
    const look = 5 + speed * 0.5;
    const tp = t.pointAt(s + look);
    const want = Math.atan2(tp.y - p.y, tp.x - p.x);
    const beta = Math.atan2(p.vy, Math.max(Math.abs(p.vx), 2));
    // Poursuite pure sur la direction réelle du déplacement + contre-braquage.
    const err = wrapAngle(want - (p.heading + beta));
    const kappa = (2 * Math.sin(err)) / look;
    const rDes = kappa * speed;
    const delta = Math.atan(kappa * p.L) + beta * 0.9 + 0.12 * (rDes - p.r);
    const limit = p.car.steer / (1 + speed / 22);
    const steer = clamp(delta / limit, -1, 1);

    // Vitesse cible : la plus contraignante des courbures à venir.
    const mu = SURFACES[t.surface].mu * p.car.grip * this.skill * 0.85;
    const dec = 7 * mu;
    const horizon = (speed * speed) / (2 * dec) + 25;
    let vt = p.car.top;
    const i0 = Math.max(p.hint, 0);
    const i1 = Math.min(t.n - 1, i0 + Math.ceil(horizon / SAMPLE));
    for (let i = i0; i <= i1; i++) {
      const k = Math.abs(t.k[i]);
      if (k < 1e-4) continue;
      const vmax = Math.sqrt((mu * 9.81) / k);
      const dist = (i - i0) * SAMPLE;
      vt = Math.min(vt, Math.sqrt(vmax * vmax + 2 * dec * Math.max(dist - 6, 0)));
    }
    // Corrige l'écart latéral avant qu'il ne devienne une sortie de route.
    const q = t.nearest(p.x, p.y, p.hint);
    const off = Math.abs(q.d) > t.halfW * 0.7;
    if (off) vt = Math.min(vt, Math.max(speed - 2, 8));
    return {
      steer,
      throttle: clamp((vt - speed) / 3, 0, 1),
      brake: speed > vt + 1.5 ? clamp((speed - vt) / 4, 0.3, 1) : 0,
      handbrake: false,
    };
  }
}
