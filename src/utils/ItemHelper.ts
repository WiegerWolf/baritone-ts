/**
 * ItemHelper - Item Definitions and Utilities
 * Based on AltoClef/BaritonePlus ItemHelper.java
 *
 * Provides:
 * - Item category definitions (saplings, planks, logs, tools, armor, etc.)
 * - Log-to-plank and plank-to-log conversions
 * - Wood type definitions
 * - Color item mappings
 * - Food cooking mappings
 * - Fuel calculations
 */

/**
 * Wood types in Minecraft
 */
export enum WoodType {
  OAK = 'oak',
  SPRUCE = 'spruce',
  BIRCH = 'birch',
  JUNGLE = 'jungle',
  ACACIA = 'acacia',
  DARK_OAK = 'dark_oak',
  CRIMSON = 'crimson',
  WARPED = 'warped',
  MANGROVE = 'mangrove',
  CHERRY = 'cherry',
  BAMBOO = 'bamboo',
}

/**
 * Dye colors in Minecraft
 */
export enum DyeColor {
  WHITE = 'white',
  ORANGE = 'orange',
  MAGENTA = 'magenta',
  LIGHT_BLUE = 'light_blue',
  YELLOW = 'yellow',
  LIME = 'lime',
  PINK = 'pink',
  GRAY = 'gray',
  LIGHT_GRAY = 'light_gray',
  CYAN = 'cyan',
  PURPLE = 'purple',
  BLUE = 'blue',
  BROWN = 'brown',
  GREEN = 'green',
  RED = 'red',
  BLACK = 'black',
}

// ============================================================================
// Item Category Definitions
// ============================================================================

export const SAPLINGS = [
  'oak_sapling',
  'spruce_sapling',
  'birch_sapling',
  'jungle_sapling',
  'acacia_sapling',
  'dark_oak_sapling',
  'mangrove_propagule',
  'cherry_sapling',
] as const;

export const SAPLING_SOURCES = [
  'oak_leaves',
  'spruce_leaves',
  'birch_leaves',
  'jungle_leaves',
  'acacia_leaves',
  'dark_oak_leaves',
  'mangrove_propagule',
  'cherry_leaves',
] as const;

export const PLANKS = [
  'oak_planks',
  'spruce_planks',
  'birch_planks',
  'jungle_planks',
  'acacia_planks',
  'dark_oak_planks',
  'crimson_planks',
  'warped_planks',
  'mangrove_planks',
  'cherry_planks',
  'bamboo_planks',
] as const;

export const LOGS = [
  'oak_log',
  'spruce_log',
  'birch_log',
  'jungle_log',
  'acacia_log',
  'dark_oak_log',
  'mangrove_log',
  'cherry_log',
  'oak_wood',
  'spruce_wood',
  'birch_wood',
  'jungle_wood',
  'acacia_wood',
  'dark_oak_wood',
  'mangrove_wood',
  'cherry_wood',
  'stripped_oak_log',
  'stripped_spruce_log',
  'stripped_birch_log',
  'stripped_jungle_log',
  'stripped_acacia_log',
  'stripped_dark_oak_log',
  'stripped_mangrove_log',
  'stripped_cherry_log',
  'stripped_oak_wood',
  'stripped_spruce_wood',
  'stripped_birch_wood',
  'stripped_jungle_wood',
  'stripped_acacia_wood',
  'stripped_dark_oak_wood',
  'stripped_mangrove_wood',
  'stripped_cherry_wood',
  'crimson_stem',
  'warped_stem',
  'crimson_hyphae',
  'warped_hyphae',
  'stripped_crimson_stem',
  'stripped_warped_stem',
  'stripped_crimson_hyphae',
  'stripped_warped_hyphae',
  'bamboo_block',
  'stripped_bamboo_block',
] as const;

export const LEAVES = [
  'oak_leaves',
  'spruce_leaves',
  'birch_leaves',
  'jungle_leaves',
  'acacia_leaves',
  'dark_oak_leaves',
  'mangrove_leaves',
  'cherry_leaves',
  'azalea_leaves',
  'flowering_azalea_leaves',
] as const;

export const DIRTS = ['dirt', 'dirt_path', 'coarse_dirt', 'rooted_dirt'] as const;

export const WOOL = [
  'white_wool',
  'orange_wool',
  'magenta_wool',
  'light_blue_wool',
  'yellow_wool',
  'lime_wool',
  'pink_wool',
  'gray_wool',
  'light_gray_wool',
  'cyan_wool',
  'purple_wool',
  'blue_wool',
  'brown_wool',
  'green_wool',
  'red_wool',
  'black_wool',
] as const;

export const BEDS = [
  'white_bed',
  'orange_bed',
  'magenta_bed',
  'light_blue_bed',
  'yellow_bed',
  'lime_bed',
  'pink_bed',
  'gray_bed',
  'light_gray_bed',
  'cyan_bed',
  'purple_bed',
  'blue_bed',
  'brown_bed',
  'green_bed',
  'red_bed',
  'black_bed',
] as const;

export const WOODEN_TOOLS = [
  'wooden_sword',
  'wooden_pickaxe',
  'wooden_axe',
  'wooden_shovel',
  'wooden_hoe',
] as const;

export const STONE_TOOLS = [
  'stone_sword',
  'stone_pickaxe',
  'stone_axe',
  'stone_shovel',
  'stone_hoe',
] as const;

export const IRON_TOOLS = [
  'iron_sword',
  'iron_pickaxe',
  'iron_axe',
  'iron_shovel',
  'iron_hoe',
] as const;

export const GOLDEN_TOOLS = [
  'golden_sword',
  'golden_pickaxe',
  'golden_axe',
  'golden_shovel',
  'golden_hoe',
] as const;

export const DIAMOND_TOOLS = [
  'diamond_sword',
  'diamond_pickaxe',
  'diamond_axe',
  'diamond_shovel',
  'diamond_hoe',
] as const;

export const NETHERITE_TOOLS = [
  'netherite_sword',
  'netherite_pickaxe',
  'netherite_axe',
  'netherite_shovel',
  'netherite_hoe',
] as const;

export const ALL_PICKAXES = [
  'wooden_pickaxe',
  'stone_pickaxe',
  'iron_pickaxe',
  'golden_pickaxe',
  'diamond_pickaxe',
  'netherite_pickaxe',
] as const;

export const ALL_AXES = [
  'wooden_axe',
  'stone_axe',
  'iron_axe',
  'golden_axe',
  'diamond_axe',
  'netherite_axe',
] as const;

export const ALL_SWORDS = [
  'wooden_sword',
  'stone_sword',
  'iron_sword',
  'golden_sword',
  'diamond_sword',
  'netherite_sword',
] as const;

export const LEATHER_ARMOR = [
  'leather_helmet',
  'leather_chestplate',
  'leather_leggings',
  'leather_boots',
] as const;

export const IRON_ARMOR = [
  'iron_helmet',
  'iron_chestplate',
  'iron_leggings',
  'iron_boots',
] as const;

export const GOLDEN_ARMOR = [
  'golden_helmet',
  'golden_chestplate',
  'golden_leggings',
  'golden_boots',
] as const;

export const DIAMOND_ARMOR = [
  'diamond_helmet',
  'diamond_chestplate',
  'diamond_leggings',
  'diamond_boots',
] as const;

export const NETHERITE_ARMOR = [
  'netherite_helmet',
  'netherite_chestplate',
  'netherite_leggings',
  'netherite_boots',
] as const;

export const BOATS = [
  'oak_boat',
  'spruce_boat',
  'birch_boat',
  'jungle_boat',
  'acacia_boat',
  'dark_oak_boat',
  'mangrove_boat',
  'cherry_boat',
  'bamboo_raft',
] as const;

// ============================================================================
// Mappings
// ============================================================================

/**
 * Log to planks mapping
 */
export const LOG_TO_PLANKS: Record<string, string> = {
  // Regular logs
  oak_log: 'oak_planks',
  spruce_log: 'spruce_planks',
  birch_log: 'birch_planks',
  jungle_log: 'jungle_planks',
  acacia_log: 'acacia_planks',
  dark_oak_log: 'dark_oak_planks',
  mangrove_log: 'mangrove_planks',
  cherry_log: 'cherry_planks',
  // Wood blocks
  oak_wood: 'oak_planks',
  spruce_wood: 'spruce_planks',
  birch_wood: 'birch_planks',
  jungle_wood: 'jungle_planks',
  acacia_wood: 'acacia_planks',
  dark_oak_wood: 'dark_oak_planks',
  mangrove_wood: 'mangrove_planks',
  cherry_wood: 'cherry_planks',
  // Stripped logs
  stripped_oak_log: 'oak_planks',
  stripped_spruce_log: 'spruce_planks',
  stripped_birch_log: 'birch_planks',
  stripped_jungle_log: 'jungle_planks',
  stripped_acacia_log: 'acacia_planks',
  stripped_dark_oak_log: 'dark_oak_planks',
  stripped_mangrove_log: 'mangrove_planks',
  stripped_cherry_log: 'cherry_planks',
  // Stripped wood
  stripped_oak_wood: 'oak_planks',
  stripped_spruce_wood: 'spruce_planks',
  stripped_birch_wood: 'birch_planks',
  stripped_jungle_wood: 'jungle_planks',
  stripped_acacia_wood: 'acacia_planks',
  stripped_dark_oak_wood: 'dark_oak_planks',
  stripped_mangrove_wood: 'mangrove_planks',
  stripped_cherry_wood: 'cherry_planks',
  // Nether stems/hyphae
  crimson_stem: 'crimson_planks',
  warped_stem: 'warped_planks',
  crimson_hyphae: 'crimson_planks',
  warped_hyphae: 'warped_planks',
  stripped_crimson_stem: 'crimson_planks',
  stripped_warped_stem: 'warped_planks',
  stripped_crimson_hyphae: 'crimson_planks',
  stripped_warped_hyphae: 'warped_planks',
  // Bamboo
  bamboo_block: 'bamboo_planks',
  stripped_bamboo_block: 'bamboo_planks',
};

/**
 * Planks to primary log mapping
 */
export const PLANKS_TO_LOG: Record<string, string> = {
  oak_planks: 'oak_log',
  spruce_planks: 'spruce_log',
  birch_planks: 'birch_log',
  jungle_planks: 'jungle_log',
  acacia_planks: 'acacia_log',
  dark_oak_planks: 'dark_oak_log',
  mangrove_planks: 'mangrove_log',
  cherry_planks: 'cherry_log',
  crimson_planks: 'crimson_stem',
  warped_planks: 'warped_stem',
  bamboo_planks: 'bamboo_block',
};

/**
 * Cookable food mapping (raw -> cooked)
 */
export const COOKABLE_FOOD: Record<string, string> = {
  porkchop: 'cooked_porkchop',
  beef: 'cooked_beef',
  chicken: 'cooked_chicken',
  mutton: 'cooked_mutton',
  rabbit: 'cooked_rabbit',
  salmon: 'cooked_salmon',
  cod: 'cooked_cod',
  potato: 'baked_potato',
};

export const RAW_FOODS = Object.keys(COOKABLE_FOOD);

/**
 * Fuel burn times in ticks
 * 200 ticks = 1 smelting operation
 */
export const FUEL_TIMES: Record<string, number> = {
  // Coal/charcoal
  coal: 1600,
  charcoal: 1600,
  coal_block: 16000,
  // Wood
  oak_planks: 300,
  spruce_planks: 300,
  birch_planks: 300,
  jungle_planks: 300,
  acacia_planks: 300,
  dark_oak_planks: 300,
  mangrove_planks: 300,
  cherry_planks: 300,
  crimson_planks: 300,
  warped_planks: 300,
  bamboo_planks: 300,
  oak_log: 300,
  spruce_log: 300,
  birch_log: 300,
  jungle_log: 300,
  acacia_log: 300,
  dark_oak_log: 300,
  mangrove_log: 300,
  cherry_log: 300,
  // Sticks
  stick: 100,
  // Blaze
  blaze_rod: 2400,
  // Lava bucket
  lava_bucket: 20000,
  // Dried kelp
  dried_kelp_block: 4001,
  // Bamboo
  bamboo: 50,
  // Scaffolding
  scaffolding: 50,
  // Carpet
  white_carpet: 67,
  orange_carpet: 67,
  // ... other carpets
  // Wool
  white_wool: 100,
  // ... other wool
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get planks item from a log item
 */
export function logToPlanks(logItem: string): string | null {
  return LOG_TO_PLANKS[logItem] ?? null;
}

/**
 * Get primary log item from planks item
 */
export function planksToLog(planksItem: string): string | null {
  return PLANKS_TO_LOG[planksItem] ?? null;
}

/**
 * Get cooked version of raw food
 */
export function getCookedFood(rawFood: string): string | null {
  return COOKABLE_FOOD[rawFood] ?? null;
}

/**
 * Check if item is raw food that can be cooked
 */
export function isRawFood(item: string): boolean {
  return item in COOKABLE_FOOD;
}

/**
 * Check if item is a fuel
 */
export function isFuel(item: string): boolean {
  return item in FUEL_TIMES;
}

/**
 * Get fuel amount in smelting operations
 */
export function getFuelAmount(item: string): number {
  const ticks = FUEL_TIMES[item];
  if (!ticks) return 0;
  return ticks / 200; // 200 ticks per operation
}

/**
 * Check if item is a log
 */
export function isLog(item: string): boolean {
  return (LOGS as readonly string[]).includes(item);
}

/**
 * Check if item is planks
 */
export function isPlanks(item: string): boolean {
  return (PLANKS as readonly string[]).includes(item);
}

/**
 * Check if item is a pickaxe
 */
export function isPickaxe(item: string): boolean {
  return (ALL_PICKAXES as readonly string[]).includes(item);
}

/**
 * Check if item is an axe
 */
export function isAxe(item: string): boolean {
  return (ALL_AXES as readonly string[]).includes(item);
}

/**
 * Check if item is a sword
 */
export function isSword(item: string): boolean {
  return (ALL_SWORDS as readonly string[]).includes(item);
}

/**
 * Check if item is a bed
 */
export function isBed(item: string): boolean {
  return (BEDS as readonly string[]).includes(item);
}

/**
 * Check if item is wool
 */
export function isWool(item: string): boolean {
  return (WOOL as readonly string[]).includes(item);
}

/**
 * Check if item is a boat
 */
export function isBoat(item: string): boolean {
  return (BOATS as readonly string[]).includes(item);
}

/**
 * Get tool tier (0=wood, 1=stone, 2=iron, 3=gold, 4=diamond, 5=netherite)
 */
export function getToolTier(item: string): number {
  if (item.startsWith('wooden_')) return 0;
  if (item.startsWith('stone_')) return 1;
  if (item.startsWith('iron_')) return 2;
  if (item.startsWith('golden_')) return 3;
  if (item.startsWith('diamond_')) return 4;
  if (item.startsWith('netherite_')) return 5;
  return -1;
}

/**
 * Get armor tier (0=leather, 1=gold, 2=chainmail, 3=iron, 4=diamond, 5=netherite)
 */
export function getArmorTier(item: string): number {
  if (item.startsWith('leather_')) return 0;
  if (item.startsWith('golden_')) return 1;
  if (item.startsWith('chainmail_')) return 2;
  if (item.startsWith('iron_')) return 3;
  if (item.startsWith('diamond_')) return 4;
  if (item.startsWith('netherite_')) return 5;
  return -1;
}

/**
 * Check if shears are effective against a block
 */
export function areShearsEffective(blockName: string): boolean {
  const effective = [
    ...LEAVES,
    ...WOOL,
    'cobweb',
    'short_grass',
    'grass',
    'tall_grass',
    'lily_pad',
    'fern',
    'large_fern',
    'dead_bush',
    'vine',
    'glow_lichen',
    'tripwire',
    'nether_sprouts',
    'weeping_vines',
    'twisting_vines',
  ];
  return effective.includes(blockName);
}

/**
 * Strip minecraft namespace from item name
 */
export function stripItemName(item: string): string {
  if (item.startsWith('minecraft:')) {
    return item.substring('minecraft:'.length);
  }
  return item;
}

/**
 * Get wood type from an item name
 */
export function getWoodTypeFromItem(item: string): WoodType | null {
  for (const type of Object.values(WoodType)) {
    if (item.includes(type)) {
      return type;
    }
  }
  // Handle special cases
  if (item.includes('crimson')) return WoodType.CRIMSON;
  if (item.includes('warped')) return WoodType.WARPED;
  return null;
}

/**
 * Get color from an item name
 */
export function getColorFromItem(item: string): DyeColor | null {
  for (const color of Object.values(DyeColor)) {
    if (item.startsWith(color + '_')) {
      return color;
    }
  }
  return null;
}

/**
 * Wood items for a specific wood type
 */
export interface WoodItems {
  planks: string;
  log: string;
  strippedLog: string;
  wood: string;
  strippedWood: string;
  stairs: string;
  slab: string;
  fence: string;
  fenceGate: string;
  door: string;
  trapdoor: string;
  pressurePlate: string;
  button: string;
  sign: string;
  boat: string | null;
  sapling: string | null;
  leaves: string | null;
}

/**
 * Get all wood items for a wood type
 */
export function getWoodItems(type: WoodType): WoodItems {
  const isNether = type === WoodType.CRIMSON || type === WoodType.WARPED;
  const logSuffix = isNether ? 'stem' : 'log';
  const woodSuffix = isNether ? 'hyphae' : 'wood';

  return {
    planks: `${type}_planks`,
    log: `${type}_${logSuffix}`,
    strippedLog: `stripped_${type}_${logSuffix}`,
    wood: `${type}_${woodSuffix}`,
    strippedWood: `stripped_${type}_${woodSuffix}`,
    stairs: `${type}_stairs`,
    slab: `${type}_slab`,
    fence: `${type}_fence`,
    fenceGate: `${type}_fence_gate`,
    door: `${type}_door`,
    trapdoor: `${type}_trapdoor`,
    pressurePlate: `${type}_pressure_plate`,
    button: `${type}_button`,
    sign: `${type}_sign`,
    boat: isNether ? null : `${type}_boat`,
    sapling: isNether ? `${type}_fungus` : (type === WoodType.MANGROVE ? 'mangrove_propagule' : `${type}_sapling`),
    leaves: isNether ? null : `${type}_leaves`,
  };
}

export default {
  WoodType,
  DyeColor,
  SAPLINGS,
  PLANKS,
  LOGS,
  LEAVES,
  WOOL,
  BEDS,
  ALL_PICKAXES,
  ALL_AXES,
  ALL_SWORDS,
  BOATS,
  LOG_TO_PLANKS,
  PLANKS_TO_LOG,
  COOKABLE_FOOD,
  RAW_FOODS,
  FUEL_TIMES,
  logToPlanks,
  planksToLog,
  getCookedFood,
  isRawFood,
  isFuel,
  getFuelAmount,
  isLog,
  isPlanks,
  isPickaxe,
  isAxe,
  isSword,
  isBed,
  isWool,
  isBoat,
  getToolTier,
  getArmorTier,
  areShearsEffective,
  stripItemName,
  getWoodTypeFromItem,
  getColorFromItem,
  getWoodItems,
};
