// Vérifie public/vitrine/livres.json (vitrine publique des auteurs partenaires). Usage : node scripts/verifier-vitrine.mjs
// Règle absolue : une fiche sans `consentement` (date de l'accord écrit de l'auteur) ne doit JAMAIS être publiée.
import fs from "node:fs";
const livres = JSON.parse(fs.readFileSync("public/vitrine/livres.json", "utf8"));
const DOSSIERS = new Set(["deuil"]), MODES = new Set(["seul", "cursus", undefined]);
const pb = [], ids = new Set();
if (!Array.isArray(livres)) pb.push("le fichier doit contenir un tableau");
for (const l of Array.isArray(livres) ? livres : []) {
  const n = l.id || l.titre || "?";
  if (!l.id) pb.push(`${n}: id manquant`); else if (ids.has(l.id)) pb.push(`${n}: doublon d'id`); else ids.add(l.id);
  for (const k of ["titre", "auteur", "accroche", "consentement"]) if (!l[k]) pb.push(`${n}: champ ${k} manquant`);
  if (l.consentement && !/^\d{4}-\d{2}-\d{2}$/.test(l.consentement)) pb.push(`${n}: consentement doit être une date AAAA-MM-JJ`);
  if (!Array.isArray(l.dossiers) || !l.dossiers.length || l.dossiers.some((d) => !DOSSIERS.has(d))) pb.push(`${n}: dossiers invalides`);
  if (!MODES.has(l.modeCreation)) pb.push(`${n}: modeCreation ${l.modeCreation}`);
  if (l.lien && !/^https:\/\//i.test(l.lien)) pb.push(`${n}: le lien doit commencer par https://`);
  if (l.couverture && !/^\/vitrine\/couvertures\/[\w.-]+$/.test(l.couverture)) pb.push(`${n}: couverture attendue dans /vitrine/couvertures/`);
  if (l.couverture && !fs.existsSync("public" + l.couverture)) pb.push(`${n}: fichier de couverture introuvable`);
}
console.log((Array.isArray(livres) ? livres.length : 0), "fiche(s),", pb.length, "problème(s)");
console.log(pb.join("\n"));
process.exit(pb.length ? 1 : 0);
