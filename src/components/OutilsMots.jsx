/**
 * CURSUS — Outils de mots du Scrabble (29/09/2026)
 * ======================================================================
 * Onglet "Outils de mots" de ScrabbleSolveur.jsx. Modèle fonctionnel
 * donné par Joseph : le solveur en ligne dCode (dcode.fr/solveur-scrabble),
 * "très complet". Seules ses FONCTIONS sont reprises (aucun code ni
 * donnée de dCode) : 4 modes de recherche, options, dictionnaire,
 * entraînement, compteur de points, compteur de lettres restantes.
 * Moteur : src/lib/scrabbleMots.js. Dictionnaire : liste libre, pas
 * l'ODS9 — les "mots butoirs" et la validité sont donc approximatifs.
 */

import { useState, useMemo, useEffect, Fragment } from "react";
import {
  chargerListe, rechercher, lettresAccrochables, lettresRestantes, tirageAleatoire,
  pointsMotPose, scoreBrut, normaliser, definir,
} from "../lib/scrabbleMots.js";
import { pointsLettre } from "../lib/scrabbleSolveur.js";

const carte = { background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: "14px 16px", marginBottom: 16 };
const titre = { fontSize: 15, fontWeight: 600, margin: "0 0 10px", color: "var(--color-text-primary)" };
const champ = { padding: "7px 10px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, fontSize: 14, fontFamily: "inherit" };
const bouton = (actif = true) => ({ background: actif ? "#1D9E75" : "#ccc", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: actif ? "pointer" : "default", fontFamily: "inherit" });
const boutonClair = { background: "transparent", border: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-primary)", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" };
const etiquette = { fontSize: 12, color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: 6 };

const MODES = [
  { id: "long", label: "Trouver le mot le plus long (sans utiliser le plateau)" },
  { id: "raccrocher", label: "Raccrocher une lettre du plateau parmi :", champ: "accroche", ph: "ex. ODS" },
  { id: "motif", label: "Prolonger / intégrer ce motif de lettres (espace ou - = lettre libre) :", champ: "motif", ph: "ex. AGE ou E--S" },
  { id: "accrochables", label: "Rechercher toutes les lettres pouvant s'accrocher" },
  { id: "modele", label: "Chercher un modèle complet (_ = une lettre, * = suite libre) :", champ: "modele", ph: "ex. C_R_US ou CUR*" },
];

// Définition d'un mot (Wiktionnaire) — panneau sous le mot cliqué.
function Definition({ mot }) {
  const [etat, setEtat] = useState({ chargement: true });
  useEffect(() => {
    let actif = true;
    setEtat({ chargement: true });
    definir(mot).then((d) => actif && setEtat({ d })).catch((e) => actif && setEtat({ erreur: e.message || String(e) }));
    return () => { actif = false; };
  }, [mot]);
  if (etat.chargement) return <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Recherche de la définition…</div>;
  const lien = <a href={"https://fr.wiktionary.org/wiki/" + encodeURIComponent(etat.d?.titre || mot.toLowerCase())} target="_blank" rel="noreferrer" style={{ color: "#1D9E75" }}>Voir sur Wiktionnaire</a>;
  if (etat.erreur) return <div style={{ fontSize: 12, color: "#c0392b" }}>{etat.erreur} {lien}</div>;
  if (!etat.d.entrees.length) return <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Pas de définition trouvée pour « {etat.d.titre} ». {lien}</div>;
  return (
    <div style={{ fontSize: 12, lineHeight: 1.55, color: "var(--color-text-primary)" }}>
      {etat.d.entrees.map((e, i) => (
        <div key={i} style={{ marginBottom: 4 }}>
          <em style={{ color: "var(--color-text-secondary)" }}>{e.nature}</em>
          <ol style={{ margin: "2px 0 0 18px", padding: 0 }}>{e.definitions.map((x, j) => <li key={j}>{x}</li>)}</ol>
        </div>
      ))}
      {lien}
    </div>
  );
}

function MotSurligne({ mot, plateau = [] }) {
  return (
    <span style={{ letterSpacing: 1.5 }}>
      {[...mot].map((l, i) => (
        <span key={i} style={plateau.includes(i) ? { color: "#1a7fc1", fontWeight: 700, textDecoration: "underline" } : undefined}>{l}</span>
      ))}
    </span>
  );
}

// ─── 1. Solveur de mots ─────────────────────────────────────────────────────
function SolveurMots({ chevaletInitial }) {
  const [tirage, setTirage] = useState(chevaletInitial || "");
  const [mode, setMode] = useState("long");
  const [param, setParam] = useState({ accroche: "", motif: "", modele: "" });
  const [position, setPosition] = useState("indifferent");
  const [butoirs, setButoirs] = useState(true);
  const [inutilisees, setInutilisees] = useState(true);
  const [exact, setExact] = useState(false);
  const [filtres, setFiltres] = useState({ commence: "", finit: "", contient: "", min: "", max: "" });
  const [tri, setTri] = useState({ col: "score", sens: -1 });
  const [resultat, setResultat] = useState(null);
  const [affiches, setAffiches] = useState(100);
  const [ouvert, setOuvert] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  const lancer = async () => {
    setErreur(""); setOccupe(true); setOuvert(null); setAffiches(100);
    try {
      const { mots, ensemble } = await chargerListe();
      await new Promise((r) => setTimeout(r, 20));
      if (mode === "accrochables") {
        setResultat({ type: "accrochables", data: lettresAccrochables(mots, tirage), tirage });
      } else {
        const r = rechercher(mots, {
          mode, lettres: tirage, accroche: param.accroche, position, exact,
          motif: mode === "modele" ? param.modele : param.motif,
          commence: filtres.commence, finit: filtres.finit, contient: filtres.contient,
          min: parseInt(filtres.min, 10) || 2, max: parseInt(filtres.max, 10) || 15, limite: 2000,
        }, ensemble);
        setResultat({ type: "mots", ...r });
      }
    } catch (e) { setErreur(e.message || String(e)); }
    finally { setOccupe(false); }
  };

  const liste = useMemo(() => {
    if (resultat?.type !== "mots") return [];
    const l = [...resultat.liste];
    l.sort((a, b) => {
      const c = tri.col === "mot" ? a.mot.localeCompare(b.mot)
        : tri.col === "longueur" ? a.mot.length - b.mot.length || a.score - b.score
        : a.score - b.score || a.mot.length - b.mot.length;
      return (c || a.mot.localeCompare(b.mot)) * tri.sens * (tri.col === "mot" ? -1 : 1);
    });
    return l;
  }, [resultat, tri]);

  const entete = (col, label) => (
    <th onClick={() => setTri((t) => ({ col, sens: t.col === col ? -t.sens : (col === "mot" ? -1 : -1) }))}
        style={{ textAlign: "left", cursor: "pointer", fontSize: 12, padding: "4px 8px", color: "var(--color-text-secondary)", userSelect: "none" }}>
      {label}{tri.col === col ? (tri.sens < 0 ? " ▼" : " ▲") : ""}
    </th>
  );

  const texteExport = () => liste.map((x) => `${x.mot};${x.score};${x.reste}`).join("\n");
  const telecharger = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["mot;points;lettres non utilisées\n" + texteExport()], { type: "text/csv" }));
    a.download = "scrabble-mots.csv"; a.click();
  };

  const besoinTirage = mode !== "modele";

  return (
    <div style={carte}>
      <h2 style={titre}>Solveur de mots</h2>
      {besoinTirage && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>Tirage de lettres</label>
          <input value={tirage} onChange={(e) => setTirage(e.target.value.toUpperCase().slice(0, 15))} placeholder="ex. ABCDEFG ou LOSVEU?"
            style={{ ...champ, letterSpacing: 3, fontSize: 16, width: 220 }} />
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>joker : ? - ou *</span>
        </div>
      )}
      {MODES.map((m) => (
        <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
          <label style={{ ...etiquette, fontSize: 13, color: "var(--color-text-primary)", cursor: "pointer" }}>
            <input type="radio" name="mode-mots" checked={mode === m.id} onChange={() => setMode(m.id)} /> {m.label}
          </label>
          {m.champ && mode === m.id && (
            <input value={param[m.champ]} onChange={(e) => setParam({ ...param, [m.champ]: e.target.value.toUpperCase() })}
              placeholder={m.ph} style={{ ...champ, width: 170, letterSpacing: 2 }} />
          )}
        </div>
      ))}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "12px 0 6px", alignItems: "center" }}>
        {(mode === "raccrocher" || mode === "motif") && (
          <label style={etiquette}>Position {mode === "motif" ? "du motif" : "de la lettre ajoutée"} dans le mot
            <select value={position} onChange={(e) => setPosition(e.target.value)} style={champ}>
              <option value="indifferent">Indifférente / tout</option><option value="debut">Début</option>
              <option value="milieu">Milieu</option><option value="fin">Fin</option>
            </select>
          </label>
        )}
        {mode === "long" && <label style={etiquette}><input type="checkbox" checked={exact} onChange={(e) => setExact(e.target.checked)} /> Anagrammes (utiliser toutes les lettres)</label>}
        <label style={etiquette}><input type="checkbox" checked={butoirs} onChange={(e) => setButoirs(e.target.checked)} /> Marquer les mots butoirs |  (non prolongeables)</label>
        <label style={etiquette}><input type="checkbox" checked={inutilisees} onChange={(e) => setInutilisees(e.target.checked)} /> Afficher les lettres du tirage non utilisées</label>
      </div>
      <details style={{ marginBottom: 10 }}>
        <summary style={{ fontSize: 12, cursor: "pointer", color: "var(--color-text-secondary)" }}>Filtres supplémentaires (commence / finit / contient / longueur)</summary>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {[["commence", "Commence par"], ["finit", "Finit par"], ["contient", "Contient"], ["min", "Longueur min"], ["max", "Longueur max"]].map(([k, l]) => (
            <label key={k} style={{ ...etiquette, flexDirection: "column", alignItems: "flex-start" }}>{l}
              <input value={filtres[k]} onChange={(e) => setFiltres({ ...filtres, [k]: e.target.value.toUpperCase() })} style={{ ...champ, width: k === "min" || k === "max" ? 90 : 130 }} />
            </label>
          ))}
        </div>
      </details>
      <button style={bouton(!occupe)} disabled={occupe} onClick={lancer}>▶ Trouver les solutions</button>
      {erreur && <div style={{ color: "#c0392b", fontSize: 13, marginTop: 8 }}>{erreur}</div>}
      {mode === "accrochables" && <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 6 }}>Pour chaque lettre A–Z : mots utilisant tout le tirage + cette lettre. Lettre libre : choisis la plus utile sur le plateau.</div>}

      {resultat?.type === "accrochables" && (
        <div style={{ marginTop: 14 }}>
          {Object.keys(resultat.data).length === 0
            ? <div style={{ fontSize: 13 }}>Aucune lettre ne permet d'utiliser tout le tirage « {resultat.tirage} ».</div>
            : Object.keys(resultat.data).sort().map((l) => (
              <div key={l} style={{ fontSize: 13, marginBottom: 6, lineHeight: 1.6 }}>
                <b style={{ display: "inline-block", width: 22, color: "#1D9E75" }}>{l}</b>
                {resultat.data[l].length} mot{resultat.data[l].length > 1 ? "s" : ""} : {resultat.data[l].slice(0, 30).join(", ")}{resultat.data[l].length > 30 ? "…" : ""}
              </div>
            ))}
        </div>
      )}

      {resultat?.type === "mots" && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              {resultat.total} mot{resultat.total > 1 ? "s" : ""}{resultat.total > resultat.liste.length ? ` (${resultat.liste.length} affichés au maximum)` : ""}. Clique sur un mot pour sa définition, sur un en-tête pour trier. Points = lettres du tirage seulement, sans primes.
            </span>
            {liste.length > 0 && <>
              <button style={boutonClair} onClick={() => navigator.clipboard?.writeText(texteExport())}>⧉ Copier</button>
              <button style={boutonClair} onClick={telecharger}>⤓ CSV</button>
            </>}
          </div>
          {liste.length === 0 ? <div style={{ fontSize: 13 }}>Aucun mot trouvé.</div> : (
            <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 560 }}>
              <thead><tr>{entete("mot", "Mot")}{entete("score", "Points")}{entete("longueur", "Lettres")}{inutilisees && <th style={{ textAlign: "left", fontSize: 12, padding: "4px 8px", color: "var(--color-text-secondary)" }}>Non utilisées</th>}</tr></thead>
              <tbody>
                {liste.slice(0, affiches).map((x) => (
                  <Fragment key={x.mot}>
                    <tr onClick={() => setOuvert(ouvert === x.mot ? null : x.mot)} style={{ cursor: "pointer", borderTop: "0.5px solid var(--color-border-tertiary)", background: ouvert === x.mot ? "#1D9E7510" : "transparent" }}>
                      <td style={{ padding: "5px 8px", fontSize: 14 }}><MotSurligne mot={x.mot} plateau={x.plateau} />{butoirs && x.butoir ? <b style={{ marginLeft: 6, color: "#c0392b" }} title="Mot butoir : non prolongeable">|</b> : null}</td>
                      <td style={{ padding: "5px 8px", fontSize: 14, fontWeight: 600, color: "#1D9E75" }}>{x.score}</td>
                      <td style={{ padding: "5px 8px", fontSize: 12 }}>{x.mot.length}</td>
                      {inutilisees && <td style={{ padding: "5px 8px", fontSize: 12, letterSpacing: 2, color: "var(--color-text-secondary)" }}>{x.reste}</td>}
                    </tr>
                    {ouvert === x.mot && <tr><td colSpan={4} style={{ padding: "6px 10px 10px" }}><Definition mot={x.mot} /></td></tr>}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
          {liste.length > affiches && <button style={{ ...boutonClair, marginTop: 8 }} onClick={() => setAffiches(affiches + 200)}>Afficher plus</button>}
        </div>
      )}
    </div>
  );
}

// ─── 2. Dictionnaire ────────────────────────────────────────────────────────
function Dictionnaire() {
  const [mot, setMot] = useState("");
  const [res, setRes] = useState(null);
  const verifier = async () => {
    const m = normaliser(mot).replace(/[^A-Z]/g, "");
    if (!m) return;
    const { ensemble } = await chargerListe();
    setRes({ mot: m, valide: ensemble.has(m), points: scoreBrut(m) });
  };
  return (
    <div style={carte}>
      <h2 style={titre}>Dictionnaire de Scrabble — vérifier un mot</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={mot} onChange={(e) => setMot(e.target.value)} onKeyDown={(e) => e.key === "Enter" && verifier()} placeholder="Mot" style={{ ...champ, letterSpacing: 2, width: 220 }} />
        <button style={bouton(!!mot)} onClick={verifier}>Vérifier le mot</button>
      </div>
      {res && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 14, color: res.valide ? "#1D9E75" : "#c0392b", fontWeight: 600 }}>
            {res.mot} : {res.valide ? `présent dans la liste (${res.points} points bruts)` : "absent de la liste"}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "2px 0 8px" }}>
            Liste libre proche du Scrabble, pas l'ODS9 officiel : en cas de litige, la vérification de référence reste l'ODS.
          </div>
          <Definition mot={res.mot} />
        </div>
      )}
    </div>
  );
}

// ─── 3. Entraînement ────────────────────────────────────────────────────────
function Entrainement({ onTirage }) {
  const [tirage, setTirage] = useState("");
  const [lettre, setLettre] = useState("");
  return (
    <div style={carte}>
      <h2 style={titre}>Entraînement au Scrabble</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button style={bouton()} onClick={() => { const t = tirageAleatoire(7); setTirage(t); onTirage?.(t); }}>🎲 Tirage aléatoire de 7 lettres</button>
        <button style={boutonClair} onClick={() => setLettre(tirageAleatoire(1))}>Lettre aléatoire</button>
        {tirage && <span style={{ fontSize: 20, letterSpacing: 5, fontWeight: 700 }}>{tirage}</span>}
        {lettre && <span style={{ fontSize: 20, fontWeight: 700 }}>{lettre}</span>}
      </div>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 6 }}>Tirage pris dans le vrai sac de 102 tuiles (2 jokers). Le tirage est aussi copié dans « Solveur de mots ».</div>
    </div>
  );
}

// ─── 4. Compteur de points ──────────────────────────────────────────────────
const CYCLE = ["", "LD", "LT", "joker"];
function CompteurPoints() {
  const [mot, setMot] = useState("");
  const [etats, setEtats] = useState({}); // index → 0..3
  const [multMot, setMultMot] = useState(1);
  const [bingo, setBingo] = useState(false);
  const lettres = [...normaliser(mot).replace(/[^A-Z]/g, "")];
  const total = pointsMotPose(
    lettres.map((l, i) => ({ l, prime: CYCLE[etats[i] || 0] === "joker" ? "" : CYCLE[etats[i] || 0], joker: CYCLE[etats[i] || 0] === "joker" })),
    multMot, bingo,
  );
  return (
    <div style={carte}>
      <h2 style={titre}>Compteur de points</h2>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input value={mot} onChange={(e) => { setMot(e.target.value.toUpperCase()); setEtats({}); }} placeholder="Mot" style={{ ...champ, letterSpacing: 2, width: 200 }} />
        <label style={etiquette}>Prime mot
          <select value={multMot} onChange={(e) => setMultMot(Number(e.target.value))} style={champ}>
            <option value={1}>aucune</option><option value={2}>mot double ×2</option><option value={3}>mot triple ×3</option>
            <option value={4}>2 × mot double ×4</option><option value={6}>double + triple ×6</option><option value={9}>2 × mot triple ×9</option>
          </select>
        </label>
        <label style={etiquette}><input type="checkbox" checked={bingo} onChange={(e) => setBingo(e.target.checked)} /> 7 tuiles posées (+50)</label>
      </div>
      {lettres.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 4, margin: "12px 0 6px", flexWrap: "wrap" }}>
            {lettres.map((l, i) => {
              const e = CYCLE[etats[i] || 0];
              return (
                <button key={i} onClick={() => setEtats({ ...etats, [i]: ((etats[i] || 0) + 1) % 4 })} title="Cliquer pour changer : normale → lettre double → lettre triple → joker"
                  style={{ width: 44, padding: "6px 0", borderRadius: 6, border: "1px solid #b98a1a", background: e === "LD" ? "#a9d8f2" : e === "LT" ? "#1a7fc1" : e === "joker" ? "#eee" : "#f2b93b", color: e === "LT" ? "#fff" : "#111", cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 17, fontWeight: 700, fontStyle: e === "joker" ? "italic" : "normal" }}>{l}</div>
                  <div style={{ fontSize: 9 }}>{e === "joker" ? "joker 0" : `${pointsLettre(l)}${e ? " · " + e : ""}`}</div>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1D9E75" }}>{total} points</div>
        </>
      )}
    </div>
  );
}

// ─── 5. Compteur de lettres restantes ───────────────────────────────────────
function CompteurRestantes({ deLaGrille }) {
  const [jouees, setJouees] = useState("");
  const r = useMemo(() => lettresRestantes(jouees), [jouees]);
  return (
    <div style={carte}>
      <h2 style={titre}>Compteur de lettres restantes</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <input value={jouees} onChange={(e) => setJouees(e.target.value.toUpperCase())} placeholder="Lettres déjà jouées (espace = joker)" style={{ ...champ, letterSpacing: 2, flex: "1 1 320px" }} />
        <button style={boutonClair} onClick={() => setJouees(deLaGrille())}>Reprendre la grille + mon chevalet</button>
      </div>
      <div style={{ fontSize: 13, marginBottom: 6 }}>
        <b>{r.restantTotal}</b> tuile{r.restantTotal > 1 ? "s" : ""} encore dans le sac ou chez l'adversaire.
        {r.excedent.length > 0 && <span style={{ color: "#c0392b" }}> Trop de {r.excedent.map((x) => x.lettre === "?" ? "jokers" : x.lettre).join(", ")} saisis (vérifie ta saisie).</span>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {r.lignes.map(({ lettre, total, restant }) => (
          <div key={lettre} style={{ width: 52, textAlign: "center", padding: "4px 0", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)", opacity: restant === 0 ? 0.35 : 1, background: restant < 0 ? "#c0392b22" : "transparent" }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{lettre === "?" ? "★" : lettre}</div>
            <div style={{ fontSize: 12, color: "#1D9E75", fontWeight: 600 }}>{restant}<span style={{ color: "var(--color-text-secondary)", fontWeight: 400 }}>/{total}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OutilsMots({ chevalet, plateau }) {
  const [cle, setCle] = useState(0); // force le remplissage du tirage depuis l'entraînement
  const [tirage, setTirage] = useState(chevalet || "");
  const deLaGrille = () => {
    const posees = plateau.flat().filter(Boolean).map((x) => (x === x.toLowerCase() ? " " : x)).join("");
    return posees + (chevalet || "").replace(/\?/g, " ");
  };
  return (
    <>
      <SolveurMots key={cle} chevaletInitial={tirage} />
      <Dictionnaire />
      <Entrainement onTirage={(t) => { setTirage(t); setCle((c) => c + 1); }} />
      <CompteurPoints />
      <CompteurRestantes deLaGrille={deLaGrille} />
    </>
  );
}
