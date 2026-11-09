/**
 * CURSUS — Page d'accueil publique (09/11/2026). Visible SANS connexion par un nouveau visiteur ; remplace la page de connexion comme
 * première page (App.jsx : `if (!user) return <EntreePublique />`). Contenu : ce qu'est Cursus, quatre boutons d'accès (CursEdit, CursAudit,
 * CursDecision, puis le dossier thématique « Lire pour traverser » qui s'ouvre sur les livres des AUTEURS PARTENAIRES seulement —
 * public/vitrine/livres.json, vide tant que Joseph n'a pas reçu de consentement), l'encadré d'offre pour les auteurs, et les pages légales.
 *
 * Qui voit quoi : un visiteur sans trace d'une connexion précédente voit l'accueil ; quelqu'un qui s'est déjà connecté sur cet appareil,
 * ou qui arrive par un lien qui exige un compte (?jeu=, retour de paiement, lien de confirmation d'e-mail), va DIRECTEMENT à la connexion.
 * « ?accueil » force l'accueil. Les textes d'accueil sont lisibles par les moteurs de recherche (c'était déjà le rôle de la page de connexion).
 *
 * Couleurs explicites (pas de var(--color-*)) : le mode sombre forcé des navigateurs mobiles inverse les textes (cf. CLAUDE.md).
 */
import { useState, useEffect } from "react";
import { PageConnexion } from "../lib/auth.jsx";
import { MentionsLegales, CGV, PolitiqueConfidentialite, IDENTITE_EDITEUR } from "./PagesLegales.jsx";
import ModeEmploi from "./ModeEmploi.jsx";

/** Offre de lancement (décision de Joseph, 09/11/2026) : un mois d'accès Initié en bêta, 30 places. Mettre à false pour masquer l'encadré. */
const OFFRE_ACTIVE = true;
const PLACES_OFFRE = 30;

const MAUVE = "#7F77DD", VERT = "#1D9E75", ENCRE = "#1a1a1a", GRIS = "#555", FOND = "#f8f8f8";
const police = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function veutLaConnexion() {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.has("accueil")) return false;
    if (q.has("jeu") || q.has("abonnement") || q.has("audit") || q.has("connexion")) return true;
    if ((window.location.hash || "").replace(/^#/, "")) return true; // lien de confirmation, de récupération ou erreur d'authentification
    if (localStorage.getItem("cursus_dernier_email")) return true;
  } catch { /* stockage indisponible : accueil */ }
  return false;
}

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
      <button onClick={onRetour} style={{ background: "none", border: "none", color: MAUVE, fontSize: 14, cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: 18 }}>← Retour à l'accueil</button>
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

const ESPACES = [
  { id: "cursedit", nom: "CursEdit", couleur: "#8B2635", logo: "/logo-cursedit.png", accroche: "Écrire, structurer, être accompagné·e par l'IA pendant la rédaction." },
  { id: "cursaudit", nom: "CursAudit", couleur: "#0E3374", logo: "/logo-cursaudit.png", accroche: "Auditer un texte déjà écrit : preuve, cohérence, risques, sur une grille de critères." },
  { id: "cursdecision", nom: "CursDecision", couleur: "#0E7256", logo: "/logo-cursdecision-v2.png", accroche: "Transformer une situation complexe ou floue en décision claire, argumentée et suivable." },
];

/** Carte d'accès : même présentation que les trois espaces de l'écran de choix (logo, nom, accroche). */
function CarteAcces({ logo, nom, couleur, accroche, onClick, rond = false }) {
  return (
    <button onClick={onClick} style={{ ...carte, textAlign: "left", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", border: `0.5px solid ${couleur}40`, padding: "24px 20px" }}>
      <img src={logo} alt="" style={{ width: 96, height: 96, objectFit: "contain", display: "block", margin: "0 auto 10px", borderRadius: rond ? "50%" : 0 }} />
      <div style={{ fontSize: 16, fontWeight: 700, color: couleur, textAlign: "center", marginBottom: 8 }}>{nom}</div>
      <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>{accroche}</div>
    </button>
  );
}

function Accueil({ onConnexion, onLegal, onDossier }) {
  const lien = (page, texte) => (
    <button onClick={() => onLegal(page)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#777", fontSize: 12, fontFamily: "inherit", textDecoration: "underline" }}>{texte}</button>
  );
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "36px 16px 56px" }}>
      <section style={{ textAlign: "center", padding: "6px 0 10px" }}>
        <h1 style={{ fontSize: 34, lineHeight: 1.2, fontWeight: 600, margin: "0 0 14px", color: ENCRE }}>L'atelier de l'auteur</h1>
        <p style={{ fontSize: 17, lineHeight: 1.6, color: GRIS, maxWidth: 680, margin: "0 auto 14px" }}>
          Cursus accompagne les auteurs, du premier jet au livre terminé : un éditeur de texte avec co-pilote et assistants IA, un audit de manuscrit, un outil d'aide à la décision, et une salle de jeux de mots.
        </p>
        <p style={{ fontSize: 14.5, lineHeight: 1.65, color: GRIS, maxWidth: 680, margin: "0 auto 22px" }}>
          L'auteur reste l'auteur : les assistants IA de Cursus relisent, signalent et conseillent ; ils n'ont pas pour vocation d'écrire à votre place.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onConnexion} style={bouton()}>Créer mon compte</button>
          <button onClick={onConnexion} style={bouton(false)}>Se connecter</button>
        </div>
        <p style={{ fontSize: 12.5, color: "#888", marginTop: 12 }}>Cursus est en phase bêta.</p>
      </section>

      <section style={{ marginTop: 30 }}>
        <div style={{ ...grille, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))" }}>
          {ESPACES.map((e) => <CarteAcces key={e.id} {...e} onClick={onConnexion} />)}
          {DOSSIERS.map((d) => (
            <CarteAcces key={d.id} logo="/aencre-icone.png" rond nom={d.titre} couleur={MAUVE} accroche={d.sous} onClick={() => onDossier(d.id)} />
          ))}
        </div>
      </section>

      <EncadreAuteurs />

      <footer style={{ marginTop: 44, textAlign: "center", fontSize: 12, color: "#777", lineHeight: 1.9 }}>
        {lien("mode-emploi", "Mode d'emploi")}{" · "}{lien("mentions", "Mentions légales")}{" · "}{lien("cgv", "CGV")}{" · "}{lien("confidentialite", "Confidentialité")}
      </footer>
    </main>
  );
}

function Cadre({ onConnexion, onAccueil, children }) {
  return (
    <div style={{ minHeight: "100vh", background: FOND, fontFamily: police, color: ENCRE }}>
      <header style={{ background: "#fff", borderBottom: "0.5px solid #e5e5e5", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
        <button onClick={onAccueil} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
          <img src="/logo-cursus.png" alt="" style={{ height: 36, width: 36, borderRadius: 8 }} />
          <span style={{ fontSize: 20, fontWeight: 600, color: MAUVE }}>Cursus</span>
        </button>
        <button onClick={onConnexion} style={bouton()}>Se connecter</button>
      </header>
      {children}
    </div>
  );
}

export default function EntreePublique() {
  const [vue, setVue] = useState(() => (veutLaConnexion() ? "connexion" : "accueil"));
  const [dossier, setDossier] = useState(null);
  const [legal, setLegal] = useState(null);
  const retour = () => setLegal(null);
  if (legal === "mentions") return <MentionsLegales onRetour={retour} onNaviguer={setLegal} />;
  if (legal === "cgv") return <CGV onRetour={retour} onNaviguer={setLegal} />;
  if (legal === "confidentialite") return <PolitiqueConfidentialite onRetour={retour} onNaviguer={setLegal} />;
  if (legal === "mode-emploi") return <ModeEmploi onRetour={retour} />;
  if (vue === "connexion") return <PageConnexion onRetourAccueil={() => setVue("accueil")} />;
  const d = DOSSIERS.find((x) => x.id === dossier);
  return (
    <Cadre onConnexion={() => setVue("connexion")} onAccueil={() => setDossier(null)}>
      {d ? <PageDossier dossier={d} onRetour={() => setDossier(null)} /> : <Accueil onConnexion={() => setVue("connexion")} onLegal={setLegal} onDossier={setDossier} />}
    </Cadre>
  );
}
