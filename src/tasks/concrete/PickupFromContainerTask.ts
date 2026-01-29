/**
 * PickupFromContainerTask - Pick up items from a container
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

import type { Bot } from 'mineflayer';
import type { Item } from 'prismarine-item';
import type { Window } from 'prismarine-windows';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { BlockPos } from '../../types';
import { AbstractDoToStorageContainerTask } from './ContainerTask';
import { EnsureFreeInventorySlotTask } from './SlotTask';
import { TimerGame } from '../../utils/timers/TimerGame';
import { ContainerItemTarget, containerItemTarget, itemMatchesTarget } from './ContainerItemTarget';

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
