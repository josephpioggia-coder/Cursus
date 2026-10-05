/**
 * CURSUS — Moteur pur du jeu « Au palmarès » (05/10/2026) : deux livres du Top 200 hebdomadaire des ventes (Edistat, semaine 39,
 * du 21 au 27 septembre 2026), une question de comparaison (mieux classé, plus ancien au classement, paru en premier, plus cher).
 * Données : public/jeux/palmares.json (saisies à partir du tableau fourni par Joseph le 05/10/2026 ; voir scripts/verifier-palmares.mjs).
 * Les réponses sont des FAITS du tableau : aucun appel IA, aucune interprétation.
 */

let enCache = null;
export async function chargerPalmares() {
  if (enCache) return enCache;
  const rep = await fetch("/jeux/palmares.json");
  if (!rep.ok) throw new Error("Palmarès introuvable (HTTP " + rep.status + ").");
  enCache = await rep.json();
  return enCache;
}

const melanger = (t, rng = Math.random) => { const a = t.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const jours = (d) => Date.parse(d) / 86400000;

export const fmtDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
export const fmtPrix = (p) => p.toFixed(2).replace(".", ",") + " €";

/** Livres jouables : pas de manuels scolaires, de codes juridiques ni de plans comptables, un seul exemplaire par titre et auteur. */
export function eligibles(livres) {
  const vus = new Set();
  return livres.filter((l) => {
    if (l.segment === "Enseignement" || /^(Code |Plan comptable)/.test(l.titre)) return false;
    const k = (l.titre + "|" + l.auteur).toLowerCase();
    if (vus.has(k)) return false;
    vus.add(k); return true;
  });
}

export const QUESTIONS = {
  rang: { texte: "Lequel est le mieux classé cette semaine ?", meilleur: "min", valeur: (l) => l.rang,
    ok: (a, b) => Math.abs(a.rang - b.rang) >= 8, montrer: (l) => `n° ${l.rang}` },
  sem: { texte: "Lequel est dans le Top 200 depuis le plus longtemps ?", meilleur: "max", valeur: (l) => l.sem,
    ok: (a, b) => Math.abs(a.sem - b.sem) >= 10, montrer: (l) => `${l.sem} semaine${l.sem > 1 ? "s" : ""}` },
  date: { texte: "Quelle édition est parue en premier ?", meilleur: "min", valeur: (l) => (l.parution ? jours(l.parution) : null),
    ok: (a, b) => a.parution && b.parution && Math.abs(jours(a.parution) - jours(b.parution)) >= 180, montrer: (l) => fmtDate(l.parution) },
  prix: { texte: "Quelle édition est la plus chère ?", meilleur: "max", valeur: (l) => l.prix,
    ok: (a, b) => a.prix != null && b.prix != null && Math.abs(a.prix - b.prix) >= 3, montrer: (l) => fmtPrix(l.prix) },
};

/** Prépare `n` manches [{ type, a, b, bonne: "a" | "b" }] : types variés, chaque livre une seule fois, écarts nets (pas de photo-finish). */
export function preparerManches(livres, n = 10, rng = Math.random) {
  const pool = eligibles(livres), types = Object.keys(QUESTIONS), manches = [], pris = new Set();
  for (let i = 0; i < n; i++) {
    const type = types[i % types.length], Q = QUESTIONS[type];
    let trouve = null;
    for (let essai = 0; essai < 400 && !trouve; essai++) {
      const [a, b] = melanger(pool, rng).slice(0, 2);
      if (pris.has(a.rang + a.titre) || pris.has(b.rang + b.titre) || !Q.ok(a, b)) continue;
      const va = Q.valeur(a), vb = Q.valeur(b);
      trouve = { type, a, b, bonne: (Q.meilleur === "min" ? va < vb : va > vb) ? "a" : "b" };
      pris.add(a.rang + a.titre); pris.add(b.rang + b.titre);
    }
    if (trouve) manches.push(trouve);
  }
  return melanger(manches, rng);
}

export function mention(score, total) {
  const p = score / total;
  if (p >= 0.9) return "Libraire en chef : tu lis les classements comme personne !";
  if (p >= 0.7) return "Très bon œil pour les ventes.";
  if (p >= 0.5) return "Pas mal : le marché du livre a encore quelques surprises pour toi.";
  return "Le marché du livre est imprévisible : on rejoue ?";
}
