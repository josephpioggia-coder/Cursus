/**
 * CURSUS — Administration (60804-03)
 * ======================================
 * Cadre réservé au propriétaire du logiciel. Première section : gestion
 * des codes promotionnels (création, liste, activation/désactivation).
 *
 * Aucune écriture directe vers Supabase depuis ce composant : tout passe
 * par l'Edge Function admin-codes-promo, qui revérifie elle-même que
 * l'appelant est un administrateur — cet écran n'est qu'une commodité,
 * pas la sécurité. Si quelqu'un d'autre que le propriétaire atteint cet
 * écran (lien deviné, etc.), toute action échoue côté serveur.
 *
 * DIAGNOSTIC PERMANENT (temporaire, 04-05/08/2026) — un panneau "Journal"
 * toujours visible en haut de la page trace chaque étape réelle (session,
 * requête envoyée, réponse reçue) en texte brut. Objectif : une simple
 * capture d'écran de la page suffit à voir où le processus s'arrête,
 * sans avoir besoin d'ouvrir la console du navigateur.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase.js";
import { ORDRE_PALIERS, PRIX_STRIPE } from "../lib/prix-stripe-config.mjs";

const COULEURS = {
  bordeaux: "#8B2635",
  or: "#C4973A",
  fond: "#F7F4EF",
  texte: "#2C1810",
  texteClair: "#6B5D52",
};

const FORMULAIRE_VIDE = {
  code: "",
  clientEmail: "",
  palierCible: "",
  produitCible: "",
  remisePourcent: 20,
  dureeMois: 1,
  dateDebut: "",
  dateFin: "",
  utilisationsMax: "",
};

export default function Administration() {
  const [codes, setCodes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [formulaire, setFormulaire] = useState(FORMULAIRE_VIDE);
  // Code secret admin (16/08/2026) — volontairement hors de `formulaire` :
  // il ne doit PAS être réinitialisé après chaque création (sinon
  // l'administrateur devrait le retaper à chaque code), mais il ne doit
  // jamais être envoyé ailleurs qu'à admin-codes-promo, ni stocké.
  const [secretAdmin, setSecretAdmin] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [journal, setJournal] = useState([]);
  const compteurLigne = useRef(0);

  const noter = useCallback((message) => {
    compteurLigne.current += 1;
    const ligne = `${compteurLigne.current}. [${new Date().toLocaleTimeString("fr-FR")}] ${message}`;
    setJournal((j) => [...j, ligne]);
  }, []);

  // 05/08/2026 — cause identifiée : en cas de session momentanément
  // absente/mal relue, le code retombait sur la clé publishable
  // (VITE_SUPABASE_ANON_KEY, format sb_publishable_...) envoyée en
  // Authorization. Or cette clé n'est PAS un JWT depuis la migration
  // Supabase vers les nouvelles clés publishable/secret — l'API attend
  // un vrai JWT utilisateur dans Authorization, la clé publishable ne va
  // que dans apikey. Une clé publishable en Authorization peut être
  // rejetée avant même que la fonction Edge ne s'exécute, silencieusement.
  // Correctif : ne plus jamais utiliser la clé publishable comme repli en
  // Authorization ; échouer clairement si aucune session n'existe ; et
  // utiliser supabase.functions.invoke() (qui gère lui-même les bons
  // en-têtes) plutôt qu'un fetch manuel.
  const appellerAdmin = useCallback(async (action, params = {}) => {
    noter(`Action "${action}" — récupération de la session…`);

    const { data, error: erreurSession } = await supabase.auth.getSession();
    if (erreurSession) {
      noter(`⚠ Erreur session : ${erreurSession.message}`);
      throw new Error(`Erreur session : ${erreurSession.message}`);
    }

    const session = data?.session || null;
    if (!session?.access_token) {
      noter("⚠ Aucune session utilisateur active. Appel admin annulé (pas de repli sur la clé publishable).");
      throw new Error("Session administrateur absente. Recharge la page et reconnecte-toi.");
    }
    noter(`Session trouvée, expire à ${new Date(session.expires_at * 1000).toLocaleTimeString("fr-FR")}.`);

    noter(`Appel supabase.functions.invoke("admin-codes-promo", { action: "${action}" })…`);
    const { data: réponse, error } = await supabase.functions.invoke("admin-codes-promo", {
      body: { action, ...params },
    });

    if (error) {
      noter(`⚠ Erreur Edge Function : ${error.message}`);
      throw new Error(error.message || "Erreur Edge Function.");
    }
    noter(`Réponse fonction : ${JSON.stringify(réponse).slice(0, 300)}`);

    if (réponse?.error) {
      throw new Error(réponse.error);
    }
    return réponse;
  }, [noter]);

  const rafraîchir = useCallback(async () => {
    setChargement(true);
    try {
      const { codes } = await appellerAdmin("lister");
      setCodes(codes || []);
      setErreur("");
      noter(`Liste mise à jour : ${(codes || []).length} code(s).`);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [appellerAdmin, noter]);

  useEffect(() => {
    noter("Composant Administration monté — chargement initial.");
    rafraîchir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const majChamp = (champ, valeur) => setFormulaire((f) => ({ ...f, [champ]: valeur }));

  const créerCode = async () => {
    setEnvoiEnCours(true);
    setErreur("");
    noter("— Clic sur « Créer le code » —");
    try {
      await appellerAdmin("creer", {
        secretAdmin,
        code: formulaire.code,
        clientEmail: formulaire.clientEmail || null,
        palierCible: formulaire.palierCible || null,
        produitCible: formulaire.produitCible || null,
        remisePourcent: Number(formulaire.remisePourcent),
        dureeMois: Number(formulaire.dureeMois),
        dateDebut: formulaire.dateDebut || null,
        dateFin: formulaire.dateFin || null,
        utilisationsMax: formulaire.utilisationsMax ? Number(formulaire.utilisationsMax) : null,
      });
      noter("Création confirmée par le serveur, rafraîchissement de la liste…");
      setFormulaire(FORMULAIRE_VIDE);
      await rafraîchir();
    } catch (e) {
      noter(`⚠ Échec final : ${e.message}`);
      setErreur(e.message);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const basculerActif = async (ligne) => {
    try {
      await appellerAdmin("definirActif", { secretAdmin, id: ligne.id, actif: !ligne.actif });
      await rafraîchir();
    } catch (e) {
      setErreur(e.message);
    }
  };

  const champStyle = {
    padding: "8px 10px",
    border: `0.5px solid ${COULEURS.texteClair}55`,
    borderRadius: 6,
    fontSize: 13,
    fontFamily: "inherit",
    width: "100%",
  };
  const labelStyle = { fontSize: 12, color: COULEURS.texteClair, marginBottom: 4, display: "block" };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1000 }}>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, color: COULEURS.bordeaux, marginBottom: 4 }}>
        Administration
      </h1>
      <p style={{ fontSize: 13, color: COULEURS.texteClair, marginBottom: 4 }}>
        Codes promotionnels — création et gestion.
      </p>
      <div style={{ fontSize: 12, color: "#8B2635", marginBottom: 16 }}>
        ADMIN BUILD 60805-SESSION-INVOKE
      </div>

      {/* Panneau de diagnostic permanent — à retirer une fois le problème résolu */}
      <div style={{
        background: "#1E1E1E", color: "#D4D4D4", fontFamily: "monospace", fontSize: 11.5,
        padding: 14, borderRadius: 8, marginBottom: 20, maxHeight: 260, overflowY: "auto",
      }}>
        <div style={{ color: "#4EC9B0", marginBottom: 6 }}>JOURNAL DE DIAGNOSTIC (temporaire)</div>
        {journal.length === 0
          ? <div>(rien encore)</div>
          : journal.map((ligne, i) => <div key={i}>{ligne}</div>)}
      </div>

      {erreur && (
        <div style={{ background: "#FBE9E9", color: "#A32D2D", padding: "10px 14px", borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
          {erreur}
        </div>
      )}

      <div style={{
        background: "#FBE9E9", padding: "14px 16px", borderRadius: 8, marginBottom: 16,
      }}>
        <label style={{ ...labelStyle, color: "#A32D2D" }}>
          Code secret administrateur * (requis pour créer ou activer/désactiver un code — pas pour la simple consultation)
        </label>
        <input style={{ ...champStyle, maxWidth: 320 }} type="password" value={secretAdmin}
               onChange={(e) => setSecretAdmin(e.target.value)}
               placeholder="connu uniquement de l'administrateur" required autoComplete="off" />
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
        background: COULEURS.fond, padding: 20, borderRadius: 8, marginBottom: 28,
      }}>
        <div>
          <label style={labelStyle}>Code *</label>
          <input style={champStyle} value={formulaire.code} onChange={(e) => majChamp("code", e.target.value)}
                 placeholder="MARIE-30-3M" required />
        </div>
        <div>
          <label style={labelStyle}>Email cible (optionnel)</label>
          <input style={champStyle} type="email" value={formulaire.clientEmail}
                 onChange={(e) => majChamp("clientEmail", e.target.value)} placeholder="tous les emails si vide" />
        </div>
        <div>
          <label style={labelStyle}>Palier cible (optionnel)</label>
          <select style={champStyle} value={formulaire.palierCible} onChange={(e) => majChamp("palierCible", e.target.value)}>
            <option value="">Tous les paliers</option>
            {ORDRE_PALIERS.map((cle) => (
              <option key={cle} value={cle}>{PRIX_STRIPE[cle].nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Produit cible</label>
          <select style={champStyle} value={formulaire.produitCible} onChange={(e) => majChamp("produitCible", e.target.value)}>
            <option value="">Les deux (CursEdit + CursAudit)</option>
            <option value="cursedit">CursEdit uniquement</option>
            <option value="cursaudit">CursAudit uniquement</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Remise % (5 à 100) *</label>
          <input style={champStyle} type="number" min={5} max={100} value={formulaire.remisePourcent}
                 onChange={(e) => majChamp("remisePourcent", e.target.value)} required />
        </div>
        <div>
          <label style={labelStyle}>Durée (mois — 0 = une fois, 99 = à vie)</label>
          <input style={champStyle} type="number" min={0} max={99} value={formulaire.dureeMois}
                 onChange={(e) => majChamp("dureeMois", e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Valable à partir du (optionnel)</label>
          <input style={champStyle} type="date" value={formulaire.dateDebut}
                 onChange={(e) => majChamp("dateDebut", e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Valable jusqu'au (optionnel)</label>
          <input style={champStyle} type="date" value={formulaire.dateFin}
                 onChange={(e) => majChamp("dateFin", e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Limite d'utilisations (optionnel)</label>
          <input style={champStyle} type="number" min={1} value={formulaire.utilisationsMax}
                 onChange={(e) => majChamp("utilisationsMax", e.target.value)} placeholder="illimité si vide" />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); créerCode(); }} disabled={envoiEnCours} style={{
            background: COULEURS.bordeaux, color: "#fff", border: "none", borderRadius: 6,
            padding: "10px 20px", fontSize: 13, cursor: envoiEnCours ? "default" : "pointer",
            opacity: envoiEnCours ? 0.6 : 1,
          }}>
            {envoiEnCours ? "Création…" : "Créer le code"}
          </button>
        </div>
      </div>

      <h2 style={{ fontSize: 15, color: COULEURS.texte, marginBottom: 12 }}>Codes existants</h2>
      {chargement ? (
        <p style={{ fontSize: 13, color: COULEURS.texteClair }}>Chargement…</p>
      ) : codes.length === 0 ? (
        <p style={{ fontSize: 13, color: COULEURS.texteClair }}>Aucun code créé pour l'instant.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: COULEURS.texteClair, borderBottom: `0.5px solid ${COULEURS.texteClair}55` }}>
                <th style={{ padding: "6px 8px" }}>Code</th>
                <th style={{ padding: "6px 8px" }}>Email</th>
                <th style={{ padding: "6px 8px" }}>Palier</th>
                <th style={{ padding: "6px 8px" }}>Produit</th>
                <th style={{ padding: "6px 8px" }}>Remise</th>
                <th style={{ padding: "6px 8px" }}>Durée</th>
                <th style={{ padding: "6px 8px" }}>Période</th>
                <th style={{ padding: "6px 8px" }}>Utilisations</th>
                <th style={{ padding: "6px 8px" }}>Statut</th>
                <th style={{ padding: "6px 8px" }}></th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} style={{ borderBottom: `0.5px solid ${COULEURS.texteClair}22` }}>
                  <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>{c.code}</td>
                  <td style={{ padding: "6px 8px" }}>{c.client_email || "—"}</td>
                  <td style={{ padding: "6px 8px" }}>{c.palier_cible ? (PRIX_STRIPE[c.palier_cible]?.nom || c.palier_cible) : "Tous"}</td>
                  <td style={{ padding: "6px 8px" }}>{c.produit_cible === "cursedit" ? "CursEdit" : c.produit_cible === "cursaudit" ? "CursAudit" : "Les deux"}</td>
                  <td style={{ padding: "6px 8px" }}>{c.remise_pourcent}%</td>
                  <td style={{ padding: "6px 8px" }}>{c.duree_mois === 0 ? "1 fois" : c.duree_mois === 99 ? "à vie" : `${c.duree_mois} mois`}</td>
                  <td style={{ padding: "6px 8px" }}>
                    {c.date_debut || c.date_fin
                      ? `${c.date_debut ? new Date(c.date_debut).toLocaleDateString("fr-FR") : "…"} → ${c.date_fin ? new Date(c.date_fin).toLocaleDateString("fr-FR") : "…"}`
                      : "illimitée"}
                  </td>
                  <td style={{ padding: "6px 8px" }}>{c.utilisations}{c.utilisations_max ? ` / ${c.utilisations_max}` : ""}</td>
                  <td style={{ padding: "6px 8px" }}>
                    <span style={{ color: c.actif ? "#1D9E75" : "#A32D2D" }}>{c.actif ? "Actif" : "Désactivé"}</span>
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <button onClick={() => basculerActif(c)} style={{
                      background: "none", border: `0.5px solid ${COULEURS.texteClair}55`, borderRadius: 4,
                      padding: "3px 8px", fontSize: 11.5, cursor: "pointer", color: COULEURS.texte,
                    }}>
                      {c.actif ? "Désactiver" : "Réactiver"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
