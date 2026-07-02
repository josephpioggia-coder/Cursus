/**
 * ATELIER D'ÉCRIVAIN — QuestionnaireIntention.jsx
 * (conceptuellement : "L'ADN du projet" — l'auteur ne remplit pas un formulaire,
 * il définit l'identité de son livre)
 *
 * PHILOSOPHIE (cf. échange du 02/07) :
 * Cursus n'impose pas un cadre ; il accompagne la maturation d'une œuvre.
 * Le premier écran doit être rassurant, pas un questionnaire de 40 questions :
 * "Dix réponses me suffisent. Ensuite tu peux écrire. Je ne t'interromprai
 * que lorsque cela deviendra réellement utile."
 *
 * CE COMPOSANT NE TRAITE QUE LE NIVEAU 1 (10 questions, l'ADN du projet).
 * Les niveaux 2 et 3 — y compris les 6 questions d'obligation qui protègent
 * des tiers — émergent ailleurs, contextuellement, au moment où le texte les
 * rend pertinentes. Ce n'est PAS le rôle de ce composant de les imposer ici :
 * c'est un chantier distinct (triage continu, intégré au cycle d'analyse du
 * co-pilote), volontairement non anticipé pour ne pas trahir la philosophie
 * du logiciel en forçant des questions "avant" qu'elles ne soient utiles.
 *
 * Props :
 *   projetId    : id du projet concerné
 *   projetTitre : titre affiché dans l'en-tête
 *   onTerminé   : appelé quand les 10 questions de l'ADN sont traitées
 *   onFermer    : appelé quand l'auteur reporte / ferme sans terminer
 */

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase.js";

// Questions à choix fermé — gérées comme cas particuliers pour l'instant.
// (Le reste du niveau 1 est en texte libre. Un mécanisme générique piloté
// par type_reponse pourra remplacer ceci si d'autres questions à choix
// conditionnel apparaissent — pas nécessaire de le généraliser ce soir.)
const CHOIX_PAR_QUESTION = {
  Q009: ["Roman", "Essai", "Conte", "Autre"],
  Q009b: ["Pure fiction", "Récit inspiré de faits réels", "Livre (auto)biographique"],
};

export default function QuestionnaireIntention({ projetId, projetTitre, onTerminé, onFermer }) {
  const [chargement, setChargement] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [indexActuel, setIndexActuel] = useState(0);
  const [réponseCourante, setRéponseCourante] = useState("");
  const [enEnregistrement, setEnEnregistrement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [premièreOuverture, setPremièreOuverture] = useState(true);
  const [questionQ009b, setQuestionQ009b] = useState(null);

  // ─── Chargement : les 10 questions de l'ADN du projet, non encore répondues ───
  useEffect(() => {
    let annulé = false;

    const charger = async () => {
      setChargement(true);
      setErreur(null);

      try {
        const { data: réponses, error: erreurRéponses } = await supabase
          .from("reponses_questionnaire")
          .select("question_id")
          .eq("projet_id", projetId);

        if (erreurRéponses) throw erreurRéponses;

        const idsRépondus = new Set((réponses || []).map((r) => r.question_id));

        const { data: adn, error: erreurBanque } = await supabase
          .from("banque_questions")
          .select("*")
          .eq("niveau", 1)
          .neq("id", "Q009b") // conditionnelle — n'apparaît que si Q009 = "Roman"
          .order("id");

        if (erreurBanque) throw erreurBanque;

        // Q009b est chargée à part : elle ne rejoint la liste que si Q009 = "Roman"
        const { data: q009b } = await supabase
          .from("banque_questions")
          .select("*")
          .eq("id", "Q009b")
          .maybeSingle();

        const nonRépondues = (adn || []).filter((q) => !idsRépondus.has(q.id));

        if (!annulé) {
          setQuestions(nonRépondues);
          setQuestionQ009b(q009b || null);
          setIndexActuel(0);
          // Premier écran rassurant seulement si rien n'a encore été répondu du tout
          setPremièreOuverture(idsRépondus.size === 0);
        }
      } catch (err) {
        if (!annulé) setErreur(err.message || "Erreur de chargement.");
      } finally {
        if (!annulé) setChargement(false);
      }
    };

    if (projetId) charger();
    return () => { annulé = true; };
  }, [projetId]);

  const questionActuelle = questions[indexActuel] || null;
  const dernièreQuestion = indexActuel >= questions.length - 1;

  const enregistrerRéponse = async () => {
    if (!questionActuelle || !réponseCourante.trim()) return;
    await sauvegarderEtContinuer(réponseCourante.trim());
  };

  const enregistrerChoix = async (valeur) => {
    await sauvegarderEtContinuer(valeur);
  };

  const sauvegarderEtContinuer = async (valeur) => {
    setEnEnregistrement(true);
    setErreur(null);

    try {
      const { error } = await supabase
        .from("reponses_questionnaire")
        .upsert({
          projet_id: projetId,
          question_id: questionActuelle.id,
          reponse: { valeur },
          statut: "repondu",
        }, { onConflict: "projet_id,question_id" });

      if (error) throw error;

      // Cas particulier : Q009 = "Roman" déclenche la sous-question Q009b.
      // On construit la liste à jour localement pour éviter de se baser sur un
      // état React périmé (setQuestions est asynchrone) au moment de décider
      // si on est sur la dernière question.
      let questionsActualisées = questions;
      if (questionActuelle.id === "Q009" && valeur === "Roman" && questionQ009b) {
        questionsActualisées = [...questions];
        questionsActualisées.splice(indexActuel + 1, 0, questionQ009b);
        setQuestions(questionsActualisées);
      }

      setRéponseCourante("");

      const estLaDernière = indexActuel >= questionsActualisées.length - 1;
      if (estLaDernière) {
        onTerminé?.();
      } else {
        setIndexActuel((i) => i + 1);
      }
    } catch (err) {
      setErreur(err.message || "Impossible d'enregistrer la réponse.");
    } finally {
      setEnEnregistrement(false);
    }
  };

  const reporter = () => {
    onFermer ? onFermer() : onTerminé?.();
  };

  const nbTraitées = useMemo(() => indexActuel, [indexActuel]);

  // ─── États d'affichage ───

  if (chargement) {
    return (
      <Overlay>
        <Carte>
          <div style={{ textAlign: "center", padding: "32px 16px", color: "#999", fontSize: 13 }}>
            Chargement…
          </div>
        </Carte>
      </Overlay>
    );
  }

  if (erreur) {
    return (
      <Overlay>
        <Carte>
          <EnTête projetTitre={projetTitre} onReporter={reporter} />
          <div style={{ padding: "16px 24px", color: "#A32D2D", fontSize: 13 }}>
            {erreur}
          </div>
          <PiedDePage onReporter={reporter} />
        </Carte>
      </Overlay>
    );
  }

  // L'ADN du projet est déjà complet — rien à afficher
  if (questions.length === 0) {
    return null;
  }

  return (
    <Overlay>
      <Carte>
        <EnTête
          projetTitre={projetTitre}
          onReporter={reporter}
          sousTitre="L'ADN du projet"
        />

        {/* Message d'accueil rassurant — seulement à la toute première ouverture */}
        {premièreOuverture && indexActuel === 0 && (
          <div style={{
            margin: "0 24px 16px", padding: "14px 16px",
            background: "#EEEDFE", borderRadius: 10,
            fontSize: 13, color: "#4A4394", lineHeight: 1.6,
          }}>
            Pour commencer, j'ai besoin de te connaître un peu. Dix réponses me suffisent.
            Ensuite tu peux écrire. Je ne t'interromprai que lorsque cela deviendra réellement utile.
          </div>
        )}

        {/* Reporter à plus tard — visible dès l'ouverture, jamais caché en bas */}
        <div style={{ margin: "0 24px 16px", textAlign: "right" }}>
          <button
            onClick={reporter}
            style={{
              fontSize: 11, color: "#7F77DD",
              background: "#fff", border: "0.5px solid #7F77DD30",
              borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Écrire tout de suite, j'y reviens plus tard
          </button>
        </div>

        {/* Progression */}
        <div style={{ padding: "0 24px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 4, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              width: `${(nbTraitées / questions.length) * 100}%`,
              height: "100%", background: "#7F77DD", borderRadius: 4, transition: "width 0.3s",
            }} />
          </div>
          <span style={{ fontSize: 11, color: "#999", flexShrink: 0 }}>
            {indexActuel + 1} / {questions.length}
          </span>
        </div>

        {/* Question actuelle */}
        <div style={{ padding: "8px 24px 20px" }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: "#1a1a1a", marginBottom: 6, lineHeight: 1.5 }}>
            {questionActuelle.question}
          </div>
          {questionActuelle.objectif && (
            <div style={{ fontSize: 12, color: "#999", marginBottom: 14, lineHeight: 1.5 }}>
              {questionActuelle.objectif}
            </div>
          )}

          {CHOIX_PAR_QUESTION[questionActuelle.id] ? (
            <div style={{ display: "grid", gap: 8 }}>
              {CHOIX_PAR_QUESTION[questionActuelle.id].map((option) => (
                <button
                  key={option}
                  onClick={() => option === "Autre" ? null : enregistrerChoix(option)}
                  disabled={enEnregistrement}
                  style={{
                    padding: "10px 14px", textAlign: "left",
                    background: réponseCourante && option === "Autre" ? "#EEEDFE" : "#fff",
                    border: réponseCourante && option === "Autre" ? "0.5px solid #7F77DD" : "0.5px solid #e5e5e5",
                    borderRadius: 8,
                    fontSize: 13, color: "#1a1a1a",
                    cursor: enEnregistrement || option === "Autre" ? "default" : "pointer", fontFamily: "inherit",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => { if (option !== "Autre") { e.currentTarget.style.borderColor = "#7F77DD"; e.currentTarget.style.background = "#EEEDFE"; } }}
                  onMouseLeave={(e) => { if (option !== "Autre" || !réponseCourante) { e.currentTarget.style.borderColor = "#e5e5e5"; e.currentTarget.style.background = "#fff"; } }}
                >
                  {option}
                </button>
              ))}

              {/* Précision libre pour "Autre" — la liste de boutons n'est jamais exhaustive */}
              <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                <input
                  type="text"
                  value={réponseCourante}
                  onChange={(e) => setRéponseCourante(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && réponseCourante.trim()) enregistrerChoix(réponseCourante.trim()); }}
                  placeholder="Autre — précisez…"
                  style={{
                    flex: 1, padding: "9px 12px",
                    border: "0.5px solid #e5e5e5", borderRadius: 8,
                    fontSize: 13, color: "#1a1a1a", fontFamily: "inherit",
                    outline: "none", boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={() => réponseCourante.trim() && enregistrerChoix(réponseCourante.trim())}
                  disabled={enEnregistrement || !réponseCourante.trim()}
                  style={{
                    padding: "9px 16px", background: "#7F77DD", color: "#fff",
                    border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500,
                    cursor: enEnregistrement || !réponseCourante.trim() ? "default" : "pointer",
                    opacity: enEnregistrement || !réponseCourante.trim() ? 0.5 : 1,
                    fontFamily: "inherit", whiteSpace: "nowrap",
                  }}
                >
                  Valider
                </button>
              </div>
            </div>
          ) : (
            <>
              <textarea
                autoFocus
                value={réponseCourante}
                onChange={(e) => setRéponseCourante(e.target.value)}
                placeholder="Votre réponse…"
                rows={4}
                style={{
                  width: "100%", padding: "10px 12px",
                  border: "0.5px solid #e5e5e5", borderRadius: 8,
                  fontSize: 13, color: "#1a1a1a", fontFamily: "inherit",
                  outline: "none", boxSizing: "border-box", resize: "vertical",
                }}
              />

              <button
                onClick={enregistrerRéponse}
                disabled={enEnregistrement || !réponseCourante.trim()}
                style={{
                  width: "100%", marginTop: 14, padding: "10px", background: "#7F77DD", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500,
                  cursor: enEnregistrement || !réponseCourante.trim() ? "default" : "pointer",
                  opacity: enEnregistrement || !réponseCourante.trim() ? 0.6 : 1,
                  fontFamily: "inherit",
                }}
              >
                {enEnregistrement ? "Enregistrement…" : dernièreQuestion ? "Terminer — commencer à écrire" : "Suivant"}
              </button>
            </>
          )}
        </div>

        <PiedDePage onReporter={reporter} />
      </Carte>
    </Overlay>
  );
}

// ─── Sous-composants d'affichage ───────────────────────────────────────

function Overlay({ children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100, padding: 20,
    }}>
      {children}
    </div>
  );
}

function Carte({ children }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16, width: 460, maxWidth: "100%",
      maxHeight: "85vh", overflowY: "auto",
      boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
    }}>
      {children}
    </div>
  );
}

function EnTête({ projetTitre, sousTitre, onReporter }) {
  return (
    <div style={{
      padding: "20px 24px 12px", display: "flex",
      alignItems: "flex-start", justifyContent: "space-between", gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 11, color: "#999", marginBottom: 2 }}>{projetTitre}</div>
        <div style={{ fontSize: 17, fontWeight: 500, color: "#1a1a1a" }}>{sousTitre || "L'ADN du projet"}</div>
      </div>
      <button
        onClick={onReporter}
        title="Fermer et y revenir plus tard"
        style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: "50%",
          border: "none", background: "#f5f5f5", color: "#999",
          fontSize: 14, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        ✕
      </button>
    </div>
  );
}

function PiedDePage({ onReporter }) {
  return (
    <div style={{
      padding: "12px 24px 20px", borderTop: "0.5px solid #f0f0f0",
      textAlign: "center",
    }}>
      <button
        onClick={onReporter}
        style={{
          fontSize: 12, color: "#999", background: "none",
          border: "none", cursor: "pointer", fontFamily: "inherit",
          textDecoration: "underline",
        }}
      >
        Reporter à plus tard
      </button>
    </div>
  );
}

/**
 * ATELIER D'ÉCRIVAIN — QuestionnaireIntention.jsx
 *
 * Remplace l'ancien système à 11 questions fixes.
 * S'appuie sur la banque de 66 questions (voir schema-questionnaire.sql).
 *
 * ÉTAPE ACTUELLE (construction incrémentale, cf. compte-rendu du 01/07) :
 * Seules les 6 questions d'OBLIGATION sont mises en œuvre ici — celles qui protègent
 * des tiers absents de la conversation ou exposent juridiquement l'auteur
 * (personne réelle identifiable, consentement, droit d'auteur...). Elles ne sont
 * JAMAIS silençables, contrairement aux questions de recommandation.
 *
 * Le mécanisme complet de triage continu sur les 60 questions de recommandation
 * (déclenché par le cycle d'analyse du co-pilote, plafonné à 1 par session)
 * est un chantier distinct, à construire une fois ce socle validé en usage réel —
 * conformément à l'ordre de construction retenu : les obligations d'abord, seules,
 * testées, avant le mécanisme complet.
 *
 * Deux modes :
 * - DÉMARRAGE : aucune des 6 obligations n'a encore de réponse pour ce projet.
 * - REPRISE : certaines obligations ont déjà une réponse ; seules les obligations
 *   manquantes sont proposées.
 *
 * Le bouton "Reporter à plus tard" est visible dès l'ouverture, en haut du panneau —
 * mais le rappel réapparaîtra tant que les 6 obligations ne sont pas toutes traitées,
 * car elles protègent des tiers et non le seul confort de l'auteur.
 *
 * Props :
 *   projetId    : id du projet concerné
 *   projetTitre : titre affiché dans l'en-tête
 *   onTerminé   : appelé quand les obligations restantes ont été traitées
 *   onFermer    : appelé quand l'auteur reporte / ferme sans terminer
 */

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase.js";

export default function QuestionnaireIntention({ projetId, projetTitre, onTerminé, onFermer }) {
  const [chargement, setChargement] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [indexActuel, setIndexActuel] = useState(0);
  const [réponseCourante, setRéponseCourante] = useState("");
  const [enEnregistrement, setEnEnregistrement] = useState(false);
  const [erreur, setErreur] = useState(null);

  // ─── Chargement initial : les obligations non encore répondues pour ce projet ───
  useEffect(() => {
    let annulé = false;

    const charger = async () => {
      setChargement(true);
      setErreur(null);

      try {
        // Réponses déjà enregistrées pour ce projet
        const { data: réponses, error: erreurRéponses } = await supabase
          .from("reponses_questionnaire")
          .select("question_id")
          .eq("projet_id", projetId);

        if (erreurRéponses) throw erreurRéponses;

        const idsRépondus = new Set((réponses || []).map((r) => r.question_id));

        // Les 6 questions d'obligation, dans l'ordre de la banque
        const { data: obligations, error: erreurBanque } = await supabase
          .from("banque_questions")
          .select("*")
          .eq("nature_intervention", "Obligation")
          .order("id");

        if (erreurBanque) throw erreurBanque;

        const nonRépondues = (obligations || []).filter((q) => !idsRépondus.has(q.id));

        if (!annulé) {
          setQuestions(nonRépondues);
          setIndexActuel(0);
        }
      } catch (err) {
        if (!annulé) setErreur(err.message || "Erreur de chargement du questionnaire.");
      } finally {
        if (!annulé) setChargement(false);
      }
    };

    if (projetId) charger();
    return () => { annulé = true; };
  }, [projetId]);

  const questionActuelle = questions[indexActuel] || null;
  const dernièreQuestion = indexActuel >= questions.length - 1;

  const enregistrerRéponse = async () => {
    if (!questionActuelle || !réponseCourante.trim()) return;
    setEnEnregistrement(true);
    setErreur(null);

    try {
      const { error } = await supabase
        .from("reponses_questionnaire")
        .upsert({
          projet_id: projetId,
          question_id: questionActuelle.id,
          reponse: { valeur: réponseCourante.trim() },
          statut: "repondu",
        }, { onConflict: "projet_id,question_id" });

      if (error) throw error;

      setRéponseCourante("");
      passerÀLaSuite();
    } catch (err) {
      setErreur(err.message || "Impossible d'enregistrer la réponse.");
    } finally {
      setEnEnregistrement(false);
    }
  };

  // L'auteur juge, en connaissance de cause, que cette question ne s'applique pas
  // à son projet. Contrairement à "reporter", elle ne reviendra plus jamais —
  // c'est un jugement définitif de sa responsabilité, pas une préférence de confort.
  const marquerSansObjet = async () => {
    if (!questionActuelle) return;
    setEnEnregistrement(true);
    setErreur(null);

    try {
      const { error } = await supabase
        .from("reponses_questionnaire")
        .upsert({
          projet_id: projetId,
          question_id: questionActuelle.id,
          reponse: null,
          statut: "sans_objet",
        }, { onConflict: "projet_id,question_id" });

      if (error) throw error;

      setRéponseCourante("");
      passerÀLaSuite();
    } catch (err) {
      setErreur(err.message || "Impossible d'enregistrer ce choix.");
    } finally {
      setEnEnregistrement(false);
    }
  };

  const passerÀLaSuite = () => {
    if (dernièreQuestion) {
      onTerminé?.();
    } else {
      setIndexActuel((i) => i + 1);
      setRéponseCourante("");
    }
  };

  const reporter = () => {
    onFermer ? onFermer() : onTerminé?.();
  };

  const nbTraitées = useMemo(() => indexActuel, [indexActuel]);

  // ─── États d'affichage ───

  if (chargement) {
    return (
      <Overlay>
        <Carte>
          <div style={{ textAlign: "center", padding: "32px 16px", color: "#999", fontSize: 13 }}>
            Chargement du questionnaire…
          </div>
        </Carte>
      </Overlay>
    );
  }

  if (erreur) {
    return (
      <Overlay>
        <Carte>
          <EnTête projetTitre={projetTitre} onReporter={reporter} />
          <div style={{ padding: "16px 24px", color: "#A32D2D", fontSize: 13 }}>
            {erreur}
          </div>
          <PiedDePage onReporter={reporter} />
        </Carte>
      </Overlay>
    );
  }

  // Toutes les obligations sont déjà répondues — rien à afficher
  if (questions.length === 0) {
    return null;
  }

  return (
    <Overlay>
      <Carte>
        <EnTête
          projetTitre={projetTitre}
          onReporter={reporter}
          sousTitre="Quelques points à clarifier avant de poursuivre"
        />

        {/* Bannière — ces questions protègent des tiers, elles ne sont pas de simples préférences */}
        <div style={{
          margin: "0 24px 16px", padding: "8px 12px",
          background: "#FAEEDA", borderRadius: 8,
          fontSize: 12, color: "#854F0B", lineHeight: 1.5,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
        }}>
          <span>
            {questions.length} question{questions.length > 1 ? "s" : ""} de protection (personnes concernées, droit d'auteur) — ces points reviendront tant qu'ils ne sont pas traités.
          </span>
        </div>

        {/* Reporter à plus tard — visible dès l'ouverture */}
        <div style={{ margin: "0 24px 16px", textAlign: "right" }}>
          <button
            onClick={reporter}
            style={{
              fontSize: 11, color: "#854F0B",
              background: "#fff", border: "0.5px solid #854F0B30",
              borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Reporter à plus tard
          </button>
        </div>

        {/* Progression */}
        <div style={{ padding: "0 24px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 4, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              width: `${((nbTraitées) / questions.length) * 100}%`,
              height: "100%", background: "#BA7517", borderRadius: 4, transition: "width 0.3s",
            }} />
          </div>
          <span style={{ fontSize: 11, color: "#999", flexShrink: 0 }}>
            {indexActuel + 1} / {questions.length}
          </span>
        </div>

        {/* Question actuelle */}
        <div style={{ padding: "8px 24px 20px" }}>
          <div style={{ fontSize: 10, color: "#BA7517", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>
            {questionActuelle.famille}{questionActuelle.sous_famille ? ` · ${questionActuelle.sous_famille}` : ""}
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "#1a1a1a", marginBottom: 6, lineHeight: 1.5 }}>
            {questionActuelle.question}
          </div>
          {questionActuelle.objectif && (
            <div style={{ fontSize: 12, color: "#999", marginBottom: 14, lineHeight: 1.5 }}>
              {questionActuelle.objectif}
            </div>
          )}

          <textarea
            autoFocus
            value={réponseCourante}
            onChange={(e) => setRéponseCourante(e.target.value)}
            placeholder="Votre réponse…"
            rows={4}
            style={{
              width: "100%", padding: "10px 12px",
              border: "0.5px solid #e5e5e5", borderRadius: 8,
              fontSize: 13, color: "#1a1a1a", fontFamily: "inherit",
              outline: "none", boxSizing: "border-box", resize: "vertical",
            }}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              onClick={enregistrerRéponse}
              disabled={enEnregistrement || !réponseCourante.trim()}
              style={{
                flex: 1, padding: "9px", background: "#BA7517", color: "#fff",
                border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500,
                cursor: enEnregistrement || !réponseCourante.trim() ? "default" : "pointer",
                opacity: enEnregistrement || !réponseCourante.trim() ? 0.6 : 1,
                fontFamily: "inherit",
              }}
            >
              {enEnregistrement ? "Enregistrement…" : dernièreQuestion ? "Terminer" : "Répondre et continuer"}
            </button>
            <button
              onClick={marquerSansObjet}
              disabled={enEnregistrement}
              title="Cette question ne s'applique pas à ce projet — elle ne reviendra plus"
              style={{
                padding: "9px 14px", background: "transparent",
                border: "0.5px solid #e5e5e5", borderRadius: 8,
                fontSize: 13, color: "#999", cursor: enEnregistrement ? "default" : "pointer",
                fontFamily: "inherit", whiteSpace: "nowrap",
              }}
            >
              Sans objet
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#bbb", marginTop: 6, lineHeight: 1.5 }}>
            « Sans objet » signifie que cette question ne reviendra plus jamais pour ce projet — à utiliser si elle ne s'applique vraiment pas, pas par simple confort du moment.
          </div>
        </div>

        <PiedDePage onReporter={reporter} />
      </Carte>
    </Overlay>
  );
}

// ─── Sous-composants d'affichage ───────────────────────────────────────

function Overlay({ children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100, padding: 20,
    }}>
      {children}
    </div>
  );
}

function Carte({ children }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16, width: 460, maxWidth: "100%",
      maxHeight: "85vh", overflowY: "auto",
      boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
    }}>
      {children}
    </div>
  );
}

function EnTête({ projetTitre, sousTitre, onReporter }) {
  return (
    <div style={{
      padding: "20px 24px 12px", display: "flex",
      alignItems: "flex-start", justifyContent: "space-between", gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 11, color: "#999", marginBottom: 2 }}>{projetTitre}</div>
        <div style={{ fontSize: 17, fontWeight: 500, color: "#1a1a1a" }}>Cap du projet</div>
        {sousTitre && (
          <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{sousTitre}</div>
        )}
      </div>
      <button
        onClick={onReporter}
        title="Fermer et reporter à plus tard"
        style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: "50%",
          border: "none", background: "#f5f5f5", color: "#999",
          fontSize: 14, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        ✕
      </button>
    </div>
  );
}

function PiedDePage({ onReporter }) {
  return (
    <div style={{
      padding: "12px 24px 20px", borderTop: "0.5px solid #f0f0f0",
      textAlign: "center",
    }}>
      <button
        onClick={onReporter}
        style={{
          fontSize: 12, color: "#999", background: "none",
          border: "none", cursor: "pointer", fontFamily: "inherit",
          textDecoration: "underline",
        }}
      >
        Reporter tout à plus tard
      </button>
    </div>
  );
}

