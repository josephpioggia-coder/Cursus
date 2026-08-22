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
 * REFONTE DU 22/08/2026, à la demande de l'auteur du projet : bouton
 * principal "Ouvrir X" + lien secondaire "Voir les fonctionnalités" (au
 * lieu de la carte entière cliquable), qui ouvre une fenêtre d'info à
 * trois rubriques ("Pour quoi faire ?", "Ce que l'outil permet",
 * "Exemples d'usage"). Contenu rédigé pour rester fidèle à ce qui existe
 * VRAIMENT aujourd'hui — pas d'aspiration/roadmap présentée comme acquise
 * (ex. pas d'import PDF ni de paiement pour CursAudit, pas encore
 * construits).
 *
 * PONT BIDIRECTIONNEL — pas encore construit ici : la maquette prévoit de
 * pouvoir passer d'un projet CursEdit à son audit sans réimporter, avec un
 * badge "Audit partiel" sur le projet en cours d'audit. Cet écran ne fait
 * que le choix initial d'espace ; le pont lui-même (lien projet ↔ audit,
 * badge) reste à construire séparément.
 */

import { useState } from "react";

const ESPACES = [
  {
    id: "cursedit",
    nom: "CursEdit",
    accroche: "Écrire, structurer, être accompagné·e par l'IA pendant la rédaction.",
    couleur: "#7F77DD",
    logo: "/logo-cursedit.png",
    info: {
      pourquoi: "Écrire un livre (roman, essai, témoignage…) avec un accompagnement IA à chaque étape, sans perdre sa propre voix.",
      permet: [
        "Structurer un manuscrit en parties/chapitres, avec suivi de progression",
        "Éditeur riche avec compteurs de mots et objectifs",
        "Copilote IA : suggestions, cohérence, personnages, références",
        "Vérification approfondie à deux IA (protocole de contrôle croisé)",
        "Import et export Word",
        "Bibliothèque de citations et carnet d'idées",
      ],
      exemples: [
        "Rédiger un roman chapitre par chapitre avec des suggestions IA en marge",
        "Faire vérifier la cohérence d'un passage factuel avant publication",
        "Importer un manuscrit déjà commencé pour continuer à l'écrire dans l'app",
      ],
    },
  },
  {
    id: "cursaudit",
    nom: "CursAudit",
    accroche: "Auditer un texte déjà écrit : preuve, cohérence, risques, sur une grille de critères.",
    couleur: "#1D9E75",
    logo: "/logo-cursaudit.png",
    info: {
      pourquoi: "Faire auditer un texte déjà écrit — livre entier ou simple extrait — pour repérer ce qui manque de preuve, ce qui est à nuancer, ce qui présente un risque.",
      permet: [
        "Importer le texte (collé ou fichier Word)",
        "Choisir la profondeur d'analyse (8, 15 ou 30 critères)",
        "Analyse par IA, critère par critère",
        "Résultat catégorisé et filtrable : recevable, à nuancer, à sourcer, à reformuler, à vérifier",
      ],
      exemples: [
        "Auditer un essai avant de le soumettre à un éditeur, pour repérer les affirmations non sourcées",
        "Vérifier la cohérence argumentative d'un mémoire ou d'un rapport",
        "Identifier les passages à risque (juridique, éthique) dans un texte professionnel avant diffusion",
      ],
    },
  },
];

function FenêtreInfo({ espace, onFermer }) {
  return (
    <div
      onClick={onFermer}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 14, padding: "28px 30px", maxWidth: 460, width: "100%",
          maxHeight: "80vh", overflowY: "auto", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={espace.logo} alt={espace.nom} style={{ width: 36, height: "auto" }} />
          </div>
          <button onClick={onFermer} style={{
            background: "none", border: "none", fontSize: 18, color: "#999", cursor: "pointer", lineHeight: 1, padding: 4,
          }}>✕</button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: espace.couleur, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
            Pour quoi faire ?
          </div>
          <div style={{ fontSize: 13.5, color: "#333", lineHeight: 1.6 }}>{espace.info.pourquoi}</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: espace.couleur, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
            Ce que l'outil permet
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "#333", lineHeight: 1.8 }}>
            {espace.info.permet.map((ligne, i) => <li key={i}>{ligne}</li>)}
          </ul>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: espace.couleur, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
            Exemples d'usage
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "#333", lineHeight: 1.8 }}>
            {espace.info.exemples.map((ligne, i) => <li key={i}>{ligne}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function EcranChoixEspace({ onChoisir }) {
  const [infoOuverte, setInfoOuverte] = useState(null);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "#f8f8f8", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 24,
    }}>
      <img src="/logo-cursus.png" alt="Cursus" style={{ height: 56, width: 56, borderRadius: 12, marginBottom: 12 }} />
      <div style={{ fontSize: 26, fontWeight: 500, color: "#1a1a1a", marginBottom: 6, letterSpacing: "0.01em" }}>Cursus</div>
      <div style={{ fontSize: 13.5, color: "#999", marginBottom: 40 }}>Une suite d'écriture et d'audit assistée par IA.</div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center", maxWidth: 680 }}>
        {ESPACES.map((e) => (
          <div
            key={e.id}
            style={{
              width: 300, textAlign: "left", padding: "28px 24px", borderRadius: 14,
              border: `0.5px solid ${e.couleur}30`, background: "#fff",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column",
            }}
          >
            <img src={e.logo} alt={e.nom} style={{ width: 110, height: "auto", marginBottom: 14 }} />
            <div style={{ fontSize: 12.5, color: "#666", lineHeight: 1.6, marginBottom: 18, flex: 1 }}>{e.accroche}</div>
            <button
              onClick={() => onChoisir(e.id)}
              style={{
                width: "100%", padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer",
                background: e.couleur, color: "#fff", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", marginBottom: 10,
              }}
            >
              Ouvrir {e.nom}
            </button>
            <button
              onClick={() => setInfoOuverte(e)}
              style={{
                width: "100%", padding: "6px 0", borderRadius: 8, border: "none", cursor: "pointer",
                background: "transparent", color: e.couleur, fontSize: 12.5, fontWeight: 500, fontFamily: "inherit",
              }}
            >
              Voir les fonctionnalités
            </button>
          </div>
        ))}
      </div>

      {infoOuverte && <FenêtreInfo espace={infoOuverte} onFermer={() => setInfoOuverte(null)} />}
    </div>
  );
}
