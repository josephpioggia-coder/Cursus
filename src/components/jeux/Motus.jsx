/**
 * CURSUS — Motus (30/09/2026) : deviner un mot en 6 essais ; la première lettre est donnée.
 * Rouge = bien placée, jaune = présente ailleurs, bleu = absente. Le mot secret est un mot
 * COURANT (public/jeux/mots-courants.txt) ; un essai doit être un mot du dictionnaire.
 * Moteur : evaluerEssai() / motPourMotus() dans src/lib/jeuxDeMots.js.
 */
import { useState, useCallback } from "react";
import { evaluerEssai, motPourMotus } from "../../lib/jeuxDeMots.js";
import { carte, bouton, boutonClair, champ, discret, ClavierAzerty, useClavier, EnTete, lireStats, noterPartie, lienDefinition } from "./commun.jsx";

const ESSAIS = 6;
const FOND = { juste: "#d9534f", present: "#f2c94c", absent: "#2a5db0" };

export default function Motus({ donnees }) {
  const [longueur, setLongueur] = useState(6);
  const [partie, setPartie] = useState(null);
  const [stats, setStats] = useState(() => lireStats("motus"));

  const nouvelle = useCallback((n = longueur) => {
    const m = motPourMotus(donnees.courants, n);
    setPartie({ ...m, essais: [], courant: m.secret[0], statut: "jeu", message: "" });
  }, [donnees, longueur]);

  const lettre = (l) => setPartie((p) => (p && p.statut === "jeu" && p.courant.length < p.secret.length ? { ...p, courant: p.courant + l, message: "" } : p));
  const effacer = () => setPartie((p) => (p && p.statut === "jeu" && p.courant.length > 1 ? { ...p, courant: p.courant.slice(0, -1), message: "" } : p));
  const valider = () => setPartie((p) => {
    if (!p || p.statut !== "jeu") return p;
    if (p.courant.length !== p.secret.length) return { ...p, message: "Il manque des lettres." };
    if (!donnees.ensemble.has(p.courant)) return { ...p, message: "Ce mot n'est pas dans le dictionnaire." };
    const etats = evaluerEssai(p.secret, p.courant);
    const essais = [...p.essais, { mot: p.courant, etats }];
    const gagne = p.courant === p.secret;
    const fini = gagne || essais.length >= ESSAIS;
    if (fini) setTimeout(() => setStats(noterPartie("motus", { gagne })), 0);
    return { ...p, essais, courant: p.secret[0], statut: gagne ? "gagne" : fini ? "perdu" : "jeu", message: "" };
  });
  useClavier(!!partie && partie.statut === "jeu", { onLettre: lettre, onEntree: valider, onEffacer: effacer });

  // Couleur des touches : le meilleur état connu pour chaque lettre.
  const etatsTouches = {};
  for (const e of partie?.essais || []) e.mot.split("").forEach((l, i) => {
    const s = e.etats[i], rang = { absent: 0, present: 1, juste: 2 };
    if (etatsTouches[l] === undefined || rang[s] > rang[etatsTouches[l]]) etatsTouches[l] = s;
  });
  // Lettres déjà bien placées : rappelées (en filigrane) dans la ligne en cours, comme à la télévision.
  const connues = {};
  for (const e of partie?.essais || []) e.etats.forEach((s, i) => { if (s === "juste") connues[i] = e.mot[i]; });

  const n = partie ? partie.secret.length : longueur;
  const cell = { width: `min(${Math.floor(92 / n)}vw, 52px)`, aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "clamp(16px, 5vw, 26px)", color: "#fff" };

  return (
    <div>
      <EnTete titre="Motus" sous="Trouve le mot en 6 essais. La première lettre est donnée. Rouge : bien placée · jaune : présente ailleurs · bleu : absente." />
      {!partie ? (
        <div style={carte}>
          <label style={{ fontSize: 13 }}>Longueur du mot{" "}
            <select value={longueur} onChange={(e) => setLongueur(Number(e.target.value))} style={champ}>
              {[5, 6, 7, 8].map((k) => <option key={k} value={k}>{k} lettres</option>)}
            </select>
          </label>{" "}
          <button style={bouton()} onClick={() => nouvelle()}>▶ Jouer</button>
          <div style={{ ...discret, marginTop: 8 }}>{stats.jouees} partie{stats.jouees > 1 ? "s" : ""} · {stats.gagnees} gagnée{stats.gagnees > 1 ? "s" : ""} · série en cours {stats.serie} (record {stats.meilleureSerie})</div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center", marginBottom: 12 }}>
            {Array.from({ length: ESSAIS }, (_, r) => {
              const e = partie.essais[r];
              const enCours = !e && r === partie.essais.length && partie.statut === "jeu";
              return (
                <div key={r} style={{ display: "flex", gap: 4 }}>
                  {Array.from({ length: n }, (_, i) => {
                    const l = e ? e.mot[i] : enCours ? (partie.courant[i] || connues[i] || "") : "";
                    const present = e && e.etats[i] === "present";
                    const filigrane = enCours && !partie.courant[i] && connues[i];
                    return (
                      <div key={i} style={{ ...cell, background: e ? (present ? "#2a5db0" : FOND[e.etats[i]]) : "#2a5db0", opacity: e || enCours ? 1 : 0.35, borderRadius: 4,
                        outline: enCours && i === partie.courant.length ? "2px solid #fff" : "none" }}>
                        <span style={{ opacity: filigrane ? 0.45 : 1, ...(present ? { background: "#f2c94c", color: "#111", width: "88%", height: "88%", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" } : {}) }}>{l}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {partie.message && <div style={{ textAlign: "center", fontSize: 13, color: "#c0392b", marginBottom: 8 }}>{partie.message}</div>}
          {partie.statut === "jeu" ? (
            <ClavierAzerty onLettre={lettre} onEntree={valider} onEffacer={effacer} etats={etatsTouches} />
          ) : (
            <div style={{ ...carte, textAlign: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{partie.statut === "gagne" ? `🎉 Bravo, en ${partie.essais.length} essai${partie.essais.length > 1 ? "s" : ""} !` : "Perdu…"}</div>
              <div style={{ fontSize: 14, marginBottom: 8 }}>Le mot était <b>{partie.affiche.toUpperCase()}</b> — <a href={lienDefinition(partie.affiche)} target="_blank" rel="noopener noreferrer" style={{ color: "#1D9E75" }}>définition ↗</a></div>
              <button style={bouton()} onClick={() => nouvelle()}>Rejouer</button>{" "}
              <button style={boutonClair()} onClick={() => setPartie(null)}>Changer la longueur</button>
              <div style={{ ...discret, marginTop: 8 }}>{stats.jouees} parties · {stats.gagnees} gagnées · série {stats.serie} (record {stats.meilleureSerie})</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
