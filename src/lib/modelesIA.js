/**
 * CURSUS — Choix du modèle d'IA et de l'« effort » par l'auteur·ice (28/10/2026)
 * ======================================================================
 * Décision de Joseph : le client choisit à tout moment le modèle et l'effort (comme dans le menu de Claude) ; l'effort
 * détermine la consommation de son quota ; une recommandation est affichée. Les modèles viennent de la table
 * `modeles_ia` (voir 2026-10-28-modeles-ia.sql : poids dans le quota, modèle de secours, « recommandé »…) — quand un
 * fournisseur change ses modèles, on modifie des LIGNES, pas le code. `MODELES_PAR_DEFAUT` ne sert que tant que la table
 * n'existe pas / est injoignable.
 */
import { supabase } from "./supabase.js";

export const MODELES_PAR_DEFAUT = [
  { id: "claude-opus-5-5", libelle: "Opus 5.5", description: "Réponses plus approfondies, consomme davantage.", poids: 2.5, ordre: 10, recommande: false, credits_requis: false },
  { id: "claude-sonnet-5-5", libelle: "Sonnet 5.5", description: "Le bon équilibre entre qualité, vitesse et consommation.", poids: 1, ordre: 20, recommande: true, credits_requis: false },
  { id: "claude-fable-5-1", libelle: "Fable 5.1", description: "Le plus puissant ; nécessite des crédits.", poids: 5, ordre: 30, recommande: false, credits_requis: true },
  { id: "claude-haiku-5-5", libelle: "Haiku 5.5", description: "Le plus rapide et le plus économe : questions courtes, informations simples.", poids: 0.5, ordre: 40, recommande: false, credits_requis: false },
];

/**
 * Niveaux d'effort. `budget` = budget de réflexion de l'IA (tokens) : c'est ce qui rend une réponse plus approfondie ET
 * plus lente / plus coûteuse. `conso` = repère d'affichage de la consommation (1 = la plus légère). Moyen = recommandé.
 */
export const EFFORTS = [
  { id: "faible", libelle: "Faible", budget: 0, maxTokens: 700, conso: 1, aide: "Réponse directe et courte." },
  { id: "moyen", libelle: "Moyen", budget: 0, maxTokens: 1500, conso: 2, aide: "Réponse complète, sans réflexion préalable.", recommande: true },
  { id: "eleve", libelle: "Élevé", budget: 2000, maxTokens: 4500, conso: 3, aide: "L'IA réfléchit avant de répondre." },
  { id: "extra", libelle: "Extra", budget: 6000, maxTokens: 9000, conso: 4, aide: "Réflexion plus longue, pour une question délicate." },
  { id: "max", libelle: "Max", budget: 14000, maxTokens: 18000, conso: 5, aide: "Réflexion maximale : lent et nettement plus coûteux." },
];

const CLE_MODELE = "cursus-ia-modele";
const CLE_EFFORT = "cursus-ia-effort";

/** Paramètres à joindre à l'appel : réflexion désactivée explicitement (voir la cause « thinking » du 01/10/2026) ou budget borné. */
export function parametresEffort(effortId) {
  const e = EFFORTS.find((x) => x.id === effortId) || EFFORTS[1];
  return {
    max_tokens: e.maxTokens,
    thinking: e.budget > 0 ? { type: "enabled", budget_tokens: e.budget } : { type: "disabled" },
  };
}

let cache = null;
/** Modèles proposés au client (visibles, actifs), triés ; table absente → valeurs par défaut. */
export async function chargerModeles(force = false) {
  if (cache && !force) return cache;
  try {
    const { data, error } = await supabase.from("modeles_ia").select("id, libelle, description, poids, ordre, visible, actif, recommande, credits_requis").order("ordre");
    if (!error && Array.isArray(data) && data.length) {
      const liste = data.filter((m) => m.visible !== false && m.actif !== false);
      if (liste.length) { cache = liste; return cache; }
    }
  } catch { /* repli ci-dessous */ }
  cache = MODELES_PAR_DEFAUT;
  return cache;
}

export function lireChoix(modeles) {
  let m = null, e = null;
  try { m = localStorage.getItem(CLE_MODELE); e = localStorage.getItem(CLE_EFFORT); } catch { /* sans stockage */ }
  const modele = modeles.some((x) => x.id === m) ? m : (modeles.find((x) => x.recommande) || modeles[0])?.id;
  const effort = EFFORTS.some((x) => x.id === e) ? e : "moyen";
  return { modele, effort };
}
export function ecrireChoix({ modele, effort }) {
  try { if (modele) localStorage.setItem(CLE_MODELE, modele); if (effort) localStorage.setItem(CLE_EFFORT, effort); } catch { /* sans stockage */ }
}

/** Consommation relative affichée avant l'envoi : poids du modèle × repère d'effort (1 = Haiku, effort faible). */
export function consoRelative(modele, effortId, modeles) {
  const poids = modeles.find((m) => m.id === modele)?.poids ?? 1;
  const e = EFFORTS.find((x) => x.id === effortId) || EFFORTS[1];
  return Math.round((poids / 0.5) * e.conso * 10) / 10;
}
