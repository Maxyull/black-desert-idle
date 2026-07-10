-- Bucket Storage public pour les modèles 3D des compagnons (.glb + textures).
-- Lecture publique (chargés par Three.js côté client, module src/companions/),
-- écriture réservée au staff admin (même convention que les RPC admin_* du projet :
-- auth.jwt()->>'email' = 'maxime.lacoste@icloud.com').
-- Convention de chemin : {section}/{artKey}_{tier}.glb (ex: loot/black_mask_cat_T5.glb),
-- reprend directement la structure de output/loot/tiers et output/combat/tiers (non versionné,
-- ~1,8 Go au total, jamais commité dans le repo git).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('companion-models', 'companion-models', true, 104857600, array['model/gltf-binary','image/png','application/octet-stream'])
on conflict (id) do nothing;

drop policy if exists "companion_models_public_read" on storage.objects;
create policy "companion_models_public_read" on storage.objects
  for select using (bucket_id = 'companion-models');

drop policy if exists "companion_models_admin_write" on storage.objects;
create policy "companion_models_admin_write" on storage.objects
  for insert with check (
    bucket_id = 'companion-models'
    and coalesce(auth.jwt()->>'email','') = 'maxime.lacoste@icloud.com'
  );

drop policy if exists "companion_models_admin_update" on storage.objects;
create policy "companion_models_admin_update" on storage.objects
  for update using (
    bucket_id = 'companion-models'
    and coalesce(auth.jwt()->>'email','') = 'maxime.lacoste@icloud.com'
  );

drop policy if exists "companion_models_admin_delete" on storage.objects;
create policy "companion_models_admin_delete" on storage.objects
  for delete using (
    bucket_id = 'companion-models'
    and coalesce(auth.jwt()->>'email','') = 'maxime.lacoste@icloud.com'
  );
