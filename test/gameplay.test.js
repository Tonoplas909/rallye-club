// Pneus, réglages, dégâts et réparations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TYRES, recommendedTyre, tyreGrip, applyImpact, applyLanding, damageEffects, repair, repairCost, freshDamage, setupEffects } from '../js/gameplay.js';
import { CarPhysics } from '../js/physics.js';
import { CARS, defaultConfig } from '../js/data.js';

test('le pneu conseillé est le meilleur sur sa surface', () => {
  for (const surface of ['gravel', 'tarmac', 'snow', 'sand', 'mud']) {
    const rec = recommendedTyre(surface);
    for (const id of Object.keys(TYRES)) assert.ok(tyreGrip(rec, surface) >= tyreGrip(id, surface), `${surface} : ${id} > ${rec}`);
  }
  assert.equal(recommendedTyre('tarmac', true), 'pluie');
});

test('les chocs abîment les bons organes et la réparation consomme du temps', () => {
  const d = freshDamage();
  assert.deepEqual(applyImpact(d, 3, 'front'), []); // simple frottement
  applyImpact(d, 20, 'front');
  assert.ok(d.engine > 0 && d.steering > 0 && d.suspension === 0);
  applyLanding(d, 12);
  assert.ok(d.suspension > 0);
  const cost = repairCost('engine', d.engine);
  const used = repair(d, 'engine', 30);
  assert.equal(used, cost);
  assert.equal(d.engine, 0);
  // Pas assez de temps : réparation partielle.
  d.suspension = 1;
  assert.equal(repair(d, 'suspension', 5), 5);
  assert.ok(d.suspension > 0.7 && d.suspension < 0.8);
});

test('moteur abîmé = moins de puissance, réglages cohérents', () => {
  assert.ok(damageEffects({ engine: 1 }).powerMult < 0.7);
  assert.ok(setupEffects({ gears: 1 }).topMult > 1 && setupEffects({ gears: -1 }).forceMult > 1);
  const flat = { surface: 'tarmac', offroadSurface: 'grass', query: () => ({ idx: 0, height: 0, offroad: false, offroadBlend: 0, surface: 'tarmac' }), heightAt: () => 0 };
  const car = CARS[0];
  const speedAfter = (opts) => {
    const p = new CarPhysics(car, defaultConfig(car), opts); p.reset(0, 0, 0, 0);
    for (let i = 0; i < 120 * 6; i++) p.step(1 / 120, { throttle: 1, brake: 0, steer: 0, handbrake: false }, flat);
    return p.speed;
  };
  const ok = speedAfter({ damage: freshDamage() });
  const broken = speedAfter({ damage: { engine: 1, steering: 0, suspension: 0, pull: 1 } });
  assert.ok(broken < ok * 0.95, `${broken} vs ${ok}`);
});

test('les plaques de neige et de verglas existent et changent la surface de la route', async () => {
  const { Track } = await import('../js/trackgen.js');
  const { STAGES } = await import('../js/data.js');
  for (const id of ['montecarlo-jour', 'turini']) {
    const t = new Track(STAGES.find((s) => s.id === id));
    assert.ok(t.patches.length > 0, `${id} sans plaques`);
    for (const p of t.patches) {
      assert.ok(Number.isFinite(p.s0) && Number.isFinite(p.s1) && p.s1 > p.s0, `${id} : plaque invalide`);
      const mid = (p.s0 + p.s1) / 2;
      assert.equal(t.roadSurfaceAt(mid), p.kind);
      const pt = t.pointAt(mid);
      assert.equal(t.query(pt.x, pt.y, pt.idx).surface, p.kind);
    }
    assert.ok(t.notes.some((n) => n.kind === 'patch'));
  }
});
