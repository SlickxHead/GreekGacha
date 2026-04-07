import { STARTER_IDS } from "./starters.js";
import { MAX_HERO_LEVEL, xpRequiredForLevelUp } from "./progression.js";

const LS_COLLECTION = "greekGacha_collection";
const LS_CAMPAIGN_MAX = "greekGacha_campaignMaxBeat";
const LS_BATTLE_PARTY = "greekGacha_battleParty";
const LS_NEW_HERO_MARKERS = "greekGacha_newHeroMarkers";
const LS_GOLD = "greekGacha_gold";
const LS_HERO_PROGRESS = "greekGacha_heroProgress";
const LS_SUMMON_SCROLLS = "greekGacha_summonScrolls";
const LS_LEGEND_SCROLLS = "greekGacha_legendScrolls";
const LS_XP_SCROLLS = "greekGacha_xpScrolls";
const LS_CAMPAIGN_WINS = "greekGacha_campaignWins";
const LS_QUESTS = "greekGacha_quests";
const LS_DAILY_PRAY = "greekGacha_dailyPray";

/** Max heroes that can enter a campaign battle together. */
export const MAX_PARTY_SIZE = 4;

function defaultCollection() {
  return [...STARTER_IDS];
}

export function getCollection() {
  try {
    const raw = localStorage.getItem(LS_COLLECTION);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch {
    /* ignore */
  }
  return defaultCollection();
}

export function saveCollection(ids) {
  try {
    localStorage.setItem(LS_COLLECTION, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

/** @returns {boolean} true if this id was newly added */
export function addHeroToCollection(id) {
  const c = getCollection();
  if (!c.includes(id)) {
    c.push(id);
    saveCollection(c);
    return true;
  }
  return false;
}

function loadNewHeroMarkers() {
  try {
    const raw = localStorage.getItem(LS_NEW_HERO_MARKERS);
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveNewHeroMarkers(ids) {
  try {
    localStorage.setItem(LS_NEW_HERO_MARKERS, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function getNewHeroIds() {
  return loadNewHeroMarkers();
}

export function markHeroAsNew(id) {
  const ids = loadNewHeroMarkers();
  if (!ids.includes(id)) {
    ids.push(id);
    saveNewHeroMarkers(ids);
  }
}

export function clearNewHeroMarker(id) {
  const ids = loadNewHeroMarkers().filter((x) => x !== id);
  saveNewHeroMarkers(ids);
}

/** Clears all saved progress (collection, campaign, party, NEW markers). Next load uses starters only. */
export function resetPersistedProgress() {
  try {
    localStorage.removeItem(LS_COLLECTION);
    localStorage.removeItem(LS_CAMPAIGN_MAX);
    localStorage.removeItem(LS_BATTLE_PARTY);
    localStorage.removeItem(LS_NEW_HERO_MARKERS);
    localStorage.removeItem(LS_GOLD);
    localStorage.removeItem(LS_HERO_PROGRESS);
    localStorage.removeItem(LS_SUMMON_SCROLLS);
    localStorage.removeItem(LS_LEGEND_SCROLLS);
    localStorage.removeItem(LS_XP_SCROLLS);
    localStorage.removeItem(LS_CAMPAIGN_WINS);
    localStorage.removeItem(LS_QUESTS);
    localStorage.removeItem(LS_DAILY_PRAY);
  } catch {
    /* ignore */
  }
}

function loadDailyPrayState() {
  try {
    const raw = localStorage.getItem(LS_DAILY_PRAY);
    if (!raw) return { lastClaimAt: 0 };
    const parsed = JSON.parse(raw);
    const lastClaimAt = Number(parsed?.lastClaimAt || 0);
    return { lastClaimAt: Number.isFinite(lastClaimAt) && lastClaimAt > 0 ? lastClaimAt : 0 };
  } catch {
    return { lastClaimAt: 0 };
  }
}

function saveDailyPrayState(state) {
  try {
    localStorage.setItem(LS_DAILY_PRAY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function getDailyPrayLastClaimAt() {
  return loadDailyPrayState().lastClaimAt;
}

export function setDailyPrayLastClaimAt(ts) {
  const n = Number(ts || 0);
  saveDailyPrayState({
    lastClaimAt: Number.isFinite(n) && n > 0 ? Math.floor(n) : 0,
  });
}

function loadQuestMap() {
  try {
    const raw = localStorage.getItem(LS_QUESTS);
    if (!raw) return {};
    const map = JSON.parse(raw);
    return map && typeof map === "object" ? map : {};
  } catch {
    return {};
  }
}

function saveQuestMap(map) {
  try {
    localStorage.setItem(LS_QUESTS, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getQuestState(questId) {
  const map = loadQuestMap();
  const q = map[questId];
  return {
    completed: Boolean(q?.completed),
    claimed: Boolean(q?.claimed),
  };
}

export function setQuestCompleted(questId) {
  if (!questId) return;
  const map = loadQuestMap();
  const q = map[questId] && typeof map[questId] === "object" ? map[questId] : {};
  if (q.completed) return;
  map[questId] = { ...q, completed: true };
  saveQuestMap(map);
}

/** @returns {boolean} true only when claim succeeds first time */
export function tryClaimQuest(questId) {
  if (!questId) return false;
  const map = loadQuestMap();
  const q = map[questId] && typeof map[questId] === "object" ? map[questId] : {};
  if (!q.completed || q.claimed) return false;
  map[questId] = { ...q, claimed: true };
  saveQuestMap(map);
  return true;
}

function loadGold() {
  try {
    const raw = localStorage.getItem(LS_GOLD);
    if (raw == null) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function saveGold(n) {
  try {
    localStorage.setItem(LS_GOLD, String(Math.max(0, Math.floor(n))));
  } catch {
    /* ignore */
  }
}

function loadSummonScrolls() {
  try {
    const raw = localStorage.getItem(LS_SUMMON_SCROLLS);
    if (raw == null) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function saveSummonScrolls(n) {
  try {
    localStorage.setItem(LS_SUMMON_SCROLLS, String(Math.max(0, Math.floor(n))));
  } catch {
    /* ignore */
  }
}

export function getSummonScrolls() {
  return loadSummonScrolls();
}

export function addSummonScrolls(amount) {
  if (amount <= 0) return getSummonScrolls();
  const next = loadSummonScrolls() + Math.floor(amount);
  saveSummonScrolls(next);
  return next;
}

/** @returns {boolean} true if a scroll was consumed */
export function tryConsumeSummonScroll() {
  const n = loadSummonScrolls();
  if (n < 1) return false;
  saveSummonScrolls(n - 1);
  return true;
}

function loadLegendScrolls() {
  try {
    const raw = localStorage.getItem(LS_LEGEND_SCROLLS);
    if (raw == null) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function saveLegendScrolls(n) {
  try {
    localStorage.setItem(LS_LEGEND_SCROLLS, String(Math.max(0, Math.floor(n))));
  } catch {
    /* ignore */
  }
}

export function getLegendScrolls() {
  return loadLegendScrolls();
}

export function addLegendScrolls(amount) {
  if (amount <= 0) return getLegendScrolls();
  const next = loadLegendScrolls() + Math.floor(amount);
  saveLegendScrolls(next);
  return next;
}

/** @returns {boolean} true if a legend scroll was consumed */
export function tryConsumeLegendScroll() {
  const n = loadLegendScrolls();
  if (n < 1) return false;
  saveLegendScrolls(n - 1);
  return true;
}

function loadXpScrolls() {
  try {
    const raw = localStorage.getItem(LS_XP_SCROLLS);
    if (raw == null) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function saveXpScrolls(n) {
  try {
    localStorage.setItem(LS_XP_SCROLLS, String(Math.max(0, Math.floor(n))));
  } catch {
    /* ignore */
  }
}

export function getXpScrolls() {
  return loadXpScrolls();
}

export function addXpScrolls(amount) {
  if (amount <= 0) return getXpScrolls();
  const next = loadXpScrolls() + Math.floor(amount);
  saveXpScrolls(next);
  return next;
}

/** @returns {boolean} true if an XP scroll was consumed */
export function tryConsumeXpScroll() {
  const n = loadXpScrolls();
  if (n < 1) return false;
  saveXpScrolls(n - 1);
  return true;
}

export function getCampaignWinCount() {
  try {
    const raw = localStorage.getItem(LS_CAMPAIGN_WINS);
    if (raw == null) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function incrementCampaignWinCount() {
  const next = getCampaignWinCount() + 1;
  try {
    localStorage.setItem(LS_CAMPAIGN_WINS, String(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function getGold() {
  return loadGold();
}

export function addGold(amount) {
  if (amount <= 0) return getGold();
  return saveGoldReturn(loadGold() + Math.floor(amount));
}

function saveGoldReturn(total) {
  saveGold(total);
  return total;
}

/** @returns {boolean} true if purchase succeeded */
export function trySpendGold(amount) {
  if (amount <= 0) return true;
  const g = loadGold();
  if (g < amount) return false;
  saveGold(g - amount);
  return true;
}

function loadHeroProgressMap() {
  try {
    const raw = localStorage.getItem(LS_HERO_PROGRESS);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

function saveHeroProgressMap(map) {
  try {
    localStorage.setItem(LS_HERO_PROGRESS, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** @returns {{ level: number, xp: number }} */
export function getHeroProgress(heroId) {
  const map = loadHeroProgressMap();
  const p = map[heroId];
  if (!p || typeof p !== "object") return { level: 1, xp: 0 };
  let level = Number(p.level);
  let xp = Number(p.xp);
  if (!Number.isFinite(level) || level < 1) level = 1;
  if (level > MAX_HERO_LEVEL) level = MAX_HERO_LEVEL;
  if (!Number.isFinite(xp) || xp < 0) xp = 0;
  return { level, xp };
}

export function addHeroXp(heroId, amount) {
  if (!heroId || amount <= 0) return;
  const map = loadHeroProgressMap();
  let { level, xp } = getHeroProgress(heroId);
  if (level >= MAX_HERO_LEVEL) return;
  xp += Math.floor(amount);
  while (level < MAX_HERO_LEVEL) {
    const need = xpRequiredForLevelUp(level);
    if (xp < need) break;
    xp -= need;
    level += 1;
  }
  if (level >= MAX_HERO_LEVEL) {
    level = MAX_HERO_LEVEL;
    xp = 0;
  }
  map[heroId] = { level, xp };
  saveHeroProgressMap(map);
}

/** Highest stage number beaten (0 = none). */
export function getCampaignMaxBeat() {
  try {
    const n = parseInt(localStorage.getItem(LS_CAMPAIGN_MAX) || "0", 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function setCampaignMaxBeat(stageNumber) {
  const prev = getCampaignMaxBeat();
  if (stageNumber > prev) {
    try {
      localStorage.setItem(LS_CAMPAIGN_MAX, String(stageNumber));
    } catch {
      /* ignore */
    }
  }
}

/** Stage `n` (1–5) is unlocked if n <= maxBeat + 1 */
export function isStageUnlocked(stageNumber) {
  return stageNumber <= getCampaignMaxBeat() + 1;
}

/**
 * Battle party: up to MAX_PARTY_SIZE hero ids, subset of collection.
 * Persisted; defaults to first N owned heroes.
 */
export function getBattleParty() {
  const coll = getCollection();
  try {
    const raw = localStorage.getItem(LS_BATTLE_PARTY);
    if (raw == null) {
      const initial = coll.slice(0, Math.min(MAX_PARTY_SIZE, coll.length));
      localStorage.setItem(LS_BATTLE_PARTY, JSON.stringify(initial));
      return initial;
    }
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) throw new Error("invalid");
    let party = arr.filter((id) => coll.includes(id)).slice(0, MAX_PARTY_SIZE);
    if (party.length === 0 && coll.length > 0) {
      party = coll.slice(0, Math.min(MAX_PARTY_SIZE, coll.length));
      localStorage.setItem(LS_BATTLE_PARTY, JSON.stringify(party));
    }
    return party;
  } catch {
    const initial = coll.slice(0, Math.min(MAX_PARTY_SIZE, coll.length));
    try {
      localStorage.setItem(LS_BATTLE_PARTY, JSON.stringify(initial));
    } catch {
      /* ignore */
    }
    return initial;
  }
}

export function setBattleParty(ids) {
  const coll = getCollection();
  const next = [...new Set(ids)]
    .filter((id) => coll.includes(id))
    .slice(0, MAX_PARTY_SIZE);
  try {
    localStorage.setItem(LS_BATTLE_PARTY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

/** Apply party change from character box; enforces 1–4 members when possible. */
export function trySetBattlePartyFromToggle(heroId, checked) {
  const coll = getCollection();
  if (!coll.includes(heroId)) return { ok: false, party: getBattleParty() };

  let party = [...getBattleParty()];
  if (checked) {
    if (party.includes(heroId)) return { ok: true, party };
    if (party.length >= MAX_PARTY_SIZE) {
      return { ok: false, reason: "full", party };
    }
    party.push(heroId);
  } else {
    if (!party.includes(heroId)) return { ok: true, party };
    if (party.length <= 1) {
      return { ok: false, reason: "last", party };
    }
    party = party.filter((id) => id !== heroId);
  }
  setBattleParty(party);
  return { ok: true, party };
}
