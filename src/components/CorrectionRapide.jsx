/**
 * CURSUS — Correction rapide (22/10/2026) — voir src/lib/correctionRapide.js.
 * Fenêtre ouverte par le bouton « ✨ Correction rapide » de l'en-tête de
 * l'éditeur : choix (sélection / tout le chapitre, niveau) → analyse →
 * revue des changements (diff mot à mot, décochable par paragraphe) →
 * application en UNE transaction TipTap (un seul Ctrl+Z pour tout annuler).
 *
 * Seuls les paragraphes ne contenant QUE du texte (pas d'image, de note ni
 * de saut de ligne) sont envoyés : les remplacer ferait perdre ces éléments.
 * Les changements sont appliqués comme de petits remplacements ciblés, donc
 * le gras/italique du reste du paragraphe est conservé.
 */

import { useMemo, useRef, useState } from "react";
import { journaliserErreur } from "../lib/journalErreurs.js";
import { NIVEAUX, decouperEnLots, corrigerTout, diffMots } from "../lib/correctionRapide.js";

/** Paragraphes (blocs de texte) du document, avec leur position. */
function lireParagraphes(editor, seulementSélection) {
  const { from, to, empty } = editor.state.selection;
  const filtrer = seulementSélection && !empty;
  const liste = [];
  let rang = 0;
  let ignorés = 0;
  editor.state.doc.descendants((nœud, pos) => {
    if (!nœud.isTextblock) return true;
    const idx = ++rang;
    const fin = pos + nœud.nodeSize;
    if (filtrer && (fin <= from || pos >= to)) return false;
    let texte = "";
    let purTexte = true;
    nœud.forEach((enfant) => { if (enfant.isText) texte += enfant.text; else purTexte = false; });
    // Moins de 3 mots (« Envoyer », icônes, titres d'interface) : rien à corriger,
    // et ça ne ferait que produire des remarques parasites.
    if (texte.split(/\s+/).filter((m) => /\p{L}/u.test(m)).length < 3) return false;
    if (!purTexte) { ignorés++; return false; }
    liste.push({ idx, texte, pos: pos + 1 });
    return false;
  });
  return { liste, ignorés, filtrer };
}

export default function CorrectionRapide({ editor, couleur = "#7F77DD", onFermer }) {
  const [étape, setÉtape] = useState("choix"); // choix | encours | revue
  const aSélection = !editor.state.selection.empty;
  const [portée, setPortée] = useState(aSélection ? "sélection" : "tout");
  const [niveau, setNiveau] = useState(() => localStorage.getItem("cursus-correction-niveau") || "fluidite");
  const [progrès, setProgrès] = useState({ faits: 0, total: 0 });
  const [erreur, setErreur] = useState(null);
  const [résultat, setRésultat] = useState(null); // { cartes, remarques, ignorés, échecs }
  const [refusés, setRefusés] = useState(() => new Set());
  const [appliqué, setAppliqué] = useState(null);
  const contrôleur = useRef(null);

  const lancer = async () => {
    localStorage.setItem("cursus-correction-niveau", niveau);
    const { liste, ignorés } = lireParagraphes(editor, portée === "sélection");
    if (!liste.length) { setErreur("Aucun texte à corriger."); return; }
    setErreur(null);
    setÉtape("encours");
    const lots = decouperEnLots(liste);
    setProgrès({ faits: 0, total: lots.length });
    contrôleur.current = new AbortController();
    try {
      const r = await corrigerTout(lots, niveau, {
        signal: contrôleur.current.signal,
        surProgres: (faits, total) => setProgrès({ faits, total }),
      });
      const cartes = [];
      for (const p of liste) {
        const corrigé = r.corrections.get(p.idx);
        if (corrigé === undefined || corrigé === p.texte) continue;
        const d = diffMots(p.texte, corrigé);
        if (d.hunks.length) cartes.push({ ...p, corrigé, segments: d.segments, hunks: d.hunks });
      }
      if (r.échecs) journaliserErreur("CorrectionRapide", `${r.échecs}/${lots.length} lot(s) en échec : ${r.premièreErreur?.message}`);
      setRésultat({ cartes, remarques: r.remarques, ignorés, échecs: r.échecs, message: r.premièreErreur?.message });
      setRefusés(new Set());
      setÉtape("revue");
    } catch (e) {
      if (e?.name === "AbortError") { setÉtape("choix"); return; }
      journaliserErreur("CorrectionRapide", e?.message || String(e));
      setErreur(e?.message || "La correction a échoué.");
      setÉtape("choix");
    }
  };

  const annuler = () => { contrôleur.current?.abort(); setÉtape("choix"); };

  const retenues = useMemo(
    () => (résultat ? résultat.cartes.filter((c) => !refusés.has(c.idx)) : []),
    [résultat, refusés],
  );

  const appliquer = () => {
    // Le texte a pu changer pendant la revue : on relit le document et on
    // n'applique un paragraphe que s'il est resté strictement identique.
    const actuels = new Map(lireParagraphes(editor, false).liste.map((p) => [p.idx, p]));
    const remplacements = [];
    let périmés = 0;
    for (const c of retenues) {
      const actuel = actuels.get(c.idx);
      if (!actuel || actuel.texte !== c.texte) { périmés++; continue; }
      for (const h of c.hunks) remplacements.push({ de: actuel.pos + h.debut, à: actuel.pos + h.fin, texte: h.remplacement });
    }
    remplacements.sort((a, b) => b.de - a.de);
    const tr = editor.state.tr;
    for (const r of remplacements) {
      if (r.texte) tr.insertText(r.texte, r.de, r.à);
      else tr.delete(r.de, r.à);
    }
    if (remplacements.length) editor.view.dispatch(tr);
    setAppliqué({ n: retenues.length - périmés, périmés });
  };

  const bascule = (idx) => setRefusés((anc) => {
    const n = new Set(anc);
    if (n.has(idx)) n.delete(idx); else n.add(idx);
    return n;
  });

  const bouton = (principal) => ({
    fontSize: 13, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
    border: principal ? "none" : "0.5px solid #ccc",
    background: principal ? couleur : "#fff", color: principal ? "#fff" : "#555",
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 760, maxHeight: "92vh", display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #e5e5e5", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 500, flex: 1 }}>✨ Correction rapide</span>
          <button onClick={onFermer} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#999" }} title="Fermer">✕</button>
        </div>

        <div style={{ padding: 18, overflowY: "auto", minHeight: 0, flex: 1 }}>
          {étape === "choix" && (
            <>
              <p style={{ fontSize: 13, color: "#555", margin: "0 0 14px", lineHeight: 1.5 }}>
                Une seule passe sur le texte : l'IA corrige, vous voyez tous les changements d'un coup, puis vous
                appliquez (ou décochez ceux que vous refusez). Rien n'est modifié avant votre accord, et un Ctrl+Z annule tout.
                Elle ne réécrit pas : les fragments et les doutes sur un fait sont seulement signalés.
              </p>
              <div style={{ fontSize: 12.5, color: "#777", marginBottom: 6 }}>Quoi corriger ?</div>
              <label style={{ display: "block", fontSize: 13, marginBottom: 4, opacity: aSélection ? 1 : 0.45 }}>
                <input type="radio" disabled={!aSélection} checked={portée === "sélection"} onChange={() => setPortée("sélection")} /> La sélection en cours
              </label>
              <label style={{ display: "block", fontSize: 13, marginBottom: 14 }}>
                <input type="radio" checked={portée === "tout"} onChange={() => setPortée("tout")} /> Tout le chapitre
              </label>
              <div style={{ fontSize: 12.5, color: "#777", marginBottom: 6 }}>Niveau</div>
              {Object.entries(NIVEAUX).map(([clé, label]) => (
                <label key={clé} style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
                  <input type="radio" checked={niveau === clé} onChange={() => setNiveau(clé)} /> {label}
                </label>
              ))}
              {erreur && <div style={{ marginTop: 12, fontSize: 12.5, color: "#A32D2D", background: "#FBE9E9", padding: "8px 10px", borderRadius: 6 }}>{erreur}</div>}
            </>
          )}

          {étape === "encours" && (
            <div style={{ textAlign: "center", padding: "30px 0", fontSize: 13.5, color: "#555" }}>
              ⏳ Correction en cours… {progrès.faits}/{progrès.total} partie{progrès.total > 1 ? "s" : ""}
              <div style={{ height: 6, background: "#eee", borderRadius: 3, margin: "14px auto 0", maxWidth: 320 }}>
                <div style={{ height: 6, borderRadius: 3, background: couleur, width: `${progrès.total ? (progrès.faits / progrès.total) * 100 : 0}%`, transition: "width 0.3s" }} />
              </div>
            </div>
          )}

          {étape === "revue" && résultat && !appliqué && (
            <>
              <div style={{ fontSize: 13, color: "#555", marginBottom: 10 }}>
                {résultat.cartes.length
                  ? `${résultat.cartes.length} paragraphe${résultat.cartes.length > 1 ? "s" : ""} corrigé${résultat.cartes.length > 1 ? "s" : ""} — ${retenues.length} retenu${retenues.length > 1 ? "s" : ""}.`
                  : "Aucune faute trouvée."}
                {résultat.ignorés > 0 && ` (${résultat.ignorés} paragraphe${résultat.ignorés > 1 ? "s" : ""} avec image ou note, non traité${résultat.ignorés > 1 ? "s" : ""}.)`}
              </div>
              {résultat.échecs > 0 && (
                <div style={{ fontSize: 12.5, color: "#A32D2D", background: "#FBE9E9", padding: "8px 10px", borderRadius: 6, marginBottom: 10 }}>
                  {résultat.échecs} partie{résultat.échecs > 1 ? "s" : ""} du texte n'{résultat.échecs > 1 ? "ont" : "a"} pas pu être corrigée{résultat.échecs > 1 ? "s" : ""} ({résultat.message}). Relancez pour les reprendre.
                </div>
              )}
              {résultat.cartes.map((c) => {
                const garde = !refusés.has(c.idx);
                return (
                  <div key={c.idx} style={{ border: "0.5px solid #e5e5e5", borderRadius: 8, padding: "10px 12px", marginBottom: 8, opacity: garde ? 1 : 0.5 }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
                      <input type="checkbox" checked={garde} onChange={() => bascule(c.idx)} style={{ marginTop: 4 }} />
                      <span style={{ fontSize: 13.5, lineHeight: 1.6, color: "#333", minWidth: 0, overflowWrap: "anywhere" }}>
                        {c.segments.map((s, i) => s.type === "eq" ? <span key={i}>{s.texte}</span>
                          : s.type === "del" ? <span key={i} style={{ background: "#FBE9E9", color: "#A32D2D", textDecoration: "line-through" }}>{s.texte}</span>
                          : <span key={i} style={{ background: "#E1F5EE", color: "#0F6E56", fontWeight: 500 }}>{s.texte}</span>)}
                      </span>
                    </label>
                  </div>
                );
              })}
              {résultat.remarques.length > 0 && (
                <div style={{ marginTop: 14, background: "#FFF8E6", border: "0.5px solid #F0D98A", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "#7A5B00", marginBottom: 6 }}>À regarder vous-même (non modifié)</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#5a4a1a", lineHeight: 1.55 }}>
                    {résultat.remarques.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}

          {appliqué && (
            <div style={{ textAlign: "center", padding: "26px 0", fontSize: 14, color: "#0F6E56" }}>
              ✓ {appliqué.n} paragraphe{appliqué.n > 1 ? "s" : ""} corrigé{appliqué.n > 1 ? "s" : ""}.
              {appliqué.périmés > 0 && <div style={{ fontSize: 12.5, color: "#A32D2D", marginTop: 8 }}>{appliqué.périmés} ignoré{appliqué.périmés > 1 ? "s" : ""} : texte modifié pendant la revue.</div>}
              <div style={{ fontSize: 12.5, color: "#888", marginTop: 8 }}>Ctrl+Z annule toute la correction d'un coup.</div>
            </div>
          )}
        </div>

        <div style={{ padding: "12px 18px", borderTop: "0.5px solid #e5e5e5", display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {étape === "choix" && <><button style={bouton(false)} onClick={onFermer}>Fermer</button><button style={bouton(true)} onClick={lancer}>Lancer la correction</button></>}
          {étape === "encours" && <button style={bouton(false)} onClick={annuler}>Annuler</button>}
          {étape === "revue" && !appliqué && (
            <>
              <button style={bouton(false)} onClick={onFermer}>Tout refuser</button>
              {résultat?.échecs > 0 && <button style={bouton(false)} onClick={lancer}>Relancer</button>}
              {retenues.length > 0 && <button style={bouton(true)} onClick={appliquer}>Appliquer {retenues.length === résultat.cartes.length ? "tout" : `les ${retenues.length} retenus`}</button>}
            </>
          )}
          {appliqué && <button style={bouton(true)} onClick={onFermer}>Fermer</button>}
        </div>
      </div>
    </div>
  );
}
