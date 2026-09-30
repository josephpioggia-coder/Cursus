/**
 * CURSUS — Pendu (30/09/2026) : deviner un mot courant lettre par lettre, 7 erreurs permises.
 * Les accents sont révélés avec leur lettre de base (trouver E dévoile é, è, ê…).
 * Moteur : reveler() / motPourPendu() dans src/lib/jeuxDeMots.js.
 */
import { useState, useCallback } from "react";
import { norm, reveler, gagnePendu, motPourPendu, ERREURS_PENDU } from "../../lib/jeuxDeMots.js";
import { carte, bouton, discret, ClavierAzerty, useClavier, EnTete, lireStats, noterPartie, lienDefinition } from "./commun.jsx";

function Potence({ erreurs }) {
  const t = { stroke: "var(--color-text-primary)", strokeWidth: 4, fill: "none", strokeLinecap: "round" };
  return (
    <svg viewBox="0 0 140 160" width="150" height="170" aria-label={`${erreurs} erreur${erreurs > 1 ? "s" : ""} sur ${ERREURS_PENDU}`}>
      <path d="M10 150 H90 M30 150 V15 H100 V32" {...t} />
      {erreurs >= 1 && <circle cx="100" cy="46" r="14" {...t} />}
      {erreurs >= 2 && <path d="M100 60 V105" {...t} />}
      {erreurs >= 3 && <path d="M100 70 L80 92" {...t} />}
      {erreurs >= 4 && <path d="M100 70 L120 92" {...t} />}
      {erreurs >= 5 && <path d="M100 105 L84 130" {...t} />}
      {erreurs >= 6 && <path d="M100 105 L116 130" {...t} />}
      {erreurs >= 7 && <path d="M94 42 l4 4 m0 -4 l-4 4 M102 42 l4 4 m0 -4 l-4 4" {...t} strokeWidth={2.5} />}
    </svg>
  );
}

export default function Pendu({ donnees }) {
  const [p, setP] = useState(null);
  const [stats, setStats] = useState(() => lireStats("pendu"));

  const nouvelle = useCallback(() => setP({ mot: motPourPendu(donnees.courants), trouvees: new Set(), ratees: new Set(), statut: "jeu" }), [donnees]);
  const lettre = (l) => setP((q) => {
    if (!q || q.statut !== "jeu" || q.trouvees.has(l) || q.ratees.has(l)) return q;
    const dansMot = [...q.mot].some((c) => norm(c) === l);
    const trouvees = new Set(q.trouvees), ratees = new Set(q.ratees);
    (dansMot ? trouvees : ratees).add(l);
    const gagne = gagnePendu(q.mot, trouvees);
    const perdu = ratees.size >= ERREURS_PENDU;
    if (gagne || perdu) setTimeout(() => setStats(noterPartie("pendu", { gagne })), 0);
    return { ...q, trouvees, ratees, statut: gagne ? "gagne" : perdu ? "perdu" : "jeu" };
  });
  useClavier(!!p && p.statut === "jeu", { onLettre: lettre });

  const etats = {};
  p?.trouvees.forEach((l) => { etats[l] = "juste"; });
  p?.ratees.forEach((l) => { etats[l] = "absent"; });
  const deja = new Set([...(p?.trouvees || []), ...(p?.ratees || [])]);

  return (
    <div>
      <EnTete titre="Pendu" sous={`Devine le mot lettre par lettre : ${ERREURS_PENDU} erreurs et c'est perdu. Les accents se révèlent avec leur lettre (E dévoile é, è, ê…).`} />
      {!p ? (
        <div style={carte}>
          <button style={bouton()} onClick={nouvelle}>▶ Jouer</button>
          <div style={{ ...discret, marginTop: 8 }}>{stats.jouees} partie{stats.jouees > 1 ? "s" : ""} · {stats.gagnees} gagnée{stats.gagnees > 1 ? "s" : ""} · série {stats.serie} (record {stats.meilleureSerie})</div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <Potence erreurs={p.ratees.size} />
            <div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: 8 }}>
                {(p.statut === "jeu" ? reveler(p.mot, p.trouvees) : [...p.mot]).map((c, i) => (
                  <div key={i} style={{ width: 30, height: 40, borderBottom: "3px solid var(--color-text-primary)", textAlign: "center", fontSize: 26, fontWeight: 700, color: p.statut === "perdu" && !p.trouvees.has(norm(c)) ? "#c0392b" : "var(--color-text-primary)" }}>{c ? c.toUpperCase() : ""}</div>
                ))}
              </div>
              <div style={{ ...discret, textAlign: "center" }}>{p.ratees.size} erreur{p.ratees.size > 1 ? "s" : ""} sur {ERREURS_PENDU}{p.ratees.size ? ` : ${[...p.ratees].join(" ")}` : ""}</div>
            </div>
          </div>
          {p.statut === "jeu" ? <ClavierAzerty onLettre={lettre} etats={etats} desactivees={deja} /> : (
            <div style={{ ...carte, textAlign: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{p.statut === "gagne" ? "🎉 Bravo, tu l'as sauvé !" : "Pendu…"}</div>
              <div style={{ fontSize: 14, marginBottom: 8 }}>Le mot était <b>{p.mot.toUpperCase()}</b> — <a href={lienDefinition(p.mot)} target="_blank" rel="noopener noreferrer" style={{ color: "#1D9E75" }}>définition ↗</a></div>
              <button style={bouton()} onClick={nouvelle}>Rejouer</button>
              <div style={{ ...discret, marginTop: 8 }}>{stats.jouees} parties · {stats.gagnees} gagnées · série {stats.serie} (record {stats.meilleureSerie})</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
