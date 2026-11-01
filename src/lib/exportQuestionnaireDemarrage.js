/**
 * CURSUS — Export du « Questionnaire de démarrage » (01/11/2026, demande de Joseph : « il manque la possibilité
 * d'exporter le questionnaire de démarrage, utile aussi pour CursAudit le cas échéant »).
 *
 * `construireSections` (PUR) : questions + réponses → sections lisibles (base / affinage / personnes). Trois sorties :
 * texte (copier), Word (.docx, 100 % navigateur) et JSON (sauvegarde). Aucune IA, aucun appel serveur.
 * Pas d'import automatique dans CursAudit : le document sert de pièce jointe / aide-mémoire (à décider avec l'auteur·ice).
 */
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { nomDeFichierSûr } from "./exportWord.js";
import { SERIES, questionsAPoser, parseMultiple } from "./questionnaireDemarrage.js";

/** Réponse mise en lignes : choix multiples et listes de personnes → une ligne par élément. */
export function lignesDeReponse(id, valeur) {
  const v = String(valeur || "").trim();
  if (!v) return [];
  if (id === "Q016") return v.split("\n").map((s) => s.trim()).filter(Boolean);
  const multiple = parseMultiple(v);
  if (multiple.length > 1) return multiple;
  return v.split("\n").map((s) => s.trim()).filter(Boolean);
}

/** @param {Array} questions lignes de banque_questions ; @param {object} reponses { Qxxx: "texte" } */
export function construireSections(questions, reponses) {
  const avec = Object.fromEntries(Object.entries(reponses || {}).map(([k, v]) => [k, { valeur: v }]));
  return Object.entries(SERIES).map(([serie, def]) => {
    const items = questionsAPoser(questions || [], avec, serie).map((q) => ({
      id: q.id, question: q.question, lignes: lignesDeReponse(q.id, reponses?.[q.id]),
    }));
    return { serie, titre: def.titre, items, repondues: items.filter((x) => x.lignes.length).length };
  }).filter((s) => s.items.length && (s.serie === "base" || s.repondues > 0));
}

const dateDuJour = () => new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export function enTexte(sections, titreProjet) {
  const out = [`Questionnaire de démarrage — ${titreProjet || "Sans titre"}`, dateDuJour(), ""];
  sections.forEach((s) => {
    out.push(s.titre.toUpperCase(), "");
    s.items.forEach((x) => {
      out.push(x.question);
      if (!x.lignes.length) out.push("  (pas de réponse)");
      else if (x.lignes.length === 1) out.push(`  ${x.lignes[0]}`);
      else x.lignes.forEach((l) => out.push(`  • ${l}`));
      out.push("");
    });
  });
  return out.join("\n").trim() + "\n";
}

function télécharger(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url; a.download = nom;
  window.document.body.appendChild(a); a.click(); window.document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exporterQuestionnaireWord(sections, titreProjet) {
  const ACCENT = "5B52C4";
  const enfants = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "Questionnaire de démarrage", bold: true, size: 40, color: ACCENT })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: titreProjet || "Sans titre", size: 30 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: dateDuJour(), size: 20, color: "666666" })] }),
  ];
  sections.forEach((s) => {
    enfants.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 120 }, text: s.titre }));
    if (s.serie === "personnes") {
      enfants.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "Garde-fou : cette trace ne constitue pas un avis juridique.", italics: true, size: 20, color: "666666" })] }));
    }
    s.items.forEach((x) => {
      enfants.push(new Paragraph({ spacing: { before: 160, after: 40 }, keepNext: true, children: [new TextRun({ text: x.question, bold: true })] }));
      if (!x.lignes.length) enfants.push(new Paragraph({ children: [new TextRun({ text: "— pas de réponse", italics: true, color: "999999" })] }));
      else if (x.lignes.length === 1) enfants.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun(x.lignes[0])] }));
      else x.lignes.forEach((l) => enfants.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 30 }, children: [new TextRun(l)] })));
    });
  });
  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children: enfants }],
    styles: { default: { document: { run: { font: "Georgia", size: 22 } }, heading1: { run: { font: "Georgia", size: 28, bold: true, color: ACCENT } } } },
  });
  télécharger(await Packer.toBlob(doc), `questionnaire_demarrage_${nomDeFichierSûr(titreProjet || "livre")}.docx`);
}

export function exporterQuestionnaireJSON(reponses, titreProjet) {
  const corps = { type: "cursus-questionnaire-demarrage", version: 1, exporteLe: new Date().toISOString(), projet: titreProjet || "", reponses };
  télécharger(new Blob([JSON.stringify(corps, null, 2)], { type: "application/json" }), `questionnaire_demarrage_${nomDeFichierSûr(titreProjet || "livre")}.json`);
}
