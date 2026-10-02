// Génération procédurale d'une spéciale (tracé, profil en long, notes du copilote)
// et requêtes géométriques utilisées par la physique. Aucun rendu ici.
import { Noise2D, mulberry32, clamp, lerp, smoothstep, wrapAngle } from './util.js';
import { SURFACES } from './data.js';

export const SAMPLE = 2; // espacement des échantillons de route (m)

const THEME_TERRAIN = {
  forest: { amp: 22, amp2: 4, mountain: 26, offroad: 'grass' },
  med: { amp: 42, amp2: 6, mountain: 40, offroad: 'grass' },
  snow: { amp: 14, amp2: 3, mountain: 18, offroad: 'snow', snowbank: true },
  desert: { amp: 10, amp2: 5, mountain: 14, offroad: 'sand', dunes: true },
  wales: { amp: 20, amp2: 5, mountain: 24, offroad: 'grass' },
  night: { amp: 46, amp2: 6, mountain: 44, offroad: 'grass' },
};

export class Track {
  constructor(opts) {
    this.opts = opts;
    this.surface = opts.surface;
    this.theme = opts.theme;
    this.terrain = THEME_TERRAIN[opts.theme];
    this.offroadSurface = this.terrain.offroad === opts.surface ? 'grass' : this.terrain.offroad;
    if (opts.theme === 'desert') this.offroadSurface = 'sand';
    this.halfW = (opts.roadWidth || (opts.surface === 'tarmac' ? 7.5 : 7)) / 2;
    this.blend = 13;
    this.noise = new Noise2D(opts.seed * 7 + 3);
    this.noise2 = new Noise2D(opts.seed * 13 + 5);
    this.build();
  }

  // ---------------------------------------------------------------- tracé
  build() {
    // Plusieurs essais si le tracé se coince : on garde le plus long.
    let path = null;
    for (let attempt = 0; attempt < 25; attempt++) {
      const p = this.generatePath(mulberry32(this.opts.seed + attempt * 7919));
      if (!path || p.pts.length > path.pts.length) path = p;
      if (p.pts.length >= this.opts.length * 0.9) break;
    }

    // Ré-échantillonnage tous les SAMPLE mètres.
    const pts = path.pts.filter((_, i) => i % SAMPLE === 0);
    const n = pts.length;
    this.n = n;
    this.px = new Float32Array(n); this.py = new Float32Array(n);
    this.tx = new Float32Array(n); this.ty = new Float32Array(n);
    this.k = new Float32Array(n); this.h = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      this.px[i] = p.x; this.py[i] = p.y;
      this.tx[i] = Math.cos(p.a); this.ty[i] = Math.sin(p.a);
      this.k[i] = p.k;
    }
    this.length = (n - 1) * SAMPLE;
    this.corners = path.corners.map((c) => ({ ...c }));

    // Grille spatiale des échantillons.
    this.cell = 30;
    this.grid = new Map();
    for (let i = 0; i < n; i++) {
      const key = this.cellKey(Math.floor(this.px[i] / this.cell), Math.floor(this.py[i] / this.cell));
      let list = this.grid.get(key);
      if (!list) this.grid.set(key, (list = []));
      list.push(i);
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      minX = Math.min(minX, this.px[i]); maxX = Math.max(maxX, this.px[i]);
      minY = Math.min(minY, this.py[i]); maxY = Math.max(maxY, this.py[i]);
    }
    this.bounds = { minX, minY, maxX, maxY };

    this.buildProfile(path);
    this.buildNotes();
    this.start = 10;
    this.finish = this.length - 45;
    this.splits = [this.finish / 3, (this.finish * 2) / 3];
    this.refTime = this.referenceTime();
  }

  cellKey(cx, cy) { return cx * 73856093 ^ cy * 19349663; }

  generatePath(rng) {
    const target = this.opts.length;
    const twist = this.opts.twist ?? 0.5;
    const hairpin = this.opts.hairpin ?? 0.05;
    const minSep = 55;
    const pts = [];
    const corners = [];
    const occ = new Map();
    const cs = 25;
    let x = 0, y = 0, a = 0;
    let goal = 0;

    const free = (cand) => {
      for (const p of cand) {
        const cx = Math.floor(p.x / cs), cy = Math.floor(p.y / cs);
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
          const list = occ.get(this.cellKey(cx + i, cy + j));
          if (!list) continue;
          for (const idx of list) {
            if (pts.length - idx < 90) continue; // les points récents sont forcément proches
            const q = pts[idx];
            const dx = q.x - p.x, dy = q.y - p.y;
            if (dx * dx + dy * dy < minSep * minSep) return false;
          }
        }
      }
      return true;
    };
    const commit = (cand) => {
      for (const p of cand) {
        const key = this.cellKey(Math.floor(p.x / cs), Math.floor(p.y / cs));
        let list = occ.get(key);
        if (!list) occ.set(key, (list = []));
        list.push(pts.length);
        pts.push(p);
      }
      const last = cand[cand.length - 1];
      x = last.x; y = last.y; a = last.a;
    };
    const straight = (len) => {
      const out = [];
      let cx = x, cy = y;
      for (let i = 0; i < len; i++) {
        cx += Math.cos(a); cy += Math.sin(a);
        out.push({ x: cx, y: cy, a, k: 0 });
      }
      return out;
    };
    const arc = (R, ang, dir) => {
      const out = [];
      const steps = Math.max(1, Math.round(R * ang));
      const da = (ang / steps) * dir;
      let cx = x, cy = y, ca = a;
      for (let i = 0; i < steps; i++) {
        // pas de longueur ~1 m le long de l'arc
        const mid = ca + da / 2;
        cx += Math.cos(mid) * (R * Math.abs(da));
        cy += Math.sin(mid) * (R * Math.abs(da));
        ca += da;
        out.push({ x: cx, y: cy, a: ca, k: dir / R });
      }
      return out;
    };

    commit([{ x: 0, y: 0, a: 0, k: 0 }]);
    commit(straight(70));

    let fails = 0;
    while (pts.length < target - 90 && fails < 60) {
      const dev = wrapAngle(a - goal);
      const back = -Math.sign(dev) || (rng() < 0.5 ? 1 : -1);
      const pBack = 0.5 + clamp(Math.abs(dev) / 2.2, 0, 0.45);
      const dir = rng() < pBack ? back : -back;
      let segs;
      const roll = rng();
      if (roll < hairpin) {
        // Épingle (parfois en lacets successifs).
        const R = 11 + rng() * 6;
        segs = [{ kind: 'arc', R, ang: Math.PI * (0.82 + rng() * 0.18), dir }];
        if (rng() < 0.6) {
          segs.push({ kind: 'straight', len: 25 + Math.floor(rng() * 30) });
          segs.push({ kind: 'arc', R: 11 + rng() * 6, ang: Math.PI * (0.82 + rng() * 0.18), dir: -dir });
        }
      } else if (roll < hairpin + 0.42 - twist * 0.22) {
        segs = [{ kind: 'straight', len: Math.floor(lerp(40, 170, rng() * (1 - twist * 0.6))) }];
      } else {
        const R = lerp(22, 170, Math.pow(rng(), 1 + twist * 1.4));
        const ang = Math.min((lerp(25, 115, rng()) * Math.PI) / 180, 150 / R);
        segs = [{ kind: 'arc', R, ang, dir }];
        if (rng() < 0.35) segs.push({ kind: 'straight', len: 12 + Math.floor(rng() * 25) });
      }

      // Construit le candidat segment par segment depuis l'état courant.
      const save = { x, y, a };
      const cand = [];
      const cornerList = [];
      for (const sg of segs) {
        const part = sg.kind === 'arc' ? arc(sg.R, sg.ang, sg.dir) : straight(sg.len);
        if (sg.kind === 'arc') {
          cornerList.push({ s0: pts.length + cand.length, s1: pts.length + cand.length + part.length, R: sg.R, ang: sg.ang, dir: sg.dir });
        } else if (sg.len >= 60) {
          cornerList.push({ straight: true, s0: pts.length + cand.length, s1: pts.length + cand.length + part.length });
        }
        cand.push(...part);
        const last = part[part.length - 1];
        x = last.x; y = last.y; a = last.a;
      }
      x = save.x; y = save.y; a = save.a;

      if (free(cand)) {
        commit(cand);
        corners.push(...cornerList);
        fails = 0;
        if (rng() < 0.15) goal = wrapAngle(goal + (rng() - 0.5) * 1.2);
      } else {
        fails++;
        if (fails % 10 === 0) goal = wrapAngle(a + (rng() - 0.5) * 2);
      }
    }
    commit(straight(90));
    return { pts, corners: corners.filter((c) => !c.straight), straights: corners.filter((c) => c.straight) };
  }

  // ---------------------------------------------------------------- relief
  baseHeight(x, y) {
    const t = this.terrain;
    let h = this.noise.fbm(x / 280, y / 280, 4) * t.amp + this.noise2.fbm(x / 70, y / 70, 3) * t.amp2;
    if (t.dunes) {
      const r = 1 - Math.abs(this.noise2.noise(x / 55 + 3.1, y / 90 - 1.7));
      h += r * r * 7;
    }
    return h;
  }

  mountain(x, y) {
    const n = this.noise.fbm(x / 160 + 11.3, y / 160 - 7.1, 3);
    return (0.55 + n) * this.terrain.mountain;
  }

  buildProfile(path) {
    const n = this.n;
    const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) raw[i] = this.baseHeight(this.px[i], this.py[i]);
    // Lissage gaussien (σ ≈ 40 m).
    const sigma = 20, rad = 50;
    const w = [];
    for (let j = -rad; j <= rad; j++) w.push(Math.exp(-(j * j) / (2 * sigma * sigma)));
    const sm = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0, ws = 0;
      for (let j = -rad; j <= rad; j++) {
        const k = clamp(i + j, 0, n - 1);
        s += raw[k] * w[j + rad]; ws += w[j + rad];
      }
      sm[i] = s / ws;
    }
    // Pente limitée à 12 %.
    const maxD = 0.12 * SAMPLE;
    for (let i = 1; i < n; i++) sm[i] = clamp(sm[i], sm[i - 1] - maxD, sm[i - 1] + maxD);
    for (let i = n - 2; i >= 0; i--) sm[i] = clamp(sm[i], sm[i + 1] - maxD, sm[i + 1] + maxD);
    // Arrondit les cassures laissées par la limitation de pente.
    for (let pass = 0; pass < 3; pass++) {
      const src = sm.slice();
      for (let i = 0; i < n; i++) {
        let s = 0, ws = 0;
        for (let j = -6; j <= 6; j++) {
          const k = clamp(i + j, 0, n - 1);
          const wj = Math.exp(-(j * j) / 18);
          s += src[k] * wj; ws += wj;
        }
        sm[i] = s / ws;
      }
    }

    // Bosses / sauts sur les lignes droites.
    const rng = mulberry32(this.opts.seed * 31 + 17);
    this.crests = [];
    const desert = this.theme === 'desert';
    for (const st of path.straights) {
      const s0 = st.s0, s1 = st.s1;
      if (s0 < 160 || s1 > path.pts.length - 120) continue;
      if (rng() > (desert ? 0.85 : 0.55)) continue;
      const sc = (s0 + s1) / 2 + (rng() - 0.5) * (s1 - s0) * 0.3;
      const H = (desert ? 1.8 : 1.2) + rng() * 0.9;
      const sig = 7 + rng() * 3;
      this.crests.push({ s: sc, H, sig });
    }
    for (const c of this.crests) {
      for (let i = 0; i < n; i++) {
        const ds = i * SAMPLE - c.s;
        if (Math.abs(ds) < c.sig * 4) sm[i] += c.H * Math.exp(-(ds * ds) / (2 * c.sig * c.sig));
      }
    }
    this.h = sm;
  }

  // Interpolation de Hermite : pente continue → décollages propres.
  roadHeight(s) {
    const n = this.n;
    const f = clamp(s / SAMPLE, 0, n - 1.0001);
    const i = Math.floor(f), t = f - i;
    const h0 = this.h[Math.max(i - 1, 0)], h1 = this.h[i], h2 = this.h[Math.min(i + 1, n - 1)], h3 = this.h[Math.min(i + 2, n - 1)];
    const m1 = (h2 - h0) / 2, m2 = (h3 - h1) / 2;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * h1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * h2 + (t3 - t2) * m2;
  }

  // ---------------------------------------------------------------- requêtes
  nearest(x, y, hint = -1) {
    let best = -1, bestD = Infinity;
    if (hint >= 0) {
      const lo = Math.max(0, hint - 30), hi = Math.min(this.n - 1, hint + 30);
      for (let i = lo; i <= hi; i++) {
        const dx = this.px[i] - x, dy = this.py[i] - y;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = i; }
      }
      if (bestD > 900 || best === lo && lo > 0 || best === hi && hi < this.n - 1) best = -1;
    }
    if (best < 0) {
      bestD = Infinity;
      const cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell);
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
        const list = this.grid.get(this.cellKey(cx + i, cy + j));
        if (!list) continue;
        for (const idx of list) {
          const dx = this.px[idx] - x, dy = this.py[idx] - y;
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = idx; }
        }
      }
      if (best < 0) return { idx: -1, s: 0, d: Infinity, far: true };
    }
    // Projection sur les segments adjacents.
    let s = best * SAMPLE, dd = 0, bestDist = Infinity;
    for (const j of [best - 1, best]) {
      if (j < 0 || j + 1 >= this.n) continue;
      const ax = this.px[j], ay = this.py[j];
      const ex = this.px[j + 1] - ax, ey = this.py[j + 1] - ay;
      const len2 = ex * ex + ey * ey;
      const t = clamp(((x - ax) * ex + (y - ay) * ey) / len2, 0, 1);
      const qx = ax + ex * t, qy = ay + ey * t;
      const dist = Math.hypot(x - qx, y - qy);
      if (dist < bestDist) {
        bestDist = dist;
        s = (j + t) * SAMPLE;
        const len = Math.sqrt(len2);
        dd = ((x - ax) * -ey + (y - ay) * ex) / len; // > 0 à gauche
      }
    }
    if (bestDist === Infinity) {
      bestDist = Math.sqrt(bestD);
      dd = (x - this.px[best]) * -this.ty[best] + (y - this.py[best]) * this.tx[best];
    }
    return { idx: best, s, d: dd, far: false };
  }

  heightFrom(x, y, nr) {
    const ad = nr.far ? Infinity : Math.abs(nr.d);
    if (ad <= this.halfW + 0.4) return this.roadHeight(nr.s);
    let base = this.baseHeight(x, y) + this.mountain(x, y) * smoothstep(18, 55, ad);
    if (ad === Infinity) return base;
    const rh = this.roadHeight(nr.s);
    const t = smoothstep(this.halfW + 0.4, this.halfW + this.blend, ad);
    let h = lerp(rh, base, t);
    if (this.terrain.snowbank) {
      const e = ad - (this.halfW + 1.7);
      h += 1.0 * Math.exp(-(e * e) / 0.9);
    }
    return h;
  }

  heightAt(x, y, hint = -1) { return this.heightFrom(x, y, this.nearest(x, y, hint)); }

  query(x, y, hint = -1) {
    const nr = this.nearest(x, y, hint);
    const ad = nr.far ? Infinity : Math.abs(nr.d);
    const offroad = ad > this.halfW + 0.3;
    return {
      idx: nr.idx, s: nr.s, d: nr.d, far: nr.far,
      height: this.heightFrom(x, y, nr),
      offroad,
      offroadBlend: offroad ? smoothstep(this.halfW + 0.3, this.halfW + 2.5, ad) : 0,
      surface: offroad ? this.offroadSurface : this.surface,
    };
  }

  // Point et cap de la route à l'abscisse s.
  pointAt(s) {
    const f = clamp(s / SAMPLE, 0, this.n - 1.001);
    const i = Math.floor(f), t = f - i;
    const x = lerp(this.px[i], this.px[i + 1], t), y = lerp(this.py[i], this.py[i + 1], t);
    const a = Math.atan2(lerp(this.ty[i], this.ty[i + 1], t), lerp(this.tx[i], this.tx[i + 1], t));
    return { x, y, a, h: this.roadHeight(s), idx: i };
  }

  // ---------------------------------------------------------------- copilote
  buildNotes() {
    const notes = [];
    for (const c of this.corners) {
      const dirTxt = c.dir > 0 ? 'Gauche' : 'Droite';
      let grade, label;
      if (c.R < 18) { grade = 0; label = `Épingle ${c.dir > 0 ? 'gauche' : 'droite'}`; }
      else {
        grade = c.R < 30 ? 1 : c.R < 45 ? 2 : c.R < 65 ? 3 : c.R < 95 ? 4 : c.R < 140 ? 5 : 6;
        label = `${dirTxt} ${grade}`;
        if (c.ang > (110 * Math.PI) / 180) label += ' long';
      }
      if (grade === 6 && c.ang < (40 * Math.PI) / 180) continue; // trop léger pour être annoncé
      notes.push({ s: c.s0 * 1, end: c.s1, dir: c.dir, grade, label, kind: 'corner' });
    }
    for (const c of this.crests) {
      notes.push({ s: c.s - c.sig, end: c.s + c.sig, grade: -1, label: c.H > 1.7 ? 'Saut !' : 'Bosse', kind: 'crest' });
    }
    notes.sort((a, b) => a.s - b.s);
    // Enchaînements : "puis" si la note suivante arrive vite.
    for (let i = 0; i < notes.length - 1; i++) {
      if (notes[i + 1].s - notes[i].end < 25) notes[i].into = true;
    }
    this.notes = notes;
  }

  // Temps de référence : profil de vitesse limité par l'adhérence en virage.
  referenceTime() {
    const mu = SURFACES[this.surface].mu * 0.98;
    const n = this.n;
    const v = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let kmax = 0;
      for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) kmax = Math.max(kmax, Math.abs(this.k[j]));
      v[i] = kmax > 0 ? Math.min(48, Math.sqrt((mu * 9.81) / kmax)) : 48;
    }
    v[0] = 0;
    const acc = 5.5, dec = 8 * mu;
    for (let i = 1; i < n; i++) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] ** 2 + 2 * acc * SAMPLE));
    for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * dec * SAMPLE));
    let t = 0;
    const i0 = Math.floor(this.start / SAMPLE), i1 = Math.floor(this.finish / SAMPLE);
    for (let i = i0; i < i1; i++) t += SAMPLE / Math.max((v[i] + v[i + 1]) / 2, 1);
    return t * 1000;
  }
}
