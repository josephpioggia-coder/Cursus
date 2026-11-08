#!/usr/bin/env node
/**
 * Jeu d'essai de robustesse des outils IA de Cursus face aux erreurs d'entrée (07/11/2026).
 *
 * Pourquoi : un texte dicté ou saisi vite contient des noms qui varient, des homophones, de la ponctuation dictée,
 * mais aussi des faits VOULUS qui paraissent faux. Ce script mesure, sur un petit corpus fixe, si les outils
 *   (Correction rapide, Bilan de relecture, Avis sur le fond)
 * gardent le bon comportement : ne jamais changer un nom ni un fait voulu, ne rien inventer, signaler l'incertitude.
 * Utile surtout à CHAQUE CHANGEMENT DE MODÈLE (registre modeles_ia) : relancer et comparer.
 *
 * Deux modes :
 *   node scripts/evaluer-robustesse-ia.mjs                 (hors ligne, sans clé)
 *       Valide le DISPOSITIF : la réponse de référence « bonne » de chaque cas doit passer toutes les vérifications,
 *       la « mauvaise » doit en échouer au moins une. Ne teste pas d'IA.
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/evaluer-robustesse-ia.mjs --en-ligne [--modele=claude-sonnet-5-5] [--repetitions=3] [--cas=id1,id2]
 *       Appelle réellement le modèle avec les VRAIES consignes de l'application (coût : quelques centimes), applique les
 *       garde-fous de l'application aux réponses, puis les vérifications. Sortie : tableau + fichier JSON dans
 *       scripts/essais-ia/resultats/ (ignoré par git) pour comparer deux modèles.
 *
 * Code de sortie : 1 si une vérification GRAVE échoue (hors ligne : si le dispositif est invalide), 0 sinon.
 * Les vérifications « souhaitables » échouées sont rapportées mais ne font pas échouer le script.
 */
import { build } from "esbuild";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (nom, défaut) => (args.find((a) => a.startsWith(`--${nom}=`)) || "").split("=").slice(1).join("=") || défaut;
const enLigne = args.includes("--en-ligne");

// ─── Chargement des moteurs de l'application (esbuild, sans toucher au réseau ni à Supabase) ───
async function chargerMoteurs() {
  const dossier = await mkdtemp(join(tmpdir(), "cursus-essai-"));
  const sortie = join(dossier, "moteurs.mjs");
  await build({
    entryPoints: [join(racine, "scripts/essais-ia/moteurs.js")],
    outfile: sortie, bundle: true, format: "esm", platform: "node", logLevel: "error",
    // supabase.js lit import.meta.env au chargement ; aucune requête n'est faite par ce script.
    define: { "import.meta.env": JSON.stringify({ VITE_SUPABASE_URL: "https://essai.supabase.co", VITE_SUPABASE_ANON_KEY: "essai" }) },
  });
  const m = await import(pathToFileURL(sortie).href);
  await rm(dossier, { recursive: true, force: true });
  return m;
}

// ─── Réponse brute → sortie comparable, avec les garde-fous de l'application ───
function sortieDe(cas, brut, M) {
  const problèmesFormat = [];
  let texte = "";
  if (cas.outil === "correction") {
    const { corriges } = M.analyserReponse(brut);
    const lignes = cas.paragraphes.map((original, i) => {
      const c = corriges.get(i + 1);
      if (c === undefined) { problèmesFormat.push(`paragraphe ${i + 1} absent de la réponse`); return original; }
      // Mêmes garde-fous que corrigerTout() : longueur plausible, puis retrait des changements de pure typographie.
      return M.validerParagraphe(original, c) ? M.sansChangementsDeStyle(original, c) : original;
    });
    texte = lignes.join("\n");
  } else if (cas.outil === "bilan") {
    const b = M.analyserBilan(brut);
    const n = Object.values(b).reduce((s, l) => s + l.length, 0);
    if (!n && !/\[\[RIEN\]\]/.test(brut)) problèmesFormat.push("aucune rubrique reconnue");
    texte = Object.entries(b).map(([r, l]) => l.map((x) => `${r}: ${x}`).join("\n")).filter(Boolean).join("\n");
  } else if (cas.outil === "avis") {
    const a = M.analyserAvis(brut);
    if (!a.verdict) problèmesFormat.push("VERDICT absent");
    texte = [a.verdict, ...["TIENT", "FAIBLE", "PISTES", "QUESTIONS"].flatMap((r) => a[r])].join("\n");
  } else {
    throw new Error(`outil inconnu : ${cas.outil}`);
  }
  return { texte, problèmesFormat };
}

// ─── Vérifications mécaniques ───
function verifier(sortie, cas) {
  const résultats = [];
  const norm = (s, ignorerCasse) => (ignorerCasse ? s.toLowerCase() : s);
  for (const v of cas.verifications) {
    const t = norm(sortie.texte, v.ignorerCasse);
    const vals = v.valeurs.map((x) => norm(x, v.ignorerCasse));
    let ok;
    if (v.type === "contient") ok = vals.every((x) => t.includes(x));
    else if (v.type === "ne_contient_pas") ok = vals.every((x) => !t.includes(x));
    else if (v.type === "contient_une_parmi") ok = vals.some((x) => t.includes(x));
    else throw new Error(`type de vérification inconnu : ${v.type}`);
    résultats.push({ id: v.id, gravite: v.gravite, ok });
  }
  résultats.push({ id: "format", gravite: "grave", ok: !sortie.problèmesFormat.length, détail: sortie.problèmesFormat.join(" ; ") });
  return résultats;
}

// ─── Appel du modèle avec la vraie consigne de l'application ───
function préparerAppel(cas, M) {
  if (cas.outil === "correction") {
    const lot = cas.paragraphes.map((texte, k) => ({ idx: k + 1, texte }));
    const caractères = cas.paragraphes.reduce((s, p) => s + p.length, 0);
    return { system: M.construireConsigne(cas.niveau || "fautes"), user: M.construireMessage(lot), max_tokens: Math.min(16000, Math.ceil(caractères / 2) + 1500) };
  }
  if (cas.outil === "bilan") return { system: M.construireConsigneBilan(), user: cas.paragraphes.join("\n\n"), max_tokens: 3000 };
  if (cas.outil === "avis") return { system: M.construireConsigneAvis(), user: cas.paragraphes.join("\n\n"), max_tokens: 3500 };
  throw new Error(`outil inconnu : ${cas.outil}`);
}

async function appelerModèle({ system, user, max_tokens }, modèle, clé) {
  const corps = (avecRéflexion) => JSON.stringify({
    model: modèle, max_tokens, system, messages: [{ role: "user", content: user }],
    ...(avecRéflexion ? { thinking: { type: "disabled" } } : {}),
  });
  const envoyer = (avecRéflexion) => fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": clé, "anthropic-version": "2023-06-01" },
    body: corps(avecRéflexion),
  });
  let r = await envoyer(true);
  let d = await r.json().catch(() => ({}));
  if (!r.ok && /thinking/i.test(JSON.stringify(d))) { r = await envoyer(false); d = await r.json().catch(() => ({})); }
  if (!r.ok) throw new Error(`HTTP ${r.status} : ${d?.error?.message || JSON.stringify(d).slice(0, 200)}`);
  return (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
}

// ─── Programme ───
const M = await chargerMoteurs();
const corpus = JSON.parse(await readFile(join(racine, "scripts/essais-ia/cas-robustesse.json"), "utf-8"));
const filtre = option("cas", "");
const cas = corpus.cas.filter((c) => !filtre || filtre.split(",").includes(c.id));
if (!cas.length) { console.error("Aucun cas ne correspond."); process.exit(1); }

if (!enLigne) {
  console.log(`Validation du dispositif (hors ligne) — ${cas.length} cas\n`);
  let invalides = 0;
  for (const c of cas) {
    const bonne = verifier(sortieDe(c, c.reference.bonne, M), c);
    const mauvaise = verifier(sortieDe(c, c.reference.mauvaise, M), c);
    const bonneOk = bonne.every((r) => r.ok);
    const mauvaiseDétectée = mauvaise.some((r) => !r.ok);
    const ok = bonneOk && mauvaiseDétectée;
    if (!ok) invalides++;
    console.log(`${ok ? "OK " : "KO "} ${c.id}  (bonne réponse acceptée : ${bonneOk ? "oui" : "NON : " + bonne.filter((r) => !r.ok).map((r) => r.id).join(", ")} ; mauvaise réponse détectée : ${mauvaiseDétectée ? "oui" : "NON"})`);
  }
  console.log(invalides ? `\n${invalides} cas invalide(s) : les vérifications ne distinguent pas bonne et mauvaise réponse.` : "\nDispositif valide : chaque cas accepte sa bonne réponse et rejette sa mauvaise.");
  process.exit(invalides ? 1 : 0);
}

const clé = process.env.ANTHROPIC_API_KEY;
if (!clé) { console.error("ANTHROPIC_API_KEY manquante (mode --en-ligne)."); process.exit(1); }
const modèle = option("modele", "claude-sonnet-5");
const répétitions = Math.max(1, Number(option("repetitions", "1")) || 1);
console.log(`Essai EN LIGNE — modèle ${modèle} — ${cas.length} cas × ${répétitions} répétition(s)\n`);

const rapport = [];
let grave = false;
for (const c of cas) {
  const passes = [];
  for (let k = 0; k < répétitions; k++) {
    try {
      const brut = await appelerModèle(préparerAppel(c, M), modèle, clé);
      passes.push({ brut, résultats: verifier(sortieDe(c, brut, M), c) });
    } catch (e) {
      passes.push({ erreur: String(e.message || e), résultats: [{ id: "appel", gravite: "grave", ok: false, détail: String(e.message || e) }] });
    }
  }
  const ids = [...new Set(passes.flatMap((p) => p.résultats.map((r) => r.id)))];
  console.log(c.id);
  for (const id of ids) {
    const lignes = passes.map((p) => p.résultats.find((r) => r.id === id)).filter(Boolean);
    const réussies = lignes.filter((r) => r.ok).length;
    const gravité = lignes[0].gravite;
    if (gravité === "grave" && réussies < lignes.length) grave = true;
    console.log(`  ${réussies === lignes.length ? "✔" : gravité === "grave" ? "✘ GRAVE" : "~ souhaitable"}  ${id}  (${réussies}/${lignes.length})`);
  }
  rapport.push({ id: c.id, passes });
}
await mkdir(join(racine, "scripts/essais-ia/resultats"), { recursive: true });
const fichier = join(racine, "scripts/essais-ia/resultats", `${new Date().toISOString().slice(0, 10)}-${modèle}.json`);
await writeFile(fichier, JSON.stringify({ modèle, date: new Date().toISOString(), répétitions, rapport }, null, 2));
console.log(`\nRapport complet : ${fichier}`);
console.log(grave ? "ÉCHEC : au moins une vérification GRAVE a échoué." : "Aucune vérification grave n'a échoué.");
process.exit(grave ? 1 : 0);
