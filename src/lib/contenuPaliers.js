/**
 * CURSUS — Contenu et logique de paiement des 5 paliers CursEdit
 * ======================================================================
 * Extrait de Tarification.jsx le 07/09/2026 pour être partagé avec
 * GrillePaliers.jsx (utilisée à la fois par Tarification.jsx, dans le
 * shell applicatif, et par PageLancement.jsx, hors shell) sans import
 * circulaire entre les deux composants qui l'affichent.
 *
 * DÉPENDANCE : importe la config centralisée des prix Stripe
 * (prix-stripe-config.mjs) uniquement pour rien — en réalité ce fichier
 * ne dépend que de supabase.js pour demarrerCheckout().
 */

import { supabase } from "./supabase.js";

export const COULEURS = {
  bordeaux: "#8B2635",
  or: "#C4973A",
  fond: "#F7F4EF",
  texte: "#2C1810",
  texteClair: "#6B5D52",
};

// Contenu marketing par palier — séparé de la config technique (prix-stripe-config.mjs)
// pour ne jamais mélanger les données Stripe (immuables) et le texte (modifiable librement).
export const CONTENU_PALIERS = {
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
      "Accès à CursAudit",
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
      "Accès à CursDecision",
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

// codePromo (60804-02) : optionnel, transmis tel quel à l'Edge Function,
// jamais validé côté client (la vraie règle vit dans la table Supabase
// codes_promo, lue uniquement côté serveur).
export async function demarrerCheckout(priceId, nomPalier, codePromo) {
  // Appelle directement la Edge Function Supabase déployée (creer-session-checkout),
  // qui crée la session Stripe Checkout côté serveur.
  const EDGE_FUNCTION_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/creer-session-checkout";
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // 60804-02 : le jeton de la session utilisateur (pas la clé anonyme) est
  // transmis en Authorization, pour que creer-session-checkout puisse
  // vérifier l'identité réelle de l'appelant (supabase.auth.getUser(token))
  // et contrôler codes_promo.client_email sur un email qui ne peut pas
  // être falsifié depuis le client. Sans session active, on retombe sur la
  // clé anonyme : le ciblage par email sera alors simplement refusé côté
  // serveur, jamais accepté à l'aveugle.
  const { data: { session } } = await supabase.auth.getSession();
  const jetonAppelant = session?.access_token || SUPABASE_ANON_KEY;

  try {
    const réponse = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jetonAppelant}`,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ priceId, nomPalier, ...(codePromo ? { codePromo } : {}) }),
    });
    const data = await réponse.json();
    if (!réponse.ok) {
      alert(data.error || "Ce code promo n'a pas pu être appliqué.");
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
