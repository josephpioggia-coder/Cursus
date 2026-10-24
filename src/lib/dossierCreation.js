/**
 * DOSSIER DE CRÉATION (24/10/2026) — trace datée de la production d'un livre,
 * pour l'auteur·ice et pour ses clients. Demande de Joseph : « pour chaque
 * nouveau livre une trace, avec l'historique du livre et de sa production :
 * avancées, dates, mots… ».
 *
 * Source : les instantanés `versions_noeuds` (date + nombre de mots, JAMAIS le
 * texte) et la structure actuelle du projet. Ces instantanés ne sont pas pris à
 * chaque frappe (≥ 50 mots d'écart, ou toutes les 5 min si le texte a changé —
 * seul ce second déclencheur existe depuis le 24/10/2026) : les livres écrits
 * avant cette date ont un historique plus clairsemé. C'est un INDICE de
 * processus, pas une preuve juridique ; l'usage d'outils d'IA n'est pas
 * enregistré ici (aucun journal de ce type n'existe pour l'éditeur).
 *
 * Fonctions PURES (testables) : `construireDossier`, `compterMotsHtml`.
 */

export const compterMotsHtml = (html = "") =>
  (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;

const jourDe = (iso) => String(iso).slice(0, 10);

/** Aplatit l'arbre de structure en liste de nœuds avec leur nombre de mots actuel. */
export function aplatirStructure(structure = [], profondeur = 0, sortie = []) {
  for (const n of structure) {
    sortie.push({ id: n.id, titre: n.titre || "(sans titre)", type: n.type, profondeur, mots: compterMotsHtml(n.texte), zone: n.zone || "corps" });
    aplatirStructure(n.enfants || [], profondeur + 1, sortie);
  }
  return sortie;
}

/**
 * @param projet   { titre, genre, objectifMots, dateCreation, structure }
 * @param versions [{ noeud_id, mots, created_at }]
 * @param aujourdhui Date (injectable pour les tests)
 */
export function construireDossier(projet, versions = [], aujourdhui = new Date(), usageIA = null) {
  const nœuds = aplatirStructure(projet.structure);
  const motsActuels = nœuds.reduce((a, n) => a + n.mots, 0);

  const parNoeud = new Map();
  for (const v of versions) {
    if (!parNoeud.has(v.noeud_id)) parNoeud.set(v.noeud_id, []);
    parNoeud.get(v.noeud_id).push(v);
  }
  for (const l of parNoeud.values()) l.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

  const chapitres = nœuds.map((n) => {
    const l = parNoeud.get(n.id) || [];
    return {
      ...n,
      nbVersions: l.length,
      premiere: l.length ? jourDe(l[0].created_at) : null,
      derniere: l.length ? jourDe(l[l.length - 1].created_at) : null,
    };
  });

  // Jours d'activité : tous les jours où au moins un instantané existe.
  const jours = [...new Set(versions.map((v) => jourDe(v.created_at)))].sort();
  // Total de mots à la fin de chaque jour = somme, par nœud, du dernier instantané ≤ ce jour.
  const courbe = jours.map((j) => {
    let total = 0, nb = 0;
    for (const l of parNoeud.values()) {
      let dernier = null;
      for (const v of l) if (jourDe(v.created_at) <= j) dernier = v; else break;
      if (dernier) total += dernier.mots || 0;
    }
    for (const v of versions) if (jourDe(v.created_at) === j) nb++;
    return { jour: j, mots: total, instantanes: nb };
  });
  const lignes = courbe.map((c, i) => ({ ...c, variation: c.mots - (i ? courbe[i - 1].mots : 0) }));

  return {
    titre: projet.titre || "Sans titre",
    genre: projet.genre || "",
    dateCreation: projet.dateCreation || null,
    genereLe: aujourdhui.toISOString(),
    objectifMots: projet.objectifMots || 0,
    motsActuels,
    pourcentage: projet.objectifMots ? Math.min(100, Math.round((motsActuels / projet.objectifMots) * 100)) : null,
    nbChapitres: nœuds.length,
    nbInstantanes: versions.length,
    premierJour: jours[0] || null,
    dernierJour: jours[jours.length - 1] || null,
    joursActifs: jours.length,
    lignes,
    chapitres,
    usageIA: resumerUsageIA(usageIA),
  };
}

export const NOMS_OUTILS_IA = {
  correction_rapide: "Correction rapide (fautes, fluidité, bilan de relecture)",
  verifier_le_fond: "Vérifier les faits (affirmations, chiffres, sources)",
  avis_fond: "Vérifier le fond (avis éditorial sur le récit ou le propos)",
  profil_lisibilite: "Profil de lisibilité (effort de lecture du texte)",
  lecture_photo: "Lecture d'une photo de page (transcription en texte)",
  copilote: "Co-pilote (analyses et suggestions)",
};

/** null = registre indisponible (table absente) ; sinon un résumé par outil. */
export function resumerUsageIA(lignes) {
  if (!lignes) return null;
  const outils = {};
  for (const l of lignes) {
    const o = outils[l.outil] || (outils[l.outil] = { lancements: 0, applications: 0, passagesModifies: 0, premier: null, dernier: null });
    if (l.action === "lance") o.lancements++;
    if (l.action === "applique") { o.applications++; o.passagesModifies += l.nb || 0; }
    const j = jourDe(l.cree_le);
    if (!o.premier || j < o.premier) o.premier = j;
    if (!o.dernier || j > o.dernier) o.dernier = j;
  }
  const dates = lignes.map((l) => jourDe(l.cree_le)).sort();
  return { outils, total: lignes.length, debutRegistre: dates[0] || null };
}
