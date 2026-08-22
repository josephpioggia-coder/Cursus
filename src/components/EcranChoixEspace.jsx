/**
 * CURSUS — Écran de choix d'espace (CursEdit / CursAudit)
 * ======================================================================
 * Chantier 2 de docs/cursaudit-cartographie-technique.md ("Navigation/UX —
 * CursEdit et CursAudit à l'accueil"), conçu et validé en maquette le
 * 09/08/2026, codé le 16/08/2026. S'affiche une fois après connexion
 * (choix mémorisé pour la session du navigateur, pas de façon permanente —
 * voir sessionStorage dans App.jsx), avant d'entrer dans l'un ou l'autre
 * produit.
 *
 * PONT BIDIRECTIONNEL — pas encore construit ici : la maquette prévoit de
 * pouvoir passer d'un projet CursEdit à son audit sans réimporter, avec un
 * badge "Audit partiel" sur le projet en cours d'audit. Cet écran ne fait
 * que le choix initial d'espace ; le pont lui-même (lien projet ↔ audit,
 * badge) reste à construire séparément.
 */

const ESPACES = [
  {
    id: "cursedit",
    nom: "CursEdit",
    accroche: "Écrire, structurer, être accompagné·e par l'IA pendant la rédaction.",
    couleur: "#7F77DD",
    logo: "/logo-cursedit.png",
  },
  {
    id: "cursaudit",
    nom: "CursAudit",
    accroche: "Auditer un texte déjà écrit : preuve, cohérence, risques, sur une grille de critères.",
    couleur: "#1D9E75",
    logo: "/logo-cursaudit.png",
  },
];

export default function EcranChoixEspace({ onChoisir }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "#f8f8f8", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 24,
    }}>
      <img src="/logo-cursus.png" alt="Cursus" style={{ height: 56, width: 56, borderRadius: 12, marginBottom: 12 }} />
      <div style={{ fontSize: 26, fontWeight: 500, color: "#1a1a1a", marginBottom: 6, letterSpacing: "0.01em" }}>Cursus</div>
      <div style={{ fontSize: 13.5, color: "#999", marginBottom: 40 }}>Choisissez votre espace de travail</div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center", maxWidth: 680 }}>
        {ESPACES.map((e) => (
          <button
            key={e.id}
            onClick={() => onChoisir(e.id)}
            style={{
              width: 300, textAlign: "left", padding: "28px 24px", borderRadius: 14, cursor: "pointer",
              border: `0.5px solid ${e.couleur}30`, background: "#fff", fontFamily: "inherit",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "box-shadow 0.15s, transform 0.15s",
            }}
            onMouseEnter={(ev) => { ev.currentTarget.style.boxShadow = `0 6px 20px ${e.couleur}25`; ev.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; ev.currentTarget.style.transform = "none"; }}
          >
            {/* 22/08/2026 — logo-cursedit.png/logo-cursaudit.png ne sont PAS
                carrés (icône + nom de marque empilés dans une seule image,
                ratio ~0.82) : une hauteur ET largeur fixes identiques les
                écrasait. Largeur fixe + hauteur automatique préserve leurs
                proportions réelles. */}
            <img src={e.logo} alt={e.nom} style={{ width: 64, height: "auto", borderRadius: 10, marginBottom: 10 }} />
            <div style={{ fontSize: 17, fontWeight: 600, color: e.couleur, marginBottom: 6 }}>{e.nom}</div>
            <div style={{ fontSize: 12.5, color: "#666", lineHeight: 1.6 }}>{e.accroche}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
