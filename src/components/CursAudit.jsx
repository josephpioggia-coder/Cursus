/**
 * CURSAUDIT — Création d'un audit (référence 60816-01, suite, 16/08/2026)
 * ======================================================================
 * Première interface réelle pour CursAudit : coller un texte, choisir la
 * profondeur/mode/rapport, voir le prix calculé, créer l'audit.
 *
 * CE QUE CETTE PAGE NE FAIT PAS ENCORE (limites assumées) :
 *  - Pas d'import de fichier .docx/.pdf — texte collé uniquement.
 *  - Pas de paiement : l'audit créé reste au statut "brouillon". Aucun
 *    flux Stripe pour CursAudit n'existe encore (voir
 *    docs/cursaudit-tarification.md) — lancer l'analyse réelle nécessite
 *    encore de repasser le statut à "paye" manuellement (SQL), comme pour
 *    les tests de analyser-unite-cursaudit / orchestrer-audit-cursaudit.
 *  - Pas de remise abonné CursEdit dans le prix affiché (nécessite de
 *    connaître l'abonnement actif de l'auteur·e — hors périmètre ici).
 *  - Modes IA limités à "1 IA" et "2 IA", les deux seuls implémentés côté
 *    moteur — "confrontation ciblée"/"arbitrage dialogique" ne sont pas
 *    proposés plutôt que promis puis refusés à l'exécution.
 *  - Palier "Libre" (dimensions au choix) non proposé — seulement les
 *    trois paliers fixes.
 */

import { useState, useEffect, useMemo } from "react";
import { auditsAPI } from "../lib/api.js";
import { segmenterTexte } from "../lib/segmenterCursAudit.js";
import { calculerPrixCursAudit } from "../lib/tarifCursAudit.js";

const PALIERS = [
  { id: "essentiel", nom: "Essentiel", dimensions: 8, description: "Lecture exhaustive, coût minimal." },
  { id: "approfondi", nom: "Approfondi", dimensions: 15, description: "Analyse plus éditoriale." },
  { id: "expert", nom: "Expert", dimensions: 30, description: "Profondeur maximale." },
];

const MODES_IA = [
  { id: "1 IA", nom: "1 IA", description: "Une IA analyse toutes les unités." },
  { id: "2 IA", nom: "2 IA", description: "Une deuxième IA relit et contrôle la première." },
];

const TYPES_RAPPORT = [
  { id: "Aucun", nom: "Aucun" },
  { id: "Synthèse courte", nom: "Synthèse courte" },
  { id: "Rapport complet", nom: "Rapport complet" },
];

export default function CursAudit() {
  const [titre, setTitre] = useState("");
  const [texte, setTexte] = useState("");
  const [palier, setPalier] = useState("essentiel");
  const [modeIA, setModeIA] = useState("1 IA");
  const [typeRapport, setTypeRapport] = useState("Aucun");
  const [reglesPrix, setReglesPrix] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [résultat, setRésultat] = useState(null);

  useEffect(() => {
    auditsAPI.récupérerReglesPrix().then(({ data, error }) => {
      if (!error) setReglesPrix(data || []);
    });
  }, []);

  const unités = useMemo(() => segmenterTexte(texte), [texte]);

  const prix = useMemo(() => {
    if (!reglesPrix || unités.length === 0) return null;
    return calculerPrixCursAudit(reglesPrix, { palier, modeIA, typeRapport, nombreUnites: unités.length });
  }, [reglesPrix, palier, modeIA, typeRapport, unités.length]);

  const créer = async () => {
    if (!titre.trim() || unités.length === 0 || !prix) return;
    setEnCours(true);
    setErreur(null);
    setRésultat(null);

    const palierChoisi = PALIERS.find((p) => p.id === palier);
    const nombrePagesEstimé = Math.max(1, Math.round(unités.length / 8.5));

    const { data, error } = await auditsAPI.créerDepuisTexte({
      titre: titre.trim(),
      texte,
      palierDimensions: palier,
      nombreDimensions: palierChoisi.dimensions,
      modeIA,
      typeRapport,
      nombrePages: nombrePagesEstimé,
      prixTTC: prix.prixTTC,
    });

    setEnCours(false);
    if (error) { setErreur(error.message || "Erreur lors de la création de l'audit."); return; }
    setRésultat(data);
  };

  return (
    <div style={{ padding: "28px 32px", flex: 1, overflowY: "auto", maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--texte-primaire)", marginBottom: 4 }}>CursAudit</h1>
      <p style={{ fontSize: 13, color: "var(--texte-tertiaire)", marginBottom: 24 }}>
        Créer un nouvel audit — collez un texte, choisissez la profondeur d'analyse.
      </p>

      {résultat ? (
        <div style={{ background: "#EAF3DE", border: "0.5px solid #1D9E75", borderRadius: 10, padding: "18px 20px" }}>
          <div style={{ fontWeight: 600, color: "#1D9E75", marginBottom: 6 }}>Audit créé</div>
          <div style={{ fontSize: 13, color: "var(--texte-secondaire)", lineHeight: 1.7 }}>
            « {titre} » — {résultat.nombreUnités} unité{résultat.nombreUnités > 1 ? "s" : ""} créée{résultat.nombreUnités > 1 ? "s" : ""}, statut « brouillon ».
            <br />
            Le paiement CursAudit n'est pas encore disponible dans l'application — l'analyse ne peut pas encore être lancée depuis cette page.
          </div>
          <button
            onClick={() => { setRésultat(null); setTitre(""); setTexte(""); }}
            style={{ marginTop: 12, padding: "7px 14px", borderRadius: 7, border: "0.5px solid #1D9E75", background: "transparent", color: "#1D9E75", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
          >
            Créer un autre audit
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--texte-secondaire)", marginBottom: 5 }}>Titre</label>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Titre de l'audit"
              style={{ width: "100%", padding: "9px 12px", border: "0.5px solid var(--border)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--texte-secondaire)", marginBottom: 5 }}>Texte à auditer</label>
            <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={10} placeholder="Collez le texte ici…"
              style={{ width: "100%", padding: "9px 12px", border: "0.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
            <div style={{ fontSize: 11, color: "var(--texte-tertiaire)", marginTop: 4 }}>{unités.length} unité{unités.length > 1 ? "s" : ""} détectée{unités.length > 1 ? "s" : ""}</div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--texte-secondaire)", marginBottom: 5 }}>Palier de profondeur</label>
            <div style={{ display: "flex", gap: 8 }}>
              {PALIERS.map((p) => (
                <button key={p.id} onClick={() => setPalier(p.id)}
                  style={{
                    flex: 1, padding: "10px 8px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    border: palier === p.id ? "1.5px solid #7F77DD" : "0.5px solid var(--border)",
                    background: palier === p.id ? "#7F77DD10" : "transparent",
                  }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: palier === p.id ? "#7F77DD" : "var(--texte-primaire)" }}>{p.nom} ({p.dimensions})</div>
                  <div style={{ fontSize: 10.5, color: "var(--texte-tertiaire)", marginTop: 2 }}>{p.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--texte-secondaire)", marginBottom: 5 }}>Mode IA</label>
            <div style={{ display: "flex", gap: 8 }}>
              {MODES_IA.map((m) => (
                <button key={m.id} onClick={() => setModeIA(m.id)}
                  style={{
                    flex: 1, padding: "10px 8px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    border: modeIA === m.id ? "1.5px solid #7F77DD" : "0.5px solid var(--border)",
                    background: modeIA === m.id ? "#7F77DD10" : "transparent",
                  }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: modeIA === m.id ? "#7F77DD" : "var(--texte-primaire)" }}>{m.nom}</div>
                  <div style={{ fontSize: 10.5, color: "var(--texte-tertiaire)", marginTop: 2 }}>{m.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--texte-secondaire)", marginBottom: 5 }}>Format de rapport</label>
            <select value={typeRapport} onChange={(e) => setTypeRapport(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", border: "0.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }}>
              {TYPES_RAPPORT.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
            </select>
          </div>

          {prix && (
            <div style={{ background: "var(--surface, #fff)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 12, color: "var(--texte-tertiaire)" }}>Prix estimé (hors remise abonné)</span>
              <span style={{ fontSize: 18, fontWeight: 600, color: "var(--texte-primaire)" }}>{prix.prixTTC.toFixed(2).replace(".", ",")} € <span style={{ fontSize: 11, fontWeight: 400, color: "var(--texte-tertiaire)" }}>TTC</span></span>
            </div>
          )}

          {erreur && (
            <div style={{ background: "#FCEBEB", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#A32D2D" }}>{erreur}</div>
          )}

          <button
            onClick={créer}
            disabled={enCours || !titre.trim() || unités.length === 0 || !prix}
            style={{
              padding: "10px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              background: (enCours || !titre.trim() || unités.length === 0 || !prix) ? "#ccc" : "#7F77DD",
              color: "#fff", cursor: (enCours || !titre.trim() || unités.length === 0 || !prix) ? "default" : "pointer",
            }}
          >
            {enCours ? "Création…" : "Créer l'audit (brouillon)"}
          </button>
        </div>
      )}
    </div>
  );
}
