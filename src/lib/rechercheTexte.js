/**
 * CURSUS — Rechercher / remplacer : moteur PUR (28/10/2026). Aucun accès à l'éditeur ni au réseau.
 * Recherche de TEXTE littéral (pas d'expressions régulières : un « ? » ou un « . » dans un livre est de la ponctuation).
 * Options : respecter la casse, mot entier, accents significatifs. Par défaut on ignore casse ET accents (« ete » trouve « été »).
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

/** → [{ debut, fin }] (indices dans `texte`), occurrences qui ne se chevauchent pas. */
export function trouver(texte, requete, options = {}) {
  const q = String(requete ?? "");
  if (!q) return [];
  const t = plier(texte, options);
  const r = plier(q, options);
  if (t.length !== String(texte).length || r.length !== q.length) return []; // garde-fou : un pliage qui changerait la longueur fausserait les positions
  const res = [];
  let i = 0;
  while ((i = t.indexOf(r, i)) !== -1) {
    const fin = i + r.length;
    const ok = !options.motEntier || ((i === 0 || !lettre.test(t[i - 1])) && (fin >= t.length || !lettre.test(t[fin])));
    if (ok) { res.push({ debut: i, fin }); i = fin; } else i += 1;
  }
  return res;
}

/** Remplace toutes les occurrences dans une chaîne → { texte, n }. */
export function remplacerTout(texte, requete, remplacement, options = {}) {
  const occ = trouver(texte, requete, options);
  if (!occ.length) return { texte, n: 0 };
  let sortie = "", curseur = 0;
  for (const { debut, fin } of occ) { sortie += texte.slice(curseur, debut) + remplacement; curseur = fin; }
  return { texte: sortie + texte.slice(curseur), n: occ.length };
}

const BLOCS = "p, h1, h2, h3, h4, h5, h6, li, blockquote";

/** Blocs de texte d'un document HTML : [{ texte }] (chaque bloc = un paragraphe, un titre, un item de liste…). */
export function blocsDeHtml(html) {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const feuilles = [...doc.body.querySelectorAll(BLOCS)].filter((el) => !el.querySelector(BLOCS));
  return feuilles.map((el) => ({ texte: el.textContent || "" })).filter((b) => b.texte);
}

/** Résumé d'un chapitre pour la recherche dans tout le livre → { n, extraits: [{ avant, trouve, apres }] } */
export function chercherDansHtml(html, requete, options = {}, maxExtraits = 3) {
  let n = 0; const extraits = [];
  for (const { texte } of blocsDeHtml(html)) {
    const occ = trouver(texte, requete, options);
    n += occ.length;
    for (const o of occ) {
      if (extraits.length >= maxExtraits) break;
      extraits.push({ avant: texte.slice(Math.max(0, o.debut - 35), o.debut), trouve: texte.slice(o.debut, o.fin), apres: texte.slice(o.fin, o.fin + 35) });
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
