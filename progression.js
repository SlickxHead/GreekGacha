/** Max hero level (inclusive). */
export const MAX_HERO_LEVEL = 50;

/** Gold cost to buy Cupid in the shop (one-time roster add). */
export const CUPID_SHOP_COST = 1000;

/** Gold cost for one summon scroll in the shop. */
export const SCROLL_SHOP_COST = 500;

/** Gold cost for one Legend scroll (guaranteed Epic or Legendary pull) in the shop. */
export const LEGEND_SCROLL_SHOP_COST = 10000;

/** Gold cost for one XP scroll (consumable +100 XP on one party hero). */
export const XP_SCROLL_SHOP_COST = 200;

/**
 * XP required to advance from `level` to level+1 (level must be < MAX_HERO_LEVEL).
 */
export function xpRequiredForLevelUp(level) {
  if (level >= MAX_HERO_LEVEL) return 0;
  return 45 + level * 20;
}

/**
 * Scales base combat stats from heroToGameUnit by level (1 = no bonus).
 * @param {object} unit
 * @param {number} level
 */
export function applyLevelScaling(unit, level) {
  const L = Math.min(MAX_HERO_LEVEL, Math.max(1, Math.floor(level || 1)));
  if (L <= 1) return { ...unit };
  const t = (L - 1) / (MAX_HERO_LEVEL - 1);
  const hpM = 1 + t * 0.38;
  const atkM = 1 + t * 0.28;
  const defM = 1 + t * 0.22;
  const spdM = 1 + t * 0.18;
  const nu = { ...unit };
  nu.maxHp = Math.max(1, Math.round(nu.maxHp * hpM));
  nu.hp = nu.maxHp;
  nu.attack = Math.round(nu.attack * atkM * 100) / 100;
  nu.defense = Math.round(nu.defense * defM * 100) / 100;
  nu.speed = Math.round(nu.speed * spdM * 100) / 100;
  return nu;
}
