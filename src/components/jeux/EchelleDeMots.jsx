/**
 * CURSUS — Échelle de mots (30/09/2026, jeu imaginé pour le catalogue) : passer d'un mot à un
 * autre en ne changeant qu'UNE lettre à chaque étape, chaque étape étant un vrai mot.
 * Ex. : FUME → FUIE → FUIS → GUIS → GRIS → GRAS. Le but : arriver en un minimum d'étapes ;
 * le moteur connaît le plus court chemin (« par ») grâce à une recherche en largeur sur tout
 * le dictionnaire. Les accents sont ignorés. Moteur : problemeEchelle() / plusCourtChemin()
 * dans src/lib/jeuxDeMots.js.
 */
import { useState } from "react";
import { problemeEchelle, plusCourtChemin, unSeulChangement, norm } from "../../lib/jeuxDeMots.js";
import { carte, bouton, boutonClair, champ, discret, EnTete, lireStats, noterPartie } from "./commun.jsx";

export default function EchelleDeMots({ donnees }) {
  const [longueur, setLongueur] = useState(4);
  const [pb, setPb] = useState(null); // { depart, arrivee, optimal, affiche, index }
  const [chaine, setChaine] = useState([]);
  const [saisie, setSaisie] = useState("");
  const [message, setMessage] = useState("");
  const [fini, setFini] = useState(null); // null | "gagne" | "abandon"
  const [indices, setIndices] = useState(0);
  const [stats, setStats] = useState(() => lireStats("echelle"));

  const nouveau = () => {
    const p = problemeEchelle(donnees.courants, donnees.ensemble, longueur);
    if (!p) { setMessage("Impossible de fabriquer une échelle, réessaie."); return; }
    setPb(p); setChaine([p.depart]); setSaisie(""); setMessage(""); setFini(null); setIndices(0);
  };
  const par = pb ? pb.optimal.length - 1 : 0;
  const etapes = chaine.length - 1;

  const proposer = () => {
    const m = norm(saisie).replace(/[^A-Z]/g, "");
    setSaisie("");
    if (!m) return;
    const dernier = chaine[chaine.length - 1];
    if (m.length !== pb.depart.length) return setMessage(`Le mot doit faire ${pb.depart.length} lettres.`);
    if (chaine.includes(m)) return setMessage(`${m} : déjà utilisé.`);
    if (!unSeulChangement(dernier, m)) return setMessage(`${m} : il faut changer exactement UNE lettre de ${dernier}.`);
    if (!donnees.ensemble.has(m)) return setMessage(`${m} n'est pas dans le dictionnaire.`);
    const nouvelle = [...chaine, m];
    setChaine(nouvelle); setMessage("");
    if (m === pb.arrivee) { setFini("gagne"); setStats(noterPartie("echelle", { gagne: true, score: Math.max(0, 10 - (nouvelle.length - 1 - par)) })); }
  };
  const annuler = () => { if (chaine.length > 1 && !fini) { setChaine(chaine.slice(0, -1)); setMessage(""); } };
  const indice = () => {
    const ch = plusCourtChemin(pb.index, chaine[chaine.length - 1], pb.arrivee);
    setIndices(indices + 1);
    setMessage(ch && ch.length > 1 ? `Indice : essaie « ${ch[1]} ».` : "Tu es dans une impasse : reviens en arrière.");
  };
  const abandonner = () => { setFini("abandon"); setStats(noterPartie("echelle", { gagne: false })); };

  return (
    <div>
      <EnTete titre="Échelle de mots" sous="Passe du premier mot au dernier en changeant UNE lettre à chaque étape. Chaque étape doit être un vrai mot. Les accents sont ignorés." />
      {!pb ? (
        <div style={carte}>
          <label style={{ fontSize: 13 }}>Longueur{" "}
            <select value={longueur} onChange={(e) => setLongueur(Number(e.target.value))} style={champ}>
              <option value={4}>4 lettres</option><option value={5}>5 lettres</option>
            </select>
          </label>{" "}
          <button style={bouton()} onClick={nouveau}>▶ Jouer</button>
          <div style={{ ...discret, marginTop: 8 }}>{stats.jouees} échelle{stats.jouees > 1 ? "s" : ""} · {stats.gagnees} réussie{stats.gagnees > 1 ? "s" : ""}</div>
        </div>
      ) : (
        <div style={{ maxWidth: 420 }}>
          <div style={{ ...discret, marginBottom: 8 }}>Le plus court chemin fait <b>{par} étapes</b> (« par »). Tu en es à {etapes}.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start", marginBottom: 10 }}>
            {chaine.map((m, i) => (
              <div key={m} style={{ display: "flex", gap: 3, alignItems: "center" }}>
                {[...m].map((l, k) => (
                  <div key={k} style={{ width: 36, height: 36, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, background: i > 0 && chaine[i - 1][k] !== l ? "#1D9E75" : "#f2b93b", color: i > 0 && chaine[i - 1][k] !== l ? "#fff" : "#111" }}>{l}</div>
                ))}
                {i === 0 && <span style={discret}>départ</span>}
              </div>
            ))}
            {!fini && <div style={{ display: "flex", gap: 3, alignItems: "center", opacity: 0.6 }}>{[...pb.arrivee].map((l, k) => <div key={k} style={{ width: 36, height: 36, borderRadius: 6, border: "2px dashed #b98a1a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 }}>{l}</div>)}<span style={discret}>arrivée</span></div>}
          </div>
          {!fini && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input value={saisie} onChange={(e) => setSaisie(e.target.value)} onKeyDown={(e) => e.key === "Enter" && proposer()} placeholder="Prochain mot" maxLength={pb.depart.length + 2} style={{ ...champ, flex: 1, fontSize: 16, letterSpacing: 2 }} />
                <button style={bouton()} onClick={proposer}>OK</button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={boutonClair(chaine.length > 1)} disabled={chaine.length < 2} onClick={annuler}>↩ Annuler</button>
                <button style={boutonClair()} onClick={indice}>💡 Indice</button>
                <button style={boutonClair()} onClick={abandonner}>Abandonner</button>
              </div>
            </>
          )}
          {message && <div style={{ marginTop: 8, fontSize: 13, color: message.startsWith("Indice") ? "#1D9E75" : "#c0392b" }}>{message}</div>}
          {fini && (
            <div style={{ ...carte, marginTop: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                {fini === "gagne" ? (etapes === par ? "🎉 Parfait : chemin le plus court !" : `🎉 Arrivé en ${etapes} étapes (le meilleur : ${par}).`) : "Voici le plus court chemin :"}
              </div>
              <div style={{ fontSize: 14, marginBottom: 8 }}>{pb.optimal.join(" → ")}</div>
              <button style={bouton()} onClick={nouveau}>Une autre échelle</button>{" "}
              <button style={boutonClair()} onClick={() => setPb(null)}>Changer la longueur</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
