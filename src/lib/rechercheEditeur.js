/**
 * CURSUS — Rechercher / remplacer dans l'éditeur TipTap (28/10/2026).
 * `RechercheDansTexte` : extension qui surligne les occurrences (jaune, la courante en orange) sans toucher au document.
 * Les occurrences sont cherchées dans chaque BLOC de texte (paragraphe, titre…) : jamais d'occurrence à cheval sur deux blocs.
 * Un élément qui n'est pas du texte (note, tabulation, image) compte pour un séparateur : on ne trouve donc pas « à travers » lui.
 */
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection, NodeSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { trouver, remplacerTout, developperRemplacement, NOTE } from "./rechercheTexte.js";

export const cleRecherche = new PluginKey("rechercheDansTexte");
const SEPARATEUR = "￼";

/** Filtres de mise en forme (03/11/2026) : clé → test sur les marques d'un passage de texte. */
export const FILTRES_FORMAT = {
  gras: ["Gras", (m) => m.some((x) => x.type.name === "bold")],
  italique: ["Italique", (m) => m.some((x) => x.type.name === "italic")],
  souligne: ["Souligné", (m) => m.some((x) => x.type.name === "underline")],
  barre: ["Barré", (m) => m.some((x) => x.type.name === "strike")],
  surligne: ["Surligné", (m) => m.some((x) => x.type.name === "highlight")],
  couleur: ["Couleur de texte", (m) => m.some((x) => x.type.name === "textStyle" && x.attrs.color)],
  police: ["Police", (m) => m.some((x) => x.type.name === "textStyle" && x.attrs.fontFamily)],
  taille: ["Taille", (m) => m.some((x) => x.type.name === "textStyle" && x.attrs.fontSize)],
  indice: ["Indice", (m) => m.some((x) => x.type.name === "subscript")],
  exposant: ["Exposant", (m) => m.some((x) => x.type.name === "superscript")],
};
export const filtresActifs = (options = {}) => Object.keys(FILTRES_FORMAT).filter((k) => options.format?.[k]);

/** → [{ from, to }] positions dans le document ProseMirror.
 *  Avec des filtres de mise en forme : seuls comptent les passages dont TOUS les caractères portent TOUTES les mises en forme demandées ;
 *  sans texte cherché, chaque suite continue de tels caractères est une occurrence. */
export function occurrencesDansDoc(doc, requete, options = {}) {
  const res = [];
  const filtres = filtresActifs(options).map((k) => FILTRES_FORMAT[k][1]);
  if (!requete && !filtres.length) return res;
  doc.descendants((noeud, pos) => {
    if (!noeud.isTextblock) return true;
    let texte = ""; const positions = []; const formes = [];
    noeud.forEach((enfant, decalage) => {
      const debut = pos + 1 + decalage;
      if (enfant.isText) {
        const ok = filtres.every((f) => f(enfant.marks));
        for (let i = 0; i < enfant.text.length; i++) { positions.push(debut + i); formes.push(ok); }
        texte += enfant.text;
      }
      else {
        // Texte « à plat » (jetons « ^t », « ^l », « ^f », « ^g » de rechercheTexte.js) : tabulation → \t, saut de ligne → \n, note → NOTE, autre → séparateur.
        positions.push(debut); formes.push(!filtres.length); texte += (enfant.type.name === "hardBreak" ? "\n" : enfant.type.name === "tabulation" ? "\t" : enfant.type.name === "note" ? NOTE : SEPARATEUR);
        // Note de bas de page : son texte vit dans l'attribut `texte` ; une note = une occurrence (tous ses « chat » remplacés d'un coup)
        if (!filtres.length && requete && enfant.type.name === "note" && trouver(enfant.attrs.texte || "", requete, options).length) res.push({ from: debut, to: debut + enfant.nodeSize, note: true });
      }
    });
    if (!requete) {
      // Mise en forme seule : suites continues de caractères conformes (une note / tabulation / image les interrompt)
      let i = 0;
      while (i < texte.length) {
        if (!formes[i]) { i++; continue; }
        let j = i; while (j < texte.length && formes[j] && positions[j] === positions[i] + (j - i)) j++;
        res.push({ from: positions[i], to: positions[j - 1] + 1 }); i = j;
      }
      return false;
    }
    for (const o of trouver(texte, requete, options)) {
      if (filtres.length && !formes.slice(o.debut, o.fin).every(Boolean)) continue;
      res.push({ from: positions[o.debut], to: positions[o.fin - 1] + 1 });
    }
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
  } else {
    const texte = developperRemplacement(remplacement, tr.doc.textBetween(o.from, o.to, "\n", SEPARATEUR));
    if (!/[\t\n]/.test(texte)) { tr.insertText(texte, o.from, o.to); return; }
    // Tabulation / saut de ligne dans le remplacement : ce sont des ÉLÉMENTS du document (pas du texte), on les insère comme tels.
    const { schema } = tr.doc.type; const marques = tr.doc.resolve(o.from).marks();
    const noeuds = [];
    texte.split(/(\t|\n)/).forEach((seg) => {
      if (seg === "\t" && schema.nodes.tabulation) noeuds.push(schema.nodes.tabulation.create());
      else if (seg === "\n" && schema.nodes.hardBreak) noeuds.push(schema.nodes.hardBreak.create());
      else if (seg) noeuds.push(schema.text(seg, marques));
    });
    tr.replaceWith(o.from, o.to, noeuds);
  }
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

// ─── « Atteindre » (02/11/2026) : aller à un paragraphe, une note, une image, un intertitre, un caractère du chapitre ───
// [singulier, pluriel, « Aucun/Aucune »]
export const TYPES_CIBLE = { paragraphe: ["paragraphe", "paragraphes", "Aucun"], note: ["note de bas de page", "notes de bas de page", "Aucune"], image: ["image", "images", "Aucune"], intertitre: ["intertitre", "intertitres", "Aucun"] };

/** Positions des éléments d'un type dans le chapitre ouvert → [{ pos, fin, noeud }] (ordre du document). */
export function ciblesDe(editor, type) {
  const res = [];
  editor.state.doc.descendants((n, pos) => {
    if (type === "paragraphe" && n.isTextblock) res.push({ pos, fin: pos + n.nodeSize, texte: true });
    else if (type === "intertitre" && n.type.name === "heading") res.push({ pos, fin: pos + n.nodeSize, texte: true, niveau: n.attrs.level, libelle: n.textContent });
    else if (type === "note" && n.type.name === "note") res.push({ pos, fin: pos + n.nodeSize, texte: false });
    else if (type === "image" && n.type.name === "image") res.push({ pos, fin: pos + n.nodeSize, texte: false });
    return true;
  });
  return res;
}

function placer(editor, c) {
  const { doc } = editor.state;
  const sel = c.texte ? TextSelection.create(doc, c.pos + 1, Math.max(c.pos + 1, c.fin - 1)) : NodeSelection.create(doc, c.pos);
  editor.view.dispatch(editor.state.tr.setSelection(sel).scrollIntoView());
  editor.view.focus();
}

/**
 * Va à l'élément n° `saisie` du type donné ; « +3 » / « −2 » = relatif à la position du curseur (comme « Atteindre » de Word).
 * → { ok, message }
 */
export function atteindreCible(editor, type, saisie, indexExact = null) {
  const cibles = ciblesDe(editor, type);
  const [nom, pluriel, aucun] = TYPES_CIBLE[type];
  if (!cibles.length) return { ok: false, message: `${aucun} ${nom} dans ce chapitre.` };
  let idx = indexExact;
  if (idx == null) {
    const s = String(saisie ?? "").trim();
    const n = parseInt(s.replace(/[+\-−\s]/g, ""), 10);
    if (!Number.isFinite(n)) return { ok: false, message: "Indiquez un nombre (ex. 12, +3 ou −2)." };
    if (/^[+\-−]/.test(s)) {
      const courant = cibles.reduce((k, c, i) => (c.pos <= editor.state.selection.from ? i : k), -1);
      idx = courant + (/^[\-−]/.test(s) ? -n : n);
    } else idx = n - 1;
  }
  if (idx < 0 || idx >= cibles.length) return { ok: false, message: `Il y a ${cibles.length} ${cibles.length > 1 ? pluriel : nom} dans ce chapitre (de 1 à ${cibles.length}).` };
  placer(editor, cibles[idx]);
  return { ok: true, message: `${nom[0].toUpperCase()}${nom.slice(1)} ${idx + 1} sur ${cibles.length}.` };
}

/** Position dans le document du caractère n° `car` du texte du chapitre (texte seul, sans notes ni éléments). */
export function placerAuCaractere(editor, car) {
  let reste = Math.max(0, car); let cible = null; let derniere = 1;
  editor.state.doc.descendants((n, pos) => {
    if (cible != null) return false;
    if (n.isText) { derniere = pos + n.nodeSize; if (reste <= n.nodeSize) cible = pos + Math.min(reste, n.nodeSize); else reste -= n.nodeSize; }
    return true;
  });
  const pos = cible ?? derniere;
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, Math.min(pos, editor.state.doc.content.size))).scrollIntoView());
  editor.view.focus();
}
