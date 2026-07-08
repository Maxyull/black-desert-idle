// ==================== POTIONS DE VIE ====================
// Extrait de game-core.js le 2026-07-08 (reorganisation par dossiers) -- pure donnee, aucune
// dependance, charge AVANT core/game-core.js.
const POTIONS = {
  small:    { name:{fr:'Petite potion de vie',  en:'Small HP Potion'},  icon:'🧪', cost:70,  heal:0.20, cd:2.4 },
  medium:   { name:{fr:'Potion de vie',         en:'HP Potion'},        icon:'🧴', cost:140, heal:0.35, cd:3.6 },
  large:    { name:{fr:'Grande potion de vie',  en:'Large HP Potion'},  icon:'⚗️', cost:240, heal:0.55, cd:5.0 },
  mega:     { name:{fr:'Potion de vie majeure', en:'Major HP Potion'},  icon:'🍾', cost:380, heal:0.80, cd:6.8 },
  infinite: { name:{fr:'Potion de vie infinie', en:'Infinite HP Potion'}, icon:'♾️', cost:0, heal:0.40, cd:4.2, locked:true },
};
const POTION_ORDER = ['small','medium','large','mega','infinite']; // "infinite" toujours en dernier, verrouillée (voir p.locked)
