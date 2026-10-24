/**
 * Registre de l'usage des outils d'IA de Cursus par livre (24/10/2026) —
 * alimente le « Dossier de création ». Table `usage_ia_projet`
 * (migration 2026-10-24-usage-ia-projet.sql). Silencieux et non bloquant,
 * comme `journaliserErreur` : un échec ici ne doit JAMAIS gêner l'écriture.
 * Aucun texte du livre n'est enregistré.
 */
import { supabase } from "./supabase.js";

/** outil : 'correction_rapide' | 'verifier_le_fond' | 'copilote' ; action : 'lance' | 'applique' */
export async function noterUsageIA({ projetId, noeudId = null, outil, action, nb = null }) {
  try {
    if (!projetId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("usage_ia_projet").insert({
      user_id: user.id, projet_id: projetId, noeud_id: noeudId, outil, action, nb,
    });
  } catch {
    // Échec silencieux volontaire.
  }
}
