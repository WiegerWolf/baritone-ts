import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { CalculationContext } from '../types';
import { PrecomputedData } from '../cache/PrecomputedData';
import { Favoring, buildFavoring, createAvoidances } from '../pathing/Favoring';
import { COST_INF } from '../core/ActionCosts';
import { BlockPos, PathNode } from '../types';

/**
 * CalculationContext implementation
 * Provides all the context needed for pathfinding calculations
 */
export class CalculationContextImpl implements CalculationContext {
  readonly bot: Bot;
  readonly world: any;

  // Precomputed block data
  private readonly precomputed: PrecomputedData;

  // Settings
  canDig: boolean = true;
  canPlace: boolean = true;
  allowSprint: boolean = true;
  allowParkour: boolean = true;
  allowWaterBucket: boolean = false;

  // Jump penalty (increases with repeated jumps)
  jumpPenalty: number = 0;

  // Favoring system
  private favoring: Favoring;

  // Tool cache
  private toolCache: Map<number, any> = new Map();

  constructor(bot: Bot, options: ContextOptions = {}) {
    this.bot = bot;
    this.world = (bot as any).world;

    // Initialize precomputed data
    this.precomputed = new PrecomputedData(bot.registry);

    // Apply options
    if (options.canDig !== undefined) this.canDig = options.canDig;
    if (options.canPlace !== undefined) this.canPlace = options.canPlace;
    if (options.allowSprint !== undefined) this.allowSprint = options.allowSprint;
    if (options.allowParkour !== undefined) this.allowParkour = options.allowParkour;
    if (options.allowWaterBucket !== undefined) this.allowWaterBucket = options.allowWaterBucket;

    // Initialize favoring
    this.favoring = new Favoring();
  }

  /**
   * Update favoring based on previous path and nearby entities
   */
  updateFavoring(previousPath?: PathNode[], mobAvoidance: boolean = true): void {
    const playerPos = BlockPos.fromVec3(this.bot.entity.position);

    const avoidances = mobAvoidance
      ? createAvoidances(this.bot, playerPos)
      : [];

    this.favoring = buildFavoring(previousPath, avoidances);
  }

  /**
   * Get favoring multiplier for a position
   */
  getFavoring(x: number, y: number, z: number): number {
    return this.favoring.get(x, y, z);
  }

  /**
   * Get block at position
   */
  getBlock(x: number, y: number, z: number): Block | null {
    return this.bot.blockAt(new Vec3(x, y, z)) ?? null;
  }

  /**
   * Check if block can be walked on
   */
  canWalkOn(block: Block | null): boolean {
    if (!block) return false;
    return this.precomputed.canWalkOn(block.type);
  }

  /**
   * Check if block can be walked through
   */
  canWalkThrough(block: Block | null): boolean {
    if (!block) return true; // Unloaded = assume passable
    return this.precomputed.canWalkThrough(block.type);
  }

  /**
   * Check if block is water
   */
  isWater(block: Block | null): boolean {
    if (!block) return false;
    return this.precomputed.isWater(block.type);
  }

  /**
   * Check if block is lava
   */
  isLava(block: Block | null): boolean {
    if (!block) return false;
    return this.precomputed.isLava(block.type);
  }

  /**
   * Get best tool for breaking a block
   */
  getBestTool(block: Block): any {
    // Check cache
    const cached = this.toolCache.get(block.type);
    if (cached !== undefined) return cached;

    const items = this.bot.inventory.items();
    let bestTool: any = null;
    let bestTime = Infinity;

    for (const item of items) {
      const time = this.getDigTime(block, item);
      if (time < bestTime) {
        bestTime = time;
        bestTool = item;
      }
    }

    // Also check hand
    const handTime = this.getDigTime(block, null);
    if (handTime < bestTime) {
      bestTool = null;
    }

    this.toolCache.set(block.type, bestTool);
    return bestTool;
  }

  /**
   * Get dig time for a block with a specific tool
   */
  private getDigTime(block: Block, tool: any): number {
    try {
      const effects = (this.bot.entity as any).effects ?? {};
      return block.digTime(
        tool?.type ?? null,
        false,  // creative
        false,  // inWater
        false,  // onGround (doesn't affect dig time much)
        [],     // enchantments (handled separately)
        effects
      );
    } catch {
      return Infinity;
    }
  }

  /**
   * Get break time in ticks for a block
   */
  getBreakTime(block: Block): number {
    if (!block.diggable) return COST_INF;
    if (this.precomputed.avoidBreaking(block.type)) return COST_INF;

    const tool = this.getBestTool(block);
    const digTimeMs = this.getDigTime(block, tool);

    // Convert ms to ticks (50ms per tick)
    return digTimeMs / 50;
  }

  /**
   * Clear tool cache (call when inventory changes)
   */
  clearToolCache(): void {
    this.toolCache.clear();
  }

  /**
   * Check if a chunk is loaded
   */
  isChunkLoaded(x: number, z: number): boolean {
    const chunkX = x >> 4;
    const chunkZ = z >> 4;
    const column = this.world?.getColumn?.(chunkX, chunkZ);
    return column != null;
  }

  /**
   * Get scaffolding blocks from inventory
   */
  getScaffoldingItem(): any {
    const scaffoldingBlocks = ['dirt', 'cobblestone', 'netherrack', 'stone'];

    for (const blockName of scaffoldingBlocks) {
      const blockId = this.bot.registry.blocksByName[blockName]?.id;
      if (!blockId) continue;

      const item = this.bot.inventory.items().find(i =>
        i.type === this.bot.registry.itemsByName[blockName]?.id
      );
      if (item) return item;
    }

    return null;
  }

  /**
   * Count scaffolding items in inventory
   */
  countScaffoldingItems(): number {
    const scaffoldingBlocks = ['dirt', 'cobblestone', 'netherrack', 'stone'];
    let count = 0;

    for (const blockName of scaffoldingBlocks) {
      const itemId = this.bot.registry.itemsByName[blockName]?.id;
      if (!itemId) continue;

      for (const item of this.bot.inventory.items()) {
        if (item.type === itemId) {
          count += item.count;
        }
      }
    }

    return count;
  }
}

/**
 * Options for CalculationContext
 */
export interface ContextOptions {
  canDig?: boolean;
  canPlace?: boolean;
  allowSprint?: boolean;
  allowParkour?: boolean;
  allowWaterBucket?: boolean;
}
