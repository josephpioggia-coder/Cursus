/**
 * CURSUS — Grilles de mots : mots croisés, mots fléchés, mots codés (04/10/2026)
 * ======================================================================
 * Demande de Joseph : « autres jeux de mots comme mots croisés ou mots fléchés… ». Module PUR (hors
 * chargerMotsCroises qui fait un fetch), testable sous Node.
 *
 * Indices : public/jeux/mots-croises.txt (« MOT|indice », ~700 mots courants) — textes ÉCRITS pour
 * Cursus (aucune source externe : Wiktionnaire/CNRTL sont inaccessibles depuis l'environnement de
 * dev et leurs licences ne s'y prêtent pas). Contrôle : scripts/verifier-mots-croises.mjs.
 *
 * Les grilles sont « libres » (comme dans beaucoup d'applis) : on dépose des mots un à un en les faisant
 * se croiser, avec la règle classique « deux mots parallèles ne se touchent pas » — donc chaque suite de
 * lettres de la grille, dans un sens ou dans l'autre, est exactement un mot de la liste. Les grilles
 * pleines des vrais mots fléchés exigeraient un lexique beaucoup plus vaste que 700 mots indicés.
 */

import { norm } from "./jeuxDeMots.js";

let croisesEnCache = null;
/** @returns {{ mot:string, indice:string, dur?:boolean }[]} — `dur` : entrée réservée au niveau difficile */
export async function chargerMotsCroises() {
  if (croisesEnCache) return croisesEnCache;
  const [a, b] = await Promise.all(["/jeux/mots-croises.txt", "/jeux/mots-croises-difficiles.txt"].map(async (u) => {
    const rep = await fetch(u);
    if (!rep.ok) throw new Error("Liste des indices introuvable (HTTP " + rep.status + ").");
    return parserMotsCroises(await rep.text());
  }));
  croisesEnCache = a.concat(b.map((e) => ({ ...e, dur: true })));
  return croisesEnCache;
}
/**
 * Entrées utilisées selon le niveau : facile et moyen = mots courants ; difficile = mots rares et définitions
 * plus savantes (répétés pour qu'ils dominent) + 40 % des mots courants pour garder des croisements possibles.
 */
export function entreesDuNiveau(entrees, niveau, rng = Math.random) {
  const courantes = entrees.filter((e) => !e.dur);
  if (niveau !== "difficile") return courantes;
  const dures = entrees.filter((e) => e.dur);
  return dures.concat(dures, dures, dures, courantes.filter(() => rng() < 0.4));
}
export function parserMotsCroises(texte) {
  return texte.split(/\r?\n/).filter(Boolean).map((l) => { const i = l.indexOf("|"); return { mot: l.slice(0, i), indice: l.slice(i + 1) }; });
}

const tirer = (t, rng) => t[Math.floor(rng() * t.length)];
const melanger = (t, rng) => { const a = [...t]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ─── Générateur libre (mots croisés, mots codés) ───────────────────────────

/**
 * Une tentative : place un premier mot au centre puis y accroche d'autres mots jusqu'à `cible` mots.
 * @returns {{ grille:string[][], mots:{mot,indice,r,c,dir}[] }}
 */
function tentativeCroisee(entrees, taille, cible, rng) {
  const g = Array.from({ length: taille }, () => Array(taille).fill(""));
  const sens = Array.from({ length: taille }, () => Array(taille).fill(0)); // bit 1 = H, bit 2 = V
  const places = [];
  const vide = (r, c) => r < 0 || c < 0 || r >= taille || c >= taille || g[r][c] === "";
  const verifier = (mot, r, c, dir) => {
    const dr = dir === "V" ? 1 : 0, dc = dir === "H" ? 1 : 0, bit = dir === "H" ? 1 : 2;
    const fin = [r + dr * mot.length, c + dc * mot.length];
    if (r + dr * (mot.length - 1) >= taille || c + dc * (mot.length - 1) >= taille || r < 0 || c < 0) return -1;
    if (!vide(r - dr, c - dc) || !vide(fin[0], fin[1])) return -1;
    let croisements = 0;
    for (let i = 0; i < mot.length; i++) {
      const rr = r + dr * i, cc = c + dc * i;
      if (g[rr][cc] !== "") {
        if (g[rr][cc] !== mot[i] || (sens[rr][cc] & bit)) return -1; // lettre différente, ou mot parallèle superposé
        croisements++;
      } else if (!vide(rr + dc, cc + dr) || !vide(rr - dc, cc - dr)) return -1; // voisin latéral occupé : mots collés
    }
    return croisements;
  };
  const poser = (e, r, c, dir) => {
    const dr = dir === "V" ? 1 : 0, dc = dir === "H" ? 1 : 0, bit = dir === "H" ? 1 : 2;
    for (let i = 0; i < e.mot.length; i++) { g[r + dr * i][c + dc * i] = e.mot[i]; sens[r + dr * i][c + dc * i] |= bit; }
    places.push({ mot: e.mot, indice: e.indice, r, c, dir });
  };
  const premiers = entrees.filter((e) => e.mot.length >= 5 && e.mot.length <= taille - 1);
  const p = tirer(premiers, rng);
  poser(p, Math.floor(taille / 2), Math.floor((taille - p.mot.length) / 2), "H");
  const utilises = new Set([p.mot]);
  let echecs = 0;
  while (places.length < cible && echecs < 120) {
    const e = tirer(entrees, rng);
    if (utilises.has(e.mot) || e.mot.length > taille) { echecs++; continue; }
    let meilleur = [], max = 0;
    for (const dir of ["H", "V"]) {
      for (let r = 0; r < taille; r++) for (let c = 0; c < taille; c++) {
        const k = verifier(e.mot, r, c, dir);
        if (k >= 1 && k > max) { max = k; meilleur = [[r, c, dir]]; } else if (k >= 1 && k === max) meilleur.push([r, c, dir]);
      }
    }
    if (!meilleur.length) { echecs++; continue; }
    const [r, c, dir] = tirer(meilleur, rng);
    poser(e, r, c, dir); utilises.add(e.mot);
  }
  return { grille: g, mots: places };
}

/** Rogne la grille à son rectangle utile ; recale les mots. */
function rogner(grille, mots) {
  let r0 = 99, r1 = -1, c0 = 99, c1 = -1;
  grille.forEach((l, r) => l.forEach((x, c) => { if (x) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); } }));
  return {
    grille: grille.slice(r0, r1 + 1).map((l) => l.slice(c0, c1 + 1)),
    mots: mots.map((m) => ({ ...m, r: m.r - r0, c: m.c - c0 })),
  };
}

/** Numérote les débuts de mots (ordre de lecture) et sépare horizontalement / verticalement. */
export function numeroter(mots) {
  const debuts = new Map();
  for (const m of [...mots].sort((a, b) => a.r - b.r || a.c - b.c)) {
    const cle = `${m.r},${m.c}`;
    if (!debuts.has(cle)) debuts.set(cle, debuts.size + 1);
    m.num = debuts.get(cle);
  }
  const trier = (d) => mots.filter((m) => m.dir === d).sort((a, b) => a.num - b.num);
  return { horizontaux: trier("H"), verticaux: trier("V") };
}

export const cellulesDuMot = (m) => Array.from({ length: m.mot.length }, (_, i) => [m.r + (m.dir === "V" ? i : 0), m.c + (m.dir === "H" ? i : 0)]);

export const NIVEAUX_CROISES = {
  facile: { taille: 9, mots: 9 },
  moyen: { taille: 11, mots: 13 },
  difficile: { taille: 13, mots: 18 },
};

/**
 * Grille de mots croisés. Plusieurs tentatives, on garde la meilleure (plus de mots puis plus de croisements).
 * @returns {{ grille:string[][], mots:{mot,indice,r,c,dir,num}[], horizontaux, verticaux, lignes, colonnes }}
 */
export function genererCroises(entrees, niveau = "moyen", rng = Math.random) {
  const { taille, mots: cible } = NIVEAUX_CROISES[niveau] || NIVEAUX_CROISES.moyen;
  const pool = entrees.filter((e) => e.mot.length >= 3 && e.mot.length <= taille);
  let meilleur = null, score = -1;
  for (let essai = 0; essai < 40; essai++) {
    const t = tentativeCroisee(pool, taille, cible, rng);
    const lettres = t.grille.flat().filter(Boolean).length;
    const s = t.mots.length * 100 - lettres; // beaucoup de mots, peu de lettres = beaucoup de croisements
    if (s > score) { score = s; meilleur = t; }
    if (t.mots.length >= cible && essai >= 8) break;
  }
  const { grille, mots } = rogner(meilleur.grille, meilleur.mots);
  const { horizontaux, verticaux } = numeroter(mots);
  return { grille, mots, horizontaux, verticaux, lignes: grille.length, colonnes: grille[0].length };
}

// ─── Mots codés ─────────────────────────────────────────────────────────────

/**
 * Mots codés : grille libre construite avec des mots COURANTS (sans indices), chaque lettre remplacée par un
 * numéro 1–26 (même lettre = même numéro). `revelees` lettres sont données au départ.
 * @param courants { normalises: string[] } (voir chargerMotsCourants) — mots de 3 à 8 lettres, rang ≤ 6000
 * @returns {{ grille, mots, codes:{[lettre]:number}, revelees:string[], lignes, colonnes }}
 */
export function genererCodes(courants, rng = Math.random, taille = 11, cible = 14, nbRevelees = 3) {
  const vus = new Set(), pool = [];
  for (let i = 0; i < Math.min(6000, courants.normalises.length); i++) {
    const m = courants.normalises[i];
    if (m.length >= 3 && m.length <= 8 && !vus.has(m) && !/[^A-Z]/.test(m)) { vus.add(m); pool.push({ mot: m, indice: "" }); }
  }
  let meilleur = null, score = -1;
  for (let essai = 0; essai < 30; essai++) {
    const t = tentativeCroisee(pool, taille, cible, rng);
    const s = t.mots.length * 100 - t.grille.flat().filter(Boolean).length;
    if (s > score) { score = s; meilleur = t; }
  }
  const { grille, mots } = rogner(meilleur.grille, meilleur.mots);
  const lettres = [...new Set(grille.flat().filter(Boolean))];
  const numeros = melanger(Array.from({ length: 26 }, (_, i) => i + 1), rng);
  const codes = {};
  lettres.forEach((l, i) => { codes[l] = numeros[i]; });
  // lettres données : de préférence des voyelles fréquentes, pour amorcer
  const frequence = {}; grille.flat().filter(Boolean).forEach((l) => { frequence[l] = (frequence[l] || 0) + 1; });
  const revelees = lettres.sort((a, b) => frequence[b] - frequence[a]).slice(0, nbRevelees);
  return { grille, mots, codes, revelees, lignes: grille.length, colonnes: grille[0].length };
}

// ─── Mots fléchés ───────────────────────────────────────────────────────────

/**
 * Mots fléchés (grille libre) : chaque mot est précédé de sa CASE D'INDICE — à gauche s'il est horizontal
 * (flèche →), au-dessus s'il est vertical (flèche ↓). Une case d'indice peut porter deux indices (un mot vers la
 * droite, un mot vers le bas). Cellules : { t: "L", l } lettre · { t: "C", h?:{mot,indice}, v?:{mot,indice} } case d'indice
 * · null = case noire vide.
 */
function tentativeFlechee(entrees, lignes, colonnes, cible, rng) {
  const g = Array.from({ length: lignes }, () => Array(colonnes).fill(null));
  const sens = Array.from({ length: lignes }, () => Array(colonnes).fill(0));
  const places = [];
  const dedans = (r, c) => r >= 0 && c >= 0 && r < lignes && c < colonnes;
  const libreOuIndice = (r, c) => !dedans(r, c) || g[r][c] === null || g[r][c].t === "C";
  const pasLettre = (r, c) => !dedans(r, c) || g[r][c] === null || g[r][c].t !== "L";
  const verifier = (mot, r, c, dir) => {
    const dr = dir === "V" ? 1 : 0, dc = dir === "H" ? 1 : 0, bit = dir === "H" ? 1 : 2;
    const ir = r - dr, ic = c - dc; // case d'indice
    if (!dedans(ir, ic) || !dedans(r + dr * (mot.length - 1), c + dc * (mot.length - 1))) return -1;
    const ci = g[ir][ic];
    if (ci !== null && (ci.t === "L" || (dir === "H" ? ci.h : ci.v))) return -1; // case d'indice déjà une lettre / déjà un indice dans ce sens
    if (!pasLettre(r + dr * mot.length, c + dc * mot.length)) return -1; // fin : pas de lettre collée
    let croisements = 0;
    for (let i = 0; i < mot.length; i++) {
      const rr = r + dr * i, cc = c + dc * i, cell = g[rr][cc];
      if (cell !== null && cell.t === "C") return -1;
      if (cell !== null) {
        if (cell.l !== mot[i] || (sens[rr][cc] & bit)) return -1;
        croisements++;
      } else if (!pasLettre(rr + dc, cc + dr) || !pasLettre(rr - dc, cc - dr)) return -1;
    }
    return croisements;
  };
  const poser = (e, r, c, dir) => {
    const dr = dir === "V" ? 1 : 0, dc = dir === "H" ? 1 : 0, bit = dir === "H" ? 1 : 2;
    const ir = r - dr, ic = c - dc;
    if (g[ir][ic] === null) g[ir][ic] = { t: "C" };
    g[ir][ic][dir === "H" ? "h" : "v"] = { mot: e.mot, indice: e.indice };
    for (let i = 0; i < e.mot.length; i++) {
      const rr = r + dr * i, cc = c + dc * i;
      if (g[rr][cc] === null) g[rr][cc] = { t: "L", l: e.mot[i] };
      sens[rr][cc] |= bit;
    }
    places.push({ mot: e.mot, indice: e.indice, r, c, dir });
  };
  const premiers = entrees.filter((e) => e.mot.length >= 4 && e.mot.length <= colonnes - 2);
  const p = tirer(premiers, rng);
  poser(p, Math.floor(lignes / 2), Math.max(1, Math.floor((colonnes - p.mot.length) / 2)), "H");
  const utilises = new Set([p.mot]);
  let echecs = 0;
  while (places.length < cible && echecs < 200) {
    const e = tirer(entrees, rng);
    if (utilises.has(e.mot) || e.mot.length > Math.max(lignes, colonnes) - 1) { echecs++; continue; }
    let meilleur = [], max = 0;
    for (const dir of ["H", "V"]) for (let r = 0; r < lignes; r++) for (let c = 0; c < colonnes; c++) {
      const k = verifier(e.mot, r, c, dir);
      if (k >= 1 && k > max) { max = k; meilleur = [[r, c, dir]]; } else if (k >= 1 && k === max) meilleur.push([r, c, dir]);
    }
    if (!meilleur.length) { echecs++; continue; }
    const [r, c, dir] = tirer(meilleur, rng);
    poser(e, r, c, dir); utilises.add(e.mot);
  }
  return { grille: g, mots: places };
}

export const NIVEAUX_FLECHES = {
  facile: { lignes: 9, colonnes: 7, mots: 10 },
  moyen: { lignes: 11, colonnes: 8, mots: 14 },
  difficile: { lignes: 13, colonnes: 9, mots: 18 },
};

/** @returns {{ grille:(object|null)[][], mots:{mot,indice,r,c,dir}[], lignes, colonnes }} */
export function genererFleches(entrees, niveau = "moyen", rng = Math.random) {
  const { lignes, colonnes, mots: cible } = NIVEAUX_FLECHES[niveau] || NIVEAUX_FLECHES.moyen;
  const pool = entrees.filter((e) => e.mot.length >= 3 && e.mot.length <= Math.max(lignes, colonnes) - 1);
  let meilleur = null, score = -1;
  for (let essai = 0; essai < 60; essai++) {
    const t = tentativeFlechee(pool, lignes, colonnes, cible, rng);
    const lettres = t.grille.flat().filter((x) => x && x.t === "L").length;
    const s = t.mots.length * 100 + lettres;
    if (s > score) { score = s; meilleur = t; }
    if (t.mots.length >= cible && essai >= 15) break;
  }
  // Rogne les lignes / colonnes entièrement vides (et garde les cases d'indice)
  const g = meilleur.grille;
  const occupe = (x) => x !== null;
  let r0 = lignes, r1 = -1, c0 = colonnes, c1 = -1;
  g.forEach((l, r) => l.forEach((x, c) => { if (occupe(x)) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); } }));
  const grille = g.slice(r0, r1 + 1).map((l) => l.slice(c0, c1 + 1));
  const mots = meilleur.mots.map((m) => ({ ...m, r: m.r - r0, c: m.c - c0 }));
  return { grille, mots, lignes: grille.length, colonnes: grille[0].length };
}

export { norm };
