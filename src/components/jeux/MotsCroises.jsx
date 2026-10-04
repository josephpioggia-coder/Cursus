/** CURSUS — Mots croisés (04/10/2026) : voir GrilleIndicee.jsx. */
import GrilleIndicee from "./GrilleIndicee.jsx";
export default function MotsCroises(props) {
  return <GrilleIndicee {...props} mode="croises" statKey="croises" titre="Mots croisés"
    sous="Touche une case puis écris au clavier. Touche deux fois la même case pour changer de sens. Les indices sont dessous." />;
}
