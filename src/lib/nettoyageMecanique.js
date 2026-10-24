/**
 * CURSUS — Nettoyage mécanique (étape 0 du parcours de reconstruction, 24/10/2026)
 * ======================================================================
 * Voir docs/note-conception-DREM.md (annexe). AUCUNE IA ici : des règles
 * déterministes, visibles et réversibles.
 *   1. Typographie : règles activables une à une (changement réellement appliqué),
 *      plus des SIGNALEMENTS (ponctuation douteuse) jamais corrigés automatiquement.
 *   2. Répétitions et rythme : compteurs (tics et atténuateurs, mots répétés de près,
 *      longueur des phrases, paragraphes d'une seule phrase). Aucun seuil n'est
 *      présenté comme validé : ce sont des repères pour que l'auteur·ice regarde.
 *
 * Choix assumés :
 * - La Correction rapide ignore volontairement la typographie (retour de Joseph du
 *   22/10/2026) : ici c'est une action DISTINCTE, à la demande, avec aperçu.
 * - Règles « sûres » cochées par défaut ; règles de goût (guillemets, apostrophes,
 *   insécables, point final) décochées par défaut.
 * - Fonctions pures (testables sous Node).
 */

const FIN_INSECABLE = " "; // espace fine insécable
const INSECABLE = " ";

/** Applique un motif global à un texte → [{ de, à, remplacement }] (positions dans `texte`). */
function parMotif(texte, motif, construire) {
  const r = [];
  const re = new RegExp(motif.source, motif.flags.includes("g") ? motif.flags : motif.flags + "g");
  let m;
  while ((m = re.exec(texte)) !== null) {
    if (m[0] === "") { re.lastIndex++; continue; }
    const x = construire(m, texte);
    if (x) r.push(x);
  }
  return r;
}

/** Les règles, dans l'ordre de PRIORITÉ (en cas de chevauchement la première l'emporte). */
export const REGLES = [
  {
    id: "ellipse", defaut: true,
    label: "Points de suspension : « ... » ou « . . . » → « … » collé au mot",
    trouver: (t) => parMotif(t, /[ ]?(\.{3,}|\.(?: \.){2,})/u, (m) => ({ de: m.index, à: m.index + m[0].length, remplacement: "…" })),
  },
  {
    id: "espaces", defaut: true,
    label: "Espaces multiples → une seule espace",
    trouver: (t) => parMotif(t, /[ \t]{2,}/u, (m) => ({ de: m.index, à: m.index + m[0].length, remplacement: " " })),
  },
  {
    id: "avantPonct", defaut: true,
    label: "Espace avant une virgule ou un point : « mot , » → « mot, »",
    trouver: (t) => parMotif(t, /(?<=[\p{L}\p{N})»”’…])[ ]+([,.])(?![.\d])/u, (m) => ({ de: m.index, à: m.index + m[0].length, remplacement: m[1] })),
  },
  {
    id: "apresPonct", defaut: true,
    label: "Espace manquante après , ; ! ? entre deux lettres : « mot,suite » → « mot, suite »",
    trouver: (t) => parMotif(t, /(?<=\p{L})[,;!?](?=\p{L})/u, (m) => ({ de: m.index + 1, à: m.index + 1, remplacement: " " })),
  },
  {
    id: "pointFinal", defaut: false,
    label: "Point final manquant en fin de paragraphe (à vérifier : listes, dialogues, vers)",
    // traité à part (dépend de la fin du paragraphe) — voir pointsFinaux()
    trouver: () => [],
  },
  {
    id: "insecables", defaut: false,
    label: "Espaces insécables à la française (avant ; ! ? : et à l'intérieur de « »)",
    trouver: (t) => [
      ...parMotif(t, /(?<=[\p{L}\p{N})»”’])[ ]?(?=[;!?](?![;!?]))/u, (m) => ({ de: m.index, à: m.index + m[0].length, remplacement: FIN_INSECABLE })),
      ...parMotif(t, /(?<=\p{L})[ ]?:(?=\s|$)/u, (m) => ({ de: m.index, à: m.index + m[0].length - 1, remplacement: INSECABLE })),
      ...parMotif(t, /«[ ]?(?=\S)/u, (m) => ({ de: m.index + 1, à: m.index + m[0].length, remplacement: INSECABLE })),
      ...parMotif(t, /(?<=\S)[ ]?»/u, (m) => ({ de: m.index, à: m.index + m[0].length - 1, remplacement: INSECABLE })),
    ].filter((c) => c.de !== c.à || c.remplacement),
  },
  {
    id: "guillemets", defaut: false,
    label: "Guillemets droits \" … \" → « … » (par paire ; paragraphe laissé tel quel si le nombre est impair)",
    trouver: (t) => {
      const idx = [...t.matchAll(/"/g)].map((m) => m.index);
      if (idx.length === 0 || idx.length % 2) return [];
      return idx.map((i, k) => (k % 2 === 0
        ? { de: i, à: i + (t[i + 1] === " " ? 2 : 1), remplacement: "«" + INSECABLE }
        : { de: i - (t[i - 1] === " " ? 1 : 0), à: i + 1, remplacement: INSECABLE + "»" }));
    },
  },
  {
    id: "apostrophe", defaut: false,
    label: "Apostrophe droite ' → apostrophe typographique ’",
    trouver: (t) => parMotif(t, /(?<=\p{L})'(?=\p{L})/u, (m) => ({ de: m.index, à: m.index + 1, remplacement: "’" })),
  },
];

/** Signalements : ponctuation douteuse, JAMAIS corrigée automatiquement. */
export const SIGNALEMENTS = [
  { id: "deuxPoints", label: "Deux points « .. » isolés (ellipse ou faute de frappe ?)", motif: /(?<!\.)\.\.(?!\.)/u },
  { id: "mixte", label: "Ponctuation mêlée (« .. ; », « ,; », « ;. »…)", motif: /[.,;:]{1,2}[ ]?[;:,][.]?|[;:,][.]/u },
  { id: "minusculeApres", label: "Minuscule juste après « ! » ou « ? » (phrase coupée ou majuscule oubliée ?)", motif: /[!?][ ]+\p{Ll}/u },
  { id: "doubleExcl", label: "Ponctuation répétée (« !! », « ?? », « ,, »)", motif: /([!?,])\1+/u },
];

/**
 * Cherche les changements d'un lot de segments de texte continus.
 * @param segments [{ pos, texte }] — pos = position absolue du premier caractère
 * @param actives  ensemble des id de règles à chercher
 * @returns { changements, signalements } — changements triés, SANS chevauchement
 */
export function analyserTypographie(segments, actives) {
  const brut = [];
  for (const regle of REGLES) {
    if (!actives.has(regle.id)) continue;
    for (const s of segments) {
      for (const c of regle.trouver(s.texte)) {
        brut.push({
          regle: regle.id, priorite: REGLES.indexOf(regle),
          de: s.pos + c.de, à: s.pos + c.à, remplacement: c.remplacement,
          avant: s.texte.slice(c.de, c.à),
          contexte: extrait(s.texte, c.de, c.à),
        });
      }
    }
  }
  // chevauchements : la règle prioritaire (index le plus bas) l'emporte
  brut.sort((a, b) => a.priorite - b.priorite || a.de - b.de);
  const retenus = [];
  for (const c of brut) {
    if (retenus.some((r) => c.de < r.à && c.à > r.de)) continue;
    if (c.avant === c.remplacement) continue;
    retenus.push(c);
  }
  retenus.sort((a, b) => a.de - b.de);

  const signalements = [];
  for (const sg of SIGNALEMENTS) {
    for (const s of segments) {
      let m;
      const re = new RegExp(sg.motif.source, "gu");
      while ((m = re.exec(s.texte)) !== null) {
        if (m[0] === "") { re.lastIndex++; continue; }
        signalements.push({ regle: sg.id, label: sg.label, pos: s.pos + m.index, contexte: extrait(s.texte, m.index, m.index + m[0].length) });
      }
    }
  }
  return { changements: retenus, signalements };
}

/** Points finals manquants : prend des PARAGRAPHES [{ pos, texte }] → changements d'insertion en fin. */
export function pointsFinaux(paragraphes) {
  const r = [];
  for (const p of paragraphes) {
    const t = p.texte.replace(/\s+$/u, "");
    const mots = t.split(/\s+/).filter((m) => /\p{L}/u.test(m));
    if (mots.length < 5) continue;
    if (!/[\p{L}\p{N}»”")]$/u.test(t)) continue;
    if (t === t.toUpperCase()) continue; // titre en capitales
    const fin = p.finPos ?? p.pos + t.length;
    r.push({ regle: "pointFinal", priorite: 4, de: fin, à: fin, remplacement: ".", avant: "", contexte: extrait(t, t.length, t.length) + " ⟨.⟩" });
  }
  return r;
}

function extrait(t, de, à, marge = 24) {
  const a = Math.max(0, de - marge), b = Math.min(t.length, à + marge);
  return (a > 0 ? "…" : "") + t.slice(a, b).replace(/\n/g, " ") + (b < t.length ? "…" : "");
}

// ─── Répétitions et rythme ─────────────────────────────────────────────────

const sansAccents = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[’‘]/g, "'");

/** Tournures qui reviennent souvent à l'oral ou en atténuation (normalisées, sans accents). */
export const TICS = [
  "en tout cas", "dans une certaine mesure", "une certaine", "un certain", "d'une certaine maniere", "d'une certaine facon",
  "en quelque sorte", "quelque part", "a la base", "au final", "finalement", "en fait", "du coup", "en gros",
  "pour ainsi dire", "tout a fait", "bien sur", "evidemment", "forcement", "vraiment", "un peu", "plutot",
  "toujours", "jamais", "souvent", "parfois", "tres", "assez", "important", "importante", "importants", "importantes",
];

const STOP = new Set(("alors aussi autre autres avait avant avoir avons apres avec cela celui ceux chaque comme comment dans depuis donc " +
  "encore entre etait etaient etre faire fait leurs lorsque meme mais moins notre nous parce peut peuvent pendant plus plusieurs pour " +
  "pourquoi puis quand quel quelle quelque quelques sans selon sera seront sont sous tout toute toutes tous trop vers vous votre " +
  "ainsi ceci deja enfin elle elles cette ceux dont ici voici voila").split(" "));

function phrases(texte) {
  return texte.split(/(?<=[.!?…])\s+/u).map((s) => s.trim()).filter((s) => /\p{L}/u.test(s));
}
const nbMots = (s) => s.split(/\s+/).filter((m) => /\p{L}/u.test(m)).length;

/**
 * @param paragraphes [{ texte }]
 * @returns { mots, nbPhrases, moyenne, longues, uneSeulePhrase, tics, repetitions }
 */
export function analyserRepetitions(paragraphes) {
  const tousTextes = paragraphes.map((p) => p.texte);
  const mots = tousTextes.reduce((a, t) => a + nbMots(t), 0);

  // Rythme
  let nbPhrases = 0, uneSeule = 0;
  const longues = [];
  for (const t of tousTextes) {
    const ph = phrases(t);
    nbPhrases += ph.length;
    if (ph.length === 1) uneSeule++;
    for (const s of ph) { const n = nbMots(s); if (n > 40) longues.push({ mots: n, extrait: s.length > 140 ? s.slice(0, 140) + "…" : s }); }
  }
  longues.sort((a, b) => b.mots - a.mots);

  // Tics
  const normalise = tousTextes.map(sansAccents).join("\n");
  const tics = [];
  for (const t of TICS) {
    const n = (normalise.match(new RegExp(`(?<![a-z'])${t.replace(/'/g, "'")}(?![a-z])`, "g")) || []).length;
    const seuil = t.includes(" ") ? 2 : 4;
    if (n >= seuil) tics.push({ expression: t, n, pour1000: mots ? Math.round((n / mots) * 10000) / 10 : 0 });
  }
  // Une expression incluse dans une autre déjà listée (ex. « une certaine » dans « dans une certaine mesure ») reste listée : elles se complètent.
  tics.sort((a, b) => b.n - a.n);

  // Mots répétés de près (fenêtre de 40 mots)
  const jetons = [];
  tousTextes.forEach((t, para) => {
    for (const m of t.matchAll(/\p{L}[\p{L}'’-]*/gu)) {
      const norm = sansAccents(m[0]).replace(/(es|s|e|x)$/, ""); // racine grossière : « important / importante / importants »
      jetons.push({ norm, para, debut: m.index, mot: m[0], long: norm.length >= 5 && !STOP.has(sansAccents(m[0])) });
    }
  });
  const repetitions = [];
  const dejaSignale = new Map();
  const FENETRE = 40;
  for (let i = 0; i < jetons.length; i++) {
    const j = jetons[i];
    if (!j.long) continue;
    if ((dejaSignale.get(j.norm) ?? -1) >= i) continue;
    let n = 1;
    const positions = [i];
    for (let k = i + 1; k < jetons.length && k - i <= FENETRE; k++) if (jetons[k].norm === j.norm) { n++; positions.push(k); }
    if (n >= 3) {
      dejaSignale.set(j.norm, i + FENETRE);
      const p = tousTextes[j.para];
      repetitions.push({ mot: j.mot, n, extrait: extrait(p, Math.max(0, j.debut - 10), Math.min(p.length, j.debut + 90), 0) });
    }
  }

  return {
    mots, nbPhrases,
    moyenne: nbPhrases ? Math.round((mots / nbPhrases) * 10) / 10 : 0,
    longues: longues.slice(0, 5),
    paragraphes: tousTextes.length,
    uneSeulePhrase: uneSeule,
    tics,
    repetitions: repetitions.slice(0, 30),
  };
}

/**
 * Applique les règles actives à UN segment de texte, en plusieurs passes (une
 * règle peut en révéler une autre : « mot ,suite » → « mot,suite » → « mot, suite »).
 * → { texte, n } (n = nombre total de changements sur toutes les passes)
 */
export function transformerSegment(texte, actives, passes = 3) {
  let t = texte, n = 0;
  for (let k = 0; k < passes; k++) {
    const { changements } = analyserTypographie([{ pos: 0, texte: t }], actives);
    if (!changements.length) break;
    for (const c of [...changements].sort((a, b) => b.de - a.de)) t = t.slice(0, c.de) + c.remplacement + t.slice(c.à);
    n += changements.length;
  }
  return { texte: t, n };
}
