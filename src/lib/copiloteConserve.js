/**
 * CURSUS — Résultats du Co-pilote qui ne doivent JAMAIS se perdre à cause d'une navigation (03/11/2026).
 * Retour de Joseph : « quand je quitte la page l'en-cours de réflexion disparaît et les propositions qui ont eu un coût aussi : seul ce que
 * l'auteur abandonne doit disparaître, sinon gabegie de requêtes. »
 *
 * 1. Registre des appels EN COURS (en mémoire du navigateur, il survit au démontage du composant) : un Co-pilote qui se remonte sait qu'une
 *    demande tourne encore pour ce chapitre et l'affiche, au lieu de laisser croire qu'il n'y a rien.
 * 2. Mémoire locale (localStorage, propre à l'appareil) des résultats qui n'étaient conservés NULLE PART : conseils de recomposition,
 *    « Aide-moi à avancer », page blanche, définition du projet. (Les 5 onglets d'analyse et les fils de dialogue sont déjà en base.)
 * Tout est protégé par try/catch : un navigateur sans stockage retombe sur l'ancien comportement.
 */
const enCours = new Map(); // "nœudId|clé" → début (ms)
const PREFIXE = "cursus-copilote-resultat-v1";

const cle = (nœudId, clé) => `${nœudId}|${clé}`;
const diffuser = (nom, detail) => { try { window.dispatchEvent(new CustomEvent(nom, { detail })); } catch { /* hors navigateur */ } };

export function marquerDebut(nœudId, clé) { enCours.set(cle(nœudId, clé), Date.now()); diffuser("cursus-copilote-etat", { nœudId, clé, enCours: true }); }
export function marquerFin(nœudId, clé) { enCours.delete(cle(nœudId, clé)); diffuser("cursus-copilote-etat", { nœudId, clé, enCours: false }); }
export const estEnCours = (nœudId, clé) => enCours.has(cle(nœudId, clé));
/** Clés (ex. "suggestions", "blocage") en cours pour ce chapitre. */
export const clesEnCours = (nœudId) => [...enCours.keys()].filter((k) => k.startsWith(`${nœudId}|`)).map((k) => k.slice(String(nœudId).length + 1));

export function sauverResultat(nœudId, clé, valeur) {
  try { localStorage.setItem(`${PREFIXE}:${nœudId}:${clé}`, JSON.stringify({ le: Date.now(), valeur })); } catch { /* stockage plein ou indisponible */ }
  diffuser("cursus-copilote-resultat", { nœudId, clé });
}
export function lireResultat(nœudId, clé) {
  try { const brut = localStorage.getItem(`${PREFIXE}:${nœudId}:${clé}`); return brut ? JSON.parse(brut).valeur ?? null : null; } catch { return null; }
}
export function effacerResultat(nœudId, clé) { try { localStorage.removeItem(`${PREFIXE}:${nœudId}:${clé}`); } catch { /* rien */ } }

// Résultats des 5 onglets d'analyse produits pendant cette session de navigation : « les plus récents » même si la sauvegarde en base
// n'est pas encore revenue (un Co-pilote remonté pendant qu'un appel se termine les retrouve tout de suite).
const memoire = new Map(); // nœudId → { onglet: valeur }
export function retenirEnMemoire(nœudId, onglet, valeur) { memoire.set(nœudId, { ...(memoire.get(nœudId) || {}), [onglet]: valeur }); }
export const lireMemoire = (nœudId) => memoire.get(nœudId) || {};
