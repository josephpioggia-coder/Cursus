/**
 * CURSUS — Page de lancement (référence 60816-01, suite, 07/09/2026)
 * ======================================================================
 * Remplace le raccourci du 05/09/2026 qui faisait passer "Rejoindre
 * l'offre de lancement" par choisirEspace("cursedit") — ça affichait bien
 * la page Tarification, mais montait tout le shell applicatif au passage
 * (barre latérale complète : Éditeur, Bibliothèque, CursAudit, Mes audits,
 * Administration), accessible sans aucun abonnement réel. Cette page-ci
 * suit le même principe que CursDecisionPage.jsx : autonome, affichée
 * depuis EcranChoixEspace, sans jamais monter AppConnectée.
 *
 * Les 5 paliers CursEdit sont la seule offre — pas de ligne "Cursus
 * Essentiel" séparée : les paliers sont cumulatifs ("Tout Essentiel,
 * plus :") et débloquent CursAudit (dès Essentiel) et CursDecision (dès
 * Initié), listé directement dans les caractéristiques de chaque palier
 * (voir src/lib/contenuPaliers.js).
 */

import { COULEURS } from "../lib/contenuPaliers.js";
import GrillePaliers from "./GrillePaliers.jsx";

export default function PageLancement({ onRetour }) {
  return (
    <div style={{ minHeight: "100vh", background: COULEURS.fond, fontFamily: "Inter, sans-serif", padding: "40px 24px 80px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <button onClick={onRetour} style={{
          background: "none", border: "none", color: COULEURS.texteClair, fontSize: 13, cursor: "pointer",
          fontFamily: "inherit", padding: 0, marginBottom: 28,
        }}>
          ← Retour au choix de l'espace
        </button>

        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 600, color: COULEURS.bordeaux, margin: "0 0 12px" }}>
            Offre de lancement
          </h1>
          <p style={{ fontSize: 15, color: COULEURS.texteClair, margin: "0 0 8px" }}>
            Un seul abonnement CursEdit — chaque palier ouvre progressivement CursAudit puis CursDecision.
          </p>
        </div>

        <GrillePaliers />
      </div>
    </div>
  );
}
