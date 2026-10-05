// Convertit une saisie « rang|évolution|semaines|titre|auteur|segment|éditeur|jj/mm/aaaa|prix » (une ligne par livre, titres AVEC leurs
// accents, auteur au format « Prénom Nom ») en public/jeux/palmares.json. Le tableau d'Edistat colle des titres sans accents et des
// auteurs « nom, prénom » en minuscules : la correction se fait à la main pendant la saisie (voir scripts/donnees/).
// Usage : node scripts/importer-palmares.mjs scripts/donnees/palmares-semaine-39-2026.txt 39 2026-09-21 2026-09-27
import fs from "node:fs";
const [, , fichier, semaine, du, au] = process.argv;
if (!fichier || !semaine || !du || !au) { console.error("Usage : node scripts/importer-palmares.mjs <fichier.txt> <semaine> <du AAAA-MM-JJ> <au AAAA-MM-JJ>"); process.exit(1); }
const livres = fs.readFileSync(fichier, "utf8").split("\n").filter((l) => l.trim()).map((l) => {
  const [rang, evo, sem, titre, auteur, segment, editeur, date = "", prix = ""] = l.split("|");
  const [j, m, a] = date ? date.split("/") : [];
  return { rang: +rang, evo, sem: +sem, titre, auteur, segment, editeur, parution: date ? `${a}-${m}-${j}` : null, prix: prix ? +prix.replace(",", ".") : null };
});
const sortie = { semaine: +semaine, du, au, source: "Edistat, Top 200 des ventes hebdomadaires du marché", saisi: new Date().toISOString().slice(0, 10), livres };
fs.writeFileSync("public/jeux/palmares.json", JSON.stringify(sortie, null, 0));
console.log(livres.length, "livres écrits dans public/jeux/palmares.json — lancer ensuite : node scripts/verifier-palmares.mjs");
