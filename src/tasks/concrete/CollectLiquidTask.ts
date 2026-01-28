/**
 * CollectLiquidTask - Liquid Collection with Buckets
 * Based on BaritonePlus's CollectBucketLiquidTask.java
 *
 * WHY: Water and lava buckets are essential resources. Water is needed
 * for infinite water sources, farming, and MLG saves. Lava is needed
 * for smelting fuel and nether portal construction.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { ResourceTask, ItemTarget, itemTarget, Dimension } from './ResourceTask';
import { GoToNearTask } from './GoToTask';
import { TimeoutWanderTask } from './MovementUtilTask';
import { TimerGame } from '../../utils/timers/TimerGame';
import { MovementProgressChecker } from '../../utils/progress/MovementProgressChecker';

/**
 * State for liquid collection task
 */
enum CollectLiquidState {
  CHECKING_ITEMS,
  FINDING_LIQUID,
  APPROACHING,
  COLLECTING,
  WANDERING,
  FINISHED,
  FAILED
}

/**
 * Liquid type
 */
export enum LiquidType {
  WATER = 'water',
  LAVA = 'lava',
}

/**
 * Configuration for CollectBucketLiquidTask
 */
export interface CollectLiquidConfig {
  /** Search radius for liquid sources */
  searchRadius: number;
  /** Timeout for pickup attempt */
  pickupTimeout: number;
}

const DEFAULT_CONFIG: CollectLiquidConfig = {
  searchRadius: 64,
  pickupTimeout: 3,
};

/**
 * Task to collect liquid (water or lava) with a bucket.
 *
 * WHY: Buckets of liquid are used for many purposes:
 * - Water: MLG saves, farming, infinite sources, obsidian creation
 * - Lava: Fuel for furnaces, nether portal creation
 * This task finds source blocks and collects them.
 *
 * Based on BaritonePlus CollectBucketLiquidTask.java
 */
export class CollectBucketLiquidTask extends ResourceTask {
  private liquidType: LiquidType;
  private blockName: string;
  private filledBucketName: string;
  private targetCount: number;
  private config: CollectLiquidConfig;
  private state: CollectLiquidState = CollectLiquidState.CHECKING_ITEMS;
  private currentTarget: Vec3 | null = null;
  private blacklistedPositions: Set<string> = new Set();
  private pickupTimer: TimerGame;
  private progressChecker: MovementProgressChecker;

  constructor(
    bot: Bot,
    liquidType: LiquidType,
    targetCount: number,
    config: Partial<CollectLiquidConfig> = {}
  ) {
    const filledBucket = liquidType === LiquidType.WATER ? 'water_bucket' : 'lava_bucket';
    super(bot, [itemTarget(filledBucket, targetCount)]);

    this.liquidType = liquidType;
    this.blockName = liquidType;
    this.filledBucketName = filledBucket;
    this.targetCount = targetCount;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.pickupTimer = new TimerGame(bot, this.config.pickupTimeout);
    this.progressChecker = new MovementProgressChecker(bot);
  }

  get displayName(): string {
    return `CollectLiquid(${this.liquidType} x${this.targetCount})`;
  }

  protected onResourceStart(): void {
    this.state = CollectLiquidState.CHECKING_ITEMS;
    this.currentTarget = null;
    this.blacklistedPositions.clear();
    this.progressChecker.reset();
  }

  protected onResourceTick(): Task | null {
    switch (this.state) {
      case CollectLiquidState.CHECKING_ITEMS:
        return this.handleCheckingItems();

      case CollectLiquidState.FINDING_LIQUID:
        return this.handleFindingLiquid();

      case CollectLiquidState.APPROACHING:
        return this.handleApproaching();

      case CollectLiquidState.COLLECTING:
        return this.handleCollecting();

      case CollectLiquidState.WANDERING:
        return this.handleWandering();

      default:
        return null;
    }
  }

  private handleCheckingItems(): Task | null {
    // Check if we have empty buckets
    const bucketCount = this.countItem('bucket');
    const filledCount = this.countItem(this.filledBucketName);
    const neededBuckets = this.targetCount - filledCount;

    if (neededBuckets <= 0) {
      this.state = CollectLiquidState.FINISHED;
      return null;
    }

    if (bucketCount === 0) {
      // Need to get buckets first
      // For now, fail - could add bucket crafting subtask
      this.state = CollectLiquidState.FAILED;
      this.markFailed();
      return null;
    }

    this.state = CollectLiquidState.FINDING_LIQUID;
    return null;
  }

  private handleFindingLiquid(): Task | null {
    // Check dimension for water
    if (this.liquidType === LiquidType.WATER &&
        this.getCurrentDimension() === Dimension.NETHER) {
      // Can't find water in nether
      this.state = CollectLiquidState.FAILED;
      this.markFailed();
      return null;
    }

    // Find nearest liquid source
    const liquid = this.findNearestSourceBlock();

    if (liquid) {
      this.currentTarget = liquid;
      this.state = CollectLiquidState.APPROACHING;
      this.progressChecker.reset();
      return null;
    }

    // No liquid found
    this.state = CollectLiquidState.WANDERING;
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.currentTarget) {
      this.state = CollectLiquidState.FINDING_LIQUID;
      return null;
    }

    // Check progress
    this.progressChecker.setProgress(this.bot.entity.position);
    if (this.progressChecker.failed()) {
      this.blacklistPosition(this.currentTarget);
      this.currentTarget = null;
      this.state = CollectLiquidState.FINDING_LIQUID;
      this.progressChecker.reset();
      return null;
    }

    // Verify liquid still exists
    const block = this.bot.blockAt(this.currentTarget);
    if (!block || !this.isSourceBlock(block)) {
      this.currentTarget = null;
      this.state = CollectLiquidState.FINDING_LIQUID;
      return null;
    }

    // Check if close enough
    const dist = this.bot.entity.position.distanceTo(this.currentTarget);
    if (dist <= 4) {
      this.state = CollectLiquidState.COLLECTING;
      this.pickupTimer.reset();
      return null;
    }

    // Move toward liquid (aim for above it for lava safety)
    const targetPos = this.liquidType === LiquidType.LAVA
      ? this.currentTarget.offset(0, 1, 0)
      : this.currentTarget;

    return new GoToNearTask(
      this.bot,
      Math.floor(targetPos.x),
      Math.floor(targetPos.y),
      Math.floor(targetPos.z),
      3
    );
  }

  private handleCollecting(): Task | null {
    if (!this.currentTarget) {
      this.state = CollectLiquidState.FINDING_LIQUID;
      return null;
    }

    // Verify liquid still exists
    const block = this.bot.blockAt(this.currentTarget);
    if (!block || !this.isSourceBlock(block)) {
      this.currentTarget = null;
      this.state = CollectLiquidState.FINDING_LIQUID;
      return null;
    }

    // Equip bucket
    const bucket = this.bot.inventory.items().find(item => item.name === 'bucket');
    if (!bucket) {
      this.state = CollectLiquidState.CHECKING_ITEMS;
      return null;
    }

    try {
      // Equip and use bucket
      this.bot.equip(bucket, 'hand');

      // Look at liquid and use bucket
      this.bot.lookAt(this.currentTarget.offset(0.5, 0.5, 0.5));
      this.bot.activateBlock(block);

      // After collecting, check items again
      this.currentTarget = null;
      this.state = CollectLiquidState.CHECKING_ITEMS;
    } catch {
      // Collection failed - might be timeout
      if (this.pickupTimer.elapsed() && this.currentTarget) {
        this.blacklistPosition(this.currentTarget);
        this.currentTarget = null;
        this.state = CollectLiquidState.FINDING_LIQUID;
      }
    }

    return null;
  }

  private handleWandering(): Task | null {
    // Check for liquid while wandering
    const liquid = this.findNearestSourceBlock();
    if (liquid) {
      this.currentTarget = liquid;
      this.state = CollectLiquidState.APPROACHING;
      return null;
    }

    return new TimeoutWanderTask(this.bot, 15);
  }

  protected onResourceStop(interruptTask: ITask | null): void {
    this.currentTarget = null;
    this.blacklistedPositions.clear();
  }

  protected isEqualResource(other: ResourceTask): boolean {
    if (!(other instanceof CollectBucketLiquidTask)) return false;
    return this.liquidType === other.liquidType && this.targetCount === other.targetCount;
  }

  // ---- Helper methods ----

  private findNearestSourceBlock(): Vec3 | null {
    const playerPos = this.bot.entity.position;
    const radius = this.config.searchRadius;

    let nearest: Vec3 | null = null;
    let nearestDist = Infinity;

    for (let r = 1; r <= radius; r++) {
      for (let x = -r; x <= r; x++) {
        for (let y = -Math.min(r, 32); y <= Math.min(r, 32); y++) {
          for (let z = -r; z <= r; z++) {
            if (Math.abs(x) !== r && Math.abs(y) !== r && Math.abs(z) !== r) continue;

            const checkPos = new Vec3(
              Math.floor(playerPos.x) + x,
              Math.floor(playerPos.y) + y,
              Math.floor(playerPos.z) + z
            );

            if (this.isBlacklisted(checkPos)) continue;

            const block = this.bot.blockAt(checkPos);
            if (block && this.isSourceBlock(block)) {
              // Check that we can reach above it (for bucket use)
              const above = this.bot.blockAt(checkPos.offset(0, 1, 0));
              if (above && above.name === 'bedrock') continue;

              const dist = playerPos.distanceTo(checkPos);
              if (dist < nearestDist) {
                nearestDist = dist;
                nearest = checkPos;
              }
            }
          }
        }
      }

      if (nearest) break;
    }

    return nearest;
  }

  private isSourceBlock(block: Block): boolean {
    if (block.name !== this.blockName) return false;

    // Check if it's a source block (level 0)
    const level = (block as any).metadata ?? block.stateId;
    // Source blocks have level 0, flowing has higher levels
    // In mineflayer, we check the block state
    return true; // Simplified - could check block state for source vs flowing
  }

  private countItem(itemName: string): number {
    return this.bot.inventory.items()
      .filter(item => item.name === itemName)
      .reduce((sum, item) => sum + item.count, 0);
  }

  private blacklistPosition(pos: Vec3): void {
    this.blacklistedPositions.add(`${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`);
  }

  private isBlacklisted(pos: Vec3): boolean {
    return this.blacklistedPositions.has(`${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`);
  }

}

/**
 * Convenience class for collecting water
 */
export class CollectWaterBucketTask extends CollectBucketLiquidTask {
  constructor(bot: Bot, targetCount: number = 1) {
    super(bot, LiquidType.WATER, targetCount);
  }
}

/**
 * Convenience class for collecting lava
 */
export class CollectLavaBucketTask extends CollectBucketLiquidTask {
  constructor(bot: Bot, targetCount: number = 1) {
    super(bot, LiquidType.LAVA, targetCount);
  }
}

/**
 * Helper to collect water
 */
export function collectWater(bot: Bot, count: number = 1): CollectWaterBucketTask {
  return new CollectWaterBucketTask(bot, count);
}

/**
 * Helper to collect lava
 */
export function collectLava(bot: Bot, count: number = 1): CollectLavaBucketTask {
  return new CollectLavaBucketTask(bot, count);
}
