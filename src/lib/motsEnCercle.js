/**
 * CURSUS — Moteur pur du jeu « Mots en cercle » (05/10/2026) : 6 ou 7 lettres disposées en cercle, on les relie du
 * doigt pour former des mots qui remplissent une grille. Idée de Joseph (capture d'un jeu de ce type). Les mots de la
 * grille sont des mots COURANTS (public/jeux/mots-courants.txt, par fréquence) formables avec les lettres, y compris
 * le mot de départ lui-même ; tout autre mot du dictionnaire (mots-fr.txt) formable avec les lettres est accepté en
 * BONUS. Un niveau est donc toujours soluble par construction.
 */
import { melangerTab, motFormable } from "./jeuxDeMots.js";

export const NIVEAUX_CERCLE = {
  facile: { lettres: 6, mots: 8, premiere: true },
  moyen: { lettres: 7, mots: 12, premiere: false },
  difficile: { lettres: 7, mots: 16, premiere: false },
};
export const MIN_LONGUEUR = 3;

const net = (m) => /^[A-Z]+$/.test(m);
// Interjections, sigles et formes douteuses présents dans la liste de fréquence (sous-titres) : jamais à trouver dans la grille
// (ils restent acceptés en BONUS s'ils figurent au dictionnaire).
const EXCLUS = new Set(["EUH", "USA", "BEN", "REA", "BAH", "HEY", "HEIN", "HUM", "OUF", "OUAIS", "OKAY", "NAN", "PFF", "BOUH", "HEUH", "TSS", "ONU", "CIA", "FBI", "SOS", "PDG", "TGV", "SMS", "OVNI", "VIP", "NEE", "HEU", "OHE", "HERO"]);

/**
 * @param courants { normalises: string[] } (par fréquence décroissante)
 * @param ensemble Set des mots du dictionnaire (MAJUSCULES sans accents)
 * @returns {{ base:string, lettres:string[], mots:string[], premiere:boolean }} `mots` triés par longueur puis alphabet
 */
export function genererNiveauCercle(courants, ensemble, niveau = "facile", rng = Math.random) {
  const cfg = NIVEAUX_CERCLE[niveau] || NIVEAUX_CERCLE.facile;
  const pool = courants.normalises.slice(0, 15000).filter((m) => net(m) && ensemble.has(m) && !EXCLUS.has(m));
  const bases = melangerTab(pool.slice(0, 9000).filter((m) => m.length === cfg.lettres), rng);
  let meilleur = null;
  for (let essai = 0; essai < Math.min(150, bases.length); essai++) {
    const base = bases[essai];
    const sous = pool.filter((m) => m.length >= MIN_LONGUEUR && m.length <= cfg.lettres && motFormable(m, base));
    const unique = [...new Set(sous)];
    if (!unique.includes(base)) continue;
    if (!meilleur || unique.length > meilleur.mots.length) meilleur = { base, mots: unique };
    if (unique.length >= cfg.mots) break;
  }
  if (!meilleur) throw new Error("Impossible de générer un niveau.");
  const autres = meilleur.mots.filter((m) => m !== meilleur.base).slice(0, cfg.mots - 1); // les plus courants d'abord
  const mots = [meilleur.base, ...autres].sort((a, b) => a.length - b.length || a.localeCompare(b));
  return { base: meilleur.base, lettres: melangerTab([...meilleur.base], rng), mots, premiere: cfg.premiere };
}

/** Un mot relié sur le cercle : « grille » (à trouver), « bonus » (valide mais hors grille), « court » ou « inconnu ». */
export function jugerMot(mot, niveau, ensemble) {
  if (mot.length < MIN_LONGUEUR) return "court";
  if (niveau.mots.includes(mot)) return "grille";
  if (ensemble.has(mot) && motFormable(mot, niveau.base)) return "bonus";
  return "inconnu";
}

/**
 * Indice : dévoile la prochaine lettre d'un mot non trouvé (le plus long d'abord pour ne pas gâcher les petits).
 * `reveles` : { MOT: nombre de lettres dévoilées } ; avec `premiere`, la 1re lettre est déjà donnée.
 */
export function donnerIndice(niveau, trouves, reveles, rng = Math.random) {
  const depart = niveau.premiere ? 1 : 0;
  const restants = niveau.mots.filter((m) => !trouves.has(m) && (reveles[m] ?? depart) < m.length - 1);
  if (!restants.length) return reveles;
  const max = Math.max(...restants.map((m) => m.length));
  const m = melangerTab(restants.filter((x) => x.length === max), rng)[0];
  return { ...reveles, [m]: (reveles[m] ?? depart) + 1 };
}
