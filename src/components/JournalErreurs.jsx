/**
 * CURSUS — Journal des erreurs (01/10/2026)
 * ======================================================================
 * Écran réservé au propriétaire du logiciel : liste des erreurs
 * techniques journalisées par journaliserErreur() (src/lib/journalErreurs.js
 * — table `journal_erreurs`), écrite depuis plusieurs endroits de l'app
 * (CopiloteIA, Editeur, ImportDocx...) depuis le 15/07/2026, mais jamais
 * affichée nulle part jusqu'ici — gap trouvé en diagnostiquant un "le
 * co-pilote n'a pas pu traiter ce passage" récurrent et resté sans piste
 * faute de pouvoir le voir. Même principe que Supervision.jsx : aucune
 * écriture ni lecture directe vers Supabase, tout passe par
 * admin-journal-erreurs qui revérifie lui-même l'email de l'appelant.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

const COULEURS = {
  bordeaux: "#8B2635",
  or: "#C4973A",
  fond: "#F7F4EF",
  texte: "#2C1810",
  texteClair: "#6B5D52",
};

export default function JournalErreurs() {
  const [lignes, setLignes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [recherche, setRecherche] = useState("");

  const rafraîchir = useCallback(async () => {
    setChargement(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-journal-erreurs", {
        body: { limite: 300 },
      });
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
      setLignes(data?.lignes || []);
      setErreur("");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { rafraîchir(); }, [rafraîchir]);

  const lignesFiltrées = recherche.trim()
    ? lignes.filter((l) => {
        const q = recherche.toLowerCase();
        return l.contexte?.toLowerCase().includes(q)
          || l.message?.toLowerCase().includes(q)
          || l.email?.toLowerCase().includes(q);
      })
    : lignes;

  return (
    <div style={{ padding: "28px 32px", flex: 1, overflowY: "auto", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: COULEURS.texte, margin: 0 }}>Journal des erreurs</h1>
        <button onClick={rafraîchir} disabled={chargement} style={{
          fontSize: 12, color: COULEURS.bordeaux, background: "none",
          border: `0.5px solid ${COULEURS.bordeaux}50`, borderRadius: 6,
          padding: "4px 10px", cursor: chargement ? "default" : "pointer", fontFamily: "inherit",
        }}>
          ↻ Rafraîchir
        </button>
      </div>

      <p style={{ fontSize: 12.5, color: COULEURS.texteClair, marginBottom: 16 }}>
        Erreurs techniques journalisées automatiquement par l'application (300 plus récentes) —
        échecs d'analyse IA, imports, etc. Pas une messagerie : ces lignes ne préviennent de rien
        toutes seules, à consulter quand un problème a été signalé.
      </p>

      <input
        type="text"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="Filtrer par contexte, message ou e-mail…"
        style={{
          width: "100%", maxWidth: 420, padding: "7px 10px", marginBottom: 16,
          border: "0.5px solid #ddd", borderRadius: 7, fontSize: 13, fontFamily: "inherit",
          boxSizing: "border-box",
        }}
      />

      {erreur && (
        <div style={{ background: "#FBE9E9", color: "#A32D2D", padding: "10px 14px", borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
          {erreur}
        </div>
      )}

      {chargement ? (
        <div style={{ fontSize: 13, color: COULEURS.texteClair }}>Chargement…</div>
      ) : lignesFiltrées.length === 0 ? (
        <div style={{ fontSize: 13, color: COULEURS.texteClair }}>
          {lignes.length === 0 ? "Aucune erreur journalisée." : "Aucune ligne ne correspond au filtre."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lignesFiltrées.map((l) => (
            <div key={l.id} style={{
              border: "0.5px solid #e5e5e5", borderRadius: 8, padding: "10px 14px",
              background: "#fff",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: COULEURS.bordeaux }}>{l.contexte}</span>
                <span style={{ fontSize: 11, color: "#999" }}>
                  {new Date(l.created_at).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "medium" })}
                  {l.email ? ` · ${l.email}` : ""}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: "#333", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "ui-monospace, monospace" }}>
                {l.message}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
