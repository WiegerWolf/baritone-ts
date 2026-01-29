/**
 * StorageTask - Container Storage Management
 * Based on AltoClef's container tracking and storage system
 *
 * Handles depositing items to containers, retrieving items,
 * and organizing inventory across multiple storage locations.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GetToBlockTask } from '../concrete/GetToBlockTask';
import { InteractBlockTask } from '../concrete/InteractTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Storage operation type
 */
export enum StorageOperation {
  DEPOSIT,    // Put items into container
  WITHDRAW,   // Take items from container
  ORGANIZE,   // Sort and organize inventory
  DUMP_ALL,   // Dump all items to container
}

/**
 * State for storage operation
 */
enum StorageState {
  FINDING_CONTAINER,
  APPROACHING,
  OPENING_CONTAINER,
  TRANSFERRING,
  CLOSING,
  FINDING_NEXT,
  FINISHED,
  FAILED
}

/**
 * Configuration for storage operation
 */
export interface StorageConfig {
  /** Operation to perform */
  operation: StorageOperation;
  /** Items to deposit/withdraw (empty = all) */
  targetItems: string[];
  /** Amount per item (0 = all available) */
  amounts: Record<string, number>;
  /** Search radius for containers */
  searchRadius: number;
  /** Container types to use */
  containerTypes: string[];
  /** Keep minimum amount in inventory when depositing */
  keepMinimum: Record<string, number>;
}

const DEFAULT_CONFIG: StorageConfig = {
  operation: StorageOperation.DEPOSIT,
  targetItems: [],
  amounts: {},
  searchRadius: 32,
  containerTypes: ['chest', 'barrel', 'shulker_box', 'trapped_chest', 'ender_chest'],
  keepMinimum: {},
};

/**
 * Container slot counts
 */
const CONTAINER_SLOTS: Record<string, number> = {
  'chest': 27,
  'trapped_chest': 27,
  'barrel': 27,
  'ender_chest': 27,
  'shulker_box': 27,
  'dispenser': 9,
  'dropper': 9,
  'hopper': 5,
};

/**
 * Task for managing container storage
 */
export class StorageTask extends Task {
  private config: StorageConfig;
  private state: StorageState = StorageState.FINDING_CONTAINER;
  private currentContainer: Block | null = null;
  private visitedContainers: Set<string> = new Set();
  private transferTimer: TimerGame;
  private windowOpen: boolean = false;
  private itemsTransferred: number = 0;

  constructor(bot: Bot, config: Partial<StorageConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.transferTimer = new TimerGame(bot, 0.25);
  }

  get displayName(): string {
    return `Storage(${StorageOperation[this.config.operation]}, transferred: ${this.itemsTransferred})`;
  }

  onStart(): void {
    this.state = StorageState.FINDING_CONTAINER;
    this.currentContainer = null;
    this.visitedContainers.clear();
    this.windowOpen = false;
    this.itemsTransferred = 0;
  }

  onTick(): Task | null {
    switch (this.state) {
      case StorageState.FINDING_CONTAINER:
        return this.handleFindingContainer();

      case StorageState.APPROACHING:
        return this.handleApproaching();

      case StorageState.OPENING_CONTAINER:
        return this.handleOpeningContainer();

      case StorageState.TRANSFERRING:
        return this.handleTransferring();

      case StorageState.CLOSING:
        return this.handleClosing();

      case StorageState.FINDING_NEXT:
        return this.handleFindingNext();

      default:
        return null;
    }
  }

  private handleFindingContainer(): Task | null {
    this.currentContainer = this.findContainer();
    if (!this.currentContainer) {
      // No more containers
      if (this.itemsTransferred > 0) {
        this.state = StorageState.FINISHED;
      } else {
        this.state = StorageState.FAILED;
      }
      return null;
    }

    const key = this.containerKey(this.currentContainer.position);
    this.visitedContainers.add(key);

    this.state = StorageState.APPROACHING;
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.currentContainer) {
      this.state = StorageState.FINDING_CONTAINER;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.currentContainer.position);
    if (dist <= 4.0) {
      this.state = StorageState.OPENING_CONTAINER;
      return null;
    }

    return new GetToBlockTask(
      this.bot,
      Math.floor(this.currentContainer.position.x),
      Math.floor(this.currentContainer.position.y),
      Math.floor(this.currentContainer.position.z)
    );
  }

  private handleOpeningContainer(): Task | null {
    if (!this.currentContainer) {
      this.state = StorageState.FINDING_CONTAINER;
      return null;
    }

    const window = (this.bot as any).currentWindow;
    if (window && this.isContainerWindow(window)) {
      this.windowOpen = true;
      this.state = StorageState.TRANSFERRING;
      return null;
    }

    return new InteractBlockTask(
      this.bot,
      Math.floor(this.currentContainer.position.x),
      Math.floor(this.currentContainer.position.y),
      Math.floor(this.currentContainer.position.z)
    );
  }

  private handleTransferring(): Task | null {
    if (!this.transferTimer.elapsed()) {
      return null;
    }

    const window = (this.bot as any).currentWindow;
    if (!window || !this.isContainerWindow(window)) {
      this.windowOpen = false;
      this.state = StorageState.OPENING_CONTAINER;
      return null;
    }

    let transferred = false;

    switch (this.config.operation) {
      case StorageOperation.DEPOSIT:
      case StorageOperation.DUMP_ALL:
        transferred = this.depositItems(window);
        break;

      case StorageOperation.WITHDRAW:
        transferred = this.withdrawItems(window);
        break;

      case StorageOperation.ORGANIZE:
        transferred = this.organizeItems(window);
        break;
    }

    if (transferred) {
      this.itemsTransferred++;
      this.transferTimer.reset();
      return null;
    }

    // No more items to transfer in this container
    this.state = StorageState.CLOSING;
    return null;
  }

  private handleClosing(): Task | null {
    const window = (this.bot as any).currentWindow;
    if (window) {
      try {
        this.bot.closeWindow(window);
      } catch {
        // Ignore
      }
    }

    this.windowOpen = false;

    // Check if we need more containers
    if (this.needsMoreContainers()) {
      this.state = StorageState.FINDING_NEXT;
    } else {
      this.state = StorageState.FINISHED;
    }

    return null;
  }

  private handleFindingNext(): Task | null {
    this.currentContainer = null;
    this.state = StorageState.FINDING_CONTAINER;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    const window = (this.bot as any).currentWindow;
    if (window) {
      try {
        this.bot.closeWindow(window);
      } catch {
        // Ignore
      }
    }
    this.currentContainer = null;
    this.windowOpen = false;
  }

  isFinished(): boolean {
    return this.state === StorageState.FINISHED || this.state === StorageState.FAILED;
  }

  isFailed(): boolean {
    return this.state === StorageState.FAILED;
  }

  // ---- Transfer Methods ----

  private depositItems(window: any): boolean {
    const containerSlots = this.getContainerSlotCount(window);

    // Find item to deposit
    for (const item of this.bot.inventory.items()) {
      // Check if should deposit this item
      if (!this.shouldTransferItem(item.name, 'deposit')) continue;

      // Find empty slot in container
      for (let slot = 0; slot < containerSlots; slot++) {
        if (!window.slots[slot]) {
          try {
            // Shift-click to move
            this.bot.clickWindow(item.slot, 0, 1);
            return true;
          } catch {
            return false;
          }
        }
      }
    }

    return false;
  }

  private withdrawItems(window: any): boolean {
    const containerSlots = this.getContainerSlotCount(window);

    // Find item to withdraw
    for (let slot = 0; slot < containerSlots; slot++) {
      const item = window.slots[slot];
      if (!item) continue;

      // Check if should withdraw this item
      if (!this.shouldTransferItem(item.name, 'withdraw')) continue;

      // Check if we have room
      if (!this.hasInventorySpace()) continue;

      try {
        // Shift-click to move to inventory
        this.bot.clickWindow(slot, 0, 1);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  private organizeItems(window: any): boolean {
    // Simple organization: stack similar items
    const containerSlots = this.getContainerSlotCount(window);

    for (let i = 0; i < containerSlots; i++) {
      const itemA = window.slots[i];
      if (!itemA || itemA.count >= itemA.stackSize) continue;

      for (let j = i + 1; j < containerSlots; j++) {
        const itemB = window.slots[j];
        if (!itemB) continue;

        if (itemA.name === itemB.name && itemA.count < itemA.stackSize) {
          try {
            // Pick up item B and place on item A
            this.bot.clickWindow(j, 0, 0);
            this.bot.clickWindow(i, 0, 0);
            return true;
          } catch {
            return false;
          }
        }
      }
    }

    return false;
  }

  // ---- Helper Methods ----

  private findContainer(): Block | null {
    const playerPos = this.bot.entity.position;
    let nearest: Block | null = null;
    let nearestDist = Infinity;

    for (let x = -this.config.searchRadius; x <= this.config.searchRadius; x += 2) {
      for (let z = -this.config.searchRadius; z <= this.config.searchRadius; z += 2) {
        for (let y = -10; y <= 10; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (!block) continue;

          // Check if it's a valid container type
          if (!this.isValidContainer(block.name)) continue;

          // Skip already visited
          const key = this.containerKey(pos);
          if (this.visitedContainers.has(key)) continue;

          const dist = playerPos.distanceTo(pos);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = block;
          }
        }
      }
    }

    return nearest;
  }

  private isValidContainer(blockName: string): boolean {
    // Check against configured container types
    for (const type of this.config.containerTypes) {
      if (blockName === type || blockName.includes(type)) {
        return true;
      }
    }
    return false;
  }

  private isContainerWindow(window: any): boolean {
    if (!window || !window.type) return false;

    const type = window.type.toLowerCase();
    return type.includes('chest') ||
           type.includes('barrel') ||
           type.includes('shulker') ||
           type.includes('generic') ||
           type.includes('hopper') ||
           type.includes('dispenser') ||
           type.includes('dropper');
  }

  private getContainerSlotCount(window: any): number {
    // Try to determine from window
    if (window.inventoryStart) {
      return window.inventoryStart;
    }

    // Fallback based on block type
    if (this.currentContainer) {
      const name = this.currentContainer.name;
      for (const [type, slots] of Object.entries(CONTAINER_SLOTS)) {
        if (name.includes(type)) {
          return slots;
        }
      }
    }

    return 27; // Default chest size
  }

  private shouldTransferItem(itemName: string, direction: 'deposit' | 'withdraw'): boolean {
    // If specific items listed, only transfer those
    if (this.config.targetItems.length > 0) {
      if (!this.config.targetItems.includes(itemName)) {
        return false;
      }
    }

    // Check amount limits
    if (this.config.amounts[itemName] !== undefined) {
      const current = this.countItem(itemName);
      const limit = this.config.amounts[itemName];

      if (direction === 'deposit' && current <= limit) {
        return false;
      }
      if (direction === 'withdraw' && current >= limit) {
        return false;
      }
    }

    // Check keep minimum (for deposits)
    if (direction === 'deposit' && this.config.keepMinimum[itemName] !== undefined) {
      const current = this.countItem(itemName);
      if (current <= this.config.keepMinimum[itemName]) {
        return false;
      }
    }

    return true;
  }

  private needsMoreContainers(): boolean {
    switch (this.config.operation) {
      case StorageOperation.DEPOSIT:
      case StorageOperation.DUMP_ALL:
        // Need more if we still have items to deposit
        return this.hasItemsToDeposit();

      case StorageOperation.WITHDRAW:
        // Need more if we haven't reached target amounts
        return this.needsMoreItems();

      default:
        return false;
    }
  }

  private hasItemsToDeposit(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (this.shouldTransferItem(item.name, 'deposit')) {
        return true;
      }
    }
    return false;
  }

  private needsMoreItems(): boolean {
    for (const itemName of this.config.targetItems) {
      const current = this.countItem(itemName);
      const target = this.config.amounts[itemName] ?? 64;
      if (current < target) {
        return true;
      }
    }
    return false;
  }

  private hasInventorySpace(): boolean {
    // Check for empty slots
    for (let slot = 9; slot <= 44; slot++) {
      if (!this.bot.inventory.slots[slot]) {
        return true;
      }
    }
    return false;
  }

  private countItem(itemName: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name === itemName) {
        count += item.count;
      }
    }
    return count;
  }

  private containerKey(pos: Vec3): string {
    return `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
  }

  /**
   * Get number of items transferred
   */
  getTransferredCount(): number {
    return this.itemsTransferred;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof StorageTask)) return false;

    return JSON.stringify(this.config) === JSON.stringify(other.config);
  }
}

/**
 * Convenience functions
 */
export function depositItems(bot: Bot, items: string[]): StorageTask {
  return new StorageTask(bot, {
    operation: StorageOperation.DEPOSIT,
    targetItems: items,
  });
}

export function depositAll(bot: Bot): StorageTask {
  return new StorageTask(bot, {
    operation: StorageOperation.DUMP_ALL,
  });
}

export function withdrawItems(bot: Bot, items: string[], amounts?: Record<string, number>): StorageTask {
  return new StorageTask(bot, {
    operation: StorageOperation.WITHDRAW,
    targetItems: items,
    amounts: amounts ?? {},
  });
}

export function organizeStorage(bot: Bot): StorageTask {
  return new StorageTask(bot, {
    operation: StorageOperation.ORGANIZE,
  });
}

export function depositKeepMinimum(bot: Bot, keepAmounts: Record<string, number>): StorageTask {
  return new StorageTask(bot, {
    operation: StorageOperation.DEPOSIT,
    keepMinimum: keepAmounts,
  });
}
