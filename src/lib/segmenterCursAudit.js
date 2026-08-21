/**
 * CursAudit — Segmentation d'un texte en unités d'analyse (référence 60816-01, suite)
 * ======================================================================
 * Deux sources possibles pour peupler `audit_sections` :
 *  - `segmenterTexte()` : texte déjà en clair (collé), découpé par
 *    paragraphes séparés par des lignes vides — une heuristique, puisqu'un
 *    texte collé n'a pas de frontière de paragraphe fiable.
 *  - `extraireParagraphesDocx()` : fichier .docx, découpé par ses vrais
 *    paragraphes internes (`<w:p>`) — plus fiable, reprend la lecture JSZip
 *    déjà éprouvée dans src/components/ImportDocx.jsx (pas `mammoth`,
 *    dépendance présente mais inutilisée dans ce dépôt), simplifiée : pas
 *    de détection de niveaux de titre ici, CursAudit n'a pas besoin de
 *    distinguer parties/chapitres, seulement des unités de texte à plat.
 */

// Filtre le bruit typique d'un texte collé ou d'un paragraphe Word : lignes
// vides résiduelles, numéros de page isolés, en-têtes/pieds de page très
// courts. Seuil arbitraire, ajustable si l'usage réel montre qu'il coupe
// trop ou pas assez.
const LONGUEUR_MIN_UNITE = 20;

export function segmenterTexte(texte) {
  if (!texte) return [];
  return texte
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/) // paragraphes séparés par une ou plusieurs lignes vides
    .map((p) => p.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim())
    .filter((p) => p.length >= LONGUEUR_MIN_UNITE);
}

async function chargerJSZip() {
  if (window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = () => resolve(window.JSZip);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export async function extraireParagraphesDocx(fichier) {
  const JSZip = await chargerJSZip();
  const zip = await JSZip.loadAsync(await fichier.arrayBuffer());
  const xml = await zip.file("word/document.xml").async("string");

  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const paras = doc.getElementsByTagNameNS(ns, "p");

  const unités = [];
  for (const p of paras) {
    const texte = Array.from(p.getElementsByTagNameNS(ns, "t"))
      .map((t) => t.textContent).join("").trim();
    if (texte.length >= LONGUEUR_MIN_UNITE) unités.push(texte);
  }
  return unités;
}
