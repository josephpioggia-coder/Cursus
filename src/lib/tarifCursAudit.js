/**
 * CursAudit — Calcul du prix (référence 60816-01, suite)
 * ======================================================================
 * Reprend la formule de docs/cursaudit-tarification.md, mais à partir du
 * nombre RÉEL d'unités déjà segmentées plutôt que de l'estimation
 * pages × unités/page du calculateur original — ici les unités sont
 * connues avant paiement, plus précis qu'une estimation.
 *
 * Multiplicateur commercial : simplifié en une valeur fixe par palier
 * (Essentiel ×2, Approfondi ×3, Expert ×4), approximant la grille par
 * tranches de pages du calculateur original sans la reproduire à
 * l'identique — `audit_pricing_rules` ne stocke pas encore ce
 * multiplicateur par combinaison (noté comme non fait dans la migration
 * du 15/08/2026, `2026-08-15-cursaudit-schema.sql`). À affiner si le
 * produit se précise.
 *
 * Ne calcule PAS la remise abonné CursEdit (20 %, plafonnée à 50 % du
 * prix de l'abonnement) — nécessite de connaître l'abonnement actif de
 * l'auteur·e, hors périmètre de ce premier formulaire de création.
 */

const MULTIPLICATEUR_PAR_PALIER = { essentiel: 2, approfondi: 3, expert: 4, libre: 3 };

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
