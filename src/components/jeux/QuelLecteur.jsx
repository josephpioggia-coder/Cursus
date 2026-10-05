/**
 * CURSUS — « Quel lecteur es-tu ? » (05/10/2026) : 8 questions de goûts (pas de bonne ou mauvaise réponse), puis trois
 * livres du catalogue qui te ressemblent, avec le résumé et ce qui vous rapproche. Moteur : calculerAffinites()
 * (src/lib/jeuLivres.js). Gratuit : aucun appel IA.
 */
import { useState } from "react";
import { QUESTIONS, calculerAffinites } from "../../lib/jeuLivres.js";
import { carte, bouton, boutonClair, discret, EnTete } from "./commun.jsx";

export default function QuelLecteur({ donnees }) {
  const [rep, setRep] = useState(null); // null = pas commencé ; tableau d'indices d'option
  const [fini, setFini] = useState(false);
  const q = rep && !fini ? QUESTIONS[rep.length] : null;

  const repondre = (k) => { const n = [...rep, k]; setRep(n); if (n.length >= QUESTIONS.length) setFini(true); };
  const retour = () => setRep(rep.slice(0, -1));
  const recommencer = () => { setRep([]); setFini(false); };
  const resultats = fini ? calculerAffinites(rep, donnees.livres) : [];

  return (
    <div>
      <EnTete titre="Quel lecteur es-tu ?" sous="Huit questions sur tes goûts, aucune mauvaise réponse. À la fin, trois livres qui te ressemblent." />
      {!rep ? (
        <div style={carte}><button style={bouton()} onClick={recommencer}>▶ Commencer</button></div>
      ) : fini ? (
        <div style={{ maxWidth: 560 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Tes trois livres :</div>
          {resultats.map((r, k) => (
            <div key={r.livre.id} style={carte}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                <div style={{ fontSize: 16, fontWeight: 600, minWidth: 0 }}>{k + 1}. {r.livre.titre}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1D9E75", flexShrink: 0 }}>{r.pct} %</div>
              </div>
              <div style={{ ...discret, marginBottom: 6 }}>{r.livre.auteur} · {r.livre.annee} · {r.livre.genre}</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 6 }}>{r.livre.pitch}</div>
              {r.communs.length > 0 && <div style={{ fontSize: 12.5, marginBottom: 4 }}><b>Ce qui vous rapproche :</b> {r.communs.join(", ")}.</div>}
              <div style={{ ...discret, fontStyle: "italic" }}>{r.livre.palmares}</div>
            </div>
          ))}
          <button style={bouton()} onClick={recommencer}>Refaire le test</button>
        </div>
      ) : (
        <div style={{ maxWidth: 560 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Question {rep.length + 1} / {QUESTIONS.length}</div>
          <div style={{ height: 4, borderRadius: 2, background: "var(--color-border-tertiary)", marginBottom: 14 }}>
            <div style={{ height: 4, borderRadius: 2, background: "#1D9E75", width: `${(rep.length / QUESTIONS.length) * 100}%` }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 12 }}>{q.texte}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {q.options.map((o, k) => (
              <button key={k} onClick={() => repondre(k)} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 10, fontFamily: "inherit", fontSize: 14, cursor: "pointer", border: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", minWidth: 0 }}>{o.label}</button>
            ))}
          </div>
          {rep.length > 0 && <button style={boutonClair()} onClick={retour}>← Question précédente</button>}
        </div>
      )}
    </div>
  );
}
