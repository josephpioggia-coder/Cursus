/**
 * CURSUS — Plume animée, page de connexion (24/09/2026)
 * ======================================================================
 * Demande explicite de Joseph : rendre la page de garde dynamique — la
 * plume du logo Cursus traverse la page de gauche à droite en "écrivant"
 * un texte en arrière-plan de la boîte de connexion.
 *
 * Effet machine à écrire (setTimeout, pas de bibliothèque) : une phrase à
 * la fois, tapée caractère par caractère puis effacée, en boucle sur
 * quelques phrases tirées du vrai contenu de Cursus (mode d'emploi /
 * accroches déjà écrites dans EcranChoixEspace.jsx) plutôt qu'inventées
 * ici. Le logo suit la progression de la frappe de gauche à droite —
 * approximatif (basé sur la proportion de caractères tapés, pas la
 * largeur réelle du texte rendu), volontairement : c'est un effet de
 * fond décoratif, pas une précision pixel par pixel qui n'apporterait
 * rien à l'utilisateur.
 *
 * Respecte prefers-reduced-motion : phrase fixe, sans animation ni
 * curseur clignotant, pour qui a demandé moins de mouvement à l'écran.
 */

import { useState, useEffect, useRef } from "react";

const PHRASES = [
  "Un espace d'écriture accompagné par IA.",
  "Le Co-pilote voit vos mots, vos personnages, vos images.",
  "Auditer un texte déjà écrit : preuve, cohérence, risques.",
  "Votre voix reste la vôtre — l'IA accompagne, elle n'écrit pas à votre place.",
];

export default function PlumeAnimee() {
  const réduireMouvement = useRef(
    typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
  const [indexPhrase, setIndexPhrase] = useState(0);
  const [texte, setTexte] = useState(réduireMouvement.current ? PHRASES[0] : "");
  const [effacement, setEffacement] = useState(false);

  useEffect(() => {
    if (réduireMouvement.current) return; // phrase fixe, pas de minuteur
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

  const phraseActuelle = PHRASES[indexPhrase];
  const progression = phraseActuelle.length ? texte.length / phraseActuelle.length : 0;

  return (
    <div aria-hidden="true" style={{
      position: "fixed", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none",
    }}>
      <div style={{
        position: "absolute", top: "50%", left: 0, right: 0, transform: "translateY(-50%)",
        padding: "0 6vw", whiteSpace: "nowrap", overflow: "hidden",
      }}>
        <span style={{
          fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic",
          fontSize: "clamp(18px, 3.6vw, 38px)", color: "#7F77DD", opacity: 0.13,
          letterSpacing: "0.01em",
        }}>
          {texte}
          {!réduireMouvement.current && (
            <span style={{ animation: "plume-clignote 1s step-end infinite" }}>▌</span>
          )}
        </span>
      </div>
      {!réduireMouvement.current && (
        <img src="/logo-cursus.png" alt="" style={{
          position: "absolute", top: "50%", width: 30, height: 30, borderRadius: 7,
          left: `calc(6vw + ${progression * 82}vw)`,
          transform: "translateY(calc(-50% - 14px)) rotate(-10deg)",
          transition: "left 0.05s linear", opacity: 0.45,
        }} />
      )}
      <style>{`@keyframes plume-clignote { 50% { opacity: 0; } }`}</style>
    </div>
  );
}
