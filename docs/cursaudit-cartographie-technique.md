# CursAudit — Cartographie technique du dépôt Cursus

*Préparé le 04/08/2026, en réponse à la section 39 du brief CursAudit ("Analyse
d'abord le dépôt existant sans modifier le code"). Aucune ligne d'architecture
centrale n'a été touchée pour produire ce document — seule une correction de
branche git locale (sans effet sur le code) a eu lieu en amont.*

*Note de nommage, mise à jour le 09/08/2026 : **Cursus** n'est plus le nom
d'un produit mais celui de la marque/écosystème. **CursEdit** (sans accent —
décision actée le 09/08 : un accent empêcherait une internationalisation
sans changer le nom) est le produit d'écriture accompagnée, ce que ce
document appelait jusqu'ici "le produit" ou "Cursus" tout court. **CursAudit**
est le second produit sous la même marque. D'autres modules pourraient
suivre sous le même schéma (ex. Cursus Formation, Cursus Conseil, évoqués le
07/08 comme extensions possibles du même moteur de qualification). Dans le
code, `package.json` porte encore le nom d'affichage "Cursus" — à faire
évoluer si la distinction marque/produit doit aussi se refléter techniquement,
mais rien d'urgent ni de cassant.*

---

## 0. Statut des quatre chantiers de refonte identifiés le 09/08/2026

| # | Chantier | Statut |
|---|---|---|
| 1 | Architecture/code — composants partagés (moteur IA, questionnaire, UI) | Très avancé le 16/08/2026 — voir détail section 0bis ci-dessous |
| 2 | Navigation/UX — CursEdit et CursAudit à l'accueil | Maquette validée le 09/08 ; **écran de choix codé le 16/08/2026** (`EcranChoixEspace.jsx`) — pont bidirectionnel et badge "Audit partiel" pas encore construits, voir section 0bis |
| 3 | Nom/branding | Résolu : Cursus = marque, CursEdit et CursAudit = produits, CursEdit sans accent |
| 4 | Modèle économique — offre, tarification, positionnement relatif | Résolu et chiffré (voir `docs/cursaudit-tarification.md`) : un seul modèle "à l'acte" couvre l'audit complet et l'approfondissement ponctuel court, remise abonné CursEdit fixée à 20 % plafonnée à 50 % du prix mensuel de l'abonnement |

---

## 0bis. Détail des briques CursAudit écrites le 16/08/2026

*Le tableau ci-dessus résume ; cette section détaille chaque brique. Toutes
les dates de cette section sont le 16/08/2026 sauf mention contraire.*

**Chantier 1 — Cursus Édition (bouclé)**
- Protocole 60805-06 déployé, testé en conditions réelles, intégré dans
  l'éditeur (onglet "Vérification" de `CopiloteIA.jsx`).

**Chantier 1 — CursAudit, moteur (`analyser-unite-cursaudit`)**
- Testé avec succès : mode "1 IA" validé sur une unité réelle (8 critères
  du palier Essentiel), sortie ancrée dans le texte, correctement
  diagnostiquée comme littéraire/non-factuelle.
- Traite une unité à la fois (limite de temps d'exécution d'une Edge
  Function) ; mode "2 IA" écrit mais pas testé isolément ; "confrontation
  ciblée"/"arbitrage dialogique" pas implémentés.

**Chantier 1 — CursAudit, orchestrateur (`orchestrer-audit-cursaudit`, réf. 60816-01)**
- Traite les unités non analysées d'un audit par lot borné dans le temps
  (25s de marge, pas un compte fixe), marque les échecs par unité plutôt
  que de les retenter en boucle, bascule `audits.statut`
  brouillon→payé→en_traitement→terminé. Pas de tâche de fond automatique —
  l'appelant doit rappeler tant que `restantes > 0`.
- Testé avec succès : lot de 3 unités traitées en un appel. Contraste
  qualitatif confirmé : un passage factuel non sourcé (chiffre attribué à
  "une étude publiée en 2019" sans auteur ni revue) diagnostiqué "besoin de
  preuve fort"/"à sourcer"/"risque d'influence élevé", contre
  "recevable"/"besoin de preuve faible" pour les passages narratifs du
  même lot.

**Chantier 1 — CursAudit, segmentation et création (`segmenterCursAudit.js`, `auditsAPI.créerDepuisTexte`, réf. 60816-01)**
- Texte collé → unités → `audits` (statut "brouillon") + `audit_sections`.
  Segmentation testée unitairement en local.
- **Import `.docx` ajouté le 16/08/2026** (`extraireParagraphesDocx()`,
  suite à un retour de l'auteur du projet : "coller le texte" seul était
  trop éloigné de ce que CursEdit propose déjà). Reprend la lecture JSZip
  déjà éprouvée dans `ImportDocx.jsx` (pas `mammoth`), simplifiée — pas de
  détection de niveaux de titre, juste les paragraphes à plat. `.pdf`
  reste à construire.

**Chantier 1 — CursAudit, page de création (`CursAudit.jsx`, réf. 60816-01)**
- Texte collé, palier (3 fixes, "Libre" non proposé), mode IA (seuls
  "1 IA"/"2 IA", les deux implémentés), format de rapport, prix calculé en
  direct (`tarifCursAudit.js`, à partir du nombre réel d'unités segmentées
  et de `audit_pricing_rules` ; multiplicateur commercial simplifié en une
  valeur fixe par palier, pas encore la grille par tranches complète).
- Crée l'audit en statut "brouillon" — pas de bouton de paiement, aucun
  flux Stripe CursAudit n'existe.

**Chantier 2 — Écran de choix d'espace (`EcranChoixEspace.jsx`)**
- S'affiche une fois après connexion (mémorisé en `sessionStorage`, pas de
  façon permanente), deux cartes CursEdit/CursAudit, bouton "⇄" dans la
  barre supérieure pour changer d'espace à tout moment.
- **Pas construits** : le pont bidirectionnel (passer d'un projet CursEdit
  à son audit sans réimporter — `audits.projet_id` existe déjà en base
  mais rien ne le relie encore dans l'UI) et le badge "Audit partiel" sur
  un projet en cours d'audit.

**Décision actée le 16/08/2026 (séquence de paiement)** : le paiement doit
venir APRÈS le texte/palier choisis, une fois le prix exact connu à partir
du nombre réel d'unités — jamais avant (le prix ne peut pas être fiable
sans le texte). Séquence : création de l'audit en "brouillon" (déjà faite)
→ bouton "Payer" ouvrant une session Stripe Checkout liée à cet audit
(réutiliser `creer-session-checkout`) → `stripe-webhook` confirme et
bascule `statut` à "payé", jamais une confirmation côté client. Vaut aussi
pour un livre entier : même séquence, prix plus élevé du fait du nombre
d'unités, seule différence pratique le temps de traitement en aval.

**Chantier 3 — Codes promotionnels, extension CursAudit (réf. 60816-01, suite)**
- Le système existant (`codes_promo`, `admin-codes-promo`, RLS fermée à
  service_role, fonction atomique `consommer_code_promo()` — voir
  `2026-08-04-codes-promo.sql`) est directement réutilisable pour CursAudit
  : mêmes colonnes `remise_pourcent` (5 à 100 %), `duree_mois`,
  `date_debut`/`date_fin`, `utilisations_max`. Pas de nouveau mécanisme à
  construire, seulement à cibler.
- **Colonne `produit_cible` ajoutée** (`2026-08-16-codes-promo-cursaudit.sql`)
  : `'cursedit' | 'cursaudit' | null`. `null` = valable pour les deux
  (comportement des codes existants, inchangé).
- **Deuxième facteur admin ajouté** à la demande explicite de l'auteur du
  projet ("il faut que l'administrateur qui accorde la remise aie un code
  secret permettant de donner l'accès aux conditions") : être reconnu
  admin (table `admins`) ne suffit plus pour "creer" ou "definirActif" —
  il faut en plus fournir un secret serveur (`ADMIN_PROMO_SECRET`, jamais
  dans le code, à définir dans Supabase → Edge Functions → Secrets). Défense
  en profondeur : une session admin compromise seule ne permet plus de
  créer un accès gratuit. "lister" (simple consultation) reste inchangé.
- `Administration.jsx` : champ mot de passe "Code secret administrateur"
  (jamais pré-rempli ni stocké), sélecteur "Produit cible" (Les deux /
  CursEdit / CursAudit), colonne "Produit" ajoutée au tableau des codes.
- **Reste à faire côté opérateur** (pas exécutable depuis cette session) :
  exécuter la migration SQL, choisir et définir `ADMIN_PROMO_SECRET`, puis
  redéployer `admin-codes-promo` (déjà autonome, un simple collage suffit).
- Le checkout Stripe CursAudit (non construit — voir décision de séquence
  ci-dessus) devra filtrer les codes par `produit_cible` avant d'appeler
  `consommer_code_promo()`, comme `creer-session-checkout` le fait déjà
  implicitement pour CursEdit.

**Chantier 4 — `diagnostic_priorite` catégorisé (réf. 60816-01, suite, 22/08/2026)**
- Constat en préparant l'écran de résultat : `valeur` est du texte libre
  généré par l'IA pour chaque critère (ex. "à nuancer / à sourcer
  partiellement") — ingérable à l'échelle d'un livre de 60000 mots
  (~1475 unités observées sur un livre réel) : impossible de compter
  "X % recevables" si chaque diagnostic est formulé différemment.
- **`audit_criteria.categories` ajoutée** (`2026-08-22-audit-criteria-categories.sql`)
  : `jsonb`, `null` pour 29 des 30 critères (texte libre inchangé, leur
  richesse qualitative est voulue), peuplée uniquement pour
  `diagnostic_priorite` avec les 5 valeurs déjà présentes dans sa
  description d'origine (`recevable`, `a_nuancer`, `a_sourcer`,
  `a_reformuler`, `a_verifier`).
- `valeur` devient un **tableau** de ces catégories quand `categories`
  est renseignée, pas une seule — une unité réelle peut cumuler "à
  nuancer" ET "à sourcer" en même temps (observé dans le test du
  22/08/2026), un enum à choix unique aurait perdu cette information.
- `analyser-unite-cursaudit` et `orchestrer-audit-cursaudit` mis à jour en
  parallèle (schéma dynamique + consigne de prompt), les deux dupliquant
  cette logique à l'identique (fichiers autonomes, voir leçon du 16/08).
- Rend possible l'écran de résultat pour un livre entier : compter/filtrer
  par catégorie sans avoir à lire chaque commentaire.

**Chantier 5 — Écran de résultat (`CursAuditListe.jsx`, `CursAuditDetail.jsx`, réf. 60816-01, suite, 22/08/2026)**
- `CursAuditListe.jsx` : liste des audits de l'utilisateur (`auditsAPI.lister()`),
  miroir de "Mes projets" côté CursEdit. Nouvelle entrée de navigation
  "Mes audits".
- `CursAuditDetail.jsx` : bandeau de comptage par catégorie de
  `diagnostic_priorite` (chantier 4), cliquable pour filtrer la liste ;
  liste paginée côté client (20/page) ; chaque unité repliée sur son
  diagnostic, détail complet (tous les critères actifs) au clic.
- **Premier bouton d'analyse dans l'interface** : "Lancer/Continuer
  l'analyse" appelle `orchestrer-audit-cursaudit` en boucle tant que
  `restantes > 0` — jusqu'ici cet appel n'existait que comme script de
  test dans la console du navigateur. Reste gated par l'absence de
  paiement Stripe : actif seulement si `audits.statut` est déjà "paye" ou
  "en_traitement" (positionné manuellement en SQL en attendant le
  chantier "bouton Payer").
- **Pas encore testé dans le navigateur** — seul le moteur sous-jacent
  (`orchestrer-audit-cursaudit`, catégorisation `diagnostic_priorite`) a
  été validé en conditions réelles sur "TEST APERCU", via script console.
  Cet écran lui-même reste à ouvrir et vérifier une fois déployé.

**Chantier 6 — Questionnaire de qualification câblé (`CursAuditQuestionnaire.jsx`, réf. 60816-01, suite, 22/08/2026)**
- Écart signalé par l'auteur du projet en relisant les textes de l'écran
  de choix d'espace (`EcranChoixEspace.jsx`), qui décrivaient ce
  questionnaire comme existant alors qu'il n'était encore que figé en
  spécification (`questionnaire-cursaudit-v1-specification.md`, 15/08).
- Reprend les sections 1, 2, 3, 4, 5, 7 (conditionnelle, mémoire/TFE), 10
  — porte d'entrée obligatoire avant le texte à auditer dans `CursAudit.jsx`.
- **Section 6 volontairement absente** ("préserver ma voix", comparaison à
  des pages de référence) — le document d'origine la marque lui-même hors
  périmètre (stockage et logique de comparaison stylistique jamais conçus).
- **Sections 8 et 9 pas dupliquées** — la note technique du document
  d'origine les fait correspondre directement au palier/mode et au format
  de rapport déjà présents dans `CursAudit.jsx`.
- **Nouvelles colonnes `audits`** (`2026-08-22-audits-questionnaire.sql`) :
  `type_document`, `statut_texte`, `finalite_audit`, `question_libre`,
  `degre_intervention`, `contraintes_academiques`, `relation_ia`.
- **Ce qui change réellement le résultat** : la question libre (section 4)
  et le degré d'intervention (section 5) sont injectés dans le prompt
  système de `analyser-unite-cursaudit` et `orchestrer-audit-cursaudit`
  (fonction `construireContexteQualification()`, dupliquée dans les deux
  fichiers autonomes). Limite assumée : le moteur ne produit toujours
  qu'un diagnostic par critère, jamais un texte réécrit séparé — les
  degrés "reformulation"/"réécriture" n'influencent que le contenu du
  commentaire, pas la forme de sortie. Les autres réponses (type de
  document, statut, contraintes académiques, style de relation à l'IA)
  qualifient la demande mais n'influencent pas encore le résultat.
- **Pas encore testé dans le navigateur** ni en conditions réelles côté
  moteur (nouveau prompt jamais exécuté).

**Chantier 7 — Synthèse éditoriale globale par unité (réf. 60816-01, suite, 22/08/2026)**
- Écart signalé par l'auteur du projet : "dans CursEdit il y a des
  propositions, ici rien ?" — le diagnostic critère par critère ne suffit
  pas pour un écrivain. Proposition de GPT reprise et resserrée (plusieurs
  de ses champs faisaient doublon avec des critères déjà existants dans
  `audit_criteria` — `risque_principal` ≈ `risque_influence`,
  `diagnostic_global` ≈ `diagnostic_priorite`, "voix de l'auteur" ≈
  section 6 du questionnaire, déjà mise hors périmètre).
- **4 champs retenus, ajoutés à la sortie de chaque unité** (pas de
  nouvelle colonne SQL — vivent dans le même `resultat_analyse` jsonb) :
  `effet_lecteur` (tableau catégorisé : adhesion/resistance/emotion/
  confusion/fatigue/curiosite/malaise/impression_de_profondeur/
  impression_de_repetition), `geste_editorial` (direction de travail,
  texte libre), `action_recommandee` (catégorie fermée : conserver/
  alleger/nuancer/deplacer/developper/couper/sourcer/reformuler/reecrire/
  expertiser), `proposition` (texte libre ou null).
- **`proposition` est la seule vraiment gated par le degré d'intervention**
  (voir `DEGRES_AUTORISANT_PROPOSITION`) — vide si "observer"/"signaler"/
  non renseigné, ou si l'établissement académique n'autorise pas l'IA
  (`contraintes_academiques.autorisationIA === "Non"`, jusqu'ici collecté
  par le questionnaire mais jamais transmis au moteur — corrigé au passage).
  `action_recommandee` n'est PAS gated : c'est un conseil sur ce que
  l'auteur·ice pourrait faire, pas une intervention de CursAudit lui-même.
- `construireContexteQualification()` étendue en même temps : injecte
  maintenant aussi `type_document` et `finalite_audit` (collectés par le
  questionnaire mais jamais utilisés jusqu'ici), en plus de la question
  libre et du degré d'intervention déjà câblés.
- **Coût à recalibrer** : 4 champs de sortie en plus par unité augmentent
  mécaniquement les tokens de sortie — `cout_unite_base` (tout juste
  recalibré à 0,0189 €) redeviendra sous-estimé une fois ce chantier
  redéployé ; à remesurer sur un nouveau vrai test avant de refaire
  confiance au prix affiché.
- Différé volontairement (proposition de GPT, jugé trop étroit ou
  redondant pour l'instant) : `respiration_du_texte`, `promesse_au_lecteur`.
- Pas encore testé dans le navigateur ni en conditions réelles côté moteur.

**Chantier 8 — Aperçu gratuit + pré-audit payant (réf. 60816-01, suite, 22-23/08/2026)**
- Idée d'origine de l'auteur du projet (15/08/2026), affinée avec GPT à deux
  reprises : un travail en DEUX phases avant l'audit détaillé (des heures,
  ~29 $ sur "là où les portes s'ouvrent"), pas une seule.
- **Phase 1, "aperçu" (gratuit)** — `preaudit-global-cursaudit` (nom de
  fonction déployée inchangé, renommé "aperçu" seulement en interne le
  23/08). Un seul appel Claude (contexte 1M tokens, le livre entier y
  tient) : `genre_apparent`, `genre_reel_probable`, `colonne_vertebrale`,
  `tension_principale`, `forces_globales[]`, `risques_globaux[]`,
  `audit_recommande` (palier + priorités). Cycle de vie sur `audits` :
  `apercu_statut` (non_demande→termine, pas de "paye" puisque gratuit),
  `apercu_resultat` (jsonb). Coût réel de l'ordre de 0,10-0,15€ (mesuré sur
  un vrai test, 38 864 mots).
- **Erreur du 22/08 corrigée le 23/08** : la phase 1 avait d'abord été
  facturée (barème dégressif puis linéaire par tranche de mots, 24€→132€
  HT) et présentée comme "le pré-audit" — l'auteur du projet a fait
  remarquer qu'une page de synthèse à 72,60€ pour un appel coûtant 0,13€
  n'était pas vendable, ET que ce barème visait en réalité la vraie phase 2,
  jamais construite. Rendue gratuite, la phase 1 a ensuite été comprise
  comme un simple teaser plutôt qu'un livrable.
- **Phase 2, "pré-audit" (payant)** — `preaudit-approfondi-cursaudit`
  (nouvelle fonction, 23/08/2026, **schéma révisé une 3e fois le même jour**).
  v1 (7 blocs) était "mesquine" : trop occupée à dire "il faudra vérifier ça
  dans l'audit détaillé". v2 (10 points) corrigeait le ton mais restait un
  DIAGNOSTIC ("votre livre est plutôt une fable qu'un roman") plutôt qu'un
  PLAN D'INTERVENTION — constat de l'auteur du projet après le 2e test réel :
  bien vu, mais rien qu'un·e auteur·ice puisse appliquer directement.
  **Structure v3, orientée décision + action** : `nature_reelle`,
  `promesse_affichee`, `ecart_promesse_execution`, `voies_editoriales[]`
  (EXACTEMENT 3, chacune `nom`/`description`/`ampleur_reecriture`
  légère-moyenne-lourde), `recommandation_principale`,
  `plan_intervention[]` (3-6 chantiers, chacun `chantier`/`geste_editorial`
  — jamais "à vérifier"), `exemples_concrets[]` (au moins 3, chacun
  `probleme`/`effet`/`geste_editorial`/`proposition`, même esprit que la
  synthèse éditoriale par unité), `a_preserver[]`, `a_couper_ou_alleger[]`,
  `prochaine_etape` (peut honnêtement être "pas besoin d'audit détaillé").
  Cinq règles explicites dans le prompt système : aucune orientation
  "à vérifier plus tard" (chaque chantier/exemple porte un geste actionnable
  maintenant), préconisation sur le texte mais recommandations franches et
  directives, généreux autant que sévère, rester à l'échelle du livre entier
  (pas une seule piste de correction au centre), prochaine étape honnête
  plutôt qu'un réflexe de vente. Cycle de vie séparé :
  `preaudit_statut` (non_demande→paye→termine),
  `preaudit_prix_ht`, `preaudit_resultat` (jsonb). N'apparaît dans
  `CursAuditDetail.jsx` qu'une fois l'aperçu terminé.
- **v4 → v6, même jour, sur retours GPT successifs** : v4 ajoute
  `resume_executif` (6-8 lignes) et `duree_estimee_travail` par voie, plus
  ton professionnel et ancrage systématique dans des repères nommés du
  texte. v5 ajoute `fiche_synthese` (fiche courte, quelques mots par champ,
  potentiellement exploitable pour comparer plusieurs pré-audits entre
  eux). v6 ajoute `cartographie_contexte` (personnages principaux, lieux,
  carte sensorielle, objets/motifs récurrents, domaines à documenter/
  vérifier, voix, densité, `valeur_ajoutee_audit_complet`) — reprend 7 des
  19 "fiches" proposées par GPT sur ce tour, en écartant les 12 autres
  jugées redondantes avec l'existant (contrat de genre, conflits, silences,
  sur-explication, "points à approfondir" auraient réintroduit le problème
  "à vérifier plus tard" corrigé en v3). Choix assumé de rester COMPACT
  (2-5 personnages, 1-4 lieux — pas une fiche exhaustive par unité) pour ne
  pas refaire l'audit détaillé dans un seul appel.
- **v6 → v7, même jour — REVIREMENT sur le niveau d'IA.** La règle "1 seule
  IA" est abandonnée : après 4 tours de révision manuelle où un second
  regard (GPT, relayé par l'auteur du projet) a systématiquement repéré des
  manques ou des excès, l'auteur du projet a demandé que ce filet de
  sécurité soit intégré au pipeline lui-même (le relais humain ne sera plus
  là une fois le produit automatisé). **Pipeline en 3 passages**, même
  mécanisme OpenAI `json_schema` que le mode "2 IA" déjà éprouvé dans
  `analyser-unite-cursaudit` : (1) Claude produit un brouillon ; (2) GPT
  (`gpt-4o`) relit le manuscrit ET le brouillon, signale uniquement des
  manques/redites réels, ne réécrit rien ; (3) Claude reprend SON PROPRE
  brouillon à la lumière de la critique et produit la version finale,
  seul juge de ce qu'il retient. La critique GPT est conservée
  (`preaudit_resultat.revision.critique_gpt`) pour la traçabilité, affichée
  en repli (`<details>`) dans `CursAuditDetail.jsx`. `max_tokens` du passage
  Claude porté à 24 000 (schéma v6 plus riche), toujours large marge sous
  les 128k supportés par `claude-sonnet-5`. Secret `OPENAI_API_KEY`
  désormais requis par cette fonction (déjà en place pour l'audit détaillé).
  **Hors périmètre de ce changement**, discuté mais pas implémenté : rendre
  le mode "2 IA" systématique pour l'audit détaillé aussi, et refondre la
  tarification autour de la profondeur plutôt que du nombre d'IA.
- **Tarif de la phase 2** : 40 % du prix TTC de l'audit détaillé (déjà
  connu à la création, pas de barème par tranche de mots séparé) — si
  l'audit détaillé est commandé ensuite, 50 % du prix du pré-audit (= 20 %
  du prix de l'audit détaillé) en est déduit, soit 120 % du prix de l'audit
  détaillé au total au lieu de 140 % sans déduction. Décision de l'auteur
  du projet, 23/08/2026 ; déduction pour l'instant INFORMATIONNELLE (pas de
  paiement Stripe pour l'appliquer). `calculerPrixPreauditPourcentage()`
  dans `tarifCursAudit.js`, deux paramètres dans `audit_pricing_rules`
  (categorie `parametre_global` : `preaudit_pourcentage_prix_final`,
  `preaudit_deduction_pourcentage`).
- **Pas de vraie tâche de fond serveur** : discuté avec l'auteur du projet
  le 23/08/2026, qui voulait un traitement "en arrière-plan avec barre de
  progression". L'aperçu (1 appel) prend de l'ordre d'une minute ; le
  pré-audit (3 passages depuis v7 : Claude → GPT → Claude) prend plusieurs
  minutes — dans les deux cas largement sous la limite d'une heure fixée
  par l'auteur du projet, et sans signal d'avancement réel à afficher entre
  les passages — pas de fausse barre de progression. Une vraie tâche de
  fond (qui survit à la fermeture de l'onglet, avec notification)
  demanderait une infrastructure séparée (table de jobs + poller +
  notification), jugée disproportionnée ici et PAS construite.
- Pas encore testé dans le navigateur ni en conditions réelles côté moteur
  (ni la phase 1 relookée, ni la phase 2, nouvelle).

**Reste à construire pour CursAudit** : import `.pdf` (`.docx` fait), le
bouton "Payer" (Stripe Checkout, voir décision de séquence ci-dessus),
pont bidirectionnel + badge "Audit partiel", export du rapport (le champ
"Format de rapport" est collecté à la création mais ne produit encore
aucun document — signalé comme un vrai manque le 22/08/2026, priorité
avant même le paiement Stripe). Questionnaire d'intention v2 côté Cursus
Édition (chantier 1b, différent de celui de CursAudit ci-dessus) et
composants UI partagés (chantier 1c) toujours pas démarrés.

---

## 1. Cartographie du dépôt

### Stack
- **Frontend** : React 18 + Vite 5, un seul module d'entrée (`src/main.jsx` →
  `src/App.jsx`, ~2700 lignes, composant racine monolithique).
- **Éditeur riche** : Tiptap (`@tiptap/react` + extensions : character-count,
  highlight, placeholder, text-align, typography, underline).
- **Backend** : Supabase (Postgres + Auth + Storage implicite + Edge Functions
  Deno). Client unique : `src/lib/supabase.js`.
- **Paiement** : Stripe, via une Edge Function Supabase
  (`supabase/functions/creer-session-checkout`), pas de SDK Stripe côté client.
- **IA** : Anthropic Claude, appelé exclusivement via une Edge Function Supabase
  nommée `claude-prox` (URL en dur dans `CopiloteIA.jsx` :
  `https://ssnowhvkwqfpournmyut.supabase.co/functions/v1/claude-prox`).
  **Cette fonction n'existe dans aucun fichier de ce dépôt** — son code n'a
  circulé que dans des sessions de chat passées, jamais commité. Risque connu
  et déjà documenté (`docs/cahier-2026-08-03.md`).
- **Import de documents** : `mammoth` (DOCX → HTML), analyse directe du
  `styles.xml` interne pour résoudre les niveaux de titre réels (indépendants
  du nom du style Word).
- **Export** : génération DOCX via la librairie `docx`, dans
  `src/lib/exportWord.js`.
- **i18n** : `i18next` + `react-i18next`, fichiers `src/i18n/locales/{fr,en}/`.
- **Déploiement** : Vercel pour le frontend (URL de prod en dur dans l'Edge
  Function checkout : `https://cursus-seven.vercel.app`), Supabase Dashboard
  pour les migrations SQL et les Edge Functions non trackées dans ce dépôt.

### Point d'attention structurel déjà identifié et corrigé ce jour
`src/App.jsx` (racine, seul fichier réellement importé par `main.jsx`) et
`src/components/App.jsx` (2700 lignes, **non importé nulle part**) ont
longtemps divergé après un rollback d'urgence du 01/08 — un audit direct de
`origin/main` a montré que l'écart réel restant est aujourd'hui minime (une
ligne de câblage manquante, déjà signalée séparément sous `60804-01`).
`src/components/App.jsx` reste un doublon mort à supprimer un jour, mais ne
bloque pas la suite.

### Arborescence fonctionnelle actuelle
```
src/
  App.jsx                    — composant racine : auth, navigation, structure
                                du manuscrit (NœudStructure récursif), édition
                                de projet, promotion/rétrogradation de nœuds
  components/
    Editeur.jsx               — éditeur Tiptap, compteurs mots/caractères, objectifs
    CopiloteIA.jsx             — panneau IA (suggestions, personnages, références,
                                 cohérence), appelle claude-prox directement
    CompteurUsageIA.jsx        — jauge de consommation IA temps réel (tokens)
    ImportDocx.jsx             — import Word, détection de niveaux, conflits
    IncorporerMatiere.jsx      — insertion de matière externe dans un projet
    QuestionnaireIntention.jsx — questionnaire d'intention de projet (ADN du projet)
    Bibliotheque.jsx           — bibliothèque de livres/citations (localStorage
                                 encore partiellement, migration Supabase en attente)
    CarnetIdees.jsx            — carnet d'idées
    TableauDeBord.jsx          — tableau de bord utilisateur
    Tarification.jsx           — grille tarifaire, checkout Stripe, codes promo
    AideFAQ.jsx                — aide statique
  lib/
    supabase.js                — client Supabase unique
    auth.jsx                   — useAuth(), PageConnexion (email/mdp)
    api.js                     — couche API centralisée (projetsAPI, nœudsAPI,
                                 livresAPI, citationsAPI, idéesAPI, sessionsAPI,
                                 usageIAAPI) — AUCUN composant n'appelle Supabase
                                 directement, tout passe par ce fichier
    exportWord.js               — génération DOCX (formats de page A4/broché)
    codePromo.mjs                — génération/vérification HMAC de codes promo
    journalErreurs.js            — journalisation d'erreurs applicatives
supabase/
  functions/creer-session-checkout/  — seule Edge Function trackée dans ce
                                        dépôt ; claude-prox et stripe-webhook
                                        existent en production mais pas ici
```

### Schéma Supabase réel (vérifié en session, pas deviné)
```
projets, noeuds, livres, citations, idees, sessions,
abonnements, quotas_paliers, usage_ia, credits_ia,
banque_questions, intention_personnes, intention_projet,
reponses_questionnaire, journal_erreurs, versions_noeuds
```
`noeuds` porte la hiérarchie du manuscrit : `projet_id`, `parent_id`, `type`
(partie/chapitre/scene), `titre`, `ordre`, `texte` (HTML), `zone` (visibilité :
corps/reserve/methodo/brouillon). C'est la table structurelle centrale — la
plus proche, conceptuellement, de ce que CursAudit appellerait `audit_sections`.

---

## 2. Composants réutilisables pour CursAudit

| Besoin CursAudit (brief) | Équivalent Cursus réutilisable tel quel |
|---|---|
| Authentification, gestion utilisateur | `src/lib/auth.jsx` (`useAuth`, `PageConnexion`) — générique, sans dépendance au domaine "écriture" |
| Stockage des projets | `projetsAPI` (`src/lib/api.js`) — le concept "projet" est déjà neutre (titre, statut, couleur, description) ; un `audit` peut être un type de "projet" ou une table sœur avec la même logique CRUD |
| Import DOCX + détection de structure par niveaux de titre réels | `ImportDocx.jsx` + `mammoth` — c'est exactement le prétraitement demandé en section 7 du brief (extraction, comptage). Directement adaptable : DOCX → HTML → nœuds, sauf que CursAudit veut des *sections d'analyse*, pas des chapitres éditables |
| Comptage caractères/mots | `compterMots`/`compterCaractères` (`Editeur.jsx`) — logique déjà alignée sur l'unité demandée par le brief (caractères espaces compris) |
| Export DOCX | `src/lib/exportWord.js` — réutilisable pour l'export de rapport, moyennant un nouveau template de mise en page (le rapport CursAudit n'a pas la structure d'un manuscrit) |
| Appels IA structurés | Le pattern `fetch(EDGE_FUNCTION_URL, {...})` de `CopiloteIA.jsx` est réutilisable comme squelette, mais **claude-prox actuel répond en texte libre pour un panneau d'aide à l'écriture** — CursAudit a besoin de sorties JSON strictement validées (schéma `AuditFinding`). Il faudra une Edge Function distincte (ou un mode distinct de claude-prox), pas une réutilisation directe. |
| Facturation Stripe | `Tarification.jsx` + `creer-session-checkout` — le mode `payment` (paiement unique, déjà ajouté pour la recharge de tokens `60803-03`) est directement le bon mode pour un audit facturé à l'acte. Le mécanisme de code promo HMAC (`codePromo.mjs`) est réutilisable tel quel. |
| Tableau de bord | `TableauDeBord.jsx` — structure de liste/statut réutilisable comme gabarit pour "mes audits" |
| Composants UI (boutons, modales, badges de statut) | Style inline cohérent dans tout le dépôt (pas de librairie de composants séparée) — pas de composants UI génériques extraits à ce jour ; à extraire si on veut éviter de dupliquer le style bouton/modale pour CursAudit |

**Constat important** : il n'existe **aucune séparation `/src/features/`** dans
le dépôt actuel — tout est plat dans `src/components/`. L'architecture
`/src/features/cursaudit/` proposée par le brief (section 30) serait donc la
**première** feature isolée du projet, pas un renforcement d'un pattern
existant. C'est une bonne discipline à introduire, mais ce sera un choix
architectural nouveau, pas une continuité.

---

## 2bis. Décision d'architecture partagée Cursus Édition ↔ CursAudit (formalisé le 09/08/2026)

Décision de principe : **partager trois briques précises entre les deux
produits plutôt que les construire en parallèle**, chacune pour une raison
différente. Cette section formalise ce qui n'était jusqu'ici que discuté.
P0a (rapatriement de `claude-prox`) et P0b (`OPENAI_API_KEY`) sont faits
(15/08/2026) — voir la carte d'avancement du 07/08 pour l'origine de ces deux
préalables. Ce qui suit reste une décision d'architecture, pas un chantier
lancé : aucune des trois briques ci-dessous n'a de code écrit à ce jour.

### a) Moteur IA à sortie structurée (partagé)

Trois besoins distincts convergent aujourd'hui vers la même brique :
1. **CopiloteIA** (existant) — texte libre, suggestions d'écriture, faible enjeu.
2. **Protocole 60805-06** (Cursus Édition) — sortie JSON stricte, dialogue à deux rôles (Claude analyseur / GPT critique).
3. **CursAudit** (moteur d'analyse) — sortie JSON stricte, par unité codée (confirmé aujourd'hui par l'exemplar Excel/Word produit hors code : 255 unités, 29 dimensions par unité, dialogue Claude↔GPT déjà utilisé en pratique pour ce travail manuel).

Les besoins 2 et 3 sont structurellement le même problème : un appel IA à
rôle explicite, sortie validée contre un schéma, jamais du texte libre. Le
mode texte libre de CopiloteIA reste tel quel — pas besoin de sortie
structurée pour de simples suggestions, `claude-prox` n'est pas touché.

**Décision révisée le 15/08/2026** (remplace la version "une seule Edge
Function générique" ci-dessus, jugée trop simple une fois la question posée
explicitement) : **union sur le mécanisme, différenciation sur le contrôle
d'accès.**
- Un **module interne partagé** (pas déployé séparément, importé par les
  fonctions qui en ont besoin) implémente uniquement le mécanisme d'appel
  `{moteur: claude|gpt, role, schema_sortie, system, contexte}` → sortie
  validée. Aucune logique d'auth ni de facturation dedans.
- **Deux Edge Functions séparées**, chacune avec son propre contrôle
  d'accès, consomment ce module :
  - celle du protocole 60805-06 (Cursus Édition) — garde la logique de
    quota mensuel déjà en place dans `claude-prox` (abonnement récurrent) ;
  - une nouvelle fonction pour le moteur CursAudit — logique de paiement à
    l'acte + remise abonné CursEdit plafonnée (voir
    `docs/cursaudit-tarification.md`), structurellement incompatible avec
    un quota mensuel.

**Écrit le 15/08/2026** : `supabase/functions/_shared/moteur-ia-structure.ts`
— implémente le mécanisme (appel Claude via tool use forcé, appel GPT via
`response_format: json_schema`, validation Ajv de la sortie contre
`schema_sortie` dans les deux cas). Zéro appelant pour l'instant — ni la
fonction 60805-06 ni la fonction CursAudit n'existent encore.

**Migration écrite et appliquée le 15/08/2026** : `2026-08-15-cursaudit-schema.sql`.
`audits` existait déjà en base (créée dans une session passée non commitée,
même pattern que `claude-prox` — colonnes/RLS/policy vérifiées identiques
avant de retirer sa création du script). `audit_sections`, `audit_criteria`,
`audit_pricing_rules` créées avec succès (voir section 3 ci-dessous pour le
détail), avec RLS + policies dès la création. `audit_pricing_rules` est
pré-remplie avec les valeurs actuelles du calculateur
(`docs/cursaudit-tarification.md`) : paliers de dimensions, modes IA, types
de rapport, paramètres globaux (dont la remise abonné CursEdit 20 % / 50 %).
Le multiplicateur de prix par combinaison palier/mode/rapport n'est pas
encore transposé en configuration — seule sa logique est documentée.

Prochaine étape logique : écrire la première des deux Edge Functions
consommatrices du module IA structuré.

Raisons de ne **pas** tout mettre dans une seule fonction (au-delà de la
différence de facturation) : rythme de déploiement très différent —
`claude-prox` est stable et en prod, le moteur CursAudit va être réécrit
plusieurs fois pendant sa construction ; les coupler ferait porter à
CopiloteIA (qui marche déjà) le risque de chaque itération de CursAudit.

### b) Questionnaire (partagé, avec le moteur de qualification proposé le 07/08)

L'existant (`banque_questions` / `reponses_questionnaire`) est **plat** : un
seul niveau utilisé aujourd'hui (l'ADN du projet, niveau 1), aucun
branchement par profil. L'idée du "moteur de qualification" (carte
d'avancement, branche P2b — qui êtes-vous → que cherchez-vous → sur quel
ouvrage → questionnaire spécialisé) reste non commencée, mais la décision
d'architecture est prise : **étendre `banque_questions` avec des colonnes de
branchement (profil cible, question suivante) plutôt que construire un
système séparé.** La table a déjà une colonne `niveau` — c'est une
généralisation d'un mécanisme existant, pas une reconstruction.

**Distinction importante à ne pas mélanger** : ce questionnaire de
qualification (qui demande quoi, en amont d'une session) est un objet
différent du référentiel `audit_criteria` de CursAudit (catégories
épistémiques, règles de lecture par catégorie — premier brouillon réel
trouvé le 09/08 dans la grille Excel produite hors code). Le premier
qualifie la demande ; le second définit comment coder un extrait pendant
l'analyse elle-même. Les deux sont réels, mais pas au même stade :

- **Questionnaire de qualification côté CursAudit : figé le 15/08/2026**,
  voir `questionnaire-cursaudit-v1-specification.md` (10 sections : nature
  du document, statut, finalité, question libre, degré d'intervention,
  préservation de la voix, contraintes académiques, niveau de preuve,
  format de sortie, relation à l'IA). Reconstruit de mémoire (conversation
  source avec GPT non retrouvée telle quelle), ossature confirmée fiable
  par l'auteur du projet.
- **`audit_criteria`** (ce qui définit comment coder un extrait pendant
  l'analyse) : **reconstruit et figé le 15/08/2026**, voir
  `docs/cursaudit-criteria-v1.md` — grille complète des 30 critères (8
  Essentiel + 7 Approfondi + 15 Expert), avec codes stables, regroupement
  thématique et clés de sortie JSON. Migration `2026-08-15-cursaudit-criteria-v1.sql`
  **appliquée avec succès sur Supabase** (30 critères créés et peuplés),
  remplace le schéma placeholder vide de `2026-08-15-cursaudit-schema.sql`.
  Reste exclu volontairement : les critères contextuels personnels ("lentilles",
  ex. `audit_lenses`) — pas encore conçus, table séparée à venir.

Le questionnaire de qualification côté Cursus Édition (`banque_questions`/
`reponses_questionnaire`, point b ci-dessus) est un troisième objet
distinct, propre à chaque produit malgré la ressemblance de principe.

### c) Composants UI partagés

Aucune bibliothèque de composants n'existe aujourd'hui — style inline
dupliqué dans chaque fichier. Décision : extraire un petit socle commun
(bouton, pastille de statut colorée, modale) avant de démarrer l'UI de
CursAudit, pour ne pas dupliquer un second système de style en parallèle du
premier. Périmètre volontairement réduit — pas une refonte de design, juste
les trois briques qui seraient sinon copiées-collées.

---

## 3. Migrations nécessaires

**Écrite et appliquée le 15/08/2026** : `2026-08-15-cursaudit-schema.sql`.
`audits` existait déjà (voir section 2bis-a) ; les trois autres tables sont
créées. Reprend les points ci-dessous, tous résolus au moment de l'écrire —
laissés en l'état pour la trace historique :

- Toutes les tables `audit_*` proposées sont **nouvelles**, sans collision de
  nom avec l'existant.
- `audits.userId` doit référencer `auth.users` comme le fait déjà
  `projets.user_id` — même pattern RLS à répliquer (et **vérifier
  explicitement** que RLS est bien activé avec des policies dès la création :
  le piège vécu cette semaine avec `quotas_paliers` — RLS activé mais zéro
  policy, donc illisible en silence — doit être un test systématique sur
  chaque nouvelle table `audit_*`).
- `audit_pricing_rules` peut suivre le même schéma que `quotas_paliers`
  (table de configuration lue publiquement, écrite seulement en admin).
- `audit_criteria` (catalogue configurable) n'a pas d'équivalent actuel dans
  Cursus — c'est une brique réellement nouvelle.
- Aucune table `noeuds`-like n'existe pour du contenu non-manuscrit : créer
  `audit_sections` comme table indépendante plutôt que de réutiliser `noeuds`
  (mélanger les deux domaines dans une seule table casserait le typage
  `type: partie|chapitre|scene` déjà fermé par une contrainte CHECK côté
  `noeuds`, selon toute vraisemblance — à vérifier avant d'exclure
  définitivement la réutilisation, mais la séparation est plus sûre).

---

## 4. Plan de développement du MVP — évaluation de faisabilité

Le MVP défini section 36 du brief est cohérent avec l'existant sur les points
suivants : import DOCX/PDF/TXT (mammoth couvre DOCX ; PDF et TXT sont des
ajouts, pas des réécritures), comptage de caractères, rapport DOCX exportable.

Ordre proposé section 37 est réaliste **à une réserve près** : l'étape 6
("moteur d'analyse personnel/académique/professionnel") est de loin la plus
lourde et la moins réutilisable de l'existant — Cursus n'a aujourd'hui qu'un
seul type d'appel IA (suggestions d'écriture en texte libre pour un panneau
d'aide), jamais un appel IA à sortie JSON strictement typée et versionnée
comme le demande la section 31. C'est un chantier d'infrastructure IA en soi
(prompts versionnés + validation de schéma), à ne pas sous-estimer dans la
séquence — je recommande de le traiter comme sa propre étape 6bis avant
d'attaquer les trois moteurs métier, plutôt que de les débuter directement.

---

## 5. Risques et questions bloquantes

**Risques techniques :**
1. ~~**`claude-prox` hors dépôt**~~ **Résolu le 15/08/2026 (P0a) :** le code
   réel de la fonction est maintenant commité dans
   `supabase/functions/claude-prox/`. Comportement actuel documenté ici pour
   référence : authentifie l'utilisateur, lit son abonnement actif
   (`abonnements`) et le quota du palier (`quotas_paliers`), calcule la
   consommation du mois en cours (`usage_ia`), refuse au-delà du quota
   (429), sinon relaie l'appel tel quel à `POST
   https://api.anthropic.com/v1/messages` avec la clé `ANTHROPIC_KEY`, et
   journalise les tokens réellement consommés. Tout nouveau mode structuré
   JSON (section 2bis-a) devra donc soit étendre cette fonction (nouveau
   paramètre de rôle/schéma), soit en créer une distincte qui rejoue la même
   logique d'auth/quota — à trancher à ce moment-là, pas maintenant.
2. **Pas de couche de composants UI partagée** — construire CursAudit "à côté"
   sans extraire de composants communs (boutons, badges de statut, modales)
   dupliquera du style, au lieu de le réutiliser comme le demande le brief.
3. **RLS silencieuse** — risque déjà vécu une fois cette semaine
   (`quotas_paliers`), à traiter comme un item de check-list obligatoire pour
   chaque nouvelle table `audit_*`.

**Questions bloquantes, à trancher avant l'étape 2 (schéma de données) :**
1. ~~`audits` doit-il être une variante de `projets` (même table, colonne
   `type_produit` en plus) ou une table totalement séparée ?~~ **Tranché le
   15/08/2026 : table totalement séparée.** Le brief suppose une séparation
   nette (section 28 liste `audits` indépendamment de `projets`) et c'est ce
   qui est retenu. La séparation de table n'empêche pas de passer de l'un à
   l'autre produit sur un même travail — c'est une question distincte
   (chantier 2, déjà résolue par conception le 09/08) : `audits.projet_id`
   référencera le projet source en clé étrangère (pont bidirectionnel sans
   réimport, badge "Audit partiel" sur le projet en cours d'audit dans
   CursEdit). Le détail fin du pont (comportement du badge, effet d'une
   suppression du projet source, etc.) reste à préciser mais ne bloque plus
   le démarrage du schéma.
2. Le moteur IA à sortie JSON validée (section 31) est un composant
   d'infrastructure nouveau, pas une extension de `claude-prox` existant :
   confirmez-vous que c'est un chantier à part entière avant les moteurs
   d'analyse eux-mêmes ?
3. Le brief mentionne PDF et TXT comme formats prioritaires du MVP (section
   7) : aucune librairie de lecture PDF n'est présente dans `package.json`
   actuellement — à ajouter (ex. `pdf-parse` ou équivalent), et à valider
   comme dépendance avant de commencer l'étape 3.

---

*Ce document répond exactement aux 5 livrables demandés section 39 du brief.
Aucune modification de l'architecture centrale n'a été effectuée. En attente
de validation avant de commencer l'étape 2 (schéma de données Supabase).*
