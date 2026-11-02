/**
 * CURSUS — Rechercher / remplacer : moteur PUR (28/10/2026). Aucun accès à l'éditeur ni au réseau.
 * Recherche de TEXTE littéral (pas d'expressions régulières : un « ? » ou un « . » dans un livre est de la ponctuation).
 * Options : respecter la casse, mot entier, début de mot, fin de mot, accents significatifs. Par défaut on ignore casse ET accents (« ete » trouve « été »).
 * `plier` garde la LONGUEUR de la chaîne (un caractère → un caractère) : les positions trouvées sur le texte plié valent pour l'original.
 */

const lettre = /[\p{L}\p{N}_]/u;

/** Version « pliée » (sans accents, sans casse selon les options), de MÊME longueur que `s`. */
export function plier(s, { casse = false, accents = false } = {}) {
  let sortie = "";
  for (const c of String(s)) { // for…of itère par point de code : un caractère hors BMP compte pour 2 unités UTF-16 → on les remplit pareil
    let x = c;
    if (!accents) { const d = c.normalize("NFD")[0]; if (d && d.length === c.length) x = d; }
    if (!casse) { const l = x.toLowerCase(); if (l.length === x.length) x = l; }
    sortie += x;
  }
  return sortie;
}

// ─── Caractères spéciaux (02/11/2026), à la façon de Word : « ^s », « ^t »… ─────────────────────────────────────────
// Dans un texte « à plat », les éléments qui ne sont pas du texte sont représentés par un caractère : tabulation → \t,
// saut de ligne → \n, note de bas de page → NOTE, image / autre élément → OBJET (voir rechercheEditeur.js et texteDuBloc).
export const NOTE = "\uE001";
export const OBJET = "\uFFFC";
const MOTIFS = { s: "[\\u00A0\\u202F]", t: "\\t", l: "\\n", n: "\\n", w: "[ \\t\\u00A0\\u202F]+", "?": "[^\\n]", "#": "\\d", $: "\\p{L}", f: NOTE, g: OBJET };
const NON_PRIS = { p: "marque de paragraphe", m: "saut de page" }; // pas encore pris en charge : annoncés, jamais ignorés en silence
const echapper = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Codes « ^x » non pris en charge présents dans la requête → ["^p (marque de paragraphe)", …]. */
export function jetonsNonPris(requete) {
  const q = String(requete ?? ""); const vus = [];
  for (let i = 0; i < q.length - 1; i++) {
    if (q[i] !== "^") continue;
    const c = q[i + 1].toLowerCase();
    if (NON_PRIS[c]) { const t = `^${c} (${NON_PRIS[c]})`; if (!vus.includes(t)) vus.push(t); }
    i += 1;
  }
  return vus;
}
export const contientJeton = (requete) => /\^[stlnw?#$fg^]/i.test(String(requete ?? ""));

/** Requête avec jetons → source d'expression régulière sur texte plié (les parties littérales sont pliées comme le texte). */
function sourceRegex(requete, options) {
  let src = "", litteral = "";
  const vider = () => { if (litteral) { src += echapper(plier(litteral, options)); litteral = ""; } };
  for (let i = 0; i < requete.length; i++) {
    const c = requete[i];
    if (c === "^" && i + 1 < requete.length) {
      const j = requete[i + 1].toLowerCase();
      if (j === "^") { litteral += "^"; i += 1; continue; }
      if (MOTIFS[j]) { vider(); src += MOTIFS[j]; i += 1; continue; }
    }
    litteral += c;
  }
  vider();
  return src;
}

/** → [{ debut, fin }] (indices dans `texte`), occurrences qui ne se chevauchent pas. */
export function trouver(texte, requete, options = {}) {
  const q = String(requete ?? "");
  if (!q) return [];
  const t = plier(texte, options);
  if (t.length !== String(texte).length) return []; // garde-fou : un pliage qui changerait la longueur fausserait les positions
  const res = [];
  // Mot entier = début ET fin de mot ; « début de mot » : « temp » trouve « temps », « température » mais pas « longtemps » ; « fin de mot » : l'inverse.
  const debutOk = (i) => i === 0 || !lettre.test(t[i - 1]);
  const finOk = (fin) => fin >= t.length || !lettre.test(t[fin]);
  const ok = (i, fin) => (!(options.motEntier || options.debutMot) || debutOk(i)) && (!(options.motEntier || options.finMot) || finOk(fin));
  if (contientJeton(q)) {
    let re;
    try { re = new RegExp(sourceRegex(q, options), "gu"); } catch { return []; }
    let m;
    while ((m = re.exec(t)) !== null) {
      if (!m[0].length) { re.lastIndex += 1; continue; }
      const fin = m.index + m[0].length;
      if (ok(m.index, fin)) res.push({ debut: m.index, fin }); else re.lastIndex = m.index + 1;
    }
    return res;
  }
  const r = plier(q, options);
  if (r.length !== q.length) return [];
  let i = 0;
  while ((i = t.indexOf(r, i)) !== -1) {
    const fin = i + r.length;
    if (ok(i, fin)) { res.push({ debut: i, fin }); i = fin; } else i += 1;
  }
  return res;
}

/** Texte de remplacement : « ^s » espace insécable, « ^t » tabulation, « ^l » saut de ligne, « ^^ » un « ^ », « ^& » le texte trouvé. */
export function developperRemplacement(remplacement, trouve = "") {
  const r = String(remplacement ?? "");
  if (!r.includes("^")) return r;
  return r.replace(/\^([stln^&])/gi, (_, c) => ({ s: "\u00A0", t: "\t", l: "\n", n: "\n", "^": "^", "&": trouve }[c.toLowerCase()]));
}

/** Pour l'AFFICHAGE d'un extrait : les caractères de remplacement internes deviennent lisibles. */
export const lisible = (s) => String(s).replace(/\t/g, "→").replace(/\n/g, "↵").replace(new RegExp(NOTE, "g"), "¹").replace(new RegExp(OBJET, "g"), "▣").replace(/\u00A0|\u202F/g, "°");

/** Remplace toutes les occurrences dans une chaîne → { texte, n }. */
export function remplacerTout(texte, requete, remplacement, options = {}) {
  const occ = trouver(texte, requete, options);
  if (!occ.length) return { texte, n: 0 };
  let sortie = "", curseur = 0;
  for (const { debut, fin } of occ) { sortie += texte.slice(curseur, debut) + developperRemplacement(remplacement, texte.slice(debut, fin)); curseur = fin; }
  return { texte: sortie + texte.slice(curseur), n: occ.length };
}

const BLOCS = "p, h1, h2, h3, h4, h5, h6, li, blockquote";

/** Blocs de texte d'un document HTML : [{ texte }] (chaque bloc = un paragraphe, un titre, un item de liste…). */
export function blocsDeHtml(html) {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const feuilles = [...doc.body.querySelectorAll(BLOCS)].filter((el) => !el.querySelector(BLOCS));
  return feuilles.map((el) => ({ texte: texteDuBloc(el) })).filter((b) => b.texte);
}

/** Texte « à plat » d'un bloc : <br> → \n, tabulation → \t, note → NOTE, image → OBJET (comme dans l'éditeur). */
function texteDuBloc(el) {
  if (!el.querySelector("br, span[data-tab], span[data-note], img")) return el.textContent || "";
  const copie = el.cloneNode(true);
  const doc = el.ownerDocument;
  const remplacer = (sel, car) => copie.querySelectorAll(sel).forEach((x) => x.replaceWith(doc.createTextNode(car)));
  remplacer("br", "\n"); remplacer("span[data-tab]", "\t"); remplacer("span[data-note]", NOTE); remplacer("img", OBJET);
  return copie.textContent || "";
}

const extraitAutour = (texte, o) => ({ avant: lisible(texte.slice(Math.max(0, o.debut - 35), o.debut)), trouve: lisible(texte.slice(o.debut, o.fin)), apres: lisible(texte.slice(o.fin, o.fin + 35)) });

/** Titre d'un chapitre / d'une partie → { n, extrait } (n = nombre d'occurrences). */
export function chercherDansTitre(titre, requete, options = {}) {
  const occ = trouver(titre || "", requete, options);
  return { n: occ.length, extrait: occ.length ? extraitAutour(titre, occ[0]) : null };
}

/**
 * Notes de bas de page d'un HTML → [{ element, texte }]. Le texte d'une note est écrit DEUX fois par l'éditeur : `data-texte`
 * (affichage) et `texte` (relu au rechargement par TipTap) — les deux doivent rester identiques, voir `ecrireTexteNote`.
 */
function notesDeDoc(doc) {
  return [...doc.body.querySelectorAll("span[data-note]")].map((element) => ({ element, texte: element.getAttribute("texte") || element.getAttribute("data-texte") || "" })).filter((x) => x.texte);
}
const ecrireTexteNote = (element, texte) => { element.setAttribute("texte", texte); element.setAttribute("data-texte", texte); };

/**
 * Résumé d'un chapitre pour la recherche dans tout le livre → { n, extraits: [{ avant, trouve, apres, note? }] }
 * Une NOTE de bas de page compte pour UNE occurrence (tous ses « chat » sont remplacés d'un coup, comme dans l'éditeur).
 */
export function chercherDansHtml(html, requete, options = {}, maxExtraits = 3) {
  let n = 0; const extraits = [];
  if (html) {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    for (const { texte } of notesDeDoc(doc)) {
      const occ = trouver(texte, requete, options);
      if (!occ.length) continue;
      n += 1;
      if (extraits.length < maxExtraits) extraits.push({ ...extraitAutour(texte, occ[0]), note: true });
    }
  }
  for (const { texte } of blocsDeHtml(html)) {
    const occ = trouver(texte, requete, options);
    n += occ.length;
    for (const o of occ) {
      if (extraits.length >= maxExtraits) break;
      extraits.push(extraitAutour(texte, o));
    }
  }
  return { n, extraits };
}

/**
 * Remplace dans un HTML en réécrivant les NŒUDS DE TEXTE un à un (la mise en forme, les images, les notes restent intactes).
 * Une occurrence qui chevauche deux mises en forme (moitié en gras, moitié normal) ne peut pas être remplacée sans la défaire :
 * elle est COMPTÉE à part (`aLaMain`) pour que l'auteur·ice la traite à la main. → { html, n, aLaMain }
 */
export function remplacerDansHtml(html, requete, remplacement, options = {}) {
  if (!html) return { html, n: 0, aLaMain: 0 };
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const marcheur = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const noeuds = []; let courant;
  while ((courant = marcheur.nextNode())) noeuds.push(courant);
  let n = 0;
  for (const nd of noeuds) {
    const r = remplacerTout(nd.data, requete, remplacement, options);
    if (r.n) { nd.data = r.texte; n += r.n; }
  }
  for (const { element, texte } of notesDeDoc(doc)) { // notes de bas de page : une note = une occurrence
    const r = remplacerTout(texte, requete, remplacement, options);
    if (r.n) { ecrireTexteNote(element, r.texte); n += 1; }
  }
  // Occurrences restantes à cheval sur plusieurs nœuds (comptées après coup, sur le texte de chaque bloc)
  let restantes = 0;
  for (const { texte } of blocsDeHtml(doc.body.innerHTML)) restantes += trouver(texte, requete, options).length;
  // Si le remplacement contient lui-même la requête (ex. « chat » → « chaton chat »), ces occurrences ne sont pas « à la main » : on les ignore.
  const aLaMain = trouver(remplacement, requete, options).length ? 0 : restantes;
  return { html: doc.body.innerHTML, n, aLaMain };
}

/** Aplati une structure imbriquée { id, titre, texte, zone, enfants } dans l'ordre de lecture. */
export function aplatirStructure(structure = [], profondeur = 0) {
  return structure.flatMap((n) => [{ id: n.id, titre: n.titre, type: n.type, zone: n.zone || "corps", texte: n.texte || "", profondeur }, ...aplatirStructure(n.enfants || [], profondeur + 1)]);
}
