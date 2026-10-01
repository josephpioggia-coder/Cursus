/**
 * CURSUS — Lecture à voix haute (01/10/2026)
 * ======================================================================
 * Demande de Joseph : pouvoir faire lire à voix haute le texte choisi
 * dans CursEdit, "ou peut-être partout ailleurs où on le désire" — ce
 * module expose donc des fonctions indépendantes de l'UI (pas de
 * composant bouton imposé), réutilisables depuis n'importe quelle page.
 *
 * Web Speech API du navigateur (window.speechSynthesis) plutôt qu'un
 * service cloud (ElevenLabs, Google TTS...) : gratuite, aucune clé API,
 * aucun déploiement de fonction Supabase, fonctionne même hors-ligne.
 * Contrepartie assumée : la voix dépend du navigateur/OS de la
 * personne, pas de Cursus — qualité variable (Chrome/Edge ont en
 * général de meilleures voix françaises que Firefox).
 */

export function voixDisponible() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function meilleureVoixFrançaise() {
  const voix = window.speechSynthesis.getVoices();
  return voix.find((v) => v.lang?.toLowerCase().startsWith("fr")) || voix[0] || null;
}

// `getVoices()` revient parfois vide au tout premier appel (chargement
// asynchrone selon les navigateurs) — sans incidence bloquante ici
// puisque `u.lang = "fr-FR"` suffit à obtenir une voix par défaut
// correcte même si aucune voix explicite n'est trouvée.
export function lire(texte, { onDébut, onFin, débit = 1 } = {}) {
  if (!voixDisponible() || !texte?.trim()) return;
  arrêterLecture();
  const u = new SpeechSynthesisUtterance(texte);
  const voix = meilleureVoixFrançaise();
  if (voix) u.voice = voix;
  u.lang = voix?.lang || "fr-FR";
  u.rate = débit;
  if (onDébut) u.onstart = onDébut;
  u.onend = () => onFin?.();
  u.onerror = () => onFin?.();
  window.speechSynthesis.speak(u);
}

export function enPause() {
  return voixDisponible() && window.speechSynthesis.paused;
}

export function enCours() {
  return voixDisponible() && window.speechSynthesis.speaking;
}

export function basculerPause() {
  if (!voixDisponible()) return;
  if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
    window.speechSynthesis.pause();
  } else if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
}

export function arrêterLecture() {
  if (voixDisponible()) window.speechSynthesis.cancel();
}
