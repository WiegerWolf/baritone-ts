/**
 * BotSettings - Configuration Interface
 * Based on AltoClef's Settings.java
 *
 * Defines all configurable bot behavior parameters.
 * Settings can be loaded from JSON and hot-reloaded at runtime.
 */

/**
 * Pathfinding settings
 */
export interface PathfindingSettings {
  /** Avoid lava when pathfinding */
  avoidLava: boolean;
  /** Avoid fire when pathfinding */
  avoidFire: boolean;
  /** Avoid cacti when pathfinding */
  avoidCacti: boolean;
  /** Allow swimming through water */
  allowSwimming: boolean;
  /** Allow breaking blocks while pathfinding */
  allowBreaking: boolean;
  /** Allow placing blocks while pathfinding */
  allowPlacing: boolean;
  /** Maximum pathfinding range in blocks */
  pathingRange: number;
  /** Blocks to avoid stepping on */
  avoidBlocks: string[];
}

/**
 * Combat settings
 */
export interface CombatSettings {
  /** Automatically attack hostile mobs */
  attackHostiles: boolean;
  /** Flee from creepers (don't fight) */
  fleeCreepers: boolean;
  /** Maximum combat engagement range */
  combatRange: number;
  /** Minimum health to continue fighting */
  minHealthToFight: number;
  /** Enable shield usage */
  useShield: boolean;
  /** Kite while attacking (strafe) */
  kiteWhileAttacking: boolean;
  /** Entity types to never attack */
  neverAttack: string[];
  /** Entity types to always flee from */
  alwaysFlee: string[];
}

/**
 * Food settings
 */
export interface FoodSettings {
  /** Hunger level to start eating at */
  eatWhenHunger: number;
  /** Allow eating rotten flesh */
  eatRottenFlesh: boolean;
  /** Allow eating spider eyes */
  eatSpiderEyes: boolean;
  /** Allow eating pufferfish */
  eatPufferfish: boolean;
  /** Prioritize saturation over hunger points */
  prioritizeSaturation: boolean;
  /** Foods to never eat */
  neverEat: string[];
}

/**
 * Safety settings
 */
export interface SafetySettings {
  /** Enable MLG water bucket on fatal falls */
  mlgBucket: boolean;
  /** Automatically respawn on death */
  autoRespawn: boolean;
  /** Break blocks above when suffocating */
  breakWhenSuffocating: boolean;
  /** Minimum health to consider "danger" */
  dangerHealthThreshold: number;
  /** Pause tasks when in danger */
  pauseWhenDanger: boolean;
}

/**
 * Mining settings
 */
export interface MiningSettings {
  /** Maximum depth to mine */
  maxMineDepth: number;
  /** Minimum depth to mine */
  minMineDepth: number;
  /** Prefer fortune-applicable ores when have fortune */
  useFortuneWhenAvailable: boolean;
  /** Prefer silk touch for certain blocks */
  useSilkTouchFor: string[];
  /** Blocks to never mine */
  neverMine: string[];
}

/**
 * Container/Storage settings
 */
export interface StorageSettings {
  /** Store excess items in containers */
  storeExcessItems: boolean;
  /** Items to always keep in inventory */
  alwaysKeep: string[];
  /** Items safe to throw away when full */
  throwawayItems: string[];
  /** Maximum items to keep in inventory (per item type) */
  maxStacksPerItem: number;
}

/**
 * Misc settings
 */
export interface MiscSettings {
  /** Print debug messages */
  debugMode: boolean;
  /** Log task changes */
  logTaskChanges: boolean;
  /** Log chain changes */
  logChainChanges: boolean;
  /** Render debug overlays (if supported) */
  renderDebug: boolean;
}

/**
 * Complete bot settings interface
 */
export interface BotSettings {
  pathfinding: PathfindingSettings;
  combat: CombatSettings;
  food: FoodSettings;
  safety: SafetySettings;
  mining: MiningSettings;
  storage: StorageSettings;
  misc: MiscSettings;
}

/**
 * Default pathfinding settings
 */
export const DEFAULT_PATHFINDING: PathfindingSettings = {
  avoidLava: true,
  avoidFire: true,
  avoidCacti: true,
  allowSwimming: true,
  allowBreaking: true,
  allowPlacing: true,
  pathingRange: 128,
  avoidBlocks: ['sweet_berry_bush', 'magma_block', 'campfire', 'soul_campfire'],
};

/**
 * Default combat settings
 */
export const DEFAULT_COMBAT: CombatSettings = {
  attackHostiles: true,
  fleeCreepers: true,
  combatRange: 5,
  minHealthToFight: 6, // 3 hearts
  useShield: true,
  kiteWhileAttacking: true,
  neverAttack: ['iron_golem', 'snow_golem', 'villager', 'wandering_trader'],
  alwaysFlee: ['warden'],
};

/**
 * Default food settings
 */
export const DEFAULT_FOOD: FoodSettings = {
  eatWhenHunger: 14, // 7 hunger points
  eatRottenFlesh: false,
  eatSpiderEyes: false,
  eatPufferfish: false,
  prioritizeSaturation: true,
  neverEat: ['chorus_fruit'], // Teleport effect
};

/**
 * Default safety settings
 */
export const DEFAULT_SAFETY: SafetySettings = {
  mlgBucket: true,
  autoRespawn: true,
  breakWhenSuffocating: true,
  dangerHealthThreshold: 10, // 5 hearts
  pauseWhenDanger: false,
};

/**
 * Default mining settings
 */
export const DEFAULT_MINING: MiningSettings = {
  maxMineDepth: -60, // Bedrock level in 1.18+
  minMineDepth: 320, // Build limit
  useFortuneWhenAvailable: true,
  useSilkTouchFor: ['glass', 'glowstone', 'ice', 'packed_ice', 'blue_ice'],
  neverMine: ['spawner', 'bedrock', 'end_portal_frame'],
};

/**
 * Default storage settings
 */
export const DEFAULT_STORAGE: StorageSettings = {
  storeExcessItems: true,
  alwaysKeep: [
    'diamond', 'emerald', 'netherite_ingot',
    'ender_pearl', 'blaze_rod', 'ender_eye',
    'totem_of_undying', 'elytra', 'trident',
  ],
  throwawayItems: [
    'cobblestone', 'cobbled_deepslate', 'dirt', 'gravel', 'sand',
    'netherrack', 'andesite', 'diorite', 'granite', 'tuff',
    'rotten_flesh', 'poisonous_potato', 'spider_eye',
  ],
  maxStacksPerItem: 3,
};

/**
 * Default misc settings
 */
export const DEFAULT_MISC: MiscSettings = {
  debugMode: false,
  logTaskChanges: true,
  logChainChanges: true,
  renderDebug: false,
};

/**
 * Complete default settings
 */
export const DEFAULT_SETTINGS: BotSettings = {
  pathfinding: DEFAULT_PATHFINDING,
  combat: DEFAULT_COMBAT,
  food: DEFAULT_FOOD,
  safety: DEFAULT_SAFETY,
  mining: DEFAULT_MINING,
  storage: DEFAULT_STORAGE,
  misc: DEFAULT_MISC,
};

/**
 * Deep merge settings objects
 */
export function mergeSettings(
  base: BotSettings,
  overrides: Partial<BotSettings>
): BotSettings {
  return {
    pathfinding: { ...base.pathfinding, ...overrides.pathfinding },
    combat: { ...base.combat, ...overrides.combat },
    food: { ...base.food, ...overrides.food },
    safety: { ...base.safety, ...overrides.safety },
    mining: { ...base.mining, ...overrides.mining },
    storage: { ...base.storage, ...overrides.storage },
    misc: { ...base.misc, ...overrides.misc },
  };
}

/**
 * Validate settings object
 */
export function validateSettings(settings: Partial<BotSettings>): string[] {
  const errors: string[] = [];

  // Validate pathfinding
  if (settings.pathfinding) {
    if (settings.pathfinding.pathingRange !== undefined) {
      if (settings.pathfinding.pathingRange < 1 || settings.pathfinding.pathingRange > 256) {
        errors.push('pathfinding.pathingRange must be between 1 and 256');
      }
    }
  }

  // Validate combat
  if (settings.combat) {
    if (settings.combat.combatRange !== undefined) {
      if (settings.combat.combatRange < 1 || settings.combat.combatRange > 10) {
        errors.push('combat.combatRange must be between 1 and 10');
      }
    }
    if (settings.combat.minHealthToFight !== undefined) {
      if (settings.combat.minHealthToFight < 0 || settings.combat.minHealthToFight > 20) {
        errors.push('combat.minHealthToFight must be between 0 and 20');
      }
    }
  }

  // Validate food
  if (settings.food) {
    if (settings.food.eatWhenHunger !== undefined) {
      if (settings.food.eatWhenHunger < 0 || settings.food.eatWhenHunger > 20) {
        errors.push('food.eatWhenHunger must be between 0 and 20');
      }
    }
  }

  // Validate safety
  if (settings.safety) {
    if (settings.safety.dangerHealthThreshold !== undefined) {
      if (settings.safety.dangerHealthThreshold < 0 || settings.safety.dangerHealthThreshold > 20) {
        errors.push('safety.dangerHealthThreshold must be between 0 and 20');
      }
    }
  }

  return errors;
}
