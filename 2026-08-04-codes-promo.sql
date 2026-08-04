-- CURSUS — Codes promotionnels pilotés par base de données (60804-02)
-- ======================================================================
-- Remplace l'ancien système de codes auto-vérifiants par signature HMAC
-- (src/lib/codePromo.mjs, verifierCodePromo — à retirer côté applicatif,
-- hors périmètre de cette migration SQL).
--
-- Le texte lisible du code (ex. HMSI-202608-DEC-100P-1M-K7Q) ne fait
-- jamais foi techniquement : la règle réelle est cette table. Validation
-- côté serveur uniquement, dans creer-session-checkout (contrôle souple,
-- à l'affichage) et stripe-webhook (contrôle atomique, à la confirmation
-- réelle du paiement, via consommer_code_promo()).

-- ── Table des codes ──────────────────────────────────────────────────
create table codes_promo (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique check (code = upper(code)),
  description         text,
  client_email        text,
  palier_cible        text,
  remise_pourcent     integer not null check (remise_pourcent between 5 and 100),
  duree_mois          integer not null default 0 check (duree_mois between 0 and 99),
  date_debut          timestamptz,
  date_fin            timestamptz,
  utilisations_max    integer check (utilisations_max is null or utilisations_max > 0),
  actif               boolean not null default true,
  cree_par            uuid references auth.users(id),
  cree_le             timestamptz not null default now(),
  modifie_le          timestamptz not null default now(),
  constraint periode_valide check (
    date_fin is null or date_debut is null or date_fin >= date_debut
  )
);

create index idx_codes_promo_actif on codes_promo(actif) where actif = true;

-- ── Trigger : modifie_le suit automatiquement chaque UPDATE ──────────
create or replace function set_codes_promo_modifie_le()
returns trigger
language plpgsql
as $$
begin
  new.modifie_le := now();
  return new;
end;
$$;

create trigger trg_codes_promo_modifie_le
before update on codes_promo
for each row
execute function set_codes_promo_modifie_le();

-- ── Table des utilisations réelles (posées par stripe-webhook, jamais
--    par creer-session-checkout) ─────────────────────────────────────
create table utilisations_codes_promo (
  id                  uuid primary key default gen_random_uuid(),
  code_promo_id       uuid not null references codes_promo(id),
  user_id             uuid references auth.users(id),
  email_utilise       text not null,
  stripe_session_id   text not null unique,
  utilise_le          timestamptz not null default now()
);

create index idx_utilisations_code on utilisations_codes_promo(code_promo_id);

-- RLS fermée par défaut sur les deux tables : aucune policy créée, donc
-- deny total pour anon/authenticated. Seul service_role (Edge Functions)
-- contourne RLS. Voulu — c'est l'inverse du besoin sur quotas_paliers.
alter table codes_promo enable row level security;
alter table utilisations_codes_promo enable row level security;

-- ── Fonction atomique de consommation ────────────────────────────────
-- Appelée UNIQUEMENT par stripe-webhook, sur checkout.session.completed.
--
-- Ordre des contrôles (corrigé — double vérification stripe_session_id) :
--   1. Premier test d'existence de stripe_session_id, avant tout verrou
--      (rapide, évite de verrouiller pour rien dans le cas courant).
--   2. Verrouille la ligne du code (FOR UPDATE) : deux webhooks
--      concurrents sur le MÊME code s'exécutent en série à partir d'ici.
--   3. Code inexistant (p_code_promo_id ne correspond à aucune ligne)
--      → false proprement (FOUND reste faux après le SELECT ... FOR UPDATE).
--   4. Second test d'existence de stripe_session_id, APRÈS le verrou :
--      couvre le cas où deux webhooks identiques arrivent en parallèle —
--      le second a pu passer le premier test avant que le premier
--      n'insère sa ligne, puis attendre le verrou ; une fois le verrou
--      obtenu, il doit revérifier plutôt que recompter une limite déjà
--      franchie par le jumeau qu'il vient de laisser passer devant lui.
--   5. Limite d'utilisations → false si atteinte, rien n'est inséré.
--   6. Insertion, avec ON CONFLICT DO NOTHING comme filet de sécurité
--      final (la contrainte unique sur stripe_session_id est la garantie
--      ultime, même si un cas non prévu contournait les tests ci-dessus).
create or replace function consommer_code_promo(
  p_code_promo_id     uuid,
  p_user_id           uuid,
  p_email             text,
  p_stripe_session_id text
) returns boolean
language plpgsql
as $$
declare
  v_max   integer;
  v_count integer;
begin
  -- 1. Premier test d'existence (avant verrou).
  if exists (
    select 1 from utilisations_codes_promo
    where stripe_session_id = p_stripe_session_id
  ) then
    return true;
  end if;

  -- 2. Verrouille la ligne du code.
  select utilisations_max into v_max
  from codes_promo where id = p_code_promo_id for update;

  if not found then
    return false;  -- code_promo_id inconnu
  end if;

  -- 3. Second test d'existence, après obtention du verrou.
  if exists (
    select 1 from utilisations_codes_promo
    where stripe_session_id = p_stripe_session_id
  ) then
    return true;
  end if;

  -- 4. Limite d'utilisations.
  select count(*) into v_count
  from utilisations_codes_promo where code_promo_id = p_code_promo_id;

  if v_max is not null and v_count >= v_max then
    return false;
  end if;

  -- 5. Enregistrement, ON CONFLICT comme filet de sécurité supplémentaire.
  insert into utilisations_codes_promo (code_promo_id, user_id, email_utilise, stripe_session_id)
  values (p_code_promo_id, p_user_id, p_email, p_stripe_session_id)
  on conflict (stripe_session_id) do nothing;

  return true;
end;
$$;

revoke all on function consommer_code_promo from public, anon, authenticated;
grant execute on function consommer_code_promo to service_role;
