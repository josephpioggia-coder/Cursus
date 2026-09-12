/**
 * CURSUS — Import du questionnaire CursAudit rempli au format Word
 * (référence 60816-01, suite, 07/09/2026)
 * ======================================================================
 * Lit un .docx rempli à partir du modèle généré pour l'auteur du projet
 * (voir docs — "Questionnaire-CursAudit.docx") et reconstruit un objet de
 * la même forme que `contratComplet()` dans CursAuditQuestionnaire.jsx,
 * directement consommable par `appliquerContrat()` là-bas — même chemin
 * que la réutilisation d'un audit précédent ou l'import JSON, pas de
 * logique de restauration d'état dupliquée.
 *
 * Réutilise `analyserStructureDocx` (segmenterCursAudit.js), déjà éprouvé
 * en production pour lire le texte du manuscrit importé — même lecture
 * JSZip, juste appliquée au questionnaire plutôt qu'au livre.
 *
 * CONVENTION DU MODÈLE (doit rester synchronisée avec le générateur du
 * document) :
 *   - une section commence par un paragraphe "N. <titre exact>"
 *   - une case à cocher est une ligne "[ ] Texte" ou "[X] Texte"
 *   - "Autre" est une case cochée suivie de ": texte tapé sur la même ligne"
 *   - une réponse libre suit un paragraphe exact "→ Votre réponse :"
 *   - un champ court est un paragraphe "Label : réponse tapée à la suite"
 *
 * LIMITE ASSUMÉE : la "nature du projet" (question 4) est un arbre à 415
 * chemins dans l'application — impossible à reconstruire fiablement à
 * partir d'un texte libre. Cette réponse est renvoyée à part
 * (`natureProjetLibre`) pour affichage/référence, jamais convertie en
 * chemin d'arbre ; l'auteur·ice doit encore choisir la nature manuellement
 * après import, `avertissements` le rappelle explicitement.
 */

import { analyserStructureDocx } from "./segmenterCursAudit.js";
import {
  OU_EN_ETES_VOUS, OBJECTIFS, DESTINATAIRES, CRITERES_REUSSITE, CE_QUE_VOUS_ESPEREZ_DECOUVRIR,
} from "./taxonomieContratIntentionCursAudit.js";
import {
  FINALITES, DEGRES_INTERVENTION, CONDITIONS_IA_ACADEMIQUE, PREOCCUPATIONS_QUESTION_PRECISE,
} from "../components/CursAuditQuestionnaire.jsx";

const SECTIONS = [
  "Nouvel audit ?",
  "Votre profil",
  "Où en êtes-vous dans ce projet ?",
  "Quelle est la nature de votre projet ?",
  "Pourquoi écrivez-vous ?",
  "Pour qui écrivez-vous ?",
  "Qu'attendez-vous de cet audit ?",
  "À quoi reconnaîtrez-vous que ce projet est réussi ?",
  "Qu'espérez-vous découvrir que vous ignorez encore ?",
  "Quelle est la question précise que vous voulez poser à CursAudit ?",
  "Que peut faire CursAudit ?",
  "Ce texte est-il un travail académique ?",
  "Comment voulez-vous que l'IA vous parle ?",
];

function segmenterParSection(lignes) {
  // CORRECTIF 07/09/2026, trouvé en testant contre un vrai document rempli :
  // égalité stricte contre SECTIONS["Votre profil"] ne matchait jamais le
  // titre réel du modèle ("Votre profil (réutilisé pour...)"), plus long —
  // toute la section 1 avalait le contenu de la section 2 sans avertissement
  // fiable. Passé en `includes()` : plus robuste à un futur ajustement de
  // libellé dans le générateur du modèle, tant que le préfixe distinctif
  // reste présent.
  const indices = SECTIONS.map((titre) =>
    lignes.findIndex((l) => l.replace(/^\d+\.\s*/, "").trim().toLowerCase().includes(titre.toLowerCase()))
  );
  const blocs = {};
  SECTIONS.forEach((titre, i) => {
    const début = indices[i];
    if (début === -1) { blocs[titre] = []; return; }
    const prochainDébut = indices.slice(i + 1).find((idx) => idx !== -1);
    const fin = prochainDébut !== undefined ? prochainDébut : lignes.length;
    blocs[titre] = lignes.slice(début + 1, fin);
  });
  return blocs;
}

function extraireCasesCochées(lignes, optionsConnues) {
  const trouvées = [];
  for (const l of lignes) {
    const m = /^\[([Xx])\]\s*(.+)$/.exec(l);
    if (!m) continue;
    const texte = m[2].trim();
    const connue = optionsConnues.find((o) => o.toLowerCase() === texte.toLowerCase());
    if (connue) trouvées.push(connue);
  }
  return trouvées;
}

function extraireChoixUnique(lignes, optionsConnues) {
  return extraireCasesCochées(lignes, optionsConnues)[0] || "";
}

function extraireAutre(lignes) {
  for (const l of lignes) {
    const m = /^\[([Xx])\]\s*Autre\s*:\s*(.+)$/i.exec(l);
    if (m && m[2].trim()) return m[2].trim();
  }
  return "";
}

function extraireChampCourt(lignes, label) {
  const préfixe = label.toLowerCase() + " :";
  for (const l of lignes) {
    if (l.toLowerCase().startsWith(préfixe)) {
      return l.slice(l.indexOf(":") + 1).trim();
    }
  }
  return "";
}

function extraireRéponseLibre(lignes) {
  const idx = lignes.findIndex((l) => l.trim() === "→ Votre réponse :");
  if (idx === -1) return "";
  // Tout ce qui suit jusqu'à la fin du bloc — sépare aussi un éventuel
  // sous-bloc "Ma question centrale" (question 10) en s'arrêtant à la
  // prochaine ligne qui ressemble à un nouveau label plutôt qu'à du texte
  // libre ; en pratique, les blocs sont déjà isolés par segmenterParSection.
  return lignes.slice(idx + 1).join(" ").trim();
}

const VALEURS_RELATION_IA = {
  adresse: { Tutoiement: "tu", Vouvoiement: "vous" },
  ton: { "Ton direct": "direct", "Ton diplomatique": "diplomatique" },
  posture: { Critique: "critique", Accompagnant: "accompagnant", Contradicteur: "contradicteur" },
  longueur: { "Réponses courtes": "court", "Réponses détaillées": "détaillé" },
  role: { "Plutôt éditeur": "éditeur", "Plutôt auditeur": "auditeur", "Plutôt coach": "coach", "Plutôt lecteur expert": "lecteur expert" },
};

/**
 * @param {File} fichier
 * @returns {Promise<{ data: object|null, error: {message: string}|null, avertissements: string[] }>}
 */
export async function importerQuestionnaireDocx(fichier) {
  let infos;
  try {
    ({ infos } = await analyserStructureDocx(fichier));
  } catch (e) {
    return { data: null, error: { message: "Impossible de lire ce fichier : " + e.message }, avertissements: [] };
  }

  const lignes = infos.map((i) => i.texte.trim()).filter((t) => t.length > 0);
  const blocs = segmenterParSection(lignes);
  const avertissements = [];

  SECTIONS.forEach((titre) => {
    if (blocs[titre].length === 0) avertissements.push(`Section "${titre}" introuvable dans le document — laissée vide.`);
  });

  const titreLivre = extraireRéponseLibre(blocs["Nouvel audit ?"]);

  const auteurEstUtilisateur = !extraireCasesCochées(blocs["Votre profil"], ["Un·e autre auteur·ice"]).length;
  const profilAuteurAudit = auteurEstUtilisateur ? null : {
    profession: extraireChampCourt(blocs["Votre profil"], "Profession"),
    identiteGenre: extraireChampCourt(blocs["Votre profil"], "Identité de genre (facultatif)"),
    trancheAge: extraireChampCourt(blocs["Votre profil"], "Tranche d'âge (facultatif)"),
    niveauEtudes: extraireChampCourt(blocs["Votre profil"], "Niveau d'études"),
    matieresEtudiees: extraireChampCourt(blocs["Votre profil"], "Matières / domaines étudiés"),
  };

  const ouEnEtesVous = extraireChoixUnique(blocs["Où en êtes-vous dans ce projet ?"], OU_EN_ETES_VOUS);

  const natureProjetLibre = extraireRéponseLibre(blocs["Quelle est la nature de votre projet ?"]);
  if (natureProjetLibre) {
    avertissements.push("La nature du projet ne peut pas être importée automatiquement (arbre de choix de l'application) — à sélectionner manuellement. Réponse notée dans le document : « " + natureProjetLibre + " ».");
  }

  const objectifs = extraireCasesCochées(blocs["Pourquoi écrivez-vous ?"], OBJECTIFS);
  const objectifsAutre = extraireAutre(blocs["Pourquoi écrivez-vous ?"]);

  const destinataires = extraireCasesCochées(blocs["Pour qui écrivez-vous ?"], DESTINATAIRES);
  const destinatairesAutre = extraireAutre(blocs["Pour qui écrivez-vous ?"]);

  const attentesCursus = extraireCasesCochées(blocs["Qu'attendez-vous de cet audit ?"], FINALITES);
  const attentesCursusAutre = extraireAutre(blocs["Qu'attendez-vous de cet audit ?"]);

  const criteresReussite = extraireCasesCochées(blocs["À quoi reconnaîtrez-vous que ce projet est réussi ?"], CRITERES_REUSSITE);
  const criteresReussiteAutre = extraireAutre(blocs["À quoi reconnaîtrez-vous que ce projet est réussi ?"]);

  const ceQueVousEspérezDécouvrir = extraireCasesCochées(blocs["Qu'espérez-vous découvrir que vous ignorez encore ?"], CE_QUE_VOUS_ESPEREZ_DECOUVRIR);
  const ceQueVousEspérezDécouvrirAutre = extraireAutre(blocs["Qu'espérez-vous découvrir que vous ignorez encore ?"]);

  const blocQuestionPrécise = blocs["Quelle est la question précise que vous voulez poser à CursAudit ?"];
  const preoccupations = extraireCasesCochées(blocQuestionPrécise, PREOCCUPATIONS_QUESTION_PRECISE);
  const preoccupationAutre = extraireAutre(blocQuestionPrécise);
  const questionLibre = extraireRéponseLibre(blocQuestionPrécise);

  const libelléDegré = extraireChoixUnique(blocs["Que peut faire CursAudit ?"], DEGRES_INTERVENTION.map((d) => d.label));
  const degreIntervention = DEGRES_INTERVENTION.find((d) => d.label === libelléDegré)?.id || "";

  const blocAcadémique = blocs["Ce texte est-il un travail académique ?"];
  const estTravailAcademique = extraireCasesCochées(blocAcadémique, ["Oui"]).length > 0;
  const contraintesAcademiques = estTravailAcademique ? {
    autorisationIA: extraireChampCourt(blocAcadémique, "Réponse"),
    conditions: extraireCasesCochées(blocAcadémique, CONDITIONS_IA_ACADEMIQUE),
  } : null;

  const blocRelation = blocs["Comment voulez-vous que l'IA vous parle ?"];
  const relationIA = {
    adresse: VALEURS_RELATION_IA.adresse[extraireChoixUnique(blocRelation, Object.keys(VALEURS_RELATION_IA.adresse))] || "tu",
    ton: VALEURS_RELATION_IA.ton[extraireChoixUnique(blocRelation, Object.keys(VALEURS_RELATION_IA.ton))] || "direct",
    posture: VALEURS_RELATION_IA.posture[extraireChoixUnique(blocRelation, Object.keys(VALEURS_RELATION_IA.posture))] || "accompagnant",
    longueur: VALEURS_RELATION_IA.longueur[extraireChoixUnique(blocRelation, Object.keys(VALEURS_RELATION_IA.longueur))] || "détaillé",
    role: VALEURS_RELATION_IA.role[extraireChoixUnique(blocRelation, Object.keys(VALEURS_RELATION_IA.role))] || "lecteur expert",
  };

  if (!questionLibre) avertissements.push("Aucune « question centrale » détectée — obligatoire pour créer l'audit, à compléter manuellement.");
  if (!ouEnEtesVous) avertissements.push('Aucune réponse détectée à "Où en êtes-vous dans ce projet ?".');
  if (attentesCursus.length === 0 && !attentesCursusAutre) avertissements.push('Aucune réponse détectée à "Qu\'attendez-vous de cet audit ?".');
  if (!degreIntervention) avertissements.push('Aucune réponse détectée à "Que peut faire CursAudit ?".');

  return {
    data: {
      titre: titreLivre,
      ouEnEtesVous,
      natureProjet: { chemin: [], label: "" },
      natureProjetLibre,
      objectifs, destinataires,
      attentesCursus,
      criteresReussite,
      ceQueVousEspérezDécouvrir,
      objectifsAutre, destinatairesAutre, attentesCursusAutre, criteresReussiteAutre, ceQueVousEspérezDécouvrirAutre,
      questionLibre, preoccupations, preoccupationAutre,
      auteurEstUtilisateur, profilAuteurAudit,
      degreIntervention,
      contraintesAcademiques,
      relationIA,
    },
    error: null,
    avertissements,
  };
}
