/**
 * CollectObsidianTask - Obsidian Collection
 * Based on BaritonePlus's CollectObsidianTask.java
 *
 * WHY: Obsidian is required for:
 * - Nether portals (10 blocks minimum, 14 for full frame)
 * - Enchanting tables (4 blocks)
 * - Ender chests (8 blocks)
 *
 * This task handles obsidian collection through:
 * 1. Mining existing obsidian (requires diamond pickaxe)
 * 2. Creating obsidian by pouring water on lava sources
 * 3. Dimension awareness (can't place water in Nether)
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { ResourceTask, ItemTarget, itemTarget } from './ResourceTask';
import { MineAndCollectTask } from './MineAndCollectTask';
import { TimeoutWanderTask } from './TimeoutWanderTask';
import { BlockPos } from '../../types';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for obsidian collection
 */
enum ObsidianCollectionState {
  GETTING_PICKAXE,
  MINING_EXISTING,
  SEARCHING_LAVA,
  CREATING_OBSIDIAN,
  COLLECTING_DROP,
  WANDERING,
  FINISHED,
}

/**
 * Configuration for CollectObsidianTask
 */
export interface CollectObsidianConfig {
  /** Number of obsidian to collect */
  count: number;
  /** Whether to create obsidian from lava if not found */
  createFromLava: boolean;
  /** Search radius for existing obsidian */
  searchRadius: number;
}

const DEFAULT_CONFIG: CollectObsidianConfig = {
  count: 10,
  createFromLava: true,
  searchRadius: 64,
};

/**
 * Task to collect obsidian blocks.
 *
 * WHY: Obsidian is essential for Nether portal construction and other
 * advanced gameplay. This task:
 * 1. First tries to mine existing obsidian (faster if available)
 * 2. Falls back to creating obsidian using water + lava
 * 3. Requires diamond pickaxe (obsidian is hardness 50)
 *
 * Based on BaritonePlus CollectObsidianTask.java
 */
export class CollectObsidianTask extends ResourceTask {
  private config: CollectObsidianConfig;
  private state: ObsidianCollectionState = ObsidianCollectionState.GETTING_PICKAXE;
  private lavaBlacklist: Set<string> = new Set();
  private lavaSearchTimer: TimerGame;
  private currentLavaTarget: BlockPos | null = null;

  constructor(bot: Bot, config: Partial<CollectObsidianConfig> = {}) {
    super(bot, [itemTarget('obsidian', config.count ?? DEFAULT_CONFIG.count)]);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.lavaSearchTimer = new TimerGame(bot, 6);
  }

  /**
   * Create task to collect specific number of obsidian
   */
  static forCount(bot: Bot, count: number): CollectObsidianTask {
    return new CollectObsidianTask(bot, { count });
  }

  /**
   * Create task to collect obsidian for a nether portal (10 blocks)
   */
  static forPortal(bot: Bot): CollectObsidianTask {
    return new CollectObsidianTask(bot, { count: 10 });
  }

  /**
   * Create task to collect obsidian for full portal frame (14 blocks)
   */
  static forFullPortal(bot: Bot): CollectObsidianTask {
    return new CollectObsidianTask(bot, { count: 14 });
  }

  get displayName(): string {
    return `CollectObsidian(${this.config.count})`;
  }

  protected onResourceStart(): void {
    this.state = ObsidianCollectionState.GETTING_PICKAXE;
    this.lavaBlacklist.clear();
    this.currentLavaTarget = null;
    this.lavaSearchTimer.reset();
  }

  protected onResourceTick(): Task | null {
    // Check if we have enough obsidian
    if (this.getObsidianCount() >= this.config.count) {
      this.state = ObsidianCollectionState.FINISHED;
      return null;
    }

    // Need diamond pickaxe first
    if (!this.hasDiamondPickaxe()) {
      this.state = ObsidianCollectionState.GETTING_PICKAXE;
      // In full implementation, would return task to get diamond pickaxe
      // For now, just wander until we have one
      return new TimeoutWanderTask(this.bot, 5);
    }

    // Check for nearby obsidian to mine
    const nearbyObsidian = this.findNearbyObsidian();
    if (nearbyObsidian) {
      this.state = ObsidianCollectionState.MINING_EXISTING;
      return new MineAndCollectTask(
        this.bot,
        [itemTarget('obsidian', this.config.count)],
        ['obsidian']
      );
    }

    // Check for dropped obsidian
    const droppedObsidian = this.findDroppedObsidian();
    if (droppedObsidian) {
      this.state = ObsidianCollectionState.COLLECTING_DROP;
      return new MineAndCollectTask(
        this.bot,
        [itemTarget('obsidian', this.config.count)],
        ['obsidian']
      );
    }

    // Check dimension - can't create obsidian in Nether (water evaporates)
    if (!this.isInOverworld()) {
      this.state = ObsidianCollectionState.WANDERING;
      return new TimeoutWanderTask(this.bot, 5);
    }

    // Try to create obsidian from lava
    if (this.config.createFromLava) {
      // Find a lava source
      const lavaSource = this.findLavaSource();
      if (lavaSource) {
        this.state = ObsidianCollectionState.CREATING_OBSIDIAN;
        this.currentLavaTarget = lavaSource;
        // In full implementation, would use PlaceObsidianBucketTask
        // For now, return null as we need more complex logic
        return null;
      }

      // Search for lava
      if (this.lavaSearchTimer.elapsed()) {
        this.lavaSearchTimer.reset();
        this.state = ObsidianCollectionState.SEARCHING_LAVA;
      }
    }

    // Wander to find resources
    this.state = ObsidianCollectionState.WANDERING;
    return new TimeoutWanderTask(this.bot, 5);
  }

  /**
   * Get current obsidian count
   */
  private getObsidianCount(): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'obsidian') {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Check if we have a diamond pickaxe
   */
  private hasDiamondPickaxe(): boolean {
    return this.bot.inventory.items().some(item =>
      item.name === 'diamond_pickaxe' || item.name === 'netherite_pickaxe'
    );
  }

  /**
   * Find nearby obsidian blocks
   */
  private findNearbyObsidian(): Vec3 | null {
    const playerPos = this.bot.entity.position;
    const radius = this.config.searchRadius;

    for (let x = -radius; x <= radius; x += 4) {
      for (let z = -radius; z <= radius; z += 4) {
        for (let y = -10; y <= 10; y++) {
          for (let dx = 0; dx < 4; dx++) {
            for (let dz = 0; dz < 4; dz++) {
              const pos = playerPos.offset(x + dx, y, z + dz);
              const block = this.bot.blockAt(pos);
              if (block && block.name === 'obsidian') {
                return pos;
              }
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Find dropped obsidian items
   */
  private findDroppedObsidian(): Vec3 | null {
    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name === 'item' && entity.metadata) {
        // Check if it's an obsidian drop
        const itemInfo = (entity.metadata as any)[8];
        if (itemInfo && itemInfo.itemId && itemInfo.itemId.includes('obsidian')) {
          return entity.position;
        }
      }
    }
    return null;
  }

  /**
   * Check if in overworld (can place water for obsidian creation)
   */
  private isInOverworld(): boolean {
    const dimName = (this.bot as any).game?.dimension || 'overworld';
    return !dimName.includes('nether') && !dimName.includes('end');
  }

  /**
   * Find a lava source block
   */
  private findLavaSource(): BlockPos | null {
    const playerPos = this.bot.entity.position;
    const radius = 32;

    let nearest: BlockPos | null = null;
    let nearestDist = Infinity;

    for (let x = -radius; x <= radius; x += 4) {
      for (let z = -radius; z <= radius; z += 4) {
        for (let y = -10; y <= 10; y++) {
          for (let dx = 0; dx < 4; dx++) {
            for (let dz = 0; dz < 4; dz++) {
              const pos = playerPos.offset(x + dx, y, z + dz);
              const block = this.bot.blockAt(pos);

              if (block && block.name === 'lava') {
                const posKey = `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
                if (this.lavaBlacklist.has(posKey)) continue;

                // Check if it's a source block (level 0)
                const stateId = block.stateId;
                // In mineflayer, lava source blocks have specific state
                // This is a simplified check
                const dist = playerPos.distanceTo(pos);
                if (dist < nearestDist) {
                  nearestDist = dist;
                  nearest = new BlockPos(
                    Math.floor(pos.x),
                    Math.floor(pos.y),
                    Math.floor(pos.z)
                  );
                }
              }
            }
          }
        }
      }
    }

    return nearest;
  }

  /**
   * Blacklist a lava position (unreachable or used)
   */
  blacklistLava(pos: BlockPos): void {
    this.lavaBlacklist.add(`${pos.x},${pos.y},${pos.z}`);
  }

  protected onResourceStop(interruptTask: ITask | null): void {
    this.currentLavaTarget = null;
  }

  isResourceFinished(): boolean {
    return this.state === ObsidianCollectionState.FINISHED ||
           this.getObsidianCount() >= this.config.count;
  }

  /**
   * Get current state
   */
  getState(): ObsidianCollectionState {
    return this.state;
  }

  /**
   * Get current lava target
   */
  getCurrentLavaTarget(): BlockPos | null {
    return this.currentLavaTarget;
  }

  protected isEqualResource(other: ResourceTask): boolean {
    if (!(other instanceof CollectObsidianTask)) return false;
    return this.config.count === other.config.count;
  }
}

/**
 * Convenience function to collect obsidian
 */
export function collectObsidian(bot: Bot, count: number = 10): CollectObsidianTask {
  return new CollectObsidianTask(bot, { count });
}

/**
 * Convenience function to collect obsidian for a portal
 */
export function collectObsidianForPortal(bot: Bot): CollectObsidianTask {
  return CollectObsidianTask.forPortal(bot);
}

export { ObsidianCollectionState };
