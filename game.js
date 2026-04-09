import {
  pickTarget,
  tickSkillCooldowns,
  teamWiped,
  prepareTeams,
  isAlive,
} from "./combat.js";
import { GAME_META } from "./placeholders.js";
import { heroToGameUnit, HERO_DATA, CUPID_HERO_ID } from "./heroes.js";
import { CAMPAIGN_LEVELS } from "./campaignData.js";
import { getHeroDefById } from "./heroLookup.js";
import {
  getCollection,
  setCampaignMaxBeat,
  isStageUnlocked,
  getBattleParty,
  trySetBattlePartyFromToggle,
  MAX_PARTY_SIZE,
  markHeroAsNew,
  getNewHeroIds,
  clearNewHeroMarker,
  resetPersistedProgress,
  getGold,
  trySpendGold,
  addGold,
  addHeroToCollection,
  getHeroProgress,
  addHeroXp,
  getSummonScrolls,
  tryConsumeSummonScroll,
  addSummonScrolls,
  getLegendScrolls,
  tryConsumeLegendScroll,
  addLegendScrolls,
  getXpScrolls,
  addXpScrolls,
  tryConsumeXpScroll,
  getCampaignWinCount,
  incrementCampaignWinCount,
  getQuestState,
  setQuestCompleted,
  tryClaimQuest,
  getDailyPrayLastClaimAt,
  setDailyPrayLastClaimAt,
} from "./playerState.js";
import {
  applyLevelScaling,
  CUPID_SHOP_COST,
  SCROLL_SHOP_COST,
  LEGEND_SCROLL_SHOP_COST,
  XP_SCROLL_SHOP_COST,
  xpRequiredForLevelUp,
  MAX_HERO_LEVEL,
} from "./progression.js";
import { summonHero, summonHeroFromLegendScroll, resetSummonPersistence } from "./summon.js";
import { getPortraitUrl } from "./portraits.js";

if (typeof globalThis !== "undefined") {
  globalThis.summonHero = summonHero;
}

function computeStepDamage(attacker, defender, multiplier = 1) {
  const mult = multiplier ?? 1;
  const raw = attacker.attack * mult - defender.defense;
  return Math.max(0, statWhole(raw));
}

function useSkillOnUnit(skill) {
  skill.cooldownRemaining = skill.cooldown;
}

function effectiveUnitSpeed(unit) {
  const base = Number(unit?.speed ?? 0);
  const mult = Number(unit?.speedBuffMultiplierActive ?? 1);
  return base * (mult > 0 ? mult : 1);
}

function isUnitStunned(unit) {
  return (unit?.stunRounds ?? 0) > 0;
}

function tickStunRound(unit) {
  if (!unit) return false;
  if ((unit.stunRounds ?? 0) <= 0) return false;
  unit.stunRounds = Math.max(0, unit.stunRounds - 1);
  return true;
}

function maybeApplyStun(attacker, useSkill, target, damageDone) {
  if (!target || damageDone <= 0) return false;
  const activeChance = useSkill ? Number(useSkill.stunChance ?? 0) : 0;
  const passiveChance = passiveStunChanceForUnit(attacker);
  const chance = Math.max(activeChance, passiveChance);
  if (!(chance > 0)) return false;
  if (Math.random() >= chance) return false;
  const rounds = Math.max(
    1,
    Math.floor(Number(useSkill?.stunDurationRounds ?? 1))
  );
  target.stunRounds = Math.max(target.stunRounds ?? 0, rounds);
  return true;
}

function passiveStunChanceForUnit(unit) {
  if (!unit?.skills?.length) return 0;
  let best = 0;
  for (const s of unit.skills) {
    if (!s?.passive) continue;
    const c = Number(s.passiveStunChance ?? 0);
    if (c > best) best = c;
  }
  return best;
}

function maybeApplySpeedBuff(attacker, useSkill) {
  if (!attacker || !useSkill) return false;
  const mult = Number(useSkill.speedBuffMultiplier ?? 0);
  if (!(mult > 1)) return false;
  const rounds = Math.max(
    1,
    Math.floor(Number(useSkill.speedBuffDurationRounds ?? 1))
  );
  attacker.speedBuffMultiplierActive = mult;
  attacker.speedBuffRounds = rounds;
  return true;
}

function tickSpeedBuffRound(unit) {
  if (!unit) return false;
  if ((unit.speedBuffRounds ?? 0) <= 0) return false;
  unit.speedBuffRounds = Math.max(0, unit.speedBuffRounds - 1);
  if (unit.speedBuffRounds <= 0) {
    unit.speedBuffMultiplierActive = 1;
  }
  return true;
}

function previewResolveStepAttack(attacker, skill, target) {
  if (!skill) {
    const damage = computeStepDamage(attacker, target, 1);
    return { damage, skillId: null, skillName: null };
  }
  if (skill.skipAttack) {
    return { damage: 0, skillId: skill.id, skillName: skill.name };
  }
  const mult = skill.damageMultiplier ?? 1;
  const damage = computeStepDamage(attacker, target, mult);
  return {
    damage,
    skillId: skill.id,
    skillName: skill.name,
    isAoe: Boolean(skill.aoe),
  };
}

const BATTLE_LOG_MAX_LINES = 12;
const AETHRA_HERO_ID = "aethra";
const AETHRA_BATTLE_IDLE_SPRITE = "assets/sprites/aethra-idle.png";
const AETHRA_BATTLE_WALK_SPRITE = "assets/sprites/aethra-walk.png";
const PERSEUS_HERO_ID = "perseus";
const PERSEUS_BATTLE_IDLE_SPRITE = "assets/sprites/perseus-idle.png";
const HERMES_HERO_ID = "hermes";
const HERMES_BATTLE_IDLE_SPRITE = "assets/sprites/hermes-idle.png";
const HERMES_BATTLE_WALK_SPRITE = "assets/sprites/hermes-walk.png";
const HADES_HERO_ID = "hades";
const HADES_BATTLE_IDLE_SPRITE = "assets/sprites/hades-idle.png";
const HADES_BATTLE_ATTACK_SPRITE = "assets/sprites/hades-attack.png";
const HADES_CARD_IDLE_SPRITE = "assets/portraits/hades.png";
const HERACLES_HERO_ID = "heracles";
const HERACLES_BATTLE_IDLE_SPRITE = "assets/sprites/heracles-idle.png";
const HERACLES_BATTLE_ATTACK_SPRITE = "assets/sprites/heracles-attack.png";
const HERACLES_ATTACK_ANIM_MS = 960;
const HADES_ATTACK_ANIM_MS = 760;
const SKELETON_HERO_ID = "skeleton";
const SKELETON_BATTLE_IDLE_SPRITE = "assets/sprites/skeleton-idle.png";
const MEDUSA_HERO_ID = "medusa";
const MEDUSA_BATTLE_IDLE_SPRITE = "assets/sprites/medusa-idle-north.png";
const CUPID_BATTLE_IDLE_SPRITE = "assets/sprites/cupid-idle-north.png";
const ZEUS_HERO_ID = "zeus";
const ZEUS_BATTLE_IDLE_SPRITE = "assets/sprites/zeus-idle-north.png";
const ARES_HERO_ID = "ares";
const ARES_BATTLE_IDLE_SPRITE = "assets/sprites/ares-idle-north.png";
const ATHENA_HERO_ID = "athena";
const ATHENA_BATTLE_IDLE_SPRITE = "assets/sprites/athena-idle-north.png";
const ARTEMIS_HERO_ID = "artemis";
const ARTEMIS_BATTLE_IDLE_SPRITE = "assets/sprites/artemis-idle-north.png";
const HELLHOUND_HERO_ID = "hellhound";
const HELLHOUND_BATTLE_IDLE_SPRITE = "assets/sprites/hellhound-idle.png";
const ROMAN_SPRITE_KEYS = new Set(["roman_soldier", "legionnaire"]);
const ROMAN_BATTLE_IDLE_SPRITE = "assets/sprites/roman-soldier-idle.png";
const SUMMON_DUPLICATE_GOLD_REWARD_DEFAULT = 250;
const SUMMON_DUPLICATE_GOLD_REWARD_EPIC = 500;
const SUMMON_DUPLICATE_GOLD_REWARD_LEGENDARY = 1000;
const QUEST_DEFEAT_HERACLES = "first_clear_heracles";
const QUEST_DEFEAT_HADES = "first_clear_hades";
const QUEST_SUMMON_EPIC = "first_summon_epic";
const QUEST_CLEAR_STAGE_10 = "first_clear_stage10";
const QUEST_WIN_3_BATTLES = "win_3_battles";
const XP_SCROLL_XP_GRANT = 100;
const DAILY_PRAY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DAILY_PRAY_REWARDS = [
  {
    id: "gold_500",
    label: "+500 gold",
    wheelLabel: "500 Gold",
    weight: 40,
    apply: () => addGold(500),
  },
  {
    id: "gold_1200",
    label: "+1,200 gold",
    wheelLabel: "1.2k Gold",
    weight: 24,
    apply: () => addGold(1200),
  },
  {
    id: "summon_1",
    label: "+1 summon scroll",
    wheelLabel: "+1 Summon",
    weight: 18,
    apply: () => addSummonScrolls(1),
  },
  {
    id: "xp_2",
    label: "+2 XP scrolls",
    wheelLabel: "+2 XP",
    weight: 12,
    apply: () => addXpScrolls(2),
  },
  {
    id: "legend_1",
    label: "+1 legend scroll",
    wheelLabel: "+1 Legend",
    weight: 6,
    apply: () => addLegendScrolls(1),
  },
];
const QUESTS = [
  {
    id: QUEST_DEFEAT_HERACLES,
    title: "Defeat Heracles",
    desc: "First-time clear quest: beat Stage 5 (Trial of Strength).",
    rewardLabel: "+1 summon scroll",
    claim: () => addSummonScrolls(1),
  },
  {
    id: QUEST_DEFEAT_HADES,
    title: "Defeat Hades",
    desc: "First-time clear quest: beat Stage 10 (Throne of the Dead).",
    rewardLabel: "+1 legend scroll",
    claim: () => addLegendScrolls(1),
  },
  {
    id: QUEST_CLEAR_STAGE_10,
    title: "Conquer Stage 10",
    desc: "First-time clear quest: finish the full campaign.",
    rewardLabel: "+2 summon scrolls",
    claim: () => addSummonScrolls(2),
  },
  {
    id: QUEST_SUMMON_EPIC,
    title: "Summon an Epic",
    desc: "First-time clear quest: summon any Epic hero.",
    rewardLabel: "+1,000 gold",
    claim: () => addGold(1000),
  },
  {
    id: QUEST_WIN_3_BATTLES,
    title: "Win 3 battles",
    desc: "Complete any 3 campaign victories.",
    rewardLabel: "+1 XP scroll",
    claim: () => addXpScrolls(1),
  },
];

function duplicateSummonGoldRewardForRarity(rarity) {
  if (rarity === "Legendary") return SUMMON_DUPLICATE_GOLD_REWARD_LEGENDARY;
  if (rarity === "Epic") return SUMMON_DUPLICATE_GOLD_REWARD_EPIC;
  return SUMMON_DUPLICATE_GOLD_REWARD_DEFAULT;
}

/** AI: strongest ready damaging skill, else first ready skill, else basic. */
function pickAiSkill(attacker, useSkills) {
  if (!useSkills || !attacker.skills?.length) return null;
  const ready = attacker.skills.filter(
    (s) => !s.passive && s.cooldownRemaining <= 0
  );
  if (!ready.length) return null;
  const damaging = ready.filter((s) => !s.skipAttack);
  if (damaging.length) {
    return damaging.reduce((a, b) =>
      (b.damageMultiplier ?? 1) > (a.damageMultiplier ?? 1) ? b : a
    );
  }
  return ready[0];
}

function planSingleAction(attacker, skill, teamA, teamB, manualTargetId = null) {
  attacker.skills = normalizeSkillMetadataForUnit(attacker?.id, attacker.skills || []);
  if (skill && Array.isArray(attacker.skills)) {
    const chosenId = skill.id != null ? String(skill.id) : null;
    const chosenName = skill.name != null ? String(skill.name) : null;
    const resolved =
      attacker.skills.find(
        (s) => chosenId != null && s?.id != null && String(s.id) === chosenId
      ) ||
      attacker.skills.find(
        (s) =>
          chosenName != null && s?.name != null && String(s.name) === chosenName
      ) ||
      null;
    skill = resolved;
  }
  const opts = getCombatOpts();
  const targeting = opts.targeting ?? "first";
  const foes = (attacker.team === "A" ? teamB : teamA).filter(isAlive);
  if (!foes.length) return null;

  let target = null;
  if (attacker.team === "A" && manualTargetId) {
    target =
      foes.find(
        (u) => u.id != null && String(u.id) === String(manualTargetId)
      ) ?? null;
  }
  if (!target) {
    target = pickTarget(foes, targeting, null);
  }
  if (!target) return null;

  let useSkill = skill;
  if (useSkill && useSkill.cooldownRemaining > 0) useSkill = null;

  const preview = previewResolveStepAttack(attacker, useSkill, target);
  return { target, useSkill, preview };
}

function applyPlannedAction(attacker, useSkill, target, preview, teams = null) {
  const isAoe = Boolean(preview?.isAoe);
  const teamA = teams?.teamA ?? state.teamA;
  const teamB = teams?.teamB ?? state.teamB;
  const foes = attacker.team === "A" ? teamB : teamA;
  const hitTargets = isAoe ? foes.filter(isAlive) : [target];
  const aoeDamage = [];
  let targetHpLeft = target.hp;
  let stunnedAny = false;
  for (const t of hitTargets) {
    if (!t) continue;
    if (preview.damage > 0) {
      t.hp = Math.max(0, t.hp - preview.damage);
    }
    const stunned = maybeApplyStun(attacker, useSkill, t, preview.damage);
    if (stunned) stunnedAny = true;
    if (t === target) targetHpLeft = t.hp;
    aoeDamage.push({
      target: t.name,
      targetHpLeft: t.hp,
      stunned,
      visualKey: vanishKeyForUnit(t),
    });
  }
  if (useSkill) {
    useSkillOnUnit(useSkill);
  }
  const speedBuffApplied = maybeApplySpeedBuff(attacker, useSkill);
  return {
    actor: attacker.name,
    target: target.name,
    damage: preview.damage,
    skillName: preview.skillName,
    targetHpLeft,
    stunnedTarget: stunnedAny,
    isAoe,
    aoeDamage,
    speedBuffApplied,
    speedBuffMultiplier: attacker.speedBuffMultiplierActive ?? 1,
    speedBuffRounds: attacker.speedBuffRounds ?? 0,
  };
}

/** Time to match CSS `battle-card-vanish` before collapsing the card slot. */
const BATTLE_VANISH_MS = 780;

function vanishKeyForUnit(unit) {
  if (!unit || unit.team == null) return null;
  const team = unit.team === "A" ? state.teamA : state.teamB;
  const idx = team.indexOf(unit);
  if (idx < 0) return null;
  return `${unit.team}-${idx}`;
}

/**
 * After damage is applied: refresh UI, handle wipe, then advance turn.
 * When the target is killed, waits for the defeat vanish animation so `renderTeams` does not cut it short.
 */
function scheduleVanishAndProcessTurn(act, plan) {
  const vk =
    act && act.targetHpLeft === 0 && plan
      ? vanishKeyForUnit(plan.target)
      : null;
  const vanishKeys = new Set(
    [vk, ...((act?.aoeDamage || []).filter((d) => Number(d.targetHpLeft) <= 0).map((d) => d.visualKey))]
      .filter(Boolean)
  );
  renderTeams();
  if (checkBattleEndAfterAction()) {
    if (vanishKeys.size > 0) {
      setTimeout(() => {
        vanishKeys.forEach((k) => state.battleVanishedKeys.add(k));
        renderTeams();
      }, BATTLE_VANISH_MS);
    }
    return;
  }
  state.turnIndex += 1;
  if (vanishKeys.size > 0) {
    setTimeout(() => {
      vanishKeys.forEach((k) => state.battleVanishedKeys.add(k));
      processTurnStep();
    }, BATTLE_VANISH_MS);
  } else {
    processTurnStep();
  }
}

function executeSingleAction(attacker, skill, teamA, teamB, manualTargetId = null) {
  const plan = planSingleAction(attacker, skill, teamA, teamB, manualTargetId);
  if (!plan) return null;
  return applyPlannedAction(attacker, plan.useSkill, plan.target, plan.preview, {
    teamA,
    teamB,
  });
}

function logActionLine(act) {
  if (act.isAoe && Array.isArray(act.aoeDamage)) {
    const skill =
      act.skillName != null
        ? ` <span class="tag skill-use">${escapeHtml(act.skillName)}</span>`
        : "";
    appendLogLine(
      `${escapeHtml(act.actor)} → <strong>AOE</strong>: <strong>${statWhole(act.damage)}</strong> damage to all enemies${skill}`
    );
    for (const hit of act.aoeDamage) {
      appendLogLine(
        `• ${escapeHtml(hit.target)} (HP left ${statWhole(hit.targetHpLeft)})${hit.stunned ? ' <span class="tag skill-use">Stunned</span>' : ""}`
      );
    }
    if (act.speedBuffApplied) {
      appendLogLine(
        `<span class="tag skill-use">Speed Up</span> ${escapeHtml(act.actor)} gains ${statWhole(act.speedBuffMultiplier ?? 1)}× SPD for ${statWhole(act.speedBuffRounds ?? 0)} turns.`
      );
    }
    return;
  }
  const skill =
    act.skillName != null
      ? ` <span class="tag skill-use">${escapeHtml(act.skillName)}</span>`
      : "";
  appendLogLine(
    `${escapeHtml(act.actor)} → ${escapeHtml(act.target)}: ` +
      `<strong>${statWhole(act.damage)}</strong> damage${skill} ` +
      `(HP left ${statWhole(act.targetHpLeft)})`
  );
  if (act.stunnedTarget) {
    appendLogLine(
      `<span class="tag skill-use">Stun</span> ${escapeHtml(act.target)} is stunned and may lose the next turn.`
    );
  }
  if (act.speedBuffApplied) {
    appendLogLine(
      `<span class="tag skill-use">Speed Up</span> ${escapeHtml(act.actor)} gains ${statWhole(act.speedBuffMultiplier ?? 1)}× SPD for ${statWhole(act.speedBuffRounds ?? 0)} turns.`
    );
  }
}

function normalizeSkillMetadataForUnit(unitId, skills) {
  const uid = String(unitId || "").toLowerCase();
  if (!Array.isArray(skills) || !skills.length || uid !== "zeus") return skills;
  return skills.map((s) => {
    if (!s || !s.name) return s;
    if (s.name === "King of Gods") {
      return {
        ...s,
        passive: true,
        passiveStunChance: Number(s.passiveStunChance ?? 0.5),
        cooldown: 0,
        cooldownRemaining: 0,
        aoe: false,
      };
    }
    if (s.name === "Olympian Wrath") {
      return {
        ...s,
        aoe: true,
        damageMultiplier: 1.5,
        cooldown: 4,
      };
    }
    return s;
  });
}

function cloneUnit(u) {
  const skills = normalizeSkillMetadataForUnit(
    u?.id,
    (u.skills || []).map((s) => ({
      id: s.id,
      name: s.name,
      cooldown: s.cooldown,
      damageMultiplier: s.damageMultiplier,
      skipAttack: s.skipAttack,
      stunChance: s.stunChance,
      stunDurationRounds: s.stunDurationRounds,
      speedBuffMultiplier: s.speedBuffMultiplier,
      speedBuffDurationRounds: s.speedBuffDurationRounds,
      aoe: s.aoe,
      passive: s.passive,
      passiveStunChance: s.passiveStunChance,
      cooldownRemaining: s.cooldownRemaining ?? 0,
    }))
  );
  return {
    ...(u.id != null ? { id: u.id } : {}),
    ...(u.rarity != null ? { rarity: u.rarity } : {}),
    name: u.name,
    mythicTitle: u.mythicTitle,
    maxHp: u.maxHp ?? u.hp,
    hp: u.maxHp ?? u.hp,
    attack: u.attack,
    defense: u.defense,
    speed: u.speed,
    stunRounds: u.stunRounds ?? 0,
    speedBuffRounds: u.speedBuffRounds ?? 0,
    speedBuffMultiplierActive: u.speedBuffMultiplierActive ?? 1,
    skills,
  };
}

function cloneTeam(template) {
  return template.map(cloneUnit);
}

function getCombatOpts() {
  const targeting = document.getElementById("targeting").value;
  const useSkills = document.getElementById("use-skills").checked;
  return { targeting, useSkills };
}

let state = {
  teamA: [],
  teamB: [],
  snapshotParty: null,
  snapshotEnemy: null,
  round: 0,
  finished: false,
  winner: null,
  mode: "idle",
  campaignStage: null,
  /** @type {object[]} */
  turnQueue: [],
  turnIndex: 0,
  /** @type {string | null} hero id of clicked enemy for player attacks */
  battleTargetEnemyId: null,
  /** @type {{ gold: number; partyXpEach: number; scrollDropped: boolean } | null} */
  lastCampaignRewards: null,
  /** @type {string | null} e.g. "A-0" / "B-1" for SW-style active unit highlight */
  battleActingKey: null,
  /** 1 | 2 | 3 — cosmetic speed label for battle HUD */
  battleSpeedLabel: 1,
  /** When true, player turns use AI (same as old “Auto battle” resolution per turn) */
  battleAutoPlay: false,
  /** Battle UI: slot keys `A-0` / `B-1` removed from layout after defeat animation. */
  battleVanishedKeys: new Set(),
  /** Selected campaign card before opening lineup widget. */
  pendingCampaignLevelIndex: null,
  /** Victory UI: XP animation payload after campaign rewards are granted. */
  lastBattleXpAnim: [],
  /** Summon reel animation can be skipped by user. */
  summonAnimSkipRequested: false,
  summonAnimRunning: false,
  /** Last gacha pull used a legend scroll (for “Summon again” on reveal overlay). */
  lastSummonWasLegend: false,
  praySpinRunning: false,
};

function el(id) {
  return document.getElementById(id);
}

function isLikelyMobileDevice() {
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 900;
}

/** Prefer landscape-only play; fullscreen helps orientation lock on some Android browsers. */
async function ensureLandscapeOrientation() {
  const tryLock = async () => {
    try {
      if (screen.orientation?.lock) {
        await screen.orientation.lock("landscape");
        return true;
      }
    } catch (_) {
      /* Locked already, unsupported, or not permitted. */
    }
    return false;
  };

  if (await tryLock()) return;

  try {
    const root = document.documentElement;
    if (!document.fullscreenElement && root?.requestFullscreen) {
      await root.requestFullscreen();
    }
  } catch (_) {
    /* Fullscreen requires a user gesture on many browsers. */
  }

  await tryLock();
}

function maybeReassertLandscapeLock() {
  if (!isLikelyMobileDevice()) return;
  const o = screen.orientation;
  const type = o?.type ?? "";
  if (type.startsWith("portrait")) {
    void ensureLandscapeOrientation();
  }
}

function updateMobileOrientationUI() {
  const mobile = isLikelyMobileDevice();
  document.body.classList.toggle("mobile-mode", mobile);
}

function syncBattleAutoToggleUI() {
  const btn = el("btn-battle-auto");
  if (!btn) return;
  btn.classList.toggle("battle-hud-icon--active", state.battleAutoPlay);
  btn.setAttribute("aria-pressed", state.battleAutoPlay ? "true" : "false");
  btn.title = state.battleAutoPlay
    ? "Auto battle on — tap to control manually"
    : "Auto battle — tap for AI to play your turns";
}

/** Pick a default enemy target for auto-play when none selected. */
function ensureAutoBattleTarget() {
  const foes = state.teamB.filter(isAlive);
  if (!foes.length) return;
  const id = state.battleTargetEnemyId;
  const valid =
    id != null &&
    foes.some((u) => u.id != null && String(u.id) === String(id));
  if (valid) return;
  const first = foes.find((u) => u.id != null);
  if (first) state.battleTargetEnemyId = String(first.id);
}

function closeSummonRevealOverlay() {
  const ov = el("summon-reveal-overlay");
  if (ov) {
    ov.classList.add("is-hidden");
    ov.setAttribute("aria-hidden", "true");
  }
  document.body.classList.remove("summon-reveal-active");
  const stage = el("summon-reveal-stage");
  if (stage) stage.innerHTML = "";
  const actions = el("summon-reveal-actions");
  if (actions) actions.classList.add("is-hidden");
  const skip = el("btn-summon-reveal-skip");
  if (skip) skip.classList.add("is-hidden");
  state.summonAnimRunning = false;
  state.summonAnimSkipRequested = false;
  updateSummonPullButton();
}

function openSummonRevealOverlay() {
  const ov = el("summon-reveal-overlay");
  if (!ov) return;
  ov.classList.remove("is-hidden");
  ov.setAttribute("aria-hidden", "false");
  document.body.classList.add("summon-reveal-active");
  const actions = el("summon-reveal-actions");
  if (actions) actions.classList.add("is-hidden");
  const skip = el("btn-summon-reveal-skip");
  if (skip) {
    skip.classList.remove("is-hidden");
    skip.disabled = false;
  }
}

function showSummonRevealActionsBar() {
  const actions = el("summon-reveal-actions");
  if (actions) actions.classList.remove("is-hidden");
  const skip = el("btn-summon-reveal-skip");
  if (skip) skip.classList.add("is-hidden");
  const again = el("btn-summon-again");
  if (again) {
    again.disabled =
      state.lastSummonWasLegend
        ? getLegendScrolls() < 1
        : getSummonScrolls() < 1;
  }
}

function showScreen(screenElId) {
  if (screenElId !== "screen-summon") {
    closeSummonRevealOverlay();
  }
  document.querySelectorAll(".screen").forEach((s) => {
    s.classList.remove("screen-active");
  });
  const node = el(screenElId);
  if (node) node.classList.add("screen-active");
  document.body.classList.toggle("battle-active", screenElId === "screen-battle");
  document.body.classList.toggle("hub-screen-active", screenElId === "screen-hub");
  document.body.classList.toggle("campaign-screen-active", screenElId === "screen-campaign");
  renderGoldBar();
  renderSummonScrollBar();
  updateShopCupidButton();
  updateShopScrollButton();
  updateShopLegendScrollButton();
  updateSummonPullButton();
  if (screenElId === "screen-shop") {
    renderShopCupidStats();
  }
  if (screenElId === "screen-box") {
    renderXpScrollPanel();
  }
  updateShopXpScrollButton();
  if (screenElId !== "screen-campaign") {
    hideCampaignLineupOverlay();
    hideCampaignRewardsModal();
    state.pendingCampaignLevelIndex = null;
  }
  if (screenElId === "screen-pray") {
    renderPrayPanel();
  }
  updateMobileOrientationUI();
}

function applyBattleStageBackdrop(level) {
  const battleScreen = el("screen-battle");
  if (!battleScreen) return;
  const stageNum = Math.max(1, Math.min(10, Number(level) || 1));
  for (let i = 1; i <= 10; i += 1) {
    battleScreen.classList.remove(`battle-stage-${i}`);
  }
  battleScreen.classList.add(`battle-stage-${stageNum}`);
}

function buildPartyUnits() {
  return getBattleParty()
    .map((id) => getHeroDefById(id))
    .filter(Boolean)
    .map((h) => {
      const base = heroToGameUnit(h);
      const { level } = getHeroProgress(h.id);
      return cloneUnit(applyLevelScaling(base, level));
    });
}

/** CSS class for rarity border (Rare, Epic, Legendary, Common). */
function rarityClass(rarity) {
  const r = String(rarity || "Common").replace(/[^a-zA-Z]/g, "") || "Common";
  return `rarity-${r}`;
}

function buildEnemyUnits(enemyDefs) {
  return enemyDefs.map((h) => cloneUnit(heroToGameUnit(h)));
}

function saveBattleSnapshots() {
  state.snapshotParty = state.teamA.map(cloneUnit);
  state.snapshotEnemy = state.teamB.map(cloneUnit);
}

function ensureValidBattleTarget() {
  if (!state.teamB?.length) return;
  const aliveB = state.teamB.filter(isAlive);
  if (!aliveB.length) return;
  const cur = state.battleTargetEnemyId;
  if (
    !cur ||
    !aliveB.some((u) => u.id != null && String(u.id) === String(cur))
  ) {
    const first = aliveB[0];
    state.battleTargetEnemyId = first.id != null ? String(first.id) : null;
  }
}

function canSelectEnemyTarget() {
  if (state.finished) return false;
  if (!state.teamB?.length || !state.teamB.some(isAlive)) return false;
  return state.mode === "idle" || state.mode === "turn";
}

function syncBattleActingKey() {
  state.battleActingKey = null;
  if (state.mode !== "turn" || state.finished) return;
  if (!state.turnQueue.length || state.turnIndex >= state.turnQueue.length) {
    return;
  }
  const actor = state.turnQueue[state.turnIndex];
  if (!actor || !isAlive(actor)) return;
  const team = actor.team === "A" ? state.teamA : state.teamB;
  const idx = team.indexOf(actor);
  if (idx >= 0) state.battleActingKey = `${actor.team}-${idx}`;
}

function renderTurnOrderStrip() {
  const mount = el("battle-turn-order");
  if (!mount) return;
  if (
    state.mode !== "turn" ||
    state.finished ||
    !state.turnQueue.length
  ) {
    mount.innerHTML = "";
    mount.classList.add("is-hidden");
    return;
  }
  mount.classList.remove("is-hidden");
  const remaining = state.turnQueue.slice(state.turnIndex).filter(isAlive);
  const chips = remaining
    .slice(0, 3)
    .map((u, i) => {
      const ally = u.team === "A";
      const ini = escapeHtml(portraitInitial(u.name));
      const tip = escapeHtml(u.name);
      const current = i === 0 ? " sw-turn-chip--current" : "";
      return `<span class="sw-turn-chip${ally ? " sw-turn-chip--ally" : " sw-turn-chip--enemy"}${current}" title="${tip}"><span class="sw-turn-chip-inner">${ini}</span></span>`;
    })
    .join("");
  mount.innerHTML = `<div class="sw-turn-order-bar sw-turn-order-bar--compact">
    <span class="sw-turn-order-title">Next</span>
    <div class="sw-turn-chip-row" role="list">${chips || '<span class="sw-turn-empty">—</span>'}</div>
  </div>`;
}

function renderTeams() {
  if (state.teamA.length || state.teamB.length) {
    ensureValidBattleTarget();
  }
  syncBattleActingKey();
  el("team-a-roster").innerHTML = buildTeamHtml(
    state.teamA,
    GAME_META.teamALabel,
    "A"
  );
  const rosterB = el("team-b-roster");
  rosterB.innerHTML = buildTeamHtml(
    state.teamB,
    GAME_META.teamBLabel,
    "B"
  );
  rosterB.classList.toggle("roster--enemy-targetable", canSelectEnemyTarget());
  const battleArena = document.querySelector("#screen-battle .battle-arena--sw");
  if (battleArena) {
    battleArena.classList.toggle(
      "battle-arena--target-pick",
      canSelectEnemyTarget()
    );
  }
  renderTurnOrderStrip();
}

function portraitInitial(name) {
  const c = String(name).trim().charAt(0);
  return c ? c.toUpperCase() : "?";
}

function normalizeUnitSpriteKey(u) {
  if (u?.id == null) return "";
  return String(u.id).toLowerCase().replace(/_[0-9]+$/, "");
}

function isAethraUnit(u) {
  return normalizeUnitSpriteKey(u) === AETHRA_HERO_ID;
}

function isHeraclesUnit(u) {
  return normalizeUnitSpriteKey(u) === HERACLES_HERO_ID;
}

function isHadesUnit(u) {
  return normalizeUnitSpriteKey(u) === HADES_HERO_ID;
}

function isRomanSpriteUnit(u) {
  return ROMAN_SPRITE_KEYS.has(normalizeUnitSpriteKey(u));
}

function isSkeletonUnit(u) {
  return normalizeUnitSpriteKey(u) === SKELETON_HERO_ID;
}

function isMedusaUnit(u) {
  return normalizeUnitSpriteKey(u) === MEDUSA_HERO_ID;
}

function isCupidUnit(u) {
  return normalizeUnitSpriteKey(u) === CUPID_HERO_ID;
}

function isZeusUnit(u) {
  return normalizeUnitSpriteKey(u) === ZEUS_HERO_ID;
}

function isAresUnit(u) {
  return normalizeUnitSpriteKey(u) === ARES_HERO_ID;
}

function isAthenaUnit(u) {
  return normalizeUnitSpriteKey(u) === ATHENA_HERO_ID;
}

function isArtemisUnit(u) {
  return normalizeUnitSpriteKey(u) === ARTEMIS_HERO_ID;
}

function isHellhoundUnit(u) {
  return normalizeUnitSpriteKey(u) === HELLHOUND_HERO_ID;
}

function isPerseusUnit(u) {
  return normalizeUnitSpriteKey(u) === PERSEUS_HERO_ID;
}

function isHermesUnit(u) {
  return normalizeUnitSpriteKey(u) === HERMES_HERO_ID;
}

function isSpriteUnit(u) {
  return (
    isAethraUnit(u) ||
    isHermesUnit(u) ||
    isRomanSpriteUnit(u) ||
    isHadesUnit(u) ||
    isHeraclesUnit(u) ||
    isSkeletonUnit(u) ||
    isMedusaUnit(u) ||
    isCupidUnit(u) ||
    isZeusUnit(u) ||
    isAresUnit(u) ||
    isAthenaUnit(u) ||
    isArtemisUnit(u) ||
    isHellhoundUnit(u) ||
    isPerseusUnit(u)
  );
}

function portraitBlockHtml(u, opts = {}) {
  const useBattleSprite = Boolean(opts.useBattleSprite);
  if (useBattleSprite && isAethraUnit(u)) {
    const spriteLabel = escapeHtml(`${u.name} battle sprite`);
    return `<div class="portrait-frame portrait-frame--sprite" aria-hidden="true">
        <div class="portrait-mat">
          <span class="battle-sprite battle-sprite--aethra battle-sprite--idle" role="img" aria-label="${spriteLabel}" style="--aethra-idle:url('${AETHRA_BATTLE_IDLE_SPRITE}'); --aethra-walk:url('${AETHRA_BATTLE_WALK_SPRITE}');"></span>
        </div>
      </div>`;
  }
  if (useBattleSprite && isRomanSpriteUnit(u)) {
    const spriteLabel = escapeHtml(`${u.name} battle sprite`);
    return `<div class="portrait-frame portrait-frame--sprite" aria-hidden="true">
        <div class="portrait-mat">
          <span class="battle-sprite battle-sprite--roman battle-sprite--idle" role="img" aria-label="${spriteLabel}" style="--roman-idle:url('${ROMAN_BATTLE_IDLE_SPRITE}');"></span>
        </div>
      </div>`;
  }
  if (useBattleSprite && isHeraclesUnit(u)) {
    const spriteLabel = escapeHtml(`${u.name} battle sprite`);
    return `<div class="portrait-frame portrait-frame--sprite" aria-hidden="true">
        <div class="portrait-mat">
          <span class="battle-sprite battle-sprite--heracles battle-sprite--idle" role="img" aria-label="${spriteLabel}" style="--heracles-idle:url('${HERACLES_BATTLE_IDLE_SPRITE}'); --heracles-attack:url('${HERACLES_BATTLE_ATTACK_SPRITE}');"></span>
        </div>
      </div>`;
  }
  if (useBattleSprite && isHadesUnit(u)) {
    const spriteLabel = escapeHtml(`${u.name} battle sprite`);
    const idleSprite = u?.team === "B" ? HADES_CARD_IDLE_SPRITE : HADES_BATTLE_IDLE_SPRITE;
    return `<div class="portrait-frame portrait-frame--sprite" aria-hidden="true">
        <div class="portrait-mat">
          <span class="battle-sprite battle-sprite--hades battle-sprite--idle" role="img" aria-label="${spriteLabel}" style="--hades-idle:url('${idleSprite}'); --hades-attack:url('${HADES_BATTLE_ATTACK_SPRITE}');"></span>
        </div>
      </div>`;
  }
  if (useBattleSprite && isSkeletonUnit(u)) {
    const spriteLabel = escapeHtml(`${u.name} battle sprite`);
    return `<div class="portrait-frame portrait-frame--sprite" aria-hidden="true">
        <div class="portrait-mat">
          <span class="battle-sprite battle-sprite--skeleton battle-sprite--idle" role="img" aria-label="${spriteLabel}" style="--skeleton-idle:url('${SKELETON_BATTLE_IDLE_SPRITE}');"></span>
        </div>
      </div>`;
  }
  if (useBattleSprite && isMedusaUnit(u)) {
    const spriteLabel = escapeHtml(`${u.name} battle sprite`);
    return `<div class="portrait-frame portrait-frame--sprite" aria-hidden="true">
        <div class="portrait-mat">
          <span class="battle-sprite battle-sprite--medusa battle-sprite--idle" role="img" aria-label="${spriteLabel}" style="--medusa-idle:url('${MEDUSA_BATTLE_IDLE_SPRITE}');"></span>
        </div>
      </div>`;
  }
  if (useBattleSprite && isCupidUnit(u)) {
    const spriteLabel = escapeHtml(`${u.name} battle sprite`);
    return `<div class="portrait-frame portrait-frame--sprite" aria-hidden="true">
        <div class="portrait-mat">
          <span class="battle-sprite battle-sprite--cupid battle-sprite--idle" role="img" aria-label="${spriteLabel}" style="--cupid-idle:url('${CUPID_BATTLE_IDLE_SPRITE}');"></span>
        </div>
      </div>`;
  }
  if (useBattleSprite && isZeusUnit(u)) {
    const spriteLabel = escapeHtml(`${u.name} battle sprite`);
    return `<div class="portrait-frame portrait-frame--sprite" aria-hidden="true">
        <div class="portrait-mat">
          <span class="battle-sprite battle-sprite--zeus battle-sprite--idle" role="img" aria-label="${spriteLabel}" style="--zeus-idle:url('${ZEUS_BATTLE_IDLE_SPRITE}');"></span>
        </div>
      </div>`;
  }
  if (useBattleSprite && isAresUnit(u)) {
    const spriteLabel = escapeHtml(`${u.name} battle sprite`);
    return `<div class="portrait-frame portrait-frame--sprite" aria-hidden="true">
        <div class="portrait-mat">
          <span class="battle-sprite battle-sprite--ares battle-sprite--idle" role="img" aria-label="${spriteLabel}" style="--ares-idle:url('${ARES_BATTLE_IDLE_SPRITE}');"></span>
        </div>
      </div>`;
  }
  if (useBattleSprite && isAthenaUnit(u)) {
    const spriteLabel = escapeHtml(`${u.name} battle sprite`);
    return `<div class="portrait-frame portrait-frame--sprite" aria-hidden="true">
        <div class="portrait-mat">
          <span class="battle-sprite battle-sprite--athena battle-sprite--idle" role="img" aria-label="${spriteLabel}" style="--athena-idle:url('${ATHENA_BATTLE_IDLE_SPRITE}');"></span>
        </div>
      </div>`;
  }
  if (useBattleSprite && isArtemisUnit(u)) {
    const spriteLabel = escapeHtml(`${u.name} battle sprite`);
    return `<div class="portrait-frame portrait-frame--sprite" aria-hidden="true">
        <div class="portrait-mat">
          <span class="battle-sprite battle-sprite--artemis battle-sprite--idle" role="img" aria-label="${spriteLabel}" style="--artemis-idle:url('${ARTEMIS_BATTLE_IDLE_SPRITE}');"></span>
        </div>
      </div>`;
  }
  if (useBattleSprite && isHellhoundUnit(u)) {
    const spriteLabel = escapeHtml(`${u.name} battle sprite`);
    return `<div class="portrait-frame portrait-frame--sprite" aria-hidden="true">
        <div class="portrait-mat">
          <span class="battle-sprite battle-sprite--hellhound battle-sprite--idle" role="img" aria-label="${spriteLabel}" style="--hellhound-idle:url('${HELLHOUND_BATTLE_IDLE_SPRITE}');"></span>
        </div>
      </div>`;
  }
  if (useBattleSprite && isPerseusUnit(u)) {
    const spriteLabel = escapeHtml(`${u.name} battle sprite`);
    return `<div class="portrait-frame portrait-frame--sprite" aria-hidden="true">
        <div class="portrait-mat">
          <span class="battle-sprite battle-sprite--perseus battle-sprite--idle" role="img" aria-label="${spriteLabel}" style="--perseus-idle:url('${PERSEUS_BATTLE_IDLE_SPRITE}');"></span>
        </div>
      </div>`;
  }
  if (useBattleSprite && isHermesUnit(u)) {
    const spriteLabel = escapeHtml(`${u.name} battle sprite`);
    return `<div class="portrait-frame portrait-frame--sprite" aria-hidden="true">
        <div class="portrait-mat">
          <span class="battle-sprite battle-sprite--hermes battle-sprite--idle" role="img" aria-label="${spriteLabel}" style="--hermes-idle:url('${HERMES_BATTLE_IDLE_SPRITE}'); --hermes-walk:url('${HERMES_BATTLE_WALK_SPRITE}');"></span>
        </div>
      </div>`;
  }
  const letter = escapeHtml(portraitInitial(u.name));
  const idStr = u.id != null ? String(u.id) : "";
  const src = getPortraitUrl(idStr);
  return `<div class="portrait-frame" aria-hidden="true">
        <div class="portrait-mat">
          <img class="portrait-img" src="${src}" alt="" width="120" height="160" loading="lazy" decoding="async" onerror="this.classList.add('portrait-img--hidden');var n=this.nextElementSibling;if(n)n.classList.add('portrait-fallback--show');"/>
          <span class="portrait-placeholder">${letter}</span>
        </div>
      </div>`;
}

/** Mobile battle formation: allies in a shallow V; enemies nudged toward center (CSS vars --bf-tx / --bf-ty). */
function battleFormationStyleAttr(side, index, count) {
  if (
    typeof window.matchMedia !== "function" ||
    !window.matchMedia("(max-width: 950px)").matches
  ) {
    return "";
  }
  if (count <= 1) return "";
  const mid = (count - 1) / 2;
  const dist = index - mid;
  let tx = "0%";
  let ty = "0px";
  if (side === "A") {
    const kx = count === 2 ? 3.5 : count === 3 ? 3.2 : 2.85;
    const ky = count === 2 ? 7 : count === 3 ? 5.5 : 4.5;
    tx = `${-dist * kx}%`;
    ty = `${Math.abs(dist) * ky + (count >= 4 ? 2 : 0)}px`;
  } else {
    const kx = count === 2 ? 2.8 : count === 3 ? 3.4 : 3.1;
    tx = `${-dist * kx}%`;
    ty = "0px";
  }
  return ` style="--bf-tx:${tx};--bf-ty:${ty}"`;
}

function buildTeamHtml(team, label, side) {
  const targetId = state.battleTargetEnemyId;
  const n = team.length;
  const cards = team
    .map((u, i) => {
      const targeted =
        side === "B" &&
        isAlive(u) &&
        u.id != null &&
        targetId != null &&
        String(u.id) === String(targetId);
      const targetedClass = targeted ? " enemy-target-selected" : "";
      const actingKey = `${side}-${i}`;
      const actingClass =
        state.battleActingKey === actingKey ? " unit-card--acting" : "";
      const key = `${side}-${i}`;
      if (!isAlive(u)) {
        if (state.battleVanishedKeys.has(key)) {
          return `<div class="battle-card-slot battle-card-slot--vanished" data-side="${side}" data-index="${i}" aria-hidden="true"></div>`;
        }
      }
      const defeatVanishClass = !isAlive(u) ? " unit-card--defeat-vanishing" : "";
      const hp = hpPct(u);
      const atb = atbDisplayPct(side, i, u);
      const lvl = battleUnitDisplayLevel(u, side, i);
      const isStunnedNow = isUnitStunned(u);
      const hasSpeedBuffNow = (u?.speedBuffRounds ?? 0) > 0;
      const modelKind = side === "B" ? "enemy" : "ally";
      const stunnedClass = isStunnedNow ? " unit-card--stunned" : "";
      const spriteBodyClass = isSpriteUnit(u) ? " sw-unit-body--sprite" : "";
      const spritePadClass = isSpriteUnit(u) ? " sw-unit-pad--sprite" : "";
      const spriteFaceClass = isSpriteUnit(u) ? " battle-char-cardface--sprite" : "";
      const heroIdAttr = u.id != null ? String(u.id) : "";
      const skillHud = buildHeroSkillHudHtml(heroIdAttr);
      const formAttr = battleFormationStyleAttr(side, i, n);
      return `
    <div class="card unit-card unit-card--compact unit-card--sw unit-card--arena unit-card--battle-card ${rarityClass(u.rarity)}${targetedClass}${actingClass}${defeatVanishClass}${stunnedClass}" data-side="${side}" data-index="${i}"${
        u.id != null ? ` data-hero-id="${escapeHtml(String(u.id))}"` : ""
      } data-rarity="${escapeHtml(String(u.rarity || ""))}"${formAttr}>
      <div class="unit-card-motion">
      <div class="sw-float-ui" aria-hidden="true">
        <span class="sw-lvl-badge">${lvl}</span>
        <div class="sw-bar-col">
          ${
            isStunnedNow
              ? '<span class="sw-stun-emoji" title="Stunned">💫</span>'
              : ""
          }
          ${
            hasSpeedBuffNow
              ? '<span class="sw-speed-emoji" title="Speed Up">⚡</span>'
              : ""
          }
          <div class="sw-bar sw-bar--hp" title="HP">
            <div class="sw-bar-fill" style="width:${hp}%"></div>
          </div>
          <div class="sw-bar sw-bar--mana" title="Mana">
            <div class="sw-bar-fill" style="width:${atb}%"></div>
          </div>
        </div>
      </div>
      <div class="sw-unit-body${spriteBodyClass}">
        <div class="sw-unit-pad${spritePadClass}">
          <div class="sw-unit-cardface sw-unit-cardface--${modelKind} battle-char-cardface${spriteFaceClass}">
            ${portraitBlockHtml(u, { useBattleSprite: true })}
          </div>
        </div>
        <p class="sw-unit-name">${escapeHtml(u.name)}</p>
      </div>
      </div>
      ${skillHud}
    </div>`;
    })
    .join("");
  const teamKind = side === "B" ? "enemy" : "ally";
  return `<div class="sw-team sw-team--${teamKind}">
    <div class="sw-team-label">${escapeHtml(label)}</div>
    <div class="sw-unit-row unit-grid">${cards}</div>
  </div>`;
}

function hpPct(u) {
  const max = u.maxHp || 1;
  return Math.max(0, Math.min(100, (100 * u.hp) / max));
}

/** Fallback level when campaign / hero progress is unavailable. */
function placeholderUnitLevel(u, slotIndex) {
  const n =
    18 +
    ((u.attack + u.defense + u.speed + slotIndex * 7) % 22);
  return Math.min(40, Math.max(1, n));
}

/** Level shown in the blue orb beside HP bars: real hero level or stage level for foes. */
function battleUnitDisplayLevel(u, side, slotIndex) {
  if (side === "A" && u.id != null) {
    return getHeroProgress(u.id).level;
  }
  if (side === "B" && state.campaignStage != null) {
    return state.campaignStage;
  }
  return placeholderUnitLevel(u, slotIndex);
}

/** Visual ATB fill: full when acting; otherwise from turn queue position. */
function atbDisplayPct(side, i, u) {
  if (!isAlive(u)) return 0;
  const key = `${side}-${i}`;
  if (state.mode === "turn" && state.battleActingKey === key) return 100;
  if (state.mode !== "turn" || state.finished || !state.turnQueue.length) {
    return 38;
  }
  const remaining = state.turnQueue.slice(state.turnIndex).filter(isAlive);
  const team = side === "A" ? state.teamA : state.teamB;
  const unit = team[i];
  const pos = remaining.indexOf(unit);
  if (pos < 0) return 12;
  if (pos === 0) return 100;
  return Math.max(8, 96 - pos * 14);
}

const SKILL_SLOT_ICONS = ["⚔", "⚡", "✦", "🛡", "☆", "✧"];

function skillSlotPlaceholderIcon(index) {
  return SKILL_SLOT_ICONS[index % SKILL_SLOT_ICONS.length];
}

const ZEUS_SKILL_ICON_URLS = {
  lightning_bolt: "assets/skill-zeus-bolt.png",
  olympian_wrath: "assets/skill-zeus-grimoire.png",
  king_of_gods: "assets/skill-zeus-hammer.png",
};

function skillIconHtmlForUnitSkill(unitId, skill, index) {
  const idKey = String(unitId || "").toLowerCase();
  const skillKey = String(
    skill?.id ||
      skill?.name ||
      `skill_${index}`
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (idKey === "zeus" && ZEUS_SKILL_ICON_URLS[skillKey]) {
    const src = ZEUS_SKILL_ICON_URLS[skillKey];
    const alt = escapeHtml(`${skill?.name || "Skill"} icon`);
    return `<img class="skill-slot-icon-img" src="${escapeHtml(src)}" alt="${alt}" loading="lazy" decoding="async" />`;
  }
  return skillSlotPlaceholderIcon(index);
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statWhole(n) {
  return Math.round(Number(n) || 0);
}

function appendLogLine(html) {
  const box = el("battle-log");
  const line = document.createElement("div");
  line.className = "log-line";
  line.innerHTML = html;
  box.appendChild(line);
  while (box.children.length > BATTLE_LOG_MAX_LINES) {
    box.removeChild(box.firstChild);
  }
}

function clearLog() {
  el("battle-log").innerHTML = "";
}

function setBanner(text, kind = "") {
  const b = el("banner");
  if (!b) return;
  b.textContent = text;
  b.className =
    "banner battle-banner battle-banner--offscreen" + (kind ? ` ${kind}` : "");
}

function refillAllHp() {
  for (const u of [...state.teamA, ...state.teamB]) {
    u.hp = u.maxHp ?? u.hp;
    if (u.skills) {
      for (const s of u.skills) s.cooldownRemaining = 0;
    }
  }
}

function hideTurnPanel() {
  const panel = el("turn-panel");
  if (panel) {
    panel.classList.add("is-hidden");
    const box = el("turn-skill-buttons");
    if (box) box.innerHTML = "";
  }
}

function resetBattle() {
  hideTurnPanel();
  refillAllHp();
  clearLog();
  state.round = 0;
  state.finished = false;
  state.winner = null;
  state.mode = "idle";
  state.turnQueue = [];
  state.turnIndex = 0;
  state.battleTargetEnemyId = null;
  state.battleActingKey = null;
  state.battleAutoPlay = false;
  state.battleVanishedKeys = new Set();
  setBanner("");
  hideBattleWinUI();
  hideBattleDefeatUI();
  syncBattleAutoToggleUI();
  renderTeams();
}

/** Clears in-memory battle and campaign session (used after wiping save data). */
function resetSessionAfterGameDataReset() {
  hideTurnPanel();
  clearLog();
  state.teamA = [];
  state.teamB = [];
  state.snapshotParty = null;
  state.snapshotEnemy = null;
  state.round = 0;
  state.finished = false;
  state.winner = null;
  state.mode = "idle";
  state.campaignStage = null;
  state.turnQueue = [];
  state.turnIndex = 0;
  state.battleTargetEnemyId = null;
  state.battleActingKey = null;
  state.battleAutoPlay = false;
  state.lastCampaignRewards = null;
  state.battleVanishedKeys = new Set();
  setBanner("");
  hideBattleWinUI();
  hideBattleDefeatUI();
  syncBattleAutoToggleUI();
  renderTeams();
}

function refreshAllUIFromSave() {
  renderGoldBar();
  renderSummonScrollBar();
  renderCharacterBox();
  renderCampaignLevels();
  renderSummonRoster();
  updateShopCupidButton();
  updateShopScrollButton();
  updateShopLegendScrollButton();
  updateShopXpScrollButton();
  updateSummonPullButton();
  renderShopCupidStats();
  renderQuests();
  renderXpScrollPanel();
  renderPrayPanel();
  const summonBox = el("summon-result");
  if (summonBox) summonBox.innerHTML = "";
  const shopBox = el("shop-cupid-result");
  if (shopBox) shopBox.innerHTML = "";
}

function renderGoldBar() {
  const node = el("topbar-gold");
  if (node) {
    const g = getGold();
    node.textContent = `GOLD: ${g.toLocaleString()}`;
  }
}

function renderSummonScrollBar() {
  const node = el("topbar-scrolls");
  if (node) {
    const s = getSummonScrolls();
    const l = getLegendScrolls();
    const x = getXpScrolls();
    node.textContent = `Summon scrolls: ${s.toLocaleString()} · Legend scrolls: ${l.toLocaleString()} · XP scrolls: ${x.toLocaleString()}`;
  }
  updateBoxNavIndicator();
}

function updateSummonPullButton() {
  const pull = el("btn-summon-pull");
  if (!pull) return;
  const n = getSummonScrolls();
  pull.disabled = n < 1 || state.summonAnimRunning;
  pull.textContent = "Summon (1 scroll)";
  pull.title =
    n >= 1
      ? "Uses 1 summon scroll for one random gacha pull."
      : "You need at least 1 summon scroll (campaign drops or Shop).";
  const leg = el("btn-summon-legend-pull");
  if (leg) {
    const ln = getLegendScrolls();
    leg.disabled = ln < 1 || state.summonAnimRunning;
    leg.textContent = "Legend summon (1 legend scroll)";
    leg.title =
      ln >= 1
        ? "Uses 1 legend scroll — Epic or Legendary only (Legendary is still rare)."
        : "Buy legend scrolls in the Shop (10,000 gold each).";
  }
  const skip = el("btn-summon-skip");
  if (skip) {
    skip.disabled = !state.summonAnimRunning;
  }
  updateSummonNavIndicator();
}

function hasAvailableSummons() {
  return getSummonScrolls() > 0 || getLegendScrolls() > 0;
}

function updateSummonNavIndicator() {
  const btn = el("nav-summon");
  if (!btn) return;
  const active = hasAvailableSummons();
  btn.classList.toggle("hub-btn--notify", active);
  btn.setAttribute(
    "title",
    active
      ? "Summon available — you have scrolls ready to use."
      : "Open summon screen."
  );
}

function hasAvailableXpScrolls() {
  return getXpScrolls() > 0;
}

function updateBoxNavIndicator() {
  const btn = el("nav-box");
  if (!btn) return;
  const active = hasAvailableXpScrolls();
  btn.classList.toggle("hub-btn--notify", active);
  btn.setAttribute(
    "title",
    active
      ? "XP scroll available — open Inventory to use it."
      : "Open Inventory (heroes and party)."
  );
}

function dailyPrayMsRemaining(now = Date.now()) {
  const last = getDailyPrayLastClaimAt();
  if (!last) return 0;
  return Math.max(0, DAILY_PRAY_COOLDOWN_MS - (now - last));
}

function formatMsClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function rollDailyPrayReward() {
  const total = DAILY_PRAY_REWARDS.reduce((sum, r) => sum + r.weight, 0);
  let pick = Math.random() * total;
  for (const reward of DAILY_PRAY_REWARDS) {
    pick -= reward.weight;
    if (pick <= 0) return reward;
  }
  return DAILY_PRAY_REWARDS[DAILY_PRAY_REWARDS.length - 1];
}

function renderPrayWheelItems() {
  const box = el("pray-wheel-items");
  if (!box) return;
  const step = 360 / DAILY_PRAY_REWARDS.length;
  box.innerHTML = DAILY_PRAY_REWARDS.map((reward, idx) => {
    const angle = idx * step;
    return `<div class="pray-wheel-item" style="--item-angle:${angle}deg"><span class="pray-wheel-item-label">${escapeHtml(reward.wheelLabel || reward.label)}</span></div>`;
  }).join("");
}

function renderPrayPanel() {
  const btn = el("btn-pray-spin");
  const cd = el("pray-cooldown");
  if (!btn || !cd) return;
  renderPrayWheelItems();
  const left = dailyPrayMsRemaining();
  const ready = left <= 0;
  btn.disabled = !ready || state.praySpinRunning;
  cd.textContent = ready
    ? "Daily blessing ready."
    : `Next prayer in ${formatMsClock(left)}.`;
}

async function doDailyPraySpin() {
  if (state.praySpinRunning) return;
  const left = dailyPrayMsRemaining();
  if (left > 0) {
    renderPrayPanel();
    return;
  }
  const wheel = el("pray-wheel");
  const result = el("pray-result");
  if (!wheel || !result) return;
  state.praySpinRunning = true;
  renderPrayPanel();
  result.textContent = "";

  const reward = rollDailyPrayReward();
  const rewardIdx = DAILY_PRAY_REWARDS.findIndex((r) => r.id === reward.id);
  const sliceCount = Math.max(1, DAILY_PRAY_REWARDS.length);
  const step = 360 / sliceCount;
  const extraTurns = 4 + Math.floor(Math.random() * 3);
  const targetAngle = ((360 - rewardIdx * step) % 360 + 360) % 360;
  const jitter = (Math.random() - 0.5) * step * 0.64;
  const stopDeg = 360 * extraTurns + targetAngle + jitter;
  wheel.style.setProperty("--pray-spin-deg", `${stopDeg}deg`);
  wheel.classList.remove("pray-wheel--spinning");
  // Restart wheel animation cleanly.
  void wheel.offsetWidth;
  wheel.classList.add("pray-wheel--spinning");
  await new Promise((resolve) => setTimeout(resolve, 2800));
  wheel.classList.remove("pray-wheel--spinning");

  reward.apply();
  setDailyPrayLastClaimAt(Date.now());
  result.textContent = `Blessing received: ${reward.label}`;
  renderGoldBar();
  renderSummonScrollBar();
  updateSummonPullButton();
  updateShopScrollButton();
  updateShopLegendScrollButton();
  updateShopXpScrollButton();
  renderXpScrollPanel();
  state.praySpinRunning = false;
  renderPrayPanel();
}

function updateShopScrollButton() {
  const btn = el("btn-shop-scroll");
  if (!btn) return;
  const g = getGold();
  btn.disabled = g < SCROLL_SHOP_COST;
  btn.textContent = `Buy (${SCROLL_SHOP_COST.toLocaleString()} gold)`;
  btn.title =
    g >= SCROLL_SHOP_COST
      ? "Adds 1 summon scroll to your inventory."
      : `Need ${SCROLL_SHOP_COST.toLocaleString()} gold (you have ${g.toLocaleString()}).`;
}

function updateShopLegendScrollButton() {
  const btn = el("btn-shop-legend-scroll");
  if (!btn) return;
  const g = getGold();
  btn.disabled = g < LEGEND_SCROLL_SHOP_COST;
  btn.textContent = `Buy (${LEGEND_SCROLL_SHOP_COST.toLocaleString()} gold)`;
  btn.title =
    g >= LEGEND_SCROLL_SHOP_COST
      ? "Adds 1 legend scroll — Summon screen: guaranteed Epic or Legendary (Legendary roll is still uncommon)."
      : `Need ${LEGEND_SCROLL_SHOP_COST.toLocaleString()} gold (you have ${g.toLocaleString()}).`;
}

function updateShopXpScrollButton() {
  const btn = el("btn-shop-xp-scroll");
  if (!btn) return;
  const g = getGold();
  btn.disabled = g < XP_SCROLL_SHOP_COST;
  btn.textContent = `Buy (${XP_SCROLL_SHOP_COST.toLocaleString()} gold)`;
  btn.title =
    g >= XP_SCROLL_SHOP_COST
      ? "Adds 1 XP scroll (use in Character Box for +100 XP on one party hero)."
      : `Need ${XP_SCROLL_SHOP_COST.toLocaleString()} gold (you have ${g.toLocaleString()}).`;
}

function purchaseSummonScroll() {
  if (!trySpendGold(SCROLL_SHOP_COST)) {
    globalThis.alert(
      `Not enough gold. A summon scroll costs ${SCROLL_SHOP_COST.toLocaleString()} gold (you have ${getGold().toLocaleString()}).`
    );
    return;
  }
  addSummonScrolls(1);
  const box = el("shop-scroll-feedback");
  if (box) {
    box.textContent = "+1 summon scroll added.";
    box.classList.add("shop-inline-feedback--ok");
  }
  renderGoldBar();
  renderSummonScrollBar();
  updateShopScrollButton();
  updateShopLegendScrollButton();
  updateSummonPullButton();
}

function purchaseLegendScroll() {
  if (!trySpendGold(LEGEND_SCROLL_SHOP_COST)) {
    globalThis.alert(
      `Not enough gold. A legend scroll costs ${LEGEND_SCROLL_SHOP_COST.toLocaleString()} gold (you have ${getGold().toLocaleString()}).`
    );
    return;
  }
  addLegendScrolls(1);
  const box = el("shop-legend-scroll-feedback");
  if (box) {
    box.textContent = "+1 legend scroll added.";
    box.classList.add("shop-inline-feedback--ok");
  }
  renderGoldBar();
  renderSummonScrollBar();
  updateShopScrollButton();
  updateShopLegendScrollButton();
  updateShopXpScrollButton();
  updateSummonPullButton();
}

function purchaseXpScroll() {
  if (!trySpendGold(XP_SCROLL_SHOP_COST)) {
    globalThis.alert(
      `Not enough gold. An XP scroll costs ${XP_SCROLL_SHOP_COST.toLocaleString()} gold (you have ${getGold().toLocaleString()}).`
    );
    return;
  }
  addXpScrolls(1);
  const box = el("shop-xp-scroll-feedback");
  if (box) {
    box.textContent = "+1 XP scroll added.";
    box.classList.add("shop-inline-feedback--ok");
  }
  renderGoldBar();
  renderSummonScrollBar();
  updateShopScrollButton();
  updateShopLegendScrollButton();
  updateShopXpScrollButton();
  updateSummonPullButton();
  renderXpScrollPanel();
}

function updateShopCupidButton() {
  const btn = el("btn-shop-cupid");
  if (!btn) return;
  const owned = getCollection().includes(CUPID_HERO_ID);
  const g = getGold();
  if (owned) {
    btn.disabled = true;
    btn.textContent = "Owned";
    btn.title = "Cupid is already in your collection.";
  } else {
    btn.disabled = g < CUPID_SHOP_COST;
    btn.textContent = `Buy (${CUPID_SHOP_COST.toLocaleString()} gold)`;
    btn.title =
      g >= CUPID_SHOP_COST
        ? "Add Cupid to your roster permanently."
        : `Need ${CUPID_SHOP_COST.toLocaleString()} gold (you have ${g.toLocaleString()}).`;
  }
}

function purchaseCupid() {
  if (getCollection().includes(CUPID_HERO_ID)) {
    globalThis.alert("You already own Cupid.");
    return;
  }
  if (!trySpendGold(CUPID_SHOP_COST)) {
    globalThis.alert(
      `Not enough gold. Cupid costs ${CUPID_SHOP_COST.toLocaleString()} gold (you have ${getGold().toLocaleString()}).`
    );
    return;
  }
  addHeroToCollection(CUPID_HERO_ID);
  markHeroAsNew(CUPID_HERO_ID);
  const def = getHeroDefById(CUPID_HERO_ID);
  const box = el("shop-cupid-result");
  if (box && def) {
    box.innerHTML = buildSummonResultCardHtml(def, {
      id: CUPID_HERO_ID,
      isNew: true,
    });
  }
  renderCharacterBox();
  renderSummonRoster();
  renderGoldBar();
  updateShopCupidButton();
  updateShopScrollButton();
  updateShopLegendScrollButton();
  updateShopXpScrollButton();
}

function grantCampaignRewards(stageNum) {
  const lvl = CAMPAIGN_LEVELS.find((l) => l.level === stageNum);
  const r = lvl?.rewards;
  if (!r) {
    state.lastBattleXpAnim = [];
    return {
      gold: 0,
      partyXpEach: 0,
      scrollDropped: false,
    };
  }
  const party = getBattleParty();
  const xpBefore = party.map((id) => ({ id, ...getHeroProgress(id) }));
  addGold(r.gold);
  const partyCount = Math.max(1, party.length);
  const xpEach = Math.floor((r.partyXpEach || 0) / partyCount);
  for (const id of party) {
    addHeroXp(id, xpEach);
  }
  const xpAfterById = new Map(
    party.map((id) => [id, getHeroProgress(id)])
  );
  state.lastBattleXpAnim = xpBefore.map((b) => ({
    id: b.id,
    beforeLevel: b.level,
    beforeXp: b.xp,
    afterLevel: xpAfterById.get(b.id)?.level ?? b.level,
    afterXp: xpAfterById.get(b.id)?.xp ?? b.xp,
  }));
  let scrollDropped = false;
  if (r.scrollDropChance > 0 && Math.random() < r.scrollDropChance) {
    addSummonScrolls(1);
    scrollDropped = true;
  }
  return {
    gold: r.gold,
    partyXpEach: xpEach,
    scrollDropped,
  };
}

function renderQuests() {
  const mount = el("quest-list");
  if (!mount) return;
  mount.innerHTML = QUESTS.map((q) => {
    const s = getQuestState(q.id);
    const status = s.claimed
      ? "Claimed"
      : s.completed
        ? "Complete"
        : "In progress";
    const disabled = s.claimed || !s.completed ? "disabled" : "";
    const btnText = s.claimed ? "Claimed" : s.completed ? "Claim reward" : "Not ready";
    return `<article class="quest-card" role="listitem">
      <h3 class="quest-title">${escapeHtml(q.title)}</h3>
      <p class="quest-desc">${escapeHtml(q.desc)}</p>
      <p class="quest-reward">Reward: ${escapeHtml(q.rewardLabel)}</p>
      <div class="quest-actions">
        <span class="quest-status">${escapeHtml(status)}</span>
        <button type="button" class="btn primary quest-claim-btn" data-quest-id="${escapeHtml(q.id)}" ${disabled}>${escapeHtml(btnText)}</button>
      </div>
    </article>`;
  }).join("");
  updateQuestNavIndicator();
}

function completeQuest(questId) {
  setQuestCompleted(questId);
  renderQuests();
}

function hasUnclaimedQuestRewards() {
  return QUESTS.some((q) => {
    const s = getQuestState(q.id);
    return s.completed && !s.claimed;
  });
}

function updateQuestNavIndicator() {
  const btn = el("nav-quests");
  if (!btn) return;
  const active = hasUnclaimedQuestRewards();
  btn.classList.toggle("hub-btn--notify", active);
  btn.setAttribute(
    "title",
    active ? "Quest reward ready to claim." : "View first-clear quests."
  );
}

function hideCampaignLineupOverlay() {
  const overlay = el("campaign-lineup-overlay");
  if (!overlay) return;
  overlay.classList.add("is-hidden");
  overlay.setAttribute("aria-hidden", "true");
}

function hideCampaignRewardsModal() {
  const overlay = el("campaign-rewards-overlay");
  if (!overlay) return;
  overlay.classList.add("is-hidden");
  overlay.setAttribute("aria-hidden", "true");
}

function campaignRewardsModalInnerHtml(lvl) {
  const rw = lvl.rewards;
  const blurbP = `<p class="campaign-rewards-flavor">${escapeHtml(lvl.blurb)}</p>`;
  if (!rw) {
    return `${blurbP}<p class="campaign-rewards-missing">No reward data.</p>`;
  }
  const pct = Math.round(rw.scrollDropChance * 100);
  return `${blurbP}
    <p class="campaign-rewards-heading">First clear</p>
    <ul class="campaign-rewards-list">
      <li><strong>${rw.gold.toLocaleString()}</strong> gold</li>
      <li><strong>${rw.partyXpEach}</strong> XP to each hero in your battle party</li>
      <li><strong>${pct}%</strong> chance of a summon scroll drop</li>
    </ul>`;
}

function showCampaignRewardsModal(levelIndex) {
  const lvl = CAMPAIGN_LEVELS[levelIndex];
  if (!lvl) return;
  const overlay = el("campaign-rewards-overlay");
  const title = el("campaign-rewards-title");
  const body = el("campaign-rewards-body");
  if (!overlay || !title || !body) return;
  title.textContent = `Stage ${lvl.level} — ${lvl.title}`;
  body.innerHTML = campaignRewardsModalInnerHtml(lvl);
  overlay.classList.remove("is-hidden");
  overlay.setAttribute("aria-hidden", "false");
}

function enemyLineupHtml(lvl) {
  if (!lvl?.enemies?.length) {
    return `<p class="lineup-item-empty">No enemy data.</p>`;
  }
  const enemyLevel = Math.max(1, Number(lvl.level) || 1);
  return lvl.enemies
    .map((u) => {
      const name = escapeHtml(u.name || "Enemy");
      const rarity = escapeHtml(u.rarity || "Common");
      return `<div class="lineup-item">
        <div class="lineup-item-main">
          <p class="lineup-item-name">${name}</p>
          <p class="lineup-item-sub">${rarity} · Lv ${enemyLevel}</p>
        </div>
      </div>`;
    })
    .join("");
}

function renderCampaignLineupPartyList() {
  const mount = el("campaign-lineup-party-list");
  if (!mount) return;
  const ids = [...getCollection()].sort((a, b) => {
    const lvA = getHeroProgress(a).level;
    const lvB = getHeroProgress(b).level;
    if (lvB !== lvA) return lvB - lvA;
    const nameA = getHeroDefById(a)?.name || a;
    const nameB = getHeroDefById(b)?.name || b;
    return nameA.localeCompare(nameB);
  });
  const party = getBattleParty();
  if (!ids.length) {
    mount.innerHTML = `<p class="lineup-item-empty">No heroes owned yet.</p>`;
    return;
  }
  mount.innerHTML = ids
    .map((id) => {
      const def = getHeroDefById(id);
      if (!def) return "";
      const inParty = party.includes(id);
      const lv = getHeroProgress(id).level;
      return `<label class="lineup-item">
        <div class="lineup-item-main">
          <p class="lineup-item-name">${escapeHtml(def.name)}</p>
          <p class="lineup-item-sub">${escapeHtml(def.rarity)} · Lv ${lv}</p>
        </div>
        <input type="checkbox" class="lineup-item-choose" data-hero-id="${escapeHtml(id)}" ${
          inParty ? "checked" : ""
        } />
      </label>`;
    })
    .join("");
}

function openCampaignLineupOverlay(levelIndex) {
  const lvl = CAMPAIGN_LEVELS[levelIndex];
  if (!lvl || !isStageUnlocked(lvl.level)) return;
  hideCampaignRewardsModal();
  state.pendingCampaignLevelIndex = levelIndex;
  const overlay = el("campaign-lineup-overlay");
  const stage = el("campaign-lineup-stage");
  const enemies = el("campaign-lineup-enemy-list");
  if (!overlay || !stage || !enemies) return;
  stage.textContent = `Stage ${lvl.level} — ${lvl.title}`;
  enemies.innerHTML = enemyLineupHtml(lvl);
  renderCampaignLineupPartyList();
  overlay.classList.remove("is-hidden");
  overlay.setAttribute("aria-hidden", "false");
}

function heroCombatStatsHtml(heroId) {
  const def = getHeroDefById(heroId);
  if (!def) return "";
  const { level } = getHeroProgress(heroId);
  const unit = applyLevelScaling(heroToGameUnit(def), level);
  const hp = statWhole(unit.maxHp ?? unit.hp);
  const atk = statWhole(unit.attack);
  const defn = statWhole(unit.defense);
  const spd = statWhole(unit.speed);
  return `<div class="hero-combat-stats" aria-label="Combat stats (includes level scaling)">
    <span class="hero-stat-pill"><span class="hero-stat-label">HP</span> ${escapeHtml(String(hp))}</span>
    <span class="hero-stat-pill"><span class="hero-stat-label">ATK</span> ${escapeHtml(String(atk))}</span>
    <span class="hero-stat-pill"><span class="hero-stat-label">DEF</span> ${escapeHtml(String(defn))}</span>
    <span class="hero-stat-pill"><span class="hero-stat-label">SPD</span> ${escapeHtml(String(spd))}</span>
  </div>`;
}

/** Level 1 base stats for summon pool, shop listings, and result previews. */
function heroBaseStatsFromDefHtml(def) {
  if (!def) return "";
  const unit = applyLevelScaling(heroToGameUnit(def), 1);
  const hp = statWhole(unit.maxHp ?? unit.hp);
  const atk = statWhole(unit.attack);
  const defn = statWhole(unit.defense);
  const spd = statWhole(unit.speed);
  return `<div class="hero-combat-stats hero-combat-stats--compact" aria-label="Base stats at level 1">
    <span class="hero-stat-pill"><span class="hero-stat-label">HP</span> ${escapeHtml(String(hp))}</span>
    <span class="hero-stat-pill"><span class="hero-stat-label">ATK</span> ${escapeHtml(String(atk))}</span>
    <span class="hero-stat-pill"><span class="hero-stat-label">DEF</span> ${escapeHtml(String(defn))}</span>
    <span class="hero-stat-pill"><span class="hero-stat-label">SPD</span> ${escapeHtml(String(spd))}</span>
  </div>`;
}

function renderShopCupidStats() {
  const mount = el("shop-cupid-stats");
  if (!mount) return;
  const def = getHeroDefById(CUPID_HERO_ID);
  if (!def) {
    mount.innerHTML = "";
    return;
  }
  const unit = applyLevelScaling(heroToGameUnit(def), 1);
  const hp = statWhole(unit.maxHp ?? unit.hp);
  mount.innerHTML = `<p class="shop-cupid-stats-line">${escapeHtml(String(hp))} HP · ${escapeHtml(String(statWhole(unit.attack)))} ATK · ${escapeHtml(String(statWhole(unit.defense)))} DEF · ${escapeHtml(String(statWhole(unit.speed)))} SPD</p>`;
}

function heroXpRowHtml(heroId) {
  const { level, xp } = getHeroProgress(heroId);
  if (level >= MAX_HERO_LEVEL) {
    return `<div class="hero-xp-block" aria-label="Experience">
      <div class="hero-xp-meta"><span class="hero-level-tag">Lv. ${MAX_HERO_LEVEL}</span><span class="hero-xp-cap">MAX</span></div>
    </div>`;
  }
  const need = xpRequiredForLevelUp(level);
  const pct = need > 0 ? Math.min(100, (100 * xp) / need) : 0;
  return `<div class="hero-xp-block" aria-label="Experience">
    <div class="hero-xp-meta"><span class="hero-level-tag">Lv. ${level}</span><span class="hero-xp-numbers">${xp} / ${need} XP</span></div>
    <div class="hero-xp-bar" style="--xp-pct:${pct}%"></div>
  </div>`;
}

function resetAllGameData() {
  const msg =
    "Reset ALL saved data? You will keep only the starter heroes (Perseus and Aethra), " +
    "campaign progress and summons will be cleared. This cannot be undone.";
  if (!globalThis.confirm(msg)) return;
  resetPersistedProgress();
  resetSummonPersistence();
  resetSessionAfterGameDataReset();
  refreshAllUIFromSave();
  const feedback = el("settings-reset-feedback");
  if (feedback) {
    feedback.textContent = "Game data was reset.";
    feedback.classList.add("settings-feedback--ok");
  }
}

function hideBattleWinUI() {
  const overlay = el("battle-win-overlay");
  if (!overlay) return;
  overlay.classList.add("is-hidden");
  overlay.setAttribute("aria-hidden", "true");
}

function hideBattleDefeatUI() {
  const overlay = el("battle-defeat-overlay");
  if (!overlay) return;
  overlay.classList.add("is-hidden");
  overlay.setAttribute("aria-hidden", "true");
}

function showBattleDefeatUI() {
  hideBattleWinUI();
  const overlay = el("battle-defeat-overlay");
  const stageEl = el("battle-defeat-stage");
  const bodyEl = el("battle-defeat-body");
  const titleEl = el("battle-defeat-title");
  if (!overlay || !stageEl || !bodyEl) return;
  const stage = state.campaignStage;
  if (stage == null) return;
  const lvl = CAMPAIGN_LEVELS.find((l) => l.level === stage);
  if (titleEl) titleEl.textContent = "Defeat";
  stageEl.textContent = lvl
    ? `${lvl.title} (Stage ${stage})`
    : `Stage ${stage}`;
  bodyEl.textContent =
    "Your party was defeated. Tweak your party, levels, and tactics — then try again.";
  overlay.classList.remove("is-hidden");
  overlay.setAttribute("aria-hidden", "false");
}

function handleCampaignDefeat() {
  if (state.campaignStage == null) return;
  setBanner(`${GAME_META.teamBLabel} win — stage failed`, "defeat");
  showBattleDefeatUI();
}

function showBattleWinUI() {
  hideBattleDefeatUI();
  const overlay = el("battle-win-overlay");
  const stageEl = el("battle-win-stage");
  const bodyEl = el("battle-win-body");
  const titleEl = el("battle-win-title");
  const rewardsEl = el("battle-win-rewards");
  const xpListEl = el("battle-win-xp-list");
  if (!overlay || !stageEl || !bodyEl) return;
  const stage = state.campaignStage;
  if (stage == null) return;
  const lvl = CAMPAIGN_LEVELS.find((l) => l.level === stage);
  if (titleEl) {
    titleEl.textContent = stage === 10 ? "Victory — campaign complete!" : "Victory";
  }
  stageEl.textContent = lvl
    ? `${lvl.title} (Stage ${stage})`
    : `Stage ${stage} cleared`;
  bodyEl.textContent = lvl
    ? lvl.blurb
    : "Your progress has been saved.";
  if (rewardsEl) {
    const rw = state.lastCampaignRewards;
    if (
      rw &&
      (rw.gold > 0 || rw.partyXpEach > 0 || rw.scrollDropped)
    ) {
      const parts = [];
      if (rw.gold > 0) {
        parts.push(`<li>+<strong>${rw.gold}</strong> gold</li>`);
      }
      if (rw.partyXpEach > 0) {
        parts.push(
          `<li>+<strong>${rw.partyXpEach}</strong> XP per hero (split across current battle party)</li>`
        );
      }
      if (rw.scrollDropped) {
        parts.push(
          `<li class="battle-win-bonus-scroll">+<strong>1</strong> summon scroll</li>`
        );
      }
      rewardsEl.innerHTML = `<p class="battle-win-rewards-heading">Rewards</p><ul class="battle-win-rewards-list">${parts.join("")}</ul>`;
    } else {
      rewardsEl.innerHTML = "";
    }
  }
  if (xpListEl) {
    const rows = state.lastBattleXpAnim || [];
    if (!rows.length) {
      xpListEl.innerHTML = "";
    } else {
      xpListEl.innerHTML = rows
        .map((r, idx) => {
          const def = getHeroDefById(r.id);
          const name = escapeHtml(def?.name || r.id);
          const maxed = r.afterLevel >= MAX_HERO_LEVEL;
          const startNeed = xpRequiredForLevelUp(r.beforeLevel);
          const startPct = maxed
            ? 100
            : startNeed > 0
              ? Math.min(100, Math.round((100 * r.beforeXp) / startNeed))
              : 0;
          const initialNums = maxed
            ? `Lv ${MAX_HERO_LEVEL} · MAX`
            : `Lv ${r.beforeLevel} · ${r.beforeXp} / ${startNeed} XP`;
          return `<div class="battle-win-xp-row${maxed ? " battle-win-xp-row--max" : ""}" data-xp-row="${idx}">
            <div class="battle-win-xp-meta">
              <span class="battle-win-xp-name">${name}</span>
              <span class="battle-win-xp-numbers" data-xp-numbers="${idx}">${escapeHtml(initialNums)}</span>
            </div>
            <div class="battle-win-xp-bar"><div class="battle-win-xp-fill" data-xp-fill="${idx}" style="width:${startPct}%"></div></div>
          </div>`;
        })
        .join("");
      const STEP_MS = 160;
      const queue = [];
      rows.forEach((r, idx) => {
        if (r.afterLevel >= MAX_HERO_LEVEL) {
          queue.push({
            idx,
            level: MAX_HERO_LEVEL,
            xp: 0,
            need: 1,
            pct: 100,
            maxed: true,
          });
          return;
        }
        let level = r.beforeLevel;
        let xp = r.beforeXp;
        while (level < r.afterLevel) {
          const need = Math.max(1, xpRequiredForLevelUp(level));
          queue.push({ idx, level, xp: need, need, pct: 100, maxed: false });
          level += 1;
          xp = 0;
          const nextNeed = Math.max(1, xpRequiredForLevelUp(level));
          queue.push({ idx, level, xp: 0, need: nextNeed, pct: 0, maxed: false });
        }
        const need = Math.max(1, xpRequiredForLevelUp(level));
        const pct = Math.min(100, Math.round((100 * r.afterXp) / need));
        queue.push({
          idx,
          level,
          xp: r.afterXp,
          need,
          pct,
          maxed: false,
        });
      });
      queue.forEach((step, i) => {
        setTimeout(() => {
          const fill = xpListEl.querySelector(`[data-xp-fill="${step.idx}"]`);
          const nums = xpListEl.querySelector(`[data-xp-numbers="${step.idx}"]`);
          if (fill) fill.style.width = `${step.pct}%`;
          if (nums) {
            nums.textContent = step.maxed
              ? `Lv ${MAX_HERO_LEVEL} · MAX`
              : `Lv ${step.level} · ${step.xp} / ${step.need} XP`;
          }
        }, i * STEP_MS + 80);
      });
    }
  }
  overlay.classList.remove("is-hidden");
  overlay.setAttribute("aria-hidden", "false");
}

function handleCampaignWin() {
  if (state.campaignStage == null) return;
  const stage = state.campaignStage;
  setCampaignMaxBeat(stage);
  const wins = incrementCampaignWinCount();
  if (wins >= 3) {
    completeQuest(QUEST_WIN_3_BATTLES);
  }
  if (stage >= 5) {
    completeQuest(QUEST_DEFEAT_HERACLES);
  }
  if (stage >= 10) {
    completeQuest(QUEST_DEFEAT_HADES);
    completeQuest(QUEST_CLEAR_STAGE_10);
  }
  state.lastCampaignRewards = grantCampaignRewards(stage);
  setBanner(`Stage ${stage} cleared!`, "winner");
  renderGoldBar();
  renderSummonScrollBar();
  updateSummonPullButton();
  updateShopXpScrollButton();
  showBattleWinUI();
}

function syncWinCountQuestProgress() {
  if (getCampaignWinCount() >= 3) {
    setQuestCompleted(QUEST_WIN_3_BATTLES);
  }
}

function runAutoBattle() {
  if (!state.snapshotParty?.length || !state.snapshotEnemy?.length) return;
  hideTurnPanel();
  clearLog();
  state.battleTargetEnemyId = null;
  const useAiSkills = getCombatOpts().useSkills;
  const teamA = cloneTeam(state.snapshotParty);
  const teamB = cloneTeam(state.snapshotEnemy);
  prepareTeams(teamA, teamB);

  let round = 0;
  while (!teamWiped(teamA) && !teamWiped(teamB)) {
    round += 1;
    for (const u of [...teamA, ...teamB]) {
      tickSkillCooldowns(u);
      tickSpeedBuffRound(u);
    }
    appendLogLine(
      `<strong>Round ${round}</strong> — turns by SPD (highest first)`
    );

    const queue = [...teamA, ...teamB]
      .filter(isAlive)
      .sort((a, b) => effectiveUnitSpeed(b) - effectiveUnitSpeed(a) || a._order - b._order);

    for (const actor of queue) {
      if (!isAlive(actor) || teamWiped(teamA) || teamWiped(teamB)) continue;
      if (isUnitStunned(actor)) {
        tickStunRound(actor);
        appendLogLine(
          `<span class="tag skill-use">Stunned</span> ${escapeHtml(actor.name)} loses the turn.`
        );
        continue;
      }
      const skill = pickAiSkill(actor, useAiSkills);
      const act = executeSingleAction(actor, skill, teamA, teamB);
      if (act) logActionLine(act);
    }
  }

  state.teamA = teamA;
  state.teamB = teamB;
  state.mode = "auto-done";
  state.finished = true;
  state.winner = teamWiped(teamA) ? "B" : "A";
  renderTeams();
  if (state.winner === "A" && state.campaignStage != null) {
    handleCampaignWin();
  } else if (state.winner === "B" && state.campaignStage != null) {
    handleCampaignDefeat();
  } else {
    setBanner(
      state.winner === "A"
        ? `${GAME_META.teamALabel} win`
        : `${GAME_META.teamBLabel} win`,
      "winner"
    );
  }
}

function checkBattleEndAfterAction() {
  if (teamWiped(state.teamA)) {
    state.finished = true;
    state.winner = "B";
    hideTurnPanel();
    if (state.campaignStage != null) {
      handleCampaignDefeat();
    } else {
      setBanner(`${GAME_META.teamBLabel} win`, "winner");
    }
    return true;
  }
  if (teamWiped(state.teamB)) {
    state.finished = true;
    state.winner = "A";
    hideTurnPanel();
    setBanner(`${GAME_META.teamALabel} win`, "winner");
    if (state.campaignStage != null) handleCampaignWin();
    return true;
  }
  return false;
}

function beginNewRoundTurnBattle() {
  if (state.mode !== "turn" || state.finished) return;
  if (teamWiped(state.teamA) || teamWiped(state.teamB)) {
    checkBattleEndAfterAction();
    return;
  }

  state.round += 1;
  for (const u of [...state.teamA, ...state.teamB]) {
    tickSkillCooldowns(u);
    tickSpeedBuffRound(u);
  }
  appendLogLine(`<strong>Round ${state.round}</strong> — turns by SPD (highest first)`);

  state.turnQueue = [...state.teamA, ...state.teamB]
    .filter(isAlive)
    .sort((a, b) => effectiveUnitSpeed(b) - effectiveUnitSpeed(a) || a._order - b._order);
  if (state.turnQueue.length === 0) {
    checkBattleEndAfterAction();
    return;
  }
  state.turnIndex = 0;
  processTurnStep();
}

function processTurnStep() {
  renderTeams();
  if (state.mode !== "turn" || state.finished) return;

  if (teamWiped(state.teamA) || teamWiped(state.teamB)) {
    checkBattleEndAfterAction();
    return;
  }

  if (state.turnIndex >= state.turnQueue.length) {
    beginNewRoundTurnBattle();
    return;
  }

  const actor = state.turnQueue[state.turnIndex];
  if (!isAlive(actor)) {
    state.turnIndex += 1;
    processTurnStep();
    return;
  }
  if (isUnitStunned(actor)) {
    tickStunRound(actor);
    appendLogLine(
      `<span class="tag skill-use">Stunned</span> ${escapeHtml(actor.name)} loses the turn.`
    );
    state.turnIndex += 1;
    processTurnStep();
    return;
  }

  if (actor.team === "A") {
    if (state.battleAutoPlay) {
      ensureAutoBattleTarget();
      runPlayerAutoTurn(actor);
      return;
    }
    showPlayerTurnUI(actor);
    return;
  }

  void runEnemyTurnAnimation(actor);
}

function runEnemyTurnAnimation(actor) {
  const skill = pickAiSkill(actor, true);
  const plan = planSingleAction(actor, skill, state.teamA, state.teamB, null);
  if (!plan) {
    state.turnIndex += 1;
    processTurnStep();
    return;
  }
  const bi = state.teamB.indexOf(actor);
  const ti = state.teamA.indexOf(plan.target);
  void (async () => {
    if (bi >= 0 && ti >= 0) {
      await playBattleAttackAnimation("B", bi, "A", ti, plan.preview);
    }
    const act = applyPlannedAction(
      actor,
      plan.useSkill,
      plan.target,
      plan.preview,
      { teamA: state.teamA, teamB: state.teamB }
    );
    if (act) logActionLine(act);
    scheduleVanishAndProcessTurn(act, plan);
  })();
}

function runPlayerAutoTurn(actor) {
  const skill = pickAiSkill(actor, true);
  const plan = planSingleAction(
    actor,
    skill,
    state.teamA,
    state.teamB,
    state.battleTargetEnemyId
  );
  if (!plan) {
    state.turnIndex += 1;
    processTurnStep();
    return;
  }
  const aIdx = state.teamA.indexOf(actor);
  const tIdx = state.teamB.indexOf(plan.target);
  void (async () => {
    if (aIdx >= 0 && tIdx >= 0) {
      await playBattleAttackAnimation("A", aIdx, "B", tIdx, plan.preview);
    } else {
      const actOnly = applyPlannedAction(
        actor,
        plan.useSkill,
        plan.target,
        plan.preview,
        { teamA: state.teamA, teamB: state.teamB }
      );
      if (actOnly) logActionLine(actOnly);
      scheduleVanishAndProcessTurn(actOnly, plan);
      return;
    }
    const act = applyPlannedAction(
      actor,
      plan.useSkill,
      plan.target,
      plan.preview,
      { teamA: state.teamA, teamB: state.teamB }
    );
    if (act) logActionLine(act);
    scheduleVanishAndProcessTurn(act, plan);
  })();
}

function getBattleCardMotion(side, index) {
  return document.querySelector(
    `#screen-battle .unit-card[data-side="${side}"][data-index="${index}"] .unit-card-motion`
  );
}

function setBattleSpriteMode(motionEl, mode) {
  const aethra = motionEl?.querySelector(".battle-sprite--aethra");
  if (aethra) {
    const walk = mode === "walk";
    aethra.classList.toggle("battle-sprite--walk", walk);
    aethra.classList.toggle("battle-sprite--idle", !walk);
  }
  const hermes = motionEl?.querySelector(".battle-sprite--hermes");
  if (hermes) {
    const walk = mode === "walk";
    hermes.classList.toggle("battle-sprite--walk", walk);
    hermes.classList.toggle("battle-sprite--idle", !walk);
  }
  const heracles = motionEl?.querySelector(".battle-sprite--heracles");
  if (heracles) {
    const attack = mode === "attack";
    heracles.classList.toggle("battle-sprite--attack", attack);
    heracles.classList.toggle("battle-sprite--idle", !attack);
  }
  const hades = motionEl?.querySelector(".battle-sprite--hades");
  if (hades) {
    const attack = mode === "attack";
    hades.classList.toggle("battle-sprite--attack", attack);
    hades.classList.toggle("battle-sprite--idle", !attack);
  }
}

function showBattleFloatingDamage(targetMotionEl, preview, battleScene) {
  const layer = el("battle-fx-layer");
  if (!layer || !targetMotionEl || !battleScene) return;
  const r = targetMotionEl.getBoundingClientRect();
  const sr = battleScene.getBoundingClientRect();
  const div = document.createElement("div");
  div.className = "battle-damage-pop";
  const dmg = preview.damage;
  if (dmg > 0) {
    div.textContent = `-${Math.round(dmg)}`;
  } else if (preview.skillName) {
    div.classList.add("battle-damage-pop--skill");
    div.textContent = preview.skillName;
  } else {
    div.textContent = "—";
  }
  const cx = r.left + r.width / 2 - sr.left;
  const cy = r.top + r.height * 0.2 - sr.top;
  div.style.left = `${cx}px`;
  div.style.top = `${cy}px`;
  div.style.transform = "translate(-50%, 0)";
  layer.appendChild(div);
  requestAnimationFrame(() => {
    div.classList.add("battle-damage-pop--show");
  });
  setTimeout(() => div.remove(), 920);
  if (Number(preview?.damage ?? 0) > 0) {
    targetMotionEl.classList.remove("unit-card-motion--damage-flash");
    // Restart animation cleanly for rapid multi-hit/AOE events.
    void targetMotionEl.offsetWidth;
    targetMotionEl.classList.add("unit-card-motion--damage-flash");
    setTimeout(() => {
      targetMotionEl.classList.remove("unit-card-motion--damage-flash");
    }, 300);
  }
}

function showBattleFloatingDamageForTargets(targetMotionEls, preview, battleScene) {
  if (!Array.isArray(targetMotionEls) || !targetMotionEls.length) return;
  targetMotionEls.forEach((elRef) => {
    if (elRef) showBattleFloatingDamage(elRef, preview, battleScene);
  });
}

function showBattleLightningStrike(targetMotionEl, battleScene) {
  const layer = el("battle-fx-layer");
  if (!layer || !targetMotionEl || !battleScene) return;
  const r = targetMotionEl.getBoundingClientRect();
  const sr = battleScene.getBoundingClientRect();
  const strike = document.createElement("div");
  strike.className = "battle-lightning-strike";
  const w = Math.max(46, r.width * 0.72);
  const h = Math.max(120, r.height * 1.6);
  strike.style.width = `${w}px`;
  strike.style.height = `${h}px`;
  strike.style.left = `${r.left + r.width / 2 - sr.left}px`;
  strike.style.top = `${r.top + r.height * 0.02 - sr.top}px`;
  layer.appendChild(strike);
  requestAnimationFrame(() => {
    strike.classList.add("battle-lightning-strike--show");
  });
  setTimeout(() => strike.remove(), 420);
}

function showBattleLightningForTargets(targetMotionEls, battleScene) {
  if (!Array.isArray(targetMotionEls) || !targetMotionEls.length) return;
  targetMotionEls.forEach((elRef) => {
    if (elRef) showBattleLightningStrike(elRef, battleScene);
  });
}

/**
 * Lunge attacker motion layer toward target; then show floating numbers (damage applied after).
 * @returns {Promise<void>}
 */
function playBattleAttackAnimation(fromSide, fromIdx, toSide, toIdx, preview) {
  return new Promise((resolve) => {
    const battleScene = document.querySelector("#screen-battle .battle-arena--sw");
    const motionA = getBattleCardMotion(fromSide, fromIdx);
    const motionT = getBattleCardMotion(toSide, toIdx);
    if (!motionA || !battleScene) {
      resolve();
      return;
    }
    const isSupport = preview.damage <= 0 && preview.skillName;

    if (isSupport) {
      setBattleSpriteMode(motionA, "idle");
      motionA.classList.add("unit-card-motion--pulse");
      showBattleFloatingDamage(motionT || motionA, preview, battleScene);
      setTimeout(() => {
        motionA.classList.remove("unit-card-motion--pulse");
        resolve();
      }, 520);
      return;
    }

    const isAoe = Boolean(preview?.isAoe);
    const aoeTargets = isAoe
      ? (toSide === "A" ? state.teamA : state.teamB)
          .map((unit, idx) => (isAlive(unit) ? getBattleCardMotion(toSide, idx) : null))
          .filter(Boolean)
      : [];

    if (!motionT && !aoeTargets.length) {
      setBattleSpriteMode(motionA, "idle");
      showBattleFloatingDamage(motionA, preview, battleScene);
      resolve();
      return;
    }

    const ra = motionA.getBoundingClientRect();
    const rt = motionT.getBoundingClientRect();
    const dx = rt.left + rt.width / 2 - (ra.left + ra.width / 2);
    const dy = rt.top + rt.height / 2 - (ra.top + ra.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    const pull = Math.min(0.86, Math.max(0.62, 170 / len));
    const tx = dx * pull;
    const ty = dy * pull;
    const attackerUnit = fromSide === "A" ? state.teamA[fromIdx] : state.teamB[fromIdx];
    const attackerUsesRunSprite =
      preview.damage > 0 &&
      (isAethraUnit(attackerUnit) || isHermesUnit(attackerUnit));
    const attackerIsZeusCaster = isZeusUnit(attackerUnit) && preview.damage > 0;
    const useHeraclesAttackSprite = isHeraclesUnit(attackerUnit);
    const useHadesAttackSprite = isHadesUnit(attackerUnit);

    if (attackerIsZeusCaster) {
      // Zeus casts spells in place; no lunge movement.
      setBattleSpriteMode(motionA, "idle");
      motionA.classList.add("unit-card-motion--pulse");
      setTimeout(() => {
        if (isAoe && aoeTargets.length) {
          showBattleLightningForTargets(aoeTargets, battleScene);
          showBattleFloatingDamageForTargets(aoeTargets, preview, battleScene);
        } else {
          showBattleLightningStrike(motionT || motionA, battleScene);
          showBattleFloatingDamage(motionT || motionA, preview, battleScene);
        }
        setTimeout(() => {
          motionA.classList.remove("unit-card-motion--pulse");
          resolve();
        }, 210);
      }, 160);
      return;
    }

    setBattleSpriteMode(
      motionA,
      useHeraclesAttackSprite || useHadesAttackSprite
        ? "attack"
        : attackerUsesRunSprite
          ? "walk"
          : "idle"
    );
    motionA.style.willChange = "transform";
    motionA.style.transition =
      "transform 0.36s cubic-bezier(0.4, 0, 0.2, 1)";
    motionA.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(1.06)`;

    setTimeout(() => {
      const returnToStart = () => {
        if (isAoe && aoeTargets.length) {
          // AOE impact and numbers pop on all enemies on the same frame.
          showBattleFloatingDamageForTargets(aoeTargets, preview, battleScene);
        } else {
          showBattleFloatingDamage(motionT, preview, battleScene);
        }
        motionA.style.transition = "transform 0.34s ease-out";
        motionA.style.transform = "";
        setTimeout(() => {
          setBattleSpriteMode(motionA, "idle");
          motionA.style.willChange = "";
          resolve();
        }, 340);
      };
      if (useHeraclesAttackSprite || useHadesAttackSprite) {
        const holdMs = useHeraclesAttackSprite
          ? HERACLES_ATTACK_ANIM_MS
          : HADES_ATTACK_ANIM_MS;
        // Boss attack sprites: arrive first, play full attack sprite, then return.
        setTimeout(returnToStart, holdMs);
        return;
      }
      returnToStart();
    }, 380);
  });
}

function skillHoverTitle(s) {
  const passiveStunChance = Number(s.passiveStunChance ?? 0);
  if (s.passive && passiveStunChance > 0) {
    return `${s.name}: Passive — all damaging attacks (including Basic) have ${Math.round(passiveStunChance * 100)}% chance to stun for 1 round.`;
  }
  const mult = s.damageMultiplier ?? 1;
  const cd = s.cooldown ?? 0;
  const stunChance = Number(s.stunChance ?? 0);
  const stunRounds = Math.max(1, Math.floor(Number(s.stunDurationRounds ?? 1)));
  const speedMult = Number(s.speedBuffMultiplier ?? 0);
  const speedRounds = Math.max(
    1,
    Math.floor(Number(s.speedBuffDurationRounds ?? 1))
  );
  const stunLine =
    stunChance > 0
      ? ` ${Math.round(stunChance * 100)}% chance to stun for ${stunRounds} round(s).`
      : "";
  const speedLine =
    speedMult > 1
      ? ` Grants ${speedMult}× SPD for ${speedRounds} turn(s).`
      : "";
  const aoeLine = s.aoe ? " Attacks all enemies." : "";
  const passiveStunLine = "";
  if (s.skipAttack) {
    return `${s.name}: Support skill — no damage this turn. Cooldown ${cd} round(s) after use.${stunLine}${speedLine}${passiveStunLine}`;
  }
  return `${s.name}: Deals ${mult}× base damage (your attack minus target defense). Cooldown ${cd} round(s) after use.${aoeLine}${stunLine}${speedLine}${passiveStunLine}`;
}

function buildHeroSkillHudHtml(heroId) {
  if (!heroId) return "";
  const def = getHeroDefById(heroId);
  if (!def?.skills?.length) return "";
  const rows = def.skills
    .map((s, idx) => {
      const name = escapeHtml(s.name || `Skill ${idx + 1}`);
      const desc = escapeHtml(skillHoverTitle(s));
      const runtimeSkill = {
        id: String(s.id || s.name || `skill_${idx}`)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, ""),
        ...s,
      };
      const icon = skillIconHtmlForUnitSkill(def.id, runtimeSkill, idx + 1);
      return `<li class="card-skill-hud-item">
        <p class="card-skill-hud-skill"><span class="card-skill-hud-icon" aria-hidden="true">${icon}</span>${name}</p>
        <p class="card-skill-hud-desc">${desc}</p>
      </li>`;
    })
    .join("");
  return `<div class="card-skill-hud" role="tooltip" aria-hidden="true">
    <p class="card-skill-hud-title">${escapeHtml(def.name)} skills</p>
    <ul class="card-skill-hud-list">${rows}</ul>
  </div>`;
}

function showPlayerTurnUI(actor) {
  const panel = el("turn-panel");
  const label = el("turn-actor-label");
  const box = el("turn-skill-buttons");
  if (!panel || !label || !box) return;
  actor.skills = normalizeSkillMetadataForUnit(actor?.id, actor.skills || []);

  panel.classList.remove("is-hidden");
  const currentSpd = statWhole(effectiveUnitSpeed(actor));
  const spdClass =
    (actor?.speedBuffRounds ?? 0) > 0
      ? "turn-actor-spd turn-actor-spd--buffed"
      : "turn-actor-spd";
  label.innerHTML = `Your turn — ${escapeHtml(actor.name)} (SPD <span class="${spdClass}">${escapeHtml(String(currentSpd))}</span>)`;
  let preview = el("turn-skill-preview");
  if (!preview) {
    preview = document.createElement("div");
    preview.id = "turn-skill-preview";
    preview.className = "turn-skill-preview turn-skill-preview--muted";
    panel.appendChild(preview);
  }
  const touchStyleSkillPreview =
    typeof window !== "undefined" &&
    window.matchMedia &&
    (window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(max-width: 950px)").matches);
  const defaultDesc = touchStyleSkillPreview
    ? "Hold a skill to read its full effect."
    : "Hover a skill to read its full effect and cooldown.";
  preview.textContent = defaultDesc;
  preview.classList.add("turn-skill-preview--muted");

  const basicDesc =
    "Standard attack: 1× damage (your attack stat minus target defense). Click an enemy to target, then tap a skill.";
  const basicBtn = `<button type="button" class="btn skill-pick skill-slot skill-slot--default" data-action="basic" data-skill-desc="${escapeHtml(basicDesc)}" title="${escapeHtml(basicDesc)}">
    <span class="skill-slot-icon" aria-hidden="true">⚔</span>
    <span class="skill-slot-caption">Basic</span>
  </button>`;

  const skills = actor.skills || [];
  const activeSkills = skills.filter((s) => !s.passive);
  const passiveSkills = skills.filter((s) => s.passive);
  const skillBtns = activeSkills
    .map((s, si) => {
      const cd = s.cooldownRemaining > 0;
      const mult = s.damageMultiplier ?? 1;
      const skip = s.skipAttack ? " (no damage)" : "";
      const desc = skillHoverTitle(s);
      const tip = escapeHtml(desc);
      const icon = skillIconHtmlForUnitSkill(actor.id, s, si + 1);
      const stunTag = Number(s.stunChance ?? 0) > 0 ? " · STUN" : "";
      const aoeTag = s.aoe ? " · ALL ENEMIES" : "";
      const cap = `${escapeHtml(s.name)} ×${mult}${skip}${aoeTag}${stunTag}${cd ? ` · CD ${s.cooldownRemaining}` : ""}`;
      return `<button type="button" class="btn skill-pick skill-slot" data-action="skill" data-skill-id="${escapeHtml(s.id)}" data-skill-desc="${tip}" title="${tip}" ${cd ? "disabled" : ""}>
    <span class="skill-slot-icon" aria-hidden="true">${icon}</span>
    <span class="skill-slot-caption">${cap}</span>
  </button>`;
    })
    .join("");
  const passiveRow = passiveSkills.length
    ? `<div class="turn-passive-row"><span class="turn-passive-label">Passive</span>${passiveSkills
        .map((s, pi) => {
          const icon = skillIconHtmlForUnitSkill(actor.id, s, pi + 1);
          const tip = escapeHtml(skillHoverTitle(s));
          return `<button type="button" class="btn skill-pick skill-slot skill-slot--passive" data-action="passive" data-skill-desc="${tip}" title="${tip}" disabled>
    <span class="skill-slot-icon" aria-hidden="true">${icon}</span>
    <span class="skill-slot-caption">${escapeHtml(s.name)} · PASSIVE</span>
  </button>`;
        })
        .join("")}</div>`
    : "";

  box.innerHTML = `<div class="skill-slot-row">${basicBtn}${skillBtns}</div>${passiveRow}`;
  const setSkillPreview = (text) => {
    preview.textContent = text || defaultDesc;
    preview.classList.toggle("turn-skill-preview--muted", !text);
  };
  let skillHoldTimer = null;
  const clearSkillHold = () => {
    if (skillHoldTimer != null) {
      clearTimeout(skillHoldTimer);
      skillHoldTimer = null;
    }
  };
  if (touchStyleSkillPreview) {
    box.onmouseover = null;
    box.onmouseleave = null;
    box.onpointerdown = (e) => {
      const btn = e.target.closest(".skill-pick");
      if (!btn || btn.disabled) return;
      clearSkillHold();
      skillHoldTimer = window.setTimeout(() => {
        skillHoldTimer = null;
        setSkillPreview(btn.getAttribute("data-skill-desc"));
      }, 300);
    };
    box.onpointerup = () => {
      clearSkillHold();
      setSkillPreview("");
    };
    box.onpointercancel = () => {
      clearSkillHold();
      setSkillPreview("");
    };
  } else {
    box.onpointerdown = null;
    box.onpointerup = null;
    box.onpointercancel = null;
    box.onmouseover = (e) => {
      const btn = e.target.closest(".skill-pick");
      if (!btn) {
        setSkillPreview("");
        return;
      }
      setSkillPreview(btn.getAttribute("data-skill-desc"));
    };
    box.onmouseleave = () => setSkillPreview("");
  }
  box.onfocusin = (e) => {
    const btn = e.target.closest(".skill-pick");
    if (!btn) return;
    setSkillPreview(btn.getAttribute("data-skill-desc"));
  };
  box.onfocusout = () => {
    if (!box.contains(document.activeElement)) setSkillPreview("");
  };

  box.onclick = (e) => {
    const btn = e.target.closest(".skill-pick");
    if (!btn || btn.disabled) return;
    if (btn.getAttribute("data-action") === "basic") {
      onPlayerSkillChosen(actor, null);
      return;
    }
    const sid = btn.getAttribute("data-skill-id");
    const sk = activeSkills.find((x) => x.id === sid);
    onPlayerSkillChosen(actor, sk || null);
  };
}

function onPlayerSkillChosen(actor, skill) {
  hideTurnPanel();
  const plan = planSingleAction(
    actor,
    skill,
    state.teamA,
    state.teamB,
    state.battleTargetEnemyId
  );
  if (!plan) {
    state.turnIndex += 1;
    processTurnStep();
    return;
  }
  const aIdx = state.teamA.indexOf(actor);
  const tIdx = state.teamB.indexOf(plan.target);
  void (async () => {
    if (aIdx >= 0 && tIdx >= 0) {
      await playBattleAttackAnimation("A", aIdx, "B", tIdx, plan.preview);
    } else {
      const actOnly = applyPlannedAction(
        actor,
        plan.useSkill,
        plan.target,
        plan.preview,
        { teamA: state.teamA, teamB: state.teamB }
      );
      if (actOnly) logActionLine(actOnly);
      scheduleVanishAndProcessTurn(actOnly, plan);
      return;
    }
    const act = applyPlannedAction(
      actor,
      plan.useSkill,
      plan.target,
      plan.preview,
      { teamA: state.teamA, teamB: state.teamB }
    );
    if (act) logActionLine(act);
    scheduleVanishAndProcessTurn(act, plan);
  })();
}

function startTurnBattle() {
  if (!state.snapshotParty?.length || !state.snapshotEnemy?.length) return;
  hideTurnPanel();
  state.teamA = cloneTeam(state.snapshotParty);
  state.teamB = cloneTeam(state.snapshotEnemy);
  refillAllHp();
  clearLog();
  prepareTeams(state.teamA, state.teamB);
  state.mode = "turn";
  state.finished = false;
  state.round = 0;
  state.turnQueue = [];
  state.turnIndex = 0;
  state.battleAutoPlay = false;
  state.battleVanishedKeys = new Set();
  syncBattleAutoToggleUI();
  appendLogLine(
    "<em>Turn battle — each fighter acts in SPD order; pick a skill when it is your turn.</em>"
  );
  beginNewRoundTurnBattle();
}

function startCampaignBattle(levelIndex) {
  const lvl = CAMPAIGN_LEVELS[levelIndex];
  if (!lvl || !isStageUnlocked(lvl.level)) return;

  const partyUnits = buildPartyUnits();
  if (partyUnits.length === 0) {
    alert(
      "Choose at least one hero in the Character Box (up to four in your party)."
    );
    return;
  }

  state.teamA = partyUnits;
  state.teamB = buildEnemyUnits(lvl.enemies);
  state.campaignStage = lvl.level;
  applyBattleStageBackdrop(lvl.level);
  state.lastCampaignRewards = null;
  saveBattleSnapshots();

  hideTurnPanel();
  hideBattleWinUI();
  hideBattleDefeatUI();
  setBanner(`${lvl.title} — ${lvl.blurb}`);

  showScreen("screen-battle");
  startTurnBattle();
}

function replayCurrentCampaignStage() {
  const stage = state.campaignStage;
  if (stage == null) return;
  const idx = CAMPAIGN_LEVELS.findIndex((lvl) => lvl.level === stage);
  if (idx < 0) return;
  hideBattleWinUI();
  hideBattleDefeatUI();
  startCampaignBattle(idx);
}

function renderCampaignLevels() {
  const container = el("campaign-levels");
  container.innerHTML = CAMPAIGN_LEVELS.map((lvl, i) => {
    const unlocked = isStageUnlocked(lvl.level);
    const bossClass = lvl.level === 5 ? " level-boss" : "";
    return `
      <div class="level-card level-card--compact${bossClass}" data-level-card="${i}" data-level-unlocked="${unlocked ? "1" : "0"}">
        <div class="level-card-main">
          <div class="level-card-headline">
            <span class="level-num">Stage ${lvl.level}</span>
            ${!unlocked ? '<span class="level-lock">Locked</span>' : ""}
          </div>
          <h3 class="level-title">${escapeHtml(lvl.title)}</h3>
        </div>
        <div class="level-card-actions">
          <button type="button" class="btn primary level-start" data-level="${i}" ${
            unlocked ? "" : "disabled"
          }>
            ${unlocked ? "Fight" : "Clear prior stages"}
          </button>
          <button type="button" class="btn ghost level-rewards-btn" data-level-rewards="${i}">
            Rewards
          </button>
        </div>
      </div>`;
  }).join("");

  const startByIndex = (idx) => {
    if (!Number.isFinite(idx)) return;
    const lvl = CAMPAIGN_LEVELS[idx];
    if (!lvl || !isStageUnlocked(lvl.level)) return;
    openCampaignLineupOverlay(idx);
  };

  container.querySelectorAll(".level-start").forEach((btn) => {
    const startFromBtn = () => {
      const idx = parseInt(btn.getAttribute("data-level"), 10);
      if (!btn.disabled) startByIndex(idx);
    };
    btn.addEventListener("click", startFromBtn);
    // iOS Safari can occasionally miss click on dense mobile layouts.
    btn.addEventListener(
      "touchend",
      (e) => {
        e.preventDefault();
        startFromBtn();
      },
      { passive: false }
    );
  });

  container.querySelectorAll(".level-rewards-btn").forEach((btn) => {
    const openRewards = (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute("data-level-rewards"), 10);
      if (Number.isFinite(idx)) showCampaignRewardsModal(idx);
    };
    btn.addEventListener("click", openRewards);
    btn.addEventListener(
      "touchend",
      (e) => {
        e.preventDefault();
        openRewards(e);
      },
      { passive: false }
    );
  });
}

/** Mini portrait chips for the Character Box party toolbar (static portraits, not battle sprites). */
function buildPartyActiveChipsHtml(partyIds) {
  if (!partyIds.length) {
    return '<span class="party-active-empty" aria-hidden="true">—</span>';
  }
  const items = partyIds
    .map((id) => {
      const def = getHeroDefById(id);
      if (!def) return "";
      const u = { id, name: def.name };
      const rc = rarityClass(def.rarity);
      const tip = escapeHtml(def.name);
      return `<li class="party-active-chip ${rc}" role="listitem" title="${tip}">${portraitBlockHtml(u)}</li>`;
    })
    .filter(Boolean)
    .join("");
  return `<ul class="party-active-list" role="list" aria-label="Active battle party heroes">${items}</ul>`;
}

function renderPartyToolbar() {
  const toolbar = el("party-toolbar");
  if (!toolbar) return;
  const party = getBattleParty();
  const names = party
    .map((id) => getHeroDefById(id)?.name || id)
    .join(", ");
  const chips = buildPartyActiveChipsHtml(party);
  toolbar.innerHTML = `<div class="party-toolbar-main">
    <div class="party-toolbar-line">
      <p class="party-toolbar-text"><strong>Battle party</strong> <span class="party-count">${party.length}</span> / ${MAX_PARTY_SIZE}</p>
      ${chips}
    </div>
    <p class="party-names">${escapeHtml(names || "—")}</p>
  </div>`;
}

function renderXpScrollPanel() {
  const panel = el("xp-scroll-panel");
  if (!panel) return;
  const count = getXpScrolls();
  const party = getBattleParty();
  const options = party
    .map((id) => {
      const def = getHeroDefById(id);
      const p = getHeroProgress(id);
      if (!def) return "";
      return `<option value="${escapeHtml(id)}">${escapeHtml(def.name)} · Lv ${p.level}</option>`;
    })
    .join("");
  panel.innerHTML = `<div class="xp-scroll-head">
    <h3 class="xp-scroll-title">XP scroll</h3>
    <p class="xp-scroll-count">Owned: <strong>${count.toLocaleString()}</strong></p>
  </div>
  <p class="xp-scroll-desc">Use on a party member to grant +${XP_SCROLL_XP_GRANT} XP.</p>
  <div class="xp-scroll-row">
    <select id="xp-scroll-target" class="xp-scroll-target" ${party.length ? "" : "disabled"}>
      ${options || '<option value="">No party heroes</option>'}
    </select>
    <button type="button" id="btn-use-xp-scroll" class="btn primary" ${
      count < 1 || party.length < 1 ? "disabled" : ""
    }>Use (+${XP_SCROLL_XP_GRANT} XP)</button>
  </div>
  <p id="xp-scroll-feedback" class="shop-inline-feedback" role="status" aria-live="polite"></p>`;
}

function useXpScrollOnPartyHero() {
  if (!tryConsumeXpScroll()) {
    globalThis.alert("You do not have any XP scrolls.");
    return;
  }
  const targetEl = el("xp-scroll-target");
  const heroId = targetEl instanceof HTMLSelectElement ? targetEl.value : "";
  if (!heroId) {
    addXpScrolls(1);
    return;
  }
  addHeroXp(heroId, XP_SCROLL_XP_GRANT);
  const def = getHeroDefById(heroId);
  const fb = el("xp-scroll-feedback");
  if (fb) {
    fb.textContent = `${def?.name || "Hero"} gained +${XP_SCROLL_XP_GRANT} XP.`;
    fb.classList.add("shop-inline-feedback--ok");
  }
  renderCharacterBox();
  renderSummonScrollBar();
}

function renderCharacterBox() {
  renderPartyToolbar();
  renderXpScrollPanel();
  const grid = el("character-box-list");
  const ids = getCollection();
  const party = getBattleParty();
  const newIds = getNewHeroIds();
  grid.innerHTML = ids
    .map((id) => {
      const def = getHeroDefById(id);
      if (!def) return "";
      const u = { id, name: def.name };
      const inParty = party.includes(id);
      const rc = rarityClass(def.rarity);
      const newBadge = newIds.includes(id)
        ? '<span class="card-new-badge">NEW</span>'
        : "";
      const skillHud = buildHeroSkillHudHtml(id);
      const { level: heroLv } = getHeroProgress(id);
      return `<article class="card unit-card box-collection-card ${rc}" data-hero-id="${escapeHtml(id)}" role="listitem" data-rarity="${escapeHtml(def.rarity)}">
      ${newBadge}
      <label class="box-party-row">
        <input type="checkbox" class="party-member-cb" data-hero-id="${escapeHtml(id)}" ${inParty ? "checked" : ""} />
        <span class="box-party-label">Battle party</span>
      </label>
      ${portraitBlockHtml(u)}
      <header>
        <h3>${escapeHtml(def.name)}</h3>
        <p class="char-rarity">${escapeHtml(def.rarity)}</p>
        <p class="box-card-level" aria-label="Level ${heroLv}">Lv. ${heroLv}</p>
      </header>
      <button type="button" class="btn ghost box-card-stats-btn" aria-expanded="false">Stats</button>
      ${heroCombatStatsHtml(id)}
      ${heroXpRowHtml(id)}
      <p class="box-card-desc">${escapeHtml(def.description || "")}</p>
      ${skillHud}
    </article>`;
    })
    .join("");
}

const SUMMON_RARITY_ORDER = { Legendary: 0, Epic: 1, Rare: 2 };

function getSummonRosterFilterState() {
  const rarities = new Set();
  for (const cb of document.querySelectorAll(".summon-rarity-cb:checked")) {
    if (cb instanceof HTMLInputElement) rarities.add(cb.value);
  }
  const statusEl = el("summon-f-status");
  const status =
    statusEl instanceof HTMLSelectElement ? statusEl.value : "all";
  return { rarities, status };
}

function renderSummonRoster() {
  const grid = el("summon-roster-grid");
  if (!grid) return;
  const { rarities, status } = getSummonRosterFilterState();
  const owned = new Set(getCollection());

  if (rarities.size === 0) {
    grid.innerHTML =
      '<p class="summon-roster-empty">Select at least one rarity to see heroes.</p>';
    return;
  }

  let list = HERO_DATA.filter(
    (h) => h.id !== CUPID_HERO_ID && rarities.has(h.rarity)
  );
  list = list.filter((h) => {
    const has = owned.has(h.id);
    if (status === "unlocked") return has;
    if (status === "locked") return !has;
    return true;
  });
  list.sort(
    (a, b) =>
      (SUMMON_RARITY_ORDER[a.rarity] ?? 9) -
        (SUMMON_RARITY_ORDER[b.rarity] ?? 9) ||
      a.name.localeCompare(b.name)
  );

  if (list.length === 0) {
    grid.innerHTML =
      '<p class="summon-roster-empty">No heroes match these filters.</p>';
    return;
  }

  grid.innerHTML = list
    .map((def) => {
      const unlocked = owned.has(def.id);
      const u = { id: def.id, name: def.name };
      const rc = rarityClass(def.rarity);
      const lockedClass = unlocked ? "" : " summon-roster-card--locked";
      const badge = unlocked
        ? '<span class="summon-status-badge summon-status-badge--owned">Owned</span>'
        : '<span class="summon-status-badge summon-status-badge--locked">Locked</span>';
      const skillHud = buildHeroSkillHudHtml(def.id);
      return `<article class="summon-roster-card card unit-card box-collection-card ${rc}${lockedClass}" data-hero-id="${escapeHtml(def.id)}" data-owned="${unlocked}" role="listitem">
        ${badge}
        ${portraitBlockHtml(u)}
        <header>
          <h3>${escapeHtml(def.name)}</h3>
          <p class="char-rarity">${escapeHtml(def.rarity)}</p>
        </header>
        ${heroBaseStatsFromDefHtml(def)}
        <p class="box-card-desc summon-roster-desc">${escapeHtml(def.description || "")}</p>
        ${skillHud}
      </article>`;
    })
    .join("");
}

/**
 * Character card for summon reveal (shop cupid / inline errors use full card + optional duplicate text).
 * @param {{ minimal?: boolean, omitMsg?: boolean }} [cardOpts]
 */
function buildSummonResultCardHtml(def, pull, cardOpts = {}) {
  const minimal = Boolean(cardOpts.minimal);
  const omitMsg = Boolean(cardOpts.omitMsg);
  if (!def || !pull?.id) {
    return `<p class="summon-result-msg">Could not display this hero.</p>`;
  }
  const u = { id: pull.id, name: def.name };
  const rc = rarityClass(def.rarity);
  const newBadge = pull.isNew
    ? '<span class="card-new-badge">NEW</span>'
    : "";
  const msgClass = pull.isNew
    ? "summon-result-msg"
    : "summon-result-msg summon-result-msg--dup";
  const dupGold = duplicateSummonGoldRewardForRarity(def?.rarity);
  const msg = pull.isNew
    ? "New hero — added to your collection."
    : `Duplicate — you already own this hero. +${dupGold} gold.`;
  const skillHud = buildHeroSkillHudHtml(pull.id);

  if (minimal) {
    return `<div class="summon-result-cards summon-result-cards--reel">
      <article class="card unit-card box-collection-card summon-reveal-card summon-reveal-card--minimal ${rc}" data-hero-id="${escapeHtml(pull.id)}">
        ${newBadge}
        ${portraitBlockHtml(u)}
        <header>
          <h3>${escapeHtml(def.name)}</h3>
          <p class="char-rarity">${escapeHtml(def.rarity)}</p>
        </header>
      </article>
    </div>`;
  }

  const msgBlock = omitMsg ? "" : `<p class="${msgClass}">${escapeHtml(msg)}</p>`;

  return `${msgBlock}
    <div class="summon-result-cards">
      <article class="card unit-card box-collection-card summon-reveal-card ${rc}" data-hero-id="${escapeHtml(pull.id)}">
        ${newBadge}
        ${portraitBlockHtml(u)}
        <header>
          <h3>${escapeHtml(def.name)}</h3>
          <p class="char-rarity">${escapeHtml(def.rarity)}</p>
        </header>
        ${heroBaseStatsFromDefHtml(def)}
        <p class="box-card-desc">${escapeHtml(def.description || "")}</p>
        ${skillHud}
      </article>
    </div>`;
}

async function playSummonReelAnimation(finalHero, opts = {}) {
  const stage = el("summon-reveal-stage");
  if (!stage || !finalHero?.id) return;
  state.summonAnimSkipRequested = false;
  state.summonAnimRunning = true;
  updateSummonPullButton();
  const pool = HERO_DATA.filter((h) => h.id !== CUPID_HERO_ID);
  if (!pool.length) {
    state.summonAnimRunning = false;
    updateSummonPullButton();
    return;
  }
  const frames = 18;
  for (let i = 0; i < frames; i += 1) {
    if (state.summonAnimSkipRequested) break;
    const pick = pool[Math.floor(Math.random() * pool.length)] || finalHero;
    stage.innerHTML = buildSummonResultCardHtml(
      pick,
      { id: pick.id, isNew: true },
      { minimal: true }
    );
    const delay = 55 + i * 17;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  stage.innerHTML = buildSummonResultCardHtml(
    finalHero,
    {
      id: finalHero.id,
      isNew: !!opts.isNew,
    },
    /* Same compact card as reel — full-size winner was too tall on mobile */
    { omitMsg: true, minimal: true }
  );
  state.summonAnimRunning = false;
  state.summonAnimSkipRequested = false;
  updateSummonPullButton();
  showSummonRevealActionsBar();
}

async function doSummon() {
  if (!tryConsumeSummonScroll()) {
    globalThis.alert(
      "You need a summon scroll. Clear campaign stages for a random drop, or buy scrolls in the Shop."
    );
    return;
  }
  state.lastSummonWasLegend = false;
  const h = summonHero();
  if (h?.rarity === "Epic") {
    completeQuest(QUEST_SUMMON_EPIC);
  }
  const box = el("summon-result");
  if (!h) {
    addSummonScrolls(1);
    if (box) {
      box.innerHTML = "<p>Summon failed — your scroll was refunded.</p>";
    }
    renderSummonScrollBar();
    updateSummonPullButton();
    return;
  }
  if (h.isNew && h.id) {
    markHeroAsNew(h.id);
  } else {
    addGold(duplicateSummonGoldRewardForRarity(h.rarity));
  }
  const def = getHeroDefById(h.id);
  if (def) {
    openSummonRevealOverlay();
    await playSummonReelAnimation(def, { isNew: !!h.isNew });
  } else if (box) {
    box.innerHTML = buildSummonResultCardHtml(def, {
      id: h.id,
      isNew: !!h.isNew,
    });
  }
  renderCharacterBox();
  renderSummonRoster();
  renderSummonScrollBar();
  updateSummonPullButton();
  renderGoldBar();
}

async function doSummonLegend() {
  if (!tryConsumeLegendScroll()) {
    globalThis.alert(
      "You need a legend scroll. Buy one in the Shop for 10,000 gold."
    );
    return;
  }
  state.lastSummonWasLegend = true;
  const h = summonHeroFromLegendScroll();
  if (h?.rarity === "Epic") {
    completeQuest(QUEST_SUMMON_EPIC);
  }
  const box = el("summon-result");
  if (!h) {
    addLegendScrolls(1);
    if (box) {
      box.innerHTML = "<p>Legend summon failed — your legend scroll was refunded.</p>";
    }
    renderSummonScrollBar();
    updateSummonPullButton();
    return;
  }
  if (h.isNew && h.id) {
    markHeroAsNew(h.id);
  } else {
    addGold(duplicateSummonGoldRewardForRarity(h.rarity));
  }
  const def = getHeroDefById(h.id);
  if (def) {
    openSummonRevealOverlay();
    await playSummonReelAnimation(def, { isNew: !!h.isNew });
  } else if (box) {
    box.innerHTML = buildSummonResultCardHtml(def, {
      id: h.id,
      isNew: !!h.isNew,
    });
  }
  renderCharacterBox();
  renderSummonRoster();
  renderSummonScrollBar();
  updateSummonPullButton();
  renderGoldBar();
}

function init() {
  el("game-title").textContent = GAME_META.title;
  el("game-subtitle").textContent = GAME_META.subtitle;
  syncWinCountQuestProgress();

  el("nav-campaign").addEventListener("click", () => {
    renderCampaignLevels();
    showScreen("screen-campaign");
  });
  el("nav-shop").addEventListener("click", () => {
    const fb = el("shop-scroll-feedback");
    if (fb) {
      fb.textContent = "";
      fb.classList.remove("shop-inline-feedback--ok");
    }
    const lfb = el("shop-legend-scroll-feedback");
    if (lfb) {
      lfb.textContent = "";
      lfb.classList.remove("shop-inline-feedback--ok");
    }
    const xfb = el("shop-xp-scroll-feedback");
    if (xfb) {
      xfb.textContent = "";
      xfb.classList.remove("shop-inline-feedback--ok");
    }
    showScreen("screen-shop");
  });
  el("btn-back-hub-shop").addEventListener("click", () =>
    showScreen("screen-hub")
  );
  el("btn-shop-cupid").addEventListener("click", () => purchaseCupid());
  el("btn-shop-scroll").addEventListener("click", () => purchaseSummonScroll());
  const shopLegBtn = el("btn-shop-legend-scroll");
  if (shopLegBtn) {
    shopLegBtn.addEventListener("click", () => purchaseLegendScroll());
  }
  const shopXpBtn = el("btn-shop-xp-scroll");
  if (shopXpBtn) {
    shopXpBtn.addEventListener("click", () => purchaseXpScroll());
  }
  el("nav-summon").addEventListener("click", () => {
    const sr = el("summon-result");
    if (sr) sr.innerHTML = "";
    showScreen("screen-summon");
    renderSummonRoster();
  });
  el("nav-pray").addEventListener("click", () => {
    showScreen("screen-pray");
  });
  el("nav-box").addEventListener("click", () => {
    renderCharacterBox();
    showScreen("screen-box");
  });
  el("nav-quests").addEventListener("click", () => {
    renderQuests();
    showScreen("screen-quests");
  });
  el("nav-settings").addEventListener("click", () => {
    const feedback = el("settings-reset-feedback");
    if (feedback) {
      feedback.textContent = "";
      feedback.classList.remove("settings-feedback--ok");
    }
    showScreen("screen-settings");
  });

  el("btn-back-hub").addEventListener("click", () => showScreen("screen-hub"));
  el("btn-back-hub-summon").addEventListener("click", () =>
    showScreen("screen-hub")
  );
  el("btn-back-hub-pray").addEventListener("click", () =>
    showScreen("screen-hub")
  );
  el("btn-back-hub-box").addEventListener("click", () =>
    showScreen("screen-hub")
  );
  el("btn-back-hub-quests").addEventListener("click", () =>
    showScreen("screen-hub")
  );
  el("btn-back-hub-settings").addEventListener("click", () =>
    showScreen("screen-hub")
  );
  el("btn-reset-game-data").addEventListener("click", () => resetAllGameData());
  el("btn-back-campaign").addEventListener("click", () => {
    hideBattleWinUI();
    hideBattleDefeatUI();
    showScreen("screen-campaign");
    renderCampaignLevels();
  });

  el("btn-win-continue").addEventListener("click", () => {
    hideBattleWinUI();
    hideBattleDefeatUI();
    renderCampaignLevels();
    showScreen("screen-campaign");
  });
  el("btn-win-hub").addEventListener("click", () => {
    hideBattleWinUI();
    hideBattleDefeatUI();
    showScreen("screen-hub");
  });
  el("btn-win-replay").addEventListener("click", () => {
    replayCurrentCampaignStage();
  });

  el("btn-defeat-campaign").addEventListener("click", () => {
    hideBattleDefeatUI();
    renderCampaignLevels();
    showScreen("screen-campaign");
  });
  el("btn-defeat-hub").addEventListener("click", () => {
    hideBattleDefeatUI();
    showScreen("screen-hub");
  });
  el("btn-defeat-replay").addEventListener("click", () => {
    replayCurrentCampaignStage();
  });

  el("btn-summon-pull").addEventListener("click", () => doSummon());
  const btnLegSummon = el("btn-summon-legend-pull");
  if (btnLegSummon) {
    btnLegSummon.addEventListener("click", () => doSummonLegend());
  }
  const summonRatesToggle = el("btn-summon-rates-toggle");
  const summonRatesPanel = el("summon-rates-panel");
  if (summonRatesToggle && summonRatesPanel) {
    summonRatesToggle.addEventListener("click", () => {
      const willOpen = summonRatesPanel.classList.contains(
        "summon-rates-panel--hidden"
      );
      summonRatesPanel.classList.toggle("summon-rates-panel--hidden", !willOpen);
      summonRatesToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
      summonRatesToggle.textContent = willOpen
        ? "Summon rates ▴"
        : "Summon rates ▾";
    });
  }
  const btnSkipSummon = el("btn-summon-skip");
  if (btnSkipSummon) {
    btnSkipSummon.addEventListener("click", () => {
      if (!state.summonAnimRunning) return;
      state.summonAnimSkipRequested = true;
    });
  }

  const btnSummonRevealSkip = el("btn-summon-reveal-skip");
  if (btnSummonRevealSkip) {
    btnSummonRevealSkip.addEventListener("click", () => {
      if (!state.summonAnimRunning) return;
      state.summonAnimSkipRequested = true;
    });
  }

  const btnSummonAgain = el("btn-summon-again");
  if (btnSummonAgain) {
    btnSummonAgain.addEventListener("click", async () => {
      const ok = state.lastSummonWasLegend
        ? getLegendScrolls() >= 1
        : getSummonScrolls() >= 1;
      if (!ok) return;
      closeSummonRevealOverlay();
      if (state.lastSummonWasLegend) {
        await doSummonLegend();
      } else {
        await doSummon();
      }
    });
  }

  const btnSummonContinue = el("btn-summon-continue");
  if (btnSummonContinue) {
    btnSummonContinue.addEventListener("click", () => {
      closeSummonRevealOverlay();
    });
  }

  const praySpinBtn = el("btn-pray-spin");
  if (praySpinBtn) {
    praySpinBtn.addEventListener("click", () => {
      void doDailyPraySpin();
    });
  }

  const summonFilters = el("summon-pool-filters");
  if (summonFilters) {
    summonFilters.addEventListener("change", () => renderSummonRoster());
  }

  el("screen-battle").addEventListener("click", (e) => {
    const card = e.target.closest('.unit-card[data-side="B"]');
    if (!card || !canSelectEnemyTarget()) return;
    const idx = parseInt(card.getAttribute("data-index"), 10);
    if (Number.isNaN(idx)) return;
    const unit = state.teamB[idx];
    if (!unit || !isAlive(unit) || unit.id == null) return;
    state.battleTargetEnemyId = String(unit.id);
    renderTeams();
  });

  el("character-box-list").addEventListener("click", (e) => {
    const statsBtn = e.target.closest(".box-card-stats-btn");
    if (statsBtn) {
      e.preventDefault();
      const art = statsBtn.closest(".box-collection-card");
      if (!art) return;
      const open = art.classList.toggle("box-card--stats-open");
      statsBtn.setAttribute("aria-expanded", open ? "true" : "false");
      return;
    }
    if (e.target.closest("label") || e.target.closest("input[type=checkbox]")) {
      return;
    }
    if (e.target.closest(".card-skill-hud")) {
      return;
    }
    const art = e.target.closest(".box-collection-card");
    if (!art) return;
    const hid = art.getAttribute("data-hero-id");
    if (!hid) return;

    if (getNewHeroIds().includes(hid)) {
      clearNewHeroMarker(hid);
      renderCharacterBox();
      return;
    }
  });

  const battleSpeedBtn = el("btn-battle-speed");
  if (battleSpeedBtn) {
    const syncBattleSpeedLabel = () => {
      battleSpeedBtn.textContent = `×${state.battleSpeedLabel}`;
    };
    syncBattleSpeedLabel();
    battleSpeedBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.battleSpeedLabel = state.battleSpeedLabel >= 3 ? 1 : state.battleSpeedLabel + 1;
      syncBattleSpeedLabel();
    });
  }

  const battleAutoBtn = el("btn-battle-auto");
  if (battleAutoBtn) {
    syncBattleAutoToggleUI();
    battleAutoBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.battleAutoPlay = !state.battleAutoPlay;
      syncBattleAutoToggleUI();
      if (
        state.battleAutoPlay &&
        state.mode === "turn" &&
        !state.finished &&
        state.turnIndex < state.turnQueue.length
      ) {
        const actor = state.turnQueue[state.turnIndex];
        if (actor && actor.team === "A" && isAlive(actor)) {
          hideTurnPanel();
          ensureAutoBattleTarget();
          runPlayerAutoTurn(actor);
        }
      }
    });
  }

  el("character-box-list").addEventListener("change", (e) => {
    const inp = e.target;
    if (!inp.classList.contains("party-member-cb")) return;
    const id = inp.getAttribute("data-hero-id");
    if (!id) return;
    const checked = inp.checked;
    const result = trySetBattlePartyFromToggle(id, checked);
    if (!result.ok) {
      if (result.reason === "full") {
        alert(`Your battle party can include at most ${MAX_PARTY_SIZE} heroes.`);
      } else if (result.reason === "last") {
        alert("Keep at least one hero in your battle party.");
      }
      inp.checked = !checked;
      return;
    }
    renderCharacterBox();
  });

  const xpPanel = el("xp-scroll-panel");
  if (xpPanel) {
    xpPanel.addEventListener("click", (e) => {
      const btn = e.target.closest("#btn-use-xp-scroll");
      if (!btn || btn.disabled) return;
      useXpScrollOnPartyHero();
    });
  }

  const lineupParty = el("campaign-lineup-party-list");
  if (lineupParty) {
    lineupParty.addEventListener("change", (e) => {
      const inp = e.target;
      if (!inp || !inp.classList.contains("lineup-item-choose")) return;
      const id = inp.getAttribute("data-hero-id");
      if (!id) return;
      const checked = inp.checked;
      const result = trySetBattlePartyFromToggle(id, checked);
      if (!result.ok) {
        if (result.reason === "full") {
          alert(`Your battle party can include at most ${MAX_PARTY_SIZE} heroes.`);
        } else if (result.reason === "last") {
          alert("Keep at least one hero in your battle party.");
        }
        inp.checked = !checked;
        return;
      }
      renderCharacterBox();
      renderCampaignLineupPartyList();
    });
  }

  const lineupCancel = el("btn-lineup-cancel");
  if (lineupCancel) {
    lineupCancel.addEventListener("click", () => {
      hideCampaignLineupOverlay();
      state.pendingCampaignLevelIndex = null;
    });
  }

  const lineupStart = el("btn-lineup-start");
  if (lineupStart) {
    lineupStart.addEventListener("click", () => {
      const idx = state.pendingCampaignLevelIndex;
      if (idx == null) return;
      const partyUnits = buildPartyUnits();
      if (partyUnits.length === 0) {
        alert(
          "Choose at least one hero in your lineup before starting the battle."
        );
        return;
      }
      hideCampaignLineupOverlay();
      startCampaignBattle(idx);
    });
  }

  const rewardsClose = el("btn-campaign-rewards-close");
  if (rewardsClose) {
    rewardsClose.addEventListener("click", () => hideCampaignRewardsModal());
  }
  const rewardsOverlay = el("campaign-rewards-overlay");
  if (rewardsOverlay) {
    rewardsOverlay.addEventListener("click", (e) => {
      if (e.target === rewardsOverlay) hideCampaignRewardsModal();
    });
  }

  const questList = el("quest-list");
  if (questList) {
    questList.addEventListener("click", (e) => {
      const btn = e.target.closest(".quest-claim-btn");
      if (!btn || btn.disabled) return;
      const questId = btn.getAttribute("data-quest-id");
      const quest = QUESTS.find((q) => q.id === questId);
      if (!quest) return;
      if (!tryClaimQuest(quest.id)) return;
      quest.claim();
      renderGoldBar();
      renderSummonScrollBar();
      updateSummonPullButton();
      updateShopXpScrollButton();
      renderXpScrollPanel();
      renderQuests();
    });
  }

  if (isLikelyMobileDevice()) {
    const tryLockOnFirstTouch = () => {
      void ensureLandscapeOrientation();
    };
    document.addEventListener("pointerdown", tryLockOnFirstTouch, {
      capture: true,
      once: true,
    });
    screen.orientation?.addEventListener?.("change", maybeReassertLandscapeLock);
  }

  window.addEventListener("resize", updateMobileOrientationUI);
  window.addEventListener("orientationchange", () => {
    updateMobileOrientationUI();
    maybeReassertLandscapeLock();
  });

  showScreen("screen-hub");
  renderShopCupidStats();
  renderQuests();
  renderPrayPanel();
  updateMobileOrientationUI();
}

init();
