/**
 * CURSUS — Supervision (référence 60816-01, suite, 07/09/2026)
 * ======================================================================
 * Écran réservé au propriétaire du logiciel : liste des audits CursAudit
 * pour lesquels l'auteur·ice a coché « Supervision demandée » (voir la
 * case correspondante dans CursAudit.jsx et
 * 2026-09-07-consentement-supervision-cursaudit.sql), avec accès au texte
 * soumis et au questionnaire de cadrage.
 *
 * Volontairement séparé d'Administration.jsx : celui-ci gère les codes
 * promo (une fonction d'équipe), celui-ci est personnel ("moi qui
 * supervise ce qu'on m'a envoyé") — voir la discussion du 07/09/2026 sur
 * la différence entre consentement (déjà acquis) et un vrai travail de
 * relecture (à la demande de l'auteur·ice, jamais en continu).
 *
 * Modèle « à la demande » assumé : cet écran ne notifie de rien tout
 * seul — c'est l'auteur·ice qui prévient qu'un audit est prêt à être
 * regardé (voir le mode d'emploi envoyé à Annie). Aucune écriture directe
 * vers Supabase : tout passe par admin-supervision-cursaudit, qui revérifie
 * lui-même l'email de l'appelant.
 */

import { useState, useEffect, useCallback, Fragment } from "react";
import { supabase } from "../lib/supabase.js";

const COULEURS = {
  bordeaux: "#8B2635",
  or: "#C4973A",
  fond: "#F7F4EF",
  texte: "#2C1810",
  texteClair: "#6B5D52",
};

const LIBELLES_STATUT = {
  brouillon: "Brouillon (non payé)",
  paye: "Payé",
  en_traitement: "En traitement",
  termine: "Terminé",
  echec: "Échec",
};

export default function Supervision() {
  const [audits, setAudits] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [auditOuvertId, setAuditOuvertId] = useState(null);
  const [détail, setDétail] = useState(null);
  const [chargementDétail, setChargementDétail] = useState(false);
  const [erreurDétail, setErreurDétail] = useState("");

  const appellerSupervision = useCallback(async (action, params = {}) => {
    const { data, error: erreurSession } = await supabase.auth.getSession();
    if (erreurSession) throw new Error(`Erreur session : ${erreurSession.message}`);
    if (!data?.session?.access_token) throw new Error("Session absente. Recharge la page et reconnecte-toi.");

    const { data: réponse, error } = await supabase.functions.invoke("admin-supervision-cursaudit", {
      body: { action, ...params },
    });
    if (error) {
      let détail = error.message;
      try {
        if (error.context && typeof error.context.json === "function") {
          const corps = await error.context.json();
          if (corps?.error) détail = corps.error;
        }
      } catch (_e) { /* corps non lisible : on garde error.message */ }
      throw new Error(détail || "Erreur Edge Function.");
    }
    if (réponse?.error) throw new Error(réponse.error);
    return réponse;
  }, []);

  const rafraîchir = useCallback(async () => {
    setChargement(true);
    try {
      const { audits } = await appellerSupervision("lister");
      setAudits(audits || []);
      setErreur("");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [appellerSupervision]);

  useEffect(() => { rafraîchir(); }, [rafraîchir]);

  const ouvrir = async (audit) => {
    if (auditOuvertId === audit.id) { setAuditOuvertId(null); setDétail(null); return; }
    setAuditOuvertId(audit.id);
    setDétail(null);
    setErreurDétail("");
    setChargementDétail(true);
    try {
      const { audit: auditComplet, sections } = await appellerSupervision("detail", { auditId: audit.id });
      setDétail({ audit: auditComplet, sections });
    } catch (e) {
      setErreurDétail(e.message);
    } finally {
      setChargementDétail(false);
    }
  };

  const champDétail = (libellé, valeur) => {
    if (!valeur) return null;
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: COULEURS.texteClair, textTransform: "uppercase", letterSpacing: 0.3 }}>{libellé}</div>
        <div style={{ fontSize: 13, color: COULEURS.texte, whiteSpace: "pre-wrap" }}>{valeur}</div>
      </div>
    );
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1000 }}>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, color: COULEURS.bordeaux, marginBottom: 4 }}>
        Supervision
      </h1>
      <p style={{ fontSize: 13, color: COULEURS.texteClair, marginBottom: 20 }}>
        Audits CursAudit pour lesquels l'auteur·ice a coché « Supervision demandée » — à la demande, jamais en continu.
      </p>

      {erreur && (
        <div style={{ background: "#FBE9E9", color: "#A32D2D", padding: "10px 14px", borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
          {erreur}
        </div>
      )}

      {chargement ? (
        <p style={{ fontSize: 13, color: COULEURS.texteClair }}>Chargement…</p>
      ) : audits.length === 0 ? (
        <p style={{ fontSize: 13, color: COULEURS.texteClair }}>Aucun audit avec supervision consentie pour l'instant.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: COULEURS.texteClair, borderBottom: `0.5px solid ${COULEURS.texteClair}55` }}>
                <th style={{ padding: "6px 8px" }}>Auteur·ice</th>
                <th style={{ padding: "6px 8px" }}>Titre</th>
                <th style={{ padding: "6px 8px" }}>Palier</th>
                <th style={{ padding: "6px 8px" }}>Statut</th>
                <th style={{ padding: "6px 8px" }}>Supervision acceptée le</th>
                <th style={{ padding: "6px 8px" }}></th>
              </tr>
            </thead>
            <tbody>
              {audits.map((a) => (
                <Fragment key={a.id}>
                  <tr style={{ borderBottom: `0.5px solid ${COULEURS.texteClair}22` }}>
                    <td style={{ padding: "6px 8px" }}>{a.email}</td>
                    <td style={{ padding: "6px 8px" }}>{a.titre}</td>
                    <td style={{ padding: "6px 8px", textTransform: "capitalize" }}>{a.palier_dimensions}</td>
                    <td style={{ padding: "6px 8px" }}>{LIBELLES_STATUT[a.statut] || a.statut}</td>
                    <td style={{ padding: "6px 8px" }}>
                      {a.consentement_supervision_le ? new Date(a.consentement_supervision_le).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <button onClick={() => ouvrir(a)} style={{
                        background: "none", border: `0.5px solid ${COULEURS.texteClair}55`, borderRadius: 4,
                        padding: "3px 8px", fontSize: 11.5, cursor: "pointer", color: COULEURS.texte,
                      }}>
                        {auditOuvertId === a.id ? "Fermer" : "Regarder"}
                      </button>
                    </td>
                  </tr>
                  {auditOuvertId === a.id && (
                    <tr>
                      <td colSpan={6} style={{ padding: "16px 8px", background: COULEURS.fond, borderBottom: `0.5px solid ${COULEURS.texteClair}22` }}>
                        {chargementDétail ? (
                          <p style={{ fontSize: 13, color: COULEURS.texteClair }}>Chargement…</p>
                        ) : erreurDétail ? (
                          <div style={{ color: "#A32D2D", fontSize: 13 }}>{erreurDétail}</div>
                        ) : détail ? (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                            <div>
                              <h3 style={{ fontSize: 13, color: COULEURS.bordeaux, marginBottom: 10 }}>Cadrage</h3>
                              {champDétail("Type de document", détail.audit.type_document)}
                              {champDétail("Finalité de l'audit", détail.audit.finalite_audit)}
                              {champDétail("Question posée à CursAudit", détail.audit.question_libre)}
                              {champDétail("Degré d'intervention souhaité", détail.audit.degre_intervention)}
                              {champDétail("Contraintes académiques", détail.audit.contraintes_academiques)}
                              {champDétail("Relation à l'IA", détail.audit.relation_ia)}
                              {détail.audit.contrat_intention && (
                                <details style={{ marginTop: 8 }}>
                                  <summary style={{ fontSize: 11.5, color: COULEURS.texteClair, cursor: "pointer" }}>Contrat d'intention complet (JSON)</summary>
                                  <pre style={{ fontSize: 10.5, whiteSpace: "pre-wrap", background: "#fff", padding: 8, borderRadius: 6, marginTop: 6, maxHeight: 240, overflowY: "auto" }}>
                                    {JSON.stringify(détail.audit.contrat_intention, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                            <div>
                              <h3 style={{ fontSize: 13, color: COULEURS.bordeaux, marginBottom: 10 }}>
                                Texte soumis ({détail.sections.length} unité{détail.sections.length > 1 ? "s" : ""})
                              </h3>
                              <div style={{ maxHeight: 420, overflowY: "auto", background: "#fff", borderRadius: 6, padding: 10, fontSize: 12.5, lineHeight: 1.5, color: COULEURS.texte, whiteSpace: "pre-wrap" }}>
                                {détail.sections.map((s) => s.texte_source).join("\n\n")}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
