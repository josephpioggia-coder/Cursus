/**
 * CURSAUDIT — Mes audits (référence 60816-01, suite, 22/08/2026)
 * ======================================================================
 * Liste des audits de l'utilisateur connecté (auditsAPI.lister(), RLS
 * owner-based — pas d'Edge Function nécessaire pour une simple lecture).
 * Miroir de la vue "Mes projets" côté CursEdit. Clic sur une ligne → détail
 * (CursAuditDetail.jsx).
 */

import { useState, useEffect } from "react";
import { auditsAPI } from "../lib/api.js";

const STATUTS = {
  brouillon:     { label: "Brouillon",      couleur: "#999" },
  paye:          { label: "Payé",           couleur: "#4C6FE7" },
  en_traitement: { label: "En traitement",  couleur: "#C4973A" },
  termine:       { label: "Terminé",        couleur: "#1D9E75" },
};

export default function CursAuditListe({ onOuvrir, onNouveau }) {
  const [audits, setAudits] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    auditsAPI.lister().then(({ data, error }) => {
      if (error) { setErreur(error.message || "Erreur de chargement."); return; }
      setAudits(data || []);
    });
  }, []);

  return (
    <div style={{ padding: "28px 32px", flex: 1, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--texte-primaire)", marginBottom: 4 }}>Mes audits</h1>
          <p style={{ fontSize: 13, color: "var(--texte-tertiaire)" }}>Historique des audits CursAudit.</p>
        </div>
        <button onClick={onNouveau} style={{
          background: "#1D9E75", color: "#fff", border: "none", borderRadius: 8,
          padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
        }}>
          + Nouvel audit
        </button>
      </div>

      {erreur && (
        <div style={{ background: "#FBE9E9", color: "#A32D2D", padding: "10px 14px", borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
          {erreur}
        </div>
      )}

      {audits === null ? (
        <p style={{ fontSize: 13, color: "var(--texte-tertiaire)" }}>Chargement…</p>
      ) : audits.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--texte-tertiaire)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔎</div>
          <div style={{ fontSize: 15, marginBottom: 14 }}>Aucun audit pour l'instant.</div>
          <button onClick={onNouveau} style={{
            background: "#1D9E75", color: "#fff", border: "none", borderRadius: 8,
            padding: "9px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
          }}>
            Créer mon premier audit
          </button>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--texte-tertiaire)", borderBottom: "0.5px solid var(--border)" }}>
                <th style={{ padding: "8px 10px" }}>Titre</th>
                <th style={{ padding: "8px 10px" }}>Palier</th>
                <th style={{ padding: "8px 10px" }}>Mode IA</th>
                <th style={{ padding: "8px 10px" }}>Prix</th>
                <th style={{ padding: "8px 10px" }}>Statut</th>
                <th style={{ padding: "8px 10px" }}>Créé le</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((a) => {
                const s = STATUTS[a.statut] || { label: a.statut, couleur: "#999" };
                return (
                  <tr key={a.id} onClick={() => onOuvrir(a.id)} style={{
                    borderBottom: "0.5px solid var(--border)", cursor: "pointer",
                  }}>
                    <td style={{ padding: "10px" }}>{a.titre}</td>
                    <td style={{ padding: "10px", textTransform: "capitalize" }}>{a.palier_dimensions}</td>
                    <td style={{ padding: "10px" }}>{a.mode_ia}</td>
                    <td style={{ padding: "10px" }}>{a.prix_ttc != null ? `${Number(a.prix_ttc).toFixed(2).replace(".", ",")} €` : "—"}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ color: s.couleur, fontWeight: 500 }}>{s.label}</span>
                    </td>
                    <td style={{ padding: "10px", color: "var(--texte-tertiaire)" }}>
                      {a.cree_le ? new Date(a.cree_le).toLocaleDateString("fr-FR") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
