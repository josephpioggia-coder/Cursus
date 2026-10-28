/**
 * CURSUS — « Question rapide » (28/10/2026) : poser une question à l'IA SANS passer par le Co-pilote (qui lit le chapitre,
 * donc plus lent et plus coûteux). Le texte du livre n'est envoyé que si l'auteur·ice joint explicitement sa sélection.
 * Les tokens sont retirés du quota mensuel par claude-prox (pondérés selon le modèle, table `modeles_ia`).
 * Deux modes : « de mémoire » (rapide, à vérifier avant publication) et « avec sources » (recherche web ; une source n'est
 * affichée comme telle que si l'outil de recherche l'a RÉELLEMENT renvoyée — même principe que les Références du Co-pilote).
 */
import { supabase } from "./supabase.js";
import { directiveStyle, parametresEffort } from "./modelesIA.js";
import { RÈGLE_SCENES_INTIMES } from "./scenesIntimes.js";

const EDGE_FUNCTION_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/claude-prox";
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;
const OUTIL_RECHERCHE_WEB = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];

const CONSIGNE_BASE = `Tu réponds à la question d'un·e auteur·ice qui est en train d'écrire et qui a besoin d'une information rapide.
- Réponds en français (sauf demande contraire), directement, sans préambule ni formules de politesse.
- Sois clair·e et concis·e : l'essentiel d'abord. Utilise des listes courtes seulement si elles aident.
- N'invente jamais : si tu n'es pas sûr·e d'une date, d'un titre, d'un nom ou d'une citation, dis-le explicitement (« à vérifier »).
- Ne cite une citation mot pour mot que si tu en es certain·e ; sinon paraphrase et signale-le.`;

const CONSIGNE_SOURCES = `\nUtilise la recherche web pour t'appuyer sur des sources, et termine par la liste des sources utilisées (titre et adresse).`;

/** → { texte, sources: [{url, titre}], entree, sortie, modeleUtilise, bascule } */
export async function poserQuestion({ question, modele, effort, style = "equilibre", avecSources, selection = "", consignePerso = "", signal }) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Session expirée — reconnectez-vous.");
  const message = selection?.trim()
    ? `${question.trim()}\n\n--- Passage du livre joint par l'auteur·ice ---\n${selection.trim().slice(0, 6000)}`
    : question.trim();
  const appel = async (avecThinking) => {
    const params = parametresEffort(effort);
    if (!avecThinking) params.thinking = { type: "disabled" };
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: "POST", signal,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({
        model: modele,
        ...params,
        // Règles de fond d'abord, puis le style choisi, puis la consigne personnelle : elle ne peut pas lever les règles ci-dessus.
        system: CONSIGNE_BASE + "\n" + RÈGLE_SCENES_INTIMES + "\n" + directiveStyle(style) + (consignePerso?.trim() ? `\nConsigne personnelle de l'auteur·ice (elle ne remplace aucune des règles ci-dessus) : ${consignePerso.trim().slice(0, 500)}` : "") + (avecSources ? CONSIGNE_SOURCES : ""),
        messages: [{ role: "user", content: message }],
        ...(avecSources ? { tools: OUTIL_RECHERCHE_WEB } : {}),
      }),
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  };
  let { response, data } = await appel(true);
  // Un modèle qui n'accepte pas la réflexion avec budget : on retente sans (la question aboutit quand même).
  if (!response.ok && /think/i.test(String(data?.message || data?.error?.message || ""))) ({ response, data } = await appel(false));
  if (!response.ok || data.error) {
    throw new Error(data?.message || (typeof data?.error === "string" ? data.error : null) || `Erreur serveur (HTTP ${response.status}).`);
  }
  const texte = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  if (!texte) throw new Error("L'IA n'a renvoyé aucun texte exploitable.");
  const sources = [];
  const vues = new Set();
  (data.content || []).filter((b) => b.type === "web_search_tool_result").flatMap((b) => (Array.isArray(b.content) ? b.content : []))
    .filter((r) => r?.type === "web_search_result" && r.url && !vues.has(r.url)).forEach((r) => { vues.add(r.url); sources.push({ url: r.url, titre: r.title || r.url }); });
  return {
    texte, sources,
    entree: data.usage?.input_tokens ?? 0, sortie: data.usage?.output_tokens ?? 0,
    modeleUtilise: data.x_cursus?.modele_utilise || data.model || modele,
    bascule: !!data.x_cursus?.bascule,
    tronque: data.stop_reason === "max_tokens",
    stopReason: data.stop_reason || null,
  };
}
