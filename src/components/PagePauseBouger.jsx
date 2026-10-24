/**
 * CURSUS — Page « Pauses bien-être » (24/10/2026) : réglages du rappel (activé, intervalle), pause express à la demande, liste des
 * mouvements à essayer un par un, compteur de pauses. Les réglages sont ceux de PauseBouger.jsx (localStorage).
 */
import { useState, useEffect } from "react";
import { lireReglages, ecrireReglages, pausesDuJour, pausesSurSemaine, CHOIX_MINUTES } from "../lib/pauseBouger.js";
import { EXERCICES, AVERTISSEMENT } from "../lib/exercicesPause.js";

const carte = { background: "var(--color-background-primary, #fff)", border: "0.5px solid var(--color-border-tertiary, #ddd)", borderRadius: 12, padding: "14px 16px", marginBottom: 14 };
const bouton = (principal) => ({ border: principal ? "none" : "0.5px solid var(--color-border-tertiary, #ccc)", background: principal ? "#1D9E75" : "transparent", color: principal ? "#fff" : "inherit", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: "pointer" });

export default function PagePauseBouger() {
  const [r, setR] = useState(lireReglages);
  useEffect(() => { const maj = () => setR(lireReglages()); window.addEventListener("cursus-pause-reglages", maj); return () => window.removeEventListener("cursus-pause-reglages", maj); }, []);
  const lancer = (ids) => window.dispatchEvent(new CustomEvent("cursus-pause-demarrer", { detail: { ids } }));
  return (
    <div style={{ flex: 1, minWidth: 0, overflowY: "auto", overflowX: "hidden", padding: "20px 20px 60px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h2 style={{ fontSize: 20, fontWeight: 500, margin: "0 0 6px" }}>🧘 Pauses bien-être</h2>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--color-text-secondary, #666)", marginBottom: 14 }}>Quand on écrit, on ne voit pas le temps passer. Cursus peut te proposer, de temps en temps, une pause de deux minutes avec des mouvements doux, à faire sur ta chaise.</div>

        <div style={carte}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, marginBottom: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={r.actif} onChange={(e) => ecrireReglages({ actif: e.target.checked })} style={{ width: 18, height: 18 }} />
            Me proposer une pause quand je reste longtemps devant Cursus
          </label>
          <label style={{ fontSize: 13 }}>Toutes les{" "}
            <select value={r.minutes} disabled={!r.actif} onChange={(e) => ecrireReglages({ minutes: Number(e.target.value) })} style={{ padding: "6px 8px", fontFamily: "inherit", fontSize: 13, borderRadius: 6, border: "0.5px solid var(--color-border-tertiary, #ccc)" }}>
              {(CHOIX_MINUTES.includes(r.minutes) ? CHOIX_MINUTES : [...CHOIX_MINUTES, r.minutes]).map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>{" "}d'activité
          </label>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--color-text-secondary, #666)", marginTop: 10 }}>Le rappel attend un petit silence : il ne t'interrompt jamais en pleine phrase. Deux minutes sans toucher l'écran ne comptent plus ; cinq minutes remettent le compteur à zéro. Ces réglages restent sur cet appareil.</div>
        </div>

        <div style={carte}>
          <div style={{ fontSize: 14, marginBottom: 10 }}><b>{pausesDuJour(r)}</b> pause{pausesDuJour(r) > 1 ? "s" : ""} aujourd'hui · <b>{pausesSurSemaine(r)}</b> sur les 7 derniers jours</div>
          <button style={bouton(true)} onClick={() => lancer()}>🌿 Faire une pause maintenant (2 min)</button>
        </div>

        <div style={{ fontSize: 14, fontWeight: 600, margin: "6px 0 8px" }}>Les mouvements</div>
        {EXERCICES.map((e) => (
          <div key={e.id} style={{ ...carte, padding: "10px 14px", marginBottom: 8, display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{e.titre}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary, #666)" }}>environ {e.duree} secondes</div>
            </div>
            <button style={bouton(false)} onClick={() => lancer([e.id])}>Essayer</button>
          </div>
        ))}
        <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--color-text-secondary, #666)", marginTop: 12 }}>{AVERTISSEMENT}</div>
      </div>
    </div>
  );
}
