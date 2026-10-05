// Configuration des comptes en ligne (Supabase).
//
// `enabled` est l'interrupteur général : à false, le jeu ne contacte jamais Supabase
// (aucune requête, bouton de compte caché) et reste entièrement hors ligne.
// Avant de le passer à true, suivre la checklist « Mise en service » du README.
//
// `anonKey` est la clé publique (« publishable » ou ancienne clé « anon ») : elle est faite
// pour être publique, la sécurité repose sur les règles RLS de supabase/migrations/.
// Ne jamais mettre ici la clé « secret » / « service_role ».
export const SUPABASE = {
  enabled: false, // projet Supabase en pause pour l'instant
  url: 'https://harotewbjhmpvsltghyv.supabase.co',
  anonKey: 'sb_publishable_w69ngSnOuAks1u3zGO-RWg_wHxxwZs8',
};
