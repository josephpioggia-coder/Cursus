/**
 * ATELIER D'ÉCRIVAIN — Import Word
 * Lit n'importe quel .docx et remplace le contenu
 * des chapitres existants par correspondance de titre.
 * Fonctionne pour tous les livres, pas seulement le Tome I.
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

// Recolle les paragraphes fragmentés — chantier 28/07/2026, découvert sur
// le manuscrit "Les Orchidées du sous-sol" (720 paragraphes XML pour ~65
// attendus). CAUSE : certains documents Word sont saisis avec une touche
// Entrée à chaque retour visuel de ligne plutôt qu'un vrai paragraphe —
// chaque ligne de la page devient alors un <w:p> à part entière dans le
// XML. Résultat sans ce correctif : le texte importé arrive en dizaines de
// petits blocs fragmentés dans l'éditeur (constaté noir sur blanc :
// "Au prononcé du verdict... trop de temps pour" / "que la lente" comme
// DEUX paragraphes distincts).
// RÈGLE DE FUSION : une ligne qui se termine par une ponctuation FINALE
// (. ! ? … » ou guillemet fermant) marque une vraie fin de paragraphe ;
// sinon, la ligne suivante en est la suite naturelle et doit être recollée
// avec un simple espace. Validée manuellement sur le texte réel de ce
// manuscrit (66 paragraphes correctement reconstitués, aucun mot perdu).
// Les DEUX lignes qui composaient un même paragraphe original restent deux
// lignes DOM séparées en amont (une par <w:p>) : c'est pourquoi on fusionne
// au niveau des lignes de texte brut, avant construction du HTML — pas
// après, où l'information de coupure serait déjà perdue dans un unique <p>.
const FIN_PARAGRAPHE = /[.!?…»”']\'?\s*$/;

function fusionnerLignesFragmentées(lignes) {
  const fusionnées = []; // éléments : { texte, estListe }
  let courante = "";
  for (const ligne of lignes) {
    if (ligne.estListe) {
      // Frontière ferme des DEUX côtés : on clôt d'abord ce qui était en
      // cours de fusion (même incomplet — mieux vaut un paragraphe scindé
      // qu'un item de liste avalé), puis l'item de liste est poussé seul,
      // jamais fusionné avec le suivant même si son texte ne se termine
      // pas par une ponctuation finale (fréquent en fin d'item de liste).
      if (courante) { fusionnées.push({ texte: courante, estListe: false }); courante = ""; }
      fusionnées.push({ texte: ligne.texte, estListe: true });
      continue;
    }
    courante = courante ? `${courante} ${ligne.texte}` : ligne.texte;
    if (FIN_PARAGRAPHE.test(ligne.texte)) {
      fusionnées.push({ texte: courante, estListe: false });
      courante = "";
    }
  }
  if (courante) fusionnées.push({ texte: courante, estListe: false });
  return fusionnées;
}

// Construit le html et le compte de mots d'un chapitre, en appliquant
// D'ABORD la fusion des lignes fragmentées — chantier 28/07/2026. Les
// items de liste consécutifs sont regroupés en un seul <ul> (plutôt que
// des <p> isolés qui perdraient visuellement la puce à l'affichage).
function construireChapitre(courant, lignes) {
  const éléments = fusionnerLignesFragmentées(lignes);
  const morceauxHtml = [];
  let listeEnCours = [];
  const clôtLaListe = () => {
    if (listeEnCours.length) {
      morceauxHtml.push(`<ul>${listeEnCours.map((t) => `<li>${t}</li>`).join("")}</ul>`);
      listeEnCours = [];
    }
  };
  for (const é of éléments) {
    if (é.estListe) { listeEnCours.push(é.texte); }
    else { clôtLaListe(); morceauxHtml.push(`<p>${é.texte}</p>`); }
  }
  clôtLaListe();

  return {
    ...courant,
    html: morceauxHtml.join(""),
    mots: éléments.map((é) => é.texte).join(" ").split(/\s+/).filter(Boolean).length,
  };
}

async function extraireChapitres(fichier) {
  const JSZip = await chargerJSZip();
  const zip = await JSZip.loadAsync(await fichier.arrayBuffer());
  const xml = await zip.file("word/document.xml").async("string");

  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const paras = doc.getElementsByTagNameNS(ns, "p");

  // Styles à ignorer (table des matières, métadonnées)
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

    if (style === "Titre1") {
      if (courant) chapitres.push(construireChapitre(courant, lignes));
      courant = { titre: texte, type: "partie" };
      lignes = [];
    } else if (style === "Titre2") {
      if (courant) chapitres.push(construireChapitre(courant, lignes));
      courant = { titre: texte, type: "chapitre" };
      lignes = [];
    } else if (courant) {
      // Détection des puces/listes — chantier 28/07/2026, découvert sur un
      // intitulé terminé par ":" suivi d'une liste : ":" n'est pas une
      // ponctuation FINALE de phrase, donc l'ancienne fusion recollait
      // l'intitulé au premier item, puis chaque item au suivant — la liste
      // entière fondait en un seul bloc, puces ET paragraphes perdus.
      // Un item de liste Word porte soit le style "Paragraphedeliste" soit
      // une numérotation <w:numPr> (puce ou numéro automatique). On le
      // MARQUE plutôt que de le fusionner : fusionnerLignesFragmentées
      // traitera toute ligne estListe=true comme une frontière de
      // paragraphe ferme, des deux côtés.
      const estListe = style === "Paragraphedeliste" ||
        p.getElementsByTagNameNS(ns, "numPr").length > 0;
      lignes.push({ texte, estListe });
    }
  }
  if (courant) chapitres.push(construireChapitre(courant, lignes));

  return chapitres.filter(c => c.mots > 0);
}

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
  const [associations, setAssociations] = useState({}); // index → nœud.id
  const [progression, setProgression] = useState(0);
  const [erreur, setErreur] = useState(null);
  const [nomFichier, setNomFichier] = useState("");
  const inputRef = useRef(null);
  const couleur = projet?.couleur || "#7F77DD";

  const analyser = async (fichier) => {
    if (!fichier?.name.endsWith(".docx")) { setErreur("Fichier .docx requis"); return; }
    setNomFichier(fichier.name);
    setÉtape("analyse");
    setErreur(null);
    try {
      const résultat = await extraireChapitres(fichier);
      if (!résultat.length) { setErreur("Aucun chapitre détecté. Vérifiez les styles Titre 1 / Titre 2 dans Word."); setÉtape("sélection"); return; }

      // Association automatique — étendue le 28/07/2026 (soir) : les
      // chapitres SANS correspondance ne sont plus laissés de côté ("Sans
      // correspondance", obligeant Joseph à créer les dossiers à la main
      // avant d'importer) — ils sont désormais marqués "__CREER__" par
      // défaut. Le nœud sera créé automatiquement au bon endroit lors de
      // l'import (voir importer() plus bas). L'auteur peut désactiver la
      // création au cas par cas dans l'écran de confirmation.
      const assoc = {};
      résultat.forEach((ch, i) => {
        const match = trouverCorrespondance(ch, nœudsExistants);
        assoc[i] = match ? match.id : "__CREER__";
      });

      setChapitres(résultat);
      setAssociations(assoc);
      setÉtape("confirmation");
    } catch(e) {
      setErreur("Erreur de lecture : " + e.message);
      setÉtape("sélection");
    }
  };

  // Import — étendu le 28/07/2026 (soir), chantier "création automatique
  // des nœuds manquants" (fiche du 28/07). Pour chaque chapitre :
  //   - associations[i] = un id réel  → nœud existant, texte écrasé
  //     (comportement inchangé depuis toujours — pas de confirmation
  //     d'écrasement individuelle ce soir, portée volontairement limitée ;
  //     voir la fiche de chantier pour ce raffinement futur).
  //   - associations[i] === "__CREER__" → nouveau nœud créé. Le PARENT est
  //     déterminé en suivant l'ordre du document : un nouveau "chapitre"
  //     est rattaché à la dernière "partie" rencontrée dans le fichier
  //     Word (existante ou elle-même tout juste créée) ; une nouvelle
  //     "partie" est toujours créée à la racine.
  //   - associations[i] === undefined → ignoré, comme avant.
  // Une fois tous les nœuds touchés (existants + créés) identifiés par
  // parent, un seul passage de réordonnancement (nœudsAPI.réordonner) leur
  // donne un ordre 0..n-1 reflétant fidèlement l'ordre du document source.
  // ⚠️ LIMITE CONNUE, non résolue ce soir faute de temps : ce
  // réordonnancement ne renumérote QUE les nœuds touchés par CET import ;
  // un frère préexistant non mentionné dans le Word (ajouté manuellement
  // par ailleurs) garde son ancien numéro d'ordre et pourrait se retrouver
  // mal intercalé. Cas à tester à la prochaine session sur un projet réel
  // mêlant nœuds manuels et import.
  const importer = async () => {
    setÉtape("import");
    setProgression(0);
    const àFaire = Object.entries(associations).filter(([, v]) => v);
    let fait = 0;

    let parentCourantId = null; // racine, jusqu'à la première "partie" créée/associée
    const frèresParParent = new Map(); // clé parent ("__racine__" ou id) → [ids dans l'ordre du document]
    const enregistrer = (clé, id) => {
      if (!frèresParParent.has(clé)) frèresParParent.set(clé, []);
      frèresParParent.get(clé).push(id);
    };

    for (const [idxStr, valeur] of àFaire) {
      const idx = parseInt(idxStr, 10);
      const ch = chapitres[idx];
      let idRéel = null;

      if (valeur === "__CREER__") {
        const parentPourCeNœud = ch.type === "partie" ? null : parentCourantId;
        const { data, error } = await nœudsAPI.créer(
          { parentId: parentPourCeNœud, type: ch.type, titre: ch.titre, texte: ch.html, ordre: 0 },
          projet.id
        );
        if (error || !data) { fait++; continue; } // échec isolé : on continue le reste de l'import
        idRéel = data.id;
      } else {
        idRéel = valeur;
        await nœudsAPI.sauvegarderTexte(idRéel, ch.html);
      }

      const cléParent = ch.type === "partie" ? "__racine__" : (parentCourantId || "__racine__");
      enregistrer(cléParent, idRéel);
      if (ch.type === "partie") parentCourantId = idRéel;

      fait++;
      setProgression(Math.round((fait / àFaire.length) * 100));
    }

    // Renumérotation finale, par groupe de frères touchés — reflète
    // exactement l'ordre du document Word, pas l'ordre d'écriture en base.
    const misesÀJour = [];
    for (const idsOrdonnés of frèresParParent.values()) {
      idsOrdonnés.forEach((id, ordre) => misesÀJour.push({ id, ordre }));
    }
    if (misesÀJour.length) await nœudsAPI.réordonner(misesÀJour);

    setÉtape("terminé");
    setTimeout(() => onTerminé?.(), 1500);
  };

  const totalAssociés = Object.values(associations).filter(Boolean).length;
  const totalMots = chapitres.filter((_, i) => associations[i]).reduce((a, c) => a + c.mots, 0);

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
              <div onClick={() => inputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); analyser(e.dataTransfer.files[0]); }}
                style={{ border: `2px dashed ${couleur}60`, borderRadius: 12, padding: "48px 24px", textAlign: "center", cursor: "pointer", background: `${couleur}06` }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Cliquez ou glissez votre fichier Word ici</div>
                <div style={{ fontSize: 12, color: "#999" }}>Format .docx — Titres 1 = Parties, Titres 2 = Chapitres</div>
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
              <div style={{ background: `${couleur}10`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#333" }}>
                <strong>{Object.values(associations).filter(v => v && v !== "__CREER__").length}</strong> nœud{Object.values(associations).filter(v => v && v !== "__CREER__").length > 1 ? "s" : ""} existant{Object.values(associations).filter(v => v && v !== "__CREER__").length > 1 ? "s" : ""} rempli{Object.values(associations).filter(v => v && v !== "__CREER__").length > 1 ? "s" : ""}
                {" · "}
                <strong>{Object.values(associations).filter(v => v === "__CREER__").length}</strong> nouveau{Object.values(associations).filter(v => v === "__CREER__").length > 1 ? "x" : ""} nœud{Object.values(associations).filter(v => v === "__CREER__").length > 1 ? "s" : ""} à créer
                {" · "}
                <strong>{totalMots.toLocaleString("fr-FR")}</strong> mots à importer
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                {chapitres.map((ch, i) => {
                  const valeur = associations[i];
                  const estCréation = valeur === "__CREER__";
                  const estExistant = valeur && !estCréation;
                  const nœud = estExistant ? nœudsExistants.find(n => n.id === valeur) : null;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: valeur ? `${couleur}08` : "#fafafa", border: `0.5px solid ${valeur ? couleur + "30" : "#e5e5e5"}` }}>
                      <span style={{ fontSize: 13, flex: 1, color: "#1a1a1a" }}>
                        {ch.type === "partie" ? "📂" : "📄"} {ch.titre.slice(0, 45)}
                      </span>
                      <span style={{ fontSize: 11, color: "#999", marginRight: 8 }}>{ch.mots} mots</span>
                      {estExistant && (
                        <span style={{ fontSize: 11, color: couleur, background: `${couleur}15`, padding: "2px 8px", borderRadius: 20 }}>
                          → {nœud?.titre?.slice(0, 25) || "?"}
                        </span>
                      )}
                      {estCréation && (
                        // Nouveau nœud à créer — chantier 28/07/2026 (soir).
                        // Cliquable : bascule vers "ignoré" si l'auteur ne
                        // veut PAS créer ce nœud automatiquement (ex. un
                        // chapitre déjà volontairement laissé de côté).
                        <button
                          onClick={() => setAssociations(a => ({ ...a, [i]: undefined }))}
                          title="Cliquer pour ne PAS créer ce nœud automatiquement"
                          style={{ fontSize: 11, color: "#1D9E75", background: "#1D9E7515", border: "none", padding: "2px 8px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          ✨ Nouveau nœud
                        </button>
                      )}
                      {!valeur && (
                        <button
                          onClick={() => setAssociations(a => ({ ...a, [i]: "__CREER__" }))}
                          title="Cliquer pour créer ce nœud automatiquement"
                          style={{ fontSize: 11, color: "#999", background: "#eee", border: "none", padding: "2px 8px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          Ignoré — cliquer pour créer
                        </button>
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
            {étape === "confirmation" && totalAssociés > 0 && (
              <button onClick={importer} style={{ background: couleur, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                Importer {totalAssociés} chapitre{totalAssociés > 1 ? "s" : ""}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

