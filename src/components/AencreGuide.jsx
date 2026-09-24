/**
 * CURSUS — Æncre qui guide (24/09/2026)
 * ======================================================================
 * Sur le Mode d'emploi, Æncre (voir CLAUDE.md) accompagne la lecture :
 * la plume descend le long de la marge droite au fur et à mesure du
 * scroll, comme si elle "écrivait" la progression dans le guide.
 *
 * `position: fixed` + recalcul du `top` sur l'évènement scroll (et pas
 * un simple `sticky`) : on veut que sa position verticale suive la
 * progression de lecture (0% en haut de page → 100% en bas), pas
 * qu'elle reste juste collée à l'écran sans bouger.
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

  // La plume se déplace entre 12% et 82% de la hauteur de l'écran, pour
  // ne jamais chevaucher le bouton "Retour" (en haut à gauche) ni sortir
  // du viewport en bas.
  const hautMin = 12, hautMax = 82;
  const top = `${hautMin + progression * (hautMax - hautMin)}%`;

  return (
    <img
      src="/aencre-complet-detoure.png"
      alt=""
      aria-hidden="true"
      style={{
        position: "fixed",
        right: "max(8px, calc(50vw - 460px))",
        top,
        transform: "translateY(-50%)",
        width: 110,
        opacity: 0.92,
        filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.18))",
        pointerEvents: "none",
        zIndex: 900,
        transition: "top 80ms linear",
      }}
    />
  );
}
