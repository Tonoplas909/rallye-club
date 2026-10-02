// Configuration des comptes en ligne (Supabase).
// Renseigner l'URL du projet et la clé publique « anon » (Project Settings → API).
// Cette clé est faite pour être publique : la sécurité repose sur les règles RLS
// définies dans supabase/migrations/. Ne jamais mettre ici la clé « service_role ».
// Tant que ces champs sont vides, le jeu fonctionne hors ligne, sans comptes.
export const SUPABASE = {
  url: 'https://harotewbjhmpvsltghyv.supabase.co',
  anonKey: 'sb_publishable_w69ngSnOuAks1u3zGO-RWg_wHxxwZs8',
};
