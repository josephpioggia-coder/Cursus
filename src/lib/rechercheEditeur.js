/**
 * CURSUS — Rechercher / remplacer dans l'éditeur TipTap (28/10/2026).
 * `RechercheDansTexte` : extension qui surligne les occurrences (jaune, la courante en orange) sans toucher au document.
 * Les occurrences sont cherchées dans chaque BLOC de texte (paragraphe, titre…) : jamais d'occurrence à cheval sur deux blocs.
 * Un élément qui n'est pas du texte (note, tabulation, image) compte pour un séparateur : on ne trouve donc pas « à travers » lui.
 */
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection, NodeSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { trouver, remplacerTout } from "./rechercheTexte.js";

export const cleRecherche = new PluginKey("rechercheDansTexte");
const SEPARATEUR = "￼";

/** → [{ from, to }] positions dans le document ProseMirror. */
export function occurrencesDansDoc(doc, requete, options = {}) {
  const res = [];
  if (!requete) return res;
  doc.descendants((noeud, pos) => {
    if (!noeud.isTextblock) return true;
    let texte = ""; const positions = [];
    noeud.forEach((enfant, decalage) => {
      const debut = pos + 1 + decalage;
      if (enfant.isText) { for (let i = 0; i < enfant.text.length; i++) positions.push(debut + i); texte += enfant.text; }
      else {
        positions.push(debut); texte += (enfant.type.name === "hardBreak" ? "\n" : SEPARATEUR);
        // Note de bas de page : son texte vit dans l'attribut `texte` ; une note = une occurrence (tous ses « chat » remplacés d'un coup)
        if (enfant.type.name === "note" && trouver(enfant.attrs.texte || "", requete, options).length) res.push({ from: debut, to: debut + enfant.nodeSize, note: true });
      }
    });
    for (const o of trouver(texte, requete, options)) res.push({ from: positions[o.debut], to: positions[o.fin - 1] + 1 });
    return false;
  });
  return res.sort((a, b) => a.from - b.from);
}

export const RechercheDansTexte = Extension.create({
  name: "rechercheDansTexte",
  addProseMirrorPlugins() {
    return [new Plugin({
      key: cleRecherche,
      state: {
        init: () => ({ requete: "", options: {}, occurrences: [], courant: -1, deco: DecorationSet.empty }),
        apply(tr, ancien) {
          const meta = tr.getMeta(cleRecherche);
          if (!meta && !tr.docChanged) return ancien;
          const requete = meta ? meta.requete : ancien.requete;
          const options = meta ? meta.options : ancien.options;
          const occurrences = occurrencesDansDoc(tr.doc, requete, options);
          let courant = meta?.courant ?? ancien.courant;
          if (!occurrences.length) courant = -1;
          else if (courant < 0 || courant >= occurrences.length) courant = Math.min(Math.max(courant, 0), occurrences.length - 1);
          const deco = DecorationSet.create(tr.doc, occurrences.map((o, i) => { const attrs = { class: i === courant ? "recherche-occ recherche-occ-courante" : "recherche-occ" }; return o.note ? Decoration.node(o.from, o.to, attrs) : Decoration.inline(o.from, o.to, attrs); }));
          return { requete, options, occurrences, courant, deco };
        },
      },
      props: { decorations: (state) => cleRecherche.getState(state)?.deco || DecorationSet.empty },
    })];
  },
});

export const etatRecherche = (editor) => (editor ? cleRecherche.getState(editor.state) : null);

/** Met à jour requête / options / occurrence courante (aucune modification du texte). */
export function majRecherche(editor, requete, options, courant = 0) {
  if (!editor) return;
  editor.view.dispatch(editor.state.tr.setMeta(cleRecherche, { requete, options, courant }));
}

/** Sélectionne l'occurrence `i` et la fait apparaître à l'écran, sans voler le focus du champ de recherche. */
export function allerA(editor, i) {
  const e = etatRecherche(editor);
  if (!e || !e.occurrences.length) return;
  const n = e.occurrences.length;
  const idx = ((i % n) + n) % n;
  majRecherche(editor, e.requete, e.options, idx);
  const o = etatRecherche(editor).occurrences[idx];
  const sel = o.note ? NodeSelection.create(editor.state.doc, o.from) : TextSelection.create(editor.state.doc, o.from, o.to);
  const tr = editor.state.tr.setSelection(sel).scrollIntoView();
  editor.view.dispatch(tr);
  return idx;
}

/** Applique un remplacement à UNE occurrence (texte ou note) dans la transaction `tr`. */
function appliquer(tr, o, remplacement, e) {
  if (o.note) {
    const noeud = tr.doc.nodeAt(o.from);
    if (noeud) tr.setNodeMarkup(o.from, undefined, { ...noeud.attrs, texte: remplacerTout(noeud.attrs.texte || "", e.requete, remplacement, e.options).texte });
  } else tr.insertText(remplacement, o.from, o.to);
}

/** Remplace l'occurrence `i` → nouvelle occurrence courante. Les marques (gras, italique) du texte remplacé sont conservées. */
export function remplacerUne(editor, i, remplacement) {
  const e = etatRecherche(editor);
  if (!e || !e.occurrences[i]) return 0;
  const o = e.occurrences[i];
  const tr = editor.state.tr;
  appliquer(tr, o, remplacement, e);
  editor.view.dispatch(tr);
  return 1;
}

/** Remplace TOUTES les occurrences du chapitre en une transaction (un Ctrl+Z annule tout) → nombre remplacé. */
export function remplacerToutes(editor, remplacement) {
  const e = etatRecherche(editor);
  if (!e || !e.occurrences.length) return 0;
  const tr = editor.state.tr;
  [...e.occurrences].sort((a, b) => b.from - a.from).forEach((o) => appliquer(tr, o, remplacement, e));
  editor.view.dispatch(tr);
  return e.occurrences.length;
}
