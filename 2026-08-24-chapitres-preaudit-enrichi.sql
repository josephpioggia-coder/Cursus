-- CURSUS — Chapitres détectés, pour le pré-audit enrichi chapitre par chapitre
-- (référence 60816-01, suite, 24/08/2026)
-- ======================================================================
-- Chantier décidé après un échange sur la fiabilité des délais du
-- pré-audit et le fait que GPT peut dépasser les 150s de Supabase sur un
-- seul appel : plutôt que de simplement corriger ce point, l'auteur du
-- projet a proposé d'enrichir le pré-audit d'une lecture chapitre par
-- chapitre (au lieu de seulement une lecture globale du livre entier),
-- pour un livrable plus complet (10-20 pages au lieu de ~12), toujours au
-- même prix (40% du prix de l'audit détaillé, l'API ne coûte quasiment
-- rien — moins d'1€ pour tout le mois d'août sur les deux comptes API).
--
-- `chapitres_detectes` (audits) : le résultat de
-- extraireParagraphesDocxAvecChapitres() (segmenterCursAudit.js), figé au
-- moment de la création de l'audit — [{titre, indexPremièreUnité,
-- nombreUnités, mots}, ...]. null si l'audit vient de texte collé (pas de
-- style Word à lire) ou si aucune structure de titres répétée n'a été
-- détectée.
--
-- `chapitres_confirmes` (audits) : le client doit explicitement confirmer
-- ce découpage (affiché dans l'aperçu gratuit) avant de pouvoir lancer le
-- pré-audit — pour éviter qu'il paie un pré-audit dont le résultat sera
-- compromis par des titres mal placés ou manquants sans avoir eu
-- l'occasion de le corriger avant. Défaut false ; reste false si
-- chapitres_detectes est null (rien à confirmer, le pré-audit reste alors
-- une lecture globale seule, sans volet chapitre par chapitre).
--
-- `chapitre_index` (audit_sections) : pour chaque unité, l'index (dans
-- chapitres_detectes) du chapitre auquel elle appartient. null si
-- l'unité précède le premier titre détecté, ou si l'audit n'a pas de
-- structure de chapitres.

alter table audits
  add column chapitres_detectes jsonb,
  add column chapitres_confirmes boolean not null default false;

alter table audit_sections
  add column chapitre_index integer;

select 'chapitres_detectes / chapitres_confirmes / chapitre_index ajoutées ✓' as résultat;
