/**
 * CURSUS — « Au palmarès » (05/10/2026) : jeu de comparaison sur le Top 200 hebdomadaire des ventes de livres (Edistat, semaine 39,
 * 21–27 septembre 2026), et onglet « Le classement » (les 20 premiers). 10 manches : deux livres, une question (mieux classé,
 * dans le Top 200 depuis le plus longtemps, paru en premier, plus cher) ; la réponse révèle les valeurs des deux livres.
 * Données : public/jeux/palmares.json. Moteur : src/lib/jeuPalmares.js. Aucun appel IA.
 */
import { useState } from "react";
import { preparerManches, QUESTIONS, mention, fmtDate } from "../../lib/jeuPalmares.js";
import { carte, bouton, boutonClair, discret, EnTete, lireStats, noterPartie } from "./commun.jsx";

const onglet = (actif) => ({ padding: "7px 14px", borderRadius: 8, border: "0.5px solid var(--color-border-tertiary)", fontFamily: "inherit", fontSize: 13, cursor: "pointer", background: actif ? "#1D9E75" : "transparent", color: actif ? "#fff" : "var(--color-text-primary)" });

function Evol({ evo }) {
  if (evo === "E") return <span style={{ color: "#6b5ce7", fontWeight: 600 }}>entrée</span>;
  if (evo === "=") return <span style={discret}>=</span>;
  return <span style={{ color: evo.startsWith("+") ? "#1D9E75" : "#c0392b", fontWeight: 600 }}>{evo.startsWith("+") ? "↑" : "↓"} {evo.slice(1)}</span>;
}

export default function AuPalmares({ donnees }) {
  const p = donnees.palmares;
  const [vue, setVue] = useState("jeu");
  const [manches, setManches] = useState(null);
  const [i, setI] = useState(0);
  const [choix, setChoix] = useState(null); // "a" | "b" une fois répondu
  const [score, setScore] = useState(0);
  const [fini, setFini] = useState(false);
  const [stats, setStats] = useState(() => lireStats("palmares"));

  const commencer = () => { setManches(preparerManches(p.livres)); setI(0); setChoix(null); setScore(0); setFini(false); };
  const m = manches?.[i];
  const repondre = (c) => { if (choix) return; setChoix(c); if (c === m.bonne) setScore((s) => s + 1); };
  const suivant = () => {
    if (i + 1 >= manches.length) { setFini(true); setStats(noterPartie("palmares", { gagne: score >= Math.ceil(manches.length / 2), score })); return; }
    setI(i + 1); setChoix(null);
  };
  const periode = `semaine ${p.semaine} (du ${fmtDate(p.du)} au ${fmtDate(p.au)})`;

  const carteLivre = (cle) => {
    const l = m[cle], Q = QUESTIONS[m.type], bon = choix && m.bonne === cle, mauvais = choix === cle && m.bonne !== cle;
    return (
      <button key={cle} disabled={!!choix} onClick={() => repondre(cle)} style={{
        textAlign: "left", padding: "12px 14px", borderRadius: 10, fontFamily: "inherit", fontSize: 14, cursor: choix ? "default" : "pointer", minWidth: 0, width: "100%",
        border: "1px solid " + (bon ? "#1D9E75" : mauvais ? "#c0392b" : "var(--color-border-tertiary)"),
        background: bon ? "#1D9E7522" : mauvais ? "#c0392b22" : "var(--color-background-primary)", color: "var(--color-text-primary)",
      }}>
        <div style={{ fontWeight: 600 }}>{l.titre}</div>
        <div style={discret}>{l.auteur} · {l.segment} · {l.editeur}</div>
        {choix && <div style={{ marginTop: 6, fontSize: 15, fontWeight: 700, color: bon ? "#1D9E75" : "inherit" }}>{bon ? "✔ " : ""}{Q.montrer(l)}</div>}
      </button>
    );
  };

  return (
    <div>
      <EnTete titre="Au palmarès" sous={`Les vrais chiffres du Top 200 des ventes de livres en France, ${periode}. Les dates et les prix sont ceux de l'édition classée.`} />
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button style={onglet(vue === "jeu")} onClick={() => setVue("jeu")}>🎯 Jouer</button>
        <button style={onglet(vue === "classement")} onClick={() => setVue("classement")}>📊 Le classement</button>
      </div>
      {vue === "classement" ? (
        <div style={{ maxWidth: 560 }}>
          <div style={{ ...discret, marginBottom: 8 }}>Les 20 premiers du Top 200 — {periode}. Source : {p.source}. « Sem. » = nombre de semaines au classement ; « entrée » = entrée (ou retour) dans le Top 200 cette semaine.</div>
          {p.livres.slice(0, 20).map((l) => (
            <div key={l.rang + l.titre} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "0.5px solid var(--color-border-tertiary)", alignItems: "baseline" }}>
              <div style={{ width: 30, fontWeight: 700, textAlign: "right", flexShrink: 0 }}>{l.rang}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>{l.titre}</div>
                <div style={discret}>{l.auteur} · {l.segment} · {l.editeur}</div>
              </div>
              <div style={{ fontSize: 12, textAlign: "right", flexShrink: 0 }}><Evol evo={l.evo} /><div style={discret}>{l.sem} sem.</div></div>
            </div>
          ))}
        </div>
      ) : !manches ? (
        <div style={carte}>
          <div style={{ fontSize: 13, marginBottom: 10 }}>10 questions : deux livres du palmarès, tu devines lequel est le mieux classé, le plus ancien au classement, paru en premier ou le plus cher.</div>
          <button style={bouton()} onClick={commencer}>▶ Jouer</button>
          <div style={{ ...discret, marginTop: 8 }}>{stats.jouees} partie{stats.jouees > 1 ? "s" : ""} jouée{stats.jouees > 1 ? "s" : ""}{stats.record ? ` · record : ${stats.record} / 10` : ""}</div>
        </div>
      ) : fini ? (
        <div style={{ ...carte, maxWidth: 560 }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{score} sur {manches.length}</div>
          <div style={{ ...discret, marginBottom: 10 }}>{mention(score, manches.length)}</div>
          <button style={bouton()} onClick={commencer}>Rejouer</button>{" "}
          <button style={boutonClair()} onClick={() => setVue("classement")}>Voir le classement</button>
        </div>
      ) : (
        <div style={{ maxWidth: 560 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            <span>Question {i + 1} / {manches.length}</span><span>{score} pt{score > 1 ? "s" : ""}</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 10 }}>{QUESTIONS[m.type].texte}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>{carteLivre("a")}{carteLivre("b")}</div>
          {choix && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: choix === m.bonne ? "#1D9E75" : "#c0392b" }}>{choix === m.bonne ? "Bien vu !" : "Raté, c'était l'autre."}</div>
              <button style={bouton()} onClick={suivant}>{i + 1 >= manches.length ? "Voir mon score" : "Question suivante →"}</button>
            </>
          )}
        </div>
      )}
      <div style={{ ...discret, marginTop: 14, fontSize: 11 }}>Source : {p.source}, {periode}. Données saisies le {fmtDate(p.saisi)}.</div>
    </div>
  );
}
