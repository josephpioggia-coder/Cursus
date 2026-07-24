/**
 * CURSUS — Export Word (.docx)
 * Ajouté le 21/07/2026. Formats de page ajoutés le 22/07/2026.
 *
 * Génère un document Word complet à partir de la structure d'un projet :
 * page de titre, table des matières (Parties/Chapitres/Scènes), puis le
 * texte de chaque nœud avec sa mise en forme (gras, italique, souligné,
 * surlignage, citations, titres internes, listes, séparateurs).
 *
 * Fonctionne entièrement côté navigateur (pas de serveur) : le fichier .docx
 * est construit en mémoire puis proposé au téléchargement via un Blob.
 *
 * LIMITES CONNUES DE CETTE V1 (à améliorer si besoin, pas bloquant) :
 * - Listes imbriquées (liste dans une liste) non gérées, seulement le
 *   premier niveau.
 * - Listes numérotées : numérotation affichée en texte simple ("1. ", "2. "),
 *   pas une vraie numérotation Word auto-incrémentée.
 * - Notes de bas de page (mentionnées dans l'en-tête d'Editeur.jsx comme
 *   dépendance à installer) : l'extension TipTap correspondante n'est pas
 *   encore active dans l'éditeur à ce jour, donc rien à exporter pour
 *   l'instant sur ce point.
 *
 * Niveaux de titre Word utilisés (important pour la table des matières) :
 *   - Heading 1/2/3 = structure du manuscrit (Partie / Chapitre / Scène)
 *   - Heading 4/5/6 = titres H1/H2/H3 tapés PAR L'AUTEUR à l'intérieur d'un
 *     chapitre (barre d'outils de l'éditeur) — volontairement distincts,
 *     pour que la table des matières ne mélange pas les deux.
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  PageBreak, BorderStyle, TableOfContents,
} from "docx";

const NIVEAU_STRUCTURE = {
  partie: HeadingLevel.HEADING_1,
  chapitre: HeadingLevel.HEADING_2,
  scene: HeadingLevel.HEADING_3,
};

const NIVEAU_TITRE_CORPS = {
  h1: HeadingLevel.HEADING_4,
  h2: HeadingLevel.HEADING_5,
  h3: HeadingLevel.HEADING_6,
};

// Formats de page disponibles à l'export — ajouté 22/07/2026, à la demande
// de Joseph. Dimensions en DXA (1440 = 1 pouce), l'unité attendue par la
// librairie docx. Les marges sont réduites pour les petits formats (poche,
// A5) où des marges standard de 2,5 cm mangeraient une part disproportionnée
// de la page.
export const FORMATS_PAGE = {
  a4: {
    label: "A4 (21 × 29,7 cm) — manuscrit de travail",
    width: 11906, height: 16838, margin: 1440,
  },
  a5: {
    label: "A5 (14,8 × 21 cm) — format livre courant",
    width: 8392, height: 11906, margin: 850,
  },
  poche: {
    label: "Poche (11 × 18 cm)",
    width: 6236, height: 10205, margin: 620,
  },
  broche: {
    label: "Broché standard (15,24 × 22,86 cm — 6×9\")",
    width: 8640, height: 12960, margin: 1080,
  },
};

// Construit les segments de texte (TextRun) d'un nœud DOM, en respectant le
// gras/italique/souligné/surlignage même imbriqués (ex. gras ET italique sur
// le même passage). `styleInitial` permet de forcer un style de départ
// (utilisé pour les citations, toujours en italique).
function runsDepuisNœudDOM(nœudDOM, styleInitial = {}) {
  const runs = [];

  const parcourir = (n, style) => {
    if (n.nodeType === Node.TEXT_NODE) {
      if (n.textContent) {
        runs.push(new TextRun({
          text: n.textContent,
          bold: style.gras || undefined,
          italics: style.italique || undefined,
          underline: style.souligné ? {} : undefined,
          highlight: style.surligné ? "yellow" : undefined,
          font: style.code ? "Courier New" : undefined,
        }));
      }
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;

    const tag = n.tagName.toLowerCase();
    const nouveauStyle = { ...style };
    if (tag === "strong" || tag === "b") nouveauStyle.gras = true;
    if (tag === "em" || tag === "i") nouveauStyle.italique = true;
    if (tag === "u") nouveauStyle.souligné = true;
    if (tag === "mark") nouveauStyle.surligné = true;
    if (tag === "code") nouveauStyle.code = true;

    n.childNodes.forEach((enfant) => parcourir(enfant, nouveauStyle));
  };

  nœudDOM.childNodes.forEach((enfant) => parcourir(enfant, styleInitial));
  return runs.length > 0 ? runs : [new TextRun("")];
}

// Convertit le HTML d'un nœud (produit par TipTap) en une liste de
// paragraphes Word. Un seul niveau de balises est géré (pas de récursion
// dans les listes) — suffisant pour le contenu réel observé à ce jour.
function paragraphesDepuisHTML(html) {
  const dom = new DOMParser().parseFromString(html || "", "text/html");
  const paragraphes = [];

  dom.body.childNodes.forEach((n) => {
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const tag = n.tagName.toLowerCase();

    if (tag === "p") {
      paragraphes.push(new Paragraph({ children: runsDepuisNœudDOM(n), spacing: { after: 160 } }));
    } else if (tag === "h1" || tag === "h2" || tag === "h3") {
      paragraphes.push(new Paragraph({ heading: NIVEAU_TITRE_CORPS[tag], children: runsDepuisNœudDOM(n) }));
    } else if (tag === "blockquote") {
      paragraphes.push(new Paragraph({
        indent: { left: 720 },
        spacing: { before: 120, after: 160 },
        children: runsDepuisNœudDOM(n, { italique: true }),
      }));
    } else if (tag === "ul") {
      n.querySelectorAll(":scope > li").forEach((li) => {
        paragraphes.push(new Paragraph({ bullet: { level: 0 }, children: runsDepuisNœudDOM(li) }));
      });
    } else if (tag === "ol") {
      Array.from(n.querySelectorAll(":scope > li")).forEach((li, index) => {
        const runs = runsDepuisNœudDOM(li);
        paragraphes.push(new Paragraph({ children: [new TextRun(`${index + 1}. `), ...runs] }));
      });
    } else if (tag === "hr") {
      paragraphes.push(new Paragraph({
        spacing: { before: 200, after: 200 },
        border: { bottom: { color: "CCCCCC", space: 1, style: BorderStyle.SINGLE, size: 6 } },
      }));
    } else if (tag === "pre") {
      paragraphes.push(new Paragraph({ children: [new TextRun({ text: n.textContent, font: "Courier New" })] }));
    } else {
      // Balise non reconnue : traitée comme un paragraphe simple plutôt
      // qu'ignorée, pour ne jamais perdre silencieusement du contenu.
      paragraphes.push(new Paragraph({ children: runsDepuisNœudDOM(n) }));
    }
  });

  return paragraphes.length > 0 ? paragraphes : [];
}

// Nettoie un titre de projet pour en faire un nom de fichier sûr (garde
// lettres, chiffres, espaces → underscore).
function nomDeFichierSûr(titre) {
  return (titre || "manuscrit")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // retire les accents
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "manuscrit";
}

/**
 * Génère et déclenche le téléchargement du fichier Word pour un projet.
 * @param {object} projet — { titre, genre, structure } tel que manipulé dans App.jsx
 * @param {string} formatPage — clé de FORMATS_PAGE ("a4", "a5", "poche", "broche"). Défaut : "a4".
 */
export async function exporterProjetWord(projet, formatPage = "a4") {
  const format = FORMATS_PAGE[formatPage] || FORMATS_PAGE.a4;

  const pageDeTitre = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2400, after: 400 },
      children: [new TextRun({ text: projet.titre || "Sans titre", bold: true, size: 56 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 4800 },
      children: [new TextRun({ text: projet.genre || "", size: 24, color: "666666" })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  const sommaire = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, text: "Table des matières" }),
    new TableOfContents("Table des matières", { hyperlink: true, headingStyleRange: "1-3" }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  const contenu = [];
  const parcourirStructure = (nœuds) => {
    for (const n of nœuds) {
      const niveau = NIVEAU_STRUCTURE[n.type] || HeadingLevel.HEADING_3;
      contenu.push(new Paragraph({
        heading: niveau,
        text: n.titre || "",
        pageBreakBefore: n.type === "partie" || n.type === "chapitre" || n.type === "scene",
      }));
      if (n.texte && n.texte.trim()) {
        contenu.push(...paragraphesDepuisHTML(n.texte));
      }
      if (n.enfants?.length) parcourirStructure(n.enfants);
    }
  };
  parcourirStructure(projet.structure || []);

  const documentWord = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: format.width, height: format.height },
          margin: { top: format.margin, bottom: format.margin, left: format.margin, right: format.margin },
        },
      },
      children: [...pageDeTitre, ...sommaire, ...contenu],
    }],
    styles: {
      default: {
        document: { run: { font: "Georgia", size: 24 } },
      },
    },
  });

  const blob = await Packer.toBlob(documentWord);
  const url = URL.createObjectURL(blob);
  const lien = window.document.createElement("a");
  lien.href = url;
  lien.download = `${nomDeFichierSûr(projet.titre)}.docx`;
  window.document.body.appendChild(lien);
  lien.click();
  window.document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}
