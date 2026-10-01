// Prépare public/jeux/mots-courants.txt : les mots FRANÇAIS COURANTS, dans l'ordre de
// fréquence (ligne n = rang n), avec leurs accents, pour choisir les mots à faire deviner
// (Motus, Pendu, Mot le plus long, Échelle de mots…). Le dictionnaire complet
// (public/scrabble/mots-fr.txt, 411 000 formes dont beaucoup d'obscures) ne convient pas
// pour ça, mais reste la référence pour ACCEPTER une réponse.
//
// Sources :
//  - fréquences : hermitdave/FrequencyWords, content/2018/fr/fr_50k.txt (sous-titres
//    OpenSubtitles) — CONTENU sous licence CC-BY-SA 4.0 (code MIT) : la liste produite reste
//    sous CC-BY-SA 4.0, attribution dans public/jeux/LICENCE-MOTS-COURANTS.txt ;
//  - mots grossiers à exclure : npm `french-badwords-list` (MIT), utilisé à la génération
//    seulement (rien n'est livré). Filtre au mieux, pas infaillible.
// Usage : node scripts/preparer-mots-courants.mjs fr_50k.txt badwords.json
//   (badwords.json = JSON.stringify(require("french-badwords-list").array))
// Ne garde que les mots présents dans le dictionnaire Scrabble (donc : pas de noms propres,
// d'abréviations ni de mots inventés), de 3 à 12 lettres, jusqu'à 25 000 mots.
import fs from "node:fs";
const [,, fichierFreq, fichierGrossiers] = process.argv;
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae").toLowerCase();
const dico = new Set(fs.readFileSync("public/scrabble/mots-fr.txt", "utf8").split("\n"));
const leet = (s) => s.replace(/[!1|]/g, "i").replace(/3/g, "e").replace(/@|4/g, "a").replace(/0/g, "o").replace(/\$|5/g, "s");
const grossiers = new Set();
for (const g of JSON.parse(fs.readFileSync(fichierGrossiers, "utf8"))) {
  const m = norm(leet(g)).replace(/[^a-z]/g, "");
  if (m.length >= 3) grossiers.add(m);
}
// Radicaux d'au moins 5 lettres : écarte aussi les dérivés (pluriels, conjugaisons, féminins).
const radicaux = [...grossiers].filter((g) => g.length >= 5);
// Compléments manuels : la liste npm laisse passer quelques mots que je ne veux pas voir
// sortir comme mot à deviner dans un jeu tout public.
for (const m of ["cul", "culs", "chatte", "chattes", "nichon", "nichons", "couille", "couilles", "baise", "baiser", "baisent", "baisee", "bander", "branler", "branle", "burnes", "clito", "foutre", "nique", "niquer", "tapin", "tapiner"]) grossiers.add(m);
const vulgaire = (m) => grossiers.has(m) || radicaux.some((r) => m.startsWith(r));

const sortie = [], vus = new Set();
for (const ligne of fs.readFileSync(fichierFreq, "utf8").split("\n")) {
  const mot = ligne.split(" ")[0];
  if (!/^[a-zàâäçéèêëîïôöùûüÿœæ]{3,12}$/.test(mot)) continue;
  const n = norm(mot).toUpperCase();
  if (!dico.has(n) || vulgaire(norm(mot)) || vus.has(mot)) continue;
  vus.add(mot); sortie.push(mot);
  if (sortie.length >= 25000) break;
}
fs.writeFileSync("public/jeux/mots-courants.txt", sortie.join("\n"));
console.log(sortie.length, "mots courants →", "public/jeux/mots-courants.txt");
