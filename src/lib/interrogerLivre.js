/**
 * CURSUS — « Interroger le livre » (26/11/2026) : poser une question à TOUT le livre (tous les chapitres du projet) et obtenir un relevé
 * classé, avec citations exactes, chapitre et voix. MOTEUR PUR (aucun accès réseau ni DOM sauf `blocsDeHtml` injectable).
 *
 * Méthode (voir CLAUDE.md, section « Interroger le livre ») :
 *   1. passages numérotés (un paragraphe = un passage) à partir des chapitres ;
 *   2. mots à chercher (corrigeables) → REPÉRAGE GRATUIT, sans IA, avec le nombre de passages par mot ;
 *   3. DEVIS (tokens estimés, équivalent en « analyses ») avant tout appel payant ;
 *   4. lecture par LOTS : l'IA classe chaque passage repéré (catégorie, NOMMÉ/DÉDUIT, citation exacte, voix) ;
 *   5. VÉRIFICATION PAR LE CODE : une citation qui n'existe pas mot pour mot dans le passage cité est écartée et comptée ;
 *   6. synthèse par catégorie.
 * Rien de ce que dit l'IA n'est montré sans cette vérification.
 */
import { blocsDeHtml, NOTE, OBJET } from "./rechercheTexte.js";

// ─── 1. Passages ─────────────────────────────────────────────────────────────

/**
 * @param nœuds   [{ id, titre, type, zone, texte(HTML), profondeur }] (voir aplatirStructure, rechercheTexte.js)
 * @param options { horsCorps: false (inclure réserve, notes, brouillons), blocs: fonction HTML → [{texte}] (injectable pour les tests) }
 * @returns [{ cle, nœudId, titreNœud, rang, ordre, texte }]  — `ordre` = rang global dans le livre
 */
export function passagesDuLivre(nœuds, { horsCorps = false, blocs = blocsDeHtml } = {}) {
  const sortie = [];
  for (const n of nœuds || []) {
    if (!horsCorps && (n.zone || "corps") !== "corps") continue;
    let rang = 0;
    for (const b of blocs(n.texte || "")) {
      const texte = String(b.texte || "").replace(new RegExp(`[${NOTE}${OBJET}]`, "g"), " ").replace(/\s+/g, " ").trim();
      if (!/\p{L}/u.test(texte)) continue;
      rang += 1;
      sortie.push({ cle: `${n.id}#${rang}`, nœudId: n.id, titreNœud: n.titre || "(sans titre)", rang, ordre: sortie.length, texte });
    }
  }
  return sortie;
}

// ─── 2. Mots à chercher et repérage gratuit ──────────────────────────────────

export const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’‘ʼ]/g, "'").toLowerCase();
const échapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Saisie libre → termes. Séparateurs : virgule, point-virgule, retour à la ligne. Un terme cherche tous les mots qui COMMENCENT ainsi
 * (« aim » trouve aime, aimer, aimons ; « amour » trouve amoureux, amoureusement) ; « =mot » cherche le mot exact. Plusieurs mots : une expression.
 */
export function analyserTermes(saisie) {
  const vus = new Set(); const termes = [];
  for (const brut0 of String(saisie || "").split(/[,;\n]+/)) {
    const brut = brut0.trim(); if (!brut) continue;
    const exact = brut.startsWith("=");
    const norme = sansAccents(exact ? brut.slice(1) : brut).replace(/\s+/g, " ").trim();
    if (norme.length < 2 || vus.has((exact ? "=" : "") + norme)) continue;
    vus.add((exact ? "=" : "") + norme);
    const corps = échapper(norme).replace(/ /g, "\\s+");
    termes.push({ brut, exact, motif: new RegExp(`(?<![\\p{L}\\p{N}])${corps}${exact ? "(?![\\p{L}\\p{N}])" : ""}`, "u") });
  }
  return termes;
}

/** → { candidats: passages + `termes` (libellés trouvés), parTerme: { brut: n }, total } */
export function repérer(passages, termes) {
  const parTerme = Object.fromEntries(termes.map((t) => [t.brut, 0]));
  const candidats = [];
  for (const p of passages) {
    const t = sansAccents(p.texte);
    const trouvés = termes.filter((x) => x.motif.test(t)).map((x) => x.brut);
    if (!trouvés.length) continue;
    for (const b of trouvés) parTerme[b] += 1;
    candidats.push({ ...p, termes: trouvés });
  }
  return { candidats, parTerme, total: passages.length };
}

// ─── 3. Devis ────────────────────────────────────────────────────────────────

export const CARACTERES_PAR_TOKEN = 3.5;       // estimation pour du français (non mesurée finement)
export const TOKENS_PAR_ANALYSE = 11666;       // une analyse moyenne du Co-pilote (mesuré, 15/11/2026 — voir CLAUDE.md)
export const TAILLE_LOT = 14000;               // caractères de passages par appel
const TOKENS_CONSIGNE = 900;                   // consigne envoyée à chaque lot
const TOKENS_SORTIE_PAR_PASSAGE = 55;

export function devis(candidats, tailleLot = TAILLE_LOT) {
  const caracteres = candidats.reduce((a, p) => a + p.texte.length + 12, 0);
  const lots = découperEnLots(candidats, tailleLot).length;
  const entrée = Math.ceil(caracteres / CARACTERES_PAR_TOKEN) + lots * TOKENS_CONSIGNE;
  const sortie = candidats.length * TOKENS_SORTIE_PAR_PASSAGE;
  const total = entrée + sortie;
  return { passages: candidats.length, caracteres, lots, tokensEntrée: entrée, tokensSortie: sortie, tokensTotal: total, analyses: Math.round((total / TOKENS_PAR_ANALYSE) * 10) / 10 };
}

export function découperEnLots(candidats, tailleLot = TAILLE_LOT) {
  const lots = []; let courant = []; let car = 0;
  for (const p of candidats) {
    const n = p.texte.length + 12;
    if (courant.length && car + n > tailleLot) { lots.push(courant); courant = []; car = 0; }
    courant.push(p); car += n;
  }
  if (courant.length) lots.push(courant);
  return lots;
}

// ─── 4. Consignes et lecture des réponses ────────────────────────────────────

export function analyserCatégories(saisie) {
  return String(saisie || "").split("\n").map((l) => l.replace(/^[\s\-•*\d.)]+/, "").trim()).filter(Boolean).map((l) => {
    const i = l.indexOf(":");
    return i > 0 ? { nom: l.slice(0, i).trim(), description: l.slice(i + 1).trim() } : { nom: l, description: "" };
  });
}
export const catégoriesEnTexte = (cats) => cats.map((c) => (c.description ? `${c.nom} : ${c.description}` : c.nom)).join("\n");
const clé = (s) => sansAccents(s).replace(/\[[^\]]*\]/g, "").replace(/^[a-z]\s*[.)]\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();

export function construireConsigneTermes() {
  return [
    "Tu aides à interroger un livre. On te donne une QUESTION ; tu proposes les mots à chercher dans le texte pour retrouver les passages concernés.",
    "Réponds par UNE seule ligne : des mots ou débuts de mots séparés par des virgules, en minuscules, sans accents obligatoires, sans commentaire.",
    "Règles : 8 à 20 termes ; pour un verbe ou un nom, écris sa racine (« aim » pour aime, aimer, aimons ; « amour » pour amoureux, amoureusement) ; inclus les synonymes proches et les expressions courantes (« présence amoureuse ») ; pas de mots vides (le, de, et).",
  ].join("\n");
}
export function analyserTermesProposés(texte) {
  return String(texte || "").split(/[\n,;]+/).map((t) => t.replace(/^[\s\-•*\d.)]+|["«»]/g, "").trim()).filter((t) => t.length >= 2).slice(0, 30).join(", ");
}

const BLOC_PASSAGES = (lot) => lot.map((p, i) => `[P${i + 1}] ${p.texte}`).join("\n\n");

export function construireConsigneCatégories(question) {
  return [
    "Tu aides un·e auteur·ice ou un·e éditeur·ice à classer des passages d'un livre qui répondent à UNE question.",
    `QUESTION : ${question}`,
    "On te donne un échantillon de passages numérotés [P1]… Propose 6 à 12 CATÉGORIES, distinctes, qui permettent de ranger ce que le livre dit en réponse à la question.",
    "Format : une catégorie par ligne, « Nom court : description en une phrase », sans numérotation, sans autre texte.",
    "Appuie-toi sur ce que les passages disent, pas sur des généralités. Si l'auteur·ice emploie un nom pour une catégorie, reprends ce nom. Ajoute au plus une catégorie « Autre ».",
  ].join("\n");
}

export function construireConsigneClassement(question, catégories) {
  const liste = catégories.length ? catégories.map((c) => `- ${c.nom}${c.description ? " : " + c.description : ""}`).join("\n") : "- Passages pertinents";
  return [
    "Tu es un assistant de relecture éditoriale. Tu relèves, dans un livre, les passages qui répondent à UNE question. Tu lis des passages numérotés [P1]… extraits du livre ; la plupart ne répondent pas à la question.",
    `QUESTION : ${question}`,
    `CATÉGORIES (utilise exactement ces noms) :\n${liste}`,
    "Pour CHAQUE passage, écris UNE ligne, dans l'ordre, sans aucun autre texte :",
    "- passage pertinent : [Pn] CATÉGORIE ; AUTRE CATÉGORIE | NOMMÉ ou DÉDUIT | « citation » | VOIX",
    "- passage non pertinent : [Pn] HORS_SUJET",
    "Règles :",
    "- « citation » : recopie MOT POUR MOT 4 à 35 mots du passage, sans rien corriger ni changer à la ponctuation. Plusieurs morceaux : sépare-les par […]. N'invente jamais une citation.",
    "- NOMMÉ : l'auteur·ice emploie elle-même le mot ou l'expression qui désigne la catégorie. DÉDUIT : tu la déduis d'une scène, d'un récit ou d'une image. En cas de doute : DÉDUIT.",
    "- VOIX : AUTEUR si c'est la voix de l'auteur·ice du livre. Sinon « AUTRE : » suivi de qui parle (préface de…, citation d'un auteur cité, témoignage d'une personne, participant, personnage). Une préface, une citation attribuée à un tiers ou un témoignage rapporté ne sont PAS la voix de l'auteur·ice.",
    "- Un passage peut relever de plusieurs catégories (sépare-les par « ; »). Ne force pas : un mot qui n'a pas le sens de la question (par exemple « j'aime dire » au sens d'apprécier) = HORS_SUJET.",
    "- Tu classes ce que le texte dit : n'interprète ni la psychologie ni les intentions de l'auteur·ice, ne conclus rien.",
    "- Le livre peut contenir des récits de violences, y compris sexuelles : traite-les avec sobriété ; choisis comme citation un extrait qui répond à la question sans détail explicite.",
    "- Ne saute aucun passage et ne change pas leur numéro.",
  ].join("\n");
}
export const blocPassagesPourLot = BLOC_PASSAGES;

/** Lignes « [Pn] … » → [{ n, horsSujet, catégories[], nature, citation, voix }] */
export function analyserClassement(texte) {
  const sortie = [];
  for (const ligne of String(texte || "").split("\n")) {
    const m = ligne.match(/^\s*[-•*]?\s*\[?P(\d+)\]?\s*[:\-–]?\s*(.*)$/i);
    if (!m) continue;
    const n = parseInt(m[1], 10); const reste = m[2].trim();
    if (/^HORS[\s_-]*SUJET/i.test(reste)) { sortie.push({ n, horsSujet: true }); continue; }
    const parts = reste.split("|").map((x) => x.trim());
    if (parts.length < 3) continue;
    const catégories = parts[0].split(/\s*;\s*/).map((x) => x.trim()).filter(Boolean);
    const nature = /^nomm/i.test(parts[1]) ? "NOMMÉ" : "DÉDUIT";
    let citation, voix;
    if (parts.length >= 4) { voix = parts[parts.length - 1]; citation = parts.slice(2, -1).join("|"); } else { citation = parts[2]; voix = ""; }
    citation = citation.replace(/^[«"“\s]+|[»"”\s]+$/g, "").trim();
    voix = /^auteur/i.test(voix) ? "AUTEUR" : voix.replace(/^autre\s*:\s*/i, "").trim() || "non précisée";
    if (!catégories.length || !citation) continue;
    sortie.push({ n, horsSujet: false, catégories, nature, citation, voix });
  }
  return sortie;
}

// ─── 5. Vérification mécanique des citations ────────────────────────────────

const normeCitation = (s) => String(s || "").replace(/[’‘ʼ]/g, "'").replace(/[“”«»]/g, '"').replace(/[  ]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

/** Vrai si CHAQUE morceau de la citation (séparés par […] ou …) figure tel quel dans le passage. */
export function citationPrésente(citation, texte) {
  const t = normeCitation(texte);
  const morceaux = String(citation || "").split(/\s*(?:\[\s*(?:…|\.\.\.)\s*\]|…|\.\.\.)\s*/).map(normeCitation).map((m) => m.replace(/^["\s,;]+|["\s]+$/g, "")).filter((m) => m.length >= 3);
  if (!morceaux.length || morceaux.join("").length < 8) return false;
  return morceaux.every((m) => t.includes(m));
}

// ─── 6. Exécution par lots ───────────────────────────────────────────────────

/**
 * @param appel  async (système, utilisateur, maxTokens, signal) → { texte, tronque }  (appelClaude en production, simulé en test)
 * @returns { items[], horsSujet, écartées[], nonTraités[], erreurs[] }
 */
export async function lancerRelevé({ question, catégories, candidats, appel, signal, onProgression, detecterRefus = () => false, tailleLot = TAILLE_LOT }) {
  const noms = catégories.length ? catégories : [{ nom: "Passages pertinents", description: "" }];
  const consigne = construireConsigneClassement(question, noms);
  const items = []; const écartées = []; const nonTraités = []; const erreurs = [];
  let horsSujet = 0; let faits = 0;
  const lots = découperEnLots(candidats, tailleLot);

  const traiter = async (lot, profondeur = 0) => {
    if (signal?.aborted) throw Object.assign(new Error("annulé"), { name: "AbortError" });
    let r;
    try { r = await appel(consigne, BLOC_PASSAGES(lot), 4500, signal); }
    catch (e) { if (e?.name === "AbortError") throw e; erreurs.push(e?.message || "Erreur."); nonTraités.push(...lot.map((p) => p.cle)); return; }
    if (detecterRefus(r.texte)) { erreurs.push("L'IA a décliné de traiter un lot de passages."); nonTraités.push(...lot.map((p) => p.cle)); return; }
    const lignes = analyserClassement(r.texte);
    // Réponse tronquée : on coupe le lot en deux et on recommence (une seule fois par niveau), plutôt que de perdre la fin.
    if (r.tronque && lot.length > 1 && profondeur < 2) {
      const m = Math.ceil(lot.length / 2);
      await traiter(lot.slice(0, m), profondeur + 1); await traiter(lot.slice(m), profondeur + 1);
      return;
    }
    const vus = new Set();
    for (const l of lignes) {
      const p = lot[l.n - 1]; if (!p || vus.has(l.n)) continue; vus.add(l.n);
      if (l.horsSujet) { horsSujet += 1; continue; }
      if (!citationPrésente(l.citation, p.texte)) { écartées.push({ cle: p.cle, nœudId: p.nœudId, titreNœud: p.titreNœud, rang: p.rang, citation: l.citation }); continue; }
      const cats = l.catégories.map((c) => noms.find((x) => clé(x.nom) === clé(c) || clé(c).startsWith(clé(x.nom)))?.nom || "Autres (hors liste)");
      items.push({ cle: p.cle, nœudId: p.nœudId, titreNœud: p.titreNœud, rang: p.rang, ordre: p.ordre, catégories: [...new Set(cats)], nature: l.nature, citation: l.citation.trim(), voix: l.voix });
    }
    lot.forEach((p, i) => { if (!vus.has(i + 1)) nonTraités.push(p.cle); });
  };

  for (const lot of lots) {
    await traiter(lot);
    faits += 1; onProgression?.({ lot: faits, lots: lots.length });
  }
  return { items, horsSujet, écartées, nonTraités: [...new Set(nonTraités)], erreurs };
}

/** Résultat brut → relevé affichable : par catégorie (dans l'ordre demandé), par ordre du livre. */
export function synthétiser({ catégories, items, candidats, horsSujet, écartées, nonTraités, erreurs }) {
  const noms = catégories.length ? catégories.map((c) => c.nom) : ["Passages pertinents"];
  const présentes = new Set(items.flatMap((i) => i.catégories));
  const ordreNoms = [...noms, ...(présentes.has("Autres (hors liste)") ? ["Autres (hors liste)"] : [])];
  const parCatégorie = ordreNoms.map((nom) => {
    const liste = items.filter((i) => i.catégories.includes(nom)).sort((a, b) => a.ordre - b.ordre);
    const compte = (f) => liste.reduce((o, i) => { const k = f(i); o[k] = (o[k] || 0) + 1; return o; }, {});
    return { nom, description: catégories.find((c) => c.nom === nom)?.description || "", n: liste.length, passages: new Set(liste.map((i) => i.cle)).size, parNature: compte((i) => i.nature), parVoix: compte((i) => (i.voix === "AUTEUR" ? "AUTEUR" : "AUTRE VOIX")), items: liste };
  });
  return { parCatégorie, lus: candidats, pertinents: new Set(items.map((i) => i.cle)).size, horsSujet, écartées: écartées.length, nonTraités: nonTraités.length, erreurs };
}

/** Relevé → Markdown (copie, téléchargement). */
export function versMarkdown({ titreProjet = "", question, termes, relevé, date = new Date() }) {
  const L = [];
  L.push(`# Relevé — ${titreProjet || "livre"}`);
  L.push(`*${date.toLocaleDateString("fr-BE")} — Question : ${question}*`);
  L.push(`*Mots cherchés : ${termes}. Passages repérés : ${relevé.lus}, retenus : ${relevé.pertinents}, hors sujet : ${relevé.horsSujet}. Citations écartées car introuvables dans le texte : ${relevé.écartées}. Passages non traités : ${relevé.nonTraités}.*`);
  L.push("*Chaque citation a été vérifiée mot pour mot dans le texte. Le classement est une lecture de l'IA : à contrôler.*\n");
  for (const c of relevé.parCatégorie) {
    L.push(`\n## ${c.nom} — ${c.n} citation${c.n > 1 ? "s" : ""}`);
    if (c.description) L.push(`*${c.description}*`);
    for (const i of c.items) L.push(`- **${i.titreNœud}**, § ${i.rang}${i.voix !== "AUTEUR" ? ` — *${i.voix}*` : ""} (${i.nature.toLowerCase()}) : « ${i.citation} »`);
  }
  return L.join("\n");
}
