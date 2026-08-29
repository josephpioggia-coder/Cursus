/**
 * CURSAUDIT — Détail d'un audit (référence 60816-01, suite, 22/08/2026)
 * ======================================================================
 * Écran de résultat, conçu pour rester exploitable sur un livre entier
 * (~1475 unités observées en test réel) — ce qui suppose de NE PAS obliger
 * à lire chaque commentaire un par un :
 *  - Un bandeau récapitule les comptages par catégorie de
 *    `diagnostic_priorite` (audit_criteria.categories, voir
 *    2026-08-22-audit-criteria-categories.sql) — le seul critère dont la
 *    valeur est fermée, tous les autres restent en texte libre.
 *  - Les catégories du bandeau filtrent la liste (clic pour activer/désactiver).
 *  - La liste est paginée côté client (PAR_PAGE lignes) plutôt que de tout
 *    afficher d'un coup.
 *  - Chaque ligne reste repliée sur son diagnostic ; le détail complet
 *    (tous les critères actifs du palier, pas seulement diagnostic_priorite)
 *    ne s'affiche qu'au clic, pour ne pas noyer la liste.
 *
 * "Lancer / continuer l'analyse" appelle orchestrer-audit-cursaudit en
 * boucle tant que `restantes > 0` — jusqu'ici cet appel n'existait que
 * comme script de test dans la console du navigateur ; c'est la première
 * fois qu'un bouton de l'application le déclenche. Reste néanmoins limité
 * par l'absence de paiement Stripe pour CursAudit : le bouton n'agit que
 * si `audits.statut` est déjà "paye" ou "en_traitement" (positionné
 * manuellement en SQL pour l'instant, voir docs/cursaudit-tarification.md).
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { auditsAPI, profilAuteurAPI } from "../lib/api.js";
import { supabase } from "../lib/supabase.js";
import { analyserStructureDocx, regrouperParNiveaux } from "../lib/segmenterCursAudit.js";
import { calculerPrixPreauditPourcentage } from "../lib/tarifCursAudit.js";
import { exporterPreauditWord } from "../lib/exportPreauditWord.js";
import { exporterAuditDetailleWord } from "../lib/exportAuditDetailleWord.js";
import { exporterFicheActionWord } from "../lib/exportFicheActionWord.js";

const ORCHESTRATEUR_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/orchestrer-audit-cursaudit";
// Nom de fonction déployée inchangé (preaudit-global-cursaudit) même si elle
// est renommée "aperçu" côté produit depuis le 23/08/2026 — voir son
// commentaire d'en-tête. Renommer la fonction déployée demanderait une
// action manuelle supplémentaire côté Supabase Dashboard, pas nécessaire ici.
const APERCU_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/preaudit-global-cursaudit";
const PREAUDIT_APPROFONDI_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/preaudit-approfondi-cursaudit";
const FICHE_ACTION_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/fiche-action-preaudit-cursaudit";
const SYNTHESE_AUDIT_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/synthese-audit-detaille-cursaudit";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const CATEGORIES_DIAGNOSTIC = [
  { id: "recevable",    label: "Recevable",     couleur: "#1D9E75" },
  { id: "a_nuancer",    label: "À nuancer",     couleur: "#C4973A" },
  { id: "a_sourcer",    label: "À sourcer",     couleur: "#D97706" },
  { id: "a_reformuler", label: "À reformuler",  couleur: "#4C6FE7" },
  { id: "a_verifier",   label: "À vérifier",    couleur: "#A32D2D" },
];

const PAR_PAGE = 20;

// Cadre de lecture retenu par CursAudit (réf. 60816-01, suite, 29/08/2026) —
// demande explicite de l'auteur du projet : le contrat d'intention et le
// profil auteur ne doivent pas rester un simple questionnaire préalable,
// ils doivent devenir la boussole visible de l'audit. "CursAudit ne doit pas
// seulement dire : voici ce que vaut le texte. Il doit dire : voici ce que
// vaut le texte par rapport à ce que vous cherchez à faire." Calculé ici en
// JS pur à partir des données déjà enregistrées (contrat_intention sur
// l'audit, profils_auteur), PAS régénéré par une IA : un simple reflet fidèle
// de ce qui a réellement été injecté dans les prompts d'analyse (voir
// construireContexteQualification dans analyser-unite-cursaudit,
// orchestrer-audit-cursaudit et preaudit-approfondi-cursaudit), jamais une
// synthèse qui pourrait diverger de la réalité du traitement.
const LABELS_DEGRE_INTERVENTION_COURT = {
  observer: "observer seulement",
  signaler: "signaler les problèmes",
  pistes: "proposer des pistes",
  reformulations_ponctuelles: "proposer des reformulations ponctuelles",
  reecrire_legerement: "réécrire légèrement",
  reecrire_librement: "réécrire librement",
};

function CadreLecture({ audit }) {
  const [profil, setProfil] = useState(null);
  useEffect(() => {
    profilAuteurAPI.récupérer().then(({ data }) => setProfil(data || null));
  }, []);

  const contrat = audit.contrat_intention;
  // Audit créé avant ce chantier (28-29/08/2026) : pas de contrat
  // d'intention enregistré — rien à afficher plutôt qu'inventer un cadre.
  if (!contrat) return null;

  const nature = contrat.natureProjet || {};
  const natureLabel = nature.famille === "Autre"
    ? (nature.autre || "Autre")
    : [nature.sousCategorie, nature.famille].filter(Boolean).join(" — ");
  const intentionPrincipale = [natureLabel, contrat.ouEnEtesVous, (contrat.objectifs || []).join(", ")]
    .filter(Boolean).join(" · ") || "non précisée";
  const lecteurVisé = (contrat.destinataires || []).join(", ") || "non précisé";
  const attentePrincipale = (contrat.attentesCursus || []).join(", ") || "non précisé";
  const critèreRéussite = (contrat.criteresReussite || []).join(", ") || "non précisé";
  const questionCentrale = audit.question_libre || "non précisée";
  const degréLabel = LABELS_DEGRE_INTERVENTION_COURT[audit.degre_intervention] || audit.degre_intervention || "non précisé";
  const profilUtilisé = profil && (profil.profession || profil.niveau_etudes)
    ? [profil.profession, profil.niveau_etudes].filter(Boolean).join(", ")
    : null;

  return (
    <div style={{ background: "#F2F7F5", border: "0.5px solid #1D9E7550", borderRadius: 10, padding: "14px 18px", marginBottom: 20, display: "grid", gap: 8 }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#146C50", marginBottom: 4 }}>
          Cadre de lecture retenu par CursAudit
        </div>
        <p style={{ fontSize: 11.5, color: "var(--texte-tertiaire)", lineHeight: 1.6 }}>
          CursAudit ne se contente pas de dire ce que vaut le texte — il le confronte à ce que vous cherchez à faire.
        </p>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--texte-secondaire)", display: "grid", gap: 4 }}>
        <div><strong>Profil auteur utilisé :</strong> {profilUtilisé || "non renseigné"}</div>
        <div><strong>Intention principale :</strong> {intentionPrincipale}</div>
        <div><strong>Lecteur visé :</strong> {lecteurVisé}</div>
        <div><strong>Attente principale :</strong> {attentePrincipale}</div>
        <div><strong>Critère de réussite :</strong> {critèreRéussite}</div>
        <div><strong>Question centrale posée à l'audit :</strong> {questionCentrale}</div>
        <div style={{ marginTop: 2, fontStyle: "italic" }}>
          <strong>Conséquence sur l'analyse :</strong> CursAudit priorise ces critères dans son analyse — {attentePrincipale} —
          avec un degré d'intervention limité à « {degréLabel} ».
        </div>
      </div>
    </div>
  );
}

// Synthèse éditoriale (réf. 60816-01, suite, 22/08/2026) — voir le
// commentaire dans analyser-unite-cursaudit/index.ts. `effet_lecteur` a son
// propre vocabulaire, distinct de CATEGORIES_DIAGNOSTIC ; `proposition` est
// une chaîne simple (ou null), pas un objet {valeur, commentaire} comme les
// autres champs — traitée à part dans le rendu plutôt que par la boucle générique.
const LABELS_EFFET_LECTEUR = {
  adhesion: "Adhésion", resistance: "Résistance", emotion: "Émotion", confusion: "Confusion",
  fatigue: "Fatigue", curiosite: "Curiosité", malaise: "Malaise",
  impression_de_profondeur: "Impression de profondeur", impression_de_repetition: "Impression de répétition",
};

function humaniserCle(cle) {
  return cle.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

// chapitreMaxIndex (réf. 60816-01, suite, 25/08/2026) — optionnel, pour
// tester l'audit détaillé sur "la partie 1" d'un livre (les premiers
// chapitres confirmés) plutôt que d'attendre les 752 unités/2h d'un livre
// entier à chaque essai. Voir orchestrer-audit-cursaudit : quand fourni,
// l'audit n'est jamais marqué "termine" (il reste des unités hors scope).
async function appelerOrchestrateur(auditId, signal, chapitreMaxIndex) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Session absente — recharge la page et reconnecte-toi.");

  const réponse = await fetch(ORCHESTRATEUR_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ audit_id: auditId, ...(chapitreMaxIndex !== undefined ? { chapitre_max_index: chapitreMaxIndex } : {}) }),
  });
  const données = await réponse.json();
  if (!réponse.ok) throw new Error(données?.message || données?.error || `HTTP ${réponse.status}`);
  return données;
}

// Aperçu gratuit — phase 1 (réf. 60816-01, suite, 22/08/2026, renommé
// "aperçu" le 23/08/2026) — un seul appel, pas de boucle (contrairement à
// l'orchestrateur détaillé) : le manuscrit entier tient dans un seul appel Claude.
async function appelerApercuGlobal(auditId) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Session absente — recharge la page et reconnecte-toi.");

  const réponse = await fetch(APERCU_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ audit_id: auditId }),
  });
  const données = await réponse.json();
  // "déjà_fait" (409) : l'aperçu a déjà été généré côté serveur mais l'écran
  // affichait encore le bouton "Lancer l'aperçu" (état local pas rafraîchi
  // après un clic précédent, ou double-clic) — pas une vraie erreur pour
  // l'utilisateur, juste un signal de resynchroniser l'affichage.
  if (réponse.status === 409 && données?.error === "déjà_fait") return données;
  if (!réponse.ok) throw new Error(données?.message || données?.error || `HTTP ${réponse.status}`);
  return données;
}

// Écart de taille entre chapitres jugé suspect (signe probable d'un titre
// manqué à la détection plutôt qu'un vrai déséquilibre voulu par
// l'auteur·ice) — réf. 60816-01, suite, 24/08/2026. Seuil arbitraire,
// ajustable si l'usage réel montre qu'il se déclenche trop ou pas assez.
const RATIO_TAILLE_SUSPECT = 5;

function ConfirmationChapitres({ audit, onTermine }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  // Réimport d'un fichier corrigé (réf. 60816-01, suite, 26/08/2026) —
  // signalé par l'auteur du projet : un titre coupé en deux à la
  // détection (ex. la fin du titre "II" détectée comme un chapitre à
  // part) n'avait aucun moyen d'être corrigé — pas de bouton pour dire
  // non, rouvrir le livre, corriger, et le réinsérer. Voir
  // auditsAPI.remplacerContenu(). Sélection multi-niveaux ajoutée le
  // 26/08/2026, même mécanisme et même raison qu'à la création
  // (CursAudit.jsx) : un seul niveau auto-choisi ne convenait pas à un
  // livre à parties ET chapitres imbriqués (ex. parties en Titre1,
  // chapitres en Titre2, les deux réels) — infosRéimport reste `null`
  // tant qu'aucun fichier n'a été choisi.
  const inputFichierRef = useRef(null);
  const [infosRéimport, setInfosRéimport] = useState(null);
  const [niveauxDisponibles, setNiveauxDisponibles] = useState([]);
  const [niveauxRetenus, setNiveauxRetenus] = useState([]);
  const [nomFichierRéimport, setNomFichierRéimport] = useState(null);

  const aperçuRéimport = useMemo(() => {
    if (!infosRéimport) return null;
    return regrouperParNiveaux(infosRéimport, niveauxRetenus);
  }, [infosRéimport, niveauxRetenus]);

  const chapitres = audit.chapitres_detectes;
  if (!chapitres || chapitres.length === 0) return null;

  const tailles = chapitres.map((c) => c.mots);
  const tailleSuspecte = Math.max(...tailles) > RATIO_TAILLE_SUSPECT * Math.max(1, Math.min(...tailles));

  const confirmer = async () => {
    setEnCours(true);
    setErreur(null);
    const { error } = await auditsAPI.confirmerChapitres(audit.id);
    if (error) setErreur(error.message);
    else await onTermine();
    setEnCours(false);
  };

  const choisirFichier = async (fichier) => {
    if (!fichier?.name.endsWith(".docx")) { setErreur("Fichier .docx requis."); return; }
    setEnCours(true);
    setErreur(null);
    try {
      const { infos, niveauxDisponibles: niveaux } = await analyserStructureDocx(fichier);
      if (!infos.some((i) => i.texte)) { setErreur("Aucun texte exploitable trouvé dans ce fichier."); setEnCours(false); return; }
      setInfosRéimport(infos);
      setNiveauxDisponibles(niveaux);
      setNiveauxRetenus(niveaux.length > 0 ? [niveaux[0].niveau] : []);
      setNomFichierRéimport(fichier.name);
    } catch (e) {
      setErreur("Impossible de lire ce fichier : " + e.message);
    }
    setEnCours(false);
  };

  const basculerNiveauRéimport = (niveau) => {
    setNiveauxRetenus((prev) =>
      prev.includes(niveau) ? prev.filter((n) => n !== niveau) : [...prev, niveau].sort((a, b) => a - b)
    );
  };

  const annulerRéimport = () => {
    setInfosRéimport(null); setNiveauxDisponibles([]); setNiveauxRetenus([]); setNomFichierRéimport(null); setErreur(null);
  };

  const validerRéimport = async () => {
    if (!aperçuRéimport || aperçuRéimport.unités.length === 0) { setErreur("Aucun texte exploitable trouvé dans ce fichier."); return; }
    setEnCours(true);
    setErreur(null);
    const { error } = await auditsAPI.remplacerContenu(audit.id, {
      unités: aperçuRéimport.unités,
      chapitresDétectés: aperçuRéimport.chapitres.length > 0 ? aperçuRéimport.chapitres : null,
    });
    if (error) setErreur(error.message);
    else await onTermine();
    setEnCours(false);
  };

  return (
    <div style={{
      border: `0.5px solid ${audit.chapitres_confirmes ? "#1D9E7580" : "#C4973A80"}`, borderRadius: 8,
      padding: "10px 12px", marginBottom: 12, background: audit.chapitres_confirmes ? "#EAF3DE" : "#fff",
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: audit.chapitres_confirmes ? "#1D9E75" : "#8A6116", marginBottom: 6 }}>
        {audit.chapitres_confirmes ? "✓ Découpage en chapitres confirmé" : "Découpage en chapitres à confirmer"}
      </div>
      <div style={{ fontSize: 12, color: "var(--texte-secondaire)", marginBottom: 8 }}>
        Nous avons détecté <strong>{chapitres.length} titres</strong> au même niveau dans votre fichier. Chaque titre confirmé sera lu individuellement par le pré-audit — ce n'est pas à nous de juger ce qui doit compter comme chapitre (préface, remerciements, etc. inclus si vous les avez mis à ce niveau) : à vous de vérifier que ce découpage correspond bien à votre livre avant de continuer.
      </div>
      <div style={{ display: "grid", gap: 3, marginBottom: 8, maxHeight: 160, overflowY: "auto" }}>
        {chapitres.map((c, i) => (
          <div key={i} style={{ fontSize: 11.5, display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i + 1}. {c.titre}</span>
            <span style={{ color: "var(--texte-tertiaire)", flexShrink: 0 }}>{c.mots.toLocaleString("fr-FR")} mots</span>
          </div>
        ))}
      </div>
      {tailleSuspecte && (
        <div style={{ fontSize: 11.5, color: "#A32D2D", marginBottom: 8 }}>
          ⚠️ Les tailles varient beaucoup d'un titre à l'autre — vérifiez qu'aucun titre de chapitre n'a été oublié dans votre fichier avant de confirmer.
        </div>
      )}
      {!audit.chapitres_confirmes && !infosRéimport && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={confirmer} disabled={enCours} style={{
            background: "#C4973A", color: "#fff", border: "none", borderRadius: 6,
            padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: enCours ? "default" : "pointer",
          }}>
            {enCours ? "…" : "Je confirme ce découpage"}
          </button>
          <input ref={inputFichierRef} type="file" accept=".docx" style={{ display: "none" }}
            onChange={(e) => choisirFichier(e.target.files[0])} />
          <button onClick={() => inputFichierRef.current?.click()} disabled={enCours} style={{
            background: "transparent", color: "#8A6116", border: "0.5px solid #C4973A80", borderRadius: 6,
            padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: enCours ? "default" : "pointer",
          }}>
            Ce n'est pas correct — importer un fichier corrigé
          </button>
        </div>
      )}
      {infosRéimport && (
        <div style={{ marginTop: 4, borderTop: "0.5px solid #C4973A40", paddingTop: 8 }}>
          <div style={{ fontSize: 11.5, color: "var(--texte-secondaire)", marginBottom: 6 }}>
            « {nomFichierRéimport} » — niveaux de titre à retenir comme divisions :
          </div>
          {niveauxDisponibles.map(({ niveau, nombre }) => (
            <label key={niveau} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--texte-secondaire)", padding: "2px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={niveauxRetenus.includes(niveau)} onChange={() => basculerNiveauRéimport(niveau)} />
              Niveau {niveau} ({nombre} occurrence{nombre > 1 ? "s" : ""})
            </label>
          ))}
          <div style={{ fontSize: 11.5, color: "var(--texte-tertiaire)", margin: "6px 0" }}>
            {aperçuRéimport.unités.length} unités, {aperçuRéimport.chapitres.length} titre{aperçuRéimport.chapitres.length > 1 ? "s" : ""} avec cette sélection.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={validerRéimport} disabled={enCours} style={{
              background: "#C4973A", color: "#fff", border: "none", borderRadius: 6,
              padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: enCours ? "default" : "pointer",
            }}>
              {enCours ? "…" : "Valider ce réimport"}
            </button>
            <button onClick={annulerRéimport} disabled={enCours} style={{
              background: "transparent", color: "var(--texte-tertiaire)", border: "0.5px solid var(--border)", borderRadius: 6,
              padding: "6px 14px", fontSize: 12, cursor: enCours ? "default" : "pointer",
            }}>
              Annuler
            </button>
          </div>
        </div>
      )}
      {erreur && <div style={{ marginTop: 6, fontSize: 11.5, color: "#A32D2D" }}>{erreur}</div>}
    </div>
  );
}

function ApercuGlobal({ audit, nombreMots, onTermine }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  // Repli façon Word (réf. 60816-01, suite, 26/08/2026) — une fois le
  // rapport lu, permet de le replier pour retrouver vite les boutons
  // d'action en dessous sans avoir à scroller devant tout le texte.
  // Jamais replié pendant que ça tourne : c'est là que s'affiche le seul
  // signal d'avancement réel.
  const [replié, setReplié] = useState(false);
  const résultat = audit.apercu_resultat;
  const ouvert = !replié || enCours;

  const lancer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      await appelerApercuGlobal(audit.id);
      await onTermine();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div style={{ border: "0.5px solid #C4973A80", borderRadius: 10, padding: "16px 18px", marginBottom: 16, background: "#FFFBF2" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <button
            onClick={() => setReplié((r) => !r)}
            disabled={enCours}
            aria-label={replié ? "Déplier" : "Replier"}
            style={{
              background: "none", border: "none", padding: "2px 0", marginTop: 1, fontSize: 11,
              color: "#8A6116", cursor: enCours ? "default" : "pointer", lineHeight: 1, flexShrink: 0,
            }}
          >
            {ouvert ? "▼" : "▶"}
          </button>
          <div>
            <div style={{ fontWeight: 600, color: "#8A6116", marginBottom: 2 }}>Aperçu gratuit du manuscrit</div>
            {ouvert && (
              <div style={{ fontSize: 12, color: "var(--texte-tertiaire)" }}>
                Une vue d'ensemble rapide avant l'audit détaillé — nature du texte, colonne vertébrale, tensions et risques à l'échelle du livre entier.
              </div>
            )}
          </div>
        </div>
        {audit.apercu_statut !== "termine" && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#8A6116" }}>Gratuit</div>
            <div style={{ fontSize: 10.5, color: "var(--texte-tertiaire)" }}>{nombreMots.toLocaleString("fr-FR")} mots</div>
          </div>
        )}
      </div>

      {ouvert && (
        <>
          <ConfirmationChapitres audit={audit} onTermine={onTermine} />

          {audit.apercu_statut !== "termine" && (
            <button onClick={lancer} disabled={enCours} style={{
              marginTop: 10, background: "#C4973A", color: "#fff", border: "none", borderRadius: 8,
              padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: enCours ? "default" : "pointer",
              opacity: enCours ? 0.6 : 1,
            }}>
              {enCours ? "Analyse en cours… (moins d'une minute en général)" : "Lancer l'aperçu"}
            </button>
          )}

          {erreur && <div style={{ marginTop: 10, fontSize: 12, color: "#A32D2D" }}>{erreur}</div>}

          {audit.apercu_statut === "termine" && résultat && (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12.5 }}>
                <span style={{ fontWeight: 600 }}>Genre apparent : </span>{résultat.genre_apparent}
                {résultat.genre_reel_probable && résultat.genre_reel_probable !== résultat.genre_apparent && (
                  <span style={{ color: "var(--texte-tertiaire)" }}> (forme réelle probable : {résultat.genre_reel_probable})</span>
                )}
              </div>
              <div style={{ fontSize: 12.5 }}><span style={{ fontWeight: 600 }}>Colonne vertébrale : </span>{résultat.colonne_vertebrale}</div>
              {résultat.tension_principale && (
                <div style={{ fontSize: 12.5 }}><span style={{ fontWeight: 600 }}>Tension principale : </span>{résultat.tension_principale}</div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "#1D9E75", marginBottom: 3 }}>Forces globales</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                    {(résultat.forces_globales || []).map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "#A32D2D", marginBottom: 3 }}>Risques globaux</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                    {(résultat.risques_globaux || []).map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              </div>
              {résultat.audit_recommande && (
                <div style={{ fontSize: 12.5, background: "#fff", border: "0.5px solid #C4973A50", borderRadius: 6, padding: "8px 10px" }}>
                  <span style={{ fontWeight: 600 }}>Recommandation pour l'audit détaillé : </span>
                  palier {résultat.audit_recommande.palier}
                  {résultat.audit_recommande.priorites?.length > 0 && ` — priorités : ${résultat.audit_recommande.priorites.join(", ")}`}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Pré-audit approfondi — phase 2, payante (réf. 60816-01, suite, 23/08/2026).
// N'apparaît qu'une fois l'aperçu (phase 1) terminé. Un seul appel Claude,
// pas de vraie tâche de fond serveur (voir la discussion documentée dans
// preaudit-approfondi-cursaudit/index.ts) — juste un état "en cours" sans
// pourcentage inventé, l'appel unique n'ayant pas de signal d'avancement réel.
async function appelerPreauditApprofondi(auditId) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Session absente — recharge la page et reconnecte-toi.");

  const réponse = await fetch(PREAUDIT_APPROFONDI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ audit_id: auditId }),
  });
  const données = await réponse.json();
  if (!réponse.ok) throw new Error(données?.message || données?.error || `HTTP ${réponse.status}`);
  return données;
}

// Fiche d'action éditoriale — second document, réf. 60816-01, suite,
// 27/08/2026 : demandé par l'auteur du projet après un test réel où le
// pré-audit complet d'un texte de deux pages avait produit un rapport de
// plusieurs dizaines de pages — le pré-audit reste utile en base/annexe,
// mais ne donne pas de fiche courte et actionnable. Un seul appel, ne relit
// jamais le manuscrit (voir fiche-action-preaudit-cursaudit/index.ts).
async function appelerFicheAction(auditId) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Session absente — recharge la page et reconnecte-toi.");

  const réponse = await fetch(FICHE_ACTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ audit_id: auditId }),
  });
  const donnéesFiche = await réponse.json();
  if (!réponse.ok) throw new Error(donnéesFiche?.message || donnéesFiche?.error || `HTTP ${réponse.status}`);
  return donnéesFiche;
}

// Synthèse de l'audit détaillé — équivalent de la fiche d'action ci-dessus,
// côté audit détaillé (réf. 60816-01, suite, 27/08/2026). Ne relit jamais
// les unités dans leur intégralité (voir
// synthese-audit-detaille-cursaudit/index.ts).
async function appelerSyntheseAuditDetaille(auditId) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Session absente — recharge la page et reconnecte-toi.");

  const réponse = await fetch(SYNTHESE_AUDIT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ audit_id: auditId }),
  });
  const donnéesSynthese = await réponse.json();
  if (!réponse.ok) throw new Error(donnéesSynthese?.message || donnéesSynthese?.error || `HTTP ${réponse.status}`);
  return donnéesSynthese;
}

// Libellé du bouton — réf. 60816-01, suite, 24/08/2026 : depuis le
// pré-audit enrichi chapitre par chapitre, le nombre d'étapes n'est plus
// fixe (dépend du nombre de chapitres confirmés), donc plus de compteur
// "x/3" figé. `dernierRésultat` = la dernière réponse de l'API (ou null
// avant le premier appel) ; `nbChapitres` = audit.chapitres_detectes
// (0 si aucun, ou si non confirmé — le pipeline reste alors global seul).
function libelléÉtapePréaudit(dernierRésultat, nbChapitres) {
  if (!dernierRésultat) return "Lecture du livre…";
  const { etape, chapitre_numero, chapitre_total, chapitre_titre } = dernierRésultat;
  if (etape === "brouillon") return "Relecture du livre…";
  if (etape === "chapitre_lecture") return `Lecture du chapitre ${chapitre_numero}/${chapitre_total} — ${chapitre_titre}…`;
  if (etape === "chapitre_relecture") return `Relecture du chapitre ${chapitre_numero}/${chapitre_total} — ${chapitre_titre}…`;
  // Après "critique" (pas de chapitres) ou après la relecture du DERNIER
  // chapitre confirmé, le prochain appel est la synthèse finale — aucune
  // étape intermédiaire ne le confirme avant que ce soit fini, donc ce
  // libellé reste affiché pendant tout cet appel (peut prendre 1-2 minutes).
  if (etape === "critique" || (etape === "chapitre_relecture" && chapitre_numero === chapitre_total)) {
    return "Lecture finale globale avant rédaction…";
  }
  return "Rédaction en cours…";
}

// Messages illustratifs qui défilent PENDANT chaque passage, réf. 60816-01,
// suite, 23/08/2026 — demande explicite de l'auteur du projet : ne pas
// laisser l'écran figé pendant l'attente. Différent de la barre de
// progression volontairement écartée ailleurs dans ce fichier : ce ne sont
// PAS des pourcentages ni des étapes réelles mesurées (un appel non
// streamé à Claude/GPT ne donne aucun signal d'avancement granulaire) —
// juste une illustration honnête du type de travail en cours à ce
// passage-là, pour donner de la texture à l'attente sans prétendre à une
// précision qu'on n'a pas.
const MESSAGES_PENDANT_PREAUDIT = {
  attente: [
    "Lecture du manuscrit entier…",
    "Repérage de la colonne vertébrale du texte…",
    "Analyse du contrat de lecture (promesse affichée vs. réalité)…",
    "Élaboration des trois voies éditoriales…",
    "Rédaction du plan d'intervention…",
    "Cartographie des personnages, lieux et motifs récurrents…",
  ],
  brouillon: [
    "Relecture du brouillon par un second moteur…",
    "Vérification de la cohérence interne du rapport…",
    "Recherche de manques ou de redites…",
  ],
  critique: [
    "Prise en compte des remarques retenues…",
    "Réécriture de la version finale…",
    "Finalisation du rapport…",
  ],
};

// Composant de rendu partagé — réf. 60816-01, suite, 27/08/2026. Même
// schéma de sortie (diagnostic/forces/points_a_traiter/priorites/
// risque_principal/action_immediate/a_eviter) pour la fiche d'action du
// pré-audit ET la synthèse de l'audit détaillé — un seul rendu, deux
// sources (fiche-action-preaudit-cursaudit / synthese-audit-detaille-cursaudit).
// Réf. 60816-01, suite, 28/08/2026 — signalé après un vrai constat de
// redondance à l'écran : quand ce composant est affiché juste après une
// FicheExecutive (cas de l'audit détaillé), `diagnostic`, `risque_principal`
// et `action_immediate` apparaissaient mot pour mot deux fois de suite sur
// la même page — la FicheExecutive les affiche déjà. `masquerResumeCourt`
// les masque ici dans ce cas précis ; resterait affiché normalement pour la
// fiche d'action du pré-audit, qui n'a pas de FicheExecutive au-dessus.
function FicheActionAffichage({ titre, fiche, masquerResumeCourt = false }) {
  return (
    <div style={{ marginTop: 12, background: "#fff", border: "1px solid #1D9E7580", borderRadius: 8, padding: "12px 14px", display: "grid", gap: 8 }}>
      <div style={{ fontWeight: 600, color: "#1D9E75", fontSize: 12.5 }}>{titre}</div>
      {!masquerResumeCourt && fiche.diagnostic && (
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>{fiche.diagnostic}</div>
      )}
      {masquerResumeCourt && (
        <div style={{ fontSize: 11, color: "var(--texte-tertiaire)", fontStyle: "italic" }}>
          Diagnostic, risque principal et première action déjà résumés dans la fiche exécutive ci-dessus — détail complet ci-dessous.
        </div>
      )}
      {fiche.forces?.length > 0 && (
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--texte-secondaire)", marginBottom: 3 }}>Ce qui tient déjà</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
            {fiche.forces.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}
      {fiche.points_a_traiter?.length > 0 && (
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--texte-secondaire)", marginBottom: 3 }}>Points à traiter</div>
          <div style={{ display: "grid", gap: 6 }}>
            {fiche.points_a_traiter.map((p, i) => (
              <div key={i} style={{ fontSize: 12.5, lineHeight: 1.5, background: "#F7F6FD", borderRadius: 6, padding: "6px 8px" }}>
                <strong>{p.constat}</strong> — {p.impact_lecteur}
                <div style={{ color: "#5B52C4", marginTop: 2 }}>→ {p.geste_concret}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {fiche.priorites?.length > 0 && (
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--texte-secondaire)", marginBottom: 3 }}>Priorités de réécriture</div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
            {[...fiche.priorites].sort((a, b) => a.rang.localeCompare(b.rang)).map((p, i) => <li key={i}>{p.action}</li>)}
          </ol>
        </div>
      )}
      {!masquerResumeCourt && fiche.risque_principal && (
        <div style={{ fontSize: 12.5, color: "#A32D2D" }}><strong>Risque si rien ne change —</strong> {fiche.risque_principal}</div>
      )}
      {!masquerResumeCourt && fiche.action_immediate && (
        <div style={{ fontSize: 12.5, background: "#EAF3DE", borderRadius: 6, padding: "6px 8px" }}><strong>Première action —</strong> {fiche.action_immediate}</div>
      )}
      {fiche.a_eviter?.length > 0 && (
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--texte-secondaire)", marginBottom: 3 }}>À éviter</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
            {fiche.a_eviter.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}
      <div style={{ fontSize: 11, color: "var(--texte-tertiaire)", fontStyle: "italic" }}>
        Le détail complet reste disponible ci-dessous et dans l'export Word.
      </div>
    </div>
  );
}

// Fiche exécutive — réf. 60816-01, suite, 27/08/2026. Réaction de l'auteur
// du projet à la synthèse de l'audit détaillé une fois développée sur ~8000
// mots : un document de cette ampleur (le "rapport consolidé", ci-dessous)
// a besoin d'une page de pilotage d'une à deux pages au-dessus, pas d'un
// remplacement plus court. Ne fait AUCUN appel supplémentaire : c'est une
// vue condensée du même résultat déjà reçu (rapport consolidé ou fiche
// d'action pré-audit), pas un second document généré séparément.
// Réf. 60816-01, suite, 28/08/2026 — signalé après un incident réel :
// deux exports Word du même rapport, générés à des moments différents
// (273 puis potentiellement plus d'unités analysées), pris pour deux
// documents différents faute d'indication du "instantané" que chacun
// représente. Affiche désormais explicitement à partir de combien
// d'unités le document a été produit et quand — jamais deux générations
// ne pourront plus se confondre silencieusement.
function libelléInstantané(fiche) {
  if (!fiche) return null;
  const morceaux = [];
  if (typeof fiche.nombre_unites_total === "number") {
    const échantillonné = typeof fiche.nombre_unites_echantillonnees === "number" && fiche.nombre_unites_echantillonnees < fiche.nombre_unites_total;
    morceaux.push(
      `généré à partir de ${fiche.nombre_unites_total} unité${fiche.nombre_unites_total > 1 ? "s" : ""} analysée${fiche.nombre_unites_total > 1 ? "s" : ""}` +
      (échantillonné ? ` (échantillon de ${fiche.nombre_unites_echantillonnees})` : "")
    );
  }
  if (fiche.analyse_le) {
    const d = new Date(fiche.analyse_le);
    morceaux.push(`le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`);
  }
  return morceaux.length > 0 ? morceaux.join(", ") : null;
}

function FicheExecutive({ fiche }) {
  if (!fiche) return null;
  const troisPremièresPriorités = [...(fiche.priorites ?? [])].sort((a, b) => a.rang.localeCompare(b.rang)).slice(0, 3);
  const troisPremiersAÉviter = (fiche.a_eviter ?? []).slice(0, 3);
  const instantané = libelléInstantané(fiche);
  return (
    <div style={{ marginTop: 12, background: "#F7F6FD", border: "1px solid #5B52C480", borderRadius: 8, padding: "12px 14px", display: "grid", gap: 8 }}>
      <div>
        <div style={{ fontWeight: 600, color: "#5B52C4", fontSize: 12.5 }}>Fiche exécutive — à lire en premier</div>
        {instantané && <div style={{ fontSize: 10.5, color: "var(--texte-tertiaire)", marginTop: 1 }}>{instantané}</div>}
      </div>
      {fiche.diagnostic && <div style={{ fontSize: 13, lineHeight: 1.5 }}>{fiche.diagnostic}</div>}
      {troisPremièresPriorités.length > 0 && (
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--texte-secondaire)", marginBottom: 3 }}>Priorités</div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
            {troisPremièresPriorités.map((p, i) => <li key={i}>{p.action}</li>)}
          </ol>
        </div>
      )}
      {fiche.action_immediate && (
        <div style={{ fontSize: 12.5, background: "#EAF3DE", borderRadius: 6, padding: "6px 8px" }}><strong>Première action —</strong> {fiche.action_immediate}</div>
      )}
      {fiche.risque_principal && (
        <div style={{ fontSize: 12.5, color: "#A32D2D" }}><strong>Risque principal —</strong> {fiche.risque_principal}</div>
      )}
      {troisPremiersAÉviter.length > 0 && (
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--texte-secondaire)", marginBottom: 3 }}>À éviter</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
            {troisPremiersAÉviter.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function PreauditApprofondi({ audit, reglesPrix, onTermine, onLancerAuditDetaille, peutLancerAuditDetaille, auditDetailleEnCours, chapitreLimite, onChapitreLimiteChange, totalUnites }) {
  const [enCours, setEnCours] = useState(false);
  // `progression` = la dernière réponse complète de l'API (pas juste
  // `.etape`) — réf. 60816-01, suite, 24/08/2026, nécessaire pour
  // construire un libellé réel avec le numéro/titre du chapitre en cours.
  const [progression, setProgression] = useState(null);
  const [indiceMessage, setIndiceMessage] = useState(0);
  const [erreur, setErreur] = useState(null);
  const [ficheActionEnCours, setFicheActionEnCours] = useState(false);
  const [erreurFicheAction, setErreurFicheAction] = useState(null);
  // Chrono visible pendant la génération — réf. 60816-01, suite, 27/08/2026 :
  // sans repère de temps qui avance, un appel de plusieurs dizaines de
  // secondes donne l'impression que la page est plantée.
  const [ficheActionChrono, setFicheActionChrono] = useState(0);
  useEffect(() => {
    if (!ficheActionEnCours) { setFicheActionChrono(0); return; }
    const début = Date.now();
    const intervalle = setInterval(() => setFicheActionChrono(Math.floor((Date.now() - début) / 1000)), 1000);
    return () => clearInterval(intervalle);
  }, [ficheActionEnCours]);
  const résultat = audit.preaudit_resultat;
  const nbChapitresConfirmés = audit.chapitres_confirmes ? (audit.chapitres_detectes?.length || 0) : 0;
  // Repli façon Word (réf. 60816-01, suite, 26/08/2026) — voir le
  // commentaire jumeau dans ApercuGlobal. Jamais replié pendant que le
  // pré-audit OU l'audit détaillé tourne : les deux affichent leur seul
  // signal d'avancement réel dans ce bloc.
  const [replié, setReplié] = useState(false);
  const ouvert = !replié || enCours || auditDetailleEnCours;

  const prix = useMemo(
    () => (reglesPrix ? calculerPrixPreauditPourcentage(reglesPrix, audit.prix_ttc) : null),
    [reglesPrix, audit.prix_ttc]
  );

  const libelléActuel = libelléÉtapePréaudit(progression, nbChapitresConfirmés);
  // Le texte illustratif qui défile ne s'affiche que pour les phases sans
  // signal réel granulaire (lecture globale, attente de la synthèse
  // finale) — pendant une phase de chapitre, le libellé réel (numéro +
  // titre) suffit déjà, un texte illustratif en plus n'ajouterait rien.
  const cléMessages = !progression ? "attente"
    : progression.etape === "brouillon" ? "brouillon"
    : libelléActuel === "Lecture finale globale avant rédaction…" ? "critique"
    : null;

  useEffect(() => {
    if (!enCours) return;
    setIndiceMessage(0);
    const intervalle = setInterval(() => setIndiceMessage((i) => i + 1), 3500);
    return () => clearInterval(intervalle);
  }, [enCours, cléMessages]);

  const messagesActuels = cléMessages ? (MESSAGES_PENDANT_PREAUDIT[cléMessages] ?? []) : [];
  const messageActuel = messagesActuels.length > 0 ? messagesActuels[indiceMessage % messagesActuels.length] : null;

  const lancer = async () => {
    setEnCours(true);
    setErreur(null);
    setProgression(null);
    try {
      // Le pipeline se fait en plusieurs appels HTTP séparés (un par
      // passage global, puis un par lecture/relecture de chapitre) pour
      // rester sous la limite de 150s imposée par Supabase Edge Functions
      // (voir le commentaire d'en-tête de preaudit-approfondi-cursaudit).
      // On rappelle la fonction jusqu'à ce qu'elle indique restant=false,
      // même principe que "Lancer/Continuer l'analyse" pour l'audit détaillé.
      let restant = true;
      while (restant) {
        const résultatAppel = await appelerPreauditApprofondi(audit.id);
        restant = résultatAppel.restant;
        setProgression(résultatAppel);
      }
      await onTermine();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
      setProgression(null);
    }
  };

  const lancerFicheAction = async () => {
    setFicheActionEnCours(true);
    setErreurFicheAction(null);
    try {
      await appelerFicheAction(audit.id);
      await onTermine();
    } catch (e) {
      setErreurFicheAction(e.message);
    } finally {
      setFicheActionEnCours(false);
    }
  };

  return (
    <div style={{ border: "0.5px solid #7F77DD80", borderRadius: 10, padding: "16px 18px", marginBottom: 24, background: "#F7F6FD" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <button
            onClick={() => setReplié((r) => !r)}
            disabled={enCours || auditDetailleEnCours}
            aria-label={replié ? "Déplier" : "Replier"}
            style={{
              background: "none", border: "none", padding: "2px 0", marginTop: 1, fontSize: 11,
              color: "#5B52C4", cursor: (enCours || auditDetailleEnCours) ? "default" : "pointer", lineHeight: 1, flexShrink: 0,
            }}
          >
            {ouvert ? "▼" : "▶"}
          </button>
          <div>
            <div style={{ fontWeight: 600, color: "#5B52C4", marginBottom: 2 }}>Rapport de décision éditoriale (pré-audit)</div>
            {ouvert && (
              <div style={{ fontSize: 12, color: "var(--texte-tertiaire)" }}>
                Pas un diagnostic qui constate — un plan : trois voies éditoriales, un plan d'intervention en chantiers concrets, des exemples actionnables, une prochaine étape.
              </div>
            )}
          </div>
        </div>
        {audit.preaudit_statut !== "termine" && prix && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#5B52C4" }}>{prix.prixTTC.toFixed(2).replace(".", ",")} €</div>
            <div style={{ fontSize: 10.5, color: "var(--texte-tertiaire)" }}>TTC · {prix.pourcentage} % du prix de l'audit détaillé</div>
          </div>
        )}
        {audit.preaudit_statut === "termine" && résultat && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {/* Réf. 60816-01, suite, 27/08/2026 — second document demandé
                par l'auteur du projet : le pré-audit complet reste utile en
                base/annexe, mais une fiche courte et actionnable manquait.
                Ne relit jamais le manuscrit, voir appelerFicheAction(). */}
            {/* Réf. 60816-01, suite, 27/08/2026 — le bouton restait affiché
                seulement tant que fiche_action_statut !== "termine" : une
                fois généré, plus aucun moyen de relancer sans passer par une
                remise à zéro SQL manuelle. Toujours affiché désormais, avec
                un libellé "Régénérer" une fois le premier résultat obtenu. */}
            <button
              onClick={lancerFicheAction}
              disabled={ficheActionEnCours}
              style={{
                background: "#fff", color: "#5B52C4", border: "1px solid #7F77DD80",
                borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600,
                cursor: ficheActionEnCours ? "default" : "pointer", opacity: ficheActionEnCours ? 0.6 : 1,
              }}
            >
              {ficheActionEnCours
                ? `Génération… (${ficheActionChrono} s)`
                : audit.fiche_action_statut === "termine"
                  ? "Régénérer la fiche d'action (pré-audit)"
                  : "Générer la fiche d'action (pré-audit)"}
            </button>
            <button
              onClick={() => exporterPreauditWord(audit, résultat)}
              style={{
                background: "#fff", color: "#5B52C4", border: "1px solid #7F77DD80",
                borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              Exporter le pré-audit (Word)
            </button>
            {/* Réf. 60816-01, suite, 28/08/2026 — manquait : la fiche
                d'action était consultable à l'écran mais pas exportable. */}
            {audit.fiche_action_statut === "termine" && audit.fiche_action_resultat && (
              <button
                onClick={() => exporterFicheActionWord(audit, audit.fiche_action_resultat, { titreDocument: "Fiche d'action éditoriale (pré-audit)", prefixeFichier: "fiche_action" })}
                style={{
                  background: "#fff", color: "#5B52C4", border: "1px solid #7F77DD80",
                  borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >
                Exporter la fiche d'action (Word)
              </button>
            )}
          </div>
        )}
      </div>

      {ouvert && <>
      {audit.preaudit_statut === "non_demande" && (
        <div style={{ fontSize: 11.5, color: "var(--texte-tertiaire)", marginTop: 8 }}>
          Paiement CursAudit pas encore disponible dans l'application — statut à positionner manuellement (SQL) en attendant.
          {prix && ` Si l'audit détaillé est commandé ensuite, ${prix.reductionSurAuditFinal.toFixed(2).replace(".", ",")} € seront déductibles de son prix.`}
        </div>
      )}

      {audit.preaudit_statut === "paye" && audit.chapitres_detectes && !audit.chapitres_confirmes && (
        <div style={{ fontSize: 11.5, color: "#8A6116", marginTop: 8 }}>
          Confirmez d'abord le découpage en chapitres ci-dessus (dans l'aperçu gratuit) pour débloquer le pré-audit.
        </div>
      )}

      {audit.preaudit_statut === "paye" && (!audit.chapitres_detectes || audit.chapitres_confirmes) && (
        <>
          <button onClick={lancer} disabled={enCours} style={{
            marginTop: 10, background: "#7F77DD", color: "#fff", border: "none", borderRadius: 8,
            padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: enCours ? "default" : "pointer",
            opacity: enCours ? 0.6 : 1,
          }}>
            {enCours ? libelléActuel : "Lancer le pré-audit"}
          </button>
          {enCours && messageActuel && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 11.5, color: "var(--texte-tertiaire)" }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%", background: "#7F77DD", flexShrink: 0,
                animation: "preauditPulse 1.2s ease-in-out infinite",
              }} />
              {messageActuel}
              <style>{"@keyframes preauditPulse { 0%, 100% { opacity: 0.25; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1); } }"}</style>
            </div>
          )}
        </>
      )}

      {erreur && <div style={{ marginTop: 10, fontSize: 12, color: "#A32D2D" }}>{erreur}</div>}
      {erreurFicheAction && <div style={{ marginTop: 10, fontSize: 12, color: "#A32D2D" }}>{erreurFicheAction}</div>}
      {ficheActionEnCours && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 11.5, color: "var(--texte-tertiaire)" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#5B52C4", flexShrink: 0, animation: "preauditPulse 1.2s ease-in-out infinite" }} />
          Génération de la fiche d'action en cours ({ficheActionChrono} s) — peut prendre une à deux minutes, ne ferme pas cette page.
          <style>{"@keyframes preauditPulse { 0%, 100% { opacity: 0.25; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1); } }"}</style>
        </div>
      )}

      {audit.fiche_action_statut === "termine" && audit.fiche_action_resultat && (
        <FicheActionAffichage titre="Fiche d'action éditoriale (pré-audit) — court et actionnable" fiche={audit.fiche_action_resultat} />
      )}

      {audit.preaudit_statut === "termine" && résultat && (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {résultat.resume_executif && (
            <div style={{ fontSize: 13, lineHeight: 1.6, background: "#fff", border: "1px solid #7F77DD50", borderRadius: 8, padding: "10px 12px" }}>
              {résultat.resume_executif}
            </div>
          )}

          {résultat.fiche_synthese && (
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px",
              fontSize: 12, background: "var(--fond, #F7F4EF)", borderRadius: 8, padding: "10px 12px",
            }}>
              <div><span style={{ fontWeight: 600, color: "var(--texte-tertiaire)" }}>Contrat annoncé </span>{résultat.fiche_synthese.contrat_annonce}</div>
              <div><span style={{ fontWeight: 600, color: "var(--texte-tertiaire)" }}>Contrat réel </span>{résultat.fiche_synthese.contrat_reel}</div>
              <div><span style={{ fontWeight: 600, color: "var(--texte-tertiaire)" }}>Écart principal </span>{résultat.fiche_synthese.ecart_principal}</div>
              <div><span style={{ fontWeight: 600, color: "var(--texte-tertiaire)" }}>Risque lecteur </span>{résultat.fiche_synthese.risque_lecteur}</div>
              <div><span style={{ fontWeight: 600, color: "var(--texte-tertiaire)" }}>Recommandation </span>{résultat.fiche_synthese.recommandation}</div>
              <div><span style={{ fontWeight: 600, color: "var(--texte-tertiaire)" }}>Priorité </span>{résultat.fiche_synthese.priorite}</div>
            </div>
          )}

          <div style={{ fontSize: 12.5 }}><span style={{ fontWeight: 600 }}>Nature réelle : </span>{résultat.nature_reelle}</div>
          <div style={{ fontSize: 12.5 }}>
            <span style={{ fontWeight: 600 }}>Promesse affichée : </span>{résultat.promesse_affichee}
            {résultat.ecart_promesse_execution && (
              <span style={{ color: "var(--texte-tertiaire)" }}> — écart : {résultat.ecart_promesse_execution}</span>
            )}
          </div>

          {résultat.voies_editoriales?.length > 0 && (
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "#5B52C4", marginBottom: 5 }}>Voies éditoriales possibles</div>
              <div style={{ display: "grid", gap: 6 }}>
                {résultat.voies_editoriales.map((v, i) => (
                  <div key={i} style={{ fontSize: 12.5, background: "#fff", border: "0.5px solid #7F77DD50", borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{v.nom}</span>
                      <span style={{ fontSize: 11, color: "var(--texte-tertiaire)", flexShrink: 0, textAlign: "right" }}>
                        Réécriture {v.ampleur_reecriture}
                        {v.duree_estimee_travail && <><br />{v.duree_estimee_travail}</>}
                      </span>
                    </div>
                    <div style={{ marginTop: 3, color: "var(--texte-secondaire)" }}>{v.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {résultat.recommandation_principale && (
            <div style={{ fontSize: 12.5, background: "#EAF3DE", border: "0.5px solid #1D9E75", borderRadius: 6, padding: "8px 10px" }}>
              <span style={{ fontWeight: 600, color: "#1D9E75" }}>Recommandation : </span>{résultat.recommandation_principale}
            </div>
          )}

          {résultat.plan_intervention?.length > 0 && (
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "#5B52C4", marginBottom: 5 }}>Plan d'intervention</div>
              <div style={{ display: "grid", gap: 6 }}>
                {résultat.plan_intervention.map((c, i) => (
                  <div key={i} style={{ fontSize: 12.5, background: "#fff", border: "0.5px solid #7F77DD50", borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ fontWeight: 600 }}>{c.chantier}</div>
                    <div style={{ marginTop: 3, color: "var(--texte-secondaire)" }}>{c.geste_editorial}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {résultat.exemples_concrets?.length > 0 && (
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--texte-secondaire)", marginBottom: 5 }}>Exemples concrets</div>
              <div style={{ display: "grid", gap: 8 }}>
                {résultat.exemples_concrets.map((ex, i) => (
                  <div key={i} style={{ fontSize: 12.5, background: "#fff", border: "0.5px solid var(--border)", borderRadius: 6, padding: "8px 10px", display: "grid", gap: 3 }}>
                    <div><span style={{ fontWeight: 600 }}>Problème — </span>{ex.probleme}</div>
                    <div><span style={{ fontWeight: 600 }}>Effet — </span>{ex.effet}</div>
                    <div><span style={{ fontWeight: 600, color: "#5B52C4" }}>Geste éditorial — </span>{ex.geste_editorial}</div>
                    <div><span style={{ fontWeight: 600, color: "#1D9E75" }}>Proposition — </span>{ex.proposition}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {résultat.a_preserver?.length > 0 && (
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "#1D9E75", marginBottom: 3 }}>À préserver</div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                  {résultat.a_preserver.map((f, i) => <li key={i} style={{ marginBottom: 4 }}>{f}</li>)}
                </ul>
              </div>
            )}
            {résultat.a_couper_ou_alleger?.length > 0 && (
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "#A32D2D", marginBottom: 3 }}>À couper ou alléger</div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                  {résultat.a_couper_ou_alleger.map((f, i) => <li key={i} style={{ marginBottom: 4 }}>{f}</li>)}
                </ul>
              </div>
            )}
          </div>

          {résultat.prochaine_etape && (
            <div style={{ fontSize: 12.5, background: "var(--fond, #F7F4EF)", borderRadius: 6, padding: "8px 10px" }}>
              <span style={{ fontWeight: 600 }}>Prochaine étape : </span>{résultat.prochaine_etape}
            </div>
          )}

          {résultat.cartographie_contexte && (
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 14, display: "grid", gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#5B52C4" }}>Cartographie du contexte</div>

              {résultat.cartographie_contexte.personnages_principaux?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--texte-secondaire)", marginBottom: 5 }}>Personnages principaux</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {résultat.cartographie_contexte.personnages_principaux.map((p, i) => (
                      <div key={i} style={{ fontSize: 12.5, background: "#fff", border: "0.5px solid var(--border)", borderRadius: 6, padding: "8px 10px" }}>
                        <div style={{ fontWeight: 600 }}>{p.nom} <span style={{ fontWeight: 400, color: "var(--texte-tertiaire)" }}>— {p.role}</span></div>
                        <div style={{ marginTop: 3 }}><span style={{ fontWeight: 600 }}>Explicite — </span>{p.explicite}</div>
                        <div style={{ marginTop: 2, color: "#5B52C4" }}><span style={{ fontWeight: 600 }}>À développer — </span>{p.a_developper}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {résultat.cartographie_contexte.lieux_principaux?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--texte-secondaire)", marginBottom: 5 }}>Lieux principaux</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {résultat.cartographie_contexte.lieux_principaux.map((l, i) => (
                      <div key={i} style={{ fontSize: 12.5, background: "#fff", border: "0.5px solid var(--border)", borderRadius: 6, padding: "8px 10px" }}>
                        <div style={{ fontWeight: 600 }}>{l.nom} <span style={{ fontWeight: 400, color: "var(--texte-tertiaire)" }}>— {l.fonction}</span></div>
                        <div style={{ marginTop: 2, color: "#5B52C4" }}><span style={{ fontWeight: 600 }}>À enrichir — </span>{l.a_enrichir}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {résultat.cartographie_contexte.carte_sensorielle && (
                <div style={{ fontSize: 12.5 }}>
                  <span style={{ fontWeight: 600 }}>Sensoriel — </span>
                  développé : {résultat.cartographie_contexte.carte_sensorielle.sens_developpes?.join(", ") || "—"} ·
                  sous-exploité : {résultat.cartographie_contexte.carte_sensorielle.sens_sous_exploites?.join(", ") || "—"}
                  <div style={{ color: "var(--texte-tertiaire)", marginTop: 2 }}>{résultat.cartographie_contexte.carte_sensorielle.diagnostic}</div>
                </div>
              )}

              {résultat.cartographie_contexte.objets_motifs?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--texte-secondaire)", marginBottom: 5 }}>Objets et motifs récurrents</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {résultat.cartographie_contexte.objets_motifs.map((o, i) => (
                      <div key={i} style={{ fontSize: 12.5, background: "#fff", border: "0.5px solid var(--border)", borderRadius: 6, padding: "8px 10px" }}>
                        <div style={{ fontWeight: 600 }}>{o.element}</div>
                        <div style={{ marginTop: 2 }}>{o.fonction_symbolique}</div>
                        <div style={{ marginTop: 2, color: "#5B52C4" }}><span style={{ fontWeight: 600 }}>Potentiel inexploité — </span>{o.potentiel_inexploite}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {résultat.cartographie_contexte.domaines_a_verifier?.length > 0 && (
                <div style={{ fontSize: 12.5 }}>
                  <span style={{ fontWeight: 600 }}>Domaines à documenter/vérifier — </span>
                  {résultat.cartographie_contexte.domaines_a_verifier.join(" · ")}
                </div>
              )}

              {résultat.cartographie_contexte.voix && (
                <div style={{ fontSize: 12.5 }}><span style={{ fontWeight: 600 }}>Voix — </span>{résultat.cartographie_contexte.voix}</div>
              )}

              {résultat.cartographie_contexte.densite && (
                <div style={{ fontSize: 12.5 }}><span style={{ fontWeight: 600 }}>Densité — </span>{résultat.cartographie_contexte.densite}</div>
              )}

              {résultat.cartographie_contexte.valeur_ajoutee_audit_complet && (
                <div style={{ fontSize: 12.5, background: "#EAF3DE", border: "0.5px solid #1D9E75", borderRadius: 6, padding: "8px 10px" }}>
                  <span style={{ fontWeight: 600, color: "#1D9E75" }}>Ce que l'audit détaillé apporterait en plus — </span>
                  {résultat.cartographie_contexte.valeur_ajoutee_audit_complet}
                </div>
              )}
            </div>
          )}

          {résultat.lecture_chapitres?.length > 0 && (
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 14, display: "grid", gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#5B52C4" }}>Lecture chapitre par chapitre</div>
              <div style={{ fontSize: 11.5, color: "var(--texte-tertiaire)" }}>
                Une lecture rapide de chaque chapitre confirmé — repère des points d'attention, pas une correction. L'audit détaillé va plus loin, ligne par ligne.
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {résultat.lecture_chapitres.map((c, i) => (
                  <div key={i} style={{ fontSize: 12.5, background: "#fff", border: "0.5px solid var(--border)", borderRadius: 6, padding: "8px 10px", display: "grid", gap: 3 }}>
                    <div style={{ fontWeight: 600 }}>{i + 1}. {c.titre}</div>
                    {c.lecture?.fonction && <div><span style={{ fontWeight: 600, color: "var(--texte-tertiaire)" }}>Fonction — </span>{c.lecture.fonction}</div>}
                    {c.lecture?.point_fort && <div><span style={{ fontWeight: 600, color: "#1D9E75" }}>Point fort — </span>{c.lecture.point_fort}</div>}
                    {c.lecture?.point_faible && <div><span style={{ fontWeight: 600, color: "#A32D2D" }}>Point faible — </span>{c.lecture.point_faible}</div>}
                    {c.lecture?.a_verifier && <div><span style={{ fontWeight: 600, color: "#C4973A" }}>À vérifier — </span>{c.lecture.a_verifier}</div>}
                    {c.lecture?.a_approfondir_audit_final && <div><span style={{ fontWeight: 600, color: "#5B52C4" }}>À approfondir dans l'audit final — </span>{c.lecture.a_approfondir_audit_final}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <button
              onClick={() => exporterPreauditWord(audit, résultat)}
              style={{
                background: "#fff", color: "#5B52C4", border: "1px solid #7F77DD80",
                borderRadius: 8, padding: "9px 18px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              }}
            >
              Exporter le pré-audit (Word)
            </button>
            {/* Signalé par l'auteur du projet le 26/08/2026 : arrivé au bout
                du rapport de pré-audit, aucun bouton n'était visible pour
                passer à l'audit détaillé — le seul existant est tout en
                haut de l'écran, hors de vue après avoir lu un rapport de
                10-20 pages. Réutilise directement lancerAnalyse() du parent
                (même bouton, même comportement) plutôt que d'en dupliquer un. */}
            {peutLancerAuditDetaille && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                {Array.isArray(audit.chapitres_detectes) && audit.chapitres_detectes.length > 0 && (
                  <select value={chapitreLimite} onChange={(e) => onChapitreLimiteChange(e.target.value)} disabled={auditDetailleEnCours}
                    style={{ fontSize: 11.5, padding: "4px 8px", borderRadius: 6, border: "0.5px solid var(--border)", fontFamily: "inherit", color: "var(--texte-secondaire)" }}>
                    <option value="">Tout le livre ({totalUnites} unités)</option>
                    {audit.chapitres_detectes.map((c, i) => (
                      <option key={i} value={i}>Jusqu'à « {c.titre} » ({i + 1} chapitre{i + 1 > 1 ? "s" : ""})</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={onLancerAuditDetaille}
                  disabled={auditDetailleEnCours}
                  style={{
                    background: "#1D9E75", color: "#fff", border: "none",
                    borderRadius: 8, padding: "9px 18px", fontSize: 12.5, fontWeight: 600,
                    cursor: auditDetailleEnCours ? "default" : "pointer", opacity: auditDetailleEnCours ? 0.6 : 1,
                  }}
                >
                  {auditDetailleEnCours ? "Audit détaillé en cours…" : audit.statut === "en_traitement" ? "Continuer l'audit détaillé" : "Commander l'audit détaillé"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </>}
    </div>
  );
}

function LigneSection({ section }) {
  const [ouverte, setOuverte] = useState(false);
  const résultat = section.resultat_analyse;

  const catégories = résultat?.analyse?.diagnostic_priorite?.valeur || [];

  return (
    <div style={{ border: "0.5px solid var(--border)", borderRadius: 8, marginBottom: 8, overflow: "hidden" }}>
      <div
        onClick={() => setOuverte((o) => !o)}
        style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
      >
        <span style={{ fontSize: 11, color: "var(--texte-tertiaire)", flexShrink: 0, width: 32 }}>#{section.ordre}</span>
        <span style={{ flex: 1, fontSize: 13, color: "var(--texte-secondaire)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {section.texte_source}
        </span>
        {résultat?.erreur ? (
          <span style={{ fontSize: 11, color: "#A32D2D", flexShrink: 0 }}>⚠ échec</span>
        ) : !résultat ? (
          <span style={{ fontSize: 11, color: "var(--texte-tertiaire)", flexShrink: 0 }}>en attente</span>
        ) : (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {catégories.map((c) => {
              const déf = CATEGORIES_DIAGNOSTIC.find((d) => d.id === c);
              return (
                <span key={c} style={{
                  fontSize: 10.5, padding: "2px 7px", borderRadius: 10,
                  background: `${déf?.couleur || "#999"}20`, color: déf?.couleur || "#999", fontWeight: 500,
                }}>
                  {déf?.label || c}
                </span>
              );
            })}
          </div>
        )}
        <span style={{ fontSize: 11, color: "var(--texte-tertiaire)" }}>{ouverte ? "▲" : "▼"}</span>
      </div>

      {ouverte && (
        <div style={{ padding: "0 14px 14px", borderTop: "0.5px solid var(--border)" }}>
          <p style={{ fontSize: 13, color: "var(--texte-primaire)", lineHeight: 1.6, margin: "12px 0" }}>
            {section.texte_source}
          </p>
          {résultat?.erreur ? (
            <div style={{ fontSize: 12.5, color: "#A32D2D" }}>{résultat.erreur}</div>
          ) : !résultat ? (
            <div style={{ fontSize: 12.5, color: "var(--texte-tertiaire)" }}>Pas encore analysée.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {résultat.analyse?.proposition && (
                <div style={{
                  fontSize: 12.5, background: "#EAF3DE", border: "0.5px solid #1D9E75", borderRadius: 6, padding: "8px 10px",
                }}>
                  <div style={{ fontWeight: 600, color: "#1D9E75", marginBottom: 2 }}>Proposition</div>
                  <div style={{ color: "var(--texte-primaire)", lineHeight: 1.5 }}>{résultat.analyse.proposition}</div>
                </div>
              )}
              {Object.entries(résultat.analyse || {})
                .filter(([clé]) => clé !== "proposition")
                .map(([clé, val]) => (
                <div key={clé} style={{ fontSize: 12.5 }}>
                  <div style={{ fontWeight: 600, color: "var(--texte-secondaire)", marginBottom: 2 }}>
                    {humaniserCle(clé)}
                    {" — "}
                    <span style={{ fontWeight: 400, color: "var(--texte-primaire)" }}>
                      {Array.isArray(val.valeur)
                        ? val.valeur.map((v) => (clé === "effet_lecteur" ? LABELS_EFFET_LECTEUR[v] : CATEGORIES_DIAGNOSTIC.find((d) => d.id === v)?.label) || v).join(", ")
                        : val.valeur}
                    </span>
                  </div>
                  <div style={{ color: "var(--texte-tertiaire)", lineHeight: 1.5 }}>{val.commentaire}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CursAuditDetail({ auditId, onRetour }) {
  const [audit, setAudit] = useState(null);
  const [sections, setSections] = useState(null);
  const [reglesPrix, setReglesPrix] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [filtresActifs, setFiltresActifs] = useState([]);
  const [page, setPage] = useState(1);
  const [enCours, setEnCours] = useState(false);
  const [progression, setProgression] = useState(null);
  // Bornage optionnel à un sous-ensemble de chapitres pour tester l'audit
  // détaillé sans attendre le livre entier (réf. 60816-01, suite,
  // 25/08/2026) — "" = tout le livre, sinon l'index (0-based) du dernier
  // chapitre confirmé à inclure. Voir appelerOrchestrateur ci-dessus.
  const [chapitreLimite, setChapitreLimite] = useState("");
  const [syntheseEnCours, setSyntheseEnCours] = useState(false);
  const [erreurSynthese, setErreurSynthese] = useState(null);
  // Chrono visible pendant la génération — même raison que dans
  // PreauditApprofondi : un appel de plusieurs dizaines de secondes sans
  // aucun repère donne l'impression que la page est plantée.
  const [syntheseChrono, setSyntheseChrono] = useState(0);
  useEffect(() => {
    if (!syntheseEnCours) { setSyntheseChrono(0); return; }
    const début = Date.now();
    const intervalle = setInterval(() => setSyntheseChrono(Math.floor((Date.now() - début) / 1000)), 1000);
    return () => clearInterval(intervalle);
  }, [syntheseEnCours]);

  const charger = useCallback(async () => {
    const { data, error } = await auditsAPI.récupérerAvecSections(auditId);
    if (error) { setErreur(error.message || "Erreur de chargement."); return; }
    setAudit(data.audit);
    setSections(data.sections);
  }, [auditId]);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    auditsAPI.récupérerReglesPrix().then(({ data, error }) => { if (!error) setReglesPrix(data || []); });
  }, []);

  const nombreMots = useMemo(
    () => (sections || []).reduce((acc, s) => acc + (s.texte_source?.split(/\s+/).filter(Boolean).length || 0), 0),
    [sections]
  );

  const comptages = useMemo(() => {
    const c = Object.fromEntries(CATEGORIES_DIAGNOSTIC.map((d) => [d.id, 0]));
    for (const s of sections || []) {
      const valeurs = s.resultat_analyse?.analyse?.diagnostic_priorite?.valeur || [];
      for (const v of valeurs) if (c[v] !== undefined) c[v] += 1;
    }
    return c;
  }, [sections]);

  const analysées = (sections || []).filter((s) => s.resultat_analyse && !s.resultat_analyse.erreur).length;
  const échouées = (sections || []).filter((s) => s.resultat_analyse?.erreur).length;
  const total = (sections || []).length;

  const basculerFiltre = (id) => {
    setPage(1);
    setFiltresActifs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  };

  const sectionsFiltrées = useMemo(() => {
    if (filtresActifs.length === 0) return sections || [];
    return (sections || []).filter((s) => {
      const valeurs = s.resultat_analyse?.analyse?.diagnostic_priorite?.valeur || [];
      return filtresActifs.some((f) => valeurs.includes(f));
    });
  }, [sections, filtresActifs]);

  const totalPages = Math.max(1, Math.ceil(sectionsFiltrées.length / PAR_PAGE));
  const sectionsPage = sectionsFiltrées.slice((page - 1) * PAR_PAGE, page * PAR_PAGE);

  const lancerAnalyse = async () => {
    setEnCours(true);
    setErreur(null);
    const limite = chapitreLimite === "" ? undefined : Number(chapitreLimite);
    try {
      let restantes = 1;
      while (restantes > 0) {
        const résultat = await appelerOrchestrateur(auditId, undefined, limite);
        restantes = résultat.restantes ?? 0;
        setProgression({ traitées: résultat.traitees_cette_fois, échouées: résultat.echouees_cette_fois, restantes });
        // CORRECTIF 26/08/2026 — charger() n'était appelé qu'APRÈS la fin de
        // toute la boucle (potentiellement ~2h sur un livre entier) : pendant
        // tout ce temps, "X / total analysées" restait figé à sa valeur de
        // départ, seule la ligne "Dernier lot" changeait — signalé par
        // l'auteur du projet comme illisible ("je ne sais pas où ça en
        // est"). Rafraîchi maintenant après CHAQUE lot, pour un vrai
        // compteur qui avance en direct.
        await charger();
      }
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  };

  const lancerSynthese = async () => {
    setSyntheseEnCours(true);
    setErreurSynthese(null);
    try {
      await appelerSyntheseAuditDetaille(auditId);
      await charger();
    } catch (e) {
      setErreurSynthese(e.message);
    } finally {
      setSyntheseEnCours(false);
    }
  };

  if (erreur && !audit) {
    return (
      <div style={{ padding: "28px 32px" }}>
        <div style={{ background: "#FBE9E9", color: "#A32D2D", padding: "10px 14px", borderRadius: 6, fontSize: 13 }}>{erreur}</div>
        <button onClick={onRetour} style={{ marginTop: 16, fontSize: 13, color: "var(--texte-secondaire)", background: "none", border: "0.5px solid var(--border)", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}>← Retour</button>
      </div>
    );
  }

  if (!audit) return <div style={{ padding: "28px 32px", fontSize: 13, color: "var(--texte-tertiaire)" }}>Chargement…</div>;

  // Réf. 60816-01, suite, 28/08/2026 — bouton introuvable après un
  // incident réel : remettre à zéro en SQL des unités en échec (voir
  // l'audit "Oracle du Sermon sur la montagne", 479 échecs réinitialisés)
  // laisse `audits.statut` à "termine" (jamais repassé à "en_traitement"
  // automatiquement par une simple remise à zéro de `audit_sections`),
  // alors que des unités non traitées existent à nouveau — le bouton
  // "Continuer l'analyse" restait invisible malgré du travail réel en
  // attente. Autorisé aussi quand statut = "termine" mais qu'il reste
  // des unités sans résultat (ni succès, ni échec enregistré).
  const nonTraitées = total - analysées - échouées;
  const peutLancer = audit.statut === "paye" || audit.statut === "en_traitement" || (audit.statut === "termine" && nonTraitées > 0);

  return (
    <div style={{ padding: "28px 32px", flex: 1, overflowY: "auto", maxWidth: 920 }}>
      <button onClick={onRetour} style={{ fontSize: 12.5, color: "var(--texte-tertiaire)", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 12 }}>
        ← Mes audits
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: "var(--texte-primaire)", marginBottom: 4 }}>{audit.titre}</h1>
          <p style={{ fontSize: 12.5, color: "var(--texte-tertiaire)" }}>
            {total} unité{total > 1 ? "s" : ""} · palier {audit.palier_dimensions} · mode {audit.mode_ia} · statut {audit.statut}
          </p>
        </div>
        {peutLancer && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            {Array.isArray(audit.chapitres_detectes) && audit.chapitres_detectes.length > 0 && (
              <select value={chapitreLimite} onChange={(e) => setChapitreLimite(e.target.value)} disabled={enCours}
                style={{ fontSize: 11.5, padding: "4px 8px", borderRadius: 6, border: "0.5px solid var(--border)", fontFamily: "inherit", color: "var(--texte-secondaire)" }}>
                <option value="">Tout le livre ({total} unités)</option>
                {audit.chapitres_detectes.map((c, i) => (
                  <option key={i} value={i}>Jusqu'à « {c.titre} » ({i + 1} chapitre{i + 1 > 1 ? "s" : ""})</option>
                ))}
              </select>
            )}
            <button onClick={lancerAnalyse} disabled={enCours} style={{
              background: "#1D9E75", color: "#fff", border: "none", borderRadius: 8,
              padding: "9px 16px", fontSize: 13, fontWeight: 500, cursor: enCours ? "default" : "pointer",
              opacity: enCours ? 0.6 : 1,
            }}>
              {enCours ? "Analyse en cours…" : (audit.statut === "en_traitement" || nonTraitées > 0) ? "Continuer l'analyse" : "Lancer l'analyse"}
            </button>
          </div>
        )}
      </div>

      {!peutLancer && audit.statut === "brouillon" && (
        <div style={{ background: "#FFF7E6", color: "#8A6116", padding: "10px 14px", borderRadius: 6, fontSize: 12.5, marginBottom: 16 }}>
          Cet audit est en brouillon — le paiement CursAudit n'existe pas encore dans l'application, l'analyse ne peut pas être lancée depuis cet écran.
        </div>
      )}

      <CadreLecture audit={audit} />

      {nombreMots > 0 && (
        <ApercuGlobal audit={audit} nombreMots={nombreMots} onTermine={charger} />
      )}

      {audit.apercu_statut === "termine" && (
        <PreauditApprofondi
          audit={audit}
          reglesPrix={reglesPrix}
          onTermine={charger}
          onLancerAuditDetaille={lancerAnalyse}
          peutLancerAuditDetaille={peutLancer}
          auditDetailleEnCours={enCours}
          chapitreLimite={chapitreLimite}
          onChapitreLimiteChange={setChapitreLimite}
          totalUnites={total}
        />
      )}

      {erreur && (
        <div style={{ background: "#FBE9E9", color: "#A32D2D", padding: "10px 14px", borderRadius: 6, fontSize: 13, marginBottom: 16 }}>{erreur}</div>
      )}

      {enCours && progression && (
        <div style={{ background: "#EFF3FF", border: "0.5px solid #4C6FE780", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12.5, color: "var(--texte-secondaire)" }}>
          <div style={{ fontWeight: 600, color: "#4C6FE7", marginBottom: 2 }}>Audit détaillé en cours — ne ferme pas cet onglet</div>
          {analysées} / {total} unités analysées jusqu'ici{échouées > 0 ? ` (${échouées} échec(s))` : ""} · encore {progression.restantes} restante(s).
        </div>
      )}

      {total > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 12, color: "var(--texte-tertiaire)" }}>
              {analysées} / {total} analysée{total > 1 ? "s" : ""}{échouées > 0 ? ` · ${échouées} échec(s)` : ""}
            </div>
            {/* Signalé par l'auteur du projet le 27/08/2026 : une fois l'audit
                détaillé terminé, rien n'était proposé pour l'exporter — puis,
                une fois ajouté, le bouton était placé trop loin du relevé des
                analyses (tout en haut) et son libellé générique ("Exporter en
                Word") était impossible à distinguer de celui du pré-audit
                (deux libellés identiques sur le même écran). Déplacé ici,
                juste à côté du relevé qu'il exporte, avec un libellé
                explicite. Voir exportAuditDetailleWord.js. */}
            {audit.statut === "termine" && (
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                {/* Réf. 60816-01, suite, 27/08/2026 — "rapport consolidé"
                    côté affichage (nom retenu par l'auteur du projet : un
                    vrai document d'orientation de 15-30 pages pour un audit
                    détaillé vendu cher, pas une "synthèse courte" — voir la
                    FicheExecutive au-dessus pour la vraie page de pilotage
                    d'1-2 pages). Les noms internes (fonction Supabase,
                    colonnes DB, variables JS) restent "synthese_audit_*"
                    pour ne pas redéployer/remigrer — seul le libellé
                    utilisateur change. Toujours affiché (même une fois
                    "termine") pour permettre de relancer sans passer par une
                    remise à zéro SQL manuelle. */}
                <button
                  onClick={lancerSynthese}
                  disabled={syntheseEnCours}
                  style={{
                    background: "#fff", color: "#5B52C4", border: "1px solid #7F77DD80",
                    borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600,
                    cursor: syntheseEnCours ? "default" : "pointer", opacity: syntheseEnCours ? 0.6 : 1,
                  }}
                >
                  {syntheseEnCours
                    ? `Génération… (${syntheseChrono} s)`
                    : audit.synthese_audit_statut === "termine"
                      ? "Régénérer le rapport consolidé (audit détaillé)"
                      : "Générer le rapport consolidé (audit détaillé)"}
                </button>
                <button
                  onClick={() => exporterAuditDetailleWord(audit, sections)}
                  style={{
                    background: "#fff", color: "#5B52C4", border: "1px solid #7F77DD80",
                    borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Exporter l'audit détaillé (Word)
                </button>
                {/* Réf. 60816-01, suite, 28/08/2026 — manquait : le rapport
                    consolidé était consultable à l'écran mais pas exportable. */}
                {audit.synthese_audit_statut === "termine" && audit.synthese_audit_resultat && (
                  <button
                    onClick={() => exporterFicheActionWord(audit, audit.synthese_audit_resultat, { titreDocument: "Rapport consolidé de l'audit détaillé", prefixeFichier: "rapport_consolide" })}
                    style={{
                      background: "#fff", color: "#5B52C4", border: "1px solid #7F77DD80",
                      borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    Exporter le rapport consolidé (Word)
                  </button>
                )}
              </div>
            )}
          </div>
          {erreurSynthese && (
            <div style={{ marginBottom: 12, fontSize: 12, color: "#A32D2D" }}>{erreurSynthese}</div>
          )}
          {syntheseEnCours && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 11.5, color: "var(--texte-tertiaire)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#5B52C4", flexShrink: 0, animation: "syntheseChronoPulse 1.2s ease-in-out infinite" }} />
              Génération du rapport consolidé en cours ({syntheseChrono} s) — sur un livre de cette taille, cela peut prendre plusieurs minutes, ne ferme pas cette page.
              <style>{"@keyframes syntheseChronoPulse { 0%, 100% { opacity: 0.25; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1); } }"}</style>
            </div>
          )}
          {audit.synthese_audit_statut === "termine" && audit.synthese_audit_resultat && (
            <>
              <FicheExecutive fiche={audit.synthese_audit_resultat} />
              <FicheActionAffichage titre="Rapport consolidé de l'audit détaillé — analyse complète" fiche={audit.synthese_audit_resultat} masquerResumeCourt />
            </>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20, marginTop: 12 }}>
            {CATEGORIES_DIAGNOSTIC.map((c) => {
              const actif = filtresActifs.includes(c.id);
              return (
                <button key={c.id} onClick={() => basculerFiltre(c.id)} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8,
                  border: `0.5px solid ${c.couleur}${actif ? "" : "50"}`,
                  background: actif ? `${c.couleur}20` : "transparent",
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: c.couleur }}>{c.label}</span>
                  <span style={{ fontSize: 11, color: "var(--texte-tertiaire)" }}>{comptages[c.id]}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {sections && sections.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--texte-tertiaire)" }}>Aucune unité dans cet audit.</p>
      ) : (
        <>
          {sectionsPage.map((s) => <LigneSection key={s.id} section={s} />)}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 10, alignItems: "center", marginTop: 16 }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{
                background: "none", border: "0.5px solid var(--border)", borderRadius: 6, padding: "5px 10px",
                fontSize: 12, cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1,
              }}>← Précédent</button>
              <span style={{ fontSize: 12, color: "var(--texte-tertiaire)" }}>Page {page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{
                background: "none", border: "0.5px solid var(--border)", borderRadius: 6, padding: "5px 10px",
                fontSize: 12, cursor: page === totalPages ? "default" : "pointer", opacity: page === totalPages ? 0.4 : 1,
              }}>Suivant →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
