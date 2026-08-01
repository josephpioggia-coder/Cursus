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
      if (courant) chapitres.push({ ...courant, html: lignes.map(l => `<p>${l}</p>`).join(""), mots: lignes.join(" ").split(/\s+/).filter(Boolean).length });
      courant = { titre: texte, type: "partie" };
      lignes = [];
    } else if (style === "Titre2") {
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

      // Associer automatiquement chaque chapitre au nœud correspondant, ou
      // le proposer comme nouveau nœud à créer à l'import s'il n'a pas de
      // correspondance.
      const assoc = {};
      résultat.forEach((ch, i) => {
        const match = trouverCorrespondance(ch, nœudsExistants);
        assoc[i] = match ? { statut: "existant", nœudId: match.id } : { statut: "nouveau", nœudId: null };
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
        } else {
          await nœudsAPI.sauvegarderTexte(nœudId, ch.html);
        }

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
  const totalÉligibles = Object.values(associations).filter(statutsÉligibles).length;
  const totalExistants = Object.values(associations).filter((d) => d?.statut === "existant").length;
  const totalNouveaux = Object.values(associations).filter((d) => d?.statut === "nouveau").length;
  const totalMots = chapitres.filter((_, i) => statutsÉligibles(associations[i])).reduce((a, c) => a + c.mots, 0);

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
              {erreur && <div style={{ marginBottom: 14, padding: "10px 14px", background: "#FCEBEB", borderRadius: 8, fontSize: 13, color: "#A32D2D" }}>{erreur}</div>}
              <div style={{ background: `${couleur}10`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#333" }}>
                <strong>{totalExistants}</strong> chapitre{totalExistants !== 1 ? "s" : ""} associé{totalExistants !== 1 ? "s" : ""} à des nœuds existants
                {totalNouveaux > 0 && <> · <strong>{totalNouveaux}</strong> nouveau{totalNouveaux > 1 ? "x" : ""} nœud{totalNouveaux > 1 ? "s" : ""} à créer</>}
                {" · "}<strong>{totalMots.toLocaleString("fr-FR")}</strong> mots à importer
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                {chapitres.map((ch, i) => {
                  const décision = associations[i];
                  const nœud = décision?.statut === "existant" ? nœudsExistants.find(n => n.id === décision.nœudId) : null;
                  const éligible = statutsÉligibles(décision);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: éligible ? `${couleur}08` : "#fafafa", border: `0.5px solid ${éligible ? couleur + "30" : "#e5e5e5"}` }}>
                      <span style={{ fontSize: 13, flex: 1, color: "#1a1a1a" }}>
                        {ch.type === "partie" ? "📂" : "📄"} {ch.titre.slice(0, 45)}
                      </span>
                      <span style={{ fontSize: 11, color: "#999", marginRight: 8 }}>{ch.mots} mots</span>
                      {décision?.statut === "existant" ? (
                        <span style={{ fontSize: 11, color: couleur, background: `${couleur}15`, padding: "2px 8px", borderRadius: 20 }}>
                          → {nœud?.titre?.slice(0, 25) || "?"}
                        </span>
                      ) : décision?.statut === "nouveau" ? (
                        <button
                          onClick={() => basculerStatut(i)}
                          title="Ce nœud sera créé à l'import — cliquer pour ne pas le créer"
                          style={{ fontSize: 11, fontWeight: 500, color: "#1D9E75", background: "#E1F5EE", border: "none", padding: "2px 8px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          ✨ Nouveau nœud
                        </button>
                      ) : (
                        <button
                          onClick={() => basculerStatut(i)}
                          title="Ce chapitre ne sera pas importé — cliquer pour créer le nœud finalement"
                          style={{ fontSize: 11, color: "#999", background: "#f0f0f0", border: "none", padding: "2px 8px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          Ignoré
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

