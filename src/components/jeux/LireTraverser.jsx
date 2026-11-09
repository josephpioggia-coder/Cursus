/**
 * CURSUS — « Lire pour traverser » (09/11/2026) : jeux autour de livres sur la maladie, la fin de vie et le deuil.
 * Idée de Joseph, à partir d'une sélection éditoriale lue en ligne : seuls les FAITS (titre, auteur, genre) sont repris,
 * les résumés et indices sont réécrits pour Cursus. Deux jeux : « Devine le livre » (7 fiches à 5 indices, réutilise
 * DevineLeLivre) et « Auteurs et genres » (15 livres). Sujet sensible : avertissement, aucun chronomètre, on peut passer.
 * Moteur : src/lib/jeuLectures.js ; données : public/jeux/lectures-deuil.json.
 */
import { useState, useEffect } from "react";
import { chargerLectures, avecIndices, preparerQuestions, mention, mentionQuiz, NB_QUESTIONS } from "../../lib/jeuLectures.js";
import DevineLeLivre from "./DevineLeLivre.jsx";
import { carte, bouton, boutonClair, discret, EnTete, lireStats, noterPartie } from "./commun.jsx";

const CLE = "lectures";

function AuteursEtGenres({ livres }) {
  const [qs, setQs] = useState(null);
  const [i, setI] = useState(0);
  const [reponse, setReponse] = useState(null); // id choisi
  const [score, setScore] = useState(0);
  const [fini, setFini] = useState(false);
  const [stats, setStats] = useState(() => lireStats(CLE + "-quiz"));

  const commencer = () => { setQs(preparerQuestions(livres)); setI(0); setReponse(null); setScore(0); setFini(false); };
  const q = qs?.[i];
  const choisir = (c) => { if (reponse) return; setReponse(c.id); if (c.id === q.bonne) setScore(score + 1); };
  const suivant = () => {
    if (i + 1 >= qs.length) {
      setFini(true);
      setStats(noterPartie(CLE + "-quiz", { gagne: score >= Math.ceil(qs.length / 2), score }));
      return;
    }
    setI(i + 1); setReponse(null);
  };

  return (
    <div>
      <EnTete titre="Auteurs et genres" sous={`Qui a écrit quoi, et dans quelle catégorie ranger chaque livre ? ${livres.length} ouvrages sur la maladie, la fin de vie et le deuil.`} />
      {!qs ? (
        <div style={carte}>
          <button style={bouton()} onClick={commencer}>▶ Jouer ({Math.min(NB_QUESTIONS, livres.length)} questions)</button>
          <div style={{ ...discret, marginTop: 8 }}>{stats.jouees} partie{stats.jouees > 1 ? "s" : ""} jouée{stats.jouees > 1 ? "s" : ""}{stats.record ? ` · record : ${stats.record} / ${NB_QUESTIONS}` : ""}</div>
        </div>
      ) : fini ? (
        <div style={{ maxWidth: 560 }}>
          <div style={carte}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{score} bonne{score > 1 ? "s" : ""} réponse{score > 1 ? "s" : ""} sur {qs.length}</div>
            <div style={{ ...discret, marginBottom: 10 }}>{mentionQuiz(score, qs.length)}</div>
            <button style={bouton()} onClick={commencer}>Rejouer</button>
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 560 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            <span>Question {i + 1} / {qs.length}</span><span>{score} pt{score > 1 ? "s" : ""}</span>
          </div>
          <div style={{ ...carte, padding: "12px 14px", fontSize: 15, lineHeight: 1.45 }}>{q.texte}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "10px 0" }}>
            {q.choix.map((c) => {
              const bon = reponse && c.id === q.bonne, mauvais = reponse === c.id && c.id !== q.bonne;
              return (
                <button key={c.id} disabled={!!reponse} onClick={() => choisir(c)} style={{
                  textAlign: "left", padding: "10px 12px", borderRadius: 8, fontFamily: "inherit", fontSize: 14, cursor: reponse ? "default" : "pointer", minWidth: 0,
                  border: "0.5px solid " + (bon ? "#1D9E75" : mauvais ? "#c0392b" : "var(--color-border-tertiary)"),
                  background: bon ? "#1D9E7522" : "var(--color-background-primary)", color: "var(--color-text-primary)",
                  opacity: reponse && !bon && !mauvais ? 0.5 : 1,
                }}>{c.label}</button>
              );
            })}
          </div>
          {reponse && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: reponse === q.bonne ? "#1D9E75" : "#c0392b" }}>{reponse === q.bonne ? "Bravo !" : "Pas tout à fait."}</div>
              <div style={carte}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{q.livre.titre}</div>
                <div style={{ ...discret, marginBottom: 6 }}>{q.livre.auteur} · {q.livre.genre}</div>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>{q.livre.pitch}</div>
              </div>
              <button style={bouton()} onClick={suivant}>{i + 1 >= qs.length ? "Voir mon score" : "Question suivante →"}</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function LireTraverser() {
  const [livres, setLivres] = useState(null);
  const [erreur, setErreur] = useState("");
  const [mode, setMode] = useState(null); // null | "devine" | "quiz"
  useEffect(() => { chargerLectures().then(setLivres).catch((e) => setErreur(e.message || String(e))); }, []);

  if (erreur) return <div style={{ ...carte, color: "#c0392b" }}>{erreur}</div>;
  if (!livres) return <div style={discret}>Chargement…</div>;

  if (mode) {
    return (
      <div>
        <button onClick={() => setMode(null)} style={{ background: "transparent", border: "none", color: "#1D9E75", fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: 10 }}>← Lire pour traverser</button>
        {mode === "devine"
          ? <DevineLeLivre donnees={{ livres: avecIndices(livres) }} titre="Devine le livre — lectures de la maladie et du deuil" sous={`Cinq indices dévoilés un par un : plus tu devines tôt, plus tu marques de points. ${avecIndices(livres).length} livres, romans, récits et enquêtes.`} cleStats={CLE} mentionFn={mention} />
          : <AuteursEtGenres livres={livres} />}
      </div>
    );
  }
  return (
    <div>
      <EnTete titre="Lire pour traverser" sous="Des livres qui parlent de la maladie, de la fin de vie et du deuil : romans, enquêtes, témoignages, philosophie." />
      <div style={{ ...carte, fontSize: 13, lineHeight: 1.5 }}>
        Ce thème touche à des sujets sensibles. Joue à ton rythme : il n'y a pas de chronomètre, et tu peux passer une question à tout moment.
      </div>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))" }}>
        <button style={{ ...carte, cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: "var(--color-text-primary)", margin: 0 }} onClick={() => setMode("devine")}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>🔎 Devine le livre</div>
          <div style={discret}>Cinq indices, {avecIndices(livres).length} livres à retrouver.</div>
        </button>
        <button style={{ ...carte, cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: "var(--color-text-primary)", margin: 0 }} onClick={() => setMode("quiz")}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>✍️ Auteurs et genres</div>
          <div style={discret}>Qui a écrit quoi ? Roman, témoignage, essai ou philosophie ?</div>
        </button>
      </div>
    </div>
  );
}
