/**
 * CURSUS — Solveur Scrabble (29/09/2026)
 * ======================================================================
 * Demande de Joseph : jouer avec les lettres et les mots "en situation" —
 * photographier / capturer une grille de Scrabble (application mobile),
 * faire lire le plateau et le chevalet par l'IA, puis obtenir les meilleurs
 * coups, avec aperçu sur la grille.
 *
 * Architecture :
 *   - Moteur (dictionnaire, génération des coups, score) : src/lib/scrabbleSolveur.js
 *     — pur JS, tourne dans le navigateur, AUCUN appel IA, gratuit.
 *   - Lecture de l'image : seul poste qui consomme des tokens. Passe par
 *     claude-prox (comme CopiloteIA), qui transmet le corps tel quel : un
 *     bloc image en base64 suffit, rien à changer côté serveur. L'IA lit ce
 *     qui est VISIBLE (une capture zoomée n'affiche qu'une partie du 15×15) ;
 *     le code recale ensuite cette zone sur le vrai plateau en comparant les
 *     cases de prime (aligner()). La grille reste modifiable à la main : la
 *     lecture d'image n'est jamais supposée parfaite.
 *   - Dictionnaire : public/scrabble/mots-fr.txt (liste de mots libre, PAS
 *     l'ODS officiel — voir scripts/preparer-dico-scrabble.mjs), chargé à la
 *     première demande de calcul seulement.
 *
 * Saisie au clavier sur la grille : lettre = pose (et avance), Maj+lettre =
 * joker, Retour arrière = efface, flèches = déplace. Sur mobile, utiliser la
 * barre d'édition sous la grille.
 */

import { useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import {
  TAILLE, PRIMES, plateauVide, construireDico, genererCoups, notation,
  appliquerCoup, retirerDuChevalet, aligner, plateauDepuisLecture, pointsLettre,
} from "../lib/scrabbleSolveur.js";

const EDGE_FUNCTION_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/claude-prox";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const COULEUR_PRIME = { MT: "#d9534f", MD: "#d8a0c6", LT: "#1a7fc1", LD: "#a9d8f2" };
const TEXTE_PRIME = { MT: "#fff", MD: "#fff", LT: "#fff", LD: "#fff" };

const CONSIGNE_LECTURE = `Tu lis une capture d'écran d'une partie de Scrabble (français). Réponds UNIQUEMENT par un objet JSON, sans texte autour ni bloc markdown :
{"lignes": [[...], ...], "chevalet": "..."}

"lignes" décrit la zone du plateau VISIBLE sur l'image, de haut en bas, chaque ligne de gauche à droite, toutes les lignes ayant le même nombre de cellules. Inclus aussi les colonnes/lignes partiellement coupées au bord si tu peux en identifier le contenu. Une cellule est :
- une tuile posée : sa lettre en MAJUSCULE (les petits chiffres en indice sont les points de la lettre : Z et K = 10, H et V = 4 — utilise-les pour lever un doute) ; une tuile joker (sans lettre ou marquée 0 point) s'écrit en minuscule ;
- sinon la prime de la case vide : "MT" (mot compte triple), "MD" (mot double), "LT" (lettre triple), "LD" (lettre double), "*" pour l'étoile centrale, "" pour une case normale sans prime.
"chevalet" : les lettres du chevalet du joueur (bande du bas), de gauche à droite, "?" pour un joker. Ignore le score, les boutons et les publicités.`;

let dicoEnCache = null;
async function chargerDico() {
  if (dicoEnCache) return dicoEnCache;
  const rep = await fetch("/scrabble/mots-fr.txt");
  if (!rep.ok) throw new Error("Dictionnaire introuvable (HTTP " + rep.status + ").");
  dicoEnCache = construireDico(await rep.text());
  return dicoEnCache;
}

// Réduit l'image (jpeg ≤ 1400 px) : moins de tokens, envoi plus rapide.
function imageEnBase64(fichier) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1400 / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k);
      cv.height = Math.round(img.height * k);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL("image/jpeg", 0.88).split(",")[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image illisible.")); };
    img.src = url;
  });
}

async function lireImage(fichier) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Session expirée — reconnectez-vous.");
  const data64 = await imageEnBase64(fichier);
  const rep = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 3000,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: data64 } },
        { type: "text", text: CONSIGNE_LECTURE },
      ] }],
    }),
  });
  const data = await rep.json();
  if (!rep.ok || data.error) throw new Error(data?.message || (typeof data?.error === "string" ? data.error : "Erreur serveur (HTTP " + rep.status + ")."));
  const texte = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const m = texte.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Réponse illisible de l'IA.");
  const json = JSON.parse(m[0]);
  if (!Array.isArray(json.lignes) || !json.lignes.length) throw new Error("Aucune grille lue.");
  return { lignes: json.lignes.map((l) => l.map((x) => String(x ?? ""))), chevalet: String(json.chevalet || "") };
}

const btn = (actif = true, couleur = "#1D9E75") => ({
  background: actif ? couleur : "#ccc", color: "#fff", border: "none", borderRadius: 8,
  padding: "9px 16px", fontSize: 13, fontWeight: 500, cursor: actif ? "pointer" : "default", fontFamily: "inherit",
});
const btnClair = { background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-primary)", borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" };

export default function ScrabbleSolveur() {
  const [plateau, setPlateau] = useState(plateauVide);
  const [chevalet, setChevalet] = useState("");
  const [sel, setSel] = useState(null); // {r, c}
  const [coups, setCoups] = useState(null);
  const [coupActif, setCoupActif] = useState(null);
  const [etat, setEtat] = useState(""); // message d'état
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [apercu, setApercu] = useState(null);
  const [note, setNote] = useState("");
  const zoneRef = useRef(null);

  const modifier = useCallback((r, c, valeur) => {
    setPlateau((p) => p.map((l, i) => (i === r ? l.map((x, j) => (j === c ? valeur : x)) : l)));
    setCoups(null); setCoupActif(null);
  }, []);

  const surTouche = (e) => {
    if (!sel) return;
    const { r, c } = sel;
    const va = (dr, dc) => setSel({ r: Math.min(14, Math.max(0, r + dr)), c: Math.min(14, Math.max(0, c + dc)) });
    if (e.key === "ArrowRight") va(0, 1);
    else if (e.key === "ArrowLeft") va(0, -1);
    else if (e.key === "ArrowDown") va(1, 0);
    else if (e.key === "ArrowUp") va(-1, 0);
    else if (e.key === "Backspace" || e.key === "Delete") { modifier(r, c, ""); if (e.key === "Backspace") va(0, -1); }
    else if (/^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
      modifier(r, c, e.shiftKey ? e.key.toLowerCase() : e.key.toUpperCase()); va(0, 1);
    } else return;
    e.preventDefault();
  };

  const decaler = (dr, dc) => {
    setPlateau((p) => {
      const q = plateauVide();
      let ok = true;
      p.forEach((l, r) => l.forEach((x, c) => {
        if (!x) return;
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= TAILLE || cc >= TAILLE) ok = false; else q[rr][cc] = x;
      }));
      return ok ? q : p;
    });
    setCoups(null); setCoupActif(null);
  };

  const surFichier = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErreur(""); setNote(""); setEtat("Lecture de l'image par l'IA…"); setOccupe(true);
    setApercu(URL.createObjectURL(f));
    try {
      const { lignes, chevalet: chev } = await lireImage(f);
      const { dr, dc, score } = aligner(lignes);
      setPlateau(plateauDepuisLecture(lignes, dr, dc));
      setChevalet(chev.toUpperCase().replace(/[^A-Z?]/g, "").slice(0, 7));
      setCoups(null); setCoupActif(null);
      setNote(
        `Zone lue : ${lignes.length} lignes × ${Math.max(...lignes.map((l) => l.length))} colonnes, recalée aux lignes ${dr + 1}–${dr + lignes.length}, `
        + `colonnes ${String.fromCharCode(65 + dc)}–${String.fromCharCode(64 + dc + Math.max(...lignes.map((l) => l.length)))} `
        + `(fiabilité du recalage ${Math.round(score * 100)} %). Vérifiez les lettres, corrigez si besoin, puis calculez.`
        + (score < 0.9 ? " Recalage incertain : utilisez les flèches de décalage pour aligner sur les cases de prime." : "")
      );
    } catch (err) {
      setErreur(err.message || String(err));
    } finally { setEtat(""); setOccupe(false); }
  };

  const calculer = async () => {
    setErreur(""); setCoupActif(null);
    if (!chevalet) { setErreur("Saisissez d'abord le chevalet."); return; }
    setOccupe(true); setEtat("Calcul des coups…");
    try {
      const dico = await chargerDico();
      await new Promise((r) => setTimeout(r, 30)); // laisse l'écran se rafraîchir
      setCoups(genererCoups(dico, plateau, chevalet));
    } catch (err) { setErreur(err.message || String(err)); }
    finally { setEtat(""); setOccupe(false); }
  };

  const jouer = (coup) => {
    setPlateau(appliquerCoup(plateau, coup));
    setChevalet(retirerDuChevalet(chevalet, coup));
    setCoups(null); setCoupActif(null);
  };

  const tuilesApercu = new Map((coupActif?.tuiles || []).map((t) => [`${t.r},${t.c}`, t]));
  const vide = plateau.every((l) => l.every((x) => !x));

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px 60px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <img src="/aencre-icone.png" alt="Æncre" style={{ width: 44, height: 44, borderRadius: "50%" }} />
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>Jouer avec les mots — solveur Scrabble</h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6, margin: "0 0 16px" }}>
          Chargez une capture de votre partie : l'IA lit la grille et le chevalet, puis le solveur (sans IA, dans votre navigateur)
          classe tous les coups possibles. Vous pouvez aussi tout saisir à la main. Le dictionnaire est une liste libre proche
          du Scrabble, pas l'ODS officiel : un mot proposé peut être refusé en partie, et inversement.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <label style={{ ...btn(!occupe), display: "inline-block" }}>
            📷 Lire une capture d'écran
            <input type="file" accept="image/*" onChange={surFichier} disabled={occupe} style={{ display: "none" }} />
          </label>
          <button style={btnClair} onClick={() => { setPlateau(plateauVide()); setCoups(null); setCoupActif(null); setNote(""); }}>Vider la grille</button>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Décaler la grille :</span>
          {[["←", 0, -1], ["→", 0, 1], ["↑", -1, 0], ["↓", 1, 0]].map(([s, dr, dc]) => (
            <button key={s} style={{ ...btnClair, padding: "7px 10px" }} onClick={() => decaler(dr, dc)}>{s}</button>
          ))}
        </div>

        {etat && <div style={{ fontSize: 13, color: "#BA7517", marginBottom: 8 }}>⏳ {etat}</div>}
        {erreur && <div style={{ fontSize: 13, color: "#c0392b", background: "#c0392b12", padding: "8px 12px", borderRadius: 8, marginBottom: 8 }}>{erreur}</div>}
        {note && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8, lineHeight: 1.5 }}>{note}</div>}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
          {/* ── Grille ── */}
          <div style={{ flex: "1 1 460px", maxWidth: 640, minWidth: 300 }}>
            <div
              ref={zoneRef} tabIndex={0} onKeyDown={surTouche}
              style={{ display: "grid", gridTemplateColumns: "repeat(15, 1fr)", gap: 1, background: "#222", padding: 1, outline: "none", borderRadius: 4 }}
            >
              {plateau.map((ligne, r) => ligne.map((x, c) => {
                const prime = PRIMES[r][c];
                const ap = tuilesApercu.get(`${r},${c}`);
                const lettre = x || (ap ? ap.l : "");
                const estSel = sel && sel.r === r && sel.c === c;
                return (
                  <div
                    key={`${r}-${c}`}
                    onClick={() => { setSel({ r, c }); zoneRef.current?.focus(); }}
                    style={{
                      aspectRatio: "1", position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "clamp(9px, 2.4vw, 18px)", fontWeight: 700, userSelect: "none", cursor: "pointer",
                      background: x ? "#f2b93b" : ap ? "#7ed37e" : (r === 7 && c === 7 && !prime) ? "#d8a0c6" : COULEUR_PRIME[prime] || "#fafafa",
                      color: lettre ? "#111" : TEXTE_PRIME[prime] || "#999",
                      opacity: ap && !x ? 0.95 : 1,
                      boxShadow: estSel ? "inset 0 0 0 2px #111" : "none",
                    }}
                  >
                    {lettre ? (
                      <>
                        <span style={{ fontStyle: (x && x === x.toLowerCase()) || (ap && ap.joker) ? "italic" : "normal", opacity: (x && x === x.toLowerCase()) || (ap && ap.joker) ? 0.6 : 1 }}>{lettre.toUpperCase()}</span>
                        <span style={{ position: "absolute", right: 1, bottom: 0, fontSize: "clamp(5px, 1.2vw, 8px)", fontWeight: 500 }}>
                          {pointsLettre(x || (ap.joker ? ap.l.toLowerCase() : ap.l)) || ""}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: "clamp(5px, 1.3vw, 9px)", fontWeight: 500 }}>{r === 7 && c === 7 ? "★" : prime}</span>
                    )}
                  </div>
                );
              }))}
            </div>

            {/* Barre d'édition (mobile) */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                {sel ? `Case ${sel.r + 1}${String.fromCharCode(65 + sel.c)} :` : "Touchez une case :"}
              </span>
              <input
                maxLength={1} disabled={!sel} value=""
                placeholder="lettre"
                onChange={(e) => {
                  const v = e.target.value.slice(-1);
                  if (sel && /^[a-zA-Z]$/.test(v)) { modifier(sel.r, sel.c, v.toUpperCase()); setSel({ r: sel.r, c: Math.min(14, sel.c + 1) }); }
                }}
                style={{ width: 56, padding: "6px 8px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6, fontSize: 14, textAlign: "center" }}
              />
              <button style={btnClair} disabled={!sel} onClick={() => sel && plateau[sel.r][sel.c] && modifier(sel.r, sel.c, plateau[sel.r][sel.c] === plateau[sel.r][sel.c].toUpperCase() ? plateau[sel.r][sel.c].toLowerCase() : plateau[sel.r][sel.c].toUpperCase())}>Joker on/off</button>
              <button style={btnClair} disabled={!sel} onClick={() => sel && modifier(sel.r, sel.c, "")}>Effacer</button>
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 6, lineHeight: 1.5 }}>
              Clavier : lettre = pose, Maj+lettre = joker (en italique), ⌫ efface, flèches = déplacement.
            </div>

            {/* Chevalet */}
            <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Chevalet</label>
              <input
                value={chevalet}
                onChange={(e) => { setChevalet(e.target.value.toUpperCase().replace(/[^A-Z?]/g, "").slice(0, 7)); setCoups(null); setCoupActif(null); }}
                placeholder="ex. HNV ou AEINRS?"
                style={{ padding: "8px 10px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, fontSize: 16, letterSpacing: 3, width: 190, fontFamily: "inherit" }}
              />
              <button style={btn(!occupe && !!chevalet)} disabled={occupe || !chevalet} onClick={calculer}>Trouver les meilleurs coups</button>
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>« ? » = joker. {vide && "Grille vide : le premier mot doit passer par l'étoile centrale."}</div>
            {apercu && <img src={apercu} alt="Capture chargée" style={{ marginTop: 14, maxWidth: 140, borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)" }} />}
          </div>

          {/* ── Résultats ── */}
          <div style={{ flex: "1 1 280px", minWidth: 260 }}>
            {coups === null ? (
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                Les meilleurs coups apparaîtront ici. Cliquez sur l'un d'eux pour le voir sur la grille (tuiles vertes).
              </div>
            ) : coups.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.6 }}>
                Aucun coup possible avec ce chevalet. Il faut échanger des lettres ou passer.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8 }}>{coups.length} coups possibles — les 40 meilleurs :</div>
                {coups.slice(0, 40).map((c, i) => {
                  const actif = coupActif === c;
                  return (
                    <div key={i} onClick={() => setCoupActif(actif ? null : c)} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 4, cursor: "pointer", borderRadius: 8,
                      background: actif ? "#1D9E7518" : "var(--color-background-primary)",
                      border: `0.5px solid ${actif ? "#1D9E75" : "var(--color-border-tertiary)"}`,
                    }}>
                      <span style={{ minWidth: 34, fontWeight: 600, fontSize: 15, color: "#1D9E75" }}>{c.score}</span>
                      <span style={{ flex: 1, fontSize: 14, letterSpacing: 1, color: "var(--color-text-primary)" }}>
                        {c.mot} <span style={{ fontSize: 11, color: "var(--color-text-secondary)", letterSpacing: 0 }}>· {notation(c)} · {c.tuiles.length} tuile{c.tuiles.length > 1 ? "s" : ""}</span>
                      </span>
                      {actif && <button style={{ ...btn(true), padding: "5px 10px", fontSize: 12 }} onClick={(e) => { e.stopPropagation(); jouer(c); }}>Jouer</button>}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
