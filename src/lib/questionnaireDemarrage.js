// Questionnaire de démarrage (01/11/2026) — les 11 questions de niveau 1 de `banque_questions` (l'« ADN du projet »).
// La table ne contient PAS les listes de choix : elles sont définies ICI (propositions à valider par Joseph) ; chaque
// question à choix accepte aussi une précision libre (« Autre »). Les réponses vont dans `reponses_questionnaire`
// sous la forme { valeur: "texte" } — c'est ce que lit le Co-pilote (CopiloteIA.jsx, chargerContexteADN).

// Ordre d'affichage (la table n'a pas de colonne d'ordre) : intention → lecteur → genre → ton → thèmes → garde-fous → IA.
export const ORDRE = ["Q001", "Q003", "Q005", "Q009", "Q009b", "Q010", "Q021", "Q022", "Q024", "Q026", "Q030"];

// Séries de questions (01/11/2026, « groupes 1 et 4 » de l'analyse des niveaux 2 et 3 de la banque) :
//  - base : niveau 1, posée à la création du livre ;
//  - affinage : 6 précisions de PROJET du niveau 2, proposées une fois la base terminée ;
//  - personnes : garde-fous « Obligation » du niveau 3 (Q015, Q016, Q019), proposés si le livre évoque des personnes réelles.
// Les autres questions des niveaux 2 et 3 (déclencheurs liés au texte : fin de chapitre, citation, digression…) viendront avec un moteur de déclenchement.
export const SERIES = {
  base: { titre: "Questionnaire de démarrage", ids: ORDRE },
  affinage: { titre: "Pour affiner le projet", ids: ["Q004", "Q006", "Q011", "Q012", "Q020", "Q023"] },
  personnes: { titre: "Personnes réelles et précautions", ids: ["Q015", "Q016", "Q019"] },
};
/** Toutes les questions dont les réponses nourrissent le Co-pilote (CopiloteIA, chargerContexteADN). */
export const IDS_CONTEXTE = [...SERIES.base.ids, ...SERIES.affinage.ids, ...SERIES.personnes.ids];

export const OPTIONS = {
  Q009: ["Roman", "Essai", "Témoignage ou récit de vie", "Guide pratique ou manuel", "Poésie", "Recueil de textes"],
  Q009b: ["Pure fiction", "Récit inspiré de faits réels", "Livre (auto)biographique"],
  Q010: ["Sobre", "Intime", "Poétique", "Humoristique", "Pédagogique", "Direct", "Grave", "Chaleureux"],
  Q024: ["Oui, ils sont essentiels", "Oui, de temps en temps", "Non, je préfère aller droit au but"],
  Q026: ["Relecteur critique", "Questionneur (il pose des questions)", "Conseiller de structure", "Correcteur de la langue", "Intervient seulement à ma demande"],
  Q011: ["Familier", "Courant", "Soutenu", "Littéraire"],
  Q012: ["Prudent : je ménage le lecteur", "Mesuré", "Audacieux : je dis les choses franchement", "Sans retenue"],
  Q020: ["Apaisante", "Mélancolique", "Joyeuse", "Dramatique", "Inquiétante", "Réflexive", "Combative", "Tendre"],
  Q015: ["Oui", "Non", "Je ne sais pas"],
  Q019: ["Diffamation", "Atteinte à la vie privée", "Droit à l'image", "Données personnelles", "Droit d'auteur (citations)", "Aucun à ma connaissance", "Je ne sais pas"],
};
/** Q016 : une LISTE de personnes (nom tel qu'il figure dans le livre + statut), pas un choix unique. */
export const STATUTS_PERSONNE = ["Nom réel", "Pseudonyme", "Personnage composite"];
const ANCIENS_STATUTS = { "noms réels": "Nom réel", "pseudonymes": "Pseudonyme", "personnages composites": "Personnage composite" };
/** « Monsieur Yves — Pseudonyme » (une ligne par personne) → [{ nom, statut }]. Lit aussi l'ancienne réponse à choix unique. */
export function parsePersonnes(valeur) {
  const v = String(valeur || "").trim();
  if (!v) return [];
  return v.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.lastIndexOf(" — ");
    if (i === -1) return ANCIENS_STATUTS[l.toLowerCase()] ? { nom: "", statut: ANCIENS_STATUTS[l.toLowerCase()] } : { nom: l, statut: "" };
    return { nom: l.slice(0, i).trim(), statut: l.slice(i + 3).trim() };
  });
}
export const joindrePersonnes = (lignes) => lignes.filter((x) => x.nom.trim() || x.statut).map((x) => `${x.nom.trim() || "(sans nom)"}${x.statut ? ` — ${x.statut}` : ""}`).join("\n");

/** Questions à choix où « Autre (précisez) » n'a pas de sens. */
export const SANS_AUTRE = new Set(["Q015"]);

export const AIDES = {
  Q001: "Quelques lignes suffisent : ce qui vous pousse à l'écrire.",
  Q021: "Un thème par ligne.",
  Q022: "Ce que le Co-pilote doit surveiller pour vous : une dérive que vous refusez.",
  Q030: "Ce que l'IA ne doit jamais faire (ex. inventer des faits, réécrire dans un autre style).",
  Q004: "Quand deux exigences s'opposent (clarté, rythme, fidélité, audace…), laquelle l'emporte ?",
  Q006: "Utile pour que le Co-pilote ne vous conseille pas pour un lecteur qui n'est pas le vôtre.",
  Q023: "Les lectures erronées possibles : ce que le lecteur pourrait comprendre de travers.",
  Q015: "Garde-fou : le Co-pilote s'en sert pour vous alerter. Ce n'est pas un avis juridique.",
  Q016: "Une ligne par personne, avec le nom tel qu'il figure dans le livre. Garde-fou : le Co-pilote s'en sert pour vous alerter ; ce n'est pas un avis juridique.",
  Q019: "Garde-fou : plusieurs réponses possibles. Ce n'est pas un avis juridique ; en cas de doute, consultez un juriste.",
};

const ORDRE_INDEX = Object.fromEntries(Object.values(SERIES).flatMap((x) => x.ids).map((id, i) => [id, i]));
export const trier = (questions) => [...(questions || [])].sort((a, b) => (ORDRE_INDEX[a.id] ?? 99) - (ORDRE_INDEX[b.id] ?? 99));

/** « choix » (une seule), « multiple » (plusieurs), « liste » (une par ligne), « long », « court » */
export function genre(question) {
  if (question?.id === "Q016") return "personnes";
  // Plusieurs réponses possibles (retour de Joseph 01/11/2026 : énergie émotionnelle, risques, ton).
  if (["Q020", "Q019", "Q010"].includes(question?.id) && OPTIONS[question.id]) return "multiple";
  const t = String(question?.type_reponse || "").toLowerCase();
  if (t.includes("multiple")) return OPTIONS[question.id] ? "multiple" : "long";
  if (t.startsWith("choix") || t.includes("oui")) return OPTIONS[question.id] ? "choix" : "court";
  if (t.includes("liste")) return "liste";
  if (t.includes("long")) return "long";
  return "court";
}

const valeurDe = (reponses, id) => {
  const r = reponses?.[id];
  const v = typeof r === "string" ? r : r?.valeur;
  return typeof v === "string" ? v : "";
};

/** Q009b n'a de sens que si Q009 inclut « Roman » ; Q016 et Q019 que si une personne réelle est identifiable (Q015 ≠ « Non »). */
export function estQuestionActive(id, reponses) {
  if (id === "Q009b") return /roman/i.test(valeurDe(reponses, "Q009"));
  if (id === "Q016" || id === "Q019") return valeurDe(reponses, "Q015").trim().toLowerCase() !== "non";
  return true;
}

/** Questions à poser pour une série, dans l'ordre, conditionnelles comprises. `reponses` : { Q001: { valeur }, … }. */
export const questionsAPoser = (questions, reponses, serie = "base") => {
  const ids = new Set(SERIES[serie].ids);
  return trier(questions).filter((q) => ids.has(q.id) && estQuestionActive(q.id, reponses));
};

/** Complet = toutes les questions ACTIVES de la série ont une réponse non vide. */
export function estComplet(questions, reponses, serie = "base") {
  const a = questionsAPoser(questions, reponses, serie);
  return a.length > 0 && a.every((q) => valeurDe(reponses, q.id).trim() !== "");
}

/**
 * Le livre évoque-t-il des personnes réelles ? Oui si le genre est un témoignage / récit de vie, ou si Q009b dit « faits réels » ou
 * « (auto)biographique » ; non pour une « pure fiction ». Sert à proposer la série « personnes » (rien n'est imposé).
 */
export function personnesReellesProbables(reponses) {
  const genreLivre = valeurDe(reponses, "Q009");
  const fiction = valeurDe(reponses, "Q009b");
  if (/pure fiction/i.test(fiction)) return false;
  return /faits r[ée]els|biograph/i.test(fiction) || /t[ée]moignage|r[ée]cit de vie/i.test(genreLivre);
}

/** Séries proposées après la base : { serie, titre, total, repondues }. */
export function seriesProposees(questions, reponses) {
  const liste = ["affinage"];
  if (personnesReellesProbables(reponses)) liste.push("personnes");
  return liste.map((serie) => {
    const q = questionsAPoser(questions, reponses, serie);
    return { serie, titre: SERIES[serie].titre, total: q.length, repondues: q.filter((x) => valeurDe(reponses, x.id).trim() !== "").length };
  });
}

export const parseMultiple = (v) => String(v || "").split(" ; ").map((s) => s.trim()).filter(Boolean);
export const joindreMultiple = (liste) => liste.filter(Boolean).join(" ; ");
