/**
 * CURSUS — « Devine le livre » (05/10/2026) : 10 livres, 5 indices dévoilés un par un (du plus vague au plus parlant),
 * 4 titres au choix. Bonne réponse = 6 − (nombre d'indices affichés) points ; une mauvaise réponse dévoile l'indice
 * suivant. Après chaque livre : la fiche (auteur, année, palmarès, résumé). Moteur : src/lib/jeuLivres.js.
 */
import { useState } from "react";
import { preparerManches, pointsPour, mention, NB_MANCHES } from "../../lib/jeuLivres.js";
import { carte, bouton, boutonClair, discret, EnTete, lireStats, noterPartie } from "./commun.jsx";

export function FicheLivre({ livre }) {
  return (
    <div style={carte}>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{livre.titre}</div>
      <div style={{ ...discret, marginBottom: 6 }}>{livre.auteur} · {livre.annee} · {livre.pays}</div>
      <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 6 }}>{livre.pitch}</div>
      <div style={discret}>{livre.genre} — {livre.lieu}</div>
      <div style={{ ...discret, marginTop: 6, fontStyle: "italic" }}>{livre.palmares}</div>
    </div>
  );
}

export default function DevineLeLivre({ donnees }) {
  const [manches, setManches] = useState(null);
  const [i, setI] = useState(0);
  const [nbIndices, setNbIndices] = useState(1);
  const [faux, setFaux] = useState([]); // ids déjà essayés à tort
  const [issue, setIssue] = useState(null); // null | { gagne, points }
  const [resultats, setResultats] = useState([]); // [{ livre, gagne, points }]
  const [fini, setFini] = useState(false);
  const [stats, setStats] = useState(() => lireStats("livres"));

  const commencer = () => { setManches(preparerManches(donnees.livres)); setI(0); setNbIndices(1); setFaux([]); setIssue(null); setResultats([]); setFini(false); };
  const manche = manches?.[i];
  const score = resultats.reduce((s, r) => s + r.points, 0);
  const terminer = (res) => {
    setFini(true);
    const total = res.reduce((s, r) => s + r.points, 0), trouves = res.filter((r) => r.gagne).length;
    setStats(noterPartie("livres", { gagne: trouves >= Math.ceil(res.length / 2), score: total }));
  };

  const choisir = (livre) => {
    if (issue || faux.includes(livre.id)) return;
    if (livre.id === manche.livre.id) { setIssue({ gagne: true, points: pointsPour(nbIndices) }); return; }
    setFaux([...faux, livre.id]);
    if (nbIndices < 5) setNbIndices(nbIndices + 1);
  };
  const abandonner = () => setIssue({ gagne: false, points: 0 });
  const suivant = () => {
    const res = [...resultats, { livre: manche.livre, ...issue }];
    setResultats(res);
    if (i + 1 >= manches.length) { terminer(res); return; }
    setI(i + 1); setNbIndices(1); setFaux([]); setIssue(null);
  };

  return (
    <div>
      <EnTete titre="Devine le livre" sous="Cinq indices dévoilés un par un : plus tu devines tôt, plus tu marques de points. Les fiches sont écrites pour Cursus, à partir de livres qui se sont bien vendus en France et en Belgique." />
      {!manches ? (
        <div style={carte}>
          <button style={bouton()} onClick={commencer}>▶ Jouer ({Math.min(NB_MANCHES, donnees.livres.length)} livres)</button>
          <div style={{ ...discret, marginTop: 8 }}>{stats.jouees} partie{stats.jouees > 1 ? "s" : ""} jouée{stats.jouees > 1 ? "s" : ""}{stats.record ? ` · record : ${stats.record} points` : ""}</div>
        </div>
      ) : fini ? (
        <div style={{ maxWidth: 560 }}>
          <div style={carte}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{score} points sur {resultats.length * 5}</div>
            <div style={{ fontSize: 13, marginBottom: 4 }}>{resultats.filter((r) => r.gagne).length} livre{resultats.filter((r) => r.gagne).length > 1 ? "s" : ""} trouvé{resultats.filter((r) => r.gagne).length > 1 ? "s" : ""} sur {resultats.length}.</div>
            <div style={{ ...discret, marginBottom: 10 }}>{mention(score, resultats.length)}</div>
            <button style={bouton()} onClick={commencer}>Rejouer</button>
          </div>
          {resultats.map((r) => (
            <div key={r.livre.id} style={{ ...carte, padding: "10px 14px", marginBottom: 8, opacity: r.gagne ? 1 : 0.8 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{r.gagne ? "✔" : "✘"} {r.livre.titre} <span style={{ fontWeight: 400 }}>— {r.livre.auteur}</span>{r.gagne ? ` (+${r.points})` : ""}</div>
              <div style={{ ...discret, marginTop: 2 }}>{r.livre.pitch}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ maxWidth: 560 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            <span>Livre {i + 1} / {manches.length}</span><span>{score} pt{score > 1 ? "s" : ""}</span>
          </div>
          <div style={{ ...carte, padding: "12px 14px" }}>
            {manche.livre.indices.slice(0, issue ? 5 : nbIndices).map((ind, k) => (
              <div key={k} style={{ fontSize: 14, lineHeight: 1.45, padding: "6px 0", borderBottom: k < (issue ? 4 : nbIndices - 1) ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                <b style={{ color: "#1D9E75" }}>{k + 1}.</b> {ind}
              </div>
            ))}
            {!issue && <div style={{ ...discret, marginTop: 6 }}>Indice {nbIndices} sur 5 — bonne réponse maintenant : {pointsPour(nbIndices)} point{pointsPour(nbIndices) > 1 ? "s" : ""}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "10px 0" }}>
            {manche.choix.map((l) => {
              const mauvais = faux.includes(l.id), bon = issue && l.id === manche.livre.id;
              return (
                <button key={l.id} disabled={!!issue || mauvais} onClick={() => choisir(l)} style={{
                  textAlign: "left", padding: "10px 12px", borderRadius: 8, fontFamily: "inherit", fontSize: 14, cursor: issue || mauvais ? "default" : "pointer",
                  border: "0.5px solid " + (bon ? "#1D9E75" : mauvais ? "#c0392b" : "var(--color-border-tertiary)"),
                  background: bon ? "#1D9E7522" : "var(--color-background-primary)", color: "var(--color-text-primary)", opacity: mauvais ? 0.45 : 1,
                  textDecoration: mauvais ? "line-through" : "none", minWidth: 0,
                }}>
                  {l.titre} <span style={{ ...discret, display: "block" }}>{l.auteur}</span>
                </button>
              );
            })}
          </div>
          {issue ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: issue.gagne ? "#1D9E75" : "#c0392b" }}>{issue.gagne ? `Bravo ! +${issue.points} point${issue.points > 1 ? "s" : ""}` : "C'était :"}</div>
              <FicheLivre livre={manche.livre} />
              <button style={bouton()} onClick={suivant}>{i + 1 >= manches.length ? "Voir mon score" : "Livre suivant →"}</button>
            </>
          ) : (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {nbIndices < 5 && <button style={boutonClair()} onClick={() => setNbIndices(nbIndices + 1)}>💡 Un indice de plus (−1 point)</button>}
              <button style={boutonClair()} onClick={abandonner}>Je passe</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
