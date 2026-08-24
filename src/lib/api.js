/**
 * CURSUS — Couche API Supabase
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
import { segmenterTexte } from "./segmenterCursAudit.js";

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
        // Zone de visibilité — chantier 28/07/2026. La colonne a un DEFAULT
        // 'corps' en base, mais on l'envoie explicitement pour que le nœud
        // retourné par .select() la contienne toujours.
        zone:      nœud.zone || "corps",
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

  /** Change le type d'un nœud (partie / chapitre / scène) — ajouté 18/07/2026 */
  async changerType(nœudId, type) {
    const { error } = await supabase
      .from("noeuds")
      .update({ type })
      .eq("id", nœudId);
    return { error };
  },

  /** Change la zone de visibilité d'un nœud (corps / reserve / methodo /
   *  brouillon) — ajouté 28/07/2026, chantier "Zones de visibilité par nœud".
   *  La contrainte CHECK en base rejette toute autre valeur. */
  async changerZone(nœudId, zone) {
    const { error } = await supabase
      .from("noeuds")
      .update({ zone })
      .eq("id", nœudId);
    return { error };
  },

  /** Change le parent d'un nœud (promotion/rattachement) — ajouté 18/07/2026.
   *  nouveauParentId peut être null (le nœud devient une "partie" à la racine). */
  async changerParent(nœudId, nouveauParentId) {
    const { error } = await supabase
      .from("noeuds")
      .update({ parent_id: nouveauParentId })
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

// ─── USAGE IA (60803-03) ──────────────────────────────────────────────────────
// Comptage réel de la consommation IA d'un compte, comparé au quota de
// tokens du palier actif (quotas_paliers) plus les crédits éventuellement
// achetés (credits_ia). `usage_ia` est alimentée par l'Edge Function
// claude-prox à chaque appel — jamais écrite depuis le client.

export const usageIAAPI = {

  // Retourne { palier, quotaMensuel, credits, consomme, disponible, pourcentage }
  // pour le mois en cours (calendaire, du 1er du mois à aujourd'hui).
  async recupererConsommation() {
    const uid = await userId();
    if (!uid) return { data: null, error: new Error("Non connecté") };

    const { data: abonnement, error: erreurAbonnement } = await supabase
      .from("abonnements")
      .select("palier")
      .eq("user_id", uid)
      .eq("statut", "actif")
      .maybeSingle();
    if (erreurAbonnement) return { data: null, error: erreurAbonnement };
    if (!abonnement) return { data: null, error: new Error("Aucun abonnement actif") };

    const { data: quota, error: erreurQuota } = await supabase
      .from("quotas_paliers")
      .select("tokens_mensuels")
      .eq("palier", abonnement.palier)
      .maybeSingle();
    if (erreurQuota) return { data: null, error: erreurQuota };

    const débutMois = new Date();
    débutMois.setDate(1);
    débutMois.setHours(0, 0, 0, 0);

    const { data: lignesUsage, error: erreurUsage } = await supabase
      .from("usage_ia")
      .select("tokens_entree, tokens_sortie")
      .eq("user_id", uid)
      .gte("created_at", débutMois.toISOString());
    if (erreurUsage) return { data: null, error: erreurUsage };

    const consomme = (lignesUsage || []).reduce(
      (total, ligne) => total + (ligne.tokens_entree || 0) + (ligne.tokens_sortie || 0), 0
    );

    const { data: lignesCredits, error: erreurCredits } = await supabase
      .from("credits_ia")
      .select("tokens_offerts")
      .eq("user_id", uid);
    if (erreurCredits) return { data: null, error: erreurCredits };

    const credits = (lignesCredits || []).reduce((total, l) => total + (l.tokens_offerts || 0), 0);

    const quotaMensuel = quota?.tokens_mensuels || 0;
    const totalDisponibleAvantConso = quotaMensuel + credits;
    const disponible = Math.max(0, totalDisponibleAvantConso - consomme);
    const pourcentage = totalDisponibleAvantConso > 0
      ? Math.min(100, Math.round((consomme / totalDisponibleAvantConso) * 100))
      : 0;

    return {
      data: { palier: abonnement.palier, quotaMensuel, credits, consomme, disponible, pourcentage },
      error: null,
    };
  },
};

// ─── AUDITS (CursAudit) — référence 60816-01 ────────────────────────────────
// Écriture directe via RLS (auth.uid() = user_id) : pas besoin d'Edge Function
// pour la simple création, contrairement à l'analyse elle-même qui appelle
// des IA externes côté serveur (analyser-unite-cursaudit, orchestrer-audit-cursaudit).

export const auditsAPI = {

  /**
   * Crée un audit (statut "brouillon" — le paiement Stripe pour CursAudit
   * n'existe pas encore, voir docs/cursaudit-tarification.md) et ses unités
   * dans audit_sections, à partir d'unités DÉJÀ segmentées (peu importe la
   * source : texte collé via segmenterTexte(), ou .docx via
   * extraireParagraphesDocx() — voir src/lib/segmenterCursAudit.js).
   */
  async créer({
    titre, unités, palierDimensions, nombreDimensions, modeIA, typeRapport, nombrePages, prixTTC, projetId = null,
    // Questionnaire de qualification (référence 60816-01, suite, 22/08/2026)
    // — voir questionnaire-cursaudit-v1-specification.md et
    // CursAuditQuestionnaire.jsx. Optionnels : un appel existant sans ces
    // champs (aucun ne l'était avant ce jour) continue de fonctionner.
    typeDocument = null, statutTexte = null, finaliteAudit = null, questionLibre = null,
    degreIntervention = null, contraintesAcademiques = null, relationIA = null,
    // Chapitres détectés à l'import .docx (réf. 60816-01, suite, 24/08/2026)
    // — voir extraireParagraphesDocxAvecChapitres() dans
    // segmenterCursAudit.js. null si texte collé ou aucune structure
    // détectée : le pré-audit enrichi chapitre par chapitre n'est alors
    // simplement pas proposé pour cet audit (voir CursAuditDetail.jsx).
    chapitresDétectés = null,
  }) {
    if (!unités || unités.length === 0) return { data: null, error: { message: "Aucune unité détectée." } };

    const uid = await userId();
    const { data: audit, error: erreurAudit } = await supabase
      .from("audits")
      .insert([{
        user_id:           uid,
        projet_id:         projetId,
        titre,
        palier_dimensions: palierDimensions,
        nombre_dimensions: nombreDimensions,
        mode_ia:           modeIA,
        type_rapport:      typeRapport,
        nombre_pages:      nombrePages,
        prix_ttc:          prixTTC,
        statut:            "brouillon",
        type_document:           typeDocument,
        statut_texte:            statutTexte,
        finalite_audit:          finaliteAudit,
        question_libre:          questionLibre,
        degre_intervention:      degreIntervention,
        contraintes_academiques: contraintesAcademiques,
        relation_ia:             relationIA,
        chapitres_detectes:      chapitresDétectés,
      }])
      .select()
      .single();
    if (erreurAudit) return { data: null, error: erreurAudit };

    // chapitre_index : pour chaque unité, l'index (dans chapitresDétectés)
    // du chapitre auquel elle appartient — null si elle précède le premier
    // titre détecté (texte avant tout chapitre) ou si aucune structure
    // n'a été détectée pour cet audit.
    const chapitreIndexParUnité = (i) => {
      if (!chapitresDétectés) return null;
      for (let c = 0; c < chapitresDétectés.length; c++) {
        const { indexPremièreUnité, nombreUnités } = chapitresDétectés[c];
        if (i >= indexPremièreUnité && i < indexPremièreUnité + nombreUnités) return c;
      }
      return null;
    };

    const lignes = unités.map((texteSource, i) => ({
      audit_id: audit.id, ordre: i + 1, texte_source: texteSource,
      chapitre_index: chapitreIndexParUnité(i),
    }));
    const { error: erreurSections } = await supabase.from("audit_sections").insert(lignes);
    if (erreurSections) return { data: null, error: erreurSections };

    return { data: { audit, nombreUnités: unités.length }, error: null };
  },

  /** Variante pratique de créer() : segmente un texte déjà en clair (collé) avant de créer. */
  async créerDepuisTexte({ titre, texte, ...reste }) {
    const unités = segmenterTexte(texte);
    return auditsAPI.créer({ titre, unités, ...reste });
  },

  /** Récupère tous les audits de l'utilisateur connecté */
  async lister() {
    const { data, error } = await supabase
      .from("audits")
      .select("*")
      .order("cree_le", { ascending: false });
    return { data, error };
  },

  /** Récupère un audit et ses unités (avec leurs résultats s'ils existent) */
  async récupérerAvecSections(auditId) {
    const { data: audit, error: erreurAudit } = await supabase
      .from("audits")
      .select("*")
      .eq("id", auditId)
      .single();
    if (erreurAudit) return { data: null, error: erreurAudit };

    const { data: sections, error: erreurSections } = await supabase
      .from("audit_sections")
      .select("*")
      .eq("audit_id", auditId)
      .order("ordre", { ascending: true });
    if (erreurSections) return { data: null, error: erreurSections };

    return { data: { audit, sections: sections || [] }, error: null };
  },

  /** Règles de tarification actives (audit_pricing_rules) — lecture publique,
   *  voir src/lib/tarifCursAudit.js pour le calcul du prix à partir de ces règles. */
  async récupérerReglesPrix() {
    const { data, error } = await supabase
      .from("audit_pricing_rules")
      .select("categorie, cle, libelle, valeur_numerique")
      .eq("actif", true);
    return { data, error };
  },
};

