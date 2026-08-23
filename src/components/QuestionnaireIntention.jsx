/**
 * CURSUS — Questionnaire d'intention (référence 60816-01, tangentielle,
 * 23/08/2026) — CORRECTIF, PAS LA FONCTIONNALITÉ D'ORIGINE.
 *
 * BUG TROUVÉ ET CORRIGÉ ICI : ce fichier contenait, avant ce correctif, une
 * copie complète et fonctionnelle de `CopiloteIA.jsx` (même en-tête "Module :
 * Co-pilote IA", même code), importée dans App.jsx sous le nom
 * `QuestionnaireIntention` (l'alias d'import masque le vrai nom de la
 * fonction exportée, donc l'incohérence ne cassait rien à la compilation).
 * Deux appels dans App.jsx (`{projetVenantDêtreCréé && <QuestionnaireIntention
 * projetId=... projetTitre=... onTerminé=... />}` et le rappel persistant
 * équivalent) attendent une VRAIE modale de questionnaire, avec les props
 * `projetId`, `projetTitre`, `onTerminé`, `onFermer` — la copie de
 * CopiloteIA ignorait ces props (elle attend `texteActif`, `typeProjet`,
 * `couleurProjet`, `langueProjet`...) et surtout ne rendait AUCUN habillage
 * de modale (pas de `position: fixed`, pas de fond assombri) : elle
 * s'affichait comme un bloc ordinaire, en bas du DOM de l'application —
 * signalé par l'auteur du projet comme "un duplicata de co-pilote qui n'a
 * rien à y faire" en bas à gauche de l'écran.
 *
 * Origine probable : un copier-coller resté en place par erreur (le dépôt
 * n'a qu'un historique git compressé depuis le 02/08/2026, impossible de
 * retrouver un état antérieur correct de ce fichier).
 *
 * ÉTAT ACTUEL : composant neutre (ne rend rien), qui accepte les bonnes
 * props sans planter — supprime le bug visuel sans faire semblant qu'une
 * fonctionnalité existe. AUCUNE PERTE RÉELLE : la version buguée ne
 * fonctionnait de toute façon pas comme un vrai questionnaire (mauvaises
 * props, jamais fermable proprement).
 *
 * RESTE À FAIRE, SI L'AUTEUR DU PROJET LE CONFIRME (hors périmètre de ce
 * correctif — nécessite de définir le contenu du questionnaire ET d'ajouter
 * les colonnes correspondantes sur `projets`, qui n'existent pas encore) :
 * concevoir la vraie modale "Questionnaire de démarrage" (intention/ligne de
 * conduite du co-pilote pour le projet), avec persistance en base.
 */

export default function QuestionnaireIntention({ projetId, projetTitre, onTerminé, onFermer }) {
  return null;
}
