// Point d'entrée regroupant les parties PURES des outils d'IA de Cursus (consignes + lecture des réponses),
// pour que le jeu d'essai utilise EXACTEMENT les consignes de l'application et non une copie.
// Empaqueté par scripts/evaluer-robustesse-ia.mjs (esbuild) : ne pas importer depuis l'application.
export {
  construireConsigne, construireMessage, analyserReponse, validerParagraphe, sansChangementsDeStyle,
  construireConsigneBilan, analyserBilan,
} from "../../src/lib/correctionRapide.js";
export { construireConsigneAvis, analyserAvis } from "../../src/lib/avisSurLeFond.js";
