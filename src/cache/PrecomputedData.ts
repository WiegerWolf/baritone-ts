import type { Block } from 'prismarine-block';
import { Passability, PathingBlockType } from '../types';

/**
 * Bit flags for precomputed block properties
 * Each block state gets 1 byte with these flags
 */
const CAN_WALK_ON_BIT = 0;
const CAN_WALK_THROUGH_BIT = 1;
const FULLY_PASSABLE_BIT = 2;
const IS_WATER_BIT = 3;
const IS_LAVA_BIT = 4;
const AVOID_BREAKING_BIT = 5;
const IS_CLIMBABLE_BIT = 6;
const IS_FALLING_BLOCK_BIT = 7;

/**
 * PrecomputedData caches block properties for O(1) lookup during pathfinding
 *
 * Instead of checking block properties every time (instanceof, shape queries),
 * we precompute properties for all block states at initialization.
 */
export class PrecomputedData {
  private data: Map<number, number> = new Map();
  private blockNames: Map<string, number> = new Map();

  // Block categories
  private readonly waterBlocks: Set<string> = new Set(['water', 'flowing_water']);
  private readonly lavaBlocks: Set<string> = new Set(['lava', 'flowing_lava']);

  private readonly climbableBlocks: Set<string> = new Set([
    'ladder', 'vine', 'scaffolding', 'weeping_vines', 'twisting_vines',
    'weeping_vines_plant', 'twisting_vines_plant', 'cave_vines',
    'cave_vines_plant'
  ]);

  private readonly avoidBreakingBlocks: Set<string> = new Set([
    'bedrock', 'spawner', 'mob_spawner', 'chest', 'trapped_chest',
    'ender_chest', 'shulker_box', 'barrel', 'furnace', 'blast_furnace',
    'smoker', 'brewing_stand', 'enchanting_table', 'anvil',
    'chipped_anvil', 'damaged_anvil', 'beacon', 'conduit',
    'end_portal_frame', 'command_block', 'chain_command_block',
    'repeating_command_block', 'structure_block', 'jigsaw'
  ]);

  private readonly dangerBlocks: Set<string> = new Set([
    'fire', 'soul_fire', 'lava', 'flowing_lava', 'cactus',
    'sweet_berry_bush', 'wither_rose', 'magma_block', 'campfire',
    'soul_campfire', 'cobweb', 'web', 'powder_snow'
  ]);

  private readonly fallingBlocks: Set<string> = new Set([
    'sand', 'red_sand', 'gravel', 'anvil', 'chipped_anvil',
    'damaged_anvil', 'concrete_powder', 'dragon_egg', 'scaffolding',
    'pointed_dripstone'
  ]);

  private readonly passableBlocks: Set<string> = new Set([
    'air', 'cave_air', 'void_air', 'grass', 'tall_grass', 'fern',
    'large_fern', 'dead_bush', 'seagrass', 'tall_seagrass', 'kelp',
    'kelp_plant', 'bamboo_sapling', 'sugar_cane', 'torch', 'wall_torch',
    'soul_torch', 'soul_wall_torch', 'redstone_torch', 'redstone_wall_torch',
    'rail', 'powered_rail', 'detector_rail', 'activator_rail',
    'tripwire', 'tripwire_hook', 'redstone_wire', 'lever',
    'stone_button', 'oak_button', 'spruce_button', 'birch_button',
    'jungle_button', 'acacia_button', 'dark_oak_button', 'crimson_button',
    'warped_button', 'stone_pressure_plate', 'oak_pressure_plate',
    'spruce_pressure_plate', 'birch_pressure_plate', 'jungle_pressure_plate',
    'acacia_pressure_plate', 'dark_oak_pressure_plate', 'crimson_pressure_plate',
    'warped_pressure_plate', 'light_weighted_pressure_plate',
    'heavy_weighted_pressure_plate', 'sign', 'wall_sign', 'oak_sign',
    'oak_wall_sign', 'spruce_sign', 'spruce_wall_sign', 'flower_pot',
    'attached_pumpkin_stem', 'attached_melon_stem', 'pumpkin_stem',
    'melon_stem', 'wheat', 'carrots', 'potatoes', 'beetroots',
    'nether_wart', 'cocoa'
  ]);

  private readonly fenceBlocks: Set<string> = new Set([
    'oak_fence', 'spruce_fence', 'birch_fence', 'jungle_fence',
    'acacia_fence', 'dark_oak_fence', 'crimson_fence', 'warped_fence',
    'nether_brick_fence', 'cobblestone_wall', 'mossy_cobblestone_wall',
    'brick_wall', 'prismarine_wall', 'red_sandstone_wall',
    'mossy_stone_brick_wall', 'granite_wall', 'stone_brick_wall',
    'nether_brick_wall', 'andesite_wall', 'red_nether_brick_wall',
    'sandstone_wall', 'end_stone_brick_wall', 'diorite_wall',
    'blackstone_wall', 'polished_blackstone_wall',
    'polished_blackstone_brick_wall', 'cobbled_deepslate_wall',
    'polished_deepslate_wall', 'deepslate_brick_wall', 'deepslate_tile_wall'
  ]);

  private readonly carpetBlocks: Set<string> = new Set([
    'white_carpet', 'orange_carpet', 'magenta_carpet', 'light_blue_carpet',
    'yellow_carpet', 'lime_carpet', 'pink_carpet', 'gray_carpet',
    'light_gray_carpet', 'cyan_carpet', 'purple_carpet', 'blue_carpet',
    'brown_carpet', 'green_carpet', 'red_carpet', 'black_carpet',
    'moss_carpet', 'snow'
  ]);

  private readonly openableBlocks: Set<string> = new Set([
    'oak_door', 'spruce_door', 'birch_door', 'jungle_door',
    'acacia_door', 'dark_oak_door', 'crimson_door', 'warped_door',
    'oak_fence_gate', 'spruce_fence_gate', 'birch_fence_gate',
    'jungle_fence_gate', 'acacia_fence_gate', 'dark_oak_fence_gate',
    'crimson_fence_gate', 'warped_fence_gate', 'oak_trapdoor',
    'spruce_trapdoor', 'birch_trapdoor', 'jungle_trapdoor',
    'acacia_trapdoor', 'dark_oak_trapdoor', 'crimson_trapdoor',
    'warped_trapdoor'
  ]);

  constructor(registry?: any) {
    if (registry) {
      this.initFromRegistry(registry);
    }
  }

  /**
   * Initialize from Minecraft registry
   */
  initFromRegistry(registry: any): void {
    if (!registry.blocksArray) return;

    for (const block of registry.blocksArray) {
      const id = block.id;
      const name = block.name;

      this.blockNames.set(name, id);

      let flags = 0;

      // Can walk on (has collision, not a fence)
      if (block.boundingBox === 'block' && !this.fenceBlocks.has(name)) {
        flags |= (1 << CAN_WALK_ON_BIT);
      }

      // Can walk through
      if (this.isBlockPassable(name, block)) {
        flags |= (1 << CAN_WALK_THROUGH_BIT);
      }

      // Fully passable (no collision at all)
      if (block.boundingBox === 'empty' || this.passableBlocks.has(name)) {
        flags |= (1 << FULLY_PASSABLE_BIT);
      }

      // Water
      if (this.waterBlocks.has(name)) {
        flags |= (1 << IS_WATER_BIT);
      }

      // Lava
      if (this.lavaBlocks.has(name)) {
        flags |= (1 << IS_LAVA_BIT);
      }

      // Avoid breaking
      if (this.avoidBreakingBlocks.has(name) || !block.diggable) {
        flags |= (1 << AVOID_BREAKING_BIT);
      }

      // Climbable
      if (this.climbableBlocks.has(name)) {
        flags |= (1 << IS_CLIMBABLE_BIT);
      }

      // Falling block
      if (this.fallingBlocks.has(name) ||
          (name.includes('concrete_powder') && !name.includes('concrete'))) {
        flags |= (1 << IS_FALLING_BLOCK_BIT);
      }

      this.data.set(id, flags);
    }
  }

  private isBlockPassable(name: string, block: any): boolean {
    if (this.passableBlocks.has(name)) return true;
    if (this.carpetBlocks.has(name)) return true;
    if (this.climbableBlocks.has(name)) return true;
    if (this.waterBlocks.has(name)) return true;
    if (block.boundingBox === 'empty') return true;
    return false;
  }

  /**
   * Check if block can be walked on
   */
  canWalkOn(blockId: number): boolean {
    const flags = this.data.get(blockId) ?? 0;
    return (flags & (1 << CAN_WALK_ON_BIT)) !== 0;
  }

  /**
   * Check if block can be walked through
   */
  canWalkThrough(blockId: number): boolean {
    const flags = this.data.get(blockId) ?? 0;
    return (flags & (1 << CAN_WALK_THROUGH_BIT)) !== 0;
  }

  /**
   * Check if block is fully passable (no collision)
   */
  isFullyPassable(blockId: number): boolean {
    const flags = this.data.get(blockId) ?? 0;
    return (flags & (1 << FULLY_PASSABLE_BIT)) !== 0;
  }

  /**
   * Check if block is water
   */
  isWater(blockId: number): boolean {
    const flags = this.data.get(blockId) ?? 0;
    return (flags & (1 << IS_WATER_BIT)) !== 0;
  }

  /**
   * Check if block is lava
   */
  isLava(blockId: number): boolean {
    const flags = this.data.get(blockId) ?? 0;
    return (flags & (1 << IS_LAVA_BIT)) !== 0;
  }

  /**
   * Check if block should be avoided when breaking
   */
  avoidBreaking(blockId: number): boolean {
    const flags = this.data.get(blockId) ?? 0;
    return (flags & (1 << AVOID_BREAKING_BIT)) !== 0;
  }

  /**
   * Check if block is climbable (ladder, vine, etc.)
   */
  isClimbable(blockId: number): boolean {
    const flags = this.data.get(blockId) ?? 0;
    return (flags & (1 << IS_CLIMBABLE_BIT)) !== 0;
  }

  /**
   * Check if block is affected by gravity
   */
  isFallingBlock(blockId: number): boolean {
    const flags = this.data.get(blockId) ?? 0;
    return (flags & (1 << IS_FALLING_BLOCK_BIT)) !== 0;
  }

  /**
   * Get ternary passability classification for pathfinding
   */
  getPassability(blockId: number, name: string): Passability {
    // Doors and fence gates need position check (open state)
    if (this.openableBlocks.has(name)) {
      return Passability.MAYBE;
    }

    // Trapdoors need position check
    if (name.includes('trapdoor')) {
      return Passability.MAYBE;
    }

    // Most blocks can be classified definitively
    if (this.canWalkThrough(blockId)) {
      return Passability.YES;
    }

    return Passability.NO;
  }

  /**
   * Get PathingBlockType for chunk caching (2-bit encoding)
   */
  getPathingBlockType(blockId: number): PathingBlockType {
    if (this.isWater(blockId)) return PathingBlockType.WATER;
    if (this.isLava(blockId) || this.isDangerous(blockId)) return PathingBlockType.AVOID;
    if (this.isFullyPassable(blockId)) return PathingBlockType.AIR;
    return PathingBlockType.SOLID;
  }

  /**
   * Check if block is dangerous
   */
  isDangerous(blockId: number): boolean {
    const name = this.getBlockName(blockId);
    return name !== null && this.dangerBlocks.has(name);
  }

  /**
   * Check if block is a fence (taller than 1 block)
   */
  isFence(blockId: number): boolean {
    const name = this.getBlockName(blockId);
    return name !== null && this.fenceBlocks.has(name);
  }

  /**
   * Check if block is a carpet (very thin)
   */
  isCarpet(blockId: number): boolean {
    const name = this.getBlockName(blockId);
    return name !== null && this.carpetBlocks.has(name);
  }

  /**
   * Check if block is openable (door, fence gate, trapdoor)
   */
  isOpenable(blockId: number): boolean {
    const name = this.getBlockName(blockId);
    return name !== null && this.openableBlocks.has(name);
  }

  private getBlockName(blockId: number): string | null {
    for (const [name, id] of this.blockNames) {
      if (id === blockId) return name;
    }
    return null;
  }
}
