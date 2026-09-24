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
 * CORRECTIF (même jour) — l'ancrage en bas (bottom: 0) plaçait la ligne
 * en cours d'écriture, et donc la plume, en permanence collée au bord
 * inférieur de l'écran ("la plume se trouve sous la page"). Retour
 * explicite : le texte doit démarrer normalement en haut à gauche et
 * descendre ligne par ligne comme une page qui se remplit ; le
 * défilement (anciennes lignes qui remontent hors champ) ne doit
 * commencer qu'à partir des 3/4 de la hauteur — pas dès la première
 * ligne — à la fois pour garder la plume visible et pour aérer le texte.
 *
 * TECHNIQUE — le bloc de texte reste en flux normal, ancré en HAUT
 * (top: 0), et grandit naturellement vers le bas. Un décalage
 * `translateY` négatif, recalculé à chaque caractère, ne s'applique que
 * lorsque la hauteur du texte dépasse 75% de la hauteur du conteneur —
 * en dessous de ce seuil, décalage nul, la page se remplit simplement.
 * Un masque en dégradé sur le conteneur fait disparaître les lignes qui
 * sortent par le haut en fondu plutôt qu'en coupure nette. Deux colonnes
 * indépendantes (gauche/droite), laissant vide la largeur de la boîte de
 * connexion entre les deux — plus simple et plus robuste qu'un vrai
 * contournement CSS (shape-outside) autour d'un élément qui bouge selon
 * l'écran.
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
  const blocRef = useRef(null);
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

      // Décalage vers le haut UNIQUEMENT après 3/4 de la hauteur du
      // conteneur (demande explicite) — avant ce seuil, décalage nul, le
      // texte se contente de remplir la page normalement depuis le haut.
      if (blocRef.current && conteneurRef.current) {
        const hauteurConteneur = conteneurRef.current.clientHeight;
        const hauteurContenu = blocRef.current.scrollHeight;
        const seuil = hauteurConteneur * 0.75;
        const décalage = Math.max(0, hauteurContenu - seuil);
        blocRef.current.style.transform = `translateY(-${décalage}px)`;
      }

      // Position de la plume = position du caret (fin du texte révélé,
      // APRÈS application du décalage ci-dessus), plus un léger mouvement
      // vertical continu (sinusoïde) pour ne pas rester rigide sur une
      // ligne droite.
      if (caretRef.current && conteneurRef.current && plumeRef.current) {
        const rectCaret = caretRef.current.getBoundingClientRect();
        const rectConteneur = conteneurRef.current.getBoundingClientRect();
        const x = rectCaret.left - rectConteneur.left;
        const y = rectCaret.top - rectConteneur.top;
        const t = (performance.now() - départRef.current) / 1000;
        // Fréquence ralentie de 10% (24/09/2026, retour : "mal de mer").
        const bob = Math.sin(t * 4.68) * 6; // ~1,1 aller-retour/seconde
        // CORRECTIF — signalé : la pointe de la plume tombait sur la ligne
        // du DESSOUS plutôt que sur les lettres écrites. Cause : le calcul
        // précédent centrait la BOÎTE de l'émoji (72×72) sur le caret, pas
        // sa pointe (en bas à gauche du glyphe 🪶). Combiné à
        // `transform-origin` déplacé sur cette même pointe (voir CSS) —
        // la rotation pivote maintenant autour d'elle au lieu du centre de
        // la boîte, donc la pointe reste ancrée près du caret même
        // pendant l'oscillation, plutôt que de dériver avec la rotation.
        // Réajusté (24/09/2026, retour) : encore un peu plus haut, pointe
        // au niveau du bas des lettres (ligne de base), pas en dessous.
        plumeRef.current.style.transform = `translate(${x - 16}px, ${y + bob - 74}px) rotate(${Math.sin(t * 4.68) * 10 - 25}deg)`;
      }

      timerId = setTimeout(tick, vitesseMs);
    };

    timerId = setTimeout(tick, vitesseMs);
    return () => { annulé = true; clearTimeout(timerId); };
  }, [vitesseMs]);

  return (
    <div ref={conteneurRef} className="plume-colonne">
      <div ref={blocRef} className="plume-bloc">
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
        .plume-bloc {
          position: absolute; left: 24px; right: 24px; top: 24px;
          transition: transform 0.05s linear;
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
          font-size: 72px;
          opacity: 0.7;
          filter: drop-shadow(0 0 1px rgba(139,38,53,0.3));
          will-change: transform;
          /* Pivot sur la pointe du glyphe (bas-gauche), pas le centre de
             la boîte — la rotation ne doit pas éloigner la pointe du
             caret pendant l'oscillation. */
          transform-origin: 22% 85%;
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
