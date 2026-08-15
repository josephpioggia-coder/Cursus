-- CURSAUDIT — Schéma de base (audits, tarification, sections, critères)
-- ======================================================================
-- Migration jamais appliquée automatiquement : à copier-coller dans le SQL
-- Editor Supabase après relecture, comme les migrations précédentes de ce
-- dépôt (2026-08-04-codes-promo.sql, 2026-08-04-admins.sql).
--
-- Décisions actées dans docs/cursaudit-cartographie-technique.md et
-- docs/cursaudit-tarification.md (session du 15/08/2026), reprises ici :
--   - `audits` est une table séparée de `projets`, jamais une variante avec
--     une colonne type_produit (question bloquante n°1, tranchée).
--   - Pont bidirectionnel sans réimport : `audits.projet_id` référence le
--     projet CursEdit source, en clé étrangère nullable (un audit peut
--     aussi naître d'un import direct, sans projet CursEdit associé).
--   - `audit_pricing_rules` reprend le calculateur Excel transcrit dans
--     docs/cursaudit-tarification.md (paliers de dimensions, modes IA,
--     types de rapport, paramètres globaux) — lue publiquement, écrite
--     seulement en admin, même esprit que `quotas_paliers`.
--   - `audit_sections` est indépendante de `noeuds` (contenu non-manuscrit,
--     éviterait de casser la contrainte CHECK de noeuds.type).
--   - `audit_criteria` est un catalogue distinct de `banque_questions` (la
--     grille d'analyse, pas le questionnaire de qualification en amont).
--   - RLS activée avec policies dès la création sur chaque table — leçon
--     du piège vécu sur `quotas_paliers` (RLS activée mais zéro policy,
--     illisible en silence).

-- ─── TABLE : audits ────────────────────────────────────────────────────

create table audits (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  -- Pont vers CursEdit — nullable : un audit peut naître d'un import direct,
  -- sans projet CursEdit associé (voir chantier 2, badge "Audit partiel"
  -- affiché côté CursEdit quand ce champ est renseigné).
  projet_id         uuid references projets(id) on delete set null,
  titre             text not null default 'Audit sans titre',
  statut            text not null default 'brouillon'
                       check (statut in ('brouillon', 'paye', 'en_traitement', 'termine', 'echec')),
  palier_dimensions text not null check (palier_dimensions in ('essentiel', 'approfondi', 'expert', 'libre')),
  nombre_dimensions integer not null check (nombre_dimensions > 0),
  mode_ia           text not null check (mode_ia in ('1 IA', '2 IA', '2 IA + confrontation ciblée', '2 IA + arbitrage dialogique')),
  type_rapport      text not null check (type_rapport in ('Aucun', 'Synthèse courte', 'Rapport complet')),
  nombre_pages      integer not null check (nombre_pages > 0),
  -- Prix figé au moment du paiement — jamais recalculé rétroactivement si
  -- le calculateur change ensuite (traçabilité de ce qui a été payé).
  prix_ttc          numeric(10,2) not null check (prix_ttc >= 0),
  remise_appliquee  numeric(10,2) not null default 0 check (remise_appliquee >= 0),
  stripe_session_id text unique,
  cree_le           timestamptz not null default now(),
  modifie_le        timestamptz not null default now()
);

create index idx_audits_user   on audits(user_id);
create index idx_audits_projet on audits(projet_id);

create or replace function set_audits_modifie_le()
returns trigger
language plpgsql
as $$
begin
  new.modifie_le := now();
  return new;
end;
$$;

create trigger trg_audits_modifie_le
before update on audits
for each row
execute function set_audits_modifie_le();

alter table audits enable row level security;

create policy "audits_propres" on audits
  for all using (auth.uid() = user_id);

-- ─── TABLE : audit_sections (unités analysées, indépendante de noeuds) ──

create table audit_sections (
  id               uuid primary key default gen_random_uuid(),
  audit_id         uuid not null references audits(id) on delete cascade,
  ordre            integer not null default 0,
  texte_source     text not null,
  -- Sortie du moteur IA structuré (supabase/functions/_shared/moteur-ia-structure.ts),
  -- déjà validée contre le schema_sortie au moment de l'appel — stockée
  -- telle quelle, forme libre tant que le schéma définitif d'AuditFinding
  -- n'est pas figé.
  resultat_analyse jsonb,
  cree_le          timestamptz not null default now()
);

create index idx_audit_sections_audit on audit_sections(audit_id);

alter table audit_sections enable row level security;

create policy "audit_sections_propres" on audit_sections
  for all using (
    exists (
      select 1 from audits
      where audits.id = audit_sections.audit_id
        and audits.user_id = auth.uid()
    )
  );

-- ─── TABLE : audit_criteria (grille d'analyse, catalogue configurable) ──
-- Distinct de banque_questions : ceci définit COMMENT coder un extrait
-- pendant l'analyse, pas ce qu'on demande en amont d'une session.

create table audit_criteria (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  libelle        text not null,
  categorie      text,
  description    text,
  -- Premier palier de dimensions qui introduit ce critère (voir
  -- docs/cursaudit-tarification.md section 1 — Essentiel/Approfondi/Expert
  -- sont cumulatifs : Expert inclut les critères d'Approfondi et Essentiel).
  palier_minimum text not null default 'essentiel'
                    check (palier_minimum in ('essentiel', 'approfondi', 'expert')),
  ordre          integer not null default 0,
  actif          boolean not null default true,
  cree_le        timestamptz not null default now()
);

alter table audit_criteria enable row level security;

-- Lecture publique des critères actifs (catalogue affiché côté produit),
-- écriture réservée à service_role (Edge Function admin, même esprit que
-- admin-codes-promo) — aucune policy d'écriture créée volontairement.
create policy "audit_criteria_lecture_publique" on audit_criteria
  for select using (actif = true);

-- ─── TABLE : audit_pricing_rules (calculateur transcrit, configurable) ──
-- Transcription des 4 onglets du calculateur (docs/cursaudit-tarification.md) :
-- paliers de dimensions, modes IA, types de rapport, paramètres globaux.
-- Même esprit que quotas_paliers : lue publiquement, écrite seulement en
-- admin (aucune policy d'écriture créée volontairement).

create table audit_pricing_rules (
  id               uuid primary key default gen_random_uuid(),
  categorie        text not null check (categorie in ('palier_dimensions', 'mode_ia', 'type_rapport', 'parametre_global')),
  cle              text not null,
  libelle          text,
  valeur_numerique numeric not null,
  description      text,
  actif            boolean not null default true,
  cree_le          timestamptz not null default now(),
  modifie_le       timestamptz not null default now(),
  unique (categorie, cle)
);

create or replace function set_audit_pricing_rules_modifie_le()
returns trigger
language plpgsql
as $$
begin
  new.modifie_le := now();
  return new;
end;
$$;

create trigger trg_audit_pricing_rules_modifie_le
before update on audit_pricing_rules
for each row
execute function set_audit_pricing_rules_modifie_le();

alter table audit_pricing_rules enable row level security;

create policy "audit_pricing_rules_lecture_publique" on audit_pricing_rules
  for select using (actif = true);

-- ── Seed : valeurs actuelles du calculateur (docs/cursaudit-tarification.md) ──

insert into audit_pricing_rules (categorie, cle, libelle, valeur_numerique, description) values
  ('palier_dimensions', 'essentiel',  'Essentiel',  8,  'Lecture exhaustive, coût minimal.'),
  ('palier_dimensions', 'approfondi', 'Approfondi', 15, 'Analyse plus éditoriale.'),
  ('palier_dimensions', 'expert',     'Expert',     30, 'Profondeur maximale.');
  -- Le palier "Libre" (dimensions au choix de l'utilisateur) n'a pas de
  -- ligne fixe ici : sa valeur_numerique est saisie dynamiquement, pas
  -- configurée en base.

insert into audit_pricing_rules (categorie, cle, libelle, valeur_numerique, description) values
  ('mode_ia', '1 IA',                          '1 IA',                          1,    'Une IA analyse toutes les lignes.'),
  ('mode_ia', '2 IA',                          '2 IA',                          1.55, 'Deuxième IA relit et contrôle la première.'),
  ('mode_ia', '2 IA + confrontation ciblée',   '2 IA + confrontation ciblée',   1.9,  'La seconde IA conteste seulement les points sensibles ou désaccords.'),
  ('mode_ia', '2 IA + arbitrage dialogique',   '2 IA + arbitrage dialogique',   2.35, 'Deux IA argumentent les désaccords puis consolidation/arbitrage.');

insert into audit_pricing_rules (categorie, cle, libelle, valeur_numerique, description) values
  ('type_rapport', 'Aucun',           'Aucun',           0, 'Excel / résultats structurés uniquement.'),
  ('type_rapport', 'Synthèse courte', 'Synthèse courte', 2, 'Rapport synthétique d''environ 8–15 pages.'),
  ('type_rapport', 'Rapport complet', 'Rapport complet', 6, 'Rapport rédigé, motifs, recommandations, traçabilité.');

insert into audit_pricing_rules (categorie, cle, libelle, valeur_numerique, description) values
  ('parametre_global', 'cout_unite_base',                  'Coût de base par unité (8 dimensions)', 0.013, '€ / unité, calibré sur 150 pages / 8 dimensions / 1 IA / 8,5 unités/page.'),
  ('parametre_global', 'dimensions_reference',              'Dimensions de référence',               8,     'Le coût varie proportionnellement au nombre de dimensions analysées.'),
  ('parametre_global', 'unites_par_page',                   'Unités analysées par page',             8.5,   'Moyenne observée, à ajuster selon densité du manuscrit.'),
  ('parametre_global', 'marge_securite_pct',                'Marge de sécurité coût IA',             15,    '%, appliquée au coût IA brut avant marge commerciale.'),
  ('parametre_global', 'tva_pct',                           'TVA',                                   21,    '%.'),
  ('parametre_global', 'remise_abonne_cursedit_pct',        'Remise abonné CursEdit',                20,    '%, décidée le 15/08/2026 — voir plafond ci-dessous.'),
  ('parametre_global', 'plafond_remise_pct_abonnement',     'Plafond de la remise abonné',           50,    '% du prix mensuel de l''abonnement CursEdit de l''utilisateur — remise = min(remise_abonne_cursedit_pct × prix, plafond_remise_pct_abonnement × prix_mensuel_abonnement).');

-- Le multiplicateur de prix commercial (×2 à ×4 selon le niveau de service,
-- voir docs/cursaudit-tarification.md "Note de conception") varie par
-- combinaison palier/mode/rapport plutôt que par un facteur unique — laissé
-- hors de cette table pour l'instant, à transposer quand le moteur de
-- calcul réel sera codé (pas seulement sa configuration).

select 'Schéma CursAudit créé avec succès ✓' as résultat;
