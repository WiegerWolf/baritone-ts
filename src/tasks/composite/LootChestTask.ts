/**
 * LootChestTask - Container Looting Automation
 * Based on AltoClef patterns
 *
 * Handles finding, opening, and looting chests and other containers.
 * Supports filtering for specific items and managing inventory space.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GetToBlockTask } from '../concrete/GoToTask';
import { InteractBlockTask } from '../concrete/InteractTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for looting
 */
enum LootState {
  SEARCHING,
  APPROACHING,
  OPENING,
  LOOTING,
  CLOSING,
  FINISHED,
  FAILED
}

/**
 * Container types
 */
const CONTAINER_BLOCKS = [
  'chest', 'trapped_chest', 'barrel',
  'shulker_box', 'white_shulker_box', 'orange_shulker_box',
  'magenta_shulker_box', 'light_blue_shulker_box', 'yellow_shulker_box',
  'lime_shulker_box', 'pink_shulker_box', 'gray_shulker_box',
  'light_gray_shulker_box', 'cyan_shulker_box', 'purple_shulker_box',
  'blue_shulker_box', 'brown_shulker_box', 'green_shulker_box',
  'red_shulker_box', 'black_shulker_box',
  'ender_chest',
];

/**
 * Configuration for looting
 */
export interface LootChestConfig {
  /** Search radius for containers */
  searchRadius: number;
  /** Items to look for (empty = take all) */
  targetItems: string[];
  /** Items to ignore */
  ignoreItems: string[];
  /** Maximum containers to loot */
  maxContainers: number;
  /** Leave at least this many slots free */
  keepSlotsFree: number;
  /** Include ender chests */
  includeEnderChests: boolean;
  /** Mark looted containers */
  trackLooted: boolean;
}

const DEFAULT_CONFIG: LootChestConfig = {
  searchRadius: 32,
  targetItems: [],
  ignoreItems: [],
  maxContainers: 10,
  keepSlotsFree: 2,
  includeEnderChests: false,
  trackLooted: true,
};

/**
 * Task for looting containers
 */
export class LootChestTask extends Task {
  private config: LootChestConfig;
  private state: LootState = LootState.SEARCHING;
  private currentContainer: Vec3 | null = null;
  private lootedContainers: Set<string> = new Set();
  private containersLooted: number = 0;
  private itemsCollected: number = 0;
  private lootTimer: TimerGame;
  private searchTimer: TimerGame;

  constructor(bot: Bot, config: Partial<LootChestConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.lootTimer = new TimerGame(bot, 0.25);
    this.searchTimer = new TimerGame(bot, 3.0);
  }

  get displayName(): string {
    return `LootChest(${this.containersLooted} containers, ${this.itemsCollected} items, ${LootState[this.state]})`;
  }

  onStart(): void {
    this.state = LootState.SEARCHING;
    this.currentContainer = null;
    this.containersLooted = 0;
    this.itemsCollected = 0;
    if (!this.config.trackLooted) {
      this.lootedContainers.clear();
    }
  }

  onTick(): Task | null {
    // Check if done
    if (this.containersLooted >= this.config.maxContainers) {
      this.state = LootState.FINISHED;
      return null;
    }

    // Check inventory space
    if (!this.hasInventorySpace()) {
      this.state = LootState.FINISHED;
      return null;
    }

    switch (this.state) {
      case LootState.SEARCHING:
        return this.handleSearching();

      case LootState.APPROACHING:
        return this.handleApproaching();

      case LootState.OPENING:
        return this.handleOpening();

      case LootState.LOOTING:
        return this.handleLooting();

      case LootState.CLOSING:
        return this.handleClosing();

      default:
        return null;
    }
  }

  private handleSearching(): Task | null {
    this.currentContainer = this.findNearestContainer();

    if (this.currentContainer) {
      this.state = LootState.APPROACHING;
      return null;
    }

    // No containers found
    if (this.searchTimer.elapsed()) {
      this.state = LootState.FINISHED;
    }

    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.currentContainer) {
      this.state = LootState.SEARCHING;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.currentContainer);

    if (dist <= 4) {
      this.state = LootState.OPENING;
      return null;
    }

    return new GetToBlockTask(
      this.bot,
      Math.floor(this.currentContainer.x),
      Math.floor(this.currentContainer.y),
      Math.floor(this.currentContainer.z)
    );
  }

  private handleOpening(): Task | null {
    if (!this.currentContainer) {
      this.state = LootState.SEARCHING;
      return null;
    }

    // Check if container window is open
    const currentWindow = (this.bot as any).currentWindow;
    if (currentWindow) {
      this.state = LootState.LOOTING;
      this.lootTimer.reset();
      return null;
    }

    // Open the container
    return new InteractBlockTask(
      this.bot,
      Math.floor(this.currentContainer.x),
      Math.floor(this.currentContainer.y),
      Math.floor(this.currentContainer.z)
    );
  }

  private handleLooting(): Task | null {
    const currentWindow = (this.bot as any).currentWindow;

    if (!currentWindow) {
      // Window closed unexpectedly
      this.markContainerLooted();
      this.state = LootState.SEARCHING;
      return null;
    }

    if (!this.lootTimer.elapsed()) {
      return null;
    }
    this.lootTimer.reset();

    // Find items to take
    const slots = currentWindow.slots || [];
    let tookItem = false;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot) continue;

      // Check if this is a container slot (not player inventory)
      if (i >= currentWindow.inventoryStart) break;

      // Check if we want this item
      if (!this.shouldTakeItem(slot.name)) continue;

      // Check inventory space
      if (!this.hasInventorySpace()) {
        this.state = LootState.CLOSING;
        return null;
      }

      // Take the item (shift-click to move to inventory)
      try {
        this.bot.clickWindow(i, 0, 1); // Shift-click
        this.itemsCollected += slot.count;
        tookItem = true;
        break; // One item per tick
      } catch {
        // May fail
      }
    }

    if (!tookItem) {
      // No more items to take
      this.state = LootState.CLOSING;
    }

    return null;
  }

  private handleClosing(): Task | null {
    const currentWindow = (this.bot as any).currentWindow;

    if (currentWindow) {
      try {
        this.bot.closeWindow(currentWindow);
      } catch {
        // May fail
      }
    }

    this.markContainerLooted();
    this.state = LootState.SEARCHING;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Close any open window
    const currentWindow = (this.bot as any).currentWindow;
    if (currentWindow) {
      try {
        this.bot.closeWindow(currentWindow);
      } catch {
        // May fail
      }
    }
    this.currentContainer = null;
  }

  isFinished(): boolean {
    return this.state === LootState.FINISHED || this.state === LootState.FAILED;
  }

  isFailed(): boolean {
    return this.state === LootState.FAILED;
  }

  // ---- Helper Methods ----

  private findNearestContainer(): Vec3 | null {
    const playerPos = this.bot.entity.position;
    let nearest: Vec3 | null = null;
    let nearestDist = Infinity;

    for (let x = -this.config.searchRadius; x <= this.config.searchRadius; x += 2) {
      for (let z = -this.config.searchRadius; z <= this.config.searchRadius; z += 2) {
        for (let y = -10; y <= 10; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (!block || !this.isContainer(block.name)) continue;

          // Skip already looted
          const key = this.posToKey(pos);
          if (this.lootedContainers.has(key)) continue;

          const dist = playerPos.distanceTo(pos);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = pos.clone();
          }
        }
      }
    }

    return nearest;
  }

  private isContainer(blockName: string): boolean {
    if (!this.config.includeEnderChests && blockName === 'ender_chest') {
      return false;
    }
    return CONTAINER_BLOCKS.includes(blockName) || blockName.includes('shulker_box');
  }

  private shouldTakeItem(itemName: string): boolean {
    // Check ignore list
    if (this.config.ignoreItems.includes(itemName)) {
      return false;
    }

    // If no target items specified, take everything
    if (this.config.targetItems.length === 0) {
      return true;
    }

    // Check if item is in target list
    return this.config.targetItems.includes(itemName);
  }

  private hasInventorySpace(): boolean {
    const items = this.bot.inventory.items();
    const totalSlots = 36; // Main inventory slots
    const usedSlots = items.length;
    const freeSlots = totalSlots - usedSlots;
    return freeSlots > this.config.keepSlotsFree;
  }

  private markContainerLooted(): void {
    if (this.currentContainer && this.config.trackLooted) {
      const key = this.posToKey(this.currentContainer);
      this.lootedContainers.add(key);
    }
    this.containersLooted++;
    this.currentContainer = null;
  }

  private posToKey(pos: Vec3): string {
    return `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
  }

  /**
   * Get containers looted count
   */
  getContainersLooted(): number {
    return this.containersLooted;
  }

  /**
   * Get items collected count
   */
  getItemsCollected(): number {
    return this.itemsCollected;
  }

  /**
   * Get current state
   */
  getCurrentState(): LootState {
    return this.state;
  }

  /**
   * Clear looted container tracking
   */
  clearLootedTracking(): void {
    this.lootedContainers.clear();
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof LootChestTask)) return false;

    return JSON.stringify(this.config.targetItems) === JSON.stringify(other.config.targetItems);
  }
}

/**
 * Convenience functions
 */
export function lootNearbyChests(bot: Bot): LootChestTask {
  return new LootChestTask(bot);
}

export function lootForItems(bot: Bot, items: string[]): LootChestTask {
  return new LootChestTask(bot, { targetItems: items });
}

export function lootAllContainers(bot: Bot, radius: number = 32): LootChestTask {
  return new LootChestTask(bot, { searchRadius: radius, maxContainers: 100 });
}

export function lootValuables(bot: Bot): LootChestTask {
  return new LootChestTask(bot, {
    targetItems: [
      'diamond', 'emerald', 'gold_ingot', 'iron_ingot',
      'diamond_sword', 'diamond_pickaxe', 'diamond_chestplate',
      'enchanted_golden_apple', 'golden_apple', 'ender_pearl',
      'totem_of_undying', 'elytra', 'netherite_ingot',
    ],
  });
}
