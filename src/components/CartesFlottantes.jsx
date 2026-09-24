/**
 * CURSUS — Cartes flottantes, colonne gauche de la page de connexion (24/09/2026)
 * ======================================================================
 * Deuxième itération, demande détaillée de Joseph :
 *  - Pages plus colorées, plus proches de vrais livres (dégradé de
 *    couverture, tranche, reflet) — les couvertures unies plates d'avant
 *    "faisaient carte", pas livre.
 *  - Chute un peu plus rapide.
 *  - Effet de profondeur à trois plans : devant (grandes cartes, plus
 *    lentes), derrière (petites cartes, plus rapides), et tout au fond
 *    une pluie de caractères façon Matrix.
 *
 * Trois couches superposées (z-index croissant : pluie → petites cartes
 * → grandes cartes), chacune avec sa propre vitesse — c'est ce qui donne
 * l'impression de profondeur, pas une vraie perspective 3D.
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
      <text x="60" y="140" textAnchor="middle" fontFamily="'Playfair Display', Georgia, serif" fontSize="13" fill={CREME}>{titre}</text>
    </svg>
  );
}

// "Plus proche de vrais livres" — dégradé de couverture (pas un aplat),
// tranche des pages sur 2 côtés (droite + bas, façon livre fermé vu de
// 3/4), reflet diagonal clair en haut à gauche façon couverture vernie.
function CarteLivre({ catégorie, titre, couleur, icone }) {
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
      <text x="64" y="42" textAnchor="middle" fontFamily="'Playfair Display', Georgia, serif" fontSize="13" fill={CREME}>{titre}</text>
      <g transform="translate(38, 96)" fill="none" stroke={OR} strokeWidth="1.6" opacity="0.9" strokeLinecap="round">
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

const CARTES = [
  { Comp: CarteTarot, props: { chiffre: "I", titre: "L'Élan", icone: "élan" }, couleur: 0 },
  { Comp: CarteTarot, props: { chiffre: "II", titre: "Le Doute", icone: "passage" }, couleur: 1 },
  { Comp: CarteTarot, props: { chiffre: "III", titre: "Le Chapitre", icone: "double" }, couleur: 2 },
  { Comp: CarteLivre, props: { catégorie: "MANUSCRIT", titre: "En cours", icone: "vague" }, couleur: 3 },
  { Comp: CarteLivre, props: { catégorie: "ESSAI", titre: "À auditer", icone: "spirale" }, couleur: 4 },
  { Comp: CarteLivre, props: { catégorie: "RÉCIT", titre: "Premier jet", icone: "élan" }, couleur: 5 },
  { Comp: CartePapier, props: { étiquette: "NOTES", titre: "Idées éparses" }, couleur: 5 },
];

function CoucheCartes({ nombre, tailleBase, opacite, vitesseMin, vitesseMax, zIndex }) {
  const dispo = useMemo(() => Array.from({ length: nombre }, (_, i) => {
    const carte = CARTES[i % CARTES.length];
    return {
      carte,
      couleur: idCouleur(carte.couleur + i),
      gauche: `${Math.round(Math.random() * 76) + 2}%`,
      délai: +(Math.random() * vitesseMax).toFixed(1),
      durée: +(vitesseMin + Math.random() * (vitesseMax - vitesseMin)).toFixed(1),
      rotationDépart: Math.round(Math.random() * 14 - 7),
    };
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
      <CoucheCartes nombre={5} tailleBase={62} opacite={0.32} vitesseMin={9} vitesseMax={13} zIndex={2} />
      {/* Premier plan : grandes cartes, plus lentes */}
      <CoucheCartes nombre={4} tailleBase={116} opacite={0.55} vitesseMin={15} vitesseMax={20} zIndex={3} />

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
