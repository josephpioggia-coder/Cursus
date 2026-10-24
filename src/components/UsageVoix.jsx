/**
 * CURSUS — Usage voix (17/10/2026)
 * ======================================================================
 * Écran réservé au propriétaire du logiciel : totaux de consommation des
 * deux fonctionnalités voix (lecture à voix haute, dictée vocale), mois
 * civil en cours — point 4 de l'audit de préparation à la
 * commercialisation (CLAUDE.md). Jusqu'ici, seule la vérification
 * "abonnement actif" existait côté lire-texte, aucun suivi de volume nulle
 * part — surveillable uniquement via platform.openai.com/usage, qui
 * confond cette consommation avec tout autre usage OpenAI du compte.
 * Même principe que JournalErreurs.jsx/Supervision.jsx : aucune écriture
 * ni lecture directe vers Supabase, tout passe par admin-usage-voix qui
 * revérifie lui-même l'email de l'appelant.
 *
 * AUCUN coût en euros affiché ici — volontairement, voir le commentaire
 * de 2026-10-17-usage-voix.sql (tarifs OpenAI non figés dans ce dépôt,
 * un chiffre calculé ici deviendrait faux en silence au premier
 * changement de tarif). Les volumes bruts (caractères, octets) restent
 * exacts quoi qu'il arrive — à rapprocher de platform.openai.com/pricing
 * pour un coût.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

const COULEURS = {
  bordeaux: "#8B2635",
  fond: "#F7F4EF",
  texte: "#2C1810",
  texteClair: "#6B5D52",
};

function formaterOctets(octets) {
  if (!octets) return "0 Mo";
  const mo = octets / (1024 * 1024);
  return mo >= 1 ? `${mo.toFixed(1)} Mo` : `${(octets / 1024).toFixed(0)} Ko`;
}

const CarteStat = ({ label, valeur, sous }) => (
  <div style={{ background: COULEURS.fond, borderRadius: 8, padding: "14px 18px", flex: 1, minWidth: 160 }}>
    <div style={{ fontSize: 11, color: COULEURS.texteClair, marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 600, color: COULEURS.texte }}>{valeur}</div>
    {sous && <div style={{ fontSize: 11, color: COULEURS.texteClair, marginTop: 2 }}>{sous}</div>}
  </div>
);

export default function UsageVoix() {
  const [données, setDonnées] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const rafraîchir = useCallback(async () => {
    setChargement(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-usage-voix", { body: {} });
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
      if (data?.error) throw new Error(data.error);
      setDonnées(data);
      setErreur("");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { rafraîchir(); }, [rafraîchir]);

  return (
    <div style={{ padding: "28px 32px", flex: 1, overflowY: "auto", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: COULEURS.texte, margin: 0 }}>Usage voix</h1>
        <button onClick={rafraîchir} disabled={chargement} style={{
          fontSize: 12, color: COULEURS.bordeaux, background: "none",
          border: `0.5px solid ${COULEURS.bordeaux}50`, borderRadius: 6,
          padding: "4px 10px", cursor: chargement ? "default" : "pointer", fontFamily: "inherit",
        }}>
          ↻ Rafraîchir
        </button>
      </div>

      <p style={{ fontSize: 12.5, color: COULEURS.texteClair, marginBottom: 16 }}>
        Consommation réelle de la lecture à voix haute et de la dictée vocale, mois civil en cours.
        Pas de coût en euros ici (tarifs OpenAI non figés dans ce dépôt) — voir
        platform.openai.com/usage pour le coût exact facturé.
      </p>

      {erreur && (
        <div style={{ background: "#FBE9E9", color: "#A32D2D", padding: "10px 14px", borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
          {erreur}
        </div>
      )}

      {chargement ? (
        <div style={{ fontSize: 13, color: COULEURS.texteClair }}>Chargement…</div>
      ) : !données ? null : (
        <>
          <div style={{ fontSize: 11, color: COULEURS.texteClair, marginBottom: 10 }}>
            Depuis le {new Date(données.depuis_le).toLocaleDateString("fr-BE", { dateStyle: "long" })}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <CarteStat
              label="Lecture à voix haute"
              valeur={`${données.totaux.lecture_voix.caracteres.toLocaleString("fr-FR")} caractères`}
              sous={`${données.totaux.lecture_voix.appels} appel${données.totaux.lecture_voix.appels !== 1 ? "s" : ""}`}
            />
            <CarteStat
              label="Dictée vocale"
              valeur={formaterOctets(données.totaux.dictee_vocale.octets)}
              sous={`${données.totaux.dictee_vocale.appels} appel${données.totaux.dictee_vocale.appels !== 1 ? "s" : ""} — poids des fichiers audio, pas la durée`}
            />
          </div>

          <h2 style={{ fontSize: 14, color: COULEURS.texte, marginBottom: 10 }}>Par compte</h2>
          {données.par_compte.length === 0 ? (
            <div style={{ fontSize: 13, color: COULEURS.texteClair }}>Aucun usage ce mois-ci.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {données.par_compte.map((c) => (
                <div key={c.user_id} style={{
                  display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
                  border: "0.5px solid #e5e5e5", borderRadius: 7, padding: "8px 12px", fontSize: 12.5,
                }}>
                  <span style={{ color: COULEURS.texte }}>{c.email || c.user_id}</span>
                  <span style={{ color: COULEURS.texteClair }}>
                    {c.lecture_caracteres > 0 && `${c.lecture_caracteres.toLocaleString("fr-FR")} caractères lus`}
                    {c.lecture_caracteres > 0 && c.dictee_octets > 0 && " · "}
                    {c.dictee_octets > 0 && `${formaterOctets(c.dictee_octets)} dictés`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
