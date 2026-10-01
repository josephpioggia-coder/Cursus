/**
 * CURSUS — Outils de mots pour le Scrabble (29/09/2026)
 * ======================================================================
 * Module PUR (sauf chargerListe/definir, qui font des fetch) : recherche
 * dans la liste de mots (public/scrabble/mots-fr.txt, sans accents,
 * MAJUSCULES) — mots depuis des lettres (jokers "?"), anagrammes exacts,
 * motifs "C_R_US" / "CUR*", commence/finit/contient, longueur, tri.
 * Score d'un mot = points des seules lettres du CHEVALET (jokers = 0),
 * sans primes ni lettres déjà posées — comme le solveur dCode pris pour modèle.
 */

import { pointsLettre } from "./scrabbleSolveur.js";

export const normaliser = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/gi, "OE").replace(/æ/gi, "AE").toUpperCase();

let listeEnCache = null;
export async function chargerListe() {
  if (listeEnCache) return listeEnCache;
  const rep = await fetch("/scrabble/mots-fr.txt");
  if (!rep.ok) throw new Error("Dictionnaire introuvable (HTTP " + rep.status + ").");
  const texte = await rep.text();
  const mots = texte.split(/\r?\n/).filter((m) => m.length > 1);
  listeEnCache = { texte, mots, ensemble: new Set(mots) };
  return listeEnCache;
}

const POSITIONS = {
  indifferent: () => true,
  debut: (i, n) => i === 0,
  fin: (i, n) => i === n - 1,
  milieu: (i, n) => i > 0 && i < n - 1,
};

const stockDe = (lettres) => {
  const stock = new Int8Array(26);
  let jokers = 0;
  for (const l of lettres) { if (l === "?") jokers++; else stock[l.charCodeAt(0) - 65]++; }
  return { stock, jokers };
};

/**
 * Forme `chars` avec le chevalet (stock, jokers). Les vraies lettres sont
 * consommées d'abord (les jokers sont gardés le plus longtemps possible).
 * @returns {{score:number, reste:string}|null} score des seules lettres du
 *   chevalet (jokers = 0) ; reste = lettres non utilisées du chevalet.
 */
function consommer(chars, stock, jokers) {
  const s = Int8Array.from(stock);
  let j = jokers, score = 0;
  for (const ch of chars) {
    const l = ch.charCodeAt(0) - 65;
    if (s[l] > 0) { s[l]--; score += pointsLettre(ch); }
    else if (j > 0) j--;
    else return null;
  }
  let reste = "";
  for (let l = 0; l < 26; l++) reste += String.fromCharCode(65 + l).repeat(s[l]);
  return { score, reste: reste + "?".repeat(j) };
}

export const scoreBrut = (mot) => [...mot].reduce((t, l) => t + pointsLettre(l), 0);

// Mot butoir : aucune lettre ne peut s'ajouter devant ou derrière pour former un autre mot.
export function estButoir(ensemble, mot) {
  for (let l = 65; l < 91; l++) {
    const c = String.fromCharCode(l);
    if (ensemble.has(c + mot) || ensemble.has(mot + c)) return false;
  }
  return true;
}

const nettoyer = (t, autorises) => normaliser(t || "").replace(autorises, "");

/**
 * Recherche de mots. `f.mode` :
 *  - "long"       : mots faisables avec `lettres` seules (jokers "?") ;
 *                   `exact` = anagrammes (toutes les lettres utilisées).
 *  - "raccrocher" : `lettres` + UNE lettre du plateau choisie parmi `accroche`.
 *  - "motif"      : prolonger / intégrer `motif` (espace, "_" ou "?" = lettre
 *                   inconnue prise dans le chevalet) avec les `lettres`.
 *  - "modele"     : forme complète du mot, ex. C_R_US ou CUR* ("*" = suite libre).
 * Filtres communs : position ("indifferent"|"debut"|"milieu"|"fin", de la lettre
 * ajoutée ou du motif), commence/finit/contient, min/max, tri
 * ("score"|"longueur"|"alpha"), limite.
 * @returns {{ total:number, liste:{mot, score, reste, plateau:number[], butoir?:boolean}[] }}
 *   `plateau` = indices des lettres du mot venant du plateau (à surligner).
 */
export function rechercher(mots, f, ensemble = null) {
  const mode = f.mode || "long";
  const lettres = nettoyer((f.lettres || "").replace(/[-*]/g, "?"), /[^A-Z?]/g);
  const accroche = [...new Set(nettoyer(f.accroche, /[^A-Z]/g))];
  const motifBrut = normaliser(f.motif || "").replace(/[^A-Z_? *-]/g, "");
  const commence = nettoyer(f.commence, /[^A-Z]/g);
  const finit = nettoyer(f.finit, /[^A-Z]/g);
  const contient = nettoyer(f.contient, /[^A-Z]/g);
  const min = f.min || 2, max = f.max || 15;
  const okPos = POSITIONS[f.position] || POSITIONS.indifferent;
  const { stock, jokers } = stockDe(lettres);

  let re = null;
  if (mode === "modele") {
    const m = motifBrut.replace(/[ -]/g, "_");
    if (!m) return { total: 0, liste: [] };
    re = new RegExp("^" + m.replace(/[_?]/g, "[A-Z]").replace(/\*/g, "[A-Z]*") + "$");
  }
  if (mode === "long" && !lettres) return { total: 0, liste: [] };
  if (mode === "raccrocher" && (!accroche.length)) return { total: 0, liste: [] };
  if (mode === "motif" && (!motifBrut.replace(/[ _?*-]/g, ""))) return { total: 0, liste: [] };
  const motif = motifBrut.replace(/[?*-]/g, "_").replace(/ /g, "_"); // "_" = inconnue

  const res = [];
  for (const m of mots) {
    const n = m.length;
    if (n < min || n > max) continue;
    if (commence && !m.startsWith(commence)) continue;
    if (finit && !m.endsWith(finit)) continue;
    if (contient && !m.includes(contient)) continue;
    let trouve = null;

    if (mode === "long") {
      if (f.exact && n !== lettres.length) continue;
      const r = consommer(m, stock, jokers);
      if (r) trouve = { score: r.score, reste: r.reste, plateau: [] };
    } else if (mode === "modele") {
      if (re.test(m)) trouve = { score: scoreBrut(m), reste: "", plateau: [] };
    } else if (mode === "raccrocher") {
      for (let i = 0; i < n; i++) {
        if (!accroche.includes(m[i]) || !okPos(i, n)) continue;
        const r = consommer(m.slice(0, i) + m.slice(i + 1), stock, jokers);
        if (!r) continue;
        const score = r.score;
        if (!trouve || score > trouve.score) trouve = { score, reste: r.reste, plateau: [i] };
      }
    } else if (mode === "motif") {
      const k = motif.length;
      for (let p = 0; p + k <= n; p++) {
        // position du MOTIF dans le mot : début / fin / milieu
        if (!okPos(p === 0 ? 0 : p + k === n ? n - 1 : 1, n)) continue;
        let ok = true;
        const plateau = [];
        const deLaRack = [];
        for (let i = 0; i < n; i++) {
          const dansMotif = i >= p && i < p + k;
          if (dansMotif && motif[i - p] !== "_") {
            if (motif[i - p] !== m[i]) { ok = false; break; }
            plateau.push(i);
          } else deLaRack.push(m[i]);
        }
        if (!ok || !deLaRack.length) continue;
        const r = consommer(deLaRack, stock, jokers);
        if (!r) continue;
        const score = r.score;
        if (!trouve || score > trouve.score) trouve = { score, reste: r.reste, plateau };
      }
    }
    if (trouve) res.push({ mot: m, ...trouve });
  }

  const tri = f.tri || "score";
  res.sort((a, b) =>
    tri === "alpha" ? a.mot.localeCompare(b.mot)
    : tri === "longueur" ? b.mot.length - a.mot.length || b.score - a.score || a.mot.localeCompare(b.mot)
    : b.score - a.score || b.mot.length - a.mot.length || a.mot.localeCompare(b.mot));
  const liste = res.slice(0, f.limite || 300);
  if (ensemble) for (const x of liste) x.butoir = estButoir(ensemble, x.mot);
  return { total: res.length, liste };
}

/**
 * Lettres pouvant s'accrocher : pour chaque lettre A–Z, mots qui utilisent TOUT
 * le chevalet + cette lettre (un mot de longueur chevalet+1).
 * @returns {Object<string, string[]>} lettre → mots (vide si aucun)
 */
export function lettresAccrochables(mots, lettres) {
  const l = nettoyer((lettres || "").replace(/[-*]/g, "?"), /[^A-Z?]/g);
  const { stock, jokers } = stockDe(l);
  const out = {};
  if (!l) return out;
  for (const m of mots) {
    if (m.length !== l.length + 1) continue;
    for (const x of new Set(m)) {
      const i = m.indexOf(x);
      const r = consommer(m.slice(0, i) + m.slice(i + 1), stock, jokers);
      if (r && r.reste === "") (out[x] ||= []).push(m);
    }
  }
  return out;
}

// ─── Sac de 102 tuiles, compteurs ───────────────────────────────────────────

export const REPARTITION = {
  A: 9, B: 2, C: 2, D: 3, E: 15, F: 2, G: 2, H: 2, I: 8, J: 1, K: 1, L: 5, M: 3,
  N: 6, O: 6, P: 2, Q: 1, R: 6, S: 6, T: 6, U: 6, V: 2, W: 1, X: 1, Y: 1, Z: 1, "?": 2,
};

/** `jouees` : lettres déjà sorties du sac ; espace, "?", "-" ou "*" = joker. */
export function lettresRestantes(jouees) {
  const vues = {};
  for (const ch of normaliser(jouees || "")) {
    const k = /[A-Z]/.test(ch) ? ch : /[ ?*-]/.test(ch) ? "?" : null;
    if (k) vues[k] = (vues[k] || 0) + 1;
  }
  const lignes = Object.entries(REPARTITION).map(([lettre, total]) => ({
    lettre, total, restant: total - (vues[lettre] || 0),
  }));
  return { lignes, restantTotal: lignes.reduce((t, x) => t + Math.max(0, x.restant), 0), excedent: lignes.filter((x) => x.restant < 0) };
}

/** Tire n tuiles au hasard dans le sac (moins celles déjà `jouees`). */
export function tirageAleatoire(n = 7, jouees = "") {
  const { lignes } = lettresRestantes(jouees);
  const sac = lignes.flatMap((x) => Array(Math.max(0, x.restant)).fill(x.lettre));
  const tirage = [];
  for (let i = 0; i < n && sac.length; i++) tirage.push(sac.splice(Math.floor(Math.random() * sac.length), 1)[0]);
  return tirage.sort().join("");
}

/**
 * Compteur de points d'un mot posé. `lettres` : [{ l, prime: ""|"LD"|"LT", joker }].
 * `multMot` : produit des primes mot (1, 2, 3, 4, 6, 9). Bonus 50 si `bingo`.
 */
export function pointsMotPose(lettres, multMot = 1, bingo = false) {
  const somme = lettres.reduce((t, x) => t + (x.joker ? 0 : pointsLettre(x.l)) * (x.prime === "LD" ? 2 : x.prime === "LT" ? 3 : 1), 0);
  return somme * multMot + (bingo ? 50 : 0);
}

// ─── Définitions (Wiktionnaire français) ────────────────────────────────────
// NON TESTÉ depuis l'environnement de développement (hôte bloqué) : appel
// direct du navigateur à l'API REST publique de fr.wiktionary.org (CORS
// ouvert). En cas d'échec, l'interface propose un simple lien vers la page.

let accentsEnCache = null;
async function chargerAccents() {
  if (accentsEnCache) return accentsEnCache;
  const map = new Map();
  try {
    const rep = await fetch("/scrabble/accents.txt");
    if (rep.ok) for (const forme of (await rep.text()).split("\n")) map.set(normaliser(forme), forme);
  } catch { /* sans accents : on tentera la forme brute */ }
  accentsEnCache = map;
  return map;
}

const defsEnCache = new Map();
const enTexte = (html) => new DOMParser().parseFromString(html, "text/html").body.textContent.replace(/\s+/g, " ").trim();

export async function formeAffichee(mot) {
  return (await chargerAccents()).get(mot) || mot.toLowerCase();
}

/** @returns {{ titre, url, entrees:[{nature, definitions:string[]}] }} ; entrees vide si rien trouvé */
export async function definir(mot) {
  if (defsEnCache.has(mot)) return defsEnCache.get(mot);
  const titre = await formeAffichee(mot);
  const url = "https://fr.wiktionary.org/wiki/" + encodeURIComponent(titre);
  let resultat = { titre, url, entrees: [] };
  const rep = await fetch("https://fr.wiktionary.org/api/rest_v1/page/definition/" + encodeURIComponent(titre));
  if (rep.ok) {
    const data = await rep.json();
    resultat.entrees = (data.fr || []).map((e) => ({
      nature: e.partOfSpeech || "",
      definitions: (e.definitions || []).map((d) => enTexte(d.definition || "")).filter(Boolean).slice(0, 5),
    })).filter((e) => e.definitions.length);
  } else if (rep.status !== 404) {
    throw new Error("Wiktionnaire indisponible (HTTP " + rep.status + ").");
  }
  defsEnCache.set(mot, resultat);
  return resultat;
}
