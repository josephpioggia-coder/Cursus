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
 * CE QUE CETTE PAGE NE FAIT PAS ENCORE (limites assumées) :
 *  - Pas d'import .pdf — .docx et texte collé seulement.
 *  - Pas de paiement : l'audit créé reste au statut "brouillon". Aucun
 *    flux Stripe pour CursAudit n'existe encore (voir
 *    docs/cursaudit-tarification.md) — lancer l'analyse réelle nécessite
 *    encore de repasser le statut à "paye" manuellement (SQL), comme pour
 *    les tests de analyser-unite-cursaudit / orchestrer-audit-cursaudit.
 *    Décision actée avec l'auteur du projet le 16/08/2026 : le paiement
 *    doit venir APRÈS le texte/palier choisis, une fois le prix exact
 *    connu — jamais avant, puisque le prix dépend du nombre réel d'unités.
 *  - Pas de remise abonné CursEdit dans le prix affiché (nécessite de
 *    connaître l'abonnement actif de l'auteur·e — hors périmètre ici).
 *  - Modes IA limités à "1 IA" et "2 IA", les deux seuls implémentés côté
 *    moteur — "confrontation ciblée"/"arbitrage dialogique" ne sont pas
 *    proposés plutôt que promis puis refusés à l'exécution.
 *  - Palier "Libre" (dimensions au choix) non proposé — seulement les
 *    trois paliers fixes.
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { auditsAPI, misEnPageAPI } from "../lib/api.js";
import { segmenterTexte, extraireParagraphesDocxAvecChapitres, diagnostiquerQualitéImport } from "../lib/segmenterCursAudit.js";
import { calculerPrixCursAudit, estimerDuréeCursAudit, calculerPrixPreauditPourcentage, estimerDuréeAppelGlobal, PRIX_MISE_EN_PAGE } from "../lib/tarifCursAudit.js";
import CursAuditQuestionnaire from "./CursAuditQuestionnaire.jsx";

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

export default function CursAudit({ onVoirAudits } = {}) {
  // Questionnaire de qualification (22/08/2026) — porte d'entrée obligatoire
  // avant le texte, voir CursAuditQuestionnaire.jsx. null = pas encore rempli.
  const [questionnaire, setQuestionnaire] = useState(null);

  const [titre, setTitre] = useState("");
  const [source, setSource] = useState("coller"); // "coller" | "docx"
  const [texte, setTexte] = useState("");
  const [unitésDocx, setUnitésDocx] = useState(null); // null = rien importé
  // Chapitres détectés à l'import .docx (réf. 60816-01, suite, 24/08/2026) —
  // null si import non-.docx (texte collé, pas de style Word à lire) ou si
  // aucune structure de titres répétée n'a été trouvée. Voir
  // extraireParagraphesDocxAvecChapitres() dans segmenterCursAudit.js.
  const [chapitresDétectés, setChapitresDétectés] = useState(null);
  const [nomFichier, setNomFichier] = useState(null);
  const [importEnCours, setImportEnCours] = useState(false);
  const [erreurImport, setErreurImport] = useState(null);
  const inputFichierRef = useRef(null);

  const [palier, setPalier] = useState("essentiel");
  const [modeIA, setModeIA] = useState("1 IA");
  const [typeRapport, setTypeRapport] = useState("Aucun");
  const [reglesPrix, setReglesPrix] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [résultat, setRésultat] = useState(null);

  // Mise en page (réf. 60816-01, suite, 24/08/2026) — voir
  // diagnostiquerQualitéImport() ci-dessous. null = pas encore demandée
  // pour cet import ; sinon la ligne créée dans demandes_mise_en_page.
  const [demandeMiseEnPage, setDemandeMiseEnPage] = useState(null);
  const [miseEnPageEnCours, setMiseEnPageEnCours] = useState(false);

  useEffect(() => {
    auditsAPI.récupérerReglesPrix().then(({ data, error }) => {
      if (!error) setReglesPrix(data || []);
    });
  }, []);

  const unités = useMemo(() => {
    if (source === "docx") return unitésDocx || [];
    return segmenterTexte(texte);
  }, [source, texte, unitésDocx]);

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
      const { unités: paragraphes, chapitres } = await extraireParagraphesDocxAvecChapitres(fichier);
      if (paragraphes.length === 0) { setErreurImport("Aucun texte exploitable trouvé dans ce fichier."); setImportEnCours(false); return; }
      setUnitésDocx(paragraphes);
      setChapitresDétectés(chapitres.length > 0 ? chapitres : null);
      setNomFichier(fichier.name);
      if (!titre.trim()) setTitre(fichier.name.replace(/\.docx$/i, ""));
    } catch (e) {
      setErreurImport("Impossible de lire ce fichier : " + e.message);
    }
    setImportEnCours(false);
  };

  const créer = async () => {
    if (!titre.trim() || unités.length === 0 || !prix) return;
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
      chapitresDétectés,
    });

    setEnCours(false);
    if (error) { setErreur(error.message || "Erreur lors de la création de l'audit."); return; }
    setRésultat(data);
  };

  const toutRéinitialiser = () => {
    setRésultat(null); setTitre(""); setTexte(""); setUnitésDocx(null); setNomFichier(null); setSource("coller");
    setChapitresDétectés(null);
    setDemandeMiseEnPage(null);
    setQuestionnaire(null);
  };

  return (
    <div style={{ padding: "28px 32px", flex: 1, overflowY: "auto", maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--texte-primaire)", marginBottom: 4 }}>CursAudit</h1>
      <p style={{ fontSize: 13, color: "var(--texte-tertiaire)", marginBottom: 24 }}>
        Créer un nouvel audit — collez un texte ou importez un fichier Word, choisissez la profondeur d'analyse.
      </p>

      {résultat ? (
        <div style={{ background: "#EAF3DE", border: "0.5px solid #1D9E75", borderRadius: 10, padding: "18px 20px" }}>
          <div style={{ fontWeight: 600, color: "#1D9E75", marginBottom: 6 }}>Audit créé</div>
          <div style={{ fontSize: 13, color: "var(--texte-secondaire)", lineHeight: 1.7 }}>
            « {titre} » — {résultat.nombreUnités} unité{résultat.nombreUnités > 1 ? "s" : ""} créée{résultat.nombreUnités > 1 ? "s" : ""}.
            <br />
            Un aperçu gratuit du manuscrit est disponible dès maintenant depuis l'écran de détail de cet audit.
            <br />
            Le paiement CursAudit n'est pas encore disponible dans l'application — en attendant, cet audit est
            directement utilisable (aucun paiement réel n'est effectué), pré-audit et analyse détaillée compris.
          </div>
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
        <CursAuditQuestionnaire onValider={setQuestionnaire} />
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

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--texte-secondaire)", marginBottom: 5 }}>Texte à auditer</label>

            <div style={{ display: "flex", gap: 6, marginBottom: 8, background: "#f5f5f5", borderRadius: 7, padding: 3 }}>
              <button onClick={() => setSource("coller")}
                style={{ flex: 1, padding: "6px 8px", borderRadius: 5, border: "none", fontFamily: "inherit", fontSize: 11.5, cursor: "pointer",
                  background: source === "coller" ? "#fff" : "transparent", color: source === "coller" ? "#7F77DD" : "#999", fontWeight: source === "coller" ? 600 : 400,
                  boxShadow: source === "coller" ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}>
                Coller le texte
              </button>
              <button onClick={() => setSource("docx")}
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
                <button onClick={() => inputFichierRef.current?.click()} disabled={importEnCours}
                  style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: "#378ADD", color: "#fff", fontSize: 12.5, fontWeight: 500, cursor: importEnCours ? "default" : "pointer", fontFamily: "inherit" }}>
                  {importEnCours ? "Lecture…" : "Choisir un fichier .docx"}
                </button>
                {nomFichier && !importEnCours && (
                  <div style={{ fontSize: 11.5, color: "var(--texte-secondaire)", marginTop: 10 }}>
                    « {nomFichier} » — {unitésDocx?.length || 0} unités extraites
                    {chapitresDétectés && ` · ${chapitresDétectés.length} titres détectés (à confirmer après création, dans l'aperçu gratuit)`}
                  </div>
                )}
                {erreurImport && <div style={{ fontSize: 11.5, color: "#A32D2D", marginTop: 10 }}>{erreurImport}</div>}
              </div>
            )}

            <div style={{ fontSize: 11, color: "var(--texte-tertiaire)", marginTop: 4 }}>{unités.length} unité{unités.length > 1 ? "s" : ""} détectée{unités.length > 1 ? "s" : ""}</div>
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
                Deux options : corrigez la mise en forme vous-même dans votre traitement de texte et réimportez le fichier, ou confiez-nous cette mise en page.
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

          <button
            onClick={créer}
            disabled={enCours || !titre.trim() || unités.length === 0 || !prix || !!problèmeMiseEnPage}
            style={{
              padding: "10px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              background: (enCours || !titre.trim() || unités.length === 0 || !prix || !!problèmeMiseEnPage) ? "#ccc" : "#7F77DD",
              color: "#fff", cursor: (enCours || !titre.trim() || unités.length === 0 || !prix || !!problèmeMiseEnPage) ? "default" : "pointer",
            }}
          >
            {enCours ? "Création…" : problèmeMiseEnPage ? "Mise en page à résoudre avant création" : "Créer l'audit (brouillon)"}
          </button>
        </div>
      )}
    </div>
  );
}
