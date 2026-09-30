/**
 * CURSUS — Dessin des plateaux et des tuiles sur <canvas> (30/09/2026)
 * ======================================================================
 * POURQUOI un canvas et pas des <div> : sur le téléphone de Joseph, le navigateur applique un
 * « mode sombre forcé » aux pages qui n'ont pas de thème sombre à elles (c'est le cas de Cursus).
 * Ce mode ASSOMBRIT les fonds clairs (cases blanches → noires, primes délavées) et INVERSE les
 * couleurs de texte (lettres noires sur tuiles jaunes → blanches). Le plateau ne ressemblait
 * plus du tout au modèle (le vrai jeu : cases claires, primes vives, tuiles ambrées à lettre
 * noire). Le contenu d'un canvas n'est jamais retouché par ce mode : les couleurs sont
 * celles qu'on dessine, sur tous les navigateurs. Vérifié dans Chromium avec le mode sombre
 * forcé activé (--enable-features=WebContentsForceDark) : les <div> sont assombris, les canvas non.
 * Le SVG n'est PAS une solution : son texte est inversé aussi.
 *
 * Contrepartie : pas de texte sélectionnable ni de lecteur d'écran sur ces zones ; l'interaction
 * passe par les coordonnées du clic (onCase / onClick). Tout est dimensionné en pixels CSS
 * d'après la LARGEUR DU CONTENEUR (ResizeObserver), jamais d'après la fenêtre : un plateau ne
 * doit jamais dépasser sa colonne (un débordement fait dézoomer toute la page sur mobile).
 */

import { useRef, useEffect, useState } from "react";
import { PRIMES, pointsLettre } from "../../lib/scrabbleSolveur.js";

const COULEUR_PRIME = { MT: "#d9534f", MD: "#cb90bd", LT: "#0b83c4", LD: "#8fd0f0" };
const TUILES = {
  normal:  { haut: "#ffd45c", bas: "#f0a11f", bord: "#b9770e" },
  derniere: { haut: "#f7a83c", bas: "#dc7a10", bord: "#a85a06" },
  pose:    { haut: "#a6ec9f", bas: "#4fb84f", bord: "#2f8a2f" },
  sel:     { haut: "#fff08a", bas: "#ffc93c", bord: "#111" },
  echange: { haut: "#ff9c96", bas: "#e0524a", bord: "#9c2b25" },
  chemin:  { haut: "#a6ec9f", bas: "#4fb84f", bord: "#2f8a2f" },
  fin:     { haut: "#5fdc9a", bas: "#1D9E75", bord: "#116b4f" },
  gris:    { haut: "#eceff3", bas: "#d3d8df", bord: "#a8b0bb" },
};
const POLICE = "Arial, Helvetica, sans-serif";

function rectArrondi(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Dessine une tuile de côté `s` en (x, y). `etat` : voir TUILES. Joker = lettre en italique grisée, sans points. */
export function dessinerTuile(ctx, x, y, s, { l, joker = false, etat = "normal", sansPoints = false }) {
  const c = TUILES[etat] || TUILES.normal;
  const g = ctx.createLinearGradient(0, y, 0, y + s);
  g.addColorStop(0, c.haut); g.addColorStop(1, c.bas);
  rectArrondi(ctx, x + 0.5, y + 0.5, s - 1, s - 1, s * 0.16);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = etat === "sel" ? Math.max(2, s * 0.06) : Math.max(1, s * 0.03);
  ctx.strokeStyle = c.bord; ctx.stroke();
  if (!l) return;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = joker ? "rgba(17,17,17,.55)" : "#111";
  ctx.font = `${joker ? "italic " : ""}700 ${s * 0.6}px ${POLICE}`;
  ctx.fillText(l === "?" ? "★" : l.toUpperCase(), x + s * (joker || sansPoints ? 0.5 : 0.46), y + s * 0.52);
  if (!joker && !sansPoints && l !== "?") {
    const p = pointsLettre(l.toUpperCase());
    ctx.font = `600 ${s * 0.25}px ${POLICE}`; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
    ctx.fillText(String(p), x + s * 0.9, y + s * 0.9);
  }
}

// Mesure la largeur disponible du conteneur (jamais celle de la fenêtre).
function useLargeur() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function preparer(canvas, cssW, cssH) {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
  canvas.style.width = cssW + "px"; canvas.style.height = cssH + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

const cle = (r, c) => `${r},${c}`;

/**
 * Plateau 15×15 fidèle au modèle. Props :
 *  plateau            : 15×15 ("" | "A".."Z" | minuscule = joker posé)
 *  posees             : Map "r,c" → { l, joker }  (tuiles du joueur pas encore validées, vertes)
 *  apercu             : Map "r,c" → { l, joker }  (aperçu d'un coup du solveur, vert)
 *  derniers           : tableau de "r,c" (dernier coup de l'adversaire, orange foncé)
 *  selection          : { r, c } | null (case active, anneau doré)
 *  zoom               : false = 15×15 dans la largeur ; true = grandes cases, à faire défiler
 *  centrer            : { r, c, cle } — au changement de `cle` (ou du zoom), fait défiler jusque-là
 *  onCase(r, c)
 */
export function PlateauCanvas({ plateau, posees, apercu, derniers = [], selection, zoom = false, centrer, onCase }) {
  const [refBoite, largeur] = useLargeur();
  const refCanvas = useRef(null);
  const CASES_ZOOM = 44;
  const cellule = zoom ? CASES_ZOOM : Math.max(8, Math.floor(Math.min(largeur || 300, 640) / 15));
  const taille = cellule * 15;

  useEffect(() => {
    const canvas = refCanvas.current;
    if (!canvas) return;
    const ctx = preparer(canvas, taille, taille);
    ctx.fillStyle = "#1b1b1b"; ctx.fillRect(0, 0, taille, taille);
    const dern = new Set(derniers);
    for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) {
      const x = c * cellule, y = r * cellule, k = cle(r, c);
      const t = plateau[r][c] ? { l: plateau[r][c].toUpperCase(), joker: plateau[r][c] === plateau[r][c].toLowerCase(), etat: dern.has(k) ? "derniere" : "normal" }
        : posees?.get(k) ? { ...posees.get(k), etat: "pose" }
        : apercu?.get(k) ? { ...apercu.get(k), etat: "pose" } : null;
      const marge = Math.max(1, cellule * 0.04);
      if (t) { dessinerTuile(ctx, x + marge, y + marge, cellule - 2 * marge, t); }
      else {
        const prime = PRIMES[r][c];
        rectArrondi(ctx, x + marge, y + marge, cellule - 2 * marge, cellule - 2 * marge, cellule * 0.14);
        ctx.fillStyle = COULEUR_PRIME[prime] || "#f4f4f4"; ctx.fill();
        if (prime) {
          ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.font = `700 ${cellule * (r === 7 && c === 7 ? 0.6 : 0.36)}px ${POLICE}`;
          ctx.fillText(r === 7 && c === 7 ? "★" : prime, x + cellule / 2, y + cellule * 0.53);
        }
      }
      if (selection && selection.r === r && selection.c === c) {
        rectArrondi(ctx, x + 1.5, y + 1.5, cellule - 3, cellule - 3, cellule * 0.14);
        ctx.lineWidth = Math.max(2, cellule * 0.09); ctx.strokeStyle = "#ffd700"; ctx.stroke();
      }
    }
  }, [plateau, posees, apercu, derniers, selection, cellule, taille]);

  // Défilement vers une case (mode zoom).
  useEffect(() => {
    const b = refBoite.current;
    if (!zoom || !b) return;
    const cible = centrer || { r: 7, c: 7 };
    b.scrollTo({ left: (cible.c + 0.5) * cellule - b.clientWidth / 2, top: (cible.r + 0.5) * cellule - b.clientHeight / 2, behavior: "smooth" });
  }, [zoom, centrer?.cle]); // eslint-disable-line react-hooks/exhaustive-deps

  const clic = (e) => {
    const rect = refCanvas.current.getBoundingClientRect();
    const pas = rect.width / 15;
    const c = Math.floor((e.clientX - rect.left) / pas), r = Math.floor((e.clientY - rect.top) / pas);
    if (r >= 0 && r < 15 && c >= 0 && c < 15) onCase?.(r, c);
  };
  // Le canvas est en position ABSOLUE dans un cadre dont la taille ne dépend que de la largeur du
  // conteneur : ainsi sa taille en pixels ne compte jamais dans la largeur minimale de la page (sinon
  // boucle : le canvas force la page à s'élargir, le conteneur mesure ce nouvel élargissement, etc.).
  return (
    <div ref={refBoite} style={{
      position: "relative", width: "100%", minWidth: 0, borderRadius: 6, background: "#1b1b1b",
      ...(zoom ? { maxWidth: "none", height: `min(68vh, ${taille}px)`, overflow: "auto", WebkitOverflowScrolling: "touch" } : { maxWidth: 640, aspectRatio: "1", overflow: "hidden" }),
    }}>
      <canvas ref={refCanvas} onClick={clic} role="img" aria-label="Plateau de 15 par 15 cases"
        style={{ position: "absolute", left: 0, top: 0, touchAction: zoom ? "auto" : "manipulation", cursor: onCase ? "pointer" : "default" }} />
    </div>
  );
}

/**
 * Une tuile isolée (chevalet, tirage). `taille` en px CSS (ou "100%" pour remplir la case parente).
 * `etat` : normal | sel | echange | pose | chemin | fin | gris.
 */
export function TuileCanvas({ l, joker = false, etat = "normal", taille = 44, onClick, disabled, sansPoints = false, title }) {
  const ref = useRef(null);
  const pleine = taille === "100%";
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const px = pleine ? 128 : taille;
    const dpr = pleine ? 1 : Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.round(px * dpr); canvas.height = Math.round(px * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, px, px);
    dessinerTuile(ctx, 0, 0, px, { l, joker, etat, sansPoints });
    if (disabled) { ctx.globalCompositeOperation = "source-atop"; ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.fillRect(0, 0, px, px); }
  }, [l, joker, etat, taille, disabled, sansPoints, pleine]);
  return (
    <canvas ref={ref} title={title} role="img" aria-label={l === "?" ? "joker" : l} onClick={disabled ? undefined : onClick}
      style={{ width: pleine ? "100%" : taille, height: pleine ? "auto" : taille, aspectRatio: "1", display: "block", cursor: onClick && !disabled ? "pointer" : "default", touchAction: "manipulation" }} />
  );
}

/**
 * Grille carrée de lettres (Boggle, mots mêlés). `cellules` : tableau n×n à plat, chaque
 * élément { l, etat?, fond?, texte? } — `etat` = un état de tuile (tuile ambrée), sinon `fond`
 * (couleur unie, défaut blanc cassé) et `texte`. `marque` = index de case entourée. onCase(i).
 */
export function GrilleCanvas({ n, cellules, onCase, marque, tuiles = false, maxLargeur = 440 }) {
  const [refBoite, largeur] = useLargeur();
  const refCanvas = useRef(null);
  const cellule = Math.max(10, Math.floor(Math.min(largeur || 280, maxLargeur) / n));
  const taille = cellule * n;
  useEffect(() => {
    const canvas = refCanvas.current;
    if (!canvas) return;
    const ctx = preparer(canvas, taille, taille);
    ctx.fillStyle = "#1b1b1b"; ctx.fillRect(0, 0, taille, taille);
    const marge = Math.max(1, cellule * (tuiles ? 0.05 : 0.04));
    cellules.forEach((cell, i) => {
      const x = (i % n) * cellule, y = Math.floor(i / n) * cellule, s = cellule - 2 * marge;
      if (tuiles || cell.etat) dessinerTuile(ctx, x + marge, y + marge, s, { l: cell.l, etat: cell.etat || "normal", sansPoints: true });
      else {
        rectArrondi(ctx, x + marge, y + marge, s, s, cellule * 0.14);
        ctx.fillStyle = cell.fond || "#f4f4f4"; ctx.fill();
        ctx.fillStyle = cell.texte || "#111"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = `700 ${cellule * 0.55}px ${POLICE}`;
        ctx.fillText(cell.l, x + cellule / 2, y + cellule * 0.53);
      }
      if (marque === i) {
        rectArrondi(ctx, x + 1.5, y + 1.5, cellule - 3, cellule - 3, cellule * 0.14);
        ctx.lineWidth = Math.max(2, cellule * 0.09); ctx.strokeStyle = "#ffd700"; ctx.stroke();
      }
    });
  }, [n, cellules, marque, cellule, taille, tuiles]);
  const clic = (e) => {
    const rect = refCanvas.current.getBoundingClientRect();
    const pas = rect.width / n;
    const c = Math.floor((e.clientX - rect.left) / pas), r = Math.floor((e.clientY - rect.top) / pas);
    if (r >= 0 && r < n && c >= 0 && c < n) onCase?.(r * n + c, r, c);
  };
  return (
    <div ref={refBoite} style={{ position: "relative", width: "100%", maxWidth: maxLargeur, minWidth: 0, aspectRatio: "1", overflow: "hidden", borderRadius: 6, background: "#1b1b1b" }}>
      <canvas ref={refCanvas} onClick={clic} role="img" aria-label={"Grille : " + cellules.map((c) => c.l).join("")}
        style={{ position: "absolute", left: 0, top: 0, touchAction: "manipulation", cursor: onCase ? "pointer" : "default" }} />
    </div>
  );
}
