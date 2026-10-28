/**
 * CURSUS — Aide contextuelle (28/10/2026), première version.
 * Ordre : (1) réponse déjà connue (FAQ fixe + liste commune VALIDÉE) trouvée mécaniquement, sans IA ni coût ;
 * (2) seulement si l'auteur·ice le demande, l'assistant d'aide (Haiku, effort faible), dont les tokens sont décomptés du quota.
 * Une réponse de l'assistant n'entre dans la liste commune qu'après validation par Joseph.
 */
import { supabase } from "./supabase.js";
import { FONCTIONS } from "./rubanCatalogue.js";
import { parametresEffort } from "./modelesIA.js";

const EDGE_FUNCTION_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/claude-prox";
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;
const MODELE_AIDE = "claude-haiku-5-5";

const MOTS_VIDES = new Set("le la les un une des de du d l et ou a au aux en dans sur pour par que qui quoi est sont sert comment pourquoi puis je tu il ce cette ces mon ma mes ton ta son sa ne pas se si y avec sans plus pas bouton faire peut peux dois".split(" "));
export const normaliser = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const mots = (s) => normaliser(s).split(" ").filter((m) => m.length > 2 && !MOTS_VIDES.has(m));
const racine = (m) => m.replace(/(es|s|x|e)$/, "");

/** Score = part des mots de la question retrouvés (par racine) dans question+réponse de l'entrée ; la question de l'entrée compte double. */
export function scoreEntree(question, entree) {
  const q = [...new Set(mots(question).map(racine))];
  if (!q.length) return 0;
  const dansQuestion = new Set(mots(entree.question).map(racine));
  const dansReponse = new Set(mots(entree.reponse).map(racine));
  let pts = 0;
  for (const m of q) pts += dansQuestion.has(m) ? 1 : dansReponse.has(m) ? 0.5 : 0;
  return pts / q.length;
}

/** → entrées triées (score ≥ 0.5), au plus 3. */
export function chercherReponses(question, entrees) {
  return entrees
    .map((e) => ({ ...e, score: scoreEntree(question, e) }))
    .filter((e) => e.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/** Libellé lisible d'un élément de page pointé (aria-label, title, texte). Jamais le contenu du livre. */
export function decrireElement(el) {
  if (!el) return "";
  const b = el.closest?.("button, [role=button], a, select, input, label, [title], [aria-label]") || el;
  if (b.closest?.(".ProseMirror")) return "";
  const txt = (b.getAttribute?.("aria-label") || b.getAttribute?.("title") || b.innerText || b.textContent || "").replace(/\s+/g, " ").trim();
  return txt.slice(0, 80);
}

/** Fonctions connues du ruban, injectées dans le prompt pour que l'assistant ne décrive que ce qui existe. */
function listeFonctions() {
  return FONCTIONS.map((f) => `- ${f.label} (onglet ${f.onglet}${f.statut === "bientot" ? ", PAS ENCORE DISPONIBLE" : ""}) : ${f.aide || ""}`).join("\n");
}

const CONSIGNE_AIDE = (element) => `Tu es l'assistant d'aide de Cursus, un logiciel d'écriture (CursEdit : éditeur de livres ; CursAudit : audit de manuscrit). Tu réponds à une question d'utilisation.
- Réponds en français, simplement, en 2 à 6 phrases ; si ce sont des étapes, une liste courte.
- Ne décris QUE ce que tu peux déduire de la liste de fonctions ci-dessous ou de la question. Si tu ne sais pas si une fonction existe ou comment elle marche, dis-le franchement et propose d'écrire à bonjour@cursus.pro. N'invente jamais un bouton, un menu ou un raccourci.
- Une fonction marquée « PAS ENCORE DISPONIBLE » est seulement prévue : dis-le.
${element ? `- L'utilisateur a pointé l'élément : « ${element} ». Explique à quoi il sert si tu le peux.\n` : ""}
Fonctions connues du ruban de CursEdit :
${listeFonctions()}`;

/** → { texte, tokens } */
export async function demanderAssistantAide({ question, element = "", signal }) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Session expirée — reconnectez-vous.");
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: "POST", signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({
      model: MODELE_AIDE, ...parametresEffort("faible"),
      system: CONSIGNE_AIDE(element),
      messages: [{ role: "user", content: question.trim().slice(0, 1000) }],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data?.message || (typeof data?.error === "string" ? data.error : null) || `Erreur serveur (HTTP ${response.status}).`);
  const texte = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  if (!texte) throw new Error("L'assistant n'a renvoyé aucun texte.");
  return { texte, tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) };
}

export const aideFaqAPI = {
  async validees() {
    const { data, error } = await supabase.from("aide_faq").select("id, question, reponse").eq("statut", "validee").order("cree_le", { ascending: false }).limit(300);
    return error ? [] : data || []; // table absente : on continue avec la FAQ fixe
  },
  async proposer({ question, reponse, element }) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("aide_faq").insert({ question: question.trim(), reponse, element: element || null, propose_par: user?.id, statut: "proposee" });
    return { error };
  },
  async proposees() {
    const { data, error } = await supabase.from("aide_faq").select("id, question, reponse, element").eq("statut", "proposee").order("cree_le").limit(100);
    return error ? [] : data || [];
  },
  async decider(id, statut, reponse) {
    const maj = { statut };
    if (reponse != null) maj.reponse = reponse;
    const { error } = await supabase.from("aide_faq").update(maj).eq("id", id);
    return { error };
  },
};
