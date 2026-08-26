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
  "Biographie / autobiographie",
  "Article",
  "Essai",
  "Rapport professionnel",
  "Dossier personnel",
  "Scène / extrait autonome",
  "Correspondance / message",
  "Poésie",
  "Format alternatif (oracle, livret de cartes, posts réseaux sociaux…)",
  "Autre (à préciser)",
];

// Poésie (référence 60816-01, suite, 24/08/2026) — signalé par l'auteur du
// projet : l'audit d'un poème (rimes, mètre, forme) demande un travail de
// conception plus subtil qu'un audit de prose, que le moteur actuel
// (analyser-unite-cursaudit) ne sait pas faire — pas de dimensions
// dédiées à la scansion ou au schéma de rimes. Plutôt que de laisser
// croire à un audit compétent sur ce point, ce type de document est
// explicitement marqué "à l'étude" et bloque la validation du
// questionnaire — voir estPoésie ci-dessous.
//
// Format alternatif / Autre (référence 60816-01, suite, 24/08/2026) —
// signalé par l'auteur du projet à propos d'un livret-oracle (préface,
// mode d'emploi, cartes courtes regroupées par famille) : ni un manuscrit
// classique, ni un des types déjà listés. Plutôt que de forcer ce genre de
// contenu (livret de cartes, posts réseaux sociaux…) dans une case
// inadaptée, "Format alternatif" regroupe les contenus structurés en
// entrées courtes/non linéaires — le moteur n'a besoin d'aucune dimension
// dédiée pour ça (il segmente déjà en unités), juste d'un rappel dans le
// prompt de ne pas juger l'absence d'arc narratif continu comme un défaut.
// "Autre (à préciser)" couvre le reste : un champ libre, la précision du
// client remplace alors "Autre" comme valeur envoyée au moteur.

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
  const [autrePrécision, setAutrePrécision] = useState("");
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
  const estPoésie = typeDocument === "Poésie";
  const estFormatAlternatif = typeDocument === "Format alternatif (oracle, livret de cartes, posts réseaux sociaux…)";
  const estAutre = typeDocument === "Autre (à préciser)";

  const basculerFinalité = (f) => setFinalites((liste) => liste.includes(f) ? liste.filter((x) => x !== f) : [...liste, f]);
  const basculerCondition = (c) => setConditionsIA((liste) => liste.includes(c) ? liste.filter((x) => x !== c) : [...liste, c]);

  const valider = () => {
    if (estPoésie) {
      setErreur("La poésie est un type de projet à l'étude chez Cursus, pas encore disponible — voir le message ci-dessus.");
      return;
    }
    if (!typeDocument || !statutTexte || finalites.length === 0 || !questionLibre.trim() || !degreIntervention) {
      setErreur("Merci de répondre aux questions 1 à 5 (question libre incluse) avant de continuer.");
      return;
    }
    if (estAutre && !autrePrécision.trim()) {
      setErreur("Merci de préciser le type de document.");
      return;
    }
    onValider({
      typeDocument: estAutre ? autrePrécision.trim() : typeDocument,
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
        {estPoésie && (
          <div style={{ background: "#FBE9E9", border: "0.5px solid #A32D2D50", borderRadius: 8, padding: "12px 14px", marginTop: 8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#A32D2D", marginBottom: 4 }}>
              Type de projet à l'étude — pas encore disponible
            </div>
            <div style={{ fontSize: 11.5, color: "var(--texte-secondaire)", lineHeight: 1.6 }}>
              Auditer un poème correctement demande de respecter sa forme — rimé ou non, structuré
              selon un mètre ou une forme connue (sonnet, haïku, alexandrins…) ou délibérément
              destructuré. CursAudit ne sait pas encore faire cette distinction : plutôt que de
              lancer un audit générique de prose sur un poème et risquer de juger une rupture de
              rythme voulue comme une erreur, ce type de projet reste à l'étude chez nous pour
              l'instant. Choisissez un autre type de document ci-dessus, ou revenez plus tard.
            </div>
          </div>
        )}
        {estFormatAlternatif && (
          <div style={{ background: "var(--fond, #F7F4EF)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "12px 14px", marginTop: 8 }}>
            <div style={{ fontSize: 11.5, color: "var(--texte-secondaire)", lineHeight: 1.6 }}>
              Un contenu de ce type (livret de cartes, oracle, posts réseaux sociaux…) est fait
              d'entrées courtes et autonomes plutôt que d'un fil narratif continu — CursAudit en
              tient compte et ne signalera pas l'absence d'arc narratif comme un défaut.
            </div>
          </div>
        )}
        {estAutre && (
          <input
            style={{ ...champStyle, marginTop: 8 }}
            value={autrePrécision}
            onChange={(e) => setAutrePrécision(e.target.value)}
            placeholder="Précisez le type de document"
          />
        )}
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

      <button onClick={valider} disabled={estPoésie} style={{
        background: estPoésie ? "#ccc" : "#1D9E75", color: "#fff", border: "none", borderRadius: 8,
        padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: estPoésie ? "default" : "pointer", fontFamily: "inherit",
      }}>
        Continuer
      </button>
    </div>
  );
}
