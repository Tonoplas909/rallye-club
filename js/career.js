// Mode carrière : saisons de 6 rallyes de 3 spéciales contre des pilotes IA.
// Module pur (pas de DOM) : testé dans test/career.test.js.
import { STAGES } from './data.js';
import { Track } from './trackgen.js';
import { mulberry32 } from './util.js';

export const STAGES_PER_RALLY = 3;
export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const POWER_STAGE_POINTS = [3, 2, 1]; // bonus sur la dernière spéciale du rallye
export const RALLY_COINS = [1500, 1000, 750, 550, 450, 380, 320, 270, 230, 200];
export const SEASON_COINS = [6000, 3500, 2000, 1200, 800];
export const PLAYER = 'player';

export const DIFFICULTIES = {
  facile: { name: 'Facile', factor: 1.12 },
  normal: { name: 'Normal', factor: 1.0 },
  difficile: { name: 'Difficile', factor: 0.95 },
};

// pace : rapport au temps de référence (plus petit = plus rapide). Spécialité = surface favorite.
export const DRIVERS = [
  { id: 'lambert', name: 'Julien Lambert', flag: '🇫🇷', pace: 1.06, specialty: 'tarmac' },
  { id: 'nyberg', name: 'Erik Nyberg', flag: '🇸🇪', pace: 1.08, specialty: 'snow' },
  { id: 'kowalski', name: 'Piotr Kowalski', flag: '🇵🇱', pace: 1.11, specialty: 'gravel' },
  { id: 'evans', name: 'Rhys Evans', flag: '🏴', pace: 1.14, specialty: 'mud' },
  { id: 'benali', name: 'Yasmine Benali', flag: '🇲🇦', pace: 1.17, specialty: 'sand' },
  { id: 'rossi', name: 'Marco Rossi', flag: '🇮🇹', pace: 1.2, specialty: 'tarmac' },
  { id: 'tanaka', name: 'Kenji Tanaka', flag: '🇯🇵', pace: 1.24, specialty: 'gravel' },
  { id: 'muller', name: 'Lena Müller', flag: '🇩🇪', pace: 1.29, specialty: 'snow' },
  { id: 'garcia', name: 'Diego García', flag: '🇪🇸', pace: 1.36, specialty: 'gravel' },
];

// Calendrier : du plus accessible au plus exigeant, Monte-Carlo en finale.
export const CALENDAR = [
  { id: 'vosges', name: 'Rallye des Vosges', stages: ['Col de la Schlucht', 'Grand Ballon', 'Lac de Gérardmer'] },
  { id: 'corse', name: 'Tour de Corse', stages: ['Col de Bavella', 'Calanches de Piana', 'Désert des Agriates'] },
  { id: 'suede', name: 'Rallye de Suède', stages: ['Torsby', 'Vargåsen', 'Lac de Hagfors'] },
  { id: 'maroc', name: 'Rallye du Maroc', stages: ['Erg Chebbi', 'Gorges du Dadès', 'Vallée du Drâa'] },
  { id: 'galles', name: 'Rallye de Galles', stages: ['Sweet Lamb', 'Hafren', 'Dyfi'] },
  { id: 'montecarlo', name: 'Rallye Monte-Carlo', stages: ['Col de Turini', 'Sisteron', 'Col de Braus'] },
];

export function newCareer(difficulty = 'normal', season = 1, history = []) {
  return {
    season,
    difficulty,
    rallyIndex: 0,
    rally: null,
    standings: Object.fromEntries([PLAYER, ...DRIVERS.map((d) => d.id)].map((id) => [id, 0])),
    results: [], // par rallye terminé : { id, position, points }
    history, // saisons terminées : { season, position, champion }
    finished: false,
  };
}

// Définition des 3 spéciales d'un rallye (nouveaux tracés à chaque saison).
export function rallyStages(rallyId, season) {
  const base = STAGES.find((s) => s.id === rallyId);
  const cal = CALENDAR.find((c) => c.id === rallyId);
  return cal.stages.map((name, k) => {
    const rng = mulberry32(base.seed * 31 + season * 977 + k * 131);
    return {
      ...base,
      id: `career-s${season}-${rallyId}-${k + 1}`,
      name: `ES${k + 1} · ${name}`,
      rallyName: cal.name,
      seed: base.seed * 10 + season * 101 + k * 7,
      length: Math.round(1500 + rng() * 600),
      twist: Math.min(0.95, Math.max(0.3, base.twist + (rng() - 0.5) * 0.3)),
      hairpin: Math.max(0.02, base.hairpin + (rng() - 0.5) * 0.06),
      reward: Math.round(base.reward * 0.6),
      career: true,
      powerStage: k === STAGES_PER_RALLY - 1,
      desc: k === STAGES_PER_RALLY - 1 ? 'Power Stage : 3, 2 et 1 points bonus aux plus rapides.' : base.desc,
    };
  });
}

function gauss(rng) {
  return Math.sqrt(-2 * Math.log(rng() + 1e-9)) * Math.cos(2 * Math.PI * rng());
}

// Temps des pilotes IA sur chaque spéciale (déterministe pour un rallye donné).
export function aiTimes(refTimes, stages, season, difficulty) {
  const diff = DIFFICULTIES[difficulty]?.factor ?? 1;
  const out = {};
  for (const d of DRIVERS) {
    out[d.id] = refTimes.map((ref, k) => {
      const rng = mulberry32((stages[k].seed * 7919) ^ (d.id.length * 104729 + d.pace * 1e4) ^ season);
      let pace = d.pace * diff * (1 + gauss(rng) * 0.02);
      if (stages[k].surface === d.specialty) pace *= 0.97;
      let t = ref * pace;
      // Incident (crevaison, tête-à-queue…) : 5 % de risque par spéciale.
      if (rng() < 0.05) t += 12000 + rng() * 40000;
      return Math.round(t / 100) * 100;
    });
  }
  return out;
}

export function startRally(career, refTimesFn = (s) => new Track(s).refTime) {
  const cal = CALENDAR[career.rallyIndex];
  const stages = rallyStages(cal.id, career.season);
  const refs = stages.map(refTimesFn);
  career.rally = {
    id: cal.id,
    stage: 0,
    times: { [PLAYER]: [], ...aiTimes(refs, stages, career.season, career.difficulty) },
    car: null,
  };
  return career.rally;
}

export function driverName(id, playerName = 'Toi') {
  if (id === PLAYER) return playerName;
  return DRIVERS.find((d) => d.id === id)?.name ?? id;
}

export function driverFlag(id) {
  return id === PLAYER ? '⭐' : DRIVERS.find((d) => d.id === id)?.flag ?? '';
}

// Classement d'une spéciale k (0-indexée).
export function stageRanking(rally, k) {
  return Object.entries(rally.times)
    .filter(([, t]) => t[k] != null)
    .map(([id, t]) => ({ id, time: t[k] }))
    .sort((a, b) => a.time - b.time)
    .map((r, i, arr) => ({ ...r, pos: i + 1, gap: r.time - arr[0].time }));
}

// Classement général après les spéciales 0..upTo (incluse).
export function generalClassification(rally, upTo) {
  return Object.entries(rally.times)
    .filter(([, t]) => t.length > upTo && t.slice(0, upTo + 1).every((x) => x != null))
    .map(([id, t]) => ({ id, time: t.slice(0, upTo + 1).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => a.time - b.time)
    .map((r, i, arr) => ({ ...r, pos: i + 1, gap: r.time - arr[0].time }));
}

// Enregistre le temps du joueur sur la spéciale courante. Renvoie le résumé de l'étape.
export function recordStage(career, timeMs) {
  const rally = career.rally;
  const k = rally.stage;
  rally.times[PLAYER][k] = Math.round(timeMs);
  rally.stage++;
  const summary = { k, stage: stageRanking(rally, k), gc: generalClassification(rally, k), rallyDone: rally.stage >= STAGES_PER_RALLY };
  if (summary.rallyDone) summary.rally = finishRally(career);
  return summary;
}

// Temps forfaitaire en cas d'abandon : le plus lent de la spéciale + 1 minute.
export function abandonTime(rally) {
  const k = rally.stage;
  const slowest = Math.max(...Object.entries(rally.times).filter(([id]) => id !== PLAYER).map(([, t]) => t[k]));
  return slowest + 60000;
}

function finishRally(career) {
  const rally = career.rally;
  const last = STAGES_PER_RALLY - 1;
  const gc = generalClassification(rally, last);
  const power = stageRanking(rally, last);
  const points = {};
  gc.forEach((r, i) => { points[r.id] = POINTS[i] ?? 0; });
  power.slice(0, POWER_STAGE_POINTS.length).forEach((r, i) => { points[r.id] += POWER_STAGE_POINTS[i]; });
  for (const [id, p] of Object.entries(points)) career.standings[id] = (career.standings[id] ?? 0) + p;
  const position = gc.find((r) => r.id === PLAYER).pos;
  const coins = RALLY_COINS[position - 1] ?? 150;
  const result = { id: rally.id, position, points: points[PLAYER], coins, gc, power, allPoints: points };
  career.results.push({ id: rally.id, position, points: points[PLAYER] });
  career.rally = null;
  career.rallyIndex++;
  if (career.rallyIndex >= CALENDAR.length) result.season = finishSeason(career);
  return result;
}

export function championship(career) {
  return Object.entries(career.standings)
    .map(([id, points]) => ({ id, points }))
    .sort((a, b) => b.points - a.points || (a.id === PLAYER ? -1 : b.id === PLAYER ? 1 : 0))
    .map((r, i) => ({ ...r, pos: i + 1 }));
}

function finishSeason(career) {
  const table = championship(career);
  const position = table.find((r) => r.id === PLAYER).pos;
  career.finished = true;
  career.history.push({ season: career.season, position, champion: table[0].id, difficulty: career.difficulty });
  return { position, table, coins: SEASON_COINS[position - 1] ?? 500, champion: position === 1 };
}
