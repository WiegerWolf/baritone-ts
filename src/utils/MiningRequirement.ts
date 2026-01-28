/**
 * MiningRequirement - Tool Requirements for Mining
 * Based on AltoClef/BaritonePlus MiningRequirement.java
 *
 * Defines the minimum tool tier required to mine specific blocks.
 */

/**
 * Mining requirement levels
 * Higher values can mine blocks requiring lower values
 */
export enum MiningRequirement {
  /** Can be mined with bare hands */
  HAND = 0,
  /** Requires at least a wooden pickaxe */
  WOOD = 1,
  /** Requires at least a stone pickaxe */
  STONE = 2,
  /** Requires at least an iron pickaxe */
  IRON = 3,
  /** Requires at least a diamond pickaxe */
  DIAMOND = 4,
  /** Requires a netherite pickaxe (currently same as diamond in vanilla) */
  NETHERITE = 5,
}

/**
 * Tool tier mapping
 */
export const PICKAXE_TIERS: Record<string, MiningRequirement> = {
  wooden_pickaxe: MiningRequirement.WOOD,
  stone_pickaxe: MiningRequirement.STONE,
  iron_pickaxe: MiningRequirement.IRON,
  golden_pickaxe: MiningRequirement.WOOD, // Gold is same tier as wood for mining
  diamond_pickaxe: MiningRequirement.DIAMOND,
  netherite_pickaxe: MiningRequirement.NETHERITE,
};

/**
 * Minimum pickaxe for each requirement level
 */
export const MINIMUM_PICKAXE: Record<MiningRequirement, string | null> = {
  [MiningRequirement.HAND]: null,
  [MiningRequirement.WOOD]: 'wooden_pickaxe',
  [MiningRequirement.STONE]: 'stone_pickaxe',
  [MiningRequirement.IRON]: 'iron_pickaxe',
  [MiningRequirement.DIAMOND]: 'diamond_pickaxe',
  [MiningRequirement.NETHERITE]: 'netherite_pickaxe',
};

/**
 * Blocks that require specific mining levels
 * Based on Minecraft's mining requirements
 */
const BLOCK_REQUIREMENTS: Record<string, MiningRequirement> = {
  // Stone tier blocks (wood pickaxe)
  stone: MiningRequirement.WOOD,
  cobblestone: MiningRequirement.WOOD,
  mossy_cobblestone: MiningRequirement.WOOD,
  sandstone: MiningRequirement.WOOD,
  red_sandstone: MiningRequirement.WOOD,
  dripstone_block: MiningRequirement.WOOD,
  pointed_dripstone: MiningRequirement.WOOD,
  copper_ore: MiningRequirement.STONE,
  cut_copper: MiningRequirement.STONE,
  deepslate: MiningRequirement.WOOD,
  cobbled_deepslate: MiningRequirement.WOOD,
  tuff: MiningRequirement.WOOD,
  calcite: MiningRequirement.WOOD,
  smooth_basalt: MiningRequirement.WOOD,
  andesite: MiningRequirement.WOOD,
  diorite: MiningRequirement.WOOD,
  granite: MiningRequirement.WOOD,
  polished_andesite: MiningRequirement.WOOD,
  polished_diorite: MiningRequirement.WOOD,
  polished_granite: MiningRequirement.WOOD,
  coal_ore: MiningRequirement.WOOD,
  deepslate_coal_ore: MiningRequirement.WOOD,
  nether_quartz_ore: MiningRequirement.WOOD,
  nether_gold_ore: MiningRequirement.WOOD,
  basalt: MiningRequirement.WOOD,
  polished_basalt: MiningRequirement.WOOD,
  netherrack: MiningRequirement.WOOD,
  blackstone: MiningRequirement.WOOD,
  polished_blackstone: MiningRequirement.WOOD,
  gilded_blackstone: MiningRequirement.WOOD,
  end_stone: MiningRequirement.WOOD,
  end_stone_bricks: MiningRequirement.WOOD,
  purpur_block: MiningRequirement.WOOD,
  purpur_pillar: MiningRequirement.WOOD,
  prismarine: MiningRequirement.WOOD,
  dark_prismarine: MiningRequirement.WOOD,
  prismarine_bricks: MiningRequirement.WOOD,
  terracotta: MiningRequirement.WOOD,

  // Stone tier blocks (stone pickaxe required)
  iron_ore: MiningRequirement.STONE,
  deepslate_iron_ore: MiningRequirement.STONE,
  raw_iron_block: MiningRequirement.STONE,
  iron_block: MiningRequirement.STONE,
  copper_block: MiningRequirement.STONE,
  raw_copper_block: MiningRequirement.STONE,
  cut_copper_slab: MiningRequirement.STONE,
  cut_copper_stairs: MiningRequirement.STONE,
  lapis_ore: MiningRequirement.STONE,
  deepslate_lapis_ore: MiningRequirement.STONE,
  lapis_block: MiningRequirement.STONE,

  // Iron tier blocks (iron pickaxe required)
  gold_ore: MiningRequirement.IRON,
  deepslate_gold_ore: MiningRequirement.IRON,
  raw_gold_block: MiningRequirement.IRON,
  gold_block: MiningRequirement.IRON,
  diamond_ore: MiningRequirement.IRON,
  deepslate_diamond_ore: MiningRequirement.IRON,
  diamond_block: MiningRequirement.IRON,
  emerald_ore: MiningRequirement.IRON,
  deepslate_emerald_ore: MiningRequirement.IRON,
  emerald_block: MiningRequirement.IRON,
  redstone_ore: MiningRequirement.IRON,
  deepslate_redstone_ore: MiningRequirement.IRON,

  // Diamond tier blocks (diamond pickaxe required)
  obsidian: MiningRequirement.DIAMOND,
  crying_obsidian: MiningRequirement.DIAMOND,
  respawn_anchor: MiningRequirement.DIAMOND,
  ancient_debris: MiningRequirement.DIAMOND,
  netherite_block: MiningRequirement.DIAMOND,
};

/**
 * Get the minimum mining requirement for a block
 * @param blockName The block name (e.g., 'diamond_ore')
 * @returns The mining requirement, or HAND if no special tool needed
 */
export function getMinimumRequirementForBlock(blockName: string): MiningRequirement {
  // Normalize block name
  const name = blockName.replace('minecraft:', '').toLowerCase();

  // Check direct mapping
  if (name in BLOCK_REQUIREMENTS) {
    return BLOCK_REQUIREMENTS[name];
  }

  // Check for patterns
  // All deepslate variants
  if (name.startsWith('deepslate_')) {
    const baseBlock = name.replace('deepslate_', '');
    if (baseBlock in BLOCK_REQUIREMENTS) {
      return BLOCK_REQUIREMENTS[baseBlock];
    }
  }

  // Colored terracotta
  if (name.endsWith('_terracotta') || name.endsWith('_glazed_terracotta')) {
    return MiningRequirement.WOOD;
  }

  // Stone brick variants
  if (name.includes('stone_brick') || name.includes('_bricks')) {
    return MiningRequirement.WOOD;
  }

  // Blackstone variants
  if (name.includes('blackstone')) {
    return MiningRequirement.WOOD;
  }

  // Copper variants
  if (name.includes('copper') && !name.includes('ore')) {
    return MiningRequirement.STONE;
  }

  // Ores follow material requirement
  if (name.endsWith('_ore')) {
    // Most ores we haven't mapped default to stone
    return MiningRequirement.STONE;
  }

  // Default: can be mined by hand
  return MiningRequirement.HAND;
}

/**
 * Get the minimum pickaxe item for a mining requirement
 * @param requirement The mining requirement level
 * @returns The pickaxe item name, or null if no pickaxe needed
 */
export function getMinimumPickaxe(requirement: MiningRequirement): string | null {
  return MINIMUM_PICKAXE[requirement];
}

/**
 * Check if a pickaxe meets the requirement
 * @param pickaxeName The pickaxe item name
 * @param requirement The required mining level
 * @returns True if the pickaxe can mine blocks at this level
 */
export function pickaxeMeetsRequirement(
  pickaxeName: string,
  requirement: MiningRequirement
): boolean {
  if (requirement === MiningRequirement.HAND) {
    return true; // Any tool or hand works
  }

  const tier = PICKAXE_TIERS[pickaxeName];
  if (tier === undefined) {
    return false; // Not a pickaxe
  }

  return tier >= requirement;
}

/**
 * Get the mining tier of a pickaxe
 * @param pickaxeName The pickaxe item name
 * @returns The mining tier, or HAND if not a pickaxe
 */
export function getPickaxeTier(pickaxeName: string): MiningRequirement {
  return PICKAXE_TIERS[pickaxeName] ?? MiningRequirement.HAND;
}

/**
 * Check if a tool is a pickaxe
 */
export function isPickaxe(itemName: string): boolean {
  return itemName in PICKAXE_TIERS;
}

/**
 * Get all pickaxes that can mine a specific block
 * @param blockName The block name
 * @returns Array of suitable pickaxe names
 */
export function getSuitablePickaxes(blockName: string): string[] {
  const requirement = getMinimumRequirementForBlock(blockName);

  if (requirement === MiningRequirement.HAND) {
    return []; // No pickaxe required
  }

  return Object.entries(PICKAXE_TIERS)
    .filter(([_, tier]) => tier >= requirement)
    .map(([name, _]) => name);
}

/**
 * Compare two mining requirements
 * @returns Negative if a < b, 0 if equal, positive if a > b
 */
export function compareMiningRequirements(
  a: MiningRequirement,
  b: MiningRequirement
): number {
  return a - b;
}

export default {
  MiningRequirement,
  PICKAXE_TIERS,
  MINIMUM_PICKAXE,
  getMinimumRequirementForBlock,
  getMinimumPickaxe,
  pickaxeMeetsRequirement,
  getPickaxeTier,
  isPickaxe,
  getSuitablePickaxes,
  compareMiningRequirements,
};
