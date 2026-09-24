-- CURSUS — Bucket Supabase Storage pour les images insérées dans CursEdit
-- ======================================================================
-- 24/09/2026, demande de Joseph : "pouvoir intégrer des schémas ou des
-- photos dans le texte, dans CursEdit" (phase 1 — insertion + affichage
-- seulement, voir Editeur.jsx : Image.configure(...) et téléverserImage()
-- dans BarreOutils). CursAudit/CopiloteIA ne "voient" pas encore le
-- contenu de ces images (le pipeline d'analyse aplatit tout en texte
-- brut) — un chantier séparé, plus coûteux (mode vision de Claude).

-- 1) Le bucket — public en LECTURE (les images doivent s'afficher dans
--    l'éditeur et dans un export sans authentification), mais l'ÉCRITURE
--    reste contrôlée par les policies RLS ci-dessous (un bucket "public"
--    chez Supabase veut dire "lecture par URL publique sans vérifier
--    RLS", pas "n'importe qui peut y déposer des fichiers").
insert into storage.buckets (id, name, public)
values ('images-manuscrits', 'images-manuscrits', true)
on conflict (id) do nothing;

-- 2) Écriture : un auteur ne peut déposer que dans SON PROPRE dossier —
--    le chemin est toujours préfixé par son user_id côté client
--    (voir téléverserImage() : `${user.id}/...`), cette policy l'impose
--    aussi côté serveur pour qu'un compte ne puisse pas écrire dans le
--    dossier d'un autre en falsifiant le chemin depuis le client.
create policy "Auteurs déposent leurs images dans leur propre dossier"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'images-manuscrits'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 3) Lecture : le bucket étant public, les URLs publiques (/object/public/...)
--    fonctionnent déjà sans cette policy — ajoutée quand même pour toute
--    utilisation future de l'API authentifiée (ex. lister ses propres
--    images), jamais utilisée aujourd'hui par le code.
create policy "Lecture des images de manuscrits"
on storage.objects for select
to public
using (bucket_id = 'images-manuscrits');

-- 4) Suppression : un auteur peut retirer une image qu'il a lui-même
--    déposée (pas encore de bouton "supprimer" côté interface au
--    24/09/2026, mais la policy est posée dès maintenant plutôt que
--    d'y repenser plus tard).
create policy "Auteurs suppriment leurs propres images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'images-manuscrits'
  and (storage.foldername(name))[1] = auth.uid()::text
);
