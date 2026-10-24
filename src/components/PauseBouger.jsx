/**
 * CURSUS — Pauses « bouger » : minuteur discret + bandeau d'invitation + séance guidée (24/10/2026, idée de Joseph).
 * Monté une fois dans l'app connectée. Compte le temps d'activité RÉEL (gestes dans la page, onglet visible), voir src/lib/pauseBouger.js :
 * 2 minutes sans geste ne comptent plus, 5 minutes sans geste = pause réelle (compteur à zéro). L'invitation attend un silence de
 * quelques secondes (jamais en pleine phrase) et ne vole ni le focus ni le curseur. Réglages et compteur : localStorage, par appareil.
 * Cursus ne peut pas savoir si l'on s'est vraiment levé : c'est une invitation, pas une mesure.
 */
import { useState, useEffect, useRef } from "react";
import { lireReglages, ecrireReglages, noterPause, pausesDuJour, avancer, doitInviter } from "../lib/pauseBouger.js";
import { pauseExpress, exercice } from "../lib/exercicesPause.js";
import SessionPause from "./SessionPause.jsx";

const GESTES = ["keydown", "pointerdown", "pointermove", "touchstart", "wheel", "scroll"];

export default function PauseBouger() {
  const [reglages, setReglages] = useState(lireReglages);
  const [bandeau, setBandeau] = useState(null); // { minutes }
  const [seance, setSeance] = useState(null);   // { exercices }
  const etat = useRef({ actifSec: 0, derniere: Date.now(), snooze: 0 });

  useEffect(() => {
    const maj = () => setReglages(lireReglages());
    const demarrer = (e) => { const ids = e.detail?.ids; setBandeau(null); setSeance({ exercices: ids?.length ? ids.map(exercice).filter(Boolean) : pauseExpress() }); };
    window.addEventListener("cursus-pause-reglages", maj);
    window.addEventListener("cursus-pause-demarrer", demarrer);
    return () => { window.removeEventListener("cursus-pause-reglages", maj); window.removeEventListener("cursus-pause-demarrer", demarrer); };
  }, []);

  useEffect(() => {
    if (!reglages.actif) { setBandeau(null); return; }
    const geste = () => { etat.current.derniere = Date.now(); };
    GESTES.forEach((g) => window.addEventListener(g, geste, { passive: true, capture: true }));
    const tic = setInterval(() => {
      if (seance) return; // pendant une séance on ne compte rien
      const e = etat.current, maintenant = Date.now(), idle = (maintenant - e.derniere) / 1000;
      e.actifSec = avancer(e.actifSec, idle, !document.hidden);
      if (!bandeau && doitInviter({ actifSec: e.actifSec, idleSec: idle, minutes: reglages.minutes, snoozeJusqua: e.snooze, maintenant })) setBandeau({ minutes: Math.max(1, Math.round(e.actifSec / 60)) });
    }, 1000);
    return () => { GESTES.forEach((g) => window.removeEventListener(g, geste, { capture: true })); clearInterval(tic); };
  }, [reglages.actif, reglages.minutes, seance, bandeau]);

  const fin = (terminee) => {
    if (terminee) noterPause();
    etat.current.actifSec = 0; etat.current.derniere = Date.now();
    setSeance(null);
  };

  if (seance) return <SessionPause exercices={seance.exercices} pausesAujourdhui={pausesDuJour(lireReglages())} onFin={fin} />;
  if (!reglages.actif || !bandeau) return null;
  const bouton = (principal) => ({ border: principal ? "none" : "1px solid #c8d3cd", background: principal ? "#1D9E75" : "#fff", color: principal ? "#fff" : "#1b2733", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" });
  return (
    <div role="status" style={{ position: "fixed", left: 12, right: 12, bottom: 12, margin: "0 auto", maxWidth: 520, zIndex: 90, background: "#ffffff", color: "#1b2733", border: "1px solid #b9d8cb", borderRadius: 14, padding: "12px 14px", boxShadow: "0 6px 24px rgba(0,0,0,0.35)", fontFamily: "inherit" }}>
      <div style={{ fontSize: 14, lineHeight: 1.45, marginBottom: 10 }}>🌿 <b>Tu es devant Cursus depuis environ {bandeau.minutes} minute{bandeau.minutes > 1 ? "s" : ""}.</b> Une petite pause de 2 minutes pour bouger ?</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button style={bouton(true)} onClick={() => window.dispatchEvent(new CustomEvent("cursus-pause-demarrer"))}>Oui, on y va</button>
        <button style={bouton(false)} onClick={() => { etat.current.snooze = Date.now() + 10 * 60000; setBandeau(null); }}>Dans 10 min</button>
        <button style={bouton(false)} onClick={() => { etat.current.actifSec = 0; setBandeau(null); }}>Pas maintenant</button>
      </div>
      <div style={{ marginTop: 8, fontSize: 11.5 }}>
        <span onClick={() => { ecrireReglages({ actif: false }); setBandeau(null); }} style={{ color: "#5d6b66", textDecoration: "underline", cursor: "pointer" }}>Ne plus me proposer de pauses</span>
        <span style={{ color: "#9aa7a1" }}> · réglable dans « Pauses bien-être »</span>
      </div>
    </div>
  );
}
