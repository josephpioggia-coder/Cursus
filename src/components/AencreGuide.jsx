/**
 * CURSUS — Æncre qui guide (24/09/2026, ajustée le 24/09/2026)
 * ======================================================================
 * Sur le Mode d'emploi (page bien plus longue que l'écran — contrairement
 * à la page de connexion, où Æncre se contente d'un léger flottement sur
 * place, voir aencre-flotte dans auth.jsx), Æncre accompagne la lecture
 * en DEUX éléments séparés (aencre-encrier-detoure.png +
 * aencre-plume-detouree.png, découpés depuis aencre-complet-detoure.png
 * — voir CLAUDE.md) :
 *
 * - L'encrier est un élément de page normal (`position: absolute`, pas
 *   `fixed`) posé près du titre : il défile AVEC le contenu et disparaît
 *   par le haut dès qu'on avance dans la lecture, exactement comme le
 *   titre "Mode d'emploi" juste à côté de lui — pas un élément qui reste
 *   ancré à l'écran.
 * - La plume, elle, descend et remonte avec la lecture : posée près de
 *   l'encrier au repos (haut de page), elle s'en détache dès qu'on
 *   scrolle pour suivre le mouvement jusqu'en bas, et revient si on
 *   remonte (sa position suit `progression`, qui varie dans les deux
 *   sens avec `scrollTop`) — elle, reste "fixed" à l'écran pendant le
 *   trajet.
 *
 * `position: fixed` + recalcul du `top` sur l'évènement scroll (et pas
 * un simple `sticky`) : on veut que la position verticale de la plume
 * suive la progression de lecture, pas qu'elle reste juste collée à
 * l'écran. `progression` est passée dans une racine carrée (Math.sqrt)
 * plutôt qu'utilisée linéairement : la plume se détache vite dès les
 * premiers pixels de scroll, puis ralentit pour accompagner la suite de
 * la lecture plus régulièrement.
 *
 * `conteneurRef` (obligatoire, fourni par ModeEmploi/Page) : le scroll
 * écouté est celui de CE conteneur, pas celui de la fenêtre — ModeEmploi
 * est ouverte depuis des parents différents selon l'endroit (avant
 * connexion, ou depuis l'app une fois connecté·e, où la fenêtre elle-même
 * ne défile pas), donc seul le conteneur que la page gère elle-même est
 * fiable partout. Sans lui, l'encrier "suivrait" le contenu au lieu de
 * rester immobile dès qu'on se trouve dans un parent où ce n'est pas la
 * fenêtre qui scrolle.
 */

import { useState, useEffect } from "react";

export default function AencreGuide({ conteneurRef }) {
  const [progression, setProgression] = useState(0);
  const [étroit, setÉtroit] = useState(window.innerWidth < 900);

  useEffect(() => {
    const conteneur = conteneurRef?.current;
    if (!conteneur) return;
    function auScroll() {
      const { scrollTop, scrollHeight, clientHeight } = conteneur;
      const hauteurDisponible = scrollHeight - clientHeight;
      const ratio = hauteurDisponible > 0 ? scrollTop / hauteurDisponible : 0;
      setProgression(Math.min(1, Math.max(0, ratio)));
    }
    function auResize() {
      auScroll();
      setÉtroit(window.innerWidth < 900);
    }
    auScroll();
    conteneur.addEventListener("scroll", auScroll, { passive: true });
    window.addEventListener("resize", auResize);
    return () => {
      conteneur.removeEventListener("scroll", auScroll);
      window.removeEventListener("resize", auResize);
    };
  }, [conteneurRef]);

  if (étroit) return null;

  const margeDroite = "max(8px, calc(50vw - 460px))";

  // Position "posée" au repos (haut de page, près de l'encrier) puis
  // parcours jusqu'à 82% de la hauteur d'écran, pour ne jamais chevaucher
  // le bouton "Retour" (en haut à gauche) ni sortir du viewport en bas.
  const hautRepos = 12.5, hautMax = 82;
  const détachée = Math.sqrt(progression); // détachement rapide, puis ralenti
  const topPlume = `${hautRepos + détachée * (hautMax - hautRepos)}%`;
  // Léger tangage pendant le trajet (rentre à plat au repos et à l'arrivée) :
  // donne l'impression d'une plume portée par le mouvement, pas un autocollant.
  const rotationPlume = Math.sin(progression * Math.PI) * -5;

  return (
    <>
      <img
        src="/aencre-encrier-detoure.png"
        alt=""
        aria-hidden="true"
        className="aencre-encrier-fixe"
        style={{
          position: "absolute",
          right: `calc(${margeDroite} + 38px)`,
          top: 148,
          width: 66,
          opacity: 0.9,
          filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.16))",
          pointerEvents: "none",
          zIndex: 899,
        }}
      />
      <img
        src="/aencre-plume-detouree.png"
        alt=""
        aria-hidden="true"
        style={{
          position: "fixed",
          right: margeDroite,
          top: topPlume,
          transform: `translateY(-72%) rotate(${rotationPlume}deg)`,
          width: 100,
          opacity: 0.92,
          filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.18))",
          pointerEvents: "none",
          zIndex: 900,
          transition: "top 260ms cubic-bezier(0.33,1,0.68,1), transform 260ms cubic-bezier(0.33,1,0.68,1)",
        }}
      />
      <style>{`
        @keyframes aencre-encrier-flotte {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-2px) rotate(1deg); }
        }
        .aencre-encrier-fixe { animation: aencre-encrier-flotte 3.6s ease-in-out infinite; }
      `}</style>
    </>
  );
}
