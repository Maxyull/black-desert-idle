# social/

Interactions entre joueurs en dehors du marché.

- `chat.js` — chat mondial/trade/annonce, mentions `@joueur`, historique par canal. Charge
  après `backend/game-supabase.js` (appelle `fetchChatMessages`/`pollChatUnread` immédiatement
  au chargement, qui ont besoin de `sb`/`currentUser` déjà définis).
