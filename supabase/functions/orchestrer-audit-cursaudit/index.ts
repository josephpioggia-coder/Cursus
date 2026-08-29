/**
 * CURSAUDIT — Edge Function : orchestrer-audit-cursaudit (référence 60816-01)
 * ============================================================================
 * Traite les unités non encore analysées d'un audit (`audit_sections` où
 * `resultat_analyse` est encore vide), par lots bornés dans le temps plutôt
 * que par nombre fixe — le temps par unité varie trop selon le mode IA
 * ("2 IA" fait deux appels par unité) et la longueur du texte pour qu'un
 * compte fixe soit fiable face à la limite d'exécution d'une Edge Function.
 *
 * ORCHESTRATION CLIENT, PAS DE TÂCHE DE FOND (limite assumée, pas cachée) :
 * cette fonction traite UN LOT et s'arrête — elle ne boucle pas elle-même
 * jusqu'à la fin de l'audit. C'est à l'appelant (aujourd'hui un script,
 * plus tard un bouton "Continuer" côté interface) de la rappeler tant que
 * `restantes > 0` dans la réponse. Rien ne continue tout seul si personne
 * ne rappelle — pas de cron, pas de file d'attente, pas encore construits.
 *
 * FICHIER AUTONOME, code dupliqué depuis analyser-unite-cursaudit plutôt que
 * partagé via _shared/ (leçon du 16/08/2026 sur verification-deux-ia : un
 * import relatif casse un déploiement par simple collage Dashboard). Si les
 * deux fichiers divergent un jour, c'est ce commentaire qu'il faut mettre à
 * jour en premier.
 *
 * GESTION D'ÉCHEC PAR UNITÉ : si l'appel IA échoue pour une unité (erreur
 * réseau, sortie non conforme...), la section reçoit
 * `resultat_analyse = { erreur: "..." }` plutôt que de rester vide — elle
 * ne sera donc PAS retentée automatiquement au prochain appel (pour éviter
 * une boucle qui échoue indéfiniment sur la même unité et bloque tout le
 * lot). Aucun mécanisme de nouvelle tentative manuelle n'existe encore —
 * à construire si des échecs réels apparaissent en usage.
 *
 * SECRETS REQUIS : ANTHROPIC_KEY, OPENAI_API_KEY, SUPABASE_URL,
 * SERVICE_ROLE_KEY (déjà en place).
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
const MODES_NON_IMPLEMENTES = ["2 IA + confrontation ciblée", "2 IA + arbitrage dialogique"];

// Budget de temps par appel — marge délibérée sous la limite d'exécution
// habituelle d'une Edge Function, pour laisser le temps de répondre proprement
// même si l'unité en cours au moment du dépassement doit encore se terminer.
const BUDGET_MS = 25000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });

// ─── Module IA structuré (inliné, voir note en tête de fichier) ───────────

interface AppelMoteurIAParams {
  moteur: "claude" | "gpt";
  modele: string;
  role: string;
  schema_sortie: Record<string, unknown>;
  system: string;
  contexte: string;
  max_tokens?: number;
}
interface UsageIA { tokens_entree: number; tokens_sortie: number; modele: string }
interface AppelMoteurIAResultat { data: unknown; usage: UsageIA }

// CORRECTIF 26/08/2026 — rattrapage d'un champ isolé manquant (réf.
// 60816-01, suite). Bug réel constaté en test : une unité entière rejetée
// en échec parce que geste_editorial n'avait pas son "commentaire" —
// aucun mécanisme ici pour rattraper un oubli isolé de l'IA, contrairement
// à preaudit-approfondi-cursaudit (corrigé le 24/08 avec le même principe :
// useDefaults + removeAdditional + combler()). Porté ici à l'identique :
// useDefaults comble une valeur par défaut au niveau du schéma,
// removeAdditional supprime une clé en trop plutôt que de rejeter, et
// combler() comble récursivement un champ requis manquant (objet, tableau
// ou scalaire) AVANT même la validation — un item incomplet reste
// imparfait, mais ne fait plus échouer toute l'unité pour un oubli isolé.
const ajv = new Ajv({ allErrors: true, strict: false, useDefaults: true, removeAdditional: true });

// CORRECTIF 26/08/2026 — même famille de bug que "Function failed due to
// not having enough compute resources" déjà rencontré et corrigé sur
// preaudit-approfondi-cursaudit (v7.6) : compiler un schéma AJV est un vrai
// travail CPU, pas de l'attente réseau. Ici, validerContreSchema()
// recompilait le schéma à CHAQUE unité traitée (jusqu'à plusieurs dizaines
// par appel, dans le budget de 25s) — largement pire que le cas déjà
// corrigé ailleurs (compilé 2 fois par requête). Le schéma de l'analyse
// (construit dynamiquement selon le palier, mais IDENTIQUE pour toutes les
// unités d'un même appel) et SCHEMA_CONTROLE_GPT (constant) sont désormais
// mis en cache par référence d'objet — compilés une seule fois, réutilisés
// pour chaque unité du lot.
const validateursCompilés = new WeakMap<object, ReturnType<typeof ajv.compile>>();
function validerContreSchema(data: unknown, schema: Record<string, unknown>): void {
  let valide = validateursCompilés.get(schema);
  if (!valide) {
    valide = ajv.compile(schema);
    validateursCompilés.set(schema, valide);
  }
  if (!valide(data)) throw new Error(`Sortie IA non conforme au schéma attendu : ${ajv.errorsText(valide.errors)}`);
}

function valeurParDéfaut(schema: Record<string, unknown>): unknown {
  if (schema.type === "array") {
    const n = (schema.minItems as number) ?? 0;
    const itemSchema = (schema.items as Record<string, unknown>) ?? { type: "string" };
    return Array.from({ length: n }, () => valeurParDéfaut(itemSchema));
  }
  if (schema.type === "object") {
    const obj: Record<string, unknown> = {};
    const requis = (schema.required as string[]) ?? [];
    const proprietes = (schema.properties as Record<string, Record<string, unknown>>) ?? {};
    for (const clé of requis) obj[clé] = valeurParDéfaut(proprietes[clé] ?? { type: "string" });
    return obj;
  }
  if (schema.default !== undefined) return schema.default;
  if (schema.enum) return (schema.enum as unknown[])[0];
  return "";
}

function combler(schema: Record<string, unknown>, data: unknown): unknown {
  if (schema.type !== "object") return data;
  const base = (typeof data === "object" && data !== null && !Array.isArray(data)) ? { ...(data as Record<string, unknown>) } : {};
  const requis = (schema.required as string[]) ?? [];
  const proprietes = (schema.properties as Record<string, Record<string, unknown>>) ?? {};
  for (const clé of requis) {
    const sousSchema = proprietes[clé] ?? { type: "string" };
    const valeur = base[clé];
    if (valeur === undefined || valeur === null) {
      base[clé] = valeurParDéfaut(sousSchema);
    } else if (sousSchema.type === "object" && typeof valeur === "object" && !Array.isArray(valeur)) {
      base[clé] = combler(sousSchema, valeur);
    } else if (sousSchema.type === "array" && Array.isArray(valeur)) {
      const itemSchema = (sousSchema.items as Record<string, unknown>) ?? { type: "string" };
      const complétée = valeur.map((item) => (itemSchema.type === "object" ? combler(itemSchema, item) : item));
      const min = (sousSchema.minItems as number) ?? 0;
      while (complétée.length < min) complétée.push(valeurParDéfaut(itemSchema));
      base[clé] = complétée;
    } else if (
      (sousSchema.type === "object" && (typeof valeur !== "object" || Array.isArray(valeur))) ||
      (sousSchema.type === "array" && !Array.isArray(valeur))
    ) {
      base[clé] = valeurParDéfaut(sousSchema);
    }
  }
  return base;
}

async function appellerClaudeMoteur(params: AppelMoteurIAParams): Promise<AppelMoteurIAResultat> {
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_KEY manquante.");
  const nomOutil = "sortie_structuree";
  const réponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: params.modele,
      max_tokens: params.max_tokens ?? 4096,
      system: params.system,
      messages: [{ role: "user", content: params.contexte }],
      // CORRECTIF 26/08/2026 — vraie cure plutôt qu'un simple garde-fou après
      // coup (voir compterCritèresVides ci-dessous, qui ne fait que détecter
      // le problème) : `strict: true` fait garantir par l'API Claude
      // elle-même que `tool_use.input` respecte EXACTEMENT le schéma (tous
      // les champs requis présents, à tous les niveaux) avant même de nous
      // répondre — au lieu de laisser Claude omettre des critères et de le
      // découvrir seulement après coup via combler()/validerContreSchema().
      // L'appel GPT (appellerGPTMoteur, plus bas) avait déjà `strict: true`
      // depuis le début ; seul l'appel Claude ne l'avait pas. Le schéma
      // fusionné (fusionnerSchemas) est déjà conforme aux exigences du mode
      // strict (additionalProperties: false + required complet à tous les
      // niveaux, vérifié avant d'activer ceci).
      tools: [{ name: nomOutil, description: `Sortie structurée pour le rôle "${params.role}".`, input_schema: params.schema_sortie, strict: true }],
      tool_choice: { type: "tool", name: nomOutil },
    }),
  });
  const résultat = await réponse.json();
  if (!réponse.ok) throw new Error(résultat?.error?.message || `Échec de l'appel Claude (${réponse.status}).`);
  // Détection explicite de troncature (réf. 60816-01, suite, 26/08/2026) —
  // pour un message d'erreur clair sur cette section précise plutôt qu'une
  // erreur de schéma cryptique si la réponse est coupée en plein milieu
  // (voir le correctif du même jour sur max_tokens de l'analyse par unité).
  if (résultat.stop_reason === "max_tokens") {
    throw new Error("Réponse de l'IA tronquée (limite de longueur atteinte) pour cette unité.");
  }
  const blocOutil = (résultat.content ?? []).find((bloc: { type: string }) => bloc.type === "tool_use");
  if (!blocOutil) throw new Error("Claude n'a renvoyé aucun bloc tool_use — sortie structurée absente.");
  const donneesNormalisees = combler(params.schema_sortie, blocOutil.input);
  validerContreSchema(donneesNormalisees, params.schema_sortie);
  return {
    data: donneesNormalisees,
    usage: { tokens_entree: résultat.usage?.input_tokens ?? 0, tokens_sortie: résultat.usage?.output_tokens ?? 0, modele: résultat.model ?? params.modele },
  };
}

async function appellerGPTMoteur(params: AppelMoteurIAParams): Promise<AppelMoteurIAResultat> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquante.");
  const réponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: params.modele,
      messages: [{ role: "system", content: params.system }, { role: "user", content: params.contexte }],
      response_format: { type: "json_schema", json_schema: { name: "sortie_structuree", schema: params.schema_sortie, strict: true } },
    }),
  });
  const résultat = await réponse.json();
  if (!réponse.ok) throw new Error(résultat?.error?.message || `Échec de l'appel GPT (${réponse.status}).`);
  const contenuBrut = résultat.choices?.[0]?.message?.content;
  if (!contenuBrut) throw new Error("GPT n'a renvoyé aucun contenu — sortie structurée absente.");
  let data: unknown;
  try {
    data = JSON.parse(contenuBrut);
  } catch {
    throw new Error("Sortie GPT non parsable en JSON malgré response_format json_schema.");
  }
  const donneesNormalisees = combler(params.schema_sortie, data);
  validerContreSchema(donneesNormalisees, params.schema_sortie);
  return {
    data: donneesNormalisees,
    usage: { tokens_entree: résultat.usage?.prompt_tokens ?? 0, tokens_sortie: résultat.usage?.completion_tokens ?? 0, modele: résultat.model ?? params.modele },
  };
}

// ─── Garde-fou contre une analyse quasi vide (réf. 60816-01, suite,
// 26/08/2026) — bug réel constaté en production sur "À cœur retrouvé" :
// Claude omettait la quasi-totalité des critères pour certaines unités,
// combler() les comblait silencieusement en vide, et le résultat était
// enregistré comme un succès normal — un critère par critère "Enoncé type —",
// "Source trace —", etc. sans aucune valeur ni commentaire, affiché comme si
// l'unité avait vraiment été analysée. Même famille de bug que le v7.4 déjà
// corrigé sur preaudit-approfondi-cursaudit (CHAMPS_CLÉS_NON_VIDES), jamais
// porté ici. Si plus de la moitié des critères actifs reviennent sans
// valeur NI commentaire après comblement, l'unité est rejetée en erreur
// (donc marquée "échec", pas "terminée" à tort) plutôt qu'enregistrée.
function compterCritèresVides(analyse: Record<string, unknown>, criteres: CritereActif[]): number {
  return criteres.filter((c) => {
    const entrée = analyse[c.output_key] as { valeur?: unknown; commentaire?: string } | undefined;
    const valeur = entrée?.valeur;
    const valeurVide = valeur === undefined || valeur === "" || (Array.isArray(valeur) && valeur.length === 0);
    const commentaireVide = !entrée?.commentaire || entrée.commentaire.trim() === "";
    return valeurVide && commentaireVide;
  }).length;
}

async function appellerMoteurIAStructure(params: AppelMoteurIAParams): Promise<AppelMoteurIAResultat> {
  if (params.moteur === "claude") return appellerClaudeMoteur(params);
  if (params.moteur === "gpt") return appellerGPTMoteur(params);
  throw new Error(`Moteur IA inconnu : "${params.moteur}".`);
}

// ─── Construction dynamique du schéma, identique à analyser-unite-cursaudit ─

interface CritereActif { code: string; label: string; description: string | null; output_key: string; categories: string[] | null }

// 22/08/2026 — voir 2026-08-22-audit-criteria-categories.sql et le
// commentaire jumeau dans analyser-unite-cursaudit/index.ts : `categories`
// ferme le vocabulaire de `valeur` (tableau, pas une seule) pour les
// critères qui en ont, null pour les autres (texte libre inchangé).
function construireSchemaAnalyse(criteres: CritereActif[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const c of criteres) {
    const valeurSchema = c.categories && c.categories.length > 0
      ? { type: "array", items: { type: "string", enum: c.categories }, minItems: 1 }
      : { type: "string" };
    properties[c.output_key] = {
      type: "object",
      properties: { valeur: valeurSchema, commentaire: { type: "string" } },
      required: ["valeur", "commentaire"],
      additionalProperties: false,
    };
    required.push(c.output_key);
  }
  return { type: "object", properties, required, additionalProperties: false };
}

function construireConsigneCriteres(criteres: CritereActif[]): string {
  return criteres
    .map((c) => {
      const consigneCategories = c.categories && c.categories.length > 0
        ? ` — valeur = un TABLEAU d'une ou plusieurs de ces catégories exactes : ${c.categories.join(", ")} (cumule-les si plusieurs s'appliquent à la fois, n'en invente aucune autre)`
        : "";
      return `- ${c.output_key} (${c.label}) : ${c.description ?? "sans description"}${consigneCategories}`;
    })
    .join("\n");
}

const SCHEMA_CONTROLE_GPT = {
  type: "object",
  properties: {
    accord: { type: "boolean" },
    desaccords: {
      type: "array",
      items: {
        type: "object",
        properties: { critere: { type: "string" }, raison: { type: "string" } },
        required: ["critere", "raison"],
        additionalProperties: false,
      },
    },
  },
  required: ["accord", "desaccords"],
  additionalProperties: false,
};

// ─── Qualification de la demande (questionnaire, réf. 60816-01, suite, 22/08/2026) ─
// Voir le commentaire jumeau dans analyser-unite-cursaudit/index.ts — même
// logique, dupliquée (fichier autonome).
const LABELS_DEGRE_INTERVENTION: Record<string, string> = {
  observer: "Observer seulement : diagnostique, ne suggère aucune correction.",
  signaler: "Signale les problèmes, sans proposer de solution.",
  pistes: "Propose des pistes de correction dans le commentaire, sans reformuler à la place de l'auteur·ice.",
  reformulations_ponctuelles: "Tu peux glisser une suggestion de reformulation ponctuelle dans le commentaire si cela aide à comprendre le problème — jamais une réécriture complète.",
  reecrire_legerement: "Tu peux esquisser une reformulation dans le commentaire, mais la sortie reste un diagnostic, pas un texte de remplacement (aucun champ dédié à la réécriture n'existe).",
  reecrire_librement: "Même limite que ci-dessus, en te montrant plus libre dans la reformulation suggérée au sein du commentaire.",
};

const DEGRES_AUTORISANT_PROPOSITION = new Set([
  "pistes", "reformulations_ponctuelles", "reecrire_legerement", "reecrire_librement",
]);

// Réf. 60816-01, suite, 29/08/2026 — voir le commentaire jumeau dans
// analyser-unite-cursaudit/index.ts : "Non" et "Je ne sais pas" traités à
// l'identique désormais (défaut prudent en cas de doute sur l'autorisation
// de l'établissement), au lieu de ne bloquer que sur "Non" seul.
const AUTORISATION_IA_INCERTAINE_OU_REFUSEE = new Set(["Non", "Je ne sais pas"]);

interface ContratIntention {
  ouEnEtesVous?: string;
  // Réf. 60816-01, suite, 29/08/2026 — jamais lu (natureProjet n'est
  // pas utilisé dans construireContexteQualification, seul type_document
  // au premier niveau l'est) ; forme mise à jour par cohérence avec le
  // nouvel arbre niveaux 1-4 côté client (voir
  // taxonomieContratIntentionCursAudit.js), sans effet fonctionnel ici.
  natureProjet?: { label?: string };
  objectifs?: string[];
  destinataires?: string[];
  criteresReussite?: string[];
  ceQueVousEspérezDécouvrir?: string[];
  // "Autre, à préciser" de chacune des 4 questions ci-dessus — réf.
  // 60816-01, suite, 29/08/2026. Voir le commentaire jumeau dans
  // analyser-unite-cursaudit/index.ts.
  objectifsAutre?: string;
  destinatairesAutre?: string;
  criteresReussiteAutre?: string;
  ceQueVousEspérezDécouvrirAutre?: string;
}

interface AuditQualification {
  type_document: string | null;
  finalite_audit: string[] | null;
  question_libre: string | null;
  degre_intervention: string | null;
  contraintes_academiques: { autorisationIA?: string; conditions?: string[] } | null;
  relation_ia: { adresse?: string; ton?: string; posture?: string; longueur?: string; role?: string } | null;
  contrat_intention: ContratIntention | null;
}

// Profil auteur — réf. 60816-01, suite, 29/08/2026. Voir le commentaire
// jumeau dans analyser-unite-cursaudit/index.ts.
interface ProfilAuteur {
  profession: string | null;
  identite_genre: string | null;
  tranche_age: string | null;
  niveau_etudes: string | null;
  matieres_etudiees: string | null;
}

function construireContexteQualification(audit: AuditQualification, profil: ProfilAuteur | null): string {
  const lignes: string[] = [];
  if (audit.type_document) {
    lignes.push(`Type de document audité : ${audit.type_document}.`);
  }
  if (audit.finalite_audit && audit.finalite_audit.length > 0) {
    lignes.push(`Ce que l'auteur·ice cherche à obtenir de cet audit : ${audit.finalite_audit.join(", ")}.`);
  }
  if (audit.question_libre) {
    lignes.push(`Question posée par l'auteur·ice pour cet audit, à garder à l'esprit pour chaque unité : "${audit.question_libre}"`);
  }
  if (audit.degre_intervention && LABELS_DEGRE_INTERVENTION[audit.degre_intervention]) {
    lignes.push(`Degré d'intervention autorisé : ${LABELS_DEGRE_INTERVENTION[audit.degre_intervention]}`);
  }
  if (AUTORISATION_IA_INCERTAINE_OU_REFUSEE.has(audit.contraintes_academiques?.autorisationIA ?? "")) {
    lignes.push("L'établissement de l'auteur·ice N'AUTORISE PAS l'usage de l'IA sur ce travail (ou l'auteur·ice ne le sait pas encore) — reste strictement au diagnostic, aucune proposition ni reformulation, quel que soit le degré d'intervention choisi par ailleurs.");
  } else if (audit.contraintes_academiques?.conditions && audit.contraintes_academiques.conditions.length > 0) {
    lignes.push(`Conditions académiques à respecter : ${audit.contraintes_academiques.conditions.join(", ")}.`);
  }
  const c = audit.contrat_intention;
  if (c?.ouEnEtesVous) lignes.push(`Où en est l'auteur·ice dans ce projet : ${c.ouEnEtesVous}.`);
  const objectifsComplets = [...(c?.objectifs ?? []), ...(c?.objectifsAutre ? [c.objectifsAutre] : [])];
  if (objectifsComplets.length > 0) lignes.push(`Pourquoi l'auteur·ice écrit ce texte : ${objectifsComplets.join(", ")}.`);
  const destinatairesComplets = [...(c?.destinataires ?? []), ...(c?.destinatairesAutre ? [c.destinatairesAutre] : [])];
  if (destinatairesComplets.length > 0) lignes.push(`Pour qui ce texte est écrit : ${destinatairesComplets.join(", ")}.`);
  const criteresReussiteComplets = [...(c?.criteresReussite ?? []), ...(c?.criteresReussiteAutre ? [c.criteresReussiteAutre] : [])];
  if (criteresReussiteComplets.length > 0) lignes.push(`Ce qui ferait, pour l'auteur·ice, de ce projet une réussite : ${criteresReussiteComplets.join(", ")}.`);
  const espérezDécouvrirComplets = [...(c?.ceQueVousEspérezDécouvrir ?? []), ...(c?.ceQueVousEspérezDécouvrirAutre ? [c.ceQueVousEspérezDécouvrirAutre] : [])];
  if (espérezDécouvrirComplets.length > 0) lignes.push(`Ce que l'auteur·ice espère découvrir en écrivant, que ton analyse peut éclairer : ${espérezDécouvrirComplets.join(", ")}.`);
  const profilLignes: string[] = [];
  if (profil?.profession) profilLignes.push(`profession : ${profil.profession}`);
  if (profil?.identite_genre) profilLignes.push(`identité : ${profil.identite_genre}`);
  if (profil?.tranche_age) profilLignes.push(`tranche d'âge : ${profil.tranche_age}`);
  if (profil?.niveau_etudes) profilLignes.push(`niveau d'études : ${profil.niveau_etudes}`);
  if (profil?.matieres_etudiees) profilLignes.push(`domaines étudiés : ${profil.matieres_etudiees}`);
  if (profilLignes.length > 0) {
    lignes.push(`Profil de l'auteur·ice (${profilLignes.join(", ")}) — utile pour juger la crédibilité ` +
      "des affirmations professionnelles ou personnelles du texte, jamais pour préjuger de sa qualité littéraire.");
  }
  if (audit.relation_ia) {
    const r = audit.relation_ia;
    const parts = [
      r.adresse === "vous" ? "vouvoie l'auteur·ice" : "tutoie l'auteur·ice",
      r.ton ? `ton ${r.ton}` : null,
      r.posture ? `posture ${r.posture}` : null,
      r.longueur === "court" ? "commentaires courts" : "commentaires détaillés",
      r.role ? `plutôt en ${r.role}` : null,
    ].filter(Boolean);
    lignes.push(`Style attendu dans les commentaires : ${parts.join(", ")}.`);
  }
  return lignes.length > 0 ? lignes.join("\n") + "\n\n" : "";
}

// Contexte issu du pré-audit déjà réalisé (réf. 60816-01, suite,
// 25/08/2026) — jusqu'ici, l'audit détaillé analysait chaque unité de
// façon totalement isolée, sans aucune connaissance du pré-audit payant
// déjà produit pour ce même livre (voies éditoriales, cartographie des
// personnages/lieux, domaines à vérifier) — vérifié : aucune référence à
// `preaudit_resultat` n'existait avant ce jour dans ce fichier ni dans
// analyser-unite-cursaudit. Purement additif : si aucun pré-audit n'existe
// pour cet audit (préaudit_resultat null), renvoie une chaîne vide,
// comportement strictement identique à avant.
function construireContextePreaudit(preauditResultat: Record<string, unknown> | null): string {
  if (!preauditResultat) return "";
  const cartographie = preauditResultat.cartographie_contexte as {
    personnages_principaux?: Array<{ nom?: string; role?: string }>;
    lieux_principaux?: Array<{ nom?: string; fonction?: string }>;
    domaines_a_verifier?: string[];
  } | undefined;
  const planIntervention = preauditResultat.plan_intervention as Array<{ chantier?: string }> | undefined;

  const lignes: string[] = [
    "Un pré-audit approfondi de CE LIVRE ENTIER a déjà été réalisé — sers-t'en comme repère de cohérence " +
    "(mêmes noms, mêmes lieux, même diagnostic d'ensemble), pas comme une grille à recopier unité par unité :",
  ];
  if (preauditResultat.recommandation_principale) {
    lignes.push(`- Recommandation d'ensemble : ${preauditResultat.recommandation_principale}`);
  }
  if (planIntervention && planIntervention.length > 0) {
    lignes.push(`- Chantiers identifiés pour l'ensemble du livre : ${planIntervention.map((c) => c.chantier).filter(Boolean).join(" ; ")}`);
  }
  if (cartographie?.personnages_principaux && cartographie.personnages_principaux.length > 0) {
    lignes.push(`- Personnages principaux (garde les mêmes noms/rôles) : ${cartographie.personnages_principaux.map((p) => `${p.nom} (${p.role})`).filter(Boolean).join(", ")}`);
  }
  if (cartographie?.lieux_principaux && cartographie.lieux_principaux.length > 0) {
    lignes.push(`- Lieux principaux : ${cartographie.lieux_principaux.map((l) => `${l.nom} (${l.fonction})`).filter(Boolean).join(", ")}`);
  }
  if (cartographie?.domaines_a_verifier && cartographie.domaines_a_verifier.length > 0) {
    lignes.push(`- Points déjà signalés à vérifier à l'échelle du livre : ${cartographie.domaines_a_verifier.join(" ; ")}`);
  }
  return lignes.length > 1 ? lignes.join("\n") + "\n\n" : "";
}

// ─── Synthèse éditoriale globale par unité — voir le commentaire jumeau,
// plus détaillé, dans analyser-unite-cursaudit/index.ts.
const EFFETS_LECTEUR = [
  "adhesion", "resistance", "emotion", "confusion", "fatigue",
  "curiosite", "malaise", "impression_de_profondeur", "impression_de_repetition",
];
const ACTIONS_RECOMMANDEES = [
  "conserver", "alleger", "nuancer", "deplacer", "developper",
  "couper", "sourcer", "reformuler", "reecrire", "expertiser",
];

function construireSchemaSyntheseEditoriale(autoriserProposition: boolean): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      effet_lecteur: {
        type: "object",
        properties: {
          valeur: { type: "array", items: { type: "string", enum: EFFETS_LECTEUR }, minItems: 1 },
          commentaire: { type: "string" },
        },
        required: ["valeur", "commentaire"],
        additionalProperties: false,
      },
      geste_editorial: {
        type: "object",
        properties: { valeur: { type: "string" }, commentaire: { type: "string" } },
        required: ["valeur", "commentaire"],
        additionalProperties: false,
      },
      action_recommandee: {
        type: "object",
        properties: {
          valeur: { type: "string", enum: ACTIONS_RECOMMANDEES },
          commentaire: { type: "string" },
        },
        required: ["valeur", "commentaire"],
        additionalProperties: false,
      },
      proposition: autoriserProposition ? { type: "string" } : { type: "null" },
    },
    required: ["effet_lecteur", "geste_editorial", "action_recommandee", "proposition"],
    additionalProperties: false,
  };
}

function construireConsigneSyntheseEditoriale(autoriserProposition: boolean): string {
  const consigneProposition = autoriserProposition
    ? `- proposition : une suggestion concrète et actionnable (reformulation, piste de correction), en respectant strictement le degré d'intervention autorisé ci-dessus — jamais au-delà.`
    : `- proposition : DOIT être null. Le degré d'intervention choisi (ou son absence) n'autorise aucune proposition de correction — diagnostique et oriente (geste_editorial) sans jamais rédiger à la place de l'auteur·ice.`;
  return (
    "En plus de l'évaluation critère par critère, produis une synthèse éditoriale globale pour cette unité :\n" +
    `- effet_lecteur : un tableau d'une ou plusieurs de ces catégories exactes : ${EFFETS_LECTEUR.join(", ")} — l'effet que ce passage produirait chez un lecteur, pas s'il est vrai ou prouvé.\n` +
    `- geste_editorial : une direction de travail concrète mais non rédigée (ex. "ramener l'énoncé vers le vécu de l'auteur·ice plutôt que vers une généralisation").\n` +
    `- action_recommandee : une seule de ces catégories exactes : ${ACTIONS_RECOMMANDEES.join(", ")}.\n` +
    consigneProposition
  );
}

function fusionnerSchemas(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "object",
    properties: { ...(a.properties as object), ...(b.properties as object) },
    required: [...(a.required as string[]), ...(b.required as string[])],
    additionalProperties: false,
  };
}

// ─── Analyse d'une unité (logique identique à analyser-unite-cursaudit) ────

async function analyserUneSection(
  section: { id: string; texte_source: string },
  modeIA: string,
  criteres: CritereActif[],
  schema: Record<string, unknown>,
  consigneCriteres: string,
  contexteQualification: string,
  consigneSyntheseEditoriale: string,
): Promise<Record<string, unknown>> {
  const systemClaude =
    contexteQualification +
    "Tu es le moteur d'analyse de CursAudit. Pour l'unité de texte fournie, évalue-la selon " +
    "CHACUNE des dimensions suivantes, en indiquant pour chacune une valeur (catégorie observée) " +
    "et un bref commentaire justificatif ancré dans le texte fourni, jamais une supposition externe :\n" +
    consigneCriteres + "\n\n" + consigneSyntheseEditoriale;

  // CORRECTIF 26/08/2026 — 76% d'échec constaté en test réel (57/75 unités),
  // même famille de bug que le correctif du matin sur l'aperçu : max_tokens
  // par défaut (4096, voir appellerMoteurIAStructure) coupait la réponse en
  // plein milieu. Le contexte du pré-audit ajouté aujourd'hui (voir
  // construireContextePreaudit) rend les réponses de Claude nettement plus
  // riches et sourcées (constaté sur un vrai exemple), poussant plus
  // d'analyses au-delà de l'ancienne limite. Porté à 8192, même valeur que
  // le correctif de ce matin.
  const { data: analyse, usage: usageClaude } = await appellerMoteurIAStructure({
    moteur: "claude", modele: MODELE_CLAUDE, role: "analyseur_cursaudit",
    schema_sortie: schema, system: systemClaude, contexte: section.texte_source, max_tokens: 8192,
  });

  const nbCritèresVides = compterCritèresVides(analyse as Record<string, unknown>, criteres);
  if (criteres.length > 0 && nbCritèresVides > criteres.length / 2) {
    throw new Error(`Analyse quasi vide (${nbCritèresVides}/${criteres.length} critères sans valeur ni commentaire) — échec réel, à relancer plutôt qu'à enregistrer.`);
  }

  let controleGPT: unknown = null;
  let usageGPT: UsageIA | null = null;
  if (modeIA === "2 IA") {
    const systemGPT =
      "Tu es le second lecteur du moteur d'analyse CursAudit. Relis l'analyse ci-dessous, produite par un " +
      "premier moteur pour cette unité de texte, selon les mêmes dimensions :\n" + consigneCriteres +
      "\nSignale UNIQUEMENT les désaccords réels (une dimension classée de façon manifestement erronée au " +
      "regard du texte) — jamais une reformulation ou une préférence de nuance.";
    const résultatGPT = await appellerMoteurIAStructure({
      moteur: "gpt", modele: MODELE_GPT, role: "second_lecteur_cursaudit",
      schema_sortie: SCHEMA_CONTROLE_GPT, system: systemGPT,
      contexte: JSON.stringify({ texte_source: section.texte_source, analyse_premier_moteur: analyse }),
    });
    controleGPT = résultatGPT.data;
    usageGPT = résultatGPT.usage;
  }

  return { analyse, controle_gpt: controleGPT, mode_ia: modeIA, analyse_le: new Date().toISOString(), usage: { claude: usageClaude, gpt: usageGPT } };
}

// ─── Handler principal ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const départ = Date.now();

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await admin.auth.getUser(token);
    if (authError || !userData?.user) return json({ error: "Authentification requise." }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const auditId: string | undefined = body?.audit_id;
    if (!auditId) return json({ error: "audit_id est requis." }, 400);
    // Bornage optionnel à un sous-ensemble de chapitres (réf. 60816-01,
    // suite, 25/08/2026) — pour pouvoir tester la qualité de l'audit
    // détaillé sur "la partie 1" d'un livre plutôt que d'attendre les 752
    // unités/2h d'un livre entier à chaque essai. Purement additif : sans ce
    // champ, comportement inchangé (tout le livre). Quand fourni, l'audit
    // n'est JAMAIS marqué "termine" automatiquement (ce serait faux — il
    // reste des unités hors du sous-ensemble demandé).
    const chapitreMaxIndex: number | undefined =
      typeof body?.chapitre_max_index === "number" ? body.chapitre_max_index : undefined;

    const { data: audit } = await admin
      .from("audits")
      .select("id, user_id, statut, nombre_dimensions, mode_ia, type_document, finalite_audit, question_libre, degre_intervention, contraintes_academiques, relation_ia, apercu_resultat, preaudit_resultat, contrat_intention")
      .eq("id", auditId)
      .maybeSingle();
    if (!audit || audit.user_id !== userId) return json({ error: "Audit introuvable." }, 404);

    // Profil auteur optionnel (réf. 60816-01, suite, 29/08/2026) — table
    // séparée, une ligne par utilisateur, peut ne pas exister du tout.
    const { data: profilAuteur } = await admin
      .from("profils_auteur")
      .select("profession, identite_genre, tranche_age, niveau_etudes, matieres_etudiees")
      .eq("user_id", userId)
      .maybeSingle();
    // Réf. 60816-01, suite, 28/08/2026 — "termine" accepté en plus de
    // "payé"/"en_traitement" : un audit remis à zéro (unités en échec
    // réinitialisées via SQL après incident, ex. schéma non conforme
    // avant strict:true) reste marqué "termine" tant que personne n'a
    // relancé le traitement — cette fonction doit pouvoir reprendre le
    // travail restant plutôt que de rejeter l'appel avec un 409 alors que
    // des `audit_sections` sans résultat existent bel et bien.
    if (audit.statut !== "paye" && audit.statut !== "en_traitement" && audit.statut !== "termine") {
      return json({ error: "statut_invalide", message: `Cet audit a le statut "${audit.statut}", ni payé, ni en traitement, ni terminé.` }, 409);
    }
    if (MODES_NON_IMPLEMENTES.includes(audit.mode_ia)) {
      return json({ error: "mode_non_implemente", message: `Le mode "${audit.mode_ia}" n'est pas encore implémenté.` }, 501);
    }

    if (audit.statut === "paye" || audit.statut === "termine") {
      await admin.from("audits").update({ statut: "en_traitement" }).eq("id", auditId);
    }

    const { data: criteresBruts } = await admin
      .from("audit_criteria")
      .select("code, label, description, output_key, min_grid_level, categories")
      .eq("is_active", true)
      .lte("min_grid_level", audit.nombre_dimensions)
      .order("sort_order", { ascending: true });
    const criteres = (criteresBruts ?? []) as CritereActif[];
    if (criteres.length === 0) return json({ error: "Aucun critère actif pour ce palier de dimensions." }, 500);
    const autoriserProposition =
      DEGRES_AUTORISANT_PROPOSITION.has(audit.degre_intervention ?? "") &&
      !AUTORISATION_IA_INCERTAINE_OU_REFUSEE.has(audit.contraintes_academiques?.autorisationIA ?? "");
    const schema = fusionnerSchemas(construireSchemaAnalyse(criteres), construireSchemaSyntheseEditoriale(autoriserProposition));
    const consigneCriteres = construireConsigneCriteres(criteres);
    const consigneSyntheseEditoriale = construireConsigneSyntheseEditoriale(autoriserProposition);
    const contexteQualification =
      construireContexteQualification(audit, profilAuteur) +
      construireContextePreaudit(audit.preaudit_resultat as Record<string, unknown> | null);

    // CORRECTIF 26/08/2026 — même bug que preaudit-approfondi-cursaudit :
    // Supabase/PostgREST plafonne une lecture à 1000 lignes sans pagination
    // explicite. Sans réel effet fonctionnel ici (chaque appel ne traite de
    // toute façon qu'un lot borné par BUDGET_MS, et le prochain appel
    // rechargera les unités encore non traitées) mais corrigé par cohérence
    // — un livre à plus de 1000 unités non traitées ne doit pas dépendre de
    // cette compensation accidentelle. Lecture par lots de 1000 via .range().
    const TAILLE_PAGE = 1000;
    const aTraiter: { id: string; texte_source: string }[] = [];
    for (let page = 0; ; page++) {
      let requeteSections = admin
        .from("audit_sections")
        .select("id, texte_source")
        .eq("audit_id", auditId)
        .is("resultat_analyse", null);
      if (chapitreMaxIndex !== undefined) requeteSections = requeteSections.lte("chapitre_index", chapitreMaxIndex);
      const { data: lot } = await requeteSections
        .order("ordre", { ascending: true })
        .range(page * TAILLE_PAGE, page * TAILLE_PAGE + TAILLE_PAGE - 1);
      if (!lot || lot.length === 0) break;
      aTraiter.push(...lot);
      if (lot.length < TAILLE_PAGE) break;
    }

    let traiteesCetteFois = 0;
    let echoueesCetteFois = 0;

    for (const section of aTraiter) {
      if (Date.now() - départ > BUDGET_MS) break; // lot suivant au prochain appel

      try {
        const résultat = await analyserUneSection(section, audit.mode_ia, criteres, schema, consigneCriteres, contexteQualification, consigneSyntheseEditoriale);
        await admin.from("audit_sections").update({ resultat_analyse: résultat }).eq("id", section.id);
        traiteesCetteFois++;
      } catch (err) {
        // Marquée en échec plutôt que laissée vide, pour ne pas être
        // retentée en boucle au prochain appel (voir note en tête de fichier).
        await admin.from("audit_sections").update({ resultat_analyse: { erreur: err.message, analyse_le: new Date().toISOString() } }).eq("id", section.id);
        echoueesCetteFois++;
      }
    }

    // Le compte de "restantes" respecte lui aussi le bornage — sinon la
    // boucle côté client (qui rappelle tant que restantes > 0) continuerait
    // à traiter tout le livre malgré la demande de test partiel.
    let requeteRestantes = admin
      .from("audit_sections")
      .select("id", { count: "exact", head: true })
      .eq("audit_id", auditId)
      .is("resultat_analyse", null);
    if (chapitreMaxIndex !== undefined) requeteRestantes = requeteRestantes.lte("chapitre_index", chapitreMaxIndex);
    const { count: restantes } = await requeteRestantes;

    // "Terminé" seulement s'il y avait réellement des unités à traiter —
    // sinon un audit sans la moindre unité (pas encore importée) serait
    // marqué terminé à tort dès le premier appel (bug réel du 16/08/2026,
    // repéré en test : restantes = 0 parce que rien n'existait, pas parce
    // que le travail était fait). Et JAMAIS "termine" pour un appel borné à
    // un sous-ensemble de chapitres (réf. 25/08/2026) — il reste forcément
    // des unités non traitées hors de ce sous-ensemble.
    const { count: totalUnites } = await admin
      .from("audit_sections")
      .select("id", { count: "exact", head: true })
      .eq("audit_id", auditId);

    let statutFinal = (audit.statut === "paye" || audit.statut === "termine") ? "en_traitement" : audit.statut;
    if (chapitreMaxIndex === undefined && (restantes ?? 0) === 0 && (totalUnites ?? 0) > 0) {
      statutFinal = "termine";
      await admin.from("audits").update({ statut: "termine" }).eq("id", auditId);
    }

    return json({
      audit_id: auditId,
      traitees_cette_fois: traiteesCetteFois,
      echouees_cette_fois: echoueesCetteFois,
      restantes: restantes ?? 0,
      statut: statutFinal,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
