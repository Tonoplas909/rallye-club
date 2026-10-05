// Mode carrière : calendrier, temps IA, classements, points.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newCareer, startRally, recordStage, rallyStages, aiTimes, abandonTime, championship,
  CALENDAR, DRIVERS, PLAYER, STAGES_PER_RALLY, POINTS, POWER_STAGE_POINTS,
} from '../js/career.js';
import { Track } from '../js/trackgen.js';

const fakeRef = () => 100000;

test('chaque rallye du calendrier génère 3 spéciales jouables, différentes à chaque saison', () => {
  for (const cal of CALENDAR) {
    const s1 = rallyStages(cal.id, 1), s2 = rallyStages(cal.id, 2);
    assert.equal(s1.length, STAGES_PER_RALLY);
    assert.notEqual(s1[0].seed, s2[0].seed);
    assert.ok(s1[2].powerStage);
    for (const st of s1) {
      const t = new Track(st);
      assert.ok(t.length > st.length * 0.85, `${st.id} trop courte`);
    }
  }
});

test('les temps IA sont déterministes et suivent le niveau des pilotes', () => {
  const stages = rallyStages('vosges', 1);
  const a = aiTimes([90000, 90000, 90000], stages, 1, 'normal');
  const b = aiTimes([90000, 90000, 90000], stages, 1, 'normal');
  assert.deepEqual(a, b);
  const easy = aiTimes([90000, 90000, 90000], stages, 1, 'facile');
  const sum = (t) => Object.values(t).flat().reduce((x, y) => x + y, 0);
  assert.ok(sum(easy) > sum(a), 'le mode facile doit ralentir les IA');
  // Le meilleur pilote est en moyenne plus rapide que le moins bon.
  const best = DRIVERS[0].id, worst = DRIVERS.at(-1).id;
  assert.ok(a[best].reduce((x, y) => x + y) < a[worst].reduce((x, y) => x + y));
});

test('une saison complète attribue les points et termine le championnat', () => {
  const c = newCareer('normal');
  for (let r = 0; r < CALENDAR.length; r++) {
    startRally(c, fakeRef);
    let summary;
    for (let k = 0; k < STAGES_PER_RALLY; k++) summary = recordStage(c, 80000); // toujours le plus rapide
    assert.ok(summary.rallyDone);
    assert.equal(summary.rally.position, 1);
    assert.equal(summary.rally.points, POINTS[0] + POWER_STAGE_POINTS[0]);
  }
  assert.ok(c.finished);
  assert.equal(c.standings[PLAYER], CALENDAR.length * (POINTS[0] + POWER_STAGE_POINTS[0]));
  assert.equal(championship(c)[0].id, PLAYER);
  assert.equal(c.history[0].position, 1);
});

test('classement général cumulé et temps forfaitaire en cas d’abandon', () => {
  const c = newCareer('normal');
  startRally(c, fakeRef);
  const forfeit = abandonTime(c.rally);
  const slowest = Math.max(...DRIVERS.map((d) => c.rally.times[d.id][0]));
  assert.equal(forfeit, slowest + 60000);
  const s = recordStage(c, forfeit);
  assert.equal(s.stage.at(-1).id, PLAYER);
  assert.equal(s.gc.length, DRIVERS.length + 1);
  for (let i = 1; i < s.gc.length; i++) assert.ok(s.gc[i].time >= s.gc[i - 1].time);
});
