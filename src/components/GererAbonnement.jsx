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
  const [pauseOuverte, setPauseOuverte] = useState(false);
  const [moisPause, setMoisPause] = useState(1);

  const agir = async (action, extra = {}) => {
    setOccupe(true); setMessage(null);
    const r = await appelerFonction("gerer-abonnement", { action, ...extra });
    setOccupe(false);
    if (r?.ok) { setEtat(r); setConfirme(false); if (action === "annuler") setMessage("Votre annulation est enregistrée. Vous gardez l'accès jusqu'à la date indiquée."); if (action === "reactiver") setMessage("Votre abonnement continue normalement.");
      if (action === "pauser") { setPauseOuverte(false); setMessage("Votre pause est programmée : elle commence à la fin de la période déjà payée."); }
      if (action === "reprendre") setMessage("Votre abonnement reprend. Le webhook met l'accès à jour dans quelques secondes (rechargez la page si besoin)."); }
    else setMessage(r?.message || "L'opération n'a pas abouti.");
  };
  useEffect(() => { let vivant = true; appelerFonction("gerer-abonnement", { action: "etat" }).then((r) => { if (vivant && r?.ok) setEtat(r); }); return () => { vivant = false; }; }, []);

  if (!etat) return null;
  return (
    <div style={{ maxWidth: 560, margin: "0 auto 28px", background: "#fff", border: `1px solid ${COULEURS.bordeaux}30`, borderRadius: 12, padding: "14px 18px", color: COULEURS.texte, fontSize: 13.5, lineHeight: 1.55 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Mon abonnement : {etat.palier} ({etat.periode})</div>
      {etat.en_pause ? (
        <>
          <div>Abonnement <b>en pause</b> jusqu'au <b>{dateFr(etat.pause_fin)}</b> : lecture seule, rien n'est facturé. La reprise est automatique ; vous pouvez aussi reprendre tout de suite (une nouvelle période payée commence alors immédiatement).</div>
          <div style={{ marginTop: 10 }}>
            <button style={bouton(true)} disabled={occupe} onClick={() => agir("reprendre")}>{occupe ? "…" : "Reprendre maintenant"}</button>{" "}
            <button style={bouton(false)} disabled={occupe} onClick={() => agir("annuler")}>Annuler mon abonnement</button>
          </div>
        </>
      ) : etat.pause_programmee ? (
        <>
          <div>Pause programmée : elle commence le <b>{dateFr(etat.pause_debut)}</b> (fin de la période déjà payée), avec reprise automatique le <b>{dateFr(etat.pause_fin)}</b>. Vous gardez l'accès complet jusqu'au début de la pause.</div>
          <div style={{ marginTop: 10 }}><button style={bouton(false)} disabled={occupe} onClick={() => agir("reprendre")}>{occupe ? "…" : "Annuler la pause"}</button></div>
        </>
      ) : etat.annulation_programmee ? (
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
      {!etat.en_pause && !etat.pause_programmee && !etat.annulation_programmee && etat.periode === "mensuel" && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${COULEURS.bordeaux}20` }}>
          {etat.pause_possible ? (
            !pauseOuverte ? (
              <button style={bouton(false)} onClick={() => setPauseOuverte(true)}>Mettre en pause (jusqu'à {etat.pause_max_mois} mois)</button>
            ) : (
              <div style={{ background: "#F7F4EF", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ marginBottom: 8 }}>
                  La pause <b>commence à la fin de la période déjà payée</b> ({dateFr(etat.prochain_renouvellement)}) : vous gardez l'accès complet jusque-là. Pendant la pause, <b>rien n'est facturé</b> et l'accès est en <b>lecture seule</b> (vous relisez et exportez vos textes, sans IA ni modification). Votre formule, votre prix et vos projets sont conservés ; la reprise est automatique. Une seule pause par période de 12 mois.
                </div>
                <label style={{ fontSize: 13 }}>Durée :{" "}
                  <select value={moisPause} onChange={(e) => setMoisPause(Number(e.target.value))} style={{ fontSize: 13, padding: "4px 6px" }}>
                    {Array.from({ length: etat.pause_max_mois }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} mois</option>)}
                  </select>
                </label>{" "}
                <button style={bouton(true)} disabled={occupe} onClick={() => agir("pauser", { mois: moisPause })}>{occupe ? "…" : "Confirmer la pause"}</button>{" "}
                <button style={bouton(false)} disabled={occupe} onClick={() => setPauseOuverte(false)}>Fermer</button>
              </div>
            )
          ) : (
            <div style={{ fontSize: 12.5, color: COULEURS.texteClair }}>Pause indisponible : {etat.pause_raison}</div>
          )}
        </div>
      )}
      {message && <div style={{ marginTop: 8, fontSize: 12.5, color: COULEURS.texteClair }}>{message}</div>}
    </div>
  );
}
