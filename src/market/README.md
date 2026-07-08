# market/

Le Marché commun : vrai carnet d'ordres entre joueurs (achat/vente), matériaux avec
chandelier/historique de prix, mes ordres en cours.

- `market.js` — toute la logique et l'UI du marché. Communique avec Supabase via les RPC
  `market_place_order`/`market_cancel_order`/`market_order_book`/`market_my_orders`
  (voir `supabase/migrations/`).
