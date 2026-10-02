// Catalogue du jeu : voitures, pièces de personnalisation, spéciales.

export const START_COINS = 800;

// --- Voitures ---------------------------------------------------------------
// power en kW, mass en kg, top en m/s, grip multiplicateur, drive : FWD/RWD/AWD
export const CARS = [
  {
    id: 'fennec', name: 'Fennec R2', price: 0, shape: 'hatch',
    desc: 'Petite traction agile, parfaite pour débuter.',
    drive: 'FWD', power: 125, mass: 1030, top: 47, grip: 1.0, steer: 0.62,
    dims: { L: 3.9, W: 1.75, wheelR: 0.31, wheelbase: 2.45, track: 1.5 },
    defaults: { paint: 'blanc', livery: 'stripes', livery2: 'rouge', rims: 'branches', rimColor: 'noir', spoiler: 'lip' },
  },
  {
    id: 'berlinette', name: 'Berlinette A1', price: 2000, shape: 'coupe',
    desc: 'Légende alpine des années 70. Légère, propulsion, vive en épingle.',
    drive: 'RWD', power: 135, mass: 760, top: 49, grip: 0.97, steer: 0.66,
    dims: { L: 3.85, W: 1.6, wheelR: 0.3, wheelbase: 2.3, track: 1.4 },
    defaults: { paint: 'bleu', livery: 'none', livery2: 'blanc', rims: 'tole', rimColor: 'blanc', spoiler: 'none', lights: 'pod4' },
  },
  {
    id: 'mistral', name: 'Mistral Evo', price: 4000, shape: 'sedan',
    desc: 'Berline turbo à quatre roues motrices. Efficace partout.',
    drive: 'AWD', power: 200, mass: 1250, top: 54, grip: 1.04, steer: 0.58,
    dims: { L: 4.45, W: 1.8, wheelR: 0.33, wheelbase: 2.62, track: 1.55 },
    defaults: { paint: 'jaune', livery: 'rally', livery2: 'noir', rims: 'rallye', rimColor: 'or', spoiler: 'wing' },
  },
  {
    id: 'corsaire', name: 'Corsaire 037', price: 7000, shape: 'wedge',
    desc: 'Bête du Groupe B à moteur central. Brutale, à dompter.',
    drive: 'RWD', power: 245, mass: 990, top: 58, grip: 0.98, steer: 0.6,
    dims: { L: 4.0, W: 1.85, wheelR: 0.33, wheelbase: 2.44, track: 1.56 },
    defaults: { paint: 'blanc', livery: 'tricolore', livery2: 'bleu', rims: 'mesh', rimColor: 'blanc', spoiler: 'ducktail' },
  },
  {
    id: 'toundra', name: 'Toundra Raid', price: 9000, shape: 'suv',
    desc: 'Tout-terrain de raid. Imperturbable hors piste et dans le sable.',
    drive: 'AWD', power: 230, mass: 1650, top: 52, grip: 1.0, steer: 0.55, offroad: 0.85,
    dims: { L: 4.5, W: 1.95, wheelR: 0.4, wheelbase: 2.75, track: 1.65 },
    defaults: { paint: 'sable', livery: 'camo', livery2: 'vert', rims: 'tole', rimColor: 'noir', spoiler: 'none', roof: 'rack', height: 'raised' },
  },
  {
    id: 'vortex', name: 'Vortex WRC', price: 14000, shape: 'wrc',
    desc: 'Arme absolue du championnat. 4x4, aéro énorme, grip maximal.',
    drive: 'AWD', power: 285, mass: 1190, top: 60, grip: 1.12, steer: 0.6,
    dims: { L: 4.1, W: 1.88, wheelR: 0.33, wheelbase: 2.55, track: 1.62 },
    defaults: { paint: 'bleu', livery: 'sponsor', livery2: 'jaune', rims: 'turbofan', rimColor: 'blanc', spoiler: 'gt', hood: 'vents', mudflaps: 'on' },
  },
];

// --- Couleurs (débloquées une fois pour toutes, utilisables partout) -------
export const COLORS = [
  { id: 'blanc', name: 'Blanc', hex: '#f1f1ee', price: 0 },
  { id: 'rouge', name: 'Rouge Rallye', hex: '#d42430', price: 0 },
  { id: 'bleu', name: 'Bleu France', hex: '#1f4fbf', price: 0 },
  { id: 'noir', name: 'Noir', hex: '#18181b', price: 0 },
  { id: 'jaune', name: 'Jaune', hex: '#f6c516', price: 150 },
  { id: 'orange', name: 'Orange', hex: '#f26b1d', price: 150 },
  { id: 'gris', name: 'Gris Nardo', hex: '#878b8e', price: 200 },
  { id: 'sable', name: 'Sable', hex: '#d6bf92', price: 200 },
  { id: 'vert', name: 'Vert Anglais', hex: '#17533a', price: 200 },
  { id: 'citron', name: 'Vert Citron', hex: '#8fd61f', price: 250 },
  { id: 'ciel', name: 'Bleu Ciel', hex: '#74b4ff', price: 250 },
  { id: 'cyan', name: 'Cyan', hex: '#14b6d4', price: 250 },
  { id: 'bordeaux', name: 'Bordeaux', hex: '#6b1024', price: 250 },
  { id: 'violet', name: 'Violet', hex: '#6a2bbf', price: 300 },
  { id: 'rose', name: 'Rose', hex: '#ff4fa3', price: 300 },
  { id: 'or', name: 'Or', hex: '#c9a33a', price: 500 },
];
export const colorHex = (id) => (COLORS.find((c) => c.id === id) || COLORS[0]).hex;

// --- Pièces par emplacement -----------------------------------------------
export const PARTS = {
  finish: [
    { id: 'gloss', name: 'Brillant', price: 0 },
    { id: 'matte', name: 'Mat', price: 300 },
    { id: 'metal', name: 'Métallisé', price: 400 },
    { id: 'pearl', name: 'Nacré', price: 600 },
    { id: 'chrome', name: 'Chrome', price: 1500 },
  ],
  livery: [
    { id: 'none', name: 'Unie', price: 0 },
    { id: 'stripes', name: 'Bandes', price: 0 },
    { id: 'split', name: 'Bicolore', price: 300 },
    { id: 'rally', name: 'Rallye 80', price: 400 },
    { id: 'checker', name: 'Damier', price: 400 },
    { id: 'tricolore', name: 'Tricolore', price: 500 },
    { id: 'camo', name: 'Camouflage', price: 600 },
    { id: 'flames', name: 'Flammes', price: 700 },
    { id: 'sponsor', name: 'Usine', price: 800 },
  ],
  rims: [
    { id: 'branches', name: '5 branches', price: 0 },
    { id: 'tole', name: 'Tôle', price: 0 },
    { id: 'rallye', name: 'Disque rallye', price: 300 },
    { id: 'mesh', name: 'Rayons croisés', price: 450 },
    { id: 'turbofan', name: 'Turbofan', price: 700 },
  ],
  spoiler: [
    { id: 'none', name: 'Aucun', price: 0 },
    { id: 'lip', name: 'Becquet', price: 0 },
    { id: 'ducktail', name: 'Queue de canard', price: 250 },
    { id: 'wing', name: 'Aileron rallye', price: 450 },
    { id: 'gt', name: 'Aileron WRC', price: 900 },
  ],
  hood: [
    { id: 'stock', name: 'Origine', price: 0 },
    { id: 'scoop', name: 'Prise d’air', price: 250 },
    { id: 'vents', name: 'Ouïes', price: 350 },
  ],
  roof: [
    { id: 'none', name: 'Aucun', price: 0 },
    { id: 'scoop', name: 'Écope de toit', price: 200 },
    { id: 'rack', name: 'Galerie + roue', price: 400 },
  ],
  lights: [
    { id: 'none', name: 'Aucune', price: 0 },
    { id: 'pod2', name: '2 longues portées', price: 250 },
    { id: 'pod4', name: '4 longues portées', price: 450 },
    { id: 'bar', name: 'Rampe LED', price: 600 },
  ],
  mudflaps: [
    { id: 'none', name: 'Aucune', price: 0 },
    { id: 'on', name: 'Bavettes', price: 150 },
  ],
  height: [
    { id: 'low', name: 'Asphalte (bas)', price: 200 },
    { id: 'stock', name: 'Gravier (std)', price: 0 },
    { id: 'raised', name: 'Raid (haut)', price: 300 },
  ],
  tint: [
    { id: 'clear', name: 'Claires', price: 0 },
    { id: 'dark', name: 'Teintées', price: 100 },
    { id: 'black', name: 'Noires', price: 200 },
  ],
  dust: [
    { id: 'natural', name: 'Naturelle', price: 0, hex: null },
    { id: 'rouge', name: 'Rouge', price: 400, hex: '#ff3344' },
    { id: 'bleu', name: 'Bleue', price: 400, hex: '#3d7bff' },
    { id: 'vert', name: 'Verte', price: 400, hex: '#4dff7a' },
    { id: 'rose', name: 'Rose', price: 500, hex: '#ff6ad5' },
    { id: 'violet', name: 'Violette', price: 500, hex: '#9b5cff' },
    { id: 'noir', name: 'Noire', price: 600, hex: '#222222' },
    { id: 'rainbow', name: 'Arc-en-ciel', price: 1500, hex: 'rainbow' },
  ],
  neon: [
    { id: 'none', name: 'Aucun', price: 0, hex: null },
    { id: 'bleu', name: 'Bleu', price: 500, hex: '#2a7bff' },
    { id: 'rose', name: 'Rose', price: 500, hex: '#ff3fb4' },
    { id: 'vert', name: 'Vert', price: 500, hex: '#3dff7a' },
    { id: 'rouge', name: 'Rouge', price: 500, hex: '#ff2a2a' },
    { id: 'blanc', name: 'Blanc', price: 500, hex: '#ffffff' },
  ],
  exhaust: [
    { id: 'stock', name: 'Origine', price: 0 },
    { id: 'flames', name: 'Anti-lag (flammes)', price: 800 },
  ],
};

// Configuration par défaut d'une voiture.
export function defaultConfig(car) {
  return {
    paint: 'blanc', finish: 'gloss', livery: 'none', livery2: 'rouge', number: 1 + (car.price % 97 || 7),
    rims: 'branches', rimColor: 'gris', spoiler: 'none', hood: 'stock', roof: 'none',
    lights: 'none', mudflaps: 'none', height: 'stock', tint: 'dark', dust: 'natural',
    neon: 'none', exhaust: 'stock', ...car.defaults,
  };
}

// Organisation de l'écran garage (onglets → sections).
export const GARAGE_TABS = [
  { id: 'cars', label: 'Voitures', icon: '🚗' },
  {
    id: 'paint', label: 'Peinture', icon: '🎨', focus: 'side',
    sections: [
      { title: 'Couleur', slot: 'paint', kind: 'color' },
      { title: 'Finition', slot: 'finish', kind: 'part' },
      { title: 'Vitres', slot: 'tint', kind: 'part' },
    ],
  },
  {
    id: 'livery', label: 'Livrée', icon: '🏁', focus: 'threeq',
    sections: [
      { title: 'Motif', slot: 'livery', kind: 'part' },
      { title: 'Couleur du motif', slot: 'livery2', kind: 'color' },
      { title: 'Numéro de course', slot: 'number', kind: 'number' },
    ],
  },
  {
    id: 'rims', label: 'Jantes', icon: '⚙️', focus: 'wheel',
    sections: [
      { title: 'Modèle', slot: 'rims', kind: 'part' },
      { title: 'Couleur', slot: 'rimColor', kind: 'color' },
    ],
  },
  {
    id: 'aero', label: 'Carrosserie', icon: '🛠️', focus: 'rear',
    sections: [
      { title: 'Aileron', slot: 'spoiler', kind: 'part' },
      { title: 'Capot', slot: 'hood', kind: 'part' },
      { title: 'Toit', slot: 'roof', kind: 'part' },
      { title: 'Bavettes', slot: 'mudflaps', kind: 'part' },
    ],
  },
  {
    id: 'lights', label: 'Phares', icon: '💡', focus: 'front',
    sections: [{ title: 'Longues portées', slot: 'lights', kind: 'part', hint: 'Éclairent plus loin dans les spéciales de nuit.' }],
  },
  {
    id: 'height', label: 'Suspension', icon: '🔧', focus: 'side',
    sections: [{ title: 'Garde au sol', slot: 'height', kind: 'part', hint: 'Bas : +grip sur asphalte. Haut : moins pénalisé hors piste.' }],
  },
  {
    id: 'fx', label: 'Effets', icon: '✨', focus: 'threeq',
    sections: [
      { title: 'Couleur des projections', slot: 'dust', kind: 'part' },
      { title: 'Néons', slot: 'neon', kind: 'part' },
      { title: 'Échappement', slot: 'exhaust', kind: 'part' },
    ],
  },
];

// --- Surfaces ---------------------------------------------------------------
export const SURFACES = {
  gravel: { name: 'Terre', mu: 0.8, roll: 0.018, B: 9, dust: '#b49a76', loose: 1 },
  tarmac: { name: 'Asphalte', mu: 1.12, roll: 0.012, B: 14, dust: '#d9d9d9', loose: 0.15 },
  snow: { name: 'Neige', mu: 0.58, roll: 0.02, B: 8, dust: '#ffffff', loose: 1 },
  sand: { name: 'Sable', mu: 0.72, roll: 0.035, B: 8, dust: '#e0c38c', loose: 1.2 },
  mud: { name: 'Boue', mu: 0.62, roll: 0.03, B: 8, dust: '#5a4630', loose: 1.1 },
  grass: { name: 'Herbe', mu: 0.55, roll: 0.06, B: 7, dust: '#6b5a3a', loose: 0.8 },
};

// --- Spéciales --------------------------------------------------------------
export const STAGES = [
  {
    id: 'vosges', name: 'Forêt des Vosges', country: '🇫🇷', surface: 'gravel', theme: 'forest',
    length: 2100, seed: 1101, hairpin: 0.06, twist: 0.65, reward: 150,
    desc: 'Pistes de terre rapides entre les sapins.',
  },
  {
    id: 'corse', name: 'Tour de Corse', country: '🇫🇷', surface: 'tarmac', theme: 'med',
    length: 2500, seed: 2207, hairpin: 0.14, twist: 0.8, reward: 220,
    desc: 'Asphalte sinueux en corniche, des virages par milliers.',
  },
  {
    id: 'suede', name: 'Rallye de Suède', country: '🇸🇪', surface: 'snow', theme: 'snow',
    length: 2600, seed: 3313, hairpin: 0.05, twist: 0.45, reward: 260,
    desc: 'Neige compacte et murs de neige. Appuie-toi dessus !',
  },
  {
    id: 'maroc', name: 'Désert Marocain', country: '🇲🇦', surface: 'sand', theme: 'desert',
    length: 3000, seed: 4421, hairpin: 0.03, twist: 0.35, reward: 300, roadWidth: 9,
    desc: 'Grandes courbes dans les dunes et sauts à fond.',
  },
  {
    id: 'galles', name: 'Forêts Galloises', country: '🏴', surface: 'mud', theme: 'wales',
    length: 2700, seed: 5531, hairpin: 0.08, twist: 0.6, reward: 330,
    desc: 'Boue, brouillard et bosses traîtresses.',
  },
  {
    id: 'montecarlo', name: 'Monte-Carlo de nuit', country: '🇲🇨', surface: 'tarmac', theme: 'night',
    length: 2800, seed: 6607, hairpin: 0.28, twist: 0.85, reward: 420, night: true,
    desc: 'Les lacets du Turini, de nuit. Les longues portées sont reines.',
  },
];

export const DAILY_SURFACES = ['gravel', 'tarmac', 'snow', 'sand', 'mud'];
export const SURFACE_THEME = { gravel: 'forest', tarmac: 'med', snow: 'snow', sand: 'desert', mud: 'wales' };

export const MEDALS = [
  { id: 'gold', name: 'Or', icon: '🥇', factor: 1.12, bonus: 300 },
  { id: 'silver', name: 'Argent', icon: '🥈', factor: 1.28, bonus: 150 },
  { id: 'bronze', name: 'Bronze', icon: '🥉', factor: 1.5, bonus: 60 },
];
