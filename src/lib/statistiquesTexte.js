/**
 * CURSUS — Statistiques du texte (03/11/2026), à la façon de « Compter les mots » de Word. Calcul PUR, sans IA.
 * Entrée : des blocs de texte « à plat » (un bloc = un paragraphe, un titre…), où une note de bas de page est représentée par NOTE.
 */
import { NOTE, OBJET, blocsDeHtml } from "./rechercheTexte.js";
export { blocsDeHtml };

export const CARACTERES_PAR_PAGE = 1800; // même estimation que « Atteindre » et le volet de recherche : Cursus n'a pas de pagination réelle avant l'export
export const MOTS_PAR_MINUTE_LECTURE = 230;
export const MOTS_PAR_MINUTE_VOIX = 150;

// Mots courants exclus du classement des mots les plus employés (liste volontairement courte).
const MOTS_VIDES = new Set("alors ainsi après aussi avait avec avoir bien cela celle celui ceux chaque comme dans depuis donc elle elles encore entre était étaient être fait faire leur leurs mais même moins nous notre votre pour puis quand que quel quelle ses son sont sous sur tout tous toute toutes très une vers vous elle ces cette cet dont où lui lors par pas plus qui sans sera soit était avait ont peut fut fût".split(" "));

const nettoyer = (s) => String(s).replace(new RegExp(`[${NOTE}${OBJET}]`, "g"), "");

/** blocs : string[] → statistiques. */
export function statistiquesDeBlocs(blocs) {
  let notes = 0, caracteres = 0, caracteresSansEspaces = 0, mots = 0, phrases = 0, plusLong = "";
  const blocsNonVides = [];
  const frequences = new Map();
  for (const brut of blocs) {
    notes += (String(brut).match(new RegExp(NOTE, "g")) || []).length;
    const t = nettoyer(brut).replace(/[ \t]+\n/g, "\n").trim();
    if (!/[\p{L}\p{N}]/u.test(t)) continue;
    blocsNonVides.push(t);
    caracteres += t.length;
    caracteresSansEspaces += t.replace(/\s/g, "").length;
    const m = t.split(/[\s  ]+/).filter((x) => /[\p{L}\p{N}]/u.test(x));
    mots += m.length;
    phrases += Math.max(1, t.split(/[.!?…]+(?:["»”)\]]*)(?:\s+|$)/u).filter((x) => /[\p{L}\p{N}]/u.test(x)).length);
    for (const x of m) {
      const racine = x.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      if (racine.length > plusLong.length) plusLong = racine;
      const bas = racine.toLowerCase();
      if (bas.length >= 4 && !MOTS_VIDES.has(bas) && /^\p{L}+$/u.test(bas)) frequences.set(bas, (frequences.get(bas) || 0) + 1);
    }
  }
  const frequents = [...frequences.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr")).slice(0, 10);
  return {
    mots, caracteres, caracteresSansEspaces, paragraphes: blocsNonVides.length, phrases, notes,
    pages: caracteres ? Math.max(1, Math.ceil(caracteres / CARACTERES_PAR_PAGE)) : 0,
    motsParPhrase: phrases ? Math.round((mots / phrases) * 10) / 10 : 0,
    plusLong,
    minutesLecture: mots / MOTS_PAR_MINUTE_LECTURE,
    minutesVoix: mots / MOTS_PAR_MINUTE_VOIX,
    frequents,
  };
}

/** 7,4 → « 8 min » ; 95 → « 1 h 35 min » ; 0 → « 0 min ». */
export function formaterDuree(minutes) {
  const m = Math.round(minutes);
  if (m < 1 && minutes > 0) return "< 1 min";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")} min` : `${h} h`;
}

/** Blocs de texte d'un document ProseMirror, éventuellement limités à [from, to] (les éléments hors texte : note → NOTE, saut de ligne → \n, autre → ignoré). */
export function blocsDeDocument(doc, from = 0, to = doc.content.size) {
  const blocs = [];
  doc.descendants((noeud, pos) => {
    if (!noeud.isTextblock) return true;
    if (pos + noeud.nodeSize <= from || pos >= to) return false;
    let texte = "";
    noeud.forEach((enfant, decalage) => {
      const debut = pos + 1 + decalage, fin = debut + enfant.nodeSize;
      if (fin <= from || debut >= to) return;
      if (enfant.isText) texte += enfant.text.slice(Math.max(0, from - debut), enfant.text.length - Math.max(0, fin - to));
      else if (enfant.type.name === "note") texte += NOTE;
      else if (enfant.type.name === "hardBreak") texte += "\n";
    });
    blocs.push(texte);
    return false;
  });
  return blocs;
}
