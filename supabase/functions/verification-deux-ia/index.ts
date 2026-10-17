/**
 * CURSUS ÉDITION — Edge Function : verification-deux-ia (protocole 60805-06)
 * ============================================================================
 * Implémente docs/protocole-verification-approfondie-deux-ia.md à la lettre
 * (étape 0 à 7, logigramme d'orchestration).
 *
 * FICHIER AUTONOME (16/08/2026) : le module d'appel IA structuré, à l'origine
 * dans supabase/functions/_shared/moteur-ia-structure.ts, est inliné ici
 * directement. Cause du changement : déployée via le Dashboard (collage du
 * seul index.ts), la fonction ne pouvait pas résoudre l'import relatif vers
 * _shared — l'isolate Deno échouait à démarrer pour CHAQUE requête, sans
 * jamais exécuter une ligne de mon code (confirmé par les logs Supabase :
 * event_type "Shutdown", reason "EarlyDrop", aucune trace d'exécution).
 * Le fichier _shared/moteur-ia-structure.ts reste dans le dépôt pour un futur
 * déploiement par CLI (qui embarque tout le dossier supabase/functions/),
 * mais cette fonction-ci n'en dépend plus — un seul fichier à coller suffit,
 * quelle que soit la méthode de déploiement.
 *
 * LIMITES CONNUES DE CETTE PREMIÈRE VERSION (documentées, pas cachées) :
 *  - Étape 0 est mécanique comme l'exige le protocole, mais la détection de
 *    "thèmes" et de "reprises sémantiques" reste un simple appariement par
 *    mot-clé (ILIKE) — la reprise "sémantique" au sens propre n'est pas
 *    implémentée (nécessiterait des embeddings, hors périmètre ici).
 *  - `changements_de_registre` n'est volontairement pas rempli par l'étape 0
 *    (classer un registre par liste de mots produirait une fausse précision)
 *    — chaque `claim` de Claude porte son propre `registre`, c'est la source
 *    de vérité pour ce signal.
 *  - `verdict_these_livre` (verdict sur la thèse du livre, distinct du
 *    verdict local) n'est pas calculé dans cette version : le protocole
 *    documente le besoin des deux verdicts mais ne décrit pas de mécanisme
 *    pour évaluer la thèse d'ensemble à partir d'un dialogue sur un seul
 *    passage — laissé à `null` plutôt qu'inventé.
 *  - `alignement_interet` et `zones_sous_expertise_requise` restent aux
 *    valeurs par défaut du dossier de contexte (non calculées mécaniquement,
 *    comme le squelette du protocole le suggère) — ce sont les tours IA qui
 *    les signalent via corrections_bloquantes le cas échéant.
 *  - MODELE_CLAUDE / MODELE_GPT ci-dessous sont des valeurs par défaut,
 *    à vérifier/mettre à jour — surchageables via le corps de la requête
 *    (`modele_claude`, `modele_gpt`).
 *
 * VÉRIFICATION EXTERNE DES AFFIRMATIONS THÉORIQUES/FACTUELLES (17/10/2026) :
 * point 1 du GO/NO-GO fiabilité des IA (CLAUDE.md, 03/10/2026) — ce protocole
 * ne donnait jusqu'ici à Claude et GPT AUCUN accès à une source extérieure à
 * eux-mêmes : deux IA qui débattent entre elles, jamais une preuve
 * indépendante (le risque nommé explicitement, ex. "attribution correcte
 * d'une idée à Jung"). Traitement mécanique, pas une "3e IA" : même principe
 * que CopiloteIA pour l'onglet Références (CLAUDE.md, 03/10/2026).
 *  - Le tour Claude (A1/A2, rôle "analyseur_initial") dispose maintenant de
 *    l'outil `web_search` natif d'Anthropic, dans le MÊME appel que celui qui
 *    produit la sortie structurée (`tool_choice` passe de forcé à "auto" dès
 *    que la recherche est activée, pour laisser Claude chercher puis conclure
 *    dans le même tour — combinaison non testée ailleurs dans ce dépôt,
 *    CopiloteIA utilisant la recherche web UNIQUEMENT avec une sortie texte
 *    libre, jamais avec un tool_choice forcé sur un second outil).
 *  - Chaque `claim` de registre "theorique_general" ou "symbolique_spirituel"
 *    porte maintenant `source_verification` (URL revendiquée par Claude) et,
 *    après coup, `source_confirmée` : calculé par `recouperClaimsAvecRecherche`
 *    (pure, aucun appel IA) contre les résultats RÉELLEMENT renvoyés par
 *    l'outil pendant ce tour — peut seulement RÉTROGRADER vers `false`,
 *    jamais confirmer sur la seule parole du modèle. GPT voit ce signal dans
 *    `tour_precedent` et est explicitement averti de ne jamais le traiter
 *    comme acquis s'il est absent ou faux.
 *  - PAS FAIT dans cette passe, assumé : GPT n'a toujours aucun accès à une
 *    recherche indépendante — l'outil `web_search` hébergé d'OpenAI n'existe
 *    que sur l'API Responses (`/v1/responses`), pas sur Chat Completions
 *    (`/v1/chat/completions`, utilisée ici pour sa sortie JSON stricte) ;
 *    migrer uniquement pour ça était jugé hors périmètre de ce premier
 *    correctif. GPT bénéficie malgré tout d'un vrai signal non auto-déclaré
 *    (celui de Claude, recoupé mécaniquement), ce qu'il n'avait jamais eu
 *    avant. Pas de "Layer 2" non plus (relire soi-même la page confirmée
 *    pour vérifier que la citation exacte y figure) — seule l'existence
 *    réelle de l'URL est confirmée, pas le contenu précis de la page, comme
 *    pour les Références de CopiloteIA.
 *
 * SECRETS REQUIS : ANTHROPIC_KEY, OPENAI_API_KEY, SUPABASE_URL,
 * SERVICE_ROLE_KEY (tous déjà en place, voir P0a/P0b).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Ajv from "https://esm.sh/ajv@8?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const MODELE_CLAUDE = "claude-sonnet-5";
const MODELE_GPT = "gpt-4o";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

// ─── Schémas de sortie structurée (partagés entre les deux moteurs) ────────

const SCHEMA_CORRECTION = {
  type: "object",
  properties: {
    texte: { type: "string" },
    categorie: {
      type: "string",
      enum: [
        "valeur_ajoutee_editoriale",
        "corrections_probables",
        "alertes_a_verifier_sur_source",
        "remarques_non_bloquantes",
      ],
    },
  },
  required: ["texte", "categorie"],
  additionalProperties: false,
};

const SCHEMA_ALERTE_CONTEXTE_CHAMPS = {
  type_contexte_manquant: {
    type: ["string", "null"],
    enum: [
      "occurrences_aval",
      "contexte_amont",
      "definition_theorique",
      "intention_auteur",
      "passage_pedagogique",
      "offre_commerciale",
      null,
    ],
  },
  theme_a_rechercher: { type: ["string", "null"] },
  raison_alerte: { type: ["string", "null"] },
  requete_ciblee: { type: "array", items: { type: "string" } },
};

const SCHEMA_TOUR_CLAUDE = {
  type: "object",
  properties: {
    tour: { type: "string" },
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          affirmation: { type: "string" },
          registre: {
            type: "string",
            enum: [
              "phenomenologique",
              "autobiographique_interpretatif",
              "symbolique_spirituel",
              "theorique_general",
              "pedagogique",
              "prescriptif",
            ],
          },
          // 17/10/2026 — voir note en tête de fichier. Rempli seulement pour
          // un registre theorique_general/symbolique_spirituel que la
          // recherche web a réellement confirmé ; recoupé mécaniquement
          // après coup par recouperClaimsAvecRecherche, jamais pris pour
          // argent comptant.
          source_verification: { type: ["string", "null"] },
        },
        required: ["affirmation", "registre", "source_verification"],
        additionalProperties: false,
      },
    },
    analyse: { type: "string" },
    corrections_bloquantes: { type: "array", items: SCHEMA_CORRECTION },
    corrections_non_bloquantes: { type: "array", items: SCHEMA_CORRECTION },
    alerte_contexte: { type: "boolean" },
    ...SCHEMA_ALERTE_CONTEXTE_CHAMPS,
    peut_arreter: { type: "boolean" },
    reponse_optimale_auteur: { type: ["string", "null"] },
  },
  required: [
    "tour", "claims", "analyse", "corrections_bloquantes", "corrections_non_bloquantes",
    "alerte_contexte", "type_contexte_manquant", "theme_a_rechercher", "raison_alerte",
    "requete_ciblee", "peut_arreter", "reponse_optimale_auteur",
  ],
  additionalProperties: false,
};

const SCHEMA_TOUR_GPT = {
  type: "object",
  properties: {
    tour: { type: "string" },
    statut: {
      type: "string",
      enum: ["accord", "accord_avec_nuances", "desaccord_partiel", "desaccord_majeur"],
    },
    corrections_bloquantes: { type: "array", items: SCHEMA_CORRECTION },
    corrections_non_bloquantes: { type: "array", items: SCHEMA_CORRECTION },
    alerte_contexte: { type: "boolean" },
    ...SCHEMA_ALERTE_CONTEXTE_CHAMPS,
    peut_arreter: { type: "boolean" },
    verdict: {
      type: "string",
      enum: ["recevable", "recevable_avec_reserves", "correction_recommandee", "verdict_provisoire"],
    },
    reponse_optimale_auteur: { type: ["string", "null"] },
  },
  required: [
    "tour", "statut", "corrections_bloquantes", "corrections_non_bloquantes", "alerte_contexte",
    "type_contexte_manquant", "theme_a_rechercher", "raison_alerte", "requete_ciblee",
    "peut_arreter", "verdict", "reponse_optimale_auteur",
  ],
  additionalProperties: false,
};

// ─── Étape 0 — cartographie contextuelle mécanique (jamais une IA) ─────────

const MOTS_VIDES = new Set([
  "dans", "avec", "pour", "cette", "leur", "leurs", "elle", "elles",
  "nous", "vous", "quand", "comme", "mais", "donc", "alors", "être", "avoir",
  "fait", "faire", "sans", "plus", "moins", "très", "tout", "tous", "toute",
  "toutes", "ainsi", "aussi", "encore", "déjà", "jamais", "toujours", "entre",
]);

function extraireThemes(texte: string): string[] {
  const themes = new Map<string, number>();

  // Séquences capitalisées (candidats noms propres / concepts nommés).
  const propres = texte.match(/\b[A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)*\b/g) ?? [];
  for (const p of propres) {
    themes.set(p, (themes.get(p) ?? 0) + 2); // poids plus fort qu'un mot courant
  }

  // Mots courants significatifs (longueur ≥ 5, hors mots vides).
  const mots = texte.toLowerCase().match(/\p{L}{5,}/gu) ?? [];
  for (const m of mots) {
    if (MOTS_VIDES.has(m)) continue;
    themes.set(m, (themes.get(m) ?? 0) + 1);
  }

  return [...themes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([theme]) => theme);
}

function extraireVerbatim(texteNoeud: string, theme: string, marge = 120): string | null {
  const idx = texteNoeud.toLowerCase().indexOf(theme.toLowerCase());
  if (idx === -1) return null;
  const debut = Math.max(0, idx - marge);
  const fin = Math.min(texteNoeud.length, idx + theme.length + marge);
  return (debut > 0 ? "…" : "") + texteNoeud.slice(debut, fin).replace(/\s+/g, " ").trim() + (fin < texteNoeud.length ? "…" : "");
}

interface OccurrencePertinente {
  theme: string;
  node_id: string;
  extrait: string;
  fonction: string;
}

async function rechercherOccurrences(
  admin: ReturnType<typeof createClient>,
  projetId: string,
  exclureNoeudId: string | null,
  themes: string[],
): Promise<OccurrencePertinente[]> {
  if (themes.length === 0) return [];

  let requete = admin.from("noeuds").select("id, texte").eq("projet_id", projetId).not("texte", "is", null);
  if (exclureNoeudId) requete = requete.neq("id", exclureNoeudId);
  const { data: noeuds } = await requete;
  if (!noeuds) return [];

  const occurrences: OccurrencePertinente[] = [];
  for (const theme of themes) {
    let trouvesPourCeTheme = 0;
    for (const noeud of noeuds) {
      if (trouvesPourCeTheme >= 3) break; // recherche ciblée, pas exhaustive
      if (!noeud.texte) continue;
      const extrait = extraireVerbatim(noeud.texte, theme);
      if (!extrait) continue;
      occurrences.push({
        theme,
        node_id: noeud.id,
        extrait,
        fonction: "occurrence du thème détectée par recherche mot-clé dans ce nœud (à interpréter par l'analyse, pas une conclusion de Cursus)",
      });
      trouvesPourCeTheme++;
    }
  }
  return occurrences;
}

interface DossierContexte {
  metadata: Record<string, unknown>;
  intention_auteur: Record<string, unknown> | null;
  themes_detectes: string[];
  occurrences_pertinentes: OccurrencePertinente[];
  changements_de_registre: unknown[];
  changements_de_personne: { marqueur: string; occurrences: number }[];
  alignement_interet: null;
  zones_sous_expertise_requise: unknown[];
  couverture_manuscrit: number;
  contexte_suffisant: boolean;
  contexte_relance_count: number;
}

function detecterChangementsDePersonne(texte: string): { marqueur: string; occurrences: number }[] {
  const marqueurs: Record<string, RegExp> = {
    je: /\b(je|j'|mon|ma|mes)\b/gi,
    nous: /\b(nous|notre|nos)\b/gi,
    vous: /\b(vous|votre|vos)\b/gi,
    on: /\bon\b/gi,
  };
  const résultat: { marqueur: string; occurrences: number }[] = [];
  for (const [marqueur, regex] of Object.entries(marqueurs)) {
    const occurrences = (texte.match(regex) ?? []).length;
    if (occurrences > 0) résultat.push({ marqueur, occurrences });
  }
  return résultat;
}

async function construireDossierContexte(
  admin: ReturnType<typeof createClient>,
  projetId: string,
  noeudId: string | null,
  texteSelectionne: string,
  intentionDeclaree: Record<string, unknown> | null,
): Promise<DossierContexte> {
  const { data: projet } = await admin
    .from("projets")
    .select("titre, genre, description")
    .eq("id", projetId)
    .maybeSingle();

  const { data: tousLesNoeuds } = await admin
    .from("noeuds")
    .select("id, texte")
    .eq("projet_id", projetId);

  const total = tousLesNoeuds?.length ?? 0;
  const remplis = (tousLesNoeuds ?? []).filter((n) => (n.texte ?? "").trim().length > 0).length;
  const couvertureManuscrit = total > 0 ? remplis / total : 0;

  const themes = extraireThemes(texteSelectionne);
  const occurrences = await rechercherOccurrences(admin, projetId, noeudId, themes);
  const changementsDePersonne = detecterChangementsDePersonne(texteSelectionne);

  // Heuristique de suffisance — documentée, ajustable : un contexte est
  // jugé suffisant si des occurrences réelles ont été trouvées ailleurs
  // dans le projet, ou si le manuscrit est déjà largement rempli (le
  // passage a alors plus de chances d'être auto-suffisant).
  const contexteSuffisant = occurrences.length > 0 || couvertureManuscrit >= 0.5;

  return {
    metadata: { titre: projet?.titre ?? null, genre: projet?.genre ?? null },
    intention_auteur: intentionDeclaree,
    themes_detectes: themes,
    occurrences_pertinentes: occurrences,
    changements_de_registre: [],
    changements_de_personne: changementsDePersonne,
    alignement_interet: null,
    zones_sous_expertise_requise: [],
    couverture_manuscrit: Math.round(couvertureManuscrit * 100) / 100,
    contexte_suffisant: contexteSuffisant,
    contexte_relance_count: 0,
  };
}

async function enrichirDossier(
  admin: ReturnType<typeof createClient>,
  dossier: DossierContexte,
  projetId: string,
  noeudId: string | null,
  requeteCiblee: string[],
): Promise<DossierContexte> {
  const nouvellesOccurrences = await rechercherOccurrences(admin, projetId, noeudId, requeteCiblee);
  return {
    ...dossier,
    occurrences_pertinentes: [...dossier.occurrences_pertinentes, ...nouvellesOccurrences],
    contexte_relance_count: dossier.contexte_relance_count + 1,
    contexte_suffisant: nouvellesOccurrences.length > 0 ? true : dossier.contexte_suffisant,
  };
}

// ─── Suivi de consommation (répliqué de claude-prox) ───────────────────────

interface AppelJournalise {
  tour: string;
  modele: string;
  tokens_entree: number;
  tokens_sortie: number;
}

// ─── Module IA structuré (inliné — voir note en tête de fichier) ──────────

interface AppelMoteurIAParams {
  moteur: "claude" | "gpt";
  modele: string;
  role: string;
  schema_sortie: Record<string, unknown>;
  system: string;
  contexte: string;
  max_tokens?: number;
  /** Claude uniquement (17/10/2026) — voir note en tête de fichier. */
  avecRechercheWeb?: boolean;
}

interface UsageIA {
  tokens_entree: number;
  tokens_sortie: number;
  modele: string;
}

interface RésultatRecherche {
  url: string;
  titre: string;
}

interface AppelMoteurIAResultat {
  data: unknown;
  usage: UsageIA;
  /** Résultats RÉELS de web_search pendant cet appel (Claude uniquement, [] sinon). */
  résultatsRecherche: RésultatRecherche[];
}

const OUTIL_RECHERCHE_WEB = { type: "web_search_20250305", name: "web_search", max_uses: 5 };

const ajv = new Ajv({ allErrors: true, strict: false });

function validerContreSchema(data: unknown, schema: Record<string, unknown>): void {
  const valide = ajv.compile(schema);
  if (!valide(data)) {
    throw new Error(`Sortie IA non conforme au schéma attendu : ${ajv.errorsText(valide.errors)}`);
  }
}

/**
 * Tolère "null" comme représentation de tableau vide — les modèles rendent
 * parfois `null` plutôt que `[]` pour un champ tableau sans élément (observé
 * en usage réel le 16/08/2026, "claims" de Claude). Ne touche à rien
 * d'autre : un champ manquant, ou de type incorrect autrement, reste rejeté
 * par validerContreSchema comme avant.
 */
function normaliserTableauxNuls(schema: Record<string, unknown>, data: unknown): unknown {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return data;
  const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const résultat: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const [cle, sousSchema] of Object.entries(props)) {
    if (sousSchema.type === "array" && (résultat[cle] === null || résultat[cle] === undefined)) {
      résultat[cle] = [];
    }
  }
  return résultat;
}

// Mise en cache (12/09/2026) — voir le commentaire complet dans
// orchestrer-audit-cursaudit/analyser-unite-cursaudit. `params.system` est
// en pratique une chaîne parmi deux valeurs fixes selon le tour (A1 ou A2,
// voir plus bas où "consigne" est toujours l'une de deux chaînes statiques,
// jamais générée dynamiquement) — reste donc identique d'un appel à
// l'autre pour un même tour, réutilisable en cache sans restructuration.
async function appellerClaudeMoteur(params: AppelMoteurIAParams): Promise<AppelMoteurIAResultat> {
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_KEY manquante.");

  const nomOutil = "sortie_structuree";
  const outils: Record<string, unknown>[] = [];
  if (params.avecRechercheWeb) outils.push(OUTIL_RECHERCHE_WEB);
  outils.push({ name: nomOutil, description: `Sortie structurée pour le rôle "${params.role}".`, input_schema: params.schema_sortie });
  // 17/10/2026 — voir note en tête de fichier : dès que web_search est
  // offert, tool_choice ne force plus directement sortie_structuree ("auto"
  // laisse Claude chercher d'abord, server-side, dans le MÊME tour, puis
  // conclure par l'appel à sortie_structuree) ; sans recherche, comportement
  // strictement inchangé (forcé comme avant).
  const toolChoice = params.avecRechercheWeb ? { type: "auto" } : { type: "tool", name: nomOutil };

  const réponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.modele,
      max_tokens: params.max_tokens ?? 4096,
      // CORRECTIF 01/10/2026 — même cause que celle trouvée côté CopiloteIA
      // (Journal des erreurs : stop_reason="max_tokens", blocs=[thinking]) :
      // désactivé partout où Claude est appelé directement par Cursus, par
      // précaution.
      thinking: { type: "disabled" },
      system: [{ type: "text", text: params.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: params.contexte }],
      tools: outils,
      tool_choice: toolChoice,
    }),
  });

  const résultat = await réponse.json();
  if (!réponse.ok) {
    throw new Error(résultat?.error?.message || `Échec de l'appel Claude (${réponse.status}).`);
  }

  // Résultats RÉELS de web_search (voir CopiloteIA:appelClaude, même
  // extraction) — url/title en clair dans la réponse Anthropic.
  const résultatsRecherche: RésultatRecherche[] = (résultat.content ?? [])
    .filter((b: { type: string }) => b.type === "web_search_tool_result")
    .flatMap((b: { content?: unknown[] }) => (Array.isArray(b.content) ? b.content : []))
    .filter((r: { type?: string; url?: string }) => r?.type === "web_search_result" && r.url)
    .map((r: { url: string; title?: string }) => ({ url: r.url, titre: r.title || "" }));

  const blocOutil = (résultat.content ?? []).find((bloc: { type: string; name?: string }) => bloc.type === "tool_use" && bloc.name === nomOutil);
  if (!blocOutil) {
    throw new Error("Claude n'a renvoyé aucun bloc tool_use pour la sortie structurée — sortie absente (peut-être resté en recherche web sans conclure).");
  }

  const donneesNormalisees = normaliserTableauxNuls(params.schema_sortie, blocOutil.input);
  validerContreSchema(donneesNormalisees, params.schema_sortie);

  return {
    data: donneesNormalisees,
    usage: {
      tokens_entree: résultat.usage?.input_tokens ?? 0,
      tokens_sortie: résultat.usage?.output_tokens ?? 0,
      modele: résultat.model ?? params.modele,
    },
    résultatsRecherche,
  };
}

async function appellerGPTMoteur(params: AppelMoteurIAParams): Promise<AppelMoteurIAResultat> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquante.");

  const réponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: params.modele,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.contexte },
      ],
      response_format: { type: "json_schema", json_schema: { name: "sortie_structuree", schema: params.schema_sortie, strict: true } },
    }),
  });

  const résultat = await réponse.json();
  if (!réponse.ok) {
    throw new Error(résultat?.error?.message || `Échec de l'appel GPT (${réponse.status}).`);
  }

  const contenuBrut = résultat.choices?.[0]?.message?.content;
  if (!contenuBrut) {
    throw new Error("GPT n'a renvoyé aucun contenu — sortie structurée absente.");
  }

  let data: unknown;
  try {
    data = JSON.parse(contenuBrut);
  } catch {
    throw new Error("Sortie GPT non parsable en JSON malgré response_format json_schema.");
  }

  const donneesNormalisees = normaliserTableauxNuls(params.schema_sortie, data);
  validerContreSchema(donneesNormalisees, params.schema_sortie);

  return {
    data: donneesNormalisees,
    usage: {
      tokens_entree: résultat.usage?.prompt_tokens ?? 0,
      tokens_sortie: résultat.usage?.completion_tokens ?? 0,
      modele: résultat.model ?? params.modele,
    },
    // GPT n'a pas d'accès à une recherche web indépendante dans cette passe
    // (voir note en tête de fichier) — jamais de résultats à recouper ici.
    résultatsRecherche: [],
  };
}

async function appellerMoteurIAStructure(params: AppelMoteurIAParams): Promise<AppelMoteurIAResultat> {
  if (params.moteur === "claude") return appellerClaudeMoteur(params);
  if (params.moteur === "gpt") return appellerGPTMoteur(params);
  throw new Error(`Moteur IA inconnu : "${params.moteur}".`);
}

// ─── Recoupement mécanique des affirmations théoriques (17/10/2026) ───────
// Même principe que CopiloteIA (CLAUDE.md, 03/10/2026, onglet Références,
// recouperRéférencesAvecRecherche) : aucun appel IA ici, une simple
// comparaison de chaînes contre les résultats RÉELLEMENT renvoyés par
// l'outil de recherche web pendant CE tour précis. Peut seulement
// RÉTROGRADER (source_confirmée: false), jamais remonter un statut.
const REGISTRES_FACTUELS = new Set(["theorique_general", "symbolique_spirituel"]);

function normaliserURLClaim(url: unknown): string {
  if (!url || typeof url !== "string") return "";
  try {
    const u = new URL(url);
    return (u.hostname + u.pathname).toLowerCase().replace(/\/+$/, "").replace(/^www\./, "");
  } catch {
    return url.toLowerCase().trim();
  }
}

function recouperClaimsAvecRecherche(claims: unknown, résultatsRecherche: RésultatRecherche[]): unknown {
  if (!Array.isArray(claims)) return claims;
  const urlsRéelles = new Set(résultatsRecherche.map((r) => normaliserURLClaim(r.url)).filter(Boolean));
  return claims.map((c) => {
    if (!c || typeof c !== "object") return c;
    const claim = c as Record<string, unknown>;
    if (!REGISTRES_FACTUELS.has(String(claim.registre))) return claim;
    const urlNormalisée = normaliserURLClaim(claim.source_verification);
    const confirmée = !!urlNormalisée && urlsRéelles.has(urlNormalisée);
    return { ...claim, source_confirmée: confirmée };
  });
}

/** Rassemble, tous tours confondus, les affirmations factuelles/théoriques
 * jamais confirmées mécaniquement — pour que la sortie finale les signale
 * explicitement plutôt que de laisser l'auteur·e y faire confiance sur la
 * seule parole d'une IA (voir note en tête de fichier, point 1 du GO/NO-GO). */
function recueillirClaimsNonConfirmées(tours: Record<string, Record<string, unknown>>): Record<string, unknown>[] {
  const résultat: Record<string, unknown>[] = [];
  for (const [nomTour, tour] of Object.entries(tours)) {
    const claims = tour.claims;
    if (!Array.isArray(claims)) continue;
    for (const c of claims) {
      if (!c || typeof c !== "object") continue;
      const claim = c as Record<string, unknown>;
      if (REGISTRES_FACTUELS.has(String(claim.registre)) && claim.source_confirmée !== true) {
        résultat.push({ ...claim, tour: nomTour });
      }
    }
  }
  return résultat;
}

// ─── Handler principal ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Authentification (même schéma que claude-prox)
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await admin.auth.getUser(token);
    if (authError || !userData?.user) {
      return json({ error: "Authentification requise." }, 401);
    }
    const userId = userData.user.id;

    // 2. Quota — même mécanisme que claude-prox (abonnement + tokens du mois)
    const { data: abos } = await admin
      .from("abonnements")
      .select("palier, statut")
      .eq("user_id", userId)
      .eq("statut", "actif")
      .order("date_debut", { ascending: false })
      .limit(1);
    const abo = abos?.[0] ?? null;
    if (!abo) {
      return json({ error: "quota", message: "Aucun abonnement actif." }, 403);
    }

    const { data: quota } = await admin
      .from("quotas_paliers")
      .select("tokens_mensuels")
      .ilike("palier", abo.palier)
      .maybeSingle();
    if (!quota) {
      return json({ error: "config", message: `Palier "${abo.palier}" sans quota configuré.` }, 500);
    }

    const debutMois = new Date();
    debutMois.setUTCDate(1);
    debutMois.setUTCHours(0, 0, 0, 0);
    const { data: usages } = await admin
      .from("usage_ia")
      .select("tokens_entree, tokens_sortie")
      .eq("user_id", userId)
      .gte("created_at", debutMois.toISOString());
    const consomme = (usages ?? []).reduce((s, u) => s + (u.tokens_entree ?? 0) + (u.tokens_sortie ?? 0), 0);
    if (consomme >= quota.tokens_mensuels) {
      return json({ error: "quota", message: "Quota mensuel atteint.", consomme, quota: quota.tokens_mensuels }, 429);
    }

    // 3. Corps de la requête
    const body = await req.json();
    const projetId: string | undefined = body?.projet_id;
    const noeudId: string | null = body?.noeud_id ?? null;
    const texteSelectionne: string | undefined = body?.texte_selectionne;
    const intentionDeclaree: Record<string, unknown> | null = body?.intention_declaree ?? null;
    const modeleClaude: string = body?.modele_claude || MODELE_CLAUDE;
    const modeleGPT: string = body?.modele_gpt || MODELE_GPT;

    if (!projetId || !texteSelectionne) {
      return json({ error: "projet_id et texte_selectionne sont requis." }, 400);
    }

    const journal: AppelJournalise[] = [];

    // ── Étape 0 ──
    let dossier = await construireDossierContexte(admin, projetId, noeudId, texteSelectionne, intentionDeclaree);

    const appelerClaude = async (tour: string, consigne: string, tourPrecedentGPT?: unknown) => {
      const { data, usage, résultatsRecherche } = await appellerMoteurIAStructure({
        moteur: "claude",
        modele: modeleClaude,
        role: "analyseur_initial",
        schema_sortie: SCHEMA_TOUR_CLAUDE,
        avecRechercheWeb: true,
        system: "Tu es l'analyseur initial du protocole de vérification à deux IA de Cursus (60805-06). " +
          "Analyse les affirmations précises du passage en tenant compte STRICTEMENT du dossier de contexte fourni. " +
          "Ne produis jamais de verdict définitif si contexte_suffisant est faux dans le dossier. " +
          "Tous les champs tableau (claims, corrections_bloquantes, corrections_non_bloquantes, requete_ciblee) " +
          "doivent toujours être un tableau JSON, jamais null — utilise [] si aucun élément. " +
          // 17/10/2026 — point 1 du GO/NO-GO (CLAUDE.md, 03/10/2026) : une
          // affirmation théorique/factuelle (ex. attribution d'une idée à un
          // auteur ou un courant nommé) n'est jamais vraie parce qu'une IA le
          // dit — même principe que pour les Références de CopiloteIA.
          "Pour CHAQUE affirmation (claims) dont le registre est 'theorique_general' ou 'symbolique_spirituel' " +
          "et qui se prête à une vérification externe (ex. attribution d'une idée à un auteur, un courant ou un " +
          "concept théorique nommé) : utilise l'outil de recherche web pour la vérifier avant de conclure. " +
          "Si la recherche confirme l'affirmation, copie dans 'source_verification' l'URL EXACTE telle que " +
          "renvoyée par l'outil (jamais reconstruite ou devinée). Si la recherche ne confirme rien, ou si " +
          "l'affirmation est de nature personnelle/interprétative et ne s'y prête pas, laisse 'source_verification' " +
          "à null — n'invente jamais une URL plausible : ce champ est recoupé MÉCANIQUEMENT après coup contre les " +
          "résultats réellement obtenus, et une URL qui ne correspond à rien de réel sera ignorée quoi que tu écrives. " +
          consigne,
        contexte: JSON.stringify({
          texte_selectionne: texteSelectionne,
          dossier_contexte: dossier,
          tour_precedent_gpt: tourPrecedentGPT ?? null,
        }),
      });
      journal.push({ tour, modele: usage.modele, tokens_entree: usage.tokens_entree, tokens_sortie: usage.tokens_sortie });
      const sortie = data as Record<string, unknown>;
      sortie.claims = recouperClaimsAvecRecherche(sortie.claims, résultatsRecherche);
      return sortie;
    };

    const appelerGPT = async (tour: string, tourPrecedent: unknown) => {
      const { data, usage } = await appellerMoteurIAStructure({
        moteur: "gpt",
        modele: modeleGPT,
        role: "critique_adversarial",
        schema_sortie: SCHEMA_TOUR_GPT,
        system: "Tu es le critique adversarial du protocole de vérification à deux IA de Cursus (60805-06). " +
          "Conteste les affirmations précises du tour précédent en t'appuyant STRICTEMENT sur le dossier de contexte fourni — " +
          "jamais sur tes propres suppositions non vérifiables dans le texte. " +
          "Seule une objection factuelle, théorique, logique ou éthique réelle justifie peut_arreter=false ; " +
          "une préférence stylistique ne bloque jamais. " +
          "Tous les champs tableau (corrections_bloquantes, corrections_non_bloquantes, requete_ciblee) " +
          "doivent toujours être un tableau JSON, jamais null — utilise [] si aucun élément. " +
          // 17/10/2026 — même point 1 du GO/NO-GO : source_confirmée sur un
          // claim est calculé MÉCANIQUEMENT par Cursus (jamais par une IA,
          // ni par Claude lui-même) contre une recherche web réelle — ce
          // n'est toujours pas une preuve que TU as vérifiée, mais c'est un
          // signal non auto-déclaré, à distinguer explicitement de ta propre
          // conviction ou de celle de Claude.
          "Chaque affirmation (claims) du tour précédent, de registre 'theorique_general' ou 'symbolique_spirituel', " +
          "porte un champ 'source_confirmée' calculé mécaniquement par Cursus : vrai seulement si une recherche web " +
          "a réellement confirmé l'URL revendiquée, jamais sur la seule parole de l'analyseur. Si 'source_confirmée' " +
          "est absent ou faux pour une affirmation que le tour précédent traite comme établie, c'est une raison " +
          "légitime de signaler un désaccord ou une correction (alertes_a_verifier_sur_source ou " +
          "corrections_bloquantes selon la gravité) — ne la traite JAMAIS comme vérifiée simplement parce qu'elle " +
          "te semble plausible ou parce que l'analyseur l'affirme.",
        contexte: JSON.stringify({
          texte_selectionne: texteSelectionne,
          dossier_contexte: dossier,
          tour_precedent: tourPrecedent,
        }),
      });
      journal.push({ tour, modele: usage.modele, tokens_entree: usage.tokens_entree, tokens_sortie: usage.tokens_sortie });
      return data as Record<string, unknown>;
    };

    // ── Tour A1 (Claude, analyse initiale) ──
    const a1 = await appelerClaude("A1", "Premier tour : analyse initiale du passage.");

    // ── Tour B1 (GPT, critique) ──
    let b1 = await appelerGPT("B1", a1);

    // ── Gestion d'alerte_contexte : une seule relance, jamais plus ──
    if (b1.alerte_contexte === true) {
      if (dossier.contexte_relance_count < 1) {
        const requeteCiblee = Array.isArray(b1.requete_ciblee) ? (b1.requete_ciblee as string[]) : [];
        dossier = await enrichirDossier(admin, dossier, projetId, noeudId, requeteCiblee);
        b1 = await appelerGPT("B1-relance", a1);
      }

      if (b1.alerte_contexte === true) {
        // Arrêt : verdict provisoire, contexte insuffisant malgré la relance.
        await journaliserUsage(admin, userId, projetId, journal);
        return json({
          verdict: "verdict_provisoire",
          raison: "Contexte interne insuffisant malgré une relance ciblée.",
          analyse_locale: "possible",
          analyse_globale: "non_conclusive",
          contexte_manquant: b1.raison_alerte ?? b1.type_contexte_manquant ?? null,
          recommandation: "Fournir ou indexer les sections concernées avant de conclure.",
        });
      }
    }

    const tours: Record<string, Record<string, unknown>> = { a1, b1 };

    // ── Prolongation éventuelle (plafond dur : A2 puis B2 maximum) ──
    if (b1.peut_arreter !== true) {
      const a2 = await appelerClaude("A2", "Tour de révision ou de défense face à la critique du tour précédent.", b1);
      tours.a2 = a2;

      if (a2.peut_arreter !== true) {
        const b2 = await appelerGPT("B2", { a1, b1, a2 });
        tours.b2 = b2;
        // Arrêt obligatoire ici quel que soit peut_arreter — plafond de profondeur atteint.
      }
    }

    // ── Étape 7 — sortie finale, assemblage mécanique par Cursus ──
    const sortieFinale = assemblerSortieFinale(tours, dossier);

    await journaliserUsage(admin, userId, projetId, journal);

    return json(sortieFinale);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

// ─── Assemblage de la sortie finale (mécanique, pas un nouvel appel IA) ────

function assemblerSortieFinale(tours: Record<string, Record<string, unknown>>, dossier: DossierContexte) {
  const buckets: Record<string, string[]> = {
    valeur_ajoutee_editoriale: [],
    corrections_probables: [],
    alertes_a_verifier_sur_source: [],
    remarques_non_bloquantes: [],
  };

  for (const tour of Object.values(tours)) {
    for (const cle of ["corrections_bloquantes", "corrections_non_bloquantes"] as const) {
      const liste = tour[cle];
      if (!Array.isArray(liste)) continue;
      for (const item of liste) {
        if (item && typeof item === "object" && "categorie" in item && "texte" in item) {
          const categorie = String((item as Record<string, unknown>).categorie);
          if (categorie in buckets) buckets[categorie].push(String((item as Record<string, unknown>).texte));
        }
      }
    }
  }

  // Dernier tour GPT disponible = source du verdict (seuls les tours GPT
  // portent un champ `verdict`, voir docs/protocole-verification-approfondie-deux-ia.md).
  const dernierTourGPT = (tours.b2 ?? tours.b1) as Record<string, unknown>;

  return {
    verdict_passage: dernierTourGPT.verdict ?? "verdict_provisoire",
    verdict_these_livre: null, // voir limite documentée en tête de fichier
    reponse_optimale_auteur: dernierTourGPT.reponse_optimale_auteur ?? null,
    valeur_ajoutee_editoriale: buckets.valeur_ajoutee_editoriale,
    corrections_probables: buckets.corrections_probables,
    alertes_a_verifier_sur_source: buckets.alertes_a_verifier_sur_source,
    remarques_non_bloquantes: buckets.remarques_non_bloquantes,
    // 17/10/2026 — point 1 du GO/NO-GO (voir note en tête de fichier) :
    // affirmations théoriques/factuelles jamais confirmées par une recherche
    // web réelle, quoi que l'IA ait pu en dire par ailleurs dans son analyse
    // ou son verdict — distinct de alertes_a_verifier_sur_source (qui vise un
    // artefact de numérisation, pas une affirmation théorique non sourcée).
    claims_theoriques_non_confirmees: recueillirClaimsNonConfirmées(tours),
    contexte_suffisant: dossier.contexte_suffisant,
    couverture_manuscrit: dossier.couverture_manuscrit,
    tours_effectues: Object.keys(tours),
  };
}

async function journaliserUsage(
  admin: ReturnType<typeof createClient>,
  userId: string,
  projetId: string,
  journal: AppelJournalise[],
) {
  if (journal.length === 0) return;
  const lignes = journal.map((j) => ({
    user_id: userId,
    projet_id: projetId,
    tokens_entree: j.tokens_entree,
    tokens_sortie: j.tokens_sortie,
    modele: `${j.modele} (${j.tour})`,
  }));
  const { error } = await admin.from("usage_ia").insert(lignes);
  if (error) console.error("verification-deux-ia usage_ia insert:", error.message);
}
