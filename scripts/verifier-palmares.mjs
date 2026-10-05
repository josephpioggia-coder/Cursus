// Vérifie public/jeux/palmares.json (Top 200 hebdomadaire saisi à la main à partir du tableau d'Edistat) : 200 lignes, rangs
// croissants (ex æquo permis), champs présents, dates ISO, prix > 0. Usage : node scripts/verifier-palmares.mjs
import fs from "node:fs";
const p = JSON.parse(fs.readFileSync("public/jeux/palmares.json", "utf8"));
const pb = []; let prec = 0;
if (p.livres.length !== 200) pb.push(`${p.livres.length} lignes au lieu de 200`);
p.livres.forEach((l, i) => {
  if (l.rang < prec) pb.push(`ligne ${i + 1}: rang ${l.rang} après ${prec}`); prec = l.rang;
  for (const k of ["titre", "auteur", "segment", "editeur"]) if (!l[k]) pb.push(`rang ${l.rang}: ${k} manquant`);
  if (!/^(E|=|[+-]\d+)$/.test(l.evo)) pb.push(`rang ${l.rang}: évolution « ${l.evo} »`);
  if (!(l.sem >= 1)) pb.push(`rang ${l.rang}: semaines ${l.sem}`);
  if (l.parution && !/^\d{4}-\d\d-\d\d$/.test(l.parution)) pb.push(`rang ${l.rang}: date ${l.parution}`);
  if (l.prix != null && !(l.prix > 0)) pb.push(`rang ${l.rang}: prix ${l.prix}`);
  if (l.sem === 1 && l.evo !== "E" && l.evo !== "=" ) pb.push(`rang ${l.rang}: 1 semaine mais évolution ${l.evo}`);
});
console.log(p.livres.length, "lignes,", pb.length, "problème(s)"); console.log(pb.join("\n"));
