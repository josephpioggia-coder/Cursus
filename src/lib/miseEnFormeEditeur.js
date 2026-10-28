/**
 * CURSUS — Mise en forme « à la Word » de l'éditeur (28/10/2026)
 * ======================================================================
 * Demande de Joseph (capture du ruban Word) : « je ne vois que les titres, pas de niveau Normal ;
 * aucune variante pour les caractères utilisés » → police, taille, indice/exposant, interligne,
 * retrait, changement de casse, effacement de la mise en forme, style de paragraphe (Normal / Titres).
 *
 * Extensions TipTap écrites ici plutôt qu'importées (aucune nouvelle dépendance) :
 *  - PoliceEtTaille : attributs `fontFamily` et `fontSize` portés par la marque `textStyle`
 *    (la même que la couleur du texte) → rendu `<span style="font-family:…; font-size:…pt">`.
 *  - Indice / Exposant : marques `<sub>` / `<sup>` (exclusives l'une de l'autre).
 *  - MiseEnFormeParagraphe : attributs `lineHeight` (interligne) et `indent` (retrait, en pas de
 *    1,27 cm comme Word) sur les paragraphes et les titres.
 * Tout est stocké dans le HTML du chapitre ; l'export Word (exportWord.js) relit ces mêmes styles.
 */
import { Extension, Mark } from "@tiptap/core";

// ─── Listes proposées ─────────────────────────────────────────────────────

/** `valeur` = pile CSS stockée dans le texte ; la PREMIÈRE famille sert de nom de police à l'export Word. */
export const POLICES = [
  { nom: "Georgia", valeur: "Georgia, 'Times New Roman', serif" },
  { nom: "Times New Roman", valeur: "'Times New Roman', Times, serif" },
  { nom: "Garamond", valeur: "Garamond, 'Times New Roman', serif" },
  { nom: "Palatino Linotype", valeur: "'Palatino Linotype', Palatino, 'Book Antiqua', serif" },
  { nom: "Cambria", valeur: "Cambria, Georgia, serif" },
  { nom: "Arial", valeur: "Arial, Helvetica, sans-serif" },
  { nom: "Calibri", valeur: "Calibri, Carlito, Arial, sans-serif" },
  { nom: "Verdana", valeur: "Verdana, Geneva, sans-serif" },
  { nom: "Trebuchet MS", valeur: "'Trebuchet MS', Helvetica, sans-serif" },
  { nom: "Courier New", valeur: "'Courier New', Courier, monospace" },
];

/** Tailles en points (liste de Word, simplifiée). 12 pt ≈ 16 px = taille par défaut de l'éditeur. */
export const TAILLES_PT = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
export const TAILLE_DEFAUT_PT = 12;

/** Interlignes de Word. */
export const INTERLIGNES = ["1", "1.15", "1.5", "2", "2.5", "3"];

/** Un « cran » de retrait = 1,27 cm (0,5 pouce), comme Word. */
export const PAS_RETRAIT_CM = 1.27;
export const RETRAIT_MAX = 8;

/** Nom de police à partir d'une pile CSS (« 'Times New Roman', Times, serif » → « Times New Roman »). */
export function premierePolice(pileCss) {
  if (!pileCss) return null;
  return String(pileCss).split(",")[0].trim().replace(/^['"]|['"]$/g, "") || null;
}

/** « 14pt » → 14 ; « 18px » → 13.5 ; autre → null. */
export function taillePtDepuisCss(valeur) {
  const m = /^\s*([\d.]+)\s*(pt|px)\s*$/i.exec(String(valeur || ""));
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2].toLowerCase() === "px" ? Math.round(n * 0.75 * 10) / 10 : n;
}

/** Taille immédiatement supérieure / inférieure dans la liste (A+ / A−). */
export function tailleVoisine(courantePt, sens) {
  const base = courantePt || TAILLE_DEFAUT_PT;
  if (sens > 0) return TAILLES_PT.find((t) => t > base) ?? TAILLES_PT[TAILLES_PT.length - 1];
  return [...TAILLES_PT].reverse().find((t) => t < base) ?? TAILLES_PT[0];
}

// ─── Extensions ───────────────────────────────────────────────────────────

export const PoliceEtTaille = Extension.create({
  name: "policeEtTaille",
  addGlobalAttributes() {
    return [{
      types: ["textStyle"],
      attributes: {
        fontFamily: {
          default: null,
          parseHTML: (el) => el.style.fontFamily || null,
          renderHTML: (a) => (a.fontFamily ? { style: `font-family: ${a.fontFamily}` } : {}),
        },
        fontSize: {
          default: null,
          parseHTML: (el) => el.style.fontSize || null,
          renderHTML: (a) => (a.fontSize ? { style: `font-size: ${a.fontSize}` } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontFamily: (valeur) => ({ chain }) => chain().setMark("textStyle", { fontFamily: valeur }).run(),
      unsetFontFamily: () => ({ chain }) => chain().setMark("textStyle", { fontFamily: null }).removeEmptyTextStyle().run(),
      setFontSize: (valeur) => ({ chain }) => chain().setMark("textStyle", { fontSize: valeur }).run(),
      unsetFontSize: () => ({ chain }) => chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

export const Indice = Mark.create({
  name: "subscript",
  excludes: "superscript",
  parseHTML() {
    return [{ tag: "sub" }, { style: "vertical-align", getAttrs: (v) => (v === "sub" ? null : false) }];
  },
  renderHTML({ HTMLAttributes }) { return ["sub", HTMLAttributes, 0]; },
  addCommands() {
    return { toggleSubscript: () => ({ commands }) => commands.toggleMark(this.name) };
  },
});

export const Exposant = Mark.create({
  name: "superscript",
  excludes: "subscript",
  parseHTML() {
    return [{ tag: "sup" }, { style: "vertical-align", getAttrs: (v) => (v === "super" ? null : false) }];
  },
  renderHTML({ HTMLAttributes }) { return ["sup", HTMLAttributes, 0]; },
  addCommands() {
    return { toggleSuperscript: () => ({ commands }) => commands.toggleMark(this.name) };
  },
});

const BLOCS_FORMATABLES = ["paragraph", "heading"];

export const MiseEnFormeParagraphe = Extension.create({
  name: "miseEnFormeParagraphe",
  addGlobalAttributes() {
    return [{
      types: BLOCS_FORMATABLES,
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: (el) => el.style.lineHeight || null,
          renderHTML: (a) => (a.lineHeight ? { style: `line-height: ${a.lineHeight}` } : {}),
        },
        indent: {
          default: 0,
          parseHTML: (el) => {
            const cm = /^\s*([\d.]+)\s*cm\s*$/i.exec(el.style.marginLeft || "");
            return cm ? Math.min(RETRAIT_MAX, Math.max(0, Math.round(parseFloat(cm[1]) / PAS_RETRAIT_CM))) : 0;
          },
          renderHTML: (a) => (a.indent ? { style: `margin-left: ${Math.round(a.indent * PAS_RETRAIT_CM * 100) / 100}cm` } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      setLineHeight: (valeur) => ({ commands }) => BLOCS_FORMATABLES.map((t) => commands.updateAttributes(t, { lineHeight: valeur })).some(Boolean),
      unsetLineHeight: () => ({ commands }) => BLOCS_FORMATABLES.map((t) => commands.updateAttributes(t, { lineHeight: null })).some(Boolean),
      /** delta = +1 (augmenter le retrait) ou −1 (le diminuer), sur tous les blocs de la sélection. */
      changerRetrait: (delta) => ({ state, tr, dispatch }) => {
        const { from, to } = state.selection;
        let modifie = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!BLOCS_FORMATABLES.includes(node.type.name)) return;
          const actuel = node.attrs.indent || 0;
          const suivant = Math.min(RETRAIT_MAX, Math.max(0, actuel + delta));
          if (suivant !== actuel) { tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: suivant }); modifie = true; }
        });
        if (modifie && dispatch) dispatch(tr);
        return modifie;
      },
    };
  },
});

// ─── Changement de casse (sur la sélection) ───────────────────────────────

const LETTRE = /\p{L}/u;

/**
 * mode : "maj" (MAJUSCULES) · "min" (minuscules) · "mots" (Première Lettre De Chaque Mot) ·
 * "phrase" (Majuscule en début de phrase). `avant` = texte du bloc qui précède le segment
 * (pour savoir si le segment commence un mot ou une phrase).
 */
export function transformerCasse(texte, mode, avant = "") {
  if (mode === "maj") return texte.toLocaleUpperCase("fr");
  if (mode === "min") return texte.toLocaleLowerCase("fr");
  const bas = texte.toLocaleLowerCase("fr");
  let sortie = "";
  let precedent = avant.slice(-1);
  let debutPhrase = avant.trim() === "" || /[.!?…]\s*$/.test(avant);
  for (const c of bas) {
    let r = c;
    if (LETTRE.test(c)) {
      if (mode === "mots" && (!precedent || !(LETTRE.test(precedent) || precedent === "'" || precedent === "’"))) r = c.toLocaleUpperCase("fr");
      if (mode === "phrase" && debutPhrase) r = c.toLocaleUpperCase("fr");
      debutPhrase = false;
    } else if (/[.!?…]/.test(c)) {
      debutPhrase = true;
    }
    sortie += r;
    precedent = c;
  }
  return sortie;
}

/** Applique le changement de casse à la sélection (sans effet si rien n'est sélectionné). Renvoie true si le texte a changé. */
export function changerCasse(editor, mode) {
  const { state, view } = editor;
  const { from, to, empty } = state.selection;
  if (empty) return false;
  const tr = state.tr;
  let modifie = false;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return;
    const debut = Math.max(from, pos);
    const fin = Math.min(to, pos + node.nodeSize);
    const segment = node.text.slice(debut - pos, fin - pos);
    const $d = state.doc.resolve(debut);
    const avant = $d.parent.textBetween(0, $d.parentOffset, "\n", " ");
    const nouveau = transformerCasse(segment, mode, avant);
    if (nouveau === segment) return;
    tr.replaceWith(tr.mapping.map(debut), tr.mapping.map(fin), state.schema.text(nouveau, node.marks));
    modifie = true;
  });
  if (modifie) view.dispatch(tr);
  return modifie;
}
