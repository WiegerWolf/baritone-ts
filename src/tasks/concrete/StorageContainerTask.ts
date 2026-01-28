/**
 * StorageContainerTask - Storage Container Interaction Tasks
 * Based on BaritonePlus's container storage system
 *
 * WHY: Inventory management is critical for survival and automation.
 * These tasks handle:
 * - Picking up items from containers (chests, barrels, etc.)
 * - Storing items in containers
 * - Finding the best slots to transfer items
 *
 * This enables complex behaviors like:
 * - Restocking from chests
 * - Depositing loot
 * - Managing stashes
 */

import type { Bot } from 'mineflayer';
import type { Item } from 'prismarine-item';
import type { Window } from 'prismarine-windows';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { BlockPos } from '../../types';
import { AbstractDoToStorageContainerTask } from './ContainerTask';
import { EnsureFreeInventorySlotTask, SlotActionType } from './SlotTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Item target for container operations
 */
export interface ContainerItemTarget {
  /** Item name(s) to match */
  items: string | string[];
  /** Target count to have */
  targetCount: number;
}

/**
 * Create item target
 */
export function containerItemTarget(items: string | string[], count: number): ContainerItemTarget {
  return { items, targetCount: count };
}

/**
 * Check if an item matches a target
 */
export function itemMatchesTarget(itemName: string, target: ContainerItemTarget): boolean {
  const items = Array.isArray(target.items) ? target.items : [target.items];
  return items.some(name => itemName === name || itemName.includes(name));
}

/**
 * Slot info from container
 */
interface SlotInfo {
  slot: number;
  item: Item;
  count: number;
}

/**
 * Task to pick up items from a container.
 *
 * WHY: When exploring or collecting resources, we often need to grab items
 * from chests, barrels, or other containers. This task:
 * 1. Opens the specified container
 * 2. Finds items matching our targets
 * 3. Picks up the right amounts, prioritizing optimal stack sizes
 * 4. Handles full inventory scenarios
 *
 * Based on BaritonePlus PickupFromContainerTask.java
 */
export class PickupFromContainerTask extends AbstractDoToStorageContainerTask {
  private targetContainerPos: BlockPos;
  private targets: ContainerItemTarget[];
  private freeInventoryTask: EnsureFreeInventorySlotTask;
  private clickTimer: TimerGame;

  constructor(bot: Bot, containerPos: BlockPos, ...targets: ContainerItemTarget[]) {
    super(bot);
    this.targetContainerPos = containerPos;
    this.targets = targets;
    this.freeInventoryTask = new EnsureFreeInventorySlotTask(bot);
    this.clickTimer = new TimerGame(bot, 0.1); // Delay between clicks
  }

  get displayName(): string {
    return `PickupFromContainer(${this.targetContainerPos.x},${this.targetContainerPos.y},${this.targetContainerPos.z})`;
  }

  protected getContainerTarget(): BlockPos | null {
    return this.targetContainerPos;
  }

  onTick(): Task | null {
    // Free inventory if needed
    if (this.freeInventoryTask.isActive() &&
        !this.freeInventoryTask.isFinished() &&
        !this.hasEmptyInventorySlot()) {
      return this.freeInventoryTask;
    }

    return super.onTick();
  }

  protected onContainerOpenSubtask(containerPos: BlockPos): Task | null {
    const window = (this.bot as any).currentWindow as Window;
    if (!window) return null;

    // Check each target
    for (const target of this.targets) {
      const currentCount = this.getInventoryCountForTarget(target);
      const cursorItem = this.getCursorItem();

      // Subtract cursor if it matches (we're holding it)
      let adjustedCount = currentCount;
      if (cursorItem && itemMatchesTarget(cursorItem.name, target)) {
        adjustedCount -= cursorItem.count;
      }

      if (adjustedCount < target.targetCount) {
        // Need more of this item
        const containerSlots = this.getContainerSlotsWithItem(window, target);

        if (containerSlots.length === 0) continue;

        // Pick best slot to grab from
        const bestSlot = this.getBestSlotToTransfer(
          target,
          adjustedCount,
          containerSlots
        );

        if (bestSlot !== null && this.clickTimer.elapsed()) {
          // Pick it up
          this.clickSlot(window, bestSlot);
          this.clickTimer.reset();
          return null;
        }
      }
    }

    // All targets met or no items available
    return null;
  }

  /**
   * Get the best slot to transfer from based on stack sizes.
   *
   * WHY: Smart slot selection minimizes inventory operations:
   * - If we need 5 items and have stacks of 4 and 64, pick the 4-stack
   * - Prioritize stacks that fit exactly or slightly over
   * - Avoid picking up huge stacks when we only need a few
   */
  private getBestSlotToTransfer(
    target: ContainerItemTarget,
    currentCount: number,
    slots: SlotInfo[]
  ): number | null {
    if (slots.length === 0) return null;

    const needed = target.targetCount - currentCount;
    let bestSlot: SlotInfo | null = null;

    for (const slot of slots) {
      const overshoot = slot.count - needed;

      if (!bestSlot) {
        bestSlot = slot;
        continue;
      }

      const bestOvershoot = bestSlot.count - needed;
      const canFit = this.canFitInInventory(slot.count);
      const bestCanFit = this.canFitInInventory(bestSlot.count);

      // Prioritize slots that can fit in inventory
      if (canFit || !bestCanFit) {
        if (overshoot < 0) {
          // Under needed - pick highest that still goes under
          if (bestOvershoot > 0 || overshoot > bestOvershoot) {
            bestSlot = slot;
          }
        } else if (overshoot > 0) {
          // Over needed - pick smallest overshoot
          if (overshoot < bestOvershoot) {
            bestSlot = slot;
          }
        } else if (bestOvershoot !== 0) {
          // Perfect fit
          bestSlot = slot;
        }
      }
    }

    return bestSlot?.slot ?? null;
  }

  private getContainerSlotsWithItem(window: Window, target: ContainerItemTarget): SlotInfo[] {
    const slots: SlotInfo[] = [];

    // Container slots are the first slots in the window
    // Player inventory starts after container slots
    const containerSlotCount = this.getContainerSlotCount(window);

    for (let i = 0; i < containerSlotCount; i++) {
      const item = window.slots[i];
      if (item && itemMatchesTarget(item.name, target)) {
        slots.push({
          slot: i,
          item,
          count: item.count,
        });
      }
    }

    return slots;
  }

  private getContainerSlotCount(window: Window): number {
    // Typical container sizes
    const type = String(window.type || '').toLowerCase();
    if (type.includes('chest') || type.includes('generic_9x3')) return 27;
    if (type.includes('barrel')) return 27;
    if (type.includes('generic_9x6')) return 54; // Double chest
    if (type.includes('shulker')) return 27;
    if (type.includes('hopper')) return 5;
    if (type.includes('dispenser') || type.includes('dropper')) return 9;
    if (type.includes('furnace') || type.includes('smoker') || type.includes('blast')) return 3;

    // Default to 27 (single chest)
    return 27;
  }

  private getInventoryCountForTarget(target: ContainerItemTarget): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (itemMatchesTarget(item.name, target)) {
        count += item.count;
      }
    }
    return count;
  }

  private getCursorItem(): Item | null {
    // mineflayer doesn't directly expose cursor item, but we can check currentWindow
    const window = (this.bot as any).currentWindow as Window;
    if (!window) return null;
    // Cursor slot is typically -1 or special slot
    return (window as any).selectedItem || null;
  }

  private hasEmptyInventorySlot(): boolean {
    const inventorySize = this.bot.inventory.slots.length;
    for (let i = 9; i < inventorySize; i++) { // Skip hotbar for now
      if (!this.bot.inventory.slots[i]) return true;
    }
    return false;
  }

  private canFitInInventory(count: number): boolean {
    // Simplified check - can fit if we have empty slot
    // Real implementation would check stackability
    return this.hasEmptyInventorySlot();
  }

  private clickSlot(window: Window, slot: number): void {
    try {
      // Use mineflayer's window click
      this.bot.clickWindow(slot, 0, 0); // 0 = left click, 0 = pickup mode
    } catch (err) {
      // Will retry
    }
  }

  isFinished(): boolean {
    return this.targets.every(target =>
      this.getInventoryCountForTarget(target) >= target.targetCount
    );
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof PickupFromContainerTask)) return false;
    if (!this.targetContainerPos.equals(other.targetContainerPos)) return false;
    if (this.targets.length !== other.targets.length) return false;
    return this.targets.every((t, i) =>
      JSON.stringify(t) === JSON.stringify(other.targets[i])
    );
  }
}

/**
 * Task to store items in a container.
 *
 * WHY: After collecting resources, we need to store them safely.
 * This task:
 * 1. Opens the specified container
 * 2. Finds items to store from our inventory
 * 3. Transfers them to the container
 * 4. Handles full container scenarios
 *
 * Based on BaritonePlus StoreInContainerTask.java
 */
export class StoreInContainerTask extends AbstractDoToStorageContainerTask {
  private targetContainerPos: BlockPos;
  private targets: ContainerItemTarget[];
  private clickTimer: TimerGame;
  private storedTracker: Map<string, number> = new Map();

  constructor(bot: Bot, containerPos: BlockPos, ...targets: ContainerItemTarget[]) {
    super(bot);
    this.targetContainerPos = containerPos;
    this.targets = targets;
    this.clickTimer = new TimerGame(bot, 0.1);
  }

  get displayName(): string {
    return `StoreInContainer(${this.targetContainerPos.x},${this.targetContainerPos.y},${this.targetContainerPos.z})`;
  }

  protected getContainerTarget(): BlockPos | null {
    return this.targetContainerPos;
  }

  protected onContainerOpenSubtask(containerPos: BlockPos): Task | null {
    const window = (this.bot as any).currentWindow as Window;
    if (!window) return null;

    // Check each target
    for (const target of this.targets) {
      const inventoryCount = this.getInventoryCountForTarget(target);
      const stored = this.storedTracker.get(JSON.stringify(target.items)) || 0;

      // How many do we still need to store?
      const toStore = Math.min(inventoryCount, target.targetCount - stored);

      if (toStore > 0) {
        // Find item in inventory
        const inventorySlot = this.findInventorySlotWithItem(window, target);

        if (inventorySlot !== null && this.clickTimer.elapsed()) {
          // Check if container has room
          if (this.containerHasRoom(window)) {
            // Transfer item (shift-click for quick transfer)
            this.shiftClickSlot(window, inventorySlot);
            this.clickTimer.reset();
            // Track what we stored
            const key = JSON.stringify(target.items);
            const item = window.slots[inventorySlot];
            if (item) {
              this.storedTracker.set(key, stored + item.count);
            }
            return null;
          }
        }
      }
    }

    // All items stored or container full
    return null;
  }

  private findInventorySlotWithItem(window: Window, target: ContainerItemTarget): number | null {
    const containerSlotCount = this.getContainerSlotCount(window);
    const totalSlots = window.slots.length;

    // Inventory slots start after container slots
    for (let i = containerSlotCount; i < totalSlots; i++) {
      const item = window.slots[i];
      if (item && itemMatchesTarget(item.name, target)) {
        return i;
      }
    }

    return null;
  }

  private getContainerSlotCount(window: Window): number {
    const type = String(window.type || '').toLowerCase();
    if (type.includes('chest') || type.includes('generic_9x3')) return 27;
    if (type.includes('barrel')) return 27;
    if (type.includes('generic_9x6')) return 54;
    if (type.includes('shulker')) return 27;
    if (type.includes('hopper')) return 5;
    if (type.includes('dispenser') || type.includes('dropper')) return 9;
    if (type.includes('furnace') || type.includes('smoker') || type.includes('blast')) return 3;
    return 27;
  }

  private containerHasRoom(window: Window): boolean {
    const containerSlotCount = this.getContainerSlotCount(window);
    for (let i = 0; i < containerSlotCount; i++) {
      if (!window.slots[i]) return true;
    }
    return false;
  }

  private getInventoryCountForTarget(target: ContainerItemTarget): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (itemMatchesTarget(item.name, target)) {
        count += item.count;
      }
    }
    return count;
  }

  private shiftClickSlot(window: Window, slot: number): void {
    try {
      // 1 = shift-click mode
      this.bot.clickWindow(slot, 0, 1);
    } catch (err) {
      // Will retry
    }
  }

  isFinished(): boolean {
    // Finished when we've stored the target amounts
    return this.targets.every(target => {
      const key = JSON.stringify(target.items);
      const stored = this.storedTracker.get(key) || 0;
      return stored >= target.targetCount;
    });
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof StoreInContainerTask)) return false;
    if (!this.targetContainerPos.equals(other.targetContainerPos)) return false;
    if (this.targets.length !== other.targets.length) return false;
    return this.targets.every((t, i) =>
      JSON.stringify(t) === JSON.stringify(other.targets[i])
    );
  }
}

/**
 * Task to loot a chest - picks up all valuable items.
 *
 * WHY: When exploring structures, we want to grab everything useful.
 * This task opens a chest and picks up items based on a filter.
 */
export class LootContainerTask extends AbstractDoToStorageContainerTask {
  private targetContainerPos: BlockPos;
  private itemFilter: (itemName: string) => boolean;
  private clickTimer: TimerGame;
  private looted: boolean = false;

  constructor(
    bot: Bot,
    containerPos: BlockPos,
    itemFilter: (itemName: string) => boolean = () => true
  ) {
    super(bot);
    this.targetContainerPos = containerPos;
    this.itemFilter = itemFilter;
    this.clickTimer = new TimerGame(bot, 0.1);
  }

  get displayName(): string {
    return `LootContainer(${this.targetContainerPos.x},${this.targetContainerPos.y},${this.targetContainerPos.z})`;
  }

  protected getContainerTarget(): BlockPos | null {
    return this.targetContainerPos;
  }

  protected onContainerOpenSubtask(containerPos: BlockPos): Task | null {
    const window = (this.bot as any).currentWindow as Window;
    if (!window) return null;

    const containerSlotCount = this.getContainerSlotCount(window);

    // Look for items to loot
    for (let i = 0; i < containerSlotCount; i++) {
      const item = window.slots[i];
      if (item && this.itemFilter(item.name)) {
        if (this.clickTimer.elapsed()) {
          // Shift-click to quick transfer
          this.bot.clickWindow(i, 0, 1);
          this.clickTimer.reset();
          return null;
        }
      }
    }

    // No more items to loot
    this.looted = true;
    return null;
  }

  private getContainerSlotCount(window: Window): number {
    const type = String(window.type || '').toLowerCase();
    if (type.includes('chest') || type.includes('generic_9x3')) return 27;
    if (type.includes('barrel')) return 27;
    if (type.includes('generic_9x6')) return 54;
    if (type.includes('shulker')) return 27;
    if (type.includes('hopper')) return 5;
    if (type.includes('dispenser') || type.includes('dropper')) return 9;
    return 27;
  }

  isFinished(): boolean {
    return this.looted;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof LootContainerTask)) return false;
    return this.targetContainerPos.equals(other.targetContainerPos);
  }
}

/**
 * Convenience function to pick up specific items from a container
 */
export function pickupFromContainer(
  bot: Bot,
  containerPos: BlockPos,
  ...items: Array<{ item: string, count: number }>
): PickupFromContainerTask {
  const targets = items.map(i => containerItemTarget(i.item, i.count));
  return new PickupFromContainerTask(bot, containerPos, ...targets);
}

/**
 * Convenience function to store items in a container
 */
export function storeInContainer(
  bot: Bot,
  containerPos: BlockPos,
  ...items: Array<{ item: string, count: number }>
): StoreInContainerTask {
  const targets = items.map(i => containerItemTarget(i.item, i.count));
  return new StoreInContainerTask(bot, containerPos, ...targets);
}

/**
 * Convenience function to loot all items from a container
 */
export function lootContainer(
  bot: Bot,
  containerPos: BlockPos,
  itemFilter?: (itemName: string) => boolean
): LootContainerTask {
  return new LootContainerTask(bot, containerPos, itemFilter);
}
