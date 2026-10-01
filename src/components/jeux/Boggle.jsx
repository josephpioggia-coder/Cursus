/**
 * CURSUS — Boggle 4×4 (30/09/2026) : trouver un maximum de mots (3 lettres et plus) en
 * enchaînant des cases voisines (horizontal, vertical, diagonale, sans réutiliser une case),
 * en 3 minutes. Score : 3-4 lettres = 1, 5 = 2, 6 = 3, 7 = 5, 8 et plus = 11.
 * Le solveur (trouverMotsBoggle) calcule d'avance TOUS les mots de la grille : un mot est
 * accepté s'il est dans cette liste, et la liste complète est révélée à la fin.
 * Moteur : src/lib/jeuxDeMots.js.
 */
import { useState, useRef } from "react";
import { nouvelleGrilleBoggle, voisinsBoggle, scoreBoggle, norm } from "../../lib/jeuxDeMots.js";
import { GrilleCanvas } from "./dessin.jsx";
import { carte, bouton, boutonClair, champ, discret, EnTete, useCompteARebours, formatTemps, lireStats, noterPartie } from "./commun.jsx";

const DUREE = 180;

export default function Boggle({ donnees }) {
  const [g, setG] = useState(null); // { grille, mots:Map }
  const [enCours, setEnCours] = useState(false);
  const [chemin, setChemin] = useState([]);
  const [trouves, setTrouves] = useState([]); // [{mot, points}]
  const [message, setMessage] = useState("");
  const [saisie, setSaisie] = useState("");
  const [stats, setStats] = useState(() => lireStats("boggle"));
  const scoreRef = useRef(0);

  const score = trouves.reduce((t, x) => t + x.points, 0);
  scoreRef.current = score;
  const maxScore = g ? [...g.mots.keys()].reduce((t, m) => t + scoreBoggle(m), 0) : 0;
  const reste = useCompteARebours(enCours, DUREE, () => { setEnCours(false); setChemin([]); setStats(noterPartie("boggle", { gagne: true, score: scoreRef.current })); });

  const commencer = () => { setG(nouvelleGrilleBoggle(donnees.trie)); setTrouves([]); setChemin([]); setMessage(""); setSaisie(""); setEnCours(true); };
  const mot = g ? chemin.map((i) => g.grille[i]).join("") : "";

  const toucher = (i) => {
    if (!enCours) return;
    setMessage("");
    if (chemin.length && chemin[chemin.length - 1] === i) { setChemin(chemin.slice(0, -1)); return; } // retour arrière
    if (chemin.length && !chemin.includes(i) && voisinsBoggle(chemin[chemin.length - 1]).includes(i)) setChemin([...chemin, i]);
    else setChemin([i]);
  };
  const proposer = (m) => {
    if (!enCours || m.length < 3) { setMessage(m.length ? "Un mot compte au moins 3 lettres." : ""); return; }
    if (trouves.some((x) => x.mot === m)) { setMessage(`${m} : déjà trouvé.`); return; }
    if (!g.mots.has(m)) { setMessage(donnees.ensemble.has(m) ? `${m} existe mais ne se forme pas dans cette grille.` : `${m} n'est pas dans le dictionnaire.`); return; }
    const points = scoreBoggle(m);
    setTrouves([{ mot: m, points }, ...trouves]);
    setMessage(`+${points} : ${m}`);
  };
  const valider = () => { proposer(mot); setChemin([]); };
  const validerSaisie = () => { proposer(norm(saisie).replace(/[^A-Z]/g, "")); setSaisie(""); };

  const tous = g ? [...g.mots.keys()].sort((a, b) => b.length - a.length || a.localeCompare(b)) : [];
  const dansChemin = new Set(chemin);
  return (
    <div>
      <EnTete titre="Boggle 4×4" sous="Enchaîne des cases voisines (diagonales comprises, sans repasser deux fois par la même) pour former des mots de 3 lettres ou plus. 3 minutes." />
      {!g ? (
        <div style={carte}>
          <button style={bouton()} onClick={commencer}>▶ Jouer</button>
          <div style={{ ...discret, marginTop: 8 }}>{stats.jouees} partie{stats.jouees > 1 ? "s" : ""} · record {stats.record} point{stats.record > 1 ? "s" : ""}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 280px", maxWidth: 380, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              <span style={{ color: enCours && reste <= 20 ? "#c0392b" : "inherit" }}>⏱ {formatTemps(enCours ? reste : 0)}</span>
              <span>{score} pt{score > 1 ? "s" : ""}</span>
            </div>
            <div style={{ marginBottom: 10 }}>
              <GrilleCanvas n={4} tuiles maxLargeur={380} onCase={enCours ? (i) => toucher(i) : undefined}
                cellules={g.grille.map((l, i) => ({ l, etat: dansChemin.has(i) ? (chemin[chemin.length - 1] === i ? "fin" : "chemin") : "normal" }))} />
            </div>
            {enCours && (
              <>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <div style={{ flex: 1, minHeight: 38, padding: "8px 10px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, fontSize: 20, letterSpacing: 3, fontWeight: 600 }}>{mot || <span style={{ ...discret, letterSpacing: 0, fontWeight: 400 }}>Touche des cases voisines…</span>}</div>
                  <button style={bouton(mot.length > 0)} disabled={!mot} onClick={valider}>OK</button>
                  <button style={boutonClair(mot.length > 0)} disabled={!mot} onClick={() => setChemin([])}>✕</button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={saisie} onChange={(e) => setSaisie(e.target.value)} onKeyDown={(e) => e.key === "Enter" && validerSaisie()} placeholder="… ou tape le mot puis Entrée" style={{ ...champ, flex: 1, letterSpacing: 1 }} />
                </div>
              </>
            )}
            {message && <div style={{ marginTop: 8, fontSize: 13, color: message.startsWith("+") ? "#1D9E75" : "#c0392b" }}>{message}</div>}
            {!enCours && (
              <div style={{ ...carte, marginTop: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Temps écoulé : {score} point{score > 1 ? "s" : ""}</div>
                <div style={{ ...discret, marginBottom: 8 }}>{trouves.length} mot{trouves.length > 1 ? "s" : ""} sur {tous.length} possibles ({maxScore} points au maximum) · record {stats.record}</div>
                <button style={bouton()} onClick={commencer}>Nouvelle grille</button>
              </div>
            )}
          </div>
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{enCours ? `Mots trouvés (${trouves.length})` : `Tous les mots de la grille (${tous.length})`}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 360, overflowY: "auto" }}>
              {(enCours ? trouves.map((x) => x.mot) : tous).map((m) => {
                const ok = trouves.some((x) => x.mot === m);
                return <span key={m} style={{ fontSize: 13, padding: "3px 8px", borderRadius: 12, background: ok ? "#1D9E7522" : "var(--color-background-secondary, #eee)", color: ok || enCours ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: ok ? 600 : 400 }}>{m}{ok || enCours ? ` ${scoreBoggle(m)}` : ""}</span>;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
