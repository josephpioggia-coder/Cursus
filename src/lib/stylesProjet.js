/**
 * CURSUS — Styles modifiables du projet, à la façon des « Styles » de Word (28/10/2026)
 * ======================================================================
 * Demande de Joseph : changer UNE FOIS la police / taille / interligne de « Normal » ou de « Titre 1 »
 * pour tout le livre, comme dans la galerie Styles de Word (et au lieu de formater paragraphe par
 * paragraphe). Un style = un jeu de propriétés ; seules les propriétés CHANGÉES par l'auteur·ice sont
 * enregistrées (objet « creux ») : tant qu'aucune n'est modifiée, l'éditeur et l'export Word restent
 * exactement comme avant.
 *
 *   { normal: { police, taille, interligne, apres }, h1: { couleur }, … }
 *
 * Application : dans l'éditeur par une feuille de style générée (cssDesStyles) ; à l'export Word par
 * les styles du document (stylesPourDocx) et par les propriétés des paragraphes (voir exportWord.js).
 * La mise en forme DIRECTE (police, taille ou interligne posés sur un passage) l'emporte toujours sur le
 * style, comme dans Word.
 */
import { POLICES, premierePolice } from "./miseEnFormeEditeur.js";

/** Les styles proposés. `export` = pas d'équivalent dans l'éditeur (titres de la structure), effet à l'export Word seulement. */
export const STYLES_PROJET = [
  { id: "normal", label: "Normal", aide: "Le texte courant : paragraphes, listes." },
  { id: "h1", label: "Titre 1", aide: "Titre de premier niveau dans un chapitre." },
  { id: "h2", label: "Titre 2" },
  { id: "h3", label: "Titre 3" },
  { id: "h4", label: "Titre 4" },
  { id: "h5", label: "Titre 5" },
  { id: "h6", label: "Titre 6" },
  { id: "quote", label: "Citation", aide: "Passages cités." },
  { id: "partie", label: "Titre de partie", export: true, aide: "Titre d'une Partie de la structure — appliqué à l'export Word." },
  { id: "chapitre", label: "Titre de chapitre", export: true, aide: "Titre d'un chapitre de la structure — appliqué à l'export Word." },
  { id: "scene", label: "Titre de scène", export: true, aide: "Titre d'une scène ou d'une section — appliqué à l'export Word." },
];

export const ALIGNEMENTS = [
  { v: "left", label: "À gauche" },
  { v: "center", label: "Centré" },
  { v: "right", label: "À droite" },
  { v: "justify", label: "Justifié" },
];

/** Valeurs AFFICHÉES quand rien n'a été modifié (elles reproduisent l'aspect actuel de l'éditeur). */
const base = { police: POLICES[0].valeur, couleur: "#1A1A1A", gras: false, italique: false, alignement: "left", alinea: 0 };
export const DEFAUTS = {
  normal: { ...base, taille: 12, interligne: 1.8, avant: 0, apres: 12 },
  h1: { ...base, taille: 19, interligne: 1.3, avant: 20, apres: 7 },
  h2: { ...base, taille: 16, interligne: 1.3, avant: 14, apres: 5 },
  h3: { ...base, taille: 13, interligne: 1.3, avant: 10, apres: 3 },
  h4: { ...base, taille: 12, interligne: 1.3, avant: 11, apres: 4, gras: true },
  h5: { ...base, taille: 11, interligne: 1.3, avant: 9, apres: 3, gras: true },
  h6: { ...base, taille: 11, interligne: 1.3, avant: 9, apres: 3, gras: true, italique: true, couleur: "#666666" },
  quote: { ...base, taille: 12, interligne: 1.8, avant: 14, apres: 14, italique: true, couleur: "#555555" },
  partie: { ...base, taille: 16, interligne: 1.15, avant: 24, apres: 6, gras: true, couleur: "#000000" },
  chapitre: { ...base, taille: 13, interligne: 1.15, avant: 12, apres: 0, gras: true, couleur: "#000000" },
  scene: { ...base, taille: 12, interligne: 1.15, avant: 10, apres: 0, gras: true, couleur: "#000000" },
};

const IDS = new Set(STYLES_PROJET.map((s) => s.id));
const PILES_AUTORISEES = new Set(POLICES.map((p) => p.valeur));
const nombre = (v, min, max) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : undefined; };

/** Valide et nettoie un objet de styles (tout ce qui est inconnu, hors bornes, ou égal au défaut est retiré). */
export function nettoyerStyles(brut) {
  const sortie = {};
  if (!brut || typeof brut !== "object") return sortie;
  for (const id of Object.keys(brut)) {
    if (!IDS.has(id) || !brut[id] || typeof brut[id] !== "object") continue;
    const b = brut[id], d = DEFAUTS[id], o = {};
    if (typeof b.police === "string" && PILES_AUTORISEES.has(b.police)) o.police = b.police;
    const taille = nombre(b.taille, 6, 96); if (taille !== undefined) o.taille = taille;
    if (typeof b.couleur === "string" && /^#[0-9a-f]{6}$/i.test(b.couleur)) o.couleur = b.couleur.toUpperCase();
    if (typeof b.gras === "boolean") o.gras = b.gras;
    if (typeof b.italique === "boolean") o.italique = b.italique;
    if (ALIGNEMENTS.some((a) => a.v === b.alignement)) o.alignement = b.alignement;
    const interligne = nombre(b.interligne, 0.8, 4); if (interligne !== undefined) o.interligne = interligne;
    const avant = nombre(b.avant, 0, 120); if (avant !== undefined) o.avant = avant;
    const apres = nombre(b.apres, 0, 120); if (apres !== undefined) o.apres = apres;
    const alinea = nombre(b.alinea, 0, 5); if (alinea !== undefined) o.alinea = alinea;
    for (const k of Object.keys(o)) if (String(o[k]).toUpperCase() === String(d[k]).toUpperCase()) delete o[k];
    if (Object.keys(o).length) sortie[id] = o;
  }
  return sortie;
}

/** Valeur effective d'une propriété : celle modifiée, sinon le défaut affiché. */
export const valeurStyle = (styles, id, champ) => (styles?.[id]?.[champ] ?? DEFAUTS[id][champ]);

// ─── Dans l'éditeur : feuille de style générée ───────────────────────────

const pt = (n) => `${n}pt`;

/** CSS des seules propriétés modifiées (chaîne vide si rien n'a été modifié). Sélecteurs de même poids que ceux de l'éditeur, injectés APRÈS. */
export function cssDesStyles(styles) {
  const s = nettoyerStyles(styles);
  const regles = [];
  const decl = (o, { racine = false } = {}) => {
    const d = [];
    if (o.police) d.push(`font-family: ${o.police}`);
    if (o.taille !== undefined) d.push(`font-size: ${pt(o.taille)}`);
    if (o.couleur) d.push(`color: ${o.couleur}`);
    if (o.gras !== undefined) d.push(`font-weight: ${o.gras ? 700 : 400}`);
    if (o.italique !== undefined) d.push(`font-style: ${o.italique ? "italic" : "normal"}`);
    if (o.interligne !== undefined) d.push(`line-height: ${o.interligne}`);
    if (o.alignement && !racine) d.push(`text-align: ${o.alignement}`);
    return d;
  };
  if (s.normal) {
    const racine = decl(s.normal, { racine: true }).filter((x) => !/^font-(weight|style)/.test(x));
    if (racine.length) regles.push(`.ProseMirror { ${racine.join("; ")}; }`);
    const p = [];
    if (s.normal.avant !== undefined) p.push(`margin-top: ${pt(s.normal.avant)}`);
    if (s.normal.apres !== undefined) p.push(`margin-bottom: ${pt(s.normal.apres)}`);
    if (s.normal.alignement) p.push(`text-align: ${s.normal.alignement}`);
    if (s.normal.gras !== undefined) p.push(`font-weight: ${s.normal.gras ? 700 : 400}`);
    if (s.normal.italique !== undefined) p.push(`font-style: ${s.normal.italique ? "italic" : "normal"}`);
    if (p.length) regles.push(`.ProseMirror p { ${p.join("; ")}; }`);
    if (s.normal.alinea) regles.push(`.ProseMirror > p { text-indent: ${s.normal.alinea}cm; }`);
  }
  for (const n of [1, 2, 3, 4, 5, 6]) {
    const o = s[`h${n}`];
    if (!o) continue;
    const d = decl(o);
    if (o.avant !== undefined) d.push(`margin-top: ${pt(o.avant)}`);
    if (o.apres !== undefined) d.push(`margin-bottom: ${pt(o.apres)}`);
    if (d.length) regles.push(`.ProseMirror h${n} { ${d.join("; ")}; }`);
  }
  if (s.quote) {
    const d = decl(s.quote);
    if (s.quote.avant !== undefined) d.push(`margin-top: ${pt(s.quote.avant)}`);
    if (s.quote.apres !== undefined) d.push(`margin-bottom: ${pt(s.quote.apres)}`);
    if (d.length) regles.push(`.ProseMirror blockquote { ${d.join("; ")}; }`);
  }
  return regles.join("\n");
}

// ─── À l'export Word ─────────────────────────────────────────────────────

const demiPoints = (taille) => Math.round(taille * 2);
const twips = (points) => Math.round(points * 20);

/** Propriétés de caractère d'un style au format TextRun de docx (champs absents = non modifiés). */
export function runDepuisStyle(o) {
  if (!o) return {};
  const r = {};
  if (o.police) r.font = premierePolice(o.police);
  if (o.taille !== undefined) r.size = demiPoints(o.taille);
  if (o.couleur) r.color = o.couleur.replace("#", "");
  if (o.gras !== undefined) r.bold = o.gras;
  if (o.italique !== undefined) r.italics = o.italique;
  return r;
}

const ALIGNEMENT_DOCX = { center: "center", right: "right", justify: "both", left: "left" };

/** Propriétés de paragraphe d'un style (espacement, interligne, alignement, alinéa) au format docx. */
export function paragrapheDepuisStyle(o) {
  if (!o) return {};
  const p = {};
  const spacing = {};
  if (o.avant !== undefined) spacing.before = twips(o.avant);
  if (o.apres !== undefined) spacing.after = twips(o.apres);
  if (o.interligne !== undefined) { spacing.line = Math.round(o.interligne * 240); spacing.lineRule = "auto"; }
  if (Object.keys(spacing).length) p.spacing = spacing;
  if (o.alignement) p.alignment = ALIGNEMENT_DOCX[o.alignement];
  if (o.alinea) p.indent = { firstLine: Math.round(o.alinea * 567) };
  return p;
}

/**
 * Styles du document Word : « Normal » (police/taille/couleur par défaut du texte) et titres.
 * Correspondance : titres de la structure Partie/Chapitre/Scène → Heading 1/2/3 ; Titre 1/2/3 du texte →
 * Heading 4/5/6 (même choix que l'export d'origine). Titre 4 à 6 du texte et Citation ne sont pas des
 * styles Word : leurs propriétés sont appliquées aux paragraphes eux-mêmes (voir exportWord.js).
 */
export function stylesPourDocx(styles) {
  const s = nettoyerStyles(styles);
  const sortie = {};
  if (s.normal) {
    const run = runDepuisStyle(s.normal);
    delete run.bold; delete run.italics;
    if (Object.keys(run).length) sortie.document = { run };
  }
  const cartes = { partie: "heading1", chapitre: "heading2", scene: "heading3", h1: "heading4", h2: "heading5", h3: "heading6" };
  for (const [id, cle] of Object.entries(cartes)) {
    if (!s[id]) continue;
    const run = runDepuisStyle(s[id]);
    const paragraph = paragrapheDepuisStyle(s[id]);
    sortie[cle] = {};
    if (Object.keys(run).length) sortie[cle].run = run;
    if (Object.keys(paragraph).length) sortie[cle].paragraph = paragraph;
  }
  return sortie;
}
