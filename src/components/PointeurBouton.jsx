/**
 * CURSUS — « Pointer un bouton » (28/10/2026) : le prochain clic ne déclenche RIEN, il désigne seulement l'élément
 * (surligné au survol). Échap annule. Le texte du livre n'est jamais lu (voir decrireElement).
 */
import { useEffect, useState } from "react";
import { decrireElement } from "../lib/aideContextuelle.js";

export default function PointeurBouton({ onChoisi, onAnnuler }) {
  const [rect, setRect] = useState(null);
  const [libelle, setLibelle] = useState("");
  useEffect(() => {
    const cible = (e) => e.target?.closest?.("[data-pointeur-ignore]") ? null : e.target;
    const survol = (e) => {
      const t = cible(e); if (!t) return setRect(null);
      const b = t.closest("button, [role=button], a, select, input, label, [title], [aria-label]") || t;
      const r = b.getBoundingClientRect();
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
      setLibelle(decrireElement(t));
    };
    const clic = (e) => {
      const t = cible(e); if (!t) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      const l = decrireElement(t);
      l ? onChoisi(l) : onAnnuler();
    };
    const touche = (e) => { if (e.key === "Escape") onAnnuler(); };
    document.addEventListener("mouseover", survol, true);
    document.addEventListener("click", clic, true);
    document.addEventListener("keydown", touche, true);
    return () => { document.removeEventListener("mouseover", survol, true); document.removeEventListener("click", clic, true); document.removeEventListener("keydown", touche, true); };
  }, [onChoisi, onAnnuler]);
  return (
    <>
      <div data-pointeur-ignore style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 400, background: "#26215C", color: "#fff", padding: "8px 14px", borderRadius: 10, fontSize: 13, boxShadow: "0 4px 16px rgba(0,0,0,.3)", display: "flex", gap: 12, alignItems: "center" }}>
        <span>Cliquez sur le bouton qui vous intrigue (rien ne sera déclenché)</span>
        <button data-pointeur-ignore onClick={onAnnuler} style={{ background: "#fff2", border: "none", color: "#fff", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
      </div>
      {rect && (
        <div style={{ position: "fixed", left: rect.left - 2, top: rect.top - 2, width: rect.width + 4, height: rect.height + 4, border: "2px solid #E8A33D", borderRadius: 6, background: "#E8A33D22", pointerEvents: "none", zIndex: 399 }}>
          {libelle && <span style={{ position: "absolute", top: "100%", left: 0, marginTop: 2, background: "#E8A33D", color: "#1a1a1a", fontSize: 11, padding: "1px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>{libelle}</span>}
        </div>
      )}
    </>
  );
}
