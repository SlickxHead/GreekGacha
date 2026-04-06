/**
 * Greek mythology gacha roster.
 * Stats use atk / def / spd; use heroToGameUnit() before combat.js / game.js.
 */

/** Heroes with this id are not in the random gacha — acquired elsewhere (e.g. shop). */
export const CUPID_HERO_ID = "cupid";

export const HERO_DATA = [
  {
    id: "zeus",
    name: "Zeus",
    rarity: "Legendary",
    description: "Thunderbolt Dealer — sky king burst and oppressive single-target pressure",
    hp: 110,
    maxHp: 110,
    atk: 32,
    def: 14,
    spd: 36,
    skills: [
      {
        name: "Lightning Bolt",
        damageMultiplier: 1.55,
        cooldown: 2,
        currentCooldown: 0,
      },
      {
        name: "Olympian Wrath",
        damageMultiplier: 1.5,
        cooldown: 4,
        currentCooldown: 0,
        aoe: true,
      },
      {
        name: "King of Gods",
        passive: true,
        passiveStunChance: 0.5,
      },
    ],
  },
  {
    id: "artemis",
    name: "Artemis",
    rarity: "Epic",
    description: "Moonlit Stalker — high speed, finishes wounded prey",
    hp: 95,
    maxHp: 95,
    atk: 28,
    def: 11,
    spd: 44,
    skills: [
      {
        name: "Moonlit Volley",
        damageMultiplier: 1.45,
        cooldown: 2,
        currentCooldown: 0,
      },
      {
        name: "Hunter's Mark",
        damageMultiplier: 1.35,
        cooldown: 3,
        currentCooldown: 0,
      },
      {
        name: "Silver Arrow",
        damageMultiplier: 1.65,
        cooldown: 4,
        currentCooldown: 0,
      },
    ],
  },
  {
    id: "ares",
    name: "Ares",
    rarity: "Epic",
    description: "War Hound — trades finesse for sustained battlefield violence",
    hp: 130,
    maxHp: 130,
    atk: 27,
    def: 16,
    spd: 30,
    skills: [
      {
        name: "War Fervor",
        damageMultiplier: 1.4,
        cooldown: 2,
        currentCooldown: 0,
      },
      {
        name: "Bloodlust",
        damageMultiplier: 1.55,
        cooldown: 3,
        currentCooldown: 0,
      },
      {
        name: "Phobos Strike",
        damageMultiplier: 1.7,
        cooldown: 4,
        currentCooldown: 0,
      },
    ],
  },
  {
    id: "medusa",
    name: "Medusa",
    rarity: "Rare",
    description: "Stone Gaze Skirmisher — softens foes before the killing blow",
    hp: 100,
    maxHp: 100,
    atk: 24,
    def: 13,
    spd: 34,
    skills: [
      {
        name: "Petrifying Glare",
        damageMultiplier: 1.35,
        cooldown: 3,
        currentCooldown: 0,
        stunChance: 0.8,
        stunDurationRounds: 1,
      },
      {
        name: "Serpent Lash",
        damageMultiplier: 1.45,
        cooldown: 2,
        currentCooldown: 0,
      },
      {
        name: "Stone Shatter",
        damageMultiplier: 1.6,
        cooldown: 4,
        currentCooldown: 0,
      },
    ],
  },
  {
    id: "hermes",
    name: "Hermes",
    rarity: "Rare",
    description: "Swift Messenger — fastest turns, chip damage and tempo control",
    hp: 88,
    maxHp: 88,
    atk: 22,
    def: 10,
    spd: 48,
    skills: [
      {
        name: "Caduceus Strike",
        damageMultiplier: 1.3,
        cooldown: 2,
        currentCooldown: 0,
      },
      {
        name: "Trickster's Step",
        damageMultiplier: 1.25,
        cooldown: 2,
        currentCooldown: 0,
      },
      {
        name: "Wind Sprint",
        damageMultiplier: 1.5,
        cooldown: 3,
        currentCooldown: 0,
        speedBuffMultiplier: 2,
        speedBuffDurationRounds: 3,
      },
    ],
  },
  {
    id: "athena",
    name: "Athena",
    rarity: "Legendary",
    description: "Strategos Bulwark — high defense, anchors the line",
    hp: 140,
    maxHp: 140,
    atk: 21,
    def: 22,
    spd: 32,
    skills: [
      {
        name: "Aegis Bash",
        damageMultiplier: 1.3,
        cooldown: 2,
        currentCooldown: 0,
      },
      {
        name: "Strategic Rally",
        damageMultiplier: 1.2,
        cooldown: 3,
        currentCooldown: 0,
      },
      {
        name: "Owl Insight",
        damageMultiplier: 1.4,
        cooldown: 4,
        currentCooldown: 0,
      },
    ],
  },
  {
    id: "heracles",
    name: "Heracles",
    rarity: "Legendary",
    description: "Demigod juggernaut — overwhelming strength and finishing blows",
    hp: 145,
    maxHp: 145,
    atk: 34,
    def: 17,
    spd: 29,
    skills: [
      {
        name: "Nemean Crush",
        damageMultiplier: 1.55,
        cooldown: 2,
        currentCooldown: 0,
      },
      {
        name: "Twelve Labors",
        damageMultiplier: 1.75,
        cooldown: 4,
        currentCooldown: 0,
      },
      {
        name: "Olympian Roar",
        damageMultiplier: 1.45,
        cooldown: 3,
        currentCooldown: 0,
      },
    ],
  },
  {
    id: "hades",
    name: "Hades",
    rarity: "Legendary",
    description: "Underworld sovereign — dark caster with crushing late-fight pressure",
    hp: 138,
    maxHp: 138,
    atk: 36,
    def: 16,
    spd: 31,
    skills: [
      {
        name: "Underworld Rend",
        damageMultiplier: 1.6,
        cooldown: 2,
        currentCooldown: 0,
      },
      {
        name: "Soul Chain",
        damageMultiplier: 1.8,
        cooldown: 4,
        currentCooldown: 0,
      },
      {
        name: "Stygian Crown",
        damageMultiplier: 1.5,
        cooldown: 3,
        currentCooldown: 0,
      },
    ],
  },
  {
    id: CUPID_HERO_ID,
    name: "Cupid",
    rarity: "Epic",
    description:
      "Cherubic archer of desire — high speed, precise pressure, and cruelly timed heartbreak (shop exclusive)",
    hp: 94,
    maxHp: 94,
    atk: 25,
    def: 11,
    spd: 42,
    skills: [
      {
        name: "Heartseeker",
        damageMultiplier: 1.4,
        cooldown: 2,
        currentCooldown: 0,
      },
      {
        name: "Passion Volley",
        damageMultiplier: 1.5,
        cooldown: 3,
        currentCooldown: 0,
      },
      {
        name: "Bondbreaker",
        damageMultiplier: 1.65,
        cooldown: 4,
        currentCooldown: 0,
      },
    ],
  },
];

function skillSlug(name, index) {
  const base = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return base || `skill_${index}`;
}

/**
 * Maps a hero record into the unit shape used by `game.js` / `combat.js`
 * (attack, defense, speed, cooldownRemaining on skills).
 */
export function heroToGameUnit(hero) {
  return {
    id: hero.id,
    name: hero.name,
    rarity: hero.rarity,
    mythicTitle: hero.description,
    hp: hero.hp,
    maxHp: hero.maxHp,
    attack: hero.atk,
    defense: hero.def,
    speed: hero.spd,
    skills: (hero.skills || []).map((s, i) => ({
      id: skillSlug(s.name, i),
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
      cooldownRemaining: s.currentCooldown ?? 0,
    })),
  };
}

/** Full roster as battle-ready units (fresh HP / cooldowns). */
export function getHeroRosterAsUnits() {
  return HERO_DATA.map((h) => heroToGameUnit(h));
}
