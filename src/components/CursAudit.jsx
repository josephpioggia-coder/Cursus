/**
 * CURSAUDIT — Création d'un audit (référence 60816-01, suite, 16/08/2026)
 * ======================================================================
 * Interface de création : texte collé OU fichier .docx importé, choix de
 * la profondeur/mode/rapport, prix calculé en direct, création de l'audit.
 *
 * Import .docx ajouté après retour de l'auteur du projet : la formule
 * "coller le texte" seule était trop éloignée de ce que CursEdit propose
 * déjà (bouton "Importer un fichier Word") — voir extraireParagraphesDocx()
 * dans src/lib/segmenterCursAudit.js, qui reprend la lecture JSZip déjà
 * éprouvée dans ImportDocx.jsx, simplifiée (pas de détection de niveaux de
 * titre, CursAudit n'a pas besoin de distinguer parties/chapitres).
 *
 * QUESTIONNAIRE DE QUALIFICATION ajouté le 22/08/2026 (CursAuditQuestionnaire.jsx)
 * — porte d'entrée obligatoire avant le texte, reprend
 * questionnaire-cursaudit-v1-specification.md sections 1-5, 7, 10 (section 6
 * "préserver ma voix" hors périmètre, sections 8/9 déjà couvertes par le
 * palier/mode/rapport ci-dessous). La question libre et le degré
 * d'intervention sont transmis au moteur d'analyse ; le reste qualifie la
 * demande sans influencer encore le résultat.
 *
 * PAIEMENT RÉEL (référence 60816-01, suite, 07/09/2026) — l'audit créé
 * reste au statut "brouillon" jusqu'au paiement Stripe réel (checkout à
 * montant dynamique, voir demarrerCheckoutAudit()/creer-session-checkout/
 * stripe-webhook), confirmé exclusivement sur checkout.session.completed —
 * jamais à la création. Décision actée avec l'auteur du projet le
 * 16/08/2026 : le paiement vient APRÈS le texte/palier choisis, une fois
 * le prix exact connu — jamais avant, puisque le prix dépend du nombre
 * réel d'unités. Exception : le propriétaire du projet (EMAIL_PROPRIETAIRE
 * dans api.js) n'a jamais à payer ses propres audits de test.
 *
 * CONSENTEMENT À LA SUPERVISION (référence 60816-01, suite, 07/09/2026) —
 * voir 2026-09-07-consentement-supervision-cursaudit.sql. Case à cocher
 * obligatoire avant "Créer l'audit", recueillie à chaque audit (pas une
 * fois pour tout le compte) : l'auteur·ice accepte que les données
 * transmises soient supervisées/relues par l'équipe Cursus, dans un cadre
 * confidentiel, et qu'un premier examen puisse déboucher sur un devis si
 * un travail de relecture humaine non compris dans l'offre de base s'avère
 * nécessaire.
 *
 * CE QUE CETTE PAGE NE FAIT PAS ENCORE (limites assumées) :
 *  - Pas d'import .pdf — .docx et texte collé seulement.
 *  - Pas de remise abonné CursEdit dans le prix affiché (nécessite de
 *    connaître l'abonnement actif de l'auteur·e — hors périmètre ici).
 *  - Modes IA limités à "1 IA" et "2 IA", les deux seuls implémentés côté
 *    moteur — "confrontation ciblée"/"arbitrage dialogique" ne sont pas
 *    proposés plutôt que promis puis refusés à l'exécution.
 *  - Palier "Libre" (dimensions au choix) non proposé — seulement les
 *    trois paliers fixes.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { auditsAPI, misEnPageAPI } from "../lib/api.js";
import { demarrerCheckoutAudit } from "../lib/contenuPaliers.js";
import { segmenterTexte, analyserStructureDocx, regrouperParNiveaux, diagnostiquerQualitéImport } from "../lib/segmenterCursAudit.js";
import { calculerPrixCursAudit, estimerDuréeCursAudit, calculerPrixPreauditPourcentage, estimerDuréeAppelGlobal, PRIX_MISE_EN_PAGE } from "../lib/tarifCursAudit.js";
import CursAuditQuestionnaire, { CLÉ_BROUILLON_QUESTIONNAIRE } from "./CursAuditQuestionnaire.jsx";

const PALIERS = [
  { id: "essentiel", nom: "Essentiel", dimensions: 8, description: "Lecture exhaustive, coût minimal." },
  { id: "approfondi", nom: "Approfondi", dimensions: 15, description: "Analyse plus éditoriale." },
  { id: "expert", nom: "Expert", dimensions: 30, description: "Profondeur maximale." },
];

const MODES_IA = [
  { id: "1 IA", nom: "1 IA", description: "Une IA analyse toutes les unités." },
  { id: "2 IA", nom: "2 IA", description: "Une deuxième IA relit et contrôle la première." },
];

const TYPES_RAPPORT = [
  { id: "Aucun", nom: "Aucun" },
  { id: "Synthèse courte", nom: "Synthèse courte" },
  { id: "Rapport complet", nom: "Rapport complet" },
];

// CORRECTIF 27/08/2026 — perte réelle de travail signalée par l'auteur du
// projet : un texte collé entièrement dans ce formulaire n'existe QUE dans
// l'état React tant que "Créer l'audit" n'a pas réussi — aucune sauvegarde
// entre-temps. Le bug du bouton silencieusement désactivé (voir plus haut)
// a fait perdre un texte collé en entier lors d'un rechargement de page.
// Sauvegarde du brouillon dans localStorage à chaque changement, restauré
// à l'ouverture — protège contre un rechargement accidentel ou un bouton
// bloqué, quelle qu'en soit la cause future. Uniquement le texte collé et
// les réglages (pas le fichier .docx importé ni sa structure de chapitres,
// qui ne peuvent pas survivre à un rechargement de toute façon — le client
// devra réimporter le fichier si la perte survient pendant un import docx).
const CLÉ_BROUILLON = "cursaudit_brouillon";
function lireBrouillon() {
  try {
    const brut = localStorage.getItem(CLÉ_BROUILLON);
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}

export default function CursAudit({ onVoirAudits } = {}) {
  const brouillonInitial = useMemo(() => lireBrouillon(), []);
  const [brouillonRestauré] = useState(() => !!(brouillonInitial?.texte || brouillonInitial?.titre));

  // Questionnaire de qualification (22/08/2026) — porte d'entrée obligatoire
  // avant le texte, voir CursAuditQuestionnaire.jsx. null = pas encore rempli.
  const [questionnaire, setQuestionnaire] = useState(() => brouillonInitial?.questionnaire ?? null);

  const [titre, setTitre] = useState(() => brouillonInitial?.titre ?? "");
  const [source, setSource] = useState(() => brouillonInitial?.source ?? "coller"); // "coller" | "docx"
  const [texte, setTexte] = useState(() => brouillonInitial?.texte ?? "");
  // Lecture brute du .docx (réf. 60816-01, suite, 26/08/2026) — un seul
  // passage sur le fichier à l'import ; le regroupement en unités/chapitres
  // se recalcule ensuite (voir plus bas) à chaque changement des niveaux
  // de titre retenus par le client, sans relire le fichier. Voir
  // analyserStructureDocx() / regrouperParNiveaux() dans segmenterCursAudit.js.
  const [infosDocx, setInfosDocx] = useState(null); // null = rien importé
  const [niveauxDisponibles, setNiveauxDisponibles] = useState([]); // [{niveau, nombre}]
  // Niveaux de titre cochés par le client comme divisions (chapitres/parties)
  // — plusieurs à la fois possible (demande de l'auteur du projet le
  // 26/08/2026 : certains livres ont du contenu réel directement sous le
  // niveau le plus grossier — une "partie" avec un avant-propos avant ses
  // chapitres — d'autres n'en ont aucun ; un seul niveau auto-choisi ne
  // convient donc pas à tous les cas). Coché par défaut à l'import : le
  // niveau le plus grossier seul, pour préserver le comportement historique.
  const [niveauxRetenus, setNiveauxRetenus] = useState([]);

  // Regroupement dérivé — recalculé sans relire le fichier à chaque
  // changement de niveauxRetenus. chapitresDétectés reste `null` si import
  // non-.docx (texte collé, pas de style Word à lire) ou si aucune
  // structure de titres répétée n'a été trouvée, comme avant.
  const { unitésDocx, chapitresDétectés } = useMemo(() => {
    if (!infosDocx) return { unitésDocx: null, chapitresDétectés: null };
    const { unités: u, chapitres } = regrouperParNiveaux(infosDocx, niveauxRetenus);
    return { unitésDocx: u, chapitresDétectés: chapitres.length > 0 ? chapitres : null };
  }, [infosDocx, niveauxRetenus]);
  const [nomFichier, setNomFichier] = useState(null);
  const [importEnCours, setImportEnCours] = useState(false);
  const [erreurImport, setErreurImport] = useState(null);
  const inputFichierRef = useRef(null);

  const [palier, setPalier] = useState(() => brouillonInitial?.palier ?? "essentiel");
  const [modeIA, setModeIA] = useState(() => brouillonInitial?.modeIA ?? "1 IA");
  const [typeRapport, setTypeRapport] = useState(() => brouillonInitial?.typeRapport ?? "Aucun");
  const [reglesPrix, setReglesPrix] = useState(null);
  const [enCours, setEnCours] = useState(false);
  // 07/09/2026 — étape de paiement (référence 60816-01, suite)
  const [codePromoAudit, setCodePromoAudit] = useState("");
  const [checkoutEnCours, setCheckoutEnCours] = useState(false);
  const [erreurCheckout, setErreurCheckout] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [résultat, setRésultat] = useState(null);
  // Confirmation avant création (12/09/2026, réf. 60816-01, suite) — signalé
  // par l'auteur du projet après un test réel : un mauvais fichier (un
  // rapport déjà exporté, collé par erreur à la place du manuscrit) peut
  // être soumis sans qu'aucun contrôle n'en avertisse — CursEdit contrôle
  // toujours la mise en page avant d'agir, CursAudit ne le faisait pas
  // avant ce correctif. "Créer l'audit" n'appelle plus créer() directement :
  // il ouvre d'abord un aperçu exact (texte + structure de chapitres telle
  // que détectée, ou l'absence explicite de structure) que le client doit
  // confirmer. S'applique à tout audit, pas seulement à ceux avec
  // supervision demandée — le risque de soumettre le mauvais texte existe
  // pour tous.
  const [étapeConfirmation, setÉtapeConfirmation] = useState(false);
  // Consentement à la supervision (07/09/2026) — voir docblock en tête de
  // fichier et 2026-09-07-consentement-supervision-cursaudit.sql. Recueilli
  // à chaque audit, jamais restauré depuis le brouillon localStorage : une
  // case cochée avant un rechargement de page ne doit pas se recocher
  // silencieusement toute seule.
  const [consentementSupervision, setConsentementSupervision] = useState(false);
  // CORRECTIF 07/09/2026 — demande explicite de l'auteur du projet : le
  // consentement est "au coup par coup", jamais reporté implicitement sur
  // un projet différent. Sans ce garde-fou, cocher la case puis modifier
  // ensuite le texte/titre/fichier importé AVANT de cliquer "Créer
  // l'audit" aurait laissé la case cochée pour un contenu jamais montré
  // au moment de l'accord — contre-productif pour la confidentialité et
  // plus contraignant, pas moins, pour le propriétaire censé superviser
  // ce à quoi l'auteur·ice a réellement consenti.
  const premierRenduRef = useRef(true);
  useEffect(() => {
    if (premierRenduRef.current) { premierRenduRef.current = false; return; }
    setConsentementSupervision(false);
    setÉtapeConfirmation(false);
  }, [texte, titre, source, nomFichier]);

  // Mise en page (réf. 60816-01, suite, 24/08/2026) — voir
  // diagnostiquerQualitéImport() ci-dessous. null = pas encore demandée
  // pour cet import ; sinon la ligne créée dans demandes_mise_en_page.
  const [demandeMiseEnPage, setDemandeMiseEnPage] = useState(null);
  const [miseEnPageEnCours, setMiseEnPageEnCours] = useState(false);

  // CORRECTIF 27/08/2026 — bug réel signalé par l'auteur du projet : quand
  // ce chargement échoue, rien ne le signalait — reglesPrix restait à null
  // pour toujours, prix restait null, et le bouton "Créer l'audit" restait
  // désactivé SANS AUCUNE explication visible à l'écran. Ajout d'un état
  // d'erreur affiché avec un bouton pour réessayer, au lieu d'un échec
  // silencieux.
  const [erreurReglesPrix, setErreurReglesPrix] = useState(null);
  const chargerReglesPrix = useCallback(() => {
    setErreurReglesPrix(null);
    auditsAPI.récupérerReglesPrix().then(({ data, error }) => {
      if (error) setErreurReglesPrix(error.message || "Impossible de charger les règles de tarification.");
      else setReglesPrix(data || []);
    });
  }, []);
  useEffect(() => { chargerReglesPrix(); }, [chargerReglesPrix]);

  // Sauvegarde continue du brouillon (voir CLÉ_BROUILLON plus haut) — pas
  // tant que l'audit est déjà créé (résultat non nul), pour ne pas
  // réenregistrer un brouillon obsolète après coup.
  useEffect(() => {
    if (résultat) return;
    try {
      localStorage.setItem(CLÉ_BROUILLON, JSON.stringify({ questionnaire, titre, source, texte, palier, modeIA, typeRapport }));
    } catch {
      // localStorage indisponible (navigation privée, quota...) — le
      // brouillon ne survivra pas à un rechargement, mais ça ne doit pas
      // faire planter le formulaire pour autant.
    }
  }, [résultat, questionnaire, titre, source, texte, palier, modeIA, typeRapport]);

  const viderBrouillon = () => {
    try {
      localStorage.removeItem(CLÉ_BROUILLON);
      // Réf. 60816-01, suite, 29/08/2026 — le brouillon du questionnaire
      // (CursAuditQuestionnaire.jsx) est autonome, mais doit être effacé en
      // même temps que celui-ci (audit créé, ou "repartir de zéro") pour
      // qu'un brouillon obsolète ne préremplisse pas le prochain parcours.
      localStorage.removeItem(CLÉ_BROUILLON_QUESTIONNAIRE);
    } catch { /* voir plus haut */ }
  };

  const unités = useMemo(() => {
    if (source === "docx") return unitésDocx || [];
    return segmenterTexte(texte);
  }, [source, texte, unitésDocx]);

  // Aperçu de confirmation (12/09/2026) — début et fin du texte RÉELLEMENT
  // soumis (unités jointes, pas `texte` brut : pour un import .docx, `texte`
  // ne contient rien, c'est `unités` qui part vers l'audit). Tronqué à
  // l'affichage seulement, jamais dans ce qui est envoyé.
  const LONGUEUR_EXTRAIT = 600;
  const aperçuTexte = useMemo(() => {
    const texteComplet = unités.join("\n\n");
    if (texteComplet.length <= LONGUEUR_EXTRAIT * 2) return { court: true, texte: texteComplet };
    return {
      court: false,
      début: texteComplet.slice(0, LONGUEUR_EXTRAIT),
      fin: texteComplet.slice(-LONGUEUR_EXTRAIT),
    };
  }, [unités]);

  const prix = useMemo(() => {
    if (!reglesPrix || unités.length === 0) return null;
    return calculerPrixCursAudit(reglesPrix, { palier, modeIA, typeRapport, nombreUnites: unités.length });
  }, [reglesPrix, palier, modeIA, typeRapport, unités.length]);

  const durée = useMemo(() => {
    if (unités.length === 0) return null;
    return estimerDuréeCursAudit({ modeIA, nombreUnites: unités.length });
  }, [modeIA, unités.length]);

  // Aperçu gratuit + pré-audit payant (référence 60816-01, suite, 23/08/2026)
  // — purement informatif ici : l'aperçu se lance depuis l'écran de détail
  // (gratuit, un clic), et le pré-audit approfondi (payant, 40 % du prix de
  // l'audit détaillé) ne peut être proposé qu'une fois l'aperçu terminé —
  // voir CursAuditDetail.jsx. On calcule quand même le prix du pré-audit
  // ici à titre de teaser, puisque le prix de l'audit détaillé (sa base de
  // calcul) est déjà connu sur cet écran.
  const nombreMots = useMemo(
    () => unités.reduce((acc, u) => acc + (u?.split(/\s+/).filter(Boolean).length || 0), 0),
    [unités]
  );
  const duréeApercu = useMemo(() => (nombreMots === 0 ? null : estimerDuréeAppelGlobal(nombreMots)), [nombreMots]);
  const prixPreauditApprofondi = useMemo(() => {
    if (!reglesPrix || !prix) return null;
    return calculerPrixPreauditPourcentage(reglesPrix, prix.prixTTC);
  }, [reglesPrix, prix]);

  // Diagnostic qualité d'import (réf. 60816-01, suite, 24/08/2026) —
  // segmentation irrégulière et/ou titres quasi inexistants. Tant que
  // l'un des deux est détecté, la création de l'audit reste bloquée :
  // voir diagnostiquerQualitéImport() dans segmenterCursAudit.js pour le
  // pourquoi (un correctif silencieux fausserait le nombre d'unités et
  // le prix sans que le client comprenne pourquoi).
  const diagnosticImport = useMemo(() => {
    if (unités.length === 0) return null;
    return diagnostiquerQualitéImport({ nombreMots, nombreUnités: unités.length, chapitresDétectés });
  }, [unités.length, nombreMots, chapitresDétectés]);

  const problèmeMiseEnPage = diagnosticImport?.segmentationIrrégulière
    ? "complete"
    : diagnosticImport?.titresQuasiInexistants
      ? "structuration_seule"
      : null;

  const demanderMiseEnPage = async () => {
    if (!problèmeMiseEnPage) return;
    setMiseEnPageEnCours(true);
    const { data, error } = await misEnPageAPI.demander({
      nomFichier: nomFichier || titre.trim() || "texte collé",
      type: problèmeMiseEnPage,
      prixTTC: PRIX_MISE_EN_PAGE[problèmeMiseEnPage],
      nombreMots,
      nombreUnités: unités.length,
      nombreTitresDétectés: chapitresDétectés?.length ?? 0,
    });
    setMiseEnPageEnCours(false);
    if (!error) setDemandeMiseEnPage(data);
  };

  const importerFichier = async (fichier) => {
    if (!fichier?.name.endsWith(".docx")) { setErreurImport("Fichier .docx requis."); return; }
    setImportEnCours(true);
    setErreurImport(null);
    setDemandeMiseEnPage(null);
    try {
      const { infos, niveauxDisponibles: niveaux } = await analyserStructureDocx(fichier);
      if (!infos.some((i) => i.texte)) { setErreurImport("Aucun texte exploitable trouvé dans ce fichier."); setImportEnCours(false); return; }
      setInfosDocx(infos);
      setNiveauxDisponibles(niveaux);
      // Niveau le plus grossier coché par défaut — même comportement qu'avant
      // l'introduction de la sélection multiple.
      setNiveauxRetenus(niveaux.length > 0 ? [niveaux[0].niveau] : []);
      setNomFichier(fichier.name);
      if (!titre.trim()) setTitre(fichier.name.replace(/\.docx$/i, ""));
    } catch (e) {
      setErreurImport("Impossible de lire ce fichier : " + e.message);
    }
    setImportEnCours(false);
  };

  // Exemples de titres par niveau (12/09/2026) — demandé par l'auteur du
  // projet : "Niveau 2 (45 occurrences)" seul ne permet pas à l'auteur·ice
  // de vérifier concrètement ce que ce niveau désigne dans SON texte. Un
  // niveau technique (issu du style Word) doit être traduit en question
  // vérifiable : "est-ce bien ça, vos chapitres ?", avec de vrais titres du
  // document à l'appui, pas juste un chiffre.
  const exemplesParNiveau = useMemo(() => {
    if (!infosDocx) return {};
    const table = {};
    for (const { texte, niveau } of infosDocx) {
      if (niveau === undefined || !texte) continue;
      if (!table[niveau]) table[niveau] = [];
      if (table[niveau].length < 3) table[niveau].push(texte);
    }
    return table;
  }, [infosDocx]);

  const basculerNiveauRetenu = (niveau) => {
    setNiveauxRetenus((prev) =>
      prev.includes(niveau) ? prev.filter((n) => n !== niveau) : [...prev, niveau].sort((a, b) => a - b)
    );
  };

  const créer = async () => {
    if (!titre.trim() || unités.length === 0 || !prix || !consentementSupervision) return;
    setEnCours(true);
    setErreur(null);
    setRésultat(null);

    const palierChoisi = PALIERS.find((p) => p.id === palier);
    const nombrePagesEstimé = Math.max(1, Math.round(unités.length / 8.5));

    const { data, error } = await auditsAPI.créer({
      titre: titre.trim(),
      unités,
      palierDimensions: palier,
      nombreDimensions: palierChoisi.dimensions,
      modeIA,
      typeRapport,
      nombrePages: nombrePagesEstimé,
      prixTTC: prix.prixTTC,
      typeDocument: questionnaire?.typeDocument,
      statutTexte: questionnaire?.statutTexte,
      finaliteAudit: questionnaire?.finaliteAudit,
      questionLibre: questionnaire?.questionLibre,
      degreIntervention: questionnaire?.degreIntervention,
      contraintesAcademiques: questionnaire?.contraintesAcademiques,
      relationIA: questionnaire?.relationIA,
      contratIntention: questionnaire?.contratIntention,
      chapitresDétectés,
      consentementSupervision,
    });

    setEnCours(false);
    if (error) { setErreur(error.message || "Erreur lors de la création de l'audit."); return; }
    viderBrouillon();
    setRésultat(data);
  };

  const payerAudit = async () => {
    if (!résultat) return;
    setCheckoutEnCours(true);
    setErreurCheckout(null);
    const { error } = await demarrerCheckoutAudit(résultat.audit.id, résultat.audit.prix_ttc, titre, codePromoAudit);
    if (error) {
      setCheckoutEnCours(false);
      setErreurCheckout(error);
    }
    // Pas de setCheckoutEnCours(false) sur succès : la page redirige vers
    // Stripe (window.location.href), inutile de réactiver le bouton avant
    // de quitter la page.
  };

  const toutRéinitialiser = () => {
    viderBrouillon();
    setRésultat(null); setTitre(""); setTexte(""); setNomFichier(null); setSource("coller");
    setInfosDocx(null); setNiveauxDisponibles([]); setNiveauxRetenus([]);
    setDemandeMiseEnPage(null);
    setQuestionnaire(null);
    setConsentementSupervision(false);
  };

  // Section "Texte à auditer" (12/09/2026, réf. 60816-01, suite) — demandé
  // plusieurs fois par l'auteur du projet : l'import du texte doit se faire
  // DÈS LE DÉBUT du parcours, juste avant "Réutiliser les réponses d'un
  // audit précédent" (CursAuditQuestionnaire.jsx, étape "intro"), pas après
  // les 12 questions comme avant. L'état (source, texte, infosDocx…) reste
  // entièrement possédé ici — seule la JSX est extraite pour être passée en
  // prop à CursAuditQuestionnaire, qui l'affiche à sa juste place. Rendue
  // indépendamment de `questionnaire` : disponible dès l'écran "intro",
  // conservée ensuite (état non réinitialisé) si l'auteur·ice revient en
  // arrière via "Modifier mes réponses".
  const sectionTexte = (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--texte-secondaire)", marginBottom: 5 }}>Texte à auditer</label>

      <div style={{ display: "flex", gap: 6, marginBottom: 8, background: "#f5f5f5", borderRadius: 7, padding: 3 }}>
        <button type="button" onClick={() => setSource("coller")}
          style={{ flex: 1, padding: "6px 8px", borderRadius: 5, border: "none", fontFamily: "inherit", fontSize: 11.5, cursor: "pointer",
            background: source === "coller" ? "#fff" : "transparent", color: source === "coller" ? "#7F77DD" : "#999", fontWeight: source === "coller" ? 600 : 400,
            boxShadow: source === "coller" ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}>
          Coller le texte
        </button>
        <button type="button" onClick={() => setSource("docx")}
          style={{ flex: 1, padding: "6px 8px", borderRadius: 5, border: "none", fontFamily: "inherit", fontSize: 11.5, cursor: "pointer",
            background: source === "docx" ? "#fff" : "transparent", color: source === "docx" ? "#7F77DD" : "#999", fontWeight: source === "docx" ? 600 : 400,
            boxShadow: source === "docx" ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}>
          Importer un fichier Word
        </button>
      </div>

      {source === "coller" ? (
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={10} placeholder="Collez le texte ici…"
          style={{ width: "100%", padding: "9px 12px", border: "0.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
      ) : (
        <div style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: "24px 16px", textAlign: "center" }}>
          <input ref={inputFichierRef} type="file" accept=".docx" style={{ display: "none" }}
            onChange={(e) => importerFichier(e.target.files[0])} />
          <button type="button" onClick={() => inputFichierRef.current?.click()} disabled={importEnCours}
            style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: "#378ADD", color: "#fff", fontSize: 12.5, fontWeight: 500, cursor: importEnCours ? "default" : "pointer", fontFamily: "inherit" }}>
            {importEnCours ? "Lecture…" : "Choisir un fichier .docx"}
          </button>
          {nomFichier && !importEnCours && (
            <div style={{ fontSize: 11.5, color: "var(--texte-secondaire)", marginTop: 10 }}>
              « {nomFichier} » — {unitésDocx?.length || 0} unités extraites
              {chapitresDétectés && ` · ${chapitresDétectés.length} titres détectés (à confirmer après création, dans l'aperçu gratuit)`}
            </div>
          )}
          {nomFichier && !importEnCours && niveauxDisponibles.length === 0 && (
            <div style={{ marginTop: 10, textAlign: "left", background: "#FFF9EC", border: "1px solid #C4973A66", borderRadius: 6, padding: "8px 10px", fontSize: 11.5, color: "#8A6116" }}>
              Aucun niveau de titre Word détecté dans ce fichier — ce texte sera transmis comme un seul bloc continu, sans découpage par chapitre. Si votre livre a des chapitres, vérifiez qu'ils utilisent bien un style de titre Word (Titre 1, Titre 2…) avant d'importer ; sinon, la structure ne pourra pas être reconnue automatiquement.
            </div>
          )}
          {niveauxDisponibles.length > 0 && !importEnCours && (
            <div style={{ marginTop: 10, textAlign: "left" }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--texte-secondaire)", marginBottom: 6 }}>
                Quel niveau de titre correspond à vos chapitres ? Vérifiez avec les exemples ci-dessous et cochez celui (ou ceux) qui séparent vraiment votre texte :
              </div>
              {niveauxDisponibles.map(({ niveau, nombre }) => (
                <label key={niveau} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "var(--texte-secondaire)", padding: "5px 0", cursor: "pointer" }}>
                  <input type="checkbox" checked={niveauxRetenus.includes(niveau)} onChange={() => basculerNiveauRetenu(niveau)} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>
                    <strong>Niveau {niveau}</strong> ({nombre} occurrence{nombre > 1 ? "s" : ""})
                    {exemplesParNiveau[niveau]?.length > 0 && (
                      <span style={{ display: "block", fontStyle: "italic", color: "var(--texte-tertiaire)", marginTop: 2 }}>
                        Ex. : {exemplesParNiveau[niveau].map((t) => `« ${t} »`).join(", ")}{nombre > exemplesParNiveau[niveau].length ? "…" : ""}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}
          {erreurImport && <div style={{ fontSize: 11.5, color: "#A32D2D", marginTop: 10 }}>{erreurImport}</div>}
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--texte-tertiaire)", marginTop: 4 }}>{unités.length} unité{unités.length > 1 ? "s" : ""} détectée{unités.length > 1 ? "s" : ""}</div>

      {problèmeMiseEnPage && (
        <div style={{ marginTop: 12, background: "#FCEBEB", border: "0.5px solid #A32D2D50", borderRadius: 8, padding: "14px 16px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#A32D2D", marginBottom: 6 }}>
            Mise en page à résoudre avant de créer cet audit
          </div>
          <div style={{ fontSize: 11.5, color: "var(--texte-secondaire)", lineHeight: 1.6, marginBottom: 8 }}>
            {diagnosticImport.segmentationIrrégulière && (
              <>Ce fichier semble présenter une segmentation irrégulière ({diagnosticImport.moyenneMotsParUnité.toFixed(1).replace(".", ",")} mots par unité en moyenne, probablement une ligne = un paragraphe à l'export). Cela gonfle artificiellement le nombre d'unités, donc le prix et le temps de l'audit détaillé. </>
            )}
            {diagnosticImport.titresQuasiInexistants && (
              <>Ce texte ({nombreMots.toLocaleString("fr-FR")} mots) ne présente presque aucun titre de chapitre détecté ({chapitresDétectés?.length ?? 0}) — la structure du pré-audit enrichi chapitre par chapitre ne pourra pas être proposée correctement. </>
            )}
            Deux options : corrigez la mise en forme vous-même dans votre traitement de texte et réimportez le fichier, ou confiez-nous cette mise en page.
          </div>
          {demandeMiseEnPage ? (
            <div style={{ fontSize: 11.5, color: "#1D9E75", fontWeight: 500 }}>
              Demande enregistrée ({PRIX_MISE_EN_PAGE[problèmeMiseEnPage].toFixed(2).replace(".", ",")} € TTC). Le paiement CursAudit n'est pas encore disponible dans l'application —
              nous vous recontacterons pour la suite. Vous pourrez réimporter le fichier corrigé dès réception.
            </div>
          ) : (
            <button type="button" onClick={demanderMiseEnPage} disabled={miseEnPageEnCours}
              style={{ padding: "8px 14px", borderRadius: 7, border: "none", background: "#A32D2D", color: "#fff", fontSize: 12, fontWeight: 500, cursor: miseEnPageEnCours ? "default" : "pointer", fontFamily: "inherit" }}>
              {miseEnPageEnCours ? "Envoi…" : `Commander la mise en page — ${PRIX_MISE_EN_PAGE[problèmeMiseEnPage].toFixed(2).replace(".", ",")} € TTC`}
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: "28px 32px", flex: 1, overflowY: "auto", maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--texte-primaire)", marginBottom: 4 }}>CursAudit</h1>
      <p style={{ fontSize: 13, color: "var(--texte-tertiaire)", marginBottom: 24 }}>
        Créer un nouvel audit — collez un texte ou importez un fichier Word, choisissez la profondeur d'analyse.
      </p>

      {brouillonRestauré && !résultat && (
        <div style={{ background: "#EFF3FF", border: "0.5px solid #4C6FE780", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12.5, color: "var(--texte-secondaire)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span>Brouillon restauré depuis ta dernière visite (texte collé et réglages conservés automatiquement, pour ne pas perdre ton travail).</span>
          <button onClick={toutRéinitialiser} style={{ background: "transparent", color: "#4C6FE7", border: "0.5px solid #4C6FE780", borderRadius: 6, padding: "5px 10px", fontSize: 11.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            Repartir de zéro
          </button>
        </div>
      )}

      {résultat ? (
        <div style={{ background: "#EAF3DE", border: "0.5px solid #1D9E75", borderRadius: 10, padding: "18px 20px" }}>
          <div style={{ fontWeight: 600, color: "#1D9E75", marginBottom: 6 }}>
            {résultat.audit.statut === "paye" ? "Audit créé et débloqué" : "Audit créé — en attente de paiement"}
          </div>
          <div style={{ fontSize: 13, color: "var(--texte-secondaire)", lineHeight: 1.7 }}>
            « {titre} » — {résultat.nombreUnités} unité{résultat.nombreUnités > 1 ? "s" : ""} créée{résultat.nombreUnités > 1 ? "s" : ""}.
            <br />
            Un aperçu gratuit du manuscrit est disponible dès maintenant depuis l'écran de détail de cet audit.
            {résultat.audit.statut === "paye" ? (
              <>
                <br />
                Compte propriétaire — audit détaillé débloqué sans paiement.
              </>
            ) : (
              <>
                <br />
                L'audit détaillé nécessite le paiement ci-dessous pour être lancé.
              </>
            )}
          </div>

          {/* 07/09/2026 — étape de paiement réelle (référence 60816-01, suite) —
              masquée si déjà payé (compte propriétaire, voir auditsAPI.créer). */}
          {résultat.audit.statut !== "paye" && (
          <div style={{ marginTop: 14, padding: "14px 16px", background: "#fff", border: "0.5px solid #1D9E7540", borderRadius: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: "var(--texte-primaire)", marginBottom: 10 }}>
              {résultat.audit.prix_ttc.toFixed(2).replace(".", ",")} € TTC
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                type="text"
                value={codePromoAudit}
                onChange={(e) => setCodePromoAudit(e.target.value)}
                placeholder="Code promotionnel (optionnel)"
                style={{
                  padding: "8px 12px", borderRadius: 7, border: "0.5px solid var(--border)",
                  fontFamily: "inherit", fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5,
                  flex: "1 1 200px",
                }}
              />
              <button
                onClick={payerAudit}
                disabled={checkoutEnCours}
                style={{
                  padding: "8px 18px", borderRadius: 7, border: "none", background: "#1D9E75", color: "#fff",
                  fontSize: 13, fontWeight: 600, cursor: checkoutEnCours ? "default" : "pointer",
                  fontFamily: "inherit", opacity: checkoutEnCours ? 0.6 : 1,
                }}
              >
                {checkoutEnCours ? "Redirection…" : "Payer et lancer l'audit"}
              </button>
            </div>
            {erreurCheckout && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#A32D2D" }}>{erreurCheckout}</div>
            )}
          </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={toutRéinitialiser}
              style={{ padding: "7px 14px", borderRadius: 7, border: "0.5px solid #1D9E75", background: "transparent", color: "#1D9E75", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
            >
              Créer un autre audit
            </button>
            {onVoirAudits && (
              <button
                onClick={onVoirAudits}
                style={{ padding: "7px 14px", borderRadius: 7, border: "none", background: "#1D9E75", color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
              >
                Voir mes audits
              </button>
            )}
          </div>
        </div>
      ) : !questionnaire ? (
        <CursAuditQuestionnaire sectionTexte={sectionTexte} onValider={(q) => {
          // 07/09/2026 — le titre est désormais demandé DANS le
          // questionnaire (juste à côté du choix de réutilisation), plus
          // ici en second temps : repris tel quel pour ne jamais le
          // redemander deux fois. N'écrase pas un titre déjà tapé ici si
          // le questionnaire n'en a fourni aucun (ex. contrat réimporté
          // sans titre renseigné).
          if (q.titre) setTitre(q.titre);
          setQuestionnaire(q);
        }} />
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--fond, #F7F4EF)", padding: "8px 14px", borderRadius: 8 }}>
            <span style={{ fontSize: 12, color: "var(--texte-secondaire)" }}>
              Questionnaire rempli — {questionnaire.typeDocument}, {questionnaire.finaliteAudit.length} objectif{questionnaire.finaliteAudit.length > 1 ? "s" : ""}
            </span>
            <button onClick={() => setQuestionnaire(null)} style={{ fontSize: 11.5, color: "#1D9E75", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              Modifier mes réponses
            </button>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--texte-secondaire)", marginBottom: 5 }}>Titre</label>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Titre de l'audit"
              style={{ width: "100%", padding: "9px 12px", border: "0.5px solid var(--border)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--fond, #F7F4EF)", padding: "8px 14px", borderRadius: 8 }}>
            <span style={{ fontSize: 12, color: "var(--texte-secondaire)" }}>
              {/* 12/09/2026 — le texte est désormais importé DANS le questionnaire
                  (étape "intro", voir sectionTexte plus haut) : ici, juste un
                  résumé de ce qui a déjà été fourni, pas le formulaire d'import
                  en double. "Modifier mes réponses" ci-dessus permet d'y revenir. */}
              Texte à auditer — {nomFichier ? `« ${nomFichier} »` : texte ? "texte collé" : "aucun texte fourni"}, {unités.length} unité{unités.length > 1 ? "s" : ""}
              {chapitresDétectés && ` · ${chapitresDétectés.length} chapitre${chapitresDétectés.length > 1 ? "s" : ""} détecté${chapitresDétectés.length > 1 ? "s" : ""}`}
            </span>
          </div>

          {problèmeMiseEnPage && (
            <div style={{ background: "#FCEBEB", border: "0.5px solid #A32D2D50", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#A32D2D", marginBottom: 6 }}>
                Mise en page à résoudre avant de créer cet audit
              </div>
              <div style={{ fontSize: 11.5, color: "var(--texte-secondaire)", lineHeight: 1.6, marginBottom: 8 }}>
                {diagnosticImport.segmentationIrrégulière && (
                  <>Ce fichier semble présenter une segmentation irrégulière ({diagnosticImport.moyenneMotsParUnité.toFixed(1).replace(".", ",")} mots par unité en moyenne, probablement une ligne = un paragraphe à l'export). Cela gonfle artificiellement le nombre d'unités, donc le prix et le temps de l'audit détaillé. </>
                )}
                {diagnosticImport.titresQuasiInexistants && (
                  <>Ce texte ({nombreMots.toLocaleString("fr-FR")} mots) ne présente presque aucun titre de chapitre détecté ({chapitresDétectés?.length ?? 0}) — la structure du pré-audit enrichi chapitre par chapitre ne pourra pas être proposée correctement. </>
                )}
                Deux options : corrigez la mise en forme vous-même dans votre traitement de texte et réimportez le fichier (bouton "Modifier mes réponses" ci-dessus), ou confiez-nous cette mise en page.
              </div>
              {demandeMiseEnPage ? (
                <div style={{ fontSize: 11.5, color: "#1D9E75", fontWeight: 500 }}>
                  Demande enregistrée ({PRIX_MISE_EN_PAGE[problèmeMiseEnPage].toFixed(2).replace(".", ",")} € TTC). Le paiement CursAudit n'est pas encore disponible dans l'application —
                  nous vous recontacterons pour la suite. Vous pourrez réimporter le fichier corrigé dès réception.
                </div>
              ) : (
                <button onClick={demanderMiseEnPage} disabled={miseEnPageEnCours}
                  style={{ padding: "8px 14px", borderRadius: 7, border: "none", background: "#A32D2D", color: "#fff", fontSize: 12, fontWeight: 500, cursor: miseEnPageEnCours ? "default" : "pointer", fontFamily: "inherit" }}>
                  {miseEnPageEnCours ? "Envoi…" : `Commander la mise en page — ${PRIX_MISE_EN_PAGE[problèmeMiseEnPage].toFixed(2).replace(".", ",")} € TTC`}
                </button>
              )}
            </div>
          )}

          {nombreMots > 0 && (
            <div style={{ background: "#FFFBF2", border: "0.5px solid #C4973A80", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#8A6116", marginBottom: 4 }}>
                Avant l'audit détaillé : un aperçu gratuit ({nombreMots.toLocaleString("fr-FR")} mots)
              </div>
              <div style={{ fontSize: 11.5, color: "var(--texte-secondaire)", lineHeight: 1.5 }}>
                L'audit détaillé ci-dessous examine chaque unité séparément. Une fois cet audit créé, un aperçu
                gratuit du manuscrit entier (colonne vertébrale, tensions, risques) sera disponible en un clic
                depuis l'écran de détail{duréeApercu ? ` (${duréeApercu.texte})` : ""}. Vous pourrez ensuite,
                si vous le souhaitez, commander un pré-audit approfondi qui développe ces pistes avant de lancer
                l'audit détaillé{prixPreauditApprofondi ? ` — ${prixPreauditApprofondi.prixTTC.toFixed(2).replace(".", ",")} € TTC (${prixPreauditApprofondi.pourcentage} % du prix ci-dessous, dont une partie déductible si vous commandez ensuite l'audit détaillé)` : ""}.
              </div>
            </div>
          )}

          {/* Palier + mode + format répondent aux sections 8 (niveau de preuve
              attendu) et 9 (sortie attendue) du questionnaire — pas de champ
              séparé, voir la note technique de
              questionnaire-cursaudit-v1-specification.md. */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--texte-secondaire)", marginBottom: 5 }}>Palier de profondeur</label>
            <div style={{ display: "flex", gap: 8 }}>
              {PALIERS.map((p) => (
                <button key={p.id} onClick={() => setPalier(p.id)}
                  style={{
                    flex: 1, padding: "10px 8px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    border: palier === p.id ? "1.5px solid #7F77DD" : "0.5px solid var(--border)",
                    background: palier === p.id ? "#7F77DD10" : "transparent",
                  }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: palier === p.id ? "#7F77DD" : "var(--texte-primaire)" }}>{p.nom} ({p.dimensions})</div>
                  <div style={{ fontSize: 10.5, color: "var(--texte-tertiaire)", marginTop: 2 }}>{p.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--texte-secondaire)", marginBottom: 5 }}>Mode IA</label>
            <div style={{ display: "flex", gap: 8 }}>
              {MODES_IA.map((m) => (
                <button key={m.id} onClick={() => setModeIA(m.id)}
                  style={{
                    flex: 1, padding: "10px 8px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    border: modeIA === m.id ? "1.5px solid #7F77DD" : "0.5px solid var(--border)",
                    background: modeIA === m.id ? "#7F77DD10" : "transparent",
                  }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: modeIA === m.id ? "#7F77DD" : "var(--texte-primaire)" }}>{m.nom}</div>
                  <div style={{ fontSize: 10.5, color: "var(--texte-tertiaire)", marginTop: 2 }}>{m.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--texte-secondaire)", marginBottom: 5 }}>Format de rapport</label>
            <select value={typeRapport} onChange={(e) => setTypeRapport(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", border: "0.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }}>
              {TYPES_RAPPORT.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
            </select>
          </div>

          {prix && (
            <div style={{ background: "var(--surface, #fff)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 12, color: "var(--texte-tertiaire)" }}>Prix estimé (hors remise abonné)</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: "var(--texte-primaire)" }}>{prix.prixTTC.toFixed(2).replace(".", ",")} € <span style={{ fontSize: 11, fontWeight: 400, color: "var(--texte-tertiaire)" }}>TTC</span></span>
              </div>
              {durée && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6, paddingTop: 6, borderTop: "0.5px solid var(--border)" }}>
                  <span style={{ fontSize: 12, color: "var(--texte-tertiaire)" }}>Temps de traitement estimé</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--texte-secondaire)" }}>{durée.texte}</span>
                </div>
              )}
            </div>
          )}

          {erreur && (
            <div style={{ background: "#FCEBEB", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#A32D2D" }}>{erreur}</div>
          )}

          {erreurReglesPrix && (
            <div style={{ background: "#FCEBEB", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#A32D2D", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <span>Impossible de charger les tarifs — le bouton ci-dessous reste désactivé tant que ce n'est pas résolu ({erreurReglesPrix})</span>
              <button onClick={chargerReglesPrix} style={{ background: "#A32D2D", color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                Réessayer
              </button>
            </div>
          )}

          <label style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "var(--surface, #fff)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "12px 14px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={consentementSupervision}
              onChange={(e) => setConsentementSupervision(e.target.checked)}
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <span style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--texte-secondaire)" }}>
              <strong style={{ color: "var(--texte-primaire)" }}>Supervision demandée</strong> — J'accepte que le texte et les réponses transmis dans cet audit puissent être supervisés et relus par l'équipe Cursus,
              dans le cadre d'une clause de confidentialité et de déontologie professionnelle. Un retour de l'équipe Cursus suit un
              premier examen des données transmises ; si cet examen révèle qu'un travail de relecture humaine non compris dans
              l'offre de base est nécessaire, il peut donner lieu à un devis avant toute poursuite.
            </span>
          </label>

          {étapeConfirmation && (
            <div style={{ background: "#FFF9EC", border: "1px solid #C4973A80", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8A6116", marginBottom: 10 }}>
                Vérifie avant d'envoyer — c'est le texte ci-dessous, tel quel, qui sera soumis à l'audit{consentementSupervision ? " et lu par la supervision si demandé" : ""}.
              </div>

              <div style={{ fontSize: 12, color: "var(--texte-secondaire)", marginBottom: 8 }}>
                <strong>Titre :</strong> « {titre.trim()} » — {unités.length} unité{unités.length > 1 ? "s" : ""}, {nombreMots.toLocaleString("fr-FR")} mots.
              </div>

              <div style={{ fontSize: 12, color: "var(--texte-secondaire)", marginBottom: 10 }}>
                <strong>Structure de chapitres :</strong>{" "}
                {chapitresDétectés
                  ? `${chapitresDétectés.length} chapitre${chapitresDétectés.length > 1 ? "s" : ""} détecté${chapitresDétectés.length > 1 ? "s" : ""} (${chapitresDétectés.slice(0, 5).map((c) => `« ${c.titre} »`).join(", ")}${chapitresDétectés.length > 5 ? ", …" : ""}).`
                  : "aucune structure détectée — ce texte sera transmis comme un seul bloc continu, sans découpage par chapitre."}
              </div>

              <div style={{ background: "#fff", borderRadius: 6, padding: "10px 12px", fontSize: 12, lineHeight: 1.5, color: "var(--texte-primaire)", whiteSpace: "pre-wrap", maxHeight: 220, overflowY: "auto" }}>
                {aperçuTexte.court ? aperçuTexte.texte : (
                  <>
                    {aperçuTexte.début}
                    <div style={{ textAlign: "center", color: "var(--texte-tertiaire)", margin: "8px 0" }}>[… texte intermédiaire non affiché ici, {unités.length} unités au total …]</div>
                    {aperçuTexte.fin}
                  </>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button onClick={() => setÉtapeConfirmation(false)} disabled={enCours}
                  style={{ flex: 1, padding: "9px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", color: "var(--texte-secondaire)", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: enCours ? "default" : "pointer" }}>
                  Ce n'est pas le bon texte — modifier
                </button>
                <button onClick={créer} disabled={enCours}
                  style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: enCours ? "#ccc" : "#7F77DD", color: "#fff", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: enCours ? "default" : "pointer" }}>
                  {enCours ? "Création…" : "Oui, c'est le bon texte — créer l'audit"}
                </button>
              </div>
            </div>
          )}

          {!étapeConfirmation && (
            <button
              onClick={() => setÉtapeConfirmation(true)}
              disabled={enCours || !titre.trim() || unités.length === 0 || !prix || !!problèmeMiseEnPage || !consentementSupervision}
              style={{
                padding: "10px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                background: (enCours || !titre.trim() || unités.length === 0 || !prix || !!problèmeMiseEnPage || !consentementSupervision) ? "#ccc" : "#7F77DD",
                color: "#fff", cursor: (enCours || !titre.trim() || unités.length === 0 || !prix || !!problèmeMiseEnPage || !consentementSupervision) ? "default" : "pointer",
              }}
            >
              {enCours
                ? "Création…"
                : problèmeMiseEnPage
                  ? "Mise en page à résoudre avant création"
                  : !consentementSupervision
                    ? "Acceptez la supervision ci-dessus pour continuer"
                    : "Créer l'audit (brouillon)"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
