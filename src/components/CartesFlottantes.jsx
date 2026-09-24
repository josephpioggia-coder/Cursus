/**
 * CURSUS — Cartes flottantes, colonne gauche de la page de connexion (24/09/2026)
 * ======================================================================
 * Cinquième itération — reprise complète du contenu visuel, demande
 * explicite de Joseph : les illustrations SVG "au trait" (versions
 * précédentes) faisaient amateur, pas professionnel de l'édition. Au
 * lieu de redessiner des scènes vectorielles, ce composant DÉCOUPE les
 * éléments un par un depuis la planche de référence fournie par Joseph
 * (illustration IA détaillée : couvertures peintes, textures de cuir,
 * photos) — chaque livre, rapport, page d'analyse et carte oracle est
 * maintenant un vrai fragment de cette planche, pas un dessin refait.
 *
 * Fichiers sources : `public/cartes/*.webp`, 21 recadrages individuels
 * de la planche (conservée nulle part ailleurs dans le dépôt — demander
 * à Joseph de la refournir avant tout nouveau recadrage). Redimensionnés
 * à 260px de large max et compressés en WebP qualité 84 : ~225 Ko pour
 * les 21 images, chargement encore léger malgré le passage au raster.
 *
 * Volontairement exclus de la planche : le livre "Cursus" (bordeaux,
 * logo — c'est la marque, pas un exemple de contenu produit), les
 * livres ouverts (format paysage, ne rentrent pas dans le gabarit
 * "carte" portrait), et les deux cartes carte/photo de paysage en bas à
 * droite (hors-sujet par rapport à CursEdit/CursAudit/CursDecision).
 *
 * Mécanique d'animation inchangée par rapport à la version précédente
 * (sac mélangé Fisher-Yates pour éviter les doublons visibles, deux
 * couches de profondeur, pluie Matrix en fond) — seul le contenu des
 * cartes change, de SVG dessiné à image découpée.
 */

import { useMemo } from "react";

// Chaque entrée : fichier dans public/cartes/, largeur relative (les
// crops n'ont pas tous le même ratio — livres ~0.72, cartes oracle plus
// étroites ~0.6 — ce facteur égalise leur emprise visuelle une fois
// tombées à l'écran) et légère rotation de base pour ne pas avoir l'air
// parfaitement aligné à la photo d'origine.
const CARTES = [
  // Manuscrits CursEdit
  { fichier: "chemins-invisible", poids: 1 },
  { fichier: "langage-vivant", poids: 1 },
  { fichier: "fragments-epoque", poids: 1 },
  { fichier: "penser-autrement", poids: 1 },
  { fichier: "horizons-interieurs", poids: 1 },
  { fichier: "art-des-liens", poids: 1 },
  { fichier: "memoire-des-lieux", poids: 1 },

  // Livrables CursDecision
  { fichier: "diagnostic-organisationnel", poids: 1 },
  { fichier: "strategie-developpement", poids: 1 },
  { fichier: "analyse-besoins", poids: 1 },

  // Pages d'analyse CursDecision
  { fichier: "resultats-tendances", poids: 0.95 },
  { fichier: "analyse-comparative", poids: 0.95 },
  { fichier: "cartographie-acteurs", poids: 0.95 },

  // Notes et croquis
  { fichier: "lettre-manuscrite", poids: 0.85 },
  { fichier: "proposition-projet", poids: 0.85 },
  { fichier: "esquisse-arche", poids: 0.85 },

  // Oracle — vocabulaire de décision
  { fichier: "oracle-chemin", poids: 0.8 },
  { fichier: "oracle-ancrage", poids: 0.8 },
  { fichier: "oracle-transformation", poids: 0.8 },
  { fichier: "oracle-clarte", poids: 0.8 },
  { fichier: "oracle-possibles", poids: 0.8 },
];

// Sac mélangé (Fisher-Yates) : tire toutes les entrées d'une copie
// mélangée du pool avant d'en remélanger une nouvelle — garantit qu'une
// même carte ne revient pas avant d'avoir vu tout le reste, au lieu du
// pur hasard avec remise qui produisait des doublons visibles côte à
// côte.
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
        carte,
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
      {dispo.map((d, i) => (
        <div
          key={i}
          className="carte-flottante"
          style={{
            left: d.gauche,
            width: Math.round(tailleBase * d.carte.poids),
            animationDelay: `${d.délai}s`,
            animationDuration: `${d.durée}s`,
            // eslint-disable-next-line
            "--rot-depart": `${d.rotationDépart}deg`,
          }}
        >
          <img src={`/cartes/${d.carte.fichier}.webp`} alt="" loading="lazy" />
        </div>
      ))}
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
      <CoucheCartes nombre={7} tailleBase={62} opacite={0.35} vitesseMin={9} vitesseMax={13} zIndex={2} />
      {/* Premier plan : grandes cartes, plus lentes */}
      <CoucheCartes nombre={5} tailleBase={120} opacite={0.6} vitesseMin={15} vitesseMax={20} zIndex={3} />

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
        .carte-flottante img {
          display: block; width: 100%; height: auto;
          border-radius: 3px;
          filter: drop-shadow(0 6px 12px rgba(44,24,16,0.22));
        }
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
