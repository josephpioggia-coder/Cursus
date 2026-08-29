/**
 * CURSAUDIT — Export Word (.docx) du contrat d'intention / questionnaire de
 * qualification (référence 60816-01, suite, 29/08/2026).
 *
 * Demande explicite de l'auteur du projet, après avoir cherché en vain un
 * moyen de garder une trace lisible de ses réponses une fois arrivé au
 * bout du questionnaire : "j'aurais bien aimé pouvoir le sauvegarder... le
 * sortir en Word... qu'il existe quelque part, que je puisse le
 * réinjecter". Le JSON existait déjà (voir exporterContratJSON dans
 * CursAuditQuestionnaire.jsx) mais n'est pas un format que l'on relit
 * confortablement soi-même — ce document Word est un COMPLÉMENT lisible,
 * pas un remplacement du JSON (seul le JSON reste réimportable dans
 * l'app).
 *
 * Même principe que exportFicheActionWord.js/exportPreauditWord.js :
 * génération 100% côté navigateur avec la librairie `docx`, téléchargement
 * direct via un Blob, aucun appel serveur.
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } from "docx";
import { nomDeFichierSûr } from "./exportWord.js";

const COULEUR_ACCENT = "5B52C4";
const COULEUR_TEXTE_ATTENUE = "666666";

function titre(texte) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 120 }, text: texte });
}

function paragraphe(texte) {
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 140 }, children: [new TextRun(texte || "—")] });
}

function puce(texte) {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun(texte)] });
}

// Section "cases cochées (+ Autre)" — motif répété pour les 5 questions à
// cases du questionnaire (objectifs, destinataires, finalités, critères de
// réussite, ce que l'auteur·ice espère découvrir).
function sectionCases(intitulé, valeurs, autre) {
  const blocs = [titre(intitulé)];
  if ((!valeurs || valeurs.length === 0) && !autre) {
    blocs.push(paragraphe("—"));
    return blocs;
  }
  (valeurs || []).forEach((v) => blocs.push(puce(v)));
  if (autre) blocs.push(puce(`Autre : ${autre}`));
  return blocs;
}

/**
 * Génère et déclenche le téléchargement du fichier Word du contrat
 * d'intention complet.
 * @param {object} contrat — objet complet tel que construit par
 *   contratComplet() dans CursAuditQuestionnaire.jsx (contratIntentionActuel()
 *   + degreIntervention + contraintesAcademiques + relationIA).
 * @param {string} titreProjet — nom du projet, pour la page de garde et le nom de fichier.
 */
export async function exporterContratIntentionWord(contrat, titreProjet) {
  const pageDeTitre = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000, after: 200 },
      children: [new TextRun({ text: "Contrat d'intention", bold: true, size: 40, color: COULEUR_ACCENT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: titreProjet || "Sans titre", size: 32 })],
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

  const contenu = [];

  contenu.push(titre("Nature du projet"));
  contenu.push(paragraphe(contrat.natureProjet?.label || "—"));

  contenu.push(titre("Où en êtes-vous dans ce projet ?"));
  contenu.push(paragraphe(contrat.ouEnEtesVous));

  contenu.push(...sectionCases("Pourquoi écrivez-vous ?", contrat.objectifs, contrat.objectifsAutre));
  contenu.push(...sectionCases("Pour qui écrivez-vous ?", contrat.destinataires, contrat.destinatairesAutre));
  contenu.push(...sectionCases("Qu'attendez-vous de cet audit ?", contrat.attentesCursus, contrat.attentesCursusAutre));
  contenu.push(...sectionCases("À quoi reconnaîtrez-vous que ce projet est réussi ?", contrat.criteresReussite, contrat.criteresReussiteAutre));
  contenu.push(...sectionCases("Qu'espérez-vous découvrir que vous ignorez encore ?", contrat.ceQueVousEspérezDécouvrir, contrat.ceQueVousEspérezDécouvrirAutre));

  contenu.push(...sectionCases("Préoccupations éditoriales pour la question précise", contrat.preoccupations, contrat.preoccupationAutre));

  contenu.push(titre("Question centrale validée"));
  contenu.push(paragraphe(contrat.questionLibre));

  contenu.push(titre("Que peut faire CursAudit ?"));
  contenu.push(paragraphe(contrat.degreIntervention));

  if (contrat.contraintesAcademiques) {
    contenu.push(titre("Contraintes académiques"));
    contenu.push(paragraphe(`Autorisation de l'établissement : ${contrat.contraintesAcademiques.autorisationIA || "non précisée"}`));
    if (contrat.contraintesAcademiques.conditions?.length > 0) {
      contrat.contraintesAcademiques.conditions.forEach((c) => contenu.push(puce(c)));
    }
  }

  if (contrat.relationIA) {
    contenu.push(titre("Comment voulez-vous que l'IA vous parle ?"));
    const r = contrat.relationIA;
    contenu.push(paragraphe(
      `${r.adresse === "vous" ? "Vouvoiement" : "Tutoiement"}, ton ${r.ton}, posture ${r.posture}, ` +
      `réponses ${r.longueur === "court" ? "courtes" : "détaillées"}, plutôt en ${r.role}.`
    ));
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
          run: { font: "Georgia", size: 28, bold: true, color: COULEUR_ACCENT },
          paragraph: { spacing: { before: 280, after: 120 } },
        },
      },
    },
  });

  const blob = await Packer.toBlob(documentWord);
  const url = URL.createObjectURL(blob);
  const lien = window.document.createElement("a");
  lien.href = url;
  lien.download = `contrat_intention_${nomDeFichierSûr(titreProjet || "brouillon")}.docx`;
  window.document.body.appendChild(lien);
  lien.click();
  window.document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}
