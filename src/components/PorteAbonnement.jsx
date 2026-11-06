/**
 * CURSUS — Porte d'entrée de CursEdit (06/11/2026)
 * ======================================================================
 * Décision de Joseph : on n'entre dans CursEdit qu'en passant par la page de tarification, avec un
 * abonnement actif OU un code promotionnel (ex. 100 % pendant 3 mois, défini dans Administration).
 * Avant ce correctif, un compte jamais abonné atteignait tout le shell (tableau de bord, projets) et
 * ne voyait un blocage qu'à l'ouverture d'un chapitre, avec un message qui parlait à tort de « période
 * de 3 mois passée ».
 *
 * Bloque seulement : motif « jamais_abonné » et « annulé_ancien » (voir abonnementsAPI.statutAccès).
 * « annulé_recent » garde la lecture seule de 3 mois (CGV art. 6). Jamais bloqué : le compte propriétaire,
 * un abonnement actif, et tout cas où le statut n'a pas pu être lu (on ne risque pas d'enfermer un abonné
 * réel à cause d'une erreur réseau : même principe que `accèsCursEdit` dans App.jsx).
 * CursAudit n'est pas concerné (paiement à l'acte).
 *
 * Après un paiement (retour Stripe) le webhook peut mettre quelques secondes à enregistrer l'abonnement :
 * l'accès est revérifié toutes les 5 s tant que cet écran est affiché.
 */
import { useEffect, useState } from "react";
import { abonnementsAPI } from "../lib/api.js";
import { COULEURS } from "../lib/contenuPaliers.js";
import GrillePaliers from "./GrillePaliers.jsx";

const MOTIFS_BLOQUES = ["jamais_abonné", "annulé_ancien"];

export default function PorteAbonnement({ estAdmin, onChangerEspace, onDéconnecter, children }) {
  const [statut, setStatut] = useState(null); // null = pas encore lu
  const [verif, setVerif] = useState(false);
  const [lu, setLu] = useState(false); // la lecture a abouti OU échoué : on n'attend jamais indéfiniment

  const lire = async () => {
    let data = null;
    try { ({ data } = await abonnementsAPI.statutAccès()); } catch { /* repli : accès laissé ouvert */ }
    if (data) setStatut(data);
    setLu(true);
    return data;
  };

  useEffect(() => { if (!estAdmin) lire(); }, [estAdmin]);

  const bloque = !estAdmin && statut && MOTIFS_BLOQUES.includes(statut.motif);

  // Revérification automatique tant que l'écran de blocage est affiché.
  useEffect(() => {
    if (!bloque) return undefined;
    const t = setInterval(() => { lire(); }, 5000);
    return () => clearInterval(t);
  }, [bloque]);

  if (!estAdmin && !lu) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", color: "#999", fontSize: 14 }}>
        Chargement…
      </div>
    );
  }
  if (!bloque) return children;

  const verifierMaintenant = async () => {
    setVerif(true);
    await lire();
    setVerif(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: COULEURS.fond, fontFamily: "Inter, sans-serif", padding: "40px 24px 80px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          <button type="button" onClick={onChangerEspace} style={lien}>← Changer d'espace</button>
          <button type="button" onClick={onDéconnecter} style={lien}>Se déconnecter</button>
        </div>

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 600, color: COULEURS.bordeaux, margin: "0 0 12px" }}>
            Active ton accès à CursEdit
          </h1>
          <p style={{ fontSize: 15, color: COULEURS.texteClair, margin: "0 auto 8px", maxWidth: 620, lineHeight: 1.5 }}>
            {statut.motif === "annulé_ancien"
              ? "Ton abonnement est terminé depuis plus de 3 mois : réabonne-toi pour retrouver tes textes."
              : "Pour écrire dans CursEdit, choisis une formule. Si tu as reçu un code promotionnel ou un code cadeau, saisis-le dans la case « Code promotionnel » ci-dessous, puis clique sur « Choisir » : le montant à payer sera 0 € si ton code le prévoit."}
          </p>
          <p style={{ fontSize: 12.5, color: COULEURS.texteClair, margin: "0 0 6px" }}>
            Tu as déjà payé ou activé ton code ? Cet écran se met à jour tout seul, ou{" "}
            <button type="button" onClick={verifierMaintenant} disabled={verif} style={{ ...lien, textDecoration: "underline" }}>
              {verif ? "vérification…" : "vérifie maintenant"}
            </button>.
          </p>
        </div>

        <GrillePaliers />
      </div>
    </div>
  );
}

const lien = { background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: COULEURS.bordeaux, padding: 0 };
