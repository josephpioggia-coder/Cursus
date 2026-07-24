/**
 * ATELIER D'ÉCRIVAIN — Module 2 : Éditeur
 *
 * Dépendances à installer :
 *   npm install @tiptap/react @tiptap/pm @tiptap/starter-kit
 *               @tiptap/extension-typography @tiptap/extension-placeholder
 *               @tiptap/extension-character-count @tiptap/extension-underline
 *               @tiptap/extension-text-align @tiptap/extension-highlight
 *               @tiptap/extension-footnotes
 *
 * Fonctionnalités :
 *   - Éditeur riche TipTap (gras, italique, titres, listes, citations, notes)
 *   - Mode focus (plein écran, tout masqué sauf le texte)
 *   - Mode structure (sidebar arborescence visible)
 *   - Triple objectif : journalier / session (minuterie) / chapitre
 *   - Sauvegarde automatique toutes les 30s + indicateur d'état
 *   - Historique de versions PERMANENT et daté, par nœud (voir MODIF 21/07)
 *   - Statistiques de session : mots, durée, rythme
 *
 * Correctif 16/07/2026 : ajout de minHeight:0 sur les conteneurs flex
 * imbriqués (Zone centrale + Zone d'écriture) — sans ça, un texte long
 * fait grandir l'éditeur au-delà de sa cellule de grille, et c'est toute
 * la page qui se met à défiler au lieu du texte seul, entraînant le
 * panneau Co-pilote IA avec elle (symptôme observé : les deux panneaux
 * semblent défiler ensemble).
 *
 * MODIF 21/07/2026 — Historique de versions permanent : l'historique
 * n'était auparavant stocké que dans un useState local, perdu à chaque
 * rechargement de page ou changement de chapitre. Il est désormais lu et
 * écrit dans la table Supabase `versions_noeuds` (créée le 21/07/2026).
 * Effet de bord bénéfique : ça corrige aussi une fuite silencieuse où
 * l'historique d'un chapitre pouvait rester affiché en ouvrant un autre
 * chapitre, faute de réinitialisation explicite au changement de nœud.
 */

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Typography from "@tiptap/extension-typography";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import { journaliserErreur } from "../lib/journalErreurs.js";

// ─── Utilitaires ────────────────────────────────────────────────────────────────

const compterMots = (html = "") => {
  const texte = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return texte === "" ? 0 : texte.split(" ").length;
};

const formaterDurée = (secondes) => {
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = secondes % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}min`;
  if (m > 0) return `${m}min ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
};

// Formate un horodatage de version : juste l'heure si c'est aujourd'hui,
// jour/mois + heure sinon — utile maintenant que l'historique est permanent
// et peut donc contenir des versions vieilles de plusieurs jours, pas
// seulement de la session en cours. Ajouté 21/07/2026, remplace l'ancienne
// fonction horodatage() qui ne gérait que "maintenant".
const formaterDateHeure = (isoString) => {
  const d = new Date(isoString);
  const heure = d.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
  const estAujourdHui = d.toDateString() === new Date().toDateString();
  if (estAujourdHui) return heure;
  const jourMois = d.toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit" });
  return `${jourMois} ${heure}`;
};

// Calcule les numéros de LIGNE VISUELLES réelles (pas de paragraphe) —
// ajouté 24/07/2026. Pour chaque bloc de texte (paragraphe, titre,
// citation, item de liste…), mesure les rectangles de rendu réels du
// navigateur (Range.getClientRects()) pour retrouver où le texte revient
// effectivement à la ligne selon la largeur actuelle de la fenêtre — pas
// une approximation, la vraie disposition affichée à l'écran. Recalculé à
// chaque modification du texte et à chaque redimensionnement de fenêtre.
// `topWrapper` est la position de référence (le conteneur qui porte la
// numérotation), pour que chaque numéro soit positionné en absolu par
// rapport à lui, indépendamment du défilement de la page.
const BLOCS_DE_LIGNE = new Set(["P", "H1", "H2", "H3", "BLOCKQUOTE", "LI", "PRE"]);

// Formats de référence pour la largeur de colonne — mêmes dimensions que
// l'export Word (voir FORMATS_PAGE dans exportWord.js), converties en
// pixels (1 DXA = 1/1440 pouce = 96/1440 px). Dupliqué ici plutôt
// qu'importé pour ne pas faire dépendre l'éditeur de la librairie docx à
// chaque frappe. Ajouté 24/07/2026 : sans largeur FIXE liée à un vrai
// format cible, les numéros de ligne n'ont aucune valeur de référence
// stable — ils changeraient à chaque redimensionnement de la fenêtre.
const FORMATS_RÉFÉRENCE = {
  a4:     { label: "A4",               largeurPx: 602 },
  a5:     { label: "A5",               largeurPx: 446 },
  poche:  { label: "Poche",            largeurPx: 333 },
  broche: { label: "Broché (6×9)",     largeurPx: 432 },
};

function calculerNumérosDeLigne(éditeurDOM, topWrapper) {
  if (!éditeurDOM) return [];
  const lignes = [];

  const marcher = (élément) => {
    if (BLOCS_DE_LIGNE.has(élément.tagName)) {
      const range = document.createRange();
      range.selectNodeContents(élément);
      const rects = Array.from(range.getClientRects());
      let tops;
      if (rects.length === 0) {
        // Paragraphe vide : une seule "ligne" à la position du bloc lui-même.
        tops = [élément.getBoundingClientRect().top];
      } else {
        tops = [...new Set(rects.map((r) => Math.round(r.top)))].sort((a, b) => a - b);
      }
      tops.forEach((top) => lignes.push(top - topWrapper));
    } else if (élément.children?.length) {
      Array.from(élément.children).forEach(marcher);
    }
  };

  Array.from(éditeurDOM.children).forEach(marcher);
  return lignes.map((top, i) => ({ numéro: i + 1, top }));
}

// ─── Styles globaux de l'éditeur (injectés une seule fois) ─────────────────────

const STYLES_EDITEUR = `
  .ProseMirror {
    outline: none;
    min-height: 400px;
    font-size: 16px;
    line-height: 1.8;
    color: var(--editeur-texte, #1a1a1a);
    font-family: 'Georgia', 'Times New Roman', serif;
    caret-color: #7F77DD;
  }
  .ProseMirror p { margin: 0 0 1em; }
  .ProseMirror h1 { font-size: 1.6em; font-weight: 500; margin: 1.4em 0 0.5em; line-height: 1.3; }
  .ProseMirror h2 { font-size: 1.3em; font-weight: 500; margin: 1.2em 0 0.4em; line-height: 1.3; }
  .ProseMirror h3 { font-size: 1.1em; font-weight: 500; margin: 1em 0 0.3em; line-height: 1.3; }
  .ProseMirror blockquote {
    border-left: 3px solid #7F77DD;
    margin: 1.2em 0;
    padding: 0.5em 0 0.5em 1.2em;
    color: #555;
    font-style: italic;
  }
  .ProseMirror ul, .ProseMirror ol { padding-left: 1.5em; margin: 0.8em 0; }
  .ProseMirror li { margin-bottom: 0.3em; }
  .ProseMirror code {
    background: #f0eefd;
    color: #534AB7;
    padding: 2px 5px;
    border-radius: 4px;
    font-size: 0.9em;
  }
  .ProseMirror pre {
    background: #f5f5f5;
    padding: 1em;
    border-radius: 8px;
    overflow-x: auto;
  }
  .ProseMirror mark { background: #faeeda; border-radius: 2px; padding: 0 2px; }
  .ProseMirror hr { border: none; border-top: 1px solid #e5e5e5; margin: 2em 0; }
  .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: #bbb;
    pointer-events: none;
    float: left;
    height: 0;
  }
  /* Mode focus */
  .mode-focus .ProseMirror {
    font-size: 18px;
    line-height: 2;
  }
`;

// ─── Composant : Bouton de barre d'outils ────────────────────────────────────────

function BoutonOutil({ actif, désactivé, onClick, titre, children }) {
  return (
    <button
      onClick={onClick}
      disabled={désactivé}
      title={titre}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 28, height: 28, borderRadius: 6,
        border: "none", cursor: désactivé ? "default" : "pointer",
        background: actif ? "#EEEDFE" : "transparent",
        color: actif ? "#534AB7" : désactivé ? "#ccc" : "#555",
        fontSize: 13, fontWeight: actif ? 600 : 400,
        fontFamily: "inherit", transition: "all 0.1s",
      }}
      onMouseEnter={(e) => { if (!actif && !désactivé) e.target.style.background = "#f5f5f5"; }}
      onMouseLeave={(e) => { if (!actif) e.target.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

// ─── Composant : Barre d'outils ──────────────────────────────────────────────────

function BarreOutils({ editor, modeFocus, onToggleFocus }) {
  if (!editor) return null;

  const Sep = () => (
    <div style={{ width: 0.5, height: 18, background: "#e5e5e5", margin: "0 4px" }} />
  );

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 2,
      padding: "6px 16px",
      borderBottom: "0.5px solid #e5e5e5",
      background: "#fafafa",
      flexWrap: "wrap",
      transition: "opacity 0.3s",
      opacity: modeFocus ? 0.3 : 1,
    }}
      onMouseEnter={(e) => { if (modeFocus) e.currentTarget.style.opacity = 1; }}
      onMouseLeave={(e) => { if (modeFocus) e.currentTarget.style.opacity = 0.3; }}
    >
      {/* Titres */}
      <BoutonOutil actif={editor.isActive("heading", { level: 1 })} titre="Titre 1"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</BoutonOutil>
      <BoutonOutil actif={editor.isActive("heading", { level: 2 })} titre="Titre 2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</BoutonOutil>
      <BoutonOutil actif={editor.isActive("heading", { level: 3 })} titre="Titre 3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</BoutonOutil>

      <Sep />

      {/* Formatage inline */}
      <BoutonOutil actif={editor.isActive("bold")} titre="Gras (Ctrl+B)"
        onClick={() => editor.chain().focus().toggleBold().run()}><b>G</b></BoutonOutil>
      <BoutonOutil actif={editor.isActive("italic")} titre="Italique (Ctrl+I)"
        onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></BoutonOutil>
      <BoutonOutil actif={editor.isActive("underline")} titre="Souligné (Ctrl+U)"
        onClick={() => editor.chain().focus().toggleUnderline().run()}><u>S</u></BoutonOutil>
      <BoutonOutil actif={editor.isActive("highlight")} titre="Surligner"
        onClick={() => editor.chain().focus().toggleHighlight().run()}>✦</BoutonOutil>

      <Sep />

      {/* Listes */}
      <BoutonOutil actif={editor.isActive("bulletList")} titre="Liste à puces"
        onClick={() => editor.chain().focus().toggleBulletList().run()}>≡</BoutonOutil>
      <BoutonOutil actif={editor.isActive("orderedList")} titre="Liste numérotée"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</BoutonOutil>

      <Sep />

      {/* Blocs */}
      <BoutonOutil actif={editor.isActive("blockquote")} titre="Citation"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</BoutonOutil>
      <BoutonOutil actif={editor.isActive("code")} titre="Code inline"
        onClick={() => editor.chain().focus().toggleCode().run()}>{"`"}</BoutonOutil>
      <BoutonOutil actif={false} titre="Séparateur horizontal"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}>—</BoutonOutil>

      <Sep />

      {/* Historique */}
      <BoutonOutil actif={false} titre="Annuler (Ctrl+Z)"
        désactivé={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}>↩</BoutonOutil>
      <BoutonOutil actif={false} titre="Rétablir (Ctrl+Y)"
        désactivé={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}>↪</BoutonOutil>

      <div style={{ flex: 1 }} />

      {/* Mode focus */}
      <BoutonOutil actif={modeFocus} titre={modeFocus ? "Quitter le mode focus" : "Mode focus (F11)"}
        onClick={onToggleFocus}>
        {modeFocus ? "⊡" : "⊞"}
      </BoutonOutil>
    </div>
  );
}

// ─── Composant : Panneau objectifs ───────────────────────────────────────────────

function PanneauObjectifs({ motsSession, motsChapitre, objectifJournalier, objectifChapitre, durée, couleur, onMàjObjectifs }) {
  const [édition, setÉdition] = useState(false);
  const [tempJ, setTempJ] = useState(objectifJournalier);
  const [tempC, setTempC] = useState(objectifChapitre);

  const rythme = durée > 60 ? Math.round((motsSession / (durée / 3600))) : null;
  const pctJour = Math.min(100, Math.round((motsSession / objectifJournalier) * 100));
  const pctChapitre = objectifChapitre > 0
    ? Math.min(100, Math.round((motsChapitre / objectifChapitre) * 100))
    : null;

  return (
    <div style={{
      borderTop: "0.5px solid #e5e5e5",
      padding: "8px 20px",
      background: "#fafafa",
      display: "flex", alignItems: "center", gap: 20,
      fontSize: 12,
    }}>
      {/* Session */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 120 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#999" }}>Session</span>
          <span style={{ color: couleur, fontWeight: 500 }}>{motsSession} / {objectifJournalier} mots</span>
        </div>
        <div style={{ height: 3, background: "#e5e5e5", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${pctJour}%`, height: "100%", background: couleur, borderRadius: 4, transition: "width 0.5s" }} />
        </div>
      </div>

      {/* Chapitre */}
      {pctChapitre !== null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 120 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#999" }}>Chapitre</span>
            <span style={{ color: "#1D9E75", fontWeight: 500 }}>{motsChapitre} / {objectifChapitre}</span>
          </div>
          <div style={{ height: 3, background: "#e5e5e5", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${pctChapitre}%`, height: "100%", background: "#1D9E75", borderRadius: 4 }} />
          </div>
        </div>
      )}

      {/* Durée + rythme */}
      <div style={{ color: "#999" }}>
        ⏱ {formaterDurée(durée)}
        {rythme && <span style={{ marginLeft: 8, color: "#bbb" }}>· {rythme.toLocaleString("fr-FR")} mots/h</span>}
      </div>

      <div style={{ flex: 1 }} />

      {/* Édition objectifs */}
      {édition ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ color: "#999" }}>Jour :</label>
          <input type="number" value={tempJ} onChange={(e) => setTempJ(+e.target.value)}
            style={{ width: 64, padding: "2px 6px", border: "0.5px solid #e5e5e5", borderRadius: 6, fontSize: 12, fontFamily: "inherit" }} />
          <label style={{ color: "#999" }}>Chapitre :</label>
          <input type="number" value={tempC} onChange={(e) => setTempC(+e.target.value)}
            style={{ width: 64, padding: "2px 6px", border: "0.5px solid #e5e5e5", borderRadius: 6, fontSize: 12, fontFamily: "inherit" }} />
          <button onClick={() => { onMàjObjectifs(tempJ, tempC); setÉdition(false); }}
            style={{ fontSize: 11, color: "#fff", background: couleur, border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>
            OK
          </button>
        </div>
      ) : (
        <button onClick={() => setÉdition(true)}
          style={{ fontSize: 11, color: "#999", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          ⚙ Objectifs
        </button>
      )}
    </div>
  );
}

// ─── Composant : Panneau historique ──────────────────────────────────────────────
// MODIF 21/07/2026 : "Historique de session" renommé "Historique des versions" —
// ce n'est plus limité à la session en cours, c'est désormais permanent.

function PanneauHistorique({ historique, chargement, onRestaurer, onFermer, couleur }) {
  return (
    <div style={{
      width: 260, borderLeft: "0.5px solid #e5e5e5",
      display: "flex", flexDirection: "column",
      background: "#fafafa", overflowY: "auto",
    }}>
      <div style={{
        padding: "12px 14px", borderBottom: "0.5px solid #e5e5e5",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "#555" }}>Historique des versions</span>
        <button onClick={onFermer} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#999" }}>×</button>
      </div>
      {chargement ? (
        <div style={{ padding: "20px 14px", color: "#bbb", fontSize: 12, textAlign: "center" }}>
          Chargement…
        </div>
      ) : historique.length === 0 ? (
        <div style={{ padding: "20px 14px", color: "#bbb", fontSize: 12, textAlign: "center" }}>
          Les versions apparaîtront ici au fil de l'écriture.
        </div>
      ) : (
        <div style={{ padding: "8px" }}>
          {historique.map((v) => (
            <div key={v.id} style={{
              padding: "8px 10px", borderRadius: 8, marginBottom: 4,
              border: "0.5px solid #e5e5e5", background: "#fff",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "#999" }}>{v.horodatage}</span>
                <span style={{ fontSize: 11, color: couleur }}>{v.mots} mots</span>
              </div>
              <div style={{ fontSize: 11, color: "#777", marginBottom: 6, lineHeight: 1.4 }}>
                {v.aperçu}
              </div>
              <button onClick={() => onRestaurer(v.contenu)}
                style={{
                  fontSize: 11, color: couleur, background: `${couleur}15`,
                  border: "none", borderRadius: 6, padding: "3px 8px",
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                Restaurer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Composant : Indicateur de sauvegarde ────────────────────────────────────────

function IndicateurSauvegarde({ état }) {
  const configs = {
    sauvegardé: { couleur: "#1D9E75", label: "Sauvegardé", icone: "✓" },
    en_cours: { couleur: "#BA7517", label: "Modification…", icone: "●" },
    erreur: { couleur: "#E24B4A", label: "Erreur", icone: "✕" },
  };
  const c = configs[état] || configs.sauvegardé;
  return (
    <span style={{ fontSize: 11, color: c.couleur, display: "flex", alignItems: "center", gap: 4 }}>
      {c.icone} {c.label}
    </span>
  );
}

// ─── Composant principal : Éditeur ───────────────────────────────────────────────

export default function Editeur({
  nœud,                    // { id, titre, type, texte } — nœud actif
  projetCouleur = "#7F77DD",
  projetTitre = "",
  onSauvegarder,           // (nœudId, htmlContenu) => void — écrit en base, différé 2s
  onTexteChange,           // (nœudId, htmlContenu) => void — état local uniquement,
                           // immédiat, pour que le co-pilote IA voie le texte à jour
                           // sans attendre la sauvegarde différée. Correctif 16/07/2026 :
                           // avant, un texte tout juste collé pouvait déclencher à tort
                           // "Écrivez au moins 20 mots" si on cliquait "Analyser" avant
                           // la fin du délai de 2s de la sauvegarde.
  onSelectionChange,       // (texteSélectionné: string) => void — transmet la sélection
                           // de texte en cours dans l'éditeur, pour que le co-pilote IA
                           // puisse analyser uniquement le passage surligné plutôt que
                           // tout le chapitre. Ajouté le 16/07/2026.
  onRetour,                // () => void
}) {
  const [modeFocus, setModeFocus] = useState(false);
  const [formatRéférence, setFormatRéférence] = useState("a4");
  const [voirHistorique, setVoirHistorique] = useState(false);
  const [texteCopié, setTexteCopié] = useState(false);
  const [historique, setHistorique] = useState([]);
  const [chargementHistorique, setChargementHistorique] = useState(false);
  const [statutSauvegarde, setStatutSauvegarde] = useState("sauvegardé");
  const [objectifJournalier, setObjectifJournalier] = useState(500);
  const [objectifChapitre, setObjectifChapitre] = useState(0);
  const [motsSession, setMotsSession] = useState(0);
  const [duréeSession, setDuréeSession] = useState(0);
  const motsInitiaux = useRef(compterMots(nœud?.texte || ""));
  const timerSauvegarde = useRef(null);
  const timerSession = useRef(null);
  const contenuRef = useRef(nœud?.texte || "");
  // Mots du dernier instantané connu pour CE nœud — sert à décider si un
  // nouvel instantané mérite d'être créé (seuil de 50 mots de différence).
  // Utilise une ref (pas un state) pour rester lisible de façon synchrone
  // dans le callback différé de sauvegarde, sans dépendre d'une closure
  // React potentiellement obsolète. Ajouté 21/07/2026.
  const dernierMotsHistoriqueRef = useRef(null);
  // Numéros de ligne — ajouté 24/07/2026.
  const wrapperLigneRef = useRef(null);
  const [numérosDeLigne, setNumérosDeLigne] = useState([]);

  // Injecter les styles TipTap une seule fois
  useEffect(() => {
    if (!document.getElementById("atelier-editeur-styles")) {
      const style = document.createElement("style");
      style.id = "atelier-editeur-styles";
      style.textContent = STYLES_EDITEUR;
      document.head.appendChild(style);
    }
  }, []);

  // Chronomètre de session
  useEffect(() => {
    timerSession.current = setInterval(() => {
      setDuréeSession((d) => d + 1);
    }, 1000);
    return () => clearInterval(timerSession.current);
  }, []);

  // Raccourci clavier F11 pour mode focus
  useEffect(() => {
    const handler = (e) => { if (e.key === "F11") { e.preventDefault(); setModeFocus((f) => !f); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Charge l'historique de versions DEPUIS SUPABASE pour le nœud ouvert, et
  // le recharge intégralement à chaque changement de chapitre — ce qui
  // corrige au passage l'ancienne fuite où l'historique d'un chapitre
  // précédent pouvait rester affiché en ouvrant un nouveau chapitre.
  // Ajouté 21/07/2026 (remplace le useState local, perdu au rechargement).
  useEffect(() => {
    let annulé = false;
    setHistorique([]);
    dernierMotsHistoriqueRef.current = null;
    if (!nœud?.id) return;

    setChargementHistorique(true);
    supabase
      .from("versions_noeuds")
      .select("id, contenu, mots, apercu, created_at")
      .eq("noeud_id", nœud.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (annulé) return;
        setChargementHistorique(false);
        if (error) {
          journaliserErreur("Editeur:chargerHistorique", error.message, nœud.id);
          return;
        }
        const versions = (data || []).map((v) => ({
          id: v.id,
          contenu: v.contenu,
          mots: v.mots,
          aperçu: v.apercu,
          horodatage: formaterDateHeure(v.created_at),
        }));
        setHistorique(versions);
        dernierMotsHistoriqueRef.current = versions.length > 0 ? versions[0].mots : null;
      });

    return () => { annulé = true; };
  }, [nœud?.id]);

  // Initialisation de l'éditeur TipTap
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: { depth: 100 } }),
      Typography,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: false }),
      CharacterCount,
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "Titre du chapitre…";
          return "Commencez à écrire ici… (F11 pour le mode focus)";
        },
      }),
    ],
    content: nœud?.texte || "",
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from === to) {
        onSelectionChange?.("");
      } else {
        const texte = editor.state.doc.textBetween(from, to, " ");
        onSelectionChange?.(texte);
      }
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      contenuRef.current = html;

      // Transmission immédiate au parent (état local, pas d'écriture en base) —
      // pour que le co-pilote IA voie toujours le texte réel de l'éditeur,
      // sans attendre les 2s de la sauvegarde différée ci-dessous.
      onTexteChange?.(nœud.id, html);

      // Mise à jour du compteur de mots de session
      const motsTotaux = compterMots(html);
      setMotsSession(Math.max(0, motsTotaux - motsInitiaux.current));

      // Indicateur "modification en cours"
      setStatutSauvegarde("en_cours");

      // Sauvegarde différée (debounce 2s)
      clearTimeout(timerSauvegarde.current);
      timerSauvegarde.current = setTimeout(async () => {
        onSauvegarder?.(nœud.id, html);
        setStatutSauvegarde("sauvegardé");

        // Instantané d'historique — MODIF 21/07/2026 : écrit désormais dans
        // Supabase (table versions_noeuds) au lieu d'un simple état local.
        // Seuil de 50 mots de différence conservé (évite de créer un
        // instantané à chaque frappe), mais plus de plafond arbitraire à
        // 20 versions : l'historique est désormais permanent, comme
        // demandé.
        const motsCourants = compterMots(html);
        const dernierConnu = dernierMotsHistoriqueRef.current;
        const diffMots = dernierConnu === null ? motsCourants : Math.abs(motsCourants - dernierConnu);
        if (diffMots < 50 && dernierConnu !== null) return;

        const apercu = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) + "…";
        const { data, error } = await supabase
          .from("versions_noeuds")
          .insert({ noeud_id: nœud.id, contenu: html, mots: motsCourants, apercu })
          .select()
          .single();

        if (error) {
          journaliserErreur("Editeur:snapshotHistorique", error.message, nœud.id);
          return; // le texte est déjà sauvegardé (onSauvegarder ci-dessus) ; seul l'instantané a échoué
        }

        dernierMotsHistoriqueRef.current = motsCourants;
        setHistorique((prev) => [{
          id: data.id,
          contenu: data.contenu,
          mots: data.mots,
          aperçu: data.apercu,
          horodatage: formaterDateHeure(data.created_at),
        }, ...prev]);
      }, 2000);
    },
  });

  // Sauvegarde automatique forcée toutes les 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (contenuRef.current && editor) {
        onSauvegarder?.(nœud?.id, contenuRef.current);
        setStatutSauvegarde("sauvegardé");
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [editor, nœud?.id, onSauvegarder]);

  // Réinitialise la sélection transmise au co-pilote quand on change de
  // chapitre — sinon une sélection faite dans un chapitre précédent resterait
  // affichée comme active dans le nouveau, à tort.
  useEffect(() => {
    onSelectionChange?.("");
    return () => onSelectionChange?.("");
  }, [nœud?.id]);

  const motsChapitre = editor ? compterMots(editor.getHTML()) : 0;

  // Recalcule les numéros de ligne — sur chaque modification du texte, à
  // chaque redimensionnement de fenêtre (le retour à la ligne automatique
  // change avec la largeur disponible), et au changement de mode focus
  // (la taille de police change). Ajouté 24/07/2026.
  const recalculerNumérosDeLigne = useCallback(() => {
    if (!editor || !wrapperLigneRef.current) return;
    const topWrapper = wrapperLigneRef.current.getBoundingClientRect().top;
    setNumérosDeLigne(calculerNumérosDeLigne(editor.view.dom, topWrapper));
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    recalculerNumérosDeLigne();
    editor.on("update", recalculerNumérosDeLigne);
    return () => editor.off("update", recalculerNumérosDeLigne);
  }, [editor, recalculerNumérosDeLigne]);

  useEffect(() => {
    let timer;
    const surRedimensionnement = () => {
      clearTimeout(timer);
      timer = setTimeout(recalculerNumérosDeLigne, 150);
    };
    window.addEventListener("resize", surRedimensionnement);
    return () => { window.removeEventListener("resize", surRedimensionnement); clearTimeout(timer); };
  }, [recalculerNumérosDeLigne]);

  useEffect(() => {
    const timer = setTimeout(recalculerNumérosDeLigne, 60);
    return () => clearTimeout(timer);
  }, [modeFocus, formatRéférence, recalculerNumérosDeLigne]);

  const restaurerVersion = useCallback((contenu) => {
    editor?.commands.setContent(contenu);
    setVoirHistorique(false);
  }, [editor]);

  if (!nœud) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#bbb", fontSize: 14 }}>
      Sélectionnez un chapitre ou une scène dans la structure pour commencer à écrire.
    </div>
  );

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%", minHeight: 0,
      background: modeFocus ? "#f7f6f1" : "#fff",
      transition: "background 0.4s",
    }}
      className={modeFocus ? "mode-focus" : ""}
    >
      {/* ── En-tête ── */}
      {!modeFocus && (
        <div style={{
          padding: "10px 20px", borderBottom: "0.5px solid #e5e5e5",
          display: "flex", alignItems: "center", gap: 10,
          background: "#fafafa",
          flexShrink: 0,
        }}>
          <button onClick={onRetour}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#999", fontFamily: "inherit" }}
            title="Retour à la structure">←</button>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: projetCouleur }} />
          <span style={{ fontSize: 13, color: "#999" }}>{projetTitre}</span>
          <span style={{ fontSize: 13, color: "#ccc" }}>›</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>{nœud.titre}</span>
          <div style={{ flex: 1 }} />
          <IndicateurSauvegarde état={statutSauvegarde} />
          <select
            value={formatRéférence}
            onChange={(e) => setFormatRéférence(e.target.value)}
            title="Format de référence pour la largeur de colonne et les numéros de ligne — les numéros restent stables tant que ce choix ne change pas"
            style={{ fontSize: 11, color: "#777", border: "0.5px solid #ddd", borderRadius: 6, padding: "3px 6px", fontFamily: "inherit", background: "#fff", cursor: "pointer" }}
          >
            {Object.entries(FORMATS_RÉFÉRENCE).map(([clé, f]) => (
              <option key={clé} value={clé}>{f.label}</option>
            ))}
          </select>
          <button
            onClick={() => {
              const texte = editor?.getText() || "";
              navigator.clipboard?.writeText(texte);
              setTexteCopié(true);
              setTimeout(() => setTexteCopié(false), 2000);
            }}
            style={{
              fontSize: 12, color: texteCopié ? "#1D9E75" : "#999",
              background: texteCopié ? "#E1F5EE" : "none",
              border: "none", cursor: "pointer", borderRadius: 6,
              padding: "4px 8px", fontFamily: "inherit",
            }}
            title="Copier tout le texte du chapitre"
          >
            {texteCopié ? "✓ Copié !" : "📋 Copier tout"}
          </button>
          <button
            onClick={() => setVoirHistorique(!voirHistorique)}
            style={{
              fontSize: 12, color: voirHistorique ? projetCouleur : "#999",
              background: voirHistorique ? `${projetCouleur}15` : "none",
              border: "none", cursor: "pointer", borderRadius: 6,
              padding: "4px 8px", fontFamily: "inherit",
            }}
            title="Historique de versions"
          >
            ↺ Historique ({historique.length})
          </button>
        </div>
      )}

      {/* ── Barre d'outils ── */}
      <BarreOutils editor={editor} modeFocus={modeFocus} onToggleFocus={() => setModeFocus(!modeFocus)} />

      {/* ── Zone centrale : éditeur + historique ── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>

        {/* Zone d'écriture */}
        <div style={{
          flex: 1, minHeight: 0, minWidth: 0, overflowY: "auto",
          padding: modeFocus ? "60px 0" : "32px 0",
          display: "flex", justifyContent: "center",
        }}>
          <div style={{
            width: "100%",
            maxWidth: FORMATS_RÉFÉRENCE[formatRéférence].largeurPx,
            padding: "0 40px",
          }}>
            {/* Titre du chapitre en mode focus */}
            {modeFocus && (
              <div style={{
                fontSize: 11, fontWeight: 500, color: `${projetCouleur}99`,
                letterSpacing: "0.07em", textTransform: "uppercase",
                marginBottom: 12,
              }}>
                {projetTitre} · {nœud.titre}
              </div>
            )}

            {/* Numéros de ligne + éditeur — la gouttière est un élément
                totalement séparé du contenu éditable de ProseMirror : elle
                ne peut donc jamais se retrouver dans editor.getText() ni
                dans une sélection/copie faite dans le texte. */}
            <div ref={wrapperLigneRef} style={{ position: "relative" }}>
              <div style={{
                position: "absolute", left: -34, top: 0, width: 28,
                textAlign: "right", userSelect: "none", pointerEvents: "none",
              }}>
                {numérosDeLigne.map((l) => (
                  <div key={l.numéro} style={{
                    position: "absolute", top: l.top, right: 0,
                    fontSize: 11, color: "#ccc", fontFamily: "Georgia, serif",
                  }}>
                    {l.numéro}
                  </div>
                ))}
              </div>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* Panneau historique */}
        {voirHistorique && !modeFocus && (
          <PanneauHistorique
            historique={historique}
            chargement={chargementHistorique}
            onRestaurer={restaurerVersion}
            onFermer={() => setVoirHistorique(false)}
            couleur={projetCouleur}
          />
        )}
      </div>

      {/* ── Barre objectifs / stats ── */}
      <PanneauObjectifs
        motsSession={motsSession}
        motsChapitre={motsChapitre}
        objectifJournalier={objectifJournalier}
        objectifChapitre={objectifChapitre}
        durée={duréeSession}
        couleur={projetCouleur}
        onMàjObjectifs={(j, c) => { setObjectifJournalier(j); setObjectifChapitre(c); }}
      />
    </div>
  );
}
