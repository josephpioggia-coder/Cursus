// En-têtes, pieds de page et numéros de page (31/10/2026) — réglages PAR PROJET, enregistrés dans la ligne
// `styles_projet` (clé `entetes`), appliqués à l'EXPORT Word (Cursus n'a pas de pagination réelle à l'écran).
// Rien de réglé = export inchangé (une seule section, aucun en-tête ni pied de page).

export const POSITIONS_NUMERO = [
  { v: "aucun", label: "Aucun numéro" },
  { v: "bas-centre", label: "En bas, au centre" },
  { v: "bas-droite", label: "En bas, à droite" },
  { v: "bas-gauche", label: "En bas, à gauche" },
  { v: "haut-droite", label: "En haut, à droite" },
  { v: "haut-centre", label: "En haut, au centre" },
  { v: "haut-gauche", label: "En haut, à gauche" },
];

export const FORMATS_NUMERO = [
  { v: "n", label: "1", exemple: "12" },
  { v: "tirets", label: "– 1 –", exemple: "– 12 –" },
  { v: "page-n", label: "Page 1", exemple: "Page 12" },
  { v: "n-sur-N", label: "1 sur N", exemple: "12 sur 240" },
];

export const ZONES = ["gauche", "centre", "droite"];
export const VARIABLES = [
  { v: "{titre}", aide: "titre du livre" },
  { v: "{page}", aide: "numéro de la page" },
  { v: "{pages}", aide: "nombre total de pages du livre (hors page de titre et sommaire)" },
];

const POS = new Set(POSITIONS_NUMERO.map((p) => p.v));
const FMT = new Set(FORMATS_NUMERO.map((f) => f.v));
const texte = (t) => (typeof t === "string" ? t.replace(/[\r\n]+/g, " ").slice(0, 120).trim() : "");

/** Ne garde que les réglages valides ET différents de « rien » ; objet vide = pas d'en-têtes à l'export. */
export function nettoyerEntetes(brut) {
  const sortie = {};
  if (!brut || typeof brut !== "object") return sortie;
  const position = POS.has(brut.position) ? brut.position : "aucun";
  if (position !== "aucun") {
    sortie.position = position;
    if (FMT.has(brut.format) && brut.format !== "n") sortie.format = brut.format;
  }
  for (const bloc of ["entete", "pied"]) {
    const b = brut[bloc];
    if (!b || typeof b !== "object") continue;
    const o = {};
    for (const z of ZONES) { const t = texte(b[z]); if (t) o[z] = t; }
    if (Object.keys(o).length) sortie[bloc] = o;
  }
  return sortie;
}

/** Coupe un texte en morceaux : { t: "texte" } ou { v: "titre" | "page" | "pages" }. */
export function decouperTexte(t) {
  const out = [];
  String(t || "").split(/(\{titre\}|\{pages\}|\{page\})/).forEach((m) => {
    if (!m) return;
    if (m === "{titre}") out.push({ v: "titre" });
    else if (m === "{page}") out.push({ v: "page" });
    else if (m === "{pages}") out.push({ v: "pages" });
    else out.push({ t: m });
  });
  return out;
}

/** Le numéro de page rendu comme un texte-modèle (pour l'aperçu) : « Page 12 », « 12 sur 240 »… */
export function modeleNumero(format) {
  const f = FORMATS_NUMERO.find((x) => x.v === (format || "n")) || FORMATS_NUMERO[0];
  return f.exemple;
}

/** Composition des 6 zones (en-tête / pied × gauche / centre / droite) : textes saisis + numéro à sa position. */
export function composerZones(entetes) {
  const e = nettoyerEntetes(entetes);
  const zones = { entete: { gauche: [], centre: [], droite: [] }, pied: { gauche: [], centre: [], droite: [] } };
  for (const bloc of ["entete", "pied"]) for (const z of ZONES) zones[bloc][z] = decouperTexte(e[bloc]?.[z]);
  if (e.position) {
    const [lieu, zone] = e.position.split("-");
    const cible = zones[lieu === "haut" ? "entete" : "pied"][{ gauche: "gauche", centre: "centre", droite: "droite" }[zone]];
    if (cible.length) cible.push({ t: "  " });
    const f = e.format || "n";
    if (f === "tirets") cible.push({ t: "– " }, { v: "page" }, { t: " –" });
    else if (f === "page-n") cible.push({ t: "Page " }, { v: "page" });
    else if (f === "n-sur-N") cible.push({ v: "page" }, { t: " sur " }, { v: "pages" });
    else cible.push({ v: "page" });
  }
  const aDuContenu = (bloc) => ZONES.some((z) => zones[bloc][z].length);
  return { zones, entete: aDuContenu("entete"), pied: aDuContenu("pied") };
}
