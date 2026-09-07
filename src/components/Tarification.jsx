/**
 * CURSUS — Page de tarification (dans le shell applicatif, un espace actif)
 * ================================
 * Affiche les 5 paliers CursEdit (toggle mensuel/annuel). La bannière de
 * contexte ("CursAudit se facture à l'acte...") vit dans App.jsx, qui
 * enveloppe ce composant — elle a besoin de setVue pour son bouton
 * "Voir CursAudit →", propre au shell applicatif.
 *
 * 07/09/2026 — le contenu des paliers et la logique de paiement ont été
 * déplacés vers src/lib/contenuPaliers.js et le rendu de la grille vers
 * GrillePaliers.jsx, pour être réutilisés tels quels par PageLancement.jsx
 * (page de lancement autonome, hors shell applicatif) sans dupliquer la
 * logique de paiement réel (Stripe Checkout) à deux endroits.
 */

import { COULEURS } from "../lib/contenuPaliers.js";
import GrillePaliers from "./GrillePaliers.jsx";

export default function Tarification() {
  return (
    <div style={{ background: COULEURS.fond, padding: "60px 24px", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* En-tête */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 600, color: COULEURS.bordeaux, margin: "0 0 12px" }}>
            Choisissez votre formule
          </h1>
          <p style={{ fontSize: 15, color: COULEURS.texteClair, margin: 0 }}>
            Adoptez votre rythme. Cursus s'occupe du reste.
          </p>
        </div>

        <GrillePaliers />
      </div>
    </div>
  );
}
