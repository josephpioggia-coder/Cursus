/**
 * CURSUS — Fenêtre « Passer à une formule supérieure » (15/11/2026).
 * Aperçu calculé par Stripe → confirmation → un seul paiement. Voir supabase/functions/changer-formule.
 */
import { useEffect, useState } from "react";
import { apercuChangement, confirmerChangement, euros } from "../lib/changerFormule.js";
import { COULEURS } from "../lib/contenuPaliers.js";

export default function ChangerFormule({ priceId, nomCible, onFermer, onChange }) {
  const [accord, setAccord] = useState(false);
  const [etat, setEtat] = useState({ phase: "calcul" }); // calcul | apercu | envoi | fini | erreur
  useEffect(() => {
    let vivant = true;
    apercuChangement(priceId).then((r) => { if (vivant) setEtat(r.ok ? { phase: "apercu", r } : { phase: "erreur", message: r.message }); });
    return () => { vivant = false; };
  }, [priceId]);

  const confirmer = async () => {
    const r = etat.r;
    setEtat({ phase: "envoi", r });
    const res = await confirmerChangement(priceId, r.date_calcul);
    if (res.ok) { setEtat({ phase: "fini" }); onChange?.(); } else setEtat({ phase: "erreur", message: res.message });
  };

  const r = etat.r;
  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", color: "#2C1810", borderRadius: 14, padding: 22, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", fontFamily: "inherit", boxSizing: "border-box" }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: COULEURS.bordeaux, marginBottom: 10 }}>Passer à {nomCible}</div>

        {etat.phase === "calcul" && <p style={{ fontSize: 14 }}>Calcul du montant exact…</p>}

        {(etat.phase === "apercu" || etat.phase === "envoi") && r && (
          <>
            <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: "0 0 10px" }}>
              Vous passez de <b>{r.de}</b> à <b>{r.vers}</b> tout de suite. Une nouvelle période {r.periode === "annuel" ? "d'un an" : "d'un mois"} commence aujourd'hui au prix de {r.vers} ; la part non utilisée de votre formule actuelle, déjà payée, est déduite : un seul paiement.
            </p>
            <div style={{ border: "1px solid #e5ddd3", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
              {r.lignes.map((l, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, padding: "4px 0", color: l.montant_centimes < 0 ? "#1D7A55" : "#2C1810" }}>
                  <span style={{ minWidth: 0 }}>{l.description}</span><span style={{ whiteSpace: "nowrap" }}>{euros(l.montant_centimes)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 600, borderTop: "1px solid #e5ddd3", marginTop: 6, paddingTop: 8 }}>
                <span>À payer maintenant</span><span>{euros(r.a_payer_centimes)}</span>
              </div>
            </div>
            <p style={{ fontSize: 12, color: COULEURS.texteClair, lineHeight: 1.5, margin: "0 0 14px" }}>
              Montants calculés par notre prestataire de paiement. Si le paiement échoue, rien n'est modifié.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.5, margin: "0 0 8px", padding: "8px 10px", background: "#F7F4EF", borderRadius: 8 }}>
              <b>Ce changement est définitif :</b> pas de retour à une formule inférieure en cours de période, ni de remboursement. À l'échéance, vous pouvez changer librement.
            </p>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.45, margin: "0 0 14px", cursor: "pointer" }}>
              <input type="checkbox" checked={accord} onChange={(e) => setAccord(e.target.checked)} disabled={etat.phase === "envoi"} style={{ marginTop: 2, flexShrink: 0 }} />
              <span>Je demande l'exécution immédiate du service et je reconnais perdre mon droit de rétractation pour ce changement de formule.</span>
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={confirmer} disabled={etat.phase === "envoi" || !accord} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: COULEURS.bordeaux, color: "#fff", fontFamily: "inherit", fontSize: 14, cursor: accord ? "pointer" : "not-allowed", opacity: accord ? 1 : 0.5 }}>
                {etat.phase === "envoi" ? "Paiement en cours…" : `Confirmer et payer ${euros(r.a_payer_centimes)}`}
              </button>
              <button onClick={onFermer} disabled={etat.phase === "envoi"} style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${COULEURS.bordeaux}`, background: "transparent", color: COULEURS.bordeaux, fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>Annuler</button>
            </div>
          </>
        )}

        {etat.phase === "fini" && (
          <>
            <p style={{ fontSize: 14, lineHeight: 1.55 }}>✔ C'est fait : vous êtes maintenant en formule <b>{nomCible}</b>. La mise à jour de votre accès peut prendre quelques secondes.</p>
            <button onClick={onFermer} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: COULEURS.bordeaux, color: "#fff", fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>Fermer</button>
          </>
        )}

        {etat.phase === "erreur" && (
          <>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: "#B3261E" }}>{etat.message}</p>
            <button onClick={onFermer} style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${COULEURS.bordeaux}`, background: "transparent", color: COULEURS.bordeaux, fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>Fermer</button>
          </>
        )}
      </div>
    </div>
  );
}
