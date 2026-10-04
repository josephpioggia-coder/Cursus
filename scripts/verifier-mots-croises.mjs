// Vérifie public/jeux/mots-croises.txt (une ligne « MOT|indice » par entrée) : doublons, mot absent du
// dictionnaire (faute de frappe probable), réponse (ou sa racine) présente dans son propre indice, indices
// trop longs. Usage : node scripts/verifier-mots-croises.mjs
import fs from "node:fs";
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").toUpperCase();
const dico = new Set(fs.readFileSync("public/scrabble/mots-fr.txt", "utf8").split("\n"));
const lignes = fs.readFileSync("public/jeux/mots-croises.txt", "utf8").split("\n").filter(Boolean);
const vus = new Map(); const pb = [];
// Noms propres volontaires : absents du dictionnaire (qui n'en contient pas), c'est normal.
const NOMS_PROPRES = new Set(["ASIE","FRANCE","ROME","MADRID","BERLIN","LISBONNE","BRUXELLES","ATHENES","OSLO","LYON","MARSEILLE","NICE","NANTES","LILLE","STRASBOURG","TOULOUSE","ROUEN","DIJON","METZ","REIMS","ARLES","AVIGNON","BREST","CAEN","NIMES","ALBI","LOIRE","RHONE","GARONNE","RHIN","MEUSE","NIL","DANUBE","VOLGA","VOSGES","PYRENEES","ETNA","VESUVE","MONTBLANC","ITALIE","ESPAGNE","ALLEMAGNE","BELGIQUE","PORTUGAL","GRECE","NORVEGE","FINLANDE","POLOGNE","RUSSIE","EGYPTE","MAROC","TUNISIE","ALGERIE","SENEGAL","PEROU","MEXIQUE","IRLANDE","AFRIQUE","EUROPE","AMERIQUE","OCEANIE","SICILE","BRETAGNE","ALSACE","NORMANDIE","PROVENCE","AUVERGNE","SAVOIE","JUPITER"]);
lignes.forEach((l, i) => {
  const [mot, ...r] = l.split("|"); const indice = r.join("|");
  if (!/^[A-Z]{3,12}$/.test(mot)) pb.push(`ligne ${i + 1}: mot invalide « ${mot} »`);
  if (vus.has(mot)) pb.push(`ligne ${i + 1}: doublon de ${mot} (ligne ${vus.get(mot)})`); else vus.set(mot, i + 1);
  if (!dico.has(mot) && !NOMS_PROPRES.has(mot)) pb.push(`ligne ${i + 1}: ${mot} absent du dictionnaire`);
  if (!indice || indice.length > 46) pb.push(`ligne ${i + 1}: indice vide ou trop long (${indice.length}) pour ${mot}`);
  const mots = norm(indice).replace(/[^A-Z ]/g, " ").split(/\s+/);
  const racine = mot.length >= 6 ? mot.slice(0, mot.length - 2) : mot.length >= 4 ? mot.slice(0, mot.length - 1) : mot;
  if (mots.some((m) => m === mot || (m.length >= 4 && m.startsWith(racine) && racine.length >= 4))) pb.push(`ligne ${i + 1}: l'indice de ${mot} contient la réponse : « ${indice} »`);
});
console.log(lignes.length, "entrées,", pb.length, "problème(s)");
console.log(pb.join("\n"));
const parLong = {}; for (const m of vus.keys()) parLong[m.length] = (parLong[m.length] || 0) + 1;
console.log("par longueur :", JSON.stringify(parLong));
