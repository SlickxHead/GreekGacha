/**
 * Turn-based combat: two teams of 3, initiative by Speed (higher acts first).
 * Damage = max(0, Attack - Defense), then skill multipliers.
 */

const MIN_DAMAGE = 0;

/** @typedef {'first' | 'random' | 'lowestHp'} TargetingMode */

/**
 * @typedef {Object} SkillDef
 * @property {string} id
 * @property {string} name
 * @property {number} cooldown - full rounds before skill can be used again after casting
 * @property {number} [damageMultiplier=1] - applied to basic attack damage when skill fires
 * @property {boolean} [skipAttack=false] - if true, deal no damage this turn (setup skills)
 */

/**
 * @param {TargetingMode} mode
 * @param {((min: number, max: number) => number) | null} rng - inclusive min/max; use for deterministic "random" tests
 */
function pickTarget(foes, mode, rng = null) {
  const alive = foes.filter((u) => u.hp > 0);
  if (alive.length === 0) return null;

  if (mode === "first") return alive[0];
  if (mode === "lowestHp") {
    return alive.reduce((a, b) => (a.hp <= b.hp ? a : b));
  }
  if (mode === "random") {
    const i = rng
      ? rng(0, alive.length - 1)
      : Math.floor(Math.random() * alive.length);
    return alive[i];
  }
  return alive[0];
}

function calculateDamage(attacker, defender, multiplier = 1) {
  const raw = attacker.attack - defender.defense;
  const base = Math.max(0, raw) * multiplier;
  const floored = MIN_DAMAGE > 0 ? Math.max(MIN_DAMAGE, base) : base;
  return Math.round(floored * 100) / 100;
}

function isAlive(unit) {
  return unit.hp > 0;
}

function opposingTeam(teamA, teamB, attackerTeam) {
  return attackerTeam === "A" ? teamB : teamA;
}

/**
 * Normalize skills: attach cooldownRemaining from template cooldown.
 * @param {SkillDef[]} [skills]
 */
function initSkills(skills) {
  if (!skills || !skills.length) return [];
  return skills.map((s) => ({
    ...s,
    cooldownRemaining: s.cooldownRemaining ?? 0,
  }));
}

/**
 * Decrement cooldowns once per combat round (call at round start).
 * @param {object} unit
 */
function tickSkillCooldowns(unit) {
  if (!unit.skills) return;
  for (const s of unit.skills) {
    if (s.cooldownRemaining > 0) s.cooldownRemaining -= 1;
  }
}

/**
 * First ready skill (cooldownRemaining === 0), in array order.
 * @param {object} unit
 */
function getReadySkill(unit) {
  if (!unit.skills) return null;
  return unit.skills.find((s) => s.cooldownRemaining <= 0) ?? null;
}

function useSkill(unit, skill) {
  skill.cooldownRemaining = skill.cooldown;
}

/**
 * @param {object} attacker
 * @param {object | null} skill
 * @param {object} target
 * @returns {{ damage: number, skillId: string | null, skillName: string | null }}
 */
function resolveAttack(attacker, skill, target) {
  if (!skill) {
    const damage = calculateDamage(attacker, target, 1);
    return { damage, skillId: null, skillName: null };
  }
  if (skill.skipAttack) {
    useSkill(attacker, skill);
    return { damage: 0, skillId: skill.id, skillName: skill.name };
  }
  const mult = skill.damageMultiplier ?? 1;
  const damage = calculateDamage(attacker, target, mult);
  useSkill(attacker, skill);
  return { damage, skillId: skill.id, skillName: skill.name };
}

/**
 * @param {object} opts
 * @param {TargetingMode} [opts.targeting='first']
 * @param {boolean} [opts.useSkills=true]
 * @param {(min: number, max: number) => number} [opts.rng]
 */
function combatRound(teamA, teamB, log = [], opts = {}) {
  const targeting = opts.targeting ?? "first";
  const useSkills = opts.useSkills !== false;
  const rng = opts.rng ?? null;

  for (const u of [...teamA, ...teamB]) tickSkillCooldowns(u);

  const units = [...teamA, ...teamB].filter(isAlive);
  units.sort((a, b) => b.speed - a.speed || a._order - b._order);

  for (const attacker of units) {
    if (!isAlive(attacker)) continue;

    const foes = opposingTeam(teamA, teamB, attacker.team).filter(isAlive);
    const target = pickTarget(foes, targeting, rng);
    if (!target) continue;

    const skill = useSkills ? getReadySkill(attacker) : null;
    const result = resolveAttack(attacker, skill, target);

    if (result.damage > 0) {
      target.hp = Math.max(0, target.hp - result.damage);
    }

    log.push({
      actor: attacker.name,
      target: target.name,
      damage: result.damage,
      skillId: result.skillId,
      skillName: result.skillName,
      targetHpLeft: target.hp,
    });
  }

  return { teamA, teamB, log };
}

function teamWiped(team) {
  return team.every((u) => !isAlive(u));
}

/**
 * Assign team ids, stable order tie-breakers, and normalized skills.
 * Call once after building rosters and before combatRound / runCombat loops.
 */
function prepareTeams(teamA, teamB) {
  teamA.forEach((u, i) => {
    u.team = "A";
    u._order = i;
    u.skills = initSkills(u.skills);
  });
  teamB.forEach((u, i) => {
    u.team = "B";
    u._order = i + 100;
    u.skills = initSkills(u.skills);
  });
}

/**
 * @param {object} opts
 * @param {TargetingMode} [opts.targeting]
 * @param {boolean} [opts.useSkills]
 * @param {(min: number, max: number) => number} [opts.rng]
 */
function runCombat(teamA, teamB, opts = {}) {
  const fullLog = [];
  let round = 0;

  prepareTeams(teamA, teamB);

  while (!teamWiped(teamA) && !teamWiped(teamB)) {
    round += 1;
    const roundLog = [];
    combatRound(teamA, teamB, roundLog, opts);
    fullLog.push({ round, actions: roundLog });
  }

  const winner = teamWiped(teamA) ? "B" : "A";
  return { winner, teamA, teamB, fullLog };
}

export {
  calculateDamage,
  pickTarget,
  combatRound,
  runCombat,
  prepareTeams,
  tickSkillCooldowns,
  getReadySkill,
  initSkills,
  isAlive,
  teamWiped,
};
