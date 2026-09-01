/**
 * CURSUS — Module : Co-pilote IA
 * Branché sur l'API Claude en temps réel.
 * 4 onglets : Suggestions / Personnages / Références APA / Cohérence
 *
 * Version i18n (chantier 04/07/2026) :
 * - Tous les textes d'interface passent par t('copilote.xxx')
 * - `langueProjet` est propagée à claude-prox pour que la réponse générée
 *   par l'IA soit dans la langue du projet, pas seulement l'UI autour d'elle
 *
 * MODIF 20/07/2026 (a) : l'aide au démarrage d'un CHAPITRE sans titre s'appuie
 * désormais sur deux informations transmises par App.jsx :
 *   - titrePartieParente : titre de la Partie qui contient ce chapitre
 *   - titresChapitresVoisins : titres des chapitres frères déjà nommés
 * Avant cette modif, un chapitre sans titre produisait des suggestions
 * génériques sur "pourquoi ce chapitre n'a pas de titre" plutôt que des
 * pistes ancrées dans la place réelle du chapitre dans le manuscrit.
 *
 * MODIF 20/07/2026 (b) : bouton "Copier" ajouté sur les cartes Suggestion,
 * Personnage et Cohérence (la carte Référence avait déjà son propre bouton
 * de copie, dédié à la citation APA — inchangé). Les libellés utilisent la
 * valeur par défaut d'i18next (t("clé", "texte par défaut")) plutôt que
 * d'ajouter des clés dans copilote.json — choix délibéré pour ne pas
 * toucher aux fichiers de traduction aujourd'hui après l'incident JSON du
 * 19/07/2026. À migrer proprement vers les fichiers de traduction quand
 * l'occasion s'y prêtera, sans urgence.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase.js";
import { mémoireNarrativeAPI } from "../lib/api.js";
import CompteurUsageIA from "./CompteurUsageIA.jsx";

// Plus de troncature artificielle depuis le 17/07/2026 (demande de Joseph) :
// la seule limite est ce que l'auteur choisit lui-même — la sélection
// surlignée, ou le chapitre entier. La fenêtre de contexte de Claude est
// largement suffisante pour un chapitre complet ; le seul vrai coût est le
// quota de tokens de l'auteur, qui augmente proportionnellement à la taille
// du texte envoyé (voir vérification du 15/07 : 3% du quota mensuel utilisé
// à ce stade, large marge).
const extraireTexte = (html = "") => {
  const nettoyé = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return { texte: nettoyé, tronqué: false };
};

const compterMots = (html = "") =>
  html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;

// Découpe un texte en tranches chevauchantes — réf. 60816-01, suite,
// 30/08/2026, "Conseils de recomposition". Permet d'analyser un chapitre
// entier au-delà du seuil de 8000 caractères sans jamais résumer le texte
// source, en plusieurs appels dont les résultats sont ensuite fusionnés
// (voir lancerConseilsRecomposition). Coupe à la ponctuation de fin de
// phrase la plus proche du seuil plutôt qu'au caractère près, pour ne
// jamais trancher en plein milieu d'une phrase — le texte est déjà nettoyé
// par extraireTexte à ce stade, donc plus de sauts de paragraphe à
// détecter (les espaces ont été collapsés). Le chevauchement assure
// qu'une incohérence ou une transition à cheval sur une coupure n'est pas
// ratée par les deux tranches voisines.
function découperEnTranches(texte, tailleMax = 8000, chevauchement = 2000) {
  if (texte.length <= tailleMax) return [texte];
  const tranches = [];
  let début = 0;
  while (début < texte.length) {
    let fin = Math.min(début + tailleMax, texte.length);
    if (fin < texte.length) {
      const bornInf = Math.max(début, fin - 400);
      const zoneRecherche = texte.slice(bornInf, fin);
      const dernièrePonctuation = Math.max(
        zoneRecherche.lastIndexOf(". "), zoneRecherche.lastIndexOf("! "), zoneRecherche.lastIndexOf("? ")
      );
      if (dernièrePonctuation !== -1) fin = bornInf + dernièrePonctuation + 2;
    }
    tranches.push(texte.slice(début, fin).trim());
    if (fin >= texte.length) break;
    début = Math.max(0, fin - chevauchement);
  }
  return tranches;
}

// ─── Appel API Claude ─────────────────────────────────────────────────────────

const EDGE_FUNCTION_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/claude-prox";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Outil de recherche web natif de Claude — ajouté 02/08/2026, à la demande
// de Joseph : les références bibliographiques proposées par le co-pilote
// n'étaient vérifiées par AUCUN outil réel, seulement par une instruction de
// prompt ("vérifie que l'édition est exacte") — donc pas de vérification du
// tout, juste une consigne que le modèle peut suivre ou halluciner malgré
// tout. `claude-prox` (l'Edge Function Supabase) transmet le corps de la
// requête tel quel à l'API Anthropic (voir son code : `JSON.stringify(body)`
// sans en interpréter le contenu) — ce tableau suffit donc à activer une
// vraie recherche web exécutée côté Anthropic, sans toucher à la fonction
// Edge elle-même. NON TESTÉ EN CONDITIONS RÉELLES : `max_uses`, le format
// exact des citations renvoyées, et la compatibilité avec le header
// `anthropic-version: 2023-06-01` fixé en dur côté serveur restent à
// valider au premier usage réel — si l'appel échoue avec une erreur liée à
// l'outil, c'est ce header, dans claude-prox, qu'il faudra mettre à jour.
const OUTIL_RECHERCHE_WEB = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];

// CORRECTIF 30/08/2026, retour d'usage réel : une réponse coupée en plein
// milieu d'une phrase (max_tokens atteint) était invisible pour l'appelant —
// `avecDétails` (utilisé par le fil de dialogue, voir DIALOGUE_MAX_TOKENS)
// renvoie { texte, tronqué } au lieu d'une simple chaîne, pour permettre un
// vrai bouton "Continuer" plutôt que de laisser l'auteur·ice retaper
// "continue !" à la main pour s'en sortir. Tous les autres appelants
// n'ont rien à changer : par défaut, le comportement (chaîne simple) est
// inchangé.
async function appelClaude(system, user, signal, maxTokens = 1000, tools = null, avecDétails = false) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error("SESSION_EXPIREE");
  }

  const corpsRequête = {
    // claude-sonnet-5 : moins cher ET plus récent que claude-sonnet-4-6
    // (utilisé ici jusqu'au 30/08/2026 par oubli — verification-deux-ia
    // utilise déjà claude-sonnet-5 par défaut, voir MODELE_CLAUDE).
    model: "claude-sonnet-5",
    max_tokens: maxTokens,
    // `system` peut être une chaîne simple ou un tableau de blocs avec
    // cache_control (voir systemAvecLangue) — transmis tel quel, l'API
    // Anthropic accepte les deux formes.
    system,
    messages: [{ role: "user", content: user }],
  };
  if (tools) corpsRequête.tools = tools;

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(corpsRequête),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  if (data.error) throw new Error(typeof data.error === "object" ? JSON.stringify(data.error) : data.error);
  // Avec un outil comme la recherche web, la réponse peut contenir plusieurs
  // blocs (server_tool_use, web_search_tool_result, text) avant le texte
  // final — content[0] n'est donc plus fiable pour l'extraire. On concatène
  // tous les blocs de type "text", dans l'ordre.
  const texte = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  if (!avecDétails) return texte;
  return { texte, tronqué: data.stop_reason === "max_tokens" };
}

// ─── Vérification approfondie à deux IA (protocole 60805-06) ──────────────────
// Distinct de appelClaude : appelle verification-deux-ia (pas claude-prox),
// qui orchestre elle-même Claude et GPT côté serveur — un seul aller-retour
// suffit ici, la sortie est déjà une réponse structurée, jamais du texte à
// parser. Voir docs/protocole-verification-approfondie-deux-ia.md.
const VERIFICATION_EDGE_FUNCTION_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/verification-deux-ia";

async function appelVerificationDeuxIA(projetId, nœudId, texteSélectionné, signal) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("SESSION_EXPIREE");

  const response = await fetch(VERIFICATION_EDGE_FUNCTION_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ projet_id: projetId, noeud_id: nœudId, texte_selectionne: texteSélectionné }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
  return data;
}

// ─── Prompts ──────────────────────────────────────────────────────────────────
// Ces prompts système restent en français : ce sont des instructions à Claude,
// pas du texte d'interface. La langue de LA RÉPONSE générée (elle, visible par
// l'utilisateur) est imposée via l'instruction de langue ajoutée dans analyser().

// Tente de parser du JSON ; si la réponse n'en est pas (par exemple un refus
// poli du modèle sur un passage sensible), affiche ce texte tel quel plutôt
// qu'une erreur technique cryptique de type "JSON.parse: unterminated string".
//
// Filet de sécurité ajouté le 17/07/2026 : depuis que la troncature d'entrée
// à 4000 caractères a été retirée, un très gros texte source peut produire
// une réponse IA plus longue, parfois coupée par le plafond de tokens de
// sortie — laissant un JSON "ouvert". réparerJSONTronqué() referme
// proprement les structures encore ouvertes plutôt que d'échouer net.
function réparerJSONTronqué(str) {
  let s = str;
  const nbGuillemets = (s.match(/(?<!\\)"/g) || []).length;
  if (nbGuillemets % 2 !== 0) s += '"'; // referme une chaîne restée ouverte
  const pile = [];
  for (const ch of s) {
    if (ch === "{" || ch === "[") pile.push(ch);
    else if (ch === "}" && pile[pile.length - 1] === "{") pile.pop();
    else if (ch === "]" && pile[pile.length - 1] === "[") pile.pop();
  }
  while (pile.length) s += pile.pop() === "{" ? "}" : "]";
  return s;
}

function parserJSON(résultat) {
  const nettoyé = résultat.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(nettoyé);
  } catch {
    try {
      return JSON.parse(réparerJSONTronqué(nettoyé));
    } catch {
      throw new Error(nettoyé.slice(0, 300) || "__ERREUR_GENERIQUE__");
    }
  }
}

const INSTRUCTION_LANGUE = {
  fr: "Réponds en français.",
  en: "Respond in English.",
};

const PROMPTS = {
  suggestions: (type) => `Tu es co-pilote d'un écrivain professionnel travaillant sur un ${type === "fiction" ? "roman" : "essai ou ouvrage de non-fiction"}. Analyse le texte et génère exactement 3 suggestions concrètes.

RÈGLE NON NÉGOCIABLE sur les personnes nommées dans le texte (réelles ou identifiables) : n'attribue JAMAIS un trait de caractère, une qualité, une intention ou un fait à une personne nommée si l'auteur ne l'a pas déjà écrit lui-même. Une reformulation peut clarifier, alléger ou réorganiser ce que l'auteur a écrit sur cette personne — elle ne peut jamais AJOUTER une caractérisation nouvelle ("exigeant", "patient", "bienveillant"...) qui n'existait pas dans le texte source, même si elle semble plausible ou stylistiquement séduisante. En cas de doute sur ce qui est réellement affirmé par l'auteur, reste plus neutre et plus proche du texte plutôt que d'enrichir.

Réponds UNIQUEMENT en JSON valide :
{"suggestions":[{"type":"suite","titre":"...","texte":"..."},{"type":"approfondissement","titre":"...","texte":"..."},{"type":"reformulation","titre":"...","texte":"..."}]}`,

  personnages: `Tu es assistant littéraire spécialisé en fiction. Extrait les personnages du texte. Réponds UNIQUEMENT en JSON valide :
{"personnages":[{"nom":"...","rôle":"...","traits":["..."],"cohérence":"ok","note":"..."}]}`,

  // Le biais linguistique des références est volontaire, pas un oubli :
  // un texte rédigé en français doit normalement s'appuyer sur la littérature
  // francophone en priorité (comme un texte anglais s'appuierait naturellement
  // sur la littérature anglo-saxonne) — sans exclure les ouvrages étrangers
  // majeurs quand aucun équivalent francophone sérieux n'existe. Ajouté le
  // 17/07/2026, à la demande de Joseph.
  références: (langueProjet) => {
    const biais = langueProjet === "fr"
      ? "Le texte analysé est rédigé en français : privilégie les publications francophones (auteurs de langue française, ou traductions françaises officielles d'ouvrages étrangers) chaque fois qu'une référence équivalente sérieuse existe. Ne cite un ouvrage non traduit en français que s'il n'existe aucun équivalent francophone valable sur ce concept précis — indique-le alors explicitement dans le champ \"pertinence\" (ex. \"aucun équivalent francophone identifié\")."
      : "Privilégie la littérature scientifique de langue anglaise, norme académique dominante pour ce type d'ouvrage.";
    return `Tu es assistant de recherche académique. Identifie les concepts qui méritent des références scientifiques ou historiques. ${biais}

RÈGLE DE VÉRIFICATION DES RÉFÉRENCES — NON NÉGOCIABLE :
Avant de proposer toute référence (livre, article, auteur), tu dois d'abord la chercher via l'outil de recherche disponible pour la vérifier. Ne produis JAMAIS une référence directement depuis ta mémoire sans tentative de vérification préalable, même si tu es certain de la connaître.

Procédure, dans l'ordre, pour CHAQUE concept qui appelle une référence :
1. Recherche obligatoire (titre + auteur pressenti, ou thème + mots-clés si tu n'as pas de titre précis en tête). Ne saute jamais cette étape.
2. Si la recherche confirme la référence : cite-la normalement avec les détails confirmés. statut = "vérifié".
3. Si la recherche confirme l'ouvrage mais pas un détail précis (page, chapitre, édition) : cite l'ouvrage SANS ce détail — n'invente jamais un numéro pour "compléter" une citation qui semblerait incomplète. statut = "détail_non_confirmé", champ "page" laissé vide.
4. Si la recherche ne confirme rien : ne fabrique aucune référence de remplacement. statut = "non_trouvé", champ "apa" laissé vide, champ "pertinence" limité à une piste thématique générale SANS nom d'auteur ni titre précis (ex. "des travaux en thérapie systémique traitent de ce mécanisme, référence à identifier").
5. Ne mélange jamais, dans la même liste, un statut "vérifié" et une référence non vérifiée présentés avec le même niveau de détail — le statut doit toujours accompagner la référence, jamais être omis.
6. En cas de nom d'auteur proche d'un autre auteur du même champ, vérifie spécifiquement que le nom ET le titre vont ensemble — un auteur réel associé à un titre qui n'est pas le sien est aussi grave qu'une référence entièrement inventée.

Réponds UNIQUEMENT en JSON valide :
{"références":[{"concept":"...","apa":"...","statut":"vérifié","page":"...","pertinence":"..."}]}
Le champ "statut" vaut exactement "vérifié", "détail_non_confirmé" ou "non_trouvé".`;
  },

  cohérence: (type) => `Tu es éditeur professionnel relisant un ${type === "fiction" ? "roman" : "essai"}. Détecte incohérences, répétitions, transitions manquantes.

RÈGLE NON NÉGOCIABLE sur les personnes nommées : si une suggestion mentionne une personne nommée dans le texte, ne lui attribue jamais de trait de caractère, de qualité ou de fait que l'auteur n'a pas déjà écrit lui-même.

Réponds UNIQUEMENT en JSON valide :
{"points":[{"type":"incohérence","sévérité":"attention","description":"...","suggestion":"..."}]}`,

  // "Conseils de recomposition" — réf. 60816-01, suite, 30/08/2026. Analyse
  // structurelle d'un chapitre entier, tranche par tranche (voir
  // découperEnTranches). Même forme JSON que `cohérence` — réutilise
  // CarteCoherence pour l'affichage, pas de nouveau composant nécessaire.
  // Ajout demandé explicitement après un test réel : repérer la "glose
  // redondante" (une phrase qui explique ce qu'une scène montre déjà).
  recomposition: (type) => `Tu es éditeur professionnel relisant un extrait d'un ${type === "fiction" ? "roman" : "essai"} — ce texte est UNE TRANCHE d'un chapitre plus long, analysée séparément pour des raisons techniques : ne t'étonne pas d'un début ou d'une fin qui semblent couper une phrase ou une scène en cours, et ne le signale pas comme un problème.

Repère spécifiquement :
- les endroits où le texte EXPLIQUE ce qu'une scène montre déjà ("glose redondante") — une phrase qui commente ou interprète ce qu'une image ou une action vient de rendre évident, alors que la scène se suffisait à elle-même ;
- les répétitions de mots ou d'idées à quelques lignes d'intervalle ;
- les transitions manquantes ou abruptes entre deux idées ou deux scènes ;
- les ruptures de registre ou de voix ;
- les échos ou rappels internes (un motif, une réplique, un objet) qui mériteraient d'être renforcés, ou à l'inverse qui créent une redite.

RÈGLE NON NÉGOCIABLE sur les personnes nommées : si un point mentionne une personne nommée dans le texte, ne lui attribue jamais de trait de caractère, de qualité ou de fait que l'auteur n'a pas déjà écrit lui-même.

Réponds UNIQUEMENT en JSON valide :
{"points":[{"type":"glose redondante","sévérité":"attention","description":"...","suggestion":"..."}]}
Le champ "type" nomme librement la nature du point (ex. "glose redondante", "répétition", "transition manquante", "rupture de registre", "écho interne"). Le champ "sévérité" vaut "info", "attention" ou "important".`,

  // Fusionne les résultats de plusieurs tranches chevauchantes en une seule
  // liste — sans ce passage, le même point apparaîtrait deux fois (une
  // fois par tranche qui couvre la zone de chevauchement).
  synthèseRecomposition: (type) => `Tu reçois plusieurs listes de points de relecture, produites séparément sur des tranches qui se chevauchent d'un même chapitre de ${type === "fiction" ? "roman" : "essai"}. À cause du chevauchement, le même point peut apparaître deux fois, formulé différemment.

Fusionne ces listes en UNE seule liste finale :
- si deux points décrivent clairement le même problème (même passage, même nature), n'en garde qu'un, avec la description la plus claire des deux ;
- conserve tous les points distincts, même s'ils viennent de tranches différentes ;
- classe les points par ordre d'apparition approximatif dans le chapitre, du début vers la fin, si tu peux l'estimer.

Réponds UNIQUEMENT en JSON valide, même format que les listes reçues :
{"points":[{"type":"...","sévérité":"...","description":"...","suggestion":"..."}]}`,

  // Aide au démarrage — ajouté le 18/07/2026, différencié par niveau le
  // 19/07/2026. Trois comportements distincts selon que la page blanche est
  // une Partie, un Chapitre ou une Scène — pas un seul mode générique.
  //
  // MODIF 20/07/2026 : pour un Chapitre dont le titre est vide ou générique
  // ("Chapitre sans titre" / "Chapter untitled"), on injecte désormais le
  // titre de la Partie parente et les titres des chapitres frères déjà
  // nommés, pour ancrer les 4 pistes dans la place réelle du chapitre dans
  // le manuscrit — plutôt que de laisser le modèle philosopher sur
  // l'absence de titre elle-même, ce qui n'aide pas concrètement l'auteur.
  demarrage: (typeNœud, titreNœud, titresEnfants = [], notesEtCitations = null, titrePartieParente = null, titresChapitresVoisins = []) => {
    if (typeNœud === "partie") {
      const chapitresConnus = titresEnfants.length > 0
        ? `Cette partie contient déjà ces chapitres : ${titresEnfants.join(", ")}. Appuie-toi dessus.`
        : `Cette partie n'a pas encore de chapitres définis.`;
      return `Tu es le co-pilote d'un écrivain qui ouvre une "Partie" encore vide de son manuscrit. Une Partie est le niveau le plus large : elle regroupe plusieurs chapitres autour d'une même colonne vertébrale thématique. ${chapitresConnus} À partir du titre de cette partie et du contexte du projet fourni ci-dessus (notamment les thèmes retenus au questionnaire d'intention), rappelle en 2-3 phrases la colonne vertébrale que cette partie est censée porter — ce qui la relie à l'ensemble du livre. Si aucun chapitre n'est encore défini, suggère explicitement de revenir compléter cette Partie une fois que les chapitres auront été déterminés dans le sommaire, en les copiant ici. Réponds UNIQUEMENT en JSON valide, avec exactement 2 suggestions :
{"suggestions":[{"type":"structure","titre":"...","texte":"..."},{"type":"structure","titre":"...","texte":"..."}]}`;
    }
    if (typeNœud === "scene") {
      const blocRéférences = notesEtCitations
        ? `Éléments déjà enregistrés par l'auteur pour ce projet, à mobiliser s'ils sont pertinents pour cette scène précise :\n${notesEtCitations}`
        : `Aucune citation ni idée enregistrée pour ce projet pour l'instant.`;
      return `Tu es le co-pilote d'un écrivain qui ouvre une "Scène" encore vide — le niveau le plus fin du manuscrit (souvent une note, un repère de lecture, ou un développement court). ${blocRéférences} À partir du titre de cette scène et du contexte du projet, propose des pistes de démarrage adaptées à ce niveau de détail : rappels de cohérence à surveiller, précisions utiles sur des personnages ou des références bibliographiques déjà notées, ou toute piste concrète et courte pour ce point précis. Reste bref — une scène n'a pas besoin d'un plan, juste d'un point de départ. Réponds UNIQUEMENT en JSON valide, avec exactement 3 suggestions :
{"suggestions":[{"type":"ouverture","titre":"...","texte":"..."},{"type":"angle","titre":"...","texte":"..."},{"type":"question","titre":"...","texte":"..."}]}`;
    }

    // chapitre (par défaut)
    const titreEstVide = !titreNœud || /sans titre|untitled/i.test(titreNœud);

    let contexteChapitreSansTitre = "";
    if (titreEstVide) {
      const partieInfo = titrePartieParente
        ? `Ce chapitre appartient à la partie "${titrePartieParente}" : c'est ton point d'ancrage principal — chaque piste doit se rattacher clairement à cette colonne vertébrale, pas rester générique.`
        : `Aucune partie parente identifiée pour ce chapitre.`;
      const voisinsInfo = titresChapitresVoisins.length > 0
        ? `D'autres chapitres de cette même partie portent déjà ces titres : ${titresChapitresVoisins.join(", ")}. Positionne ce chapitre par rapport à eux (ce qu'il apporte de nouveau, sa place probable dans la progression) — ne propose rien qui ferait doublon avec l'un d'eux.`
        : `Aucun autre chapitre de cette partie n'a encore de titre défini : ce chapitre est probablement le premier, ou l'un des tout premiers, de cette partie.`;
      contexteChapitreSansTitre = `IMPORTANT — ce chapitre n'a pas encore de titre. ${partieInfo} ${voisinsInfo} Tes 4 pistes doivent être des propositions concrètes ancrées dans ce contexte réel (la partie, les chapitres voisins) — PAS une réflexion sur le sens ou la valeur de l'absence de titre elle-même. Le titre alternatif que tu proposes en piste "reformulation" doit être un vrai candidat de titre pour ce chapitre, cohérent avec les titres déjà utilisés dans cette partie.\n\n`;
    }

    return `${contexteChapitreSansTitre}Tu es le co-pilote d'un écrivain qui ouvre un "Chapitre" encore vide. Ton rôle ici n'est pas d'analyser un texte existant (il n'y en a pas), mais d'aider à démarrer, en t'appuyant uniquement sur le contexte du projet fourni ci-dessus et sur le titre du chapitre donné. Propose exactement 4 pistes de nature DIFFÉRENTE les unes des autres pour amorcer précisément CE chapitre — varie les approches, ne répète pas le même type d'angle : un titre alternatif possiblement plus juste, une situation ou un cas concret par lequel entrer dans le sujet, une explication du titre lui-même (ce qu'il signifie, pourquoi ce mot), et une énigme ou question qui intrigue le lecteur dès l'ouverture. Reste ancré dans le ton et les thèmes déjà définis par l'auteur — ne propose rien de générique qui pourrait convenir à n'importe quel livre. Réponds UNIQUEMENT en JSON valide :
{"suggestions":[{"type":"reformulation","titre":"...","texte":"..."},{"type":"ouverture","titre":"...","texte":"..."},{"type":"angle","titre":"...","texte":"..."},{"type":"question","titre":"...","texte":"..."}]}`;
  },

  // Page blanche — brouillon complet, réf. 60816-01, suite, 30/08/2026,
  // demande explicite de l'auteur du projet. ROMPT DÉLIBÉRÉ avec le principe
  // "jamais de texte de remplacement" qui gouverne le reste de CopiloteIA
  // (voir RÈGLE NON NÉGOCIABLE dans suggestions/cohérence ci-dessus) — une
  // action explicite et distincte, jamais déclenchée automatiquement,
  // toujours présentée avec un avertissement clair côté rendu : un brouillon
  // jetable à réécrire entièrement dans la voix de l'auteur·ice, jamais un
  // texte à publier tel quel.
  pageBlanche: (typeNœud, titreNœud) => `Tu es le co-pilote d'un écrivain confronté à la page blanche sur un ${typeNœud === "partie" ? "grand ensemble" : typeNœud === "scene" ? "passage court" : "chapitre"} intitulé "${titreNœud || "(sans titre)"}". À partir du contexte du projet fourni ci-dessus (thèmes, personnages, intention retenus au questionnaire), rédige un texte développé et concret qui pourrait occuper cet espace — pas trois idées en vrac, un vrai texte suivi, aussi long que nécessaire pour donner un point de départ substantiel à démolir et reconstruire. Ce texte sera présenté à l'auteur·ice comme un brouillon jetable, à réécrire entièrement dans sa propre voix — tu peux donc te permettre d'être concret et développé plutôt que prudent. Réponds UNIQUEMENT en JSON valide :
{"brouillon":"..."}`,

  // Aide à définir un projet — réf. 60816-01, suite, 30/08/2026. N'a de sens
  // que pour un livre encore sans aucun chapitre (voir la condition
  // d'affichage côté composant : typeNœud === "partie" && titresEnfants
  // vide) : à partir d'un compte-rendu brut fourni par l'auteur·ice (récit
  // vécu, notes de terrain, idée en vrac), propose une colonne vertébrale —
  // pas le texte des chapitres eux-mêmes, seulement leurs titres et ce que
  // chacun porterait, à charge pour l'auteur·ice de les créer puis de les
  // développer un par un via "Page blanche" ci-dessus.
  definirProjet: () => `Tu es le co-pilote d'un écrivain qui a une idée ou un vécu à raconter, mais pas encore de structure de livre. Il te donne un compte-rendu brut de ce qu'il veut raconter. À partir de ce texte, propose une colonne vertébrale : un titre de livre possible, et une suite de chapitres (5 à 10) qui pourraient porter ce récit du début à la fin, chacun avec un titre et une phrase résumant ce qu'il porterait. Reste fidèle à ce que le compte-rendu raconte réellement, n'invente pas d'éléments qui n'y figurent pas. Réponds UNIQUEMENT en JSON valide :
{"titre_livre":"...","chapitres":[{"titre":"...","resume":"..."}]}`,

  // "Aide-moi à avancer" — réf. 60816-01, suite, 30/08/2026, conçu à partir
  // d'une synthèse de littérature sur le blocage d'écriture fournie par
  // l'auteur du projet (Ahmed & Güss, Rose, Boice, Elbow, Lamott...), puis
  // affinée une seconde fois le même jour (retour croisé avec GPT) : la page
  // blanche n'est qu'UNE forme de blocage parmi d'autres, et un vrai coach
  // ne fait pas poser le diagnostic par la personne bloquée, il l'infère de
  // ce qui est déjà écrit — MAIS il propose son hypothèse à confirmer,
  // plutôt que de l'imposer (voir confirmationBlocage côté composant :
  // "Oui, aide-moi" / "Non, c'est autre chose", cette dernière rouvrant un
  // nouveau diagnostic avec le complément donné par l'auteur·ice). Deux
  // raffinements ajoutés à ce second passage : (1) les blocages peuvent se
  // combiner (continuation + personnage, perfectionnisme + peur du
  // jugement...) — ne pas forcer une étiquette unique ; (2) "faux blocage"
  // — catégorie volontairement non nommée à l'auteur·ice — couvre le cas où
  // le vrai problème n'est pas de trouver comment continuer, mais de
  // reconnaître qu'il n'y a peut-être rien à continuer ici (ellipse
  // possible, chapitre déjà terminé plus tôt, geste incohérent avec ce qui
  // a été construit). Contrairement à pageBlanche ci-dessus, ce prompt ne
  // doit PAS produire un texte de remplacement par défaut : le diagnostic
  // vient d'abord, le texte seulement si l'auteur·ice choisit ensuite
  // "Propose-moi un exemple" (fil de dialogue par carte existant).
  jeSuisBloqué: (typeNœud, titreNœud, complémentAuteur = null) => `Tu es un coach d'écriture qui connaît déjà ce livre (contexte fourni ci-dessus) et le texte déjà écrit dans ce ${typeNœud} intitulé "${titreNœud || "(sans titre)"}". L'auteur·ice a cliqué sur "Aide-moi à avancer"${complémentAuteur ? " ; un premier diagnostic lui a été proposé, qu'il/elle a jugé inexact, et voici ce qu'il/elle précise sur ce qui se passe réellement : \"" + complémentAuteur + "\" — tiens-en compte impérativement pour ce nouveau diagnostic, ne répète pas la même hypothèse" : " sans donner aucun autre détail — c'est à toi de comprendre la nature du blocage à partir d'où le texte s'arrête et de ce qu'il devait accomplir selon le contexte du projet"}.

Ne commence JAMAIS par demander "comment puis-je t'aider ?" ni par faire choisir une catégorie de blocage à l'auteur·ice — identifie toi-même, en interne, la ou les natures les plus probables parmi (ne montre jamais cette liste, elle sert seulement à orienter ton diagnostic ; un blocage peut combiner plusieurs de ces natures à la fois, ne force pas une étiquette unique si ce n'est pas le cas) : idéation (aucune idée), direction (ne sait plus ce qui doit arriver ensuite), choix (plusieurs options, indécision), structure (des éléments mais pas de tenue — que veut le personnage, qu'est-ce qui l'en empêche, qu'est-ce qui change entre l'entrée et la sortie de la scène, pourquoi cette scène doit-elle exister), personnage (ne sait pas comment il/elle réagirait ici), scène inerte (il se passe quelque chose mais c'est plat), articulation (sait quoi dire, n'arrive pas à l'écrire), voix (ne ressemble plus au reste du livre), perfectionnisme (rejette tout ce qu'il/elle écrit), révision paralysante (ne sait plus quoi garder), perte de sens (n'a plus envie), saturation (tourne en rond depuis un moment), documentation (il manque une information factuelle), reprise après interruption (ne sait plus où il/elle en était), blocage émotionnel (sait exactement ce qu'il faudrait raconter mais n'arrive pas à poser les mots — pas de la lassitude, pas un problème narratif ; n'écris alors surtout pas la scène à sa place, propose plutôt de raconter les faits bruts sans chercher à bien écrire, de noter seulement les faits, d'écrire à la troisième personne, de commencer par juste avant/après, ou de laisser un marqueur et continuer ailleurs), doute global (pense que son texte ne marche plus — dans ce cas NE PROPOSE PAS de réécrire, aide à situer si le problème est local, dans l'arc, dans un personnage ou dans la promesse du texte), faux blocage (le vrai problème n'est peut-être pas de trouver comment continuer, mais que ce passage n'a pas besoin d'exister tel quel — une ellipse suffirait, le chapitre était déjà fini plus tôt, ou l'action demandée est incohérente avec le personnage tel qu'il a été construit ; si tu soupçonnes ce cas, dis-le directement et explique pourquoi, avant de chercher comment continuer).

Réponds directement par un diagnostic court et concret, dans l'esprit de : "Je vois où tu t'es arrêté..." — nomme ce qui précède, ce que le contrat d'intention ou le contexte du projet demande à cet endroit, et en quoi ton hypothèse sur la nature du blocage (une ou plusieurs, si combinées) en découle. Propose ensuite 2 à 3 directions concrètes et distinctes pour en sortir, SANS en développer aucune complètement — ce sont des pistes qui ouvrent des choix, pas un texte fini. Reste bref : 120 à 200 mots au total, ton direct et concret, jamais générique. Réponds UNIQUEMENT en JSON valide :
{"diagnostic":"...","type_blocage":"..."}`,
};

// CORRECTIF 30/08/2026 — prompt caching : contexteADN (questionnaire +
// mémoire narrative + Carnet d'idées) est le bloc le plus gros et le plus
// stable du prompt système, identique d'un onglet à l'autre (Suggestions,
// Personnages, Cohérence, Références...) pendant toute une session. Il
// était pourtant simplement concaténé en tête d'une CHAÎNE unique — jamais
// mis en cache, donc reconstitué et refacturé au tarif plein à chaque appel.
// Renvoie désormais un TABLEAU de blocs avec cache_control sur le bloc ADN
// (breakpoint Anthropic) quand contexteADN est fourni ; reste une simple
// chaîne sinon (rien à mettre en cache, pas de raison de complexifier).
// Aucun appelant n'a besoin de changer : `system` accepte les deux formes
// (voir appelClaude, qui transmet la valeur telle quelle).
function systemAvecLangue(promptBase, langueProjet, contexteADN) {
  const instruction = INSTRUCTION_LANGUE[langueProjet] || INSTRUCTION_LANGUE.fr;
  const finDePrompt = `${promptBase}\n\n${instruction} (Les clés JSON restent telles quelles ; seules les valeurs textuelles sont dans cette langue.)`;
  if (!contexteADN) return finDePrompt;

  const blocADN = `CONTEXTE DU PROJET — réponses de l'auteur au questionnaire d'intention (à respecter impérativement dans ton comportement, pas seulement à titre informatif) :\n${contexteADN}\n\n`;
  return [
    { type: "text", text: blocADN, cache_control: { type: "ephemeral" } },
    { type: "text", text: finDePrompt },
  ];
}

// Récupère les réponses au questionnaire ADN (niveau 1) pour un projet, et les
// met en forme comme bloc de contexte à injecter dans chaque prompt système du
// co-pilote. Sans ce contexte, le co-pilote ignorait totalement le rôle voulu
// (Q9), le ton (Q5), les thèmes (Q6) et les lignes rouges (Q7) — corrigé le
// 15/07/2026. Chaque réponse est plafonnée à 500 caractères pour éviter de
// gonfler démesurément le prompt (et donc le quota de tokens de l'auteur) ;
// à ajuster si ce plafond coupe des réponses importantes en pratique.
async function chargerContexteADN(projetId) {
  if (!projetId) return null;
  try {
    const { data: questions } = await supabase
      .from("banque_questions")
      .select("id, question")
      .eq("niveau", 1);
    const { data: réponses } = await supabase
      .from("reponses_questionnaire")
      .select("question_id, reponse")
      .eq("projet_id", projetId);

    if (!questions?.length || !réponses?.length) return null;

    const réponseParId = {};
    réponses.forEach((r) => { réponseParId[r.question_id] = r.reponse; });

    const lignes = questions
      .map((q) => {
        const r = réponseParId[q.id];
        if (!r?.valeur) return null;
        const texte = r.synthese || (r.valeur.length > 500 ? r.valeur.slice(0, 500) + "…" : r.valeur);
        return `- ${q.question} → ${texte}`;
      })
      .filter(Boolean);

    return lignes.length ? lignes.join("\n") : null;
  } catch {
    return null; // le co-pilote continue de fonctionner même sans ce contexte
  }
}

// Récupère les citations et idées déjà enregistrées pour ce projet, pour
// nourrir l'aide au démarrage au niveau "scène" — ajouté 19/07/2026, à la
// demande de Joseph : réutiliser la Bibliothèque (citations) et le Carnet
// d'idées existants plutôt que de tout réinventer.
async function chargerNotesEtCitations(projetId) {
  if (!projetId) return null;
  try {
    const { data: citations } = await supabase
      .from("citations")
      .select("texte, page, tags, livres(titre, auteur)")
      .eq("projet_id", projetId)
      .limit(10);
    const { data: idées } = await supabase
      .from("idees")
      .select("texte, tags")
      .eq("projet_id", projetId)
      .limit(10);
    // Réf. 60816-01, suite, 30/08/2026 — mémoire narrative structurée
    // (remplace le simple Carnet d'idées comme cible de "💾 Mémoriser cette
    // intention", voir mémoriserIntention plus bas). "rejetee"/"remplacee"
    // exclues : une décision abandonnée ou remplacée ne doit plus influencer
    // les prompts. "proposee" incluse mais étiquetée non confirmée — l'IA ne
    // valide jamais une observation toute seule, voir memoire_narrative.sql.
    const { data: mémoires } = await supabase
      .from("memoire_narrative")
      .select("type, contenu, statut")
      .eq("projet_id", projetId)
      .in("statut", ["validee", "proposee"])
      .order("cree_le", { ascending: false })
      .limit(15);

    const lignes = [];
    (citations || []).forEach((c) => {
      const source = c.livres ? `${c.livres.titre} (${c.livres.auteur})` : "source inconnue";
      lignes.push(`- Citation [${source}${c.page ? `, p.${c.page}` : ""}] : "${c.texte}"`);
    });
    (idées || []).forEach((i) => {
      lignes.push(`- Idée notée : ${i.texte}`);
    });
    (mémoires || []).forEach((m) => {
      const étiquette = m.statut === "proposee" ? " (proposée, non confirmée par l'auteur·ice)" : "";
      lignes.push(`- [${m.type}] ${m.contenu}${étiquette}`);
    });

    return lignes.length ? lignes.join("\n") : null;
  } catch {
    return null;
  }
}

// ─── Bouton "Copier" réutilisable ──────────────────────────────────────────────
// Ajouté le 20/07/2026. Petit bouton icône, en haut à droite de chaque carte,
// qui copie un texte formaté dans le presse-papier avec confirmation visuelle
// brève (icône ✓ pendant 2s). Les libellés utilisent la valeur par défaut
// d'i18next plutôt qu'une clé dans copilote.json (voir note en tête de
// fichier) : pas de risque de casser un fichier de traduction pour ce détail.
function BoutonCopier({ texte, couleur = "#888" }) {
  const { t } = useTranslation("copilote");
  const [copié, setCopié] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(texte);
        setCopié(true);
        setTimeout(() => setCopié(false), 2000);
      }}
      title={copié ? t("copierTout.copie", "Copié !") : t("copierTout.bouton", "Copier")}
      style={{
        fontSize: 11, lineHeight: 1,
        color: copié ? "#1D9E75" : couleur,
        background: "transparent", border: "none",
        cursor: "pointer", fontFamily: "inherit",
        padding: "2px 4px", borderRadius: 4,
        flexShrink: 0,
      }}
    >
      {copié ? "✓" : "⧉"}
    </button>
  );
}

// ─── Fil de dialogue par carte ─────────────────────────────────────────────────
// Ajouté le 10/08/2026, à la demande de Joseph : une analyse à sens unique ne
// permet ni de demander une précision, ni de challenger un point, ni de
// comprendre le "pourquoi" d'un jugement — pour un outil qui se veut un
// co-pilote et non un simple correcteur. Ce fil se déplie SOUS la carte
// concernée, dans la même colonne : pas de nouvelle colonne à gérer côté
// mise en page (App.jsx), donc rien à toucher côté layout/mobile, et un
// risque de régression bien plus faible qu'un changement de mise en page.
//
// Principe : ne JAMAIS relancer l'analyse complète pour poser une question
// de suivi (coûteux en tokens, et le résultat pourrait différer de la carte
// affichée). Le co-pilote reçoit systématiquement l'analyse d'origine de
// CETTE carte précise + l'historique de l'échange, formatés en texte, et
// répond dans le fil — un appel Claude léger, pas une nouvelle analyse.
//
// CORRECTIF 30/08/2026, retour d'usage réel : 1024 coupait régulièrement
// des réponses en pleine phrase sur des questions nuancées (nuances de
// traduction, de registre...), forçant l'auteur à retaper "continue !" à
// la main pour obtenir la suite. Relevé à 2048 pour réduire la fréquence
// du problème ; voir aussi le bouton "Continuer" dans FilDialogue pour le
// cas où la limite est quand même atteinte.
const DIALOGUE_MAX_TOKENS = 2048;

function promptDialogue(langueProjet) {
  const instruction = INSTRUCTION_LANGUE[langueProjet] || INSTRUCTION_LANGUE.fr;
  return `Tu es le co-pilote d'un écrivain. Tu as déjà produit une analyse précise (fournie ci-dessous) sur un passage de son texte. L'auteur te pose maintenant une question de suivi sur CETTE analyse précise — il veut creuser, comprendre ton raisonnement, ou te challenger sur ce point exact. Réponds directement à sa question, de façon conversationnelle et précise, en t'appuyant sur l'analyse d'origine sans la répéter intégralement. Ne redemande jamais le texte complet du chapitre : tout ce dont tu as besoin est dans l'analyse fournie et l'échange en cours.

RÈGLE NON NÉGOCIABLE sur les personnes nommées : si ta réponse (ou l'analyse d'origine que tu développes) mentionne une personne nommée dans le texte de l'auteur, ne lui attribue jamais de trait de caractère, de qualité ou de fait que l'auteur n'a pas lui-même écrit — que ce soit dans ta première réponse ou dans une reformulation que tu proposes ici. Si l'auteur te fait remarquer que tu as inventé une caractérisation, reconnais-le sans détour : ne cherche pas à justifier ou à minimiser l'invention.

${instruction}`;
}

// Réf. 60816-01, suite, 30/08/2026 — voir "💾 Mémoriser cette intention"
// dans FilDialogue. Distille un diagnostic + son fil de discussion en UNE
// note courte, réutilisable sans le contexte de l'échange d'origine, plus
// son `type` de mémoire (mémoire_narrative.sql) — enregistrée avec
// statut "proposee" (jamais "validee" : ce n'est pas à l'IA de décider
// qu'une intention est actée, voir memoire_narrative.sql), relue
// automatiquement aux prochaines sessions par chargerNotesEtCitations().
const TYPES_MÉMOIRE_NARRATIVE = [
  "fait_canonique", "decision_auteur", "arc", "etat_personnage", "relation",
  "promesse", "boucle_ouverte", "theme_motif", "vigilance", "fragment",
  "reference_recherche",
];

// "+ Ajouter à la mémoire" — 30/08/2026, demande explicite de l'auteur du
// projet : une intention déjà formée AILLEURS (relecture avec un autre
// outil, réflexion hors session) doit pouvoir entrer dans memoire_narrative
// sans passer par un faux dialogue avec le co-pilote juste pour déclencher
// "Mémoriser cette intention". Écrit directement en statut "validee" —
// contrairement à la distillation automatique (toujours "proposee"), une
// saisie manuelle EST déjà la décision de l'auteur·ice, il n'y a rien à
// confirmer après coup.
const OPTIONS_TYPE_MÉMOIRE = [
  { valeur: "fait_canonique", label: "Fait canonique (établi dans le texte)" },
  { valeur: "decision_auteur", label: "Décision de l'auteur·ice" },
  { valeur: "arc", label: "Arc / trajectoire" },
  { valeur: "etat_personnage", label: "État d'un personnage" },
  { valeur: "relation", label: "Relation entre personnages" },
  { valeur: "promesse", label: "Promesse narrative faite au lecteur" },
  { valeur: "boucle_ouverte", label: "Boucle ouverte à refermer" },
  { valeur: "theme_motif", label: "Thème / motif" },
  { valeur: "vigilance", label: "Point de vigilance" },
  { valeur: "fragment", label: "Fragment / idée encore floue" },
  { valeur: "reference_recherche", label: "Référence / recherche" },
];

function promptDistillerIntention(langueProjet) {
  const instruction = INSTRUCTION_LANGUE[langueProjet] || INSTRUCTION_LANGUE.fr;
  return `Tu résumes un échange entre un·e écrivain·e et son co-pilote IA en UNE note courte (1 à 3 phrases), destinée à être relue dans une future session SANS le contexte de cet échange. N'écris pas un résumé de la conversation — extrais la décision ou l'intention narrative concrète qui s'en dégage, formulée de façon autonome et actionnable (ex. "Scalpa est sublimé par le regard de Clara (narrateur externe) ; l'arc prévu va vers une réaction opposante de Clara — geste, retrait ou désaccord exprimé."). Classe aussi cette note dans EXACTEMENT une de ces catégories (${TYPES_MÉMOIRE_NARRATIVE.join(", ")}) — par exemple une trajectoire de personnage est "arc", un choix ferme de l'auteur·ice est "decision_auteur", un point de vigilance à surveiller est "vigilance", une idée encore floue est "fragment". ${instruction} Réponds UNIQUEMENT en JSON valide :
{"note":"...","type":"..."}`;
}

function BoutonDialogue({ ouvert, onClick, couleur }) {
  const { t } = useTranslation("copilote");
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11, lineHeight: 1, color: ouvert ? couleur : "#888",
        background: "transparent", border: "none",
        cursor: "pointer", fontFamily: "inherit",
        padding: "2px 4px", borderRadius: 4, flexShrink: 0,
      }}
      title={t("dialogue.ouvrir", "Poser une question sur ce point")}
    >
      💬
    </button>
  );
}

// Reconnaissance vocale native du navigateur — ajoutée le 10/08/2026. Chrome
// et Edge la supportent bien ; Firefox ne la supporte PAS du tout (API
// SpeechRecognition absente), Safari de façon partielle/peu fiable. Plutôt
// que d'afficher un bouton qui échouerait silencieusement sur Firefox
// (navigateur que Joseph utilise, voir le souci de molette déjà rencontré),
// le bouton ne s'affiche tout simplement pas si l'API est absente.
const LANGUE_RECONNAISSANCE = { fr: "fr-FR", en: "en-GB" };

function FilDialogue({ dialogue, onEnvoyer, couleur, langueProjet, onMémoriser, mémorisationEnCours }) {
  const { t } = useTranslation("copilote");
  const [saisie, setSaisie] = useState("");
  // Réf. 60816-01, suite, 30/08/2026 — demande explicite de l'auteur du
  // projet après un vrai test : le co-pilote n'a aucune mémoire d'une
  // session à l'autre, et redonner à la main le contexte narratif à chaque
  // fois ("réintroduire au fur et à mesure les infos en manuel") n'est pas
  // acceptable pour un travail qui s'étend sur plusieurs séances. Ce
  // bouton distille l'échange en une note courte, enregistrée dans le
  // Carnet d'idées du projet (table `idees`, déjà existante et déjà lue
  // par chargerNotesEtCitations) — relue automatiquement lors des
  // prochaines sessions, sans que l'auteur·ice ait à la retaper.
  const [vientDeMémoriser, setVientDeMémoriser] = useState(false);
  const [enÉcoute, setEnÉcoute] = useState(false);
  const zoneRef = useRef(null);
  const reconnaissanceRef = useRef(null);
  const texteAvantÉcouteRef = useRef("");

  const APIReconnaissance = typeof window !== "undefined"
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

  useEffect(() => {
    if (zoneRef.current) {
      zoneRef.current.style.height = "auto";
      zoneRef.current.style.height = `${Math.min(zoneRef.current.scrollHeight, 160)}px`;
    }
  }, [saisie]);

  // Coupe proprement le micro si la carte se ferme/démonte en cours d'écoute.
  useEffect(() => () => reconnaissanceRef.current?.stop(), []);

  const basculerMicro = () => {
    if (!APIReconnaissance) return;

    if (enÉcoute) {
      reconnaissanceRef.current?.stop();
      return;
    }

    const reco = new APIReconnaissance();
    reco.lang = LANGUE_RECONNAISSANCE[langueProjet] || "fr-FR";
    reco.continuous = true;
    reco.interimResults = true;
    texteAvantÉcouteRef.current = saisie ? `${saisie} ` : "";

    reco.onresult = (événement) => {
      let finalTexte = "";
      let intermédiaire = "";
      for (let i = événement.resultIndex; i < événement.results.length; i++) {
        const morceau = événement.results[i][0].transcript;
        if (événement.results[i].isFinal) finalTexte += morceau + " ";
        else intermédiaire += morceau;
      }
      if (finalTexte) texteAvantÉcouteRef.current += finalTexte;
      setSaisie(texteAvantÉcouteRef.current + intermédiaire);
    };
    reco.onerror = () => setEnÉcoute(false);
    reco.onend = () => setEnÉcoute(false);

    reconnaissanceRef.current = reco;
    reco.start();
    setEnÉcoute(true);
  };

  const envoyer = () => {
    const question = saisie.trim();
    if (!question || dialogue.enCours) return;
    reconnaissanceRef.current?.stop();
    setSaisie("");
    onEnvoyer(question);
  };

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `0.5px solid ${couleur}25` }}>
      {(dialogue.messages || []).map((m, i) => (
        <div key={i} style={{
          fontSize: 11.5, lineHeight: 1.5, marginBottom: 6,
          color: m.role === "auteur" ? "#1a1a1a" : "#555",
        }}>
          <span style={{ fontWeight: 600, color: m.role === "auteur" ? couleur : "#999" }}>
            {m.role === "auteur" ? t("dialogue.vous", "Vous") : t("dialogue.copilote", "Co-pilote")}
          </span>
          {" — "}{m.contenu}
          {/* CORRECTIF 30/08/2026, retour d'usage réel : une réponse coupée
              en plein milieu d'une phrase (max_tokens atteint) obligeait à
              retaper "continue !" à la main. Bouton dédié sur le DERNIER
              message seulement — voir tronqué côté appelClaude/
              envoyerQuestionDialogue. */}
          {m.role === "copilote" && m.tronqué && i === dialogue.messages.length - 1 && !dialogue.enCours && (
            <button
              onClick={() => onEnvoyer(null, true)}
              style={{
                display: "block", marginTop: 4, fontSize: 10.5, padding: "3px 9px",
                background: "transparent", color: couleur, border: `0.5px solid ${couleur}50`,
                borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              ↳ Continuer (réponse coupée)
            </button>
          )}
        </div>
      ))}

      {dialogue.enCours && (
        <div style={{ fontSize: 11, color: "#999", marginBottom: 6 }}>{t("bouton.enCours")}</div>
      )}
      {dialogue.erreur && (
        <div style={{ fontSize: 11, color: "#A32D2D", marginBottom: 6 }}>{dialogue.erreur}</div>
      )}

      {onMémoriser && (dialogue.messages || []).length > 0 && (
        <button
          onClick={async () => { await onMémoriser(); setVientDeMémoriser(true); setTimeout(() => setVientDeMémoriser(false), 2500); }}
          disabled={mémorisationEnCours}
          style={{
            fontSize: 10.5, padding: "3px 8px", marginBottom: 6, background: "transparent",
            color: vientDeMémoriser ? "#1D9E75" : "#888", border: `0.5px solid ${vientDeMémoriser ? "#1D9E75" : "#ccc"}`,
            borderRadius: 20, cursor: mémorisationEnCours ? "default" : "pointer", fontFamily: "inherit",
          }}
          title="Enregistre l'intention narrative de cet échange dans le Carnet d'idées du projet, relue automatiquement lors des prochaines sessions."
        >
          {mémorisationEnCours ? "…" : vientDeMémoriser ? "✓ Mémorisé dans le Carnet d'idées" : "💾 Mémoriser cette intention"}
        </button>
      )}

      {/* Cadre renforcé — fond distinct + bordure colorée, pour que le champ
          de question soit clairement identifiable comme une zone active,
          pas un simple filet gris parmi le reste de la carte. */}
      <div style={{
        background: `${couleur}08`, border: `1px solid ${couleur}40`,
        borderRadius: 8, padding: 6,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
          <textarea
            ref={zoneRef}
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                envoyer();
              }
            }}
            placeholder={t("dialogue.placeholder", "Qu'aimeriez-vous voir préciser ?")}
            disabled={dialogue.enCours}
            rows={1}
            style={{
              flex: 1, fontSize: 12.5, padding: "6px 8px",
              border: "none", background: "transparent",
              fontFamily: "inherit", outline: "none",
              resize: "none", overflow: "hidden",
              boxSizing: "border-box", lineHeight: 1.5,
              display: "block",
            }}
          />
          {APIReconnaissance && (
            <button
              onClick={basculerMicro}
              disabled={dialogue.enCours}
              title={enÉcoute ? t("dialogue.microArreter", "Arrêter la dictée") : t("dialogue.micro", "Dicter la question")}
              style={{
                flexShrink: 0, fontSize: 14, lineHeight: 1,
                width: 26, height: 26, borderRadius: "50%",
                border: "none", cursor: dialogue.enCours ? "default" : "pointer",
                background: enÉcoute ? "#E24B4A" : "transparent",
                color: enÉcoute ? "#fff" : couleur,
                fontFamily: "inherit", marginTop: 2,
                animation: enÉcoute ? "pulseMicro 1.2s ease-in-out infinite" : "none",
              }}
            >
              🎙️
            </button>
          )}
        </div>
        <style>{`@keyframes pulseMicro{0%,100%{opacity:1}50%{opacity:0.55}}`}</style>
        {enÉcoute && (
          <div style={{ fontSize: 10.5, color: "#E24B4A", marginTop: 2 }}>
            {t("dialogue.enEcoute", "🔴 À l'écoute…")}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <button
            onClick={envoyer}
            disabled={dialogue.enCours || !saisie.trim()}
            style={{
              fontSize: 11.5, padding: "6px 14px", borderRadius: 6, border: "none",
              background: couleur, color: "#fff", fontFamily: "inherit",
              cursor: (dialogue.enCours || !saisie.trim()) ? "default" : "pointer",
              opacity: (dialogue.enCours || !saisie.trim()) ? 0.5 : 1,
            }}
          >
            {t("dialogue.envoyer", "Envoyer")}
          </button>
        </div>
      </div>
    </div>
  );
}



function CarteSuggestion({ s, couleur, cléCarte, dialogue, onOuvrirDialogue, onEnvoyerQuestion, langueProjet, onMémoriserCarte, mémorisationEnCours }) {
  const icônes = { suite: "→", approfondissement: "↓", reformulation: "↺", structure: "⊞", transition: "⤷", ouverture: "✍️", angle: "🎯", question: "❓" };
  return (
    <div style={{ background: "#fff", border: `0.5px solid ${couleur}30`, borderLeft: `3px solid ${couleur}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
        <div style={{ fontSize: 10, color: couleur, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{icônes[s.type] || "→"} {s.type}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <BoutonCopier texte={`${s.titre}\n\n${s.texte}`} couleur={couleur} />
          <BoutonDialogue ouvert={dialogue?.ouvert} couleur={couleur}
            onClick={() => onOuvrirDialogue(cléCarte, `${s.titre}\n${s.texte}`)} />
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, color: "#1a1a1a", marginBottom: 4 }}>{s.titre}</div>
      <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>{s.texte}</div>
      {dialogue?.ouvert && <FilDialogue dialogue={dialogue} couleur={couleur} langueProjet={langueProjet} onEnvoyer={(q, continuer) => onEnvoyerQuestion(cléCarte, q, continuer)} onMémoriser={onMémoriserCarte ? () => onMémoriserCarte(cléCarte, `${s.titre}\n${s.texte}`) : null} mémorisationEnCours={mémorisationEnCours?.[cléCarte]} />}
    </div>
  );
}

function CartePersonnage({ p, cléCarte, dialogue, onOuvrirDialogue, onEnvoyerQuestion, langueProjet, onMémoriserCarte, mémorisationEnCours }) {
  const c = { ok: "#1D9E75", attention: "#BA7517", problème: "#E24B4A" }[p.cohérence] || "#888";
  const texteÀCopier = [
    p.nom,
    p.rôle,
    p.traits?.length ? `Traits : ${p.traits.join(", ")}` : null,
    p.note || null,
  ].filter(Boolean).join("\n");
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4, gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{p.nom}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: c + "20", color: c, fontWeight: 500 }}>{p.cohérence}</span>
          <BoutonCopier texte={texteÀCopier} couleur={c} />
          <BoutonDialogue ouvert={dialogue?.ouvert} couleur={c}
            onClick={() => onOuvrirDialogue(cléCarte, texteÀCopier)} />
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{p.rôle}</div>
      {p.traits?.map(t => <span key={t} style={{ display: "inline-block", fontSize: 10, padding: "1px 6px", borderRadius: 20, background: "#f0f0f0", color: "#666", marginRight: 4 }}>{t}</span>)}
      {p.note && <div style={{ fontSize: 11, color: c, marginTop: 4 }}>{p.note}</div>}
      {dialogue?.ouvert && <FilDialogue dialogue={dialogue} couleur={c} langueProjet={langueProjet} onEnvoyer={(q, continuer) => onEnvoyerQuestion(cléCarte, q, continuer)} onMémoriser={onMémoriserCarte ? () => onMémoriserCarte(cléCarte, texteÀCopier) : null} mémorisationEnCours={mémorisationEnCours?.[cléCarte]} />}
    </div>
  );
}

// Statut de vérification — ajouté 02/08/2026, à la demande de Joseph : une
// référence ne doit JAMAIS être affichée avec le même niveau de confiance
// visuelle selon qu'elle a été réellement vérifiée par recherche web ou
// non. Le badge est toujours visible sur la carte elle-même, jamais relégué
// en petite note — un statut inconnu (données plus anciennes, avant ce
// chantier) retombe sur "non vérifié" plutôt que d'être traité comme fiable
// par défaut.
const STATUT_RÉFÉRENCE = {
  vérifié: { c: "#1D9E75", bg: "#E1F5EE", label: "✓ Vérifié" },
  détail_non_confirmé: { c: "#BA7517", bg: "#FAEEDA", label: "◐ Ouvrage vérifié, détail non confirmé" },
  non_trouvé: { c: "#A32D2D", bg: "#FCEBEB", label: "✕ Non trouvé — piste seulement" },
};
const STATUT_PAR_DÉFAUT = { c: "#888", bg: "#f0f0f0", label: "? Non vérifié" };

function CarteRéférence({ r }) {
  const { t } = useTranslation("copilote");
  const [copié, setCopié] = useState(false);
  const s = STATUT_RÉFÉRENCE[r.statut] || STATUT_PAR_DÉFAUT;
  const nonTrouvée = r.statut === "non_trouvé";
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e5e5", borderLeft: `3px solid ${s.c}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase" }}>{r.concept}</span>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: s.bg, color: s.c, whiteSpace: "nowrap" }}>{s.label}</span>
      </div>
      {!nonTrouvée && r.apa && (
        <div style={{ background: "#E6F1FB", borderRadius: 6, padding: "8px 10px", marginBottom: 6, fontSize: 12, color: "#0C447C", fontFamily: "Georgia, serif", lineHeight: 1.6 }}>{r.apa}</div>
      )}
      {r.statut === "vérifié" && r.page && <div style={{ fontSize: 11, color: "#185FA5", marginBottom: 4 }}>{t("references.pageSuggeree", { page: r.page })}</div>}
      <div style={{ fontSize: 11, color: "#777", marginBottom: 6 }}>{r.pertinence}</div>
      {!nonTrouvée && r.apa && (
        <button onClick={() => { navigator.clipboard?.writeText(r.apa); setCopié(true); setTimeout(() => setCopié(false), 2000); }}
          style={{ fontSize: 11, color: copié ? "#1D9E75" : "#185FA5", background: copié ? "#E1F5EE" : "#E6F1FB", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>
          {copié ? t("references.copie") : t("references.copier")}
        </button>
      )}
    </div>
  );
}

function CarteCoherence({ p, cléCarte, dialogue, onOuvrirDialogue, onEnvoyerQuestion, langueProjet, onMémoriserCarte, mémorisationEnCours }) {
  const s = { info: { c: "#378ADD", bg: "#E6F1FB" }, attention: { c: "#BA7517", bg: "#FAEEDA" }, important: { c: "#E24B4A", bg: "#FCEBEB" } }[p.sévérité] || { c: "#888", bg: "#f0f0f0" };
  const texteÀCopier = [
    `[${p.sévérité}] ${p.type}`,
    p.description,
    p.suggestion ? `Suggestion : ${p.suggestion}` : null,
  ].filter(Boolean).join("\n");
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <div>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: s.bg, color: s.c, fontWeight: 500, marginRight: 6 }}>{p.sévérité}</span>
          <span style={{ fontSize: 11, color: "#999" }}>{p.type}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <BoutonCopier texte={texteÀCopier} couleur={s.c} />
          <BoutonDialogue ouvert={dialogue?.ouvert} couleur={s.c}
            onClick={() => onOuvrirDialogue(cléCarte, texteÀCopier)} />
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#1a1a1a", margin: "6px 0", lineHeight: 1.6 }}>{p.description}</div>
      {p.suggestion && <div style={{ fontSize: 12, color: "#1D9E75", fontStyle: "italic" }}>💡 {p.suggestion}</div>}
      {dialogue?.ouvert && <FilDialogue dialogue={dialogue} couleur={s.c} langueProjet={langueProjet} onEnvoyer={(q, continuer) => onEnvoyerQuestion(cléCarte, q, continuer)} onMémoriser={onMémoriserCarte ? () => onMémoriserCarte(cléCarte, texteÀCopier) : null} mémorisationEnCours={mémorisationEnCours?.[cléCarte]} />}
    </div>
  );
}

// Affiche le résultat de verification-deux-ia (protocole 60805-06) — objet
// structuré, pas un tableau de cartes comme les autres onglets. Gère les deux
// formes de réponse possibles : la sortie complète (verdict_passage + 4
// catégories hiérarchisées), ou l'arrêt anticipé pour contexte insuffisant
// (verdict: "verdict_provisoire" au premier niveau, voir le protocole).
function PanneauVerification({ résultat }) {
  if (résultat?.verdict === "verdict_provisoire" && !("verdict_passage" in résultat)) {
    return (
      <div style={{ background: "#f5f5f5", border: "0.5px solid #e5e5e5", borderRadius: 8, padding: "12px 14px", fontSize: 12, color: "#555", lineHeight: 1.6 }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: "#854F0B" }}>⏸️ Vérification incomplète</div>
        <div>{résultat.raison}</div>
        {résultat.recommandation && <div style={{ marginTop: 6, fontStyle: "italic" }}>{résultat.recommandation}</div>}
      </div>
    );
  }

  const VERDICTS = {
    recevable: { label: "Recevable", c: "#1D9E75", bg: "#EAF3DE" },
    recevable_avec_reserves: { label: "Recevable avec réserves", c: "#BA7517", bg: "#FAEEDA" },
    correction_recommandee: { label: "Correction recommandée", c: "#A32D2D", bg: "#FCEBEB" },
    verdict_provisoire: { label: "Verdict provisoire", c: "#888", bg: "#f0f0f0" },
  };
  const v = VERDICTS[résultat.verdict_passage] || VERDICTS.verdict_provisoire;

  const SECTIONS = [
    { cle: "valeur_ajoutee_editoriale", titre: "Valeur ajoutée éditoriale", c: "#7F77DD", bg: "#F1EFFB", accent: true },
    { cle: "corrections_probables", titre: "Corrections probables", c: "#378ADD", bg: "#E6F1FB" },
    { cle: "alertes_a_verifier_sur_source", titre: "À vérifier sur le document source", c: "#BA7517", bg: "#FAEEDA" },
    { cle: "remarques_non_bloquantes", titre: "Remarques non bloquantes", c: "#999", bg: "#f5f5f5" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: v.bg, color: v.c, fontWeight: 600 }}>{v.label}</span>
        {typeof résultat.couverture_manuscrit === "number" && (
          <span style={{ fontSize: 10, color: "#999" }}>Couverture manuscrit : {Math.round(résultat.couverture_manuscrit * 100)}%</span>
        )}
      </div>

      {résultat.reponse_optimale_auteur && (
        <div style={{ fontSize: 12, color: "#1a1a1a", lineHeight: 1.6, marginBottom: 12, background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 8, padding: "10px 12px" }}>
          {résultat.reponse_optimale_auteur}
        </div>
      )}

      {SECTIONS.map(s => {
        const items = résultat[s.cle];
        if (!Array.isArray(items) || items.length === 0) return null;
        return (
          <div key={s.cle} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: s.c, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.3 }}>
              {s.accent && "★ "}{s.titre}
            </div>
            {items.map((texte, i) => (
              <div key={i} style={{ background: s.bg, borderRadius: 7, padding: "8px 10px", marginBottom: 5, fontSize: 12, color: "#1a1a1a", lineHeight: 1.5 }}>
                {texte}
              </div>
            ))}
          </div>
        );
      })}

      {!résultat.contexte_suffisant && (
        <div style={{ fontSize: 10.5, color: "#999", marginTop: 4, fontStyle: "italic" }}>
          Contexte du projet jugé partiel au moment de l'analyse.
        </div>
      )}
    </div>
  );
}

// "Aide-moi à avancer" — réf. 60816-01, suite, 30/08/2026 (voir
// PROMPTS.jeSuisBloqué et SUIVIS_BLOCAGE côté composant). Le diagnostic est
// une HYPOTHÈSE à confirmer, pas une vérité imposée — "Oui, aide-moi" /
// "Non, c'est autre chose" (voir confirmationBlocage) précèdent les 5
// suivis, qui restent masqués tant que l'hypothèse n'est pas confirmée. Un
// rejet ouvre une zone de précision et relance un nouveau diagnostic avec
// ce complément — jamais d'insistance sur une hypothèse déjà écartée.
//
// CORRECTIF 30/08/2026 (retour d'usage réel — "Questionne-moi" répondait
// "tu ne m'as pas encore soumis de passage à analyser") : contrairement aux
// autres cartes (CarteSuggestion, CartePersonnage...) où `contexteCarte`
// EST le contenu à discuter, le `diagnostic` d'un blocage n'est qu'un
// résumé d'une phrase — le passage réellement analysé n'y était jamais
// inclus, donc le fil de dialogue n'avait rien de concret à exploiter pour
// poser des questions ciblées. `construireContexteDialogueBlocage` inclut
// désormais le passage analysé lui-même, capturé au moment du diagnostic.
function construireContexteDialogueBlocage(diagnostic, texteAnalysé) {
  return `Passage analysé :\n"""\n${(texteAnalysé || "").trim() || "(chapitre/scène encore vide au moment du diagnostic)"}\n"""\n\nDiagnostic du co-pilote : ${diagnostic.diagnostic}`;
}

function CarteBlocage({
  diagnostic, texteAnalysé, confirmation, onConfirmer, onRejeter,
  complément, onChangerComplément, onRelancer, chargement,
  suivis, onSuivi, dialogue, onOuvrirDialogue, onEnvoyerQuestion, couleur, langueProjet,
  onMémoriser, mémorisationEnCours, historique,
}) {
  return (
    <div style={{ background: "#fff", border: `0.5px solid ${couleur}40`, borderLeft: `3px solid ${couleur}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
      {historique?.length > 0 && (
        <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: "0.5px solid #eee" }}>
          {historique.map((h, i) => (
            <div key={i} style={{ fontSize: 11, color: "#999", lineHeight: 1.5, marginBottom: i < historique.length - 1 ? 8 : 0 }}>
              <div>🛟 <em>Hypothèse écartée :</em> {h.diagnostic.diagnostic}</div>
              <div>↳ <em>Ta précision :</em> {h.complément}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: couleur, fontWeight: 600, textTransform: "uppercase" }}>🛟 {diagnostic.type_blocage || "hypothèse"}</div>
        <BoutonDialogue ouvert={dialogue?.ouvert} couleur={couleur}
          onClick={() => onOuvrirDialogue(construireContexteDialogueBlocage(diagnostic, texteAnalysé))} />
      </div>
      <div style={{ fontSize: 12.5, color: "#1a1a1a", lineHeight: 1.6, marginBottom: 10 }}>{diagnostic.diagnostic}</div>

      {confirmation === null && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onConfirmer} style={{
            fontSize: 11.5, padding: "6px 12px", background: couleur, color: "#fff",
            border: "none", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
          }}>
            Oui, aide-moi
          </button>
          <button onClick={onRejeter} style={{
            fontSize: 11.5, padding: "6px 12px", background: "transparent", color: "#888",
            border: "0.5px solid #ccc", borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
          }}>
            Non, c'est autre chose
          </button>
        </div>
      )}

      {confirmation === false && (
        <div>
          <textarea
            value={complément}
            onChange={(e) => onChangerComplément(e.target.value)}
            placeholder="Dis-moi ce qui se passe réellement…"
            style={{
              width: "100%", minHeight: 60, padding: "6px 8px", fontSize: 12, fontFamily: "inherit",
              border: `0.5px solid ${couleur}30`, borderRadius: 7, resize: "vertical", boxSizing: "border-box",
            }}
          />
          <button onClick={onRelancer} disabled={chargement || !complément.trim()} style={{
            width: "100%", marginTop: 6, padding: "7px", background: `${couleur}15`, color: couleur,
            border: `0.5px solid ${couleur}30`, borderRadius: 7, fontSize: 12, fontWeight: 500,
            cursor: (chargement || !complément.trim()) ? "default" : "pointer", fontFamily: "inherit",
          }}>
            {chargement ? "…" : "Nouveau diagnostic"}
          </button>
        </div>
      )}

      {confirmation === true && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {suivis.map((s) => (
            <button key={s.id} onClick={() => onSuivi(s.message)} style={{
              fontSize: 11, padding: "5px 10px", background: `${couleur}12`, color: couleur,
              border: `0.5px solid ${couleur}30`, borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
            }}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {dialogue?.ouvert && <FilDialogue dialogue={dialogue} couleur={couleur} langueProjet={langueProjet} onEnvoyer={onEnvoyerQuestion} onMémoriser={onMémoriser} mémorisationEnCours={mémorisationEnCours} />}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CopiloteIA({ texteActif = "", texteSélectionné = "", typeProjet = "non-fiction", couleurProjet = "#7F77DD", projetTitre = "", titreNœud = "", typeNœud = "chapitre", titresEnfants = [], titrePartieParente = null, titresChapitresVoisins = [], langueProjet = "fr", projetId = null, nœudId = null, onDemanderUpgrade = null }) {
  const { t } = useTranslation("copilote");
  const [contexteADNBrut, setContexteADNBrut] = useState(null);
  // Réf. 60816-01, suite, 30/08/2026 — demande explicite de l'auteur du
  // projet : le co-pilote n'avait aucune mémoire d'une session à l'autre,
  // obligeant à retaper les intentions narratives à chaque fois. Le Carnet
  // d'idées du projet (table `idees`, déjà lu par chargerNotesEtCitations
  // pour l'aide au démarrage d'une scène) est désormais chargé une fois ici
  // et injecté dans TOUT prompt qui reçoit `contexteADN` — pas seulement au
  // démarrage d'une scène — via le useMemo `contexteADN` plus bas. Voir
  // "💾 Mémoriser cette intention" dans FilDialogue pour l'écriture.
  const [notesProjet, setNotesProjet] = useState(null);
  const contexteADN = useMemo(() => {
    if (!contexteADNBrut && !notesProjet) return null;
    return [
      contexteADNBrut,
      notesProjet ? `NOTES ET IDÉES DÉJÀ ENREGISTRÉES POUR CE PROJET (Carnet d'idées — mémoire des sessions précédentes, à prendre en compte) :\n${notesProjet}` : null,
    ].filter(Boolean).join("\n\n");
  }, [contexteADNBrut, notesProjet]);
  // Consommation IA réelle du compte (60803-03) — remontée par
  // CompteurUsageIA, sert à désactiver le bouton d'analyse une fois le
  // quota du palier épuisé (le compteur affiche lui-même l'avertissement
  // et le recouvrement bloquant, pas besoin de les dupliquer ici).
  const [usageIA, setUsageIA] = useState(null);
  const usageBloqué = usageIA ? usageIA.disponible <= 0 : false;
  // true = analyser uniquement le passage surligné dans l'éditeur, s'il y en a un.
  // S'active automatiquement dès qu'une sélection substantielle apparaît (pour
  // que le comportement par défaut soit intuitif), mais reste modifiable par
  // l'auteur. Ajouté le 16/07/2026, en réponse au constat que le texte était
  // silencieusement tronqué à 4000 caractères pour les longs chapitres.
  const [analyserSélection, setAnalyserSélection] = useState(false);

  useEffect(() => {
    if (texteSélectionné && texteSélectionné.trim().length > 20) {
      setAnalyserSélection(true);
    } else if (!texteSélectionné) {
      setAnalyserSélection(false);
    }
  }, [texteSélectionné]);

  useEffect(() => {
    let annulé = false;
    chargerContexteADN(projetId).then((c) => { if (!annulé) setContexteADNBrut(c); });
    chargerNotesEtCitations(projetId).then((n) => { if (!annulé) setNotesProjet(n); });
    return () => { annulé = true; };
  }, [projetId]);
  const [onglet, setOnglet] = useState("suggestions");
  const [données, setDonnées] = useState({ suggestions: null, personnages: null, références: null, cohérence: null, vérification: null });
  const [chargement, setChargement] = useState({});
  const [erreur, setErreur] = useState({});
  // CORRECTIF 30/08/2026, signalé par Joseph : une erreur restait affichée
  // indéfiniment en revenant sur un onglet, même après avoir changé la
  // sélection ou réduit un texte trop long — puisque rien ne l'effaçait
  // avant qu'une NOUVELLE analyse soit relancée, et que "Analyser
  // maintenant" est justement désactivé tant que le texte dépasse le seuil
  // (voir texteTropVolumineux plus bas). Une erreur qui parlait d'un texte
  // qui n'existe plus n'a plus de raison de rester à l'écran.
  useEffect(() => {
    // Ne déclenche un re-rendu que s'il y avait effectivement une erreur à
    // effacer — texteActif change à chaque frappe, inutile de re-rendre à
    // chaque caractère tapé quand il n'y a rien à nettoyer.
    setErreur((e) => (Object.keys(e).length ? {} : e));
  }, [analyserSélection, texteSélectionné, texteActif]);
  const [modeAuto, setModeAuto] = useState(false);
  const [dernièreAnalyse, setDernièreAnalyse] = useState(null);
  const abortRef = useRef(null);
  const intervalRef = useRef(null);

  // ── Dialogue par carte — voir note au-dessus de DIALOGUE_MAX_TOKENS ──
  // Clé = `${onglet}:${index}` — les fils de dialogue appartiennent à une
  // instance précise d'analyse : relancer l'analyse remplace les cartes et
  // donc implicitement leurs fils (comportement voulu, pas un oubli : un
  // fil discuté porte sur UNE analyse donnée, pas sur "la carte n°2" dans
  // l'absolu).
  const [dialogues, setDialogues] = useState({});

  const messageErreur = useCallback((err) => {
    if (err.message === "SESSION_EXPIREE") return t("erreur.sessionExpiree");
    if (err.message === "__ERREUR_GENERIQUE__") return t("erreur.generique");
    return err.message;
  }, [t]);

  const ouvrirDialogue = useCallback((cléCarte, contexteCarte) => {
    setDialogues((d) => {
      const existant = d[cléCarte];
      if (existant) return { ...d, [cléCarte]: { ...existant, ouvert: !existant.ouvert } };
      return { ...d, [cléCarte]: { ouvert: true, contexteCarte, messages: [], enCours: false, erreur: null } };
    });
  }, []);

  const envoyerQuestionDialogue = useCallback(async (cléCarte, question, estContinuation = false) => {
    setDialogues((d) => ({
      ...d,
      [cléCarte]: {
        ...d[cléCarte],
        enCours: true,
        erreur: null,
        // En continuation, aucune nouvelle intervention "auteur" à afficher —
        // seule la réponse coupée doit se poursuivre.
        messages: estContinuation
          ? (d[cléCarte]?.messages || [])
          : [...(d[cléCarte]?.messages || []), { role: "auteur", contenu: question }],
      },
    }));

    try {
      const état = dialogues[cléCarte];
      const messagesActuels = état?.messages || [];
      const historique = (estContinuation ? messagesActuels : [...messagesActuels, { role: "auteur", contenu: question }])
        .map((m) => `${m.role === "auteur" ? "Auteur" : "Co-pilote"} : ${m.contenu}`)
        .join("\n");
      const consigneContinuation = estContinuation
        ? "\n\n(Ta réponse précédente a été coupée par la limite de longueur, en plein milieu d'une phrase. Continue exactement là où tu t'es arrêté, sans rien répéter de ce qui précède.)"
        : "";
      const userContent = `Analyse initiale du co-pilote :\n"""\n${état?.contexteCarte || ""}\n"""\n\nÉchange avec l'auteur :\n${historique}${consigneContinuation}`;

      const { texte, tronqué } = await appelClaude(
        promptDialogue(langueProjet),
        userContent,
        null,
        DIALOGUE_MAX_TOKENS,
        null,
        true
      );

      setDialogues((d) => ({
        ...d,
        [cléCarte]: {
          ...d[cléCarte],
          enCours: false,
          messages: [...(d[cléCarte]?.messages || []), { role: "copilote", contenu: texte.trim(), tronqué }],
        },
      }));
    } catch (err) {
      setDialogues((d) => ({
        ...d,
        [cléCarte]: { ...d[cléCarte], enCours: false, erreur: messageErreur(err) },
      }));
    }
  }, [dialogues, langueProjet, messageErreur]);

  // "💾 Mémoriser cette intention" — réf. 60816-01, suite, 30/08/2026, voir
  // le commentaire sur notesProjet/contexteADN plus haut. Distille le
  // diagnostic + fil de discussion d'UNE carte en une note courte typée,
  // l'enregistre dans memoire_narrative (statut "proposee" — jamais validée
  // automatiquement, voir memoire_narrative.sql), et l'ajoute immédiatement
  // à `notesProjet` en mémoire (mise à jour optimiste) pour qu'elle serve
  // dès la prochaine analyse de CETTE session, sans attendre un
  // rechargement complet de la page.
  const [mémorisationEnCoursParCarte, setMémorisationEnCoursParCarte] = useState({});
  const mémoriserIntention = useCallback(async (cléCarte, contexteCarte) => {
    setMémorisationEnCoursParCarte((m) => ({ ...m, [cléCarte]: true }));
    try {
      const état = dialogues[cléCarte];
      const historique = (état?.messages || [])
        .map((m) => `${m.role === "auteur" ? "Auteur" : "Co-pilote"} : ${m.contenu}`)
        .join("\n");
      const contenuÀDistiller = `Analyse ou diagnostic d'origine :\n${contexteCarte}` + (historique ? `\n\nÉchange :\n${historique}` : "");
      const résultat = await appelClaude(promptDistillerIntention(langueProjet), contenuÀDistiller, null, 300);
      const p = parserJSON(résultat);
      if (p.note) {
        const type = TYPES_MÉMOIRE_NARRATIVE.includes(p.type) ? p.type : "fragment";
        // Même lien automatique vers le chapitre/scène actif que
        // ajouterMémoireManuelle — voir ce commentaire pour le détail.
        const { data } = await mémoireNarrativeAPI.créer({
          type, contenu: p.note, statut: "proposee", sourceType: "copiloteia",
          portée: nœudId ? { noeud_id: nœudId, noeud_titre: titreNœud || null } : {},
          projetId,
        });
        setNotesProjet((n) => {
          const ligne = `- [${type}] ${p.note} (proposée, non confirmée par l'auteur·ice)`;
          return n ? `${n}\n${ligne}` : ligne;
        });
        if (data) setMémoireListe((liste) => (liste === null ? liste : [data, ...liste]));
      }
    } catch {
      // Non bloquant — l'auteur·ice peut toujours noter lui-même dans le
      // Carnet d'idées si la distillation échoue ; pas la peine d'afficher
      // une erreur pour une action de confort.
    } finally {
      setMémorisationEnCoursParCarte((m) => ({ ...m, [cléCarte]: false }));
    }
  }, [dialogues, langueProjet, projetId, nœudId, titreNœud]);

  // "+ Ajouter à la mémoire" — voir OPTIONS_TYPE_MÉMOIRE plus haut. Écriture
  // directe dans memoire_narrative, sans appel IA de distillation : l'auteur
  // a déjà formulé lui-même le contenu et le type.
  const [ajoutMémoireOuvert, setAjoutMémoireOuvert] = useState(false);
  const [nouvelleMémoireType, setNouvelleMémoireType] = useState("vigilance");
  const [nouvelleMémoireContenu, setNouvelleMémoireContenu] = useState("");
  const [ajoutMémoireEnCours, setAjoutMémoireEnCours] = useState(false);
  // CORRECTIF 30/08/2026, signalé par Joseph : un échec d'enregistrement
  // était totalement silencieux — le formulaire ne se refermait pas, mais
  // rien n'indiquait qu'une sauvegarde avait échoué. Une action explicite
  // de saisie manuelle doit toujours confirmer ou expliquer son échec.
  const [ajoutMémoireErreur, setAjoutMémoireErreur] = useState(null);
  const ajouterMémoireManuelle = useCallback(async () => {
    if (!nouvelleMémoireContenu.trim() || !projetId) return;
    setAjoutMémoireEnCours(true);
    setAjoutMémoireErreur(null);
    try {
      // CORRECTIF 30/08/2026, signalé par Joseph : mémoireNarrativeAPI.créer
      // renvoie { data, error } (convention Supabase — n'échoue PAS en
      // levant une exception), mais seul `data` était lu ici. Un refus
      // silencieux (table absente, permissions...) laissait `data` à null
      // SANS jamais passer par le `catch` — le formulaire se refermait et
      // se vidait comme si tout s'était bien passé, alors que rien n'avait
      // été enregistré. `error` doit être vérifié explicitement.
      const { data, error } = await mémoireNarrativeAPI.créer({
        type: nouvelleMémoireType,
        contenu: nouvelleMémoireContenu.trim(),
        statut: "validee",
        sourceType: "auteur",
        // Lie automatiquement l'entrée au chapitre/scène actif — demande de
        // l'auteur du projet, 30/08/2026 : sans ça, une mémoire ajoutée à
        // propos d'un passage précis flotte sans lien retrouvable vers ce
        // passage. `noeud_id`/`noeud_titre` dans `portee` (JSONB flexible,
        // voir memoire_narrative.sql) permettent de le retrouver plus tard,
        // sans aucune saisie supplémentaire côté auteur·ice.
        portée: nœudId ? { noeud_id: nœudId, noeud_titre: titreNœud || null } : {},
        projetId,
      });
      if (error) throw error;
      setNotesProjet((n) => {
        const ligne = `- [${nouvelleMémoireType}] ${nouvelleMémoireContenu.trim()}`;
        return n ? `${n}\n${ligne}` : ligne;
      });
      // Garde la liste "🧠 Voir la mémoire" à jour si elle a déjà été
      // chargée une fois, sans requête supplémentaire.
      if (data) setMémoireListe((liste) => (liste === null ? liste : [data, ...liste]));
      setNouvelleMémoireContenu("");
      setAjoutMémoireOuvert(false);
    } catch (err) {
      setAjoutMémoireErreur(err?.message || "Échec de l'enregistrement — réessaie, ou vérifie que la table memoire_narrative existe.");
    } finally {
      setAjoutMémoireEnCours(false);
    }
  }, [nouvelleMémoireType, nouvelleMémoireContenu, projetId, nœudId, titreNœud]);

  // "🧠 Voir la mémoire" — demande de Joseph, 30/08/2026 : la mémoire
  // n'existait jusqu'ici que côté prompts (injectée silencieusement dans
  // contexteADN), sans aucun moyen pour l'auteur·ice de relire, valider ou
  // rejeter ce qui y est enregistré. Chargée à la demande (pas au montage
  // du panneau, pour ne pas ajouter une requête systématique) ; filtrée par
  // défaut sur le chapitre/scène ouvert (voir `portee.noeud_id`, ajouté
  // juste avant), avec bascule vers tout le projet.
  const [mémoireListeOuverte, setMémoireListeOuverte] = useState(false);
  const [mémoireListe, setMémoireListe] = useState(null);
  const [mémoireListeChargement, setMémoireListeChargement] = useState(false);
  const [mémoireListeErreur, setMémoireListeErreur] = useState(null);
  const [mémoireToutLeProjet, setMémoireToutLeProjet] = useState(false);

  const chargerMémoireListe = useCallback(async () => {
    if (!projetId) return;
    setMémoireListeChargement(true);
    setMémoireListeErreur(null);
    try {
      const { data, error } = await mémoireNarrativeAPI.parProjet(projetId);
      if (error) throw error;
      setMémoireListe(data || []);
    } catch {
      setMémoireListeErreur(t("erreur.generique"));
    } finally {
      setMémoireListeChargement(false);
    }
  }, [projetId, t]);

  const basculerListeMémoire = useCallback(() => {
    setMémoireListeOuverte((o) => {
      const prochainÉtat = !o;
      if (prochainÉtat && mémoireListe === null) chargerMémoireListe();
      return prochainÉtat;
    });
  }, [mémoireListe, chargerMémoireListe]);

  const changerStatutMémoire = useCallback(async (id, statut) => {
    setMémoireListe((liste) => (liste || []).map((m) => (m.id === id ? { ...m, statut } : m)));
    try {
      // Même bug potentiel que ajouterMémoireManuelle : màjStatut renvoie
      // { data, error } sans lever d'exception — `error` doit être vérifié
      // explicitement, sinon un refus silencieux laisse la mise à jour
      // optimiste affichée comme si elle avait réussi.
      const { error } = await mémoireNarrativeAPI.màjStatut(id, statut);
      if (error) throw error;
    } catch {
      chargerMémoireListe(); // resynchronise en cas d'échec de la mise à jour optimiste
    }
  }, [chargerMémoireListe]);

  // "Conseils de recomposition" — réf. 60816-01, suite, 30/08/2026. Analyse
  // un chapitre ENTIER (pas seulement les 8000 premiers caractères) en le
  // découpant en tranches chevauchantes (voir découperEnTranches), puis
  // fusionne les résultats — sans jamais résumer le texte source, et sans
  // avoir à le faire à la main tranche par tranche. V1 volontairement
  // resserrée : la double vérification GPT et le contrôle du texte
  // recomposé APRÈS application restent différés à une itération suivante
  // (voir le registre) — même principe que memoire_narrative V1, tester la
  // version simple avant d'ajouter la couche suivante.
  //
  // Pas de garde-fou anti-boucle façon préaudit ici : contrairement à un
  // appel qui peut être relancé automatiquement en cas d'échec, ceci est
  // une séquence FINIE d'appels déclenchée une seule fois par clic, sans
  // retry automatique — le risque de dérive de coût qui justifiait ce
  // garde-fou ne s'applique pas à ce mécanisme.
  const [recompositionPoints, setRecompositionPoints] = useState(null);
  const [recompositionChargement, setRecompositionChargement] = useState(false);
  const [recompositionProgression, setRecompositionProgression] = useState(null);
  const [recompositionErreur, setRecompositionErreur] = useState(null);

  const lancerConseilsRecomposition = useCallback(async () => {
    setRecompositionChargement(true);
    setRecompositionErreur(null);
    setRecompositionPoints(null);
    try {
      const { texte } = extraireTexte(texteActif);
      if (compterMots(texteActif) < 20) {
        throw new Error(t("erreur.motsInsuffisants"));
      }
      const tranches = découperEnTranches(texte);
      const résultatsParTranche = [];
      for (let i = 0; i < tranches.length; i++) {
        setRecompositionProgression(tranches.length > 1 ? `Tranche ${i + 1}/${tranches.length}…` : "Analyse en cours…");
        const résultat = await appelClaude(
          systemAvecLangue(PROMPTS.recomposition(typeProjet), langueProjet, contexteADN),
          `Tranche ${i + 1}/${tranches.length} du chapitre :\n\n${tranches[i]}`,
          null, 4096
        );
        const p = parserJSON(résultat);
        résultatsParTranche.push(...(p.points || []));
      }

      let pointsFinaux = résultatsParTranche;
      if (tranches.length > 1) {
        setRecompositionProgression("Fusion des résultats…");
        const résultatSynthèse = await appelClaude(
          systemAvecLangue(PROMPTS.synthèseRecomposition(typeProjet), langueProjet, contexteADN),
          `Listes à fusionner :\n\n${JSON.stringify({ points: résultatsParTranche })}`,
          null, 4096
        );
        const synthèse = parserJSON(résultatSynthèse);
        pointsFinaux = synthèse.points || résultatsParTranche;
      }

      setRecompositionPoints(pointsFinaux);
    } catch (err) {
      setRecompositionErreur(messageErreur(err));
    } finally {
      setRecompositionChargement(false);
      setRecompositionProgression(null);
    }
  }, [texteActif, typeProjet, langueProjet, contexteADN, t, messageErreur]);

  const analyser = useCallback(async (ongletCible) => {
    const sourceTexte = (analyserSélection && texteSélectionné) ? texteSélectionné : texteActif;
    const { texte } = extraireTexte(sourceTexte);
    if (compterMots(sourceTexte) < 20) {
      setErreur(e => ({ ...e, [ongletCible]: t("erreur.motsInsuffisants") }));
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setChargement(c => ({ ...c, [ongletCible]: true }));
    setErreur(e => ({ ...e, [ongletCible]: null }));

    try {
      let résultat = "";
      const sig = abortRef.current.signal;

      if (ongletCible === "suggestions") {
        résultat = await appelClaude(systemAvecLangue(PROMPTS.suggestions(typeProjet), langueProjet, contexteADN), `Texte :\n\n${texte}`, sig, 4096);
        const p = parserJSON(résultat);
        setDonnées(d => ({ ...d, suggestions: p.suggestions || [] }));
      } else if (ongletCible === "personnages") {
        résultat = await appelClaude(systemAvecLangue(PROMPTS.personnages, langueProjet, contexteADN), `Texte :\n\n${texte}`, sig, 4096);
        const p = parserJSON(résultat);
        setDonnées(d => ({ ...d, personnages: p.personnages || [] }));
      } else if (ongletCible === "références") {
        // maxTokens relevé 4096 → 6144 : les blocs de résultats de recherche
        // web (server_tool_use / web_search_tool_result) consomment de la
        // place dans la réponse en plus du JSON final attendu.
        résultat = await appelClaude(systemAvecLangue(PROMPTS.références(langueProjet), langueProjet, contexteADN), `Projet : ${projetTitre}\n\nTexte :\n\n${texte}`, sig, 6144, OUTIL_RECHERCHE_WEB);
        // Répare le JSON potentiellement tronqué
        let jsonStr = résultat.replace(/```json|```/g, "").trim();
        if (!jsonStr.endsWith("}")) jsonStr = jsonStr + ']}';
        try {
          const p = JSON.parse(jsonStr);
          setDonnées(d => ({ ...d, références: p.références || [] }));
        } catch {
          // CORRECTIF 30/08/2026 : cette tentative de réparation pouvait
          // elle-même échouer (JSON toujours mal formé après extraction),
          // et son erreur technique brute ("JSON.parse: unexpected...")
          // remontait alors telle quelle jusqu'à l'écran au lieu du message
          // d'erreur habituel — plus rien à voir avec ce qu'un·e auteur·ice
          // peut comprendre ou corriger.
          const match = jsonStr.match(/"références"\s*:\s*\[[\s\S]*\]/);
          try {
            if (!match) throw new Error();
            const partial = JSON.parse(`{${match[0]}}`);
            setDonnées(d => ({ ...d, références: partial.références || [] }));
          } catch {
            throw new Error("__ERREUR_GENERIQUE__");
          }
        }
      } else if (ongletCible === "cohérence") {
        résultat = await appelClaude(systemAvecLangue(PROMPTS.cohérence(typeProjet), langueProjet, contexteADN), `Texte :\n\n${texte}`, sig, 4096);
        const p = parserJSON(résultat);
        setDonnées(d => ({ ...d, cohérence: p.points || [] }));
      } else if (ongletCible === "vérification") {
        // Protocole 60805-06 : orchestré côté serveur (verification-deux-ia),
        // pas un simple appel Claude à parser ici — la réponse est déjà
        // structurée. Peut prendre 10-30s (plusieurs tours IA enchaînés).
        const résultatVérification = await appelVerificationDeuxIA(projetId, nœudId, texte, sig);
        setDonnées(d => ({ ...d, vérification: résultatVérification }));
      }

      setDernièreAnalyse(new Date().toLocaleTimeString(langueProjet === "en" ? "en-GB" : "fr-BE", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      if (err.name !== "AbortError") {
        setErreur(e => ({ ...e, [ongletCible]: messageErreur(err) }));
      }
    } finally {
      setChargement(c => ({ ...c, [ongletCible]: false }));
    }
  }, [texteActif, texteSélectionné, analyserSélection, typeProjet, projetTitre, langueProjet, contexteADN, t, messageErreur, projetId, nœudId]);

  // Aide au démarrage — ne dépend d'aucun texte de l'éditeur, uniquement du
  // contexte ADN et du titre du chapitre en cours. Ajoutée le 18/07/2026.
  // MODIF 20/07/2026 : transmet aussi titrePartieParente et
  // titresChapitresVoisins pour ancrer les pistes d'un chapitre sans titre.
  const analyserDémarrage = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setChargement(c => ({ ...c, suggestions: true }));
    setErreur(e => ({ ...e, suggestions: null }));
    try {
      const sig = abortRef.current.signal;
      const notesEtCitations = typeNœud === "scene" ? await chargerNotesEtCitations(projetId) : null;
      const résultat = await appelClaude(
        systemAvecLangue(
          PROMPTS.demarrage(typeNœud, titreNœud, titresEnfants, notesEtCitations, titrePartieParente, titresChapitresVoisins),
          langueProjet,
          contexteADN
        ),
        `Titre à démarrer (${typeNœud}) : ${titreNœud || "(sans titre)"}\nTitre du projet : ${projetTitre}`,
        sig, 2048
      );
      const p = parserJSON(résultat);
      setDonnées(d => ({ ...d, suggestions: p.suggestions || [] }));
      setDernièreAnalyse(new Date().toLocaleTimeString(langueProjet === "en" ? "en-GB" : "fr-BE", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      if (err.name !== "AbortError") {
        setErreur(e => ({ ...e, suggestions: messageErreur(err) }));
      }
    } finally {
      setChargement(c => ({ ...c, suggestions: false }));
    }
  }, [titreNœud, typeNœud, titresEnfants, titrePartieParente, titresChapitresVoisins, projetId, projetTitre, langueProjet, contexteADN, messageErreur]);

  // Page blanche — brouillon complet (voir PROMPTS.pageBlanche ci-dessus).
  // État séparé de `données`/`suggestions` : ce n'est pas une liste de
  // cartes courtes, c'est un texte long unique, présenté différemment
  // (bandeau d'avertissement + un seul bloc de texte copiable).
  const [brouillonPageBlanche, setBrouillonPageBlanche] = useState(null);
  const [chargementPageBlanche, setChargementPageBlanche] = useState(false);
  const [erreurPageBlanche, setErreurPageBlanche] = useState(null);

  const demanderPageBlanche = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setChargementPageBlanche(true);
    setErreurPageBlanche(null);
    try {
      const sig = abortRef.current.signal;
      const résultat = await appelClaude(
        systemAvecLangue(PROMPTS.pageBlanche(typeNœud, titreNœud), langueProjet, contexteADN),
        `Titre à développer (${typeNœud}) : ${titreNœud || "(sans titre)"}\nTitre du projet : ${projetTitre}`,
        sig, 4096
      );
      const p = parserJSON(résultat);
      setBrouillonPageBlanche(p.brouillon || "");
    } catch (err) {
      if (err.name !== "AbortError") setErreurPageBlanche(messageErreur(err));
    } finally {
      setChargementPageBlanche(false);
    }
  }, [typeNœud, titreNœud, projetTitre, langueProjet, contexteADN, messageErreur]);

  // Aide à définir un projet (voir PROMPTS.definirProjet ci-dessus) —
  // n'existe que pour un livre encore sans chapitre (condition d'affichage
  // dans le rendu plus bas). L'auteur·ice colle un compte-rendu brut, reçoit
  // une proposition de chapitres à créer lui-même (jamais créés
  // automatiquement — même principe que le reste de CopiloteIA : proposer,
  // jamais agir à la place de l'auteur·ice sur son manuscrit).
  const [compteRenduBrut, setCompteRenduBrut] = useState("");
  const [afficherFormulaireProjet, setAfficherFormulaireProjet] = useState(false);
  const [propositionProjet, setPropositionProjet] = useState(null);
  const [chargementProjet, setChargementProjet] = useState(false);
  const [erreurProjet, setErreurProjet] = useState(null);

  const demanderDefinitionProjet = useCallback(async () => {
    if (compterMots(compteRenduBrut) < 20) {
      setErreurProjet(t("erreur.motsInsuffisants"));
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setChargementProjet(true);
    setErreurProjet(null);
    try {
      const sig = abortRef.current.signal;
      const résultat = await appelClaude(
        systemAvecLangue(PROMPTS.definirProjet(), langueProjet, contexteADN),
        `Compte-rendu de l'auteur·ice :\n\n${compteRenduBrut}`,
        sig, 4096
      );
      const p = parserJSON(résultat);
      setPropositionProjet(p);
    } catch (err) {
      if (err.name !== "AbortError") setErreurProjet(messageErreur(err));
    } finally {
      setChargementProjet(false);
    }
  }, [compteRenduBrut, langueProjet, contexteADN, messageErreur, t]);

  // "Aide-moi à avancer" — réf. 60816-01, suite, 30/08/2026 (voir
  // PROMPTS.jeSuisBloqué ci-dessus). Toujours disponible, quel que soit
  // l'onglet actif ou l'état du texte (contrairement à "Page blanche", qui
  // n'apparaît que sur une page vide) — le diagnostic est stocké à part,
  // hors des `données` par onglet, pour rester visible même en changeant
  // d'onglet.
  //
  // CORRECTIF le jour même (retour croisé avec GPT) : une hypothèse de
  // diagnostic imposée sans confirmation reste une hypothèse — un vrai
  // coach vérifie avant d'agir. `confirmationBlocage` (null = pas encore
  // tranché, true = confirmé, false = rejeté) contrôle l'affichage : tant
  // qu'elle n'est pas à `true`, les 5 suivis restent masqués. Un rejet
  // rouvre une zone de précision et relance le diagnostic avec ce complément
  // (voir `complémentBlocage` et le second paramètre de PROMPTS.jeSuisBloqué).
  const [diagnosticBlocage, setDiagnosticBlocage] = useState(null);
  const [chargementBlocage, setChargementBlocage] = useState(false);
  const [erreurBlocage, setErreurBlocage] = useState(null);
  const [confirmationBlocage, setConfirmationBlocage] = useState(null);
  const [complémentBlocage, setComplémentBlocage] = useState("");
  // Trace des hypothèses écartées — 30/08/2026, retour d'usage réel : un
  // "Non, c'est plutôt..." suivi d'une précision faisait disparaître
  // l'hypothèse d'origine ET la précision donnée dès que le nouveau
  // diagnostic arrivait, sans aucun moyen de les revoir ensemble alors
  // qu'il fallait justement "faire le travail" à partir de cet échange.
  // Conservée tant qu'on reste sur le même sujet ; repart à zéro sur un
  // nouveau "Aide-moi à avancer" (complémentAuteur === null).
  const [historiqueBlocage, setHistoriqueBlocage] = useState([]);
  // Le passage réellement analysé pour produire le diagnostic courant —
  // 30/08/2026, voir construireContexteDialogueBlocage : sans lui, le fil
  // de dialogue ("Questionne-moi" etc.) n'avait que le résumé du
  // diagnostic à se mettre sous la dent, jamais le texte lui-même.
  const [texteAnalyséBlocage, setTexteAnalyséBlocage] = useState("");
  const cléCarteBlocage = "blocage:0";

  const demanderJeSuisBloqué = useCallback(async (complémentAuteur = null) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setChargementBlocage(true);
    setErreurBlocage(null);
    if (complémentAuteur === null) {
      setHistoriqueBlocage([]);
    } else if (diagnosticBlocage) {
      setHistoriqueBlocage((h) => [...h, { diagnostic: diagnosticBlocage, complément: complémentAuteur }]);
    }
    setDiagnosticBlocage(null);
    setConfirmationBlocage(null);
    try {
      const sig = abortRef.current.signal;
      const { texte } = extraireTexte((analyserSélection && texteSélectionné) ? texteSélectionné : texteActif);
      const résultat = await appelClaude(
        systemAvecLangue(PROMPTS.jeSuisBloqué(typeNœud, titreNœud, complémentAuteur), langueProjet, contexteADN),
        texte.trim() ? `Texte déjà écrit dans ce ${typeNœud} :\n\n${texte}` : `Ce ${typeNœud} ("${titreNœud || "(sans titre)"}") est encore vide — aucun texte écrit pour l'instant.`,
        sig, 1024
      );
      const p = parserJSON(résultat);
      setDiagnosticBlocage(p);
      setTexteAnalyséBlocage(texte);
      setComplémentBlocage("");
      // Repart d'un fil de dialogue propre à chaque nouveau diagnostic —
      // un fil ouvert sur un diagnostic précédent n'a plus de sens une fois
      // remplacé par un nouveau.
      setDialogues((d) => ({ ...d, [cléCarteBlocage]: undefined }));
    } catch (err) {
      if (err.name !== "AbortError") setErreurBlocage(messageErreur(err));
    } finally {
      setChargementBlocage(false);
    }
  }, [analyserSélection, texteSélectionné, texteActif, typeNœud, titreNœud, langueProjet, contexteADN, messageErreur, diagnosticBlocage]);

  const confirmerBlocage = useCallback(() => setConfirmationBlocage(true), []);
  const rejeterBlocage = useCallback(() => setConfirmationBlocage(false), []);
  const relancerAvecComplément = useCallback(() => {
    if (!complémentBlocage.trim()) return;
    demanderJeSuisBloqué(complémentBlocage.trim());
  }, [complémentBlocage, demanderJeSuisBloqué]);

  // Les 5 suivis proposés après le diagnostic — réf. 60816-01, suite,
  // 30/08/2026, demande explicite : ne jamais répondre par défaut avec un
  // texte généré, laisser l'auteur·ice choisir le type d'aide. Réutilise le
  // fil de dialogue par carte déjà existant (voir ouvrirDialogue/
  // envoyerQuestionDialogue plus haut) — chaque bouton envoie un message
  // "auteur" prérempli dans ce fil, comme si l'auteur·ice l'avait tapé.
  const SUIVIS_BLOCAGE = [
    { id: "questionne", label: "Questionne-moi", message: "Pose-moi des questions qui m'aideraient à trouver moi-même la suite, sans me donner de réponse toute faite." },
    { id: "pistes", label: "Donne-moi des pistes", message: "Donne-moi plusieurs directions possibles, sans en écrire aucune complètement, pour que je choisisse moi-même." },
    { id: "construire", label: "Construis la scène avec moi", message: "Construisons ce passage ensemble, étape par étape — propose-moi juste le déclencheur ou la première réplique, on avancera ensuite par petites touches." },
    { id: "exemple", label: "Propose-moi un exemple", message: "Écris un exemple concret et développé de ce que pourrait donner ce passage — un brouillon jetable, à réécrire entièrement dans ma propre voix, pas un texte final." },
    { id: "surprends", label: "Surprends-moi", message: "Propose-moi quelque chose d'inattendu ou d'audacieux à cet endroit, qui sort du chemin le plus évident." },
  ];

  const lancerSuiviBlocage = useCallback((message) => {
    if (!diagnosticBlocage) return;
    const contexteCarte = construireContexteDialogueBlocage(diagnosticBlocage, texteAnalyséBlocage);
    ouvrirDialogue(cléCarteBlocage, contexteCarte);
    envoyerQuestionDialogue(cléCarteBlocage, message);
  }, [diagnosticBlocage, texteAnalyséBlocage, ouvrirDialogue, envoyerQuestionDialogue]);

  useEffect(() => {
    // "vérification" exclu du mode Auto : protocole 60805-06 conçu comme une
    // action délibérée sur un passage choisi, jamais un cycle automatique
    // (voir "Fonctionnalité optionnelle... à profondeur adaptative" dans le
    // protocole — un déclenchement toutes les 10 min irait à l'encontre de
    // ce principe, en plus de consommer le quota sans que l'auteur·e l'ait
    // demandé).
    if (modeAuto && onglet !== "vérification") {
      analyser(onglet);
      intervalRef.current = setInterval(() => analyser(onglet), 600000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [modeAuto, onglet, analyser]);

  const onglets = [
    { id: "suggestions", label: t("onglets.suggestions") },
    { id: "personnages", label: t("onglets.personnages") },
    { id: "références", label: t("onglets.references") },
    { id: "cohérence", label: t("onglets.coherence") },
    { id: "vérification", label: t("onglets.verification", "Vérification") },
  ];

  const données_onglet = données[onglet];
  const enChargement = chargement[onglet];
  const erreurOnglet = erreur[onglet];

  // Avertissement préventif, AVANT le clic — ajouté le 17/07/2026 à la demande
  // de Joseph : depuis que la troncature automatique a été retirée, un texte
  // trop volumineux peut produire une réponse IA qui dépasse le plafond de
  // sortie (4096 tokens) et revient incomplète, même réparée. Plutôt que de
  // laisser l'auteur le découvrir après coup, on le bloque en amont avec un
  // message clair. Seuil de 8000 caractères choisi comme estimation prudente
  // (heuristique, pas une limite technique dure) — à ajuster si l'expérience
  // montre qu'il coupe des analyses qui se seraient bien passées, ou qu'il
  // laisse encore passer des textes trop longs.
  const SEUIL_AVERTISSEMENT = 8000;
  const { texte: sourceActuelleNettoyée } = extraireTexte(
    (analyserSélection && texteSélectionné) ? texteSélectionné : texteActif
  );
  const texteTropVolumineux = sourceActuelleNettoyée.length > SEUIL_AVERTISSEMENT;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden", background: "#fafafa" }}>

      {/* En-tête */}
      <div style={{ padding: "12px 14px", borderBottom: "0.5px solid #e5e5e5", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>🤖</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#1a1a1a" }}>{t("titre")}</span>
            {dernièreAnalyse && <span style={{ fontSize: 10, color: "#999" }}>· {dernièreAnalyse}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "#999" }}>{t("modeAuto.label")}</span>
            <div onClick={() => setModeAuto(!modeAuto)}
              style={{ width: 30, height: 16, borderRadius: 8, background: modeAuto ? couleurProjet : "#ddd", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <div style={{ position: "absolute", top: 2, left: modeAuto ? 15 : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </div>
          </div>
        </div>

        {/* Compteur d'usage IA réel (60803-03) — jauge + avertissement à 90%
            + recouvrement bloquant à 100%, calculés sur le vrai quota du
            palier (quotas_paliers) et la vraie consommation (usage_ia).
            CORRECTIF 03/08/2026 : le mode "compact" (barre colorée sans
            texte) rendait le compteur illisible — impossible de savoir ce
            qu'on regardait sans légende. Texte toujours affiché désormais. */}
        <div style={{ marginBottom: 8 }}>
          <CompteurUsageIA
            onÉtatChange={setUsageIA}
            onDemanderUpgrade={onDemanderUpgrade}
            rafraîchirDepuis={dernièreAnalyse}
          />
        </div>

        {modeAuto && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${couleurProjet}12`, border: `0.5px solid ${couleurProjet}30`, borderRadius: 6, padding: "5px 8px", marginBottom: 8, fontSize: 10.5, color: couleurProjet, lineHeight: 1.4 }}>
            <span>🔄</span>
            <span>{t("modeAuto.banniere")}</span>
          </div>
        )}

        <div style={{ display: "flex" }}>
          {onglets.map(o => (
            <button key={o.id} onClick={() => setOnglet(o.id)}
              style={{ flex: 1, padding: "6px 2px", border: "none", background: "transparent", fontFamily: "inherit", fontSize: 10, fontWeight: onglet === o.id ? 600 : 400, color: onglet === o.id ? couleurProjet : "#999", borderBottom: onglet === o.id ? `2px solid ${couleurProjet}` : "2px solid transparent", cursor: "pointer" }}>
              {o.label}
              {données[o.id] !== null && <span style={{ marginLeft: 2, opacity: 0.6 }}>({Array.isArray(données[o.id]) ? données[o.id].length : "✓"})</span>}
            </button>
          ))}
        </div>

        {/* "Aide-moi à avancer" — réf. 60816-01, suite, 30/08/2026. Renommé
            depuis "Je suis bloqué" (retour croisé avec GPT) : ce nom oblige
            presque à reconnaître un échec, alors que le doute, l'hésitation
            ou la simple recherche d'un recul méritent aussi ce bouton.
            Toujours visible, quel que soit l'onglet actif ou l'état du
            texte — contrairement à "Page blanche", accessible pendant
            toute l'écriture, pas seulement au démarrage. */}
        <button
          onClick={() => demanderJeSuisBloqué()}
          disabled={chargementBlocage || usageBloqué}
          title="Idée, blocage, doute ou difficulté d'écriture"
          style={{
            width: "100%", marginTop: 8, padding: "7px", background: "#fff", color: couleurProjet,
            border: `0.5px solid ${couleurProjet}40`, borderRadius: 7, fontSize: 12, fontWeight: 500,
            cursor: (chargementBlocage || usageBloqué) ? "default" : "pointer", fontFamily: "inherit",
            opacity: usageBloqué ? 0.5 : 1,
          }}>
          {chargementBlocage ? t("bouton.enCours") : "🛟 Aide-moi à avancer"}
        </button>

        {/* "🧩 Conseils de recomposition" — voir lancerConseilsRecomposition
            plus haut. Toujours visible, contrairement à "Analyser
            maintenant" (onglets Suggestions/Cohérence/...) : c'est
            précisément l'opération conçue pour dépasser le seuil de 8000
            caractères, donc jamais désactivée par texteTropVolumineux. */}
        <button
          onClick={lancerConseilsRecomposition}
          disabled={recompositionChargement || usageBloqué}
          title="Analyse le chapitre entier par tranches si besoin (au-delà de 8000 caractères), sans rien résumer — structure, répétitions, transitions, glose redondante."
          style={{
            width: "100%", marginTop: 6, padding: "7px", background: "#fff", color: couleurProjet,
            border: `0.5px solid ${couleurProjet}40`, borderRadius: 7, fontSize: 12, fontWeight: 500,
            cursor: (recompositionChargement || usageBloqué) ? "default" : "pointer", fontFamily: "inherit",
            opacity: usageBloqué ? 0.5 : 1,
          }}>
          {recompositionChargement ? (recompositionProgression || t("bouton.enCours")) : "🧩 Conseils de recomposition (chapitre entier)"}
        </button>

        {recompositionErreur && (
          <div style={{ background: "#FCEBEB", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#A32D2D", marginTop: 6 }}>{recompositionErreur}</div>
        )}

        {/* Les résultats (recompositionPoints) sont affichés plus bas, DANS
            la section "Corps" défilante — voir plus bas dans le rendu.
            CORRECTIF 30/08/2026, signalé par Joseph : ils étaient d'abord
            affichés ici, dans l'en-tête fixe (flexShrink: 0, jamais de
            défilement) — avec un chapitre entier produisant 15-20 points,
            la liste débordait sans aucun moyen de la parcourir ni
            d'atteindre quoi que ce soit en dessous. */}

        {/* "+ Ajouter à la mémoire" — voir OPTIONS_TYPE_MÉMOIRE et
            ajouterMémoireManuelle plus haut. Toujours visible, comme "Aide-
            moi à avancer" : une intention déjà formée ailleurs (une autre
            IA, une relecture, une conversation hors Cursus) doit pouvoir
            entrer directement dans la mémoire du projet, sans faux dialogue
            avec le co-pilote pour déclencher "Mémoriser cette intention". */}
        {/* Les deux boutons mémoire côte à côte plutôt qu'empilés — demande
            de Joseph, 30/08/2026, pour gagner une ligne de hauteur dans un
            panneau déjà chargé. */}
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button
            onClick={() => setAjoutMémoireOuvert((o) => !o)}
            title="Ajouter directement une information à retenir pour ce projet"
            style={{
              flex: 1, padding: "7px", background: "#fff", color: "#888",
              border: "0.5px solid #ddd", borderRadius: 7, fontSize: 12, fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit",
            }}>
            🧠 + Ajouter
          </button>
          <button
            onClick={basculerListeMémoire}
            style={{
              flex: 1, padding: "7px", background: "#fff", color: "#888",
              border: "0.5px solid #ddd", borderRadius: 7, fontSize: 12, fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit",
            }}>
            🧠 {mémoireListeOuverte ? "Masquer" : "Voir la mémoire"}
          </button>
        </div>

        {ajoutMémoireOuvert && (
          <div style={{ marginTop: 6, padding: "8px 10px", background: "#fafafa", border: "0.5px solid #e5e5e5", borderRadius: 7 }}>
            <select
              value={nouvelleMémoireType}
              onChange={(e) => setNouvelleMémoireType(e.target.value)}
              style={{ width: "100%", marginBottom: 6, padding: "5px 6px", fontSize: 11.5, fontFamily: "inherit", border: "0.5px solid #ddd", borderRadius: 6, boxSizing: "border-box" }}
            >
              {OPTIONS_TYPE_MÉMOIRE.map((o) => <option key={o.valeur} value={o.valeur}>{o.label}</option>)}
            </select>
            <textarea
              value={nouvelleMémoireContenu}
              onChange={(e) => setNouvelleMémoireContenu(e.target.value)}
              placeholder="L'information à retenir pour ce projet…"
              style={{ width: "100%", minHeight: 60, padding: "6px 8px", fontSize: 12, fontFamily: "inherit", border: "0.5px solid #ddd", borderRadius: 6, resize: "vertical", boxSizing: "border-box", marginBottom: 6 }}
            />
            {ajoutMémoireErreur && (
              <div style={{ fontSize: 11, color: "#A32D2D", marginBottom: 6 }}>⚠️ {ajoutMémoireErreur}</div>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={ajouterMémoireManuelle}
                disabled={ajoutMémoireEnCours || !nouvelleMémoireContenu.trim()}
                style={{
                  flex: 1, padding: "6px", background: couleurProjet, color: "#fff", border: "none", borderRadius: 6,
                  fontSize: 12, fontWeight: 500, fontFamily: "inherit",
                  cursor: (ajoutMémoireEnCours || !nouvelleMémoireContenu.trim()) ? "default" : "pointer",
                  opacity: (ajoutMémoireEnCours || !nouvelleMémoireContenu.trim()) ? 0.6 : 1,
                }}>
                {ajoutMémoireEnCours ? "…" : "Ajouter"}
              </button>
              <button
                onClick={() => { setAjoutMémoireOuvert(false); setNouvelleMémoireContenu(""); setAjoutMémoireErreur(null); }}
                style={{ padding: "6px 10px", background: "transparent", color: "#888", border: "0.5px solid #ccc", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Bouton "Voir la mémoire" déplacé plus haut, à côté de "+ Ajouter"
            (voir le bloc flex juste avant "+ Ajouter à la mémoire") — logique
            chargerMémoireListe/basculerListeMémoire/changerStatutMémoire
            inchangée, seul l'emplacement du bouton a changé. */}

        {mémoireListeOuverte && (
          <div style={{ marginTop: 6, padding: "8px 10px", background: "#fafafa", border: "0.5px solid #e5e5e5", borderRadius: 7, maxHeight: 260, overflowY: "auto" }}>
            {nœudId && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#777", marginBottom: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={mémoireToutLeProjet} onChange={(e) => setMémoireToutLeProjet(e.target.checked)} />
                Tout le projet (au lieu de ce chapitre/scène seulement)
              </label>
            )}

            {mémoireListeChargement && <div style={{ fontSize: 11.5, color: "#999" }}>Chargement…</div>}
            {mémoireListeErreur && <div style={{ fontSize: 11.5, color: "#A32D2D" }}>{mémoireListeErreur}</div>}

            {!mémoireListeChargement && !mémoireListeErreur && (() => {
              const entrées = (mémoireListe || []).filter((m) =>
                mémoireToutLeProjet || !nœudId ? true : m.portee?.noeud_id === nœudId
              );
              if (entrées.length === 0) {
                return <div style={{ fontSize: 11.5, color: "#999", fontStyle: "italic" }}>Rien d'enregistré {mémoireToutLeProjet || !nœudId ? "pour ce projet" : "pour ce chapitre/scène"} pour l'instant.</div>;
              }
              return entrées.map((m) => {
                const labelType = OPTIONS_TYPE_MÉMOIRE.find((o) => o.valeur === m.type)?.label || m.type;
                const styleStatut = {
                  validee: { c: "#1D9E75", label: "validée" },
                  proposee: { c: "#BA7517", label: "proposée" },
                  rejetee: { c: "#999", label: "rejetée" },
                  remplacee: { c: "#999", label: "remplacée" },
                }[m.statut] || { c: "#999", label: m.statut };
                return (
                  <div key={m.id} style={{ background: "#fff", border: "0.5px solid #eee", borderRadius: 6, padding: "6px 8px", marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 600, color: "#888", textTransform: "uppercase" }}>{labelType}</span>
                      <span style={{ fontSize: 9.5, fontWeight: 600, color: styleStatut.c }}>{styleStatut.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#1a1a1a", lineHeight: 1.5, marginBottom: m.statut === "proposee" ? 6 : 0 }}>{m.contenu}</div>
                    {m.portee?.noeud_titre && mémoireToutLeProjet && (
                      <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>— {m.portee.noeud_titre}</div>
                    )}
                    {m.statut === "proposee" && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => changerStatutMémoire(m.id, "validee")}
                          style={{ fontSize: 10.5, padding: "3px 8px", background: "#1D9E7515", color: "#1D9E75", border: "0.5px solid #1D9E7530", borderRadius: 14, cursor: "pointer", fontFamily: "inherit" }}>
                          Valider
                        </button>
                        <button onClick={() => changerStatutMémoire(m.id, "rejetee")}
                          style={{ fontSize: 10.5, padding: "3px 8px", background: "transparent", color: "#888", border: "0.5px solid #ccc", borderRadius: 14, cursor: "pointer", fontFamily: "inherit" }}>
                          Rejeter
                        </button>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Corps */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 12px" }}>
        {/* Résultats de "🧩 Conseils de recomposition" — déplacés ici
            depuis l'en-tête fixe (voir le commentaire à l'ancien
            emplacement) pour pouvoir défiler avec le reste du corps. */}
        {recompositionPoints && (
          <div style={{ marginBottom: 8 }}>
            {recompositionPoints.length === 0 ? (
              <p style={{ fontSize: 12, color: "#1D9E75", textAlign: "center", margin: "8px 0" }}>Rien à signaler sur ce chapitre.</p>
            ) : (
              recompositionPoints.map((p, i) => (
                <CarteCoherence
                  key={i} p={p} cléCarte={`recomposition:${i}`}
                  dialogue={dialogues[`recomposition:${i}`]}
                  onOuvrirDialogue={ouvrirDialogue}
                  onEnvoyerQuestion={envoyerQuestionDialogue}
                  langueProjet={langueProjet}
                  onMémoriserCarte={mémoriserIntention}
                  mémorisationEnCours={mémorisationEnCoursParCarte}
                />
              ))
            )}
          </div>
        )}
        {erreurBlocage && (
          <div style={{ background: "#FCEBEB", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#A32D2D", marginBottom: 8 }}>{erreurBlocage}</div>
        )}
        {diagnosticBlocage && (
          <CarteBlocage
            diagnostic={diagnosticBlocage}
            texteAnalysé={texteAnalyséBlocage}
            confirmation={confirmationBlocage}
            onConfirmer={confirmerBlocage}
            onRejeter={rejeterBlocage}
            complément={complémentBlocage}
            onChangerComplément={setComplémentBlocage}
            onRelancer={relancerAvecComplément}
            chargement={chargementBlocage}
            suivis={SUIVIS_BLOCAGE}
            onSuivi={lancerSuiviBlocage}
            dialogue={dialogues[cléCarteBlocage]}
            onOuvrirDialogue={(ctx) => ouvrirDialogue(cléCarteBlocage, ctx)}
            onEnvoyerQuestion={(q, continuer) => envoyerQuestionDialogue(cléCarteBlocage, q, continuer)}
            onMémoriser={diagnosticBlocage ? () => mémoriserIntention(cléCarteBlocage, `Diagnostic : ${diagnosticBlocage.diagnostic}`) : null}
            mémorisationEnCours={mémorisationEnCoursParCarte[cléCarteBlocage]}
            historique={historiqueBlocage}
            couleur={couleurProjet}
            langueProjet={langueProjet}
          />
        )}
        {texteSélectionné && texteSélectionné.trim().length > 20 && (
          <>
            {/* CORRECTIF 02/08/2026 — le bouton affichait un nombre de MOTS
                alors que c'est un seuil en CARACTÈRES (texteTropVolumineux,
                juste en dessous) qui décide si l'analyse sera bloquée :
                aucun moyen de savoir si on s'en approche avant de cliquer.
                Affiche désormais le nombre de caractères, la seule unité
                pertinente ici. */}
            <div style={{
              display: "flex", gap: 6, marginBottom: 4,
              background: "#f5f5f5", borderRadius: 7, padding: 3,
            }}>
              <button
                onClick={() => setAnalyserSélection(true)}
                style={{
                  flex: 1, padding: "5px 6px", borderRadius: 5, border: "none",
                  background: analyserSélection ? "#fff" : "transparent",
                  color: analyserSélection ? couleurProjet : "#999",
                  fontWeight: analyserSélection ? 600 : 400,
                  fontSize: 10.5, cursor: "pointer", fontFamily: "inherit",
                  boxShadow: analyserSélection ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {t("selection.analyserSelection", { count: texteSélectionné.length })}
              </button>
              <button
                onClick={() => setAnalyserSélection(false)}
                style={{
                  flex: 1, padding: "5px 6px", borderRadius: 5, border: "none",
                  background: !analyserSélection ? "#fff" : "transparent",
                  color: !analyserSélection ? couleurProjet : "#999",
                  fontWeight: !analyserSélection ? 600 : 400,
                  fontSize: 10.5, cursor: "pointer", fontFamily: "inherit",
                  boxShadow: !analyserSélection ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {t("selection.analyserTout")}
              </button>
            </div>
          </>
        )}

        {/* CORRECTIF 03/08/2026 — avant, rien n'indiquait où on se situait
            par rapport à la limite tant qu'on n'avait pas cliqué "Analyser"
            et essuyé le refus. Indicateur permanent désormais, dès qu'il y a
            un texte à analyser (sélection ou chapitre entier) : combien de
            caractères, et la marge restante avant la limite. */}
        {sourceActuelleNettoyée.length > 0 && (
          <div style={{
            fontSize: 11, color: texteTropVolumineux ? "#A32D2D" : "#1D9E75",
            marginBottom: 6, display: "flex", justifyContent: "space-between",
          }}>
            <span>{sourceActuelleNettoyée.length.toLocaleString("fr-FR")} / {SEUIL_AVERTISSEMENT.toLocaleString("fr-FR")} caractères</span>
            <span>{texteTropVolumineux ? "au-dessus de la limite" : `${(SEUIL_AVERTISSEMENT - sourceActuelleNettoyée.length).toLocaleString("fr-FR")} restants`}</span>
          </div>
        )}

        {texteTropVolumineux && (
          <div style={{
            background: "#FAEEDA", borderRadius: 7, padding: "8px 10px",
            fontSize: 11.5, color: "#854F0B", marginBottom: 8, lineHeight: 1.5,
          }}>
            ⚠️ {t("selection.texteTropVolumineux", { count: sourceActuelleNettoyée.length.toLocaleString("fr-FR") })}
          </div>
        )}

        <button onClick={() => analyser(onglet)} disabled={enChargement || texteTropVolumineux || usageBloqué}
          style={{ width: "100%", padding: "7px", marginBottom: 10, background: `${couleurProjet}15`, color: couleurProjet, border: `0.5px solid ${couleurProjet}30`, borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: (enChargement || texteTropVolumineux || usageBloqué) ? "default" : "pointer", fontFamily: "inherit", opacity: (texteTropVolumineux || usageBloqué) ? 0.5 : 1 }}>
          {enChargement ? t("bouton.enCours") : modeAuto ? t("bouton.forcerAnalyse") : t("bouton.analyser")}
        </button>

        {enChargement && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#999", fontSize: 12, padding: "8px 0" }}>
            <div style={{ width: 14, height: 14, border: `2px solid ${couleurProjet}30`, borderTopColor: couleurProjet, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            {t("bouton.enCours")}
          </div>
        )}

        {erreurOnglet && !enChargement && (
          <div style={{ background: "#FCEBEB", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#A32D2D", marginBottom: 8 }}>
            {erreurOnglet}
          </div>
        )}

        {!enChargement && !erreurOnglet && données_onglet === null && (
          <div style={{ textAlign: "center", padding: "20px 8px", color: "#bbb", fontSize: 12, lineHeight: 1.7 }}>
            {onglet === "suggestions" && (
              compterMots(texteActif) < 20 ? (
                <div style={{ padding: "4px 4px 8px" }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>🌱</div>
                  <div style={{ marginBottom: 12 }}>{t(`demarrage.description_${typeNœud}`) || t("demarrage.description")}</div>
                  <button
                    onClick={analyserDémarrage}
                    disabled={!contexteADN}
                    style={{
                      width: "100%", padding: "8px", background: contexteADN ? `${couleurProjet}15` : "#f0f0f0",
                      color: contexteADN ? couleurProjet : "#bbb", border: `0.5px solid ${contexteADN ? couleurProjet + "30" : "#ddd"}`,
                      borderRadius: 7, fontSize: 12, fontWeight: 500,
                      cursor: contexteADN ? "pointer" : "default", fontFamily: "inherit",
                    }}
                  >
                    {t("demarrage.bouton")}
                  </button>
                  {!contexteADN && (
                    <div style={{ fontSize: 10.5, color: "#bbb", marginTop: 8, lineHeight: 1.5 }}>
                      {t("demarrage.sansADN")}
                    </div>
                  )}

                  {/* Page blanche — brouillon complet, réf. 60816-01, suite,
                      30/08/2026. Distincte de "démarrage" ci-dessus (quelques
                      pistes courtes) : ici, un texte long et concret, pensé
                      comme un point de départ jetable, pas des idées à
                      combiner soi-même. */}
                  <button
                    onClick={demanderPageBlanche}
                    disabled={!contexteADN || chargementPageBlanche}
                    style={{
                      width: "100%", padding: "8px", marginTop: 8,
                      background: contexteADN ? "#fff" : "#f0f0f0",
                      color: contexteADN ? couleurProjet : "#bbb",
                      border: `0.5px solid ${contexteADN ? couleurProjet + "50" : "#ddd"}`,
                      borderRadius: 7, fontSize: 12, fontWeight: 500,
                      cursor: (contexteADN && !chargementPageBlanche) ? "pointer" : "default", fontFamily: "inherit",
                    }}
                  >
                    {chargementPageBlanche ? t("bouton.enCours") : "Je suis bloqué·e — proposer un brouillon complet"}
                  </button>

                  {/* Aide à définir un projet — réf. 60816-01, suite,
                      30/08/2026. Uniquement pour un livre encore sans
                      chapitre : bootstrap de la colonne vertébrale à partir
                      d'un compte-rendu brut, pas d'un texte déjà structuré. */}
                  {typeNœud === "partie" && titresEnfants.length === 0 && (
                    <div style={{ marginTop: 8 }}>
                      {!afficherFormulaireProjet ? (
                        <button
                          onClick={() => setAfficherFormulaireProjet(true)}
                          style={{
                            width: "100%", padding: "8px", background: "#fff", color: couleurProjet,
                            border: `0.5px solid ${couleurProjet}50`, borderRadius: 7, fontSize: 12, fontWeight: 500,
                            cursor: "pointer", fontFamily: "inherit",
                          }}
                        >
                          Aide-moi à définir un projet
                        </button>
                      ) : (
                        <div style={{ textAlign: "left" }}>
                          <textarea
                            value={compteRenduBrut}
                            onChange={(e) => setCompteRenduBrut(e.target.value)}
                            placeholder="Racontez ici, même en vrac, ce que vous voulez écrire — un vécu, une idée, des notes…"
                            style={{
                              width: "100%", minHeight: 90, padding: "8px 10px", fontSize: 12, fontFamily: "inherit",
                              border: `0.5px solid ${couleurProjet}30`, borderRadius: 7, resize: "vertical", boxSizing: "border-box",
                            }}
                          />
                          <button
                            onClick={demanderDefinitionProjet}
                            disabled={chargementProjet}
                            style={{
                              width: "100%", padding: "8px", marginTop: 6, background: `${couleurProjet}15`, color: couleurProjet,
                              border: `0.5px solid ${couleurProjet}30`, borderRadius: 7, fontSize: 12, fontWeight: 500,
                              cursor: chargementProjet ? "default" : "pointer", fontFamily: "inherit",
                            }}
                          >
                            {chargementProjet ? t("bouton.enCours") : "Proposer une colonne vertébrale"}
                          </button>
                          {erreurProjet && <div style={{ fontSize: 11.5, color: "#A32D2D", marginTop: 6 }}>{erreurProjet}</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : t("videEtat.suggestions")
            )}
            {onglet === "personnages" && t("videEtat.personnages")}
            {onglet === "références" && t("videEtat.references")}
            {onglet === "cohérence" && t("videEtat.coherence")}
            {onglet === "vérification" && t("videEtat.verification", "Vérification approfondie à deux IA (Claude + GPT) d'une affirmation précise du passage. Peut prendre jusqu'à 30 secondes.")}
          </div>
        )}

        {onglet === "suggestions" && Array.isArray(données_onglet) && données_onglet.map((s, i) => <CarteSuggestion key={i} s={s} couleur={couleurProjet} cléCarte={`suggestions:${i}`} dialogue={dialogues[`suggestions:${i}`]} onOuvrirDialogue={ouvrirDialogue} onEnvoyerQuestion={envoyerQuestionDialogue} langueProjet={langueProjet} onMémoriserCarte={mémoriserIntention} mémorisationEnCours={mémorisationEnCoursParCarte} />)}

        {/* Résultat "Page blanche" — réf. 60816-01, suite, 30/08/2026.
            Bandeau d'avertissement systématique : un brouillon jetable à
            réécrire entièrement, jamais un texte à publier tel quel. */}
        {onglet === "suggestions" && erreurPageBlanche && (
          <div style={{ background: "#FCEBEB", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#A32D2D", marginBottom: 8 }}>{erreurPageBlanche}</div>
        )}
        {onglet === "suggestions" && brouillonPageBlanche && (
          <div style={{ background: "#fff", border: `0.5px solid ${couleurProjet}30`, borderRadius: 8, padding: "10px 12px", marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#A36A1D", background: "#FCF3E3", padding: "3px 8px", borderRadius: 5 }}>
                Brouillon jetable — à réécrire entièrement dans votre voix, jamais à publier tel quel
              </div>
              <BoutonCopier texte={brouillonPageBlanche} couleur={couleurProjet} />
            </div>
            <div style={{ fontSize: 12.5, color: "var(--texte-primaire, #222)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {brouillonPageBlanche}
            </div>
          </div>
        )}

        {/* Résultat "Aide à définir un projet" — réf. 60816-01, suite,
            30/08/2026. Propose des titres de chapitres, ne les crée jamais
            automatiquement dans le manuscrit — à l'auteur·ice de les créer
            puis de les développer un par un via "Page blanche" ci-dessus. */}
        {onglet === "suggestions" && propositionProjet && (
          <div style={{ marginTop: 8 }}>
            {propositionProjet.titre_livre && (
              <div style={{ fontSize: 12.5, fontWeight: 600, color: couleurProjet, marginBottom: 6, textAlign: "left" }}>
                Titre possible : {propositionProjet.titre_livre}
              </div>
            )}
            {(propositionProjet.chapitres || []).map((c, i) => (
              <div key={i} style={{ background: "#fff", border: `0.5px solid ${couleurProjet}30`, borderRadius: 8, padding: "8px 10px", marginBottom: 6, textAlign: "left" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--texte-primaire, #222)" }}>{i + 1}. {c.titre}</div>
                  <BoutonCopier texte={c.titre} couleur={couleurProjet} />
                </div>
                <div style={{ fontSize: 12, color: "var(--texte-secondaire, #555)", marginTop: 2 }}>{c.resume}</div>
              </div>
            ))}
          </div>
        )}
        {onglet === "personnages" && Array.isArray(données_onglet) && (données_onglet.length === 0 ? <p style={{ fontSize: 12, color: "#999", textAlign: "center" }}>{t("personnages.aucun")}</p> : données_onglet.map((p, i) => <CartePersonnage key={i} p={p} cléCarte={`personnages:${i}`} dialogue={dialogues[`personnages:${i}`]} onOuvrirDialogue={ouvrirDialogue} onEnvoyerQuestion={envoyerQuestionDialogue} langueProjet={langueProjet} onMémoriserCarte={mémoriserIntention} mémorisationEnCours={mémorisationEnCoursParCarte} />))}
        {onglet === "références" && Array.isArray(données_onglet) && (données_onglet.length === 0 ? <p style={{ fontSize: 12, color: "#999", textAlign: "center" }}>{t("references.aucune")}</p> : données_onglet.map((r, i) => <CarteRéférence key={i} r={r} />))}
        {onglet === "cohérence" && Array.isArray(données_onglet) && (données_onglet.length === 0 ? <p style={{ fontSize: 12, color: "#1D9E75", textAlign: "center" }}>{t("coherence.aucunProbleme")}</p> : données_onglet.map((p, i) => <CarteCoherence key={i} p={p} cléCarte={`coherence:${i}`} dialogue={dialogues[`coherence:${i}`]} onOuvrirDialogue={ouvrirDialogue} onEnvoyerQuestion={envoyerQuestionDialogue} langueProjet={langueProjet} onMémoriserCarte={mémoriserIntention} mémorisationEnCours={mémorisationEnCoursParCarte} />))}
        {onglet === "vérification" && données_onglet && !Array.isArray(données_onglet) && <PanneauVerification résultat={données_onglet} />}
      </div>
    </div>
  );
}



