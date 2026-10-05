// Gameplay avancé : pneus, réglages de la voiture, dégâts et parc d'assistance.
// Module pur (pas de DOM), utilisé par la physique, la course et la carrière.

// Adhérence relative de chaque gomme selon la surface.
export const TYRES = {
  terre: { name: 'Terre', icon: '🟤', desc: 'Polyvalent sur terre, boue et sable.', grip: { gravel: 1.0, mud: 1.0, sand: 1.0, grass: 1.0, snow: 0.86, tarmac: 0.9, wet: 0.88 } },
  asphalte: { name: 'Asphalte', icon: '⚫', desc: 'Gomme tendre : très efficace sur route sèche.', grip: { tarmac: 1.07, wet: 0.84, gravel: 0.84, mud: 0.78, sand: 0.84, grass: 0.82, snow: 0.7 } },
  pluie: { name: 'Pluie', icon: '🔵', desc: 'Évacue l’eau sur asphalte mouillé.', grip: { wet: 1.08, tarmac: 0.97, gravel: 0.92, mud: 0.92, sand: 0.88, grass: 0.9, snow: 0.82 } },
  neige: { name: 'Neige cloutés', icon: '❄️', desc: 'Clous pour mordre la glace et la neige.', grip: { snow: 1.18, tarmac: 0.84, wet: 0.84, gravel: 0.94, mud: 0.94, sand: 0.88, grass: 0.94 } },
};

export function recommendedTyre(surface, wet = false) {
  if (surface === 'snow') return 'neige';
  if (surface === 'tarmac') return wet ? 'pluie' : 'asphalte';
  return 'terre';
}

export function tyreGrip(tyre, surface, wet = false) {
  const t = TYRES[tyre];
  if (!t) return 1;
  const key = surface === 'tarmac' && wet ? 'wet' : surface;
  return t.grip[key] ?? 1;
}

// Réglages : -1, 0 ou +1 par paramètre (stockés dans la configuration de chaque voiture).
export const SETUP = [
  { key: 'gears', title: 'Boîte de vitesses', hint: 'Courte : meilleures accélérations. Longue : vitesse de pointe plus élevée.', labels: ['Courte', 'Standard', 'Longue'] },
  { key: 'susp', title: 'Suspension', hint: 'Souple : plus d’adhérence sur terre, neige et boue. Ferme : plus précise sur asphalte.', labels: ['Souple', 'Standard', 'Ferme'] },
  { key: 'bias', title: 'Répartition de freinage', hint: 'Vers l’arrière, la voiture pivote plus facilement au freinage, mais elle est plus instable.', labels: ['Avant', 'Équilibrée', 'Arrière'] },
];

// Effets physiques des réglages.
export function setupEffects(cfg = {}, surface = 'gravel') {
  const g = cfg.gears || 0, s = cfg.susp || 0, b = cfg.bias || 0;
  const loose = surface !== 'tarmac';
  return {
    topMult: 1 + 0.05 * g,
    forceMult: 1 - 0.08 * g,
    gripMult: loose ? 1 - 0.04 * s : 1 + 0.035 * s,
    frontBrake: 0.62 - 0.08 * b,
  };
}

// --- Dégâts ------------------------------------------------------------------
export const PARTS_DAMAGE = {
  engine: { name: 'Moteur', icon: '⚙️', repair: 25 },
  steering: { name: 'Direction', icon: '🎯', repair: 15 },
  suspension: { name: 'Suspension', icon: '🔩', repair: 20 },
};
export const SERVICE_MINUTES = 30;

export const freshDamage = () => ({ engine: 0, steering: 0, suspension: 0, pull: Math.random() < 0.5 ? -1 : 1 });

// Choc contre un obstacle. side : 'front' | 'side' | 'rear'. impact en m/s.
// Renvoie la liste des organes qui viennent de franchir un seuil (pour prévenir le joueur).
export function applyImpact(damage, impact, side) {
  const amount = Math.max(0, impact - 4) * 0.035;
  if (amount <= 0) return [];
  const split = { front: { engine: 0.5, steering: 0.5 }, side: { steering: 0.4, suspension: 0.6 }, rear: { suspension: 0.7, engine: 0.3 } }[side];
  return addDamage(damage, split, amount);
}

// Réception de saut trop violente.
export function applyLanding(damage, impact) {
  const amount = Math.max(0, impact - 7) * 0.03;
  return amount > 0 ? addDamage(damage, { suspension: 1 }, amount) : [];
}

function addDamage(damage, split, amount) {
  const crossed = [];
  for (const [part, k] of Object.entries(split)) {
    const before = damage[part];
    damage[part] = Math.min(1, before + amount * k);
    for (const th of [0.3, 0.6, 0.9]) if (before < th && damage[part] >= th) crossed.push({ part, level: th });
  }
  return crossed;
}

// Effets des dégâts sur la voiture.
export function damageEffects(d = {}) {
  return {
    powerMult: 1 - 0.4 * (d.engine || 0),
    steerMult: 1 - 0.25 * (d.steering || 0),
    pull: 0.05 * (d.steering || 0) * (d.pull || 1),
    gripMult: 1 - 0.12 * (d.suspension || 0),
  };
}

export const repairCost = (part, level) => Math.ceil(level * PARTS_DAMAGE[part].repair);

// Répare un organe avec le temps disponible. Réparation partielle si le temps manque.
export function repair(damage, part, minutesLeft) {
  const cost = repairCost(part, damage[part]);
  if (cost <= 0 || minutesLeft <= 0) return 0;
  const used = Math.min(cost, minutesLeft);
  damage[part] = Math.max(0, damage[part] - used / PARTS_DAMAGE[part].repair);
  if (damage[part] < 0.01) damage[part] = 0;
  return used;
}

export const damageLabel = (v) => (v < 0.05 ? 'Intact' : v < 0.3 ? 'Léger' : v < 0.6 ? 'Moyen' : v < 0.9 ? 'Grave' : 'Critique');
