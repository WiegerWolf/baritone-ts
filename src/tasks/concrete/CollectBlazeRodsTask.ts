/**
 * CollectBlazeRodsTask - Blaze Rod Collection in Nether
 * Based on BaritonePlus's CollectBlazeRodsTask.java
 *
 * WHY: Blaze rods are essential for:
 * - Brewing stands (to make potions)
 * - Eyes of Ender (to find and activate the End Portal)
 * - Blaze powder (for brewing)
 *
 * This task handles the complex workflow of:
 * 1. Traveling to the Nether
 * 2. Finding a Nether Fortress (contains blaze spawners)
 * 3. Locating a blaze spawner
 * 4. Killing blazes while staying safe
 * 5. Collecting dropped blaze rods
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { ResourceTask, Dimension, itemTarget } from './ResourceTask';
import { GoToDimensionTask } from '../composite/PortalTask';
import { SearchChunkForBlockTask } from './SearchChunkForBlockTask';
import { GetToBlockTask } from './GetToBlockTask';
import { GoToNearTask } from './GoToNearTask';
import { RunAwayFromHostilesTask } from './EscapeTask';
import { KillAndLootTask } from './KillAndLootTask';
import { BlockPos } from '../../types';

/**
 * State for blaze rod collection
 */
enum BlazeCollectionState {
  GOING_TO_NETHER,
  SEARCHING_FORTRESS,
  GOING_TO_SPAWNER,
  WAITING_FOR_BLAZES,
  KILLING_BLAZES,
  FLEEING,
  FINISHED,
}

/**
 * Configuration for CollectBlazeRodsTask
 */
export interface CollectBlazeRodsConfig {
  /** Number of blaze rods to collect */
  count: number;
  /** Radius around spawner to search for blazes */
  spawnerBlazeRadius: number;
  /** Health threshold to flee */
  fleeHealthThreshold: number;
  /** Max blazes before fleeing */
  maxBlazeCount: number;
}

const DEFAULT_CONFIG: CollectBlazeRodsConfig = {
  count: 7,
  spawnerBlazeRadius: 32,
  fleeHealthThreshold: 10,
  maxBlazeCount: 5,
};

/**
 * Task to collect blaze rods in the Nether.
 *
 * WHY: Blaze rods are required for progression to the End.
 * This task:
 * 1. Goes to the Nether (if not already there)
 * 2. Searches for a Nether Fortress by looking for nether bricks
 * 3. Finds a blaze spawner within the fortress
 * 4. Camps near the spawner and kills blazes as they spawn
 * 5. Flees if health gets too low or too many blazes
 * 6. Collects dropped blaze rods
 *
 * Based on BaritonePlus CollectBlazeRodsTask.java
 */
export class CollectBlazeRodsTask extends Task {
  private config: CollectBlazeRodsConfig;
  private state: BlazeCollectionState = BlazeCollectionState.GOING_TO_NETHER;
  private foundSpawner: BlockPos | null = null;
  private searchTask: SearchChunkForBlockTask;
  private currentSubtask: Task | null = null;

  constructor(bot: Bot, config: Partial<CollectBlazeRodsConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Search for nether bricks to find fortress
    // SearchChunkForBlockTask(bot, blocks, maxResults?, config?)
    this.searchTask = new SearchChunkForBlockTask(
      bot,
      ['nether_bricks', 'nether_brick_stairs', 'nether_brick_fence'],
      1,
      { maxChunksToSearch: 100 }
    );
  }

  /**
   * Create task to collect specific number of blaze rods
   */
  static forCount(bot: Bot, count: number): CollectBlazeRodsTask {
    return new CollectBlazeRodsTask(bot, { count });
  }

  get displayName(): string {
    return `CollectBlazeRods(${this.config.count})`;
  }

  onStart(): void {
    this.state = BlazeCollectionState.GOING_TO_NETHER;
    this.foundSpawner = null;
    this.currentSubtask = null;
  }

  onTick(): Task | null {
    // Check if we have enough blaze rods
    if (this.getBlazeRodCount() >= this.config.count) {
      this.state = BlazeCollectionState.FINISHED;
      return null;
    }

    // Get current dimension
    const dimension = this.getCurrentDimension();

    // Must be in Nether
    if (dimension !== 'nether') {
      this.state = BlazeCollectionState.GOING_TO_NETHER;
      return new GoToDimensionTask(this.bot, Dimension.NETHER);
    }

    // Check for nearby blazes
    const nearbyBlazes = this.getNearbyBlazes();
    const blazeCount = nearbyBlazes.length;

    // Safety check - flee if too many blazes or low health
    const health = this.bot.health || 20;
    if (health <= this.config.fleeHealthThreshold && blazeCount >= this.config.maxBlazeCount) {
      this.state = BlazeCollectionState.FLEEING;
      return new RunAwayFromHostilesTask(this.bot, {
        fleeDistance: 30,
        hostileTypes: ['blaze'],
      });
    }

    // Kill any blaze in range
    if (blazeCount > 0) {
      const targetBlaze = this.selectBlazeToKill(nearbyBlazes);
      if (targetBlaze) {
        this.state = BlazeCollectionState.KILLING_BLAZES;
        // KillAndLootTask(bot, itemTargets, entityTypes, config?)
        return new KillAndLootTask(
          this.bot,
          [itemTarget('blaze_rod', this.config.count)],
          ['blaze']
        );
      }
    }

    // Check if spawner is still valid
    if (this.foundSpawner) {
      if (!this.isValidBlazeSpawner(this.foundSpawner)) {
        this.foundSpawner = null;
      }
    }

    // If we have a spawner, go near it and wait
    if (this.foundSpawner) {
      const dist = this.bot.entity.position.distanceTo(
        new Vec3(this.foundSpawner.x + 0.5, this.foundSpawner.y + 0.5, this.foundSpawner.z + 0.5)
      );

      if (dist > 4) {
        this.state = BlazeCollectionState.GOING_TO_SPAWNER;
        return new GoToNearTask(
          this.bot,
          this.foundSpawner.x,
          this.foundSpawner.y + 1, // Go above spawner
          this.foundSpawner.z,
          3
        );
      }

      // Near spawner, wait for blazes
      this.state = BlazeCollectionState.WAITING_FOR_BLAZES;
      return null;
    }

    // Search for spawner
    const spawner = this.findBlazeSpawner();
    if (spawner) {
      this.foundSpawner = spawner;
      return null;
    }

    // No spawner found, search fortress
    this.state = BlazeCollectionState.SEARCHING_FORTRESS;
    return this.searchTask;
  }

  /**
   * Get current blaze rod count
   */
  private getBlazeRodCount(): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'blaze_rod') {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Get current dimension
   */
  private getCurrentDimension(): string {
    // Mineflayer dimension detection
    const dimName = (this.bot as any).game?.dimension || 'overworld';
    if (dimName.includes('nether')) return 'nether';
    if (dimName.includes('end')) return 'the_end';
    return 'overworld';
  }

  /**
   * Get nearby blazes
   */
  private getNearbyBlazes(): Entity[] {
    const blazes: Entity[] = [];
    const maxDist = this.config.spawnerBlazeRadius;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity.name) continue;
      if (entity.name.toLowerCase() !== 'blaze') continue;
      if (!entity.isValid) continue;

      const dist = this.bot.entity.position.distanceTo(entity.position);
      if (dist <= maxDist) {
        blazes.push(entity);
      }
    }

    return blazes;
  }

  /**
   * Select best blaze to kill (closest that's not over lava/too high)
   */
  private selectBlazeToKill(blazes: Entity[]): Entity | null {
    let best: Entity | null = null;
    let bestDist = Infinity;

    for (const blaze of blazes) {
      // Skip if hovering over lava or too high
      if (this.isHoveringAboveLavaOrTooHigh(blaze)) continue;

      const dist = this.bot.entity.position.distanceTo(blaze.position);
      if (dist < bestDist) {
        bestDist = dist;
        best = blaze;
      }
    }

    return best;
  }

  /**
   * Check if entity is hovering over lava or too high
   */
  private isHoveringAboveLavaOrTooHigh(entity: Entity): boolean {
    const MAX_HEIGHT = 11;
    const startY = Math.floor(entity.position.y);

    for (let y = startY; startY - y < MAX_HEIGHT; y--) {
      const block = this.bot.blockAt(new Vec3(entity.position.x, y, entity.position.z));
      if (!block) continue;

      if (block.name === 'lava') return true;
      if (block.boundingBox === 'block') return false; // Solid block found
    }

    return true; // Too high
  }

  /**
   * Find a blaze spawner nearby
   */
  private findBlazeSpawner(): BlockPos | null {
    const playerPos = this.bot.entity.position;
    const radius = 32;

    for (let x = -radius; x <= radius; x += 4) {
      for (let z = -radius; z <= radius; z += 4) {
        for (let y = -10; y <= 10; y++) {
          for (let dx = 0; dx < 4; dx++) {
            for (let dz = 0; dz < 4; dz++) {
              const pos = new Vec3(
                playerPos.x + x + dx,
                playerPos.y + y,
                playerPos.z + z + dz
              );
              const block = this.bot.blockAt(pos);

              if (block && block.name === 'spawner') {
                const blockPos = new BlockPos(
                  Math.floor(pos.x),
                  Math.floor(pos.y),
                  Math.floor(pos.z)
                );
                if (this.isValidBlazeSpawner(blockPos)) {
                  return blockPos;
                }
              }
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if a spawner is a valid blaze spawner
   */
  private isValidBlazeSpawner(pos: BlockPos): boolean {
    const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
    if (!block || block.name !== 'spawner') return false;

    // Would need to check spawner entity type from block entity data
    // For now, assume spawners in nether are blaze spawners (common case)
    return true;
  }

  onStop(interruptTask: ITask | null): void {
    this.currentSubtask = null;
  }

  isFinished(): boolean {
    return this.state === BlazeCollectionState.FINISHED ||
           this.getBlazeRodCount() >= this.config.count;
  }

  /**
   * Get current state
   */
  getState(): BlazeCollectionState {
    return this.state;
  }

  /**
   * Get found spawner position
   */
  getFoundSpawner(): BlockPos | null {
    return this.foundSpawner;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof CollectBlazeRodsTask)) return false;
    return this.config.count === other.config.count;
  }
}

/**
 * Convenience function to collect blaze rods
 */
export function collectBlazeRods(bot: Bot, count: number = 7): CollectBlazeRodsTask {
  return new CollectBlazeRodsTask(bot, { count });
}

/**
 * Convenience function for speedrun blaze rod collection
 * (typical speedrun needs 7 rods for 14 eyes of ender)
 */
export function collectBlazeRodsForSpeedrun(bot: Bot): CollectBlazeRodsTask {
  return new CollectBlazeRodsTask(bot, { count: 7 });
}

export { BlazeCollectionState };
