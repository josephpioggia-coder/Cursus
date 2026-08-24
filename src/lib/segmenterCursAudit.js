/**
 * CursAudit — Segmentation d'un texte en unités d'analyse (référence 60816-01, suite)
 * ======================================================================
 * Deux sources possibles pour peupler `audit_sections` :
 *  - `segmenterTexte()` : texte déjà en clair (collé), découpé par
 *    paragraphes séparés par des lignes vides — une heuristique, puisqu'un
 *    texte collé n'a pas de frontière de paragraphe fiable. Pas de
 *    détection de chapitres possible sur du texte collé (aucun style Word
 *    à lire) — le pré-audit enrichi chapitre par chapitre (voir plus bas)
 *    n'est donc disponible que pour les audits créés depuis un .docx.
 *  - `extraireParagraphesDocx()` : fichier .docx, découpé par ses vrais
 *    paragraphes internes (`<w:p>`) — plus fiable, reprend la lecture JSZip
 *    déjà éprouvée dans src/components/ImportDocx.jsx (pas `mammoth`,
 *    dépendance présente mais inutilisée dans ce dépôt).
 *
 * DÉTECTION DES CHAPITRES (ajoutée le 24/08/2026, réf. 60816-01, suite) —
 * `extraireParagraphesDocxAvecChapitres()` reprend la même logique de
 * résolution des niveaux de titre RÉELS que `extraireChapitres()` dans
 * ImportDocx.jsx (résolution par `<w:outlineLvl>`, en remontant la chaîne
 * `<w:basedOn>` si le style lui-même n'a pas de niveau propre, repli sur le
 * nom du style en dernier recours) — dupliquée ici plutôt qu'importée
 * depuis un composant React, pour garder ce fichier autonome.
 *
 * Contrairement à ImportDocx.jsx (qui distingue Partie ET Chapitre, deux
 * niveaux choisis à l'écran), CursAudit ne distingue PAS le type de
 * division : décision explicite de l'auteur du projet le 24/08/2026— "le
 * client déterminera de toutes façons si oui ou non une partie doit être
 * auditée" (une préface, des remerciements, ou un chapitre au même niveau
 * de titre reçoivent tous le même traitement, ce n'est pas à CursAudit de
 * juger ce qui "compte" comme chapitre). Un seul niveau de titre est donc
 * choisi AUTOMATIQUEMENT : celui qui a le plus grand nombre d'occurrences
 * parmi les niveaux repérés au moins deux fois (une seule occurrence à un
 * niveau donné ne suffit pas à constituer une vraie structure de
 * chapitres — probablement un sous-titre isolé, pas une division
 * répétée). Le client CONFIRME ensuite ce découpage dans l'aperçu gratuit
 * avant de pouvoir lancer le pré-audit — voir ApercuGlobal dans
 * CursAuditDetail.jsx et `audits.chapitres_confirmes`.
 */

// Filtre le bruit typique d'un texte collé ou d'un paragraphe Word : lignes
// vides résiduelles, numéros de page isolés, en-têtes/pieds de page très
// courts. Seuil arbitraire, ajustable si l'usage réel montre qu'il coupe
// trop ou pas assez.
const LONGUEUR_MIN_UNITE = 20;

export function segmenterTexte(texte) {
  if (!texte) return [];
  return texte
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/) // paragraphes séparés par une ou plusieurs lignes vides
    .map((p) => p.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim())
    .filter((p) => p.length >= LONGUEUR_MIN_UNITE);
}

async function chargerJSZip() {
  if (window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = () => resolve(window.JSZip);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export async function extraireParagraphesDocx(fichier) {
  const JSZip = await chargerJSZip();
  const zip = await JSZip.loadAsync(await fichier.arrayBuffer());
  const xml = await zip.file("word/document.xml").async("string");

  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const paras = doc.getElementsByTagNameNS(ns, "p");

  const unités = [];
  for (const p of paras) {
    const texte = Array.from(p.getElementsByTagNameNS(ns, "t"))
      .map((t) => t.textContent).join("").trim();
    if (texte.length >= LONGUEUR_MIN_UNITE) unités.push(texte);
  }
  return unités;
}

// Reprend, à l'identique, la résolution de niveaux de titre RÉELS de
// ImportDocx.jsx (voir le commentaire d'en-tête de ce fichier) — dupliquée
// ici pour garder ce fichier autonome.
function résoudreNiveauxStyles(stylesXml) {
  if (!stylesXml) return {};
  const doc = new DOMParser().parseFromString(stylesXml, "text/xml");
  const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const styleEls = Array.from(doc.getElementsByTagNameNS(ns, "style"));

  const parentDe = {};
  const niveauDirect = {};
  for (const s of styleEls) {
    const styleId = s.getAttribute("w:styleId");
    if (!styleId) continue;
    const basedOn = s.getElementsByTagNameNS(ns, "basedOn")[0]?.getAttribute("w:val");
    if (basedOn) parentDe[styleId] = basedOn;
    const outlineLvl = s.getElementsByTagNameNS(ns, "outlineLvl")[0]?.getAttribute("w:val");
    if (outlineLvl !== undefined && outlineLvl !== null) niveauDirect[styleId] = parseInt(outlineLvl, 10);
  }

  const résolu = {};
  const résoudre = (styleId, vus) => {
    if (résolu[styleId] !== undefined) return résolu[styleId];
    if (vus.has(styleId)) return undefined; // chaîne basedOn circulaire — sécurité
    vus.add(styleId);
    if (niveauDirect[styleId] !== undefined) { résolu[styleId] = niveauDirect[styleId]; return résolu[styleId]; }
    const parent = parentDe[styleId];
    const n = parent ? résoudre(parent, vus) : undefined;
    if (n !== undefined) résolu[styleId] = n;
    return n;
  };

  for (const styleId of new Set([...Object.keys(parentDe), ...Object.keys(niveauDirect)])) {
    résoudre(styleId, new Set());
  }
  return résolu;
}

function niveauDepuisNomStyle(styleId) {
  const m = /^(?:titre|heading)\s*(\d)/i.exec(styleId || "");
  return m ? parseInt(m[1], 10) - 1 : undefined;
}

// Styles à toujours ignorer même s'ils portent un niveau de titre (table
// des matières, métadonnées) — reprise directe de la liste ImportDocx.jsx.
const STYLES_IGNORÉS = new Set([
  "TM1", "TM2", "TM3", "TM4", "TM5", "TM6", "TM7", "TM8", "TM9",
  "EntryChap", "EntryPart", "EntryNormal", "EntrySub",
  "TomeTitle", "Volume", "En-ttedetabledesmatires", "Sous-titre",
]);

/**
 * Variante de extraireParagraphesDocx() qui détecte aussi les chapitres —
 * voir le commentaire d'en-tête du fichier pour le principe (un seul
 * niveau choisi automatiquement, pas de distinction Partie/Chapitre).
 * Renvoie { unités, chapitres, niveauChapitre } :
 *  - unités : mêmes unités de texte qu'extraireParagraphesDocx() (les
 *    paragraphes de titre eux-mêmes n'en font pas partie — un titre isolé
 *    de quelques mots n'apporte rien à auditer en tant que tel).
 *  - chapitres : [{ titre, indexPremièreUnité, nombreUnités, mots }], dans
 *    l'ordre du document. Vide si aucune structure de titres répétée n'a
 *    été détectée (niveauChapitre reste alors `null`).
 *  - niveauChapitre : le niveau de titre (1-based) choisi, ou `null`.
 */
export async function extraireParagraphesDocxAvecChapitres(fichier) {
  const JSZip = await chargerJSZip();
  const zip = await JSZip.loadAsync(await fichier.arrayBuffer());
  const xml = await zip.file("word/document.xml").async("string");
  const stylesXml = await zip.file("word/styles.xml")?.async("string");
  const niveauxParStyle = résoudreNiveauxStyles(stylesXml);

  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const paras = Array.from(doc.getElementsByTagNameNS(ns, "p"));

  // Passage 1 — relever le niveau de chaque paragraphe de titre, compter
  // les occurrences par niveau pour choisir automatiquement "le" niveau
  // chapitre (celui qui revient le plus souvent, à condition d'apparaître
  // au moins deux fois — une seule occurrence n'est pas une structure).
  const infos = [];
  const comptageParNiveau = {};
  for (const p of paras) {
    const style = p.getElementsByTagNameNS(ns, "pStyle")[0]?.getAttribute("w:val") || "";
    const texte = Array.from(p.getElementsByTagNameNS(ns, "t")).map((t) => t.textContent).join("").trim();
    if (!texte || STYLES_IGNORÉS.has(style)) { infos.push({ texte: "", niveau: undefined }); continue; }

    const niveauParagraphe = p.getElementsByTagNameNS(ns, "pPr")[0]
      ?.getElementsByTagNameNS(ns, "outlineLvl")[0]?.getAttribute("w:val");
    const niveau0Based = niveauParagraphe !== undefined && niveauParagraphe !== null
      ? parseInt(niveauParagraphe, 10)
      : (niveauxParStyle[style] !== undefined ? niveauxParStyle[style] : niveauDepuisNomStyle(style));
    const niveau = niveau0Based !== undefined ? niveau0Based + 1 : undefined;

    infos.push({ texte, niveau });
    if (niveau !== undefined) comptageParNiveau[niveau] = (comptageParNiveau[niveau] || 0) + 1;
  }

  let niveauChapitre = null;
  let meilleurCompte = 1; // il en faut au moins 2 pour constituer une structure
  for (const [niveauTexte, compte] of Object.entries(comptageParNiveau)) {
    const niveau = parseInt(niveauTexte, 10);
    if (compte > meilleurCompte || (compte === meilleurCompte && (niveauChapitre === null || niveau < niveauChapitre))) {
      meilleurCompte = compte;
      niveauChapitre = niveau;
    }
  }

  // Passage 2 — regrouper les unités par chapitre selon le niveau choisi.
  const unités = [];
  const chapitres = [];
  let chapitreCourant = null;
  for (const { texte, niveau } of infos) {
    if (!texte) continue;
    if (niveauChapitre !== null && niveau === niveauChapitre) {
      if (chapitreCourant) chapitres.push(chapitreCourant);
      chapitreCourant = { titre: texte, indexPremièreUnité: unités.length, nombreUnités: 0, mots: 0 };
      continue;
    }
    if (texte.length >= LONGUEUR_MIN_UNITE) {
      unités.push(texte);
      if (chapitreCourant) {
        chapitreCourant.nombreUnités += 1;
        chapitreCourant.mots += texte.split(/\s+/).filter(Boolean).length;
      }
    }
  }
  if (chapitreCourant) chapitres.push(chapitreCourant);

  return { unités, chapitres, niveauChapitre };
}
