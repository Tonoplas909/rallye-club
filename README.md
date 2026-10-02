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

Les tests s'exécutent dans Node, sans navigateur. Ils vérifient que les spéciales sont déterministes, que les tracés ne se recoupent pas, et qu'un pilote automatique termine chaque spéciale avec chaque voiture.
