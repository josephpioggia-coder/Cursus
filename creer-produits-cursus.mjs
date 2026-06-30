/**
 * CURSUS — Création définitive des produits Stripe (mode TEST)
 * =============================================================
 *
 * Crée les 5 paliers x 2 fréquences (mensuel + annuel) = 10 produits/prix.
 *
 * PROTECTIONS INTÉGRÉES :
 *   1. Anti-doublon : vérifie si un produit du même nom existe déjà avant
 *      d'en créer un nouveau. Relancer ce script plusieurs fois est SANS DANGER.
 *   2. Montants validés : chaque prix est vérifié en centimes avant l'envoi,
 *      avec un garde-fou qui bloque si un montant semble incohérent (ex. > 1000€).
 *   3. Mode clairement affiché : le script affiche en gros si on est en
 *      mode TEST ou LIVE avant de commencer, et s'arrête si la clé ne
 *      correspond pas au mode attendu.
 *   4. Reprise après erreur : si le script s'arrête en cours de route
 *      (réseau coupé, etc.), le relancer ne recrée PAS les produits déjà
 *      faits — il reprend là où il s'est arrêté.
 *   5. Résumé final avec tous les price_id, à copier dans un fichier
 *      de configuration une fois pour toutes.
 *
 * USAGE :
 *   1. Remplacer STRIPE_SECRET_KEY ci-dessous par ta clé sk_test_...
 *   2. node creer-produits-cursus.mjs
 */

import Stripe from "stripe";

// ⚠️ Remplace par ta clé secrète de TEST (commence par sk_test_)
const STRIPE_SECRET_KEY = "sk_test_51TnxEoPCr5y81hQuvgaK2x5muZZhdGmVOA4mFFT7WhlBERbCPORiFbO3pRCQdBq1tc38du7XrAQ1OHzvlPAUUQ4E002D1d5aFi";

// Version API actuelle au moment de l'écriture de ce script (juin 2026)
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2026-06-24.dahlia",
});

// =============================================================
// GARDE-FOU 1 : vérifier qu'on est bien en mode TEST
// =============================================================
function verifierModeTest(cle) {
  if (cle.startsWith("sk_live_")) {
    console.error("\n🛑 ARRÊT : cette clé est une clé de PRODUCTION (sk_live_).");
    console.error("   Ce script ne doit être lancé qu'en mode TEST (sk_test_).");
    console.error("   Si tu veux vraiment créer ces produits en production,");
    console.error("   modifie ce garde-fou volontairement.\n");
    process.exit(1);
  }
  if (!cle.startsWith("sk_test_")) {
    console.error("\n🛑 ARRÊT : la clé fournie ne ressemble pas à une clé Stripe valide.");
    console.error("   Vérifie que tu as bien remplacé STRIPE_SECRET_KEY.\n");
    process.exit(1);
  }
  console.log("✓ Mode TEST confirmé — aucun argent réel ne sera mobilisé.\n");
}

// =============================================================
// GARDE-FOU 2 : la grille tarifaire définitive (source unique de vérité)
// =============================================================
const PALIERS = [
  { nom: "Découverte", mensuel: 999, annuel: 9900 },   // 9,99€ / 99€
  { nom: "Essentiel", mensuel: 1699, annuel: 16900 },  // 16,99€ / 169€
  { nom: "Initié", mensuel: 2499, annuel: 24900 },     // 24,99€ / 249€
  { nom: "Auteur", mensuel: 4900, annuel: 49000 },     // 49€ / 490€
  { nom: "Studio", mensuel: 7900, annuel: 79000 },     // 79€ / 790€
];

// =============================================================
// GARDE-FOU 3 : validation des montants avant tout envoi à Stripe
// =============================================================
function validerMontant(montantCentimes, nomPalier, frequence) {
  if (!Number.isInteger(montantCentimes)) {
    throw new Error(`Montant non entier pour ${nomPalier} ${frequence} : ${montantCentimes}`);
  }
  if (montantCentimes <= 0) {
    throw new Error(`Montant nul ou négatif pour ${nomPalier} ${frequence} : ${montantCentimes}`);
  }
  if (montantCentimes > 100000) {
    // Garde-fou large : aucun palier Cursus ne devrait dépasser 1000€ — si c'est
    // le cas, c'est probablement une erreur de saisie (ex. centimes oubliés).
    throw new Error(
      `Montant suspect pour ${nomPalier} ${frequence} : ${(montantCentimes / 100).toFixed(2)}€ — vérifie avant de continuer.`
    );
  }
}

// =============================================================
// GARDE-FOU 4 : anti-doublon — cherche un produit existant avant d'en créer un
// =============================================================
async function trouverOuCreerProduit(nom) {
  const existants = await stripe.products.search({
    query: `name:"${nom}" AND active:"true"`,
  });
  if (existants.data.length > 0) {
    console.log(`   ↪ Produit déjà existant, réutilisé : ${nom} (${existants.data[0].id})`);
    return existants.data[0];
  }
  const nouveau = await stripe.products.create({ name: nom });
  console.log(`   ✓ Nouveau produit créé : ${nom} (${nouveau.id})`);
  return nouveau;
}

async function trouverOuCreerPrix(produitId, montantCentimes, intervalle, nomAffichage) {
  const existants = await stripe.prices.list({
    product: produitId,
    active: true,
    limit: 100,
  });
  const correspondant = existants.data.find(
    (p) => p.unit_amount === montantCentimes && p.recurring?.interval === intervalle
  );
  if (correspondant) {
    console.log(`     ↪ Prix déjà existant, réutilisé : ${nomAffichage} (${correspondant.id})`);
    return correspondant;
  }
  const nouveau = await stripe.prices.create({
    product: produitId,
    unit_amount: montantCentimes,
    currency: "eur",
    recurring: { interval: intervalle },
  });
  console.log(`     ✓ Nouveau prix créé : ${nomAffichage} (${nouveau.id})`);
  return nouveau;
}

// =============================================================
// SCRIPT PRINCIPAL
// =============================================================
async function main() {
  console.log("=== CURSUS — Création des produits Stripe ===\n");
  verifierModeTest(STRIPE_SECRET_KEY);

  // Validation de TOUTE la grille avant le moindre appel API
  console.log("Validation des montants de la grille tarifaire...");
  for (const p of PALIERS) {
    validerMontant(p.mensuel, p.nom, "mensuel");
    validerMontant(p.annuel, p.nom, "annuel");
  }
  console.log("✓ Tous les montants sont valides.\n");

  const resultats = [];

  for (const palier of PALIERS) {
    console.log(`--- Palier : ${palier.nom} ---`);
    const produit = await trouverOuCreerProduit(`Cursus — ${palier.nom}`);

    const prixMensuel = await trouverOuCreerPrix(
      produit.id,
      palier.mensuel,
      "month",
      `${palier.nom} mensuel (${(palier.mensuel / 100).toFixed(2)}€)`
    );
    const prixAnnuel = await trouverOuCreerPrix(
      produit.id,
      palier.annuel,
      "year",
      `${palier.nom} annuel (${(palier.annuel / 100).toFixed(2)}€)`
    );

    resultats.push({
      palier: palier.nom,
      produit_id: produit.id,
      prix_mensuel_id: prixMensuel.id,
      prix_mensuel_eur: palier.mensuel / 100,
      prix_annuel_id: prixAnnuel.id,
      prix_annuel_eur: palier.annuel / 100,
    });
    console.log();
  }

  console.log("=== RÉSUMÉ FINAL — à copier dans ta config ===\n");
  console.log(JSON.stringify(resultats, null, 2));

  console.log("\n👉 Vérifie ces produits dans le Dashboard Stripe :");
  console.log("   https://dashboard.stripe.com/test/products");
}

main().catch((err) => {
  console.error("\n🛑 Erreur :", err.message);
  console.error("   Le script s'est arrêté ici. Relance-le simplement —");
  console.error("   il reprendra sans recréer ce qui existe déjà.\n");
  process.exit(1);
});
