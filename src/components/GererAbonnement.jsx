/**
 * CURSUS — Gérer mon abonnement : annuler / reprendre (15/11/2026). Voir supabase/functions/gerer-abonnement.
 * L'annulation prend effet à la fin de la période déjà payée, sans remboursement (CGV art. 5-6) ; l'accès reste complet jusque-là.
 */
import { useEffect, useState } from "react";
import { appelerFonction } from "../lib/changerFormule.js";
import { COULEURS } from "../lib/contenuPaliers.js";

const dateFr = (t) => new Date(t * 1000).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" });
const bouton = (plein) => ({ padding: "9px 16px", borderRadius: 8, border: `1px solid ${COULEURS.bordeaux}`, background: plein ? COULEURS.bordeaux : "transparent", color: plein ? "#fff" : COULEURS.bordeaux, fontFamily: "inherit", fontSize: 13.5, cursor: "pointer" });

export default function GererAbonnement() {
  const [etat, setEtat] = useState(null);       // réponse de la fonction, ou null (pas d'abonnement / chargement)
  const [confirme, setConfirme] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState(null);

  const agir = async (action) => {
    setOccupe(true); setMessage(null);
    const r = await appelerFonction("gerer-abonnement", { action });
    setOccupe(false);
    if (r?.ok) { setEtat(r); setConfirme(false); if (action === "annuler") setMessage("Votre annulation est enregistrée. Vous gardez l'accès jusqu'à la date indiquée."); if (action === "reactiver") setMessage("Votre abonnement continue normalement."); }
    else setMessage(r?.message || "L'opération n'a pas abouti.");
  };
  useEffect(() => { let vivant = true; appelerFonction("gerer-abonnement", { action: "etat" }).then((r) => { if (vivant && r?.ok) setEtat(r); }); return () => { vivant = false; }; }, []);

  if (!etat) return null;
  return (
    <div style={{ maxWidth: 560, margin: "0 auto 28px", background: "#fff", border: `1px solid ${COULEURS.bordeaux}30`, borderRadius: 12, padding: "14px 18px", color: COULEURS.texte, fontSize: 13.5, lineHeight: 1.55 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Mon abonnement : {etat.palier} ({etat.periode})</div>
      {etat.annulation_programmee ? (
        <>
          <div>Annulation programmée : vous gardez l'accès complet jusqu'au <b>{dateFr(etat.fin_acces)}</b>, puis l'abonnement s'arrête.</div>
          <div style={{ marginTop: 10 }}><button style={bouton(true)} disabled={occupe} onClick={() => agir("reactiver")}>{occupe ? "…" : "Reprendre mon abonnement"}</button></div>
        </>
      ) : (
        <>
          <div>Prochain renouvellement : <b>{dateFr(etat.prochain_renouvellement)}</b>.</div>
          {etat.limite_annulation && etat.annulation_possible && (
            <div style={{ fontSize: 12.5, color: COULEURS.texteClair }}>Pour ne pas le renouveler, annulez au plus tard le <b>{dateFr(etat.limite_annulation)}</b> ({etat.preavis_jours} jours avant l'échéance).</div>
          )}
          {etat.annulation_possible === false ? (
            <div style={{ marginTop: 8, fontSize: 12.5, color: COULEURS.texteClair }}>Le délai pour ne pas renouveler (jusqu'au {dateFr(etat.limite_annulation)}) est dépassé : l'abonnement sera renouvelé. Pour toute question, écrivez-nous.</div>
          ) : !confirme ? (
            <div style={{ marginTop: 10 }}><button style={bouton(false)} onClick={() => setConfirme(true)}>Annuler mon abonnement</button></div>
          ) : (
            <div style={{ marginTop: 10, background: "#F7F4EF", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ marginBottom: 8 }}>
                L'annulation prend effet à la <b>fin de la période déjà payée</b> : vous gardez l'accès complet jusque-là, sans remboursement.
                {etat.engagement_en_cours && " Votre formule comporte un engagement de 3 mois minimum : l'abonnement s'arrêtera à la fin de ces 3 mois."}
              </div>
              <button style={bouton(true)} disabled={occupe} onClick={() => agir("annuler")}>{occupe ? "…" : "Confirmer l'annulation"}</button>{" "}
              <button style={bouton(false)} disabled={occupe} onClick={() => setConfirme(false)}>Garder mon abonnement</button>
            </div>
          )}
        </>
      )}
      {message && <div style={{ marginTop: 8, fontSize: 12.5, color: COULEURS.texteClair }}>{message}</div>}
    </div>
  );
}
