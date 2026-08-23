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

import { useState, useEffect, useMemo, useCallback } from "react";
import { auditsAPI } from "../lib/api.js";
import { supabase } from "../lib/supabase.js";

const ORCHESTRATEUR_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/orchestrer-audit-cursaudit";
const PREAUDIT_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/preaudit-global-cursaudit";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const CATEGORIES_DIAGNOSTIC = [
  { id: "recevable",    label: "Recevable",     couleur: "#1D9E75" },
  { id: "a_nuancer",    label: "À nuancer",     couleur: "#C4973A" },
  { id: "a_sourcer",    label: "À sourcer",     couleur: "#D97706" },
  { id: "a_reformuler", label: "À reformuler",  couleur: "#4C6FE7" },
  { id: "a_verifier",   label: "À vérifier",    couleur: "#A32D2D" },
];

const PAR_PAGE = 20;

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

async function appelerOrchestrateur(auditId, signal) {
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
    body: JSON.stringify({ audit_id: auditId }),
  });
  const données = await réponse.json();
  if (!réponse.ok) throw new Error(données?.error || données?.message || `HTTP ${réponse.status}`);
  return données;
}

// Pré-audit global (réf. 60816-01, suite, 22/08/2026) — un seul appel,
// pas de boucle (contrairement à l'orchestrateur détaillé) : le manuscrit
// entier tient dans un seul appel Claude.
async function appelerPreauditGlobal(auditId) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Session absente — recharge la page et reconnecte-toi.");

  const réponse = await fetch(PREAUDIT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ audit_id: auditId }),
  });
  const données = await réponse.json();
  if (!réponse.ok) throw new Error(données?.error || données?.message || `HTTP ${réponse.status}`);
  return données;
}

function PreauditGlobal({ audit, nombreMots, onTermine }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const résultat = audit.preaudit_resultat;

  const lancer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      await appelerPreauditGlobal(audit.id);
      await onTermine();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div style={{ border: "0.5px solid #C4973A80", borderRadius: 10, padding: "16px 18px", marginBottom: 24, background: "#FFFBF2" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, color: "#8A6116", marginBottom: 2 }}>Lecture globale du manuscrit</div>
          <div style={{ fontSize: 12, color: "var(--texte-tertiaire)" }}>
            Une vue d'ensemble avant l'audit détaillé — nature du texte, colonne vertébrale, tensions et risques à l'échelle du livre entier.
          </div>
        </div>
        {audit.preaudit_statut !== "termine" && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#8A6116" }}>Gratuit</div>
            <div style={{ fontSize: 10.5, color: "var(--texte-tertiaire)" }}>{nombreMots.toLocaleString("fr-FR")} mots</div>
          </div>
        )}
      </div>

      {(audit.preaudit_statut === "paye" || audit.preaudit_statut === "non_demande") && (
        <button onClick={lancer} disabled={enCours} style={{
          marginTop: 10, background: "#C4973A", color: "#fff", border: "none", borderRadius: 8,
          padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: enCours ? "default" : "pointer",
          opacity: enCours ? 0.6 : 1,
        }}>
          {enCours ? "Lecture en cours…" : "Lancer la lecture globale"}
        </button>
      )}

      {erreur && <div style={{ marginTop: 10, fontSize: 12, color: "#A32D2D" }}>{erreur}</div>}

      {audit.preaudit_statut === "termine" && résultat && (
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
  const [erreur, setErreur] = useState(null);
  const [filtresActifs, setFiltresActifs] = useState([]);
  const [page, setPage] = useState(1);
  const [enCours, setEnCours] = useState(false);
  const [progression, setProgression] = useState(null);

  const charger = useCallback(async () => {
    const { data, error } = await auditsAPI.récupérerAvecSections(auditId);
    if (error) { setErreur(error.message || "Erreur de chargement."); return; }
    setAudit(data.audit);
    setSections(data.sections);
  }, [auditId]);

  useEffect(() => { charger(); }, [charger]);

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
    try {
      let restantes = 1;
      while (restantes > 0) {
        const résultat = await appelerOrchestrateur(auditId);
        restantes = résultat.restantes ?? 0;
        setProgression({ traitées: résultat.traitees_cette_fois, échouées: résultat.echouees_cette_fois, restantes });
      }
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
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

  const peutLancer = audit.statut === "paye" || audit.statut === "en_traitement";

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
          <button onClick={lancerAnalyse} disabled={enCours} style={{
            background: "#1D9E75", color: "#fff", border: "none", borderRadius: 8,
            padding: "9px 16px", fontSize: 13, fontWeight: 500, cursor: enCours ? "default" : "pointer",
            opacity: enCours ? 0.6 : 1, flexShrink: 0,
          }}>
            {enCours ? "Analyse en cours…" : audit.statut === "en_traitement" ? "Continuer l'analyse" : "Lancer l'analyse"}
          </button>
        )}
      </div>

      {!peutLancer && audit.statut === "brouillon" && (
        <div style={{ background: "#FFF7E6", color: "#8A6116", padding: "10px 14px", borderRadius: 6, fontSize: 12.5, marginBottom: 16 }}>
          Cet audit est en brouillon — le paiement CursAudit n'existe pas encore dans l'application, l'analyse ne peut pas être lancée depuis cet écran.
        </div>
      )}

      {nombreMots > 0 && (
        <PreauditGlobal audit={audit} nombreMots={nombreMots} onTermine={charger} />
      )}

      {erreur && (
        <div style={{ background: "#FBE9E9", color: "#A32D2D", padding: "10px 14px", borderRadius: 6, fontSize: 13, marginBottom: 16 }}>{erreur}</div>
      )}

      {progression && (
        <div style={{ fontSize: 12, color: "var(--texte-tertiaire)", marginBottom: 16 }}>
          Dernier lot : {progression.traitées} traitée(s), {progression.échouées} échec(s), {progression.restantes} restante(s).
        </div>
      )}

      {total > 0 && (
        <>
          <div style={{ fontSize: 12, color: "var(--texte-tertiaire)", marginBottom: 8 }}>
            {analysées} / {total} analysée{total > 1 ? "s" : ""}{échouées > 0 ? ` · ${échouées} échec(s)` : ""}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
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
