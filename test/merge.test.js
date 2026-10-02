// Fusion des sauvegardes locale / cloud.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSaves, cloudPayload } from '../js/merge.js';

const base = (o) => ({
  coins: 0, cars: ['fennec'], selectedCar: 'fennec', owned: {}, configs: {}, best: {}, splits: {},
  medals: {}, finished: {}, daily: {}, settings: { sound: true }, seenVersion: '1.1.0', updatedAt: 0, ...o,
});

test('la sauvegarde la plus récente décide des pièces et de la voiture', () => {
  const local = base({ coins: 100, updatedAt: 10 });
  const remote = base({ coins: 900, cars: ['fennec', 'vortex'], selectedCar: 'vortex', updatedAt: 20 });
  const m = mergeSaves(local, remote);
  assert.equal(m.coins, 900);
  assert.equal(m.selectedCar, 'vortex');
  assert.equal(m.updatedAt, 20);
});

test('les déblocages des deux côtés sont conservés', () => {
  const local = base({ cars: ['fennec', 'mistral'], owned: { 'color:or': true }, finished: { vosges: true }, updatedAt: 30 });
  const remote = base({ cars: ['fennec', 'vortex'], owned: { 'rims:mesh': true }, finished: { corse: true }, updatedAt: 20 });
  const m = mergeSaves(local, remote);
  assert.deepEqual(new Set(m.cars), new Set(['fennec', 'mistral', 'vortex']));
  assert.ok(m.owned['color:or'] && m.owned['rims:mesh']);
  assert.ok(m.finished.vosges && m.finished.corse);
});

test('meilleurs temps et médailles : on garde le meilleur, avec ses temps intermédiaires', () => {
  const local = base({ best: { vosges: 90000, corse: 120000 }, splits: { vosges: [1, 2], corse: [3, 4] }, medals: { vosges: 'silver' }, updatedAt: 50 });
  const remote = base({ best: { vosges: 85000, maroc: 150000 }, splits: { vosges: [5, 6] }, medals: { vosges: 'bronze', maroc: 'gold' }, updatedAt: 10 });
  const m = mergeSaves(local, remote);
  assert.deepEqual(m.best, { vosges: 85000, corse: 120000, maroc: 150000 });
  assert.deepEqual(m.splits.vosges, [5, 6]);
  assert.deepEqual(m.medals, { vosges: 'silver', maroc: 'gold' });
});

test('les réglages de l’appareil restent locaux et ne partent pas en ligne', () => {
  const local = base({ settings: { sound: false }, updatedAt: 1 });
  const remote = base({ settings: { sound: true }, updatedAt: 2 });
  assert.equal(mergeSaves(local, remote).settings.sound, false);
  const payload = cloudPayload(local);
  assert.ok(!('settings' in payload) && !('seenVersion' in payload));
});

test('sans sauvegarde en ligne, la progression locale est reprise telle quelle', () => {
  const local = base({ coins: 42 });
  assert.equal(mergeSaves(local, null).coins, 42);
});
