/**
 * CURSUS — Moteur pur des jeux « Devine le livre » et « Quel lecteur es-tu ? » (05/10/2026).
 * Données : public/jeux/livres.json (fiches écrites pour Cursus, sans copie de quatrième de couverture ; voir
 * scripts/verifier-livres.mjs). Aucun appel IA : gratuit pour tous.
 */

let livresEnCache = null;
/** @returns {Promise<object[]>} */
export async function chargerLivres() {
  if (livresEnCache) return livresEnCache;
  const rep = await fetch("/jeux/livres.json");
  if (!rep.ok) throw new Error("Liste des livres introuvable (HTTP " + rep.status + ").");
  livresEnCache = await rep.json();
  return livresEnCache;
}

export const melanger = (t, rng = Math.random) => {
  const a = t.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export const NB_MANCHES = 10;
/** Points d'une bonne réponse selon le nombre d'indices déjà affichés (1 indice = 5 points … 5 indices = 1 point). */
export const pointsPour = (nbIndices) => Math.max(1, 6 - nbIndices);

/**
 * Prépare une partie : `n` livres tirés au hasard, chacun avec 4 propositions (le bon + 3 autres livres du MÊME format
 * — roman ou BD — pour qu'un indice « bande dessinée » ne suffise pas à éliminer tout le monde).
 */
export function preparerManches(livres, n = NB_MANCHES, rng = Math.random) {
  const tirage = melanger(livres, rng).slice(0, Math.min(n, livres.length));
  return tirage.map((livre) => {
    const memes = livres.filter((l) => l.id !== livre.id && l.format === livre.format);
    const autres = livres.filter((l) => l.id !== livre.id && l.format !== livre.format);
    const distracteurs = melanger(memes, rng).concat(melanger(autres, rng)).slice(0, 3);
    return { livre, choix: melanger([livre, ...distracteurs], rng) };
  });
}

/** Message de fin selon le score (sur 5 × nombre de manches). */
export function mention(score, manches) {
  const p = score / (manches * 5);
  if (p >= 0.8) return "Libraire en chef : tu connais tes best-sellers sur le bout des doigts !";
  if (p >= 0.55) return "Grand lecteur : très belle performance.";
  if (p >= 0.3) return "Lecteur régulier : il te reste de belles découvertes à faire.";
  return "Les rayonnages t'attendent : chaque fiche est une idée de lecture.";
}

// ─── Questionnaire de goûts ────────────────────────────────────────────────────

/** Axes notés de 0 à 4 pour chaque livre (public/jeux/livres.json, champ `dims`) et leur formulation. */
export const AXES = {
  suspense: { haut: "un suspense qui tient en haleine", bas: "un rythme calme" },
  emotion: { haut: "beaucoup d'émotion", bas: "un regard plus cérébral" },
  noirceur: { haut: "une ambiance sombre", bas: "une ambiance lumineuse" },
  realisme: { haut: "un ancrage dans le réel", bas: "une part d'imaginaire" },
  exigence: { haut: "une écriture travaillée", bas: "une lecture facile" },
  humour: { haut: "de l'humour", bas: "un ton sérieux" },
};

export const QUESTIONS = [
  { axe: "suspense", texte: "Un soir de pluie, quel genre de lecture te tente ?", options: [
    { label: "Un livre que je ne peux pas lâcher", cible: 4 }, { label: "Une histoire qui avance à son rythme", cible: 2 }, { label: "Une lecture lente et apaisante", cible: 0 }] },
  { axe: "emotion", texte: "Ce que tu cherches dans un livre ?", options: [
    { label: "Être bouleversé·e", cible: 4 }, { label: "Être touché·e, sans excès", cible: 2 }, { label: "Réfléchir, garder la tête froide", cible: 0 }] },
  { axe: "noirceur", texte: "L'ambiance que tu préfères ?", options: [
    { label: "Sombre, qui dérange un peu", cible: 4 }, { label: "Un peu de gravité", cible: 2 }, { label: "Lumineuse et réconfortante", cible: 0 }] },
  { axe: "realisme", texte: "Plutôt…", options: [
    { label: "Une histoire ancrée dans le réel ou l'Histoire", cible: 4 }, { label: "Réaliste, mais avec du romanesque", cible: 2 }, { label: "De l'imaginaire, une fable, du fantastique", cible: 0 }] },
  { axe: "exigence", texte: "Côté écriture ?", options: [
    { label: "Un style travaillé, littéraire", cible: 4 }, { label: "Un beau texte, facile d'accès", cible: 2 }, { label: "Simple et rapide à lire", cible: 0 }] },
  { axe: "humour", texte: "Et l'humour ?", options: [
    { label: "Qu'il me fasse rire", cible: 4 }, { label: "Une touche d'humour suffit", cible: 2 }, { label: "Plutôt sérieux", cible: 0 }] },
  { axe: "epoque", texte: "Tu préfères une histoire…", options: [
    { label: "D'aujourd'hui", epoque: "contemporaine" }, { label: "D'hier, qui plonge dans le passé", epoque: "passe" }, { label: "Peu importe", epoque: null }] },
  { axe: "format", texte: "Roman ou bande dessinée ?", options: [
    { label: "Un roman", format: "roman" }, { label: "Une BD", format: "bd" }, { label: "Les deux me vont", format: null }] },
];

/**
 * Affinités entre les réponses (indice d'option par question) et les livres.
 * Score = somme sur les 6 axes de (4 − écart) + 2 si l'époque correspond ; le format choisi filtre la liste
 * (sans résultat → pas de filtre). Renvoie les `n` meilleurs : { livre, pct, communs }.
 */
export function calculerAffinites(reponses, livres, n = 3) {
  const choix = QUESTIONS.map((q, i) => q.options[reponses[i]]).filter(Boolean);
  const par = Object.fromEntries(QUESTIONS.map((q, i) => [q.axe, q.options[reponses[i]]]));
  let pool = livres;
  if (par.format?.format) { const f = livres.filter((l) => l.format === par.format.format); if (f.length) pool = f; }
  const max = 6 * 4 + (par.epoque?.epoque ? 2 : 0);
  const res = pool.map((livre) => {
    let s = 0; const communs = [];
    for (const axe of Object.keys(AXES)) {
      const cible = par[axe]?.cible;
      if (cible == null) continue;
      const ecart = Math.abs(livre.dims[axe] - cible);
      s += 4 - ecart;
      if (ecart <= 1 && cible !== 2) communs.push(cible > 2 ? AXES[axe].haut : AXES[axe].bas);
    }
    if (par.epoque?.epoque && livre.epoque === par.epoque.epoque) { s += 2; communs.push(par.epoque.epoque === "passe" ? "une histoire ancrée dans le passé" : "une histoire d'aujourd'hui"); }
    return { livre, pct: Math.round((s / max) * 100), communs };
  });
  return res.sort((a, b) => b.pct - a.pct || a.livre.titre.localeCompare(b.livre.titre)).slice(0, n);
}
