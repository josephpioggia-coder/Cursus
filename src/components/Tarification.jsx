/**
 * CURSUS — Page de tarification
 * ================================
 * Affiche les 5 paliers avec toggle mensuel/annuel.
 * Chaque bouton "Choisir" redirige vers Stripe Checkout pour le price_id correspondant.
 *
 * DÉPENDANCE : ce fichier importe la config centralisée des prix.
 * Place prix-stripe-config.mjs dans src/lib/ avant d'utiliser ce composant.
 */

import { useState } from "react";
import { PRIX_STRIPE, ORDRE_PALIERS } from "../lib/prix-stripe-config.mjs";

const COULEURS = {
  bordeaux: "#8B2635",
  or: "#C4973A",
  fond: "#F7F4EF",
  texte: "#2C1810",
  texteClair: "#6B5D52",
};

// Contenu marketing par palier — séparé de la config technique (prix-stripe-config.mjs)
// pour ne jamais mélanger les données Stripe (immuables) et le texte (modifiable librement).
const CONTENU_PALIERS = {
  decouverte: {
    description: "Pour démarrer sérieusement, sans engagement lourd.",
    engagement: "Engagement 3 mois minimum",
    fonctionnalites: [
      "Éditeur de texte + mode focus",
      "Structure de manuscrit",
      "Carnet de capture d'idées",
      "1 projet",
      "5 analyses IA / jour",
    ],
    miseEnAvant: false,
  },
  essentiel: {
    description: "Le co-pilote IA prend toute sa place.",
    engagement: null,
    fonctionnalites: [
      "Tout Découverte, plus :",
      "3 projets simultanés",
      "200 analyses IA / mois",
      "Cohérence narrative & personnages",
      "Mode auto-analyse (10 min)",
      "Bibliothèque + citations APA",
    ],
    miseEnAvant: false,
  },
  initie: {
    description: "Pour l'auteur qui écrit régulièrement.",
    engagement: null,
    fonctionnalites: [
      "Tout Essentiel, plus :",
      "250 analyses IA / mois",
      "Références académiques par IA",
      "Export Word / PDF soigné",
    ],
    miseEnAvant: true,
  },
  auteur: {
    description: "Projets et analyses sans limite.",
    engagement: null,
    fonctionnalites: [
      "Tout Initié, plus :",
      "Projets illimités",
      "Analyses IA illimitées",
      "Support prioritaire",
      "Sessions de supervision sur devis",
    ],
    miseEnAvant: false,
  },
  studio: {
    description: "Pour les cabinets et équipes.",
    engagement: null,
    fonctionnalites: [
      "Tout Auteur, plus :",
      "2 utilisateurs inclus",
      "+12€/mois par utilisateur supplémentaire",
      "Tableau de bord partagé",
      "Onboarding personnalisé",
    ],
    miseEnAvant: false,
  },
};

async function demarrerCheckout(priceId, nomPalier) {
  // Appelle directement la Edge Function Supabase déployée (creer-session-checkout),
  // qui crée la session Stripe Checkout côté serveur.
  const EDGE_FUNCTION_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/creer-session-checkout";
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  try {
    const réponse = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ priceId, nomPalier }),
    });
    const data = await réponse.json();
    if (!réponse.ok) {
      console.error("Erreur lors de la création de session Checkout :", data);
      return;
    }
    if (data.url) {
      window.location.href = data.url;
    } else {
      console.error("Pas d'URL de redirection reçue de la session Checkout.");
    }
  } catch (erreur) {
    console.error("Erreur lors de la création de la session Checkout :", erreur);
  }
}

export default function Tarification() {
  const [periode, setPeriode] = useState("mensuel"); // "mensuel" | "annuel"

  return (
    <div style={{ background: COULEURS.fond, padding: "60px 24px", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* En-tête */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 600, color: COULEURS.bordeaux, margin: "0 0 12px" }}>
            Choisissez votre formule
          </h1>
          <p style={{ fontSize: 15, color: COULEURS.texteClair, margin: 0 }}>
            Adoptez votre rythme. Cursus s'occupe du reste.
          </p>
        </div>

        {/* Toggle mensuel / annuel */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-flex", background: "#fff", border: `1px solid ${COULEURS.bordeaux}30`, borderRadius: 30, padding: 4 }}>
            <button
              onClick={() => setPeriode("mensuel")}
              style={{
                padding: "8px 20px",
                borderRadius: 26,
                border: "none",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                background: periode === "mensuel" ? COULEURS.bordeaux : "transparent",
                color: periode === "mensuel" ? "#fff" : COULEURS.texte,
                transition: "all 0.2s",
              }}
            >
              Mensuel
            </button>
            <button
              onClick={() => setPeriode("annuel")}
              style={{
                padding: "8px 20px",
                borderRadius: 26,
                border: "none",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                background: periode === "annuel" ? COULEURS.bordeaux : "transparent",
                color: periode === "annuel" ? "#fff" : COULEURS.texte,
                transition: "all 0.2s",
              }}
            >
              Annuel
              <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px", borderRadius: 20, background: periode === "annuel" ? "#ffffff30" : `${COULEURS.or}25`, color: periode === "annuel" ? "#fff" : "#7A5A10" }}>
                −17%
              </span>
            </button>
          </div>
        </div>

        {/* Grille des 5 cartes */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {ORDRE_PALIERS.map((cle) => {
            const palier = PRIX_STRIPE[cle];
            const contenu = CONTENU_PALIERS[cle];
            const prixActuel = periode === "mensuel" ? palier.mensuel : palier.annuel;
            const priceIdActuel = prixActuel.price_id;

            return (
              <div
                key={cle}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: 24,
                  border: contenu.miseEnAvant ? `2px solid ${COULEURS.bordeaux}` : `1px solid ${COULEURS.bordeaux}20`,
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                }}
              >
                {contenu.miseEnAvant && (
                  <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: COULEURS.bordeaux, color: "#fff", fontSize: 10, fontWeight: 500, padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>
                    ★ Cœur de cible
                  </div>
                )}

                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600, color: COULEURS.bordeaux, margin: "8px 0 4px" }}>
                  {palier.nom}
                </h3>
                <p style={{ fontSize: 12, color: COULEURS.texteClair, margin: "0 0 16px", lineHeight: 1.5, minHeight: 32 }}>
                  {contenu.description}
                </p>

                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 600, color: COULEURS.texte }}>
                    {prixActuel.montant.toFixed(2).replace(".", ",")}€
                  </span>
                  <span style={{ fontSize: 12, color: COULEURS.texteClair }}>
                    {periode === "mensuel" ? " /mois" : " /an"}
                  </span>
                </div>
                {contenu.engagement && (
                  <p style={{ fontSize: 10, color: COULEURS.or, fontWeight: 500, margin: "0 0 16px" }}>
                    {contenu.engagement}
                  </p>
                )}
                {!contenu.engagement && <div style={{ marginBottom: 16 }} />}

                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", flex: 1 }}>
                  {contenu.fonctionnalites.map((f, i) => (
                    <li key={i} style={{ fontSize: 12, color: COULEURS.texte, marginBottom: 8, paddingLeft: 16, position: "relative", lineHeight: 1.5 }}>
                      <span style={{ position: "absolute", left: 0, color: COULEURS.or }}>·</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => demarrerCheckout(priceIdActuel, palier.nom)}
                  style={{
                    padding: "10px",
                    borderRadius: 8,
                    border: contenu.miseEnAvant ? "none" : `1px solid ${COULEURS.bordeaux}`,
                    background: contenu.miseEnAvant ? COULEURS.bordeaux : "transparent",
                    color: contenu.miseEnAvant ? "#fff" : COULEURS.bordeaux,
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Choisir {palier.nom}
                </button>
              </div>
            );
          })}
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: COULEURS.texteClair, marginTop: 32 }}>
          Tous les prix sont indiqués hors TVA. Résiliable à tout moment (hors engagement Découverte).
        </p>
      </div>
    </div>
  );
}
