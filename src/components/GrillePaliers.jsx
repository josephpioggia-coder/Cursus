/**
 * CURSUS — Grille des 5 paliers CursEdit, partagée (référence 60816-01,
 * suite, 07/09/2026)
 * ======================================================================
 * Extrait de Tarification.jsx pour être réutilisé tel quel par la page de
 * lancement (PageLancement.jsx, hors shell applicatif) SANS dupliquer la
 * logique de paiement réel (Stripe Checkout) à deux endroits — un seul
 * endroit qui appelle demarrerCheckout(), peu importe la page d'où on
 * vient.
 *
 * L'accès à CursAudit (palier Essentiel) et CursDecision (palier Initié)
 * est listé directement dans CONTENU_PALIERS[cle].fonctionnalites — visible
 * partout où cette grille s'affiche, pas dans un encadré séparé.
 */

import { useState } from "react";
import { PRIX_STRIPE, ORDRE_PALIERS } from "../lib/prix-stripe-config.mjs";
import { COULEURS, CONTENU_PALIERS, LOGOS_ESPACES, demarrerCheckout } from "../lib/contenuPaliers.js";
import ChangerFormule from "./ChangerFormule.jsx";

// `formuleActuelle` (nom du palier, ex. « Essentiel ») : si le compte a déjà un abonnement actif, les boutons deviennent
// « Passer à … » (changement au prorata, voir ChangerFormule.jsx) au lieu d'un nouveau paiement.
export default function GrillePaliers({ formuleActuelle = null, onFormuleChangee = null }) {
  const [periode, setPeriode] = useState("mensuel");
  const [changement, setChangement] = useState(null); // { priceId, nom }
  const rangActuel = formuleActuelle ? ORDRE_PALIERS.findIndex((c) => PRIX_STRIPE[c].nom === formuleActuelle) : -1;
  const [codePromo, setCodePromo] = useState("");

  return (
    <div>
      {/* Toggle mensuel / annuel */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 48 }}>
        <div style={{ display: "inline-flex", background: "#fff", border: `1px solid ${COULEURS.bordeaux}30`, borderRadius: 30, padding: 4 }}>
          <button
            onClick={() => setPeriode("mensuel")}
            style={{
              padding: "8px 20px", borderRadius: 26, border: "none", fontFamily: "inherit",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              background: periode === "mensuel" ? COULEURS.bordeaux : "transparent",
              color: periode === "mensuel" ? "#fff" : COULEURS.texte, transition: "all 0.2s",
            }}
          >
            Mensuel
          </button>
          <button
            onClick={() => setPeriode("annuel")}
            style={{
              padding: "8px 20px", borderRadius: 26, border: "none", fontFamily: "inherit",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              background: periode === "annuel" ? COULEURS.bordeaux : "transparent",
              color: periode === "annuel" ? "#fff" : COULEURS.texte, transition: "all 0.2s",
            }}
          >
            Annuel
            <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px", borderRadius: 20, background: periode === "annuel" ? "#ffffff30" : `${COULEURS.or}25`, color: periode === "annuel" ? "#fff" : "#7A5A10" }}>
              −17%
            </span>
          </button>
        </div>
      </div>

      {/* Code promotionnel (60803-02) — optionnel, appliqué au moment du
          paiement, vérifié côté serveur (jamais côté client). */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
        <input
          type="text"
          value={codePromo}
          onChange={(e) => setCodePromo(e.target.value)}
          placeholder="Code promotionnel (optionnel)"
          autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false}
          aria-label="Code promotionnel"
          style={{
            // 09/11/2026 : le champ de 260 px coupait les codes longs (ex. « PRENOM-100%-ABCD ») ; pleine largeur jusqu'à 460 px, 16 px de
            // corps de texte (en dessous, le navigateur mobile zoome la page à la saisie), correction automatique coupée (accents, %).
            padding: "10px 14px", borderRadius: 8, border: `1px solid ${COULEURS.bordeaux}30`,
            fontFamily: "inherit", fontSize: 16, width: "100%", maxWidth: 460, boxSizing: "border-box", textAlign: "center",
            textTransform: "uppercase", letterSpacing: 0.5,
          }}
        />
      </div>

      {/* Grille des 5 cartes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {ORDRE_PALIERS.map((cle) => {
          const palier = PRIX_STRIPE[cle];
          const contenu = CONTENU_PALIERS[cle];
          const prixActuel = periode === "mensuel" ? palier.mensuel : palier.annuel;
          const priceIdActuel = prixActuel.price_id;

          return (
            <div
              key={cle}
              style={{
                background: "#fff", borderRadius: 14, padding: 24,
                border: contenu.miseEnAvant ? `2px solid ${COULEURS.bordeaux}` : `1px solid ${COULEURS.bordeaux}20`,
                display: "flex", flexDirection: "column", position: "relative",
              }}
            >
              {contenu.miseEnAvant && (
                <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: COULEURS.bordeaux, color: "#fff", fontSize: 10, fontWeight: 500, padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>
                  ★ Cœur de cible
                </div>
              )}

              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600, color: COULEURS.bordeaux, margin: "8px 0 4px" }}>
                {palier.nom}
              </h3>
              <p style={{ fontSize: 12, color: COULEURS.texteClair, margin: "0 0 16px", lineHeight: 1.5, minHeight: 32 }}>
                {contenu.description}
              </p>

              <div style={{ marginBottom: 4 }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 600, color: COULEURS.texte }}>
                  {prixActuel.montant.toFixed(2).replace(".", ",")}€
                </span>
                <span style={{ fontSize: 12, color: COULEURS.texteClair }}>
                  {periode === "mensuel" ? " /mois" : " /an"}
                </span>
              </div>
              {/* L'engagement de 3 mois ne vaut que pour la formule MENSUELLE : l'annuel est déjà payé pour l'année. */}
              {contenu.engagement && periode === "mensuel" ? (
                <p style={{ fontSize: 10, color: COULEURS.or, fontWeight: 500, margin: "0 0 16px" }}>
                  {contenu.engagement}
                </p>
              ) : <div style={{ marginBottom: 16 }} />}

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", flex: 1 }}>
                {contenu.fonctionnalites.map((f, i) => (
                  <li key={i} style={{ fontSize: 12, color: COULEURS.texte, marginBottom: 8, paddingLeft: 16, position: "relative", lineHeight: 1.5 }}>
                    <span style={{ position: "absolute", left: 0, color: COULEURS.or }}>·</span>
                    {f}
                  </li>
                ))}
              </ul>

              {contenu.espaces && (
                <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                  {contenu.espaces.map((espace) => (
                    <img key={espace} src={LOGOS_ESPACES[espace]} alt="" style={{ width: 26, height: 26, objectFit: "contain", borderRadius: 6, ...(espace === "cursdecision" ? { filter: "grayscale(1)", opacity: 0.55 } : null) }} />
                  ))}
                </div>
              )}

              {rangActuel >= 0 ? (
                ORDRE_PALIERS.indexOf(cle) === rangActuel ? (
                  <div style={{ padding: "10px", textAlign: "center", fontSize: 13, color: COULEURS.texteClair, border: `1px dashed ${COULEURS.bordeaux}40`, borderRadius: 8 }}>✔ Votre formule actuelle</div>
                ) : ORDRE_PALIERS.indexOf(cle) > rangActuel ? (
                  <button
                    onClick={() => setChangement({ priceId: priceIdActuel, nom: palier.nom })}
                    style={{
                      padding: "10px", borderRadius: 8, border: "none", background: COULEURS.bordeaux, color: "#fff",
                      fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    Passer à {palier.nom}
                  </button>
                ) : (
                  <div style={{ padding: "6px 4px", textAlign: "center", fontSize: 11.5, color: COULEURS.texteClair, lineHeight: 1.4 }}>Le passage à une formule supérieure est définitif : pas de retour à une formule inférieure en cours de période, ni de remboursement. À l'échéance, vous pouvez changer librement, au moment de la nouvelle somme échue, en choisissant la version qui vous convient.</div>
                )
              ) : (
              <button
                onClick={() => demarrerCheckout(priceIdActuel, cle, codePromo)}
                style={{
                  padding: "10px", borderRadius: 8,
                  border: contenu.miseEnAvant ? "none" : `1px solid ${COULEURS.bordeaux}`,
                  background: contenu.miseEnAvant ? COULEURS.bordeaux : "transparent",
                  color: contenu.miseEnAvant ? "#fff" : COULEURS.bordeaux,
                  fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}
              >
                Choisir {palier.nom}
              </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 07/09/2026 — le nombre d'"analyses IA / mois" annoncé par palier
          suppose le niveau Standard ; le choix de niveau à l'usage
          (Rapide/Standard/Approfondi/Maximal, voir POIDS_PAR_MODELE dans
          src/lib/api.js) consomme le même quota plus ou moins vite, pas
          un prix différent. */}
      <p style={{ textAlign: "center", fontSize: 11, color: COULEURS.texteClair, marginTop: 16, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
        Le nombre d'analyses IA indiqué par palier correspond au niveau Standard. Un niveau plus
        poussé (Approfondi, Maximal) consomme davantage de ce même quota par analyse ; un niveau
        plus léger (Rapide) l'étire — le prix de l'abonnement ne change pas.
      </p>

      <p style={{ textAlign: "center", fontSize: 11, color: COULEURS.texteClair, marginTop: 8 }}>
        Tous les prix sont indiqués hors TVA. Le renouvellement de l'abonnement annuel est tacite 30 jours avant l'échéance. Mais vous pouvez annuler à tout moment : l'annulation prend effet à la fin de la période déjà payée. Seule la formule Découverte mensuelle comporte un engagement de 3 mois minimum.
      </p>
      {changement && (
        <ChangerFormule priceId={changement.priceId} nomCible={changement.nom}
          onFermer={() => setChangement(null)} onChange={() => onFormuleChangee?.()} />
      )}
    </div>
  );
}
