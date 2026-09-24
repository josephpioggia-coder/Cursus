/**
 * CURSUS — Bouton "Retour" toujours visible (24/09/2026)
 * ======================================================================
 * Demande explicite de Joseph : sur les pages autonomes sans autre
 * navigation (Mode d'emploi, pages légales, CursDecision, page de
 * lancement — atteignables avant connexion via PageConnexion, ou depuis
 * EcranChoixEspace, donc sans barre latérale), le bouton "← Retour"
 * placé en haut du contenu défilait hors champ dès qu'on scrollait un
 * peu, donnant envie de cliquer sur la flèche « précédent » du
 * navigateur — ce qui fait sortir de Cursus.
 *
 * `position: fixed` (et non `sticky`) : ces pages n'ont pas de barre
 * latérale à respecter, un bouton ancré au coin de l'ÉCRAN (pas de la
 * colonne de contenu) est donc sans risque de chevauchement et reste
 * la façon la plus littérale de répondre à "toujours visible en haut à
 * gauche, même en scrollant".
 */

export default function BoutonRetourFixe({ onClick, couleur = "#555", label = "Retour" }) {
  return (
    <button onClick={onClick} title={label} style={{
      position: "fixed", top: 16, left: 16, zIndex: 1000,
      display: "flex", alignItems: "center", gap: 6,
      background: "#fff", border: `0.5px solid ${couleur}40`,
      borderRadius: 20, padding: "8px 14px",
      fontSize: 13, fontWeight: 500, color: couleur,
      cursor: "pointer", fontFamily: "inherit",
      boxShadow: "0 2px 10px rgba(0,0,0,0.10)",
    }}>
      ← {label}
    </button>
  );
}
