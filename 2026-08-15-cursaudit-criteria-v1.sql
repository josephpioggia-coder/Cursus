-- CURSAUDIT — audit_criteria v1 : catalogue réel des dimensions d'analyse
-- ======================================================================
-- Remplace le schéma placeholder de audit_criteria créé dans
-- 2026-08-15-cursaudit-schema.sql (table vide au moment de ce script,
-- aucune donnée perdue par le drop ci-dessous).
--
-- Grille reconstruite par l'auteur du projet le 15/08/2026, à partir d'un
-- travail mené en amont avec GPT (conversation source non retrouvée telle
-- quelle, mais ossature confirmée fiable) et recoupée avec un rapport
-- CursAudit produit hors code, qui utilisait déjà des catégories proches
-- (NORM/JUDG/FACT-OBS/SUBJ/SPIR/EFF/MIX/METAPH, exigence de preuve
-- faible/modérée/forte).
--
-- Rôle exact de cette table (précisé par l'auteur du projet) : le
-- CATALOGUE des dimensions mobilisables selon la profondeur choisie
-- (8/15/30, voir docs/cursaudit-tarification.md), PAS les résultats d'un
-- audit — ceux-ci iront dans une table séparée (ex. `audit_findings`,
-- pas encore créée) qui référencera ces critères par `code` stable.
--
-- Exclu volontairement de cette table : les critères contextuels propres
-- à un auteur, un projet ou une relation (dits "lentilles" par l'auteur du
-- projet — ex. audit_lenses). Mélanger les deux romprait la distinction
-- entre grille générale (valable pour tous) et grille contextuelle
-- (propre à un cas). Pas créée ici, faute de schéma proposé — à concevoir
-- séparément le moment venu.
--
-- `family_code` : regroupement thématique proposé par Claude pour
-- organiser la lecture de la grille (nature_enonce / preuve_et_source /
-- argumentation / fonction_texte / rhetorique_influence /
-- risque_et_diagnostic) — PAS dicté par l'auteur du projet, à corriger
-- si le regroupement ne convient pas à l'usage réel.
-- `prompt_question` : laissé vide pour les 30 critères, reste à rédiger —
-- hors périmètre de cette reconstruction.

drop table if exists audit_criteria;

create table audit_criteria (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  label           text not null,
  description     text,
  family_code     text not null,
  sort_order      integer not null,
  min_grid_level  integer not null check (min_grid_level in (8, 15, 30)),
  output_key      text not null unique,
  prompt_question text,
  applies_to      text[] not null default array['personal', 'academic', 'professional', 'literary'],
  is_active       boolean not null default true,
  version         integer not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_audit_criteria_grid_level on audit_criteria(min_grid_level);
create index idx_audit_criteria_family     on audit_criteria(family_code);

create or replace function set_audit_criteria_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_audit_criteria_updated_at
before update on audit_criteria
for each row
execute function set_audit_criteria_updated_at();

alter table audit_criteria enable row level security;

-- Lecture publique des critères actifs (catalogue affiché côté produit),
-- écriture réservée à service_role — aucune policy d'écriture créée
-- volontairement, même esprit que audit_pricing_rules.
create policy "audit_criteria_lecture_publique" on audit_criteria
  for select using (is_active = true);

-- ── Seed : grille 8 / 15 / 30, reconstruite le 15/08/2026 ──────────────

-- Palier Essentiel (8 critères)
insert into audit_criteria (code, label, description, family_code, sort_order, min_grid_level, output_key) values
  ('ENONCE_TYPE',             'Type d''énoncé',                      'fait, jugement, métaphore, croyance, prescription, témoignage, etc.',                        'nature_enonce',        1, 8, 'enonce_type'),
  ('STATUT_EPISTEMIQUE',      'Statut épistémique',                  'ce que l''énoncé prétend être : constat, hypothèse, vérité générale, expérience subjective', 'nature_enonce',        2, 8, 'statut_epistemique'),
  ('BESOIN_PREUVE',           'Besoin de preuve',                    'faible, modéré, fort, expertise requise',                                                    'preuve_et_source',     3, 8, 'besoin_preuve'),
  ('SOURCE_TRACE',            'Source / traçabilité',                'présence ou absence d''un appui vérifiable',                                                 'preuve_et_source',     4, 8, 'source_trace'),
  ('COHERENCE_ARGUMENTATIVE', 'Cohérence argumentative',             'lien logique entre l''énoncé et ce qui l''entoure',                                          'argumentation',        5, 8, 'coherence_argumentative'),
  ('FONCTION_TEXTE',          'Fonction dans le texte',              'récit, pédagogie, démonstration, cadrage, transition, promesse',                            'fonction_texte',       6, 8, 'fonction_texte'),
  ('RISQUE_INFLUENCE',        'Risque d''influence ou de glissement', 'autorité, généralisation, promesse implicite, effet de halo',                              'rhetorique_influence', 7, 8, 'risque_influence'),
  ('DIAGNOSTIC_PRIORITE',     'Diagnostic prioritaire',              'recevable, à nuancer, à sourcer, à reformuler, à vérifier',                                  'risque_et_diagnostic', 8, 8, 'diagnostic_priorite');

-- Palier Approfondi (+7, total 15)
insert into audit_criteria (code, label, description, family_code, sort_order, min_grid_level, output_key) values
  ('CATEGORIE_EPISTEMIQUE', 'Catégorie épistémique fine',   'factuel, clinique, spirituel, symbolique, poétique, commercial, normatif',          'nature_enonce',        9,  15, 'categorie_epistemique'),
  ('NIVEAU_PREUVE',         'Niveau de preuve disponible',  'aucun, interne, témoignage, source citée, source externe, consensus',               'preuve_et_source',     10, 15, 'niveau_preuve'),
  ('REFERENCES_CITEES',     'Références citées',            'auteur, ouvrage, école, source, note, lien',                                         'preuve_et_source',     11, 15, 'references_citees'),
  ('PORTEE_GENERALISATION', 'Portée de la généralisation',  'expérience personnelle, cas particulier, proposition générale, prescription',       'argumentation',        12, 15, 'portee_generalisation'),
  ('PROCEDE_ARGUMENTATIF',  'Procédé argumentatif',         'analogie, induction, déduction, autorité, récit exemplaire, opposition',            'argumentation',        13, 15, 'procede_argumentatif'),
  ('EFFET_STYLE',           'Effet de style',               'emphase, dramatisation, lyrisme, apaisement, injonction, séduction',                'rhetorique_influence', 14, 15, 'effet_style'),
  ('COHERENCE_CONTEXTE',    'Cohérence avec le contexte',   'compatibilité avec l''amont, l''aval, le projet et le genre du texte',              'argumentation',        15, 15, 'coherence_contexte');

-- Palier Expert (+15, total 30)
insert into audit_criteria (code, label, description, family_code, sort_order, min_grid_level, output_key) values
  ('LITTERAL_METAPHORIQUE',    'Littéral / métaphorique',          'éviter de traiter une image comme une preuve, ou une preuve comme une image',            'nature_enonce',        16, 30, 'litteral_metaphorique'),
  ('SUJET_ACTEUR_CIBLE',       'Sujet, acteur, cible',             'qui parle, de qui, à qui, avec quel effet',                                               'nature_enonce',        17, 30, 'sujet_acteur_cible'),
  ('VALIDATION_SOURCE',        'Source de validation disponible',  'interne au texte, externe, académique, clinique, institutionnelle',                       'preuve_et_source',     18, 30, 'validation_source'),
  ('INDEPENDANCE_VALIDATION',  'Indépendance de la validation',    'source indépendante, liée, intéressée, institutionnelle, commerciale',                   'preuve_et_source',     19, 30, 'independance_validation'),
  ('ACTUALITE_SOURCE',         'Actualité / obsolescence',         'source récente, ancienne, stable, controversée',                                          'preuve_et_source',     20, 30, 'actualite_source'),
  ('CHAINE_CAUSALE',           'Chaîne causale',                   'causalité explicite, implicite, spéculative, absente',                                    'argumentation',        21, 30, 'chaine_causale'),
  ('GLISSEMENT_REGISTRE',      'Glissement de registre',           'du récit vers la méthode, du témoignage vers la prescription, du symbole vers le fait',  'rhetorique_influence', 22, 30, 'glissement_registre'),
  ('PRESUPPOSE_IMPLICITE',     'Présupposé implicite',             'ce que le texte suppose sans le dire',                                                    'argumentation',        23, 30, 'presuppose_implicite'),
  ('ETHOS_AUTORITE',           'Ethos / autorité',                 'autorité de l''auteur, de la préfacière, du thérapeute, du témoin',                      'rhetorique_influence', 24, 30, 'ethos_autorite'),
  ('PATHOS_INTENSITE',         'Intensité émotionnelle',           'émotion légitime ou amplification persuasive',                                            'rhetorique_influence', 25, 30, 'pathos_intensite'),
  ('PROMESSE_LECTEUR',         'Promesse faite au lecteur',        'transformation, guérison, révélation, compréhension, soulagement',                       'rhetorique_influence', 26, 30, 'promesse_lecteur'),
  ('CONTRAT_LECTURE',          'Contrat de lecture',               'roman, témoignage, essai, manuel, guide, récit initiatique',                              'fonction_texte',       27, 30, 'contrat_lecture'),
  ('FONCTION_PEDAGOGIQUE',     'Fonction pédagogique',             'explication, exercice, transmission, avertissement, vulgarisation',                      'fonction_texte',       28, 30, 'fonction_pedagogique'),
  ('RISQUE_ETHIQUE_EXPERTISE', 'Risque éthique / expertise',       'médical, thérapeutique, juridique, académique, financier, relationnel',                  'risque_et_diagnostic', 29, 30, 'risque_ethique_expertise'),
  ('RECOMMANDATION_ACTION',    'Recommandation d''action',         'conserver, nuancer, sourcer, déplacer, reformuler, supprimer, expertiser',               'risque_et_diagnostic', 30, 30, 'recommandation_action');

select 'audit_criteria v1 créée et peuplée (30 critères) ✓' as résultat;
