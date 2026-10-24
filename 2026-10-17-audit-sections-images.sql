-- CURSUS — audit_sections : colonne images (point 2 de l'audit de
-- préparation à la commercialisation, 17/10/2026)
-- ======================================================================
-- Cas d'origine (liste-attente.md #4, demande de Joseph) : "Oracle du
-- Sermon sur la montagne", chaque carte associée à une image — aucune
-- image n'était jusqu'ici jamais lue par CursAudit, ni côté client ni
-- côté serveur, même pour un .docx qui en contient (contrairement à ce
-- que la liste d'attente supposait : CursAudit a son propre pipeline
-- d'upload, séparé de CursEdit/noeuds, qui ne lisait QUE le texte des
-- paragraphes Word).
--
-- `images` : tableau d'URLs publiques (bucket Supabase Storage
-- `images-manuscrits`, déjà utilisé par CursEdit et par l'import .docx
-- de CursEdit — voir ImportDocx.jsx) des images intégrées au paragraphe
-- Word qui a produit cette unité. NULL/[] pour un audit créé avant ce
-- correctif, ou pour du texte collé (jamais d'image possible dans ce
-- cas) — le client traite une absence comme un tableau vide.

alter table audit_sections
  add column images jsonb;

comment on column audit_sections.images is
  'URLs publiques (bucket images-manuscrits) des images Word intégrées à cette unité — voir src/lib/segmenterCursAudit.js (téléverserImagesDocx). [] ou NULL si aucune.';
