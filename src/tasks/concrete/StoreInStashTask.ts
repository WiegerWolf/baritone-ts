/**
 * StoreInStashTask - Store Items in Designated Stash Area
 * Based on BaritonePlus's StoreInStashTask.java
 *
 * WHY: Long-term survival requires organized storage:
 * - Keep valuable items safe in a designated area
 * - Track what's already stored to avoid duplicates
 * - Navigate to stash even when containers aren't visible
 * - Handle multiple container types (chest, barrel, shulker)
 *
 * This task:
 * 1. Checks what items need to be stored
 * 2. Finds available containers within the stash range
 * 3. Stores items, tracking what's been deposited
 * 4. Navigates to stash center if no containers found
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { StoreInContainerTask, containerItemTarget, ContainerItemTarget } from './StorageContainerTask';
import { DoToClosestBlockTask } from './BlockSearchTask';
import { GoToXZTask } from './GoToXZTask';
import { TimeoutWanderTask } from './TimeoutWanderTask';
import { BlockPos } from '../../types';
import { BlockRange } from '../../utils/BlockRange';
import { ItemTarget, itemTarget } from './ResourceTask';

/**
 * Container blocks that can be used for storage
 */
const STORAGE_BLOCKS = [
  'chest',
  'trapped_chest',
  'barrel',
  'shulker_box',
  'white_shulker_box',
  'orange_shulker_box',
  'magenta_shulker_box',
  'light_blue_shulker_box',
  'yellow_shulker_box',
  'lime_shulker_box',
  'pink_shulker_box',
  'gray_shulker_box',
  'light_gray_shulker_box',
  'cyan_shulker_box',
  'purple_shulker_box',
  'blue_shulker_box',
  'brown_shulker_box',
  'green_shulker_box',
  'red_shulker_box',
  'black_shulker_box',
];

/**
 * State for stash storage
 */
enum StashStorageState {
  CHECKING_INVENTORY,
  COLLECTING_ITEMS,
  FINDING_CONTAINER,
  STORING,
  TRAVELING_TO_STASH,
  FINISHED,
}

/**
 * Configuration for StoreInStashTask
 */
export interface StoreInStashConfig {
  /** Items to store */
  items: ItemTarget[];
  /** Stash region */
  stashRange: BlockRange;
  /** Whether to collect items if not in inventory */
  getIfNotPresent: boolean;
}

/**
 * Tracks what items have been stored in containers
 */
class StoredItemTracker {
  private storedCounts: Map<string, number> = new Map();

  /**
   * Record that items were stored
   */
  recordStored(itemName: string, count: number): void {
    const current = this.storedCounts.get(itemName) || 0;
    this.storedCounts.set(itemName, current + count);
  }

  /**
   * Get how many of an item have been stored
   */
  getStoredCount(itemName: string): number {
    return this.storedCounts.get(itemName) || 0;
  }

  /**
   * Get total stored count for any matching item names
   */
  getStoredCountForAny(itemNames: string[]): number {
    let total = 0;
    for (const name of itemNames) {
      total += this.getStoredCount(name);
    }
    return total;
  }

  /**
   * Reset tracking
   */
  reset(): void {
    this.storedCounts.clear();
  }
}

/**
 * Task to store items in containers within a designated stash area.
 *
 * WHY: Organized storage is essential for long-term survival:
 * - Prevents inventory overflow during long expeditions
 * - Keeps valuable items in a known, safe location
 * - Enables retrieval of stored items later
 *
 * Based on BaritonePlus StoreInStashTask.java
 */
export class StoreInStashTask extends Task {
  private config: StoreInStashConfig;
  private state: StashStorageState = StashStorageState.CHECKING_INVENTORY;
  private storedTracker: StoredItemTracker = new StoredItemTracker();
  private currentStoreTask: StoreInContainerTask | null = null;

  constructor(bot: Bot, config: StoreInStashConfig) {
    super(bot);
    this.config = config;
  }

  /**
   * Create task to store specific items in a stash
   */
  static storeItems(
    bot: Bot,
    stashRange: BlockRange,
    ...items: ItemTarget[]
  ): StoreInStashTask {
    return new StoreInStashTask(bot, {
      items,
      stashRange,
      getIfNotPresent: false,
    });
  }

  get displayName(): string {
    const itemNames = this.config.items.map(i => i.items[0]).join(', ');
    return `StoreInStash(${itemNames} in ${this.config.stashRange})`;
  }

  onStart(): void {
    this.state = StashStorageState.CHECKING_INVENTORY;
    this.storedTracker.reset();
    this.currentStoreTask = null;
  }

  onTick(): Task | null {
    // Check if we've stored everything
    if (this.hasStoredEverything()) {
      this.state = StashStorageState.FINISHED;
      return null;
    }

    // Continue current store task
    if (this.currentStoreTask && !this.currentStoreTask.isFinished()) {
      this.state = StashStorageState.STORING;
      return this.currentStoreTask;
    }

    // Record what was stored if task just finished
    if (this.currentStoreTask) {
      // In a full implementation, we'd track the actual items stored
      this.currentStoreTask = null;
    }

    // Check what we need to store
    const itemsToStore = this.getItemsToStore();
    if (itemsToStore.length === 0) {
      // If getIfNotPresent is true, we'd collect more items here
      if (this.config.getIfNotPresent) {
        this.state = StashStorageState.COLLECTING_ITEMS;
        // Would return collection task here
        return null;
      }
      this.state = StashStorageState.FINISHED;
      return null;
    }

    // Find a container within the stash range
    const container = this.findAvailableContainer();
    if (container) {
      this.state = StashStorageState.STORING;
      // Convert ItemTarget[] to ContainerItemTarget[]
      const containerTargets = itemsToStore.map(t => containerItemTarget(t.items, t.targetCount));
      this.currentStoreTask = new StoreInContainerTask(this.bot, container, ...containerTargets);
      return this.currentStoreTask;
    }

    // No container found, travel to stash center
    this.state = StashStorageState.TRAVELING_TO_STASH;
    const center = this.config.stashRange.getCenter();
    return new GoToXZTask(this.bot, center.x, center.z);
  }

  /**
   * Check if we've stored all required items
   */
  private hasStoredEverything(): boolean {
    for (const target of this.config.items) {
      const stored = this.storedTracker.getStoredCountForAny(target.items);
      if (stored < target.targetCount) {
        // Check if we have any left in inventory to store
        const inInventory = this.getItemCountForAny(target.items);
        if (inInventory > 0) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Get items that still need to be stored
   */
  private getItemsToStore(): ItemTarget[] {
    const result: ItemTarget[] = [];

    for (const target of this.config.items) {
      const stored = this.storedTracker.getStoredCountForAny(target.items);
      const needed = target.targetCount - stored;

      if (needed > 0) {
        const inInventory = this.getItemCountForAny(target.items);
        if (inInventory > 0) {
          result.push(itemTarget(target.items, Math.min(needed, inInventory)));
        }
      }
    }

    return result;
  }

  /**
   * Get count of an item in inventory
   */
  private getItemCount(itemName: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === itemName) {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Get count of any matching items in inventory
   */
  private getItemCountForAny(itemNames: string[]): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (itemNames.includes(item.name)) {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Find an available container within the stash range
   */
  private findAvailableContainer(): BlockPos | null {
    const playerPos = this.bot.entity.position;
    const range = this.config.stashRange;

    let nearest: BlockPos | null = null;
    let nearestDist = Infinity;

    // Search within range for containers
    for (let x = range.start.x; x <= range.end.x; x++) {
      for (let z = range.start.z; z <= range.end.z; z++) {
        for (let y = range.start.y; y <= range.end.y; y++) {
          const pos = new Vec3(x, y, z);
          const block = this.bot.blockAt(pos);

          if (block && STORAGE_BLOCKS.includes(block.name)) {
            const dist = playerPos.distanceTo(pos);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearest = new BlockPos(x, y, z);
            }
          }
        }
      }
    }

    return nearest;
  }

  onStop(interruptTask: ITask | null): void {
    this.currentStoreTask = null;
  }

  isFinished(): boolean {
    return this.state === StashStorageState.FINISHED || this.hasStoredEverything();
  }

  /**
   * Get current state
   */
  getState(): StashStorageState {
    return this.state;
  }

  /**
   * Get the stash range
   */
  getStashRange(): BlockRange {
    return this.config.stashRange;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof StoreInStashTask)) return false;
    return (
      this.config.stashRange.equals(other.config.stashRange) &&
      this.config.getIfNotPresent === other.config.getIfNotPresent &&
      this.config.items.length === other.config.items.length &&
      this.config.items.every((item, i) =>
        item.items.length === other.config.items[i].items.length &&
        item.items.every((name, j) => name === other.config.items[i].items[j]) &&
        item.targetCount === other.config.items[i].targetCount
      )
    );
  }
}

/**
 * Convenience function to store items in a stash
 */
export function storeInStash(
  bot: Bot,
  stashRange: BlockRange,
  ...items: ItemTarget[]
): StoreInStashTask {
  return StoreInStashTask.storeItems(bot, stashRange, ...items);
}

export { StashStorageState, STORAGE_BLOCKS };
