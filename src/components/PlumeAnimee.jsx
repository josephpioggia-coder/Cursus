/**
 * CURSUS — Texte "écrit" en arrière-plan, page de connexion (24/09/2026)
 * ======================================================================
 * Troisième itération. Demande d'origine : effet façon écriture manuscrite
 * (référence vidéo montrée par Joseph — révélation progressive du tracé
 * d'un texte en police script, pas des lettres qui "popent" une à une).
 *
 * Remplace l'ancienne approche (setTimeout par caractère, DOM réécrit à
 * chaque lettre) par une animation CSS pure : le texte entier est déjà
 * là dans le DOM, un `clip-path: inset()` animé le révèle de gauche à
 * droite, avec un fin trait vertical (le "stylo") qui suit exactement le
 * bord de la révélation — une seule animation, pas de minuteur JS
 * pouvant se dérégler ou sauter directement au texte complet.
 *
 * `key={indexPhrase}` sur le texte ET le curseur : force React à
 * remonter les deux à chaque nouvelle phrase, ce qui relance
 * proprement l'animation CSS (une animation déjà terminée ne
 * redémarre pas d'elle-même sur le même élément).
 */

import { useState } from "react";

const PHRASES = [
  "Un espace d'écriture accompagné par IA.",
  "Le Co-pilote voit vos mots, vos personnages, vos images.",
  "Auditer un texte déjà écrit : preuve, cohérence, risques.",
  "Votre voix reste la vôtre — l'IA accompagne, elle n'écrit pas à votre place.",
];

const DUREE_S = 5.5;

export default function PlumeAnimee() {
  const [indexPhrase, setIndexPhrase] = useState(0);

  return (
    <div aria-hidden="true" style={{
      position: "fixed", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none",
      display: "flex", alignItems: "center",
    }}>
      <div style={{ width: "100%", padding: "0 6vw", whiteSpace: "nowrap", overflow: "hidden" }}>
        <div style={{ position: "relative", display: "inline-block" }}>
          <span
            key={indexPhrase}
            className="plume-texte"
            onAnimationEnd={() => setIndexPhrase((i) => (i + 1) % PHRASES.length)}
            style={{
              display: "inline-block",
              fontFamily: "'Dancing Script', cursive",
              fontWeight: 700,
              fontSize: "clamp(24px, 4.6vw, 48px)",
              color: "#7F77DD",
              opacity: 0.18,
            }}
          >
            {PHRASES[indexPhrase]}
          </span>
          <span key={`c${indexPhrase}`} className="plume-stylo" />
        </div>
      </div>
      <style>{`
        @keyframes plume-revele {
          0%   { clip-path: inset(0 100% 0 0); }
          62%  { clip-path: inset(0 0% 0 0); }
          88%  { clip-path: inset(0 0% 0 0); }
          100% { clip-path: inset(0 0% 0 0); opacity: 0; }
        }
        @keyframes plume-curseur {
          0%   { left: 0%; opacity: .55; }
          62%  { left: 100%; opacity: .55; }
          70%  { opacity: 0; }
          100% { left: 100%; opacity: 0; }
        }
        .plume-texte {
          animation: plume-revele ${DUREE_S}s ease-in-out forwards;
        }
        .plume-stylo {
          position: absolute;
          top: 4%;
          bottom: 4%;
          width: 2px;
          background: #7F77DD;
          animation: plume-curseur ${DUREE_S}s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
}
