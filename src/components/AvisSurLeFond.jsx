/**
 * CURSUS — « Vérifier le fond » (24/10/2026) — voir src/lib/avisSurLeFond.js.
 * Avis éditorial sur le récit / le propos : verdict, ce qui fonctionne, ce qui ne
 * tient pas encore, pistes, questions. Lecture seule : le texte n'est jamais modifié.
 */
import { useMemo, useState } from "react";
import { marquerDebut, marquerFin, sauverResultat, lireResultat, effacerResultat, estEnCours, nouveauSignal, annulerEnCours } from "../lib/copiloteConserve.js";
import { useReprise } from "../lib/useReprise.js";
import { journaliserErreur } from "../lib/journalErreurs.js";
import { lireTexteComplet } from "../lib/paragraphesEditeur.js";
import RemarqueAvecProposition from "./RemarqueAvecProposition.jsx";
import { avisSurLeFond, RUBRIQUES_AVIS, TAILLE_PARTIE } from "../lib/avisSurLeFond.js";

const COULEURS = { TIENT: "#0F6E56", FAIBLE: "#A32D2D", PISTES: "#185FA5", QUESTIONS: "#7A5B00" };

const CLE = "avis";

export default function AvisSurLeFond({ editor, noeudId, onUsage, couleur = "#7F77DD", onFermer }) {
  // Avis conservé (03/11/2026) : fermer la fenêtre n'interrompt plus la demande et ne perd plus un avis déjà payé. Voir src/lib/copiloteConserve.js.
  const sauvé = useMemo(() => lireResultat(noeudId, CLE), []); // eslint-disable-line react-hooks/exhaustive-deps
  const aSélection = !editor.state.selection.empty;
  const [étape, setÉtape] = useState(estEnCours(noeudId, CLE) ? "encours" : sauvé?.avis ? "revue" : "choix"); // choix | encours | revue
  const [portée, setPortée] = useState(aSélection ? "sélection" : "tout");
  const [progrès, setProgrès] = useState({ faits: 0, total: 0 });
  const [erreur, setErreur] = useState(null);
  const [avis, setAvis] = useState(sauvé?.avis || null);
  useReprise(noeudId, CLE, {
    surEnCours: () => setÉtape("encours"),
    surResultat: (v) => { setAvis(v.avis); setÉtape("revue"); },
    surFin: (issue) => { setÉtape("choix"); if (issue === "echec") setErreur((e) => e || "L'avis demandé avant la fermeture n'a pas abouti."); },
  });

  const lancer = async () => {
    const { liste } = lireTexteComplet(editor, portée === "sélection");
    if (!liste.length) { setErreur("Aucun texte à lire."); return; }
    onUsage?.("lance");
    setErreur(null);
    setÉtape("encours");
    const signal = nouveauSignal(noeudId, CLE);
    marquerDebut(noeudId, CLE);
    try {
      const r = await avisSurLeFond(liste, { signal, surProgres: (faits, total) => setProgrès({ faits, total }) });
      sauverResultat(noeudId, CLE, { avis: r });
      setAvis(r);
      setÉtape("revue");
      marquerFin(noeudId, CLE, "ok", signal);
    } catch (e) {
      if (e?.name === "AbortError") { setÉtape("choix"); marquerFin(noeudId, CLE, "annule", signal); return; }
      journaliserErreur("AvisSurLeFond", e.message);
      setErreur(e.message || "Impossible d'obtenir l'avis.");
      setÉtape("choix");
      marquerFin(noeudId, CLE, "echec", signal);
    }
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
          <span style={{ fontSize: 15, fontWeight: 500, flex: 1 }}>Vérifier le fond</span>
          <button onClick={onFermer} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#999" }} title="Fermer (la demande continue et le résultat est gardé)">✕</button>
        </div>

        <div style={{ padding: 18, overflowY: "auto", minHeight: 0, flex: 1 }}>
          {étape === "choix" && (
            <>
              <p style={{ fontSize: 13, color: "#555", margin: "0 0 10px", lineHeight: 1.55 }}>
                L'IA lit votre texte comme un éditeur et vous donne son avis sur le <b>fond</b> : est-ce que ça tient la
                route, ce qui fonctionne, ce qui accroche (cohérence, vraisemblance, point de vue, images, rythme, logique
                du propos), et ce qu'elle changerait. Elle ne réécrit rien et ne modifie pas votre texte.
              </p>
              <p style={{ fontSize: 12, color: "#8a6d00", background: "#FFF8E6", borderRadius: 6, padding: "8px 10px", margin: "0 0 14px", lineHeight: 1.5 }}>
                C'est une lecture, pas une vérité : à vous de juger ce qui vous parle. L'IA ne cherche pas sur le web — pour
                contrôler des faits ou des chiffres, utilisez « Vérifier les faits ». Moins d'une minute pour un chapitre.
              </p>
              <div style={{ fontSize: 12.5, color: "#777", marginBottom: 6 }}>Quoi lire ?</div>
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
              ⏳ Lecture en cours… {progrès.total > 1 && `partie ${Math.min(progrès.faits + 1, progrès.total)}/${progrès.total}`}
            </div>
          )}

          {étape === "revue" && avis && avis.map((a, i) => (
            <div key={i} style={{ marginBottom: 18 }}>
              {avis.length > 1 && <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Partie {i + 1}/{avis.length} (à partir de « {a.debut}… »)</div>}
              {a.verdict && (
                <div style={{ fontSize: 14, color: "#222", lineHeight: 1.6, background: "#F5F5FA", borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#777", marginBottom: 4, letterSpacing: 0.4 }}>EN UN MOT : EST-CE QUE ÇA TIENT LA ROUTE ?</div>
                  {a.verdict}
                </div>
              )}
              {Object.keys(RUBRIQUES_AVIS).map((clé) => a[clé].length > 0 && (
                <div key={clé} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: COULEURS[clé], marginBottom: 6 }}>{RUBRIQUES_AVIS[clé]}</div>
                  {a[clé].map((ligne, j) => (
                    <div key={j} style={{ fontSize: 13.5, color: "#333", lineHeight: 1.6, borderLeft: `3px solid ${COULEURS[clé]}`, padding: "4px 0 4px 10px", marginBottom: 6, overflowWrap: "anywhere" }}><RemarqueAvecProposition ligne={ligne} editor={editor} couleur={COULEURS[clé]} onRemplace={() => onUsage?.("applique", 1)} /></div>
                  ))}
                </div>
              ))}
              {!a.verdict && !Object.keys(RUBRIQUES_AVIS).some((k) => a[k].length) && <div style={{ fontSize: 13, color: "#555" }}>L'IA n'a rien renvoyé d'exploitable pour cette partie. Réessayez.</div>}
              {a.tronque && <div style={{ fontSize: 11.5, color: "#8a6d00" }}>La réponse a été coupée (trop longue) : relancez sur une sélection plus courte pour un avis complet.</div>}
            </div>
          ))}
          {étape === "revue" && <div style={{ fontSize: 11.5, color: "#999", borderTop: "0.5px solid #eee", paddingTop: 10 }}>Avis généré par une IA à partir du texte fourni seulement (taille analysée : {TAILLE_PARTIE.toLocaleString("fr-FR")} caractères par partie). Il ne remplace pas votre jugement ni celui d'un relecteur humain.</div>}
        </div>

        <div style={{ padding: "12px 18px", borderTop: "0.5px solid #e5e5e5", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {étape === "choix" && <><button style={bouton(false)} onClick={onFermer}>Fermer</button><button style={bouton(true)} onClick={lancer}>Lire et donner son avis</button></>}
          {étape === "encours" && <button style={bouton(false)} onClick={() => annulerEnCours(noeudId, CLE)}>Annuler</button>}
          {étape === "revue" && <><button style={bouton(false)} onClick={() => { effacerResultat(noeudId, CLE); setAvis(null); setÉtape("choix"); }} title="Oublier cet avis et en demander un autre">Relancer</button><button style={bouton(true)} onClick={onFermer}>Fermer</button></>}
        </div>
      </div>
    </div>
  );
}
