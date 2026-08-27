/**
 * CURSUS — Export Word (.docx) de l'audit détaillé CursAudit (référence
 * 60816-01, suite, 27/08/2026) — signalé par l'auteur du projet : une fois
 * l'audit détaillé terminé (les ~1400+ unités analysées), rien ne
 * permettait d'en sortir un document — juste un écran qui dit "terminé" et
 * des filtres par catégorie, aucun livrable transmissible au client. Même
 * principe que exportPreauditWord.js : génération 100% côté navigateur avec
 * `docx`, téléchargement direct via un Blob, aucun appel serveur.
 *
 * Structure : page de garde, résumé des comptages par catégorie de
 * diagnostic_priorite (mêmes catégories que CATEGORIES_DIAGNOSTIC dans
 * CursAuditDetail.jsx — dupliquées ici, fichier autonome, même convention
 * que les Edge Functions), puis une entrée par unité analysée dans l'ordre
 * du livre : extrait du texte source, critères actifs (valeur + commentaire)
 * et synthèse éditoriale. Les unités en échec ou pas encore analysées sont
 * ignorées (rien à documenter pour elles).
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, TableOfContents } from "docx";
import { nomDeFichierSûr } from "./exportWord.js";

const COULEUR_ACCENT = "5B52C4";
const COULEUR_TEXTE_ATTENUE = "666666";

const CATEGORIES_DIAGNOSTIC = [
  { id: "recevable",    label: "Recevable" },
  { id: "a_nuancer",    label: "À nuancer" },
  { id: "a_sourcer",    label: "À sourcer" },
  { id: "a_reformuler", label: "À reformuler" },
  { id: "a_verifier",   label: "À vérifier" },
];

function humaniserCle(cle) {
  return cle.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function titre(texte, niveau = HeadingLevel.HEADING_1) {
  return new Paragraph({ heading: niveau, spacing: { before: 320, after: 120 }, text: texte });
}

function paragraphe(texte, options = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 140 },
    children: [new TextRun({ text: texte || "", ...options })],
  });
}

function ligneÉtiquette(étiquette, valeur) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${étiquette} — `, bold: true }),
      new TextRun({ text: valeur || "" }),
    ],
  });
}

function tronquer(texte, max) {
  if (!texte) return "";
  return texte.length > max ? texte.slice(0, max).trim() + "…" : texte;
}

function sectionUnité(section) {
  const analyse = section.resultat_analyse?.analyse;
  if (!analyse) return [];

  const bloc = [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 280, after: 80 },
      text: `#${section.ordre} — ${tronquer(section.texte_source, 80)}`,
    }),
    paragraphe(tronquer(section.texte_source, 220), { italics: true, color: COULEUR_TEXTE_ATTENUE }),
  ];

  const catégories = analyse.diagnostic_priorite?.valeur || [];
  if (catégories.length > 0) {
    const labels = catégories.map((id) => CATEGORIES_DIAGNOSTIC.find((c) => c.id === id)?.label || id);
    bloc.push(ligneÉtiquette("Diagnostic", labels.join(", ")));
  }

  // Les critères actifs, dans l'ordre où ils apparaissent dans l'analyse —
  // diagnostic_priorite déjà traité ci-dessus, proposition traité à part
  // (chaîne simple, pas {valeur, commentaire}, voir analyser-unite-cursaudit).
  for (const [clé, val] of Object.entries(analyse)) {
    if (clé === "diagnostic_priorite" || clé === "proposition" || !val || typeof val !== "object") continue;
    if (!val.valeur && !val.commentaire) continue;
    const valeurTexte = Array.isArray(val.valeur) ? val.valeur.join(", ") : val.valeur;
    bloc.push(ligneÉtiquette(humaniserCle(clé), valeurTexte));
    if (val.commentaire) bloc.push(paragraphe(val.commentaire));
  }

  if (analyse.proposition) {
    bloc.push(ligneÉtiquette("Proposition", analyse.proposition));
  }

  return bloc;
}

/**
 * Génère et déclenche le téléchargement du fichier Word de l'audit détaillé.
 * @param {object} audit — l'audit tel que chargé par CursAuditDetail (titre du livre).
 * @param {Array} sections — audit_sections triées par ordre, avec resultat_analyse.
 */
export async function exporterAuditDetailleWord(audit, sections) {
  const analysées = (sections || []).filter((s) => s.resultat_analyse && !s.resultat_analyse.erreur);

  const comptages = Object.fromEntries(CATEGORIES_DIAGNOSTIC.map((c) => [c.id, 0]));
  for (const s of analysées) {
    const valeurs = s.resultat_analyse.analyse?.diagnostic_priorite?.valeur || [];
    for (const v of valeurs) if (comptages[v] !== undefined) comptages[v] += 1;
  }

  const pageDeTitre = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000, after: 200 },
      children: [new TextRun({ text: "Audit détaillé", bold: true, size: 40, color: COULEUR_ACCENT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: audit.titre || "Sans titre", size: 32 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 3600 },
      children: [new TextRun({
        text: new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
        size: 20, color: COULEUR_TEXTE_ATTENUE,
      })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  const résumé = [
    titre("Résumé"),
    paragraphe(`${analysées.length} unité${analysées.length > 1 ? "s" : ""} analysée${analysées.length > 1 ? "s" : ""} sur ${(sections || []).length}.`),
    ...CATEGORIES_DIAGNOSTIC.map((c) => ligneÉtiquette(c.label, String(comptages[c.id]))),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  const sommaire = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, text: "Table des matières" }),
    new TableOfContents("Table des matières", { hyperlink: true, headingStyleRange: "1-2" }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  const contenu = analysées.flatMap((s) => sectionUnité(s));

  const documentWord = new Document({
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      children: [...pageDeTitre, ...résumé, ...sommaire, ...contenu],
    }],
    styles: {
      default: {
        document: { run: { font: "Georgia", size: 22 } },
        heading1: { run: { font: "Georgia", size: 30, bold: true, color: COULEUR_ACCENT }, paragraph: { spacing: { before: 320, after: 140 } } },
        heading2: { run: { font: "Georgia", size: 24, bold: true, color: "3D3670" }, paragraph: { spacing: { before: 240, after: 100 } } },
      },
    },
  });

  const blob = await Packer.toBlob(documentWord);
  const url = URL.createObjectURL(blob);
  const lien = window.document.createElement("a");
  lien.href = url;
  lien.download = `audit_detaille_${nomDeFichierSûr(audit.titre)}.docx`;
  window.document.body.appendChild(lien);
  lien.click();
  window.document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}
