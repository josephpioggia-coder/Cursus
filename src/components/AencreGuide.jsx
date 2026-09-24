/**
 * CURSUS — Æncre qui guide (24/09/2026, ajustée le 24/09/2026)
 * ======================================================================
 * Sur le Mode d'emploi (page bien plus longue que l'écran — contrairement
 * à la page de connexion, où Æncre se contente d'un léger flottement sur
 * place, voir aencre-flotte dans auth.jsx), Æncre accompagne la lecture :
 *
 * - Au repos (haut de page, avant tout scroll), la plume reste posée près
 *   du titre — comme "près de l'encrier" en haut du guide.
 * - Dès qu'on scrolle, ne serait-ce qu'un peu, elle s'en détache et se met
 *   à suivre le mouvement, glissant le long de la marge droite jusqu'au
 *   bas de la page à mesure qu'on progresse dans la lecture.
 *
 * `position: fixed` + recalcul du `top` sur l'évènement scroll (et pas un
 * simple `sticky`) : on veut que sa position verticale suive la
 * progression de lecture, pas qu'elle reste juste collée à l'écran.
 * `progression` est passée dans une racine carrée (Math.sqrt) plutôt
 * qu'utilisée linéairement : la plume se détache vite dès les premiers
 * pixels de scroll ("à peine scrolle-t-on qu'elle se sépare"), puis
 * ralentit pour accompagner la suite de la lecture plus régulièrement.
 *
 * Utilise aencre-complet-detoure.png (fond transparent, voir CLAUDE.md)
 * pour pouvoir flotter par-dessus le contenu sans rectangle blanc.
 */

import { useState, useEffect } from "react";

export default function AencreGuide() {
  const [progression, setProgression] = useState(0);
  const [étroit, setÉtroit] = useState(window.innerWidth < 900);

  useEffect(() => {
    function auScroll() {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const hauteurDisponible = scrollHeight - clientHeight;
      const ratio = hauteurDisponible > 0 ? scrollTop / hauteurDisponible : 0;
      setProgression(Math.min(1, Math.max(0, ratio)));
    }
    function auResize() {
      auScroll();
      setÉtroit(window.innerWidth < 900);
    }
    auScroll();
    window.addEventListener("scroll", auScroll, { passive: true });
    window.addEventListener("resize", auResize);
    return () => {
      window.removeEventListener("scroll", auScroll);
      window.removeEventListener("resize", auResize);
    };
  }, []);

  if (étroit) return null;

  // Position "posée" au repos (haut de page, près du titre) puis parcours
  // jusqu'à 82% de la hauteur d'écran, pour ne jamais chevaucher le
  // bouton "Retour" (en haut à gauche) ni sortir du viewport en bas.
  const hautRepos = 9, hautMax = 82;
  const détachée = Math.sqrt(progression); // détachement rapide, puis ralenti
  const top = `${hautRepos + détachée * (hautMax - hautRepos)}%`;
  // Léger tangage pendant le trajet (rentre à plat au repos et à l'arrivée) :
  // donne l'impression d'une plume portée par le mouvement, pas un autocollant.
  const rotation = Math.sin(progression * Math.PI) * -5;

  return (
    <img
      src="/aencre-complet-detoure.png"
      alt=""
      aria-hidden="true"
      style={{
        position: "fixed",
        right: "max(8px, calc(50vw - 460px))",
        top,
        transform: `translateY(-50%) rotate(${rotation}deg)`,
        width: 110,
        opacity: 0.92,
        filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.18))",
        pointerEvents: "none",
        zIndex: 900,
        transition: "top 260ms cubic-bezier(0.33,1,0.68,1), transform 260ms cubic-bezier(0.33,1,0.68,1)",
      }}
    />
  );
}
