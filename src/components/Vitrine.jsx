/**
 * CURSUS — Dossiers thématiques et vitrine des auteurs partenaires (09/11/2026).
 * Ouvert depuis le bouton « Æncre » de la page de connexion (qui sert d'accueil, présentation comprise : décision de Joseph) ; une page par
 * dossier, qui ne liste QUE les livres d'auteurs partenaires de public/vitrine/livres.json (vide tant qu'aucun accord écrit n'est reçu),
 * puis l'encadré d'offre pour les auteurs. Une fiche sans date de consentement n'est jamais affichée.
 * Couleurs explicites (pas de var(--color-*)) : le mode sombre forcé des navigateurs mobiles inverse les textes.
 */
import { useState, useEffect } from "react";
import { IDENTITE_EDITEUR } from "./PagesLegales.jsx";

/** Offre de lancement (décision de Joseph, 09/11/2026) : un mois d'accès Initié en bêta, 30 places. Mettre à false pour masquer l'encadré. */
const OFFRE_ACTIVE = true;
const PLACES_OFFRE = 30;

const MAUVE = "#7F77DD", VERT = "#1D9E75", ENCRE = "#1a1a1a", GRIS = "#555", FOND = "#f8f8f8";
const police = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const bouton = (plein = true) => ({
  background: plein ? MAUVE : "#fff", color: plein ? "#fff" : MAUVE, border: plein ? "none" : "1px solid " + MAUVE,
  borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", display: "inline-block",
});
const carte = { background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 14, padding: "18px 18px", minWidth: 0 };
const grille = { display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))" };

/** Dossiers thématiques de la vitrine : chacun s'affiche comme un bouton d'accès et s'ouvre sur les livres d'auteurs partenaires qui le portent. */
const DOSSIERS = [
  {
    id: "deuil",
    titre: "Lire pour traverser",
    sous: "Dossier thématique : la maladie, la fin de vie et le deuil, à travers les livres d'auteurs partenaires.",
    intro: "Des livres écrits par des auteurs partenaires de Cursus, sur la maladie, la fin de vie et le deuil : romans, témoignages, essais. Chaque fiche est publiée avec l'accord de son auteur.",
  },
];

const MODES_CREATION = {
  seul: "Texte écrit seul par l'auteur",
  cursus: "Accompagné par Cursus (relecture, correction, mise en page)",
};

/** Une fiche n'est affichée que si l'auteur a donné son accord (`consentement` renseigné) et si elle appartient au dossier. */
const fichesDuDossier = (livres, dossierId) =>
  (Array.isArray(livres) ? livres : []).filter((l) => l && l.titre && l.auteur && l.consentement && Array.isArray(l.dossiers) && l.dossiers.includes(dossierId));
const lienSur = (u) => (typeof u === "string" && /^https:\/\//i.test(u) ? u : null);

const srcCouverture = (c) => (typeof c === "string" && (c.startsWith("/vitrine/couvertures/") || /^https:\/\//i.test(c)) ? c : null);

function PageDossier({ dossier, onRetour }) {
  const [livres, setLivres] = useState(null);
  useEffect(() => {
    fetch("/vitrine/livres.json").then((r) => (r.ok ? r.json() : [])).then(setLivres).catch(() => setLivres([]));
  }, []);
  const fiches = livres ? fichesDuDossier(livres, dossier.id) : null;
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px 56px" }}>
      <button onClick={onRetour} style={{ background: "none", border: "none", color: MAUVE, fontSize: 14, cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: 18 }}>← Retour</button>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
        <img src="/aencre-icone.png" alt="Æncre" style={{ width: 56, height: 56, borderRadius: "50%", flexShrink: 0 }} />
        <h1 style={{ fontSize: 26, fontWeight: 600, color: ENCRE, margin: 0, lineHeight: 1.25 }}>{dossier.titre}</h1>
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.65, color: GRIS, maxWidth: 720, margin: "0 0 22px" }}>{dossier.intro}</p>
      {!fiches ? <div style={{ fontSize: 13, color: "#999" }}>Chargement…</div> : fiches.length === 0 ? (
        <div style={{ ...carte, fontSize: 14.5, lineHeight: 1.65, color: "#444" }}>
          Les premières fiches arrivent bientôt. Vous êtes auteur et votre livre parle de ce thème ? Présentez-le ici : voir l'encadré ci-dessous.
        </div>
      ) : (
        <div style={grille}>
          {fiches.map((l) => (
            <article key={l.id || l.titre} style={carte}>
              {srcCouverture(l.couverture) && (
                <img src={srcCouverture(l.couverture)} alt={`Couverture de ${l.titre}`} style={{ width: "100%", maxHeight: 280, objectFit: "contain", marginBottom: 10 }} />
              )}
              <div style={{ fontSize: 16, fontWeight: 600, color: ENCRE, lineHeight: 1.3 }}>{l.titre}</div>
              <div style={{ fontSize: 12.5, color: "#777", margin: "2px 0 8px" }}>{l.auteur}{l.annee ? ` · ${l.annee}` : ""}</div>
              {l.accroche && <p style={{ fontSize: 14, lineHeight: 1.55, color: "#333", margin: "0 0 8px", fontWeight: 500 }}>{l.accroche}</p>}
              {l.presentation && <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "#444", margin: "0 0 8px" }}>{l.presentation}</p>}
              {MODES_CREATION[l.modeCreation] && (
                <div style={{ fontSize: 12, color: "#777", margin: "0 0 8px" }}>{MODES_CREATION[l.modeCreation]} <span style={{ color: "#999" }}>(déclaré par l'auteur)</span></div>
              )}
              {lienSur(l.lien) && <a href={lienSur(l.lien)} target="_blank" rel="noopener noreferrer nofollow" style={{ ...bouton(false), padding: "7px 14px", fontSize: 13 }}>Découvrir ce livre</a>}
            </article>
          ))}
        </div>
      )}
      <p style={{ fontSize: 12, color: "#888", marginTop: 18, lineHeight: 1.6, maxWidth: 720 }}>
        Les mentions sur la façon dont un livre a été écrit sont déclarées par les auteurs : Cursus ne les vérifie pas.
      </p>
      <EncadreAuteurs />
    </main>
  );
}

function EncadreAuteurs() {
  const contact = IDENTITE_EDITEUR.email;
  const sujet = encodeURIComponent("Présenter mon livre sur Cursus");
  return (
    <section style={{ marginTop: 44, background: "#EEEDFE", border: "1px solid " + MAUVE + "55", borderRadius: 16, padding: "26px 22px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: ENCRE, margin: "0 0 8px" }}>Vous avez publié un livre ?</h2>
      <p style={{ fontSize: 15, lineHeight: 1.65, color: "#333", margin: "0 0 12px", maxWidth: 720 }}>
        Nous préparons une vitrine qui présente des livres par thèmes. Présentez le vôtre : une fiche avec sa couverture, son accroche et le lien pour l'acheter.
      </p>
      {OFFRE_ACTIVE && (
        <p style={{ fontSize: 15, lineHeight: 1.65, color: "#333", margin: "0 0 16px", maxWidth: 720 }}>
          <strong>Offre de lancement :</strong> un mois d'accès à Cursus en bêta, formule Initié, offert aux {PLACES_OFFRE} premiers nouveaux auteurs dont la fiche est validée
          (une offre par adresse e-mail, pour un compte qui n'a encore jamais eu d'abonnement).
        </p>
      )}
      <a href={`mailto:${contact}?subject=${sujet}`} style={bouton()}>Nous écrire</a>
    </section>
  );
}

function Cadre({ onRetour, children }) {
  return (
    <div style={{ minHeight: "100vh", background: FOND, fontFamily: police, color: ENCRE }}>
      <header style={{ background: "#fff", borderBottom: "0.5px solid #e5e5e5", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
        <button onClick={onRetour} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
          <img src="/logo-cursus.png" alt="" style={{ height: 36, width: 36, borderRadius: 8 }} />
          <span style={{ fontSize: 20, fontWeight: 600, color: MAUVE }}>Cursus</span>
        </button>
        <button onClick={onRetour} style={bouton()}>Se connecter</button>
      </header>
      {children}
    </div>
  );
}

export { DOSSIERS, PageDossier, Cadre };
