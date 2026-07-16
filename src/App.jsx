/**
 * CURSUS — App.jsx (version Supabase)
 *
 * État global branché sur Supabase via src/lib/api.js
 * Authentification via src/lib/auth.jsx
 * Le localStorage n'est plus utilisé.
 *
 * Version i18n (chantier 04/07/2026) :
 * - Tous les textes d'interface statiques passent par t('common.xxx') / useTranslation
 * - GENRES et STATUTS restent en français (valeurs canoniques internes,
 *   voir note de fin de fichier)
 * - langueProjet propagée depuis projetActif.langue vers CopiloteIA et
 *   QuestionnaireIntention (colonne `langue` sur `projets`, défaut 'fr' —
 *   à confirmer que la migration existe déjà, sinon fallback sur 'fr' suffit)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth, PageConnexion } from "./lib/auth.jsx";
import { projetsAPI, nœudsAPI } from "./lib/api.js";
import { supabase } from "./lib/supabase.js";
import { journaliserErreur } from "./lib/journalErreurs.js";
import Editeur from "./components/Editeur.jsx";
import TableauDeBord from "./components/TableauDeBord.jsx";
import Bibliotheque from "./components/Bibliotheque.jsx";
import CarnetIdees from "./components/CarnetIdees.jsx";
import CopiloteIA from "./components/CopiloteIA.jsx";
import ImportDocx from "./components/ImportDocx.jsx";
import Tarification from "./components/Tarification.jsx";
import QuestionnaireIntention from "./components/QuestionnaireIntention.jsx";
import AideFAQ from "./components/AideFAQ.jsx";

// ─── Constantes ────────────────────────────────────────────────────────────────
// Valeurs canoniques internes — NE PAS traduire ici (voir note de fin de fichier).
// Genres + couleurs associées — proposition Joseph du 05/07/2026.
// "Autre" ajouté par Claude (hors liste initiale) pour couvrir les cas
// qui ne rentrent dans aucune des 10 catégories — gris neutre par défaut.
// "Spiritualité" : deux couleurs proposées (blanc cassé / indigo) ; indigo
// retenu car un blanc cassé serait quasi invisible en pastille/badge. À
// confirmer avec Joseph si besoin.
const GENRE_COULEURS = {
  "Méthode":                        "#378ADD", // bleu — rigueur, structure, confiance
  "Psychologie / Thérapie":         "#7A9B76", // vert sauge — croissance, équilibre, soin
  "Philosophie":                    "#7F77DD", // violet — réflexion, profondeur
  "Recherche / Sciences humaines":  "#3F4650", // gris anthracite — neutralité, sérieux
  "Comparaison / Intégration":      "#D85A30", // orange — mise en relation, créativité
  "Développement personnel":        "#BA7517", // ocre / jaune doré — évolution personnelle
  "Spiritualité":                   "#4A4E9E", // indigo — intériorité, transcendance
  "Roman / Témoignage":             "#8B2635", // bordeaux — émotion, vécu
  "Guide pratique":                 "#0FA3A3", // turquoise — accessibilité, action
  "Formation / Pédagogie":          "#5AAEDB", // bleu clair — apprentissage
  "Autre":                          "#8A8A8A", // gris neutre — ajout Claude, hors liste initiale
};
const GENRES = Object.keys(GENRE_COULEURS);
const STATUTS = ["En cours", "En pause", "Terminé", "Idée"];
const COULEURS = Object.values(GENRE_COULEURS);

const STRUCTURE_TYPES_META = {
  partie: { enfant: "chapitre", icone: "📂" },
  chapitre: { enfant: "scene", icone: "📄" },
  scene: { enfant: null, icone: "✏️" },
};

// ─── Utilitaires ────────────────────────────────────────────────────────────────

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const dateAujourd = (langue = "fr") => new Date().toLocaleDateString(langue === "en" ? "en-GB" : "fr-BE", {
  day: "numeric", month: "long", year: "numeric",
});

const compterMots = (texte = "") =>
  texte.trim() === "" ? 0 : texte.trim().split(/\s+/).length;

const totalMotsProjet = (nœuds = []) => {
  let total = 0;
  const parcourir = (liste) => {
    for (const n of liste) {
      total += compterMots(n.texte);
      if (n.enfants?.length) parcourir(n.enfants);
    }
  };
  parcourir(nœuds);
  return total;
};

// ─── Composant : Badge statut ────────────────────────────────────────────────────
// Le libellé affiché (statut) reste la valeur canonique française pour l'instant
// (voir note de fin de fichier) ; seul le style est géré ici.

function BadgeStatut({ statut }) {
  const styles = {
    "En cours":  { bg: "#EEEDFE", color: "#534AB7" },
    "En pause":  { bg: "#FAEEDA", color: "#854F0B" },
    "Terminé":   { bg: "#EAF3DE", color: "#3B6D11" },
    "Idée":      { bg: "#F1EFE8", color: "#5F5E5A" },
  };
  const s = styles[statut] || styles["Idée"];
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 500,
      padding: "2px 8px", borderRadius: 20,
    }}>
      {statut}
    </span>
  );
}

// ─── Composant : Barre de progression ───────────────────────────────────────────

function BarreProgression({ valeur, max, couleur }) {
  const pct = Math.min(100, Math.round((valeur / (max || 1)) * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        flex: 1, height: 4,
        background: "var(--border)", borderRadius: 4, overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: couleur, borderRadius: 4,
          transition: "width 0.4s ease",
        }} />
      </div>
      <span style={{ fontSize: 11, color: "var(--texte-tertiaire)", minWidth: 28, textAlign: "right" }}>
        {pct}%
      </span>
    </div>
  );
}

// ─── Composant : Nœud de structure (récursif) ────────────────────────────────────

function NœudStructure({ nœud, profondeur = 0, projetCouleur, sélectionné, onSélectionner, onAjouter, onRenommer, onSupprimer }) {
  const { t } = useTranslation("common");
  const [ouvert, setOuvert] = useState(true);
  const [enRenommage, setEnRenommage] = useState(false);
  const [nomTemp, setNomTemp] = useState(nœud.titre);
  const [survol, setSurvol] = useState(false);

  const aDesEnfants = nœud.enfants?.length > 0;
  const typeInfo = STRUCTURE_TYPES_META[nœud.type];
  const peutAjouter = typeInfo.enfant !== null;
  const labelType = t(`structureTypes.${nœud.type}`);
  const labelEnfant = typeInfo.enfant ? t(`structureTypes.${typeInfo.enfant}`) : "";

  const validerRenommage = () => {
    if (nomTemp.trim()) onRenommer(nœud.id, nomTemp.trim());
    setEnRenommage(false);
  };

  return (
    <div style={{ marginLeft: profondeur * 16 }}>
      <div
        onMouseEnter={() => setSurvol(true)}
        onMouseLeave={() => setSurvol(false)}
        onClick={() => onSélectionner(nœud.id)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 8px", borderRadius: 6, cursor: "pointer",
          background: sélectionné === nœud.id
            ? `${projetCouleur}18`
            : survol ? "var(--surface-hover)" : "transparent",
          borderLeft: sélectionné === nœud.id
            ? `2px solid ${projetCouleur}`
            : "2px solid transparent",
          transition: "all 0.15s",
        }}
      >
        {/* Chevron */}
        {aDesEnfants ? (
          <span
            onClick={(e) => { e.stopPropagation(); setOuvert(!ouvert); }}
            style={{
              fontSize: 10, color: "var(--texte-tertiaire)",
              transform: ouvert ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s", userSelect: "none", width: 12,
            }}
          >▶</span>
        ) : <span style={{ width: 12 }} />}

        {/* Icône type */}
        <span style={{ fontSize: 13 }}>{typeInfo.icone}</span>

        {/* Titre ou champ renommage */}
        {enRenommage ? (
          <input
            autoFocus
            value={nomTemp}
            onChange={(e) => setNomTemp(e.target.value)}
            onBlur={validerRenommage}
            onKeyDown={(e) => { if (e.key === "Enter") validerRenommage(); if (e.key === "Escape") setEnRenommage(false); }}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1, border: "none", background: "transparent",
              fontSize: 13, color: "var(--texte-primaire)", outline: "none",
              fontFamily: "inherit",
            }}
          />
        ) : (
          <span style={{
            flex: 1, fontSize: 13,
            color: sélectionné === nœud.id ? projetCouleur : "var(--texte-secondaire)",
            fontWeight: sélectionné === nœud.id ? 500 : 400,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {nœud.titre}
          </span>
        )}

        {/* Mots du nœud */}
        {compterMots(nœud.texte) > 0 && (
          <span style={{ fontSize: 10, color: "var(--texte-tertiaire)" }}>
            {compterMots(nœud.texte).toLocaleString("fr-FR")}
          </span>
        )}

        {/* Actions au survol */}
        {survol && !enRenommage && (
          <div style={{ display: "flex", gap: 2 }} onClick={(e) => e.stopPropagation()}>
            {peutAjouter && (
              <button onClick={() => onAjouter(nœud.id, typeInfo.enfant)} style={btnIconStyle} title={t("actions.ajouter", { label: labelEnfant })}>+</button>
            )}
            <button onClick={() => setEnRenommage(true)} style={btnIconStyle} title={t("actions.renommer")}>✎</button>
            <button onClick={() => onSupprimer(nœud.id)} style={{ ...btnIconStyle, color: "#E24B4A" }} title={t("actions.supprimer")}>✕</button>
          </div>
        )}
      </div>

      {/* Enfants récursifs */}
      {ouvert && nœud.enfants?.map((enfant) => (
        <NœudStructure
          key={enfant.id}
          nœud={enfant}
          profondeur={profondeur + 1}
          projetCouleur={projetCouleur}
          sélectionné={sélectionné}
          onSélectionner={onSélectionner}
          onAjouter={onAjouter}
          onRenommer={onRenommer}
          onSupprimer={onSupprimer}
        />
      ))}
    </div>
  );
}

const btnIconStyle = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: 12, color: "var(--texte-tertiaire)",
  padding: "1px 4px", borderRadius: 4,
  fontFamily: "inherit",
};

// ─── Composant : Carte projet (vue liste) ─────────────────────────────────────────

function CarteProjet({ projet, onOuvrir, onSupprimer }) {
  const { t } = useTranslation("common");
  const [survol, setSurvol] = useState(false);
  const mots = totalMotsProjet(projet.structure);

  return (
    <div
      onMouseEnter={() => setSurvol(true)}
      onMouseLeave={() => setSurvol(false)}
      style={{
        background: "var(--surface)",
        border: `0.5px solid ${survol ? projet.couleur + "60" : "var(--border)"}`,
        borderRadius: 12, padding: "1.25rem",
        cursor: "pointer", transition: "all 0.2s",
        transform: survol ? "translateY(-1px)" : "none",
      }}
      onClick={() => onOuvrir(projet.id)}
    >
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: projet.couleur, flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--texte-primaire)" }}>
              {projet.titre}
            </div>
            <div style={{ fontSize: 12, color: "var(--texte-tertiaire)", marginTop: 2 }}>
              {projet.genre}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BadgeStatut statut={projet.statut} />
          {survol && (
            <button
              onClick={(e) => { e.stopPropagation(); onSupprimer(projet.id); }}
              style={{ ...btnIconStyle, color: "#E24B4A", fontSize: 14 }}
              title={t("carteProjet.supprimerTitre")}
            >✕</button>
          )}
        </div>
      </div>

      {/* Description */}
      {projet.description && (
        <p style={{ fontSize: 13, color: "var(--texte-secondaire)", marginBottom: 12, lineHeight: 1.5 }}>
          {projet.description}
        </p>
      )}

      {/* Progression */}
      <BarreProgression valeur={mots} max={projet.objectifMots} couleur={projet.couleur} />

      {/* Stats */}
      <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
        <span style={{ fontSize: 11, color: "var(--texte-tertiaire)" }}>
          {t("carteProjet.motsRediges", { count: mots })}
        </span>
        <span style={{ fontSize: 11, color: "var(--texte-tertiaire)" }}>
          {t("carteProjet.objectif", { count: projet.objectifMots })}
        </span>
        <span style={{ fontSize: 11, color: "var(--texte-tertiaire)", marginLeft: "auto" }}>
          {t("parties", { count: projet.structure?.length || 0 })}
        </span>
      </div>
    </div>
  );
}

// ─── Composant : Formulaire nouveau projet ────────────────────────────────────────

function FormulaireProjet({ onCréer, onAnnuler }) {
  const { t } = useTranslation("common");
  const [form, setForm] = useState({
    titre: "", genre: "Méthode", statut: "En cours",
    couleur: GENRE_COULEURS["Méthode"], objectifMots: 80000, description: "",
  });
  // Tant que l'auteur n'a pas choisi une couleur à la main, elle suit le genre
  // sélectionné. Dès qu'il clique une pastille, la couleur devient indépendante.
  const [couleurManuelle, setCouleurManuelle] = useState(false);

  const màj = (champ, val) => {
    if (champ === "genre" && !couleurManuelle) {
      setForm((f) => ({ ...f, genre: val, couleur: GENRE_COULEURS[val] || f.couleur }));
    } else {
      setForm((f) => ({ ...f, [champ]: val }));
    }
  };

  const choisirCouleur = (c) => {
    setCouleurManuelle(true);
    màj("couleur", c);
  };

  const valider = () => {
    if (!form.titre.trim()) return;
    onCréer({
      id: genId(),
      ...form,
      objectifMots: Number(form.objectifMots) || 80000,
      dateCreation: new Date().toISOString().slice(0, 10),
      structure: [],
    });
  };

  return (
    <div style={{
      background: "var(--surface)",
      border: "0.5px solid var(--border)",
      borderRadius: 12, padding: "1.5rem",
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 20, color: "var(--texte-primaire)" }}>
        {t("formulaireProjet.titre")}
      </h3>

      <div style={{ display: "grid", gap: 14 }}>
        {/* Titre */}
        <div>
          <label style={labelStyle}>{t("formulaireProjet.titreChamp")}</label>
          <input
            autoFocus
            value={form.titre}
            onChange={(e) => màj("titre", e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") valider(); }}
            placeholder={t("formulaireProjet.titrePlaceholder")}
            style={inputStyle}
          />
        </div>

        {/* Genre + Statut */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>{t("formulaireProjet.genre")}</label>
            <select value={form.genre} onChange={(e) => màj("genre", e.target.value)} style={inputStyle}>
              {GENRES.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{t("formulaireProjet.statut")}</label>
            <select value={form.statut} onChange={(e) => màj("statut", e.target.value)} style={inputStyle}>
              {STATUTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Objectif mots */}
        <div>
          <label style={labelStyle}>{t("formulaireProjet.objectifMots")}</label>
          <input
            type="number"
            value={form.objectifMots}
            onChange={(e) => màj("objectifMots", e.target.value)}
            min={1000} max={500000} step={1000}
            style={inputStyle}
          />
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>{t("formulaireProjet.description")}</label>
          <textarea
            value={form.description}
            onChange={(e) => màj("description", e.target.value)}
            placeholder={t("formulaireProjet.descriptionPlaceholder")}
            rows={2}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          />
        </div>

        {/* Couleur */}
        <div>
          <label style={labelStyle}>{t("formulaireProjet.couleur")}</label>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            {COULEURS.map((c) => (
              <div
                key={c}
                onClick={() => choisirCouleur(c)}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: c, cursor: "pointer",
                  border: form.couleur === c ? `3px solid var(--texte-primaire)` : "3px solid transparent",
                  transition: "border 0.15s",
                }}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={valider} style={btnPrimaryStyle(form.couleur)}>
            {t("formulaireProjet.creer")}
          </button>
          <button onClick={onAnnuler} style={btnSecondaryStyle}>
            {t("formulaireProjet.annuler")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Composant : Vue projet (structure du manuscrit) ─────────────────────────────

function VueProjet({ projet, onMàjStructure, onRetour, onOuvrirÉditeur }) {
  const { t } = useTranslation("common");
  const [sélectionné, setSélectionné] = useState(null);
  const mots = totalMotsProjet(projet.structure);

  // Trouve un nœud dans l'arbre local (pour calculer l'ordre du prochain enfant)
  const trouverNœudLocal = (liste, id) => {
    for (const n of liste) {
      if (n.id === id) return n;
      const trouvé = trouverNœudLocal(n.enfants || [], id);
      if (trouvé) return trouvé;
    }
    return null;
  };

  // CORRECTIF 16/07/2026 — CRITIQUE : cette fonction ne faisait auparavant
  // qu'une mise à jour locale (setProjets), sans jamais appeler nœudsAPI.créer().
  // Résultat : les parties/chapitres créés dans l'interface n'existaient QUE
  // dans le navigateur, avec un identifiant local inventé (genId()) — jamais
  // transmis à Supabase. Le texte qu'on y écrivait ensuite tentait de se
  // sauvegarder sur un identifiant que le serveur ne connaissait pas, échouant
  // silencieusement. Toute perte de contenu constatée sur les projets créés
  // avant ce correctif vient de là : le texte n'a jamais été réellement
  // enregistré, il n'a pas été "effacé" après coup.
  const ajouterNœud = useCallback(async (parentId, type) => {
    const estRacine = parentId === projet.id;
    const typeRéel = estRacine ? "partie" : type;
    const parentRéel = trouverNœudLocal(projet.structure, parentId);
    const ordre = estRacine
      ? (projet.structure?.length || 0) + 1
      : (parentRéel?.enfants?.length || 0) + 1;

    const { data, error } = await nœudsAPI.créer({
      type: typeRéel,
      titre: `${t(`structureTypes.${typeRéel}`)} sans titre`,
      ordre,
      parentId: estRacine ? null : parentId,
      texte: "",
    }, projet.id);

    if (error || !data) {
      journaliserErreur("VueProjet:ajouterNœud", error?.message || "Échec de création sans erreur explicite", projet.id);
      window.alert(t("erreur.creationNoeud") || "Impossible de créer cet élément. Réessayez ou contactez le support.");
      return;
    }

    const nouveauNœud = { id: data.id, type: data.type, titre: data.titre, texte: data.texte || "", enfants: [] };

    if (estRacine) {
      onMàjStructure(projet.id, [...(projet.structure || []), nouveauNœud]);
    } else {
      const insérer = (liste) =>
        liste.map((n) => {
          if (n.id === parentId) {
            return { ...n, enfants: [...(n.enfants || []), nouveauNœud] };
          }
          return { ...n, enfants: insérer(n.enfants || []) };
        });
      onMàjStructure(projet.id, insérer(projet.structure || []));
    }
  }, [projet, onMàjStructure, t]);

  // CORRECTIF 16/07/2026 — même problème : ne persistait pas en base.
  const renommerNœud = useCallback(async (nœudId, nouveauTitre) => {
    const { error } = await nœudsAPI.renommer(nœudId, nouveauTitre);
    if (error) {
      journaliserErreur("VueProjet:renommerNœud", error.message, projet.id);
      window.alert(t("erreur.renommageNoeud") || "Impossible de renommer cet élément.");
      return;
    }
    const renommer = (liste) =>
      liste.map((n) =>
        n.id === nœudId
          ? { ...n, titre: nouveauTitre }
          : { ...n, enfants: renommer(n.enfants || []) }
      );
    onMàjStructure(projet.id, renommer(projet.structure || []));
  }, [projet, onMàjStructure, t]);

  // CORRECTIF 16/07/2026 — même problème : ne persistait pas en base.
  const supprimerNœud = useCallback(async (nœudId) => {
    const { error } = await nœudsAPI.supprimer(nœudId);
    if (error) {
      journaliserErreur("VueProjet:supprimerNœud", error.message, projet.id);
      window.alert(t("erreur.suppressionNoeud") || "Impossible de supprimer cet élément.");
      return;
    }
    const supprimer = (liste) =>
      liste
        .filter((n) => n.id !== nœudId)
        .map((n) => ({ ...n, enfants: supprimer(n.enfants || []) }));
    onMàjStructure(projet.id, supprimer(projet.structure || []));
    if (sélectionné === nœudId) setSélectionné(null);
  }, [projet, onMàjStructure, sélectionné, t]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* En-tête projet */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "0.5px solid var(--border)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button onClick={onRetour} style={{ ...btnIconStyle, fontSize: 18 }} title={t("actions.retourAuxProjets")}>←</button>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: projet.couleur }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--texte-primaire)" }}>{projet.titre}</div>
          <div style={{ fontSize: 11, color: "var(--texte-tertiaire)" }}>
            {t("mots", { count: mots })} · {projet.genre} · <BadgeStatut statut={projet.statut} />
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: projet.couleur }}>
            {Math.min(100, Math.round((mots / projet.objectifMots) * 100))}%
          </div>
          <div style={{ fontSize: 11, color: "var(--texte-tertiaire)" }}>
            / {projet.objectifMots.toLocaleString("fr-FR")} {t("mots", { count: projet.objectifMots }).replace(/^\S+\s/, "")}
          </div>
        </div>
      </div>

      {/* Barre de progression */}
      <div style={{ padding: "8px 20px", borderBottom: "0.5px solid var(--border)" }}>
        <BarreProgression valeur={mots} max={projet.objectifMots} couleur={projet.couleur} />
      </div>

      {/* Structure — liste scrollable */}
      <div style={{ overflowY: "auto", padding: "12px 12px", maxHeight: sélectionné ? "40%" : "100%" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 8, padding: "0 8px",
        }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--texte-tertiaire)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {t("vueProjet.structureManuscrit")}
          </span>
          <button
            onClick={() => ajouterNœud(projet.id, "partie")}
            style={{
              fontSize: 11, color: projet.couleur,
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "inherit",
            }}
            title={t("vueProjet.ajouterPartieTitre")}
          >
            {t("vueProjet.ajouterPartie")}
          </button>
        </div>

        {projet.structure?.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "32px 16px",
            color: "var(--texte-tertiaire)", fontSize: 13,
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
            <div style={{ marginBottom: 8 }}>{t("vueProjet.aucuneStructure")}</div>
            <button
              onClick={() => ajouterNœud(projet.id, "partie")}
              style={btnPrimaryStyle(projet.couleur)}
            >
              {t("vueProjet.ajouterPremierePartie")}
            </button>
          </div>
        ) : (
          projet.structure.map((nœud) => (
            <NœudStructure
              key={nœud.id}
              nœud={nœud}
              profondeur={0}
              projetCouleur={projet.couleur}
              sélectionné={sélectionné}
              onSélectionner={setSélectionné}
              onAjouter={ajouterNœud}
              onRenommer={renommerNœud}
              onSupprimer={supprimerNœud}
            />
          ))
        )}
      </div>

      {/* Panneau : aperçu du nœud sélectionné */}
      {sélectionné && (
        <PanneauNœud
          nœudId={sélectionné}
          structure={projet.structure}
          couleur={projet.couleur}
          onOuvrirÉditeur={(id) => onOuvrirÉditeur(projet.id, id)}
          onMàjTexte={(id, texte) => {
            const màj = (liste) =>
              liste.map((n) =>
                n.id === id ? { ...n, texte } : { ...n, enfants: màj(n.enfants || []) }
              );
            onMàjStructure(projet.id, màj(projet.structure));
          }}
        />
      )}
    </div>
  );
}

// ─── Composant : Panneau du nœud sélectionné ─────────────────────────────────────

function PanneauNœud({ nœudId, structure, couleur, onMàjTexte, onOuvrirÉditeur }) {
  const { t } = useTranslation("common");
  const trouver = (liste, id) => {
    for (const n of liste) {
      if (n.id === id) return n;
      const trouvé = trouver(n.enfants || [], id);
      if (trouvé) return trouvé;
    }
    return null;
  };

  const nœud = trouver(structure, nœudId);
  if (!nœud) return null;

  const mots = compterMots(nœud.texte);
  const aContenu = nœud.texte && nœud.texte.length > 0;

  return (
    <div style={{
      borderTop: `2px solid ${couleur}30`,
      display: "flex", flexDirection: "column",
      flex: 1, minHeight: 0, overflow: "hidden",
      background: `${couleur}04`,
    }}>
      {/* En-tête du panneau */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px", borderBottom: `0.5px solid ${couleur}20`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: couleur }}>
          {STRUCTURE_TYPES_META[nœud.type]?.icone} {nœud.titre}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {mots > 0 && (
            <span style={{ fontSize: 11, color: "var(--texte-tertiaire)" }}>
              {t("mots", { count: mots })}
            </span>
          )}
          <button
            onClick={() => onOuvrirÉditeur(nœud.id)}
            style={{
              fontSize: 11, color: "#fff",
              background: couleur, border: "none",
              borderRadius: 6, padding: "5px 12px",
              cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
            }}
          >
            {t("panneauNoeud.ouvrirEditeur")}
          </button>
        </div>
      </div>

      {/* Aperçu du contenu */}
      <div style={{
        flex: 1, overflowY: "auto",
        padding: "16px 20px",
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: 14, lineHeight: 1.8,
        color: "var(--texte-primaire)",
      }}>
        {aContenu ? (
          <div dangerouslySetInnerHTML={{ __html: nœud.texte }} />
        ) : (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            height: "100%", gap: 12, color: "var(--texte-tertiaire)",
            textAlign: "center", padding: "24px",
          }}>
            <div style={{ fontSize: 28 }}>✍️</div>
            <div style={{ fontSize: 13 }}>{t("panneauNoeud.chapitreVide")}</div>
            <button
              onClick={() => onOuvrirÉditeur(nœud.id)}
              style={{
                background: couleur, color: "#fff", border: "none",
                borderRadius: 8, padding: "8px 16px", fontSize: 13,
                fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {t("panneauNoeud.commencerAEcrire")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles réutilisables ─────────────────────────────────────────────────────────

const labelStyle = {
  display: "block", fontSize: 12, fontWeight: 500,
  color: "var(--texte-secondaire)", marginBottom: 5,
};

const inputStyle = {
  width: "100%", padding: "8px 10px",
  border: "0.5px solid var(--border)", borderRadius: 8,
  fontSize: 13, color: "var(--texte-primaire)",
  background: "var(--surface)", fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
};

const btnPrimaryStyle = (couleur) => ({
  background: couleur, color: "#fff",
  border: "none", borderRadius: 8,
  padding: "8px 16px", fontSize: 13,
  fontWeight: 500, cursor: "pointer",
  fontFamily: "inherit",
});

const btnSecondaryStyle = {
  background: "transparent",
  border: "0.5px solid var(--border)",
  borderRadius: 8, padding: "8px 16px",
  fontSize: 13, color: "var(--texte-secondaire)",
  cursor: "pointer", fontFamily: "inherit",
};

// ─── Composant principal : App ────────────────────────────────────────────────────

export default function App() {
  const { t } = useTranslation("common");
  const { user, chargement: authChargement, déconnecter } = useAuth();

  if (authChargement) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", color: "#999", fontSize: 14 }}>
      {t("chargement")}
    </div>
  );
  if (!user) return <PageConnexion />;

  return <AppConnectée user={user} déconnecter={déconnecter} />;
}

// ─── Composant : App connectée (après auth) ───────────────────────────────────

function AppConnectée({ user, déconnecter }) {
  const { t, i18n } = useTranslation("common");
  const [projets, setProjets]   = useState([]);
  const [chargement, setChargement] = useState(true);
  const [vue, setVue]           = useState("tableau");
  const [projetActifId, setProjetActifId] = useState(null);
  const [nœudActifId, setNœudActifId]     = useState(null);
  const [importOuvert, setImportOuvert]   = useState(false);
  const [projetVenantDêtreCréé, setProjetVenantDêtreCréé] = useState(null);
  const [rappelIntentionPour, setRappelIntentionPour]     = useState(null);
  const [aideOuverte, setAideOuverte]                     = useState(false);

  // ── Largeur redimensionnable du panneau Co-pilote IA ──
  const [largeurPanneau, setLargeurPanneau] = useState(280);
  const redimensionnementActif = useRef(false);
  const positionDépart = useRef({ x: 0, largeur: 280 });

  const démarrerRedimensionnement = useCallback((e) => {
    e.preventDefault();
    redimensionnementActif.current = true;
    positionDépart.current = { x: e.clientX, largeur: largeurPanneau };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [largeurPanneau]);

  useEffect(() => {
    const surDéplacement = (e) => {
      if (!redimensionnementActif.current) return;
      const delta = positionDépart.current.x - e.clientX;
      const nouvelleLargeur = positionDépart.current.largeur + delta;
      setLargeurPanneau(Math.min(560, Math.max(220, nouvelleLargeur)));
    };
    const surRelâchement = () => {
      if (redimensionnementActif.current) {
        redimensionnementActif.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", surDéplacement);
    window.addEventListener("mouseup", surRelâchement);
    return () => {
      window.removeEventListener("mousemove", surDéplacement);
      window.removeEventListener("mouseup", surRelâchement);
    };
  }, []);

  // L'ADN du projet (10 questions de niveau 1) — socle de démarrage, présenté
  // comme rassurant, pas comme une contrainte juridique. Tant qu'il n'est pas
  // complet, un rappel discret réapparaît à l'ouverture du projet.
  useEffect(() => {
    if (!projetActifId || projetVenantDêtreCréé) return;

    const vérifier = async () => {
      const { data: adn } = await supabase
        .from("banque_questions")
        .select("id")
        .eq("niveau", 1);

      const { data: réponses } = await supabase
        .from("reponses_questionnaire")
        .select("question_id")
        .eq("projet_id", projetActifId);

      const idsRépondus = new Set((réponses || []).map((r) => r.question_id));
      const toutComplet = (adn || []).every((q) => idsRépondus.has(q.id));

      setRappelIntentionPour(toutComplet ? null : projetActifId);
    };
    vérifier();
  }, [projetActifId, projetVenantDêtreCréé]);

  // Chargement initial des projets depuis Supabase
  useEffect(() => {
    const init = async () => {
      setChargement(true);
      const { data, error } = await projetsAPI.lister();
      if (!error && data) {
        const projetsAvecStructure = await Promise.all(
          data.map(async (p) => {
            const { data: noeuds } = await nœudsAPI.listerParProjet(p.id);
            return { ...normaliserProjet(p), structure: construireArbre(noeuds || []) };
          })
        );
        setProjets(projetsAvecStructure);
      }
      setChargement(false);
    };
    init();
  }, []);

  // Normalise les noms de colonnes Supabase → noms React (camelCase)
  const normaliserProjet = (p) => ({
    id:           p.id,
    titre:        p.titre,
    genre:        p.genre,
    statut:       p.statut,
    couleur:      p.couleur,
    objectifMots: p.objectif_mots,
    description:  p.description,
    dateCreation: p.date_creation,
    // langue : colonne à confirmer sur `projets` (chantier i18n) — fallback 'fr'
    // tant que la migration n'est pas confirmée exécutée.
    langue:       p.langue || "fr",
    structure:    p.structure || [],
  });

  const construireArbre = (nœudsPlats) => {
    const map = {};
    nœudsPlats.forEach((n) => {
      map[n.id] = { ...n, enfants: [] };
    });
    const racines = [];
    nœudsPlats.forEach((n) => {
      if (n.parent_id && map[n.parent_id]) {
        map[n.parent_id].enfants.push(map[n.id]);
      } else {
        racines.push(map[n.id]);
      }
    });
    racines.forEach((r) => trierEnfants(r));
    return racines;
  };

  const trierEnfants = (nœud) => {
    nœud.enfants?.sort((a, b) => a.ordre - b.ordre);
    nœud.enfants?.forEach(trierEnfants);
  };

  const projetActif = projets.find((p) => p.id === projetActifId);

  // Synchronise la langue de l'interface i18next sur la langue DU PROJET actif
  // (règle du chantier : la langue est par projet, pas par compte).
  useEffect(() => {
    const langueCible = projetActif?.langue || "fr";
    if (i18n.language !== langueCible) i18n.changeLanguage(langueCible);
  }, [projetActif?.langue, i18n]);

  const trouverNœud = (structure = [], id) => {
    for (const n of structure) {
      if (n.id === id) return n;
      const trouvé = trouverNœud(n.enfants || [], id);
      if (trouvé) return trouvé;
    }
    return null;
  };

  const nœudActif = projetActif ? trouverNœud(projetActif.structure, nœudActifId) : null;

  // ── Actions projets ──

  const créerProjet = async (données) => {
    const { data, error } = await projetsAPI.créer(données);
    if (!error && data) {
      const nouveau = { ...normaliserProjet(data), structure: [] };
      setProjets((prev) => [nouveau, ...prev]);
      setProjetActifId(nouveau.id);
      setProjetVenantDêtreCréé(nouveau);
      setVue("projet");
    }
  };

  const ouvrirProjet = (id) => { setProjetActifId(id); setVue("projet"); };

  const ouvrirÉditeur = (projetId, nœudId) => {
    setProjetActifId(projetId);
    setNœudActifId(nœudId);
    setVue("editeur");
  };

  const supprimerProjet = async (id) => {
    if (!window.confirm(t("confirmations.supprimerProjet"))) return;
    const { error } = await projetsAPI.supprimer(id);
    if (!error) {
      setProjets((prev) => prev.filter((p) => p.id !== id));
      if (projetActifId === id) { setVue("liste"); setProjetActifId(null); }
    }
  };

  // ── Actions nœuds ──

  const màjStructure = useCallback(async (projetId, nouvelleStructure) => {
    setProjets((prev) =>
      prev.map((p) => p.id === projetId ? { ...p, structure: nouvelleStructure } : p)
    );
  }, []);

  const sauvegarderNœud = useCallback(async (nœudId, html) => {
    setProjets((prev) =>
      prev.map((p) => {
        if (p.id !== projetActifId) return p;
        const màj = (liste) =>
          liste.map((n) =>
            n.id === nœudId ? { ...n, texte: html } : { ...n, enfants: màj(n.enfants || []) }
          );
        return { ...p, structure: màj(p.structure) };
      })
    );
    await nœudsAPI.sauvegarderTexte(nœudId, html);
  }, [projetActifId]);

  const totalMots = projets.reduce((acc, p) => acc + totalMotsProjet(p.structure), 0);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "220px 1fr",
      gridTemplateRows: "48px minmax(0, 1fr)",
      height: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "--surface": "#ffffff",
      "--surface-hover": "#f5f5f5",
      "--border": "#e5e5e5",
      "--texte-primaire": "#1a1a1a",
      "--texte-secondaire": "#555",
      "--texte-tertiaire": "#999",
      background: "#f8f8f8",
    }}>
      {/* ── Barre supérieure ── */}
      <div style={{
        gridColumn: "1 / -1",
        display: "flex", alignItems: "center",
        padding: "0 20px", gap: 16,
        borderBottom: "0.5px solid var(--border)",
        background: "var(--surface)",
      }}>
        <img
          src="/logo-cursus.png"
          alt={t("marque")}
          title={t("marque")}
          style={{ height: 30, width: 30, borderRadius: 6, flexShrink: 0 }}
        />
        <div style={{ flex: 1 }} />
        {chargement ? (
          <span style={{ fontSize: 12, color: "var(--texte-tertiaire)" }}>{t("chargement")}</span>
        ) : (
          <span style={{ fontSize: 12, color: "var(--texte-tertiaire)" }}>
            {t("mots", { count: totalMots })} · {t("projets", { count: projets.length })}
          </span>
        )}
        <span style={{ fontSize: 11, color: "var(--texte-tertiaire)" }}>{user.email}</span>
        <button onClick={() => setAideOuverte(true)}
          style={{ fontSize: 11, color: "#7F77DD", background: "none", border: "0.5px solid #7F77DD40", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>
          {t("aide.bouton")}
        </button>
        <button onClick={déconnecter}
          style={{ fontSize: 11, color: "var(--texte-tertiaire)", background: "none", border: "0.5px solid var(--border)", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>
          {t("deconnexion")}
        </button>
      </div>

      {/* ── Sidebar ── */}
      <div style={{
        borderRight: "0.5px solid var(--border)",
        background: "#fafafa",
        display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* Navigation principale */}
        <div style={{ padding: "16px 12px 8px" }}>
          <div style={sectionLabelStyle}>{t("navigation.titre")}</div>
          {[
            { id: "tableau",      label: t("navigation.tableauDeBord"),  icone: "⊞" },
            { id: "editeur",      label: t("navigation.editeur"),        icone: "✍️" },
            { id: "bibliotheque", label: t("navigation.bibliotheque"),   icone: "📚" },
            { id: "carnet",       label: t("navigation.carnetIdees"),    icone: "💡" },
            { id: "tarification", label: t("navigation.tarification"),   icone: "💳" },
          ].map((item) => (
            <div
              key={item.id}
              onClick={() => {
                if (item.id === "editeur" && projetActif && nœudActif) {
                  setVue("editeur");
                } else if (item.id === "editeur" && projetActif) {
                  setVue("projet");
                } else if (item.id !== "editeur") {
                  setVue(item.id);
                  if (item.id !== "projet") setProjetActifId(null);
                }
              }}
              style={navItemStyle(
                (vue === item.id) ||
                (item.id === "editeur" && (vue === "projet" || vue === "editeur"))
              )}
            >
              <span style={{ fontSize: 14 }}>{item.icone}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div style={{ height: 0.5, background: "var(--border)", margin: "4px 12px" }} />

        {/* Projets actifs avec barres de progression */}
        <div style={{ padding: "8px 12px", flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={sectionLabelStyle}>{t("sidebarProjets.titre")}</div>
            <button
              onClick={() => setVue("nouveau")}
              style={{
                fontSize: 12, fontWeight: 600, color: "#fff",
                background: "#7F77DD", border: "none", borderRadius: 8,
                padding: "6px 14px", cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 1px 4px rgba(127,119,221,0.4)",
              }}
              title={t("sidebarProjets.nouveauTitre")}
            >{t("sidebarProjets.nouveau")}</button>
          </div>
          {projets.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--texte-tertiaire)", padding: "8px 4px" }}>
              {t("sidebarProjets.aucun")}
            </div>
          )}
          {projets.map((p) => {
            const mots = totalMotsProjet(p.structure);
            const pct = Math.min(100, Math.round((mots / (p.objectifMots || 1)) * 100));
            const actif = projetActifId === p.id;
            return (
              <div key={p.id} style={{ marginBottom: 8 }}>
                <div
                  onClick={() => { setProjetActifId(p.id); setVue("projet"); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 8px", borderRadius: 8, cursor: "pointer",
                    background: actif ? `${p.couleur}15` : "transparent",
                    borderLeft: actif ? `2px solid ${p.couleur}` : "2px solid transparent",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.couleur, flexShrink: 0 }} />
                  <span style={{
                    fontSize: 12, flex: 1, fontWeight: actif ? 500 : 400,
                    color: actif ? "var(--texte-primaire)" : "var(--texte-secondaire)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{p.titre}</span>
                  <span style={{ fontSize: 10, color: actif ? p.couleur : "var(--texte-tertiaire)", fontWeight: actif ? 500 : 400 }}>{pct}%</span>
                </div>
                <div style={{ margin: "3px 8px 0 30px", height: 3, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: p.couleur, borderRadius: 4, transition: "width 0.4s" }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Bibliothèque stats */}
        <div style={{ padding: "8px 12px 16px", borderTop: "0.5px solid var(--border)" }}>
          <div style={sectionLabelStyle}>{t("sidebarBibliotheque.titre")}</div>
          {[
            { label: t("sidebarBibliotheque.enCoursLecture"), icone: "📖", onClick: () => setVue("bibliotheque") },
            { label: t("sidebarBibliotheque.citations"),      icone: "❝",  onClick: () => setVue("bibliotheque") },
            { label: t("sidebarBibliotheque.carnetIdees"),    icone: "💡", onClick: () => setVue("carnet") },
          ].map((item) => (
            <div key={item.label}
              onClick={item.onClick}
              style={{ ...navItemStyle(false), fontSize: 12, cursor: "pointer" }}
            >
              <span>{item.icone}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Zone principale ── */}
      <div style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* Vue : tableau de bord */}
        {vue === "tableau" && (
          <TableauDeBord
            projets={projets}
            onOuvrirProjet={(id) => { setProjetActifId(id); setVue("projet"); }}
          />
        )}

        {/* Vue : carnet d'idées */}
        {vue === "carnet" && (
          <CarnetIdees projets={projets} />
        )}

        {/* Vue : bibliothèque */}
        {vue === "bibliotheque" && (
          <Bibliotheque projets={projets} />
        )}

        {/* Vue : tarification */}
        {vue === "tarification" && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <Tarification />
          </div>
        )}

        {/* Vue : liste des projets */}
        {vue === "liste" && (
          <div style={{ padding: "28px 32px", flex: 1, overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--texte-primaire)", marginBottom: 4 }}>
                  {t("vues.mesProjets")}
                </h1>
                <p style={{ fontSize: 13, color: "var(--texte-tertiaire)" }}>
                  {dateAujourd(i18n.language)}
                </p>
              </div>
              <button onClick={() => setVue("nouveau")} style={btnPrimaryStyle("#7F77DD")}>
                {t("vues.nouveauProjetBtn")}
              </button>
            </div>
            {projets.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--texte-tertiaire)" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✍️</div>
                <div style={{ fontSize: 16, marginBottom: 8 }}>{t("vues.aucunProjetTitre")}</div>
                <button onClick={() => setVue("nouveau")} style={btnPrimaryStyle("#7F77DD")}>
                  {t("vues.creerPremierProjet")}
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                {projets.map((p) => (
                  <CarteProjet key={p.id} projet={p} onOuvrir={ouvrirProjet} onSupprimer={supprimerProjet} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Vue : nouveau projet */}
        {vue === "nouveau" && (
          <div style={{ padding: "28px 32px", maxWidth: 560, overflowY: "auto" }}>
            <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--texte-primaire)", marginBottom: 24 }}>
              {t("formulaireProjet.titre")}
            </h1>
            <FormulaireProjet
              onCréer={créerProjet}
              onAnnuler={() => setVue(projets.length > 0 ? "tableau" : "liste")}
            />
          </div>
        )}

        {/* Vue : structure du projet (avec panneau éditeur+IA intégré) */}
        {vue === "projet" && projetActif && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Barre d'actions projet */}
            <div style={{
              padding: "8px 16px", borderBottom: "0.5px solid #e5e5e5",
              display: "flex", alignItems: "center", justifyContent: "flex-end",
              background: "#fafafa",
            }}>
              <button
                onClick={() => setImportOuvert(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: projetActif.couleur, color: "#fff",
                  border: "none", borderRadius: 8, padding: "6px 14px",
                  fontSize: 12, fontWeight: 500, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {t("vues.importerWord")}
              </button>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <VueProjet
                projet={projetActif}
                onMàjStructure={màjStructure}
                onRetour={() => setVue("tableau")}
                onOuvrirÉditeur={ouvrirÉditeur}
              />
            </div>
          </div>
        )}

        {/* Vue : éditeur riche + co-pilote IA — layout maquette */}
        {vue === "editeur" && projetActif && nœudActif && (
          <div style={{ display: "grid", gridTemplateColumns: `minmax(0, 1fr) ${largeurPanneau}px`, height: "100%", overflow: "hidden" }}>
            {/* Éditeur central */}
            <Editeur
              nœud={nœudActif}
              projetCouleur={projetActif.couleur}
              projetTitre={projetActif.titre}
              onSauvegarder={sauvegarderNœud}
              onRetour={() => setVue("projet")}
            />
            {/* Panneau contextuel droit : Citations / IA / Idées */}
            <div style={{
              position: "relative",
              borderLeft: "0.5px solid #e5e5e5",
              display: "flex", flexDirection: "column",
              minHeight: 0,
              overflow: "hidden", background: "#fafafa",
            }}>
              {/* Poignée de redimensionnement */}
              <div
                onMouseDown={démarrerRedimensionnement}
                title="Glisser pour redimensionner le panneau"
                style={{
                  position: "absolute", left: -4, top: 0, bottom: 0, width: 8,
                  cursor: "col-resize", zIndex: 20,
                }}
              />
              <CopiloteIA
                texteActif={nœudActif.texte || ""}
                typeProjet={projetActif.genre === "Roman / Témoignage" ? "fiction" : "non-fiction"}
                couleurProjet={projetActif.couleur}
                projetTitre={projetActif.titre}
                langueProjet={projetActif.langue || "fr"}
                projetId={projetActif.id}
              />
            </div>
          </div>
        )}

        {/* Fallback : si éditeur demandé sans nœud sélectionné */}
        {vue === "editeur" && projetActif && !nœudActif && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--texte-tertiaire)" }}>
            <div style={{ fontSize: 32 }}>📄</div>
            <div style={{ fontSize: 14 }}>{t("vues.selectionnerChapitre")}</div>
            <button onClick={() => setVue("projet")} style={btnPrimaryStyle(projetActif.couleur)}>
              {t("vues.voirStructure")}
            </button>
          </div>
        )}
      </div>

      {/* Centre d'aide — accessible depuis n'importe quel écran */}
      {aideOuverte && <AideFAQ onFermer={() => setAideOuverte(false)} />}

      {/* Modal import Word */}
      {importOuvert && projetActif && (
        <ImportDocx
          projet={projetActif}
          nœudsExistants={(() => {
            const flat = [];
            const aplatir = (noeuds) => noeuds.forEach(n => { flat.push(n); if (n.enfants?.length) aplatir(n.enfants); });
            aplatir(projetActif.structure || []);
            return flat;
          })()}
          onTerminé={() => {
            setImportOuvert(false);
            nœudsAPI.listerParProjet(projetActif.id).then(({ data }) => {
              if (data) {
                setProjets(prev => prev.map(p =>
                  p.id === projetActif.id ? { ...p, structure: construireArbre(data) } : p
                ));
              }
            });
          }}
          onFermer={() => setImportOuvert(false)}
        />
      )}

      {/* Modal questionnaire d'intention — affiché obligatoirement après création d'un projet */}
      {projetVenantDêtreCréé && (
        <QuestionnaireIntention
          projetId={projetVenantDêtreCréé.id}
          projetTitre={projetVenantDêtreCréé.titre}
          onTerminé={() => setProjetVenantDêtreCréé(null)}
        />
      )}

      {/* Rappel persistant — le cap du projet n'est pas suffisamment rempli.
          Réapparaît à chaque ouverture du projet tant que les champs essentiels manquent. */}
      {rappelIntentionPour && !projetVenantDêtreCréé && (
        <QuestionnaireIntention
          projetId={rappelIntentionPour}
          projetTitre={projets.find((p) => p.id === rappelIntentionPour)?.titre || ""}
          onTerminé={() => setRappelIntentionPour(null)}
          onFermer={() => setRappelIntentionPour(null)}
        />
      )}
    </div>
  );
}

const sectionLabelStyle = {
  fontSize: 10, fontWeight: 500,
  color: "var(--texte-tertiaire)",
  letterSpacing: "0.07em", textTransform: "uppercase",
  marginBottom: 6, padding: "0 4px",
};

const navItemStyle = (actif) => ({
  display: "flex", alignItems: "center", gap: 8,
  padding: "6px 8px", borderRadius: 8, cursor: "pointer",
  fontSize: 13,
  color: actif ? "var(--texte-primaire)" : "var(--texte-secondaire)",
  fontWeight: actif ? 500 : 400,
  background: actif ? "var(--surface)" : "transparent",
  marginBottom: 2,
});

/**
 * NOTE POUR JOSEPH — GENRES / STATUTS non traduits (rappel, mis à jour 05/07) :
 *
 * `GENRES` (désormais les 10 catégories + couleurs associées, cf. GENRE_COULEURS)
 * et `STATUTS` sont utilisés à deux endroits différents :
 *   1. Comme libellés affichés dans les formulaires et badges
 *   2. Comme valeurs de comparaison logique (ex. la ligne qui détermine
 *      typeProjet="fiction" compare projetActif.genre à "Roman / Témoignage")
 *
 * Les traduire changerait la valeur stockée en base (`projets.genre`,
 * `projets.statut`) pour les nouveaux projets créés en anglais, cassant
 * silencieusement toute logique qui compare cette valeur à une chaîne
 * française codée en dur (comme la ligne CopiloteIA plus haut).
 *
 * MIGRATION DE DONNÉES À PRÉVOIR : les projets déjà créés avec l'ancienne
 * liste ("Roman", "Non-fiction", "Essai", "Biographie"...) ont une valeur
 * `genre` qui ne correspond plus à aucune entrée du nouveau menu déroulant.
 * Ça n'empêche pas l'affichage (le badge montre la valeur stockée telle
 * quelle), mais rouvrir le formulaire d'un vieux projet affichera un genre
 * vide ou incohérent tant qu'il n'aura pas été réassigné manuellement.
 *
 * Recommandation, au moment de basculer l'anglais en production :
 *   - Introduire un code stable ("methode", "psychologie"...) stocké en base
 *   - Un mapping code → libellé traduit pour l'affichage uniquement
 *   - Remplacer les comparaisons directes sur le libellé français par des
 *     comparaisons sur le code stable
 * Non urgent tant que l'interface reste 100% française.
 */

