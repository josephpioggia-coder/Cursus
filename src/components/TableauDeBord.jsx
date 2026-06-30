/**
 * ATELIER D'ÉCRIVAIN — Module 3 : Tableau de bord
 *
 * Fonctionnalités :
 *   - Vue d'ensemble de tous les projets (mots, progression, statut)
 *   - Graphique d'écriture hebdomadaire (mots par jour)
 *   - Historique des sessions (date, projet, mots écrits, durée)
 *   - Suggestion "sur quoi travailler aujourd'hui"
 *   - Statistiques globales (mots totaux, jours actifs, série en cours)
 *   - Persistance des sessions dans localStorage
 */

import { useState, useEffect } from "react";

// ─── Utilitaires ────────────────────────────────────────────────────────────────

const compterMotsHtml = (html = "") =>
  html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;

const totalMotsProjet = (nœuds = []) => {
  let t = 0;
  const parcourir = (liste) => { for (const n of liste) { t += compterMotsHtml(n.texte); parcourir(n.enfants || []); } };
  parcourir(nœuds);
  return t;
};

const joursSemaine = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const getLundi = (date = new Date()) => {
  const d = new Date(date);
  const jour = d.getDay() || 7;
  d.setDate(d.getDate() - jour + 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const cléJour = (date) => date.toISOString().slice(0, 10);

const formaterDurée = (s) => {
  if (!s) return "—";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}min`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
};

const chargerSessions = () => {
  try { return JSON.parse(localStorage.getItem("atelier-sessions")) || []; }
  catch { return []; }
};

// Génère des sessions de démo pour avoir un graphique vivant
const générerSessionsDémo = (projets) => {
  if (!projets.length) return [];
  const sessions = [];
  const aujourdhui = new Date();
  const données = [
    { joursAvant: 6, mots: 312, durée: 2700 },
    { joursAvant: 5, mots: 487, durée: 3600 },
    { joursAvant: 4, mots: 0,   durée: 0    },
    { joursAvant: 3, mots: 621, durée: 4200 },
    { joursAvant: 2, mots: 290, durée: 1800 },
    { joursAvant: 1, mots: 755, durée: 5400 },
    { joursAvant: 0, mots: 180, durée: 1200 },
  ];
  données.forEach(({ joursAvant, mots, durée }) => {
    if (mots === 0) return;
    const date = new Date(aujourdhui);
    date.setDate(date.getDate() - joursAvant);
    sessions.push({
      id: `demo-${joursAvant}`,
      date: cléJour(date),
      projetId: projets[joursAvant % projets.length]?.id,
      projetTitre: projets[joursAvant % projets.length]?.titre || "Projet",
      projetCouleur: projets[joursAvant % projets.length]?.couleur || "#7F77DD",
      mots, durée,
    });
  });
  return sessions;
};

// ─── Composant : Carte statistique ───────────────────────────────────────────────

function CarteStats({ label, valeur, sous, couleur }) {
  return (
    <div style={{
      background: "var(--color-background-secondary)",
      borderRadius: 10, padding: "14px 16px",
    }}>
      <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 500, color: couleur || "var(--color-text-primary)" }}>{valeur}</div>
      {sous && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 3 }}>{sous}</div>}
    </div>
  );
}

// ─── Composant : Graphique hebdomadaire ──────────────────────────────────────────

function GraphiqueSemaine({ sessions, couleurAccent }) {
  const lundi = getLundi();
  const jours = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lundi);
    d.setDate(d.getDate() + i);
    const clé = cléJour(d);
    const mots = sessions
      .filter((s) => s.date === clé)
      .reduce((acc, s) => acc + (s.mots || 0), 0);
    return { label: joursSemaine[i], clé, mots, estAujourd: clé === cléJour(new Date()) };
  });

  const max = Math.max(...jours.map((j) => j.mots), 100);

  return (
    <div style={{
      background: "var(--color-background-primary)",
      border: "0.5px solid var(--color-border-tertiary)",
      borderRadius: 12, padding: "1.25rem",
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 16 }}>
        Cette semaine
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
        {jours.map((j) => {
          const hauteur = j.mots > 0 ? Math.max(6, Math.round((j.mots / max) * 88)) : 4;
          return (
            <div key={j.clé} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              {j.mots > 0 && (
                <span style={{ fontSize: 10, color: couleurAccent, fontWeight: 500 }}>
                  {j.mots >= 1000 ? `${(j.mots / 1000).toFixed(1)}k` : j.mots}
                </span>
              )}
              <div style={{ width: "100%", flex: 1, display: "flex", alignItems: "flex-end" }}>
                <div style={{
                  width: "100%", height: hauteur,
                  background: j.mots > 0 ? couleurAccent : "var(--color-border-tertiary)",
                  borderRadius: "4px 4px 0 0",
                  opacity: j.estAujourd ? 1 : j.mots > 0 ? 0.65 : 0.3,
                  transition: "height 0.4s ease",
                }} />
              </div>
              <span style={{
                fontSize: 10,
                color: j.estAujourd ? couleurAccent : "var(--color-text-tertiary)",
                fontWeight: j.estAujourd ? 500 : 400,
              }}>{j.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Composant : Carte de suggestion ─────────────────────────────────────────────

function CarteSuggestion({ projets, sessions, onOuvrirProjet }) {
  // Logique de suggestion : projet le plus avancé mais pas terminé,
  // ou celui non touché depuis le plus longtemps
  const projetsSuggérés = projets
    .filter((p) => p.statut === "En cours")
    .map((p) => {
      const mots = totalMotsProjet(p.structure);
      const pct = Math.round((mots / (p.objectifMots || 1)) * 100);
      const dernièreSession = sessions
        .filter((s) => s.projetId === p.id)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      const joursDepuis = dernièreSession
        ? Math.floor((Date.now() - new Date(dernièreSession.date)) / 86400000)
        : 999;
      return { ...p, mots, pct, joursDepuis };
    })
    .sort((a, b) => b.joursDepuis - a.joursDepuis);

  const suggestion = projetsSuggérés[0];
  if (!suggestion) return null;

  const message = suggestion.joursDepuis >= 3
    ? `Pas écrit depuis ${suggestion.joursDepuis === 999 ? "longtemps" : `${suggestion.joursDepuis} jours`}`
    : `${suggestion.pct}% complété · continuez sur votre lancée`;

  return (
    <div style={{
      background: `${suggestion.couleur}12`,
      border: `1px solid ${suggestion.couleur}30`,
      borderRadius: 12, padding: "1.25rem",
    }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: suggestion.couleur, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
        Suggestion du jour
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: suggestion.couleur, flexShrink: 0 }} />
        <span style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>{suggestion.titre}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 14 }}>{message}</div>
      <button
        onClick={() => onOuvrirProjet(suggestion.id)}
        style={{
          background: suggestion.couleur, color: "#fff",
          border: "none", borderRadius: 8, padding: "8px 16px",
          fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        Écrire maintenant →
      </button>
    </div>
  );
}

// ─── Composant : Liste des projets ────────────────────────────────────────────────

function ListeProjets({ projets, onOuvrirProjet }) {
  return (
    <div style={{
      background: "var(--color-background-primary)",
      border: "0.5px solid var(--color-border-tertiary)",
      borderRadius: 12, overflow: "hidden",
    }}>
      <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Tous les projets</span>
      </div>
      {projets.length === 0 ? (
        <div style={{ padding: "24px", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 13 }}>
          Aucun projet. Créez-en un pour commencer.
        </div>
      ) : (
        projets.map((p, i) => {
          const mots = totalMotsProjet(p.structure);
          const pct = Math.min(100, Math.round((mots / (p.objectifMots || 1)) * 100));
          return (
            <div
              key={p.id}
              onClick={() => onOuvrirProjet(p.id)}
              style={{
                padding: "12px 16px",
                borderBottom: i < projets.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-background-secondary)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.couleur, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.titre}
                  </span>
                  <span style={{ fontSize: 11, color: p.couleur, fontWeight: 500, flexShrink: 0, marginLeft: 8 }}>
                    {pct}%
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ flex: 1, height: 3, background: "var(--color-border-tertiary)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: p.couleur, borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 10, color: "var(--color-text-tertiary)", flexShrink: 0 }}>
                    {mots.toLocaleString("fr-FR")} / {p.objectifMots.toLocaleString("fr-FR")} mots
                  </span>
                </div>
              </div>
              <span style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 20,
                background: p.statut === "En cours" ? "#EEEDFE" : p.statut === "Terminé" ? "#EAF3DE" : "var(--color-background-secondary)",
                color: p.statut === "En cours" ? "#534AB7" : p.statut === "Terminé" ? "#3B6D11" : "var(--color-text-tertiary)",
                flexShrink: 0,
              }}>
                {p.statut}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Composant : Historique des sessions ──────────────────────────────────────────

function HistoriqueSessions({ sessions }) {
  const récentes = [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  const formaterDate = (clé) => {
    const d = new Date(clé);
    const auj = cléJour(new Date());
    const hier = cléJour(new Date(Date.now() - 86400000));
    if (clé === auj) return "Aujourd'hui";
    if (clé === hier) return "Hier";
    return d.toLocaleDateString("fr-BE", { day: "numeric", month: "short" });
  };

  return (
    <div style={{
      background: "var(--color-background-primary)",
      border: "0.5px solid var(--color-border-tertiary)",
      borderRadius: 12, overflow: "hidden",
    }}>
      <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Sessions récentes</span>
      </div>
      {récentes.length === 0 ? (
        <div style={{ padding: "24px", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 13 }}>
          Vos sessions d'écriture apparaîtront ici.
        </div>
      ) : (
        récentes.map((s, i) => (
          <div key={s.id} style={{
            padding: "10px 16px",
            borderBottom: i < récentes.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.projetCouleur, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                {s.projetTitre}
              </span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: s.projetCouleur, flexShrink: 0 }}>
              +{s.mots} mots
            </span>
            <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", flexShrink: 0, minWidth: 50, textAlign: "right" }}>
              {formaterDurée(s.durée)}
            </span>
            <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", flexShrink: 0, minWidth: 60, textAlign: "right" }}>
              {formaterDate(s.date)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Composant principal : Tableau de bord ────────────────────────────────────────

export default function TableauDeBord({ projets = [], onOuvrirProjet }) {
  const [sessions, setSessions] = useState(() => {
    const sauvegardées = chargerSessions();
    if (sauvegardées.length > 0) return sauvegardées;
    return générerSessionsDémo(projets);
  });

  // Statistiques globales
  const totalMots = projets.reduce((acc, p) => acc + totalMotsProjet(p.structure), 0);
  const projetsActifs = projets.filter((p) => p.statut === "En cours").length;

  const joursActifs = new Set(sessions.map((s) => s.date)).size;

  // Série actuelle (jours consécutifs avec au moins une session)
  const calculerSérie = () => {
    let série = 0;
    const aujourd = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(aujourd);
      d.setDate(d.getDate() - i);
      const clé = cléJour(d);
      if (sessions.some((s) => s.date === clé)) série++;
      else if (i > 0) break;
    }
    return série;
  };
  const série = calculerSérie();

  const totalMotsSemaine = sessions
    .filter((s) => {
      const d = new Date(s.date);
      return d >= getLundi();
    })
    .reduce((acc, s) => acc + (s.mots || 0), 0);

  return (
    <div style={{ padding: "28px 32px", overflowY: "auto" }}>
      {/* En-tête */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 4 }}>
          Tableau de bord
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>
          {new Date().toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Statistiques globales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <CarteStats label="Mots écrits au total" valeur={totalMots.toLocaleString("fr-FR")} sous="dans tous les projets" couleur="var(--color-text-primary)" />
        <CarteStats label="Cette semaine" valeur={totalMotsSemaine.toLocaleString("fr-FR")} sous="mots" couleur="#7F77DD" />
        <CarteStats label="Projets actifs" valeur={projetsActifs} sous={`sur ${projets.length} projets`} couleur="var(--color-text-primary)" />
        <CarteStats label="Série actuelle" valeur={`${série} jour${série !== 1 ? "s" : ""}`} sous={`${joursActifs} jours actifs au total`} couleur={série >= 3 ? "#1D9E75" : "var(--color-text-primary)"} />
      </div>

      {/* Ligne principale : graphique + suggestion */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, marginBottom: 16 }}>
        <GraphiqueSemaine sessions={sessions} couleurAccent="#7F77DD" />
        <CarteSuggestion projets={projets} sessions={sessions} onOuvrirProjet={onOuvrirProjet} />
      </div>

      {/* Ligne secondaire : projets + sessions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <ListeProjets projets={projets} onOuvrirProjet={onOuvrirProjet} />
        <HistoriqueSessions sessions={sessions} />
      </div>
    </div>
  );
}
