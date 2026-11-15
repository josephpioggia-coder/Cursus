/**
 * CURSUS — Changement de formule (15/11/2026). Appelle l'Edge Function `changer-formule` (voir son en-tête pour les règles).
 * Les montants affichés viennent de Stripe (aperçu), jamais calculés ici.
 */
import { supabase } from "./supabase.js";

export const euros = (centimes) => (centimes / 100).toFixed(2).replace(".", ",") + " €";

export async function appelerFonction(nom, corps) {
  const { data: { session } } = await supabase.auth.getSession();
  const base = import.meta.env.VITE_SUPABASE_URL || "https://ssnowhvkwqfpournmyut.supabase.co";
  const url = base + "/functions/v1/" + nom;
  const cleAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || cleAnon}`, apikey: cleAnon },
      body: JSON.stringify(corps),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, message: data.message || data.error || `Erreur ${r.status}` };
    return data;
  } catch (e) {
    return { ok: false, message: "Connexion impossible : " + e.message };
  }
}

export const apercuChangement = (price_id) => appelerFonction("changer-formule", { action: "apercu", price_id });
export const confirmerChangement = (price_id, date_calcul) => appelerFonction("changer-formule", { action: "confirmer", price_id, date_calcul });

/** Formule active du compte connecté (nom du palier) ou null. */
export async function formuleActive() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("abonnements").select("palier, date_debut").eq("user_id", user.id).eq("statut", "actif")
    .order("date_debut", { ascending: false }).limit(1);
  if (error || !data?.length) return null;
  return data[0].palier;
}
