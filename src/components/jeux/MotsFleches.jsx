/** CURSUS — Mots fléchés (04/10/2026) : voir GrilleIndicee.jsx. */
import GrilleIndicee from "./GrilleIndicee.jsx";
export default function MotsFleches(props) {
  return <GrilleIndicee {...props} mode="fleches" statKey="fleches" titre="Mots fléchés"
    sous="Les définitions sont dans les cases bleues : la flèche indique où commence la réponse (→ à droite, ↓ vers le bas). Touche une case d'indice pour lire la définition en entier." />;
}
