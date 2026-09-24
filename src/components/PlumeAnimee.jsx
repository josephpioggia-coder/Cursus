/**
 * CURSUS — Texte manuscrit en arrière-plan, page de connexion (24/09/2026)
 * ======================================================================
 * Quatrième itération, demande détaillée de Joseph :
 *  - Le texte remplit la page en lignes, de haut en bas, plutôt qu'une
 *    seule ligne centrée.
 *  - Une fois la page pleine, les anciennes lignes s'effacent PAR LE HAUT
 *    pour laisser la place aux nouvelles en bas (effet "défilement",
 *    comme un texte qui continue de s'écrire sans jamais s'arrêter).
 *  - Couleur : le bordeaux/marron de Cursus (celui de CursEdit, #8B2635),
 *    à peine éclairci — la version précédente (violet à 18% d'opacité)
 *    était trop pâle pour se lire comme "de l'écriture".
 *  - Le texte contourne la boîte de connexion centrale au lieu de passer
 *    derrière sans égard pour elle.
 *  - Une plume suit la fin du texte déjà écrit, avec un léger mouvement
 *    vertical continu (pas au pixel près sur chaque lettre — un vrai
 *    calcul de hampes/jambages lettre par lettre demanderait de
 *    convertir la police en tracés vectoriels, hors de portée ici) pour
 *    donner une impression vivante plutôt qu'un simple curseur droit.
 *
 * TECHNIQUE — pas de gestion manuelle de défilement en JS : le texte
 * révélé vit dans un bloc ANCRÉ EN BAS (position: absolute, bottom: 0)
 * à l'intérieur d'un conteneur de hauteur fixe en overflow: hidden. À
 * mesure que le bloc grandit vers le haut, son sommet sort naturellement
 * de la zone visible — aucun calcul de scroll à faire. Un masque en
 * dégradé sur le conteneur fait disparaître les lignes en fondu plutôt
 * qu'en coupure nette. Deux colonnes indépendantes (gauche/droite),
 * laissant vide la largeur de la boîte de connexion entre les deux —
 * plus simple et plus robuste qu'un vrai contournement CSS
 * (shape-outside) autour d'un élément qui bouge selon l'écran.
 */

import { useEffect, useRef } from "react";

const PHRASES = [
  "Un espace d'écriture accompagné par IA.",
  "Le Co-pilote voit vos mots, vos personnages, vos images.",
  "Auditer un texte déjà écrit : preuve, cohérence, risques.",
  "Votre voix reste la vôtre — l'IA accompagne, elle n'écrit pas à votre place.",
  "Chaque chapitre, sauvegardé automatiquement.",
  "Structurer un manuscrit, partie par partie, chapitre par chapitre.",
];

const COULEUR = "#8B2635"; // bordeaux Cursus (CursEdit)

function ColonnePlume({ décalageDépart = 0, vitesseMs = 42 }) {
  const conteneurRef = useRef(null);
  const texteRef = useRef(null);
  const caretRef = useRef(null);
  const plumeRef = useRef(null);
  const flotRef = useRef(""); // le texte accumulé (peut grandir indéfiniment)
  const indexPhraseRef = useRef(décalageDépart % PHRASES.length);
  const positionRef = useRef(0); // position dans la phrase en cours
  const départRef = useRef(performance.now());

  useEffect(() => {
    let annulé = false;
    let timerId;

    const tick = () => {
      if (annulé) return;
      const phrase = PHRASES[indexPhraseRef.current];
      if (positionRef.current < phrase.length) {
        positionRef.current += 1;
        flotRef.current += phrase[positionRef.current - 1];
      } else {
        // Fin de phrase : petite pause visuelle via un séparateur, puis phrase suivante.
        flotRef.current += "   ·   ";
        indexPhraseRef.current = (indexPhraseRef.current + 1) % PHRASES.length;
        positionRef.current = 0;
        // Purge la mémoire du flux de temps en temps — jamais affiché de
        // toute façon une fois sorti par le haut, purement pour éviter
        // qu'une session ouverte des heures n'accumule une chaîne énorme.
        if (flotRef.current.length > 4000) {
          flotRef.current = flotRef.current.slice(-800);
        }
      }
      if (texteRef.current) texteRef.current.textContent = flotRef.current;

      // Position de la plume = position du caret (fin du texte révélé),
      // plus un léger mouvement vertical continu (sinusoïde) pour ne pas
      // rester rigide sur une ligne droite.
      if (caretRef.current && conteneurRef.current && plumeRef.current) {
        const rectCaret = caretRef.current.getBoundingClientRect();
        const rectConteneur = conteneurRef.current.getBoundingClientRect();
        const x = rectCaret.left - rectConteneur.left;
        const y = rectCaret.top - rectConteneur.top;
        const t = (performance.now() - départRef.current) / 1000;
        const bob = Math.sin(t * 5.2) * 5; // ±5px, ~1,2 aller-retour/seconde
        plumeRef.current.style.transform = `translate(${x - 4}px, ${y + bob - 6}px) rotate(${Math.sin(t * 5.2) * 10 - 25}deg)`;
      }

      timerId = setTimeout(tick, vitesseMs);
    };

    timerId = setTimeout(tick, vitesseMs);
    return () => { annulé = true; clearTimeout(timerId); };
  }, [vitesseMs]);

  return (
    <div ref={conteneurRef} className="plume-colonne">
      <div className="plume-bloc-bas">
        <span ref={texteRef} className="plume-texte" />
        <span ref={caretRef} style={{ display: "inline-block", width: 0 }}>{"​"}</span>
      </div>
      <span ref={plumeRef} className="plume-icone" aria-hidden="true">🪶</span>
    </div>
  );
}

export default function PlumeAnimee() {
  return (
    <div aria-hidden="true" className="plume-scene">
      <ColonnePlume décalageDépart={0} vitesseMs={42} />
      <div className="plume-espace-carte" />
      <ColonnePlume décalageDépart={3} vitesseMs={47} />

      <style>{`
        .plume-scene {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          display: flex; justify-content: center;
        }
        .plume-espace-carte { width: 520px; flex-shrink: 0; }
        .plume-colonne {
          position: relative;
          flex: 1 1 0;
          max-width: 480px;
          overflow: hidden;
          -webkit-mask-image: linear-gradient(to bottom, transparent 0, transparent 4%, black 18%, black 100%);
          mask-image: linear-gradient(to bottom, transparent 0, transparent 4%, black 18%, black 100%);
        }
        .plume-bloc-bas {
          position: absolute; left: 24px; right: 24px; bottom: 0;
        }
        .plume-texte {
          font-family: 'Dancing Script', cursive;
          font-weight: 700;
          font-size: clamp(20px, 2.6vw, 30px);
          line-height: 1.35;
          color: ${COULEUR};
          opacity: 0.38;
          word-break: break-word;
        }
        .plume-icone {
          position: absolute; top: 0; left: 0;
          font-size: 20px;
          opacity: 0.5;
          filter: drop-shadow(0 0 1px rgba(139,38,53,0.3));
          will-change: transform;
        }
        /* Sous ~980px, la boîte de connexion occupe presque toute la
           largeur : plus de place pour des colonnes latérales lisibles. */
        @media (max-width: 980px) {
          .plume-colonne, .plume-espace-carte { display: none; }
        }
      `}</style>
    </div>
  );
}
