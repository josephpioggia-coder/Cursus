/**
 * CURSUS — Jeu de mots : jouer contre l'ordinateur (30/09/2026)
 * ======================================================================
 * Demande de Joseph : "créer un jeu de mots". Onglet "Jouer" de
 * ScrabbleSolveur.jsx. Nom volontairement neutre (« Scrabble » est une
 * marque). Moteur (règles, validation, ordinateur) : src/lib/jeuMots.js.
 *
 * Interaction (clic / toucher, adaptée au mobile) : touche une tuile du
 * chevalet, puis une case vide du plateau pour l'y poser ; touche une tuile
 * posée (verte) pour la reprendre. Un joker demande la lettre qu'il remplace.
 * Le dictionnaire est le même pour toi et pour l'ordinateur (liste libre,
 * pas l'ODS) : un mot refusé ici peut être valide en partie officielle.
 * L'état de la partie vit dans ce composant : ScrabbleSolveur le garde monté
 * (masqué) quand on change d'onglet, pour ne pas perdre la partie en cours.
 */

import { useState, useEffect, useRef } from "react";
import { PRIMES, pointsLettre, appliquerCoup, notation, genererCoups, plateauVide } from "../lib/scrabbleSolveur.js";
import { partiesJeuMotsAPI } from "../lib/api.js";
import { chargerMoteur, nouveauSac, completer, evaluerCoup, choisirCoup, scoreFinal, NIVEAUX } from "../lib/jeuMots.js";

const COULEUR_PRIME = { MT: "#d9534f", MD: "#d8a0c6", LT: "#1a7fc1", LD: "#a9d8f2" };
const carte = { background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: "12px 14px", marginBottom: 12 };
const bouton = (actif = true, couleur = "#1D9E75") => ({ background: actif ? couleur : "#ccc", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 500, cursor: actif ? "pointer" : "default", fontFamily: "inherit" });
const boutonClair = (actif = true) => ({ background: "transparent", border: "0.5px solid var(--color-border-tertiary)", color: actif ? "var(--color-text-primary)" : "#aaa", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: actif ? "pointer" : "default", fontFamily: "inherit" });

// Sauvegarde de la partie (30/09/2026) — DEUX copies :
//  - localStorage (immédiate, marche hors ligne, propre à l'appareil) ;
//  - table `parties_jeu_de_mots` du compte (voir 2026-09-30-parties-jeu-de-mots.sql,
//    envoyée après une courte attente, pour retrouver la partie sur tous les appareils).
// Au chargement on prend la copie la plus RÉCENTE (`enregistreLe`). Tous les accès sont
// protégés : sans stockage local, sans réseau ou sans la table, le jeu fonctionne quand même.
const CLE_SAUVEGARDE = "cursus-jeu-de-mots-v1";
const formeValide = (s) => {
  const ok = s && s.version === 1 && s.p && Array.isArray(s.p.plateau) && s.p.plateau.length === 15
    && s.p.plateau.every((l) => Array.isArray(l) && l.length === 15) && Array.isArray(s.p.sac)
    && Array.isArray(s.p.chevalets?.joueur) && Array.isArray(s.p.chevalets?.ordi)
    && typeof s.p.scores?.joueur === "number" && typeof s.p.scores?.ordi === "number"
    && ["joueur", "ordi", "fini"].includes(s.p.tour) && Array.isArray(s.p.journal) && s.p.niveau in NIVEAUX;
  return ok ? s : null;
};
const lireLocal = () => {
  try { return formeValide(JSON.parse(localStorage.getItem(CLE_SAUVEGARDE) || "null")); } catch { return null; }
};
/** Écrit la copie locale ; renvoie l'objet sauvegardé (à envoyer au compte) ou null si effacée. */
const ecrireLocal = (p, pose) => {
  const objet = p ? { version: 1, p, pose, enregistreLe: Date.now() } : null;
  try {
    if (objet) localStorage.setItem(CLE_SAUVEGARDE, JSON.stringify(objet));
    else localStorage.removeItem(CLE_SAUVEGARDE);
  } catch { /* stockage local indisponible */ }
  return objet;
};
const delai = (ms) => new Promise((r) => setTimeout(() => r("delai"), ms));
const TEXTE_SYNC = {
  compte: "☁ Sauvegardée dans ton compte",
  attente: "☁ Sauvegarde en cours…",
  absente: "💾 Sauvegardée sur cet appareil seulement (la table du compte n'est pas encore créée)",
  horsligne: "💾 Sauvegardée sur cet appareil seulement (compte injoignable pour le moment)",
};

const melanger = (t) => { const a = [...t]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cle = (r, c) => `${r},${c}`;

function Tuile({ l, taille = 40, etat = "", onClick, petit }) {
  const fond = etat === "sel" ? "#ffd75e" : etat === "echange" ? "#f28b82" : "#f2b93b";
  return (
    <div onClick={onClick} style={{
      width: taille, height: taille, borderRadius: 6, background: fond, border: etat === "sel" ? "2px solid #111" : "1px solid #b98a1a",
      display: "flex", alignItems: "center", justifyContent: "center", position: "relative", fontWeight: 700, fontSize: taille * 0.5,
      color: "#111", cursor: onClick ? "pointer" : "default", userSelect: "none", boxShadow: "0 1px 2px rgba(0,0,0,.25)",
    }}>
      {l === "?" ? "★" : l}
      {!petit && <span style={{ position: "absolute", right: 3, bottom: 1, fontSize: taille * 0.25, fontWeight: 500 }}>{l === "?" ? "" : pointsLettre(l)}</span>}
    </div>
  );
}

export default function JeuDeMots() {
  const [niveau, setNiveau] = useState("moyen");
  const [p, setP] = useState(null); // partie en cours (null = pas commencée)
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const moteur = useRef(null);
  const [selection, setSelection] = useState(null); // index du chevalet
  const [pose, setPose] = useState([]);             // tuiles posées ce tour : [{r,c,idx,l,joker}]
  const [choixJoker, setChoixJoker] = useState(null);
  const [echange, setEchange] = useState(null);     // null | Set d'index à échanger
  const [message, setMessage] = useState("");
  const [restauration, setRestauration] = useState(true); // vrai le temps de lire les sauvegardes et de recharger le dictionnaire
  const [sync, setSync] = useState("attente");            // état de la sauvegarde dans le compte
  const compteOk = useRef(true);      // faux : ne plus écrire dans le compte (table absente / injoignable)
  const minuteur = useRef(null);
  const enAttente = useRef(null);     // dernier objet pas encore envoyé au compte
  const avaitPartie = useRef(false);  // évite d'effacer le compte quand aucune partie n'a jamais été chargée

  // ─── Reprise de la partie sauvegardée (à l'ouverture) ───
  useEffect(() => {
    let actif = true;
    (async () => {
      const local = lireLocal();
      let distant = null;
      try {
        const r = await Promise.race([partiesJeuMotsAPI.charger(), delai(6000)]);
        if (r === "delai" || r.indisponible) {
          compteOk.current = false;
          setSync(r !== "delai" && r.tableAbsente ? "absente" : "horsligne");
        } else { distant = formeValide(r.etat); setSync("compte"); }
      } catch { compteOk.current = false; setSync("horsligne"); }
      if (!actif) return;
      // la copie la plus récente gagne
      const choix = local && distant ? (distant.enregistreLe > local.enregistreLe ? distant : local) : (local || distant);
      const duCompte = !!choix && choix === distant && choix !== local;
      if (!choix) { setRestauration(false); return; }
      try {
        const m = await chargerMoteur();
        if (!actif) return;
        moteur.current = m; // AVANT setP : le tour de l'ordinateur en a besoin
        const idxValides = (choix.pose || []).filter((t) => Number.isInteger(t.idx) && t.idx < choix.p.chevalets.joueur.length && choix.p.plateau[t.r]?.[t.c] === "");
        avaitPartie.current = true;
        setP(choix.p);
        setPose(choix.p.tour === "joueur" ? idxValides : []);
        setMessage(choix.p.tour === "fini" ? "" : duCompte ? "Partie reprise depuis ton compte." : "Partie reprise là où tu l'avais laissée.");
      } catch (e) { setErreur(e.message || String(e)); }
      setRestauration(false);
    })();
    return () => { actif = false; };
  }, []);

  // ─── Sauvegarde à chaque changement : locale tout de suite, compte après 1,2 s ───
  const envoyerAuCompte = async () => {
    const objet = enAttente.current;
    enAttente.current = null;
    if (!compteOk.current) return;
    const r = objet ? await partiesJeuMotsAPI.sauvegarder(objet) : await partiesJeuMotsAPI.effacer();
    if (r.indisponible) { compteOk.current = false; setSync(r.tableAbsente ? "absente" : "horsligne"); }
    else setSync("compte");
  };
  useEffect(() => {
    if (restauration) return;
    const objet = ecrireLocal(p, pose);
    if (p) avaitPartie.current = true;
    else if (!avaitPartie.current) return; // jamais eu de partie : ne rien effacer dans le compte
    if (!compteOk.current) return;
    enAttente.current = objet;
    if (objet) setSync("attente");
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => { if (!p) avaitPartie.current = false; envoyerAuCompte(); }, objet ? 1200 : 0);
    return () => clearTimeout(minuteur.current);
  }, [p, pose, restauration]); // eslint-disable-line react-hooks/exhaustive-deps

  // Onglet masqué / fermé : envoi immédiat de ce qui attend encore (au mieux : la page peut se fermer avant la réponse).
  useEffect(() => {
    const vider = () => { if (enAttente.current) { clearTimeout(minuteur.current); envoyerAuCompte(); } };
    const surVisibilite = () => { if (document.visibilityState === "hidden") vider(); };
    document.addEventListener("visibilitychange", surVisibilite);
    window.addEventListener("pagehide", vider);
    return () => { document.removeEventListener("visibilitychange", surVisibilite); window.removeEventListener("pagehide", vider); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Nouvelle partie ───
  const nouvellePartie = async () => {
    setErreur(""); setChargement(true);
    try {
      moteur.current = await chargerMoteur();
      const sac = nouveauSac();
      const chevalets = { joueur: completer([], sac), ordi: completer([], sac) };
      const commence = Math.random() < 0.5 ? "joueur" : "ordi";
      setP({
        plateau: plateauVide(), sac, chevalets, scores: { joueur: 0, ordi: 0 }, tour: commence, passes: 0,
        journal: [commence === "joueur" ? "C'est toi qui commences (tirage au sort)." : "L'ordinateur commence (tirage au sort)."],
        derniers: [], niveau, fin: null, indices: 0,
      });
      setPose([]); setSelection(null); setEchange(null); setMessage("");
    } catch (e) { setErreur(e.message || String(e)); }
    finally { setChargement(false); }
  };

  // Termine la partie (décompte final) — retourne la nouvelle partie.
  const finir = (q, finisseur) => {
    const f = scoreFinal(q, finisseur);
    const gagnant = f.joueur === f.ordi ? "égalité" : f.joueur > f.ordi ? "joueur" : "ordi";
    return {
      ...q, tour: "fini", fin: { finisseur, final: f, gagnant },
      journal: [...q.journal, `Fin de partie. Décompte des tuiles restantes : toi ${f.joueur} pts, ordinateur ${f.ordi} pts.`],
    };
  };

  // ─── Tour de l'ordinateur ───
  useEffect(() => {
    if (!p || p.tour !== "ordi") return;
    const t = setTimeout(() => {
      const calcul = (q) => {
        const sac = [...q.sac];
        const coup = choisirCoup(moteur.current.trie, q.plateau, q.chevalets.ordi, q.niveau);
        if (coup) {
          const chev = [...q.chevalets.ordi];
          for (const tu of coup.tuiles) chev.splice(chev.indexOf(tu.joker ? "?" : tu.l), 1);
          const nouveau = completer(chev, sac);
          const ev = evaluerCoup((m) => moteur.current.ensemble.has(m), q.plateau, coup.tuiles);
          const s = ev.ok ? ev.score : coup.score;
          const r = {
            ...q, plateau: appliquerCoup(q.plateau, coup), sac, chevalets: { ...q.chevalets, ordi: nouveau },
            scores: { ...q.scores, ordi: q.scores.ordi + s }, passes: 0, tour: "joueur",
            derniers: coup.tuiles.map((tu) => cle(tu.r, tu.c)),
            journal: [...q.journal, `Ordinateur : ${(ev.mots || [{ mot: coup.mot }]).map((m) => m.mot).join(", ")} en ${notation(coup)} → ${s} pts${coup.tuiles.length === 7 ? " (SCRABBLE +50 !)" : ""}.`],
          };
          return nouveau.length === 0 && sac.length === 0 ? finir(r, "ordi") : r;
        }
        // aucun coup : échange si possible, sinon passe
        if (sac.length >= 7) {
          const rendu = q.chevalets.ordi; const sac2 = melanger([...sac, ...rendu]);
          return { ...q, sac: sac2, chevalets: { ...q.chevalets, ordi: completer([], sac2) }, passes: q.passes + 1, tour: "joueur", derniers: [], journal: [...q.journal, "Ordinateur : échange ses tuiles."] };
        }
        const r = { ...q, passes: q.passes + 1, tour: "joueur", derniers: [], journal: [...q.journal, "Ordinateur : passe son tour."] };
        return r.passes >= 6 ? finir(r, null) : r;
      };
      setP(calcul(p));
    }, 700);
    return () => clearTimeout(t);
  }, [p?.tour]); // eslint-disable-line react-hooks/exhaustive-deps

  const monTour = p && p.tour === "joueur";
  const chevalet = p ? p.chevalets.joueur : [];
  const idxPoses = new Set(pose.map((t) => t.idx));

  // ─── Actions du joueur ───
  const surCase = (r, c) => {
    if (!monTour || echange) return;
    const dejaPose = pose.find((t) => t.r === r && t.c === c);
    if (dejaPose) { setPose(pose.filter((t) => t !== dejaPose)); setMessage(""); return; }
    if (p.plateau[r][c] !== "" || selection === null) return;
    const l = chevalet[selection];
    if (l === "?") { setChoixJoker({ r, c, idx: selection }); return; }
    setPose([...pose, { r, c, idx: selection, l, joker: false }]); setSelection(null); setMessage("");
  };
  const surTuile = (i) => {
    if (!monTour || idxPoses.has(i)) return;
    if (echange) { const s = new Set(echange); s.has(i) ? s.delete(i) : s.add(i); setEchange(s); return; }
    setSelection(selection === i ? null : i);
  };
  const rappel = () => { setPose([]); setSelection(null); setMessage(""); };

  const valider = () => {
    const poses = pose.map((t) => ({ r: t.r, c: t.c, l: t.l, joker: t.joker }));
    const ev = evaluerCoup((m) => moteur.current.ensemble.has(m), p.plateau, poses);
    if (!ev.ok) { setMessage(ev.erreur); return; }
    const sac = [...p.sac];
    const reste = chevalet.filter((_, i) => !idxPoses.has(i));
    const nouveau = completer(reste, sac);
    const plateau = p.plateau.map((l) => [...l]);
    for (const t of poses) plateau[t.r][t.c] = t.joker ? t.l.toLowerCase() : t.l;
    const r = {
      ...p, plateau, sac, chevalets: { ...p.chevalets, joueur: nouveau }, scores: { ...p.scores, joueur: p.scores.joueur + ev.score },
      passes: 0, tour: "ordi", derniers: [],
      journal: [...p.journal, `Toi : ${ev.mots.map((m) => `${m.mot} (${m.score})`).join(", ")}${poses.length === 7 ? " + 50 (SCRABBLE !)" : ""} → ${ev.score} pts.`],
    };
    setPose([]); setSelection(null); setMessage(`+${ev.score} points !`);
    setP(nouveau.length === 0 && sac.length === 0 ? finir(r, "joueur") : r);
  };

  const passer = () => {
    rappel();
    const r = { ...p, passes: p.passes + 1, tour: "ordi", derniers: [], journal: [...p.journal, "Toi : tu passes ton tour."] };
    setP(r.passes >= 6 ? finir(r, null) : r);
  };
  const confirmerEchange = () => {
    if (!echange || !echange.size) { setEchange(null); return; }
    const rendus = chevalet.filter((_, i) => echange.has(i));
    const garde = chevalet.filter((_, i) => !echange.has(i));
    const sac = [...p.sac];
    const nouveau = completer(garde, sac);
    const sac2 = melanger([...sac, ...rendus]);
    setEchange(null);
    setP({ ...p, sac: sac2, chevalets: { ...p.chevalets, joueur: nouveau }, passes: p.passes + 1, tour: "ordi", derniers: [], journal: [...p.journal, `Toi : tu échanges ${rendus.length} tuile${rendus.length > 1 ? "s" : ""}.`] });
  };
  const indice = () => {
    const coups = genererCoups(moteur.current.trie, p.plateau, chevalet.join(""));
    setP({ ...p, indices: p.indices + 1 });
    setMessage(coups.length ? `Indice : ${coups[0].mot} en ${notation(coups[0])} (${coups[0].score} pts).` : "Indice : aucun coup possible, échange ou passe.");
  };

  // ─── Rendu ───
  const posees = new Map(pose.map((t) => [cle(t.r, t.c), t]));
  const enJeu = p && p.tour !== "fini";

  if (restauration) return <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Recherche de ta partie sauvegardée…</div>;

  if (!p) {
    return (
      <div style={{ ...carte, maxWidth: 560 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <img src="/aencre-icone.png" alt="Æncre" style={{ width: 48, height: 48, borderRadius: "50%" }} />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>Jeu de mots — toi contre l'ordinateur</h2>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--color-text-secondary)" }}>
          Pose tes lettres sur le plateau 15×15, marque des points avec les cases de prime, et bats l'ordinateur.
          Le premier mot passe par l'étoile centrale, poser 7 tuiles d'un coup rapporte 50 points de plus.
          Le dictionnaire est le même pour vous deux (liste libre, pas l'ODS officiel).
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13 }}>Niveau de l'ordinateur{" "}
            <select value={niveau} onChange={(e) => setNiveau(e.target.value)} style={{ padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--color-border-tertiary)", fontFamily: "inherit" }}>
              {Object.entries(NIVEAUX).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <button style={bouton(!chargement)} disabled={chargement} onClick={nouvellePartie}>{chargement ? "Chargement du dictionnaire…" : "▶ Nouvelle partie"}</button>
        </div>
        {erreur && <div style={{ color: "#c0392b", fontSize: 13, marginTop: 8 }}>{erreur}</div>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
      {/* ── Plateau et chevalet ── */}
      <div style={{ flex: "1 1 460px", maxWidth: 640, minWidth: 300 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(15, 1fr)", gap: 1, background: "#222", padding: 1, borderRadius: 4 }}>
          {p.plateau.map((ligne, r) => ligne.map((x, c) => {
            const prime = PRIMES[r][c];
            const tp = posees.get(cle(r, c));
            const lettre = x || (tp ? tp.l : "");
            const joker = (x && x === x.toLowerCase()) || (tp && tp.joker);
            const derniere = p.derniers.includes(cle(r, c));
            return (
              <div key={cle(r, c)} onClick={() => surCase(r, c)} style={{
                aspectRatio: "1", position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "clamp(9px, 2.4vw, 18px)", fontWeight: 700, userSelect: "none",
                cursor: monTour && (tp || (!x && selection !== null)) ? "pointer" : "default",
                background: x ? "#f2b93b" : tp ? "#7ed37e" : COULEUR_PRIME[prime] || "#fafafa",
                color: lettre ? "#111" : "#fff",
                boxShadow: derniere ? "inset 0 0 0 2px #e4572e" : "none",
              }}>
                {lettre ? (
                  <>
                    <span style={{ fontStyle: joker ? "italic" : "normal", opacity: joker ? 0.6 : 1 }}>{lettre.toUpperCase()}</span>
                    <span style={{ position: "absolute", right: 1, bottom: 0, fontSize: "clamp(5px, 1.2vw, 8px)", fontWeight: 500 }}>{joker ? "" : pointsLettre(lettre)}</span>
                  </>
                ) : <span style={{ fontSize: "clamp(5px, 1.3vw, 9px)", fontWeight: 500 }}>{r === 7 && c === 7 ? "★" : prime}</span>}
              </div>
            );
          }))}
        </div>

        {/* Chevalet */}
        <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap", alignItems: "center", minHeight: 46 }}>
          {chevalet.map((l, i) => idxPoses.has(i) ? <div key={i} style={{ width: 40, height: 40, borderRadius: 6, border: "1px dashed #bbb" }} /> : (
            <Tuile key={i} l={l} etat={echange?.has(i) ? "echange" : selection === i ? "sel" : ""} onClick={() => surTuile(i)} />
          ))}
          {enJeu && <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginLeft: 6 }}>{echange ? "Touche les tuiles à échanger" : monTour ? "Touche une tuile, puis une case" : "L'ordinateur réfléchit…"}</span>}
        </div>

        {/* Boutons */}
        {enJeu && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {echange ? (
              <>
                <button style={bouton()} onClick={confirmerEchange}>Confirmer l'échange ({echange.size})</button>
                <button style={boutonClair()} onClick={() => setEchange(null)}>Annuler</button>
              </>
            ) : (
              <>
                <button style={bouton(monTour && pose.length > 0)} disabled={!monTour || !pose.length} onClick={valider}>✔ Jouer ce coup</button>
                <button style={boutonClair(monTour && pose.length > 0)} disabled={!monTour || !pose.length} onClick={rappel}>↩ Rappel</button>
                <button style={boutonClair(monTour && !pose.length)} disabled={!monTour || !!pose.length} onClick={() => setP({ ...p, chevalets: { ...p.chevalets, joueur: melanger(chevalet) } })}>🔀 Mélanger</button>
                <button style={boutonClair(monTour && !pose.length && p.sac.length >= 7)} disabled={!monTour || !!pose.length || p.sac.length < 7} title={p.sac.length < 7 ? "Il faut au moins 7 tuiles dans le sac" : ""} onClick={() => { setEchange(new Set()); setSelection(null); }}>⇄ Échanger</button>
                <button style={boutonClair(monTour && !pose.length)} disabled={!monTour || !!pose.length} onClick={passer}>Passer</button>
                <button style={boutonClair(monTour && !pose.length)} disabled={!monTour || !!pose.length} onClick={indice}>💡 Indice</button>
              </>
            )}
          </div>
        )}
        {message && <div style={{ marginTop: 8, fontSize: 13, color: /^(\+|Indice)/.test(message) ? "#1D9E75" : "#c0392b" }}>{message}</div>}
      </div>

      {/* ── Score et journal ── */}
      <div style={{ flex: "1 1 260px", minWidth: 240 }}>
        <div style={carte}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
            <span style={{ color: monTour ? "#1D9E75" : "inherit" }}>Toi : {p.fin ? p.fin.final.joueur : p.scores.joueur}</span>
            <span style={{ color: p.tour === "ordi" ? "#1D9E75" : "inherit" }}>Ordinateur : {p.fin ? p.fin.final.ordi : p.scores.ordi}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            {p.sac.length} tuile{p.sac.length > 1 ? "s" : ""} dans le sac · niveau {NIVEAUX[p.niveau].toLowerCase()}
            {p.passes > 0 && enJeu ? ` · ${p.passes} passe${p.passes > 1 ? "s" : ""} de suite (6 = fin)` : ""}
          </div>
          <div style={{ fontSize: 11, marginTop: 4, color: sync === "compte" ? "#1D9E75" : "var(--color-text-secondary)" }}>{TEXTE_SYNC[sync]}</div>
        </div>

        {p.fin && (
          <div style={{ ...carte, borderColor: "#1D9E75" }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
              {p.fin.gagnant === "joueur" ? "🎉 Tu as gagné !" : p.fin.gagnant === "ordi" ? "L'ordinateur gagne cette fois." : "Égalité !"}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8 }}>
              Il restait à l'ordinateur : {p.chevalets.ordi.map((l) => (l === "?" ? "★" : l)).join(" ") || "rien"}.
            </div>
            <button style={bouton()} onClick={() => setP(null)}>Rejouer</button>
          </div>
        )}

        <div style={{ ...carte, maxHeight: 340, overflowY: "auto" }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Journal</div>
          {[...p.journal].reverse().map((l, i) => <div key={i} style={{ fontSize: 12, lineHeight: 1.5, padding: "3px 0", borderTop: i ? "0.5px solid var(--color-border-tertiary)" : "none" }}>{l}</div>)}
        </div>
        {enJeu && <button style={boutonClair()} onClick={() => { if (window.confirm("Abandonner la partie en cours ?")) setP(null); }}>Abandonner</button>}
      </div>

      {/* Choix de la lettre d'un joker */}
      {choixJoker && (
        <div onClick={() => setChoixJoker(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--color-background-primary)", padding: 16, borderRadius: 12, maxWidth: 340 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Quelle lettre remplace le joker ?</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => (
                <button key={l} style={{ ...boutonClair(), width: 36, padding: "8px 0", fontWeight: 700 }}
                  onClick={() => { setPose([...pose, { r: choixJoker.r, c: choixJoker.c, idx: choixJoker.idx, l, joker: true }]); setChoixJoker(null); setSelection(null); setMessage(""); }}>{l}</button>
              ))}
            </div>
            <button style={{ ...boutonClair(), marginTop: 10 }} onClick={() => setChoixJoker(null)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
