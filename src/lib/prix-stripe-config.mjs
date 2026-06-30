/**
 * CURSUS — Configuration des prix Stripe
 * =========================================
 * Source unique de vérité pour tous les price_id Stripe.
 * Généré le 30/06/2026 à partir de l'export CSV du Catalogue de produits Stripe.
 *
 * Ne pas modifier ces ID à la main — si un prix change, recréer un nouveau
 * Price côté Stripe (les Price existants sont immuables) et mettre à jour ici.
 */

export const PRIX_STRIPE = {
  decouverte: {
    nom: "Découverte",
    produit_id: "prod_UnboF1g4hsNTQb",
    mensuel: { price_id: "price_1To0aPPCr5y81hQucKMajz8H", montant: 9.99 },
    annuel: { price_id: "price_1To0aPPCr5y81hQu6WvNDMas", montant: 99.00 },
  },
  essentiel: {
    nom: "Essentiel",
    produit_id: "prod_Unboeq7e0p8Elv",
    mensuel: { price_id: "price_1To0aQPCr5y81hQu2KAfUY6z", montant: 16.99 },
    annuel: { price_id: "price_1To0aRPCr5y81hQu8miOci6D", montant: 169.00 },
  },
  initie: {
    nom: "Initié",
    produit_id: "prod_UnboFm8dFIGt2n",
    mensuel: { price_id: "price_1To0aSPCr5y81hQuaTOSXoeN", montant: 24.99 },
    annuel: { price_id: "price_1To0aSPCr5y81hQubePqKJwS", montant: 249.00 },
  },
  auteur: {
    nom: "Auteur",
    produit_id: "prod_UnbosNbz8wTThW",
    mensuel: { price_id: "price_1To0aTPCr5y81hQuT6bvFYQ5", montant: 49.00 },
    annuel: { price_id: "price_1To0aUPCr5y81hQuwLZvpRyv", montant: 490.00 },
  },
  studio: {
    nom: "Studio",
    produit_id: "prod_UnbobFDEtMwO1S",
    mensuel: { price_id: "price_1To0aUPCr5y81hQu8UUHJP8R", montant: 79.00 },
    annuel: { price_id: "price_1To0aVPCr5y81hQuZSSPcn6U", montant: 790.00 },
  },
};

// Ordre d'affichage pour la page de tarification (du moins cher au plus cher)
export const ORDRE_PALIERS = ["decouverte", "essentiel", "initie", "auteur", "studio"];
