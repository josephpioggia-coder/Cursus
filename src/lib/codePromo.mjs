/**
 * CURSUS — Codes promotionnels sécurisés (60803-02)
 * ====================================================
 * Un code promo lisible ("dérivé" du nom du client, du palier, de la
 * remise et de la durée), mais INCOPIABLE : une signature HMAC-SHA256
 * calculée à partir d'une clé secrète est accolée au code. Sans connaître
 * cette clé, impossible de fabriquer un code qui passe la vérification —
 * même en observant plusieurs vrais codes, le format visible ne suffit
 * pas à en déduire la signature d'un nouveau code.
 *
 * Aucune base de données requise pour la validation elle-même (le code
 * se vérifie lui-même) — utilisable à la fois par le script de
 * génération (Node, côté Joseph) et par l'Edge Function de vérification
 * (Deno, côté serveur), Web Crypto (crypto.subtle) étant natif aux deux.
 */

const PALIERS = { decouverte: "D", essentiel: "E", initie: "I", auteur: "A", studio: "S", tous: "X" };
const LONGUEUR_SIGNATURE = 10; // caractères hex (~40 bits) — largement suffisant contre la copie/le forgeage commercial

function slugifierNom(nom) {
  return (nom || "CLIENT")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "CLIENT";
}

async function signer(payload, secret) {
  const encodeur = new TextEncoder();
  const clé = await crypto.subtle.importKey(
    "raw", encodeur.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", clé, encodeur.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((o) => o.toString(16).padStart(2, "0")).join("")
    .slice(0, LONGUEUR_SIGNATURE).toUpperCase();
}

// remisePourcent : 5 à 100. dureeMois : 0 = usage unique (once côté
// Stripe), 1 à 98 = remise répétée N mois, 99 = à vie (forever).
export async function genererCodePromo({ nomClient, palier, remisePourcent, dureeMois }, secret) {
  const nomSlug = slugifierNom(nomClient);
  const palierLettre = PALIERS[palier] || "X";
  const remise3 = String(Math.max(5, Math.min(100, remisePourcent))).padStart(3, "0");
  const duree2 = String(Math.max(0, Math.min(99, dureeMois))).padStart(2, "0");
  const payload = `${nomSlug}${palierLettre}${remise3}${duree2}`;
  const signature = await signer(payload, secret);
  return `${payload}-${signature}`;
}

// NEUTRALISÉE (60804-02) — l'ancien système auto-vérifiant par signature
// est remplacé par la table Supabase `codes_promo` : la vraie règle vit en
// base, jamais dans le texte du code. La vérification réelle se fait
// désormais côté serveur dans creer-session-checkout, par lecture directe
// de cette table (actif / dates / palier / email / limite), et la
// consommation atomique dans stripe-webhook via la fonction Postgres
// consommer_code_promo(). Cette fonction reste ici, désactivée, pour
// qu'aucun code applicatif ne puisse par erreur s'y fier comme source de
// vérité concurrente — elle ne doit plus jamais être appelée.
export async function verifierCodePromo() {
  return { valide: false };
}

