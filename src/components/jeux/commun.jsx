/**
 * CURSUS — Éléments communs aux jeux de mots (30/09/2026) : styles, clavier
 * AZERTY à l'écran, chrono, statistiques locales. Voir SalleDesJeux.jsx.
 */

import { useState, useEffect, useRef } from "react";

export const carte = { background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: "14px 16px", marginBottom: 14 };
export const bouton = (actif = true, couleur = "#1D9E75") => ({ background: actif ? couleur : "#ccc", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 500, cursor: actif ? "pointer" : "default", fontFamily: "inherit" });
export const boutonClair = (actif = true) => ({ background: "transparent", border: "0.5px solid var(--color-border-tertiary)", color: actif ? "var(--color-text-primary)" : "#aaa", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: actif ? "pointer" : "default", fontFamily: "inherit" });
export const champ = { padding: "7px 10px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: "var(--color-background-primary)", color: "var(--color-text-primary)" };
export const discret = { fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 };

export const formatTemps = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

/** Compte à rebours en secondes ; `surFin` est appelé une fois à 0. */
export function useCompteARebours(actif, secondes, surFin) {
  const [reste, setReste] = useState(secondes);
  const fin = useRef(surFin);
  fin.current = surFin;
  useEffect(() => { if (actif) setReste(secondes); }, [actif, secondes]);
  useEffect(() => {
    if (!actif) return;
    const t = setInterval(() => setReste((r) => r - 1), 1000);
    return () => clearInterval(t);
  }, [actif]);
  useEffect(() => { if (actif && reste <= 0) fin.current(); }, [reste, actif]);
  return reste;
}

/** Chronomètre (secondes écoulées) tant que `actif`. */
export function useChrono(actif, reinit) {
  const [s, setS] = useState(0);
  useEffect(() => { setS(0); }, [reinit]);
  useEffect(() => {
    if (!actif) return;
    const t = setInterval(() => setS((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [actif]);
  return s;
}

// Statistiques locales (localStorage, par appareil) : { jeu: { jouees, gagnees, serie, meilleureSerie, record } }
const CLE_STATS = "cursus-jeux-stats-v1";
export const lireStats = (jeu) => {
  try { return { jouees: 0, gagnees: 0, serie: 0, meilleureSerie: 0, record: 0, ...(JSON.parse(localStorage.getItem(CLE_STATS) || "{}")[jeu] || {}) }; }
  catch { return { jouees: 0, gagnees: 0, serie: 0, meilleureSerie: 0, record: 0 }; }
};
export const noterPartie = (jeu, { gagne, score }) => {
  try {
    const tout = JSON.parse(localStorage.getItem(CLE_STATS) || "{}");
    const s = { jouees: 0, gagnees: 0, serie: 0, meilleureSerie: 0, record: 0, ...(tout[jeu] || {}) };
    s.jouees++;
    if (gagne) { s.gagnees++; s.serie++; s.meilleureSerie = Math.max(s.meilleureSerie, s.serie); } else s.serie = 0;
    if (typeof score === "number") s.record = Math.max(s.record, score);
    tout[jeu] = s;
    localStorage.setItem(CLE_STATS, JSON.stringify(tout));
    return s;
  } catch { return null; }
};

const RANGEES = ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"];
const COULEUR_TOUCHE = { juste: "#d9534f", present: "#f2c94c", absent: "#8a94a6" };

/** Clavier AZERTY à l'écran. `etats` : { A: "juste"|"present"|"absent" } pour colorer les touches. */
export function ClavierAzerty({ onLettre, onEntree, onEffacer, etats = {}, desactivees = new Set(), inactif }) {
  const touche = (l) => {
    const e = etats[l];
    const off = inactif || desactivees.has(l);
    return (
      <button key={l} disabled={off} onClick={() => onLettre(l)} style={{
        flex: "1 1 0", minWidth: 0, height: 44, borderRadius: 6, border: "none", fontFamily: "inherit", fontSize: 15, fontWeight: 600,
        background: e ? COULEUR_TOUCHE[e] : "var(--color-background-secondary, #e6e6ea)", color: e ? (e === "present" ? "#111" : "#fff") : "var(--color-text-primary)",
        opacity: off ? 0.35 : 1, cursor: off ? "default" : "pointer", padding: 0,
      }}>{l}</button>
    );
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, maxWidth: 480, margin: "0 auto" }}>
      {RANGEES.map((r, i) => (
        <div key={r} style={{ display: "flex", gap: 4, justifyContent: "center", padding: i === 1 ? "0 2%" : i === 2 ? "0 8%" : 0 }}>
          {i === 2 && onEffacer && <button disabled={inactif} onClick={onEffacer} style={{ flex: "1.6 1 0", height: 44, borderRadius: 6, border: "none", fontSize: 16, cursor: "pointer", fontFamily: "inherit", background: "var(--color-background-secondary, #e6e6ea)", color: "var(--color-text-primary)" }}>⌫</button>}
          {[...r].map(touche)}
          {i === 2 && onEntree && <button disabled={inactif} onClick={onEntree} style={{ flex: "1.6 1 0", height: 44, borderRadius: 6, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: "#1D9E75", color: "#fff" }}>OK</button>}
        </div>
      ))}
    </div>
  );
}

/** Écoute le clavier physique (lettres, Entrée, Retour arrière) tant que `actif`. */
export function useClavier(actif, { onLettre, onEntree, onEffacer }) {
  const h = useRef({});
  h.current = { onLettre, onEntree, onEffacer };
  useEffect(() => {
    if (!actif) return;
    const f = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[a-zA-ZàâäçéèêëîïôöùûüÿœæÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆ]$/.test(e.key)) {
        const l = e.key.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/i, "OE").replace(/æ/i, "AE").toUpperCase();
        if (/^[A-Z]$/.test(l)) { h.current.onLettre?.(l); e.preventDefault(); }
      } else if (e.key === "Enter") { h.current.onEntree?.(); e.preventDefault(); }
      else if (e.key === "Backspace") { h.current.onEffacer?.(); e.preventDefault(); }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [actif]);
}

export function EnTete({ titre, sous }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h2 style={{ fontSize: 19, fontWeight: 500, margin: "0 0 4px", color: "var(--color-text-primary)" }}>{titre}</h2>
      {sous && <div style={discret}>{sous}</div>}
    </div>
  );
}

export const lienDefinition = (mot) => "https://fr.wiktionary.org/wiki/" + encodeURIComponent(mot.toLowerCase());
