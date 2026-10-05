// Tests sans navigateur : génération des spéciales et physique.
// Lancer avec : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Track } from '../js/trackgen.js';
import { CarPhysics } from '../js/physics.js';
import { AIDriver } from '../js/ai.js';
import { STAGES, CARS, PARTS, COLORS, defaultConfig } from '../js/data.js';

test('chaque spéciale est générée de façon déterministe et à la bonne longueur', () => {
  for (const st of STAGES) {
    const a = new Track(st), b = new Track(st);
    assert.equal(a.n, b.n, st.id);
    assert.equal(a.px[a.n - 1], b.px[b.n - 1], st.id);
    assert.ok(a.length > st.length * 0.85, `${st.id} trop courte : ${a.length}`);
    assert.ok(a.notes.length > 5, `${st.id} sans notes de copilote`);
    assert.ok(a.refTime > 30000, st.id);
  }
});

test('le tracé ne se recoupe pas', () => {
  for (const st of STAGES) {
    const t = new Track(st);
    for (let i = 0; i < t.n; i += 3) {
      for (let j = i + 60; j < t.n; j += 3) {
        const d = Math.hypot(t.px[i] - t.px[j], t.py[i] - t.py[j]);
        assert.ok(d > t.halfW * 2 + 4, `${st.id} : recoupement entre ${i * 2} m et ${j * 2} m`);
      }
    }
  }
});

test('le pilote automatique termine chaque spéciale avec chaque voiture', () => {
  for (const st of STAGES) {
    const t = new Track(st);
    for (const car of CARS) {
      const p = new CarPhysics(car, defaultConfig(car));
      const s0 = t.pointAt(t.start);
      p.reset(s0.x, s0.y, s0.a, s0.h);
      const ai = new AIDriver(t, p);
      let time = 0, done = false;
      while (time < 300 && !done) {
        p.step(1 / 120, ai.input(), t);
        p.events.length = 0;
        time += 1 / 120;
        const q = t.nearest(p.x, p.y, p.hint);
        assert.ok(Math.abs(q.d) < 30, `${st.id}/${car.id} sorti de la route à ${q.s.toFixed(0)} m`);
        done = q.s >= t.finish;
      }
      assert.ok(done, `${st.id}/${car.id} n'a pas fini`);
      // L'IA (prudente) doit rester dans une fourchette raisonnable du temps de référence.
      assert.ok(time * 1000 < t.refTime * 1.5, `${st.id}/${car.id} trop lent`);
    }
  }
});

test('les défauts de chaque voiture pointent vers des pièces existantes', () => {
  for (const car of CARS) {
    const cfg = defaultConfig(car);
    for (const [slot, id] of Object.entries(cfg)) {
      if (['number', 'gears', 'susp', 'bias'].includes(slot)) continue;
      if (['paint', 'livery2', 'rimColor'].includes(slot)) assert.ok(COLORS.some((c) => c.id === id), `${car.id}.${slot}=${id}`);
      else assert.ok(PARTS[slot].some((p) => p.id === id), `${car.id}.${slot}=${id}`);
    }
  }
});
