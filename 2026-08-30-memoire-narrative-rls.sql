-- CURSUS — RLS sur memoire_narrative (référence 60816-01, suite, 30/08/2026)
-- ======================================================================
-- Oubli de 2026-08-30-memoire-narrative.sql : la table est lue/écrite
-- directement depuis le navigateur (mémoireNarrativeAPI, src/lib/api.js),
-- comme profils_auteur (voir 2026-08-28-profil-auteur.sql) — sans RLS,
-- n'importe quel compte connecté pourrait lire ou modifier la mémoire
-- narrative de n'importe quel autre compte via le SDK client. Même
-- convention que profils_auteur : propriété par user_id, select/insert/
-- update, pas de suppression (mémoireNarrativeAPI n'en expose aucune).

alter table memoire_narrative enable row level security;

create policy "memoire_narrative_proprietaire_lecture" on memoire_narrative
  for select using (auth.uid() = user_id);
create policy "memoire_narrative_proprietaire_ecriture" on memoire_narrative
  for insert with check (auth.uid() = user_id);
create policy "memoire_narrative_proprietaire_maj" on memoire_narrative
  for update using (auth.uid() = user_id);

select 'RLS activé sur memoire_narrative ✓' as résultat;
