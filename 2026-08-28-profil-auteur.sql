-- CURSUS — Profil auteur (référence 60816-01, suite, 28/08/2026)
-- Une ligne par utilisateur (pas par audit/projet) — rempli une fois,
-- réutilisé partout (CursAudit aujourd'hui, CursEdit à suivre). Entièrement
-- optionnel : peut rester vide indéfiniment sans bloquer quoi que ce soit.
-- Voir ProfilAuteur.jsx, extraire-profil-cursus (Edge Function) et
-- docs/PAQUET-DE-REPRISE-2026-08-27.md.

create table if not exists profils_auteur (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  profession         text,
  identite_genre     text,
  tranche_age        text,
  niveau_etudes      text,
  matieres_etudiees  text,
  texte_source_brut  text,  -- CV ou profil LinkedIn collé tel quel par l'auteur
  resume_parcours    text,  -- synthèse produite par extraire-profil-cursus, si utilisé
  mis_a_jour_le      timestamptz not null default now()
);

alter table profils_auteur enable row level security;

create policy "profils_auteur_proprietaire_lecture" on profils_auteur
  for select using (auth.uid() = user_id);
create policy "profils_auteur_proprietaire_ecriture" on profils_auteur
  for insert with check (auth.uid() = user_id);
create policy "profils_auteur_proprietaire_maj" on profils_auteur
  for update using (auth.uid() = user_id);
