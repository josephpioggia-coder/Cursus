// Vérifie public/jeux/livres.json (jeux « Devine le livre » et « Quel lecteur es-tu ? ») : champs, 5 indices,
// dimensions 0-4, indices qui ne contiennent pas les mots du titre, doublons. Usage : node scripts/verifier-livres.mjs
import fs from "node:fs";
const livres = JSON.parse(fs.readFileSync("public/jeux/livres.json", "utf8"));
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const pb = [], ids = new Set();
const DIMS = ["suspense", "emotion", "noirceur", "realisme", "exigence", "humour"];
const OUTILS = new Set(["le", "la", "les", "des", "une", "un", "du", "de", "et", "en", "au", "aux", "qui", "que", "dans", "sur", "sous", "pour", "par", "ne", "dis", "personne", "avec", "pas", "ce", "ou"]);
for (const l of livres) {
  if (ids.has(l.id)) pb.push(`doublon id ${l.id}`); ids.add(l.id);
  for (const k of ["titre", "auteur", "pays", "annee", "format", "genre", "epoque", "lieu", "palmares", "pitch"]) if (!l[k]) pb.push(`${l.id}: champ ${k} manquant`);
  if (!["roman", "recit", "theatre", "bd"].includes(l.format)) pb.push(`${l.id}: format ${l.format}`);
  if (!["contemporaine", "passe", "intemporelle"].includes(l.epoque)) pb.push(`${l.id}: epoque ${l.epoque}`);
  if (!Array.isArray(l.indices) || l.indices.length !== 5) pb.push(`${l.id}: il faut 5 indices`);
  for (const d of DIMS) if (!(l.dims?.[d] >= 0 && l.dims[d] <= 4)) pb.push(`${l.id}: dimension ${d} hors 0-4`);
  const motsTitre = norm(l.titre).split(/[^a-z]+/).filter((m) => m.length >= 4 && !OUTILS.has(m));
  (l.indices || []).forEach((ind, i) => {
    const mots = norm(ind).split(/[^a-z]+/);
    const fuite = motsTitre.filter((m) => mots.some((x) => x === m || (m.length >= 6 && x.startsWith(m.slice(0, 5)))));
    if (fuite.length && i < 4) pb.push(`${l.id}: l'indice ${i + 1} contient « ${fuite.join(", ")} » du titre`);
    if (ind.length > 130) pb.push(`${l.id}: indice ${i + 1} trop long`);
  });
}
console.log(livres.length, "livres,", pb.length, "problème(s)");
console.log(pb.join("\n"));
const parFormat = {}; livres.forEach((l) => { parFormat[l.format] = (parFormat[l.format] || 0) + 1; }); console.log(JSON.stringify(parFormat));
