/**
 * ATELIER D'ÉCRIVAIN — Module 6 : Co-pilote IA
 * Branché sur l'API Claude en temps réel.
 * 4 onglets : Suggestions / Personnages / Références APA / Cohérence
 */

import { useState, useEffect, useRef, useCallback } from "react";

const extraireTexte = (html = "") =>
  html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);

const compterMots = (html = "") =>
  html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;

// ─── Appel API Claude ─────────────────────────────────────────────────────────

const EDGE_FUNCTION_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/claude-prox";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function appelClaude(system, user, signal, maxTokens = 1000) {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  if (data.error) throw new Error(typeof data.error === "object" ? JSON.stringify(data.error) : data.error);
  return data.content?.[0]?.text || "";
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

const PROMPTS = {
  suggestions: (type) => `Tu es co-pilote d'un écrivain professionnel travaillant sur un ${type === "fiction" ? "roman" : "essai ou ouvrage de non-fiction"}. Analyse le texte et génère exactement 3 suggestions concrètes. Réponds UNIQUEMENT en JSON valide :
{"suggestions":[{"type":"suite","titre":"...","texte":"..."},{"type":"approfondissement","titre":"...","texte":"..."},{"type":"reformulation","titre":"...","texte":"..."}]}`,

  personnages: `Tu es assistant littéraire spécialisé en fiction. Extrait les personnages du texte. Réponds UNIQUEMENT en JSON valide :
{"personnages":[{"nom":"...","rôle":"...","traits":["..."],"cohérence":"ok","note":"..."}]}`,

  références: `Tu es assistant de recherche académique. Identifie les concepts qui méritent des références scientifiques ou historiques. Propose des références réelles en format APA 7e. Réponds UNIQUEMENT en JSON valide :
{"références":[{"concept":"...","apa":"...","page":"...","pertinence":"..."}]}`,

  cohérence: (type) => `Tu es éditeur professionnel relisant un ${type === "fiction" ? "roman" : "essai"}. Détecte incohérences, répétitions, transitions manquantes. Réponds UNIQUEMENT en JSON valide :
{"points":[{"type":"incohérence","sévérité":"attention","description":"...","suggestion":"..."}]}`,
};

// ─── Composants d'affichage ───────────────────────────────────────────────────

function CarteSuggestion({ s, couleur }) {
  const icônes = { suite: "→", approfondissement: "↓", reformulation: "↺", structure: "⊞", transition: "⤷" };
  return (
    <div style={{ background: "#fff", border: `0.5px solid ${couleur}30`, borderLeft: `3px solid ${couleur}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: couleur, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{icônes[s.type] || "→"} {s.type}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: "#1a1a1a", marginBottom: 4 }}>{s.titre}</div>
      <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>{s.texte}</div>
    </div>
  );
}

function CartePersonnage({ p }) {
  const c = { ok: "#1D9E75", attention: "#BA7517", problème: "#E24B4A" }[p.cohérence] || "#888";
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{p.nom}</span>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: c + "20", color: c, fontWeight: 500 }}>{p.cohérence}</span>
      </div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{p.rôle}</div>
      {p.traits?.map(t => <span key={t} style={{ display: "inline-block", fontSize: 10, padding: "1px 6px", borderRadius: 20, background: "#f0f0f0", color: "#666", marginRight: 4 }}>{t}</span>)}
      {p.note && <div style={{ fontSize: 11, color: c, marginTop: 4 }}>{p.note}</div>}
    </div>
  );
}

function CarteRéférence({ r }) {
  const [copié, setCopié] = useState(false);
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e5e5", borderLeft: "3px solid #378ADD", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", marginBottom: 4 }}>{r.concept}</div>
      <div style={{ background: "#E6F1FB", borderRadius: 6, padding: "8px 10px", marginBottom: 6, fontSize: 12, color: "#0C447C", fontFamily: "Georgia, serif", lineHeight: 1.6 }}>{r.apa}</div>
      {r.page && <div style={{ fontSize: 11, color: "#185FA5", marginBottom: 4 }}>Page suggérée : {r.page}</div>}
      <div style={{ fontSize: 11, color: "#777", marginBottom: 6 }}>{r.pertinence}</div>
      <button onClick={() => { navigator.clipboard?.writeText(r.apa); setCopié(true); setTimeout(() => setCopié(false), 2000); }}
        style={{ fontSize: 11, color: copié ? "#1D9E75" : "#185FA5", background: copié ? "#E1F5EE" : "#E6F1FB", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>
        {copié ? "✓ Copié !" : "📋 Copier APA"}
      </button>
    </div>
  );
}

function CarteCoherence({ p }) {
  const s = { info: { c: "#378ADD", bg: "#E6F1FB" }, attention: { c: "#BA7517", bg: "#FAEEDA" }, important: { c: "#E24B4A", bg: "#FCEBEB" } }[p.sévérité] || { c: "#888", bg: "#f0f0f0" };
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: s.bg, color: s.c, fontWeight: 500, marginRight: 6 }}>{p.sévérité}</span>
      <span style={{ fontSize: 11, color: "#999" }}>{p.type}</span>
      <div style={{ fontSize: 12, color: "#1a1a1a", margin: "6px 0", lineHeight: 1.6 }}>{p.description}</div>
      {p.suggestion && <div style={{ fontSize: 12, color: "#1D9E75", fontStyle: "italic" }}>💡 {p.suggestion}</div>}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CopiloteIA({ texteActif = "", typeProjet = "non-fiction", couleurProjet = "#7F77DD", projetTitre = "" }) {
  const [onglet, setOnglet] = useState("suggestions");
  const [données, setDonnées] = useState({ suggestions: null, personnages: null, références: null, cohérence: null });
  const [chargement, setChargement] = useState({});
  const [erreur, setErreur] = useState({});
  const [modeAuto, setModeAuto] = useState(false);
  const [dernièreAnalyse, setDernièreAnalyse] = useState(null);
  const abortRef = useRef(null);
  const intervalRef = useRef(null);

  const analyser = useCallback(async (ongletCible) => {
    const texte = extraireTexte(texteActif);
    if (compterMots(texteActif) < 20) {
      setErreur(e => ({ ...e, [ongletCible]: "Écrivez au moins 20 mots pour activer l'analyse." }));
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setChargement(c => ({ ...c, [ongletCible]: true }));
    setErreur(e => ({ ...e, [ongletCible]: null }));

    try {
      let résultat = "";
      const sig = abortRef.current.signal;

      if (ongletCible === "suggestions") {
        résultat = await appelClaude(PROMPTS.suggestions(typeProjet), `Texte :\n\n${texte}`, sig);
        const p = JSON.parse(résultat.replace(/```json|```/g, "").trim());
        setDonnées(d => ({ ...d, suggestions: p.suggestions || [] }));
      } else if (ongletCible === "personnages") {
        résultat = await appelClaude(PROMPTS.personnages, `Texte :\n\n${texte}`, sig);
        const p = JSON.parse(résultat.replace(/```json|```/g, "").trim());
        setDonnées(d => ({ ...d, personnages: p.personnages || [] }));
      } else if (ongletCible === "références") {
        résultat = await appelClaude(PROMPTS.références, `Projet : ${projetTitre}\n\nTexte :\n\n${texte}`, sig, 2000);
        // Répare le JSON potentiellement tronqué
        let jsonStr = résultat.replace(/```json|```/g, "").trim();
        if (!jsonStr.endsWith("}")) jsonStr = jsonStr + ']}';
        try {
          const p = JSON.parse(jsonStr);
          setDonnées(d => ({ ...d, références: p.références || [] }));
        } catch {
          // Essai de récupération partielle
          const match = jsonStr.match(/"références"\s*:\s*\[[\s\S]*\]/);
          if (match) {
            const partial = JSON.parse(`{${match[0]}}`);
            setDonnées(d => ({ ...d, références: partial.références || [] }));
          }
        }
      } else if (ongletCible === "cohérence") {
        résultat = await appelClaude(PROMPTS.cohérence(typeProjet), `Texte :\n\n${texte}`, sig);
        const p = JSON.parse(résultat.replace(/```json|```/g, "").trim());
        setDonnées(d => ({ ...d, cohérence: p.points || [] }));
      }

      setDernièreAnalyse(new Date().toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      if (err.name !== "AbortError") {
        setErreur(e => ({ ...e, [ongletCible]: `Erreur : ${err.message}` }));
      }
    } finally {
      setChargement(c => ({ ...c, [ongletCible]: false }));
    }
  }, [texteActif, typeProjet, projetTitre]);

  useEffect(() => {
    if (modeAuto) {
      analyser(onglet);
      intervalRef.current = setInterval(() => analyser(onglet), 600000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [modeAuto, onglet, analyser]);

  const onglets = [
    { id: "suggestions", label: "Suggestions" },
    { id: "personnages", label: "Personnages" },
    { id: "références", label: "Références" },
    { id: "cohérence", label: "Cohérence" },
  ];

  const données_onglet = données[onglet];
  const enChargement = chargement[onglet];
  const erreurOnglet = erreur[onglet];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#fafafa" }}>

      {/* En-tête */}
      <div style={{ padding: "12px 14px", borderBottom: "0.5px solid #e5e5e5", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>🤖</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#1a1a1a" }}>Co-pilote IA</span>
            {dernièreAnalyse && <span style={{ fontSize: 10, color: "#999" }}>· {dernièreAnalyse}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "#999" }}>Auto</span>
            <div onClick={() => setModeAuto(!modeAuto)}
              style={{ width: 30, height: 16, borderRadius: 8, background: modeAuto ? couleurProjet : "#ddd", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <div style={{ position: "absolute", top: 2, left: modeAuto ? 15 : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex" }}>
          {onglets.map(o => (
            <button key={o.id} onClick={() => setOnglet(o.id)}
              style={{ flex: 1, padding: "6px 2px", border: "none", background: "transparent", fontFamily: "inherit", fontSize: 10, fontWeight: onglet === o.id ? 600 : 400, color: onglet === o.id ? couleurProjet : "#999", borderBottom: onglet === o.id ? `2px solid ${couleurProjet}` : "2px solid transparent", cursor: "pointer" }}>
              {o.label}
              {données[o.id] !== null && <span style={{ marginLeft: 2, opacity: 0.6 }}>({Array.isArray(données[o.id]) ? données[o.id].length : "✓"})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Corps */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
        <button onClick={() => analyser(onglet)} disabled={enChargement}
          style={{ width: "100%", padding: "7px", marginBottom: 10, background: `${couleurProjet}15`, color: couleurProjet, border: `0.5px solid ${couleurProjet}30`, borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: enChargement ? "default" : "pointer", fontFamily: "inherit" }}>
          {enChargement ? "Analyse en cours…" : "↻ Analyser maintenant"}
        </button>

        {enChargement && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#999", fontSize: 12, padding: "8px 0" }}>
            <div style={{ width: 14, height: 14, border: `2px solid ${couleurProjet}30`, borderTopColor: couleurProjet, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            Analyse en cours…
          </div>
        )}

        {erreurOnglet && !enChargement && (
          <div style={{ background: "#FCEBEB", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#A32D2D", marginBottom: 8 }}>
            {erreurOnglet}
          </div>
        )}

        {!enChargement && !erreurOnglet && données_onglet === null && (
          <div style={{ textAlign: "center", padding: "20px 8px", color: "#bbb", fontSize: 12, lineHeight: 1.7 }}>
            {onglet === "suggestions" && "Suggestions contextuelles basées sur votre texte en cours."}
            {onglet === "personnages" && "Extraction et analyse de cohérence des personnages."}
            {onglet === "références" && "Références académiques APA pour étayer votre argumentation."}
            {onglet === "cohérence" && "Détection d'incohérences et faiblesses structurelles."}
          </div>
        )}

        {onglet === "suggestions" && Array.isArray(données_onglet) && données_onglet.map((s, i) => <CarteSuggestion key={i} s={s} couleur={couleurProjet} />)}
        {onglet === "personnages" && Array.isArray(données_onglet) && (données_onglet.length === 0 ? <p style={{ fontSize: 12, color: "#999", textAlign: "center" }}>Aucun personnage détecté.</p> : données_onglet.map((p, i) => <CartePersonnage key={i} p={p} />))}
        {onglet === "références" && Array.isArray(données_onglet) && (données_onglet.length === 0 ? <p style={{ fontSize: 12, color: "#999", textAlign: "center" }}>Aucune référence suggérée.</p> : données_onglet.map((r, i) => <CarteRéférence key={i} r={r} />))}
        {onglet === "cohérence" && Array.isArray(données_onglet) && (données_onglet.length === 0 ? <p style={{ fontSize: 12, color: "#1D9E75", textAlign: "center" }}>✓ Aucun problème détecté.</p> : données_onglet.map((p, i) => <CarteCoherence key={i} p={p} />))}
      </div>
    </div>
  );
}
