/**
 * ATELIER D'ÉCRIVAIN — Couche API Supabase
 *
 * Ce fichier centralise TOUS les appels à la base de données.
 * Aucun composant React n'appelle Supabase directement.
 * Avantage : si Supabase change, on ne touche qu'à ce fichier.
 *
 * Principe : chaque fonction retourne { data, error }
 * Les composants vérifient error avant d'utiliser data.
 *
 * Tables :
 *   projets         — métadonnées des projets
 *   noeuds          — arborescence (parties, chapitres, scènes)
 *   livres          — bibliothèque
 *   citations       — citations extraites des livres
 *   idees           — carnet d'idées
 *   sessions        — historique des sessions d'écriture
 */

import { supabase } from "./supabase.js";

// ─── Utilitaire ────────────────────────────────────────────────────────────────

const userId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

// ─── PROJETS ──────────────────────────────────────────────────────────────────

export const projetsAPI = {

  /** Récupère tous les projets de l'utilisateur connecté */
  async lister() {
    const { data, error } = await supabase
      .from("projets")
      .select("*")
      .order("date_creation", { ascending: false });
    return { data, error };
  },

  /** Crée un nouveau projet */
  async créer(projet) {
    const uid = await userId();
    const { data, error } = await supabase
      .from("projets")
      .insert([{
        user_id:       uid,
        titre:         projet.titre,
        genre:         projet.genre,
        statut:        projet.statut,
        couleur:       projet.couleur,
        objectif_mots: projet.objectifMots,
        description:   projet.description,
        date_creation: projet.dateCreation || new Date().toISOString().slice(0, 10),
      }])
      .select()
      .single();
    return { data, error };
  },

  /** Met à jour les métadonnées d'un projet */
  async màjMeta(projetId, champs) {
    const { data, error } = await supabase
      .from("projets")
      .update({
        titre:         champs.titre,
        genre:         champs.genre,
        statut:        champs.statut,
        couleur:       champs.couleur,
        objectif_mots: champs.objectifMots,
        description:   champs.description,
      })
      .eq("id", projetId)
      .select()
      .single();
    return { data, error };
  },

  /** Supprime un projet (et ses nœuds via CASCADE en base) */
  async supprimer(projetId) {
    const { error } = await supabase
      .from("projets")
      .delete()
      .eq("id", projetId);
    return { error };
  },
};

// ─── NŒUDS (structure du manuscrit) ──────────────────────────────────────────

export const nœudsAPI = {

  /** Récupère toute la structure d'un projet */
  async listerParProjet(projetId) {
    const { data, error } = await supabase
      .from("noeuds")
      .select("*")
      .eq("projet_id", projetId)
      .order("ordre", { ascending: true });
    return { data, error };
  },

  /** Crée un nœud */
  async créer(nœud, projetId) {
    const { data, error } = await supabase
      .from("noeuds")
      .insert([{
        projet_id: projetId,
        parent_id: nœud.parentId || null,
        type:      nœud.type,
        titre:     nœud.titre,
        ordre:     nœud.ordre || 0,
        texte:     nœud.texte || "",
      }])
      .select()
      .single();
    return { data, error };
  },

  /** Sauvegarde le texte HTML d'un nœud (éditeur) */
  async sauvegarderTexte(nœudId, texte) {
    const { error } = await supabase
      .from("noeuds")
      .update({ texte, mis_a_jour: new Date().toISOString() })
      .eq("id", nœudId);
    return { error };
  },

  /** Renomme un nœud */
  async renommer(nœudId, titre) {
    const { error } = await supabase
      .from("noeuds")
      .update({ titre })
      .eq("id", nœudId);
    return { error };
  },

  /** Supprime un nœud (et ses enfants via CASCADE) */
  async supprimer(nœudId) {
    const { error } = await supabase
      .from("noeuds")
      .delete()
      .eq("id", nœudId);
    return { error };
  },

  /** Met à jour l'ordre de plusieurs nœuds en une seule transaction */
  async réordonner(mises_à_jour) {
    const promises = mises_à_jour.map(({ id, ordre }) =>
      supabase.from("noeuds").update({ ordre }).eq("id", id)
    );
    const résultats = await Promise.all(promises);
    const erreur = résultats.find((r) => r.error)?.error || null;
    return { error: erreur };
  },
};

// ─── LIVRES ───────────────────────────────────────────────────────────────────

export const livresAPI = {

  /** Récupère tous les livres avec leurs citations */
  async lister() {
    const { data, error } = await supabase
      .from("livres")
      .select("*, citations(*)")
      .order("created_at", { ascending: false });
    return { data, error };
  },

  /** Crée un livre */
  async créer(livre) {
    const uid = await userId();
    const { data, error } = await supabase
      .from("livres")
      .insert([{
        user_id:  uid,
        titre:    livre.titre,
        auteur:   livre.auteur,
        année:    livre.année,
        editeur:  livre.éditeur,
        ville:    livre.ville,
        genre:    livre.genre,
        statut:   livre.statut,
        note:     livre.note,
        tags:     livre.tags || [],
      }])
      .select()
      .single();
    return { data, error };
  },

  /** Met à jour un livre */
  async màj(livreId, champs) {
    const { data, error } = await supabase
      .from("livres")
      .update({
        titre:   champs.titre,
        auteur:  champs.auteur,
        année:   champs.année,
        editeur: champs.éditeur,
        ville:   champs.ville,
        genre:   champs.genre,
        statut:  champs.statut,
        note:    champs.note,
        tags:    champs.tags || [],
      })
      .eq("id", livreId)
      .select()
      .single();
    return { data, error };
  },

  /** Supprime un livre (et ses citations via CASCADE) */
  async supprimer(livreId) {
    const { error } = await supabase
      .from("livres")
      .delete()
      .eq("id", livreId);
    return { error };
  },
};

// ─── CITATIONS ────────────────────────────────────────────────────────────────

export const citationsAPI = {

  /** Ajoute une citation à un livre */
  async ajouter(citation, livreId) {
    const { data, error } = await supabase
      .from("citations")
      .insert([{
        livre_id:    livreId,
        projet_id:   citation.projetId || null,
        texte:       citation.texte,
        page:        citation.page || null,
        paragraphe:  citation.paragraphe || null,
        tags:        citation.tags || [],
        date_ajout:  citation.dateAjout || new Date().toISOString().slice(0, 10),
      }])
      .select()
      .single();
    return { data, error };
  },

  /** Supprime une citation */
  async supprimer(citationId) {
    const { error } = await supabase
      .from("citations")
      .delete()
      .eq("id", citationId);
    return { error };
  },

  /** Récupère toutes les citations liées à un projet */
  async parProjet(projetId) {
    const { data, error } = await supabase
      .from("citations")
      .select("*, livres(titre, auteur, année)")
      .eq("projet_id", projetId);
    return { data, error };
  },
};

// ─── IDÉES ────────────────────────────────────────────────────────────────────

export const idéesAPI = {

  async lister() {
    const { data, error } = await supabase
      .from("idees")
      .select("*")
      .order("date_ajout", { ascending: false });
    return { data, error };
  },

  async créer(idée) {
    const uid = await userId();
    const { data, error } = await supabase
      .from("idees")
      .insert([{
        user_id:    uid,
        texte:      idée.texte,
        tags:       idée.tags || [],
        statut:     idée.statut || "nouvelle",
        projet_id:  idée.projetId || null,
        priorite:   idée.priorité || 2,
        date_ajout: new Date().toISOString(),
      }])
      .select()
      .single();
    return { data, error };
  },

  async màj(idéeId, champs) {
    const { data, error } = await supabase
      .from("idees")
      .update({
        texte:     champs.texte,
        tags:      champs.tags || [],
        statut:    champs.statut,
        projet_id: champs.projetId || null,
        priorite:  champs.priorité || 2,
      })
      .eq("id", idéeId)
      .select()
      .single();
    return { data, error };
  },

  async supprimer(idéeId) {
    const { error } = await supabase
      .from("idees")
      .delete()
      .eq("id", idéeId);
    return { error };
  },
};

// ─── SESSIONS ─────────────────────────────────────────────────────────────────

export const sessionsAPI = {

  async lister() {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .order("date", { ascending: false })
      .limit(50);
    return { data, error };
  },

  async enregistrer(session) {
    const uid = await userId();
    const { data, error } = await supabase
      .from("sessions")
      .insert([{
        user_id:       uid,
        projet_id:     session.projetId,
        projet_titre:  session.projetTitre,
        projet_couleur: session.projetCouleur,
        mots:          session.mots,
        duree:         session.durée,
        date:          session.date || new Date().toISOString().slice(0, 10),
      }])
      .select()
      .single();
    return { data, error };
  },
};
