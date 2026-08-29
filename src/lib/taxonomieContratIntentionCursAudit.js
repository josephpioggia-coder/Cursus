/**
 * CURSAUDIT — Taxonomie du "contrat d'intention" (référence 60816-01,
 * suite, 28/08/2026, remplacée le 29/08/2026)
 * ======================================================================
 * REMPLACÉE INTÉGRALEMENT le 29/08/2026 — l'auteur du projet a fourni le
 * fichier taxonomie_cursus_niveaux_1_a_4.xlsx (élaboré avec ChatGPT),
 * contenant l'arbre COMPLET niveaux 1 à 4 : 9 familles de niveau 1, 415
 * chemins complets N1→N4. Remplace entièrement l'ancienne version
 * simplifiée (niveaux 1-2 seulement, "Roman" enrichi seul au niveau 3 le
 * 29/08/2026 dans une étape intermédiaire, elle-même remplacée ici).
 *
 * STRUCTURE : chaque nœud est `{ code, nom, enfants: [...] }` — les
 * feuilles (niveau 4) n'ont pas d'`enfants` mais un `statut` et,
 * optionnellement, une `aide` (texte d'accompagnement si le statut n'est
 * pas "prêt"). Générée programmatiquement à partir du fichier source (voir
 * `Taxonomie_N1_N4` dans le xlsx) pour éviter toute erreur de
 * retranscription sur 415 lignes — ne pas éditer à la main sans
 * regénérer depuis la source si le fichier évolue.
 *
 * STATUTS (feuille de route Cursus, PAS un blocage) — définis dans l'onglet
 * "Definitions" du fichier source :
 *  - "prêt" (242 chemins) : Cursus peut auditer dès maintenant.
 *  - "partiel" (165) : Cursus peut analyser, mais doit signaler des limites.
 *  - "à développer" (5) : Cursus propose un cadrage proche, un module dédié
 *    serait nécessaire pour aller plus loin.
 *  - "proche" (3, la famille N1.09 "Autre / à préciser" elle-même) : aucune
 *    catégorie exacte, Cursus propose la plus proche.
 * PRINCIPE EXPLICITE DE LA SOURCE : "Ne pas bloquer l'auteur : si le projet
 * est hybride ou non reconnu, proposer la catégorie la plus proche + Autre
 * à préciser." Aucun statut ne bloque donc la validation du questionnaire —
 * seul un message d'aide (`aide` du nœud, ou un message générique par
 * statut, voir STATUTS_AIDE_GENERIQUE) s'affiche pour "partiel"/"à
 * développer"/"proche". CHANGEMENT DE COMPORTEMENT réel par rapport à
 * l'ancienne version : la Poésie n'est PLUS bloquée à la validation (elle
 * apparaît "prête" pour la plupart de ses formes dans cette taxonomie plus
 * fine, sous la famille N1.08 "Créer une forme poétique / expérimentale") —
 * l'ancien blocage était une mesure de prudence sur l'ancienne
 * classification "Poésie" fourre-tout, plus nécessaire avec cette
 * granularité.
 *
 * "AUTRE" À CHAQUE NIVEAU, JAMAIS DE NIVEAU SUIVANT GÉNÉRÉ DYNAMIQUEMENT —
 * question explicite de l'auteur du projet le 29/08/2026 ("c'est copilot
 * qui de manière dynamique les crée au fur et à mesure ?") : NON. L'arbre
 * est entièrement statique, fixé à 4 niveaux par la source. Choisir
 * "Autre" à N'IMPORTE QUEL niveau (1 à 4) ouvre un champ texte libre et
 * ARRÊTE la descente dans l'arbre à cet endroit — aucun niveau supplémentaire
 * n'est proposé après un "Autre", ni généré par une IA. Voir
 * `optionsSuivantes()`/`noeudAtteint()` plus bas, et le composant
 * SélecteurNature dans CursAuditQuestionnaire.jsx. Cohérent avec le principe
 * du 28/08/2026 : questionnaire 100% statique, aucune génération IA sur ce
 * chemin (seule exception du fichier : synthetiser-question-cursaudit, pour
 * la question précise, sans rapport avec cette taxonomie).
 */

// Messages génériques si un nœud n'a pas sa propre `aide` — voir
// SélecteurNature dans CursAuditQuestionnaire.jsx.
export const STATUTS_AIDE_GENERIQUE = {
  partiel: "Cursus peut analyser ce type de projet, mais signalera certaines limites au fil de l'audit.",
  "à développer": "Cursus peut proposer un premier cadrage pour ce type de projet ; un module dédié serait nécessaire pour aller plus loin.",
  proche: "Cursus n'a pas de catégorie exacte pour ce projet — précisez-le librement, la catégorie la plus proche sera utilisée.",
};

export const NATURE_PROJET = [
  {
    code: "N1.01",
    nom: "Se raconter / témoigner",
    enfants: [
      {
        code: "N2.01.01",
        nom: "Parcours de vie",
        enfants: [
          {
            code: "N3.01.01.01",
            nom: "Autobiographie",
            enfants: [
              { code: "N3.01.01.01.01", nom: "chronologique complète", statut: "prêt" },
              { code: "N3.01.01.01.02", nom: "thématique", statut: "prêt" },
              { code: "N3.01.01.01.03", nom: "fragmentaire", statut: "prêt" },
              { code: "N3.01.01.01.04", nom: "autobiographie intellectuelle", statut: "prêt" },
              { code: "N3.01.01.01.05", nom: "autoportrait", statut: "prêt" },
              { code: "N3.01.01.01.06", nom: "autofiction proche du réel", statut: "prêt" },
            ],
          },
          {
            code: "N3.01.01.02",
            nom: "Mémoires",
            enfants: [
              { code: "N3.01.01.02.01", nom: "mémoires professionnels", statut: "prêt" },
              { code: "N3.01.01.02.02", nom: "mémoires politiques / engagement public", statut: "prêt" },
              { code: "N3.01.01.02.03", nom: "mémoires familiaux", statut: "prêt" },
              { code: "N3.01.01.02.04", nom: "mémoires d’une période", statut: "prêt" },
              { code: "N3.01.01.02.05", nom: "mémoires de guerre / crise / exil", statut: "prêt" },
              { code: "N3.01.01.02.06", nom: "mémoires spirituels", statut: "prêt" },
            ],
          },
          {
            code: "N3.01.01.03",
            nom: "Histoire de vie",
            enfants: [
              { code: "N3.01.01.03.01", nom: "récit de vie accompagné", statut: "prêt" },
              { code: "N3.01.01.03.02", nom: "récit familial", statut: "prêt" },
              { code: "N3.01.01.03.03", nom: "transmission intergénérationnelle", statut: "prêt" },
              { code: "N3.01.01.03.04", nom: "parcours migratoire", statut: "prêt" },
              { code: "N3.01.01.03.05", nom: "parcours social / professionnel", statut: "prêt" },
              { code: "N3.01.01.03.06", nom: "récit de reconstruction", statut: "prêt" },
            ],
          },
        ],
      },
      {
        code: "N2.01.02",
        nom: "Épreuve / transformation",
        enfants: [
          {
            code: "N3.01.02.01",
            nom: "Témoignage",
            enfants: [
              { code: "N3.01.02.01.01", nom: "trauma / violence", statut: "prêt" },
              { code: "N3.01.02.01.02", nom: "maladie / cancer / handicap", statut: "prêt" },
              { code: "N3.01.02.01.03", nom: "deuil", statut: "prêt" },
              { code: "N3.01.02.01.04", nom: "addiction / dépendance", statut: "prêt" },
              { code: "N3.01.02.01.05", nom: "conversion / éveil spirituel", statut: "prêt" },
              { code: "N3.01.02.01.06", nom: "parcours judiciaire / administratif", statut: "prêt" },
              { code: "N3.01.02.01.07", nom: "résilience / reconstruction", statut: "prêt" },
            ],
          },
          {
            code: "N3.01.02.02",
            nom: "Récit thérapeutique / auto-analyse",
            enfants: [
              { code: "N3.01.02.02.01", nom: "manuel d’auto-analyse personnel", statut: "partiel", aide: "Présenter comme récit et auto-analyse, non comme diagnostic clinique sauf profil autorisé." },
              { code: "N3.01.02.02.02", nom: "récit de thérapie", statut: "partiel", aide: "Présenter comme récit et auto-analyse, non comme diagnostic clinique sauf profil autorisé." },
              { code: "N3.01.02.02.03", nom: "journal de reconstruction", statut: "partiel", aide: "Présenter comme récit et auto-analyse, non comme diagnostic clinique sauf profil autorisé." },
              { code: "N3.01.02.02.04", nom: "analyse d’une relation", statut: "partiel", aide: "Présenter comme récit et auto-analyse, non comme diagnostic clinique sauf profil autorisé." },
              { code: "N3.01.02.02.05", nom: "récit de rupture / attachement", statut: "partiel", aide: "Présenter comme récit et auto-analyse, non comme diagnostic clinique sauf profil autorisé." },
              { code: "N3.01.02.02.06", nom: "récit trauma-informed", statut: "partiel", aide: "Présenter comme récit et auto-analyse, non comme diagnostic clinique sauf profil autorisé." },
            ],
          },
        ],
      },
      {
        code: "N2.01.03",
        nom: "Écriture intime",
        enfants: [
          {
            code: "N3.01.03.01",
            nom: "Journal",
            enfants: [
              { code: "N3.01.03.01.01", nom: "journal intime", statut: "prêt" },
              { code: "N3.01.03.01.02", nom: "journal de bord", statut: "prêt" },
              { code: "N3.01.03.01.03", nom: "journal de création", statut: "prêt" },
              { code: "N3.01.03.01.04", nom: "journal de deuil", statut: "prêt" },
              { code: "N3.01.03.01.05", nom: "journal spirituel", statut: "prêt" },
              { code: "N3.01.03.01.06", nom: "carnet thérapeutique", statut: "prêt" },
            ],
          },
          {
            code: "N3.01.03.02",
            nom: "Correspondance",
            enfants: [
              { code: "N3.01.03.02.01", nom: "lettres personnelles", statut: "prêt" },
              { code: "N3.01.03.02.02", nom: "lettres ouvertes", statut: "prêt" },
              { code: "N3.01.03.02.03", nom: "correspondance amoureuse", statut: "prêt" },
              { code: "N3.01.03.02.04", nom: "correspondance familiale", statut: "prêt" },
              { code: "N3.01.03.02.05", nom: "correspondance intellectuelle", statut: "prêt" },
              { code: "N3.01.03.02.06", nom: "correspondance fictive", statut: "prêt" },
            ],
          },
          {
            code: "N3.01.03.03",
            nom: "Carnet / fragments personnels",
            enfants: [
              { code: "N3.01.03.03.01", nom: "fragments autobiographiques", statut: "prêt" },
              { code: "N3.01.03.03.02", nom: "carnet de pensées", statut: "prêt" },
              { code: "N3.01.03.03.03", nom: "notes de voyage intérieures", statut: "prêt" },
              { code: "N3.01.03.03.04", nom: "fragments relationnels", statut: "prêt" },
              { code: "N3.01.03.03.05", nom: "fragments spirituels", statut: "prêt" },
              { code: "N3.01.03.03.06", nom: "fragments poétiques", statut: "prêt" },
            ],
          },
        ],
      },
    ],
  },
  {
    code: "N1.02",
    nom: "Imaginer une histoire",
    enfants: [
      {
        code: "N2.02.01",
        nom: "Fiction narrative",
        enfants: [
          {
            code: "N3.02.01.01",
            nom: "Roman",
            enfants: [
              { code: "N3.02.01.01.01", nom: "littéraire / contemporain", statut: "prêt" },
              { code: "N3.02.01.01.02", nom: "historique", statut: "prêt" },
              { code: "N3.02.01.01.03", nom: "policier / thriller", statut: "prêt" },
              { code: "N3.02.01.01.04", nom: "science-fiction", statut: "prêt" },
              { code: "N3.02.01.01.05", nom: "fantasy / fantastique", statut: "prêt" },
              { code: "N3.02.01.01.06", nom: "romance", statut: "prêt" },
              { code: "N3.02.01.01.07", nom: "initiatique", statut: "prêt" },
              { code: "N3.02.01.01.08", nom: "psychologique", statut: "prêt" },
              { code: "N3.02.01.01.09", nom: "autofiction romanesque", statut: "prêt" },
              { code: "N3.02.01.01.10", nom: "feel-good / développement personnel romancé", statut: "prêt" },
            ],
          },
          {
            code: "N3.02.01.02",
            nom: "Nouvelle",
            enfants: [
              { code: "N3.02.01.02.01", nom: "nouvelle littéraire", statut: "prêt" },
              { code: "N3.02.01.02.02", nom: "nouvelle à chute", statut: "prêt" },
              { code: "N3.02.01.02.03", nom: "nouvelle fantastique", statut: "prêt" },
              { code: "N3.02.01.02.04", nom: "nouvelle policière", statut: "prêt" },
              { code: "N3.02.01.02.05", nom: "nouvelle réaliste", statut: "prêt" },
              { code: "N3.02.01.02.06", nom: "recueil de nouvelles", statut: "prêt" },
              { code: "N3.02.01.02.07", nom: "microfiction", statut: "prêt" },
            ],
          },
          {
            code: "N3.02.01.03",
            nom: "Conte",
            enfants: [
              { code: "N3.02.01.03.01", nom: "conte merveilleux", statut: "prêt" },
              { code: "N3.02.01.03.02", nom: "conte philosophique", statut: "prêt" },
              { code: "N3.02.01.03.03", nom: "conte initiatique", statut: "prêt" },
              { code: "N3.02.01.03.04", nom: "conte symbolique", statut: "prêt" },
              { code: "N3.02.01.03.05", nom: "conte pour enfants", statut: "prêt" },
              { code: "N3.02.01.03.06", nom: "conte moderne / réécriture", statut: "prêt" },
            ],
          },
          {
            code: "N3.02.01.04",
            nom: "Saga / série",
            enfants: [
              { code: "N3.02.01.04.01", nom: "saga familiale", statut: "partiel", aide: "Auditer tome/extrait et cohérence d'univers ; demander bible de série si nécessaire." },
              { code: "N3.02.01.04.02", nom: "série romanesque", statut: "partiel", aide: "Auditer tome/extrait et cohérence d'univers ; demander bible de série si nécessaire." },
              { code: "N3.02.01.04.03", nom: "cycle fantasy / SF", statut: "partiel", aide: "Auditer tome/extrait et cohérence d'univers ; demander bible de série si nécessaire." },
              { code: "N3.02.01.04.04", nom: "série jeunesse", statut: "partiel", aide: "Auditer tome/extrait et cohérence d'univers ; demander bible de série si nécessaire." },
              { code: "N3.02.01.04.05", nom: "univers partagé", statut: "partiel", aide: "Auditer tome/extrait et cohérence d'univers ; demander bible de série si nécessaire." },
              { code: "N3.02.01.04.06", nom: "feuilleton", statut: "partiel", aide: "Auditer tome/extrait et cohérence d'univers ; demander bible de série si nécessaire." },
            ],
          },
        ],
      },
      {
        code: "N2.02.02",
        nom: "Dramaturgie / audiovisuel",
        enfants: [
          {
            code: "N3.02.02.01",
            nom: "Théâtre",
            enfants: [
              { code: "N3.02.02.01.01", nom: "tragédie / drame", statut: "prêt" },
              { code: "N3.02.02.01.02", nom: "comédie", statut: "prêt" },
              { code: "N3.02.02.01.03", nom: "monologue", statut: "prêt" },
              { code: "N3.02.02.01.04", nom: "théâtre documentaire", statut: "prêt" },
              { code: "N3.02.02.01.05", nom: "théâtre jeune public", statut: "prêt" },
              { code: "N3.02.02.01.06", nom: "pièce courte", statut: "prêt" },
            ],
          },
          {
            code: "N3.02.02.02",
            nom: "Scénario",
            enfants: [
              { code: "N3.02.02.02.01", nom: "court métrage", statut: "partiel", aide: "Proposer audit narratif, mais prévoir format scénario plus tard si besoin." },
              { code: "N3.02.02.02.02", nom: "long métrage", statut: "partiel", aide: "Proposer audit narratif, mais prévoir format scénario plus tard si besoin." },
              { code: "N3.02.02.02.03", nom: "série TV", statut: "partiel", aide: "Proposer audit narratif, mais prévoir format scénario plus tard si besoin." },
              { code: "N3.02.02.02.04", nom: "web-série", statut: "partiel", aide: "Proposer audit narratif, mais prévoir format scénario plus tard si besoin." },
              { code: "N3.02.02.02.05", nom: "documentaire scénarisé", statut: "partiel", aide: "Proposer audit narratif, mais prévoir format scénario plus tard si besoin." },
              { code: "N3.02.02.02.06", nom: "script vidéo", statut: "partiel", aide: "Proposer audit narratif, mais prévoir format scénario plus tard si besoin." },
            ],
          },
          {
            code: "N3.02.02.03",
            nom: "Podcast fiction / audio",
            enfants: [
              { code: "N3.02.02.03.01", nom: "fiction sonore", statut: "partiel", aide: "Audit possible sur script ; son/design audio non audités finement." },
              { code: "N3.02.02.03.02", nom: "docu-fiction", statut: "partiel", aide: "Audit possible sur script ; son/design audio non audités finement." },
              { code: "N3.02.02.03.03", nom: "feuilleton audio", statut: "partiel", aide: "Audit possible sur script ; son/design audio non audités finement." },
              { code: "N3.02.02.03.04", nom: "conte audio", statut: "partiel", aide: "Audit possible sur script ; son/design audio non audités finement." },
              { code: "N3.02.02.03.05", nom: "théâtre radiophonique", statut: "partiel", aide: "Audit possible sur script ; son/design audio non audités finement." },
            ],
          },
        ],
      },
      {
        code: "N2.02.03",
        nom: "Image / narration séquentielle",
        enfants: [
          {
            code: "N3.02.03.01",
            nom: "Bande dessinée",
            enfants: [
              { code: "N3.02.03.01.01", nom: "album franco-belge", statut: "partiel", aide: "Auditer scénario/texte ; prévoir analyse planches/images si fichier visuel fourni." },
              { code: "N3.02.03.01.02", nom: "roman graphique", statut: "partiel", aide: "Auditer scénario/texte ; prévoir analyse planches/images si fichier visuel fourni." },
              { code: "N3.02.03.01.03", nom: "BD documentaire", statut: "partiel", aide: "Auditer scénario/texte ; prévoir analyse planches/images si fichier visuel fourni." },
              { code: "N3.02.03.01.04", nom: "BD autobiographique", statut: "partiel", aide: "Auditer scénario/texte ; prévoir analyse planches/images si fichier visuel fourni." },
              { code: "N3.02.03.01.05", nom: "BD jeunesse", statut: "partiel", aide: "Auditer scénario/texte ; prévoir analyse planches/images si fichier visuel fourni." },
              { code: "N3.02.03.01.06", nom: "humour / strip", statut: "partiel", aide: "Auditer scénario/texte ; prévoir analyse planches/images si fichier visuel fourni." },
            ],
          },
          {
            code: "N3.02.03.02",
            nom: "Manga / Webtoon",
            enfants: [
              { code: "N3.02.03.02.01", nom: "manga shōnen", statut: "partiel", aide: "Audit narratif possible ; codes graphiques à traiter en module dédié." },
              { code: "N3.02.03.02.02", nom: "manga shōjo", statut: "partiel", aide: "Audit narratif possible ; codes graphiques à traiter en module dédié." },
              { code: "N3.02.03.02.03", nom: "seinen / josei", statut: "partiel", aide: "Audit narratif possible ; codes graphiques à traiter en module dédié." },
              { code: "N3.02.03.02.04", nom: "webtoon vertical", statut: "partiel", aide: "Audit narratif possible ; codes graphiques à traiter en module dédié." },
              { code: "N3.02.03.02.05", nom: "manhwa / manhua", statut: "partiel", aide: "Audit narratif possible ; codes graphiques à traiter en module dédié." },
              { code: "N3.02.03.02.06", nom: "one-shot", statut: "partiel", aide: "Audit narratif possible ; codes graphiques à traiter en module dédié." },
            ],
          },
          {
            code: "N3.02.03.03",
            nom: "Album illustré",
            enfants: [
              { code: "N3.02.03.03.01", nom: "album jeunesse", statut: "partiel", aide: "Analyser texte/intention ; demander images pour cohérence texte-image." },
              { code: "N3.02.03.03.02", nom: "album poétique", statut: "partiel", aide: "Analyser texte/intention ; demander images pour cohérence texte-image." },
              { code: "N3.02.03.03.03", nom: "album documentaire", statut: "partiel", aide: "Analyser texte/intention ; demander images pour cohérence texte-image." },
              { code: "N3.02.03.03.04", nom: "livre d’images sans texte", statut: "partiel", aide: "Analyser texte/intention ; demander images pour cohérence texte-image." },
              { code: "N3.02.03.03.05", nom: "conte illustré", statut: "partiel", aide: "Analyser texte/intention ; demander images pour cohérence texte-image." },
            ],
          },
        ],
      },
      {
        code: "N2.02.04",
        nom: "Narration interactive",
        enfants: [
          {
            code: "N3.02.04.01",
            nom: "Fiction interactive",
            enfants: [
              { code: "N3.02.04.01.01", nom: "livre dont vous êtes le héros", statut: "partiel", aide: "Auditer structure et cohérence ; module graphe interactif à développer si projet complexe. Contenu fait d'embranchements courts et autonomes plutôt que d'un fil narratif continu — CursAudit en tient compte et ne signale pas l'absence d'arc linéaire comme un défaut." },
              { code: "N3.02.04.01.02", nom: "récit à embranchements", statut: "partiel", aide: "Auditer structure et cohérence ; module graphe interactif à développer si projet complexe. Contenu fait d'embranchements courts et autonomes plutôt que d'un fil narratif continu — CursAudit en tient compte et ne signale pas l'absence d'arc linéaire comme un défaut." },
              { code: "N3.02.04.01.03", nom: "jeu narratif textuel", statut: "partiel", aide: "Auditer structure et cohérence ; module graphe interactif à développer si projet complexe. Contenu fait d'embranchements courts et autonomes plutôt que d'un fil narratif continu — CursAudit en tient compte et ne signale pas l'absence d'arc linéaire comme un défaut." },
              { code: "N3.02.04.01.04", nom: "visual novel", statut: "partiel", aide: "Auditer structure et cohérence ; module graphe interactif à développer si projet complexe. Contenu fait d'embranchements courts et autonomes plutôt que d'un fil narratif continu — CursAudit en tient compte et ne signale pas l'absence d'arc linéaire comme un défaut." },
              { code: "N3.02.04.01.05", nom: "escape book", statut: "partiel", aide: "Auditer structure et cohérence ; module graphe interactif à développer si projet complexe. Contenu fait d'embranchements courts et autonomes plutôt que d'un fil narratif continu — CursAudit en tient compte et ne signale pas l'absence d'arc linéaire comme un défaut." },
            ],
          },
        ],
      },
    ],
  },
  {
    code: "N1.03",
    nom: "Transmettre / questionner / accompagner",
    enfants: [
      {
        code: "N2.03.01",
        nom: "Philosophie / pensée",
        enfants: [
          {
            code: "N3.03.01.01",
            nom: "Essai philosophique",
            enfants: [
              { code: "N3.03.01.01.01", nom: "essai argumentatif", statut: "prêt" },
              { code: "N3.03.01.01.02", nom: "méditation philosophique", statut: "prêt" },
              { code: "N3.03.01.01.03", nom: "philosophie pratique", statut: "prêt" },
              { code: "N3.03.01.01.04", nom: "philosophie politique", statut: "prêt" },
              { code: "N3.03.01.01.05", nom: "philosophie existentielle", statut: "prêt" },
              { code: "N3.03.01.01.06", nom: "vulgarisation philosophique", statut: "prêt" },
            ],
          },
          {
            code: "N3.03.01.02",
            nom: "Dialogue / conversation philosophique",
            enfants: [
              { code: "N3.03.01.02.01", nom: "dialogue socratique", statut: "prêt" },
              { code: "N3.03.01.02.02", nom: "dialogue pédagogique", statut: "prêt" },
              { code: "N3.03.01.02.03", nom: "conversation fictive", statut: "prêt" },
              { code: "N3.03.01.02.04", nom: "entretien philosophique", statut: "prêt" },
              { code: "N3.03.01.02.05", nom: "controverse", statut: "prêt" },
            ],
          },
          {
            code: "N3.03.01.03",
            nom: "Aphorismes / méditations",
            enfants: [
              { code: "N3.03.01.03.01", nom: "aphorismes", statut: "prêt" },
              { code: "N3.03.01.03.02", nom: "fragments de sagesse", statut: "prêt" },
              { code: "N3.03.01.03.03", nom: "méditations brèves", statut: "prêt" },
              { code: "N3.03.01.03.04", nom: "pensées classées", statut: "prêt" },
              { code: "N3.03.01.03.05", nom: "maximes commentées", statut: "prêt" },
            ],
          },
        ],
      },
      {
        code: "N2.03.02",
        nom: "Spiritualité / religion / sagesse",
        enfants: [
          {
            code: "N3.03.02.01",
            nom: "Commentaire religieux / biblique",
            enfants: [
              { code: "N3.03.02.01.01", nom: "commentaire biblique", statut: "partiel", aide: "Auditer cohérence, fidélité au texte et position d'énonciation ; ne pas trancher doctrinalement sans cadre déclaré." },
              { code: "N3.03.02.01.02", nom: "commentaire coranique", statut: "partiel", aide: "Auditer cohérence, fidélité au texte et position d'énonciation ; ne pas trancher doctrinalement sans cadre déclaré." },
              { code: "N3.03.02.01.03", nom: "commentaire de texte sacré", statut: "partiel", aide: "Auditer cohérence, fidélité au texte et position d'énonciation ; ne pas trancher doctrinalement sans cadre déclaré." },
              { code: "N3.03.02.01.04", nom: "lecture spirituelle appliquée", statut: "partiel", aide: "Auditer cohérence, fidélité au texte et position d'énonciation ; ne pas trancher doctrinalement sans cadre déclaré." },
              { code: "N3.03.02.01.05", nom: "exégèse grand public", statut: "partiel", aide: "Auditer cohérence, fidélité au texte et position d'énonciation ; ne pas trancher doctrinalement sans cadre déclaré." },
            ],
          },
          {
            code: "N3.03.02.02",
            nom: "Méditation spirituelle / biblique",
            enfants: [
              { code: "N3.03.02.02.01", nom: "méditation biblique", statut: "prêt" },
              { code: "N3.03.02.02.02", nom: "lectio divina adaptée", statut: "prêt" },
              { code: "N3.03.02.02.03", nom: "méditation chrétienne", statut: "prêt" },
              { code: "N3.03.02.02.04", nom: "méditation interspirituelle", statut: "prêt" },
              { code: "N3.03.02.02.05", nom: "méditation quotidienne", statut: "prêt" },
              { code: "N3.03.02.02.06", nom: "parcours de carême / retraite", statut: "prêt" },
            ],
          },
          {
            code: "N3.03.02.03",
            nom: "Oracle / cartes méditatives",
            enfants: [
              { code: "N3.03.02.03.01", nom: "oracle méditatif chrétien", statut: "prêt" },
              { code: "N3.03.02.03.02", nom: "cartes de sagesse", statut: "prêt" },
              { code: "N3.03.02.03.03", nom: "cartes bibliques", statut: "prêt" },
              { code: "N3.03.02.03.04", nom: "cartes de réflexion existentielle", statut: "prêt" },
              { code: "N3.03.02.03.05", nom: "cartes spirituelles non divinatoires", statut: "prêt" },
              { code: "N3.03.02.03.06", nom: "livret de cartes", statut: "prêt" },
            ],
          },
          {
            code: "N3.03.02.04",
            nom: "Prière / texte liturgique",
            enfants: [
              { code: "N3.03.02.04.01", nom: "recueil de prières", statut: "partiel", aide: "Audit littéraire/spirituel possible ; validation liturgique institutionnelle non fournie." },
              { code: "N3.03.02.04.02", nom: "neuvaine / parcours spirituel", statut: "partiel", aide: "Audit littéraire/spirituel possible ; validation liturgique institutionnelle non fournie." },
              { code: "N3.03.02.04.03", nom: "texte liturgique", statut: "partiel", aide: "Audit littéraire/spirituel possible ; validation liturgique institutionnelle non fournie." },
              { code: "N3.03.02.04.04", nom: "chants / hymnes", statut: "partiel", aide: "Audit littéraire/spirituel possible ; validation liturgique institutionnelle non fournie." },
              { code: "N3.03.02.04.05", nom: "rite familial / communautaire", statut: "partiel", aide: "Audit littéraire/spirituel possible ; validation liturgique institutionnelle non fournie." },
            ],
          },
          {
            code: "N3.03.02.05",
            nom: "Témoignage spirituel",
            enfants: [
              { code: "N3.03.02.05.01", nom: "conversion", statut: "prêt" },
              { code: "N3.03.02.05.02", nom: "vocation", statut: "prêt" },
              { code: "N3.03.02.05.03", nom: "guérison spirituelle", statut: "prêt" },
              { code: "N3.03.02.05.04", nom: "quête mystique", statut: "prêt" },
              { code: "N3.03.02.05.05", nom: "chemin de foi", statut: "prêt" },
              { code: "N3.03.02.05.06", nom: "récit de retraite", statut: "prêt" },
            ],
          },
        ],
      },
      {
        code: "N2.03.03",
        nom: "Développement personnel / accompagnement",
        enfants: [
          {
            code: "N3.03.03.01",
            nom: "Guide pratique",
            enfants: [
              { code: "N3.03.03.01.01", nom: "guide d’introspection", statut: "partiel", aide: "Vigilance si promesses de santé/psychologie ; demander profil auteur." },
              { code: "N3.03.03.01.02", nom: "guide relationnel", statut: "partiel", aide: "Vigilance si promesses de santé/psychologie ; demander profil auteur." },
              { code: "N3.03.03.01.03", nom: "guide de créativité", statut: "partiel", aide: "Vigilance si promesses de santé/psychologie ; demander profil auteur." },
              { code: "N3.03.03.01.04", nom: "guide de transition de vie", statut: "partiel", aide: "Vigilance si promesses de santé/psychologie ; demander profil auteur." },
              { code: "N3.03.03.01.05", nom: "guide d’organisation personnelle", statut: "partiel", aide: "Vigilance si promesses de santé/psychologie ; demander profil auteur." },
              { code: "N3.03.03.01.06", nom: "guide de mieux-être", statut: "partiel", aide: "Vigilance si promesses de santé/psychologie ; demander profil auteur." },
            ],
          },
          {
            code: "N3.03.03.02",
            nom: "Manuel d’auto-analyse",
            enfants: [
              { code: "N3.03.03.02.01", nom: "manuel thérapeutique personnel", statut: "partiel", aide: "Rappeler que l'audit éditorial ne remplace pas un avis clinique." },
              { code: "N3.03.03.02.02", nom: "manuel d’auto-questionnement", statut: "partiel", aide: "Rappeler que l'audit éditorial ne remplace pas un avis clinique." },
              { code: "N3.03.03.02.03", nom: "cahier d’auto-observation", statut: "partiel", aide: "Rappeler que l'audit éditorial ne remplace pas un avis clinique." },
              { code: "N3.03.03.02.04", nom: "parcours d’introspection", statut: "partiel", aide: "Rappeler que l'audit éditorial ne remplace pas un avis clinique." },
              { code: "N3.03.03.02.05", nom: "méthode personnelle", statut: "partiel", aide: "Rappeler que l'audit éditorial ne remplace pas un avis clinique." },
            ],
          },
          {
            code: "N3.03.03.03",
            nom: "Cahier d’exercices / workbook",
            enfants: [
              { code: "N3.03.03.03.01", nom: "cahier guidé", statut: "prêt" },
              { code: "N3.03.03.03.02", nom: "exercices d’écriture", statut: "prêt" },
              { code: "N3.03.03.03.03", nom: "exercices corporels", statut: "prêt" },
              { code: "N3.03.03.03.04", nom: "journal guidé", statut: "prêt" },
              { code: "N3.03.03.03.05", nom: "parcours en étapes", statut: "prêt" },
              { code: "N3.03.03.03.06", nom: "programme hebdomadaire", statut: "prêt" },
            ],
          },
          {
            code: "N3.03.03.04",
            nom: "Programme d’accompagnement",
            enfants: [
              { code: "N3.03.03.04.01", nom: "coaching", statut: "partiel", aide: "Clarifier promesse, cadre, conditions d’usage, limites." },
              { code: "N3.03.03.04.02", nom: "formation courte", statut: "partiel", aide: "Clarifier promesse, cadre, conditions d’usage, limites." },
              { code: "N3.03.03.04.03", nom: "parcours en ligne", statut: "partiel", aide: "Clarifier promesse, cadre, conditions d’usage, limites." },
              { code: "N3.03.03.04.04", nom: "atelier présentiel", statut: "partiel", aide: "Clarifier promesse, cadre, conditions d’usage, limites." },
              { code: "N3.03.03.04.05", nom: "programme de couple", statut: "partiel", aide: "Clarifier promesse, cadre, conditions d’usage, limites." },
              { code: "N3.03.03.04.06", nom: "programme professionnel", statut: "partiel", aide: "Clarifier promesse, cadre, conditions d’usage, limites." },
            ],
          },
        ],
      },
      {
        code: "N2.03.04",
        nom: "Société / éthique / politique",
        enfants: [
          {
            code: "N3.03.04.01",
            nom: "Essai sociétal",
            enfants: [
              { code: "N3.03.04.01.01", nom: "essai féministe", statut: "prêt" },
              { code: "N3.03.04.01.02", nom: "essai politique", statut: "prêt" },
              { code: "N3.03.04.01.03", nom: "essai économique", statut: "prêt" },
              { code: "N3.03.04.01.04", nom: "essai culturel", statut: "prêt" },
              { code: "N3.03.04.01.05", nom: "essai sur le travail", statut: "prêt" },
              { code: "N3.03.04.01.06", nom: "essai écologique", statut: "prêt" },
            ],
          },
          {
            code: "N3.03.04.02",
            nom: "Manifeste / plaidoyer",
            enfants: [
              { code: "N3.03.04.02.01", nom: "manifeste", statut: "prêt" },
              { code: "N3.03.04.02.02", nom: "tribune longue", statut: "prêt" },
              { code: "N3.03.04.02.03", nom: "plaidoyer associatif", statut: "prêt" },
              { code: "N3.03.04.02.04", nom: "appel citoyen", statut: "prêt" },
              { code: "N3.03.04.02.05", nom: "texte militant", statut: "prêt" },
            ],
          },
        ],
      },
    ],
  },
  {
    code: "N1.04",
    nom: "Expliquer / enseigner / transmettre un savoir",
    enfants: [
      {
        code: "N2.04.01",
        nom: "Pédagogie / formation",
        enfants: [
          {
            code: "N3.04.01.01",
            nom: "Manuel pédagogique",
            enfants: [
              { code: "N3.04.01.01.01", nom: "manuel scolaire", statut: "prêt" },
              { code: "N3.04.01.01.02", nom: "manuel de formation adulte", statut: "prêt" },
              { code: "N3.04.01.01.03", nom: "manuel universitaire", statut: "prêt" },
              { code: "N3.04.01.01.04", nom: "manuel autodidacte", statut: "prêt" },
              { code: "N3.04.01.01.05", nom: "support enseignant", statut: "prêt" },
            ],
          },
          {
            code: "N3.04.01.02",
            nom: "Support de cours / syllabus",
            enfants: [
              { code: "N3.04.01.02.01", nom: "syllabus", statut: "prêt" },
              { code: "N3.04.01.02.02", nom: "cours magistral", statut: "prêt" },
              { code: "N3.04.01.02.03", nom: "atelier", statut: "prêt" },
              { code: "N3.04.01.02.04", nom: "support PowerPoint transformé en texte", statut: "prêt" },
              { code: "N3.04.01.02.05", nom: "notes de formation", statut: "prêt" },
            ],
          },
          {
            code: "N3.04.01.03",
            nom: "Guide pas-à-pas / tutoriel",
            enfants: [
              { code: "N3.04.01.03.01", nom: "tutoriel technique", statut: "prêt" },
              { code: "N3.04.01.03.02", nom: "procédure métier", statut: "prêt" },
              { code: "N3.04.01.03.03", nom: "mode d’emploi", statut: "prêt" },
              { code: "N3.04.01.03.04", nom: "recette / méthode", statut: "prêt" },
              { code: "N3.04.01.03.05", nom: "guide d'installation", statut: "prêt" },
            ],
          },
        ],
      },
      {
        code: "N2.04.02",
        nom: "Vulgarisation",
        enfants: [
          {
            code: "N3.04.02.01",
            nom: "Vulgarisation scientifique",
            enfants: [
              { code: "N3.04.02.01.01", nom: "sciences du vivant", statut: "partiel", aide: "Auditer clarté/sources ; faits actuels à vérifier si publication." },
              { code: "N3.04.02.01.02", nom: "physique / cosmologie", statut: "partiel", aide: "Auditer clarté/sources ; faits actuels à vérifier si publication." },
              { code: "N3.04.02.01.03", nom: "psychologie / neurosciences", statut: "partiel", aide: "Auditer clarté/sources ; faits actuels à vérifier si publication." },
              { code: "N3.04.02.01.04", nom: "médecine / santé", statut: "partiel", aide: "Auditer clarté/sources ; faits actuels à vérifier si publication." },
              { code: "N3.04.02.01.05", nom: "technologie / IA", statut: "partiel", aide: "Auditer clarté/sources ; faits actuels à vérifier si publication." },
              { code: "N3.04.02.01.06", nom: "environnement", statut: "partiel", aide: "Auditer clarté/sources ; faits actuels à vérifier si publication." },
            ],
          },
          {
            code: "N3.04.02.02",
            nom: "Vulgarisation historique / culturelle",
            enfants: [
              { code: "N3.04.02.02.01", nom: "histoire générale", statut: "prêt" },
              { code: "N3.04.02.02.02", nom: "histoire locale", statut: "prêt" },
              { code: "N3.04.02.02.03", nom: "histoire des idées", statut: "prêt" },
              { code: "N3.04.02.02.04", nom: "patrimoine", statut: "prêt" },
              { code: "N3.04.02.02.05", nom: "biographie vulgarisée", statut: "prêt" },
              { code: "N3.04.02.02.06", nom: "histoire religieuse", statut: "prêt" },
            ],
          },
          {
            code: "N3.04.02.03",
            nom: "Vulgarisation professionnelle",
            enfants: [
              { code: "N3.04.02.03.01", nom: "gestion / management", statut: "prêt" },
              { code: "N3.04.02.03.02", nom: "RH / organisation", statut: "prêt" },
              { code: "N3.04.02.03.03", nom: "marketing / vente", statut: "prêt" },
              { code: "N3.04.02.03.04", nom: "droit / administratif", statut: "prêt" },
              { code: "N3.04.02.03.05", nom: "finance personnelle", statut: "prêt" },
              { code: "N3.04.02.03.06", nom: "entrepreneuriat", statut: "prêt" },
            ],
          },
        ],
      },
      {
        code: "N2.04.03",
        nom: "Académique / recherche",
        enfants: [
          {
            code: "N3.04.03.01",
            nom: "Mémoire / TFE",
            enfants: [
              { code: "N3.04.03.01.01", nom: "mémoire universitaire", statut: "partiel", aide: "Audit éditorial/argumentatif ; vérifier contraintes institutionnelles fournies." },
              { code: "N3.04.03.01.02", nom: "TFE", statut: "partiel", aide: "Audit éditorial/argumentatif ; vérifier contraintes institutionnelles fournies." },
              { code: "N3.04.03.01.03", nom: "rapport de stage long", statut: "partiel", aide: "Audit éditorial/argumentatif ; vérifier contraintes institutionnelles fournies." },
              { code: "N3.04.03.01.04", nom: "mémoire professionnel", statut: "partiel", aide: "Audit éditorial/argumentatif ; vérifier contraintes institutionnelles fournies." },
              { code: "N3.04.03.01.05", nom: "travail de fin de formation", statut: "partiel", aide: "Audit éditorial/argumentatif ; vérifier contraintes institutionnelles fournies." },
            ],
          },
          {
            code: "N3.04.03.02",
            nom: "Article scientifique / communication",
            enfants: [
              { code: "N3.04.03.02.01", nom: "article empirique", statut: "partiel", aide: "Audit structurel possible ; normes disciplinaires à fournir." },
              { code: "N3.04.03.02.02", nom: "article théorique", statut: "partiel", aide: "Audit structurel possible ; normes disciplinaires à fournir." },
              { code: "N3.04.03.02.03", nom: "communication colloque", statut: "partiel", aide: "Audit structurel possible ; normes disciplinaires à fournir." },
              { code: "N3.04.03.02.04", nom: "poster scientifique", statut: "partiel", aide: "Audit structurel possible ; normes disciplinaires à fournir." },
              { code: "N3.04.03.02.05", nom: "working paper", statut: "partiel", aide: "Audit structurel possible ; normes disciplinaires à fournir." },
            ],
          },
          {
            code: "N3.04.03.03",
            nom: "Revue de littérature / synthèse",
            enfants: [
              { code: "N3.04.03.03.01", nom: "revue narrative", statut: "partiel", aide: "CursAudit peut auditer structure ; vérification exhaustive des sources à module dédié." },
              { code: "N3.04.03.03.02", nom: "revue systématique", statut: "partiel", aide: "CursAudit peut auditer structure ; vérification exhaustive des sources à module dédié." },
              { code: "N3.04.03.03.03", nom: "état de l’art", statut: "partiel", aide: "CursAudit peut auditer structure ; vérification exhaustive des sources à module dédié." },
              { code: "N3.04.03.03.04", nom: "note de synthèse", statut: "partiel", aide: "CursAudit peut auditer structure ; vérification exhaustive des sources à module dédié." },
              { code: "N3.04.03.03.05", nom: "bibliographie commentée", statut: "partiel", aide: "CursAudit peut auditer structure ; vérification exhaustive des sources à module dédié." },
            ],
          },
        ],
      },
      {
        code: "N2.04.04",
        nom: "Pratique métier",
        enfants: [
          {
            code: "N3.04.04.01",
            nom: "Méthode professionnelle",
            enfants: [
              { code: "N3.04.04.01.01", nom: "méthode de conseil", statut: "partiel", aide: "Demander profil auteur, cadre, limites, preuves." },
              { code: "N3.04.04.01.02", nom: "méthode thérapeutique / accompagnement", statut: "partiel", aide: "Demander profil auteur, cadre, limites, preuves." },
              { code: "N3.04.04.01.03", nom: "méthode pédagogique", statut: "partiel", aide: "Demander profil auteur, cadre, limites, preuves." },
              { code: "N3.04.04.01.04", nom: "méthode de management", statut: "partiel", aide: "Demander profil auteur, cadre, limites, preuves." },
              { code: "N3.04.04.01.05", nom: "méthode créative", statut: "partiel", aide: "Demander profil auteur, cadre, limites, preuves." },
            ],
          },
          {
            code: "N3.04.04.02",
            nom: "Livre blanc / guide expert",
            enfants: [
              { code: "N3.04.04.02.01", nom: "livre blanc", statut: "prêt" },
              { code: "N3.04.04.02.02", nom: "rapport expert", statut: "prêt" },
              { code: "N3.04.04.02.03", nom: "guide secteur", statut: "prêt" },
              { code: "N3.04.04.02.04", nom: "benchmark", statut: "prêt" },
              { code: "N3.04.04.02.05", nom: "note stratégique", statut: "prêt" },
            ],
          },
        ],
      },
    ],
  },
  {
    code: "N1.05",
    nom: "Enquêter / documenter / informer",
    enfants: [
      {
        code: "N2.05.01",
        nom: "Non-fiction narrative",
        enfants: [
          {
            code: "N3.05.01.01",
            nom: "Reportage",
            enfants: [
              { code: "N3.05.01.01.01", nom: "reportage de terrain", statut: "partiel", aide: "Auditer récit et sources ; fact-check externe si nécessaire." },
              { code: "N3.05.01.01.02", nom: "grand reportage", statut: "partiel", aide: "Auditer récit et sources ; fact-check externe si nécessaire." },
              { code: "N3.05.01.01.03", nom: "reportage social", statut: "partiel", aide: "Auditer récit et sources ; fact-check externe si nécessaire." },
              { code: "N3.05.01.01.04", nom: "reportage de voyage", statut: "partiel", aide: "Auditer récit et sources ; fact-check externe si nécessaire." },
              { code: "N3.05.01.01.05", nom: "reportage photographique commenté", statut: "partiel", aide: "Auditer récit et sources ; fact-check externe si nécessaire." },
            ],
          },
          {
            code: "N3.05.01.02",
            nom: "Enquête",
            enfants: [
              { code: "N3.05.01.02.01", nom: "enquête journalistique", statut: "partiel", aide: "Nécessite sources/notes ; CursAudit signale ce qui manque mais ne prouve pas tout." },
              { code: "N3.05.01.02.02", nom: "enquête personnelle", statut: "partiel", aide: "Nécessite sources/notes ; CursAudit signale ce qui manque mais ne prouve pas tout." },
              { code: "N3.05.01.02.03", nom: "enquête historique", statut: "partiel", aide: "Nécessite sources/notes ; CursAudit signale ce qui manque mais ne prouve pas tout." },
              { code: "N3.05.01.02.04", nom: "enquête sociologique grand public", statut: "partiel", aide: "Nécessite sources/notes ; CursAudit signale ce qui manque mais ne prouve pas tout." },
              { code: "N3.05.01.02.05", nom: "contre-enquête", statut: "partiel", aide: "Nécessite sources/notes ; CursAudit signale ce qui manque mais ne prouve pas tout." },
            ],
          },
          {
            code: "N3.05.01.03",
            nom: "Portrait / biographie",
            enfants: [
              { code: "N3.05.01.03.01", nom: "portrait long", statut: "prêt" },
              { code: "N3.05.01.03.02", nom: "biographie", statut: "prêt" },
              { code: "N3.05.01.03.03", nom: "biographie romancée", statut: "prêt" },
              { code: "N3.05.01.03.04", nom: "portrait professionnel", statut: "prêt" },
              { code: "N3.05.01.03.05", nom: "portrait familial", statut: "prêt" },
            ],
          },
        ],
      },
      {
        code: "N2.05.02",
        nom: "Histoire / archives / patrimoine",
        enfants: [
          {
            code: "N3.05.02.01",
            nom: "Monographie historique",
            enfants: [
              { code: "N3.05.02.01.01", nom: "histoire locale", statut: "partiel", aide: "Audit éditorial ; exactitude historique à vérifier par sources." },
              { code: "N3.05.02.01.02", nom: "histoire familiale", statut: "partiel", aide: "Audit éditorial ; exactitude historique à vérifier par sources." },
              { code: "N3.05.02.01.03", nom: "histoire d’une institution", statut: "partiel", aide: "Audit éditorial ; exactitude historique à vérifier par sources." },
              { code: "N3.05.02.01.04", nom: "histoire d’un mouvement", statut: "partiel", aide: "Audit éditorial ; exactitude historique à vérifier par sources." },
              { code: "N3.05.02.01.05", nom: "histoire religieuse", statut: "partiel", aide: "Audit éditorial ; exactitude historique à vérifier par sources." },
            ],
          },
          {
            code: "N3.05.02.02",
            nom: "Généalogie / récit familial documenté",
            enfants: [
              { code: "N3.05.02.02.01", nom: "arbre familial commenté", statut: "prêt" },
              { code: "N3.05.02.02.02", nom: "archives familiales", statut: "prêt" },
              { code: "N3.05.02.02.03", nom: "récit d’ancêtres", statut: "prêt" },
              { code: "N3.05.02.02.04", nom: "migration familiale", statut: "prêt" },
              { code: "N3.05.02.02.05", nom: "mémoire d’une lignée", statut: "prêt" },
            ],
          },
        ],
      },
      {
        code: "N2.05.03",
        nom: "Critique / analyse de corpus",
        enfants: [
          {
            code: "N3.05.03.01",
            nom: "Critique littéraire / artistique",
            enfants: [
              { code: "N3.05.03.01.01", nom: "critique de livre", statut: "prêt" },
              { code: "N3.05.03.01.02", nom: "critique d’exposition", statut: "prêt" },
              { code: "N3.05.03.01.03", nom: "critique de film", statut: "prêt" },
              { code: "N3.05.03.01.04", nom: "analyse d’œuvre", statut: "prêt" },
              { code: "N3.05.03.01.05", nom: "essai critique", statut: "prêt" },
            ],
          },
          {
            code: "N3.05.03.02",
            nom: "Dossier thématique",
            enfants: [
              { code: "N3.05.03.02.01", nom: "dossier documentaire", statut: "prêt" },
              { code: "N3.05.03.02.02", nom: "dossier pédagogique", statut: "prêt" },
              { code: "N3.05.03.02.03", nom: "dossier de presse analytique", statut: "prêt" },
              { code: "N3.05.03.02.04", nom: "synthèse comparative", statut: "prêt" },
              { code: "N3.05.03.02.05", nom: "chronologie commentée", statut: "prêt" },
            ],
          },
        ],
      },
    ],
  },
  {
    code: "N1.06",
    nom: "Créer un outil / dispositif éditorial",
    enfants: [
      {
        code: "N2.06.01",
        nom: "Cartes / supports modulaires",
        enfants: [
          {
            code: "N3.06.01.01",
            nom: "Oracle / jeu de cartes",
            enfants: [
              { code: "N3.06.01.01.01", nom: "oracle méditatif", statut: "partiel", aide: "Clarifier usage, non-divinatoire si nécessaire, sécurité et livret. Contenu fait de cartes/entrées courtes et autonomes plutôt que d'un fil narratif continu — CursAudit en tient compte et ne signale pas l'absence d'arc linéaire comme un défaut." },
              { code: "N3.06.01.01.02", nom: "oracle spirituel non divinatoire", statut: "partiel", aide: "Clarifier usage, non-divinatoire si nécessaire, sécurité et livret. Contenu fait de cartes/entrées courtes et autonomes plutôt que d'un fil narratif continu — CursAudit en tient compte et ne signale pas l'absence d'arc linéaire comme un défaut." },
              { code: "N3.06.01.01.03", nom: "cartes bibliques", statut: "partiel", aide: "Clarifier usage, non-divinatoire si nécessaire, sécurité et livret. Contenu fait de cartes/entrées courtes et autonomes plutôt que d'un fil narratif continu — CursAudit en tient compte et ne signale pas l'absence d'arc linéaire comme un défaut." },
              { code: "N3.06.01.01.04", nom: "cartes thérapeutiques à cadrer", statut: "partiel", aide: "Clarifier usage, non-divinatoire si nécessaire, sécurité et livret. Contenu fait de cartes/entrées courtes et autonomes plutôt que d'un fil narratif continu — CursAudit en tient compte et ne signale pas l'absence d'arc linéaire comme un défaut." },
              { code: "N3.06.01.01.05", nom: "cartes de coaching", statut: "partiel", aide: "Clarifier usage, non-divinatoire si nécessaire, sécurité et livret. Contenu fait de cartes/entrées courtes et autonomes plutôt que d'un fil narratif continu — CursAudit en tient compte et ne signale pas l'absence d'arc linéaire comme un défaut." },
              { code: "N3.06.01.01.06", nom: "cartes pédagogiques", statut: "partiel", aide: "Clarifier usage, non-divinatoire si nécessaire, sécurité et livret. Contenu fait de cartes/entrées courtes et autonomes plutôt que d'un fil narratif continu — CursAudit en tient compte et ne signale pas l'absence d'arc linéaire comme un défaut." },
            ],
          },
          {
            code: "N3.06.01.02",
            nom: "Livret d’accompagnement",
            enfants: [
              { code: "N3.06.01.02.01", nom: "livret de cartes", statut: "prêt" },
              { code: "N3.06.01.02.02", nom: "livret d’exercices", statut: "prêt" },
              { code: "N3.06.01.02.03", nom: "livret spirituel", statut: "prêt" },
              { code: "N3.06.01.02.04", nom: "livret pédagogique", statut: "prêt" },
              { code: "N3.06.01.02.05", nom: "guide utilisateur", statut: "prêt" },
            ],
          },
        ],
      },
      {
        code: "N2.06.02",
        nom: "Méthodes / grilles",
        enfants: [
          {
            code: "N3.06.02.01",
            nom: "Questionnaire / auto-diagnostic",
            enfants: [
              { code: "N3.06.02.01.01", nom: "questionnaire auteur", statut: "partiel", aide: "Cadrer comme outil éditorial ; validation psychométrique non fournie." },
              { code: "N3.06.02.01.02", nom: "questionnaire thérapeutique à cadrer", statut: "partiel", aide: "Cadrer comme outil éditorial ; validation psychométrique non fournie." },
              { code: "N3.06.02.01.03", nom: "auto-évaluation professionnelle", statut: "partiel", aide: "Cadrer comme outil éditorial ; validation psychométrique non fournie." },
              { code: "N3.06.02.01.04", nom: "test pédagogique", statut: "partiel", aide: "Cadrer comme outil éditorial ; validation psychométrique non fournie." },
              { code: "N3.06.02.01.05", nom: "grille d’entretien", statut: "partiel", aide: "Cadrer comme outil éditorial ; validation psychométrique non fournie." },
            ],
          },
          {
            code: "N3.06.02.02",
            nom: "Grille d’audit / checklist",
            enfants: [
              { code: "N3.06.02.02.01", nom: "grille éditoriale", statut: "prêt" },
              { code: "N3.06.02.02.02", nom: "checklist qualité", statut: "prêt" },
              { code: "N3.06.02.02.03", nom: "grille de relecture", statut: "prêt" },
              { code: "N3.06.02.02.04", nom: "rubrique pédagogique", statut: "prêt" },
              { code: "N3.06.02.02.05", nom: "scorecard professionnelle", statut: "prêt" },
            ],
          },
        ],
      },
      {
        code: "N2.06.03",
        nom: "Parcours / produits éditoriaux",
        enfants: [
          {
            code: "N3.06.03.01",
            nom: "Parcours guidé",
            enfants: [
              { code: "N3.06.03.01.01", nom: "parcours 7 jours", statut: "prêt" },
              { code: "N3.06.03.01.02", nom: "parcours 21 jours", statut: "prêt" },
              { code: "N3.06.03.01.03", nom: "retraite guidée", statut: "prêt" },
              { code: "N3.06.03.01.04", nom: "défi d’écriture", statut: "prêt" },
              { code: "N3.06.03.01.05", nom: "programme de lecture", statut: "prêt" },
            ],
          },
          {
            code: "N3.06.03.02",
            nom: "Newsletter / série éditoriale",
            enfants: [
              { code: "N3.06.03.02.01", nom: "newsletter narrative", statut: "partiel", aide: "Auditer textes et structure ; métriques marketing hors périmètre." },
              { code: "N3.06.03.02.02", nom: "newsletter pédagogique", statut: "partiel", aide: "Auditer textes et structure ; métriques marketing hors périmètre." },
              { code: "N3.06.03.02.03", nom: "série d’emails", statut: "partiel", aide: "Auditer textes et structure ; métriques marketing hors périmètre." },
              { code: "N3.06.03.02.04", nom: "chronique récurrente", statut: "partiel", aide: "Auditer textes et structure ; métriques marketing hors périmètre." },
              { code: "N3.06.03.02.05", nom: "séquence de lancement", statut: "partiel", aide: "Auditer textes et structure ; métriques marketing hors périmètre." },
            ],
          },
        ],
      },
      {
        code: "N2.06.04",
        nom: "Numérique / interactif",
        enfants: [
          {
            code: "N3.06.04.01",
            nom: "Application texte / chatbot éditorial",
            enfants: [
              { code: "N3.06.04.01.01", nom: "copilote d’écriture", statut: "à développer", aide: "Proposer cadrage éditorial proche ; audit technique produit à construire." },
              { code: "N3.06.04.01.02", nom: "assistant de lecture", statut: "à développer", aide: "Proposer cadrage éditorial proche ; audit technique produit à construire." },
              { code: "N3.06.04.01.03", nom: "persona conversationnel", statut: "à développer", aide: "Proposer cadrage éditorial proche ; audit technique produit à construire." },
              { code: "N3.06.04.01.04", nom: "parcours interactif", statut: "à développer", aide: "Proposer cadrage éditorial proche ; audit technique produit à construire." },
              { code: "N3.06.04.01.05", nom: "outil IA cadré", statut: "à développer", aide: "Proposer cadrage éditorial proche ; audit technique produit à construire." },
            ],
          },
          {
            code: "N3.06.04.02",
            nom: "E-learning / module numérique",
            enfants: [
              { code: "N3.06.04.02.01", nom: "module e-learning", statut: "partiel", aide: "Audit du contenu ; intégration plateforme non couverte." },
              { code: "N3.06.04.02.02", nom: "script de formation vidéo", statut: "partiel", aide: "Audit du contenu ; intégration plateforme non couverte." },
              { code: "N3.06.04.02.03", nom: "quiz pédagogique", statut: "partiel", aide: "Audit du contenu ; intégration plateforme non couverte." },
              { code: "N3.06.04.02.04", nom: "parcours LMS", statut: "partiel", aide: "Audit du contenu ; intégration plateforme non couverte." },
              { code: "N3.06.04.02.05", nom: "micro-learning", statut: "partiel", aide: "Audit du contenu ; intégration plateforme non couverte." },
            ],
          },
        ],
      },
    ],
  },
  {
    code: "N1.07",
    nom: "Communiquer / présenter / vendre",
    enfants: [
      {
        code: "N2.07.01",
        nom: "Identité auteur / professionnelle",
        enfants: [
          {
            code: "N3.07.01.01",
            nom: "Bio auteur / profil",
            enfants: [
              { code: "N3.07.01.01.01", nom: "bio courte", statut: "prêt" },
              { code: "N3.07.01.01.02", nom: "bio longue", statut: "prêt" },
              { code: "N3.07.01.01.03", nom: "profil LinkedIn", statut: "prêt" },
              { code: "N3.07.01.01.04", nom: "CV narratif", statut: "prêt" },
              { code: "N3.07.01.01.05", nom: "page à propos", statut: "prêt" },
              { code: "N3.07.01.01.06", nom: "portrait professionnel", statut: "prêt" },
            ],
          },
          {
            code: "N3.07.01.02",
            nom: "Dossier de presse / présentation",
            enfants: [
              { code: "N3.07.01.02.01", nom: "dossier auteur", statut: "prêt" },
              { code: "N3.07.01.02.02", nom: "dossier média", statut: "prêt" },
              { code: "N3.07.01.02.03", nom: "présentation intervenant", statut: "prêt" },
              { code: "N3.07.01.02.04", nom: "conférence / speaker kit", statut: "prêt" },
              { code: "N3.07.01.02.05", nom: "portfolio", statut: "prêt" },
            ],
          },
        ],
      },
      {
        code: "N2.07.02",
        nom: "Livre / projet éditorial",
        enfants: [
          {
            code: "N3.07.02.01",
            nom: "Pitch / synopsis / note d’intention",
            enfants: [
              { code: "N3.07.02.01.01", nom: "pitch court", statut: "prêt" },
              { code: "N3.07.02.01.02", nom: "synopsis éditeur", statut: "prêt" },
              { code: "N3.07.02.01.03", nom: "note d’intention", statut: "prêt" },
              { code: "N3.07.02.01.04", nom: "résumé quatrième", statut: "prêt" },
              { code: "N3.07.02.01.05", nom: "argumentaire projet", statut: "prêt" },
            ],
          },
          {
            code: "N3.07.02.02",
            nom: "Quatrième de couverture",
            enfants: [
              { code: "N3.07.02.02.01", nom: "quatrième roman", statut: "prêt" },
              { code: "N3.07.02.02.02", nom: "quatrième essai", statut: "prêt" },
              { code: "N3.07.02.02.03", nom: "quatrième témoignage", statut: "prêt" },
              { code: "N3.07.02.02.04", nom: "accroche commerciale", statut: "prêt" },
              { code: "N3.07.02.02.05", nom: "texte librairie", statut: "prêt" },
            ],
          },
          {
            code: "N3.07.02.03",
            nom: "Dossier éditorial / éditeur",
            enfants: [
              { code: "N3.07.02.03.01", nom: "proposition éditeur", statut: "prêt" },
              { code: "N3.07.02.03.02", nom: "dossier manuscrit", statut: "prêt" },
              { code: "N3.07.02.03.03", nom: "lettre d’accompagnement", statut: "prêt" },
              { code: "N3.07.02.03.04", nom: "argumentaire commercial", statut: "prêt" },
              { code: "N3.07.02.03.05", nom: "plan de collection", statut: "prêt" },
            ],
          },
        ],
      },
      {
        code: "N2.07.03",
        nom: "Communication commerciale",
        enfants: [
          {
            code: "N3.07.03.01",
            nom: "Page de vente / landing page",
            enfants: [
              { code: "N3.07.03.01.01", nom: "page livre", statut: "partiel", aide: "Audit éditorial et éthique ; performance marketing non prédite." },
              { code: "N3.07.03.01.02", nom: "page formation", statut: "partiel", aide: "Audit éditorial et éthique ; performance marketing non prédite." },
              { code: "N3.07.03.01.03", nom: "page accompagnement", statut: "partiel", aide: "Audit éditorial et éthique ; performance marketing non prédite." },
              { code: "N3.07.03.01.04", nom: "page événement", statut: "partiel", aide: "Audit éditorial et éthique ; performance marketing non prédite." },
              { code: "N3.07.03.01.05", nom: "page ressource", statut: "partiel", aide: "Audit éditorial et éthique ; performance marketing non prédite." },
            ],
          },
          {
            code: "N3.07.03.02",
            nom: "Email / newsletter de vente",
            enfants: [
              { code: "N3.07.03.02.01", nom: "email lancement", statut: "prêt" },
              { code: "N3.07.03.02.02", nom: "séquence email", statut: "prêt" },
              { code: "N3.07.03.02.03", nom: "newsletter promotionnelle", statut: "prêt" },
              { code: "N3.07.03.02.04", nom: "invitation événement", statut: "prêt" },
              { code: "N3.07.03.02.05", nom: "message prospection", statut: "prêt" },
            ],
          },
          {
            code: "N3.07.03.03",
            nom: "Posts réseaux sociaux",
            enfants: [
              { code: "N3.07.03.03.01", nom: "LinkedIn", statut: "partiel", aide: "Audit du message et du ton ; algorithmes/résultats non garantis. Contenu fait de publications courtes et autonomes plutôt que d'un fil narratif continu — CursAudit en tient compte et ne signale pas l'absence d'arc linéaire comme un défaut." },
              { code: "N3.07.03.03.02", nom: "Facebook", statut: "partiel", aide: "Audit du message et du ton ; algorithmes/résultats non garantis. Contenu fait de publications courtes et autonomes plutôt que d'un fil narratif continu — CursAudit en tient compte et ne signale pas l'absence d'arc linéaire comme un défaut." },
              { code: "N3.07.03.03.03", nom: "Instagram", statut: "partiel", aide: "Audit du message et du ton ; algorithmes/résultats non garantis. Contenu fait de publications courtes et autonomes plutôt que d'un fil narratif continu — CursAudit en tient compte et ne signale pas l'absence d'arc linéaire comme un défaut." },
              { code: "N3.07.03.03.04", nom: "X / Threads", statut: "partiel", aide: "Audit du message et du ton ; algorithmes/résultats non garantis. Contenu fait de publications courtes et autonomes plutôt que d'un fil narratif continu — CursAudit en tient compte et ne signale pas l'absence d'arc linéaire comme un défaut." },
              { code: "N3.07.03.03.05", nom: "publication longue", statut: "partiel", aide: "Audit du message et du ton ; algorithmes/résultats non garantis. Contenu fait de publications courtes et autonomes plutôt que d'un fil narratif continu — CursAudit en tient compte et ne signale pas l'absence d'arc linéaire comme un défaut." },
              { code: "N3.07.03.03.06", nom: "carrousel texte", statut: "partiel", aide: "Audit du message et du ton ; algorithmes/résultats non garantis. Contenu fait de publications courtes et autonomes plutôt que d'un fil narratif continu — CursAudit en tient compte et ne signale pas l'absence d'arc linéaire comme un défaut." },
            ],
          },
        ],
      },
      {
        code: "N2.07.04",
        nom: "Institutionnel / professionnel",
        enfants: [
          {
            code: "N3.07.04.01",
            nom: "Rapport / document institutionnel",
            enfants: [
              { code: "N3.07.04.01.01", nom: "rapport annuel", statut: "prêt" },
              { code: "N3.07.04.01.02", nom: "rapport d’activité", statut: "prêt" },
              { code: "N3.07.04.01.03", nom: "rapport RSE", statut: "prêt" },
              { code: "N3.07.04.01.04", nom: "note stratégique", statut: "prêt" },
              { code: "N3.07.04.01.05", nom: "document administratif", statut: "prêt" },
            ],
          },
          {
            code: "N3.07.04.02",
            nom: "Appel à projet / dossier de subvention",
            enfants: [
              { code: "N3.07.04.02.01", nom: "appel à projet culturel", statut: "partiel", aide: "Audit rédactionnel ; critères officiels à fournir par utilisateur." },
              { code: "N3.07.04.02.02", nom: "dossier associatif", statut: "partiel", aide: "Audit rédactionnel ; critères officiels à fournir par utilisateur." },
              { code: "N3.07.04.02.03", nom: "subvention européenne", statut: "partiel", aide: "Audit rédactionnel ; critères officiels à fournir par utilisateur." },
              { code: "N3.07.04.02.04", nom: "proposition partenaire", statut: "partiel", aide: "Audit rédactionnel ; critères officiels à fournir par utilisateur." },
              { code: "N3.07.04.02.05", nom: "candidature", statut: "partiel", aide: "Audit rédactionnel ; critères officiels à fournir par utilisateur." },
            ],
          },
        ],
      },
    ],
  },
  {
    code: "N1.08",
    nom: "Créer une forme poétique / expérimentale",
    enfants: [
      {
        code: "N2.08.01",
        nom: "Poésie / oralité",
        enfants: [
          {
            code: "N3.08.01.01",
            nom: "Recueil de poésie",
            enfants: [
              { code: "N3.08.01.01.01", nom: "poésie lyrique", statut: "prêt" },
              { code: "N3.08.01.01.02", nom: "poésie narrative", statut: "prêt" },
              { code: "N3.08.01.01.03", nom: "poésie spirituelle", statut: "prêt" },
              { code: "N3.08.01.01.04", nom: "poésie engagée", statut: "prêt" },
              { code: "N3.08.01.01.05", nom: "poésie expérimentale", statut: "prêt" },
              { code: "N3.08.01.01.06", nom: "vers libres", statut: "prêt" },
            ],
          },
          {
            code: "N3.08.01.02",
            nom: "Poème long / cycle",
            enfants: [
              { code: "N3.08.01.02.01", nom: "poème narratif", statut: "prêt" },
              { code: "N3.08.01.02.02", nom: "cycle poétique", statut: "prêt" },
              { code: "N3.08.01.02.03", nom: "épopée intime", statut: "prêt" },
              { code: "N3.08.01.02.04", nom: "méditation longue", statut: "prêt" },
              { code: "N3.08.01.02.05", nom: "poème dramatique", statut: "prêt" },
            ],
          },
          {
            code: "N3.08.01.03",
            nom: "Slam / chanson / parole",
            enfants: [
              { code: "N3.08.01.03.01", nom: "slam", statut: "partiel", aide: "Audit texte possible ; performance/musique non couverte finement." },
              { code: "N3.08.01.03.02", nom: "spoken word", statut: "partiel", aide: "Audit texte possible ; performance/musique non couverte finement." },
              { code: "N3.08.01.03.03", nom: "chanson", statut: "partiel", aide: "Audit texte possible ; performance/musique non couverte finement." },
              { code: "N3.08.01.03.04", nom: "texte de scène", statut: "partiel", aide: "Audit texte possible ; performance/musique non couverte finement." },
              { code: "N3.08.01.03.05", nom: "rap / spoken poetry", statut: "partiel", aide: "Audit texte possible ; performance/musique non couverte finement." },
            ],
          },
        ],
      },
      {
        code: "N2.08.02",
        nom: "Fragmentaire / hybride",
        enfants: [
          {
            code: "N3.08.02.01",
            nom: "Fragments / prose poétique",
            enfants: [
              { code: "N3.08.02.01.01", nom: "fragments lyriques", statut: "prêt" },
              { code: "N3.08.02.01.02", nom: "prose poétique", statut: "prêt" },
              { code: "N3.08.02.01.03", nom: "méditations fragmentaires", statut: "prêt" },
              { code: "N3.08.02.01.04", nom: "carnet d’images", statut: "prêt" },
              { code: "N3.08.02.01.05", nom: "textes courts", statut: "prêt" },
            ],
          },
          {
            code: "N3.08.02.02",
            nom: "Collage / montage",
            enfants: [
              { code: "N3.08.02.02.01", nom: "collage documentaire", statut: "partiel", aide: "Auditer lisibilité du dispositif et cohérence du montage." },
              { code: "N3.08.02.02.02", nom: "montage de voix", statut: "partiel", aide: "Auditer lisibilité du dispositif et cohérence du montage." },
              { code: "N3.08.02.02.03", nom: "texte-image", statut: "partiel", aide: "Auditer lisibilité du dispositif et cohérence du montage." },
              { code: "N3.08.02.02.04", nom: "archives + commentaire", statut: "partiel", aide: "Auditer lisibilité du dispositif et cohérence du montage." },
              { code: "N3.08.02.02.05", nom: "patchwork assumé", statut: "partiel", aide: "Auditer lisibilité du dispositif et cohérence du montage." },
            ],
          },
          {
            code: "N3.08.02.03",
            nom: "Texte rituel / performatif",
            enfants: [
              { code: "N3.08.02.03.01", nom: "texte de rituel", statut: "partiel", aide: "Audit textuel ; performance réelle à tester séparément." },
              { code: "N3.08.02.03.02", nom: "performance poétique", statut: "partiel", aide: "Audit textuel ; performance réelle à tester séparément." },
              { code: "N3.08.02.03.03", nom: "partition orale", statut: "partiel", aide: "Audit textuel ; performance réelle à tester séparément." },
              { code: "N3.08.02.03.04", nom: "texte cérémoniel", statut: "partiel", aide: "Audit textuel ; performance réelle à tester séparément." },
              { code: "N3.08.02.03.05", nom: "lecture publique", statut: "partiel", aide: "Audit textuel ; performance réelle à tester séparément." },
            ],
          },
        ],
      },
    ],
  },
  {
    code: "N1.09",
    nom: "Autre / à préciser",
    enfants: [
      {
        code: "N2.09.01",
        nom: "Projet non classé",
        enfants: [
          {
            code: "N3.09.01.01",
            nom: "Autre",
            enfants: [
              { code: "N3.09.01.01.01", nom: "autre à préciser", statut: "proche", aide: "Cursus propose la catégorie la plus proche et invite l’auteur à préciser." },
              { code: "N3.09.01.01.02", nom: "genre hybride à préciser", statut: "proche", aide: "Cursus propose la catégorie la plus proche et invite l’auteur à préciser." },
              { code: "N3.09.01.01.03", nom: "projet en cours d’identification", statut: "proche", aide: "Cursus propose la catégorie la plus proche et invite l’auteur à préciser." },
            ],
          },
        ],
      },
    ],
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

// Remplacée le 29/08/2026 — l'ancienne liste ("pourquoi je souffre
// encore", "pourquoi cette relation me poursuit"...) ne convenait qu'à un
// récit personnel/thérapeutique, maladroite pour les autres natures de
// projet (essai, livre professionnel, fiction...). Nouvelle liste
// universelle, centrée sur le texte et le lecteur plutôt que sur une
// expérience intime supposée — fournie telle quelle par l'auteur du
// projet.
export const CE_QUE_VOUS_ESPEREZ_DECOUVRIR = [
  "Ce que mon texte cherche vraiment à dire",
  "Ce que ce projet révèle de mon parcours ou de ma pensée",
  "Ce que cette histoire, cette idée ou cette expérience a transformé",
  "Ce que je veux réellement transmettre au lecteur",
  "Ce que je n'ai pas encore réussi à formuler clairement",
  "Ce que le lecteur risque de ne pas comprendre",
  "Ce qui manque encore pour que le texte tienne sa promesse",
  "Les angles morts de mon texte ou de mon projet",
  "La meilleure manière de présenter ce projet au lecteur",
  "La forme éditoriale qui lui conviendrait le mieux",
];

// ─── Navigation générique dans l'arbre NATURE_PROJET (réf. 60816-01, suite,
// 29/08/2026) — remplace nomSousCategorie()/sousGenresDe() (niveau 3 seul,
// ajoutés puis obsolètes le même jour avec l'arrivée du vrai niveau 1-4).
// `chemin` est un tableau de `{ nom, autre }`, un élément par niveau déjà
// choisi, dans l'ordre (niveau 1 en premier). `nom === "Autre"` arrête
// toujours la descente — voir docblock en tête de fichier.

// Renvoie les nœuds disponibles au niveau suivant `chemin`, ou null s'il
// n'y a plus de niveau (feuille atteinte, ou dernier choix était "Autre").
export function optionsSuivantes(chemin) {
  let noeuds = NATURE_PROJET;
  for (const étape of chemin) {
    if (étape.nom === "Autre") return null;
    const trouvé = noeuds.find((n) => n.nom === étape.nom);
    if (!trouvé || !trouvé.enfants) return null;
    noeuds = trouvé.enfants;
  }
  return noeuds;
}

// Renvoie le nœud le plus profond atteint en suivant `chemin` depuis la
// racine (utile pour lire son `statut`/`aide` quand c'est une feuille) —
// null si `chemin` est vide, invalide, ou s'arrête sur un "Autre".
export function noeudAtteint(chemin) {
  let noeuds = NATURE_PROJET;
  let noeud = null;
  for (const étape of chemin) {
    if (étape.nom === "Autre") return null;
    noeud = noeuds.find((n) => n.nom === étape.nom);
    if (!noeud) return null;
    noeuds = noeud.enfants ?? [];
  }
  return noeud;
}
