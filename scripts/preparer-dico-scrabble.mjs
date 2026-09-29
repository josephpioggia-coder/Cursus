// Prépare public/scrabble/mots-fr.txt à partir d'une liste brute de mots français
// (une entrée par ligne). Usage : node scripts/preparer-dico-scrabble.mjs liste.txt
// Source utilisée le 29/09/2026 : lorenbrichter/Words, Words/fr.txt (liste du
// jeu Letterpress) — PAS l'ODS officiel : couverture proche, mais pas identique.
// Normalisation : sans accents, MAJUSCULES, A–Z seulement, 2 à 15 lettres,
// entrées avec tiret/apostrophe/espace/majuscule (noms propres, sigles) écartées.
import fs from "node:fs";
const [,, entree, sortie = "public/scrabble/mots-fr.txt"] = process.argv;
const mots = new Set();
for (const brut of fs.readFileSync(entree, "utf8").split(/\r?\n/)) {
  if (!brut || /[A-Z\-' .]/.test(brut)) continue;
  const m = brut.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "OE").replace(/æ/g, "AE").toUpperCase();
  if (/^[A-Z]{2,15}$/.test(m)) mots.add(m);
}
const liste = [...mots].sort();
fs.writeFileSync(sortie, liste.join("\n"));
console.log(liste.length, "mots →", sortie);
