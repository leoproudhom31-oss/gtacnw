/* ============================================================
   JADE HARBOR — mapdata.js
   Données de monde : définition de la carte, districts, réseau
   routier, bâtiments spéciaux, POI, spawns. Séparé du moteur
   de génération/rendu (map.js) pour clarté architecturale.
   ============================================================ */
"use strict";
(function (G) {

  const T = 48;
  const MW = 384, MH = 384;
  const WPX = MW * T, HPX = MH * T;

  // Axes routiers verticaux (colonne de tuile, chaque route = 2 tuiles de large)
  const VROADS = [
    12, 30, 48, 66, 84, 102, 120, 138, 156, 174,
    192, 210, 228, 246, 264, 282, 300, 318, 336, 354, 372
  ];
  // Axes routiers horizontaux
  const HROADS = [
    12, 30, 48, 66, 84, 102, 120, 138, 156, 174,
    192, 210, 228, 246, 264, 282, 300, 318, 336, 354, 372
  ];

  // Routes qui traversent le canal (ponts)
  const BRIDGE_VROADS = [12, 48, 84, 120, 156, 192, 228, 264, 300, 336, 372];

  // Canal : bande d'eau horizontale
  const CANAL = { y0: 248, y1: 254 }; // tuiles 248-254 (7 tuiles de large)

  // Districts — zones thématiques de la carte 384×384
  const DISTRICTS = [
    // --- Nord ---
    { key: "beach",      name: "Croissant de Sable",       x0: 220, y0: 0,   x1: 380, y1: 20 },
    { key: "hills",      name: "Collines de Jade",         x0: 10,  y0: 10,  x1: 100, y1: 70 },
    { key: "campus",     name: "Campus Brumeux",           x0: 101, y0: 10,  x1: 190, y1: 70 },
    { key: "resid_n",    name: "Quartier des Érables",     x0: 191, y0: 21,  x1: 380, y1: 70 },

    // --- Centre-nord ---
    { key: "downtown",   name: "Hauteurs Meridian",        x0: 10,  y0: 71,  x1: 130, y1: 155 },
    { key: "finance",    name: "Place de la Bourse",       x0: 131, y0: 71,  x1: 250, y1: 155 },
    { key: "resid",      name: "Collines de Papier",       x0: 251, y0: 71,  x1: 380, y1: 155 },

    // --- Centre-sud ---
    { key: "market",     name: "Bazar de l'Ouest",         x0: 10,  y0: 156, x1: 130, y1: 245 },
    { key: "lotus",      name: "Quartier du Lotus",        x0: 131, y0: 156, x1: 270, y1: 245 },
    { key: "park",       name: "Jardin des Brumes",        x0: 271, y0: 156, x1: 380, y1: 245 },

    // --- Canal ---
    { key: "canal",      name: "Canal des Lanternes",      x0: 10,  y0: 246, x1: 380, y1: 260 },

    // --- Sud ---
    { key: "docks",      name: "Docks de Fer",             x0: 10,  y0: 261, x1: 200, y1: 345 },
    { key: "industrial", name: "Zone Industrielle",        x0: 201, y0: 261, x1: 380, y1: 345 },
    { key: "piers",      name: "Jetée du Départ",          x0: 10,  y0: 346, x1: 380, y1: 383 }
  ];

  // Bâtiments spéciaux (positions en tuiles, histoire et gameplay)
  const SPECIAL_BUILDINGS = [
    { id: "teahouse",  tx: 180, ty: 180, tw: 8,  th: 6,  height: 52,
      wall: "#8a3324", roof: "#7a1f14", archetype: "temple",
      sign: { text: "SALON DE THÉ 茶", color: "#ffc857" },
      accessible: true, interior: "teahouse" },

    { id: "garage",    tx: 60,  ty: 190, tw: 8,  th: 5,  height: 56,
      wall: "#6d7a8c", roof: "#54626f", archetype: "warehouse",
      sign: { text: "GARAGE LONG", color: "#2ee6a8" },
      trim: "#2ee6a8", accessible: true, interior: "garage" },

    { id: "police",    tx: 30,  ty: 100, tw: 8,  th: 6,  height: 82,
      wall: "#2b4c7e", roof: "#22304a", archetype: "civic",
      sign: { text: "POLICE 警察", color: "#7ad7ff" },
      trim: "#7ad7ff", accessible: false },

    { id: "hospital",  tx: 280, ty: 85,  tw: 8,  th: 7,  height: 90,
      wall: "#e8e4d8", roof: "#cfc6b3", archetype: "civic",
      sign: { text: "HÔPITAL +", color: "#ff5340" },
      accessible: false },

    { id: "hideout",   tx: 100, ty: 290, tw: 12, th: 7,  height: 60,
      wall: "#5f4a3f", roof: "#4a3a30", archetype: "warehouse",
      sign: { text: "PÊCHERIE WANG", color: "#19b3c4" },
      accessible: false },

    { id: "tower",     tx: 70,  ty: 78,  tw: 6,  th: 6,  height: 180,
      wall: "#3d5a6e", roof: "#2a3f4e", archetype: "skyscraper",
      sign: { text: "JADE TOWER", color: "#2ee6a8" },
      accessible: true, interior: "lobby" },

    { id: "casino",    tx: 155, ty: 80,  tw: 10, th: 8,  height: 110,
      wall: "#5a1a3a", roof: "#3f102a", archetype: "commercial",
      sign: { text: "LOTUS D'OR 金", color: "#ffc857" },
      trim: "#ffc857", accessible: true, interior: "casino" },

    { id: "mall",      tx: 45,  ty: 165, tw: 12, th: 8,  height: 48,
      wall: "#7f8c8d", roof: "#5f6d6e", archetype: "commercial",
      sign: { text: "GALERIE JADE", color: "#7ad7ff" },
      accessible: true, interior: "mall" },

    { id: "university", tx: 130, ty: 30, tw: 14, th: 10, height: 44,
      wall: "#8c6d3f", roof: "#6d5a30", archetype: "civic",
      sign: { text: "UNIVERSITÉ DU PORT", color: "#ffc857" },
      accessible: false },

    { id: "temple",    tx: 310, ty: 180, tw: 8,  th: 8,  height: 38,
      wall: "#8a3324", roof: "#7a1f14", archetype: "temple",
      sign: null, accessible: false },

    { id: "station",   tx: 200, ty: 265, tw: 16, th: 6,  height: 38,
      wall: "#6d7a8c", roof: "#54626f", archetype: "civic",
      sign: { text: "GARE MARITIME", color: "#2ee6a8" },
      accessible: true, interior: "station" }
  ];

  // Palettes de bâtiments par district (couleurs murs, hauteurs, styles)
  const BUILDING_PALETTES = {
    hills: {
      walls: ["#7a8a6a", "#8a7a5c", "#6a7a5f", "#9c8a6a", "#5f6a4f"],
      heights: [36, 42, 48, 54], floors: [2, 2, 3, 3],
      styles: ["residential", "villa", "residential", "villa"],
      density: 0.6, trees: 0.4
    },
    campus: {
      walls: ["#8c6d3f", "#a08c6a", "#7a6d5f", "#c9a06a", "#6d5a40"],
      heights: [38, 44, 52, 60], floors: [2, 3, 3, 4],
      styles: ["civic", "office", "residential", "office"],
      density: 0.5, trees: 0.35
    },
    resid_n: {
      walls: ["#b96a4b", "#a3593d", "#c9825e", "#8f5a3a", "#b5836a", "#9c6f50"],
      heights: [36, 42, 48, 52], floors: [2, 2, 3, 3],
      styles: ["residential", "residential", "apartment", "residential"],
      density: 0.75, trees: 0.25
    },
    downtown: {
      walls: ["#5d6d7e", "#46586a", "#3f4f63", "#6a7a8c", "#54626f", "#4a5a70", "#3d5a6e"],
      heights: [90, 110, 130, 150, 170], floors: [6, 7, 8, 9, 10],
      styles: ["skyscraper", "office", "skyscraper", "office", "skyscraper"],
      density: 0.9, trees: 0.05
    },
    finance: {
      walls: ["#3d5a6e", "#5a4f6e", "#4f6659", "#6e5a4a", "#2e4a5e", "#4a3f5e"],
      heights: [100, 120, 140, 160, 190], floors: [7, 8, 9, 10, 12],
      styles: ["skyscraper", "skyscraper", "office", "skyscraper", "skyscraper"],
      density: 0.92, trees: 0.03
    },
    resid: {
      walls: ["#b96a4b", "#a3593d", "#c9825e", "#8f5a3a", "#b5836a", "#9c6f50", "#c98a6a",
              "#7a8a6a", "#8a7a9c", "#c9a06a"],
      heights: [36, 42, 48, 54], floors: [2, 2, 3, 3],
      styles: ["residential", "residential", "apartment", "residential"],
      density: 0.72, trees: 0.3
    },
    market: {
      walls: ["#7f8c8d", "#95a5a6", "#8c7a5f", "#6d7a8c", "#a08c6a", "#7a6a8c", "#8c6a6a"],
      heights: [44, 52, 60, 66], floors: [2, 3, 3, 4],
      styles: ["shophouse", "office", "commercial", "shophouse"],
      density: 0.8, trees: 0.1
    },
    lotus: {
      walls: ["#c0392b", "#d35400", "#c9a227", "#1e8449", "#19b3c4", "#a93226", "#b9770e",
              "#8e44ad", "#2874a6", "#a04000"],
      heights: [36, 42, 48, 52], floors: [2, 2, 3, 3],
      styles: ["shophouse", "shophouse", "apartment", "shophouse"],
      density: 0.85, trees: 0.08
    },
    park: {
      walls: ["#7a8a6a", "#6a7a5f", "#8a7a5c"],
      heights: [30, 36, 42], floors: [1, 2, 2],
      styles: ["residential", "villa"],
      density: 0.2, trees: 0.6
    },
    docks: {
      walls: ["#8c6d3f", "#6d7a8c", "#7a5230", "#5f6d5f", "#8c5a4a", "#6d5a3f"],
      heights: [42, 48, 54, 58], floors: [1, 1, 2, 2],
      styles: ["warehouse", "warehouse", "industrial", "warehouse"],
      density: 0.55, trees: 0.02
    },
    industrial: {
      walls: ["#6d7a8c", "#5f6d5f", "#7a6d5f", "#8c7a6d", "#5a6d7a"],
      heights: [38, 44, 50, 56], floors: [1, 1, 2, 2],
      styles: ["industrial", "warehouse", "industrial", "warehouse"],
      density: 0.6, trees: 0.02
    }
  };

  // Enseignes par quartier
  const SIGNS = {
    lotus: ["NOUILLES", "THÉ 茶", "BAO 包", "DIM SUM", "HERBES", "K-TV",
            "PHO 88", "JADE", "WOK", "TATOU", "酒 BAR", "PERLES", "DUMPLING",
            "RIZ 飯", "TOFU", "MASSAGE", "ENCENS"],
    market: ["OUTILS", "MOTEL", "BANQUE", "LAVERIE", "PIÈCES", "TABAC",
             "FLEURS", "PRESSING", "ÉPICERIE", "QUINCAILLERIE", "VÉLOS"],
    downtown: ["ASSURANCE", "AVOCATS", "TECH", "DESIGN", "MÉDIA", "CONSEIL"],
    finance: ["BOURSE", "JADE BANK", "CRÉDIT", "FONDS", "IMPORT-EXPORT"],
    docks: ["POISSON", "FILETS", "ANCRE", "CORDE", "CHARBON", "CONTAINER"],
    industrial: ["ACIER", "BÉTON", "CHIMIE", "PLASTIQUE", "TÔLE"]
  };

  const SIGN_COLORS = ["#2ee6a8", "#ff4f9a", "#ffc857", "#7ad7ff", "#e58fb1", "#a9dfbf"];

  // Configuration de la plage (bord nord-est)
  const BEACH_CONFIG = {
    x0: 240, x1: 370, baseY: 8,
    parasols: [
      [255, 9], [268, 8.2], [280, 7.4], [293, 8.1], [305, 9.2],
      [318, 8.5], [330, 7.8], [345, 8.8], [358, 9.5]
    ],
    towels: [
      [260, 10.2], [275, 9.4], [290, 10.0], [310, 9.8], [325, 10.1],
      [340, 9.3], [355, 10.4], [365, 9.8]
    ]
  };

  // Canal + ponts
  const CANAL_CONFIG = {
    northQuay: 247,    // tuile de quai au nord du canal
    southQuay: 255,    // tuile de quai au sud
    waterY0: 248,
    waterY1: 254,
    bridges: BRIDGE_VROADS
  };

  // Échelles de quai
  const LADDER_POSITIONS = {
    canalNorth: [20, 45, 70, 95, 120, 145, 170, 195, 220, 245, 270, 295, 320, 345, 370],
    canalSouth: [25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350],
    southShore: [20, 50, 80, 110, 140, 170, 200, 230, 260, 290, 320, 350],
    piers: [[55, 375], [150, 375], [250, 375], [340, 375]]
  };

  // Spawns bateaux (garés + itinéraires PNJ)
  const BOAT_SPAWNS = [
    { type: "boat",  tx: 80,   ty: 251, a: 0,          c: "#4a6d8c" },
    { type: "skiff", tx: 190,  ty: 250, a: Math.PI,    c: "#8c4a5a" },
    { type: "boat",  tx: 310,  ty: 251, a: 0.1,        c: "#5f8c4a" },
    { type: "skiff", tx: 155,  ty: 370, a: -0.15,      c: "#3d6d99" },
    { type: "boat",  tx: 55,   ty: 370, a: 0.3,        c: "#8c6d3f" },
    { type: "boat",  tx: 290,  ty: 5,   a: Math.PI * 0.92, c: "#d0567a" },
    { type: "boat",  tx: 250,  ty: 370, a: 0.5,        c: "#5a8c6d" },
    { type: "skiff", tx: 340,  ty: 370, a: -0.3,       c: "#8c5a7a" },
    { type: "boat",  tx: 100,  ty: 251, a: Math.PI,    c: "#6d8c4a" }
  ];

  const BOAT_ROUTES = [
    { type: "skiff", c: "#7a8a6a", mode: "pingpong", cruise: 70,
      wps: [[15, 250], [80, 250], [150, 250], [220, 250], [290, 250], [360, 250]] },
    { type: "boat", c: "#2e6d8c", mode: "pingpong", cruise: 120,
      wps: [[360, 252], [280, 252], [200, 252], [120, 252], [40, 252], [15, 252]] },
    { type: "skiff", c: "#8c5a4a", mode: "loop", cruise: 60,
      wps: [[60, 370], [100, 368], [140, 370], [100, 378]] },
    { type: "skiff", c: "#6d5a8c", mode: "loop", cruise: 65,
      wps: [[180, 370], [230, 368], [280, 370], [230, 378]] },
    { type: "boat", c: "#c9a227", mode: "pingpong", cruise: 100,
      wps: [[250, 5], [290, 4], [330, 5], [360, 6]] },
    { type: "skiff", c: "#5a7a6d", mode: "loop", cruise: 55,
      wps: [[300, 370], [340, 368], [370, 370], [340, 378]] },
    { type: "boat", c: "#8c6a4a", mode: "pingpong", cruise: 90,
      wps: [[15, 253], [100, 253], [200, 253], [300, 253], [375, 253]] }
  ];

  // Pickups (santé, argent, armes) — positions en tuiles
  const PICKUPS = {
    health: [
      [110, 88], [50, 170], [170, 220], [260, 50], [320, 220],
      [80, 280], [200, 310], [35, 310], [350, 300], [170, 365],
      [285, 120], [40, 40], [330, 55], [60, 130], [240, 175],
      [150, 100], [360, 160], [25, 240], [300, 280], [190, 50]
    ],
    cash: [
      [75, 40], [130, 125], [210, 42], [305, 100], [350, 40],
      [40, 210], [95, 225], [165, 165], [255, 165], [295, 230],
      [45, 248], [170, 248], [300, 275], [75, 330], [240, 330],
      [330, 350], [60, 375], [250, 375], [155, 280], [365, 120],
      [30, 90], [120, 55], [220, 90], [340, 170], [180, 310]
    ],
    bat: [[335, 180]],
    pistol: [[45, 355]],
    smg: [[60, 377]],
    shotgun: [[155, 320]],
    armor: [[42, 125]]
  };

  // Réservations pour bâtiments spéciaux (empêche le remplissage auto)
  const RESERVATIONS = SPECIAL_BUILDINGS.map(b => ({
    x: b.tx - 1, y: b.ty - 1, w: b.tw + 2, h: b.th + 2
  }));

  // Elevation map : zones surélevées (collines)
  // Format: { x0, y0, x1, y1, elev } — elev en px de hauteur de base
  const ELEVATION_ZONES = [
    { x0: 15, y0: 15, x1: 90, y1: 65, elev: 24, label: "hills" },
    { x0: 280, y0: 160, x1: 370, y1: 240, elev: 12, label: "park_hill" }
  ];

  // Points d'intérêt (seront calculés en px par le moteur après placement)
  const POI_DEFS = {
    spawn:      { tx: 155, ty: 378 },
    teahouse:   { tx: 184, ty: 186 },
    garage:     { tx: 64,  ty: 195 },
    police:     { tx: 34,  ty: 106 },
    hospital:   { tx: 284, ty: 92  },
    hideout:    { tx: 106, ty: 297 },
    plaza:      { tx: 115, ty: 88  },
    market:     { tx: 175, ty: 195 },
    pagoda:     { tx: 320, ty: 180 },
    beach:      { tx: 300, ty: 9   },
    debarcadere:{ tx: 155, ty: 365 },
    gateN:      { tx: 180, ty: 157 },
    tower:      { tx: 73,  ty: 81  },
    casino:     { tx: 160, ty: 84  }
  };

  // Portes paifang du Quartier du Lotus
  const GATES = [
    { tx: 180, ty: 157 },  // entrée nord
    { tx: 180, ty: 244 },  // entrée sud
    { tx: 132, ty: 200 },  // entrée ouest
    { tx: 269, ty: 200 }   // entrée est
  ];

  // Configuration du parc
  const PARK_CONFIG = {
    x0: 275, y0: 160, x1: 375, y1: 240,
    pond: { cx: 330, cy: 195, rx: 18, ry: 14 },
    pagoda: { tx: 320, ty: 175, size: 4 },
    paths: [
      { axis: "h", at: 175, from: 280, to: 370 },
      { axis: "h", at: 225, from: 280, to: 370 },
      { axis: "v", at: 290, from: 165, to: 235 },
      { axis: "v", at: 360, from: 165, to: 235 },
      { axis: "v", at: 330, from: 183, to: 208 }  // ponton étang
    ],
    trees: 60, cherries: 30, benches: 12, lanterns: 8
  };

  // Textures de façade (références pour le building engine)
  const FACADE_TEXTURES = {
    brick:       { pattern: "brick",      mortar: "rgba(160,140,110,0.4)" },
    concrete:    { pattern: "concrete",   joints: "rgba(0,0,0,0.12)" },
    glass:       { pattern: "glass",      tint: "rgba(80,160,200,0.25)" },
    wood:        { pattern: "wood",       grain: "rgba(80,50,20,0.3)" },
    stucco:      { pattern: "stucco",     texture: "rgba(0,0,0,0.06)" },
    tile:        { pattern: "tile",       grout: "rgba(0,0,0,0.15)" },
    corrugated:  { pattern: "corrugated", ridge: "rgba(0,0,0,0.2)" },
    metal:       { pattern: "metal",      sheen: "rgba(255,255,255,0.08)" }
  };

  // Types de fenêtres
  const WINDOW_STYLES = {
    modern:      { frameW: 1.2, aspect: 1.6, lit: 0.35, dark: "rgba(35,58,78,0.7)" },
    traditional: { frameW: 1.8, aspect: 1.2, lit: 0.25, dark: "rgba(40,30,20,0.6)" },
    shuttered:   { frameW: 1.5, aspect: 1.0, lit: 0.2,  dark: "rgba(50,40,30,0.5)" },
    shopfront:   { frameW: 2.0, aspect: 0.7, lit: 0.5,  dark: "rgba(30,50,60,0.6)" },
    industrial:  { frameW: 1.0, aspect: 2.5, lit: 0.15, dark: "rgba(30,40,50,0.7)" },
    arched:      { frameW: 1.6, aspect: 1.4, lit: 0.3,  dark: "rgba(35,45,55,0.6)" }
  };

  // Mapping archétype → texture + fenêtres + décos
  const ARCHETYPE_CONFIG = {
    skyscraper:  { texture: "glass",      windows: "modern",      ac: false, balcony: false, antenna: true },
    office:      { texture: "concrete",   windows: "modern",      ac: true,  balcony: false, antenna: false },
    residential: { texture: "brick",      windows: "traditional", ac: true,  balcony: true,  antenna: false },
    apartment:   { texture: "concrete",   windows: "traditional", ac: true,  balcony: true,  antenna: true },
    shophouse:   { texture: "stucco",     windows: "shuttered",   ac: false, balcony: true,  antenna: false },
    villa:       { texture: "stucco",     windows: "traditional", ac: false, balcony: true,  antenna: false },
    warehouse:   { texture: "corrugated", windows: "industrial",  ac: false, balcony: false, antenna: false },
    industrial:  { texture: "metal",      windows: "industrial",  ac: false, balcony: false, antenna: false },
    commercial:  { texture: "glass",      windows: "shopfront",   ac: true,  balcony: false, antenna: false },
    civic:       { texture: "concrete",   windows: "arched",      ac: false, balcony: false, antenna: true },
    temple:      { texture: "wood",       windows: "traditional", ac: false, balcony: false, antenna: false }
  };

  // Intérieurs accessibles (layout sommaire pour les bâtiments avec interior)
  const INTERIORS = {
    teahouse: { w: 7, h: 5, floor: "#4a3020", walls: "#8a3324",
                furniture: ["counter", "tables", "shrine"] },
    garage:   { w: 7, h: 4, floor: "#4a4a4a", walls: "#6d7a8c",
                furniture: ["lift", "toolrack", "car"] },
    lobby:    { w: 5, h: 5, floor: "#2a2633", walls: "#3d5a6e",
                furniture: ["desk", "elevator", "plant"] },
    casino:   { w: 9, h: 7, floor: "#2a1a2a", walls: "#5a1a3a",
                furniture: ["tables", "bar", "stage"] },
    mall:     { w: 11, h: 7, floor: "#d8c9a8", walls: "#7f8c8d",
                furniture: ["shelves", "counter", "shelves"] },
    station:  { w: 14, h: 5, floor: "#9aa0a3", walls: "#6d7a8c",
                furniture: ["bench", "ticket", "bench"] }
  };

  G.MapData = {
    T, MW, MH, WPX, HPX,
    VROADS, HROADS, BRIDGE_VROADS,
    CANAL, CANAL_CONFIG,
    DISTRICTS,
    SPECIAL_BUILDINGS, BUILDING_PALETTES,
    SIGNS, SIGN_COLORS,
    BEACH_CONFIG,
    LADDER_POSITIONS,
    BOAT_SPAWNS, BOAT_ROUTES,
    PICKUPS,
    RESERVATIONS,
    ELEVATION_ZONES,
    POI_DEFS, GATES,
    PARK_CONFIG,
    FACADE_TEXTURES, WINDOW_STYLES,
    ARCHETYPE_CONFIG, INTERIORS
  };

})(window.G);
