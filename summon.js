import { HERO_DATA, CUPID_HERO_ID } from "./heroes.js";
import { addHeroToCollection } from "./playerState.js";

export const PITY_THRESHOLD = 50;

const LS_TOTAL_PULLS = "greekGacha_totalPulls";
const LS_PULLS_SINCE_LEGENDARY = "greekGacha_pullsSinceLegendary";

function loadNumber(key, fallback = 0) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function saveNumber(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore quota / private mode */
  }
}

function byRarity(rarity) {
  return HERO_DATA.filter(
    (h) => h.rarity === rarity && h.id !== CUPID_HERO_ID
  );
}

function randomFrom(array) {
  if (!array.length) return null;
  const i = Math.floor(Math.random() * array.length);
  return array[i];
}

/** Roll Legendary / Epic / Rare with fixed weights (no pity). */
function rollRarityWeighted() {
  const r = Math.random();
  if (r < 0.02) return "Legendary";
  if (r < 0.17) return "Epic";
  return "Rare";
}

/**
 * Deep-clone a hero for a new pull: full HP, skills reset to currentCooldown 0.
 */
function cloneFreshHero(hero) {
  if (!hero) return null;
  return {
    id: hero.id,
    name: hero.name,
    rarity: hero.rarity,
    description: hero.description,
    hp: hero.maxHp,
    maxHp: hero.maxHp,
    atk: hero.atk,
    def: hero.def,
    spd: hero.spd,
    skills: hero.skills.map((s) => ({
      id: s.id,
      name: s.name,
      damageMultiplier: s.damageMultiplier,
      cooldown: s.cooldown,
      currentCooldown: 0,
    })),
  };
}

/**
 * Weighted summon: 2% Legendary, 15% Epic, 83% Rare.
 * Pity: after 50 pulls without a Legendary, the next pull is guaranteed Legendary.
 * Persists total pulls and pity counter in localStorage.
 * @returns {ReturnType<typeof cloneFreshHero>}
 */
export function summonHero() {
  let totalPulls = loadNumber(LS_TOTAL_PULLS, 0);
  let pullsSinceLegendary = loadNumber(LS_PULLS_SINCE_LEGENDARY, 0);

  const pityActive = pullsSinceLegendary >= PITY_THRESHOLD;
  if (pityActive) {
    console.log(
      `[Summon] Pity triggered — guaranteed Legendary after ${pullsSinceLegendary} pulls without one (threshold ${PITY_THRESHOLD})`
    );
  }

  let rarity;
  if (pityActive) {
    rarity = "Legendary";
  } else {
    rarity = rollRarityWeighted();
  }

  const pool = byRarity(rarity);
  const picked = randomFrom(pool);
  const fresh = cloneFreshHero(picked);

  totalPulls += 1;
  if (fresh?.rarity === "Legendary") {
    pullsSinceLegendary = 0;
  } else {
    pullsSinceLegendary += 1;
  }

  saveNumber(LS_TOTAL_PULLS, totalPulls);
  saveNumber(LS_PULLS_SINCE_LEGENDARY, pullsSinceLegendary);

  let isNew = false;
  if (fresh?.id) {
    isNew = addHeroToCollection(fresh.id);
  }

  return fresh ? { ...fresh, isNew } : fresh;
}

/** ~3% Legendary, ~97% Epic. Does not change normal-scroll pity counters. */
const LEGEND_SCROLL_LEGEND_WEIGHT = 0.03;

/**
 * Legend scroll pull: always Epic or Legendary (Legendary chance is low).
 * @returns {ReturnType<typeof cloneFreshHero> & { isNew?: boolean } | null}
 */
export function summonHeroFromLegendScroll() {
  const rarity =
    Math.random() < LEGEND_SCROLL_LEGEND_WEIGHT ? "Legendary" : "Epic";
  const pool = byRarity(rarity);
  const picked = randomFrom(pool);
  const fresh = cloneFreshHero(picked);

  let isNew = false;
  if (fresh?.id) {
    isNew = addHeroToCollection(fresh.id);
  }

  return fresh ? { ...fresh, isNew } : fresh;
}

export function getSummonStats() {
  return {
    totalPulls: loadNumber(LS_TOTAL_PULLS, 0),
    pullsSinceLegendary: loadNumber(LS_PULLS_SINCE_LEGENDARY, 0),
    pityThreshold: PITY_THRESHOLD,
    pityAvailable: loadNumber(LS_PULLS_SINCE_LEGENDARY, 0) >= PITY_THRESHOLD,
  };
}

/** Clears summon counters (total pulls, pity). */
export function resetSummonPersistence() {
  try {
    localStorage.removeItem(LS_TOTAL_PULLS);
    localStorage.removeItem(LS_PULLS_SINCE_LEGENDARY);
  } catch {
    /* ignore */
  }
}
