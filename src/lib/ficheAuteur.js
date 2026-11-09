/**
 * CURSUS — Fiche de présentation d'un livre à remplir par l'auteur (09/11/2026).
 * Retour de Joseph : « l'auteur n'a pas accès à la fiche : lui donner la possibilité de la télécharger et de la remplir, ou de la remplir en ligne ».
 * - fiche en ligne : le formulaire (FicheAuteur.jsx) compose un TEXTE et ouvre l'e-mail de l'auteur adressé à Cursus (aucune donnée n'est envoyée
 *   à un serveur : rien n'est publié avant la validation de Joseph et la date de consentement dans public/vitrine/livres.json) ;
 * - fiche à télécharger : un document Word vierge (même champs), à renvoyer par e-mail.
 * Pur sauf `telechargerFicheVierge` (génère un .docx dans le navigateur).
 */

export const MODES_CREATION = [
  { id: "seul", label: "Texte écrit seul par moi" },
  { id: "cursus", label: "Accompagné par Cursus (relecture, correction, mise en page)" },
  { id: "aucun", label: "Je préfère ne pas préciser" },
];

/** Champs de la fiche, dans l'ordre. `max` = nombre de caractères conseillé ; `obligatoire` : requis pour préparer l'e-mail. */
export const CHAMPS = [
  { id: "titre", label: "Titre (et sous-titre éventuel)", obligatoire: true },
  { id: "auteur", label: "Nom de l'auteur, tel qu'il doit apparaître", obligatoire: true },
  { id: "accroche", label: "Accroche (une ou deux phrases)", obligatoire: true, long: true, max: 220 },
  { id: "presentation", label: "Présentation / quatrième de couverture (de votre plume)", long: true, max: 800, aide: "500 à 800 caractères. Évitez de copier le texte d'une librairie : il peut appartenir à autrui." },
  { id: "genre", label: "Genre (roman, témoignage, essai, polar…)" },
  { id: "themes", label: "Un ou deux thèmes (maladie et deuil, voyage, famille…)" },
  { id: "bio", label: "Votre biographie (deux ou trois lignes)", long: true, max: 400 },
  { id: "editeur", label: "Éditeur, ou autoédition" },
  { id: "parution", label: "Date de parution" },
  { id: "format", label: "Nombre de pages et format" },
  { id: "isbn", label: "ISBN" },
  { id: "prix", label: "Prix" },
  { id: "lien", label: "Où l'acheter (lien)", type: "url" },
  { id: "extrait", label: "Extrait (facultatif, quelques lignes — pas un chapitre entier)", long: true, max: 800 },
];

export const AVERTISSEMENT_COUVERTURE =
  "La couverture ne peut pas être jointe depuis ce formulaire : ajoutez-la en pièce jointe à l'e-mail (image en bonne définition, seulement si vous avez le droit de la diffuser).";

export const PHRASE_CONSENTEMENT =
  "J'autorise la publication de cette fiche sur Cursus. Je peux en demander le retrait à tout moment, simplement en écrivant à Cursus.";

/** Les champs obligatoires manquants + le consentement. → liste de messages (vide = prête). */
export function problemesFiche(v) {
  const p = [];
  for (const c of CHAMPS) if (c.obligatoire && !String(v[c.id] || "").trim()) p.push(`« ${c.label} » est à remplir.`);
  if (v.lien && !/^https:\/\//i.test(String(v.lien).trim())) p.push("Le lien d'achat doit commencer par https://");
  if (!v.consentement) p.push("Cochez votre accord de publication.");
  return p;
}

/** Texte de la fiche (corps de l'e-mail), lisible tel quel par Joseph. */
export function texteFiche(v, date = new Date()) {
  const jour = date.toISOString().slice(0, 10);
  const lignes = [
    "Bonjour, voici la fiche de mon livre pour la vitrine des auteurs partenaires de Cursus.",
    "",
  ];
  for (const c of CHAMPS) lignes.push(`${c.label} : ${String(v[c.id] || "").trim() || "—"}`);
  const mode = MODES_CREATION.find((m) => m.id === v.modeCreation);
  lignes.push(`Comment le livre a été écrit (déclaré par l'auteur) : ${mode ? mode.label : "—"}`);
  lignes.push("Couverture : en pièce jointe de cet e-mail.");
  lignes.push("");
  lignes.push(`Accord : ${v.consentement ? "OUI — " + PHRASE_CONSENTEMENT : "NON"}`);
  lignes.push(`Date de l'accord : ${jour}`);
  if (v.email) lignes.push(`Mon adresse pour la réponse : ${String(v.email).trim()}`);
  return lignes.join("\n");
}

export function lienMailto(adresse, v, date = new Date()) {
  const sujet = `Fiche livre — ${String(v.titre || "").trim() || "sans titre"}`;
  return `mailto:${adresse}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(texteFiche(v, date))}`;
}

/** Document Word vierge, à remplir puis à renvoyer par e-mail. */
export async function telechargerFicheVierge(adresseContact) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const vide = () => new Paragraph({ children: [new TextRun({ text: "…………………………………………………………………………………………………", color: "999999" })], spacing: { after: 160 } });
  const enfants = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Fiche de présentation d'un livre — Cursus")] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `Remplissez ce document puis renvoyez-le par e-mail à ${adresseContact}, avec la couverture de votre livre en pièce jointe (image en bonne définition, seulement si vous avez le droit de la diffuser). Votre fiche ne sera publiée qu'avec votre accord écrit : vous la verrez avant publication.`, italics: true })] }),
  ];
  CHAMPS.forEach((c, i) => {
    enfants.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: `${i + 1}. ${c.label}`, bold: true })] }));
    if (c.aide) enfants.push(new Paragraph({ children: [new TextRun({ text: c.aide, size: 18, color: "777777" })] }));
    enfants.push(vide());
    if (c.long) enfants.push(vide());
  });
  enfants.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: `${CHAMPS.length + 1}. Comment le livre a été écrit (cochez, c'est vous qui déclarez)`, bold: true })] }));
  for (const m of MODES_CREATION) enfants.push(new Paragraph({ children: [new TextRun(`☐  ${m.label}`)] }));
  enfants.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: `${CHAMPS.length + 2}. Votre accord`, bold: true })] }));
  enfants.push(new Paragraph({ children: [new TextRun(`☐  ${PHRASE_CONSENTEMENT}`)] }));
  enfants.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun("Date : ………………………   Nom : …………………………………………")] }));
  const doc = new Document({ sections: [{ children: enfants }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "fiche-livre-cursus.docx";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
