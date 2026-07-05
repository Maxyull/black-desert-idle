-- ============================================================
-- CORRECTIF CRITIQUE : après chaque mise à jour récente qui a ajouté un paramètre à une RPC
-- existante (heartbeat_presence +p_zone_idx, post_chat_message +p_pseudo), l'ANCIENNE signature
-- est restée en base EN PLUS de la nouvelle (CREATE OR REPLACE ne remplace que si la liste de
-- types d'arguments est identique — ajouter un paramètre crée une surcharge séparée au lieu de
-- remplacer). Résultat : tout client qui appelle la RPC avec SEULEMENT les anciens arguments
-- correspond aux DEUX signatures à la fois (la nouvelle via sa valeur par défaut) → Postgres
-- renvoie une erreur "function is not unique" → l'appel échoue silencieusement.
--
-- Remonté en jeu le 2026-07-06 : "je vois que plus personne est en ligne après une mise à jour"
-- -- tout onglet resté ouvert depuis avant la dernière MAJ (donc encore sur l'ancien JS mis en
-- cache) voyait son heartbeat échouer en boucle, disparaissant du compteur "en ligne" après la
-- fenêtre de 90s, et ne pouvait plus non plus poster de message de chat.
--
-- Fix : supprime les anciennes surcharges, ne laisse que la version la plus récente (avec valeur
-- par défaut) -- un appel avec seulement les anciens arguments redevient sans ambiguïté.
-- RÈGLE À SUIVRE DÉSORMAIS : quand une RPC existante gagne un nouveau paramètre, toujours DROP
-- l'ancienne signature dans la même migration, jamais la laisser coexister.
--
-- Supabase > SQL Editor > New query > Run (déjà appliqué en prod le 2026-07-06)
-- ============================================================

drop function if exists public.heartbeat_presence(boolean);
drop function if exists public.post_chat_message(text, text);
