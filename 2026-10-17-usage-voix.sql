-- CURSUS — usage_voix : suivi de consommation voix (point 4 de l'audit de
-- préparation à la commercialisation, 17/10/2026)
-- ======================================================================
-- Gap documenté depuis le 01/10/2026 (CLAUDE.md, section "Lecture à voix
-- haute") : lire-texte et transcrire-audio appellent l'API OpenAI à chaque
-- usage (coût réel), mais rien n'en gardait trace — seule la vérification
-- "abonnement actif" existait, aucun suivi de volume. Jusqu'ici
-- surveillable uniquement via platform.openai.com/usage, confondu avec
-- toute autre consommation OpenAI du compte Cursus (transcrire-audio ET
-- lire-texte ET tout autre usage futur de la même clé).
--
-- Une ligne par appel réussi. `caracteres` (lire-texte, exact : longueur du
-- texte réellement envoyé à l'API) et `taille_octets`/`duree_secondes`
-- (transcrire-audio) sont indépendants l'un de l'autre — seuls les champs
-- pertinents à la fonctionnalité sont renseignés, les autres restent NULL.
-- Volontairement SANS calcul de coût en euros : les tarifs OpenAI évoluent,
-- les figer ici produirait un chiffre faux en silence dès le premier
-- changement de tarif — le volume brut reste exact quoi qu'il arrive,
-- à multiplier par le tarif du jour (platform.openai.com/pricing) pour
-- obtenir un coût.

create table usage_voix (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  fonctionnalite  text not null check (fonctionnalite in ('lecture_voix', 'dictee_vocale')),
  -- lecture_voix (lire-texte) : longueur exacte du texte envoyé à l'API.
  caracteres      integer,
  -- dictee_vocale (transcrire-audio) : taille du fichier audio reçu — un
  -- PROXY du volume, pas une mesure exacte de durée (OpenAI facture cette
  -- API à la durée, pas au poids du fichier ; la durée exacte n'est pas
  -- renvoyée de façon fiable par ce modèle — voir le commentaire dans
  -- transcrire-audio/index.ts). duree_secondes reste prévue pour le jour
  -- où une source fiable de durée serait disponible, actuellement NULL.
  taille_octets   integer,
  duree_secondes  numeric,
  cree_le         timestamptz not null default now()
);

create index idx_usage_voix_user on usage_voix(user_id);
create index idx_usage_voix_cree_le on usage_voix(cree_le);

alter table usage_voix enable row level security;

-- Lecture : chacun voit sa propre consommation (base d'un futur écran
-- "mon usage" côté auteur·ice, pas construit dans cette passe). Écriture :
-- aucune policy insert pour les comptes normaux — seules les Edge
-- Functions (clé service_role, qui contourne RLS) écrivent ici, jamais le
-- client directement.
create policy "usage_voix_propre" on usage_voix
  for select using (auth.uid() = user_id);
