/**
 * CURSUS — « 📊 Profil de lisibilité » (24/10/2026) — voir src/lib/profilLisibilite.js.
 * Évalue l'effort de lecture du texte (six dimensions, citations vérifiées par le code,
 * orientation en trois niveaux). Lecture seule : le texte n'est jamais modifié.
 */
import { useRef, useState } from "react";
import { journaliserErreur } from "../lib/journalErreurs.js";
import { lireTexteComplet } from "../lib/paragraphesEditeur.js";
import { analyserRepetitions } from "../lib/nettoyageMecanique.js";
import { DIMENSIONS, NATURES, ORIENTATIONS, SEUIL_COURT, profilDeLisibilite, texteRestitution } from "../lib/profilLisibilite.js";

const COULEUR_NIVEAU = { absente: "#9a9a9a", ponctuelle: "#0F6E56", fréquente: "#7A5B00", dominante: "#A32D2D" };

export default function ProfilLisibilite({ editor, onUsage, couleur = "#7F77DD", typeProjet = "non-fiction", onFermer }) {
  const aSélection = !editor.state.selection.empty;
  const [portée, setPortée] = useState(aSélection ? "sélection" : "tout");
  // Récit de fiction ou non (25/10/2026) : en fiction, la retenue narrative n'est pas une difficulté de lecture
  // et l'outil ne conclut jamais à une « reconstruction ». Valeur par défaut = genre du projet, modifiable ici.
  const [fiction, setFiction] = useState(typeProjet === "fiction");
  const [étape, setÉtape] = useState("choix"); // choix | encours | revue
  const [progrès, setProgrès] = useState({ faits: 0, total: 0 });
  const [erreur, setErreur] = useState(null);
  const [profil, setProfil] = useState(null);
  const [signaux, setSignaux] = useState(null);
  const [copie, setCopie] = useState(null);
  const contrôleur = useRef(null);

  const lancer = async () => {
    const { liste } = lireTexteComplet(editor, portée === "sélection");
    if (!liste.length) { setErreur("Aucun texte à lire."); return; }
    if (liste.reduce((a, p) => a + p.texte.length, 0) < 200) { setErreur("Texte trop court pour évaluer sa lisibilité (200 caractères au moins)."); return; }
    onUsage?.("lance");
    setErreur(null);
    setÉtape("encours");
    contrôleur.current = new AbortController();
    try {
      const r = await profilDeLisibilite(liste, { signal: contrôleur.current.signal, surProgres: (faits, total) => setProgrès({ faits, total }), fiction });
      setSignaux(analyserRepetitions(liste));
      setProfil(r);
      setÉtape("revue");
    } catch (e) {
      if (e?.name === "AbortError") { setÉtape("choix"); return; }
      journaliserErreur("ProfilLisibilite", e.message);
      setErreur(e.message || "Impossible d'établir le profil.");
      setÉtape("choix");
    }
  };

  const copier = async (clé, texte) => {
    try { await navigator.clipboard.writeText(texte); setCopie(clé); } catch { setCopie("impossible"); }
  };
  const texteQuestions = () => (profil?.questions || []).map((q, i) => `${i + 1}. ${q.replace(/^\[\d+\]\s*/, "")}`).join("\n");
  const texteCompteRendu = () => {
    if (!profil) return "";
    const lignes = profil.tropCourt
      ? [`PROFIL DE LISIBILITÉ — extrait trop court pour une orientation (${profil.nbParagraphes} paragraphe${profil.nbParagraphes > 1 ? "s" : ""} ; au moins ${SEUIL_COURT} sont nécessaires). Points relevés, à confirmer sur un passage plus large.`, ""]
      : [`PROFIL DE LISIBILITÉ — ${ORIENTATIONS[profil.orientation].titre}${profil.indicatif ? " (indicatif : extrait court)" : ""}`, "", texteRestitution(profil.orientation), ""];
    for (const [code, d] of Object.entries(profil.dimensions)) {
      if (profil.tropCourt && !d.observations.length) continue;
      lignes.push(profil.tropCourt
        ? `${DIMENSIONS[code].label} : ${d.observations.length} point${d.observations.length > 1 ? "s" : ""} relevé${d.observations.length > 1 ? "s" : ""}`
        : `${DIMENSIONS[code].label} : ${d.niveau}${d.touches ? ` (${d.touches} paragraphe${d.touches > 1 ? "s" : ""} sur ${profil.nbParagraphes})` : ""}`);
      for (const ob of d.observations.slice(0, 3)) lignes.push(`  - « ${ob.citation} » : ${ob.explication}`);
    }
    if (profil.fonds.length) lignes.push("", "Fond : " + profil.fonds.join(" "));
    if (profil.questions.length) lignes.push("", "Questions à l'auteur·ice :", texteQuestions());
    lignes.push("", "Repères de travail non validés scientifiquement ; lecture automatique à confirmer par un relecteur.");
    return lignes.join("\n");
  };

  const bouton = (principal) => ({
    fontSize: 13, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
    border: principal ? "none" : "0.5px solid #ccc", background: principal ? couleur : "#fff", color: principal ? "#fff" : "#555",
  });
  const carte = { border: "0.5px solid #e5e5e5", borderRadius: 8, padding: "10px 12px", marginBottom: 10 };
  const o = profil && profil.orientation ? ORIENTATIONS[profil.orientation] : null;
  const totalNature = profil ? profil.nature.A + profil.nature.B + profil.nature.C : 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 760, maxHeight: "92vh", display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #e5e5e5", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 500, flex: 1 }}>📊 Profil de lisibilité</span>
          <button onClick={() => { contrôleur.current?.abort(); onFermer(); }} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#999" }} title="Fermer">✕</button>
        </div>

        <div style={{ padding: 18, overflowY: "auto", minHeight: 0, flex: 1 }}>
          {étape === "choix" && (
            <>
              <p style={{ fontSize: 13, color: "#555", margin: "0 0 10px", lineHeight: 1.55 }}>
                Cet outil mesure l'<b>effort que votre texte impose au lecteur</b> pour en retrouver le sens : ne pas savoir de qui on parle, devoir relier soi-même les idées, reconstituer l'organisation…
                Il ne juge ni la qualité littéraire, ni l'auteur·ice, ni les fautes de surface. Chaque difficulté est illustrée par une <b>citation exacte</b>, que Cursus vérifie dans votre texte.
              </p>
              <p style={{ fontSize: 12, color: "#8a6d00", background: "#FFF8E6", borderRadius: 6, padding: "8px 10px", margin: "0 0 14px", lineHeight: 1.5 }}>
                C'est une lecture automatique et des repères de travail non validés scientifiquement : à confirmer par un relecteur. Rien n'est modifié dans votre texte.
              </p>
              <div style={{ fontSize: 12.5, color: "#777", marginBottom: 6 }}>Quoi évaluer ?</div>
              <label style={{ display: "block", fontSize: 13, marginBottom: 4, opacity: aSélection ? 1 : 0.45 }}>
                <input type="radio" disabled={!aSélection} checked={portée === "sélection"} onChange={() => setPortée("sélection")} /> La sélection en cours
              </label>
              <label style={{ display: "block", fontSize: 13 }}>
                <input type="radio" checked={portée === "tout"} onChange={() => setPortée("tout")} /> Tout le chapitre
              </label>
              <div style={{ fontSize: 12.5, color: "#777", margin: "14px 0 6px" }}>Ce texte est :</div>
              <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
                <input type="radio" checked={fiction} onChange={() => setFiction(true)} /> un récit de fiction (la retenue, le mystère et le non-dit ne sont pas comptés comme des défauts)
              </label>
              <label style={{ display: "block", fontSize: 13 }}>
                <input type="radio" checked={!fiction} onChange={() => setFiction(false)} /> un essai, un document ou un témoignage
              </label>
              <p style={{ fontSize: 12, color: "#777", margin: "12px 0 0", lineHeight: 1.5 }}>
                Moins de {SEUIL_COURT} paragraphes : Cursus ne donne pas d'orientation (trop court pour juger) et se limite aux points relevés.
              </p>
              {erreur && <div style={{ marginTop: 12, fontSize: 12.5, color: "#A32D2D", background: "#FBE9E9", padding: "8px 10px", borderRadius: 6 }}>{erreur}</div>}
            </>
          )}

          {étape === "encours" && <div style={{ textAlign: "center", padding: "30px 0", fontSize: 13.5, color: "#555" }}>⏳ Lecture en cours… {progrès.total > 1 && `partie ${Math.min(progrès.faits + 1, progrès.total)}/${progrès.total}`}</div>}

          {étape === "revue" && profil && (
            <>
              {profil.tropCourt && (
                <div style={{ background: "#F2F2F2", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#666", letterSpacing: 0.4 }}>PAS D'ORIENTATION : EXTRAIT TROP COURT</div>
                  <div style={{ fontSize: 13, color: "#333", lineHeight: 1.6, marginTop: 4 }}>
                    Ce passage compte {profil.nbParagraphes} paragraphe{profil.nbParagraphes > 1 ? "s" : ""} : c'est trop peu pour dire si la difficulté est fréquente ou ponctuelle (une part « 1 sur 1 » ne signifie rien).
                    Voici seulement les points relevés dans ce passage, à confirmer sur un extrait plus large (au moins {SEUIL_COURT} paragraphes).
                  </div>
                </div>
              )}
              {o && <div style={{ background: o.fond, borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: o.couleur, letterSpacing: 0.4 }}>ORIENTATION{profil.indicatif ? " (INDICATIVE : EXTRAIT COURT)" : ""}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: o.couleur, margin: "2px 0 6px" }}>{o.titre}</div>
                <div style={{ fontSize: 13, color: "#333", lineHeight: 1.6 }}>{texteRestitution(profil.orientation)}</div>
                {profil.raisons.length > 0 && <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>Pourquoi : {profil.raisons.join(" ; ")}.</div>}
                {profil.pressenti3 && <div style={{ fontSize: 12.5, color: "#A32D2D", marginTop: 6, fontWeight: 600 }}>Les observations vont dans le sens d'une reconstruction éditoriale approfondie : à confirmer sur un extrait plus large (au moins 15 paragraphes).</div>}
                {profil.indicatif && <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Sur un extrait de {profil.nbParagraphes} paragraphes, une conclusion sur l'ensemble de l'ouvrage serait hâtive : c'est un indice, pas un verdict.</div>}
                {profil.plafonneFiction && <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Pour un récit de fiction, Cursus ne conclut pas à une « reconstruction » : il décrit l'effort de lecture, le jugement éditorial reste le vôtre.</div>}
              </div>}

              {Object.entries(profil.dimensions).map(([code, d]) => (
                <div key={code} style={carte}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#333", flex: 1, minWidth: 160 }}>{DIMENSIONS[code].label}</span>
                    {profil.tropCourt
                      ? <span style={{ fontSize: 12, fontWeight: 600, color: d.observations.length ? "#7A5B00" : "#9a9a9a" }}>{d.observations.length ? `${d.observations.length} point${d.observations.length > 1 ? "s" : ""} relevé${d.observations.length > 1 ? "s" : ""}` : "rien relevé"}</span>
                      : <span style={{ fontSize: 12, fontWeight: 600, color: COULEUR_NIVEAU[d.niveau] }}>{d.niveau}{d.touches ? ` · ${d.touches}/${profil.nbParagraphes} paragraphe${d.touches > 1 ? "s" : ""}` : ""}</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#999", marginBottom: d.observations.length ? 6 : 0 }}>{DIMENSIONS[code].aide}</div>
                  {d.observations.slice(0, 3).map((ob, i) => (
                    <div key={i} style={{ fontSize: 13, color: "#333", lineHeight: 1.55, borderLeft: `3px solid ${COULEUR_NIVEAU[d.niveau]}`, padding: "2px 0 2px 8px", marginBottom: 4, overflowWrap: "anywhere" }}>
                      « {ob.citation} » <span style={{ color: "#666" }}>— {ob.explication}</span>
                    </div>
                  ))}
                  {d.observations.length > 3 && <div style={{ fontSize: 11.5, color: "#999" }}>+ {d.observations.length - 3} autre{d.observations.length - 3 > 1 ? "s" : ""} observation{d.observations.length - 3 > 1 ? "s" : ""}</div>}
                </div>
              ))}

              {totalNature > 0 && (
                <div style={carte}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 4 }}>D'où vient la difficulté ?</div>
                  {["A", "B", "C"].map((k) => profil.nature[k] > 0 && <div key={k} style={{ fontSize: 13, color: "#444" }}>{profil.nature[k]} observation{profil.nature[k] > 1 ? "s" : ""} — {NATURES[k]}</div>)}
                </div>
              )}

              {profil.fonds.length > 0 && (
                <div style={{ ...carte, background: "#F5F5FA" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 4 }}>Le fond</div>
                  <div style={{ fontSize: 13, color: "#333", lineHeight: 1.6 }}>{profil.fonds.join("\n\n")}</div>
                </div>
              )}
              {profil.aPreserver.length > 0 && (
                <div style={{ ...carte, background: "#E1F5EE", borderColor: "#BFE6D6" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0F6E56", marginBottom: 4 }}>À préserver</div>
                  {profil.aPreserver.map((t, i) => <div key={i} style={{ fontSize: 13, color: "#0F6E56", lineHeight: 1.55 }}>• {t}</div>)}
                </div>
              )}
              {profil.questions.length > 0 && (
                <div style={carte}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 4 }}>Questions à l'auteur·ice (le sens ne sera jamais deviné)</div>
                  {profil.questions.map((q, i) => <div key={i} style={{ fontSize: 13, color: "#333", lineHeight: 1.55, marginBottom: 3 }}>{i + 1}. {q.replace(/^\[\d+\]\s*/, "")}</div>)}
                  <button style={{ ...bouton(false), marginTop: 6, padding: "4px 10px", fontSize: 12 }} onClick={() => copier("q", texteQuestions())}>📋 Copier les questions</button>
                  {copie === "q" && <span style={{ fontSize: 12, color: "#0F6E56", marginLeft: 8 }}>✓ copié</span>}
                </div>
              )}

              {signaux && (
                <div style={{ fontSize: 12, color: "#777", lineHeight: 1.6, marginBottom: 10 }}>
                  <b>Signaux objectifs (sans IA)</b> : {signaux.mots.toLocaleString("fr-FR")} mots, {signaux.moyenne} mots par phrase en moyenne, {signaux.uneSeulePhrase} paragraphe{signaux.uneSeulePhrase > 1 ? "s" : ""} d'une seule phrase sur {signaux.paragraphes}.
                  Détail dans « 🧹 Nettoyage mécanique ».
                </div>
              )}
              <div style={{ fontSize: 11.5, color: "#999", lineHeight: 1.5, borderTop: "0.5px solid #eee", paddingTop: 8 }}>
                Niveaux et orientation calculés par Cursus à partir des seules citations retrouvées dans votre texte ({profil.ecartees} observation{profil.ecartees > 1 ? "s" : ""} écartée{profil.ecartees > 1 ? "s" : ""} car la citation était introuvable{profil.questionsEcartees > 0 ? `, ${profil.questionsEcartees} question${profil.questionsEcartees > 1 ? "s" : ""} ou point${profil.questionsEcartees > 1 ? "s" : ""} écarté${profil.questionsEcartees > 1 ? "s" : ""} pour la même raison` : ""}).
                {profil.fondNonVerifie > 0 && " ⚠ Une citation du résumé « Le fond » n'a pas été retrouvée dans votre texte : lisez ce résumé avec prudence."}
                Repères de travail non validés scientifiquement ; une seule lecture automatique : relancez pour vérifier la stabilité. Le profil décrit l'effort de lecture, il ne juge pas la valeur de l'auteur·ice.
                {profil.tronque && " La réponse a été coupée : relancez sur une sélection plus courte."}
              </div>
            </>
          )}
        </div>

        <div style={{ padding: "12px 18px", borderTop: "0.5px solid #e5e5e5", display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {étape === "choix" && <><button style={bouton(false)} onClick={onFermer}>Fermer</button><button style={bouton(true)} onClick={lancer}>Évaluer la lisibilité</button></>}
          {étape === "encours" && <button style={bouton(false)} onClick={() => contrôleur.current?.abort()}>Annuler</button>}
          {étape === "revue" && <>
            <button style={bouton(false)} onClick={() => copier("c", texteCompteRendu())}>{copie === "c" ? "✓ Copié" : "📋 Copier le compte rendu"}</button>
            <button style={bouton(false)} onClick={() => { setProfil(null); setÉtape("choix"); }}>Relancer</button>
            <button style={bouton(true)} onClick={onFermer}>Fermer</button>
          </>}
        </div>
      </div>
    </div>
  );
}
