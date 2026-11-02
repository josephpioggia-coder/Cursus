/**
 * CURSUS — « 🔡 Statistiques » (03/11/2026) : mots, caractères, paragraphes, phrases, pages estimées, temps de lecture.
 * Trois portées : la sélection (si elle existe), le chapitre ouvert, tout le livre (corps du livre, chapitres lus d'après leur texte enregistré).
 * Lecture seule : ne modifie jamais le texte. Calcul pur (src/lib/statistiquesTexte.js), aucun appel IA.
 */
import { useEffect, useMemo, useState } from "react";
import { blocsDeDocument, blocsDeHtml, statistiquesDeBlocs, formaterDuree, CARACTERES_PAR_PAGE, MOTS_PAR_MINUTE_LECTURE, MOTS_PAR_MINUTE_VOIX } from "../lib/statistiquesTexte.js";

const bouton = (actif = false) => ({ fontSize: 12, border: "0.5px solid #ccc", background: actif ? "#EEEDFE" : "#fff", color: actif ? "#534AB7" : "#333", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontFamily: "inherit" });
const nombre = (n) => new Intl.NumberFormat("fr-FR").format(n);

export default function StatistiquesTexte({ editor, noeuds = [], noeudId, couleur = "#7F77DD", mobile = false, onFermer }) {
  const [, setTic] = useState(0);
  const sel = editor?.state.selection;
  const aSelection = !!sel && !sel.empty;
  const [portee, setPortee] = useState(aSelection ? "selection" : "chapitre");
  const [horsCorps, setHorsCorps] = useState(false);

  useEffect(() => { // l'éditeur change pendant que la fenêtre est ouverte : on recalcule (sans trop de zèle)
    if (!editor) return undefined;
    let t = null;
    const f = () => { clearTimeout(t); t = setTimeout(() => setTic((x) => x + 1), 400); };
    editor.on("update", f); editor.on("selectionUpdate", f);
    return () => { clearTimeout(t); editor.off("update", f); editor.off("selectionUpdate", f); };
  }, [editor]);

  const peutSelection = !!editor && !editor.state.selection.empty;
  const effective = portee === "selection" && !peutSelection ? "chapitre" : portee;
  const html = editor?.getHTML();
  const { stats, nChapitres } = useMemo(() => {
    if (!editor) return { stats: statistiquesDeBlocs([]), nChapitres: 0 };
    const doc = editor.state.doc;
    if (effective === "selection") { const { from, to } = editor.state.selection; return { stats: statistiquesDeBlocs(blocsDeDocument(doc, from, to)), nChapitres: 1 }; }
    if (effective === "chapitre") return { stats: statistiquesDeBlocs(blocsDeDocument(doc)), nChapitres: 1 };
    const liste = noeuds.filter((n) => horsCorps || n.zone === "corps");
    const blocs = liste.flatMap((n) => (n.id === noeudId ? blocsDeDocument(doc) : blocsDeHtml(n.texte).map((b) => b.texte)));
    return { stats: statistiquesDeBlocs(blocs), nChapitres: liste.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, effective, html, noeuds, noeudId, horsCorps, sel?.from, sel?.to]);

  const lignes = [
    ["Mots", nombre(stats.mots)],
    ["Caractères (espaces compris)", nombre(stats.caracteres)],
    ["Caractères (sans les espaces)", nombre(stats.caracteresSansEspaces)],
    ["Paragraphes", nombre(stats.paragraphes)],
    ["Phrases (estimation)", nombre(stats.phrases)],
    ["Notes de bas de page", nombre(stats.notes)],
    ["Pages estimées", `${nombre(stats.pages)}`],
    ["Mots par phrase (moyenne)", stats.motsParPhrase ? String(stats.motsParPhrase).replace(".", ",") : "—"],
    ["Mot le plus long", stats.plusLong || "—"],
    ["Lecture silencieuse", formaterDuree(stats.minutesLecture)],
    ["Lecture à voix haute", formaterDuree(stats.minutesVoix)],
  ];

  return (
    <div role="dialog" aria-label="Statistiques" data-pointeur-ignore
      style={{ position: "fixed", zIndex: 70, background: "#fff", color: "#1a1a1a", border: "0.5px solid #ccc", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,.18)", padding: 12, display: "flex", flexDirection: "column", gap: 8, fontFamily: "inherit",
        ...(mobile ? { left: 8, right: 8, bottom: 8, maxHeight: "70vh", overflowY: "auto" } : { top: 120, right: 24, width: 360, maxHeight: "75vh", overflowY: "auto" }) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13 }}>🔡 Statistiques</strong>
        <span style={{ flex: 1 }} />
        <button type="button" style={bouton(effective === "selection")} disabled={!peutSelection} onClick={() => setPortee("selection")} title={peutSelection ? undefined : "Sélectionnez d'abord un passage"}>Sélection</button>
        <button type="button" style={bouton(effective === "chapitre")} onClick={() => setPortee("chapitre")}>Ce chapitre</button>
        <button type="button" style={bouton(effective === "livre")} onClick={() => setPortee("livre")}>Tout le livre</button>
        <button type="button" onClick={onFermer} aria-label="Fermer" style={{ border: "none", background: "none", fontSize: 16, color: "#888", cursor: "pointer" }}>✕</button>
      </div>
      {effective === "livre" && (
        <label style={{ fontSize: 12, color: "#555", display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={horsCorps} onChange={(ev) => setHorsCorps(ev.target.checked)} /> Inclure réserve, notes de cadrage et brouillons <span style={{ color: "#888" }}>({nChapitres} chapitre{nChapitres > 1 ? "s" : ""})</span>
        </label>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <tbody>
          {lignes.map(([lib, val]) => (
            <tr key={lib} style={{ borderBottom: "0.5px solid #eee" }}>
              <td style={{ padding: "4px 0", color: "#555" }}>{lib}</td>
              <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 600, color: couleur }}>{val}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {stats.frequents.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Mots les plus employés (4 lettres et plus, au moins 3 fois) :</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {stats.frequents.map(([mot, n]) => <span key={mot} style={{ ...bouton(), cursor: "default" }}>{mot} <b>{n}</b></span>)}
          </div>
        </div>
      )}
      <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>
        Pages estimées à {nombre(CARACTERES_PAR_PAGE)} caractères (Cursus n'a pas de pagination réelle avant l'export). Lecture : {MOTS_PAR_MINUTE_LECTURE} mots/min en silence, {MOTS_PAR_MINUTE_VOIX} à voix haute. Phrases comptées d'après . ! ? … — approximatif. Les chapitres non ouverts sont lus d'après leur dernier texte enregistré.
      </div>
    </div>
  );
}
