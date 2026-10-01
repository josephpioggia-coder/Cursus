/**
 * CURSUS — Jeux de mots : moteurs (30/09/2026)
 * ======================================================================
 * Demande de Joseph : étoffer le catalogue de jeux avant d'ouvrir le jeu à
 * plusieurs (Motus, Boggle, mot le plus long, pendu + jeux inventés :
 * échelle de mots, mots mêlés). Module PUR (hors chargerMotsCourants qui
 * fait un fetch) : toute la logique des jeux est ici, testable sous Node.
 *
 * Deux listes : `mots-fr.txt` (dictionnaire Dicollecte, 411 000 formes) sert à
 * ACCEPTER une réponse ; `mots-courants.txt` (25 000 mots courants classés par
 * fréquence) sert à CHOISIR les mots à faire deviner. Tous les générateurs
 * acceptent un `rng` (défaut Math.random) pour des tests reproductibles.
 */

import { fils } from "./scrabbleSolveur.js";
import { chargerListe } from "./scrabbleMots.js";

export const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae").toUpperCase();

let courantsEnCache = null;
/** @returns {{ mots:string[] (avec accents, par fréquence), normalises:string[] (MAJUSCULES sans accents) }} */
export async function chargerMotsCourants() {
  if (courantsEnCache) return courantsEnCache;
  const rep = await fetch("/jeux/mots-courants.txt");
  if (!rep.ok) throw new Error("Liste des mots courants introuvable (HTTP " + rep.status + ").");
  const mots = (await rep.text()).split(/\r?\n/).filter(Boolean);
  courantsEnCache = { mots, normalises: mots.map(norm) };
  return courantsEnCache;
}
export { chargerListe };

const tirer = (t, rng = Math.random) => t[Math.floor(rng() * t.length)];
export const melangerTab = (t, rng = Math.random) => { const a = [...t]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ─── Motus ──────────────────────────────────────────────────────────────────

/**
 * Compare un essai au mot secret (lettres MAJUSCULES sans accents, même longueur).
 * @returns {("juste"|"present"|"absent")[]} juste = bonne place, present = dans le mot ailleurs.
 * Gère les lettres doubles comme au Wordle : une lettre n'est signalée « présente » que
 * dans la limite du nombre d'exemplaires restants dans le secret.
 */
export function evaluerEssai(secret, essai) {
  const res = Array(essai.length).fill("absent");
  const reste = {};
  for (let i = 0; i < secret.length; i++) {
    if (essai[i] === secret[i]) res[i] = "juste";
    else reste[secret[i]] = (reste[secret[i]] || 0) + 1;
  }
  for (let i = 0; i < essai.length; i++) {
    if (res[i] === "juste") continue;
    if (reste[essai[i]] > 0) { res[i] = "present"; reste[essai[i]]--; }
  }
  return res;
}

/** Mot à deviner : courant (rang ≤ `rangMax`) et de la longueur demandée. Renvoie { affiche, secret }. */
export function motPourMotus(courants, longueur, rng = Math.random, rangMax = 9000) {
  const candidats = [];
  for (let i = 0; i < Math.min(rangMax, courants.mots.length); i++) if (courants.normalises[i].length === longueur) candidats.push(i);
  const i = tirer(candidats, rng);
  return { affiche: courants.mots[i], secret: courants.normalises[i] };
}

// ─── Pendu ──────────────────────────────────────────────────────────────────

export const ERREURS_PENDU = 7;

/** Lettres à afficher : la lettre (accentuée) si sa lettre de base a été trouvée, sinon null. */
export const reveler = (affiche, trouvees) => [...affiche].map((c) => (trouvees.has(norm(c)) ? c : null));
export const gagnePendu = (affiche, trouvees) => reveler(affiche, trouvees).every((c) => c !== null);

export function motPourPendu(courants, rng = Math.random, longMin = 6, longMax = 11, rangMax = 8000) {
  const candidats = [];
  for (let i = 0; i < Math.min(rangMax, courants.mots.length); i++) { const w = courants.mots[i], n = w.length; if (n >= longMin && n <= longMax && !/[œæ]/.test(w)) candidats.push(i); }
  return courants.mots[tirer(candidats, rng)];
}

// ─── Boggle 4×4 ─────────────────────────────────────────────────────────────

// Fréquences des lettres en français, ajustées pour des grilles jouables (peu de K/W/X/Y/Z/J/Q).
const POIDS_LETTRES = { A: 9, B: 2, C: 3, D: 4, E: 15, F: 2, G: 2, H: 2, I: 8, J: 1, L: 5, M: 3, N: 6, O: 6, P: 3, R: 6, S: 7, T: 6, U: 6, V: 2, X: 1, Y: 1, Z: 1 };
const SAC_LETTRES = Object.entries(POIDS_LETTRES).flatMap(([l, n]) => Array(n).fill(l));

export const TAILLE_BOGGLE = 4;
export const voisinsBoggle = (i, n = TAILLE_BOGGLE) => {
  const r = Math.floor(i / n), c = i % n, v = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && cc >= 0 && rr < n && cc < n) v.push(rr * n + cc);
  }
  return v;
};

/** Tous les mots (≥ `min` lettres) de la grille (tableau de 16 lettres). @returns {Map<string, number[]>} mot → un chemin */
export function trouverMotsBoggle(trie, grille, min = 3) {
  const trouves = new Map();
  const chemin = [];
  const vu = new Array(grille.length).fill(false);
  const explorer = (i, noeud, mot) => {
    const f = fils(trie, noeud, grille[i].charCodeAt(0) - 65);
    if (f === -1) return;
    vu[i] = true; chemin.push(i);
    const m = mot + grille[i];
    if (m.length >= min && trie.fin[f] && !trouves.has(m)) trouves.set(m, [...chemin]);
    for (const j of voisinsBoggle(i)) if (!vu[j]) explorer(j, f, m);
    vu[i] = false; chemin.pop();
  };
  for (let i = 0; i < grille.length; i++) explorer(i, 0, "");
  return trouves;
}

export const scoreBoggle = (mot) => (mot.length <= 4 ? 1 : mot.length === 5 ? 2 : mot.length === 6 ? 3 : mot.length === 7 ? 5 : 11);

/** Grille jouable : on retire les tirages pauvres (moins de 40 mots ou trop peu de voyelles). */
export function nouvelleGrilleBoggle(trie, rng = Math.random) {
  for (let essai = 0; essai < 200; essai++) {
    const g = Array.from({ length: 16 }, () => tirer(SAC_LETTRES, rng));
    const voyelles = g.filter((l) => "AEIOUY".includes(l)).length;
    if (voyelles < 5 || voyelles > 9) continue;
    const mots = trouverMotsBoggle(trie, g);
    if (mots.size >= 40) return { grille: g, mots };
  }
  const g = Array.from({ length: 16 }, () => tirer(SAC_LETTRES, rng));
  return { grille: g, mots: trouverMotsBoggle(trie, g) };
}

/** Un chemin (indices de cases) forme-t-il bien `mot` ? cases adjacentes, sans réutilisation. */
export function cheminValide(grille, chemin) {
  if (new Set(chemin).size !== chemin.length) return false;
  for (let k = 1; k < chemin.length; k++) if (!voisinsBoggle(chemin[k - 1]).includes(chemin[k])) return false;
  return true;
}

// ─── Le mot le plus long ────────────────────────────────────────────────────

const VOYELLES = "AEIOU", CONSONNES = "BCDFGHJLMNPRSTV";
/**
 * Tirage de `taille` lettres (défaut 10) contenant AU MOINS un mot courant de 7 à 9 lettres
 * (on prend un mot courant, on mélange ses lettres, on complète au hasard), en équilibrant
 * voyelles/consonnes. @returns {{ lettres:string[], garanti:string }}
 */
export function tirageMotLePlusLong(courants, taille = 10, rng = Math.random) {
  const candidats = [];
  for (let i = 0; i < Math.min(12000, courants.mots.length); i++) { const n = courants.normalises[i].length; if (n >= 7 && n <= Math.min(9, taille)) candidats.push(i); }
  const i = tirer(candidats, rng);
  const lettres = [...courants.normalises[i]];
  while (lettres.length < taille) {
    const v = lettres.filter((l) => VOYELLES.includes(l)).length;
    lettres.push(tirer([...(v < taille * 0.35 ? VOYELLES : CONSONNES)], rng));
  }
  return { lettres: melangerTab(lettres, rng), garanti: courants.mots[i] };
}

/** `mot` (MAJUSCULES) se forme-t-il avec ces lettres (chaque lettre utilisée au plus une fois) ? */
export function motFormable(mot, lettres) {
  const s = {};
  for (const l of lettres) s[l] = (s[l] || 0) + 1;
  for (const c of mot) { if (!s[c]) return false; s[c]--; }
  return true;
}

// ─── Échelle de mots ────────────────────────────────────────────────────────

/** Index « motif → mots » d'une longueur donnée, pour trouver les voisins d'un mot (une lettre changée). */
export function indexVoisins(ensemble, longueur) {
  const index = new Map();
  for (const m of ensemble) {
    if (m.length !== longueur) continue;
    for (let i = 0; i < longueur; i++) {
      const k = m.slice(0, i) + "_" + m.slice(i + 1);
      const l = index.get(k);
      if (l) l.push(m); else index.set(k, [m]);
    }
  }
  return index;
}
export function voisinsMot(index, mot) {
  const res = new Set();
  for (let i = 0; i < mot.length; i++) for (const m of index.get(mot.slice(0, i) + "_" + mot.slice(i + 1)) || []) if (m !== mot) res.add(m);
  return [...res];
}
export const unSeulChangement = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++d > 1) return false; return d === 1; };

/** Plus court chemin de `depart` à `arrivee` (inclus) ou null. */
export function plusCourtChemin(index, depart, arrivee, profondeurMax = 12) {
  if (depart === arrivee) return [depart];
  const parent = new Map([[depart, null]]);
  let front = [depart];
  for (let d = 0; d < profondeurMax && front.length; d++) {
    const suivant = [];
    for (const m of front) for (const v of voisinsMot(index, m)) {
      if (parent.has(v)) continue;
      parent.set(v, m);
      if (v === arrivee) { const ch = [v]; let x = m; while (x) { ch.push(x); x = parent.get(x); } return ch.reverse(); }
      suivant.push(v);
    }
    front = suivant;
  }
  return null;
}

/**
 * Problème d'échelle : deux mots courants de même longueur (4 ou 5), reliés par un
 * plus court chemin de 3 à 6 étapes dans le dictionnaire complet.
 * @returns {{ depart, arrivee, optimal:string[] (MAJUSCULES, extrémités incluses), affiche:{depart, arrivee} }}
 */
export function problemeEchelle(courants, ensemble, longueur = 4, rng = Math.random, index = indexVoisins(ensemble, longueur)) {
  const idx = [];
  for (let i = 0; i < Math.min(6000, courants.mots.length); i++) if (courants.normalises[i].length === longueur) idx.push(i);
  for (let essai = 0; essai < 400; essai++) {
    const a = tirer(idx, rng), b = tirer(idx, rng);
    if (a === b) continue;
    const ch = plusCourtChemin(index, courants.normalises[a], courants.normalises[b]);
    if (ch && ch.length >= 4 && ch.length <= 7) {
      return { depart: courants.normalises[a], arrivee: courants.normalises[b], optimal: ch, affiche: { depart: courants.mots[a], arrivee: courants.mots[b] }, index };
    }
  }
  return null;
}

// ─── Mots mêlés ─────────────────────────────────────────────────────────────

export const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];

/**
 * Grille de mots mêlés `taille`×`taille` avec `nb` mots courants (4 à 8 lettres).
 * `diagonales`/`inverses` : difficulté. Les mots peuvent se croiser sur une lettre commune.
 * @returns {{ grille:string[][], mots:{mot, affiche, r, c, dr, dc}[] }}
 */
export function genererMotsMeles(courants, { taille = 10, nb = 8, diagonales = true, inverses = false } = {}, rng = Math.random) {
  const dirs = DIRECTIONS.filter(([dr, dc]) => (diagonales || !dr || !dc) && (inverses || dr > 0 || (dr === 0 && dc > 0) || (diagonales && dr < 0 && dc > 0)));
  const grille = Array.from({ length: taille }, () => Array(taille).fill(""));
  const places = [];
  const pool = [];
  for (let i = 0; i < Math.min(7000, courants.mots.length); i++) { const n = courants.normalises[i].length; if (n >= 4 && n <= Math.min(8, taille)) pool.push(i); }
  let essais = 0;
  while (places.length < nb && essais++ < 3000) {
    const i = tirer(pool, rng), mot = courants.normalises[i];
    if (places.some((p) => p.mot === mot)) continue;
    const [dr, dc] = tirer(dirs, rng);
    const r = Math.floor(rng() * taille), c = Math.floor(rng() * taille);
    const r2 = r + dr * (mot.length - 1), c2 = c + dc * (mot.length - 1);
    if (r2 < 0 || c2 < 0 || r2 >= taille || c2 >= taille) continue;
    let ok = true;
    for (let k = 0; k < mot.length && ok; k++) { const x = grille[r + dr * k][c + dc * k]; if (x && x !== mot[k]) ok = false; }
    if (!ok) continue;
    for (let k = 0; k < mot.length; k++) grille[r + dr * k][c + dc * k] = mot[k];
    places.push({ mot, affiche: courants.mots[i], r, c, dr, dc });
  }
  for (let r = 0; r < taille; r++) for (let c = 0; c < taille; c++) if (!grille[r][c]) grille[r][c] = tirer(SAC_LETTRES, rng);
  return { grille, mots: places };
}

/** Mot lu sur la ligne droite de (r1,c1) à (r2,c2) — null si ce n'est pas une ligne droite (horizontale, verticale, diagonale). */
export function motSurSegment(grille, r1, c1, r2, c2) {
  const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1);
  const n = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1)) + 1;
  if (Math.abs(r2 - r1) !== 0 && Math.abs(c2 - c1) !== 0 && Math.abs(r2 - r1) !== Math.abs(c2 - c1)) return null;
  let m = "";
  for (let k = 0; k < n; k++) m += grille[r1 + dr * k][c1 + dc * k];
  return m;
}
