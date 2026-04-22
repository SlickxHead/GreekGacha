/**
 * Story starters — not in the standard gacha pool.
 */

export const PERSEUS = {
  id: "perseus",
  name: "Perseus",
  rarity: "Rare",
  description: "Slayer of monsters — Harpe, helm, and the Gorgon’s head",
  hp: 92,
  maxHp: 92,
  atk: 24,
  def: 12,
  spd: 30,
  skills: [
    {
      name: "Mirror Strike",
      damageMultiplier: 1,
      cooldown: 0,
      currentCooldown: 0,
      stripOrShredChance: 0.5,
      stripDefenseBreakMultiplier: 0.5,
      stripDefenseBreakRounds: 1,
      grantShieldHpFraction: 0.15,
      grantShieldRounds: 2,
    },
    {
      name: "Veiled Ambush",
      damageMultiplier: 1.95,
      cooldown: 3,
      currentCooldown: 0,
      ignoreDefensePercent: 0.3,
      speedBuffMultiplier: 1.25,
      speedBuffDurationRounds: 2,
    },
    {
      name: "Gaze of the Gorgon",
      damageMultiplier: 1.35,
      cooldown: 5,
      currentCooldown: 0,
      aoe: true,
      stunChance: 0.75,
      stunDurationRounds: 1,
      aoeAllMeterSlowMult: 0.75,
      aoeAllMeterSlowRounds: 1,
      onStunResistSlowMult: 0.8,
      onStunResistSlowRounds: 2,
    },
    {
      name: "Undaunted Will",
      passive: true,
      leaderAlliesStunResist: 0.33,
    },
  ],
};

export const AETHRA = {
  id: "aethra",
  name: "Aethra",
  rarity: "Rare",
  description: "Royal guide — speed and clever strikes",
  hp: 78,
  maxHp: 78,
  atk: 20,
  def: 10,
  spd: 36,
  skills: [
    { name: "Spear Thrust", damageMultiplier: 1.3, cooldown: 0, currentCooldown: 0 },
    { name: "Troizen Footwork", damageMultiplier: 1.25, cooldown: 2, currentCooldown: 0 },
    { name: "Royal Command", damageMultiplier: 1.4, cooldown: 4, currentCooldown: 0 },
  ],
};

export const STARTER_IDS = ["perseus", "aethra"];
