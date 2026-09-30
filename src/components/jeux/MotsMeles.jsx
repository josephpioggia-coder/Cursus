/**
 * CURSUS — Mots mêlés (30/09/2026, jeu imaginé pour le catalogue) : retrouve les mots cachés
 * dans la grille. Touche la première lettre d'un mot, puis sa dernière : si la ligne droite
 * qui les relie (horizontale, verticale ou diagonale) épelle un mot de la liste, il est
 * trouvé. Trois niveaux : facile (→ ↓), moyen (+ diagonales), difficile (+ mots à l'envers).
 * Moteur : genererMotsMeles() / motSurSegment() dans src/lib/jeuxDeMots.js.
 */
import { useState } from "react";
import { genererMotsMeles, motSurSegment } from "../../lib/jeuxDeMots.js";
import { carte, bouton, boutonClair, champ, discret, EnTete, useChrono, formatTemps, lireStats, noterPartie } from "./commun.jsx";

const NIVEAUX = { facile: { diagonales: false, inverses: false, nb: 7 }, moyen: { diagonales: true, inverses: false, nb: 8 }, difficile: { diagonales: true, inverses: true, nb: 10 } };
const COULEURS = ["#7ed37e", "#8ecae6", "#f4a261", "#d8a0c6", "#f2c94c", "#a3b18a", "#e5989b", "#90dbf4", "#ffcf99", "#b8b8ff"];

const cellsDe = (m) => { const n = Math.max(Math.abs(m.dr * (m.mot.length - 1)), Math.abs(m.dc * (m.mot.length - 1))) + 1; return Array.from({ length: n }, (_, k) => [m.r + m.dr * k, m.c + m.dc * k]); };

export default function MotsMeles({ donnees }) {
  const [niveau, setNiveau] = useState("moyen");
  const [g, setG] = useState(null); // { grille, mots }
  const [trouves, setTrouves] = useState([]); // mots (normalisés) trouvés
  const [debut, setDebut] = useState(null);
  const [message, setMessage] = useState("");
  const [revele, setRevele] = useState(false);
  const [stats, setStats] = useState(() => lireStats("meles"));

  const fini = g && trouves.length === g.mots.length;
  const temps = useChrono(!!g && !fini && !revele, g);

  const nouvelle = () => {
    setG(genererMotsMeles(donnees.courants, { taille: 10, ...NIVEAUX[niveau] }));
    setTrouves([]); setDebut(null); setMessage(""); setRevele(false);
  };
  const toucher = (r, c) => {
    if (fini || revele) return;
    if (!debut) { setDebut([r, c]); setMessage(""); return; }
    const lu = motSurSegment(g.grille, debut[0], debut[1], r, c);
    setDebut(null);
    if (!lu) return setMessage("Ce n'est pas une ligne droite.");
    const envers = [...lu].reverse().join("");
    const cible = g.mots.find((m) => !trouves.includes(m.mot) && (m.mot === lu || m.mot === envers));
    if (!cible) return setMessage(lu.length > 1 ? `« ${lu} » n'est pas dans la liste.` : "");
    const nv = [...trouves, cible.mot];
    setTrouves(nv); setMessage(`Trouvé : ${cible.affiche.toUpperCase()} !`);
    if (nv.length === g.mots.length) setStats(noterPartie("meles", { gagne: true, score: 0 }));
  };

  // couleur de chaque case appartenant à un mot trouvé (ou tous si révélé)
  const teinte = new Map();
  g?.mots.forEach((m, idx) => { if (trouves.includes(m.mot) || revele) for (const [r, c] of cellsDe(m)) if (!teinte.has(`${r},${c}`)) teinte.set(`${r},${c}`, trouves.includes(m.mot) ? COULEURS[idx % COULEURS.length] : "#e0e0e0"); });

  return (
    <div>
      <EnTete titre="Mots mêlés" sous="Touche la première lettre d'un mot caché, puis sa dernière (dans le sens que tu veux). Les mots sont en ligne droite : horizontale, verticale ou diagonale." />
      {!g ? (
        <div style={carte}>
          <label style={{ fontSize: 13 }}>Niveau{" "}
            <select value={niveau} onChange={(e) => setNiveau(e.target.value)} style={champ}>
              <option value="facile">Facile (→ et ↓)</option><option value="moyen">Moyen (+ diagonales)</option><option value="difficile">Difficile (+ à l'envers)</option>
            </select>
          </label>{" "}
          <button style={bouton()} onClick={nouvelle}>▶ Jouer</button>
          <div style={{ ...discret, marginTop: 8 }}>{stats.jouees} grille{stats.jouees > 1 ? "s" : ""} terminée{stats.jouees > 1 ? "s" : ""}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 300px", maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
              <span>⏱ {formatTemps(temps)}</span><span>{trouves.length} / {g.mots.length}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 2, userSelect: "none" }}>
              {g.grille.map((ligne, r) => ligne.map((l, c) => {
                const t = teinte.get(`${r},${c}`);
                const estDebut = debut && debut[0] === r && debut[1] === c;
                return (
                  <button key={`${r}-${c}`} onClick={() => toucher(r, c)} style={{
                    aspectRatio: "1", border: estDebut ? "2px solid #111" : "0.5px solid var(--color-border-tertiary)", borderRadius: 6, padding: 0, fontFamily: "inherit",
                    fontSize: "clamp(12px, 4vw, 20px)", fontWeight: 700, cursor: "pointer", background: estDebut ? "#ffd75e" : t || "var(--color-background-primary)", color: "#111",
                  }}>{l}</button>
                );
              }))}
            </div>
            {message && <div style={{ marginTop: 8, fontSize: 13, color: message.startsWith("Trouvé") ? "#1D9E75" : "#c0392b" }}>{message}</div>}
          </div>
          <div style={{ flex: "1 1 180px", minWidth: 160 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Mots à trouver</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {[...g.mots].sort((a, b) => a.mot.localeCompare(b.mot)).map((m) => {
                const ok = trouves.includes(m.mot);
                return <span key={m.mot} style={{ fontSize: 13, padding: "3px 9px", borderRadius: 12, background: ok ? "#1D9E7522" : "var(--color-background-secondary, #eee)", textDecoration: ok ? "line-through" : "none", color: ok ? "var(--color-text-secondary)" : "var(--color-text-primary)", fontWeight: 600, letterSpacing: 1 }}>{m.affiche.toUpperCase()}</span>;
              })}
            </div>
            {fini ? (
              <div style={carte}><div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>🎉 Tout est trouvé en {formatTemps(temps)} !</div><button style={bouton()} onClick={nouvelle}>Nouvelle grille</button></div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={boutonClair(!revele)} disabled={revele} onClick={() => setRevele(true)}>Révéler les mots</button>
                <button style={boutonClair()} onClick={nouvelle}>Autre grille</button>
                <button style={boutonClair()} onClick={() => setG(null)}>Changer le niveau</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
