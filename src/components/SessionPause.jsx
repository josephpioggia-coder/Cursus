/**
 * CURSUS — Séance de pause guidée (24/10/2026) : une suite de mouvements (pause express de 3, ou un seul pris dans la page « Pauses
 * bien-être »), chacun avec sa figure animée, sa consigne et un décompte. Plein écran, sans effet sur le texte en cours.
 */
import { useState, useEffect } from "react";
import FigureChaise from "./FigureChaise.jsx";
import { AVERTISSEMENT } from "../lib/exercicesPause.js";

const fond = { position: "fixed", inset: 0, zIndex: 100, background: "rgba(14,20,28,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12, overflowY: "auto" };
const carte = { background: "#ffffff", color: "#1b2733", borderRadius: 16, padding: "16px 16px 14px", width: "100%", maxWidth: 440, boxShadow: "0 10px 40px rgba(0,0,0,0.4)", fontFamily: "inherit" };
const btn = (principal) => ({ border: principal ? "none" : "1px solid #c8d3cd", background: principal ? "#1D9E75" : "#fff", color: principal ? "#fff" : "#1b2733", borderRadius: 10, padding: "11px 16px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" });

/** @param exercices liste d'exercices (voir exercicesPause.js) ; @param onFin(terminee) appelée à la fermeture */
export default function SessionPause({ exercices, onFin, pausesAujourdhui = 0 }) {
  const [i, setI] = useState(0);
  const [reste, setReste] = useState(exercices[0].duree);
  const [fini, setFini] = useState(false);
  const ex = exercices[i];

  useEffect(() => {
    if (fini) return;
    setReste(exercices[i].duree);
    const t = setInterval(() => setReste((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [i, fini, exercices]);

  const suivant = () => { if (i + 1 >= exercices.length) setFini(true); else setI(i + 1); };

  return (
    <div style={fond} role="dialog" aria-modal="true" aria-label="Pause bien-être">
      <div style={carte}>
        {fini ? (
          <>
            <div style={{ fontSize: 40, textAlign: "center" }}>🌿</div>
            <div style={{ fontSize: 19, fontWeight: 700, textAlign: "center", margin: "4px 0 6px" }}>Belle pause !</div>
            <div style={{ fontSize: 14, textAlign: "center", lineHeight: 1.5, marginBottom: 12 }}>{pausesAujourdhui + 1 > 1 ? `Déjà ${pausesAujourdhui + 1} pauses aujourd'hui.` : "Première pause de la journée."} Ton texte t'attend, tu reprends avec les idées plus claires.</div>
            <div style={{ fontSize: 11.5, color: "#5d6b66", lineHeight: 1.45, marginBottom: 14 }}>{AVERTISSEMENT}</div>
            <button style={{ ...btn(true), width: "100%" }} onClick={() => onFin(true)}>Reprendre l'écriture</button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5d6b66", marginBottom: 6 }}>
              <span>Mouvement {i + 1} / {exercices.length}</span><span>{reste > 0 ? `${reste} s` : "à ton rythme"}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: "#dfe8e3", marginBottom: 10 }}><div style={{ height: 4, borderRadius: 2, background: "#1D9E75", width: `${((ex.duree - reste) / ex.duree) * 100}%`, transition: "width 1s linear" }} /></div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{ex.titre}</div>
            <FigureChaise pose={ex.pose} pas={ex.pas} />
            <div style={{ fontSize: 14, lineHeight: 1.5, margin: "10px 0 14px" }}>{ex.consigne}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...btn(reste === 0), flex: 1 }} onClick={suivant}>{i + 1 >= exercices.length ? "Terminer" : "Mouvement suivant →"}</button>
              <button style={btn(false)} onClick={() => onFin(false)}>Arrêter</button>
            </div>
            <div style={{ fontSize: 11, color: "#6b7a74", marginTop: 8, lineHeight: 1.4 }}>Doucement, sans forcer. Arrête-toi au moindre inconfort.</div>
          </>
        )}
      </div>
    </div>
  );
}
