// Questionnaire de démarrage (01/11/2026) — les 11 questions de niveau 1 de `banque_questions` (l'« ADN du projet »).
// La table ne contient PAS les listes de choix : elles sont définies ICI (propositions à valider par Joseph) ; chaque
// question à choix accepte aussi une précision libre (« Autre »). Les réponses vont dans `reponses_questionnaire`
// sous la forme { valeur: "texte" } — c'est ce que lit le Co-pilote (CopiloteIA.jsx, chargerContexteADN).

// Ordre d'affichage (la table n'a pas de colonne d'ordre) : intention → lecteur → genre → ton → thèmes → garde-fous → IA.
export const ORDRE = ["Q001", "Q003", "Q005", "Q009", "Q009b", "Q010", "Q021", "Q022", "Q024", "Q026", "Q030"];

export const OPTIONS = {
  Q009: ["Roman", "Essai", "Témoignage ou récit de vie", "Guide pratique ou manuel", "Poésie", "Recueil de textes"],
  Q009b: ["Pure fiction", "Récit inspiré de faits réels", "Livre (auto)biographique"],
  Q010: ["Sobre", "Intime", "Poétique", "Humoristique", "Pédagogique", "Direct", "Grave", "Chaleureux"],
  Q024: ["Oui, ils sont essentiels", "Oui, de temps en temps", "Non, je préfère aller droit au but"],
  Q026: ["Relecteur critique", "Questionneur (il pose des questions)", "Conseiller de structure", "Correcteur de la langue", "Intervient seulement à ma demande"],
};

export const AIDES = {
  Q001: "Quelques lignes suffisent : ce qui vous pousse à l'écrire.",
  Q021: "Un thème par ligne.",
  Q022: "Ce que le Co-pilote doit surveiller pour vous : une dérive que vous refusez.",
  Q030: "Ce que l'IA ne doit jamais faire (ex. inventer des faits, réécrire dans un autre style).",
};

const ORDRE_INDEX = Object.fromEntries(ORDRE.map((id, i) => [id, i]));
export const trier = (questions) => [...(questions || [])].sort((a, b) => (ORDRE_INDEX[a.id] ?? 99) - (ORDRE_INDEX[b.id] ?? 99));

/** « choix » (une seule), « multiple » (plusieurs), « liste » (une par ligne), « long », « court » */
export function genre(question) {
  const t = String(question?.type_reponse || "").toLowerCase();
  if (t.includes("multiple")) return OPTIONS[question.id] ? "multiple" : "long";
  if (t.startsWith("choix")) return OPTIONS[question.id] ? "choix" : "court";
  if (t.includes("liste")) return "liste";
  if (t.includes("long")) return "long";
  return "court";
}

const valeurDe = (reponses, id) => {
  const r = reponses?.[id];
  const v = typeof r === "string" ? r : r?.valeur;
  return typeof v === "string" ? v : "";
};

/** Q009b (pure fiction / faits réels / biographie) n'a de sens que si Q009 inclut « Roman ». */
export const estQuestionActive = (id, reponses) => id !== "Q009b" || /roman/i.test(valeurDe(reponses, "Q009"));

/** Questions à poser, dans l'ordre, conditionnelles comprises. `reponses` : { Q001: { valeur }, … }. */
export const questionsAPoser = (questions, reponses) => trier(questions).filter((q) => estQuestionActive(q.id, reponses));

/** Complet = toutes les questions ACTIVES ont une réponse non vide (Q009b ignorée si le livre n'est pas un roman). */
export function estComplet(questions, reponses) {
  const a = questionsAPoser(questions, reponses);
  return a.length > 0 && a.every((q) => valeurDe(reponses, q.id).trim() !== "");
}

export const parseMultiple = (v) => String(v || "").split(" ; ").map((s) => s.trim()).filter(Boolean);
export const joindreMultiple = (liste) => liste.filter(Boolean).join(" ; ");
