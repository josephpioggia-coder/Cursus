/**
 * CursAudit — Calcul du prix (référence 60816-01, suite)
 * ======================================================================
 * Reprend la formule de docs/cursaudit-tarification.md, mais à partir du
 * nombre RÉEL d'unités déjà segmentées plutôt que de l'estimation
 * pages × unités/page du calculateur original — ici les unités sont
 * connues avant paiement, plus précis qu'une estimation.
 *
 * MULTIPLICATEUR SIMPLIFIÉ le 22/08/2026 — l'export complet du fichier
 * Excel d'origine (`CursAudit_Calculateur_Tarification.xlsx`, feuille
 * "Scénarios", 11 lignes) montre en réalité un multiplicateur constant de
 * 3,0x sur TOUS les scénarios (essentiel comme expert, 1 IA comme 2 IA +
 * arbitrage dialogique, 50 pages comme 250 pages) — les valeurs {3, 4, 4}
 * déduites juste avant, à partir d'une seule ligne de référence, étaient
 * une extrapolation erronée. Choix assumé pour l'instant : 3,0x partout,
 * quel que soit le palier. Vérifié contre les 11 lignes de l'export
 * (ex. 250 pages/30 dim/2 IA + arbitrage dialogique/Rapport complet →
 * 1041,31 € TTC calculé avec 3,0x, correspond à l'export). À revoir avec
 * l'auteur du projet si une différenciation par palier doit être
 * réintroduite plus tard (ex. paliers hauts plus rentables, ou l'inverse).
 *
 * Ne calcule PAS la remise abonné CursEdit (20 %, plafonnée à 50 % du
 * prix de l'abonnement) — nécessite de connaître l'abonnement actif de
 * l'auteur·e, hors périmètre de ce premier formulaire de création.
 */

const MULTIPLICATEUR_PAR_PALIER = { essentiel: 3, approfondi: 3, expert: 3, libre: 3 };

export function calculerPrixCursAudit(regles, { palier, modeIA, typeRapport, nombreUnites }) {
  const val = (categorie, cle) => regles.find((r) => r.categorie === categorie && r.cle === cle)?.valeur_numerique;

  const dimensions = val("palier_dimensions", palier) ?? 8;
  const facteurMode = val("mode_ia", modeIA) ?? 1;
  const coutRapport = val("type_rapport", typeRapport) ?? 0;
  const coutUniteBase = val("parametre_global", "cout_unite_base") ?? 0.013;
  const dimensionsRef = val("parametre_global", "dimensions_reference") ?? 8;
  const margeSecuritePct = val("parametre_global", "marge_securite_pct") ?? 15;
  const tvaPct = val("parametre_global", "tva_pct") ?? 21;

  const coutBrut = nombreUnites * coutUniteBase * (dimensions / dimensionsRef) * facteurMode;
  const coutAvecRapport = coutBrut + coutRapport;
  const coutSecurise = coutAvecRapport * (1 + margeSecuritePct / 100);
  const multiplicateur = MULTIPLICATEUR_PAR_PALIER[palier] ?? 3;
  const prixHT = coutSecurise * multiplicateur;
  const tva = prixHT * (tvaPct / 100);
  const prixTTC = prixHT + tva;

  return {
    dimensions,
    prixHT: Math.round(prixHT * 100) / 100,
    tva: Math.round(tva * 100) / 100,
    prixTTC: Math.round(prixTTC * 100) / 100,
  };
}

/**
 * Temps de traitement estimé (16/08/2026, suite).
 * ======================================================================
 * ESTIMATION, pas une mesure : `DUREE_MOYENNE_PAR_APPEL_IA_SECONDES` est
 * une hypothèse conservatrice, pas une valeur observée en conditions
 * réelles (aucun run complet de l'orchestrateur n'a encore été chronométré
 * de bout en bout). À recalibrer avec une vraie mesure dès qu'un audit
 * réel aura tourné jusqu'au bout — remplacer cette constante suffira,
 * la formule elle-même n'aura pas besoin de changer.
 *
 * Ce qui fait réellement varier le temps, d'après `analyser-unite-cursaudit`
 * (60816-01) : un appel IA (Claude) par unité, et un second appel (GPT),
 * SÉQUENTIEL et non parallèle, si mode_ia = "2 IA" — donc environ le
 * double de temps, pas le même temps avec un contrôle en plus "gratuit".
 * Le palier (nombre de critères demandés) et le format de rapport
 * n'allongent PAS le traitement dans l'implémentation actuelle : le
 * palier ne change que la taille du schéma de sortie par appel, pas le
 * nombre d'appels ; le format de rapport n'est pas encore généré du tout
 * (chantier séparé, non commencé) donc ne consomme aucun temps aujourd'hui.
 */
const DUREE_MOYENNE_PAR_APPEL_IA_SECONDES = 10;

export function estimerDuréeCursAudit({ modeIA, nombreUnites }) {
  const appelsParUnité = modeIA === "2 IA" ? 2 : 1;
  const secondes = nombreUnites * appelsParUnité * DUREE_MOYENNE_PAR_APPEL_IA_SECONDES;

  if (secondes < 60) return { secondes, texte: "moins d'une minute" };
  const minutes = Math.round(secondes / 60);
  if (minutes < 60) return { secondes, texte: `environ ${minutes} min` };
  const heures = Math.round((minutes / 60) * 10) / 10;
  return { secondes, texte: `environ ${heures} h` };
}

/**
 * Prix du pré-audit global (référence 60816-01, suite, 22/08/2026 — barème
 * révisé le même jour, le premier jugé trop cher par l'auteur du projet).
 * ======================================================================
 * Barème linéaire fourni par l'auteur du projet — +12€ HT par tranche de
 * 10 000 mots, de 24€ (10 000 mots) à 132€ (100 000 mots), stocké dans
 * audit_pricing_rules (categorie "preaudit_global_palier"). Au-delà de
 * 100 000 mots : continuité supposée à +12€ HT/tranche de 10 000 mots
 * (pas explicitement confirmée par l'auteur du projet — l'ancien barème
 * dégressif avait sa propre règle "au-delà" à +10€, qui n'a plus de sens
 * une fois la table elle-même devenue linéaire à +12€). En-dessous de
 * 10 000 mots, le tarif de la tranche 10 000 sert de plancher.
 *
 * Facturation "à la tranche entamée" (pas d'interpolation continue) :
 * 35 000 mots paient le tarif de la tranche 40 000, comme la règle "au-delà"
 * le fait explicitement pour les tranches au-dessus de 100 000.
 */
export function calculerPrixPreauditGlobal(regles, nombreMots) {
  const paliers = regles
    .filter((r) => r.categorie === "preaudit_global_palier")
    .map((r) => ({ seuil: Number(r.cle), prixHT: r.valeur_numerique }))
    .sort((a, b) => a.seuil - b.seuil);

  const tvaPct = regles.find((r) => r.categorie === "parametre_global" && r.cle === "tva_pct")?.valeur_numerique ?? 21;

  const dernierPalier = paliers[paliers.length - 1];
  let prixHT;
  if (!dernierPalier) {
    prixHT = 0; // règles non chargées — ne devrait pas arriver en usage normal
  } else if (nombreMots <= dernierPalier.seuil) {
    const palierTrouvé = paliers.find((p) => nombreMots <= p.seuil) ?? paliers[0];
    prixHT = palierTrouvé.prixHT;
  } else {
    const tranchesSupplémentaires = Math.ceil((nombreMots - dernierPalier.seuil) / 10000);
    prixHT = dernierPalier.prixHT + tranchesSupplémentaires * 12;
  }

  const tva = prixHT * (tvaPct / 100);
  const prixTTC = prixHT + tva;
  return {
    prixHT: Math.round(prixHT * 100) / 100,
    tva: Math.round(tva * 100) / 100,
    prixTTC: Math.round(prixTTC * 100) / 100,
  };
}

/**
 * Temps estimé du pré-audit global (référence 60816-01, suite, 22/08/2026).
 * ======================================================================
 * ESTIMATION, pas une mesure — comme estimerDuréeCursAudit() ci-dessus,
 * à recalibrer sur un vrai test. Contrairement à l'audit détaillé, il n'y
 * a QU'UN SEUL appel IA, quelle que soit la taille du livre — la variable
 * n'est donc pas le nombre d'unités mais le temps de "prefill" (lecture du
 * contexte par Claude) sur un texte pouvant faire plusieurs dizaines de
 * milliers de mots, plus une sortie courte et bornée (max_tokens=2048 côté
 * serveur). Hypothèse : une base fixe (démarrage de l'appel, génération de
 * la sortie) + un terme qui croît doucement avec la taille du texte.
 */
const DUREE_BASE_PREAUDIT_SECONDES = 20;
const DUREE_PAR_10000_MOTS_SECONDES = 5;

export function estimerDuréePreauditGlobal(nombreMots) {
  const secondes = DUREE_BASE_PREAUDIT_SECONDES + (nombreMots / 10000) * DUREE_PAR_10000_MOTS_SECONDES;
  if (secondes < 60) return { secondes, texte: "moins d'une minute" };
  const minutes = Math.round(secondes / 60);
  return { secondes, texte: `environ ${minutes} min` };
}
