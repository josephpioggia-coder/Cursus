/**
 * CURSUS — Copie de sécurité LOCALE du texte d'un chapitre (03/11/2026).
 * Incident : une heure de travail perdue après un rechargement (Ctrl+F5) — l'enregistrement en base n'avait pas abouti sans que rien ne le signale.
 * Chaque modification est aussi écrite sur l'appareil (localStorage) ; la copie n'est supprimée que lorsque la base a CONFIRMÉ le même texte.
 * Au rechargement, une copie qui diffère du texte de la base est proposée à la récupération.
 */
const PREFIXE = "cursus-brouillon-v1:";

export function ecrireBrouillon(nœudId, html) {
  try { localStorage.setItem(PREFIXE + nœudId, JSON.stringify({ html, le: Date.now() })); } catch { /* stockage plein ou indisponible */ }
}
export function lireBrouillon(nœudId) {
  try { const b = JSON.parse(localStorage.getItem(PREFIXE + nœudId) || "null"); return b && typeof b.html === "string" ? b : null; } catch { return null; }
}
/** Efface la copie SI elle correspond au texte que la base vient de confirmer (un texte plus récent écrit entre-temps est conservé). */
export function confirmerBrouillon(nœudId, htmlConfirme) {
  try { const b = lireBrouillon(nœudId); if (b && b.html === htmlConfirme) localStorage.removeItem(PREFIXE + nœudId); } catch { /* rien */ }
}
export function oublierBrouillon(nœudId) { try { localStorage.removeItem(PREFIXE + nœudId); } catch { /* rien */ } }
