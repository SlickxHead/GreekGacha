/**
 * Edit these objects to tune your playtest. Use maxHp + hp at full health.
 * Skills: cooldown = rounds locked after use; cooldownRemaining optional start state.
 */

export const GAME_META = {
  title: "Greek Gacha",
  subtitle: "Choose your path from the hub",
  teamALabel: "Your party",
  teamBLabel: "Enemies",
};

const SKILLS_PLACEHOLDER_A = [
  {
    id: "aegis_bash",
    name: "Aegis Bash",
    cooldown: 2,
    damageMultiplier: 1.35,
  },
  {
    id: "thunder_road",
    name: "Thunder Road",
    cooldown: 3,
    damageMultiplier: 1.6,
  },
  {
    id: "rally_cry",
    name: "Rally Cry",
    cooldown: 4,
    skipAttack: true,
  },
];

export const TEAM_A_TEMPLATE = [
  {
    name: "Placeholder Hero",
    mythicTitle: "Chosen Mortal",
    hp: 120,
    maxHp: 120,
    attack: 26,
    defense: 12,
    speed: 38,
    skills: SKILLS_PLACEHOLDER_A,
  },
  {
    name: "Placeholder Sage",
    mythicTitle: "Oracle",
    hp: 90,
    maxHp: 90,
    attack: 22,
    defense: 10,
    speed: 42,
    skills: [
      { id: "hex", name: "Hex", cooldown: 2, damageMultiplier: 1.25 },
      { id: "prophecy", name: "Prophecy", cooldown: 5, skipAttack: true },
    ],
  },
  {
    name: "Placeholder Bulwark",
    mythicTitle: "Shieldbearer",
    hp: 150,
    maxHp: 150,
    attack: 18,
    defense: 20,
    speed: 28,
    skills: [
      { id: "shield_wall", name: "Shield Wall", cooldown: 3, damageMultiplier: 1.1 },
    ],
  },
];

export const TEAM_B_TEMPLATE = [
  {
    name: "Placeholder Shade",
    mythicTitle: "River Spirit",
    hp: 100,
    maxHp: 100,
    attack: 24,
    defense: 11,
    speed: 40,
    skills: [
      { id: "drown", name: "Drown", cooldown: 2, damageMultiplier: 1.4 },
      { id: "mist", name: "Mist", cooldown: 3, skipAttack: true },
    ],
  },
  {
    name: "Placeholder Fury",
    mythicTitle: "Erinyes",
    hp: 95,
    maxHp: 95,
    attack: 28,
    defense: 9,
    speed: 44,
    skills: [
      { id: "vengeance", name: "Vengeance", cooldown: 2, damageMultiplier: 1.5 },
    ],
  },
  {
    name: "Placeholder Titan",
    mythicTitle: "Stonebound",
    hp: 140,
    maxHp: 140,
    attack: 20,
    defense: 18,
    speed: 30,
    skills: [
      { id: "quake", name: "Quake", cooldown: 3, damageMultiplier: 1.3 },
      { id: "roots", name: "Roots", cooldown: 4, skipAttack: true },
    ],
  },
];
