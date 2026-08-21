/**
 * CursAudit — Segmentation d'un texte en unités d'analyse (référence 60816-01, suite)
 * ======================================================================
 * Découpe un texte déjà extrait (collé, ou texte brut) en unités
 * (paragraphes) pour peupler `audit_sections`. Ne gère PAS l'extraction
 * depuis un fichier .docx/.pdf — ça reste à construire (reprendre la
 * logique JSZip déjà éprouvée dans src/components/ImportDocx.jsx plutôt que
 * mammoth, qui est une dépendance présente mais inutilisée dans ce dépôt).
 */

// Filtre le bruit typique d'un texte collé : lignes vides résiduelles,
// numéros de page isolés, en-têtes/pieds de page très courts. Seuil
// arbitraire, ajustable si l'usage réel montre qu'il coupe trop ou pas assez.
const LONGUEUR_MIN_UNITE = 20;

export function segmenterTexte(texte) {
  if (!texte) return [];
  return texte
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/) // paragraphes séparés par une ou plusieurs lignes vides
    .map((p) => p.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim())
    .filter((p) => p.length >= LONGUEUR_MIN_UNITE);
}
