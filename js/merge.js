// Fusion de deux sauvegardes (appareil local et cloud). Module pur, testé dans test/.
const MEDAL_RANK = { gold: 0, silver: 1, bronze: 2 };
// Champs propres à l'appareil, jamais envoyés en ligne.
export const LOCAL_ONLY = ['settings', 'seenVersion'];

export function cloudPayload(data) {
  const out = { ...data };
  for (const k of LOCAL_ONLY) delete out[k];
  return out;
}

// La sauvegarde la plus récente décide des pièces, de la voiture choisie et des réglages
// de carrosserie ; tout ce qui a été débloqué ou battu d'un côté ou de l'autre est conservé.
export function mergeSaves(local, remote) {
  if (!remote) return { ...local };
  if (!local) return { ...remote };
  const newer = (remote.updatedAt || 0) > (local.updatedAt || 0) ? remote : local;
  const older = newer === remote ? local : remote;
  const out = { ...older, ...newer };
  out.cars = [...new Set([...(local.cars || []), ...(remote.cars || [])])];
  out.owned = { ...(older.owned || {}), ...(newer.owned || {}) };
  out.finished = { ...(older.finished || {}), ...(newer.finished || {}) };
  out.daily = { ...(older.daily || {}), ...(newer.daily || {}) };
  out.configs = { ...(older.configs || {}), ...(newer.configs || {}) };
  out.best = {};
  out.splits = {};
  for (const k of new Set([...Object.keys(local.best || {}), ...Object.keys(remote.best || {})])) {
    const a = local.best?.[k], b = remote.best?.[k];
    const useB = a == null || (b != null && b < a);
    out.best[k] = useB ? b : a;
    const splits = useB ? remote.splits?.[k] : local.splits?.[k];
    if (splits) out.splits[k] = splits;
  }
  out.medals = {};
  for (const k of new Set([...Object.keys(local.medals || {}), ...Object.keys(remote.medals || {})])) {
    const a = local.medals?.[k], b = remote.medals?.[k];
    out.medals[k] = a == null ? b : b == null ? a : MEDAL_RANK[a] <= MEDAL_RANK[b] ? a : b;
  }
  if (!out.cars.includes(out.selectedCar)) out.selectedCar = out.cars[0];
  for (const k of LOCAL_ONLY) if (k in local) out[k] = local[k];
  out.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
  return out;
}
