/**
 * CURSUS — src/components/AideFAQ.jsx
 *
 * Centre d'aide en libre-service, accessible depuis n'importe quel écran via
 * le bouton "Aide" de la barre supérieure (App.jsx). Contenu en accordéon,
 * textes dans common.json → clé "faq" (tableau {question, reponse}).
 *
 * Volontairement simple pour commencer : pas de recherche, pas de catégories.
 * À enrichir au fil des questions réellement posées par les utilisateurs —
 * les 5 premières entrées viennent des problèmes rencontrés le 15/07/2026.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { aideFaqAPI, chercherReponses, demanderAssistantAide } from "../lib/aideContextuelle.js";
import PointeurBouton from "./PointeurBouton.jsx";

const btn = (fond = "#f5f3ff", couleur = "#534AB7") => ({ background: fond, color: couleur, border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" });

/** Aide contextuelle (28/10/2026) : question libre → réponse connue (sans IA), sinon assistant à la demande ; pointeur de bouton. */
function PosezVotreQuestion({ faq, validees, masquer, estAdmin }) {
  const [question, setQuestion] = useState("");
  const [element, setElement] = useState("");
  const [pointage, setPointage] = useState(false);
  const [trouvees, setTrouvees] = useState(null); // null = pas encore cherché
  const [ia, setIa] = useState(null); // { texte, tokens }
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState("");
  const [propose, setPropose] = useState("");
  const ctrl = useRef(null);
  useEffect(() => { masquer(pointage); }, [pointage]); // eslint-disable-line

  const chercher = () => {
    if (question.trim().length < 3) return;
    setIa(null); setErreur(""); setPropose("");
    setTrouvees(chercherReponses(question, [...validees, ...faq]));
  };
  const demanderIA = async () => {
    setCharge(true); setErreur(""); setPropose("");
    ctrl.current = new AbortController();
    try { setIa(await demanderAssistantAide({ question: question || `À quoi sert « ${element} » ?`, element, signal: ctrl.current.signal })); }
    catch (e) { setErreur(e.message || "L'assistant n'a pas pu répondre."); }
    setCharge(false);
  };
  const proposer = async () => {
    const { error } = await aideFaqAPI.proposer({ question: question || `À quoi sert « ${element} » ?`, reponse: ia.texte, element });
    setPropose(error ? "Impossible d'enregistrer la proposition (" + (error.message || "erreur") + ")." : "Merci : proposée à l'équipe, elle apparaîtra pour tous une fois validée.");
  };

  return (
    <div style={{ padding: "12px 0 14px", borderBottom: "0.5px solid #e5e5e5" }}>
      {/* portail : la fenêtre d'aide est masquée (display: none) pendant le pointage, un enfant fixe y serait invisible */}
      {pointage && createPortal(<PointeurBouton onAnnuler={() => setPointage(false)} onChoisi={(l) => { setElement(l); setPointage(false); }} />, document.body)}
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Posez votre question</div>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && chercher()}
          placeholder="Ex. : à quoi sert « Styles » ?" style={{ flex: 1, minWidth: 0, border: "0.5px solid #ccc", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit" }} />
        <button onClick={chercher} style={btn("#534AB7", "#fff")}>Chercher</button>
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => setPointage(true)} style={btn()}>👆 Pointer un bouton</button>
        {element && <span style={{ fontSize: 12, color: "#555" }}>Bouton pointé : <b>{element}</b> <button onClick={() => setElement("")} style={{ ...btn("none", "#999"), padding: 0 }}>✕</button></span>}
      </div>

      {trouvees && trouvees.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>Réponses déjà connues (gratuit) :</div>
          {trouvees.map((e, i) => <Entrée key={e.id || i} question={e.question} réponse={e.reponse} />)}
        </div>
      )}
      {(trouvees || element) && !ia && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#555" }}>
          {trouvees && trouvees.length === 0 && <div style={{ marginBottom: 6 }}>Aucune réponse connue pour cette question.</div>}
          <button onClick={demanderIA} disabled={charge} style={btn()}>{charge ? "L'assistant réfléchit…" : "🤖 Demander à l'assistant"}</button>
          <span style={{ marginLeft: 8, color: "#999" }}>Utilise un peu de votre quota d'IA.</span>
        </div>
      )}
      {erreur && <div style={{ marginTop: 8, fontSize: 12, color: "#b3261e" }}>{erreur}</div>}
      {ia && (
        <div style={{ marginTop: 10, background: "#f8f7ff", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{ia.texte}</div>
          <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>Réponse de l'assistant (peut contenir des erreurs) · ≈ {ia.tokens} tokens de votre quota</div>
          <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {!propose && <button onClick={proposer} style={btn()}>👍 Utile — proposer pour la liste</button>}
            {propose && <span style={{ fontSize: 12, color: "#2e7d32" }}>{propose}</span>}
          </div>
        </div>
      )}
      {estAdmin && null}
    </div>
  );
}

/** Réservé à Joseph : valider ou rejeter les réponses proposées (modifiables avant validation). */
function AValider() {
  const [liste, setListe] = useState(null);
  const [textes, setTextes] = useState({});
  const charger = () => aideFaqAPI.proposees().then(setListe);
  useEffect(() => { charger(); }, []);
  if (!liste || liste.length === 0) return null;
  const decider = async (e, statut) => { await aideFaqAPI.decider(e.id, statut, statut === "validee" ? (textes[e.id] ?? e.reponse) : null); charger(); };
  return (
    <div style={{ padding: "12px 0", borderBottom: "0.5px solid #e5e5e5" }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>À valider ({liste.length})</div>
      {liste.map((e) => (
        <div key={e.id} style={{ marginBottom: 12, fontSize: 12 }}>
          <div style={{ fontWeight: 500 }}>{e.question}{e.element ? ` — bouton « ${e.element} »` : ""}</div>
          <textarea value={textes[e.id] ?? e.reponse} onChange={(ev) => setTextes({ ...textes, [e.id]: ev.target.value })} rows={4}
            style={{ width: "100%", boxSizing: "border-box", marginTop: 4, border: "0.5px solid #ccc", borderRadius: 8, padding: 8, fontSize: 12, fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button onClick={() => decider(e, "validee")} style={btn("#e8f5e9", "#2e7d32")}>✔ Valider</button>
            <button onClick={() => decider(e, "rejetee")} style={btn("#fdecea", "#b3261e")}>✕ Rejeter</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Entrée({ question, réponse }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div style={{ borderBottom: "0.5px solid var(--border, #e5e5e5)" }}>
      <button
        onClick={() => setOuvert(!ouvert)}
        style={{
          width: "100%", textAlign: "left", background: "none", border: "none",
          padding: "12px 4px", cursor: "pointer", fontFamily: "inherit",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 13, fontWeight: 500, color: "var(--texte-primaire, #1a1a1a)",
        }}
      >
        {question}
        <span style={{ color: "#999", fontSize: 12, transform: ouvert ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
      </button>
      {ouvert && (
        <p style={{ margin: "0 4px 14px", fontSize: 13, color: "var(--texte-secondaire, #555)", lineHeight: 1.6 }}>
          {réponse}
        </p>
      )}
    </div>
  );
}

export default function AideFAQ({ onFermer, onVoirModeEmploi, estAdmin = false }) {
  const { t } = useTranslation("common");
  const faq = t("faq", { returnObjects: true }) || [];
  const [validees, setValidees] = useState([]);
  const [cache, setCache] = useState(false); // fenêtre masquée pendant le « pointage » d'un bouton
  useEffect(() => { aideFaqAPI.validees().then(setValidees); }, []);

  return (
    <div
      onClick={onFermer}
      style={{
        display: cache ? "none" : "flex",
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
        alignItems: "center", justifyContent: "center",
        zIndex: 200, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 16, width: 480, maxWidth: "100%",
          maxHeight: "80vh", display: "flex", flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden",
        }}
      >
        <div style={{
          padding: "18px 22px", borderBottom: "0.5px solid #e5e5e5",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 16, fontWeight: 500 }}>{t("aide.titre")}</span>
          <button
            onClick={onFermer}
            style={{
              width: 26, height: 26, borderRadius: "50%", border: "none",
              background: "#f5f5f5", color: "#999", fontSize: 13, cursor: "pointer",
            }}
          >✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "6px 22px" }}>
          <PosezVotreQuestion faq={faq} validees={validees} masquer={setCache} estAdmin={estAdmin} />
          {estAdmin && <AValider />}
          {faq.length === 0 ? (
            <p style={{ fontSize: 13, color: "#999", padding: "16px 0" }}>{t("aide.vide")}</p>
          ) : (
            faq.map((item, i) => <Entrée key={i} question={item.question} réponse={item.reponse} />)
          )}
        </div>

        <div style={{ padding: "14px 22px", borderTop: "0.5px solid #f0f0f0", fontSize: 11, color: "#999", textAlign: "center" }}>
          {t("aide.pied")}
          {/* 24/09/2026, liste d'attente #3 — lien vers le guide complet
              (ModeEmploi.jsx), cette FAQ ne couvrant que quelques
              questions ponctuelles, pas l'ensemble des fonctionnalités. */}
          {onVoirModeEmploi && (
            <>
              {" · "}
              <button onClick={onVoirModeEmploi}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#7F77DD", fontSize: 11, fontFamily: "inherit", textDecoration: "underline" }}>
                Voir le mode d'emploi complet
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

