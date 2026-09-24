/**
 * CURSUS — Cartes flottantes, colonne gauche de la page de connexion (24/09/2026)
 * ======================================================================
 * Troisième itération, demande de Joseph avec planche de référence
 * ("bien plus représentatif de la production de CursEdit et Decision") :
 * la première itération ne montrait que des livres génériques (I/II/III,
 * "En cours", "À auditer") — celle-ci élargit le contenu à ce que Cursus
 * produit réellement :
 *  - des couvertures de manuscrit CursEdit (récit, essai, carnet) ;
 *  - des couvertures d'essai façon croquis (icône centrale + titre) ;
 *  - des couvertures de livrable CursDecision (diagnostic, stratégie,
 *    analyse des besoins) ;
 *  - des pages d'analyse CursDecision (barres, courbe, réseau d'acteurs) ;
 *  - des cartes façon tarot reprenant le vocabulaire de décision de la
 *    planche fournie (Le Chemin, L'Ancrage, La Transformation, La
 *    Clarté, Les Possibles).
 *
 * ÉCART ASSUMÉ : la planche fournie est une illustration IA détaillée
 * (couvertures peintes, textures de cuir, photos) ; ceci reste du SVG
 * abstrait au trait, dans la continuité du choix déjà fait pour cette
 * scène ("chargement beaucoup plus léger", pas d'images raster). Même
 * mécanique d'animation que la version précédente (deux plans de
 * profondeur + pluie Matrix) — seul le CONTENU des cartes change.
 *
 * Sélection aléatoire (pas juste `i % CARTES.length`) pour que le pool
 * élargi soit vraiment visible : avec l'ancien index séquentiel, les
 * dernières entrées du tableau n'apparaissaient quasiment jamais.
 */

import { useMemo } from "react";

const OR = "#C4973A";
const CREME = "#F7F4EF";

const ICONES = {
  élan: <path d="M32 14 C 44 14 44 30 32 34 C 20 38 20 50 32 50" />,
  passage: <path d="M18 46 V30 C18 18 46 18 46 30 V46" />,
  vague: <path d="M14 36 C 22 24 26 24 34 36 C 42 48 46 48 54 36" />,
  double: <path d="M16 30 C 24 20 32 20 40 30 M20 42 C 28 32 36 32 44 42" />,
  spirale: <circle cx="32" cy="32" r="14" />,
  chemin: <path d="M14 50 C 20 40 14 32 24 26 C 34 20 28 10 38 4" />,
  montagne: <path d="M4 42 L20 14 L30 30 L42 6 L58 42" />,
  arbre: <path d="M32 14 V36 M32 20 C 24 16 20 10 16 6 M32 20 C 40 16 44 10 48 6 M32 36 C 24 40 20 46 16 52 M32 36 C 40 40 44 46 48 52" />,
  soleil: <>
    <circle cx="32" cy="30" r="10" />
    <path d="M32 6 V12 M32 48 V54 M8 30 H14 M50 30 H56 M15 13 L19 17 M45 43 L49 47 M49 13 L45 17 M19 43 L15 47" />
  </>,
  boussole: <>
    <circle cx="32" cy="30" r="16" />
    <path d="M32 18 L38 30 L32 42 L26 30 Z" />
  </>,
};

// Palette élargie (24/09/2026, "plus colorées") — garde les trois couleurs
// de marque (bordeaux/bleu marine/vert) et leur ajoute des teintes
// voisines de la même famille chaude/littéraire, pas des couleurs criardes.
const PALETTE = [
  { base: "#8B2635", sombre: "#5E1A24" }, // bordeaux CursEdit
  { base: "#0E3374", sombre: "#092350" }, // bleu marine CursAudit
  { base: "#0E7256", sombre: "#094D3A" }, // vert CursDecision
  { base: "#A6432D", sombre: "#742D1E" }, // rouge brique
  { base: "#5B3161", sombre: "#3C2042" }, // prune
  { base: "#B8863B", sombre: "#8A6427" }, // moutarde
];

function idCouleur(i) { return PALETTE[i % PALETTE.length]; }

function CarteTarot({ chiffre, titre, couleur, icone }) {
  const id = `tarotGrad${chiffre}${couleur.base}`;
  return (
    <svg viewBox="0 0 120 168" width="120" height="168">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={couleur.base} />
          <stop offset="100%" stopColor={couleur.sombre} />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="116" height="164" rx="10" fill={`url(#${id})`} />
      <rect x="7" y="7" width="106" height="154" rx="7" fill="none" stroke={OR} strokeWidth="1" opacity="0.75" />
      <text x="60" y="26" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fill={OR} opacity="0.9">{chiffre}</text>
      <g transform="translate(28, 46)" fill="none" stroke={OR} strokeWidth="1.6" opacity="0.95" strokeLinecap="round">
        {ICONES[icone]}
      </g>
      <text x="60" y="140" textAnchor="middle" fontFamily="'Playfair Display', Georgia, serif" fontSize="11.5" fill={CREME}>{titre}</text>
    </svg>
  );
}

// "Plus proche de vrais livres" — dégradé de couverture (pas un aplat),
// tranche des pages sur 2 côtés (droite + bas, façon livre fermé vu de
// 3/4), reflet diagonal clair en haut à gauche façon couverture vernie.
function CarteLivre({ catégorie, lignes, couleur, icone }) {
  const id = `livreGrad${catégorie}${couleur.base}`;
  return (
    <svg viewBox="0 0 120 168" width="120" height="168">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={couleur.base} />
          <stop offset="100%" stopColor={couleur.sombre} />
        </linearGradient>
      </defs>
      {/* Tranche des pages (droite + bas) */}
      <rect x="8" y="6" width="108" height="160" rx="3" fill="#F3E9D2" />
      <rect x="4" y="2" width="108" height="160" rx="4" fill={`url(#${id})`} />
      <rect x="4" y="2" width="10" height="160" rx="2" fill="#000" opacity="0.18" />
      {/* Reflet façon couverture vernie */}
      <polygon points="14,2 60,2 20,90 14,90" fill="#fff" opacity="0.08" />
      <text x="64" y="24" textAnchor="middle" fontFamily="Georgia, serif" fontSize="8" letterSpacing="1.5" fill={OR} opacity="0.9">{catégorie}</text>
      {lignes.map((ligne, i) => (
        <text key={i} x="64" y={40 + i * 15} textAnchor="middle" fontFamily="'Playfair Display', Georgia, serif" fontSize="12" fill={CREME}>
          {ligne}
        </text>
      ))}
      <g transform={`translate(38, ${98 + (lignes.length - 1) * 10})`} fill="none" stroke={OR} strokeWidth="1.6" opacity="0.9" strokeLinecap="round">
        {ICONES[icone]}
      </g>
    </svg>
  );
}

function CartePapier({ étiquette, titre, couleur }) {
  return (
    <svg viewBox="0 0 120 150" width="120" height="150">
      <rect x="2" y="2" width="116" height="146" rx="3" fill={CREME} stroke="#00000012" />
      <rect x="10" y="10" width="14" height="14" rx="3" fill={couleur.base} opacity="0.9" />
      <text x="34" y="20" fontFamily="Georgia, serif" fontSize="8" letterSpacing="1" fill="#6B5D52">{étiquette}</text>
      <text x="10" y="40" fontFamily="'Playfair Display', Georgia, serif" fontSize="12.5" fill="#2C1810">{titre}</text>
      {[58, 70, 82, 94].map((y) => (
        <path key={y} d={`M10 ${y} H${y % 2 === 0 ? 96 : 78}`} stroke="#2C181022" strokeWidth="2" strokeLinecap="round" />
      ))}
    </svg>
  );
}

// Couverture d'essai façon croquis (24/09/2026) — fond crème, icône au
// trait centrée, titre en dessous : reprend l'esprit des couvertures
// "Les chemins de l'invisible" / "Le langage du vivant" de la planche
// fournie (illustration simple + titre littéraire), en abstrait.
function CarteCroquis({ lignes, icone, couleur }) {
  return (
    <svg viewBox="0 0 120 168" width="120" height="168">
      <rect x="2" y="2" width="116" height="164" rx="6" fill={CREME} stroke="#00000014" />
      <rect x="7" y="7" width="106" height="154" rx="4" fill="none" stroke={couleur.base} strokeWidth="1" opacity="0.3" />
      <g transform="translate(28, 26)" fill="none" stroke={couleur.base} strokeWidth="1.6" opacity="0.85" strokeLinecap="round">
        {ICONES[icone]}
      </g>
      {lignes.map((ligne, i) => (
        <text key={i} x="60" y={128 + i * 15} textAnchor="middle" fontFamily="'Playfair Display', Georgia, serif" fontSize="11" fill="#2C1810">
          {ligne}
        </text>
      ))}
      <line x1="34" y1="150" x2="86" y2="150" stroke={couleur.base} strokeWidth="0.75" opacity="0.4" />
    </svg>
  );
}

// Couverture de livrable CursDecision (24/09/2026) — fond clair, repère
// "plume" Cursus, bandeau de couleur en pied : reprend les couvertures
// "Diagnostic organisationnel" / "Stratégie & Développement" de la
// planche fournie.
function CarteRapport({ lignes, sousTitre, couleur }) {
  return (
    <svg viewBox="0 0 120 168" width="120" height="168">
      <rect x="2" y="2" width="116" height="164" rx="6" fill="#FDFBF6" stroke="#00000014" />
      <g transform="translate(12,14)" fill="none" stroke={couleur.base} strokeWidth="1.8" strokeLinecap="round">
        <path d="M6 2 C11 2 11 9 6 10.5 C1 12 1 18 6 19" />
      </g>
      {lignes.map((ligne, i) => (
        <text key={i} x="12" y={46 + i * 15} fontFamily="Georgia, serif" fontSize="11.5" fontWeight="600" fill="#2C1810">
          {ligne}
        </text>
      ))}
      <rect x="2" y="138" width="116" height="28" fill={couleur.base} />
      <rect x="2" y="138" width="116" height="3" fill={couleur.sombre} />
      <text x="12" y="156" fontFamily="Georgia, serif" fontSize="7.5" fill={CREME}>{sousTitre}</text>
    </svg>
  );
}

// Page d'analyse CursDecision (24/09/2026) — barres, courbe ou réseau
// d'acteurs : reprend "Résultats et tendances" / "Analyse comparative" /
// "Cartographie des acteurs" de la planche fournie.
function CarteGraphique({ titre, type, couleur }) {
  return (
    <svg viewBox="0 0 120 168" width="120" height="168">
      <rect x="2" y="2" width="116" height="164" rx="6" fill="#fff" stroke="#00000014" />
      <text x="12" y="22" fontFamily="Georgia, serif" fontSize="9" fontWeight="600" fill="#2C1810">{titre}</text>
      <line x1="12" y1="30" x2="108" y2="30" stroke="#00000012" strokeWidth="1" />
      <g transform="translate(14, 40)">
        {type === "barres" && [10, 24, 16, 30, 20, 34].map((h, i) => (
          <rect key={i} x={i * 16} y={70 - h} width="10" height={h} rx="1.5" fill={couleur.base} opacity={0.5 + i * 0.08} />
        ))}
        {type === "lignes" && (
          <>
            <polyline points="0,58 15,42 30,48 45,20 60,30 75,8 90,16" fill="none" stroke={couleur.base} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            {[[0, 58], [15, 42], [30, 48], [45, 20], [60, 30], [75, 8], [90, 16]].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="2" fill={couleur.base} />
            ))}
          </>
        )}
        {type === "reseau" && (
          <>
            {[[0, 10], [60, 0], [85, 25], [60, 55], [15, 50], [5, 30]].map(([x, y], i) => (
              <line key={i} x1="42" y1="28" x2={x} y2={y} stroke={couleur.base} strokeWidth="1" opacity="0.5" />
            ))}
            <circle cx="42" cy="28" r="7" fill={couleur.base} />
            {[[0, 10], [60, 0], [85, 25], [60, 55], [15, 50], [5, 30]].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="4" fill={couleur.base} opacity="0.6" />
            ))}
          </>
        )}
      </g>
    </svg>
  );
}

const CARTES = [
  // Tarot — vocabulaire de décision (planche fournie : Le Chemin,
  // L'Ancrage, La Transformation, La Clarté, Les Possibles)
  { Comp: CarteTarot, props: { chiffre: "I", titre: "Le Chemin", icone: "chemin" }, couleur: 1 },
  { Comp: CarteTarot, props: { chiffre: "II", titre: "L'Ancrage", icone: "arbre" }, couleur: 2 },
  { Comp: CarteTarot, props: { chiffre: "III", titre: "La Transformation", icone: "vague" }, couleur: 0 },
  { Comp: CarteTarot, props: { chiffre: "IV", titre: "La Clarté", icone: "soleil" }, couleur: 5 },
  { Comp: CarteTarot, props: { chiffre: "V", titre: "Les Possibles", icone: "boussole" }, couleur: 4 },

  // Manuscrits CursEdit en cours
  { Comp: CarteLivre, props: { catégorie: "RÉCIT", lignes: ["Fragments", "d'une époque"], icone: "vague" }, couleur: 3 },
  { Comp: CarteLivre, props: { catégorie: "ESSAI", lignes: ["Penser", "autrement"], icone: "double" }, couleur: 2 },
  { Comp: CarteLivre, props: { catégorie: "CARNET", lignes: ["Horizons", "intérieurs"], icone: "montagne" }, couleur: 1 },
  { Comp: CarteLivre, props: { catégorie: "RÉCIT", lignes: ["L'art", "des liens"], icone: "double" }, couleur: 0 },

  // Essais façon croquis
  { Comp: CarteCroquis, props: { lignes: ["Les chemins", "de l'invisible"], icone: "chemin" }, couleur: 1 },
  { Comp: CarteCroquis, props: { lignes: ["Le langage", "du vivant"], icone: "arbre" }, couleur: 2 },
  { Comp: CarteCroquis, props: { lignes: ["La mémoire", "des lieux"], icone: "arbre" }, couleur: 5 },

  // Livrables CursDecision
  { Comp: CarteRapport, props: { lignes: ["Diagnostic", "organisationnel"], sousTitre: "Analyse et recommandations" }, couleur: 1 },
  { Comp: CarteRapport, props: { lignes: ["Stratégie &", "Développement"], sousTitre: "Plan d'action" }, couleur: 2 },
  { Comp: CarteRapport, props: { lignes: ["Analyse des", "besoins"], sousTitre: "Plan qualitatif et quantitatif" }, couleur: 0 },

  // Pages d'analyse CursDecision
  { Comp: CarteGraphique, props: { titre: "Résultats et tendances", type: "barres" }, couleur: 1 },
  { Comp: CarteGraphique, props: { titre: "Analyse comparative", type: "lignes" }, couleur: 2 },
  { Comp: CarteGraphique, props: { titre: "Cartographie des acteurs", type: "reseau" }, couleur: 5 },

  // Notes manuscrites
  { Comp: CartePapier, props: { étiquette: "NOTES", titre: "Idées éparses" }, couleur: 5 },
  { Comp: CartePapier, props: { étiquette: "BROUILLON", titre: "Proposition de projet" }, couleur: 3 },
];

function CoucheCartes({ nombre, tailleBase, opacite, vitesseMin, vitesseMax, zIndex }) {
  const dispo = useMemo(() => Array.from({ length: nombre }, () => {
    const carte = CARTES[Math.floor(Math.random() * CARTES.length)];
    return {
      carte,
      couleur: idCouleur(carte.couleur + Math.floor(Math.random() * PALETTE.length)),
      gauche: `${Math.round(Math.random() * 76) + 2}%`,
      délai: +(Math.random() * vitesseMax).toFixed(1),
      durée: +(vitesseMin + Math.random() * (vitesseMax - vitesseMin)).toFixed(1),
      rotationDépart: Math.round(Math.random() * 14 - 7),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [nombre, vitesseMin, vitesseMax]);

  return (
    <div className="cartes-couche" style={{ opacity: opacite, zIndex }}>
      {dispo.map((d, i) => {
        const { Comp, props } = d.carte;
        return (
          <div
            key={i}
            className="carte-flottante"
            style={{
              left: d.gauche,
              width: tailleBase,
              animationDelay: `${d.délai}s`,
              animationDuration: `${d.durée}s`,
              // eslint-disable-next-line
              "--rot-depart": `${d.rotationDépart}deg`,
            }}
          >
            <Comp {...props} couleur={d.couleur} />
          </div>
        );
      })}
    </div>
  );
}

const CARACTERES_MATRIX = "ABCDEFGHIJKLMNOPQRSTUVWXYZ01アイウエオカキク";

function chaîneAléatoire(longueur) {
  let s = "";
  for (let i = 0; i < longueur; i++) s += CARACTERES_MATRIX[Math.floor(Math.random() * CARACTERES_MATRIX.length)];
  return s;
}

// Effet "pluie Matrix" tout au fond, derrière les cartes — demande
// explicite ("dans le fond un effet matrice de Matrix avec des lettres").
// Teinte verte assourdie pour rester dans le registre de l'app plutôt
// qu'un vert néon agressif.
function PluieMatrix() {
  const colonnes = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    gauche: `${i * 6.4 + Math.random() * 2}%`,
    texte: chaîneAléatoire(26),
    durée: +(3.2 + Math.random() * 3.5).toFixed(1),
    délai: +(Math.random() * 6).toFixed(1),
  })), []);
  return (
    <div className="matrix-pluie" aria-hidden="true">
      {colonnes.map((c, i) => (
        <div
          key={i}
          className="matrix-colonne"
          style={{ left: c.gauche, animationDuration: `${c.durée}s`, animationDelay: `${c.délai}s` }}
        >
          {c.texte}
        </div>
      ))}
    </div>
  );
}

export default function CartesFlottantes() {
  return (
    <div className="cartes-scene" aria-hidden="true">
      <PluieMatrix />
      {/* Arrière-plan : petites cartes, rapides */}
      <CoucheCartes nombre={7} tailleBase={62} opacite={0.32} vitesseMin={9} vitesseMax={13} zIndex={2} />
      {/* Premier plan : grandes cartes, plus lentes */}
      <CoucheCartes nombre={5} tailleBase={116} opacite={0.55} vitesseMin={15} vitesseMax={20} zIndex={3} />

      <style>{`
        .cartes-scene {
          position: relative;
          width: 100%; height: 100%;
          overflow: hidden;
        }
        .matrix-pluie {
          position: absolute; inset: 0; z-index: 1; overflow: hidden;
        }
        .matrix-colonne {
          position: absolute; top: -60%;
          writing-mode: vertical-lr;
          font-family: 'JetBrains Mono', ui-monospace, 'Courier New', monospace;
          font-size: 13px; letter-spacing: 4px;
          color: #3F7A5A;
          opacity: 0.4;
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 30%, black 75%, transparent 100%);
          mask-image: linear-gradient(to bottom, transparent 0%, black 30%, black 75%, transparent 100%);
          animation-name: matrix-tombe;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes matrix-tombe {
          from { transform: translateY(-10%); }
          to   { transform: translateY(160vh); }
        }
        .cartes-couche {
          position: absolute; inset: 0;
        }
        .carte-flottante {
          position: absolute;
          top: -220px;
          animation-name: carte-tombe;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform, opacity;
        }
        .carte-flottante svg { display: block; width: 100%; height: auto; filter: drop-shadow(0 6px 12px rgba(44,24,16,0.14)); }
        @keyframes carte-tombe {
          0%   { transform: translateY(0) rotate(var(--rot-depart, -6deg)); opacity: 0; }
          8%   { opacity: 1; }
          50%  { transform: translateY(50vh) rotate(calc(var(--rot-depart, -6deg) * -0.6)); }
          92%  { opacity: 1; }
          100% { transform: translateY(calc(100vh + 220px)) rotate(var(--rot-depart, -6deg)); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
