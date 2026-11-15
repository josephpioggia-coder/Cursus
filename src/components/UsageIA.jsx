/**
 * CURSUS — Usage IA mesuré (15/11/2026)
 * Écran réservé au propriétaire : consommation RÉELLE de tokens par modèle,
 * lue dans usage_ia (comptes visibles par la RLS : le sien, au minimum).
 * Sert à calculer le coût réel d'une analyse et la marge par formule.
 * Aucun tarif n'est figé ici : le coût se calcule à part, sur ces moyennes.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

const C = { bordeaux: "#8B2635", fond: "#F7F4EF", texte: "#2C1810", clair: "#6B5D52" };

function quantile(tri, q) {
  if (!tri.length) return 0;
  const i = (tri.length - 1) * q, b = Math.floor(i), r = i - b;
  return tri[b + 1] !== undefined ? tri[b] + r * (tri[b + 1] - tri[b]) : tri[b];
}

export default function UsageIA() {
  const [jours, setJours] = useState(60);
  const [etat, setEtat] = useState({ chargement: true, erreur: null, lignes: [] });

  const charger = useCallback(async () => {
    setEtat((e) => ({ ...e, chargement: true, erreur: null }));
    const depuis = new Date(Date.now() - jours * 86400000).toISOString();
    const tout = [];
    for (let p = 0; p < 20; p++) {
      const { data, error } = await supabase
        .from("usage_ia")
        .select("modele, tokens_entree, tokens_sortie, cache_read_tokens, created_at")
        .gte("created_at", depuis)
        .order("created_at", { ascending: false })
        .range(p * 1000, p * 1000 + 999);
      if (error) { setEtat({ chargement: false, erreur: error.message, lignes: [] }); return; }
      tout.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    setEtat({ chargement: false, erreur: null, lignes: tout });
  }, [jours]);

  useEffect(() => { charger(); }, [charger]);

  const groupes = {};
  etat.lignes.forEach((l) => { (groupes[l.modele || "(inconnu)"] ||= []).push(l); });
  const rows = Object.entries(groupes).map(([modele, ls]) => {
    const tot = ls.map((l) => (l.tokens_entree || 0) + (l.tokens_sortie || 0)).sort((a, b) => a - b);
    const moy = (f) => Math.round(ls.reduce((s, l) => s + (l[f] || 0), 0) / ls.length);
    return {
      modele, appels: ls.length, entree: moy("tokens_entree"), sortie: moy("tokens_sortie"),
      cache: moy("cache_read_tokens"), mediane: Math.round(quantile(tot, 0.5)), p90: Math.round(quantile(tot, 0.9)),
      du: ls[ls.length - 1].created_at?.slice(0, 10), au: ls[0].created_at?.slice(0, 10),
    };
  }).sort((a, b) => b.appels - a.appels);

  const texte = ["modele\tappels\tentree_moy\tsortie_moy\tcache_lu_moy\ttotal_median\ttotal_p90\tdu\tau",
    ...rows.map((r) => [r.modele, r.appels, r.entree, r.sortie, r.cache, r.mediane, r.p90, r.du, r.au].join("\t"))].join("\n");

  const th = { textAlign: "left", padding: "6px 8px", fontSize: 12, color: C.clair, borderBottom: "1px solid #ddd" };
  const td = { padding: "6px 8px", fontSize: 13, color: C.texte, borderBottom: "1px solid #eee" };

  return (
    <div style={{ padding: "24px 20px", flex: 1, overflowY: "auto", minWidth: 0 }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, color: C.texte, margin: 0 }}>Usage IA mesuré</h1>
      <p style={{ fontSize: 13, color: C.clair, margin: "6px 0 14px" }}>
        Tokens réellement consommés par appel, par modèle (lignes que la base te laisse lire). À servir au calcul du coût réel d'une analyse.
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        {[30, 60, 180].map((j) => (
          <button key={j} onClick={() => setJours(j)} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${C.bordeaux}`, background: jours === j ? C.bordeaux : "#fff", color: jours === j ? "#fff" : C.bordeaux, cursor: "pointer" }}>{j} jours</button>
        ))}
        <button onClick={() => navigator.clipboard?.writeText(texte)} disabled={!rows.length} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #bbb", background: "#fff", color: C.texte, cursor: "pointer" }}>📋 Copier le tableau</button>
      </div>
      {etat.chargement && <p style={{ color: C.clair }}>Chargement…</p>}
      {etat.erreur && <p style={{ color: "#a00" }}>Lecture impossible : {etat.erreur}</p>}
      {!etat.chargement && !etat.erreur && !rows.length && <p style={{ color: C.clair }}>Aucune ligne sur cette période.</p>}
      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", minWidth: 560 }}>
            <thead><tr>{["Modèle", "Appels", "Entrée moy.", "Sortie moy.", "Cache lu moy.", "Total médian", "Total p90", "Période"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.modele}><td style={td}>{r.modele}</td><td style={td}>{r.appels}</td><td style={td}>{r.entree}</td><td style={td}>{r.sortie}</td><td style={td}>{r.cache}</td><td style={td}>{r.mediane}</td><td style={td}>{r.p90}</td><td style={td}>{r.du} → {r.au}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
