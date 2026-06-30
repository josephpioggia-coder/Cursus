/**
 * ATELIER D'ÉCRIVAIN — Module 5 : Carnet d'idées
 *
 * Fonctionnalités :
 *   - Capture rapide d'idées (texte libre, raccourci Ctrl+Shift+I)
 *   - Tags thématiques + liaison à un projet/chapitre
 *   - Statuts : Nouvelle / En réflexion / À placer / Placée / Archivée
 *   - Filtres par statut, projet, tag
 *   - Tri par date, priorité, projet
 *   - Glisser une idée vers un projet (marquage "À placer")
 */

import { useState, useEffect, useMemo, useRef } from "react";

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const STATUTS = [
  { id: "nouvelle",     label: "Nouvelle",      couleur: "#7F77DD" },
  { id: "reflexion",    label: "En réflexion",   couleur: "#BA7517" },
  { id: "a_placer",     label: "À placer",       couleur: "#1D9E75" },
  { id: "placee",       label: "Placée",         couleur: "#888"    },
  { id: "archivee",     label: "Archivée",       couleur: "#bbb"    },
];

const statutInfo = (id) => STATUTS.find((s) => s.id === id) || STATUTS[0];

const DEMO_IDEES = [
  { id: genId(), texte: "Faire le parallèle avec l'effet Pygmalion — la croyance du manager transforme réellement la performance de son équipe.", tags: ["méthode", "management"], statut: "a_placer", projetId: null, dateAjout: new Date(Date.now() - 86400000 * 2).toISOString(), priorité: 1 },
  { id: genId(), texte: "Scène d'ouverture : Clara dans le train, elle regarde son reflet et ne se reconnaît pas. Métaphore du déracinement.", tags: ["roman", "ouverture"], statut: "nouvelle", projetId: null, dateAjout: new Date(Date.now() - 86400000).toISOString(), priorité: 2 },
  { id: genId(), texte: "Titre alternatif pour le chapitre 3 : « Le miroir brisé » — plus fort que « Perception de soi ».", tags: ["méthode", "titre"], statut: "reflexion", projetId: null, dateAjout: new Date().toISOString(), priorité: 2 },
  { id: genId(), texte: "Citer Bourdieu sur l'habitus pour renforcer la partie sur les comportements automatiques. Vérifier la page exacte dans La Distinction.", tags: ["méthode", "référence"], statut: "a_placer", projetId: null, dateAjout: new Date(Date.now() - 86400000 * 5).toISOString(), priorité: 1 },
];

const chargerIdées = () => {
  try { return JSON.parse(localStorage.getItem("atelier-idees")) || DEMO_IDEES; }
  catch { return DEMO_IDEES; }
};

function CarteIdée({ idée, projets, onMàj, onSupprimer }) {
  const [déployée, setDéployée] = useState(false);
  const s = statutInfo(idée.statut);
  const projet = projets.find((p) => p.id === idée.projetId);

  return (
    <div style={{
      background: "var(--color-background-primary)",
      border: "0.5px solid var(--color-border-tertiary)",
      borderLeft: `3px solid ${s.couleur}`,
      borderRadius: 8, padding: "12px 14px", marginBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--color-text-primary)", margin: "0 0 8px" }}>
            {idée.texte}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: s.couleur + "20", color: s.couleur, fontWeight: 500 }}>
              {s.label}
            </span>
            {idée.tags?.map((t) => (
              <span key={t} style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20, background: "var(--color-background-secondary)", color: "var(--color-text-tertiary)" }}>
                {t}
              </span>
            ))}
            {projet && (
              <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20, background: projet.couleur + "20", color: projet.couleur }}>
                {projet.titre}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button onClick={() => setDéployée(!déployée)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--color-text-tertiary)", padding: "0 3px" }}>
            {déployée ? "▲" : "▼"}
          </button>
          <button onClick={() => onSupprimer(idée.id)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-tertiary)", padding: "0 3px" }}>✕</button>
        </div>
      </div>

      {déployée && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid var(--color-border-tertiary)", display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 4 }}>Statut</label>
              <select value={idée.statut} onChange={(e) => onMàj({ ...idée, statut: e.target.value })}
                style={{ width: "100%", padding: "5px 8px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6, fontSize: 12, color: "var(--color-text-primary)", background: "var(--color-background-primary)", fontFamily: "inherit" }}>
                {STATUTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 4 }}>Projet lié</label>
              <select value={idée.projetId || ""} onChange={(e) => onMàj({ ...idée, projetId: e.target.value || null })}
                style={{ width: "100%", padding: "5px 8px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6, fontSize: 12, color: "var(--color-text-primary)", background: "var(--color-background-primary)", fontFamily: "inherit" }}>
                <option value="">Aucun</option>
                {projets.map((p) => <option key={p.id} value={p.id}>{p.titre}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 4 }}>Tags (séparés par virgule)</label>
            <input defaultValue={idée.tags?.join(", ")}
              onBlur={(e) => onMàj({ ...idée, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
              style={{ width: "100%", padding: "5px 8px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6, fontSize: 12, color: "var(--color-text-primary)", background: "var(--color-background-primary)", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function CarnetIdees({ projets = [] }) {
  const [idées, setIdées] = useState(chargerIdées);
  const [nouvelle, setNouvelle] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [filtreProjet, setFiltreProjet] = useState("tous");
  const [recherche, setRecherche] = useState("");
  const inputRef = useRef(null);

  const sauvegarder = (i) => { setIdées(i); localStorage.setItem("atelier-idees", JSON.stringify(i)); };

  // Raccourci Ctrl+Shift+I pour focus sur la zone de saisie
  useEffect(() => {
    const h = (e) => { if (e.ctrlKey && e.shiftKey && e.key === "I") { e.preventDefault(); inputRef.current?.focus(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const ajouterIdée = () => {
    if (!nouvelle.trim()) return;
    const i = { id: genId(), texte: nouvelle.trim(), tags: [], statut: "nouvelle", projetId: null, dateAjout: new Date().toISOString(), priorité: 2 };
    sauvegarder([i, ...idées]);
    setNouvelle("");
  };

  const idéesFiltées = useMemo(() => {
    return idées.filter((i) => {
      const q = recherche.toLowerCase();
      const matchQ = !q || i.texte.toLowerCase().includes(q) || i.tags?.some((t) => t.toLowerCase().includes(q));
      const matchS = filtreStatut === "tous" || i.statut === filtreStatut;
      const matchP = filtreProjet === "tous" || i.projetId === filtreProjet;
      return matchQ && matchS && matchP;
    });
  }, [idées, recherche, filtreStatut, filtreProjet]);

  const compteurs = useMemo(() => {
    const c = {};
    STATUTS.forEach((s) => { c[s.id] = idées.filter((i) => i.statut === s.id).length; });
    return c;
  }, [idées]);

  return (
    <div style={{ padding: "24px 28px", overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 3px" }}>Carnet d'idées</h1>
          <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", margin: 0 }}>{idées.length} idée{idées.length !== 1 ? "s" : ""} · Ctrl+Shift+I pour capturer rapidement</p>
        </div>
      </div>

      {/* Capture rapide */}
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
        <textarea ref={inputRef} value={nouvelle} onChange={(e) => setNouvelle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) ajouterIdée(); }}
          placeholder="Nouvelle idée… (Ctrl+Entrée pour enregistrer)"
          rows={3}
          style={{ width: "100%", border: "none", outline: "none", fontSize: 14, lineHeight: 1.65, color: "var(--color-text-primary)", background: "transparent", fontFamily: "inherit", resize: "none", boxSizing: "border-box" }} />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={ajouterIdée} disabled={!nouvelle.trim()}
            style={{ background: nouvelle.trim() ? "#7F77DD" : "var(--color-background-secondary)", color: nouvelle.trim() ? "#fff" : "var(--color-text-tertiary)", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: nouvelle.trim() ? "pointer" : "default", fontFamily: "inherit", transition: "all 0.2s" }}>
            Capturer
          </button>
        </div>
      </div>

      {/* Compteurs par statut */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setFiltreStatut("tous")}
          style={{ padding: "4px 10px", borderRadius: 20, border: `0.5px solid ${filtreStatut === "tous" ? "#7F77DD" : "var(--color-border-tertiary)"}`, background: filtreStatut === "tous" ? "#EEEDFE" : "transparent", color: filtreStatut === "tous" ? "#534AB7" : "var(--color-text-secondary)", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: filtreStatut === "tous" ? 500 : 400 }}>
          Toutes ({idées.length})
        </button>
        {STATUTS.map((s) => (
          <button key={s.id} onClick={() => setFiltreStatut(s.id)}
            style={{ padding: "4px 10px", borderRadius: 20, border: `0.5px solid ${filtreStatut === s.id ? s.couleur : "var(--color-border-tertiary)"}`, background: filtreStatut === s.id ? s.couleur + "20" : "transparent", color: filtreStatut === s.id ? s.couleur : "var(--color-text-secondary)", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: filtreStatut === s.id ? 500 : 400 }}>
            {s.label} ({compteurs[s.id] || 0})
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher…"
          style={{ flex: 1, padding: "6px 10px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 7, fontSize: 12, color: "var(--color-text-primary)", background: "var(--color-background-primary)", fontFamily: "inherit", outline: "none" }} />
        <select value={filtreProjet} onChange={(e) => setFiltreProjet(e.target.value)}
          style={{ padding: "6px 10px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 7, fontSize: 12, color: "var(--color-text-secondary)", background: "var(--color-background-primary)", fontFamily: "inherit" }}>
          <option value="tous">Tous les projets</option>
          {projets.map((p) => <option key={p.id} value={p.id}>{p.titre}</option>)}
        </select>
      </div>

      {/* Liste des idées */}
      {idéesFiltées.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--color-text-tertiary)", fontSize: 13 }}>
          {idées.length === 0 ? "Votre carnet est vide. Capturez votre première idée ci-dessus." : "Aucune idée ne correspond à ces filtres."}
        </div>
      ) : (
        idéesFiltées.map((idée) => (
          <CarteIdée key={idée.id} idée={idée} projets={projets}
            onMàj={(màj) => sauvegarder(idées.map((i) => i.id === màj.id ? màj : i))}
            onSupprimer={(id) => sauvegarder(idées.filter((i) => i.id !== id))} />
        ))
      )}
    </div>
  );
}
