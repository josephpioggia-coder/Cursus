/**
 * CURSUS — Texte animé en arrière-plan, page de connexion (24/09/2026)
 * ======================================================================
 * Demande initiale : la plume du logo traverse la page en écrivant un
 * texte en arrière-plan. CORRECTIF le jour même, retour direct de
 * Joseph : "non pas de plume, le texte inséré d'un coup sans latence
 * entre les lettres, aucune impression de mouvement, et le caractère
 * devrait être en cursive."
 *
 * - Logo mobile retiré entièrement (demande explicite).
 * - "Inséré d'un coup" : la version précédente respectait
 *   prefers-reduced-motion et, sur une machine où ce réglage système est
 *   actif, affichait la phrase complète sans aucune animation — very
 *   probablement la cause exacte du symptôme décrit. Volontairement
 *   retiré : effet purement décoratif (texte qui apparaît, aucun
 *   mouvement de position ni flash), pas le genre d'animation que
 *   prefers-reduced-motion vise à éviter.
 * - Police cursive : Dancing Script (Google Fonts, chargée dans
 *   index.html), à la place de Playfair Display en italique.
 */

import { useState, useEffect } from "react";

const PHRASES = [
  "Un espace d'écriture accompagné par IA.",
  "Le Co-pilote voit vos mots, vos personnages, vos images.",
  "Auditer un texte déjà écrit : preuve, cohérence, risques.",
  "Votre voix reste la vôtre — l'IA accompagne, elle n'écrit pas à votre place.",
];

export default function PlumeAnimee() {
  const [indexPhrase, setIndexPhrase] = useState(0);
  const [texte, setTexte] = useState("");
  const [effacement, setEffacement] = useState(false);

  useEffect(() => {
    const phraseActuelle = PHRASES[indexPhrase];
    let timer;
    if (!effacement) {
      if (texte.length < phraseActuelle.length) {
        timer = setTimeout(() => setTexte(phraseActuelle.slice(0, texte.length + 1)), 45);
      } else {
        timer = setTimeout(() => setEffacement(true), 2200);
      }
    } else {
      if (texte.length > 0) {
        timer = setTimeout(() => setTexte(texte.slice(0, -1)), 20);
      } else {
        setEffacement(false);
        setIndexPhrase((i) => (i + 1) % PHRASES.length);
      }
    }
    return () => clearTimeout(timer);
  }, [texte, effacement, indexPhrase]);

  return (
    <div aria-hidden="true" style={{
      position: "fixed", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none",
      display: "flex", alignItems: "center",
    }}>
      <div style={{ width: "100%", padding: "0 6vw", whiteSpace: "nowrap", overflow: "hidden" }}>
        <span style={{
          fontFamily: "'Dancing Script', cursive",
          fontWeight: 700,
          fontSize: "clamp(24px, 4.6vw, 48px)",
          color: "#7F77DD",
          opacity: 0.16,
        }}>
          {texte}
          <span style={{ animation: "plume-clignote 1s step-end infinite" }}>|</span>
        </span>
      </div>
      <style>{`@keyframes plume-clignote { 50% { opacity: 0; } }`}</style>
    </div>
  );
}
