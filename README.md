# 玉港 · JADE HARBOR — Chroniques du Lotus Noir

Un jeu d'action urbain en vue du dessus **jouable directement dans le navigateur**,
hommage à *GTA: Chinatown Wars* — avec **son propre univers, sa propre direction
artistique et son propre moteur**, écrit à 100 % en JavaScript/Canvas. Tout le
visuel et tout le son sont **générés par le code** (zéro image, zéro sprite
importé) ; seules les polices d'interface viennent d'un CDN (Google Fonts,
avec repli système intégral si hors-ligne).

> Jin débarque à Jade Harbor, une île-port quelque part entre le thé et la poudre,
> pour travailler chez son oncle Wu… dont le « salon de thé » est la façade la
> plus poreuse de tout le Quartier du Lotus.

---

## 🎮 Jouer

**Aucune installation.** Deux options :

1. **Double-cliquer sur `index.html`** — le jeu tourne en local dans n'importe
   quel navigateur récent (Chrome, Firefox, Edge, Safari). Clavier requis.
2. Ou servir le dossier :
   ```bash
   python3 -m http.server 8000
   # puis ouvrir http://localhost:8000
   ```
   (Le dépôt est aussi directement compatible **GitHub Pages** : Settings →
   Pages → branche → `/` racine.)

La progression (missions, argent, armes) est **sauvegardée automatiquement**
dans le navigateur après chaque mission.

## ⌨️ Commandes

| Touche | Action |
|---|---|
| **Z Q S D** / W A S D / flèches | Se déplacer · Conduire |
| **Maj** | Sprint |
| **E** ou Entrée | Monter/descendre d'un véhicule · Interagir |
| **Espace** | Frapper / Tirer (visée auto avec anticipation) · **Frein à main** en voiture |
| **Clic gauche** | Tirer vers la souris (y compris en conduisant : drive-by) |
| **Tab** ou **1–4** | Changer d'arme |
| **K** | Klaxon |
| **C** | Grande carte de l'île |
| **M** | Couper / activer le son |
| **Échap** / P | Pause |

## ✨ Tout y est dès la v1

### La vue et le contrôle « Chinatown Wars »
- Vue du dessus avec **bâtiments extrudés en fausse 3D** (parallaxe radiale) ;
- **la caméra pivote avec le véhicule** (la voiture pointe toujours vers le haut)
  et revient doucement au nord à pied ;
- zoom dynamique selon la vitesse, screenshake, contrôles relatifs à la caméra.

### Une île entière, dense, à explorer
7 quartiers générés de façon déterministe (la même ville pour tout le monde) :
- **Hauteurs Meridian** — le centre d'affaires, ses tours vitrées et sa grande place ;
- **Collines de Papier** — quartier résidentiel, maisons en rangées et jardins ;
- **Quartier du Lotus** — le cœur : shophouses colorées, enseignes néon, portes
  *paifang*, lanternes, grand marché couvert, et le salon de thé de Wu ;
- **Bazar de l'Ouest** — commerces et le Garage Long ;
- **Jardin des Brumes** — parc, étang, ponton et pagode dorée, cerisiers ;
- **Canal des Lanternes** — coupe l'île en deux, 5 ponts, promenade, grues, péniches ;
- **Docks de Fer + Jetée du Départ** — entrepôts, empilements de conteneurs,
  la « Pêcherie Wang »… et le ferry qui a déposé Jin.

Le tout avec trafic autonome (les voitures respectent les voies, tournent aux
intersections, freinent, paniquent aux coups de feu), piétons, voitures garées
volables, mobilier urbain, pickups cachés (santé, argent, armes, armure).

### Les systèmes de jeu
- **Véhicules** : 6 types (berline, taxi, sportive, van, pick-up, police),
  physique arcade **par les quatre coins de la caisse** (couple aux impacts,
  masses différenciées, tête-à-queue), dérive au frein à main, crissements,
  feux stop, traces de pneus, dégâts, incendie puis **explosion** avec
  débris, carjacking ;
- **Armes** : poings, batte, pistolet 9 mm, PM « Guêpe », fusil à pompe —
  **visée auto verrouillée** (lock-on généreux façon console portable, avec
  anticipation de trajectoire) ou tir libre à la souris ;
- **Une ville qui vit** : les piétons s'assoient sur les bancs, téléphonent,
  discutent par deux, pressent le pas pour traverser, se jettent au sol ou
  fuient sous les coups de feu — et les **témoins d'un crime courent alerter
  la police** (bulle « ! » : à vous de les en dissuader) ; le trafic suit
  les files, lève le pied aux intersections, klaxonne, contourne les épaves ;
- **Police / étoiles de recherche (5 niveaux)** : vision réaliste avec
  **mémoire de la dernière position connue** (les agents ratissent le secteur
  quand vous cassez la ligne de vue), **pathfinding à pied** autour des
  bâtiments, tir en rafales avec déplacements latéraux, encerclement au
  corps à corps, **interception** en voiture, **barrages routiers à 3★**,
  **hélicoptère à 4★** (impossible de se cacher sous son œil — mais il peut
  être abattu), arrestation (*busted*), hôpital (*wasted*)… et la signature
  Chinatown Wars : **neutraliser soi-même une patrouille fait retomber la
  pression** ;
- **Gangs territoriaux** : les Requins du Port rôdent sur leurs docks — et
  n'oublient pas ce que Jin leur a fait ;
- **GPS** : l'itinéraire est tracé en vert sur la minimap rotative, comme sur
  la carte de l'île ;
- **HUD complet** : minimap rotative, vie/armure, argent, étoiles, arme,
  objectifs, chronos, annonces de quartier, leçons de tutoriel contextuelles ;
- **Audio 100 % procédural** (WebAudio) : moteur, tirs, sirènes, klaxon,
  explosions, jingles, et une nappe pentatonique d'ambiance.

### Le prologue : 5 missions scénarisées (en français)
Dialogues à portraits, points de contrôle, médailles Or/Argent/Bronze,
objectifs bonus et rejouabilité :

1. **Bienvenue à Jade Harbor** — déplacement, sprint, GPS… et une embuscade
   des *Requins du Port* pour apprendre le corps à corps ;
2. **Les Caisses de l'Oncle** — voler une voiture, livraison chronométrée,
   première étoile de recherche et l'art de semer la police ;
3. **La Morsure du Requin** — le pistolet de Long, entraînement au tir,
   assaut de la planque des Requins, la mallette, et une fuite à 2 étoiles ;
4. **L'Ombre du Requin** — filature d'un van suspect (distance à tenir) puis
   assaut d'un dépôt de contrebande ;
5. **Le Convoi du Lotus** — escorte du van de Wu jusqu'à la jetée sous les
   assauts scriptés des Requins, fusil à pompe à la clé.

Toute mission terminée peut être **rejouée** depuis son marqueur pour viser
une meilleure médaille. Après le prologue : l'île est à vous (« À suivre… »).

## 🏮 Direction artistique « Encre & Néon »

Univers original : palette encre profonde / jade lumineux / or lanterne /
magenta néon, aplats saturés cerclés d'encre (cel-shading 2D), heure dorée
permanente, enseignes bilingues français-hanzi (茶, 包, 警察…). Personnages,
véhicules, ville, portraits et effets sont **dessinés par le code** au canvas —
le dépôt ne contient aucune image bitmap.

**Personnages** : système de sprites « cuits » par combinaison (8 archétypes
civils — cadre, ouvrier, vendeur, hoodie, touriste, élégante, mamie,
coursier — avec coiffures, chapeaux, lunettes et sacs variés, plus les tenues
nommées de Jin, Wu, Long et des gangs), vraie marche à 4 frames, chaque frame
n'étant dessinée qu'une fois puis réutilisée depuis un cache.

### 🖼️ Gestion des textures & résolution

Comme il n'y a aucun asset importé, la « qualité des textures » dépend
entièrement de la façon dont chaque élément est cuit sur canvas offscreen
avant d'être réutilisé à chaque frame :

- **Résolution d'écran adaptative** : le rendu vise la densité réelle de
  l'écran (Retina/HiDPI, jusqu'à 2×) pour un affichage net, mais **s'ajuste
  automatiquement à la baisse** si une scène très chargée (poursuite en
  centre-ville, nombreux véhicules) fait chuter le fps — puis remonte dès que
  la charge retombe. Qualité maximale par défaut, jamais au prix de la fluidité.
- **Véhicules** suréchantillonnés ×3 à la cuisson (auparavant en résolution
  native, seul élément non anti-aliasé du jeu) ;
- **Sol** (routes, trottoirs, marquages, passages piétons) cuit en interne à
  2× puis downscalé dans le canvas de chunk mis en cache : même empreinte
  mémoire, bien meilleur anti-aliasing des lignes et pointillés ;
- **Portraits de dialogue** suréchantillonnés ×2 ;
- **Minimap / grande carte** : bitmap source à 6 px/tuile (au lieu de 2),
  assez fin pour que la grande carte plein écran soit toujours *downscalée*
  (jamais agrandie) — donc jamais blocs, même en très grand.

## 🧩 Architecture (JS/Canvas pur, dépendance CDN unique : les polices)

```
index.html          entrée + écrans titre/commandes/chargement
css/style.css       DA de l'interface
js/util.js          maths, RNG déterministe
js/audio.js         synthèse WebAudio (SFX, sirènes, musique)
js/input.js         clavier physique (AZERTY/QWERTY auto) + souris
js/sprites.js       rendu procédural : piétons, véhicules, boîtes 2.5D, portraits
js/map.js           génération de l'île, collisions, minimap, GPS (BFS)
js/camera.js        caméra rotative, zoom, screenshake
js/entities.js      joueur, piétons, IA trafic/police, balles, pickups, particules
js/hud.js           minimap, jauges, dialogues, bannières, grande carte
js/missions.js      moteur de missions + le prologue (3 missions)
js/game.js          monde : boucle de simulation, spawns, wanted, sauvegarde
js/main.js          bootstrap, boucle à pas fixe (60 Hz), pause
```

Le moteur simule à pas fixe (60 Hz), pré-rend le sol par *chunks* avec cache
LRU, trie les bâtiments par distance caméra pour l'occlusion 2.5D, et tient
60 fps dans Chromium en 1280×720.

---

*v1.0 — moteur, univers et code originaux. Hommage assumé aux jeux d'action
urbains portables.*
