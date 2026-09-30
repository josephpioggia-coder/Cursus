/**
 * CURSUS — Jeu de mots : moteur de partie (30/09/2026)
 * ======================================================================
 * Demande de Joseph : "créer un jeu de mots" — jouer contre l'ordinateur,
 * avec le plateau, le dictionnaire et le solveur déjà construits. Nom
 * volontairement neutre (« Scrabble » est une marque).
 *
 * Module PUR (hors chargerMoteur qui fait un fetch) : sac de 102 tuiles,
 * validation d'un coup posé à la main, score, choix de l'ordinateur,
 * fin de partie. Le score d'un coup validé ici doit toujours égaler celui
 * du solveur (scrabbleSolveur.js) — vérifié par simulation de parties.
 *
 * Règles retenues (Scrabble classique) : premier mot par la case centrale,
 * bonus de 50 pour 7 tuiles, primes comptées seulement pour les tuiles
 * nouvelles, joker = 0 point (les primes MOT s'appliquent quand même),
 * partie finie quand le sac est vide et qu'un chevalet est vide, ou après
 * 6 passes consécutives ; en fin de partie chaque joueur perd la valeur
 * de ses tuiles restantes, et celui qui a fini les gagne.
 */

import { TAILLE, CENTRE, PRIMES, pointsLettre, construireDico, genererCoups } from "./scrabbleSolveur.js";
import { REPARTITION, chargerListe } from "./scrabbleMots.js";

let moteurEnCache = null;
/** @returns {{ trie, ensemble:Set<string> }} */
export async function chargerMoteur() {
  if (moteurEnCache) return moteurEnCache;
  const { texte, ensemble } = await chargerListe();
  moteurEnCache = { trie: construireDico(texte), ensemble };
  return moteurEnCache;
}

// ─── Sac et pioche ──────────────────────────────────────────────────────────

export function nouveauSac() {
  const sac = Object.entries(REPARTITION).flatMap(([l, n]) => Array(n).fill(l));
  for (let i = sac.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sac[i], sac[j]] = [sac[j], sac[i]];
  }
  return sac;
}

/** Complète `chevalet` (tableau de lettres) jusqu'à 7 en piochant dans `sac` (modifié). */
export function completer(chevalet, sac) {
  const r = [...chevalet];
  while (r.length < 7 && sac.length) r.push(sac.pop());
  return r;
}

export const valeurChevalet = (chevalet) => chevalet.reduce((t, l) => t + (l === "?" ? 0 : pointsLettre(l)), 0);

// ─── Validation d'un coup posé à la main ────────────────────────────────────

/**
 * @param estMot (mot MAJUSCULES) => boolean
 * @param plateau 15×15 (état AVANT le coup)
 * @param poses [{r, c, l, joker}] tuiles ajoutées (cases vides du plateau)
 * @returns {{ ok:boolean, erreur?:string, score?:number, mots?:{mot:string, score:number}[], invalides?:string[] }}
 */
export function evaluerCoup(estMot, plateau, poses) {
  if (!poses.length) return { ok: false, erreur: "Aucune tuile posée." };
  const memeLigne = poses.every((t) => t.r === poses[0].r);
  const memeColonne = poses.every((t) => t.c === poses[0].c);
  if (!memeLigne && !memeColonne) return { ok: false, erreur: "Les tuiles doivent être posées sur une même ligne ou une même colonne." };

  const b = plateau.map((l) => [...l]);
  const nouvelle = new Set();
  for (const t of poses) {
    if (b[t.r][t.c] !== "") return { ok: false, erreur: "Une case est déjà occupée." };
    b[t.r][t.c] = t.joker ? t.l.toLowerCase() : t.l;
    nouvelle.add(t.r * TAILLE + t.c);
  }

  // Pas de trou entre les tuiles posées.
  if (poses.length > 1) {
    if (memeLigne) {
      const cs = poses.map((t) => t.c);
      for (let c = Math.min(...cs); c <= Math.max(...cs); c++) if (b[poses[0].r][c] === "") return { ok: false, erreur: "Les tuiles doivent former un mot d'un seul tenant (pas de trou)." };
    } else {
      const rs = poses.map((t) => t.r);
      for (let r = Math.min(...rs); r <= Math.max(...rs); r++) if (b[r][poses[0].c] === "") return { ok: false, erreur: "Les tuiles doivent former un mot d'un seul tenant (pas de trou)." };
    }
  }

  // Connexion : case centrale au premier coup, sinon contact avec une tuile déjà posée.
  const vide = plateau.every((l) => l.every((x) => x === ""));
  if (vide) {
    if (!poses.some((t) => t.r === CENTRE && t.c === CENTRE)) return { ok: false, erreur: "Le premier mot doit passer par la case centrale ★." };
  } else {
    const touche = poses.some((t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => {
      const r = t.r + dr, c = t.c + dc;
      return r >= 0 && c >= 0 && r < TAILLE && c < TAILLE && plateau[r][c] !== "";
    }));
    if (!touche) return { ok: false, erreur: "Le mot doit toucher une tuile déjà posée." };
  }

  // Tous les mots (≥ 2 lettres) contenant au moins une tuile nouvelle.
  const mots = [];
  const vus = new Set();
  const ajouter = (r0, c0, dr, dc) => {
    let r = r0, c = c0;
    while (r - dr >= 0 && c - dc >= 0 && b[r - dr][c - dc] !== "") { r -= dr; c -= dc; }
    const cle = `${r},${c},${dr}`;
    if (vus.has(cle)) return;
    vus.add(cle);
    let mot = "", somme = 0, mult = 1, n = 0;
    while (r < TAILLE && c < TAILLE && b[r][c] !== "") {
      const x = b[r][c];
      mot += x.toUpperCase();
      const v = pointsLettre(x);
      if (nouvelle.has(r * TAILLE + c)) {
        const p = PRIMES[r][c];
        somme += v * (p === "LD" ? 2 : p === "LT" ? 3 : 1);
        if (p === "MD") mult *= 2; else if (p === "MT") mult *= 3;
      } else somme += v;
      n++; r += dr; c += dc;
    }
    if (n > 1) mots.push({ mot, score: somme * mult });
  };
  for (const t of poses) { ajouter(t.r, t.c, 0, 1); ajouter(t.r, t.c, 1, 0); }
  if (!mots.length) return { ok: false, erreur: "Un mot doit compter au moins 2 lettres." };

  const invalides = mots.filter((m) => !estMot(m.mot)).map((m) => m.mot);
  if (invalides.length) return { ok: false, erreur: `Mot${invalides.length > 1 ? "s" : ""} refusé${invalides.length > 1 ? "s" : ""} : ${invalides.join(", ")}.`, invalides, mots };

  const score = mots.reduce((t, m) => t + m.score, 0) + (poses.length === 7 ? 50 : 0);
  return { ok: true, score, mots };
}

// ─── Ordinateur ─────────────────────────────────────────────────────────────

export const NIVEAUX = {
  facile: "Facile",
  moyen: "Moyen",
  fort: "Fort",
};

/**
 * Choisit le coup de l'ordinateur. Facile : au hasard dans la moitié basse de la liste
 * (coups modestes) ; moyen : au hasard parmi les 8 meilleurs ; fort : le meilleur.
 * @returns le coup (voir genererCoups) ou null s'il n'en a aucun.
 */
export function choisirCoup(trie, plateau, chevalet, niveau = "moyen") {
  const coups = genererCoups(trie, plateau, chevalet.join(""));
  if (!coups.length) return null;
  if (niveau === "fort") return coups[0];
  if (niveau === "moyen") return coups[Math.floor(Math.random() * Math.min(8, coups.length))];
  const debut = Math.floor(coups.length / 2);
  return coups[debut + Math.floor(Math.random() * (coups.length - debut))];
}

// ─── Fin de partie ──────────────────────────────────────────────────────────

/**
 * Applique le décompte final. `finisseur` = "joueur" | "ordi" | null (parties bloquées).
 * @returns {{ joueur:number, ordi:number }} scores finaux
 */
export function scoreFinal({ scores, chevalets }, finisseur) {
  const vJ = valeurChevalet(chevalets.joueur), vO = valeurChevalet(chevalets.ordi);
  let joueur = scores.joueur - vJ, ordi = scores.ordi - vO;
  if (finisseur === "joueur") joueur += vO;
  if (finisseur === "ordi") ordi += vJ;
  return { joueur, ordi };
}
