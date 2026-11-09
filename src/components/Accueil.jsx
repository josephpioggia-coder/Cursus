/**
 * CURSUS — Page d'accueil publique (09/11/2026). Visible SANS connexion par un nouveau visiteur ; remplace la page de connexion comme
 * première page (App.jsx : `if (!user) return <EntreePublique />`). Contenu : ce qu'est Cursus, un premier dossier thématique
 * (lectures sur la maladie, la fin de vie et le deuil — mêmes données que le jeu « Lire pour traverser », public/jeux/lectures-deuil.json),
 * l'offre de lancement pour les auteurs, et les pages légales.
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
import { chargerLectures } from "../lib/jeuLectures.js";

/** Offre de lancement (décision de Joseph, 09/11/2026) : un mois d'accès Initié en bêta, 30 places. Mettre à false pour masquer l'encadré. */
const OFFRE_ACTIVE = true;
const PLACES_OFFRE = 30;

const MAUVE = "#7F77DD", VERT = "#1D9E75", ENCRE = "#1a1a1a", GRIS = "#555", FOND = "#f8f8f8";
const police = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const GROUPES = [
  { id: "roman", titre: "Romans" },
  { id: "temoignage", titre: "Témoignages et récits intimes" },
  { id: "essai", titre: "Essais et enquêtes" },
  { id: "philo", titre: "Philosophie et éthique" },
];

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

function DossierLectures() {
  const [livres, setLivres] = useState(null);
  const [erreur, setErreur] = useState(false);
  useEffect(() => { chargerLectures().then(setLivres).catch(() => setErreur(true)); }, []);
  if (erreur) return null;
  return (
    <section style={{ marginTop: 44 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: VERT, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Dossier thématique</div>
      <h2 style={{ fontSize: 24, fontWeight: 600, color: ENCRE, margin: "0 0 10px", lineHeight: 1.25 }}>Lire pour traverser : la maladie, la fin de vie et le deuil</h2>
      <p style={{ fontSize: 15, lineHeight: 1.65, color: GRIS, maxWidth: 720, margin: "0 0 22px" }}>
        Certains livres aident à traverser une maladie, un accompagnement ou un deuil, chacun à sa manière : en racontant, en expliquant, en consolant ou en faisant réfléchir.
        Voici treize ouvrages, classés par genre. Les présentations ont été rédigées pour Cursus.
      </p>
      {!livres ? <div style={{ fontSize: 13, color: "#999" }}>Chargement…</div> : GROUPES.map((g) => {
        const liste = livres.filter((l) => (l.categorie || "essai") === g.id);
        if (!liste.length) return null;
        return (
          <div key={g.id} style={{ marginBottom: 22 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: ENCRE, margin: "0 0 10px" }}>{g.titre}</h3>
            <div style={grille}>
              {liste.map((l) => (
                <article key={l.id} style={carte}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: ENCRE, lineHeight: 1.3 }}>{l.titre}</div>
                  <div style={{ fontSize: 12.5, color: "#777", margin: "2px 0 8px" }}>{l.auteur}{l.annee ? ` · ${l.annee}` : ""}</div>
                  <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "#333", margin: 0 }}>{l.pitch}</p>
                </article>
              ))}
            </div>
          </div>
        );
      })}
      <p style={{ fontSize: 13.5, color: GRIS, marginTop: 6 }}>
        Envie d'en retenir quelques-uns en jouant ? Le jeu « Lire pour traverser » est dans la salle de jeux de Cursus :{" "}
        <a href="/?jeu=deuil" style={{ color: MAUVE }}>y jouer (connexion requise)</a>.
      </p>
    </section>
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

function Accueil({ onConnexion, onLegal }) {
  const lien = (page, texte) => (
    <button onClick={() => onLegal(page)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#777", fontSize: 12, fontFamily: "inherit", textDecoration: "underline" }}>{texte}</button>
  );
  return (
    <div style={{ minHeight: "100vh", background: FOND, fontFamily: police, color: ENCRE }}>
      <header style={{ background: "#fff", borderBottom: "0.5px solid #e5e5e5", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <img src="/logo-cursus.png" alt="" style={{ height: 36, width: 36, borderRadius: 8 }} />
          <span style={{ fontSize: 20, fontWeight: 600, color: MAUVE }}>Cursus</span>
        </div>
        <button onClick={onConnexion} style={bouton()}>Se connecter</button>
      </header>

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "36px 16px 56px" }}>
        <section style={{ textAlign: "center", padding: "6px 0 10px" }}>
          <h1 style={{ fontSize: 34, lineHeight: 1.2, fontWeight: 600, margin: "0 0 14px", color: ENCRE }}>L'atelier de l'auteur</h1>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: GRIS, maxWidth: 680, margin: "0 auto 22px" }}>
            Cursus accompagne les auteurs, du premier jet au livre terminé : un éditeur de texte avec co-pilote et assistants IA, un audit de manuscrit, et une salle de jeux de mots.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onConnexion} style={bouton()}>Créer mon compte</button>
            <button onClick={onConnexion} style={bouton(false)}>Se connecter</button>
          </div>
          <p style={{ fontSize: 12.5, color: "#888", marginTop: 12 }}>Cursus est en phase bêta.</p>
        </section>

        <section style={{ marginTop: 34 }}>
          <div style={grille}>
            <div style={carte}>
              <div style={{ fontSize: 22 }}>✍️</div>
              <h2 style={{ fontSize: 17, fontWeight: 600, margin: "6px 0" }}>CursEdit, l'éditeur</h2>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "#444", margin: 0 }}>
                Un espace d'écriture organisé en parties et chapitres : mise en forme, historique des versions, dictée vocale, lecture à voix haute, export Word.
                Un co-pilote donne des avis sur votre texte.
              </p>
            </div>
            <div style={carte}>
              <div style={{ fontSize: 22 }}>🔍</div>
              <h2 style={{ fontSize: 17, fontWeight: 600, margin: "6px 0" }}>CursAudit, l'audit de manuscrit</h2>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "#444", margin: 0 }}>
                Une lecture structurée de votre manuscrit pour repérer ce qui tient, ce qui accroche et ce qu'il vaut la peine de retravailler.
              </p>
            </div>
            <div style={carte}>
              <div style={{ fontSize: 22 }}>🎲</div>
              <h2 style={{ fontSize: 17, fontWeight: 600, margin: "6px 0" }}>Une salle de jeux de mots</h2>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "#444", margin: 0 }}>
                Mots croisés, mots fléchés, Scrabble, Devine le livre… pour jouer avec la langue et la lecture.
              </p>
            </div>
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 1.65, color: GRIS, maxWidth: 760, margin: "18px auto 0", textAlign: "center" }}>
            L'auteur reste l'auteur : les assistants IA de Cursus relisent, signalent et conseillent ; ils n'ont pas pour vocation d'écrire à votre place.
          </p>
        </section>

        <DossierLectures />
        <EncadreAuteurs />
      </main>

      <footer style={{ borderTop: "0.5px solid #e5e5e5", background: "#fff", padding: "18px 16px", textAlign: "center", fontSize: 12, color: "#777", lineHeight: 1.9 }}>
        {lien("mode-emploi", "Mode d'emploi")}{" · "}{lien("mentions", "Mentions légales")}{" · "}{lien("cgv", "CGV")}{" · "}{lien("confidentialite", "Confidentialité")}
      </footer>
    </div>
  );
}

export default function EntreePublique() {
  const [vue, setVue] = useState(() => (veutLaConnexion() ? "connexion" : "accueil"));
  const [legal, setLegal] = useState(null);
  const retour = () => setLegal(null);
  if (legal === "mentions") return <MentionsLegales onRetour={retour} onNaviguer={setLegal} />;
  if (legal === "cgv") return <CGV onRetour={retour} onNaviguer={setLegal} />;
  if (legal === "confidentialite") return <PolitiqueConfidentialite onRetour={retour} onNaviguer={setLegal} />;
  if (legal === "mode-emploi") return <ModeEmploi onRetour={retour} />;
  if (vue === "connexion") return <PageConnexion onRetourAccueil={() => setVue("accueil")} />;
  return <Accueil onConnexion={() => setVue("connexion")} onLegal={setLegal} />;
}
