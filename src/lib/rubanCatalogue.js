/**
 * CURSUS — Catalogue du ruban de CursEdit (28/10/2026)
 * ======================================================================
 * Décision de Joseph : un ruban à onglets inspiré de Word, avec un « Accueil » À NOUS (fonctions les plus utiles,
 * épinglables) ; les autres fonctions restent dans leur onglet d'origine. Chaque fonction a un état :
 *   - "fait"    : elle existe dans Cursus (le bouton agit) ;
 *   - "bientot" : elle est prévue, avec un niveau d'intérêt (« fort », « moyen », « faible ») — le bouton l'annonce ;
 * Ordre de réalisation des fonctions à venir : du plus fort au plus faible (voir `priorite`).
 * Fichier PUR : le branchement des actions se fait dans Editeur.jsx (`actionsRuban`).
 */

export const ONGLETS = [
  { id: "accueil", label: "Accueil" },
  { id: "insertion", label: "Insertion" },
  { id: "miseenpage", label: "Mise en page" },
  { id: "references", label: "Références" },
  { id: "revision", label: "Révision" },
  { id: "affichage", label: "Affichage" },
  { id: "aide", label: "Aide" },
];

// `ctrl` = contrôle particulier fourni par l'éditeur (liste déroulante…) au lieu d'un simple bouton.
export const FONCTIONS = [
  // ── Accueil ───────────────────────────────────────────────
  { id: "copier", onglet: "accueil", groupe: "Presse-papiers", label: "Copier tout", icone: "📋", statut: "fait", aide: "Copier tout le texte du chapitre" },
  { id: "question", onglet: "accueil", groupe: "Assistance IA", label: "Question rapide", icone: "💬", statut: "fait", aide: "Poser une question à l'IA sans passer par le Co-pilote (Ctrl+K) : modèle et effort au choix, tokens retirés de votre quota" },
  { id: "rechercher", onglet: "accueil", groupe: "Édition", label: "Rechercher / remplacer", icone: "🔎", statut: "fait", aide: "Rechercher et remplacer dans le chapitre, puis dans tout le livre" },

  // ── Insertion ─────────────────────────────────────────────
  { id: "image", onglet: "insertion", groupe: "Illustrations", label: "Image", icone: "🖼️", statut: "fait", aide: "Insérer une image dans le texte" },
  { id: "photo", onglet: "insertion", groupe: "Illustrations", label: "Lire une photo", icone: "📷", statut: "fait", aide: "Photographier une page : l'IA la recopie fidèlement en texte dans le chapitre" },
  { id: "saut_page", onglet: "insertion", groupe: "Pages", label: "Saut de page", icone: "⤓", statut: "fait", aide: "Forcer le début d'une nouvelle page (Ctrl+Entrée) ; chaque chapitre commence déjà sur une nouvelle page à l'export" },
  { id: "garde", onglet: "insertion", groupe: "Pages", label: "Page de garde", icone: "📘", statut: "bientot", priorite: "moyen", aide: "Page de titre personnalisable à l'export" },
  { id: "tableau", onglet: "insertion", groupe: "Tableaux", label: "Tableau", icone: "▦", statut: "bientot", priorite: "moyen", aide: "Insérer un tableau (essais, manuels)" },
  { id: "lien", onglet: "insertion", groupe: "Liens", label: "Lien", icone: "🔗", statut: "bientot", priorite: "moyen", aide: "Lien hypertexte" },
  { id: "symbole", onglet: "insertion", groupe: "Symboles", label: "Symbole", icone: "Ω", statut: "bientot", priorite: "faible", aide: "Caractères spéciaux" },

  // ── Mise en page ──────────────────────────────────────────
  { id: "format", onglet: "miseenpage", groupe: "Page", label: "Format de page", icone: "📐", statut: "fait", ctrl: "format", aide: "Format de référence (A4, A5, poche, broché)" },
  { id: "regle", onglet: "miseenpage", groupe: "Paragraphe", label: "Marges et retraits", icone: "📏", statut: "fait", aide: "Affiche la feuille et sa règle : marges, retraits, tabulations" },
  { id: "styles", onglet: "miseenpage", groupe: "Styles", label: "Styles", icone: "🎨", statut: "fait", aide: "Régler une fois la police, la taille, l'interligne… de Normal, Titres, Citation" },
  { id: "entetes", onglet: "miseenpage", groupe: "En-tête et pied de page", label: "En-têtes et numéros de page", icone: "🔢", statut: "bientot", priorite: "fort", aide: "Titre du livre, auteur, numéro de page à l'export Word" },
  { id: "colonnes", onglet: "miseenpage", groupe: "Page", label: "Colonnes", icone: "▥", statut: "bientot", priorite: "faible", aide: "Texte sur plusieurs colonnes" },

  // ── Références ────────────────────────────────────────────
  { id: "note", onglet: "references", groupe: "Notes de bas de page", label: "Note de bas de page", icone: "📝", statut: "fait", aide: "Insérer une note de bas de page au curseur" },
  { id: "table_matieres", onglet: "references", groupe: "Table des matières", label: "Table des matières", icone: "📑", statut: "fait", aide: "Générée automatiquement à l'export Word (Parties, Chapitres, Scènes)" },
  { id: "citation", onglet: "references", groupe: "Citations et bibliographie", label: "Citation de la Bibliothèque", icone: "❝", statut: "bientot", priorite: "fort", aide: "Insérer une citation de la Bibliothèque avec sa source" },
  { id: "biblio", onglet: "references", groupe: "Citations et bibliographie", label: "Bibliographie", icone: "📚", statut: "bientot", priorite: "fort", aide: "Liste des sources citées, à l'export Word" },
  { id: "zotero", onglet: "references", groupe: "Citations et bibliographie", label: "Importer de Zotero", icone: "⬇️", statut: "bientot", priorite: "moyen", aide: "Importer un export Zotero (RIS, BibTeX, JSON) dans la Bibliothèque" },
  { id: "legende", onglet: "references", groupe: "Légendes", label: "Légende d'image", icone: "🏷️", statut: "bientot", priorite: "moyen", aide: "Légende sous une image" },
  { id: "index", onglet: "references", groupe: "Index", label: "Index", icone: "🗂️", statut: "bientot", priorite: "moyen", aide: "Marquer des entrées et générer un index" },
  { id: "renvoi", onglet: "references", groupe: "Légendes", label: "Renvoi", icone: "↪", statut: "bientot", priorite: "faible", aide: "Renvoi vers un chapitre ou une figure" },

  // ── Révision ──────────────────────────────────────────────
  { id: "correction", onglet: "revision", groupe: "Vérification", label: "Correction rapide", icone: "✨", statut: "fait", aide: "Fautes (et fluidité légère) corrigées en une passe, à valider" },
  { id: "fond", onglet: "revision", groupe: "Vérification", label: "Vérifier le fond", icone: "🔎", statut: "fait", aide: "Avis de lecture : est-ce que ça tient la route ?" },
  { id: "faits", onglet: "revision", groupe: "Vérification", label: "Vérifier les faits", icone: "🔢", statut: "fait", aide: "Affirmations factuelles et calculs, avec sources" },
  { id: "profil", onglet: "revision", groupe: "Vérification", label: "Profil de lisibilité", icone: "📊", statut: "fait", aide: "L'effort que le texte impose au lecteur, citations vérifiées" },
  { id: "nettoyage", onglet: "revision", groupe: "Vérification", label: "Nettoyage mécanique", icone: "🧹", statut: "fait", aide: "Typographie française et répétitions, sans IA" },
  { id: "statistiques", onglet: "revision", groupe: "Vérification", label: "Statistiques", icone: "🔡", statut: "bientot", priorite: "fort", aide: "Mots, caractères, paragraphes, pages, temps de lecture" },
  { id: "synonymes", onglet: "revision", groupe: "Vérification", label: "Synonymes", icone: "📖", statut: "bientot", priorite: "moyen", aide: "Dictionnaire des synonymes" },
  { id: "lire", onglet: "revision", groupe: "Fonction vocale", label: "Lire à voix haute", icone: "🔊", statut: "fait", ctrl: "lecture", aide: "Lecture à voix haute (voix et vitesse au choix)" },
  { id: "traduire", onglet: "revision", groupe: "Langue", label: "Traduire", icone: "🌐", statut: "bientot", priorite: "moyen", aide: "Traduire un passage" },
  { id: "commentaire", onglet: "revision", groupe: "Commentaires", label: "Commentaires", icone: "💬", statut: "bientot", priorite: "fort", aide: "Commentaires dans la marge (soi-même, relecteur, Co-pilote)" },
  { id: "suivi", onglet: "revision", groupe: "Suivi", label: "Suivi des modifications", icone: "✍️", statut: "bientot", priorite: "fort", aide: "Voir, accepter ou refuser les modifications (gros chantier)" },
  { id: "comparer", onglet: "revision", groupe: "Comparer", label: "Comparer deux versions", icone: "⇄", statut: "bientot", priorite: "fort", aide: "Comparer le texte actuel avec une version de l'historique" },
  { id: "historique", onglet: "revision", groupe: "Comparer", label: "Historique des versions", icone: "↺", statut: "fait", aide: "Retrouver et restaurer une version antérieure" },

  // ── Affichage ─────────────────────────────────────────────
  { id: "vuepage", onglet: "affichage", groupe: "Vues", label: "Vue page", icone: "📄", statut: "fait", aide: "Texte sur une feuille avec ses marges et sa règle" },
  { id: "plan", onglet: "affichage", groupe: "Vues", label: "Plan", icone: "🧭", statut: "bientot", priorite: "moyen", aide: "Vue hiérarchique des titres" },
  { id: "lecture_mode", onglet: "affichage", groupe: "Vues", label: "Mode lecture", icone: "📖", statut: "bientot", priorite: "faible", aide: "Lecture sans barres" },
  { id: "focus", onglet: "affichage", groupe: "Immersion", label: "Focus", icone: "◎", statut: "fait", aide: "Mode d'écriture sans distraction" },
  { id: "navigation", onglet: "affichage", groupe: "Afficher", label: "Volet de navigation", icone: "☰", statut: "bientot", priorite: "fort", aide: "Titres du chapitre et du livre, cliquables" },
  { id: "quadrillage", onglet: "affichage", groupe: "Afficher", label: "Quadrillage", icone: "▦", statut: "bientot", priorite: "faible", aide: "Grille de repérage" },
  { id: "zoom", onglet: "affichage", groupe: "Zoom", label: "Zoom", icone: "🔍", statut: "bientot", priorite: "fort", aide: "Zoom de la feuille : 100 %, largeur de page, une ou plusieurs pages" },
  { id: "cote", onglet: "affichage", groupe: "Fenêtre", label: "Deux chapitres côte à côte", icone: "◫", statut: "bientot", priorite: "moyen", aide: "Ouvrir deux chapitres ensemble pour comparer ou recopier" },

  // ── Aide ──────────────────────────────────────────────────
  { id: "aide", onglet: "aide", groupe: "Aide", label: "Aide", icone: "❓", statut: "fait", aide: "Centre d'aide" },
  { id: "mode_emploi", onglet: "aide", groupe: "Aide", label: "Mode d'emploi", icone: "📖", statut: "fait", aide: "Mode d'emploi de Cursus" },
  { id: "nouveautes", onglet: "aide", groupe: "Aide", label: "Nouveautés", icone: "✨", statut: "bientot", priorite: "fort", aide: "Ce qui a changé dans Cursus" },
  { id: "retour", onglet: "aide", groupe: "Aide", label: "Envoyer un retour", icone: "✉️", statut: "bientot", priorite: "fort", aide: "Signaler un problème ou une idée, directement depuis l'app" },
  { id: "formation", onglet: "aide", groupe: "Aide", label: "Formation", icone: "🎓", statut: "bientot", priorite: "moyen", aide: "Tutoriels courts" },
  { id: "mobile", onglet: "aide", groupe: "Mobile", label: "Application mobile", icone: "📱", statut: "bientot", priorite: "moyen", aide: "Installer Cursus sur le téléphone" },
];

/** Fonctions placées par défaut dans l'Accueil (les plus utiles) ; l'auteur·ice peut en épingler d'autres. */
export const EPINGLEES_PAR_DEFAUT = ["correction", "fond", "lire", "historique", "styles", "statistiques"]; // « Rechercher / remplacer » est déjà dans le groupe Édition de l'Accueil

export const POIDS_PRIORITE = { fort: 0, moyen: 1, faible: 2 };
export const LIBELLE_PRIORITE = { fort: "intérêt fort", moyen: "intérêt moyen", faible: "intérêt faible" };

/** Les fonctions à venir, de la plus importante à la moins importante (ordre de réalisation). */
export const aVenirParOrdre = () =>
  FONCTIONS.filter((f) => f.statut === "bientot").sort((a, b) => POIDS_PRIORITE[a.priorite] - POIDS_PRIORITE[b.priorite]);

/** Épinglées valides (ids connus, sans doublon). */
export function nettoyerEpinglees(brut) {
  const ids = new Set(FONCTIONS.map((f) => f.id));
  const vu = new Set();
  return (Array.isArray(brut) ? brut : []).filter((id) => typeof id === "string" && ids.has(id) && !vu.has(id) && vu.add(id));
}
