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
 * Aperçu gratuit + pré-audit payant (référence 60816-01, suite, 23/08/2026)
 * ======================================================================
 * Après un aller-retour complet sur le sujet (voir l'historique dans
 * 2026-08-23-preaudit-vrai.sql), le travail en deux phases décrit par
 * l'auteur du projet le 15/08/2026 se répartit ainsi :
 *  - Phase 1, "aperçu" (GRATUIT, voir preaudit-global-cursaudit — nom de
 *    fonction déployée inchangé, renommé "aperçu" seulement en interne) :
 *    une lecture rapide, une page de synthèse, juste assez pour orienter.
 *  - Phase 2, "pré-audit" (PAYANT, preaudit-approfondi-cursaudit) : reprend
 *    l'aperçu et le développe — hypothèses à vérifier, échantillons précis,
 *    décision éditoriale. C'est CE prix-ci, calculé ci-dessous.
 *
 * Barème choisi par l'auteur du projet le 23/08/2026 — un pourcentage du
 * prix de l'audit détaillé (déjà connu à la création, pas besoin d'un
 * barème par tranche de mots séparé) plutôt qu'un tarif fixe :
 *  - Prix du pré-audit = 40 % du prix TTC de l'audit détaillé.
 *  - Si l'audit détaillé est commandé ensuite, 50 % du prix du pré-audit
 *    (= 20 % du prix de l'audit détaillé) en est déduit.
 *  - Total pré-audit + audit détaillé commandé ensuite = 120 % du prix de
 *    l'audit détaillé seul, au lieu de 140 % sans déduction.
 * Les deux pourcentages sont dans audit_pricing_rules (categorie
 * "parametre_global", clés "preaudit_pourcentage_prix_final" et
 * "preaudit_deduction_pourcentage") — pas en dur ici, ajustables sans
 * toucher au code. La déduction reste pour l'instant INFORMATIONNELLE :
 * aucun paiement Stripe n'existe encore pour CursAudit, donc rien ne
 * l'applique automatiquement au moment de payer l'audit détaillé.
 */
export function calculerPrixPreauditPourcentage(regles, prixAuditFinalTTC) {
  const pourcentage = regles.find((r) => r.categorie === "parametre_global" && r.cle === "preaudit_pourcentage_prix_final")?.valeur_numerique ?? 40;
  const deductionPourcentage = regles.find((r) => r.categorie === "parametre_global" && r.cle === "preaudit_deduction_pourcentage")?.valeur_numerique ?? 50;

  const prixTTC = Math.round(prixAuditFinalTTC * (pourcentage / 100) * 100) / 100;
  const reductionSurAuditFinal = Math.round(prixTTC * (deductionPourcentage / 100) * 100) / 100;
  const prixAuditFinalApresReduction = Math.round((prixAuditFinalTTC - reductionSurAuditFinal) * 100) / 100;

  return { prixTTC, pourcentage, reductionSurAuditFinal, prixAuditFinalApresReduction };
}

/**
 * Temps estimé d'un appel unique sur le manuscrit entier (référence
 * 60816-01, suite, 22/08/2026 — partagé par l'aperçu gratuit ET le
 * pré-audit payant, les deux étant UN SEUL appel Claude sur le texte
 * intégral, seule la taille de sortie diffère).
 * ======================================================================
 * ESTIMATION, pas une mesure — comme estimerDuréeCursAudit() ci-dessus, à
 * recalibrer sur un vrai test. La variable n'est pas le nombre d'unités
 * mais le temps de "prefill" (lecture du contexte par Claude) sur un texte
 * pouvant faire plusieurs dizaines de milliers de mots, plus la génération
 * de la sortie. Hypothèse : une base fixe + un terme qui croît doucement
 * avec la taille du texte. Volontairement PAS de fausse barre de
 * progression : un appel unique n'a pas de signal d'avancement réel à
 * afficher — voir la discussion du 23/08/2026 sur le traitement en
 * arrière-plan (pas de vraie tâche de fond côté serveur pour l'instant,
 * juste cet appel synchrone, largement sous la limite d'une heure fixée
 * par l'auteur du projet).
 */
const DUREE_BASE_APPEL_GLOBAL_SECONDES = 20;
const DUREE_PAR_10000_MOTS_SECONDES = 5;

export function estimerDuréeAppelGlobal(nombreMots) {
  const secondes = DUREE_BASE_APPEL_GLOBAL_SECONDES + (nombreMots / 10000) * DUREE_PAR_10000_MOTS_SECONDES;
  if (secondes < 60) return { secondes, texte: "moins d'une minute" };
  const minutes = Math.round(secondes / 60);
  return { secondes, texte: `environ ${minutes} min` };
}

/**
 * Mise en page — deux problèmes de qualité d'import détectés par
 * `diagnostiquerQualitéImport()` (segmenterCursAudit.js), chacun avec son
 * prix, fixés par l'auteur du projet le 24/08/2026 sur la base d'un vrai
 * manuscrit ("Oracle du Sermon sur la montagne") : un appel IA unique sur
 * le texte entier (même ordre de grandeur que l'aperçu gratuit — quelques
 * dizaines de secondes, coût négligeable), pas un forfait de main-d'œuvre
 * à l'heure. Prix fixes, pas de barème par mot : le coût réel varie très
 * peu avec la longueur du texte.
 *  - "structuration_seule" (9,90 € TTC) : uniquement la relecture pour
 *    regrouper les titres en chapitres/pages — le cas où la segmentation
 *    en paragraphes est déjà saine mais les titres sont quasi inexistants
 *    ou au mauvais niveau.
 *  - "complete" (12,90 € TTC) : reconstruction des paragraphes fragmentés
 *    ET structuration des titres — nécessaire dès que la segmentation est
 *    irrégulière (on ne peut pas fiablement recaler les titres sur des
 *    paragraphes déjà cassés).
 * PAS ENCORE RELIÉ à un vrai paiement — CursAudit n'a pas de Stripe
 * aujourd'hui, voir MisEnPageAPI.demander() dans api.js : la demande est
 * juste enregistrée en base, statut "en_attente_paiement", comme le
 * "brouillon" de l'audit détaillé lui-même.
 */
export const PRIX_MISE_EN_PAGE = {
  structuration_seule: 9.90,
  complete: 12.90,
};
