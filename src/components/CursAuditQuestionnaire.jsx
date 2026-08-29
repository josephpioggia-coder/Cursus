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
 * FUSION AVEC LE CONTRAT D'INTENTION (réf. 60816-01, suite, 28/08/2026) —
 * signalé par l'auteur du projet : les questions "quel type de document"
 * et "ce texte est-il..." faisaient doublon avec "Nature du projet" et "Où
 * en êtes-vous" du bloc contrat d'intention. Fusionnées : la taxonomie du
 * contrat d'intention est désormais LA SEULE classification du document,
 * envoyée telle quelle comme `type_document` au moteur d'analyse (qui ne
 * fait qu'injecter cette chaîne dans son prompt, aucune comparaison stricte
 * côté serveur — vérifié).
 * "Ce texte est-il..." (statut_texte) a été vérifié comme jamais lu par
 * aucune Edge Function (grep sur tout supabase/functions) — supprimé sans
 * remplacement fonctionnel, sa valeur est désormais directement celle de
 * "Où en êtes-vous" (ouEnEtesVous), plus riche et déjà présente.
 * Mémoire/TFE académique (bloc "établissement autorise l'IA ?") →
 * n'existe dans AUCUNE branche de la taxonomie (un TFE peut être un essai,
 * un rapport, un témoignage...) : reste une case à cocher indépendante,
 * transversale à la nature du projet.
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
 * REFONTE EN "UNE QUESTION À LA FOIS", 29/08/2026 — demande explicite de
 * l'auteur du projet : présenter le questionnaire comme un sondage type
 * SurveyMonkey (une question par écran, curseur de progression, bouton
 * "Valider" qui fait apparaître la question suivante) plutôt qu'une longue
 * page à faire défiler, pour donner l'impression d'un parcours plus court.
 * AUCUN changement de logique de données : mêmes états, mêmes règles de
 * validation, même payload final — uniquement le RENDU qui change.
 * `ÉTAPES_CLÉS` (calculé à chaque rendu à partir de `estTravailAcademique`,
 * la seule chose qui fait varier le nombre d'étapes) fixe l'ordre ; chaque
 * clé a un titre (`TITRES_ÉTAPE`), un rendu (`renderContenuÉtape`) et,
 * pour celles qui ont une exigence réelle, une règle de validation
 * (`étapeEstValide`) — sinon "Valider" avance sans condition (cohérent
 * avec le principe "ne jamais bloquer l'auteur·ice" déjà appliqué à la
 * taxonomie). La dernière étape appelle `valider()` (logique de soumission
 * inchangée) au lieu de simplement avancer. Exporter/Importer le contrat
 * JSON déplacés : Importer sur la première étape (pour sauter tout le
 * parcours d'un coup), Exporter sur la dernière (pour sauvegarder ce qui
 * vient d'être rempli).
 *
 * CORRECTIF, MÊME JOUR — arrivé au bout du questionnaire, l'auteur du
 * projet n'a rien trouvé pour garder une trace de ce qu'il venait de
 * remplir ("j'aurais bien aimé pouvoir le sauvegarder... le sortir en
 * Word... qu'il existe quelque part"). Trois manques réels : (1) le
 * bouton d'export JSON existait mais était trop discret, noyé à côté des
 * 5 menus de la dernière question — déplacé dans un bloc dédié, bien
 * visible ; (2) aucun export lisible n'existait, seulement le JSON — voir
 * `exporterContratEnWord()`/exportContratIntentionWord.js, un document
 * Word généré côté navigateur (mêmes outils que les autres exports
 * CursAudit) ; (3) l'export/import JSON (`contratComplet()`, qui englobe
 * désormais `contratIntentionActuel()` + degré d'intervention +
 * contraintes académiques + style demandé à l'IA) omettait ces trois
 * derniers champs, jamais restaurés par `appliquerContrat()` — un contrat
 * réimporté restait donc incomplet sans qu'on s'en rende compte.
 *
 * RESTRUCTURATION EN "BLOC DE CADRAGE ÉDITORIAL" (réf. 60816-01, suite,
 * 29/08/2026, ANTÉRIEURE à la refonte en questions séparées ci-dessus,
 * conservée pour l'ordre logique des questions) — demande explicite de
 * l'auteur du projet : la première partie du questionnaire n'est pas une
 * formalité avant l'audit, c'est la boussole de l'audit. Ordre : (1)
 * Profil de l'auteur, (2) Pourquoi/pour qui écrivez-vous, (3) Qu'attendez-
 * vous de cet audit, (4) À quoi reconnaîtrez-vous que ce projet est
 * réussi, (5) Qu'espérez-vous découvrir que vous ignorez encore, (6) la
 * question précise posée à CursAudit.
 *
 * FLUX EN 3 ÉTAPES POUR LA QUESTION PRÉCISE, MÊME JOUR (demande explicite
 * de l'auteur du projet avec GPT) : (1) des cases à cocher de
 * préoccupations éditoriales concrètes (PREOCCUPATIONS_QUESTION_PRECISE, +
 * "Autre, à préciser"), (2) un appel à la nouvelle Edge Function
 * `synthetiser-question-cursaudit` (bouton "Proposer ma question
 * centrale") qui combine ces cases avec le profil auteur et le reste du
 * contrat d'intention en UNE question cohérente, (3) un champ "Question
 * centrale validée" — préremplit par la proposition, mais toujours
 * librement modifiable — qui reste `questionLibre`. SEULE étape de tout ce
 * questionnaire à appeler l'IA (voir la note "RUPTURE ASSUMÉE" dans
 * synthetiser-question-cursaudit/index.ts) : le reste (taxonomie, cases à
 * cocher) reste 100% statique, décision assumée le 28/08/2026 pour éviter
 * la fragilité observée ce jour-là (NetworkError, sorties mal formées,
 * latence).
 *
 * "AUTRE, À PRÉCISER" SUR LES 5 QUESTIONS À CASES (Pourquoi/pour qui
 * écrivez-vous, Qu'attendez-vous de l'audit, critère de réussite, ce que
 * vous espérez découvrir), même jour — jusque-là seule "Nature du projet"
 * l'avait. Voir `useAutre()`/`GroupeCasesAvecAutre` : chaque "Autre" a son
 * propre état séparé (jamais fusionné dans le tableau de cases coché, pour
 * rester fidèlement réimportable) — sauf celui de "Qu'attendez-vous de cet
 * audit ?", qui EST fusionné dans `finaliteAudit` au moment de valider()
 * (seul champ de ce groupe lu directement par les 3 fonctions d'analyse au
 * premier niveau ; les 4 autres "Autre" sont recombinés côté serveur dans
 * construireContexteQualification à partir de `contrat_intention`).
 *
 * NATURE DU PROJET REMPLACÉE INTÉGRALEMENT, 29/08/2026 — arbre complet
 * niveaux 1 à 4 fourni par l'auteur du projet (taxonomie_cursus_niveaux_1_a_4.xlsx,
 * élaboré avec ChatGPT), 9 familles, 415 chemins. Voir
 * taxonomieContratIntentionCursAudit.js pour la structure de données et
 * son docblock (statuts, principe "ne jamais bloquer l'auteur·ice",
 * réponse à "est-ce Copilot qui crée les niveaux suivants dynamiquement ?"
 * — non, l'arbre est fixe, "Autre" arrête juste la descente).
 * `SélecteurNature` navigue l'arbre à N niveaux génériquement
 * (`optionsSuivantes()`/`noeudAtteint()`), avec "Autre" + champ texte à
 * CHAQUE niveau. Le blocage de "Poésie" à la validation a été retiré (la
 * nouvelle taxonomie classe la plupart des formes poétiques "prêt", et son
 * principe explicite est de ne jamais bloquer) ; le message "format non
 * linéaire" a été réintégré via le champ `aide` des feuilles concernées
 * (Fiction interactive, Oracle / jeu de cartes, Posts réseaux sociaux).
 *
 * Repère (question → fonction dans l'audit → type de réponse), pour
 * mémoire plutôt que pour l'UI :
 *   Profil de l'auteur          → crédibilité/contexte de l'auteur·ice   → texte libre + champs
 *   Pourquoi/pour qui écrivez   → intention + lecteur visé              → cases à cocher + "Autre"
 *   Qu'attendez-vous de l'audit → attentes vis-à-vis de CursAudit       → cases à cocher + "Autre"
 *   Critère de réussite         → ce que "réussi" veut dire pour vous   → cases à cocher + "Autre"
 *   Ce que vous espérez découvrir → angle d'analyse à explorer          → cases à cocher + "Autre"
 *   Question précise à CursAudit → question centrale posée à l'audit   → cases + synthèse IA + validation
 *
 * PAS ENCORE FAIT (chantier distinct, plus large) — demande explicite de
 * l'auteur du projet : faire remonter un encadré "Cadre de lecture retenu
 * par CursAudit" DANS la sortie de l'audit lui-même (pré-audit et/ou
 * rapport consolidé, y compris leurs exports Word), pas seulement dans un
 * encadré de la page de détail (déjà fait, voir CadreLecture dans
 * CursAuditDetail.jsx). Portée nettement plus large qu'un réagencement de
 * formulaire, à traiter comme un chantier à part.
 *
 * CE QUE LES RÉPONSES CHANGENT RÉELLEMENT côté moteur d'analyse
 * (analyser-unite-cursaudit / orchestrer-audit-cursaudit) : la question
 * libre et le degré d'intervention sont injectés dans le prompt système
 * envoyé à l'IA pour CHAQUE unité. Mais le moteur ne produit aujourd'hui
 * qu'un diagnostic (valeur + commentaire) par critère, jamais un texte
 * réécrit séparé — les degrés "reformulation ponctuelle" et "réécriture"
 * influencent donc le CONTENU du commentaire (l'IA peut y glisser une
 * suggestion), pas une sortie dédiée. Écrire réellement à la place de
 * l'auteur⋅ice n'est pas implémenté.
 */

import { useState, useEffect, useMemo } from "react";
import { auditsAPI, profilAuteurAPI } from "../lib/api.js";
import { supabase } from "../lib/supabase.js";
import { nomDeFichierSûr } from "../lib/exportWord.js";
import { exporterContratIntentionWord } from "../lib/exportContratIntentionWord.js";
import ProfilAuteur from "./ProfilAuteur.jsx";
import {
  OU_EN_ETES_VOUS, OBJECTIFS, DESTINATAIRES,
  CRITERES_REUSSITE, CE_QUE_VOUS_ESPEREZ_DECOUVRIR,
  optionsSuivantes, noeudAtteint, STATUTS_AIDE_GENERIQUE,
} from "../lib/taxonomieContratIntentionCursAudit.js";

// Brouillon du QUESTIONNAIRE lui-même — réf. 60816-01, suite, 29/08/2026,
// bug réel signalé par l'auteur du projet : le brouillon de CursAudit.jsx
// (CLÉ_BROUILLON là-bas) ne sauvegarde que le résultat FINAL du
// questionnaire (l'objet renvoyé à onValider une fois toutes les questions
// passées) — jamais les réponses en cours de saisie pendant qu'on avance
// dans le parcours "une question à la fois". Revenir sur cet écran (retour
// arrière, rechargement, fermeture d'onglet) avant d'avoir fini reperdait
// tout, sans aucun message d'erreur. Corrigé en donnant à ce composant son
// propre brouillon, autonome, sur le même principe que celui de
// CursAudit.jsx (sauvegarde continue à chaque changement, lu une seule
// fois à l'initialisation). Exportée pour que CursAudit.jsx l'efface en
// même temps que son propre brouillon (audit créé, ou "repartir de zéro")
// — sinon un brouillon de questionnaire obsolète prérempleirait le
// parcours d'un audit sans rapport.
export const CLÉ_BROUILLON_QUESTIONNAIRE = "cursaudit_questionnaire_brouillon";
function lireBrouillonQuestionnaire() {
  try {
    const brut = localStorage.getItem(CLÉ_BROUILLON_QUESTIONNAIRE);
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}

// Fusionne l'ancienne FINALITES avec ATTENTES_CURSUS du contrat d'intention
// (réf. 60816-01, suite, 28/08/2026) — signalé par l'auteur du projet :
// "structurer mes idées"/"Améliorer la structure", "rendre mon texte plus
// fluide"/"Fluidifier sans réécrire à la place", "trouver mes
// incohérences"/"Vérifier la cohérence générale", "préparer la
// publication"/"Préparer une nouvelle version" faisaient doublon.
// Dédupliqué en gardant une seule formulation par idée ; les items sans
// équivalent des deux côtés sont tous conservés (vérifications techniques
// d'audit d'un côté, objectifs plus larges/existentiels de l'autre — pas
// redondants entre eux). Alimente à la fois `finaliteAudit` (obligatoire,
// injecté dans le prompt du moteur d'analyse) et
// `contratIntention.attentesCursus` (mêmes valeurs, un seul état — voir
// `finalites` plus bas).
const FINALITES = [
  "Structurer mes idées",
  "Mieux écrire",
  "Améliorer le style",
  "Fluidifier le texte sans réécrire à ma place",
  "Vérifier la cohérence générale",
  "Vérifier mes arguments",
  "Repérer les répétitions",
  "Repérer les passages faibles",
  "Vérifier le niveau de preuve",
  "Vérifier les sources",
  "Préserver ma voix d'auteur",
  "Identifier les risques éthiques, académiques ou éditoriaux",
  "Approfondir ma réflexion",
  "Comprendre ce que j'écris",
  "Comprendre ce que je vis",
  "Mieux toucher mon lecteur",
  "Préparer la publication",
  "Tout analyser",
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

// Préoccupations éditoriales pour "Quelle est la question précise que vous
// voulez poser à CursAudit ?" (réf. 60816-01, suite, 29/08/2026, demande
// explicite de l'auteur du projet, avec GPT). Sert de SIGNAL à cocher, pas
// de question finale : combinées par synthetiser-question-cursaudit (voir
// ce fichier) en une seule question centrale que l'auteur·ice valide ou
// modifie ensuite — voir "Question centrale validée" plus bas.
const PREOCCUPATIONS_QUESTION_PRECISE = [
  "Mon texte tient-il sa promesse ?",
  "Le lecteur comprend-il ce que je veux transmettre ?",
  "Le genre réel de mon texte correspond-il au genre que j'annonce ?",
  "Le texte est-il cohérent dans sa structure et sa progression ?",
  "Le ton est-il adapté au public visé ?",
  "Les passages personnels sont-ils suffisamment clairs, incarnés et utiles au projet ?",
  "Le texte est-il trop intime, trop explicatif ou trop démonstratif ?",
  "Y a-t-il des passages qui fragilisent la confiance du lecteur ?",
  "Le texte comporte-t-il des affirmations à sourcer, nuancer ou vérifier ?",
  "Qu'est-ce que je devrais couper, déplacer ou développer en priorité ?",
  "Quelle est la meilleure forme éditoriale pour ce projet ?",
  "Ce texte est-il prêt à être montré à un lecteur, un éditeur ou un professionnel ?",
];

const SYNTHESE_QUESTION_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/synthetiser-question-cursaudit";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

// Groupe de cases à cocher réutilisable — Bloc A/B du contrat d'intention
// (réf. 60816-01, suite, 28/08/2026), 6 listes différentes, même motif.
function GroupeCases({ options, valeurs, onBasculer }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
      {options.map((o) => (
        <Checkbox key={o} checked={valeurs.includes(o)} onChange={() => onBasculer(o)} label={o} />
      ))}
    </div>
  );
}

// Case "Autre, à préciser" pour un état booléen + texte — réf. 60816-01,
// suite, 29/08/2026, demande explicite de l'auteur du projet : chaque
// question à cases (objectifs, destinataires, finalités, critères de
// réussite, ce que vous espérez découvrir) doit pouvoir ouvrir une réponse
// personnelle, pas seulement les listes prédéfinies. Petit hook pour éviter
// de répéter la même paire d'états 5 fois.
function useAutre(initial) {
  const [actif, setActif] = useState(() => initial?.actif ?? false);
  const [texte, setTexte] = useState(() => initial?.texte ?? "");
  return { actif, setActif, texte, setTexte };
}

function GroupeCasesAvecAutre({ options, valeurs, onBasculer, autre }) {
  return (
    <>
      <GroupeCases options={options} valeurs={valeurs} onBasculer={onBasculer} />
      <div style={{ marginTop: 2 }}>
        <Checkbox checked={autre.actif} onChange={() => autre.setActif((v) => !v)} label="Autre, à préciser" />
        {autre.actif && (
          <input
            style={{ ...champStyle, marginTop: 6 }}
            value={autre.texte}
            onChange={(e) => autre.setTexte(e.target.value)}
            placeholder="Précisez"
          />
        )}
      </div>
    </>
  );
}

// Navigation générique à N niveaux dans l'arbre NATURE_PROJET (réf.
// 60816-01, suite, 29/08/2026) — remplace tout l'ancien mécanisme
// famille/sousCategorie/sousGenre, qui ne montait qu'à 3 niveaux fixes et
// avait un vrai bug : "Autre" au niveau 2 n'ouvrait aucun champ de
// précision. Ici, un seul bloc de rendu par niveau, appliqué en boucle :
// structurellement impossible d'oublier le champ "Autre" à un niveau
// donné. `chemin` est un tableau de `{ nom, autre }`, un élément par
// niveau déjà choisi (niveau 1 en premier) ; `nom === "Autre"` arrête
// toujours la descente (voir taxonomieContratIntentionCursAudit.js).
function labelChemin(chemin) {
  return chemin
    .map((étape) => (étape.nom === "Autre" ? (étape.autre.trim() || "Autre") : étape.nom))
    .join(" > ");
}

function SélecteurNature({ chemin, onChemin }) {
  const étapes = [];
  for (let i = 0; ; i++) {
    const options = optionsSuivantes(chemin.slice(0, i));
    if (!options) break;
    étapes.push({ niveau: i, options });
    if (!chemin[i]) break; // Niveau pas encore choisi : dernier menu à afficher pour l'instant.
  }
  const noeudFinal = noeudAtteint(chemin);
  const statutFinal = noeudFinal?.statut;

  return (
    <div>
      {étapes.map(({ niveau, options }) => (
        <div key={niveau} style={{ marginTop: niveau > 0 ? 8 : 0 }}>
          <select
            style={champStyle}
            value={chemin[niveau]?.nom ?? ""}
            onChange={(e) => {
              const nom = e.target.value;
              const nouveauChemin = chemin.slice(0, niveau);
              if (nom) nouveauChemin.push({ nom, autre: "" });
              onChemin(nouveauChemin);
            }}
          >
            <option value="">{niveau === 0 ? "— Choisir —" : "— Préciser (facultatif) —"}</option>
            {options.map((o) => <option key={o.code} value={o.nom}>{o.nom}</option>)}
            <option value="Autre">Autre</option>
          </select>
          {chemin[niveau]?.nom === "Autre" && (
            <input
              style={{ ...champStyle, marginTop: 6 }}
              value={chemin[niveau].autre}
              onChange={(e) => {
                const nouveauChemin = [...chemin];
                nouveauChemin[niveau] = { nom: "Autre", autre: e.target.value };
                onChemin(nouveauChemin);
              }}
              placeholder="Précisez"
            />
          )}
        </div>
      ))}
      {statutFinal && statutFinal !== "prêt" && (
        <div style={{ background: "#FFF7E6", border: "0.5px solid #C4973A50", borderRadius: 8, padding: "10px 14px", marginTop: 10 }}>
          <div style={{ fontSize: 11.5, color: "#8A6116", lineHeight: 1.6 }}>
            {noeudFinal.aide || STATUTS_AIDE_GENERIQUE[statutFinal] || "Cursus peut accompagner ce type de projet avec un cadrage adapté."}
          </div>
        </div>
      )}
    </div>
  );
}

// Titres affichés en tête de chaque écran du parcours "une question à la
// fois" — réf. 60816-01, suite, 29/08/2026 (voir docblock en tête de
// fichier). "academique_conditions" n'apparaît que si estTravailAcademique
// (voir calculerÉtapesClés plus bas).
const TITRES_ÉTAPE = {
  intro: "Avant de commencer",
  ou_en_etes_vous: "Où en êtes-vous dans ce projet ?",
  nature_projet: "Quelle est la nature de votre projet ?",
  pourquoi: "Pourquoi écrivez-vous ?",
  pour_qui: "Pour qui écrivez-vous ?",
  attentes_audit: "Qu'attendez-vous de cet audit ?",
  critere_reussite: "À quoi reconnaîtrez-vous que ce projet est réussi ?",
  espoir_decouverte: "Qu'espérez-vous découvrir que vous ignorez encore ?",
  question_precise: "Quelle est la question précise que vous voulez poser à CursAudit ?",
  degre_intervention: "Que peut faire CursAudit ?",
  academique_choix: "Ce texte est-il un travail académique ?",
  academique_conditions: "Votre établissement autorise-t-il l'usage de l'IA ?",
  relation_ia: "Comment voulez-vous que l'IA vous parle ?",
};

// Ordre du parcours — réf. 60816-01, suite, 29/08/2026. "academique_conditions"
// n'est inséré que si l'étape précédente (academique_choix) a été cochée ;
// calculé à chaque rendu, jamais figé, pour rester toujours cohérent avec
// la réponse déjà donnée.
function calculerÉtapesClés(estTravailAcademique) {
  const étapes = [
    "intro", "ou_en_etes_vous", "nature_projet", "pourquoi", "pour_qui",
    "attentes_audit", "critere_reussite", "espoir_decouverte", "question_precise",
    "degre_intervention", "academique_choix",
  ];
  if (estTravailAcademique) étapes.push("academique_conditions");
  étapes.push("relation_ia");
  return étapes;
}

export default function CursAuditQuestionnaire({ onValider }) {
  // Brouillon du questionnaire lui-même (voir CLÉ_BROUILLON_QUESTIONNAIRE
  // en tête de fichier) — lu UNE SEULE FOIS à l'initialisation, jamais
  // recalculé ensuite (useMemo avec dépendances vides), pour ne pas
  // écraser la saisie en cours si le composant se re-rendait pour une
  // autre raison.
  const brouillonInitial = useMemo(() => lireBrouillonQuestionnaire(), []);

  // Contrat d'intention — réf. 60816-01, suite, 28/08/2026. Voir
  // docs/PAQUET-DE-REPRISE-2026-08-27.md, [CHANTIER-CONTRAT-INTENTION].
  const [ouEnEtesVous, setOuEnEtesVous] = useState(() => brouillonInitial?.ouEnEtesVous ?? "");
  // Nature du projet — réf. 60816-01, suite, 29/08/2026, arbre complet
  // niveaux 1 à 4 (voir SélecteurNature ci-dessus et le docblock en tête de
  // fichier). `cheminNature` : tableau de { nom, autre }, un élément par
  // niveau choisi.
  const [cheminNature, setCheminNature] = useState(() => brouillonInitial?.cheminNature ?? []);
  const [objectifs, setObjectifs] = useState(() => brouillonInitial?.objectifs ?? []);
  const [destinataires, setDestinataires] = useState(() => brouillonInitial?.destinataires ?? []);
  const [criteresReussite, setCriteresReussite] = useState(() => brouillonInitial?.criteresReussite ?? []);
  const [ceQueVousEspérezDécouvrir, setCeQueVousEspérezDécouvrir] = useState(() => brouillonInitial?.ceQueVousEspérezDécouvrir ?? []);
  // "Autre, à préciser" pour chacune des 5 questions à cases — réf.
  // 60816-01, suite, 29/08/2026, demande explicite de l'auteur du projet.
  const objectifsAutre = useAutre(brouillonInitial?.objectifsAutre);
  const destinatairesAutre = useAutre(brouillonInitial?.destinatairesAutre);
  const finalitesAutre = useAutre(brouillonInitial?.finalitesAutre);
  const criteresReussiteAutre = useAutre(brouillonInitial?.criteresReussiteAutre);
  const espérezDécouvrirAutre = useAutre(brouillonInitial?.espérezDécouvrirAutre);
  const [contratsPrécédents, setContratsPrécédents] = useState(null);
  const [contratChoisi, setContratChoisi] = useState("");

  // Parcours "une question à la fois" — réf. 60816-01, suite, 29/08/2026
  // (voir docblock en tête de fichier).
  const [étapeIndex, setÉtapeIndex] = useState(() => brouillonInitial?.étapeIndex ?? 0);

  useEffect(() => {
    auditsAPI.listerContratsIntention().then(({ data }) => setContratsPrécédents(data || []));
  }, []);

  // Profil auteur — réf. 60816-01, suite, 29/08/2026. ProfilAuteur.jsx a son
  // propre état interne pour son propre affichage ; ce composant-ci a
  // besoin d'une copie en lecture seule pour l'envoyer, avec le contrat
  // d'intention, à synthetiser-question-cursaudit (voir proposerQuestionCentrale).
  const [profil, setProfil] = useState(null);
  useEffect(() => {
    profilAuteurAPI.récupérer().then(({ data }) => setProfil(data || null));
  }, []);

  const appliquerContrat = (c) => {
    if (!c) return;
    setOuEnEtesVous(c.ouEnEtesVous || "");
    setCheminNature(Array.isArray(c.natureProjet?.chemin) ? c.natureProjet.chemin : []);
    setObjectifs(c.objectifs || []);
    setDestinataires(c.destinataires || []);
    // attentesCursus fusionné dans finalites le 28/08/2026 — un contrat
    // exporté avant cette date peut encore avoir attentesCursus séparé,
    // on le récupère quand même plutôt que de perdre l'info.
    if (c.attentesCursus?.length > 0) setFinalites((f) => [...new Set([...f, ...c.attentesCursus])]);
    setCriteresReussite(c.criteresReussite || []);
    setCeQueVousEspérezDécouvrir(c.ceQueVousEspérezDécouvrir || []);
    // "Autre, à préciser" des 5 questions à cases — réf. 60816-01, suite,
    // 29/08/2026.
    objectifsAutre.setTexte(c.objectifsAutre || ""); objectifsAutre.setActif(!!c.objectifsAutre);
    destinatairesAutre.setTexte(c.destinatairesAutre || ""); destinatairesAutre.setActif(!!c.destinatairesAutre);
    finalitesAutre.setTexte(c.attentesCursusAutre || ""); finalitesAutre.setActif(!!c.attentesCursusAutre);
    criteresReussiteAutre.setTexte(c.criteresReussiteAutre || ""); criteresReussiteAutre.setActif(!!c.criteresReussiteAutre);
    espérezDécouvrirAutre.setTexte(c.ceQueVousEspérezDécouvrirAutre || ""); espérezDécouvrirAutre.setActif(!!c.ceQueVousEspérezDécouvrirAutre);
    // Réf. 60816-01, suite, 29/08/2026 — signalé par l'auteur du projet :
    // exporter un contrat sans la question précise fait perdre l'information
    // la plus centrale ("boussole de l'audit") en cas de réimport. Ajoutée
    // au contrat lui-même plutôt que de rester un champ isolé, à part.
    setQuestionLibre(c.questionLibre || "");
    setPreoccupations(c.preoccupations || []);
    setPreoccupationAutre(c.preoccupationAutre || "");
    setPreoccupationAutreActive(!!c.preoccupationAutre);
    // Réf. 60816-01, suite, 29/08/2026 — signalé par l'auteur du projet :
    // le degré d'intervention, les contraintes académiques et le style
    // demandé à l'IA n'étaient pas restaurés à l'import, alors qu'ils font
    // partie intégrante du questionnaire — un contrat réimporté restait
    // incomplet sans qu'on s'en rende compte.
    if (c.degreIntervention) setDegreIntervention(c.degreIntervention);
    if (c.contraintesAcademiques) {
      setEstTravailAcademique(true);
      setAutorisationIA(c.contraintesAcademiques.autorisationIA || "");
      setConditionsIA(c.contraintesAcademiques.conditions || []);
    }
    if (c.relationIA) {
      setAdresse(c.relationIA.adresse || "tu");
      setTon(c.relationIA.ton || "direct");
      setPosture(c.relationIA.posture || "accompagnant");
      setLongueur(c.relationIA.longueur || "détaillé");
      setRole(c.relationIA.role || "lecteur expert");
    }
  };

  const choisirContratPrécédent = (id) => {
    setContratChoisi(id);
    const trouvé = contratsPrécédents?.find((a) => a.id === id);
    if (trouvé) appliquerContrat(trouvé.contrat_intention);
  };

  const contratIntentionActuel = () => ({
    ouEnEtesVous,
    // Chemin complet (niveaux 1 à 4) + libellé prêt à l'emploi — réf.
    // 60816-01, suite, 29/08/2026. `label` évite à tout code serveur
    // (synthetiser-question-cursaudit) de devoir connaître la forme de
    // l'arbre pour reconstruire une description lisible.
    natureProjet: { chemin: cheminNature, label: labelChemin(cheminNature) },
    objectifs, destinataires,
    // Fusionné avec "Que veux-tu obtenir ?" le 28/08/2026 (doublon signalé
    // par l'auteur du projet) — mêmes valeurs que `finalites`, pas un
    // second état séparé.
    attentesCursus: finalites,
    criteresReussite,
    ceQueVousEspérezDécouvrir,
    // "Autre, à préciser" des 5 questions à cases — réf. 60816-01, suite,
    // 29/08/2026, demande explicite de l'auteur du projet. Champs séparés
    // (pas fusionnés dans les tableaux ci-dessus) pour rester fidèlement
    // réimportables sans risque de doublon sur un second export — voir
    // construireContexteQualification côté serveur pour où ils sont
    // effectivement recombinés dans le prompt.
    objectifsAutre: objectifsAutre.actif ? objectifsAutre.texte.trim() : "",
    destinatairesAutre: destinatairesAutre.actif ? destinatairesAutre.texte.trim() : "",
    attentesCursusAutre: finalitesAutre.actif ? finalitesAutre.texte.trim() : "",
    criteresReussiteAutre: criteresReussiteAutre.actif ? criteresReussiteAutre.texte.trim() : "",
    ceQueVousEspérezDécouvrirAutre: espérezDécouvrirAutre.actif ? espérezDécouvrirAutre.texte.trim() : "",
    // Ajouté le 29/08/2026 (voir appliquerContrat) — sans ce champ, exporter
    // puis réimporter un contrat perdait la question précise posée à
    // CursAudit, pourtant la pièce la plus centrale du cadrage.
    questionLibre: questionLibre.trim(),
    preoccupations,
    preoccupationAutre: preoccupationAutreActive ? preoccupationAutre.trim() : "",
  });

  // Réf. 60816-01, suite, 29/08/2026 — signalé par l'auteur du projet :
  // arrivé au bout du questionnaire, il n'y avait aucune trace lisible
  // possible de ce qu'il venait de remplir, et l'export JSON existant
  // (contratIntentionActuel()) omettait le degré d'intervention, les
  // contraintes académiques et le style demandé à l'IA — pas un
  // enregistrement complet du questionnaire. `contratComplet()` réunit
  // tout ce qui a été rempli, réutilisé à la fois par l'export JSON
  // (réimportable) et l'export Word (lisible).
  const contratComplet = () => ({
    ...contratIntentionActuel(),
    degreIntervention,
    contraintesAcademiques: estTravailAcademique ? { autorisationIA, conditions: conditionsIA } : null,
    relationIA: { adresse, ton, posture, longueur, role },
  });

  const exporterContratJSON = () => {
    const blob = new Blob([JSON.stringify(contratComplet(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `contrat_intention_${nomDeFichierSûr(labelChemin(cheminNature) || "brouillon")}.json`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  };

  const exporterContratEnWord = () => {
    exporterContratIntentionWord(contratComplet(), labelChemin(cheminNature));
  };

  const importerContratJSON = (fichier) => {
    if (!fichier) return;
    const lecteur = new FileReader();
    lecteur.onload = () => {
      try {
        appliquerContrat(JSON.parse(lecteur.result));
      } catch {
        setErreur("Fichier JSON invalide — impossible de lire ce contrat d'intention.");
      }
    };
    lecteur.readAsText(fichier);
  };

  const [finalites, setFinalites] = useState(() => brouillonInitial?.finalites ?? []);
  const [questionLibre, setQuestionLibre] = useState(() => brouillonInitial?.questionLibre ?? "");
  // Question précise — flux en 3 étapes réf. 60816-01, suite, 29/08/2026
  // (demande explicite de l'auteur du projet, avec GPT) : (1) cases à
  // cocher de préoccupations éditoriales, (2) synthetiser-question-cursaudit
  // propose une question centrale à partir de ces cases + profil + contrat
  // d'intention, (3) l'auteur·ice valide ou modifie cette proposition dans
  // "Question centrale validée" (toujours `questionLibre` ci-dessus — pas
  // un second état, la proposition ne fait que le préremplir).
  const [preoccupations, setPreoccupations] = useState(() => brouillonInitial?.preoccupations ?? []);
  const [preoccupationAutreActive, setPreoccupationAutreActive] = useState(() => brouillonInitial?.preoccupationAutreActive ?? false);
  const [preoccupationAutre, setPreoccupationAutre] = useState(() => brouillonInitial?.preoccupationAutre ?? "");
  const [syntheseQuestionEnCours, setSyntheseQuestionEnCours] = useState(false);
  const [erreurSyntheseQuestion, setErreurSyntheseQuestion] = useState(null);
  const [degreIntervention, setDegreIntervention] = useState(() => brouillonInitial?.degreIntervention ?? "");
  // Travail académique — réf. 60816-01, suite, 28/08/2026. Devenu une case
  // à cocher indépendante lors de la fusion avec le contrat d'intention :
  // un mémoire/TFE peut relever de n'importe quelle famille de la
  // taxonomie (essai, témoignage, rapport...), ce n'est pas une nature de
  // projet en soi mais une contrainte transversale.
  const [estTravailAcademique, setEstTravailAcademique] = useState(() => brouillonInitial?.estTravailAcademique ?? false);
  const [autorisationIA, setAutorisationIA] = useState(() => brouillonInitial?.autorisationIA ?? "");
  const [conditionsIA, setConditionsIA] = useState(() => brouillonInitial?.conditionsIA ?? []);
  const [adresse, setAdresse] = useState(() => brouillonInitial?.adresse ?? "tu");
  const [ton, setTon] = useState(() => brouillonInitial?.ton ?? "direct");
  const [posture, setPosture] = useState(() => brouillonInitial?.posture ?? "accompagnant");
  const [longueur, setLongueur] = useState(() => brouillonInitial?.longueur ?? "détaillé");
  const [role, setRole] = useState(() => brouillonInitial?.role ?? "lecteur expert");
  const [erreur, setErreur] = useState(null);

  // Sauvegarde continue du brouillon du questionnaire (voir
  // CLÉ_BROUILLON_QUESTIONNAIRE en tête de fichier) — corrige le bug réel
  // signalé par l'auteur du projet : sans ceci, revenir sur cet écran avant
  // d'avoir terminé (retour arrière, rechargement) reperdait tout ce qui
  // avait déjà été rempli, sans aucun avertissement.
  useEffect(() => {
    const brouillon = {
      étapeIndex, ouEnEtesVous, cheminNature, objectifs, destinataires, criteresReussite, ceQueVousEspérezDécouvrir,
      objectifsAutre: { actif: objectifsAutre.actif, texte: objectifsAutre.texte },
      destinatairesAutre: { actif: destinatairesAutre.actif, texte: destinatairesAutre.texte },
      finalitesAutre: { actif: finalitesAutre.actif, texte: finalitesAutre.texte },
      criteresReussiteAutre: { actif: criteresReussiteAutre.actif, texte: criteresReussiteAutre.texte },
      espérezDécouvrirAutre: { actif: espérezDécouvrirAutre.actif, texte: espérezDécouvrirAutre.texte },
      finalites, questionLibre, preoccupations, preoccupationAutreActive, preoccupationAutre,
      degreIntervention, estTravailAcademique, autorisationIA, conditionsIA,
      adresse, ton, posture, longueur, role,
    };
    try {
      localStorage.setItem(CLÉ_BROUILLON_QUESTIONNAIRE, JSON.stringify(brouillon));
    } catch {
      // localStorage indisponible (navigation privée, quota...) — le
      // brouillon ne survivra pas à un rechargement, mais ça ne doit pas
      // faire planter le questionnaire pour autant.
    }
  }, [
    étapeIndex, ouEnEtesVous, cheminNature, objectifs, destinataires, criteresReussite, ceQueVousEspérezDécouvrir,
    objectifsAutre.actif, objectifsAutre.texte, destinatairesAutre.actif, destinatairesAutre.texte,
    finalitesAutre.actif, finalitesAutre.texte, criteresReussiteAutre.actif, criteresReussiteAutre.texte,
    espérezDécouvrirAutre.actif, espérezDécouvrirAutre.texte,
    finalites, questionLibre, preoccupations, preoccupationAutreActive, preoccupationAutre,
    degreIntervention, estTravailAcademique, autorisationIA, conditionsIA,
    adresse, ton, posture, longueur, role,
  ]);

  // Nature du projet requise dès le niveau 1 — les niveaux suivants
  // affinent mais ne bloquent jamais (réf. 60816-01, suite, 29/08/2026,
  // principe explicite de la source : "ne pas bloquer l'auteur").
  const natureRenseignée = cheminNature.length > 0 &&
    (cheminNature[cheminNature.length - 1].nom !== "Autre" || cheminNature[cheminNature.length - 1].autre.trim());

  const basculerFinalité = (f) => setFinalites((liste) => liste.includes(f) ? liste.filter((x) => x !== f) : [...liste, f]);
  const basculerCondition = (c) => setConditionsIA((liste) => liste.includes(c) ? liste.filter((x) => x !== c) : [...liste, c]);
  // Bloc du contrat d'intention : un seul générateur de bascule pour les 5
  // listes à cases multiples, plutôt que 5 fonctions identiques.
  const basculeur = (setListe) => (valeur) => setListe((l) => l.includes(valeur) ? l.filter((x) => x !== valeur) : [...l, valeur]);
  const basculerPreoccupation = basculeur(setPreoccupations);

  // Étape 2 du flux "question précise" (réf. 60816-01, suite, 29/08/2026) —
  // seul appel IA de tout ce questionnaire, par ailleurs 100% statique (voir
  // docblock en tête de fichier et synthetiser-question-cursaudit/index.ts).
  const proposerQuestionCentrale = async () => {
    if (preoccupations.length === 0 && !(preoccupationAutreActive && preoccupationAutre.trim())) {
      setErreurSyntheseQuestion("Cochez au moins une préoccupation, ou précisez \"Autre\", avant de demander une proposition.");
      return;
    }
    setSyntheseQuestionEnCours(true);
    setErreurSyntheseQuestion(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Session absente — recharge la page et reconnecte-toi.");
      const réponse = await fetch(SYNTHESE_QUESTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "apikey": SUPABASE_ANON_KEY },
        body: JSON.stringify({
          profil: profil ? {
            profession: profil.profession, identiteGenre: profil.identite_genre, trancheAge: profil.tranche_age,
            niveauEtudes: profil.niveau_etudes, matieresEtudiees: profil.matieres_etudiees,
          } : null,
          contratIntention: contratIntentionActuel(),
          preoccupations,
          preoccupationAutre: preoccupationAutreActive ? preoccupationAutre.trim() : "",
        }),
      });
      const données = await réponse.json();
      if (!réponse.ok) throw new Error(données?.message || données?.error || `HTTP ${réponse.status}`);
      setQuestionLibre(données.question_proposee || "");
    } catch (e) {
      setErreurSyntheseQuestion(e.message);
    } finally {
      setSyntheseQuestionEnCours(false);
    }
  };

  const valider = () => {
    // "Autre" de "Qu'attendez-vous de cet audit ?" fusionné ici (réf.
    // 60816-01, suite, 29/08/2026) : contrairement aux 4 autres questions à
    // cases, celle-ci alimente aussi `finaliteAudit`, un champ obligatoire
    // au premier niveau, lu directement par les 3 fonctions d'analyse
    // (`audit.finalite_audit`) — `contratIntention.attentesCursus` n'est
    // qu'une copie archivée, jamais relue par le moteur. Sans cette fusion,
    // préciser "Autre" ici n'aurait eu aucun effet réel sur l'analyse.
    const finalitesAvecAutre = finalitesAutre.actif && finalitesAutre.texte.trim()
      ? [...finalites, finalitesAutre.texte.trim()]
      : finalites;
    if (!natureRenseignée || !ouEnEtesVous || finalitesAvecAutre.length === 0 || !questionLibre.trim() || !degreIntervention) {
      setErreur("Merci de compléter la nature du projet, où vous en êtes, ce que vous voulez obtenir et la question libre avant de continuer.");
      return;
    }
    const typeDocument = labelChemin(cheminNature);
    onValider({
      typeDocument,
      statutTexte: ouEnEtesVous,
      finaliteAudit: finalitesAvecAutre,
      questionLibre: questionLibre.trim(),
      degreIntervention,
      contraintesAcademiques: estTravailAcademique ? { autorisationIA, conditions: conditionsIA } : null,
      relationIA: { adresse, ton, posture, longueur, role },
      contratIntention: contratIntentionActuel(),
    });
  };

  // ─── Parcours "une question à la fois" (réf. 60816-01, suite, 29/08/2026,
  // voir docblock en tête de fichier) — la validation par étape ne change
  // aucune règle : elle applique juste, une à une, les mêmes conditions déjà
  // vérifiées globalement dans valider() ci-dessus.
  const étapesClés = calculerÉtapesClés(estTravailAcademique);
  const étapeActuelle = étapesClés[étapeIndex];

  const étapeEstValide = (clé) => {
    switch (clé) {
      case "ou_en_etes_vous": return !!ouEnEtesVous;
      case "nature_projet": return natureRenseignée;
      case "attentes_audit": return finalites.length > 0 || (finalitesAutre.actif && finalitesAutre.texte.trim());
      case "question_precise": return !!questionLibre.trim();
      case "degre_intervention": return !!degreIntervention;
      default: return true;
    }
  };

  const MESSAGES_ERREUR_ÉTAPE = {
    ou_en_etes_vous: "Merci d'indiquer où vous en êtes dans ce projet.",
    nature_projet: "Merci de préciser au moins le premier niveau de la nature de votre projet.",
    attentes_audit: "Merci de cocher au moins une réponse, ou de préciser \"Autre\".",
    question_precise: "Merci de renseigner votre question centrale avant de continuer.",
    degre_intervention: "Merci de choisir ce que CursAudit peut faire.",
  };

  const étapeSuivante = () => {
    if (!étapeEstValide(étapeActuelle)) {
      setErreur(MESSAGES_ERREUR_ÉTAPE[étapeActuelle] || "Merci de compléter cette réponse avant de continuer.");
      return;
    }
    setErreur(null);
    if (étapeIndex === étapesClés.length - 1) {
      valider();
    } else {
      setÉtapeIndex((i) => i + 1);
    }
  };

  const étapePrécédente = () => {
    setErreur(null);
    setÉtapeIndex((i) => Math.max(0, i - 1));
  };

  const renderContenuÉtape = (clé) => {
    switch (clé) {
      case "intro":
        return (
          <>
            <p style={{ fontSize: 12.5, color: "var(--texte-tertiaire)", lineHeight: 1.6, margin: 0 }}>
              Sans ce cadrage, l'IA analyse un texte sans savoir ce qu'il est censé être, pour qui il est
              écrit, ni jusqu'où elle a le droit d'intervenir.
            </p>
            {/* Note de continuité profil/projet — réf. 60816-01, suite,
                29/08/2026, demande explicite de l'auteur du projet :
                présentée comme une continuité d'accompagnement, jamais
                comme une obligation. */}
            <div style={{ background: "var(--fond, #F7F4EF)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "12px 16px" }}>
              <p style={{ fontSize: 12, color: "var(--texte-secondaire)", lineHeight: 1.7, margin: 0 }}>
                Ces informations servent de cadre de travail.
                <br /><br />
                Votre profil auteur pourra être réutilisé dans vos futurs projets Cursus.
                <br /><br />
                Les informations propres à ce projet resteront associées à ce texte et pourront être
                reprises plus tard dans CursEdit pour accompagner l'écriture, la réécriture ou la
                structuration du manuscrit.
                <br /><br />
                Vous pourrez les modifier à tout moment.
              </p>
            </div>
            <ProfilAuteur />
            {contratsPrécédents && contratsPrécédents.length > 0 && (
              <div>
                <label style={labelStyle}>Réutiliser les réponses d'un audit précédent</label>
                <select style={champStyle} value={contratChoisi} onChange={(e) => choisirContratPrécédent(e.target.value)}>
                  <option value="">— Ne pas réutiliser —</option>
                  {contratsPrécédents.map((c) => (
                    <option key={c.id} value={c.id}>{c.titre} ({new Date(c.cree_le).toLocaleDateString("fr-FR")})</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={labelStyle}>Ou importer un contrat déjà exporté (JSON) pour sauter tout ce parcours</label>
              <label style={{
                display: "inline-block", background: "#fff", color: "#5B52C4", border: "1px solid #7F77DD80", borderRadius: 6,
                padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              }}>
                Importer un contrat (JSON)
                <input type="file" accept=".json" style={{ display: "none" }} onChange={(e) => { importerContratJSON(e.target.files[0]); e.target.value = ""; }} />
              </label>
            </div>
          </>
        );

      case "ou_en_etes_vous":
        return (
          <>
            <p style={{ fontSize: 12, color: "var(--texte-tertiaire)", lineHeight: 1.6, margin: 0 }}>
              Pas "quel genre de livre", mais "quelle transformation cherchez-vous" — les questions qui
              suivent servent de brief déclaré à l'audit, en plus de ce que l'IA déduit du texte lui-même.
            </p>
            <select style={champStyle} value={ouEnEtesVous} onChange={(e) => setOuEnEtesVous(e.target.value)}>
              <option value="">— Choisir —</option>
              {OU_EN_ETES_VOUS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </>
        );

      case "nature_projet":
        return (
          <>
            <p style={{ fontSize: 11, color: "var(--texte-tertiaire)", margin: 0 }}>
              Précisez autant de niveaux que vous le pouvez — le premier suffit pour continuer, les
              suivants affinent l'analyse sans être obligatoires.
            </p>
            <SélecteurNature chemin={cheminNature} onChemin={setCheminNature} />
          </>
        );

      case "pourquoi":
        return <GroupeCasesAvecAutre options={OBJECTIFS} valeurs={objectifs} onBasculer={basculeur(setObjectifs)} autre={objectifsAutre} />;

      case "pour_qui":
        return <GroupeCasesAvecAutre options={DESTINATAIRES} valeurs={destinataires} onBasculer={basculeur(setDestinataires)} autre={destinatairesAutre} />;

      case "attentes_audit":
        return <GroupeCasesAvecAutre options={FINALITES} valeurs={finalites} onBasculer={basculerFinalité} autre={finalitesAutre} />;

      case "critere_reussite":
        return <GroupeCasesAvecAutre options={CRITERES_REUSSITE} valeurs={criteresReussite} onBasculer={basculeur(setCriteresReussite)} autre={criteresReussiteAutre} />;

      case "espoir_decouverte":
        return <GroupeCasesAvecAutre options={CE_QUE_VOUS_ESPEREZ_DECOUVRIR} valeurs={ceQueVousEspérezDécouvrir} onBasculer={basculeur(setCeQueVousEspérezDécouvrir)} autre={espérezDécouvrirAutre} />;

      case "question_precise":
        return (
          <>
            <p style={{ fontSize: 11.5, color: "var(--texte-tertiaire)", lineHeight: 1.6, margin: 0 }}>
              Cochez ce qui vous préoccupe — CursAudit vous proposera une question centrale à partir de
              vos réponses, que vous pourrez valider ou modifier librement.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              {PREOCCUPATIONS_QUESTION_PRECISE.map((p) => (
                <Checkbox key={p} checked={preoccupations.includes(p)} onChange={() => basculerPreoccupation(p)} label={p} />
              ))}
            </div>
            <div>
              <Checkbox
                checked={preoccupationAutreActive}
                onChange={() => setPreoccupationAutreActive((v) => !v)}
                label="Autre, à préciser"
              />
              {preoccupationAutreActive && (
                <input
                  style={{ ...champStyle, marginTop: 6 }}
                  value={preoccupationAutre}
                  onChange={(e) => setPreoccupationAutre(e.target.value)}
                  placeholder="Précisez votre préoccupation"
                />
              )}
            </div>
            <button type="button" onClick={proposerQuestionCentrale} disabled={syntheseQuestionEnCours} style={{
              background: "#fff", color: "#5B52C4", border: "1px solid #7F77DD80", borderRadius: 6,
              padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: syntheseQuestionEnCours ? "default" : "pointer", fontFamily: "inherit",
              justifySelf: "start",
            }}>
              {syntheseQuestionEnCours ? "CursAudit formule une proposition…" : "Proposer ma question centrale"}
            </button>
            {erreurSyntheseQuestion && (
              <div style={{ fontSize: 11.5, color: "#A32D2D" }}>{erreurSyntheseQuestion}</div>
            )}
            <div>
              <label style={{ ...labelStyle, fontWeight: 600 }}>Question centrale validée</label>
              <p style={{ fontSize: 11, color: "var(--texte-tertiaire)", margin: "0 0 6px" }}>
                Reprenez ou modifiez librement la proposition ci-dessus — ce texte devient la boussole de
                l'analyse.
              </p>
              <textarea
                style={{ ...champStyle, minHeight: 70, resize: "vertical" }}
                value={questionLibre}
                onChange={(e) => setQuestionLibre(e.target.value)}
                placeholder="Ex. : Est-ce que mon mémoire répond bien à ma problématique ?"
              />
            </div>
          </>
        );

      case "degre_intervention":
        return (
          <select style={champStyle} value={degreIntervention} onChange={(e) => setDegreIntervention(e.target.value)}>
            <option value="">— Choisir —</option>
            {DEGRES_INTERVENTION.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        );

      case "academique_choix":
        return (
          <>
            <Checkbox
              checked={estTravailAcademique}
              onChange={() => setEstTravailAcademique((v) => !v)}
              label="Ce texte est un mémoire, un TFE ou un autre travail académique soumis aux règles d'un établissement"
            />
            {estTravailAcademique && (
              <p style={{ fontSize: 11.5, color: "#8A6116", lineHeight: 1.5, margin: 0 }}>
                Limite pour un travail académique : CursAudit peut diagnostiquer, questionner, structurer,
                signaler — il ne doit pas écrire le travail à la place de l'étudiant⋅e.
              </p>
            )}
          </>
        );

      case "academique_conditions":
        return (
          <>
            <select style={champStyle} value={autorisationIA} onChange={(e) => setAutorisationIA(e.target.value)}>
              <option value="">— Choisir —</option>
              <option value="Oui">Oui</option>
              <option value="Non">Non</option>
              <option value="Je ne sais pas">Je ne sais pas</option>
            </select>
            {(autorisationIA === "Non" || autorisationIA === "Je ne sais pas") && (
              <p style={{ fontSize: 11.5, color: "#8A6116", lineHeight: 1.5, margin: 0 }}>
                CursAudit restera strictement au diagnostic sur ce texte : aucune proposition ni
                reformulation, quel que soit le degré d'intervention choisi précédemment — cette limite
                est appliquée automatiquement par le moteur d'analyse, pas seulement affichée ici.
              </p>
            )}
            {autorisationIA === "Oui" && (
              <div>
                <label style={labelStyle}>À quelles conditions ?</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                  {CONDITIONS_IA_ACADEMIQUE.map((c) => (
                    <Checkbox key={c} checked={conditionsIA.includes(c)} onChange={() => basculerCondition(c)} label={c} />
                  ))}
                </div>
              </div>
            )}
          </>
        );

      case "relation_ia":
        return (
          <>
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
            {/* Réf. 60816-01, suite, 29/08/2026 — demande explicite de
                l'auteur du projet, arrivé au bout du questionnaire sans
                rien trouver pour en garder une trace : bloc dédié, bien
                visible, plutôt qu'un simple bouton perdu à côté des menus
                ci-dessus. */}
            <div style={{ background: "var(--fond, #F7F4EF)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "12px 14px", display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--texte-secondaire)" }}>
                Garder une trace de vos réponses
              </div>
              <p style={{ fontSize: 11, color: "var(--texte-tertiaire)", margin: 0 }}>
                Le Word se lit facilement ; le JSON peut être réimporté ici même pour un futur audit
                (bouton "Importer un contrat" sur la première question).
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={exporterContratEnWord} style={{
                  background: "#fff", color: "#5B52C4", border: "1px solid #7F77DD80", borderRadius: 6,
                  padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                }}>
                  Exporter en Word
                </button>
                <button type="button" onClick={exporterContratJSON} style={{
                  background: "#fff", color: "#5B52C4", border: "1px solid #7F77DD80", borderRadius: 6,
                  padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                }}>
                  Exporter en JSON (réimportable)
                </button>
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 560, margin: "0 auto" }}>
      <div>
        <div style={{ fontSize: 11.5, color: "var(--texte-tertiaire)", marginBottom: 6 }}>
          Question {étapeIndex + 1} / {étapesClés.length}
        </div>
        <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${((étapeIndex + 1) / étapesClés.length) * 100}%`,
            background: "#1D9E75", transition: "width 0.2s ease",
          }} />
        </div>
      </div>

      <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 12, padding: "22px 24px", display: "grid", gap: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--texte-primaire)" }}>
          {TITRES_ÉTAPE[étapeActuelle]}
        </div>
        {renderContenuÉtape(étapeActuelle)}
      </div>

      {erreur && (
        <div style={{ background: "#FBE9E9", color: "#A32D2D", padding: "10px 14px", borderRadius: 6, fontSize: 13 }}>{erreur}</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        {étapeIndex > 0 ? (
          <button type="button" onClick={étapePrécédente} style={{
            background: "none", border: "1px solid var(--border)", borderRadius: 8,
            padding: "10px 18px", fontSize: 13, color: "var(--texte-secondaire)", cursor: "pointer", fontFamily: "inherit",
          }}>
            Précédent
          </button>
        ) : <div />}
        <button onClick={étapeSuivante} style={{
          background: "#1D9E75", color: "#fff", border: "none", borderRadius: 8,
          padding: "10px 26px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        }}>
          {étapeIndex === étapesClés.length - 1 ? "Continuer" : "Valider"}
        </button>
      </div>
    </div>
  );
}
