/**
 * CURSUS — Mots croisés et mots fléchés (04/10/2026) : interface commune. `mode` = "croises" | "fleches".
 * Moteur : src/lib/grillesMots.js (génération de grilles libres, indices écrits pour Cursus). Dessin sur canvas :
 * GrilleMotsCanvas (dessin.jsx). Interaction : toucher une case sélectionne son mot (retoucher la même case
 * change de sens quand deux mots s'y croisent) ; en mots fléchés on peut aussi toucher la CASE D'INDICE ; les
 * lettres se saisissent au clavier de l'écran (ou au clavier physique).
 */
import { useState, useMemo, useEffect } from "react";
import { genererCroises, genererFleches, cellulesDuMot, NIVEAUX_CROISES } from "../../lib/grillesMots.js";
import { GrilleMotsCanvas } from "./dessin.jsx";
import { carte, bouton, boutonClair, champ, discret, ClavierAzerty, useClavier, EnTete, useChrono, formatTemps, lireStats, noterPartie } from "./commun.jsx";

const cle = (r, c) => `${r},${c}`;
const NOMS_NIVEAUX = { facile: "Facile", moyen: "Moyen", difficile: "Difficile" };

export default function GrilleIndicee({ donnees, mode, titre, sous, statKey }) {
  const fleches = mode === "fleches";
  const [niveau, setNiveau] = useState("facile");
  const [g, setG] = useState(null);
  const [saisie, setSaisie] = useState({});
  const [revelees, setRevelees] = useState(() => new Set());
  const [sel, setSel] = useState(null);
  const [dir, setDir] = useState("H");
  const [verif, setVerif] = useState(false);
  const [fini, setFini] = useState(null); // null | "gagne" | "solution"
  const [message, setMessage] = useState("");
  const [aides, setAides] = useState(0);
  const [stats, setStats] = useState(() => lireStats(statKey));
  const temps = useChrono(!!g && !fini, g);

  const nouvelle = () => {
    const puzzle = fleches ? genererFleches(donnees.croises, niveau) : genererCroises(donnees.croises, niveau);
    setG(puzzle); setSaisie({}); setRevelees(new Set()); setVerif(false); setFini(null); setMessage(""); setAides(0);
    const premier = puzzle.mots[0];
    setDir(premier.dir); setSel({ r: premier.r, c: premier.c });
  };

  const idx = useMemo(() => {
    if (!g) return null;
    const parCase = new Map(), debuts = new Map(), nums = new Map(), solution = new Map();
    for (const m of g.mots) {
      cellulesDuMot(m).forEach(([r, c], i) => {
        const k = cle(r, c), e = parCase.get(k) || {};
        e[m.dir] = m; parCase.set(k, e); solution.set(k, m.mot[i]);
        if (i === 0 && m.num) nums.set(k, m.num);
      });
      if (fleches) {
        const k = cle(m.r - (m.dir === "V" ? 1 : 0), m.c - (m.dir === "H" ? 1 : 0)), e = debuts.get(k) || {};
        e[m.dir] = m; debuts.set(k, e);
      }
    }
    return { parCase, debuts, nums, solution };
  }, [g, fleches]);

  const typeCase = (r, c) => { const x = g?.grille[r]?.[c]; return !x ? null : fleches ? x.t : "L"; };
  const motActif = useMemo(() => {
    if (!idx || !sel) return null;
    const k = cle(sel.r, sel.c), e = (g.grille[sel.r][sel.c]?.t === "C" ? idx.debuts : idx.parCase).get(k);
    return e ? (e[dir] || e.H || e.V) : null;
  }, [idx, sel, dir, g]);

  const surCase = (r, c) => {
    if (fini || !idx) return;
    const t = typeCase(r, c);
    if (!t) return;
    const e = (t === "C" ? idx.debuts : idx.parCase).get(cle(r, c));
    if (!e) return;
    if (sel && sel.r === r && sel.c === c) { if (e.H && e.V) setDir((d) => (d === "H" ? "V" : "H")); return; }
    setSel({ r, c }); if (!e[dir]) setDir(e.H ? "H" : "V");
  };
  const selectionnerMot = (m) => { setDir(m.dir); setSel({ r: m.r, c: m.c }); };

  const placer = (l) => {
    if (fini || !motActif) return;
    const cells = cellulesDuMot(motActif);
    const i = typeCase(sel.r, sel.c) === "C" ? 0 : Math.max(0, cells.findIndex(([r, c]) => r === sel.r && c === sel.c));
    const k = cle(cells[i][0], cells[i][1]);
    if (!revelees.has(k)) { setSaisie((s) => ({ ...s, [k]: l })); setVerif(false); setMessage(""); }
    const suiv = cells[Math.min(i + 1, cells.length - 1)];
    setSel({ r: suiv[0], c: suiv[1] });
  };
  const effacer = () => {
    if (fini || !motActif) return;
    const cells = cellulesDuMot(motActif);
    let i = typeCase(sel.r, sel.c) === "C" ? 0 : Math.max(0, cells.findIndex(([r, c]) => r === sel.r && c === sel.c));
    let k = cle(cells[i][0], cells[i][1]);
    if ((!saisie[k] || revelees.has(k)) && i > 0) { i--; k = cle(cells[i][0], cells[i][1]); setSel({ r: cells[i][0], c: cells[i][1] }); }
    if (!revelees.has(k)) { setSaisie((s) => { const n = { ...s }; delete n[k]; return n; }); setVerif(false); }
  };
  useClavier(!!g && !fini, { onLettre: placer, onEffacer: effacer });

  const reveler = (cases) => {
    const s = { ...saisie }, rv = new Set(revelees);
    for (const [r, c] of cases) { const k = cle(r, c); s[k] = idx.solution.get(k); rv.add(k); }
    setSaisie(s); setRevelees(rv); setVerif(false);
  };
  const aideLettre = () => {
    if (!motActif || fini) return;
    const cells = cellulesDuMot(motActif);
    const cible = cells.find(([r, c]) => saisie[cle(r, c)] !== idx.solution.get(cle(r, c)));
    if (cible) { reveler([cible]); setAides((a) => a + 1); setMessage(""); }
  };
  const aideMot = () => { if (!motActif || fini) return; reveler(cellulesDuMot(motActif)); setAides((a) => a + 3); setMessage(""); };
  const verifier = () => {
    setVerif(true);
    const faux = [...idx.solution].filter(([k, l]) => saisie[k] && saisie[k] !== l).length;
    const vides = [...idx.solution].filter(([k]) => !saisie[k]).length;
    setMessage(faux ? `${faux} lettre${faux > 1 ? "s" : ""} fausse${faux > 1 ? "s" : ""} (en rouge)` : vides ? "Rien de faux pour l'instant, continue !" : "");
  };
  const abandonner = () => { if (window.confirm("Afficher la solution et abandonner cette grille ?")) { reveler([...idx.solution.keys()].map((k) => k.split(",").map(Number))); setFini("solution"); setStats(noterPartie(statKey, { gagne: false })); } };

  // Grille terminée ?
  useEffect(() => {
    if (!idx || fini) return;
    if ([...idx.solution].every(([k, l]) => saisie[k] === l)) { setFini("gagne"); setStats(noterPartie(statKey, { gagne: true })); }
  }, [saisie]); // eslint-disable-line react-hooks/exhaustive-deps

  const cellules = useMemo(() => {
    if (!g) return null;
    const act = new Set(motActif ? cellulesDuMot(motActif).map(([r, c]) => cle(r, c)) : []);
    return g.grille.map((ligne, r) => ligne.map((x, c) => {
      if (!x) return null;
      const k = cle(r, c);
      if (!fleches || x.t === "L") {
        const lettre = saisie[k] || "";
        return { t: "L", lettre, num: idx.nums.get(k), fond: sel && sel.r === r && sel.c === c ? "#ffd75e" : act.has(k) ? "#fff1b8" : "#ffffff", erreur: verif && lettre && lettre !== idx.solution.get(k), revele: revelees.has(k) };
      }
      const e = idx.debuts.get(k) || {};
      return { t: "C", h: x.h ? { texte: x.h.indice } : null, v: x.v ? { texte: x.v.indice } : null, actif: !!motActif && (e.H === motActif || e.V === motActif) };
    }));
  }, [g, saisie, sel, motActif, verif, revelees, idx, fleches]);

  const nbLettres = idx ? idx.solution.size : 0, nbJustes = idx ? [...idx.solution].filter(([k, l]) => saisie[k] === l).length : 0;
  const motFait = (m) => cellulesDuMot(m).every(([r, c]) => saisie[cle(r, c)] === idx.solution.get(cle(r, c)));
  const banniere = motActif ? `${motActif.num ? motActif.num + ". " : ""}${motActif.dir === "H" ? "Horizontalement" : "Verticalement"} — ${motActif.indice} (${motActif.mot.length} lettres)` : "Touche une case";

  return (
    <div>
      <EnTete titre={titre} sous={sous} />
      {!g ? (
        <div style={carte}>
          <label style={{ fontSize: 13 }}>Niveau{" "}
            <select value={niveau} onChange={(e) => setNiveau(e.target.value)} style={champ}>
              {Object.keys(NIVEAUX_CROISES).map((k) => <option key={k} value={k}>{NOMS_NIVEAUX[k]}</option>)}
            </select>
          </label>{" "}
          <button style={bouton()} onClick={nouvelle}>▶ Jouer</button>
          <div style={{ ...discret, marginTop: 8 }}>{stats.gagnees} grille{stats.gagnees > 1 ? "s" : ""} terminée{stats.gagnees > 1 ? "s" : ""} sur {stats.jouees} jouée{stats.jouees > 1 ? "s" : ""}</div>
        </div>
      ) : (
        <div style={{ maxWidth: 560 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            <span>⏱ {formatTemps(temps)}</span><span>{nbJustes} / {nbLettres} lettres</span>
          </div>
          <div style={{ minHeight: 40, padding: "8px 10px", marginBottom: 8, borderRadius: 8, background: "#1D9E7522", fontSize: 13, lineHeight: 1.35, fontWeight: 500 }}>{fini ? (fini === "gagne" ? "🎉 Grille terminée !" : "Solution affichée") : banniere}</div>
          <GrilleMotsCanvas lignes={g.lignes} colonnes={g.colonnes} cellules={cellules} onCase={surCase} />
          {message && !fini && <div style={{ marginTop: 6, fontSize: 12, color: /fausse/.test(message) ? "#c0392b" : "#1D9E75" }}>{message}</div>}
          {fini ? (
            <div style={{ ...carte, marginTop: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{fini === "gagne" ? `Bravo, en ${formatTemps(temps)} !` : "Voici la solution."}</div>
              {fini === "gagne" && <div style={{ ...discret, marginBottom: 8 }}>{aides ? `${aides} point${aides > 1 ? "s" : ""} d'aide utilisé${aides > 1 ? "s" : ""}.` : "Sans aucune aide."}</div>}
              <button style={bouton()} onClick={nouvelle}>Nouvelle grille</button>{" "}
              <button style={boutonClair()} onClick={() => setG(null)}>Changer de niveau</button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
                <button style={boutonClair()} onClick={verifier}>✔ Vérifier</button>
                <button style={boutonClair()} onClick={aideLettre}>💡 Une lettre</button>
                <button style={boutonClair()} onClick={aideMot}>💡 Le mot</button>
                <button style={boutonClair()} onClick={abandonner}>Solution</button>
                <button style={boutonClair()} onClick={nouvelle}>Autre grille</button>
              </div>
              <div style={{ position: "sticky", bottom: 0, padding: "8px 0 4px", background: "var(--color-background-primary, #fff)" }}>
                <ClavierAzerty onLettre={placer} onEffacer={effacer} />
              </div>
            </>
          )}
          {!fleches && (
            <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 16 }}>
              {[["Horizontalement", g.horizontaux], ["Verticalement", g.verticaux]].map(([nom, liste]) => (
                <div key={nom} style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{nom}</div>
                  {liste.map((m) => (
                    <div key={m.num + m.dir} onClick={() => selectionnerMot(m)} style={{ fontSize: 12, lineHeight: 1.45, padding: "3px 6px", borderRadius: 6, cursor: "pointer", background: motActif === m ? "#ffd75e44" : "transparent", textDecoration: motFait(m) ? "line-through" : "none", opacity: motFait(m) ? 0.55 : 1 }}>
                      <b>{m.num}.</b> {m.indice} ({m.mot.length})
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
