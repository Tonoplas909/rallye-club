// Version du jeu et notes de version affichées dans « Nouveautés ».
// Garder CHANGELOG.md synchronisé avec cette liste.
export const VERSION = '1.3.0';

export const RELEASES = [
  {
    version: '1.3.0',
    date: '2026-10-05',
    title: 'Mode carrière',
    notes: [
      'Nouveau mode Carrière : un championnat de 6 rallyes (Vosges, Corse, Suède, Maroc, Galles, Monte-Carlo) de 3 spéciales chacun.',
      'Affronte 9 pilotes IA, chacun avec son niveau et sa surface favorite. Les temps s’additionnent au classement général.',
      'Points aux 10 premiers (25, 18, 15…) et Power Stage sur la dernière spéciale de chaque rallye (+3, +2, +1).',
      '3 niveaux de difficulté, nouveaux tracés à chaque saison, primes de fin de rallye et de fin de saison.',
      'En carrière, pas de seconde chance : une spéciale ne se recourt pas, et un abandon donne un temps forfaitaire.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-10-02',
    title: 'Préparation des comptes en ligne',
    notes: [
      'Le jeu est prêt à accueillir des comptes en ligne : sauvegarde sur tous tes appareils et classement mondial par spéciale.',
      'Ils seront activés dans une prochaine mise à jour. En attendant, ta progression reste enregistrée sur cet appareil.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-10-02',
    title: 'En ligne et outils de test',
    notes: [
      'Le jeu est jouable directement dans le navigateur via GitHub Pages.',
      'Nouvel écran « Nouveautés » avec les notes de version, ouvert automatiquement après une mise à jour.',
      'Panneau de debug (touche F1 ou ², ou 5 appuis rapides sur le numéro de version) : infos en direct, réglages de physique à chaud, triches de test, ralenti, caméra orbitale et zones de collision.',
      'Les spéciales courues avec des triches ou une physique modifiée n’enregistrent ni record ni fantôme.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-10-02',
    title: 'Première sortie',
    notes: [
      '6 spéciales : Vosges, Corse, Suède, Maroc, Pays de Galles et Monte-Carlo de nuit.',
      'Défi du jour, avec une nouvelle spéciale chaque jour.',
      'Copilote vocal, temps intermédiaires, fantôme et médailles.',
      'Garage avec 6 voitures et personnalisation complète : peinture, finition, livrée, jantes, aéro, phares, néons, projections et flammes.',
      'Commandes au clavier, à la manette et sur écran tactile.',
    ],
  },
];
