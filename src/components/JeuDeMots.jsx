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
import { appliquerCoup, notation, genererCoups, plateauVide } from "../lib/scrabbleSolveur.js";
import { PlateauCanvas, TuileCanvas } from "./jeux/dessin.jsx";
import { partiesJeuMotsAPI } from "../lib/api.js";
import { chargerMoteur, nouveauSac, completer, evaluerCoup, choisirCoup, scoreFinal, NIVEAUX } from "../lib/jeuMots.js";

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

export default function JeuDeMots() {
  const [niveau, setNiveau] = useState("moyen");
  const [p, setP] = useState(null); // partie en cours (null = pas commencée)
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const moteur = useRef(null);
  const [selection, setSelection] = useState(null); // index du chevalet
  const [pose, setPose] = useState([]);             // tuiles posées ce tour : [{r,c,idx,l,joker}]
  const [choixJoker, setChoixJoker] = useState(null);
  const [glisse, setGlisse] = useState(null);   // tuile en cours de glissement : { idx?, l, joker, x, y }
  const [cible, setCible] = useState(null);     // case survolée pendant le glissement
  const zoneRef = useRef(null);                 // conteneur du plateau (pour retrouver la case sous le doigt)
  const apresGlisse = useRef(false);            // évite qu'un lâcher sur le plateau soit pris pour un clic
  const courant = useRef({});                   // dernières valeurs, lues par les écouteurs du glissement
  const [zoom, setZoom] = useState(false);
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
  // ─── Glisser-déposer (30/09/2026, demande de Joseph : « poser le doigt sur une lettre et la faire
  // glisser vers la case ») — marche au doigt et à la souris (événements « pointer »). La tuile
  // suit le doigt, décalée AU-DESSUS pour ne pas être cachée ; la case visée est cerclée d'or ; au
  // relâchement, la tuile se pose si la case est libre, sinon elle revient. Un appui sans mouvement
  // (< 8 px) reste un simple toucher (sélection puis case). On peut aussi déplacer une tuile déjà
  // posée (verte) ou la lâcher hors du plateau pour la reprendre. Les écouteurs sont sur `window`
  // (pas de capture de pointeur) et lisent `courant.current`, mis à jour à chaque rendu.
  courant.current = { p, pose, chevalet, zoom };
  const DECALAGE = 46, PAS = 8;
  const celluleSous = (x, y) => {
    const canvas = zoneRef.current?.querySelector('canvas[aria-label^="Plateau"]');
    if (!canvas) return null;
    const cadre = canvas.parentElement.getBoundingClientRect();
    if (x < cadre.left || x > cadre.right || y < cadre.top || y > cadre.bottom) return null;
    const rect = canvas.getBoundingClientRect(), pas = rect.width / 15;
    const c = Math.floor((x - rect.left) / pas), r = Math.floor((y - rect.top) / pas);
    return r >= 0 && r < 15 && c >= 0 && c < 15 ? { r, c } : null;
  };
  const caseLibre = (c, ignorer) => {
    const cur = courant.current;
    return !!c && cur.p.plateau[c.r][c.c] === "" && !cur.pose.some((t) => t !== ignorer && t.r === c.r && t.c === c.c);
  };
  const commencerGlisse = (e, source) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const dep = { x: e.clientX, y: e.clientY, deplace: false };
    const bouger = (ev) => {
      const cur = courant.current;
      if (!dep.deplace) {
        if (Math.hypot(ev.clientX - dep.x, ev.clientY - dep.y) < PAS) return;
        dep.deplace = true;
        if (source.type === "plateau") setPose(cur.pose.filter((t) => t !== source.tuile)); // la tuile quitte sa case
        setSelection(null); setMessage("");
      }
      const l = source.type === "chevalet" ? cur.chevalet[source.idx] : source.tuile.l;
      setGlisse({ idx: source.type === "chevalet" ? source.idx : undefined, l, joker: source.type === "plateau" && source.tuile.joker, x: ev.clientX, y: ev.clientY - DECALAGE });
      const c = celluleSous(ev.clientX, ev.clientY - DECALAGE);
      setCible(caseLibre(c, source.tuile) ? c : null);
    };
    const arreter = () => {
      window.removeEventListener("pointermove", bouger);
      window.removeEventListener("pointerup", relacher);
      window.removeEventListener("pointercancel", annuler);
    };
    const annuler = () => { arreter(); if (dep.deplace) { setGlisse(null); setCible(null); } };
    const relacher = (ev) => {
      arreter();
      if (!dep.deplace) return; // simple appui : le clic normal fait son travail
      apresGlisse.current = true; setTimeout(() => { apresGlisse.current = false; }, 80);
      setGlisse(null); setCible(null);
      const cur = courant.current;
      const c = celluleSous(ev.clientX, ev.clientY - DECALAGE);
      if (!caseLibre(c, source.tuile)) return; // hors plateau ou case occupée : la tuile revient
      const base = source.type === "plateau" ? cur.pose.filter((t) => t !== source.tuile) : cur.pose;
      if (source.type === "plateau") { setPose([...base, { ...source.tuile, r: c.r, c: c.c }]); return; }
      const l = cur.chevalet[source.idx];
      if (l === "?") setChoixJoker({ r: c.r, c: c.c, idx: source.idx });
      else setPose([...base, { r: c.r, c: c.c, idx: source.idx, l, joker: false }]);
    };
    window.addEventListener("pointermove", bouger);
    window.addEventListener("pointerup", relacher);
    window.addEventListener("pointercancel", annuler);
  };

  const surCase = (r, c) => {
    if (apresGlisse.current) return;
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
  const posees = new Map(pose.map((t) => [cle(t.r, t.c), { l: t.l, joker: t.joker }]));
  const derniereCase = pose.length ? pose[pose.length - 1] : p && p.derniers.length ? { r: +p.derniers[0].split(",")[0], c: +p.derniers[0].split(",")[1] } : null;
  const centrer = derniereCase ? { r: derniereCase.r, c: derniereCase.c, cle: `${derniereCase.r},${derniereCase.c},${pose.length}` } : undefined;
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
      <div style={{ flex: "1 1 320px", maxWidth: 640, minWidth: 0 }}>
        <div ref={zoneRef} style={{ touchAction: !zoom && pose.length && monTour ? "none" : "auto" }}
          onPointerDown={(e) => {
            if (!monTour || echange || zoom) return;
            const c = celluleSous(e.clientX, e.clientY);
            const t = c && pose.find((x) => x.r === c.r && x.c === c.c);
            if (t) commencerGlisse(e, { type: "plateau", tuile: t });
          }}>
          <PlateauCanvas plateau={p.plateau} posees={posees} derniers={p.derniers} selection={cible} zoom={zoom} centrer={centrer} onCase={surCase} />
        </div>
        <div style={{ marginTop: 6 }}>
          <button style={boutonClair()} onClick={() => setZoom(!zoom)}>{zoom ? "🔍 Vue d'ensemble" : "🔍 Agrandir les cases"}</button>
        </div>

        {/* Chevalet */}
        <div style={{ display: "flex", gap: 5, marginTop: 10, width: "100%", maxWidth: 7 * 54 + 30, alignItems: "center" }}>
          {chevalet.map((l, i) => (
            <div key={i} style={{ flex: "1 1 0", maxWidth: 54, minWidth: 0, touchAction: "none", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={(e) => { if (monTour && !echange && !idxPoses.has(i)) commencerGlisse(e, { type: "chevalet", idx: i }); }}>
              {idxPoses.has(i) || glisse?.idx === i
                ? <div style={{ aspectRatio: "1", borderRadius: 8, border: "1px dashed #bbb" }} />
                : <TuileCanvas l={l} taille="100%" etat={echange?.has(i) ? "echange" : selection === i ? "sel" : "normal"} onClick={() => surTuile(i)} />}
            </div>
          ))}
        </div>
        {enJeu && <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 6 }}>{echange ? "Touche les tuiles à échanger" : monTour ? "Fais glisser une tuile sur le plateau (ou touche-la, puis une case)" : "L'ordinateur réfléchit…"}</div>}

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
      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
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

      {/* Tuile qui suit le doigt pendant le glissement, posée 34 px AU-DESSUS de la case visée pour ne pas la cacher (anneau doré) */}
      {glisse && (
        <div style={{ position: "fixed", left: glisse.x - 27, top: glisse.y - 27 - 34, width: 54, height: 54, opacity: 0.92, pointerEvents: "none", zIndex: 3000, filter: "drop-shadow(0 6px 8px rgba(0,0,0,.45))" }}>
          <TuileCanvas l={glisse.l} joker={glisse.joker} taille={54} etat="sel" />
        </div>
      )}

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
