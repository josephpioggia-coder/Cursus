/**
 * CURSUS — Mots codés (04/10/2026) : chaque lettre de la grille est remplacée par un numéro (même lettre = même
 * numéro). Quelques lettres sont données. Toucher une case (ou un numéro de la palette) sélectionne le numéro,
 * puis on tape la lettre : elle s'applique à TOUTES les cases du même numéro. Grille générée avec des mots courants
 * (genererCodes) ; dessin sur canvas (GrilleMotsCanvas).
 */
import { useState, useMemo, useEffect } from "react";
import { genererCodes } from "../../lib/grillesMots.js";
import { GrilleMotsCanvas } from "./dessin.jsx";
import { carte, bouton, boutonClair, discret, ClavierAzerty, useClavier, EnTete, useChrono, formatTemps, lireStats, noterPartie } from "./commun.jsx";

export default function MotsCodes({ donnees }) {
  const [g, setG] = useState(null);
  const [aff, setAff] = useState({}); // numéro -> lettre
  const [num, setNum] = useState(null);
  const [verif, setVerif] = useState(false);
  const [fini, setFini] = useState(null);
  const [aides, setAides] = useState(0);
  const [stats, setStats] = useState(() => lireStats("codes"));
  const temps = useChrono(!!g && !fini, g);

  const nouvelle = () => {
    const p = genererCodes(donnees.courants);
    const a = {}; p.revelees.forEach((l) => { a[p.codes[l]] = l; });
    setG(p); setAff(a); setNum(null); setVerif(false); setFini(null); setAides(0);
  };
  const lettreDe = useMemo(() => { const m = {}; if (g) for (const [l, n] of Object.entries(g.codes)) m[n] = l; return m; }, [g]);
  const donnee = (n) => !!g && g.revelees.includes(lettreDe[n]);

  const placer = (l) => {
    if (fini || num == null || donnee(num)) return;
    setAff((a) => { const n = { ...a }; for (const k of Object.keys(n)) if (n[k] === l) delete n[k]; n[num] = l; return n; });
    setVerif(false);
  };
  const effacer = () => { if (fini || num == null || donnee(num)) return; setAff((a) => { const n = { ...a }; delete n[num]; return n; }); setVerif(false); };
  useClavier(!!g && !fini, { onLettre: placer, onEffacer: effacer });

  useEffect(() => {
    if (!g || fini) return;
    if (Object.entries(g.codes).every(([l, n]) => aff[n] === l)) { setFini("gagne"); setStats(noterPartie("codes", { gagne: true })); }
  }, [aff]); // eslint-disable-line react-hooks/exhaustive-deps

  const cellules = useMemo(() => !g ? null : g.grille.map((ligne, r) => ligne.map((l, c) => {
    if (!l) return null;
    const n = g.codes[l], a = aff[n];
    return { t: "L", lettre: a || "", num: n, fond: num === n ? "#ffd75e" : "#ffffff", erreur: verif && a && a !== l, revele: donnee(n) };
  })), [g, aff, num, verif]); // eslint-disable-line react-hooks/exhaustive-deps

  const aide = () => {
    if (fini || !g) return;
    const cible = Object.entries(g.codes).find(([l, n]) => aff[n] !== l);
    if (!cible) return;
    const [l, n] = cible;
    setAff((a) => { const m = { ...a }; for (const k of Object.keys(m)) if (m[k] === l) delete m[k]; m[n] = l; return m; });
    setNum(n); setAides((x) => x + 1);
  };
  const abandonner = () => {
    if (!window.confirm("Afficher la solution et abandonner cette grille ?")) return;
    const a = {}; for (const [l, n] of Object.entries(g.codes)) a[n] = l;
    setAff(a); setFini("solution"); setStats(noterPartie("codes", { gagne: false }));
  };
  const nombres = g ? Object.values(g.codes).sort((a, b) => a - b) : [];
  const mots = g ? g.mots.length : 0;

  return (
    <div>
      <EnTete titre="Mots codés" sous="Chaque numéro cache toujours la même lettre. Touche une case, puis tape la lettre. Trois lettres te sont données pour démarrer." />
      {!g ? (
        <div style={carte}>
          <button style={bouton()} onClick={nouvelle}>▶ Jouer</button>
          <div style={{ ...discret, marginTop: 8 }}>{stats.gagnees} grille{stats.gagnees > 1 ? "s" : ""} terminée{stats.gagnees > 1 ? "s" : ""} sur {stats.jouees} jouée{stats.jouees > 1 ? "s" : ""}</div>
        </div>
      ) : (
        <div style={{ maxWidth: 560 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            <span>⏱ {formatTemps(temps)}</span><span>{mots} mots cachés</span>
          </div>
          <GrilleMotsCanvas lignes={g.lignes} colonnes={g.colonnes} cellules={cellules} onCase={(r, c) => { const l = g.grille[r][c]; if (l && !fini) setNum(g.codes[l]); }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "10px 0" }} aria-label="Palette des numéros">
            {nombres.map((n) => (
              <button key={n} onClick={() => !fini && setNum(n)} style={{ minWidth: 0, width: 34, padding: "3px 0", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)", background: num === n ? "#ffd75e" : "#fff", color: "#111", fontSize: 11, fontFamily: "inherit", cursor: "pointer", lineHeight: 1.2 }}>
                <span style={{ opacity: 0.6 }}>{n}</span><br /><b style={{ fontSize: 14 }}>{aff[n] || "·"}</b>
              </button>
            ))}
          </div>
          {fini ? (
            <div style={carte}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{fini === "gagne" ? `🎉 Bravo, en ${formatTemps(temps)} !` : "Voici la solution."}</div>
              {fini === "gagne" && <div style={{ ...discret, marginBottom: 8 }}>{aides ? `${aides} aide${aides > 1 ? "s" : ""} utilisée${aides > 1 ? "s" : ""}.` : "Sans aucune aide."}</div>}
              <button style={bouton()} onClick={nouvelle}>Nouvelle grille</button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                <button style={boutonClair()} onClick={() => setVerif(true)}>✔ Vérifier</button>
                <button style={boutonClair()} onClick={aide}>💡 Une lettre</button>
                <button style={boutonClair()} onClick={abandonner}>Solution</button>
                <button style={boutonClair()} onClick={nouvelle}>Autre grille</button>
              </div>
              <ClavierAzerty onLettre={placer} onEffacer={effacer} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
