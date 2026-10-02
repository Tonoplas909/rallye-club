# 🏁 Rallye Club

Jeu de rallye 3D jouable dans le navigateur. L'esprit et la personnalisation viennent de *Drift Club*, mais ici on ne drifte pas : on court contre la montre sur des spéciales de rallye.

## Lancer le jeu

Aucune compilation n'est nécessaire, Three.js est fourni dans `vendor/`. Les modules ES exigent un serveur HTTP local :

```bash
npm start            # http://localhost:8080
# ou : python3 -m http.server 8080
```

Version en ligne : **https://tonoplas909.github.io/rallye-club/**. Elle est republiée automatiquement à chaque push par `.github/workflows/pages.yml`.

## Commandes

| Action | Clavier | Manette | Tactile |
|---|---|---|---|
| Accélérer | ↑ / W / Z | Gâchette droite, A | GAZ |
| Freiner / marche arrière | ↓ / S | Gâchette gauche, B | FREIN |
| Diriger | ← → / A D / Q D | Stick gauche | ◀ ▶ |
| Frein à main | Espace | X / RB | FAM |
| Remise en piste (+5 s) | R | Y | — |
| Caméra (poursuite / large / capot) | C | — | — |
| Pause | Échap / P | Start | ❚❚ |

## Contenu

**Course**
- 6 spéciales générées de façon procédurale (toujours le même tracé pour une même spéciale) : terre des Vosges, asphalte corse avec glissières, neige suédoise avec murs de neige, dunes marocaines avec grands sauts, boue galloise sous la pluie, Monte-Carlo de nuit avec phares.
- **Défi du jour** : une nouvelle spéciale chaque jour, avec 500 🪙 de bonus à la première arrivée.
- Physique arcade : transferts de charge, cercle d'adhérence, sous-virage et survirage, frein à main, sauts sur les bosses, adhérence propre à chaque surface, pénalité hors piste.
- Notes du copilote affichées à l'écran et lues à voix haute en français (« gauche trois », « épingle droite », « saut »…).
- Temps intermédiaires comparés au record, **fantôme** du meilleur passage, médailles or, argent et bronze.
- Projections de terre, de neige, de sable ou de boue, traces de pneus, spectateurs qui sautent au passage, fumigènes la nuit.

**Garage (façon Drift Club)**
- 6 voitures : traction, propulsion et 4x4, chacune avec ses caractéristiques (de la Fennec R2 à la Vortex WRC).
- Personnalisation propre à chaque voiture : 16 peintures, 5 finitions (brillant, mat, métallisé, nacré, chrome), 9 livrées avec couleur secondaire et numéro de course, 5 modèles de jantes avec leur couleur, ailerons, capots, toit (écope, galerie avec roue de secours), bavettes, longues portées (utiles de nuit), garde au sol (effet sur l'adhérence), teinte des vitres, couleur des projections (jusqu'à l'arc-en-ciel), néons et échappement anti-lag qui crache des flammes.
- Aperçu avant achat et économie de pièces : on en gagne à chaque arrivée, avec des bonus pour les médailles, les records et les spéciales sans faute.

La progression est enregistrée dans le `localStorage` du navigateur.

## Comptes en ligne (Supabase)

Le jeu peut fonctionner avec des comptes en ligne (inscription par e-mail et mot de passe, pseudo, sauvegarde de la progression dans le cloud sur tous les appareils, classement mondial par spéciale). Si `js/config.js` est vide, si le serveur ne répond pas, ou si les tables n'ont pas encore été créées, le bouton de compte reste caché et le jeu fonctionne entièrement hors ligne.

### Mise en service

1. Dans l'organisation Supabase, créer un projet (région Europe, par exemple `eu-west-3` Paris).
2. Créer les tables :
   - **soit** coller le contenu de `supabase/migrations/20261002000000_comptes_en_ligne.sql` dans *SQL Editor* puis cliquer sur *Run* ;
   - **soit**, avec la CLI : `npx supabase login`, `npx supabase link --project-ref <ref-du-projet>`, puis `npx supabase db push`.
3. *Authentication → URL Configuration* :
   - **Site URL** : `https://tonoplas909.github.io/rallye-club/`
   - **Redirect URLs** : ajouter `https://tonoplas909.github.io/rallye-club/` et `http://localhost:8080` (développement).
4. *Project Settings → API Keys* : l'**URL du projet** et la clé **publishable** (ou l'ancienne clé `anon`) vont dans `js/config.js`. C'est déjà fait pour le projet `harotewbjhmpvsltghyv`. Ne jamais y mettre la clé `secret` / `service_role`.
5. (Recommandé) *Authentication → Emails* : traduire les e-mails de confirmation et de réinitialisation en français. Avant l'ouverture au public, configurer un SMTP personnalisé : le service d'e-mail fourni par défaut est limité à quelques envois par heure.

### Ce qui est stocké

| Table | Contenu | Accès |
|---|---|---|
| `profiles` | pseudo unique, créé automatiquement à l'inscription | lecture publique, modification par son propriétaire |
| `saves` | progression (pièces, voitures, pièces achetées, records, médailles) | uniquement son propriétaire |
| `stage_times` | meilleur temps par joueur et par spéciale | lecture publique ; écriture uniquement via la fonction `submit_time` |

La fusion local / cloud (`js/merge.js`) garde tout ce qui a été débloqué ou battu de part et d'autre. Pour les pièces et la voiture choisie, c'est la sauvegarde la plus récente qui l'emporte. Les fantômes et les réglages de l'appareil restent locaux.

Limite connue : le chrono est calculé dans le navigateur, donc un joueur motivé peut envoyer un faux temps. La base refuse seulement les temps impossibles (moins de 20 s). Une vérification côté serveur (par exemple en rejouant le fantôme) pourra venir plus tard.

### Développement local

Avec Docker : `npx supabase start` lance une pile Supabase locale qui applique la migration automatiquement. Il suffit ensuite de mettre l'URL et la clé anon affichées dans `js/config.js` (sans les commiter).

## Panneau de debug

Touche **F1** ou **²** (ou 5 appuis rapides sur le numéro de version, en bas à droite du menu). Le panneau propose :
- des infos en direct (FPS, appels de dessin, vitesse, glisse, surface, position…) ;
- des multiplicateurs de physique à chaud (adhérence, puissance, braquage, frein à main, inertie) ;
- des triches (pièces, tout débloquer, pilote auto, virage suivant, fin de spéciale) ;
- des options d'affichage (vitesse du temps, caméra orbitale, zones de collision, HUD masqué).

Une spéciale courue avec une triche ou une physique modifiée n'enregistre ni record ni fantôme.

## Notes de version

Voir [CHANGELOG.md](CHANGELOG.md). À chaque version, mettre à jour `VERSION` et `RELEASES` dans `js/version.js`.

## Organisation du code

```
index.html, css/style.css   interface (menus, HUD, garage, modales)
js/main.js                  application, écrans, garage, économie
js/debug.js, version.js     panneau de debug, notes de version
js/online.js, accountUI.js  comptes Supabase, sauvegarde cloud, classements
js/merge.js                 fusion des sauvegardes locale / cloud
supabase/                   configuration et migrations SQL
js/race.js                  déroulé d'une spéciale (chrono, copilote, fantôme, caméra)
js/physics.js               physique de la voiture (sans dépendance au rendu)
js/trackgen.js              génération du tracé, du relief, des notes et du temps de référence
js/world.js                 décor 3D (terrain, route, végétation, glissières, spectateurs)
js/carModel.js, livery.js   voitures procédurales et livrées peintes sur canvas
js/effects.js, audio.js     particules, traces, pluie, sons WebAudio, voix du copilote
js/data.js                  catalogue (voitures, pièces, couleurs, spéciales)
```

## Tests

```bash
npm test
```

Les tests s'exécutent dans Node, sans navigateur. Ils vérifient que les spéciales sont déterministes, que les tracés ne se recoupent pas, qu'un pilote automatique termine chaque spéciale avec chaque voiture, et que la fusion des sauvegardes locale / cloud se comporte comme prévu.
