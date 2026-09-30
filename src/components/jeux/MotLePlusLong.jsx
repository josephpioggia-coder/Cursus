/**
 * CURSUS — Le mot le plus long (30/09/2026) : 10 lettres tirées, une minute pour trouver le
 * plus long mot possible (chaque lettre une seule fois). Le tirage contient toujours au
 * moins un mot courant de 7 à 9 lettres. Score = longueur du meilleur mot proposé. À la
 * fin : les meilleurs mots possibles. Moteur : tirageMotLePlusLong() (src/lib/jeuxDeMots.js)
 * et rechercher() (src/lib/scrabbleMots.js).
 */
import { useState, useRef } from "react";
import { tirageMotLePlusLong, motFormable } from "../../lib/jeuxDeMots.js";
import { rechercher } from "../../lib/scrabbleMots.js";
import { carte, bouton, boutonClair, discret, EnTete, useCompteARebours, formatTemps, useClavier, lireStats, noterPartie } from "./commun.jsx";

const DUREE = 60;

export default function MotLePlusLong({ donnees }) {
  const [t, setT] = useState(null); // { lettres, garanti }
  const [enCours, setEnCours] = useState(false);
  const [compo, setCompo] = useState([]); // indices des tuiles utilisées, dans l'ordre
  const [essais, setEssais] = useState([]); // mots acceptés
  const [message, setMessage] = useState("");
  const [meilleurs, setMeilleurs] = useState([]);
  const [stats, setStats] = useState(() => lireStats("longmot"));
  const essaisRef = useRef([]);
  essaisRef.current = essais;

  const mot = t ? compo.map((i) => t.lettres[i]).join("") : "";
  const meilleur = essais.reduce((m, x) => (x.length > m.length ? x : m), "");
  const reste = useCompteARebours(enCours, DUREE, () => {
    setEnCours(false); setCompo([]);
    const b = essaisRef.current.reduce((m, x) => Math.max(m, x.length), 0);
    setStats(noterPartie("longmot", { gagne: b >= 6, score: b }));
  });

  const commencer = () => {
    const tirage = tirageMotLePlusLong(donnees.courants);
    setT(tirage); setEssais([]); setCompo([]); setMessage(""); setEnCours(true);
    setMeilleurs(rechercher(donnees.mots, { mode: "long", lettres: tirage.lettres.join(""), tri: "longueur", limite: 8 }).liste.map((x) => x.mot));
  };
  const ajouter = (i) => { if (enCours && !compo.includes(i)) { setCompo([...compo, i]); setMessage(""); } };
  const ajouterLettre = (l) => { if (!enCours) return; const i = t.lettres.findIndex((x, k) => x === l && !compo.includes(k)); if (i >= 0) ajouter(i); };
  const retirer = () => setCompo(compo.slice(0, -1));
  const valider = () => {
    if (!enCours) return;
    if (mot.length < 2) return;
    if (essais.includes(mot)) setMessage(`${mot} : déjà proposé.`);
    else if (!motFormable(mot, t.lettres)) setMessage("Ces lettres ne sont pas dans le tirage.");
    else if (!donnees.ensemble.has(mot)) setMessage(`${mot} n'est pas dans le dictionnaire.`);
    else { setEssais([...essais, mot]); setMessage(`✔ ${mot} (${mot.length} lettres)`); setCompo([]); return; }
    setCompo([]);
  };
  useClavier(enCours, { onLettre: ajouterLettre, onEntree: valider, onEffacer: retirer });

  return (
    <div>
      <EnTete titre="Le mot le plus long" sous="Dix lettres, une minute : trouve le plus long mot possible, chaque lettre une seule fois. Plusieurs propositions permises, la plus longue compte." />
      {!t ? (
        <div style={carte}>
          <button style={bouton()} onClick={commencer}>▶ Jouer</button>
          <div style={{ ...discret, marginTop: 8 }}>{stats.jouees} partie{stats.jouees > 1 ? "s" : ""} · record : mot de {stats.record} lettres</div>
        </div>
      ) : (
        <div style={{ maxWidth: 460 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            <span style={{ color: enCours && reste <= 10 ? "#c0392b" : "inherit" }}>⏱ {formatTemps(enCours ? reste : 0)}</span>
            <span>Meilleur : {meilleur ? `${meilleur} (${meilleur.length})` : "—"}</span>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
            {t.lettres.map((l, i) => (
              <button key={i} onClick={() => ajouter(i)} disabled={!enCours || compo.includes(i)} style={{
                width: "min(17vw, 60px)", aspectRatio: "1", borderRadius: 8, border: "none", fontSize: 24, fontWeight: 700, fontFamily: "inherit",
                background: "#f2b93b", color: "#111", opacity: compo.includes(i) ? 0.25 : 1, cursor: enCours && !compo.includes(i) ? "pointer" : "default", boxShadow: "0 2px 3px rgba(0,0,0,.25)",
              }}>{l}</button>
            ))}
          </div>
          {enCours && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <div style={{ flex: 1, minHeight: 38, padding: "8px 10px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, fontSize: 22, letterSpacing: 3, fontWeight: 600 }}>{mot || <span style={{ ...discret, letterSpacing: 0, fontWeight: 400 }}>Touche les lettres (ou tape au clavier)</span>}</div>
              <button style={boutonClair(mot.length > 0)} disabled={!mot} onClick={retirer}>⌫</button>
              <button style={bouton(mot.length > 1)} disabled={mot.length < 2} onClick={valider}>OK</button>
            </div>
          )}
          {message && <div style={{ fontSize: 13, color: message.startsWith("✔") ? "#1D9E75" : "#c0392b", marginBottom: 8 }}>{message}</div>}
          {essais.length > 0 && <div style={{ ...discret, marginBottom: 8 }}>Tes mots : {[...essais].sort((a, b) => b.length - a.length).join(", ")}</div>}
          {!enCours && (
            <div style={carte}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{meilleur ? `Ton meilleur mot : ${meilleur} (${meilleur.length} lettres)` : "Aucun mot trouvé cette fois."}</div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>Les plus longs possibles : <b>{meilleurs.join(", ")}</b></div>
              <div style={{ ...discret, marginBottom: 8 }}>Le tirage contenait « {t.garanti.toUpperCase()} » ({t.garanti.length} lettres). Record : {stats.record} lettres.</div>
              <button style={bouton()} onClick={commencer}>Nouveau tirage</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
