/**
 * CURSUS — « Mots en cercle » (05/10/2026), idée de Joseph : 6 ou 7 lettres en cercle, on les relie du doigt pour former
 * des mots qui remplissent la grille (les mots courants) ; tout autre mot valide formé avec les lettres compte en BONUS.
 * Facile = 1re lettre de chaque mot donnée ; indice = une lettre de plus. Moteur : src/lib/motsEnCercle.js ; dessin sur
 * canvas (SlotsCanvas, RoueCanvas : dessin.jsx) pour échapper au mode sombre forcé des navigateurs mobiles.
 */
import { useState, useRef, useEffect } from "react";
import { genererNiveauCercle, jugerMot, donnerIndice, NIVEAUX_CERCLE } from "../../lib/motsEnCercle.js";
import { melangerTab } from "../../lib/jeuxDeMots.js";
import { SlotsCanvas, RoueCanvas } from "./dessin.jsx";
import { carte, bouton, boutonClair, champ, discret, EnTete, lireStats, noterPartie } from "./commun.jsx";

const NOMS = { facile: "Facile (6 lettres, 1re lettre donnée)", moyen: "Moyen (7 lettres)", difficile: "Difficile (7 lettres, plus de mots)" };

export default function MotsEnCercle({ donnees }) {
  const [difficulte, setDifficulte] = useState("facile");
  const [niveau, setNiveau] = useState(null);
  const [lettres, setLettres] = useState([]);
  const [trouves, setTrouves] = useState(() => new Set());
  const [bonus, setBonus] = useState([]);
  const [reveles, setReveles] = useState({});
  const [chemin, setChemin] = useState([]);
  const [message, setMessage] = useState(null); // { texte, ton }
  const [indices, setIndices] = useState(0);
  const [fini, setFini] = useState(false);
  const [stats, setStats] = useState(() => lireStats("cercle"));
  const delai = useRef(null);
  useEffect(() => () => clearTimeout(delai.current), []);

  const dire = (texte, ton) => { setMessage({ texte, ton }); clearTimeout(delai.current); delai.current = setTimeout(() => setMessage(null), 1800); };
  const nouveau = () => {
    const n = genererNiveauCercle(donnees.courants, donnees.ensemble, difficulte);
    if (import.meta.env.DEV) window.__cercle = n; // outil de test (retiré du build de production)
    setNiveau(n); setLettres(n.lettres); setTrouves(new Set()); setBonus([]); setReveles({}); setChemin([]); setMessage(null); setIndices(0); setFini(false);
  };

  const apercu = niveau ? chemin.map((i) => lettres[i]).join("") : "";
  const valider = (c) => {
    if (!niveau || fini) return;
    const mot = c.map((i) => lettres[i]).join("");
    const r = jugerMot(mot, niveau, donnees.ensemble);
    if (r === "court") { if (mot.length > 1) dire("Il faut au moins 3 lettres", "info"); return; }
    if (r === "grille") {
      if (trouves.has(mot)) { dire(`${mot} : déjà trouvé`, "info"); return; }
      const t = new Set(trouves); t.add(mot); setTrouves(t); dire(`✔ ${mot}`, "ok");
      if (niveau.mots.every((m) => t.has(m))) { setFini(true); setStats(noterPartie("cercle", { gagne: true, score: t.size + bonus.length })); }
    } else if (r === "bonus") {
      if (bonus.includes(mot)) { dire(`${mot} : déjà trouvé`, "info"); return; }
      setBonus([...bonus, mot]); dire(`⭐ Bonus : ${mot}`, "ok");
    } else dire(`${mot} : pas dans la liste`, "non");
  };
  const indice = () => { if (niveau && !fini) { setReveles(donnerIndice(niveau, trouves, reveles)); setIndices((x) => x + 1); } };
  const abandonner = () => { if (window.confirm("Afficher tous les mots et abandonner ce niveau ?")) { setTrouves(new Set(niveau.mots)); setFini(true); setStats(noterPartie("cercle", { gagne: false })); } };

  return (
    <div>
      {!niveau && <EnTete titre="Mots en cercle" sous="Pose le doigt sur une lettre et glisse de lettre en lettre ; relâche pour valider le mot. Remplis la grille, et cherche aussi des mots bonus !" />}
      {!niveau ? (
        <div style={carte}>
          <label style={{ fontSize: 13 }}>Niveau{" "}
            <select value={difficulte} onChange={(e) => setDifficulte(e.target.value)} style={champ}>
              {Object.keys(NIVEAUX_CERCLE).map((k) => <option key={k} value={k}>{NOMS[k]}</option>)}
            </select>
          </label>{" "}
          <button style={bouton()} onClick={nouveau}>▶ Jouer</button>
          <div style={{ ...discret, marginTop: 8 }}>{stats.gagnees} niveau{stats.gagnees > 1 ? "x" : ""} terminé{stats.gagnees > 1 ? "s" : ""} sur {stats.jouees} joué{stats.jouees > 1 ? "s" : ""}</div>
        </div>
      ) : (
        <div style={{ maxWidth: 520 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            <span>{trouves.size} / {niveau.mots.length} mots</span><span>⭐ {bonus.length} bonus</span>
          </div>
          <SlotsCanvas mots={niveau.mots} trouves={trouves} reveles={reveles} premiere={niveau.premiere} />
          <div style={{ height: 4 }} />
          {fini ? (
            <div style={carte}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{trouves.size === niveau.mots.length && !Object.keys(reveles).length && indices === 0 ? "🎉 Niveau terminé, sans indice !" : "Niveau terminé"}</div>
              <div style={{ ...discret, marginBottom: 8 }}>Le mot de départ était <b>{niveau.base}</b>. {bonus.length ? `${bonus.length} mot${bonus.length > 1 ? "s" : ""} bonus : ${bonus.join(", ")}.` : "Aucun mot bonus trouvé."}</div>
              <button style={bouton()} onClick={nouveau}>Niveau suivant</button>{" "}
              <button style={boutonClair()} onClick={() => setNiveau(null)}>Changer de niveau</button>
            </div>
          ) : (
            <>
              <RoueCanvas lettres={lettres} chemin={chemin} apercu={apercu} message={message} onChemin={setChemin} onValider={valider} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 10 }}>
                <button style={{ ...boutonClair(), padding: "7px 9px" }} onClick={() => setLettres(melangerTab(lettres))}>🔀 Mélanger</button>
                <button style={{ ...boutonClair(), padding: "7px 9px" }} onClick={indice}>💡 Indice</button>
                <button style={{ ...boutonClair(), padding: "7px 9px" }} onClick={abandonner}>Solution</button>
                <button style={{ ...boutonClair(), padding: "7px 9px" }} onClick={nouveau}>Autre niveau</button>
              </div>
            </>
          )}
          {bonus.length > 0 && !fini && <div style={{ ...discret, textAlign: "center", marginTop: 8 }}>Bonus : {bonus.join(", ")}</div>}
        </div>
      )}
    </div>
  );
}
