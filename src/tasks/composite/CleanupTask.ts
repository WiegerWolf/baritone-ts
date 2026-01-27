/**
 * CleanupTask - Area Cleanup/Clearing Automation
 * Based on AltoClef patterns
 *
 * Handles clearing areas of unwanted blocks, picking up items,
 * and general area maintenance.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { MineBlockTask } from '../concrete/MineBlockTask';
import { GoToNearTask } from '../concrete/GoToTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for cleanup
 */
enum CleanupState {
  SCANNING,
  CLEARING_BLOCKS,
  COLLECTING_ITEMS,
  LEVELING,
  FINISHED,
  FAILED
}

/**
 * Cleanup modes
 */
export enum CleanupMode {
  /** Clear all non-solid blocks */
  CLEAR_DEBRIS,
  /** Flatten terrain to a level */
  FLATTEN,
  /** Clear vegetation */
  CLEAR_VEGETATION,
  /** Pick up dropped items */
  COLLECT_ITEMS,
  /** Full cleanup */
  FULL,
}

/**
 * Blocks considered debris
 */
const DEBRIS_BLOCKS = [
  'tall_grass', 'grass', 'fern', 'large_fern',
  'dead_bush', 'dandelion', 'poppy', 'blue_orchid',
  'allium', 'azure_bluet', 'red_tulip', 'orange_tulip',
  'white_tulip', 'pink_tulip', 'oxeye_daisy', 'cornflower',
  'lily_of_the_valley', 'wither_rose', 'sunflower', 'lilac',
  'rose_bush', 'peony', 'sweet_berry_bush', 'cobweb',
  'vine', 'cave_vines', 'cave_vines_plant', 'glow_lichen',
  'moss_carpet', 'snow',
];

/**
 * Blocks considered vegetation
 */
const VEGETATION_BLOCKS = [
  'oak_leaves', 'spruce_leaves', 'birch_leaves', 'jungle_leaves',
  'acacia_leaves', 'dark_oak_leaves', 'mangrove_leaves',
  'azalea_leaves', 'flowering_azalea_leaves', 'cherry_leaves',
  ...DEBRIS_BLOCKS,
];

/**
 * Configuration for cleanup
 */
export interface CleanupConfig {
  /** Cleanup mode */
  mode: CleanupMode;
  /** Center of area to clean */
  center: Vec3 | null;
  /** Radius to clean */
  radius: number;
  /** Target Y level for flattening */
  targetY: number | null;
  /** Block types to clear (empty = use mode defaults) */
  blocksToClear: string[];
  /** Block types to preserve */
  preserveBlocks: string[];
  /** Collect dropped items */
  collectItems: boolean;
  /** Max blocks to clear */
  maxBlocks: number;
}

const DEFAULT_CONFIG: CleanupConfig = {
  mode: CleanupMode.CLEAR_DEBRIS,
  center: null,
  radius: 16,
  targetY: null,
  blocksToClear: [],
  preserveBlocks: [],
  collectItems: true,
  maxBlocks: 500,
};

/**
 * Task for cleaning up areas
 */
export class CleanupTask extends Task {
  private config: CleanupConfig;
  private state: CleanupState = CleanupState.SCANNING;
  private blocksToClean: Vec3[] = [];
  private blocksCleaned: number = 0;
  private itemsCollected: number = 0;
  private scanTimer: TimerGame;

  constructor(bot: Bot, config: Partial<CleanupConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.scanTimer = new TimerGame(bot, 5.0);

    // Default center to player position
    if (!this.config.center) {
      this.config.center = this.bot.entity.position.clone();
    }

    // Set blocks to clear based on mode
    if (this.config.blocksToClear.length === 0) {
      switch (this.config.mode) {
        case CleanupMode.CLEAR_DEBRIS:
          this.config.blocksToClear = [...DEBRIS_BLOCKS];
          break;
        case CleanupMode.CLEAR_VEGETATION:
          this.config.blocksToClear = [...VEGETATION_BLOCKS];
          break;
        case CleanupMode.FLATTEN:
        case CleanupMode.FULL:
          // Will be determined by Y level
          break;
      }
    }
  }

  get displayName(): string {
    return `Cleanup(${CleanupMode[this.config.mode]}, ${this.blocksCleaned}/${this.blocksToClean.length} blocks, ${CleanupState[this.state]})`;
  }

  onStart(): void {
    this.state = CleanupState.SCANNING;
    this.blocksToClean = [];
    this.blocksCleaned = 0;
    this.itemsCollected = 0;
    this.scanArea();
  }

  onTick(): Task | null {
    // Check if done
    if (this.blocksCleaned >= this.config.maxBlocks) {
      this.state = CleanupState.FINISHED;
      return null;
    }

    switch (this.state) {
      case CleanupState.SCANNING:
        return this.handleScanning();

      case CleanupState.CLEARING_BLOCKS:
        return this.handleClearingBlocks();

      case CleanupState.COLLECTING_ITEMS:
        return this.handleCollectingItems();

      case CleanupState.LEVELING:
        return this.handleLeveling();

      default:
        return null;
    }
  }

  private handleScanning(): Task | null {
    if (this.blocksToClean.length === 0) {
      // No more blocks to clean
      if (this.config.collectItems) {
        this.state = CleanupState.COLLECTING_ITEMS;
      } else {
        this.state = CleanupState.FINISHED;
      }
      return null;
    }

    this.state = CleanupState.CLEARING_BLOCKS;
    return null;
  }

  private handleClearingBlocks(): Task | null {
    if (this.blocksToClean.length === 0) {
      // Rescan periodically
      if (this.scanTimer.elapsed()) {
        this.scanArea();
        this.scanTimer.reset();
      }

      if (this.blocksToClean.length === 0) {
        if (this.config.collectItems) {
          this.state = CleanupState.COLLECTING_ITEMS;
        } else {
          this.state = CleanupState.FINISHED;
        }
      }
      return null;
    }

    // Get next block to clear
    const nextBlock = this.blocksToClean.shift()!;

    // Verify block still exists and should be cleared
    const block = this.bot.blockAt(nextBlock);
    if (!block || !this.shouldClearBlock(block)) {
      return null; // Skip, will get next on next tick
    }

    this.blocksCleaned++;

    return new MineBlockTask(
      this.bot,
      Math.floor(nextBlock.x),
      Math.floor(nextBlock.y),
      Math.floor(nextBlock.z)
    );
  }

  private handleCollectingItems(): Task | null {
    // Find nearby dropped items
    const nearestItem = this.findNearestDroppedItem();

    if (!nearestItem) {
      this.state = CleanupState.FINISHED;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(nearestItem.position);

    if (dist <= 2) {
      this.itemsCollected++;
      return null; // Item will be auto-collected
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(nearestItem.position.x),
      Math.floor(nearestItem.position.y),
      Math.floor(nearestItem.position.z),
      1
    );
  }

  private handleLeveling(): Task | null {
    // Flatten terrain - handled in CLEARING_BLOCKS
    this.state = CleanupState.CLEARING_BLOCKS;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.blocksToClean = [];
  }

  isFinished(): boolean {
    return this.state === CleanupState.FINISHED || this.state === CleanupState.FAILED;
  }

  isFailed(): boolean {
    return this.state === CleanupState.FAILED;
  }

  // ---- Helper Methods ----

  private scanArea(): void {
    this.blocksToClean = [];
    const center = this.config.center!;
    const radius = this.config.radius;

    // Ensure center is a Vec3 with offset method
    const centerX = center.x;
    const centerY = center.y;
    const centerZ = center.z;

    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        for (let y = -10; y <= 20; y++) {
          const pos = new Vec3(centerX + x, centerY + y, centerZ + z);

          // Check distance
          const dist = Math.sqrt(x * x + z * z);
          if (dist > radius) continue;

          const block = this.bot.blockAt(pos);
          if (!block) continue;

          if (this.shouldClearBlock(block)) {
            this.blocksToClean.push(pos);
          }
        }
      }
    }

    // Sort by distance (closest first)
    const playerPos = this.bot.entity.position;
    this.blocksToClean.sort((a, b) => {
      const distA = Math.sqrt(
        (a.x - playerPos.x) ** 2 +
        (a.y - playerPos.y) ** 2 +
        (a.z - playerPos.z) ** 2
      );
      const distB = Math.sqrt(
        (b.x - playerPos.x) ** 2 +
        (b.y - playerPos.y) ** 2 +
        (b.z - playerPos.z) ** 2
      );
      return distA - distB;
    });

    // Limit to max blocks
    if (this.blocksToClean.length > this.config.maxBlocks) {
      this.blocksToClean = this.blocksToClean.slice(0, this.config.maxBlocks);
    }
  }

  private shouldClearBlock(block: Block): boolean {
    const name = block.name;

    // Check preserve list
    if (this.config.preserveBlocks.includes(name)) {
      return false;
    }

    // For flatten mode, clear anything above target Y
    if (this.config.mode === CleanupMode.FLATTEN && this.config.targetY !== null) {
      if (block.position.y > this.config.targetY && name !== 'air') {
        return true;
      }
      return false;
    }

    // Check clear list
    if (this.config.blocksToClear.length > 0) {
      return this.config.blocksToClear.includes(name);
    }

    return false;
  }

  private findNearestDroppedItem(): any | null {
    const center = this.config.center!;
    let nearest: any | null = null;
    let nearestDist = Infinity;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if ((entity as any).type !== 'item' && entity.name !== 'item') continue;

      const pos = entity.position;
      const dist = Math.sqrt(
        (pos.x - center.x) ** 2 +
        (pos.y - center.y) ** 2 +
        (pos.z - center.z) ** 2
      );
      if (dist > this.config.radius) continue;

      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  /**
   * Get blocks cleaned count
   */
  getBlocksCleaned(): number {
    return this.blocksCleaned;
  }

  /**
   * Get items collected count
   */
  getItemsCollected(): number {
    return this.itemsCollected;
  }

  /**
   * Get remaining blocks to clean
   */
  getRemainingBlocks(): number {
    return this.blocksToClean.length;
  }

  /**
   * Get current state
   */
  getCurrentState(): CleanupState {
    return this.state;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof CleanupTask)) return false;

    return this.config.mode === other.config.mode &&
           this.config.radius === other.config.radius;
  }
}

/**
 * Convenience functions
 */
export function clearDebris(bot: Bot, radius: number = 16): CleanupTask {
  return new CleanupTask(bot, { mode: CleanupMode.CLEAR_DEBRIS, radius });
}

export function clearVegetation(bot: Bot, radius: number = 16): CleanupTask {
  return new CleanupTask(bot, { mode: CleanupMode.CLEAR_VEGETATION, radius });
}

export function flattenArea(bot: Bot, targetY: number, radius: number = 16): CleanupTask {
  return new CleanupTask(bot, {
    mode: CleanupMode.FLATTEN,
    targetY,
    radius,
  });
}

export function collectDroppedItems(bot: Bot, radius: number = 16): CleanupTask {
  return new CleanupTask(bot, {
    mode: CleanupMode.COLLECT_ITEMS,
    radius,
    blocksToClear: [],
  });
}

export function fullCleanup(bot: Bot, radius: number = 16): CleanupTask {
  return new CleanupTask(bot, { mode: CleanupMode.FULL, radius });
}

export function clearAroundPlayer(bot: Bot): CleanupTask {
  return new CleanupTask(bot, {
    mode: CleanupMode.CLEAR_DEBRIS,
    radius: 8,
    collectItems: true,
  });
}
