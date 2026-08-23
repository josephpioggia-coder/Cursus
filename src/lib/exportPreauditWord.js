/**
 * CURSUS — Export Word (.docx) du pré-audit approfondi CursAudit (référence
 * 60816-01, suite, 23/08/2026).
 *
 * Transforme `audit.preaudit_resultat` (voir SCHEMA_PREAUDIT_APPROFONDI dans
 * supabase/functions/preaudit-approfondi-cursaudit/index.ts) en un document
 * Word présentable au client. Même principe que exportWord.js (manuscrit) :
 * génération 100% côté navigateur avec la librairie `docx`, téléchargement
 * direct via un Blob, aucun appel serveur.
 *
 * VOLONTAIREMENT EXCLU de ce document : `resultat.revision.critique_gpt`.
 * C'est une trace de contrôle qualité interne (le "second avis" qui a permis
 * d'amender le brouillon), pas un contenu destiné au client — voir le
 * commentaire de PreauditApprofondi dans CursAuditDetail.jsx, qui l'affiche
 * uniquement en repli (<details>) dans l'application.
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak,
} from "docx";
import { nomDeFichierSûr } from "./exportWord.js";

const COULEUR_ACCENT = "5B52C4";
const COULEUR_TEXTE_ATTENUE = "666666";
const COULEUR_POSITIF = "1D9E75";

// Deux niveaux de titre seulement dans ce document, pour garder une
// hiérarchie simple et sans ambiguïté : HEADING_1 pour chaque section du
// rapport (Résumé exécutif, Voies éditoriales, Plan d'intervention...),
// HEADING_2 pour les seules sous-sections imbriquées (à l'intérieur de
// "Cartographie du contexte"). Les tailles/couleurs des deux niveaux sont
// définies une fois dans `styles.default` (voir plus bas) et décroissent
// strictement — aucun texte du corps (labels en gras, "Explicite —",
// "Problème —"...) ne dépasse jamais la taille du corps de texte, donc ne
// peut jamais paraître plus important qu'un vrai titre. Correctif du
// 23/08/2026 : avant, une partie des sections de même niveau logique
// utilisait HEADING_1 et l'autre HEADING_2 sans raison — incohérence
// signalée par l'auteur du projet.
function titre(texte, niveau = HeadingLevel.HEADING_1) {
  return new Paragraph({ heading: niveau, spacing: { before: 320, after: 120 }, text: texte });
}

function paragraphe(texte, options = {}) {
  return new Paragraph({
    spacing: { after: 140 },
    children: [new TextRun({ text: texte || "", ...options })],
  });
}

function ligneÉtiquette(étiquette, valeur) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${étiquette} — `, bold: true }),
      new TextRun({ text: valeur || "" }),
    ],
  });
}

function puce(texte) {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun(texte || "")] });
}

// Bloc encadré simulé : docx n'a pas de "carte" native, on simule avec un
// paragraphe de titre en gras coloré suivi du contenu — suffisant pour la
// lisibilité d'un rapport, sans la complexité d'un vrai tableau/bordure par
// bloc (qui existe dans la librairie mais alourdirait ce fichier pour un
// gain visuel marginal dans un .docx destiné à être lu, pas mis en page).
function blocTitré(étiquette, texte, couleur = COULEUR_ACCENT) {
  return [
    new Paragraph({ spacing: { before: 100, after: 20 }, children: [new TextRun({ text: étiquette, bold: true, color: couleur })] }),
    paragraphe(texte),
  ];
}

function sectionVoiesÉditoriales(voies) {
  const blocs = [titre("Voies éditoriales possibles")];
  (voies || []).forEach((v) => {
    blocs.push(new Paragraph({
      spacing: { before: 160, after: 20 },
      children: [
        new TextRun({ text: v.nom || "", bold: true }),
        new TextRun({ text: `  (réécriture ${v.ampleur_reecriture || "—"}${v.duree_estimee_travail ? `, ${v.duree_estimee_travail}` : ""})`, italics: true, color: COULEUR_TEXTE_ATTENUE }),
      ],
    }));
    blocs.push(paragraphe(v.description));
  });
  return blocs;
}

function sectionPlanIntervention(chantiers) {
  const blocs = [titre("Plan d'intervention")];
  (chantiers || []).forEach((c, i) => {
    blocs.push(new Paragraph({
      spacing: { before: 140, after: 20 },
      children: [new TextRun({ text: `${i + 1}. ${c.chantier || ""}`, bold: true })],
    }));
    blocs.push(paragraphe(c.geste_editorial));
  });
  return blocs;
}

function sectionExemplesConcrets(exemples) {
  const blocs = [titre("Exemples concrets")];
  (exemples || []).forEach((ex, i) => {
    blocs.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [new TextRun({ text: `Exemple ${i + 1}`, bold: true, color: COULEUR_ACCENT })] }));
    blocs.push(...blocTitré("Problème", ex.probleme, "000000"));
    blocs.push(...blocTitré("Effet", ex.effet, "000000"));
    blocs.push(...blocTitré("Geste éditorial", ex.geste_editorial, COULEUR_ACCENT));
    blocs.push(...blocTitré("Proposition", ex.proposition, COULEUR_POSITIF));
  });
  return blocs;
}

function sectionCartographie(carto) {
  if (!carto) return [];
  const blocs = [titre("Cartographie du contexte")];

  if (carto.personnages_principaux?.length > 0) {
    blocs.push(titre("Personnages principaux", HeadingLevel.HEADING_2));
    carto.personnages_principaux.forEach((p) => {
      blocs.push(new Paragraph({
        spacing: { before: 100, after: 20 },
        children: [
          new TextRun({ text: p.nom || "", bold: true }),
          new TextRun({ text: `  — ${p.role || ""}`, color: COULEUR_TEXTE_ATTENUE }),
        ],
      }));
      blocs.push(...blocTitré("Explicite", p.explicite, "000000"));
      blocs.push(...blocTitré("À développer", p.a_developper, COULEUR_ACCENT));
    });
  }

  if (carto.lieux_principaux?.length > 0) {
    blocs.push(titre("Lieux principaux", HeadingLevel.HEADING_2));
    carto.lieux_principaux.forEach((l) => {
      blocs.push(new Paragraph({
        spacing: { before: 100, after: 20 },
        children: [
          new TextRun({ text: l.nom || "", bold: true }),
          new TextRun({ text: `  — ${l.fonction || ""}`, color: COULEUR_TEXTE_ATTENUE }),
        ],
      }));
      blocs.push(...blocTitré("À enrichir", l.a_enrichir, COULEUR_ACCENT));
    });
  }

  if (carto.carte_sensorielle) {
    blocs.push(titre("Carte sensorielle", HeadingLevel.HEADING_2));
    blocs.push(ligneÉtiquette("Sens développés", (carto.carte_sensorielle.sens_developpes || []).join(", ") || "—"));
    blocs.push(ligneÉtiquette("Sens sous-exploités", (carto.carte_sensorielle.sens_sous_exploites || []).join(", ") || "—"));
    blocs.push(paragraphe(carto.carte_sensorielle.diagnostic));
  }

  if (carto.objets_motifs?.length > 0) {
    blocs.push(titre("Objets et motifs récurrents", HeadingLevel.HEADING_2));
    carto.objets_motifs.forEach((o) => {
      blocs.push(new Paragraph({ spacing: { before: 100, after: 20 }, children: [new TextRun({ text: o.element || "", bold: true })] }));
      blocs.push(paragraphe(o.fonction_symbolique));
      blocs.push(...blocTitré("Potentiel inexploité", o.potentiel_inexploite, COULEUR_ACCENT));
    });
  }

  if (carto.domaines_a_verifier?.length > 0) {
    blocs.push(ligneÉtiquette("Domaines à documenter ou vérifier", carto.domaines_a_verifier.join(" · ")));
  }
  if (carto.voix) blocs.push(ligneÉtiquette("Voix", carto.voix));
  if (carto.densite) blocs.push(ligneÉtiquette("Densité", carto.densite));
  if (carto.valeur_ajoutee_audit_complet) {
    blocs.push(...blocTitré("Ce que l'audit détaillé apporterait en plus", carto.valeur_ajoutee_audit_complet, COULEUR_POSITIF));
  }

  return blocs;
}

/**
 * Génère et déclenche le téléchargement du fichier Word du pré-audit.
 * @param {object} audit — l'audit tel que chargé par CursAuditDetail (utilisé pour le titre du livre).
 * @param {object} résultat — audit.preaudit_resultat (schéma v7).
 */
export async function exporterPreauditWord(audit, résultat) {
  const pageDeTitre = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000, after: 200 },
      children: [new TextRun({ text: "Pré-audit — Rapport de décision éditoriale", bold: true, size: 40, color: COULEUR_ACCENT })],
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
        text: résultat.analyse_le ? new Date(résultat.analyse_le).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "",
        size: 20, color: COULEUR_TEXTE_ATTENUE,
      })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  const contenu = [];

  if (résultat.resume_executif) {
    contenu.push(titre("Résumé exécutif", HeadingLevel.HEADING_1));
    contenu.push(paragraphe(résultat.resume_executif));
  }

  if (résultat.fiche_synthese) {
    contenu.push(titre("Fiche de synthèse", HeadingLevel.HEADING_1));
    const f = résultat.fiche_synthese;
    contenu.push(ligneÉtiquette("Contrat annoncé", f.contrat_annonce));
    contenu.push(ligneÉtiquette("Contrat réel", f.contrat_reel));
    contenu.push(ligneÉtiquette("Écart principal", f.ecart_principal));
    contenu.push(ligneÉtiquette("Risque lecteur", f.risque_lecteur));
    contenu.push(ligneÉtiquette("Recommandation", f.recommandation));
    contenu.push(ligneÉtiquette("Priorité", f.priorite));
  }

  contenu.push(titre("Nature réelle du texte", HeadingLevel.HEADING_1));
  contenu.push(paragraphe(résultat.nature_reelle));

  contenu.push(titre("Promesse affichée et écart"));
  contenu.push(paragraphe(résultat.promesse_affichee));
  if (résultat.ecart_promesse_execution) {
    contenu.push(...blocTitré("Écart constaté", résultat.ecart_promesse_execution));
  }

  contenu.push(...sectionVoiesÉditoriales(résultat.voies_editoriales));

  if (résultat.recommandation_principale) {
    contenu.push(titre("Recommandation principale"));
    contenu.push(paragraphe(résultat.recommandation_principale, { bold: true, color: COULEUR_POSITIF }));
  }

  contenu.push(...sectionPlanIntervention(résultat.plan_intervention));
  contenu.push(...sectionExemplesConcrets(résultat.exemples_concrets));

  if (résultat.a_preserver?.length > 0) {
    contenu.push(titre("À préserver"));
    résultat.a_preserver.forEach((f) => contenu.push(puce(f)));
  }
  if (résultat.a_couper_ou_alleger?.length > 0) {
    contenu.push(titre("À couper ou alléger"));
    résultat.a_couper_ou_alleger.forEach((f) => contenu.push(puce(f)));
  }

  if (résultat.prochaine_etape) {
    contenu.push(titre("Prochaine étape recommandée"));
    contenu.push(paragraphe(résultat.prochaine_etape));
  }

  contenu.push(...sectionCartographie(résultat.cartographie_contexte));

  const documentWord = new Document({
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      children: [...pageDeTitre, ...contenu],
    }],
    styles: {
      default: {
        // Échelle strictement décroissante : titre 1 (30 = 15pt) > titre 2
        // (24 = 12pt) > corps de texte (22 = 11pt). Tous les libellés en
        // gras/couleur utilisés dans le corps (blocTitré, noms de
        // personnages/lieux...) héritent de la taille du corps — ils ne
        // peuvent donc jamais paraître plus importants qu'un vrai titre,
        // quels que soient le gras ou la couleur appliqués localement.
        document: { run: { font: "Georgia", size: 22 } },
        heading1: {
          run: { font: "Georgia", size: 30, bold: true, color: COULEUR_ACCENT },
          paragraph: { spacing: { before: 320, after: 140 } },
        },
        heading2: {
          run: { font: "Georgia", size: 24, bold: true, color: "3D3670" },
          paragraph: { spacing: { before: 240, after: 100 } },
        },
      },
    },
  });

  const blob = await Packer.toBlob(documentWord);
  const url = URL.createObjectURL(blob);
  const lien = window.document.createElement("a");
  lien.href = url;
  lien.download = `preaudit_${nomDeFichierSûr(audit.titre)}.docx`;
  window.document.body.appendChild(lien);
  lien.click();
  window.document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}
