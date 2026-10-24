/**
 * CURSUS — Pauses « bouger » (24/10/2026), idée de Joseph : quand on écrit longtemps on ne voit pas le temps passer ; Cursus propose
 * une courte pause avec des mouvements doux (inspirés du tai chi sur chaise). Module PUR : réglages (localStorage, par appareil),
 * compteur de pauses, règles du minuteur. Aucun appel serveur, aucune donnée de santé envoyée nulle part.
 */

const CLE = "cursus-pause-bouger-v1";
export const DEFAUT = { actif: true, minutes: 30 };
export const CHOIX_MINUTES = [20, 30, 45, 60];

export const aujourdhui = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-JJ, heure locale

export function lireReglages() {
  try {
    const j = JSON.parse(localStorage.getItem(CLE) || "{}");
    return { ...DEFAUT, ...j, jours: j.jours && typeof j.jours === "object" ? j.jours : {} };
  } catch { return { ...DEFAUT, jours: {} }; }
}
export function ecrireReglages(patch) {
  const r = { ...lireReglages(), ...patch };
  try { localStorage.setItem(CLE, JSON.stringify(r)); } catch { /* stockage indisponible : réglages valables pour la session seulement */ }
  try { window.dispatchEvent(new Event("cursus-pause-reglages")); } catch { /* hors navigateur */ }
  return r;
}
/** +1 pause terminée aujourd'hui ; on ne garde que les 60 derniers jours. */
export function noterPause() {
  const r = lireReglages(), jours = { ...r.jours }, j = aujourdhui();
  jours[j] = (jours[j] || 0) + 1;
  const gardes = Object.keys(jours).sort().slice(-60);
  return ecrireReglages({ jours: Object.fromEntries(gardes.map((k) => [k, jours[k]])) });
}
export const pausesDuJour = (r) => r.jours[aujourdhui()] || 0;
export function pausesSurSemaine(r) {
  let n = 0; const d = new Date();
  for (let i = 0; i < 7; i++) { n += r.jours[new Date(d.getTime() - i * 86400000).toLocaleDateString("sv-SE")] || 0; d.setHours(d.getHours()); }
  return n;
}

// ─── Règles du minuteur (pures, testées à part) ───────────────────────────────

export const SEUIL_COMPTE = 120;  // s sans geste au-delà desquelles le temps ne compte plus (lecture, réflexion : on ne sait pas)
export const SEUIL_PAUSE = 300;   // s sans geste = pause réelle, le compteur repart de zéro
export const CALME_AVANT_INVITATION = 5; // s sans geste : on n'interrompt pas une phrase en cours

/** Une seconde de plus : `idleSec` = temps depuis le dernier geste, `visible` = onglet visible. */
export function avancer(actifSec, idleSec, visible) {
  if (!visible) return actifSec;
  if (idleSec >= SEUIL_PAUSE) return 0;
  if (idleSec < SEUIL_COMPTE) return actifSec + 1;
  return actifSec;
}
/** Faut-il proposer une pause maintenant ? Au bon moment (un silence), sauf si on dépasse de 5 minutes l'échéance. */
export function doitInviter({ actifSec, idleSec, minutes, snoozeJusqua = 0, maintenant = Date.now() }) {
  if (actifSec < minutes * 60 || maintenant < snoozeJusqua) return false;
  return idleSec >= CALME_AVANT_INVITATION || actifSec >= (minutes + 5) * 60;
}
