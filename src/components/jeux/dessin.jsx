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
 *  viseur             : { r, c } | null — case visée pendant un glissement : anneau doré + halo doré autour
 *                       (la tuile fantôme est dessinée PAR-DESSUS, centrée sur cette case)
 *  cadre              : { w, h } | undefined — taille disponible (mode plein écran). Vue d'ensemble : plateau
 *                       carré du plus grand côté qui tient ; zoom : le cadre défilant fait exactement w × h.
 *  bulle              : { r, c, texte } | null — pastille verte (points du mot en cours) au coin de la case
 *  zoom               : false = 15×15 dans la largeur ; true = grandes cases, à faire défiler
 *  panNatif           : en mode zoom, laisse le navigateur faire défiler au toucher (défaut). À mettre à FALSE
 *                       quand l'appelant gère lui-même le glissement (partie : glisser une tuile ≠ défiler) —
 *                       `touch-action: none` doit alors être sur le cadre défilant LUI-MÊME : celui d'un parent
 *                       est ignoré par le navigateur (il s'arrête au premier conteneur défilant), et il annulait
 *                       le glissement (pointercancel) pour défiler à la place.
 *  centrer            : { r, c, cle } — au changement de `cle` (ou du zoom), fait défiler jusque-là
 *  onCase(r, c)
 */
export function PlateauCanvas({ plateau, posees, apercu, derniers = [], selection, viseur, bulle, zoom = false, panNatif = true, cadre, centrer, onCase }) {
  const [refBoite, largeur] = useLargeur();
  const refCanvas = useRef(null);
  const CASES_ZOOM = 44;
  const cote = cadre ? Math.min(cadre.w, cadre.h) : 640;
  const cellule = zoom ? CASES_ZOOM : Math.max(8, Math.floor(Math.min(largeur || 300, cote) / 15));
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
    if (viseur) {
      const x = viseur.c * cellule, y = viseur.r * cellule;
      rectArrondi(ctx, x - cellule * 0.6, y - cellule * 0.6, cellule * 2.2, cellule * 2.2, cellule * 0.4);
      ctx.fillStyle = "rgba(255,215,0,.38)"; ctx.fill();
      rectArrondi(ctx, x + 1, y + 1, cellule - 2, cellule - 2, cellule * 0.14);
      ctx.lineWidth = Math.max(3, cellule * 0.12); ctx.strokeStyle = "#ffb400"; ctx.stroke();
    }
    if (bulle) {
      const x = bulle.c * cellule, y = bulle.r * cellule;
      ctx.font = `700 ${Math.max(11, cellule * 0.42)}px ${POLICE}`;
      const w = ctx.measureText(bulle.texte).width + Math.max(8, cellule * 0.4), h = Math.max(17, cellule * 0.62);
      const bx = Math.min(taille - w - 1, Math.max(1, x + cellule - w * 0.4)), by = Math.max(1, y - h * 0.65);
      rectArrondi(ctx, bx, by, w, h, h / 2);
      ctx.fillStyle = "#1D9E75"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = "#fff"; ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(bulle.texte, bx + w / 2, by + h / 2 + 0.5);
    }
  }, [plateau, posees, apercu, derniers, selection, cellule, taille, bulle?.r, bulle?.c, bulle?.texte, viseur?.r, viseur?.c]);

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
      ...(zoom
        ? { maxWidth: "none", height: cadre ? cadre.h : `min(68vh, ${taille}px)`, width: cadre ? cadre.w : "100%", overflow: "auto", WebkitOverflowScrolling: "touch", touchAction: panNatif ? "auto" : "none" }
        : cadre ? { width: cote, height: cote, margin: "0 auto", overflow: "hidden" } : { maxWidth: 640, aspectRatio: "1", overflow: "hidden" }),
    }}>
      <canvas ref={refCanvas} onClick={clic} role="img" aria-label="Plateau de 15 par 15 cases"
        style={{ position: "absolute", left: 0, top: 0, touchAction: zoom ? (panNatif ? "auto" : "none") : "manipulation", cursor: onCase ? "pointer" : "default" }} />
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

// Coupe un texte en lignes de largeur maxi `largeur` (au plus `maxLignes`, « … » si ça dépasse).
function decouper(ctx, texte, largeur, maxLignes) {
  const mots = texte.split(" "), lignes = [];
  let cur = "";
  for (const m of mots) {
    const essai = cur ? cur + " " + m : m;
    if (ctx.measureText(essai).width <= largeur || !cur) cur = essai; else { lignes.push(cur); cur = m; }
  }
  if (cur) lignes.push(cur);
  if (lignes.length > maxLignes) {
    const garde = lignes.slice(0, maxLignes);
    let der = garde[maxLignes - 1];
    while (der.length > 1 && ctx.measureText(der + "…").width > largeur) der = der.slice(0, -1);
    garde[maxLignes - 1] = der + "…";
    return garde;
  }
  return lignes;
}

/**
 * Grille de mots (croisés, fléchés, codés) — 04/10/2026. Sur canvas pour la même raison que le plateau
 * (mode sombre forcé du navigateur). `cellules` : tableau lignes × colonnes de
 *   null                                  → case noire
 *   { t: "L", lettre?, num?, code?, fond?, erreur?, revele? }   → case de lettre (num = numéro de mot croisé,
 *                                           code = numéro d'un mot codé, lettre = ce que le joueur a saisi)
 *   { t: "C", h?: {texte}, v?: {texte}, actif? } → case d'indice de mots fléchés (h : mot vers la droite,
 *                                           v : mot vers le bas ; flèche dessinée sur le bord correspondant)
 * onCase(r, c). La taille de case suit la largeur du conteneur (jamais celle de la fenêtre).
 */
export function GrilleMotsCanvas({ lignes, colonnes, cellules, onCase, maxCase = 48 }) {
  const [refBoite, largeur] = useLargeur();
  const refCanvas = useRef(null);
  const cellule = Math.max(14, Math.min(maxCase, Math.floor((largeur || 300) / colonnes)));
  const W = cellule * colonnes, H = cellule * lignes;
  useEffect(() => {
    const canvas = refCanvas.current;
    if (!canvas) return;
    const ctx = preparer(canvas, W, H);
    ctx.fillStyle = "#1b1b1b"; ctx.fillRect(0, 0, W, H);
    const m = 1;
    for (let r = 0; r < lignes; r++) for (let c = 0; c < colonnes; c++) {
      const x = c * cellule, y = r * cellule, cell = cellules[r][c];
      if (!cell) { ctx.fillStyle = "#2b3038"; ctx.fillRect(x + m, y + m, cellule - 2 * m, cellule - 2 * m); continue; }
      if (cell.t === "L") {
        ctx.fillStyle = cell.fond || "#ffffff"; ctx.fillRect(x + m, y + m, cellule - 2 * m, cellule - 2 * m);
        ctx.textBaseline = "alphabetic";
        if (cell.num || cell.code) {
          ctx.font = `${cell.code ? 700 : 500} ${Math.max(8, cellule * (cell.code ? 0.27 : 0.25))}px ${POLICE}`;
          ctx.fillStyle = cell.code ? "#1a6a8f" : "#555"; ctx.textAlign = "left";
          ctx.fillText(String(cell.num || cell.code), x + 3, y + Math.max(9, cellule * 0.27));
        }
        if (cell.lettre) {
          ctx.font = `700 ${cellule * 0.58}px ${POLICE}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = cell.erreur ? "#c0392b" : cell.revele ? "#1a6fb3" : "#111";
          ctx.fillText(cell.lettre, x + cellule / 2, y + cellule * (cell.num || cell.code ? 0.6 : 0.54));
        }
      } else {
        ctx.fillStyle = cell.actif ? "#ffe9a8" : "#cfe3f2"; ctx.fillRect(x + m, y + m, cellule - 2 * m, cellule - 2 * m);
        const deux = cell.h && cell.v;
        const police = Math.max(7, Math.min(11, cellule * 0.2));
        ctx.font = `600 ${police}px ${POLICE}`; ctx.fillStyle = "#1c3b57"; ctx.textAlign = "center"; ctx.textBaseline = "top";
        const zone = (clue, y0, h) => {
          const interligne = police * 1.12, max = Math.max(1, Math.floor((h - 2) / interligne));
          const ls = decouper(ctx, clue.texte, cellule - 9, max);
          const total = ls.length * interligne, hautDepart = y0 + Math.max(1, (h - total) / 2);
          ls.forEach((l, i) => ctx.fillText(l, x + (cellule - 3) / 2, hautDepart + i * interligne));
        };
        const haut = deux ? (cellule - 2) / 2 : cellule - 2;
        if (cell.h) zone(cell.h, y + 1, haut);
        if (cell.v) zone(cell.v, y + 1 + (cell.h ? haut : 0), haut);
        ctx.fillStyle = "#d2691e";
        const t = Math.max(4, cellule * 0.13);
        if (cell.h) { // flèche → au milieu du bord droit
          const cy = y + (deux ? cellule * 0.27 : cellule / 2);
          ctx.beginPath(); ctx.moveTo(x + cellule - 1, cy); ctx.lineTo(x + cellule - 1 - t, cy - t * 0.9); ctx.lineTo(x + cellule - 1 - t, cy + t * 0.9); ctx.fill();
        }
        if (cell.v) { // flèche ↓ au milieu du bord bas
          const cx = x + cellule / 2;
          ctx.beginPath(); ctx.moveTo(cx, y + cellule - 1); ctx.lineTo(cx - t * 0.9, y + cellule - 1 - t); ctx.lineTo(cx + t * 0.9, y + cellule - 1 - t); ctx.fill();
        }
      }
    }
  }, [lignes, colonnes, cellules, cellule, W, H]);
  const clic = (e) => {
    const rect = refCanvas.current.getBoundingClientRect(), pas = rect.width / colonnes;
    const c = Math.floor((e.clientX - rect.left) / pas), r = Math.floor((e.clientY - rect.top) / (rect.height / lignes));
    if (r >= 0 && r < lignes && c >= 0 && c < colonnes) onCase?.(r, c);
  };
  return (
    <div ref={refBoite} style={{ position: "relative", width: "100%", maxWidth: colonnes * maxCase, minWidth: 0, aspectRatio: `${colonnes} / ${lignes}`, overflow: "hidden", borderRadius: 6, background: "#1b1b1b" }}>
      <canvas ref={refCanvas} onClick={clic} role="img" aria-label={`Grille de ${lignes} lignes et ${colonnes} colonnes`}
        style={{ position: "absolute", left: 0, top: 0, touchAction: "manipulation", cursor: onCase ? "pointer" : "default" }} />
    </div>
  );
}


// ─── Mots en cercle (05/10/2026) ──────────────────────────────────────────────────────────────────

/**
 * Grille des mots à trouver : une ligne de cases par mot, rangés par longueur puis alphabet, répartis en 1 à 4
 * colonnes selon la place (cases les plus grandes possibles). Mot trouvé = vert ; lettres dévoilées (indice, ou
 * première lettre en niveau facile) = bleu ; case vide = gris.
 */
export function SlotsCanvas({ mots, trouves, reveles, premiere }) {
  const [refBoite, largeur] = useLargeur();
  const refCanvas = useRef(null);
  const W = Math.max(200, largeur || 300);
  const gap = 14, esp = 2;
  const maxLong = Math.max(...mots.map((m) => m.length));
  // répartition en colonnes : on privilégie une grille COMPACTE (le cercle doit rester à l'écran) tant que les cases
  // restent confortables (≥ 20 px) ; sinon, les cases les plus grandes possibles. (Seuil 17 px : ces cases ne se touchent pas.)
  const candidats = [];
  for (let cols = 1; cols <= 4; cols++) {
    const parCol = Math.ceil(mots.length / cols);
    const colonnes = Array.from({ length: cols }, (_, c) => mots.slice(c * parCol, (c + 1) * parCol)).filter((c) => c.length);
    for (let cs = 30; cs >= 14; cs--) {
      const w = colonnes.reduce((s, c) => s + Math.max(...c.map((m) => m.length)) * (cs + esp), 0) + (colonnes.length - 1) * gap;
      if (w <= W) { candidats.push({ colonnes, cs, h: parCol * (cs + 4), w }); break; }
    }
  }
  const confortables = candidats.filter((c) => c.cs >= 17);
  const meilleur = confortables.length
    ? confortables.reduce((a, b) => (b.h < a.h || (b.h === a.h && b.cs > a.cs) ? b : a))
    : candidats.reduce((a, b) => (b.cs > a.cs ? b : a), candidats[0] || null);
  const { colonnes, cs, h: H, w: Wu } = meilleur || { colonnes: [mots], cs: 14, h: mots.length * 18, w: maxLong * 16 };
  useEffect(() => {
    const canvas = refCanvas.current;
    if (!canvas) return;
    const ctx = preparer(canvas, W, H + 4);
    ctx.clearRect(0, 0, W, H + 4);
    let x0 = Math.max(0, (W - Wu) / 2);
    for (const col of colonnes) {
      const lc = Math.max(...col.map((m) => m.length));
      col.forEach((mot, r) => {
        const y = r * (cs + 4) + 2, ok = trouves.has(mot), n = reveles[mot] ?? (premiere ? 1 : 0);
        for (let i = 0; i < mot.length; i++) {
          const x = x0 + i * (cs + esp);
          const montre = ok || i < n;
          ctx.fillStyle = ok ? "#2e9e6b" : montre ? "#4857d9" : "rgba(110,124,138,0.88)";
          ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, cs, cs, 4) : ctx.rect(x, y, cs, cs); ctx.fill();
          if (montre) {
            ctx.fillStyle = "#fff"; ctx.font = `700 ${cs * 0.62}px ${POLICE}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(mot[i], x + cs / 2, y + cs / 2 + 1);
          }
        }
      });
      x0 += lc * (cs + esp) + gap;
    }
  }, [mots, trouves, reveles, premiere, W, H, cs, Wu, colonnes]);
  return (
    <div ref={refBoite} style={{ position: "relative", width: "100%", minWidth: 0, height: H + 4, overflow: "hidden" }}>
      <canvas ref={refCanvas} role="img" aria-label={`${mots.length} mots à trouver, ${trouves.size} trouvés`} style={{ position: "absolute", left: 0, top: 0 }} />
    </div>
  );
}

/**
 * Cercle de lettres : on pose le doigt sur une lettre et on glisse de lettre en lettre ; relâcher valide le mot.
 * Revenir sur l'avant-dernière lettre annule la dernière. `apercu` (mot en cours) est dessiné au-dessus du cercle.
 */
export function RoueCanvas({ lettres, chemin, apercu, message, onChemin, onValider }) {
  const [refBoite, largeur] = useLargeur();
  const refCanvas = useRef(null);
  const cheminRef = useRef(chemin);
  cheminRef.current = chemin;
  const glisse = useRef(false);
  const HAUT = 40;
  // Taille du cercle : la place RESTANTE à l'écran sous la grille (le cercle et les boutons doivent tenir sans défiler), entre
  // 170 et 290 px. Mesurée à partir de la position du cadre dans son conteneur défilant ; remesurée au redimensionnement.
  const [dispo, setDispo] = useState(290);
  useEffect(() => {
    const mesurer = () => {
      const el = refBoite.current;
      if (!el) return;
      let sp = el.parentElement;
      while (sp && !/(auto|scroll)/.test(getComputedStyle(sp).overflowY)) sp = sp.parentElement;
      const haut = el.getBoundingClientRect().top + (sp ? sp.scrollTop : window.scrollY);
      const vh = window.visualViewport?.height || window.innerHeight;
      setDispo(Math.max(170, Math.min(290, Math.floor(vh - haut - HAUT - 58))));
    };
    mesurer();
    window.addEventListener("resize", mesurer);
    const t = setTimeout(mesurer, 250); // après le premier rendu de la grille
    return () => { window.removeEventListener("resize", mesurer); clearTimeout(t); };
  }, [lettres, largeur]); // eslint-disable-line react-hooks/exhaustive-deps
  const S = Math.max(170, Math.min(largeur || 300, dispo)), H = S + HAUT;
  const cx = S / 2, cy = HAUT + S / 2, nr = S * 0.105, R = S / 2 - nr - 8;
  const pos = lettres.map((_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / lettres.length; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
  useEffect(() => {
    const canvas = refCanvas.current;
    if (!canvas) return;
    const ctx = preparer(canvas, S, H);
    ctx.clearRect(0, 0, S, H);
    if (apercu) {
      ctx.font = `700 20px ${POLICE}`; const w = Math.max(40, ctx.measureText(apercu).width + 28);
      ctx.fillStyle = "#1d2733"; ctx.beginPath(); ctx.roundRect ? ctx.roundRect((S - w) / 2, 4, w, 32, 16) : ctx.rect((S - w) / 2, 4, w, 32); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(apercu, S / 2, 21);
    } else if (message) {
      ctx.font = `700 15px ${POLICE}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = message.ton === "ok" ? "#2e9e6b" : message.ton === "non" ? "#e0594a" : "#9aa7b4";
      ctx.fillText(message.texte, S / 2, 21, S - 8);
    }
    ctx.fillStyle = "#2a3441"; ctx.beginPath(); ctx.arc(cx, cy, S / 2 - 2, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = "#4b5a6b"; ctx.lineWidth = 2; ctx.stroke();
    if (chemin.length > 1) {
      ctx.strokeStyle = "rgba(242,201,76,0.85)"; ctx.lineWidth = nr * 0.38; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); chemin.forEach((k, i) => (i ? ctx.lineTo(pos[k][0], pos[k][1]) : ctx.moveTo(pos[k][0], pos[k][1]))); ctx.stroke();
    }
    lettres.forEach((l, i) => {
      const sel = chemin.includes(i);
      if (sel) { ctx.fillStyle = "#f2c94c"; ctx.beginPath(); ctx.arc(pos[i][0], pos[i][1], nr, 0, 2 * Math.PI); ctx.fill(); }
      ctx.fillStyle = sel ? "#1b1b1b" : "#fff"; ctx.font = `700 ${nr * 1.25}px ${POLICE}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(l, pos[i][0], pos[i][1] + 1);
    });
  }, [lettres, chemin, apercu, message, S, H, nr, cx, cy, R]); // eslint-disable-line react-hooks/exhaustive-deps
  const toucher = (e) => {
    const rect = refCanvas.current.getBoundingClientRect(), k = rect.width / S;
    const x = (e.clientX - rect.left) / k, y = (e.clientY - rect.top) / k;
    let best = -1, bd = nr * 1.15;
    pos.forEach(([px, py], i) => { const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  const avancer = (e) => {
    const i = toucher(e), c = cheminRef.current;
    if (i < 0) return;
    if (c.length >= 2 && c[c.length - 2] === i) onChemin(c.slice(0, -1));
    else if (!c.includes(i)) onChemin([...c, i]);
  };
  const debut = (e) => { if (toucher(e) < 0) return; glisse.current = true; refCanvas.current.setPointerCapture?.(e.pointerId); onChemin([]); cheminRef.current = []; avancer(e); };
  const fin = () => { if (!glisse.current) return; glisse.current = false; const c = cheminRef.current; onChemin([]); if (c.length) onValider(c); };
  return (
    <div ref={refBoite} style={{ position: "relative", width: "100%", maxWidth: 290, minWidth: 0, height: H, margin: "0 auto", overflow: "hidden" }}>
      <canvas ref={refCanvas} role="img" aria-label={`Cercle de lettres : ${lettres.join(", ")}`}
        onPointerDown={debut} onPointerMove={(e) => glisse.current && avancer(e)} onPointerUp={fin} onPointerCancel={fin}
        style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 0, touchAction: "none", cursor: "pointer" }} />
    </div>
  );
}
