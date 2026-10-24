/**
 * Une remarque de l'IA, avec — quand elle propose un remplacement — deux
 * boutons : « Copier » et « Remplacer dans le texte » (24/10/2026).
 */
import { useState } from "react";
import { separerProposition, remplacerDansLeTexte } from "../lib/propositions.js";

export default function RemarqueAvecProposition({ ligne, editor, onRemplace, couleur = "#0F6E56" }) {
  const { note, extrait, proposition } = separerProposition(ligne);
  const [état, setÉtat] = useState(null); // copie | remplace | introuvable

  const copier = async () => {
    try { await navigator.clipboard.writeText(proposition); setÉtat("copie"); }
    catch { setÉtat("copie-impossible"); }
  };
  const remplacer = () => {
    const r = remplacerDansLeTexte(editor, extrait, proposition);
    if (r === "ok") { onRemplace?.(); setÉtat("remplace"); } else setÉtat("introuvable");
  };
  const bouton = { fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", border: `0.5px solid ${couleur}`, background: "#fff", color: couleur };

  return (
    <>
      <span style={{ overflowWrap: "anywhere" }}>{note}</span>
      {proposition && (
        <div style={{ marginTop: 6, background: "#E1F5EE", borderRadius: 6, padding: "8px 10px" }}>
          <div style={{ fontSize: 11, color: "#0F6E56", fontWeight: 600, marginBottom: 3 }}>PROPOSITION</div>
          <div style={{ fontSize: 13, color: "#0F6E56", lineHeight: 1.55, overflowWrap: "anywhere" }}>{proposition}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button style={bouton} onClick={copier}>📋 Copier</button>
            {extrait && état !== "remplace" && <button style={{ ...bouton, background: couleur, color: "#fff" }} onClick={remplacer}>↪ Remplacer dans le texte</button>}
            {état === "copie" && <span style={{ fontSize: 11.5, color: "#0F6E56" }}>✓ copié</span>}
            {état === "copie-impossible" && <span style={{ fontSize: 11.5, color: "#A32D2D" }}>copie impossible ici : sélectionnez le texte ci-dessus</span>}
            {état === "remplace" && <span style={{ fontSize: 11.5, color: "#0F6E56" }}>✓ remplacé dans le texte (Ctrl+Z pour annuler)</span>}
            {état === "introuvable" && <span style={{ fontSize: 11.5, color: "#A32D2D" }}>passage introuvable ou en double (texte modifié ?) : copiez et collez à la main</span>}
          </div>
        </div>
      )}
    </>
  );
}
