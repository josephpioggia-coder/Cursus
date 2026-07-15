/**
 * CURSUS — QuestionnaireIntention.jsx
 * (conceptuellement : "L'ADN du projet")
 *
 * Traite le NIVEAU 1 (10 questions + Q009b conditionnelle si "Roman").
 * Les niveaux 2 et 3 émergent ailleurs, contextuellement — pas ici.
 *
 * Version i18n (chantier 04/07/2026) :
 * - Tous les textes d'interface passent par t('adn.xxx')
 * - CORRECTIF BUG : les exemples-amorces de Q021 étaient les thèmes du livre
 *   personnel de Joseph ("La dette", "La transmission"...) et s'affichaient
 *   pour TOUS les projets de TOUS les utilisateurs. Remplacés par des thèmes
 *   génériques, désormais eux-mêmes traduisibles via adn.json.
 * - Les choix fermés (Q009, Q009b) restent stockés en base avec leur valeur
 *   FRANÇAISE canonique même en interface EN, le temps qu'une décision soit
 *   prise sur un système de valeurs stables indépendantes de la langue
 *   affichée (voir note en fin de fichier).
 *
 * Props :
 *   projetId    : id du projet concerné
 *   projetTitre : titre affiché dans l'en-tête
 *   onTerminé   : appelé quand l'auteur valide le récapitulatif final
 *   onFermer    : appelé quand l'auteur reporte / ferme sans terminer
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase.js";

const EDGE_FUNCTION_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/claude-prox";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function appelClaude(system, user) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Session expirée.");

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return data.content?.[0]?.text || "";
}

export default function QuestionnaireIntention({ projetId, projetTitre, onTerminé, onFermer }) {
  const { t } = useTranslation("adn");

  // Choix fermés et suggestions désormais lus depuis adn.json (traduisibles),
  // avec retour à un tableau vide si une question n'a pas d'entrée.
  const CHOIX_PAR_QUESTION = t("choix", { returnObjects: true }) || {};
  const SUGGESTIONS_PAR_QUESTION = t("suggestions", { returnObjects: true }) || {};

  const [chargement, setChargement] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [indexActuel, setIndexActuel] = useState(0);
  const [réponseCourante, setRéponseCourante] = useState("");
  const [enEnregistrement, setEnEnregistrement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [premièreOuverture, setPremièreOuverture] = useState(true);
  const [questionQ009b, setQuestionQ009b] = useState(null);
  const [réponsesMap, setRéponsesMap] = useState({});

  const [étape, setÉtape] = useState("questions");
  const [synthèse, setSynthèse] = useState(null);
  const [chargementSynthèse, setChargementSynthèse] = useState(false);

  useEffect(() => {
    let annulé = false;

    const charger = async () => {
      setChargement(true);
      setErreur(null);

      try {
        const { data: réponses, error: erreurRéponses } = await supabase
          .from("reponses_questionnaire")
          .select("question_id, reponse")
          .eq("projet_id", projetId);

        if (erreurRéponses) throw erreurRéponses;

        const réponsesParId = {};
        (réponses || []).forEach((r) => { réponsesParId[r.question_id] = r.reponse?.valeur ?? ""; });

        const { data: adn, error: erreurBanque } = await supabase
          .from("banque_questions")
          .select("*")
          .eq("niveau", 1)
          .neq("id", "Q009b")
          .order("id");

        if (erreurBanque) throw erreurBanque;

        const { data: q009b } = await supabase
          .from("banque_questions")
          .select("*")
          .eq("id", "Q009b")
          .maybeSingle();

        let listeComplète = adn || [];
        if (q009b && réponsesParId["Q009"] === "Roman") {
          const posQ009 = listeComplète.findIndex((q) => q.id === "Q009");
          listeComplète = [...listeComplète];
          listeComplète.splice(posQ009 + 1, 0, q009b);
        }

        if (!annulé) {
          setQuestions(listeComplète);
          setQuestionQ009b(q009b || null);

          const nbRépondues = Object.keys(réponsesParId).filter((id) =>
            listeComplète.some((q) => q.id === id)
          ).length;
          setPremièreOuverture(nbRépondues === 0);

          const premierIndexNonRépondu = listeComplète.findIndex((q) => !(q.id in réponsesParId));
          if (premierIndexNonRépondu === -1) {
            setÉtape("récapitulatif");
            setIndexActuel(listeComplète.length - 1);
          } else {
            setIndexActuel(premierIndexNonRépondu);
            setRéponseCourante(réponsesParId[listeComplète[premierIndexNonRépondu]?.id] || "");
          }

          setRéponsesMap(réponsesParId);
        }
      } catch (err) {
        if (!annulé) setErreur(err.message || t("erreur.chargement"));
      } finally {
        if (!annulé) setChargement(false);
      }
    };

    if (projetId) charger();
    return () => { annulé = true; };
  }, [projetId, t]);

  const questionActuelle = questions[indexActuel] || null;
  const dernièreQuestion = indexActuel >= questions.length - 1;

  const allerÀ = (nouvelIndex) => {
    setIndexActuel(nouvelIndex);
    const q = questions[nouvelIndex];
    setRéponseCourante((q && réponsesMap[q.id]) || "");
    setÉtape("questions");
  };

  const précédent = () => {
    if (indexActuel > 0) allerÀ(indexActuel - 1);
  };

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

      setRéponsesMap((prev) => ({ ...prev, [questionActuelle.id]: valeur }));

      let questionsActualisées = questions;
      if (questionActuelle.id === "Q009" && questionQ009b) {
        questionsActualisées = questions.filter((q) => q.id !== "Q009b");
        if (valeur === "Roman") {
          const posQ009 = questionsActualisées.findIndex((q) => q.id === "Q009");
          questionsActualisées.splice(posQ009 + 1, 0, questionQ009b);
        }
        setQuestions(questionsActualisées);
      }

      setRéponseCourante("");

      const estLaDernière = indexActuel >= questionsActualisées.length - 1;
      if (estLaDernière) {
        setÉtape("récapitulatif");
      } else {
        const prochainIndex = indexActuel + 1;
        setIndexActuel(prochainIndex);
        setRéponseCourante(réponsesMap[questionsActualisées[prochainIndex]?.id] || "");
      }
    } catch (err) {
      setErreur(err.message || t("erreur.enregistrement"));
    } finally {
      setEnEnregistrement(false);
    }
  };

  const reporter = () => {
    onFermer ? onFermer() : onTerminé?.();
  };

  useEffect(() => {
    if (étape !== "récapitulatif" || synthèse || chargementSynthèse) return;

    const générer = async () => {
      setChargementSynthèse(true);
      try {
        const résumé = questions
          .map((q) => `${q.question} → ${réponsesMap[q.id] || "(non renseigné)"}`)
          .join("\n");

        const texte = await appelClaude(
          "Tu es le co-pilote d'écriture d'un auteur. À partir de ses réponses sur l'ADN de son projet, rédige une synthèse chaleureuse en 3 à 5 phrases, en français, qui explique concrètement comment tu vas l'accompagner sur ce livre précis — le ton que tu adopteras, ce que tu surveilleras, ce que tu éviteras de faire. Adresse-toi directement à l'auteur en \"vous\". Pas de markdown, pas de liste, un texte fluide.",
          résumé
        );
        setSynthèse(texte || null);
      } catch {
        setSynthèse(null);
      } finally {
        setChargementSynthèse(false);
      }
    };

    générer();
  }, [étape, questions, synthèse, chargementSynthèse]);

  if (chargement) {
    return (
      <Overlay>
        <Carte>
          <div style={{ textAlign: "center", padding: "32px 16px", color: "#999", fontSize: 13 }}>
            {t("chargement")}
          </div>
        </Carte>
      </Overlay>
    );
  }

  if (erreur && étape === "questions") {
    return (
      <Overlay>
        <Carte>
          <EnTête projetTitre={projetTitre} onReporter={reporter} t={t} />
          <div style={{ padding: "16px 24px", color: "#A32D2D", fontSize: 13 }}>{erreur}</div>
          <PiedDePage onReporter={reporter} t={t} />
        </Carte>
      </Overlay>
    );
  }

  if (questions.length === 0) return null;

  if (étape === "récapitulatif") {
    return (
      <Overlay>
        <Carte large>
          <EnTête projetTitre={projetTitre} onReporter={reporter} sousTitre={t("titreRecapitulatif")} t={t} />

          <div style={{ padding: "0 24px 16px" }}>
            <div style={{
              padding: "14px 16px", background: "#EEEDFE", borderRadius: 10,
              fontSize: 13, color: "#4A4394", lineHeight: 1.6, minHeight: 40,
            }}>
              {chargementSynthèse
                ? t("synthesePreparation")
                : synthèse || t("syntheseParDefaut")}
            </div>
          </div>

          <div style={{ padding: "0 24px 8px", display: "grid", gap: 8, maxHeight: "40vh", overflowY: "auto" }}>
            {questions.map((q, i) => (
              <div key={q.id} style={{
                padding: "10px 12px", background: "#fafafa", borderRadius: 8,
                border: "0.5px solid #eee", display: "flex", justifyContent: "space-between", gap: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#999", marginBottom: 2 }}>{q.question}</div>
                  <div style={{ fontSize: 13, color: "#1a1a1a" }}>
                    {réponsesMap[q.id] || <span style={{ color: "#bbb" }}>{t("nonRenseigne")}</span>}
                  </div>
                </div>
                <button
                  onClick={() => allerÀ(i)}
                  style={{
                    flexShrink: 0, alignSelf: "center", fontSize: 11, color: "#7F77DD",
                    background: "none", border: "none", cursor: "pointer",
                    fontFamily: "inherit", textDecoration: "underline",
                  }}
                >
                  {t("modifier")}
                </button>
              </div>
            ))}
          </div>

          <div style={{ padding: "16px 24px 20px" }}>
            <button
              onClick={() => onTerminé?.()}
              style={{
                width: "100%", padding: "11px", background: "#7F77DD", color: "#fff",
                border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {t("commencerAEcrire")}
            </button>
          </div>
        </Carte>
      </Overlay>
    );
  }

  const optionsChoixFermé = CHOIX_PAR_QUESTION[questionActuelle.id];
  const suggestions = SUGGESTIONS_PAR_QUESTION[questionActuelle.id];

  return (
    <Overlay>
      {/* Note responsive : largeur fixe encore présente dans <Carte> (problème
          UI n°1 identifié le 04/07 — non traité dans ce chantier, à corriger
          séparément). */}
      <Carte>
        <EnTête projetTitre={projetTitre} onReporter={reporter} sousTitre={t("titreDefaut")} t={t} />

        {premièreOuverture && indexActuel === 0 && (
          <div style={{
            margin: "0 24px 16px", padding: "14px 16px",
            background: "#EEEDFE", borderRadius: 10,
            fontSize: 13, color: "#4A4394", lineHeight: 1.6,
          }}>
            {t("messageAccueil")}
          </div>
        )}

        <div style={{ margin: "0 24px 16px", textAlign: "right" }}>
          <button
            onClick={reporter}
            style={{
              fontSize: 11, color: "#7F77DD", background: "#fff",
              border: "0.5px solid #7F77DD30", borderRadius: 6,
              padding: "4px 10px", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {t("ecrireToutDeSuite")}
          </button>
        </div>

        <div style={{ padding: "0 24px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 4, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              width: `${(indexActuel / questions.length) * 100}%`,
              height: "100%", background: "#7F77DD", borderRadius: 4, transition: "width 0.3s",
            }} />
          </div>
          <span style={{ fontSize: 11, color: "#999", flexShrink: 0 }}>
            {indexActuel + 1} / {questions.length}
          </span>
        </div>

        <div style={{ padding: "8px 24px 20px" }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: "#1a1a1a", marginBottom: 6, lineHeight: 1.5 }}>
            {questionActuelle.question}
          </div>
          {questionActuelle.objectif && (
            <div style={{ fontSize: 12, color: "#999", marginBottom: 14, lineHeight: 1.5 }}>
              {questionActuelle.objectif}
            </div>
          )}

          {optionsChoixFermé ? (
            <div style={{ display: "grid", gap: 8 }}>
              {optionsChoixFermé.map((option) => {
                const sélectionnée = réponseCourante === option;
                return (
                  <button
                    key={option}
                    onClick={() => option !== "Autre" && enregistrerChoix(option)}
                    disabled={enEnregistrement}
                    style={{
                      padding: "10px 14px", textAlign: "left",
                      background: sélectionnée ? "#EEEDFE" : "#fff",
                      border: sélectionnée ? "0.5px solid #7F77DD" : "0.5px solid #e5e5e5",
                      borderRadius: 8, fontSize: 13, color: "#1a1a1a",
                      cursor: enEnregistrement || option === "Autre" ? "default" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {option}
                  </button>
                );
              })}

              <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                <input
                  type="text"
                  value={réponseCourante}
                  onChange={(e) => setRéponseCourante(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && réponseCourante.trim()) enregistrerChoix(réponseCourante.trim()); }}
                  placeholder={t("autrePrecisez")}
                  style={{
                    flex: 1, padding: "9px 12px", border: "0.5px solid #e5e5e5",
                    borderRadius: 8, fontSize: 13, color: "#1a1a1a", fontFamily: "inherit",
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
                  {t("valider")}
                </button>
              </div>
            </div>
          ) : (
            <>
              {suggestions && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setRéponseCourante(s)}
                      style={{
                        fontSize: 11.5, padding: "5px 10px", borderRadius: 20,
                        background: "#f5f5f5", border: "0.5px solid #e5e5e5",
                        color: "#666", cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <textarea
                autoFocus
                value={réponseCourante}
                onChange={(e) => setRéponseCourante(e.target.value)}
                placeholder={t("reponseLibrePlaceholder")}
                rows={4}
                style={{
                  width: "100%", padding: "10px 12px", border: "0.5px solid #e5e5e5",
                  borderRadius: 8, fontSize: 13, color: "#1a1a1a", fontFamily: "inherit",
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
                {enEnregistrement ? t("enregistrement") : dernièreQuestion ? t("voirRecapitulatif") : t("suivant")}
              </button>
            </>
          )}

          {indexActuel > 0 && (
            <button
              onClick={précédent}
              disabled={enEnregistrement}
              style={{
                marginTop: 10, fontSize: 12, color: "#999", background: "none",
                border: "none", cursor: enEnregistrement ? "default" : "pointer", fontFamily: "inherit",
              }}
            >
              {t("questionPrecedente")}
            </button>
          )}
        </div>

        <PiedDePage onReporter={reporter} t={t} />
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

function Carte({ children, large }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16, width: large ? 540 : 460, maxWidth: "100%",
      maxHeight: "85vh", overflowY: "auto",
      boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
    }}>
      {children}
    </div>
  );
}

function EnTête({ projetTitre, sousTitre, onReporter, t }) {
  return (
    <div style={{
      padding: "20px 24px 12px", display: "flex",
      alignItems: "flex-start", justifyContent: "space-between", gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 11, color: "#999", marginBottom: 2 }}>{projetTitre}</div>
        <div style={{ fontSize: 17, fontWeight: 500, color: "#1a1a1a" }}>{sousTitre || t("titreDefaut")}</div>
      </div>
      <button
        onClick={onReporter}
        title={t("fermerTitre")}
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

function PiedDePage({ onReporter, t }) {
  return (
    <div style={{ padding: "12px 24px 20px", borderTop: "0.5px solid #f0f0f0", textAlign: "center" }}>
      <button
        onClick={onReporter}
        style={{
          fontSize: 12, color: "#999", background: "none", border: "none",
          cursor: "pointer", fontFamily: "inherit", textDecoration: "underline",
        }}
      >
        {t("reporter")}
      </button>
    </div>
  );
}

/**
 * NOTE POUR JOSEPH — décision à prendre :
 *
 * Les choix fermés (Q009 = "Roman"/"Essai"/"Conte"/"Autre") sont stockés
 * dans `reponses_questionnaire.reponse.valeur` comme la CHAÎNE AFFICHÉE.
 * Tant que l'interface n'existe qu'en français, ce n'est pas un problème.
 * Mais dès que l'anglais sera actif, un projet en_US répondant "Novel"
 * stockera "Novel", alors qu'un projet fr_FR stocke "Roman" — deux valeurs
 * différentes pour le même sens, ce qui complique toute logique qui lirait
 * cette valeur ailleurs (déclenchement de Q009b, filtres, stats globales).
 *
 * Deux options pour le jour où l'anglais sera activé :
 *   A. Stocker un code stable indépendant de la langue (ex. "roman"), et
 *      ne traduire que l'affichage — implique une petite migration des
 *      réponses déjà enregistrées.
 *   B. Accepter la divergence et faire en sorte que la logique de
 *      déclenchement (Q009 → Q009b) compare sur un ensemble de valeurs
 *      équivalentes par langue plutôt que sur une chaîne unique.
 * Recommandation : A, mais seulement au moment de basculer l'anglais en
 * production — inutile de le faire maintenant pour une UI encore 100% FR.
 */

