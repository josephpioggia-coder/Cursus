/**
 * CURSUS — Cartes flottantes, colonne gauche de la page de connexion (24/09/2026)
 * ======================================================================
 * Quatrième itération, demande de Joseph avec planche de référence
 * ("bien plus représentatif de la production de CursEdit et Decision").
 *
 * REPRISE COMPLÈTE (24/09/2026, suite) — trois défauts précis remontés
 * sur la version précédente, corrigés ici :
 *  1. "trop de livres identiques" — le tirage précédent était un pur
 *     `Math.random()` sur un pool de 18 entrées avec remise : avec 12
 *     cartes affichées en même temps, les doublons visibles étaient
 *     quasi garantis. Remplacé par un SAC MÉLANGÉ (Fisher-Yates, sans
 *     remise tant que le sac n'est pas épuisé) par couche, et le pool
 *     est passé à plus de 30 entrées.
 *  2. "trop de livres fermés... les livres doivent avoir une couverture
 *     comme les modèles présentés et pas comme ceux que tu reprends qui
 *     ressemblent à des cartes" — le rendu précédent (CarteLivre) posait
 *     juste une icône au trait + 2 lignes de texte sur un aplat dégradé :
 *     illisible comme "couverture illustrée". Remplacé par de vraies
 *     PETITES SCÈNES vectorielles (colline+maison+reflet, ville de nuit
 *     + silhouettes, montagnes+étoiles, arbre+racines, mosaïque de
 *     blocs colorés...) occupant l'essentiel de la couverture, avec un
 *     bandeau-titre opaque en pied — la grammaire visuelle d'une vraie
 *     couverture de livre (illustration + bandeau), pas d'une carte à
 *     jouer.
 *  3. "il manque les cartes d'oracles" — les 5 cartes tarot existaient
 *     déjà (Le Chemin, L'Ancrage, La Transformation, La Clarté, Les
 *     Possibles, vocabulaire de la planche fournie) mais avec la même
 *     icône au trait sur aplat que les livres : invisibles comme
 *     "oracle". Chacune a maintenant sa propre petite scène (lune sur
 *     les montagnes, arbre et ses racines, héron sur l'eau, soleil
 *     rayonnant, boussole sur une carte) pour vraiment lire comme un
 *     jeu d'oracle.
 *  4. Rapports pro (CursDecision) : gardés (CarteRapport/CarteGraphique)
 *     et le pool élargi (2 rapports et 2 pages d'analyse de plus) pour
 *     qu'ils sortent aussi souvent que le reste dans le sac mélangé.
 *
 * ÉCART ASSUMÉ (inchangé) : la planche fournie est une illustration IA
 * détaillée (couvertures peintes, textures de cuir, photos) ; ceci
 * reste du SVG vectoriel (pas d'images raster, chargement léger) — mais
 * poussé nettement plus loin dans le sens de la planche (scènes plutôt
 * qu'une icône isolée).
 */

import { useMemo } from "react";

const OR = "#C4973A";
const CREME = "#F7F4EF";

// Palette élargie — trois couleurs de marque (bordeaux/bleu marine/vert)
// + teintes voisines de la même famille chaude/littéraire.
const PALETTE = [
  { base: "#8B2635", sombre: "#5E1A24" }, // bordeaux CursEdit
  { base: "#0E3374", sombre: "#092350" }, // bleu marine CursAudit
  { base: "#0E7256", sombre: "#094D3A" }, // vert CursDecision
  { base: "#A6432D", sombre: "#742D1E" }, // rouge brique
  { base: "#5B3161", sombre: "#3C2042" }, // prune
  { base: "#B8863B", sombre: "#8A6427" }, // moutarde
];

function idCouleur(i) { return PALETTE[i % PALETTE.length]; }

// ————————————————————————————————————————————————————————————————
// Petites scènes réutilisables (couverture de livre ET cartes oracle) —
// chaque scène reçoit `id` (dérivé du contenu, donc stable et sans
// collision : deux cartes identiques partagent le même gradient, deux
// cartes différentes ont des id différents) et `couleur`.
// ————————————————————————————————————————————————————————————————

// Colline + maison + reflet dans l'eau, ciel dégradé à l'aube.
function SceneCollines({ id, couleur }) {
  return (
    <g>
      <defs>
        <linearGradient id={`ciel${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CREME} />
          <stop offset="100%" stopColor={`${couleur.base}55`} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="112" height="112" fill={`url(#ciel${id})`} />
      <path d="M4 78 C 30 58 46 70 62 60 C 82 48 100 62 116 54 V116 H4 Z" fill={couleur.base} opacity="0.85" />
      <path d="M4 92 C 26 78 50 86 70 76 C 90 68 104 78 116 72 V116 H4 Z" fill={couleur.sombre} />
      <rect x="52" y="60" width="16" height="14" fill={CREME} opacity="0.95" />
      <polygon points="50,60 60,50 70,60" fill={couleur.sombre} />
      <rect x="57" y="65" width="5" height="9" fill={couleur.sombre} opacity="0.7" />
      <rect x="4" y="98" width="112" height="18" fill={couleur.sombre} opacity="0.5" />
    </g>
  );
}

// Arbre et ses racines visibles, esquisse au trait (comme "Le langage du vivant").
// `clair` : version en tons clairs (crème/or) pour un fond sombre —
// sans lui, les branches en couleur.sombre devenaient quasi invisibles
// sur le fond nuit de la carte oracle "L'Ancrage" (repéré en debug grid).
function SceneArbreRacines({ id, couleur, fond = CREME, monochrome = false, clair = false }) {
  const traitBranches = clair ? CREME : (monochrome ? couleur.base : couleur.sombre);
  const traitRacines = clair ? OR : couleur.base;
  return (
    <g>
      <rect x="4" y="4" width="112" height="112" fill={fond} />
      <line x1="10" y1="60" x2="110" y2="60" stroke={clair ? OR : couleur.base} strokeWidth="0.75" opacity="0.5" />
      <g fill="none" stroke={traitBranches} strokeWidth="2" strokeLinecap="round">
        <path d="M60 60 V30" />
        <path d="M60 40 C 48 32 42 24 38 14 M60 36 C 72 28 78 20 82 12 M60 30 C 54 24 52 18 50 10 M60 30 C 66 24 68 18 70 10" />
      </g>
      {!monochrome && <circle cx="60" cy="20" r="16" fill={clair ? OR : couleur.base} opacity={clair ? 0.35 : 0.22} />}
      <g fill="none" stroke={traitRacines} strokeWidth="1.6" strokeLinecap="round" opacity="0.85">
        <path d="M60 60 C 52 68 46 74 36 78 M60 60 C 68 68 74 74 84 78 M60 60 C 56 72 54 82 50 92 M60 60 C 64 72 66 82 70 92" />
      </g>
    </g>
  );
}

// Silhouette de ville la nuit, deux passants, réverbère.
function SceneVille({ id, couleur }) {
  const immeubles = [
    { x: 8, w: 14, h: 40 }, { x: 24, w: 10, h: 60 }, { x: 36, w: 16, h: 34 },
    { x: 54, w: 12, h: 52 }, { x: 68, w: 18, h: 44 }, { x: 88, w: 14, h: 64 },
    { x: 104, w: 10, h: 30 },
  ];
  return (
    <g>
      <defs>
        <linearGradient id={`nuit${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={couleur.sombre} />
          <stop offset="100%" stopColor="#1A1210" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="112" height="112" fill={`url(#nuit${id})`} />
      <circle cx="94" cy="24" r="7" fill={CREME} opacity="0.85" />
      {immeubles.map((im, i) => (
        <rect key={i} x={im.x} y={116 - im.h} width={im.w} height={im.h} fill={couleur.base} opacity="0.75" />
      ))}
      <line x1="4" y1="116" x2="116" y2="116" stroke={OR} strokeWidth="1" opacity="0.4" />
      <line x1="30" y1="78" x2="30" y2="116" stroke={OR} strokeWidth="1.4" opacity="0.7" />
      <circle cx="30" cy="76" r="3" fill={OR} opacity="0.9" />
      <g stroke={CREME} strokeWidth="1.6" strokeLinecap="round" opacity="0.75">
        <path d="M50 116 V104 M50 104 L44 110 M50 104 L56 110" />
        <circle cx="50" cy="99" r="2.6" fill={CREME} stroke="none" />
        <path d="M64 116 V106 M64 106 L59 112 M64 106 L69 111" />
        <circle cx="64" cy="101" r="2.4" fill={CREME} stroke="none" />
      </g>
    </g>
  );
}

// Mosaïque de blocs colorés — abstrait, comme "Penser autrement".
function SceneBlocs({ id, couleur }) {
  const blocs = [
    { x: 4, y: 4, w: 40, h: 36, c: couleur.base },
    { x: 44, y: 4, w: 34, h: 20, c: "#EADFCB" },
    { x: 78, y: 4, w: 38, h: 52, c: couleur.sombre },
    { x: 44, y: 24, w: 34, h: 32, c: "#7FA9AE" },
    { x: 4, y: 40, w: 40, h: 30, c: "#EADFCB" },
    { x: 78, y: 56, w: 38, h: 22, c: couleur.base },
    { x: 4, y: 70, w: 40, h: 46, c: couleur.sombre },
    { x: 44, y: 56, w: 34, h: 60, c: couleur.base },
    { x: 78, y: 78, w: 38, h: 38, c: "#7FA9AE" },
  ];
  return (
    <g>
      <rect x="4" y="4" width="112" height="112" fill={CREME} />
      {blocs.map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={b.c} opacity="0.88" />)}
    </g>
  );
}

// Montagnes superposées, étoiles, fin croissant de lune.
function SceneMontagnesEtoiles({ id, couleur }) {
  const étoiles = [[14, 18], [30, 10], [50, 22], [70, 12], [90, 20], [104, 14], [22, 30], [98, 32]];
  return (
    <g>
      <defs>
        <linearGradient id={`nuit2${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={couleur.sombre} />
          <stop offset="100%" stopColor="#0B0F1A" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="112" height="112" fill={`url(#nuit2${id})`} />
      {étoiles.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1" fill={CREME} opacity="0.8" />)}
      <path d="M92 18 A8 8 0 1 1 88 16.5 A6.2 6.2 0 1 0 92 18 Z" fill={CREME} opacity="0.9" />
      <path d="M4 82 L26 50 L42 68 L60 38 L80 66 L96 46 L116 76 V116 H4 Z" fill={couleur.base} opacity="0.55" />
      <path d="M4 96 L30 72 L50 86 L74 60 L96 84 L116 68 V116 H4 Z" fill={couleur.sombre} />
    </g>
  );
}

// Lune pleine sur une ligne de montagnes — "Le Chemin".
function SceneLuneMontagnes({ id, couleur }) {
  return (
    <g>
      <defs>
        <radialGradient id={`lune${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={CREME} />
          <stop offset="100%" stopColor="#E7D9B8" />
        </radialGradient>
        <linearGradient id={`cielnuit${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#141A2E" />
          <stop offset="100%" stopColor={couleur.sombre} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="112" height="112" fill={`url(#cielnuit${id})`} />
      <circle cx="60" cy="40" r="20" fill={`url(#lune${id})`} opacity="0.95" />
      <path d="M4 90 L24 60 L40 76 L60 48 L82 74 L100 58 L116 82 V116 H4 Z" fill={couleur.base} opacity="0.85" />
      <path d="M4 104 L30 84 L54 96 L76 76 L96 92 L116 80 V116 H4 Z" fill={couleur.sombre} />
    </g>
  );
}

// Héron immobile au bord de l'eau, cercles concentriques — "La Transformation".
// Héron debout au bord de l'eau, silhouette pleine (pas juste un trait) —
// repris en plus grand et plus contrasté après vérification en debug
// grid : la version précédente (fine ligne + petite ellipse) se lisait
// mal, pas franchement comme un oiseau.
function SceneHeronEau({ id, couleur }) {
  return (
    <g>
      <defs>
        <linearGradient id={`eauciel${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`${couleur.base}33`} />
          <stop offset="100%" stopColor={CREME} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="112" height="112" fill={`url(#eauciel${id})`} />
      <rect x="4" y="86" width="112" height="30" fill={couleur.base} opacity="0.2" />
      {[[34, 100, 9], [34, 100, 16], [86, 106, 7], [86, 106, 13]].map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={couleur.base} strokeWidth="0.8" opacity="0.4" />
      ))}
      {/* Corps ovale + cou en S (trait épais) + tête + bec : lu comme un
          oiseau debout plutôt qu'une forme abstraite. */}
      <ellipse cx="60" cy="86" rx="7.5" ry="13" fill={couleur.sombre} />
      <path d="M59 74 C 54 66 55 56 46 46 C 42 41 42 35 46 31" fill="none" stroke={couleur.sombre} strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="47" cy="29" r="3.4" fill={couleur.sombre} />
      <path d="M44 28 L32 25" stroke={couleur.sombre} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="48.5" cy="28" r="0.8" fill={CREME} />
      {/* Pattes, fines, ancrées dans l'eau */}
      <g stroke={couleur.sombre} strokeWidth="2" strokeLinecap="round">
        <path d="M56 96 L52 112" />
        <path d="M64 96 L68 112" />
      </g>
    </g>
  );
}

// Soleil rayonnant, halo dégradé — "La Clarté".
function SceneSoleilRayons({ id, couleur }) {
  return (
    <g>
      <defs>
        <radialGradient id={`soleil${id}`} cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#FFF6DE" />
          <stop offset="60%" stopColor={couleur.base} />
          <stop offset="100%" stopColor={couleur.sombre} />
        </radialGradient>
      </defs>
      <rect x="4" y="4" width="112" height="112" fill={`url(#soleil${id})`} />
      <circle cx="60" cy="50" r="16" fill="#FFF6DE" opacity="0.95" />
      <g stroke="#FFF6DE" strokeWidth="2" strokeLinecap="round" opacity="0.85">
        <path d="M60 18 V26 M60 74 V82 M28 50 H36 M84 50 H92 M38 28 L44 34 M76 66 L82 72 M82 28 L76 34 M44 66 L38 72" />
      </g>
      <path d="M4 100 C 30 92 46 104 60 96 C 78 86 96 100 116 92 V116 H4 Z" fill={couleur.sombre} opacity="0.5" />
    </g>
  );
}

// Boussole posée sur une carte (contours pointillés) — "Les Possibles".
function SceneBoussoleCarte({ id, couleur }) {
  return (
    <g>
      <rect x="4" y="4" width="112" height="112" fill={CREME} />
      <g stroke={couleur.base} strokeWidth="0.75" strokeDasharray="2 3" opacity="0.4" fill="none">
        <path d="M10 30 C 40 20 60 40 96 26" />
        <path d="M14 60 C 46 50 70 68 110 56" />
        <path d="M10 90 C 44 82 66 98 108 88" />
      </g>
      <circle cx="60" cy="58" r="30" fill="none" stroke={couleur.base} strokeWidth="1.4" opacity="0.85" />
      <circle cx="60" cy="58" r="22" fill="none" stroke={couleur.base} strokeWidth="0.8" opacity="0.5" />
      <path d="M60 58 L67 46 L60 34 L53 46 Z" fill={couleur.sombre} />
      <path d="M60 58 L67 70 L60 82 L53 70 Z" fill={couleur.base} opacity="0.65" />
      <circle cx="60" cy="58" r="3" fill={OR} />
      <text x="60" y="24" textAnchor="middle" fontFamily="Georgia, serif" fontSize="8" fill={couleur.base} opacity="0.8">N</text>
    </g>
  );
}

// Vagues douces / dunes, dégradé chaud — variante nature générique.
function SceneVagueDouce({ id, couleur }) {
  return (
    <g>
      <defs>
        <linearGradient id={`vague${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CREME} />
          <stop offset="100%" stopColor={`${couleur.base}44`} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="112" height="112" fill={`url(#vague${id})`} />
      {[70, 84, 98].map((y, i) => (
        <path key={i} d={`M4 ${y} C 30 ${y - 12} 50 ${y + 10} 76 ${y - 6} C 96 ${y - 16} 108 ${y + 4} 116 ${y - 4} V116 H4 Z`}
          fill={i === 2 ? couleur.sombre : couleur.base} opacity={0.4 + i * 0.22} />
      ))}
    </g>
  );
}

// ————————————————————————————————————————————————————————————————
// Cartes
// ————————————————————————————————————————————————————————————————

const SCENES_TAROT = {
  chemin: SceneLuneMontagnes,
  ancrage: (p) => <SceneArbreRacines {...p} fond="#141A2E" clair />,
  transformation: SceneHeronEau,
  clarté: SceneSoleilRayons,
  possibles: SceneBoussoleCarte,
};

function CarteTarot({ id, chiffre, titre, soustitre, scene, couleur }) {
  const SceneComp = SCENES_TAROT[scene];
  return (
    <svg viewBox="0 0 120 168" width="120" height="168">
      <rect x="2" y="2" width="116" height="164" rx="10" fill="#12141c" />
      <clipPath id={`clipTarot${id}`}><rect x="6" y="18" width="108" height="112" rx="3" /></clipPath>
      <g clipPath={`url(#clipTarot${id})`}>
        <SceneComp id={id} couleur={couleur} />
      </g>
      <rect x="6" y="18" width="108" height="112" rx="3" fill="none" stroke={OR} strokeWidth="0.75" opacity="0.6" />
      <rect x="2" y="2" width="116" height="164" rx="10" fill="none" stroke={OR} strokeWidth="1.4" opacity="0.85" />
      <text x="60" y="12" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" letterSpacing="2" fill={OR} opacity="0.9">{chiffre}</text>
      <text x="60" y="146" textAnchor="middle" fontFamily="'Playfair Display', Georgia, serif" fontSize="12.5" fontWeight="600" fill={CREME}>{titre}</text>
      <text x="60" y="159" textAnchor="middle" fontFamily="Georgia, serif" fontSize="8" letterSpacing="1" fill={OR} opacity="0.75">{soustitre}</text>
    </svg>
  );
}

const SCENES_LIVRE = {
  collines: SceneCollines,
  ville: SceneVille,
  montagnes: SceneMontagnesEtoiles,
  blocs: SceneBlocs,
  arbre: SceneArbreRacines,
  vague: SceneVagueDouce,
};

// Vraie couverture de livre : scène illustrée sur les 2/3 supérieurs +
// bandeau-titre opaque en pied (comme la planche de référence), tranche
// des pages sur le bord droit, reflet vernis en diagonale.
function CarteLivre({ id, catégorie, lignes, scene, couleur }) {
  const SceneComp = SCENES_LIVRE[scene];
  return (
    <svg viewBox="0 0 120 168" width="120" height="168">
      {/* Tranche des pages */}
      <rect x="8" y="6" width="108" height="160" rx="3" fill="#F3E9D2" />
      <rect x="4" y="2" width="108" height="160" rx="4" fill={CREME} />
      <clipPath id={`clipLivre${id}`}><rect x="4" y="2" width="108" height="160" rx="4" /></clipPath>
      <g clipPath={`url(#clipLivre${id})`}>
        <g transform="translate(0, -2) scale(0.964, 1)">
          <SceneComp id={id} couleur={couleur} />
        </g>
        {/* Bandeau-titre en pied */}
        <rect x="4" y="128" width="108" height="34" fill={couleur.sombre} />
        <rect x="4" y="128" width="108" height="2.5" fill={OR} opacity="0.85" />
        <text x="58" y="140" textAnchor="middle" fontFamily="Georgia, serif" fontSize="7" letterSpacing="2" fill={OR} opacity="0.85">{catégorie}</text>
        {lignes.map((ligne, i) => (
          <text key={i} x="58" y={151 + i * 12} textAnchor="middle" fontFamily="'Playfair Display', Georgia, serif" fontSize="10.5" fill={CREME}>
            {ligne}
          </text>
        ))}
      </g>
      <rect x="4" y="2" width="10" height="160" rx="2" fill="#000" opacity="0.16" />
      <polygon points="14,2 60,2 20,90 14,90" fill="#fff" opacity="0.07" />
      <rect x="4" y="2" width="108" height="160" rx="4" fill="none" stroke="#00000018" />
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

const SCENES_CROQUIS = {
  collines: (p) => <SceneCollines {...p} />,
  arbre: (p) => <SceneArbreRacines {...p} monochrome />,
  vague: (p) => <SceneVagueDouce {...p} />,
};

// Couverture d'essai façon croquis — fond crème, petite scène au trait,
// titre en dessous : reprend l'esprit "illustration simple + titre
// littéraire" de la planche fournie, en plus détaillé qu'une icône seule.
function CarteCroquis({ id, lignes, scene, couleur }) {
  const SceneComp = SCENES_CROQUIS[scene];
  return (
    <svg viewBox="0 0 120 168" width="120" height="168">
      <rect x="2" y="2" width="116" height="164" rx="6" fill={CREME} stroke="#00000014" />
      <clipPath id={`clipCroquis${id}`}><rect x="10" y="10" width="100" height="88" rx="3" /></clipPath>
      <g clipPath={`url(#clipCroquis${id})`}>
        <g transform="translate(-2, 4) scale(0.9)">
          <SceneComp id={id} couleur={couleur} />
        </g>
      </g>
      <rect x="10" y="10" width="100" height="88" rx="3" fill="none" stroke={couleur.base} strokeWidth="0.75" opacity="0.35" />
      {lignes.map((ligne, i) => (
        <text key={i} x="60" y={122 + i * 16} textAnchor="middle" fontFamily="'Playfair Display', Georgia, serif" fontSize="12" fill="#2C1810">
          {ligne}
        </text>
      ))}
      <line x1="34" y1="152" x2="86" y2="152" stroke={couleur.base} strokeWidth="0.75" opacity="0.4" />
    </svg>
  );
}

// Couverture de livrable CursDecision — repère "plume" Cursus, bandeau
// de couleur en pied.
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

// Page d'analyse CursDecision — barres, courbe ou réseau d'acteurs.
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

// ————————————————————————————————————————————————————————————————
// Catalogue — pool large (35 entrées) pour que le sac mélangé produise
// une vraie variété. Réparti volontairement : oracle 5, livres 12,
// croquis 6, rapports 5, graphiques 5, notes 2 — les livres fermés ne
// sont plus l'écrasante majorité.
// ————————————————————————————————————————————————————————————————
const CARTES = [
  // Oracle — vocabulaire de décision de la planche fournie
  { Comp: CarteTarot, props: { chiffre: "I", titre: "Le Chemin", soustitre: "Intuition", scene: "chemin" }, couleur: 1 },
  { Comp: CarteTarot, props: { chiffre: "II", titre: "L'Ancrage", soustitre: "Stabilité", scene: "ancrage" }, couleur: 2 },
  { Comp: CarteTarot, props: { chiffre: "III", titre: "La Transformation", soustitre: "Mouvement", scene: "transformation" }, couleur: 0 },
  { Comp: CarteTarot, props: { chiffre: "IV", titre: "La Clarté", soustitre: "Révélation", scene: "clarté" }, couleur: 5 },
  { Comp: CarteTarot, props: { chiffre: "V", titre: "Les Possibles", soustitre: "Exploration", scene: "possibles" }, couleur: 4 },

  // Manuscrits CursEdit — vraies couvertures illustrées
  { Comp: CarteLivre, props: { catégorie: "RÉCIT", lignes: ["Fragments", "d'une époque"], scene: "ville" }, couleur: 3 },
  { Comp: CarteLivre, props: { catégorie: "ESSAI", lignes: ["Penser", "autrement"], scene: "blocs" }, couleur: 2 },
  { Comp: CarteLivre, props: { catégorie: "CARNET", lignes: ["Horizons", "intérieurs"], scene: "montagnes" }, couleur: 1 },
  { Comp: CarteLivre, props: { catégorie: "RÉCIT", lignes: ["L'art", "des liens"], scene: "collines" }, couleur: 0 },
  { Comp: CarteLivre, props: { catégorie: "ESSAI", lignes: ["Le langage", "du vivant"], scene: "arbre" }, couleur: 2 },
  { Comp: CarteLivre, props: { catégorie: "RÉCIT", lignes: ["La mémoire", "des lieux"], scene: "vague" }, couleur: 5 },
  { Comp: CarteLivre, props: { catégorie: "ESSAI", lignes: ["Les chemins", "de l'invisible"], scene: "collines" }, couleur: 1 },
  { Comp: CarteLivre, props: { catégorie: "CARNET", lignes: ["Traversées"], scene: "montagnes" }, couleur: 4 },
  { Comp: CarteLivre, props: { catégorie: "RÉCIT", lignes: ["La part", "du silence"], scene: "ville" }, couleur: 0 },
  { Comp: CarteLivre, props: { catégorie: "ESSAI", lignes: ["Réapprendre", "à lire"], scene: "blocs" }, couleur: 3 },
  { Comp: CarteLivre, props: { catégorie: "CARNET", lignes: ["Le fil", "des jours"], scene: "vague" }, couleur: 5 },
  { Comp: CarteLivre, props: { catégorie: "RÉCIT", lignes: ["Ce que", "la mer garde"], scene: "collines" }, couleur: 2 },

  // Essais façon croquis
  { Comp: CarteCroquis, props: { lignes: ["Notes", "de terrain"], scene: "collines" }, couleur: 1 },
  { Comp: CarteCroquis, props: { lignes: ["Racines"], scene: "arbre" }, couleur: 2 },
  { Comp: CarteCroquis, props: { lignes: ["Esquisses", "d'un lieu"], scene: "vague" }, couleur: 5 },
  { Comp: CarteCroquis, props: { lignes: ["Carnet", "de bord"], scene: "collines" }, couleur: 0 },
  { Comp: CarteCroquis, props: { lignes: ["Ce qui", "pousse"], scene: "arbre" }, couleur: 4 },
  { Comp: CarteCroquis, props: { lignes: ["Marées"], scene: "vague" }, couleur: 3 },

  // Livrables CursDecision
  { Comp: CarteRapport, props: { lignes: ["Diagnostic", "organisationnel"], sousTitre: "Analyse et recommandations" }, couleur: 1 },
  { Comp: CarteRapport, props: { lignes: ["Stratégie &", "Développement"], sousTitre: "Plan d'action" }, couleur: 2 },
  { Comp: CarteRapport, props: { lignes: ["Analyse des", "besoins"], sousTitre: "Plan qualitatif et quantitatif" }, couleur: 0 },
  { Comp: CarteRapport, props: { lignes: ["Étude de", "faisabilité"], sousTitre: "Synthèse exécutive" }, couleur: 5 },
  { Comp: CarteRapport, props: { lignes: ["Feuille de", "route"], sousTitre: "Prochaines étapes" }, couleur: 4 },

  // Pages d'analyse CursDecision
  { Comp: CarteGraphique, props: { titre: "Résultats et tendances", type: "barres" }, couleur: 1 },
  { Comp: CarteGraphique, props: { titre: "Analyse comparative", type: "lignes" }, couleur: 2 },
  { Comp: CarteGraphique, props: { titre: "Cartographie des acteurs", type: "reseau" }, couleur: 5 },
  { Comp: CarteGraphique, props: { titre: "Suivi d'indicateurs", type: "lignes" }, couleur: 3 },
  { Comp: CarteGraphique, props: { titre: "Répartition par thème", type: "barres" }, couleur: 0 },

  // Notes manuscrites
  { Comp: CartePapier, props: { étiquette: "NOTES", titre: "Idées éparses" }, couleur: 5 },
  { Comp: CartePapier, props: { étiquette: "BROUILLON", titre: "Proposition de projet" }, couleur: 3 },
];

// Sac mélangé (Fisher-Yates) : tire toutes les entrées d'une copie
// mélangée du pool avant d'en remélanger une nouvelle — garantit qu'une
// même carte ne revient pas avant d'avoir vu tout le reste, au lieu du
// pur hasard avec remise qui produisait des doublons visibles.
function mélange(tableau) {
  const copie = [...tableau];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

function CoucheCartes({ nombre, tailleBase, opacite, vitesseMin, vitesseMax, zIndex }) {
  const dispo = useMemo(() => {
    const sac = mélange(CARTES);
    return Array.from({ length: nombre }, (_, i) => {
      const carte = sac[i % sac.length];
      return {
        // Suffixe aléatoire (pas juste l'index) : deux couches affichent
        // des index qui se recoupent (0..6 et 0..4), un id basé sur l'index
        // seul collisionnerait entre elles et pourrait faire "fuiter" le
        // mauvais dégradé d'une carte vers l'autre via url(#id).
        id: `c${i}-${zIndex}-${Math.random().toString(36).slice(2, 9)}`,
        carte,
        couleur: idCouleur(carte.couleur + Math.floor(Math.random() * PALETTE.length)),
        gauche: `${Math.round(Math.random() * 76) + 2}%`,
        délai: +(Math.random() * vitesseMax).toFixed(1),
        durée: +(vitesseMin + Math.random() * (vitesseMax - vitesseMin)).toFixed(1),
        rotationDépart: Math.round(Math.random() * 14 - 7),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nombre, vitesseMin, vitesseMax]);

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
            <Comp {...props} id={d.id} couleur={d.couleur} />
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

// Effet "pluie Matrix" tout au fond, derrière les cartes.
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
