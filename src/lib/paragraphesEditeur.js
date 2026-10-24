/**
 * CURSUS — Lecture des paragraphes d'un éditeur TipTap (22/10/2026)
 * Partagé par « Correction rapide » et « Vérifier le fond ».
 */

/** Paragraphes (blocs de texte) du document, avec leur position. */
export function lireParagraphes(editor, seulementSélection) {
  const { from, to, empty } = editor.state.selection;
  const filtrer = seulementSélection && !empty;
  const liste = [];
  let rang = 0;
  let ignorés = 0;
  editor.state.doc.descendants((nœud, pos) => {
    if (!nœud.isTextblock) return true;
    const idx = ++rang;
    const fin = pos + nœud.nodeSize;
    if (filtrer && (fin <= from || pos >= to)) return false;
    let texte = "";
    let purTexte = true;
    nœud.forEach((enfant) => { if (enfant.isText) texte += enfant.text; else purTexte = false; });
    // Moins de 3 mots (« Envoyer », icônes, titres d'interface) : rien à corriger,
    // et ça ne ferait que produire des remarques parasites.
    if (texte.split(/\s+/).filter((m) => /\p{L}/u.test(m)).length < 3) return false;
    if (!purTexte) { ignorés++; return false; }
    liste.push({ idx, texte, pos: pos + 1 });
    return false;
  });
  return { liste, ignorés, filtrer };
}

/**
 * Lecture TOLÉRANTE pour les outils qui ne font que LIRE (avis sur le fond) :
 * contrairement à `lireParagraphes`, ne saute pas les paragraphes contenant
 * autre chose que du texte (sauts de ligne, notes, images — fréquents après une
 * dictée ou un collage) ni les paragraphes courts. Le texte est celui affiché,
 * les sauts de ligne internes devenant des retours à la ligne. (24/10/2026 :
 * « Aucun texte à lire » alors que le chapitre était plein de texte.)
 */
export function lireTexteComplet(editor, seulementSélection) {
  const { from, to, empty } = editor.state.selection;
  const filtrer = seulementSélection && !empty;
  const liste = [];
  let rang = 0;
  editor.state.doc.descendants((nœud, pos) => {
    if (!nœud.isTextblock) return true;
    const idx = ++rang;
    const fin = pos + nœud.nodeSize;
    if (filtrer && (fin <= from || pos >= to)) return false;
    const texte = editor.state.doc.textBetween(pos + 1, fin - 1, "\n", "\n").replace(/[ \t]+\n/g, "\n").trim();
    if (/\p{L}/u.test(texte)) liste.push({ idx, texte, pos: pos + 1 });
    return false;
  });
  return { liste, filtrer };
}
