/**
 * CURSUS — src/lib/journalErreurs.js
 *
 * Journalisation discrète des erreurs techniques rencontrées par l'utilisateur,
 * pour que Joseph (admin) puisse les consulter sans dépendre de captures
 * d'écran. Table : public.journal_erreurs (créée le 15/07/2026).
 *
 * Volontairement silencieux et non bloquant : si la journalisation elle-même
 * échoue (ex. pas de réseau), on ne relance jamais d'erreur — l'utilisateur ne
 * doit jamais voir un problème causé par le système de suivi des problèmes.
 */

import { supabase } from "./supabase.js";

export async function journaliserErreur(contexte, message, projetId = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("journal_erreurs").insert({
      user_id: user.id,
      projet_id: projetId,
      contexte,
      message: String(message).slice(0, 2000),
    });
  } catch {
    // Échec silencieux volontaire — voir note en tête de fichier.
  }
}

// Détecte si une erreur est probablement liée au réseau (coupure, timeout),
// pour afficher un message adapté plutôt que le texte technique brut.
export function estErreurRéseau(err) {
  const m = (err?.message || "").toLowerCase();
  return m.includes("networkerror") || m.includes("failed to fetch") || m.includes("fetch");
}
