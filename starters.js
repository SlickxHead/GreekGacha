/**
 * Story starters — not in the standard gacha pool.
 */

export const PERSEUS = {
  id: "perseus",
  name: "Perseus",
  rarity: "Rare",
  description: "Slayer of monsters — balanced blade and grit",
  hp: 92,
  maxHp: 92,
  atk: 24,
  def: 12,
  spd: 30,
  skills: [
    { name: "Harpe Slash", damageMultiplier: 1.35, cooldown: 2, currentCooldown: 0 },
    { name: "Reflecting Shield", damageMultiplier: 1.2, cooldown: 3, currentCooldown: 0 },
    { name: "Hero's Rush", damageMultiplier: 1.5, cooldown: 4, currentCooldown: 0 },
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
    { name: "Spear Thrust", damageMultiplier: 1.3, cooldown: 2, currentCooldown: 0 },
    { name: "Troizen Footwork", damageMultiplier: 1.25, cooldown: 2, currentCooldown: 0 },
    { name: "Royal Command", damageMultiplier: 1.4, cooldown: 4, currentCooldown: 0 },
  ],
};

export const STARTER_IDS = ["perseus", "aethra"];
