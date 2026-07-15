/**
 * CURSUS — src/components/AideFAQ.jsx
 *
 * Centre d'aide en libre-service, accessible depuis n'importe quel écran via
 * le bouton "Aide" de la barre supérieure (App.jsx). Contenu en accordéon,
 * textes dans common.json → clé "faq" (tableau {question, reponse}).
 *
 * Volontairement simple pour commencer : pas de recherche, pas de catégories.
 * À enrichir au fil des questions réellement posées par les utilisateurs —
 * les 5 premières entrées viennent des problèmes rencontrés le 15/07/2026.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";

function Entrée({ question, réponse }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div style={{ borderBottom: "0.5px solid var(--border, #e5e5e5)" }}>
      <button
        onClick={() => setOuvert(!ouvert)}
        style={{
          width: "100%", textAlign: "left", background: "none", border: "none",
          padding: "12px 4px", cursor: "pointer", fontFamily: "inherit",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 13, fontWeight: 500, color: "var(--texte-primaire, #1a1a1a)",
        }}
      >
        {question}
        <span style={{ color: "#999", fontSize: 12, transform: ouvert ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
      </button>
      {ouvert && (
        <p style={{ margin: "0 4px 14px", fontSize: 13, color: "var(--texte-secondaire, #555)", lineHeight: 1.6 }}>
          {réponse}
        </p>
      )}
    </div>
  );
}

export default function AideFAQ({ onFermer }) {
  const { t } = useTranslation("common");
  const faq = t("faq", { returnObjects: true }) || [];

  return (
    <div
      onClick={onFermer}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 200, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 16, width: 480, maxWidth: "100%",
          maxHeight: "80vh", display: "flex", flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden",
        }}
      >
        <div style={{
          padding: "18px 22px", borderBottom: "0.5px solid #e5e5e5",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 16, fontWeight: 500 }}>{t("aide.titre")}</span>
          <button
            onClick={onFermer}
            style={{
              width: 26, height: 26, borderRadius: "50%", border: "none",
              background: "#f5f5f5", color: "#999", fontSize: 13, cursor: "pointer",
            }}
          >✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "6px 22px" }}>
          {faq.length === 0 ? (
            <p style={{ fontSize: 13, color: "#999", padding: "16px 0" }}>{t("aide.vide")}</p>
          ) : (
            faq.map((item, i) => <Entrée key={i} question={item.question} réponse={item.reponse} />)
          )}
        </div>

        <div style={{ padding: "14px 22px", borderTop: "0.5px solid #f0f0f0", fontSize: 11, color: "#999", textAlign: "center" }}>
          {t("aide.pied")}
        </div>
      </div>
    </div>
  );
}

