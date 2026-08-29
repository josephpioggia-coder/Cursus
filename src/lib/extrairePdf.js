/**
 * CURSUS — Extraction de texte depuis un .pdf (référence 60816-01, suite,
 * 28/08/2026)
 * ======================================================================
 * Chargement dynamique de PDF.js (Mozilla) depuis un CDN, même principe que
 * chargerJSZip() dans segmenterCursAudit.js pour le .docx — aucune
 * dépendance npm ajoutée, un seul <script> injecté à la demande, mise en
 * cache sur window après le premier chargement.
 *
 * Fichier séparé de segmenterCursAudit.js : l'extraction PDF sert d'abord
 * au profil auteur (ProfilAuteur.jsx), pas à l'import de manuscrit — pas de
 * découpage en unités ici, juste le texte brut complet du document.
 */

const VERSION_PDFJS = "3.11.174";

async function chargerPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${VERSION_PDFJS}/pdf.min.js`;
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${VERSION_PDFJS}/pdf.worker.min.js`;
      resolve(window.pdfjsLib);
    };
    s.onerror = () => reject(new Error("Impossible de charger le lecteur PDF (connexion réseau ?)."));
    document.head.appendChild(s);
  });
}

/** Extrait tout le texte d'un fichier .pdf, page par page, dans l'ordre. */
export async function extraireTextePdf(fichier) {
  const pdfjsLib = await chargerPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: await fichier.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const contenu = await page.getTextContent();
    pages.push(contenu.items.map((item) => item.str).join(" "));
  }
  return pages.join("\n\n").trim();
}
