/**
 * Export Word du DOSSIER DE CRÉATION (24/10/2026) — voir `dossierCreation.js`
 * pour ce que les chiffres représentent et leurs limites. Ne contient AUCUN
 * extrait du texte du livre : seulement titres, dates et nombres de mots.
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType,
} from "docx";
import { supabase } from "./supabase.js";
import { construireDossier, aplatirStructure, NOMS_OUTILS_IA } from "./dossierCreation.js";
import { nomDeFichierSûr } from "./exportWord.js";

const fmtJour = (j) => (j ? new Date(j + "T12:00:00").toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" }) : "—");
const fmtN = (n) => (n ?? 0).toLocaleString("fr-FR");

/** Lit TOUS les instantanés (date + mots seulement, pas le texte), par pages de 1000. */
function sectionUsageIA(u) {
  if (!u) return [p("Le registre d'usage de l'IA n'est pas disponible pour ce livre (non activé sur ce compte).")];
  if (!u.total) return [p("Aucun usage d'un outil d'IA de Cursus n'est enregistré pour ce livre. Le registre existe depuis la mise en service de cette fonction ; il ne couvre pas ce qui s'est passé avant, ni hors de Cursus.")];
  return [
    p(`Registre en service depuis le ${fmtJour(u.debutRegistre)}. Les outils de Cursus proposent des corrections et des analyses ; le texte n'est modifié que lorsque l'auteur·ice applique une proposition.`),
    tableau(["Outil", "Lancements", "Applications", "Passages modifiés", "Dernier usage"],
      Object.entries(u.outils).map(([k, o]) => [NOMS_OUTILS_IA[k] || k, String(o.lancements), String(o.applications), String(o.passagesModifies), fmtJour(o.dernier)]),
      [40, 14, 14, 16, 16], [1, 2, 3]),
    p("Le Co-pilote n'écrit pas dans le texte : seuls ses lancements sont comptés."),
  ];
}

export async function chargerVersions(projet) {
  const ids = aplatirStructure(projet.structure).map((n) => n.id);
  const toutes = [];
  for (let i = 0; i < ids.length; i += 50) {
    const lot = ids.slice(i, i + 50);
    for (let de = 0; ; de += 1000) {
      const { data, error } = await supabase
        .from("versions_noeuds").select("noeud_id, mots, created_at")
        .in("noeud_id", lot).order("created_at", { ascending: true }).range(de, de + 999);
      if (error) throw new Error(error.message);
      toutes.push(...data);
      if (data.length < 1000) break;
    }
  }
  return toutes;
}

const cellule = (texte, { gras = false, droite = false, largeur } = {}) => new TableCell({
  width: largeur ? { size: largeur, type: WidthType.PERCENTAGE } : undefined,
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
  children: [new Paragraph({ alignment: droite ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: String(texte), bold: gras, size: 20 })] })],
});
const tableau = (entetes, lignes, largeurs, droites = []) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({ tableHeader: true, children: entetes.map((e, i) => cellule(e, { gras: true, droite: droites.includes(i), largeur: largeurs[i] })) }),
    ...lignes.map((l) => new TableRow({ children: l.map((c, i) => cellule(c, { droite: droites.includes(i), largeur: largeurs[i] })) })),
  ],
});
const p = (texte, opts = {}) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: texte, size: 22, ...opts })] });
const h = (texte) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 360, after: 160 }, text: texte });

/** Lignes du registre d'usage de l'IA (null si la table n'existe pas encore). */
export async function chargerUsageIA(projet) {
  const toutes = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase
      .from("usage_ia_projet").select("outil, action, nb, cree_le")
      .eq("projet_id", projet.id).order("cree_le", { ascending: true }).range(de, de + 999);
    if (error) return null;
    toutes.push(...data);
    if (data.length < 1000) break;
  }
  return toutes;
}

export async function exporterDossierCreation(projet) {
  const versions = await chargerVersions(projet);
  const usage = await chargerUsageIA(projet);
  const d = construireDossier(projet, versions, new Date(), usage);

  const enfants = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 120 }, children: [new TextRun({ text: "Dossier de création", size: 28, color: "666666" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: d.titre, bold: true, size: 48 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [new TextRun({ text: d.genre, size: 24, color: "666666" })] }),

    h("Synthèse"),
    tableau(["", ""], [
      ["Projet créé le", fmtJour(d.dateCreation)],
      ["Première trace d'écriture", fmtJour(d.premierJour)],
      ["Dernière trace d'écriture", fmtJour(d.dernierJour)],
      ["Jours d'écriture enregistrés", String(d.joursActifs)],
      ["Mots actuels", fmtN(d.motsActuels)],
      ["Objectif", d.objectifMots ? `${fmtN(d.objectifMots)} mots (${d.pourcentage} %)` : "non défini"],
      ["Parties, chapitres et scènes", String(d.nbChapitres)],
      ["Instantanés enregistrés", String(d.nbInstantanes)],
    ], [45, 55]),

    h("Progression dans le temps"),
    p("Total de mots du livre à la fin de chaque jour où une trace a été enregistrée."),
    d.lignes.length
      ? tableau(["Date", "Mots (total)", "Variation", "Instantanés"], d.lignes.map((l) => [fmtJour(l.jour), fmtN(l.mots), (l.variation > 0 ? "+" : "") + fmtN(l.variation), String(l.instantanes)]), [40, 20, 20, 20], [1, 2, 3])
      : p("Aucun instantané enregistré pour ce livre à ce jour."),

    h("Détail par chapitre"),
    tableau(["Partie / chapitre", "Mots", "Première trace", "Dernière trace", "Instantanés"],
      d.chapitres.map((c) => ["    ".repeat(c.profondeur) + c.titre, fmtN(c.mots), c.premiere ? fmtJour(c.premiere) : "—", c.derniere ? fmtJour(c.derniere) : "—", String(c.nbVersions)]),
      [36, 12, 20, 20, 12], [1, 4]),

    h("Usage d'outils d'IA dans Cursus"),
    ...sectionUsageIA(d.usageIA),

    h("Ce que ce document est — et n'est pas"),
    p("Il est généré par Cursus à partir des sauvegardes datées du livre (date et nombre de mots à chaque instantané). Il ne contient aucun extrait du texte."),
    p("Les instantanés ne sont pas pris à chaque frappe : ils sont enregistrés lorsque le texte change de façon notable, et au moins toutes les 5 minutes d'écriture pour les versions récentes. L'historique des livres écrits avant octobre 2026 est donc plus clairsemé."),
    p("C'est un indice sur la manière dont le livre a été produit, pas une preuve juridique. Le registre d'usage de l'IA ne couvre que les outils de Cursus, et seulement depuis sa mise en service : il ne dit rien de ce qui a pu être fait ailleurs (autres logiciels, autres services)."),
    p(`Document généré le ${fmtJour(d.genereLe.slice(0, 10))}.`, { color: "666666" }),
  ];

  const doc = new Document({ sections: [{ children: enfants }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const lien = window.document.createElement("a");
  lien.href = url;
  lien.download = `Dossier_de_creation_${nomDeFichierSûr(projet.titre)}.docx`;
  window.document.body.appendChild(lien);
  lien.click();
  window.document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}
