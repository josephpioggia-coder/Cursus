/**
 * CURSUS — Entrée publique (09/11/2026). La page de connexion SERT d'accueil (présentation de CursEdit, CursAudit, CursDecision, bouton Æncre) :
 * décision de Joseph, après essai d'une page d'accueil séparée qui faisait double emploi. Cette entrée y ajoute l'accès complémentaire au
 * dossier thématique « Lire pour traverser » (livres d'auteurs partenaires + offre pour les auteurs) : src/components/Vitrine.jsx.
 */
import { useState } from "react";
import { PageConnexion } from "../lib/auth.jsx";
import { DOSSIERS, PageDossier, Cadre } from "./Vitrine.jsx";

export default function EntreePublique() {
  const [dossier, setDossier] = useState(null);
  const d = DOSSIERS.find((x) => x.id === dossier);
  if (d) return <Cadre onRetour={() => setDossier(null)}><PageDossier dossier={d} onRetour={() => setDossier(null)} /></Cadre>;
  return <PageConnexion onDossier={DOSSIERS[0] ? () => setDossier(DOSSIERS[0].id) : null} />;
}
