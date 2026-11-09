/**
 * CURSUS — Jeu « Lire pour traverser » (09/11/2026) : livres sur la maladie, la fin de vie et le deuil.
 * Données : public/jeux/lectures-deuil.json — titres, auteurs et genres (des FAITS) d'une sélection de 13 ouvrages, résumés
 * et indices réécrits pour Cursus (aucun texte d'une source copié). Les 7 premiers fiches ont 5 indices (jeu « Devine le
 * livre ») ; les 6 autres n'ont que titre / auteur / genre / résumé (jeu « Auteurs et genres »). Gratuit, aucun appel IA.
 * Contrôle : node scripts/verifier-lectures.mjs
 */
import { melanger } from "./jeuLivres.js";

let enCache = null;
export async function chargerLectures() {
  if (enCache) return enCache;
  const rep = await fetch("/jeux/lectures-deuil.json");
  if (!rep.ok) throw new Error("Liste des lectures introuvable (HTTP " + rep.status + ").");
  enCache = await rep.json();
  return enCache;
}

export const CATEGORIES = {
  roman: "Roman",
  temoignage: "Témoignage ou récit intime",
  essai: "Essai ou enquête",
  philo: "Philosophie ou éthique",
};

export const NB_QUESTIONS = 10;

/** Livres ayant 5 indices (jeu « Devine le livre »). */
export const avecIndices = (livres) => livres.filter((l) => Array.isArray(l.indices) && l.indices.length === 5);

/**
 * Questions « Auteurs et genres » : « Qui a écrit … ? » (un auteur, 3 autres auteurs distincts) et « Quel genre … ? »
 * (seulement si `categorie` est renseignée : un livre au genre discutable n'est jamais interrogé sur son genre).
 */
export function preparerQuestions(livres, n = NB_QUESTIONS, rng = Math.random) {
  const pool = [];
  for (const l of livres) {
    pool.push({ type: "auteur", livre: l });
    if (l.categorie) pool.push({ type: "genre", livre: l });
  }
  const tirage = [];
  const vus = new Set(); // une seule question par livre
  for (const q of melanger(pool, rng)) {
    if (vus.has(q.livre.id)) continue;
    vus.add(q.livre.id); tirage.push(q);
    if (tirage.length >= n) break;
  }
  return tirage.map((q) => {
    if (q.type === "auteur") {
      const autres = [...new Set(livres.filter((l) => l.auteur !== q.livre.auteur).map((l) => l.auteur))];
      const choix = melanger([q.livre.auteur, ...melanger(autres, rng).slice(0, 3)], rng);
      return { ...q, texte: `Qui a écrit « ${q.livre.titre} » ?`, choix: choix.map((c) => ({ id: c, label: c })), bonne: q.livre.auteur };
    }
    const choix = melanger(Object.keys(CATEGORIES), rng).map((k) => ({ id: k, label: CATEGORIES[k] }));
    return { ...q, texte: `Dans quelle catégorie ranger « ${q.livre.titre} » ?`, choix, bonne: q.livre.categorie };
  });
}

/** `manches` = nombre de questions ; le score maximal est 5 par manche (Devine le livre) — cf. mentionQuiz pour 1 point par question. */
export function mention(score, manches) {
  const p = score / (manches * 5);
  if (p >= 0.8) return "Tu connais très bien ces lectures.";
  if (p >= 0.5) return "Belle connaissance de ces livres : chaque fiche est une piste de lecture.";
  return "Ces livres t'attendent peut-être : chaque fiche donne envie d'en lire un.";
}

export function mentionQuiz(score, total) { return mention(score * 5, total); }
