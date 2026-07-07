# Snapshot du schéma — tables & policies RLS

Généré le 2026-07-14 (voir issue GitHub #4, finding H2 : "portée de l'audit limitée par un schéma non versionné"). Photo en lecture seule du schéma `public` tel qu'il existe réellement en production — **pas une migration**, ne rien réappliquer depuis ce fichier. À régénérer périodiquement (ou après tout changement de schéma fait à la main via le dashboard) pour rester utile.

Les définitions complètes des fonctions (RPC, triggers) sont dans `schema_snapshot_functions.sql` à côté de ce fichier.

## Tables (RLS activé sur toutes, 23 tables)

| Table | Lignes (au 2026-07-14) | Clé primaire |
|---|---|---|
| `game_saves` | 23 | `user_id` |
| `market_listings` | 33 | `id` |
| `farm_events` | 655 086 | `id` |
| `player_stats` | 12 | `user_id` |
| `presence` | 25 | `user_id` |
| `profiles` | 10 | `user_id` |
| `market_prices` | 6 | `item_key` |
| `link_codes` | 1 | `code` |
| `discord_links` | 0 | `discord_id` |
| `bot_state` | 1 | `key` |
| `playtime_pings` | 9 296 | `id` |
| `chat_messages` | 53 | `id` |
| `chat_mods` | 1 | `user_id` |
| `live_boss` | 1 | `id` |
| `chat_deleted` | 2 | `id` |
| `testers` | 0 | `user_id` |
| `boss_contributions` | 49 | `(boss_key, user_id)` |
| `boss_claims` | 20 | `(boss_key, user_id)` |
| `sell_log` | 0 | `id` |
| `player_notices` | 0 | `(user_id, notice_key)` |
| `market_orders` | 5 | `id` |
| `market_trades` | 2 | `id` |
| `silver_ledger` | 173 088 | `id` |

## Policies RLS par table

### `boss_contributions`
- `boss_contrib_select_all` (SELECT, public) : `auth.uid() is not null`

### `chat_deleted`
- `chat_deleted_select_staff` (SELECT, public) : admin email OU membre de `chat_mods`

### `chat_messages`
- `chat_messages_select_all` (SELECT, public) : `auth.uid() is not null`
- Écriture uniquement via RPC `post_chat_message()` (SECURITY DEFINER, voir snapshot fonctions)

### `chat_mods`
- `chat_mods_select_all` (SELECT, public) : `auth.uid() is not null`

### `discord_links`
- `discord_links_select_own` (SELECT, public) : `auth.uid() = user_id`

### `farm_events`
- `Admin uniquement lit le journal de farm` (SELECT, public) : admin email uniquement
- `Le joueur journalise ses propres événements` (INSERT, public) : `user_id = auth.uid()`

### `game_saves` ⚠️ voir finding C1 (issue #4)
- `Lecture de sa propre sauvegarde ou admin` (SELECT, public) : propriétaire OU admin email
- `Création de sa propre sauvegarde` (INSERT, public) : `auth.uid() = user_id`
- `Mise à jour de sa propre sauvegarde` (UPDATE, public) : `auth.uid() = user_id` — **ne valide QUE la propriété, jamais le contenu de `save_data`**. Depuis le 2026-07-14, un trigger `clamp_game_save` (voir snapshot fonctions) borne les valeurs manifestement impossibles au niveau base de données, en complément de cette policy.

### `live_boss`
- `live_boss_select_all` (SELECT, public) : `auth.uid() is not null`
- Écriture uniquement via RPC (`boss_contribute`, `ensure_scheduled_boss`, `admin_spawn_boss`, `admin_despawn_boss`)

### `market_listings`
- `Voir les annonces actives ou les siennes` (SELECT, public) : actives, ou vendeur/acheteur soi-même
- (table legacy — le marché actuel utilise `market_orders`/`market_trades`, voir migration `20260710120000_silver_ledger.sql`)

### `market_prices`
- `market_prices_select_all` (SELECT, public) : `true` (public, données non sensibles)

### `market_trades`
- `market_trades_select_all` (SELECT, public) : `auth.role() = 'authenticated'`

### `player_stats`
- `player_stats_select_all` (SELECT, public) : `auth.role() = 'authenticated'`
- `player_stats_insert_own` / `player_stats_update_own` : propriétaire ET compte non-anonyme — protégé en complément par le trigger `clamp_player_stats` (bornage + alerte Discord)

### `playtime_pings`
- `Admin uniquement lit les pings de temps de jeu` (SELECT, public) : admin email uniquement

### `presence`
- `presence_update_own` / `presence_upsert_own` : `auth.uid() = user_id`

### `profiles`
- `profiles_select_own` (SELECT, public) : `auth.uid() = user_id`

### `sell_log`
- `sell_log_select_own` (SELECT, public) : `auth.uid() = user_id`

### `silver_ledger` ⚠️ voir finding M2 (issue #4)
- `Admin uniquement lit le registre de silver` (SELECT, public) : admin email uniquement
- `Le joueur journalise ses propres mouvements de silver` (INSERT, authenticated) : `user_id = auth.uid()` — depuis le 2026-07-14, complété par les contraintes CHECK `silver_ledger_category_check` (whitelist) et `silver_ledger_delta_check` (borne de montant)

### `testers`
- `testers_select_all` (SELECT, public) : `auth.uid() is not null`

## Tables sans policy listée ci-dessus
`market_orders`, `bot_state`, `link_codes`, `player_notices`, `boss_claims` : accès exclusivement via RPC `SECURITY DEFINER` (pas de policy directe nécessaire, RLS activé bloque tout accès direct par défaut).
