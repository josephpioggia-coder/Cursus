/**
 * CODES VOCAUX DE LA DICTÉE (26/11/2026) — PUR, sans dépendance.
 *
 * Demande de Joseph (exemple réel de dictée) : « il manque un code pour signifier les signes et la ponctuation », et sa
 * proposition : un mot-clé « code » devant chaque signe (« code virgule », « code point », « code à la ligne », « code
 * guillemets », « code brackets »…). Le mot « code » rend la chose SANS ambiguïté : « un point de vue », « la virgule »,
 * « le point final » restent des mots ; seul « code » + un mot de la liste devient un signe. Aucune devinette.
 *
 * `appliquerCodesVocaux(brut, avant)` remplace ces codes dans une transcription. `avant` = le texte déjà obtenu : il sert
 * à savoir si un guillemet / une parenthèse / un crochet est déjà ouvert (« code guillemets » ouvre puis ferme à tour de
 * rôle). La ponctuation que le modèle a déjà posée autour du code est absorbée (« Code virgule. » → « , »).
 * Une consigne en phrase libre (« entre guillemets pour pensée créatrice ») n'est PAS un code : elle reste telle quelle.
 */

const NBSP = " ";
const MOT = "[\\p{L}\\p{N}]";
const DEBUT = `(?<!${MOT})`;
const FIN = `(?!${MOT})`;
// « code » puis un séparateur que la transcription peut produire : espace, tiret, virgule, deux-points.
const PREFIXE = "code(?:[ \\t]*[,:;\\-–—][ \\t]*|[ \\t]+)";

// Signes simples, du plus long au plus court (« point d'interrogation » avant « point »).
export const CODES_SIMPLES = [
  { dit: "code point d'interrogation", re: "points? d(?:['’]| )?interrogation", signe: "?" },
  { dit: "code point d'exclamation", re: "points? d(?:['’]| )?exclamation", signe: "!" },
  { dit: "code points de suspension", re: "points? de suspension", signe: "…" },
  { dit: "code point-virgule", re: "points?[- ]virgules?", signe: ";" },
  { dit: "code deux points", re: "deux[- ]points", signe: ":" },
  { dit: "code à la ligne (ou nouvelle ligne, paragraphe)", re: "(?:à|a) la ligne|nouvelle ligne|nouveau paragraphe|paragraphe", signe: "\n", retour: true },
  { dit: "code virgule", re: "virgules?", signe: "," },
  { dit: "code point", re: "points?", signe: "." },
];

// Signes qui s'ouvrent puis se ferment : « code guillemets » ouvre, le suivant ferme (et ainsi de suite).
export const CODES_PAIRES = [
  { dit: "code guillemets", mot: "guillemets?", ouvrant: `«${NBSP}`, fermant: `${NBSP}»`, o: "«", f: "»" },
  { dit: "code parenthèse", mot: "parenth[èe]ses?", ouvrant: "(", fermant: ")", o: "(", f: ")" },
  { dit: "code crochets (ou brackets)", mot: "(?:crochets?|brackets?|braquettes?)", ouvrant: "[", fermant: "]", o: "[", f: "]" },
];

// Signes COLLÉS aux mots voisins (aucune espace de part et d'autre) : « l code apostrophe arbre » → « l’arbre ».
export const CODES_COLLES = [
  { dit: "code apostrophe", mot: "apostrophes?", signe: "’" },
];

export const CODES_VOCAUX = [
  ...CODES_COLLES.map((c) => ({ dit: c.dit, signe: `${c.signe} (collée aux mots)` })),
  ...CODES_SIMPLES.map((c) => ({ dit: c.dit, signe: c.signe === "\n" ? "nouvelle ligne" : c.signe })),
  ...CODES_PAIRES.map((c) => ({ dit: `${c.dit} (ouvre, puis ferme)`, signe: `${c.o} … ${c.f}` })),
];

const compter = (texte, car) => (texte.match(new RegExp(`\\${car}`, "g")) || []).length;

const echapper = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Mot(s) dit(s) → motif : espaces et tirets interchangeables (« émoji coeur » = « émoji-coeur »).
const motifMot = (dit) => String(dit).trim().split(/[\s-]+/).filter(Boolean).map(echapper).join("[ \\t-]+");

/** Garde seulement les codes personnels valides : { dit, texte, colle? } (dit sans « code », 1 à 40 car.). */
export function nettoyerCodesPerso(liste) {
  if (!Array.isArray(liste)) return [];
  const vus = new Set();
  const sortie = [];
  for (const c of liste) {
    const dit = String(c?.dit || "").replace(/^\s*code[\s,:;-]+/i, "").trim().slice(0, 40);
    const texte = String(c?.texte ?? "").slice(0, 40);
    if (!dit || !texte || !/[\p{L}\p{N}]/u.test(dit)) continue;
    const cle = dit.toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    sortie.push({ dit, texte, colle: !!c?.colle });
  }
  return sortie;
}

export function appliquerCodesVocaux(brut, avant = "", perso = []) {
  let s = String(brut || "");
  if (!s) return s;

  // 1) signes simples : on absorbe la ponctuation que le modèle a pu mettre juste autour du code.
  for (const code of CODES_SIMPLES) {
    const re = new RegExp(`[ \\t]*[,;.]?[ \\t]*${DEBUT}${PREFIXE}(?:${code.re})${FIN}[ \\t]*[,;.]?`, "giu");
    s = s.replace(re, code.retour ? "\n" : `${code.signe} `);
  }

  // 2) signes par paires : ouvre puis ferme à tour de rôle, en tenant compte de ce qui est déjà ouvert avant.
  for (const paire of CODES_PAIRES) {
    let ouvert = compter(String(avant || ""), paire.o) > compter(String(avant || ""), paire.f);
    const explicite = (sens) => new RegExp(
      sens === "ouvre"
        ? `[ \\t]*${DEBUT}${PREFIXE}(?:(?:ouvrez|ouvrir|ouvre) (?:les |le |la |un |une )?${paire.mot}|${paire.mot} (?:ouvrants?|ouvertes?|ouverts?))${FIN}[ \\t]*`
        : `[ \\t]*${DEBUT}${PREFIXE}(?:(?:fermez|fermer|ferme) (?:les |le |la |un |une )?${paire.mot}|${paire.mot} (?:fermants?|fermées?|fermés?))${FIN}[ \\t]*`,
      "giu");
    // Formes explicites d'abord : elles imposent l'état.
    s = s.replace(explicite("ouvre"), () => { ouvert = true; return ` ${paire.ouvrant}`; });
    s = s.replace(explicite("ferme"), () => { ouvert = false; return paire.fermant; });
    const alternee = new RegExp(`[ \\t]*${DEBUT}${PREFIXE}${paire.mot}${FIN}[ \\t]*`, "giu");
    s = s.replace(alternee, () => {
      const r = ouvert ? paire.fermant : ` ${paire.ouvrant}`;
      ouvert = !ouvert;
      return r;
    });
  }
  // 3) signes collés (apostrophe), puis codes personnels (le plus long d'abord : « émoji coeur » avant « émoji »).
  const collee = new RegExp(`[ \\t]*${DEBUT}${PREFIXE}(?:${CODES_COLLES[0].mot})${FIN}[ \\t]*`, "giu");
  s = s.replace(collee, () => CODES_COLLES[0].signe);
  const mesCodes = nettoyerCodesPerso(perso).sort((a, b) => b.dit.length - a.dit.length);
  for (const c of mesCodes) {
    const re = new RegExp(`[ \\t]*[,;.]?[ \\t]*${DEBUT}${PREFIXE}(?:${motifMot(c.dit)})${FIN}[ \\t]*[,;.]?`, "giu");
    s = s.replace(re, () => (c.colle ? c.texte : ` ${c.texte} `));
  }
  return nettoyer(s);
}

// Espaces et majuscules autour de la ponctuation (sans toucher à la typographie française fine : voir Nettoyage mécanique).
export function nettoyer(texte) {
  let s = texte;
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/ +([,.;:!?…)\]])/g, "$1");
  s = s.replace(/([(\[]) +/g, "$1");
  s = s.replace(/([,;:!?…])(?=\p{L})/gu, "$1 ");
  s = s.replace(/([»)\]])(?=[\p{L}\p{N}])/gu, "$1 ");
  s = s.replace(/(?<=\p{Ll})\.(?=\p{Lu})/gu, ". ");
  s = s.replace(/ *\n */g, "\n").replace(/\n{2,}/g, "\n");
  s = s.replace(/([.!?…]\s+)(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase());
  s = s.replace(/(\n)(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase());
  return s.replace(/[ \t]+$/g, "").replace(/^[ \t]+/, "");
}

// Colle un nouveau passage à la suite du texte déjà obtenu : ponctuation collée au mot, majuscule après une fin de phrase.
export function joindre(avant, nouveau) {
  // Seuls les espaces sont retirés : un « code à la ligne » dicté en fin de passage doit survivre (saut de ligne final).
  const n = String(nouveau || "").replace(/^[ \t]+|[ \t]+$/g, "");
  const a = String(avant || "").replace(/[ \t]+$/, "");
  if (!n.trim()) return a;
  if (!a) return n;
  if (/^[,.;:!?…)\]]/.test(n) || n.startsWith(`${NBSP}»`)) return a + n;
  const finDePhrase = /(?:[.!?…]|\n)$/.test(a);
  const suite = finDePhrase ? n.replace(/^(\p{Ll})/u, (c) => c.toUpperCase()) : n;
  if (/\n$/.test(a) || /^\n/.test(suite)) return a + suite;
  return `${a} ${suite}`;
}
