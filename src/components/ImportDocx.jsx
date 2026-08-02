/**
 * ATELIER D'ÉCRIVAIN — Import Word
 * Lit n'importe quel .docx et remplace le contenu
 * des chapitres existants par correspondance de titre.
 * Fonctionne pour tous les livres, pas seulement le Tome I.
 *
 * Création automatique des nœuds manquants — reconstruite le 01/08/2026
 * (perdue lors du retour en arrière d'urgence de la nuit du 01/08, voir
 * CLAUDE.md). Un chapitre du Word sans correspondance dans la structure
 * existante n'oblige plus à créer le nœud à la main avant d'importer : il
 * est créé automatiquement, positionné selon l'ordre du document source
 * (nouvelle "partie" toujours à la racine, nouveau "chapitre" rattaché à la
 * dernière "partie" rencontrée dans le document — existante ou tout juste
 * créée). LIMITE CONNUE (jamais testée en conditions réelles) : le passage
 * final de nœudsAPI.réordonner() ne renumérote que les nœuds CRÉÉS par cet
 * import ; un frère préexistant en base, non touché par cet import, garde
 * son ancien ordre — collision d'ordre possible dans ce cas.
 */

import { useState, useRef } from "react";
import { nœudsAPI } from "../lib/api.js";

// ─── Lecture du .docx via JSZip (chargé une fois) ────────────────────────────

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

// Résout, pour chaque styleId défini dans word/styles.xml, son NIVEAU DE
// TITRE RÉEL (0 = niveau 1, 1 = niveau 2, … 5 = niveau 6) — ajouté
// 01/08/2026, en remplacement d'une comparaison sur le NOM du style qui
// s'est révélée peu fiable en conditions réelles : un passage de texte
// collé depuis un autre document Word peut dupliquer un style avec un nom
// interne différent ("Titre21" au lieu de "Titre2", par exemple), alors que
// Word l'affiche de façon identique et au même niveau visuel. Le niveau réel
// (balise <w:outlineLvl>) est en revanche fiable : c'est lui qui détermine
// le niveau affiché dans le volet Plan de Word, indépendamment du nom du
// style. Un style sans <w:outlineLvl> propre hérite de celui de son style de
// base (<w:basedOn>), remonté récursivement.
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

// Repli si le niveau n'a pas pu être résolu via styles.xml (style
// entièrement dépourvu d'<w:outlineLvl>, même dans sa chaîne basedOn) :
// extrait le chiffre du nom du style lui-même ("Titre21" → niveau 2), utile
// justement dans le cas des styles dupliqués/renommés par Word au
// copier-coller — leur nom garde presque toujours le chiffre d'origine en
// préfixe.
function niveauDepuisNomStyle(styleId) {
  const m = /^(?:titre|heading)\s*(\d)/i.exec(styleId || "");
  return m ? parseInt(m[1], 10) - 1 : undefined;
}

// niveauPartie / niveauChapitre : niveaux de titre (1 à 6) choisis à l'écran
// de sélection pour représenter les Parties et les Chapitres — ajouté
// 01/08/2026. Détection par NIVEAU RÉEL (voir résoudreNiveauxStyles
// ci-dessus), plus par nom de style : deux paragraphes au même niveau
// visuel dans Word sont désormais toujours reconnus comme tels, même si
// leurs styles internes portent des noms différents.
async function extraireChapitres(fichier, niveauPartie = 1, niveauChapitre = 2) {
  const JSZip = await chargerJSZip();
  const zip = await JSZip.loadAsync(await fichier.arrayBuffer());
  const xml = await zip.file("word/document.xml").async("string");
  const stylesXml = await zip.file("word/styles.xml")?.async("string");
  const niveauxParStyle = résoudreNiveauxStyles(stylesXml);

  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const paras = doc.getElementsByTagNameNS(ns, "p");

  // Styles à ignorer (table des matières, métadonnées) — toujours exclus
  // même s'ils portent un niveau de titre (une entrée de table des matières
  // a souvent le même niveau que le titre qu'elle recopie).
  const IGNORER = new Set([
    "TM1","TM2","TM3","TM4","TM5","TM6","TM7","TM8","TM9",
    "EntryChap","EntryPart","EntryNormal","EntrySub",
    "TomeTitle","Volume","En-ttedetabledesmatires","Sous-titre",
  ]);

  const chapitres = [];
  let courant = null;
  let lignes = [];

  for (const p of paras) {
    const pStyle = p.getElementsByTagNameNS(ns, "pStyle")[0];
    const style = pStyle?.getAttribute("w:val") || "";
    const texte = Array.from(p.getElementsByTagNameNS(ns, "t"))
      .map(t => t.textContent).join("").trim();

    if (!texte || IGNORER.has(style)) continue;

    // Surcharge directe sur le paragraphe (rare, mais prioritaire sur le
    // niveau du style s'il est présent), puis niveau résolu du style, puis
    // repli sur le nom du style. Niveau 1-based (niveau 1 = <w:outlineLvl> 0).
    const niveauParagraphe = p.getElementsByTagNameNS(ns, "pPr")[0]
      ?.getElementsByTagNameNS(ns, "outlineLvl")[0]?.getAttribute("w:val");
    const niveau0Based = niveauParagraphe !== undefined && niveauParagraphe !== null
      ? parseInt(niveauParagraphe, 10)
      : (niveauxParStyle[style] !== undefined ? niveauxParStyle[style] : niveauDepuisNomStyle(style));
    const niveau = niveau0Based !== undefined ? niveau0Based + 1 : undefined;

    if (niveau === niveauPartie) {
      if (courant) chapitres.push({ ...courant, html: lignes.map(l => `<p>${l}</p>`).join(""), mots: lignes.join(" ").split(/\s+/).filter(Boolean).length });
      courant = { titre: texte, type: "partie" };
      lignes = [];
    } else if (niveau === niveauChapitre) {
      if (courant) chapitres.push({ ...courant, html: lignes.map(l => `<p>${l}</p>`).join(""), mots: lignes.join(" ").split(/\s+/).filter(Boolean).length });
      courant = { titre: texte, type: "chapitre" };
      lignes = [];
    } else if (courant) {
      lignes.push(texte);
    }
  }
  if (courant) chapitres.push({ ...courant, html: lignes.map(l => `<p>${l}</p>`).join(""), mots: lignes.join(" ").split(/\s+/).filter(Boolean).length });

  return chapitres.filter(c => c.mots > 0);
}

const NIVEAUX_TITRE = [1, 2, 3, 4, 5, 6];
const LIBELLÉ_NIVEAU = { 1: "Niveau 1 (Titre 1)", 2: "Niveau 2 (Titre 2)", 3: "Niveau 3 (Titre 3)", 4: "Niveau 4 (Titre 4)", 5: "Niveau 5 (Titre 5)", 6: "Niveau 6 (Titre 6)" };

// Normalise un titre pour la comparaison.
// CORRECTIF 28/07/2026 — BUG DE COLLISION : l'ancienne version EFFAÇAIT le
// numéro ("Chapitre 1", "Chapitre 2"… devenaient tous "chapitre "), si bien
// que la "correspondance exacte" renvoyait le PREMIER nœud "Chapitre N" de
// la liste pour TOUS les chapitres du Word. À l'import, les six textes
// s'écrivaient successivement dans ce même nœud (le dernier écrasant les
// autres) et les nœuds suivants restaient vides. Le numéro est désormais
// CONSERVÉ dans la forme normalisée ("chapitre 1" ≠ "chapitre 2") ; seule
// la ponctuation qui le suit est unifiée. Même correctif pour les parties
// ("Partie I" / "Partie II", chiffres romains ou arabes).
function normaliser(titre) {
  return titre.toLowerCase()
    .replace(/chapitre\s+(\d+)[\.\-—\s]*/gi, "chapitre $1 ")
    .replace(/partie\s+([ivxlcdm\d]+)[\.\-—\s]*/gi, "partie $1 ")
    .replace(/[^a-z0-9àâäéèêëîïôùûüç\s]/g, " ")
    .replace(/\s+/g, " ").trim();
}

// Texte brut d'un HTML — tags retirés, espaces normalisés — pour comparer
// le CONTENU d'un chapitre indépendamment de sa mise en forme (le HTML de
// Cursus vient de TipTap, celui extrait du Word est construit ici même :
// les deux diffèrent toujours en balises même quand le texte est identique).
function texteBrutDe(html) {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function compterMotsHtml(html) {
  const brut = texteBrutDe(html);
  return brut === "" ? 0 : brut.split(" ").length;
}

// Formate la date de dernière modification d'un nœud existant — ajouté
// 02/08/2026, à la demande de Joseph : en cas de conflit de contenu, le
// badge se contentait de dire "Garder Cursus" sans montrer POURQUOI —
// aucun moyen de juger laquelle des deux versions garder sans rouvrir le
// chapitre dans l'éditeur.
function formaterDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// Trouve le meilleur nœud existant pour un chapitre importé
function trouverCorrespondance(chapitreImporté, nœuds) {
  const titreN = normaliser(chapitreImporté.titre);
  const motsN = titreN.split(" ").filter(m => m.length > 3);

  let meilleurScore = 0;
  let meilleur = null;

  for (const n of nœuds) {
    const titreEx = normaliser(n.titre);
    
    // Correspondance exacte après normalisation
    if (titreEx === titreN) return n;

    // Score par mots communs
    const motsEx = titreEx.split(" ").filter(m => m.length > 3);
    const communs = motsEx.filter(m => motsN.includes(m)).length;
    const score = communs / Math.max(motsN.length, motsEx.length, 1);

    if (score > meilleurScore) {
      meilleurScore = score;
      meilleur = n;
    }
  }

  return meilleurScore >= 0.3 ? meilleur : null;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ImportDocx({ projet, nœudsExistants = [], onTerminé, onFermer }) {
  const [étape, setÉtape] = useState("sélection");
  const [chapitres, setChapitres] = useState([]);
  // index → { statut: "existant" | "nouveau" | "ignoré", nœudId: id | null }
  // "existant" : correspondance trouvée dans la structure, texte remplacé.
  // "nouveau"  : aucune correspondance, le nœud sera créé à l'import (par
  //              défaut) — nœudId est renseigné une fois créé.
  // "ignoré"   : aucune correspondance, l'auteur a choisi de ne pas créer ce
  //              nœud (bascule manuelle depuis "nouveau").
  const [associations, setAssociations] = useState({});
  const [progression, setProgression] = useState(0);
  const [erreur, setErreur] = useState(null);
  const [nomFichier, setNomFichier] = useState("");
  // Niveaux de titre Word à utiliser pour les Parties et les Chapitres —
  // réglables avant l'analyse (par défaut Titre 1 / Titre 2, comme avant).
  const [niveauPartie, setNiveauPartie] = useState(1);
  const [niveauChapitre, setNiveauChapitre] = useState(2);
  const inputRef = useRef(null);
  const couleur = projet?.couleur || "#7F77DD";

  const analyser = async (fichier) => {
    if (!fichier?.name.endsWith(".docx")) { setErreur("Fichier .docx requis"); return; }
    setNomFichier(fichier.name);
    setÉtape("analyse");
    setErreur(null);
    try {
      const résultat = await extraireChapitres(fichier, niveauPartie, niveauChapitre);
      if (!résultat.length) { setErreur(`Aucun chapitre détecté. Vérifiez les styles ${LIBELLÉ_NIVEAU[niveauPartie]} / ${LIBELLÉ_NIVEAU[niveauChapitre]} dans Word.`); setÉtape("sélection"); return; }

      // Associer automatiquement chaque chapitre au nœud correspondant, ou
      // le proposer comme nouveau nœud à créer à l'import s'il n'a pas de
      // correspondance.
      //
      // CORRECTIF 01/08/2026 — un chapitre ("Titre2") sans AUCUNE partie
      // ("Titre1") avant lui dans le document n'a pas de parent où
      // l'accrocher : le créer quand même le place à la racine, EXACTEMENT
      // au même niveau que les vraies parties (constaté en conditions
      // réelles : 20 premiers chapitres d'un manuscrit sans partie
      // introductive, tous créés comme s'ils étaient des parties). Ces
      // chapitres "orphelins" sont désormais exclus par défaut (statut
      // "ignoré", marqués `orphelin: true`) — l'auteur voit pourquoi et doit
      // les inclure explicitement s'il veut vraiment les créer à la racine.
      // CORRECTIF 02/08/2026 — un chapitre déjà associé à un nœud existant
      // écrasait silencieusement son contenu Cursus, même si celui-ci avait
      // été modifié depuis (dans l'éditeur, par exemple) et différait
      // désormais du Word. Comparaison en texte brut (indépendante de la
      // mise en forme HTML, qui diffère toujours entre TipTap et l'extrait
      // Word même à contenu identique) : si les deux versions divergent
      // réellement, l'auteur doit choisir laquelle garder — par défaut,
      // rien n'est écrasé (`choixConflit: "cursus"`).
      //
      // CORRECTIF 02/08/2026 (bis) — BUG RÉEL, PAS UN DÉTAIL : trouverCorrespondance()
      // cherchait un titre dans TOUTE la liste des nœuds du projet, sans
      // tenir compte du chapitre parent. Un titre de sous-section générique
      // et répété ("Enjeux", "Questions ouvertes", "Introduction"…) apparaît
      // dans PRESQUE CHAQUE chapitre du document — la recherche globale
      // retournait alors le premier "Enjeux" trouvé n'importe où dans le
      // projet, jamais forcément celui du bon chapitre. Conséquence
      // constatée en conditions réelles : le "Enjeux" du chapitre 12 du Word
      // (55 mots) associé et écrasé sur le "Enjeux" d'un AUTRE chapitre en
      // base (244 mots), sans qu'aucun conflit ne soit détecté — la
      // comparaison de contenu du correctif précédent comparait déjà les
      // deux mauvais textes entre eux, donc parfois "par chance" identiques,
      // parfois pas, mais toujours sur le mauvais nœud.
      // La recherche est désormais restreinte aux enfants du VRAI parent en
      // cours (la dernière "partie" du document déjà associée à un nœud
      // existant) — jamais à l'ensemble du projet. Un chapitre sans parent
      // existant (partie elle-même nouvelle, ou pas encore rencontrée) n'a
      // par construction aucun candidat possible : il devient "nouveau".
      const assoc = {};
      let auMoinsUnePartieVue = false;
      let partieActuelleExistante = null; // nœud EXISTANT de la dernière "partie" du Word déjà rencontrée
      const partiesRacines = nœudsExistants.filter((n) => !n.parent_id);

      résultat.forEach((ch, i) => {
        const candidats = ch.type === "partie"
          ? partiesRacines
          : (partieActuelleExistante ? nœudsExistants.filter((n) => n.parent_id === partieActuelleExistante.id) : []);
        const match = trouverCorrespondance(ch, candidats);

        if (match) {
          const conflit = !!match.texte && texteBrutDe(match.texte) !== texteBrutDe(ch.html);
          assoc[i] = { statut: "existant", nœudId: match.id, conflit, choixConflit: conflit ? "cursus" : null };
          if (ch.type === "partie") { auMoinsUnePartieVue = true; partieActuelleExistante = match; }
          return;
        }
        if (ch.type === "partie") {
          assoc[i] = { statut: "nouveau", nœudId: null };
          auMoinsUnePartieVue = true;
          partieActuelleExistante = null; // partie à créer : pas encore d'id, donc pas de scope de recherche pour ses futurs enfants
          return;
        }
        assoc[i] = auMoinsUnePartieVue
          ? { statut: "nouveau", nœudId: null }
          : { statut: "ignoré", nœudId: null, orphelin: true };
      });

      setChapitres(résultat);
      setAssociations(assoc);
      setÉtape("confirmation");
    } catch(e) {
      setErreur("Erreur de lecture : " + e.message);
      setÉtape("sélection");
    }
  };

  // Bascule un chapitre sans correspondance entre "nouveau" (sera créé) et
  // "ignoré" (laissé de côté) — sans effet sur les chapitres déjà associés
  // à un nœud existant.
  const basculerStatut = (i) => {
    setAssociations((prev) => {
      const courant = prev[i];
      if (!courant || courant.statut === "existant") return prev;
      return { ...prev, [i]: { ...courant, statut: courant.statut === "nouveau" ? "ignoré" : "nouveau" } };
    });
  };

  // Choix de version pour un chapitre en conflit (contenu différent entre
  // Cursus et le Word) — bascule entre garder la version Cursus (par
  // défaut, rien n'est écrasé) et utiliser la version Word (écrase à
  // l'import, comme le comportement d'avant ce correctif).
  const basculerChoixConflit = (i) => {
    setAssociations((prev) => {
      const courant = prev[i];
      if (!courant?.conflit) return prev;
      return { ...prev, [i]: { ...courant, choixConflit: courant.choixConflit === "cursus" ? "word" : "cursus" } };
    });
  };

  const importer = async () => {
    setÉtape("import");
    setProgression(0);
    setErreur(null);

    const àFaire = chapitres
      .map((ch, i) => ({ ch, i, décision: associations[i] }))
      .filter(({ décision }) => décision && décision.statut !== "ignoré");
    let fait = 0;

    // Nœuds CRÉÉS par cet import, groupés par parent — pour le passage
    // unique de réordonnancement en fin d'import (voir note en tête de
    // fichier sur la limite connue de ce renumérotage).
    const groupesParParent = {};
    let dernièrePartieId = null;

    try {
      for (const { ch, i, décision } of àFaire) {
        let nœudId = décision.nœudId;

        if (décision.statut === "nouveau") {
          const parentId = ch.type === "partie" ? null : dernièrePartieId;
          const { data, error } = await nœudsAPI.créer({
            type: ch.type,
            titre: ch.titre,
            parentId,
            texte: ch.html,
          }, projet.id);
          if (error || !data) throw error || new Error("Échec de création du nœud « " + ch.titre + " »");
          nœudId = data.id;

          const clé = parentId || "__racine__";
          (groupesParParent[clé] ||= []).push(nœudId);
        } else if (!décision.conflit || décision.choixConflit === "word") {
          await nœudsAPI.sauvegarderTexte(nœudId, ch.html);
        }
        // Sinon (conflit + "Garder Cursus") : le nœud est compté comme
        // traité mais son texte n'est volontairement pas touché.

        if (ch.type === "partie") dernièrePartieId = nœudId;

        fait++;
        setProgression(Math.round((fait / àFaire.length) * 100));
      }

      const misÀJour = Object.values(groupesParParent).flatMap((ids) => ids.map((id, ordre) => ({ id, ordre })));
      if (misÀJour.length > 0) {
        const { error } = await nœudsAPI.réordonner(misÀJour);
        if (error) throw error;
      }

      setÉtape("terminé");
      setTimeout(() => onTerminé?.(), 1500);
    } catch (e) {
      setErreur("Erreur pendant l'import : " + (e.message || String(e)));
      setÉtape("confirmation");
    }
  };

  const statutsÉligibles = (d) => d?.statut === "existant" || d?.statut === "nouveau";
  // Le texte sera réellement écrit sauf en cas de conflit non résolu vers
  // "word" (choix par défaut : garder la version Cursus, rien n'est écrit).
  const seraÉcrit = (d) => d?.statut === "nouveau" || (d?.statut === "existant" && (!d.conflit || d.choixConflit === "word"));
  const totalÉligibles = Object.values(associations).filter(statutsÉligibles).length;
  const totalExistants = Object.values(associations).filter((d) => d?.statut === "existant").length;
  const totalNouveaux = Object.values(associations).filter((d) => d?.statut === "nouveau").length;
  const totalOrphelins = Object.values(associations).filter((d) => d?.orphelin).length;
  const totalConflits = Object.values(associations).filter((d) => d?.conflit).length;
  const totalMots = chapitres.filter((_, i) => seraÉcrit(associations[i])).reduce((a, c) => a + c.mots, 0);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: 640, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.2)", overflow: "hidden" }}>

        {/* En-tête */}
        <div style={{ padding: "20px 24px", borderBottom: "0.5px solid #e5e5e5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>Importer un fichier Word</div>
            <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{projet?.titre}</div>
          </div>
          <button onClick={onFermer} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#999" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>

          {/* Sélection */}
          {étape === "sélection" && (
            <div>
              <div style={{ display: "flex", gap: 12, marginBottom: 16, fontSize: 12.5, color: "#555" }}>
                <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  Niveau des Parties
                  <select
                    value={niveauPartie}
                    onChange={(e) => setNiveauPartie(Number(e.target.value))}
                    style={{ padding: "6px 8px", border: "0.5px solid #ddd", borderRadius: 6, fontFamily: "inherit", fontSize: 13 }}
                  >
                    {NIVEAUX_TITRE.map((n) => <option key={n} value={n}>{LIBELLÉ_NIVEAU[n]}</option>)}
                  </select>
                </label>
                <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  Niveau des Chapitres
                  <select
                    value={niveauChapitre}
                    onChange={(e) => setNiveauChapitre(Number(e.target.value))}
                    style={{ padding: "6px 8px", border: "0.5px solid #ddd", borderRadius: 6, fontFamily: "inherit", fontSize: 13 }}
                  >
                    {NIVEAUX_TITRE.map((n) => <option key={n} value={n}>{LIBELLÉ_NIVEAU[n]}</option>)}
                  </select>
                </label>
              </div>
              {niveauPartie === niveauChapitre && (
                <div style={{ marginBottom: 14, padding: "8px 12px", background: "#FAEEDA", borderRadius: 8, fontSize: 12, color: "#854F0B" }}>
                  Les Parties et les Chapitres utilisent le même niveau de titre — tout sera importé comme Partie.
                </div>
              )}
              <div onClick={() => inputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); analyser(e.dataTransfer.files[0]); }}
                style={{ border: `2px dashed ${couleur}60`, borderRadius: 12, padding: "48px 24px", textAlign: "center", cursor: "pointer", background: `${couleur}06` }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Cliquez ou glissez votre fichier Word ici</div>
                <div style={{ fontSize: 12, color: "#999" }}>Format .docx — {LIBELLÉ_NIVEAU[niveauPartie]} = Parties, {LIBELLÉ_NIVEAU[niveauChapitre]} = Chapitres</div>
                <input ref={inputRef} type="file" accept=".docx" style={{ display: "none" }} onChange={e => analyser(e.target.files[0])} />
              </div>
              {erreur && <div style={{ marginTop: 14, padding: "10px 14px", background: "#FCEBEB", borderRadius: 8, fontSize: 13, color: "#A32D2D" }}>{erreur}</div>}
            </div>
          )}

          {/* Analyse */}
          {étape === "analyse" && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ width: 40, height: 40, border: `3px solid ${couleur}30`, borderTopColor: couleur, borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 16px" }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <div style={{ fontSize: 14, color: "#555" }}>Analyse de {nomFichier}…</div>
            </div>
          )}

          {/* Confirmation */}
          {étape === "confirmation" && (
            <div>
              {erreur && <div style={{ marginBottom: 14, padding: "10px 14px", background: "#FCEBEB", borderRadius: 8, fontSize: 13, color: "#A32D2D" }}>{erreur}</div>}
              <div style={{ background: `${couleur}10`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#333" }}>
                <strong>{totalExistants}</strong> chapitre{totalExistants !== 1 ? "s" : ""} associé{totalExistants !== 1 ? "s" : ""} à des nœuds existants
                {totalNouveaux > 0 && <> · <strong>{totalNouveaux}</strong> nouveau{totalNouveaux > 1 ? "x" : ""} nœud{totalNouveaux > 1 ? "s" : ""} à créer</>}
                {" · "}<strong>{totalMots.toLocaleString("fr-FR")}</strong> mots à importer
              </div>
              {totalOrphelins > 0 && (
                <div style={{ background: "#FAEEDA", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 12.5, color: "#854F0B", lineHeight: 1.5 }}>
                  ⚠️ <strong>{totalOrphelins}</strong> chapitre{totalOrphelins > 1 ? "s" : ""} n'{totalOrphelins > 1 ? "ont" : "a"} aucune partie avant {totalOrphelins > 1 ? "eux" : "lui"} dans le document — les créer les placerait à la racine du projet, au même niveau que des parties. Laissés de côté par défaut ; cliquez sur leur badge si vous voulez vraiment les créer ainsi.
                </div>
              )}
              {totalConflits > 0 && (
                <div style={{ background: "#FCEBEB", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 12.5, color: "#A32D2D", lineHeight: 1.5 }}>
                  ⚠️ <strong>{totalConflits}</strong> chapitre{totalConflits > 1 ? "s" : ""} déjà présent{totalConflits > 1 ? "s" : ""} dans Cursus {totalConflits > 1 ? "ont" : "a"} un contenu différent du Word — la version Cursus est gardée par défaut pour chacun. Cliquez sur leur badge « Garder Cursus » pour basculer vers « Utiliser Word » si vous voulez écraser.
                </div>
              )}

              <div style={{ display: "grid", gap: 6 }}>
                {chapitres.map((ch, i) => {
                  const décision = associations[i];
                  const nœud = décision?.statut === "existant" ? nœudsExistants.find(n => n.id === décision.nœudId) : null;
                  const éligible = statutsÉligibles(décision);
                  return (
                    <div key={i} style={{ padding: "10px 12px", borderRadius: 8, background: éligible ? `${couleur}08` : "#fafafa", border: `0.5px solid ${éligible ? couleur + "30" : "#e5e5e5"}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 13, flex: 1, color: "#1a1a1a" }}>
                          {ch.type === "partie" ? "📂" : "📄"} {ch.titre.slice(0, 45)}
                        </span>
                        <span style={{ fontSize: 11, color: "#999", marginRight: 8 }}>{ch.mots} mots</span>
                        {décision?.statut === "existant" && décision.conflit ? (
                          <button
                            onClick={() => basculerChoixConflit(i)}
                            title="Contenu différent entre Cursus et le Word — cliquer pour changer quelle version garder"
                            style={décision.choixConflit === "word"
                              ? { fontSize: 11, fontWeight: 500, color: "#A32D2D", background: "#FCEBEB", border: "none", padding: "2px 8px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit" }
                              : { fontSize: 11, fontWeight: 500, color: "#777", background: "#f0f0f0", border: "none", padding: "2px 8px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit" }}
                          >
                            {décision.choixConflit === "word" ? "⚠️ Utiliser Word (écrase Cursus)" : "⚠️ Garder Cursus"}
                          </button>
                        ) : décision?.statut === "existant" ? (
                          <span style={{ fontSize: 11, color: couleur, background: `${couleur}15`, padding: "2px 8px", borderRadius: 20 }}>
                            → {nœud?.titre?.slice(0, 25) || "?"}
                          </span>
                        ) : décision?.statut === "nouveau" ? (
                          <button
                            onClick={() => basculerStatut(i)}
                            title={décision.orphelin ? "Sans partie parente — sera créé à la racine du projet. Cliquer pour ne pas le créer" : "Ce nœud sera créé à l'import — cliquer pour ne pas le créer"}
                            style={décision.orphelin
                              ? { fontSize: 11, fontWeight: 500, color: "#BA7517", background: "#FAEEDA", border: "none", padding: "2px 8px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit" }
                              : { fontSize: 11, fontWeight: 500, color: "#1D9E75", background: "#E1F5EE", border: "none", padding: "2px 8px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit" }}
                          >
                            {décision.orphelin ? "⚠️ Nouveau nœud (à la racine)" : "✨ Nouveau nœud"}
                          </button>
                        ) : (
                          <button
                            onClick={() => basculerStatut(i)}
                            title={décision?.orphelin ? "Sans partie parente dans le document — cliquer pour le créer quand même à la racine" : "Ce chapitre ne sera pas importé — cliquer pour créer le nœud finalement"}
                            style={{ fontSize: 11, color: "#999", background: "#f0f0f0", border: "none", padding: "2px 8px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit" }}
                          >
                            {décision?.orphelin ? "Ignoré — sans partie" : "Ignoré"}
                          </button>
                        )}
                      </div>
                      {/* Comparaison des deux versions — ajoutée 02/08/2026, à la
                          demande de Joseph : le badge seul ne disait pas POURQUOI
                          il fallait choisir entre les deux versions. Mots + date
                          de dernière modification, faute de pouvoir afficher un
                          vrai diff dans cet espace restreint.
                          CORRECTIF 02/08/2026 (ter) : n'était affichée qu'en cas
                          de conflit détecté — impossible de vérifier À L'ŒIL si
                          une correspondance SANS conflit signalé était la bonne
                          (ou si le "aucun conflit" cachait en fait un nœud vide,
                          par exemple). Affichée désormais pour TOUTE correspondance
                          existante, conflit ou non — chemin complet du nœud
                          (parent → titre) inclus, pour vérifier que la correspondance
                          pointe vers le bon chapitre et pas un homonyme ailleurs
                          dans le projet. */}
                      {décision?.statut === "existant" && (
                        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "0.5px dashed #e5e5e5", display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "#777" }}>
                          <span>
                            <strong style={{ color: "#555" }}>Chemin Cursus</strong> : {(() => {
                              const parent = nœud?.parent_id ? nœudsExistants.find(n => n.id === nœud.parent_id) : null;
                              return parent ? `${parent.titre} → ${nœud?.titre || "?"}` : (nœud?.titre || "?");
                            })()}
                          </span>
                          <div style={{ display: "flex", gap: 16 }}>
                            <span>
                              <strong style={{ color: "#555" }}>Cursus</strong> : {compterMotsHtml(nœud?.texte)} mots
                              {formaterDate(nœud?.mis_a_jour) && <> · modifié le {formaterDate(nœud.mis_a_jour)}</>}
                            </span>
                            <span>
                              <strong style={{ color: "#555" }}>Word</strong> : {ch.mots} mots
                            </span>
                            {!décision.conflit && <span style={{ color: "#1D9E75" }}>✓ contenu identique</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Import */}
          {étape === "import" && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>📥</div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Import en cours…</div>
              <div style={{ height: 6, background: "#e5e5e5", borderRadius: 4, overflow: "hidden", margin: "0 48px" }}>
                <div style={{ width: `${progression}%`, height: "100%", background: couleur, transition: "width .3s" }} />
              </div>
              <div style={{ fontSize: 12, color: "#999", marginTop: 8 }}>{progression}%</div>
            </div>
          )}

          {/* Terminé */}
          {étape === "terminé" && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>Import terminé !</div>
              <div style={{ fontSize: 13, color: "#999", marginTop: 4 }}>Le texte est dans vos chapitres.</div>
            </div>
          )}
        </div>

        {/* Pied */}
        {(étape === "sélection" || étape === "confirmation") && (
          <div style={{ padding: "16px 24px", borderTop: "0.5px solid #e5e5e5", display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={onFermer} style={{ background: "transparent", border: "0.5px solid #e5e5e5", borderRadius: 8, padding: "8px 18px", fontSize: 13, color: "#555", cursor: "pointer", fontFamily: "inherit" }}>
              Annuler
            </button>
            {étape === "confirmation" && totalÉligibles > 0 && (
              <button onClick={importer} style={{ background: couleur, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                Importer {totalÉligibles} chapitre{totalÉligibles > 1 ? "s" : ""}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

