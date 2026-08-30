  async supprimer(idéeId) {
    const { error } = await supabase
      .from("idees")
      .delete()
      .eq("id", idéeId);
    return { error };
  },
};

// ─── MÉMOIRE NARRATIVE ────────────────────────────────────────────────────────

export const mémoireNarrativeAPI = {

  async parProjet(projetId) {
    const { data, error } = await supabase
      .from("memoire_narrative")
      .select("*")
      .eq("projet_id", projetId)
      .order("cree_le", { ascending: false });
    return { data, error };
  },

  async créer(mémoire) {
    const uid = await userId();
    const { data, error } = await supabase
      .from("memoire_narrative")
      .insert([{
        user_id:          uid,
        projet_id:        mémoire.projetId,
        type:             mémoire.type,
        contenu:          mémoire.contenu,
        statut:           mémoire.statut || "proposee",
        portee:           mémoire.portée || {},
        source_type:      mémoire.sourceType || null,
        source_reference: mémoire.sourceRéférence || null,
      }])
      .select()
      .single();
    return { data, error };
  },

  async màjStatut(mémoireId, statut) {
    const { data, error } = await supabase
      .from("memoire_narrative")
      .update({ statut, mis_a_jour: new Date().toISOString() })
      .eq("id", mémoireId)
      .select()
      .single();
    return { data, error };
  },

  async remplacer(mémoireId, nouvelleMémoire) {
    const { data: remplaçante, error: erreurCréation } = await this.créer({
      ...nouvelleMémoire,
      statut: "validee",
    });
    if (erreurCréation) return { data: null, error: erreurCréation };
    const { error: erreurMàj } = await supabase
      .from("memoire_narrative")
      .update({ statut: "remplacee", remplace_id: remplaçante.id, mis_a_jour: new Date().toISOString() })
      .eq("id", mémoireId);
    return { data: remplaçante, error: erreurMàj };
  },
};

// ─── SESSIONS ─────────────────────────────────────────────────────────────────
