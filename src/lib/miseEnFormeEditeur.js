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
import { Extension, Mark, Node as NoeudTiptap } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

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
            return cm ? Math.min(RETRAIT_MAX, Math.max(0, Math.round(parseFloat(cm[1]) / PAS_RETRAIT_CM * 1000) / 1000)) : 0; // décimal : la règle règle au mm
          },
          renderHTML: (a) => (a.indent ? { style: `margin-left: ${Math.round(a.indent * PAS_RETRAIT_CM * 100) / 100}cm` } : {}),
        },
        // Retrait de PREMIÈRE LIGNE du paragraphe (cm), réglé avec le triangle de la règle ; null = celui du style « Normal ».
        firstLine: {
          default: null,
          parseHTML: (el) => {
            const cm = /^\s*(-?[\d.]+)\s*cm\s*$/i.exec(el.style.textIndent || "");
            return cm ? Math.min(8, Math.max(-8, parseFloat(cm[1]))) : null; // négatif = retrait suspendu
          },
          renderHTML: (a) => (a.firstLine != null ? { style: `text-indent: ${a.firstLine}cm` } : {}),
        },
        // Retrait DROIT du paragraphe (cm), triangle de droite de la règle.
        indentRight: {
          default: 0,
          parseHTML: (el) => { const cm = /^\s*([\d.]+)\s*cm\s*$/i.exec(el.style.marginRight || ""); return cm ? Math.min(10, parseFloat(cm[1])) : 0; },
          renderHTML: (a) => (a.indentRight ? { style: `margin-right: ${a.indentRight}cm` } : {}),
        },
        // Taquets de tabulation du paragraphe : [{ pos (cm depuis la marge gauche), type: "l"|"c"|"r"|"d" }] ; stockés « 1.5l,10r ».
        tabs: {
          default: null,
          parseHTML: (el) => lireTaquets(el.getAttribute("data-tabs")),
          renderHTML: (a) => (a.tabs && a.tabs.length ? { "data-tabs": a.tabs.map((t) => `${t.pos}${t.type}`).join(",") } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      setLineHeight: (valeur) => ({ commands }) => BLOCS_FORMATABLES.map((t) => commands.updateAttributes(t, { lineHeight: valeur })).some(Boolean),
      unsetLineHeight: () => ({ commands }) => BLOCS_FORMATABLES.map((t) => commands.updateAttributes(t, { lineHeight: null })).some(Boolean),
      /**
       * Règle (retraits et taquets) : applique aux blocs de la sélection { gauche (cm), premiere (cm, négatif = suspendu),
       * droite (cm), tabs ([{pos,type}] ou null) } ; seules les clés fournies changent.
       */
      setMiseEnFormeBloc: (c) => ({ state, tr, dispatch }) => {
        const { from, to } = state.selection;
        let modifie = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!BLOCS_FORMATABLES.includes(node.type.name)) return;
          const attrs = { ...node.attrs };
          if (c.gauche !== undefined) attrs.indent = Math.min(RETRAIT_MAX, Math.max(0, Math.round(c.gauche / PAS_RETRAIT_CM * 1000) / 1000));
          if (c.premiere !== undefined) attrs.firstLine = c.premiere;
          if (c.droite !== undefined) attrs.indentRight = Math.max(0, Math.round(c.droite * 10) / 10);
          if (c.tabs !== undefined) attrs.tabs = c.tabs && c.tabs.length ? c.tabs : null;
          if (JSON.stringify(attrs) !== JSON.stringify(node.attrs)) { tr.setNodeMarkup(pos, undefined, attrs); modifie = true; }
        });
        if (modifie && dispatch) dispatch(tr);
        return modifie;
      },
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

/** « 1.5l,10r » → [{ pos: 1.5, type: "l" }, { pos: 10, type: "r" }] (trié, valeurs valides seulement). */
export function lireTaquets(brut) {
  if (!brut) return null;
  const liste = String(brut).split(",").map((x) => /^\s*([\d.]+)([lcrd])\s*$/.exec(x)).filter(Boolean)
    .map((m) => ({ pos: Math.round(parseFloat(m[1]) * 10) / 10, type: m[2] })).filter((t) => t.pos > 0 && t.pos < 40);
  return liste.length ? liste.sort((a, b) => a.pos - b.pos) : null;
}

// ─── Tabulations (touche Tab) alignées sur les taquets de la règle ─────────

const PX_CM = 96 / 2.54;
const TAQUET_DEFAUT_CM = 1.27;

/** Largeur (px) du contenu qui suit `span` jusqu'à la prochaine tabulation ou la fin du bloc ; `jusquAuDecimal` : s'arrête au 1er « , » ou « . ». */
function largeurSuivante(span, jusquAuDecimal) {
  const bloc = span.parentElement;
  const range = document.createRange();
  let suivante = span.nextSibling;
  while (suivante && !(suivante.nodeType === 1 && suivante.hasAttribute("data-tab"))) suivante = suivante.nextSibling;
  range.setStartAfter(span);
  if (suivante) range.setEndBefore(suivante); else range.setEnd(bloc, bloc.childNodes.length);
  if (jusquAuDecimal) {
    const w = document.createTreeWalker(bloc, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (!(span.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      if (suivante && (suivante.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING)) break;
      const k = n.textContent.search(/[.,]/);
      if (k >= 0) { range.setEnd(n, k); break; }
    }
  }
  return range.getBoundingClientRect().width;
}

/** Fixe la largeur de chaque tabulation pour que le texte suivant tombe sur le taquet (gauche, centre, droit ou décimal). */
function disposerTabulations(view) {
  const racine = view.dom;
  const spans = racine.querySelectorAll("span[data-tab]");
  if (!spans.length) return;
  const origine = racine.getBoundingClientRect().left + parseFloat(getComputedStyle(racine).paddingLeft || "0");
  const blocs = new Map();
  spans.forEach((sp) => { const b = sp.parentElement; if (!blocs.has(b)) blocs.set(b, []); blocs.get(b).push(sp); });
  blocs.forEach((liste, bloc) => {
    const taquets = lireTaquets(bloc.getAttribute("data-tabs")) || [];
    liste.forEach((sp) => { sp.style.width = "0px"; });
    liste.forEach((sp) => {
      const x = sp.getBoundingClientRect().left - origine;
      let cible = taquets.find((t) => t.pos * PX_CM > x + 1);
      let largeur;
      if (!cible) {
        const prochain = (Math.floor((x + 1) / (TAQUET_DEFAUT_CM * PX_CM)) + 1) * TAQUET_DEFAUT_CM * PX_CM;
        largeur = prochain - x;
      } else {
        const stop = cible.pos * PX_CM;
        if (cible.type === "l") largeur = stop - x;
        else if (cible.type === "r") largeur = stop - x - largeurSuivante(sp, false);
        else if (cible.type === "c") largeur = stop - x - largeurSuivante(sp, false) / 2;
        else largeur = stop - x - largeurSuivante(sp, true);
      }
      sp.style.width = `${Math.max(1, Math.round(largeur * 10) / 10)}px`;
    });
  });
}

export const Tabulation = NoeudTiptap.create({
  name: "tabulation",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,
  parseHTML() { return [{ tag: "span[data-tab]" }, { tag: "span.cursus-tab" }]; },
  renderHTML() { return ["span", { "data-tab": "", class: "cursus-tab" }]; },
  renderText() { return "\t"; },
  addKeyboardShortcuts() {
    return {
      // Tab insère une tabulation dans le texte ; dans une liste, le comportement habituel (niveau) est laissé tel quel.
      Tab: ({ editor }) => {
        if (editor.isActive("bulletList") || editor.isActive("orderedList")) return false;
        return editor.commands.insertContent({ type: "tabulation" });
      },
    };
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      view(view) {
        let raf = 0;
        const planifier = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => disposerTabulations(view)); };
        const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(planifier) : null;
        ro?.observe(view.dom);
        planifier();
        return { update: planifier, destroy() { cancelAnimationFrame(raf); ro?.disconnect(); } };
      },
    })];
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
