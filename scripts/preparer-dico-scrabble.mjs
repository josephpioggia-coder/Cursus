// Prépare public/scrabble/mots-fr.txt à partir d'une liste brute de mots français
// (une entrée par ligne). Usage : node scripts/preparer-dico-scrabble.mjs liste.txt
// Source (depuis le 29/09/2026) : Dicollecte / Grammalecte, dictionnaire
// orthographique français "classique" v7.5 (npm : dictionary-fr), licence MPL 2.0 —
// voir public/scrabble/LICENCE-DICOLLECTE.txt. Pas l'ODS officiel : couverture proche.
// La liste brute est produite par scripts/generer-dico-scrabble.sh.
// (Ancienne source, abandonnée : lorenbrichter/Words, licence non précisée.)
// Normalisation : sans accents, MAJUSCULES, A–Z seulement, 2 à 15 lettres,
// entrées avec tiret/apostrophe/espace/majuscule (noms propres, sigles) écartées.
import fs from "node:fs";
const [,, entree, sortie = "public/scrabble/mots-fr.txt"] = process.argv;
// Abréviations, sigles et symboles que Dicollecte (dictionnaire orthographique,
// pas un dictionnaire de jeu) accepte mais que le Scrabble refuse. Revue MANUELLE,
// limitée aux mots de 2 à 4 lettres (les mots de 2 lettres du Scrabble français sont
// peu nombreux et bien connus) : des abréviations plus longues peuvent subsister.
const INTERDITS = new Set(["AB","AC","AD","AE","AL","AV","CF","ED","ENV","ID","LN","OE","OP","PT","PTS","QU","UD","US","VS","FTP","FTPS","HTTP","KSS","ZZZZ"]);
const mots = new Set();
const brutsSansAccent = new Set(); // formes déjà écrites sans accent
const accentuees = {};             // MOT_NORMALISÉ → forme accentuée (pour les définitions)
for (const brut of fs.readFileSync(entree, "utf8").split(/\r?\n/)) {
  if (!brut || /[A-Z\-' .]/.test(brut)) continue;
  const m = brut.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "OE").replace(/æ/g, "AE").toUpperCase();
  if (/^[A-Z]{2,15}$/.test(m) && !INTERDITS.has(m)) {
    mots.add(m);
    if (brut === brut.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) brutsSansAccent.add(m);
    else if (!accentuees[m]) accentuees[m] = brut;
  }
}
const liste = [...mots].sort();
fs.writeFileSync(sortie, liste.join("\n"));
for (const m of brutsSansAccent) delete accentuees[m];
// accents.txt : une forme accentuée par ligne (le navigateur reconstruit la
// correspondance en normalisant) — sert à chercher la bonne page Wiktionnaire.
fs.writeFileSync(sortie.replace(/mots-fr\.txt$/, "accents.txt"), Object.values(accentuees).join("\n"));
console.log(liste.length, "mots →", sortie);
