/**
 * WorldHelper - World Information Utilities
 * Based on AltoClef/BaritonePlus WorldHelper.java
 *
 * Provides utility functions for:
 * - Dimension detection
 * - Block/position calculations
 * - Terrain analysis
 * - World state queries
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';

/**
 * World Y-level bounds (1.18+)
 */
export const WORLD_CEILING_Y = 255;
export const WORLD_FLOOR_Y = -64;

/**
 * Dimension types
 */
export enum Dimension {
  OVERWORLD = 'overworld',
  NETHER = 'the_nether',
  END = 'the_end',
}

/**
 * Block position type
 */
export interface BlockPos {
  x: number;
  y: number;
  z: number;
}

/**
 * Get the current tick count
 */
export function getTicks(bot: Bot): number {
  return bot.time.time;
}

/**
 * Convert BlockPos to Vec3 (center of block)
 */
export function toVec3(pos: BlockPos | null): Vec3 | null {
  if (!pos) return null;
  return new Vec3(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);
}

/**
 * Convert Vec3 to BlockPos (floor)
 */
export function toBlockPos(pos: Vec3 | null): BlockPos | null {
  if (!pos) return null;
  return {
    x: Math.floor(pos.x),
    y: Math.floor(pos.y),
    z: Math.floor(pos.z),
  };
}

/**
 * Get the current dimension
 */
export function getCurrentDimension(bot: Bot): Dimension {
  const dimension = (bot.game as any).dimension;
  if (!dimension) return Dimension.OVERWORLD;

  if (dimension.includes('nether')) return Dimension.NETHER;
  if (dimension.includes('end')) return Dimension.END;
  return Dimension.OVERWORLD;
}

/**
 * Check if position is a fluid source block
 */
export function isSourceBlock(bot: Bot, pos: BlockPos, onlyAcceptStill: boolean = true): boolean {
  const block = bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
  if (!block) return false;

  if (block.name !== 'water' && block.name !== 'lava') {
    return false;
  }

  // Check if still/source (metadata 0 = source)
  const level = block.metadata & 0x7;
  if (onlyAcceptStill && level !== 0) {
    return false;
  }

  // Ignore if there's liquid above
  const above = bot.blockAt(new Vec3(pos.x, pos.y + 1, pos.z));
  if (above && (above.name === 'water' || above.name === 'lava')) {
    return false;
  }

  return level === 0;
}

/**
 * Calculate XZ distance squared
 */
export function distanceXZSquared(from: Vec3, to: Vec3): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  return dx * dx + dz * dz;
}

/**
 * Calculate XZ distance
 */
export function distanceXZ(from: Vec3, to: Vec3): number {
  return Math.sqrt(distanceXZSquared(from, to));
}

/**
 * Check if within XZ range
 */
export function inRangeXZ(from: Vec3 | BlockPos, to: Vec3 | BlockPos, range: number): boolean {
  const fromVec = from instanceof Vec3 ? from : new Vec3(from.x, from.y, from.z);
  const toVec = to instanceof Vec3 ? to : new Vec3(to.x, to.y, to.z);
  return distanceXZSquared(fromVec, toVec) < range * range;
}

/**
 * Check if block is solid
 */
export function isSolid(bot: Bot, pos: BlockPos): boolean {
  const block = bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
  if (!block) return false;

  // Check boundingBox - solid blocks have 'block' type
  return block.boundingBox === 'block';
}

/**
 * Check if block is air
 */
export function isAir(bot: Bot, pos: BlockPos): boolean {
  const block = bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
  if (!block) return true;
  return block.name === 'air' || block.name === 'cave_air' || block.name === 'void_air';
}

/**
 * Check if block name is air
 */
export function isAirBlock(blockName: string): boolean {
  return blockName === 'air' || blockName === 'cave_air' || blockName === 'void_air';
}

/**
 * Get ground height at XZ coordinates
 */
export function getGroundHeight(bot: Bot, x: number, z: number, groundBlocks?: string[]): number {
  for (let y = WORLD_CEILING_Y; y >= WORLD_FLOOR_Y; y--) {
    const pos = { x, y, z };
    const block = bot.blockAt(new Vec3(x, y, z));

    if (!block) continue;

    if (groundBlocks) {
      if (groundBlocks.includes(block.name)) {
        return y;
      }
    } else if (isSolid(bot, pos)) {
      return y;
    }
  }
  return -1;
}

/**
 * Check if a block is interactable (chest, crafting table, etc.)
 */
export function isInteractableBlock(bot: Bot, pos: BlockPos): boolean {
  const block = bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
  if (!block) return false;

  const interactable = [
    'chest',
    'trapped_chest',
    'ender_chest',
    'crafting_table',
    'furnace',
    'blast_furnace',
    'smoker',
    'loom',
    'cartography_table',
    'enchanting_table',
    'barrel',
    'brewing_stand',
    'anvil',
    'chipped_anvil',
    'damaged_anvil',
    'grindstone',
    'smithing_table',
    'stonecutter',
    'shulker_box',
  ];

  // Check base name for colored shulker boxes
  return interactable.includes(block.name) || block.name.includes('shulker_box');
}

/**
 * Check if block is a chest
 */
export function isChest(block: Block | null): boolean {
  if (!block) return false;
  return block.name === 'chest' ||
         block.name === 'trapped_chest' ||
         block.name === 'ender_chest';
}

/**
 * Check if block is lava
 */
export function isLava(block: Block | null): boolean {
  if (!block) return false;
  return block.name === 'lava';
}

/**
 * Check if block is water
 */
export function isWater(block: Block | null): boolean {
  if (!block) return false;
  return block.name === 'water';
}

/**
 * Check if block is a falling block type
 */
export function isFallingBlock(block: Block | null): boolean {
  if (!block) return false;
  const fallingBlocks = [
    'sand',
    'red_sand',
    'gravel',
    'anvil',
    'chipped_anvil',
    'damaged_anvil',
    'white_concrete_powder',
    'orange_concrete_powder',
    'magenta_concrete_powder',
    'light_blue_concrete_powder',
    'yellow_concrete_powder',
    'lime_concrete_powder',
    'pink_concrete_powder',
    'gray_concrete_powder',
    'light_gray_concrete_powder',
    'cyan_concrete_powder',
    'purple_concrete_powder',
    'blue_concrete_powder',
    'brown_concrete_powder',
    'green_concrete_powder',
    'red_concrete_powder',
    'black_concrete_powder',
    'dragon_egg',
    'scaffolding',
    'pointed_dripstone',
  ];
  return fallingBlocks.includes(block.name);
}

/**
 * Check if it's dangerous to break block if standing right above
 */
export function dangerousToBreakIfRightAbove(bot: Bot, toBreak: BlockPos): boolean {
  // Check if there's danger below
  for (let dy = 1; dy <= toBreak.y - WORLD_FLOOR_Y; dy++) {
    const check = { x: toBreak.x, y: toBreak.y - dy, z: toBreak.z };
    const block = bot.blockAt(new Vec3(check.x, check.y, check.z));

    if (!block) continue;

    // Don't fall in lava
    if (isLava(block)) return true;

    // Water is OK (though depth matters)
    if (isWater(block)) return false;

    // Check if we hit solid ground
    if (isSolid(bot, check)) {
      // Depends on fall distance
      const maxFall = 3; // Default safe fall height
      return dy > maxFall;
    }
  }

  // Falling through void is dangerous
  return true;
}

/**
 * Check if can sleep (time and server conditions)
 */
export function canSleep(bot: Bot): boolean {
  const time = bot.time.timeOfDay;

  // Check if thunderstorm (can sleep during thunderstorms)
  if ((bot as any).thunderState > 0 && (bot as any).rainState > 0) {
    return true;
  }

  // Normal sleep times: 12542 - 23992
  return time >= 12542 && time <= 23992;
}

/**
 * Get positions of blocks touching player's bounding box
 */
export function getBlocksTouchingPlayer(bot: Bot): BlockPos[] {
  if (!bot.entity) return [];

  const pos = bot.entity.position;
  const width = 0.6; // Player width
  const height = 1.8; // Player height

  const minX = Math.floor(pos.x - width / 2);
  const maxX = Math.floor(pos.x + width / 2);
  const minY = Math.floor(pos.y);
  const maxY = Math.floor(pos.y + height);
  const minZ = Math.floor(pos.z - width / 2);
  const maxZ = Math.floor(pos.z + width / 2);

  const blocks: BlockPos[] = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        blocks.push({ x, y, z });
      }
    }
  }

  return blocks;
}

/**
 * Scan a region of blocks
 */
export function* scanRegion(start: BlockPos, end: BlockPos): Generator<BlockPos> {
  for (let y = start.y; y <= end.y; y++) {
    for (let z = start.z; z <= end.z; z++) {
      for (let x = start.x; x <= end.x; x++) {
        yield { x, y, z };
      }
    }
  }
}

/**
 * Convert Nether position to Overworld equivalent
 */
export function getOverworldPosition(pos: Vec3 | BlockPos, currentDimension: Dimension): Vec3 {
  const vec = pos instanceof Vec3 ? pos : new Vec3(pos.x, pos.y, pos.z);

  if (currentDimension === Dimension.NETHER) {
    return new Vec3(vec.x * 8, vec.y, vec.z * 8);
  }

  return vec;
}

/**
 * Convert Overworld position to Nether equivalent
 */
export function getNetherPosition(pos: Vec3 | BlockPos, currentDimension: Dimension): Vec3 {
  const vec = pos instanceof Vec3 ? pos : new Vec3(pos.x, pos.y, pos.z);

  if (currentDimension === Dimension.OVERWORLD) {
    return new Vec3(Math.floor(vec.x / 8), vec.y, Math.floor(vec.z / 8));
  }

  return vec;
}

/**
 * Check if biome is an ocean type
 */
export function isOcean(biomeName: string): boolean {
  const oceanBiomes = [
    'ocean',
    'cold_ocean',
    'deep_cold_ocean',
    'deep_ocean',
    'deep_frozen_ocean',
    'deep_lukewarm_ocean',
    'lukewarm_ocean',
    'warm_ocean',
    'frozen_ocean',
  ];
  return oceanBiomes.includes(biomeName);
}

/**
 * Create a WorldHelper bound to a specific bot
 */
export class WorldHelperInstance {
  constructor(private bot: Bot) {}

  getTicks = () => getTicks(this.bot);
  getCurrentDimension = () => getCurrentDimension(this.bot);
  isSourceBlock = (pos: BlockPos, onlyAcceptStill?: boolean) =>
    isSourceBlock(this.bot, pos, onlyAcceptStill);
  isSolid = (pos: BlockPos) => isSolid(this.bot, pos);
  isAir = (pos: BlockPos) => isAir(this.bot, pos);
  getGroundHeight = (x: number, z: number, groundBlocks?: string[]) =>
    getGroundHeight(this.bot, x, z, groundBlocks);
  isInteractableBlock = (pos: BlockPos) => isInteractableBlock(this.bot, pos);
  dangerousToBreakIfRightAbove = (pos: BlockPos) =>
    dangerousToBreakIfRightAbove(this.bot, pos);
  canSleep = () => canSleep(this.bot);
  getBlocksTouchingPlayer = () => getBlocksTouchingPlayer(this.bot);
}

/**
 * Create a WorldHelper instance for a bot
 */
export function createWorldHelper(bot: Bot): WorldHelperInstance {
  return new WorldHelperInstance(bot);
}

export default {
  WORLD_CEILING_Y,
  WORLD_FLOOR_Y,
  Dimension,
  getTicks,
  toVec3,
  toBlockPos,
  getCurrentDimension,
  isSourceBlock,
  distanceXZSquared,
  distanceXZ,
  inRangeXZ,
  isSolid,
  isAir,
  isAirBlock,
  getGroundHeight,
  isInteractableBlock,
  isChest,
  isLava,
  isWater,
  isFallingBlock,
  dangerousToBreakIfRightAbove,
  canSleep,
  getBlocksTouchingPlayer,
  scanRegion,
  getOverworldPosition,
  getNetherPosition,
  isOcean,
  createWorldHelper,
};
