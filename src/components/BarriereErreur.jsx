/**
 * Barrière d'erreur (26/11/2026) : si une fenêtre (Aide, Question rapide…) plante au rendu, on affiche un message
 * avec un bouton « Fermer » au lieu d'une page blanche impossible à quitter.
 */
import { Component } from "react";
import { journaliserErreur } from "../lib/journalErreurs.js";

export default class BarriereErreur extends Component {
  state = { erreur: null };
  static getDerivedStateFromError(erreur) { return { erreur }; }
  componentDidCatch(erreur) {
    try { journaliserErreur?.(`BarriereErreur:${this.props.nom || "fenêtre"}`, erreur?.message || String(erreur)); } catch { /* journal indisponible */ }
  }
  render() {
    if (!this.state.erreur) return this.props.children;
    return (
      <div role="alert" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ background: "#fff", color: "#222", borderRadius: 10, padding: 16, maxWidth: 360, fontSize: 14, lineHeight: 1.5 }}>
          <b>Cette fenêtre a rencontré un problème.</b>
          <div style={{ color: "#666", marginTop: 6, fontSize: 12.5 }}>Votre travail n'est pas touché. L'erreur a été notée.</div>
          <button type="button" onClick={() => { this.setState({ erreur: null }); this.props.onFermer?.(); }}
            style={{ marginTop: 12, padding: "6px 14px", border: "1px solid #7F77DD", background: "#fff", color: "#534AB7", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>Fermer</button>
        </div>
      </div>
    );
  }
}
