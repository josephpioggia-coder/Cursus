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

// Retourne { valide: true, nomSlug, palier, remisePourcent, dureeMois } ou { valide: false }
export async function verifierCodePromo(code, secret) {
  const parties = (code || "").trim().toUpperCase().split("-");
  if (parties.length !== 2) return { valide: false };
  const [payload, signatureFournie] = parties;
  if (payload.length < 7) return { valide: false };

  const signatureAttendue = await signer(payload, secret);
  if (signatureFournie !== signatureAttendue) return { valide: false };

  const duree2 = payload.slice(-2);
  const remise3 = payload.slice(-5, -2);
  const palierLettre = payload.slice(-6, -5);
  const nomSlug = payload.slice(0, -6);

  const palierInverse = Object.entries(PALIERS).find(([, l]) => l === palierLettre)?.[0] || "tous";

  return {
    valide: true,
    nomSlug,
    palier: palierInverse,
    remisePourcent: parseInt(remise3, 10),
    dureeMois: parseInt(duree2, 10),
  };
}

