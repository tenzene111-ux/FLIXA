export type GiftTier = 1 | 2 | 3 | 4 | 5;

export type GiftDefinition = {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  tier: GiftTier;
  durationSec: number;
  colors: readonly [string, string, ...string[]];
};

// Coin costs here are the single source of truth on the client for
// *display* only — the Cloud Function (functions/src/index.ts) keeps its
// own copy and is what actually enforces the charge, exactly like
// REWARD_CATALOG/SPEND_CATALOG already do for other wallet actions.
export const GIFT_CATALOG: GiftDefinition[] = [
  // Tier 1 — Everyday
  { id: 'blue_poppy', name: 'Blue Poppy', emoji: '🌸', cost: 5, tier: 1, durationSec: 3, colors: ['#4FD8FF', '#7A3CFF'] },
  { id: 'butter_lamp', name: 'Butter Lamp', emoji: '🪔', cost: 10, tier: 1, durationSec: 4, colors: ['#FFD36E', '#FF9A3C'] },
  { id: 'prayer_flag', name: 'Prayer Flag', emoji: '🎏', cost: 20, tier: 1, durationSec: 4, colors: ['#FF0A6C', '#18D7E8'] },
  { id: 'prayer_wheel', name: 'Prayer Wheel', emoji: '☸️', cost: 30, tier: 1, durationSec: 5, colors: ['#FFD36E', '#D81BFF'] },
  { id: 'white_scarf', name: 'White Scarf', emoji: '🧣', cost: 50, tier: 1, durationSec: 5, colors: ['#F7F7FA', '#B7C6E6'] },
  { id: 'happiness_bell', name: 'Happiness Bell', emoji: '🔔', cost: 75, tier: 1, durationSec: 5, colors: ['#FFD36E', '#FFB020'] },
  { id: 'lucky_knot', name: 'Lucky Knot', emoji: '♾️', cost: 100, tier: 1, durationSec: 6, colors: ['#FFD36E', '#FF0A6C'] },

  // Tier 2 — Popular
  { id: 'bamboo_arrow', name: 'Bamboo Arrow', emoji: '🏹', cost: 150, tier: 2, durationSec: 4, colors: ['#FFD36E', '#7A3CFF'] },
  { id: 'golden_bow', name: 'Golden Bow', emoji: '🏹', cost: 250, tier: 2, durationSec: 6, colors: ['#FFD36E', '#FF0A6C'] },
  { id: 'yak_caravan', name: 'Yak Caravan', emoji: '🐂', cost: 300, tier: 2, durationSec: 7, colors: ['#B7C6E6', '#7A3CFF'] },
  { id: 'takin_spirit', name: 'Takin Spirit', emoji: '🐂', cost: 500, tier: 2, durationSec: 8, colors: ['#FFD36E', '#18D7E8'] },
  { id: 'raven_guardian', name: 'Raven Guardian', emoji: '🦅', cost: 800, tier: 2, durationSec: 8, colors: ['#2A2946', '#FFD36E'] },

  // Tier 3 — Heritage
  { id: 'mini_dzong', name: 'Mini Dzong', emoji: '🏯', cost: 1000, tier: 3, durationSec: 8, colors: ['#FFD36E', '#D81BFF'] },
  { id: 'dochula_blessing', name: 'Dochula Blessing', emoji: '🕍', cost: 1500, tier: 3, durationSec: 10, colors: ['#FFD36E', '#18D7E8'] },
  { id: 'festival_mask_dance', name: 'Festival Mask Dance', emoji: '🎭', cost: 2000, tier: 3, durationSec: 10, colors: ['#FF0A6C', '#FFD36E'] },
  { id: 'punakha_fortress', name: 'Punakha Fortress', emoji: '🏰', cost: 3000, tier: 3, durationSec: 12, colors: ['#FF8FB3', '#FFD36E'] },
  { id: 'tigers_nest', name: "Tiger's Nest", emoji: '🏔️', cost: 5000, tier: 3, durationSec: 12, colors: ['#FFD36E', '#18D7E8'] },

  // Tier 4 — Royal
  { id: 'royal_throne', name: 'Royal Throne', emoji: '👑', cost: 8000, tier: 4, durationSec: 12, colors: ['#FFD36E', '#D81BFF'] },
  { id: 'golden_dragon', name: 'Golden Dragon', emoji: '🐉', cost: 12000, tier: 4, durationSec: 15, colors: ['#FFD36E', '#FF0A6C'] },
  { id: 'himalayan_palace', name: 'Himalayan Palace', emoji: '🏯', cost: 20000, tier: 4, durationSec: 16, colors: ['#18D7E8', '#FFD36E'] },
  { id: 'kingdom_crown', name: 'Kingdom Crown', emoji: '👑', cost: 35000, tier: 4, durationSec: 16, colors: ['#FFD36E', '#F7F7FA'] },
  { id: 'dragon_emperor', name: 'Dragon Emperor', emoji: '🐉', cost: 50000, tier: 4, durationSec: 18, colors: ['#FF0A6C', '#FFD36E'] },

  // Tier 5 — Mythical
  { id: 'druk_kingdom', name: 'Druk Kingdom', emoji: '🏔️', cost: 100000, tier: 5, durationSec: 20, colors: ['#FFD36E', '#D81BFF', '#18D7E8'] },
  { id: 'golden_himalaya', name: 'Golden Himalaya', emoji: '🏔️', cost: 250000, tier: 5, durationSec: 22, colors: ['#FFD36E', '#FF8FB3'] },
  { id: 'sky_dragon', name: 'Sky Dragon', emoji: '🐉', cost: 500000, tier: 5, durationSec: 25, colors: ['#7A3CFF', '#18D7E8', '#FFD36E'] },
  { id: 'eternal_bhutan', name: 'Eternal Bhutan', emoji: '✨', cost: 750000, tier: 5, durationSec: 28, colors: ['#FF0A6C', '#FFD36E', '#18D7E8'] },
  { id: 'druk_universe', name: 'Druk Universe', emoji: '🌌', cost: 1000000, tier: 5, durationSec: 30, colors: ['#7A3CFF', '#D81BFF', '#FFD36E', '#18D7E8'] },
];

export const GIFT_BY_ID: Record<string, GiftDefinition> = Object.fromEntries(GIFT_CATALOG.map((g) => [g.id, g]));

export const GIFT_TIERS: { tier: GiftTier; label: string }[] = [
  { tier: 1, label: 'Everyday' },
  { tier: 2, label: 'Popular' },
  { tier: 3, label: 'Heritage' },
  { tier: 4, label: 'Royal' },
  { tier: 5, label: 'Mythical' },
];
