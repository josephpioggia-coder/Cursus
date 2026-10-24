/**
 * CURSUS — Propositions de remplacement dans les avis de l'IA (24/10/2026)
 * Demande de Joseph : à côté de ce que l'IA propose, pouvoir le COPIER ou
 * l'INSÉRER dans le texte à la place du passage concerné.
 *
 * Format demandé à l'IA, sur une seule ligne :
 *   « extrait exact » : explication ⟹ « texte de remplacement »
 * `separerProposition` en tire { note, extrait, proposition } ; sans « ⟹ »
 * (remarque sans remplacement possible), proposition = null.
 */

const SEPARATEUR = /\s*(?:⟹|=>)\s*/;
const guillemets = (s) => s.trim().replace(/^[«"“]\s*/, "").replace(/\s*[»"”][.\s]*$/, "").trim();

export function separerProposition(ligne) {
  const texte = String(ligne || "").trim();
  const m = texte.match(/^[«"“]\s*([^»"”]+?)\s*[»"”]/);
  const extrait = m ? m[1].trim() : null;
  const morceaux = texte.split(SEPARATEUR);
  if (morceaux.length < 2) return { note: texte, extrait, proposition: null };
  const proposition = guillemets(morceaux[morceaux.length - 1]);
  const note = morceaux.slice(0, -1).join(" ").trim();
  return { note, extrait, proposition: proposition || null };
}

/**
 * Remplace `extrait` (retrouvé UNE seule fois dans le document actuel) par
 * `proposition`, en une transaction (Ctrl+Z annule). → 'ok' | 'introuvable'
 */
export function remplacerDansLeTexte(editor, extrait, proposition) {
  if (!editor || !extrait || !proposition) return "introuvable";
  // Cherche l'extrait dans chaque segment de texte continu du document (marche aussi
  // pour les paragraphes contenant des sauts de ligne) ; il doit y figurer UNE seule fois.
  const trouvés = [];
  editor.state.doc.descendants((nœud, pos) => {
    if (!nœud.isText) return true;
    let depuis = 0;
    for (;;) {
      const i = nœud.text.indexOf(extrait, depuis);
      if (i < 0) break;
      trouvés.push({ de: pos + i, à: pos + i + extrait.length });
      depuis = i + 1;
    }
    return false;
  });
  if (trouvés.length !== 1) return "introuvable";
  editor.view.dispatch(editor.state.tr.insertText(proposition, trouvés[0].de, trouvés[0].à));
  return "ok";
}
