# Notes de version

Les mêmes notes s'affichent dans le jeu (menu → « Nouveautés »). La source est `js/version.js`.

## v1.5.0 — 05/10/2026 · Nouveaux pays, météo et Monte-Carlo
- Monte-Carlo de jour : asphalte avec des plaques de neige et de verglas dans les virages à l’ombre, annoncées par le copilote. Le choix des pneus devient un vrai dilemme.
- Col de Turini : la montée légendaire en 17 épingles vers le col enneigé, devant une foule immense.
- 3 nouveaux pays : Finlande (terre ultra-rapide, lacs et sauts géants), Safari Kenya (pistes rouges de la savane) et Japon (routes de montagne entre les cerisiers).
- Météo dynamique : la pluie peut arriver en pleine spéciale. Le ciel s’assombrit, la route devient glissante et les pneus Pluie prennent tout leur sens.
- Spéciales de nuit possibles dans tous les pays, en carrière comme au défi du jour.
- 3 nouvelles voitures : Comète 1800 (propulsion des années 70), Kodiak Raid (pick-up 4x4) et Lionne T16 (Groupe B).
- Le championnat passe à 9 rallyes. Le rallye Monte-Carlo enchaîne désormais une spéciale de jour, le Col de Turini et une spéciale de nuit.

## v1.4.0 — 05/10/2026 · Dégâts, pneus et réglages
- Dégâts mécaniques : les chocs et les réceptions trop dures abîment le moteur (moins de puissance), la direction (la voiture tire d’un côté) et la suspension (moins d’adhérence). L’état s’affiche en haut à gauche.
- Carrière : les dégâts restent d’une spéciale à l’autre. Au parc d’assistance, tu as 30 minutes pour réparer entre deux spéciales.
- Choix des pneus en carrière : Terre, Asphalte, Pluie ou Neige cloutés. Le bon pneu sur la bonne surface fait gagner de précieuses secondes.
- Nouvel onglet Réglages au garage : boîte courte ou longue, suspension souple ou ferme, répartition de freinage.
- Aides au pilotage réglables dans les paramètres : ABS, antipatinage et contrôle de stabilité. Les témoins s’allument sur le compteur quand elles interviennent. Les dégâts peuvent aussi être désactivés.

## v1.3.0 — 05/10/2026 · Mode carrière
- Nouveau mode Carrière : un championnat de 6 rallyes (Vosges, Corse, Suède, Maroc, Galles, Monte-Carlo) de 3 spéciales chacun.
- Affronte 9 pilotes IA, chacun avec son niveau et sa surface favorite. Les temps s'additionnent au classement général.
- Points aux 10 premiers (25, 18, 15…) et Power Stage sur la dernière spéciale de chaque rallye (+3, +2, +1).
- 3 niveaux de difficulté, nouveaux tracés à chaque saison, primes de fin de rallye et de fin de saison.
- En carrière, pas de seconde chance : une spéciale ne se recourt pas, et un abandon donne un temps forfaitaire.

## v1.2.0 — 02/10/2026 · Préparation des comptes en ligne
- Le jeu est prêt à accueillir des comptes en ligne : sauvegarde sur tous tes appareils et classement mondial par spéciale.
- Ils seront activés dans une prochaine mise à jour. En attendant, ta progression reste enregistrée sur cet appareil.

Côté technique : schéma SQL, client Supabase et interface sont en place et testés sur un Supabase local. La connexion au projet en ligne est coupée (`enabled: false` dans `js/config.js`) tant que le projet est en pause.

## v1.1.0 — 02/10/2026 · En ligne et outils de test
- Le jeu est jouable directement dans le navigateur via GitHub Pages.
- Nouvel écran « Nouveautés » avec les notes de version, ouvert automatiquement après une mise à jour.
- Panneau de debug (touche F1 ou ², ou 5 appuis rapides sur le numéro de version) : infos en direct, réglages de physique à chaud, triches de test, ralenti, caméra orbitale et zones de collision.
- Les spéciales courues avec des triches ou une physique modifiée n'enregistrent ni record ni fantôme.

## v1.0.0 — 02/10/2026 · Première sortie
- 6 spéciales : Vosges, Corse, Suède, Maroc, Pays de Galles et Monte-Carlo de nuit.
- Défi du jour, avec une nouvelle spéciale chaque jour.
- Copilote vocal, temps intermédiaires, fantôme et médailles.
- Garage avec 6 voitures et personnalisation complète : peinture, finition, livrée, jantes, aéro, phares, néons, projections et flammes.
- Commandes au clavier, à la manette et sur écran tactile.
