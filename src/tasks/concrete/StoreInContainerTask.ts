/**
 * StoreInContainerTask - Store items in a container
 *
 * After collecting resources, we need to store them safely.
 *
 * Based on BaritonePlus StoreInContainerTask.java
 */

import type { Bot } from 'mineflayer';
import type { Window } from 'prismarine-windows';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { BlockPos } from '../../types';
import { AbstractDoToStorageContainerTask } from './ContainerTask';
import { TimerGame } from '../../utils/timers/TimerGame';
import type { ContainerItemTarget } from './ContainerItemTarget';
import { containerItemTarget, itemMatchesTarget } from './ContainerItemTarget';

/**
 * Task to store items in a container.
 *
 * 1. Opens the specified container
 * 2. Finds items to store from our inventory
 * 3. Transfers them to the container
 * 4. Handles full container scenarios
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
