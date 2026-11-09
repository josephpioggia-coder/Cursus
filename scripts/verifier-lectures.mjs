// Vérifie public/jeux/lectures-deuil.json (jeu « Lire pour traverser »). Usage : node scripts/verifier-lectures.mjs
import fs from "node:fs";
const livres = JSON.parse(fs.readFileSync("public/jeux/lectures-deuil.json", "utf8"));
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const OUTILS = new Set(["le", "la", "les", "des", "une", "un", "du", "de", "et", "en", "au", "aux", "qui", "que", "dans", "sur", "sous", "pour", "par", "ne", "avec", "pas", "ce", "ou", "plus", "belle", "maniere"]);
const CAT = new Set(["roman", "temoignage", "essai", "philo", null]);
const pb = [], ids = new Set();
for (const l of livres) {
  if (ids.has(l.id)) pb.push(`doublon id ${l.id}`); ids.add(l.id);
  for (const k of ["titre", "auteur", "genre", "pitch"]) if (!l[k]) pb.push(`${l.id}: champ ${k} manquant`);
  if (!CAT.has(l.categorie === undefined ? "?" : l.categorie)) pb.push(`${l.id}: categorie ${l.categorie}`);
  if (l.indices) {
    if (l.indices.length !== 5) pb.push(`${l.id}: il faut 5 indices`);
    for (const k of ["pays", "annee", "format", "lieu"]) if (!l[k]) pb.push(`${l.id}: champ ${k} manquant (fiche à indices)`);
    const motsTitre = norm(l.titre).split(/[^a-z0-9]+/).filter((m) => m.length >= 4 && !OUTILS.has(m));
    l.indices.forEach((ind, i) => {
      const mots = norm(ind).split(/[^a-z0-9]+/);
      const fuite = motsTitre.filter((m) => mots.some((x) => x === m || (m.length >= 6 && x.startsWith(m.slice(0, 5)))));
      if (fuite.length && i < 4) pb.push(`${l.id}: l'indice ${i + 1} contient « ${fuite.join(", ")} » du titre`);
      if (ind.length > 130) pb.push(`${l.id}: indice ${i + 1} trop long`);
    });
  }
}
console.log(livres.length, "livres dont", livres.filter((l) => l.indices).length, "avec indices,", pb.length, "problème(s)");
console.log(pb.join("\n"));
process.exit(pb.length ? 1 : 0);
