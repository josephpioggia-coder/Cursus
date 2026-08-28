/**
 * CURSUS — Export Word (.docx) de la fiche d'action éditoriale / du rapport
 * consolidé CursAudit (référence 60816-01, suite, 28/08/2026).
 *
 * Un seul schéma de sortie partagé (diagnostic/forces/points_a_traiter/
 * priorites/risque_principal/action_immediate/a_eviter — voir
 * SCHEMA_FICHE_ACTION dans fiche-action-preaudit-cursaudit/index.ts et
 * synthese-audit-detaille-cursaudit/index.ts), donc un seul exporteur pour
 * les deux documents : la fiche d'action du pré-audit ET le rapport
 * consolidé de l'audit détaillé (ex-"synthèse"). Même principe que
 * exportPreauditWord.js et exportAuditDetailleWord.js : génération 100%
 * côté navigateur avec la librairie `docx`, téléchargement direct via un
 * Blob, aucun appel serveur.
 *
 * Manquait jusqu'ici — signalé par l'auteur du projet le 28/08/2026 : les
 * deux documents étaient consultables à l'écran mais aucun bouton
 * n'existait pour les exporter en Word, contrairement au pré-audit complet
 * et à l'audit détaillé brut.
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } from "docx";
import { nomDeFichierSûr } from "./exportWord.js";

const COULEUR_ACCENT = "1D9E75";
const COULEUR_TEXTE_ATTENUE = "666666";
const COULEUR_RISQUE = "A32D2D";
const COULEUR_ACTION = "1D9E75";

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

function puce(texte) {
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun(texte || "")] });
}

function puceNumérotée(texte, index) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 60 },
    children: [new TextRun({ text: `${index + 1}. `, bold: true }), new TextRun(texte || "")],
  });
}

/**
 * Génère et déclenche le téléchargement du fichier Word d'une fiche
 * d'action / d'un rapport consolidé.
 * @param {object} audit — l'audit tel que chargé par CursAuditDetail (utilisé pour le titre du livre).
 * @param {object} fiche — audit.fiche_action_resultat OU audit.synthese_audit_resultat (SCHEMA_FICHE_ACTION).
 * @param {{titreDocument: string, prefixeFichier: string}} options — titre affiché en page de garde et préfixe du nom de fichier téléchargé.
 */
export async function exporterFicheActionWord(audit, fiche, { titreDocument, prefixeFichier }) {
  const pageDeTitre = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000, after: 200 },
      children: [new TextRun({ text: titreDocument, bold: true, size: 40, color: COULEUR_ACCENT })],
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
        text: fiche.analyse_le ? new Date(fiche.analyse_le).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "",
        size: 20, color: COULEUR_TEXTE_ATTENUE,
      })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  const contenu = [];

  if (fiche.diagnostic) {
    contenu.push(titre("Diagnostic"));
    contenu.push(paragraphe(fiche.diagnostic));
  }

  if (fiche.forces?.length > 0) {
    contenu.push(titre("Ce qui tient déjà"));
    fiche.forces.forEach((f) => contenu.push(puce(f)));
  }

  if (fiche.points_a_traiter?.length > 0) {
    contenu.push(titre("Points à traiter"));
    fiche.points_a_traiter.forEach((p, i) => {
      contenu.push(new Paragraph({ spacing: { before: 160, after: 20 }, children: [new TextRun({ text: `${i + 1}. ${p.constat || ""}`, bold: true })] }));
      contenu.push(paragraphe(p.impact_lecteur));
      contenu.push(paragraphe(`→ ${p.geste_concret || ""}`, { color: COULEUR_ACCENT }));
    });
  }

  if (fiche.priorites?.length > 0) {
    contenu.push(titre("Priorités de réécriture"));
    [...fiche.priorites].sort((a, b) => a.rang.localeCompare(b.rang)).forEach((p, i) => contenu.push(puceNumérotée(p.action, i)));
  }

  if (fiche.risque_principal) {
    contenu.push(titre("Risque si rien ne change"));
    contenu.push(paragraphe(fiche.risque_principal, { color: COULEUR_RISQUE }));
  }

  if (fiche.action_immediate) {
    contenu.push(titre("Première action"));
    contenu.push(paragraphe(fiche.action_immediate, { bold: true, color: COULEUR_ACTION }));
  }

  if (fiche.a_eviter?.length > 0) {
    contenu.push(titre("À éviter"));
    fiche.a_eviter.forEach((a) => contenu.push(puce(a)));
  }

  const documentWord = new Document({
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      children: [...pageDeTitre, ...contenu],
    }],
    styles: {
      default: {
        document: { run: { font: "Georgia", size: 22 } },
        heading1: {
          run: { font: "Georgia", size: 30, bold: true, color: COULEUR_ACCENT },
          paragraph: { spacing: { before: 320, after: 140 } },
        },
      },
    },
  });

  const blob = await Packer.toBlob(documentWord);
  const url = URL.createObjectURL(blob);
  const lien = window.document.createElement("a");
  lien.href = url;
  lien.download = `${prefixeFichier}_${nomDeFichierSûr(audit.titre)}.docx`;
  window.document.body.appendChild(lien);
  lien.click();
  window.document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}
