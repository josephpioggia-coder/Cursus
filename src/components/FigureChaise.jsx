/**
 * CURSUS — Figure animée d'un exercice de pause (24/10/2026) : un personnage simple, assis sur une chaise (ou debout), dessiné sur
 * <canvas> (donc insensible au mode sombre forcé des navigateurs mobiles) et animé à partir des images clés de l'exercice
 * (src/lib/exercicesPause.js). Dessin 100 % original : aucun schéma externe repris. Respecte « réduire les animations ».
 */
import { useEffect, useRef } from "react";
import { BASE_POSE } from "../lib/exercicesPause.js";

const W = 240, H = 232;
const mix = (a, b, t) => a + (b - a) * t;
const doux = (t) => t * t * (3 - 2 * t);

/** Pose interpolée à l'instant `t` (secondes) : les images clés défilent en boucle, `pas` secondes par transition. */
export function poseA(kfs, pas, t) {
  const n = kfs.length, k = (t / pas) % n, i = Math.floor(k), u = doux(k - i);
  const a = { ...BASE_POSE, ...kfs[i % n] }, b = { ...BASE_POSE, ...kfs[(i + 1) % n] };
  const bras = (x, y) => [mix(x[0], y[0], u), mix(x[1], y[1], u)];
  return { tete: mix(a.tete, b.tete, u), epaules: mix(a.epaules, b.epaules, u), torsion: mix(a.torsion, b.torsion, u), g: bras(a.g, b.g), d: bras(a.d, b.d),
    pg: mix(a.pg, b.pg, u), pd: mix(a.pd, b.pd, u), poignet: mix(a.poignet, b.poignet, u), debout: a.debout };
}

export function dessiner(ctx, p) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#e9f2ee"; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, 0, W, H, 16) : ctx.rect(0, 0, W, H); ctx.fill();
  const sol = 214, cx = W / 2, haut = p.debout ? -22 : 0, hanche = p.debout ? 130 : 148;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = "#9bb3a8"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(14, sol + 4); ctx.lineTo(W - 14, sol + 4); ctx.stroke();
  if (!p.debout) { // chaise : dossier derrière le buste, assise, pieds
    ctx.fillStyle = "rgba(176,138,90,0.35)"; ctx.fillRect(cx - 40, 84, 80, 66);
    ctx.fillStyle = "#b08a5a"; ctx.fillRect(cx - 52, 152, 104, 9);
    ctx.strokeStyle = "#b08a5a"; ctx.lineWidth = 6;
    [[-46, 161], [46, 161]].forEach(([dx]) => { ctx.beginPath(); ctx.moveTo(cx + dx, 161); ctx.lineTo(cx + dx, sol + 3); ctx.stroke(); });
  }
  // jambes
  ctx.strokeStyle = "#34495e"; ctx.lineWidth = 9;
  [-1, 1].forEach((s) => {
    const lev = (s < 0 ? p.pg : p.pd) * 18;
    ctx.beginPath();
    if (p.debout) { ctx.moveTo(cx + s * 12, hanche); ctx.lineTo(cx + s * 14, sol - 6); }
    else { ctx.moveTo(cx + s * 14, hanche + 4); ctx.lineTo(cx + s * 26, 160); ctx.lineTo(cx + s * 28, sol - 8 - lev); }
    ctx.stroke();
    ctx.fillStyle = "#34495e"; ctx.beginPath(); ctx.ellipse(cx + s * (p.debout ? 18 : 33), sol - 3 - lev, 13, 6, 0, 0, 7); ctx.fill();
  });
  // buste (torsion = épaules plus étroites et décalées)
  const larg = 30 * (1 - 0.32 * Math.abs(p.torsion)), dec = p.torsion * 7, ey = 90 + haut - p.epaules * 9, cou = [cx + dec * 0.6, 80 + haut - p.epaules * 4];
  ctx.strokeStyle = "#1D9E75"; ctx.lineWidth = 22;
  ctx.beginPath(); ctx.moveTo(cx + dec * 0.4, ey + 4); ctx.lineTo(cx, hanche); ctx.stroke();
  ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(cx + dec - larg, ey); ctx.lineTo(cx + dec + larg, ey); ctx.stroke();
  // bras : angle 0 = vers le bas, croît vers l'extérieur puis le haut ; le bras de gauche est le miroir
  ctx.strokeStyle = "#2b3a4a"; ctx.lineWidth = 8;
  const rad = (d) => (d * Math.PI) / 180;
  [[-1, p.g], [1, p.d]].forEach(([s, [a, f]]) => {
    const sx = cx + dec + s * larg, sy = ey, ex = sx + s * 38 * Math.sin(rad(a)), eyy = sy + 38 * Math.cos(rad(a));
    const mx = ex + s * 34 * Math.sin(rad(f)), my = eyy + 34 * Math.cos(rad(f));
    const jx = p.poignet ? 4 * Math.cos(p.poignet) : 0, jy = p.poignet ? 4 * Math.sin(p.poignet) : 0;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, eyy); ctx.lineTo(mx, my); ctx.stroke();
    ctx.fillStyle = "#f2cfa8"; ctx.beginPath(); ctx.arc(mx + jx, my + jy, 7, 0, 7); ctx.fill();
  });
  // tête (inclinaison autour de la base du cou, regard décalé avec la torsion)
  const hx = cou[0] + Math.sin(p.tete) * 24 + p.torsion * 6, hy = cou[1] - Math.cos(p.tete) * 24;
  ctx.strokeStyle = "#2b3a4a"; ctx.lineWidth = 3; ctx.fillStyle = "#f6dcc0";
  ctx.beginPath(); ctx.arc(hx, hy, 17, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#2b3a4a"; ctx.beginPath(); ctx.arc(hx - 6 + p.torsion * 5 + p.tete * 3, hy - 2, 2, 0, 7); ctx.arc(hx + 6 + p.torsion * 5 + p.tete * 3, hy - 2, 2, 0, 7); ctx.fill();
  ctx.strokeStyle = "#2b3a4a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx + p.torsion * 5 + p.tete * 3, hy + 3, 6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
}

export default function FigureChaise({ pose, pas = 2.2 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const calme = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (calme) { dessiner(ctx, poseA(pose, pas, pas * 0.5)); return; }
    let raf, t0 = performance.now();
    const boucle = (now) => { dessiner(ctx, poseA(pose, pas, (now - t0) / 1000)); raf = requestAnimationFrame(boucle); };
    raf = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(raf);
  }, [pose, pas]);
  return <canvas ref={ref} role="img" aria-label="Démonstration du mouvement" style={{ width: "100%", maxWidth: W, height: "auto", aspectRatio: `${W} / ${H}`, display: "block", margin: "0 auto", borderRadius: 16 }} />;
}
