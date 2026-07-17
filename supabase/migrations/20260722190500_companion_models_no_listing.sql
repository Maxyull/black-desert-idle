-- Durcissement bucket companion-models (2026-07-16, audit sécurité) : la policy SELECT
-- `companion_models_public_read` (using bucket_id='companion-models') permettait à n'importe qui
-- d'ÉNUMÉRER tous les fichiers du bucket via l'API storage (advisor public_bucket_allows_listing).
-- Le bucket est public : les modèles restent servis par URL publique directe
-- (COMPANION_MODELS_BASE dans src/companions/viewer3d.js, .../object/public/companion-models/...),
-- qui ne dépend PAS de cette policy. Le jeu ne fait jamais de .list() sur ce bucket -> on peut
-- retirer la policy sans casser le chargement des compagnons, tout en empêchant l'énumération.
drop policy if exists companion_models_public_read on storage.objects;
