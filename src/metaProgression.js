// ============================================================
// META PROGRESSION — Permanent Upgrade System
// Underground Workshop / Chip-Set Lab
// ============================================================

const STORAGE_KEY = 'machine_arena_meta';

// ============================================================
// UPGRADE DEFINITIONS
// ============================================================

// Universal upgrades (available to all classes)
export const UNIVERSAL_UPGRADES = [
  {
    id: 'random_ability',
    name: 'SCRAMBLE CHIP',
    icon: '🎲',
    description: 'Start with a random right-click ability',
    maxLevel: 1,
    costs: [80],
  },
  {
    id: 'chosen_ability',
    name: 'SELECT CHIP',
    icon: '🎯',
    description: 'Start with your chosen right-click ability',
    maxLevel: 1,
    costs: [150],
    requires: 'random_ability', // must own random_ability first
  },
  {
    id: 'start_jump',
    name: 'JUMP ACTUATOR',
    icon: '🦘',
    description: 'Start with jump unlocked',
    maxLevel: 1,
    costs: [60],
  },
  {
    id: 'start_sprint',
    name: 'SPRINT SERVO',
    icon: '👟',
    description: 'Start with sprint unlocked',
    maxLevel: 1,
    costs: [60],
  },
  {
    id: 'hp_boost',
    name: 'PLATING UPGRADE',
    icon: '🛡',
    description: 'Increase starting HP',
    maxLevel: 3,
    costs: [50, 100, 160],
    values: [10, 20, 30], // % increase
    valueLabel: (lvl) => `+${[10, 20, 30][lvl]}% HP`,
  },
  {
    id: 'gears_drop',
    name: 'SALVAGE MATRIX',
    icon: '⚙',
    description: 'Increase gears dropped by enemies',
    maxLevel: 5,
    costs: [40, 70, 110, 160, 220],
    values: [1, 2, 3, 4, 5],
    valueLabel: (lvl) => `Level ${lvl + 1}`,
  },
  {
    id: 'melee_damage',
    name: 'KINETIC STRIKER',
    icon: '👊',
    description: 'Increase melee damage',
    maxLevel: 5,
    costs: [60, 120, 200, 300, 450],
    values: [125, 200, 300, 400, 450],
    valueLabel: (lvl) => `${[125, 200, 300, 400, 450][lvl]} damage`,
  },
];

// Class-specific upgrades
export const CLASS_UPGRADES = {
  lmg: [
    {
      id: 'lmg_speed',
      name: 'MOTOR OVERCLOCK',
      icon: '🏃',
      description: 'Increase base movement speed',
      maxLevel: 5,
      costs: [40, 70, 110, 160, 220],
      values: [10, 15, 20, 25, 30],
      valueLabel: (lvl) => `+${[10, 15, 20, 25, 30][lvl]}% speed`,
    },
    {
      id: 'lmg_mag',
      name: 'DRUM EXTENSION',
      icon: '📦',
      description: 'Increase magazine capacity',
      maxLevel: 4,
      costs: [50, 90, 140, 200],
      values: [20, 30, 40, 50],
      valueLabel: (lvl) => `+${[20, 30, 40, 50][lvl]}% mag`,
    },
  ],
  rifle: [
    {
      id: 'rifle_speed',
      name: 'TACTICAL BOOTS',
      icon: '🏃',
      description: 'Increase base movement speed',
      maxLevel: 5,
      costs: [40, 70, 110, 160, 220],
      values: [10, 15, 20, 25, 30],
      valueLabel: (lvl) => `+${[10, 15, 20, 25, 30][lvl]}% speed`,
    },
    {
      id: 'rifle_damage',
      name: 'AP ROUNDS',
      icon: '💥',
      description: 'Increase weapon damage',
      maxLevel: 4,
      costs: [60, 110, 170, 240],
      values: [10, 20, 30, 40],
      valueLabel: (lvl) => `+${[10, 20, 30, 40][lvl]}% dmg`,
    },
  ],
  shotgun: [
    {
      id: 'shotgun_absorb',
      name: 'SHOCK PLATE',
      icon: '🛡',
      description: 'Absorb incoming damage',
      maxLevel: 5,
      costs: [50, 90, 140, 200, 270],
      values: [10, 20, 30, 40, 50],
      valueLabel: (lvl) => `${[10, 20, 30, 40, 50][lvl]}% absorb`,
    },
    {
      id: 'shotgun_mag',
      name: 'SHELL RACK',
      icon: '📦',
      description: 'Increase magazine capacity',
      maxLevel: 4,
      costs: [50, 90, 140, 200],
      values: [20, 30, 40, 50],
      valueLabel: (lvl) => `+${[20, 30, 40, 50][lvl]}% mag`,
    },
    {
      id: 'shotgun_pellets',
      name: 'SPREAD BORE',
      icon: '🔥',
      description: 'Increase pellet count',
      maxLevel: 4,
      costs: [60, 110, 170, 240],
      values: [20, 30, 40, 50],
      valueLabel: (lvl) => `+${[20, 30, 40, 50][lvl]}% pellets`,
    },
  ],
};

// Right-click ability upgrades
export const ABILITY_UPGRADES = {
  dash: [
    {
      id: 'dash_cooldown',
      name: 'RAPID JETS',
      icon: '⏱',
      description: 'Reduce dash cooldown',
      maxLevel: 3,
      costs: [60, 120, 200],
      values: [10, 20, 30],
      valueLabel: (lvl) => `-${[10, 20, 30][lvl]}% CD`,
    },
    {
      id: 'dash_distance',
      name: 'EXTENDED THRUST',
      icon: '💨',
      description: 'Increase dash distance',
      maxLevel: 3,
      costs: [60, 120, 200],
      values: [10, 20, 30],
      valueLabel: (lvl) => `+${[10, 20, 30][lvl]}% range`,
    },
  ],
  shield: [
    {
      id: 'shield_cooldown',
      name: 'QUICK DEPLOY',
      icon: '⏱',
      description: 'Reduce barrier cooldown',
      maxLevel: 3,
      costs: [60, 120, 200],
      values: [10, 20, 30],
      valueLabel: (lvl) => `-${[10, 20, 30][lvl]}% CD`,
    },
    {
      id: 'shield_durability',
      name: 'REINFORCED WALL',
      icon: '🛡',
      description: 'Increase barrier durability',
      maxLevel: 3,
      costs: [70, 140, 220],
      values: [10, 20, 30],
      valueLabel: (lvl) => `+${[10, 20, 30][lvl]}% dur`,
    },
  ],
  invincible: [
    {
      id: 'invincible_cooldown',
      name: 'PHASE RESONANCE',
      icon: '⏱',
      description: 'Reduce phase shift cooldown',
      maxLevel: 3,
      costs: [80, 160, 260],
      values: [10, 20, 30],
      valueLabel: (lvl) => `-${[10, 20, 30][lvl]}% CD`,
    },
    {
      id: 'invincible_duration',
      name: 'TIME DILATION',
      icon: '⚡',
      description: 'Increase invincibility duration',
      maxLevel: 3,
      costs: [80, 160, 260],
      values: [10, 20, 30],
      valueLabel: (lvl) => `+${[10, 20, 30][lvl]}% time`,
    },
  ],
  grapple: [
    {
      id: 'grapple_cooldown',
      name: 'WINCH MOTOR',
      icon: '⏱',
      description: 'Reduce grapple cooldown',
      maxLevel: 3,
      costs: [60, 120, 200],
      values: [10, 20, 30],
      valueLabel: (lvl) => `-${[10, 20, 30][lvl]}% CD`,
    },
    {
      id: 'grapple_resist',
      name: 'ARMORED CABLE',
      icon: '🪝',
      description: 'Gain damage resistance while grappling',
      maxLevel: 1,
      costs: [150],
    },
  ],
  rendezvous: [
    {
      id: 'rendezvous_cooldown',
      name: 'CHRONO LINK',
      icon: '⏱',
      description: 'Reduce Rendezvous cooldown',
      maxLevel: 3,
      costs: [70, 140, 220],
      values: [10, 20, 30],
      valueLabel: (lvl) => `-${[10, 20, 30][lvl]}% CD`,
    },
  ],
};

// All ability types for reference
const ABILITY_TYPES = ['dash', 'shield', 'invincible', 'grapple', 'rendezvous'];
const ABILITY_NAMES = { dash: 'DASH', shield: 'BARRIER', invincible: 'PHASE SHIFT', grapple: 'GRAPPLE', rendezvous: 'RENDEZVOUS' };

// ============================================================
// DEFAULT SAVE STATE
// ============================================================
function createDefaultSave() {
  return {
    permanentGears: 0,
    upgrades: {},           // { upgradeId: level }
    chosenAbility: null,    // 'dash' | 'shield' | 'invincible' | 'grapple'
    equippedFragment: null, // fragment id string or null
    unlockedFragments: [],  // array of fragment ids unlocked so far
    maxWaveReached: 0,      // highest wave ever completed (used to gate unlocks)
  };
}

// ============================================================
// FRAGMENT MANAGEMENT
// ============================================================
export function equipFragment(meta, fragId) {
  meta.equippedFragment = (meta.equippedFragment === fragId) ? null : fragId;
  saveMeta(meta);
}

export function getEquippedFragment(meta) {
  return meta.equippedFragment || null;
}

// Unlock fragments whose unlockWave threshold has been reached.
// Call this on wave completion, passing the wave number just completed.
export function unlockFragmentsForWave(meta, waveCompleted, fragmentDefs) {
  if (waveCompleted > (meta.maxWaveReached || 0)) {
    meta.maxWaveReached = waveCompleted;
  }
  let changed = false;
  for (const def of fragmentDefs) {
    const threshold = def.unlockWave || 1;
    if (meta.maxWaveReached >= threshold && !meta.unlockedFragments.includes(def.id)) {
      meta.unlockedFragments.push(def.id);
      changed = true;
    }
  }
  if (changed) saveMeta(meta);
  return changed;
}

export function isFragmentUnlocked(meta, fragId) {
  return (meta.unlockedFragments || []).includes(fragId);
}

// ============================================================
// LOAD / SAVE
// ============================================================
export function loadMeta() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      // Merge with defaults to handle new fields
      return { ...createDefaultSave(), ...data };
    }
  } catch (_e) { /* corrupted data, reset */ }
  return createDefaultSave();
}

export function saveMeta(meta) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch (_e) { /* storage full or unavailable */ }
}

// ============================================================
// GET UPGRADE LEVEL
// ============================================================
export function getUpgradeLevel(meta, upgradeId) {
  return meta.upgrades[upgradeId] || 0;
}

// ============================================================
// CAN PURCHASE UPGRADE
// ============================================================
export function canPurchaseUpgrade(meta, upgradeDef) {
  const currentLevel = getUpgradeLevel(meta, upgradeDef.id);
  if (currentLevel >= upgradeDef.maxLevel) return false;
  const cost = upgradeDef.costs[currentLevel];
  if (meta.permanentGears < cost) return false;
  // Check prerequisite
  if (upgradeDef.requires) {
    const reqLevel = getUpgradeLevel(meta, upgradeDef.requires);
    if (reqLevel < 1) return false;
  }
  return true;
}

// ============================================================
// PURCHASE UPGRADE
// ============================================================
export function purchaseUpgrade(meta, upgradeDef) {
  if (!canPurchaseUpgrade(meta, upgradeDef)) return false;
  const currentLevel = getUpgradeLevel(meta, upgradeDef.id);
  const cost = upgradeDef.costs[currentLevel];
  meta.permanentGears -= cost;
  meta.upgrades[upgradeDef.id] = currentLevel + 1;
  saveMeta(meta);
  return true;
}

// ============================================================
// TRANSFER GEARS (end of run — 10% of run gears)
// ============================================================
export function transferRunGears(meta, runGears) {
  const transferred = Math.floor(runGears * 0.10);
  meta.permanentGears += transferred;
  saveMeta(meta);
  return transferred;
}

// ============================================================
// APPLY META UPGRADES TO GAME STATE
// Called at the start of each run after weapon/class init
// ============================================================
export function applyMetaUpgrades(state, meta) {
  const lvl = (id) => getUpgradeLevel(meta, id);
  const playerClass = state.playerClass;

  // --- Universal upgrades ---

  // Start with jump
  if (lvl('start_jump') >= 1) {
    state.canJump = true;
  }

  // Start with sprint
  if (lvl('start_sprint') >= 1) {
    state.canSprint = true;
  }

  // HP boost
  const hpLvl = lvl('hp_boost');
  if (hpLvl > 0) {
    const pct = [0.10, 0.20, 0.30][hpLvl - 1];
    const bonus = Math.floor(state.maxHealth * pct);
    state.maxHealth += bonus;
    state.health += bonus;
  }

  // Right-click ability (chosen > random)
  if (lvl('chosen_ability') >= 1 && meta.chosenAbility) {
    state.rightClickAbility = meta.chosenAbility;
  } else if (lvl('random_ability') >= 1) {
    const abilities = ['dash', 'shield', 'invincible', 'grapple'];
    state.rightClickAbility = abilities[Math.floor(Math.random() * abilities.length)];
  }

  // Melee damage
  const meleeDmgLvl = lvl('melee_damage');
  if (meleeDmgLvl > 0) {
    state.meleeDamage = [125, 200, 300, 400, 450][meleeDmgLvl - 1];
  }

  // --- Class upgrades ---
  if (playerClass === 'lmg') {
    const speedLvl = lvl('lmg_speed');
    if (speedLvl > 0) {
      const pct = [0.10, 0.15, 0.20, 0.25, 0.30][speedLvl - 1];
      state.weapon.moveSpeed *= (1 + pct);
      state.moveSpeed = state.weapon.moveSpeed;
    }
    const magLvl = lvl('lmg_mag');
    if (magLvl > 0) {
      const pct = [0.20, 0.30, 0.40, 0.50][magLvl - 1];
      state.weapon.magSizeMultiplier += pct;
      state.weapon.currentAmmo = state.weapon.getMaxAmmo();
    }
  }

  if (playerClass === 'rifle') {
    const speedLvl = lvl('rifle_speed');
    if (speedLvl > 0) {
      const pct = [0.10, 0.15, 0.20, 0.25, 0.30][speedLvl - 1];
      state.weapon.moveSpeed *= (1 + pct);
      state.moveSpeed = state.weapon.moveSpeed;
    }
    const dmgLvl = lvl('rifle_damage');
    if (dmgLvl > 0) {
      const pct = [0.10, 0.20, 0.30, 0.40][dmgLvl - 1];
      state.weapon.damageMultiplier += pct;
    }
  }

  if (playerClass === 'shotgun') {
    const MAX_SHOTGUN_DAMAGE_RESIST = 0.50;
    const absLvl = lvl('shotgun_absorb');
    if (absLvl > 0) {
      const pct = [0.10, 0.20, 0.30, 0.40, 0.50][absLvl - 1];
      state.damageResist = Math.min((state.damageResist || 0) + pct, MAX_SHOTGUN_DAMAGE_RESIST);
    }
    const magLvl = lvl('shotgun_mag');
    if (magLvl > 0) {
      const pct = [0.20, 0.30, 0.40, 0.50][magLvl - 1];
      state.weapon.magSizeMultiplier += pct;
      state.weapon.currentAmmo = state.weapon.getMaxAmmo();
    }
    const pelletLvl = lvl('shotgun_pellets');
    if (pelletLvl > 0) {
      const pct = [0.20, 0.30, 0.40, 0.50][pelletLvl - 1];
      state.weapon.bulletsPerShot = Math.floor(state.weapon.bulletsPerShot * (1 + pct));
    }
  }

  // --- Ability upgrades (apply cooldown reductions etc.) ---
  // These are stored in state.metaAbilityMods for use during gameplay
  state.metaAbilityMods = {
    cooldownMult: 1,
    shieldDurabilityMult: 1,
    dashDistanceMult: 1,
    dashCooldownMult: 1,
    shieldCooldownMult: 1,
    invincibleCooldownMult: 1,
    invincibleDurationMult: 1,
    grappleCooldownMult: 1,
    grappleResist: false,
  };

  // Dash upgrades
  const dashCdLvl = lvl('dash_cooldown');
  if (dashCdLvl > 0) {
    const pct = [0.10, 0.20, 0.30][dashCdLvl - 1];
    state.metaAbilityMods.dashCooldownMult = 1 - pct;
  }
  const dashDistLvl = lvl('dash_distance');
  if (dashDistLvl > 0) {
    const pct = [0.10, 0.20, 0.30][dashDistLvl - 1];
    state.metaAbilityMods.dashDistanceMult = 1 + pct;
  }

  // Shield upgrades
  const shieldCdLvl = lvl('shield_cooldown');
  if (shieldCdLvl > 0) {
    const pct = [0.10, 0.20, 0.30][shieldCdLvl - 1];
    state.metaAbilityMods.shieldCooldownMult = 1 - pct;
  }
  const shieldDurLvl = lvl('shield_durability');
  if (shieldDurLvl > 0) {
    const pct = [0.10, 0.20, 0.30][shieldDurLvl - 1];
    state.metaAbilityMods.shieldDurabilityMult = 1 + pct;
  }

  // Invincible upgrades
  const invCdLvl = lvl('invincible_cooldown');
  if (invCdLvl > 0) {
    const pct = [0.10, 0.20, 0.30][invCdLvl - 1];
    state.metaAbilityMods.invincibleCooldownMult = 1 - pct;
  }
  const invDurLvl = lvl('invincible_duration');
  if (invDurLvl > 0) {
    const pct = [0.10, 0.20, 0.30][invDurLvl - 1];
    state.metaAbilityMods.invincibleDurationMult = 1 + pct;
  }

  // Grapple upgrades
  const grapCdLvl = lvl('grapple_cooldown');
  if (grapCdLvl > 0) {
    const pct = [0.10, 0.20, 0.30][grapCdLvl - 1];
    state.metaAbilityMods.grappleCooldownMult = 1 - pct;
  }
  if (lvl('grapple_resist') >= 1) {
    state.metaAbilityMods.grappleResist = true;
  }

  // Gears drop multiplier (stored for use in combat)
  const gearsLvl = lvl('gears_drop');
  state.metaGearsDropLevel = gearsLvl; // 0-5
}

// ============================================================
// GEARS DROP CALCULATION
// Uses the meta gears_drop level to calculate bonus gears
// Level 0: enemies drop very few gears (15% chance/rate)
// Level 1-5: Regular enemies drop increasing gears (20% to 100%)
// ============================================================
export function calculateGearsDrop(enemyMaxHealth, isBoss, metaGearsDropLevel) {
  const baseGears = Math.floor(enemyMaxHealth / 5);
  if (isBoss) return baseGears; // bosses always drop full gears

  if (metaGearsDropLevel <= 0) {
    // Level 0: Small drop rate (15%) instead of zero
    const chanceValue = baseGears * 0.15;
    if (chanceValue < 1) {
      return Math.random() < chanceValue ? 1 : 0;
    }
    return Math.floor(chanceValue);
  }

  // Scale: level 1 = 20%, 2 = 40%, 3 = 60%, 4 = 80%, 5 = 100%
  const pct = metaGearsDropLevel * 0.20;
  return Math.max(1, Math.floor(baseGears * pct));
}

// ============================================================
// GET ABILITY-SPECIFIC COOLDOWN (with meta mods)
// ============================================================
export function getAbilityCooldown(abilityType, metaMods, baseCooldowns) {
  const base = baseCooldowns[abilityType];
  if (!base || !metaMods) return base;

  const key = abilityType + 'CooldownMult';
  const mult = metaMods[key] || 1;
  return Math.floor(base * mult);
}

