/**
 * CURSUS — Lecture à voix haute "pro" (01/10/2026, réécriture)
 * ======================================================================
 * Remplace la première version (window.speechSynthesis natif du
 * navigateur) — retour direct de Joseph : "la voix choisie est vraiment
 * nulle il faut quelque chose d'humain avec choix de voix de rapidité,
 * ... un outil pro". Appelle maintenant l'Edge Function `lire-texte`
 * (gpt-4o-mini-tts d'OpenAI, déjà utilisé pour la dictée vocale —
 * aucun nouveau compte/service), qui renvoie du vrai audio (mp3) joué
 * via un <audio> HTML plutôt que l'API de synthèse du navigateur.
 *
 * Écart assumé : contrairement à la V1 (gratuite, offline), chaque
 * lecture a un coût réel (facturation OpenAI) — réservée aux comptes
 * avec un abonnement actif (vérifié côté serveur). Pas de repli
 * automatique et silencieux vers la voix du navigateur en cas d'échec
 * (quota, réseau...) : Joseph voulait explicitement s'éloigner de cette
 * voix-là, la réactiver en douce en cas d'erreur aurait été trompeur.
 * L'appelant (ex. Editeur.jsx) reçoit un message d'erreur clair via
 * `onErreur` et affiche ce qu'il veut.
 *
 * Découpage en tranches ≤ 4096 caractères (limite dure d'OpenAI pour
 * /v1/audio/speech) côté client plutôt que côté serveur : permet
 * d'enchaîner les tranches d'un chapitre entier, et d'arrêter/mettre en
 * pause au milieu sans logique de session à maintenir côté serveur.
 */

import { supabase } from "./supabase.js";

const EDGE_FUNCTION_URL = "https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/lire-texte";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Doit rester synchronisé avec VOIX_AUTORISEES côté serveur
// (supabase/functions/lire-texte/index.ts) — sous-ensemble des 11 voix de
// gpt-4o-mini-tts jugé le plus adapté à de la lecture longue.
export const VOIX_DISPONIBLES = [
  { id: "nova", label: "Nova (féminine)" },
  { id: "shimmer", label: "Shimmer (féminine, douce)" },
  { id: "onyx", label: "Onyx (masculine, grave)" },
  { id: "echo", label: "Echo (masculine)" },
  { id: "fable", label: "Fable (narrative)" },
  { id: "sage", label: "Sage (posée)" },
  { id: "alloy", label: "Alloy (neutre)" },
];

export const VITESSES_DISPONIBLES = [0.75, 1, 1.25, 1.5, 2];

// CORRECTIF 01/10/2026 — signalé en usage réel : "presqu'une minute" avant
// que la lecture ne démarre, et parfois rien ne se lance du tout. Cause du
// premier point : une tranche de ~3800 caractères (plusieurs minutes de
// parole) prend réellement ce temps-là à générer entièrement côté OpenAI
// AVANT que le moindre son ne puisse être renvoyé — ce n'est pas un bug
// réseau, `gpt-4o-mini-tts` ne renvoie l'audio qu'une fois la synthèse
// complète. Tranches bien plus courtes désormais (≈ 20-30s de parole) pour
// un premier son rapide, combinées à un PRÉCHARGEMENT de la tranche
// suivante pendant la lecture de la courante (voir `lire()`) pour que les
// tranches 2+ n'introduisent plus aucun silence audible.
const TAILLE_MAX_TRANCHE = 700;

// Découpe par paragraphes puis, si besoin, par phrases — pour que chaque
// tranche s'arrête sur une frontière naturelle (silence audible propre)
// plutôt qu'en plein milieu d'un mot ou d'une phrase.
function découperTexteTTS(texte, tailleMax = TAILLE_MAX_TRANCHE) {
  const paragraphes = texte.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const tranches = [];
  let courant = "";
  for (const p of paragraphes) {
    const morceaux = p.length > tailleMax ? (p.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [p]) : [p];
    for (const m of morceaux) {
      const candidat = courant ? `${courant}\n${m}` : m;
      if (candidat.length > tailleMax && courant) {
        tranches.push(courant.trim());
        courant = m;
      } else {
        courant = candidat;
      }
    }
  }
  if (courant.trim()) tranches.push(courant.trim());
  return tranches;
}

let élémentAudio = null;
function obtenirÉlémentAudio() {
  if (!élémentAudio) {
    élémentAudio = new Audio();
    élémentAudio.preload = "auto";
  }
  return élémentAudio;
}

let urlObjetCourante = null;
function libérerURL() {
  if (urlObjetCourante) {
    URL.revokeObjectURL(urlObjetCourante);
    urlObjetCourante = null;
  }
}

// Incrémenté à chaque lire()/arrêterLecture() : une requête ou un callback
// `.then()` encore en vol d'une lecture précédente se reconnaît périmé en
// comparant son `maSession` capturé à cette valeur, et ne touche plus à
// l'<audio> partagé ni n'appelle les callbacks de la lecture abandonnée.
let sessionId = 0;
let fileAttente = [];

async function récupérerAudioTranche(texte, voix, vitesse) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Session expirée — reconnectez-vous.");

  const réponse = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ texte, voix, vitesse }),
  });

  if (!réponse.ok) {
    let message = `Erreur serveur (HTTP ${réponse.status}).`;
    try {
      const détail = await réponse.json();
      message = détail?.message || détail?.error || message;
    } catch { /* corps non-JSON (ne devrait pas arriver sur une erreur) */ }
    throw new Error(message);
  }
  return réponse.blob();
}

/**
 * Lit `texte` à voix haute. Options :
 *  - voix : un id de VOIX_DISPONIBLES (défaut "nova")
 *  - vitesse : 0.25 à 4 (défaut 1)
 *  - onDébut() : la lecture démarre réellement (première tranche prête)
 *  - onTranche(i, total) : avant la récupération de la tranche i/total
 *    (permet d'afficher "Préparation 2/5…" pour un texte long)
 *  - onFin() : toutes les tranches ont été lues jusqu'au bout
 *  - onErreur(message) : échec (réseau, quota, abonnement...) — la
 *    lecture s'arrête, AUCUN repli silencieux vers une autre voix
 */
export async function lire(texte, { voix = "nova", vitesse = 1, onDébut, onTranche, onFin, onErreur } = {}) {
  arrêterLecture();
  const tranches = découperTexteTTS(texte);
  if (!tranches.length) return;

  const maSession = ++sessionId;
  fileAttente = tranches;
  const audio = obtenirÉlémentAudio();

  // Cache des récupérations en cours/terminées, par position dans
  // `fileAttente` — `assurerRécupération(i+1)` est lancée dès que la
  // tranche i commence à jouer (pas quand elle se termine), pour que la
  // tranche suivante soit déjà prête (ou bien avancée) au moment où
  // `onended` se déclenche. Masque la latence de génération pour toutes
  // les tranches sauf la première.
  const promesses = new Map();
  const assurerRécupération = (i) => {
    if (i >= fileAttente.length) return null;
    if (!promesses.has(i)) {
      onTranche?.(i + 1, fileAttente.length);
      promesses.set(i, récupérerAudioTranche(fileAttente[i], voix, vitesse));
    }
    return promesses.get(i);
  };

  const jouerTranche = async (i) => {
    if (maSession !== sessionId) return;
    if (i >= fileAttente.length) { onFin?.(); return; }
    try {
      const blob = await assurerRécupération(i);
      if (maSession !== sessionId || !blob) return;
      libérerURL();
      urlObjetCourante = URL.createObjectURL(blob);
      audio.src = urlObjetCourante;
      audio.onended = () => jouerTranche(i + 1);
      await audio.play();
      if (i === 0) onDébut?.();
      assurerRécupération(i + 1); // précharge la suivante PENDANT la lecture de celle-ci
    } catch (err) {
      if (maSession === sessionId) onErreur?.(err.message);
    }
  };

  jouerTranche(0);
}

export function basculerPause() {
  const audio = obtenirÉlémentAudio();
  if (!audio.src) return;
  if (audio.paused) audio.play(); else audio.pause();
}

export function arrêterLecture() {
  sessionId++; // périme toute tranche en cours de récupération/lecture
  fileAttente = [];
  if (élémentAudio) {
    élémentAudio.pause();
    élémentAudio.onended = null;
    élémentAudio.removeAttribute("src");
  }
  libérerURL();
}

export function voixDisponible() {
  return true; // lecture côté serveur, ne dépend plus du navigateur
}
