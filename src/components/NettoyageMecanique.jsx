/**
 * CURSUS — « Nettoyage mécanique » (étape 0 du parcours de reconstruction, 24/10/2026)
 * Voir src/lib/nettoyageMecanique.js et docs/note-conception-DREM.md. AUCUNE IA :
 * règles déterministes avec aperçu, application en une transaction (Ctrl+Z annule),
 * version sauvegardée dans l'historique juste avant.
 */
import { useMemo, useState } from "react";
import { lireTexteComplet } from "../lib/paragraphesEditeur.js";
import {
  REGLES, SIGNALEMENTS, analyserTypographie, pointsFinaux, analyserRepetitions, transformerSegment,
} from "../lib/nettoyageMecanique.js";

/** Segments de texte continus du document (un par suite de caractères de même mise en forme). */
function lireSegments(editor, seulementSélection) {
  const { from, to, empty } = editor.state.selection;
  const filtrer = seulementSélection && !empty;
  const segments = [];
  const paragraphes = [];
  editor.state.doc.descendants((nœud, pos) => {
    if (nœud.isTextblock) {
      const fin = pos + nœud.nodeSize;
      if (filtrer && (fin <= from || pos >= to)) return false;
      let dernier = null;
      nœud.forEach((enfant, décalage) => {
        if (enfant.isText) {
          dernier = { pos: pos + 1 + décalage, texte: enfant.text, marks: enfant.marks };
          segments.push(dernier);
        } else dernier = null;
      });
      // point final : seulement si le bloc se termine par du texte
      if (dernier && nœud.type.name === "paragraph") {
        const fin = dernier.texte.replace(/\s+$/u, "").length;
        paragraphes.push({ pos: 0, texte: nœud.textContent, finPos: dernier.pos + fin });
      }
      return false;
    }
    return true;
  });
  return { segments, paragraphes };
}

const COULEURS = { fond: "#F5F4FD", bord: "#D8D5F5", titre: "#4B44A8" };

export default function NettoyageMecanique({ editor, couleur = "#7F77DD", onAvantModification, onFermer }) {
  const aSélection = !editor.state.selection.empty;
  const [portée, setPortée] = useState(aSélection ? "sélection" : "tout");
  const [onglet, setOnglet] = useState("typo");
  const [actives, setActives] = useState(() => new Set(REGLES.filter((r) => r.defaut).map((r) => r.id)));
  const [version, setVersion] = useState(0); // force le recalcul après application
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const typo = useMemo(() => {
    const { segments, paragraphes } = lireSegments(editor, portée === "sélection");
    const tous = new Set([...actives].filter((id) => id !== "pointFinal"));
    const { changements, signalements } = analyserTypographie(segments, tous);
    const finaux = actives.has("pointFinal") ? pointsFinaux(paragraphes) : [];
    return { segments, paragraphes, changements: [...changements, ...finaux], signalements };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, portée, actives, version]);

  const rythme = useMemo(() => {
    const { liste } = lireTexteComplet(editor, portée === "sélection");
    return analyserRepetitions(liste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, portée, version]);

  const parRegle = useMemo(() => {
    const m = {};
    for (const c of typo.changements) (m[c.regle] ||= []).push(c);
    return m;
  }, [typo]);

  const bascule = (id) => setActives((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const appliquer = async () => {
    setEnCours(true);
    setMessage(null);
    try {
      await onAvantModification?.();
      const { segments, paragraphes } = lireSegments(editor, portée === "sélection");
      const idsTexte = new Set([...actives].filter((id) => id !== "pointFinal"));
      const opérations = []; // { de, à, texte, marks }
      let total = 0;
      for (const s of segments) {
        const r = transformerSegment(s.texte, idsTexte);
        if (r.texte !== s.texte) { opérations.push({ de: s.pos, à: s.pos + s.texte.length, texte: r.texte, marks: s.marks }); total += r.n; }
      }
      if (actives.has("pointFinal")) {
        for (const c of pointsFinaux(paragraphes)) {
          opérations.push({ de: c.de, à: c.à, texte: ".", marks: null });
          total++;
        }
      }
      if (!opérations.length) { setMessage("Rien à modifier avec les règles cochées."); setEnCours(false); return; }
      opérations.sort((a, b) => b.à - a.à || b.de - a.de);
      const tr = editor.state.tr;
      for (const o of opérations) {
        if (o.marks) tr.replaceWith(o.de, o.à, editor.state.schema.text(o.texte, o.marks));
        else tr.insertText(o.texte, o.de, o.à);
      }
      editor.view.dispatch(tr);
      setMessage(`✓ ${total} changement${total > 1 ? "s" : ""} appliqué${total > 1 ? "s" : ""}. Ctrl+Z les annule d'un coup ; la version précédente est dans l'historique.`);
      setVersion((v) => v + 1);
    } catch (e) {
      setMessage("Impossible d'appliquer : " + (e?.message || "erreur inconnue"));
    }
    setEnCours(false);
  };

  const total = typo.changements.length;
  const bouton = (principal) => ({
    fontSize: 13, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
    border: principal ? "none" : "0.5px solid #ccc", background: principal ? couleur : "#fff", color: principal ? "#fff" : "#555",
  });
  const onglet_ = (id, label) => (
    <button onClick={() => setOnglet(id)} style={{ fontSize: 13, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", border: "none", background: onglet === id ? `${couleur}22` : "transparent", color: onglet === id ? couleur : "#666", fontWeight: onglet === id ? 600 : 400 }}>{label}</button>
  );
  const carte = { background: COULEURS.fond, border: `0.5px solid ${COULEURS.bord}`, borderRadius: 8, padding: "10px 12px", marginBottom: 10 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 760, maxHeight: "92vh", display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #e5e5e5", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 500, flex: 1 }}>🧹 Nettoyage mécanique</span>
          <button onClick={onFermer} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#999" }} title="Fermer">✕</button>
        </div>

        <div style={{ padding: "10px 18px 0", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {onglet_("typo", "Typographie")}
          {onglet_("rythme", "Répétitions et rythme")}
          <span style={{ flex: 1 }} />
          <label style={{ fontSize: 12, color: "#777", opacity: aSélection ? 1 : 0.45 }}>
            <input type="radio" disabled={!aSélection} checked={portée === "sélection"} onChange={() => setPortée("sélection")} /> sélection
          </label>
          <label style={{ fontSize: 12, color: "#777" }}>
            <input type="radio" checked={portée === "tout"} onChange={() => setPortée("tout")} /> tout le chapitre
          </label>
        </div>

        <div style={{ padding: 18, overflowY: "auto", minHeight: 0, flex: 1 }}>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 12px", lineHeight: 1.5 }}>
            Aucune IA : des règles fixes que vous voyez avant de les appliquer. Rien ne change sans votre clic.
          </p>

          {onglet === "typo" && (
            <>
              {REGLES.map((r) => {
                const liste = parRegle[r.id] || [];
                return (
                  <div key={r.id} style={carte}>
                    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
                      <input type="checkbox" checked={actives.has(r.id)} onChange={() => bascule(r.id)} style={{ marginTop: 3 }} />
                      <span style={{ flex: 1, fontSize: 13, color: "#333", lineHeight: 1.45 }}>{r.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: liste.length ? COULEURS.titre : "#aaa", whiteSpace: "nowrap" }}>{actives.has(r.id) ? liste.length : "—"}</span>
                    </label>
                    {actives.has(r.id) && liste.slice(0, 3).map((c, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#666", marginTop: 5, marginLeft: 24, overflowWrap: "anywhere" }}>
                        <span style={{ background: "#FBE9E9", color: "#A32D2D" }}>{c.avant || "∅"}</span> → <span style={{ background: "#E1F5EE", color: "#0F6E56" }}>{c.remplacement.replace(/ /g, "⍽").replace(/ /g, "⍽") || "∅"}</span>
                        <span style={{ color: "#999" }}> — {c.contexte}</span>
                      </div>
                    ))}
                  </div>
                );
              })}

              {typo.signalements.length > 0 && (
                <div style={{ ...carte, background: "#FFF8E6", borderColor: "#F0D98A" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "#7A5B00", marginBottom: 6 }}>À regarder vous-même (jamais corrigé automatiquement)</div>
                  {SIGNALEMENTS.map((sg) => {
                    const l = typo.signalements.filter((x) => x.regle === sg.id);
                    return l.length > 0 && (
                      <div key={sg.id} style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 12.5, color: "#333" }}>{sg.label} — <b>{l.length}</b></div>
                        {l.slice(0, 3).map((x, i) => <div key={i} style={{ fontSize: 12, color: "#666", marginLeft: 10, overflowWrap: "anywhere" }}>{x.contexte}</div>)}
                      </div>
                    );
                  })}
                </div>
              )}
              {message && <div style={{ fontSize: 13, color: message.startsWith("✓") ? "#0F6E56" : "#A32D2D", background: message.startsWith("✓") ? "#E1F5EE" : "#FBE9E9", padding: "8px 10px", borderRadius: 6 }}>{message}</div>}
            </>
          )}

          {onglet === "rythme" && (
            <>
              <div style={carte}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: COULEURS.titre, marginBottom: 6 }}>Rythme (repères, pas des notes)</div>
                <div style={{ fontSize: 13, color: "#333", lineHeight: 1.7 }}>
                  {rythme.mots.toLocaleString("fr-FR")} mots · {rythme.nbPhrases} phrases · {rythme.moyenne} mots par phrase en moyenne<br />
                  Paragraphes d'une seule phrase : <b>{rythme.uneSeulePhrase}</b> sur {rythme.paragraphes}
                  {rythme.paragraphes > 0 && ` (${Math.round((rythme.uneSeulePhrase / rythme.paragraphes) * 100)} %)`}
                </div>
                {rythme.longues.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: "#777", marginBottom: 3 }}>Phrases de plus de 40 mots :</div>
                    {rythme.longues.map((p, i) => <div key={i} style={{ fontSize: 12, color: "#555", overflowWrap: "anywhere" }}>{p.mots} mots — {p.extrait}</div>)}
                  </div>
                )}
              </div>

              <div style={carte}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: COULEURS.titre, marginBottom: 6 }}>Tournures qui reviennent (tics, atténuateurs)</div>
                {rythme.tics.length === 0 ? <div style={{ fontSize: 13, color: "#666" }}>Aucune tournure répétée au-delà des repères (2 fois pour une expression, 4 pour un mot).</div> : rythme.tics.map((t) => (
                  <div key={t.expression} style={{ fontSize: 13, color: "#333" }}>« {t.expression} » — <b>{t.n}</b> fois <span style={{ color: "#999" }}>({t.pour1000} pour 1 000 mots)</span></div>
                ))}
              </div>

              <div style={carte}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: COULEURS.titre, marginBottom: 6 }}>Mots répétés de près (3 fois en moins de 40 mots)</div>
                {rythme.repetitions.length === 0 ? <div style={{ fontSize: 13, color: "#666" }}>Aucun.</div> : rythme.repetitions.map((r, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: "#333", marginBottom: 4, overflowWrap: "anywhere" }}>« {r.mot} » ×{r.n} — <span style={{ color: "#666" }}>{r.extrait}</span></div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: "#999", lineHeight: 1.5 }}>
                Ce sont des repères pour vous aider à regarder ; certaines répétitions sont voulues. Aucun seuil n'est validé scientifiquement. Ces compteurs ne modifient jamais le texte.
              </div>
            </>
          )}
        </div>

        <div style={{ padding: "12px 18px", borderTop: "0.5px solid #e5e5e5", display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button style={bouton(false)} onClick={onFermer}>Fermer</button>
          {onglet === "typo" && <button style={{ ...bouton(true), opacity: total && !enCours ? 1 : 0.5 }} disabled={!total || enCours} onClick={appliquer}>{enCours ? "Application…" : `Appliquer (au moins ${total} changement${total > 1 ? "s" : ""})`}</button>}
        </div>
      </div>
    </div>
  );
}
