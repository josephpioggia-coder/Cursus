/**
 * CURSAUDIT — Taxonomie du "contrat d'intention" (référence 60816-01,
 * suite, 28/08/2026)
 * ======================================================================
 * Architecture conçue avec l'auteur du projet et ChatGPT en parallèle, sur
 * toute la session du 28/08/2026 (voir docs/PAQUET-DE-REPRISE-2026-08-27.md,
 * entrée [CHANTIER-CONTRAT-INTENTION]) : on ne classe pas des livres, on
 * classe des intentions. Arbre 100% STATIQUE (jamais de génération IA sur ce
 * chemin — fragilité constatée toute la journée du 28/08 : NetworkError,
 * sorties mal formées, latence). Règle de conception : jamais plus de 10-12
 * choix par écran, "Autre" systématique.
 *
 * PORTÉE DE CETTE PREMIÈRE VERSION (28/08/2026) : seuls les niveaux 1 et 2
 * de la famille "Nature du projet" sont couverts ici — pas de niveau 3/4
 * (ex. les 47 sous-genres de Roman, les 4 niveaux de Religion→Christianisme
 * détaillés dans la conversation d'origine). Suffisant pour tester le
 * mécanisme du questionnaire de bout en bout ; approfondir des branches
 * précises est un chantier de contenu, pas de code, à faire au besoin sans
 * changer cette structure de données.
 */

export const NATURE_PROJET = [
  {
    famille: "Se raconter",
    sousCategories: ["Autobiographie", "Mémoires", "Histoire de vie", "Témoignage", "Journal", "Correspondance", "Récit de voyage", "Chronique familiale", "Portrait"],
  },
  {
    famille: "Imaginer une histoire",
    sousCategories: ["Roman", "Nouvelle", "Conte", "Théâtre", "Scénario", "Bande dessinée", "Manga / Webtoon", "Album illustré", "Fiction interactive"],
  },
  {
    // Renommé le 28/08/2026 (demande explicite de l'auteur du projet,
    // à propos de "L'Oracle du Sermon sur la montagne") : "Défendre une
    // idée" présupposait une posture argumentative qui ne correspond pas
    // à un projet spirituel/méditatif (accompagner une pratique, ouvrir
    // un chemin, proposer une intériorisation — pas défendre une thèse).
    // Définition de référence : "transmettre une pensée, une sagesse ou
    // une pratique", condensée ici pour la liste déroulante.
    famille: "Transmettre / accompagner",
    sousCategories: ["Essai", "Philosophie", "Religion", "Spiritualité", "Sciences humaines", "Sciences", "Politique", "Société", "Histoire"],
  },
  {
    famille: "Transmettre un savoir",
    sousCategories: ["Manuel", "Guide pratique", "Méthode personnelle", "Retour d'expérience"],
  },
  {
    famille: "Transformer le lecteur",
    sousCategories: ["Développement personnel", "Coaching", "Thérapie", "Cahier d'exercices", "Cahier de travail", "Journal guidé", "Motivation"],
  },
  {
    famille: "Créer une œuvre artistique",
    sousCategories: ["Poésie", "Chanson", "Textes courts", "Aphorismes", "Slam", "Monologue", "Performance"],
  },
  {
    famille: "Communiquer",
    sousCategories: ["Post réseaux sociaux", "Série de publications", "Newsletter", "Article de blog", "Discours / allocution", "Conférence", "Podcast", "Script vidéo", "Communiqué / dossier de presse", "Correspondance professionnelle"],
  },
  {
    famille: "Produire un document professionnel",
    sousCategories: ["Rapport d'activité", "Rapport d'expertise", "Étude", "Livre blanc", "Mémoire professionnel", "Business plan", "Note de synthèse", "Actes de conférence", "Cahier des charges"],
  },
  {
    famille: "Concevoir un support pédagogique ou ludique",
    sousCategories: ["Manuel scolaire", "Support de formation", "Cahier d'exercices", "Cartes pédagogiques", "Livre-jeu", "Jeu narratif", "Jeu de rôle", "Support pour enfants", "Workbook"],
  },
];

export const OU_EN_ETES_VOUS = [
  "J'ai une idée",
  "J'ai commencé",
  "Mon premier jet est terminé",
  "Je suis en réécriture",
  "Je souhaite un premier regard extérieur",
  "Je prépare la publication",
  "Mon livre est déjà publié",
];

export const OBJECTIFS = [
  "comprendre", "témoigner", "transmettre", "convaincre", "expliquer", "divertir",
  "faire réfléchir", "émouvoir", "laisser une trace", "rendre hommage", "faire mon deuil",
  "dénoncer", "réparer", "réconcilier", "inspirer", "provoquer", "expérimenter",
  "partager une méthode", "aider", "changer le regard", "changer le monde",
];

export const DESTINATAIRES = [
  "moi-même", "ma famille", "une personne précise", "des professionnels",
  "des étudiants", "des enfants", "le grand public",
  "des personnes vivant une situation similaire", "une communauté particulière",
];

// ATTENTES_CURSUS fusionnée dans FINALITES (CursAuditQuestionnaire.jsx) le
// 28/08/2026 — signalé par l'auteur du projet : "Qu'attendez-vous de
// Cursus ?" et l'ancienne "Que veux-tu obtenir ?" faisaient largement
// doublon (structurer mes idées / améliorer la structure, rendre mon texte
// plus fluide / fluidifier, trouver mes incohérences / vérifier la
// cohérence...). Une seule liste désormais, qui alimente à la fois
// finaliteAudit (obligatoire, injecté au moteur d'analyse) et
// contratIntention.attentesCursus (même valeurs, pas de second état).

export const CRITERES_REUSSITE = [
  "j'aurai compris quelque chose", "je me sentirai en paix",
  "mes lecteurs comprendront mon message", "mon livre sera publié",
  "il aidera d'autres personnes", "il restera comme un témoignage",
  "il ouvrira un débat", "il changera quelque chose",
];

export const CE_QUE_VOUS_ESPEREZ_DECOUVRIR = [
  "pourquoi je souffre encore", "pourquoi cette relation me poursuit", "qui je suis devenu",
  "ce que cette histoire a changé", "ce que je n'ai jamais compris", "ce que je veux transmettre",
  "ce que je cache", "ce que je ne vois pas encore",
];
