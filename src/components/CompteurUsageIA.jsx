/**
 * CURSUS — Compteur d'usage IA (60803-03)
 * ==========================================
 * Affiche la consommation réelle de tokens du compte face au quota de
 * son palier (+ crédits achetés), en temps réel — inspiré du compteur
 * de tokens visible pendant une session avec Claude. Remplace le silence
 * total qui existait jusqu'ici (les quotas annoncés dans Tarification.jsx
 * n'étaient que du texte, jamais appliqués).
 *
 * Trois états :
 *  - normal   : petite jauge discrète.
 *  - proche   : bannière d'avertissement (≥ 90 % consommé), la jauge
 *               reste utilisable.
 *  - atteinte : recouvrement bloquant avec 3 choix (attendre, acheter des
 *               tokens, upgrader) — remonté au parent via `bloque` pour
 *               désactiver les boutons d'analyse ailleurs dans l'appli.
 */

import { useState, useEffect, useCallback } from "react";
import { usageIAAPI } from "../lib/api.js";
import { journaliserErreur } from "../lib/journalErreurs.js";

const SEUIL_AVERTISSEMENT = 90;

// Prix Stripe de la recharge ponctuelle (7€ = 500 000 tokens, calculé sur
// la moyenne réelle mesurée de tokens/analyse — voir 2026-08-03-usage-ia.sql).
// PLACEHOLDER — ce produit n'existe pas encore côté Stripe : à créer
// (Produit "Recharge tokens Cursus", Prix unique 7€), puis remplacer
// RECHARGE_PRICE_ID par le price_id réel obtenu.
const RECHARGE_PRICE_ID = null;
const RECHARGE_TOKENS = 500000;
const RECHARGE_MONTANT = 7;

function formaterTokens(n) {
  return (n || 0).toLocaleString("fr-FR");
}

function prochainRenouvellement() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  d.setHours(0, 0, 0, 0);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

async function démarrerRechargeCheckout() {
  if (!RECHARGE_PRICE_ID) {
    alert("La recharge de tokens n'est pas encore configurée côté paiement. Contacte le support.");
    return;
  }
  const EDGE_FUNCTION_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/creer-session-checkout";
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
  try {
    const réponse = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ priceId: RECHARGE_PRICE_ID, nomPalier: "recharge_tokens", mode: "payment" }),
    });
    const { url } = await réponse.json();
    if (url) window.location.href = url;
  } catch (e) {
    journaliserErreur("CompteurUsageIA:démarrerRechargeCheckout", e.message);
  }
}

// Clé de mémorisation du "×" sur la bannière d'avertissement — 30/08/2026,
// à la demande de Joseph : rester fermée tant qu'on n'a pas changé de mois,
// au lieu de réapparaître à chaque remontage du composant (changement de
// chapitre, ouverture/fermeture du panneau...), ce qui la rendait présente
// en continu à l'écran malgré le bouton de fermeture.
function cléAvertissementFermé() {
  const d = new Date();
  return `cursus_avertissement_usage_ferme_${d.getFullYear()}-${d.getMonth()}`;
}

export default function CompteurUsageIA({ onDemanderUpgrade, onÉtatChange, rafraîchirDepuis, compact = false }) {
  const [état, setÉtat] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [avertissementFermé, setAvertissementFermé] = useState(() => {
    try { return localStorage.getItem(cléAvertissementFermé()) === "1"; } catch { return false; }
  });
  const [modalFermée, setModalFermée] = useState(false);

  const fermerAvertissement = useCallback(() => {
    setAvertissementFermé(true);
    try { localStorage.setItem(cléAvertissementFermé(), "1"); } catch { /* non bloquant */ }
  }, []);

  const rafraîchir = useCallback(async () => {
    const { data, error } = await usageIAAPI.recupererConsommation();
    if (error) {
      // Visible en console pour le diagnostic — le composant lui-même reste
      // silencieux dans l'interface (ne bloque jamais le co-pilote).
      console.error("CompteurUsageIA :", error.message);
      setErreur(error.message);
      return;
    }
    setÉtat(data);
  }, []);

  useEffect(() => { rafraîchir(); }, [rafraîchir, rafraîchirDepuis]);

  // Remonte l'état au parent (ex. CopiloteIA) pour qu'il puisse désactiver
  // ses propres boutons d'analyse sans dupliquer le calcul de quota.
  useEffect(() => { onÉtatChange?.(état); }, [état, onÉtatChange]);

  // Rafraîchissement périodique — "temps réel" au sens où l'affichage ne
  // reste jamais périmé plus d'une minute, sans avoir besoin d'un vrai
  // flux continu pour un compteur qui ne change qu'à chaque analyse.
  useEffect(() => {
    const intervalle = setInterval(rafraîchir, 60000);
    return () => clearInterval(intervalle);
  }, [rafraîchir]);

  if (erreur || !état) return null; // silencieux : pas de palier actif, ou erreur réseau — ne bloque jamais l'app

  const dépasséAvertissement = état.pourcentage >= SEUIL_AVERTISSEMENT && état.disponible > 0;
  const atteint = état.disponible <= 0;

  const couleur = atteint ? "#A32D2D" : dépasséAvertissement ? "#BA7517" : "#1D9E75";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: compact ? 11 : 12.5, color: "#777" }}>
        <div style={{ flex: compact ? "0 0 60px" : "0 0 100px", height: 5, background: "#eee", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${état.pourcentage}%`, height: "100%", background: couleur, transition: "width .3s" }} />
        </div>
        {!compact && (
          <span>
            {formaterTokens(état.consomme)} / {formaterTokens(état.quotaMensuel + état.credits)} tokens ce mois-ci
          </span>
        )}
      </div>

      {dépasséAvertissement && !avertissementFermé && (
        <div style={{ marginTop: 4, padding: "4px 8px", background: "#FAEEDA", borderRadius: 6, fontSize: 11, color: "#854F0B", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span>
            ⚠️ {état.pourcentage}% utilisés — renouvellement le {prochainRenouvellement()}.
          </span>
          <button onClick={fermerAvertissement} title="Ne plus afficher ce mois-ci"
            style={{ background: "none", border: "none", color: "#854F0B", cursor: "pointer", fontSize: 14, flexShrink: 0, lineHeight: 1 }}>×</button>
        </div>
      )}

      {atteint && !modalFermée && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: 420, padding: 28, boxShadow: "0 24px 80px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏸️</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Limite mensuelle atteinte</div>
            <div style={{ fontSize: 13.5, color: "#555", lineHeight: 1.6, marginBottom: 20 }}>
              Vous avez utilisé les {formaterTokens(état.quotaMensuel + état.credits)} tokens de votre palier
              « {état.palier} » ce mois-ci. Les analyses IA sont en pause jusqu'au renouvellement,
              sauf si vous choisissez l'une des options ci-dessous.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={démarrerRechargeCheckout}
                style={{ textAlign: "left", padding: "10px 14px", borderRadius: 8, border: "none", background: "#7F77DD", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 500 }}
              >
                💳 Acheter {formaterTokens(RECHARGE_TOKENS)} tokens supplémentaires — {RECHARGE_MONTANT}€
              </button>
              <button
                onClick={onDemanderUpgrade}
                style={{ textAlign: "left", padding: "10px 14px", borderRadius: 8, border: "none", background: "#1D9E75", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 500 }}
              >
                ⬆️ Passer à un palier supérieur
              </button>
              <button
                onClick={() => setModalFermée(true)}
                style={{ textAlign: "left", padding: "10px 14px", borderRadius: 8, border: "0.5px solid #e5e5e5", background: "#fafafa", cursor: "pointer", fontSize: 13, color: "#555" }}
              >
                📅 Attendre le renouvellement — {prochainRenouvellement()}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

