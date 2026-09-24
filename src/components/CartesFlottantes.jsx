/**
 * CURSUS — Cartes flottantes, colonne gauche de la page de connexion (24/09/2026)
 * ======================================================================
 * Remplace le texte défilant dans la colonne gauche uniquement (la
 * colonne droite garde ColonnePlume/PlumeAnimee.jsx inchangée) — demande
 * de Joseph, sur la base d'une image de référence (cartes façon tarot +
 * couvertures de livres, illustrations au trait doré, qui tombent
 * doucement).
 *
 * L'image fournie était un .webp à une seule image (pas de données
 * d'animation exploitables) — recréé en SVG inline plutôt qu'un GIF :
 * aucun fichier à charger, couleurs de marque déjà existantes
 * (bordeaux/bleu marine/vert/or, voir COULEURS dans contenuPaliers.js),
 * poids quasi nul comparé à un GIF.
 *
 * Chaque carte tombe en boucle (translateY + légère rotation, durée et
 * délai propres à chacune pour un mouvement non synchronisé/organique),
 * fond entièrement transparent.
 */

const OR = "#C4973A";
const CREME = "#F7F4EF";

// Icônes au trait, minimalistes — pas une reproduction de l'image de
// référence, juste dans le même esprit (cercle/arche/vague en ligne dorée).
const ICONES = {
  élan: <path d="M32 14 C 44 14 44 30 32 34 C 20 38 20 50 32 50" />,
  passage: <path d="M18 46 V30 C18 18 46 18 46 30 V46" />,
  vague: <path d="M14 36 C 22 24 26 24 34 36 C 42 48 46 48 54 36" />,
  double: <path d="M16 30 C 24 20 32 20 40 30 M20 42 C 28 32 36 32 44 42" />,
  spirale: <circle cx="32" cy="32" r="14" />,
};

function CarteTarot({ chiffre, titre, couleur, icone }) {
  return (
    <svg viewBox="0 0 120 168" width="120" height="168">
      <rect x="2" y="2" width="116" height="164" rx="10" fill={couleur} />
      <rect x="7" y="7" width="106" height="154" rx="7" fill="none" stroke={OR} strokeWidth="1" opacity="0.7" />
      <text x="60" y="26" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fill={OR} opacity="0.85">{chiffre}</text>
      <g transform="translate(28, 46)" fill="none" stroke={OR} strokeWidth="1.6" opacity="0.9" strokeLinecap="round">
        {ICONES[icone]}
      </g>
      <text x="60" y="140" textAnchor="middle" fontFamily="'Playfair Display', Georgia, serif" fontSize="13" fill={CREME}>{titre}</text>
    </svg>
  );
}

function CarteLivre({ catégorie, titre, couleur, icone }) {
  return (
    <svg viewBox="0 0 120 168" width="120" height="168">
      <rect x="4" y="2" width="112" height="164" rx="4" fill={couleur} />
      <rect x="4" y="2" width="10" height="164" rx="2" fill="#000" opacity="0.12" />
      <text x="64" y="24" textAnchor="middle" fontFamily="Georgia, serif" fontSize="8" letterSpacing="1.5" fill={OR} opacity="0.85">{catégorie}</text>
      <text x="64" y="42" textAnchor="middle" fontFamily="'Playfair Display', Georgia, serif" fontSize="13" fill={CREME}>{titre}</text>
      <g transform="translate(38, 100)" fill="none" stroke={OR} strokeWidth="1.6" opacity="0.85" strokeLinecap="round">
        {ICONES[icone]}
      </g>
    </svg>
  );
}

function CartePapier({ étiquette, titre, couleur }) {
  return (
    <svg viewBox="0 0 120 150" width="120" height="150">
      <rect x="2" y="2" width="116" height="146" rx="3" fill={CREME} stroke="#00000012" />
      <rect x="10" y="10" width="14" height="14" rx="3" fill={couleur} opacity="0.85" />
      <text x="34" y="20" fontFamily="Georgia, serif" fontSize="8" letterSpacing="1" fill="#6B5D52">{étiquette}</text>
      <text x="10" y="40" fontFamily="'Playfair Display', Georgia, serif" fontSize="12.5" fill="#2C1810">{titre}</text>
      {[58, 70, 82, 94].map((y) => (
        <path key={y} d={`M10 ${y} H${y % 2 === 0 ? 96 : 78}`} stroke="#2C181022" strokeWidth="2" strokeLinecap="round" />
      ))}
    </svg>
  );
}

const CARTES = [
  { Comp: CarteTarot, props: { chiffre: "I", titre: "L'Élan", couleur: "#8B2635", icone: "élan" } },
  { Comp: CarteTarot, props: { chiffre: "II", titre: "Le Doute", couleur: "#0E3374", icone: "passage" } },
  { Comp: CarteTarot, props: { chiffre: "III", titre: "Le Chapitre", couleur: "#0E7256", icone: "double" } },
  { Comp: CarteLivre, props: { catégorie: "MANUSCRIT", titre: "En cours", couleur: "#0E3374", icone: "vague" } },
  { Comp: CarteLivre, props: { catégorie: "ESSAI", titre: "À auditer", couleur: "#8B2635", icone: "spirale" } },
  { Comp: CartePapier, props: { étiquette: "NOTES", titre: "Idées éparses", couleur: "#C4973A" } },
];

// Position/rythme propres à chaque carte — décalage et durée non
// synchronisés pour un mouvement organique, pas un défilé régulier.
const DISPOSITION = [
  { gauche: "4%",  taille: 108, délai: 0,    durée: 22 },
  { gauche: "44%", taille: 96,  délai: 3.2,  durée: 26 },
  { gauche: "16%", taille: 88,  délai: 9,    durée: 20 },
  { gauche: "56%", taille: 104, délai: 5.5,  durée: 24 },
  { gauche: "30%", taille: 92,  délai: 13.5, durée: 27 },
  { gauche: "62%", taille: 80,  délai: 1.8,  durée: 21 },
];

export default function CartesFlottantes() {
  return (
    <div className="cartes-scene" aria-hidden="true">
      {CARTES.map(({ Comp, props }, i) => {
        const d = DISPOSITION[i % DISPOSITION.length];
        return (
          <div
            key={i}
            className="carte-flottante"
            style={{
              left: d.gauche,
              width: d.taille,
              animationDelay: `${d.délai}s`,
              animationDuration: `${d.durée}s`,
            }}
          >
            <Comp {...props} />
          </div>
        );
      })}
      <style>{`
        .cartes-scene {
          position: relative;
          width: 100%; height: 100%;
          overflow: hidden;
        }
        .carte-flottante {
          position: absolute;
          top: -220px;
          opacity: 0.5;
          animation-name: carte-tombe;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform, opacity;
        }
        .carte-flottante svg { display: block; width: 100%; height: auto; filter: drop-shadow(0 6px 10px rgba(44,24,16,0.08)); }
        @keyframes carte-tombe {
          0%   { transform: translateY(0) rotate(-6deg); opacity: 0; }
          8%   { opacity: 0.5; }
          50%  { transform: translateY(50vh) rotate(4deg); }
          92%  { opacity: 0.5; }
          100% { transform: translateY(calc(100vh + 220px)) rotate(-6deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
