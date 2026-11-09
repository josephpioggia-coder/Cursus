/**
 * CURSUS — Entrée publique (09/11/2026). La page de connexion SERT d'accueil (présentation de CursEdit, CursAudit, CursDecision, aide Æncre) :
 * décision de Joseph. Elle propose deux accès INDÉPENDANTS, ouverts ici (src/components/Vitrine.jsx) :
 *  - le dossier thématique général « Lire pour traverser » (cartouche) ;
 *  - la vitrine des auteurs partenaires + l'offre de lancement (encadré).
 */
import { useState } from "react";
import { PageConnexion } from "../lib/auth.jsx";
import { DOSSIERS, PageDossier, PagePartenaires, Cadre } from "./Vitrine.jsx";

export default function EntreePublique() {
  const [page, setPage] = useState(null); // null | "dossier" | "partenaires"
  const retour = () => setPage(null);
  if (page === "dossier") return <Cadre onRetour={retour}><PageDossier dossier={DOSSIERS[0]} onRetour={retour} onPartenaires={() => setPage("partenaires")} /></Cadre>;
  if (page === "partenaires") return <Cadre onRetour={retour}><PagePartenaires onRetour={retour} /></Cadre>;
  return <PageConnexion onDossier={() => setPage("dossier")} onPartenaires={() => setPage("partenaires")} />;
}
