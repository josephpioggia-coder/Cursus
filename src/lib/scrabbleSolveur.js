/**
 * CURSUS — Solveur Scrabble (29/09/2026)
 * ======================================================================
 * Module PUR (aucune dépendance React/DOM) : testable sous Node.
 *
 * - Dictionnaire : trie compact (tableaux typés, ~7 Mo pour 310 000 mots).
 * - Génération des coups : algorithme d'Appel & Jacobson (ancres +
 *   contrôles croisés), appliqué aux lignes puis aux colonnes (plateau
 *   transposé). Le score est recalculé à part, coup par coup.
 * - Plateau : tableau 15×15 de chaînes. "" = case vide, "A".."Z" = tuile,
 *   "a".."z" = joker posé (vaut 0 point). Chevalet : chaîne, "?" = joker.
 * - Règles : barème et primes du Scrabble français standard, bonus de 50
 *   points pour les 7 tuiles posées d'un coup.
 */

export const TAILLE = 15;
export const CENTRE = 7;

// Barème français (identique à la capture d'écran : Z=10, K=10, H=4, V=4…).
const POINTS = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 10, L: 1, M: 2,
  N: 1, O: 1, P: 3, Q: 8, R: 1, S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10,
};
export const pointsLettre = (l) => (l === l.toUpperCase() ? POINTS[l] || 0 : 0);

// Primes : "MT" mot compte triple, "MD" mot double, "LT" lettre triple,
// "LD" lettre double (vocabulaire de l'application de la capture).
export const PRIMES = (() => {
  const g = Array.from({ length: TAILLE }, () => Array(TAILLE).fill(""));
  const poser = (code, coords) => coords.forEach(([r, c]) => {
    // symétrie ×8 du plateau standard
    for (const [a, b] of [[r, c], [c, r]]) {
      for (const ra of [a, 14 - a]) for (const cb of [b, 14 - b]) g[ra][cb] = code;
    }
  });
  poser("MT", [[0, 0], [0, 7]]);
  poser("MD", [[1, 1], [2, 2], [3, 3], [4, 4], [7, 7]]);
  poser("LT", [[1, 5], [5, 5]]);
  poser("LD", [[0, 3], [2, 6], [3, 7], [6, 6]]);
  return g;
})();

// ─── Dictionnaire (trie premier-fils / frère-suivant) ────────────────────────

export function construireDico(texte) {
  const mots = texte.split(/\r?\n/).filter((m) => m.length > 1);
  // Borne haute : chaque lettre de chaque mot crée au plus un nœud.
  let total = 1;
  for (const m of mots) total += m.length;
  const lettre = new Uint8Array(total);
  const premier = new Int32Array(total).fill(-1);
  const dernier = new Int32Array(total).fill(-1);
  const suivant = new Int32Array(total).fill(-1);
  const fin = new Uint8Array(total);
  let n = 1;
  let chemin = [0]; // chemin[i] = nœud atteint après i lettres du mot précédent
  let prec = "";
  for (const m of mots) { // la liste est triée : lettres communes = préfixe du précédent
    let p = 0;
    const max = Math.min(prec.length, m.length);
    while (p < max && prec.charCodeAt(p) === m.charCodeAt(p)) p++;
    chemin.length = p + 1;
    for (let i = p; i < m.length; i++) {
      const parent = chemin[i];
      const noeud = n++;
      lettre[noeud] = m.charCodeAt(i) - 65;
      if (premier[parent] === -1) premier[parent] = noeud; else suivant[dernier[parent]] = noeud;
      dernier[parent] = noeud;
      chemin.push(noeud);
    }
    fin[chemin[m.length]] = 1;
    prec = m;
  }
  return { lettre, premier, suivant, fin, noeuds: n };
}

export const fils = (d, noeud, l) => {
  for (let c = d.premier[noeud]; c !== -1; c = d.suivant[c]) if (d.lettre[c] === l) return c;
  return -1;
};
const contient = (d, mot) => {
  let n = 0;
  for (let i = 0; i < mot.length; i++) {
    n = fils(d, n, mot.charCodeAt(i) - 65);
    if (n === -1) return false;
  }
  return d.fin[n] === 1;
};

// ─── Utilitaires plateau ─────────────────────────────────────────────────────

export const plateauVide = () => Array.from({ length: TAILLE }, () => Array(TAILLE).fill(""));
const transposer = (b) => b[0].map((_, c) => b.map((ligne) => ligne[c]));
const estVide = (b) => b.every((l) => l.every((x) => x === ""));

// Contrôles croisés : pour chaque case vide, masque (26 bits) des lettres qui
// forment un mot vertical valide avec les tuiles déjà posées au-dessus/dessous.
function controlesCroises(d, b) {
  const TOUT = (1 << 26) - 1;
  const cc = Array.from({ length: TAILLE }, () => Array(TAILLE).fill(TOUT));
  for (let r = 0; r < TAILLE; r++) {
    for (let c = 0; c < TAILLE; c++) {
      if (b[r][c] !== "") continue;
      let haut = "", bas = "";
      for (let i = r - 1; i >= 0 && b[i][c] !== ""; i--) haut = b[i][c].toUpperCase() + haut;
      for (let i = r + 1; i < TAILLE && b[i][c] !== ""; i++) bas += b[i][c].toUpperCase();
      if (!haut && !bas) continue;
      let masque = 0;
      for (let l = 0; l < 26; l++) if (contient(d, haut + String.fromCharCode(65 + l) + bas)) masque |= 1 << l;
      cc[r][c] = masque;
    }
  }
  return cc;
}

// Score d'un coup horizontal (dans le repère de b). `poses` : Map col → {l, joker}.
function scorer(b, r, poses, debut, finCol) {
  let somme = 0, mult = 1;
  for (let c = debut; c <= finCol; c++) {
    if (poses.has(c)) {
      const { l, joker } = poses.get(c);
      const prime = PRIMES[r][c];
      const v = joker ? 0 : POINTS[l];
      somme += v * (prime === "LD" ? 2 : prime === "LT" ? 3 : 1);
      if (prime === "MD") mult *= 2; else if (prime === "MT") mult *= 3;
    } else {
      somme += pointsLettre(b[r][c]);
    }
  }
  let total = somme * mult;
  for (const [c, { l, joker }] of poses) { // mots croisés
    let h = r, bs = r;
    while (h > 0 && b[h - 1][c] !== "") h--;
    while (bs < TAILLE - 1 && b[bs + 1][c] !== "") bs++;
    if (h === r && bs === r) continue;
    let s = 0, m = 1;
    for (let i = h; i <= bs; i++) {
      if (i === r) {
        const prime = PRIMES[r][c];
        s += (joker ? 0 : POINTS[l]) * (prime === "LD" ? 2 : prime === "LT" ? 3 : 1);
        if (prime === "MD") m *= 2; else if (prime === "MT") m *= 3;
      } else s += pointsLettre(b[i][c]);
    }
    total += s * m;
  }
  if (poses.size === 7) total += 50;
  return total;
}

// ─── Génération des coups ────────────────────────────────────────────────────

// Coups horizontaux (repère de b) : ancres + partie gauche de longueur fixée k
// (les contrôles croisés des k cases sont alors connus d'avance) + extension droite.
function coupsHorizontaux(d, b, chevalet) {
  const cc = controlesCroises(d, b);
  const vide = estVide(b);
  const res = [];
  const stock = new Int8Array(26);
  let jokers = 0;
  for (const ch of chevalet.toUpperCase()) {
    if (ch === "?") jokers++;
    else if (ch >= "A" && ch <= "Z") stock[ch.charCodeAt(0) - 65]++;
  }
  const estAncre = (r, c) => {
    if (b[r][c] !== "") return false;
    if (vide) return r === CENTRE && c === CENTRE;
    return (c > 0 && b[r][c - 1] !== "") || (c < TAILLE - 1 && b[r][c + 1] !== "")
      || (r > 0 && b[r - 1][c] !== "") || (r < TAILLE - 1 && b[r + 1][c] !== "");
  };

  for (let r = 0; r < TAILLE; r++) {
    const ancre = Array.from({ length: TAILLE }, (_, c) => estAncre(r, c));
    if (!ancre.some(Boolean)) continue;

    for (let c = 0; c < TAILLE; c++) {
      if (!ancre[c]) continue;
      const gauche = []; // tuiles de la partie gauche [{l, joker}] dans l'ordre du mot
      const droite = new Map(); // col → {l, joker} pour les tuiles posées à partir de l'ancre
      const lettres = [];

      const utiliser = (l, suite) => {
        let joker = false;
        if (stock[l] > 0) stock[l]--;
        else if (jokers > 0) { jokers--; joker = true; }
        else return;
        suite(joker);
        if (joker) jokers++; else stock[l]++;
      };

      const enregistrer = (debut, finCol) => {
        const poses = new Map();
        gauche.forEach((t, i) => poses.set(c - gauche.length + i, t));
        for (const [col, t] of droite) poses.set(col, t);
        res.push({
          mot: lettres.join(""),
          ligne: r, colonne: debut,
          tuiles: [...poses].map(([col, t]) => ({ r, c: col, l: t.l, joker: t.joker })),
          score: scorer(b, r, poses, debut, finCol),
        });
      };

      const etendreDroite = (noeud, col, debut) => {
        if (col >= TAILLE || b[r][col] === "") {
          if (col > c && d.fin[noeud]) enregistrer(debut, col - 1);
          if (col >= TAILLE) return;
          for (let f = d.premier[noeud]; f !== -1; f = d.suivant[f]) {
            const l = d.lettre[f];
            if (!(cc[r][col] & (1 << l))) continue;
            const car = String.fromCharCode(65 + l);
            utiliser(l, (joker) => {
              droite.set(col, { l: car, joker });
              lettres.push(car);
              etendreDroite(f, col + 1, debut);
              lettres.pop();
              droite.delete(col);
            });
          }
        } else {
          const car = b[r][col].toUpperCase();
          const f = fils(d, noeud, car.charCodeAt(0) - 65);
          if (f === -1) return;
          lettres.push(car);
          etendreDroite(f, col + 1, debut);
          lettres.pop();
        }
      };

      if (c > 0 && b[r][c - 1] !== "") {
        let s = c - 1;
        while (s > 0 && b[r][s - 1] !== "") s--;
        let noeud = 0;
        for (let i = s; i < c && noeud !== -1; i++) noeud = fils(d, noeud, b[r][i].toUpperCase().charCodeAt(0) - 65);
        if (noeud === -1) continue;
        for (let i = s; i < c; i++) lettres.push(b[r][i].toUpperCase());
        etendreDroite(noeud, c, s);
        lettres.length = 0;
      } else {
        let limite = 0;
        for (let i = c - 1; i >= 0 && b[r][i] === "" && !ancre[i]; i--) limite++;
        // Génération par longueur finale fixée : pour chaque longueur k, les
        // colonnes des k tuiles gauche sont [c-k .. c-1] et leurs contrôles
        // croisés sont connus d'avance.
        for (let k = 0; k <= limite; k++) {
          const dep = (noeud, i) => {
            if (i === k) { etendreDroite(noeud, c, c - k); return; }
            const col = c - k + i;
            for (let f = d.premier[noeud]; f !== -1; f = d.suivant[f]) {
              const l = d.lettre[f];
              if (!(cc[r][col] & (1 << l))) continue;
              const car = String.fromCharCode(65 + l);
              utiliser(l, (joker) => {
                gauche.push({ l: car, joker });
                lettres.push(car);
                dep(f, i + 1);
                lettres.pop();
                gauche.pop();
              });
            }
          };
          dep(0, 0);
        }
      }
    }
  }
  return res;
}

/**
 * Tous les coups légaux, triés par score décroissant.
 * @returns [{ mot, score, sens: "H"|"V", ligne, colonne, tuiles:[{r,c,l,joker}] }]
 *   (ligne/colonne 0-indexées, en repère réel ; `mot` = mot principal)
 */
export function genererCoups(dico, plateau, chevalet) {
  const vus = new Set();
  const coups = [];
  const ajouter = (liste, sens) => {
    for (const m of liste) {
      const tuiles = sens === "H" ? m.tuiles : m.tuiles.map((t) => ({ ...t, r: t.c, c: t.r }));
      if (!tuiles.length) continue;
      const cle = tuiles.map((t) => `${t.r},${t.c},${t.l}${t.joker ? "*" : ""}`).sort().join("|");
      if (vus.has(cle)) continue;
      vus.add(cle);
      coups.push({
        mot: m.mot, score: m.score, sens,
        ligne: sens === "H" ? m.ligne : m.colonne,
        colonne: sens === "H" ? m.colonne : m.ligne,
        tuiles,
      });
    }
  };
  ajouter(coupsHorizontaux(dico, plateau, chevalet), "H");
  ajouter(coupsHorizontaux(dico, transposer(plateau), chevalet), "V");
  coups.sort((a, b) => b.score - a.score || a.mot.localeCompare(b.mot));
  return coups;
}

// Notation française usuelle : "8H" (ligne puis colonne) pour un mot horizontal,
// "H8" (colonne puis ligne) pour un mot vertical.
export const notation = (coup) => {
  const col = String.fromCharCode(65 + coup.colonne);
  return coup.sens === "H" ? `${coup.ligne + 1}${col}` : `${col}${coup.ligne + 1}`;
};

export function appliquerCoup(plateau, coup) {
  const p = plateau.map((l) => [...l]);
  for (const t of coup.tuiles) p[t.r][t.c] = t.joker ? t.l.toLowerCase() : t.l;
  return p;
}

export function retirerDuChevalet(chevalet, coup) {
  let reste = chevalet.toUpperCase();
  for (const t of coup.tuiles) {
    const i = reste.indexOf(t.joker ? "?" : t.l);
    if (i >= 0) reste = reste.slice(0, i) + reste.slice(i + 1);
  }
  return reste;
}

// ─── Alignement d'une capture partielle sur le plateau 15×15 ────────────────

/**
 * `lecture` : matrice (tableau de lignes) de la zone VISIBLE sur la capture ;
 * chaque cellule est soit une tuile ("A".."Z", minuscule = joker), soit un code
 * de prime ("MD","MT","LD","LT" ou "" pour une case normale, "*" pour l'étoile).
 * Retourne les décalages (ligne, colonne) où les primes lues coïncident le mieux
 * avec le plateau standard (les tuiles masquent leur prime, donc ignorées).
 */
export function aligner(lecture) {
  const h = lecture.length;
  const w = Math.max(...lecture.map((l) => l.length));
  const estTuile = (x) => /^[A-Za-z]$/.test(x || "");
  let meilleur = { dr: 0, dc: 0, score: -1 };
  for (let dr = 0; dr + h <= TAILLE; dr++) {
    for (let dc = 0; dc + w <= TAILLE; dc++) {
      let ok = 0, tot = 0;
      for (let i = 0; i < h; i++) for (let j = 0; j < lecture[i].length; j++) {
        const x = lecture[i][j];
        if (estTuile(x)) continue;
        tot++;
        const attendu = PRIMES[dr + i][dc + j];
        if ((x === "*" ? "MD" : x || "") === attendu) ok++;
      }
      const score = tot ? ok / tot : 0;
      if (score > meilleur.score) meilleur = { dr, dc, score };
    }
  }
  return meilleur;
}

export function plateauDepuisLecture(lecture, dr, dc) {
  const p = plateauVide();
  lecture.forEach((ligne, i) => ligne.forEach((x, j) => {
    if (/^[A-Za-z]$/.test(x || "") && dr + i < TAILLE && dc + j < TAILLE) p[dr + i][dc + j] = x;
  }));
  return p;
}
