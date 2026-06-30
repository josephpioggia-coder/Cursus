/**
 * TEST STRIPE — Scénario upgrade Découverte (annuel) -> Essentiel (annuel)
 * Vérifie que Stripe génère bien un AVOIR distinct + une NOUVELLE FACTURE
 * conformément à l'obligation légale française (pas de modification de facture émise).
 *
 * Usage:
 *   1. npm install stripe
 *   2. Remplacer STRIPE_SECRET_KEY ci-dessous par ta clé sk_test_... (jamais sk_live_...)
 *   3. node test-stripe-upgrade.mjs
 *
 * Ce script utilise UNIQUEMENT le mode test Stripe (aucun argent réel).
 */

import Stripe from "stripe";

// ⚠️ Remplace par ta clé secrète de TEST (commence par sk_test_)
const STRIPE_SECRET_KEY = "sk_test_VOTRE_CLE_ICI";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

async function main() {
  console.log("=== TEST UPGRADE CURSUS : Découverte -> Essentiel (annuel) ===\n");

  // 1. Créer un client de test
  console.log("1. Création du client test...");
  const customer = await stripe.customers.create({
    email: "test-upgrade@cursus.app",
    name: "Client Test Upgrade",
    description: "Client de test pour vérifier le scénario d'upgrade annuel",
  });
  console.log(`   ✓ Client créé: ${customer.id}\n`);

  // 2. Créer les produits et prix (si pas déjà existants)
  console.log("2. Création des produits Découverte et Essentiel...");

  const produitDecouverte = await stripe.products.create({
    name: "Cursus — Découverte (annuel)",
  });
  const prixDecouverte = await stripe.prices.create({
    product: produitDecouverte.id,
    unit_amount: 9900, // 99,00€ en centimes
    currency: "eur",
    recurring: { interval: "year" },
  });
  console.log(`   ✓ Découverte annuel: ${prixDecouverte.id} (99,00€/an)`);

  const produitEssentiel = await stripe.products.create({
    name: "Cursus — Essentiel (annuel)",
  });
  const prixEssentiel = await stripe.prices.create({
    product: produitEssentiel.id,
    unit_amount: 16900, // 169,00€ en centimes
    currency: "eur",
    recurring: { interval: "year" },
  });
  console.log(`   ✓ Essentiel annuel: ${prixEssentiel.id} (169,00€/an)\n`);

  // 3. Créer une méthode de paiement de test et l'attacher au client
  // (utilise un token de test pré-généré par Stripe, plus sûr que d'envoyer
  //  un numéro de carte brut — voir https://stripe.com/docs/testing)
  console.log("3. Attachement d'une carte de test...");
  const paymentMethod = await stripe.paymentMethods.create({
    type: "card",
    card: {
      token: "tok_visa", // token de test standard Stripe = équivaut à 4242 4242 4242 4242
    },
  });
  await stripe.paymentMethods.attach(paymentMethod.id, { customer: customer.id });
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: paymentMethod.id },
  });
  console.log(`   ✓ Carte de test attachée\n`);

  // 4. Créer l'abonnement Découverte
  console.log("4. Création de l'abonnement Découverte...");
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: prixDecouverte.id }],
  });
  console.log(`   ✓ Abonnement créé: ${subscription.id}`);
  console.log(`   ✓ Statut: ${subscription.status}`);
  console.log(`   ✓ Période actuelle: ${new Date(subscription.current_period_start * 1000).toLocaleDateString("fr-FR")} -> ${new Date(subscription.current_period_end * 1000).toLocaleDateString("fr-FR")}\n`);

  // 5. Lister les factures existantes (avant upgrade)
  console.log("5. Factures AVANT upgrade...");
  const facturesAvant = await stripe.invoices.list({ customer: customer.id, limit: 10 });
  facturesAvant.data.forEach((f) => {
    console.log(`   - Facture ${f.id} | ${(f.amount_paid / 100).toFixed(2)}€ | statut: ${f.status}`);
  });
  console.log();

  // 6. UPGRADE EN SÉQUENCE SÉCURISÉE — conforme à l'obligation légale française
  //    ET à la logique de trésorerie de Bleuclair :
  //
  //    A. Calcul du prorata RÉEL (au jour près, sur la durée effective)
  //    B. Émission d'une NOUVELLE FACTURE complète pour le nouveau plan (prix plein)
  //    C. Le client paie cette facture en entier
  //    D. SEULEMENT APRÈS paiement confirmé : émission de l'avoir + remboursement automatique
  //       (jamais l'inverse — on ne rembourse jamais avant d'être payé sur le nouveau plan)
  console.log("6. UPGRADE vers Essentiel — étape A : calcul du prorata réel...");

  const factureOrigine = facturesAvant.data[0];
  console.log(`   Facture d'origine: ${factureOrigine.id} (${(factureOrigine.amount_paid / 100).toFixed(2)}€)`);

  // Prorata au jour près, sur la durée RÉELLE de la période (pas un fixe 10 ou 12 mois)
  const maintenant = Math.floor(Date.now() / 1000);
  const debutPeriode = subscription.current_period_start;
  const finPeriode = subscription.current_period_end;
  const dureeTotalJours = (finPeriode - debutPeriode) / 86400;
  const dureeRestanteJours = (finPeriode - maintenant) / 86400;
  const fractionRestante = Math.max(0, Math.min(1, dureeRestanteJours / dureeTotalJours));
  const montantAvoir = Math.round(factureOrigine.amount_paid * fractionRestante);

  console.log(`   Durée totale de la période: ${dureeTotalJours.toFixed(0)} jours`);
  console.log(`   Durée restante: ${dureeRestanteJours.toFixed(0)} jours (${(fractionRestante * 100).toFixed(1)}%)`);
  console.log(`   Montant de l'avoir à terme: ${(montantAvoir / 100).toFixed(2)}€ (calculé maintenant, mais émis APRÈS paiement de la nouvelle facture)\n`);

  console.log("   Étape B : émission de la NOUVELLE FACTURE complète (prix plein Essentiel)...");
  const subscriptionItemId = subscription.items.data[0].id;

  // Change le plan sans facturation automatique mélangée
  const subscriptionUpgraded = await stripe.subscriptions.update(subscription.id, {
    items: [{ id: subscriptionItemId, price: prixEssentiel.id }],
    proration_behavior: "none",
    billing_cycle_anchor: "now",
  });

  const nouvelleFacture = await stripe.invoices.create({
    customer: customer.id,
    collection_method: "charge_automatically",
    description: "Facture Essentiel — nouvel abonnement annuel (prix plein)",
    auto_advance: true,
  });
  await stripe.invoiceItems.create({
    customer: customer.id,
    invoice: nouvelleFacture.id,
    amount: prixEssentiel.unit_amount,
    currency: "eur",
    description: "Cursus — Essentiel (annuel)",
  });
  const factureFinalisee = await stripe.invoices.finalizeInvoice(nouvelleFacture.id);
  console.log(`   ✓ Facture émise: ${factureFinalisee.id} | Montant dû: ${(factureFinalisee.amount_due / 100).toFixed(2)}€\n`);

  console.log("   Étape C : tentative de paiement de la nouvelle facture...");
  const facturePayee = await stripe.invoices.pay(factureFinalisee.id);
  const paiementReussi = facturePayee.status === "paid";
  console.log(`   ✓ Statut du paiement: ${facturePayee.status}`);
  console.log(`   ✓ Montant payé: ${(facturePayee.amount_paid / 100).toFixed(2)}€\n`);

  if (!paiementReussi) {
    console.log("   ✗ PAIEMENT NON CONFIRMÉ — aucun avoir ni remboursement ne sera émis.");
    console.log("   (C'est le comportement attendu : on ne rembourse jamais avant d'être payé.)\n");
  } else {
    console.log("   Étape D : paiement confirmé -> émission de l'avoir + remboursement automatique...");
    const avoir = await stripe.creditNotes.create({
      invoice: factureOrigine.id,
      lines: [
        {
          type: "custom_line_item",
          description: "Crédit au prorata temporis — passage à l'offre Essentiel",
          quantity: 1,
          unit_amount: montantAvoir,
        },
      ],
      reason: "order_change",
      refund_amount: montantAvoir, // remboursement automatique du montant total de l'avoir
    });
    console.log(`   ✓ Avoir émis: ${avoir.id} (${(avoir.amount / 100).toFixed(2)}€)`);
    console.log(`   ✓ Remboursement automatique déclenché: ${(avoir.refund_amount / 100).toFixed(2)}€\n`);
  }

  // 7. Vérifier les factures et avoirs générés APRÈS l'upgrade
  console.log("7. Factures APRÈS upgrade...");
  const facturesApres = await stripe.invoices.list({ customer: customer.id, limit: 10 });
  facturesApres.data.forEach((f) => {
    console.log(`   - Facture ${f.id} | ${(f.amount_paid / 100).toFixed(2)}€ | statut: ${f.status} | créée: ${new Date(f.created * 1000).toLocaleString("fr-FR")}`);
    console.log(`     Lignes de cette facture:`);
    f.lines.data.forEach((ligne) => {
      const montant = (ligne.amount / 100).toFixed(2);
      const signe = ligne.amount < 0 ? "(crédit)" : "";
      console.log(`       • ${ligne.description || "(sans description)"} : ${montant}€ ${signe}`);
    });
  });
  console.log();

  console.log("8. Avoirs (credit notes) générés...");
  const avoirs = await stripe.creditNotes.list({ customer: customer.id, limit: 10 });
  if (avoirs.data.length === 0) {
    console.log("   ⚠️ Aucun avoir trouvé — vérifier le comportement (peut dépendre de la version d'API / billing_mode)");
  } else {
    avoirs.data.forEach((a) => {
      console.log(`   - Avoir ${a.id} | ${(a.amount / 100).toFixed(2)}€ | facture liée: ${a.invoice} | raison: ${a.reason}`);
    });
  }
  console.log();

  console.log("=== RÉSUMÉ ===");
  console.log(`Client: ${customer.id}`);
  console.log(`Abonnement final: ${subscriptionUpgraded.id} (${subscriptionUpgraded.items.data[0].price.unit_amount / 100}€/an)`);
  console.log(`Nombre de factures: ${facturesApres.data.length}`);
  console.log(`Nombre d'avoirs: ${avoirs.data.length}`);
  console.log("\n👉 Va vérifier ces objets dans le Dashboard Stripe (mode Test) pour voir le détail visuel:");
  console.log(`   https://dashboard.stripe.com/test/customers/${customer.id}`);
}

main().catch((err) => {
  console.error("Erreur:", err.message);
  process.exit(1);
});
