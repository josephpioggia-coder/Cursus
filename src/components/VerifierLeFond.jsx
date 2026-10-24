/**
 * CURSUS — Vérifier le fond (22/10/2026) — voir src/lib/verifierLeFond.js.
 * Bouton « 🔎 Vérifier le fond » de l'en-tête de l'éditeur : choix
 * (sélection / chapitre) → extraction des affirmations → vérification de
 * chacune (calcul refait par le code, recherche web, source recoupée) →
 * revue : verdict, source cliquable, reformulation proposée que l'auteur·ice
 * accepte ou non (cochée UNIQUEMENT par lui·elle, jamais par défaut).
 */

import { useRef, useState } from "react";
import { journaliserErreur } from "../lib/journalErreurs.js";
import { lireParagraphes } from "../lib/paragraphesEditeur.js";
import { extraireAffirmations, verifierAffirmations, localiserExtrait, MAX_AFFIRMATIONS } from "../lib/verifierLeFond.js";

const VERDICTS = {
  confirme: { c: "#0F6E56", bg: "#E1F5EE", label: "✓ Confirmé" },
  contredit: { c: "#A32D2D", bg: "#FBE9E9", label: "✕ Contredit" },
  incertain: { c: "#7A5B00", bg: "#FFF8E6", label: "? Incertain" },
};

const nombre = (v) => v.toLocaleString("fr-FR", { maximumSignificantDigits: 4 });

export default function VerifierLeFond({ editor, couleur = "#7F77DD", onFermer }) {
  const [étape, setÉtape] = useState("choix"); // choix | encours | revue
  const aSélection = !editor.state.selection.empty;
  const [portée, setPortée] = useState(aSélection ? "sélection" : "tout");
  const [phase, setPhase] = useState("");
  const [progrès, setProgrès] = useState({ faits: 0, total: 0 });
  const [erreur, setErreur] = useState(null);
  const [résultats, setRésultats] = useState(null);
  const [choisies, setChoisies] = useState(() => new Set());
  const [appliqué, setAppliqué] = useState(null);
  const contrôleur = useRef(null);

  const lancer = async () => {
    const { liste } = lireParagraphes(editor, portée === "sélection");
    if (!liste.length) { setErreur("Aucun texte à vérifier."); return; }
    setErreur(null);
    setÉtape("encours");
    setPhase("Repérage des affirmations vérifiables…");
    setProgrès({ faits: 0, total: 0 });
    contrôleur.current = new AbortController();
    try {
      const affirmations = await extraireAffirmations(liste, contrôleur.current.signal);
      if (!affirmations.length) {
        setRésultats([]);
        setÉtape("revue");
        return;
      }
      setPhase("Vérification sur le web…");
      setProgrès({ faits: 0, total: affirmations.length });
      const r = await verifierAffirmations(affirmations, liste, {
        signal: contrôleur.current.signal,
        surProgres: (faits, total) => setProgrès({ faits, total }),
      });
      const enErreur = r.filter((x) => x.erreur);
      if (enErreur.length) journaliserErreur("VerifierLeFond", `${enErreur.length}/${r.length} vérification(s) en échec : ${enErreur[0].erreur}`);
      setRésultats(r);
      setChoisies(new Set());
      setÉtape("revue");
    } catch (e) {
      if (e?.name === "AbortError") { setÉtape("choix"); return; }
      journaliserErreur("VerifierLeFond", e?.message || String(e));
      setErreur(e?.message || "La vérification a échoué.");
      setÉtape("choix");
    }
  };

  const bascule = (n) => setChoisies((anc) => {
    const nv = new Set(anc);
    if (nv.has(n)) nv.delete(n); else nv.add(n);
    return nv;
  });

  const appliquer = () => {
    // Le texte a pu changer : on relocalise chaque extrait dans le document actuel.
    const actuels = lireParagraphes(editor, false).liste;
    const parIdx = new Map(actuels.map((p) => [p.idx, p]));
    const remplacements = [];
    let périmés = 0;
    for (const r of résultats) {
      if (!choisies.has(r.n)) continue;
      const lieu = localiserExtrait(actuels, r.extrait);
      if (!lieu) { périmés++; continue; }
      const base = parIdx.get(lieu.idx).pos;
      remplacements.push({ de: base + lieu.debut, à: base + lieu.fin, texte: r.verification.reformulation });
    }
    remplacements.sort((a, b) => b.de - a.de);
    const tr = editor.state.tr;
    let dernierDébut = Infinity;
    let n = 0;
    for (const r of remplacements) {
      if (r.à > dernierDébut) { périmés++; continue; } // deux extraits qui se chevauchent
      tr.insertText(r.texte, r.de, r.à);
      dernierDébut = r.de;
      n++;
    }
    if (n) editor.view.dispatch(tr);
    setAppliqué({ n, périmés });
  };

  const bouton = (principal) => ({
    fontSize: 13, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
    border: principal ? "none" : "0.5px solid #ccc",
    background: principal ? couleur : "#fff", color: principal ? "#fff" : "#555",
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 760, maxHeight: "92vh", display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #e5e5e5", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 500, flex: 1 }}>🔎 Vérifier le fond</span>
          <button onClick={onFermer} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#999" }} title="Fermer">✕</button>
        </div>

        <div style={{ padding: 18, overflowY: "auto", minHeight: 0, flex: 1 }}>
          {étape === "choix" && (
            <>
              <p style={{ fontSize: 13, color: "#555", margin: "0 0 10px", lineHeight: 1.5 }}>
                L'IA repère les affirmations factuelles et chiffrées de votre texte (au plus {MAX_AFFIRMATIONS}), Cursus refait
                lui-même les calculs, puis chaque affirmation est cherchée sur le web. Vous obtenez un verdict, la source à
                ouvrir et, si besoin, une reformulation à accepter ou non. Rien n'est modifié sans votre accord.
              </p>
              <p style={{ fontSize: 12, color: "#8a6d00", background: "#FFF8E6", borderRadius: 6, padding: "8px 10px", margin: "0 0 14px", lineHeight: 1.5 }}>
                Plus lent et plus coûteux que la correction rapide (une recherche web par affirmation) : comptez une à
                trois minutes. Cursus confirme que la source existe bien parmi les résultats de la recherche, pas que la page dit exactement ce
                qu'affirme l'IA : ouvrez le lien pour trancher.
              </p>
              <div style={{ fontSize: 12.5, color: "#777", marginBottom: 6 }}>Quoi vérifier ?</div>
              <label style={{ display: "block", fontSize: 13, marginBottom: 4, opacity: aSélection ? 1 : 0.45 }}>
                <input type="radio" disabled={!aSélection} checked={portée === "sélection"} onChange={() => setPortée("sélection")} /> La sélection en cours
              </label>
              <label style={{ display: "block", fontSize: 13 }}>
                <input type="radio" checked={portée === "tout"} onChange={() => setPortée("tout")} /> Tout le chapitre
              </label>
              {erreur && <div style={{ marginTop: 12, fontSize: 12.5, color: "#A32D2D", background: "#FBE9E9", padding: "8px 10px", borderRadius: 6 }}>{erreur}</div>}
            </>
          )}

          {étape === "encours" && (
            <div style={{ textAlign: "center", padding: "30px 0", fontSize: 13.5, color: "#555" }}>
              ⏳ {phase} {progrès.total > 0 && `${progrès.faits}/${progrès.total}`}
              {progrès.total > 0 && (
                <div style={{ height: 6, background: "#eee", borderRadius: 3, margin: "14px auto 0", maxWidth: 320 }}>
                  <div style={{ height: 6, borderRadius: 3, background: couleur, width: `${(progrès.faits / progrès.total) * 100}%`, transition: "width 0.3s" }} />
                </div>
              )}
            </div>
          )}

          {étape === "revue" && résultats && !appliqué && (
            <>
              {résultats.length === 0 && <div style={{ fontSize: 13, color: "#555" }}>Aucune affirmation factuelle ou chiffrée à vérifier dans ce texte.</div>}
              {résultats.map((r) => {
                const v = r.verification ? VERDICTS[r.verification.verdict] : null;
                const c = r.calculRefait;
                const peutAppliquer = !!(r.verification?.reformulation && r.emplacement);
                return (
                  <div key={r.n} style={{ border: "0.5px solid #e5e5e5", borderLeft: `3px solid ${v ? v.c : c?.coherent === false ? "#A32D2D" : "#999"}`, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: "#333", flex: 1, minWidth: 0, overflowWrap: "anywhere", fontStyle: "italic" }}>« {r.extrait} »</span>
                      {v && <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: v.bg, color: v.c, whiteSpace: "nowrap" }}>{v.label}</span>}
                      {!v && r.type === "calcul" && <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#EEF", color: "#334", whiteSpace: "nowrap" }}>🧮 Calcul</span>}
                    </div>

                    {r.type === "calcul" && (
                      <div style={{ fontSize: 12.5, color: c?.coherent === false ? "#A32D2D" : "#333", background: "#F7F7F7", borderRadius: 6, padding: "7px 9px", marginBottom: 6, lineHeight: 1.5 }}>
                        {c ? (
                          <>
                            Calcul refait par Cursus : <code style={{ fontSize: 11.5 }}>{r.calcul}</code> = <b>{nombre(c.refait)}</b> {r.unite}
                            {c.annonce !== null && <> — annoncé dans le texte : <b>{nombre(c.annonce)}</b> {c.coherent ? "✓ cohérent" : "✕ écart important"}</>}
                            <div style={{ fontSize: 11, color: "#888" }}>L'expression a été écrite par l'IA : relisez-la, le résultat n'est fiable que si elle reflète bien le calcul du texte.</div>
                          </>
                        ) : "Le calcul n'a pas pu être refait automatiquement : à vérifier à la main."}
                      </div>
                    )}

                    {r.erreur && <div style={{ fontSize: 12, color: "#A32D2D" }}>Vérification impossible : {r.erreur}</div>}

                    {r.verification && (
                      <>
                        {r.verification.explication && <div style={{ fontSize: 13, color: "#333", lineHeight: 1.55, marginBottom: 6 }}>{r.verification.explication}</div>}
                        {r.verification.verdictRevendique !== r.verification.verdict && (
                          <div style={{ fontSize: 11.5, color: "#A32D2D", fontStyle: "italic", marginBottom: 6 }}>
                            L'IA avait répondu « {r.verification.verdictRevendique} », mais aucune source correspondant aux résultats réels de la recherche n'a été retrouvée : Cursus rétrograde en « incertain ». Vérifiez vous-même.
                          </div>
                        )}
                        {r.verification.sourceConfirmee ? (
                          <a href={r.verification.source} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#185FA5", wordBreak: "break-all" }}>
                            🔗 Source trouvée par la recherche
                          </a>
                        ) : (
                          <div style={{ fontSize: 11.5, color: "#999" }}>Aucune source confirmée par la recherche.</div>
                        )}
                        {r.verification.reformulation && (
                          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 8, background: "#E1F5EE", borderRadius: 6, padding: "8px 10px", cursor: peutAppliquer ? "pointer" : "default" }}>
                            {peutAppliquer && <input type="checkbox" checked={choisies.has(r.n)} onChange={() => bascule(r.n)} style={{ marginTop: 3 }} />}
                            <span style={{ fontSize: 13, color: "#0F6E56", lineHeight: 1.55 }}>
                              <b>Proposition :</b> {r.verification.reformulation}
                              {!peutAppliquer && <span style={{ display: "block", fontSize: 11.5, color: "#7a6", marginTop: 2 }}>Application automatique impossible (passage introuvable ou répété) : à reporter à la main.</span>}
                            </span>
                          </label>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {appliqué && (
            <div style={{ textAlign: "center", padding: "26px 0", fontSize: 14, color: "#0F6E56" }}>
              ✓ {appliqué.n} reformulation{appliqué.n > 1 ? "s" : ""} appliquée{appliqué.n > 1 ? "s" : ""}.
              {appliqué.périmés > 0 && <div style={{ fontSize: 12.5, color: "#A32D2D", marginTop: 8 }}>{appliqué.périmés} non appliquée{appliqué.périmés > 1 ? "s" : ""} : passage modifié ou chevauchant.</div>}
              <div style={{ fontSize: 12.5, color: "#888", marginTop: 8 }}>Ctrl+Z annule d'un coup.</div>
            </div>
          )}
        </div>

        <div style={{ padding: "12px 18px", borderTop: "0.5px solid #e5e5e5", display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {étape === "choix" && <><button style={bouton(false)} onClick={onFermer}>Fermer</button><button style={bouton(true)} onClick={lancer}>Lancer la vérification</button></>}
          {étape === "encours" && <button style={bouton(false)} onClick={() => { contrôleur.current?.abort(); setÉtape("choix"); }}>Annuler</button>}
          {étape === "revue" && !appliqué && (
            <>
              <button style={bouton(false)} onClick={onFermer}>Fermer</button>
              {choisies.size > 0 && <button style={bouton(true)} onClick={appliquer}>Appliquer {choisies.size} reformulation{choisies.size > 1 ? "s" : ""}</button>}
            </>
          )}
          {appliqué && <button style={bouton(true)} onClick={onFermer}>Fermer</button>}
        </div>
      </div>
    </div>
  );
}
