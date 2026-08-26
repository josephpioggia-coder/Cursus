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
 * choisi AUTOMATIQUEMENT : le plus GROSSIER (le plus haut dans la
 * hiérarchie Word — Titre1 avant Titre2 avant Titre3, etc.) parmi les
 * niveaux repérés au moins deux fois (une seule occurrence à un niveau
 * donné ne suffit pas à constituer une vraie structure de chapitres —
 * probablement un sous-titre isolé, pas une division répétée). PAS "le
 * plus répété" (revu le 24/08/2026 — un livre à niveaux imbriqués, ex.
 * 8 titres "FAMILLE" en Titre1 contenant 55 titres "CARTE" en Titre3,
 * donnait 280 "chapitres" au lieu de 8 avec l'ancienne règle). Le client
 * CONFIRME ensuite ce découpage dans l'aperçu gratuit
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
 * Lecture brute d'un .docx — un seul passage sur le document, sans encore
 * choisir de niveau de titre. Renvoie { infos, niveauxDisponibles } :
 *  - infos : [{ texte, niveau }] pour chaque paragraphe, dans l'ordre du
 *    document (niveau 1-based, `undefined` pour un paragraphe sans titre).
 *  - niveauxDisponibles : [{ niveau, nombre }] pour chaque niveau de titre
 *    apparu au moins deux fois (une seule occurrence n'est pas une
 *    structure répétée), trié du plus grossier (niveau 1) au plus fin.
 *
 * Séparée de extraireParagraphesDocxAvecChapitres() le 26/08/2026 (réf.
 * 60816-01, suite) : le choix du/des niveau(x) à retenir comme divisions
 * ne peut plus être automatique à lui seul dans tous les cas — voir
 * regrouperParNiveaux() ci-dessous. `analyserStructureDocx` fait la
 * lecture une fois ; regrouperParNiveaux() peut ensuite être rappelée
 * plusieurs fois (à chaque changement de sélection du client) sans
 * relire le fichier.
 */
export async function analyserStructureDocx(fichier) {
  const JSZip = await chargerJSZip();
  const zip = await JSZip.loadAsync(await fichier.arrayBuffer());
  const xml = await zip.file("word/document.xml").async("string");
  const stylesXml = await zip.file("word/styles.xml")?.async("string");
  const niveauxParStyle = résoudreNiveauxStyles(stylesXml);

  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const paras = Array.from(doc.getElementsByTagNameNS(ns, "p"));

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

  const niveauxDisponibles = Object.entries(comptageParNiveau)
    .map(([niveauTexte, nombre]) => ({ niveau: parseInt(niveauTexte, 10), nombre }))
    .filter(({ nombre }) => nombre >= 2) // une seule occurrence n'est pas une structure répétée
    .sort((a, b) => a.niveau - b.niveau);

  return { infos, niveauxDisponibles };
}

/**
 * Regroupe les unités selon un ENSEMBLE de niveaux de titre retenus comme
 * divisions (ajouté le 26/08/2026, réf. 60816-01, suite — demande de
 * l'auteur du projet : certains livres ont du contenu réel directement
 * sous le niveau le plus grossier, ex. un avant-propos sous une "partie"
 * avant que ses chapitres ne commencent ; d'autres n'en ont aucun. Un seul
 * niveau auto-choisi ne convient donc pas à tous les cas — le client doit
 * pouvoir cocher plusieurs niveaux). Pas de hiérarchie imbriquée : tout
 * niveau retenu délimite une division dans UNE SEULE liste à plat, dans
 * l'ordre du document — cocher un niveau sans contenu propre en dessous
 * ne fait qu'ajouter une entrée quasi vide, sans rien casser.
 *
 * `niveauxRetenus` : tableau ou Set de niveaux (1-based) à traiter comme
 * frontières. Renvoie { unités, chapitres } — même forme qu'avant.
 */
export function regrouperParNiveaux(infos, niveauxRetenus) {
  const retenus = niveauxRetenus instanceof Set ? niveauxRetenus : new Set(niveauxRetenus);

  const unités = [];
  const chapitres = [];
  let chapitreCourant = null;
  for (const { texte, niveau } of infos) {
    if (!texte) continue;
    if (niveau !== undefined && retenus.has(niveau)) {
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

  return { unités, chapitres };
}

/**
 * Variante de extraireParagraphesDocx() qui détecte aussi les chapitres —
 * voir le commentaire d'en-tête du fichier pour le principe (un seul
 * niveau choisi automatiquement, pas de distinction Partie/Chapitre).
 * Conservée telle quelle (wrapper autour de analyserStructureDocx() +
 * regrouperParNiveaux()) pour tout appelant qui n'a pas besoin du choix
 * multi-niveaux — voir CursAudit.jsx pour l'écran qui, lui, appelle
 * directement les deux fonctions séparées.
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
  const { infos, niveauxDisponibles } = await analyserStructureDocx(fichier);

  // CORRECTIF 24/08/2026 (suite) — un livre bien structuré porte souvent
  // PLUSIEURS niveaux de titre imbriqués (ex. "FAMILLE" en Titre1, "CARTE"
  // en Titre3 en dessous) ; le niveau fin (CARTE, largement plus nombreux)
  // n'est PAS le niveau chapitre — c'est le niveau le plus GROSSIER (le
  // plus haut dans la hiérarchie, donc le numéro le plus bas) qui délimite
  // les vraies divisions du livre par défaut. Choisir "le plus répété"
  // prenait systématiquement le niveau le plus fin (constaté sur un vrai
  // manuscrit : 280 "CARTE" en Titre3 retenues comme chapitres au lieu des
  // 8 "FAMILLE" en Titre1).
  const niveauChapitre = niveauxDisponibles.length > 0 ? niveauxDisponibles[0].niveau : null;

  const { unités, chapitres } = regrouperParNiveaux(infos, niveauChapitre !== null ? [niveauChapitre] : []);

  return { unités, chapitres, niveauChapitre };
}

/**
 * Diagnostic qualité d'import — "mise en page" (référence 60816-01, suite,
 * 24/08/2026). Détecte les deux problèmes signalés sur un vrai manuscrit
 * ("Oracle du Sermon sur la montagne") : une segmentation irrégulière
 * (le fichier a été exporté une ligne = un paragraphe, ex. 8,6 mots/unité
 * au lieu de 30-50+ pour une prose normale) et des titres de chapitres
 * quasi inexistants (aucun niveau de titre répété au moins 3 fois, même
 * après la correction du niveau choisi ci-dessus). Les deux sont
 * indépendants — un livre peut présenter l'un, l'autre, les deux ou aucun.
 * Décision de l'auteur du projet le 24/08/2026 : ce n'est PAS un correctif
 * silencieux côté code (fusionner les paragraphes sans rien dire au
 * client fausserait sa perception de son propre manuscrit) — le client
 * doit être informé et choisir : corriger lui-même et réimporter, ou
 * commander la mise en page payante (voir MisEnPageAPI / tarifCursAudit.js
 * pour les deux prix retenus).
 */
const SEUIL_MOTS_MOYEN_PAR_UNITE = 15;
const SEUIL_MIN_UNITES_POUR_DIAGNOSTIC = 50;
const SEUIL_MIN_MOTS_POUR_TITRES = 8000;
const SEUIL_MIN_CHAPITRES = 3;

export function diagnostiquerQualitéImport({ nombreMots, nombreUnités, chapitresDétectés }) {
  const moyenneMotsParUnité = nombreUnités > 0 ? nombreMots / nombreUnités : 0;
  const segmentationIrrégulière = nombreUnités > SEUIL_MIN_UNITES_POUR_DIAGNOSTIC && moyenneMotsParUnité < SEUIL_MOTS_MOYEN_PAR_UNITE;
  const titresQuasiInexistants = nombreMots > SEUIL_MIN_MOTS_POUR_TITRES
    && (!chapitresDétectés || chapitresDétectés.length < SEUIL_MIN_CHAPITRES);

  return { segmentationIrrégulière, titresQuasiInexistants, moyenneMotsParUnité };
}
