/**
 * CURSAUDIT — Questionnaire de qualification (réf. 60816-01, suite, 22/08/2026)
 * ======================================================================
 * Reprend questionnaire-cursaudit-v1-specification.md (figé le 15/08/2026,
 * jamais câblé jusqu'ici — écart signalé par l'auteur du projet en relisant
 * les textes de l'écran de choix d'espace, qui décrivaient cette porte
 * d'entrée comme existante). Porte d'entrée obligatoire avant le texte à
 * auditer : "l'IA analyse un texte sans savoir ce qu'il est censé être,
 * pour qui il est écrit, ni jusqu'où elle a le droit d'intervenir" sans ce
 * cadrage (citation du document d'origine).
 *
 * CE QUI N'EST PAS ICI (limites assumées) :
 *  - Section 6 ("préserver ma voix", comparaison à des pages de référence)
 *    — le document d'origine la marque lui-même hors périmètre, nécessite
 *    son propre stockage et sa propre logique de comparaison stylistique.
 *  - Sections 8 (niveau de preuve) et 9 (sortie attendue) — pas dupliquées
 *    ici, la note technique du document d'origine les fait correspondre
 *    directement au palier/mode et au format de rapport déjà présents dans
 *    l'écran de création (CursAudit.jsx), affichés juste après ce
 *    questionnaire.
 *
 * CE QUE LES RÉPONSES CHANGENT RÉELLEMENT côté moteur d'analyse
 * (analyser-unite-cursaudit / orchestrer-audit-cursaudit) : la question
 * libre (section 4) et le degré d'intervention (section 5) sont injectés
 * dans le prompt système envoyé à l'IA pour CHAQUE unité. Mais le moteur
 * ne produit aujourd'hui qu'un diagnostic (valeur + commentaire) par
 * critère, jamais un texte réécrit séparé — les degrés "reformulation
 * ponctuelle" et "réécriture" influencent donc le CONTENU du commentaire
 * (l'IA peut y glisser une suggestion), pas une sortie dédiée. Écrire
 * réellement à la place de l'auteur⋅ice n'est pas implémenté.
 */

import { useState } from "react";

const TYPES_DOCUMENT = [
  "Mémoire / TFE / travail académique",
  "Manuscrit de livre",
  "Article",
  "Essai",
  "Rapport professionnel",
  "Dossier personnel",
  "Scène / extrait autonome",
  "Correspondance / message",
];

const STATUTS_TEXTE = [
  "Un brouillon de travail",
  "Une version presque finale",
  "Une version déjà envoyée / déposée",
  "Une version publiée ou annoncée",
  "Une version destinée à être profondément retravaillée",
];

const FINALITES = [
  "Vérifier la cohérence générale",
  "Améliorer la structure",
  "Repérer les répétitions",
  "Repérer les passages faibles",
  "Vérifier le niveau de preuve",
  "Vérifier les sources",
  "Préserver la voix de l'auteur",
  "Fluidifier sans réécrire à la place",
  "Identifier les risques éthiques, académiques ou éditoriaux",
  "Préparer une nouvelle version",
];

const DEGRES_INTERVENTION = [
  { id: "observer",                 label: "Observer seulement" },
  { id: "signaler",                 label: "Signaler les problèmes" },
  { id: "pistes",                   label: "Proposer des pistes" },
  { id: "reformulations_ponctuelles", label: "Proposer des reformulations ponctuelles" },
  { id: "reecrire_legerement",      label: "Réécrire légèrement" },
  { id: "reecrire_librement",       label: "Réécrire librement" },
];

const CONDITIONS_IA_ACADEMIQUE = [
  "Correction linguistique",
  "Aide à la structure",
  "Aide bibliographique",
  "Reformulation limitée",
  "Interdiction de rédaction",
  "Obligation de déclaration",
];

const labelStyle = { display: "block", fontSize: 12.5, fontWeight: 500, color: "var(--texte-secondaire)", marginBottom: 6 };
const champStyle = { width: "100%", padding: "9px 12px", border: "0.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };

function Checkbox({ checked, onChange, label }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--texte-primaire)", padding: "3px 0", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

export default function CursAuditQuestionnaire({ onValider }) {
  const [typeDocument, setTypeDocument] = useState("");
  const [statutTexte, setStatutTexte] = useState("");
  const [finalites, setFinalites] = useState([]);
  const [questionLibre, setQuestionLibre] = useState("");
  const [degreIntervention, setDegreIntervention] = useState("");
  const [autorisationIA, setAutorisationIA] = useState("");
  const [conditionsIA, setConditionsIA] = useState([]);
  const [adresse, setAdresse] = useState("tu");
  const [ton, setTon] = useState("direct");
  const [posture, setPosture] = useState("accompagnant");
  const [longueur, setLongueur] = useState("détaillé");
  const [role, setRole] = useState("lecteur expert");
  const [erreur, setErreur] = useState(null);

  const estAcadémique = typeDocument === "Mémoire / TFE / travail académique";

  const basculerFinalité = (f) => setFinalites((liste) => liste.includes(f) ? liste.filter((x) => x !== f) : [...liste, f]);
  const basculerCondition = (c) => setConditionsIA((liste) => liste.includes(c) ? liste.filter((x) => x !== c) : [...liste, c]);

  const valider = () => {
    if (!typeDocument || !statutTexte || finalites.length === 0 || !questionLibre.trim() || !degreIntervention) {
      setErreur("Merci de répondre aux questions 1 à 5 (question libre incluse) avant de continuer.");
      return;
    }
    onValider({
      typeDocument,
      statutTexte,
      finaliteAudit: finalites,
      questionLibre: questionLibre.trim(),
      degreIntervention,
      contraintesAcademiques: estAcadémique ? { autorisationIA, conditions: conditionsIA } : null,
      relationIA: { adresse, ton, posture, longueur, role },
    });
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--texte-primaire)", marginBottom: 4 }}>
          Avant de commencer — quelques questions sur votre audit
        </div>
        <p style={{ fontSize: 12.5, color: "var(--texte-tertiaire)", lineHeight: 1.6 }}>
          Sans ce cadrage, l'IA analyse un texte sans savoir ce qu'il est censé être,
          pour qui il est écrit, ni jusqu'où elle a le droit d'intervenir.
        </p>
      </div>

      <div>
        <label style={labelStyle}>1. Quel type de document veux-tu auditer ? *</label>
        <select style={champStyle} value={typeDocument} onChange={(e) => setTypeDocument(e.target.value)}>
          <option value="">— Choisir —</option>
          {TYPES_DOCUMENT.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label style={labelStyle}>2. Ce texte est-il... *</label>
        <select style={champStyle} value={statutTexte} onChange={(e) => setStatutTexte(e.target.value)}>
          <option value="">— Choisir —</option>
          {STATUTS_TEXTE.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div>
        <label style={labelStyle}>3. Que veux-tu obtenir ? * (plusieurs choix possibles)</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
          {FINALITES.map((f) => (
            <Checkbox key={f} checked={finalites.includes(f)} onChange={() => basculerFinalité(f)} label={f} />
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>4. Quelle est la question précise que tu veux poser à CursAudit ? *</label>
        <textarea
          style={{ ...champStyle, minHeight: 70, resize: "vertical" }}
          value={questionLibre}
          onChange={(e) => setQuestionLibre(e.target.value)}
          placeholder="Ex. : Est-ce que mon mémoire répond bien à ma problématique ?"
        />
      </div>

      <div>
        <label style={labelStyle}>5. Que peut faire CursAudit ? *</label>
        <select style={champStyle} value={degreIntervention} onChange={(e) => setDegreIntervention(e.target.value)}>
          <option value="">— Choisir —</option>
          {DEGRES_INTERVENTION.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        {estAcadémique && (
          <p style={{ fontSize: 11.5, color: "#8A6116", marginTop: 6, lineHeight: 1.5 }}>
            Limite pour un mémoire/TFE : CursAudit peut diagnostiquer, questionner, structurer,
            signaler — il ne doit pas écrire le travail à la place de l'étudiant⋅e.
          </p>
        )}
      </div>

      {estAcadémique && (
        <div style={{ background: "var(--fond, #F7F4EF)", padding: "14px 16px", borderRadius: 8 }}>
          <label style={labelStyle}>7. Ton établissement autorise-t-il l'usage de l'IA ?</label>
          <select style={{ ...champStyle, marginBottom: conditionsIA.length >= 0 && autorisationIA === "Oui" ? 12 : 0 }} value={autorisationIA} onChange={(e) => setAutorisationIA(e.target.value)}>
            <option value="">— Choisir —</option>
            <option value="Oui">Oui</option>
            <option value="Non">Non</option>
            <option value="Je ne sais pas">Je ne sais pas</option>
          </select>
          {autorisationIA === "Oui" && (
            <div>
              <label style={{ ...labelStyle, marginTop: 12 }}>À quelles conditions ?</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                {CONDITIONS_IA_ACADEMIQUE.map((c) => (
                  <Checkbox key={c} checked={conditionsIA.includes(c)} onChange={() => basculerCondition(c)} label={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label style={labelStyle}>10. Comment veux-tu que l'IA te parle ?</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <select style={champStyle} value={adresse} onChange={(e) => setAdresse(e.target.value)}>
            <option value="tu">Tutoiement</option>
            <option value="vous">Vouvoiement</option>
          </select>
          <select style={champStyle} value={ton} onChange={(e) => setTon(e.target.value)}>
            <option value="direct">Ton direct</option>
            <option value="diplomatique">Ton diplomatique</option>
          </select>
          <select style={champStyle} value={posture} onChange={(e) => setPosture(e.target.value)}>
            <option value="critique">Critique</option>
            <option value="accompagnant">Accompagnant</option>
            <option value="contradicteur">Contradicteur</option>
          </select>
          <select style={champStyle} value={longueur} onChange={(e) => setLongueur(e.target.value)}>
            <option value="court">Réponses courtes</option>
            <option value="détaillé">Réponses détaillées</option>
          </select>
          <select style={champStyle} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="éditeur">Plutôt éditeur</option>
            <option value="auditeur">Plutôt auditeur</option>
            <option value="coach">Plutôt coach</option>
            <option value="lecteur expert">Plutôt lecteur expert</option>
          </select>
        </div>
      </div>

      {erreur && (
        <div style={{ background: "#FBE9E9", color: "#A32D2D", padding: "10px 14px", borderRadius: 6, fontSize: 13 }}>{erreur}</div>
      )}

      <button onClick={valider} style={{
        background: "#1D9E75", color: "#fff", border: "none", borderRadius: 8,
        padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
      }}>
        Continuer
      </button>
    </div>
  );
}
