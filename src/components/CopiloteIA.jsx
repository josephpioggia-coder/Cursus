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

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase.js";
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

async function appelClaude(system, user, signal, maxTokens = 1000, tools = null) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error("SESSION_EXPIREE");
  }

  const corpsRequête = {
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
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
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
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
};

function systemAvecLangue(promptBase, langueProjet, contexteADN) {
  const instruction = INSTRUCTION_LANGUE[langueProjet] || INSTRUCTION_LANGUE.fr;
  const blocADN = contexteADN
    ? `CONTEXTE DU PROJET — réponses de l'auteur au questionnaire d'intention (à respecter impérativement dans ton comportement, pas seulement à titre informatif) :\n${contexteADN}\n\n`
    : "";
  return `${blocADN}${promptBase}\n\n${instruction} (Les clés JSON restent telles quelles ; seules les valeurs textuelles sont dans cette langue.)`;
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

    const lignes = [];
    (citations || []).forEach((c) => {
      const source = c.livres ? `${c.livres.titre} (${c.livres.auteur})` : "source inconnue";
      lignes.push(`- Citation [${source}${c.page ? `, p.${c.page}` : ""}] : "${c.texte}"`);
    });
    (idées || []).forEach((i) => {
      lignes.push(`- Idée notée : ${i.texte}`);
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
// répond dans le fil — un appel Claude léger (1024 tokens), pas une
// nouvelle analyse.
const DIALOGUE_MAX_TOKENS = 1024;

function promptDialogue(langueProjet) {
  const instruction = INSTRUCTION_LANGUE[langueProjet] || INSTRUCTION_LANGUE.fr;
  return `Tu es le co-pilote d'un écrivain. Tu as déjà produit une analyse précise (fournie ci-dessous) sur un passage de son texte. L'auteur te pose maintenant une question de suivi sur CETTE analyse précise — il veut creuser, comprendre ton raisonnement, ou te challenger sur ce point exact. Réponds directement à sa question, de façon conversationnelle et précise, en t'appuyant sur l'analyse d'origine sans la répéter intégralement. Ne redemande jamais le texte complet du chapitre : tout ce dont tu as besoin est dans l'analyse fournie et l'échange en cours.

RÈGLE NON NÉGOCIABLE sur les personnes nommées : si ta réponse (ou l'analyse d'origine que tu développes) mentionne une personne nommée dans le texte de l'auteur, ne lui attribue jamais de trait de caractère, de qualité ou de fait que l'auteur n'a pas lui-même écrit — que ce soit dans ta première réponse ou dans une reformulation que tu proposes ici. Si l'auteur te fait remarquer que tu as inventé une caractérisation, reconnais-le sans détour : ne cherche pas à justifier ou à minimiser l'invention.

${instruction}`;
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

// Dictée vocale universelle — remplace le 26/08/2026 la première version
// (API SpeechRecognition native du navigateur, absente sur Firefox par choix
// délibéré de Mozilla — voir compte-rendu). Cette version enregistre l'audio
// via MediaRecorder (supporté partout, Firefox compris) et l'envoie à
// l'Edge Function transcrire-audio, qui relaie vers Whisper (OpenAI) côté
// serveur. Coût réel de l'ordre de quelques centimes par utilisateur actif
// (~0,006 $/minute Whisper) — sans commune mesure avec un abonnement grand
// public comme Flow (12€/utilisateur/mois), qui inclut bien plus qu'une
// simple transcription.
const EDGE_FUNCTION_TRANSCRIPTION = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/transcrire-audio";

async function transcrireAudio(blob, dureeSecondes) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("SESSION_EXPIREE");

  const formData = new FormData();
  formData.append("audio", blob, "question.webm");
  formData.append("duree_secondes", String(dureeSecondes || ""));

  const response = await fetch(EDGE_FUNCTION_TRANSCRIPTION, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "apikey": SUPABASE_ANON_KEY,
      // Pas de Content-Type manuel : le navigateur fixe lui-même la limite
      // multipart correcte pour FormData — la définir à la main casserait l'envoi.
    },
    body: formData,
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || `HTTP ${response.status}`);
  return data.texte || "";
}

function FilDialogue({ dialogue, onEnvoyer, couleur }) {
  const { t } = useTranslation("copilote");
  const [saisie, setSaisie] = useState("");
  const [enEnregistrement, setEnEnregistrement] = useState(false);
  const [enTranscription, setEnTranscription] = useState(false);
  const [erreurMicro, setErreurMicro] = useState(null);
  const zoneRef = useRef(null);
  const recorderRef = useRef(null);
  const morceauxRef = useRef([]);
  const débutRef = useRef(null);

  const microDisponible = typeof navigator !== "undefined"
    && navigator.mediaDevices?.getUserMedia
    && typeof window !== "undefined" && window.MediaRecorder;

  useEffect(() => {
    if (zoneRef.current) {
      zoneRef.current.style.height = "auto";
      zoneRef.current.style.height = `${Math.min(zoneRef.current.scrollHeight, 160)}px`;
    }
  }, [saisie]);

  // Coupe proprement le micro si la carte se ferme/démonte en cours d'enregistrement.
  useEffect(() => () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const démarrerEnregistrement = async () => {
    setErreurMicro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const typeSupporté = ["audio/webm", "audio/mp4", "audio/ogg"]
        .find((type) => window.MediaRecorder.isTypeSupported?.(type));
      const recorder = new window.MediaRecorder(stream, typeSupporté ? { mimeType: typeSupporté } : undefined);

      morceauxRef.current = [];
      débutRef.current = Date.now();

      recorder.ondataavailable = (e) => { if (e.data.size > 0) morceauxRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((piste) => piste.stop());
        const dureeSecondes = (Date.now() - débutRef.current) / 1000;
        const blob = new Blob(morceauxRef.current, { type: recorder.mimeType || "audio/webm" });

        setEnTranscription(true);
        try {
          const texte = await transcrireAudio(blob, dureeSecondes);
          setSaisie((s) => (s ? `${s} ${texte}` : texte));
        } catch (err) {
          setErreurMicro(
            err.message === "SESSION_EXPIREE"
              ? t("dialogue.microSessionExpiree", "Session expirée — reconnectez-vous puis réessayez.")
              : t("dialogue.microErreur", "La transcription a échoué. Réessayez.")
          );
        } finally {
          setEnTranscription(false);
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setEnEnregistrement(true);
    } catch {
      setErreurMicro(t("dialogue.microRefuse", "Micro indisponible ou accès refusé."));
    }
  };

  const arrêterEnregistrement = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setEnEnregistrement(false);
  };

  const basculerMicro = () => {
    if (enEnregistrement) arrêterEnregistrement();
    else démarrerEnregistrement();
  };

  const envoyer = () => {
    const question = saisie.trim();
    if (!question || dialogue.enCours) return;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
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
        </div>
      ))}

      {dialogue.enCours && (
        <div style={{ fontSize: 11, color: "#999", marginBottom: 6 }}>{t("bouton.enCours")}</div>
      )}
      {dialogue.erreur && (
        <div style={{ fontSize: 11, color: "#A32D2D", marginBottom: 6 }}>{dialogue.erreur}</div>
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
          {microDisponible && (
            <button
              onClick={basculerMicro}
              disabled={dialogue.enCours || enTranscription}
              title={enEnregistrement ? t("dialogue.microArreter", "Arrêter la dictée") : t("dialogue.micro", "Dicter la question")}
              style={{
                flexShrink: 0, fontSize: 14, lineHeight: 1,
                width: 26, height: 26, borderRadius: "50%",
                border: "none", cursor: (dialogue.enCours || enTranscription) ? "default" : "pointer",
                background: enEnregistrement ? "#E24B4A" : "transparent",
                color: enEnregistrement ? "#fff" : couleur,
                fontFamily: "inherit", marginTop: 2,
                animation: enEnregistrement ? "pulseMicro 1.2s ease-in-out infinite" : "none",
                opacity: enTranscription ? 0.5 : 1,
              }}
            >
              🎙️
            </button>
          )}
        </div>
        <style>{`@keyframes pulseMicro{0%,100%{opacity:1}50%{opacity:0.55}}`}</style>
        {enEnregistrement && (
          <div style={{ fontSize: 10.5, color: "#E24B4A", marginTop: 2 }}>
            {t("dialogue.enEcoute", "🔴 À l'écoute…")}
          </div>
        )}
        {enTranscription && (
          <div style={{ fontSize: 10.5, color: "#999", marginTop: 2 }}>
            {t("dialogue.transcription", "Transcription en cours…")}
          </div>
        )}
        {erreurMicro && (
          <div style={{ fontSize: 10.5, color: "#A32D2D", marginTop: 2 }}>
            {erreurMicro}
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



function CarteSuggestion({ s, couleur, cléCarte, dialogue, onOuvrirDialogue, onEnvoyerQuestion, langueProjet }) {
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
      {dialogue?.ouvert && <FilDialogue dialogue={dialogue} couleur={couleur} langueProjet={langueProjet} onEnvoyer={(q) => onEnvoyerQuestion(cléCarte, q)} />}
    </div>
  );
}

function CartePersonnage({ p, cléCarte, dialogue, onOuvrirDialogue, onEnvoyerQuestion, langueProjet }) {
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
      {dialogue?.ouvert && <FilDialogue dialogue={dialogue} couleur={c} langueProjet={langueProjet} onEnvoyer={(q) => onEnvoyerQuestion(cléCarte, q)} />}
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

function CarteCoherence({ p, cléCarte, dialogue, onOuvrirDialogue, onEnvoyerQuestion, langueProjet }) {
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
      {dialogue?.ouvert && <FilDialogue dialogue={dialogue} couleur={s.c} langueProjet={langueProjet} onEnvoyer={(q) => onEnvoyerQuestion(cléCarte, q)} />}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CopiloteIA({ texteActif = "", texteSélectionné = "", typeProjet = "non-fiction", couleurProjet = "#7F77DD", projetTitre = "", titreNœud = "", typeNœud = "chapitre", titresEnfants = [], titrePartieParente = null, titresChapitresVoisins = [], langueProjet = "fr", projetId = null, onDemanderUpgrade = null }) {
  const { t } = useTranslation("copilote");
  const [contexteADN, setContexteADN] = useState(null);
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
    chargerContexteADN(projetId).then((c) => { if (!annulé) setContexteADN(c); });
    return () => { annulé = true; };
  }, [projetId]);
  const [onglet, setOnglet] = useState("suggestions");
  const [données, setDonnées] = useState({ suggestions: null, personnages: null, références: null, cohérence: null });
  const [chargement, setChargement] = useState({});
  const [erreur, setErreur] = useState({});
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

  const envoyerQuestionDialogue = useCallback(async (cléCarte, question) => {
    setDialogues((d) => ({
      ...d,
      [cléCarte]: {
        ...d[cléCarte],
        enCours: true,
        erreur: null,
        messages: [...(d[cléCarte]?.messages || []), { role: "auteur", contenu: question }],
      },
    }));

    try {
      const état = dialogues[cléCarte];
      const historique = [...(état?.messages || []), { role: "auteur", contenu: question }]
        .map((m) => `${m.role === "auteur" ? "Auteur" : "Co-pilote"} : ${m.contenu}`)
        .join("\n");
      const userContent = `Analyse initiale du co-pilote :\n"""\n${état?.contexteCarte || ""}\n"""\n\nÉchange avec l'auteur :\n${historique}`;

      const réponse = await appelClaude(
        promptDialogue(langueProjet),
        userContent,
        null,
        DIALOGUE_MAX_TOKENS
      );

      setDialogues((d) => ({
        ...d,
        [cléCarte]: {
          ...d[cléCarte],
          enCours: false,
          messages: [...(d[cléCarte]?.messages || []), { role: "copilote", contenu: réponse.trim() }],
        },
      }));
    } catch (err) {
      setDialogues((d) => ({
        ...d,
        [cléCarte]: { ...d[cléCarte], enCours: false, erreur: messageErreur(err) },
      }));
    }
  }, [dialogues, langueProjet, messageErreur]);

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
          const match = jsonStr.match(/"références"\s*:\s*\[[\s\S]*\]/);
          if (match) {
            const partial = JSON.parse(`{${match[0]}}`);
            setDonnées(d => ({ ...d, références: partial.références || [] }));
          } else {
            throw new Error("__ERREUR_GENERIQUE__");
          }
        }
      } else if (ongletCible === "cohérence") {
        résultat = await appelClaude(systemAvecLangue(PROMPTS.cohérence(typeProjet), langueProjet, contexteADN), `Texte :\n\n${texte}`, sig, 4096);
        const p = parserJSON(résultat);
        setDonnées(d => ({ ...d, cohérence: p.points || [] }));
      }

      setDernièreAnalyse(new Date().toLocaleTimeString(langueProjet === "en" ? "en-GB" : "fr-BE", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      if (err.name !== "AbortError") {
        setErreur(e => ({ ...e, [ongletCible]: messageErreur(err) }));
      }
    } finally {
      setChargement(c => ({ ...c, [ongletCible]: false }));
    }
  }, [texteActif, texteSélectionné, analyserSélection, typeProjet, projetTitre, langueProjet, contexteADN, t, messageErreur]);

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

  useEffect(() => {
    if (modeAuto) {
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
      </div>

      {/* Corps */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 12px" }}>
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
                </div>
              ) : t("videEtat.suggestions")
            )}
            {onglet === "personnages" && t("videEtat.personnages")}
            {onglet === "références" && t("videEtat.references")}
            {onglet === "cohérence" && t("videEtat.coherence")}
          </div>
        )}

        {onglet === "suggestions" && Array.isArray(données_onglet) && données_onglet.map((s, i) => <CarteSuggestion key={i} s={s} couleur={couleurProjet} cléCarte={`suggestions:${i}`} dialogue={dialogues[`suggestions:${i}`]} onOuvrirDialogue={ouvrirDialogue} onEnvoyerQuestion={envoyerQuestionDialogue} langueProjet={langueProjet} />)}
        {onglet === "personnages" && Array.isArray(données_onglet) && (données_onglet.length === 0 ? <p style={{ fontSize: 12, color: "#999", textAlign: "center" }}>{t("personnages.aucun")}</p> : données_onglet.map((p, i) => <CartePersonnage key={i} p={p} cléCarte={`personnages:${i}`} dialogue={dialogues[`personnages:${i}`]} onOuvrirDialogue={ouvrirDialogue} onEnvoyerQuestion={envoyerQuestionDialogue} langueProjet={langueProjet} />))}
        {onglet === "références" && Array.isArray(données_onglet) && (données_onglet.length === 0 ? <p style={{ fontSize: 12, color: "#999", textAlign: "center" }}>{t("references.aucune")}</p> : données_onglet.map((r, i) => <CarteRéférence key={i} r={r} />))}
        {onglet === "cohérence" && Array.isArray(données_onglet) && (données_onglet.length === 0 ? <p style={{ fontSize: 12, color: "#1D9E75", textAlign: "center" }}>{t("coherence.aucunProbleme")}</p> : données_onglet.map((p, i) => <CarteCoherence key={i} p={p} cléCarte={`coherence:${i}`} dialogue={dialogues[`coherence:${i}`]} onOuvrirDialogue={ouvrirDialogue} onEnvoyerQuestion={envoyerQuestionDialogue} langueProjet={langueProjet} />))}
      </div>
    </div>
  );
}


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

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase.js";
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

async function appelClaude(system, user, signal, maxTokens = 1000, tools = null) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error("SESSION_EXPIREE");
  }

  const corpsRequête = {
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
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
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
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
};

function systemAvecLangue(promptBase, langueProjet, contexteADN) {
  const instruction = INSTRUCTION_LANGUE[langueProjet] || INSTRUCTION_LANGUE.fr;
  const blocADN = contexteADN
    ? `CONTEXTE DU PROJET — réponses de l'auteur au questionnaire d'intention (à respecter impérativement dans ton comportement, pas seulement à titre informatif) :\n${contexteADN}\n\n`
    : "";
  return `${blocADN}${promptBase}\n\n${instruction} (Les clés JSON restent telles quelles ; seules les valeurs textuelles sont dans cette langue.)`;
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

    const lignes = [];
    (citations || []).forEach((c) => {
      const source = c.livres ? `${c.livres.titre} (${c.livres.auteur})` : "source inconnue";
      lignes.push(`- Citation [${source}${c.page ? `, p.${c.page}` : ""}] : "${c.texte}"`);
    });
    (idées || []).forEach((i) => {
      lignes.push(`- Idée notée : ${i.texte}`);
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
// répond dans le fil — un appel Claude léger (1024 tokens), pas une
// nouvelle analyse.
const DIALOGUE_MAX_TOKENS = 1024;

function promptDialogue(langueProjet) {
  const instruction = INSTRUCTION_LANGUE[langueProjet] || INSTRUCTION_LANGUE.fr;
  return `Tu es le co-pilote d'un écrivain. Tu as déjà produit une analyse précise (fournie ci-dessous) sur un passage de son texte. L'auteur te pose maintenant une question de suivi sur CETTE analyse précise — il veut creuser, comprendre ton raisonnement, ou te challenger sur ce point exact. Réponds directement à sa question, de façon conversationnelle et précise, en t'appuyant sur l'analyse d'origine sans la répéter intégralement. Ne redemande jamais le texte complet du chapitre : tout ce dont tu as besoin est dans l'analyse fournie et l'échange en cours.

RÈGLE NON NÉGOCIABLE sur les personnes nommées : si ta réponse (ou l'analyse d'origine que tu développes) mentionne une personne nommée dans le texte de l'auteur, ne lui attribue jamais de trait de caractère, de qualité ou de fait que l'auteur n'a pas lui-même écrit — que ce soit dans ta première réponse ou dans une reformulation que tu proposes ici. Si l'auteur te fait remarquer que tu as inventé une caractérisation, reconnais-le sans détour : ne cherche pas à justifier ou à minimiser l'invention.

${instruction}`;
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

function FilDialogue({ dialogue, onEnvoyer, couleur, langueProjet }) {
  const { t } = useTranslation("copilote");
  const [saisie, setSaisie] = useState("");
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
        </div>
      ))}

      {dialogue.enCours && (
        <div style={{ fontSize: 11, color: "#999", marginBottom: 6 }}>{t("bouton.enCours")}</div>
      )}
      {dialogue.erreur && (
        <div style={{ fontSize: 11, color: "#A32D2D", marginBottom: 6 }}>{dialogue.erreur}</div>
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



function CarteSuggestion({ s, couleur, cléCarte, dialogue, onOuvrirDialogue, onEnvoyerQuestion, langueProjet }) {
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
      {dialogue?.ouvert && <FilDialogue dialogue={dialogue} couleur={couleur} langueProjet={langueProjet} onEnvoyer={(q) => onEnvoyerQuestion(cléCarte, q)} />}
    </div>
  );
}

function CartePersonnage({ p, cléCarte, dialogue, onOuvrirDialogue, onEnvoyerQuestion, langueProjet }) {
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
      {dialogue?.ouvert && <FilDialogue dialogue={dialogue} couleur={c} langueProjet={langueProjet} onEnvoyer={(q) => onEnvoyerQuestion(cléCarte, q)} />}
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

function CarteCoherence({ p, cléCarte, dialogue, onOuvrirDialogue, onEnvoyerQuestion, langueProjet }) {
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
      {dialogue?.ouvert && <FilDialogue dialogue={dialogue} couleur={s.c} langueProjet={langueProjet} onEnvoyer={(q) => onEnvoyerQuestion(cléCarte, q)} />}
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

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CopiloteIA({ texteActif = "", texteSélectionné = "", typeProjet = "non-fiction", couleurProjet = "#7F77DD", projetTitre = "", titreNœud = "", typeNœud = "chapitre", titresEnfants = [], titrePartieParente = null, titresChapitresVoisins = [], langueProjet = "fr", projetId = null, nœudId = null, onDemanderUpgrade = null }) {
  const { t } = useTranslation("copilote");
  const [contexteADN, setContexteADN] = useState(null);
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
    chargerContexteADN(projetId).then((c) => { if (!annulé) setContexteADN(c); });
    return () => { annulé = true; };
  }, [projetId]);
  const [onglet, setOnglet] = useState("suggestions");
  const [données, setDonnées] = useState({ suggestions: null, personnages: null, références: null, cohérence: null, vérification: null });
  const [chargement, setChargement] = useState({});
  const [erreur, setErreur] = useState({});
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

  const envoyerQuestionDialogue = useCallback(async (cléCarte, question) => {
    setDialogues((d) => ({
      ...d,
      [cléCarte]: {
        ...d[cléCarte],
        enCours: true,
        erreur: null,
        messages: [...(d[cléCarte]?.messages || []), { role: "auteur", contenu: question }],
      },
    }));

    try {
      const état = dialogues[cléCarte];
      const historique = [...(état?.messages || []), { role: "auteur", contenu: question }]
        .map((m) => `${m.role === "auteur" ? "Auteur" : "Co-pilote"} : ${m.contenu}`)
        .join("\n");
      const userContent = `Analyse initiale du co-pilote :\n"""\n${état?.contexteCarte || ""}\n"""\n\nÉchange avec l'auteur :\n${historique}`;

      const réponse = await appelClaude(
        promptDialogue(langueProjet),
        userContent,
        null,
        DIALOGUE_MAX_TOKENS
      );

      setDialogues((d) => ({
        ...d,
        [cléCarte]: {
          ...d[cléCarte],
          enCours: false,
          messages: [...(d[cléCarte]?.messages || []), { role: "copilote", contenu: réponse.trim() }],
        },
      }));
    } catch (err) {
      setDialogues((d) => ({
        ...d,
        [cléCarte]: { ...d[cléCarte], enCours: false, erreur: messageErreur(err) },
      }));
    }
  }, [dialogues, langueProjet, messageErreur]);

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
          const match = jsonStr.match(/"références"\s*:\s*\[[\s\S]*\]/);
          if (match) {
            const partial = JSON.parse(`{${match[0]}}`);
            setDonnées(d => ({ ...d, références: partial.références || [] }));
          } else {
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
      </div>

      {/* Corps */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 12px" }}>
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
                </div>
              ) : t("videEtat.suggestions")
            )}
            {onglet === "personnages" && t("videEtat.personnages")}
            {onglet === "références" && t("videEtat.references")}
            {onglet === "cohérence" && t("videEtat.coherence")}
            {onglet === "vérification" && t("videEtat.verification", "Vérification approfondie à deux IA (Claude + GPT) d'une affirmation précise du passage. Peut prendre jusqu'à 30 secondes.")}
          </div>
        )}

        {onglet === "suggestions" && Array.isArray(données_onglet) && données_onglet.map((s, i) => <CarteSuggestion key={i} s={s} couleur={couleurProjet} cléCarte={`suggestions:${i}`} dialogue={dialogues[`suggestions:${i}`]} onOuvrirDialogue={ouvrirDialogue} onEnvoyerQuestion={envoyerQuestionDialogue} langueProjet={langueProjet} />)}
        {onglet === "personnages" && Array.isArray(données_onglet) && (données_onglet.length === 0 ? <p style={{ fontSize: 12, color: "#999", textAlign: "center" }}>{t("personnages.aucun")}</p> : données_onglet.map((p, i) => <CartePersonnage key={i} p={p} cléCarte={`personnages:${i}`} dialogue={dialogues[`personnages:${i}`]} onOuvrirDialogue={ouvrirDialogue} onEnvoyerQuestion={envoyerQuestionDialogue} langueProjet={langueProjet} />))}
        {onglet === "références" && Array.isArray(données_onglet) && (données_onglet.length === 0 ? <p style={{ fontSize: 12, color: "#999", textAlign: "center" }}>{t("references.aucune")}</p> : données_onglet.map((r, i) => <CarteRéférence key={i} r={r} />))}
        {onglet === "cohérence" && Array.isArray(données_onglet) && (données_onglet.length === 0 ? <p style={{ fontSize: 12, color: "#1D9E75", textAlign: "center" }}>{t("coherence.aucunProbleme")}</p> : données_onglet.map((p, i) => <CarteCoherence key={i} p={p} cléCarte={`coherence:${i}`} dialogue={dialogues[`coherence:${i}`]} onOuvrirDialogue={ouvrirDialogue} onEnvoyerQuestion={envoyerQuestionDialogue} langueProjet={langueProjet} />))}
        {onglet === "vérification" && données_onglet && !Array.isArray(données_onglet) && <PanneauVerification résultat={données_onglet} />}
      </div>
    </div>
  );
}


