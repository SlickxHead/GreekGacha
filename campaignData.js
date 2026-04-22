/**
 * Campaign stages — levels 1–9 escalate through mortal/undead threats;
 * level 10 is Hades (final boss). Difficulty scales by level.
 */

function basicSkill(name, mult, cd) {
  return { name, damageMultiplier: mult, cooldown: cd, currentCooldown: 0 };
}

function romanSoldier(idx, scale) {
  const s = scale;
  return {
    id: `roman_soldier_${idx}`,
    name: "Roman Soldier",
    rarity: "Common",
    description: "Imperial infantry — shield and gladius",
    hp: Math.round(38 * s),
    maxHp: Math.round(38 * s),
    atk: Math.round(10 * s),
    def: Math.round(6 * s),
    spd: Math.round(20 * s),
    skills: [
      basicSkill("Gladius Strike", 1.15, 0),
      basicSkill("Shield Bash", 1.1, 3),
      basicSkill("Formation Jab", 1.2, 3),
    ],
  };
}

function skeletonWarrior(idx, scale) {
  const s = scale;
  return {
    id: `skeleton_${idx}`,
    name: "Skeleton",
    rarity: "Common",
    description: "Restless bones — quick but brittle",
    hp: Math.round(32 * s),
    maxHp: Math.round(32 * s),
    atk: Math.round(11 * s),
    def: Math.round(5 * s),
    spd: Math.round(24 * s),
    skills: [
      basicSkill("Rattle Cut", 1.15, 0),
      basicSkill("Bone Flurry", 1.25, 3),
      basicSkill("Grave Stab", 1.2, 3),
    ],
  };
}

function legionnaire(idx, scale) {
  const s = scale;
  return {
    id: `legionnaire_${idx}`,
    name: "Legionnaire",
    rarity: "Common",
    description: "Heavy Roman line — disciplined and tough",
    hp: Math.round(52 * s),
    maxHp: Math.round(52 * s),
    atk: Math.round(14 * s),
    def: Math.round(10 * s),
    spd: Math.round(18 * s),
    skills: [
      basicSkill("Pilum Throw", 1.2, 0),
      basicSkill("Testudo Rush", 1.15, 3),
      basicSkill("Centurion Swing", 1.35, 4),
    ],
  };
}

function hellhound(idx, scale) {
  const s = scale;
  return {
    id: `hellhound_${idx}`,
    name: "Hellhound",
    rarity: "Epic",
    description: "Infernal beast — relentless bites and underworld fury",
    hp: Math.round(86 * s),
    maxHp: Math.round(86 * s),
    atk: Math.round(24 * s),
    def: Math.round(12 * s),
    spd: Math.round(33 * s),
    skills: [
      basicSkill("Infernal Bite", 1.35, 0),
      basicSkill("Smoke Pounce", 1.5, 3),
      basicSkill("Hound's Wrath", 1.6, 4),
    ],
  };
}

/** Boss: Heracles — god-tier stats for stage 5 */
export const HERACLES_BOSS = {
  id: "heracles",
  name: "Heracles",
  rarity: "Legendary",
  description: "Boss — divine strength of the greatest hero",
  hp: 320,
  maxHp: 320,
  atk: 40,
  def: 22,
  spd: 28,
  skills: [
    basicSkill("Nemean Crush", 1.55, 0),
    basicSkill("Twelve Labors", 1.75, 4),
    basicSkill("Olympian Roar", 1.45, 3),
  ],
};

/** Final boss: Hades — ruler of the underworld at stage 10 */
export const HADES_BOSS = {
  id: "hades",
  name: "Hades",
  rarity: "Legendary",
  description: "Boss — sovereign of the underworld and master of souls",
  hp: 420,
  maxHp: 420,
  atk: 52,
  def: 30,
  spd: 34,
  skills: [
    basicSkill("Underworld Rend", 1.65, 0),
    basicSkill("Soul Chain", 1.85, 4),
    basicSkill("Stygian Crown", 1.55, 3),
  ],
};

/**
 * @type {{ level: number; title: string; blurb: string; enemies: object[]; rewards: { gold: number; partyXpEach: number; scrollDropChance: number } }[]}
 */
export const CAMPAIGN_LEVELS = [
  {
    level: 1,
    title: "Shattered Shore",
    blurb: "Legion patrols guard the beachhead.",
    enemies: [romanSoldier(0, 1.0), romanSoldier(1, 1.0)],
    rewards: { gold: 90, partyXpEach: 35, scrollDropChance: 0.02 },
  },
  {
    level: 2,
    title: "Bone Tide",
    blurb: "Skeletons rise among fallen banners.",
    enemies: [skeletonWarrior(0, 1.05), skeletonWarrior(1, 1.05), romanSoldier(0, 1.02)],
    rewards: { gold: 130, partyXpEach: 48, scrollDropChance: 0.02 },
  },
  {
    level: 3,
    title: "Marrow Fields",
    blurb: "A thicker host of undead blocks the path.",
    enemies: [skeletonWarrior(0, 1.18), skeletonWarrior(1, 1.18), skeletonWarrior(2, 1.18)],
    rewards: { gold: 175, partyXpEach: 62, scrollDropChance: 0.02 },
  },
  {
    level: 4,
    title: "Iron March",
    blurb: "Elite legionnaires lead the line.",
    enemies: [legionnaire(0, 1.22), legionnaire(1, 1.22), skeletonWarrior(0, 1.15)],
    rewards: { gold: 220, partyXpEach: 78, scrollDropChance: 0.02 },
  },
  {
    level: 5,
    title: "Trial of Strength",
    blurb: "The son of Zeus stands before you — settle it with glory.",
    enemies: [HERACLES_BOSS],
    rewards: { gold: 380, partyXpEach: 110, scrollDropChance: 0.03 },
  },
  {
    level: 6,
    title: "Ashen Procession",
    blurb: "Hardened legion ranks march beside undead vanguards.",
    enemies: [
      legionnaire(0, 1.32),
      skeletonWarrior(0, 1.28),
      skeletonWarrior(1, 1.28),
    ],
    rewards: { gold: 430, partyXpEach: 132, scrollDropChance: 0.02 },
  },
  {
    level: 7,
    title: "Crypt Vanguard",
    blurb: "The dead now strike in disciplined formations.",
    enemies: [
      skeletonWarrior(0, 1.42),
      skeletonWarrior(1, 1.42),
      legionnaire(0, 1.36),
      legionnaire(1, 1.36),
    ],
    rewards: { gold: 500, partyXpEach: 156, scrollDropChance: 0.02 },
  },
  {
    level: 8,
    title: "River Styx Crossing",
    blurb: "A relentless gauntlet guards the ferryman's banks.",
    enemies: [
      romanSoldier(0, 1.5),
      skeletonWarrior(0, 1.5),
      skeletonWarrior(1, 1.5),
      legionnaire(0, 1.44),
    ],
    rewards: { gold: 580, partyXpEach: 184, scrollDropChance: 0.02 },
  },
  {
    level: 9,
    title: "Gates of Erebos",
    blurb: "The underworld gates are sealed by elite guardians.",
    enemies: [
      legionnaire(0, 1.58),
      legionnaire(1, 1.58),
      skeletonWarrior(0, 1.62),
      skeletonWarrior(1, 1.62),
    ],
    rewards: { gold: 670, partyXpEach: 216, scrollDropChance: 0.02 },
  },
  {
    level: 10,
    title: "Throne of the Dead",
    blurb: "Hades rises from the shadows — claim victory over the underworld.",
    enemies: [hellhound(0, 1.75), HADES_BOSS, hellhound(1, 1.75)],
    rewards: { gold: 900, partyXpEach: 280, scrollDropChance: 0.03 },
  },
];
